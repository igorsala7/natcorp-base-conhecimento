-- =====================================================================
-- CRÉDITOS DO CLIENTE — contratação, compra avulsa, distribuição e câmbio
--
-- ── A unidade ───────────────────────────────────────────────────────────
-- 1 CRÉDITO = 1.000.000 de tokens BRUTOS (entrada + saída, como o provedor
-- reporta). Decisão do dono em 08/09/2026, coerente com
-- `billing_settings.base_cobranca = 'bruto'`, que já existe e continua sendo a
-- fonte da verdade sobre QUAL contagem vale.
--
-- Por que bruto e não ponderado: medido sobre 120 dias da origem `widget`, o
-- bruto deu 140,2M tokens contra 115,7M ponderados — 17,5% a mais de créditos
-- faturáveis. O custo real medido foi US$ 1,1893 por milhão bruto, contra os
-- US$ 3,50 cobrados: margem de 2,94×. O risco assumido é conhecido e está
-- declarado aqui: se a taxa de leitura de cache cair (hoje 23% em 120 dias, 43%
-- em 30 dias), o custo por milhão bruto SOBE e a margem encolhe sem que o
-- cliente perceba diferença. Quem for reabrir isso, meça antes.
--
-- ── Por que `base_code` e não `base_id` ─────────────────────────────────
-- O consumo mora em `ai_usage.p_base`, que é TEXTO vindo do token do APEX. Usar
-- o mesmo tipo evita um join a mais em toda consulta de saldo — que roda no
-- caminho quente do portão de bloqueio. A integridade fica garantida pela FK
-- contra `ai_bases.base_code` (unique), com `on update cascade`.
--
-- ── Normalização, e por que ela é obrigatória aqui ──────────────────────
-- Medido: `ai_usage` tem `NATCORP` e `natcorp` como clientes distintos (76,6M e
-- 50,4M de tokens), e o mesmo em `STEFANINI`/`stefanini` e `INCOR`/`incor`.
-- Um cliente com o saldo partido em dois seria bloqueado com crédito sobrando,
-- ou passaria do teto sem bloquear. O CHECK abaixo impede que a doença entre
-- nas tabelas novas; a migration de índices trata a leitura do histórico.
-- =====================================================================

