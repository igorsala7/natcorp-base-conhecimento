-- =====================================================================
-- OS FATOS DE CADA CICLO — a conta dos dois baldes fica fora do banco
--
-- Regra nova do dono: contratado renova e não acumula; adicional acumula
-- e nunca vence; o consumo sai SEMPRE do contratado primeiro.
--
-- ── Por que isto não é uma função que devolve o saldo ────────────────
-- O saldo do extra é um fold: o de hoje depende do de ontem, com um teto
-- em cada passo. Em SQL isso vira `with recursive` de quarenta linhas que
-- ninguém relê e que só se testa contra o banco de produção.
--
-- O projeto já resolve isso em outro lugar do mesmo jeito: `pricing.ts` é
-- puro, isomórfico e testado com números reais tirados de produção. Aqui
-- a divisão é a mesma — o banco entrega FATO por ciclo (quanto foi
-- contratado, quanto consumiu, quanto comprou), e a REGRA mora em
-- `src/lib/gestao/creditos.ts`, onde tem teste com o exemplo que o dono
-- ditou.
--
-- ── O que é fato, e por que cada um ─────────────────────────────────
-- `contratado` sai do plano VIGENTE naquele ciclo, não do plano de hoje:
-- `ai_cliente_plano` é versionada por `vigente_desde`, e usar o valor
-- corrente reescreveria o passado a cada renegociação de contrato.
--
-- `consumo` conta só `origem = 'widget'`: é o que o cliente usa. Chamada
-- interna do sistema (Estúdio, importador) não sai do crédito dele.
-- =====================================================================

drop function if exists public.gestao_ciclos(text, timestamptz);

create function public.gestao_ciclos(
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
  v_dia  int;
  v_tpc  bigint;
  v_ini  timestamptz;
  v_fim  timestamptz;
  v_corrente timestamptz;
  v_primeiro timestamptz;
begin
  select coalesce(min(pl.dia_inicio_ciclo), 1),
         coalesce(min(pl.tokens_por_credito), 10000)
    into v_dia, v_tpc
    from public.ai_cliente_plano pl
   where pl.base_code = v_base;

  if v_dia is null then v_dia := 1; end if;
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
  'Fatos por ciclo (contratado vigente, consumo, compras). A regra dos dois baldes vive em src/lib/gestao/creditos.ts, testada.';

revoke all on function public.gestao_ciclos(text, timestamptz) from public, anon, authenticated;
grant execute on function public.gestao_ciclos(text, timestamptz) to service_role;

-- =====================================================================
-- `gestao_saldo` SAI DE CENA
--
-- Ela somava `contratado + extra − consumo` num balde só, e filtrava o
-- extra pelo ciclo corrente (`e.ciclo_inicio = ciclo`). As duas coisas
-- contradizem a regra nova: não há ordem de consumo num balde só, e o
-- filtro por ciclo é exatamente o que fazia a compra morrer na virada.
--
-- Quem responde agora é `lerSaldo` em `src/lib/gestao/dados.ts`, que
-- chama `gestao_ciclos` e aplica `calcularSaldo` — a regra com teste.
-- Nenhuma outra função do banco a chamava; o único consumidor era o TS.
-- =====================================================================
drop function if exists public.gestao_saldo(text, timestamptz);
