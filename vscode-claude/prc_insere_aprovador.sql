create or replace procedure natcorp.PRC_INSERE_APROVADOR(psolicitacao consulta_requisicoes.solicitacao%type,
                                                 ptipo_req    consulta_requisicoes.tipo_req%type,
                                                 pflg_retorno out varchar2,
                                                 pmsg_retorno out varchar2) is
  /* Historico
  -- Versao 46 - 01-07-2026 - Andre - Chamado 44560 - Evitar duplicidade de aprov.suplente quando tem gestor sub-centro
  -- Versao 45 - 22-04-2026 - Andre - Chamado 43886 - Ajuste no processo para novo parametro
  -- Versao 44 - 26-03-2026 - Bruno - Chamado 43391 - Ajuste no processo para gestor aprovar direto requisicao de abono
  -- Versao 42 - 11-03-2026 - Andre - Chamado 42117 - Ajuste no processo para gestor não aprovar direto
  --                          e buscar aprovadores
  -- Versao 41 - 10-03-2026 - Andre - Chamado 42117 - Ajuste no processo para gestor não aprovar direto
  -- Versao 40 - 19-02-2025 - Andre - Chamado 42622 - Ajuste no painel para nao aprovar direto
  -- Versão 39 - 26-12-2025 - Andre - Chamado 41480 - Ajuste para sub-gestor aprovar direto as requisições de abono e atestado
  -- Versão 38 - 12-12-2025 - Andre - Chamado 41480-Campo de gestor subcentro aprova apuração
  -- Versao 37 - 01-08-2025 - Andre -Finalizando processo de req.de reembolso
   -- Chamado 31113 - Estavam invertidas as posicoes ono SQL ptipo_req = 'REQ_ABONO' - Andre - 07-02-2024
  -- Retirado os logs para achar o erro de não deletar uma marcação - Andre - 24-08-2023
  */
  cursor c_pessoal is
    select r.*, uo.nm_usuario_oracle
      from requisicao r, usuario_oracle uo
     where uo.cd_matricula = r.mat_req
       and uo.cd_empresa = r.cod_emp_req
       and r.cod_req = psolicitacao;
  --
  r_pessoal c_pessoal%rowtype;
  --
  cursor c_ferias is
    select rf.cod_empresa,
           iff.filial,
           rf.ind_situacao_periodo,
           rf.dt_inic_per_ferias,
           rf.dt_saida_parc1,
           rf.dt_saida_parc2,
           rf.cod_emp_solicitante,
           rf.matricula_solicitante,
           rf.usuario
      from requisicao_ferias rf, informacoes_funcionais_cad iff
     where iff.matricula = rf.matricula
       and iff.cod_empresa = rf.cod_empresa
       and rf.cod_solicitacao = psolicitacao;
  --
  r_ferias c_ferias%rowtype;
  --
  cursor c_apura(p_solicitacao in number, p_cod_emp_req in number) is
    SELECT a.dt_req      dt_solicitacao,
           a.cod_sit_req cod_sit_solicitacao,
           --a.cod_sit_deslig,
           --p_emp_solicitante cod_empresa_solicitante,
           --p_emp_solicitado  cod_empresa_solicitado,
           a.mat_req         mat_solicitante,
           a.matricula       mat_solicitado,
           b.filial,
           b.cod_ccusto,
           b.cargo,
           b.FUNCAO,
           b.situacao,
           b.reg_trab,
           b.salario,
           b.cod_localizacao,
           --A.nome_arquivo_just DOCUMENTO_ANEXO,
           (SELECT REPLACE(TO_CHAR(SC.COD_EMP_GESTOR, '000') ||
                           TO_CHAR(SC.MAT_GESTOR, '000000'),
                           ' ',
                           '')
              FROM SUB_CCUSTO SC
             WHERE SC.COD_SUB_CCUSTO = b.COD_SUB_CCUSTO
               AND SC.COD_CCUSTO = b.COD_CCUSTO
               AND SC.COD_EMPRESA = b.COD_EMPRESA) GESTOR_SUBCCUSTO
      from PE_REQ_APURACAO a, INFORMACOES_FUNCIONAIS_CAD b
     WHERE a.cod_req = psolicitacao
       AND a.cod_empresa = p_cod_emp_req
       AND b.cod_empresa = a.cod_empresa -- a.cod_emp_req
       AND b.matricula = a.matricula; -- a.mat_req;

  r_apura c_apura%rowtype;
  --
  cursor c_atestado is
    SELECT a.dt_req      dt_solicitacao,
           a.cod_sit_req cod_sit_solicitacao,
           --a.cod_sit_deslig,
           --p_emp_solicitante cod_empresa_solicitante,
           --p_emp_solicitado  cod_empresa_solicitado,
           a.cod_emp_solicitante cod_empresa_solicitante,
           a.cod_empresa         cod_empresa_solicitado,
           a.matricula       mat_solicitante,
           a.matricula       mat_solicitado,
           b.filial,
           b.cod_ccusto,
           b.cargo,
           b.FUNCAO,
           b.situacao,
           b.reg_trab,
           b.salario,
           b.cod_localizacao,
           --A.nome_arquivo_just DOCUMENTO_ANEXO,
           (SELECT REPLACE(TO_CHAR(SC.COD_EMP_GESTOR, '000') ||
                           TO_CHAR(SC.MAT_GESTOR, '000000'),
                           ' ',
                           '')
              FROM SUB_CCUSTO SC
             WHERE SC.COD_SUB_CCUSTO = b.COD_SUB_CCUSTO
               AND SC.COD_CCUSTO = b.COD_CCUSTO
               AND SC.COD_EMPRESA = b.COD_EMPRESA) GESTOR_SUBCCUSTO
      from REQ_ATESTADO_FUNCIONARIO a, INFORMACOES_FUNCIONAIS_CAD b
     WHERE a.cod_req = psolicitacao
          --AND a.cod_empresa = p_cod_emp_req
       AND b.cod_empresa = a.cod_empresa -- a.cod_emp_req
       AND b.matricula = a.matricula; -- a.mat_req;
  r_atestado c_atestado%rowtype;
  --
  -- Variáveis de férias
  v_work_1 number;
  v_work_2 number;
  --l_conta    number := 0;
  v_work boolean := false;
  --
  vsaida_erro exception;
  --
  cursor c_abono(p_solicitacao in number,
                 p_cod_emp_req in NUMBER DEFAULT NULL) is
    SELECT a.dt_req      dt_solicitacao,
           a.cod_sit_req cod_sit_solicitacao,
           --a.cod_sit_deslig,
           --p_emp_solicitante cod_empresa_solicitante,
           --p_emp_solicitado  cod_empresa_solicitado,
           a.mat_req mat_solicitante,
           a.matricula mat_solicitado,
           b.filial,
           b.cod_ccusto,
           b.cargo,
           b.FUNCAO,
           b.situacao,
           b.reg_trab,
           b.salario,
           b.cod_localizacao,
           A.nome_arquivo_just DOCUMENTO_ANEXO,
           (SELECT REPLACE(TO_CHAR(SC.COD_EMP_GESTOR, '000') ||
                           TO_CHAR(SC.MAT_GESTOR, '000000'),
                           ' ',
                           '')
              FROM SUB_CCUSTO SC
             WHERE SC.COD_SUB_CCUSTO = b.COD_SUB_CCUSTO
               AND SC.COD_CCUSTO = b.COD_CCUSTO
               AND SC.COD_EMPRESA = b.COD_EMPRESA) GESTOR_SUBCCUSTO
      FROM PE_REQ_TRATAMENTO_BATIMENTOS a, INFORMACOES_FUNCIONAIS_CAD b
     WHERE a.cod_req = psolicitacao
          -- MSS 20231020 AND a.cod_empresa = p_cod_emp_req
       AND b.cod_empresa = a.cod_empresa -- a.cod_emp_req
       AND b.matricula = a.matricula; -- a.mat_req;

  r_abono c_abono%rowtype;
  --aprova_auto                           varchar2(1);
  p_painel                      varchar2(10);
  p_aprov_oper_abono            varchar2(1);
  p_gestor_conclui_requisicao   varchar2(1);
  p_gestor_subccusto_requisicao varchar2(1);
  p_operador_aprova_atestado    varchar2(1);
  p_gestor_subccusto_atestado   varchar2(1);
  p_cod_empresa                 varchar2(10);
  p_cod_emp_req                 varchar2(10);
