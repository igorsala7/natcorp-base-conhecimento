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
,p_default_application_id=>200
,p_default_id_offset=>1462566175459231076
,p_default_owner=>'RHNATCORP'
);
end;
/
 
prompt APPLICATION 200 - Painel do Operador - Natcorp
--
-- Application Export:
--   Application:     200
--   Name:            Painel do Operador - Natcorp
--   Date and Time:   20:26 Wednesday August 12, 2026
--   Exported By:     IGOR
--   Flashback:       0
--   Export Type:     Page Export
--   Manifest
--     PAGE: 78
--   Manifest End
--   Version:         19.2.0.00.18
--   Instance ID:     199011336139141
--

begin
null;
end;
/
prompt --application/pages/delete_00078
begin
wwv_flow_api.remove_page (p_flow_id=>wwv_flow.g_flow_id, p_page_id=>78);
end;
/
prompt --application/pages/page_00078
begin
wwv_flow_api.create_page(
 p_id=>78
,p_user_interface_id=>wwv_flow_api.id(276731828560276120539)
,p_name=>unistr('Editar: Requisi\00E7\00E3o de F\00E9rias')
,p_step_title=>unistr('Editar: Requisi\00E7\00E3o de F\00E9rias')
,p_allow_duplicate_submissions=>'N'
,p_reload_on_submit=>'A'
,p_warn_on_unsaved_changes=>'N'
,p_autocomplete_on_off=>'ON'
,p_javascript_code=>wwv_flow_string.join(wwv_flow_t_varchar2(
'var htmldb_delete_message=''"DELETE_CONFIRM_MSG"'';',
'',
'var retornaData1_1 = function(number) {',
'    if ($x(''P78_DT_SAIDA_PARC1_1'').value.length  > 0 ) {',
'        return true;       ',
'    }else{',
'        return false;',
'    }',
'};',
'',
'var retornaData2_1 = function(number) {',
'    if ($x(''P78_DT_SAIDA_PARC2_1'').value.length  > 0 ) {',
'        return true;       ',
'    }else{',
'        return false;',
'    }',
'};',
'',
'var retornaData4_1 = function(number) {',
'    if ($x(''P78_DT_SAIDA_PARC4_1'').value.length  > 0 ) {',
'        return true;       ',
'    }else{',
'        return false;',
'    }',
'};',
'',
'$x(''P78_DT_SAIDA_PARC1_1'').disabled = true;',
'$x(''P78_NUM_DIAS_PARC1_1'').disabled = true;',
'$x(''P78_DIAS_ABONO_PEC1_1'').disabled = true;',
'$x(''P78_OPCAO_13SAL1_1'').disabled = true;',
'$x(''P78_DESC_ADICIONAL1_1'').disabled = true;',
'$x(''P78_DT_RETORNO_PARC1_1'').disabled = true;',
'',
'$x(''P78_DT_SAIDA_PARC2_1'').disabled = true;',
'$x(''P78_NUM_DIAS_PARC2_1'').disabled = true;',
'$x(''P78_DIAS_ABONO_PEC2_1'').disabled = true;',
'$x(''P78_OPCAO_13SAL2_1'').disabled = true;',
'$x(''P78_DESC_ADICIONAL2_1'').disabled = true;',
'$x(''P78_DT_RETORNO_PARC2_1'').disabled = true;',
'',
'$x(''P78_DT_SAIDA_PARC4_1'').disabled = true;',
'$x(''P78_NUM_DIAS_PARC4_1'').disabled = true;',
'$x(''P78_DIAS_ABONO_PEC4_1'').disabled = true;',
'$x(''P78_OPCAO_13SAL4_1'').disabled = true;',
'$x(''P78_DESC_ADICIONAL4_1'').disabled = true;',
'$x(''P78_DT_RETORNO_PARC4_1'').disabled = true;'))
,p_inline_css=>wwv_flow_string.join(wwv_flow_t_varchar2(
'#PARAMETROS .t-Region-buttons-right{',
'    width: 100% !important;',
'}'))
,p_page_template_options=>'#DEFAULT#'
,p_protection_level=>'C'
,p_help_text=>'No help is available for this page.'
,p_last_updated_by=>'YLEM.ARNALDO'
,p_last_upd_yyyymmddhh24miss=>'20260410121122'
);
wwv_flow_api.create_page_plug(
 p_id=>wwv_flow_api.id(276694807774550432529)
,p_plug_name=>'&P78_TITULO.'
,p_region_name=>'TIT'
,p_region_template_options=>'#DEFAULT#:t-Region--scrollBody:t-Form--stretchInputs'
,p_plug_template=>wwv_flow_api.id(276731802563438120445)
,p_plug_display_sequence=>20
,p_plug_display_point=>'BODY'
,p_plug_query_options=>'DERIVED_REPORT_COLUMNS'
,p_attribute_01=>'N'
,p_attribute_02=>'TEXT'
,p_attribute_03=>'Y'
);
wwv_flow_api.create_page_plug(
 p_id=>wwv_flow_api.id(276694814194714432536)
,p_plug_name=>unistr('Bot\00F5es')
,p_region_template_options=>'#DEFAULT#:t-ButtonRegion--slimPadding:t-Form--slimPadding:t-Form--stretchInputs'
,p_plug_template=>wwv_flow_api.id(276731794569116120432)
,p_plug_display_sequence=>20
,p_plug_display_point=>'REGION_POSITION_01'
,p_plug_query_options=>'DERIVED_REPORT_COLUMNS'
,p_attribute_01=>'N'
,p_attribute_02=>'HTML'
);
wwv_flow_api.create_report_region(
 p_id=>wwv_flow_api.id(276694816568983432538)
,p_name=>'Aprovadores'
,p_region_name=>'APR'
,p_template=>wwv_flow_api.id(276731802563438120445)
,p_display_sequence=>40
,p_region_template_options=>'#DEFAULT#:t-Region--noPadding:js-showMaximizeButton:t-Region--scrollBody:t-Form--noPadding:t-Form--stretchInputs'
,p_component_template_options=>'#DEFAULT#:t-Report--stretch:t-Report--altRowsDefault:t-Report--rowHighlight'
,p_new_grid_row=>false
,p_grid_column_span=>4
,p_display_point=>'BODY'
,p_source_type=>'NATIVE_SQL_REPORT'
,p_query_type=>'SQL'
,p_source=>wwv_flow_string.join(wwv_flow_t_varchar2(
'select DISTINCT ''ROWID'', a.cod_emp_aprov||'' - ''||a.mat_aprov||'' - ''||initcap(fnct_nome_func(a.cod_emp_aprov,a.mat_aprov)) aprovador, a.dt_aprov Data, a.STATUS_APROV Status, a.cod_emp_aprov, a.mat_aprov, A.SEQ_APROV, a.justificativa',
'  from aprova_ferias a, usuario_oracle u',
' where a.cod_solicitacao = :p78_cod_solicitacao',
'   and a.cod_emp_aprov = u.cd_empresa',
'   and a.mat_aprov = u.cd_matricula',
'   --and u.cd_perfil NOT IN (''BUSINESS PARTNER'',''REMUNERACAO'',''CONT DE NEGOCIOS'')',
'   and (not exists (select 1',
'                     from perfil_aprovadores x',
'                    where x.cd_perfil = u.cd_perfil) or ',
'       exists (select 1 ',
'                 from suplentes s',
'                where s.cod_emp_supl = a.cod_emp_aprov',
'                  and s.matricula_supl = a.mat_aprov',
'                  and a.dt_atualizacao between trunc(s.dt_inic_supl) and nvl(trunc(s.dt_fim_supl),sysdate)))',
'union',
'select DISTINCT ''ROWID'', U.CD_PERFIL aprovador, a.dt_aprov Data, a.STATUS_APROV Status, NULL cod_emp_aprov, NULL mat_aprov, MIN(A.SEQ_APROV) SEQ_APROV, a.justificativa',
'  from aprova_ferias a, usuario_oracle u',
' where a.cod_solicitacao = :p78_cod_solicitacao',
'   and a.cod_emp_aprov = u.cd_empresa',
'   and a.mat_aprov = u.cd_matricula',
'  -- and u.cd_perfil = ''BUSINESS PARTNER''',
'   and exists (select 1',
'                 from perfil_aprovadores x',
'                where x.cd_perfil = u.cd_perfil)',
'   and not exists (select 1 ',
'                 from suplentes s',
'                where s.cod_emp_supl = a.cod_emp_aprov',
'                  and s.matricula_supl = a.mat_aprov',
'                  and a.dt_atualizacao between trunc(s.dt_inic_supl) and nvl(trunc(s.dt_fim_supl),sysdate))',
' GROUP BY U.CD_PERFIL, a.dt_aprov, a.STATUS_APROV, a.justificativa',
'ORDER BY 7'))
,p_display_when_condition=>wwv_flow_string.join(wwv_flow_t_varchar2(
'select mat_aprov',
'  from APROVA_FERIAS',
' where cod_solicitacao = :p78_cod_solicitacao'))
,p_display_condition_type=>'EXISTS'
,p_ajax_enabled=>'Y'
,p_ajax_items_to_submit=>'P78_COD_SOLICITACAO'
,p_query_row_template=>wwv_flow_api.id(276731811374992120461)
,p_query_num_rows=>15
,p_query_options=>'DERIVED_REPORT_COLUMNS'
,p_query_show_nulls_as=>'-'
,p_csv_output=>'N'
,p_prn_output=>'N'
,p_sort_null=>'L'
,p_plug_query_strip_html=>'N'
);
wwv_flow_api.create_report_columns(
 p_id=>wwv_flow_api.id(276329685215511718459)
,p_query_column_id=>1
,p_column_alias=>'''ROWID'''
,p_column_display_sequence=>1
,p_use_as_row_header=>'N'
,p_column_link=>'f?p=&APP_ID.:13:&SESSION.::&DEBUG.:13:P13_EMP,P13_MAT:#COD_EMP_APROV#,#MAT_APROV#'
,p_column_linktext=>'<img src="#IMAGE_PREFIX#app_ui/img/icons/apex-edit-view.png" class="apex-edit-view" alt="">'
,p_lov_show_nulls=>'YES'
,p_derived_column=>'N'
,p_include_in_export=>'Y'
);
wwv_flow_api.create_report_columns(
 p_id=>wwv_flow_api.id(276329685559851718460)
,p_query_column_id=>2
,p_column_alias=>'APROVADOR'
,p_column_display_sequence=>2
,p_column_heading=>'Aprovador'
,p_use_as_row_header=>'N'
,p_derived_column=>'N'
,p_include_in_export=>'Y'
);
wwv_flow_api.create_report_columns(
 p_id=>wwv_flow_api.id(276329685938106718461)
,p_query_column_id=>3
,p_column_alias=>'DATA'
,p_column_display_sequence=>3
,p_column_heading=>'Data'
,p_use_as_row_header=>'N'
,p_column_format=>'dd/mm/yyyy hh24:mi'
,p_derived_column=>'N'
,p_include_in_export=>'Y'
);
wwv_flow_api.create_report_columns(
 p_id=>wwv_flow_api.id(276329686363104718461)
,p_query_column_id=>4
,p_column_alias=>'STATUS'
,p_column_display_sequence=>4
,p_column_heading=>'Status'
,p_use_as_row_header=>'N'
,p_display_as=>'TEXT_FROM_LOV_ESC'
,p_inline_lov=>'STATIC:Pendente;P,Aprovado;A,Reprovado;R'
,p_derived_column=>'N'
,p_include_in_export=>'Y'
);
wwv_flow_api.create_report_columns(
 p_id=>wwv_flow_api.id(276329686753634718461)
,p_query_column_id=>5
,p_column_alias=>'COD_EMP_APROV'
,p_column_display_sequence=>5
,p_hidden_column=>'Y'
,p_derived_column=>'N'
);
wwv_flow_api.create_report_columns(
 p_id=>wwv_flow_api.id(276329687144471718462)
,p_query_column_id=>6
,p_column_alias=>'MAT_APROV'
,p_column_display_sequence=>6
,p_hidden_column=>'Y'
,p_derived_column=>'N'
);
wwv_flow_api.create_report_columns(
 p_id=>wwv_flow_api.id(269156856875358850697)
,p_query_column_id=>7
,p_column_alias=>'SEQ_APROV'
,p_column_display_sequence=>7
,p_hidden_column=>'Y'
,p_derived_column=>'N'
);
wwv_flow_api.create_report_columns(
 p_id=>wwv_flow_api.id(265168843941922939553)
,p_query_column_id=>8
,p_column_alias=>'JUSTIFICATIVA'
,p_column_display_sequence=>8
,p_column_heading=>'Justificativa'
,p_use_as_row_header=>'N'
,p_derived_column=>'N'
,p_include_in_export=>'Y'
);
wwv_flow_api.create_page_plug(
 p_id=>wwv_flow_api.id(276694820167112432541)
,p_plug_name=>'Colaborador Solicitado'
,p_region_name=>'COLABORADOR'
,p_region_template_options=>'#DEFAULT#:t-Region--scrollBody:t-Form--stretchInputs:t-Form--labelsAbove'
,p_plug_template=>wwv_flow_api.id(276731802563438120445)
,p_plug_display_sequence=>30
,p_include_in_reg_disp_sel_yn=>'Y'
,p_plug_new_grid_row=>false
,p_plug_new_grid_column=>false
,p_plug_display_point=>'BODY'
,p_plug_query_options=>'DERIVED_REPORT_COLUMNS'
,p_attribute_01=>'N'
,p_attribute_02=>'HTML'
);
wwv_flow_api.create_page_plug(
 p_id=>wwv_flow_api.id(276694824180725432544)
,p_plug_name=>'Colab Foto'
,p_parent_plug_id=>wwv_flow_api.id(276694820167112432541)
,p_region_template_options=>'#DEFAULT#:t-Region--noPadding:t-Region--removeHeader:t-Region--noUI:t-Region--scrollBody:t-Form--noPadding:t-Form--stretchInputs:t-Form--labelsAbove'
,p_plug_template=>wwv_flow_api.id(276731802563438120445)
,p_plug_display_sequence=>10
,p_plug_grid_column_span=>3
,p_plug_display_point=>'BODY'
,p_plug_query_options=>'DERIVED_REPORT_COLUMNS'
,p_plug_display_condition_type=>'ITEM_IS_NOT_NULL'
,p_plug_display_when_condition=>'P78_ROWID'
,p_attribute_01=>'N'
,p_attribute_02=>'HTML'
);
wwv_flow_api.create_page_plug(
 p_id=>wwv_flow_api.id(276694824999993432545)
,p_plug_name=>'Colab Info'
,p_parent_plug_id=>wwv_flow_api.id(276694820167112432541)
,p_region_template_options=>'#DEFAULT#:t-Region--noPadding:t-Region--removeHeader:t-Region--noUI:t-Region--scrollBody:t-Form--noPadding:t-Form--stretchInputs:t-Form--labelsAbove'
,p_plug_template=>wwv_flow_api.id(276731802563438120445)
,p_plug_display_sequence=>20
,p_plug_new_grid_row=>false
,p_plug_display_point=>'BODY'
,p_plug_query_options=>'DERIVED_REPORT_COLUMNS'
,p_plug_display_condition_type=>'ITEM_IS_NOT_NULL'
,p_plug_display_when_condition=>'P78_ROWID'
,p_attribute_01=>'N'
,p_attribute_02=>'HTML'
);
wwv_flow_api.create_page_plug(
 p_id=>wwv_flow_api.id(276694826984926432549)
,p_plug_name=>unistr('Per\00EDodo')
,p_region_name=>'PER'
,p_region_template_options=>'#DEFAULT#:t-Region--scrollBody:t-Form--slimPadding:t-Form--stretchInputs'
,p_plug_template=>wwv_flow_api.id(276731802563438120445)
,p_plug_display_sequence=>50
,p_include_in_reg_disp_sel_yn=>'Y'
,p_plug_display_point=>'BODY'
,p_plug_query_options=>'DERIVED_REPORT_COLUMNS'
,p_attribute_01=>'N'
,p_attribute_02=>'HTML'
);
wwv_flow_api.create_page_plug(
 p_id=>wwv_flow_api.id(276461660456670611285)
,p_plug_name=>unistr('Op\00E7\00F5es de Programa\00E7\00E3o de F\00E9rias')
,p_region_name=>'OPCAO'
,p_parent_plug_id=>wwv_flow_api.id(276694826984926432549)
,p_region_template_options=>'#DEFAULT#:t-Region--hideHeader:t-Region--scrollBody:t-Form--slimPadding:t-Form--stretchInputs'
,p_plug_template=>wwv_flow_api.id(276731802563438120445)
,p_plug_display_sequence=>30
,p_plug_display_point=>'BODY'
,p_plug_query_options=>'DERIVED_REPORT_COLUMNS'
,p_attribute_01=>'N'
,p_attribute_02=>'HTML'
);
wwv_flow_api.create_page_plug(
 p_id=>wwv_flow_api.id(276465208681842959609)
,p_plug_name=>unistr('2\00AA  Parcela (Programada)')
,p_region_name=>'2_PARCELA2'
,p_parent_plug_id=>wwv_flow_api.id(276694826984926432549)
,p_region_template_options=>'#DEFAULT#:t-Region--scrollBody:t-Form--noPadding:t-Form--stretchInputs:t-Form--labelsAbove'
,p_plug_template=>wwv_flow_api.id(276731802563438120445)
,p_plug_display_sequence=>80
,p_plug_new_grid_row=>false
,p_plug_new_grid_column=>false
,p_plug_display_point=>'BODY'
,p_plug_query_options=>'DERIVED_REPORT_COLUMNS'
,p_attribute_01=>'N'
,p_attribute_02=>'HTML'
);
wwv_flow_api.create_page_plug(
 p_id=>wwv_flow_api.id(276465209599486959618)
,p_plug_name=>unistr('3\00AA  Parcela (Programada)')
,p_region_name=>'2_PARCELA3'
,p_parent_plug_id=>wwv_flow_api.id(276694826984926432549)
,p_region_template_options=>'#DEFAULT#:t-Region--scrollBody:t-Form--noPadding:t-Form--stretchInputs:t-Form--labelsAbove'
,p_plug_template=>wwv_flow_api.id(276731802563438120445)
,p_plug_display_sequence=>110
,p_plug_new_grid_row=>false
,p_plug_new_grid_column=>false
,p_plug_display_point=>'BODY'
,p_plug_query_options=>'DERIVED_REPORT_COLUMNS'
,p_attribute_01=>'N'
,p_attribute_02=>'HTML'
);
wwv_flow_api.create_page_plug(
 p_id=>wwv_flow_api.id(276559150703399823134)
,p_plug_name=>unistr('3\00AA Parcela')
,p_region_name=>'PARCELA3'
,p_parent_plug_id=>wwv_flow_api.id(276694826984926432549)
,p_region_template_options=>'#DEFAULT#:t-Region--scrollBody:t-Form--noPadding:t-Form--stretchInputs:t-Form--labelsAbove'
,p_plug_template=>wwv_flow_api.id(276731802563438120445)
,p_plug_display_sequence=>100
,p_plug_new_grid_row=>false
,p_plug_display_point=>'BODY'
,p_plug_query_options=>'DERIVED_REPORT_COLUMNS'
,p_attribute_01=>'N'
,p_attribute_02=>'HTML'
);
wwv_flow_api.create_page_plug(
 p_id=>wwv_flow_api.id(276694827786584432550)
,p_plug_name=>'Dados'
,p_region_name=>'DADOS'
,p_parent_plug_id=>wwv_flow_api.id(276694826984926432549)
,p_region_template_options=>'#DEFAULT#:t-Region--removeHeader:t-Region--scrollBody'
,p_plug_template=>wwv_flow_api.id(276731802563438120445)
,p_plug_display_sequence=>20
,p_plug_new_grid_row=>false
,p_plug_display_point=>'BODY'
,p_plug_query_options=>'DERIVED_REPORT_COLUMNS'
,p_attribute_01=>'N'
,p_attribute_02=>'HTML'
);
wwv_flow_api.create_page_plug(
 p_id=>wwv_flow_api.id(276694832970995432555)
,p_plug_name=>unistr('1\00AA Parcela')
,p_region_name=>'PARCELA1'
,p_parent_plug_id=>wwv_flow_api.id(276694826984926432549)
,p_region_template_options=>'#DEFAULT#:t-Region--scrollBody:t-Form--noPadding:t-Form--stretchInputs:t-Form--labelsAbove'
,p_plug_template=>wwv_flow_api.id(276731802563438120445)
,p_plug_display_sequence=>40
,p_plug_display_point=>'BODY'
,p_plug_query_options=>'DERIVED_REPORT_COLUMNS'
,p_attribute_01=>'N'
,p_attribute_02=>'HTML'
);
wwv_flow_api.create_page_plug(
 p_id=>wwv_flow_api.id(276694838117800432559)
,p_plug_name=>unistr('2\00AA Parcela')
,p_region_name=>'PARCELA2'
,p_parent_plug_id=>wwv_flow_api.id(276694826984926432549)
,p_region_template_options=>'#DEFAULT#:t-Region--scrollBody:t-Form--noPadding:t-Form--stretchInputs:t-Form--labelsAbove'
,p_plug_template=>wwv_flow_api.id(276731802563438120445)
,p_plug_display_sequence=>70
,p_plug_new_grid_row=>false
,p_plug_display_point=>'BODY'
,p_plug_query_options=>'DERIVED_REPORT_COLUMNS'
,p_attribute_01=>'N'
,p_attribute_02=>'HTML'
);
wwv_flow_api.create_page_plug(
 p_id=>wwv_flow_api.id(276694842080596432565)
,p_plug_name=>'Parcela Coletiva'
,p_parent_plug_id=>wwv_flow_api.id(276694826984926432549)
,p_region_template_options=>'#DEFAULT#:t-Region--scrollBody:t-Form--noPadding:t-Form--stretchInputs:t-Form--labelsAbove'
,p_plug_template=>wwv_flow_api.id(276731802563438120445)
,p_plug_display_sequence=>120
,p_plug_new_grid_row=>false
,p_plug_display_point=>'BODY'
,p_plug_query_options=>'DERIVED_REPORT_COLUMNS'
,p_plug_display_condition_type=>'NEVER'
,p_attribute_01=>'N'
,p_attribute_02=>'HTML'
);
wwv_flow_api.create_page_plug(
 p_id=>wwv_flow_api.id(276694844053422432567)
,p_plug_name=>unistr('Per\00EDodo de F\00E9rias')
,p_parent_plug_id=>wwv_flow_api.id(276694826984926432549)
,p_region_template_options=>'#DEFAULT#:t-Region--removeHeader:t-Region--scrollBody:t-Form--slimPadding:t-Form--stretchInputs'
,p_plug_template=>wwv_flow_api.id(276731802563438120445)
,p_plug_display_sequence=>10
,p_plug_display_point=>'BODY'
,p_plug_query_options=>'DERIVED_REPORT_COLUMNS'
,p_attribute_01=>'N'
,p_attribute_02=>'HTML'
);
wwv_flow_api.create_page_plug(
 p_id=>wwv_flow_api.id(276694847727728432570)
,p_plug_name=>unistr('1\00AA  Parcela (Programada)')
,p_region_name=>'2_PARCELA1'
,p_parent_plug_id=>wwv_flow_api.id(276694826984926432549)
,p_region_template_options=>'#DEFAULT#:t-Region--scrollBody:t-Form--noPadding:t-Form--stretchInputs:t-Form--labelsAbove'
,p_plug_template=>wwv_flow_api.id(276731802563438120445)
,p_plug_display_sequence=>50
,p_plug_new_grid_row=>false
,p_plug_new_grid_column=>false
,p_plug_display_point=>'BODY'
,p_plug_query_options=>'DERIVED_REPORT_COLUMNS'
,p_attribute_01=>'N'
,p_attribute_02=>'HTML'
);
wwv_flow_api.create_page_plug(
 p_id=>wwv_flow_api.id(276694851294054432574)
,p_plug_name=>unistr('Navega\00E7\00E3o')
,p_region_template_options=>'#DEFAULT#:t-Region--removeHeader:t-Region--scrollBody'
,p_component_template_options=>'#DEFAULT#'
,p_plug_template=>wwv_flow_api.id(276731802563438120445)
,p_plug_display_sequence=>10
,p_plug_display_point=>'REGION_POSITION_01'
,p_menu_id=>wwv_flow_api.id(276632839074297456300)
,p_plug_source_type=>'NATIVE_BREADCRUMB'
,p_menu_template_id=>wwv_flow_api.id(276731823851033120490)
,p_plug_query_options=>'DERIVED_REPORT_COLUMNS'
);
wwv_flow_api.create_page_button(
 p_id=>wwv_flow_api.id(276329676596832718446)
,p_button_sequence=>100
,p_button_plug_id=>wwv_flow_api.id(276694807774550432529)
,p_button_name=>'p78_btn_solicitante'
,p_button_action=>'REDIRECT_PAGE'
,p_button_template_options=>'#DEFAULT#:t-Button--pillEnd:t-Button--gapRight'
,p_button_template_id=>wwv_flow_api.id(276731823238965120486)
,p_button_is_hot=>'Y'
,p_button_image_alt=>'P76 btn solicitante'
,p_button_position=>'BODY'
,p_button_redirect_url=>'f?p=&APP_ID.:13:&SESSION.::&DEBUG.:RP,13:P13_EMP,P13_MAT:&P78_COD_EMP_SOLICITANTE.,&P78_MATRICULA_SOLICITANTE.'
,p_icon_css_classes=>'fa-user'
,p_grid_new_row=>'N'
,p_grid_new_column=>'Y'
,p_grid_column_span=>1
);
wwv_flow_api.create_page_button(
 p_id=>wwv_flow_api.id(265168843970452939554)
,p_button_sequence=>30
,p_button_plug_id=>wwv_flow_api.id(276694816568983432538)
,p_button_name=>'p78_btn_reprovar_1'
,p_button_action=>'REDIRECT_APP'
,p_button_template_options=>'#DEFAULT#:t-Button--danger:t-Button--iconRight'
,p_button_template_id=>wwv_flow_api.id(276731823528756120489)
,p_button_image_alt=>'Reprovar'
,p_button_position=>'REGION_TEMPLATE_CLOSE'
,p_button_redirect_url=>unistr('f?p=REQ_APROV_&P_BASE.:CONFIRMACAO:&SESSION.::&DEBUG.:RP,CONFIRMACAO:P1_COD_REQ,P1_STATUS,P1_TEXTO:&P78_COD_SOLICITACAO.,R,Deseja Reprovar esta requisi\00E7\00E3o? Informe uma justificativa.')
,p_button_condition=>wwv_flow_string.join(wwv_flow_t_varchar2(
'DECLARE',
'',
'CURSOR C0 IS',
'SELECT SIT_REQUISICAO, cod_empresa, cod_solicitacao',
'  FROM REQUISICAO_FERIAS',
' WHERE COD_SOLICITACAO = :p78_cod_solicitacao;',
' ',
'V_C0 C0%ROWTYPE;',
'',
'CURSOR C1 IS',
'/*select mat_aprov',
'  from APROVA_FERIAS',
' where cod_solicitacao = :p78_cod_solicitacao',
'   and cod_emp_aprov = :P_EMPRESA_USER',
'   and mat_aprov = :P_MATRICULA_USER',
'   and status_aprov = ''P'';*/',
'select mat_aprov',
'FROM   APROVA_FERIAS af',
'      WHERE  (EXISTS (SELECT DISTINCT 1',
'      FROM   REQUISICAO_FERIAS RF',
'            ,INFORMACOES_FUNCIONAIS_CAD IFF',
'      WHERE  (EXISTS (SELECT 1',
'                     FROM   SUB_CCUSTO SC',
'                     WHERE  SC.MAT_SUBS = :P_MATRICULA_USER',
'                     AND    SC.COD_EMP_SUBS = :P_EMPRESA_USER',
'                     AND    SC.MAT_GESTOR     = AF.MAT_APROV',
'                     AND    SC.COD_EMP_GESTOR = AF.COD_EMP_APROV',
'                     AND    SC.COD_SUB_CCUSTO = IFF.COD_SUB_CCUSTO',
'                     AND    SC.COD_CCUSTO     = IFF.COD_CCUSTO',
'                     AND    SC.COD_EMPRESA    = IFF.COD_EMPRESA)',
'      OR     EXISTS (SELECT 1',
'                     FROM   CENTRO_DE_CUSTO CC',
'                     WHERE  CC.MATRICULA_SUPLENTE = :P_MATRICULA_USER',
'                     AND    CC.COD_EMP_SUPLENTE = :P_EMPRESA_USER',
'                     AND    CC.MATRICULA_GESTOR = AF.MAT_APROV',
'                     AND    CC.COD_EMP_GESTOR = AF.COD_EMP_APROV',
'                     AND    CC.COD = IFF.COD_CCUSTO',
'                     AND    CC.COD_EMPRESA = IFF.COD_EMPRESA)',
'      OR     EXISTS (SELECT 1',
'FROM   REQUISICAO_FERIAS RF2',
'      ,INFORMACOES_FUNCIONAIS_CAD IFF2',
'      ,CENTRO_DE_CUSTO CC2',
'      ,CENTRO_DE_CUSTO CCS',
'WHERE  CCS.MATRICULA_SUPLENTE = :P_MATRICULA_USER',
'AND    CCS.COD_EMP_SUPLENTE   = :P_EMPRESA_USER',
'AND    CCS.COD                = CC2.COD_CCUSTO_SUPERIOR',
'AND    CCS.COD_EMPRESA        = CC2.COD_EMPRESA',
'AND    CC2.MATRICULA_GESTOR   = RF2.MATRICULA',
'AND    CC2.COD_EMP_GESTOR     = RF2.COD_EMPRESA',
'AND    CC2.COD                = IFF2.COD_CCUSTO',
'AND    CC2.COD_EMPRESA        = IFF2.COD_EMPRESA',
'AND    IFF2.MATRICULA         = RF2.MATRICULA',
'AND    IFF2.COD_EMPRESA       = RF2.COD_EMPRESA',
'AND    RF2.COD_SOLICITACAO    = :p78_cod_solicitacao))',
'      AND    IFF.MATRICULA = RF.MATRICULA',
'      AND    IFF.COD_EMPRESA = RF.COD_EMPRESA',
'      AND    RF.COD_SOLICITACAO = :p78_cod_solicitacao)',
'      OR     (af.mat_aprov     = :P_MATRICULA_USER',
'      AND    af.cod_emp_aprov = :P_EMPRESA_USER))',
'      AND    af.cod_solicitacao  = :p78_cod_solicitacao',
'      and    AF.status_aprov = ''P'';',
'',
'V_C1 C1%ROWTYPE;',
'',
'V_FLG_RETORNO VARCHAR2(1);',
'V_MSG_RETORNO VARCHAR2(4000);',
'',
'BEGIN',
'',
'OPEN C0;',
'FETCH C0 INTO V_C0;',
'CLOSE C0;',
'',
'OPEN C1;',
'FETCH C1 INTO V_C1;',
'CLOSE C1;',
'',
'IF V_C1.MAT_APROV IS NOT NULL AND NVL(V_C0.SIT_REQUISICAO,0) = 1 then-- NOT IN (2,3,6) THEN',
'  ',
'   if :P78_MSG_APROVAR is not null then',
'      RETURN FALSE;',
'   end if;',
'',
'pkg_ferias.Valida_Sequencia(V_C0.cod_empresa, V_C0.cod_solicitacao, :P_EMPRESA_USER, :P_MATRICULA_USER, v_flg_retorno, v_msg_retorno);',
'',
'    IF TRIM(V_MSG_RETORNO) IS NULL THEN',
'        RETURN TRUE;',
'    ELSE',
'        RETURN FALSE;',
'    END IF;',
'',
'ELSE',
'',
'RETURN FALSE;',
'',
'END IF;',
'',
'END;'))
,p_button_condition_type=>'FUNCTION_BODY'
,p_icon_css_classes=>'fa-close'
);
wwv_flow_api.create_page_button(
 p_id=>wwv_flow_api.id(276329682827795718455)
,p_button_sequence=>40
,p_button_plug_id=>wwv_flow_api.id(276694814194714432536)
,p_button_name=>'CANCEL'
,p_button_action=>'REDIRECT_PAGE'
,p_button_template_options=>'#DEFAULT#'
,p_button_template_id=>wwv_flow_api.id(276731823355036120489)
,p_button_image_alt=>'Voltar'
,p_button_position=>'REGION_TEMPLATE_CLOSE'
,p_button_redirect_url=>'f?p=&APP_ID.:77:&SESSION.::&DEBUG.:RP::'
,p_button_condition=>'P_PAGE_BRANCH'
,p_button_condition_type=>'ITEM_IS_NULL'
);
wwv_flow_api.create_page_button(
 p_id=>wwv_flow_api.id(275840406376608316911)
,p_button_sequence=>50
,p_button_plug_id=>wwv_flow_api.id(276694814194714432536)
,p_button_name=>'CANCEL_1'
,p_button_action=>'REDIRECT_PAGE'
,p_button_template_options=>'#DEFAULT#'
,p_button_template_id=>wwv_flow_api.id(276731823355036120489)
,p_button_image_alt=>'Voltar'
,p_button_position=>'REGION_TEMPLATE_CLOSE'
,p_button_redirect_url=>'f?p=&APP_ID.:&P_PAGE_BRANCH.:&SESSION.::&DEBUG.:RP:P_PAGE_BRANCH:'
,p_button_condition=>'P_PAGE_BRANCH'
,p_button_condition_type=>'ITEM_IS_NOT_NULL'
);
wwv_flow_api.create_page_button(
 p_id=>wwv_flow_api.id(276329683306579718455)
,p_button_sequence=>10
,p_button_plug_id=>wwv_flow_api.id(276694814194714432536)
,p_button_name=>'SAVE'
,p_button_static_id=>'#P78_SAVE'
,p_button_action=>'DEFINED_BY_DA'
,p_button_template_options=>'#DEFAULT#'
,p_button_template_id=>wwv_flow_api.id(276731823355036120489)
,p_button_is_hot=>'Y'
,p_button_image_alt=>'Salvar'
,p_button_position=>'REGION_TEMPLATE_CREATE'
,p_warn_on_unsaved_changes=>null
,p_button_condition=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'cursor c1 is',
'select cod_emp_aprov, mat_aprov',
'  from APROVA_FERIAS',
' where cod_solicitacao = :p78_cod_solicitacao',
'   and cod_emp_aprov = :P_EMPRESA_USER',
'   and mat_aprov = :P_MATRICULA_USER;',
'   ',
'v_c1 c1%rowtype;',
'',
'begin',
'',
'open c1;',
'fetch c1 into v_c1;',
'close c1;',
'',
'if (:P78_SIT_REQUISICAO = 1) AND ((:p_perfil in (''FOLHA'',''MASTER'',''REMUNERACAO'',''FOLHA_CALCULO'',''12'',''14'',''FREQUENCIA'')) or (v_c1.mat_aprov is not null and :p_perfil NOT in (''FOLHA'',''MASTER'',''REMUNERACAO'',''FOLHA_CALCULO'',''FREQUENCIA''))) and :p78_rowi'
||'d is not null then',
'return true;',
'elsif :P78_SIT_REQUISICAO = 2 and :p78_rowid is not null then',
'--return false;',
unistr('return true; -- Habilitado, por\00E9m, validar altera\00E7\00E3o de Situa\00E7\00E3o da Requisi\00E7\00E3o.'),
'elsif :P78_SIT_REQUISICAO = 3 and :p78_rowid is not null then',
'return false;',
'elsif :P78_SIT_REQUISICAO = 5 and :p78_rowid is not null and :p_painel <> ''PC'' and (:p_perfil in (''FOLHA'',''MASTER'',''REMUNERACAO'',''FOLHA_CALCULO'',''12'',''14'',''FREQUENCIA'') or v_c1.mat_aprov is not null) then',
'return true;',
'elsif :p_perfil in (''FOLHA'',''MASTER'',''REMUNERACAO'',''FOLHA_CALCULO'',''12'',''14'',''FREQUENCIA'') and :p78_rowid is not null then',
'return true;',
'else',
'return false;',
'end if;',
'',
'end;'))
,p_button_condition_type=>'FUNCTION_BODY'
);
wwv_flow_api.create_page_button(
 p_id=>wwv_flow_api.id(164092319778569616227)
,p_button_sequence=>20
,p_button_plug_id=>wwv_flow_api.id(276694816568983432538)
,p_button_name=>'p78_btn_aprovar_1'
,p_button_action=>'REDIRECT_APP'
,p_button_template_options=>'#DEFAULT#:t-Button--success:t-Button--iconRight'
,p_button_template_id=>wwv_flow_api.id(276731823528756120489)
,p_button_is_hot=>'Y'
,p_button_image_alt=>'Aprovar'
,p_button_position=>'REGION_TEMPLATE_CREATE'
,p_button_redirect_url=>unistr('f?p=REQ_APROV_&P_BASE.:CONFIRMACAO:&SESSION.::&DEBUG.:RP,CONFIRMACAO:P1_COD_REQ,P1_STATUS,P1_TEXTO:&P78_COD_SOLICITACAO.,A,Deseja Aprovar esta requisi\00E7\00E3o? Informe uma justificativa.')
,p_button_condition=>wwv_flow_string.join(wwv_flow_t_varchar2(
'DECLARE',
'',
'CURSOR C0 IS',
'SELECT SIT_REQUISICAO, cod_empresa, cod_solicitacao',
'  FROM REQUISICAO_FERIAS',
' WHERE COD_SOLICITACAO = :p78_cod_solicitacao;',
' ',
'V_C0 C0%ROWTYPE;',
'',
'CURSOR C1 IS',
'/*select mat_aprov',
'  from APROVA_FERIAS',
' where cod_solicitacao = :p78_cod_solicitacao',
'   and cod_emp_aprov = :P_EMPRESA_USER',
'   and mat_aprov = :P_MATRICULA_USER',
'   and status_aprov = ''P'';*/',
'select mat_aprov',
'FROM   APROVA_FERIAS af',
'      WHERE  (EXISTS (SELECT DISTINCT 1',
'      FROM   REQUISICAO_FERIAS RF',
'            ,INFORMACOES_FUNCIONAIS_CAD IFF',
'      WHERE  (EXISTS (SELECT 1',
'                     FROM   SUB_CCUSTO SC',
'                     WHERE  SC.MAT_SUBS = :P_MATRICULA_USER',
'                     AND    SC.COD_EMP_SUBS = :P_EMPRESA_USER',
'                     AND    SC.MAT_GESTOR     = AF.MAT_APROV',
'                     AND    SC.COD_EMP_GESTOR = AF.COD_EMP_APROV',
'                     AND    SC.COD_SUB_CCUSTO = IFF.COD_SUB_CCUSTO',
'                     AND    SC.COD_CCUSTO     = IFF.COD_CCUSTO',
'                     AND    SC.COD_EMPRESA    = IFF.COD_EMPRESA)',
'      OR     EXISTS (SELECT 1',
'                     FROM   CENTRO_DE_CUSTO CC',
'                     WHERE  CC.MATRICULA_SUPLENTE = :P_MATRICULA_USER',
'                     AND    CC.COD_EMP_SUPLENTE = :P_EMPRESA_USER',
'                     AND    CC.MATRICULA_GESTOR = AF.MAT_APROV',
'                     AND    CC.COD_EMP_GESTOR = AF.COD_EMP_APROV',
'                     AND    CC.COD = IFF.COD_CCUSTO',
'                     AND    CC.COD_EMPRESA = IFF.COD_EMPRESA)',
'      OR     EXISTS (SELECT 1',
'FROM   REQUISICAO_FERIAS RF2',
'      ,INFORMACOES_FUNCIONAIS_CAD IFF2',
'      ,CENTRO_DE_CUSTO CC2',
'      ,CENTRO_DE_CUSTO CCS',
'WHERE  CCS.MATRICULA_SUPLENTE = :P_MATRICULA_USER',
'AND    CCS.COD_EMP_SUPLENTE   = :P_EMPRESA_USER',
'AND    CCS.COD                = CC2.COD_CCUSTO_SUPERIOR',
'AND    CCS.COD_EMPRESA        = CC2.COD_EMPRESA',
'AND    CC2.MATRICULA_GESTOR   = RF2.MATRICULA',
'AND    CC2.COD_EMP_GESTOR     = RF2.COD_EMPRESA',
'AND    CC2.COD                = IFF2.COD_CCUSTO',
'AND    CC2.COD_EMPRESA        = IFF2.COD_EMPRESA',
'AND    IFF2.MATRICULA         = RF2.MATRICULA',
'AND    IFF2.COD_EMPRESA       = RF2.COD_EMPRESA',
'AND    RF2.COD_SOLICITACAO    = :p78_cod_solicitacao))',
'      AND    IFF.MATRICULA = RF.MATRICULA',
'      AND    IFF.COD_EMPRESA = RF.COD_EMPRESA',
'      AND    RF.COD_SOLICITACAO = :p78_cod_solicitacao)',
'      OR     (af.mat_aprov     = :P_MATRICULA_USER',
'      AND    af.cod_emp_aprov = :P_EMPRESA_USER))',
'      AND    af.cod_solicitacao  = :p78_cod_solicitacao',
'      and    AF.status_aprov = ''P'';',
'',
'V_C1 C1%ROWTYPE;',
'',
'V_FLG_RETORNO VARCHAR2(1);',
'V_MSG_RETORNO VARCHAR2(4000);',
'',
'BEGIN',
'',
'OPEN C0;',
'FETCH C0 INTO V_C0;',
'CLOSE C0;',
'',
'OPEN C1;',
'FETCH C1 INTO V_C1;',
'CLOSE C1;',
'',
'IF V_C1.MAT_APROV IS NOT NULL AND NVL(V_C0.SIT_REQUISICAO,0) = 1 then-- NOT IN (2,3,6) THEN',
'',
'   if :P78_MSG_APROVAR is not null then',
'      RETURN FALSE;',
'   end if;',
'',
'pkg_ferias.Valida_Sequencia(V_C0.cod_empresa, V_C0.cod_solicitacao, :P_EMPRESA_USER, :P_MATRICULA_USER, v_flg_retorno, v_msg_retorno);',
'',
'    IF TRIM(V_MSG_RETORNO) IS NULL THEN',
'        RETURN TRUE;',
'    ELSE',
'        RETURN FALSE;',
'    END IF;',
'',
'ELSE',
'',
'RETURN FALSE;',
'',
'END IF;',
'',
'END;'))
,p_button_condition_type=>'FUNCTION_BODY'
,p_icon_css_classes=>'fa-check-square-o'
);
wwv_flow_api.create_page_button(
 p_id=>wwv_flow_api.id(276329683628271718456)
,p_button_sequence=>20
,p_button_plug_id=>wwv_flow_api.id(276694814194714432536)
,p_button_name=>'P78_CREATE'
,p_button_static_id=>'P78_CREATE'
,p_button_action=>'DEFINED_BY_DA'
,p_button_template_options=>'#DEFAULT#'
,p_button_template_id=>wwv_flow_api.id(276731823355036120489)
,p_button_is_hot=>'Y'
,p_button_image_alt=>'Criar'
,p_button_position=>'REGION_TEMPLATE_CREATE'
,p_warn_on_unsaved_changes=>null
,p_button_condition=>'P78_ROWID'
,p_button_condition_type=>'ITEM_IS_NULL'
,p_database_action=>'INSERT'
);
wwv_flow_api.create_page_button(
 p_id=>wwv_flow_api.id(274139991250293698014)
,p_button_sequence=>10
,p_button_plug_id=>wwv_flow_api.id(276694826984926432549)
,p_button_name=>'REQ_PESSOAL'
,p_button_action=>'REDIRECT_PAGE'
,p_button_template_options=>'#DEFAULT#:t-Button--iconLeft'
,p_button_template_id=>wwv_flow_api.id(276731823528756120489)
,p_button_image_alt=>unistr('Requisi\00E7\00E3o Pessoal')
,p_button_position=>'REGION_TEMPLATE_EDIT'
,p_button_redirect_url=>'f?p=&APP_ID.:52:&SESSION.:REQ_FERIAS:&DEBUG.:RP,78:P52_COD_EMPRESA,P52_MAT_SUBS,P52_COD_FILIAL,P52_COD_MOT_REQ,P52_COD_VAGA:&P78_COD_EMPRESA.,&P78_MATRICULA.,&P78_FILIAL.,1,&P78_COD_VAGA.'
,p_button_condition=>'P78_HAVERA_REP'
,p_button_condition2=>'S'
,p_button_condition_type=>'VAL_OF_ITEM_IN_COND_EQ_COND2'
,p_icon_css_classes=>'fa-user-plus'
);
wwv_flow_api.create_page_button(
 p_id=>wwv_flow_api.id(276329688656289718463)
,p_button_sequence=>20
,p_button_plug_id=>wwv_flow_api.id(276694820167112432541)
,p_button_name=>'p78_btn_colab'
,p_button_action=>'REDIRECT_PAGE'
,p_button_template_options=>'#DEFAULT#'
,p_button_template_id=>wwv_flow_api.id(276731823238965120486)
,p_button_is_hot=>'Y'
,p_button_image_alt=>'Visualizar'
,p_button_position=>'REGION_TEMPLATE_EDIT'
,p_button_redirect_url=>'f?p=&APP_ID.:13:&SESSION.::&DEBUG.:RP,13:P13_EMP,P13_MAT:&P78_COD_EMPRESA.,&P78_MATRICULA.'
,p_button_condition=>'P78_ROWID'
,p_button_condition_type=>'ITEM_IS_NOT_NULL'
,p_icon_css_classes=>'fa-user'
);
wwv_flow_api.create_page_branch(
 p_id=>wwv_flow_api.id(276329873186622718607)
,p_branch_name=>'(Create) Go To Page 77'
,p_branch_action=>'f?p=&APP_ID.:77:&SESSION.::&DEBUG.:78::&success_msg=#SUCCESS_MSG#'
,p_branch_point=>'AFTER_PROCESSING'
,p_branch_type=>'REDIRECT_URL'
,p_branch_when_button_id=>wwv_flow_api.id(276329683628271718456)
,p_branch_sequence=>20
,p_branch_condition_type=>'FUNCTION_BODY'
,p_branch_condition=>'return (nvl(:P78_FLAG_CTRL,0) = 1 or :P78_HAVERA_REP = ''N'');'
);
end;
/
begin
wwv_flow_api.create_page_branch(
 p_id=>wwv_flow_api.id(274508446327824012428)
,p_branch_name=>'(Create) Go To Page 52'
,p_branch_action=>'f?p=&APP_ID.:52:&SESSION.:REQ_FERIAS:&DEBUG.:78:P52_COD_EMPRESA,P52_MAT_SUBS,P52_COD_MOT_REQ,P52_COD_FILIAL,P52_COD_VAGA:&P78_COD_EMPRESA.,&P78_MATRICULA.,1,&P78_FILIAL.,&P78_COD_VAGA.&success_msg=#SUCCESS_MSG#'
,p_branch_point=>'AFTER_PROCESSING'
,p_branch_type=>'REDIRECT_URL'
,p_branch_when_button_id=>wwv_flow_api.id(276329683628271718456)
,p_branch_sequence=>30
,p_branch_condition_type=>'FUNCTION_BODY'
,p_branch_condition=>'return :P78_HAVERA_REP = ''S'';'
);
wwv_flow_api.create_page_branch(
 p_id=>wwv_flow_api.id(276095271009719577918)
,p_branch_name=>'(Save) Go To Page 77'
,p_branch_action=>'f?p=&APP_ID.:77:&SESSION.::&DEBUG.:78::&success_msg=#SUCCESS_MSG#'
,p_branch_point=>'AFTER_PROCESSING'
,p_branch_type=>'REDIRECT_URL'
,p_branch_when_button_id=>wwv_flow_api.id(276329683306579718455)
,p_branch_sequence=>40
,p_branch_condition_type=>'ITEM_IS_NULL'
,p_branch_condition=>'P_PAGE_BRANCH'
);
wwv_flow_api.create_page_branch(
 p_id=>wwv_flow_api.id(276097250772355226615)
,p_branch_name=>'Go To Page 24'
,p_branch_action=>'f?p=&APP_ID.:&P_PAGE_BRANCH.:&SESSION.::&DEBUG.::P_PAGE_BRANCH:&success_msg=#SUCCESS_MSG#'
,p_branch_point=>'AFTER_PROCESSING'
,p_branch_type=>'REDIRECT_URL'
,p_branch_sequence=>50
,p_branch_condition_type=>'ITEM_IS_NOT_NULL'
,p_branch_condition=>'P_PAGE_BRANCH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(95629943043903503857)
,p_name=>'P78_OPCAO_FERIAS_CARREGA'
,p_item_sequence=>20
,p_item_plug_id=>wwv_flow_api.id(276461660456670611285)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(95629945537792503882)
,p_name=>'P78_OPCAO_FERIAS_DB'
,p_item_sequence=>40
,p_item_plug_id=>wwv_flow_api.id(276461660456670611285)
,p_use_cache_before_default=>'NO'
,p_source=>'OPCAO_FERIAS'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(102030463790012232644)
,p_name=>'P78_SHOW_HIDE'
,p_item_sequence=>60
,p_item_plug_id=>wwv_flow_api.id(276694820167112432541)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(102643516950072340607)
,p_name=>'P78_LOAD'
,p_item_sequence=>30
,p_item_plug_id=>wwv_flow_api.id(276694814194714432536)
,p_display_as=>'NATIVE_HIDDEN'
,p_encrypt_session_state_yn=>'Y'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(121626765150856574274)
,p_name=>'P78_MATRICULA_SOLIC'
,p_item_sequence=>10
,p_item_plug_id=>wwv_flow_api.id(276694844053422432567)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(121626765310316574275)
,p_name=>'P78_EMP_SOLIC'
,p_item_sequence=>10
,p_item_plug_id=>wwv_flow_api.id(276694844053422432567)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(126314456951795063609)
,p_name=>'P78_DT_1'
,p_item_sequence=>30
,p_item_plug_id=>wwv_flow_api.id(276694832970995432555)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(126314457577815063615)
,p_name=>'P78_DT_2'
,p_item_sequence=>20
,p_item_plug_id=>wwv_flow_api.id(276694838117800432559)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(126314457957000063619)
,p_name=>'P78_DT_4'
,p_item_sequence=>20
,p_item_plug_id=>wwv_flow_api.id(276559150703399823134)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(138737276019629217767)
,p_name=>'P78_ALERT_ACAO_JURIDICO'
,p_item_sequence=>40
,p_item_plug_id=>wwv_flow_api.id(276694820167112432541)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(143343626085147737827)
,p_name=>'P78_CTRL_LIMITE'
,p_item_sequence=>120
,p_item_plug_id=>wwv_flow_api.id(276694814194714432536)
,p_item_default=>'S'
,p_display_as=>'NATIVE_HIDDEN'
,p_display_when_type=>'NEVER'
,p_warn_on_unsaved_changes=>'I'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(143343626995574737836)
,p_name=>'P78_MSG_LIMITE'
,p_item_sequence=>110
,p_item_plug_id=>wwv_flow_api.id(276694814194714432536)
,p_item_default=>'S'
,p_display_as=>'NATIVE_HIDDEN'
,p_display_when_type=>'NEVER'
,p_warn_on_unsaved_changes=>'I'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(143343627872379737844)
,p_name=>'P78_DT_RETORNO_PARC1_1_AUX'
,p_item_sequence=>80
,p_item_plug_id=>wwv_flow_api.id(276694847727728432570)
,p_display_as=>'NATIVE_HIDDEN'
,p_warn_on_unsaved_changes=>'I'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(152825790362123554929)
,p_name=>'P78_DT_RETORNO_PARC1_1A'
,p_item_sequence=>90
,p_item_plug_id=>wwv_flow_api.id(276694847727728432570)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(165947101929645326203)
,p_name=>'P78_OP'
,p_item_sequence=>100
,p_item_plug_id=>wwv_flow_api.id(276694814194714432536)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(173363194985154845024)
,p_name=>'P78_EMP_A'
,p_item_sequence=>60
,p_item_plug_id=>wwv_flow_api.id(276694814194714432536)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'Y'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(173363195117313845025)
,p_name=>'P78_MAT_A'
,p_item_sequence=>70
,p_item_plug_id=>wwv_flow_api.id(276694814194714432536)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'Y'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(173363195594260845030)
,p_name=>'P78_MATRICULA_1'
,p_item_sequence=>70
,p_item_plug_id=>wwv_flow_api.id(276694820167112432541)
,p_prompt=>'Colaborador'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_tag_attributes=>'readonly'
,p_begin_on_new_line=>'N'
,p_grid_label_column_span=>1
,p_display_when=>'return nvl(:P78_FLAG_CTRL,0) = 1;'
,p_display_when_type=>'FUNCTION_BODY'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(173363197010889845044)
,p_name=>'P78_COD_REQ'
,p_item_sequence=>80
,p_item_plug_id=>wwv_flow_api.id(276694814194714432536)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'Y'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(173363197978223845054)
,p_name=>'P78_IND_SITUACAO_PERIODO_A'
,p_item_sequence=>70
,p_item_plug_id=>wwv_flow_api.id(276694844053422432567)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(173363803474644608726)
,p_name=>'P78_IND_SITUACAO_PARC_2_A'
,p_item_sequence=>90
,p_item_plug_id=>wwv_flow_api.id(276694844053422432567)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(173363803547151608727)
,p_name=>'P78_IND_SITUACAO_PARC_4_A'
,p_item_sequence=>110
,p_item_plug_id=>wwv_flow_api.id(276694844053422432567)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(173363804294555608734)
,p_name=>'P78_MSG_APROVAR'
,p_item_sequence=>90
,p_item_plug_id=>wwv_flow_api.id(276694814194714432536)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(173363804871530608740)
,p_name=>'P78_FLAG_CTRL_A'
,p_item_sequence=>50
,p_item_plug_id=>wwv_flow_api.id(276694814194714432536)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'Y'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(173363805520981608747)
,p_name=>'P78_COD_EMPRESA_1'
,p_item_sequence=>30
,p_item_plug_id=>wwv_flow_api.id(276694820167112432541)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(173363806369880608755)
,p_name=>'P78_OPCAO_FERIAS_A'
,p_item_sequence=>50
,p_item_plug_id=>wwv_flow_api.id(276461660456670611285)
,p_prompt=>unistr('Op\00E7\00F5es de Programa\00E7\00E3o de F\00E9rias')
,p_display_as=>'NATIVE_SELECT_LIST'
,p_lov=>wwv_flow_string.join(wwv_flow_t_varchar2(
'select 	f.qtd_parcelas||'' ''||'' Parcela(s): ''||f.descricao descricao, ',
'		f.cod',
'  from ferias_parametros_parcelas f'))
,p_cHeight=>1
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_lov_display_extra=>'NO'
,p_attribute_01=>'NONE'
,p_attribute_02=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(175208621449896783769)
,p_name=>'P78_FLAG_CTRL'
,p_item_sequence=>40
,p_item_plug_id=>wwv_flow_api.id(276694814194714432536)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(177040933922266807372)
,p_name=>'P78_DIAS_ABONO_PEC1_OPC'
,p_item_sequence=>60
,p_item_plug_id=>wwv_flow_api.id(276461660456670611285)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(239780948931870757201)
,p_name=>'P78_TESTE'
,p_item_sequence=>170
,p_item_plug_id=>wwv_flow_api.id(276694832970995432555)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(239790693265991698902)
,p_name=>'P78_TESTE_2'
,p_item_sequence=>180
,p_item_plug_id=>wwv_flow_api.id(276694832970995432555)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(239790693597263698905)
,p_name=>'P78_TESTE_3'
,p_item_sequence=>190
,p_item_plug_id=>wwv_flow_api.id(276694832970995432555)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(239790693905474698908)
,p_name=>'P78_TESTE_DEFAULT'
,p_item_sequence=>200
,p_item_plug_id=>wwv_flow_api.id(276694832970995432555)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(265271830004327197426)
,p_name=>'P78_MESES_ADM'
,p_item_sequence=>80
,p_item_plug_id=>wwv_flow_api.id(276694820167112432541)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(266531491837413144462)
,p_name=>'P78_VINCULO'
,p_item_sequence=>90
,p_item_plug_id=>wwv_flow_api.id(276694820167112432541)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(266554986397766898035)
,p_name=>'P78_DT_SIT_SOLICITACAO'
,p_item_sequence=>190
,p_item_plug_id=>wwv_flow_api.id(276694807774550432529)
,p_use_cache_before_default=>'NO'
,p_source=>'DT_SIT_SOLICITACAO'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(267657812367775603617)
,p_name=>'P78_OBSERVACAO'
,p_item_sequence=>170
,p_item_plug_id=>wwv_flow_api.id(276694807774550432529)
,p_use_cache_before_default=>'NO'
,p_prompt=>unistr('Observa\00E7\00E3o')
,p_source=>'OBSERVACAO'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_DISPLAY_ONLY'
,p_grid_label_column_span=>2
,p_display_when=>'P78_OBSERVACAO'
,p_display_when_type=>'ITEM_IS_NOT_NULL'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'Y'
,p_attribute_02=>'VALUE'
,p_attribute_04=>'Y'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(270633346538934216716)
,p_name=>'P78_IND_SITUACAO_PARC_2'
,p_item_sequence=>80
,p_item_plug_id=>wwv_flow_api.id(276694844053422432567)
,p_use_cache_before_default=>'NO'
,p_source=>'IND_SITUACAO_PARC_2'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(270633346643044216717)
,p_name=>'P78_IND_SITUACAO_PARC_4'
,p_item_sequence=>100
,p_item_plug_id=>wwv_flow_api.id(276694844053422432567)
,p_use_cache_before_default=>'NO'
,p_source=>'IND_SITUACAO_PARC_4'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(274139991578382698017)
,p_name=>'P78_COD_VAGA'
,p_item_sequence=>100
,p_item_plug_id=>wwv_flow_api.id(276694820167112432541)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276087116336831291512)
,p_name=>'P78_DT_LIMITE_REQ'
,p_item_sequence=>170
,p_item_plug_id=>wwv_flow_api.id(276694844053422432567)
,p_prompt=>unistr('Data Limite In\00EDcio das F\00E9rias')
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_colspan=>6
,p_grid_label_column_span=>3
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'Y'
,p_attribute_03=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276296489561284891341)
,p_name=>'P78_DIAS_DIREITO_OPC'
,p_item_sequence=>10
,p_item_plug_id=>wwv_flow_api.id(276461660456670611285)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329676996948718447)
,p_name=>'P78_COD_SOLICITACAO'
,p_item_sequence=>10
,p_item_plug_id=>wwv_flow_api.id(276694807774550432529)
,p_use_cache_before_default=>'NO'
,p_prompt=>unistr('Requisi\00E7\00E3o')
,p_source=>'COD_SOLICITACAO'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_grid_label_column_span=>2
,p_read_only_when=>'P78_ROWID'
,p_read_only_when_type=>'ITEM_IS_NOT_NULL'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329677389300718449)
,p_name=>'P78_TITULO'
,p_item_sequence=>10
,p_item_plug_id=>wwv_flow_api.id(276694807774550432529)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329677744963718449)
,p_name=>'P78_ROWID'
,p_item_sequence=>20
,p_item_plug_id=>wwv_flow_api.id(276694807774550432529)
,p_use_cache_before_default=>'NO'
,p_source=>'ROWID'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'Y'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329678158077718450)
,p_name=>'P78_DT_SOLICITACAO'
,p_item_sequence=>30
,p_item_plug_id=>wwv_flow_api.id(276694807774550432529)
,p_use_cache_before_default=>'NO'
,p_prompt=>'Data'
,p_source=>'DT_SOLICITACAO'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_DATE_PICKER'
,p_cSize=>30
,p_begin_on_new_line=>'N'
,p_colspan=>3
,p_grid_label_column_span=>1
,p_read_only_when=>'P78_ROWID'
,p_read_only_when_type=>'ITEM_IS_NOT_NULL'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_04=>'button'
,p_attribute_05=>'N'
,p_attribute_07=>'NONE'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329678600990718450)
,p_name=>'P78_FLAG'
,p_item_sequence=>30
,p_item_plug_id=>wwv_flow_api.id(276694807774550432529)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329678996510718451)
,p_name=>'P78_SIT_REQUISICAO'
,p_item_sequence=>40
,p_item_plug_id=>wwv_flow_api.id(276694807774550432529)
,p_use_cache_before_default=>'NO'
,p_prompt=>unistr('Situa\00E7\00E3o')
,p_source=>'SIT_REQUISICAO'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_SELECT_LIST'
,p_lov=>unistr('STATIC:Aberta;1,Conclu\00EDda;2,Cancelada;3,Reprovada;4,Aprovada;5,Suspensa;6')
,p_cHeight=>1
,p_begin_on_new_line=>'N'
,p_grid_label_column_span=>2
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_lov_display_extra=>'YES'
,p_attribute_01=>'NONE'
,p_attribute_02=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329679325533718451)
,p_name=>'P78_MENSAGEM'
,p_item_sequence=>40
,p_item_plug_id=>wwv_flow_api.id(276694807774550432529)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329679763155718452)
,p_name=>'P78_SOLICITANTE'
,p_item_sequence=>90
,p_item_plug_id=>wwv_flow_api.id(276694807774550432529)
,p_prompt=>'Solicitante'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_grid_label_column_span=>2
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'Y'
,p_attribute_03=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329680208095718452)
,p_name=>'P78_USUARIO'
,p_item_sequence=>120
,p_item_plug_id=>wwv_flow_api.id(276694807774550432529)
,p_use_cache_before_default=>'NO'
,p_prompt=>unistr('Usu\00E1rio')
,p_source=>'USUARIO'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_DISPLAY_ONLY'
,p_grid_label_column_span=>2
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'Y'
,p_attribute_02=>'VALUE'
,p_attribute_04=>'Y'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329680527474718452)
,p_name=>'P78_COD_EMP_SOLICITANTE'
,p_item_sequence=>130
,p_item_plug_id=>wwv_flow_api.id(276694807774550432529)
,p_use_cache_before_default=>'NO'
,p_source=>'COD_EMP_SOLICITANTE'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329680936903718453)
,p_name=>'P78_USUARIO_PROG'
,p_item_sequence=>140
,p_item_plug_id=>wwv_flow_api.id(276694807774550432529)
,p_use_cache_before_default=>'NO'
,p_source=>'USUARIO_PROG'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329681364117718453)
,p_name=>'P78_MATRICULA_SOLICITANTE'
,p_item_sequence=>150
,p_item_plug_id=>wwv_flow_api.id(276694807774550432529)
,p_use_cache_before_default=>'NO'
,p_source=>'MATRICULA_SOLICITANTE'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329681791980718454)
,p_name=>'P78_DT_ATUALIZACAO'
,p_item_sequence=>160
,p_item_plug_id=>wwv_flow_api.id(276694807774550432529)
,p_use_cache_before_default=>'NO'
,p_prompt=>unistr('Data de Atualiza\00E7\00E3o')
,p_source=>'DT_ATUALIZACAO'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_DISPLAY_ONLY'
,p_begin_on_new_line=>'N'
,p_grid_label_column_span=>2
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'Y'
,p_attribute_02=>'VALUE'
,p_attribute_04=>'Y'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329682127946718454)
,p_name=>'P78_DT_ATUALIZACAO_PROG'
,p_item_sequence=>180
,p_item_plug_id=>wwv_flow_api.id(276694807774550432529)
,p_use_cache_before_default=>'NO'
,p_source=>'DT_ATUALIZACAO_PROG'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329684075374718456)
,p_name=>'P78_ITEM_VALIDACAO'
,p_item_sequence=>10
,p_item_plug_id=>wwv_flow_api.id(276694814194714432536)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329684485954718457)
,p_name=>'P78_OK'
,p_item_sequence=>20
,p_item_plug_id=>wwv_flow_api.id(276694814194714432536)
,p_display_as=>'NATIVE_HIDDEN'
,p_encrypt_session_state_yn=>'Y'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329689095167718463)
,p_name=>'P78_COD_EMPRESA'
,p_item_sequence=>20
,p_item_plug_id=>wwv_flow_api.id(276694820167112432541)
,p_use_cache_before_default=>'NO'
,p_prompt=>'Empresa'
,p_source=>'COD_EMPRESA'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_SELECT_LIST'
,p_lov=>wwv_flow_string.join(wwv_flow_t_varchar2(
'SELECT COD||'' - ''||INITCAP(NOME) DESCRICAO, COD',
'  FROM EMPRESAS',
'where ((nvl(dt_encerramento,trunc(sysdate)) >= trunc(sysdate)',
'    and :P78_COD_SOLICITACAO is null) or ',
'        (:P78_COD_SOLICITACAO is not null)) ',
'    and (:p_Painel <> ''PC'' or (:p_painel = ''PC'' and cod = :p_empresa_user))',
' ORDER BY 2'))
,p_lov_display_null=>'YES'
,p_lov_null_text=>'- Selecione -'
,p_lov_cascade_parent_items=>'P78_COD_SOLICITACAO'
,p_ajax_optimize_refresh=>'N'
,p_cHeight=>1
,p_begin_on_new_line=>'N'
,p_grid_label_column_span=>1
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_lov_display_extra=>'YES'
,p_attribute_01=>'NONE'
,p_attribute_02=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329689519687718464)
,p_name=>'P78_MATRICULA'
,p_is_required=>true
,p_item_sequence=>50
,p_item_plug_id=>wwv_flow_api.id(276694820167112432541)
,p_use_cache_before_default=>'NO'
,p_prompt=>'Colaborador'
,p_source=>'MATRICULA'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_POPUP_LOV'
,p_lov=>'select N DESCRICAO, I MATRICULA from pkg_list_matricula.fnc_list2(:p78_cod_empresa, :p_Painel, :p_empresa_user, :p_matricula_user)'
,p_lov_display_null=>'YES'
,p_lov_null_text=>'- Selecione -'
,p_lov_cascade_parent_items=>'P78_COD_EMPRESA'
,p_ajax_items_to_submit=>'P78_COD_EMPRESA'
,p_ajax_optimize_refresh=>'N'
,p_cSize=>30
,p_begin_on_new_line=>'N'
,p_grid_label_column_span=>1
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_lov_display_extra=>'YES'
,p_attribute_01=>'DIALOG'
,p_attribute_02=>'NO_FETCH'
,p_attribute_03=>'N'
,p_attribute_04=>'N'
,p_attribute_05=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329689875672718464)
,p_name=>'P78_OPCAO_PARC_SN'
,p_item_sequence=>110
,p_item_plug_id=>wwv_flow_api.id(276694820167112432541)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329690274714718464)
,p_name=>'P78_DC_MATRICULA'
,p_item_sequence=>120
,p_item_plug_id=>wwv_flow_api.id(276694820167112432541)
,p_use_cache_before_default=>'NO'
,p_source=>'DC_MATRICULA'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329690639280718465)
,p_name=>'P78_EMP'
,p_item_sequence=>130
,p_item_plug_id=>wwv_flow_api.id(276694820167112432541)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'Y'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329691027751718465)
,p_name=>'P78_MAT'
,p_item_sequence=>140
,p_item_plug_id=>wwv_flow_api.id(276694820167112432541)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'Y'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329691499211718465)
,p_name=>'P78_FILIAL'
,p_item_sequence=>150
,p_item_plug_id=>wwv_flow_api.id(276694820167112432541)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329691909621718466)
,p_name=>'P78_IND_DUPLO_VINCULO'
,p_item_sequence=>160
,p_item_plug_id=>wwv_flow_api.id(276694820167112432541)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329692302995718466)
,p_name=>'P78_DATA_REF'
,p_item_sequence=>170
,p_item_plug_id=>wwv_flow_api.id(276694820167112432541)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329692677584718467)
,p_name=>'P78_SALDO_FER_MIN'
,p_item_sequence=>180
,p_item_plug_id=>wwv_flow_api.id(276694820167112432541)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329693392670718467)
,p_name=>'P78_FOTO_COLAB'
,p_item_sequence=>10
,p_item_plug_id=>wwv_flow_api.id(276694824180725432544)
,p_display_as=>'NATIVE_DISPLAY_IMAGE'
,p_tag_css_classes=>'fotoColabMed'
,p_grid_label_column_span=>0
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'SQL'
,p_attribute_06=>wwv_flow_string.join(wwv_flow_t_varchar2(
'select foto',
'  from fotos',
' where cod_empresa = :p78_cod_empresa',
'   and matricula = :p78_matricula;'))
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329694029726718468)
,p_name=>'P78_COD_EMPRESA_DISPLAY'
,p_item_sequence=>20
,p_item_plug_id=>wwv_flow_api.id(276694824999993432545)
,p_prompt=>'Empresa'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_begin_on_new_line=>'N'
,p_grid_label_column_span=>1
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'Y'
,p_attribute_03=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329694421391718468)
,p_name=>'P78_MATRICULA_DISPLAY'
,p_item_sequence=>30
,p_item_plug_id=>wwv_flow_api.id(276694824999993432545)
,p_prompt=>'Colaborador'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_begin_on_new_line=>'N'
,p_grid_label_column_span=>1
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'Y'
,p_attribute_03=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329694905163718468)
,p_name=>'P78_SITUACAO_COLAB'
,p_item_sequence=>40
,p_item_plug_id=>wwv_flow_api.id(276694824999993432545)
,p_prompt=>unistr('Situa\00E7\00E3o')
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_grid_label_column_span=>1
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'Y'
,p_attribute_03=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329695318377718469)
,p_name=>'P78_DT_ADMISSAO'
,p_item_sequence=>50
,p_item_plug_id=>wwv_flow_api.id(276694824999993432545)
,p_prompt=>unistr('Data de Admiss\00E3o')
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_begin_on_new_line=>'N'
,p_grid_label_column_span=>1
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'Y'
,p_attribute_03=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329695962871718469)
,p_name=>'P78_QTD_PARCELAS'
,p_item_sequence=>70
,p_item_plug_id=>wwv_flow_api.id(276694826984926432549)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329696683198718470)
,p_name=>'P78_OPCAO_FERIAS'
,p_item_sequence=>30
,p_item_plug_id=>wwv_flow_api.id(276461660456670611285)
,p_prompt=>unistr('Op\00E7\00F5es de Programa\00E7\00E3o de F\00E9rias')
,p_display_as=>'NATIVE_SELECT_LIST'
,p_lov=>wwv_flow_string.join(wwv_flow_t_varchar2(
'select N descricao, i cod',
'  from pkg_list.fnc_list_opc_prog_ferias(P_cod_empresa => :P78_cod_empresa,',
'                                              P_matricula => :P78_matricula,',
'                                              p_filial => :p78_filial,',
'                                              p_DT_INIC_PER_FERIAS => nvl(:P78_DT_INIC_PER_FERIAS,:P78_DT_INIC_PER_FERIAS_1),',
'                                              p_QTD_PARCELAS => :p78_QTD_PARCELAS,',
'                                              P_DIAS_DIREITO_OPC => :P78_DIAS_DIREITO_OPC,',
'                                              P_DIAS_DIREITO_1 => :P78_DIAS_DIREITO_1,',
'                                              P_FLAG_CTRL => :P78_FLAG_CTRL,',
'                                              p_meses_adm => :p78_meses_adm)'))
,p_lov_display_null=>'YES'
,p_lov_null_text=>'- Selecione -'
,p_lov_cascade_parent_items=>'P78_DT_INIC_PER_FERIAS,P78_MATRICULA,P78_COD_EMPRESA,P78_FILIAL,P78_QTD_PARCELAS,P78_DIAS_DIREITO_OPC,P78_DIAS_DIREITO_1,P78_MESES_ADM'
,p_ajax_optimize_refresh=>'N'
,p_cHeight=>1
,p_grid_label_column_span=>3
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_lov_display_extra=>'NO'
,p_attribute_01=>'NONE'
,p_attribute_02=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329697091594718471)
,p_name=>'P78_OPCAO_FERIAS_1'
,p_item_sequence=>70
,p_item_plug_id=>wwv_flow_api.id(276461660456670611285)
,p_prompt=>unistr('Op\00E7\00F5es de Programa\00E7\00E3o de F\00E9rias')
,p_source=>'P78_OPCAO_FERIAS_DB'
,p_source_type=>'ITEM'
,p_display_as=>'NATIVE_SELECT_LIST'
,p_lov=>wwv_flow_string.join(wwv_flow_t_varchar2(
'select distinct f.qtd_parcelas||'' Parcela(s): ''||f.descricao descricao, f.cod',
'  from ferias_parametros_parcelas f',
' where f.cod_empresa = :p78_cod_empresa',
'   and f.cod_filial = :p78_filial',
'   and f.dias_direito = nvl(:P78_DIAS_DIREITO_1,:P78_DIAS_DIREITO_OPC)',
'order by 1'))
,p_lov_display_null=>'YES'
,p_lov_cascade_parent_items=>'P78_COD_EMPRESA,P78_FILIAL,P78_DIAS_DIREITO_1,P78_DIAS_DIREITO_OPC'
,p_ajax_optimize_refresh=>'N'
,p_cHeight=>1
,p_grid_label_column_span=>3
,p_display_when=>wwv_flow_string.join(wwv_flow_t_varchar2(
'select 1 -- Igor 30/03',
'  from ferias_parametros_parcelas f',
' where f.cod_empresa = :p78_cod_empresa',
'   and f.cod_filial = :p78_filial'))
,p_display_when_type=>'EXISTS'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_lov_display_extra=>'YES'
,p_attribute_01=>'NONE'
,p_attribute_02=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329697505141718471)
,p_name=>'P78_PARCELAS_OPC'
,p_item_sequence=>80
,p_item_plug_id=>wwv_flow_api.id(276461660456670611285)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329697882354718471)
,p_name=>'P78_HAVERA_REP'
,p_item_sequence=>90
,p_item_plug_id=>wwv_flow_api.id(276461660456670611285)
,p_use_cache_before_default=>'NO'
,p_prompt=>unistr('Haver\00E1 Reposi\00E7\00E3o?')
,p_source=>'HAVERA_REP'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_SELECT_LIST'
,p_lov=>unistr('STATIC:Sim;S,N\00E3o;N')
,p_cHeight=>1
,p_colspan=>4
,p_grid_label_column_span=>3
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_lov_display_extra=>'YES'
,p_attribute_01=>'NONE'
,p_attribute_02=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329698544911718473)
,p_name=>'P78_DT_SAIDA_PARC2_1'
,p_item_sequence=>10
,p_item_plug_id=>wwv_flow_api.id(276465208681842959609)
,p_prompt=>unistr('Data da Sa\00EDda')
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_begin_on_new_line=>'N'
,p_begin_on_new_field=>'N'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329698974654718473)
,p_name=>'P78_NUM_DIAS_PARC2_1'
,p_item_sequence=>40
,p_item_plug_id=>wwv_flow_api.id(276465208681842959609)
,p_prompt=>unistr('N\00FAmero de Dias')
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329699411085718473)
,p_name=>'P78_DIAS_ABONO_PEC2_1'
,p_item_sequence=>50
,p_item_plug_id=>wwv_flow_api.id(276465208681842959609)
,p_prompt=>'Dias de Abono'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329699757015718474)
,p_name=>'P78_OPCAO_13SAL2_1'
,p_item_sequence=>60
,p_item_plug_id=>wwv_flow_api.id(276465208681842959609)
,p_prompt=>unistr('13\00BA Sal\00E1rio')
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
end;
/
begin
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329700124977718474)
,p_name=>'P78_DESC_ADICIONAL2_1'
,p_item_sequence=>70
,p_item_plug_id=>wwv_flow_api.id(276465208681842959609)
,p_prompt=>unistr('B\00F4nus F\00E9rias')
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_display_when=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'    cursor c1 is',
'    select abono_ferias bonus_ferias',
'      from ferias_parametros',
'     where cod_empresa = :p78_cod_empresa',
'       and cod_filial = :p78_filial;',
'       ',
'    v_c1 c1%rowtype;',
'',
'begin',
'',
'    open c1;',
'    fetch c1 into v_c1;',
'    close c1;',
'    ',
'    if v_c1.bonus_ferias > 0 then',
'    return true;',
'    else ',
'    return false;',
'    end if;',
'',
'end;'))
,p_display_when_type=>'FUNCTION_BODY'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329700541271718474)
,p_name=>'P78_DT_RETORNO_PARC2_1'
,p_item_sequence=>80
,p_item_plug_id=>wwv_flow_api.id(276465208681842959609)
,p_prompt=>'Data de Retorno'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329700969901718474)
,p_name=>'P78_DT_PAGTO_PARC2_1'
,p_item_sequence=>90
,p_item_plug_id=>wwv_flow_api.id(276465208681842959609)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329701367404718475)
,p_name=>'P78_TIPO_FERIAS2_1'
,p_item_sequence=>100
,p_item_plug_id=>wwv_flow_api.id(276465208681842959609)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329702051369718475)
,p_name=>'P78_DT_SAIDA_PARC4_1'
,p_item_sequence=>10
,p_item_plug_id=>wwv_flow_api.id(276465209599486959618)
,p_prompt=>unistr('Data da Sa\00EDda')
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_begin_on_new_line=>'N'
,p_begin_on_new_field=>'N'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329702510435718476)
,p_name=>'P78_NUM_DIAS_PARC4_1'
,p_item_sequence=>20
,p_item_plug_id=>wwv_flow_api.id(276465209599486959618)
,p_prompt=>unistr('N\00FAmero de Dias')
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329702830778718476)
,p_name=>'P78_DIAS_ABONO_PEC4_1'
,p_item_sequence=>30
,p_item_plug_id=>wwv_flow_api.id(276465209599486959618)
,p_prompt=>'Dias de Abono'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329703258250718476)
,p_name=>'P78_OPCAO_13SAL4_1'
,p_item_sequence=>40
,p_item_plug_id=>wwv_flow_api.id(276465209599486959618)
,p_prompt=>unistr('13\00BA Sal\00E1rio')
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329703630246718476)
,p_name=>'P78_DESC_ADICIONAL4_1'
,p_item_sequence=>50
,p_item_plug_id=>wwv_flow_api.id(276465209599486959618)
,p_prompt=>unistr('B\00F4nus F\00E9rias')
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_display_when=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'    cursor c1 is',
'    select abono_ferias bonus_ferias',
'      from ferias_parametros',
'     where cod_empresa = :p78_cod_empresa',
'       and cod_filial = :p78_filial;',
'       ',
'    v_c1 c1%rowtype;',
'',
'begin',
'',
'    open c1;',
'    fetch c1 into v_c1;',
'    close c1;',
'    ',
'    if v_c1.bonus_ferias > 0 then',
'    return true;',
'    else ',
'    return false;',
'    end if;',
'',
'end;'))
,p_display_when_type=>'FUNCTION_BODY'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329704060546718477)
,p_name=>'P78_DT_RETORNO_PARC4_1'
,p_item_sequence=>60
,p_item_plug_id=>wwv_flow_api.id(276465209599486959618)
,p_prompt=>'Data de Retorno'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329704478279718477)
,p_name=>'P78_DT_PAGTO_PARC4_1'
,p_item_sequence=>70
,p_item_plug_id=>wwv_flow_api.id(276465209599486959618)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329704857117718477)
,p_name=>'P78_TIPO_FERIAS4_1'
,p_item_sequence=>80
,p_item_plug_id=>wwv_flow_api.id(276465209599486959618)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329705618319718478)
,p_name=>'P78_DT_SAIDA_PARC4'
,p_item_sequence=>10
,p_item_plug_id=>wwv_flow_api.id(276559150703399823134)
,p_use_cache_before_default=>'NO'
,p_prompt=>unistr('Data da Sa\00EDda')
,p_source=>'DT_SAIDA_PARC4'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_DATE_PICKER'
,p_cSize=>30
,p_begin_on_new_line=>'N'
,p_begin_on_new_field=>'N'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_04=>'both'
,p_attribute_05=>'N'
,p_attribute_07=>'NONE'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329705969265718478)
,p_name=>'P78_NUM_DIAS_PARC4'
,p_item_sequence=>30
,p_item_plug_id=>wwv_flow_api.id(276559150703399823134)
,p_use_cache_before_default=>'NO'
,p_prompt=>unistr('N\00FAmero de Dias')
,p_source=>'NUM_DIAS_PARC4'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329706409337718478)
,p_name=>'P78_NUM_DIAS_PARC4_LST'
,p_item_sequence=>40
,p_item_plug_id=>wwv_flow_api.id(276559150703399823134)
,p_prompt=>unistr('N\00FAmero de Dias')
,p_display_as=>'NATIVE_SELECT_LIST'
,p_lov=>wwv_flow_string.join(wwv_flow_t_varchar2(
'select N DESCRICAO, I DIAS ',
' from pkg_list_matricula.fnc_list_numdias(',
'                            :P78_COD_EMPRESA,',
'                            :P78_FILIAL,',
'                            nvl(:P78_OPCAO_FERIAS,:P78_OPCAO_FERIAS_A),',
'                            :P78_PARCELAS_OPC,',
'                            nvl(:P78_MESES_ADM,12),',
'                            nvl(:P78_NUM_DIAS_PARC1_LST,:P78_NUM_DIAS_PARC1_1),',
'                            nvl(:P78_NUM_DIAS_PARC2_LST,:P78_NUM_DIAS_PARC2_1))',
'/*',
'select  distinct',
'        X.DESCRICAO,',
'        X.DIAS',
'from    (',
'        select  decode(B.NLIN,1,A.NUM_DIAS_PARC1,2,A.NUM_DIAS_PARC2,3,A.NUM_DIAS_PARC4) DESCRICAO,',
'                decode(B.NLIN,1,A.NUM_DIAS_PARC1,2,A.NUM_DIAS_PARC2,3,A.NUM_DIAS_PARC4) DIAS,',
'                (nvl(A.NUM_DIAS_PARC4,0)+nvl(A.NUM_DIAS_PARC2,0)+nvl(A.NUM_DIAS_PARC1,0)) -',
'                (nvl(:P78_NUM_DIAS_PARC1_LST,0)+nvl(:P78_NUM_DIAS_PARC2_LST,0)) C2',
'        from    FERIAS_PARAMETROS_PARCELAS A,',
'                (select rownum NLIN from dual connect by level <= :P78_PARCELAS_OPC) B',
'        where   (',
'                    instr('';''||:P78_NUM_DIAS_PARC1_LST||'';''||:P78_NUM_DIAS_PARC2_LST||'';'','';''||decode(B.NLIN,1,A.NUM_DIAS_PARC1,2,A.NUM_DIAS_PARC2,3,A.NUM_DIAS_PARC4)||'';'') = 0 or',
'                    (instr('';''||:P78_NUM_DIAS_PARC1_LST||'';''||:P78_NUM_DIAS_PARC2_LST||'';'','';''||decode(B.NLIN,1,A.NUM_DIAS_PARC1,2,A.NUM_DIAS_PARC2,3,A.NUM_DIAS_PARC4)||'';'') > 0 and',
'                       (',
'                     ((nvl(A.NUM_DIAS_PARC4,0)+nvl(A.NUM_DIAS_PARC2,0)+nvl(A.NUM_DIAS_PARC1,0)) - (nvl(:P78_NUM_DIAS_PARC1_LST,0)+nvl(:P78_NUM_DIAS_PARC2_LST,0)) = nvl(A.NUM_DIAS_PARC1,0)) or',
'                     ((nvl(A.NUM_DIAS_PARC4,0)+nvl(A.NUM_DIAS_PARC2,0)+nvl(A.NUM_DIAS_PARC1,0)) - (nvl(:P78_NUM_DIAS_PARC1_LST,0)+nvl(:P78_NUM_DIAS_PARC2_LST,0)) = nvl(A.NUM_DIAS_PARC2,0)) or',
'                     ((nvl(A.NUM_DIAS_PARC4,0)+nvl(A.NUM_DIAS_PARC2,0)+nvl(A.NUM_DIAS_PARC1,0)) - (nvl(:P78_NUM_DIAS_PARC1_LST,0)+nvl(:P78_NUM_DIAS_PARC2_LST,0)) = nvl(A.NUM_DIAS_PARC4,0))',
'                        )',
'                    )',
'                )',
'        and     nvl(A.NUM_DIAS_PARC4,nvl(A.NUM_DIAS_PARC2,A.NUM_DIAS_PARC1)) is not null',
'        and     A.COD_EMPRESA = :P78_COD_EMPRESA',
'        and     A.COD_FILIAL = :P78_FILIAL',
'        and     A.COD = nvl(:P78_OPCAO_FERIAS,:P78_OPCAO_FERIAS_A)',
'        and     nvl(:P78_MESES_ADM,12) between nvl(A.MESES_MIN,0) and nvl(A.MESES_MAX,999)',
'        ) X',
'where   X.DIAS = X.C2',
'*/',
'/*',
'select x.descricao, x.dias',
'from (',
'select ',
'num_dias_parc1 descricao, num_dias_parc1 dias, cod_empresa, cod, cod_filial, meses_min, meses_max',
'  from ferias_parametros_parcelas',
'union',
'select ',
'num_dias_parc2 descricao, num_dias_parc2 dias, cod_empresa, cod, cod_filial, meses_min, meses_max',
'  from ferias_parametros_parcelas',
'union',
'select ',
'num_dias_parc4 descricao, num_dias_parc4 dias, cod_empresa, cod, cod_filial, meses_min, meses_max',
'  from ferias_parametros_parcelas) x',
'where x.dias is not null   ',
'  and x.cod_filial = :p78_filial',
'  and x.cod_empresa = :p78_cod_empresa',
'  and x.cod = :p78_opcao_ferias',
'  and nvl(:p78_meses_adm,12) between nvl(x.meses_min,0) and nvl(x.meses_max,999)',
'*/'))
,p_lov_display_null=>'YES'
,p_lov_cascade_parent_items=>'P78_PARCELAS_OPC,P78_NUM_DIAS_PARC1_LST,P78_NUM_DIAS_PARC2_LST,P78_COD_EMPRESA,P78_FILIAL,P78_OPCAO_FERIAS,P78_OPCAO_FERIAS_A,P78_MESES_ADM'
,p_ajax_optimize_refresh=>'N'
,p_cHeight=>1
,p_begin_on_new_line=>'N'
,p_begin_on_new_field=>'N'
,p_display_when=>'P78_COD_SOLICITACAO'
,p_display_when_type=>'ITEM_IS_NULL'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_lov_display_extra=>'NO'
,p_attribute_01=>'NONE'
,p_attribute_02=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329706754796718479)
,p_name=>'P78_DIAS_ABONO_PEC4'
,p_item_sequence=>50
,p_item_plug_id=>wwv_flow_api.id(276559150703399823134)
,p_use_cache_before_default=>'NO'
,p_prompt=>'Dias de Abono'
,p_source=>'DIAS_ABONO_PEC4'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329707211755718479)
,p_name=>'P78_DIAS_ABONO_PEC4_LST'
,p_item_sequence=>60
,p_item_plug_id=>wwv_flow_api.id(276559150703399823134)
,p_prompt=>'Dias de Abono'
,p_display_as=>'NATIVE_SELECT_LIST'
,p_lov=>wwv_flow_string.join(wwv_flow_t_varchar2(
'select x.descricao, x.dias',
'from (',
'select ',
'dias_abono_pec1 descricao, dias_abono_pec1 dias, cod_empresa, cod, cod_filial, meses_min, meses_max',
'  from ferias_parametros_parcelas',
'union',
'select ',
'dias_abono_pec2 descricao, dias_abono_pec2 dias, cod_empresa, cod, cod_filial, meses_min, meses_max',
'  from ferias_parametros_parcelas',
'union',
'select ',
'dias_abono_pec4 descricao, dias_abono_pec4 dias, cod_empresa, cod, cod_filial, meses_min, meses_max',
'  from ferias_parametros_parcelas) x',
'where x.dias is not null   ',
'  and x.cod_filial = :p78_filial',
'  and x.cod_empresa = :p78_cod_empresa',
'  and x.cod = nvl(:p78_opcao_ferias,:p78_opcao_ferias_a)',
'  and nvl(:p78_meses_adm,12) between nvl(x.meses_min,0) and nvl(x.meses_max,999)',
'',
''))
,p_lov_display_null=>'YES'
,p_lov_null_text=>'-'
,p_lov_cascade_parent_items=>'P78_COD_EMPRESA,P78_OPCAO_FERIAS,P78_OPCAO_FERIAS_A,P78_FILIAL,P78_MESES_ADM'
,p_ajax_optimize_refresh=>'N'
,p_cHeight=>1
,p_begin_on_new_line=>'N'
,p_begin_on_new_field=>'N'
,p_display_when=>'P78_COD_SOLICITACAO'
,p_display_when_type=>'ITEM_IS_NULL'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_lov_display_extra=>'NO'
,p_attribute_01=>'NONE'
,p_attribute_02=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329707591596718479)
,p_name=>'P78_OPCAO_13SAL4'
,p_item_sequence=>70
,p_item_plug_id=>wwv_flow_api.id(276559150703399823134)
,p_use_cache_before_default=>'NO'
,p_prompt=>unistr('13\00BA Sal\00E1rio')
,p_source=>'OPCAO_13SAL4'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_SELECT_LIST'
,p_lov=>unistr('STATIC:N\00E3o;N,Sim;S')
,p_cHeight=>1
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_lov_display_extra=>'NO'
,p_attribute_01=>'NONE'
,p_attribute_02=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329707943820718479)
,p_name=>'P78_DESC_ADICIONAL4'
,p_item_sequence=>80
,p_item_plug_id=>wwv_flow_api.id(276559150703399823134)
,p_use_cache_before_default=>'NO'
,p_prompt=>'Descanso Adicional'
,p_source=>'DESC_ADICIONAL4'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_display_when=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'    cursor c1 is',
'    select abono_ferias bonus_ferias',
'      from ferias_parametros',
'     where cod_empresa = :p78_cod_empresa',
'       and cod_filial = :p78_filial;',
'       ',
'    v_c1 c1%rowtype;',
'',
'begin',
'',
'    open c1;',
'    fetch c1 into v_c1;',
'    close c1;',
'    ',
'    if v_c1.bonus_ferias > 0 then',
'    return true;',
'    else ',
'    return false;',
'    end if;',
'',
'end;'))
,p_display_when_type=>'FUNCTION_BODY'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329708393136718480)
,p_name=>'P78_DT_RETORNO_PARC4'
,p_item_sequence=>90
,p_item_plug_id=>wwv_flow_api.id(276559150703399823134)
,p_use_cache_before_default=>'NO'
,p_prompt=>'Data de Retorno'
,p_source=>'DT_RETORNO_PARC4'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329708785651718480)
,p_name=>'P78_DT_PAGTO_PARC4'
,p_item_sequence=>100
,p_item_plug_id=>wwv_flow_api.id(276559150703399823134)
,p_use_cache_before_default=>'NO'
,p_source=>'DT_PAGTO_PARC4'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329709199548718480)
,p_name=>'P78_TIPO_FERIAS4'
,p_item_sequence=>110
,p_item_plug_id=>wwv_flow_api.id(276559150703399823134)
,p_use_cache_before_default=>'NO'
,p_source=>'TIPO_FERIAS4'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329709559475718480)
,p_name=>'P78_OPCAO_ABONO_PEC4'
,p_item_sequence=>120
,p_item_plug_id=>wwv_flow_api.id(276559150703399823134)
,p_use_cache_before_default=>'NO'
,p_source=>'OPCAO_ABONO_PEC4'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329710227190718481)
,p_name=>'P78_FALTA_HORA'
,p_item_sequence=>70
,p_item_plug_id=>wwv_flow_api.id(276694827786584432550)
,p_use_cache_before_default=>'NO'
,p_source=>'FALTA_HORA'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329710661725718481)
,p_name=>'P78_FALTA_MINUTO'
,p_item_sequence=>90
,p_item_plug_id=>wwv_flow_api.id(276694827786584432550)
,p_use_cache_before_default=>'NO'
,p_source=>'FALTA_MINUTO'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329711080305718481)
,p_name=>'P78_DIAS_DIREITO'
,p_item_sequence=>110
,p_item_plug_id=>wwv_flow_api.id(276694827786584432550)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329711467948718482)
,p_name=>'P78_DIAS_DESCANSO_ADICIONAL'
,p_item_sequence=>130
,p_item_plug_id=>wwv_flow_api.id(276694827786584432550)
,p_use_cache_before_default=>'NO'
,p_source=>'DIAS_DESCANSO_ADICIONAL'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329711913749718482)
,p_name=>'P78_SALDO_BRUTO'
,p_item_sequence=>140
,p_item_plug_id=>wwv_flow_api.id(276694827786584432550)
,p_use_cache_before_default=>'NO'
,p_source=>'SALDO_BRUTO'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329712257306718482)
,p_name=>'P78_SALDO'
,p_item_sequence=>150
,p_item_plug_id=>wwv_flow_api.id(276694827786584432550)
,p_use_cache_before_default=>'NO'
,p_source=>'SALDO'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329712644388718482)
,p_name=>'P78_FALTA_HORA_1'
,p_item_sequence=>160
,p_item_plug_id=>wwv_flow_api.id(276694827786584432550)
,p_use_cache_before_default=>'NO'
,p_prompt=>unistr('Faltas no Per\00EDodo')
,p_source=>'FALTA_HORA'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_grid_label_column_span=>3
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#:t-Form-fieldContainer--stretchInputs'
,p_attribute_01=>'N'
,p_attribute_02=>'Y'
,p_attribute_03=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329713050065718483)
,p_name=>'P78_FALTA_MINUTO_1'
,p_item_sequence=>170
,p_item_plug_id=>wwv_flow_api.id(276694827786584432550)
,p_use_cache_before_default=>'NO'
,p_prompt=>'Dias'
,p_source=>'FALTA_MINUTO'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_begin_on_new_line=>'N'
,p_grid_label_column_span=>3
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'Y'
,p_attribute_03=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329713439659718483)
,p_name=>'P78_DIAS_DIREITO_1'
,p_item_sequence=>180
,p_item_plug_id=>wwv_flow_api.id(276694827786584432550)
,p_prompt=>'Dias de Direito'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_grid_label_column_span=>3
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'Y'
,p_attribute_03=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329713891056718483)
,p_name=>'P78_DIAS_DESCANSO_ADICIONAL_1'
,p_item_sequence=>200
,p_item_plug_id=>wwv_flow_api.id(276694827786584432550)
,p_use_cache_before_default=>'NO'
,p_prompt=>unistr('B\00F4nus de F\00E9rias')
,p_source=>'DIAS_DESCANSO_ADICIONAL'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_begin_on_new_line=>'N'
,p_grid_label_column_span=>3
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'Y'
,p_attribute_03=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329714239518718483)
,p_name=>'P78_SALDO_BRUTO_1'
,p_item_sequence=>210
,p_item_plug_id=>wwv_flow_api.id(276694827786584432550)
,p_use_cache_before_default=>'NO'
,p_prompt=>'Saldo Bruto'
,p_source=>'SALDO_BRUTO'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_grid_label_column_span=>3
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'Y'
,p_attribute_03=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329714625501718484)
,p_name=>'P78_SALDO_1'
,p_item_sequence=>220
,p_item_plug_id=>wwv_flow_api.id(276694827786584432550)
,p_use_cache_before_default=>'NO'
,p_prompt=>'Saldo Final'
,p_source=>'SALDO'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_begin_on_new_line=>'N'
,p_grid_label_column_span=>3
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'Y'
,p_attribute_03=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329715351313718484)
,p_name=>'P78_DT_SAIDA_PARC1'
,p_item_sequence=>20
,p_item_plug_id=>wwv_flow_api.id(276694832970995432555)
,p_use_cache_before_default=>'NO'
,p_prompt=>unistr('Data da Sa\00EDda')
,p_source=>'DT_SAIDA_PARC1'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_DATE_PICKER'
,p_cSize=>30
,p_begin_on_new_line=>'N'
,p_begin_on_new_field=>'N'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_04=>'both'
,p_attribute_05=>'N'
,p_attribute_07=>'NONE'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329715780820718485)
,p_name=>'P78_NUM_DIAS_PARC1_DSP'
,p_item_sequence=>50
,p_item_plug_id=>wwv_flow_api.id(276694832970995432555)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329716188347718485)
,p_name=>'P78_NUM_DIAS_PARC1'
,p_item_sequence=>60
,p_item_plug_id=>wwv_flow_api.id(276694832970995432555)
,p_use_cache_before_default=>'NO'
,p_prompt=>unistr('N\00FAmero de Dias')
,p_placeholder=>'Ex.: 30'
,p_source=>'NUM_DIAS_PARC1'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329716528245718485)
,p_name=>'P78_NUM_DIAS_PARC1_LST'
,p_item_sequence=>70
,p_item_plug_id=>wwv_flow_api.id(276694832970995432555)
,p_prompt=>unistr('N\00FAmero de Dias')
,p_display_as=>'NATIVE_SELECT_LIST'
,p_lov=>wwv_flow_string.join(wwv_flow_t_varchar2(
'select N DESCRICAO, I DIAS ',
' from pkg_list_matricula.fnc_list_numdias(',
'                            :P78_COD_EMPRESA,',
'                            :P78_FILIAL,',
'                            nvl(:P78_OPCAO_FERIAS,:P78_OPCAO_FERIAS_A),',
'                            :P78_PARCELAS_OPC,',
'                            nvl(:P78_MESES_ADM,12),',
'                            null,',
'                            null)',
'/*',
'select  distinct',
'        X.DESCRICAO,',
'        X.DIAS',
'from    (',
'        select  decode(B.NLIN,1,A.NUM_DIAS_PARC1,2,A.NUM_DIAS_PARC2,3,A.NUM_DIAS_PARC4) DESCRICAO,',
'                decode(B.NLIN,1,A.NUM_DIAS_PARC1,2,A.NUM_DIAS_PARC2,3,A.NUM_DIAS_PARC4) DIAS',
'        from    FERIAS_PARAMETROS_PARCELAS A,',
'                (select rownum NLIN from dual connect by level <= :P78_PARCELAS_OPC) B',
'        where   nvl(A.NUM_DIAS_PARC4,nvl(A.NUM_DIAS_PARC2,A.NUM_DIAS_PARC1)) is not null',
'        and     A.COD_EMPRESA = :P78_COD_EMPRESA',
'        and     A.COD_FILIAL = :P78_FILIAL',
'        and     A.COD = nvl(:P78_OPCAO_FERIAS,:P78_OPCAO_FERIAS_A)',
'        and     nvl(:P78_MESES_ADM,12) between nvl(A.MESES_MIN,0) and nvl(A.MESES_MAX,999)',
'        ) X',
'*/',
'/*',
'select x.descricao, x.dias',
'from (',
'select ',
'num_dias_parc1 descricao, num_dias_parc1 dias, cod_empresa, cod, cod_filial, meses_min, meses_max',
'  from ferias_parametros_parcelas',
'union',
'select ',
'num_dias_parc2 descricao, num_dias_parc2 dias, cod_empresa, cod, cod_filial, meses_min, meses_max',
'  from ferias_parametros_parcelas',
'union',
'select ',
'num_dias_parc4 descricao, num_dias_parc4 dias, cod_empresa, cod, cod_filial, meses_min, meses_max',
'  from ferias_parametros_parcelas) x',
'where x.dias is not null   ',
'  and x.cod_filial = :p78_filial',
'  and x.cod_empresa = :p78_cod_empresa',
'  and x.cod = :p78_opcao_ferias',
'  and nvl(:p78_meses_adm,12) between nvl(x.meses_min,0) and nvl(x.meses_max,999)',
'  */'))
,p_lov_display_null=>'YES'
,p_lov_null_text=>'-'
,p_lov_cascade_parent_items=>'P78_PARCELAS_OPC,P78_COD_EMPRESA,P78_FILIAL,P78_OPCAO_FERIAS,P78_OPCAO_FERIAS_A,P78_MESES_ADM'
,p_ajax_optimize_refresh=>'N'
,p_cHeight=>1
,p_begin_on_new_line=>'N'
,p_begin_on_new_field=>'N'
,p_display_when=>'P78_COD_SOLICITACAO'
,p_display_when_type=>'ITEM_IS_NULL'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_lov_display_extra=>'NO'
,p_attribute_01=>'NONE'
,p_attribute_02=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329716925712718485)
,p_name=>'P78_DIAS_ABONO_PEC1_DSP'
,p_item_sequence=>80
,p_item_plug_id=>wwv_flow_api.id(276694832970995432555)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329717361190718486)
,p_name=>'P78_DIAS_ABONO_PEC1'
,p_item_sequence=>90
,p_item_plug_id=>wwv_flow_api.id(276694832970995432555)
,p_use_cache_before_default=>'NO'
,p_prompt=>'Dias de Abono'
,p_source=>'DIAS_ABONO_PEC1'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329717767068718486)
,p_name=>'P78_DIAS_ABONO_PEC1_LST'
,p_item_sequence=>100
,p_item_plug_id=>wwv_flow_api.id(276694832970995432555)
,p_prompt=>'Dias de Abono'
,p_display_as=>'NATIVE_SELECT_LIST'
,p_lov=>wwv_flow_string.join(wwv_flow_t_varchar2(
'select x.descricao, x.dias',
'from (',
'select ',
'dias_abono_pec1 descricao, dias_abono_pec1 dias, cod_empresa, cod, cod_filial, meses_min, meses_max',
'  from ferias_parametros_parcelas',
'union',
'select ',
'dias_abono_pec2 descricao, dias_abono_pec2 dias, cod_empresa, cod, cod_filial, meses_min, meses_max',
'  from ferias_parametros_parcelas',
'union',
'select ',
'dias_abono_pec4 descricao, dias_abono_pec4 dias, cod_empresa, cod, cod_filial, meses_min, meses_max',
'  from ferias_parametros_parcelas) x',
'where x.dias is not null   ',
'  and x.cod_filial = :p78_filial',
'  and x.cod_empresa = :p78_cod_empresa',
'  and x.cod = nvl(:p78_opcao_ferias,:P78_OPCAO_FERIAS_A)',
'  and nvl(:p78_meses_adm,12) between nvl(x.meses_min,0) and nvl(x.meses_max,999)'))
,p_lov_display_null=>'YES'
,p_lov_null_text=>'-'
,p_lov_cascade_parent_items=>'P78_COD_EMPRESA,P78_OPCAO_FERIAS,P78_OPCAO_FERIAS_A,P78_FILIAL,P78_MESES_ADM'
,p_ajax_optimize_refresh=>'N'
,p_cHeight=>1
,p_begin_on_new_line=>'N'
,p_begin_on_new_field=>'N'
,p_display_when=>'P78_COD_SOLICITACAO'
,p_display_when_type=>'ITEM_IS_NULL'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_lov_display_extra=>'NO'
,p_attribute_01=>'NONE'
,p_attribute_02=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329718169440718486)
,p_name=>'P78_OPCAO_13SAL1'
,p_item_sequence=>110
,p_item_plug_id=>wwv_flow_api.id(276694832970995432555)
,p_use_cache_before_default=>'NO'
,p_prompt=>unistr('13\00BA Sal\00E1rio')
,p_source=>'OPCAO_13SAL1'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_SELECT_LIST'
,p_lov=>unistr('STATIC:N\00E3o;N,Sim;S')
,p_cHeight=>1
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_lov_display_extra=>'NO'
,p_attribute_01=>'NONE'
,p_attribute_02=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329718556602718486)
,p_name=>'P78_DESC_ADICIONAL1'
,p_item_sequence=>140
,p_item_plug_id=>wwv_flow_api.id(276694832970995432555)
,p_use_cache_before_default=>'NO'
,p_prompt=>'Descanso Adicional'
,p_source=>'DESC_ADICIONAL1'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_display_when=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'    cursor c1 is',
'    select abono_ferias bonus_ferias',
'      from ferias_parametros',
'     where cod_empresa = :p78_cod_empresa',
'       and cod_filial = :p78_filial;',
'       ',
'    v_c1 c1%rowtype;',
'',
'begin',
'',
'    open c1;',
'    fetch c1 into v_c1;',
'    close c1;',
'    ',
'    if v_c1.bonus_ferias > 0 then',
'    return true;',
'    else ',
'    return false;',
'    end if;',
'',
'end;'))
,p_display_when_type=>'FUNCTION_BODY'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329719012287718487)
,p_name=>'P78_DT_RETORNO_PARC1_X'
,p_item_sequence=>150
,p_item_plug_id=>wwv_flow_api.id(276694832970995432555)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329719387778718487)
,p_name=>'P78_DT_RETORNO_PARC1'
,p_item_sequence=>160
,p_item_plug_id=>wwv_flow_api.id(276694832970995432555)
,p_use_cache_before_default=>'NO'
,p_prompt=>'Data de Retorno'
,p_format_mask=>'DD/MM/YYYY'
,p_source=>'DT_RETORNO_PARC1'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329719751282718488)
,p_name=>'P78_DT_PAGTO_PARC1'
,p_item_sequence=>210
,p_item_plug_id=>wwv_flow_api.id(276694832970995432555)
,p_use_cache_before_default=>'NO'
,p_source=>'DT_PAGTO_PARC1'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329720129761718488)
,p_name=>'P78_TIPO_FERIAS1'
,p_item_sequence=>220
,p_item_plug_id=>wwv_flow_api.id(276694832970995432555)
,p_use_cache_before_default=>'NO'
,p_source=>'TIPO_FERIAS1'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329720538828718489)
,p_name=>'P78_OPCAO_ABONO_PEC1'
,p_item_sequence=>230
,p_item_plug_id=>wwv_flow_api.id(276694832970995432555)
,p_use_cache_before_default=>'NO'
,p_source=>'OPCAO_ABONO_PEC1'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329721234262718490)
,p_name=>'P78_DT_SAIDA_PARC2'
,p_item_sequence=>10
,p_item_plug_id=>wwv_flow_api.id(276694838117800432559)
,p_use_cache_before_default=>'NO'
,p_prompt=>unistr('Data da Sa\00EDda')
,p_source=>'DT_SAIDA_PARC2'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_DATE_PICKER'
,p_cSize=>30
,p_begin_on_new_line=>'N'
,p_begin_on_new_field=>'N'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_04=>'both'
,p_attribute_05=>'N'
,p_attribute_07=>'NONE'
);
end;
/
begin
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329721698471718490)
,p_name=>'P78_NUM_DIAS_PARC2'
,p_item_sequence=>40
,p_item_plug_id=>wwv_flow_api.id(276694838117800432559)
,p_use_cache_before_default=>'NO'
,p_prompt=>unistr('N\00FAmero de Dias')
,p_source=>'NUM_DIAS_PARC2'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329722062133718491)
,p_name=>'P78_NUM_DIAS_PARC2_LST'
,p_item_sequence=>50
,p_item_plug_id=>wwv_flow_api.id(276694838117800432559)
,p_prompt=>unistr('N\00FAmero de Dias')
,p_display_as=>'NATIVE_SELECT_LIST'
,p_lov=>wwv_flow_string.join(wwv_flow_t_varchar2(
'select N DESCRICAO, I DIAS ',
' from pkg_list_matricula.fnc_list_numdias(',
'                            :P78_COD_EMPRESA,',
'                            :P78_FILIAL,',
'                            nvl(:P78_OPCAO_FERIAS,:P78_OPCAO_FERIAS_A),',
'                            :P78_PARCELAS_OPC,',
'                            nvl(:P78_MESES_ADM,12),',
'                            nvl(:P78_NUM_DIAS_PARC1_LST,:P78_NUM_DIAS_PARC1_1),',
'                            null)',
'/*',
'select  X.DESCRICAO,',
'        X.DIAS',
'from    (',
'        select  decode(B.NLIN,1,A.NUM_DIAS_PARC1,2,A.NUM_DIAS_PARC2,3,A.NUM_DIAS_PARC4) DESCRICAO,',
'                decode(B.NLIN,1,A.NUM_DIAS_PARC1,2,A.NUM_DIAS_PARC2,3,A.NUM_DIAS_PARC4) DIAS',
'        from    FERIAS_PARAMETROS_PARCELAS A,',
'                (select rownum NLIN from dual connect by level <= :P78_PARCELAS_OPC) B',
'        where   (',
'                    (A.NUM_DIAS_PARC1 != A.NUM_DIAS_PARC2 and',
'                        instr('';''||nvl(:P78_NUM_DIAS_PARC1_LST,:P78_NUM_DIAS_PARC1_1)||'';'','';''||decode(B.NLIN,1,A.NUM_DIAS_PARC1,2,A.NUM_DIAS_PARC2,3,A.NUM_DIAS_PARC4)||'';'') = 0) or',
'                    (A.NUM_DIAS_PARC1 = A.NUM_DIAS_PARC2 and ',
'                        instr('';1-''||nvl(:P78_NUM_DIAS_PARC1_LST,:P78_NUM_DIAS_PARC1_1)||'';'','';''||decode(B.NLIN,1,''1-''||A.NUM_DIAS_PARC1,2,''2-''||A.NUM_DIAS_PARC2,3,''3-''||A.NUM_DIAS_PARC4)||'';'') = 0)',
'                )',
'        and     nvl(A.NUM_DIAS_PARC4,nvl(A.NUM_DIAS_PARC2,A.NUM_DIAS_PARC1)) is not null',
'        and     A.COD_EMPRESA = :P78_COD_EMPRESA',
'        and     A.COD_FILIAL = :P78_FILIAL',
'        and     A.COD = nvl(:P78_OPCAO_FERIAS,:P78_OPCAO_FERIAS_A)',
'        and     nvl(:P78_MESES_ADM,12) between nvl(A.MESES_MIN,0) and nvl(A.MESES_MAX,999)',
'        group by',
'				decode(B.NLIN,1,A.NUM_DIAS_PARC1,2,A.NUM_DIAS_PARC2,3,A.NUM_DIAS_PARC4),',
'                decode(B.NLIN,1,A.NUM_DIAS_PARC1,2,A.NUM_DIAS_PARC2,3,A.NUM_DIAS_PARC4)',
'        ) X',
'where	X.DIAS is not null',
'*/',
'/*',
'select x.descricao, x.dias',
'from (',
'select ',
'num_dias_parc1 descricao, num_dias_parc1 dias, cod_empresa, cod, cod_filial, meses_min, meses_max',
'  from ferias_parametros_parcelas',
'union',
'select ',
'num_dias_parc2 descricao, num_dias_parc2 dias, cod_empresa, cod, cod_filial, meses_min, meses_max',
'  from ferias_parametros_parcelas',
'union',
'select ',
'num_dias_parc4 descricao, num_dias_parc4 dias, cod_empresa, cod, cod_filial, meses_min, meses_max',
'  from ferias_parametros_parcelas) x',
'where x.dias is not null   ',
'  and x.cod_filial = :p78_filial',
'  and x.cod_empresa = :p78_cod_empresa',
'  and x.cod = :p78_opcao_ferias',
'  and nvl(:p78_meses_adm,12) between nvl(x.meses_min,0) and nvl(x.meses_max,999)',
'*/'))
,p_lov_display_null=>'YES'
,p_lov_cascade_parent_items=>'P78_NUM_DIAS_PARC1_LST,P78_NUM_DIAS_PARC1_1,P78_PARCELAS_OPC,P78_COD_EMPRESA,P78_FILIAL,P78_OPCAO_FERIAS,P78_OPCAO_FERIAS_A,P78_MESES_ADM'
,p_ajax_optimize_refresh=>'N'
,p_cHeight=>1
,p_begin_on_new_line=>'N'
,p_begin_on_new_field=>'N'
,p_display_when=>'P78_COD_SOLICITACAO'
,p_display_when_type=>'ITEM_IS_NULL'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_lov_display_extra=>'NO'
,p_attribute_01=>'NONE'
,p_attribute_02=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329722452001718491)
,p_name=>'P78_DIAS_ABONO_PEC2'
,p_item_sequence=>60
,p_item_plug_id=>wwv_flow_api.id(276694838117800432559)
,p_use_cache_before_default=>'NO'
,p_prompt=>'Dias de Abono'
,p_source=>'DIAS_ABONO_PEC2'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329722861774718492)
,p_name=>'P78_DIAS_ABONO_PEC2_LST'
,p_item_sequence=>70
,p_item_plug_id=>wwv_flow_api.id(276694838117800432559)
,p_prompt=>'Dias de Abono'
,p_display_as=>'NATIVE_SELECT_LIST'
,p_lov=>wwv_flow_string.join(wwv_flow_t_varchar2(
'select  ',
'        X.DESCRICAO,',
'        X.DIAS',
'from    (',
'        select  decode(B.NLIN,1,A.DIAS_ABONO_PEC1,2,A.DIAS_ABONO_PEC2,3,A.DIAS_ABONO_PEC4) DESCRICAO,',
'                decode(B.NLIN,1,A.DIAS_ABONO_PEC1,2,A.DIAS_ABONO_PEC2,3,A.DIAS_ABONO_PEC4) DIAS',
'        from    FERIAS_PARAMETROS_PARCELAS A,',
'                (select rownum NLIN from dual connect by level <= :P78_PARCELAS_OPC) B',
'        where   1=1--(nvl(A.DIAS_ABONO_PEC1,0) - (nvl(:P78_DIAS_ABONO_PEC1_LST,0)+nvl(:P78_DIAS_ABONO_PEC2_LST,0)+nvl(:P78_DIAS_ABONO_PEC4_LST,0)) > 0)',
'        and     1=1--nvl(A.DIAS_ABONO_PEC4,nvl(A.DIAS_ABONO_PEC2,A.DIAS_ABONO_PEC1)) is not null',
'        and     A.COD_EMPRESA = :P78_COD_EMPRESA',
'        and     A.COD_FILIAL = :P78_FILIAL',
'        and     A.COD = nvl(:P78_OPCAO_FERIAS,:P78_OPCAO_FERIAS_A)',
'        and     nvl(:P78_MESES_ADM,12) between nvl(A.MESES_MIN,0) and nvl(A.MESES_MAX,999)',
'        group by',
'                decode(B.NLIN,1,A.DIAS_ABONO_PEC1,2,A.DIAS_ABONO_PEC2,3,A.DIAS_ABONO_PEC4),',
'                decode(B.NLIN,1,A.DIAS_ABONO_PEC1,2,A.DIAS_ABONO_PEC2,3,A.DIAS_ABONO_PEC4)',
'        ) X',
'where   X.DIAS is not null',
'    ',
'/*select x.descricao, x.dias',
'from (',
'select ',
'dias_abono_pec1 descricao, dias_abono_pec1 dias, cod_empresa, cod, cod_filial, meses_min, meses_max',
'  from ferias_parametros_parcelas',
'union',
'select ',
'dias_abono_pec2 descricao, dias_abono_pec2 dias, cod_empresa, cod, cod_filial, meses_min, meses_max',
'  from ferias_parametros_parcelas',
'union',
'select ',
'dias_abono_pec4 descricao, dias_abono_pec4 dias, cod_empresa, cod, cod_filial, meses_min, meses_max',
'  from ferias_parametros_parcelas) x',
'where x.dias is not null   ',
'  and x.cod_filial = :p78_filial',
'  and x.cod_empresa = :p78_cod_empresa',
'  and x.cod = nvl(:p78_opcao_ferias,:P78_OPCAO_FERIAS_A)',
'  and nvl(:p78_meses_adm,12) between nvl(x.meses_min,0) and nvl(x.meses_max,999)*/'))
,p_lov_display_null=>'YES'
,p_lov_null_text=>'-'
,p_lov_cascade_parent_items=>'P78_PARCELAS_OPC,P78_DIAS_ABONO_PEC1_LST,P78_DIAS_ABONO_PEC4_LST,P78_COD_EMPRESA,P78_FILIAL,P78_OPCAO_FERIAS,P78_OPCAO_FERIAS_A,P78_MESES_ADM'
,p_ajax_optimize_refresh=>'N'
,p_cHeight=>1
,p_begin_on_new_line=>'N'
,p_begin_on_new_field=>'N'
,p_display_when=>'P78_COD_SOLICITACAO'
,p_display_when_type=>'ITEM_IS_NULL'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_lov_display_extra=>'NO'
,p_attribute_01=>'NONE'
,p_attribute_02=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329723314388718492)
,p_name=>'P78_OPCAO_13SAL2'
,p_item_sequence=>80
,p_item_plug_id=>wwv_flow_api.id(276694838117800432559)
,p_use_cache_before_default=>'NO'
,p_prompt=>unistr('13\00BA Sal\00E1rio')
,p_source=>'OPCAO_13SAL2'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_SELECT_LIST'
,p_lov=>unistr('STATIC:N\00E3o;N,Sim;S')
,p_cHeight=>1
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_lov_display_extra=>'NO'
,p_attribute_01=>'NONE'
,p_attribute_02=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329723690033718492)
,p_name=>'P78_DESC_ADICIONAL2'
,p_item_sequence=>100
,p_item_plug_id=>wwv_flow_api.id(276694838117800432559)
,p_use_cache_before_default=>'NO'
,p_prompt=>'Descanso Adicional'
,p_source=>'DESC_ADICIONAL2'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_display_when=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'    cursor c1 is',
'    select abono_ferias bonus_ferias',
'      from ferias_parametros',
'     where cod_empresa = :p78_cod_empresa',
'       and cod_filial = :p78_filial;',
'       ',
'    v_c1 c1%rowtype;',
'',
'begin',
'',
'    open c1;',
'    fetch c1 into v_c1;',
'    close c1;',
'    ',
'    if v_c1.bonus_ferias > 0 then',
'    return true;',
'    else ',
'    return false;',
'    end if;',
'',
'end;'))
,p_display_when_type=>'FUNCTION_BODY'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329724028144718493)
,p_name=>'P78_DT_RETORNO_PARC2'
,p_item_sequence=>110
,p_item_plug_id=>wwv_flow_api.id(276694838117800432559)
,p_use_cache_before_default=>'NO'
,p_prompt=>'Data de Retorno'
,p_source=>'DT_RETORNO_PARC2'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329724459547718493)
,p_name=>'P78_DT_PAGTO_PARC2'
,p_item_sequence=>120
,p_item_plug_id=>wwv_flow_api.id(276694838117800432559)
,p_use_cache_before_default=>'NO'
,p_source=>'DT_PAGTO_PARC2'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329724904562718493)
,p_name=>'P78_TIPO_FERIAS2'
,p_item_sequence=>130
,p_item_plug_id=>wwv_flow_api.id(276694838117800432559)
,p_use_cache_before_default=>'NO'
,p_source=>'TIPO_FERIAS2'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329725278777718494)
,p_name=>'P78_OPCAO_ABONO_PEC2'
,p_item_sequence=>140
,p_item_plug_id=>wwv_flow_api.id(276694838117800432559)
,p_use_cache_before_default=>'NO'
,p_source=>'OPCAO_ABONO_PEC2'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329725985358718494)
,p_name=>'P78_DT_SAIDA_PARC3'
,p_item_sequence=>50
,p_item_plug_id=>wwv_flow_api.id(276694842080596432565)
,p_use_cache_before_default=>'NO'
,p_prompt=>unistr('Data da Sa\00EDda')
,p_source=>'DT_SAIDA_PARC3'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_DATE_PICKER'
,p_cSize=>30
,p_begin_on_new_line=>'N'
,p_begin_on_new_field=>'N'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_04=>'button'
,p_attribute_05=>'N'
,p_attribute_07=>'NONE'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329726400872718495)
,p_name=>'P78_NUM_DIAS_PARC3'
,p_item_sequence=>60
,p_item_plug_id=>wwv_flow_api.id(276694842080596432565)
,p_use_cache_before_default=>'NO'
,p_prompt=>unistr('N\00FAmero de Dias')
,p_source=>'NUM_DIAS_PARC3'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329726745566718495)
,p_name=>'P78_DT_RETORNO_PARC3'
,p_item_sequence=>70
,p_item_plug_id=>wwv_flow_api.id(276694842080596432565)
,p_use_cache_before_default=>'NO'
,p_prompt=>'Data de Retorno'
,p_source=>'DT_RETORNO_PARC3'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_DATE_PICKER'
,p_cSize=>30
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_04=>'button'
,p_attribute_05=>'N'
,p_attribute_07=>'NONE'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329727206887718495)
,p_name=>'P78_TIPO_FERIAS3'
,p_item_sequence=>80
,p_item_plug_id=>wwv_flow_api.id(276694842080596432565)
,p_use_cache_before_default=>'NO'
,p_prompt=>unistr('Tipo de F\00E9rias')
,p_source=>'TIPO_FERIAS3'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_SELECT_LIST'
,p_lov=>'STATIC:Normal;N,Coletiva;C'
,p_cHeight=>1
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_lov_display_extra=>'NO'
,p_attribute_01=>'NONE'
,p_attribute_02=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329727820948718496)
,p_name=>'P78_DT_INIC_PER_FERIAS'
,p_item_sequence=>20
,p_item_plug_id=>wwv_flow_api.id(276694844053422432567)
,p_use_cache_before_default=>'NO'
,p_source=>'DT_INIC_PER_FERIAS'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329728292562718496)
,p_name=>'P78_DT_FIM_PER_FERIAS'
,p_item_sequence=>40
,p_item_plug_id=>wwv_flow_api.id(276694844053422432567)
,p_use_cache_before_default=>'NO'
,p_source=>'DT_FIM_PER_FERIAS'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329728672145718497)
,p_name=>'P78_IND_SITUACAO_PERIODO'
,p_item_sequence=>60
,p_item_plug_id=>wwv_flow_api.id(276694844053422432567)
,p_use_cache_before_default=>'NO'
,p_source=>'IND_SITUACAO_PERIODO'
,p_source_type=>'DB_COLUMN'
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329729116844718497)
,p_name=>'P78_JORNADA_REDUZIDA'
,p_item_sequence=>120
,p_item_plug_id=>wwv_flow_api.id(276694844053422432567)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329729431405718497)
,p_name=>'P78_DT_INIC_PER_FERIAS_1'
,p_item_sequence=>130
,p_item_plug_id=>wwv_flow_api.id(276694844053422432567)
,p_prompt=>unistr('Data In\00EDcio')
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_grid_label_column_span=>3
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'Y'
,p_attribute_03=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329729825372718498)
,p_name=>'P78_DT_FIM_PER_FERIAS_1'
,p_item_sequence=>140
,p_item_plug_id=>wwv_flow_api.id(276694844053422432567)
,p_prompt=>'Data Fim'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_begin_on_new_line=>'N'
,p_grid_label_column_span=>3
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'Y'
,p_attribute_03=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329730309586718498)
,p_name=>'P78_IND_SITUACAO_PERIODO_1'
,p_item_sequence=>150
,p_item_plug_id=>wwv_flow_api.id(276694844053422432567)
,p_prompt=>unistr('Situa\00E7\00E3o')
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_grid_label_column_span=>3
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'Y'
,p_attribute_03=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329730713755718499)
,p_name=>'P78_JORNADA_REDUZIDA_1'
,p_item_sequence=>160
,p_item_plug_id=>wwv_flow_api.id(276694844053422432567)
,p_prompt=>'Jornada Reduzida'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_begin_on_new_line=>'N'
,p_grid_label_column_span=>3
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'Y'
,p_attribute_03=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329731355064718499)
,p_name=>'P78_DT_SAIDA_PARC1_1'
,p_item_sequence=>10
,p_item_plug_id=>wwv_flow_api.id(276694847727728432570)
,p_prompt=>unistr('Data da Sa\00EDda')
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_begin_on_new_line=>'N'
,p_begin_on_new_field=>'N'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329731751890718500)
,p_name=>'P78_NUM_DIAS_PARC1_1'
,p_item_sequence=>30
,p_item_plug_id=>wwv_flow_api.id(276694847727728432570)
,p_prompt=>unistr('N\00FAmero de Dias')
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329732161875718500)
,p_name=>'P78_DIAS_ABONO_PEC1_1'
,p_item_sequence=>40
,p_item_plug_id=>wwv_flow_api.id(276694847727728432570)
,p_prompt=>'Dias de Abono'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329732527650718500)
,p_name=>'P78_OPCAO_13SAL1_1'
,p_item_sequence=>50
,p_item_plug_id=>wwv_flow_api.id(276694847727728432570)
,p_prompt=>unistr('13\00BA Sal\00E1rio')
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329732955545718501)
,p_name=>'P78_DESC_ADICIONAL1_1'
,p_item_sequence=>60
,p_item_plug_id=>wwv_flow_api.id(276694847727728432570)
,p_prompt=>unistr('B\00F4nus F\00E9rias')
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_display_when=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'    cursor c1 is',
'    select abono_ferias bonus_ferias',
'      from ferias_parametros',
'     where cod_empresa = :p78_cod_empresa',
'       and cod_filial = :p78_filial;',
'       ',
'    v_c1 c1%rowtype;',
'',
'begin',
'',
'    open c1;',
'    fetch c1 into v_c1;',
'    close c1;',
'    ',
'    if v_c1.bonus_ferias > 0 then',
'    return true;',
'    else ',
'    return false;',
'    end if;',
'',
'end;'))
,p_display_when_type=>'FUNCTION_BODY'
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329733383078718501)
,p_name=>'P78_DT_RETORNO_PARC1_1'
,p_item_sequence=>70
,p_item_plug_id=>wwv_flow_api.id(276694847727728432570)
,p_prompt=>'Data de Retorno'
,p_display_as=>'NATIVE_TEXT_FIELD'
,p_cSize=>30
,p_field_template=>wwv_flow_api.id(276731822914432120482)
,p_item_template_options=>'#DEFAULT#'
,p_attribute_01=>'N'
,p_attribute_02=>'N'
,p_attribute_04=>'TEXT'
,p_attribute_05=>'BOTH'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329733806461718502)
,p_name=>'P78_DT_PAGTO_PARC1_1'
,p_item_sequence=>100
,p_item_plug_id=>wwv_flow_api.id(276694847727728432570)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_item(
 p_id=>wwv_flow_api.id(276329734105331718502)
,p_name=>'P78_TIPO_FERIAS1_1'
,p_item_sequence=>110
,p_item_plug_id=>wwv_flow_api.id(276694847727728432570)
,p_display_as=>'NATIVE_HIDDEN'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(177040933635377807369)
,p_validation_name=>'Valid_P78_DIAS_ABONO_PEC1'
,p_validation_sequence=>20
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'    nC number;',
'begin',
'    select  max(',
'				case',
'                when nvl(A.DIAS_ABONO_PEC1,0) = ',
'                     nvl(:P78_DIAS_ABONO_PEC1,nvl(:P78_DIAS_ABONO_PEC1_1,0))+nvl(:P78_DIAS_ABONO_PEC2,0)+nvl(:P78_DIAS_ABONO_PEC4,0) then 1 end',
'			)',
'    into    nC',
'    from    FERIAS_PARAMETROS_PARCELAS A',
'    where   A.COD_EMPRESA = nvl(:P78_COD_EMPRESA,:P78_COD_EMPRESA_1)',
'    and     A.COD_FILIAL = :P78_FILIAL',
'    and     A.COD = nvl(:P78_OPCAO_FERIAS,:P78_OP);',
'	nC := 1;',
'    ',
'    return nC is not null;',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_BOOLEAN'
,p_error_message=>'Selecione os Dias de Abono de uma das parcelas.'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(275584259985132464505)
,p_validation_name=>'Valida P78_DIAS_DIREITO_OPC'
,p_validation_sequence=>40
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'',
'IF :P78_MATRICULA IS NOT NULL AND :P78_ROWID IS NULL THEN',
'',
' if NVL(:P78_DIAS_DIREITO_OPC,0) = 0 then',
' v_flg_retorno := ''N'';',
unistr(' v_msg_retorno := ''Para este per\00EDodo de f\00E9rias (''||:P78_DT_INIC_PER_FERIAS_1||'' \00E0 ''||:P78_DT_FIM_PER_FERIAS_1||''), o colaborador n\00E3o tem mais dias dispon\00EDveis a ser gozado.'';'),
' end if;',
'',
'    if v_flg_retorno = ''N'' and trim(v_msg_retorno) is not null then',
'        return trim(v_msg_retorno);',
'    end if;',
' ',
'END IF;',
' ',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(276329735425542718505)
,p_validation_name=>'Valida dias distribuidos'
,p_validation_sequence=>50
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'num_dias_parc1 number := :P78_num_dias_parc1;',
'num_dias_parc2 number := :P78_num_dias_parc2;',
'num_dias_parc4 number := :P78_num_dias_parc4;',
'',
'dias_abono_pec1 number := :P78_dias_abono_pec1;',
'dias_abono_pec2 number := :P78_dias_abono_pec2;',
'dias_abono_pec4 number := :P78_dias_abono_pec4;',
'',
'dias_direito number := nvl(:P78_dias_direito,:P78_dias_direito_1);',
'',
'begin',
'',
' if nvl(dias_direito,0) < (nvl(num_dias_parc1,0) + nvl(dias_abono_pec1,0)) and :p78_dt_saida_parc1 is not null and :p78_dt_saida_parc2 is null and :p78_dt_saida_parc4 is null then',
'    v_flg_retorno := ''N'';',
unistr('    v_msg_retorno := ''A soma dos dias da parcelas 1 est\00E1 superior aos dias de direito de ''||dias_direito||'' dias. Informe uma quantidade diferente.'';'),
' elsif nvl(dias_direito,0) < (nvl(num_dias_parc1,0) + nvl(dias_abono_pec1,0) + nvl(num_dias_parc2,0) + nvl(dias_abono_pec2,0)) and :p78_dt_saida_parc1 is not null and :p78_dt_saida_parc2 is not null then',
'    v_flg_retorno := ''N'';',
unistr('    v_msg_retorno := ''A soma dos dias das parcelas 1 e 2, est\00E1 superior aos dias de direito de ''||dias_direito||'' dias. Informe uma quantidade diferente.'';'),
' elsif nvl(dias_direito,0) < (nvl(num_dias_parc1,0) + nvl(dias_abono_pec1,0) + nvl(num_dias_parc2,0) + nvl(dias_abono_pec2,0) + nvl(num_dias_parc4,0) + nvl(dias_abono_pec4,0)) and :p78_dt_saida_parc1 is not null and :p78_dt_saida_parc2 is not null an'
||'d :p78_dt_saida_parc4 is not null then',
'    v_flg_retorno := ''N'';',
unistr('    v_msg_retorno := ''A soma dos dias das parcelas 1, 2 e 3, est\00E1 superior aos dias de direito de ''||dias_direito||'' dias. Informe uma quantidade diferente.'';'),
' end if;',
'',
'if :p78_meses_adm >= 12 then',
'    if ((:P78_PARCELAS_OPC = 1 and :P78_DT_SAIDA_PARC1 IS NOT NULL) OR',
'       (:P78_PARCELAS_OPC = 2 and :P78_DT_SAIDA_PARC1 IS NOT NULL AND :P78_DT_SAIDA_PARC2 IS NOT NULL) OR',
'       (:P78_PARCELAS_OPC = 3 and :P78_DT_SAIDA_PARC1 IS NOT NULL AND :P78_DT_SAIDA_PARC2 IS NOT NULL AND :P78_DT_SAIDA_PARC4 IS NOT NULL)) AND',
'       (nvl(dias_direito,0) < (nvl(num_dias_parc1,0) + nvl(dias_abono_pec1,0) + nvl(num_dias_parc2,0) + nvl(dias_abono_pec2,0) + nvl(num_dias_parc4,0) + nvl(dias_abono_pec4,0)))',
'    then',
'        v_flg_retorno := ''N'';',
unistr('        v_msg_retorno := ''A soma do(s) dia(s) da(s) parcela(s), est\00E1 inferior aos dias de direito de ''||dias_direito||'' dias. Distribua os dias corretamente.'';'),
'    end if;',
'end if;',
'',
' if trim(v_msg_retorno) is not null then',
' return v_msg_retorno;',
' end if;',
' ',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(276100245691694936177)
,p_validation_name=>'Valida Data InformadaX'
,p_validation_sequence=>60
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if :p78_dt_saida_parc1_1 is null and :p78_dt_saida_parc1 is null then',
unistr('return ''Deve se informar a data de sa\00EDda de f\00E9rias!'';'),
'elsif (:p78_dt_saida_parc1_1 is not null or :p78_dt_saida_parc1 is not null) and :p78_dt_saida_parc2_1 is null and :p78_dt_saida_parc2 is null then',
unistr('return ''Deve se informar a data de sa\00EDda de f\00E9rias!'';'),
'elsif (:p78_dt_saida_parc1_1 is not null or :p78_dt_saida_parc1 is not null) or (:p78_dt_saida_parc2_1 is not null or :p78_dt_saida_parc2 is not null) and :p78_dt_saida_parc4_1 is null and :p78_dt_saida_parc4 is null then',
unistr('return ''Deve se informar a data de sa\00EDda de f\00E9rias!'';'),
'end if;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_validation_condition_type=>'NEVER'
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(276100246167257936182)
,p_validation_name=>'Valida Dias Direito'
,p_validation_sequence=>70
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if :P78_DIAS_DIREITO_OPC = 0 then',
unistr('return ''Para este per\00EDodo de f\00E9rias, o colaborador n\00E3o tem mais dias dispon\00EDveis a ser gozado.'';'),
'end if;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(275664519565838751731)
,p_validation_name=>'Pre_Insert'
,p_validation_sequence=>80
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'v_dias_abono_pec FERIAS.dias_abono_pec1%TYPE;',
'begin',
'',
'--pkg_ferias.debug(''Pre_Insert'');',
'',
'v_dias_abono_pec := nvl(:p78_dias_abono_pec1,:p78_dias_abono_pec1_1);',
'PKG_FERIAS.Pre_Insert( :p78_cod_solicitacao,',
'                       nvl(:p78_cod_empresa,:P78_COD_EMPRESA_1),',
'                       :p78_filial,',
'                       :p78_matricula,',
'                       :p78_sit_requisicao,',
'                       nvl(:p78_ind_situacao_periodo,:p78_ind_situacao_periodo_a),',
'                       nvl(:p78_dt_inic_per_ferias,:p78_dt_inic_per_ferias_1),',
'                       nvl(:p78_dt_fim_per_ferias,:p78_dt_fim_per_ferias_1),',
'                       nvl(:p78_num_dias_parc1,:p78_num_dias_parc1_1),',
'                       nvl(:p78_saldo,:p78_saldo_1),',
'                       nvl(:p78_dt_saida_parc1,:p78_dt_saida_parc1_1),  ',
'                       nvl(:p78_dt_saida_parc2,:p78_dt_saida_parc2_1),',
'                       :p78_dt_saida_parc3, -- Igor 30/03',
'                       nvl(:p78_dt_saida_parc4,:p78_dt_saida_parc4_1),',
'                       nvl(:p78_dt_retorno_parc1,nvl(:p78_dt_retorno_parc1_1,NVL(:P78_DT_RETORNO_PARC1_1A, :P78_DT_RETORNO_PARC1_1_AUX))),',
'                       nvl(:p78_dt_retorno_parc2,:p78_dt_retorno_parc2_1),',
'                       :p78_dt_retorno_parc3, -- Igor 30/03',
'                       nvl(:p78_dt_retorno_parc4,:p78_dt_retorno_parc4_1),',
'                      :p78_opcao_13sal1,',
'                      :p78_opcao_13sal2,',
'                      :p78_opcao_13sal4,',
'                       v_dias_abono_pec,',
'                       :p78_jornada_reduzida,',
'                       v_flg_retorno,',
'                       v_msg_retorno,',
'					 :P78_PARCELAS_OPC);',
'',
' if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
'    return trim(v_msg_retorno);',
' end if;',
' ',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(266539450953135476045)
,p_validation_name=>'Valida_Update_Rf'
,p_validation_sequence=>90
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_dias_abono_pec1 number := :p78_dias_abono_pec1;',
'',
'begin',
'',
'--pkg_ferias.debug(''Valida_Update_Rf'');',
'',
'PKG_FERIAS.Valida_Update_Rf(nvl(:p78_cod_empresa,:P78_COD_EMPRESA_1),',
'                            :p78_filial,',
'                            nvl(:p78_dt_saida_parc1,:p78_dt_saida_parc1_1),',
'                            nvl(:p78_dt_fim_per_ferias,:p78_dt_fim_per_ferias_1),',
'                            :p78_num_dias_parc1,',
'                            v_dias_abono_pec1,',
'                            nvl(:p78_saldo,:p78_saldo_1),',
'                            :p78_matricula,',
'                            :p78_jornada_reduzida,',
'                            V_flg_retorno,',
'                            V_msg_retorno);',
'',
' if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
'    return v_msg_retorno;',
' end if;',
' ',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(275584260159028464507)
,p_validation_name=>unistr('OPCAO_FERIAS Obrigat\00F3rio')
,p_validation_sequence=>100
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'cursor c1 is',
'select x.descricao, x.dias',
'from (',
'select ',
'dias_abono_pec1 descricao, dias_abono_pec1 dias, cod_empresa, cod, cod_filial',
'  from ferias_parametros_parcelas',
'union',
'select ',
'dias_abono_pec2 descricao, dias_abono_pec2 dias, cod_empresa, cod, cod_filial',
'  from ferias_parametros_parcelas',
'union',
'select ',
'dias_abono_pec4 descricao, dias_abono_pec4 dias, cod_empresa, cod, cod_filial',
'  from ferias_parametros_parcelas) x',
'where x.dias is not null   ',
'  and x.cod_filial = :p78_filial',
'  and x.cod_empresa = nvl(:p78_cod_empresa,:P78_COD_EMPRESA_1);',
'',
'v_c1 c1%rowtype;',
'',
'begin',
'  IF :P78_OPCAO_FERIAS_DB IS NOT NULL THEN',
'    RETURN NULL;',
'  END IF;',
'',
'open c1;',
'fetch c1 into v_c1;',
'close c1;',
'',
'if v_c1.dias is not null and nvl(:p78_opcao_ferias,:P78_OPCAO_FERIAS_A) is null AND :P78_VINCULO <> ''E'' then',
unistr('return ''O Campo Op\00E7\00F5es de Programa\00E7\00E3o de F\00E9rias \00E9 Obrigat\00F3rio!'';'),
'end if;',
'',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_validation_condition_type=>'NEVER'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
end;
/
begin
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(274129913326446715279)
,p_validation_name=>unistr('Altera\00E7\00F5es Requisi\00E7\00E3o Conclu\00EDda')
,p_validation_sequence=>110
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'IF :P78_SIT_REQUISICAO = 2 THEN',
unistr('RETURN ''Requisi\00E7\00E3o j\00E1 conclu\00EDda, n\00E3o \00E9 permitido realizar altera\00E7\00F5es!'';'),
'END IF;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_always_execute=>'Y'
,p_when_button_pressed=>wwv_flow_api.id(276329683306579718455)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(269156855299612850681)
,p_validation_name=>'Valida_Num_Dias_Parcelas'
,p_validation_sequence=>120
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'num_dias_parc1 number := :P78_num_dias_parc1;',
'num_dias_parc2 number := :P78_num_dias_parc2;',
'num_dias_parc4 number := :P78_num_dias_parc4;',
'',
'dias_abono_pec1 number := :P78_dias_abono_pec1;',
'dias_abono_pec2 number := :P78_dias_abono_pec2;',
'dias_abono_pec4 number := :P78_dias_abono_pec4;',
'',
'dias_direito number := nvl(:P78_dias_direito,:P78_dias_direito_1);',
'',
'begin',
'',
' if nvl(dias_direito,0) < (nvl(num_dias_parc1,0) + nvl(dias_abono_pec1,0)) and :p78_dt_saida_parc1 is not null and :p78_dt_saida_parc2 is null and :p78_dt_saida_parc4 is null then',
'    v_flg_retorno := ''N'';',
unistr('    v_msg_retorno := ''A soma dos dias da parcelas 1 est\00E1 superior aos dias de direito de ''||dias_direito||'' dias. Informe uma quantidade diferente.'';'),
' elsif nvl(dias_direito,0) < (nvl(num_dias_parc1,0) + nvl(dias_abono_pec1,0) + nvl(num_dias_parc2,0) + nvl(dias_abono_pec2,0)) and :p78_dt_saida_parc1 is not null and :p78_dt_saida_parc2 is not null then',
'    v_flg_retorno := ''N'';',
unistr('    v_msg_retorno := ''A soma dos dias das parcelas 1 e 2, est\00E1 superior aos dias de direito de ''||dias_direito||'' dias. Informe uma quantidade diferente.'';'),
' elsif nvl(dias_direito,0) < (nvl(num_dias_parc1,0) + nvl(dias_abono_pec1,0) + nvl(num_dias_parc2,0) + nvl(dias_abono_pec2,0) + nvl(num_dias_parc4,0) + nvl(dias_abono_pec4,0)) and :p78_dt_saida_parc1 is not null and :p78_dt_saida_parc2 is not null an'
||'d :p78_dt_saida_parc4 is not null then',
'    v_flg_retorno := ''N'';',
unistr('    v_msg_retorno := ''A soma dos dias das parcelas 1, 2 e 3, est\00E1 superior aos dias de direito de ''||dias_direito||'' dias. Informe uma quantidade diferente.'';'),
' end if;',
' ',
'  if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
unistr('      return ''N\00FAmero de Dias de Parcelas: ''||v_msg_retorno;'),
'  end if;',
' ',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(269156855154221850679)
,p_validation_name=>'Valida_dt_saida_parc1'
,p_validation_sequence=>130
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_cod_empresa number;',
'v_cod_solicitacao number;',
'v_matricula number;',
'v_dt_inic_per_ferias date;',
'v_dt_fim_per_ferias date;',
'v_dt_saida_parc2 date :=null;',
'v_saldo_bruto number;',
'v_falta_hora number;',
'v_dias_direito number;',
'v_dt_saida_parc1 date;',
'v_saldo number;',
'v_dias_abono_pec1 number;',
'v_num_dias_parc1 number;',
'v_opcao_13sal1 varchar2(1);',
'v_opcao_13sal2 varchar2(1);',
'v_tipo_ferias1 varchar2(1);',
'v_dt_retorno_parc1 date;',
'v_dt_retorno_parc1_old date;',
'v_dt_pagto_parc1 date;',
'v_jornada_reduzida varchar2(10);',
'v_ind_situacao_periodo varchar2(3);',
'',
'begin',
'',
'if :p78_dt_saida_parc1 is not null then',
'',
'v_cod_empresa:= nvl(:p78_cod_empresa,:P78_COD_EMPRESA_1);',
'v_cod_solicitacao := :p78_cod_solicitacao;',
'v_matricula := :p78_matricula;',
'v_dt_inic_per_ferias := nvl(:p78_dt_inic_per_ferias,:p78_dt_inic_per_ferias_1);',
'v_dt_fim_per_ferias := nvl(:p78_dt_fim_per_ferias,:p78_dt_fim_per_ferias_1);',
'v_dt_saida_parc2 := :p78_dt_saida_parc2;',
'v_saldo_bruto := nvl(:p78_saldo_bruto,:p78_saldo_bruto_1);',
'v_falta_hora := nvl(:p78_falta_hora,:p78_falta_hora_1);',
'v_dias_direito := nvl(:p78_dias_direito,:p78_dias_direito_1);',
'v_dt_saida_parc1 := :p78_dt_saida_parc1;',
'v_saldo := nvl(:p78_saldo,:p78_saldo_1);',
'v_dias_abono_pec1 := :p78_dias_abono_pec1;',
'v_num_dias_parc1 := :p78_num_dias_parc1;',
'v_opcao_13sal1 := :p78_opcao_13sal1;',
'v_opcao_13sal2 := :p78_opcao_13sal2;',
'v_tipo_ferias1 := :p78_tipo_ferias1;',
'v_dt_retorno_parc1 := :p78_dt_retorno_parc1;',
'v_dt_retorno_parc1_old := :p78_dt_retorno_parc1;',
'v_dt_pagto_parc1 := :p78_dt_pagto_parc1;',
'v_jornada_reduzida := :p78_jornada_reduzida;',
'v_ind_situacao_periodo := nvl(:p78_ind_situacao_periodo,:p78_ind_situacao_periodo_a);',
'',
'pkg_ferias.Valida_Dt_Saida_Parc1(v_cod_empresa,',
'v_cod_solicitacao,',
'v_matricula,',
'v_dt_inic_per_ferias,',
'v_dt_fim_per_ferias,',
'v_dt_saida_parc2,',
'v_saldo_bruto,',
'v_falta_hora,',
'v_dias_direito,',
'v_dt_saida_parc1,',
'v_saldo,',
'v_dias_abono_pec1,',
'v_num_dias_parc1,',
'v_opcao_13sal1,',
'v_opcao_13sal2,',
'v_tipo_ferias1,',
'v_dt_retorno_parc1,',
'v_dt_pagto_parc1,',
'v_jornada_reduzida,',
'v_ind_situacao_periodo,',
':p78_dias_abono_pec1_dsp,',
':p78_num_dias_parc1_dsp,',
'v_flg_retorno,',
'v_msg_retorno); ',
'',
'  if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
unistr('      return ''Data de Sa\00EDda Parcela 1: ''||v_msg_retorno;'),
'  end if;',
'end if;',
'',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(269156855169212850680)
,p_validation_name=>'Valida_Num_Dias_Parc1'
,p_validation_sequence=>140
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_cod_empresa      number := nvl(:p78_cod_empresa,:P78_COD_EMPRESA_1);',
'v_matricula inf_pessoais.matricula%type := :p78_matricula;',
'v_ind_limpa varchar2(200) := ''N'';',
'v_dt_fim_per_ferias ferias.dt_fim_per_ferias%type := nvl(:p78_dt_fim_per_ferias,:p78_dt_fim_per_ferias_1);',
'v_saldo     number := nvl(:p78_saldo,:p78_saldo_1);',
'v_dt_saida_parc1   ferias.dt_saida_parc1%type := :p78_dt_saida_parc1;',
'v_num_dias_parc1   number(15,2) := :p78_num_dias_parc1;',
'v_dt_retorno_parc1 ferias.dt_retorno_parc1%type := :p78_dt_retorno_parc1;',
'v_dt_retorno_parc1_old    ferias.dt_retorno_parc1%type := :p78_dt_retorno_parc1;',
'v_dias_descanso_adicional ferias.dias_descanso_adicional%type := :p78_dias_descanso_adicional;',
'v_desc_adicional1  ferias.desc_adicional1%type := :p78_desc_adicional1;',
'v_tipo_ferias1     ferias.tipo_ferias1%type := :p78_tipo_ferias1;',
'v_dias_abono_pec1  number := :p78_dias_abono_pec1;',
'v_dias_direito     number := nvl(:p78_dias_direito,:p78_dias_direito_1);',
'v_ind_situacao_periodo    ferias.ind_situacao_periodo%type := nvl(:p78_ind_situacao_periodo,:p78_ind_situacao_periodo_a);',
'v_jornada_reduzida varchar2(100) := :p78_jornada_reduzida;',
'',
'begin',
'',
'if :p78_dt_saida_parc1 is not null then',
'',
'pkg_ferias.Valida_Num_Dias_Parc1(v_cod_empresa,',
'     v_matricula,',
'     v_ind_limpa,',
'     v_dt_fim_per_ferias,',
'     v_saldo,',
'     v_dt_saida_parc1,',
'     v_num_dias_parc1,',
'     v_dt_retorno_parc1,',
'     v_dias_descanso_adicional,',
'     v_desc_adicional1,',
'     v_tipo_ferias1,',
'     v_dias_abono_pec1,',
'     v_dias_direito,',
'     v_ind_situacao_periodo,',
'     v_jornada_reduzida,',
'     :p78_dias_abono_pec1_dsp,',
'     :p78_num_dias_parc1_dsp,',
'     v_flg_retorno,',
'     v_msg_retorno,',
'     nvl(:p78_opcao_ferias,:P78_OPCAO_FERIAS_A));',
'',
'  if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
unistr('      return ''N\00FAmero de Dias Parcela 1: ''||v_msg_retorno;'),
'  end if;',
'',
'end if;',
'',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(269156855412391850682)
,p_validation_name=>'Valida_Dias_Abono_Pec1'
,p_validation_sequence=>150
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'',
'if :p78_dt_saida_parc1 is not null then',
'',
'pkg_ferias.Valida_Dias_Abono_Pec1(nvl(:p78_cod_empresa,:P78_COD_EMPRESA_1)        ,',
'                                  :p78_matricula          ,',
'                                  :p78_filial             ,',
'                                  nvl(:p78_dt_inic_per_ferias,:p78_dt_inic_per_ferias_1) ,',
'                                  nvl(:p78_dt_fim_per_ferias,:p78_dt_fim_per_ferias_1)  ,',
'                                  :p78_num_dias_parc1     ,',
'                                  :p78_dt_saida_parc1     ,',
'                                  nvl(:p78_saldo,:p78_saldo_1)              ,',
'                                  :p78_dias_abono_pec1    ,',
'                                  :p78_opcao_abono_pec1   ,',
'                                  nvl(:p78_ind_situacao_periodo,:p78_ind_situacao_periodo_a),',
'                                  nvl(:p78_dias_direito,:p78_dias_direito_1)       ,',
'                                  :p_usuario,',
'                                  v_flg_retorno        ,',
'                                  v_msg_retorno        );',
' ',
'',
'  if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
unistr('      return ''N\00FAmero de Dias Abono Parcela 1: ''||v_msg_retorno;'),
'  end if;',
'',
'end if;',
'',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(269156855478476850683)
,p_validation_name=>'Valida_Opcao_13Sal1'
,p_validation_sequence=>160
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'',
'IF :p78_opcao_13sal1 IS NOT NULL AND',
'   :p78_dt_saida_parc1 IS NOT NULL THEN -- Bruno Sousa 30/12/2024',
'   ',
'pkg_ferias.Valida_Opcao_13Sal1(nvl(:p78_cod_empresa,:P78_COD_EMPRESA_1),',
'                               :p78_matricula,',
'                               :p78_dt_saida_parc1,',
'                               :p78_dt_retorno_parc1,',
'                               :p78_opcao_13sal1,',
'                               nvl(:p78_ind_situacao_periodo,:p78_ind_situacao_periodo_a),',
'                               NVL(:P78_COD_REQ,:P78_COD_SOLICITACAO),',
'                               v_flg_retorno,',
'                               v_msg_retorno);',
' ',
' ',
'  if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
unistr('      return ''Op\00E7\00E3o 13 Sal. Parcela 1: ''||v_msg_retorno;'),
'  end if;',
' ',
'END IF;',
' ',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(269156855623778850684)
,p_validation_name=>'Valida_Desc_Adicional1'
,p_validation_sequence=>170
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'',
'if :p78_dt_saida_parc1 is not null then',
'',
'    pkg_ferias.Valida_Desc_Adicional1(:p78_desc_adicional1,',
'                                      :p78_dias_descanso_adicional,',
'                                      nvl(:p78_ind_situacao_periodo,:p78_ind_situacao_periodo_a),',
'                                    v_flg_retorno,',
'                                    v_msg_retorno);',
'',
'  if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
'      return ''Desconto Adicional Parcela 1: ''||v_msg_retorno;',
'  end if;',
'',
'end if;',
'',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(269156855746835850685)
,p_validation_name=>'Valida_Tipo_Ferias1'
,p_validation_sequence=>180
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'    ',
'    if :p78_dt_saida_parc1 is not null then',
'    ',
'       pkg_ferias.Valida_Tipo_Ferias1(nvl(:p78_cod_empresa,:P78_COD_EMPRESA_1)        ,',
'                                      :p78_matricula          ,',
'                                      nvl(:p78_dt_inic_per_ferias,:p78_dt_inic_per_ferias_1) ,',
'                                      nvl(:p78_dt_fim_per_ferias,:p78_dt_fim_per_ferias_1)  ,',
'                                      :p78_data_ref,',
'                                      :p78_tipo_ferias1,',
'                                      nvl(:p78_ind_situacao_periodo,:p78_ind_situacao_periodo_a),',
'                                      v_flg_retorno        ,',
'                                      v_msg_retorno        );',
'     ',
'      if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
unistr('          return ''Tipo de F\00E9rias Parcela 1: ''||v_msg_retorno;'),
'      end if;',
'     ',
'    end if;',
'     ',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(269156855834468850686)
,p_validation_name=>'Valida_dt_saida_parc2'
,p_validation_sequence=>190
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_DIAS_ABONO_PEC2 number := :P78_DIAS_ABONO_PEC2;',
'',
'begin',
'if :P78_DT_SAIDA_PARC2 is not null then',
'',
'pkg_ferias.Valida_Dt_Saida_Parc2(nvl(:p78_cod_empresa,:P78_COD_EMPRESA_1),',
'                                  :p78_cod_solicitacao,',
'                                  :p78_matricula,',
'                                  nvl(:p78_dt_saida_parc1,:p78_dt_saida_parc1_1),',
'                                  nvl(:p78_dt_retorno_parc1,:p78_dt_retorno_parc1_1),',
'                                  nvl(:p78_num_dias_parc1,:p78_num_dias_parc1_1),',
'                                  :p78_dt_saida_parc2,',
'                                  nvl(:p78_dias_abono_pec1,:p78_dias_abono_pec1_1),',
'                                  nvl(:p78_dt_inic_per_ferias,:p78_dt_inic_per_ferias_1),',
'                                  nvl(:p78_dt_fim_per_ferias,:p78_dt_fim_per_ferias_1),',
'                                  nvl(:p78_saldo,:p78_saldo_1),',
'                                  nvl(:p78_dias_direito,:p78_dias_direito_1),',
'                                 -- Inclusao da data limite como parametro nao obrigatorio para calculo da data de saida e retorno - chamado 29668 - Andre - 25-04-2023',
'                                  :P78_DT_LIMITE_REQ,',
'                                  :p78_num_dias_parc2,',
'                                  v_DIAS_ABONO_PEC2,',
'                                  :p78_dt_retorno_parc2,',
'                                  :p78_dt_pagto_parc2,',
'                                  :p78_tipo_ferias2,',
'                                  :p78_opcao_13sal2,',
'                                  :p78_dias_abono_pec1_dsp,',
'                                  :p78_num_dias_parc1_dsp,',
'                                  v_flg_retorno,',
'                                  v_msg_retorno);',
'',
'      if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
unistr('          return ''Data de Sa\00EDda Parcela 2: ''||v_msg_retorno;'),
'      end if;',
'end if;',
'     ',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(269156855871683850687)
,p_validation_name=>'Valida_Num_Dias_Parc2'
,p_validation_sequence=>200
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'',
'    if :p78_dt_saida_parc2 is not null then',
'',
'pkg_ferias.Valida_Num_Dias_Parc2(nvl(:P78_cod_empresa,:P78_COD_EMPRESA_1),',
'                                 :P78_matricula,',
'                                 nvl(:P78_num_dias_parc1,:P78_num_dias_parc1_1),',
'                                 nvl(:P78_dias_abono_pec1,:P78_dias_abono_pec1_1),',
'                                 :P78_dt_saida_parc2,',
'                                 nvl(:P78_dt_inic_per_ferias,:P78_dt_inic_per_ferias_1),',
'                                 nvl(:P78_dt_fim_per_ferias,:P78_dt_fim_per_ferias_1),',
'                                 :P78_dias_descanso_adicional,',
'                                 :P78_dias_abono_pec2,',
'                                 :P78_tipo_ferias2,',
'                                 :P78_desc_adicional1,',
'                                 :P78_desc_adicional2,',
'                                 :P78_num_dias_parc2,',
'                                 :P78_dt_retorno_parc2,',
'                                 :P78_dias_direito,',
'                                 :p_usuario,',
'                                 v_flg_retorno,',
'                                 v_msg_retorno);',
'     ',
'      if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
unistr('          return ''N\00FAmero de Dias Parcela 2: ''||v_msg_retorno;'),
'      end if;',
'     ',
'    end if;',
'     ',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(269156855988980850688)
,p_validation_name=>'Valida_Dias_Abono_Pec2'
,p_validation_sequence=>210
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'',
'    if :p78_dt_saida_parc2 is not null then',
'',
'    pkg_ferias.Valida_Abono_Pec2(nvl(:P78_cod_empresa,:P78_COD_EMPRESA_1),',
'                                 :P78_matricula,',
'                                 nvl(:P78_dt_inic_per_ferias,:P78_dt_inic_per_ferias_1),',
'                                 nvl(:P78_dt_fim_per_ferias,:P78_dt_fim_per_ferias_1),',
'                                 nvl(:P78_ind_situacao_periodo,:P78_ind_situacao_periodo_a),',
'                                 nvl(:P78_dias_direito,:P78_dias_direito_1),',
'                                 nvl(:P78_num_dias_parc1,:P78_num_dias_parc1_1),',
'                                 nvl(:P78_dias_abono_pec1,:P78_dias_abono_pec1_1),',
'                                 :P78_dt_saida_parc2,',
'                                 :P78_num_dias_parc2,',
'                                 :P78_desc_adicional2,',
'                                 :P78_dias_abono_pec2,',
'                                 :P78_opcao_abono_pec2,',
'                                 :P78_dt_retorno_parc2,',
'                                 v_flg_retorno,',
'                                 v_msg_retorno);',
'     ',
'      if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
'          return ''Dias de Abono Parcela 2: ''||v_msg_retorno;',
'      end if;',
'     ',
'    end if;',
'     ',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(269156856150838850689)
,p_validation_name=>'Valida_Opcao_13Sal2'
,p_validation_sequence=>220
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'if :p78_opcao_13sal2 is not null AND',
'   nvl(:p78_dt_saida_parc1,:p78_dt_saida_parc1_1) IS NOT NULL AND',
'   :p78_dt_saida_parc2 IS NOT NULL THEN -- Bruno Sousa 30/12/2024',
'',
'',
'pkg_ferias.Valida_Opcao_13Sal2(nvl(:p78_cod_empresa,:P78_COD_EMPRESA_1),',
'                               :p78_matricula,',
'                               nvl(:p78_opcao_13sal1,:p78_opcao_13sal1_1),',
'                               nvl(:P78_DT_SAIDA_PARC1,:P78_DT_SAIDA_PARC1_1),',
'                               :p78_opcao_13sal2,',
'                               :p78_dt_saida_parc2,',
'                               :p78_dt_retorno_parc2,',
'                               NVL(:P78_COD_REQ,:P78_COD_SOLICITACAO),',
'                               v_flg_retorno,',
'                               v_msg_retorno);',
'     ',
'      if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
unistr('          return ''Op\00E7\00E3o 13 sal. Parcela 2: ''||v_msg_retorno;'),
'      end if;',
'     ',
'end if;     ',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(269156856183593850690)
,p_validation_name=>'Valida_Desc_Adicional2'
,p_validation_sequence=>230
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'',
'    if :p78_dt_saida_parc2 is not null then',
'',
'pkg_ferias.Valida_Desc_Adicional2(:p78_dias_descanso_adicional,',
'                                  :p78_desc_adicional1,',
'                                  :P78_dt_saida_parc2,',
'                                  :p78_num_dias_parc2,',
'                                  :p78_desc_adicional2,',
'                                  :p78_dt_retorno_parc2,',
'                                  v_flg_retorno,',
'                                  v_msg_retorno);',
'     ',
'      if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
'          return ''Descanso Adicional Parcela 2: ''||v_msg_retorno;',
'      end if;',
'     ',
'    end if;',
'     ',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(269156856416427850692)
,p_validation_name=>'Valida_dt_saida_parc4'
,p_validation_sequence=>240
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_DIAS_ABONO_PEC4 number := :P78_DIAS_ABONO_PEC4;',
'',
'begin',
'',
'    if :p78_dt_saida_parc4 is not null then',
'',
'pkg_ferias.Valida_Dt_Saida_Parc4(nvl(:p78_cod_empresa,:P78_COD_EMPRESA_1),',
'                                  :p78_cod_solicitacao,',
'                                  :p78_matricula,',
'                                  nvl(:p78_dt_saida_parc1,:p78_dt_saida_parc1_1),',
'                                  :p78_dt_retorno_parc1,',
'                                  nvl(:p78_dt_saida_parc2,:p78_dt_saida_parc2_1),',
'                                  :p78_dt_retorno_parc2,',
'                                  nvl(:p78_num_dias_parc1,:p78_num_dias_parc1_1),',
'                                  nvl(:p78_num_dias_parc2,:p78_num_dias_parc2_1),',
'                                  :p78_dt_saida_parc4,',
'                                  nvl(:p78_dias_abono_pec1,:p78_dias_abono_pec1_1),',
'                                  nvl(:p78_dt_inic_per_ferias,:p78_dt_inic_per_ferias_1),',
'                                  nvl(:p78_dt_fim_per_ferias,:p78_dt_fim_per_ferias_1),',
'                                  nvl(:p78_saldo,:p78_saldo_1),',
'                                  nvl(:p78_dias_direito,:p78_dias_direito_1),',
'                                 -- Inclusao da data limite como parametro nao obrigatorio para calculo da data de saida e retorno - chamado 29668 - Andre - 25-04-2023                                 ',
'                                  :P78_DT_LIMITE_REQ,',
'                                  :p78_num_dias_parc4,',
'                                  :p78_dias_abono_pec4,',
'                                  :p78_dt_retorno_parc4,',
'                                  :p78_dt_pagto_parc4,',
'                                  :p78_tipo_ferias4,',
'                                  :p78_opcao_13sal4,',
'                                  :p78_dias_abono_pec1_dsp,',
'                                  :p78_num_dias_parc1_dsp,',
'                                  v_flg_retorno,',
'                                  v_msg_retorno);',
'     ',
'      if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
unistr('          return ''Data de Sa\00EDda Parcela 3: ''||v_msg_retorno;'),
'      end if;',
'    end if;',
'     ',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(266554987485590898046)
,p_validation_name=>'Valida_dt_retorno_parc1'
,p_validation_sequence=>250
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'',
':p78_mensagem := null;',
'',
'pkg_ferias.Valida_Dt_Retorno_Parc1(:p78_dt_retorno_parc1,',
'                                   nvl(:p78_ind_situacao_periodo,:p78_ind_situacao_periodo_a),                        ',
'                                   v_flg_retorno,',
'                                   v_msg_retorno,',
'                                   :p78_dt_saida_parc1,',
'                                   nvl(:p78_dt_fim_per_ferias,:p78_dt_fim_per_ferias_1),',
'                                    nvl(:p78_cod_empresa,:P78_COD_EMPRESA_1),',
'                                    :p78_matricula,',
'                                    nvl(:p78_dt_inic_per_ferias,:p78_dt_inic_per_ferias_1));',
'',
'if trim(v_msg_retorno) is not null then',
'return v_msg_retorno;',
'end if;',
'',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_associated_item=>wwv_flow_api.id(276329719387778718487)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(266554987438599898045)
,p_validation_name=>'Valida_dt_retorno_parc2'
,p_validation_sequence=>260
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'',
':p78_mensagem := null;',
'',
'pkg_ferias.Valida_Dt_Retorno_Parc2(:p78_dt_retorno_parc2,',
'                                   nvl(:p78_ind_situacao_periodo,:p78_ind_situacao_periodo_a),                        ',
'                                   v_flg_retorno,',
'                                   v_msg_retorno,',
'                                   :p78_dt_saida_parc2,',
'                                   nvl(:p78_dt_fim_per_ferias,:p78_dt_fim_per_ferias_1),',
'                                    nvl(:p78_cod_empresa,:P78_COD_EMPRESA_1),',
'                                    :p78_matricula,',
'                                    nvl(:p78_dt_inic_per_ferias,:p78_dt_inic_per_ferias_1));',
'',
'if trim(v_msg_retorno) is not null then',
'return v_msg_retorno;',
'end if;',
'',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_associated_item=>wwv_flow_api.id(276329724028144718493)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(266554987296278898044)
,p_validation_name=>'Valida_dt_retorno_parc4'
,p_validation_sequence=>270
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'',
':p78_mensagem := null;',
'',
'pkg_ferias.Valida_Dt_Retorno_Parc4(:p78_dt_retorno_parc4,',
'                                   nvl(:p78_ind_situacao_periodo,:p78_ind_situacao_periodo_a),                        ',
'                                   v_flg_retorno,',
'                                   v_msg_retorno,',
'                                   :p78_dt_saida_parc4,',
'                                   nvl(:p78_dt_fim_per_ferias,:p78_dt_fim_per_ferias_1),',
'                                    nvl(:p78_cod_empresa,:P78_COD_EMPRESA_1),',
'                                    :p78_matricula,',
'                                    nvl(:p78_dt_inic_per_ferias,:p78_dt_fim_per_ferias_1),',
'                                    :p78_dt_saida_parc2);',
'',
'if trim(v_msg_retorno) is not null then',
'return v_msg_retorno;',
'end if;',
'',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_associated_item=>wwv_flow_api.id(276329708393136718480)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(269156856531108850693)
,p_validation_name=>'Valida_Num_Dias_Parc4'
,p_validation_sequence=>280
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'',
'    if :p78_dt_saida_parc4 is not null then',
'',
'pkg_ferias.Valida_Num_Dias_Parc4(nvl(:P78_cod_empresa,:P78_COD_EMPRESA_1),',
'                                    :P78_matricula,',
'                                    nvl(:P78_num_dias_parc1,:P78_num_dias_parc1_1),',
'                                    nvl(:P78_num_dias_parc2,:P78_num_dias_parc2_1),',
'                                    :P78_num_dias_parc4,',
'                                    nvl(:P78_dias_abono_pec1,:P78_dias_abono_pec1_1),',
'                                    nvl(:P78_dias_abono_pec2,:P78_dias_abono_pec2_1),',
'                                    nvl(:P78_dt_saida_parc2,:P78_dt_saida_parc2_1),',
'                                    :P78_dt_saida_parc4,',
'                                    nvl(:P78_dt_inic_per_ferias,:P78_dt_inic_per_ferias_1),',
'                                    nvl(:P78_dt_fim_per_ferias,:P78_dt_fim_per_ferias_1),                            ',
'                                    nvl(:p78_saldo,:p78_saldo_1),',
'                                    nvl(:p78_ind_situacao_parc_2,:p78_ind_situacao_parc_2_a),',
'                                    :p78_dias_abono_pec4,                                    ',
'                                    :P78_dias_descanso_adicional,',
'                                    :P78_dias_abono_pec4,',
'                                    :P78_tipo_ferias4,',
'                                    :P78_desc_adicional1,',
'                                    :P78_desc_adicional2,',
'                                    :P78_desc_adicional4,',
'                                    :P78_dt_retorno_parc4,',
'                                    nvl(:P78_dias_direito,:P78_dias_direito_1),',
'                                    v_flg_retorno,',
'                                    v_msg_retorno,                    ',
'                                    :p_usuario);',
'     ',
'      if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
unistr('          return ''N\00FAmero de Dias Parcela 3: ''||v_msg_retorno;'),
'      end if;',
'     ',
'    end if;',
'     ',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_validation_condition=>'return 1=2;'
,p_validation_condition_type=>'FUNCTION_BODY'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
end;
/
begin
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(269156856659476850694)
,p_validation_name=>'Valida_Dias_Abono_Pec4'
,p_validation_sequence=>290
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'',
'    if :p78_dt_saida_parc4 is not null then',
'',
'pkg_ferias.Valida_Abono_Pec4(nvl(:P78_cod_empresa,:P78_COD_EMPRESA_1),',
'                             :P78_matricula,',
'                             nvl(:P78_dt_inic_per_ferias,:P78_dt_inic_per_ferias_1),',
'                             nvl(:P78_dt_fim_per_ferias,:P78_dt_fim_per_ferias_1),',
'                             nvl(:P78_ind_situacao_periodo,:P78_ind_situacao_periodo_a),',
'                             nvl(:P78_dias_direito,:P78_dias_direito_1),',
'                             nvl(:P78_num_dias_parc1,:P78_num_dias_parc1_1),',
'                             nvl(:P78_dias_abono_pec1,:P78_dias_abono_pec1_1),',
'                             nvl(:P78_dt_saida_parc2,:P78_dt_saida_parc2_1),',
'                             nvl(:P78_num_dias_parc2,:P78_num_dias_parc2_1),',
'                             nvl(:P78_desc_adicional2,:P78_desc_adicional2_1),',
'                             nvl(:P78_dias_abono_pec2,:P78_dias_abono_pec2_1),',
'                             :P78_dt_saida_parc4,',
'                             :P78_num_dias_parc4,',
'                             :P78_desc_adicional4,',
'                             :P78_dias_abono_pec4,',
'                             :P78_opcao_abono_pec4,',
'                             :P78_dt_retorno_parc4,',
'                             v_flg_retorno,',
'                             v_msg_retorno);',
'',
'     ',
'      if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
'          return ''Dias de Abono Parcela 3: ''||v_msg_retorno;',
'      end if;',
'     ',
'    end if;',
'     ',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_validation_condition=>'return 1=2;'
,p_validation_condition_type=>'FUNCTION_BODY'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(269156856689174850695)
,p_validation_name=>'Valida_Opcao_13Sal4'
,p_validation_sequence=>300
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'',
'IF :p78_opcao_13sal4 IS NOT NULL AND ',
'   nvl(:p78_dt_saida_parc1,:p78_dt_saida_parc1_1) IS NOT NULL AND',
'   nvl(:p78_dt_saida_parc2,:p78_dt_saida_parc2_1) IS NOT NULL AND',
'   :p78_dt_saida_parc4 IS NOT NULL THEN -- Bruno Sousa 30/12/2024',
'   ',
'pkg_ferias.Valida_Opcao_13Sal4(nvl(:p78_cod_empresa,:P78_COD_EMPRESA_1),',
'                               :p78_matricula,',
'                               :p78_opcao_13sal1,',
'                               nvl(:p78_dt_saida_parc1,:p78_dt_saida_parc1_1),',
'                               nvl(:p78_opcao_13sal2,:p78_opcao_13sal2_1),',
'                               nvl(:p78_dt_saida_parc2,:p78_dt_saida_parc2_1),',
'                               :p78_dt_retorno_parc2,',
'                               :p78_opcao_13sal4,',
'                               :p78_dt_saida_parc4,',
'                               :p78_dt_retorno_parc4,',
'                               NVL(:P78_COD_REQ,:P78_COD_SOLICITACAO),',
'                               v_flg_retorno,',
'                               v_msg_retorno);',
' ',
' ',
'      if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
unistr('          return ''Op\00E7\00E3o 13 Sal. Parcela 3: ''||v_msg_retorno;'),
'      end if;',
'     ',
'end if;',
'     ',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_validation_condition=>'return 1=2;'
,p_validation_condition_type=>'FUNCTION_BODY'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(269156856858234850696)
,p_validation_name=>'Valida_Desc_Adicional4'
,p_validation_sequence=>310
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'',
'',
'IF :p78_dt_saida_parc4 IS NOT NULL THEN',
' ',
'pkg_ferias.Valida_Desc_Adicional4(:p78_dias_descanso_adicional,',
'                                  nvl(:p78_desc_adicional1,:p78_desc_adicional1_1),',
'                                  nvl(:p78_dt_saida_parc2,:p78_dt_saida_parc2_1),',
'                                  nvl(:p78_num_dias_parc2,:p78_num_dias_parc2_1),',
'                                  nvl(:p78_desc_adicional2,:p78_desc_adicional2_1),',
'                                  :p78_dt_saida_parc4,',
'                                  :p78_num_dias_parc4,',
'                                  :p78_desc_adicional4,',
'                                  :p78_dt_retorno_parc4,',
'                                  v_flg_retorno,',
'                                  v_msg_retorno);',
' ',
' ',
'      if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
'          return ''Descanso Adicional Parcela 3: ''||v_msg_retorno;',
'      end if;',
'     ',
'end if;',
'     ',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_validation_condition=>'return 1=2;'
,p_validation_condition_type=>'FUNCTION_BODY'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(266508381755922243014)
,p_validation_name=>unistr('Valida Matr\00EDcula Escolhida')
,p_validation_sequence=>320
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'',
'pkg_ferias.Valida_Matricula_Solicitado(nvl(:p78_cod_empresa,:P78_COD_EMPRESA_1), :p78_matricula, v_flg_retorno, v_msg_retorno);',
'',
'    if v_flg_retorno = ''N'' and trim(v_msg_retorno) is not null then',
'        return v_msg_retorno;',
'    else ',
'      if :p_painel = ''PC'' and :p78_matricula <> :p_matricula_user then',
unistr('        return ''Matr\00EDcula Inv\00E1lida!'';'),
'      else',
'        return null;',
'      end if;',
'    end if;',
' ',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_validation_condition=>'return 1=2;'
,p_validation_condition_type=>'FUNCTION_BODY'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_associated_item=>wwv_flow_api.id(276329689519687718464)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(265220009587682756727)
,p_validation_name=>'Valida Aprovadores'
,p_validation_sequence=>330
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'cursor c1 is',
'select cod_empresa, filial, cod_ccusto, matricula',
'  from informacoes_funcionais',
' where cod_empresa = nvl(:p78_cod_empresa,:P78_COD_EMPRESA_1)',
'   and matricula = :p78_matricula;',
'   ',
'v_c1 c1%rowtype;',
'',
'begin',
'',
'if :P_BASE = ''STEFANINI'' then',
'',
'open c1;',
'fetch c1 into v_c1;',
'close c1;',
'',
'v_flg_retorno := pkg_req.VALIDA_EXISTE_APROV(v_c1.cod_empresa,',
'                                              v_c1.filial,',
'                                              v_c1.cod_ccusto,',
'                                              v_c1.matricula,',
'                                              :p_empresa_user, ',
'                                              :p_matricula_user, ',
'                                              null, ',
'                                              ''FERIAS'');',
'',
'    if nvl(v_flg_retorno,''S'') = ''N'' then',
unistr('        return ''N\00E3o foi parametrizado aprovadores para sua requisi\00E7\00E3o. Por favor, entrar em contato com os administradores do sistema!'';'),
'    else',
'        return null;',
'    end if;',
'',
'end if;',
'',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_validation_condition=>'return 1=2;'
,p_validation_condition_type=>'FUNCTION_BODY'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_associated_item=>wwv_flow_api.id(276329689519687718464)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(266508439320465573720)
,p_validation_name=>'Valida_sit_Requisicao'
,p_validation_sequence=>340
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'',
'pkg_ferias.Valida_Sit_Requisicao(nvl(:p78_cod_empresa,:P78_COD_EMPRESA_1), :p78_cod_solicitacao, :p78_matricula, :p78_sit_requisicao, :p_usuario, v_flg_retorno, v_msg_retorno);',
' ',
' if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
'    return v_msg_retorno;',
' end if;',
' ',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683306579718455)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(266539450856122476044)
,p_validation_name=>'Valida Campos em Branco'
,p_validation_sequence=>350
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if :P78_DT_SAIDA_PARC1 is null and :P78_DT_SAIDA_PARC1_1 is null and :P78_PARCELAS_OPC = 1 then',
'    ',
'    if :P78_DT_SAIDA_PARC1 is null and',
'        :P78_DT_SAIDA_PARC1_1 is null and',
'        :P78_NUM_DIAS_PARC1 is null and',
'        :P78_NUM_DIAS_PARC1_1 is null then',
'       ',
'    ',
unistr('    return ''Campos em Branco na 1\00AA Parcela!'';'),
'    ',
'    end if;',
'    ',
'end if;',
'',
'if :P78_DT_SAIDA_PARC2 is null and :P78_DT_SAIDA_PARC2_1 is null and :P78_PARCELAS_OPC = 2 then',
'    ',
'    if :P78_DT_SAIDA_PARC1 is null and',
'        :P78_DT_SAIDA_PARC1_1 is null and',
'        :P78_NUM_DIAS_PARC1 is null and',
'        :P78_NUM_DIAS_PARC1_1 is null then',
'       ',
'    ',
unistr('    return ''Campos em Branco na 1\00AA Parcela!'';'),
'    ',
'    end if;        ',
'    ',
'    if  :P78_DT_SAIDA_PARC2 is null and',
'        :P78_DT_SAIDA_PARC2_1 is null and',
'        :P78_NUM_DIAS_PARC2 is null and',
'        :P78_NUM_DIAS_PARC2_1 is null',
'        then',
'    ',
unistr('    return ''Campos em Branco na 2\00AA Parcela!'';'),
'',
'    end if;',
'    ',
'end if;',
'',
'if :P78_DT_SAIDA_PARC4 is null and :P78_DT_SAIDA_PARC4_1 is null and :P78_PARCELAS_OPC = 3 then',
'    ',
'    if :P78_DT_SAIDA_PARC1 is null and',
'        :P78_DT_SAIDA_PARC1_1 is null and',
'        :P78_NUM_DIAS_PARC1 is null and',
'        :P78_NUM_DIAS_PARC1_1 is null then',
'       ',
'    ',
unistr('    return ''Campos em Branco na 1\00AA Parcela!'';'),
'    ',
'    end if;    ',
'    ',
'    if  :P78_DT_SAIDA_PARC2 is null and',
'        :P78_DT_SAIDA_PARC2_1 is null and',
'        :P78_NUM_DIAS_PARC2 is null and',
'        :P78_NUM_DIAS_PARC2_1 is null',
'        then',
'    ',
unistr('    return ''Campos em Branco na 2\00AA Parcela!'';'),
'',
'    end if;    ',
'    ',
'    ',
'    if :P78_DT_SAIDA_PARC4 is null and',
'       :P78_DT_SAIDA_PARC4_1 is null and',
'       :P78_NUM_DIAS_PARC4 is null and',
'       :P78_NUM_DIAS_PARC4_1 is null',
'    then ',
'    ',
unistr('    return ''Campos em Branco na 3\00AA Parcela!'';'),
'    ',
'    end if;',
'    ',
'end if;',
'',
'if :P78_DT_SAIDA_PARC1 is not null and :P78_DT_SAIDA_PARC1_1 is null then',
'    ',
'    if :P78_NUM_DIAS_PARC1 is null then',
unistr('    return ''Preencha o n\00FAmero de dias da 1\00AA Parcela!'';'),
'    end if;',
'    ',
'end if;',
'',
'if :P78_DT_SAIDA_PARC2 is not null and :P78_DT_SAIDA_PARC2_1 is null then',
'    ',
'    if :P78_NUM_DIAS_PARC2 is null then',
unistr('    return ''Preencha o n\00FAmero de dias da 2\00AA Parcela!'';'),
'    end if;',
'    ',
'end if;',
'',
'if :P78_DT_SAIDA_PARC4 is not null and :P78_DT_SAIDA_PARC4_1 is null then',
'    ',
'    if :P78_NUM_DIAS_PARC4 is null then',
unistr('    return ''Preencha o n\00FAmero de dias da 3\00AA Parcela!'';'),
'    end if;',
'    ',
'end if;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_validation_condition=>'return 1=2;'
,p_validation_condition_type=>'FUNCTION_BODY'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(266554986316344898034)
,p_validation_name=>'PRE-UPDATE'
,p_validation_sequence=>360
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'',
'PKG_FERIAS.Pre_Update ( :p78_cod_solicitacao,',
'                       :p78_sit_requisicao,',
'                       :p78_dt_saida_parc1,',
'                       :p78_dt_saida_parc2,',
'                       :p78_dt_saida_parc3,',
'                       :p78_dt_saida_parc4,',
'                       :p78_dt_retorno_parc1,',
'                       :p78_dt_retorno_parc2,',
'                       :p78_dt_retorno_parc3,',
'                       :p78_dt_retorno_parc4,',
'                       :p78_usuario,',
'                       v_flg_retorno,',
'                       v_msg_retorno);',
'',
' if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
'    return v_msg_retorno;',
' end if;',
' ',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683306579718455)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(230262914251372515231)
,p_validation_name=>unistr('Valida Estatut\00E1rio')
,p_validation_sequence=>370
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'DECLARE',
'  vReturn  VARCHAR2(550) DEFAULT NULL;',
'  vParcela VARCHAR2(1)   DEFAULT NULL;',
'BEGIN',
'  IF :P78_DT_SAIDA_PARC1 IS NOT NULL AND :P78_DT_RETORNO_PARC1 IS NOT NULL THEN',
'    vParcela := ''1'';',
'    --',
'    vReturn := Pkg_Ferias.fnc_ValidaEstatutario(pEmpresa        => nvl(:P78_COD_EMPRESA,:P78_COD_EMPRESA_1)',
'                                               ,pMatricula      => :P78_MATRICULA',
'                                               ,pTipo           => 3',
'                                               ,pDtSaidaParc    => :P78_DT_SAIDA_PARC1',
'                                               ,pDtSaidaParcX   => :P78_DT_SAIDA_PARC2',
'                                               ,pDtFimPerFerias => NVL(:P78_DT_FIM_PER_FERIAS, :P78_DT_FIM_PER_FERIAS_1)',
'                                               ,pDtRetornParc  => :P78_DT_RETORNO_PARC1);',
'  END IF; ',
'  --',
'  IF vReturn IS NULL THEN  ',
'    IF :P78_DT_SAIDA_PARC2 IS NOT NULL AND :P78_DT_RETORNO_PARC2 IS NOT NULL THEN',
'    vParcela := ''2'';',
'    --',
'    vReturn := Pkg_Ferias.fnc_ValidaEstatutario(pEmpresa        => nvl(:P78_COD_EMPRESA,:P78_COD_EMPRESA_1)',
'                                               ,pMatricula      => :P78_MATRICULA',
'                                               ,pTipo           => 3',
'                                               ,pDtSaidaParc    => :P78_DT_SAIDA_PARC2',
'                                               ,pDtSaidaParcX   => :P78_DT_SAIDA_PARC4',
'                                               ,pDtFimPerFerias => NVL(:P78_DT_FIM_PER_FERIAS, :P78_DT_FIM_PER_FERIAS_1)',
'                                               ,pDtRetornParc  => :P78_DT_RETORNO_PARC2);',
'    END IF; ',
'  END IF;',
'  --',
'  IF vReturn IS NULL THEN  ',
'    IF :P78_DT_SAIDA_PARC4 IS NOT NULL AND :P78_DT_RETORNO_PARC4 IS NOT NULL THEN',
'      vParcela := ''3'';',
'      --',
'      vReturn := Pkg_Ferias.fnc_ValidaEstatutario(pEmpresa        => nvl(:P78_COD_EMPRESA,:P78_COD_EMPRESA_1)',
'                                                 ,pMatricula      => :P78_MATRICULA',
'                                                 ,pTipo           => 3',
'                                                 ,pDtSaidaParc    => :P78_DT_SAIDA_PARC4',
'                                                 ,pDtSaidaParcX   => NULL',
'                                                 ,pDtFimPerFerias => NVL(:P78_DT_FIM_PER_FERIAS, :P78_DT_FIM_PER_FERIAS_1)',
'                                                 ,pDtRetornParc  => :P78_DT_RETORNO_PARC4);',
'    END IF; ',
'  END IF;  ',
'  --',
'  IF vReturn IS NOT NULL THEN',
unistr('    vReturn := ''<strong>Inclus\00E3o de Requisi\00E7\00E3o de F\00E9rias N\00C3O Permitida!</strong><br>''||REPLACE(REPLACE(REPLACE(vReturn, ''|'', ''<br>''), ''['',''<strong>''), '']'',''</strong>'');'),
unistr('    --vReturn := REPLACE(REPLACE(vReturn, ''sa\00EDda'', ''sa\00EDda parcela''||vParcela), ''retorno'', ''retorno parcela''||vParcela);'),
'  END IF;',
'  --',
'  RETURN(vReturn);',
'END;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_validation_condition=>'return 1=1;'
,p_validation_condition_type=>'FUNCTION_BODY'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(230262914413190515233)
,p_validation_name=>'Valida Outra Empresa Dt Saida Parcelas'
,p_validation_sequence=>380
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'DECLARE',
'  vReturn  VARCHAR2(550) DEFAULT NULL;',
'  vParcela VARCHAR2(1)   DEFAULT NULL;',
'BEGIN',
'  IF :P78_DT_SAIDA_PARC1 IS NOT NULL THEN',
'    vParcela := ''1'';',
'    --',
'    vReturn := Pkg_Ferias.fnc_VerifPerOutraEmp(pEmpresa        => nvl(:P78_COD_EMPRESA,:P78_COD_EMPRESA_1)',
'                                              ,pMatricula      => :P78_MATRICULA',
'                                              ,pDtParcSR       => :P78_DT_SAIDA_PARC1',
'                                              ,pDtFimPerFerias => NVL(:P78_DT_FIM_PER_FERIAS, :P78_DT_FIM_PER_FERIAS_1));',
'  END IF; ',
'  --',
'  IF vReturn IS NULL THEN',
'    IF :P78_DT_SAIDA_PARC2 IS NOT NULL THEN',
'      vParcela := ''2'';',
'      --',
'      vReturn := Pkg_Ferias.fnc_VerifPerOutraEmp(pEmpresa        => nvl(:P78_COD_EMPRESA,:P78_COD_EMPRESA_1)',
'                                                ,pMatricula      => :P78_MATRICULA',
'                                                ,pDtParcSR       => :P78_DT_SAIDA_PARC2',
'                                                ,pDtFimPerFerias => NVL(:P78_DT_FIM_PER_FERIAS, :P78_DT_FIM_PER_FERIAS_1));',
'    END IF;  ',
'  END IF;',
'  --',
'  IF vReturn IS NULL THEN',
'    IF :P78_DT_SAIDA_PARC4 IS NOT NULL THEN',
'      vParcela := ''3'';',
'      --',
'      vReturn := Pkg_Ferias.fnc_VerifPerOutraEmp(pEmpresa        => nvl(:P78_COD_EMPRESA,:P78_COD_EMPRESA_1)',
'                                                ,pMatricula      => :P78_MATRICULA',
'                                                ,pDtParcSR       => :P78_DT_SAIDA_PARC4',
'                                                ,pDtFimPerFerias => NVL(:P78_DT_FIM_PER_FERIAS, :P78_DT_FIM_PER_FERIAS_1));',
'    END IF;  ',
'  END IF;  ',
'  --',
'  IF vReturn IS NOT NULL THEN',
unistr('    vReturn := ''<strong>Inclus\00E3o de Requisi\00E7\00E3o de F\00E9rias N\00C3O Permitida!</strong><br>''||REPLACE(REPLACE(REPLACE(vReturn, ''|'', ''<br>''), ''['',''<strong>''), '']'',''</strong>'');'),
unistr('    --vReturn := REPLACE(vReturn, ''Informe'', ''[DATA SA\00CDDA PARCELA''||vparcela||''] Informe'');'),
'  END IF;',
'  --',
'  RETURN(vReturn);',
'END;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_validation_condition=>'return 1=1;'
,p_validation_condition_type=>'FUNCTION_BODY'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(230262914583581515234)
,p_validation_name=>'Valida Outra Empresa Dt Retorno ParcelasX'
,p_validation_sequence=>390
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'DECLARE',
'  vReturn  VARCHAR2(550) DEFAULT NULL;',
'  vParcela VARCHAR2(1)   DEFAULT NULL;',
'BEGIN',
'  IF :P78_DT_RETORNO_PARC1 IS NOT NULL THEN',
'    vParcela := ''1'';',
'    --',
'    vReturn := Pkg_Ferias.fnc_VerifPerOutraEmp(pEmpresa        => :P78_COD_EMPRESA',
'                                              ,pMatricula      => :P78_MATRICULA',
'                                              ,pDtParcSR       => :P78_DT_RETORNO_PARC1',
'                                              ,pDtFimPerFerias => NVL(:P78_DT_FIM_PER_FERIAS, :P78_DT_FIM_PER_FERIAS_1));',
'  END IF; ',
'  --',
'  IF vReturn IS NULL THEN',
'    IF :P78_DT_RETORNO_PARC2 IS NOT NULL THEN',
'    vParcela := ''2'';',
'    --',
'    vReturn := Pkg_Ferias.fnc_VerifPerOutraEmp(pEmpresa        => :P78_COD_EMPRESA',
'                                              ,pMatricula      => :P78_MATRICULA',
'                                              ,pDtParcSR       => :P78_DT_RETORNO_PARC2',
'                                              ,pDtFimPerFerias => NVL(:P78_DT_FIM_PER_FERIAS, :P78_DT_FIM_PER_FERIAS_1));',
'    END IF;                                              ',
'  END IF;',
'  --',
'  IF vReturn IS NULL THEN',
'    IF :P78_DT_RETORNO_PARC4 IS NOT NULL THEN',
'    vParcela := ''3'';',
'    --',
'    vReturn := Pkg_Ferias.fnc_VerifPerOutraEmp(pEmpresa        => :P78_COD_EMPRESA',
'                                              ,pMatricula      => :P78_MATRICULA',
'                                              ,pDtParcSR       => :P78_DT_RETORNO_PARC4',
'                                              ,pDtFimPerFerias => NVL(:P78_DT_FIM_PER_FERIAS, :P78_DT_FIM_PER_FERIAS_1));',
'    END IF;                                              ',
'  END IF;  ',
'  --',
'  IF vReturn IS NOT NULL THEN',
unistr('    vReturn := ''<strong>Inclus\00E3o de Requisi\00E7\00E3o de F\00E9rias N\00C3O Permitida!</strong><br>''||REPLACE(REPLACE(REPLACE(vReturn, ''|'', ''<br>''), ''['',''<strong>''), '']'',''</strong>'');'),
'    --vReturn := REPLACE(vReturn, ''Informe'', ''[DATA RETORNO PARCELA''||vParcela||''] Informe'');',
'  END IF;',
'  --',
'  RETURN(vReturn);',
'END;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_validation_condition_type=>'NEVER'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(143343627156339737837)
,p_validation_name=>unistr('Valida Limite Agenda F\00E9rias Parcela 1')
,p_validation_sequence=>400
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'DECLARE',
'  vReturn  VARCHAR2(250) DEFAULT NULL;',
'BEGIN',
'  IF :P78_DT_SAIDA_PARC1 IS NOT NULL AND :P78_COD_REQ IS NOT NULL THEN',
'    vReturn := Pkg_Ferias.fnc_VerifLimiteAgendaFerias(:P78_EMP_A, :P78_COD_REQ, SYSDATE,1); ',
'                                                    --(pEmpresa       => NULL --:P78_COD_EMPRESA --P78_EMP_A',
'                                                    -- ,pRequisicao    => NULL --:P78_COD_REQ',
'                                                    -- ,DtRequisicao   => NULL',
'                                                    -- ,pDtSaidaferias => NULL --:P78_DT_SAIDA_PARC1',
'                                                    -- ,pParcNum       => NULL);',
'  END IF;',
'  --',
unistr('  RETURN(''Recria\00E7\00E3o de Requisi\00E7\00E3o n\00E3o permitida!<br>''||''.''||REPLACE(REPLACE(vReturn,''['',''<strong>''),'']'',''</strong>''));'),
'END;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_validation_condition_type=>'NEVER'
,p_associated_item=>wwv_flow_api.id(276329715351313718484)
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(144653115693545590389)
,p_validation_name=>unistr('Valida Dt Retorno Parc1 - Estagi\00E1rio')
,p_validation_sequence=>410
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'DECLARE',
'  vReturn    VARCHAR2(250) DEFAULT NULL;',
'BEGIN',
'  IF :P78_VINCULO = ''E'' AND :P78_DT_RETORNO_PARC1 IS NOT NULL THEN',
'    vReturn := Pkg_Ferias.fnc_ValDtRetFeriasEstagiario(pEmpresa      => NVL(:P78_COD_EMPRESA, :P78_COD_EMPRESA_1)',
'                                                      ,pMatricula    => :P78_MATRICULA',
'                                                      ,pDtRetFerParc => :P78_DT_RETORNO_PARC1);',
'  END IF;',
'  --',
'  RETURN(REPLACE(vReturn, ''Retorno'',''Retorno Parcela 1''));',
'END;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_associated_item=>wwv_flow_api.id(276329719387778718487)
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(144653116011748590392)
,p_validation_name=>unistr('Valida Dt Retorno Parc2 - Estagi\00E1rio')
,p_validation_sequence=>420
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'DECLARE',
'  vReturn    VARCHAR2(250) DEFAULT NULL;',
'BEGIN',
'  IF :P78_VINCULO = ''E'' AND :P78_DT_RETORNO_PARC2 IS NOT NULL THEN',
'    vReturn := Pkg_Ferias.fnc_ValDtRetFeriasEstagiario(pEmpresa      => NVL(:P78_COD_EMPRESA, :P78_COD_EMPRESA_1)',
'                                                      ,pMatricula    => :P78_MATRICULA',
'                                                      ,pDtRetFerParc => :P78_DT_RETORNO_PARC2);',
'  END IF;',
'  --',
'  RETURN(REPLACE(vReturn, ''Retorno'',''Retorno Parcela 2''));',
'END;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_associated_item=>wwv_flow_api.id(276329724028144718493)
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(144653116291524590395)
,p_validation_name=>unistr('Valida Dt Retorno Parc2 - Estagi\00E1rio_1')
,p_validation_sequence=>430
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'DECLARE',
'  vReturn    VARCHAR2(250) DEFAULT NULL;',
'BEGIN',
'  IF :P78_VINCULO = ''E'' AND :P78_DT_RETORNO_PARC4 IS NOT NULL THEN',
'    vReturn := Pkg_Ferias.fnc_ValDtRetFeriasEstagiario(pEmpresa      => NVL(:P78_COD_EMPRESA, :P78_COD_EMPRESA_1)',
'                                                      ,pMatricula    => :P78_MATRICULA',
'                                                      ,pDtRetFerParc => :P78_DT_RETORNO_PARC4);',
'  END IF;',
'  --',
'  RETURN(REPLACE(vReturn, ''Retorno'',''Retorno Parcela 3''));',
'END;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_associated_item=>wwv_flow_api.id(276329708393136718480)
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(142179144710963732743)
,p_validation_name=>'Valida Soma Dias'
,p_validation_sequence=>440
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_dias_1 number;',
'v_dias_2 number;',
'v_dias_4 number;',
'',
'v_dias_direito number;',
'',
'begin',
'',
'v_dias_1 := nvl(nvl(:P78_NUM_DIAS_PARC1_1,:P78_NUM_DIAS_PARC1),0);',
'v_dias_2 := nvl(nvl(:P78_NUM_DIAS_PARC2_1,:P78_NUM_DIAS_PARC2),0);',
'v_dias_4 := nvl(nvl(:P78_NUM_DIAS_PARC4_1,:P78_NUM_DIAS_PARC4),0);',
'',
'v_dias_direito := nvl(:P78_DIAS_DIREITO,0);',
'',
'if v_dias_1 + v_dias_2 + v_dias_4 > v_dias_direito then',
'return ''Somatoria de dias maior que o permitido!'';',
'end if;',
'',
'end;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_validation_condition_type=>'NEVER'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(133352161434255877605)
,p_validation_name=>'Valida abono parcela1 obrigatorio'
,p_validation_sequence=>450
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
'begin',
'',
'',
'if nvl(:p78_opcao_ferias,:P78_OPCAO_FERIAS_A) = 2  and :p78_dias_abono_pec1_lst is null then',
'   return ''O campo dias de abono da parcela 1 deve ser preenchido.'';',
'--elsif nvl(:p78_opcao_ferias,:P78_OPCAO_FERIAS_A) in(2,5) and (:p78_dias_abono_pec1_lst is null and :p78_dias_abono_pec2_lst is null) then',
'--   return ''O campo dias de abono deve ser preenchido.'';',
'end if;',
'',
'end;',
'',
'DECLARE',
'  CURSOR C1 IS',
'    select FPP.QTD_PARCELAS, FPP.DIAS_ABONO_PEC1, FPP.DIAS_ABONO_PEC2, FPP.DIAS_ABONO_PEC4',
'      from FERIAS_PARAMETROS_PARCELAS FPP',
'      WHERE FPP.COD_EMPRESA = :p78_cod_empresa',
'        AND FPP.COD_FILIAL = :p78_filial',
'        AND FPP.COD = nvl(:p78_opcao_ferias,:P78_OPCAO_FERIAS_A);',
'  v_c1 c1%ROWTYPE;',
'BEGIN',
'  OPEN c1;',
'  FETCH c1',
'    INTO v_c1;',
'  CLOSE c1;',
'  IF v_c1.QTD_PARCELAS >= 1 AND NVL(v_c1.DIAS_ABONO_PEC1, 0) > 0 THEN',
'    if nvl(v_c1.DIAS_ABONO_PEC1, 0) != nvl(:p78_dias_abono_pec1_lst, 0) + nvl(nvl(:p78_dias_abono_pec2_lst, :p78_dias_abono_pec2), 0) then',
'      return ''O campo dias de abono deve ser preenchido.'';',
'    end if;',
'  END IF;',
'END;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_associated_item=>wwv_flow_api.id(276329717767068718486)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_validation(
 p_id=>wwv_flow_api.id(133352161803664877609)
,p_validation_name=>'Valida abono parcela2 obrigatorio'
,p_validation_sequence=>460
,p_validation=>wwv_flow_string.join(wwv_flow_t_varchar2(
unistr('/* COMENTADO, POIS INICALMENTE IDENTIFICAMOS QUE N\00C3O FAZ SENTIDO FIXAR A VALIDA\00C7\00C3O PELA OP\00C7\00C3O DE FERIAS 5'),
'Bruno Sousa / Rosi 13/10/2023 ',
'if nvl(:p78_opcao_ferias,:P78_OPCAO_FERIAS_A) = 5 and (:p78_dias_abono_pec1_lst is null and :p78_dias_abono_pec1_1 is null and :p78_dias_abono_pec2_lst is null) then',
'return ''O campo dias de abono deve ser preenchido.'';',
'end if;',
'end;',
'*/',
'DECLARE',
'  CURSOR C1 IS',
'    select FPP.QTD_PARCELAS, FPP.DIAS_ABONO_PEC1, FPP.DIAS_ABONO_PEC2, FPP.DIAS_ABONO_PEC4',
'      from FERIAS_PARAMETROS_PARCELAS FPP',
'      WHERE FPP.COD_EMPRESA = :p78_cod_empresa',
'        AND FPP.COD_FILIAL = :p78_filial',
'        AND FPP.COD = nvl(:p78_opcao_ferias,:P78_OPCAO_FERIAS_A);',
'  v_c1 c1%ROWTYPE;',
'  ',
'BEGIN',
'  OPEN c1;',
'  FETCH c1',
'    INTO v_c1;',
'  CLOSE c1;',
'  IF v_c1.QTD_PARCELAS >= 2 AND NVL(v_c1.DIAS_ABONO_PEC2, 0) > 0 THEN',
'    if nvl(v_c1.DIAS_ABONO_PEC2, 0) != nvl(nvl(:p78_dias_abono_pec1_lst, :p78_dias_abono_pec1), 0) + nvl(:p78_dias_abono_pec2_lst, 0) then',
'      return ''O campo dias de abono deve ser preenchido.'';',
'    end if;',
'  END IF;',
'END;'))
,p_validation_type=>'FUNC_BODY_RETURNING_ERR_TEXT'
,p_when_button_pressed=>wwv_flow_api.id(276329683628271718456)
,p_associated_item=>wwv_flow_api.id(276329722861774718492)
,p_error_display_location=>'INLINE_WITH_FIELD_AND_NOTIFICATION'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329743744376718513)
,p_name=>'Parc_Opc 1'
,p_event_sequence=>2
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_PARCELAS_OPC'
,p_condition_element=>'P78_PARCELAS_OPC'
,p_triggering_condition_type=>'EQUALS'
,p_triggering_expression=>'1'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329745785412718514)
,p_event_id=>wwv_flow_api.id(276329743744376718513)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_CLEAR'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_DT_SAIDA_PARC1,P78_NUM_DIAS_PARC1_DSP,P78_NUM_DIAS_PARC1,P78_DIAS_ABONO_PEC1_DSP,P78_DIAS_ABONO_PEC1,P78_DIAS_ABONO_PEC1_LST,P78_OPCAO_13SAL1,P78_DESC_ADICIONAL1,P78_DT_RETORNO_PARC1_X,P78_DT_RETORNO_PARC1,P78_DT_PAGTO_PARC1,P78_TIPO_FERIAS1,P78_'
||'OPCAO_ABONO_PEC1'
);
end;
/
begin
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329746224584718515)
,p_event_id=>wwv_flow_api.id(276329743744376718513)
,p_event_result=>'TRUE'
,p_action_sequence=>40
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_CLEAR'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_DT_SAIDA_PARC2,P78_NUM_DIAS_PARC2_DSP,P78_NUM_DIAS_PARC2,P78_NUM_DIAS_PARC2_LST,P78_DIAS_ABONO_PEC2_DSP,P78_DIAS_ABONO_PEC2,P78_DIAS_ABONO_PEC2_LST,P78_OPCAO_23SAL2,P78_DESC_ADICIONAL2,P78_DT_RETORNO_PARC2,P78_DT_PAGTO_PARC2,P78_TIPO_FERIAS2,P78_'
||'OPCAO_ABONO_PEC2,P78_NUM_DIAS_PARC2_1,P78_DT_PAGTO_PARC2_1,P78_OPCAO_13SAL2_1,P78_TIPO_FERIAS2_1,P78_DIAS_ABONO_PEC2_1,P78_DT_RETORNO_PARC2_1'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329746753600718515)
,p_event_id=>wwv_flow_api.id(276329743744376718513)
,p_event_result=>'TRUE'
,p_action_sequence=>50
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_CLEAR'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_DT_SAIDA_PARC4,P78_NUM_DIAS_PARC4_DSP,P78_NUM_DIAS_PARC4,P78_NUM_DIAS_PARC4_LST,P78_DIAS_ABONO_PEC4_DSP,P78_DIAS_ABONO_PEC4,P78_DIAS_ABONO_PEC4_LST,P78_OPCAO_13SAL4,P78_DESC_ADICIONAL4,P78_DT_RETORNO_PARC4_X,P78_DT_RETORNO_PARC4,P78_DT_PAGTO_PARC'
||'4,P78_TIPO_FERIAS4,P78_OPCAO_ABONO_PEC4'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329747163718718516)
,p_name=>'Parc_Opc 2'
,p_event_sequence=>3
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_PARCELAS_OPC'
,p_condition_element=>'P78_PARCELAS_OPC'
,p_triggering_condition_type=>'EQUALS'
,p_triggering_expression=>'2'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329749156999718517)
,p_event_id=>wwv_flow_api.id(276329747163718718516)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_CLEAR'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_DT_SAIDA_PARC1,P78_NUM_DIAS_PARC1_DSP,P78_NUM_DIAS_PARC1,P78_DIAS_ABONO_PEC1_DSP,P78_DIAS_ABONO_PEC1,P78_DIAS_ABONO_PEC1_LST,P78_OPCAO_13SAL1,P78_DESC_ADICIONAL1,P78_DT_RETORNO_PARC1_X,P78_DT_RETORNO_PARC1,P78_DT_PAGTO_PARC1,P78_TIPO_FERIAS1,P78_'
||'OPCAO_ABONO_PEC1'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329749677046718518)
,p_event_id=>wwv_flow_api.id(276329747163718718516)
,p_event_result=>'TRUE'
,p_action_sequence=>40
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_CLEAR'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_DT_SAIDA_PARC2,P78_NUM_DIAS_PARC2_DSP,P78_NUM_DIAS_PARC2,P78_NUM_DIAS_PARC2_LST,P78_DIAS_ABONO_PEC2_DSP,P78_DIAS_ABONO_PEC2,P78_DIAS_ABONO_PEC2_LST,P78_OPCAO_23SAL2,P78_DESC_ADICIONAL2,P78_DT_RETORNO_PARC2,P78_DT_PAGTO_PARC2,P78_TIPO_FERIAS2,P78_'
||'OPCAO_ABONO_PEC2,P78_DT_SAIDA_PARC2_1,P78_NUM_DIAS_PARC2_1,P78_DT_PAGTO_PARC2_1,P78_OPCAO_13SAL2_1,P78_TIPO_FERIAS2_1,P78_DIAS_ABONO_PEC2_1,P78_DT_RETORNO_PARC2_1'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329750128293718518)
,p_event_id=>wwv_flow_api.id(276329747163718718516)
,p_event_result=>'TRUE'
,p_action_sequence=>50
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_CLEAR'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_DT_SAIDA_PARC4,P78_NUM_DIAS_PARC4_DSP,P78_NUM_DIAS_PARC4,P78_NUM_DIAS_PARC4_LST,P78_DIAS_ABONO_PEC4_DSP,P78_DIAS_ABONO_PEC4,P78_DIAS_ABONO_PEC4_LST,P78_OPCAO_13SAL4,P78_DESC_ADICIONAL4,P78_DT_RETORNO_PARC4_X,P78_DT_RETORNO_PARC4,P78_DT_PAGTO_PARC'
||'4,P78_TIPO_FERIAS4,P78_OPCAO_ABONO_PEC4'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329750581124718519)
,p_name=>'Parc_Opc 3'
,p_event_sequence=>4
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_PARCELAS_OPC'
,p_condition_element=>'P78_PARCELAS_OPC'
,p_triggering_condition_type=>'EQUALS'
,p_triggering_expression=>'3'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329751117443718519)
,p_event_id=>wwv_flow_api.id(276329750581124718519)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694832970995432555)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329751552256718519)
,p_event_id=>wwv_flow_api.id(276329750581124718519)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694847727728432570)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329752070495718520)
,p_event_id=>wwv_flow_api.id(276329750581124718519)
,p_event_result=>'TRUE'
,p_action_sequence=>40
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694838117800432559)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329752612677718520)
,p_event_id=>wwv_flow_api.id(276329750581124718519)
,p_event_result=>'TRUE'
,p_action_sequence=>50
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276559150703399823134)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329753061004718521)
,p_event_id=>wwv_flow_api.id(276329750581124718519)
,p_event_result=>'TRUE'
,p_action_sequence=>60
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_CLEAR'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_DT_SAIDA_PARC1,P78_NUM_DIAS_PARC1_DSP,P78_NUM_DIAS_PARC1,P78_DIAS_ABONO_PEC1_DSP,P78_DIAS_ABONO_PEC1,P78_DIAS_ABONO_PEC1_LST,P78_OPCAO_13SAL1,P78_DESC_ADICIONAL1,P78_DT_RETORNO_PARC1_X,P78_DT_RETORNO_PARC1,P78_DT_PAGTO_PARC1,P78_TIPO_FERIAS1,P78_'
||'OPCAO_ABONO_PEC1'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329753548489718521)
,p_event_id=>wwv_flow_api.id(276329750581124718519)
,p_event_result=>'TRUE'
,p_action_sequence=>70
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_CLEAR'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_DT_SAIDA_PARC2,P78_NUM_DIAS_PARC2_DSP,P78_NUM_DIAS_PARC2,P78_NUM_DIAS_PARC2_LST,P78_DIAS_ABONO_PEC2_DSP,P78_DIAS_ABONO_PEC2,P78_DIAS_ABONO_PEC2_LST,P78_OPCAO_23SAL2,P78_DESC_ADICIONAL2,P78_DT_RETORNO_PARC2,P78_DT_PAGTO_PARC2,P78_TIPO_FERIAS2,P78_'
||'OPCAO_ABONO_PEC2,P78_DT_SAIDA_PARC2_1,P78_NUM_DIAS_PARC2_1,P78_DT_PAGTO_PARC2_1,P78_OPCAO_13SAL2_1,P78_TIPO_FERIAS2_1,P78_DIAS_ABONO_PEC2_1,P78_DT_RETORNO_PARC2_1'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329754060670718521)
,p_event_id=>wwv_flow_api.id(276329750581124718519)
,p_event_result=>'TRUE'
,p_action_sequence=>80
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_CLEAR'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_DT_SAIDA_PARC4,P78_NUM_DIAS_PARC4_DSP,P78_NUM_DIAS_PARC4,P78_NUM_DIAS_PARC4_LST,P78_DIAS_ABONO_PEC4_DSP,P78_DIAS_ABONO_PEC4,P78_DIAS_ABONO_PEC4_LST,P78_OPCAO_13SAL4,P78_DESC_ADICIONAL4,P78_DT_RETORNO_PARC4_X,P78_DT_RETORNO_PARC4,P78_DT_PAGTO_PARC'
||'4,P78_TIPO_FERIAS4,P78_OPCAO_ABONO_PEC4'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329754438777718522)
,p_name=>'valida_matricula_solicitado'
,p_event_sequence=>8
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_MATRICULA'
,p_condition_element=>'P78_MATRICULA'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return :P78_FLAG_CTRL is null and :P78_ROWID is null;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(175206140132525206386)
,p_event_id=>wwv_flow_api.id(276329754438777718522)
,p_event_result=>'FALSE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_CLEAR'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_TRIG_EXIST_REQ'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329754996951718522)
,p_event_id=>wwv_flow_api.id(276329754438777718522)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'begin',
'v_item_validacao := null;',
':P78_ITEM_VALIDACAO := null;',
'',
'IF :P78_MATRICULA IS NOT NULL THEN',
'',
' :p78_mensagem := null;',
'',
'pkg_ferias.Valida_Matricula_Solicitado(:p78_cod_empresa, :p78_matricula, v_flg_retorno, v_msg_retorno);',
'',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_matricula''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
'    :P78_SHOW_HIDE:= ''HIDE'';',
'    ',
' else',
'    :P78_SHOW_HIDE:= ''SHOW'';',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_matricula'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
' ',
'END IF;',
' ',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_ITEM_VALIDACAO,P78_DIAS_DIREITO_OPC'
,p_attribute_03=>'P78_MENSAGEM,P78_FLAG,P78_OK,P78_ITEM_VALIDACAO,P78_SHOW_HIDE'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(265220009526058756726)
,p_event_id=>wwv_flow_api.id(276329754438777718522)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'cursor c1 is',
'select cod_empresa, filial, cod_ccusto, matricula',
'  from informacoes_funcionais',
' where cod_empresa = :p78_cod_empresa',
'   and matricula = :p78_matricula;',
'   ',
'v_c1 c1%rowtype;',
'',
'begin',
'',
'if :P_BASE = ''STEFANINI'' and nvl(:P78_OK,''S'') = ''S'' then',
'',
'open c1;',
'fetch c1 into v_c1;',
'close c1;',
'',
'v_flg_retorno := pkg_req.VALIDA_EXISTE_APROV(v_c1.cod_empresa,',
'                                              v_c1.filial,',
'                                              v_c1.cod_ccusto,',
'                                              v_c1.matricula,',
'                                              :p_empresa_user, ',
'                                              :p_matricula_user, ',
'                                              null, ',
'                                              ''FERIAS'');',
'',
'    if nvl(v_flg_retorno,''S'') = ''N'' then',
unistr('       v_msg_retorno := ''N\00E3o foi parametrizado aprovadores para sua requisi\00E7\00E3o. Por favor, entrar em contato com os administradores do sistema!'';'),
'    else ',
'       v_flg_retorno := ''S'';',
'    end if;',
'',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_matricula''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_matricula'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
'',
'end if;',
'',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_ITEM_VALIDACAO,P_EMPRESA_USER,P_MATRICULA_USER,P78_OK'
,p_attribute_03=>'P78_MENSAGEM,P78_FLAG,P78_OK,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(265271830111631197427)
,p_event_id=>wwv_flow_api.id(276329754438777718522)
,p_event_result=>'TRUE'
,p_action_sequence=>40
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'Declare',
'',
'v_meses number;',
'',
'cursor c1 is',
'select FLOOR(months_between(trunc(sysdate), trunc(dt_admissao))) qtd_meses',
'  from informacoes_funcionais',
' where cod_empresa = :p78_cod_empresa',
'   and matricula = :p78_matricula;',
'   ',
'v_c1 c1%rowtype;',
'',
'begin',
'',
'open c1;',
'fetch c1 into v_c1;',
'close c1;',
'',
':p78_meses_adm := nvl(v_c1.qtd_meses,0);',
'',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA'
,p_attribute_03=>'P78_MESES_ADM'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276126948502408422015)
,p_name=>'valida_dias_direito_opc'
,p_event_sequence=>18
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DIAS_DIREITO_OPC'
,p_condition_element=>'P78_DIAS_DIREITO_OPC'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276126948629278422016)
,p_event_id=>wwv_flow_api.id(276126948502408422015)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'begin',
'',
'v_item_validacao := null;',
':P78_ITEM_VALIDACAO := null;',
'',
'IF :P78_MATRICULA IS NOT NULL THEN',
'',
' :p78_mensagem := null;',
'',
' if :P78_DIAS_DIREITO_OPC = 0 then',
' v_flg_retorno := ''N'';',
unistr(' v_msg_retorno := ''Para este per\00EDodo de f\00E9rias (''||:P78_DT_INIC_PER_FERIAS_1||'' \00E0 ''||:P78_DT_FIM_PER_FERIAS_1||''), o colaborador n\00E3o tem mais dias dispon\00EDveis a ser gozado.'';'),
' ',
' end if;',
' ',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''P78_DIAS_DIREITO_OPC''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''P78_DIAS_DIREITO_OPC'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
' ',
'END IF;',
' ',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_ITEM_VALIDACAO,P78_DIAS_DIREITO_OPC,P78_DT_INIC_PER_FERIAS_1,P78_DT_FIM_PER_FERIAS_1'
,p_attribute_03=>'P78_MENSAGEM,P78_FLAG,P78_OK,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(101569432021784441750)
,p_name=>unistr('Cria\00E7\00E3o: Mostra Regi\00F5es')
,p_event_sequence=>28
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_MATRICULA'
,p_condition_element=>'P78_MATRICULA'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if :p78_rowid is null and :p78_ok = ''S'' then',
'return true;',
'else',
'return true;',
'end if;'))
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(101569432117181441751)
,p_event_id=>wwv_flow_api.id(101569432021784441750)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694826984926432549)
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(101569432167827441752)
,p_event_id=>wwv_flow_api.id(101569432021784441750)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694827786584432550)
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329756793651718524)
,p_name=>'Jornada Reduzida'
,p_event_sequence=>38
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_MATRICULA'
,p_condition_element=>'P78_MATRICULA'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329757249635718524)
,p_event_id=>wwv_flow_api.id(276329756793651718524)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'begin',
'			  select nvl(rt.jornada_reduzida,''N'')',
'			  into   :p78_jornada_reduzida',
'			  from   informacoes_funcionais_cad iff',
'			        ,reg_trabalho rt',
'			  where  rt.cod          = iff.reg_trab',
'			  and    rt.cod_empresa  = iff.cod_empresa',
'			  and    iff.matricula   = :p78_matricula',
'			  and    iff.cod_empresa = :p78_cod_empresa;',
'exception',
'  when others then',
'  :p78_jornada_reduzida := ''N'';',
'end;'))
,p_attribute_02=>'P78_MATRICULA,P78_COD_EMPRESA'
,p_attribute_03=>'P78_JORNADA_REDUZIDA'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(165947103492952326219)
,p_name=>unistr('(Cria\00E7\00E3o) Matricula: Popula_Campos 1 old')
,p_event_sequence=>47
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_MATRICULA'
,p_condition_element=>'P78_MATRICULA'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'NEVER'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(165947103653348326220)
,p_event_id=>wwv_flow_api.id(165947103492952326219)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'v_data_ini date;v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'CURSOR C_REQ(pdt_inic_per_ferias DATE) IS',
'SELECT R.SIT_REQUISICAO COD_SIT_REQ, NVL(P.REQ_FERIAS_SUBS_CONCLUIDA,''N'') REQ_FERIAS_SUBS_CONCLUIDA',
'FROM REQUISICAO_FERIAS R,',
'PARAMETROS_RECURSOS_HUMANOS P',
'WHERE R.COD_EMPRESA=P.COD_EMPRESA',
'AND R.SIT_REQUISICAO=2',
'AND R.COD_EMPRESA=:P78_COD_EMPRESA',
'AND R.MATRICULA=:P78_MATRICULA',
'AND R.Dt_Inic_Per_Ferias=pdt_inic_per_ferias;',
'V_REQ C_REQ%ROWTYPE;',
'begin',
'IF :P78_MATRICULA IS NOT NULL THEN',
':P78_MENSAGEM:=NULL;',
'BEGIN',
'select min(A.DT_INIC_PER_FERIAS) ',
'into v_data_ini',
'from FERIAS A',
'where A.COD_EMPRESA=:P78_COD_EMPRESA ',
'and A.MATRICULA=:P78_MATRICULA',
unistr('-- Bruno Sousa alterado condi\00E7\00E3o abaixo 24/06/2024'),
'and A.COD_SOLICITACAO IS NULL and A.DT_SAIDA_PARC1 IS NULL and A.DT_SAIDA_PARC2 IS NULL and A.DT_SAIDA_PARC4 IS NULL',
'AND NOT EXISTS(SELECT 1',
'                 FROM REQUISICAO_FERIAS B',
'                WHERE B.COD_EMPRESA = A.COD_EMPRESA',
'                  AND B.MATRICULA = A.MATRICULA',
'                  AND B.DT_INIC_PER_FERIAS = A.DT_INIC_PER_FERIAS',
'                  AND B.SIT_REQUISICAO not in (3,4,6))',
'and A.IND_SITUACAO_PERIODO in (''P'',''R'');',
'END;',
'OPEN c_req(v_data_ini);',
'FETCH c_req INTO v_req;',
'close c_req;',
'if NVL(V_REQ.REQ_FERIAS_SUBS_CONCLUIDA,''N'') = ''N'' then',
'BEGIN',
'select Nvl(dias_descanso_adicional,0)',
',saldo_bruto',
',saldo',
',ind_situacao_periodo',
',dt_inic_per_ferias',
',dt_fim_per_ferias ',
',dt_saida_parc1',
',num_dias_parc1',
',dias_abono_pec1',
unistr(',decode(opcao_13sal1,''S'',''Sim'',''N'',''N\00E3o'') opcao_13sal1'),
',desc_adicional1',
',dt_retorno_parc1',
',tipo_ferias1',
',dt_saida_parc2',
',num_dias_parc2',
',dias_abono_pec2',
unistr(',decode(opcao_13sal2,''S'',''Sim'',''N'',''N\00E3o'') opcao_13sal2'),
',desc_adicional2',
',dt_retorno_parc2',
',tipo_ferias2',
',dt_saida_parc4',
',num_dias_parc4',
',dias_abono_pec4',
unistr(',decode(opcao_13sal4,''S'',''Sim'',''N'',''N\00E3o'') opcao_13sal4'),
',desc_adicional4',
',dt_retorno_parc4',
',tipo_ferias4',
',dt_saida_parc3',
',num_dias_parc3',
',dt_retorno_parc3',
',tipo_ferias3',
',dt_solicitacao',
',falta_hora',
',falta_minuto',
',opcao_abono_pec1',
',opcao_abono_pec2',
',dc_matricula',
',opcao_ferias',
',ind_situacao_parc_2',
',ind_situacao_parc_4',
'into :p78_dias_descanso_adicional',
',:p78_saldo_bruto',
',:p78_saldo',
',:p78_ind_situacao_periodo',
',:p78_dt_inic_per_ferias',
',:p78_dt_fim_per_ferias  ',
',:p78_dt_saida_parc1_1',
',:p78_num_dias_parc1_1',
',:p78_dias_abono_pec1_1',
',:p78_opcao_13sal1_1',
',:p78_desc_adicional1_1',
',:p78_dt_retorno_parc1_1',
',:p78_tipo_ferias1_1',
',:p78_dt_saida_parc2_1',
',:p78_num_dias_parc2_1',
',:p78_dias_abono_pec2_1',
',:p78_opcao_13sal2_1',
',:p78_desc_adicional2_1',
',:p78_dt_retorno_parc2_1',
',:p78_tipo_ferias2_1',
',:p78_dt_saida_parc4_1',
',:p78_num_dias_parc4_1',
',:p78_dias_abono_pec4_1',
',:p78_opcao_13sal4_1',
',:p78_desc_adicional4_1',
',:p78_dt_retorno_parc4_1',
',:p78_tipo_ferias4_1',
',:p78_dt_saida_parc3',
',:p78_num_dias_parc3',
',:p78_dt_retorno_parc3',
',:p78_tipo_ferias3',
',:p78_dt_solicitacao',
',:p78_falta_hora',
',:p78_falta_minuto',
',:p78_opcao_abono_pec1',
',:p78_opcao_abono_pec2',
',:p78_dc_matricula',
',:p78_opcao_ferias',
',:p78_ind_situacao_parc_2',
',:p78_ind_situacao_parc_4',
'from ferias',
'where cod_empresa=:p78_cod_empresa',
'and matricula=:p78_matricula   ',
'and dt_inic_per_ferias=v_data_ini;',
'EXCEPTION WHEN OTHERS THEN',
':p78_flag:=''N'';',
':p78_ok:=''N'';',
unistr(':p78_mensagem:=''N\00E3o h\00E1 per\00EDodos em aberto para a programa\00E7\00E3o! Solicite ao RH a cria\00E7\00E3o.'';'),
'END;',
'else',
'BEGIN',
'select Nvl(dias_descanso_adicional,0),saldo_bruto,saldo,ind_situacao_periodo,dt_inic_per_ferias,dt_fim_per_ferias ,falta_hora,falta_minuto,dc_matricula',
'into :p78_dias_descanso_adicional,:p78_saldo_bruto,:p78_saldo,:p78_ind_situacao_periodo,:p78_dt_inic_per_ferias,:p78_dt_fim_per_ferias,:p78_falta_hora,:p78_falta_minuto,:p78_dc_matricula',
'from ferias',
'where cod_empresa=:p78_cod_empresa',
'and matricula=:p78_matricula   ',
'and dt_inic_per_ferias = v_data_ini;',
'EXCEPTION WHEN OTHERS THEN',
':p78_flag:=''N'';',
':p78_ok:=''N'';',
unistr(':p78_mensagem:=''N\00E3o h\00E1 per\00EDodos em aberto para a programa\00E7\00E3o! Solicite ao RH a cria\00E7\00E3o.'';'),
'END;',
'END IF;',
'if :p78_cod_solicitacao is null then',
':P78_TIPO_FERIAS1:=''N'';',
':P78_TIPO_FERIAS2:=''N'';',
'end if;',
'END IF;',
'end;'))
,p_attribute_02=>'P78_ITEM_VALIDACAO,P78_COD_EMPRESA,P78_MATRICULA,P78_COD_SOLICITACAO,P78_OPCAO_FERIAS'
,p_attribute_03=>'P78_FLAG,P78_OK,P78_MENSAGEM,P78_DIAS_DESCANSO_ADICIONAL,P78_SALDO_BRUTO,P78_SALDO,P78_IND_SITUACAO_PERIODO,P78_DT_INIC_PER_FERIAS,P78_DT_FIM_PER_FERIAS,P78_DT_SAIDA_PARC1_1,P78_NUM_DIAS_PARC1_1,P78_DIAS_ABONO_PEC1_1,P78_OPCAO_13SAL1_1,P78_DESC_ADICI'
||'ONAL1_1,P78_DT_RETORNO_PARC1_1,P78_TIPO_FERIAS1_1,P78_DT_SAIDA_PARC2_1,P78_NUM_DIAS_PARC2_1,P78_DIAS_ABONO_PEC2_1,P78_OPCAO_13SAL2_1,P78_DESC_ADICIONAL2_1,P78_DT_RETORNO_PARC2_1,P78_TIPO_FERIAS2_1,P78_DT_SAIDA_PARC4_1,P78_NUM_DIAS_PARC4_1,P78_DIAS_AB'
||'ONO_PEC4_1,P78_OPCAO_13SAL4_1,P78_DESC_ADICIONAL4_1,P78_DT_RETORNO_PARC4_1,P78_TIPO_FERIAS4_1,P78_DT_SAIDA_PARC3,P78_NUM_DIAS_PARC3,P78_DT_RETORNO_PARC3,P78_TIPO_FERIAS3,P78_DT_SOLICITACAO,P78_FALTA_HORA,P78_FALTA_MINUTO,P78_OPCAO_ABONO_PEC1,P78_OPCA'
||'O_ABONO_PEC2,P78_DC_MATRICULA,P78_TIPO_FERIAS1,P78_TIPO_FERIAS2,P78_IND_SITUACAO_PARC_2,P78_IND_SITUACAO_PARC_4'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329822960565718573)
,p_name=>'Dispara Alerta'
,p_event_sequence=>47
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_MENSAGEM'
,p_condition_element=>'P78_MENSAGEM'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329823447838718573)
,p_event_id=>wwv_flow_api.id(276329822960565718573)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_JAVASCRIPT_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if ($x(''P78_FLAG'').value == "Q") {',
'alertify.confirm($v(''P78_MENSAGEM''), function (e) {',
'    if (e) {',
'        $x(''P78_FLAG'').value = ''S'';',
'        $x(''P78_MENSAGEM'').value = '''';',
'        $x(''P78_OK'').value = ''S'';',
'',
'    } else {',
'        $x(''P78_OK'').value = ''N'';',
'',
'    }',
'});',
'} else {',
'',
'    if ($x(''P78_MENSAGEM'').value.length  > 0 ) {',
'        ',
'        if ($x(''P78_FLAG'').value == "N") {',
'            $x(''P78_OK'').value = ''N'';',
'',
'        } else {',
'            if ($x(''P78_ITEM_VALIDACAO'').value.length == 0){',
'            $x(''P78_OK'').value = ''S'';',
'            }',
'        }',
'            ',
'        alertify.alert($v(''P78_MENSAGEM''));',
'        ',
'        ',
'    }else{',
'            if ($x(''P78_ITEM_VALIDACAO'').value.length == 0){',
'            $x(''P78_OK'').value = ''S'';',
'            }',
'    }',
'    ',
'    if ($x(''P78_ITEM_VALIDACAO'').value == ''P78_CREATE''){',
'            $x(''P78_OK'').value = ''S'';',
'        $x(''P78_ITEM_VALIDACAO'').value = '''';',
'    }',
'',
'}'))
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329757709435718524)
,p_name=>unistr('(Cria\00E7\00E3o) Matricula: Popula_Campos 1')
,p_event_sequence=>48
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_MATRICULA'
,p_condition_element=>'P78_MATRICULA'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>wwv_flow_string.join(wwv_flow_t_varchar2(
'/*if :P78_ROWID is null and NVL(:P78_OK,''S'') = ''S'' then',
'return true;',
'else',
'return false;',
'end if;*/',
'',
'return :P78_FLAG_CTRL is null and :P78_ROWID is null and nvl(:P78_OK,''S'') = ''S'';',
''))
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329758120103718525)
,p_event_id=>wwv_flow_api.id(276329757709435718524)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'pkg_req_ferias.pg78_carrega(',
'p_P78_COD_EMPRESA => :P78_COD_EMPRESA,',
'p_P78_MATRICULA => :P78_MATRICULA,',
'p_P78_COD_SOLICITACAO => :P78_COD_SOLICITACAO,',
'p_P78_DIAS_DESCANSO_ADICIONAL => :P78_DIAS_DESCANSO_ADICIONAL,',
'p_P78_SALDO_BRUTO => :P78_SALDO_BRUTO,',
'p_P78_SALDO => :P78_SALDO,',
'p_P78_IND_SITUACAO_PERIODO => :P78_IND_SITUACAO_PERIODO,',
'p_P78_DT_INIC_PER_FERIAS => :P78_DT_INIC_PER_FERIAS,',
'p_P78_DT_FIM_PER_FERIAS => :P78_DT_FIM_PER_FERIAS,',
'p_P78_DT_SAIDA_PARC1_1 => :P78_DT_SAIDA_PARC1_1,',
'p_P78_NUM_DIAS_PARC1_1 => :P78_NUM_DIAS_PARC1_1,',
'p_P78_DIAS_ABONO_PEC1_1 => :P78_DIAS_ABONO_PEC1_1,',
'p_P78_OPCAO_13SAL1_1 => :P78_OPCAO_13SAL1_1,',
'p_P78_DESC_ADICIONAL1_1 => :P78_DESC_ADICIONAL1_1,',
'p_P78_DT_RETORNO_PARC1_1 => :P78_DT_RETORNO_PARC1_1,',
'p_P78_TIPO_FERIAS1_1 => :P78_TIPO_FERIAS1_1,',
'p_P78_DT_SAIDA_PARC2_1 => :P78_DT_SAIDA_PARC2,',
'p_P78_NUM_DIAS_PARC2_1 => :P78_NUM_DIAS_PARC2_1,',
'p_P78_DIAS_ABONO_PEC2_1 => :P78_DIAS_ABONO_PEC2_1,',
'p_P78_OPCAO_13SAL2_1 => :P78_OPCAO_13SAL2_1,',
'p_P78_DESC_ADICIONAL2_1 => :P78_DESC_ADICIONAL2_1,',
'p_P78_DT_RETORNO_PARC2_1 => :P78_DT_RETORNO_PARC2_1,',
'p_P78_TIPO_FERIAS2_1 => :P78_TIPO_FERIAS2_1,',
'p_P78_DT_SAIDA_PARC4_1 => :P78_DT_SAIDA_PARC4_1,',
'p_P78_NUM_DIAS_PARC4_1 => :P78_NUM_DIAS_PARC4_1,',
'p_P78_DIAS_ABONO_PEC4_1 => :P78_DIAS_ABONO_PEC4_1,',
'p_P78_OPCAO_13SAL4_1 => :P78_OPCAO_13SAL4_1,',
'p_P78_DESC_ADICIONAL4_1 => :P78_DESC_ADICIONAL4_1,',
'p_P78_DT_RETORNO_PARC4_1 => :P78_DT_RETORNO_PARC4_1,',
'p_P78_TIPO_FERIAS4_1 => :P78_TIPO_FERIAS4_1,',
'p_P78_DT_SAIDA_PARC3 => :P78_DT_SAIDA_PARC3,',
'p_P78_NUM_DIAS_PARC3 => :P78_NUM_DIAS_PARC3,',
'p_P78_DT_RETORNO_PARC3 => :P78_DT_RETORNO_PARC3,',
'p_P78_TIPO_FERIAS3 => :P78_TIPO_FERIAS3,',
'p_P78_DT_SOLICITACAO => :P78_DT_SOLICITACAO,',
'p_P78_FALTA_HORA => :P78_FALTA_HORA,',
'p_P78_FALTA_MINUTO => :P78_FALTA_MINUTO,',
'p_P78_OPCAO_ABONO_PEC1 => :P78_OPCAO_ABONO_PEC1,',
'p_P78_OPCAO_ABONO_PEC2 => :P78_OPCAO_ABONO_PEC2,',
'p_P78_DC_MATRICULA => :P78_DC_MATRICULA,',
'p_P78_OPCAO_FERIAS => :P78_OPCAO_FERIAS,',
'p_P78_IND_SITUACAO_PARC_2 => :P78_IND_SITUACAO_PARC_2,',
'p_P78_IND_SITUACAO_PARC_4 => :P78_IND_SITUACAO_PARC_4,',
'p_P78_TIPO_FERIAS1 => :P78_TIPO_FERIAS1,',
'p_P78_TIPO_FERIAS2 => :P78_TIPO_FERIAS2,',
'p_P78_FLAG => :P78_FLAG,',
'p_P78_OK => :P78_OK,',
'p_P78_MENSAGEM => :P78_MENSAGEM);',
'IF :P78_OPCAO_FERIAS IS NOT NULL THEN',
'  :P78_OPCAO_FERIAS_DB := :P78_OPCAO_FERIAS;',
'  :P78_OPCAO_FERIAS_A := :P78_OPCAO_FERIAS;',
'  :P78_OPCAO_FERIAS_CARREGA := 1;',
'ELSE',
'  :P78_OPCAO_FERIAS_CARREGA := 0;',
'END IF;'))
,p_attribute_02=>'P78_ITEM_VALIDACAO,P78_COD_EMPRESA,P78_MATRICULA,P78_COD_SOLICITACAO'
,p_attribute_03=>'P78_FLAG,P78_OK,P78_MENSAGEM,P78_DIAS_DESCANSO_ADICIONAL,P78_SALDO_BRUTO,P78_SALDO,P78_IND_SITUACAO_PERIODO,P78_DT_INIC_PER_FERIAS,P78_DT_FIM_PER_FERIAS,P78_DT_SAIDA_PARC1_1,P78_NUM_DIAS_PARC1_1,P78_DIAS_ABONO_PEC1_1,P78_OPCAO_13SAL1_1,P78_DESC_ADICI'
||'ONAL1_1,P78_DT_RETORNO_PARC1_1,P78_TIPO_FERIAS1_1,P78_DT_SAIDA_PARC2_1,P78_NUM_DIAS_PARC2_1,P78_DIAS_ABONO_PEC2_1,P78_OPCAO_13SAL2_1,P78_DESC_ADICIONAL2_1,P78_DT_RETORNO_PARC2_1,P78_TIPO_FERIAS2_1,P78_DT_SAIDA_PARC4_1,P78_NUM_DIAS_PARC4_1,P78_DIAS_AB'
||'ONO_PEC4_1,P78_OPCAO_13SAL4_1,P78_DESC_ADICIONAL4_1,P78_DT_RETORNO_PARC4_1,P78_TIPO_FERIAS4_1,P78_DT_SAIDA_PARC3,P78_NUM_DIAS_PARC3,P78_DT_RETORNO_PARC3,P78_TIPO_FERIAS3,P78_DT_SOLICITACAO,P78_FALTA_HORA,P78_FALTA_MINUTO,P78_OPCAO_ABONO_PEC1,P78_OPCA'
||'O_ABONO_PEC2,P78_DC_MATRICULA,P78_TIPO_FERIAS1,P78_TIPO_FERIAS2,P78_IND_SITUACAO_PARC_2,P78_IND_SITUACAO_PARC_4,P78_OPCAO_FERIAS,P78_OPCAO_FERIAS_DB,P78_OPCAO_FERIAS_A,P78_OPCAO_FERIAS_CARREGA'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329758709850718526)
,p_event_id=>wwv_flow_api.id(276329757709435718524)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_JAVASCRIPT_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'$x(''P78_DT_SAIDA_PARC1_1'').disabled = true;',
'$x(''P78_NUM_DIAS_PARC1_1'').disabled = true;',
'$x(''P78_DIAS_ABONO_PEC1_1'').disabled = true;',
'$x(''P78_OPCAO_13SAL1_1'').disabled = true;',
'$x(''P78_DESC_ADICIONAL1_1'').disabled = true;',
'$x(''P78_DT_RETORNO_PARC1_1'').disabled = true;',
'',
'$x(''P78_DT_SAIDA_PARC2_1'').disabled = true;',
'$x(''P78_NUM_DIAS_PARC2_1'').disabled = true;',
'$x(''P78_DIAS_ABONO_PEC2_1'').disabled = true;',
'$x(''P78_OPCAO_13SAL2_1'').disabled = true;',
'$x(''P78_DESC_ADICIONAL2_1'').disabled = true;',
'$x(''P78_DT_RETORNO_PARC2_1'').disabled = true;',
'',
'$x(''P78_DT_SAIDA_PARC4_1'').disabled = true;',
'$x(''P78_NUM_DIAS_PARC4_1'').disabled = true;',
'$x(''P78_DIAS_ABONO_PEC4_1'').disabled = true;',
'$x(''P78_OPCAO_13SAL4_1'').disabled = true;',
'$x(''P78_DESC_ADICIONAL4_1'').disabled = true;',
'$x(''P78_DT_RETORNO_PARC4_1'').disabled = true;'))
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(143343625592681737822)
,p_name=>'(Pesquisa) Matricula: Popula_Campos 1'
,p_event_sequence=>78
,p_bind_type=>'bind'
,p_bind_event_type=>'ready'
,p_display_when_type=>'ITEM_IS_NOT_NULL'
,p_display_when_cond=>'P78_COD_SOLICITACAO'
);
end;
/
begin
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(143343625703049737823)
,p_event_id=>wwv_flow_api.id(143343625592681737822)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_data_ini date;',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'begin',
'',
'--if :p78_ok = ''S'' then',
'',
'IF :P78_MATRICULA IS NOT NULL and :p78_cod_solicitacao is not null THEN',
'',
':P78_MENSAGEM := NULL;',
'',
'           begin',
'            select min(dt_inic_per_ferias)',
'            Into v_data_ini',
'            from requisicao_ferias ',
'            where cod_empresa   = :p78_cod_empresa',
'            and matricula       = :p78_matricula',
'            and cod_solicitacao = :p78_cod_solicitacao;',
'           exception when no_data_found then',
'                    select min(dt_inic_per_ferias) ',
'                    Into v_data_ini',
'                    from ferias ',
'                    where cod_empresa = :p78_cod_empresa',
'                    and matricula = :p78_matricula',
'                    and ind_situacao_periodo in (''P'',''R'');',
'           end; ',
'        ',
'				    		BEGIN',
'								select Nvl(dias_descanso_adicional,0)',
'								     , saldo_bruto',
'								     , saldo',
'								     , ind_situacao_periodo',
'								     , dt_inic_per_ferias',
'								     , dt_fim_per_ferias ',
'								     , falta_hora',
'								     , falta_minuto',
'                                     , dc_matricula',
'								  into :p78_dias_descanso_adicional',
'								     , :p78_saldo_bruto',
'								     , :p78_saldo',
'								     , :p78_ind_situacao_periodo',
'								     , :p78_dt_inic_per_ferias',
'								     , :p78_dt_fim_per_ferias  ',
'								     , :p78_falta_hora',
'								     , :p78_falta_minuto',
'                                     , :P78_DC_MATRICULA',
'								  from ferias',
'								 where cod_empresa 				= :p78_cod_empresa',
'								   and matricula   				= :p78_matricula   ',
'								   and dt_inic_per_ferias = v_data_ini;',
'',
'					 END;',
'',
'END IF;',
'',
'exception',
'when others then',
'null;',
'',
'end;'))
,p_attribute_02=>'P78_ITEM_VALIDACAO,P78_COD_EMPRESA,P78_MATRICULA,P78_COD_SOLICITACAO'
,p_attribute_03=>'P78_MENSAGEM,P78_DIAS_DESCANSO_ADICIONAL,P78_SALDO_BRUTO,P78_SALDO,P78_IND_SITUACAO_PERIODO,P78_DT_INIC_PER_FERIAS,P78_DT_FIM_PER_FERIAS,P78_FALTA_HORA,P78_FALTA_MINUTO,P78_DC_MATRICULA'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(143343625865042737824)
,p_event_id=>wwv_flow_api.id(143343625592681737822)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_OPCAO_FERIAS'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(143343625936445737825)
,p_event_id=>wwv_flow_api.id(143343625592681737822)
,p_event_result=>'TRUE'
,p_action_sequence=>50
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_OPCAO_FERIAS_1'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329761934241718528)
,p_name=>unistr('(Cria\00E7\00E3o) Matricula: Popula_Campos 2')
,p_event_sequence=>88
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_MATRICULA'
,p_condition_element=>'P78_MATRICULA'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>wwv_flow_string.join(wwv_flow_t_varchar2(
'/*if :P78_ROWID is null and NVL(:P78_OK,''S'') = ''S'' then',
'return true;',
'else',
'return false;',
'end if;*/',
'',
'return :P78_FLAG_CTRL is null and :P78_ROWID is null and nvl(:P78_OK,''S'') = ''S'';'))
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329762500293718529)
,p_event_id=>wwv_flow_api.id(276329761934241718528)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
' flag number := Null;',
' Cursor c_idade_colab Is ',
'  select trunc(months_between(sysdate,i.DT_NASC)/12) as idade  from inf_pessoais_cad i  where i.MATRICULA = :p78_matricula and i.COD_EMPRESA = :p78_cod_empresa;',
' v_idade_colab c_idade_colab%rowtype;',
' Cursor c_idades Is',
'  select fer.IDADE_MAXIMA, fer.IDADE_MINIMA ',
'  from ferias_parametros fer, inf_pessoais_cad inf',
'  where inf.cod_empresa = fer.cod_empresa and inf.cod_empresa = :P78_COD_EMPRESA and inf.matricula = :P78_matricula and inf.filial = fer.cod_filial;',
' r_idades c_idades%RowType;',
' cursor c1 is',
' select nvl(a.pagto_abono_ferias, ''N'') abono_ferias, a.saldo_fer_min, c.dt_ref_folha, a.cod_filial, b.vinculo',
' from filiais_cad a, informacoes_funcionais b, parametros_recursos_humanos c',
' where  b.cod_empresa = a.cod_empresa and b.filiaL = a.cod_filial and b.cod_empresa = :P78_cod_empresa and b.matricula = :P78_matricula and c.cod_empresa = b.cod_Empresa;',
' v_c1 c1%rowtype;',
'v_data_ini date;',
'cursor c3 (v_filial number) is',
'select qtd_parcelas from ferias_Parametros where cod_empresa = :P78_cod_empresa and cod_filial = v_filial;',
'v_c3 c3%rowtype;',
'v_dias_direito number;',
'v_saldo_bruto number := :P78_SALDO_BRUTO;',
'v_saldo number := :P78_SALDO;',
'v_dias_abono_pec1 number := :P78_DIAS_ABONO_PEC1;',
'begin',
'IF :P78_MATRICULA IS NOT NULL THEN',
'EXECUTE IMMEDIATE ''ALTER SESSION SET NLS_NUMERIC_CHARACTERS= ''''.,'''' '';',
'v_saldo_bruto := replace(v_saldo_bruto,'','',''.''); v_saldo := replace(v_saldo,'','',''.''); :P78_MENSAGEM := NULL;',
'If (:P78_matricula Is Not Null And :P78_num_dias_parc1 Is Null) Then',
'Open c_idades; Fetch c_idades Into r_idades; Close c_idades;',
'Open  c_idade_colab; Fetch c_idade_colab Into v_idade_colab; Close c_idade_colab;',
'If (v_idade_colab.idade > r_idades.idade_maxima Or v_idade_colab.idade < r_idades.idade_minima) Then',
':P78_num_dias_parc1  := 30; :P78_dias_abono_pec1 := 0; :p78_num_dias_parc1_dsp  := ''N''; :p78_dias_abono_pec1_dsp := ''N'';',
'Else',
' if :p78_dt_saida_parc1 is not null then',
'  :P78_num_dias_parc1  := 0; :P78_dias_abono_pec1 := 0;',
' else',
'  :P78_num_dias_parc1  := null; :P78_dias_abono_pec1 := v_dias_abono_pec1; :p78_num_dias_parc1_dsp  := ''S''; :p78_dias_abono_pec1_dsp := ''S'';',
' end if;',
'End If;',
'End If;',
'open  c1; fetch c1 into v_c1; close c1;',
' :p78_filial := v_c1.cod_filial; :p78_saldo_fer_min := v_c1.saldo_fer_min;',
' v_dias_direito := Pkg_Atlz_Saldo_Ferias./*fnc_Ret*/Dias_Direito(:P78_COD_EMPRESA,:P78_MATRICULA,:P78_DT_INIC_PER_FERIAS_1,:P78_DT_FIM_PER_FERIAS_1);',
' IF v_dias_direito IS NULL THEN',
' if NVL(:p78_jornada_reduzida,''N'') = ''N'' then',
' v_dias_direito := (30 - nvl(trim(v_saldo_bruto),0)) + (nvl(trim(v_saldo),0));',
' else',
' v_dias_direito := (18 - nvl(trim(v_saldo_bruto),0)) + (nvl(trim(v_saldo),0));',
' end if;',
' v_dias_direito := nvl(f_jornada_reduzida(:p78_cod_empresa,:p78_matricula,v_dias_direito,null),0);',
' if nvl(:p78_falta_hora,0) > 7 and NVL(:p78_jornada_reduzida,''N'') = ''S'' then',
' v_dias_direito := v_dias_direito / 2;',
' end if;',
' END IF;',
' :p78_DIAS_DIREITO := nvl(v_dias_direito,0);--NAO',
'  if :P78_matricula is not null then',
'begin',
'select distinct a.falta_hora, a.falta_minuto',
'into :P78_falta_hora, :P78_falta_minuto',
'from ferias a',
'where a.cod_empresa = :P78_COD_EMPRESA and a.matricula = :P78_matricula',
'and a.dt_inic_per_ferias = ',
'(select min(dt_inic_per_ferias) v_data_ini from ferias ',
'where cod_empresa = a.cod_empresa and matricula = a.matricula',
unistr('--Bruno Sousa comentado condi\00E7\00E3o abaixo 24/06/2024'),
'and (cod_solicitacao Is Null and dt_saida_parc1 is null and dt_saida_parc2 is null and dt_saida_parc4 is null)',
'AND NOT EXISTS(SELECT 1',
'FROM REQUISICAO_FERIAS B',
'WHERE B.COD_EMPRESA = A.COD_EMPRESA',
'AND B.MATRICULA = A.MATRICULA',
'AND B.DT_INIC_PER_FERIAS = A.DT_INIC_PER_FERIAS',
'AND B.SIT_REQUISICAO not in (3,4,6))',
'and ind_situacao_periodo in (''P'',''R''));',
'exception',
'when others then null;',
'end;',
'  end if;',
'open  c3(v_c1.cod_filial);',
'fetch c3 into v_c3;',
'close c3;',
'if v_c1.vinculo <> ''E'' then',
':p78_qtd_parcelas := v_c3.qtd_parcelas;',
'else',
':p78_qtd_parcelas := 1;',
'end if;',
':P78_VINCULO := V_C1.VINCULO;',
'END IF;',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_SALDO_BRUTO,P78_SALDO,P78_ROWID,P78_OK,P78_FALTA_HORA,P78_JORNADA_REDUZIDA,P78_DIAS_ABONO_PEC1,P78_DIAS_DIREITO,P78_DT_INIC_PER_FERIAS_1,P78_DT_FIM_PER_FERIAS_1'
,p_attribute_03=>'P78_NUM_DIAS_PARC1,P78_DIAS_ABONO_PEC1,P78_FALTA_HORA,P78_FALTA_MINUTO,P78_FLAG,P78_OK,P78_MENSAGEM,P78_FILIAL,P78_QTD_PARCELAS,P78_SALDO_FER_MIN,P78_DIAS_DIREITO,P78_VINCULO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(173363196500938845039)
,p_name=>'Popula_campos_3'
,p_event_sequence=>98
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_MATRICULA'
,p_condition_element=>'P78_MATRICULA'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return nvl(:P78_FLAG_CTRL,0) = 1;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(173363197110416845045)
,p_event_id=>wwv_flow_api.id(173363196500938845039)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'  v_cod_empresa number;',
'  v_matricula number;',
'  v_data_ini date;',
'  v_dias_direito number;',
'  v_saldo_bruto number(15,2);',
'  v_saldo number(15,2);',
'  vDT_SAIDA_PARC1 date;',
'  vIND_SITUACAO_PERIODO varchar2(1);',
'  vNUM_DIAS_PARC1 number(2);',
'  vDIAS_ABONO_PEC1 number(2);',
'  vOPCAO_13SAL1 varchar2(1);',
'  vDT_RETORNO_PARC1 date;',
'begin',
'select A.COD_EMPRESA, A.MATRICULA, A.DT_INIC_PER_FERIAS, A.OPCAO_FERIAS, A.OPCAO_FERIAS',
'into v_cod_empresa, v_matricula, v_data_ini, :P78_OPCAO_FERIAS_A, :P78_OP',
'from REQUISICAO_FERIAS A',
'where A.COD_SOLICITACAO = :P78_COD_REQ;',
'select A.COD_FILIAL ',
'into :P78_FILIAL',
'from FILIAIS_CAD A,',
'     INFORMACOES_FUNCIONAIS B',
'where A.COD_EMPRESA = B.COD_EMPRESA',
'and A.COD_FILIAL = B.filiaL',
'and B.COD_EMPRESA = v_cod_empresa',
'and B.MATRICULA = v_matricula;',
'select  ',
'A.DT_INIC_PER_FERIAS,',
'A.DT_FIM_PER_FERIAS,',
'A.IND_SITUACAO_PERIODO,',
'case A.IND_SITUACAO_PERIODO',
'when ''P'' then ''Pendente''',
'when ''G'' then ''Gozado''',
'when ''Q'' then ''Quitado''',
'when ''R'' then ''Parcial''',
'when ''C'' then ''Cancelado''',
'end,',
'A.FALTA_HORA,',
'A.FALTA_MINUTO,',
'A.DIAS_DESCANSO_ADICIONAL,',
'A.SALDO_BRUTO,',
'A.SALDO,',
'A.IND_SITUACAO_PARC_2,',
'A.IND_SITUACAO_PARC_4,',
'--Bruno Sousa 21/08/2024',
'A.IND_SITUACAO_PERIODO,',
'NVL(A.DT_SAIDA_PARC1, R.DT_SAIDA_PARC1),',
'NVL(A.NUM_DIAS_PARC1, R.NUM_DIAS_PARC1),',
'NVL(A.DIAS_ABONO_PEC1, R.DIAS_ABONO_PEC1),',
'NVL(A.OPCAO_13SAL1, R.OPCAO_13SAL1),',
'NVL(A.DT_RETORNO_PARC1, R.DT_RETORNO_PARC1)',
'into',
':P78_DT_INIC_PER_FERIAS_1,',
':P78_DT_FIM_PER_FERIAS_1,',
':P78_IND_SITUACAO_PERIODO_A,',
':P78_IND_SITUACAO_PERIODO_1,',
':P78_FALTA_HORA_1,',
':P78_FALTA_MINUTO_1,',
':P78_DIAS_DESCANSO_ADICIONAL_1,',
'v_saldo_bruto,',
'v_saldo,',
':P78_IND_SITUACAO_PARC_2_A,',
':P78_IND_SITUACAO_PARC_4_A,',
'--Bruno Sousa 21/08/2024',
'vIND_SITUACAO_PERIODO,',
'vDT_SAIDA_PARC1,',
'vNUM_DIAS_PARC1,',
'vDIAS_ABONO_PEC1,',
'vOPCAO_13SAL1,',
'vDT_RETORNO_PARC1',
'from FERIAS A, REQUISICAO_FERIAS R',
'where A.COD_EMPRESA = v_cod_empresa',
'and A.MATRICULA = v_matricula',
'and A.DT_INIC_PER_FERIAS = v_data_ini',
'and R.COD_SOLICITACAO = :P78_COD_REQ;',
'',
'if vIND_SITUACAO_PERIODO = ''R'' or (vIND_SITUACAO_PERIODO = ''P'' and to_char(sysdate, ''yyyymm'') >= to_char(vDT_SAIDA_PARC1, ''yyyymm'')) then',
'  :P78_DT_SAIDA_PARC1_1 := vDT_SAIDA_PARC1;',
'  :P78_NUM_DIAS_PARC1_1 := vNUM_DIAS_PARC1;',
'  :P78_DIAS_ABONO_PEC1_1 := vDIAS_ABONO_PEC1;',
'  :P78_OPCAO_13SAL1_1 := vOPCAO_13SAL1;',
'  :P78_DT_RETORNO_PARC1_1 := vDT_RETORNO_PARC1;',
'end if;',
':P78_DT_RETORNO_PARC1_1_AUX := :P78_DT_RETORNO_PARC1_1;',
'v_dias_direito := Pkg_Atlz_Saldo_Ferias.Dias_Direito(v_cod_empresa,v_matricula,:P78_DT_INIC_PER_FERIAS_1,:P78_DT_FIM_PER_FERIAS_1);',
'if v_dias_direito is null then',
'  if nvl(:P78_JORNADA_REDUZIDA,''N'') = ''N'' then',
'    v_dias_direito := (30 - nvl(trim(v_saldo_bruto),0)) + (nvl(trim(v_saldo),0)); -- Humberto/Izidoro 29/09/2014',
'  else',
'    v_dias_direito := (18 - nvl(trim(v_saldo_bruto),0)) + (nvl(trim(v_saldo),0)); -- Humberto/Izidoro 29/09/2014',
'  end if;',
'  if instr(1/2,'','') > 0 then',
'    EXECUTE IMMEDIATE ''ALTER SESSION SET NLS_NUMERIC_CHARACTERS=".,"'';',
'  end if;',
'  v_dias_direito := f_jornada_reduzida(v_cod_empresa,v_matricula,v_dias_direito,null);',
'  if :P78_FALTA_HORA > 7 and nvl(:P78_JORNADA_REDUZIDA,''N'') = ''S'' then',
'    v_dias_direito := v_dias_direito / 2;',
'  end if;',
'end if;',
':P78_DIAS_DIREITO_1 := v_dias_direito;',
':P78_SALDO_BRUTO_1 := nvl(trim(v_saldo_bruto),0);',
':P78_SALDO_1 := nvl(trim(v_saldo),0);',
':P78_DIAS_DIREITO_OPC := nvl(:P78_DIAS_DIREITO_1,0);',
'if :P78_OPCAO_FERIAS_A is not null then',
'select A.QTD_PARCELAS,A.DIAS_ABONO_PEC1',
'into :P78_PARCELAS_OPC,:P78_DIAS_ABONO_PEC1_OPC',
'from FERIAS_PARAMETROS_PARCELAS A',
'where A.COD_EMPRESA = v_cod_empresa',
'and A.COD_FILIAL = :P78_FILIAL',
'and A.COD = :P78_OPCAO_FERIAS_A;',
'end if;',
'',
'IF :P78_DT_SAIDA_PARC1_1 IS NULL THEN -- Igor 30/03',
' :P78_OPCAO_FERIAS_A := NULL;',
' :P78_OP := NULL;',
'END IF;',
'exception',
'when others then',
'  return;',
'end;',
'IF :P78_OPCAO_FERIAS_A IS NOT NULL THEN',
':P78_OPCAO_FERIAS_DB := :P78_OPCAO_FERIAS_A;',
':P78_OPCAO_FERIAS := :P78_OPCAO_FERIAS_A;',
':P78_OPCAO_FERIAS_CARREGA := 1;',
'ELSE',
':P78_OPCAO_FERIAS_CARREGA := 0;',
'END IF;'))
,p_attribute_02=>'P78_COD_REQ,P78_COD_EMPRESA,P78_MATRICULA,P78_DT_SAIDA_PARC1_1'
,p_attribute_03=>'P78_OP,P78_IND_SITUACAO_PARC_2_A,P78_IND_SITUACAO_PARC_4_A,P78_OPCAO_FERIAS_A,P78_DT_SAIDA_PARC1_1,P78_NUM_DIAS_PARC1_1,P78_DIAS_ABONO_PEC1_1,P78_OPCAO_13SAL1_1,P78_DT_RETORNO_PARC1_1,P78_DIAS_ABONO_PEC1_OPC,P78_PARCELAS_OPC,P78_DT_INIC_PER_FERIAS_1,'
||'P78_DT_FIM_PER_FERIAS_1,P78_IND_SITUACAO_PERIODO_A,P78_IND_SITUACAO_PERIODO_1,P78_FALTA_HORA_1,P78_FALTA_MINUTO_1,P78_DIAS_DIREITO_1,P78_DIAS_DESCANSO_ADICIONAL_1,P78_SALDO_BRUTO_1,P78_SALDO_1,P78_FILIAL,P78_DIAS_DIREITO_OPC,P78_DT_RETORNO_PARC1_1_AU'
||'X,P78_OPCAO_FERIAS_CARREGA'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(173363196766078845042)
,p_event_id=>wwv_flow_api.id(173363196500938845039)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_OPCAO_FERIAS_1'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329762876269718529)
,p_name=>'Inicia Alertify'
,p_event_sequence=>108
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_TITULO'
,p_bind_type=>'bind'
,p_bind_event_type=>'click'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329763326634718529)
,p_event_id=>wwv_flow_api.id(276329762876269718529)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'PLUGIN_BE.CTB.ALERTIFY'
,p_attribute_01=>'DIALOG'
,p_attribute_02=>'CONFIRM'
,p_attribute_03=>'STANDARD'
,p_attribute_04=>'Teste'
,p_attribute_09=>'DEFAULT'
,p_attribute_10=>'OK'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329763800451718530)
,p_name=>'Pre_Text_Dt_Saida_Parc1'
,p_event_sequence=>118
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_SAIDA_PARC1'
,p_bind_type=>'bind'
,p_bind_event_type=>'focusin'
,p_display_when_type=>'NEVER'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329764262658718530)
,p_event_id=>wwv_flow_api.id(276329763800451718530)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'cursor c_existe is',
'select matricula',
'  from ferias',
' where cod_empresa = :p78_cod_empresa',
'   and matricula = :p78_matricula',
'   and dt_inic_per_ferias = :p78_dt_inic_per_ferias',
'   and dt_fim_per_ferias = :p78_dt_fim_per_ferias',
'   and dt_saida_parc1 = :p78_dt_saida_parc1;',
'   ',
'v_saldo_bruto_char varchar2(1000) := :P78_saldo_bruto;',
'v_saldo_bruto_number number;',
'',
'begin',
'',
'if instr(trim(v_saldo_bruto_char),'','') > 0 then',
'   v_saldo_bruto_number := to_number(replace(trim(v_saldo_bruto_char),'','',''.''));',
'else',
'   v_saldo_bruto_number := to_number(trim(v_saldo_bruto_char));',
'end if; ',
'',
'if :p78_dt_saida_parc1 is not null then',
'',
':p78_mensagem := null;',
'',
'pkg_ferias.Pre_Text_Dt_Saida_Parc1(:P78_cod_empresa,',
'                                   :P78_matricula,',
'                                   :P78_falta_hora,',
'                                   :P78_dt_fim_per_ferias,',
'                                   :P78_jornada_reduzida,',
'                                   :P78_dias_direito,',
'                                   v_saldo_bruto_number, --:P78_saldo_bruto,',
'                                   :P78_tipo_ferias1,',
'                                   :P78_num_dias_parc1,',
'                                   :P78_dias_abono_pec1,',
'                                   :P78_saldo,',
'                                   :p78_ind_situacao_periodo,',
'                                   :p78_dias_abono_pec1_dsp,',
'                                   :p78_num_dias_parc1_dsp,',
'                                   v_flg_retorno,',
'                                   v_msg_retorno);',
' ',
' if v_msg_retorno is not null then',
'    :p78_ok       := ''N'';',
'    :p78_flag     := v_flg_retorno;',
'    :p78_mensagem := v_msg_retorno;',
' else',
'    :p78_flag     := null;',
'    :p78_mensagem := null;',
'    :p78_ok       := ''S'';',
' end if;',
'',
'end if;',
' ',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_FALTA_HORA,P78_DT_FIM_PER_FERIAS,P78_JORNADA_REDUZIDA,P78_DIAS_DIREITO,P78_SALDO_BRUTO,P78_TIPO_FERIAS1,P78_NUM_DIAS_PARC1,P78_DIAS_ABONO_PEC1,P78_SALDO,P78_IND_SITUACAO_PERIODO,P78_DT_SAIDA_PARC1,P78_DT_INIC_PER_FER'
||'IAS'
,p_attribute_03=>'P78_TIPO_FERIAS1,P78_NUM_DIAS_PARC1,P78_DIAS_ABONO_PEC1,P78_FLAG,P78_MENSAGEM,P78_OK,P78_SALDO,P78_DIAS_ABONO_PEC1_DSP,P78_NUM_DIAS_PARC1_DSP'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329764644734718531)
,p_name=>'Valida_Dt_Saida_Parc1'
,p_event_sequence=>128
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_SAIDA_PARC1'
,p_condition_element=>'P78_DT_SAIDA_PARC1'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return :P78_ROWID is null and :P78_FLAG_CTRL is null;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329765152131718531)
,p_event_id=>wwv_flow_api.id(276329764644734718531)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_cod_empresa number;',
'v_cod_solicitacao number;',
'v_matricula number;',
'v_dt_inic_per_ferias date;',
'v_dt_fim_per_ferias date;',
'v_dt_saida_parc2 date :=null;',
'v_saldo_bruto number;',
'v_falta_hora number;',
'v_dias_direito number;',
'v_dt_saida_parc1 date;',
'v_saldo number;',
'v_dias_abono_pec1 number;',
'v_num_dias_parc1 number;',
'v_opcao_13sal1 varchar2(1);',
'v_opcao_13sal2 varchar2(1);',
'v_tipo_ferias1 varchar2(1);',
'v_dt_retorno_parc1 date;',
'v_dt_retorno_parc1_old date;',
'v_dt_pagto_parc1 date;',
'v_jornada_reduzida varchar2(10);',
'v_ind_situacao_periodo varchar2(3);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'V_DT_SAIDA date;',
'BEGIN',
'',
':p78_mensagem := null;',
'',
'V_DT_SAIDA := :P78_DT_SAIDA_PARC1;',
'v_flg_retorno := PKG_FERIAS.VALIDA_DT_SAIDA(:P78_COD_EMPRESA,:P78_MATRICULA,V_DT_SAIDA,v_msg_retorno);',
'IF v_flg_retorno = ''N'' THEN',
'  :P78_ok := ''N'';',
'  :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_dt_saida_parc1''));',
unistr('  :p78_mensagem := ''Sa\00EDda Parcela 1: ''||v_msg_retorno;'),
'  return;',
'END IF;',
'  ',
'v_cod_empresa:= :p78_cod_empresa;',
'v_cod_solicitacao := :p78_cod_solicitacao;',
'v_matricula := :p78_matricula;',
'v_dt_inic_per_ferias := :p78_dt_inic_per_ferias;',
'v_dt_fim_per_ferias := :p78_dt_fim_per_ferias;',
'v_dt_saida_parc2 := :p78_dt_saida_parc2;',
'v_saldo_bruto := :p78_saldo_bruto;',
'v_falta_hora := :p78_falta_hora;',
'v_dias_direito := :p78_dias_direito;',
'v_dt_saida_parc1 := nvl(V_DT_SAIDA, :p78_dt_saida_parc1);',
'v_saldo := :p78_saldo;',
'v_dias_abono_pec1 := :p78_dias_abono_pec1;',
'v_num_dias_parc1 := :p78_num_dias_parc1;',
'v_opcao_13sal1 := :p78_opcao_13sal1;',
'v_opcao_13sal2 := :p78_opcao_13sal2;',
'v_tipo_ferias1 := :p78_tipo_ferias1;',
'v_dt_retorno_parc1 := :p78_dt_retorno_parc1;',
'v_dt_retorno_parc1_old := :p78_dt_retorno_parc1;',
'v_dt_pagto_parc1 := :p78_dt_pagto_parc1;',
'v_jornada_reduzida := :p78_jornada_reduzida;',
'v_ind_situacao_periodo := :p78_ind_situacao_periodo;',
'',
'pkg_ferias.Valida_Dt_Saida_Parc1(v_cod_empresa,',
'v_cod_solicitacao,',
'v_matricula,',
'v_dt_inic_per_ferias,',
'v_dt_fim_per_ferias,',
'v_dt_saida_parc2,',
'v_saldo_bruto,',
'v_falta_hora,',
'v_dias_direito,',
'v_dt_saida_parc1,',
'v_saldo,',
'v_dias_abono_pec1,',
'v_num_dias_parc1,',
'v_opcao_13sal1,',
'v_opcao_13sal2,',
'v_tipo_ferias1,',
'v_dt_retorno_parc1,',
'v_dt_pagto_parc1,',
'v_jornada_reduzida,',
'v_ind_situacao_periodo,',
':p78_dias_abono_pec1_dsp,',
':p78_num_dias_parc1_dsp,',
'v_flg_retorno,',
'v_msg_retorno);',
'',
':p78_saldo := nvl(v_saldo,:p78_saldo);',
':p78_dias_abono_pec1 := NVL(nvl(v_dias_abono_pec1, :p78_dias_abono_pec1),0);',
':p78_num_dias_parc1 := nvl(v_num_dias_parc1,:p78_num_dias_parc1);',
':p78_opcao_13sal1 := nvl(v_opcao_13sal1,:p78_opcao_13sal1);',
':p78_opcao_13sal2 := nvl(v_opcao_13sal2,:p78_opcao_13sal2);',
':p78_tipo_ferias1 := nvl(v_tipo_ferias1,:p78_tipo_ferias1);',
'',
':P78_TESTE := :P78_TESTE||''(A1) V_DT_RETORNO_PARC1: ''||V_DT_RETORNO_PARC1;',
'',
'IF V_DT_RETORNO_PARC1 IS NOT NULL THEN',
':p78_dt_retorno_parc1 := v_dt_retorno_parc1;',
unistr(':P78_DT_RETORNO_PARC1_X := v_dt_retorno_parc1; -- Cibele 01/04/2022, n\00E3o estava atualizando corretamente a data de retorno da P1'),
'ELSE',
':p78_dt_retorno_parc1 := v_dt_retorno_parc1_old;',
unistr(':p78_dt_retorno_parc1_X := v_dt_retorno_parc1_old; -- Cibele 01/04/2022, n\00E3o estava atualizando corretamente a data de retorno da P1'),
'END IF;',
'',
':p78_dt_pagto_parc1 := nvl(v_dt_pagto_parc1,:p78_dt_pagto_parc1);',
'',
':P78_TESTE := :P78_TESTE||''(A2) p78_dt_retorno_parc1: ''||:p78_dt_retorno_parc1;',
'',
'if trim(v_msg_retorno) is not null then',
'',
'if v_flg_retorno in (''N'',''Q'') then',
'    :P78_ok := ''N'';',
'    :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_dt_saida_parc1''));',
'else',
'    :P78_ok := ''S'';',
'end if;',
'',
':P78_flag := v_flg_retorno;',
':P78_mensagem := v_msg_retorno;',
'else',
':P78_DT_1 := V_DT_SAIDA;',
':P78_flag := null;',
':P78_mensagem := null;',
'if v_item_validacao = TRIM(UPPER(''p78_dt_saida_parc1'')) OR v_item_validacao IS NULL then',
'   :P78_OK := ''S'';',
'   :P78_ITEM_VALIDACAO := null;',
'else',
'   :P78_ITEM_VALIDACAO := v_item_validacao;',
'end if;',
'end if;',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_COD_SOLICITACAO,P78_MATRICULA,P78_DT_INIC_PER_FERIAS,P78_DT_FIM_PER_FERIAS,P78_DT_SAIDA_PARC2,P78_SALDO_BRUTO,P78_FALTA_HORA,P78_DIAS_DIREITO,P78_DT_SAIDA_PARC1,P78_SALDO,P78_DIAS_ABONO_PEC1,P78_NUM_DIAS_PARC1,P78_OPCAO_13SAL1,P78'
||'_OPCAO_13SAL2,P78_TIPO_FERIAS1,P78_DT_RETORNO_PARC1,P78_DT_PAGTO_PARC1,P78_JORNADA_REDUZIDA,P78_IND_SITUACAO_PERIODO,P78_ITEM_VALIDACAO,P78_TESTE'
,p_attribute_03=>'P78_NUM_DIAS_PARC1,P78_DIAS_ABONO_PEC1,P78_OPCAO_13SAL1,P78_OPCAO_13SAL2,P78_TIPO_FERIAS1,P78_DT_PAGTO_PARC1,P78_DT_RETORNO_PARC1,P78_FLAG,P78_MENSAGEM,P78_OK,P78_ITEM_VALIDACAO,P78_DIAS_ABONO_PEC1_DSP,P78_NUM_DIAS_PARC1_DSP,P78_DT_RETORNO_PARC1_X,P7'
||'8_DT_1'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(266515228738835677540)
,p_event_id=>wwv_flow_api.id(276329764644734718531)
,p_event_result=>'TRUE'
,p_action_sequence=>40
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_CLEAR'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_NUM_DIAS_PARC1_DSP,P78_NUM_DIAS_PARC1,P78_DIAS_ABONO_PEC1_DSP,P78_DIAS_ABONO_PEC1,P78_DIAS_ABONO_PEC1_LST,P78_OPCAO_13SAL1,P78_DESC_ADICIONAL1,P78_DT_RETORNO_PARC1_X,P78_DT_RETORNO_PARC1,P78_TIPO_FERIAS1,P78_OPCAO_ABONO_PEC1'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(173363197705573845051)
,p_name=>'Valida_Dt_Saida_Parc1a'
,p_event_sequence=>138
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_SAIDA_PARC1'
,p_condition_element=>'P78_DT_SAIDA_PARC1'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return nvl(:P78_FLAG_CTRL,0) = 1;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(173363197783590845052)
,p_event_id=>wwv_flow_api.id(173363197705573845051)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_cod_empresa number;',
'v_cod_solicitacao number;',
'v_matricula number;',
'v_dt_inic_per_ferias date;',
'v_dt_fim_per_ferias date;',
'v_dt_saida_parc2 date :=null;',
'v_saldo_bruto number;',
'v_falta_hora number;',
'v_dias_direito number;',
'v_dt_saida_parc1 date;',
'v_saldo number;',
'v_dias_abono_pec1 number;',
'v_num_dias_parc1 number;',
'v_opcao_13sal1 varchar2(1);',
'v_opcao_13sal2 varchar2(1);',
'v_tipo_ferias1 varchar2(1);',
'v_dt_retorno_parc1 date;',
'v_dt_retorno_parc1_old date;',
'v_dt_pagto_parc1 date;',
'v_jornada_reduzida varchar2(10);',
'v_ind_situacao_periodo varchar2(3);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'V_DT_SAIDA DATE;',
'BEGIN',
':p78_mensagem := null;',
'',
'V_DT_SAIDA := :P78_DT_SAIDA_PARC1;',
'v_flg_retorno := PKG_FERIAS.VALIDA_DT_SAIDA(:P78_COD_EMPRESA,:P78_MATRICULA,V_DT_SAIDA,v_msg_retorno);',
'IF v_flg_retorno = ''N'' THEN',
'  :P78_ok := ''N'';',
'  :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_dt_saida_parc1''));',
unistr('  :p78_mensagem := ''Sa\00EDda Parcela 1: ''||v_msg_retorno;'),
'  return;',
'END IF;',
'',
'v_cod_empresa:= :p78_cod_empresa;',
'v_cod_solicitacao := :p78_cod_solicitacao;',
'v_matricula := :p78_matricula;',
'v_dt_inic_per_ferias := :p78_dt_inic_per_ferias_1;',
'v_dt_fim_per_ferias := :p78_dt_fim_per_ferias_1;',
'v_dt_saida_parc2 := :p78_dt_saida_parc2;',
'v_saldo_bruto := :p78_saldo_bruto_1;',
'v_falta_hora := :p78_falta_hora_1;',
'v_dias_direito := :p78_dias_direito_1;',
'v_dt_saida_parc1 := nvl(V_DT_SAIDA,:p78_dt_saida_parc1);',
'v_saldo := :p78_saldo_1;',
'v_dias_abono_pec1 := :p78_dias_abono_pec1;',
'v_num_dias_parc1 := :p78_num_dias_parc1;',
'v_opcao_13sal1 := :p78_opcao_13sal1;',
'v_opcao_13sal2 := :p78_opcao_13sal2;',
'v_tipo_ferias1 := :p78_tipo_ferias1;',
'v_dt_retorno_parc1 := :p78_dt_retorno_parc1;',
'v_dt_retorno_parc1_old := :p78_dt_retorno_parc1;',
'v_dt_pagto_parc1 := :p78_dt_pagto_parc1;',
'v_jornada_reduzida := :p78_jornada_reduzida;',
'v_ind_situacao_periodo := :p78_ind_situacao_periodo_a;',
'',
'pkg_ferias.Valida_Dt_Saida_Parc1(v_cod_empresa,',
'v_cod_solicitacao,',
'v_matricula,',
'v_dt_inic_per_ferias,',
'v_dt_fim_per_ferias,',
'v_dt_saida_parc2,',
'v_saldo_bruto,',
'v_falta_hora,',
'v_dias_direito,',
'v_dt_saida_parc1,',
'v_saldo,',
'v_dias_abono_pec1,',
'v_num_dias_parc1,',
'v_opcao_13sal1,',
'v_opcao_13sal2,',
'v_tipo_ferias1,',
'v_dt_retorno_parc1,',
'v_dt_pagto_parc1,',
'v_jornada_reduzida,',
'v_ind_situacao_periodo,',
':p78_dias_abono_pec1_dsp,',
':p78_num_dias_parc1_dsp,',
'v_flg_retorno,',
'v_msg_retorno);',
'',
':p78_saldo := nvl(v_saldo,:p78_saldo);',
':p78_dias_abono_pec1 := NVL(nvl(v_dias_abono_pec1, :p78_dias_abono_pec1),0);',
':p78_num_dias_parc1 := nvl(v_num_dias_parc1,:p78_num_dias_parc1);',
':p78_opcao_13sal1 := nvl(v_opcao_13sal1,:p78_opcao_13sal1);',
':p78_opcao_13sal2 := nvl(v_opcao_13sal2,:p78_opcao_13sal2);',
':p78_tipo_ferias1 := nvl(v_tipo_ferias1,:p78_tipo_ferias1);',
'',
':P78_TESTE := :P78_TESTE||''(A1) V_DT_RETORNO_PARC1: ''||V_DT_RETORNO_PARC1;',
'',
'IF V_DT_RETORNO_PARC1 IS NOT NULL THEN',
':p78_dt_retorno_parc1 := v_dt_retorno_parc1;',
unistr(':P78_DT_RETORNO_PARC1_X := v_dt_retorno_parc1; -- Cibele 01/04/2022, n\00E3o estava atualizando corretamente a data de retorno da P1'),
'ELSE',
':p78_dt_retorno_parc1 := v_dt_retorno_parc1_old;',
unistr(':p78_dt_retorno_parc1_X := v_dt_retorno_parc1_old; -- Cibele 01/04/2022, n\00E3o estava atualizando corretamente a data de retorno da P1'),
'END IF;',
'',
':p78_dt_pagto_parc1 := nvl(v_dt_pagto_parc1,:p78_dt_pagto_parc1);',
'',
':P78_TESTE := :P78_TESTE||''(A2) p78_dt_retorno_parc1: ''||:p78_dt_retorno_parc1;',
'',
'if trim(v_msg_retorno) is not null then',
'',
'if v_flg_retorno in (''N'',''Q'') then',
'    :P78_ok := ''N'';',
'    :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_dt_saida_parc1''));',
'else',
'    :P78_ok := ''S'';',
'end if;',
'',
':P78_flag := v_flg_retorno;',
':P78_mensagem := v_msg_retorno;',
'else',
':p78_dt_1 := v_dt_saida_parc1;',
':P78_flag := null;',
':P78_mensagem := null;',
'if v_item_validacao = TRIM(UPPER(''p78_dt_saida_parc1'')) OR v_item_validacao IS NULL then',
'   :P78_OK := ''S'';',
'   :P78_ITEM_VALIDACAO := null;',
'else',
'   :P78_ITEM_VALIDACAO := v_item_validacao;',
'end if;',
'end if; ',
'',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_COD_SOLICITACAO,P78_MATRICULA,P78_DT_INIC_PER_FERIAS_1,P78_DT_FIM_PER_FERIAS_1,P78_DT_SAIDA_PARC2,P78_SALDO_BRUTO_1,P78_FALTA_HORA_1,P78_DIAS_DIREITO_1,P78_DT_SAIDA_PARC1,P78_SALDO_1,P78_DIAS_ABONO_PEC1,P78_NUM_DIAS_PARC1,P78_OPCA'
||'O_13SAL1,P78_OPCAO_13SAL2,P78_TIPO_FERIAS1,P78_DT_RETORNO_PARC1,P78_DT_PAGTO_PARC1,P78_JORNADA_REDUZIDA,P78_IND_SITUACAO_PERIODO_1,P78_ITEM_VALIDACAO,P78_TESTE'
,p_attribute_03=>'P78_NUM_DIAS_PARC1,P78_DIAS_ABONO_PEC1,P78_OPCAO_13SAL1,P78_OPCAO_13SAL2,P78_TIPO_FERIAS1,P78_DT_PAGTO_PARC1,P78_DT_RETORNO_PARC1,P78_FLAG,P78_MENSAGEM,P78_OK,P78_ITEM_VALIDACAO,P78_DIAS_ABONO_PEC1_DSP,P78_NUM_DIAS_PARC1_DSP,P78_DT_RETORNO_PARC1_X,P7'
||'8_DT_1'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(173363197890252845053)
,p_event_id=>wwv_flow_api.id(173363197705573845051)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_CLEAR'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_NUM_DIAS_PARC1_DSP,P78_NUM_DIAS_PARC1,P78_DIAS_ABONO_PEC1_DSP,P78_DIAS_ABONO_PEC1,P78_DIAS_ABONO_PEC1_LST,P78_OPCAO_13SAL1,P78_DESC_ADICIONAL1,P78_DT_RETORNO_PARC1_X,P78_DT_RETORNO_PARC1,P78_TIPO_FERIAS1,P78_OPCAO_ABONO_PEC1'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329765556756718532)
,p_name=>'Valida_Dt_Saida_Parc3_1'
,p_event_sequence=>148
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_SAIDA_PARC3'
,p_condition_element=>'P78_DT_SAIDA_PARC3'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return :P78_ROWID is null and :P78_FLAG_CTRL is null;'
);
end;
/
begin
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329766066232718533)
,p_event_id=>wwv_flow_api.id(276329765556756718532)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'begin',
'',
'pkg_ferias.Valida_Dt_Saida_Parc3_1(:p78_cod_empresa        ,',
'                                 :p78_matricula          ,',
'                                 :p78_cod_solicitacao    ,',
'                                 :p78_dt_inic_per_ferias ,',
'                                 :p78_dt_saida_parc3     ,',
'                                 v_flg_retorno        ,',
'                                 v_msg_retorno        ); ',
' ',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_dt_saida_parc3''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_dt_saida_parc3'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
' ',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_COD_SOLICITACAO,P78_MATRICULA,P78_DT_INIC_PER_FERIAS,P78_DT_SAIDA_PARC3,P78_ITEM_VALIDACAO'
,p_attribute_03=>'P78_OK,P78_FLAG,P78_MENSAGEM,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329766490509718533)
,p_name=>'Valida_Dt_Saida_Parc3_2'
,p_event_sequence=>158
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_SAIDA_PARC3'
,p_condition_element=>'P78_DT_SAIDA_PARC3'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'VAL_OF_ITEM_IN_COND_EQ_COND2'
,p_display_when_cond=>'P78_OK'
,p_display_when_cond2=>'S'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329766991461718534)
,p_event_id=>wwv_flow_api.id(276329766490509718533)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'begin',
'',
'pkg_ferias.Valida_Dt_Saida_Parc3_1(:p78_cod_empresa        ,',
'                                 :p78_matricula          ,',
'                                 :p78_cod_solicitacao    ,',
'                                 :p78_dt_inic_per_ferias ,',
'                                 :p78_dt_saida_parc3     ,',
'                                 v_flg_retorno        ,',
'                                 v_msg_retorno        ); ',
' ',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_matricula''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_matricula'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
' ',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_COD_SOLICITACAO,P78_MATRICULA,P78_DT_INIC_PER_FERIAS,P78_DT_SAIDA_PARC3,P78_ITEM_VALIDACAO'
,p_attribute_03=>'P78_OK,P78_FLAG,P78_MENSAGEM,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329767320399718534)
,p_name=>'When_New_Item_Parc2'
,p_event_sequence=>168
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_SAIDA_PARC2'
,p_condition_element=>'P78_DT_SAIDA_PARC2'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'focusin'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329767896237718535)
,p_event_id=>wwv_flow_api.id(276329767320399718534)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'begin',
'',
' pkg_ferias.When_New_Item_Parc2(:p78_cod_empresa,',
'                                :p78_matricula,',
'                                nvl(:p78_dt_saida_parc1,:p78_dt_saida_parc1_1),',
'                                nvl(:p78_num_dias_parc1,:p78_num_dias_parc1_1),',
'                                nvl(:p78_dias_abono_pec1,:p78_dias_abono_pec1_1),',
'                                :p78_dt_fim_per_ferias,',
'                                nvl(:p78_saldo,:p78_saldo_1),',
'                                nvl(:p78_dias_direito,:p78_dias_direito_1),',
'                                :p78_opcao_13sal2,',
'                                :p78_dias_abono_pec1_dsp,',
'                                :p78_num_dias_parc1_dsp,',
'                                v_flg_retorno,',
'                                v_msg_retorno); ',
'',
' ',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_dt_saida_parc2''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_dt_saida_parc2'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
' ',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_DT_SAIDA_PARC1,P78_NUM_DIAS_PARC1,P78_DIAS_ABONO_PEC1,P78_DT_FIM_PER_FERIAS,P78_SALDO,P78_DIAS_DIREITO,P78_ITEM_VALIDACAO,P78_DT_SAIDA_PARC1_1,P78_NUM_DIAS_PARC1_1,P78_DIAS_ABONO_PEC1_1,P78_DIAS_DIREITO_1,P78_SALDO_1'
,p_attribute_03=>'P78_OPCAO_13SAL2,P78_OK,P78_FLAG,P78_MENSAGEM,P78_ITEM_VALIDACAO,P78_DIAS_ABONO_PEC1_DSP,P78_NUM_DIAS_PARC1_DSP'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329768243232718535)
,p_name=>'When_New_Item_Parc4'
,p_event_sequence=>178
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_SAIDA_PARC4'
,p_condition_element=>'P78_DT_SAIDA_PARC4'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'focusin'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329768769420718536)
,p_event_id=>wwv_flow_api.id(276329768243232718535)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'begin',
'',
' pkg_ferias.When_New_Item_Parc4(:p78_cod_empresa,',
'                                :p78_matricula,',
'                                nvl(:P78_DT_SAIDA_PARC1,:P78_DT_SAIDA_PARC1_1),',
'                                nvl(:P78_num_dias_parc1,:P78_num_dias_parc1_1),',
'                                nvl(:P78_dias_abono_pec1,:P78_dias_abono_pec1_1),',
'                                nvl(:P78_DT_SAIDA_PARC2,:P78_DT_SAIDA_PARC2_1),',
'                                nvl(:P78_num_dias_parc2,:P78_num_dias_parc2_1),',
'                                nvl(:P78_dias_abono_pec2,:P78_dias_abono_pec2_1),',
'                                :p78_dt_saida_parc4,',
'                                :p78_num_dias_parc4,',
'                                :p78_dias_abono_pec4,',
'                                :p78_dt_fim_per_ferias,',
'                                :p78_saldo,',
'                                :p78_dias_direito,',
'                                :p78_opcao_13sal4,',
'                                :p78_dias_abono_pec1_dsp,',
'                                :p78_num_dias_parc1_dsp,',
'                                v_flg_retorno,',
'                                v_msg_retorno); ',
'',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_dt_saida_parc4''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_dt_saida_parc4'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
' ',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_DT_SAIDA_PARC1,P78_NUM_DIAS_PARC1,P78_DIAS_ABONO_PEC1,P78_DT_SAIDA_PARC2,P78_NUM_DIAS_PARC2,P78_DIAS_ABONO_PEC2,P78_DT_SAIDA_PARC4,P78_NUM_DIAS_PARC4,P78_DIAS_ABONO_PEC4,P78_DT_FIM_PER_FERIAS,P78_SALDO,P78_DIAS_DIREI'
||'TO,P78_OPCAO_13SAL4,P78_ITEM_VALIDACAO,P78_DT_SAIDA_PARC2_1,P78_NUM_DIAS_PARC2_1,P78_DIAS_ABONO_PEC2_1'
,p_attribute_03=>'P78_OPCAO_13SAL4,P78_OK,P78_FLAG,P78_MENSAGEM,P78_ITEM_VALIDACAO,P78_DIAS_ABONO_PEC1_DSP,P78_NUM_DIAS_PARC1_DSP'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329769178129718536)
,p_name=>'Valida_Dt_Saida_Parc2'
,p_event_sequence=>188
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_SAIDA_PARC2'
,p_condition_element=>'P78_DT_SAIDA_PARC2'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329769663908718537)
,p_event_id=>wwv_flow_api.id(276329769178129718536)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_DIAS_ABONO_PEC2 number := :P78_DIAS_ABONO_PEC2;',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'v_dt_saida date;',
'begin',
'',
'V_DT_SAIDA := :p78_dt_saida_parc2;',
'v_flg_retorno := PKG_FERIAS.VALIDA_DT_SAIDA(:P78_COD_EMPRESA,:P78_MATRICULA,V_DT_SAIDA,v_msg_retorno);',
'IF v_flg_retorno = ''N'' THEN',
'  :P78_ok := ''N'';',
'  :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_dt_saida_parc2''));',
unistr('  :p78_mensagem := ''Sa\00EDda Parcela 2: ''||v_msg_retorno;'),
'  return;',
'END IF;',
'pkg_ferias.Valida_Dt_Saida_Parc2(:p78_cod_empresa,',
'                                  :p78_cod_solicitacao,',
'                                  :p78_matricula,',
'                                  nvl(:p78_dt_saida_parc1,:p78_dt_saida_parc1_1),',
'                                  nvl(:p78_dt_retorno_parc1,:p78_dt_retorno_parc1_1),',
'                                  nvl(:p78_num_dias_parc1,:p78_num_dias_parc1_1),',
'                                  V_DT_SAIDA, --:p78_dt_saida_parc2,',
'                                  nvl(:p78_dias_abono_pec1,:p78_dias_abono_pec1_1),',
'                                  nvl(:p78_dt_inic_per_ferias,:p78_dt_inic_per_ferias_1),',
'                                  nvl(:p78_dt_fim_per_ferias,:p78_dt_fim_per_ferias_1),',
'                                  nvl(:p78_saldo,:p78_saldo_1),',
'                                  nvl(:p78_dias_direito,:p78_dias_direito_1),',
'                                 -- Inclusao da data limite como parametro nao obrigatorio para calculo da data de saida e retorno - chamado 29668 - Andre - 25-04-2023',
'                                  :P78_DT_LIMITE_REQ,',
'                                  :p78_num_dias_parc2,',
'                                  v_DIAS_ABONO_PEC2,',
'                                  :p78_dt_retorno_parc2,',
'                                  :p78_dt_pagto_parc2,',
'                                  :p78_tipo_ferias2,',
'                                  :p78_opcao_13sal2,',
'                                  :p78_dias_abono_pec1_dsp,',
'                                  :p78_num_dias_parc1_dsp,',
'                                  v_flg_retorno,',
'                                  v_msg_retorno);',
'',
' :P78_DIAS_ABONO_PEC2 := nvl(v_DIAS_ABONO_PEC2,:P78_DIAS_ABONO_PEC2);',
' ',
'',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_dt_saida_parc2''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :p78_dt_2     := V_DT_SAIDA;',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_dt_saida_parc2'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
' ',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_COD_SOLICITACAO,P78_MATRICULA,P78_DT_SAIDA_PARC1,P78_DT_RETORNO_PARC1,P78_NUM_DIAS_PARC1,P78_DT_SAIDA_PARC2,P78_DIAS_ABONO_PEC1,P78_DT_INIC_PER_FERIAS,P78_DT_FIM_PER_FERIAS,P78_SALDO,P78_DIAS_ABONO_PEC2,P78_DIAS_DIREITO,P78_ITEM_V'
||'ALIDACAO,P78_DT_SAIDA_PARC1_1,P78_DT_RETORNO_PARC1_1,P78_NUM_DIAS_PARC1_1,P78_DT_INIC_PER_FERIAS_1,P78_DT_FIM_PER_FERIAS_1,P78_SALDO_1,P78_DIAS_DIREITO_1,P78_COD_REQ'
,p_attribute_03=>'P78_TIPO_FERIAS2,P78_OK,P78_FLAG,P78_MENSAGEM,P78_ITEM_VALIDACAO,P78_DIAS_ABONO_PEC1_DSP,P78_NUM_DIAS_PARC1_DSP,P78_DT_RETORNO_PARC2,P78_DT_2'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329770063214718537)
,p_name=>'Valida_Dt_Saida_Parc4'
,p_event_sequence=>198
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_SAIDA_PARC4'
,p_condition_element=>'P78_DT_SAIDA_PARC4'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329770574935718537)
,p_event_id=>wwv_flow_api.id(276329770063214718537)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_DIAS_ABONO_PEC4 number := :P78_DIAS_ABONO_PEC4;',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'v_dt_saida date;',
'begin',
'',
'V_DT_SAIDA := :p78_dt_saida_parc4;',
'v_flg_retorno := PKG_FERIAS.VALIDA_DT_SAIDA(:P78_COD_EMPRESA,:P78_MATRICULA,V_DT_SAIDA,v_msg_retorno);',
'IF v_flg_retorno = ''N'' THEN',
'  :P78_ok := ''N'';',
'  :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_dt_saida_parc2''));',
unistr('  :p78_mensagem := ''Sa\00EDda Parcela 2: ''||v_msg_retorno;'),
'  return;',
'END IF;',
'',
'pkg_ferias.Valida_Dt_Saida_Parc4(:p78_cod_empresa,',
'                                  :p78_cod_solicitacao,',
'                                  :p78_matricula,',
'                                  nvl(:p78_dt_saida_parc1,:p78_dt_saida_parc1_1),',
'                                  :p78_dt_retorno_parc1,',
'                                  nvl(:p78_dt_saida_parc2,:p78_dt_saida_parc2_1),',
'                                  :p78_dt_retorno_parc2,',
'                                  nvl(:p78_num_dias_parc1,:p78_num_dias_parc1_1),',
'                                  nvl(:p78_num_dias_parc2,:p78_num_dias_parc2_1),',
'                                  V_DT_SAIDA, --:p78_dt_saida_parc4,',
'                                  nvl(:p78_dias_abono_pec1,:p78_dias_abono_pec1_1),',
'                                  nvl(:p78_dt_inic_per_ferias,:p78_dt_inic_per_ferias_1),',
'                                  nvl(:p78_dt_fim_per_ferias,:p78_dt_fim_per_ferias_1),',
'                                  nvl(:p78_saldo,:p78_saldo_1),',
'                                  nvl(:p78_dias_direito,:p78_dias_direito_1),',
'                                 -- Inclusao da data limite como parametro nao obrigatorio para calculo da data de saida e retorno - chamado 29668 - Andre - 25-04-2023',
'                                  :P78_DT_LIMITE_REQ,',
'                                  :p78_num_dias_parc4,',
'                                  :p78_dias_abono_pec4,',
'                                  :p78_dt_retorno_parc4,',
'                                  :p78_dt_pagto_parc4,',
'                                  :p78_tipo_ferias4,',
'                                  :p78_opcao_13sal4,',
'                                  :p78_dias_abono_pec1_dsp,',
'                                  :p78_num_dias_parc1_dsp,',
'                                  v_flg_retorno,',
'                                  v_msg_retorno);',
'								  ',
' :P78_DIAS_ABONO_PEC4 := nvl(v_DIAS_ABONO_PEC4,:P78_DIAS_ABONO_PEC4);',
'',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_dt_saida_parc4''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :p78_dt_4     := V_DT_SAIDA;',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_dt_saida_parc4'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
' ',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_COD_SOLICITACAO,P78_MATRICULA,P78_DT_SAIDA_PARC1,P78_DT_RETORNO_PARC1,P78_DT_SAIDA_PARC2,P78_DT_RETORNO_PARC2,P78_NUM_DIAS_PARC1,P78_NUM_DIAS_PARC2,P78_DT_SAIDA_PARC4,P78_DIAS_ABONO_PEC1,P78_DT_INIC_PER_FERIAS,P78_DT_FIM_PER_FERIA'
||'S,P78_SALDO,P78_DIAS_DIREITO,P78_NUM_DIAS_PARC4,P78_DIAS_ABONO_PEC4,P78_DT_RETORNO_PARC4,P78_DT_PAGTO_PARC4,P78_TIPO_FERIAS4,P78_OPCAO_13SAL4,P78_DIAS_ABONO_PEC1_DSP,P78_NUM_DIAS_PARC1_DSP,P78_ITEM_VALIDACAO,P78_DT_SAIDA_PARC1_1,P78_DT_SAIDA_PARC2_1,'
||'P78_NUM_DIAS_PARC1_1,P78_NUM_DIAS_PARC2_1,P78_DIAS_ABONO_PEC1_1,P78_DT_SAIDA_PARC2_1,P78_NUM_DIAS_PARC2_1,P78_DIAS_ABONO_PEC2_1'
,p_attribute_03=>'P78_NUM_DIAS_PARC4,P78_DT_RETORNO_PARC4,P78_DT_PAGTO_PARC4,P78_TIPO_FERIAS4,P78_OPCAO_13SAL4,P78_OK,P78_FLAG,P78_MENSAGEM,P78_DIAS_ABONO_PEC4,P78_ITEM_VALIDACAO,P78_DIAS_ABONO_PEC1_DSP,,P78_NUM_DIAS_PARC1_DSP,P78_DT_4'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329770997389718538)
,p_name=>'Valida_Num_Dias_Parc1'
,p_event_sequence=>208
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_NUM_DIAS_PARC1'
,p_condition_element=>'P78_NUM_DIAS_PARC1'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return :P78_ROWID is null and :P78_FLAG_CTRL is null;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329771459751718538)
,p_event_id=>wwv_flow_api.id(276329770997389718538)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_cod_empresa      number := :p78_cod_empresa;',
'v_matricula inf_pessoais.matricula%type := :p78_matricula;',
'v_ind_limpa varchar2(200) := ''N'';',
'v_dt_fim_per_ferias ferias.dt_fim_per_ferias%type := :p78_dt_fim_per_ferias;',
'v_saldo     number := :p78_saldo;',
'v_dt_saida_parc1   ferias.dt_saida_parc1%type := :p78_dt_saida_parc1;',
'v_num_dias_parc1   number(15,2) := :p78_num_dias_parc1;',
'v_dt_retorno_parc1 ferias.dt_retorno_parc1%type := :p78_dt_retorno_parc1;',
'v_dt_retorno_parc1_old    ferias.dt_retorno_parc1%type := :p78_dt_retorno_parc1;',
'v_dias_descanso_adicional ferias.dias_descanso_adicional%type := :p78_dias_descanso_adicional;',
'v_desc_adicional1  ferias.desc_adicional1%type := :p78_desc_adicional1;',
'v_tipo_ferias1     ferias.tipo_ferias1%type := :p78_tipo_ferias1;',
'v_dias_abono_pec1  number := :p78_dias_abono_pec1;',
'v_dias_direito     number := :p78_dias_direito;',
'v_ind_situacao_periodo    ferias.ind_situacao_periodo%type := :p78_ind_situacao_periodo;',
'v_jornada_reduzida varchar2(100) := :p78_jornada_reduzida;',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'begin',
'',
'if :p78_dt_saida_parc1 is not null then',
'v_flg_retorno := PKG_FERIAS.VALIDA_DT_SAIDA(:P78_COD_EMPRESA,:P78_MATRICULA,v_dt_saida_parc1,v_msg_retorno);',
'IF v_flg_retorno = ''N'' THEN',
'  :P78_ok := ''N'';',
'  :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_num_dias_parc1''));',
unistr('  :p78_mensagem := ''Sa\00EDda Parcela 1: ''||v_msg_retorno;'),
'  return;',
'END IF;',
'',
':p78_mensagem := null;',
'',
'pkg_ferias.Valida_Num_Dias_Parc1(v_cod_empresa,',
'     v_matricula,',
'     v_ind_limpa,',
'     v_dt_fim_per_ferias,',
'     v_saldo,',
'     v_dt_saida_parc1,',
'     v_num_dias_parc1,',
'     v_dt_retorno_parc1,',
'     v_dias_descanso_adicional,',
'     v_desc_adicional1,',
'     v_tipo_ferias1,',
'     v_dias_abono_pec1,',
'     v_dias_direito,',
'     v_ind_situacao_periodo,',
'     v_jornada_reduzida,',
'     :p78_dias_abono_pec1_dsp,',
'     :p78_num_dias_parc1_dsp,',
'     v_flg_retorno,',
'     v_msg_retorno,',
'     nvl(:p78_opcao_ferias,:P78_OPCAO_FERIAS_A));',
'',
'--:p78_num_dias_parc1   := nvl(v_num_dias_parc1, :p78_num_dias_parc1);',
':P78_TESTE := v_dt_retorno_parc1;',
'if :p78_dt_saida_parc1 <> v_dt_saida_parc1 then',
':p78_dt_saida_parc1   := nvl(v_dt_saida_parc1, :p78_dt_saida_parc1);',
'end if;',
'',
'--if (v_dt_retorno_parc1 <> v_dt_retorno_parc1_old and v_dt_retorno_parc1 is not null) then',
'/*if (v_dt_retorno_parc1 is not null) then',
'   :p78_dt_retorno_parc1 := v_dt_retorno_parc1;',
'else ',
'   :p78_dt_retorno_parc1 := v_dt_retorno_parc1_old;',
'end if;',
'*/',
'if v_dt_retorno_parc1 is not null then',
':p78_dt_retorno_parc1   := v_dt_retorno_parc1;',
'else',
':p78_dt_retorno_parc1   := v_dt_retorno_parc1_old;',
'end if;',
':P78_TESTE := :P78_TESTE||'', v_num_dias_parc1: ''||v_num_dias_parc1||'', p78_dt_retorno_parc1: ''||:p78_dt_retorno_parc1;',
'IF NVL(v_num_dias_parc1,0) = 0 THEN',
':p78_dt_retorno_parc1 := NULL;',
'END IF;',
'',
':p78_dias_descanso_adicional := nvl(v_dias_descanso_adicional, :p78_dias_descanso_adicional);',
':p78_desc_adicional1  := nvl(v_desc_adicional1, :p78_desc_adicional1);',
':p78_tipo_ferias1     := nvl(v_tipo_ferias1, :p78_tipo_ferias1);',
':p78_dias_abono_pec1  := nvl(NVL(v_dias_abono_pec1, nvl(:p78_dias_abono_pec1,0)),0);',
'',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
' :P78_ok:= ''N'';',
' :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_num_dias_parc1''));',
'    else',
' :P78_ok:= ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_num_dias_parc1'')) OR v_item_validacao IS NULL then',
':P78_OK := ''S'';',
':P78_ITEM_VALIDACAO := null;',
'    else',
':P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
'',
'end if;',
' ',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_DT_FIM_PER_FERIAS,P78_SALDO,P78_DT_SAIDA_PARC1,P78_NUM_DIAS_PARC1,P78_DT_RETORNO_PARC1,P78_DIAS_DESCANSO_ADICIONAL,P78_DESC_ADICIONAL1,P78_DIAS_DIREITO,P78_IND_SITUACAO_PERIODO,P78_JORNADA_REDUZIDA,P78_ITEM_VALIDACAO'
||',P78_OPCAO_FERIAS,P78_OPCAO_FERIAS_A,P78_TESTE'
,p_attribute_03=>'P78_DIAS_DESCANSO_ADICIONAL,P78_DESC_ADICIONAL1,P78_TIPO_FERIAS1,P78_DT_RETORNO_PARC1,P78_FLAG,P78_MENSAGEM,P78_OK,P78_ITEM_VALIDACAO,P78_DIAS_ABONO_PEC1_DSP,P78_NUM_DIAS_PARC1_DSP'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329771998134718539)
,p_event_id=>wwv_flow_api.id(276329770997389718538)
,p_event_result=>'TRUE'
,p_action_sequence=>40
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_JAVASCRIPT_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if ($x(''P78_SALDO'').value == $x(''P78_NUM_DIAS_PARC1'').value) {',
'',
'',
'          $x(''P78_DIAS_ABONO_PEC1'').disabled = true;',
'          $x(''P78_DIAS_ABONO_PEC1_1'').disabled = true;    ',
'    ',
'}else{',
'',
'          $x(''P78_DIAS_ABONO_PEC1'').disabled = false;',
'          $x(''P78_DIAS_ABONO_PEC1_1'').disabled = false;    ',
'          ',
'}'))
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(173363199181078845066)
,p_name=>'Valida_Num_Dias_Parc1a'
,p_event_sequence=>218
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_NUM_DIAS_PARC1'
,p_condition_element=>'P78_NUM_DIAS_PARC1'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return nvl(:P78_FLAG_CTRL,0) = 1 and :P78_DT_SAIDA_PARC1 = :P78_DT_1;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(173363199289098845067)
,p_event_id=>wwv_flow_api.id(173363199181078845066)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_cod_empresa      number := :p78_cod_empresa;',
'v_matricula inf_pessoais.matricula%type := :p78_matricula;',
'v_ind_limpa varchar2(200) := ''N'';',
'v_dt_fim_per_ferias ferias.dt_fim_per_ferias%type := :p78_dt_fim_per_ferias_1;',
'v_saldo     number := :p78_saldo_1;',
'v_dt_saida_parc1   ferias.dt_saida_parc1%type := :p78_dt_saida_parc1;',
'v_num_dias_parc1   number(15,2) := :p78_num_dias_parc1;',
'v_dt_retorno_parc1 ferias.dt_retorno_parc1%type := :p78_dt_retorno_parc1;',
'v_dt_retorno_parc1_old    ferias.dt_retorno_parc1%type := :p78_dt_retorno_parc1;',
'v_dias_descanso_adicional ferias.dias_descanso_adicional%type := :p78_dias_descanso_adicional;',
'v_desc_adicional1  ferias.desc_adicional1%type := :p78_desc_adicional1;',
'v_tipo_ferias1     ferias.tipo_ferias1%type := :p78_tipo_ferias1;',
'v_dias_abono_pec1  number := :p78_dias_abono_pec1;',
'v_dias_direito     number := :p78_dias_direito_1;',
'v_ind_situacao_periodo    ferias.ind_situacao_periodo%type := :p78_ind_situacao_periodo_A;',
'v_jornada_reduzida varchar2(100) := :p78_jornada_reduzida;',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'begin',
'',
'if :p78_dt_saida_parc1 is not null then',
'',
':p78_mensagem := null;',
'',
'',
'pkg_ferias.Valida_Num_Dias_Parc1(v_cod_empresa,',
'     v_matricula,',
'     v_ind_limpa,',
'     v_dt_fim_per_ferias,',
'     v_saldo,',
'     v_dt_saida_parc1,',
'     v_num_dias_parc1,',
'     v_dt_retorno_parc1,',
'     v_dias_descanso_adicional,',
'     v_desc_adicional1,',
'     v_tipo_ferias1,',
'     v_dias_abono_pec1,',
'     v_dias_direito,',
'     v_ind_situacao_periodo,',
'     v_jornada_reduzida,',
'     :p78_dias_abono_pec1_dsp,',
'     :p78_num_dias_parc1_dsp,',
'     v_flg_retorno,',
'     v_msg_retorno,',
'     nvl(:p78_opcao_ferias,:P78_OPCAO_FERIAS_A));',
'',
':P78_TESTE := v_dt_retorno_parc1;',
'if :p78_dt_saida_parc1 <> v_dt_saida_parc1 then',
':p78_dt_saida_parc1   := nvl(v_dt_saida_parc1, :p78_dt_saida_parc1);',
'end if;',
'',
'',
'if v_dt_retorno_parc1 is not null then',
':p78_dt_retorno_parc1   := v_dt_retorno_parc1;',
'else',
':p78_dt_retorno_parc1   := v_dt_retorno_parc1_old;',
'end if;',
':P78_TESTE := :P78_TESTE||'', v_num_dias_parc1: ''||v_num_dias_parc1||'', p78_dt_retorno_parc1: ''||:p78_dt_retorno_parc1;',
'IF NVL(v_num_dias_parc1,0) = 0 THEN',
':p78_dt_retorno_parc1 := NULL;',
'END IF;',
'',
':p78_dias_descanso_adicional := nvl(v_dias_descanso_adicional, :p78_dias_descanso_adicional);',
':p78_desc_adicional1  := nvl(v_desc_adicional1, :p78_desc_adicional1);',
':p78_tipo_ferias1     := nvl(v_tipo_ferias1, :p78_tipo_ferias1);',
':p78_dias_abono_pec1  := nvl(NVL(v_dias_abono_pec1, nvl(:p78_dias_abono_pec1,0)),0);',
'',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
' :P78_ok:= ''N'';',
' :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_num_dias_parc1''));',
'    else',
' :P78_ok:= ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_num_dias_parc1'')) OR v_item_validacao IS NULL then',
':P78_OK := ''S'';',
':P78_ITEM_VALIDACAO := null;',
'    else',
':P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
'',
'end if;',
' ',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_DT_FIM_PER_FERIAS_1,P78_SALDO_1,P78_DT_SAIDA_PARC1,P78_NUM_DIAS_PARC1,P78_DT_RETORNO_PARC1,P78_DIAS_DESCANSO_ADICIONAL,P78_DESC_ADICIONAL1,P78_DIAS_DIREITO_1,P78_IND_SITUACAO_PERIODO_1,P78_JORNADA_REDUZIDA,P78_ITEM_V'
||'ALIDACAO,P78_OPCAO_FERIAS,P78_OPCAO_FERIAS_A,P78_TESTE'
,p_attribute_03=>'P78_DIAS_DESCANSO_ADICIONAL,P78_DESC_ADICIONAL1,P78_TIPO_FERIAS1,P78_DT_RETORNO_PARC1,P78_FLAG,P78_MENSAGEM,P78_OK,P78_ITEM_VALIDACAO,P78_DIAS_ABONO_PEC1_DSP,P78_NUM_DIAS_PARC1_DSP'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(173363199345515845068)
,p_event_id=>wwv_flow_api.id(173363199181078845066)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_JAVASCRIPT_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if ($x(''P78_SALDO'').value == $x(''P78_NUM_DIAS_PARC1'').value) {',
'',
'',
'          $x(''P78_DIAS_ABONO_PEC1'').disabled = true;',
'          $x(''P78_DIAS_ABONO_PEC1_1'').disabled = true;    ',
'    ',
'}else{',
'',
'          $x(''P78_DIAS_ABONO_PEC1'').disabled = false;',
'          $x(''P78_DIAS_ABONO_PEC1_1'').disabled = false;    ',
'          ',
'}'))
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(236633343853160609287)
,p_name=>'Limpa Data de Retorno'
,p_event_sequence=>228
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_NUM_DIAS_PARC1_LST'
,p_condition_element=>'P78_NUM_DIAS_PARC1_LST'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(236633343919434609288)
,p_event_id=>wwv_flow_api.id(236633343853160609287)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_CLEAR'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_DT_RETORNO_PARC1_1,P78_DT_RETORNO_PARC1_X'
);
end;
/
begin
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329849475499718590)
,p_name=>'Seta num_dias_parc1'
,p_event_sequence=>238
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_NUM_DIAS_PARC1_LST'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329849975837718590)
,p_event_id=>wwv_flow_api.id(276329849475499718590)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>':P78_NUM_DIAS_PARC1 := :P78_NUM_DIAS_PARC1_LST;'
,p_attribute_02=>'P78_NUM_DIAS_PARC1_LST'
,p_attribute_03=>'P78_NUM_DIAS_PARC1'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(239790692733826698896)
,p_name=>'Valida_Num_Dias_Parc1_LST'
,p_event_sequence=>248
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_NUM_DIAS_PARC1_LST'
,p_condition_element=>'P78_NUM_DIAS_PARC1_LST'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return :P78_ROWID is null and :P78_FLAG_CTRL is null and :P78_DT_SAIDA_PARC1 = :P78_DT_1;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(239790692791523698897)
,p_event_id=>wwv_flow_api.id(239790692733826698896)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_cod_empresa      number := :p78_cod_empresa;',
'v_matricula inf_pessoais.matricula%type := :p78_matricula;',
'v_ind_limpa varchar2(200) := ''N'';',
'v_dt_fim_per_ferias ferias.dt_fim_per_ferias%type := :p78_dt_fim_per_ferias;',
'v_saldo     number := :p78_saldo;',
'v_dt_saida_parc1   ferias.dt_saida_parc1%type := :p78_dt_saida_parc1;',
'v_num_dias_parc1   number(15,2) := :p78_num_dias_parc1;',
'v_dt_retorno_parc1 ferias.dt_retorno_parc1%type := :p78_dt_retorno_parc1;',
'v_dt_retorno_parc1_old    ferias.dt_retorno_parc1%type := :p78_dt_retorno_parc1;',
'v_dias_descanso_adicional ferias.dias_descanso_adicional%type := :p78_dias_descanso_adicional;',
'v_desc_adicional1  ferias.desc_adicional1%type := :p78_desc_adicional1;',
'v_tipo_ferias1     ferias.tipo_ferias1%type := :p78_tipo_ferias1;',
'v_dias_abono_pec1  number := :p78_dias_abono_pec1;',
'v_dias_direito     number := :p78_dias_direito;',
'v_ind_situacao_periodo    ferias.ind_situacao_periodo%type := :p78_ind_situacao_periodo;',
'v_jornada_reduzida varchar2(100) := :p78_jornada_reduzida;',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'begin',
'',
'if :p78_dt_saida_parc1 is not null then',
'',
':p78_mensagem := null;',
'',
'pkg_ferias.Valida_Num_Dias_Parc1(v_cod_empresa,',
'     v_matricula,',
'     v_ind_limpa,',
'     v_dt_fim_per_ferias,',
'     v_saldo,',
'     v_dt_saida_parc1,',
'     v_num_dias_parc1,',
'     v_dt_retorno_parc1,',
'     v_dias_descanso_adicional,',
'     v_desc_adicional1,',
'     v_tipo_ferias1,',
'     v_dias_abono_pec1,',
'     v_dias_direito,',
'     v_ind_situacao_periodo,',
'     v_jornada_reduzida,',
'     :p78_dias_abono_pec1_dsp,',
'     :p78_num_dias_parc1_dsp,',
'     v_flg_retorno,',
'     v_msg_retorno,',
'     nvl(:p78_opcao_ferias,:P78_OPCAO_FERIAS_A));',
'',
'--:p78_num_dias_parc1   := nvl(v_num_dias_parc1, :p78_num_dias_parc1);',
'if :p78_dt_saida_parc1 <> v_dt_saida_parc1 then',
':p78_dt_saida_parc1   := nvl(v_dt_saida_parc1, :p78_dt_saida_parc1);',
'end if;',
'',
'--if (v_dt_retorno_parc1 <> v_dt_retorno_parc1_old and v_dt_retorno_parc1 is not null) then',
'/*if (v_dt_retorno_parc1 is not null) then',
'   :p78_dt_retorno_parc1 := v_dt_retorno_parc1;',
'else ',
'   :p78_dt_retorno_parc1 := v_dt_retorno_parc1_old;',
'end if;',
'*/',
'if v_dt_retorno_parc1 is not null then',
':p78_dt_retorno_parc1   := v_dt_retorno_parc1;',
'else',
':p78_dt_retorno_parc1   := v_dt_retorno_parc1_old;',
'end if;',
'',
'IF NVL(v_num_dias_parc1,0) = 0 THEN',
':p78_dt_retorno_parc1 := NULL;',
'END IF;',
'',
':p78_dias_descanso_adicional := nvl(v_dias_descanso_adicional, :p78_dias_descanso_adicional);',
':p78_desc_adicional1  := nvl(v_desc_adicional1, :p78_desc_adicional1);',
':p78_tipo_ferias1     := nvl(v_tipo_ferias1, :p78_tipo_ferias1);',
':p78_dias_abono_pec1  := nvl(NVL(v_dias_abono_pec1, nvl(:p78_dias_abono_pec1,0)),0);',
'',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
' :P78_ok:= ''N'';',
' :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_num_dias_parc1''));',
'    else',
' :P78_ok:= ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_num_dias_parc1'')) OR v_item_validacao IS NULL then',
':P78_OK := ''S'';',
':P78_ITEM_VALIDACAO := null;',
'    else',
':P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
'',
'end if;',
' ',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_DT_FIM_PER_FERIAS,P78_SALDO,P78_DT_SAIDA_PARC1,P78_NUM_DIAS_PARC1,P78_DT_RETORNO_PARC1,P78_DIAS_DESCANSO_ADICIONAL,P78_DESC_ADICIONAL1,P78_DIAS_DIREITO,P78_IND_SITUACAO_PERIODO,P78_JORNADA_REDUZIDA,P78_ITEM_VALIDACAO'
||',P78_OPCAO_FERIAS,P78_OPCAO_FERIAS_A'
,p_attribute_03=>'P78_DIAS_DESCANSO_ADICIONAL,P78_DESC_ADICIONAL1,P78_TIPO_FERIAS1,P78_DT_RETORNO_PARC1,P78_FLAG,P78_MENSAGEM,P78_OK,P78_ITEM_VALIDACAO,P78_DIAS_ABONO_PEC1_DSP,P78_NUM_DIAS_PARC1_DSP'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(239790692889782698898)
,p_event_id=>wwv_flow_api.id(239790692733826698896)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_JAVASCRIPT_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if ($x(''P78_SALDO'').value == $x(''P78_NUM_DIAS_PARC1'').value) {',
'',
'',
'          $x(''P78_DIAS_ABONO_PEC1'').disabled = true;',
'          $x(''P78_DIAS_ABONO_PEC1_1'').disabled = true;    ',
'    ',
'}else{',
'',
'          $x(''P78_DIAS_ABONO_PEC1'').disabled = false;',
'          $x(''P78_DIAS_ABONO_PEC1_1'').disabled = false;    ',
'          ',
'}'))
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(173363198224713845057)
,p_name=>'Valida_Num_Dias_Parc1_LST_1'
,p_event_sequence=>258
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_NUM_DIAS_PARC1_LST'
,p_condition_element=>'P78_NUM_DIAS_PARC1_LST'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return nvl(:P78_FLAG_CTRL,0) = 1;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(173363198415557845058)
,p_event_id=>wwv_flow_api.id(173363198224713845057)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_cod_empresa      number := :p78_cod_empresa;',
'v_matricula inf_pessoais.matricula%type := :p78_matricula;',
'v_ind_limpa varchar2(200) := ''N'';',
'v_dt_fim_per_ferias ferias.dt_fim_per_ferias%type := :p78_dt_fim_per_ferias_1;',
'v_saldo     number := :p78_saldo_1;',
'v_dt_saida_parc1   ferias.dt_saida_parc1%type := :p78_dt_saida_parc1;',
'v_num_dias_parc1   number(15,2) := :p78_num_dias_parc1;',
'v_dt_retorno_parc1 ferias.dt_retorno_parc1%type := :p78_dt_retorno_parc1;',
'v_dt_retorno_parc1_old    ferias.dt_retorno_parc1%type := :p78_dt_retorno_parc1;',
'v_dias_descanso_adicional ferias.dias_descanso_adicional%type := :p78_dias_descanso_adicional;',
'v_desc_adicional1  ferias.desc_adicional1%type := :p78_desc_adicional1;',
'v_tipo_ferias1     ferias.tipo_ferias1%type := :p78_tipo_ferias1;',
'v_dias_abono_pec1  number := :p78_dias_abono_pec1;',
'v_dias_direito     number := :p78_dias_direito_1;',
'v_ind_situacao_periodo    ferias.ind_situacao_periodo%type := :p78_ind_situacao_periodo_a;',
'v_jornada_reduzida varchar2(100) := :p78_jornada_reduzida;',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'begin',
'',
'if :p78_dt_saida_parc1 is not null then',
'',
':p78_mensagem := null;',
'',
'pkg_ferias.Valida_Num_Dias_Parc1(v_cod_empresa,',
'     v_matricula,',
'     v_ind_limpa,',
'     v_dt_fim_per_ferias,',
'     v_saldo,',
'     v_dt_saida_parc1,',
'     v_num_dias_parc1,',
'     v_dt_retorno_parc1,',
'     v_dias_descanso_adicional,',
'     v_desc_adicional1,',
'     v_tipo_ferias1,',
'     v_dias_abono_pec1,',
'     v_dias_direito,',
'     v_ind_situacao_periodo,',
'     v_jornada_reduzida,',
'     :p78_dias_abono_pec1_dsp,',
'     :p78_num_dias_parc1_dsp,',
'     v_flg_retorno,',
'     v_msg_retorno,',
'     nvl(:p78_opcao_ferias,:P78_OPCAO_FERIAS_A));',
'',
'if :p78_dt_saida_parc1 <> v_dt_saida_parc1 then',
':p78_dt_saida_parc1   := nvl(v_dt_saida_parc1, :p78_dt_saida_parc1);',
'end if;',
'',
'',
'if v_dt_retorno_parc1 is not null then',
':p78_dt_retorno_parc1   := v_dt_retorno_parc1;',
'else',
':p78_dt_retorno_parc1   := v_dt_retorno_parc1_old;',
'end if;',
'',
'IF NVL(v_num_dias_parc1,0) = 0 THEN',
':p78_dt_retorno_parc1 := NULL;',
'END IF;',
'',
':p78_dias_descanso_adicional := nvl(v_dias_descanso_adicional, :p78_dias_descanso_adicional);',
':p78_desc_adicional1  := nvl(v_desc_adicional1, :p78_desc_adicional1);',
':p78_tipo_ferias1     := nvl(v_tipo_ferias1, :p78_tipo_ferias1);',
':p78_dias_abono_pec1  := nvl(NVL(v_dias_abono_pec1, nvl(:p78_dias_abono_pec1,0)),0);',
'',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
' :P78_ok:= ''N'';',
' :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_num_dias_parc1''));',
'    else',
' :P78_ok:= ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_num_dias_parc1'')) OR v_item_validacao IS NULL then',
':P78_OK := ''S'';',
':P78_ITEM_VALIDACAO := null;',
'    else',
':P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
'',
'end if;',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_DT_FIM_PER_FERIAS_1,P78_SALDO_1,P78_DT_SAIDA_PARC1,P78_NUM_DIAS_PARC1,P78_DT_RETORNO_PARC1,P78_DIAS_DESCANSO_ADICIONAL,P78_DESC_ADICIONAL1,P78_DIAS_DIREITO_1,P78_IND_SITUACAO_PERIODO_A,P78_JORNADA_REDUZIDA,P78_ITEM_V'
||'ALIDACAO,P78_OPCAO_FERIAS,P78_OPCAO_FERIAS_A'
,p_attribute_03=>'P78_DIAS_DESCANSO_ADICIONAL,P78_DESC_ADICIONAL1,P78_TIPO_FERIAS1,P78_DT_RETORNO_PARC1,P78_FLAG,P78_MENSAGEM,P78_OK,P78_ITEM_VALIDACAO,P78_DIAS_ABONO_PEC1_DSP,P78_NUM_DIAS_PARC1_DSP'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(173363198419941845059)
,p_event_id=>wwv_flow_api.id(173363198224713845057)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_JAVASCRIPT_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if ($x(''P78_SALDO'').value == $x(''P78_NUM_DIAS_PARC1'').value) {',
'',
'',
'          $x(''P78_DIAS_ABONO_PEC1'').disabled = true;',
'          $x(''P78_DIAS_ABONO_PEC1_1'').disabled = true;    ',
'    ',
'}else{',
'',
'          $x(''P78_DIAS_ABONO_PEC1'').disabled = false;',
'          $x(''P78_DIAS_ABONO_PEC1_1'').disabled = false;    ',
'          ',
'}'))
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329772391694718539)
,p_name=>'Valida_Num_Dias_Parc3'
,p_event_sequence=>268
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_NUM_DIAS_PARC3'
,p_condition_element=>'P78_NUM_DIAS_PARC3'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329772887972718539)
,p_event_id=>wwv_flow_api.id(276329772391694718539)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'begin',
'',
'pkg_ferias.Valida_Num_Dias_Parc3(:p78_num_dias_parc3,',
'                                  v_flg_retorno,',
'                                  v_msg_retorno);',
' ',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_num_dias_parc3''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_num_dias_parc3'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
' ',
'end;'))
,p_attribute_02=>'P78_NUM_DIAS_PARC3,P78_ITEM_VALIDACAO'
,p_attribute_03=>'P78_OK,P78_FLAG,P78_MENSAGEM,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329773256047718539)
,p_name=>'Valida_Num_Dias_Parc2'
,p_event_sequence=>278
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_NUM_DIAS_PARC2'
,p_condition_element=>'P78_NUM_DIAS_PARC2'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329773797393718540)
,p_event_id=>wwv_flow_api.id(276329773256047718539)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'begin',
'',
'pkg_ferias.Valida_Num_Dias_Parc2(:P78_cod_empresa,',
'                                 :P78_matricula,',
'                                 nvl(:P78_num_dias_parc1,:P78_num_dias_parc1_1),',
'                                 nvl(:P78_dias_abono_pec1,:P78_dias_abono_pec1_1),',
'                                 :P78_dt_saida_parc2,',
'                                 :P78_dt_inic_per_ferias,',
'                                 :P78_dt_fim_per_ferias,',
'                                 :P78_dias_descanso_adicional,',
'                                 :P78_dias_abono_pec2,',
'                                 :P78_tipo_ferias2,',
'                                 :P78_desc_adicional1,',
'                                 :P78_desc_adicional2,',
'                                 :P78_num_dias_parc2,',
'                                 :P78_dt_retorno_parc2,',
'                                 :P78_dias_direito,',
'                                 :p_usuario,',
'                                 v_flg_retorno,',
'                                 v_msg_retorno);',
' ',
'IF NVL(:P78_num_dias_parc2,0) = 0 THEN',
':p78_dt_retorno_parc2 := NULL;',
'END IF;',
' ',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''P78_num_dias_parc2''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    ',
'    if v_item_validacao = TRIM(UPPER(''P78_num_dias_parc2'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
' ',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_NUM_DIAS_PARC1,P78_DIAS_ABONO_PEC1,P78_DT_SAIDA_PARC2,P78_DT_INIC_PER_FERIAS,P78_DT_FIM_PER_FERIAS,P78_DIAS_DESCANSO_ADICIONAL,P78_NUM_DIAS_PARC2,P78_ITEM_VALIDACAO,P78_DIAS_DIREITO,P78_DT_RETORNO_PARC4,P78_NUM_DIAS_'
||'PARC1_1,P78_DIAS_ABONO_PEC1_1,P_USUARIO'
,p_attribute_03=>'P78_TIPO_FERIAS2,P78_DESC_ADICIONAL1,P78_DESC_ADICIONAL2,P78_DT_RETORNO_PARC2,P78_OK,P78_FLAG,P78_MENSAGEM,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329774211902718540)
,p_name=>'Valida_Num_Dias_Parc4'
,p_event_sequence=>288
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_NUM_DIAS_PARC4'
,p_condition_element=>'P78_NUM_DIAS_PARC4'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329774634352718541)
,p_event_id=>wwv_flow_api.id(276329774211902718540)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3); ',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'begin',
'',
'pkg_ferias.Valida_Num_Dias_Parc4(:P78_cod_empresa,',
':P78_matricula,',
'nvl(:P78_num_dias_parc1,:P78_num_dias_parc1_1),',
'nvl(:P78_num_dias_parc2,:P78_num_dias_parc2_1),',
':P78_num_dias_parc4,',
'nvl(:P78_dias_abono_pec1,:P78_dias_abono_pec1_1),',
'nvl(:P78_dias_abono_pec2,:P78_dias_abono_pec2_1),',
'nvl(:P78_dt_saida_parc2,:P78_dt_saida_parc2_1),',
':P78_dt_saida_parc4,',
':P78_dt_inic_per_ferias,',
':P78_dt_fim_per_ferias,                            ',
':p78_saldo,',
':p78_ind_situacao_parc_2,',
':p78_dias_abono_pec4,                                    ',
':P78_dias_descanso_adicional,',
':P78_dias_abono_pec4,',
':P78_tipo_ferias4,',
':P78_desc_adicional1,',
':P78_desc_adicional2,',
':P78_desc_adicional4,',
':P78_dt_retorno_parc4,',
':P78_dias_direito,',
'v_flg_retorno,',
'v_msg_retorno,                    ',
':p_usuario);',
'',
'IF NVL(:P78_num_dias_parc4,0) = 0 THEN',
':p78_dt_retorno_parc4 := NULL;',
'END IF;',
'',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''P78_num_dias_parc4''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    ',
'    if v_item_validacao = TRIM(UPPER(''P78_num_dias_parc4'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
' ',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_NUM_DIAS_PARC1,P78_NUM_DIAS_PARC2,P78_NUM_DIAS_PARC4,P78_DIAS_ABONO_PEC1,P78_DIAS_ABONO_PEC2,P78_DT_SAIDA_PARC2,P78_DT_SAIDA_PARC4,P78_DT_INIC_PER_FERIAS,P78_DT_FIM_PER_FERIAS,P78_DIAS_DESCANSO_ADICIONAL,P78_DIAS_ABO'
||'NO_PEC4,P78_TIPO_FERIAS4,P78_DESC_ADICIONAL1,P78_DESC_ADICIONAL2,P78_DESC_ADICIONAL4,P78_DT_RETORNO_PARC4,P78_DIAS_DIREITO,P78_ITEM_VALIDACAO,P78_NUM_DIAS_PARC1_1,P78_NUM_DIAS_PARC2_1,P78_DIAS_ABONO_PEC1_1,P78_DIAS_ABONO_PEC2_1,P78_DT_SAIDA_PARC2_1,P'
||'78_SALDO,P_USUARIO,P78_IND_SITUACAO_PARC_2'
,p_attribute_03=>'P78_DIAS_ABONO_PEC4,P78_TIPO_FERIAS4,P78_DESC_ADICIONAL2,P78_DESC_ADICIONAL4,P78_DT_RETORNO_PARC4,P78_OK,P78_FLAG,P78_MENSAGEM,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329775046381718541)
,p_name=>'Valida_Dias_Abono_Pec1'
,p_event_sequence=>298
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DIAS_ABONO_PEC1'
,p_triggering_condition_type=>'JAVASCRIPT_EXPRESSION'
,p_triggering_expression=>wwv_flow_string.join(wwv_flow_t_varchar2(
'apex.item(''P78_DIAS_ABONO_PEC1'').getValue() != '''' &&',
'apex.item(''P78_DT_SAIDA_PARC1'').getValue() != '''''))
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return :P78_ROWID is null and :P78_FLAG_CTRL is null;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329775553035718541)
,p_event_id=>wwv_flow_api.id(276329775046381718541)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_cod_empresa number;',
'v_cod_solicitacao number;',
'v_matricula number;',
'v_dt_inic_per_ferias date;',
'v_dt_fim_per_ferias date;',
'v_dt_saida_parc2 date :=null;',
'v_saldo_bruto number;',
'v_falta_hora number;',
'v_dias_direito number;',
'v_dt_saida_parc1 date;',
'v_saldo number;',
'v_dias_abono_pec1 number;',
'v_num_dias_parc1 number;',
'v_opcao_13sal1 varchar2(1);',
'v_opcao_13sal2 varchar2(1);',
'v_tipo_ferias1 varchar2(1);',
'v_dt_retorno_parc1 date;',
'v_dt_retorno_parc1_old date;',
'v_dt_pagto_parc1 date;',
'v_jornada_reduzida varchar2(10);',
'v_ind_situacao_periodo varchar2(3);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'begin',
'',
':p78_mensagem := null;',
'',
'v_cod_empresa:= :p78_cod_empresa;',
'v_cod_solicitacao := :p78_cod_solicitacao;',
'v_matricula := :p78_matricula;',
'v_dt_inic_per_ferias := :p78_dt_inic_per_ferias;',
'v_dt_fim_per_ferias := :p78_dt_fim_per_ferias;',
'v_dt_saida_parc2 := :p78_dt_saida_parc2;',
'v_saldo_bruto := :p78_saldo_bruto;',
'v_falta_hora := :p78_falta_hora;',
'v_dias_direito := :p78_dias_direito;',
'v_dt_saida_parc1 := :p78_dt_saida_parc1;',
'v_saldo := :p78_saldo;',
'v_dias_abono_pec1 := :p78_dias_abono_pec1;',
'v_num_dias_parc1 := :p78_num_dias_parc1;',
'v_opcao_13sal1 := :p78_opcao_13sal1;',
'v_opcao_13sal2 := :p78_opcao_13sal2;',
'v_tipo_ferias1 := :p78_tipo_ferias1;',
'v_dt_retorno_parc1 := :p78_dt_retorno_parc1;',
'v_dt_retorno_parc1_old := :p78_dt_retorno_parc1;',
'v_dt_pagto_parc1 := :p78_dt_pagto_parc1;',
'v_jornada_reduzida := :p78_jornada_reduzida;',
'v_ind_situacao_periodo := :p78_ind_situacao_periodo;',
'',
'pkg_ferias.Valida_Dt_Saida_Parc1(v_cod_empresa,',
'v_cod_solicitacao,',
'v_matricula,',
'v_dt_inic_per_ferias,',
'v_dt_fim_per_ferias,',
'v_dt_saida_parc2,',
'v_saldo_bruto,',
'v_falta_hora,',
'v_dias_direito,',
'v_dt_saida_parc1,',
'v_saldo,',
'v_dias_abono_pec1,',
'v_num_dias_parc1,',
'v_opcao_13sal1,',
'v_opcao_13sal2,',
'v_tipo_ferias1,',
'v_dt_retorno_parc1,',
'v_dt_pagto_parc1,',
'v_jornada_reduzida,',
'v_ind_situacao_periodo,',
':p78_dias_abono_pec1_dsp,',
':p78_num_dias_parc1_dsp,',
'v_flg_retorno,',
'v_msg_retorno);',
'',
'IF V_DT_RETORNO_PARC1 IS NOT NULL THEN',
':p78_dt_retorno_parc1_X := v_dt_retorno_parc1;',
'ELSE',
':p78_dt_retorno_parc1_X := v_dt_retorno_parc1_old;',
'END IF;',
'',
'if v_dt_pagto_parc1 is not null then',
'  :p78_dt_pagto_parc1 := v_dt_pagto_parc1;',
'end if;',
'if trim(v_msg_retorno) is not null then',
'',
'if v_flg_retorno in (''N'',''Q'') then',
'    :P78_ok := ''N'';',
'    :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_dt_saida_parc1''));',
'else',
'    :P78_ok := ''S'';',
'end if;',
'',
':P78_flag := v_flg_retorno;',
':P78_mensagem := v_msg_retorno;',
'else',
':P78_flag := null;',
':P78_mensagem := null;',
'if v_item_validacao = TRIM(UPPER(''p78_dt_saida_parc1'')) OR v_item_validacao IS NULL then',
'   :P78_OK := ''S'';',
'   :P78_ITEM_VALIDACAO := null;',
'else',
'   :P78_ITEM_VALIDACAO := v_item_validacao;',
'end if;',
'end if;',
'',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_FILIAL,P78_DT_INIC_PER_FERIAS,P78_DT_FIM_PER_FERIAS,P78_NUM_DIAS_PARC1,P78_DT_SAIDA_PARC1,P78_SALDO,P78_IND_SITUACAO_PERIODO,P78_DIAS_DIREITO,P78_ITEM_VALIDACAO,P_USUARIO'
,p_attribute_03=>'P78_OPCAO_ABONO_PEC1,P78_OK,P78_FLAG,P78_MENSAGEM,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329776116728718542)
,p_event_id=>wwv_flow_api.id(276329775046381718541)
,p_event_result=>'TRUE'
,p_action_sequence=>50
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_cod_empresa number;',
'v_cod_solicitacao number;',
'v_matricula number;',
'v_dt_inic_per_ferias date;',
'v_dt_fim_per_ferias date;',
'v_dt_saida_parc2 date :=null;',
'v_saldo_bruto number;',
'v_falta_hora number;',
'v_dias_direito number;',
'v_dt_saida_parc1 date;',
'v_saldo number;',
'v_dias_abono_pec1 number;',
'v_num_dias_parc1 number;',
'v_opcao_13sal1 varchar2(1);',
'v_opcao_13sal2 varchar2(1);',
'v_tipo_ferias1 varchar2(1);',
'v_dt_retorno_parc1 date;',
'v_dt_retorno_parc1_old date;',
'v_dt_pagto_parc1 date;',
'v_jornada_reduzida varchar2(10);',
'v_ind_situacao_periodo varchar2(3);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'begin',
'',
':p78_mensagem := null;',
'',
'v_cod_empresa:= :p78_cod_empresa;',
'v_cod_solicitacao := :p78_cod_solicitacao;',
'v_matricula := :p78_matricula;',
'v_dt_inic_per_ferias := :p78_dt_inic_per_ferias;',
'v_dt_fim_per_ferias := :p78_dt_fim_per_ferias;',
'v_dt_saida_parc2 := :p78_dt_saida_parc2;',
'v_saldo_bruto := :p78_saldo_bruto;',
'v_falta_hora := :p78_falta_hora;',
'v_dias_direito := :p78_dias_direito;',
'v_dt_saida_parc1 := :p78_dt_saida_parc1;',
'v_saldo := :p78_saldo;',
'v_dias_abono_pec1 := :p78_dias_abono_pec1;',
'v_num_dias_parc1 := :p78_num_dias_parc1;',
'v_opcao_13sal1 := :p78_opcao_13sal1;',
'v_opcao_13sal2 := :p78_opcao_13sal2;',
'v_tipo_ferias1 := :p78_tipo_ferias1;',
'v_dt_retorno_parc1 := :p78_dt_retorno_parc1;',
'v_dt_retorno_parc1_old := :p78_dt_retorno_parc1;',
'v_dt_pagto_parc1 := :p78_dt_pagto_parc1;',
'v_jornada_reduzida := :p78_jornada_reduzida;',
'v_ind_situacao_periodo := :p78_ind_situacao_periodo;',
'',
'pkg_ferias.Valida_Dt_Saida_Parc1(v_cod_empresa,',
'v_cod_solicitacao,',
'v_matricula,',
'v_dt_inic_per_ferias,',
'v_dt_fim_per_ferias,',
'v_dt_saida_parc2,',
'v_saldo_bruto,',
'v_falta_hora,',
'v_dias_direito,',
'v_dt_saida_parc1,',
'v_saldo,',
'v_dias_abono_pec1,',
'v_num_dias_parc1,',
'v_opcao_13sal1,',
'v_opcao_13sal2,',
'v_tipo_ferias1,',
'v_dt_retorno_parc1,',
'v_dt_pagto_parc1,',
'v_jornada_reduzida,',
'v_ind_situacao_periodo,',
':p78_dias_abono_pec1_dsp,',
':p78_num_dias_parc1_dsp,',
'v_flg_retorno,',
'v_msg_retorno);',
'',
'IF V_DT_RETORNO_PARC1 IS NOT NULL THEN',
':p78_dt_retorno_parc1_X := v_dt_retorno_parc1;',
'ELSE',
':p78_dt_retorno_parc1_X := v_dt_retorno_parc1_old;',
'END IF;',
'',
'if v_dt_pagto_parc1 is not null then',
'  :p78_dt_pagto_parc1 := v_dt_pagto_parc1;',
'end if;',
'',
'if trim(v_msg_retorno) is not null then',
'',
'if v_flg_retorno in (''N'',''Q'') then',
'    :P78_ok := ''N'';',
'    :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_dt_saida_parc1''));',
'else',
'    :P78_ok := ''S'';',
'end if;',
'',
':P78_flag := v_flg_retorno;',
':P78_mensagem := v_msg_retorno;',
'else',
':P78_flag := null;',
':P78_mensagem := null;',
'if v_item_validacao = TRIM(UPPER(''p78_dt_saida_parc1'')) OR v_item_validacao IS NULL then',
'   :P78_OK := ''S'';',
'   :P78_ITEM_VALIDACAO := null;',
'else',
'   :P78_ITEM_VALIDACAO := v_item_validacao;',
'end if;',
'end if;',
'',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_COD_SOLICITACAO,P78_MATRICULA,P78_DT_INIC_PER_FERIAS,P78_DT_FIM_PER_FERIAS,P78_DT_SAIDA_PARC2,P78_SALDO_BRUTO,P78_FALTA_HORA,P78_DIAS_DIREITO,P78_DT_SAIDA_PARC1,P78_SALDO,P78_DIAS_ABONO_PEC1,P78_NUM_DIAS_PARC1,P78_OPCAO_13SAL1,P78'
||'_OPCAO_13SAL2,P78_TIPO_FERIAS1,P78_DT_RETORNO_PARC1,P78_DT_PAGTO_PARC1,P78_JORNADA_REDUZIDA,P78_IND_SITUACAO_PERIODO,P78_ITEM_VALIDACAO,P78_DT_RETORNO_PARC1'
,p_attribute_03=>'P78_DT_RETORNO_PARC1_X,P78_FLAG,P78_MENSAGEM,P78_OK,P78_ITEM_VALIDACAO,P78_DIAS_ABONO_PEC1_DSP,P78_NUM_DIAS_PARC1_DSP,P78_DT_PAGTO_PARC1'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(173363198705834845061)
,p_name=>'Valida_Dias_Abono_Pec1a'
,p_event_sequence=>308
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DIAS_ABONO_PEC1'
,p_condition_element=>'P78_DIAS_ABONO_PEC1'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return nvl(:P78_FLAG_CTRL,0) = 1;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(173363198734009845062)
,p_event_id=>wwv_flow_api.id(173363198705834845061)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'begin',
'',
':p78_mensagem := null;',
'',
'',
'if :p78_dt_1 is null then',
':P78_ok       := ''N'';',
':P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_dias_abono_pec1''));',
'--:p78_mensagem := ''TESTE10 P78_DT_1 IS NULL'';',
'return;',
'END IF;',
'',
'if :p78_dt_saida_parc1 is not null then',
'',
'pkg_ferias.Valida_Dias_Abono_Pec1(:p78_cod_empresa        ,',
'                                  :p78_matricula          ,',
'                                  :p78_filial             ,',
'                                  :p78_dt_inic_per_ferias_1 ,',
'                                  :p78_dt_fim_per_ferias_1  ,',
'                                  :p78_num_dias_parc1     ,',
'                                  :p78_dt_saida_parc1     ,',
'                                  :p78_saldo_1              ,',
'                                  :p78_dias_abono_pec1    ,',
'                                  :p78_opcao_abono_pec1   ,',
'                                  :p78_ind_situacao_periodo_a,',
'                                  :p78_dias_direito_1       ,',
'                                  :p_usuario,',
'                                  v_flg_retorno        ,',
'                                  v_msg_retorno        );',
' ',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_dias_abono_pec1''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_dias_abono_pec1'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
'',
'end if;',
'',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_FILIAL,P78_DT_INIC_PER_FERIAS_1,P78_DT_FIM_PER_FERIAS_1,P78_NUM_DIAS_PARC1,P78_DT_SAIDA_PARC1,P78_SALDO_1,P78_IND_SITUACAO_PERIODO_A,P78_DIAS_DIREITO_1,P78_ITEM_VALIDACAO,P_USUARIO'
,p_attribute_03=>'P78_OPCAO_ABONO_PEC1,P78_OK,P78_FLAG,P78_MENSAGEM,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(173363198871362845063)
,p_event_id=>wwv_flow_api.id(173363198705834845061)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_cod_empresa number;',
'v_cod_solicitacao number;',
'v_matricula number;',
'v_dt_inic_per_ferias date;',
'v_dt_fim_per_ferias date;',
'v_dt_saida_parc2 date :=null;',
'v_saldo_bruto number;',
'v_falta_hora number;',
'v_dias_direito number;',
'v_dt_saida_parc1 date;',
'v_saldo number;',
'v_dias_abono_pec1 number;',
'v_num_dias_parc1 number;',
'v_opcao_13sal1 varchar2(1);',
'v_opcao_13sal2 varchar2(1);',
'v_tipo_ferias1 varchar2(1);',
'v_dt_retorno_parc1 date;',
'v_dt_retorno_parc1_old date;',
'v_dt_pagto_parc1 date;',
'v_jornada_reduzida varchar2(10);',
'v_ind_situacao_periodo varchar2(3);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'begin',
'',
'if :p78_dt_1 is null then',
':P78_ok       := ''N'';',
':P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_dias_abono_pec1''));',
'--:p78_mensagem := ''TESTE11 ABC P78_DT_1 IS NULL'';',
'return;',
'END IF;',
'',
'v_cod_empresa:= :p78_cod_empresa;',
'v_cod_solicitacao := :p78_cod_solicitacao;',
'v_matricula := :p78_matricula;',
'v_dt_inic_per_ferias := :p78_dt_inic_per_ferias_1;',
'v_dt_fim_per_ferias := :p78_dt_fim_per_ferias_1;',
'v_dt_saida_parc2 := :p78_dt_saida_parc2;',
'v_saldo_bruto := :p78_saldo_bruto_1;',
'v_falta_hora := :p78_falta_hora_1;',
'v_dias_direito := :p78_dias_direito_1;',
'v_dt_saida_parc1 := :p78_dt_saida_parc1;',
'v_saldo := :p78_saldo_1;',
'v_dias_abono_pec1 := :p78_dias_abono_pec1;',
'v_num_dias_parc1 := :p78_num_dias_parc1;',
'v_opcao_13sal1 := :p78_opcao_13sal1;',
'v_opcao_13sal2 := :p78_opcao_13sal2;',
'v_tipo_ferias1 := :p78_tipo_ferias1;',
'v_dt_retorno_parc1 := :p78_dt_retorno_parc1;',
'v_dt_retorno_parc1_old := :p78_dt_retorno_parc1;',
'v_dt_pagto_parc1 := :p78_dt_pagto_parc1;',
'v_jornada_reduzida := :p78_jornada_reduzida;',
'v_ind_situacao_periodo := :p78_ind_situacao_periodo_a;',
'',
'pkg_ferias.Valida_Dt_Saida_Parc1(v_cod_empresa,',
'v_cod_solicitacao,',
'v_matricula,',
'v_dt_inic_per_ferias,',
'v_dt_fim_per_ferias,',
'v_dt_saida_parc2,',
'v_saldo_bruto,',
'v_falta_hora,',
'v_dias_direito,',
'v_dt_saida_parc1,',
'v_saldo,',
'v_dias_abono_pec1,',
'v_num_dias_parc1,',
'v_opcao_13sal1,',
'v_opcao_13sal2,',
'v_tipo_ferias1,',
'v_dt_retorno_parc1,',
'v_dt_pagto_parc1,',
'v_jornada_reduzida,',
'v_ind_situacao_periodo,',
':p78_dias_abono_pec1_dsp,',
':p78_num_dias_parc1_dsp,',
'v_flg_retorno,',
'v_msg_retorno);',
'',
'IF V_DT_RETORNO_PARC1 IS NOT NULL THEN',
':p78_dt_retorno_parc1_X := v_dt_retorno_parc1;',
'ELSE',
':p78_dt_retorno_parc1_X := v_dt_retorno_parc1_old;',
'END IF;',
'',
'if v_dt_pagto_parc1 is not null then',
'  :p78_dt_pagto_parc1 := v_dt_pagto_parc1;',
'end if;',
'if trim(v_msg_retorno) is not null then',
'',
'if v_flg_retorno in (''N'',''Q'') then',
'    :P78_ok := ''N'';',
'    :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_dt_saida_parc1''));',
'else',
'    :P78_ok := ''S'';',
'end if;',
'',
':P78_flag := v_flg_retorno;',
':P78_mensagem := v_msg_retorno;',
'else',
':P78_flag := null;',
':P78_mensagem := null;',
'if v_item_validacao = TRIM(UPPER(''p78_dt_saida_parc1'')) OR v_item_validacao IS NULL then',
'   :P78_OK := ''S'';',
'   :P78_ITEM_VALIDACAO := null;',
'else',
'   :P78_ITEM_VALIDACAO := v_item_validacao;',
'end if;',
'end if;',
'',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_COD_SOLICITACAO,P78_MATRICULA,P78_DT_INIC_PER_FERIAS_1,P78_DT_FIM_PER_FERIAS_1,P78_DT_SAIDA_PARC2,P78_SALDO_BRUTO_1,P78_FALTA_HORA_1,P78_DIAS_DIREITO_1,P78_DT_SAIDA_PARC1,P78_SALDO_1,P78_DIAS_ABONO_PEC1,P78_NUM_DIAS_PARC1,P78_OPCA'
||'O_13SAL1,P78_OPCAO_13SAL2,P78_TIPO_FERIAS1,P78_DT_RETORNO_PARC1,P78_DT_PAGTO_PARC1,P78_JORNADA_REDUZIDA,P78_IND_SITUACAO_PERIODO_A,P78_ITEM_VALIDACAO,P78_DT_RETORNO_PARC1'
,p_attribute_03=>'P78_DT_RETORNO_PARC1_X,P78_FLAG,P78_MENSAGEM,P78_OK,P78_ITEM_VALIDACAO,P78_DIAS_ABONO_PEC1_DSP,P78_NUM_DIAS_PARC1_DSP,P78_DT_PAGTO_PARC1'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
end;
/
begin
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329776479312718542)
,p_name=>'Valida_Abono_Pec2'
,p_event_sequence=>318
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DIAS_ABONO_PEC2'
,p_condition_element=>'P78_DIAS_ABONO_PEC2'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329776932922718542)
,p_event_id=>wwv_flow_api.id(276329776479312718542)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'begin',
'',
'pkg_ferias.Valida_Abono_Pec2(:P78_cod_empresa,',
'                             :P78_matricula,',
'                             nvl(:P78_dt_inic_per_ferias,:P78_dt_inic_per_ferias_1),',
'                             nvl(:P78_dt_fim_per_ferias,:P78_dt_fim_per_ferias_1),',
'                             nvl(:P78_ind_situacao_periodo,:P78_ind_situacao_periodo_a),',
'                             nvl(:P78_dias_direito,:P78_dias_direito_1),',
'                              nvl(:P78_num_dias_parc1,:P78_num_dias_parc1_1),',
'                              nvl(:P78_dias_abono_pec1,:P78_dias_abono_pec1_1),',
'                             :P78_dt_saida_parc2,',
'                             :P78_num_dias_parc2,',
'                             :P78_desc_adicional2,',
'                             :P78_dias_abono_pec2,',
'                             :P78_opcao_abono_pec2,',
'                             :P78_dt_retorno_parc2,',
'                             v_flg_retorno,',
'                             v_msg_retorno);',
' ',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''P78_dias_abono_pec2''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''P78_dias_abono_pec2'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
' ',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_DT_INIC_PER_FERIAS,P78_DT_FIM_PER_FERIAS,P78_NUM_DIAS_PARC1,P78_DIAS_ABONO_PEC1,P78_DT_SAIDA_PARC2,P78_NUM_DIAS_PARC2,P78_DESC_ADICIONAL2,P78_DIAS_ABONO_PEC2,P78_ITEM_VALIDACAO,P78_IND_SITUACAO_PERIODO,P78_DIAS_DIREI'
||'TO,P78_NUM_DIAS_PARC1_1,P78_DIAS_ABONO_PEC1_1,P78_DT_INIC_PER_FERIAS_1,P78_DT_FIM_PER_FERIAS_1,P78_IND_SITUACAO_PERIODO_A,P78_DIAS_DIREITO_1'
,p_attribute_03=>'P78_OPCAO_ABONO_PEC2,P78_DT_RETORNO_PARC2,P78_MENSAGEM,P78_OK,P78_FLAG,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329777418861718542)
,p_name=>'Valida_Abono_Pec4'
,p_event_sequence=>328
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DIAS_ABONO_PEC4'
,p_condition_element=>'P78_DIAS_ABONO_PEC4'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329777823861718543)
,p_event_id=>wwv_flow_api.id(276329777418861718542)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'begin',
'',
'pkg_ferias.Valida_Abono_Pec4(:P78_cod_empresa,',
'                             :P78_matricula,',
'                             :P78_dt_inic_per_ferias,',
'                             :P78_dt_fim_per_ferias,',
'                             :P78_ind_situacao_periodo,',
'                             :P78_dias_direito,',
'                             nvl(:P78_num_dias_parc1,:P78_num_dias_parc1_1),',
'                             nvl(:P78_dias_abono_pec1,:P78_dias_abono_pec1_1),',
'                             nvl(:P78_dt_saida_parc2,:P78_dt_saida_parc2_1),',
'                             nvl(:P78_num_dias_parc2,:P78_num_dias_parc2_1),',
'                             nvl(:P78_desc_adicional2,:P78_desc_adicional2_1),',
'                             nvl(:P78_dias_abono_pec2,:P78_dias_abono_pec2_1),',
'                             :P78_dt_saida_parc4,',
'                             :P78_num_dias_parc4,',
'                             :P78_desc_adicional4,',
'                             :P78_dias_abono_pec4,',
'                             :P78_opcao_abono_pec4,',
'                             :P78_dt_retorno_parc4,',
'                             v_flg_retorno,',
'                             v_msg_retorno);',
'',
'',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''P78_dias_abono_pec4''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''P78_dias_abono_pec4'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
' ',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_DT_INIC_PER_FERIAS,P78_DT_FIM_PER_FERIAS,P78_IND_SITUACAO_PERIODO,P78_DIAS_DIREITO,P78_NUM_DIAS_PARC1,P78_DIAS_ABONO_PEC1,P78_DT_SAIDA_PARC2,P78_NUM_DIAS_PARC2,P78_DESC_ADICIONAL2,P78_DIAS_ABONO_PEC2,P78_DT_SAIDA_PAR'
||'C4,P78_NUM_DIAS_PARC4,P78_DESC_ADICIONAL4,P78_DIAS_ABONO_PEC4,P78_OPCAO_ABONO_PEC4,P78_DT_RETORNO_PARC4,P78_ITEM_VALIDACAO,P78_NUM_DIAS_PARC1_1,P78_NUM_DIAS_PARC2_1,P78_DIAS_ABONO_PEC1_1,P78_DIAS_ABONO_PEC2_1,P78_DT_SAIDA_PARC2_1,P78_DESC_ADICIONAL2_'
||'1,P78_DIAS_ABONO_PEC2_1'
,p_attribute_03=>'P78_OPCAO_ABONO_PEC4,P78_DT_RETORNO_PARC4,P78_MENSAGEM,P78_OK,P78_FLAG,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329778238279718543)
,p_name=>'Valida_Tipo_Ferias1'
,p_event_sequence=>338
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_TIPO_FERIAS1'
,p_condition_element=>'P78_TIPO_FERIAS1'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329778768548718543)
,p_event_id=>wwv_flow_api.id(276329778238279718543)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'begin',
'',
'if :p78_matricula is not null then',
'',
':p78_mensagem := null;',
'',
'if :p78_cod_empresa is not null and',
':p78_matricula is not null and ',
'nvl(:p78_dt_inic_per_ferias,:p78_dt_inic_per_ferias_1) is not null and',
'nvl(:p78_dt_fim_per_ferias,:p78_dt_fim_per_ferias_1) is not null and ',
':p78_data_ref is not null and ',
':p78_tipo_ferias1 is not null and ',
'nvl(:p78_ind_situacao_periodo,:p78_ind_situacao_periodo_a) is not null then -- Igor 14/04',
'',
'pkg_ferias.Valida_Tipo_Ferias1(:p78_cod_empresa        ,',
'                                  :p78_matricula          ,',
'                                  nvl(:p78_dt_inic_per_ferias,:p78_dt_inic_per_ferias_1) ,',
'                                  nvl(:p78_dt_fim_per_ferias,:p78_dt_fim_per_ferias_1)  ,',
'                                  :p78_data_ref,',
'                                  :p78_tipo_ferias1,',
'                                  nvl(:p78_ind_situacao_periodo,:p78_ind_situacao_periodo_a),',
'                                  v_flg_retorno        ,',
'                                  v_msg_retorno        );',
' end if;',
' ',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_tipo_ferias1''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_tipo_ferias1'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
' ',
'end if;',
' ',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_FILIAL,P78_DT_INIC_PER_FERIAS,P78_DT_FIM_PER_FERIAS,P78_NUM_DIAS_PARC1,P78_DT_SAIDA_PARC1,P78_SALDO,P78_OK,P78_ITEM_VALIDACAO,P78_DT_INIC_PER_FERIAS_1,P78_DT_FIM_PER_FERIAS_1,P78_IND_SITUACAO_PERIODO_A'
,p_attribute_03=>'P78_OK,P78_FLAG,P78_MENSAGEM,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329779135795718544)
,p_name=>'Valida_Opcao_13Sal1'
,p_event_sequence=>348
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_OPCAO_13SAL1'
,p_condition_element=>'P78_OPCAO_13SAL1'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329779667255718544)
,p_event_id=>wwv_flow_api.id(276329779135795718544)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'begin',
'',
'IF nvl(:p78_opcao_13sal1, ''N'') = ''S'' AND',
'   :p78_dt_saida_parc1 IS NOT NULL THEN -- Bruno Sousa 30/12/2024',
'',
' :p78_mensagem := null;',
'pkg_ferias.Valida_Opcao_13Sal1(:p78_cod_empresa,',
'                               :p78_matricula,',
'                               :p78_dt_saida_parc1,',
'                               :p78_dt_retorno_parc1,',
'                               :p78_opcao_13sal1,',
'                               :p78_ind_situacao_periodo,',
'                               NVL(:P78_COD_REQ,:P78_COD_SOLICITACAO),',
'                               v_flg_retorno,',
'                               v_msg_retorno);',
' ',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_opcao_13sal1''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_opcao_13sal1'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
' ',
'END IF;',
' ',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_DT_SAIDA_PARC1,P78_DT_RETORNO_PARC1,P78_OPCAO_13SAL1,P78_IND_SITUACAO_PERIODO,P78_OK,P78_ITEM_VALIDACAO,P78_FLAG_CTRL,P78_COD_SOLICITACAO,P78_COD_REQ'
,p_attribute_03=>'P78_OK,P78_FLAG,P78_MENSAGEM,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329780076188718544)
,p_name=>'Valida_Opcao_13Sal2'
,p_event_sequence=>358
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_OPCAO_13SAL2'
,p_condition_element=>'P78_OPCAO_13SAL2'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329780613058718544)
,p_event_id=>wwv_flow_api.id(276329780076188718544)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'begin',
'IF nvl(:p78_opcao_13sal2, ''N'') = ''S'' AND',
'   nvl(:p78_dt_saida_parc1,:p78_dt_saida_parc1_1) IS NOT NULL AND',
'   :p78_dt_saida_parc2 IS NOT NULL THEN -- Bruno Sousa 30/12/2024',
'',
'',
'pkg_ferias.Valida_Opcao_13Sal2(:p78_cod_empresa,',
'                               :p78_matricula,',
'                               nvl(:p78_opcao_13sal1,:p78_opcao_13sal1_1),',
'                               nvl(:P78_DT_SAIDA_PARC1,:P78_DT_SAIDA_PARC1_1),',
'                               :p78_opcao_13sal2,',
'                               :p78_dt_saida_parc2,',
'                               :p78_dt_retorno_parc2,',
'                               NVL(:P78_COD_REQ,:P78_COD_SOLICITACAO),',
'                               v_flg_retorno,',
'                               v_msg_retorno);',
' ',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_opcao_13sal2''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_opcao_13sal2'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
' ',
'END IF;',
' ',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_DT_SAIDA_PARC1,P78_DT_RETORNO_PARC2,P78_OPCAO_13SAL1,P78_OPCAO_13SAL2,P78_DT_SAIDA_PARC2,P78_OK,P78_ITEM_VALIDACAO,P78_OPCAO_13SAL1_1,P78_DT_SAIDA_PARC1_1,P78_FLAG_CTRL,P78_COD_SOLICITACAO,P78_COD_REQ'
,p_attribute_03=>'P78_OK,P78_FLAG,P78_MENSAGEM,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329780941299718545)
,p_name=>'Valida_Opcao_13Sal4'
,p_event_sequence=>368
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_OPCAO_13SAL4'
,p_condition_element=>'P78_OPCAO_13SAL4'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329781490092718545)
,p_event_id=>wwv_flow_api.id(276329780941299718545)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'begin',
'IF :p78_opcao_13sal4 IS NOT NULL AND ',
'   nvl(:p78_dt_saida_parc1,:p78_dt_saida_parc1_1) IS NOT NULL AND',
'   nvl(:p78_dt_saida_parc2,:p78_dt_saida_parc2_1) IS NOT NULL AND',
'   :p78_dt_saida_parc4 IS NOT NULL THEN -- Bruno Sousa 30/12/2024',
'',
' ',
'pkg_ferias.Valida_Opcao_13Sal4(:p78_cod_empresa,',
'                               :p78_matricula,',
'                               :p78_opcao_13sal1,',
'                               nvl(:p78_dt_saida_parc1,:p78_dt_saida_parc1_1),',
'                               nvl(:p78_opcao_13sal2,:p78_opcao_13sal2_1),',
'                               nvl(:p78_dt_saida_parc2,:p78_dt_saida_parc2_1),',
'                               :p78_dt_retorno_parc2,',
'                               :p78_opcao_13sal4,',
'                               :p78_dt_saida_parc4,',
'                               :p78_dt_retorno_parc4,',
'                               NVL(:P78_COD_REQ,:P78_COD_SOLICITACAO),',
'                               v_flg_retorno,',
'                               v_msg_retorno);',
' ',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_opcao_13sal4''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_opcao_13sal4'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
' ',
'END IF;',
' ',
'end;'))
,p_attribute_02=>'P78_ITEM_VALIDACAO,P78_COD_EMPRESA,P78_MATRICULA,P78_OPCAO_13SAL1,P78_DT_SAIDA_PARC1,P78_OPCAO_13SAL2,P78_DT_SAIDA_PARC2,P78_DT_RETORNO_PARC2,P78_OPCAO_13SAL4,P78_DT_SAIDA_PARC4,P78_DT_RETORNO_PARC4,P78_DT_SAIDA_PARC1_1,P78_OPCAO_13SAL2_1,P78_DT_SAID'
||'A_PARC2_1,P78_FLAG_CTRL,P78_COD_SOLICITACAO,P78_COD_REQ'
,p_attribute_03=>'P78_ITEM_VALIDACAO,P78_OK,P78_FLAG,P78_MENSAGEM'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329781898916718545)
,p_name=>'Valida_Desc_Adicional1'
,p_event_sequence=>378
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DESC_ADICIONAL1'
,p_condition_element=>'P78_DESC_ADICIONAL1'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329782341628718545)
,p_event_id=>wwv_flow_api.id(276329781898916718545)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'begin',
'',
' ',
'',
'    :p78_mensagem := null;',
'',
'    pkg_ferias.Valida_Desc_Adicional1(:p78_desc_adicional1,',
'                                      :p78_dias_descanso_adicional,',
'                                      :p78_ind_situacao_periodo,',
'                                    v_flg_retorno,',
'                                    v_msg_retorno);',
'',
'     if trim(v_msg_retorno) is not null then',
'',
'        if v_flg_retorno in (''N'',''Q'') then',
'            :P78_ok       := ''N'';',
'            :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_desc_adicional1''));',
'        else',
'            :P78_ok       := ''S'';',
'        end if;',
'',
'        :P78_flag     := v_flg_retorno;',
'        :P78_mensagem := v_msg_retorno;',
'     else',
'        :P78_flag     := null;',
'        :P78_mensagem := null;',
'        if v_item_validacao = TRIM(UPPER(''p78_desc_adicional1'')) OR v_item_validacao IS NULL then',
'           :P78_OK := ''S'';',
'           :P78_ITEM_VALIDACAO := null;',
'        else',
'           :P78_ITEM_VALIDACAO := v_item_validacao;',
'        end if;',
'     end if;',
' ',
'end;'))
,p_attribute_02=>'P78_DESC_ADICIONAL1,P78_DIAS_DESCANSO_ADICIONAL,P78_IND_SITUACAO_PERIODO,P78_ITEM_VALIDACAO'
,p_attribute_03=>'P78_OK,P78_FLAG,P78_MENSAGEM,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329782729331718546)
,p_name=>'Valida_Desc_Adicional2'
,p_event_sequence=>388
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DESC_ADICIONAL2'
,p_condition_element=>'P78_DESC_ADICIONAL2'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329783259998718546)
,p_event_id=>wwv_flow_api.id(276329782729331718546)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'begin',
'',
'pkg_ferias.Valida_Desc_Adicional2(:p78_dias_descanso_adicional,',
'                                  :p78_desc_adicional1,',
'                                  :P78_dt_saida_parc2,',
'                                  :p78_num_dias_parc2,',
'                                  :p78_desc_adicional2,',
'                                  :p78_dt_retorno_parc2,',
'                                  v_flg_retorno,',
'                                  v_msg_retorno);',
' ',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_desc_adicional2''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_desc_adicional2'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
' ',
'end;'))
,p_attribute_02=>'P78_DESC_ADICIONAL1,P78_DIAS_DESCANSO_ADICIONAL,P78_DT_SAIDA_PARC2,P78_NUM_DIAS_PARC2,P78_DESC_ADICIONAL2,P78_DT_RETORNO_PARC2,P78_ITEM_VALIDACAO'
,p_attribute_03=>'P78_OK,P78_FLAG,P78_MENSAGEM,P78_DT_RETORNO_PARC2,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329783718924718546)
,p_name=>'Valida_Desc_Adicional4'
,p_event_sequence=>398
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DESC_ADICIONAL4'
,p_condition_element=>'P78_DESC_ADICIONAL4'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329784125397718546)
,p_event_id=>wwv_flow_api.id(276329783718924718546)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'begin',
'',
'pkg_ferias.Valida_Desc_Adicional4(:p78_dias_descanso_adicional,',
'                                  nvl(:p78_desc_adicional1,:p78_desc_adicional1_1),',
'                                  nvl(:p78_dt_saida_parc2,:p78_dt_saida_parc2_1),',
'                                  nvl(:p78_num_dias_parc2,:p78_num_dias_parc2_1),',
'                                  nvl(:p78_desc_adicional2,:p78_desc_adicional2_1),',
'                                  :p78_dt_saida_parc4,',
'                                  :p78_num_dias_parc4,',
'                                  :p78_desc_adicional4,',
'                                  :p78_dt_retorno_parc4,',
'                                  v_flg_retorno,',
'                                  v_msg_retorno);',
' ',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_desc_adicional4''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_desc_adicional4'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
' ',
'end;'))
,p_attribute_02=>'P78_DIAS_DESCANSO_ADICIONAL,P78_DESC_ADICIONAL1,P78_DT_SAIDA_PARC2,P78_NUM_DIAS_PARC2,P78_DESC_ADICIONAL2,P78_DT_SAIDA_PARC4,P78_NUM_DIAS_PARC4,P78_DESC_ADICIONAL4,P78_DT_RETORNO_PARC4,P78_ITEM_VALIDACAO,P78_DESC_ADICIONAL1_1,P78_DT_SAIDA_PARC2_1,P78'
||'_NUM_DIAS_PARC2_1,P78_DESC_ADICIONAL2_1'
,p_attribute_03=>'P78_OK,P78_FLAG,P78_MENSAGEM,P78_DT_RETORNO_PARC4,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329784598813718547)
,p_name=>unistr('Pesquisa: Mostra Regi\00F5es')
,p_event_sequence=>408
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_COD_SOLICITACAO'
,p_condition_element=>'P78_COD_SOLICITACAO'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329785069523718547)
,p_event_id=>wwv_flow_api.id(276329784598813718547)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694807774550432529)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329785586987718548)
,p_event_id=>wwv_flow_api.id(276329784598813718547)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694816568983432538)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329786081976718548)
,p_event_id=>wwv_flow_api.id(276329784598813718547)
,p_event_result=>'TRUE'
,p_action_sequence=>40
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694826984926432549)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329786601585718549)
,p_event_id=>wwv_flow_api.id(276329784598813718547)
,p_event_result=>'TRUE'
,p_action_sequence=>50
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694827786584432550)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329787011452718549)
,p_name=>'Popula Campos 3'
,p_event_sequence=>418
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_COD_EMPRESA'
,p_condition_element=>'P78_COD_EMPRESA'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return :P78_ROWID is null;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329787473315718549)
,p_event_id=>wwv_flow_api.id(276329787011452718549)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'BEGIN',
'',
'SELECT PAR.DT_REF_FOLHA, NVL(EMP.IND_DUPLO_VINCULO,''N'')',
'	INTO :P78_DATA_REF, :P78_IND_DUPLO_VINCULO',
'	FROM EMPRESAS EMP, PARAMETROS_RECURSOS_HUMANOS PAR',
'  WHERE PAR.COD_EMPRESA = :P78_COD_EMPRESA',
'  AND PAR.COD_EMPRESA = EMP.COD;',
'  ',
'END;'))
,p_attribute_02=>'P78_COD_EMPRESA'
,p_attribute_03=>'P78_DATA_REF,P78_IND_DUPLO_VINCULO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329792460148718554)
,p_name=>'Valida_Sit_Req'
,p_event_sequence=>428
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_SIT_REQUISICAO'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NOT_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329792971252718555)
,p_event_id=>wwv_flow_api.id(276329792460148718554)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'begin',
'',
'pkg_ferias.Valida_Sit_Requisicao(:p78_cod_empresa, :p78_cod_solicitacao, :p78_matricula, :p78_sit_requisicao, :p_usuario, v_flg_retorno, v_msg_retorno);',
' ',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_sit_requisicao''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    :P78_DT_SIT_SOLICITACAO := sysdate;',
'    if v_item_validacao = TRIM(UPPER(''p78_sit_requisicao'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
' ',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_COD_SOLICITACAO,P78_MATRICULA,P78_SIT_REQUISICAO,P78_ITEM_VALIDACAO,P_USUARIO'
,p_attribute_03=>'P78_FLAG,P78_MENSAGEM,P78_OK,P78_ITEM_VALIDACAO,P78_DT_SIT_SOLICITACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329793339270718555)
,p_name=>unistr('Mostra Bonus F\00E9rias')
,p_event_sequence=>438
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_FILIAL'
,p_condition_element=>'P78_FILIAL'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'    cursor c1 is',
'    select abono_ferias bonus_ferias',
'      from ferias_parametros',
'     where cod_empresa = :p78_cod_empresa',
'       and cod_filial = :p78_filial;',
'       ',
'    v_c1 c1%rowtype;',
'',
'begin',
'',
'    open c1;',
'    fetch c1 into v_c1;',
'    close c1;',
'    ',
'    if v_c1.bonus_ferias > 0 then',
'    return true;',
'    else ',
'    return false;',
'    end if;',
'',
'end;'))
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329793887500718556)
,p_event_id=>wwv_flow_api.id(276329793339270718555)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_DESC_ADICIONAL1,P78_DESC_ADICIONAL2'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329794229177718556)
,p_name=>unistr('Esconde Bonus F\00E9rias')
,p_event_sequence=>448
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_FILIAL'
,p_condition_element=>'P78_FILIAL'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'    cursor c1 is',
'    select abono_ferias bonus_ferias',
'      from ferias_parametros',
'     where cod_empresa = :p78_cod_empresa',
'       and cod_filial = :p78_filial;',
'       ',
'    v_c1 c1%rowtype;',
'',
'begin',
'',
'    open c1;',
'    fetch c1 into v_c1;',
'    close c1;',
'    ',
'    if v_c1.bonus_ferias > 0 then',
'    return false;',
'    else ',
'    return true;',
'    end if;',
'',
'end;'))
);
end;
/
begin
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329794788333718557)
,p_event_id=>wwv_flow_api.id(276329794229177718556)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_DESC_ADICIONAL1,P78_DESC_ADICIONAL2'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329795149763718557)
,p_name=>'Popular: dt_inic_per_ferias_1'
,p_event_sequence=>458
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_INIC_PER_FERIAS'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return :P78_FLAG_CTRL is null;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329795649895718557)
,p_event_id=>wwv_flow_api.id(276329795149763718557)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
':P78_DT_INIC_PER_FERIAS_1 := :P78_DT_INIC_PER_FERIAS;',
''))
,p_attribute_02=>'P78_DT_INIC_PER_FERIAS'
,p_attribute_03=>'P78_DT_INIC_PER_FERIAS_1'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329796034440718558)
,p_name=>'Popular: dt_fim_per_ferias_1'
,p_event_sequence=>468
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_FIM_PER_FERIAS'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return :P78_FLAG_CTRL is null;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329796577563718558)
,p_event_id=>wwv_flow_api.id(276329796034440718558)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>':P78_DT_FIM_PER_FERIAS_1 := :P78_DT_FIM_PER_FERIAS;'
,p_attribute_02=>'P78_DT_FIM_PER_FERIAS'
,p_attribute_03=>'P78_DT_FIM_PER_FERIAS_1'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329796943036718558)
,p_name=>'Popular: P78_IND_SITUACAO_PERIODO_1'
,p_event_sequence=>478
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_IND_SITUACAO_PERIODO'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329797478677718559)
,p_event_id=>wwv_flow_api.id(276329796943036718558)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if :P78_IND_SITUACAO_PERIODO = ''P'' then',
'   :P78_IND_SITUACAO_PERIODO_1 := ''Pendente'';',
'elsif :P78_IND_SITUACAO_PERIODO = ''G'' then',
'   :P78_IND_SITUACAO_PERIODO_1 := ''Gozado'';',
'elsif :P78_IND_SITUACAO_PERIODO = ''Q'' then',
'   :P78_IND_SITUACAO_PERIODO_1 := ''Quitado'';',
'elsif :P78_IND_SITUACAO_PERIODO = ''R'' then',
'   :P78_IND_SITUACAO_PERIODO_1 := ''Parcial'';',
'elsif :P78_IND_SITUACAO_PERIODO = ''C'' then',
'   :P78_IND_SITUACAO_PERIODO_1 := ''Cancelado'';',
'end if;'))
,p_attribute_02=>'P78_IND_SITUACAO_PERIODO'
,p_attribute_03=>'P78_IND_SITUACAO_PERIODO_1'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329797873655718559)
,p_name=>'Popular: P78_JORNADA_REDUZIDA_1'
,p_event_sequence=>488
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_JORNADA_REDUZIDA'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329798365453718559)
,p_event_id=>wwv_flow_api.id(276329797873655718559)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if :P78_JORNADA_REDUZIDA = ''S'' then',
':P78_JORNADA_REDUZIDA_1 := ''Sim'';',
'else',
unistr(':P78_JORNADA_REDUZIDA_1 := ''N\00E3o'';'),
'end if;'))
,p_attribute_02=>'P78_JORNADA_REDUZIDA'
,p_attribute_03=>'P78_JORNADA_REDUZIDA_1'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329798722830718560)
,p_name=>'Popular: P78_FALTA_HORA_1'
,p_event_sequence=>498
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_FALTA_HORA'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return :P78_FLAG_CTRL is null;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329799318471718560)
,p_event_id=>wwv_flow_api.id(276329798722830718560)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>':P78_FALTA_HORA_1 := :P78_FALTA_HORA;'
,p_attribute_02=>'P78_FALTA_HORA'
,p_attribute_03=>'P78_FALTA_HORA_1'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329799703507718560)
,p_name=>'Popular: P78_FALTA_MINUTO_1'
,p_event_sequence=>508
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_FALTA_MINUTO'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return :P78_FLAG_CTRL is null;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329800183446718560)
,p_event_id=>wwv_flow_api.id(276329799703507718560)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>':P78_FALTA_MINUTO_1 := :P78_FALTA_MINUTO;'
,p_attribute_02=>'P78_FALTA_MINUTO'
,p_attribute_03=>'P78_FALTA_MINUTO_1'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329800550079718561)
,p_name=>'Popular: P78_DIAS_DIREITO_1'
,p_event_sequence=>518
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DIAS_DIREITO'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return :P78_FLAG_CTRL is null;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329801044071718561)
,p_event_id=>wwv_flow_api.id(276329800550079718561)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'    v_dias_number number;',
'    v_dias_char varchar2(10) := :P78_DIAS_DIREITO; -- Igor 30/03',
'begin',
'',
'    if instr(v_dias_char,''.'') > 0 then',
'       v_dias_number := replace(v_dias_char,''.'','','');',
'       :P78_DIAS_DIREITO_1 := v_dias_number;',
'    else',
'       :P78_DIAS_DIREITO_1 := :P78_DIAS_DIREITO;',
'    end if;',
'',
'end;'))
,p_attribute_02=>'P78_DIAS_DIREITO'
,p_attribute_03=>'P78_DIAS_DIREITO_1'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329801425817718561)
,p_name=>'Popular: P78_DIAS_DESCANSO_ADICIONAL_1'
,p_event_sequence=>528
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DIAS_DESCANSO_ADICIONAL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return :P78_FLAG_CTRL is null;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329801931927718561)
,p_event_id=>wwv_flow_api.id(276329801425817718561)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>':P78_DIAS_DESCANSO_ADICIONAL_1 := :P78_DIAS_DESCANSO_ADICIONAL;'
,p_attribute_02=>'P78_DIAS_DESCANSO_ADICIONAL'
,p_attribute_03=>'P78_DIAS_DESCANSO_ADICIONAL_1'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329802365573718561)
,p_name=>'Popular: P78_SALDO_BRUTO_1'
,p_event_sequence=>538
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_SALDO_BRUTO'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return :P78_FLAG_CTRL is null;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329802907422718562)
,p_event_id=>wwv_flow_api.id(276329802365573718561)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>':P78_SALDO_BRUTO_1 := :P78_SALDO_BRUTO;'
,p_attribute_02=>'P78_SALDO_BRUTO'
,p_attribute_03=>'P78_SALDO_BRUTO_1'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329803230452718562)
,p_name=>'Popular: P78_SALDO_1'
,p_event_sequence=>548
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_SALDO'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329803742429718562)
,p_event_id=>wwv_flow_api.id(276329803230452718562)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>':P78_SALDO_1 := :P78_SALDO;'
,p_attribute_02=>'P78_SALDO'
,p_attribute_03=>'P78_SALDO_1'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329804201185718562)
,p_name=>'Disable Parcela 1 Sit R'
,p_event_sequence=>558
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_IND_SITUACAO_PERIODO'
,p_condition_element=>'P78_IND_SITUACAO_PERIODO'
,p_triggering_condition_type=>'EQUALS'
,p_triggering_expression=>'R'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329804690151718563)
,p_event_id=>wwv_flow_api.id(276329804201185718562)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_DISABLE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_DT_SAIDA_PARC1,P78_NUM_DIAS_PARC1,P78_DIAS_ABONO_PEC1,P78_OPCAO_13SAL1,P78_DESC_ADICIONAL1,P78_DT_RETORNO_PARC1'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329805161103718563)
,p_event_id=>wwv_flow_api.id(276329804201185718562)
,p_event_result=>'FALSE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_ENABLE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_DT_SAIDA_PARC1,P78_NUM_DIAS_PARC1,P78_DIAS_ABONO_PEC1,P78_OPCAO_13SAL1,P78_DESC_ADICIONAL1'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329805588914718563)
,p_name=>'Pesquisa: Hide Parcela 2'
,p_event_sequence=>568
,p_bind_type=>'bind'
,p_bind_event_type=>'ready'
,p_display_when_type=>'NEVER'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329806067666718563)
,p_event_id=>wwv_flow_api.id(276329805588914718563)
,p_event_result=>'FALSE'
,p_action_sequence=>20
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694838117800432559)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329806593447718564)
,p_event_id=>wwv_flow_api.id(276329805588914718563)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694838117800432559)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329807019957718564)
,p_event_id=>wwv_flow_api.id(276329805588914718563)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694847727728432570)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329807617847718564)
,p_event_id=>wwv_flow_api.id(276329805588914718563)
,p_event_result=>'FALSE'
,p_action_sequence=>30
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694847727728432570)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329808026096718565)
,p_event_id=>wwv_flow_api.id(276329805588914718563)
,p_event_result=>'TRUE'
,p_action_sequence=>40
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276559150703399823134)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329808584433718565)
,p_event_id=>wwv_flow_api.id(276329805588914718563)
,p_event_result=>'FALSE'
,p_action_sequence=>40
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694832970995432555)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329809065169718565)
,p_event_id=>wwv_flow_api.id(276329805588914718563)
,p_event_result=>'TRUE'
,p_action_sequence=>50
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694832970995432555)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329809463510718565)
,p_name=>'Pesquisa: Hide Parcela Coletiva'
,p_event_sequence=>578
,p_bind_type=>'bind'
,p_bind_event_type=>'ready'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>wwv_flow_string.join(wwv_flow_t_varchar2(
'   if :P78_ROWID is not null and :P78_DT_SAIDA_PARC3 IS     NULL THEN',
'      RETURN TRUE;',
'END IF;'))
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329809952784718566)
,p_event_id=>wwv_flow_api.id(276329809463510718565)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276559150703399823134)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329810337513718566)
,p_name=>unistr('Cria\00E7\00E3o: Hide Parcela 1 (Pesquisa)')
,p_event_sequence=>588
,p_bind_type=>'bind'
,p_bind_event_type=>'ready'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_COD_SOLICITACAO'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329810859347718566)
,p_event_id=>wwv_flow_api.id(276329810337513718566)
,p_event_result=>'TRUE'
,p_action_sequence=>40
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694847727728432570)
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329811394555718566)
,p_event_id=>wwv_flow_api.id(276329810337513718566)
,p_event_result=>'TRUE'
,p_action_sequence=>50
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694832970995432555)
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329811768497718567)
,p_name=>'Pesquisa: Show Parcela 2'
,p_event_sequence=>598
,p_bind_type=>'bind'
,p_bind_event_type=>'ready'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>wwv_flow_string.join(wwv_flow_t_varchar2(
'IF :P78_ROWID is not null and :P78_DT_SAIDA_PARC2 IS NOT NULL and 1 = 2 THEN',
'      RETURN TRUE;',
'end if;'))
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329812252403718567)
,p_event_id=>wwv_flow_api.id(276329811768497718567)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694838117800432559)
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329812782542718567)
,p_event_id=>wwv_flow_api.id(276329811768497718567)
,p_event_result=>'TRUE'
,p_action_sequence=>40
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694847727728432570)
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329813307086718567)
,p_event_id=>wwv_flow_api.id(276329811768497718567)
,p_event_result=>'TRUE'
,p_action_sequence=>50
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694832970995432555)
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329813620001718568)
,p_name=>'Valida_Update_Rf'
,p_event_sequence=>608
,p_bind_type=>'bind'
,p_bind_event_type=>'apexbeforepagesubmit'
,p_display_when_type=>'REQUEST_EQUALS_CONDITION'
,p_display_when_cond=>'SAVE'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329814127101718568)
,p_event_id=>wwv_flow_api.id(276329813620001718568)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'PKG_FERIAS.Valida_Update_Rf(:P78_cod_empresa,',
'                            :P78_filial,',
'                            nvl(:P78_dt_saida_parc1,:p78_dt_saida_parc1_1),',
'                            :P78_dt_fim_per_ferias,',
'                            :P78_num_dias_parc1,',
'                            :P78_dias_abono_pec1,',
'                            :P78_saldo,',
'                            :p78_matricula,',
'                            :p78_jornada_reduzida,',
'                            V_flg_retorno,',
'                            V_msg_retorno);',
'',
' ',
' if v_msg_retorno is not null then',
'    :p78_ok       := ''N'';',
'    :p78_flag     := v_flg_retorno;',
'    :p78_mensagem := v_msg_retorno;',
' else',
'    :p78_flag     := null;',
'    :p78_mensagem := null;',
'    :p78_ok       := ''S'';',
' end if;',
' ',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_FILIAL,P78_DT_SAIDA_PARC1,P78_DT_FIM_PER_FERIAS,P78_NUM_DIAS_PARC1,P78_DIAS_ABONO_PEC1,P78_SALDO,P78_MATRICULA,P78_JORNADA_REDUZIDA'
,p_attribute_03=>'P78_OK,P78_MENSAGEM,P78_FLAG'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329814566699718568)
,p_name=>'Hide Region'
,p_event_sequence=>618
,p_bind_type=>'bind'
,p_bind_event_type=>'ready'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_COD_SOLICITACAO'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329815064632718568)
,p_event_id=>wwv_flow_api.id(276329814566699718568)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694807774550432529)
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329815616773718569)
,p_event_id=>wwv_flow_api.id(276329814566699718568)
,p_event_result=>'TRUE'
,p_action_sequence=>40
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694827786584432550)
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329816118279718569)
,p_event_id=>wwv_flow_api.id(276329814566699718568)
,p_event_result=>'TRUE'
,p_action_sequence=>50
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694826984926432549)
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329816608106718569)
,p_event_id=>wwv_flow_api.id(276329814566699718568)
,p_event_result=>'TRUE'
,p_action_sequence=>60
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694816568983432538)
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329817095517718570)
,p_event_id=>wwv_flow_api.id(276329814566699718568)
,p_event_result=>'TRUE'
,p_action_sequence=>70
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694820167112432541)
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329817460838718570)
,p_name=>unistr('(Page Load) Cria\00E7\00E3o: Mostra Regi\00F5es')
,p_event_sequence=>628
,p_bind_type=>'bind'
,p_bind_event_type=>'ready'
,p_display_when_type=>'ITEM_IS_NOT_NULL'
,p_display_when_cond=>'P78_MATRICULA'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329817949186718570)
,p_event_id=>wwv_flow_api.id(276329817460838718570)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694826984926432549)
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329818420432718570)
,p_event_id=>wwv_flow_api.id(276329817460838718570)
,p_event_result=>'TRUE'
,p_action_sequence=>40
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694827786584432550)
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329818881735718570)
,p_name=>'OK: Show Create'
,p_event_sequence=>638
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_ITEM_VALIDACAO'
,p_condition_element=>'P78_ITEM_VALIDACAO'
,p_triggering_condition_type=>'NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'NEVER'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329819400716718571)
,p_event_id=>wwv_flow_api.id(276329818881735718570)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'BUTTON'
,p_affected_button_id=>wwv_flow_api.id(276329683628271718456)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329819919510718571)
,p_event_id=>wwv_flow_api.id(276329818881735718570)
,p_event_result=>'FALSE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'BUTTON'
,p_affected_button_id=>wwv_flow_api.id(276329683628271718456)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329820259854718571)
,p_name=>'OK: Show Create_1'
,p_event_sequence=>648
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_ITEM_VALIDACAO'
,p_condition_element=>'P78_ITEM_VALIDACAO'
,p_triggering_condition_type=>'EQUALS'
,p_triggering_expression=>'P78_CREATE'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'NEVER'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329820734850718572)
,p_event_id=>wwv_flow_api.id(276329820259854718571)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'BUTTON'
,p_affected_button_id=>wwv_flow_api.id(276329683628271718456)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329821176186718572)
,p_name=>unistr('(Cria\00E7\00E3o) Matricula: Popula_Campos 1_1')
,p_event_sequence=>658
,p_bind_type=>'bind'
,p_bind_event_type=>'ready'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>wwv_flow_string.join(wwv_flow_t_varchar2(
'/*if :P78_ROWID is null and NVL(:P78_OK,''S'') = ''S'' and :p78_matricula is not null and 1 = 1 then',
'return true;',
'else',
'return false;',
'end if;',
'*/',
'return (:P78_ROWID is null and NVL(:P78_OK,''S'') = ''S'' and :p78_matricula is not null);'))
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329821658229718572)
,p_event_id=>wwv_flow_api.id(276329821176186718572)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'begin',
'IF :P78_MATRICULA IS NOT NULL THEN',
':P78_MENSAGEM:=NULL;',
'pkg_Req_Ferias.pg78_load1(p_P78_COD_EMPRESA => :P78_COD_EMPRESA,',
'                            p_P78_MATRICULA => :P78_MATRICULA,',
'                            p_P78_COD_SOLICITACAO => :P78_COD_SOLICITACAO,',
'                            p_P78_DIAS_DESCANSO_ADICIONAL => :P78_DIAS_DESCANSO_ADICIONAL,',
'                            p_P78_SALDO_BRUTO => :P78_SALDO_BRUTO,',
'                            p_P78_SALDO => :P78_SALDO,',
'                            p_P78_IND_SITUACAO_PERIODO => :P78_IND_SITUACAO_PERIODO,',
'                            p_P78_DT_INIC_PER_FERIAS => :P78_DT_INIC_PER_FERIAS,',
'                            p_P78_DT_FIM_PER_FERIAS => :P78_DT_FIM_PER_FERIAS,',
'                            p_P78_DT_SAIDA_PARC1 => :P78_DT_SAIDA_PARC1,',
'                            p_P78_NUM_DIAS_PARC1 => :P78_NUM_DIAS_PARC1,',
'                            p_P78_DIAS_ABONO_PEC1 => :P78_DIAS_ABONO_PEC1,',
'                            p_P78_OPCAO_13SAL1 => :P78_OPCAO_13SAL1,',
'                            p_P78_DESC_ADICIONAL1 => :P78_DESC_ADICIONAL1,',
'                            p_P78_DT_RETORNO_PARC1 => :P78_DT_RETORNO_PARC1,',
'                            p_P78_TIPO_FERIAS1 => :P78_TIPO_FERIAS1,',
'                            p_P78_DT_SAIDA_PARC2 => :P78_DT_SAIDA_PARC2,',
'                            p_P78_NUM_DIAS_PARC2 => :P78_NUM_DIAS_PARC2,',
'                            p_P78_DIAS_ABONO_PEC2 => :P78_DIAS_ABONO_PEC2,',
'                            p_P78_OPCAO_13SAL2 => :P78_OPCAO_13SAL2,',
'                            p_P78_DESC_ADICIONAL2 => :P78_DESC_ADICIONAL2,',
'                            p_P78_DT_RETORNO_PARC2 => :P78_DT_RETORNO_PARC2,',
'                            p_P78_TIPO_FERIAS2 => :P78_TIPO_FERIAS2,',
'                            p_P78_DT_SAIDA_PARC4 => :P78_DT_SAIDA_PARC4,',
'                            p_P78_NUM_DIAS_PARC4 => :P78_NUM_DIAS_PARC4,',
'                            p_P78_DT_RETORNO_PARC4 => :P78_DT_RETORNO_PARC4,',
'                            p_P78_TIPO_FERIAS4 => :P78_TIPO_FERIAS4,',
'                            p_P78_DT_SOLICITACAO => :P78_DT_SOLICITACAO,',
'                            p_P78_FALTA_HORA => :P78_FALTA_HORA,',
'                            p_P78_FALTA_MINUTO => :P78_FALTA_MINUTO,',
'                            p_P78_OPCAO_ABONO_PEC1 => :P78_OPCAO_ABONO_PEC1,',
'                            p_P78_OPCAO_ABONO_PEC2 => :P78_OPCAO_ABONO_PEC2,',
'                            p_P78_DC_MATRICULA => :P78_DC_MATRICULA,',
'                            p_P78_FLAG => :P78_FLAG,',
'                            p_P78_OK => :P78_OK,',
'                            p_P78_MENSAGEM => :P78_MENSAGEM);',
'END IF;',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_ROWID,P78_COD_SOLICITACAO,P78_OK'
,p_attribute_03=>'P78_FLAG,P78_OK,P78_MENSAGEM,P78_DIAS_DESCANSO_ADICIONAL,P78_SALDO_BRUTO,P78_SALDO,P78_IND_SITUACAO_PERIODO,P78_DT_INIC_PER_FERIAS,P78_DT_FIM_PER_FERIAS,P78_DT_SAIDA_PARC1,P78_NUM_DIAS_PARC1,P78_DIAS_ABONO_PEC1,P78_OPCAO_13SAL1,P78_DESC_ADICIONAL1,P7'
||'8_DT_RETORNO_PARC1,P78_TIPO_FERIAS1,P78_DT_SAIDA_PARC2,P78_NUM_DIAS_PARC2,P78_DIAS_ABONO_PEC2,P78_OPCAO_13SAL2,P78_DESC_ADICIONAL2,P78_DT_RETORNO_PARC2,P78_TIPO_FERIAS2,P78_DT_SAIDA_PARC4,P78_NUM_DIAS_PARC4,P78_DT_RETORNO_PARC4,P78_TIPO_FERIAS4,P78_D'
||'T_SOLICITACAO,P78_FALTA_HORA,P78_FALTA_MINUTO,P78_OPCAO_ABONO_PEC1,P78_OPCAO_ABONO_PEC2,P78_DC_MATRICULA'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329822027857718572)
,p_name=>'Matricula: Popula_Campos 2_1'
,p_event_sequence=>668
,p_bind_type=>'bind'
,p_bind_event_type=>'ready'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if :P78_ROWID is null and NVL(:P78_OK,''S'') = ''S'' and :p78_matricula is not null and 1 = 1 then',
'return true;',
'else',
'return false;',
'end if;'))
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329822573786718573)
,p_event_id=>wwv_flow_api.id(276329822027857718572)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'  flag number := Null;',
'  Cursor c_idade_colab Is',
'  select trunc(months_between(sysdate,i.DT_NASC)/12) as idade',
'  from inf_pessoais_cad i',
'  where i.MATRICULA = :p78_matricula and i.COD_EMPRESA = :p78_cod_empresa;',
'  v_idade_colab c_idade_colab%rowtype;',
'  Cursor c_idades Is',
'  select fer.IDADE_MAXIMA, fer.IDADE_MINIMA  ',
'  from ferias_parametros fer, inf_pessoais_cad inf',
'  where inf.cod_empresa = fer.cod_empresa and inf.cod_empresa = :P78_COD_EMPRESA and inf.matricula = :P78_matricula and inf.filial = fer.cod_filial;',
'  r_idades c_idades%RowType;',
'  cursor c1 is',
'     select nvl(a.pagto_abono_ferias, ''N'') abono_ferias, a.saldo_fer_min, c.dt_ref_folha, a.cod_filial, b.vinculo',
'       from filiais_cad a, informacoes_funcionais b, parametros_recursos_humanos c',
'     where  b.cod_empresa = a.cod_empresa and b.filial = a.cod_filial and b.cod_empresa = :P78_cod_empresa and b.matricula = :P78_matricula and c.cod_empresa  = b.cod_Empresa;',
'     v_c1 c1%rowtype;',
'v_data_ini date;',
'cursor c3 (v_filial number) is',
'select qtd_parcelas',
'  from ferias_Parametros',
' where cod_empresa = :P78_cod_empresa and cod_filial = v_filial;',
'v_c3 c3%rowtype;',
'v_dias_direito number;',
'v_saldo_bruto number := :P78_SALDO_BRUTO; v_saldo number := :P78_SALDO;',
'begin',
'EXECUTE IMMEDIATE ''ALTER SESSION SET NLS_NUMERIC_CHARACTERS= ''''.,'''' '';',
'v_saldo_bruto := replace(v_saldo_bruto,'','',''.''); v_saldo := replace(v_saldo,'','',''.'');',
':P78_MENSAGEM := NULL;',
'If (:P78_matricula Is Not Null And :P78_num_dias_parc1 Is Null) Then',
'  Open c_idades;',
'  Fetch c_idades Into r_idades;',
'  Close c_idades;',
'  Open  c_idade_colab;',
'  Fetch c_idade_colab Into v_idade_colab;',
'  Close c_idade_colab;',
'  If (v_idade_colab.idade > r_idades.idade_maxima Or v_idade_colab.idade < r_idades.idade_minima) Then',
'      :P78_num_dias_parc1 := 30; :P78_dias_abono_pec1 := 0; :p78_num_dias_parc1_dsp  := ''N''; :p78_dias_abono_pec1_dsp := ''N'';',
'  Else',
'   if :p78_dt_saida_parc1 is not null then',
'    :P78_num_dias_parc1 := 0; :P78_dias_abono_pec1 := 0;',
'   else',
'    :P78_num_dias_parc1 := null;  :P78_dias_abono_pec1 := null; :p78_num_dias_parc1_dsp := ''S''; :p78_dias_abono_pec1_dsp := ''S'';',
'   end if;',
'  End If;',
'End If;',
'open  c1;',
'fetch c1 into v_c1;',
'close c1;',
':p78_filial := v_c1.cod_filial;',
' v_dias_direito := Pkg_Atlz_Saldo_Ferias./*fnc_Ret*/Dias_Direito(:P78_COD_EMPRESA,:P78_MATRICULA,:P78_DT_INIC_PER_FERIAS_1,:P78_DT_FIM_PER_FERIAS_1);',
' IF v_dias_direito IS NULL THEN',
' if NVL(:p78_jornada_reduzida,''N'') = ''N'' then',
'      v_dias_direito := (30 - nvl(trim(v_saldo_bruto),0)) + (nvl(trim(v_saldo),0)); -- Humberto/Izidoro 29/09/2014',
' else',
'      v_dias_direito := (18 - nvl(trim(v_saldo_bruto),0)) + (nvl(trim(v_saldo),0)); -- Humberto/Izidoro 29/09/2014',
' end if;',
' v_dias_direito := f_jornada_reduzida(:p78_cod_empresa,:p78_matricula,v_dias_direito,null);',
' if :p78_falta_hora > 7 and :p78_jornada_reduzida = ''S'' then',
'      v_dias_direito := v_dias_direito / 2;',
' end if;',
' END IF;',
':p78_DIAS_DIREITO := v_dias_direito;--NAO',
' if :P78_matricula is not null then',
'    begin',
'       select max(a.falta_hora), max(a.falta_minuto)',
'         into :P78_falta_hora, :P78_falta_minuto',
'         from ferias a',
'        where a.cod_empresa = :P78_COD_EMPRESA',
'          and a.matricula = :P78_matricula',
'          and a.dt_inic_per_ferias = ',
'(select min(dt_inic_per_ferias) v_data_ini',
'from ferias ',
'where cod_empresa = a.cod_empresa',
'and matricula = a.matricula',
'and (cod_solicitacao Is Null and dt_saida_parc1 is null and dt_saida_parc2 is null and dt_saida_parc4 is null)',
'and NOT EXISTS(SELECT 1',
'FROM REQUISICAO_FERIAS B',
'WHERE B.COD_EMPRESA = A.COD_EMPRESA',
'AND B.MATRICULA = A.MATRICULA',
'AND B.DT_INIC_PER_FERIAS = A.DT_INIC_PER_FERIAS',
'AND B.SIT_REQUISICAO not in (3,4,6))',
'and ind_situacao_periodo in (''P'',''R''));',
'    end;',
'    end if;',
'open  c3(v_c1.cod_filial);',
'fetch c3 into v_c3;',
'close c3;',
'if v_c1.vinculo <> ''E'' then',
':p78_qtd_parcelas := v_c3.qtd_parcelas;',
'else',
':p78_qtd_parcelas := 1;',
'end if;',
'--Matricula: Popula_Campos 2_1',
':P78_VINCULO := V_C1.VINCULO;',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_SALDO_BRUTO,P78_SALDO,P78_ROWID,P78_OK,P78_FALTA_HORA,P78_JORNADA_REDUZIDA,P78_DT_INIC_PER_FERIAS_1,P78_DT_FIM_PER_FERIAS_1'
,p_attribute_03=>'P78_NUM_DIAS_PARC1,P78_DIAS_ABONO_PEC1,P78_DIAS_DIREITO,P78_FALTA_HORA,P78_FALTA_MINUTO,P78_FLAG,P78_OK,P78_MENSAGEM,P78_FILIAL,P78_QTD_PARCELAS,P78_NUM_DIAS_PARC1_DSP,P78_DIAS_ABONO_PEC1_DSP,P78_VINCULO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
end;
/
begin
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329823842163718573)
,p_name=>'Valida Campos em Branco'
,p_event_sequence=>678
,p_triggering_element_type=>'BUTTON'
,p_triggering_button_id=>wwv_flow_api.id(276329683628271718456)
,p_bind_type=>'bind'
,p_bind_event_type=>'focusin'
,p_display_when_type=>'NEVER'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329824330528718574)
,p_event_id=>wwv_flow_api.id(276329823842163718573)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_JAVASCRIPT_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if ($v(''P78_DT_SAIDA_PARC1'').length == 0 && $v(''P78_DT_SAIDA_PARC1_1'').length == 0 && $x(''P78_PARCELAS_OPC'').value == 1 ){',
'    ',
'    if ($v(''P78_DT_SAIDA_PARC1'').length == 0 ||',
'        $v(''P78_DT_SAIDA_PARC1_1'').length == 0 ||',
'        $v(''P78_NUM_DIAS_PARC1'').length == 0 ||',
'        $v(''P78_NUM_DIAS_PARC1_1'').length == 0',
'       ){',
'    ',
unistr('    alert(''Campos em Branco na 1\00AA Parcela!'');'),
'    $x(''P78_ok'').value = ''N'';',
'    ',
'    }',
'    ',
'}',
'',
'if ($v(''P78_DT_SAIDA_PARC2'').length == 0 && $v(''P78_DT_SAIDA_PARC2_1'').length == 0 && $x(''P78_PARCELAS_OPC'').value == 2 ){',
'    ',
'    if ($v(''P78_DT_SAIDA_PARC1'').length == 0 &&',
'        $v(''P78_DT_SAIDA_PARC1_1'').length == 0 &&',
'        $v(''P78_NUM_DIAS_PARC1'').length == 0 &&',
'        $v(''P78_NUM_DIAS_PARC1_1'').length == 0',
'       ){',
'    ',
unistr('    alert(''Campos em Branco na 1\00AA Parcela!'');'),
'    $x(''P78_ok'').value = ''N'';',
'    ',
'    }',
'    ',
'    if ($v(''P78_DT_SAIDA_PARC2'').length == 0 &&',
'        $v(''P78_DT_SAIDA_PARC2_1'').length == 0 &&',
'        $v(''P78_NUM_DIAS_PARC2'').length == 0 &&',
'        $v(''P78_NUM_DIAS_PARC2_1'').length == 0',
'       ){',
'    ',
unistr('    alert(''Campos em Branco na 2\00AA Parcela!'');'),
'    $x(''P78_ok'').value = ''N'';',
'    ',
'    }',
'    ',
'}',
'',
'if ($v(''P78_DT_SAIDA_PARC4'').length == 0 && $v(''P78_DT_SAIDA_PARC4_1'').length == 0 && $x(''P78_PARCELAS_OPC'').value == 3 ){',
'    ',
'    if ($v(''P78_DT_SAIDA_PARC1'').length == 0 &&',
'        $v(''P78_DT_SAIDA_PARC1_1'').length == 0 &&',
'        $v(''P78_NUM_DIAS_PARC1'').length == 0 &&',
'        $v(''P78_NUM_DIAS_PARC1_1'').length == 0',
'       ){',
'    ',
unistr('    alert(''Campos em Branco na 1\00AA Parcela!'');'),
'    $x(''P78_ok'').value = ''N'';',
'    ',
'    }',
'    ',
'    if ($v(''P78_DT_SAIDA_PARC2'').length == 0 &&',
'        $v(''P78_DT_SAIDA_PARC2_1'').length == 0 &&',
'        $v(''P78_NUM_DIAS_PARC2'').length == 0 &&',
'        $v(''P78_NUM_DIAS_PARC2_1'').length == 0',
'       ){',
'    ',
unistr('    alert(''Campos em Branco na 2\00AA Parcela!'');'),
'    $x(''P78_ok'').value = ''N'';',
'    ',
'    }    ',
'    ',
'    if ($v(''P78_DT_SAIDA_PARC4'').length == 0 &&',
'        $v(''P78_DT_SAIDA_PARC4_1'').length == 0 &&',
'        $v(''P78_NUM_DIAS_PARC4'').length == 0 &&',
'        $v(''P78_NUM_DIAS_PARC4_1'').length == 0',
'       ){',
'    ',
unistr('    alert(''Campos em Branco na 3\00AA Parcela!'');'),
'    $x(''P78_ok'').value = ''N'';',
'    ',
'    }',
'    ',
'}',
'',
'if ($v(''P78_DT_SAIDA_PARC1'').length != 0 && $v(''P78_DT_SAIDA_PARC1_1'').length == 0 ){',
'    ',
'    if ($v(''P78_NUM_DIAS_PARC1'').length == 0 ',
'       ){',
'    ',
unistr('    alert(''Preencha o n\00FAmero de dias da 1\00AA Parcela!'');'),
'    $x(''P78_ok'').value = ''N'';',
'    ',
'    }',
'    ',
'}',
'',
'if ($v(''P78_DT_SAIDA_PARC2'').length != 0 && $v(''P78_DT_SAIDA_PARC2_1'').length == 0 ){',
'    ',
'    if ($v(''P78_NUM_DIAS_PARC2'').length == 0 ',
'       ){',
'    ',
unistr('    alert(''Preencha o n\00FAmero de dias da 2\00AA Parcela!'');'),
'    $x(''P78_ok'').value = ''N'';',
'    ',
'    }',
'    ',
'}',
'',
'if ($v(''P78_DT_SAIDA_PARC4'').length != 0 && $v(''P78_DT_SAIDA_PARC4_1'').length == 0 ){',
'    ',
'    if ($v(''P78_NUM_DIAS_PARC4'').length == 0 ',
'       ){',
'    ',
unistr('    alert(''Preencha o n\00FAmero de dias da 3\00AA Parcela!'');'),
'    $x(''P78_ok'').value = ''N'';',
'    ',
'    }',
'    ',
'}'))
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(266539451101615476046)
,p_event_id=>wwv_flow_api.id(276329823842163718573)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_SET_FOCUS'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_OPCAO_FERIAS'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329824726138718574)
,p_name=>'PRE-INSERT'
,p_event_sequence=>688
,p_triggering_element_type=>'BUTTON'
,p_triggering_button_id=>wwv_flow_api.id(276329683628271718456)
,p_bind_type=>'bind'
,p_bind_event_type=>'focusin'
,p_display_when_type=>'NEVER'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329825309964718574)
,p_event_id=>wwv_flow_api.id(276329824726138718574)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_dias_abono_pec1 number := :P78_dias_abono_pec1;',
'',
'v_seq number;',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'begin',
'',
'v_item_validacao := null;',
':P78_ITEM_VALIDACAO := null;',
'',
'/*PKG_FERIAS.Pre_Insert( :p78_cod_solicitacao,',
'                       :p78_cod_empresa,',
'                       :p78_filial,',
'                       :p78_matricula,',
'                       :p78_sit_requisicao,',
'                       :p78_ind_situacao_periodo,',
'                       :p78_dt_inic_per_ferias,',
'                       :p78_dt_fim_per_ferias,',
'                       :p78_num_dias_parc1,',
'                       :p78_saldo,',
'                       :p78_dt_saida_parc1,',
'                       :p78_dt_saida_parc2,',
'                       :p78_dt_saida_parc3,',
'                       :p78_dt_saida_parc4,',
'                       :p78_dt_retorno_parc1,',
'                       :p78_dt_retorno_parc2,',
'                       :p78_dt_retorno_parc3,',
'                       :p78_dt_retorno_parc4,',
'                       :p78_dias_abono_pec1,',
'                       :p78_jornada_reduzida,',
'                       v_flg_retorno,',
'                       v_msg_retorno);*/',
' ',
' ',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_create1''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_create1'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
' ',
'end;'))
,p_attribute_02=>'P78_COD_SOLICITACAO,P78_COD_EMPRESA,P78_FILIAL,P78_MATRICULA,P78_SIT_REQUISICAO,P78_IND_SITUACAO_PERIODO,P78_DT_INIC_PER_FERIAS,P78_DT_FIM_PER_FERIAS,P78_NUM_DIAS_PARC1,P78_SALDO,P78_DT_SAIDA_PARC1,P78_DT_SAIDA_PARC2,P78_DT_SAIDA_PARC3,P78_DT_SAIDA_P'
||'ARC4,P78_DT_RETORNO_PARC1,P78_DT_RETORNO_PARC2,P78_DT_RETORNO_PARC3,P78_DT_RETORNO_PARC4,P78_DIAS_ABONO_PEC1,P78_JORNADA_REDUZIDA,P78_ITEM_VALIDACAO,P78_OK,P78_FLAG,P78_MENSAGEM'
,p_attribute_03=>'P78_FLAG,P78_MENSAGEM,P78_OK,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329825654718718574)
,p_name=>'VALIDA_UPDATE_RF'
,p_event_sequence=>698
,p_triggering_element_type=>'BUTTON'
,p_triggering_button_id=>wwv_flow_api.id(276329683628271718456)
,p_bind_type=>'bind'
,p_bind_event_type=>'focusin'
,p_display_when_type=>'NEVER'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329826171332718575)
,p_event_id=>wwv_flow_api.id(276329825654718718574)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_dias_abono_pec1 number := :P78_dias_abono_pec1;',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'begin',
'',
'v_item_validacao := null;',
':P78_ITEM_VALIDACAO := null;',
'',
'PKG_FERIAS.Valida_Update_Rf(:P78_cod_empresa,',
'                            :P78_filial,',
'                            :P78_dt_saida_parc1,',
'                            :P78_dt_fim_per_ferias,',
'                            :P78_num_dias_parc1,',
'                            v_dias_abono_pec1,',
'                            :P78_saldo,',
'                            :p78_matricula,',
'                            :p78_jornada_reduzida,',
'                            V_flg_retorno,',
'                            V_msg_retorno);',
'',
' ',
' ',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_save1''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_save1'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
' ',
'end;'))
,p_attribute_02=>'P78_DIAS_ABONO_PEC1,P78_ITEM_VALIDACAO,P_EMPRESA_USER,P_MATRICULA_USER,P78_USUARIO,P78_COD_SOLICITACAO,P78_COD_EMPRESA,P78_FILIAL,P78_MATRICULA,P78_SIT_REQUISICAO,P78_IND_SITUACAO_PERIODO,P78_DT_INIC_PER_FERIAS,P78_DT_FIM_PER_FERIAS,P78_NUM_DIAS_PARC'
||'1,P78_SALDO,P78_DT_SAIDA_PARC1,P78_DT_SAIDA_PARC2,P78_DT_SAIDA_PARC3,P78_JORNADA_REDUZIDA'
,p_attribute_03=>'P78_FLAG,P78_MENSAGEM,P78_OK,P78_ITEM_VALIDACAO,P78_SIT_REQUISICAO,P78_COD_SOLICITACAO,P78_DT_SOLICITACAO,P78_DT_ATUALIZACAO_PROG,P78_USUARIO_PROG,P78_COD_EMP_SOLICITANTE,P78_MATRICULA_SOLICITANTE,P78_USUARIO,P78_DT_ATUALIZACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329827456888718576)
,p_name=>'Habilitar Campos (Save)'
,p_event_sequence=>708
,p_triggering_element_type=>'BUTTON'
,p_triggering_button_id=>wwv_flow_api.id(276329683628271718456)
,p_bind_type=>'bind'
,p_bind_event_type=>'click'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329827944754718576)
,p_event_id=>wwv_flow_api.id(276329827456888718576)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_JAVASCRIPT_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'$x(''P78_NUM_DIAS_PARC1'').disabled = false;',
'$x(''P78_DIAS_ABONO_PEC1'').disabled = false;',
'$x(''P78_NUM_DIAS_PARC1_1'').disabled = false;',
'$x(''P78_DIAS_ABONO_PEC1_1'').disabled = false;',
'',
'$x(''P78_DT_RETORNO_PARC1'').disabled = false;',
'$x(''P78_DT_RETORNO_PARC2'').disabled = false;',
'$x(''P78_DT_RETORNO_PARC4'').disabled = false;',
'',
'$x(''P78_DT_SAIDA_PARC1_1'').disabled = false;',
'$x(''P78_DT_SAIDA_PARC2_1'').disabled = false;',
'$x(''P78_DT_SAIDA_PARC4_1'').disabled = false;'))
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329828480170718576)
,p_event_id=>wwv_flow_api.id(276329827456888718576)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_ENABLE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_DT_SAIDA_PARC1,P78_NUM_DIAS_PARC1,P78_DIAS_ABONO_PEC1,P78_OPCAO_13SAL1,P78_DESC_ADICIONAL1,P78_DT_RETORNO_PARC1,P78_DT_PAGTO_PARC1,P78_TIPO_FERIAS1,P78_OPCAO_ABONO_PEC1,P78_DT_RETORNO_PARC2,P78_DT_RETORNO_PARC4,P78_DT_SAIDA_PARC4,P78_DT_SAIDA_PAR'
||'C1_1,P78_DT_SAIDA_PARC2_1,P78_DT_SAIDA_PARC4_1'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(152825790486792554930)
,p_event_id=>wwv_flow_api.id(276329827456888718576)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>':P78_DT_RETORNO_PARC1_1A := :P78_DT_RETORNO_PARC1_1;'
,p_attribute_02=>'P78_DT_RETORNO_PARC1_1'
,p_attribute_03=>'P78_DT_RETORNO_PARC1_1A'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(264586863251866818559)
,p_event_id=>wwv_flow_api.id(276329827456888718576)
,p_event_result=>'TRUE'
,p_action_sequence=>40
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_SUBMIT_PAGE'
,p_attribute_01=>'P78_CREATE'
,p_attribute_02=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329828872271718576)
,p_name=>'Hab/Desab num_dias_parc1'
,p_event_sequence=>718
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_NUM_DIAS_PARC1_DSP'
,p_condition_element=>'P78_NUM_DIAS_PARC1_DSP'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329829417569718577)
,p_event_id=>wwv_flow_api.id(276329828872271718576)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_JAVASCRIPT_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if ($x(''P78_NUM_DIAS_PARC1_DSP'').value == ''S'') {',
'    ',
'          $x(''P78_NUM_DIAS_PARC1'').disabled = false;',
'          $x(''P78_NUM_DIAS_PARC1_1'').disabled = false; ',
'',
'}else{',
'',
'          $x(''P78_NUM_DIAS_PARC1'').disabled = true;',
'          $x(''P78_NUM_DIAS_PARC1_1'').disabled = true;',
'',
'}'))
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329829738026718577)
,p_name=>'Hab/Desab dias_abono_pec1'
,p_event_sequence=>728
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DIAS_ABONO_PEC1_DSP'
,p_condition_element=>'P78_DIAS_ABONO_PEC1_DSP'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329830319420718577)
,p_event_id=>wwv_flow_api.id(276329829738026718577)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_JAVASCRIPT_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if ($x(''P78_DIAS_ABONO_PEC1_DSP'').value == ''S'') {',
'',
'          $x(''P78_DIAS_ABONO_PEC1'').disabled = false;',
'          $x(''P78_DIAS_ABONO_PEC1_1'').disabled = false; ',
'',
'}else{',
'',
'          $x(''P78_DIAS_ABONO_PEC1'').disabled = true;',
'          $x(''P78_DIAS_ABONO_PEC1_1'').disabled = true;',
'',
'}'))
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(239790693431056698903)
,p_name=>'POPULA TESTE2'
,p_event_sequence=>738
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_RETORNO_PARC1'
,p_condition_element=>'P78_DT_RETORNO_PARC1'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(239790693481249698904)
,p_event_id=>wwv_flow_api.id(239790693431056698903)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SET_VALUE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_TESTE_2'
,p_attribute_01=>'FUNCTION_BODY'
,p_attribute_06=>'RETURN(:P78_DT_RETORNO_PARC1);'
,p_attribute_07=>'P78_DT_RETORNO_PARC1'
,p_attribute_08=>'Y'
,p_attribute_09=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329830688636718577)
,p_name=>'Seta P78_DT_RETORNO_PARC1'
,p_event_sequence=>748
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_RETORNO_PARC1'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(239790693164967698901)
,p_event_id=>wwv_flow_api.id(276329830688636718577)
,p_event_result=>'TRUE'
,p_action_sequence=>19
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SET_VALUE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_TESTE'
,p_attribute_01=>'FUNCTION_BODY'
,p_attribute_06=>'RETURN(:P78_TESTE||'',(B) P78_DT_RETORNO_PARC1_X: ''||:P78_DT_RETORNO_PARC1_X);'
,p_attribute_07=>'P78_TESTE,P78_DT_RETORNO_PARC1_X'
,p_attribute_08=>'Y'
,p_attribute_09=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329831149917718578)
,p_event_id=>wwv_flow_api.id(276329830688636718577)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_JAVASCRIPT_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if ($x(''P78_DT_RETORNO_PARC1_X'').value.length > 0 ) {',
'$x(''P78_DT_RETORNO_PARC1'').value = $x(''P78_DT_RETORNO_PARC1_X'').value;',
'}'))
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329831581054718578)
,p_name=>'Hide Empresa Matricula'
,p_event_sequence=>758
,p_bind_type=>'bind'
,p_bind_event_type=>'ready'
,p_display_when_type=>'ITEM_IS_NOT_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329832077786718578)
,p_event_id=>wwv_flow_api.id(276329831581054718578)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_COD_EMPRESA,P78_MATRICULA'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329832491564718578)
,p_name=>'(Pesquisa) Hide Empresa Matricula'
,p_event_sequence=>768
,p_condition_element=>'P78_COD_SOLICITACAO'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'ready'
,p_display_when_type=>'ITEM_IS_NOT_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329832939344718579)
,p_event_id=>wwv_flow_api.id(276329832491564718578)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_COD_EMPRESA,P78_MATRICULA'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329833323902718579)
,p_name=>'Disable Fields Consult'
,p_event_sequence=>778
,p_bind_type=>'bind'
,p_bind_event_type=>'ready'
,p_display_when_type=>'ITEM_IS_NOT_NULL'
,p_display_when_cond=>'P78_COD_SOLICITACAO'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329833909366718579)
,p_event_id=>wwv_flow_api.id(276329833323902718579)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_JAVASCRIPT_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'$(''#PARCELA1 *'').prop(''disabled'',true);',
'$(''#2_PARCELA1 *'').prop(''disabled'',true);',
'$(''#PARCELA2 *'').prop(''disabled'',true);',
'$(''#2_PARCELA2 *'').prop(''disabled'',true);',
'$(''#PARCELA3 *'').prop(''disabled'',true);',
'$(''#2_PARCELA3 *'').prop(''disabled'',true);',
'$(''#PARCELA_COL *'').prop(''disabled'',true);',
'$(''#OPCAO *'').prop(''disabled'',true);'))
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329834226113718579)
,p_name=>'Mostrar Parcela 1'
,p_event_sequence=>788
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_QTD_PARCELAS'
,p_condition_element=>'P78_QTD_PARCELAS'
,p_triggering_condition_type=>'EQUALS'
,p_triggering_expression=>'1'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if nvl(:p78_ok,''S'') = ''S'' then',
'return true;',
'else',
'return false;',
'end if;'))
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329834776335718581)
,p_event_id=>wwv_flow_api.id(276329834226113718579)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694832970995432555)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329835244554718581)
,p_event_id=>wwv_flow_api.id(276329834226113718579)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694838117800432559)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329835744289718582)
,p_event_id=>wwv_flow_api.id(276329834226113718579)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276559150703399823134)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329836200335718582)
,p_name=>'Mostrar Parcela 2'
,p_event_sequence=>798
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_QTD_PARCELAS'
,p_condition_element=>'P78_QTD_PARCELAS'
,p_triggering_condition_type=>'EQUALS'
,p_triggering_expression=>'2'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if nvl(:p78_ok,''S'') = ''S'' then',
'return true;',
'else',
'return false;',
'end if;'))
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329836654232718582)
,p_event_id=>wwv_flow_api.id(276329836200335718582)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694847727728432570)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329837147453718583)
,p_event_id=>wwv_flow_api.id(276329836200335718582)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694838117800432559)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329837687511718583)
,p_event_id=>wwv_flow_api.id(276329836200335718582)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276559150703399823134)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329838020390718583)
,p_name=>'Mostrar Parcela 3'
,p_event_sequence=>808
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_QTD_PARCELAS'
,p_condition_element=>'P78_QTD_PARCELAS'
,p_triggering_condition_type=>'EQUALS'
,p_triggering_expression=>'3'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if nvl(:p78_ok,''S'') = ''S'' then',
'return true;',
'else',
'return false;',
'end if;'))
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329838615140718584)
,p_event_id=>wwv_flow_api.id(276329838020390718583)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694847727728432570)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329839097075718584)
,p_event_id=>wwv_flow_api.id(276329838020390718583)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694838117800432559)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329839588054718584)
,p_event_id=>wwv_flow_api.id(276329838020390718583)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276559150703399823134)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329839921049718584)
,p_name=>unistr('Hide Data Atualiza\00E7\00E3o')
,p_event_sequence=>818
,p_bind_type=>'bind'
,p_bind_event_type=>'ready'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329840465618718585)
,p_event_id=>wwv_flow_api.id(276329839921049718584)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_DT_ATUALIZACAO_PROG'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329840835382718585)
,p_name=>'Hide Aprov Sit <> 1'
,p_event_sequence=>828
,p_bind_type=>'bind'
,p_bind_event_type=>'ready'
,p_display_when_type=>'VAL_OF_ITEM_IN_COND_NOT_EQ_COND2'
,p_display_when_cond=>'P78_SIT_REQUISICAO'
,p_display_when_cond2=>'1'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329841337233718585)
,p_event_id=>wwv_flow_api.id(276329840835382718585)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'BUTTON'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329842225572718586)
,p_name=>'Valida Dias Direito < Dias Informados'
,p_event_sequence=>838
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_NUM_DIAS_PARC1,P78_NUM_DIAS_PARC2,P78_NUM_DIAS_PARC4,P78_DIAS_ABONO_PEC1,P78_DIAS_ABONO_PEC2,P78_DIAS_ABONO_PEC4'
,p_condition_element=>'P78_COD_SOLICITACAO'
,p_triggering_condition_type=>'NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return :P78_FLAG_CTRL is null;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(173363199793418845072)
,p_event_id=>wwv_flow_api.id(276329842225572718586)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'dt_saida_parc1 date := :p78_dt_saida_parc1; --nvl(:p78_dt_saida_parc1,:p78_dt_saida_parc1_1);',
'dt_saida_parc2 date := :p78_dt_saida_parc2; --nvl(:p78_dt_saida_parc2,:p78_dt_saida_parc2_1);',
'dt_saida_parc4 date := :p78_dt_saida_parc4; --nvl(:p78_dt_saida_parc4,:p78_dt_saida_parc4_1);',
'',
'num_dias_parc1 number := nvl(:P78_num_dias_parc1,:P78_num_dias_parc1_1);',
'num_dias_parc2 number := nvl(:P78_num_dias_parc2,:P78_num_dias_parc2_1);',
'num_dias_parc4 number := nvl(:P78_num_dias_parc4,:P78_num_dias_parc4_1);',
'',
'dias_abono_pec1 number := nvl(:P78_dias_abono_pec1,:P78_dias_abono_pec1_1);',
'dias_abono_pec2 number := nvl(:P78_dias_abono_pec2,:P78_dias_abono_pec2_1);',
'dias_abono_pec4 number := nvl(:P78_dias_abono_pec4,:P78_dias_abono_pec4_1);',
'',
'dias_direito number := :P78_dias_direito;',
'',
'begin',
'  IF :P78_DT_SAIDA_PARC1 < sysdate then',
'    return;',
'  end if;',
'',
' if nvl(dias_direito,0) < (nvl(num_dias_parc1,0) + nvl(dias_abono_pec1,0)) and dt_saida_parc1 is not null and dt_saida_parc2 is null and dt_saida_parc4 is null then',
'    v_flg_retorno := ''N'';',
unistr('    v_msg_retorno := ''A soma dos dias da parcelas 1 est\00E1 superior aos dias de direito de ''||dias_direito||'' dias. Informe uma quantidade diferente.'';'),
' elsif nvl(dias_direito,0) < (nvl(num_dias_parc1,0) + nvl(dias_abono_pec1,0) + nvl(num_dias_parc2,0) + nvl(dias_abono_pec2,0)) and dt_saida_parc1 is not null and dt_saida_parc2 is not null then',
'    v_flg_retorno := ''N'';',
unistr('    v_msg_retorno := ''A soma dos dias das parcelas 1 e 2, est\00E1 superior aos dias de direito de ''||dias_direito||'' dias. Informe uma quantidade diferente.'';'),
' elsif nvl(dias_direito,0) < (nvl(num_dias_parc1,0) + nvl(dias_abono_pec1,0) + nvl(num_dias_parc2,0) + nvl(dias_abono_pec2,0) + nvl(num_dias_parc4,0) + nvl(dias_abono_pec4,0)) and dt_saida_parc1 is not null and dt_saida_parc2 is not null and dt_saida'
||'_parc4 is not null then',
'    v_flg_retorno := ''N'';',
unistr('    v_msg_retorno := ''A soma dos dias das parcelas 1, 2 e 3, est\00E1 superior aos dias de direito de ''||dias_direito||'' dias. Informe uma quantidade diferente.'';'),
' end if;',
' ',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''P78_num_dias_parc2''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    ',
'    if v_item_validacao = TRIM(UPPER(''P78_num_dias_parc2'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
'    ',
' end if;',
' ',
'end;'))
,p_attribute_02=>'P78_NUM_DIAS_PARC1,P78_NUM_DIAS_PARC2,P78_NUM_DIAS_PARC4,P78_DIAS_DIREITO,P78_DT_SAIDA_PARC1,P78_DT_SAIDA_PARC2,P78_DT_SAIDA_PARC4,P78_QTD_PARCELAS,P78_DIAS_ABONO_PEC1,P78_DIAS_ABONO_PEC2,P78_DIAS_ABONO_PEC4,P78_DT_SAIDA_PARC1,P78_DT_SAIDA_PARC1_1,P7'
||'8_NUM_DIAS_PARC1_1,P78_DIAS_ABONO_PEC1_1,P78_DT_SAIDA_PARC2,P78_DT_SAIDA_PARC2_1,P78_NUM_DIAS_PARC2_1,P78_DIAS_ABONO_PEC2_1,P78_DT_SAIDA_PARC4,P78_DT_SAIDA_PARC4_1,P78_NUM_DIAS_PARC4_1,P78_DIAS_ABONO_PEC4_1'
,p_attribute_03=>'P78_OK,P78_FLAG,P78_MENSAGEM,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(173363199692976845071)
,p_name=>'Valida Dias Direito < Dias Informados_1'
,p_event_sequence=>848
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_NUM_DIAS_PARC1,P78_NUM_DIAS_PARC2,P78_NUM_DIAS_PARC4,P78_DIAS_ABONO_PEC1,P78_DIAS_ABONO_PEC2,P78_DIAS_ABONO_PEC4'
,p_condition_element=>'P78_COD_SOLICITACAO'
,p_triggering_condition_type=>'NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return nvl(:P78_FLAG_CTRL,0) = 1;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329842741619718586)
,p_event_id=>wwv_flow_api.id(173363199692976845071)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'dt_saida_parc1 date := :p78_dt_saida_parc1; --nvl(:p78_dt_saida_parc1,:p78_dt_saida_parc1_1);',
'dt_saida_parc2 date := :p78_dt_saida_parc2; --nvl(:p78_dt_saida_parc2,:p78_dt_saida_parc2_1);',
'dt_saida_parc4 date := :p78_dt_saida_parc4; --nvl(:p78_dt_saida_parc4,:p78_dt_saida_parc4_1);',
'',
'num_dias_parc1 number := nvl(:P78_num_dias_parc1,:P78_num_dias_parc1_1);',
'num_dias_parc2 number := nvl(:P78_num_dias_parc2,:P78_num_dias_parc2_1);',
'num_dias_parc4 number := nvl(:P78_num_dias_parc4,:P78_num_dias_parc4_1);',
'',
'dias_abono_pec1 number := nvl(:P78_dias_abono_pec1,:P78_dias_abono_pec1_1);',
'dias_abono_pec2 number := nvl(:P78_dias_abono_pec2,:P78_dias_abono_pec2_1);',
'dias_abono_pec4 number := nvl(:P78_dias_abono_pec4,:P78_dias_abono_pec4_1);',
'',
'dias_direito number := :P78_dias_direito_1;',
'',
'begin',
'  IF :P78_DT_SAIDA_PARC1 < sysdate then',
'    return;',
'  end if;',
'',
' if nvl(dias_direito,0) < (nvl(num_dias_parc1,0) + nvl(dias_abono_pec1,0)) and dt_saida_parc1 is not null and dt_saida_parc2 is null and dt_saida_parc4 is null then',
'    v_flg_retorno := ''N'';',
unistr('    v_msg_retorno := ''A soma dos dias da parcelas 1 est\00E1 superior aos dias de direito de ''||dias_direito||'' dias. Informe uma quantidade diferente.'';'),
' elsif nvl(dias_direito,0) < (nvl(num_dias_parc1,0) + nvl(dias_abono_pec1,0) + nvl(num_dias_parc2,0) + nvl(dias_abono_pec2,0)) and dt_saida_parc1 is not null and dt_saida_parc2 is not null then',
'    v_flg_retorno := ''N'';',
unistr('    v_msg_retorno := ''A soma dos dias das parcelas 1 e 2, est\00E1 superior aos dias de direito de ''||dias_direito||'' dias. Informe uma quantidade diferente.'';'),
' elsif nvl(dias_direito,0) < (nvl(num_dias_parc1,0) + nvl(dias_abono_pec1,0) + nvl(num_dias_parc2,0) + nvl(dias_abono_pec2,0) + nvl(num_dias_parc4,0) + nvl(dias_abono_pec4,0)) and dt_saida_parc1 is not null and dt_saida_parc2 is not null and dt_saida'
||'_parc4 is not null then',
'    v_flg_retorno := ''N'';',
unistr('    v_msg_retorno := ''A soma dos dias das parcelas 1, 2 e 3, est\00E1 superior aos dias de direito de ''||dias_direito||'' dias. Informe uma quantidade diferente.'';'),
' end if;',
' ',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''P78_num_dias_parc2''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    ',
'    if v_item_validacao = TRIM(UPPER(''P78_num_dias_parc2'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
'    ',
' end if;',
' ',
'end;'))
,p_attribute_02=>'P78_NUM_DIAS_PARC1,P78_NUM_DIAS_PARC2,P78_NUM_DIAS_PARC4,P78_DIAS_DIREITO_1,P78_DT_SAIDA_PARC1,P78_DT_SAIDA_PARC2,P78_DT_SAIDA_PARC4,P78_QTD_PARCELAS,P78_DIAS_ABONO_PEC1,P78_DIAS_ABONO_PEC2,P78_DIAS_ABONO_PEC4,P78_DT_SAIDA_PARC1,P78_DT_SAIDA_PARC1_1,'
||'P78_NUM_DIAS_PARC1_1,P78_DIAS_ABONO_PEC1_1,P78_DT_SAIDA_PARC2,P78_DT_SAIDA_PARC2_1,P78_NUM_DIAS_PARC2_1,P78_DIAS_ABONO_PEC2_1,P78_DT_SAIDA_PARC4,P78_DT_SAIDA_PARC4_1,P78_NUM_DIAS_PARC4_1,P78_DIAS_ABONO_PEC4_1'
,p_attribute_03=>'P78_OK,P78_FLAG,P78_MENSAGEM,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
end;
/
begin
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(239790693011732698899)
,p_name=>'Valida Dias Direito < Dias Informados_LST'
,p_event_sequence=>858
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_NUM_DIAS_PARC1_LST'
,p_condition_element=>'P78_COD_SOLICITACAO'
,p_triggering_condition_type=>'NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return :P78_FLAG_CTRL is null;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(239790693091325698900)
,p_event_id=>wwv_flow_api.id(239790693011732698899)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'dt_saida_parc1 date := :p78_dt_saida_parc1; --nvl(:p78_dt_saida_parc1,:p78_dt_saida_parc1_1);',
'dt_saida_parc2 date := :p78_dt_saida_parc2; --nvl(:p78_dt_saida_parc2,:p78_dt_saida_parc2_1);',
'dt_saida_parc4 date := :p78_dt_saida_parc4; --nvl(:p78_dt_saida_parc4,:p78_dt_saida_parc4_1);',
'',
'num_dias_parc1 number := nvl(:P78_num_dias_parc1,:P78_num_dias_parc1_1);',
'num_dias_parc2 number := nvl(:P78_num_dias_parc2,:P78_num_dias_parc2_1);',
'num_dias_parc4 number := nvl(:P78_num_dias_parc4,:P78_num_dias_parc4_1);',
'',
'dias_abono_pec1 number := nvl(:P78_dias_abono_pec1,:P78_dias_abono_pec1_1);',
'dias_abono_pec2 number := nvl(:P78_dias_abono_pec2,:P78_dias_abono_pec2_1);',
'dias_abono_pec4 number := nvl(:P78_dias_abono_pec4,:P78_dias_abono_pec4_1);',
'',
'dias_direito number := :P78_dias_direito;',
'',
'begin',
'  IF :P78_DT_SAIDA_PARC1 < sysdate then',
'    return;',
'  end if;',
'',
' if nvl(dias_direito,0) < (nvl(num_dias_parc1,0) + nvl(dias_abono_pec1,0)) and dt_saida_parc1 is not null and dt_saida_parc2 is null and dt_saida_parc4 is null then',
'    v_flg_retorno := ''N'';',
unistr('    v_msg_retorno := ''A soma dos dias da parcelas 1 est\00E1 superior aos dias de direito de ''||dias_direito||'' dias. Informe uma quantidade diferente.'';'),
' elsif nvl(dias_direito,0) < (nvl(num_dias_parc1,0) + nvl(dias_abono_pec1,0) + nvl(num_dias_parc2,0) + nvl(dias_abono_pec2,0)) and dt_saida_parc1 is not null and dt_saida_parc2 is not null then',
'    v_flg_retorno := ''N'';',
unistr('    v_msg_retorno := ''A soma dos dias das parcelas 1 e 2, est\00E1 superior aos dias de direito de ''||dias_direito||'' dias. Informe uma quantidade diferente.'';'),
' elsif nvl(dias_direito,0) < (nvl(num_dias_parc1,0) + nvl(dias_abono_pec1,0) + nvl(num_dias_parc2,0) + nvl(dias_abono_pec2,0) + nvl(num_dias_parc4,0) + nvl(dias_abono_pec4,0)) and dt_saida_parc1 is not null and dt_saida_parc2 is not null and dt_saida'
||'_parc4 is not null then',
'    v_flg_retorno := ''N'';',
unistr('    v_msg_retorno := ''A soma dos dias das parcelas 1, 2 e 3, est\00E1 superior aos dias de direito de ''||dias_direito||'' dias. Informe uma quantidade diferente.'';'),
' end if;',
' ',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''P78_num_dias_parc2''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    ',
'    if v_item_validacao = TRIM(UPPER(''P78_num_dias_parc2'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
'    ',
' end if;',
' ',
'end;'))
,p_attribute_02=>'P78_NUM_DIAS_PARC1,P78_NUM_DIAS_PARC2,P78_NUM_DIAS_PARC4,P78_DIAS_DIREITO,P78_DT_SAIDA_PARC1,P78_DT_SAIDA_PARC2,P78_DT_SAIDA_PARC4,P78_QTD_PARCELAS,P78_DIAS_ABONO_PEC1,P78_DIAS_ABONO_PEC2,P78_DIAS_ABONO_PEC4,P78_DT_SAIDA_PARC1,P78_DT_SAIDA_PARC1_1,P7'
||'8_NUM_DIAS_PARC1_1,P78_DIAS_ABONO_PEC1_1,P78_DT_SAIDA_PARC2,P78_DT_SAIDA_PARC2_1,P78_NUM_DIAS_PARC2_1,P78_DIAS_ABONO_PEC2_1,P78_DT_SAIDA_PARC4,P78_DT_SAIDA_PARC4_1,P78_NUM_DIAS_PARC4_1,P78_DIAS_ABONO_PEC4_1'
,p_attribute_03=>'P78_OK,P78_FLAG,P78_MENSAGEM,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(173363803193749608723)
,p_name=>'Valida Dias Direito < Dias Informados_LST_1'
,p_event_sequence=>868
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_NUM_DIAS_PARC1_LST'
,p_condition_element=>'P78_COD_SOLICITACAO'
,p_triggering_condition_type=>'NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return nvl(:P78_FLAG_CTRL,0) = 1;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(173363803291370608724)
,p_event_id=>wwv_flow_api.id(173363803193749608723)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'dt_saida_parc1 date := :p78_dt_saida_parc1; --nvl(:p78_dt_saida_parc1,:p78_dt_saida_parc1_1);',
'dt_saida_parc2 date := :p78_dt_saida_parc2; --nvl(:p78_dt_saida_parc2,:p78_dt_saida_parc2_1);',
'dt_saida_parc4 date := :p78_dt_saida_parc4; --nvl(:p78_dt_saida_parc4,:p78_dt_saida_parc4_1);',
'',
'num_dias_parc1 number := nvl(:P78_num_dias_parc1,:P78_num_dias_parc1_1);',
'num_dias_parc2 number := nvl(:P78_num_dias_parc2,:P78_num_dias_parc2_1);',
'num_dias_parc4 number := nvl(:P78_num_dias_parc4,:P78_num_dias_parc4_1);',
'',
'dias_abono_pec1 number := nvl(:P78_dias_abono_pec1,:P78_dias_abono_pec1_1);',
'dias_abono_pec2 number := nvl(:P78_dias_abono_pec2,:P78_dias_abono_pec2_1);',
'dias_abono_pec4 number := nvl(:P78_dias_abono_pec4,:P78_dias_abono_pec4_1);',
'',
'dias_direito number := :P78_dias_direito_1;',
'',
'begin',
'  IF :P78_DT_SAIDA_PARC1 < sysdate then',
'    return;',
'  end if;',
'',
' if nvl(dias_direito,0) < (nvl(num_dias_parc1,0) + nvl(dias_abono_pec1,0)) and dt_saida_parc1 is not null and dt_saida_parc2 is null and dt_saida_parc4 is null then',
'    v_flg_retorno := ''N'';',
unistr('    v_msg_retorno := ''A soma dos dias da parcelas 1 est\00E1 superior aos dias de direito de ''||dias_direito||'' dias. Informe uma quantidade diferente.'';'),
' elsif nvl(dias_direito,0) < (nvl(num_dias_parc1,0) + nvl(dias_abono_pec1,0) + nvl(num_dias_parc2,0) + nvl(dias_abono_pec2,0)) and dt_saida_parc1 is not null and dt_saida_parc2 is not null then',
'    v_flg_retorno := ''N'';',
unistr('    v_msg_retorno := ''A soma dos dias das parcelas 1 e 2, est\00E1 superior aos dias de direito de ''||dias_direito||'' dias. Informe uma quantidade diferente.'';'),
' elsif nvl(dias_direito,0) < (nvl(num_dias_parc1,0) + nvl(dias_abono_pec1,0) + nvl(num_dias_parc2,0) + nvl(dias_abono_pec2,0) + nvl(num_dias_parc4,0) + nvl(dias_abono_pec4,0)) and dt_saida_parc1 is not null and dt_saida_parc2 is not null and dt_saida'
||'_parc4 is not null then',
'    v_flg_retorno := ''N'';',
unistr('    v_msg_retorno := ''A soma dos dias das parcelas 1, 2 e 3, est\00E1 superior aos dias de direito de ''||dias_direito||'' dias. Informe uma quantidade diferente.'';'),
' end if;',
' ',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''P78_num_dias_parc2''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    ',
'    if v_item_validacao = TRIM(UPPER(''P78_num_dias_parc2'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
'    ',
' end if;',
' ',
'end;'))
,p_attribute_02=>'P78_NUM_DIAS_PARC1,P78_NUM_DIAS_PARC2,P78_NUM_DIAS_PARC4,P78_DIAS_DIREITO_1,P78_DT_SAIDA_PARC1,P78_DT_SAIDA_PARC2,P78_DT_SAIDA_PARC4,P78_QTD_PARCELAS,P78_DIAS_ABONO_PEC1,P78_DIAS_ABONO_PEC2,P78_DIAS_ABONO_PEC4,P78_DT_SAIDA_PARC1,P78_DT_SAIDA_PARC1_1,'
||'P78_NUM_DIAS_PARC1_1,P78_DIAS_ABONO_PEC1_1,P78_DT_SAIDA_PARC2,P78_DT_SAIDA_PARC2_1,P78_NUM_DIAS_PARC2_1,P78_DIAS_ABONO_PEC2_1,P78_DT_SAIDA_PARC4,P78_DT_SAIDA_PARC4_1,P78_NUM_DIAS_PARC4_1,P78_DIAS_ABONO_PEC4_1'
,p_attribute_03=>'P78_OK,P78_FLAG,P78_MENSAGEM,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329843157584718586)
,p_name=>unistr('Op\00E7\00E3o de Parcelas')
,p_event_sequence=>878
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_OPCAO_PARC_SN'
,p_condition_element=>'P78_OPCAO_PARC_SN'
,p_triggering_condition_type=>'EQUALS'
,p_triggering_expression=>'S'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329846640379718588)
,p_event_id=>wwv_flow_api.id(276329843157584718586)
,p_event_result=>'FALSE'
,p_action_sequence=>30
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_NUM_DIAS_PARC1,P78_NUM_DIAS_PARC2,P78_NUM_DIAS_PARC4'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329845699197718588)
,p_event_id=>wwv_flow_api.id(276329843157584718586)
,p_event_result=>'TRUE'
,p_action_sequence=>40
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_NUM_DIAS_PARC1,P78_NUM_DIAS_PARC2,P78_NUM_DIAS_PARC4'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329847644439718589)
,p_event_id=>wwv_flow_api.id(276329843157584718586)
,p_event_result=>'FALSE'
,p_action_sequence=>40
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_DIAS_ABONO_PEC1,P78_DIAS_ABONO_PEC2,P78_DIAS_ABONO_PEC4'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329846160423718588)
,p_event_id=>wwv_flow_api.id(276329843157584718586)
,p_event_result=>'TRUE'
,p_action_sequence=>50
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_DIAS_ABONO_PEC1,P78_DIAS_ABONO_PEC2,P78_DIAS_ABONO_PEC4'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329848219366718589)
,p_event_id=>wwv_flow_api.id(276329843157584718586)
,p_event_result=>'FALSE'
,p_action_sequence=>50
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_NUM_DIAS_PARC1_LST,P78_NUM_DIAS_PARC2_LST,P78_NUM_DIAS_PARC4_LST'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276296489084716891336)
,p_event_id=>wwv_flow_api.id(276329843157584718586)
,p_event_result=>'FALSE'
,p_action_sequence=>60
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_DIAS_ABONO_PEC1_LST,P78_DIAS_ABONO_PEC2_LST,P78_DIAS_ABONO_PEC4_LST'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276296489409076891339)
,p_event_id=>wwv_flow_api.id(276329843157584718586)
,p_event_result=>'TRUE'
,p_action_sequence=>60
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_NUM_DIAS_PARC1_LST,P78_NUM_DIAS_PARC2_LST,P78_NUM_DIAS_PARC4_LST'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276296489447238891340)
,p_event_id=>wwv_flow_api.id(276329843157584718586)
,p_event_result=>'TRUE'
,p_action_sequence=>70
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_DIAS_ABONO_PEC1_LST,P78_DIAS_ABONO_PEC2_LST,P78_DIAS_ABONO_PEC4_LST'
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329848606352718589)
,p_name=>'Popula Opcao_Parc_SN'
,p_event_sequence=>888
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_MATRICULA'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329849086234718590)
,p_event_id=>wwv_flow_api.id(276329848606352718589)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'cursor c1 is',
'select distinct descricao, cod',
'  from ferias_parametros_parcelas',
' where cod_empresa = :p78_cod_empresa;',
' ',
'v_c1 c1%rowtype;',
'',
'cursor c2 is',
'select vinculo',
'  from informacoes_funcionais',
' where cod_empresa = :p78_cod_empresa',
'   and matricula = :p78_matricula;',
' ',
'v_c2 c2%rowtype;',
'',
'begin',
'',
'    open c1;',
'    fetch c1 into v_c1;',
'    close c1;',
'',
'    open c2;',
'    fetch c2 into v_c2;',
'    close c2;',
'',
'    if v_c1.cod is not null and v_c2.vinculo <> ''E'' then',
'    :p78_opcao_parc_sn := ''S'';',
'    else',
'    :p78_opcao_parc_sn := ''N'';',
'    end if;',
'',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA'
,p_attribute_03=>'P78_OPCAO_PARC_SN'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329850395637718590)
,p_name=>'Seta num_dias_parc2'
,p_event_sequence=>898
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_NUM_DIAS_PARC2_LST'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329850855128718591)
,p_event_id=>wwv_flow_api.id(276329850395637718590)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>':P78_NUM_DIAS_PARC2 := :P78_NUM_DIAS_PARC2_LST;'
,p_attribute_02=>'P78_NUM_DIAS_PARC2_LST'
,p_attribute_03=>'P78_NUM_DIAS_PARC2'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329851247723718591)
,p_name=>'Seta num_dias_parc4'
,p_event_sequence=>908
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_NUM_DIAS_PARC4_LST'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329851720642718591)
,p_event_id=>wwv_flow_api.id(276329851247723718591)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>':P78_NUM_DIAS_PARC4 := :P78_NUM_DIAS_PARC4_LST;'
,p_attribute_02=>'P78_NUM_DIAS_PARC4_LST'
,p_attribute_03=>'P78_NUM_DIAS_PARC4'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329852205842718591)
,p_name=>'Seta dias_abono_pec1'
,p_event_sequence=>918
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DIAS_ABONO_PEC1_LST'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329852679624718592)
,p_event_id=>wwv_flow_api.id(276329852205842718591)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>':p78_dias_abono_pec1 := :p78_dias_abono_pec1_lst;'
,p_attribute_02=>'P78_DIAS_ABONO_PEC1_LST'
,p_attribute_03=>'P78_DIAS_ABONO_PEC1'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329853037712718592)
,p_name=>'Seta dias_abono_pec2'
,p_event_sequence=>928
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DIAS_ABONO_PEC2_LST'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329853606543718592)
,p_event_id=>wwv_flow_api.id(276329853037712718592)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>':p78_dias_abono_pec2 := :p78_dias_abono_pec2_lst;'
,p_attribute_02=>'P78_DIAS_ABONO_PEC2_LST'
,p_attribute_03=>'P78_DIAS_ABONO_PEC2'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329854005365718592)
,p_name=>'Seta dias_abono_pec4'
,p_event_sequence=>938
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DIAS_ABONO_PEC4_LST'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329854428982718593)
,p_event_id=>wwv_flow_api.id(276329854005365718592)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>':p78_dias_abono_pec4 := :p78_dias_abono_pec4_lst;'
,p_attribute_02=>'P78_DIAS_ABONO_PEC4_LST'
,p_attribute_03=>'P78_DIAS_ABONO_PEC4'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329854890005718593)
,p_name=>'Popula PARCELAS_OPC'
,p_event_sequence=>948
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_OPCAO_FERIAS'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329855399897718593)
,p_event_id=>wwv_flow_api.id(276329854890005718593)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'cursor c1 is',
'select qtd_parcelas, DIAS_ABONO_PEC1',
'  from ferias_parametros_parcelas',
' where cod_empresa = :p78_cod_empresa',
'   and cod_filial = :p78_filial',
'   and cod = nvl(:p78_opcao_ferias,:P78_OPCAO_FERIAS_A);',
'',
'v_c1 c1%rowtype;',
'',
'begin',
' :P78_OPCAO_FERIAS_DB := :P78_OPCAO_FERIAS;',
' open c1;',
' fetch c1 into v_c1;',
' close c1;',
' :P78_PARCELAS_OPC := v_c1.qtd_parcelas;',
' :P78_DIAS_ABONO_PEC1_OPC := v_c1.DIAS_ABONO_PEC1;',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_OPCAO_FERIAS,P78_OPCAO_FERIAS_A,P78_FILIAL'
,p_attribute_03=>'P78_DIAS_ABONO_PEC1_OPC,P78_PARCELAS_OPC,P78_OPCAO_FERIAS_DB'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329855775558718593)
,p_name=>unistr('Popula regi\00E3o colaborador')
,p_event_sequence=>958
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_MATRICULA'
,p_condition_element=>'P78_MATRICULA'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329856272242718594)
,p_event_id=>wwv_flow_api.id(276329855775558718593)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'cursor c1 is',
'select i.cod_empresa||'' - ''||initcap(fnct_nome_empresa(i.cod_empresa)) empresa,',
'       i.matricula||'' - ''||initcap(fnct_nome_func(i.cod_empresa, i.matricula)) matricula,',
'       i.situacao||'' - ''||initcap(fnct_nome_situacao(i.situacao))||'' - ''||i.dt_situacao situacao,',
'       i.dt_admissao,',
'       I.FILIAL,',
'       i.dc_matricula,',
'       i.vinculo',
'  from informacoes_funcionais_cad i',
' where i.cod_empresa = :p78_cod_empresa',
'   and i.matricula = :p78_matricula;',
'                   ',
'v_c1 c1%rowtype;',
'',
'cursor c3 (v_filial number) is',
'select qtd_parcelas',
'  from ferias_Parametros',
' where cod_empresa = :P78_cod_empresa',
'   and cod_filial = v_filial;',
'   ',
'v_c3 c3%rowtype;',
'',
'cursor c is',
'  select *',
'  from   parametros_recursos_humanos',
'  where  cod_empresa = :P78_cod_empresa;',
'',
'param_rh c%rowtype;',
'prazo_limite date;',
'',
'v_dt_fim date := nvl(:P78_DT_FIM_PER_FERIAS, :P78_DT_FIM_PER_FERIAS_1); --Bruno Sousa 03/01/2024',
'',
'V_DT_LIMITE_REQ DATE;',
'',
'V_FLG VARCHAR2(1);',
'V_MSG VARCHAR2(4000);',
'begin',
'  open c;',
'  fetch c into param_rh;',
'  close c;',
'  PKG_FERIAS.VALIDA_ESTATUTARIO(:p78_cod_empresa,',
'                                :p78_matricula,',
'                                3,--P_TIPO NUMBER,',
'                                NULL,',
'                                NULL,',
'                                NULL,',
'                                v_dt_fim, --Bruno Sousa 03/01/2024',
'                                V_DT_LIMITE_REQ,',
'                                V_FLG,',
'                                V_MSG);',
'',
'   -->> MSS 20220815 (Rodrigo)',
'   IF Pkg_Ferias.fnc_VerifEstatutario(pEmpresa => :P78_COD_EMPRESA, pMatricula => :P78_MATRICULA) = ''S'' THEN',
unistr('     --:P78_DT_LIMITE_REQ := TO_DATE(''01/12/''||TO_CHAR(SYSDATE, ''RRRR''), ''DD/MM/RRRR'');   -- Alterado de 31 para 01/12/2022 Rog\00E9rio'),
unistr('     --:P78_DT_LIMITE_REQ := TO_DATE(''01/12/''||TO_CHAR(TO_DATE(:P78_DT_FIM_PER_FERIAS,''DD/MM/YYYY''), ''RRRR''), ''DD/MM/RRRR'');   -- Alterado de 31 para 01/12/2022 Rog\00E9rio'),
'     :P78_DT_LIMITE_REQ := TO_DATE(''01/12/''||TO_CHAR(v_dt_fim, ''RRRR''), ''DD/MM/RRRR'');   --Bruno Sousa 03/01/2024',
'   ELSE',
'     :P78_DT_LIMITE_REQ := NVL(V_DT_LIMITE_REQ,add_months(v_dt_fim, 12) - 31); -- to_date(replace(param_rh.dia_limite_ferias||''/''||to_char(sysdate,''mm/rrrr''),'' '',''''),''dd/mm/rrrr'');',
'   END IF;',
'   --<<',
'   -- 28/11/2022 Robson/Rodrigo',
'	if :P78_FLAG_CTRL is not null then',
'		:P78_DT_LIMITE_REQ := to_date(:P78_DT_LIMITE_REQ,''DD/MM/YYYY'')+nvl(:P78_NUM_DIAS_PARC1_1,0)+nvl(:P78_NUM_DIAS_PARC2_1,0)+nvl(:P78_DIAS_ABONO_PEC1_1,0)+nvl(:P78_DIAS_ABONO_PEC2_1,0);',
'	end if;',
'   --',
'   ',
'if :p78_matricula_display is null then',
'',
'    open c1;',
'    fetch c1 into v_c1;',
'    close c1;',
'',
'    :p78_cod_empresa_display := v_c1.empresa;',
'    :p78_matricula_display := v_c1.matricula;',
'    :p78_situacao_colab := v_c1.situacao;',
'    :p78_dt_admissao := v_c1.dt_admissao;',
'    :p78_dc_matricula := v_c1.dc_matricula;',
'',
'    if :p78_cod_solicitacao is null then',
'       :P78_TIPO_FERIAS1 := ''N'';',
'    end if;',
'',
'    open  c3(v_c1.filial);',
'    fetch c3 into v_c3;',
'    close c3;',
'',
'    if v_c1.vinculo <> ''E'' then',
'    :p78_qtd_parcelas := v_c3.qtd_parcelas;',
'    else',
'    :p78_qtd_parcelas := 1;',
'    end if;',
'    :P78_VINCULO := V_C1.VINCULO;',
'end if;',
'exception',
'when others then',
':p78_cod_empresa_display := :p78_cod_empresa;',
':p78_matricula_display := :p78_matricula;',
'end;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_MATRICULA_DISPLAY,P78_COD_SOLICITACAO,P78_DT_FIM_PER_FERIAS,P78_NUM_DIAS_PARC1_1,P78_NUM_DIAS_PARC2_1,P78_DIAS_ABONO_PEC1_1,P78_DIAS_ABONO_PEC2_1'
,p_attribute_03=>'P78_COD_EMPRESA_DISPLAY,P78_MATRICULA_DISPLAY,P78_SITUACAO_COLAB,P78_DT_ADMISSAO,P78_DC_MATRICULA,P78_TIPO_FERIAS1,P78_QTD_PARCELAS,P78_DT_LIMITE_REQ'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329856621234718594)
,p_name=>unistr('(Hide/Show) Regi\00E3o Cria\00E7\00E3o / Pesquisa 1')
,p_event_sequence=>968
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_SAIDA_PARC1_1'
,p_condition_element=>'P78_DT_SAIDA_PARC1_1'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329857122066718594)
,p_event_id=>wwv_flow_api.id(276329856621234718594)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694847727728432570)
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329857643154718594)
,p_event_id=>wwv_flow_api.id(276329856621234718594)
,p_event_result=>'FALSE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694847727728432570)
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329858140436718595)
,p_event_id=>wwv_flow_api.id(276329856621234718594)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694832970995432555)
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329858706505718595)
,p_event_id=>wwv_flow_api.id(276329856621234718594)
,p_event_result=>'FALSE'
,p_action_sequence=>30
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694832970995432555)
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329859107198718596)
,p_name=>unistr('(Hide/Show) Regi\00E3o Parcelas')
,p_event_sequence=>978
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_PARCELAS_OPC,P78_QTD_PARCELAS'
,p_condition_element=>'P78_COD_SOLICITACAO'
,p_triggering_condition_type=>'NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276294341613692457140)
,p_event_id=>wwv_flow_api.id(276329859107198718596)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_JAVASCRIPT_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if (apex.item( "P78_OPCAO_PARC_SN" ).getValue() == ''S'') {',
unistr('console.log(''(Hide/Show) Regi\00E3o Parcelas #01'');'),
'    if (apex.item( "P78_PARCELAS_OPC" ).getValue().length == 0 ) {',
unistr('      console.log(''(Hide/Show) Regi\00E3o Parcelas #01.1'');'),
'        $("div#PARCELA1").hide();',
'        $("div#2_PARCELA1").hide();',
'        $("div#PARCELA2").hide();',
'        $("div#2_PARCELA2").hide();',
'        $("div#PARCELA3").hide();',
'        $("div#2_PARCELA3").hide();',
'    }',
unistr('    console.log(''(Hide/Show) Regi\00E3o Parcelas #01.2'');'),
'    if (apex.item( "P78_PARCELAS_OPC" ).getValue() == ''1'' || apex.item( "P78_PARCELAS_OPC" ).getValue() == ''2'' || apex.item( "P78_PARCELAS_OPC" ).getValue() == ''3'' ) {',
unistr('      console.log(''(Hide/Show) Regi\00E3o Parcelas #01.3'');'),
'        if (apex.item( "P78_DT_SAIDA_PARC1_1" ).getValue().length  > 0 ) {',
'            $("div#2_PARCELA1").show();',
'            $("div#PARCELA1").hide();',
'        }else{',
'            $("div#2_PARCELA1").hide();',
'            $("div#PARCELA1").show();',
'        }',
'    }',
'',
'    if (apex.item( "P78_PARCELAS_OPC" ).getValue() == ''1'') {',
unistr('      console.log(''(Hide/Show) Regi\00E3o Parcelas #01.4.1'');'),
'        $("div#PARCELA2").hide();',
'        $("div#2_PARCELA2").hide();',
'        $("div#PARCELA3").hide();',
'        $("div#2_PARCELA3").hide();',
'    }',
'    ',
'    if (apex.item( "P78_PARCELAS_OPC" ).getValue() == ''2'' || apex.item( "P78_PARCELAS_OPC" ).getValue() == ''3'' ) {',
unistr('      console.log(''(Hide/Show) Regi\00E3o Parcelas #01.5'');'),
'        if (apex.item( "P78_DT_SAIDA_PARC2_1" ).getValue().length  > 0 ) {',
'            $("div#2_PARCELA2").show();',
'            $("div#PARCELA2").hide();',
'        }else{',
'            $("div#2_PARCELA2").hide();',
'            $("div#PARCELA2").show();',
'        }',
'    }',
'',
'   if (apex.item( "P78_PARCELAS_OPC" ).getValue() == ''2'') {',
unistr('     console.log(''(Hide/Show) Regi\00E3o Parcelas #01.6.1'');'),
'        $("div#PARCELA3").hide();',
'        $("div#2_PARCELA3").hide();',
'    }',
unistr('    console.log(''(Hide/Show) Regi\00E3o Parcelas #01.7'');'),
'    if (apex.item( "P78_PARCELAS_OPC" ).getValue() == ''3'' ) {',
unistr('      console.log(''(Hide/Show) Regi\00E3o Parcelas #01.7.1'');'),
'        if (apex.item( "P78_DT_SAIDA_PARC4_1" ).getValue().length  > 0 ) {',
'            $("div#2_PARCELA3").show();',
'            $("div#PARCELA3").hide();',
unistr('          console.log(''(Hide/Show) Regi\00E3o Parcelas #01.7.1.1'');'),
'        }else{',
'            $("div#2_PARCELA3").hide();',
'            $("div#PARCELA3").show();',
unistr('          console.log(''(Hide/Show) Regi\00E3o Parcelas #01.7.1.2'');'),
'        }',
'    }',
'}else if (apex.item( "P78_OPCAO_PARC_SN" ).getValue() == ''N'') {',
'    if (apex.item( "P78_QTD_PARCELAS" ).getValue() == ''1'' || apex.item( "P78_QTD_PARCELAS" ).getValue() == ''2'' || apex.item( "P78_QTD_PARCELAS" ).getValue() == ''3'' ) {',
'        if (apex.item( "P78_DT_SAIDA_PARC1_1" ).getValue().length  > 0 ) {',
'            $("div#2_PARCELA1").show();',
'            $("div#PARCELA1").hide();',
'        }else{',
'            $("div#2_PARCELA1").hide();',
'            $("div#PARCELA1").show();',
'        }',
'    }',
'    if (apex.item( "P78_QTD_PARCELAS" ).getValue() == ''2'' || apex.item( "P78_QTD_PARCELAS" ).getValue() == ''3'' ) {',
'        if (apex.item( "P78_DT_SAIDA_PARC2_1" ).getValue().length  > 0 ) {',
'            $("div#2_PARCELA2").show();',
'            $("div#PARCELA2").hide();',
'        }else{',
'            $("div#2_PARCELA2").hide();',
'            $("div#PARCELA2").show();',
'        }',
'    }',
'    if (apex.item( "P78_QTD_PARCELAS" ).getValue() == ''3'' ) {',
'        if (apex.item( "P78_DT_SAIDA_PARC4_1" ).getValue().length  > 0 ) {',
'            $("div#2_PARCELA3").show();',
'            $("div#PARCELA3").hide();',
'        }else{',
'            $("div#2_PARCELA3").hide();',
'            $("div#PARCELA3").show();',
'        }',
'    }',
'}else{',
'',
'    $("div#PARCELA1").hide();',
'    $("div#2_PARCELA1").hide();',
'    $("div#PARCELA2").hide();',
'    $("div#2_PARCELA2").hide();',
'    $("div#PARCELA3").hide();',
'    $("div#2_PARCELA3").hide();',
'      ',
'}'))
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(266535865176695652413)
,p_event_id=>wwv_flow_api.id(276329859107198718596)
,p_event_result=>'TRUE'
,p_action_sequence=>40
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_JAVASCRIPT_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if (apex.item( "P78_OPCAO_FERIAS" ).getValue().length > 0 || apex.item( "P78_OPCAO_FERIAS_A" ).getValue().length > 0 ) {',
'  if (apex.item( "P78_DT_SAIDA_PARC1_1" ).getValue().length  > 0 ) {',
'          $("div#2_PARCELA1").show();',
'          $("div#PARCELA1").hide();',
'      }else{',
'          $("div#2_PARCELA1").hide();',
'          $("div#PARCELA1").show();',
'      }',
'',
'      if (apex.item( "P78_DT_SAIDA_PARC2_1" ).getValue().length  > 0 ) {',
'          $("div#2_PARCELA2").show();',
'          $("div#PARCELA2").hide();',
'      }else{',
'          $("div#2_PARCELA2").hide();',
'          if (apex.item( "P78_DT_SAIDA_PARC2" ).getValue().length  > 0 ) {',
'          $("div#PARCELA2").show();',
'          }',
'      }',
'',
'      if (apex.item( "P78_DT_SAIDA_PARC4_1" ).getValue().length  > 0 ) {',
'          $("div#2_PARCELA3").show();',
'          $("div#PARCELA3").hide();',
'      }else{',
'          $("div#2_PARCELA3").hide();',
'          if (apex.item( "P78_DT_SAIDA_PARC4" ).getValue().length  > 0 ) {',
'          $("div#PARCELA3").show();',
'          }',
'      }',
'}'))
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276218564784602942975)
,p_name=>unistr('Pesquisa (Hide/Show) Regi\00E3o Parcelas_1')
,p_event_sequence=>988
,p_triggering_element_type=>'REGION'
,p_triggering_region_id=>wwv_flow_api.id(276694826984926432549)
,p_bind_type=>'bind'
,p_bind_event_type=>'apexafterrefresh'
,p_display_when_type=>'ITEM_IS_NOT_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276218564869593942976)
,p_event_id=>wwv_flow_api.id(276218564784602942975)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_JAVASCRIPT_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if ($x(''P78_DT_SAIDA_PARC1_1'').value.length > 0 && $x(''P78_DT_SAIDA_PARC1'').value.length == 0 ) {',
'        $("div#2_PARCELA1").show();',
'        $("div#PARCELA1").hide();',
'    }else{',
'        $("div#2_PARCELA1").hide();',
'        $("div#PARCELA1").show();',
'    }',
'',
'    if ($x(''P78_DT_SAIDA_PARC2_1'').value.length  > 0 && $x(''P78_DT_SAIDA_PARC2'').value.length == 0 ) {',
'        $("div#2_PARCELA2").show();',
'        $("div#PARCELA2").hide();',
'    }else{',
'        $("div#2_PARCELA2").hide();',
'        if ($x(''P78_DT_SAIDA_PARC2'').value.length  > 0 ) {',
'        $("div#PARCELA2").show();',
'        }',
'    }',
'',
'    if ($x(''P78_DT_SAIDA_PARC4_1'').value.length  > 0 && $x(''P78_DT_SAIDA_PARC4'').value.length == 0 ) {',
'        $("div#2_PARCELA3").show();',
'        $("div#PARCELA3").hide();',
'    }else{',
'        $("div#2_PARCELA3").hide();',
'        if ($x(''P78_DT_SAIDA_PARC4'').value.length  > 0 ) {',
'        $("div#PARCELA3").show();',
'        }',
'    }'))
);
end;
/
begin
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329860514380718597)
,p_name=>unistr('(Hide/Show) Regi\00E3o Cria\00E7\00E3o / Pesquisa 2')
,p_event_sequence=>998
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_SAIDA_PARC2_1'
,p_condition_element=>'P78_DT_SAIDA_PARC2_1'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329860927136718598)
,p_event_id=>wwv_flow_api.id(276329860514380718597)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276465208681842959609)
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329861430130718598)
,p_event_id=>wwv_flow_api.id(276329860514380718597)
,p_event_result=>'FALSE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276465208681842959609)
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329862455442718599)
,p_event_id=>wwv_flow_api.id(276329860514380718597)
,p_event_result=>'FALSE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694838117800432559)
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329861954788718599)
,p_event_id=>wwv_flow_api.id(276329860514380718597)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694838117800432559)
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329864289166718601)
,p_name=>unistr('(Hide/Show) Regi\00E3o Cria\00E7\00E3o / Pesquisa 3')
,p_event_sequence=>1008
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_SAIDA_PARC4_1'
,p_condition_element=>'P78_DT_SAIDA_PARC4_1'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329864763393718601)
,p_event_id=>wwv_flow_api.id(276329864289166718601)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276465209599486959618)
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329865262255718602)
,p_event_id=>wwv_flow_api.id(276329864289166718601)
,p_event_result=>'FALSE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276465209599486959618)
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329865672391718602)
,p_event_id=>wwv_flow_api.id(276329864289166718601)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276559150703399823134)
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329866196333718603)
,p_event_id=>wwv_flow_api.id(276329864289166718601)
,p_event_result=>'FALSE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276559150703399823134)
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329867956888718604)
,p_name=>unistr('Pesquisa (Hide/Show) Regi\00E3o Cria\00E7\00E3o 3')
,p_event_sequence=>1018
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_SAIDA_PARC4'
,p_condition_element=>'P78_DT_SAIDA_PARC4'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NOT_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329868516759718604)
,p_event_id=>wwv_flow_api.id(276329867956888718604)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276559150703399823134)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329868986638718604)
,p_event_id=>wwv_flow_api.id(276329867956888718604)
,p_event_result=>'FALSE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276559150703399823134)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329869330468718605)
,p_name=>unistr('Pesquisa (Hide/Show) Regi\00E3o Cria\00E7\00E3o 2')
,p_event_sequence=>1028
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_SAIDA_PARC2'
,p_condition_element=>'P78_DT_SAIDA_PARC2'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NOT_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329869833981718605)
,p_event_id=>wwv_flow_api.id(276329869330468718605)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694838117800432559)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329870336789718605)
,p_event_id=>wwv_flow_api.id(276329869330468718605)
,p_event_result=>'FALSE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694838117800432559)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329870723016718606)
,p_name=>unistr('Pesquisa (Hide/Show) Regi\00E3o Cria\00E7\00E3o 1')
,p_event_sequence=>1038
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_OPCAO_FERIAS'
,p_condition_element=>'P78_OPCAO_FERIAS'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(93270281029302791874)
,p_event_id=>wwv_flow_api.id(276329870723016718606)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694832970995432555)
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329871770096718606)
,p_event_id=>wwv_flow_api.id(276329870723016718606)
,p_event_result=>'FALSE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694832970995432555)
,p_attribute_01=>'N'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(49569006422622018457)
,p_event_id=>wwv_flow_api.id(276329870723016718606)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_JAVASCRIPT_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
unistr('console.log(''Pesquisa (Hide/Show) Regi\00E3o Cria\00E7\00E3o 1 Show #01'');'),
'if (apex.item( "P78_DT_SAIDA_PARC1_1" ).getValue().length  > 0 ) {',
unistr('  console.log(''Pesquisa (Hide/Show) Regi\00E3o Cria\00E7\00E3o 1 Show #01.1'');'),
'  $("div#2_PARCELA1").show();',
'  $("div#PARCELA1").hide();',
'}else{',
unistr('  console.log(''Pesquisa (Hide/Show) Regi\00E3o Cria\00E7\00E3o 1 Show #01.2'');'),
'  $("div#2_PARCELA1").hide();',
'  $("div#PARCELA1").show();',
'}'))
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(49569006527558018458)
,p_event_id=>wwv_flow_api.id(276329870723016718606)
,p_event_result=>'FALSE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_JAVASCRIPT_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
unistr('console.log(''Pesquisa (Hide/Show) Regi\00E3o Cria\00E7\00E3o 1 Hide #01'');'),
'if (apex.item( "P78_DT_SAIDA_PARC1_1" ).getValue().length  > 0 ) {',
unistr('  console.log(''Pesquisa (Hide/Show) Regi\00E3o Cria\00E7\00E3o 1 Hide #01.1'');'),
'  $("div#2_PARCELA1").show();',
'  $("div#PARCELA1").hide();',
'}else{',
unistr('  console.log(''Pesquisa (Hide/Show) Regi\00E3o Cria\00E7\00E3o 1 Hide #01.2'');'),
'  $("div#2_PARCELA1").hide();',
'  $("div#PARCELA1").show();',
'}'))
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276329872146568718607)
,p_name=>'Disable DT_RETORNO_PARC'
,p_event_sequence=>1058
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_MATRICULA'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276329872628779718607)
,p_event_id=>wwv_flow_api.id(276329872146568718607)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_JAVASCRIPT_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'$x(''P78_DT_RETORNO_PARC1'').disabled = true;',
'$x(''P78_DT_RETORNO_PARC2'').disabled = true;',
'$x(''P78_DT_RETORNO_PARC4'').disabled = true;'))
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276296489646532891342)
,p_name=>'Popula DIAS_DIREITO_OPC'
,p_event_sequence=>1068
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_MATRICULA'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return :P78_FLAG_CTRL is null;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276296489741656891343)
,p_event_id=>wwv_flow_api.id(276296489646532891342)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_dias_char_1 varchar2(10) := :P78_DIAS_DIREITO; -- Igor 30/03',
'v_dias_number_1 number;',
'',
'v_dias_char_2 varchar2(10) := :P78_SALDO_BRUTO;',
'v_dias_number_2 number;',
'',
'begin',
'',
'--:P78_DIAS_DIREITO_OPC := nvl(:P78_SALDO_BRUTO,0);',
'',
'if nvl(:P78_NUM_DIAS_PARC1_1,0) = 0 then',
'   ',
'   if instr(v_dias_char_1,''.'') > 0 then',
'   v_dias_number_1 := replace(v_dias_char_1,''.'','','');',
'   :P78_DIAS_DIREITO_OPC := v_dias_number_1;',
'   else',
'   :P78_DIAS_DIREITO_OPC := nvl(:P78_DIAS_DIREITO,0);',
'   end if;',
'else',
'',
'   if instr(v_dias_char_2,''.'') > 0 then',
'   v_dias_number_2 := replace(v_dias_char_2,''.'','','');',
'   :P78_DIAS_DIREITO_OPC := v_dias_number_2;',
'   else',
'   :P78_DIAS_DIREITO_OPC := nvl(:P78_SALDO_BRUTO,0);',
'   end if;',
'',
'',
'end if;',
'',
'/*',
'if nvl(:p78_num_dias_parc1_1,0) = 0 then',
'   :P78_DIAS_DIREITO_OPC := nvl(:P78_DIAS_DIREITO,0);',
'elsif nvl(:p78_num_dias_parc1_1,0) > 0 and nvl(:p78_num_dias_parc2_1,0) = 0 and :P78_IND_SITUACAO_PERIODO = ''R'' then',
'   :P78_DIAS_DIREITO_OPC := nvl(:P78_DIAS_DIREITO,0) + nvl(:p78_num_dias_parc1_1,0) + nvl(:p78_num_dias_parc2_1,0);',
'elsif nvl(:p78_num_dias_parc1_1,0) > 0 and nvl(:p78_num_dias_parc2_1,0) > 0 and :P78_IND_SITUACAO_PERIODO = ''R'' then',
'   :P78_DIAS_DIREITO_OPC := nvl(:P78_SALDO_BRUTO,0);',
'end if;',
'*/',
'NULL;',
'',
'end;'))
,p_attribute_02=>'P78_NUM_DIAS_PARC1_1,P78_DIAS_DIREITO,P78_NUM_DIAS_PARC1_1,P78_NUM_DIAS_PARC2_1,P78_SALDO_BRUTO'
,p_attribute_03=>'P78_DIAS_DIREITO_OPC'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(276100245990661936180)
,p_name=>'(Create) Mostra a Parc 1 Programada'
,p_event_sequence=>1078
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_MATRICULA'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(276100246078073936181)
,p_event_id=>wwv_flow_api.id(276100245990661936180)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_JAVASCRIPT_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if ($x(''P78_DT_SAIDA_PARC1_1'').value.length  > 0 ) {',
'            $("div#2_PARCELA1").show();',
'            $("div#PARCELA1").hide();',
'}'))
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(96232711547614399828)
,p_name=>'(Create) Mostra a Parc 2 Programada'
,p_event_sequence=>1088
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_MATRICULA'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(96232711613833399829)
,p_event_id=>wwv_flow_api.id(96232711547614399828)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_JAVASCRIPT_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if ($x(''P78_DT_SAIDA_PARC2_1'').value.length  > 0 ) {',
'            $("div#2_PARCELA2").show();',
'            $("div#PARCELA2").hide();',
'}'))
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(275702217226161552328)
,p_name=>'Update Requisicao_Ferias'
,p_event_sequence=>1098
,p_triggering_element_type=>'BUTTON'
,p_triggering_button_id=>wwv_flow_api.id(276329683306579718455)
,p_condition_element=>'P78_SIT_REQUISICAO'
,p_triggering_condition_type=>'NOT_EQUALS'
,p_triggering_expression=>'2'
,p_bind_type=>'bind'
,p_bind_event_type=>'click'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(275702217259633552329)
,p_event_id=>wwv_flow_api.id(275702217226161552328)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'',
'PKG_FERIAS.Pre_Update ( :p78_cod_solicitacao,',
'                       :p78_sit_requisicao,',
'                       :p78_dt_saida_parc1,',
'                       :p78_dt_saida_parc2,',
'                       :p78_dt_saida_parc3,',
'                       :p78_dt_saida_parc4,',
'                       :p78_dt_retorno_parc1,',
'                       :p78_dt_retorno_parc2,',
'                       :p78_dt_retorno_parc3,',
'                       :p78_dt_retorno_parc4,',
'                       :p_usuario,',
'                       v_flg_retorno,',
'                       v_msg_retorno);',
'',
' if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
'    :p78_ok       := ''N'';',
'    :p78_flag     := v_flg_retorno;',
'    :p78_mensagem := v_msg_retorno;',
' else',
' ',
'    update requisicao_ferias',
'       set sit_requisicao = :p78_sit_requisicao, ',
'           usuario = TO_CHAR(:P_EMPRESA_USER)||''/''||TO_CHAR(:P_MATRICULA_USER),',
'           dt_atualizacao = sysdate',
'     where cod_solicitacao = :p78_cod_solicitacao',
'       and :p78_cod_solicitacao is not null;',
'     ',
'     commit;',
'     ',
' end if;',
' ',
' ',
'end;'))
,p_attribute_02=>'P78_COD_SOLICITACAO,P78_SIT_REQUISICAO,P78_DT_SAIDA_PARC1,P78_DT_SAIDA_PARC2,P78_DT_SAIDA_PARC3,P78_DT_SAIDA_PARC4,P78_DT_RETORNO_PARC1,P78_DT_RETORNO_PARC2,P78_DT_RETORNO_PARC3,P78_DT_RETORNO_PARC4,P_EMPRESA_USER,P_MATRICULA_USER,P_USUARIO'
,p_attribute_03=>'P78_OK,P78_MENSAGEM,P78_FLAG'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(264187415434621102327)
,p_event_id=>wwv_flow_api.id(275702217226161552328)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_SUBMIT_PAGE'
,p_attribute_01=>'SAVE'
,p_attribute_02=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(266531491561086144460)
,p_name=>unistr('Estagi\00E1rio')
,p_event_sequence=>1108
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_OPCAO_PARC_SN'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(266539451244651476047)
,p_event_id=>wwv_flow_api.id(266531491561086144460)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_JAVASCRIPT_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if (apex.item("P78_VINCULO").getValue() == ''E''){',
'  apex.item( "P78_DIAS_ABONO_PEC1" ).hide(true);',
'  apex.item( "P78_OPCAO_13SAL1" ).hide(true);',
'  apex.item( "P78_DESC_ADICIONAL1" ).hide(true);',
'  apex.item( "P78_DIAS_ABONO_PEC1_LST" ).hide(true);',
'}else{',
'      apex.item( "P78_OPCAO_13SAL1" ).show(true);',
'      apex.item( "P78_DESC_ADICIONAL1" ).show(true);',
'  ',
'  if (apex.item("P78_OPCAO_PARC_SN").getValue() == ''S''){',
'      apex.item( "P78_DIAS_ABONO_PEC1_LST" ).show(true);',
'      apex.item( "P78_DIAS_ABONO_PEC1" ).hide(true);',
'  }else{',
'      apex.item( "P78_DIAS_ABONO_PEC1" ).show(true);',
'      apex.item( "P78_DIAS_ABONO_PEC1_LST" ).hide(true);',
'  }',
'}'))
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(266554986911942898040)
,p_name=>'Valida_dt_retorno_parc2'
,p_event_sequence=>1118
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_RETORNO_PARC2'
,p_condition_element=>'P78_DT_RETORNO_PARC2'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(266554986703955898038)
,p_event_id=>wwv_flow_api.id(266554986911942898040)
,p_event_result=>'TRUE'
,p_action_sequence=>40
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'begin',
'',
':p78_mensagem := null;',
'',
'pkg_ferias.Valida_Dt_Retorno_Parc2(:p78_dt_retorno_parc2,',
'                                   nvl(:p78_ind_situacao_periodo,:p78_ind_situacao_periodo_a),',
'                                   v_flg_retorno,',
'                                   v_msg_retorno,',
'                                   :p78_dt_saida_parc2,',
'                                   nvl(:p78_dt_fim_per_ferias,:p78_dt_fim_per_ferias_1),',
'                                    :p78_cod_empresa,',
'                                    :p78_matricula,',
'                                    nvl(:p78_dt_inic_per_ferias,:p78_dt_inic_per_ferias_1));',
'',
'if trim(v_msg_retorno) is not null then',
'',
'if v_flg_retorno in (''N'',''Q'') then',
'    :P78_ok := ''N'';',
'    :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_dt_retorno_parc2''));',
'else',
'    :P78_ok := ''S'';',
'end if;',
'',
':P78_flag := v_flg_retorno;',
':P78_mensagem := v_msg_retorno;',
'else',
':P78_flag := null;',
':P78_mensagem := null;',
'if v_item_validacao = TRIM(UPPER(''p78_dt_retorno_parc2'')) OR v_item_validacao IS NULL then',
'   :P78_OK := ''S'';',
'   :P78_ITEM_VALIDACAO := null;',
'else',
'   :P78_ITEM_VALIDACAO := v_item_validacao;',
'end if;',
'end if;',
'',
'end;'))
,p_attribute_02=>'P78_ITEM_VALIDACAO,P78_DT_RETORNO_PARC2,P78_IND_SITUACAO_PERIODO,P78_DT_SAIDA_PARC2,P78_DT_FIM_PER_FERIAS,P78_COD_EMPRESA,P78_MATRICULA,P78_DT_INIC_PER_FERIAS,P78_IND_SITUACAO_PERIODO_A,P78_DT_FIM_PER_FERIAS_1,P78_DT_INIC_PER_FERIAS_1'
,p_attribute_03=>'P78_OK,P78_FLAG,P78_MENSAGEM,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(266554987159025898043)
,p_name=>'Valida_dt_retorno_parc1'
,p_event_sequence=>1128
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_RETORNO_PARC1'
,p_condition_element=>'P78_DT_RETORNO_PARC1'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return :P78_ROWID is null and :P78_FLAG_CTRL is null;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(266554986628818898037)
,p_event_id=>wwv_flow_api.id(266554987159025898043)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'V_DT_SAIDA date;',
'begin',
'',
':p78_mensagem := null;',
'',
'V_DT_SAIDA := :P78_DT_SAIDA_PARC1;',
'v_flg_retorno := PKG_FERIAS.VALIDA_DT_SAIDA(:P78_COD_EMPRESA,:P78_MATRICULA,V_DT_SAIDA,v_msg_retorno);',
'IF v_flg_retorno = ''N'' THEN',
'  :P78_ok := ''N'';',
'  :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_dt_retorno_parc1''));',
unistr('  :p78_mensagem := ''Sa\00EDda Parcela 1: ''||v_msg_retorno;'),
'  return;',
'END IF;',
'',
'pkg_ferias.Valida_Dt_Retorno_Parc1(:p78_dt_retorno_parc1,',
'                                   :p78_ind_situacao_periodo,                        ',
'                                   v_flg_retorno,',
'                                   v_msg_retorno,',
'                                   V_DT_SAIDA, --:p78_dt_saida_parc1,',
'                                   :p78_dt_fim_per_ferias,',
'                                    :p78_cod_empresa,',
'                                    :p78_matricula,',
'                                    :p78_dt_inic_per_ferias);',
'',
'if trim(v_msg_retorno) is not null then',
'',
'if v_flg_retorno in (''N'',''Q'') then',
'    :P78_ok := ''N'';',
'    :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_dt_retorno_parc1''));',
'else',
'    :P78_ok := ''S'';',
'end if;',
'',
':P78_flag := v_flg_retorno;',
':P78_mensagem := v_msg_retorno;',
'else',
':P78_flag := null;',
':P78_mensagem := null;',
'if v_item_validacao = TRIM(UPPER(''p78_dt_retorno_parc1'')) OR v_item_validacao IS NULL then',
'   :P78_OK := ''S'';',
'   :P78_ITEM_VALIDACAO := null;',
'else',
'   :P78_ITEM_VALIDACAO := v_item_validacao;',
'end if;',
'end if;',
'',
'end;'))
,p_attribute_02=>'P78_ITEM_VALIDACAO,P78_DT_RETORNO_PARC1,P78_IND_SITUACAO_PERIODO,P78_DT_SAIDA_PARC1,P78_DT_FIM_PER_FERIAS,P78_COD_EMPRESA,P78_MATRICULA,P78_DT_INIC_PER_FERIAS'
,p_attribute_03=>'P78_OK,P78_FLAG,P78_MENSAGEM,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(173363199485267845069)
,p_name=>'Valida_dt_retorno_parc1a'
,p_event_sequence=>1138
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_RETORNO_PARC1'
,p_condition_element=>'P78_DT_RETORNO_PARC1'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return nvl(:P78_FLAG_CTRL,0) = 1;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(173363199591591845070)
,p_event_id=>wwv_flow_api.id(173363199485267845069)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'V_DT_SAIDA DATE;',
'begin',
'',
':p78_mensagem := null;',
'V_DT_SAIDA := :P78_DT_SAIDA_PARC1;',
'v_flg_retorno := PKG_FERIAS.VALIDA_DT_SAIDA(:P78_COD_EMPRESA,:P78_MATRICULA,V_DT_SAIDA,v_msg_retorno);',
'IF v_flg_retorno = ''N'' THEN',
'  :P78_ok := ''N'';',
'  :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_dt_retorno_parc1''));',
unistr('  :p78_mensagem := ''Sa\00EDda Parcela 1: ''||v_msg_retorno;'),
'  return;',
'END IF;',
'',
'pkg_ferias.Valida_Dt_Retorno_Parc1(:p78_dt_retorno_parc1,',
'                                   :p78_ind_situacao_periodo_a,                        ',
'                                   v_flg_retorno,',
'                                   v_msg_retorno,',
'                                   V_DT_SAIDA, --:p78_dt_saida_parc1,',
'                                   :p78_dt_fim_per_ferias_1,',
'                                    :p78_cod_empresa,',
'                                    :p78_matricula,',
'                                    :p78_dt_inic_per_ferias_1);',
'',
'if trim(v_msg_retorno) is not null then',
'',
'if v_flg_retorno in (''N'',''Q'') then',
'    :P78_ok := ''N'';',
'    :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_dt_retorno_parc1''));',
'else',
'    :P78_ok := ''S'';',
'end if;',
'',
':P78_flag := v_flg_retorno;',
':P78_mensagem := v_msg_retorno;',
'else',
':P78_flag := null;',
':P78_mensagem := null;',
'if v_item_validacao = TRIM(UPPER(''p78_dt_retorno_parc1'')) OR v_item_validacao IS NULL then',
'   :P78_OK := ''S'';',
'   :P78_ITEM_VALIDACAO := null;',
'else',
'   :P78_ITEM_VALIDACAO := v_item_validacao;',
'end if;',
'end if;',
'',
'end;'))
,p_attribute_02=>'P78_ITEM_VALIDACAO,P78_DT_RETORNO_PARC1,P78_IND_SITUACAO_PERIODO_A,P78_DT_SAIDA_PARC1,P78_DT_FIM_PER_FERIAS_1,P78_COD_EMPRESA,P78_MATRICULA,P78_DT_INIC_PER_FERIAS_1'
,p_attribute_03=>'P78_OK,P78_FLAG,P78_MENSAGEM,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(239790694009785698909)
,p_name=>'POPULA TESTE_3'
,p_event_sequence=>1148
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_RETORNO_PARC1'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(239790694103542698910)
,p_event_id=>wwv_flow_api.id(239790694009785698909)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SET_VALUE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_TESTE_3'
,p_attribute_01=>'FUNCTION_BODY'
,p_attribute_06=>'RETURN(:P78_DT_RETORNO_PARC1);'
,p_attribute_07=>'P78_DT_RETORNO_PARC1'
,p_attribute_08=>'Y'
,p_attribute_09=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(266554987103330898042)
,p_name=>'Valida_dt_retorno_parc4'
,p_event_sequence=>1158
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_RETORNO_PARC4'
,p_condition_element=>'P78_DT_RETORNO_PARC4'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'ITEM_IS_NULL'
,p_display_when_cond=>'P78_ROWID'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(266554986764335898039)
,p_event_id=>wwv_flow_api.id(266554987103330898042)
,p_event_result=>'TRUE'
,p_action_sequence=>50
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'begin',
'',
':p78_mensagem := null;',
'',
'pkg_ferias.Valida_Dt_Retorno_Parc4(:p78_dt_retorno_parc4,',
'                                   :p78_ind_situacao_periodo,                        ',
'                                   v_flg_retorno,',
'                                   v_msg_retorno,',
'                                   :p78_dt_saida_parc4,',
'                                   :p78_dt_fim_per_ferias,',
'                                    :p78_cod_empresa,',
'                                    :p78_matricula,',
'                                    :p78_dt_inic_per_ferias,',
'                                    :p78_dt_saida_parc2);',
'',
'if trim(v_msg_retorno) is not null then',
'',
'if v_flg_retorno in (''N'',''Q'') then',
'    :P78_ok := ''N'';',
'    :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_dt_retorno_parc4''));',
'else',
'    :P78_ok := ''S'';',
'end if;',
'',
':P78_flag := v_flg_retorno;',
':P78_mensagem := v_msg_retorno;',
'else',
':P78_flag := null;',
':P78_mensagem := null;',
'if v_item_validacao = TRIM(UPPER(''p78_dt_retorno_parc4'')) OR v_item_validacao IS NULL then',
'   :P78_OK := ''S'';',
'   :P78_ITEM_VALIDACAO := null;',
'else',
'   :P78_ITEM_VALIDACAO := v_item_validacao;',
'end if;',
'end if;',
'',
'end;'))
,p_attribute_02=>'P78_ITEM_VALIDACAO,P78_DT_RETORNO_PARC4,P78_IND_SITUACAO_PERIODO,P78_DT_SAIDA_PARC4,P78_DT_FIM_PER_FERIAS,P78_COD_EMPRESA,P78_MATRICULA,P78_DT_INIC_PER_FERIAS,P78_DT_SAIDA_PARC2'
,p_attribute_03=>'P78_OK,P78_FLAG,P78_MENSAGEM,P78_ITEM_VALIDACAO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(265168844180063939556)
,p_name=>'Reprovar - Dialog Closed'
,p_event_sequence=>1168
,p_triggering_element_type=>'BUTTON'
,p_triggering_button_id=>wwv_flow_api.id(265168843970452939554)
,p_bind_type=>'bind'
,p_bind_event_type=>'apexafterclosedialog'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(265168844330069939557)
,p_event_id=>wwv_flow_api.id(265168844180063939556)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_SUBMIT_PAGE'
,p_attribute_02=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(265168844395498939558)
,p_name=>'Aprovar - Dialog Closed'
,p_event_sequence=>1178
,p_triggering_element_type=>'BUTTON'
,p_triggering_button_id=>wwv_flow_api.id(164092319778569616227)
,p_bind_type=>'bind'
,p_bind_event_type=>'apexafterclosedialog'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(265168844497034939559)
,p_event_id=>wwv_flow_api.id(265168844395498939558)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_SUBMIT_PAGE'
,p_attribute_02=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(239790693719078698906)
,p_name=>'POPULA TESTE X'
,p_event_sequence=>1188
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_RETORNO_PARC1_X'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(239790693831947698907)
,p_event_id=>wwv_flow_api.id(239790693719078698906)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SET_VALUE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_TESTE_3'
,p_attribute_01=>'FUNCTION_BODY'
,p_attribute_06=>'RETURN(:P78_DT_RETORNO_PARC1_X);'
,p_attribute_07=>'P78_DT_RETORNO_PARC1_X'
,p_attribute_08=>'Y'
,p_attribute_09=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(175206142711689206412)
,p_name=>'Atualizar P78_NUM_DIAS_PARC1_LST'
,p_event_sequence=>1198
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_SAIDA_PARC1'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(175206142662660206411)
,p_event_id=>wwv_flow_api.id(175206142711689206412)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'    select  max(nvl(:P78_NUM_DIAS_PARC1_LST,case when A.QTD_PARCELAS = 1 then A.NUM_DIAS_PARC1 end)),',
'            max(nvl(:P78_DIAS_ABONO_PEC1_LST,case when A.QTD_PARCELAS = 1 then A.DIAS_ABONO_PEC1 end))',
'    into    :P78_NUM_DIAS_PARC1_LST,',
'            :P78_DIAS_ABONO_PEC1_LST',
'    from    FERIAS_PARAMETROS_PARCELAS A',
'    where   A.COD_EMPRESA = :P78_COD_EMPRESA',
'    and     A.COD_FILIAL = :P78_FILIAL',
'    and     A.COD = nvl(:P78_OPCAO_FERIAS,:P78_OPCAO_FERIAS_A);'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_FILIAL,P78_OPCAO_FERIAS,P78_OPCAO_FERIAS_A,P78_NUM_DIAS_PARC1_LST,P78_DIAS_ABONO_PEC1_LST'
,p_attribute_03=>'P78_NUM_DIAS_PARC1_LST,P78_DIAS_ABONO_PEC1_LST'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(173360931073600851671)
,p_name=>'alt_P78_FLAG_CTRL'
,p_event_sequence=>1208
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_FLAG_CTRL'
,p_condition_element=>'P78_FLAG_CTRL'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(173363196003142845034)
,p_event_id=>wwv_flow_api.id(173360931073600851671)
,p_event_result=>'FALSE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_MATRICULA_1'
);
end;
/
begin
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(173363195718477845031)
,p_event_id=>wwv_flow_api.id(173360931073600851671)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_MATRICULA'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(173363195855348845033)
,p_event_id=>wwv_flow_api.id(173360931073600851671)
,p_event_result=>'FALSE'
,p_action_sequence=>20
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_MATRICULA'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(173363195789648845032)
,p_event_id=>wwv_flow_api.id(173360931073600851671)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_MATRICULA_1'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(173363195269050845027)
,p_name=>'Requisao no mesmo periodo'
,p_event_sequence=>1218
,p_bind_type=>'bind'
,p_bind_event_type=>'ready'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return nvl(:P78_FLAG_CTRL,0) = 1;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(173363195362939845028)
,p_event_id=>wwv_flow_api.id(173363195269050845027)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
':P78_COD_EMPRESA := :P78_EMP_A;',
':P78_COD_EMPRESA_1 := :P78_EMP_A;',
':P78_MATRICULA := :P78_MAT_A;',
unistr('select ''Matr\00EDcula: (''||A.MATRICULA||'') ''||INITCAP(B.nome)'),
'            ||'' - FILIAL: (''||A.FILIAL||'') ''||initcap(fnct_nome_FILIAL(A.COD_EMPRESA, A.FILIAL))',
'            ||'' - C.Custo: (''||A.COD_CCUSTO||'') ''||initcap(fnct_nome_ccusto(A.COD_EMPRESA, A.COD_CCUSTO))',
'            ||'' - Unid. Adm: (''||A.UNIDADE_ADM||'') ''||initcap(U.DESCRICAO)',
'            ||'' - Atividade: (''||A.COD_atividade||'') ''||initcap(V.DESCRICAO)',
'            ||'' - Local: (''||A.COD_LOCALIZACAO||'') ''||initcap(fnct_nome_local_trab(A.COD_LOCALIZACAO))',
'into    :P78_MATRICULA_1',
'from    INFORMACOES_FUNCIONAIS  A,',
'        INF_PESSOAIS            B,',
'        UNIDADE_ADMINISTRATIVA  U,',
'        ATIVIDADE V',
'where   A.COD_EMPRESA   = B.COD_EMPRESA',
'and     A.MATRICULA   = B.MATRICULA',
'and     A.COD_EMPRESA = U.COD_EMPRESA (+)',
'and     A.UNIDADE_ADM = U.COD_UNIDADE_ADM (+)',
'and     A.COD_atividade = V.COD (+)',
'and     A.FILIAL = U.COD_FILIAL (+)',
'and     A.COD_EMPRESA = :P78_COD_EMPRESA',
'and     A.MATRICULA = :P78_MATRICULA;',
'',
'select  floor(months_between(trunc(sysdate), trunc(A.DT_ADMISSAO)))',
'into    :P78_MESES_ADM',
'from    INFORMACOES_FUNCIONAIS A',
'where   A.COD_EMPRESA = :P78_COD_EMPRESA',
'and     A.MATRICULA = :P78_MATRICULA;'))
,p_attribute_02=>'P78_EMP_A,P78_MAT_A'
,p_attribute_03=>'P78_COD_EMPRESA,P78_MATRICULA,P78_MATRICULA_1,P78_COD_EMPRESA_1,P78_MESES_ADM'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(173363803785863608729)
,p_event_id=>wwv_flow_api.id(173363195269050845027)
,p_event_result=>'TRUE'
,p_action_sequence=>50
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_DISABLE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_COD_EMPRESA,P78_OPCAO_FERIAS_A'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(173363807187785608763)
,p_name=>'Popula_campos_3a'
,p_event_sequence=>1228
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_MATRICULA'
,p_condition_element=>'P78_DT_SAIDA_PARC1_1'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>'return nvl(:P78_FLAG_CTRL,0) = 1;'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(173363807379873608765)
,p_event_id=>wwv_flow_api.id(173363807187785608763)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_OPCAO_FERIAS_A'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(173363806498236608756)
,p_event_id=>wwv_flow_api.id(173363807187785608763)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_DISABLE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_OPCAO_FERIAS_A'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(173363807575866608767)
,p_event_id=>wwv_flow_api.id(173363807187785608763)
,p_event_result=>'TRUE'
,p_action_sequence=>40
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_OPCAO_FERIAS'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(169661283055476129531)
,p_name=>'alt_P78_MSG_APROVAR'
,p_event_sequence=>1238
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_MSG_APROVAR'
,p_condition_element=>'P78_MSG_APROVAR'
,p_triggering_condition_type=>'NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(169661283411312129534)
,p_event_id=>wwv_flow_api.id(169661283055476129531)
,p_event_result=>'FALSE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_JAVASCRIPT_CODE'
,p_attribute_01=>'alertify.alert(apex.item(''P78_MSG_APROVAR'').getValue());'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(143343626254441737828)
,p_name=>unistr('Limite Agendamento F\00E9rias')
,p_event_sequence=>1248
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_CTRL_LIMITE'
,p_condition_element=>'P78_CTRL_LIMITE'
,p_triggering_condition_type=>'EQUALS'
,p_triggering_expression=>'S'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(143343626402706737830)
,p_event_id=>wwv_flow_api.id(143343626254441737828)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_DISABLE'
,p_affected_elements_type=>'JQUERY_SELECTOR'
,p_affected_elements=>'#TIT'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(143343626495040737831)
,p_event_id=>wwv_flow_api.id(143343626254441737828)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_DISABLE'
,p_affected_elements_type=>'JQUERY_SELECTOR'
,p_affected_elements=>'#COLABORADOR'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(143343626625680737832)
,p_event_id=>wwv_flow_api.id(143343626254441737828)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_DISABLE'
,p_affected_elements_type=>'JQUERY_SELECTOR'
,p_affected_elements=>'#APR'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(143343626710397737833)
,p_event_id=>wwv_flow_api.id(143343626254441737828)
,p_event_result=>'TRUE'
,p_action_sequence=>40
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_DISABLE'
,p_affected_elements_type=>'JQUERY_SELECTOR'
,p_affected_elements=>'#PER'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(143343626953505737835)
,p_event_id=>wwv_flow_api.id(143343626254441737828)
,p_event_result=>'TRUE'
,p_action_sequence=>50
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_DISABLE'
,p_affected_elements_type=>'BUTTON'
,p_affected_button_id=>wwv_flow_api.id(276329683628271718456)
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(143343626356920737829)
,p_event_id=>wwv_flow_api.id(143343626254441737828)
,p_event_result=>'TRUE'
,p_action_sequence=>60
,p_execute_on_page_init=>'Y'
,p_action=>'PLUGIN_BE.CTB.ALERTIFY'
,p_attribute_01=>'DIALOG'
,p_attribute_02=>'ALERT'
,p_attribute_04=>unistr('&P78_COD_REQ.<strong>Recria\00E7\00E3o de Requisi\00E7\00E3o N\00E3o Permitida!</strong><br>')
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(144653115451915590386)
,p_name=>unistr('Verifica Dt Retorno Parc1 - Estagi\00E1rio')
,p_event_sequence=>1258
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_RETORNO_PARC1'
,p_condition_element=>'P78_DT_RETORNO_PARC1'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(144653115531155590387)
,p_event_id=>wwv_flow_api.id(144653115451915590386)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'DECLARE',
'  vMsg    VARCHAR2(250) DEFAULT NULL;',
'BEGIN',
'  :P78_MENSAGEM  := NULL;',
'  --',
unistr('  IF :P78_VINCULO = ''E'' THEN -- E-Estagi\00E1rio'),
'  vMsg := Pkg_Ferias.fnc_ValDtRetFeriasEstagiario(pEmpresa      => NVL(:P78_COD_EMPRESA, :P78_COD_EMPRESA_1)',
'                                                 ,pMatricula    => :P78_MATRICULA',
'                                                 ,pDtRetFerParc => :P78_DT_RETORNO_PARC1);',
'  --',
'  IF vMsg IS NOT NULL THEN',
'    :P78_MENSAGEM := REPLACE(REPLACE(vMsg, ''['', ''<strong>''), '']'',''</strong>'');',
'  END IF;',
'  END IF;',
'END;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_COD_EMPRESA_1,P78_MATRICULA,P78_DT_RETORNO_PARC1,P78_MENSAGEM,P78_VINCULO'
,p_attribute_03=>'P78_MENSAGEM'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(144653115839068590390)
,p_name=>unistr('Verifica Dt Retorno Parc2 - Estagi\00E1rio')
,p_event_sequence=>1268
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_RETORNO_PARC2'
,p_condition_element=>'P78_DT_RETORNO_PARC2'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(144653115935776590391)
,p_event_id=>wwv_flow_api.id(144653115839068590390)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'DECLARE',
'  vMsg    VARCHAR2(250) DEFAULT NULL;',
'BEGIN',
'  :P78_MENSAGEM  := NULL;',
'  --',
unistr('  IF :P78_VINCULO = ''E'' THEN -- E-Estagi\00E1rio'),
'  vMsg := Pkg_Ferias.fnc_ValDtRetFeriasEstagiario(pEmpresa      => NVL(:P78_COD_EMPRESA, :P78_COD_EMPRESA_1)',
'                                                 ,pMatricula    => :P78_MATRICULA',
'                                                 ,pDtRetFerParc => :P78_DT_RETORNO_PARC2);',
'  --',
'  IF vMsg IS NOT NULL THEN',
'    :P78_MENSAGEM := REPLACE(REPLACE(vMsg, ''['', ''<strong>''), '']'',''</strong>'');',
'  END IF;',
'  END IF;',
'END;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_COD_EMPRESA_1,P78_MATRICULA,P78_MENSAGEM,P78_VINCULO,P78_DT_RETORNO_PARC2'
,p_attribute_03=>'P78_MENSAGEM'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(144653116142685590393)
,p_name=>unistr('Verifica Dt Retorno Parc4 - Estagi\00E1rio')
,p_event_sequence=>1278
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_RETORNO_PARC4'
,p_condition_element=>'P78_DT_RETORNO_PARC4'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(144653116214882590394)
,p_event_id=>wwv_flow_api.id(144653116142685590393)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'DECLARE',
'  vMsg    VARCHAR2(250) DEFAULT NULL;',
'BEGIN',
'  :P78_MENSAGEM  := NULL;',
'  --',
unistr('  IF :P78_VINCULO = ''E'' THEN -- E-Estagi\00E1rio'),
'  vMsg := Pkg_Ferias.fnc_ValDtRetFeriasEstagiario(pEmpresa      => NVL(:P78_COD_EMPRESA, :P78_COD_EMPRESA_1)',
'                                                 ,pMatricula    => :P78_MATRICULA',
'                                                 ,pDtRetFerParc => :P78_DT_RETORNO_PARC4);',
'  --',
'  IF vMsg IS NOT NULL THEN',
'    :P78_MENSAGEM := REPLACE(REPLACE(vMsg, ''['', ''<strong>''), '']'',''</strong>'');',
'  END IF;',
'  END IF;',
'END;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_COD_EMPRESA_1,P78_MATRICULA,P78_MENSAGEM,P78_VINCULO,P78_DT_RETORNO_PARC4'
,p_attribute_03=>'P78_MENSAGEM'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(138737275837930217765)
,p_name=>unistr('Checar se tem A\00E7\00E3o Judicial')
,p_event_sequence=>1288
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_MATRICULA'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(138737275899457217766)
,p_event_id=>wwv_flow_api.id(138737275837930217765)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if :P78_MATRICULA is not null then',
'    begin',
'        select ''S''',
'            into :P78_ALERT_ACAO_JURIDICO',
'        from campo_de_cadastro',
'        where campo = ''ACAO_JUDICIAL''',
'        and texto = ''S''',
'        and chave_de_tabela = :P78_MATRICULA',
'        and empresa = :P78_COD_EMPRESA;',
'    exception',
'        when others then',
'           :P78_ALERT_ACAO_JURIDICO := ''N'';',
'    end;',
'    ',
'    /*',
'    if :P78_ALERT_ACAO_JURIDICO = ''S'' then',
'        --alertify.alert($v(''P78_MENSAGEM''));',
'            apex_error.add_error',
unistr('                        (p_message               =>  ''Colaborador com a\00E7\00E3o judicial de f\00E9rias, atendendo ao processo suas f\00E9rias s\00E3o compuls\00F3rias'','),
'                        p_display_location      => apex_error.c_inline_in_notification );',
'        ',
'                        ',
'if ($x(''P78_FLAG'').value == "Q") {',
'alertify.confirm($v(''P78_MENSAGEM''), function (e) {',
'    if (e) {',
'        $x(''P78_FLAG'').value = ''S'';',
'        $x(''P78_MENSAGEM'').value = '''';',
'        $x(''P78_OK'').value = ''S'';',
'',
'    } else {',
'        $x(''P78_OK'').value = ''N'';',
'',
'    }',
'});',
'} else {',
'',
'    if ($x(''P78_MENSAGEM'').value.length  > 0 ) {',
'        ',
'        if ($x(''P78_FLAG'').value == "N") {',
'            $x(''P78_OK'').value = ''N'';',
'',
'        } else {',
'            if ($x(''P78_ITEM_VALIDACAO'').value.length == 0){',
'            $x(''P78_OK'').value = ''S'';',
'            }',
'        }',
'            ',
'        alertify.alert($v(''P78_MENSAGEM''));',
'        ',
'        ',
'    }else{',
'            if ($x(''P78_ITEM_VALIDACAO'').value.length == 0){',
'            $x(''P78_OK'').value = ''S'';',
'            }',
'    }',
'    ',
'    if ($x(''P78_ITEM_VALIDACAO'').value == ''P78_CREATE''){',
'            $x(''P78_OK'').value = ''S'';',
'        $x(''P78_ITEM_VALIDACAO'').value = '''';',
'    }',
'',
'}         ',
'    end if; */              ',
'end if;'))
,p_attribute_02=>'P78_MATRICULA'
,p_attribute_03=>'P78_ALERT_ACAO_JURIDICO'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(138737278891112217796)
,p_name=>unistr('Mensagem e Fechar Regi\00E3o')
,p_event_sequence=>1298
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_ALERT_ACAO_JURIDICO'
,p_condition_element=>'P78_ALERT_ACAO_JURIDICO'
,p_triggering_condition_type=>'EQUALS'
,p_triggering_expression=>'S'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(138737278986792217797)
,p_event_id=>wwv_flow_api.id(138737278891112217796)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'PLUGIN_BE.CTB.ALERTIFY'
,p_attribute_01=>'DIALOG'
,p_attribute_02=>'ALERT'
,p_attribute_04=>unistr('Colaborador com a\00E7\00E3o judicial de f\00E9rias, atendendo ao processo suas f\00E9rias s\00E3o compuls\00F3rias')
,p_attribute_07=>'OK'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(138737279064312217798)
,p_event_id=>wwv_flow_api.id(138737278891112217796)
,p_event_result=>'TRUE'
,p_action_sequence=>20
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'REGION'
,p_affected_region_id=>wwv_flow_api.id(276694826984926432549)
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(126314457032725063610)
,p_name=>unistr('Primeiro Verifica Dia Sa\00EDda')
,p_event_sequence=>1308
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_SAIDA_PARC1'
,p_condition_element=>'P78_DT_SAIDA_PARC1'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'NEVER'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(126314457138017063611)
,p_event_id=>wwv_flow_api.id(126314457032725063610)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'DECLARE',
'  vMsg       VARCHAR2(4000) DEFAULT NULL;',
'  vRetorno   VARCHAR2(1) DEFAULT NULL;',
'  V_DT_SAIDA DATE;',
'BEGIN',
'',
'',
'  :p78_mensagem    := null;',
'  :P78_DT_1        := NULL;',
'  ',
'  V_DT_SAIDA := :P78_DT_SAIDA_PARC1;',
'  VRETORNO := PKG_FERIAS.VALIDA_DT_SAIDA(PCOD_EMPRESA => :P78_COD_EMPRESA,',
'                                         PMATRICULA => :P78_MATRICULA,',
'                                         PDT_SAIDA_PARC => V_DT_SAIDA,',
'                                         PMSG_RETORNO => VMSG);',
'  ',
'  IF VRETORNO = ''S'' THEN',
'    :P78_DT_1 := V_DT_SAIDA;',
'  ELSE',
unistr('    :p78_mensagem := ''Sa\00EDda Parcela 1: ''||VMSG;'),
'  END IF;',
'END;'))
,p_attribute_02=>'P78_COD_EMPRESA,P78_MATRICULA,P78_DT_SAIDA_PARC1'
,p_attribute_03=>'P78_MENSAGEM,P78_DT_1'
,p_attribute_04=>'N'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(126314457282842063612)
,p_name=>'Valida Saida de Ferias 1'
,p_event_sequence=>1318
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_1'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>wwv_flow_string.join(wwv_flow_t_varchar2(
'--RETURN :P78_DT_SAIDA_PARC1 = :P78_DT_1;',
'',
'IF :P78_DT_SAIDA_PARC1 != :P78_DT_1 THEN',
'  RETURN FALSE;',
'ELSE',
'  RETURN TRUE;',
'END IF;'))
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(126314457414716063613)
,p_event_id=>wwv_flow_api.id(126314457282842063612)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>':P78_DT_SAIDA_PARC1 := :P78_DT_1;'
,p_attribute_02=>'P78_DT_1'
,p_attribute_03=>'P78_DT_SAIDA_PARC1'
,p_attribute_04=>'Y'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(126314457674687063616)
,p_name=>'Valida Saida de Ferias 2'
,p_event_sequence=>1328
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_2'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>wwv_flow_string.join(wwv_flow_t_varchar2(
'--RETURN :P78_DT_SAIDA_PARC2 = :P78_DT_2;',
'',
'IF :P78_DT_SAIDA_PARC2 != :P78_DT_2 THEN',
'  RETURN FALSE;',
'ELSE',
'  RETURN TRUE;',
'END IF;'))
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(126314457822092063617)
,p_event_id=>wwv_flow_api.id(126314457674687063616)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>':P78_DT_SAIDA_PARC2 := :P78_DT_2;'
,p_attribute_02=>'P78_DT_2'
,p_attribute_03=>'P78_DT_SAIDA_PARC2'
,p_attribute_04=>'Y'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(126314458034630063620)
,p_name=>'Valida Saida de Ferias 4'
,p_event_sequence=>1338
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_DT_4'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
,p_display_when_type=>'FUNCTION_BODY'
,p_display_when_cond=>wwv_flow_string.join(wwv_flow_t_varchar2(
'--RETURN :P78_DT_SAIDA_PARC4 = :P78_DT_4;',
'',
'IF :P78_DT_SAIDA_PARC4 != :P78_DT_4 THEN',
'  RETURN FALSE;',
'ELSE',
'  RETURN TRUE;',
'END IF;'))
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(126314458141799063621)
,p_event_id=>wwv_flow_api.id(126314458034630063620)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_EXECUTE_PLSQL_CODE'
,p_attribute_01=>':P78_DT_SAIDA_PARC4 := :P78_DT_4;'
,p_attribute_02=>'P78_DT_4'
,p_attribute_03=>'P78_DT_SAIDA_PARC4'
,p_attribute_04=>'Y'
,p_wait_for_result=>'Y'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(102030463871695232645)
,p_name=>'if change show_hide item'
,p_event_sequence=>1348
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_SHOW_HIDE'
,p_condition_element=>'P78_SHOW_HIDE'
,p_triggering_condition_type=>'NOT_NULL'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(102030463946053232646)
,p_event_id=>wwv_flow_api.id(102030463871695232645)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'N'
,p_action=>'NATIVE_JAVASCRIPT_CODE'
,p_attribute_01=>wwv_flow_string.join(wwv_flow_t_varchar2(
'//alert($v("P78_SHOW_HIDE"));',
'',
'var vshow=$v("P78_SHOW_HIDE");',
'',
'if (vshow=="HIDE"){',
'    $(''#PER'').hide();',
'    $(''#DADOS'').hide();',
'    $(''#P78_CREATE'').hide();',
'}else{',
'    $(''#PER'').show();',
'    $(''#DADOS'').show();',
'    $(''#P78_CREATE'').show();',
'}'))
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(95629944704997503874)
,p_name=>'Carrega = 1'
,p_event_sequence=>1358
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_OPCAO_FERIAS_CARREGA'
,p_condition_element=>'P78_OPCAO_FERIAS_CARREGA'
,p_triggering_condition_type=>'EQUALS'
,p_triggering_expression=>'1'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(95629944825432503875)
,p_event_id=>wwv_flow_api.id(95629944704997503874)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_OPCAO_FERIAS_A'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(95629944948679503876)
,p_event_id=>wwv_flow_api.id(95629944704997503874)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_DISABLE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_OPCAO_FERIAS_A'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(95629945034743503877)
,p_event_id=>wwv_flow_api.id(95629944704997503874)
,p_event_result=>'TRUE'
,p_action_sequence=>40
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_OPCAO_FERIAS'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(95629945597536503883)
,p_event_id=>wwv_flow_api.id(95629944704997503874)
,p_event_result=>'TRUE'
,p_action_sequence=>50
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_OPCAO_FERIAS_1'
);
wwv_flow_api.create_page_da_event(
 p_id=>wwv_flow_api.id(95629945150671503878)
,p_name=>'Carrega = 0'
,p_event_sequence=>1368
,p_triggering_element_type=>'ITEM'
,p_triggering_element=>'P78_OPCAO_FERIAS_CARREGA'
,p_condition_element=>'P78_OPCAO_FERIAS_CARREGA'
,p_triggering_condition_type=>'EQUALS'
,p_triggering_expression=>'0'
,p_bind_type=>'bind'
,p_bind_event_type=>'change'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(95629945239040503879)
,p_event_id=>wwv_flow_api.id(95629945150671503878)
,p_event_result=>'TRUE'
,p_action_sequence=>10
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_SHOW'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_OPCAO_FERIAS'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(95629945380222503881)
,p_event_id=>wwv_flow_api.id(95629945150671503878)
,p_event_result=>'TRUE'
,p_action_sequence=>30
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_OPCAO_FERIAS_A'
);
wwv_flow_api.create_page_da_action(
 p_id=>wwv_flow_api.id(95629945664641503884)
,p_event_id=>wwv_flow_api.id(95629945150671503878)
,p_event_result=>'TRUE'
,p_action_sequence=>40
,p_execute_on_page_init=>'Y'
,p_action=>'NATIVE_HIDE'
,p_affected_elements_type=>'ITEM'
,p_affected_elements=>'P78_OPCAO_FERIAS_1'
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(276329737354604718506)
,p_process_sequence=>40
,p_process_point=>'AFTER_HEADER'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'Popula_Solicitante'
,p_process_sql_clob=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
' cursor c1 is',
' select cod_empresa||'' - ''||initcap(fnct_nome_empresa(cod_empresa))||'' / ''||',
'        matricula||'' - ''||initcap(fnct_nome_func(cod_empresa, matricula))||'' / ''||',
'        cargo||'' - ''||initcap(fnct_nome_cargo(cargo)) colaborador',
'   from informacoes_funcionais_cad',
'  where cod_empresa = :p78_COD_EMP_SOLICITANTE',
'    and matricula   = :p78_MATRICULA_SOLICITANTE;',
'',
' v_c1 c1%rowtype;',
'',
'begin',
'',
' open c1;',
' fetch c1 into v_c1;',
' close c1;',
'',
' if v_c1.colaborador is not null then',
'    :p78_solicitante := v_c1.colaborador;',
' end if;',
' ',
':P78_MATRICULA_SOLIC := :P_MATRICULA_USER;',
':P78_EMP_SOLIC := :P_EMPRESA_USER;',
'',
'end;'))
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(276329737743190718506)
,p_process_sequence=>50
,p_process_point=>'AFTER_HEADER'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>unistr('Seta T\00EDtulo')
,p_process_sql_clob=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_sit varchar2(30);',
'',
'begin',
'',
'   if :P78_SIT_REQUISICAO = 1 then',
'      v_sit := ''Aberta'';',
'elsif :P78_SIT_REQUISICAO = 2 then',
unistr('      v_sit := ''Conclu\00EDda'';'),
'elsif :P78_SIT_REQUISICAO = 3 then',
'      v_sit := ''Cancelada'';',
'elsif :P78_SIT_REQUISICAO = 4 then',
'      v_sit := ''Reprovada'';',
'elsif :P78_SIT_REQUISICAO = 5 then',
'      v_sit := ''Aprovada'';',
'elsif :P78_SIT_REQUISICAO = 6 then',
'      v_sit := ''Suspensa'';',
'end if;',
'',
'',
'if :p78_rowid is not null then',
unistr('   :p78_titulo := ''Requisi\00E7\00E3o de F\00E9rias: N\00BA ''||:p78_cod_solicitacao||'' - ''||:P78_DT_SOLICITACAO||'' (''||v_sit||'')'';'),
'else',
unistr('   :p78_titulo := ''Requisi\00E7\00E3o de F\00E9rias'';'),
'end if;',
'',
'if :p78_cod_solicitacao is null then',
'   :P78_TIPO_FERIAS1 := ''N'';',
'end if;',
'',
'end;'))
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(276329740570848718508)
,p_process_sequence=>60
,p_process_point=>'AFTER_HEADER'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'(Pesquisa) Popula Campos'
,p_process_sql_clob=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_data_ini date;',
'',
'v_dias_direito number;',
'',
'cursor c1 is',
'select filial',
'  from informacoes_funcionais',
' where cod_empresa = :p78_cod_empresa',
'   and matricula = :p78_matricula;',
'   ',
'v_c1 c1%rowtype;',
'',
'cursor c3 (v_filial number) is',
'select qtd_parcelas',
'  from ferias_Parametros',
' where cod_empresa = :P78_cod_empresa',
'   and cod_filial = v_filial;',
'',
'v_c3 c3%rowtype;',
'',
'cursor c_req  is',
'select opcao_ferias',
'  from requisicao_ferias',
' where cod_solicitacao = :P78_cod_solicitacao;',
'',
'v_req c_req%rowtype;',
'',
'    CURSOR C_REQ_2(pdt_inic_per_ferias DATE) IS',
'    SELECT R.SIT_REQUISICAO COD_SIT_REQ, NVL(P.REQ_FERIAS_SUBS_CONCLUIDA,''N'') REQ_FERIAS_SUBS_CONCLUIDA',
'      FROM REQUISICAO_FERIAS R,',
'           PARAMETROS_RECURSOS_HUMANOS P',
'     WHERE R.COD_EMPRESA = P.COD_EMPRESA',
'       AND R.SIT_REQUISICAO = 2',
'       AND R.COD_EMPRESA = :P78_COD_EMPRESA',
'       AND R.MATRICULA = :P78_MATRICULA',
'       AND R.Dt_Inic_Per_Ferias = pdt_inic_per_ferias;',
'       ',
'    V_REQ_2 C_REQ_2%ROWTYPE;',
'    ',
'    cursor c_fer(pdt_inic_per_ferias DATE) IS',
'    SELECT ind_situacao_parc_1, ind_situacao_parc_2, ind_situacao_parc_4',
'      FROM FERIAS R',
'     WHERE R.COD_EMPRESA = :P78_COD_EMPRESA',
'       AND R.MATRICULA = :P78_MATRICULA',
'       AND R.Dt_Inic_Per_Ferias = pdt_inic_per_ferias;',
'       ',
'     v_fer c_fer%rowtype;',
'begin',
'',
'if :P78_COD_SOLICITACAO is not null then',
'',
':P78_OK := ''S'';',
'',
'open  c1;',
'fetch c1 into v_c1;',
'close c1;',
'',
' :p78_filial := v_c1.filial;',
' ',
'open  c3(v_c1.filial);',
'fetch c3 into v_c3;',
'close c3;',
'',
' :p78_qtd_parcelas := v_c3.qtd_parcelas;',
'',
'open c_req;',
'fetch c_req into v_req;',
'close c_req;',
' ',
'    EXECUTE IMMEDIATE ''ALTER SESSION SET NLS_NUMERIC_CHARACTERS= ''''.,'''' '';',
'',
'    BEGIN',
'    PKG_IDIOMA.SETA_IDIOMA(''AMERICAN'');',
'    END;',
'',
'           begin',
'            select min(dt_inic_per_ferias)',
'            Into v_data_ini',
'            from requisicao_ferias ',
'            where cod_empresa   = :p78_cod_empresa',
'            and matricula       = :p78_matricula',
'            and cod_solicitacao = :p78_cod_solicitacao',
unistr('            and ind_situacao_periodo in (''P'',''R''); -- 1-Em andamento, 2-Conclu\00EDda, 3-Cancelada, 4-Reprovada, 5-Aprovada, 6-Cancelada pelo Ajuste dos Per\00EDodos'),
'           ',
'            open c_req_2(V_DATA_INI);',
'            fetch c_req_2 into v_req_2;',
'            close c_req_2;',
'            ',
'            open c_fer(V_DATA_INI);',
'            fetch c_fer into v_fer;',
'            close c_fer;',
'           ',
'           exception when no_data_found then',
'                    select min(dt_inic_per_ferias) ',
'                    Into v_data_ini',
'                    from ferias ',
'                    where cod_empresa = :p78_cod_empresa',
'                    and matricula = :p78_matricula',
'                    and ind_situacao_periodo in (''P'',''R'');',
'           end; ',
'',
'                IF NVL(V_REQ_2.REQ_FERIAS_SUBS_CONCLUIDA,''N'') = ''N'' THEN',
'                ',
'                                BEGIN',
'                                    select Nvl(dias_descanso_adicional,0)',
'                                         , saldo_bruto',
'                                         , saldo',
'                                         , ind_situacao_periodo',
'                                      --   , dt_inic_per_ferias',
'                                      --   , dt_fim_per_ferias ',
'                                         , case when v_fer.ind_situacao_parc_1 = ''C'' then dt_saida_parc1 end  -- Igor 30/03/2023',
'                                         , case when v_fer.ind_situacao_parc_1 = ''C'' then num_dias_parc1 end',
'                                         , case when v_fer.ind_situacao_parc_1 = ''C'' then NVL(dias_abono_pec1,0) end',
unistr('                                         , case when v_fer.ind_situacao_parc_1 = ''C'' then decode(opcao_13sal1,''S'',''Sim'',''N'',''N\00E3o'') end'),
'                                         , case when v_fer.ind_situacao_parc_1 = ''C'' then desc_adicional1 end',
'                                         , case when v_fer.ind_situacao_parc_1 = ''C'' then dt_retorno_parc1 end',
'                                         , case when v_fer.ind_situacao_parc_1 = ''C'' then tipo_ferias1 end',
'                                         , case when v_fer.ind_situacao_parc_2 = ''C'' then dt_saida_parc2 end',
'                                         , case when v_fer.ind_situacao_parc_2 = ''C'' then num_dias_parc2 end',
'                                         , case when v_fer.ind_situacao_parc_2 = ''C'' then dias_abono_pec2 end',
unistr('                                         , case when v_fer.ind_situacao_parc_2 = ''C'' then decode(opcao_13sal2,''S'',''Sim'',''N'',''N\00E3o'') end'),
'                                         , case when v_fer.ind_situacao_parc_2 = ''C'' then desc_adicional2 end',
'                                         , case when v_fer.ind_situacao_parc_2 = ''C'' then dt_retorno_parc2 end',
'                                         , case when v_fer.ind_situacao_parc_2 = ''C'' then tipo_ferias2 end',
'                                         , case when v_fer.ind_situacao_parc_4 = ''C'' then dt_saida_parc4 end',
'                                         , case when v_fer.ind_situacao_parc_4 = ''C'' then num_dias_parc4 end',
'                                         , case when v_fer.ind_situacao_parc_4 = ''C'' then dias_abono_pec4 end',
unistr('                                         , case when v_fer.ind_situacao_parc_4 = ''C'' then decode(opcao_13sal4,''S'',''Sim'',''N'',''N\00E3o'') end'),
'                                         , case when v_fer.ind_situacao_parc_4 = ''C'' then desc_adicional4 end',
'                                         , case when v_fer.ind_situacao_parc_4 = ''C'' then dt_retorno_parc4 end',
'                                         , case when v_fer.ind_situacao_parc_4 = ''C'' then tipo_ferias4 end',
'                                         , dt_saida_parc3',
'                                         , num_dias_parc3',
'                                         , dt_retorno_parc3',
'                                         , tipo_ferias3',
'                                       --  , DC_MATRICULA',
'                                         /*',
'                                         , cod_empresa',
'                                         , dt_solicitacao*/',
'                                         , falta_hora',
'                                         , falta_minuto',
'                                         --, opcao_ferias',
'                                      into :p78_dias_descanso_adicional',
'                                         , :p78_saldo_bruto',
'                                         , :p78_saldo',
'                                         , :p78_ind_situacao_periodo',
'                                     --    , :p78_dt_inic_per_ferias',
'                                     --    , :p78_dt_fim_per_ferias ',
'                                         , :p78_dt_saida_parc1_1',
'                                         , :p78_num_dias_parc1_1',
'                                         , :p78_dias_abono_pec1_1',
'                                         , :p78_opcao_13sal1_1',
'                                         , :p78_desc_adicional1_1',
'                                         , :p78_dt_retorno_parc1_1',
'                                         , :p78_tipo_ferias1_1',
'                                         , :p78_dt_saida_parc2_1',
'                                         , :p78_num_dias_parc2_1',
'                                         , :p78_dias_abono_pec2_1',
'                                         , :p78_opcao_13sal2_1',
'                                         , :p78_desc_adicional2_1',
'                                         , :p78_dt_retorno_parc2_1',
'                                         , :p78_tipo_ferias2_1',
'                                         , :p78_dt_saida_parc4_1',
'                                         , :p78_num_dias_parc4_1',
'                                         , :p78_dias_abono_pec4_1',
'                                         , :p78_opcao_13sal4_1',
'                                         , :p78_desc_adicional4_1',
'                                         , :p78_dt_retorno_parc4_1',
'                                         , :p78_tipo_ferias4_1',
'                                         , :p78_dt_saida_parc3',
'                                         , :p78_num_dias_parc3',
'                                         , :p78_dt_retorno_parc3',
'                                         , :p78_tipo_ferias3',
'                                         --, :P78_DC_MATRICULA',
'                                         /*',
'                                         , :p78_cod_empresa',
'                                         , :p78_dt_solicitacao*/',
'                                         , :p78_falta_hora',
'                                         , :p78_falta_minuto',
'                                         --, :p78_opcao_ferias',
'                                      from ferias',
'                                     where cod_empresa 				= :p78_cod_empresa',
'                                       and matricula   				= :p78_matricula   ',
'                                       and dt_inic_per_ferias = v_data_ini;',
'                                       --',
'                                       --',
'                             exception',
'                             when no_data_found then',
'                                   select Nvl(dias_descanso_adicional,0)',
'                                         , saldo_bruto',
'                                         , saldo',
'                                         , ind_situacao_periodo',
'                                        -- , dt_inic_per_ferias',
'                                       --  , dt_fim_per_ferias ',
'                                         , DC_MATRICULA',
'                                         , falta_hora',
'                                         , falta_minuto',
'                                         , opcao_ferias',
'                                      into :p78_dias_descanso_adicional',
'                                         , :p78_saldo_bruto',
'                                         , :p78_saldo',
'                                         , :p78_ind_situacao_periodo',
'                                       --  , :p78_dt_inic_per_ferias',
'                                       --  , :p78_dt_fim_per_ferias ',
'                                         , :P78_DC_MATRICULA',
'                                         , :p78_falta_hora',
'                                         , :p78_falta_minuto',
'                                         , :p78_opcao_ferias',
'                                      from requisicao_ferias',
'                                     where cod_empresa 				= :p78_cod_empresa',
'                                       and matricula   				= :p78_matricula   ',
'                                       and dt_inic_per_ferias = v_data_ini;',
'                         END;',
'                         ',
'             else',
'             ',
'                        BEGIN',
'                        select Nvl(dias_descanso_adicional,0)',
'                        , saldo_bruto',
'                        , saldo',
'                        , ind_situacao_periodo',
'                      --  , dt_inic_per_ferias',
'                      --  , dt_fim_per_ferias ',
'                        , falta_hora',
'                        , falta_minuto',
'                        , dc_matricula',
'                        into :p78_dias_descanso_adicional',
'                        , :p78_saldo_bruto',
'                        , :p78_saldo',
'                        , :p78_ind_situacao_periodo',
'                       -- , :p78_dt_inic_per_ferias',
'                       -- , :p78_dt_fim_per_ferias',
'                        , :p78_falta_hora',
'                        , :p78_falta_minuto',
'                        , :p78_dc_matricula',
'                        from ferias',
'                        where cod_empresa = :p78_cod_empresa',
'                        and matricula = :p78_matricula   ',
'                        and dt_inic_per_ferias = v_data_ini;',
'',
'                        EXCEPTION WHEN OTHERS THEN',
'                        :p78_flag := ''N'';',
'                        :p78_ok := ''N'';',
unistr('                        :p78_mensagem := ''N\00E3o h\00E1 per\00EDodos em aberto para a programa\00E7\00E3o! Solicite ao RH a cria\00E7\00E3o.'';'),
'                        END;',
'             ',
'             END IF;',
'             ',
' v_dias_direito := Pkg_Atlz_Saldo_Ferias./*fnc_Ret*/Dias_Direito(:P78_COD_EMPRESA,:P78_MATRICULA,:P78_DT_INIC_PER_FERIAS,:P78_DT_FIM_PER_FERIAS);',
' IF v_dias_direito IS NULL THEN',
' if NVL(:p78_jornada_reduzida,''N'') = ''N'' then',
'      v_dias_direito := (30 - nvl(trim(:P78_saldo_bruto),0)) + (nvl(trim(:P78_saldo),0)); -- Humberto/Izidoro 29/09/2014',
' else',
'      v_dias_direito := (18 - nvl(trim(:P78_saldo_bruto),0)) + (nvl(trim(:P78_saldo),0)); -- Humberto/Izidoro 29/09/2014',
' end if;',
'    ',
' v_dias_direito := f_jornada_reduzida(:p78_cod_empresa,:p78_matricula,v_dias_direito,null); -- Rodrigo (Chamado 9869)',
' ',
' /*',
' :p78_opcao_ferias   := v_req.opcao_ferias;',
' :p78_opcao_ferias_1 := v_req.opcao_ferias;',
' */',
' ',
' if :p78_falta_hora > 7 and :p78_jornada_reduzida = ''S'' then -- Humberto/Izidoro 01/03/2016',
'      v_dias_direito := v_dias_direito / 2;',
' end if;',
' END IF;',
' :p78_DIAS_DIREITO := v_dias_direito;--NAO',
' ',
'    if :p78_cod_solicitacao is null then',
'       :P78_TIPO_FERIAS1 := ''N'';',
'       :P78_TIPO_FERIAS2 := ''N'';',
'    end if;',
'',
'end if;',
'EXCEPTION WHEN OTHERS THEN',
'NULL;',
'end;',
''))
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
,p_process_when=>'P78_COD_SOLICITACAO'
,p_process_when_type=>'ITEM_IS_NOT_NULL'
);
end;
/
begin
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(276218564996188942977)
,p_process_sequence=>70
,p_process_point=>'AFTER_HEADER'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>unistr('Parcelas Op\00E7\00E3o')
,p_process_sql_clob=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'cursor c1 is',
'select qtd_parcelas',
'  from ferias_parametros_parcelas',
' where cod_empresa = :p78_cod_empresa',
'   and cod_filial = :p78_filial',
'   and cod = nvl(:p78_opcao_ferias_DB,:P78_OPCAO_FERIAS_A);',
'',
'v_c1 c1%rowtype;',
'',
'begin',
'',
' open c1;',
' fetch c1 into v_c1;',
' close c1;',
' ',
' :p78_parcelas_opc := v_c1.qtd_parcelas;',
' ',
' :p78_opcao_ferias_CARREGA := 1;',
' :p78_opcao_ferias_a := :p78_opcao_ferias_DB;',
' :p78_opcao_ferias_1 := :p78_opcao_ferias_DB;',
'end;',
''))
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
,p_process_when=>'P78_ROWID'
,p_process_when_type=>'ITEM_IS_NOT_NULL'
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(169661282937984129530)
,p_process_sequence=>80
,p_process_point=>'AFTER_HEADER'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'Ativa BT Aprovar'
,p_process_sql_clob=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'    FLG_RETORNO varchar2(3);',
'    MSG_RETORNO varchar2(4000);',
'    DIAS_ABONO_PEC2 number := :P78_DIAS_ABONO_PEC2;',
'    v_dias_direito number := :P78_DIAS_DIREITO;',
'    ',
'v_dt_fim date := :P78_DT_FIM_PER_FERIAS;',
'',
'V_DT_LIMITE_REQ DATE;',
'begin',
'  if :P78_DT_LIMITE_REQ is null then',
'     PKG_FERIAS.VALIDA_ESTATUTARIO ( :p78_cod_empresa,',
'                                     :p78_matricula,',
'                                      3,--P_TIPO NUMBER,',
'                                      NULL,',
'                                      NULL,',
'                                      NULL,',
'                                      :P78_DT_FIM_PER_FERIAS,',
'                                      V_DT_LIMITE_REQ,',
'                                      FLG_RETORNO,',
'                                      MSG_RETORNO);',
'',
'     -->> MSS 20220815 (Rodrigo)',
'     IF Pkg_Ferias.fnc_VerifEstatutario(pEmpresa => :P78_COD_EMPRESA, pMatricula => :P78_MATRICULA) = ''S'' THEN',
unistr('       --:P78_DT_LIMITE_REQ := TO_DATE(''01/12/''||TO_CHAR(SYSDATE, ''RRRR''), ''DD/MM/RRRR'');   -- Alterado de 31 para 01/12/2022 Rog\00E9rio'),
unistr('       :P78_DT_LIMITE_REQ := TO_DATE(''01/12/''||TO_CHAR(TO_DATE(:P78_DT_FIM_PER_FERIAS,''DD/MM/YYYY''), ''RRRR''), ''DD/MM/RRRR'');   -- Alterado de 31 para 01/12/2022 Rog\00E9rio'),
'     ELSE',
'       :P78_DT_LIMITE_REQ := NVL(V_DT_LIMITE_REQ,add_months(v_dt_fim,12) - 31); -- to_date(replace(param_rh.dia_limite_ferias||''/''||to_char(sysdate,''mm/rrrr''),'' '',''''),''dd/mm/rrrr'');',
'     END IF;',
'     --<<',
'     -- 28/11/2022 Robson/Rodrigo',
'    if :P78_FLAG_CTRL is not null then',
'      :P78_DT_LIMITE_REQ := to_date(:P78_DT_LIMITE_REQ,''DD/MM/YYYY'')+nvl(:P78_NUM_DIAS_PARC1,0)+nvl(:P78_NUM_DIAS_PARC2,0)+nvl(:P78_DIAS_ABONO_PEC1,0)+nvl(:P78_DIAS_ABONO_PEC2,0);',
'    end if;',
'    --',
'  end if;',
'',
'    :P78_MSG_APROVAR := '''';',
'    if :P78_DT_SAIDA_PARC1 is not null and :p78_load = ''N'' then',
'        PKG_FERIAS.VALIDA_DT_SAIDA_PARC1(',
'            :P78_COD_EMPRESA,',
'            :P78_COD_SOLICITACAO,',
'            :P78_MATRICULA,',
'            :P78_DT_INIC_PER_FERIAS,',
'            :P78_DT_FIM_PER_FERIAS,',
'            :P78_DT_SAIDA_PARC2,',
'            :P78_SALDO_BRUTO,',
'            :P78_FALTA_HORA,',
'            v_dias_direito,',
'            :P78_DT_SAIDA_PARC1,',
'            :P78_SALDO,',
'            :P78_DIAS_ABONO_PEC1,',
'            :P78_NUM_DIAS_PARC1,',
'            :P78_OPCAO_13SAL1,',
'            :P78_OPCAO_13SAL2,',
'            :P78_TIPO_FERIAS1,',
'            :P78_DT_RETORNO_PARC1,',
'            :P78_DT_PAGTO_PARC1,',
'            :P78_JORNADA_REDUZIDA,',
'            :P78_IND_SITUACAO_PERIODO,',
'            :P78_DIAS_ABONO_PEC1_DSP,',
'            :P78_NUM_DIAS_PARC1_DSP,',
'            FLG_RETORNO,',
'            MSG_RETORNO);',
'            ',
'        if trim(MSG_RETORNO) is not null and FLG_RETORNO = ''N'' then',
unistr('          :P78_MSG_APROVAR := ''Data de Sa\00EDda Parcela 1: ''||MSG_RETORNO;'),
'        end if;',
'    end if;',
'    if :P78_DT_SAIDA_PARC2 is not null and :p78_load = ''N'' and :P78_MSG_APROVAR is null then',
'        PKG_FERIAS.VALIDA_DT_SAIDA_PARC2(',
'            :P78_COD_EMPRESA,',
'            :P78_COD_SOLICITACAO,',
'            :P78_MATRICULA,',
'            :P78_DT_SAIDA_PARC1,',
'            :P78_DT_RETORNO_PARC1,',
'            :P78_NUM_DIAS_PARC1,',
'            :P78_DT_SAIDA_PARC2,',
'            :P78_DIAS_ABONO_PEC1,',
'            :P78_DT_INIC_PER_FERIAS,',
'            :P78_DT_FIM_PER_FERIAS,',
'            :P78_SALDO,',
'            v_dias_direito,',
'            :P78_DT_LIMITE_REQ,',
'            :P78_NUM_DIAS_PARC2,',
'            DIAS_ABONO_PEC2,',
'            :P78_DT_RETORNO_PARC2,',
'            :P78_DT_PAGTO_PARC2,',
'            :P78_TIPO_FERIAS2,',
'            :P78_OPCAO_13SAL2,',
'            :P78_DIAS_ABONO_PEC1_DSP,',
'            :P78_NUM_DIAS_PARC1_DSP,',
'            FLG_RETORNO,',
'            MSG_RETORNO);',
'        ',
'        if trim(MSG_RETORNO) is not null and FLG_RETORNO = ''N'' then',
unistr('          :P78_MSG_APROVAR := ''Data de Sa\00EDda Parcela 2: ''||MSG_RETORNO;'),
'        end if;',
'    end if;',
'    if :P78_DT_SAIDA_PARC4 is not null and :p78_load = ''N'' and :P78_MSG_APROVAR is null then',
'        PKG_FERIAS.VALIDA_DT_SAIDA_PARC4(',
'            :P78_COD_EMPRESA,',
'            :P78_COD_SOLICITACAO,',
'            :P78_MATRICULA,',
'            :P78_DT_SAIDA_PARC1,',
'            :P78_DT_RETORNO_PARC1,',
'            :P78_DT_SAIDA_PARC2,',
'            :P78_DT_RETORNO_PARC2,',
'            :P78_NUM_DIAS_PARC1,',
'            :P78_NUM_DIAS_PARC2,',
'            :P78_DT_SAIDA_PARC4,',
'            :P78_DIAS_ABONO_PEC1,',
'            :P78_DT_INIC_PER_FERIAS,',
'            :P78_DT_FIM_PER_FERIAS,',
'            :P78_SALDO,',
'            v_dias_direito,',
'            :P78_DT_LIMITE_REQ,',
'            :P78_NUM_DIAS_PARC4,',
'            :P78_DIAS_ABONO_PEC4,',
'            :P78_DT_RETORNO_PARC4,',
'            :P78_DT_PAGTO_PARC4,',
'            :P78_TIPO_FERIAS4,',
'            :P78_OPCAO_13SAL4,',
'            :P78_DIAS_ABONO_PEC1_DSP,',
'            :P78_NUM_DIAS_PARC1_DSP,',
'            FLG_RETORNO,',
'            MSG_RETORNO);',
'        ',
'        if trim(MSG_RETORNO) is not null and FLG_RETORNO = ''N'' then',
unistr('          :P78_MSG_APROVAR := ''Data de Sa\00EDda Parcela 3: ''||MSG_RETORNO;'),
'        end if;',
'    end if;',
'    ',
'end;'))
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
,p_process_when=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'    nR number := 0;',
'begin',
'    if :P78_COD_SOLICITACAO is not null then',
'        select  count(*)',
'        into    nR',
'        from    APROVA_FERIAS A',
'        where   A.COD_SOLICITACAO = :P78_COD_SOLICITACAO;',
'    end if;',
'    return nR > 0;',
'end;'))
,p_process_when_type=>'FUNCTION_BODY'
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(173363803673745608728)
,p_process_sequence=>10
,p_process_point=>'AFTER_SUBMIT'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'PARA REQ NO MESMO PERIODO'
,p_process_sql_clob=>wwv_flow_string.join(wwv_flow_t_varchar2(
':P78_COD_EMPRESA := :P78_COD_EMPRESA_1;',
':P78_DT_INIC_PER_FERIAS := :P78_DT_INIC_PER_FERIAS_1;',
':P78_DT_FIM_PER_FERIAS := :P78_DT_FIM_PER_FERIAS_1;',
':P78_IND_SITUACAO_PERIODO := :P78_IND_SITUACAO_PERIODO_A;',
':P78_FALTA_HORA := :P78_FALTA_HORA_1;',
':P78_FALTA_MINUTO := :P78_FALTA_MINUTO_1;',
':P78_DIAS_DESCANSO_ADICIONAL := nvl(:P78_DIAS_DESCANSO_ADICIONAL,:P78_DIAS_DESCANSO_ADICIONAL_1);',
':P78_SALDO_BRUTO := :P78_SALDO_BRUTO_1;',
':P78_SALDO := :P78_SALDO_1;',
':P78_IND_SITUACAO_PARC_2 := nvl(:P78_IND_SITUACAO_PARC_2,:P78_IND_SITUACAO_PARC_2_A);',
':P78_IND_SITUACAO_PARC_4 := nvl(:P78_IND_SITUACAO_PARC_4,:P78_IND_SITUACAO_PARC_4_A);',
':P78_DIAS_DIREITO := :P78_DIAS_DIREITO_1;',
' ',
'if :p78_op is not null then -- Igor 30/03',
':P78_OPCAO_FERIAS := :P78_OP;',
'elsif :P78_OPCAO_FERIAS_A is null and :P78_FLAG_CTRL = 2 then',
':P78_OPCAO_FERIAS := :P78_OPCAO_FERIAS_A;',
'end if;'))
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
,p_process_when_button_id=>wwv_flow_api.id(276329683628271718456)
,p_process_when=>'return nvl(:P78_FLAG_CTRL,0) = 1;'
,p_process_when_type=>'FUNCTION_BODY'
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(276329735729506718505)
,p_process_sequence=>30
,p_process_point=>'AFTER_SUBMIT'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'PRE-INSERT_1'
,p_process_sql_clob=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_dias_abono_pec1 number := :P78_dias_abono_pec1;',
'',
'v_seq number;',
'v_count number;',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'',
'begin',
'',
'v_item_validacao := null;',
':P78_ITEM_VALIDACAO := null;',
'',
' 	:P78_sit_requisicao := ''1'';',
'	--',
'  loop',
'	  begin',
'		SELECT seq_requisicao.NEXTVAL',
'	  INTO v_seq ',
'	  FROM DUAL;',
'	  end;',
'    select count(*)',
'      into v_count',
'      from requisicao_ferias r',
'     where r.cod_solicitacao = v_seq;',
'    ',
'    if v_count = 0 then',
'      exit;',
'    end if;',
'  end loop;',
'  ',
'  :P78_cod_solicitacao := v_seq;',
'	--',
'',
'  IF :p78_dt_saida_parc1 IS NOT NULL THEN',
'  :p78_dias_abono_pec1 := nvl(:p78_dias_abono_pec1_lst,0); ',
'  end if;',
'',
'  IF :p78_dt_saida_parc2 IS NOT NULL THEN',
'  :p78_dias_abono_pec2 := nvl(:p78_dias_abono_pec2_lst,0); ',
'  end if;',
'',
'  IF :p78_dt_saida_parc4 IS NOT NULL THEN',
'  :p78_dias_abono_pec4 := nvl(:p78_dias_abono_pec4_lst,0); ',
'  end if;',
'      ',
'    IF nvl(:P78_dias_abono_pec1,0) = 0 THEN',
'      :P78_opcao_abono_pec1 := ''N'';',
'    ELSIF nvl(:P78_dias_abono_pec1,0) > 0 THEN',
'      :P78_opcao_abono_pec1 := ''S'';',
'    END IF;',
'',
'  IF nvl(:P78_OPCAO_ABONO_PEC1,''N'') = ''N'' THEN',
'     :P78_OPCAO_ABONO_PEC1 := ''N'';',
'  ELSE',
'     :P78_OPCAO_ABONO_PEC1 := ''S'';',
'  END IF;',
'      ',
'  IF nvl(:P78_OPCAO_ABONO_PEC2,''N'') = ''N'' AND :P78_DT_SAIDA_PARC2 IS NULL THEN',
'     :P78_OPCAO_ABONO_PEC2 := null;',
'     :P78_DT_RETORNO_PARC2 := NULL; -- Igor 30/03',
'     :P78_DT_PAGTO_PARC2 := NULL; -- Bruno Sousa 09/01/2024',
'  ELSE',
'         IF NVL(:P78_OPCAO_ABONO_PEC2,''N'') = ''N'' AND :P78_DT_SAIDA_PARC2 IS NOT NULL THEN',
'            :P78_OPCAO_ABONO_PEC2 := ''N'';',
'      ELSIF NVL(:P78_OPCAO_ABONO_PEC2,''N'') = ''S'' AND :P78_DT_SAIDA_PARC2 IS NOT NULL THEN',
'            :P78_OPCAO_ABONO_PEC2 := ''S'';',
'      END IF;',
'  END IF;',
'  ',
'  IF :P78_DT_SAIDA_PARC2 IS NULL THEN -- Bruno Sousa 09/01/2024',
'     :P78_OPCAO_13SAL2 := null;',
'     :P78_DT_RETORNO_PARC2 := NULL; -- Igor 30/03',
'     :P78_DT_RETORNO_PARC2_1 := NULL; -- Bruno Sousa 09/01/2024',
'     :P78_DT_PAGTO_PARC2 := NULL; -- Bruno Sousa 09/01/2024',
'  ELSE',
'         IF NVL(:P78_OPCAO_13SAL2,''N'') = ''N'' AND :P78_DT_SAIDA_PARC2 IS NOT NULL THEN',
'            :P78_OPCAO_13SAL2 := ''N'';',
'      ELSIF NVL(:P78_OPCAO_13SAL2,''N'') = ''S'' AND :P78_DT_SAIDA_PARC2 IS NOT NULL THEN',
'            :P78_OPCAO_13SAL2 := ''S'';',
'      END IF;',
'  END IF;',
'',
'    IF nvl(:P78_dias_abono_pec4,0) = 0 and :P78_DT_SAIDA_PARC4 IS NOT NULL THEN',
'      :P78_opcao_abono_pec4 := ''N'';',
'    ELSIF nvl(:P78_dias_abono_pec4,0) > 0 and :P78_DT_SAIDA_PARC4 IS NOT NULL THEN',
'      :P78_opcao_abono_pec4 := ''S'';',
'    END IF;',
' ',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_create1''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_create1'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
'',
'end;'))
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
,p_process_when_button_id=>wwv_flow_api.id(276329683628271718456)
,p_process_when=>'return nvl(:P78_OK,''N'') = ''S'';'
,p_process_when_type=>'FUNCTION_BODY'
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(276329738608233718506)
,p_process_sequence=>40
,p_process_point=>'AFTER_SUBMIT'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'PRE-INSERT'
,p_process_sql_clob=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_dias_abono_pec1 number := :P78_dias_abono_pec1;',
'',
'v_seq number;',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'v_dias_abono_pec FERIAS.dias_abono_pec1%TYPE;',
'CURSOR C1 IS',
'SELECT CAD_VAGA',
'  FROM INFORMACOES_FUNCIONAIS',
' WHERE COD_EMPRESA = :P78_COD_EMPRESA',
'   AND MATRICULA = :P78_MATRICULA;',
'   ',
'V_C1 C1%ROWTYPE;',
'',
'begin',
'',
'OPEN C1;',
'FETCH C1 INTO V_C1;',
'CLOSE C1;',
'',
'IF V_C1.CAD_VAGA IS NOT NULL THEN',
':P78_COD_VAGA := V_C1.CAD_VAGA;',
'END IF;',
'',
'NULL;',
'',
'IF :P78_HAVERA_REP IS NULL THEN',
':P78_HAVERA_REP := ''N'';',
'END IF;',
'',
'	:P78_dt_solicitacao := sysdate;',
'	:P78_DT_ATUALIZACAO_PROG := SYSDATE;',
'	:P78_USUARIO_PROG        := TO_CHAR(:P_EMPRESA_USER)||''/''||TO_CHAR(:P_MATRICULA_USER);',
'	:P78_cod_emp_solicitante := :P_EMPRESA_USER;',
'	:P78_matricula_solicitante := :P_MATRICULA_USER;',
'	:P78_usuario             := TO_CHAR(:P_EMPRESA_USER)||''/''||TO_CHAR(:P_MATRICULA_USER);--:P_USUARIO;',
'    :P78_dt_atualizacao      := sysdate;',
'',
'  :P78_DT_SIT_SOLICITACAO := sysdate;',
'v_dias_abono_pec := nvl(:p78_dias_abono_pec1,:p78_dias_abono_pec1_1);',
'PKG_FERIAS.Pre_Insert( :p78_cod_solicitacao,',
'                       :p78_cod_empresa,',
'                       :p78_filial,',
'                       :p78_matricula,',
'                       :p78_sit_requisicao,',
'                       nvl(:p78_ind_situacao_periodo,:p78_ind_situacao_periodo_a),',
'                       nvl(:p78_dt_inic_per_ferias,:p78_dt_inic_per_ferias_1),',
'                       nvl(:p78_dt_fim_per_ferias,:p78_dt_fim_per_ferias_1),',
'                       nvl(:p78_num_dias_parc1,:p78_num_dias_parc1_1),',
'                       nvl(:p78_saldo,:p78_saldo_1),',
'                       nvl(:p78_dt_saida_parc1,:p78_dt_saida_parc1_1),',
'                       nvl(:p78_dt_saida_parc2,:p78_dt_saida_parc2_1),',
'                       :p78_dt_saida_parc3, -- Igor 30/03',
'                       nvl(:p78_dt_saida_parc4,:p78_dt_saida_parc4_1),',
'                       nvl(:p78_dt_retorno_parc1,NVL(:p78_dt_retorno_parc1_1, :P78_DT_RETORNO_PARC1_1_AUX)),',
'                       nvl(:p78_dt_retorno_parc2,:p78_dt_retorno_parc2_1),',
'                       :p78_dt_retorno_parc3, -- Igor 30/03',
'                       nvl(:p78_dt_retorno_parc4,:p78_dt_retorno_parc4_1),',
'                      :P78_opcao_13sal1,',
'                      :P78_opcao_13sal2,',
'                      :P78_opcao_13sal4,',
'                       v_dias_abono_pec,',
'                       :p78_jornada_reduzida,',
'                       v_flg_retorno,',
'                       v_msg_retorno,',
'					 :P78_PARCELAS_OPC);',
'            /*           ',
' if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
'    :p78_ok       := ''N'';',
'    :p78_flag     := v_flg_retorno;',
'    :p78_mensagem := v_msg_retorno;',
'   ',
' else',
'    :p78_flag     := null;',
'    :p78_mensagem := null;',
'    :p78_ok       := ''S'';',
' end if;',
'*/',
'end;'))
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
,p_process_when_button_id=>wwv_flow_api.id(276329683628271718456)
,p_process_when=>'return nvl(:P78_OK,''N'') = ''S'';'
,p_process_when_type=>'FUNCTION_BODY'
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(276329739728645718508)
,p_process_sequence=>50
,p_process_point=>'AFTER_SUBMIT'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'Valida_Update_Rf'
,p_process_sql_clob=>wwv_flow_string.join(wwv_flow_t_varchar2(
'/*',
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'v_dias_abono_pec1 number := :P78_dias_abono_pec1;',
'',
'v_item_validacao varchar2(20) := :P78_ITEM_VALIDACAO;',
'*/',
'begin',
'',
'null;',
'',
'/*',
'v_item_validacao := null;',
':P78_ITEM_VALIDACAO := null;',
'',
'PKG_FERIAS.Valida_Update_Rf(:P78_cod_empresa,',
'                            :P78_filial,',
'                            :P78_dt_saida_parc1,',
'                            :P78_dt_fim_per_ferias,',
'                            :P78_num_dias_parc1,',
'                            v_dias_abono_pec1,',
'                            :P78_saldo,',
'                            :p78_matricula,',
'                            :p78_jornada_reduzida,',
'                            V_flg_retorno,',
'                            V_msg_retorno);',
'',
'',
' if trim(v_msg_retorno) is not null then',
'',
'    if v_flg_retorno in (''N'',''Q'') then',
'        :P78_ok       := ''N'';',
'        :P78_ITEM_VALIDACAO := TRIM(UPPER(''p78_save1''));',
'    else',
'        :P78_ok       := ''S'';',
'    end if;',
'    ',
'    :P78_flag     := v_flg_retorno;',
'    :P78_mensagem := v_msg_retorno;',
' else',
'    :P78_flag     := null;',
'    :P78_mensagem := null;',
'    if v_item_validacao = TRIM(UPPER(''p78_save1'')) OR v_item_validacao IS NULL then',
'       :P78_OK := ''S'';',
'       :P78_ITEM_VALIDACAO := null;',
'    else',
'       :P78_ITEM_VALIDACAO := v_item_validacao;',
'    end if;',
' end if;',
' */',
'end;'))
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
,p_process_when_button_id=>wwv_flow_api.id(276329683306579718455)
,p_process_when=>'return nvl(:P78_OK,''N'') = ''S'';'
,p_process_when_type=>'FUNCTION_BODY'
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(275840404064499316888)
,p_process_sequence=>60
,p_process_point=>'AFTER_SUBMIT'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'PRE-UPDATE (antes)'
,p_process_sql_clob=>wwv_flow_string.join(wwv_flow_t_varchar2(
'begin',
'',
'	:P78_usuario             := TO_CHAR(:P_EMPRESA_USER)||''/''||TO_CHAR(:P_MATRICULA_USER);--:P_USUARIO;',
'    :P78_dt_atualizacao      := sysdate;',
'',
'end;'))
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
,p_process_when_button_id=>wwv_flow_api.id(276329683306579718455)
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(164084768150771803554)
,p_process_sequence=>70
,p_process_point=>'AFTER_SUBMIT'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'PARA REQ NO MESMO PERIODO_1'
,p_process_sql_clob=>wwv_flow_string.join(wwv_flow_t_varchar2(
':P78_DT_SAIDA_PARC1 := nvl(:P78_DT_SAIDA_PARC1,:P78_DT_SAIDA_PARC1_1);',
':P78_NUM_DIAS_PARC1 := nvl(:P78_NUM_DIAS_PARC1,:P78_NUM_DIAS_PARC1_1);',
':P78_DIAS_ABONO_PEC1 := nvl(:P78_DIAS_ABONO_PEC1,:P78_DIAS_ABONO_PEC1_1);',
':P78_OPCAO_13SAL1 := nvl(:P78_OPCAO_13SAL1,:P78_OPCAO_13SAL1_1);',
':P78_DT_RETORNO_PARC1 := nvl(:P78_DT_RETORNO_PARC1,:P78_DT_RETORNO_PARC1_1);',
'',
':P78_DT_SAIDA_PARC2 := nvl(:P78_DT_SAIDA_PARC2,:P78_DT_SAIDA_PARC2_1);',
':P78_NUM_DIAS_PARC2 := nvl(:P78_NUM_DIAS_PARC2,:P78_NUM_DIAS_PARC2_1);',
':P78_DIAS_ABONO_PEC2 := nvl(:P78_DIAS_ABONO_PEC2,:P78_DIAS_ABONO_PEC2_1);',
':P78_OPCAO_13SAL2 := nvl(:P78_OPCAO_13SAL2,:P78_OPCAO_13SAL2_1);',
':P78_DT_RETORNO_PARC2 := nvl(:P78_DT_RETORNO_PARC2,:P78_DT_RETORNO_PARC2_1);',
''))
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
,p_process_when_button_id=>wwv_flow_api.id(276329683628271718456)
,p_process_when=>'return nvl(:P78_FLAG_CTRL,0) = 1;'
,p_process_when_type=>'FUNCTION_BODY'
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(276329738125394718506)
,p_process_sequence=>80
,p_process_point=>'AFTER_SUBMIT'
,p_process_type=>'NATIVE_FORM_PROCESS'
,p_process_name=>'Automatic Row Processing'
,p_attribute_02=>'REQUISICAO_FERIAS'
,p_attribute_03=>'P78_ROWID'
,p_attribute_04=>'ROWID'
,p_attribute_09=>'P78_ROWID'
,p_attribute_11=>'I'
,p_attribute_12=>'Y'
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
,p_process_when_button_id=>wwv_flow_api.id(276329683628271718456)
,p_process_when=>'return nvl(:P78_OK,''N'') = ''S'';'
,p_process_when_type=>'FUNCTION_BODY'
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(121626765080427574273)
,p_process_sequence=>90
,p_process_point=>'AFTER_SUBMIT'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'AJUSTA_SOLICITANTE'
,p_process_sql_clob=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'cursor C_dados is',
'SELECT MATRICULA_SOLICITANTE ',
'FROM REQUISICAO_FERIAS',
'where COD_SOLICITACAO = :P78_cod_solicitacao;',
'',
'V_valida_mat number;',
'',
'begin',
'',
'',
'OPEN C_dados;',
'FETCH  C_dados INTO V_valida_mat;',
'CLOSE  C_dados;',
'',
'if V_valida_mat is null then ',
'   update REQUISICAO_FERIAS set MATRICULA_SOLICITANTE = :P78_MATRICULA_SOLIC',
'                             ,  COD_EMP_SOLICITANTE = :P78_EMP_SOLIC',
'    where COD_SOLICITACAO = :P78_cod_solicitacao;',
'  commit;',
'end if;',
'',
'end;'))
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(276329739403103718508)
,p_process_sequence=>100
,p_process_point=>'AFTER_SUBMIT'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'PRE-UPDATE (depois)'
,p_process_sql_clob=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'',
'PKG_FERIAS.Pre_Update ( :p78_cod_solicitacao,',
'                       :p78_sit_requisicao,',
'                       :p78_dt_saida_parc1,',
'                       :p78_dt_saida_parc2,',
'                       :p78_dt_saida_parc3,',
'                       :p78_dt_saida_parc4,',
'                       :p78_dt_retorno_parc1,',
'                       :p78_dt_retorno_parc2,',
'                       :p78_dt_retorno_parc3,',
'                       :p78_dt_retorno_parc4,',
'                       :p78_usuario,',
'                       v_flg_retorno,',
'                       v_msg_retorno);',
'',
' if trim(v_msg_retorno) is not null and v_flg_retorno = ''N'' then',
'    :p78_ok       := ''N'';',
'    :p78_flag     := v_flg_retorno;',
'    :p78_mensagem := v_msg_retorno;',
' else',
'    :p78_flag     := null;',
'    :p78_mensagem := null;',
'    :p78_ok       := ''S'';',
' end if;',
' ',
'end;'))
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
,p_process_when_button_id=>wwv_flow_api.id(276329683306579718455)
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(276329738920811718507)
,p_process_sequence=>110
,p_process_point=>'AFTER_SUBMIT'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'POST-INSERT'
,p_process_sql_clob=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'',
'PKG_FERIAS.Post_Insert(:P78_cod_empresa          ,',
'                       :P78_cod_solicitacao      ,',
'                       :p_usuario                ,',
'                       V_flg_retorno             ,',
'                       V_msg_retorno             );',
'',
'commit;',
'',
' if v_msg_retorno is not null then',
'    :p78_ok       := ''N'';',
'    :p78_flag     := v_flg_retorno;',
'    :p78_mensagem := v_msg_retorno;',
' else',
'    :p78_flag     := null;',
'    :p78_mensagem := null;',
'    :p78_ok       := ''S'';',
' end if;',
'',
'end;'))
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
,p_process_when_button_id=>wwv_flow_api.id(276329683628271718456)
,p_process_when=>'return nvl(:P78_OK,''N'') = ''S'';'
,p_process_when_type=>'FUNCTION_BODY'
,p_process_success_message=>unistr('Requisi\00E7\00E3o criada com Sucesso!')
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(276329740169622718508)
,p_process_sequence=>120
,p_process_point=>'AFTER_SUBMIT'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'POST-UPDATE'
,p_process_sql_clob=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'v_flg_retorno varchar2(3);',
'v_msg_retorno varchar2(4000);',
'',
'begin',
'',
'PKG_FERIAS.Post_Update(:P78_cod_empresa          ,',
'                       :P78_cod_solicitacao      ,',
'                      V_flg_retorno             ,',
'                      V_msg_retorno             );',
'',
'commit;',
' ',
' if v_msg_retorno is not null then',
'    :p78_ok       := ''N'';',
'    :p78_flag     := v_flg_retorno;',
'    :p78_mensagem := v_msg_retorno;',
' else',
'    :p78_flag     := null;',
'    :p78_mensagem := null;',
'    :p78_ok       := ''S'';',
' end if;',
'',
'end;'))
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
,p_process_when_button_id=>wwv_flow_api.id(276329683306579718455)
,p_process_success_message=>unistr('Requisi\00E7\00E3o alterada com Sucesso!')
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(164084768219146803555)
,p_process_sequence=>130
,p_process_point=>'AFTER_SUBMIT'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'PARA REQ NO MESMO PERIODO_2'
,p_process_sql_clob=>wwv_flow_string.join(wwv_flow_t_varchar2(
'begin',
'    /* Comentado por Bruno Sousa 10/01/2024',
'    for C in (',
'        select  A.DT_RETORNO_PARC1,',
'                A.IND_SITUACAO_PARC_1,',
'                A.DT_RETORNO_PARC2,',
'                A.IND_SITUACAO_PARC_2',
'        from    REQUISICAO_FERIAS A',
'        where   A.COD_SOLICITACAO = :P78_COD_REQ ',
'    ) loop',
'        update  REQUISICAO_FERIAS A',
'        set     A.DT_RETORNO_PARC1      = nvl(A.DT_RETORNO_PARC1,C.DT_RETORNO_PARC1),',
'                A.IND_SITUACAO_PARC_1   = nvl(A.IND_SITUACAO_PARC_1,C.IND_SITUACAO_PARC_1),',
'                A.DT_RETORNO_PARC2      = nvl(A.DT_RETORNO_PARC2,C.DT_RETORNO_PARC2),',
'                A.IND_SITUACAO_PARC_2   = nvl(A.IND_SITUACAO_PARC_2,C.IND_SITUACAO_PARC_2)',
'        where   A.ROWID = :P78_ROWID;',
'    end loop;',
'    */',
'    update  REQUISICAO_FERIAS A',
'    set     A.SIT_REQUISICAO = 3',
'    where   A.SIT_REQUISICAO = 1',
'    and     A.ROWID != :P78_ROWID',
'    and     A.COD_EMPRESA = :P78_COD_EMPRESA',
'    AND     A.MATRICULA = :P78_MATRICULA',
'    and     exists (',
'                        select  1',
'                        from    REQUISICAO_FERIAS B',
'                        where B.COD_SOLICITACAO = :P78_COD_REQ',
'                        and     B.COD_EMPRESA = A.COD_EMPRESA',
'                        and     B.MATRICULA = A.MATRICULA',
'                        and     to_date(B.DT_INIC_PER_FERIAS,''DD/MM/RRRR'') = to_date(A.DT_INIC_PER_FERIAS,''DD/MM/RRRR'')',
'                    );',
'                    ',
'    if :p78_dt_saida_Parc2 is null then -- Igor 30/03/2023',
'      ',
'      update requisicao_ferias',
'         set dt_saida_parc2 = null,',
'             num_dias_parc2 = null,',
'             dias_abono_pec2 = null,',
'             opcao_13sal2 = null,',
'             desc_adicional2 = null,',
'             dt_retorno_parc2 = null,',
'             tipo_ferias2 = null',
'       where cod_solicitacao = :P78_COD_REQ;',
'       ',
'       commit;',
'    ',
'    end if;',
'    ',
'    if :p78_dt_saida_Parc4 is null then  -- Igor 30/03/2023',
'      ',
'      update requisicao_ferias',
'         set dt_saida_parc4 = null,',
'             num_dias_parc4 = null,',
'             dias_abono_pec4 = null,',
'             opcao_13sal4 = null,',
'             desc_adicional4 = null,',
'             dt_retorno_parc4 = null,',
'             tipo_ferias4 = null',
'       where cod_solicitacao = :P78_COD_REQ;',
'       ',
'       commit;',
'    ',
'    end if;',
'                    ',
'end;'))
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
,p_process_when_button_id=>wwv_flow_api.id(276329683628271718456)
,p_process_when=>'return nvl(:P78_FLAG_CTRL,0) = 1;'
,p_process_when_type=>'FUNCTION_BODY'
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(276329740933140718509)
,p_process_sequence=>140
,p_process_point=>'AFTER_SUBMIT'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'formato data dt_atualizacao'
,p_process_sql_clob=>wwv_flow_string.join(wwv_flow_t_varchar2(
'if :P78_COD_SOLICITACAO is not null then',
'',
'    begin',
'    update requisicao_ferias',
'    set dt_atualizacao = sysdate, dt_atualizacao_prog = sysdate',
'    where COD_SOLICITACAO = :P78_COD_SOLICITACAO;',
'',
'    commit;',
'',
'    end;',
'',
'end if;'))
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
,p_process_when_type=>'NEVER'
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(276329736552439718505)
,p_process_sequence=>10
,p_process_point=>'BEFORE_HEADER'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'usuario'
,p_process_sql_clob=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'v_usuario varchar2(40);',
'begin',
'',
'    EXECUTE IMMEDIATE ''ALTER SESSION SET NLS_NUMERIC_CHARACTERS= ''''.,'''' '';',
'',
'    BEGIN',
'    PKG_IDIOMA.SETA_IDIOMA(''AMERICAN'');',
'    END;',
'',
'    if :p78_matricula is not null then',
'    :p78_emp := :p78_cod_empresa;',
'    :p78_mat := :p78_matricula;',
'    end if;',
'',
'end;'))
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(276329736162370718505)
,p_process_sequence=>20
,p_process_point=>'BEFORE_HEADER'
,p_process_type=>'NATIVE_FORM_FETCH'
,p_process_name=>'Automatic Row Fetch requsicao_ferias'
,p_attribute_02=>'REQUISICAO_FERIAS'
,p_attribute_03=>'P78_COD_EMPRESA'
,p_attribute_04=>'COD_EMPRESA'
,p_attribute_05=>'P78_COD_SOLICITACAO'
,p_attribute_06=>'COD_SOLICITACAO'
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
,p_process_when=>'P78_COD_SOLICITACAO'
,p_process_when_type=>'ITEM_IS_NOT_NULL'
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(276329737014194718506)
,p_process_sequence=>30
,p_process_point=>'BEFORE_HEADER'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'popula_colab'
,p_process_sql_clob=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'',
'cursor c1 is',
'select i.cod_empresa||'' - ''||initcap(fnct_nome_empresa(i.cod_empresa)) empresa,',
'       i.matricula||'' - ''||initcap(fnct_nome_func(i.cod_empresa, i.matricula)) matricula,',
'       i.situacao||'' - ''||initcap(fnct_nome_situacao(i.situacao))||'' - ''||i.dt_situacao situacao,',
'       i.dt_admissao,',
'       I.FILIAL,',
'       i.dc_matricula,',
'       I.VINCULO',
'  from informacoes_funcionais_cad i',
' where i.cod_empresa = :p78_cod_empresa',
'   and i.matricula = :p78_matricula;',
'                   ',
'v_c1 c1%rowtype;',
'',
'',
'cursor c3 (v_filial number) is',
'select qtd_parcelas',
'  from ferias_Parametros',
' where cod_empresa = :P78_cod_empresa',
'   and cod_filial = v_filial;',
'   ',
'v_c3 c3%rowtype;',
'',
'CURSOR C4 IS',
'SELECT CAD_VAGA',
'  FROM INFORMACOES_FUNCIONAIS',
' WHERE COD_EMPRESA = :P78_COD_EMPRESA',
'   AND MATRICULA = :P78_MATRICULA;',
'   ',
'V_C4 C4%ROWTYPE;',
'',
'begin',
'',
'open c1;',
'fetch c1 into v_c1;',
'close c1;',
'',
':p78_cod_empresa_display := v_c1.empresa;',
':p78_matricula_display := v_c1.matricula;',
':p78_situacao_colab := v_c1.situacao;',
':p78_dt_admissao := v_c1.dt_admissao;',
':p78_dc_matricula := v_c1.dc_matricula;',
'',
'if :p78_cod_solicitacao is null then',
'   :P78_TIPO_FERIAS1 := ''N'';',
'end if;',
'',
'open  c3(v_c1.filial);',
'fetch c3 into v_c3;',
'close c3;',
'',
':p78_qtd_parcelas := v_c3.qtd_parcelas;',
'',
'if :P78_ROWID is null and :p78_cod_solicitacao is not null then',
':p78_cod_solicitacao := null;',
'end if;',
'',
'OPEN C4;',
'FETCH C4 INTO V_C4;',
'CLOSE C4;',
'',
'IF V_C4.CAD_VAGA IS NOT NULL THEN',
':P78_COD_VAGA := V_C4.CAD_VAGA;',
'END IF;',
'',
':P78_VINCULO := V_C1.VINCULO;',
'',
'if :P78_ROWID is not null then',
'  :p78_load := ''S'';',
'else',
'  :p78_load := ''N'';',
'end if;',
'exception',
'when others then',
':p78_cod_empresa_display := :p78_cod_empresa;',
':p78_matricula_display := :p78_matricula;',
'end;'))
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
);
end;
/
begin
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(142186507569585432543)
,p_process_sequence=>40
,p_process_point=>'BEFORE_HEADER'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'Dias Direito Formato'
,p_process_sql_clob=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'    v_dias_number number;',
'    v_dias_char varchar2(10) := :P78_DIAS_DIREITO; -- Igor 30/03',
'begin',
'',
'    if instr(v_dias_char,''.'') > 0 then',
'       v_dias_number := replace(v_dias_char,''.'','','');',
'       :P78_DIAS_DIREITO := v_dias_number;',
'       :P78_DIAS_DIREITO_1 := v_dias_number;',
'    end if;',
'',
'end;'))
,p_error_display_location=>'INLINE_IN_NOTIFICATION'
);
wwv_flow_api.create_page_process(
 p_id=>wwv_flow_api.id(142186507635102432544)
,p_process_sequence=>50
,p_process_point=>'BEFORE_HEADER'
,p_process_type=>'NATIVE_PLSQL'
,p_process_name=>'Dias Direito OPC Formato'
,p_process_sql_clob=>wwv_flow_string.join(wwv_flow_t_varchar2(
'declare',
'    v_dias_number number;',
'    v_dias_char varchar2(10) := :P78_DIAS_DIREITO_OPC; -- Igor 30/03',
'begin',
'',
'    if instr(v_dias_char,''.'') > 0 then',
'       v_dias_number := replace(v_dias_char,''.'','','');',
'       :P78_DIAS_DIREITO_OPC := v_dias_number;',
'    end if;',
'',
'end;'))
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
