-- O TRABALHO EM ANDAMENTO, NUM LUGAR SÓ
--
-- Existem dez tabelas de job — importação, embeddings, ontologia, tradução,
-- backup, lote, captura, dicionário de dados e duas de análise. Cada uma é
-- visível apenas na tela que a disparou: quem sai de "Importar" perde a
-- importação de vista, e a única forma de saber se ela terminou é voltar lá.
--
-- Essa é a queixa "não sei o que está acontecendo", e ela não é falta de
-- feedback: há toast em 42 arquivos, barra de progresso no topo e um overlay
-- bloqueante. O que falta é o trabalho CONTINUAR EXISTINDO fora da tela de
-- origem — nenhum aviso efêmero resolve isso, porque o job dura mais que a
-- visita à página.
--
-- A view normaliza dez formatos num só. Duas decisões de forma:
--
--  · `rotulo` carrega o que identifica AQUELE job para quem o disparou — o nome
--    do arquivo importado, a URL capturada, o idioma traduzido. Sem isso a
--    gaveta lista "Importação · em andamento" três vezes e não ajuda ninguém.
--  · `progresso` é sempre 0-100, mesmo onde a tabela guarda done/total. Quem lê
--    a gaveta não deveria precisar saber a unidade de cada fila.
--
-- Sem `security_invoker`, uma view pertence a quem a criou e ignora a RLS das
-- tabelas de baixo — qualquer usuário veria os jobs de todos os espaços. Com
-- ele, cada linha passa pela RLS de origem, como se a consulta fosse direta.
create or replace view public.atividade_recente
with (security_invoker = true)
as
  select 'importacao'::text as tipo, id, space_id, status,
         coalesce(progress, 0) as progresso,
         coalesce(original_name, source_file) as rotulo,
         error, created_at, updated_at
  from public.import_jobs
  union all
  select 'embeddings', id, space_id, status,
         case when coalesce(total, 0) > 0 then round(done::numeric * 100 / total) else coalesce(progress, 0) end,
         scope, error, created_at, created_at
  from public.embedding_jobs
  union all
  select 'ontologia', id, space_id, status,
         case when coalesce(total, 0) > 0 then round(done::numeric * 100 / total) else coalesce(progress, 0) end,
         coalesce(original_name, scope), error, created_at, created_at
  from public.ontology_jobs
  union all
  select 'traducao', id, space_id, status,
         case when coalesce(total, 0) > 0 then round(done::numeric * 100 / total) else coalesce(progress, 0) end,
         lang, error, created_at, created_at
  from public.ontology_translation_jobs
  union all
  select 'lote', id, space_id, status,
         case when coalesce(total, 0) > 0 then round(done::numeric * 100 / total) else coalesce(progress, 0) end,
         coalesce(phase, 'processando'), error, created_at, created_at
  from public.bulk_jobs
  union all
  select 'captura', id, space_id, status, coalesce(progress, 0), url, error, created_at, updated_at
  from public.capture_jobs
  union all
  select 'dicionario', id, space_id, status,
         case when coalesce(total, 0) > 0 then round(done::numeric * 100 / total) else coalesce(progress, 0) end,
         kind, error, created_at, created_at
  from public.data_dictionary_jobs
  union all
  select 'analise', id, space_id, status,
         case when coalesce(total_chunks, 0) > 0 then round(received_chunks::numeric * 100 / total_chunks) else 0 end,
         coalesce(destino, 'análise'), error, created_at, updated_at
  from public.analysis_jobs
  union all
  select 'analise_widget', id, space_id, status,
         coalesce(progress, 0), coalesce(kind, 'análise'), error, created_at, updated_at
  from public.widget_analysis_jobs
  union all
  -- Backup não tem `space_id`: é da instalação inteira. `null` é a resposta
  -- honesta, e a gaveta o mostra como global.
  select 'backup', id, null::uuid, status, coalesce(progress, 0),
         coalesce(phase, kind), error, created_at, updated_at
  from public.backup_jobs;

comment on view public.atividade_recente is
  'Os dez tipos de job num formato só, para a gaveta de Atividade. security_invoker mantém a RLS de cada tabela de origem.';

grant select on public.atividade_recente to authenticated;
