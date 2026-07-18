-- Fase 0 — habilita as extensões que as próximas fases vão usar.
-- Instaladas no schema `extensions` (convenção do Supabase), que já está no
-- search_path do banco. Nenhuma tabela é criada aqui — o modelo de dados
-- (spaces/nodes/articles/...) chega a partir da Fase 1.

-- ltree: caminho materializado da árvore de conteúdo (mover subárvore = 1 UPDATE).
create extension if not exists ltree with schema extensions;

-- pgvector: embeddings para busca semântica / RAG (Fase 3 e 6).
create extension if not exists vector with schema extensions;

-- pg_trgm: busca por prefixo/similaridade, tolerante a erro de digitação (Fase 3).
create extension if not exists pg_trgm with schema extensions;

-- unaccent: normalização de acentos na busca full-text em português (Fase 3).
create extension if not exists unaccent with schema extensions;

-- pgcrypto: geração de tokens/identificadores (convites, chaves de widget).
create extension if not exists pgcrypto with schema extensions;
