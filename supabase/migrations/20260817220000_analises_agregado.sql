-- A TELA DE ANÁLISE ERA A QUE MENOS PODIA MENTIR — e agregava em JavaScript.
--
-- Mesmo defeito do Painel (ver 20260817150000_painel_agregado.sql), sobrevivente
-- porque eu corrigi a OCORRÊNCIA e não a CLASSE: `article_views` era lida crua,
-- sem limite, e somada em `reduce`/`Map` no servidor Node.
--
-- Diagnóstico medido antes de escrever isto:
--
--   article_views (90 dias)   SEM limite    467 linhas   ← teto silencioso de 1.000
--   quality_reports           SEM limite      0 linhas   ← idem
--   nodes publicados          limit 2000   1.392 linhas  ← 70% da cota
--   messages (assistant)      limit 2000   1.488 linhas  ← 74% da cota
--
-- Nada quebrado hoje. Mas os dois primeiros param de crescer em SILÊNCIO — sem
-- erro, sem aviso —, e é numa tela cujo trabalho inteiro é ser exata.
--
-- ── Por que agregar aqui muda a ordem de grandeza ───────────────────────────
-- O gráfico precisa de (dia, documentação, views). A tela trazia (nó, dia,
-- views) — uma linha por ARTIGO por DIA — e cruzava com a lista de nós em JS
-- para descobrir a documentação. Com 1.392 artigos publicados e 90 dias, o teto
-- teórico é ~125 mil linhas para desenhar um gráfico de 90 pontos por
-- documentação. Agregado no banco, são no máximo `dias × documentações`.
--
-- INVOKER (sem `security definer`): a RLS de `article_views` e `nodes` amarra a
-- leitura a `has_permission('content.view')` no espaço do nó. Rodando como
-- invocador, esse filtro continua valendo de graça — e uma segunda cópia da
-- regra de permissão é como se abre vazamento entre espaços de clientes.

-- Totais + os mais vistos, já com título e documentação.
create or replace function public.analises_leitura(
  p_dias int default 90,
  p_top int default 8
)
returns table (
  total_views bigint,
  node_id uuid,
  title text,
  space_id uuid,
  views bigint
)
language sql
stable
set search_path = public
as $$
  with janela as (
    select av.node_id, sum(av.views)::bigint as views
    from public.article_views av
    where av.day >= (current_date - greatest(coalesce(p_dias, 90), 1))
    group by av.node_id
  ),
  soma as (select coalesce(sum(views), 0)::bigint as total from janela)
  select
    (select total from soma),
    n.id,
    n.title,
    n.space_id,
    j.views
  from janela j
  join public.nodes n on n.id = j.node_id
  where n.deleted_at is null
  order by j.views desc
  limit least(greatest(coalesce(p_top, 8), 1), 50);
$$;

-- A série do gráfico, agregada por (dia, documentação).
create or replace function public.analises_serie(p_dias int default 90)
returns table (day date, space_id uuid, views bigint)
language sql
stable
set search_path = public
as $$
  select av.day, n.space_id, sum(av.views)::bigint
  from public.article_views av
  join public.nodes n on n.id = av.node_id
  where av.day >= (current_date - greatest(coalesce(p_dias, 90), 1))
    and n.deleted_at is null
  group by av.day, n.space_id
  order by av.day;
$$;

-- Publicados que NINGUÉM abriu na janela.
--
-- Devolve a contagem junto com a amostra: "8 artigos" e "8 de 340" são
-- diagnósticos diferentes, e a tela só pode dizer o segundo se o banco contar.
create or replace function public.analises_sem_visita(
  p_dias int default 90,
  p_top int default 8
)
returns table (
  total_publicados bigint,
  total_sem_visita bigint,
  node_id uuid,
  title text,
  space_id uuid
)
language sql
stable
set search_path = public
as $$
  with publicados as (
    select n.id, n.title, n.space_id
    from public.nodes n
    where n.type = 'article' and n.status = 'published' and n.deleted_at is null
  ),
  vistos as (
    select distinct av.node_id
    from public.article_views av
    where av.day >= (current_date - greatest(coalesce(p_dias, 90), 1))
  ),
  sem as (
    select p.* from publicados p
    where not exists (select 1 from vistos v where v.node_id = p.id)
  ),
  totais as (
    select (select count(*) from publicados)::bigint as pub,
           (select count(*) from sem)::bigint as semv
  )
  select t.pub, t.semv, s.id, s.title, s.space_id
  from totais t
  left join lateral (
    select * from sem order by title limit least(greatest(coalesce(p_top, 8), 1), 50)
  ) s on true;
$$;

grant execute on function public.analises_leitura(int, int) to authenticated;
grant execute on function public.analises_serie(int) to authenticated;
grant execute on function public.analises_sem_visita(int, int) to authenticated;
