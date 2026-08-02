-- ============================================================================
--  fnct_ir_data — devolve 100% das linhas de um Interactive Report do APEX,
--  respeitando filtros/busca/ordenação, autorização e VPD do usuário.
--
--  ARQUITETURA (multi-schema): a API (ORDS) vive num schema (ex.: API_NATCORP),
--  mas o APP/IR e as TABELAS vivem no PARSING SCHEMA do app (ex.: RHNATCORP, que
--  MUDA por cliente). apex_session.attach / apex_ir.get_report / a SQL do IR
--  precisam rodar NO parsing schema do app — chamá-los de um schema estranho dá
--  ORA-20987. Solução (função DEFINER no schema de dados):
--
--    PARTE A — cria a FUNÇÃO no schema de DADOS de cada cliente (RHNATCORP, ...).
--              Roda com os direitos dele → lê as tabelas nativamente, SEM grant.
--    PARTE B — GRANT EXECUTE da função ao schema da API (API_NATCORP).
--    PARTE C — módulo ORDS no schema da API: descobre o parsing schema do app e
--              chama "<schema>".fnct_ir_data(...) dinamicamente.
--
--  Contrato de resposta (estável — o widget depende disto):
--    { "ok": true, "colunas": [...], "linhas": [[...],...], "total": N }
--    { "ok": false, "erro": "mensagem", "detalhe": "backtrace" }
-- ============================================================================

-- ============================================================================
--  PARTE A — FUNÇÃO. Precisa ser OWNED pelo parsing schema do app (ex.: RHNATCORP).
--  Conecte NAQUELE schema e rode este CREATE — a função tem que PERTENCER a ele.
--
--  ⚠️ NÃO adianta criar a função num schema (ex.: NATCORP) e fazer SYNONYM em
--     RHNATCORP: função AUTHID DEFINER (o padrão) roda SEMPRE com o schema do DONO.
--     Via synonym ela continua rodando como NATCORP → apex_session.attach/get_report
--     ficam fora do schema do app (ORA-20987) e a SQL do IR não acha as tabelas.
--     Tem que ser um CREATE FUNCTION de verdade DENTRO de RHNATCORP.
--
--  Assim, como vive no parsing schema do app, NÃO precisa de current_schema nem
--  grants de tabela — a SQL do IR resolve tudo nativamente.
-- ============================================================================
create or replace function fnct_ir_data(
  p_app_id     in number,
  p_page_id    in number,
  p_session    in varchar2,               -- TEXTO (mantido p/ log; NÃO usamos attach)
  p_region     in varchar2 default null,  -- static id OU "R<region_id>" OU vazio (usa o único IR da página)
  p_username   in varchar2 default null,  -- APP_USER (lido no navegador) → usuário do create_session
  p_items      in clob     default null   -- JSON { "P_EMPRESA_USER":"...", ... } dos application items p/ o VPD/filtro
) return clob
is
  l_region_id  number;
  l_report_id  number;
  l_report     apex_ir.t_report;
  l_cursor     integer;
  l_desc       dbms_sql.desc_tab2;
  l_col_cnt    integer;
  l_val        varchar2(32767);
  l_num        number;             -- fetch de colunas NUMBER
  l_dt         date;               -- fetch de colunas DATE
  l_ignore     integer;
  l_total      number := 0;
  l_nset       number := 0;          -- DEBUG: quantos application items foram setados
  l_item_err   varchar2(400);        -- DEBUG: erro ao setar itens (se houver)
  l_seta       varchar2(300);        -- DEBUG: resultado do usuario.seta_user
