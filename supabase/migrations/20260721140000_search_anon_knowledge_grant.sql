-- Conserta a busca do portal (barra de pesquisa sem resultados).
--
-- `hybrid_search_scoped` roda como SECURITY INVOKER (de propósito: a RLS do
-- caller continua valendo sobre os chunks) e faz LEFT JOIN em
-- `knowledge_documents` para dar título a chunk de arquivo. O `anon` (leitor
-- do portal) NUNCA teve grant nessa tabela — e permissão de tabela é checada
-- pelo executor mesmo quando o join não traz linha nenhuma: toda busca do
-- portal morria com "permission denied for table knowledge_documents", e a
-- action engolia o erro como lista vazia.
--
-- A correção NÃO expõe nada: o grant satisfaz o executor, e a policy
-- `using (false)` garante que o anon lê ZERO linhas — arquivos do chatbot
-- continuam invisíveis fora dos caminhos com service-role.
grant select on public.knowledge_documents to anon;

drop policy if exists knowledge_documents_anon_nada on public.knowledge_documents;
create policy knowledge_documents_anon_nada on public.knowledge_documents
  for select to anon using (false);
