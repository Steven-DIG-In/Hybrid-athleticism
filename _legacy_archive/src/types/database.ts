export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      // ===== STRENGTH PLANNING TABLES =====
      mesocycles: {
        Row: {
          id: string
          user_id: string
          name: string | null
          start_date: string
          end_date: string
          total_weeks: number
          deload_week: number | null
          config: Json
          status: 'planned' | 'active' | 'completed' | 'archived'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name?: string | null
          start_date: string
          end_date: string
          total_weeks?: number
          deload_week?: number | null
          config?: Json
          status?: 'planned' | 'active' | 'completed' | 'archived'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string | null
          start_date?: string
          end_date?: string
          total_weeks?: number
          deload_week?: number | null
          config?: Json
          status?: 'planned' | 'active' | 'completed' | 'archived'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      planned_sessions: {
        Row: {
          id: string
          user_id: string
          mesocycle_id: string | null
          week_number: number
          day_of_week: string
          scheduled_date: string
          session_type: string
          domain: 'strength' | 'rucking' | 'cardio'
          target_rpe: number | null
          target_rir: number | null
          estimated_duration_mins: number | null
          estimated_total_sets: number | null
          status: 'planned' | 'completed' | 'skipped' | 'in_progress'
          actual_session_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          mesocycle_id?: string | null
          week_number: number
          day_of_week: string
          scheduled_date: string
          session_type: string
          domain?: 'strength' | 'rucking' | 'cardio'
          target_rpe?: number | null
          target_rir?: number | null
          estimated_duration_mins?: number | null
          estimated_total_sets?: number | null
          status?: 'planned' | 'completed' | 'skipped' | 'in_progress'
          actual_session_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          mesocycle_id?: string | null
          week_number?: number
          day_of_week?: string
          scheduled_date?: string
          session_type?: string
          domain?: 'strength' | 'rucking' | 'cardio'
          target_rpe?: number | null
          target_rir?: number | null
          estimated_duration_mins?: number | null
          estimated_total_sets?: number | null
          status?: 'planned' | 'completed' | 'skipped' | 'in_progress'
          actual_session_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      planned_exercises: {
        Row: {
          id: string
          planned_session_id: string
          exercise_id: string
          exercise_order: number
          target_muscle: string
          is_primary: boolean
          sets: number
          rep_range_min: number
          rep_range_max: number
          target_rpe: number | null
          target_rir: number | null
          rest_seconds: number
          suggested_weight_kg: number | null
          percentage_of_tm: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          planned_session_id: string
          exercise_id: string
          exercise_order: number
          target_muscle: string
          is_primary?: boolean
          sets: number
          rep_range_min: number
          rep_range_max: number
          target_rpe?: number | null
          target_rir?: number | null
          rest_seconds?: number
          suggested_weight_kg?: number | null
          percentage_of_tm?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          planned_session_id?: string
          exercise_id?: string
          exercise_order?: number
          target_muscle?: string
          is_primary?: boolean
          sets?: number
          rep_range_min?: number
          rep_range_max?: number
          target_rpe?: number | null
          target_rir?: number | null
          rest_seconds?: number
          suggested_weight_kg?: number | null
          percentage_of_tm?: number | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      user_lift_maxes: {
        Row: {
          id: string
          user_id: string
          exercise_id: string
          tested_1rm_kg: number | null
          estimated_1rm_kg: number | null
          training_max_kg: number | null
          training_max_percentage: number
          last_tested_date: string | null
          last_pr_date: string | null
          pr_weight_kg: number | null
          source: 'tested' | 'estimated' | 'manual'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          exercise_id: string
          tested_1rm_kg?: number | null
          estimated_1rm_kg?: number | null
          training_max_kg?: number | null
          training_max_percentage?: number
          last_tested_date?: string | null
          last_pr_date?: string | null
          pr_weight_kg?: number | null
          source?: 'tested' | 'estimated' | 'manual'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          exercise_id?: string
          tested_1rm_kg?: number | null
          estimated_1rm_kg?: number | null
          training_max_kg?: number | null
          training_max_percentage?: number
          last_tested_date?: string | null
          last_pr_date?: string | null
          pr_weight_kg?: number | null
          source?: 'tested' | 'estimated' | 'manual'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      lift_max_history: {
        Row: {
          id: string
          user_id: string
          exercise_id: string
          recorded_date: string
          e1rm_kg: number
          source: 'session' | 'test' | 'manual'
          weight_kg: number | null
          reps: number | null
          rir: number | null
          actual_session_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          exercise_id: string
          recorded_date: string
          e1rm_kg: number
          source?: 'session' | 'test' | 'manual'
          weight_kg?: number | null
          reps?: number | null
          rir?: number | null
          actual_session_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          exercise_id?: string
          recorded_date?: string
          e1rm_kg?: number
          source?: 'session' | 'test' | 'manual'
          weight_kg?: number | null
          reps?: number | null
          rir?: number | null
          actual_session_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      actual_session_exercises: {
        Row: {
          id: string
          actual_session_id: string
          exercise_id: string
          logs: Json
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          actual_session_id: string
          exercise_id: string
          logs?: Json
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          actual_session_id?: string
          exercise_id?: string
          logs?: Json
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      user_volume_landmarks: {
        Row: {
          id: string
          user_id: string
          muscle_group: string
          mv: number
          mev: number
          mav: number
          mrv: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          muscle_group: string
          mv: number
          mev: number
          mav: number
          mrv: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          muscle_group?: string
          mv?: number
          mev?: number
          mav?: number
          mrv?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      // ===== EXISTING TABLES =====
      actual_sessions: {
        Row: {
          avg_heart_rate: number | null
          avg_pace_min_km: number | null
          calories_burned: number | null
          created_at: string | null
          distance_km: number | null
          domain: Database["public"]["Enums"]["training_domain_type"]
          duration_mins: number | null
          elevation_gain_m: number | null
          end_time: string | null
          fatigue_after: number | null
          fatigue_before: number | null
          fatigue_cost: number | null
          garmin_activity_id: string | null
          id: string
          load_kg: number | null
          max_heart_rate: number | null
          microcycle_id: string | null
          notes: string | null
          planned_session_id: string | null
          rpe: number | null
          satisfaction: number | null
          session_date: string
          session_name: string | null
          source: Database["public"]["Enums"]["session_source"] | null
          start_time: string | null
          strength_metrics: Json | null
          updated_at: string | null
          user_id: string
          volume_contribution: number | null
        }
        Insert: {
          avg_heart_rate?: number | null
          avg_pace_min_km?: number | null
          calories_burned?: number | null
          created_at?: string | null
          distance_km?: number | null
          domain: Database["public"]["Enums"]["training_domain_type"]
          duration_mins?: number | null
          elevation_gain_m?: number | null
          end_time?: string | null
          fatigue_after?: number | null
          fatigue_before?: number | null
          fatigue_cost?: number | null
          garmin_activity_id?: string | null
          id?: string
          load_kg?: number | null
          max_heart_rate?: number | null
          microcycle_id?: string | null
          notes?: string | null
          planned_session_id?: string | null
          rpe?: number | null
          satisfaction?: number | null
          session_date: string
          session_name?: string | null
          source?: Database["public"]["Enums"]["session_source"] | null
          start_time?: string | null
          strength_metrics?: Json | null
          updated_at?: string | null
          user_id: string
          volume_contribution?: number | null
        }
        Update: {
          avg_heart_rate?: number | null
          avg_pace_min_km?: number | null
          calories_burned?: number | null
          created_at?: string | null
          distance_km?: number | null
          domain?: Database["public"]["Enums"]["training_domain_type"]
          duration_mins?: number | null
          elevation_gain_m?: number | null
          end_time?: string | null
          fatigue_after?: number | null
          fatigue_before?: number | null
          fatigue_cost?: number | null
          garmin_activity_id?: string | null
          id?: string
          load_kg?: number | null
          max_heart_rate?: number | null
          microcycle_id?: string | null
          notes?: string | null
          planned_session_id?: string | null
          rpe?: number | null
          satisfaction?: number | null
          session_date?: string
          session_name?: string | null
          source?: Database["public"]["Enums"]["session_source"] | null
          start_time?: string | null
          strength_metrics?: Json | null
          updated_at?: string | null
          user_id?: string
          volume_contribution?: number | null
        }
        Relationships: []
      }
      exercises: {
        Row: {
          category: Database["public"]["Enums"]["exercise_category"]
          created_at: string | null
          cues: string[] | null
          equipment: string[] | null
          id: string
          instructions: string | null
          is_active: boolean | null
          is_bilateral: boolean | null
          movement_pattern: Database["public"]["Enums"]["movement_pattern"]
          name: string
          name_normalized: string | null
          primary_muscles: string[]
          rep_range_max: number | null
          rep_range_min: number | null
          secondary_muscles: string[] | null
          stimulus_to_fatigue_ratio: number | null
          systemic_fatigue: Database["public"]["Enums"]["fatigue_level"] | null
          updated_at: string | null
          user_id: string | null
          video_url: string | null
          weight_increment_kg: number | null
        }
        Insert: {
          category: Database["public"]["Enums"]["exercise_category"]
          created_at?: string | null
          cues?: string[] | null
          equipment?: string[] | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          is_bilateral?: boolean | null
          movement_pattern: Database["public"]["Enums"]["movement_pattern"]
          name: string
          name_normalized?: string | null
          primary_muscles: string[]
          rep_range_max?: number | null
          rep_range_min?: number | null
          secondary_muscles?: string[] | null
          stimulus_to_fatigue_ratio?: number | null
          systemic_fatigue?: Database["public"]["Enums"]["fatigue_level"] | null
          updated_at?: string | null
          user_id?: string | null
          video_url?: string | null
          weight_increment_kg?: number | null
        }
        Update: {
          category?: Database["public"]["Enums"]["exercise_category"]
          created_at?: string | null
          cues?: string[] | null
          equipment?: string[] | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          is_bilateral?: boolean | null
          movement_pattern?: Database["public"]["Enums"]["movement_pattern"]
          name?: string
          name_normalized?: string | null
          primary_muscles?: string[]
          rep_range_max?: number | null
          rep_range_min?: number | null
          secondary_muscles?: string[] | null
          stimulus_to_fatigue_ratio?: number | null
          systemic_fatigue?: Database["public"]["Enums"]["fatigue_level"] | null
          updated_at?: string | null
          user_id?: string | null
          video_url?: string | null
          weight_increment_kg?: number | null
        }
        Relationships: []
      }
      set_logs: {
        Row: {
          actual_session_id: string
          exercise_id: string
          form_rating: Database["public"]["Enums"]["form_rating"] | null
          id: string
          logged_at: string | null
          notes: string | null
          partial_reps: number | null
          planned_exercise_id: string | null
          reps: number
          rest_after_seconds: number | null
          rir: number | null
          rpe: number | null
          set_number: number
          set_type: Database["public"]["Enums"]["set_type"] | null
          weight_kg: number
        }
        Insert: {
          actual_session_id: string
          exercise_id: string
          form_rating?: Database["public"]["Enums"]["form_rating"] | null
          id?: string
          logged_at?: string | null
          notes?: string | null
          partial_reps?: number | null
          planned_exercise_id?: string | null
          reps: number
          rest_after_seconds?: number | null
          rir?: number | null
          rpe?: number | null
          set_number: number
          set_type?: Database["public"]["Enums"]["set_type"] | null
          weight_kg: number
        }
        Update: {
          actual_session_id?: string
          exercise_id?: string
          form_rating?: Database["public"]["Enums"]["form_rating"] | null
          id?: string
          logged_at?: string | null
          notes?: string | null
          partial_reps?: number | null
          planned_exercise_id?: string | null
          reps?: number
          rest_after_seconds?: number | null
          rir?: number | null
          rpe?: number | null
          set_number?: number
          set_type?: Database["public"]["Enums"]["set_type"] | null
          weight_kg?: number
        }
        Relationships: []
      }
      users: {
        Row: {
          auth_id: string
          available_days: string[] | null
          created_at: string | null
          date_of_birth: string | null
          email: string
          endurance_level: Database["public"]["Enums"]["training_level"] | null
          height_cm: number | null
          id: string
          max_sessions_per_day: number | null
          name: string | null
          preferred_session_duration_mins: number | null
          strength_level: Database["public"]["Enums"]["training_level"] | null
          timezone: string | null
          training_age_years: number | null
          updated_at: string | null
          weight_kg: number | null
        }
        Insert: {
          auth_id: string
          available_days?: string[] | null
          created_at?: string | null
          date_of_birth?: string | null
          email: string
          endurance_level?: Database["public"]["Enums"]["training_level"] | null
          height_cm?: number | null
          id?: string
          max_sessions_per_day?: number | null
          name?: string | null
          preferred_session_duration_mins?: number | null
          strength_level?: Database["public"]["Enums"]["training_level"] | null
          timezone?: string | null
          training_age_years?: number | null
          updated_at?: string | null
          weight_kg?: number | null
        }
        Update: {
          auth_id?: string
          available_days?: string[] | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string
          endurance_level?: Database["public"]["Enums"]["training_level"] | null
          height_cm?: number | null
          id?: string
          max_sessions_per_day?: number | null
          name?: string | null
          preferred_session_duration_mins?: number | null
          strength_level?: Database["public"]["Enums"]["training_level"] | null
          timezone?: string | null
          training_age_years?: number | null
          updated_at?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_e1rm: {
        Args: { reps: number; rir?: number; weight: number }
        Returns: number
      }
    }
    Enums: {
      domain_priority: "primary" | "secondary" | "maintenance"
      exercise_category: "compound" | "isolation" | "machine" | "bodyweight" | "cable"
      fatigue_level: "low" | "medium" | "high"
      form_rating: "poor" | "ok" | "good" | "excellent"
      intensity_level: "easy" | "moderate" | "hard" | "very_hard"
      mesocycle_phase: "base" | "build" | "peak" | "taper" | "deload" | "maintenance"
      movement_pattern: "push" | "pull" | "squat" | "hinge" | "lunge" | "carry" | "rotation" | "core"
      running_workout_type: "easy" | "tempo" | "intervals" | "long_run" | "recovery" | "fartlek" | "hills" | "race"
      session_source: "manual" | "garmin_sync" | "garmin_push"
      session_status: "planned" | "completed" | "skipped" | "modified"
      set_type: "warmup" | "working" | "backoff" | "dropset" | "failure"
      training_domain_type: "strength" | "rucking" | "running"
      training_level: "beginner" | "intermediate" | "advanced" | "elite"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

// Convenience types - Existing
export type Exercise = Tables<'exercises'>
export type ActualSession = Tables<'actual_sessions'>
export type SetLog = Tables<'set_logs'>
export type User = Tables<'users'>

// Convenience types - Strength Planning
export type Mesocycle = Tables<'mesocycles'>
export type PlannedSession = Tables<'planned_sessions'>
export type PlannedExercise = Tables<'planned_exercises'>
export type UserLiftMax = Tables<'user_lift_maxes'>
export type LiftMaxHistory = Tables<'lift_max_history'>
export type UserVolumeLandmark = Tables<'user_volume_landmarks'>
export type ActualSessionExercise = Tables<'actual_session_exercises'>

// Enum types
export type TrainingDomain = Enums<'training_domain_type'>
export type SetType = Enums<'set_type'>
export type ExerciseCategory = Enums<'exercise_category'>
export type MovementPattern = Enums<'movement_pattern'>
export type MesocycleStatus = 'planned' | 'active' | 'completed' | 'archived'
export type PlannedSessionStatus = 'planned' | 'completed' | 'skipped' | 'in_progress'
export type LiftMaxSource = 'tested' | 'estimated' | 'manual'