begin
  -- (1) NÃO usamos apex_session.attach — o app tem autenticação CUSTOMIZADA que o
  -- attach não restaura fora de uma requisição de página (ORA-20987). Criamos uma
  -- sessão APEX com o USUÁRIO (APP_USER vindo do navegador) e SETAMOS os application
  -- items de identidade (P_EMPRESA_USER, P_MATRICULA_USER, P_PERFIL, P_BASE, P_PAINEL,
  -- P_USUARIO) — que chegam do TOKEN de rastreio (confiável) — para o VPD/filtro do
  -- relatório continuar valendo (o usuário só vê o que pode). Ressalva: filtros
  -- AD-HOC digitados na tela naquele instante NÃO são restaurados — vem o salvo/padrão.
  apex_session.create_session(
    p_app_id   => p_app_id,
    p_page_id  => p_page_id,
    p_username => nvl(p_username, 'API'));

  -- Seta os application items de identidade a partir do JSON. USA json_value NATIVO
  -- (NÃO apex_json.parse — ele compartilha estado com o apex_json de OUTPUT e zerava
  -- tudo). Só seta o que veio preenchido.
  begin
    if json_value(p_items, '$.P_USUARIO')        is not null then apex_util.set_session_state('P_USUARIO',        json_value(p_items, '$.P_USUARIO'));        l_nset := l_nset + 1; end if;
    if json_value(p_items, '$.P_EMPRESA_USER')   is not null then apex_util.set_session_state('P_EMPRESA_USER',   json_value(p_items, '$.P_EMPRESA_USER'));   l_nset := l_nset + 1; end if;
    if json_value(p_items, '$.P_MATRICULA_USER') is not null then apex_util.set_session_state('P_MATRICULA_USER', json_value(p_items, '$.P_MATRICULA_USER')); l_nset := l_nset + 1; end if;
    if json_value(p_items, '$.P_PERFIL')         is not null then apex_util.set_session_state('P_PERFIL',         json_value(p_items, '$.P_PERFIL'));         l_nset := l_nset + 1; end if;
    if json_value(p_items, '$.P_BASE')           is not null then apex_util.set_session_state('P_BASE',           json_value(p_items, '$.P_BASE'));           l_nset := l_nset + 1; end if;
    if json_value(p_items, '$.P_PAINEL')         is not null then apex_util.set_session_state('P_PAINEL',         json_value(p_items, '$.P_PAINEL'));         l_nset := l_nset + 1; end if;
  exception when others then l_item_err := substr(sqlerrm, 1, 400); -- DEBUG: expõe a falha
  end;

  -- (1b) REGRAS DE ACESSO (VPD) do usuário — o app monta a segurança via
  -- usuario.seta_user(:p_usuario). SEM isto a query volta 0 (a VPD bloqueia tudo).
  -- Passa o P_USUARIO (mesmo valor do :p_usuario da tela).
  begin
    usuario.seta_user(json_value(p_items, '$.P_USUARIO'));
    l_seta := 'ok(' || json_value(p_items, '$.P_USUARIO') || ')';
  exception when others then l_seta := 'ERRO: ' || substr(sqlerrm, 1, 200);
  end;

  -- (2) resolve o region_id: "R123" → 123; senão static_id; senão o único IR da página
  if regexp_like(nvl(p_region,'x'), '^R[0-9]+$') then
    l_region_id := to_number(substr(p_region, 2));
  else
    begin
      select region_id into l_region_id
        from apex_application_page_regions
       where application_id = p_app_id and page_id = p_page_id
         and static_id = p_region;
    exception when no_data_found then
      select min(region_id) into l_region_id
        from apex_application_page_regions
       where application_id = p_app_id and page_id = p_page_id
         and source_type = 'Interactive Report';
    end;
  end if;

  if l_region_id is null then
    begin apex_session.delete_session(apex_application.g_instance); exception when others then null; end;
    apex_json.initialize_clob_output;
    apex_json.open_object;
    apex_json.write('ok', false);
    apex_json.write('erro', 'Não localizei a região de Interactive Report na página.');
    apex_json.close_object;
    return apex_json.get_clob_output;
  end if;

  -- reportid da ÚLTIMA visão do usuário (aplica o report salvo/filtros correntes)
  begin
    l_report_id := apex_ir.get_last_viewed_report_id(p_page_id => p_page_id, p_region_id => l_region_id);
  exception when others then
    l_report_id := null;
  end;

  l_report := apex_ir.get_report(p_page_id => p_page_id, p_region_id => l_region_id, p_report_id => l_report_id);

  -- (3) executa a SQL de runtime (COM filtros) e serializa tudo. CAP em 2000 linhas
  -- (rownum) — teto de segurança p/ latência/memória; relatórios de tela cabem folgado
  -- e escopos gigantes (gestor vê tudo) caem no caminho de resumo+CSV do chat. Os binds
  -- do IR continuam valendo (SQL interna).
  l_cursor := dbms_sql.open_cursor;
  dbms_sql.parse(l_cursor, 'select * from (' || l_report.sql_query || ') where rownum <= 2000', dbms_sql.native);

  for i in 1 .. l_report.binds.count loop
    dbms_sql.bind_variable(l_cursor, l_report.binds(i).name, l_report.binds(i).value);
  end loop;

  dbms_sql.describe_columns2(l_cursor, l_col_cnt, l_desc);
  -- Define cada coluna pelo TIPO (senão NUMBER/DATE numa var VARCHAR2 dá ORA-06502).
  -- 2=NUMBER; 12=DATE; resto (inclui TIMESTAMP/CHAR/etc.)=VARCHAR2. Define e fetch
  -- usam o MESMO critério (senão o column_value dá mismatch).
  for i in 1 .. l_col_cnt loop
    if l_desc(i).col_type = 2 then
      dbms_sql.define_column(l_cursor, i, l_num);
    elsif l_desc(i).col_type = 12 then
      dbms_sql.define_column(l_cursor, i, l_dt);
    else
      dbms_sql.define_column(l_cursor, i, l_val, 32767);
    end if;
  end loop;

  l_ignore := dbms_sql.execute(l_cursor);

  apex_json.initialize_clob_output;
  apex_json.open_object;
  apex_json.write('ok', true);

  apex_json.open_array('colunas');
  for i in 1 .. l_col_cnt loop
    -- pula colunas internas do IR (apxws_row_pk, etc.)
    if not regexp_like(l_desc(i).col_name, '^(APXWS_|apex\$)', 'i') then
      apex_json.write(l_desc(i).col_name);
    end if;
  end loop;
  apex_json.close_array;

  apex_json.open_array('linhas');
  while dbms_sql.fetch_rows(l_cursor) > 0 loop
    apex_json.open_array;               -- uma linha = array paralelo às colunas (tudo string)
    for i in 1 .. l_col_cnt loop
      if not regexp_like(l_desc(i).col_name, '^(APXWS_|apex\$)', 'i') then
        begin
          if l_desc(i).col_type = 2 then
            dbms_sql.column_value(l_cursor, i, l_num);
            apex_json.write(case when l_num is null then null else to_char(l_num) end);
          elsif l_desc(i).col_type = 12 then
            dbms_sql.column_value(l_cursor, i, l_dt);
            apex_json.write(case when l_dt is null then null else to_char(l_dt, 'DD/MM/YYYY') end);
          else
            dbms_sql.column_value(l_cursor, i, l_val);
            apex_json.write(l_val);
          end if;
        exception when others then apex_json.write(null); -- célula problemática vira null (não derruba)
        end;
      end if;
    end loop;
    apex_json.close_array;
    l_total := l_total + 1;
  end loop;
  apex_json.close_array;

  apex_json.write('total', l_total);
  apex_json.write('_debug_user', p_username);
  apex_json.write('_debug_itens_setados', l_nset);
  apex_json.write('_debug_seta', l_seta);   -- resultado do usuario.seta_user (VPD)
  apex_json.close_object;

  dbms_sql.close_cursor(l_cursor);
  begin apex_session.delete_session(apex_application.g_instance); exception when others then null; end;
  return apex_json.get_clob_output;

