-- =====================================================================
-- Proveniência dos embeddings: quem/quando/qual provedor+modelo gerou cada
-- vetor. Sem isso não dá para saber se um vetor está velho (modelo trocado)
-- nem montar o relatório de gestão. Colunas nullable: vetores antigos ficam
-- sem proveniência até serem regerados.
-- =====================================================================
alter table public.chunks
  add column embedding_provider text,
  add column embedding_model text,
  add column embedded_at timestamptz,
  add column embedded_by uuid references auth.users (id) on delete set null;

-- =====================================================================
-- Relatório unificado de embeddings (artigos + arquivos), agrupado por origem
-- (um nó da árvore OU um documento da base). STABLE e SEM security definer:
-- roda com o privilégio de quem chama, então a RLS de chunks/nodes/
-- knowledge_documents/spaces já limita ao que o usuário pode ver.
-- =====================================================================
create or replace function public.embeddings_report(p_space_id uuid default null)
returns table (
  origin_kind text,
  origin_id uuid,
  title text,
  space_id uuid,
  space_name text,
  chunk_count bigint,
  embedded_count bigint,
  provider text,
  model text,
  embedded_at timestamptz,
  embedded_by uuid,
  status text
)
  language sql
  stable
  set search_path = public, extensions
as $$
  select
    case when c.node_id is not null then 'article' else 'file' end as origin_kind,
    coalesce(c.node_id, c.document_id) as origin_id,
    coalesce(n.title, d.original_name) as title,
    c.space_id,
    s.name as space_name,
    count(*)::bigint as chunk_count,
    count(c.embedding)::bigint as embedded_count,
    max(c.embedding_provider) as provider,
    max(c.embedding_model) as model,
    max(c.embedded_at) as embedded_at,
    (array_agg(c.embedded_by order by c.embedded_at desc nulls last))[1] as embedded_by,
    max(d.status) as status
  from public.chunks c
  join public.spaces s on s.id = c.space_id
  left join public.nodes n on n.id = c.node_id
  left join public.knowledge_documents d on d.id = c.document_id
  where (p_space_id is null or c.space_id = p_space_id)
    and (c.node_id is null or n.deleted_at is null)
  group by c.node_id, c.document_id, coalesce(n.title, d.original_name), c.space_id, s.name;
$$;

-- O portal/anon nunca lista a gestão de embeddings.
revoke execute on function public.embeddings_report(uuid) from anon;
