-- =====================================================================
-- O consentimento passa a saber QUAL caixa a pessoa deveria conectar
--
-- Decisão do Igor (11/08/2026): a conta pessoal conectada tem de ser a do
-- e-mail FUNCIONAL do cadastro do RH (`meus_dados.email_funcional`). Sem isso,
-- num navegador logado no e-mail pessoal — o caso comum — a pessoa conecta a
-- caixa errada e nada acusa: o envio funciona, saindo do endereço errado.
--
-- O e-mail é fixado AQUI, no início do fluxo, e não relido no callback, por
-- dois motivos:
--
--   1. O callback não tem identidade própria (o token de rastreio ficou na
--      janela que abriu o popup). Ele só tem o nonce e o que gravamos com ele.
--   2. Reler no fim abriria espaço para o cadastro mudar no meio do fluxo e a
--      checagem comparar contra um alvo diferente do que foi oferecido na tela.
--
-- Nulo é normal e significa "não sabemos": cadastro sem e-mail funcional, ORDS
-- fora do ar, base sem a ferramenta. Nesse caso o consentimento segue sem
-- pré-seleção e SEM checagem — nunca bloqueando por falta de informação.
-- =====================================================================

alter table public.oauth_states add column if not exists expected_email text;

comment on column public.oauth_states.expected_email is
  'E-mail funcional do cadastro (meus_dados), fixado no início do consentimento: vira login_hint na tela do provedor e é o alvo da checagem no callback. NULL = desconhecido, e aí não há checagem.';
