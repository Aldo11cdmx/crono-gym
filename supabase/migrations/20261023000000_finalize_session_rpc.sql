-- finalize_session: atomic session finalization
do $$ begin
  create or replace function public.finalize_session(
    p_log_id uuid,
    p_user_id uuid,
    p_routine_id uuid,
    p_name text,
    p_started_at timestamptz,
    p_ended_at timestamptz,
    p_duration_seconds integer,
    p_notes text,
    p_sets jsonb
  ) returns uuid
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    v_uid uuid := auth.uid();
    v_set jsonb;
  begin
    if v_uid is null then
      raise exception 'not_authenticated';
    end if;
    if v_uid <> p_user_id then
      raise exception 'not_owner';
    end if;

    -- upsert log
    insert into public.workout_logs (id, user_id, routine_id, started_at, completed_at, journal_notes)
    values (p_log_id, p_user_id, p_routine_id, p_started_at, p_ended_at, p_notes)
    on conflict (id) do update set
      routine_id = excluded.routine_id,
      started_at = excluded.started_at,
      completed_at = excluded.completed_at,
      journal_notes = excluded.journal_notes;

    -- replace sets
    delete from public.completed_sets where log_id = p_log_id;

    if p_sets is not null and jsonb_array_length(p_sets) > 0 then
      for v_set in select * from jsonb_array_elements(p_sets)
      loop
        insert into public.completed_sets (
          log_id,
          exercise_id,
          set_number,
          weight,
          reps,
          rpe,
          is_warmup,
          notes
        )
        values (
          p_log_id,
          (v_set->>'exercise_id')::uuid,
          (v_set->>'set_number')::integer,
          nullif(v_set->>'weight','')::numeric,
          nullif(v_set->>'reps','')::integer,
          nullif(v_set->>'rpe','')::numeric,
          coalesce((v_set->>'is_warmup')::boolean, false),
          v_set->>'notes'
        );
      end loop;
    end if;

    return p_log_id;
  end;
  $$;
exception when duplicate_function then null;
end $$;

revoke all on function public.finalize_session(uuid,uuid,uuid,text,timestamptz,timestamptz,integer,text,jsonb) from public, anon;
grant execute on function public.finalize_session(uuid,uuid,uuid,text,timestamptz,timestamptz,integer,text,jsonb) to authenticated;
