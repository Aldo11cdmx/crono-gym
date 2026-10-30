


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."announcement_kind" AS ENUM (
    'promo',
    'notice',
    'event'
);


ALTER TYPE "public"."announcement_kind" OWNER TO "postgres";


CREATE TYPE "public"."app_role" AS ENUM (
    'athlete',
    'coach',
    'admin',
    'developer'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_minor_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_age integer;
begin
  if new.birth_date is null then
    return new;
  end if;

  v_age := date_part('year', age(current_date, new.birth_date))::integer;

  if v_age < 18 and new.guardian_consent_at is null then
    raise exception
      'Menores de 18 años: se requiere consentimiento de un adulto responsable.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_minor_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select exists (select 1 from public.user_roles where user_id = auth.uid() and role = _role) $$;


ALTER FUNCTION "public"."has_role"("_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_coach"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select exists (select 1 from public.coaches where user_id = auth.uid() and is_active = true) $$;


ALTER FUNCTION "public"."is_coach"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_roles"() RETURNS SETOF "public"."app_role"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select role from public.user_roles where user_id = auth.uid()
  union
  select 'coach'::public.app_role where public.is_coach()
$$;


ALTER FUNCTION "public"."my_roles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."role_audit_log_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$ begin raise exception 'role_audit_log is append-only'; end $$;


ALTER FUNCTION "public"."role_audit_log_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_roles_audit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op in ('DELETE','UPDATE') then
    insert into public.role_audit_log (user_id, role, action, actor)
    values (old.user_id, old.role, 'revoke', auth.uid());
  end if;
  if tg_op in ('INSERT','UPDATE') then
    insert into public.role_audit_log (user_id, role, action, actor)
    values (new.user_id, new.role, 'grant', auth.uid());
  end if;
  return coalesce(new, old);
end
$$;


ALTER FUNCTION "public"."user_roles_audit"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."announcements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "kind" "public"."announcement_kind" DEFAULT 'notice'::"public"."announcement_kind" NOT NULL,
    "banner_path" "text",
    "starts_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "announcements_dates_check" CHECK (("expires_at" > "starts_at")),
    CONSTRAINT "announcements_message_check" CHECK (("char_length"("message") <= 500)),
    CONSTRAINT "announcements_title_check" CHECK (("char_length"("title") <= 80))
);


ALTER TABLE "public"."announcements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."body_measurements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "measured_on" "date" DEFAULT CURRENT_DATE NOT NULL,
    "chest_cm" numeric(5,1),
    "waist_cm" numeric(5,1),
    "hips_cm" numeric(5,1),
    "arm_cm" numeric(5,1),
    "thigh_cm" numeric(5,1),
    "calf_cm" numeric(5,1),
    "shoulder_cm" numeric(5,1),
    "body_fat_pct" numeric(4,1),
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "body_measurements_arm_cm_check" CHECK ((("arm_cm" >= (10)::numeric) AND ("arm_cm" <= (100)::numeric))),
    CONSTRAINT "body_measurements_body_fat_pct_check" CHECK ((("body_fat_pct" >= (2)::numeric) AND ("body_fat_pct" <= (70)::numeric))),
    CONSTRAINT "body_measurements_calf_cm_check" CHECK ((("calf_cm" >= (10)::numeric) AND ("calf_cm" <= (100)::numeric))),
    CONSTRAINT "body_measurements_chest_cm_check" CHECK ((("chest_cm" >= (20)::numeric) AND ("chest_cm" <= (250)::numeric))),
    CONSTRAINT "body_measurements_hips_cm_check" CHECK ((("hips_cm" >= (20)::numeric) AND ("hips_cm" <= (250)::numeric))),
    CONSTRAINT "body_measurements_shoulder_cm_check" CHECK ((("shoulder_cm" >= (20)::numeric) AND ("shoulder_cm" <= (200)::numeric))),
    CONSTRAINT "body_measurements_thigh_cm_check" CHECK ((("thigh_cm" >= (20)::numeric) AND ("thigh_cm" <= (150)::numeric))),
    CONSTRAINT "body_measurements_waist_cm_check" CHECK ((("waist_cm" >= (20)::numeric) AND ("waist_cm" <= (250)::numeric)))
);


