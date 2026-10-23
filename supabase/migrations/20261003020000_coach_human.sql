-- Cronos — human coaching: coaches, sessions, messages, routine provenance.
--
-- The AI assistant in `coach-assistant` is free and stateless; this migration is
-- the other half of the coach product, the paid tier where a person answers. It
-- introduces four tables, one column on `routines`, and the RLS that keeps a coach
-- from reading an athlete they were not assigned and an athlete from reading a
-- coach's other clients.
--
-- Applying it to a database that already has these objects is a no-op: every
-- `create table` is `if not exists` and every policy is preceded by
-- `drop policy if exists`.
--
-- The security model in one sentence: an athlete may name the coach they want, but
-- only ever see their own conversation, and only ever write into it as themselves.

-- ---------------------------------------------------------------------------
-- coaches: the people behind the paid tier.
--
-- `user_id` links a coach row to the auth account that owns it and is unique, so a
-- person has at most one coach row and RLS can recognise them by `auth.uid()` alone.
-- The coach signs in with their normal account; the PIN is a second factor *inside*
-- the app, not a replacement for the session. That is what lets every policy below
-- be written in terms of `auth.uid()` -- there is no second identity to reconcile.
--
-- `pin_hash` is plain `text`, not a `bytea` and not a postfix-bearing digest. It is
-- deliberately a storage slot with no algorithm implied: the hash is produced and
-- verified by the `coach-auth` Edge Function (Block 2), which owns the format, and
-- nothing in the client needs to interpret it. A column typed to a particular
-- algorithm would freeze that choice into the schema before the code that has to read
-- it exists.
--
-- Rows are never created by an athlete. There is no INSERT policy on this table --
-- RLS denies a command with no policy, so that is the guarantee rather than an
-- oversight -- so `coaches` can only be populated by the service role.
-- ---------------------------------------------------------------------------
create table if not exists public.coaches (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users (id) on delete cascade,

  display_name  text not null,
  pin_hash      text not null,

  -- `is_provisional` marks a coach still on a seeded PIN. The Edge Function refuses
  -- to issue a session JWT while it is true, which is what forces the first PIN
  -- change without needing a separate onboarding flow.
  is_provisional boolean not null default true,

  -- Retire rather than delete. A coach who leaves still has historical messages and
  -- routines attributed to them, and cascading that deletion would erase an
  -- athlete's record of what was prescribed.
  is_active     boolean not null default true,

  -- Free-text areas of specialisation, shown to an athlete choosing a coach. Not an
  -- enum: the vocabulary is whatever the coaching team writes, and constraining it
  -- means a migration every time someone adds a specialty.
  specialties   text[] not null default '{}',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.coaches enable row level security;

-- No index on `is_active`. The only query that filters it is the roster, which is a
-- sequential read of a table holding one row per coach -- a handful of rows that
-- fit in a single page. An index here would be a second structure maintained on
-- every coach update to accelerate a scan that is already free.
--
-- `drop policy ... if exists` before each `create policy`, because `create policy`
-- has no `if not exists` form and a re-run would otherwise fail on the duplicate.

drop policy if exists "athletes can read active coaches" on public.coaches;

create policy "athletes can read active coaches"
  on public.coaches
  for select
  to authenticated
  using (is_active = true);

-- A coach reading their own row is a separate policy because it must ignore
-- `is_active`: a retired coach still needs to see their own record to understand
-- their own state. Without it, `is_active` would lock a coach out of the only row
-- describing them.
drop policy if exists "coaches can read own row" on public.coaches;

create policy "coaches can read own row"
  on public.coaches
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- `coaches` is the roster a client reads but never writes, and the two policies
-- above grant exactly that.
--
-- There is no INSERT, UPDATE or DELETE policy. A client therefore cannot add itself
-- to the roster, cannot flip its own `is_provisional` flag past the first-PIN-change
-- requirement, and cannot rewrite a `pin_hash`. Those writes belong to the service
-- role and the `coach-auth` function.
--
-- ---------------------------------------------------------------------------
-- coach_login_attempts: the PIN lockout, counted server-side.
--
-- A client-side attempt counter is not a control, it is a suggestion. The thing
-- being protected here is a four-digit PIN against an unbounded guessing budget, so
-- the budget has to be enforced where the guesses land -- the Edge Function, using
-- the service role, which is the only caller that can see these rows.
--
-- Every attempt is recorded, including successes. Counting only failures would make
-- a legitimate user's successful login indistinguishable from an attacker probing,
-- and the row count is small enough that keeping both is the honest record.
-- ---------------------------------------------------------------------------
create table if not exists public.coach_login_attempts (
  coach_id     uuid references public.coaches (id) on delete cascade,
  attempted_at timestamptz default now(),
  succeeded   boolean default false
);

-- RLS enabled with no policy at all, which is the point rather than an omission.
-- Supabase grants `authenticated` table-level privileges on new tables by default,
-- so without this line the attempt log would be readable by every signed-in client:
-- a live feed of which coach is being brute-forced, how often, and which attempts
-- landed -- the exact record an attacker would want while doing it. With RLS on and
-- no policy, every command is denied, and the service role still reads freely because
-- it bypasses RLS. No primary key either: this is an append-only audit log, and a
-- surrogate key on it would only invite an update path nobody needs.
alter table public.coach_login_attempts enable row level security;

-- The only query this serves is "how many failures for this coach in the last N
-- minutes", which filters on `coach_id` and ranges over `attempted_at`. Indexed in
-- that order so the composite answers the filter and the range together; the reverse
-- order would need a scan across every coach's history to find one coach's rows.
create index if not exists idx_coach_login_attempts_coach_time
  on public.coach_login_attempts (coach_id, attempted_at);

-- ---------------------------------------------------------------------------
-- coach_session_requests: an athlete asking a coach for attention.
--
-- This is the join between the two sides and therefore the spine of every policy
-- below. Two read paths, deliberately separate: the athlete sees requests they
-- opened, the coach sees requests addressed to them. Neither path can reach the
-- other's, and both are expressed as an `exists` over this table's own columns so
-- they cannot drift from them.
--
-- `status` is a lifecycle, not a label: `pending` (asked, unanswered) -> `active`
-- (coach accepted; this is the request the chat is attached to) -> `closed`, or
-- straight back out to `declined` / `cancelled` from `pending`. The CHECK fixes the
-- vocabulary so a typo cannot invent a state no reader handles.
-- ---------------------------------------------------------------------------
create table if not exists public.coach_session_requests (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null references auth.users (id) on delete cascade,
  coach_id      uuid not null references public.coaches (id) on delete cascade,
  status        text not null default 'pending'
                  check (status in ('pending', 'active', 'declined', 'closed', 'cancelled')),
  athlete_notes text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- The queue a coach opens: their requests, oldest unanswered first.
create index if not exists idx_coach_session_requests_coach
  on public.coach_session_requests (coach_id, created_at desc);

-- The athlete's own history of who they have asked.
create index if not exists idx_coach_session_requests_athlete
  on public.coach_session_requests (athlete_id, created_at desc);

-- "One open request per coach" is *not* a unique index. A coach may legitimately
-- have several athletes at once, and an athlete may re-ask a coach after closing a
-- previous request, so a partial unique on `(coach_id)` would be meaningless and one
-- on `(athlete_id)` would be wrong. Whatever deduplication is wanted belongs in the
-- query that reads the queue, not in a constraint that has to be dropped to
-- express it.

alter table public.coach_session_requests enable row level security;

drop policy if exists "athletes can read own requests" on public.coach_session_requests;

create policy "athletes can read own requests"
  on public.coach_session_requests
  for select
  to authenticated
  using (athlete_id = auth.uid());

drop policy if exists "premium athletes can request a coach" on public.coach_session_requests;

create policy "premium athletes can request a coach"
  on public.coach_session_requests
  for insert
  to authenticated
  with check (
    athlete_id = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.is_premium
        and (p.premium_expires_at is null or p.premium_expires_at > now())
    )
  );

-- A coach advances a request from `pending` to `active` and later closes it.
--
-- The `using` expression is deliberately *not* mirrored into a `with check`. For
-- UPDATE, Postgres defaults the check to the `using` expression, so the same test
-- runs against the post-update row: a coach who tries to move a request onto another
-- coach's id fails, because after the move `c.user_id = auth.uid()` is no longer true
-- for whoever now owns it. That is what stops a coach from handing their client
-- sideways, and writing the check out separately would be a second copy of the same
-- predicate free to drift from the first.
--
-- There is no athlete UPDATE policy, and the gap is on purpose. `athlete_notes` is
-- set at INSERT, which the policy below already allows. An athlete-side UPDATE would
-- have to be scoped to `athlete_id = auth.uid()`, and RLS unions policies: adding one
-- would hand the athlete `status` as well, letting them accept their own request past
-- the coach and reassign `coach_id` to a different coach. Two commands are not worth
-- that; edits to an existing request are service-role writes.
drop policy if exists "coaches can update own requests" on public.coach_session_requests;

create policy "coaches can update own requests"
  on public.coach_session_requests
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.coaches c
      where c.id = coach_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "coaches can read assigned requests" on public.coach_session_requests;

create policy "coaches can read assigned requests"
  on public.coach_session_requests
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.coaches c
      where c.id = coach_id
        and c.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- coach_messages: the human conversation, polled every 10 seconds.
--
-- One row per message, addressed to a request rather than to a pair of users, so the
-- conversation has a single home and deleting the request takes the transcript with
-- it (`on delete cascade`) rather than orphaning it.
--
-- `sender_id` and `sender_role` are both stored, and they are not redundant: the id
-- is the authoritative "who", the role is the human-readable "as". The insert
-- policies below force them to agree, so the role can never claim someone else's
-- side -- a row always says either "this athlete, as the athlete" or "this coach,
-- as the coach". Deriving the role from the id at render time would make the chat's
-- bubbles an inference rather than a fact.
-- ---------------------------------------------------------------------------
create table if not exists public.coach_messages (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid references public.coach_session_requests (id) on delete cascade,
  sender_id   uuid references auth.users (id),
  sender_role text check (sender_role in ('athlete', 'coach')),
  content     text not null,
  created_at  timestamptz default now()
);

-- The polling query: every message in one request, oldest first. Without it each
-- poll is a filter on an unindexed column and a sort over the whole table, which
-- grows without bound as conversations accumulate.
create index if not exists idx_coach_messages_request_created
  on public.coach_messages (request_id, created_at);

-- No index on `sender_id`. It appears in no policy: both read paths qualify through
-- `coach_session_requests`, because membership of the conversation is what decides
-- visibility, and "who sent this" is not a read permission. An index there would be
-- maintained on every message to serve a query nothing issues.

-- ---------------------------------------------------------------------------
-- coach_messages RLS.
--
-- Read and write are separate concerns and each has two sides, so four policies.
-- RLS is permissive by union: two SELECT policies that each answer "is this
-- conversation mine?" means a row passes if *either* agrees, so each policy has to
-- be independently true only for its own side -- neither may be a broad "any
-- authenticated user can read".
--
-- Both read policies qualify through `coach_session_requests` and through nothing
-- else. An earlier draft also let an athlete read any message carrying their own
-- `sender_id`, which looks equivalent and is not: it grants read access to the
-- *contents* of a conversation in a request they do not own, on the reasoning that
-- they once spoke in it. Membership of a conversation is what `coach_session_requests`
-- records, so that is the only thing that decides it. "Is this your message" is not
-- a read permission -- it is how the transcript draws the bubbles.
--
-- `request_id` is nullable in the column definition (see the type above), and a null
-- request is never readable: `exists` over a null key is false. That is the safe
-- direction for an unattributable message, and it means the nullable column cannot
-- be used to smuggle a message past both policies.
-- ---------------------------------------------------------------------------
alter table public.coach_messages enable row level security;

drop policy if exists "athletes can read own messages" on public.coach_messages;

create policy "athletes can read own messages"
  on public.coach_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.coach_session_requests r
      where r.id = request_id
        and r.athlete_id = auth.uid()
    )
  );

