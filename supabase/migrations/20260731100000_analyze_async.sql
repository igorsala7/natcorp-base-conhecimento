-- Análise em lote ASSÍNCRONA: o endpoint enfileira e o worker processa (tira o
-- trabalho pesado — map-reduce/OCR — da camada web). Guarda a config do job para
-- o worker (persona, llm, identidade, arquivos…) e adiciona o status 'na_fila'.

alter table analysis_jobs add column if not exists params jsonb;

alter table analysis_jobs drop constraint if exists analysis_jobs_status_check;
alter table analysis_jobs
  add constraint analysis_jobs_status_check
  check (status in ('coletando', 'na_fila', 'analisando', 'concluido', 'erro'));