ALTER TABLE "public"."body_measurements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bodyweight_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "measured_on" "date" DEFAULT CURRENT_DATE NOT NULL,
    "weight_kg" numeric(5,2) NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bodyweight_entries_weight_kg_check" CHECK ((("weight_kg" >= (25)::numeric) AND ("weight_kg" <= (400)::numeric)))
);


ALTER TABLE "public"."bodyweight_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."bodyweight_entries" IS 'Daily weigh-ins. Unique per user+date so the upsert path stays a single row.';



CREATE TABLE IF NOT EXISTS "public"."coach_login_attempts" (
    "coach_id" "uuid",
    "attempted_at" timestamp with time zone DEFAULT "now"(),
    "succeeded" boolean DEFAULT false
);


ALTER TABLE "public"."coach_login_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid",
    "sender_id" "uuid",
    "sender_role" "text",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "coach_messages_sender_role_check" CHECK (("sender_role" = ANY (ARRAY['athlete'::"text", 'coach'::"text"])))
);


ALTER TABLE "public"."coach_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_rate_limits" (
    "user_id" "uuid" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "request_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."coach_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_session_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "athlete_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "coach_session_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'declined'::"text", 'closed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."coach_session_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "tokens_used" integer,
    "model" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."coach_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coaches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "pin_hash" "text" NOT NULL,
    "is_provisional" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "specialties" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_available" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."coaches" OWNER TO "postgres";


COMMENT ON COLUMN "public"."coaches"."is_available" IS 'Whether this coach is currently accepting new session requests. Independent of is_active, which is membership of the roster rather than availability today.';



CREATE TABLE IF NOT EXISTS "public"."completed_sets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "log_id" "uuid" NOT NULL,
    "exercise_id" "text" NOT NULL,
    "set_number" integer NOT NULL,
    "weight" numeric,
    "reps" integer,
    "rpe" numeric,
    "is_warmup" boolean DEFAULT false NOT NULL,
    "notes" "text",
    CONSTRAINT "completed_sets_set_number_check" CHECK (("set_number" > 0))
);


ALTER TABLE "public"."completed_sets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exercises" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "body_part" "text" NOT NULL,
    "target" "text" NOT NULL,
    "equipment" "text" NOT NULL,
    "gif_url" "text" NOT NULL,
    "instructions" "text"[] DEFAULT '{}'::"text"[] NOT NULL
);


ALTER TABLE "public"."exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "display_name" "text",
    "birth_date" "date",
    "sex" "text",
    "height_cm" numeric(5,1),
    "weight_kg" numeric(5,2),
    "unit_system" "text" DEFAULT 'metric'::"text" NOT NULL,
    "experience_level" "text" DEFAULT 'beginner'::"text" NOT NULL,
    "activity_level" "text" DEFAULT 'moderate'::"text" NOT NULL,
    "goal" "text" DEFAULT 'maintain'::"text" NOT NULL,
    "guardian_consent_at" timestamp with time zone,
    "onboarding_completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_premium" boolean DEFAULT false NOT NULL,
    "premium_since" timestamp with time zone,
    "premium_expires_at" timestamp with time zone,
    "is_vip" boolean DEFAULT false NOT NULL,
    "vip_status" "text",
    "vip_activated_at" timestamp with time zone,
    CONSTRAINT "profiles_activity_level_check" CHECK (("activity_level" = ANY (ARRAY['sedentary'::"text", 'light'::"text", 'moderate'::"text", 'active'::"text", 'athlete'::"text"]))),
    CONSTRAINT "profiles_birth_date_check" CHECK (("birth_date" <= CURRENT_DATE)),
    CONSTRAINT "profiles_experience_level_check" CHECK (("experience_level" = ANY (ARRAY['beginner'::"text", 'intermediate'::"text", 'advanced'::"text"]))),
    CONSTRAINT "profiles_goal_check" CHECK (("goal" = ANY (ARRAY['lose_weight'::"text", 'maintain'::"text", 'gain_muscle'::"text", 'strength'::"text", 'endurance'::"text"]))),
    CONSTRAINT "profiles_height_cm_check" CHECK ((("height_cm" >= (100)::numeric) AND ("height_cm" <= (250)::numeric))),
    CONSTRAINT "profiles_premium_window_check" CHECK (((("premium_since" IS NULL) OR ("premium_expires_at" IS NULL) OR ("premium_expires_at" > "premium_since")) AND (("is_premium" = false) OR ("premium_since" IS NOT NULL)))),
    CONSTRAINT "profiles_sex_check" CHECK (("sex" = ANY (ARRAY['male'::"text", 'female'::"text", 'other'::"text"]))),
    CONSTRAINT "profiles_unit_system_check" CHECK (("unit_system" = ANY (ARRAY['metric'::"text", 'imperial'::"text"]))),
    CONSTRAINT "profiles_weight_kg_check" CHECK ((("weight_kg" >= (25)::numeric) AND ("weight_kg" <= (400)::numeric)))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'Per-PLDCP legal basis, body metrics and training preferences. Metric units are canonical; unit_system is display-only.';



