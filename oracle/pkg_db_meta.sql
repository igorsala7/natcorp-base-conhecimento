-- ============================================================================
--  PKG_DB_META — extrai os METADADOS de OBJETOS DE BANCO Oracle (tabelas, colunas,
--  views, triggers, procedures, functions, packages) do dicionário (ALL_*) e devolve
--  um JSON único. Alimenta, do lado da plataforma (Fase D):
--    (1) o mesmo dicionário de dados + ontologia (comentário da coluna vira termo),
--    (2) a documentação TÉCNICA "parruda" — um artigo por objeto — para os analistas
--        de sistemas e programadores da Natcorp.
--
--  Publicação: exponha `pkg_db_meta.f_schema_json(...)` por ORDS (GET) OU por um
--  Processo On-Demand, e cole/suba o JSON em Admin → Ontologia → "Objetos de banco".
--
--  Escopo: por padrão o SCHEMA atual. Filtre por nome (LIKE) e por tipo para não
--  despejar o banco inteiro de uma vez. Ex.: f_schema_json(p_name_like => 'FIN\_%').
--
--  Privilégios: SELECT nas views ALL_* e EXECUTE em DBMS_METADATA (geralmente já
--  concedido). get_ddl de objeto de outro schema exige SELECT_CATALOG_ROLE.
--
--  Dependência: APEX_JSON (presente em bancos com APEX; o ambiente-alvo tem 19.2).
-- ============================================================================
create or replace package pkg_db_meta as
  -- JSON: { tables:[{name,comment,columns:[{name,type,nullable,comment}]}],
  --         views:[{name,comment,text}],
  --         code:[{name,kind,table,source}] }   (CLOB)
  function f_schema_json(
    p_owner     in varchar2 default sys_context('userenv','current_schema'),
    p_name_like in varchar2 default '%',
    p_tables    in varchar2 default 'Y',
    p_views     in varchar2 default 'Y',
    p_code      in varchar2 default 'Y'
  ) return clob;
