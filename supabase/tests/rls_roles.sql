-- supabase/tests/rls_roles.sql
-- Run inside BEGIN ... ROLLBACK. Creates test users in-transaction.
begin;

-- helper: create two users
do $$
begin
  perform 1;
end $$;

-- We rely on auth.users existing; create test users via SQL
insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, role, aud)
values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', crypt('x', gen_salt('bf')), now(), now(), now(), 'authenticated', 'authenticated')
on conflict (id) do nothing;

-- grant developer to user A
insert into public.user_roles (user_id, role) values ('11111111-1111-1111-1111-111111111111','developer');

-- A sees own role
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
-- has_role developer for A => true
select public.has_role('developer'::public.app_role) as a_is_dev;  -- expect true

-- B cannot see A's rows
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select count(*) as b_sees_a_roles from public.user_roles where user_id='11111111-1111-1111-1111-111111111111'; -- expect 0

-- B cannot update/delete A's rows (affects 0)
update public.user_roles set role='admin' where user_id='11111111-1111-1111-1111-111111111111' and role='developer';
delete from public.user_roles where user_id='11111111-1111-1111-1111-111111111111';

-- anon denied
set local role anon;
select set_config('request.jwt.claims', '{}', true);
select count(*) as anon_roles from public.user_roles; -- expect 0 / permission denied on insert handled by revoke

rollback;