CREATE TABLE IF NOT EXISTS "public"."role_audit_log" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "role" "public"."app_role" NOT NULL,
    "action" "text" NOT NULL,
    "actor" "uuid",
    "at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."role_audit_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."role_audit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."role_audit_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."role_audit_log_id_seq" OWNED BY "public"."role_audit_log"."id";



CREATE TABLE IF NOT EXISTS "public"."routine_exercises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "routine_id" "uuid" NOT NULL,
    "exercise_id" "text" NOT NULL,
    "target_sets" integer NOT NULL,
    "rest_seconds" integer DEFAULT 0 NOT NULL,
    "order_index" integer NOT NULL,
    "day_index" integer DEFAULT 0 NOT NULL,
    "day_label" "text" DEFAULT ''::"text" NOT NULL,
    "target_reps_min" integer,
    "target_reps_max" integer,
    CONSTRAINT "routine_exercises_day_index_check" CHECK (("day_index" >= 0)),
    CONSTRAINT "routine_exercises_reps_max_check" CHECK ((("target_reps_max" IS NULL) OR ("target_reps_max" > 0))),
    CONSTRAINT "routine_exercises_reps_min_check" CHECK ((("target_reps_min" IS NULL) OR ("target_reps_min" > 0))),
    CONSTRAINT "routine_exercises_rest_seconds_check" CHECK (("rest_seconds" >= 0)),
    CONSTRAINT "routine_exercises_target_sets_check" CHECK (("target_sets" > 0))
);


ALTER TABLE "public"."routine_exercises" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."routines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'user'::"text" NOT NULL,
    "authored_by_coach" "uuid",
    CONSTRAINT "routines_source_check" CHECK (("source" = ANY (ARRAY['user'::"text", 'human_coach'::"text", 'ai'::"text"])))
);


ALTER TABLE "public"."routines" OWNER TO "postgres";


COMMENT ON COLUMN "public"."routines"."authored_by_coach" IS 'The coach who wrote this routine, when a human coach did. Null for routines the athlete or the AI created. Lets the athlete see who prescribed it, and lets a coach remove exactly the rows they authored.';



CREATE TABLE IF NOT EXISTS "public"."session_checkins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workout_log_id" "uuid",
    "checked_on" "date" DEFAULT CURRENT_DATE NOT NULL,
    "energy" smallint,
    "motivation" smallint,
    "soreness" smallint,
    "stress" smallint,
    "sleep_hours" numeric(3,1),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "session_checkins_energy_check" CHECK ((("energy" >= 1) AND ("energy" <= 5))),
    CONSTRAINT "session_checkins_motivation_check" CHECK ((("motivation" >= 1) AND ("motivation" <= 5))),
    CONSTRAINT "session_checkins_sleep_hours_check" CHECK ((("sleep_hours" >= (0)::numeric) AND ("sleep_hours" <= (24)::numeric))),
    CONSTRAINT "session_checkins_soreness_check" CHECK ((("soreness" >= 1) AND ("soreness" <= 5))),
    CONSTRAINT "session_checkins_stress_check" CHECK ((("stress" >= 1) AND ("stress" <= 5)))
);


ALTER TABLE "public"."session_checkins" OWNER TO "postgres";


COMMENT ON COLUMN "public"."session_checkins"."workout_log_id" IS 'Optional link: check-ins are allowed on rest days.';



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "granted_by" "uuid",
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workout_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "routine_id" "uuid",
    "started_at" timestamp with time zone NOT NULL,
    "completed_at" timestamp with time zone,
    "journal_notes" "text"
);


ALTER TABLE "public"."workout_logs" OWNER TO "postgres";


