-- Habilitar y aplicar RLS a la tabla de rutinas
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS routines_select_own ON public.routines;
DROP POLICY IF EXISTS routines_insert_own ON public.routines;
DROP POLICY IF EXISTS routines_update_own ON public.routines;
DROP POLICY IF EXISTS routines_delete_own ON public.routines;

CREATE POLICY routines_select_own ON public.routines
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY routines_insert_own ON public.routines
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY routines_update_own ON public.routines
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY routines_delete_own ON public.routines
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Habilitar y aplicar RLS a completed_sets validando al dueño a través del workout_log
ALTER TABLE public.completed_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS completed_sets_select_own ON public.completed_sets;
DROP POLICY IF EXISTS completed_sets_insert_own ON public.completed_sets;
DROP POLICY IF EXISTS completed_sets_update_own ON public.completed_sets;
DROP POLICY IF EXISTS completed_sets_delete_own ON public.completed_sets;

CREATE POLICY completed_sets_select_own ON public.completed_sets
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_logs wl WHERE wl.id = completed_sets.log_id AND wl.user_id = auth.uid()));

CREATE POLICY completed_sets_insert_own ON public.completed_sets
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_logs wl WHERE wl.id = completed_sets.log_id AND wl.user_id = auth.uid()));

CREATE POLICY completed_sets_update_own ON public.completed_sets
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_logs wl WHERE wl.id = completed_sets.log_id AND wl.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_logs wl WHERE wl.id = completed_sets.log_id AND wl.user_id = auth.uid()));

CREATE POLICY completed_sets_delete_own ON public.completed_sets
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_logs wl WHERE wl.id = completed_sets.log_id AND wl.user_id = auth.uid()));
