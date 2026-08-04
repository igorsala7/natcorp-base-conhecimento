-- SOFT-DELETE do histórico de conversas do widget.
--
-- "Apagar" pelo usuário deixa de REMOVER a linha (que serve ao RASTREIO/auditoria em
-- conversations/messages — ver o painel de Rastreio) e passa a apenas OCULTAR a conversa
-- da visão do usuário. A rota /api/v1/conversations marca `hidden_at` no "delete" e filtra
-- `hidden_at is null` em list/get/export/append. O admin (Rastreio) continua lendo TUDO,
-- pois não filtra por hidden_at — nada é perdido.
alter table public.conversations
  add column if not exists hidden_at timestamptz;

-- Índice parcial p/ a listagem do histórico, que só traz as visíveis (hidden_at is null).
create index if not exists conversations_widget_visible_idx
  on public.conversations (space_id, widget_user_ref, created_at desc)
  where hidden_at is null;
