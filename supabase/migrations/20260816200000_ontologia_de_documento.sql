-- ONTOLOGIA A PARTIR DE DOCUMENTO DA BASE DE CONHECIMENTO
--
-- A varredura sempre leu `articles`, filtrando por `node_id`. Arquivo e página
-- subidos para o chatbot não têm `node_id`: viram `chunks` e nunca passaram por
-- ontologia. O efeito era um beco sem saída — não adiantava re-subir o arquivo,
-- porque esse caminho jamais gerou ontologia.
--
-- Quem perde com isso é a busca. O RAG usa os sinônimos para casar a pergunta do
-- leitor com o vocabulário do documento; um manual em PDF tem tanto jargão
-- quanto um artigo, e sem ontologia ele só é encontrado por quem já escreve
-- como o manual escreve.
--
-- `document` aponta para `knowledge_documents.id` em `target_id`. Os demais
-- escopos continuam apontando para `nodes.id` — a coluna é a mesma porque o job
-- é o mesmo; o que muda é onde o worker vai buscar o texto.
alter table public.ontology_jobs
  drop constraint if exists ontology_jobs_scope_check;

alter table public.ontology_jobs
  add constraint ontology_jobs_scope_check
  check (scope = any (array['space', 'subtree', 'article', 'import', 'document']));

comment on column public.ontology_jobs.scope is
  'space | subtree | article (target_id = nodes.id) · import (arquivo de termos) · document (target_id = knowledge_documents.id)';