begin
  --
  dbms_output.put_line('PRC_INSERE_APROVADOR #00');
  --
  pflg_retorno := 'S';
  --
  if ptipo_req = 'REQ_PESSOAL' then
    --
    open c_pessoal;
    fetch c_pessoal
      into r_pessoal;
    close c_pessoal;
    --
    begin
      --
      --dbms_output.put_line('PRC_INSERE_APROVADOR #01 pkg_req.insere_aprova_req('||r_pessoal.cod_emp_req||','||r_pessoal.cod_req||','||r_pessoal.nm_usuario_oracle||');');
      --insert into testex values (r_pessoal.cod_req, 'PRC_INSERE_APROVADOR #01 pkg_req.insere_aprova_req('||r_pessoal.cod_emp_req||','||r_pessoal.cod_req||','||r_pessoal.nm_usuario_oracle||');'); commit;
      pkg_req.insere_aprova_req(r_pessoal.cod_emp_req,
                                r_pessoal.cod_req,
                                r_pessoal.nm_usuario_oracle);
      --
    exception
      when others then
        pflg_retorno := 'N';
        pmsg_retorno := 'Erro ao inserir aprovadores na requisição: ' ||
                        sqlerrm;
        raise vsaida_erro;
    end;
    --
  elsif ptipo_req = 'REQ_FERIAS' then
    --
    dbms_output.put_line('#01');

    open c_ferias;
    fetch c_ferias
      into r_ferias;
    close c_ferias;
    --
    dbms_output.put_line('#02');

    begin
      select workflow_1, workflow_2
        into v_work_1, v_work_2
        from ferias_parametros
       where cod_empresa = r_ferias.cod_empresa
         and cod_filial = r_ferias.filial;
    exception
      when others then
        pflg_retorno := 'N';
        pmsg_retorno := 'Erro ao buscar workflow_1 e workflow_2: ' ||
                        sqlerrm;
        raise vsaida_erro;
    end;
    --
    dbms_output.put_line('#03 ' || v_work_1 || ', ' || v_work_2);
    --
    if (r_ferias.ind_situacao_periodo = 'P') then
      if (trunc(months_between(r_ferias.dt_inic_per_ferias,
                               r_ferias.dt_saida_parc1)) <= v_work_1 and
         trunc(months_between(r_ferias.dt_inic_per_ferias,
                               r_ferias.dt_saida_parc1)) >= 0) or
         v_work_1 = 0 then

        dbms_output.put_line('#04');
        v_work := true;
      else
        dbms_output.put_line('#05');
        v_work := false;
      end if;
      dbms_output.put_line('#06');
    else
      dbms_output.put_line('#07');
      if (trunc(months_between(r_ferias.dt_inic_per_ferias,
                               r_ferias.dt_saida_parc2)) <= v_work_2 and
         trunc(months_between(r_ferias.dt_inic_per_ferias,
                               r_ferias.dt_saida_parc2)) >= 0) or
         v_work_2 = 0 then
        dbms_output.put_line('#08');
        v_work := true;
      else
        dbms_output.put_line('#09');
        v_work := false;
      end if;
    end if;
    --
    if v_work then
      dbms_output.put_line('#10 true');
    end if;

    begin
      --
      insert into aprova_ferias
        (cod_empresa,
         cod_solicitacao,
         cod_emp_aprov,
         mat_aprov,
         status_aprov,
         dt_aprov,
         usuario,
         dt_atualizacao,
         seq_aprov)
      values
        (r_ferias.cod_empresa,
         psolicitacao,
         r_ferias.cod_emp_solicitante,
         r_ferias.matricula_solicitante,
         'A',
         sysdate,
         r_ferias.usuario,
         sysdate,
         1);
      --
    exception
      when others then
        pflg_retorno := 'N';
        pmsg_retorno := 'Erro ao inserir dados na tabela aprova_ferias! ' ||
                        sqlerrm;
        raise vsaida_erro;
    end;
    --
    -- verifica com a tabela de parâmetros de férias (através da variável v_work) se deve gerar workflow ou não
    --
    if v_work then
      --
      begin
        --
        pkg_req.propostas_req_ferias(psolicitacao,
                                     r_ferias.cod_empresa,
                                     'FERIAS',
                                     0);
        --
      exception
        when others then
          pflg_retorno := 'N';
          pmsg_retorno := 'Erro ao buscar os aprovadores para a requisição: ' ||
                          sqlerrm;
          raise vsaida_erro;
      end;
      --
    end if;
    --
  elsif ptipo_req in ('REQ_VAGAS', 'REQ_VAGA') then
    --
    for x in (select *
                from requisicao_vaga rv
               where rv.cod_requisicao = psolicitacao) loop
      --
      begin
        --
        pkg_req.propostas_req_vaga(x.cod_empresa, x.cod_requisicao);
        --
      exception
        when others then
          pflg_retorno := 'N';
          pmsg_retorno := 'Erro ao inserir aprovadores na requisição: ' ||
                          sqlerrm;
          raise vsaida_erro;
      end;
      --
    end loop;
    --
  elsif ptipo_req = 'ALT_FUNC' then
    --
    for x in (select *
                from solicitacao_alteracao_func saf
               where saf.cod_solicitacao = psolicitacao) loop
      --
      begin
        pkg_req.propostas(psolicitacao,
                          x.cod_empresa_solicitado,
                          ptipo_req);
      exception
        when others then
          pflg_retorno := 'N';
          pmsg_retorno := 'Prc_Insere_Aprovador - Erro ao inserir aprovadores: ' ||
                          sqlerrm;
          raise vsaida_erro;
      end;
      --
    end loop;
    --
  elsif ptipo_req = 'ALT_VAGA' then
    --
    for x in (select *
                from requisicao_alt_vaga rav
               where rav.cod_requisicao = psolicitacao) loop
      --
      begin
        --
        pck_val_aprov_vaga.p_insere_aprovador(pn_cod_empresa      => x.cod_empresa,
                                              pn_cod_filial_atual => x.cod_filial_atual,
                                              pn_cod_filial_prop  => x.cod_filial_prop,
                                              pn_cod_ccusto_atual => x.cod_ccusto_atual,
                                              pn_cod_ccusto_prop  => x.cod_ccusto_prop,
                                              pn_cod_requisicao   => x.cod_requisicao,
                                              pn_usuario          => x.usuario,
                                              pn_matricula_sol    => x.mat_solicitante,
                                              pn_cod_solicitacao  => null,
                                              pc_msg              => pmsg_retorno);
        --
        if pmsg_retorno is not null then
          pflg_retorno := 'N';
          raise vsaida_erro;
        end if;
        --
      exception
        when others then
          pflg_retorno := 'N';
          pmsg_retorno := 'Prc_Insere_Aprovador - Erro ao inserir aprovadores: ' ||
                          sqlerrm;
          raise vsaida_erro;
      end;
      --
    end loop;
    --
    -- Aprovacao automatica pelo operador com base no painel e flag de aprovacao - Andre - 25/07/2023
    --
  elsif ptipo_req = 'REQ_ABONO' then
    --
    begin
      -- Chamado 31113 - Estavam invertidas as posicoes ono SQL abaixo - Andre - 07-02-2024
      select cod_emp_req, cod_empresa
        into p_cod_empresa, p_cod_emp_req
        from PE_REQ_TRATAMENTO_BATIMENTOS saf
       where saf.cod_req = psolicitacao
         and rownum = 1;
    exception
      when others then
        pflg_retorno := 'N';
        pmsg_retorno := 'Prc_Insere_Aprovador - Erro ao localizar empresa na tabela PE_REQ_TRATAMENTO_BATIMENTOS : ' ||
                        sqlerrm;
        raise vsaida_erro;
    end;
    --
    begin
      select nvl(apex_util.get_session_state('P_PAINEL'), 'X')
        into p_painel
        from dual;
    exception
      when others then
        p_painel := NULL;
    end;
    --
    begin
      select aprova_operador_abono,
             gestor_conclui_requisicao,
             ind_gestor_subccusto_requisicao
        into p_aprov_oper_abono,
             p_gestor_conclui_requisicao,
             p_gestor_subccusto_requisicao
        from parametros_recursos_humanos
       where cod_empresa = p_cod_emp_req;
    exception
      when others then
        p_aprov_oper_abono            := 'N';
        p_gestor_conclui_requisicao   := 'N';
        p_gestor_subccusto_requisicao := 'N';
    end;
    --
    open c_abono(p_solicitacao => psolicitacao); -- MSS 20231020 , p_cod_emp_req => p_cod_emp_req);
    fetch c_abono
      into r_abono;
    close c_abono;

    -- Bruno Sousa / Sidnei 26/03/2026 chamado 43391
    -- Não é para ser obrigatório os 2 parametros iguais a "S"
    -- ou aprova pelo parametro p_gestor_conclui_requisicao
    -- ou aprova pelo parametro p_gestor_subccusto_requisicao
    if p_painel = 'PG' and (p_gestor_conclui_requisicao = 'S' or
       p_gestor_subccusto_requisicao = 'S') then
      --
      PKG_REQ.INSERE_APROV_ABONO(p_emp_solicitado => p_cod_emp_req,
                                 p_solicitacao    => psolicitacao,
                                 p_emp_aprov      => p_cod_empresa,
                                 p_mat_aprov      => r_abono.mat_solicitante,
                                 p_seq_aprov      => 0,
                                 p_ccusto         => r_abono.cod_ccusto);

      PRC_ATUALIZA_REQ(pcod_empresa => p_cod_emp_req,
                       psolicitacao => psolicitacao,
                       pflg_retorno => pflg_retorno,
                       pmsg_retorno => pmsg_retorno);
      --
    elsif p_painel = 'PO' and p_aprov_oper_abono = 'S' then
      --
      PKG_REQ.INSERE_APROV_ABONO(p_emp_solicitado => p_cod_emp_req,
                                 p_solicitacao    => psolicitacao,
                                 p_emp_aprov      => p_cod_empresa,
                                 p_mat_aprov      => r_abono.mat_solicitante,
                                 p_seq_aprov      => 0,
                                 p_ccusto         => r_abono.cod_ccusto);
      PRC_ATUALIZA_REQ(pcod_empresa => p_cod_emp_req,
                       psolicitacao => psolicitacao,
                       pflg_retorno => pflg_retorno,
                       pmsg_retorno => pmsg_retorno);

    else

      --
      for x in (select *
                  from PE_REQ_TRATAMENTO_BATIMENTOS saf
                 where saf.cod_req = psolicitacao) loop
        --
        begin
          pkg_req.propostas_req_abono(psolicitacao,
                                      x.cod_empresa,
                                      x.cod_emp_req,
                                      ptipo_req);
        exception
          when others then
            pflg_retorno := 'N';
            pmsg_retorno := 'Prc_Insere_Aprovador - Erro ao inserir aprovadores: ' ||
                            sqlerrm;
            raise vsaida_erro;
        end;
        --
      end loop;
    end if;
  elsif ptipo_req = 'REQ_HE' THEN
    --
    for x in (select *
                from PE_REQ_HORA_EXTRA saf
               where saf.cod_req = psolicitacao) loop
      --
      begin
        pkg_req.propostas_req_he(psolicitacao,
                                 x.cod_empresa,
                                 x.cod_emp_req,
                                 ptipo_req);

      exception
        when others then
          pflg_retorno := 'N';
          pmsg_retorno := 'Prc_Insere_Aprovador - Erro ao inserir aprovadores: ' ||
                          sqlerrm;
          raise vsaida_erro;
      end;
      --
    end loop;

  elsif ptipo_req = 'REQ_BENEFICIO' then
    --
    for x in (select *
                from REQ_BENEFICIOS saf
               where saf.cod_req = psolicitacao) loop
      --
      begin
        pkg_req.propostas_req_beneficio(psolicitacao,
                                        x.cod_empresa,
                                        x.cod_emp_req,
                                        ptipo_req);

      exception
        when others then
          pflg_retorno := 'N';
          pmsg_retorno := 'Prc_Insere_Aprovador - Erro ao inserir aprovadores: ' ||
                          sqlerrm;
          raise vsaida_erro;
      end;
      --
    end loop;

  elsif ptipo_req = 'REQ_BENEFICIO_CAND' then
    --
    for x in (select *
                from REQ_BENEFICIOS_CANDIDATO saf
               where saf.cod_req = psolicitacao) loop
      --
      begin
        pkg_req.propostas_req_beneficio_cand(psolicitacao,
                                             x.cod_empresa,
                                             x.cod_emp_req,
                                             ptipo_req);

      exception
        when others then
          pflg_retorno := 'N';
          pmsg_retorno := 'Prc_Insere_Aprovador - Erro ao inserir aprovadores: ' ||
                          sqlerrm;
          raise vsaida_erro;
      end;
      --
    end loop;

  elsif ptipo_req = 'REQ_BENEFICIARIA' then
    --
    for x in (select *
                from REQUISICAO_BENEFICIARIA saf
               where saf.cod_requisicao = psolicitacao) loop
      --
      begin
        pkg_req.propostas_req_beneficiaria(psolicitacao,
                                           x.cod_empresa,
                                           x.cod_empresa,
                                           ptipo_req);

      exception
        when others then
          pflg_retorno := 'N';
          pmsg_retorno := 'Prc_Insere_Aprovador - Erro ao inserir aprovadores: ' ||
                          sqlerrm;
          raise vsaida_erro;
      end;
      --
    end loop;

  elsif ptipo_req = 'REQ_LANC_OCORR' then
    --
    null;
    /* IMPLEMENTAR
    for x in (select * from REQ_OCORRENCIA_CALCULO saf where saf.cod_requisicao = psolicitacao) loop
      --
      begin
        pkg_req.propostas_req_beneficiaria(psolicitacao,x.cod_empresa, x.cod_empresa,ptipo_req);

      exception
        when others then
          pflg_retorno := 'N';
          pmsg_retorno := 'Prc_Insere_Aprovador - Erro ao inserir aprovadores: '||sqlerrm;
          raise vsaida_erro;
      end;
      --
    end loop;
    */

  elsif ptipo_req = 'REQ_LANC_PONTO' then
    --
    null;
    /*
     for x in (select * from REQ_LANCAMENTOS_PONTO saf where saf.cod_req = psolicitacao) loop
       --
       begin
         pkg_req.propostas_REQ_LANC_PONTO(psolicitacao,x.cod_empresa, x.cod_emp_req,ptipo_req);

       exception
         when others then
           pflg_retorno := 'N';
           pmsg_retorno := 'Prc_Insere_Aprovador - Erro ao inserir aprovadores: '||sqlerrm;
           raise vsaida_erro;
       end;
       --
     end loop;
    */
    --++03012020
  elsif ptipo_req = 'REQ_ESCALA' then
    --
    for x in (select *
                from REQ_PE_ESCALAS_EXCECOES saf
               where saf.cod_req = psolicitacao) loop
      --
      begin
        pkg_req.propostas_REQ_ESCALA(psolicitacao,
                                     x.cod_empresa,
                                     x.cod_emp_solicitante,
                                     ptipo_req);

      exception
        when others then
          pflg_retorno := 'N';
          pmsg_retorno := 'Prc_Insere_Aprovador - Erro ao inserir aprovadores: ' ||
                          sqlerrm;
          raise vsaida_erro;
      end;
      --
    end loop;
    --++
  elsif ptipo_req = 'REQ_EXAME' then
    --
    for x in (select *
                from SOLICITACAO_EXAMES saf
               where saf.cod_req = psolicitacao) loop
      --
      begin
        pkg_req.propostas_REQ_EXAME(psolicitacao,
                                    x.cod_emp_paciente,
                                    x.cod_emp_solicitante,
                                    ptipo_req);
      exception
        when others then
          pflg_retorno := 'N';
          pmsg_retorno := 'Prc_Insere_Aprovador - Erro ao inserir aprovadores: ' ||
                          sqlerrm;
          raise vsaida_erro;
      end;
      --
    end loop;
  elsif ptipo_req = 'REQ_PPP' THEN
    --
    for x in (select *
                from SOLICITACAO_PPP saf
               where saf.cod_req = psolicitacao) loop
      --
      begin
        pkg_req.propostas_req_PPP(psolicitacao,
                                  x.COD_EMP_SOLICITADO,
                                  x.COD_EMP_SOLICITANTE,
                                  ptipo_req);

      exception
        when others then
          pflg_retorno := 'N';
          pmsg_retorno := 'Prc_Insere_Aprovador - Erro ao inserir aprovadores: ' ||
                          sqlerrm;
          raise vsaida_erro;
      end;
      --
    end loop;
    --
    -- Aprovacao automatica pelo operador com base no painel e flag de aprovacao - Andre - 28/07/2023
    --
  elsif ptipo_req = 'REQ_APURA' THEN
    --
    --
    begin
      -- Chamado 31113 - Estavam invertidas as posicoes ono SQL abaixo - Andre - 07-02-2024
      select cod_emp_req, cod_empresa
        into p_cod_empresa, p_cod_emp_req
        from PE_REQ_APURACAO saf
       where saf.cod_req = psolicitacao
         and rownum = 1;
    exception
      when others then
        pflg_retorno := 'N';
        pmsg_retorno := 'Prc_Insere_Aprovador - Erro ao localizar empresa na tabela PE_REQ_APURACAO : ' ||
                        sqlerrm;
        raise vsaida_erro;
    end;
    --
    begin
      select nvl(apex_util.get_session_state('P_PAINEL'), 'X')
        into p_painel
        from dual;
    exception
      when others then
        p_painel := null;
    end;
    --
    begin
      select aprova_operador_abono,
             gestor_conclui_requisicao,
             ind_gestor_subccusto_requisicao
        into p_aprov_oper_abono,
             p_gestor_conclui_requisicao,
             p_gestor_subccusto_requisicao
        from parametros_recursos_humanos
       where cod_empresa = p_cod_emp_req;
    exception
      when others then
        p_aprov_oper_abono := 'N';
        p_gestor_conclui_requisicao := 'N';
        p_gestor_subccusto_requisicao := 'N';
    end;
    --
    open c_apura(p_solicitacao => psolicitacao,
                 p_cod_emp_req => p_cod_emp_req);
    fetch c_apura
      into r_apura;
    close c_apura;
    if p_painel = 'PG' and (p_gestor_conclui_requisicao = 'S' or
       p_gestor_subccusto_requisicao = 'S') then
      --
      PKG_REQ.INSERE_APROV_APURACAO(p_emp_solicitado => p_cod_emp_req,
                                    p_solicitacao    => psolicitacao,
                                    p_emp_aprov      => p_cod_empresa,
                                    p_mat_aprov      => r_apura.mat_solicitante,
                                    p_seq_aprov      => 0,
                                    p_ccusto         => r_apura.cod_ccusto);

      PRC_ATUALIZA_REQ(pcod_empresa => p_cod_emp_req,
                       psolicitacao => psolicitacao,
                       pflg_retorno => pflg_retorno,
                       pmsg_retorno => pmsg_retorno);

    elsif p_painel = 'PO' and p_aprov_oper_abono = 'S' then
      --
      PKG_REQ.INSERE_APROV_APURACAO(p_emp_solicitado => p_cod_emp_req,
                                    p_solicitacao    => psolicitacao,
                                    p_emp_aprov      => p_cod_empresa,
                                    p_mat_aprov      => r_apura.mat_solicitante,
                                    p_seq_aprov      => 0,
                                    p_ccusto         => r_apura.cod_ccusto);

      PRC_ATUALIZA_REQ(pcod_empresa => p_cod_emp_req,
                       psolicitacao => psolicitacao,
                       pflg_retorno => pflg_retorno,
                       pmsg_retorno => pmsg_retorno);
    else

      --
      for x in (select *
                  from PE_REQ_APURACAO saf
                 where saf.cod_req = psolicitacao) loop

        --
        --
        begin

          pkg_req.PROPOSTAS_REQ_APURACAO(psolicitacao,
                                         x.cod_empresa,
                                         x.cod_emp_req,
                                         ptipo_req);
        exception
          when others then
            pflg_retorno := 'N';
            pmsg_retorno := 'Prc_Insere_Aprovador - Erro ao inserir aprovadores: ' ||
                            sqlerrm;
            raise vsaida_erro;
        end;
        --
      end loop;
    end if;

  elsif ptipo_req = 'REQ_ATESTADO' then
    --
    begin
      -- Chamado 31113 - Estavam invertidas as posicoes ono SQL abaixo - Andre - 07-02-2024
      select cod_empresa, cod_emp_solicitante
        into p_cod_empresa, p_cod_emp_req
        from REQ_ATESTADO_FUNCIONARIO rta
       where rta.COD_REQ = psolicitacao
         and rownum = 1;
    exception
      when others then
        pflg_retorno := 'N';
        pmsg_retorno := 'Prc_Insere_Aprovador - Erro ao localizar empresa na tabela REQ_ATESTADO : ' ||
                        sqlerrm;
        raise vsaida_erro;
    end;
    --
    begin
      select nvl(apex_util.get_session_state('P_PAINEL'), 'X')
        into p_painel
        from dual;
    exception
      when others then
        p_painel := null;
    end;
    --
    begin
      select nvl(ind_gestor_subccusto_atestado, 'N'), nvl(ind_operador_aprova_atestado, 'N')
        into p_gestor_subccusto_atestado, p_operador_aprova_atestado
        from parametros_recursos_humanos
       where cod_empresa = p_cod_emp_req;
    exception
      when others then
        p_gestor_subccusto_atestado := 'N';
        p_operador_aprova_atestado  := 'N';
    end;
    --
    open c_atestado;
    fetch c_atestado
      into r_atestado;
    close c_atestado;
    if ( p_painel = 'PG' and p_gestor_subccusto_atestado = 'S' ) then
      --
      PKG_REQ.INSERE_APROV_ATESTADO(p_emp_solicitado => p_cod_emp_req,
                                    p_solicitacao    => psolicitacao,
                                    p_emp_aprov      => p_cod_empresa,
                                    p_mat_aprov      => r_atestado.mat_solicitante,
                                    p_seq_aprov      => 0,
                                    p_ccusto         => r_atestado.cod_ccusto);


      PRC_ATUALIZA_REQ(pcod_empresa => p_cod_emp_req,
                       psolicitacao => psolicitacao,
                       pflg_retorno => pflg_retorno,
                       pmsg_retorno => pmsg_retorno);


    elsif (p_painel = 'PO' and p_operador_aprova_atestado = 'S' )  then
      --
      PKG_REQ.INSERE_APROV_ATESTADO(p_emp_solicitado => p_cod_emp_req,
                                    p_solicitacao    => psolicitacao,
                                    p_emp_aprov      => p_cod_empresa,
                                    p_mat_aprov      => r_atestado.mat_solicitante,
                                    p_seq_aprov      => 0,
                                    p_ccusto         => r_atestado.cod_ccusto);


      PRC_ATUALIZA_REQ(pcod_empresa => p_cod_emp_req,
                       psolicitacao => psolicitacao,
                       pflg_retorno => pflg_retorno,
                       pmsg_retorno => pmsg_retorno);
    else
      for x in (select *
                  from REQ_ATESTADO_FUNCIONARIO saf
                 where saf.cod_req = psolicitacao) loop
        --
        begin
          pkg_req.propostas_req_atestado(psolicitacao,
                                         x.cod_empresa,
                                         x.cod_emp_solicitante,
                                         ptipo_req);
        exception
          when others then
            pflg_retorno := 'N';
            pmsg_retorno := '(998) Prc_Insere_Aprovador - Erro ao inserir aprovadores: ' ||
                            sqlerrm;
            raise vsaida_erro;
        end;
        --
      end loop;
    end if;

  elsif ptipo_req = 'REQ_CAT' then
    --
    for x in (select *
                from REQ_ANALISE_ACIDENTE saf
               where saf.cod_req = psolicitacao) loop
      --
      dbms_output.put_line('prc_insere_aprovador ' || ptipo_req || ' ' ||
                           x.cod_req);

      begin
        pkg_req.propostas_req_cat(psolicitacao,
                                  x.cod_empresa,
                                  x.cod_emp_solicitante,
                                  ptipo_req);
      exception
        when others then
          pflg_retorno := 'N';
          pmsg_retorno := 'Prc_Insere_Aprovador - Erro ao inserir aprovadores: ' ||
                          sqlerrm;
          raise vsaida_erro;
      end;
      --
    end loop;

  elsif ptipo_req = 'REQ_REEMBOLSO' THEN

    for x in (select *
                from REQ_REEMBOLSO saf
               where saf.cod_req = psolicitacao) loop
      --
      dbms_output.put_line('prc_insere_aprovador ' || ptipo_req || ' ' ||
                           x.cod_req);

      begin
        pkg_req.propostas_req_reembolso(psolicitacao,
                                        x.cod_empresa,
                                        x.cod_emp_solicitante,
                                        ptipo_req);
      exception
        when others then
          pflg_retorno := 'N';
          pmsg_retorno := 'Prc_Insere_Aprovador - Erro ao inserir aprovadores: ' ||
                          sqlerrm;
          raise vsaida_erro;
      end;
    end loop;

  end if;
  --
exception
  when vsaida_erro then
    null;
  when others then
    pflg_retorno := 'N';
    pmsg_retorno := 'Prc_Insere_Aprovador - Erro: ' || sqlerrm;
end Prc_Insere_Aprovador;
