-- "Respostas: 2.000" — para sempre.
--
-- A tela Desempenho lia `messages` com `.limit(2000)` e exibia
-- `msgRows.length` no cartão "Respostas". Ou seja: o número não era a
-- quantidade de respostas, era a quantidade de LINHAS QUE COUBERAM. Passados
-- 2.000 assistentes, o cartão travaria em 2.000 e nunca mais se moveria —
-- estável, plausível e errado. Hoje são 1.488, então ele ainda acerta por
-- acidente.
--
-- O mesmo valia para "Buscas" (`.limit(3000)`), e de forma mais sutil para os
-- rankings "mais buscados" e "sem resultado": tirados de uma amostra ORDENADA
-- POR DATA, eles não eram o topo do período, e sim o topo do que é recente.
-- Um termo muito buscado há dois meses simplesmente sumia do ranking.
--
-- Limite explícito não é proteção quando o número é apresentado como total. É
-- só um teto silencioso escrito à mão — o mesmo defeito do teto do PostgREST,
-- com a diferença de que este alguém digitou.
--
-- INVOKER: a RLS de `messages` e `search_logs` continua valendo.

create or replace function public.analises_chat(p_dias int default 90)
returns table (
  respostas bigint,
  uteis bigint,
  nao_uteis bigint,
  recusas bigint,
  latencia_media int
)
language sql
stable
set search_path = public
as $$
  select
    count(*)::bigint,
    count(*) filter (where m.feedback = 1)::bigint,
    count(*) filter (where m.feedback = -1)::bigint,
    -- "Não encontrei…" é a recusa por contexto fraco: a IA dizendo que não
    -- sabe em vez de inventar. Subir é BOM se a base está incompleta.
    count(*) filter (where m.content like 'Não encontrei%')::bigint,
    coalesce(round(avg(m.latency_ms))::int, 0)
  from public.messages m
  where m.role = 'assistant'
    and m.created_at >= now() - make_interval(days => greatest(coalesce(p_dias, 90), 1));
$$;

-- Totais + os dois rankings, sobre a JANELA INTEIRA e não sobre as últimas N.
create or replace function public.analises_busca(
  p_dias int default 90,
  p_top int default 8
)
returns table (
  total bigint,
  sem_resultado bigint,
  termo text,
  vezes bigint,
  achou boolean
)
language sql
stable
set search_path = public
as $$
  with janela as (
    select s.query, s.results_count
    from public.search_logs s
    where s.origin = 'portal'
      and s.created_at >= now() - make_interval(days => greatest(coalesce(p_dias, 90), 1))
  ),
  totais as (
    select count(*)::bigint as t, count(*) filter (where results_count = 0)::bigint as z from janela
  ),
  ranking as (
    (select query, count(*)::bigint as n, true as ok from janela group by query order by count(*) desc
     limit least(greatest(coalesce(p_top, 8), 1), 50))
    union all
    (select query, count(*)::bigint, false from janela where results_count = 0 group by query
     order by count(*) desc limit least(greatest(coalesce(p_top, 8), 1), 50))
  )
  select t.t, t.z, r.query, r.n, r.ok
  from totais t
  left join ranking r on true;
$$;

grant execute on function public.analises_chat(int) to authenticated;
grant execute on function public.analises_busca(int, int) to authenticated;
