-- =====================================================================
-- Escopo da varredura de ontologia: geral (documentação inteira), subárvore
-- (um diretório pai/filho e TODO o conteúdo abaixo) ou um artigo só. Mesmo
-- modelo do embedding_jobs (scope + target_id).
-- =====================================================================
alter table public.ontology_jobs
  add column scope text not null default 'space'
    check (scope in ('space', 'subtree', 'article')),
  add column target_id uuid;                          -- nó (subtree/article); null p/ space
