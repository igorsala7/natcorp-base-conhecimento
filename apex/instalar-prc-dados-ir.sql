--------------------------------------------------------------------------------
-- Instala o application process PRC_DADOS_IR em TODAS as aplicações do workspace.
--                                                          [ APEX 19.2 ]
--
-- O processo é o que o widget usa para coletar o Interactive Report na sessão
-- viva do usuário (pkg_ir_dados.prc_responder_ir). Ele precisa existir em cada
-- aplicação onde o widget roda — application process é por APLICAÇÃO, não por
-- workspace, e não há herança.
--
-- Executar como o schema APEX_190200, ou como SYS/ADMIN com privilégio nele.
--
--------------------------------------------------------------------------------
-- ⚠ ANTES DE RODAR EM PRODUÇÃO
--
-- `wwv_flow_api` é a API de IMPORTAÇÃO do APEX — não documentada para uso
-- avulso. Este script reproduz o que um arquivo de export faz: abre o contexto
-- de importação, cria o componente, fecha. É o mesmo caminho do seu export,
-- só que em laço.
--
--   1. Rode primeiro com c_simular = true (padrão). Nada é gravado.
--   2. Teste numa cópia. Este script GRAVA em metadado do APEX e não há
--      "desfazer" além de reimportar — tenha export das aplicações antes.
--   3. Confirme o release exato: select version_no from apex_release;
--      Se não for 19.2.0.00.18, ajuste c_release abaixo.
--------------------------------------------------------------------------------

set serveroutput on size unlimited
set define off

declare
  -- ── Configuração ────────────────────────────────────────────────────────
  c_simular      constant boolean       := true;              -- << false para gravar
  c_workspace    constant varchar2(255) := 'NATCORP';
  c_nome         constant varchar2(255) := 'PRC_DADOS_IR';
  c_corpo        constant varchar2(4000):= 'begin pkg_ir_dados.prc_responder_ir; end;';
  c_seguranca    constant varchar2(255) := 'MUST_NOT_BE_PUBLIC_USER';
  c_sequencia    constant number        := 10;

  -- Do cabeçalho do SEU arquivo de export. Se o seu disser outro release,
  -- troque aqui: o `import_begin` valida e recusa versão incompatível.
  c_versao_yyyy  constant varchar2(20)  := '2019.10.04';
  c_release      constant varchar2(20)  := '19.2.0.00.18';

  -- Aplicações a PULAR (ex.: apps de terceiros). Vazio = nenhuma.
  type t_ids is table of number;
  c_pular        constant t_ids := t_ids(/* 100, 4550 */);

  l_workspace_id number;
  l_existe       number;
  l_novo_id      number;
  l_criados      number := 0;
  l_pulados      number := 0;
  l_erros        number := 0;

  function deve_pular(p_app_id in number) return boolean is
  begin
    for i in 1 .. c_pular.count loop
      if c_pular(i) = p_app_id then return true; end if;
    end loop;
    return false;
  end;
