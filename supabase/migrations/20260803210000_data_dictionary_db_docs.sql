-- Fase D: documentação técnica de objetos de banco.
-- O job de documentação de banco usa kind = 'db_docs' (espelha 'apex_docs').
-- Adiciona esse valor ao check de data_dictionary_jobs.kind sem tocar na
-- migration já aplicada (redefine a constraint de forma idempotente).

alter table public.data_dictionary_jobs
  drop constraint if exists data_dictionary_jobs_kind_check;

alter table public.data_dictionary_jobs
  add constraint data_dictionary_jobs_kind_check
  check (kind in ('apex_ingest', 'db_objects', 'apex_docs', 'apex_translate', 'db_docs'));
