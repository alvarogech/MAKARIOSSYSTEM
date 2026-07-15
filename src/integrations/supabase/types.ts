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

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      role_slug: RoleSlug;
      profile_status: ProfileStatus;
      invitation_status: InvitationStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
