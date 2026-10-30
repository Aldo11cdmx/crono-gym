revoke all on public.coaches from anon;

revoke select, update on public.coaches from authenticated;
revoke insert, delete, truncate, references, trigger on public.coaches from authenticated;

grant select (id, user_id, display_name, is_active, is_available)
  on public.coaches to authenticated;

grant update (is_available) on public.coaches to authenticated;
