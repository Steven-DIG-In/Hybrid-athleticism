export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      actual_session_exercises: {
        Row: {
          actual_session_id: string
          created_at: string | null
          exercise_id: string
          id: string
          logs: Json
          notes: string | null
        }
        Insert: {
          actual_session_id: string
          created_at?: string | null
          exercise_id: string
          id?: string
          logs?: Json
          notes?: string | null
        }
        Update: {
          actual_session_id?: string
          created_at?: string | null
          exercise_id?: string
          id?: string
          logs?: Json
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actual_session_exercises_actual_session_id_fkey"
            columns: ["actual_session_id"]
            isOneToOne: false
            referencedRelation: "actual_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
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
        Relationships: [
          {
            foreignKeyName: "actual_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_activity: {
        Row: {
          coach: string
          created_at: string
          decision_type: string
          id: string
          mesocycle_id: string | null
          reasoning_structured: Json
          reasoning_text: string
          target_entity: Json
          user_id: string
          week_number: number | null
        }
        Insert: {
          coach: string
          created_at?: string
          decision_type: string
          id?: string
          mesocycle_id?: string | null
          reasoning_structured: Json
          reasoning_text: string
          target_entity: Json
          user_id: string
          week_number?: number | null
        }
        Update: {
          coach?: string
          created_at?: string
          decision_type?: string
          id?: string
          mesocycle_id?: string | null
          reasoning_structured?: Json
          reasoning_text?: string
          target_entity?: Json
          user_id?: string
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_activity_mesocycle_id_fkey"
            columns: ["mesocycle_id"]
            isOneToOne: false
            referencedRelation: "mesocycles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_coach_interventions: {
        Row: {
          coach_domain: string | null
          created_at: string
          exercise_swaps: Json | null
          id: string
          input_payload: Json | null
          microcycle_id: string
          model_used: string | null
          needs_retry: boolean | null
          pattern_signal: Json | null
          presented_to_user: boolean | null
          rationale: string
          raw_response: string | null
          rir_adjustment: number | null
          trigger_type: string
          user_accepted: boolean | null
          user_feedback: string | null
          user_id: string
          user_response: string | null
          volume_adjustments: Json | null
        }
        Insert: {
          coach_domain?: string | null
          created_at?: string
          exercise_swaps?: Json | null
          id?: string
          input_payload?: Json | null
          microcycle_id: string
          model_used?: string | null
          needs_retry?: boolean | null
          pattern_signal?: Json | null
          presented_to_user?: boolean | null
          rationale: string
          raw_response?: string | null
          rir_adjustment?: number | null
          trigger_type: string
          user_accepted?: boolean | null
          user_feedback?: string | null
          user_id: string
          user_response?: string | null
          volume_adjustments?: Json | null
        }
        Update: {
          coach_domain?: string | null
          created_at?: string
          exercise_swaps?: Json | null
          id?: string
          input_payload?: Json | null
          microcycle_id?: string
          model_used?: string | null
          needs_retry?: boolean | null
          pattern_signal?: Json | null
          presented_to_user?: boolean | null
          rationale?: string
          raw_response?: string | null
          rir_adjustment?: number | null
          trigger_type?: string
          user_accepted?: boolean | null
          user_feedback?: string | null
          user_id?: string
          user_response?: string | null
          volume_adjustments?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_coach_interventions_microcycle_id_fkey"
            columns: ["microcycle_id"]
            isOneToOne: false
            referencedRelation: "microcycles"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_benchmarks: {
        Row: {
          benchmark_name: string
          created_at: string
          id: string
          modality: string
          source: Database["public"]["Enums"]["benchmark_source"]
          tested_at: string | null
          unit: string
          user_id: string
          value: number
        }
        Insert: {
          benchmark_name: string
          created_at?: string
          id?: string
          modality: string
          source?: Database["public"]["Enums"]["benchmark_source"]
          tested_at?: string | null
          unit: string
          user_id: string
          value: number
        }
        Update: {
          benchmark_name?: string
          created_at?: string
          id?: string
          modality?: string
          source?: Database["public"]["Enums"]["benchmark_source"]
          tested_at?: string | null
          unit?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      athlete_injuries: {
        Row: {
          body_area: Database["public"]["Enums"]["injury_body_area"]
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          movements_to_avoid: string[] | null
          severity: Database["public"]["Enums"]["injury_severity"]
          updated_at: string
          user_id: string
        }
        Insert: {
          body_area: Database["public"]["Enums"]["injury_body_area"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          movements_to_avoid?: string[] | null
          severity?: Database["public"]["Enums"]["injury_severity"]
          updated_at?: string
          user_id: string
        }
        Update: {
          body_area?: Database["public"]["Enums"]["injury_body_area"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          movements_to_avoid?: string[] | null
          severity?: Database["public"]["Enums"]["injury_severity"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      athlete_self_reports: {
        Row: {
          created_at: string
          energy_level: number
          id: string
          mesocycle_id: string
          motivation: number
          notes: string | null
          sleep_quality: number
          soreness: Json
          stress_level: number
          user_id: string
          week_number: number
        }
        Insert: {
          created_at?: string
          energy_level: number
          id?: string
          mesocycle_id: string
          motivation: number
          notes?: string | null
          sleep_quality: number
          soreness?: Json
          stress_level: number
          user_id: string
          week_number: number
        }
        Update: {
          created_at?: string
          energy_level?: number
          id?: string
          mesocycle_id?: string
          motivation?: number
          notes?: string | null
          sleep_quality?: number
          soreness?: Json
          stress_level?: number
          user_id?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "athlete_self_reports_mesocycle_id_fkey"
            columns: ["mesocycle_id"]
            isOneToOne: false
            referencedRelation: "mesocycles"
            referencedColumns: ["id"]
          },
        ]
      }
      block_pointer: {
        Row: {
          id: string
          mesocycle_id: string
          next_training_day: number
          updated_at: string
          user_id: string
          week_number: number
        }
        Insert: {
          id?: string
          mesocycle_id: string
          next_training_day?: number
          updated_at?: string
          user_id: string
          week_number: number
        }
        Update: {
          id?: string
          mesocycle_id?: string
          next_training_day?: number
          updated_at?: string
          user_id?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "block_pointer_mesocycle_id_fkey"
            columns: ["mesocycle_id"]
            isOneToOne: false
            referencedRelation: "mesocycles"
            referencedColumns: ["id"]
          },
        ]
      }
      body_composition_measurements: {
        Row: {
          body_fat_pct: number | null
          created_at: string | null
          id: string
          lean_mass_kg: number | null
          measured_on: string
          measurements: Json | null
          method: string
          notes: string | null
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          body_fat_pct?: number | null
          created_at?: string | null
          id?: string
          lean_mass_kg?: number | null
          measured_on: string
          measurements?: Json | null
          method: string
          notes?: string | null
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          body_fat_pct?: number | null
          created_at?: string | null
          id?: string
          lean_mass_kg?: number | null
          measured_on?: string
          measurements?: Json | null
          method?: string
          notes?: string | null
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      cardio_logs: {
        Row: {
          avg_heart_rate_bpm: number | null
          avg_pace_sec_per_km: number | null
          calories_burned: number | null
          cardio_type: string
          created_at: string
          device_source: string | null
          distance_km: number | null
          duration_minutes: number
          id: string
          logged_at: string
          max_heart_rate_bpm: number | null
          perceived_effort_rpe: number | null
          raw_data_json: Json | null
          user_id: string
          workout_id: string
        }
        Insert: {
          avg_heart_rate_bpm?: number | null
          avg_pace_sec_per_km?: number | null
          calories_burned?: number | null
          cardio_type?: string
          created_at?: string
          device_source?: string | null
          distance_km?: number | null
          duration_minutes: number
          id?: string
          logged_at?: string
          max_heart_rate_bpm?: number | null
          perceived_effort_rpe?: number | null
          raw_data_json?: Json | null
          user_id: string
          workout_id: string
        }
        Update: {
          avg_heart_rate_bpm?: number | null
          avg_pace_sec_per_km?: number | null
          calories_burned?: number | null
          cardio_type?: string
          created_at?: string
          device_source?: string | null
          distance_km?: number | null
          duration_minutes?: number
          id?: string
          logged_at?: string
          max_heart_rate_bpm?: number | null
          perceived_effort_rpe?: number | null
          raw_data_json?: Json | null
          user_id?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cardio_logs_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      check_in_windows: {
        Row: {
          allocation_start: string
          completed_at: string | null
          created_at: string
          early_completion: boolean
          id: string
          incomplete_week: boolean
          mesocycle_id: string
          missed_sessions: number
          status: string
          total_allocated: number
          total_completed: number
          triggered_at: string | null
          user_id: string
          week_number: number
        }
        Insert: {
          allocation_start: string
          completed_at?: string | null
          created_at?: string
          early_completion?: boolean
          id?: string
          incomplete_week?: boolean
          mesocycle_id: string
          missed_sessions?: number
          status?: string
          total_allocated?: number
          total_completed?: number
          triggered_at?: string | null
          user_id: string
          week_number: number
        }
        Update: {
          allocation_start?: string
          completed_at?: string | null
          created_at?: string
          early_completion?: boolean
          id?: string
          incomplete_week?: boolean
          mesocycle_id?: string
          missed_sessions?: number
          status?: string
          total_allocated?: number
          total_completed?: number
          triggered_at?: string | null
          user_id?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "check_in_windows_mesocycle_id_fkey"
            columns: ["mesocycle_id"]
            isOneToOne: false
            referencedRelation: "mesocycles"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_adjustments: {
        Row: {
          adjustment_type: string
          athlete_confirmed: boolean | null
          auto_applied: boolean | null
          coach_persona_note: string | null
          created_at: string
          id: string
          modified_prescription: Json
          original_prescription: Json
          reason: string
          resolved_at: string | null
          session_inventory_id: string
          status: string | null
          tier: number | null
          triggering_assessment_id: string | null
          user_id: string
          user_response: string | null
        }
        Insert: {
          adjustment_type: string
          athlete_confirmed?: boolean | null
          auto_applied?: boolean | null
          coach_persona_note?: string | null
          created_at?: string
          id?: string
          modified_prescription: Json
          original_prescription: Json
          reason: string
          resolved_at?: string | null
          session_inventory_id: string
          status?: string | null
          tier?: number | null
          triggering_assessment_id?: string | null
          user_id: string
          user_response?: string | null
        }
        Update: {
          adjustment_type?: string
          athlete_confirmed?: boolean | null
          auto_applied?: boolean | null
          coach_persona_note?: string | null
          created_at?: string
          id?: string
          modified_prescription?: Json
          original_prescription?: Json
          reason?: string
          resolved_at?: string | null
          session_inventory_id?: string
          status?: string | null
          tier?: number | null
          triggering_assessment_id?: string | null
          user_id?: string
          user_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coaching_adjustments_session_inventory_id_fkey"
            columns: ["session_inventory_id"]
            isOneToOne: false
            referencedRelation: "session_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_adjustments_triggering_assessment_id_fkey"
            columns: ["triggering_assessment_id"]
            isOneToOne: false
            referencedRelation: "session_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      conditioning_logs: {
        Row: {
          athlete_notes: string | null
          created_at: string
          id: string
          is_rx: boolean
          logged_at: string
          modifications: string | null
          perceived_effort_rpe: number | null
          result_completed: boolean | null
          result_partial_reps: number | null
          result_rounds: number | null
          result_time_seconds: number | null
          user_id: string
          workout_format: string
          workout_id: string
        }
        Insert: {
          athlete_notes?: string | null
          created_at?: string
          id?: string
          is_rx?: boolean
          logged_at?: string
          modifications?: string | null
          perceived_effort_rpe?: number | null
          result_completed?: boolean | null
          result_partial_reps?: number | null
          result_rounds?: number | null
          result_time_seconds?: number | null
          user_id: string
          workout_format?: string
          workout_id: string
        }
        Update: {
          athlete_notes?: string | null
          created_at?: string
          id?: string
          is_rx?: boolean
          logged_at?: string
          modifications?: string | null
          perceived_effort_rpe?: number | null
          result_completed?: boolean | null
          result_partial_reps?: number | null
          result_rounds?: number | null
          result_time_seconds?: number | null
          user_id?: string
          workout_format?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conditioning_logs_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_reports: {
        Row: {
          generated_at: string
          id: string
          pdf_file_path: string | null
          snapshot_json: Json
          user_id: string
          window_end: string
          window_preset: string
          window_start: string
        }
        Insert: {
          generated_at?: string
          id?: string
          pdf_file_path?: string | null
          snapshot_json: Json
          user_id: string
          window_end: string
          window_preset: string
          window_start: string
        }
        Update: {
          generated_at?: string
          id?: string
          pdf_file_path?: string | null
          snapshot_json?: Json
          user_id?: string
          window_end?: string
          window_preset?: string
          window_start?: string
        }
        Relationships: []
      }
      exercise_history: {
        Row: {
          actual_session_id: string
          avg_rir: number | null
          best_reps: number | null
          best_rir: number | null
          best_weight_kg: number | null
          created_at: string | null
          estimated_1rm: number | null
          exercise_id: string
          id: string
          session_date: string
          total_reps: number | null
          total_sets: number | null
          total_volume_kg: number | null
          user_id: string
        }
        Insert: {
          actual_session_id: string
          avg_rir?: number | null
          best_reps?: number | null
          best_rir?: number | null
          best_weight_kg?: number | null
          created_at?: string | null
          estimated_1rm?: number | null
          exercise_id: string
          id?: string
          session_date: string
          total_reps?: number | null
          total_sets?: number | null
          total_volume_kg?: number | null
          user_id: string
        }
        Update: {
          actual_session_id?: string
          avg_rir?: number | null
          best_reps?: number | null
          best_rir?: number | null
          best_weight_kg?: number | null
          created_at?: string | null
          estimated_1rm?: number | null
          exercise_id?: string
          id?: string
          session_date?: string
          total_reps?: number | null
          total_sets?: number | null
          total_volume_kg?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_history_actual_session_id_fkey"
            columns: ["actual_session_id"]
            isOneToOne: false
            referencedRelation: "actual_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_history_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_sets: {
        Row: {
          actual_reps: number | null
          actual_weight_kg: number | null
          created_at: string
          exercise_name: string
          id: string
          is_pr: boolean | null
          logged_at: string | null
          muscle_group: string | null
          notes: string | null
          rir_actual: number | null
          rpe_actual: number | null
          set_number: number
          target_reps: number | null
          target_rir: number | null
          target_weight_kg: number | null
          user_id: string
          workout_id: string
        }
        Insert: {
          actual_reps?: number | null
          actual_weight_kg?: number | null
          created_at?: string
          exercise_name: string
          id?: string
          is_pr?: boolean | null
          logged_at?: string | null
          muscle_group?: string | null
          notes?: string | null
          rir_actual?: number | null
          rpe_actual?: number | null
          set_number: number
          target_reps?: number | null
          target_rir?: number | null
          target_weight_kg?: number | null
          user_id: string
          workout_id: string
        }
        Update: {
          actual_reps?: number | null
          actual_weight_kg?: number | null
          created_at?: string
          exercise_name?: string
          id?: string
          is_pr?: boolean | null
          logged_at?: string | null
          muscle_group?: string | null
          notes?: string | null
          rir_actual?: number | null
          rpe_actual?: number | null
          set_number?: number
          target_reps?: number | null
          target_rir?: number | null
          target_weight_kg?: number | null
          user_id?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_sets_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "exercises_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      external_load_logs: {
        Row: {
          activity_type: string
          created_at: string
          duration_minutes: number | null
          id: string
          logged_at: string
          notes: string | null
          perceived_intensity:
            | Database["public"]["Enums"]["perceived_intensity"]
            | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          logged_at?: string
          notes?: string | null
          perceived_intensity?:
            | Database["public"]["Enums"]["perceived_intensity"]
            | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          logged_at?: string
          notes?: string | null
          perceived_intensity?:
            | Database["public"]["Enums"]["perceived_intensity"]
            | null
          user_id?: string
        }
        Relationships: []
      }
      fatigue_states: {
        Row: {
          body_weight_kg: number | null
          created_at: string | null
          date: string
          energy_level: number | null
          hrv: number | null
          hrv_source: string | null
          id: string
          muscle_fatigue: Json | null
          notes: string | null
          overall_readiness: number | null
          recommended_intensity_modifier: number | null
          resting_hr: number | null
          rucking_fatigue: number | null
          running_fatigue: number | null
          sleep_hours: number | null
          sleep_quality: number | null
          soreness_level: number | null
          strength_fatigue: number | null
          stress_level: number | null
          systemic_fatigue: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body_weight_kg?: number | null
          created_at?: string | null
          date: string
          energy_level?: number | null
          hrv?: number | null
          hrv_source?: string | null
          id?: string
          muscle_fatigue?: Json | null
          notes?: string | null
          overall_readiness?: number | null
          recommended_intensity_modifier?: number | null
          resting_hr?: number | null
          rucking_fatigue?: number | null
          running_fatigue?: number | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          soreness_level?: number | null
          strength_fatigue?: number | null
          stress_level?: number | null
          systemic_fatigue?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body_weight_kg?: number | null
          created_at?: string | null
          date?: string
          energy_level?: number | null
          hrv?: number | null
          hrv_source?: string | null
          id?: string
          muscle_fatigue?: Json | null
          notes?: string | null
          overall_readiness?: number | null
          recommended_intensity_modifier?: number | null
          resting_hr?: number | null
          rucking_fatigue?: number | null
          running_fatigue?: number | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          soreness_level?: number | null
          strength_fatigue?: number | null
          stress_level?: number | null
          systemic_fatigue?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fatigue_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      garmin_activities: {
        Row: {
          activity_name: string | null
          activity_type: string | null
          actual_session_id: string | null
          avg_hr: number | null
          avg_pace_min_km: number | null
          calories: number | null
          distance_meters: number | null
          duration_seconds: number | null
          elevation_gain_m: number | null
          elevation_loss_m: number | null
          garmin_activity_id: string
          id: string
          is_processed: boolean | null
          max_hr: number | null
          raw_data: Json | null
          start_time: string | null
          synced_at: string | null
          user_id: string
        }
        Insert: {
          activity_name?: string | null
          activity_type?: string | null
          actual_session_id?: string | null
          avg_hr?: number | null
          avg_pace_min_km?: number | null
          calories?: number | null
          distance_meters?: number | null
          duration_seconds?: number | null
          elevation_gain_m?: number | null
          elevation_loss_m?: number | null
          garmin_activity_id: string
          id?: string
          is_processed?: boolean | null
          max_hr?: number | null
          raw_data?: Json | null
          start_time?: string | null
          synced_at?: string | null
          user_id: string
        }
        Update: {
          activity_name?: string | null
          activity_type?: string | null
          actual_session_id?: string | null
          avg_hr?: number | null
          avg_pace_min_km?: number | null
          calories?: number | null
          distance_meters?: number | null
          duration_seconds?: number | null
          elevation_gain_m?: number | null
          elevation_loss_m?: number | null
          garmin_activity_id?: string
          id?: string
          is_processed?: boolean | null
          max_hr?: number | null
          raw_data?: Json | null
          start_time?: string | null
          synced_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garmin_activities_actual_session_id_fkey"
            columns: ["actual_session_id"]
            isOneToOne: false
            referencedRelation: "actual_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garmin_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      garmin_credentials: {
        Row: {
          connected_at: string | null
          last_sync_at: string | null
          last_sync_status: string | null
          session_expires_at: string | null
          session_token_encrypted: string | null
          user_id: string
          vault_secret_id_email: string | null
          vault_secret_id_password: string | null
        }
        Insert: {
          connected_at?: string | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          session_expires_at?: string | null
          session_token_encrypted?: string | null
          user_id: string
          vault_secret_id_email?: string | null
          vault_secret_id_password?: string | null
        }
        Update: {
          connected_at?: string | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          session_expires_at?: string | null
          session_token_encrypted?: string | null
          user_id?: string
          vault_secret_id_email?: string | null
          vault_secret_id_password?: string | null
        }
        Relationships: []
      }
      garmin_daily: {
        Row: {
          active_kcal: number | null
          body_battery_end: number | null
          body_battery_max: number | null
          body_battery_min: number | null
          body_battery_start: number | null
          date: string
          hrv_morning_status: string | null
          hrv_overnight_avg: number | null
          resting_hr: number | null
          sleep_awake_min: number | null
          sleep_deep_min: number | null
          sleep_light_min: number | null
          sleep_rem_min: number | null
          sleep_score: number | null
          sleep_total_min: number | null
          steps: number | null
          stress_avg: number | null
          user_id: string
        }
        Insert: {
          active_kcal?: number | null
          body_battery_end?: number | null
          body_battery_max?: number | null
          body_battery_min?: number | null
          body_battery_start?: number | null
          date: string
          hrv_morning_status?: string | null
          hrv_overnight_avg?: number | null
          resting_hr?: number | null
          sleep_awake_min?: number | null
          sleep_deep_min?: number | null
          sleep_light_min?: number | null
          sleep_rem_min?: number | null
          sleep_score?: number | null
          sleep_total_min?: number | null
          steps?: number | null
          stress_avg?: number | null
          user_id: string
        }
        Update: {
          active_kcal?: number | null
          body_battery_end?: number | null
          body_battery_max?: number | null
          body_battery_min?: number | null
          body_battery_start?: number | null
          date?: string
          hrv_morning_status?: string | null
          hrv_overnight_avg?: number | null
          resting_hr?: number | null
          sleep_awake_min?: number | null
          sleep_deep_min?: number | null
          sleep_light_min?: number | null
          sleep_rem_min?: number | null
          sleep_score?: number | null
          sleep_total_min?: number | null
          steps?: number | null
          stress_avg?: number | null
          user_id?: string
        }
        Relationships: []
      }
      garmin_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string | null
          garmin_user_id: string
          id: string
          refresh_token: string | null
          scope: string | null
          token_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at?: string | null
          garmin_user_id: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string | null
          garmin_user_id?: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garmin_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      garmin_vo2_trend: {
        Row: {
          created_at: string | null
          fitness_age: number | null
          id: string
          measured_on: string
          modality: string
          user_id: string
          vo2_max: number
        }
        Insert: {
          created_at?: string | null
          fitness_age?: number | null
          id?: string
          measured_on: string
          modality: string
          user_id: string
          vo2_max: number
        }
        Update: {
          created_at?: string | null
          fitness_age?: number | null
          id?: string
          measured_on?: string
          modality?: string
          user_id?: string
          vo2_max?: number
        }
        Relationships: []
      }
      goals: {
        Row: {
          achieved_at: string | null
          actual_value: number | null
          created_at: string | null
          description: string | null
          event_date: string | null
          event_type: string | null
          id: string
          is_active: boolean | null
          name: string
          primary_domain:
            | Database["public"]["Enums"]["training_domain_type"]
            | null
          target_metric: string | null
          target_unit: string | null
          target_value: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          achieved_at?: string | null
          actual_value?: number | null
          created_at?: string | null
          description?: string | null
          event_date?: string | null
          event_type?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          primary_domain?:
            | Database["public"]["Enums"]["training_domain_type"]
            | null
          target_metric?: string | null
          target_unit?: string | null
          target_value?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          achieved_at?: string | null
          actual_value?: number | null
          created_at?: string | null
          description?: string | null
          event_date?: string | null
          event_type?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          primary_domain?:
            | Database["public"]["Enums"]["training_domain_type"]
            | null
          target_metric?: string | null
          target_unit?: string | null
          target_value?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_markers: {
        Row: {
          confidence: string | null
          id: string
          is_out_of_range: boolean | null
          name_en: string
          name_original: string | null
          notes: string | null
          panel_id: string
          reference_range_high: number | null
          reference_range_low: number | null
          status: string
          unit: string | null
          user_id: string
          value: number | null
        }
        Insert: {
          confidence?: string | null
          id?: string
          is_out_of_range?: boolean | null
          name_en: string
          name_original?: string | null
          notes?: string | null
          panel_id: string
          reference_range_high?: number | null
          reference_range_low?: number | null
          status?: string
          unit?: string | null
          user_id: string
          value?: number | null
        }
        Update: {
          confidence?: string | null
          id?: string
          is_out_of_range?: boolean | null
          name_en?: string
          name_original?: string | null
          notes?: string | null
          panel_id?: string
          reference_range_high?: number | null
          reference_range_low?: number | null
          status?: string
          unit?: string | null
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_markers_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "lab_panels"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_panels: {
        Row: {
          created_at: string | null
          extraction_json: Json | null
          id: string
          lab_name: string | null
          original_file_path: string | null
          out_of_range_count: number | null
          panel_date: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          extraction_json?: Json | null
          id?: string
          lab_name?: string | null
          original_file_path?: string | null
          out_of_range_count?: number | null
          panel_date: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          extraction_json?: Json | null
          id?: string
          lab_name?: string | null
          original_file_path?: string | null
          out_of_range_count?: number | null
          panel_date?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      medical_events: {
        Row: {
          attachment_path: string | null
          created_at: string | null
          details: string | null
          event_date: string
          event_type: string
          id: string
          structured_data: Json | null
          title: string
          user_id: string
        }
        Insert: {
          attachment_path?: string | null
          created_at?: string | null
          details?: string | null
          event_date: string
          event_type: string
          id?: string
          structured_data?: Json | null
          title: string
          user_id: string
        }
        Update: {
          attachment_path?: string | null
          created_at?: string | null
          details?: string | null
          event_date?: string
          event_type?: string
          id?: string
          structured_data?: Json | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      mesocycle_domain_targets: {
        Row: {
          domain_type: Database["public"]["Enums"]["training_domain_type"]
          id: string
          mesocycle_id: string
          priority: Database["public"]["Enums"]["domain_priority"]
          target_config: Json | null
          volume_allocation_percent: number | null
        }
        Insert: {
          domain_type: Database["public"]["Enums"]["training_domain_type"]
          id?: string
          mesocycle_id: string
          priority: Database["public"]["Enums"]["domain_priority"]
          target_config?: Json | null
          volume_allocation_percent?: number | null
        }
        Update: {
          domain_type?: Database["public"]["Enums"]["training_domain_type"]
          id?: string
          mesocycle_id?: string
          priority?: Database["public"]["Enums"]["domain_priority"]
          target_config?: Json | null
          volume_allocation_percent?: number | null
        }
        Relationships: []
      }
      mesocycles: {
        Row: {
          ai_context_json: Json | null
          completed_at: string | null
          conditioning_program: Json | null
          created_at: string
          end_date: string | null
          endurance_program: Json | null
          goal: Database["public"]["Enums"]["mesocycle_goal"]
          hypertrophy_program: Json | null
          id: string
          is_active: boolean
          is_complete: boolean
          mesocycle_strategy: Json | null
          mobility_program: Json | null
          name: string
          start_date: string
          strength_program: Json | null
          updated_at: string
          user_id: string
          week_count: number
        }
        Insert: {
          ai_context_json?: Json | null
          completed_at?: string | null
          conditioning_program?: Json | null
          created_at?: string
          end_date?: string | null
          endurance_program?: Json | null
          goal?: Database["public"]["Enums"]["mesocycle_goal"]
          hypertrophy_program?: Json | null
          id?: string
          is_active?: boolean
          is_complete?: boolean
          mesocycle_strategy?: Json | null
          mobility_program?: Json | null
          name: string
          start_date: string
          strength_program?: Json | null
          updated_at?: string
          user_id: string
          week_count?: number
        }
        Update: {
          ai_context_json?: Json | null
          completed_at?: string | null
          conditioning_program?: Json | null
          created_at?: string
          end_date?: string | null
          endurance_program?: Json | null
          goal?: Database["public"]["Enums"]["mesocycle_goal"]
          hypertrophy_program?: Json | null
          id?: string
          is_active?: boolean
          is_complete?: boolean
          mesocycle_strategy?: Json | null
          mobility_program?: Json | null
          name?: string
          start_date?: string
          strength_program?: Json | null
          updated_at?: string
          user_id?: string
          week_count?: number
        }
        Relationships: []
      }
      microcycles: {
        Row: {
          adjustment_directive: Json | null
          created_at: string
          end_date: string
          id: string
          is_deload: boolean
          mesocycle_id: string
          recovery_assessment: Json | null
          recovery_status: string | null
          review_summary: string | null
          reviewed_at: string | null
          start_date: string
          target_rir: number | null
          updated_at: string
          user_id: string
          week_number: number
        }
        Insert: {
          adjustment_directive?: Json | null
          created_at?: string
          end_date: string
          id?: string
          is_deload?: boolean
          mesocycle_id: string
          recovery_assessment?: Json | null
          recovery_status?: string | null
          review_summary?: string | null
          reviewed_at?: string | null
          start_date: string
          target_rir?: number | null
          updated_at?: string
          user_id: string
          week_number: number
        }
        Update: {
          adjustment_directive?: Json | null
          created_at?: string
          end_date?: string
          id?: string
          is_deload?: boolean
          mesocycle_id?: string
          recovery_assessment?: Json | null
          recovery_status?: string | null
          review_summary?: string | null
          reviewed_at?: string | null
          start_date?: string
          target_rir?: number | null
          updated_at?: string
          user_id?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "microcycles_mesocycle_id_fkey"
            columns: ["mesocycle_id"]
            isOneToOne: false
            referencedRelation: "mesocycles"
            referencedColumns: ["id"]
          },
        ]
      }
      muscle_group_config: {
        Row: {
          created_at: string | null
          id: string
          mav: number | null
          mev: number | null
          mrv: number | null
          muscle_group: string
          mv: number | null
          preferred_frequency: number | null
          priority: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mav?: number | null
          mev?: number | null
          mrv?: number | null
          muscle_group: string
          mv?: number | null
          preferred_frequency?: number | null
          priority?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mav?: number | null
          mev?: number | null
          mrv?: number | null
          muscle_group?: string
          mv?: number | null
          preferred_frequency?: number | null
          priority?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "muscle_group_config_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      off_plan_sessions: {
        Row: {
          count_toward_load: boolean
          duration_minutes: number
          id: string
          linked_domain: string | null
          logged_at: string
          modality: string
          notes: string | null
          rpe: number | null
          user_id: string
        }
        Insert: {
          count_toward_load?: boolean
          duration_minutes: number
          id?: string
          linked_domain?: string | null
          logged_at?: string
          modality: string
          notes?: string | null
          rpe?: number | null
          user_id: string
        }
        Update: {
          count_toward_load?: boolean
          duration_minutes?: number
          id?: string
          linked_domain?: string | null
          logged_at?: string
          modality?: string
          notes?: string | null
          rpe?: number | null
          user_id?: string
        }
        Relationships: []
      }
      performance_deltas: {
        Row: {
          actual_reps: number | null
          actual_rpe: number | null
          actual_weight: number | null
          created_at: string
          delta_classification: string
          exercise_name: string
          id: string
          prescribed_reps: number | null
          prescribed_rpe: number | null
          prescribed_weight: number | null
          session_inventory_id: string
          user_id: string
        }
        Insert: {
          actual_reps?: number | null
          actual_rpe?: number | null
          actual_weight?: number | null
          created_at?: string
          delta_classification: string
          exercise_name: string
          id?: string
          prescribed_reps?: number | null
          prescribed_rpe?: number | null
          prescribed_weight?: number | null
          session_inventory_id: string
          user_id: string
        }
        Update: {
          actual_reps?: number | null
          actual_rpe?: number | null
          actual_weight?: number | null
          created_at?: string
          delta_classification?: string
          exercise_name?: string
          id?: string
          prescribed_reps?: number | null
          prescribed_rpe?: number | null
          prescribed_weight?: number | null
          session_inventory_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_deltas_session_inventory_id_fkey"
            columns: ["session_inventory_id"]
            isOneToOne: false
            referencedRelation: "session_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number | null
          available_days: number | null
          avatar_url: string | null
          benchmark_discovery_status:
            | Database["public"]["Enums"]["benchmark_discovery_status"]
            | null
          benchmark_week_complete: boolean | null
          body_comp_goal: Database["public"]["Enums"]["body_comp_goal"] | null
          body_fat_percentage: number | null
          bodyweight_kg: number | null
          coaching_team: Json | null
          conditioning_experience:
            | Database["public"]["Enums"]["experience_level"]
            | null
          conditioning_style_preferences: string[] | null
          created_at: string
          cycling_experience:
            | Database["public"]["Enums"]["experience_level"]
            | null
          display_name: string | null
          display_weights_as_percentages: boolean | null
          endurance_methodology:
            | Database["public"]["Enums"]["methodology_preference"]
            | null
          endurance_modality_preferences: string[] | null
          equipment_access:
            | Database["public"]["Enums"]["equipment_type"][]
            | null
          equipment_list: string[] | null
          equipment_usage_intents: Json | null
          goal_archetype: Database["public"]["Enums"]["goal_archetype"] | null
          has_injuries: boolean | null
          height_cm: number | null
          hypertrophy_methodology:
            | Database["public"]["Enums"]["methodology_preference"]
            | null
          id: string
          lifting_experience:
            | Database["public"]["Enums"]["experience_level"]
            | null
          movements_to_avoid: string[] | null
          onboarding_completed_at: string | null
          onboarding_path: Database["public"]["Enums"]["onboarding_path"] | null
          preferred_block_duration: number | null
          primary_goal: Database["public"]["Enums"]["mesocycle_goal"] | null
          primary_training_environment:
            | Database["public"]["Enums"]["training_environment"]
            | null
          rowing_experience:
            | Database["public"]["Enums"]["experience_level"]
            | null
          rucking_experience:
            | Database["public"]["Enums"]["experience_level"]
            | null
          running_experience:
            | Database["public"]["Enums"]["experience_level"]
            | null
          session_duration_minutes: number | null
          sex: string | null
          strength_methodology:
            | Database["public"]["Enums"]["methodology_preference"]
            | null
          stress_level: Database["public"]["Enums"]["stress_level"] | null
          swimming_experience:
            | Database["public"]["Enums"]["experience_level"]
            | null
          time_of_day:
            | Database["public"]["Enums"]["time_of_day_preference"]
            | null
          training_age_years: number | null
          training_maxes: Json
          transparency:
            | Database["public"]["Enums"]["transparency_preference"]
            | null
          travel_frequency:
            | Database["public"]["Enums"]["travel_frequency"]
            | null
          two_a_day: Database["public"]["Enums"]["two_a_day_willingness"] | null
          unit_preference: string | null
          updated_at: string
          work_type: Database["public"]["Enums"]["work_type"] | null
        }
        Insert: {
          age?: number | null
          available_days?: number | null
          avatar_url?: string | null
          benchmark_discovery_status?:
            | Database["public"]["Enums"]["benchmark_discovery_status"]
            | null
          benchmark_week_complete?: boolean | null
          body_comp_goal?: Database["public"]["Enums"]["body_comp_goal"] | null
          body_fat_percentage?: number | null
          bodyweight_kg?: number | null
          coaching_team?: Json | null
          conditioning_experience?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          conditioning_style_preferences?: string[] | null
          created_at?: string
          cycling_experience?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          display_name?: string | null
          display_weights_as_percentages?: boolean | null
          endurance_methodology?:
            | Database["public"]["Enums"]["methodology_preference"]
            | null
          endurance_modality_preferences?: string[] | null
          equipment_access?:
            | Database["public"]["Enums"]["equipment_type"][]
            | null
          equipment_list?: string[] | null
          equipment_usage_intents?: Json | null
          goal_archetype?: Database["public"]["Enums"]["goal_archetype"] | null
          has_injuries?: boolean | null
          height_cm?: number | null
          hypertrophy_methodology?:
            | Database["public"]["Enums"]["methodology_preference"]
            | null
          id: string
          lifting_experience?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          movements_to_avoid?: string[] | null
          onboarding_completed_at?: string | null
          onboarding_path?:
            | Database["public"]["Enums"]["onboarding_path"]
            | null
          preferred_block_duration?: number | null
          primary_goal?: Database["public"]["Enums"]["mesocycle_goal"] | null
          primary_training_environment?:
            | Database["public"]["Enums"]["training_environment"]
            | null
          rowing_experience?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          rucking_experience?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          running_experience?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          session_duration_minutes?: number | null
          sex?: string | null
          strength_methodology?:
            | Database["public"]["Enums"]["methodology_preference"]
            | null
          stress_level?: Database["public"]["Enums"]["stress_level"] | null
          swimming_experience?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          time_of_day?:
            | Database["public"]["Enums"]["time_of_day_preference"]
            | null
          training_age_years?: number | null
          training_maxes?: Json
          transparency?:
            | Database["public"]["Enums"]["transparency_preference"]
            | null
          travel_frequency?:
            | Database["public"]["Enums"]["travel_frequency"]
            | null
          two_a_day?:
            | Database["public"]["Enums"]["two_a_day_willingness"]
            | null
          unit_preference?: string | null
          updated_at?: string
          work_type?: Database["public"]["Enums"]["work_type"] | null
        }
        Update: {
          age?: number | null
          available_days?: number | null
          avatar_url?: string | null
          benchmark_discovery_status?:
            | Database["public"]["Enums"]["benchmark_discovery_status"]
            | null
          benchmark_week_complete?: boolean | null
          body_comp_goal?: Database["public"]["Enums"]["body_comp_goal"] | null
          body_fat_percentage?: number | null
          bodyweight_kg?: number | null
          coaching_team?: Json | null
          conditioning_experience?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          conditioning_style_preferences?: string[] | null
          created_at?: string
          cycling_experience?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          display_name?: string | null
          display_weights_as_percentages?: boolean | null
          endurance_methodology?:
            | Database["public"]["Enums"]["methodology_preference"]
            | null
          endurance_modality_preferences?: string[] | null
          equipment_access?:
            | Database["public"]["Enums"]["equipment_type"][]
            | null
          equipment_list?: string[] | null
          equipment_usage_intents?: Json | null
          goal_archetype?: Database["public"]["Enums"]["goal_archetype"] | null
          has_injuries?: boolean | null
          height_cm?: number | null
          hypertrophy_methodology?:
            | Database["public"]["Enums"]["methodology_preference"]
            | null
          id?: string
          lifting_experience?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          movements_to_avoid?: string[] | null
          onboarding_completed_at?: string | null
          onboarding_path?:
            | Database["public"]["Enums"]["onboarding_path"]
            | null
          preferred_block_duration?: number | null
          primary_goal?: Database["public"]["Enums"]["mesocycle_goal"] | null
          primary_training_environment?:
            | Database["public"]["Enums"]["training_environment"]
            | null
          rowing_experience?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          rucking_experience?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          running_experience?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          session_duration_minutes?: number | null
          sex?: string | null
          strength_methodology?:
            | Database["public"]["Enums"]["methodology_preference"]
            | null
          stress_level?: Database["public"]["Enums"]["stress_level"] | null
          swimming_experience?:
            | Database["public"]["Enums"]["experience_level"]
            | null
          time_of_day?:
            | Database["public"]["Enums"]["time_of_day_preference"]
            | null
          training_age_years?: number | null
          training_maxes?: Json
          transparency?:
            | Database["public"]["Enums"]["transparency_preference"]
            | null
          travel_frequency?:
            | Database["public"]["Enums"]["travel_frequency"]
            | null
          two_a_day?:
            | Database["public"]["Enums"]["two_a_day_willingness"]
            | null
          unit_preference?: string | null
          updated_at?: string
          work_type?: Database["public"]["Enums"]["work_type"] | null
        }
        Relationships: []
      }
      recent_training_activity: {
        Row: {
          approximate_volume: string | null
          captured_at: string
          frequency_per_week: number
          id: string
          modality: string
          user_id: string
        }
        Insert: {
          approximate_volume?: string | null
          captured_at?: string
          frequency_per_week: number
          id?: string
          modality: string
          user_id: string
        }
        Update: {
          approximate_volume?: string | null
          captured_at?: string
          frequency_per_week?: number
          id?: string
          modality?: string
          user_id?: string
        }
        Relationships: []
      }
      rucking_logs: {
        Row: {
          avg_heart_rate_bpm: number | null
          avg_pace_sec_per_km: number | null
          created_at: string
          distance_km: number
          duration_minutes: number
          elevation_gain_m: number | null
          fatigue_flag: boolean | null
          id: string
          logged_at: string
          notes: string | null
          pack_weight_lbs: number
          perceived_effort_rpe: number | null
          terrain: string | null
          total_load_index: number | null
          user_id: string
          workout_id: string
        }
        Insert: {
          avg_heart_rate_bpm?: number | null
          avg_pace_sec_per_km?: number | null
          created_at?: string
          distance_km: number
          duration_minutes: number
          elevation_gain_m?: number | null
          fatigue_flag?: boolean | null
          id?: string
          logged_at?: string
          notes?: string | null
          pack_weight_lbs: number
          perceived_effort_rpe?: number | null
          terrain?: string | null
          total_load_index?: number | null
          user_id: string
          workout_id: string
        }
        Update: {
          avg_heart_rate_bpm?: number | null
          avg_pace_sec_per_km?: number | null
          created_at?: string
          distance_km?: number
          duration_minutes?: number
          elevation_gain_m?: number | null
          fatigue_flag?: boolean | null
          id?: string
          logged_at?: string
          notes?: string | null
          pack_weight_lbs?: number
          perceived_effort_rpe?: number | null
          terrain?: string | null
          total_load_index?: number | null
          user_id?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rucking_logs_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      session_assessments: {
        Row: {
          adjustment_recommended: Json | null
          assessed_at: string
          athlete_notes: string | null
          carry_over_notes: string | null
          energy_level: string | null
          had_pain: boolean | null
          id: string
          overall_feeling: string | null
          pain_details: string | null
          performance_summary: string | null
          user_id: string
          workout_id: string
        }
        Insert: {
          adjustment_recommended?: Json | null
          assessed_at?: string
          athlete_notes?: string | null
          carry_over_notes?: string | null
          energy_level?: string | null
          had_pain?: boolean | null
          id?: string
          overall_feeling?: string | null
          pain_details?: string | null
          performance_summary?: string | null
          user_id: string
          workout_id: string
        }
        Update: {
          adjustment_recommended?: Json | null
          assessed_at?: string
          athlete_notes?: string | null
          carry_over_notes?: string | null
          energy_level?: string | null
          had_pain?: boolean | null
          id?: string
          overall_feeling?: string | null
          pain_details?: string | null
          performance_summary?: string | null
          user_id?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_assessments_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: true
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      session_inventory: {
        Row: {
          adjustment_pending: Json | null
          carry_over_notes: string | null
          check_in_window_id: string | null
          coach_notes: string | null
          completed_at: string | null
          created_at: string
          estimated_duration_minutes: number | null
          id: string
          is_approved: boolean | null
          load_budget: number | null
          mesocycle_id: string
          modality: string
          name: string
          scheduled_date: string | null
          session_priority: number | null
          session_slot: number | null
          status: Database["public"]["Enums"]["session_inventory_status"]
          training_day: number | null
          updated_at: string
          user_id: string
          week_number: number
        }
        Insert: {
          adjustment_pending?: Json | null
          carry_over_notes?: string | null
          check_in_window_id?: string | null
          coach_notes?: string | null
          completed_at?: string | null
          created_at?: string
          estimated_duration_minutes?: number | null
          id?: string
          is_approved?: boolean | null
          load_budget?: number | null
          mesocycle_id: string
          modality: string
          name: string
          scheduled_date?: string | null
          session_priority?: number | null
          session_slot?: number | null
          status?: Database["public"]["Enums"]["session_inventory_status"]
          training_day?: number | null
          updated_at?: string
          user_id: string
          week_number: number
        }
        Update: {
          adjustment_pending?: Json | null
          carry_over_notes?: string | null
          check_in_window_id?: string | null
          coach_notes?: string | null
          completed_at?: string | null
          created_at?: string
          estimated_duration_minutes?: number | null
          id?: string
          is_approved?: boolean | null
          load_budget?: number | null
          mesocycle_id?: string
          modality?: string
          name?: string
          scheduled_date?: string | null
          session_priority?: number | null
          session_slot?: number | null
          status?: Database["public"]["Enums"]["session_inventory_status"]
          training_day?: number | null
          updated_at?: string
          user_id?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_inventory_check_in_window_id_fkey"
            columns: ["check_in_window_id"]
            isOneToOne: false
            referencedRelation: "check_in_windows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_inventory_mesocycle_id_fkey"
            columns: ["mesocycle_id"]
            isOneToOne: false
            referencedRelation: "mesocycles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "set_logs_actual_session_id_fkey"
            columns: ["actual_session_id"]
            isOneToOne: false
            referencedRelation: "actual_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_execution_log: {
        Row: {
          applied: boolean
          created_at: string
          error: string | null
          id: string
          input_hash: string
          input_snapshot: Json
          output_snapshot: Json
          skill_name: string
          user_id: string
        }
        Insert: {
          applied?: boolean
          created_at?: string
          error?: string | null
          id?: string
          input_hash: string
          input_snapshot: Json
          output_snapshot: Json
          skill_name: string
          user_id: string
        }
        Update: {
          applied?: boolean
          created_at?: string
          error?: string | null
          id?: string
          input_hash?: string
          input_snapshot?: Json
          output_snapshot?: Json
          skill_name?: string
          user_id?: string
        }
        Relationships: []
      }
      supplements: {
        Row: {
          created_at: string | null
          dose: number | null
          dose_unit: string | null
          end_date: string | null
          id: string
          name: string
          notes: string | null
          start_date: string
          timing: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dose?: number | null
          dose_unit?: string | null
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          start_date: string
          timing?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          dose?: number | null
          dose_unit?: string | null
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          start_date?: string
          timing?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      training_constraints: {
        Row: {
          created_at: string
          id: string
          mesocycle_id: string
          min_rest_between_heavy_sessions_hours: number | null
          no_heavy_legs_before_run: boolean | null
          prefer_am_or_pm: string | null
          preferred_start_date: string | null
          sessions_per_week: number | null
          unavailable_days: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mesocycle_id: string
          min_rest_between_heavy_sessions_hours?: number | null
          no_heavy_legs_before_run?: boolean | null
          prefer_am_or_pm?: string | null
          preferred_start_date?: string | null
          sessions_per_week?: number | null
          unavailable_days?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mesocycle_id?: string
          min_rest_between_heavy_sessions_hours?: number | null
          no_heavy_legs_before_run?: boolean | null
          prefer_am_or_pm?: string | null
          preferred_start_date?: string | null
          sessions_per_week?: number | null
          unavailable_days?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_constraints_mesocycle_id_fkey"
            columns: ["mesocycle_id"]
            isOneToOne: false
            referencedRelation: "mesocycles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_domains: {
        Row: {
          config: Json | null
          created_at: string | null
          current_weekly_volume: number | null
          domain_type: Database["public"]["Enums"]["training_domain_type"]
          fatigue_score: number | null
          id: string
          mav: number | null
          mev: number | null
          mrv: number | null
          mv: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          current_weekly_volume?: number | null
          domain_type: Database["public"]["Enums"]["training_domain_type"]
          fatigue_score?: number | null
          id?: string
          mav?: number | null
          mev?: number | null
          mrv?: number | null
          mv?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          current_weekly_volume?: number | null
          domain_type?: Database["public"]["Enums"]["training_domain_type"]
          fatigue_score?: number | null
          id?: string
          mav?: number | null
          mev?: number | null
          mrv?: number | null
          mv?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_domains_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      workouts: {
        Row: {
          actual_duration_minutes: number | null
          coach_notes: string | null
          completed_at: string | null
          completed_date: string | null
          created_at: string
          id: string
          is_allocated: boolean
          is_completed: boolean
          microcycle_id: string
          modality: Database["public"]["Enums"]["workout_modality"]
          name: string
          scheduled_date: string
          session_inventory_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_duration_minutes?: number | null
          coach_notes?: string | null
          completed_at?: string | null
          completed_date?: string | null
          created_at?: string
          id?: string
          is_allocated?: boolean
          is_completed?: boolean
          microcycle_id: string
          modality: Database["public"]["Enums"]["workout_modality"]
          name: string
          scheduled_date: string
          session_inventory_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_duration_minutes?: number | null
          coach_notes?: string | null
          completed_at?: string | null
          completed_date?: string | null
          created_at?: string
          id?: string
          is_allocated?: boolean
          is_completed?: boolean
          microcycle_id?: string
          modality?: Database["public"]["Enums"]["workout_modality"]
          name?: string
          scheduled_date?: string
          session_inventory_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_microcycle_id_fkey"
            columns: ["microcycle_id"]
            isOneToOne: false
            referencedRelation: "microcycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workouts_session_inventory_id_fkey"
            columns: ["session_inventory_id"]
            isOneToOne: false
            referencedRelation: "session_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      exercise_progression: {
        Row: {
          best_reps: number | null
          best_weight_kg: number | null
          e1rm_delta: number | null
          estimated_1rm: number | null
          exercise_id: string | null
          exercise_name: string | null
          prev_e1rm: number | null
          session_date: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_history_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_volume_summary: {
        Row: {
          avg_rpe: number | null
          cardio_km: number | null
          domain: Database["public"]["Enums"]["training_domain_type"] | null
          session_count: number | null
          strength_sets: number | null
          user_id: string | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actual_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_e1rm: {
        Args: { reps: number; rir?: number; weight: number }
        Returns: number
      }
      disconnect_garmin: { Args: never; Returns: undefined }
      read_secret: { Args: { secret_id: string }; Returns: string }
      store_garmin_credentials: {
        Args: { p_email: string; p_password: string }
        Returns: undefined
      }
    }
    Enums: {
      benchmark_discovery_status: "pending" | "in_progress" | "complete"
      benchmark_source: "self_reported" | "tested" | "estimated"
      body_comp_goal:
        | "gain_muscle"
        | "lose_fat"
        | "recomp"
        | "maintain"
        | "no_preference"
      domain_priority: "primary" | "secondary" | "maintenance"
      equipment_type:
        | "FULL_GYM"
        | "BARBELL_RACK"
        | "DUMBBELLS_ONLY"
        | "CABLES_MACHINES"
        | "BODYWEIGHT_ONLY"
        | "TRAVEL_MINIMAL"
        | "KETTLEBELLS"
      equipment_usage_intent: "endurance" | "conditioning" | "both"
      exercise_category:
        | "compound"
        | "isolation"
        | "machine"
        | "bodyweight"
        | "cable"
      experience_level: "beginner" | "intermediate" | "advanced"
      fatigue_level: "low" | "medium" | "high"
      form_rating: "poor" | "ok" | "good" | "excellent"
      goal_archetype:
        | "hybrid_fitness"
        | "strength_focus"
        | "endurance_focus"
        | "conditioning_focus"
        | "longevity"
      injury_body_area:
        | "shoulder"
        | "lower_back"
        | "knee"
        | "hip"
        | "ankle"
        | "wrist"
        | "elbow"
        | "neck"
        | "other"
      injury_severity: "minor" | "moderate" | "significant"
      intensity_level: "easy" | "moderate" | "hard" | "very_hard"
      mesocycle_goal:
        | "HYPERTROPHY"
        | "STRENGTH"
        | "ENDURANCE"
        | "HYBRID_PEAKING"
      mesocycle_phase:
        | "base"
        | "build"
        | "peak"
        | "taper"
        | "deload"
        | "maintenance"
      methodology_preference:
        | "ai_decides"
        | "linear_progression"
        | "531"
        | "percentage_based"
        | "conjugate"
        | "rp_volume"
        | "high_frequency"
        | "traditional_split"
        | "polarized_80_20"
        | "maf_aerobic"
        | "daniels_formula"
        | "hybrid_mixed"
        | "other"
      movement_pattern:
        | "push"
        | "pull"
        | "squat"
        | "hinge"
        | "lunge"
        | "carry"
        | "rotation"
        | "core"
      onboarding_path: "quick" | "deep"
      perceived_intensity: "low" | "moderate" | "high" | "very_high"
      running_workout_type:
        | "easy"
        | "tempo"
        | "intervals"
        | "long_run"
        | "recovery"
        | "fartlek"
        | "hills"
        | "race"
      session_inventory_status:
        | "pending"
        | "active"
        | "completed"
        | "missed"
        | "off_plan"
      session_source: "manual" | "garmin_sync" | "garmin_push"
      session_status: "planned" | "completed" | "skipped" | "modified"
      set_type: "warmup" | "working" | "backoff" | "dropset" | "failure"
      stress_level: "low" | "moderate" | "high" | "variable"
      time_of_day_preference:
        | "morning"
        | "midday"
        | "evening"
        | "no_preference"
        | "varies"
      training_domain_type: "strength" | "rucking" | "cardio"
      training_environment:
        | "commercial_gym"
        | "home_gym"
        | "outdoor_minimal"
        | "mix"
      training_level: "beginner" | "intermediate" | "advanced" | "elite"
      transparency_preference: "minimal" | "detailed"
      travel_frequency: "rarely" | "monthly" | "weekly"
      two_a_day_willingness: "yes" | "sometimes" | "no"
      work_type: "desk" | "active" | "physical_labor" | "mixed"
      workout_modality: "LIFTING" | "CARDIO" | "RUCKING" | "METCON" | "MOBILITY"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      benchmark_discovery_status: ["pending", "in_progress", "complete"],
      benchmark_source: ["self_reported", "tested", "estimated"],
      body_comp_goal: [
        "gain_muscle",
        "lose_fat",
        "recomp",
        "maintain",
        "no_preference",
      ],
      domain_priority: ["primary", "secondary", "maintenance"],
      equipment_type: [
        "FULL_GYM",
        "BARBELL_RACK",
        "DUMBBELLS_ONLY",
        "CABLES_MACHINES",
        "BODYWEIGHT_ONLY",
        "TRAVEL_MINIMAL",
        "KETTLEBELLS",
      ],
      equipment_usage_intent: ["endurance", "conditioning", "both"],
      exercise_category: [
        "compound",
        "isolation",
        "machine",
        "bodyweight",
        "cable",
      ],
      experience_level: ["beginner", "intermediate", "advanced"],
      fatigue_level: ["low", "medium", "high"],
      form_rating: ["poor", "ok", "good", "excellent"],
      goal_archetype: [
        "hybrid_fitness",
        "strength_focus",
        "endurance_focus",
        "conditioning_focus",
        "longevity",
      ],
      injury_body_area: [
        "shoulder",
        "lower_back",
        "knee",
        "hip",
        "ankle",
        "wrist",
        "elbow",
        "neck",
        "other",
      ],
      injury_severity: ["minor", "moderate", "significant"],
      intensity_level: ["easy", "moderate", "hard", "very_hard"],
      mesocycle_goal: [
        "HYPERTROPHY",
        "STRENGTH",
        "ENDURANCE",
        "HYBRID_PEAKING",
      ],
      mesocycle_phase: [
        "base",
        "build",
        "peak",
        "taper",
        "deload",
        "maintenance",
      ],
      methodology_preference: [
        "ai_decides",
        "linear_progression",
        "531",
        "percentage_based",
        "conjugate",
        "rp_volume",
        "high_frequency",
        "traditional_split",
        "polarized_80_20",
        "maf_aerobic",
        "daniels_formula",
        "hybrid_mixed",
        "other",
      ],
      movement_pattern: [
        "push",
        "pull",
        "squat",
        "hinge",
        "lunge",
        "carry",
        "rotation",
        "core",
      ],
      onboarding_path: ["quick", "deep"],
      perceived_intensity: ["low", "moderate", "high", "very_high"],
      running_workout_type: [
        "easy",
        "tempo",
        "intervals",
        "long_run",
        "recovery",
        "fartlek",
        "hills",
        "race",
      ],
      session_inventory_status: [
        "pending",
        "active",
        "completed",
        "missed",
        "off_plan",
      ],
      session_source: ["manual", "garmin_sync", "garmin_push"],
      session_status: ["planned", "completed", "skipped", "modified"],
      set_type: ["warmup", "working", "backoff", "dropset", "failure"],
      stress_level: ["low", "moderate", "high", "variable"],
      time_of_day_preference: [
        "morning",
        "midday",
        "evening",
        "no_preference",
        "varies",
      ],
      training_domain_type: ["strength", "rucking", "cardio"],
      training_environment: [
        "commercial_gym",
        "home_gym",
        "outdoor_minimal",
        "mix",
      ],
      training_level: ["beginner", "intermediate", "advanced", "elite"],
      transparency_preference: ["minimal", "detailed"],
      travel_frequency: ["rarely", "monthly", "weekly"],
      two_a_day_willingness: ["yes", "sometimes", "no"],
      work_type: ["desk", "active", "physical_labor", "mixed"],
      workout_modality: ["LIFTING", "CARDIO", "RUCKING", "METCON", "MOBILITY"],
    },
  },
} as const

/**
 * Profile — hand-written to match production call-site assumptions.
 * Regenerated Supabase types make many fields nullable by default, but the
 * production code treats onboarding-required fields as non-nullable. Keep in
 * sync with the schema when onboarding or coach logic changes.
 */
export interface Profile {
    id: string
    display_name: string | null
    avatar_url: string | null
    display_weights_as_percentages: boolean | null

    training_age_years: number | null
    sex: 'MALE' | 'FEMALE' | string | null
    primary_goal: MesocycleGoal
    equipment_access: EquipmentType[]
    available_days: number
    bodyweight_kg: number | null
    benchmark_week_complete: boolean

    onboarding_path: OnboardingPath | null
    age: number | null
    height_cm: number | null
    unit_preference: string

    lifting_experience: ExperienceLevel | null
    running_experience: ExperienceLevel | null
    rucking_experience: ExperienceLevel | null
    rowing_experience: ExperienceLevel | null
    swimming_experience: ExperienceLevel | null
    cycling_experience: ExperienceLevel | null
    conditioning_experience: ExperienceLevel | null

    primary_training_environment: TrainingEnvironment | null
    equipment_list: string[]
    equipment_usage_intents: Record<string, EquipmentUsageIntent>

    endurance_modality_preferences: string[]
    conditioning_style_preferences: string[]

    session_duration_minutes: number
    two_a_day: TwoADayWillingness
    time_of_day: TimeOfDayPreference

    work_type: WorkType | null
    stress_level: StressLevel | null
    travel_frequency: TravelFrequency | null

    goal_archetype: GoalArchetype | null

    strength_methodology: MethodologyPreference
    hypertrophy_methodology: MethodologyPreference
    endurance_methodology: MethodologyPreference
    transparency: TransparencyPreference

    body_fat_percentage: number | null
    body_comp_goal: BodyCompGoal | null

    onboarding_completed_at: string | null
    benchmark_discovery_status: BenchmarkDiscoveryStatus

    has_injuries: boolean
    movements_to_avoid: string[]

    coaching_team: Array<{ coach: string; priority: number }>

    // Phase 2.5 (A+): persisted training maxes per exercise
    training_maxes: Record<string, {
        trainingMaxKg: number
        updatedAt: string
        source: 'onboarding' | 'recalibration' | 'intervention_response'
    }> | null

    preferred_block_duration: number | null

    created_at: string
    updated_at: string
}
export type AthleteInjury = Tables<'athlete_injuries'>
export type AthleteBenchmark = Tables<'athlete_benchmarks'>
export type RecentTrainingActivity = Tables<'recent_training_activity'>
export type Mesocycle = Tables<'mesocycles'>
export type Microcycle = Tables<'microcycles'>
export type Workout = Tables<'workouts'>
export type ExerciseSet = Tables<'exercise_sets'>
export type CardioLog = Tables<'cardio_logs'>
export type RuckingLog = Tables<'rucking_logs'>
export type ConditioningLog = Tables<'conditioning_logs'>
/**
 * AICoachIntervention — hand-written to narrow JSONB columns.
 * `Tables<'ai_coach_interventions'>` types `exercise_swaps` / `volume_adjustments`
 * as generic `Json`, which breaks consumers that expect structured arrays/maps.
 * Keep this in sync with the table schema when columns change.
 */
export interface AICoachIntervention {
    id: string
    microcycle_id: string
    user_id: string
    trigger_type: string
    rationale: string
    volume_adjustments: Record<string, number> | null
    exercise_swaps: Array<{ from: string; to: string; reason: string }> | null
    rir_adjustment: number | null
    model_used: string | null
    input_payload: Record<string, unknown> | null
    raw_response: string | null
    presented_to_user: boolean | null
    user_accepted: boolean | null
    user_feedback: string | null
    created_at: string
    // Migration 016 additive columns (pattern-based interventions)
    coach_domain: string | null
    pattern_signal: Record<string, unknown> | null
    user_response: string | null
    needs_retry: boolean | null
}

export type TwoADayWillingness = Enums<'two_a_day_willingness'>
export type WorkoutModality = Enums<'workout_modality'>
export type ExperienceLevel = Enums<'experience_level'>
export type TrainingEnvironment = Enums<'training_environment'>
export type GoalArchetype = Enums<'goal_archetype'>
export type InjuryBodyArea = Enums<'injury_body_area'>
export type InjurySeverity = Enums<'injury_severity'>
export type WorkType = Enums<'work_type'>
export type StressLevel = Enums<'stress_level'>
export type TravelFrequency = Enums<'travel_frequency'>
export type TimeOfDayPreference = Enums<'time_of_day_preference'>
export type MethodologyPreference = Enums<'methodology_preference'>
export type TransparencyPreference = Enums<'transparency_preference'>
export type BodyCompGoal = Enums<'body_comp_goal'>
export type EquipmentUsageIntent = Enums<'equipment_usage_intent'>
export type EquipmentType = Enums<'equipment_type'>
export type MesocycleGoal = Enums<'mesocycle_goal'>
export type OnboardingPath = Enums<'onboarding_path'>
export type BenchmarkDiscoveryStatus = Enums<'benchmark_discovery_status'>
export type BenchmarkSource = Enums<'benchmark_source'>
export type PerceivedIntensity = Enums<'perceived_intensity'>

