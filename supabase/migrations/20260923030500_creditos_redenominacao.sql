-- =====================================================================
-- CRÉDITO PASSA A VALER 10 MIL TOKENS, E NÃO UM MILHÃO
--
-- Regra nova do dono: 100 créditos = 1.000.000 de tokens. Hoje é 1 crédito
-- = 1.000.000, então a unidade se subdivide por 100.
--
-- ── O PREÇO POR TOKEN NÃO MUDA ──────────────────────────────────────
-- Vale dizer com número, porque parece mudança comercial e não é:
--
--   hoje:  US$ 5,00 por crédito × 1 crédito  = 1.000.000 tok → US$5/milhão
--   novo:  US$ 0,05 por crédito × 100 créditos = 1.000.000 tok → US$5/milhão
--
-- É re-denominação, como desdobramento de ação. Nenhum contrato vigente
-- precisa ser renegociado; o que muda é a granularidade com que o cliente
-- enxerga o consumo. O preço NOVO de verdade é o do crédito adicional
-- (US$3,50 por 100 = US$0,035 cada), que vive na outra migration.
--
-- ── Conversão ───────────────────────────────────────────────────────
-- Uma linha em `ai_cliente_plano` no momento da escrita (leadec):
--   500 créditos × 1.000.000 tok  →  50.000 créditos × 10.000 tok
-- Mesmos 500 milhões de tokens, mesmos US$2.500 por ciclo.
--
-- A guarda `where tokens_por_credito = 1000000` é o que faz isto ser
-- re-rodável: linha já convertida não é multiplicada de novo. Não há
-- ledger de migration neste projeto, então toda uma precisa sobreviver a
-- rodar duas vezes.
-- =====================================================================

alter table public.ai_cliente_plano
  alter column tokens_por_credito set default 10000;

alter table public.ai_cliente_plano
  alter column usd_por_credito set default 0.05;

update public.ai_cliente_plano
   set creditos_por_ciclo = creditos_por_ciclo * 100,
       usd_por_credito    = round(usd_por_credito / 100, 4),
       tokens_por_credito = 10000
 where tokens_por_credito = 1000000;

comment on column public.ai_cliente_plano.tokens_por_credito is
  'Tokens que um crédito compra. Padrão 10.000 — ou seja, 100 créditos = 1 milhão de tokens.';
comment on column public.ai_cliente_plano.usd_por_credito is
  'Preço do crédito CONTRATADO. Padrão 0,05 (US$5,00 por 100 créditos). O adicional é mais barato: ver ai_creditos_extra.';
comment on column public.ai_cliente_plano.creditos_por_ciclo is
  'Créditos que renovam a cada ciclo. NÃO acumulam: o que sobra morre na virada. O que acumula é o adicional comprado.';

-- `gestao_plano` carrega os padrões para base SEM contrato cadastrado. Ficaram
-- na unidade velha (1.000.000 tok, US$3,50) e precisam acompanhar, senão uma
-- base sem plano passa a reportar consumo 100× menor que a realidade.
create or replace function public.gestao_plano(
  p_base text,
  p_momento timestamptz default now()
)
returns table (
  base_code text,
  creditos_por_ciclo numeric,
  usd_por_credito numeric,
  tokens_por_credito bigint,
  dia_inicio_ciclo integer,
  tem_plano boolean,
  ciclo_inicio timestamptz,
  ciclo_fim timestamptz
)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  with p as (
    select pl.*
      from public.ai_cliente_plano pl
     where pl.base_code = lower(btrim(p_base))
       and pl.vigente_desde <= (p_momento at time zone 'America/Sao_Paulo')::date
     order by pl.vigente_desde desc
     limit 1
  ),
  d as (
    select coalesce((select dia_inicio_ciclo from p), 1) as dia
  ),
  c as (
    select * from public.gestao_ciclo((select dia from d), p_momento)
  )
  select
    lower(btrim(p_base)),
    coalesce((select creditos_por_ciclo from p), 0),
    coalesce((select usd_por_credito from p), 0.05),
    coalesce((select tokens_por_credito from p), 10000),
    (select dia from d),
    (select count(*) > 0 from p),
    c.inicio,
    c.fim
  from c;
$$;

revoke all on function public.gestao_plano(text, timestamptz) from public, anon, authenticated;
grant execute on function public.gestao_plano(text, timestamptz) to service_role;
