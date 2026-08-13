--------------------------------------------------------------------------------
-- Módulo ORDS `ferias.v1` — expõe PKG_API_FERIAS como REST      [ ORDS + 19.2 ]
--
-- Rode DEPOIS de apex/api-ferias-pkg.sql, como o schema NATCORP (o mesmo que
-- ORDS.ENABLE_SCHEMA já habilitou para as demais APIs do chatbot).
--
-- Padrão de todos os handlers: uma linha chamando a procedure, o JSON de volta
-- por htp.p. Nenhuma lógica aqui — se aparecer regra dentro de um handler,
-- ela está no lugar errado.
--
-- Recusa de NEGÓCIO sai 200 com ok=false, de propósito: para o chat é um turno
-- normal de conversa. Se voltasse 4xx, o modelo trataria como falha de
-- ferramenta e mudaria de assunto em vez de explicar o motivo à pessoa.
-- Falha TÉCNICA levanta exceção e cai no 500 padrão do ORDS.
--
--------------------------------------------------------------------------------
-- ⚠ ANTES DE RODAR
--   1. O caminho publicado é `requisicoes/ferias/v1/` — mesmo namespace das
--      demais requisições. As tools do chat apontam para ele.
--   2. `p_privilege_name` está NULL (autenticação pela credencial OAuth do
--      cliente, como nas demais APIs). Se a instalação usar privilégio
--      nomeado, preencha nos oito templates.
--   3. Este script é IDEMPOTENTE: deleta o módulo antes de recriar.
--------------------------------------------------------------------------------

set define off
set serveroutput on size unlimited

BEGIN
  BEGIN
    ORDS.DELETE_MODULE(p_module_name => 'ferias.v1');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  ORDS.DEFINE_MODULE(
    p_module_name    => 'ferias.v1',
    p_base_path      => '/requisicoes/ferias/v1/',
    p_items_per_page => 0,
    p_status         => 'PUBLISHED',
    p_comments       => 'Solicitação e aprovação de férias pelo Agente de IA. Contrato: docs/ferias-ords-contrato.md');

  ---------------------------------------------------------------- leitura ----
  ORDS.DEFINE_TEMPLATE(p_module_name => 'ferias.v1', p_pattern => 'situacao');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'ferias.v1',
    p_pattern     => 'situacao',
    p_method      => 'POST',                 -- POST: o corpo carrega a identidade
    p_source_type => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source      => q'[
declare l_out clob;
begin
  pkg_api_ferias.situacao(:body_text, l_out);
  :status_code := 200;
  owa_util.mime_header('application/json', false);
  owa_util.http_header_close;
  htp.prn(l_out);
end;]');

  ORDS.DEFINE_TEMPLATE(p_module_name => 'ferias.v1', p_pattern => 'opcoes');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'ferias.v1',
    p_pattern     => 'opcoes',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source      => q'[
declare l_out clob;
begin
  pkg_api_ferias.opcoes(:body_text, l_out);
  :status_code := 200;
  owa_util.mime_header('application/json', false);
  owa_util.http_header_close;
  htp.prn(l_out);
end;]');

  ORDS.DEFINE_TEMPLATE(p_module_name => 'ferias.v1', p_pattern => 'minhas');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'ferias.v1',
    p_pattern     => 'minhas',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source      => q'[
declare l_out clob;
begin
  pkg_api_ferias.minhas(:body_text, l_out);
  :status_code := 200;
  owa_util.mime_header('application/json', false);
  owa_util.http_header_close;
  htp.prn(l_out);
end;]');

  ORDS.DEFINE_TEMPLATE(p_module_name => 'ferias.v1', p_pattern => 'aprovacoes');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'ferias.v1',
    p_pattern     => 'aprovacoes',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source      => q'[
declare l_out clob;
begin
  pkg_api_ferias.aprovacoes(:body_text, l_out);
  :status_code := 200;
  owa_util.mime_header('application/json', false);
  owa_util.http_header_close;
  htp.prn(l_out);
