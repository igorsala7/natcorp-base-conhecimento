-- =====================================================================
-- PERFIS DE AGENTE por MÓDULO para ANÁLISE DE RELATÓRIOS (Classic/IR/IG)
-- Um "perfil de análise" define a PERSONA (título, nome, cargo, comportamento)
-- usada quando o usuário pede uma análise de um relatório da tela, escolhida
-- pelo MÓDULO do relatório (ex.: "SEGURANÇA DO TRABALHO" → engenheiro do
-- trabalho). Diferente de `ai_agents`: NÃO precisa de tools vinculadas (a
-- análise sai do próprio relatório + RAG + ontologia). Por BASE do cliente,
-- como `ai_tool_modules`. Ver [[report-source-router]] / system-prompt.
-- =====================================================================
create table public.ai_agent_profiles (
  id uuid primary key default gen_random_uuid(),
  base_code text not null,
  -- Campos estruturados que COMPÕEM a persona (+ prompt_refino livre opcional).
  titulo text not null,
  nome text,
  descricao text,
  cargo text,
  comportamento text,
  -- Tipos de ação da análise (checkboxes): sugestoes|pontos_atencao|alertas|estrategias|diagnostico.
  acoes text[] not null default '{}',
  prompt_refino text not null default '',
  -- Gating opcional pelo perfil resolvido no login (mesma regra de ai_agents; nulo = qualquer).
  requires_perfil text,
  priority int not null default 0,
  active boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_agent_profiles_base_idx on public.ai_agent_profiles (base_code, active);

-- Módulos vinculados ao perfil (M2M por TEXTO, espelha ai_tool_modules — decoupla
-- de ai_modules, que é cache re-sincronizável; submodulo null = módulo inteiro).
create table public.ai_agent_profile_modules (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.ai_agent_profiles (id) on delete cascade,
  modulo text not null,
  submodulo text,
  created_at timestamptz not null default now()
);
create index ai_agent_profile_modules_profile_idx on public.ai_agent_profile_modules (profile_id);
-- Único por (perfil, módulo, submódulo) — via ÍNDICE (constraint não aceita coalesce()).
create unique index ai_agent_profile_modules_uniq
  on public.ai_agent_profile_modules (profile_id, modulo, coalesce(submodulo, ''));

-- Cache GLOBAL do módulo detectado por ESTRUTURA de relatório (título+colunas+
-- vocabulário de perfis). Evita rodar o classificador-LLM a cada mensagem/usuário:
-- a estrutura do relatório é estável → detecta 1× e reusa. `report_key` já embute
-- o hash do vocabulário de perfis, então mudar perfis gera nova chave (auto-invalida).
create table public.ai_report_module_cache (
  base_code text not null,
  report_key text not null,
  modulos jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (base_code, report_key)
);

-- =====================================================================
-- RLS — cadastros administram-se com `integrations.manage` (escopo global),
-- padrão idêntico ao de ai_agents/ai_tools. O cache é interno (só service-role).
-- =====================================================================
alter table public.ai_agent_profiles         enable row level security;
alter table public.ai_agent_profile_modules  enable row level security;
alter table public.ai_report_module_cache     enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['ai_agent_profiles', 'ai_agent_profile_modules'] loop
    execute format(
      'create policy %1$s_read on public.%1$I for select to authenticated '
      'using (public.has_permission(auth.uid(), ''integrations.manage'', null));', t);
    execute format(
      'create policy %1$s_write on public.%1$I for all to authenticated '
      'using (public.has_permission(auth.uid(), ''integrations.manage'', null)) '
      'with check (public.has_permission(auth.uid(), ''integrations.manage'', null));', t);
    execute format('revoke all on public.%1$I from anon;', t);
  end loop;
end $$;

-- Cache: sem policy, sem grant — só o service-role (o servidor) lê/grava.
revoke all on public.ai_report_module_cache from anon, authenticated;
