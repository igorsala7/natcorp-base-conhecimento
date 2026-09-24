-- =====================================================================
-- O CICLO É O MÊS-CALENDÁRIO, e deixa de ser configurável
--
-- Regra do dono (24/09): "É sempre mês fechado, do dia 1 ao último dia
-- do mês."
--
-- ── O que existia ───────────────────────────────────────────────────
-- `ai_cliente_plano.dia_inicio_ciclo` (1 a 31) deixava cada cliente ter
-- a própria virada: quem contratasse dia 14 teria o "mês" indo de 14/09
-- a 13/10. `gestao_ciclo()` implementa isso, inclusive o encurtamento de
-- fevereiro, e continua correta — ela só passa a ser sempre chamada com
-- 1, que produz exatamente o mês-calendário no fuso de São Paulo.
--
-- ── Por que DROPAR a coluna, e não deixá-la ignorada ────────────────
-- Os dois planos que existem (leadec e natcorp) já estão no dia 1, que é
-- o default, então nenhum dado se perde. O que sobraria é um campo no
-- formulário interno que aceita 1 a 31, grava, e não muda nada. Alguém
-- cadastraria um cliente com virada no dia 20, conferiria o número no
-- fim do mês e encontraria um relatório que ignora a configuração que
-- ele acabou de fazer. Campo que parece configurar e não configura é
-- pior que campo ausente.
--
-- `gestao_ciclo(int, timestamptz)` FICA como está: é helper puro de data,
-- não superfície de configuração, e mudar a assinatura rippla nos tipos
-- gerados sem ganhar nada.
-- =====================================================================

-- ── 1. Os fatos por ciclo passam a varrer mês-calendário ────────────
create or replace function public.gestao_ciclos(
  p_base text,
  p_ate timestamptz default now()
)
returns table (
  ciclo_inicio timestamptz,
  ciclo_fim timestamptz,
  contratado numeric,
  tokens bigint,
  consumo numeric,
  compras numeric,
  tokens_por_credito bigint
)
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_base text := lower(btrim(p_base));
  -- MÊS FECHADO: dia 1, sem exceção. Era `min(pl.dia_inicio_ciclo)`.
  v_dia  constant int := 1;
  v_tpc  bigint;
  v_ini  timestamptz;
  v_fim  timestamptz;
  v_corrente timestamptz;
  v_primeiro timestamptz;
begin
  select coalesce(min(pl.tokens_por_credito), 10000)
    into v_tpc
    from public.ai_cliente_plano pl
   where pl.base_code = v_base;

  if v_tpc is null or v_tpc = 0 then v_tpc := 10000; end if;

  -- Onde começar: a primeira compra ou o primeiro consumo. Varrer desde
  -- sempre custaria um ciclo por mês de vida do produto sem mudar nada.
  select least(
           coalesce((select min(e.criado_em) from public.ai_creditos_extra e where e.base_code = v_base), p_ate),
           coalesce((select min(u.created_at) from public.ai_usage u
                      where lower(btrim(u.p_base)) = v_base and u.origem = 'widget'), p_ate)
         )
    into v_primeiro;

  select c.inicio into v_corrente from public.gestao_ciclo(v_dia, p_ate) c;
  select c.inicio into v_ini      from public.gestao_ciclo(v_dia, v_primeiro) c;

  loop
    select c.inicio, c.fim into v_ini, v_fim from public.gestao_ciclo(v_dia, v_ini) c;

    return query
    select
      v_ini,
      v_fim,
      -- Plano vigente em QUALQUER momento deste ciclo até agora, não só no
      -- primeiro dia. Medido contra o banco: a leadec passou a vigorar em
      -- 08/09, o ciclo dela abre no dia 1º, e ler o plano na abertura fazia
      -- setembro inteiro valer ZERO crédito para um cliente que contratou.
      -- Quem assina no meio do mês recebe o mês.
      coalesce((select pv.creditos_por_ciclo
                  from public.ai_cliente_plano pv
                 where pv.base_code = v_base
                   and pv.vigente_desde <= least(
                         (v_fim at time zone 'America/Sao_Paulo')::date - 1,
                         (p_ate at time zone 'America/Sao_Paulo')::date)
                 order by pv.vigente_desde desc
                 limit 1), 0),
      coalesce((select sum(u.input_tokens + u.output_tokens)
                  from public.ai_usage u
                 where lower(btrim(u.p_base)) = v_base
                   and u.origem = 'widget'
                   and u.created_at >= v_ini and u.created_at < v_fim), 0)::bigint,
      round(coalesce((select sum(u.input_tokens + u.output_tokens)
                        from public.ai_usage u
                       where lower(btrim(u.p_base)) = v_base
                         and u.origem = 'widget'
                         and u.created_at >= v_ini and u.created_at < v_fim), 0)::numeric / v_tpc, 4),
      coalesce((select sum(e.creditos)
                  from public.ai_creditos_extra e
                 where e.base_code = v_base
                   and e.criado_em >= v_ini and e.criado_em < v_fim), 0),
      v_tpc;

    exit when v_ini >= v_corrente;
    -- Avança um ciclo: o instante seguinte ao fim deste cai no próximo.
    v_ini := v_fim;
  end loop;
end $$;

comment on function public.gestao_ciclos(text, timestamptz) is
  'FATO por ciclo (contratado vigente, consumo, compras). O ciclo é o MÊS-CALENDÁRIO no fuso de São Paulo, do dia 1 ao último. A regra dos baldes mora em src/lib/gestao/creditos.ts.';

revoke all on function public.gestao_ciclos(text, timestamptz) from public, anon, authenticated;
grant execute on function public.gestao_ciclos(text, timestamptz) to service_role;

-- ── 2. `gestao_plano` deixa de devolver o dia da virada ─────────────
-- O tipo de retorno muda, então `create or replace` não serve.
drop function if exists public.gestao_plano(text, timestamptz);

create function public.gestao_plano(
  p_base text,
  p_momento timestamptz default now()
)
returns table (
  base_code text,
  creditos_por_ciclo numeric,
  usd_por_credito numeric,
  tokens_por_credito bigint,
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
  c as (
    select * from public.gestao_ciclo(1, p_momento)
  )
  select
    lower(btrim(p_base)),
    coalesce((select creditos_por_ciclo from p), 0),
    coalesce((select usd_por_credito from p), 0.05),
    coalesce((select tokens_por_credito from p), 10000),
    (select count(*) > 0 from p),
    c.inicio,
    c.fim
  from c;
$$;

comment on function public.gestao_plano(text, timestamptz) is
  'Plano vigente da base e o ciclo corrente. O ciclo é sempre o mês-calendário (fuso de São Paulo).';

revoke all on function public.gestao_plano(text, timestamptz) from public, anon, authenticated;
grant execute on function public.gestao_plano(text, timestamptz) to service_role;

-- ── 3. A coluna sai ─────────────────────────────────────────────────
-- Depois das funções, porque as duas a referenciavam.
alter table public.ai_cliente_plano drop column if exists dia_inicio_ciclo;
