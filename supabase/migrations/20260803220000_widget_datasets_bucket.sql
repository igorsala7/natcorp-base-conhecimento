-- Tier grande dos datasets do widget (corrige o statement_timeout ao salvar).
--
-- Conjuntos coletados grandes (dezenas de MB de `rows`) estouravam o timeout do
-- Postgres/PostgREST ao gravar/reler o JSONB inteiro. Agora, acima de um limiar, as
-- linhas vão COMPRIMIDAS (gzip) para este bucket privado e a coluna `rows` fica NULL;
-- só o `storage_path` mora no banco. Conjuntos pequenos continuam inline em `rows`.
--
-- Bucket PRIVADO: acesso só pelo service-role (a rota /api/v1/datasets valida a chave
-- pública + o token de rastreio e lê/grava em nome do usuário). Sem policy para anon.
insert into storage.buckets (id, name, public)
values ('datasets', 'datasets', false)
on conflict (id) do nothing;
