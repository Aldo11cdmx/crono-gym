export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

interface ForeignKey {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
}

export interface Database {
  public: {
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Tables: {
      exercises: {
        Row: {
          id: string;
          name: string;
          body_part: string;
          target: string;
          equipment: string;
          gif_url: string;
          instructions: string[];
        };
        Insert: {
          id: string;
          name: string;
          body_part: string;
          target: string;
          equipment: string;
          gif_url: string;
          instructions?: string[];
        };
        Update: {
          id?: string;
          name?: string;
          body_part?: string;
          target?: string;
          equipment?: string;
          gif_url?: string;
          instructions?: string[];
        };
        Relationships: ForeignKey[];
      };
      routines: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          created_at: string;
          is_favorite: boolean;
          /**
           * Who authored this routine: the athlete, the AI, or a human coach.
           *
           * Nullable because the column is: `default 'user'` fills every row written
           * from now on, but a row explicitly set to null is still representable and
           * means "not attributed". Read it with a `coalesce` at the presentation
           * edge rather than comparing for `"user"` and treating null as something else.
           */
          source: "user" | "human_coach" | "ai" | null;
          /**
           * The coach who wrote this routine, when a human coach did.
           *
           * Added by `20261003030000_coach_portal.sql`. Null for everything the athlete
           * or the AI created, and `on delete set null` rather than cascade: retiring a
           * coach is `is_active = false`, but if the row ever does go the athlete must
           * not lose their programme with it.
           *
           * Read it rather than inferring authorship from `source`, because the two
           * answer different questions -- `source` is what the athlete is told, this is
           * who to hold responsible for the prescription and who is allowed to retract
           * it.
           */
          authored_by_coach: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          created_at?: string;
          /**
           * Optional on insert: the column is `not null default false`, so leaving
           * it off is a deliberate "not a favorite" rather than an omission the
           * database would reject.
           */
          is_favorite?: boolean;
          /** Optional for the same reason: `default 'user'`. */
          source?: "user" | "human_coach" | "ai";
          /**
           * Nullable with no default. A coach inserting a routine sets it to their own
           * row, which is what grants them the narrow delete for the compensating
           * cleanup; everyone else leaves it off and the row reads as unattributed.
           */
          authored_by_coach?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          created_at?: string;
          is_favorite?: boolean;
          source?: "user" | "human_coach" | "ai" | null;
          authored_by_coach?: string | null;
        };
        Relationships: ForeignKey[];
      };
      routine_exercises: {
        Row: {
          id: string;
          routine_id: string;
          exercise_id: string;
          target_sets: number;
          rest_seconds: number;
          /**
           * Position within the whole routine, counting every day.
           *
           * Left counting across the routine rather than within the day, even though
           * `day_index` now exists: rows written before `20261003030000` were stored
           * under the flat convention, and changing its meaning would invalidate every
           * one of them. `day_index` is the column to group and read by; this one orders
           * within a day.
           */
          order_index: number;
          /** Which day of the routine this belongs to. Zero-based. */
          day_index: number;
          /**
           * The day's name as its author wrote it -- "Pecho y espalda", not "DÃƒÂ­a 2".
           *
           * Empty rather than null for the pre-migration rows, so the read path is one
           * `string` with no coalesce: a routine with no day names is still a routine,
           * and every row written from now on carries one.
           */
          day_label: string;
          /**
           * Rep range, or null for "no target set".
           *
           * Nullable because the column is, and null is the honest value for a row that
           * predates rep targets and for a set prescribed by weight alone. A default of 10
           * would be a number nobody chose, rendered back to the athlete as if they had.
           */
          target_reps_min: number | null;
          target_reps_max: number | null;
        };
        Insert: {
          id?: string;
          routine_id: string;
          exercise_id: string;
          target_sets: number;
          rest_seconds?: number;
          order_index: number;
          /** Optional: `not null default 0`, so an omitted day is day one. */
          day_index?: number;
          /** Optional: `not null default ''`. */
          day_label?: string;
          /**
           * Optional and nullable. Both are `check (> 0)` when present, so an omitted
           * column means "unspecified" rather than a rejected zero.
           */
          target_reps_min?: number | null;
          target_reps_max?: number | null;
        };
        Update: {
          id?: string;
          routine_id?: string;
          exercise_id?: string;
          target_sets?: number;
          rest_seconds?: number;
          order_index?: number;
          day_index?: number;
          day_label?: string;
          target_reps_min?: number | null;
          target_reps_max?: number | null;
        };
        Relationships: ForeignKey[];
      };
      workout_logs: {
        Row: {
          id: string;
          user_id: string;
          routine_id: string | null;
          started_at: string;
          completed_at: string | null;
          journal_notes: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          routine_id?: string | null;
          started_at: string;
          completed_at?: string | null;
          journal_notes?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          routine_id?: string | null;
          started_at?: string;
          completed_at?: string | null;
          journal_notes?: string | null;
        };
        Relationships: ForeignKey[];
      };
      user_roles: {
        Row: {
          user_id: string;
          role: 'athlete' | 'coach' | 'admin' | 'developer';
          granted_by: string | null;
          granted_at: string;
        };
        Insert: {
          user_id: string;
          role: 'athlete' | 'coach' | 'admin' | 'developer';
          granted_by?: string | null;
          granted_at?: string;
        };
        Update: {
          user_id?: string;
          role?: 'athlete' | 'coach' | 'admin' | 'developer';
          granted_by?: string | null;
          granted_at?: string;
        };
        Relationships: ForeignKey[];
      };
      role_audit_log: {
        Row: {
          id: number;
          user_id: string | null;
          role: 'athlete' | 'coach' | 'admin' | 'developer';
          action: string;
          actor: string | null;
          at: string;
        };
        Insert: {
          id?: number;
          user_id?: string | null;
          role: 'athlete' | 'coach' | 'admin' | 'developer';
          action: string;
          actor?: string | null;
          at?: string;
        };
        Update: {
          id?: number;
          user_id?: string | null;
          role?: 'athlete' | 'coach' | 'admin' | 'developer';
          action?: string;
          actor?: string | null;
          at?: string;
        };
        Relationships: ForeignKey[];
      };
      completed_sets: {
        Row: {
          id: string;
          log_id: string;
          exercise_id: string;
          set_number: number;
          weight: number | null;
          reps: number | null;
          rpe: number | null;
          is_warmup: boolean;
          /**
           * What the athlete wrote about this set. `20261003040000_exercise_hub_notes.sql`.
           *
           * `null` and `''` are different on purpose: null is "no note", which is the
           * overwhelmingly common case and must not cost a byte per row in the hub's
           * history query; `''` is a note someone deliberately blanked.
           */
          notes: string | null;
        };
        Insert: {
          id?: string;
          log_id: string;
          exercise_id: string;
          set_number: number;
          weight?: number | null;
          reps?: number | null;
          rpe?: number | null;
          is_warmup?: boolean;
          notes?: string | null;
        };
        Update: {
          id?: string;
          log_id?: string;
          exercise_id?: string;
          set_number?: number;
          weight?: number | null;
          reps?: number | null;
          rpe?: number | null;
          is_warmup?: boolean;
          notes?: string | null;
        };
        Relationships: ForeignKey[];
      };
      profiles: {
        Row: {
          user_id: string;
          display_name: string | null;
          birth_date: string | null;
          sex: string | null;
          height_cm: number | null;
          weight_kg: number | null;
          unit_system: string;
          experience_level: string;
          activity_level: string;
          goal: string;
          guardian_consent_at: string | null;
          onboarding_completed_at: string | null;
          created_at: string;
          updated_at: string;
          /**
           * The paid tier. `not null default false`, so a read never has to distinguish
           * "not premium" from "never asked".
           *
           * Readable by the athlete and *not* writable by them: the migration revokes
           * table-level UPDATE and re-grants it per column, so these three are absent
           * from the grant. `authenticated` still holds SELECT on the whole row.
           */
          is_premium: boolean;
          /** When the tier began. Non-null whenever `is_premium` is true. */
          premium_since: string | null;
          /**
           * When the tier ends, or null for a perpetual subscription. Null here is
           * meaningful and load-bearing -- it is the representation of "never expires",
           * which is why the column is nullable rather than defaulted.
           */
          premium_expires_at: string | null;
        };
        Insert: {
          user_id: string;
          display_name?: string | null;
          birth_date?: string | null;
          sex?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          unit_system?: string;
          experience_level?: string;
          activity_level?: string;
          goal?: string;
          guardian_consent_at?: string | null;
          onboarding_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          /*
           * The premium columns are absent here on purpose. They are set by the service
           * role, so `Insert` -- which is what a client uses to create a profile -- has
           * no path to them, and the column grants would refuse the write anyway. A
           * `Profile` insert that could claim its own premium would be a paywall the
           * athlete opens with a form field.
           */
        };
        Update: {
          user_id?: string;
          display_name?: string | null;
          birth_date?: string | null;
          sex?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          unit_system?: string;
          experience_level?: string;
          activity_level?: string;
          goal?: string;
          guardian_consent_at?: string | null;
          onboarding_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          /* See `Insert`: no premium columns, by design and by grant. */
        };
        Relationships: ForeignKey[];
      };
      bodyweight_entries: {
        Row: {
          id: string;
          user_id: string;
          measured_on: string;
          weight_kg: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          measured_on?: string;
          weight_kg: number;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          measured_on?: string;
          weight_kg?: number;
          note?: string | null;
          created_at?: string;
        };
        Relationships: ForeignKey[];
      };
      body_measurements: {
        Row: {
          id: string;
          user_id: string;
          measured_on: string;
          chest_cm: number | null;
          waist_cm: number | null;
          hips_cm: number | null;
          arm_cm: number | null;
          thigh_cm: number | null;
          calf_cm: number | null;
          shoulder_cm: number | null;
          body_fat_pct: number | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          measured_on?: string;
          chest_cm?: number | null;
          waist_cm?: number | null;
          hips_cm?: number | null;
          arm_cm?: number | null;
          thigh_cm?: number | null;
          calf_cm?: number | null;
          shoulder_cm?: number | null;
          body_fat_pct?: number | null;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          measured_on?: string;
          chest_cm?: number | null;
          waist_cm?: number | null;
          hips_cm?: number | null;
          arm_cm?: number | null;
          thigh_cm?: number | null;
          calf_cm?: number | null;
          shoulder_cm?: number | null;
          body_fat_pct?: number | null;
          note?: string | null;
          created_at?: string;
        };
        Relationships: ForeignKey[];
      };
      session_checkins: {
        Row: {
          id: string;
          user_id: string;
          workout_log_id: string | null;
          checked_on: string;
          energy: number | null;
          motivation: number | null;
          soreness: number | null;
          stress: number | null;
          sleep_hours: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workout_log_id?: string | null;
          checked_on?: string;
          energy?: number | null;
          motivation?: number | null;
          soreness?: number | null;
          stress?: number | null;
          sleep_hours?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          workout_log_id?: string | null;
          checked_on?: string;
          energy?: number | null;
          motivation?: number | null;
          soreness?: number | null;
          stress?: number | null;
          sleep_hours?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: ForeignKey[];
      };
      /**
       * The roster of human coaches.
       *
       * Typed for reading, with exactly one writable column.
       *
       * Until `20261003030000` that was no writable column at all: RLS denies a command
       * with no policy, so a coach row could only be written by the service role and the
       * `coach-auth` function. `20261003030000` adds an UPDATE policy for the coach's own
       * row, and that would by itself have been too much -- RLS is row-level and cannot
       * see which column is being set, so the same policy would have let a coach rewrite
       * their own `pin_hash` or clear their own `is_provisional`, the two columns
       * `coach-auth` exists to guard. The migration therefore revokes table-level UPDATE
       * and re-grants it on one column, and {@link CoachRow.Update} mirrors that.
       *
       * That is also why `pin_hash` has no business appearing in client code: the only
       * read policy athletes have is `is_active = true`, and the app selects
       * `display_name` and `specialties` by name.
       */
      coaches: {
        Row: {
          id: string;
          user_id: string;
          display_name: string;
          pin_hash: string;
          is_provisional: boolean;
          is_active: boolean;
          /**
           * Whether this coach is taking requests right now.
           *
           * Deliberately not the same column as `is_active`. `is_active` is membership
           * of the roster -- "this person is staff, athletes may see them" -- and is not
           * something a coach flips for an afternoon. This one is: "I am on the desk
           * today". Folding them would mean a coach going on holiday disappears from the
           * product, and coming back needs a service-role write.
           */
          is_available: boolean;
          specialties: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          display_name: string;
          /**
           * Service role only. A plain `text` slot on purpose: the format belongs to the
           * Edge Function that writes and verifies it, and a type that encoded an
           * algorithm would freeze that choice before the code exists.
           */
          pin_hash: string;
          /** Defaults to true: a seeded PIN must be changed before it issues a session. */
          is_provisional?: boolean;
          is_active?: boolean;
          /** Defaults to true. Service role only: no client INSERT policy exists. */
          is_available?: boolean;
          specialties?: string[];
          created_at?: string;
          updated_at?: string;
        };
        /**
         * Only `is_available` is writable by a client.
         *
         * The other fields are here so an `update` object naming one is a compile error
         * rather than a runtime "permission denied for table coaches". That is the
         * `profiles` trade, taken deliberately: a forgotten column is a loud failure
         * rather than a silent hole.
         */
        Update: {
          is_available?: boolean;
        };
        Relationships: ForeignKey[];
      };
      /**
       * The PIN attempt log behind the server-side lockout.
       *
       * Present in the generated types because the table exists, but every operation is
       * unreachable from a client: RLS is enabled with no policy at all, so PostgREST
       * denies every command and only the service role -- which bypasses RLS -- can read
       * it. Without `enable row level security` this would be a live feed of who is being
       * brute-forced, readable by every signed-in athlete.
       *
       * Nullable throughout and with no id: an append-only audit log written by the
       * `coach-auth` function. `coach_id` is nullable because an attempt made before a
       * coach could be identified still has to be recorded.
       */
      coach_login_attempts: {
        Row: {
          coach_id: string | null;
          attempted_at: string;
          succeeded: boolean;
        };
        Insert: {
          coach_id?: string | null;
          attempted_at?: string;
          succeeded?: boolean;
        };
        Update: {
          coach_id?: string | null;
          attempted_at?: string;
          succeeded?: boolean;
        };
        Relationships: ForeignKey[];
      };
      /**
       * An athlete asking a coach for attention.
       *
       * The join between the two sides, and the spine of every policy on
       * `coach_messages`. `status` is a lifecycle rather than a label: `pending` ->
       * `active` (accepted; the chat hangs off this request) -> `closed`, or out to
       * `declined` / `cancelled` from `pending`.
       */
      coach_session_requests: {
        Row: {
          id: string;
          athlete_id: string;
          coach_id: string;
          status: "pending" | "active" | "declined" | "closed" | "cancelled";
          athlete_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          athlete_id: string;
          coach_id: string;
          status?: "pending" | "active" | "declined" | "closed" | "cancelled";
          athlete_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          athlete_id?: string;
          coach_id?: string;
          status?: "pending" | "active" | "declined" | "closed" | "cancelled";
          athlete_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: ForeignKey[];
      };
      /**
       * Nota privada del coach para un atleta. Solo el coach que la escribió
       * puede leerla o editarla; el atleta nunca la ve.
       */
      coach_notes: {
        Row: {
          id: string;
          coach_id: string;
          athlete_id: string;
          content: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          coach_id: string;
          athlete_id: string;
          content: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          coach_id?: string;
          athlete_id?: string;
          content?: string;
          updated_at?: string;
        };
        Relationships: ForeignKey[];
      };
      /**
       * Fase de entrenamiento del atleta: descarga, mantenimiento o sobrecarga.
       * Una fila por atleta; el coach la establece para sus atletas asignados.
       */
      athlete_phases: {
        Row: {
          athlete_id: string;
          phase: "deload" | "maintenance" | "overload";
          updated_at: string;
        };
        Insert: {
          athlete_id: string;
          phase?: "deload" | "maintenance" | "overload";
          updated_at?: string;
        };
        Update: {
          athlete_id?: string;
          phase?: "deload" | "maintenance" | "overload";
          updated_at?: string;
        };
        Relationships: ForeignKey[];
      };
      /**
       * The human conversation, polled every 10 seconds.
       *
       * `sender_id` and `sender_role` are both stored and are not redundant: the id is
       * the authoritative "who" and the role is the "as". The RLS insert policies force
       * them to agree, so a row always says "this athlete, as the athlete" or "this
       * coach, as the coach" -- a role can never claim the other side's voice.
       *
       * `request_id` is nullable and `sender_id` is nullable too, though every row a
       * client can write has both. The nullability is what makes an unattributable
       * message unreadable: both select policies qualify through `request_id`, so a null
       * matches neither and the row stays invisible.
       */
      coach_messages: {
        Row: {
          id: string;
          request_id: string | null;
          sender_id: string | null;
          sender_role: "athlete" | "coach";
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id?: string | null;
          sender_id?: string | null;
          sender_role?: "athlete" | "coach" | null;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string | null;
          sender_id?: string | null;
          sender_role?: "athlete" | "coach" | null;
          content?: string;
          created_at?: string;
        };
        Relationships: ForeignKey[];
      };
      /**
       * Una conversación con el asistente IA (Cronos IA). Un atleta puede tener
       * varias sesiones independientes; `title` es el nombre que se muestra en el
       * historial y `updated_at` ordena las más recientes primero.
       */
      chat_sessions: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: ForeignKey[];
      };
      /**
       * Un mensaje dentro de una sesión de chat. `role` distingue quién lo escribió:
       * el atleta, el asistente o una burbuja de error. `session_id` la agrupa bajo
       * su conversación; borrar la sesión la arrastra mediante ON DELETE CASCADE.
       */
        chat_messages: {
          Row: {
            id: string;
            session_id: string;
            user_id: string;
            role: "user" | "assistant" | "error";
            content: string;
            created_at: string;
          };
          Insert: {
            id?: string;
            session_id: string;
            user_id: string;
            role: "user" | "assistant" | "error";
            content: string;
            created_at?: string;
          };
          Update: {
            id?: string;
            content?: string;
          };
          Relationships: ForeignKey[];
        };
        announcements: {
          Row: {
            id: string;
            title: string;
            message: string;
            kind: "promo" | "notice" | "event";
            banner_path: string | null;
            starts_at: string;
            expires_at: string;
            created_by: string | null;
            created_at: string;
          };
          Insert: {
            id?: string;
            title: string;
            message: string;
            kind?: "promo" | "notice" | "event";
            banner_path?: string | null;
            starts_at?: string;
            expires_at: string;
            created_by?: string | null;
            created_at?: string;
          };
          Update: {
            id?: string;
            title?: string;
            message?: string;
            kind?: "promo" | "notice" | "event";
            banner_path?: string | null;
            starts_at?: string;
            expires_at?: string;
            created_by?: string | null;
            created_at?: string;
          };
          Relationships: ForeignKey[];
        };
        products: {
          Row: {
            id: string;
            name: string;
            description: string | null;
            price_cents: number;
            stock: number;
            category: "supplements" | "accessories" | "clothing" | "other";
            image_path: string | null;
            is_active: boolean;
            created_at: string;
            updated_at: string;
          };
          Insert: {
            id?: string;
            name: string;
            description?: string | null;
            price_cents: number;
            stock?: number;
            category?: "supplements" | "accessories" | "clothing" | "other";
            image_path?: string | null;
            is_active?: boolean;
            created_at?: string;
            updated_at?: string;
          };
          Update: {
            id?: string;
            name?: string;
            description?: string | null;
            price_cents?: number;
            stock?: number;
            category?: "supplements" | "accessories" | "clothing" | "other";
            image_path?: string | null;
            is_active?: boolean;
            created_at?: string;
            updated_at?: string;
          };
          Relationships: ForeignKey[];
        };
        purchase_tickets: {
          Row: {
            id: string;
            ticket_number: string;
            user_id: string;
            product_id: string;
            quantity: number;
            unit_price_cents: number;
            total_cents: number;
            status: "pending" | "paid" | "delivered" | "cancelled";
            notes: string | null;
            created_at: string;
            updated_at: string;
          };
          Insert: {
            id?: string;
            ticket_number: string;
            user_id: string;
            product_id: string;
            quantity?: number;
            unit_price_cents: number;
            total_cents: number;
            status?: "pending" | "paid" | "delivered" | "cancelled";
            notes?: string | null;
            created_at?: string;
            updated_at?: string;
          };
          Update: {
            id?: string;
            ticket_number?: string;
            user_id?: string;
            product_id?: string;
            quantity?: number;
            unit_price_cents?: number;
            total_cents?: number;
            status?: "pending" | "paid" | "delivered" | "cancelled";
            notes?: string | null;
            created_at?: string;
            updated_at?: string;
          };
          Relationships: ForeignKey[];
        };
        gym_classes: {
          Row: {
            id: string;
            name: string;
            description: string | null;
            instructor: string | null;
            capacity: number;
            duration_minutes: number;
            is_active: boolean;
            created_at: string;
          };
          Insert: {
            id?: string;
            name: string;
            description?: string | null;
            instructor?: string | null;
            capacity?: number;
            duration_minutes?: number;
            is_active?: boolean;
            created_at?: string;
          };
          Update: {
            id?: string;
            name?: string;
            description?: string | null;
            instructor?: string | null;
            capacity?: number;
export type RoutineExercise = Database["public"]["Tables"]["routine_exercises"]["Row"];
export type WorkoutLog = Database["public"]["Tables"]["workout_logs"]["Row"];
export type CompletedSet = Database["public"]["Tables"]["completed_sets"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type AppRole = 'athlete' | 'coach' | 'admin' | 'developer';
export type UserRoleRow = Database["public"]["Tables"]["user_roles"]["Row"];
export type BodyweightEntry = Database["public"]["Tables"]["bodyweight_entries"]["Row"];
export type BodyMeasurement = Database["public"]["Tables"]["body_measurements"]["Row"];
export type SessionCheckin = Database["public"]["Tables"]["session_checkins"]["Row"];
export type AnnouncementRow = Database["public"]["Tables"]["announcements"]["Row"];
export type ProductRow = Database["public"]["Tables"]["products"]["Row"];
export type PurchaseTicketRow = Database["public"]["Tables"]["purchase_tickets"]["Row"];
export type GymClassRow = Database["public"]["Tables"]["gym_classes"]["Row"];
export type GymScheduleRow = Database["public"]["Tables"]["gym_schedules"]["Row"];

/**
 * The four human-coaching rows.
 *
 * Aliases named for what they are rather than repeating the table names, so call sites
 * read `CoachProfileRow` / `CoachRequestRow` next to the app's existing `ProfileRow` and
 * cannot be mistaken for it. `CoachProfileRow` in particular sits dangerously close to
 * the `CoachProfile` in `src/lib/coach/access.ts` -- one is a database row, the other is
 * the two columns the entitlement check reads.
 */
export type CoachProfileRow = Database["public"]["Tables"]["coaches"]["Row"];
export type CoachLoginAttemptRow = Database["public"]["Tables"]["coach_login_attempts"]["Row"];
export type CoachRequestRow = Database["public"]["Tables"]["coach_session_requests"]["Row"];
export type CoachMessageRow = Database["public"]["Tables"]["coach_messages"]["Row"];
export type CoachNoteRow = Database["public"]["Tables"]["coach_notes"]["Row"];
export type AthletePhaseRow = Database["public"]["Tables"]["athlete_phases"]["Row"];
export type ChatSessionRow = Database["public"]["Tables"]["chat_sessions"]["Row"];
export type ChatMessageRow = Database["public"]["Tables"]["chat_messages"]["Row"];

/**
 * Who authored a routine.
 *
 * Named here because `routines.source` is nullable, so the three values are a subset of
 * what the column can hold. `routineAuthor()` in the UI is the one place that resolves
 * null, and this type is the input to it.
 */
export type RoutineAuthor = "user" | "human_coach" | "ai";
export type RoutineSource = RoutineAuthor | null;
