-- Novo estado do job de importação: 'improving' — depois de materializar a
-- árvore, a IA reformata o layout de TODOS os artigos importados (opção
-- escolhida na confirmação). Vive entre 'importing' e 'done'; o progresso
-- reusa a coluna progress (0..100) na fase nova.
alter table public.import_jobs
  drop constraint if exists import_jobs_status_check;

alter table public.import_jobs
  add constraint import_jobs_status_check
  check (status in (
    'queued', 'extracting', 'inferring', 'preview',
    'importing', 'improving', 'done', 'error'
  ));
