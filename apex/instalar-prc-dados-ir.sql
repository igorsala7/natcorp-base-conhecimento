--------------------------------------------------------------------------------
-- Instala o application process PRC_DADOS_IR em TODAS as aplicações do workspace.
--
-- O processo é o que o widget usa para coletar o Interactive Report na sessão
-- viva do usuário (pkg_ir_dados.prc_responder_ir). Ele precisa existir em cada
-- aplicação onde o widget roda — application process é por APLICAÇÃO, não por
-- workspace, e não há herança.
--
--   Executar como o OWNER do schema de parsing das aplicações, ou como
--   SYS/ADMIN com privilégio no schema APEX.
--
--------------------------------------------------------------------------------
-- ⚠ LEIA ANTES DE RODAR EM PRODUÇÃO
--
-- `wwv_flow_api` é a API de IMPORTAÇÃO do APEX. Ela não é documentada nem
-- suportada pela Oracle para uso avulso, e o nome do pacote MUDOU entre versões
-- (a partir do APEX 21 os exports passaram a usar `wwv_flow_imp*`, com
-- `wwv_flow_api` mantido como camada de compatibilidade em várias versões).
--
-- Este script foi escrito a partir do trecho de export que você já usa, então
-- ele assume que `wwv_flow_api.create_flow_process` existe e funciona no seu
-- ambiente — o que o seu próprio arquivo comprova. Ainda assim:
--
--   1. Rode PRIMEIRO com c_simular = true (o padrão). Nada é gravado.
--   2. Rode de verdade em um ambiente de teste antes da produção.
--   3. Tenha export das aplicações antes. Este script GRAVA em metadado do
--      APEX; não existe "desfazer" além de reimportar.
--
-- Confira a sua versão com:
--   select version_no from apex_release;
--------------------------------------------------------------------------------

set serveroutput on size unlimited
set define off

declare
  -- ── Configuração ────────────────────────────────────────────────────────
  c_simular      constant boolean       := true;              -- << troque para false para gravar
  c_workspace    constant varchar2(255) := 'NATCORP';         -- << nome do workspace
  c_nome         constant varchar2(255) := 'PRC_DADOS_IR';
  c_corpo        constant varchar2(4000):= 'begin pkg_ir_dados.prc_responder_ir; end;';
  c_seguranca    constant varchar2(255) := 'MUST_NOT_BE_PUBLIC_USER';
  c_sequencia    constant number        := 10;

  -- Aplicações a PULAR (ex.: a própria app de administração do APEX, apps de
  -- terceiros). Deixe vazio para não pular nenhuma.
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

  dbms_output.put_line('Workspace ' || c_workspace || ' (' || l_workspace_id || ')');
  dbms_output.put_line(case when c_simular then '*** SIMULAÇÃO — nada será gravado ***'
                            else '*** GRAVANDO ***' end);
  dbms_output.put_line(rpad('-', 78, '-'));

  for a in (
    select application_id, application_name
      from apex_applications
     where workspace = (select workspace from apex_workspaces where workspace_id = l_workspace_id)
     order by application_id
  ) loop
    begin
      if deve_pular(a.application_id) then
        dbms_output.put_line(rpad(a.application_id, 8) || 'PULADA (lista de exceção) — ' || a.application_name);
        l_pulados := l_pulados + 1;
        goto proxima;
      end if;

      -- IDEMPOTÊNCIA: já existe? Rodar duas vezes não pode criar duplicata —
      -- dois processos com o mesmo nome fazem o APEX escolher um deles sem
      -- avisar, e a coleta passa a funcionar de forma intermitente.
      select count(*) into l_existe
        from apex_application_processes
       where application_id = a.application_id
         and upper(process_name) = upper(c_nome);

      if l_existe > 0 then
        dbms_output.put_line(rpad(a.application_id, 8) || 'JÁ EXISTE — ' || a.application_name);
        l_pulados := l_pulados + 1;
        goto proxima;
      end if;

      if c_simular then
        dbms_output.put_line(rpad(a.application_id, 8) || 'criaria    — ' || a.application_name);
        l_criados := l_criados + 1;
        goto proxima;
      end if;

      -- ── Contexto de importação ──────────────────────────────────────────
      -- Sem o security group o APEX não sabe em que workspace gravar; sem o
      -- flow id, grava no lugar errado ou falha. São os dois que o cabeçalho de
      -- um arquivo de export normalmente estabelece.
      wwv_flow_api.set_security_group_id(p_security_group_id => l_workspace_id);
      apex_application_install.set_workspace_id(l_workspace_id);
      apex_application_install.set_application_id(a.application_id);

      -- ID NOVO por aplicação. Reaproveitar o id do export (655953094735836244)
      -- em todas colidiria: o identificador é único no workspace inteiro, não
      -- por aplicação.
      l_novo_id := wwv_flow_id.next_val;

      wwv_flow_api.create_flow_process(
         p_id             => l_novo_id
        ,p_flow_id        => a.application_id
        ,p_process_sequence => c_sequencia
        ,p_process_point  => 'ON_DEMAND'
        ,p_process_type   => 'NATIVE_PLSQL'
        ,p_process_name   => c_nome
        ,p_process_sql_clob => c_corpo
        ,p_security_scheme => c_seguranca
      );

      dbms_output.put_line(rpad(a.application_id, 8) || 'CRIADO (id ' || l_novo_id || ') — ' || a.application_name);
      l_criados := l_criados + 1;

    exception
      when others then
        -- Uma aplicação com problema não pode abortar as outras: o desfecho
        -- pior seria metade instalada sem ninguém saber quais.
        l_erros := l_erros + 1;
        dbms_output.put_line(rpad(a.application_id, 8) || 'ERRO — ' || a.application_name
          || ' :: ' || substr(sqlerrm, 1, 120));
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
-- CONFERÊNCIA depois de rodar — quais aplicações ficaram COM e SEM o processo:
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
-- REMOVER de todas (se precisar desfazer):
--
--   begin
--     for p in (select application_id, process_id from apex_application_processes
--                where upper(process_name) = 'PRC_DADOS_IR') loop
--       wwv_flow_api.set_security_group_id(
--         (select workspace_id from apex_workspaces where workspace = 'NATCORP'));
--       wwv_flow_api.remove_flow_process(p_id => p.process_id, p_flow_id => p.application_id);
--     end loop;
--     commit;
--   end;
--   /
--------------------------------------------------------------------------------
