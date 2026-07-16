/**
 * Tipos TypeScript gerados a partir do schema do Supabase.
 *
 * Este arquivo é um placeholder mínimo, escrito à mão para as tabelas já
 * criadas pelas migrations da Fase 1 (ver supabase/migrations/), para que o
 * projeto compile e tenha alguma tipagem antes da primeira geração real.
 *
 * Assim que houver um projeto Supabase (local ou remoto) acessível, regenere
 * este arquivo com o comando oficial (documentado em supabase/README.md):
 *
 *   supabase gen types typescript --local > src/integrations/supabase/types.ts
 *
 * Não edite manualmente depois de gerado — a próxima geração sobrescreve.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type RoleSlug =
  | "student"
  | "teacher"
  | "coordinator"
  | "admin"
  | "content_editor";

export type ProfileStatus = "active" | "suspended";
export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";
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

export type ContentType = "video" | "file" | "text" | "link";
export type ContentClassification =
  | "obrigatorio"
  | "complementar"
  | "preparatorio"
  | "aprofundamento"
  | "revisao"
  | "exclusivo_professor"
  | "exclusivo_coordenacao"
  | "exclusivo_administracao";
export type ContentStatus = "draft" | "published" | "archived";
export type ReleaseRuleType =
  | "immediate"
  | "date"
  | "manual"
  | "after_content"
  | "after_activity"
  | "after_meeting";
export type QuestionType =
  | "multiple_choice"
  | "true_false"
  | "matching"
  | "ordering"
  | "fill_in_blank";
export type QuestionDifficulty = "facil" | "medio" | "dificil";
export type ContentAuthoringStatus = "draft" | "published" | "archived";
export type ActivityAttemptStatus = "in_progress" | "submitted";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          birth_date: string | null;
          photo_url: string | null;
          status: ProfileStatus;
          last_access_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          birth_date?: string | null;
          photo_url?: string | null;
          status?: ProfileStatus;
          last_access_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      roles: {
        Row: {
          id: string;
          slug: RoleSlug;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: RoleSlug;
          name: string;
          description?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["roles"]["Insert"]>;
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      invitations: {
        Row: {
          id: string;
          email: string;
          intended_role_id: string;
          status: InvitationStatus;
          invited_by: string;
          invited_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          intended_role_id: string;
          status?: InvitationStatus;
          invited_by: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["invitations"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "invitations_intended_role_id_fkey";
            columns: ["intended_role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      permissions: {
        Row: {
          id: string;
          resource: string;
          action: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          resource: string;
          action: string;
          description?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["permissions"]["Insert"]
        >;
        Relationships: [];
      };
      role_permissions: {
        Row: {
          role_id: string;
          permission_id: string;
          created_at: string;
        };
        Insert: {
          role_id: string;
          permission_id: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["role_permissions"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "role_permissions_permission_id_fkey";
            columns: ["permission_id"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["id"];
          },
        ];
      };
      volumes: {
        Row: {
          id: string;
          slug: string;
          name: string;
          order_index: number;
          description: string | null;
          presencial_hours: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          order_index: number;
          description?: string | null;
          presencial_hours?: number;
          active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["volumes"]["Insert"]>;
        Relationships: [];
      };
      volume_prerequisites: {
        Row: {
          volume_id: string;
          prerequisite_volume_id: string;
          created_at: string;
        };
        Insert: {
          volume_id: string;
          prerequisite_volume_id: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["volume_prerequisites"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "volume_prerequisites_volume_id_fkey";
            columns: ["volume_id"];
            isOneToOne: false;
            referencedRelation: "volumes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "volume_prerequisites_prerequisite_volume_id_fkey";
            columns: ["prerequisite_volume_id"];
            isOneToOne: false;
            referencedRelation: "volumes";
            referencedColumns: ["id"];
          },
        ];
      };
      prerequisite_exceptions: {
        Row: {
          id: string;
          student_id: string;
          volume_id: string;
          missing_prerequisite_volume_id: string;
          justification: string;
          authorized_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          volume_id: string;
          missing_prerequisite_volume_id: string;
          justification: string;
          authorized_by: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["prerequisite_exceptions"]["Insert"]
        >;
        Relationships: [];
      };
      seasons: {
        Row: {
          id: string;
          name: string;
          starts_on: string | null;
          ends_on: string | null;
          status: SeasonStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          starts_on?: string | null;
          ends_on?: string | null;
          status?: SeasonStatus;
        };
        Update: Partial<Database["public"]["Tables"]["seasons"]["Insert"]>;
        Relationships: [];
      };
      class_templates: {
        Row: {
          id: string;
          slug: string;
          name: string;
          weekdays: string[];
          start_time: string;
          end_time: string;
          break_minutes: number;
          meetings_count: number;
          academic_minutes_per_meeting: number;
          total_academic_minutes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          weekdays: string[];
          start_time: string;
          end_time: string;
          break_minutes?: number;
          meetings_count: number;
          academic_minutes_per_meeting: number;
          total_academic_minutes: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["class_templates"]["Insert"]
        >;
        Relationships: [];
      };
      season_volume_offerings: {
        Row: {
          id: string;
          season_id: string;
          volume_id: string;
          status: OfferingStatus;
          assessment_open_at: string | null;
          assessment_close_at: string | null;
          recovery_open_at: string | null;
          recovery_close_at: string | null;
          academic_settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          season_id: string;
          volume_id: string;
          status?: OfferingStatus;
          assessment_open_at?: string | null;
          assessment_close_at?: string | null;
          recovery_open_at?: string | null;
          recovery_close_at?: string | null;
          academic_settings?: Json;
        };
        Update: Partial<
          Database["public"]["Tables"]["season_volume_offerings"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "season_volume_offerings_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "season_volume_offerings_volume_id_fkey";
            columns: ["volume_id"];
            isOneToOne: false;
            referencedRelation: "volumes";
            referencedColumns: ["id"];
          },
        ];
      };
      classes: {
        Row: {
          id: string;
          season_volume_offering_id: string;
          class_template_id: string;
          name: string;
          location: string | null;
          capacity: number | null;
          status: ClassStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          season_volume_offering_id: string;
          class_template_id: string;
          name: string;
          location?: string | null;
          capacity?: number | null;
          status?: ClassStatus;
        };
        Update: Partial<Database["public"]["Tables"]["classes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "classes_season_volume_offering_id_fkey";
            columns: ["season_volume_offering_id"];
            isOneToOne: false;
            referencedRelation: "season_volume_offerings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classes_class_template_id_fkey";
            columns: ["class_template_id"];
            isOneToOne: false;
            referencedRelation: "class_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      class_meetings: {
        Row: {
          id: string;
          class_id: string;
          sequence: number;
          meeting_date: string | null;
          start_time: string | null;
          end_time: string | null;
          break_minutes: number;
          academic_minutes: number;
          location: string | null;
          status: MeetingStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          sequence: number;
          meeting_date?: string | null;
          start_time?: string | null;
          end_time?: string | null;
          break_minutes?: number;
          academic_minutes: number;
          location?: string | null;
          status?: MeetingStatus;
        };
        Update: Partial<
          Database["public"]["Tables"]["class_meetings"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "class_meetings_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_assignments: {
        Row: {
          id: string;
          teacher_id: string;
          class_id: string;
          meeting_id: string | null;
          function: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          class_id: string;
          meeting_id?: string | null;
          function?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["teacher_assignments"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_assignments_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "class_meetings";
            referencedColumns: ["id"];
          },
        ];
      };
      enrollments: {
        Row: {
          id: string;
          student_id: string;
          season_volume_offering_id: string;
          class_id: string;
          status: EnrollmentStatus;
          authorized_at: string;
          authorized_by: string;
          final_grade: number | null;
          final_attendance_percent: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          season_volume_offering_id: string;
          class_id: string;
          status?: EnrollmentStatus;
          authorized_by: string;
          final_grade?: number | null;
          final_attendance_percent?: number | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["enrollments"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "enrollments_season_volume_offering_id_fkey";
            columns: ["season_volume_offering_id"];
            isOneToOne: false;
            referencedRelation: "season_volume_offerings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      imports: {
        Row: {
          id: string;
          type: "students";
          file_name: string;
          status: ImportStatus;
          total_rows: number;
          success_rows: number;
          error_rows: number;
          season_volume_offering_id: string | null;
          class_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          type?: "students";
          file_name: string;
          status?: ImportStatus;
          total_rows?: number;
          success_rows?: number;
          error_rows?: number;
          season_volume_offering_id?: string | null;
          class_id?: string | null;
          created_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["imports"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "imports_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      import_rows: {
        Row: {
          id: string;
          import_id: string;
          row_number: number;
          raw_data: Json;
          status: ImportRowStatus;
          errors: string[];
          created_user_id: string | null;
          created_enrollment_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          import_id: string;
          row_number: number;
          raw_data: Json;
          status?: ImportRowStatus;
          errors?: string[];
          created_user_id?: string | null;
          created_enrollment_id?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["import_rows"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "import_rows_import_id_fkey";
            columns: ["import_id"];
            isOneToOne: false;
            referencedRelation: "imports";
            referencedColumns: ["id"];
          },
        ];
      };
      modules: {
        Row: {
          id: string;
          volume_id: string;
          name: string;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          volume_id: string;
          name: string;
          order_index: number;
        };
        Update: Partial<Database["public"]["Tables"]["modules"]["Insert"]>;
        Relationships: [];
      };
      lessons: {
        Row: {
          id: string;
          module_id: string;
          name: string;
          objectives: string | null;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          module_id: string;
          name: string;
          objectives?: string | null;
          order_index: number;
        };
        Update: Partial<Database["public"]["Tables"]["lessons"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey";
            columns: ["module_id"];
            isOneToOne: false;
            referencedRelation: "modules";
            referencedColumns: ["id"];
          },
        ];
      };
      contents: {
        Row: {
          id: string;
          lesson_id: string;
          volume_id: string;
          title: string;
          description: string | null;
          type: ContentType;
          classification: ContentClassification;
          estimated_minutes: number | null;
          order_index: number;
          status: ContentStatus;
          allow_download: boolean;
          body: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          volume_id: string;
          title: string;
          description?: string | null;
          type: ContentType;
          classification?: ContentClassification;
          estimated_minutes?: number | null;
          order_index: number;
          status?: ContentStatus;
          allow_download?: boolean;
          body?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["contents"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "contents_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      video_contents: {
        Row: {
          content_id: string;
          youtube_video_id: string;
          min_percent: number;
          duration_seconds: number | null;
          thumbnail_url: string | null;
        };
        Insert: {
          content_id: string;
          youtube_video_id: string;
          min_percent?: number;
          duration_seconds?: number | null;
          thumbnail_url?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["video_contents"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "video_contents_content_id_fkey";
            columns: ["content_id"];
            isOneToOne: true;
            referencedRelation: "contents";
            referencedColumns: ["id"];
          },
        ];
      };
      content_files: {
        Row: {
          id: string;
          content_id: string;
          file_name: string;
          file_url: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          content_id: string;
          file_name: string;
          file_url: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["content_files"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "content_files_content_id_fkey";
            columns: ["content_id"];
            isOneToOne: false;
            referencedRelation: "contents";
            referencedColumns: ["id"];
          },
        ];
      };
      question_bank: {
        Row: {
          id: string;
          volume_id: string | null;
          module_id: string | null;
          lesson_id: string | null;
          type: QuestionType;
          prompt: string;
          explanation: string | null;
          bible_reference: string | null;
          topic: string | null;
          difficulty: QuestionDifficulty;
          status: ContentAuthoringStatus;
          author_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          volume_id?: string | null;
          module_id?: string | null;
          lesson_id?: string | null;
          type: QuestionType;
          prompt: string;
          explanation?: string | null;
          bible_reference?: string | null;
          topic?: string | null;
          difficulty?: QuestionDifficulty;
          status?: ContentAuthoringStatus;
          author_id?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["question_bank"]["Insert"]
        >;
        Relationships: [];
      };
      question_options: {
        Row: {
          id: string;
          question_id: string;
          label: string;
          is_correct: boolean;
          order_index: number;
        };
        Insert: {
          id?: string;
          question_id: string;
          label: string;
          is_correct?: boolean;
          order_index: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["question_options"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "question_options_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "question_bank";
            referencedColumns: ["id"];
          },
        ];
      };
      activities: {
        Row: {
          id: string;
          lesson_id: string;
          title: string;
          instructions: string | null;
          max_attempts: number | null;
          blocks_progress: boolean;
          show_feedback_after_submit: boolean;
          status: ContentAuthoringStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          title: string;
          instructions?: string | null;
          max_attempts?: number | null;
          blocks_progress?: boolean;
          show_feedback_after_submit?: boolean;
          status?: ContentAuthoringStatus;
        };
        Update: Partial<Database["public"]["Tables"]["activities"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "activities_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_questions: {
        Row: {
          activity_id: string;
          question_id: string;
          order_index: number;
        };
        Insert: {
          activity_id: string;
          question_id: string;
          order_index: number;
        };
        Update: Partial<
          Database["public"]["Tables"]["activity_questions"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "activity_questions_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_questions_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "question_bank";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_attempts: {
        Row: {
          id: string;
          enrollment_id: string;
          activity_id: string;
          started_at: string;
          submitted_at: string | null;
          correct_count: number | null;
          total_count: number | null;
          status: ActivityAttemptStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          enrollment_id: string;
          activity_id: string;
          status?: ActivityAttemptStatus;
        };
        Update: Partial<
          Database["public"]["Tables"]["activity_attempts"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "activity_attempts_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_answers: {
        Row: {
          id: string;
          attempt_id: string;
          question_id: string;
          selected_option_ids: string[];
          is_correct: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          attempt_id: string;
          question_id: string;
          selected_option_ids?: string[];
          is_correct?: boolean | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["activity_answers"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "activity_answers_attempt_id_fkey";
            columns: ["attempt_id"];
            isOneToOne: false;
            referencedRelation: "activity_attempts";
            referencedColumns: ["id"];
          },
        ];
      };
      release_rules: {
        Row: {
          id: string;
          content_id: string;
          type: ReleaseRuleType;
          release_at: string | null;
          required_content_id: string | null;
          required_activity_id: string | null;
          required_meeting_id: string | null;
          released_manually: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          content_id: string;
          type: ReleaseRuleType;
          release_at?: string | null;
          required_content_id?: string | null;
          required_activity_id?: string | null;
          required_meeting_id?: string | null;
          released_manually?: boolean;
        };
        Update: Partial<
          Database["public"]["Tables"]["release_rules"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "release_rules_content_id_fkey";
            columns: ["content_id"];
            isOneToOne: false;
            referencedRelation: "contents";
            referencedColumns: ["id"];
          },
        ];
      };
      content_progress: {
        Row: {
          id: string;
          enrollment_id: string;
          content_id: string;
          started_at: string | null;
          last_position_seconds: number | null;
          percent: number;
          completed_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          enrollment_id: string;
          content_id: string;
          started_at?: string | null;
          last_position_seconds?: number | null;
          percent?: number;
          completed_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["content_progress"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "content_progress_content_id_fkey";
            columns: ["content_id"];
            isOneToOne: false;
            referencedRelation: "contents";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_class_with_meetings: {
        Args: {
          p_season_volume_offering_id: string;
          p_class_template_id: string;
          p_name: string;
          p_location?: string | null;
          p_capacity?: number | null;
        };
        Returns: Database["public"]["Tables"]["classes"]["Row"];
      };
      start_activity_attempt: {
        Args: { p_activity_id: string };
        Returns: Database["public"]["Tables"]["activity_attempts"]["Row"];
      };
      get_activity_questions_for_attempt: {
        Args: { p_attempt_id: string };
        Returns: Json;
      };
      submit_activity_attempt: {
        Args: { p_attempt_id: string; p_answers: Json };
        Returns: Json;
      };
    };
    Enums: {
      role_slug: RoleSlug;
      profile_status: ProfileStatus;
      invitation_status: InvitationStatus;
    };
    // Demais status (season/offering/class/meeting/enrollment/import) são
    // `text` com `check` no banco (não enums Postgres nomeados) — ver
    // migrations 00000000000015 a 00000000000018.
    CompositeTypes: Record<string, never>;
  };
}
