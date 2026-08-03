-- ============================================================================
--  PKG_APEX_META — extrai os METADADOS de uma aplicação Oracle APEX a partir do
--  DICIONÁRIO (views APEX_APPLICATION_*) e devolve um JSON único. Alimenta, do
--  lado da plataforma: (1) dicionário de dados + ontologia/RAG (item↔coluna↔label),
--  (2) tradução da interface (XLIFF) e (3) geração de documentação por página.
--
--  Publicação: exponha `pkg_apex_meta.f_app_json(p_app_id)` por ORDS (GET) OU por
--  um Processo On-Demand (como o PRC_DADOS_IR). Crie no PARSING SCHEMA do app.
--
--  Workspace: as views APEX_APPLICATION_* filtram pela WORKSPACE do chamador.
--  Se rodar por ORDS num schema sem associação, chame antes:
--     apex_util.set_workspace(p_workspace => '<SUA_WORKSPACE>');
--  (ou apex_application_install / set_security_group_id).
--
--  Versão-alvo: APEX 19.2. Alguns NOMES DE COLUNA de views mudam entre versões —
--  ajuste se sua release divergir (marcados com  -- [ver.]).
-- ============================================================================
create or replace package pkg_apex_meta as
  -- JSON completo da aplicação (app + páginas + componentes). CLOB.
  function f_app_json(p_app_id in number) return clob;
