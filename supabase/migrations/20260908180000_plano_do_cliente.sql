-- =====================================================================
-- PLANO DO CLIENTE — créditos contratados, preço, lastro e ciclo
--
-- Três coisas passam a ser negociáveis por cliente, e nenhuma delas podia ficar
-- fixa no código:
--
--   · quantos créditos ele tem por ciclo
--   · quanto custa o crédito (US$ 3,50 é o padrão, não a regra)
--   · QUANTOS TOKENS valem um crédito (1 milhão é o padrão; pode ser 1,2 mi,
--     2 mi, 3,1 mi — o lastro é decisão comercial, não técnica)
--   · em que DIA o ciclo vira (14/09→13/10 é tão válido quanto 01/09→30/09)
--
-- ── Por que uma tabela nova e não colunas em `ai_creditos_contrato` ────
-- Aquela tabela era por (base, mês), e o mês deixou de existir como unidade: o
-- ciclo do cliente pode atravessar dois meses. Ela está vazia — nenhum contrato
-- chegou a ser cadastrado — então some aqui em vez de virar coluna morta que
-- alguém preencheria por engano daqui a seis meses.
--
-- ── Vigência, e não UPDATE no lugar ────────────────────────────────────
-- Mesma escolha de `ai_model_prices`: uma linha por (base, vigente_desde). Um
-- reajuste em novembro não pode mudar o valor de uma fatura de setembro que já
-- foi enviada. A consulta pega a linha vigente NA DATA, não a mais recente.
-- =====================================================================

drop table if exists public.ai_creditos_contrato;

create table if not exists public.ai_cliente_plano (
  id uuid primary key default gen_random_uuid(),
  base_code text not null
    references public.ai_bases (base_code) on update cascade on delete cascade,

  creditos_por_ciclo numeric(14, 4) not null default 0 check (creditos_por_ciclo >= 0),
  usd_por_credito numeric(10, 4) not null default 3.50 check (usd_por_credito >= 0),

  -- O LASTRO. Quantos tokens brutos (entrada + saída) valem 1 crédito.
  -- Nunca aparece na tela do cliente: ele compra crédito, não token.
  tokens_por_credito bigint not null default 1000000 check (tokens_por_credito > 0),

  -- Dia em que o ciclo começa. 14 = de 14/09 a 13/10. Aceita 29..31 e o cálculo
  -- encurta para o último dia do mês quando ele não existe (fevereiro).
  dia_inicio_ciclo int not null default 1 check (dia_inicio_ciclo between 1 and 31),

  vigente_desde date not null default current_date,
  observacao text,
  criado_por uuid references auth.users (id),
  criado_em timestamptz not null default now(),

  constraint ai_cliente_plano_base_norm check (base_code = lower(btrim(base_code))),
  unique (base_code, vigente_desde)
);

comment on table public.ai_cliente_plano is
  'Plano contratado por cliente, com vigência: créditos por ciclo, preço do crédito, quantos tokens lastreiam um crédito e o dia em que o ciclo vira. Só a equipe interna edita — a tela do cliente (iFrame) lê e nunca escreve.';
comment on column public.ai_cliente_plano.tokens_por_credito is
  'Lastro do crédito, em tokens brutos. Padrão 1.000.000. É segredo comercial: NÃO exibir na área do cliente, que fala apenas em créditos.';
comment on column public.ai_cliente_plano.dia_inicio_ciclo is
  'Dia do mês em que o ciclo de faturamento começa. Dias 29-31 são encurtados para o último dia nos meses que não os têm.';

create index if not exists ai_cliente_plano_base_idx
  on public.ai_cliente_plano (base_code, vigente_desde desc);

alter table public.ai_cliente_plano enable row level security;

drop policy if exists ai_cliente_plano_read on public.ai_cliente_plano;
create policy ai_cliente_plano_read on public.ai_cliente_plano
  for select to authenticated using (
    public.has_permission(auth.uid(), 'gestao.suporte', null)
  );

drop policy if exists ai_cliente_plano_write on public.ai_cliente_plano;
create policy ai_cliente_plano_write on public.ai_cliente_plano
  for all to authenticated using (
    public.has_permission(auth.uid(), 'gestao.suporte', null)
  ) with check (
    public.has_permission(auth.uid(), 'gestao.suporte', null)
  );

revoke all on public.ai_cliente_plano from anon;

