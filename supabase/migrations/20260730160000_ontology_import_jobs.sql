-- Importação de termos por ARQUIVO: a tela de ontologia sobe um arquivo (lista
-- de palavras) e o worker gera os sinônimos por IA, criando termos+aliases em
-- massa. Reusa ontology_jobs para o progresso: novo scope 'import' + o arquivo
-- de origem no Storage (bucket `imports`).
alter table public.ontology_jobs
  drop constraint if exists ontology_jobs_scope_check;
alter table public.ontology_jobs
  add constraint ontology_jobs_scope_check
  check (scope in ('space', 'subtree', 'article', 'import'));

alter table public.ontology_jobs
  add column if not exists source_file text,
  add column if not exists original_name text;
