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
      whatsapp_events: {
        Row: {
          created_at: string
          message_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
        }
        Update: {
          created_at?: string
          message_id?: string
        }
        Relationships: []
      }
      whatsapp_settings: {
        Row: {
          active: boolean
          business_account_id: string | null
          id: boolean
          identity_auth_type: string
          identity_endpoint: string | null
          identity_map: Json
          identity_method: string
          identity_phone_local: string
          identity_phone_param: string
          phone_number_id: string | null
          unidentified_message: string
          updated_at: string
          updated_by: string | null
          waba_id: string | null
        }
        Insert: {
          active?: boolean
          business_account_id?: string | null
          id?: boolean
          identity_auth_type?: string
          identity_endpoint?: string | null
          identity_map?: Json
          identity_method?: string
          identity_phone_local?: string
          identity_phone_param?: string
          phone_number_id?: string | null
          unidentified_message?: string
          updated_at?: string
          updated_by?: string | null
          waba_id?: string | null
        }
        Update: {
          active?: boolean
          business_account_id?: string | null
          id?: boolean
          identity_auth_type?: string
          identity_endpoint?: string | null
          identity_map?: Json
          identity_method?: string
          identity_phone_local?: string
          identity_phone_param?: string
          phone_number_id?: string | null
          unidentified_message?: string
          updated_at?: string
          updated_by?: string | null
          waba_id?: string | null
        }
        Relationships: []
      }
      whatsapp_secrets: {
        Row: {
          access_token_enc: string | null
          app_secret_enc: string | null
          id: boolean
          identity_secret_enc: string | null
          updated_at: string
          verify_token_enc: string | null
        }
        Insert: {
          access_token_enc?: string | null
          app_secret_enc?: string | null
          id?: boolean
          identity_secret_enc?: string | null
          updated_at?: string
          verify_token_enc?: string | null
        }
        Update: {
          access_token_enc?: string | null
          app_secret_enc?: string | null
          id?: boolean
          identity_secret_enc?: string | null
          updated_at?: string
          verify_token_enc?: string | null
        }
        Relationships: []
      }
      ai_agent_tools: {
        Row: {
          agent_id: string
          tool_id: string
        }
        Insert: {
          agent_id: string
          tool_id: string
        }
        Update: {
          agent_id?: string
          tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_tools_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_tools_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "ai_tools"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string
          id: string
          key: string
          model: string | null
          name: string
          parent_agent_id: string | null
          priority: number
          provider_id: string | null
          requires_perfil: string | null
          scope_permission: string | null
          system_prompt: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          key: string
          model?: string | null
          name: string
          parent_agent_id?: string | null
          priority?: number
          provider_id?: string | null
          requires_perfil?: string | null
          scope_permission?: string | null
          system_prompt?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          key?: string
          model?: string | null
          name?: string
          parent_agent_id?: string | null
          priority?: number
          provider_id?: string | null
          requires_perfil?: string | null
          scope_permission?: string | null
          system_prompt?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_parent_agent_id_fkey"
            columns: ["parent_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_base_credential_secrets: {
        Row: {
          credential_id: string
          secret_enc: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          credential_id: string
          secret_enc: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          credential_id?: string
          secret_enc?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_base_credential_secrets_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: true
            referencedRelation: "ai_base_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_base_credentials: {
        Row: {
          active: boolean
          auth_type: string
          base_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          auth_type: string
          base_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          auth_type?: string
          base_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_base_credentials_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "ai_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_base_tools: {
        Row: {
          base_id: string
          base_url: string | null
          credential_id: string | null
          enabled: boolean
          tool_id: string
        }
        Insert: {
          base_id: string
          base_url?: string | null
          credential_id?: string | null
          enabled?: boolean
          tool_id: string
        }
        Update: {
          base_id?: string
          base_url?: string | null
          credential_id?: string | null
          enabled?: boolean
          tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_base_tools_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "ai_bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_base_tools_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "ai_base_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_base_tools_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "ai_tools"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_base_spaces: {
        Row: {
          base_id: string
          position: number
          space_id: string
        }
        Insert: {
          base_id: string
          position?: number
          space_id: string
        }
        Update: {
          base_id?: string
          position?: number
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_base_spaces_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "ai_bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_base_spaces_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_bases: {
        Row: {
          active: boolean
          base_code: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_tools: {
        Row: {
          active: boolean
          body_mode: string | null
          created_at: string
          created_by: string | null
          auth_type: string
          description: string
          id: string
          key: string
          method: string
          name: string
          params: Json
          path_template: string
          response_hint: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          body_mode?: string | null
          created_at?: string
          created_by?: string | null
          auth_type?: string
          description: string
          id?: string
          key: string
          method?: string
          name: string
          params?: Json
          path_template?: string
          response_hint?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          body_mode?: string | null
          created_at?: string
          created_by?: string | null
          auth_type?: string
          description?: string
          id?: string
          key?: string
          method?: string
          name?: string
          params?: Json
          path_template?: string
          response_hint?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_assignments: {
        Row: {
          model: string
          params: Json
          provider_id: string
          purpose: string
          updated_at: string
        }
        Insert: {
          model: string
          params?: Json
          provider_id: string
          purpose: string
          updated_at?: string
        }
        Update: {
          model?: string
          params?: Json
          provider_id?: string
          purpose?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_assignments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_provider_keys: {
        Row: {
          api_key_enc: string
          provider_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_key_enc: string
          provider_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_key_enc?: string
          provider_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_provider_keys_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_providers: {
        Row: {
          active: boolean
          base_url: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          name: string
        }
        Insert: {
          active?: boolean
          base_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          name: string
        }
        Update: {
          active?: boolean
          base_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          created_at: string
          id: string
          input_tokens: number
          kind: string
          model: string
          output_tokens: number
          p_base: string | null
          p_empresa: string | null
          p_matricula: string | null
          p_perfil: string | null
          p_portal: string | null
          p_usuario: string | null
          provider: string
          purpose: string
          total_tokens: number
        }
        Insert: {
          created_at?: string
          id?: string
          input_tokens?: number
          kind?: string
          model: string
          output_tokens?: number
          p_base?: string | null
          p_empresa?: string | null
          p_matricula?: string | null
          p_perfil?: string | null
          p_portal?: string | null
          p_usuario?: string | null
          provider: string
          purpose: string
          total_tokens?: number
        }
        Update: {
          created_at?: string
          id?: string
          input_tokens?: number
          kind?: string
          model?: string
          output_tokens?: number
          p_base?: string | null
          p_empresa?: string | null
          p_matricula?: string | null
          p_perfil?: string | null
          p_portal?: string | null
          p_usuario?: string | null
          provider?: string
          purpose?: string
          total_tokens?: number
        }
        Relationships: []
      }
      author_profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          bio: string | null
          created_at: string
          id: string
          public_name: string
          slug: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id: string
          public_name: string
          slug: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          public_name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "author_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      article_views: {
        Row: {
          day: string
          node_id: string
          views: number
        }
        Insert: {
          day?: string
          node_id: string
          views?: number
        }
        Update: {
          day?: string
          node_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "article_views_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
        ]
      }
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
      article_templates: {
        Row: {
          blocks: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          space_id: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          space_id: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_templates_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      article_versions: {
        Row: {
          article_id: string
          content_json: Json
          content_text: string | null
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          protected: boolean
          version: number
        }
        Insert: {
          article_id: string
          content_json: Json
          content_text?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          protected?: boolean
          version: number
        }
        Update: {
          article_id?: string
          content_json?: Json
          content_text?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          protected?: boolean
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "article_versions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      article_drafts: {
        Row: {
          content_json: Json
          node_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content_json: Json
          node_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content_json?: Json
          node_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "article_drafts_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: true
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
          embedding_context: string | null
          embedding_context_hash: string | null
          excerpt: string | null
          id: string
          meta: Json
          node_id: string
          ontology_at: string | null
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
          embedding_context?: string | null
          embedding_context_hash?: string | null
          excerpt?: string | null
          id?: string
          meta?: Json
          node_id: string
          ontology_at?: string | null
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
          embedding_context?: string | null
          embedding_context_hash?: string | null
          excerpt?: string | null
          id?: string
          meta?: Json
          node_id?: string
          ontology_at?: string | null
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
      backup_jobs: {
        Row: {
          bytes: number | null
          created_at: string
          created_by: string | null
          error: string | null
          files_count: number | null
          id: string
          include_storage: boolean
          kind: string
          phase: string | null
          progress: number
          rows_count: number | null
          source_backup_id: string | null
          status: string
          storage_path: string | null
          tables_count: number | null
          updated_at: string
        }
        Insert: {
          bytes?: number | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          files_count?: number | null
          id?: string
          include_storage?: boolean
          kind?: string
          phase?: string | null
          progress?: number
          rows_count?: number | null
          source_backup_id?: string | null
          status?: string
          storage_path?: string | null
          tables_count?: number | null
          updated_at?: string
        }
        Update: {
          bytes?: number | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          files_count?: number | null
          id?: string
          include_storage?: boolean
          kind?: string
          phase?: string | null
          progress?: number
          rows_count?: number | null
          source_backup_id?: string | null
          status?: string
          storage_path?: string | null
          tables_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "backup_jobs_source_backup_id_fkey"
            columns: ["source_backup_id"]
            isOneToOne: false
            referencedRelation: "backup_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_settings: {
        Row: {
          auto_enabled: boolean
          frequency: string
          github_branch: string
          github_path: string
          github_repo: string | null
          hour: number
          id: boolean
          include_storage: boolean
          last_run_at: string | null
          retention_days: number
          updated_at: string
          weekday: number
        }
        Insert: {
          auto_enabled?: boolean
          frequency?: string
          github_branch?: string
          github_path?: string
          github_repo?: string | null
          hour?: number
          id?: boolean
          include_storage?: boolean
          last_run_at?: string | null
          retention_days?: number
          updated_at?: string
          weekday?: number
        }
        Update: {
          auto_enabled?: boolean
          frequency?: string
          github_branch?: string
          github_path?: string
          github_repo?: string | null
          hour?: number
          id?: boolean
          include_storage?: boolean
          last_run_at?: string | null
          retention_days?: number
          updated_at?: string
          weekday?: number
        }
        Relationships: []
      }
      backup_secrets: {
        Row: {
          github_token_enc: string | null
          id: boolean
          updated_at: string
        }
        Insert: {
          github_token_enc?: string | null
          id?: boolean
          updated_at?: string
        }
        Update: {
          github_token_enc?: string | null
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      bulk_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          do_embedding: boolean
          do_ontology: boolean
          do_publish: boolean
          done: number
          error: string | null
          id: string
          node_ids: string[]
          phase: string | null
          progress: number
          space_id: string
          status: string
          total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          do_embedding?: boolean
          do_ontology?: boolean
          do_publish?: boolean
          done?: number
          error?: string | null
          id?: string
          node_ids: string[]
          phase?: string | null
          progress?: number
          space_id: string
          status?: string
          total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          do_embedding?: boolean
          do_ontology?: boolean
          do_publish?: boolean
          done?: number
          error?: string | null
          id?: string
          node_ids?: string[]
          phase?: string | null
          progress?: number
          space_id?: string
          status?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "bulk_jobs_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
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
      capture_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          destino: Json
          error: string | null
          id: string
          log: Json
          mode: string
          needs_login: boolean
          progress: number
          space_id: string
          status: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          destino?: Json
          error?: string | null
          id?: string
          log?: Json
          mode?: string
          needs_login?: boolean
          progress?: number
          space_id: string
          status?: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          destino?: Json
          error?: string | null
          id?: string
          log?: Json
          mode?: string
          needs_login?: boolean
          progress?: number
          space_id?: string
          status?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "capture_jobs_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      capture_recipes: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          instrucao: string
          name: string
          space_id: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          instrucao: string
          name: string
          space_id: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          instrucao?: string
          name?: string
          space_id?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capture_recipes_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      capture_secrets: {
        Row: {
          created_at: string
          job_id: string
          senha_enc: string
          usuario_enc: string
        }
        Insert: {
          created_at?: string
          job_id: string
          senha_enc: string
          usuario_enc: string
        }
        Update: {
          created_at?: string
          job_id?: string
          senha_enc?: string
          usuario_enc?: string
        }
        Relationships: [
          {
            foreignKeyName: "capture_secrets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "capture_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      chunks: {
        Row: {
          article_id: string | null
          content: string
          document_id: string | null
          embedded_at: string | null
          embedded_by: string | null
          embedding: string | null
          embedding_model: string | null
          embedding_provider: string | null
          heading_path: string | null
          id: string
          node_id: string | null
          space_id: string
          token_count: number | null
          tsv: unknown
        }
        Insert: {
          article_id?: string | null
          content: string
          document_id?: string | null
          embedded_at?: string | null
          embedded_by?: string | null
          embedding?: string | null
          embedding_model?: string | null
          embedding_provider?: string | null
          heading_path?: string | null
          id?: string
          node_id?: string | null
          space_id: string
          token_count?: number | null
          tsv?: unknown
        }
        Update: {
          article_id?: string | null
          document_id?: string | null
          embedded_at?: string | null
          embedded_by?: string | null
          content?: string
          embedding?: string | null
          embedding_model?: string | null
          embedding_provider?: string | null
          heading_path?: string | null
          id?: string
          node_id?: string | null
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
            foreignKeyName: "chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
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
      chat_attachments: {
        Row: {
          char_count: number | null
          conversation_id: string | null
          created_at: string
          extracted_text: string | null
          id: string
          mime: string
          name: string
          size_bytes: number
          space_id: string
          storage_path: string
        }
        Insert: {
          char_count?: number | null
          conversation_id?: string | null
          created_at?: string
          extracted_text?: string | null
          id?: string
          mime: string
          name: string
          size_bytes: number
          space_id: string
          storage_path: string
        }
        Update: {
          char_count?: number | null
          conversation_id?: string | null
          created_at?: string
          extracted_text?: string | null
          id?: string
          mime?: string
          name?: string
          size_bytes?: number
          space_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_attachments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_attachments_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      extension_tokens: {
        Row: {
          created_at: string
          id: string
          label: string | null
          last_used_at: string | null
          revoked_at: string | null
          token_hash: string
          token_prefix: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash: string
          token_prefix: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash?: string
          token_prefix?: string
          user_id?: string
        }
        Relationships: []
      }
      extension_events: {
        Row: {
          created_at: string
          discarded: boolean
          id: string
          kind: string
          label: string | null
          meta: Json | null
          mime: string | null
          session_id: string
          size_bytes: number | null
          storage_path: string | null
          t_ms: number | null
          title: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          discarded?: boolean
          id?: string
          kind: string
          label?: string | null
          meta?: Json | null
          mime?: string | null
          session_id: string
          size_bytes?: number | null
          storage_path?: string | null
          t_ms?: number | null
          title?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          discarded?: boolean
          id?: string
          kind?: string
          label?: string | null
          meta?: Json | null
          mime?: string | null
          session_id?: string
          size_bytes?: number | null
          storage_path?: string | null
          t_ms?: number | null
          title?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extension_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "extension_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      extension_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          event_count: number
          id: string
          node_id: string | null
          space_id: string | null
          started_at: string
          status: string
          title: string | null
          token_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          event_count?: number
          id?: string
          node_id?: string | null
          space_id?: string | null
          started_at?: string
          status?: string
          title?: string | null
          token_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          event_count?: number
          id?: string
          node_id?: string | null
          space_id?: string | null
          started_at?: string
          status?: string
          title?: string | null
          token_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extension_sessions_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extension_sessions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "extension_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          p_base: string | null
          p_empresa: string | null
          p_matricula: string | null
          p_perfil: string | null
          p_portal: string | null
          p_usuario: string | null
          page: Json | null
          session_id: string | null
          space_id: string
          user_ref: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          p_base?: string | null
          p_empresa?: string | null
          p_matricula?: string | null
          p_perfil?: string | null
          p_portal?: string | null
          p_usuario?: string | null
          page?: Json | null
          session_id?: string | null
          space_id: string
          user_ref?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          p_base?: string | null
          p_empresa?: string | null
          p_matricula?: string | null
          p_perfil?: string | null
          p_portal?: string | null
          p_usuario?: string | null
          page?: Json | null
          session_id?: string | null
          space_id?: string
          user_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views: {
        Row: {
          created_at: string
          id: string
          kind: string
          node_id: string | null
          p_base: string | null
          p_empresa: string | null
          p_matricula: string | null
          p_perfil: string | null
          p_portal: string | null
          p_usuario: string | null
          path: string | null
          session_id: string | null
          space_id: string
          title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          node_id?: string | null
          p_base?: string | null
          p_empresa?: string | null
          p_matricula?: string | null
          p_perfil?: string | null
          p_portal?: string | null
          p_usuario?: string | null
          path?: string | null
          session_id?: string | null
          space_id: string
          title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          node_id?: string | null
          p_base?: string | null
          p_empresa?: string | null
          p_matricula?: string | null
          p_perfil?: string | null
          p_portal?: string | null
          p_usuario?: string | null
          path?: string | null
          session_id?: string | null
          space_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_views_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_views_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      email_secrets: {
        Row: {
          brevo_api_key_enc: string | null
          id: boolean
          smtp_pass_enc: string | null
          updated_at: string
        }
        Insert: {
          brevo_api_key_enc?: string | null
          id?: boolean
          smtp_pass_enc?: string | null
          updated_at?: string
        }
        Update: {
          brevo_api_key_enc?: string | null
          id?: boolean
          smtp_pass_enc?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_settings: {
        Row: {
          from_email: string | null
          from_name: string
          id: boolean
          smtp_host: string | null
          smtp_port: number | null
          smtp_secure: boolean
          smtp_user: string | null
          template: Json | null
          transport: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          from_email?: string | null
          from_name?: string
          id?: boolean
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean
          smtp_user?: string | null
          template?: Json | null
          transport?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          from_email?: string | null
          from_name?: string
          id?: boolean
          smtp_host?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean
          smtp_user?: string | null
          template?: Json | null
          transport?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      embedding_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          done: number
          error: string | null
          id: string
          progress: number
          scope: string
          space_id: string
          status: string
          target_id: string | null
          total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          done?: number
          error?: string | null
          id?: string
          progress?: number
          scope: string
          space_id: string
          status?: string
          target_id?: string | null
          total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          done?: number
          error?: string | null
          id?: string
          progress?: number
          scope?: string
          space_id?: string
          status?: string
          target_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "embedding_jobs_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ontology_terms: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          kind: string
          node_id: string | null
          source: string
          space_id: string
          term: string
          term_norm: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: string
          node_id?: string | null
          source?: string
          space_id: string
          term: string
          term_norm: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: string
          node_id?: string | null
          source?: string
          space_id?: string
          term?: string
          term_norm?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ontology_terms_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ontology_aliases: {
        Row: {
          alias: string
          alias_norm: string
          created_at: string
          id: string
          source: string
          term_id: string
        }
        Insert: {
          alias: string
          alias_norm: string
          created_at?: string
          id?: string
          source?: string
          term_id: string
        }
        Update: {
          alias?: string
          alias_norm?: string
          created_at?: string
          id?: string
          source?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ontology_aliases_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "ontology_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      ontology_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          done: number
          error: string | null
          found: number
          id: string
          progress: number
          scope: string
          space_id: string
          status: string
          target_id: string | null
          total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          done?: number
          error?: string | null
          found?: number
          id?: string
          progress?: number
          scope?: string
          space_id: string
          status?: string
          target_id?: string | null
          total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          done?: number
          error?: string | null
          found?: number
          id?: string
          progress?: number
          scope?: string
          space_id?: string
          status?: string
          target_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "ontology_jobs_space_id_fkey"
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
      knowledge_documents: {
        Row: {
          chunk_count: number
          created_at: string
          created_by: string | null
          embedding_context: string | null
          embedding_context_hash: string | null
          error: string | null
          id: string
          mime: string | null
          original_name: string
          size_bytes: number | null
          space_id: string
          status: string
          storage_path: string
        }
        Insert: {
          chunk_count?: number
          created_at?: string
          created_by?: string | null
          embedding_context?: string | null
          embedding_context_hash?: string | null
          error?: string | null
          id?: string
          mime?: string | null
          original_name: string
          size_bytes?: number | null
          space_id: string
          status?: string
          storage_path: string
        }
        Update: {
          chunk_count?: number
          created_at?: string
          created_by?: string | null
          embedding_context?: string | null
          embedding_context_hash?: string | null
          error?: string | null
          id?: string
          mime?: string | null
          original_name?: string
          size_bytes?: number | null
          space_id?: string
          status?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
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
      messages: {
        Row: {
          attachments: Json
          citations: Json
          content: string
          conversation_id: string
          created_at: string
          feedback: number | null
          id: string
          input_tokens: number | null
          latency_ms: number | null
          output_tokens: number | null
          role: string
          tokens: number | null
        }
        Insert: {
          attachments?: Json
          citations?: Json
          content: string
          conversation_id: string
          created_at?: string
          feedback?: number | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          output_tokens?: number | null
          role: string
          tokens?: number | null
        }
        Update: {
          attachments?: Json
          citations?: Json
          content?: string
          conversation_id?: string
          created_at?: string
          feedback?: number | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          output_tokens?: number | null
          role?: string
          tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      link_checks: {
        Row: {
          checked_at: string
          ok: boolean | null
          status: number | null
          url: string
        }
        Insert: {
          checked_at?: string
          ok?: boolean | null
          status?: number | null
          url: string
        }
        Update: {
          checked_at?: string
          ok?: boolean | null
          status?: number | null
          url?: string
        }
        Relationships: []
      }
      node_tags: {
        Row: {
          node_id: string
          tag_id: string
        }
        Insert: {
          node_id: string
          tag_id: string
        }
        Update: {
          node_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "node_tags_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      nodes: {
        Row: {
          author_id: string | null
          created_at: string
          deleted_at: string | null
          publish_at: string | null
          unpublish_at: string | null
          unpublish_redirect_to: string | null
          description: string | null
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
          author_id?: string | null
          created_at?: string
          deleted_at?: string | null
          publish_at?: string | null
          unpublish_at?: string | null
          unpublish_redirect_to?: string | null
          description?: string | null
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
          author_id?: string | null
          created_at?: string
          deleted_at?: string | null
          publish_at?: string | null
          unpublish_at?: string | null
          unpublish_redirect_to?: string | null
          description?: string | null
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
          job_title: string | null
          last_seen_at: string | null
          status: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          job_title?: string | null
          last_seen_at?: string | null
          status?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          job_title?: string | null
          last_seen_at?: string | null
          status?: string
        }
        Relationships: []
      }
      prompt_overrides: {
        Row: {
          fields: Json
          key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          fields?: Json
          key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          fields?: Json
          key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      prompts_usuario_cliente: {
        Row: {
          created_at: string
          id: string
          label: string | null
          p_base: string
          p_usuario: string
          space_id: string
          texto: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          p_base: string
          p_usuario: string
          space_id: string
          texto: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          p_base?: string
          p_usuario?: string
          space_id?: string
          texto?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompts_usuario_cliente_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts_usuario_sistema: {
        Row: {
          created_at: string
          id: string
          label: string | null
          texto: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          texto: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          texto?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          window_start?: string
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
      review_comments: {
        Row: {
          author_id: string | null
          body: string | null
          created_at: string
          id: string
          kind: string
          node_id: string
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          node_id: string
        }
        Update: {
          author_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_comments_node_id_fkey"
            columns: ["node_id"]
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
      space_tracking_keys: {
        Row: {
          key_enc: string
          space_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          key_enc: string
          space_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          key_enc?: string
          space_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "space_tracking_keys_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: true
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_overlays: {
        Row: {
          created_at: string
          hidden: boolean
          id: string
          override_node_id: string | null
          position_override: string | null
          source_node_id: string
          space_id: string
        }
        Insert: {
          created_at?: string
          hidden?: boolean
          id?: string
          override_node_id?: string | null
          position_override?: string | null
          source_node_id: string
          space_id: string
        }
        Update: {
          created_at?: string
          hidden?: boolean
          id?: string
          override_node_id?: string | null
          position_override?: string | null
          source_node_id?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_overlays_override_node_id_fkey"
            columns: ["override_node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_overlays_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_overlays_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_secrets: {
        Row: {
          password_hash: string
          space_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          password_hash: string
          space_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          password_hash?: string
          space_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "space_secrets_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: true
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_slugs: {
        Row: {
          created_at: string
          slug: string
          space_id: string
        }
        Insert: {
          created_at?: string
          slug: string
          space_id: string
        }
        Update: {
          created_at?: string
          slug?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_slugs_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          access_denied_message: string | null
          access_referrers: string[] | null
          chat_prompt: string | null
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
          access_denied_message?: string | null
          access_referrers?: string[] | null
          chat_prompt?: string | null
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
          access_denied_message?: string | null
          access_referrers?: string[] | null
          chat_prompt?: string | null
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
      widget_key_spaces: {
        Row: {
          created_at: string
          space_id: string
          widget_key_id: string
        }
        Insert: {
          created_at?: string
          space_id: string
          widget_key_id: string
        }
        Update: {
          created_at?: string
          space_id?: string
          widget_key_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_key_spaces_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_key_spaces_widget_key_id_fkey"
            columns: ["widget_key_id"]
            isOneToOne: false
            referencedRelation: "widget_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_reports: {
        Row: {
          id: string
          issues: Json
          node_id: string
          run_at: string
          score: number
          space_id: string
        }
        Insert: {
          id?: string
          issues?: Json
          node_id: string
          run_at?: string
          score?: number
          space_id: string
        }
        Update: {
          id?: string
          issues?: Json
          node_id?: string
          run_at?: string
          score?: number
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_reports_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: true
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_reports_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          materiais: Json
          messages: Json
          proposal: Json
          space_id: string
          status: string
          target: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          materiais?: Json
          messages?: Json
          proposal?: Json
          space_id: string
          status?: string
          target?: Json
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          materiais?: Json
          messages?: Json
          proposal?: Json
          space_id?: string
          status?: string
          target?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_sessions_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_runs: {
        Row: {
          frequency: string
          last_run_at: string
          space_id: string
        }
        Insert: {
          frequency: string
          last_run_at?: string
          space_id: string
        }
        Update: {
          frequency?: string
          last_run_at?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_runs_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          confirmed_at: string | null
          created_at: string
          email: string
          frequency: string
          id: string
          space_id: string
          token: string
          unsubscribed_at: string | null
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          email: string
          frequency?: string
          id?: string
          space_id: string
          token?: string
          unsubscribed_at?: string | null
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          email?: string
          frequency?: string
          id?: string
          space_id?: string
          token?: string
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          space_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          space_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      web_fetch_settings: {
        Row: {
          allowlist: string[]
          authoring_enabled: boolean
          id: boolean
          reader_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowlist?: string[]
          authoring_enabled?: boolean
          id?: boolean
          reader_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowlist?: string[]
          authoring_enabled?: boolean
          id?: boolean
          reader_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      widget_keys: {
        Row: {
          active: boolean
          allowed_origins: string[]
          config: Json
          created_at: string
          created_by: string | null
          id: string
          kind: string
          name: string
          public_key: string
          rate_limit: number
          space_id: string
          system_prompt: string | null
        }
        Insert: {
          active?: boolean
          allowed_origins?: string[]
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name?: string
          public_key: string
          rate_limit?: number
          space_id: string
          system_prompt?: string | null
        }
        Update: {
          active?: boolean
          allowed_origins?: string[]
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name?: string
          public_key?: string
          rate_limit?: number
          space_id?: string
          system_prompt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "widget_keys_space_id_fkey"
            columns: ["space_id"]
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
      approve_review: { Args: { p_node_id: string }; Returns: undefined }
      create_article_version: {
        Args: { p_label?: string; p_node_id: string; p_protected?: boolean }
        Returns: number
      }
      f_unaccent: { Args: { "": string }; Returns: string }
      gc_versions: { Args: never; Returns: number }
      hard_delete_subtree: { Args: { p_node_id: string }; Returns: number }
      approvers_for_node: {
        Args: { p_node_id: string }
        Returns: { user_id: string }[]
      }
      has_permission: {
        Args: {
          p_permission_key: string
          p_space_id?: string
          p_user_id: string
        }
        Returns: boolean
      }
      has_permission_child: {
        Args: {
          p_parent_id: string
          p_permission_key: string
          p_space_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      has_permission_node: {
        Args: {
          p_node_id: string
          p_permission_key: string
          p_user_id: string
        }
        Returns: boolean
      }
      has_permission_node_row: {
        Args: {
          p_path: unknown
          p_permission_key: string
          p_space_id: string
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
      import_job_log_append: {
        Args: { p_job_id: string; p_msg: string }
        Returns: undefined
      }
      delete_space_deep: {
        Args: { p_space_id: string }
        Returns: Json
      }
      top_helpful_articles: {
        Args: { p_space_id: string; p_limit?: number }
        Returns: { node_id: string; helpful: number; total: number }[]
      }
      related_articles: {
        Args: { p_node_ids: string[]; p_space_id: string; p_limit?: number }
        Returns: { node_id: string; score: number }[]
      }
      register_article_view: {
        Args: { p_node_id: string }
        Returns: undefined
      }
      embeddings_report: {
        Args: { p_space_id?: string | null }
        Returns: {
          origin_kind: string
          origin_id: string
          title: string
          space_id: string
          space_name: string
          chunk_count: number
          embedded_count: number
          provider: string | null
          model: string | null
          embedded_at: string | null
          embedded_by: string | null
          status: string | null
        }[]
      }
      hybrid_search_scoped: {
        Args: {
          p_boost?: string
          p_document_ids?: string[]
          p_embedding?: string
          p_limit?: number
          p_node_ids?: string[]
          p_query: string
        }
        Returns: {
          content: string
          document_id: string | null
          heading_path: string
          node_id: string | null
          score: number
          snippet: string
          title: string
        }[]
      }
      ai_provider_has_key: {
        Args: { p_provider_id: string }
        Returns: boolean
      }
      base_credential_has_secret: {
        Args: { p_credential_id: string }
        Returns: boolean
      }
      set_base_credential_secret: {
        Args: { p_credential_id: string; p_secret_enc: string }
        Returns: undefined
      }
      set_whatsapp_secret: {
        Args: { p_campo: string; p_valor_enc: string }
        Returns: undefined
      }
      whatsapp_has_secret: {
        Args: { p_campo: string }
        Returns: boolean
      }
      ai_usage_report: {
        Args: {
          p_from: string
          p_to: string
          p_kind?: string | null
          pf_base?: string | null
          pf_usuario?: string | null
          pf_portal?: string | null
          pf_empresa?: string | null
          pf_matricula?: string | null
          pf_perfil?: string | null
        }
        Returns: {
          provider: string
          model: string
          purpose: string
          input_tokens: number
          output_tokens: number
          total_tokens: number
          calls: number
        }[]
      }
      set_ai_provider_key: {
        Args: { p_key_enc: string; p_provider_id: string }
        Returns: undefined
      }
      email_has_secret: {
        Args: { p_campo: string }
        Returns: boolean
      }
      set_email_secret: {
        Args: { p_campo: string; p_valor_enc: string }
        Returns: undefined
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
      rate_limit_hit: {
        Args: { p_bucket: string; p_max: number; p_window_seconds?: number }
        Returns: boolean
      }
      rate_limits_gc: { Args: never; Returns: undefined }
      reject_review: {
        Args: { p_comment: string; p_node_id: string }
        Returns: undefined
      }
      rename_article_version: {
        Args: { p_label: string; p_protected: boolean; p_version_id: string }
        Returns: undefined
      }
      restore_subtree: { Args: { p_node_id: string }; Returns: number }
      set_space_password: {
        Args: { p_plain: string; p_space_id: string }
        Returns: undefined
      }
      space_has_password: { Args: { p_space_id: string }; Returns: boolean }
      soft_delete_subtree: { Args: { p_node_id: string }; Returns: number }
      storage_space_id: { Args: { p_name: string }; Returns: string | null }
      submit_for_review: { Args: { p_node_id: string }; Returns: undefined }
      subtree_ids: {
        Args: { p_node_id: string }
        Returns: {
          id: string
          type: string
        }[]
      }
      verify_space_password: {
        Args: { p_plain: string; p_space_id: string }
        Returns: boolean
      }
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
