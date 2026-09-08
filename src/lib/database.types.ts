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
      ai_acesso_regras: {
        Row: {
          alvo: string | null
          alvo_tipo: string
          ativo: boolean
          atualizado_em: string
          base_code: string
          criado_em: string
          criado_por: string | null
          efeito: string
          escopo_tipo: string
          id: string
          modulo: string | null
          observacao: string | null
          painel: string | null
          submodulo: string | null
          tool_key: string | null
        }
        Insert: {
          alvo?: string | null
          alvo_tipo: string
          ativo?: boolean
          atualizado_em?: string
          base_code: string
          criado_em?: string
          criado_por?: string | null
          efeito: string
          escopo_tipo: string
          id?: string
          modulo?: string | null
          observacao?: string | null
          painel?: string | null
          submodulo?: string | null
          tool_key?: string | null
        }
        Update: {
          alvo?: string | null
          alvo_tipo?: string
          ativo?: boolean
          atualizado_em?: string
          base_code?: string
          criado_em?: string
          criado_por?: string | null
          efeito?: string
          escopo_tipo?: string
          id?: string
          modulo?: string | null
          observacao?: string | null
          painel?: string | null
          submodulo?: string | null
          tool_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_acesso_regras_base_code_fkey"
            columns: ["base_code"]
            isOneToOne: false
            referencedRelation: "ai_bases"
            referencedColumns: ["base_code"]
          },
        ]
      }
      ai_agent_profile_modules: {
        Row: {
          created_at: string
          id: string
          modulo: string
          profile_id: string
          submodulo: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          modulo: string
          profile_id: string
          submodulo?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          modulo?: string
          profile_id?: string
          submodulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_profile_modules_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_profiles: {
        Row: {
          acoes: string[]
          active: boolean
          base_code: string
          cargo: string | null
          comportamento: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          nome: string | null
          priority: number
          prompt_refino: string
          requires_perfil: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          acoes?: string[]
          active?: boolean
          base_code: string
          cargo?: string | null
          comportamento?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string | null
          priority?: number
          prompt_refino?: string
          requires_perfil?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          acoes?: string[]
          active?: boolean
          base_code?: string
          cargo?: string | null
          comportamento?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string | null
          priority?: number
          prompt_refino?: string
          requires_perfil?: string | null
          titulo?: string
          updated_at?: string
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
          is_default: boolean
          key: string
          model: string | null
          name: string
          parent_agent_id: string | null
          priority: number
          provider_id: string | null
          publico: string
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
          is_default?: boolean
          key: string
          model?: string | null
          name: string
          parent_agent_id?: string | null
          priority?: number
          provider_id?: string | null
          publico?: string
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
          is_default?: boolean
          key?: string
          model?: string | null
          name?: string
          parent_agent_id?: string | null
          priority?: number
          provider_id?: string | null
          publico?: string
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
      ai_assignments: {
        Row: {
          base_code: string
          model: string
          params: Json
          provider_id: string
          purpose: string
          updated_at: string
        }
        Insert: {
          base_code?: string
          model: string
          params?: Json
          provider_id: string
          purpose: string
          updated_at?: string
        }
        Update: {
          base_code?: string
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
          base_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_global: boolean
          name: string
          provider: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          auth_type: string
          base_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_global?: boolean
          name: string
          provider?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          auth_type?: string
          base_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_global?: boolean
          name?: string
          provider?: string | null
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
      ai_base_tools: {
        Row: {
          base_id: string
          base_url: string | null
          credential_id: string | null
          empresas: string[]
          enabled: boolean
          perfis: string[]
          portais: string[]
          tool_id: string
        }
        Insert: {
          base_id: string
          base_url?: string | null
          credential_id?: string | null
          empresas?: string[]
          enabled?: boolean
          perfis?: string[]
          portais?: string[]
          tool_id: string
        }
        Update: {
          base_id?: string
          base_url?: string | null
          credential_id?: string | null
          empresas?: string[]
          enabled?: boolean
          perfis?: string[]
          portais?: string[]
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
      ai_base_tracking_keys: {
        Row: {
          base_id: string
          key_enc: string
          space_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_id: string
          key_enc: string
          space_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_id?: string
          key_enc?: string
          space_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_base_tracking_keys_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "ai_bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_base_tracking_keys_space_id_fkey"
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
          apps_schema: string[] | null
          base_code: string
          base_url: string | null
          created_at: string
          created_by: string | null
          credential_id: string | null
          flow_layout: Json | null
          id: string
          name: string
          perfis_campo: string | null
          perfis_endpoint: string | null
          tool_routing: boolean
          updated_at: string
          widget_paineis: string[] | null
        }
        Insert: {
          active?: boolean
          apps_schema?: string[] | null
          base_code: string
          base_url?: string | null
          created_at?: string
          created_by?: string | null
          credential_id?: string | null
          flow_layout?: Json | null
          id?: string
          name: string
          perfis_campo?: string | null
          perfis_endpoint?: string | null
          tool_routing?: boolean
          updated_at?: string
          widget_paineis?: string[] | null
        }
        Update: {
          active?: boolean
          apps_schema?: string[] | null
          base_code?: string
          base_url?: string | null
          created_at?: string
          created_by?: string | null
          credential_id?: string | null
          flow_layout?: Json | null
          id?: string
          name?: string
          perfis_campo?: string | null
          perfis_endpoint?: string | null
          tool_routing?: boolean
          updated_at?: string
          widget_paineis?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_bases_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "ai_base_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_traces: {
        Row: {
          base_code: string | null
          conversation_id: string | null
          created_at: string
          desfecho: string | null
          duracao_ms: number | null
          fonte: string | null
          id: string
          p_cod_candidato: string | null
          p_empresa: string | null
          p_matricula: string | null
          p_perfil: string | null
          p_portal: string | null
          p_usuario: string | null
          passos: Json
          pergunta: string | null
          space_id: string | null
          turn_id: string | null
        }
        Insert: {
          base_code?: string | null
          conversation_id?: string | null
          created_at?: string
          desfecho?: string | null
          duracao_ms?: number | null
          fonte?: string | null
          id?: string
          p_cod_candidato?: string | null
          p_empresa?: string | null
          p_matricula?: string | null
          p_perfil?: string | null
          p_portal?: string | null
          p_usuario?: string | null
          passos?: Json
          pergunta?: string | null
          space_id?: string | null
          turn_id?: string | null
        }
        Update: {
          base_code?: string | null
          conversation_id?: string | null
          created_at?: string
          desfecho?: string | null
          duracao_ms?: number | null
          fonte?: string | null
          id?: string
          p_cod_candidato?: string | null
          p_empresa?: string | null
          p_matricula?: string | null
          p_perfil?: string | null
          p_portal?: string | null
          p_usuario?: string | null
          passos?: Json
          pergunta?: string | null
          space_id?: string | null
          turn_id?: string | null
        }
        Relationships: []
      }
      ai_cliente_plano: {
        Row: {
          base_code: string
          creditos_por_ciclo: number
          criado_em: string
          criado_por: string | null
          dia_inicio_ciclo: number
          id: string
          observacao: string | null
          tokens_por_credito: number
          usd_por_credito: number
          vigente_desde: string
        }
        Insert: {
          base_code: string
          creditos_por_ciclo?: number
          criado_em?: string
          criado_por?: string | null
          dia_inicio_ciclo?: number
          id?: string
          observacao?: string | null
          tokens_por_credito?: number
          usd_por_credito?: number
          vigente_desde?: string
        }
        Update: {
          base_code?: string
          creditos_por_ciclo?: number
          criado_em?: string
          criado_por?: string | null
          dia_inicio_ciclo?: number
          id?: string
          observacao?: string | null
          tokens_por_credito?: number
          usd_por_credito?: number
          vigente_desde?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_cliente_plano_base_code_fkey"
            columns: ["base_code"]
            isOneToOne: false
            referencedRelation: "ai_bases"
            referencedColumns: ["base_code"]
          },
        ]
      }
      ai_cotacao_cambio: {
        Row: {
          dia: string
          fonte: string
          obtido_em: string
          usd_brl: number
        }
        Insert: {
          dia: string
          fonte: string
          obtido_em?: string
          usd_brl: number
        }
        Update: {
          dia?: string
          fonte?: string
          obtido_em?: string
          usd_brl?: number
        }
        Relationships: []
      }
      ai_creditos_alocacao: {
        Row: {
          alvo: string | null
          alvo_tipo: string
          ativo: boolean
          atualizado_em: string
          base_code: string
          creditos: number
          criado_em: string
          criado_por: string | null
          id: string
          painel: string | null
        }
        Insert: {
          alvo?: string | null
          alvo_tipo: string
          ativo?: boolean
          atualizado_em?: string
          base_code: string
          creditos: number
          criado_em?: string
          criado_por?: string | null
          id?: string
          painel?: string | null
        }
        Update: {
          alvo?: string | null
          alvo_tipo?: string
          ativo?: boolean
          atualizado_em?: string
          base_code?: string
          creditos?: number
          criado_em?: string
          criado_por?: string | null
          id?: string
          painel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_creditos_alocacao_base_code_fkey"
            columns: ["base_code"]
            isOneToOne: false
            referencedRelation: "ai_bases"
            referencedColumns: ["base_code"]
          },
        ]
      }
      ai_creditos_extra: {
        Row: {
          base_code: string
          ciclo_inicio: string
          creditos: number
          criado_em: string
          id: string
          motivo: string | null
          solicitado_por: string | null
          usd_por_credito: number
        }
        Insert: {
          base_code: string
          ciclo_inicio: string
          creditos: number
          criado_em?: string
          id?: string
          motivo?: string | null
          solicitado_por?: string | null
          usd_por_credito?: number
        }
        Update: {
          base_code?: string
          ciclo_inicio?: string
          creditos?: number
          criado_em?: string
          id?: string
          motivo?: string | null
          solicitado_por?: string | null
          usd_por_credito?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_creditos_extra_base_code_fkey"
            columns: ["base_code"]
            isOneToOne: false
            referencedRelation: "ai_bases"
            referencedColumns: ["base_code"]
          },
        ]
      }
      ai_eval_results: {
        Row: {
          detalhe: Json
          esperado: string | null
          id: string
          motivo: string | null
          obtido: string | null
          ok: boolean | null
          ordem: number | null
          pergunta: string | null
          run_id: string
        }
        Insert: {
          detalhe?: Json
          esperado?: string | null
          id?: string
          motivo?: string | null
          obtido?: string | null
          ok?: boolean | null
          ordem?: number | null
          pergunta?: string | null
          run_id: string
        }
        Update: {
          detalhe?: Json
          esperado?: string | null
          id?: string
          motivo?: string | null
          obtido?: string | null
          ok?: boolean | null
          ordem?: number | null
          pergunta?: string | null
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_eval_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ai_eval_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_eval_runs: {
        Row: {
          acertos: number
          casos_mediveis: number
          casos_total: number
          created_at: string
          eixo: string
          flags: Json
          gabarito_arquivo: string | null
          gabarito_casos: number | null
          gabarito_sha: string | null
          git_sha: string | null
          git_sujo: boolean
          id: string
          nota: string | null
          placar: Json
          script: string
        }
        Insert: {
          acertos?: number
          casos_mediveis?: number
          casos_total?: number
          created_at?: string
          eixo: string
          flags?: Json
          gabarito_arquivo?: string | null
          gabarito_casos?: number | null
          gabarito_sha?: string | null
          git_sha?: string | null
          git_sujo?: boolean
          id?: string
          nota?: string | null
          placar?: Json
          script: string
        }
        Update: {
          acertos?: number
          casos_mediveis?: number
          casos_total?: number
          created_at?: string
          eixo?: string
          flags?: Json
          gabarito_arquivo?: string | null
          gabarito_casos?: number | null
          gabarito_sha?: string | null
          git_sha?: string | null
          git_sujo?: boolean
          id?: string
          nota?: string | null
          placar?: Json
          script?: string
        }
        Relationships: []
      }
      ai_faturas: {
        Row: {
          base_code: string
          brl_total: number | null
          ciclo_fim: string | null
          ciclo_inicio: string
          creditos_consumidos: number
          creditos_contratados: number
          creditos_extra: number
          fechada_em: string
          id: string
          observacao: string | null
          status: string
          usd_brl: number | null
          usd_total: number
        }
        Insert: {
          base_code: string
          brl_total?: number | null
          ciclo_fim?: string | null
          ciclo_inicio: string
          creditos_consumidos?: number
          creditos_contratados?: number
          creditos_extra?: number
          fechada_em?: string
          id?: string
          observacao?: string | null
          status?: string
          usd_brl?: number | null
          usd_total?: number
        }
        Update: {
          base_code?: string
          brl_total?: number | null
          ciclo_fim?: string | null
          ciclo_inicio?: string
          creditos_consumidos?: number
          creditos_contratados?: number
          creditos_extra?: number
          fechada_em?: string
          id?: string
          observacao?: string | null
          status?: string
          usd_brl?: number | null
          usd_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_faturas_base_code_fkey"
            columns: ["base_code"]
            isOneToOne: false
            referencedRelation: "ai_bases"
            referencedColumns: ["base_code"]
          },
        ]
      }
      ai_leases: {
        Row: {
          expires_at: string
          id: string
          tenant: string
        }
        Insert: {
          expires_at: string
          id?: string
          tenant: string
        }
        Update: {
          expires_at?: string
          id?: string
          tenant?: string
        }
        Relationships: []
      }
      ai_model_prices: {
        Row: {
          cache_read_mult: number
          cache_write_mult: number
          confirmado: boolean
          created_at: string
          fonte: string | null
          id: string
          input_usd_mtok: number | null
          model: string
          output_usd_mtok: number | null
          provider: string
          vigente_desde: string
        }
        Insert: {
          cache_read_mult?: number
          cache_write_mult?: number
          confirmado?: boolean
          created_at?: string
          fonte?: string | null
          id?: string
          input_usd_mtok?: number | null
          model: string
          output_usd_mtok?: number | null
          provider: string
          vigente_desde?: string
        }
        Update: {
          cache_read_mult?: number
          cache_write_mult?: number
          confirmado?: boolean
          created_at?: string
          fonte?: string | null
          id?: string
          input_usd_mtok?: number | null
          model?: string
          output_usd_mtok?: number | null
          provider?: string
          vigente_desde?: string
        }
        Relationships: []
      }
      ai_modules: {
        Row: {
          base_code: string
          created_at: string
          id: string
          modulo: string
          portal: string | null
          submodulo: string | null
          synced_at: string
        }
        Insert: {
          base_code: string
          created_at?: string
          id?: string
          modulo: string
          portal?: string | null
          submodulo?: string | null
          synced_at?: string
        }
        Update: {
          base_code?: string
          created_at?: string
          id?: string
          modulo?: string
          portal?: string | null
          submodulo?: string | null
          synced_at?: string
        }
        Relationships: []
      }
      ai_pending_confirmations: {
        Row: {
          action: string
          args: Json | null
          base_code: string
          code_hash: string | null
          confirmed_at: string | null
          created_at: string
          detail: string | null
          expires_at: string
          id: string
          subject: string
          tool_key: string | null
          used_at: string | null
        }
        Insert: {
          action: string
          args?: Json | null
          base_code: string
          code_hash?: string | null
          confirmed_at?: string | null
          created_at?: string
          detail?: string | null
          expires_at: string
          id?: string
          subject: string
          tool_key?: string | null
          used_at?: string | null
        }
        Update: {
          action?: string
          args?: Json | null
          base_code?: string
          code_hash?: string | null
          confirmed_at?: string | null
          created_at?: string
          detail?: string | null
          expires_at?: string
          id?: string
          subject?: string
          tool_key?: string | null
          used_at?: string | null
        }
        Relationships: []
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
          base_code: string
          base_url: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          name: string
        }
        Insert: {
          active?: boolean
          base_code?: string
          base_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          name: string
        }
        Update: {
          active?: boolean
          base_code?: string
          base_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name?: string
        }
        Relationships: []
      }
      ai_report_module_cache: {
        Row: {
          base_code: string
          modulos: Json
          report_key: string
          updated_at: string
        }
        Insert: {
          base_code: string
          modulos: Json
          report_key: string
          updated_at?: string
        }
        Update: {
          base_code?: string
          modulos?: Json
          report_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_tool_base_embeddings: {
        Row: {
          base_id: string
          embedding: string | null
          fonte_hash: string
          termos_ontologia: number
          tool_id: string
          updated_at: string
        }
        Insert: {
          base_id: string
          embedding?: string | null
          fonte_hash: string
          termos_ontologia?: number
          tool_id: string
          updated_at?: string
        }
        Update: {
          base_id?: string
          embedding?: string | null
          fonte_hash?: string
          termos_ontologia?: number
          tool_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_tool_base_embeddings_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "ai_bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_tool_base_embeddings_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "ai_tools"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_tool_casos: {
        Row: {
          base_code: string | null
          conversation_id: string | null
          cortadas: Json
          created_at: string
          curl: string | null
          id: string
          justificativa: string | null
          observacao: string | null
          oferecidas: Json
          origem: string
          p_perfil: string | null
          p_portal: string | null
          parametros: Json | null
          parametros_corretos: Json | null
          pergunta: string
          rotulado_em: string | null
          rotulado_por: string | null
          sinal_seguinte: string | null
          space_id: string
          tela: string | null
          tool_correta: string | null
          tool_escolhida: string | null
          trace_id: string | null
          veredito: string | null
        }
        Insert: {
          base_code?: string | null
          conversation_id?: string | null
          cortadas?: Json
          created_at?: string
          curl?: string | null
          id?: string
          justificativa?: string | null
          observacao?: string | null
          oferecidas?: Json
          origem?: string
          p_perfil?: string | null
          p_portal?: string | null
          parametros?: Json | null
          parametros_corretos?: Json | null
          pergunta: string
          rotulado_em?: string | null
          rotulado_por?: string | null
          sinal_seguinte?: string | null
          space_id: string
          tela?: string | null
          tool_correta?: string | null
          tool_escolhida?: string | null
          trace_id?: string | null
          veredito?: string | null
        }
        Update: {
          base_code?: string | null
          conversation_id?: string | null
          cortadas?: Json
          created_at?: string
          curl?: string | null
          id?: string
          justificativa?: string | null
          observacao?: string | null
          oferecidas?: Json
          origem?: string
          p_perfil?: string | null
          p_portal?: string | null
          parametros?: Json | null
          parametros_corretos?: Json | null
          pergunta?: string
          rotulado_em?: string | null
          rotulado_por?: string | null
          sinal_seguinte?: string | null
          space_id?: string
          tela?: string | null
          tool_correta?: string | null
          tool_escolhida?: string | null
          trace_id?: string | null
          veredito?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_tool_casos_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_tool_modules: {
        Row: {
          created_at: string
          id: string
          modulo: string
          submodulo: string | null
          tool_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          modulo: string
          submodulo?: string | null
          tool_id: string
        }
        Update: {
          created_at?: string
          id?: string
          modulo?: string
          submodulo?: string | null
          tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_tool_modules_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "ai_tools"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_tool_modules_bkp_20260730: {
        Row: {
          created_at: string | null
          id: string | null
          modulo: string | null
          submodulo: string | null
          tool_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          modulo?: string | null
          submodulo?: string | null
          tool_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          modulo?: string | null
          submodulo?: string | null
          tool_id?: string | null
        }
        Relationships: []
      }
      ai_tool_priority_rules: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          loser_tool_id: string
          modo: string
          motivo: string | null
          winner_tool_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          loser_tool_id: string
          modo?: string
          motivo?: string | null
          winner_tool_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          loser_tool_id?: string
          modo?: string
          motivo?: string | null
          winner_tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_tool_priority_rules_loser_tool_id_fkey"
            columns: ["loser_tool_id"]
            isOneToOne: false
            referencedRelation: "ai_tools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_tool_priority_rules_winner_tool_id_fkey"
            columns: ["winner_tool_id"]
            isOneToOne: false
            referencedRelation: "ai_tools"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_tool_runs: {
        Row: {
          agent_key: string | null
          base_code: string
          cached: boolean
          conversation_id: string | null
          created_at: string
          duration_ms: number | null
          error: string | null
          files: number
          id: string
          input: Json | null
          ok: boolean
          output: Json | null
          request: Json | null
          status: number | null
          step_index: number
          tool_key: string
        }
        Insert: {
          agent_key?: string | null
          base_code: string
          cached?: boolean
          conversation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          files?: number
          id?: string
          input?: Json | null
          ok?: boolean
          output?: Json | null
          request?: Json | null
          status?: number | null
          step_index?: number
          tool_key: string
        }
        Update: {
          agent_key?: string | null
          base_code?: string
          cached?: boolean
          conversation_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          files?: number
          id?: string
          input?: Json | null
          ok?: boolean
          output?: Json | null
          request?: Json | null
          status?: number | null
          step_index?: number
          tool_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_tool_runs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_tool_uso: {
        Row: {
          base_code: string
          consulta: string
          created_at: string
          embedding: string
          id: string
          ok: boolean
          tool_key: string
        }
        Insert: {
          base_code: string
          consulta: string
          created_at?: string
          embedding: string
          id?: string
          ok?: boolean
          tool_key: string
        }
        Update: {
          base_code?: string
          consulta?: string
          created_at?: string
          embedding?: string
          id?: string
          ok?: boolean
          tool_key?: string
        }
        Relationships: []
      }
      ai_tools: {
        Row: {
          acao_em_lista: Json | null
          active: boolean
          always_include: boolean
          auth_type: string
          body_mode: string | null
          body_template: Json | null
          cache_scope: string
          cache_ttl: number | null
          created_at: string
          created_by: string | null
          credential_id: string | null
          descricao_usuario: string
          description: string
          embedding: string | null
          endpoint_kind: string
          exclude_self: boolean
          external_url: string | null
          grupo_ambiguidade: string | null
          guard: string | null
          id: string
          identity_mode: string
          key: string
          loop: Json | null
          method: string
          name: string
          panel_scope: Json | null
          params: Json
          path_template: string
          prioridade: number
          protegida_de_bloqueio: boolean
          response_hint: string | null
          search_terms: string
          selecionavel_no_chat: boolean
          system_prompt: string
          updated_at: string
        }
        Insert: {
          acao_em_lista?: Json | null
          active?: boolean
          always_include?: boolean
          auth_type?: string
          body_mode?: string | null
          body_template?: Json | null
          cache_scope?: string
          cache_ttl?: number | null
          created_at?: string
          created_by?: string | null
          credential_id?: string | null
          descricao_usuario?: string
          description: string
          embedding?: string | null
          endpoint_kind?: string
          exclude_self?: boolean
          external_url?: string | null
          grupo_ambiguidade?: string | null
          guard?: string | null
          id?: string
          identity_mode?: string
          key: string
          loop?: Json | null
          method?: string
          name: string
          panel_scope?: Json | null
          params?: Json
          path_template?: string
          prioridade?: number
          protegida_de_bloqueio?: boolean
          response_hint?: string | null
          search_terms?: string
          selecionavel_no_chat?: boolean
          system_prompt?: string
          updated_at?: string
        }
        Update: {
          acao_em_lista?: Json | null
          active?: boolean
          always_include?: boolean
          auth_type?: string
          body_mode?: string | null
          body_template?: Json | null
          cache_scope?: string
          cache_ttl?: number | null
          created_at?: string
          created_by?: string | null
          credential_id?: string | null
          descricao_usuario?: string
          description?: string
          embedding?: string | null
          endpoint_kind?: string
          exclude_self?: boolean
          external_url?: string | null
          grupo_ambiguidade?: string | null
          guard?: string | null
          id?: string
          identity_mode?: string
          key?: string
          loop?: Json | null
          method?: string
          name?: string
          panel_scope?: Json | null
          params?: Json
          path_template?: string
          prioridade?: number
          protegida_de_bloqueio?: boolean
          response_hint?: string | null
          search_terms?: string
          selecionavel_no_chat?: boolean
          system_prompt?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_tools_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "ai_base_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          cache_read_tokens: number
          cache_write_tokens: number
          conversation_id: string | null
          created_at: string
          id: string
          input_tokens: number
          kind: string
          model: string
          origem: string
          output_tokens: number
          p_base: string | null
          p_cod_candidato: string | null
          p_empresa: string | null
          p_matricula: string | null
          p_perfil: string | null
          p_portal: string | null
          p_usuario: string | null
          provider: string
          purpose: string
          total_tokens: number
          turn_id: string | null
        }
        Insert: {
          cache_read_tokens?: number
          cache_write_tokens?: number
          conversation_id?: string | null
          created_at?: string
          id?: string
          input_tokens?: number
          kind?: string
          model: string
          origem?: string
          output_tokens?: number
          p_base?: string | null
          p_cod_candidato?: string | null
          p_empresa?: string | null
          p_matricula?: string | null
          p_perfil?: string | null
          p_portal?: string | null
          p_usuario?: string | null
          provider: string
          purpose: string
          total_tokens?: number
          turn_id?: string | null
        }
        Update: {
          cache_read_tokens?: number
          cache_write_tokens?: number
          conversation_id?: string | null
          created_at?: string
          id?: string
          input_tokens?: number
          kind?: string
          model?: string
          origem?: string
          output_tokens?: number
          p_base?: string | null
          p_cod_candidato?: string | null
          p_empresa?: string | null
          p_matricula?: string | null
          p_perfil?: string | null
          p_portal?: string | null
          p_usuario?: string | null
          provider?: string
          purpose?: string
          total_tokens?: number
          turn_id?: string | null
        }
        Relationships: []
      }
      analysis_chunks: {
        Row: {
          created_at: string
          id: string
          job_id: string
          rows: Json
          seq: number
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          rows: Json
          seq: number
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          rows?: Json
          seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "analysis_chunks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "analysis_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_jobs: {
        Row: {
          batch_id: string
          columns: Json | null
          created_at: string
          destino: string
          error: string | null
          id: string
          instrucao: string | null
          params: Json | null
          received_chunks: number
          received_rows: number
          result: Json | null
          space_id: string | null
          status: string
          total_chunks: number | null
          updated_at: string
        }
        Insert: {
          batch_id: string
          columns?: Json | null
          created_at?: string
          destino?: string
          error?: string | null
          id?: string
          instrucao?: string | null
          params?: Json | null
          received_chunks?: number
          received_rows?: number
          result?: Json | null
          space_id?: string | null
          status?: string
          total_chunks?: number | null
          updated_at?: string
        }
        Update: {
          batch_id?: string
          columns?: Json | null
          created_at?: string
          destino?: string
          error?: string | null
          id?: string
          instrucao?: string | null
          params?: Json | null
          received_chunks?: number
          received_rows?: number
          result?: Json | null
          space_id?: string | null
          status?: string
          total_chunks?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_jobs_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          scopes: string[]
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          scopes?: string[]
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          scopes?: string[]
        }
        Relationships: []
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
      atividade_dispensas: {
        Row: {
          dispensada_em: string
          job_id: string
          tipo: string
          user_id: string
        }
        Insert: {
          dispensada_em?: string
          job_id: string
          tipo: string
          user_id: string
        }
        Update: {
          dispensada_em?: string
          job_id?: string
          tipo?: string
          user_id?: string
        }
        Relationships: []
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
      billing_settings: {
        Row: {
          base_cobranca: string
          cobrar_overhead_interno: boolean
          id: boolean
          updated_at: string
          usd_por_mtok: number
        }
        Insert: {
          base_cobranca?: string
          cobrar_overhead_interno?: boolean
          id?: boolean
          updated_at?: string
          usd_por_mtok?: number
        }
        Update: {
          base_cobranca?: string
          cobrar_overhead_interno?: boolean
          id?: boolean
          updated_at?: string
          usd_por_mtok?: number
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
          content?: string
          document_id?: string | null
          embedded_at?: string | null
          embedded_by?: string | null
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
      conversations: {
        Row: {
          created_at: string
          disclaimer: string | null
          fatos: Json
          hidden_at: string | null
          id: string
          p_base: string | null
          p_cod_candidato: string | null
          p_empresa: string | null
          p_matricula: string | null
          p_perfil: string | null
          p_portal: string | null
          p_usuario: string | null
          page: Json | null
          rag_memoria: Json
          session_id: string | null
          space_id: string
          title: string | null
          user_ref: string | null
          widget_user_ref: string | null
        }
        Insert: {
          created_at?: string
          disclaimer?: string | null
          fatos?: Json
          hidden_at?: string | null
          id?: string
          p_base?: string | null
          p_cod_candidato?: string | null
          p_empresa?: string | null
          p_matricula?: string | null
          p_perfil?: string | null
          p_portal?: string | null
          p_usuario?: string | null
          page?: Json | null
          rag_memoria?: Json
          session_id?: string | null
          space_id: string
          title?: string | null
          user_ref?: string | null
          widget_user_ref?: string | null
        }
        Update: {
          created_at?: string
          disclaimer?: string | null
          fatos?: Json
          hidden_at?: string | null
          id?: string
          p_base?: string | null
          p_cod_candidato?: string | null
          p_empresa?: string | null
          p_matricula?: string | null
          p_perfil?: string | null
          p_portal?: string | null
          p_usuario?: string | null
          page?: Json | null
          rag_memoria?: Json
          session_id?: string | null
          space_id?: string
          title?: string | null
          user_ref?: string | null
          widget_user_ref?: string | null
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
      data_dictionary: {
        Row: {
          app_id: string | null
          created_at: string
          db_column: string | null
          db_table: string | null
          description: string | null
          id: string
          kind: string
          label: string | null
          metadata: Json
          name: string
          page_id: string | null
          parent_name: string | null
          source: string
          space_id: string
          updated_at: string
        }
        Insert: {
          app_id?: string | null
          created_at?: string
          db_column?: string | null
          db_table?: string | null
          description?: string | null
          id?: string
          kind: string
          label?: string | null
          metadata?: Json
          name: string
          page_id?: string | null
          parent_name?: string | null
          source?: string
          space_id: string
          updated_at?: string
        }
        Update: {
          app_id?: string | null
          created_at?: string
          db_column?: string | null
          db_table?: string | null
          description?: string | null
          id?: string
          kind?: string
          label?: string | null
          metadata?: Json
          name?: string
          page_id?: string | null
          parent_name?: string | null
          source?: string
          space_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_dictionary_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      data_dictionary_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          done: number
          error: string | null
          found: number
          id: string
          input: Json
          kind: string
          progress: number
          result: Json | null
          space_id: string
          status: string
          total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          done?: number
          error?: string | null
          found?: number
          id?: string
          input?: Json
          kind?: string
          progress?: number
          result?: Json | null
          space_id: string
          status?: string
          total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          done?: number
          error?: string | null
          found?: number
          id?: string
          input?: Json
          kind?: string
          progress?: number
          result?: Json | null
          space_id?: string
          status?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "data_dictionary_jobs_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
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
            foreignKeyName: "extension_sessions_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
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
      gestao_suporte_acessos: {
        Row: {
          actor_id: string | null
          base_code: string
          created_at: string
          id: string
          ip: string | null
          pagina: string
          user_agent: string | null
        }
        Insert: {
          actor_id?: string | null
          base_code: string
          created_at?: string
          id?: string
          ip?: string | null
          pagina: string
          user_agent?: string | null
        }
        Update: {
          actor_id?: string | null
          base_code?: string
          created_at?: string
          id?: string
          ip?: string | null
          pagina?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          error: string | null
          extracted: Json | null
          flow_render: string | null
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
          flow_render?: string | null
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
          flow_render?: string | null
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
      infra_settings: {
        Row: {
          cb_cooldown_ms: number | null
          cb_failures: number | null
          cb_window_ms: number | null
          daily_token_cap_per_base: number | null
          id: boolean
          lease_ttl_seconds: number | null
          max_concurrency_per_base: number | null
          redis_rest_token_enc: string | null
          redis_rest_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cb_cooldown_ms?: number | null
          cb_failures?: number | null
          cb_window_ms?: number | null
          daily_token_cap_per_base?: number | null
          id?: boolean
          lease_ttl_seconds?: number | null
          max_concurrency_per_base?: number | null
          redis_rest_token_enc?: string | null
          redis_rest_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cb_cooldown_ms?: number | null
          cb_failures?: number | null
          cb_window_ms?: number | null
          daily_token_cap_per_base?: number | null
          id?: boolean
          lease_ttl_seconds?: number | null
          max_concurrency_per_base?: number | null
          redis_rest_token_enc?: string | null
          redis_rest_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
          media: Json | null
          output_tokens: number | null
          payload: Json | null
          role: string
          tokens: number | null
          turn_id: string | null
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
          media?: Json | null
          output_tokens?: number | null
          payload?: Json | null
          role: string
          tokens?: number | null
          turn_id?: string | null
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
          media?: Json | null
          output_tokens?: number | null
          payload?: Json | null
          role?: string
          tokens?: number | null
          turn_id?: string | null
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
          description: string | null
          icon: string | null
          id: string
          link_url: string | null
          parent_id: string | null
          path: unknown
          position: string
          publish_at: string | null
          published_at: string | null
          slug: string
          space_id: string
          status: string
          title: string
          type: string
          unpublish_at: string | null
          unpublish_redirect_to: string | null
          updated_at: string
          visibility: string | null
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          link_url?: string | null
          parent_id?: string | null
          path?: unknown
          position: string
          publish_at?: string | null
          published_at?: string | null
          slug: string
          space_id: string
          status?: string
          title?: string
          type: string
          unpublish_at?: string | null
          unpublish_redirect_to?: string | null
          updated_at?: string
          visibility?: string | null
        }
        Update: {
          author_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          link_url?: string | null
          parent_id?: string | null
          path?: unknown
          position?: string
          publish_at?: string | null
          published_at?: string | null
          slug?: string
          space_id?: string
          status?: string
          title?: string
          type?: string
          unpublish_at?: string | null
          unpublish_redirect_to?: string | null
          updated_at?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nodes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "author_profiles"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "nodes_unpublish_redirect_to_fkey"
            columns: ["unpublish_redirect_to"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          base_id: string | null
          created_at: string
          credential_id: string
          expected_email: string | null
          nonce: string
          origin: string | null
          person_key: string
          used_at: string | null
        }
        Insert: {
          base_id?: string | null
          created_at?: string
          credential_id: string
          expected_email?: string | null
          nonce: string
          origin?: string | null
          person_key: string
          used_at?: string | null
        }
        Update: {
          base_id?: string | null
          created_at?: string
          credential_id?: string
          expected_email?: string | null
          nonce?: string
          origin?: string | null
          person_key?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "ai_bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_states_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "ai_base_credentials"
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
          original_name: string | null
          progress: number
          scope: string
          source_file: string | null
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
          original_name?: string | null
          progress?: number
          scope?: string
          source_file?: string | null
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
          original_name?: string | null
          progress?: number
          scope?: string
          source_file?: string | null
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
            foreignKeyName: "ontology_terms_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ontology_terms_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ontology_translation_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          done: number
          error: string | null
          id: string
          lang: string
          progress: number
          space_id: string
          status: string
          total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          done?: number
          error?: string | null
          id?: string
          lang: string
          progress?: number
          space_id: string
          status?: string
          total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          done?: number
          error?: string | null
          id?: string
          lang?: string
          progress?: number
          space_id?: string
          status?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "ontology_translation_jobs_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ontology_translations: {
        Row: {
          aliases: Json
          created_at: string
          description: string | null
          id: string
          lang: string
          reviewed: boolean
          source: string
          term: string
          term_id: string
          term_norm: string
          updated_at: string
        }
        Insert: {
          aliases?: Json
          created_at?: string
          description?: string | null
          id?: string
          lang: string
          reviewed?: boolean
          source?: string
          term: string
          term_id: string
          term_norm: string
          updated_at?: string
        }
        Update: {
          aliases?: Json
          created_at?: string
          description?: string | null
          id?: string
          lang?: string
          reviewed?: boolean
          source?: string
          term?: string
          term_id?: string
          term_norm?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ontology_translations_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "ontology_terms"
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
          p_cod_candidato: string | null
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
          p_cod_candidato?: string | null
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
          p_cod_candidato?: string | null
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
            foreignKeyName: "page_views_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_views_space_id_fkey"
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
          origin: string
          query: string
          results_count: number
          space_id: string | null
          user_ref: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          origin?: string
          query: string
          results_count?: number
          space_id?: string | null
          user_ref?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          origin?: string
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
      space_languages: {
        Row: {
          active: boolean
          created_at: string
          id: string
          label: string | null
          lang: string
          space_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          label?: string | null
          lang: string
          space_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          label?: string | null
          lang?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_languages_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
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
      tenant_limits: {
        Row: {
          daily_token_cap: number | null
          max_concurrency: number | null
          tenant: string
          updated_at: string
        }
        Insert: {
          daily_token_cap?: number | null
          max_concurrency?: number | null
          tenant: string
          updated_at?: string
        }
        Update: {
          daily_token_cap?: number | null
          max_concurrency?: number | null
          tenant?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_connection_tokens: {
        Row: {
          access_enc: string | null
          connection_id: string
          refresh_enc: string
          updated_at: string
        }
        Insert: {
          access_enc?: string | null
          connection_id: string
          refresh_enc: string
          updated_at?: string
        }
        Update: {
          access_enc?: string | null
          connection_id?: string
          refresh_enc?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_connection_tokens_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "user_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      user_connections: {
        Row: {
          access_expires_at: string | null
          account_email: string | null
          account_name: string | null
          base_id: string
          created_at: string
          credential_id: string
          id: string
          person_key: string
          provider: string
          revoked_at: string | null
          scopes: string[]
          updated_at: string
        }
        Insert: {
          access_expires_at?: string | null
          account_email?: string | null
          account_name?: string | null
          base_id: string
          created_at?: string
          credential_id: string
          id?: string
          person_key: string
          provider: string
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string
        }
        Update: {
          access_expires_at?: string | null
          account_email?: string | null
          account_name?: string | null
          base_id?: string
          created_at?: string
          credential_id?: string
          id?: string
          person_key?: string
          provider?: string
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_connections_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "ai_bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_connections_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "ai_base_credentials"
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
      whatsapp_secrets: {
        Row: {
          access_token_enc: string | null
          app_secret_enc: string | null
          base_code: string
          identity_secret_enc: string | null
          updated_at: string
          verify_token_enc: string | null
        }
        Insert: {
          access_token_enc?: string | null
          app_secret_enc?: string | null
          base_code?: string
          identity_secret_enc?: string | null
          updated_at?: string
          verify_token_enc?: string | null
        }
        Update: {
          access_token_enc?: string | null
          app_secret_enc?: string | null
          base_code?: string
          identity_secret_enc?: string | null
          updated_at?: string
          verify_token_enc?: string | null
        }
        Relationships: []
      }
      whatsapp_settings: {
        Row: {
          active: boolean
          base_code: string
          business_account_id: string | null
          evolution_instance: string | null
          evolution_url: string | null
          identity_auth_type: string
          identity_endpoint: string | null
          identity_map: Json
          identity_method: string
          identity_phone_local: string
          identity_phone_param: string
          phone_number_id: string | null
          provider: string
          unidentified_message: string
          updated_at: string
          updated_by: string | null
          waba_id: string | null
        }
        Insert: {
          active?: boolean
          base_code?: string
          business_account_id?: string | null
          evolution_instance?: string | null
          evolution_url?: string | null
          identity_auth_type?: string
          identity_endpoint?: string | null
          identity_map?: Json
          identity_method?: string
          identity_phone_local?: string
          identity_phone_param?: string
          phone_number_id?: string | null
          provider?: string
          unidentified_message?: string
          updated_at?: string
          updated_by?: string | null
          waba_id?: string | null
        }
        Update: {
          active?: boolean
          base_code?: string
          business_account_id?: string | null
          evolution_instance?: string | null
          evolution_url?: string | null
          identity_auth_type?: string
          identity_endpoint?: string | null
          identity_map?: Json
          identity_method?: string
          identity_phone_local?: string
          identity_phone_param?: string
          phone_number_id?: string | null
          provider?: string
          unidentified_message?: string
          updated_at?: string
          updated_by?: string | null
          waba_id?: string | null
        }
        Relationships: []
      }
      widget_analysis_chunks: {
        Row: {
          created_at: string
          id: string
          job_id: string
          result: Json | null
          seq: number
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          result?: Json | null
          seq: number
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          result?: Json | null
          seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "widget_analysis_chunks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "widget_analysis_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      widget_analysis_jobs: {
        Row: {
          conversation_id: string | null
          created_at: string
          dataset_id: string
          error: string | null
          estimate: Json | null
          id: string
          instrucao: string | null
          kind: string
          pre_filtro: Json
          processed: number
          progress: number
          result: Json | null
          rotulos: Json
          session_id: string | null
          space_id: string
          status: string
          target_column: string
          total: number
          track: string | null
          updated_at: string
          user_ref: string
          widget_key_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          dataset_id: string
          error?: string | null
          estimate?: Json | null
          id?: string
          instrucao?: string | null
          kind?: string
          pre_filtro?: Json
          processed?: number
          progress?: number
          result?: Json | null
          rotulos?: Json
          session_id?: string | null
          space_id: string
          status?: string
          target_column: string
          total?: number
          track?: string | null
          updated_at?: string
          user_ref: string
          widget_key_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          dataset_id?: string
          error?: string | null
          estimate?: Json | null
          id?: string
          instrucao?: string | null
          kind?: string
          pre_filtro?: Json
          processed?: number
          progress?: number
          result?: Json | null
          rotulos?: Json
          session_id?: string | null
          space_id?: string
          status?: string
          target_column?: string
          total?: number
          track?: string | null
          updated_at?: string
          user_ref?: string
          widget_key_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "widget_analysis_jobs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_analysis_jobs_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "widget_datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_analysis_jobs_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_analysis_jobs_widget_key_id_fkey"
            columns: ["widget_key_id"]
            isOneToOne: false
            referencedRelation: "widget_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      widget_base_selection: {
        Row: {
          modo: string
          relatorio_ids: Json
          space_id: string
          updated_at: string
          user_ref: string
        }
        Insert: {
          modo?: string
          relatorio_ids?: Json
          space_id: string
          updated_at?: string
          user_ref: string
        }
        Update: {
          modo?: string
          relatorio_ids?: Json
          space_id?: string
          updated_at?: string
          user_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_base_selection_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      widget_datasets: {
        Row: {
          client_key: string
          columns: Json
          conversation_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          rows: Json | null
          seq: number | null
          source_name: string | null
          space_id: string
          storage_path: string | null
          total: number
          user_ref: string
          widget_key_id: string | null
        }
        Insert: {
          client_key: string
          columns?: Json
          conversation_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          rows?: Json | null
          seq?: number | null
          source_name?: string | null
          space_id: string
          storage_path?: string | null
          total?: number
          user_ref: string
          widget_key_id?: string | null
        }
        Update: {
          client_key?: string
          columns?: Json
          conversation_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          rows?: Json | null
          seq?: number | null
          source_name?: string | null
          space_id?: string
          storage_path?: string | null
          total?: number
          user_ref?: string
          widget_key_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "widget_datasets_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_datasets_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_datasets_widget_key_id_fkey"
            columns: ["widget_key_id"]
            isOneToOne: false
            referencedRelation: "widget_keys"
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
      widget_saved_reports: {
        Row: {
          chart: Json | null
          columns: Json
          content: string | null
          created_at: string
          file_name: string | null
          id: string
          kind: string
          mime: string | null
          name: string
          origem: string | null
          rows: Json
          source_name: string | null
          space_id: string
          total: number
          user_ref: string
          widget_key_id: string | null
        }
        Insert: {
          chart?: Json | null
          columns?: Json
          content?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          kind?: string
          mime?: string | null
          name: string
          origem?: string | null
          rows?: Json
          source_name?: string | null
          space_id: string
          total?: number
          user_ref: string
          widget_key_id?: string | null
        }
        Update: {
          chart?: Json | null
          columns?: Json
          content?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          kind?: string
          mime?: string | null
          name?: string
          origem?: string | null
          rows?: Json
          source_name?: string | null
          space_id?: string
          total?: number
          user_ref?: string
          widget_key_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "widget_saved_reports_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "widget_saved_reports_widget_key_id_fkey"
            columns: ["widget_key_id"]
            isOneToOne: false
            referencedRelation: "widget_keys"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      atividade_recente: {
        Row: {
          created_at: string | null
          error: string | null
          id: string | null
          progresso: number | null
          rotulo: string | null
          space_id: string | null
          status: string | null
          tipo: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      ai_daily_tokens: { Args: { p_tenant: string }; Returns: number }
      ai_provider_has_key: { Args: { p_provider_id: string }; Returns: boolean }
      ai_slot_acquire: {
        Args: { p_max: number; p_tenant: string; p_ttl_seconds: number }
        Returns: string
      }
      ai_slot_release: { Args: { p_id: string }; Returns: undefined }
      ai_usage_por_cliente: {
        Args: { p_from: string; p_to: string }
        Returns: {
          cache_read_tokens: number
          cache_write_tokens: number
          calls: number
          cliente: string
          input_tokens: number
          kind: string
          model: string
          output_tokens: number
          provider: string
          total_tokens: number
          usuarios: number
        }[]
      }
      ai_usage_report: {
        Args: {
          p_from: string
          p_kind?: string
          p_to: string
          pf_base?: string
          pf_empresa?: string
          pf_matricula?: string
          pf_perfil?: string
          pf_portal?: string
          pf_usuario?: string
        }
        Returns: {
          cache_read_tokens: number
          cache_write_tokens: number
          calls: number
          input_tokens: number
          kind: string
          model: string
          output_tokens: number
          provider: string
          purpose: string
          total_tokens: number
        }[]
      }
      ai_usage_window: { Args: { p_seconds: number }; Returns: Json }
      analises_busca: {
        Args: { p_dias?: number; p_top?: number }
        Returns: {
          achou: boolean
          sem_resultado: number
          termo: string
          total: number
          vezes: number
        }[]
      }
      analises_chat: {
        Args: { p_dias?: number }
        Returns: {
          latencia_media: number
          nao_uteis: number
          recusas: number
          respostas: number
          uteis: number
        }[]
      }
      analises_leitura: {
        Args: { p_dias?: number; p_top?: number }
        Returns: {
          node_id: string
          space_id: string
          title: string
          total_views: number
          views: number
        }[]
      }
      analises_sem_visita: {
        Args: { p_dias?: number; p_top?: number }
        Returns: {
          node_id: string
          space_id: string
          title: string
          total_publicados: number
          total_sem_visita: number
        }[]
      }
      analises_serie: {
        Args: { p_dias?: number }
        Returns: {
          day: string
          space_id: string
          views: number
        }[]
      }
      approve_review: { Args: { p_node_id: string }; Returns: undefined }
      approvers_for_node: {
        Args: { p_node_id: string }
        Returns: {
          user_id: string
        }[]
      }
      base_credential_has_secret: {
        Args: { p_credential_id: string }
        Returns: boolean
      }
      create_article_version: {
        Args: { p_label?: string; p_node_id: string; p_protected?: boolean }
        Returns: number
      }
      delete_space_deep: { Args: { p_space_id: string }; Returns: Json }
      email_has_secret: { Args: { p_campo: string }; Returns: boolean }
      embeddings_report: {
        Args: { p_space_id?: string }
        Returns: {
          chunk_count: number
          embedded_at: string
          embedded_by: string
          embedded_count: number
          model: string
          origin_id: string
          origin_kind: string
          provider: string
          space_id: string
          space_name: string
          status: string
          title: string
        }[]
      }
      f_unaccent: { Args: { "": string }; Returns: string }
      fail_stale_import_jobs: { Args: { p_minutes?: number }; Returns: number }
      faturamento_detalhe: {
        Args: {
          p_from: string
          p_origens?: string[]
          p_to: string
          pf_cliente?: string
        }
        Returns: {
          cache_read: number
          cache_read_mult: number
          cache_write: number
          cache_write_mult: number
          chamadas: number
          cliente: string
          custo_usd: number
          entrada_nova: number
          entrada_total: number
          kind: string
          model: string
          origem: string
          preco_confirmado: boolean
          provider: string
          purpose: string
          saida: number
          tokens_brutos: number
          tokens_ponderados: number
        }[]
      }
      faturamento_por_mensagem: {
        Args: { p_from: string; p_origens?: string[]; p_to: string }
        Returns: {
          cache_read: number
          cache_write: number
          chamadas: number
          cliente: string
          conversation_id: string
          criado_em: string
          entrada_total: number
          pergunta: string
          saida: number
          tokens_brutos: number
          tokens_ponderados: number
          turn_id: string
        }[]
      }
      gc_versions: { Args: never; Returns: number }
      gestao_alocacoes: {
        Args: { p_base: string; p_momento?: string }
        Returns: {
          alvo: string
          alvo_tipo: string
          ativo: boolean
          creditos_alocados: number
          creditos_consumidos: number
          creditos_saldo: number
          id: string
          painel: string
        }[]
      }
      gestao_ciclo: {
        Args: { p_dia: number; p_momento?: string }
        Returns: {
          fim: string
          inicio: string
        }[]
      }
      gestao_compras: {
        Args: { p_ate?: string; p_base: string; p_de?: string }
        Returns: {
          ciclo_inicio: string
          creditos: number
          criado_em: string
          id: string
          motivo: string
          solicitado_por: string
          usd_por_credito: number
          usd_total: number
        }[]
      }
      gestao_consumo: {
        Args: {
          p_base: string
          p_empresa?: string
          p_from: string
          p_matricula?: string
          p_painel?: string
          p_perfil?: string
          p_to: string
          p_usuario?: string
        }
        Returns: {
          atribuido: boolean
          chamadas: number
          conversas: number
          creditos: number
          empresa: string
          matricula: string
          painel: string
          perfil: string
          tokens_brutos: number
          tokens_entrada: number
          tokens_saida: number
          usuario: string
        }[]
      }
      gestao_consumo_facetas: {
        Args: { p_base: string; p_from: string; p_to: string }
        Returns: {
          chamadas: number
          eixo: string
          valor: string
        }[]
      }
      gestao_plano: {
        Args: { p_base: string; p_momento?: string }
        Returns: {
          base_code: string
          ciclo_fim: string
          ciclo_inicio: string
          creditos_por_ciclo: number
          dia_inicio_ciclo: number
          tem_plano: boolean
          tokens_por_credito: number
          usd_por_credito: number
        }[]
      }
      gestao_portao_credito: {
        Args: {
          p_base: string
          p_painel?: string
          p_perfil?: string
          p_usuario?: string
        }
        Returns: Json
      }
      gestao_saldo: {
        Args: { p_base: string; p_momento?: string }
        Returns: {
          base_code: string
          ciclo_fim: string
          ciclo_inicio: string
          creditos_consumidos: number
          creditos_contratados: number
          creditos_disponiveis: number
          creditos_extra: number
          creditos_saldo: number
          tem_plano: boolean
          tokens_brutos: number
          tokens_nao_atribuidos: number
          tokens_por_credito: number
          usd_por_credito: number
          usd_total: number
        }[]
      }
      hard_delete_subtree: { Args: { p_node_id: string }; Returns: number }
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
        Args: { p_node_id: string; p_permission_key: string; p_user_id: string }
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
      hybrid_search_scoped: {
        Args: {
          p_boost?: string
          p_document_ids?: string[]
          p_embedding?: string
          p_group_limit?: number
          p_limit?: number
          p_node_ids?: string[]
          p_query: string
        }
        Returns: {
          content: string
          document_id: string
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
      knowledge_list_chunks: {
        Args: { p_document_ids: string[]; p_limit?: number; p_query: string }
        Returns: {
          content: string
          document_id: string
          heading_path: string
          score: number
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
      painel_resumo: {
        Args: never
        Returns: {
          feedback_total: number
          feedback_util: number
          total_views: number
        }[]
      }
      painel_top_artigos: {
        Args: { p_limit?: number }
        Returns: {
          node_id: string
          status: string
          title: string
          util_pct: number
          views: number
        }[]
      }
      permissions_of: {
        Args: { p_space_id?: string; p_user_id: string }
        Returns: string[]
      }
      purge_trash: { Args: { p_days?: number }; Returns: number }
      rate_limit_hit: {
        Args: { p_bucket: string; p_max: number; p_window_seconds?: number }
        Returns: boolean
      }
      rate_limits_gc: { Args: never; Returns: undefined }
      register_article_view: { Args: { p_node_id: string }; Returns: undefined }
      reject_review: {
        Args: { p_comment: string; p_node_id: string }
        Returns: undefined
      }
      related_articles: {
        Args: { p_limit?: number; p_node_ids: string[]; p_space_id: string }
        Returns: {
          node_id: string
          score: number
        }[]
      }
      rename_article_version: {
        Args: { p_label: string; p_protected: boolean; p_version_id: string }
        Returns: undefined
      }
      restore_subtree: { Args: { p_node_id: string }; Returns: number }
      resumo_dicionario: {
        Args: { p_space_id: string }
        Returns: {
          atualizado_em: string
          com_descricao: number
          com_label: number
          com_tipo: number
          linhas: number
          origem: string
          tabelas: number
        }[]
      }
      set_ai_provider_key: {
        Args: { p_key_enc: string; p_provider_id: string }
        Returns: undefined
      }
      set_base_credential_secret: {
        Args: { p_credential_id: string; p_secret_enc: string }
        Returns: undefined
      }
      set_email_secret: {
        Args: { p_campo: string; p_valor_enc: string }
        Returns: undefined
      }
      set_space_password: {
        Args: { p_plain: string; p_space_id: string }
        Returns: undefined
      }
      set_whatsapp_secret: {
        Args: { p_base: string; p_campo: string; p_valor_enc: string }
        Returns: undefined
      }
      soft_delete_subtree: { Args: { p_node_id: string }; Returns: number }
      space_has_password: { Args: { p_space_id: string }; Returns: boolean }
      storage_space_id: { Args: { p_name: string }; Returns: string }
      submit_for_review: { Args: { p_node_id: string }; Returns: undefined }
      subtree_ids: {
        Args: { p_node_id: string }
        Returns: {
          id: string
          type: string
        }[]
      }
      titulos_de_partida: {
        Args: { p_limit?: number; p_space_id: string }
        Returns: {
          title: string
        }[]
      }
      tool_uso_vizinhos: {
        Args: {
          p_base: string
          p_embedding: string
          p_limite?: number
          p_min_sim?: number
        }
        Returns: {
          amostras: number
          peso: number
          tool_key: string
        }[]
      }
      top_helpful_articles: {
        Args: { p_limit?: number; p_space_id: string }
        Returns: {
          helpful: number
          node_id: string
          total: number
        }[]
      }
      verify_space_password: {
        Args: { p_plain: string; p_space_id: string }
        Returns: boolean
      }
      views_dos_nos: { Args: { p_ids: string[] }; Returns: number }
      whatsapp_has_secret: { Args: { p_campo: string }; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