end pkg_db_meta;
/
create or replace package body pkg_db_meta as

  -- DDL (CLOB) de um objeto; devolve NULL em vez de estourar (privilégio/objeto ausente).
  function ddl(p_kind in varchar2, p_name in varchar2, p_owner in varchar2) return clob is
    l clob;
  begin
    l := dbms_metadata.get_ddl(p_kind, p_name, p_owner);
    return l;
  exception when others then
    return null;
  end ddl;

  function f_schema_json(
    p_owner     in varchar2 default sys_context('userenv','current_schema'),
    p_name_like in varchar2 default '%',
    p_tables    in varchar2 default 'Y',
    p_views     in varchar2 default 'Y',
    p_code      in varchar2 default 'Y'
  ) return clob is
    l_out   clob;
    l_owner varchar2(128) := upper(p_owner);
    l_like  varchar2(256) := upper(p_name_like);
    l_src   clob;
  begin
    begin
      dbms_metadata.set_transform_param(dbms_metadata.session_transform, 'PRETTY', true);
      dbms_metadata.set_transform_param(dbms_metadata.session_transform, 'SQLTERMINATOR', true);
      dbms_metadata.set_transform_param(dbms_metadata.session_transform, 'SEGMENT_ATTRIBUTES', false);
      dbms_metadata.set_transform_param(dbms_metadata.session_transform, 'STORAGE', false);
    exception when others then null;
    end;

    apex_json.initialize_clob_output;
    apex_json.open_object;

    -- ── Tabelas + colunas ────────────────────────────────────────────────────
    apex_json.open_array('tables');
    if nvl(p_tables, 'Y') = 'Y' then
      for t in (
        select t.table_name,
               (select c.comments from all_tab_comments c
                 where c.owner = t.owner and c.table_name = t.table_name
                   and c.table_type = 'TABLE') as tbl_comment
          from all_tables t
         where t.owner = l_owner
           and t.table_name like l_like escape '\'
         order by t.table_name
      ) loop
        apex_json.open_object;
        apex_json.write('name', t.table_name);
        apex_json.write('comment', t.tbl_comment);
        apex_json.open_array('columns');
        for c in (
          select col.column_name,
                 case
                   when col.data_type in ('VARCHAR2','CHAR','NVARCHAR2','NCHAR','RAW')
                     then col.data_type || '(' || col.data_length || ')'
                   when col.data_type = 'NUMBER' and col.data_precision is not null
                     then 'NUMBER(' || col.data_precision ||
                          case when nvl(col.data_scale, 0) > 0 then ',' || col.data_scale end || ')'
                   else col.data_type
                 end as col_type,
                 col.nullable,
                 (select cc.comments from all_col_comments cc
                   where cc.owner = col.owner and cc.table_name = col.table_name
                     and cc.column_name = col.column_name) as col_comment
            from all_tab_columns col
           where col.owner = l_owner and col.table_name = t.table_name
           order by col.column_id
        ) loop
          apex_json.open_object;
          apex_json.write('name', c.column_name);
          apex_json.write('type', c.col_type);
          apex_json.write('nullable', c.nullable);          -- 'Y'/'N' (Y = aceita nulo)
          apex_json.write('comment', c.col_comment);
          apex_json.close_object;
        end loop;
        apex_json.close_array;
        apex_json.close_object;
      end loop;
    end if;
    apex_json.close_array;

    -- ── Views ────────────────────────────────────────────────────────────────
    apex_json.open_array('views');
    if nvl(p_views, 'Y') = 'Y' then
      for v in (
        select v.view_name,
               (select c.comments from all_tab_comments c
                 where c.owner = v.owner and c.table_name = v.view_name
                   and c.table_type = 'VIEW') as vw_comment
          from all_views v
         where v.owner = l_owner
           and v.view_name like l_like escape '\'
         order by v.view_name
      ) loop
        apex_json.open_object;
        apex_json.write('name', v.view_name);
        apex_json.write('comment', v.vw_comment);
        apex_json.write('text', ddl('VIEW', v.view_name, l_owner));
        apex_json.close_object;
      end loop;
    end if;
    apex_json.close_array;

    -- ── Código: triggers, procedures, functions, packages ────────────────────
    apex_json.open_array('code');
    if nvl(p_code, 'Y') = 'Y' then
      -- Triggers (com a tabela de origem)
      for tr in (
        select trigger_name, table_name
          from all_triggers
         where owner = l_owner
           and trigger_name like l_like escape '\'
         order by trigger_name
      ) loop
        apex_json.open_object;
        apex_json.write('name', tr.trigger_name);
        apex_json.write('kind', 'trigger');
        apex_json.write('table', tr.table_name);
        apex_json.write('source', ddl('TRIGGER', tr.trigger_name, l_owner));
        apex_json.close_object;
      end loop;

      -- Procedures / Functions / Packages
      for ob in (
        select object_name, object_type
          from all_objects
         where owner = l_owner
           and object_type in ('PROCEDURE', 'FUNCTION', 'PACKAGE')
           and object_name like l_like escape '\'
         order by object_type, object_name
      ) loop
        if ob.object_type = 'PACKAGE' then
          l_src := ddl('PACKAGE', ob.object_name, l_owner);
          declare l_body clob;
          begin
            l_body := ddl('PACKAGE_BODY', ob.object_name, l_owner);
            if l_body is not null then l_src := l_src || chr(10) || l_body; end if;
          end;
        else
          l_src := ddl(ob.object_type, ob.object_name, l_owner);
        end if;
        apex_json.open_object;
        apex_json.write('name', ob.object_name);
        apex_json.write('kind', lower(ob.object_type));   -- procedure|function|package
        apex_json.write('table', null);
        apex_json.write('source', l_src);
        apex_json.close_object;
      end loop;
    end if;
    apex_json.close_array;

    apex_json.close_object;
    l_out := apex_json.get_clob_output;
    apex_json.free_output;
    return l_out;
  end f_schema_json;

end pkg_db_meta;
/