end pkg_apex_meta;
/
create or replace package body pkg_apex_meta as

  function f_app_json(p_app_id in number) return clob is
    l clob;
  begin
    apex_json.initialize_clob_output;
    apex_json.open_object;

    -- ── Aplicação ────────────────────────────────────────────────────────────
    apex_json.open_object('app');
    for a in (
      select application_id, application_name, alias
        from apex_applications
       where application_id = p_app_id
    ) loop
      apex_json.write('id', a.application_id);
      apex_json.write('name', a.application_name);
      apex_json.write('alias', a.alias);
    end loop;
    apex_json.close_object;

    -- ── Páginas ──────────────────────────────────────────────────────────────
    apex_json.open_array('pages');
    for p in (
      select page_id, page_name, page_title, page_mode
        from apex_application_pages
       where application_id = p_app_id
       order by page_id
    ) loop
      apex_json.open_object;
      apex_json.write('id', p.page_id);
      apex_json.write('name', p.page_name);
      apex_json.write('title', p.page_title);
      apex_json.write('mode', p.page_mode);
      apex_json.close_object;
    end loop;
    apex_json.close_array;

    -- ── Regiões (nome + tipo + SQL de origem — usado p/ mapear coluna↔label) ───
    apex_json.open_array('regions');
    for r in (
      select page_id, region_id, region_name, source_type_code, region_source  -- [ver.]
        from apex_application_page_regions
       where application_id = p_app_id
       order by page_id, region_id
    ) loop
      apex_json.open_object;
      apex_json.write('page_id', r.page_id);
      apex_json.write('id', r.region_id);
      apex_json.write('name', r.region_name);
      apex_json.write('type', r.source_type_code);
      apex_json.write('sql', dbms_lob.substr(r.region_source, 3900, 1)); -- prévia do SELECT
      apex_json.close_object;
    end loop;
    apex_json.close_array;

    -- ── Itens (label = prompt; source = coluna do banco quando DB Column) ──────
    apex_json.open_array('items');
    for i in (
      select page_id, region_id, item_name, prompt, display_as_code,          -- [ver.]
             source_type_code, source                                          -- [ver.]
        from apex_application_page_items
       where application_id = p_app_id
       order by page_id, item_name
    ) loop
      apex_json.open_object;
      apex_json.write('page_id', i.page_id);
      apex_json.write('region_id', i.region_id);
      apex_json.write('name', i.item_name);
      apex_json.write('label', i.prompt);
      apex_json.write('display_as', i.display_as_code);
      apex_json.write('source_type', i.source_type_code);
      apex_json.write('source', i.source); -- coluna do banco quando source_type = DB Column
      apex_json.close_object;
    end loop;
    apex_json.close_array;

    -- ── Botões ─────────────────────────────────────────────────────────────────
    apex_json.open_array('buttons');
    for b in (
      select page_id, region_id, button_name, label
        from apex_application_page_buttons
       where application_id = p_app_id
       order by page_id
    ) loop
      apex_json.open_object;
      apex_json.write('page_id', b.page_id);
      apex_json.write('name', b.button_name);
      apex_json.write('label', b.label);
      apex_json.close_object;
    end loop;
    apex_json.close_array;

    -- ── Colunas de relatório: Classic + Interactive Report + Interactive Grid ──
    apex_json.open_array('report_columns');
    for c in (
      select 'classic' as kind, page_id, region_id, column_alias, heading as label
        from apex_application_page_rpt_cols
       where application_id = p_app_id
      union all
      select 'ir' as kind, page_id, region_id, column_alias, report_label as label
        from apex_application_page_ir_col
       where application_id = p_app_id
      union all
      select 'ig' as kind, page_id, region_id, name as column_alias, heading as label  -- [ver.]
        from apex_appl_page_ig_columns
       where application_id = p_app_id
    ) loop
      apex_json.open_object;
      apex_json.write('kind', c.kind);
      apex_json.write('page_id', c.page_id);
      apex_json.write('region_id', c.region_id);
      apex_json.write('alias', c.column_alias);
      apex_json.write('label', c.label);
      apex_json.close_object;
    end loop;
    apex_json.close_array;

    -- ── Breadcrumbs + Listas/menus (labels de navegação) ───────────────────────
    apex_json.open_array('breadcrumbs');
    for bc in (
      select page_id, short_name, long_name
        from apex_application_bc_entries                                        -- [ver.]
       where application_id = p_app_id
    ) loop
      apex_json.open_object;
      apex_json.write('page_id', bc.page_id);
      apex_json.write('label', nvl(bc.long_name, bc.short_name));
      apex_json.close_object;
    end loop;
    apex_json.close_array;

    apex_json.open_array('list_entries');
    for le in (
      select list_name, entry_text
        from apex_application_list_entries
       where application_id = p_app_id
    ) loop
      apex_json.open_object;
      apex_json.write('list', le.list_name);
      apex_json.write('label', le.entry_text);
      apex_json.close_object;
    end loop;
    apex_json.close_array;

    -- ── Comportamento (p/ a documentação): validações, processes, DAs ──────────
    apex_json.open_array('validations');
    for v in (
      select page_id, validation_name, error_message
        from apex_application_page_val
       where application_id = p_app_id
    ) loop
      apex_json.open_object;
      apex_json.write('page_id', v.page_id);
      apex_json.write('name', v.validation_name);
      apex_json.write('message', v.error_message);
      apex_json.close_object;
    end loop;
    apex_json.close_array;

    apex_json.open_array('processes');
    for pr in (
      select page_id, process_name, process_type_code, process_point_code       -- [ver.]
        from apex_application_page_proc
       where application_id = p_app_id
    ) loop
      apex_json.open_object;
      apex_json.write('page_id', pr.page_id);
      apex_json.write('name', pr.process_name);
      apex_json.write('type', pr.process_type_code);
      apex_json.write('point', pr.process_point_code);
      apex_json.close_object;
    end loop;
    apex_json.close_array;

    apex_json.open_array('dynamic_actions');
    for da in (
      select page_id, dynamic_action_name, when_event_code                      -- [ver.]
        from apex_application_page_da
       where application_id = p_app_id
    ) loop
      apex_json.open_object;
      apex_json.write('page_id', da.page_id);
      apex_json.write('name', da.dynamic_action_name);
      apex_json.write('event', da.when_event_code);
      apex_json.close_object;
    end loop;
    apex_json.close_array;

    apex_json.close_object;
    l := apex_json.get_clob_output;
    apex_json.free_output;
    return l;
  exception
    when others then
      begin apex_json.free_output; exception when others then null; end;
      apex_json.initialize_clob_output;
      apex_json.open_object;
      apex_json.write('ok', false);
      apex_json.write('erro', sqlerrm);
      apex_json.close_object;
      l := apex_json.get_clob_output;
      apex_json.free_output;
      return l;
  end f_app_json;

end pkg_apex_meta;
/
