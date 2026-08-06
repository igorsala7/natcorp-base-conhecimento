-- =====================================================================
-- EMBEDDING DA FERRAMENTA POR BASE — enriquecido com a ONTOLOGIA do cliente
--
-- `ai_tools.embedding` é GLOBAL: nome + descrição + sinônimos digitados à mão.
-- O problema, nas palavras do usuário: "é impossível digitar 100% do que seria
-- sinônimo ou frases". A ontologia da documentação já tem esse vocabulário
-- (1.095 termos e 10.628 sinônimos na natcorp: "centro de custo" ↔ célula,
-- departamento, setor…) — mas ela só alimentava a busca de TEXTO, nunca a
-- escolha da ferramenta.
--
-- Enriquecer o vetor GLOBAL resolveria o roteamento e criaria outro problema: a
-- ontologia é POR DOCUMENTAÇÃO/CLIENTE, e o catálogo de tools é compartilhado
-- entre todas as bases — o "célula" do Cliente A entraria no vetor que o Cliente
-- B consulta. Por isso o vetor enriquecido vive AQUI, por (base, tool):
--
--   ai_tools.embedding            → global, o de sempre (fallback)
--   ai_tool_base_embeddings       → o da base, com a ontologia DELA
--
-- O carregamento do catálogo prefere o da base e cai no global quando não há.
-- Nenhuma base enxerga o vocabulário de outra.
-- =====================================================================

create table if not exists public.ai_tool_base_embeddings (
  base_id uuid not null references public.ai_bases (id) on delete cascade,
  tool_id uuid not null references public.ai_tools (id) on delete cascade,
  embedding vector(1536),
  -- Hash do texto que gerou o vetor (tool + ontologia casada). Igual = nada a
  -- refazer: sem isto, cada republicação de ontologia re-embeddaria o catálogo
  -- inteiro sem necessidade.
  fonte_hash text not null,
  -- Quantos termos da ontologia entraram — diagnóstico direto na tela/consulta.
  termos_ontologia int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (base_id, tool_id)
);

create index if not exists ai_tool_base_embeddings_tool_idx
  on public.ai_tool_base_embeddings (tool_id);

comment on table public.ai_tool_base_embeddings is
  'Embedding da ferramenta ENRIQUECIDO com a ontologia da base (por cliente). Preferido ao ai_tools.embedding no roteamento; o global segue como fallback.';
comment on column public.ai_tool_base_embeddings.fonte_hash is
  'Hash do texto-fonte (nome+descrição+sinônimos+ontologia casada). Igual = pula a regeração.';

-- RLS: mesmo padrão do módulo (integrations.manage, escopo global).
alter table public.ai_tool_base_embeddings enable row level security;

drop policy if exists ai_tool_base_embeddings_read on public.ai_tool_base_embeddings;
create policy ai_tool_base_embeddings_read on public.ai_tool_base_embeddings
  for select to authenticated
  using (public.has_permission(auth.uid(), 'integrations.manage', null));

drop policy if exists ai_tool_base_embeddings_write on public.ai_tool_base_embeddings;
create policy ai_tool_base_embeddings_write on public.ai_tool_base_embeddings
  for all to authenticated
  using (public.has_permission(auth.uid(), 'integrations.manage', null))
  with check (public.has_permission(auth.uid(), 'integrations.manage', null));

revoke all on public.ai_tool_base_embeddings from anon;
