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
      article_feedback: {
        Row: {
          comment: string | null
          created_at: string
          helpful: boolean
          id: string
          node_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          helpful: boolean
          id?: string
          node_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          helpful?: boolean
          id?: string
          node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_feedback_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          content_html: string | null
          content_json: Json
          content_text: string | null
          cover_image: string | null
          excerpt: string | null
          id: string
          meta: Json
          node_id: string
          published_at: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          content_html?: string | null
          content_json?: Json
          content_text?: string | null
          cover_image?: string | null
          excerpt?: string | null
          id?: string
          meta?: Json
          node_id: string
          published_at?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          content_html?: string | null
          content_json?: Json
          content_text?: string | null
          cover_image?: string | null
          excerpt?: string | null
          id?: string
          meta?: Json
          node_id?: string
          published_at?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "articles_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: true
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          alt_text: string | null
          checksum: string | null
          created_at: string
          height: number | null
          id: string
          mime: string | null
          size_bytes: number | null
          space_id: string | null
          storage_path: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          checksum?: string | null
          created_at?: string
          height?: number | null
          id?: string
          mime?: string | null
          size_bytes?: number | null
          space_id?: string | null
          storage_path: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          checksum?: string | null
          created_at?: string
          height?: number | null
          id?: string
          mime?: string | null
          size_bytes?: number | null
          space_id?: string | null
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip: string | null
          space_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip?: string | null
          space_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip?: string | null
          space_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      chunks: {
        Row: {
          article_id: string
          content: string
          embedding: string | null
          heading_path: string | null
          id: string
          node_id: string
          space_id: string
          token_count: number | null
          tsv: unknown
        }
        Insert: {
          article_id: string
          content: string
          embedding?: string | null
          heading_path?: string | null
          id?: string
          node_id: string
          space_id: string
          token_count?: number | null
          tsv?: unknown
        }
        Update: {
          article_id?: string
          content?: string
          embedding?: string | null
          heading_path?: string | null
          id?: string
          node_id?: string
          space_id?: string
          token_count?: number | null
          tsv?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "chunks_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunks_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chunks_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          error: string | null
          extracted: Json | null
          id: string
          log: Json
          mime: string | null
          original_name: string | null
          progress: number
          result_tree: Json | null
          size_bytes: number | null
          source_file: string
          space_id: string
          status: string
          target_parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          extracted?: Json | null
          id?: string
          log?: Json
          mime?: string | null
          original_name?: string | null
          progress?: number
          result_tree?: Json | null
          size_bytes?: number | null
          source_file: string
          space_id: string
          status?: string
          target_parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error?: string | null
          extracted?: Json | null
          id?: string
          log?: Json
          mime?: string | null
          original_name?: string | null
          progress?: number
          result_tree?: Json | null
          size_bytes?: number | null
          source_file?: string
          space_id?: string
          status?: string
          target_parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_target_parent_id_fkey"
            columns: ["target_parent_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role_id: string
          space_id: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role_id: string
          space_id?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role_id?: string
          space_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          node_id: string | null
          role_id: string
          space_id: string | null
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          node_id?: string | null
          role_id: string
          space_id?: string | null
          user_id: string
        }
        Update: {
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          node_id?: string | null
          role_id?: string
          space_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_space_fk"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      nodes: {
        Row: {
          created_at: string
          deleted_at: string | null
          icon: string | null
          id: string
          link_url: string | null
          parent_id: string | null
          path: unknown
          position: string
          published_at: string | null
          slug: string
          space_id: string
          status: string
          title: string
          type: string
          updated_at: string
          visibility: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          icon?: string | null
          id?: string
          link_url?: string | null
          parent_id?: string | null
          path?: unknown
          position: string
          published_at?: string | null
          slug: string
          space_id: string
          status?: string
          title?: string
          type: string
          updated_at?: string
          visibility?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          icon?: string | null
          id?: string
          link_url?: string | null
          parent_id?: string | null
          path?: unknown
          position?: string
          published_at?: string | null
          slug?: string
          space_id?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nodes_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          description: string | null
          id: string
          key: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_seen_at: string | null
          status: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          last_seen_at?: string | null
          status?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_seen_at?: string | null
          status?: string
        }
        Relationships: []
      }
      redirects: {
        Row: {
          created_at: string
          from_path: string
          id: string
          space_id: string
          to_node_id: string | null
        }
        Insert: {
          created_at?: string
          from_path: string
          id?: string
          space_id: string
          to_node_id?: string | null
        }
        Update: {
          created_at?: string
          from_path?: string
          id?: string
          space_id?: string
          to_node_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "redirects_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redirects_to_node_id_fkey"
            columns: ["to_node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
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
          description: string | null
          id: string
          is_system: boolean
          key: string
          level: number
          name: string
        }
        Insert: {
          description?: string | null
          id?: string
          is_system?: boolean
          key: string
          level: number
          name: string
        }
        Update: {
          description?: string | null
          id?: string
          is_system?: boolean
          key?: string
          level?: number
          name?: string
        }
        Relationships: []
      }
      search_logs: {
        Row: {
          created_at: string
          id: string
          query: string
          results_count: number
          space_id: string | null
          user_ref: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          results_count?: number
          space_id?: string | null
          user_ref?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          results_count?: number
          space_id?: string | null
          user_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_logs_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      snippets: {
        Row: {
          content_json: Json
          id: string
          key: string
          space_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content_json?: Json
          id?: string
          key: string
          space_id: string
          title: string
          updated_at?: string
        }
        Update: {
          content_json?: Json
          id?: string
          key?: string
          space_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "snippets_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          created_at: string
          custom_domain: string | null
          id: string
          name: string
          parent_space_id: string | null
          slug: string
          theme: Json
          type: string
          visibility: string
        }
        Insert: {
          created_at?: string
          custom_domain?: string | null
          id?: string
          name: string
          parent_space_id?: string | null
          slug: string
          theme?: Json
          type?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          custom_domain?: string | null
          id?: string
          name?: string
          parent_space_id?: string | null
          slug?: string
          theme?: Json
          type?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "spaces_parent_space_id_fkey"
            columns: ["parent_space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      f_unaccent: { Args: { "": string }; Returns: string }
      has_permission: {
        Args: {
          p_permission_key: string
          p_space_id?: string
          p_user_id: string
        }
        Returns: boolean
      }
      hybrid_search: {
        Args: { p_limit?: number; p_query: string; p_space_id?: string }
        Returns: {
          heading_path: string
          node_id: string
          score: number
          snippet: string
          title: string
        }[]
      }
      max_role_level: {
        Args: { p_space_id?: string; p_user_id: string }
        Returns: number
      }
      move_node: {
        Args: { p_new_parent_id: string; p_node_id: string; p_position: string }
        Returns: undefined
      }
      node_label: { Args: { p_id: string }; Returns: string }
      restore_subtree: { Args: { p_node_id: string }; Returns: number }
      soft_delete_subtree: { Args: { p_node_id: string }; Returns: number }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
