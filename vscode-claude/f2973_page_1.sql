prompt --application/set_environment
set define off verify off feedback off
whenever sqlerror exit sql.sqlcode rollback
--------------------------------------------------------------------------------
--
-- ORACLE Application Express (APEX) export file
--
-- You should run the script connected to SQL*Plus as the Oracle user
-- APEX_190200 or as the owner (parsing schema) of the application.
--
-- NOTE: Calls to apex_application_install override the defaults below.
--
--------------------------------------------------------------------------------
begin
wwv_flow_api.import_begin (
 p_version_yyyy_mm_dd=>'2019.10.04'
,p_release=>'19.2.0.00.18'
,p_default_workspace_id=>1656634830766073
,p_default_application_id=>2973
,p_default_id_offset=>1219561400838589434
,p_default_owner=>'RHNATCORP'
);
end;
/
 
prompt APPLICATION 2973 - Requisição - Confirma Aprovação/Reprovação
--
-- Application Export:
--   Application:     2973
--   Name:            Requisição - Confirma Aprovação/Reprovação
--   Date and Time:   20:27 Wednesday August 12, 2026
--   Exported By:     IGOR
--   Flashback:       0
--   Export Type:     Page Export
--   Manifest
--     PAGE: 1
--   Manifest End
--   Version:         19.2.0.00.18
--   Instance ID:     199011336139141
--

