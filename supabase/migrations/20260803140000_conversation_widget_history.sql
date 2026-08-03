-- Histórico de conversas do widget (por usuário ANÔNIMO do widget).
--
-- `conversations.user_ref` é UUID (FK auth.users) e fica NULL para o widget, cujos
-- usuários não têm linha em auth.users — são identificados pelo TOKEN de rastreio
-- (p_base + p_usuario/p_matricula). Por isso guardamos o escopo do widget num campo
-- de TEXTO próprio ("<p_base>:<p_usuario|matricula>"), exatamente como os relatórios
-- salvos (widget_saved_reports.user_ref). A rota /api/v1/conversations SEMPRE filtra
-- por space_id + widget_user_ref — um id sozinho nunca basta (isolamento por usuário).
--
-- `disclaimer` guarda a RESSALVA do agente exibida no chat ("Resposta baseada no
-- relatório desta tela…") para mostrá-la como coluna na lista do Histórico.
alter table public.conversations
  add column if not exists widget_user_ref text,
  add column if not exists disclaimer text;

-- Listagem do histórico do widget: por espaço + usuário do widget, mais recentes primeiro.
create index if not exists conversations_widget_user_idx
  on public.conversations (space_id, widget_user_ref, created_at desc);

-- Observação de segurança: o widget não acessa o banco direto (origem diferente, sem
-- service-role no browser). A rota valida a chave pública + o token e lê/escreve com
-- service-role (que ignora RLS) — nenhuma policy nova é necessária aqui.