ALTER TABLE ONLY "public"."role_audit_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."role_audit_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."body_measurements"
    ADD CONSTRAINT "body_measurements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."body_measurements"
    ADD CONSTRAINT "body_measurements_user_id_measured_on_key" UNIQUE ("user_id", "measured_on");



ALTER TABLE ONLY "public"."bodyweight_entries"
    ADD CONSTRAINT "bodyweight_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bodyweight_entries"
    ADD CONSTRAINT "bodyweight_entries_user_id_measured_on_key" UNIQUE ("user_id", "measured_on");



ALTER TABLE ONLY "public"."coach_messages"
    ADD CONSTRAINT "coach_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_rate_limits"
    ADD CONSTRAINT "coach_rate_limits_pkey" PRIMARY KEY ("user_id", "window_start");



ALTER TABLE ONLY "public"."coach_session_requests"
    ADD CONSTRAINT "coach_session_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_usage"
    ADD CONSTRAINT "coach_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coaches"
    ADD CONSTRAINT "coaches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coaches"
    ADD CONSTRAINT "coaches_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."completed_sets"
    ADD CONSTRAINT "completed_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."role_audit_log"
    ADD CONSTRAINT "role_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."routine_exercises"
    ADD CONSTRAINT "routine_exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."routines"
    ADD CONSTRAINT "routines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_checkins"
    ADD CONSTRAINT "session_checkins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_checkins"
    ADD CONSTRAINT "session_checkins_user_id_checked_on_key" UNIQUE ("user_id", "checked_on");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role");



ALTER TABLE ONLY "public"."workout_logs"
    ADD CONSTRAINT "workout_logs_pkey" PRIMARY KEY ("id");



CREATE INDEX "body_measurements_user_date_idx" ON "public"."body_measurements" USING "btree" ("user_id", "measured_on" DESC);



CREATE INDEX "bodyweight_entries_user_date_idx" ON "public"."bodyweight_entries" USING "btree" ("user_id", "measured_on" DESC);



CREATE INDEX "completed_sets_exercise_id_idx" ON "public"."completed_sets" USING "btree" ("exercise_id");



CREATE INDEX "completed_sets_log_id_idx" ON "public"."completed_sets" USING "btree" ("log_id");



CREATE INDEX "idx_coach_login_attempts_coach_time" ON "public"."coach_login_attempts" USING "btree" ("coach_id", "attempted_at");



CREATE INDEX "idx_coach_messages_request_created" ON "public"."coach_messages" USING "btree" ("request_id", "created_at");



CREATE INDEX "idx_coach_requests_queue" ON "public"."coach_session_requests" USING "btree" ("coach_id", "created_at" DESC) WHERE ("status" = ANY (ARRAY['pending'::"text", 'active'::"text"]));



CREATE INDEX "idx_coach_session_requests_athlete" ON "public"."coach_session_requests" USING "btree" ("athlete_id", "created_at" DESC);



CREATE INDEX "idx_coach_session_requests_coach" ON "public"."coach_session_requests" USING "btree" ("coach_id", "created_at" DESC);



CREATE INDEX "idx_completed_sets_log_id" ON "public"."completed_sets" USING "btree" ("log_id");



CREATE INDEX "idx_exercises_body_part" ON "public"."exercises" USING "btree" ("body_part");



CREATE INDEX "idx_exercises_equipment" ON "public"."exercises" USING "btree" ("equipment");



CREATE INDEX "idx_exercises_target" ON "public"."exercises" USING "btree" ("target");



CREATE INDEX "idx_routine_exercises_routine_day" ON "public"."routine_exercises" USING "btree" ("routine_id", "day_index", "order_index");



CREATE INDEX "idx_routines_user_id" ON "public"."routines" USING "btree" ("user_id");



CREATE INDEX "idx_workout_logs_started_at" ON "public"."workout_logs" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_workout_logs_user_id" ON "public"."workout_logs" USING "btree" ("user_id");



CREATE INDEX "routine_exercises_exercise_id_idx" ON "public"."routine_exercises" USING "btree" ("exercise_id");



CREATE INDEX "routine_exercises_routine_id_idx" ON "public"."routine_exercises" USING "btree" ("routine_id");



CREATE INDEX "session_checkins_log_idx" ON "public"."session_checkins" USING "btree" ("workout_log_id") WHERE ("workout_log_id" IS NOT NULL);



CREATE INDEX "session_checkins_user_date_idx" ON "public"."session_checkins" USING "btree" ("user_id", "checked_on" DESC);



