-- Rastreio por conversa: de ONDE e de QUEM veio a conversa do chatbot/portal.
-- Preenchido pelo widget (atributos data-* do <script> ou querystring da página)
-- e pelo "Perguntar à IA". São DADOS de rastreio — nunca entram no prompt da IA.
alter table public.conversations
  add column if not exists p_base text,
  add column if not exists p_usuario text,
  add column if not exists p_portal text,
  add column if not exists p_empresa text,
  add column if not exists p_matricula text;

-- Filtros mais comuns no admin (por documentação + empresa/usuário).
create index if not exists conversations_track_empresa_idx
  on public.conversations (space_id, p_empresa);
create index if not exists conversations_track_usuario_idx
  on public.conversations (space_id, p_usuario);

-- RLS inalterada: a inserção do chat usa service-role (ignora RLS) e a leitura
-- do admin continua sob a policy `conversations_rw` (has_permission content.view).
