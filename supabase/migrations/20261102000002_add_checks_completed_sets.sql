ALTER TABLE public.completed_sets
  ADD CONSTRAINT check_reps_range
    CHECK (reps >= 1 AND reps <= 200),
  ADD CONSTRAINT check_weight_range
    CHECK (weight >= 0 AND weight <= 1000),
  ADD CONSTRAINT check_rpe_range
    CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
  ADD CONSTRAINT check_notes_length
    CHECK (notes IS NULL OR length(notes) <= 280);
