-- =====================================================================
-- TAXONOMIA DE MÓDULOS/SUBMÓDULOS DAS TOOLS (Opção A — Fase 1)
--
-- Objetivo: reduzir tokens/tools por mensagem. Em vez de mandar TODAS as
-- tools do perfil a cada passo do loop, um classificador rápido escolhe o(s)
-- MÓDULO(S)/SUBMÓDULO(S) do assunto e o tool-builder envia só as tools daquele
-- recorte.
--
-- DOIS papéis distintos (não confundir):
--   • `ai_modules`      = CACHE da taxonomia que vem do endpoint do CLIENTE
--                         (por base + portal). Fonte do SELETOR na tela de
--                         tools. NÃO é lida pelo classificador (é enorme).
--   • `ai_tool_modules` = as tags de módulo/submódulo que cada tool REALMENTE
--                         serve (muitos-para-muitos). É daqui que sai o
--                         vocabulário pequeno do classificador (só o que as
--                         tools habilitadas usam) — o que mantém o ganho.
--
-- Endpoint (Fase 2, sync): GET {ai_bases.base_url}/chatbot/modulos/v1/consulta
--   ?p_painel={ (vazio)=todos | PC | PG | PO }  → { items:[{modulo, sub_modulo}], ... }
--   OBS.: o parâmetro do endpoint é `p_painel`; internamente chamamos o conceito
--   de `portal` (mesmos valores PC/PG/PO), como no resto do código (identity.portal).
--   `sub_modulo` = lista separada por ';' de caminhos hierárquicos "A > B > C".
--   Paginado (hasMore/offset/links.next). Requer tratar encoding (há mojibake)
--   e DEDUPE (o mesmo módulo aparece em vários items/portais).
--
-- Permissão: reusa `integrations.manage`. Runtime lê por service-role.
-- =====================================================================

-- Limpa a 1ª tentativa (ainda sem commit, tabelas vazias) para reescrever o
-- modelo correto — idempotente em banco novo (tudo `if exists`).
alter table public.ai_tools drop column if exists module_id;
drop table if exists public.ai_tool_modules;
drop table if exists public.ai_modules cascade;

-- ─────────────────────────────────────────────────────────────────────
-- 1. CACHE DA TAXONOMIA DO CLIENTE (por base + portal) — fonte do SELETOR
-- Uma linha por (modulo, submodulo). `submodulo` null = o módulo "raiz";
-- senão é o caminho completo do endpoint ("A > B > C", multi-nível).
-- `portal` null = disponível em todos; senão o portal em que o endpoint o
-- retornou. Recarregado por um sync (upsert) a partir do endpoint.
-- ─────────────────────────────────────────────────────────────────────
create table public.ai_modules (
  id uuid primary key default gen_random_uuid(),
  base_code text not null,
  portal text check (portal in ('PC', 'PG', 'PO')),   -- null = todos
  modulo text not null,
  submodulo text,                                      -- null = módulo raiz; senão "A > B > C"
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index ai_modules_unq on public.ai_modules (base_code, coalesce(portal, ''), modulo, coalesce(submodulo, ''));
create index ai_modules_base_idx   on public.ai_modules (base_code);
create index ai_modules_modulo_idx on public.ai_modules (base_code, modulo);

-- ─────────────────────────────────────────────────────────────────────
-- 2. VÍNCULO TOOL → MÓDULOS/SUBMÓDULOS (muitos-para-muitos)
-- Uma tool pode servir vários módulos/submódulos. Guardo TEXTO (não FK para
-- ai_modules) de propósito: a tool é global e o cache é por base/recarregável;
-- desacoplar evita a tag "sumir" quando o cache é re-sincronizado.
-- `submodulo` null = a tool serve o módulo inteiro.
-- ─────────────────────────────────────────────────────────────────────
create table public.ai_tool_modules (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.ai_tools (id) on delete cascade,
  modulo text not null,
  submodulo text,                                      -- null = módulo inteiro
  created_at timestamptz not null default now()
);
create unique index ai_tool_modules_unq      on public.ai_tool_modules (tool_id, modulo, coalesce(submodulo, ''));
create index        ai_tool_modules_tool_idx on public.ai_tool_modules (tool_id);

-- ─────────────────────────────────────────────────────────────────────
-- 3. Tool "essencial": sempre entra no conjunto, independentemente do
-- roteamento por assunto (rede de segurança — ex.: consultas base/identidade).
-- ─────────────────────────────────────────────────────────────────────
alter table public.ai_tools add column if not exists always_include boolean not null default false;

-- ─────────────────────────────────────────────────────────────────────
-- 4. Liga a seleção por assunto POR BASE (default OFF = comportamento de hoje:
-- manda todas as tools do perfil). Idempotente (pode já existir da 1ª versão).
-- ─────────────────────────────────────────────────────────────────────
alter table public.ai_bases add column if not exists tool_routing boolean not null default false;

-- =====================================================================
-- RLS — mesmo padrão dos demais cadastros de integração (integrations.manage).
-- =====================================================================
alter table public.ai_modules      enable row level security;
alter table public.ai_tool_modules enable row level security;

do $$
declare t text;
begin
  foreach t in array array['ai_modules', 'ai_tool_modules'] loop
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