CREATE INDEX "workout_logs_routine_id_idx" ON "public"."workout_logs" USING "btree" ("routine_id") WHERE ("routine_id" IS NOT NULL);



CREATE INDEX "workout_logs_user_started_idx" ON "public"."workout_logs" USING "btree" ("user_id", "started_at" DESC);



CREATE OR REPLACE TRIGGER "profiles_minor_guard" BEFORE INSERT OR UPDATE OF "birth_date", "guardian_consent_at" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_minor_guard"();



CREATE OR REPLACE TRIGGER "profiles_touch_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "role_audit_log_no_truncate" BEFORE TRUNCATE ON "public"."role_audit_log" FOR EACH STATEMENT EXECUTE FUNCTION "public"."role_audit_log_guard"();



CREATE OR REPLACE TRIGGER "role_audit_log_no_update" BEFORE DELETE OR UPDATE ON "public"."role_audit_log" FOR EACH ROW EXECUTE FUNCTION "public"."role_audit_log_guard"();



CREATE OR REPLACE TRIGGER "user_roles_audit_trg" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."user_roles_audit"();



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."body_measurements"
    ADD CONSTRAINT "body_measurements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bodyweight_entries"
    ADD CONSTRAINT "bodyweight_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_login_attempts"
    ADD CONSTRAINT "coach_login_attempts_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_messages"
    ADD CONSTRAINT "coach_messages_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."coach_session_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_messages"
    ADD CONSTRAINT "coach_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."coach_rate_limits"
    ADD CONSTRAINT "coach_rate_limits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_session_requests"
    ADD CONSTRAINT "coach_session_requests_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_session_requests"
    ADD CONSTRAINT "coach_session_requests_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_usage"
    ADD CONSTRAINT "coach_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coaches"
    ADD CONSTRAINT "coaches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."completed_sets"
    ADD CONSTRAINT "completed_sets_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id");



ALTER TABLE ONLY "public"."completed_sets"
    ADD CONSTRAINT "completed_sets_log_id_fkey" FOREIGN KEY ("log_id") REFERENCES "public"."workout_logs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."routine_exercises"
    ADD CONSTRAINT "routine_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id");



ALTER TABLE ONLY "public"."routine_exercises"
    ADD CONSTRAINT "routine_exercises_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."routines"
    ADD CONSTRAINT "routines_authored_by_coach_fkey" FOREIGN KEY ("authored_by_coach") REFERENCES "public"."coaches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."routines"
    ADD CONSTRAINT "routines_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_checkins"
    ADD CONSTRAINT "session_checkins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_checkins"
    ADD CONSTRAINT "session_checkins_workout_log_id_fkey" FOREIGN KEY ("workout_log_id") REFERENCES "public"."workout_logs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workout_logs"
    ADD CONSTRAINT "workout_logs_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workout_logs"
    ADD CONSTRAINT "workout_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."announcements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "announcements_admin_write" ON "public"."announcements" TO "authenticated" USING ("public"."has_role"('admin'::"public"."app_role")) WITH CHECK (("public"."has_role"('admin'::"public"."app_role") AND ("created_by" = "auth"."uid"())));



CREATE POLICY "announcements_read_active" ON "public"."announcements" FOR SELECT TO "authenticated" USING ((("now"() >= "starts_at") AND ("now"() < "expires_at")));



CREATE POLICY "athletes can read active coaches" ON "public"."coaches" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "athletes can read own messages" ON "public"."coach_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."coach_session_requests" "r"
  WHERE (("r"."id" = "coach_messages"."request_id") AND ("r"."athlete_id" = "auth"."uid"())))));



CREATE POLICY "athletes can read own requests" ON "public"."coach_session_requests" FOR SELECT TO "authenticated" USING (("athlete_id" = "auth"."uid"()));



CREATE POLICY "athletes can write own messages" ON "public"."coach_messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_role" = 'athlete'::"text") AND ("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."coach_session_requests" "r"
  WHERE (("r"."id" = "coach_messages"."request_id") AND ("r"."athlete_id" = "auth"."uid"()))))));



