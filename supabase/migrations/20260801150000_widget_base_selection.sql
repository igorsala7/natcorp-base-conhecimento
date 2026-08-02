-- "Base de Dados" do chat: a seleção de FONTES (relatórios salvos) que entram no
-- contexto das perguntas, persistida por usuário (sobrevive à sessão/tela). Uploads
-- da sessão NÃO ficam aqui (vão por attachmentIds); só os relatórios salvos escolhidos.
--   modo: 'completa' (fontes + tela + RAG + ontologia + tools) | 'exclusiva' (fontes +
--   tela, SEM RAG/ontologia).

create table if not exists widget_base_selection (
  space_id      uuid not null references spaces (id) on delete cascade,
  user_ref      text not null,                         -- "<p_base>:<p_usuario|matricula>"
  relatorio_ids jsonb not null default '[]'::jsonb,     -- ids de widget_saved_reports
  modo          text  not null default 'completa',
  updated_at    timestamptz not null default now(),
  primary key (space_id, user_ref)
);

alter table widget_base_selection enable row level security; -- só service-role (a rota valida a chave)
