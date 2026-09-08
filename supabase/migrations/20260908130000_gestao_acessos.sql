-- =====================================================================
-- REGRAS DE ACESSO ÀS FERRAMENTAS — a parametrização que o cliente faz
--
-- Responde a quatro pedidos concretos da demanda:
--   · no Painel do Gestor, o perfil GESTOR_FINANCEIRO não vê SESMT nem Avaliações
--   · o usuário ADIAS não vê ponto eletrônico
--   · histórico financeiro só para um usuário específico
--   · treinamento liberado para um perfil específico
--
-- ── Onde isto entra na cadeia de decisão ───────────────────────────────
-- O funil de `tool-builder.ts` já tem cerca em três lugares: `ai_base_tools`
-- (portais/perfis/empresas), `ai_tools.panel_scope` (escopo de dados por painel)
-- e o recorte por assunto. Esta tabela NÃO substitui nenhum deles — ela entra
-- ANTES do recorte por assunto, e VENCE o cruzamento automático com a API de
-- permissões do ERP, como o dono pediu.
--
--   1. regra de usuário   2. regra de perfil   3. regra de base
--   4. cruzamento automático com /permissoes/v1/modulos
--   5. cerca preexistente (ai_base_tools + panel_scope)
--
-- A primeira que decide, vence. Dentro do mesmo nível, NEGAR vence PERMITIR —
-- porque uma regra de bloqueio criada por engano é um chamado, e uma liberação
-- criada por engano é um vazamento.
--
-- ── Três colunas de escopo, e não uma string composta ──────────────────
-- `modulo`/`submodulo` separados (em vez de "MÓDULO > SUB") porque é assim que
-- `ai_tool_modules` e `ai_modules` guardam, e é assim que a API do ERP devolve.
-- Concatenar aqui obrigaria a desconcatenar na hora de cruzar, e o separador
-- ' > ' JÁ APARECE DENTRO de submódulos reais no cadastro
-- (ex.: 'MOVIMENTAÇÕES > FUNCIONAIS E CADASTRAIS > FÉRIAS') — o split seria
-- ambíguo e silenciosamente errado.
-- =====================================================================

create table if not exists public.ai_acesso_regras (
  id uuid primary key default gen_random_uuid(),
  base_code text not null
    references public.ai_bases (base_code) on update cascade on delete cascade,

  -- NULL = a regra vale em TODOS os painéis. O caso da demanda usa painel
  -- explícito ("no portal do gestor"), mas bloquear em todo lugar é comum.
  painel text check (painel in ('PO', 'PG', 'PC')),

  -- A QUEM a regra se aplica. 'base' é o padrão da casa (vale para todos),
  -- usado no caso "negar para todos, liberar só para fulano".
  alvo_tipo text not null check (alvo_tipo in ('base', 'perfil', 'usuario')),
  alvo text,                       -- NULL só quando alvo_tipo = 'base'

  -- SOBRE O QUE. Uma tool nominal, um módulo inteiro, ou um submódulo.
  escopo_tipo text not null check (escopo_tipo in ('tool', 'modulo', 'submodulo')),
  tool_key text,                   -- quando escopo_tipo = 'tool'
  modulo text,                     -- quando 'modulo' ou 'submodulo'
  submodulo text,                  -- quando 'submodulo'

  efeito text not null check (efeito in ('permitir', 'negar')),

  ativo boolean not null default true,
  observacao text,
  -- Login do lado do CLIENTE (token do APEX), não usuário do nosso Supabase:
  -- a regra é criada dentro do iFrame.
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint ai_acesso_regras_base_norm check (base_code = lower(btrim(base_code))),
  constraint ai_acesso_regras_alvo_coerente check (
    (alvo_tipo = 'base' and alvo is null)
    or (alvo_tipo in ('perfil', 'usuario') and alvo is not null and btrim(alvo) <> '')
  ),
  constraint ai_acesso_regras_escopo_coerente check (
    (escopo_tipo = 'tool'      and tool_key is not null and btrim(tool_key) <> ''
                               and modulo is null and submodulo is null)
    or (escopo_tipo = 'modulo' and modulo is not null and btrim(modulo) <> ''
                               and submodulo is null and tool_key is null)
    or (escopo_tipo = 'submodulo' and modulo is not null and btrim(modulo) <> ''
                               and submodulo is not null and btrim(submodulo) <> ''
                               and tool_key is null)
  )
);

comment on table public.ai_acesso_regras is
  'Parametrização de acesso feita pelo CLIENTE na área /gestao. Tem precedência sobre o cruzamento automático com a API de permissões do ERP. Precedência interna: usuário > perfil > base; dentro do mesmo nível, negar vence permitir.';
comment on column public.ai_acesso_regras.painel is
  'NULL = vale em todos os painéis. Diferente de ai_tools.panel_scope, onde a ausência de um painel no mapa significa outra coisa — aqui a ausência é abrangência.';
comment on column public.ai_acesso_regras.submodulo is
  'Submódulo exatamente como aparece em ai_tool_modules/ai_modules, inclusive quando contém " > " no meio (ex.: "MOVIMENTAÇÕES > FUNCIONAIS E CADASTRAIS > FÉRIAS"). Não é caminho a ser dividido.';

-- Um recorte, uma regra. Sem isto dá para cadastrar 'permitir' e 'negar' para o
-- mesmo alvo e escopo, e o resultado passa a depender da ordem de leitura.
create unique index if not exists ai_acesso_regras_recorte_idx
  on public.ai_acesso_regras (
    base_code,
    coalesce(painel, '*'),
    alvo_tipo,
    coalesce(alvo, '*'),
    escopo_tipo,
    coalesce(tool_key, '*'),
    coalesce(modulo, '*'),
    coalesce(submodulo, '*')
  );

-- O caminho quente: resolver as regras de uma base num turno de chat.
create index if not exists ai_acesso_regras_base_ativo_idx
  on public.ai_acesso_regras (base_code) where ativo;

alter table public.ai_acesso_regras enable row level security;

drop policy if exists ai_acesso_regras_read on public.ai_acesso_regras;
create policy ai_acesso_regras_read on public.ai_acesso_regras
  for select to authenticated using (
    public.has_permission(auth.uid(), 'integrations.manage', null)
  );

drop policy if exists ai_acesso_regras_write on public.ai_acesso_regras;
create policy ai_acesso_regras_write on public.ai_acesso_regras
  for all to authenticated using (
    public.has_permission(auth.uid(), 'integrations.manage', null)
  ) with check (
    public.has_permission(auth.uid(), 'integrations.manage', null)
  );

revoke all on public.ai_acesso_regras from anon;