exception
  when others then
    begin if dbms_sql.is_open(l_cursor) then dbms_sql.close_cursor(l_cursor); end if; exception when others then null; end;
    begin apex_session.delete_session(apex_application.g_instance); exception when others then null; end;
    -- JSON MANUAL (NÃO apex_json — que pode estar no meio de uma escrita e re-lançar).
    -- Assim o erro + a LINHA (backtrace) sempre chegam, em vez de estourar no handler.
    return '{"ok":false,"erro":"' || replace(replace(substr(sqlerrm, 1, 300), '\', '/'), '"', '''')
        || '","detalhe":"' || replace(replace(substr(dbms_utility.format_error_backtrace, 1, 500), '\', '/'), '"', '''')
        || '","total_ate_erro":' || l_total
        || ',"_debug_seta":"' || replace(nvl(l_seta, '(null)'), '"', '''') || '"}';
end fnct_ir_data;
/

-- ============================================================================
--  PARTE B — GRANT. Rode no schema de DADOS (RHNATCORP), liberando o schema da API.
-- ============================================================================
-- GRANT EXECUTE ON fnct_ir_data TO API_NATCORP;
--   (troque API_NATCORP pelo schema onde vive o módulo ORDS)

-- ============================================================================
--  PARTE C — MÓDULO ORDS. Rode no schema da API (ex.: API_NATCORP), que serve
--  /apex/rh/natcorp. O handler descobre o parsing schema do app e chama a função
--  DENTRO daquele schema — funciona para QUALQUER cliente sem código fixo.
--
--  POST .../apex/rh/natcorp/chatbot/dados/v1/consulta_ir
--  Body JSON: { "app_id":200, "page_id":2, "session":"123...", "region":"COLABORADORES",
--               "username":"365685",
--               "items":"{\"P_USUARIO\":\"...\",\"P_EMPRESA_USER\":\"...\",\"P_MATRICULA_USER\":\"...\",\"P_PERFIL\":\"...\",\"P_BASE\":\"...\",\"P_PAINEL\":\"...\"}" }
--  ATENÇÃO: se você definiu PARÂMETROS explícitos no módulo (ORDS.DEFINE_PARAMETER),
--  adicione também `username` e `items` (bind_variable_name iguais). Sem parâmetros
--  explícitos, o ORDS auto-vincula os atributos do corpo aos binds de mesmo nome.
--  Reusa o módulo /chatbot/dados/v1/ se já existir (só adiciona o template).
-- ============================================================================
declare
  l_mod  user_ords_modules.name%type;
  l_novo boolean := false;
begin
  begin
    select name into l_mod from user_ords_modules where uri_prefix = '/chatbot/dados/v1/';
  exception when no_data_found then
    l_mod := 'kb.consulta_ir'; l_novo := true;
    ords.define_module(p_module_name => l_mod, p_base_path => '/chatbot/dados/v1/',
                       p_items_per_page => 0, p_status => 'PUBLISHED');
  end;

  ords.define_template(p_module_name => l_mod, p_pattern => 'consulta_ir');

  ords.define_handler(
    p_module_name => l_mod, p_pattern => 'consulta_ir', p_method => 'POST',
    p_source_type => ords.source_type_plsql,
    p_source => q'~
declare
  l_app    number         := :app_id;
  l_page   number         := :page_id;
  l_sess   varchar2(4000) := :session;
  l_region varchar2(4000) := :region;
  l_user   varchar2(4000) := :username;
  l_items  clob           := :items;
  l_schema varchar2(128);
  l_json   clob;
  l_len    integer;
  l_off    integer := 1;
  l_amt    integer := 8000;   -- pedaço < 32767 p/ htp.prn (VARCHAR2), seguro c/ acentos
begin
  -- Parsing schema do app (ex.: RHNATCORP) — onde a função definer deve rodar.
  select owner into l_schema from apex_applications where application_id = l_app;

  execute immediate 'begin :j := "' || l_schema || '".fnct_ir_data(:a, :p, :s, :g, :u, :i); end;'
    using out l_json, in l_app, in l_page, in l_sess, in l_region, in l_user, in l_items;

  -- SÓ o corpo. NÃO usar owa_util.mime_header/htp.p de header: no ORDS eles vazam
  -- como TEXTO no corpo. O content-type sai como JSON pela config do handler.
  -- CLOB grande estoura htp.prn (VARCHAR2, teto 32767) com ORA-06502 → emite em pedaços.
  l_len := dbms_lob.getlength(l_json);
  if nvl(l_len, 0) = 0 then
    htp.prn('{"ok":false,"erro":"função retornou vazio"}');
  else
    while l_off <= l_len loop
      htp.prn(dbms_lob.substr(l_json, l_amt, l_off));
      l_off := l_off + l_amt;
    end loop;
  end if;
exception when others then
  htp.prn('{"ok":false,"erro":"handler ORDS: ' || replace(substr(sqlerrm,1,300),'"','''') ||
          '","detalhe":"' || replace(substr(dbms_utility.format_error_backtrace,1,400),'"','''') || '"}');
end;
~');

  -- Proteção OAuth: se o módulo /chatbot/dados/v1/ já EXISTIA, herda a do client
  -- natcorp. Se criamos AGORA, cria o privilégio e concede ao client existente.
  if l_novo then
    ords.create_role(p_role_name => 'kb_ir_role');
    ords.create_privilege(p_name => 'kb.ir.priv', p_role_name => 'kb_ir_role',
      p_label => 'KB IR Data', p_description => 'Dados de Interactive Report',
      p_modules => ords_modules_t('kb.consulta_ir'));
    -- Troque 'CLIENT_NATCORP' pelo p_name real (select name from user_ords_clients):
    oauth.grant_client_role(p_client_name => 'CLIENT_NATCORP', p_role_name => 'kb_ir_role');
  end if;

  commit;
end;
/
-- CORS desnecessário: o ORDS é chamado SERVER-TO-SERVER (nosso backend → ORDS).
