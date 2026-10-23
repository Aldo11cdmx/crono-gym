-- Cronos — Fase 6 · AI assistant support tables
-- Aplicar: supabase db push
--
-- Neither table stores message content. `coach_usage` records token counts and the
-- model that produced them so cost can be watched; what the assistant actually said
-- lives in the athlete's own IndexedDB and is never persisted server-side.

-- ---------------------------------------------------------------------------
-- coach_rate_limits: one row per user per hour-window.
--
-- The window is stored truncated to the hour by the function
-- (`date_trunc('hour', now())`), so the primary key does the counting: a repeat
-- within the same hour collides and increments, and a new hour creates a row.
-- Window rows are never deleted here -- the function prunes its own on read, since
-- an unbounded table of hourly rows for every user is not something to leave to a
-- cron nobody has scheduled.
-- ---------------------------------------------------------------------------
create table if not exists public.coach_rate_limits (
  user_id       uuid references auth.users (id) on delete cascade,
  window_start  timestamptz not null,
  request_count integer not null default 0,
  primary key (user_id, window_start)
);

alter table public.coach_rate_limits enable row level security;

-- Read-only for the athlete: the count is their own usage, and there is no insert,
-- update or delete policy because only the function's service role may write.
-- Without a policy for a command, RLS denies it -- so this is not an oversight to
-- be "fixed" by adding one.
create policy "users can read own limits"
  on public.coach_rate_limits
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- coach_usage: token accounting for cost monitoring.
--
-- Deliberately no `message` or `response` column. A log of what the assistant told
-- every athlete is a copy of the training record held somewhere it cannot be
-- deleted from, and it is not needed to answer "what is this costing".
-- ---------------------------------------------------------------------------
create table if not exists public.coach_usage (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete cascade,
  tokens_used integer,
  model       text,
  created_at  timestamptz default now()
);

alter table public.coach_usage enable row level security;

create policy "users can read own usage"
  on public.coach_usage
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Cost is asked per user per day; without this the query is a scan.
create index idx_coach_usage_user_created on public.coach_usage (user_id, created_at desc);