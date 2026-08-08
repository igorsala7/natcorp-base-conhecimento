-- =====================================================================
-- PREÇOS E MULTIPLICADORES DE CACHE POR PROVEDOR/MODELO
--
-- Sem esta tabela não existe a coluna "% dos tokens em cache que é realmente
-- cobrado": o multiplicador é do PROVEDOR, não do nosso código. Na Anthropic a
-- leitura de cache sai por ~0,10× e a escrita por ~1,25× do preço de entrada —
-- ou seja, 100 mil tokens lidos do cache custam o mesmo que 10 mil novos.
--
-- Uma linha por (provedor, modelo, vigência). Preço muda com o tempo e uma
-- fatura de junho tem de continuar batendo em dezembro, então a consulta pega
-- a linha vigente NA DATA da chamada, não a mais recente.
--
-- `fonte` existe para separar o que foi conferido do que é chute: qualquer
-- linha com `confirmado = false` aparece marcada no relatório, e o custo em
-- dólar dela não entra nos totais. Preço errado sem aviso é pior que preço
-- ausente — um some da tela, o outro vira fatura.
-- =====================================================================

create table if not exists public.ai_model_prices (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  -- Preço de tabela, em dólar por MILHÃO de tokens. Nulo = não cadastrado.
  input_usd_mtok  numeric(12, 6),
  output_usd_mtok numeric(12, 6),
  -- Fatias de `input_tokens` que têm preço próprio, como MULTIPLICADOR do
  -- preço de entrada. 1,0 = sem desconto (o padrão conservador de quem não
  -- sabe: nunca subestima o custo).
  cache_read_mult  numeric(6, 4) not null default 1.0,
  cache_write_mult numeric(6, 4) not null default 1.0,
  vigente_desde timestamptz not null default '1970-01-01T00:00:00Z',
  confirmado boolean not null default false,
  fonte text,
  created_at timestamptz not null default now(),
  unique (provider, model, vigente_desde)
);

comment on table public.ai_model_prices is
  'Preço de tabela e multiplicadores de cache por provedor/modelo, com vigência. Usado pelo faturamento para calcular tokens EQUIVALENTES (o que o provedor realmente cobra) ao lado dos tokens brutos.';
comment on column public.ai_model_prices.cache_read_mult is
  'Quanto custa 1 token lido do cache, como fração do preço de entrada. Anthropic ≈ 0,10. Padrão 1,0 (sem desconto) para não subestimar custo de provedor não cadastrado.';
comment on column public.ai_model_prices.cache_write_mult is
  'Quanto custa 1 token gravado no cache, como fração do preço de entrada. Anthropic ≈ 1,25 no TTL de 5 min (o que este projeto usa: cacheControl ephemeral em lib/ai/anthropic-cache.ts).';
comment on column public.ai_model_prices.confirmado is
  'false = valor não conferido na tabela oficial do provedor. O relatório marca a linha e NÃO soma o custo em dólar dela.';

alter table public.ai_model_prices enable row level security;

create policy ai_model_prices_read on public.ai_model_prices
  for select to authenticated using (
    public.has_permission(auth.uid(), 'ai.configure', null)
  );
create policy ai_model_prices_write on public.ai_model_prices
  for all to authenticated using (
    public.has_permission(auth.uid(), 'ai.configure', null)
  ) with check (
    public.has_permission(auth.uid(), 'ai.configure', null)
  );

revoke all on public.ai_model_prices from anon;

-- ── Seed ────────────────────────────────────────────────────────────────
-- Só o que dá para afirmar. Os modelos Anthropic vêm da tabela de preços da
-- Anthropic; os multiplicadores de cache são os documentados (leitura ~0,10×,
-- escrita 1,25× no TTL de 5 minutos, que é o usado aqui).
--
-- Os modelos Google entram com multiplicador 1,0 e `confirmado = false` DE
-- PROPÓSITO: o desconto de cache do Gemini não foi conferido, e assumir
-- desconto que talvez não exista inflaria a margem no relatório. Cadastre o
-- valor real em Sistema → Faturamento e a linha passa a contar.
insert into public.ai_model_prices
  (provider, model, input_usd_mtok, output_usd_mtok, cache_read_mult, cache_write_mult, confirmado, fonte)
values
  ('anthropic', 'claude-haiku-4-5',  1.00,  5.00, 0.10, 1.25, true,  'Tabela Anthropic; cache 5 min'),
  ('anthropic', 'claude-sonnet-5',   3.00, 15.00, 0.10, 1.25, true,  'Tabela Anthropic; cache 5 min'),
  ('anthropic', 'claude-opus-5',     5.00, 25.00, 0.10, 1.25, true,  'Tabela Anthropic; cache 5 min'),
  ('anthropic', 'claude-opus-4-8',   5.00, 25.00, 0.10, 1.25, true,  'Tabela Anthropic; cache 5 min'),
  ('anthropic', 'claude-fable-5',   10.00, 50.00, 0.10, 1.25, true,  'Tabela Anthropic; cache 5 min'),
  ('google',    'gemini-3.5-flash',      null, null, 1.00, 1.00, false, 'Preencher com a tabela do Google'),
  ('google',    'gemini-3.5-flash-lite', null, null, 1.00, 1.00, false, 'Preencher com a tabela do Google'),
  ('google',    'gemini-embedding-001',  null, null, 1.00, 1.00, false, 'Preencher com a tabela do Google')
on conflict (provider, model, vigente_desde) do nothing;

-- ── Tarifa cobrada do CLIENTE ───────────────────────────────────────────
-- Diferente do preço acima, que é o CUSTO. Aqui mora o que se cobra: tarifa
-- plana por milhão de tokens, e sobre QUAL contagem ela incide.
--
-- `base_cobranca` é decisão comercial, não técnica, e as duas leituras são
-- defensáveis — por isso é configuração e não constante no código:
--   · 'bruto'     = soma crua de entrada + saída. O cliente paga pelo token que
--                   trafegou, inclusive o que veio do cache barato.
--   · 'ponderado' = cache lido/escrito convertido pelo multiplicador do
--                   provedor. O cliente paga pelo que o token custou.
-- Nesta janela medida a diferença foi de 972.448 para 425.887 tokens — 56%.
create table if not exists public.billing_settings (
  id boolean primary key default true check (id),
  usd_por_mtok numeric(12, 4) not null default 5.00,
  base_cobranca text not null default 'bruto' check (base_cobranca in ('bruto', 'ponderado')),
  cobrar_overhead_interno boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on column public.billing_settings.cobrar_overhead_interno is
  'Se o consumo disparado pelo sistema DENTRO de um turno cobrável (reescrita de consulta, classificador, embeddings) entra na fatura. Medido em ~1,5% do total. Quando false, o relatório mostra o valor mas não o soma.';

insert into public.billing_settings (id) values (true) on conflict (id) do nothing;

alter table public.billing_settings enable row level security;
create policy billing_settings_read on public.billing_settings
  for select to authenticated using (
    public.has_permission(auth.uid(), 'ai.configure', null)
  );
create policy billing_settings_write on public.billing_settings
  for all to authenticated using (
    public.has_permission(auth.uid(), 'ai.configure', null)
  ) with check (
    public.has_permission(auth.uid(), 'ai.configure', null)
  );
revoke all on public.billing_settings from anon;