begin
  select workspace_id into l_workspace_id
    from apex_workspaces
   where upper(workspace) = upper(c_workspace);

  dbms_output.put_line('Workspace ' || c_workspace || ' (' || l_workspace_id || ')  —  APEX ' || c_release);
  dbms_output.put_line(case when c_simular then '*** SIMULAÇÃO — nada será gravado ***'
                            else '*** GRAVANDO ***' end);
  dbms_output.put_line(rpad('-', 78, '-'));

  for a in (
    select application_id, application_name, owner
      from apex_applications
     where workspace_id = l_workspace_id
     order by application_id
  ) loop
    begin
      if deve_pular(a.application_id) then
        dbms_output.put_line(rpad(a.application_id, 8) || 'PULADA (exceção)  — ' || a.application_name);
        l_pulados := l_pulados + 1;
        goto proxima;
      end if;

      -- IDEMPOTÊNCIA: rodar duas vezes não pode criar duplicata. Dois processos
      -- com o mesmo nome fazem o APEX escolher um deles sem avisar, e a coleta
      -- passa a funcionar de forma intermitente — o pior tipo de defeito.
      select count(*) into l_existe
        from apex_application_processes
       where application_id = a.application_id
         and upper(process_name) = upper(c_nome);

      if l_existe > 0 then
        dbms_output.put_line(rpad(a.application_id, 8) || 'JÁ EXISTE         — ' || a.application_name);
        l_pulados := l_pulados + 1;
        goto proxima;
      end if;

      if c_simular then
        dbms_output.put_line(rpad(a.application_id, 8) || 'criaria           — ' || a.application_name);
        l_criados := l_criados + 1;
        goto proxima;
      end if;

      -- ── Contexto de importação, por aplicação ───────────────────────────
      -- É o cabeçalho que todo arquivo de export tem. Ele estabelece workspace,
      -- aplicação e schema de parsing — sem isso o `create_flow_process` grava
      -- no lugar errado ou falha.
      --
      -- `p_default_id_offset => 0`: os ids vão como os passamos, sem
      -- deslocamento. É o que queremos, já que geramos um id novo por app.
      wwv_flow_api.import_begin(
         p_version_yyyy_mm_dd     => c_versao_yyyy
        ,p_release                => c_release
        ,p_default_workspace_id   => l_workspace_id
        ,p_default_application_id => a.application_id
        ,p_default_id_offset      => 0
        ,p_default_owner          => a.owner
      );

      -- ID NOVO por aplicação. Reaproveitar o id do export
      -- (655953094735836244) em todas colidiria: o identificador é único no
      -- WORKSPACE inteiro, não por aplicação.
      l_novo_id := wwv_flow_id.next_val;

      -- Sem `p_flow_id`: no 19.2 a aplicação-alvo vem do `import_begin` acima,
      -- e passar o parâmetro (que não existe nesta versão) daria PLS-00306.
      -- É exatamente o formato do seu arquivo de export.
      wwv_flow_api.create_flow_process(
         p_id               => l_novo_id
        ,p_process_sequence => c_sequencia
        ,p_process_point    => 'ON_DEMAND'
        ,p_process_type     => 'NATIVE_PLSQL'
        ,p_process_name     => c_nome
        ,p_process_sql_clob => c_corpo
        ,p_security_scheme  => c_seguranca
      );

      wwv_flow_api.import_end(p_auto_install_sup_obj => false);

      dbms_output.put_line(rpad(a.application_id, 8) || 'CRIADO (' || l_novo_id || ') — ' || a.application_name);
      l_criados := l_criados + 1;

    exception
      when others then
        -- Uma aplicação com problema não pode abortar as outras: o desfecho
        -- pior seria metade instalada sem ninguém saber quais.
        l_erros := l_erros + 1;
        dbms_output.put_line(rpad(a.application_id, 8) || 'ERRO              — ' || a.application_name
          || ' :: ' || substr(sqlerrm, 1, 110));
        -- Fecha o contexto para a próxima aplicação não herdar um import aberto.
        begin wwv_flow_api.import_end(p_auto_install_sup_obj => false); exception when others then null; end;
    end;
    <<proxima>>
    null;
  end loop;

  dbms_output.put_line(rpad('-', 78, '-'));
  dbms_output.put_line('criados/criaria: ' || l_criados
    || '   pulados: ' || l_pulados || '   erros: ' || l_erros);

  if c_simular then
    dbms_output.put_line('Nada foi gravado. Troque c_simular para false para aplicar.');
  else
    commit;
    dbms_output.put_line('COMMIT executado.');
  end if;

exception
  when no_data_found then
    dbms_output.put_line('Workspace "' || c_workspace || '" não encontrado. '
      || 'Confira com: select workspace from apex_workspaces;');
end;
/

--------------------------------------------------------------------------------
-- CONFERÊNCIA — quais aplicações ficaram COM e SEM o processo:
--
--   select a.application_id, a.application_name,
--          case when p.process_name is null then 'FALTA' else 'ok' end as situacao
--     from apex_applications a
--     left join apex_application_processes p
--       on p.application_id = a.application_id
--      and upper(p.process_name) = 'PRC_DADOS_IR'
--    where a.workspace = 'NATCORP'
--    order by situacao desc, a.application_id;
--
-- REMOVER de todas (desfazer):
--
--   begin
--     for p in (select ap.application_id, ap.process_id, a.owner
--                 from apex_application_processes ap
--                 join apex_applications a on a.application_id = ap.application_id
--                where upper(ap.process_name) = 'PRC_DADOS_IR'
--                  and a.workspace = 'NATCORP') loop
--       wwv_flow_api.import_begin(
--          p_version_yyyy_mm_dd=>'2019.10.04', p_release=>'19.2.0.00.18'
--         ,p_default_workspace_id=>(select workspace_id from apex_workspaces where workspace='NATCORP')
--         ,p_default_application_id=>p.application_id, p_default_id_offset=>0, p_default_owner=>p.owner);
--       wwv_flow_api.remove_flow_process(p_id => p.process_id);
--       wwv_flow_api.import_end(p_auto_install_sup_obj => false);
--     end loop;
--     commit;
--   end;
--   /
--------------------------------------------------------------------------------
