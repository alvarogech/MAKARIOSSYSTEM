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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          blocks_progress: boolean
          created_at: string
          id: string
          instructions: string | null
          lesson_id: string
          max_attempts: number | null
          show_feedback_after_submit: boolean
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          blocks_progress?: boolean
          created_at?: string
          id?: string
          instructions?: string | null
          lesson_id: string
          max_attempts?: number | null
          show_feedback_after_submit?: boolean
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          blocks_progress?: boolean
          created_at?: string
          id?: string
          instructions?: string | null
          lesson_id?: string
          max_attempts?: number | null
          show_feedback_after_submit?: boolean
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_answers: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean | null
          question_id: string
          selected_option_ids: string[]
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          question_id: string
          selected_option_ids?: string[]
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          question_id?: string
          selected_option_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "activity_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "activity_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "question_bank"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_attempts: {
        Row: {
          activity_id: string
          correct_count: number | null
          created_at: string
          enrollment_id: string
          id: string
          started_at: string
          status: string
          submitted_at: string | null
          total_count: number | null
        }
        Insert: {
          activity_id: string
          correct_count?: number | null
          created_at?: string
          enrollment_id: string
          id?: string
          started_at?: string
          status?: string
          submitted_at?: string | null
          total_count?: number | null
        }
        Update: {
          activity_id?: string
          correct_count?: number | null
          created_at?: string
          enrollment_id?: string
          id?: string
          started_at?: string
          status?: string
          submitted_at?: string | null
          total_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_attempts_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_questions: {
        Row: {
          activity_id: string
          order_index: number
          question_id: string
        }
        Insert: {
          activity_id: string
          order_index: number
          question_id: string
        }
        Update: {
          activity_id?: string
          order_index?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_questions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "question_bank"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_answers: {
        Row: {
          answered_at: string
          attempt_id: string
          id: string
          is_correct: boolean
          question_id: string
          selected_option_ids: Json
        }
        Insert: {
          answered_at?: string
          attempt_id: string
          id?: string
          is_correct: boolean
          question_id: string
          selected_option_ids?: Json
        }
        Update: {
          answered_at?: string
          attempt_id?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_option_ids?: Json
        }
        Relationships: [
          {
            foreignKeyName: "assessment_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "assessment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "question_bank"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_attempt_questions: {
        Row: {
          attempt_id: string
          correct_option_ids_snapshot: Json
          created_at: string
          id: string
          options_snapshot: Json
          points: number
          position: number
          prompt: string
          question_id: string
          question_type: string
          selection_mode: string
        }
        Insert: {
          attempt_id: string
          correct_option_ids_snapshot: Json
          created_at?: string
          id?: string
          options_snapshot: Json
          points: number
          position: number
          prompt: string
          question_id: string
          question_type: string
          selection_mode: string
        }
        Update: {
          attempt_id?: string
          correct_option_ids_snapshot?: Json
          created_at?: string
          id?: string
          options_snapshot?: Json
          points?: number
          position?: number
          prompt?: string
          question_id?: string
          question_type?: string
          selection_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_attempt_questions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "assessment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_attempt_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "question_bank"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_attempts: {
        Row: {
          assessment_id: string
          attempt_kind: string
          cancel_reason: string | null
          canceled_at: string | null
          canceled_by: string | null
          correct_count: number | null
          created_at: string
          deadline_at: string
          enrollment_id: string
          id: string
          score: number | null
          started_at: string
          status: Database["public"]["Enums"]["assessment_attempt_status"]
          submitted_at: string | null
          total_count: number | null
        }
        Insert: {
          assessment_id: string
          attempt_kind?: string
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          correct_count?: number | null
          created_at?: string
          deadline_at: string
          enrollment_id: string
          id?: string
          score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["assessment_attempt_status"]
          submitted_at?: string | null
          total_count?: number | null
        }
        Update: {
          assessment_id?: string
          attempt_kind?: string
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          correct_count?: number | null
          created_at?: string
          deadline_at?: string
          enrollment_id?: string
          id?: string
          score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["assessment_attempt_status"]
          submitted_at?: string | null
          total_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_attempts_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_eligible_students: {
        Row: {
          assessment_id: string
          computed_at: string
          enrollment_id: string
          id: string
        }
        Insert: {
          assessment_id: string
          computed_at?: string
          enrollment_id: string
          id?: string
        }
        Update: {
          assessment_id?: string
          computed_at?: string
          enrollment_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_eligible_students_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_eligible_students_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_exceptional_grants: {
        Row: {
          assessment_id: string
          created_at: string
          enrollment_id: string
          granted_by: string
          id: string
          justification: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          enrollment_id: string
          granted_by: string
          id?: string
          justification: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          enrollment_id?: string
          granted_by?: string
          id?: string
          justification?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_exceptional_grants_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_exceptional_grants_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_questions: {
        Row: {
          assessment_id: string
          order_index: number
          points: number
          question_id: string
        }
        Insert: {
          assessment_id: string
          order_index: number
          points: number
          question_id: string
        }
        Update: {
          assessment_id?: string
          order_index?: number
          points?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "question_bank"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          answer_key_release_reason:
            | Database["public"]["Enums"]["answer_key_release_reason"]
            | null
          answer_key_released_at: string | null
          closes_at: string | null
          created_at: string
          duration_minutes: number
          id: string
          linked_assessment_id: string | null
          opens_at: string | null
          passing_grade: number
          questions_count: number
          season_volume_offering_id: string
          shuffle_options: boolean
          shuffle_questions: boolean
          status: Database["public"]["Enums"]["assessment_status"]
          title: string
          total_points: number
          type: Database["public"]["Enums"]["assessment_type"]
          updated_at: string
        }
        Insert: {
          answer_key_release_reason?:
            | Database["public"]["Enums"]["answer_key_release_reason"]
            | null
          answer_key_released_at?: string | null
          closes_at?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          linked_assessment_id?: string | null
          opens_at?: string | null
          passing_grade?: number
          questions_count?: number
          season_volume_offering_id: string
          shuffle_options?: boolean
          shuffle_questions?: boolean
          status?: Database["public"]["Enums"]["assessment_status"]
          title: string
          total_points?: number
          type: Database["public"]["Enums"]["assessment_type"]
          updated_at?: string
        }
        Update: {
          answer_key_release_reason?:
            | Database["public"]["Enums"]["answer_key_release_reason"]
            | null
          answer_key_released_at?: string | null
          closes_at?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          linked_assessment_id?: string | null
          opens_at?: string | null
          passing_grade?: number
          questions_count?: number
          season_volume_offering_id?: string
          shuffle_options?: boolean
          shuffle_questions?: boolean
          status?: Database["public"]["Enums"]["assessment_status"]
          title?: string
          total_points?: number
          type?: Database["public"]["Enums"]["assessment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_linked_assessment_id_fkey"
            columns: ["linked_assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_season_volume_offering_id_fkey"
            columns: ["season_volume_offering_id"]
            isOneToOne: false
            referencedRelation: "season_volume_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_change_history: {
        Row: {
          attendance_record_id: string
          changed_at: string
          changed_by: string | null
          id: string
          justification: string | null
          new_minutes: number | null
          new_status: Database["public"]["Enums"]["attendance_status"] | null
          previous_minutes: number | null
          previous_status:
            | Database["public"]["Enums"]["attendance_status"]
            | null
        }
        Insert: {
          attendance_record_id: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          justification?: string | null
          new_minutes?: number | null
          new_status?: Database["public"]["Enums"]["attendance_status"] | null
          previous_minutes?: number | null
          previous_status?:
            | Database["public"]["Enums"]["attendance_status"]
            | null
        }
        Update: {
          attendance_record_id?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          justification?: string | null
          new_minutes?: number | null
          new_status?: Database["public"]["Enums"]["attendance_status"] | null
          previous_minutes?: number | null
          previous_status?:
            | Database["public"]["Enums"]["attendance_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_change_history_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          enrollment_id: string
          finalized_at: string | null
          id: string
          meeting_id: string
          observation: string | null
          recognized_minutes: number
          recorded_at: string
          recorded_by: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
        }
        Insert: {
          enrollment_id: string
          finalized_at?: string | null
          id?: string
          meeting_id: string
          observation?: string | null
          recognized_minutes?: number
          recorded_at?: string
          recorded_by: string
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
        }
        Update: {
          enrollment_id?: string
          finalized_at?: string | null
          id?: string
          meeting_id?: string
          observation?: string | null
          recognized_minutes?: number
          recorded_at?: string
          recorded_by?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "class_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      class_meeting_reports: {
        Row: {
          content_completed: string | null
          id: string
          meeting_id: string
          observation: string | null
          occurrences: string | null
          plan_change_notes: string | null
          plan_changed: boolean
          recurring_questions: string | null
          students_needing_attention: string | null
          submitted_at: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          content_completed?: string | null
          id?: string
          meeting_id: string
          observation?: string | null
          occurrences?: string | null
          plan_change_notes?: string | null
          plan_changed?: boolean
          recurring_questions?: string | null
          students_needing_attention?: string | null
          submitted_at?: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          content_completed?: string | null
          id?: string
          meeting_id?: string
          observation?: string | null
          occurrences?: string | null
          plan_change_notes?: string | null
          plan_changed?: boolean
          recurring_questions?: string | null
          students_needing_attention?: string | null
          submitted_at?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_meeting_reports_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "class_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      class_meetings: {
        Row: {
          academic_minutes: number
          break_minutes: number
          class_id: string
          created_at: string
          end_time: string | null
          id: string
          location: string | null
          meeting_date: string | null
          sequence: number
          start_time: string | null
          status: string
        }
        Insert: {
          academic_minutes: number
          break_minutes?: number
          class_id: string
          created_at?: string
          end_time?: string | null
          id?: string
          location?: string | null
          meeting_date?: string | null
          sequence: number
          start_time?: string | null
          status?: string
        }
        Update: {
          academic_minutes?: number
          break_minutes?: number
          class_id?: string
          created_at?: string
          end_time?: string | null
          id?: string
          location?: string | null
          meeting_date?: string | null
          sequence?: number
          start_time?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_meetings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_templates: {
        Row: {
          academic_minutes_per_meeting: number
          break_minutes: number
          created_at: string
          end_time: string
          id: string
          meetings_count: number
          name: string
          slug: string
          start_time: string
          total_academic_minutes: number
          weekdays: string[]
        }
        Insert: {
          academic_minutes_per_meeting: number
          break_minutes?: number
          created_at?: string
          end_time: string
          id?: string
          meetings_count: number
          name: string
          slug: string
          start_time: string
          total_academic_minutes: number
          weekdays: string[]
        }
        Update: {
          academic_minutes_per_meeting?: number
          break_minutes?: number
          created_at?: string
          end_time?: string
          id?: string
          meetings_count?: number
          name?: string
          slug?: string
          start_time?: string
          total_academic_minutes?: number
          weekdays?: string[]
        }
        Relationships: []
      }
      classes: {
        Row: {
          capacity: number | null
          class_template_id: string
          created_at: string
          id: string
          location: string | null
          name: string
          season_volume_offering_id: string
          status: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          class_template_id: string
          created_at?: string
          id?: string
          location?: string | null
          name: string
          season_volume_offering_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          class_template_id?: string
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          season_volume_offering_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_class_template_id_fkey"
            columns: ["class_template_id"]
            isOneToOne: false
            referencedRelation: "class_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_season_volume_offering_id_fkey"
            columns: ["season_volume_offering_id"]
            isOneToOne: false
            referencedRelation: "season_volume_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      content_files: {
        Row: {
          content_id: string
          created_at: string
          file_name: string
          file_url: string
          id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          file_name: string
          file_url: string
          id?: string
        }
        Update: {
          content_id?: string
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_files_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
        ]
      }
      content_progress: {
        Row: {
          completed_at: string | null
          content_id: string
          enrollment_id: string
          id: string
          last_position_seconds: number | null
          percent: number
          started_at: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          content_id: string
          enrollment_id: string
          id?: string
          last_position_seconds?: number | null
          percent?: number
          started_at?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          content_id?: string
          enrollment_id?: string
          id?: string
          last_position_seconds?: number | null
          percent?: number
          started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_progress_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      contents: {
        Row: {
          allow_download: boolean
          body: string | null
          classification: Database["public"]["Enums"]["content_classification"]
          created_at: string
          description: string | null
          estimated_minutes: number | null
          id: string
          lesson_id: string
          order_index: number
          status: Database["public"]["Enums"]["content_status"]
          title: string
          type: Database["public"]["Enums"]["content_type"]
          updated_at: string
          volume_id: string
        }
        Insert: {
          allow_download?: boolean
          body?: string | null
          classification?: Database["public"]["Enums"]["content_classification"]
          created_at?: string
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          lesson_id: string
          order_index: number
          status?: Database["public"]["Enums"]["content_status"]
          title: string
          type: Database["public"]["Enums"]["content_type"]
          updated_at?: string
          volume_id: string
        }
        Update: {
          allow_download?: boolean
          body?: string | null
          classification?: Database["public"]["Enums"]["content_classification"]
          created_at?: string
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          lesson_id?: string
          order_index?: number
          status?: Database["public"]["Enums"]["content_status"]
          title?: string
          type?: Database["public"]["Enums"]["content_type"]
          updated_at?: string
          volume_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contents_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contents_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          authorized_at: string
          authorized_by: string
          class_id: string
          created_at: string
          final_attendance_percent: number | null
          final_grade: number | null
          id: string
          season_volume_offering_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          authorized_at?: string
          authorized_by: string
          class_id: string
          created_at?: string
          final_attendance_percent?: number | null
          final_grade?: number | null
          id?: string
          season_volume_offering_id: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          authorized_at?: string
          authorized_by?: string
          class_id?: string
          created_at?: string
          final_attendance_percent?: number | null
          final_grade?: number | null
          id?: string
          season_volume_offering_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_season_volume_offering_id_fkey"
            columns: ["season_volume_offering_id"]
            isOneToOne: false
            referencedRelation: "season_volume_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      import_rows: {
        Row: {
          created_at: string
          created_enrollment_id: string | null
          created_user_id: string | null
          errors: string[]
          id: string
          import_id: string
          raw_data: Json
          row_number: number
          status: string
        }
        Insert: {
          created_at?: string
          created_enrollment_id?: string | null
          created_user_id?: string | null
          errors?: string[]
          id?: string
          import_id: string
          raw_data: Json
          row_number: number
          status?: string
        }
        Update: {
          created_at?: string
          created_enrollment_id?: string | null
          created_user_id?: string | null
          errors?: string[]
          id?: string
          import_id?: string
          raw_data?: Json
          row_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_created_enrollment_id_fkey"
            columns: ["created_enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_rows_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
        ]
      }
      imports: {
        Row: {
          class_id: string | null
          created_at: string
          created_by: string
          error_rows: number
          file_name: string
          id: string
          season_volume_offering_id: string | null
          status: string
          success_rows: number
          total_rows: number
          type: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          created_by: string
          error_rows?: number
          file_name: string
          id?: string
          season_volume_offering_id?: string | null
          status?: string
          success_rows?: number
          total_rows?: number
          type?: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          created_by?: string
          error_rows?: number
          file_name?: string
          id?: string
          season_volume_offering_id?: string | null
          status?: string
          success_rows?: number
          total_rows?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "imports_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imports_season_volume_offering_id_fkey"
            columns: ["season_volume_offering_id"]
            isOneToOne: false
            referencedRelation: "season_volume_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          email: string
          id: string
          intended_role_id: string
          invited_at: string
          invited_by: string
          status: Database["public"]["Enums"]["invitation_status"]
        }
        Insert: {
          accepted_at?: string | null
          email: string
          id?: string
          intended_role_id: string
          invited_at?: string
          invited_by: string
          status?: Database["public"]["Enums"]["invitation_status"]
        }
        Update: {
          accepted_at?: string | null
          email?: string
          id?: string
          intended_role_id?: string
          invited_at?: string
          invited_by?: string
          status?: Database["public"]["Enums"]["invitation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "invitations_intended_role_id_fkey"
            columns: ["intended_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          created_at: string
          id: string
          module_id: string
          name: string
          objectives: string | null
          order_index: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_id: string
          name: string
          objectives?: string | null
          order_index: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          module_id?: string
          name?: string
          objectives?: string | null
          order_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          academic_hours: number | null
          created_at: string
          id: string
          name: string
          order_index: number
          updated_at: string
          volume_id: string
        }
        Insert: {
          academic_hours?: number | null
          created_at?: string
          id?: string
          name: string
          order_index: number
          updated_at?: string
          volume_id: string
        }
        Update: {
          academic_hours?: number | null
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          updated_at?: string
          volume_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          resource: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          resource: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          resource?: string
        }
        Relationships: []
      }
      prerequisite_exceptions: {
        Row: {
          authorized_by: string
          created_at: string
          id: string
          justification: string
          missing_prerequisite_volume_id: string
          student_id: string
          volume_id: string
        }
        Insert: {
          authorized_by: string
          created_at?: string
          id?: string
          justification: string
          missing_prerequisite_volume_id: string
          student_id: string
          volume_id: string
        }
        Update: {
          authorized_by?: string
          created_at?: string
          id?: string
          justification?: string
          missing_prerequisite_volume_id?: string
          student_id?: string
          volume_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prerequisite_exceptions_missing_prerequisite_volume_id_fkey"
            columns: ["missing_prerequisite_volume_id"]
            isOneToOne: false
            referencedRelation: "volumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prerequisite_exceptions_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          birth_date: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          last_access_at: string | null
          phone: string | null
          photo_url: string | null
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          last_access_at?: string | null
          phone?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          last_access_at?: string | null
          phone?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Relationships: []
      }
      question_bank: {
        Row: {
          author_id: string | null
          bible_reference: string | null
          created_at: string
          difficulty: string
          explanation: string | null
          id: string
          lesson_id: string | null
          module_id: string | null
          prompt: string
          selection_mode: string
          status: string
          topic: string | null
          type: Database["public"]["Enums"]["question_type"]
          updated_at: string
          volume_id: string | null
        }
        Insert: {
          author_id?: string | null
          bible_reference?: string | null
          created_at?: string
          difficulty?: string
          explanation?: string | null
          id?: string
          lesson_id?: string | null
          module_id?: string | null
          prompt: string
          selection_mode?: string
          status?: string
          topic?: string | null
          type: Database["public"]["Enums"]["question_type"]
          updated_at?: string
          volume_id?: string | null
        }
        Update: {
          author_id?: string | null
          bible_reference?: string | null
          created_at?: string
          difficulty?: string
          explanation?: string | null
          id?: string
          lesson_id?: string | null
          module_id?: string | null
          prompt?: string
          selection_mode?: string
          status?: string
          topic?: string | null
          type?: Database["public"]["Enums"]["question_type"]
          updated_at?: string
          volume_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      question_options: {
        Row: {
          id: string
          is_correct: boolean
          label: string
          order_index: number
          question_id: string
        }
        Insert: {
          id?: string
          is_correct?: boolean
          label: string
          order_index: number
          question_id: string
        }
        Update: {
          id?: string
          is_correct?: boolean
          label?: string
          order_index?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "question_bank"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_path_items: {
        Row: {
          activity_id: string | null
          assessment_id: string
          content_id: string | null
          created_at: string
          id: string
          order_index: number
        }
        Insert: {
          activity_id?: string | null
          assessment_id: string
          content_id?: string | null
          created_at?: string
          id?: string
          order_index: number
        }
        Update: {
          activity_id?: string | null
          assessment_id?: string
          content_id?: string | null
          created_at?: string
          id?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "recovery_path_items_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recovery_path_items_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recovery_path_items_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
        ]
      }
      release_rules: {
        Row: {
          content_id: string
          created_at: string
          id: string
          release_at: string | null
          released_manually: boolean
          required_activity_id: string | null
          required_content_id: string | null
          required_meeting_id: string | null
          type: Database["public"]["Enums"]["release_rule_type"]
          updated_at: string
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          release_at?: string | null
          released_manually?: boolean
          required_activity_id?: string | null
          required_content_id?: string | null
          required_meeting_id?: string | null
          type: Database["public"]["Enums"]["release_rule_type"]
          updated_at?: string
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          release_at?: string | null
          released_manually?: boolean
          required_activity_id?: string | null
          required_content_id?: string | null
          required_meeting_id?: string | null
          type?: Database["public"]["Enums"]["release_rule_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "release_rules_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "release_rules_required_activity_id_fkey"
            columns: ["required_activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "release_rules_required_content_id_fkey"
            columns: ["required_content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "release_rules_required_meeting_id_fkey"
            columns: ["required_meeting_id"]
            isOneToOne: false
            referencedRelation: "class_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: Database["public"]["Enums"]["role_slug"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: Database["public"]["Enums"]["role_slug"]
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: Database["public"]["Enums"]["role_slug"]
        }
        Relationships: []
      }
      season_volume_offerings: {
        Row: {
          academic_settings: Json
          assessment_close_at: string | null
          assessment_open_at: string | null
          created_at: string
          id: string
          recovery_close_at: string | null
          recovery_open_at: string | null
          season_id: string
          status: string
          updated_at: string
          volume_id: string
        }
        Insert: {
          academic_settings?: Json
          assessment_close_at?: string | null
          assessment_open_at?: string | null
          created_at?: string
          id?: string
          recovery_close_at?: string | null
          recovery_open_at?: string | null
          season_id: string
          status?: string
          updated_at?: string
          volume_id: string
        }
        Update: {
          academic_settings?: Json
          assessment_close_at?: string | null
          assessment_open_at?: string | null
          created_at?: string
          id?: string
          recovery_close_at?: string | null
          recovery_open_at?: string | null
          season_id?: string
          status?: string
          updated_at?: string
          volume_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_volume_offerings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_volume_offerings_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_requests: {
        Row: {
          consent_at: string
          cpf_encrypted: string
          cpf_hash: string
          cpf_last4: string
          created_at: string
          email: string
          full_name: string
          id: string
          notes: string | null
          primary_schedule_slug: string
          primary_volume_slug: string
          prerequisite_declaration: string | null
          privacy_terms_version: string
          protocol: string
          reviewed_at: string | null
          reviewed_by: string | null
          season_id: string
          secondary_schedule_slug: string | null
          secondary_volume_slug: string | null
          status: string
          phone: string
          updated_at: string
          wants_second_volume: boolean
        }
        Insert: {
          consent_at: string
          cpf_encrypted: string
          cpf_hash: string
          cpf_last4: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          notes?: string | null
          primary_schedule_slug: string
          primary_volume_slug: string
          prerequisite_declaration?: string | null
          privacy_terms_version: string
          protocol: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          season_id: string
          secondary_schedule_slug?: string | null
          secondary_volume_slug?: string | null
          status?: string
          phone: string
          updated_at?: string
          wants_second_volume?: boolean
        }
        Update: {
          consent_at?: string
          cpf_encrypted?: string
          cpf_hash?: string
          cpf_last4?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          primary_schedule_slug?: string
          primary_volume_slug?: string
          prerequisite_declaration?: string | null
          privacy_terms_version?: string
          protocol?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          season_id?: string
          secondary_schedule_slug?: string | null
          secondary_volume_slug?: string | null
          status?: string
          phone?: string
          updated_at?: string
          wants_second_volume?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_requests_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          ends_on: string | null
          id: string
          name: string
          starts_on: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_on?: string | null
          id?: string
          name: string
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          id?: string
          name?: string
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_assignments: {
        Row: {
          class_id: string
          created_at: string
          function: string
          id: string
          meeting_id: string | null
          module_id: string | null
          teacher_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          function?: string
          id?: string
          meeting_id?: string | null
          module_id?: string | null
          teacher_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          function?: string
          id?: string
          meeting_id?: string | null
          module_id?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "class_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      video_contents: {
        Row: {
          content_id: string
          duration_seconds: number | null
          min_percent: number
          thumbnail_url: string | null
          youtube_video_id: string
        }
        Insert: {
          content_id: string
          duration_seconds?: number | null
          min_percent?: number
          thumbnail_url?: string | null
          youtube_video_id: string
        }
        Update: {
          content_id?: string
          duration_seconds?: number | null
          min_percent?: number
          thumbnail_url?: string | null
          youtube_video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_contents_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: true
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
        ]
      }
      volume_prerequisites: {
        Row: {
          created_at: string
          prerequisite_volume_id: string
          volume_id: string
        }
        Insert: {
          created_at?: string
          prerequisite_volume_id: string
          volume_id: string
        }
        Update: {
          created_at?: string
          prerequisite_volume_id?: string
          volume_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "volume_prerequisites_prerequisite_volume_id_fkey"
            columns: ["prerequisite_volume_id"]
            isOneToOne: false
            referencedRelation: "volumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volume_prerequisites_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      volumes: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          order_index: number
          presencial_hours: number
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_index: number
          presencial_hours?: number
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          presencial_hours?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_job: {
        Args: { p_types?: string[]; p_worker: string }
        Returns: unknown
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_job: { Args: { p_job_id: string }; Returns: undefined }
      create_class_with_meetings: {
        Args: {
          p_capacity?: number
          p_class_template_id: string
          p_location?: string
          p_name: string
          p_season_volume_offering_id: string
        }
        Returns: {
          capacity: number | null
          class_template_id: string
          created_at: string
          id: string
          location: string | null
          name: string
          season_volume_offering_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "classes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_profile_is_active: { Args: never; Returns: boolean }
      enqueue_job: {
        Args: {
          p_available_at?: string
          p_idempotency_key?: string
          p_max_attempts?: number
          p_payload: Json
          p_type: string
        }
        Returns: unknown
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      evaluate_answer_key_release: { Args: never; Returns: number }
      expire_assessment_attempts: { Args: never; Returns: number }
      fail_job: {
        Args: { p_error: string; p_job_id: string; p_retry?: boolean }
        Returns: undefined
      }
      finalize_assessment_attempt: {
        Args: { p_attempt_id: string }
        Returns: {
          assessment_id: string
          attempt_kind: string
          cancel_reason: string | null
          canceled_at: string | null
          canceled_by: string | null
          correct_count: number | null
          created_at: string
          deadline_at: string
          enrollment_id: string
          id: string
          score: number | null
          started_at: string
          status: Database["public"]["Enums"]["assessment_attempt_status"]
          submitted_at: string | null
          total_count: number | null
        }
        SetofOptions: {
          from: "*"
          to: "assessment_attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_attendance: {
        Args: { p_meeting_id: string }
        Returns: undefined
      }
      get_activity_questions_for_attempt: {
        Args: { p_attempt_id: string }
        Returns: Json
      }
      get_assessment_attempt_questions: {
        Args: { p_attempt_id: string }
        Returns: Json
      }
      get_assessment_attempt_review: {
        Args: { p_attempt_id: string }
        Returns: Json
      }
      has_active_enrollment_in_offering: {
        Args: { p_offering_id: string }
        Returns: boolean
      }
      has_active_enrollment_in_volume: {
        Args: { p_volume_id: string }
        Returns: boolean
      }
      has_role: {
        Args: { check_role: Database["public"]["Enums"]["role_slug"] }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_recovery_path_completed: {
        Args: { p_assessment_id: string; p_enrollment_id: string }
        Returns: boolean
      }
      is_teacher_assigned_to_class: {
        Args: { p_class_id: string }
        Returns: boolean
      }
      publish_assessment: {
        Args: { p_assessment_id: string }
        Returns: {
          answer_key_release_reason:
            | Database["public"]["Enums"]["answer_key_release_reason"]
            | null
          answer_key_released_at: string | null
          closes_at: string | null
          created_at: string
          duration_minutes: number
          id: string
          linked_assessment_id: string | null
          opens_at: string | null
          passing_grade: number
          questions_count: number
          season_volume_offering_id: string
          shuffle_options: boolean
          shuffle_questions: boolean
          status: Database["public"]["Enums"]["assessment_status"]
          title: string
          total_points: number
          type: Database["public"]["Enums"]["assessment_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "assessments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      release_answer_key_manually: {
        Args: { p_assessment_id: string }
        Returns: {
          answer_key_release_reason:
            | Database["public"]["Enums"]["answer_key_release_reason"]
            | null
          answer_key_released_at: string | null
          closes_at: string | null
          created_at: string
          duration_minutes: number
          id: string
          linked_assessment_id: string | null
          opens_at: string | null
          passing_grade: number
          questions_count: number
          season_volume_offering_id: string
          shuffle_options: boolean
          shuffle_questions: boolean
          status: Database["public"]["Enums"]["assessment_status"]
          title: string
          total_points: number
          type: Database["public"]["Enums"]["assessment_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "assessments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_attendance_row: {
        Args: {
          p_enrollment_id: string
          p_justification?: string
          p_meeting_id: string
          p_observation?: string
          p_recognized_minutes: number
          p_status: Database["public"]["Enums"]["attendance_status"]
        }
        Returns: {
          enrollment_id: string
          finalized_at: string | null
          id: string
          meeting_id: string
          observation: string | null
          recognized_minutes: number
          recorded_at: string
          recorded_by: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "attendance_records"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_audit_justification: {
        Args: { p_justification: string }
        Returns: undefined
      }
      start_activity_attempt: {
        Args: { p_activity_id: string }
        Returns: {
          activity_id: string
          correct_count: number | null
          created_at: string
          enrollment_id: string
          id: string
          started_at: string
          status: string
          submitted_at: string | null
          total_count: number | null
        }
        SetofOptions: {
          from: "*"
          to: "activity_attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_assessment_attempt: {
        Args: { p_assessment_id: string }
        Returns: {
          assessment_id: string
          attempt_kind: string
          cancel_reason: string | null
          canceled_at: string | null
          canceled_by: string | null
          correct_count: number | null
          created_at: string
          deadline_at: string
          enrollment_id: string
          id: string
          score: number | null
          started_at: string
          status: Database["public"]["Enums"]["assessment_attempt_status"]
          submitted_at: string | null
          total_count: number | null
        }
        SetofOptions: {
          from: "*"
          to: "assessment_attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_activity_attempt: {
        Args: { p_answers: Json; p_attempt_id: string }
        Returns: Json
      }
      submit_assessment_answer: {
        Args: {
          p_attempt_id: string
          p_question_id: string
          p_selected_option_ids: Json
        }
        Returns: Json
      }
    }
    Enums: {
      answer_key_release_reason: "all_submitted" | "deadline" | "manual"
      assessment_attempt_status:
        | "in_progress"
        | "submitted"
        | "expired"
        | "canceled"
      assessment_status: "draft" | "open" | "closed"
      assessment_type: "final" | "recovery"
      attendance_status:
        | "presente"
        | "ausente"
        | "atrasado"
        | "presenca_parcial"
        | "falta_justificada"
        | "reposicao"
        | "pendente"
      content_classification:
        | "obrigatorio"
        | "complementar"
        | "preparatorio"
        | "aprofundamento"
        | "revisao"
        | "exclusivo_professor"
        | "exclusivo_coordenacao"
        | "exclusivo_administracao"
      content_status: "draft" | "published" | "archived"
      content_type: "video" | "file" | "text" | "link"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      profile_status: "active" | "suspended"
      question_type:
        | "multiple_choice"
        | "true_false"
        | "matching"
        | "ordering"
        | "fill_in_blank"
      release_rule_type:
        | "immediate"
        | "date"
        | "manual"
        | "after_content"
        | "after_activity"
        | "after_meeting"
      role_slug:
        | "student"
        | "teacher"
        | "coordinator"
        | "admin"
        | "content_editor"
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
      answer_key_release_reason: ["all_submitted", "deadline", "manual"],
      assessment_attempt_status: [
        "in_progress",
        "submitted",
        "expired",
        "canceled",
      ],
      assessment_status: ["draft", "open", "closed"],
      assessment_type: ["final", "recovery"],
      attendance_status: [
        "presente",
        "ausente",
        "atrasado",
        "presenca_parcial",
        "falta_justificada",
        "reposicao",
        "pendente",
      ],
      content_classification: [
        "obrigatorio",
        "complementar",
        "preparatorio",
        "aprofundamento",
        "revisao",
        "exclusivo_professor",
        "exclusivo_coordenacao",
        "exclusivo_administracao",
      ],
      content_status: ["draft", "published", "archived"],
      content_type: ["video", "file", "text", "link"],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      profile_status: ["active", "suspended"],
      question_type: [
        "multiple_choice",
        "true_false",
        "matching",
        "ordering",
        "fill_in_blank",
      ],
      release_rule_type: [
        "immediate",
        "date",
        "manual",
        "after_content",
        "after_activity",
        "after_meeting",
      ],
      role_slug: [
        "student",
        "teacher",
        "coordinator",
        "admin",
        "content_editor",
      ],
    },
  },
} as const

// --- Aliases de conveniência (mantidos manualmente após cada regeneração) --
// Os que existem como enum real no Postgres derivam de Database["public"]["Enums"];
// os que são `text` com CHECK constraint (sem enum no banco) ficam como
// union literal explícita — igual ao placeholder original desta Fase 1.
export type RoleSlug = Database["public"]["Enums"]["role_slug"];
export type ProfileStatus = Database["public"]["Enums"]["profile_status"];
export type InvitationStatus = Database["public"]["Enums"]["invitation_status"];
export type SeasonStatus = "planning" | "open" | "closed" | "archived";
export type OfferingStatus = "draft" | "open" | "closed";
export type ClassStatus = "planning" | "open" | "closed";
export type MeetingStatus = "scheduled" | "done" | "canceled";
export type EnrollmentStatus =
  | "active"
  | "regularization"
  | "approved"
  | "failed"
  | "canceled"
  | "withdrawn";
export type ImportStatus =
  | "processing"
  | "completed"
  | "completed_with_errors"
  | "failed";
export type ImportRowStatus = "pending" | "success" | "error";

export type ContentType = Database["public"]["Enums"]["content_type"];
export type ContentClassification = Database["public"]["Enums"]["content_classification"];
export type ContentStatus = Database["public"]["Enums"]["content_status"];
export type ReleaseRuleType = Database["public"]["Enums"]["release_rule_type"];
export type QuestionType = Database["public"]["Enums"]["question_type"];
export type QuestionDifficulty = "facil" | "medio" | "dificil";
export type ContentAuthoringStatus = "draft" | "published" | "archived";
export type ActivityAttemptStatus = "in_progress" | "submitted";
export type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];
export type QuestionSelectionMode = "single" | "multiple";
export type AssessmentType = Database["public"]["Enums"]["assessment_type"];
export type AssessmentStatus = Database["public"]["Enums"]["assessment_status"];
export type AnswerKeyReleaseReason = Database["public"]["Enums"]["answer_key_release_reason"];
export type AssessmentAttemptStatus = Database["public"]["Enums"]["assessment_attempt_status"];
export type AssessmentAttemptKind = "regular" | "exceptional";
