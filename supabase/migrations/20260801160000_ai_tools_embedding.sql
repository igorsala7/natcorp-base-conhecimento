-- Roteamento SEMÂNTICO de fonte (chat do widget): embedding de (name + description)
-- por ferramenta, para casar a mensagem do usuário com a tool certa antes de decidir
-- se pergunta "relatório da tela × conhecimento da IA". Mantido em sincronia pelo
-- saveTool (recalcula ao salvar/editar) e pelo backfill (npm run embed:tools).
-- A extensão vector já existe (chunks.embedding vector(1536)).

alter table ai_tools add column if not exists embedding vector(1536);

comment on column ai_tools.embedding is
  'Embedding de (name + description), text-embedding-3-small (1536). Roteamento semântico de fonte no chat do widget — recalculado no saveTool e no backfill.';
