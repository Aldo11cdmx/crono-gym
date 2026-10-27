-- Cronos — sesiones y mensajes de chat con el asistente IA (Cronos IA).
-- Cada atleta puede tener varias conversaciones independientes; borrar una
-- sesión arrastra sus mensajes mediante ON DELETE CASCADE.

create table public.chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_chat_sessions_user_id on public.chat_sessions (user_id);
create index idx_chat_sessions_user_updated
  on public.chat_sessions (user_id, updated_at desc);

create table public.chat_messages (
  id        uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  role      text not null check (role in ('user', 'assistant', 'error')),
  content   text not null,
  created_at timestamptz not null default now()
);

create index idx_chat_messages_session_id on public.chat_messages (session_id);
create index idx_chat_messages_session_created
  on public.chat_messages (session_id, created_at asc);

-- Row-Level Security: cada atleta solo lee/escribe sus propias sesiones y mensajes.

alter table public.chat_sessions enable row level security;

create policy "chat_sessions_crud_own"
  on public.chat_sessions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.chat_messages enable row level security;

create policy "chat_messages_crud_own"
  on public.chat_messages
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
