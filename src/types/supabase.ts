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
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          created_at?: string;
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
    };
  };
}

// Convenience aliases for the catalog and training rows used across views.
export type Exercise = Database["public"]["Tables"]["exercises"]["Row"];
export type Routine = Database["public"]["Tables"]["routines"]["Row"];
export type RoutineExercise = Database["public"]["Tables"]["routine_exercises"]["Row"];
export type WorkoutLog = Database["public"]["Tables"]["workout_logs"]["Row"];
export type CompletedSet = Database["public"]["Tables"]["completed_sets"]["Row"];