-- ── Contrato mensal ─────────────────────────────────────────────────────
create table if not exists public.ai_creditos_contrato (
  id uuid primary key default gen_random_uuid(),
  base_code text not null
    references public.ai_bases (base_code) on update cascade on delete cascade,
  mes_ref date not null,                         -- sempre o dia 1º do mês
  creditos numeric(14, 4) not null check (creditos >= 0),
  usd_por_credito numeric(10, 4) not null default 3.50 check (usd_por_credito >= 0),
  criado_por uuid references auth.users (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint ai_creditos_contrato_base_norm check (base_code = lower(btrim(base_code))),
  constraint ai_creditos_contrato_mes_dia1 check (mes_ref = date_trunc('month', mes_ref)::date),
  unique (base_code, mes_ref)
);

comment on table public.ai_creditos_contrato is
  'Créditos contratados por base e mês. 1 crédito = 1.000.000 de tokens brutos. `usd_por_credito` fica na LINHA, não numa constante: um reajuste futuro não pode reescrever o preço de uma fatura já emitida.';

-- ── Compras avulsas (cobradas na fatura seguinte) ───────────────────────
create table if not exists public.ai_creditos_extra (
  id uuid primary key default gen_random_uuid(),
  base_code text not null
    references public.ai_bases (base_code) on update cascade on delete cascade,
  mes_ref date not null,                         -- mês em que os créditos VALEM
  creditos numeric(14, 4) not null check (creditos > 0),
  usd_por_credito numeric(10, 4) not null default 3.50 check (usd_por_credito >= 0),
  -- Quem pediu, do lado do CLIENTE (login do token do APEX). Não é um usuário
  -- do nosso Supabase: a compra acontece dentro do iFrame, autenticada pelo
  -- token de rastreio. Guardar o login é o que torna a cobrança defensável.
  solicitado_por text,
  motivo text,
  criado_em timestamptz not null default now(),
  constraint ai_creditos_extra_base_norm check (base_code = lower(btrim(base_code))),
  constraint ai_creditos_extra_mes_dia1 check (mes_ref = date_trunc('month', mes_ref)::date)
);

comment on table public.ai_creditos_extra is
  'Créditos adicionais comprados no meio do mês, quando o contratado acabou. Entram no saldo IMEDIATAMENTE e são cobrados na PRÓXIMA fatura — é o que o disclaimer da tela promete, e o que `gestao_saldo` soma.';

create index if not exists ai_creditos_extra_base_mes_idx
  on public.ai_creditos_extra (base_code, mes_ref);

-- ── Distribuição do saldo ───────────────────────────────────────────────
-- Um orçamento por recorte. O caso real da demanda:
--   perfil FOLHA  → 300 no PO
--   perfil MEDICO → 100 no PO
--   usuário FGOMES → 75 no PO, 50 no PG, 25 no PC
--   painel PC → 200 (vale para quem não tem recorte mais específico)
create table if not exists public.ai_creditos_alocacao (
  id uuid primary key default gen_random_uuid(),
  base_code text not null
    references public.ai_bases (base_code) on update cascade on delete cascade,
  -- NULL = vale em qualquer painel. Não confundir com 'nenhum': aqui a ausência
  -- é abrangência, porque alocação é orçamento, não permissão.
  painel text check (painel in ('PO', 'PG', 'PC')),
  alvo_tipo text not null check (alvo_tipo in ('perfil', 'usuario', 'painel')),
  -- NULL só quando alvo_tipo = 'painel' (o recorte já é o próprio painel).
  alvo text,
  creditos numeric(14, 4) not null check (creditos >= 0),
  ativo boolean not null default true,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint ai_creditos_alocacao_base_norm check (base_code = lower(btrim(base_code))),
  constraint ai_creditos_alocacao_alvo_coerente check (
    (alvo_tipo = 'painel' and alvo is null and painel is not null)
    or (alvo_tipo in ('perfil', 'usuario') and alvo is not null and btrim(alvo) <> '')
  )
);

comment on table public.ai_creditos_alocacao is
  'Orçamento de créditos por recorte (painel × perfil|usuário). NÃO é permissão de acesso — isso vive em ai_acesso_regras. Um recorte sem alocação não fica sem créditos: cai no saldo geral da base.';

-- Índice único por recorte, tratando NULL de painel/alvo como valor concreto —
-- sem isto dá para cadastrar duas alocações para o mesmo recorte e o saldo
-- passa a depender de qual linha a consulta leu primeiro.
create unique index if not exists ai_creditos_alocacao_recorte_idx
  on public.ai_creditos_alocacao (base_code, coalesce(painel, '*'), alvo_tipo, coalesce(alvo, '*'));

create index if not exists ai_creditos_alocacao_base_idx
  on public.ai_creditos_alocacao (base_code) where ativo;

-- ── Câmbio ──────────────────────────────────────────────────────────────
create table if not exists public.ai_cotacao_cambio (
  dia date primary key,
  usd_brl numeric(10, 4) not null check (usd_brl > 0),
  fonte text not null,
  obtido_em timestamptz not null default now()
);

comment on table public.ai_cotacao_cambio is
  'Cotação USD→BRL do dia, uma linha por dia. Existe para que a tela não dependa da API externa a cada carregamento E para que a fatura CONGELE o câmbio do dia do fechamento: refazer a conversão meses depois com a cotação de hoje mudaria o valor de uma fatura já emitida.';

-- ── Fatura ──────────────────────────────────────────────────────────────
create table if not exists public.ai_faturas (
  id uuid primary key default gen_random_uuid(),
  base_code text not null
    references public.ai_bases (base_code) on update cascade on delete cascade,
  mes_ref date not null,
  fechada_em timestamptz not null default now(),
  creditos_contratados numeric(14, 4) not null default 0,
  creditos_extra numeric(14, 4) not null default 0,
  creditos_consumidos numeric(14, 4) not null default 0,
  usd_total numeric(14, 2) not null default 0,
  -- Congelados no fechamento. Reconverter depois daria outro número.
  usd_brl numeric(10, 4),
  brl_total numeric(14, 2),
  status text not null default 'aberta' check (status in ('aberta', 'fechada', 'paga', 'cancelada')),
  observacao text,
  constraint ai_faturas_base_norm check (base_code = lower(btrim(base_code))),
  constraint ai_faturas_mes_dia1 check (mes_ref = date_trunc('month', mes_ref)::date),
  unique (base_code, mes_ref)
);

-- ── RLS ─────────────────────────────────────────────────────────────────
-- A área /gestao lê por service-role, com a base já resolvida do token — o
-- isolamento entre clientes acontece LÁ, na validação da assinatura. Aqui, a
-- policy serve ao admin interno.
alter table public.ai_creditos_contrato  enable row level security;
alter table public.ai_creditos_extra     enable row level security;
alter table public.ai_creditos_alocacao  enable row level security;
alter table public.ai_cotacao_cambio     enable row level security;
alter table public.ai_faturas            enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'ai_creditos_contrato', 'ai_creditos_extra', 'ai_creditos_alocacao',
    'ai_cotacao_cambio', 'ai_faturas'
  ] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format($f$
      create policy %I_read on public.%I for select to authenticated
        using (public.has_permission(auth.uid(), 'ai.configure', null))
    $f$, t, t);

    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format($f$
      create policy %I_write on public.%I for all to authenticated
        using (public.has_permission(auth.uid(), 'ai.configure', null))
        with check (public.has_permission(auth.uid(), 'ai.configure', null))
    $f$, t, t);

    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
