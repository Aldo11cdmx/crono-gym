-- Consolidated Coach/Admin contracts. All statements are additive and rerunnable.

alter table public.announcements
  add column if not exists body text,
  add column if not exists category text,
  add column if not exists active boolean not null default true,
  add column if not exists pinned boolean not null default false;

update public.announcements
set body = coalesce(body, message),
    category = coalesce(category, case when kind = 'event' then 'event' else 'info' end)
where body is null or category is null;

alter table public.routines
  add column if not exists assigned_by uuid references auth.users(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists assignment_source text not null default 'self',
  add column if not exists coach_notes text;

do $$
begin
  alter table public.routines
    add constraint routines_assignment_source_check
    check (assignment_source in ('self', 'coach', 'template'));
exception when duplicate_object then null;
end $$;

create or replace function public.can_manage_athlete(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
        and role in ('coach', 'admin', 'developer')
    )
    and target_user_id is not null;
$$;

revoke all on function public.can_manage_athlete(uuid) from public;
grant execute on function public.can_manage_athlete(uuid) to authenticated;

create or replace function public.search_coach_athletes(search_text text)
returns table (
  user_id uuid,
  display_name text,
  email_masked_or_contact text,
  avatar_url text,
  goal text,
  experience_level text,
  weight_kg numeric,
  height_cm numeric,
  current_phase text,
  active_routines bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id,
         p.display_name,
         regexp_replace(coalesce(u.email, ''), '^(.{2}).*(@.*)$', '\1***\2'),
         p.avatar_url,
         p.goal,
         p.experience_level,
         p.weight_kg,
         p.height_cm,
         null::text,
         (select count(*) from public.routines r where r.user_id = p.user_id)::bigint
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where public.can_manage_athlete(p.user_id)
    and (
      coalesce(search_text, '') = ''
      or p.display_name ilike '%' || search_text || '%'
      or coalesce(u.raw_user_meta_data->>'username', '') ilike '%' || search_text || '%'
      or u.email ilike '%' || search_text || '%'
    )
  order by p.display_name nulls last
  limit 50;
$$;

revoke all on function public.search_coach_athletes(text) from public;
grant execute on function public.search_coach_athletes(text) to authenticated;

create or replace function public.assign_coach_routine(
  target_user_id uuid,
  routine_title text,
  routine_description text default null,
  routine_exercises jsonb default '[]'::jsonb,
  existing_routine_id uuid default null,
  notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  routine_id uuid := existing_routine_id;
  item jsonb;
  position integer := 0;
begin
  if actor is null or not public.can_manage_athlete(target_user_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if routine_id is null then
    insert into public.routines (
      user_id, title, description, source, authored_by_coach,
      assigned_by, assigned_at, assignment_source, coach_notes
    )
    values (
      target_user_id, routine_title, routine_description, 'human_coach', actor,
      actor, now(), 'coach', notes
    )
    returning id into routine_id;
  else
    update public.routines
    set user_id = target_user_id,
        title = routine_title,
        description = routine_description,
        source = 'human_coach',
        authored_by_coach = actor,
        assigned_by = actor,
        assigned_at = now(),
        assignment_source = 'coach',
        coach_notes = notes
    where id = routine_id;
  end if;

  delete from public.routine_exercises where routine_exercises.routine_id = routine_id;
  for item in select value from jsonb_array_elements(coalesce(routine_exercises, '[]'::jsonb))
  loop
    insert into public.routine_exercises (
      routine_id, exercise_id, target_sets, rest_seconds, order_index,
      day_index, day_label, target_reps_min, target_reps_max
    )
    values (
      routine_id,
      (item->>'exercise_id')::uuid,
      greatest(coalesce((item->>'target_sets')::integer, 1), 1),
      greatest(coalesce((item->>'rest_seconds')::integer, 90), 0),
      position,
      coalesce((item->>'day_index')::integer, 0),
      coalesce(item->>'day_label', ''),
      nullif((item->>'target_reps_min')::integer, 0),
      nullif((item->>'target_reps_max')::integer, 0)
    );
    position := position + 1;
  end loop;
  return routine_id;
end;
$$;

revoke all on function public.assign_coach_routine(uuid, text, text, jsonb, uuid, text) from public;
grant execute on function public.assign_coach_routine(uuid, text, text, jsonb, uuid, text) to authenticated;

create table if not exists public.routine_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  level text not null default 'beginner' check (level in ('beginner', 'intermediate', 'advanced')),
  goal text,
  category text,
  is_published boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.routine_template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.routine_templates(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  target_sets integer not null default 3,
  rest_seconds integer not null default 90,
  order_index integer not null default 0,
  day_index integer not null default 0,
  day_label text not null default '',
  target_reps_min integer,
  target_reps_max integer
);

alter table public.routine_templates enable row level security;
alter table public.routine_template_exercises enable row level security;
drop policy if exists routine_templates_published_read on public.routine_templates;
create policy routine_templates_published_read on public.routine_templates
  for select to authenticated using (is_published or created_by = auth.uid());
drop policy if exists routine_templates_manage on public.routine_templates;
create policy routine_templates_manage on public.routine_templates
  for all to authenticated
  using (public.has_role('coach'::public.app_role) or public.has_role('admin'::public.app_role) or public.has_role('developer'::public.app_role))
  with check (created_by = auth.uid() and (public.has_role('coach'::public.app_role) or public.has_role('admin'::public.app_role) or public.has_role('developer'::public.app_role)));
drop policy if exists routine_template_exercises_read on public.routine_template_exercises;
create policy routine_template_exercises_read on public.routine_template_exercises
  for select to authenticated using (
    exists (select 1 from public.routine_templates t where t.id = template_id and (t.is_published or t.created_by = auth.uid()))
  );

create or replace function public.clone_routine_template(p_template_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  source_row public.routine_templates%rowtype;
  new_id uuid;
begin
  select * into source_row
  from public.routine_templates
  where id = p_template_id and (is_published or created_by = actor);
  if source_row.id is null then
    raise exception 'template not found' using errcode = '22023';
  end if;
  insert into public.routines (user_id, title, description, source, assignment_source)
  values (actor, source_row.title, source_row.description, 'user', 'template')
  returning id into new_id;
  insert into public.routine_exercises (
    routine_id, exercise_id, target_sets, rest_seconds, order_index,
    day_index, day_label, target_reps_min, target_reps_max
  )
  select new_id, exercise_id, target_sets, rest_seconds, order_index,
         day_index, day_label, target_reps_min, target_reps_max
  from public.routine_template_exercises
  where template_id = p_template_id;
  return new_id;
end;
$$;

revoke all on function public.clone_routine_template(uuid) from public;
grant execute on function public.clone_routine_template(uuid) to authenticated;

create or replace function public.admin_list_users_with_roles()
returns table (
  user_id uuid,
  display_name text,
  email text,
  avatar_url text,
  roles text[],
  granted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.display_name, u.email, p.avatar_url,
         coalesce(array_agg(ur.role::text) filter (where ur.role is not null), '{}'),
         max(ur.granted_at)
  from public.profiles p
  join auth.users u on u.id = p.user_id
  left join public.user_roles ur on ur.user_id = p.user_id
  where public.has_role('admin'::public.app_role) or public.has_role('developer'::public.app_role)
  group by p.user_id, p.display_name, u.email, p.avatar_url
  order by p.display_name nulls last;
$$;

create or replace function public.admin_revoke_role(target_user_id uuid, target_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.has_role('admin'::public.app_role) or public.has_role('developer'::public.app_role)) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if target_user_id = auth.uid() and target_role in ('admin', 'developer') then
    raise exception 'cannot revoke own elevated role' using errcode = '42501';
  end if;
  delete from public.user_roles
  where user_id = target_user_id and role::text = target_role;
end;
$$;

revoke all on function public.admin_list_users_with_roles() from public;
grant execute on function public.admin_list_users_with_roles() to authenticated;
revoke all on function public.admin_revoke_role(uuid, text) from public;
grant execute on function public.admin_revoke_role(uuid, text) to authenticated;
