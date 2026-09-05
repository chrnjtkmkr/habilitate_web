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
      activities: {
        Row: {
          center_id: string | null
          clinical_reference: string | null
          created_at: string
          created_by: string | null
          developmental_domain: Database["public"]["Enums"]["activity_domain"]
          diagnostic_profile_applicability: Database["public"]["Enums"]["diagnostic_profile"][]
          duration_minutes: number
          framework_citation: string | null
          framework_source: Database["public"]["Enums"]["framework_source"]
          goal_one_line: string | null
          goal_one_line_hi: string | null
          how_this_helps: string | null
          how_this_helps_hi: string | null
          id: string
          mastery_behaviour: string | null
          mastery_behaviour_hi: string | null
          mastery_criteria: string
          mastery_frequency_denom: number | null
          mastery_frequency_num: number | null
          mastery_sessions: number | null
          materials_required: Json
          materials_required_hi: Json
          measurement_bucket_id: string | null
          measuring_now: string | null
          measuring_now_hi: string | null
          name: string
          parent_explanation: Json
          prompting_hierarchy: Json
          skill_level: Database["public"]["Enums"]["skill_level"]
          source_version: string | null
          target_age_max_months: number
          target_age_min_months: number
          therapist_steps: Json
          therapist_steps_hi: Json
          updated_at: string
          validation_status: Database["public"]["Enums"]["validation_status"]
          what_good_looks_like: string | null
          what_good_looks_like_hi: string | null
          what_this_is: string | null
          what_this_is_hi: string | null
          what_we_dont_measure: string | null
          what_we_dont_measure_hi: string | null
          what_we_measure_how: string | null
          what_we_measure_how_hi: string | null
          why_this_works: string | null
          why_this_works_hi: string | null
          why_we_do_it: string | null
          why_we_do_it_hi: string | null
        }
        Insert: {
          center_id?: string | null
          clinical_reference?: string | null
          created_at?: string
          created_by?: string | null
          developmental_domain: Database["public"]["Enums"]["activity_domain"]
          diagnostic_profile_applicability?: Database["public"]["Enums"]["diagnostic_profile"][]
          duration_minutes?: number
          framework_citation?: string | null
          framework_source: Database["public"]["Enums"]["framework_source"]
          goal_one_line?: string | null
          goal_one_line_hi?: string | null
          how_this_helps?: string | null
          how_this_helps_hi?: string | null
          id: string
          mastery_behaviour?: string | null
          mastery_behaviour_hi?: string | null
          mastery_criteria: string
          mastery_frequency_denom?: number | null
          mastery_frequency_num?: number | null
          mastery_sessions?: number | null
          materials_required?: Json
          materials_required_hi?: Json
          measurement_bucket_id?: string | null
          measuring_now?: string | null
          measuring_now_hi?: string | null
          name: string
          parent_explanation?: Json
          prompting_hierarchy?: Json
          skill_level: Database["public"]["Enums"]["skill_level"]
          source_version?: string | null
          target_age_max_months: number
          target_age_min_months: number
          therapist_steps?: Json
          therapist_steps_hi?: Json
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["validation_status"]
          what_good_looks_like?: string | null
          what_good_looks_like_hi?: string | null
          what_this_is?: string | null
          what_this_is_hi?: string | null
          what_we_dont_measure?: string | null
          what_we_dont_measure_hi?: string | null
          what_we_measure_how?: string | null
          what_we_measure_how_hi?: string | null
          why_this_works?: string | null
          why_this_works_hi?: string | null
          why_we_do_it?: string | null
          why_we_do_it_hi?: string | null
        }
        Update: {
          center_id?: string | null
          clinical_reference?: string | null
          created_at?: string
          created_by?: string | null
          developmental_domain?: Database["public"]["Enums"]["activity_domain"]
          diagnostic_profile_applicability?: Database["public"]["Enums"]["diagnostic_profile"][]
          duration_minutes?: number
          framework_citation?: string | null
          framework_source?: Database["public"]["Enums"]["framework_source"]
          goal_one_line?: string | null
          goal_one_line_hi?: string | null
          how_this_helps?: string | null
          how_this_helps_hi?: string | null
          id?: string
          mastery_behaviour?: string | null
          mastery_behaviour_hi?: string | null
          mastery_criteria?: string
          mastery_frequency_denom?: number | null
          mastery_frequency_num?: number | null
          mastery_sessions?: number | null
          materials_required?: Json
          materials_required_hi?: Json
          measurement_bucket_id?: string | null
          measuring_now?: string | null
          measuring_now_hi?: string | null
          name?: string
          parent_explanation?: Json
          prompting_hierarchy?: Json
          skill_level?: Database["public"]["Enums"]["skill_level"]
          source_version?: string | null
          target_age_max_months?: number
          target_age_min_months?: number
          therapist_steps?: Json
          therapist_steps_hi?: Json
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["validation_status"]
          what_good_looks_like?: string | null
          what_good_looks_like_hi?: string | null
          what_this_is?: string | null
          what_this_is_hi?: string | null
          what_we_dont_measure?: string | null
          what_we_dont_measure_hi?: string | null
          what_we_measure_how?: string | null
          what_we_measure_how_hi?: string | null
          why_this_works?: string | null
          why_this_works_hi?: string | null
          why_we_do_it?: string | null
          why_we_do_it_hi?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_operational"
            referencedColumns: ["center_id"]
          },
          {
            foreignKeyName: "activities_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_parent_engagement"
            referencedColumns: ["center_id"]
          },
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_measurement_bucket_id_fkey"
            columns: ["measurement_bucket_id"]
            isOneToOne: false
            referencedRelation: "measurement_bucket"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_signals: {
        Row: {
          activity_id: string
          attribute_id: string
          created_at: string
          id: string
          is_primary: boolean
        }
        Insert: {
          activity_id: string
          attribute_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
        }
        Update: {
          activity_id?: string
          attribute_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "activity_signals_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_signals_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
        ]
      }
      attributes: {
        Row: {
          active: boolean
          capture_method: string
          config: Json
          id: string
          parent_label: string
          scale_type: string
          sort_order: number | null
        }
        Insert: {
          active?: boolean
          capture_method: string
          config?: Json
          id: string
          parent_label: string
          scale_type: string
          sort_order?: number | null
        }
        Update: {
          active?: boolean
          capture_method?: string
          config?: Json
          id?: string
          parent_label?: string
          scale_type?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string
          after_state: Json | null
          before_state: Json | null
          center_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id: string
          after_state?: Json | null
          before_state?: Json | null
          center_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string
          after_state?: Json | null
          before_state?: Json | null
          center_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_operational"
            referencedColumns: ["center_id"]
          },
          {
            foreignKeyName: "audit_log_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_parent_engagement"
            referencedColumns: ["center_id"]
          },
        ]
      }
      centers: {
        Row: {
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          pincode: string | null
          slug: string
          state: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          pincode?: string | null
          slug: string
          state?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          pincode?: string | null
          slug?: string
          state?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      child_attribute_baselines: {
        Row: {
          attribute_id: string
          baseline_value: number | null
          baseline_window: string | null
          child_id: string
          frozen_at: string
        }
        Insert: {
          attribute_id: string
          baseline_value?: number | null
          baseline_window?: string | null
          child_id: string
          frozen_at?: string
        }
        Update: {
          attribute_id?: string
          baseline_value?: number | null
          baseline_window?: string | null
          child_id?: string
          frozen_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_attribute_baselines_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_attribute_baselines_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_attribute_baselines_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_clinical"
            referencedColumns: ["child_id"]
          },
        ]
      }
      child_care_team: {
        Row: {
          child_id: string
          created_at: string
          discipline_id: string | null
          id: string
          is_active: boolean
          role: string
          therapist_id: string
        }
        Insert: {
          child_id: string
          created_at?: string
          discipline_id?: string | null
          id?: string
          is_active?: boolean
          role?: string
          therapist_id: string
        }
        Update: {
          child_id?: string
          created_at?: string
          discipline_id?: string | null
          id?: string
          is_active?: boolean
          role?: string
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_care_team_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_care_team_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_clinical"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "child_care_team_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_care_team_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          center_id: string
          created_at: string
          date_of_birth: string
          deleted_at: string | null
          diagnostic_profile: Database["public"]["Enums"]["diagnostic_profile"][]
          full_name: string
          gender: string | null
          id: string
          intake_status: Database["public"]["Enums"]["intake_status"]
          primary_language: Database["public"]["Enums"]["language_code"]
          primary_therapist_id: string | null
          supervising_therapist_id: string | null
          updated_at: string
        }
        Insert: {
          center_id: string
          created_at?: string
          date_of_birth: string
          deleted_at?: string | null
          diagnostic_profile?: Database["public"]["Enums"]["diagnostic_profile"][]
          full_name: string
          gender?: string | null
          id?: string
          intake_status?: Database["public"]["Enums"]["intake_status"]
          primary_language?: Database["public"]["Enums"]["language_code"]
          primary_therapist_id?: string | null
          supervising_therapist_id?: string | null
          updated_at?: string
        }
        Update: {
          center_id?: string
          created_at?: string
          date_of_birth?: string
          deleted_at?: string | null
          diagnostic_profile?: Database["public"]["Enums"]["diagnostic_profile"][]
          full_name?: string
          gender?: string | null
          id?: string
          intake_status?: Database["public"]["Enums"]["intake_status"]
          primary_language?: Database["public"]["Enums"]["language_code"]
          primary_therapist_id?: string | null
          supervising_therapist_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "children_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_operational"
            referencedColumns: ["center_id"]
          },
          {
            foreignKeyName: "children_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_parent_engagement"
            referencedColumns: ["center_id"]
          },
          {
            foreignKeyName: "children_primary_therapist_id_fkey"
            columns: ["primary_therapist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_supervising_therapist_id_fkey"
            columns: ["supervising_therapist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplines: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          sort_order: number
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          is_active?: boolean
          sort_order?: number
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      engagement_samples: {
        Row: {
          adult_voice_count: number
          audio_activity_flag: boolean
          child_voice_count: number
          composite_score: number | null
          created_at: string
          head_pose: Json | null
          id: string
          motion_score: number | null
          recorded_at: string
          sampling_version: string
          session_activity_id: string
          session_id: string
          voice_state: string
        }
        Insert: {
          adult_voice_count?: number
          audio_activity_flag?: boolean
          child_voice_count?: number
          composite_score?: number | null
          created_at?: string
          head_pose?: Json | null
          id?: string
          motion_score?: number | null
          recorded_at?: string
          sampling_version?: string
          session_activity_id: string
          session_id: string
          voice_state?: string
        }
        Update: {
          adult_voice_count?: number
          audio_activity_flag?: boolean
          child_voice_count?: number
          composite_score?: number | null
          created_at?: string
          head_pose?: Json | null
          id?: string
          motion_score?: number | null
          recorded_at?: string
          sampling_version?: string
          session_activity_id?: string
          session_id?: string
          voice_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_samples_session_activity_id_fkey"
            columns: ["session_activity_id"]
            isOneToOne: false
            referencedRelation: "session_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_samples_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          activity_id: string | null
          center_id: string
          child_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          mastered_at: string | null
          mastery_criteria: string
          name: string
          retired_at: string | null
          status: Database["public"]["Enums"]["goal_status"]
          target_domain: Database["public"]["Enums"]["activity_domain"]
          target_skill_level: Database["public"]["Enums"]["skill_level"]
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          center_id: string
          child_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          mastered_at?: string | null
          mastery_criteria: string
          name: string
          retired_at?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          target_domain: Database["public"]["Enums"]["activity_domain"]
          target_skill_level: Database["public"]["Enums"]["skill_level"]
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          center_id?: string
          child_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          mastered_at?: string | null
          mastery_criteria?: string
          name?: string
          retired_at?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          target_domain?: Database["public"]["Enums"]["activity_domain"]
          target_skill_level?: Database["public"]["Enums"]["skill_level"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_operational"
            referencedColumns: ["center_id"]
          },
          {
            foreignKeyName: "goals_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_parent_engagement"
            referencedColumns: ["center_id"]
          },
          {
            foreignKeyName: "goals_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_clinical"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_assessments: {
        Row: {
          administered_by: string
          child_id: string
          completed_at: string | null
          computed_outputs: Json | null
          created_at: string
          id: string
          instrument_id: string
          started_at: string
          status: Database["public"]["Enums"]["intake_status"]
          updated_at: string
        }
        Insert: {
          administered_by: string
          child_id: string
          completed_at?: string | null
          computed_outputs?: Json | null
          created_at?: string
          id?: string
          instrument_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["intake_status"]
          updated_at?: string
        }
        Update: {
          administered_by?: string
          child_id?: string
          completed_at?: string | null
          computed_outputs?: Json | null
          created_at?: string
          id?: string
          instrument_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["intake_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_assessments_administered_by_fkey"
            columns: ["administered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_assessments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_assessments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_clinical"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "intake_assessments_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "intake_instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_instruments: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          payload: Json
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          payload: Json
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          payload?: Json
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      intake_responses: {
        Row: {
          assessment_id: string
          created_at: string
          id: string
          item_id: string
          notes: string | null
          response_value: Json
          updated_at: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          id?: string
          item_id: string
          notes?: string | null
          response_value: Json
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          id?: string
          item_id?: string
          notes?: string | null
          response_value?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_responses_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "intake_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_bucket: {
        Row: {
          display_name: string
          id: string
          is_auto_measured: boolean
          sort_order: number
        }
        Insert: {
          display_name: string
          id: string
          is_auto_measured: boolean
          sort_order?: number
        }
        Update: {
          display_name?: string
          id?: string
          is_auto_measured?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      memberships: {
        Row: {
          center_id: string
          created_at: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          center_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          center_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_operational"
            referencedColumns: ["center_id"]
          },
          {
            foreignKeyName: "memberships_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_parent_engagement"
            referencedColumns: ["center_id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          achieved_at: string
          attribute_id: string
          child_id: string
          id: string
          milestone_key: string
          probe_id: string | null
        }
        Insert: {
          achieved_at: string
          attribute_id: string
          child_id: string
          id?: string
          milestone_key: string
          probe_id?: string | null
        }
        Update: {
          achieved_at?: string
          attribute_id?: string
          child_id?: string
          id?: string
          milestone_key?: string
          probe_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milestones_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_clinical"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "milestones_probe_id_fkey"
            columns: ["probe_id"]
            isOneToOne: false
            referencedRelation: "probes"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_reports: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          center_id: string
          channel: Database["public"]["Enums"]["report_channel"] | null
          child_id: string
          content: Json
          created_at: string
          generated_by: string | null
          id: string
          language: Database["public"]["Enums"]["language_code"]
          pdf_url: string | null
          period_end: string
          period_start: string
          sent_at: string | null
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
          whatsapp_message_id: string | null
          whatsapp_status: string | null
          whatsapp_status_updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          center_id: string
          channel?: Database["public"]["Enums"]["report_channel"] | null
          child_id: string
          content?: Json
          created_at?: string
          generated_by?: string | null
          id?: string
          language?: Database["public"]["Enums"]["language_code"]
          pdf_url?: string | null
          period_end: string
          period_start: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
          whatsapp_message_id?: string | null
          whatsapp_status?: string | null
          whatsapp_status_updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          center_id?: string
          channel?: Database["public"]["Enums"]["report_channel"] | null
          child_id?: string
          content?: Json
          created_at?: string
          generated_by?: string | null
          id?: string
          language?: Database["public"]["Enums"]["language_code"]
          pdf_url?: string | null
          period_end?: string
          period_start?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
          whatsapp_message_id?: string | null
          whatsapp_status?: string | null
          whatsapp_status_updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_reports_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_reports_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_reports_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_operational"
            referencedColumns: ["center_id"]
          },
          {
            foreignKeyName: "parent_reports_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_parent_engagement"
            referencedColumns: ["center_id"]
          },
          {
            foreignKeyName: "parent_reports_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_reports_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_clinical"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "parent_reports_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parents: {
        Row: {
          child_id: string
          created_at: string
          deleted_at: string | null
          email: string | null
          full_name: string
          id: string
          is_primary_contact: boolean
          phone: string
          preferred_language: Database["public"]["Enums"]["language_code"]
          relationship: string | null
          updated_at: string
          whatsapp_number_e164: string | null
        }
        Insert: {
          child_id: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_primary_contact?: boolean
          phone: string
          preferred_language?: Database["public"]["Enums"]["language_code"]
          relationship?: string | null
          updated_at?: string
          whatsapp_number_e164?: string | null
        }
        Update: {
          child_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_primary_contact?: boolean
          phone?: string
          preferred_language?: Database["public"]["Enums"]["language_code"]
          relationship?: string | null
          updated_at?: string
          whatsapp_number_e164?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parents_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parents_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_clinical"
            referencedColumns: ["child_id"]
          },
        ]
      }
      personal_bests: {
        Row: {
          achieved_at: string
          attribute_id: string
          child_id: string
          id: string
          metric: string
          probe_id: string | null
          value: number
        }
        Insert: {
          achieved_at: string
          attribute_id: string
          child_id: string
          id?: string
          metric: string
          probe_id?: string | null
          value: number
        }
        Update: {
          achieved_at?: string
          attribute_id?: string
          child_id?: string
          id?: string
          metric?: string
          probe_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "personal_bests_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_bests_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_bests_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_clinical"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "personal_bests_probe_id_fkey"
            columns: ["probe_id"]
            isOneToOne: false
            referencedRelation: "probes"
            referencedColumns: ["id"]
          },
        ]
      }
      probes: {
        Row: {
          attribute_id: string
          captured_at: string
          child_id: string
          created_at: string
          id: string
          method: string
          raw: Json
          score: number | null
          session_id: string
          therapist_confirmed: boolean
          therapist_override: Json | null
          valid: boolean
          void_reason: string | null
        }
        Insert: {
          attribute_id: string
          captured_at?: string
          child_id: string
          created_at?: string
          id?: string
          method: string
          raw: Json
          score?: number | null
          session_id: string
          therapist_confirmed?: boolean
          therapist_override?: Json | null
          valid?: boolean
          void_reason?: string | null
        }
        Update: {
          attribute_id?: string
          captured_at?: string
          child_id?: string
          created_at?: string
          id?: string
          method?: string
          raw?: Json
          score?: number | null
          session_id?: string
          therapist_confirmed?: boolean
          therapist_override?: Json | null
          valid?: boolean
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "probes_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "probes_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "probes_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_clinical"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "probes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          credential_class: string | null
          discipline_id: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          phone_e164: string | null
          preferred_language: Database["public"]["Enums"]["language_code"]
          qualifications: string | null
          rci_registration_number: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          credential_class?: string | null
          discipline_id?: string | null
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          phone_e164?: string | null
          preferred_language?: Database["public"]["Enums"]["language_code"]
          qualifications?: string | null
          rci_registration_number?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          credential_class?: string | null
          discipline_id?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          phone_e164?: string | null
          preferred_language?: Database["public"]["Enums"]["language_code"]
          qualifications?: string | null
          rci_registration_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      session_activities: {
        Row: {
          activity_id: string
          created_at: string
          ended_at: string | null
          goal_id: string | null
          id: string
          ordering: number
          plan_origin: Database["public"]["Enums"]["plan_origin"]
          session_id: string
          started_at: string | null
          therapist_notes: string | null
          updated_at: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          ended_at?: string | null
          goal_id?: string | null
          id?: string
          ordering?: number
          plan_origin?: Database["public"]["Enums"]["plan_origin"]
          session_id: string
          started_at?: string | null
          therapist_notes?: string | null
          updated_at?: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          ended_at?: string | null
          goal_id?: string | null
          id?: string
          ordering?: number
          plan_origin?: Database["public"]["Enums"]["plan_origin"]
          session_id?: string
          started_at?: string | null
          therapist_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_activities_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_activities_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_activities_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          note: string | null
          recorded_at: string
          recorded_by_user_id: string | null
          session_activity_id: string | null
          session_id: string
          state_value: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          note?: string | null
          recorded_at?: string
          recorded_by_user_id?: string | null
          session_activity_id?: string | null
          session_id: string
          state_value?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          note?: string | null
          recorded_at?: string
          recorded_by_user_id?: string | null
          session_activity_id?: string | null
          session_id?: string
          state_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_events_recorded_by_user_id_fkey"
            columns: ["recorded_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_events_session_activity_id_fkey"
            columns: ["session_activity_id"]
            isOneToOne: false
            referencedRelation: "session_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_notes: {
        Row: {
          author_id: string
          body: string
          child_id: string
          created_at: string
          discipline_id: string | null
          id: string
          scope: string
          session_id: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          child_id: string
          created_at?: string
          discipline_id?: string | null
          id?: string
          scope?: string
          session_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          child_id?: string
          created_at?: string
          discipline_id?: string | null
          id?: string
          scope?: string
          session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_clinical"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "session_notes_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_plans: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          generated_at: string
          generator_version: string
          id: string
          plan: Json | null
          reasoning: Json | null
          recommended_activity_ids: string[]
          session_id: string
          was_edited: boolean
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          generated_at?: string
          generator_version?: string
          id?: string
          plan?: Json | null
          reasoning?: Json | null
          recommended_activity_ids?: string[]
          session_id: string
          was_edited?: boolean
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          generated_at?: string
          generator_version?: string
          id?: string
          plan?: Json | null
          reasoning?: Json | null
          recommended_activity_ids?: string[]
          session_id?: string
          was_edited?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "session_plans_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          attendance_marked_at: string | null
          attendance_marked_by_user_id: string | null
          cancellation_reason: string | null
          center_id: string
          child_id: string
          created_at: string
          discipline_id: string
          duration_minutes: number | null
          ended_at: string | null
          id: string
          no_show_reason: string | null
          scheduled_date: string
          scheduled_time: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["session_status"]
          therapist_id: string
          therapist_notes: string | null
          updated_at: string
        }
        Insert: {
          attendance_marked_at?: string | null
          attendance_marked_by_user_id?: string | null
          cancellation_reason?: string | null
          center_id: string
          child_id: string
          created_at?: string
          discipline_id?: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          no_show_reason?: string | null
          scheduled_date: string
          scheduled_time?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          therapist_id: string
          therapist_notes?: string | null
          updated_at?: string
        }
        Update: {
          attendance_marked_at?: string | null
          attendance_marked_by_user_id?: string | null
          cancellation_reason?: string | null
          center_id?: string
          child_id?: string
          created_at?: string
          discipline_id?: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          no_show_reason?: string | null
          scheduled_date?: string
          scheduled_time?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          therapist_id?: string
          therapist_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_sessions_attendance_marked_by"
            columns: ["attendance_marked_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_operational"
            referencedColumns: ["center_id"]
          },
          {
            foreignKeyName: "sessions_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_parent_engagement"
            referencedColumns: ["center_id"]
          },
          {
            foreignKeyName: "sessions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_clinical"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "sessions_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_prompt_inferences: {
        Row: {
          confidence: string
          corrected_at: string | null
          corrected_by: string | null
          created_at: string
          id: string
          inferred_level: string
          signal_summary: Json
          therapist_correction: string | null
          trial_id: string
          updated_at: string
        }
        Insert: {
          confidence: string
          corrected_at?: string | null
          corrected_by?: string | null
          created_at?: string
          id?: string
          inferred_level: string
          signal_summary?: Json
          therapist_correction?: string | null
          trial_id: string
          updated_at?: string
        }
        Update: {
          confidence?: string
          corrected_at?: string | null
          corrected_by?: string | null
          created_at?: string
          id?: string
          inferred_level?: string
          signal_summary?: Json
          therapist_correction?: string | null
          trial_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_prompt_inferences_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_prompt_inferences_trial_id_fkey"
            columns: ["trial_id"]
            isOneToOne: true
            referencedRelation: "trials"
            referencedColumns: ["id"]
          },
        ]
      }
      trials: {
        Row: {
          adult_voice_count: number | null
          created_at: string
          id: string
          metrics: Json | null
          notes: string | null
          prompt_level: string | null
          recorded_at: string
          response: Database["public"]["Enums"]["trial_response"]
          session_activity_id: string
          trial_number: number
          word_count: number | null
        }
        Insert: {
          adult_voice_count?: number | null
          created_at?: string
          id?: string
          metrics?: Json | null
          notes?: string | null
          prompt_level?: string | null
          recorded_at?: string
          response: Database["public"]["Enums"]["trial_response"]
          session_activity_id: string
          trial_number: number
          word_count?: number | null
        }
        Update: {
          adult_voice_count?: number | null
          created_at?: string
          id?: string
          metrics?: Json | null
          notes?: string | null
          prompt_level?: string | null
          recorded_at?: string
          response?: Database["public"]["Enums"]["trial_response"]
          session_activity_id?: string
          trial_number?: number
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trials_session_activity_id_fkey"
            columns: ["session_activity_id"]
            isOneToOne: false
            referencedRelation: "session_activities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_child_attribute_totals: {
        Row: {
          attribute_id: string | null
          child_id: string | null
          probe_count: number | null
          score_sum: number | null
        }
        Relationships: [
          {
            foreignKeyName: "probes_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "probes_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "probes_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_clinical"
            referencedColumns: ["child_id"]
          },
        ]
      }
      v_pulse_clinical: {
        Row: {
          active_goal_count: number | null
          center_id: string | null
          child_id: string | null
          full_name: string | null
          last_session_date: string | null
          sessions_completed: number | null
          trajectory: string | null
        }
        Insert: {
          active_goal_count?: never
          center_id?: string | null
          child_id?: string | null
          full_name?: string | null
          last_session_date?: never
          sessions_completed?: never
          trajectory?: never
        }
        Update: {
          active_goal_count?: never
          center_id?: string | null
          child_id?: string | null
          full_name?: string | null
          last_session_date?: never
          sessions_completed?: never
          trajectory?: never
        }
        Relationships: [
          {
            foreignKeyName: "children_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_operational"
            referencedColumns: ["center_id"]
          },
          {
            foreignKeyName: "children_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "v_pulse_parent_engagement"
            referencedColumns: ["center_id"]
          },
        ]
      }
      v_pulse_operational: {
        Row: {
          active_children: number | null
          attendance_rate_30d: number | null
          center_id: string | null
          center_name: string | null
          retention_alerts_14d: number | null
          sessions_this_week: number | null
          therapists_active: number | null
        }
        Insert: {
          active_children?: never
          attendance_rate_30d?: never
          center_id?: string | null
          center_name?: string | null
          retention_alerts_14d?: never
          sessions_this_week?: never
          therapists_active?: never
        }
        Update: {
          active_children?: never
          attendance_rate_30d?: never
          center_id?: string | null
          center_name?: string | null
          retention_alerts_14d?: never
          sessions_this_week?: never
          therapists_active?: never
        }
        Relationships: []
      }
      v_pulse_parent_engagement: {
        Row: {
          center_id: string | null
          center_name: string | null
          parents_silent_30d: number | null
          reports_opened_30d: number | null
          reports_sent_30d: number | null
        }
        Insert: {
          center_id?: string | null
          center_name?: string | null
          parents_silent_30d?: never
          reports_opened_30d?: never
          reports_sent_30d?: never
        }
        Update: {
          center_id?: string | null
          center_name?: string | null
          parents_silent_30d?: never
          reports_opened_30d?: never
          reports_sent_30d?: never
        }
        Relationships: []
      }
    }
    Functions: {
      auth_user_centers: { Args: never; Returns: string[] }
      auth_user_has_role_in:
        | {
            Args: {
              p_center_id: string
              p_role: Database["public"]["Enums"]["user_role"]
            }
            Returns: boolean
          }
        | {
            Args: {
              p_center_id: string
              p_roles: Database["public"]["Enums"]["user_role"][]
            }
            Returns: boolean
          }
      auth_user_in_center: { Args: { p_center_id: string }; Returns: boolean }
      auth_user_owns_child: { Args: { p_child_id: string }; Returns: boolean }
      child_belongs_to_center: {
        Args: { p_center_id: string; p_child_id: string }
        Returns: boolean
      }
      create_center_with_owner: {
        Args: { p_city?: string; p_name: string; p_state?: string }
        Returns: string
      }
      intake_to_activity_domains: {
        Args: { d: Database["public"]["Enums"]["intake_baseline_domain"] }
        Returns: Database["public"]["Enums"]["activity_domain"][]
      }
      set_member_discipline: {
        Args: { p_discipline_id: string; p_user_id: string }
        Returns: undefined
      }
      storage_center_id: { Args: { obj_name: string }; Returns: string }
      user_is_active_member_of: {
        Args: { p_center_id: string; p_user_id: string }
        Returns: boolean
      }
      user_on_child_care_team: {
        Args: { p_child_id: string }
        Returns: boolean
      }
    }
    Enums: {
      activity_domain:
        | "attention_executive"
        | "expressive_language"
        | "joint_attention"
        | "motor_imitation"
        | "play_skills"
        | "receptive_language"
        | "self_regulation"
        | "social_reciprocity"
        | "gross_motor"
        | "fine_motor"
      diagnostic_profile:
        | "autism"
        | "speech_delay"
        | "adhd"
        | "specific_learning_disability"
        | "global_developmental_delay"
      framework_source:
        | "ESDM"
        | "HANEN"
        | "NDBI"
        | "PECS"
        | "DIR"
        | "BARKLEY_ADHD"
        | "VBMAPP"
        | "ICF_CY"
        | "IEP_FRAMEWORK"
        | "GENERAL_PRACTICE"
      goal_status: "active" | "retired" | "mastered"
      intake_baseline_domain:
        | "communication"
        | "social_reciprocity"
        | "motor_imitation"
        | "play_skills"
        | "self_regulation"
        | "attention_executive"
      intake_status: "not_started" | "in_progress" | "completed"
      language_code: "en" | "hi"
      plan_origin:
        | "ai_recommended"
        | "therapist_added"
        | "therapist_substituted"
      report_channel: "whatsapp" | "sms" | "email"
      report_status:
        | "draft"
        | "awaiting_approval"
        | "approved"
        | "sent"
        | "failed"
      session_status:
        | "scheduled"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
      skill_level: "emerging" | "established" | "mastery"
      trial_response:
        | "correct"
        | "prompted"
        | "incorrect"
        | "no_response"
        | "responded"
        | "partial"
        | "refused"
      user_role: "center_owner" | "supervising_therapist" | "therapist"
      validation_status:
        | "draft_pending_clinical_validation"
        | "validated"
        | "custom"
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
      activity_domain: [
        "attention_executive",
        "expressive_language",
        "joint_attention",
        "motor_imitation",
        "play_skills",
        "receptive_language",
        "self_regulation",
        "social_reciprocity",
        "gross_motor",
        "fine_motor",
      ],
      diagnostic_profile: [
        "autism",
        "speech_delay",
        "adhd",
        "specific_learning_disability",
        "global_developmental_delay",
      ],
      framework_source: [
        "ESDM",
        "HANEN",
        "NDBI",
        "PECS",
        "DIR",
        "BARKLEY_ADHD",
        "VBMAPP",
        "ICF_CY",
        "IEP_FRAMEWORK",
        "GENERAL_PRACTICE",
      ],
      goal_status: ["active", "retired", "mastered"],
      intake_baseline_domain: [
        "communication",
        "social_reciprocity",
        "motor_imitation",
        "play_skills",
        "self_regulation",
        "attention_executive",
      ],
      intake_status: ["not_started", "in_progress", "completed"],
      language_code: ["en", "hi"],
      plan_origin: [
        "ai_recommended",
        "therapist_added",
        "therapist_substituted",
      ],
      report_channel: ["whatsapp", "sms", "email"],
      report_status: [
        "draft",
        "awaiting_approval",
        "approved",
        "sent",
        "failed",
      ],
      session_status: [
        "scheduled",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      skill_level: ["emerging", "established", "mastery"],
      trial_response: [
        "correct",
        "prompted",
        "incorrect",
        "no_response",
        "responded",
        "partial",
        "refused",
      ],
      user_role: ["center_owner", "supervising_therapist", "therapist"],
      validation_status: [
        "draft_pending_clinical_validation",
        "validated",
        "custom",
      ],
    },
  },
} as const

