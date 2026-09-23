-- =====================================================================
-- O CRÉDITO ADICIONAL PASSA A ATRAVESSAR A VIRADA DO CICLO
--
-- Regra nova do dono: o contratado renova todo mês e NÃO acumula; o
-- adicional comprado acumula e NUNCA vence.
--
-- ── O que estava errado ─────────────────────────────────────────────
-- `ai_creditos_extra.ciclo_inicio` significava "a qual ciclo esta compra
-- pertence", e o `gestao_saldo` filtrava por ele:
--
--     where e.ciclo_inicio = (ciclo corrente)::date
--
-- Ou seja: crédito comprado morria na virada junto com o contratado.
-- Exatamente o oposto da regra. A coluna passa a guardar QUANDO a compra
-- aconteceu, e ninguém mais filtra por ciclo.
--
-- Zero linhas na tabela no momento da escrita, então o rename não perde
-- dado nem reinterpreta compra nenhuma. Se houvesse histórico, converter
-- seria decisão comercial (crédito vendido como "morre no mês" não vira
-- acumulável por migration), e não de engenharia.
--
-- ── Preço ───────────────────────────────────────────────────────────
-- US$3,50 por 100 créditos = US$0,035 cada. Mais barato que o contratado
-- (US$0,05) de propósito: é compra avulsa, fora do compromisso mensal.
-- =====================================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'ai_creditos_extra'
       and column_name  = 'ciclo_inicio'
  ) then
    alter table public.ai_creditos_extra rename column ciclo_inicio to comprado_em;
  end if;
end $$;

alter table public.ai_creditos_extra
  alter column usd_por_credito set default 0.035;

comment on column public.ai_creditos_extra.comprado_em is
  'Data da COMPRA. Não amarra a ciclo: crédito adicional acumula e nunca vence. Antes se chamava ciclo_inicio e o saldo filtrava por ele, o que fazia a compra morrer na virada.';
comment on column public.ai_creditos_extra.creditos is
  'Créditos comprados avulso, na unidade de 10.000 tokens. 100 créditos = 1 milhão.';
comment on column public.ai_creditos_extra.usd_por_credito is
  'Preço pago por crédito nesta compra. Padrão 0,035 (US$3,50 por 100).';

-- `gestao_compras` embutia a mesma premissa em outro lugar: por padrão listava
-- só o CICLO CORRENTE (`coalesce(p_de, pl.ciclo_inicio)`). Com o adicional
-- acumulando, a compra de três meses atrás continua sustentando o saldo de hoje
-- e precisa aparecer no histórico — senão a tela mostra um saldo que o extrato
-- não explica.
--
-- `drop` antes do `create`: o retorno muda (`ciclo_inicio` → `comprado_em`) e o
-- Postgres não permite `create or replace` alterando tipo de retorno.
drop function if exists public.gestao_compras(text, timestamptz, timestamptz);

create function public.gestao_compras(
  p_base text,
  p_de timestamptz default null,
  p_ate timestamptz default null
)
returns table (
  id uuid,
  criado_em timestamptz,
  comprado_em date,
  creditos numeric,
  usd_por_credito numeric,
  usd_total numeric,
  solicitado_por text,
  motivo text
)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  select
    e.id,
    e.criado_em,
    e.comprado_em,
    e.creditos,
    e.usd_por_credito,
    round(e.creditos * e.usd_por_credito, 2),
    e.solicitado_por,
    e.motivo
  from public.ai_creditos_extra e
  where e.base_code = lower(btrim(p_base))
    -- Sem janela informada, devolve TUDO. O padrão anterior era o ciclo
    -- corrente, e com crédito acumulável isso esconderia o que sustenta o saldo.
    and (p_de  is null or e.criado_em >= p_de)
    and (p_ate is null or e.criado_em <  p_ate)
  order by e.criado_em desc;
$$;

revoke all on function public.gestao_compras(text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.gestao_compras(text, timestamptz, timestamptz) to service_role;
