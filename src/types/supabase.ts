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
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          created_at?: string;
          is_favorite?: boolean;
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
          order_index: number;
        };
        Insert: {
          id?: string;
          routine_id: string;
          exercise_id: string;
          target_sets: number;
          rest_seconds?: number;
          order_index: number;
        };
        Update: {
          id?: string;
          routine_id?: string;
          exercise_id?: string;
          target_sets?: number;
          rest_seconds?: number;
          order_index?: number;
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
    };
  };
}

// Convenience aliases for the catalog and training rows used across views.
export type Exercise = Database["public"]["Tables"]["exercises"]["Row"];
export type Routine = Database["public"]["Tables"]["routines"]["Row"];
export type RoutineExercise = Database["public"]["Tables"]["routine_exercises"]["Row"];
export type WorkoutLog = Database["public"]["Tables"]["workout_logs"]["Row"];
export type CompletedSet = Database["public"]["Tables"]["completed_sets"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type BodyweightEntry = Database["public"]["Tables"]["bodyweight_entries"]["Row"];
export type BodyMeasurement = Database["public"]["Tables"]["body_measurements"]["Row"];
export type SessionCheckin = Database["public"]["Tables"]["session_checkins"]["Row"];