drop policy if exists "coaches can read assigned messages" on public.coach_messages;

create policy "coaches can read assigned messages"
  on public.coach_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.coach_session_requests r
      join public.coaches c on c.id = r.coach_id
      where r.id = request_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "athletes can write own messages" on public.coach_messages;

create policy "athletes can write own messages"
  on public.coach_messages
  for insert
  to authenticated
  with check (
    sender_role = 'athlete'
    and sender_id = auth.uid()
    and exists (
      select 1
      from public.coach_session_requests r
      where r.id = request_id
        and r.athlete_id = auth.uid()
    )
  );

drop policy if exists "coaches can write assigned messages" on public.coach_messages;

create policy "coaches can write assigned messages"
  on public.coach_messages
  for insert
  to authenticated
  with check (
    sender_role = 'coach'
    and sender_id = auth.uid()
    and exists (
      select 1
      from public.coach_session_requests r
      join public.coaches c on c.id = r.coach_id
      where r.id = request_id
        and c.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- routines.source: who authored this routine.
--
-- The three values answer one question a screen needs to answer -- is this plan the
-- AI's, mine, or a coach's -- and the existing `routines_crud_own` (`for all` on
-- `auth.uid() = user_id`) already covers the new column. Adding a policy for one
-- column of an existing table could only widen access, so none is added.
--
-- `not null`, and the reason is the CHECK rather than the default. The constraint
-- already enumerates every author that exists -- user, human coach, AI -- so a null
-- is not a fourth author, it is the absence of the one fact the column exists to
-- record. `check (source in (...))` does not catch it either: `null in (...)` is null,
-- and a CHECK rejects only `false`, so a nullable column lets an authorless routine
-- through while still looking constrained.
--
-- An earlier draft made this nullable and told readers to `coalesce(source, 'user')`.
-- That pushed the responsibility for a value the database could refuse to store into
-- every future reader, and the only way a row could reach null is an `update ... set
-- source = null`, which is precisely the mistake `not null` exists to prevent.
--
-- `default 'user'` remains load-bearing: it classifies every routine written without an
-- explicit author, and on PostgreSQL 11+ it also backfills existing rows, so the column
-- can be added `not null` to a populated table in a single statement with no UPDATE.
--
-- A coach writing a routine *for* an athlete needs an insert policy. It cannot be
-- written before `coach_session_requests` exists, because the athletes whose routines
-- may be written are the ones a coach is assigned, and that relationship is what this
-- file's own `coach_session_requests` records. So the policy lands in the migration
-- that follows, once both sides exist.
-- ---------------------------------------------------------------------------
alter table public.routines
  add column if not exists source text not null default 'user'
    check (source in ('user', 'human_coach', 'ai'));

-- Not indexed. Every read of `source` is scoped to one athlete's routines by
-- `user_id`, which `idx_routines_user_id` already covers; a second index would hold
-- a copy of every routine row to answer a question about one row at a time.