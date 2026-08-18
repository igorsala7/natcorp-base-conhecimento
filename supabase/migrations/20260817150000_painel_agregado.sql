-- O PAINEL PAROU DE CRESCER NOS 1.000 — e não avisou.
--
-- A home do admin lia as duas tabelas de métrica CRUAS e somava em JavaScript:
--
--   supabase.from("article_views").select("node_id, views")
--   supabase.from("article_feedback").select("node_id, helpful")
--
-- Sem `.limit()`, sem paginação. O teto padrão do PostgREST é 1.000 linhas, e
-- ele não é um erro: é um corte silencioso. Passado o milésimo registro, três
-- números da primeira tela do dia congelariam sem sinal nenhum —
-- "Visualizações" (soma), "Satisfação" (percentual) e o ranking "Artigos com
-- melhor desempenho".
--
-- Este é o MESMO defeito que já apareceu na árvore de conteúdo, onde nós
-- "subiam para a raiz" acima de 1.000. Mesmo teto, mesmo cliente, mesma
-- assinatura silenciosa: nada quebra, o número só deixa de ser verdade.
--
-- ── Por que INVOKER e não SECURITY DEFINER ───────────────────────────────────
-- As duas tabelas têm RLS que amarra a leitura a `has_permission('content.view')`
-- no espaço do nó. Rodando como invocador, esse filtro continua valendo de
-- graça e a agregação enxerga exatamente o que a pessoa já podia ler — que é o
-- comportamento que o código em JavaScript tinha. `security definer` aqui
-- exigiria reimplementar a mesma checagem à mão, e uma segunda cópia de regra
-- de permissão é como se abre um vazamento entre espaços de clientes.

-- Os três totais do topo, numa consulta só.
create or replace function public.painel_resumo()
returns table (
  total_views bigint,
  feedback_total bigint,
  feedback_util bigint
)
language sql
stable
set search_path = public
as $$
  select
    (select coalesce(sum(v.views), 0) from public.article_views v)::bigint,
    (select count(*) from public.article_feedback f)::bigint,
    (select count(*) filter (where f.helpful) from public.article_feedback f)::bigint;
$$;

-- O ranking, já com título, situação e % de "foi útil".
--
-- O corte por views acontece ANTES do join com feedback (CTE `mais_vistos`):
-- ordenar depois de juntar faria o Postgres materializar o cruzamento inteiro
-- para descartar tudo menos seis linhas.
create or replace function public.painel_top_artigos(p_limit int default 6)
returns table (
  node_id uuid,
  title text,
  status text,
  views bigint,
  util_pct int
)
language sql
stable
set search_path = public
as $$
  with mais_vistos as (
    select av.node_id, sum(av.views)::bigint as views
    from public.article_views av
    group by av.node_id
    order by sum(av.views) desc
    limit least(greatest(coalesce(p_limit, 6), 1), 24)
  )
  select
    n.id,
    n.title,
    n.status,
    mv.views,
    -- NULL, não zero: "nenhuma avaliação" e "todo mundo achou inútil" são
    -- coisas diferentes, e a tela esconde a barra quando não há voto.
    case
      when count(f.node_id) > 0
        then round(100.0 * count(*) filter (where f.helpful) / count(f.node_id))::int
      else null
    end
  from mais_vistos mv
  join public.nodes n on n.id = mv.node_id
  left join public.article_feedback f on f.node_id = mv.node_id
  where n.deleted_at is null
  group by n.id, n.title, n.status, mv.views
  order by mv.views desc;
$$;

grant execute on function public.painel_resumo() to authenticated;
grant execute on function public.painel_top_artigos(int) to authenticated;