ALTER TABLE "public"."body_measurements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "body_measurements_crud_own" ON "public"."body_measurements" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."bodyweight_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bodyweight_entries_crud_own" ON "public"."bodyweight_entries" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."coach_login_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_session_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coaches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "coaches can delete their own authored routines" ON "public"."routines" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."coaches" "c"
  WHERE (("c"."id" = "routines"."authored_by_coach") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "coaches can insert assigned athletes' routines" ON "public"."routines" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."coach_session_requests" "r"
     JOIN "public"."coaches" "c" ON (("c"."id" = "r"."coach_id")))
  WHERE (("r"."athlete_id" = "routines"."user_id") AND ("c"."user_id" = "auth"."uid"()) AND ("r"."status" = 'active'::"text")))));



CREATE POLICY "coaches can insert their own routine exercises" ON "public"."routine_exercises" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."routines" "rt"
  WHERE (("rt"."id" = "routine_exercises"."routine_id") AND (EXISTS ( SELECT 1
           FROM "public"."coaches" "c"
          WHERE (("c"."id" = "rt"."authored_by_coach") AND ("c"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "coaches can read assigned athletes' logs" ON "public"."workout_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."coach_session_requests" "r"
     JOIN "public"."coaches" "c" ON (("c"."id" = "r"."coach_id")))
  WHERE (("r"."athlete_id" = "workout_logs"."user_id") AND ("c"."user_id" = "auth"."uid"()) AND ("r"."status" = 'active'::"text")))));



CREATE POLICY "coaches can read assigned athletes' profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."coach_session_requests" "r"
     JOIN "public"."coaches" "c" ON (("c"."id" = "r"."coach_id")))
  WHERE (("r"."athlete_id" = "profiles"."user_id") AND ("c"."user_id" = "auth"."uid"()) AND ("r"."status" = 'active'::"text")))));



CREATE POLICY "coaches can read assigned athletes' routine exercises" ON "public"."routine_exercises" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."routines" "rt"
  WHERE (("rt"."id" = "routine_exercises"."routine_id") AND (EXISTS ( SELECT 1
           FROM ("public"."coach_session_requests" "r"
             JOIN "public"."coaches" "c" ON (("c"."id" = "r"."coach_id")))
          WHERE (("r"."athlete_id" = "rt"."user_id") AND ("c"."user_id" = "auth"."uid"()) AND ("r"."status" = 'active'::"text"))))))));



CREATE POLICY "coaches can read assigned athletes' routines" ON "public"."routines" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."coach_session_requests" "r"
     JOIN "public"."coaches" "c" ON (("c"."id" = "r"."coach_id")))
  WHERE (("r"."athlete_id" = "routines"."user_id") AND ("c"."user_id" = "auth"."uid"()) AND ("r"."status" = 'active'::"text")))));



CREATE POLICY "coaches can read assigned athletes' sets" ON "public"."completed_sets" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."workout_logs" "wl"
  WHERE (("wl"."id" = "completed_sets"."log_id") AND (EXISTS ( SELECT 1
           FROM ("public"."coach_session_requests" "r"
             JOIN "public"."coaches" "c" ON (("c"."id" = "r"."coach_id")))
          WHERE (("r"."athlete_id" = "wl"."user_id") AND ("c"."user_id" = "auth"."uid"()) AND ("r"."status" = 'active'::"text"))))))));