begin
null;
end;
/
prompt --application/pages/delete_00001
begin
wwv_flow_api.remove_page (p_flow_id=>wwv_flow.g_flow_id, p_page_id=>1);
end;
/
prompt --application/pages/page_00001
begin
wwv_flow_api.create_page(
 p_id=>1
,p_user_interface_id=>wwv_flow_api.id(27614736011243811485)
,p_name=>unistr('Confirma\00E7\00E3o')
,p_alias=>'CONFIRMACAO'
,p_page_mode=>'MODAL'
,p_step_title=>unistr('Confirma\00E7\00E3o')
,p_autocomplete_on_off=>'OFF'
,p_page_template_options=>'#DEFAULT#'
,p_dialog_chained=>'N'
,p_last_updated_by=>'CIBELE.CRISTINA'
,p_last_upd_yyyymmddhh24miss=>'20251202165850'
);
wwv_flow_api.create_page_plug(
 p_id=>wwv_flow_api.id(11585745824854041104)
,p_plug_name=>unistr('Confirma\00E7\00E3o')
,p_region_template_options=>'#DEFAULT#:t-Form--stretchInputs:t-Form--labelsAbove'
,p_plug_template=>wwv_flow_api.id(27614701936911811377)
,p_plug_display_sequence=>10
,p_include_in_reg_disp_sel_yn=>'Y'
,p_plug_display_point=>'BODY'
,p_plug_query_options=>'DERIVED_REPORT_COLUMNS'
,p_attribute_01=>'N'
,p_attribute_02=>'HTML'
);
wwv_flow_api.create_page_plug(
 p_id=>wwv_flow_api.id(11585746110526041107)
,p_plug_name=>unistr('Bot\00F5es')
,p_region_template_options=>'#DEFAULT#'
,p_plug_template=>wwv_flow_api.id(27614702020083811378)
,p_plug_display_sequence=>10
,p_include_in_reg_disp_sel_yn=>'Y'
,p_plug_display_point=>'REGION_POSITION_03'
,p_plug_query_options=>'DERIVED_REPORT_COLUMNS'
,p_attribute_01=>'N'
,p_attribute_02=>'HTML'
);
wwv_flow_api.create_page_button(
 p_id=>wwv_flow_api.id(11585746155169041108)
,p_button_sequence=>20
,p_button_plug_id=>wwv_flow_api.id(11585746110526041107)
,p_button_name=>'CONFIRMAR'
,p_button_action=>'SUBMIT'
,p_button_template_options=>'#DEFAULT#'
,p_button_template_id=>wwv_flow_api.id(27614730806003811435)
,p_button_is_hot=>'Y'
,p_button_image_alt=>'Confirmar'
,p_button_position=>'REGION_TEMPLATE_NEXT'
);
wwv_flow_api.create_page_button(
 p_id=>wwv_flow_api.id(11585746274275041109)
,p_button_sequence=>10
,p_button_plug_id=>wwv_flow_api.id(11585746110526041107)
,p_button_name=>'CANCELAR'
,p_button_action=>'DEFINED_BY_DA'
,p_button_template_options=>'#DEFAULT#'
,p_button_template_id=>wwv_flow_api.id(27614730806003811435)
,p_button_image_alt=>'Cancelar'
,p_button_position=>'REGION_TEMPLATE_PREVIOUS'
,p_warn_on_unsaved_changes=>null
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(11585745908749041105)
,p_name=>'P1_TEXTO'
,p_item_sequence=>30
,p_item_plug_id=>wwv_flow_api.id(11585745824854041104)
,p_prompt=>'Texto'
,p_display_as=>'NATIVE_DISPLAY_ONLY'
,p_grid_label_column_span=>0
,p_field_template=>wwv_flow_api.id(27614730365399811428)
,p_item_template_options=>'#DEFAULT#:t-Form-fieldContainer--stretchInputs:t-Form-fieldContainer--large'
,p_attribute_01=>'N'
,p_attribute_02=>'VALUE'
,p_attribute_04=>'Y'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(11585745936255041106)
,p_name=>'P1_JUSTIFICATIVA'
,p_item_sequence=>40
,p_item_plug_id=>wwv_flow_api.id(11585745824854041104)
,p_prompt=>'Justificativa'
,p_display_as=>'NATIVE_TEXTAREA'
,p_cSize=>30
,p_cHeight=>5
,p_field_template=>wwv_flow_api.id(27614730547664811429)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'Y'
,p_attribute_02=>'Y'
,p_attribute_03=>'N'
,p_attribute_04=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(11585746443081041111)
,p_name=>'P1_COD_REQ'
,p_item_sequence=>10
,p_item_plug_id=>wwv_flow_api.id(11585745824854041104)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'Y'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(11585746619833041112)
,p_name=>'P1_STATUS'
,p_item_sequence=>20
,p_item_plug_id=>wwv_flow_api.id(11585745824854041104)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'Y'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(11585747109396041117)
,p_validation_name=>unistr('Campo Obrigat\00F3rio')
,p_validation_sequence=>10
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if trim(:p1_justificativa) is null then',
unistr('return ''A justificativa \00E9 obrigat\00F3ria!'';'),
'end if;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(11585746155169041108)
,p_associated_item=>wwv_flow_api.id(11585745936255041106)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(11585746914380041115)
,p_name=>'Cancel Dialog'
,p_event_sequence=>10
,p_triggering_element_type=>'BUTTON'
,p_triggering_button_id=>wwv_flow_api.id(11585746274275041109)
,p_bind_type=>'bind'
,p_bind_event_type=>'click'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(11585746933047041116)
,p_event_id=>wwv_flow_api.id(11585746914380041115)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_DIALOG_CANCEL'
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(11585746333848041110)
,p_process_sequence=>10
,p_process_point=>'AFTER_SUBMIT'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'Executa Processo'
,p_process_sql_clob=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'  v_flg varchar2(1);',
'  v_msg varchar2(4000);',
'',
'	v_flg_retorno varchar2(3);',
'',
'  erro exception;',
'',
'    cursor c_usuario(v_usuario varchar2) is',
'    select cd_perfil perfil, ',
'           cd_empresa cod_empresa, ',
'           cd_matricula matricula',
'      from usuario_oracle',
'     where nm_usuario_oracle = v_usuario;',
'',
'    v_usuario c_usuario%rowtype;',
'',
'    cursor c_perfil_aprov(v_perfil varchar2) is',
'    select cd_perfil perfil',
'      from perfil_aprovadores',
'     where cd_perfil = v_perfil;',
'',
'    v_perfil_aprov c_perfil_aprov%rowtype;',
'  ',
'  cursor c1 is',
'  select A.tipo_req, A.COD_EMPRESA, A.mat_solicitado,nvl(B.RECRIAR_REQ_CONCL_FUNC,''N'') RECRIAR_REQ_CONCL_FUNC,B.DIAS_ANTES_PAGTO_FERIAS',
'    from consulta_requisicoes A,',
'         FERIAS_PARAMETROS B',
'   where A.solicitacao = :p1_cod_req',
'   and A.cod_empresa = B.cod_empresa (+)',
'   and A.filial = B.cod_filial (+);',
'   ',
'  v_c1 c1%rowtype;',
'',
'begin',
'',
'  open c1;',
'  fetch c1 into v_c1;',
'  close c1;',
'  ',
'  if v_c1.tipo_req <> ''REQ_ALTERACAO'' then',
'	-- Adicionado por Robson/Rodrigo/Adrina 22/11/2022',
'	if v_c1.tipo_req = ''REQ_IND_MOVTO'' then',
'      begin',
'            update APROVA_INDICACAO_MOVIMENTACAO',
'               set status_aprov = :p1_status, dt_aprov = sysdate, usuario = :p_usuario, justificativa = :p1_justificativa',
'             where cod_requisicao  = :p1_cod_req',
'               and cod_emp_aprov   = :p_empresa_user',
'               and mat_aprov       = :p_matricula_user;',
'',
'        commit;',
'        exception ',
'            when others then',
unistr('                  raise_application_error(-20001,''(3) - Erro ao atualizar aprova indica\00E7\00E3o movimenta\00E7\00E3o: ''||v_msg);'),
'        end;',
'    elsif v_c1.tipo_req = ''REQ_SERV_TERC'' then',
'      begin',
'            update APROVA_SERVICO_TERCEIROS',
'               set status_aprov = :p1_status, dt_aprov = sysdate, usuario = :p_usuario, justificativa = :p1_justificativa',
'             where cod_requisicao  = :p1_cod_req',
'               and cod_emp_aprov   = :p_empresa_user',
'               and mat_aprov       = :p_matricula_user;',
'',
'        commit;',
'        exception ',
'            when others then',
unistr('                  raise_application_error(-20001,''(3) - Erro ao atualizar aprova servi\00E7o terceiros: ''||v_msg);'),
'        end;',
'    elsif v_c1.tipo_req = ''REQ_FERIAS'' and :P1_STATUS = ''A'' and v_c1.RECRIAR_REQ_CONCL_FUNC = ''S'' then',
'		for C in (',
'			select  B.COD_EMPRESA,',
'					B.COD_SOLICITACAO',
'			from    REQUISICAO_FERIAS B',
'			where   B.COD_EMPRESA = v_c1.COD_EMPRESA',
'			and     B.MATRICULA = v_c1.mat_solicitado',
'			and     B.COD_SOLICITACAO != :P1_COD_REQ',
'			and		(B.DT_SAIDA_PARC1-TRUNC(SYSDATE))+1 >= v_c1.DIAS_ANTES_PAGTO_FERIAS',
'			and     exists (select  1',
'							from    REQUISICAO_FERIAS A',
'							where   A.COD_EMPRESA = B.COD_EMPRESA',
'							and     A.COD_SOLICITACAO = :P1_COD_REQ',
'							and     A.DT_INIC_PER_FERIAS = B.DT_INIC_PER_FERIAS',
'							and     A.DT_FIM_PER_FERIAS = B.DT_FIM_PER_FERIAS)',
'		) loop',
'    		update 	REQUISICAO_FERIAS A',
'       		set 	A.SIT_REQUISICAO = 3, ',
'           			A.USUARIO = to_char(:P_EMPRESA_USER)||''/''||to_char(:P_MATRICULA_USER),',
'           			A.DT_ATUALIZACAO = sysdate',
'     		where 	A.COD_SOLICITACAO = C.COD_SOLICITACAO;',
'',
'			/*PKG_FERIAS.Post_Update(	C.COD_EMPRESA,',
'									C.COD_SOLICITACAO,',
'                      				V_flg_retorno,',
'                      				v_msg);',
'			if V_flg_retorno = ''N'' and trim(v_msg) is not null then',
'				v_msg := ''{''||C.COD_SOLICITACAO||''} ''||v_msg;',
'				raise erro;',
'			end if;*/',
'		end loop;',
'	end if;',
'	--',
'	  ',
'      pkg_aprovacao_coletiva.executa (:p1_cod_req,',
'                           :p1_status, ',
'                           :p_empresa_user, ',
'                           :p_matricula_user, ',
'                           :p_usuario,',
'                           :p1_justificativa,',
'                           v_flg,',
'                           v_msg);',
'      commit;',
'      ',
'   else',
'   ',
'',
'      open c_perfil_aprov(:P_PERFIL);',
'      fetch c_perfil_aprov into v_perfil_aprov;',
'      close c_perfil_aprov;',
'        ',
'    IF v_perfil_aprov.perfil is null then  ',
'    ',
'        begin',
'            update APROVA_SOLICITACAO',
'               set status_aprov = :p1_status, dt_aprov = sysdate, usuario = :p_usuario, justificativa = :p1_justificativa',
'             where cod_empresa = v_c1.cod_empresa',
'               and cod_solicitacao = :p1_cod_req',
'               and cod_emp_aprov = :p_empresa_user',
'               and mat_aprov = :p_matricula_user;',
'',
'        commit;',
'        exception ',
'            when others then',
unistr('                  raise_application_error(-20001,''(1) - Erro ao atualizar aprova solicita\00E7\00E3o: ''||v_msg);'),
'        end;',
'    ELSE',
'        begin',
'',
'            update APROVA_SOLICITACAO',
'               set status_aprov = :p1_status, usuario = :p_usuario, dt_aprov = sysdate, justificativa = ''(Aprovado por ''||:p_usuario||'') ''||:p1_justificativa',
'             where cod_solicitacao = :p1_cod_req',
'               and (cod_emp_aprov, mat_aprov) in (select U.cd_empresa, U.cd_matricula from usuario_oracle U where U.cd_Perfil = :p_Perfil);',
'',
'        commit;',
'        exception ',
'            when others then',
unistr('                  raise_application_error(-20001,''(2) - Erro ao atualizar aprova solicita\00E7\00E3o: ''||v_msg);'),
'',
'',
'        end;',
'    END IF;',
'   ',
'   end if;',
'',
'  if v_flg = ''N'' and trim(v_msg) is not null then',
'  raise erro;',
'  end if;',
'',
'exception',
'  when erro then',
'  rollback;',
unistr('  raise_application_error(-20001,''Erro ao processar solicita\00E7\00E3o: ''||v_msg);'),
'',
'end;'))
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
,p_process_when_button_id=>wwv_flow_api.id(11585746155169041108)
,p_process_success_message=>'EXECUTA PROCESSO realizado.'
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(11585746717617041113)
,p_process_sequence=>20
,p_process_point=>'AFTER_SUBMIT'
,p_process_type=>'NATIVE_CLOSE_WINDOW'
,p_process_name=>'Close Dialog'
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
,p_process_when_button_id=>wwv_flow_api.id(11585746155169041108)
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(11595738653132783800)
,p_process_sequence=>10
,p_process_point=>'BEFORE_HEADER'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'Limpar Justificativa'
,p_process_sql_clob=>':P1_JUSTIFICATIVA := NULL;'
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
);
end;
/
prompt --application/end_environment
begin
wwv_flow_api.import_end(p_auto_install_sup_obj => nvl(wwv_flow_application_install.get_auto_install_sup_obj, false));
commit;
end;
/
set verify on feedback on define on
prompt  ...done