-- ── O ciclo vigente ─────────────────────────────────────────────────────
-- Vira sozinho: é calculado a partir do dia e do momento, sem job e sem coluna
-- de "ciclo atual" para alguém esquecer de atualizar. No dia 13/10 às 23h59 o
-- ciclo ainda é o que começou em 14/09; às 00h00 do dia 14 já é o próximo.
--
-- O fuso é o de São Paulo porque o contrato é do cliente. Em UTC, as conversas
-- da noite do dia 13 cairiam no ciclo seguinte.
create or replace function public.gestao_ciclo(
  p_dia int,
  p_momento timestamptz default now()
)
returns table (inicio timestamptz, fim timestamptz)
  language plpgsql
  immutable
  set search_path = public
as $$
declare
  v_local date := (p_momento at time zone 'America/Sao_Paulo')::date;
  v_dia int := greatest(1, least(coalesce(p_dia, 1), 31));
  v_ini date;
  v_mes date;
begin
  -- Âncora no primeiro dia do mês local, para somar meses sem estourar dia.
  v_mes := date_trunc('month', v_local)::date;

  -- Dia efetivo NESTE mês (fevereiro encurta 30/31 para 28 ou 29).
  v_ini := v_mes + (least(v_dia, extract(day from (v_mes + interval '1 month - 1 day'))::int) - 1);

  -- Ainda não chegou o dia da virada: o ciclo corrente começou no mês passado.
  if v_local < v_ini then
    v_mes := (v_mes - interval '1 month')::date;
    v_ini := v_mes + (least(v_dia, extract(day from (v_mes + interval '1 month - 1 day'))::int) - 1);
  end if;

  -- `date::timestamptz` interpretaria a data no fuso do SERVIDOR (UTC aqui), e
  -- 14/09 00:00 UTC é 13/09 21:00 em São Paulo — o ciclo inteiro andava um dia
  -- para trás. `::timestamp at time zone` diz que a meia-noite é a DE SÃO PAULO,
  -- que é onde o contrato do cliente vive.
  return query
  select
    (v_ini::timestamp at time zone 'America/Sao_Paulo'),
    -- Fim exclusivo: o mesmo dia do mês seguinte, encurtado do mesmo jeito.
    (
      (
        (v_mes + interval '1 month')::date
        + (least(
             v_dia,
             extract(day from ((v_mes + interval '2 month')::date - interval '1 day'))::int
           ) - 1)
      )::timestamp at time zone 'America/Sao_Paulo'
    );
end;
$$;

comment on function public.gestao_ciclo(int, timestamptz) is
  'Início (inclusivo) e fim (exclusivo) do ciclo de faturamento vigente, dado o dia da virada. Calculado no fuso de São Paulo; vira sozinho na passagem do dia.';

-- ── `mes_ref` vira `ciclo_inicio` ───────────────────────────────────────
-- As tabelas estão vazias, então a troca é limpa. Guardar o mês seria mentira
-- em qualquer cliente cujo ciclo atravessa a virada: uma compra de 20/09 num
-- ciclo 14/09→13/10 pertence a esse ciclo, não a "setembro".
alter table public.ai_creditos_extra
  drop constraint if exists ai_creditos_extra_mes_dia1;
alter table public.ai_faturas
  drop constraint if exists ai_faturas_mes_dia1;

-- `rename column` não tem `if exists`, e sem o guarda a segunda execução desta
-- migration morre em "column mes_ref does not exist". Não há ledger aqui: toda
-- migration precisa sobreviver a ser rodada de novo.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'ai_creditos_extra'
       and column_name = 'mes_ref'
  ) then
    alter table public.ai_creditos_extra rename column mes_ref to ciclo_inicio;
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'ai_faturas'
       and column_name = 'mes_ref'
  ) then
    alter table public.ai_faturas rename column mes_ref to ciclo_inicio;
  end if;
end $$;

comment on column public.ai_creditos_extra.ciclo_inicio is
  'Primeiro dia do CICLO em que os créditos valem (não o mês). Vem de gestao_ciclo.';

alter table public.ai_faturas
  add column if not exists ciclo_fim date;

-- O índice antigo citava a coluna pelo nome velho.
drop index if exists ai_creditos_extra_base_mes_idx;
create index if not exists ai_creditos_extra_base_ciclo_idx
  on public.ai_creditos_extra (base_code, ciclo_inicio);