CREATE POLICY "coaches can read assigned messages" ON "public"."coach_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."coach_session_requests" "r"
     JOIN "public"."coaches" "c" ON (("c"."id" = "r"."coach_id")))
  WHERE (("r"."id" = "coach_messages"."request_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "coaches can read assigned requests" ON "public"."coach_session_requests" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."coaches" "c"
  WHERE (("c"."id" = "coach_session_requests"."coach_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "coaches can read own row" ON "public"."coaches" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "coaches can update own availability" ON "public"."coaches" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "coaches can update own requests" ON "public"."coach_session_requests" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."coaches" "c"
  WHERE (("c"."id" = "coach_session_requests"."coach_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "coaches can write assigned messages" ON "public"."coach_messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_role" = 'coach'::"text") AND ("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."coach_session_requests" "r"
     JOIN "public"."coaches" "c" ON (("c"."id" = "r"."coach_id")))
  WHERE (("r"."id" = "coach_messages"."request_id") AND ("c"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."completed_sets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "completed_sets_crud_own" ON "public"."completed_sets" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."workout_logs" "wl"
  WHERE (("wl"."id" = "completed_sets"."log_id") AND ("wl"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."workout_logs" "wl"
  WHERE (("wl"."id" = "completed_sets"."log_id") AND ("wl"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."exercises" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exercises_select_authenticated" ON "public"."exercises" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "premium athletes can request a coach" ON "public"."coach_session_requests" FOR INSERT TO "authenticated" WITH CHECK ((("athlete_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND "p"."is_premium" AND (("p"."premium_expires_at" IS NULL) OR ("p"."premium_expires_at" > "now"())))))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_crud_own" ON "public"."profiles" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."role_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."routine_exercises" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "routine_exercises_crud_own" ON "public"."routine_exercises" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."routines" "r"
  WHERE (("r"."id" = "routine_exercises"."routine_id") AND ("r"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."routines" "r"
  WHERE (("r"."id" = "routine_exercises"."routine_id") AND ("r"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."routines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "routines_crud_own" ON "public"."routines" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."session_checkins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "session_checkins_crud_own" ON "public"."session_checkins" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_roles_select_own" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users can read own limits" ON "public"."coach_rate_limits" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users can read own usage" ON "public"."coach_usage" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."workout_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workout_logs_crud_own" ON "public"."workout_logs" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."enforce_minor_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_minor_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_minor_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_role"("_role" "public"."app_role") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_role"("_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_role" "public"."app_role") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_coach"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_coach"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_coach"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."my_roles"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."my_roles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_roles"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."role_audit_log_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."role_audit_log_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."role_audit_log_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."user_roles_audit"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."user_roles_audit"() TO "service_role";


















GRANT ALL ON TABLE "public"."announcements" TO "anon";
GRANT ALL ON TABLE "public"."announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."announcements" TO "service_role";



GRANT ALL ON TABLE "public"."body_measurements" TO "anon";
GRANT ALL ON TABLE "public"."body_measurements" TO "authenticated";
GRANT ALL ON TABLE "public"."body_measurements" TO "service_role";



GRANT ALL ON TABLE "public"."bodyweight_entries" TO "anon";
GRANT ALL ON TABLE "public"."bodyweight_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."bodyweight_entries" TO "service_role";



GRANT ALL ON TABLE "public"."coach_login_attempts" TO "anon";
GRANT ALL ON TABLE "public"."coach_login_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_login_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."coach_messages" TO "anon";
GRANT ALL ON TABLE "public"."coach_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_messages" TO "service_role";



GRANT ALL ON TABLE "public"."coach_rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."coach_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."coach_session_requests" TO "anon";
GRANT ALL ON TABLE "public"."coach_session_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_session_requests" TO "service_role";



GRANT ALL ON TABLE "public"."coach_usage" TO "anon";
GRANT ALL ON TABLE "public"."coach_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_usage" TO "service_role";



GRANT ALL ON TABLE "public"."coaches" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."coaches" TO "authenticated";
GRANT ALL ON TABLE "public"."coaches" TO "service_role";



GRANT UPDATE("is_available") ON TABLE "public"."coaches" TO "authenticated";



GRANT ALL ON TABLE "public"."completed_sets" TO "anon";
GRANT ALL ON TABLE "public"."completed_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."completed_sets" TO "service_role";



GRANT ALL ON TABLE "public"."exercises" TO "anon";
GRANT ALL ON TABLE "public"."exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."exercises" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT UPDATE("display_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("birth_date") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("sex") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("height_cm") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("weight_kg") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("unit_system") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("experience_level") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("activity_level") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("goal") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("guardian_consent_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("onboarding_completed_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("updated_at") ON TABLE "public"."profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."role_audit_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."role_audit_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."role_audit_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."role_audit_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."routine_exercises" TO "anon";
GRANT ALL ON TABLE "public"."routine_exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."routine_exercises" TO "service_role";



GRANT ALL ON TABLE "public"."routines" TO "anon";
GRANT ALL ON TABLE "public"."routines" TO "authenticated";
GRANT ALL ON TABLE "public"."routines" TO "service_role";



GRANT ALL ON TABLE "public"."session_checkins" TO "anon";
GRANT ALL ON TABLE "public"."session_checkins" TO "authenticated";
GRANT ALL ON TABLE "public"."session_checkins" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "service_role";
GRANT SELECT ON TABLE "public"."user_roles" TO "authenticated";



GRANT ALL ON TABLE "public"."workout_logs" TO "anon";
GRANT ALL ON TABLE "public"."workout_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."workout_logs" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































