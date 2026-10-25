-- CRONOS GYM - FASE B.2: finalize_session hardened definitivo y corregido
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
    v_log_user uuid;
    v_set jsonb;
    v_ex_id text;
    v_set_num integer;
    v_weight numeric;
    v_reps integer;
    v_rpe numeric;
    v_is_warmup boolean;
    v_notes text;
  begin
    if v_uid is null then
      raise exception 'not_authenticated';
    end if;
    if p_user_id is null or v_uid <> p_user_id then
      raise exception 'not_owner';
    end if;
    if p_log_id is null then
      raise exception 'invalid_log_id';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(p_log_id::text, 0));

    if p_routine_id is not null then
      if not exists (select 1 from public.routines where id = p_routine_id and user_id = v_uid) then
        raise exception 'routine_not_authorized';
      end if;
    end if;

    if p_sets is null or jsonb_typeof(p_sets) <> 'array' then
      raise exception 'invalid_sets_payload';
    end if;

    if jsonb_array_length(p_sets) > 0 then
      for v_set in select * from jsonb_array_elements(p_sets)
      loop
        if jsonb_typeof(v_set) <> 'object' then
          raise exception 'invalid_set_object';
        end if;
        v_ex_id := (v_set->>'exercise_id');
        if v_ex_id is null or length(trim(v_ex_id)) = 0 then
          raise exception 'invalid_exercise_id';
        end if;
        v_ex_id := trim(v_ex_id);
        if not exists (select 1 from public.exercises where id = v_ex_id) then
          raise exception 'exercise_not_found';
        end if;

        if v_set ? 'set_number' then
          if (v_set->>'set_number') is null or trim(v_set->>'set_number') = '' then
            raise exception 'invalid_set_number';
          end if;
          begin
            v_set_num := trim(v_set->>'set_number')::integer;
          exception when others then
            raise exception 'invalid_set_number';
          end;
          if v_set_num < 1 then
            raise exception 'invalid_set_number';
          end if;
        else
          raise exception 'invalid_set_number';
        end if;

        if v_set ? 'weight' and (v_set->>'weight') is not null and trim(v_set->>'weight') <> '' then
          begin
            v_weight := trim(v_set->>'weight')::numeric;
          exception when others then
            raise exception 'invalid_weight';
          end;
          if v_weight < 0 then
            raise exception 'invalid_weight';
          end if;
        else
          v_weight := null;
        end if;

        if v_set ? 'reps' and (v_set->>'reps') is not null and trim(v_set->>'reps') <> '' then
          begin
            v_reps := trim(v_set->>'reps')::integer;
          exception when others then
            raise exception 'invalid_reps';
          end;
          if v_reps < 0 then
            raise exception 'invalid_reps';
          end if;
        else
          v_reps := null;
        end if;

        if v_set ? 'rpe' and (v_set->>'rpe') is not null and trim(v_set->>'rpe') <> '' then
          begin
            v_rpe := trim(v_set->>'rpe')::numeric;
          exception when others then
            raise exception 'invalid_rpe';
          end;
          if v_rpe < 0 or v_rpe > 10 then
            raise exception 'invalid_rpe';
          end if;
        else
          v_rpe := null;
        end if;

        if v_set ? 'is_warmup' and (v_set->>'is_warmup') is not null and trim(v_set->>'is_warmup') <> '' then
          begin
            v_is_warmup := (v_set->>'is_warmup')::boolean;
          exception when others then
            raise exception 'invalid_is_warmup';
          end;
        else
          v_is_warmup := false;
        end if;

        v_notes := v_set->>'notes';
      end loop;
    end if;

    insert into public.workout_logs (id, user_id, routine_id, started_at, completed_at, journal_notes)
    values (p_log_id, v_uid, p_routine_id, p_started_at, p_ended_at, p_notes)
    on conflict (id) do update set
      routine_id   = excluded.routine_id,
      started_at   = excluded.started_at,
      completed_at = excluded.completed_at,
      journal_notes= excluded.journal_notes
    where public.workout_logs.user_id = v_uid
    returning user_id into v_log_user;

    if v_log_user is null or v_log_user <> v_uid then
      raise exception 'not_owner';
    end if;

    delete from public.completed_sets where log_id = p_log_id;

    if jsonb_array_length(p_sets) > 0 then
      for v_set in select * from jsonb_array_elements(p_sets)
      loop
        v_ex_id := trim((v_set->>'exercise_id'));
        v_set_num := trim(v_set->>'set_number')::integer;
        v_weight := case when v_set ? 'weight' and (v_set->>'weight') is not null and trim(v_set->>'weight') <> '' then trim(v_set->>'weight')::numeric else null end;
        v_reps := case when v_set ? 'reps' and (v_set->>'reps') is not null and trim(v_set->>'reps') <> '' then trim(v_set->>'reps')::integer else null end;
        v_rpe := case when v_set ? 'rpe' and (v_set->>'rpe') is not null and trim(v_set->>'rpe') <> '' then trim(v_set->>'rpe')::numeric else null end;
        v_is_warmup := case when v_set ? 'is_warmup' and (v_set->>'is_warmup') is not null and trim(v_set->>'is_warmup') <> '' then (v_set->>'is_warmup')::boolean else false end;
        v_notes := v_set->>'notes';

        insert into public.completed_sets (
          log_id, exercise_id, set_number, weight, reps, rpe, is_warmup, notes
        )
        values (
          p_log_id, v_ex_id, v_set_num, v_weight, v_reps, v_rpe, v_is_warmup, v_notes
        );
      end loop;
    end if;

    return p_log_id;
  end;
  $$;

revoke all on function public.finalize_session(uuid,uuid,uuid,text,timestamptz,timestamptz,integer,text,jsonb) from public, anon;
grant execute on function public.finalize_session(uuid,uuid,uuid,text,timestamptz,timestamptz,integer,text,jsonb) to authenticated;