end;]');

  ---------------------------------------------------------------- simulação --
  ORDS.DEFINE_TEMPLATE(p_module_name => 'ferias.v1', p_pattern => 'simular');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'ferias.v1',
    p_pattern     => 'simular',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source      => q'[
declare l_out clob;
begin
  pkg_api_ferias.simular(:body_text, l_out);
  :status_code := 200;
  owa_util.mime_header('application/json', false);
  owa_util.http_header_close;
  htp.prn(l_out);
end;]');

  ----------------------------------------------------------------- escrita ---
  -- As duas abaixo são as ÚNICAS que gravam. Do lado do chat, ambas ficam
  -- atrás do guard `confirmation_detalhada` (a pessoa vê o resumo e diz "sim").
  ORDS.DEFINE_TEMPLATE(p_module_name => 'ferias.v1', p_pattern => 'criar');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'ferias.v1',
    p_pattern     => 'criar',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source      => q'[
declare l_out clob;
begin
  pkg_api_ferias.criar(:body_text, l_out);
  :status_code := 200;
  owa_util.mime_header('application/json', false);
  owa_util.http_header_close;
  htp.prn(l_out);
end;]');

  ORDS.DEFINE_TEMPLATE(p_module_name => 'ferias.v1', p_pattern => 'aprovar');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'ferias.v1',
    p_pattern     => 'aprovar',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source      => q'[
declare l_out clob;
begin
  pkg_api_ferias.aprovar(:body_text, l_out);
  :status_code := 200;
  owa_util.mime_header('application/json', false);
  owa_util.http_header_close;
  htp.prn(l_out);
end;]');

  ------------------------------------------------------------ administrativo -
  -- NÃO vira ferramenta do chat. Existe porque executa() commita por dentro:
  -- se post_update falhar, a aprovação fica gravada e o fluxo não anda.
  ORDS.DEFINE_TEMPLATE(p_module_name => 'ferias.v1', p_pattern => 'reprocessar');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'ferias.v1',
    p_pattern     => 'reprocessar',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source      => q'[
declare l_out clob;
begin
  pkg_api_ferias.reprocessar(:body_text, l_out);
  :status_code := 200;
  owa_util.mime_header('application/json', false);
  owa_util.http_header_close;
  htp.prn(l_out);
end;]');

  COMMIT;
  dbms_output.put_line('Módulo ferias.v1 publicado em /requisicoes/ferias/v1/');
END;
/

--------------------------------------------------------------------------------
-- Grants necessários ao schema NATCORP (rode como SYS/ADMIN se faltar algum).
--------------------------------------------------------------------------------
-- GRANT EXECUTE ON APEX_190200.APEX_SESSION TO NATCORP;
-- GRANT EXECUTE ON APEX_190200.APEX_UTIL    TO NATCORP;
-- GRANT EXECUTE ON APEX_190200.APEX_JSON    TO NATCORP;
--
-- A view APEX_APPLICATIONS costuma vir liberada para PUBLIC. Confira, porque é
-- ela que traduz o alias (PO_NATCORP…) no id da aplicação:
--   select application_id, alias, workspace from apex_applications order by alias;
-- Se a consulta voltar vazia rodando como NATCORP, o pacote levanta ORA-20404
-- com o alias que procurou — e aí a saída é mandar identidade.p_app_id.

--------------------------------------------------------------------------------
-- Teste de fumaça — só leitura, não grava nada.
--------------------------------------------------------------------------------
-- curl -s -X POST https://<host>/apex/rh/natcorp/requisicoes/ferias/v1/situacao \
--   -H 'Authorization: Bearer <token>' -H 'Content-Type: application/json' \
--   -d '{"identidade":{"p_usuario":"FULANO","p_empresa_user":1,
--        "p_matricula_user":12345,"p_perfil":"COLABORADOR","p_painel":"PC",
--        "p_base":"NATCORP"}}' | jq .
