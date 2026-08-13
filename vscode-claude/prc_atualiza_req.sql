CREATE OR REPLACE PROCEDURE NATCORP.PRC_ATUALIZA_REQ(pcod_empresa   NUMBER --inf_pessoais.cod_empresa%type
                                                  ,psolicitacao   consulta_requisicoes.solicitacao%TYPE
                                                  ,pflg_retorno   OUT VARCHAR2
                                                  ,pmsg_retorno   OUT VARCHAR2) IS

  -- Versao 112 - 07-08-2026 - Andre - Chamado 44902 - Novo processo de DSR ao criar req.de apuração para falta
  -- Versao 111 - 06-07-2026 - Cibele - Chamado 45170228 - Manter a geração do código da vaga por empresa
  -- Versao 109 - 01-07-2026 - Andre - Chamado 45170 - Aprovação por gestor do sub-centro de outra empresa
  --                            e revisão da aprovação por gestoir de outra empresa
  -- Versao 108 - 30-06-2026 - Andre - Chamado 44005 - Aprovação por gestor do sub-centro de outra empresa
  -- Versao 107 - 08-05-2026 - Andre - Chamado  43507 - Processo de conversao quando for de PONTO para BANCO
  -- Versao 106 - 05-05-2026 - Andre - chamado 43975 - Inclusao do aprovador de outra empresa na REQ.ATESTADO
  -- Versao 105 - 24-04-2026 - Fernando - Chamado 42756 - add coluna COD_REQ insert ANALISE_ACIDENTE
  -- Versao 104 - 24-04-2026 - Andre - Chamado 43847 - Reapurar quando concluir a req.de atestado
  -- Versao 103 - 23-04-2026 - Cibele - Chamado 43927 - tratar disponibilidade da vaga para havera_reposicao e cancelamento na MP
  -- Versao 102 - 22-04-2026 - Andre - Chamado 43886  - Ajuste para novo parametro se gestor conclui atestado
  -- Versão 101 - 31/03/2026 - Guilherme - CH43567 - ajuste cnpj_local_trab estava passando null
  -- Versão 100 - 13/03/2026 - Cibele - CH43298 - Retirado insert/update do local na ps_processo_seletivo
  -- Versão 99 - 13/03/2026 - Cibele - CH43298 - Atualizar processo seletivo após aprovação da revisão
  -- Versao 98 - 10-03-2026 - Andre - Chamado 42117 - Ajuste no painel para nao aprovar direto
  -- Versão 97 - 05/03/2026 - Cibele - CH43151
  -- Versao 96 - 19-02-2025 - Andre - Chamado 43622 - Ajuste no painel para nao aprovar direto
  -- Inclusao do processo para zerar DSR quando requisicao de falta eh concluida (Procedure Trata_Req_Apuracao) - Andre - 03-11-2023
  -- Retirado os logs para identificar No erro de não deletar marcação - Andre - 26-09-2023
  -- Retirado os logs para identificar o erro de não deletar marcação - Andre - 24-08-2023
  -- Versao 91 - 01-08-2025 - Andre - Finalizando o processo de req.reembolso
  -- Versao 92 - 19-09-2025 - Adriana/Patrícia/Cibele - Tratar erro de PK na PROCESSO_FASE
  -- Versão 93 - 06/11/2025 - Adriana/Cibele - Tratar parametros_recursos_humanos.gera_incidente_automatico
  -- Versão 94 - 11/11/2025 - Adriana/Cibele - tratar gravação em campos q não estão na tela
  -- Versao 95 - 25/11/2025 - Andre - troca de posicao do processo de concluir req.de apuracao

    CURSOR c1 IS
      SELECT cr.*
            ,uo.nm_usuario_oracle
      FROM   consulta_requisicoes cr
            ,usuario_oracle uo
      WHERE  uo.cd_matricula(+) = cr.mat_solicitante
      AND    uo.cd_empresa(+)   = cr.cod_empresa_solicitante
      AND    cr.solicitacao  = psolicitacao
/*      UNION -- Incluso query para retornar requisições de pessoal "filhotes" 16/10/2019
      SELECT 'REQ_PESSOAL' tipo_req, f.mat_subs mat_solicitado, a.cod_empresa,
          b.nome nome_empresa, a.cod_req solicitacao, f.dt_req dt_solicitacao,
          a.cod_emp_aprov, c.nome nome_emp_aprov, a.mat_aprov,
          d.nome nome_aprov, a.dt_aprov, a.status_aprov,
          'N' rescicao_complementar, f.cod_emp_req cod_empresa_solicitante,
          f.mat_req mat_solicitante, f.cod_sit_req cod_sit,
          f.cod_filial filial, NVL (a.seq_aprov, 0) seq_aprov,
          f.cod_empresa cod_empresa_req, f.cod_ccusto, f.cod_unidade_adm, f.cod_atividade, f.cod_local_trab, f.cod_sindicato sindicato,
          uo.nm_usuario_oracle
     FROM aprova_req a,
          requisicao f,
          empresas b,
          empresas c,
          inf_pessoais_cad d,
          usuario_oracle uo
    WHERE uo.cd_matricula(+) = f.mat_req
      AND uo.cd_empresa(+)   = f.cod_emp_req
      AND a.cod_req = f.cod_req
      AND a.cod_empresa = f.cod_empresa
      AND a.cod_empresa = b.cod(+)
      AND a.cod_emp_aprov = c.cod(+)
      AND a.cod_emp_aprov = d.cod_empresa(+)
      AND a.mat_aprov = d.matricula(+)
      AND f.cod_req_pai is not null
      AND f.cod_req = psolicitacao*/;
    --
    req c1%ROWTYPE;
    --
    CURSOR c2 IS
      SELECT r.*
            ,mr.desc_mot_req
            ,c.nome des_cargo
      FROM   requisicao r
            ,mot_req    mr
            ,cargos     c
      WHERE  c.cod          = r.cod_cargo
      AND    mr.cod_mot_req = r.cod_mot_req
      AND    r.cod_req      = psolicitacao;
    --
    pes c2%ROWTYPE;
    --
    CURSOR C3 IS
      SELECT p.cod_fase, p.nota_de_corte, p.sla, f.fase_superior
        FROM fase_candidato       f
            ,ps_fase_padrao_cargo p
       WHERE f.cod_fase = p.cod_fase
         AND p.cargo IS NULL
      UNION
      SELECT p.cod_fase, p.nota_de_corte, p.sla, f.fase_superior
        FROM fase_candidato       f
            ,ps_fase_padrao_cargo p
       WHERE f.cod_fase = p.cod_fase
         AND p.cargo = pes.cod_cargo;
    /*cursor c3 is
      select cod_fase, nota_de_corte, sla
      from   ps_fase_padrao_cargo
      where  cargo is null
      union
      select cod_fase, nota_de_corte, sla
      from   ps_fase_padrao_cargo
      where  cargo = pes.cod_cargo;*/
    --
    CURSOR c4 IS
      SELECT *
      FROM   solicitacao_alteracao_func saf
      WHERE  saf.cod_solicitacao = psolicitacao;
    --
    mp c4%ROWTYPE;
    --
    CURSOR c5 IS
      SELECT *
      FROM   solicitacao_aprovadas sa
      WHERE  sa.cod_solicitacao = psolicitacao;
    --
    mp_aprov c5%ROWTYPE;
    --
    vexiste                     VARCHAR2(1);
    v_sit                       number := 0;
    vsaida_erro                 EXCEPTION;
    --p_painel                    varchar2(10);
    --p_aprov_oper_abono          varchar2(1);
    --
    -- =================================================================
    PROCEDURE trata_pessoal IS
      vdt_inicio_fase DATE := NULL;

      cursor c_req_pessoal is
      select prospeccao
        from requisicao
       where cod_req = psolicitacao;

      v_req_pessoal c_req_pessoal%rowtype;

      cursor c_ps is
      select cod
        from processo_selecao
       where cod = psolicitacao;

      v_ps c_ps%rowtype;

    BEGIN

      --insert into testex values (psolicitacao, 'PRC_ATUALIZA_REQ #01'); commit;

      open c_req_pessoal;
      fetch c_req_pessoal into v_req_pessoal;
      close c_req_pessoal;
      --
        BEGIN
          --
          SELECT DISTINCT 'S'
          INTO   vexiste
          FROM   aprova_req cr
          WHERE  cr.cod_req  = psolicitacao
          AND    cr.status_aprov IN ('P','R');
          --
        EXCEPTION
          WHEN NO_DATA_FOUND THEN
            vexiste := 'N';
          WHEN OTHERS THEN
            pflg_retorno := 'N';
            pmsg_retorno := 'Erro ao verificar andamento da requisição '||req.solicitacao;
        END;
      --
      OPEN c2;
      FETCH c2 INTO pes;
      CLOSE c2;
      --
      --dbms_output.put_line('PRC_ATUALIZA_REQ #01 VEXISTE = '||vexiste);

      IF NVL(vexiste,'N') <> 'S' AND pes.cod_sit_req <> 3 THEN -- Se todos aprovaram
        --
        --dbms_output.put_line('PRC_ATUALIZA_REQ #02 VEXISTE = '||vexiste);

        IF pes.cod_req IS NOT NULL THEN
          --

          --dbms_output.put_line('PRC_ATUALIZA_REQ #03 pes.cod_req = '||pes.cod_req);

          BEGIN
            --
            if nvl(v_req_pessoal.prospeccao,'N') = 'N' then
            --
            UPDATE requisicao
            SET    cod_sit_req    = 5
                  ,usuario        = SUBSTR(req.nm_usuario_oracle||'Prc_Atualiza_Req',1,30)
                  ,dt_sit_req     = sysdate
                  ,dt_atualizacao = SYSDATE
            WHERE  cod_req        = pes.cod_req;
            --
            end if;
          EXCEPTION
            WHEN OTHERS THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'Erro ao atualizar situação da requisição '||req.solicitacao;
              RAISE vsaida_erro;
          END;
          --

          BEGIN
            if nvl(v_req_pessoal.prospeccao,'N') = 'N' then
              UPDATE cl_vaga
                 SET disponivel     = 'N'
                    ,usuario        = SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30)
                  ,dt_atualizacao  = SYSDATE
               WHERE cod_empresa = pes.cod_empresa
                 AND cod_vaga    = pes.cod_vaga
                 AND cod_filial  = pes.cod_filial;
            end if;
          EXCEPTION
            WHEN OTHERS THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'Erro ao atualizar situação da vaga.';
              RAISE vsaida_erro;
          END;

          open c_ps;
          fetch c_ps into v_ps;
          close c_ps;

          if v_ps.cod is null then

            BEGIN
              --
              INSERT INTO processo_selecao        (cod,
                                                   descricao,
                                                   cod_cargo,
                                                   cod_ccusto,
                                                   dt_abertura_ini,
                                                   cod_vaga,
                                                   mat_subs,
                                                   mot_subs,
                                                   cod_empresa,
                                                   filial,
                                                   usuario,
                                                   DT_ATUALIZACAO,
                                                   status)
              VALUES                              (req.solicitacao,
                                                   pes.desc_mot_req,
                                                   pes.cod_cargo,
                                                   pes.cod_ccusto,
                                                   pes.dt_req,
                                                   pes.cod_vaga,
                                                   pes.mat_subs,
                                                   pes.mot_subs,
                                                   pes.cod_empresa,
                                                   pes.cod_filial,
                                                   req.nm_usuario_oracle,
                                                   SYSDATE,
                                                   'V');
              --
            EXCEPTION
              WHEN OTHERS THEN
                pflg_retorno := 'N';
                pmsg_retorno := 'Erro ao gravar Processo_Selecao: '||SQLERRM;
                RAISE vsaida_erro;
            END;
            --
            BEGIN
              --
              INSERT INTO ps_processo_seletivo(cod_processo,
                                                       cod_empresa,
                                                       cod_filial,
                                                       cod_vaga,
                                                       cod_cargo,
                                                       cod_ccusto,
                                                       mat_subs,
                                                       mot_subs,
                                                       dt_solicitacao,
                                                       dt_aprovacao,
                                                       mat_solicitante,
                                                       status,
                                                       cod_req,
                                                       dt_atualizacao,
                                                       usuario,
                                                       tipo_entidade,
                                                       descricao,
                                                       observacao,
                                                       EMP_GESTOR_IND, -- Adriana 21/05/2018
                                                       MAT_GESTOR_IND, -- Adriana 21/05/2018
                                                       EMP_AVALIADOR_IND, -- Adriana 21/05/2018
                                                       MAT_AVALIADOR_IND, -- Adriana 21/05/2018
                                                       tipo_contrato,
                                                       dt_prev_fim_contrato)
              VALUES                                  (pes.cod_req,
                                                       pes.cod_empresa,
                                                       pes.cod_filial,
                                                       pes.cod_vaga,
                                                       pes.cod_cargo,
                                                       pes.cod_ccusto,
                                                       pes.mat_subs,
                                                       pes.mot_subs,
                                                       pes.dt_req,
                                                       TRUNC(SYSDATE),
                                                       pes.mat_req,
                                                       'A',
                                                       pes.cod_req,
                                                       SYSDATE,
                                                       req.nm_usuario_oracle,
                                                       '5',
                                                       pes.des_cargo,
                                                       SUBSTR(pes.observacao,1,2000),
                                                       PES.EMP_GESTOR_IND,
                                                       PES.MAT_GESTOR_IND,
                                                       PES.EMP_AVALIADOR_IND,
                                                       PES.MAT_AVALIADOR_IND,
                                                       pes.tipo_contrato,
                                                       pes.dt_prev_fim_contrato);
              --
            EXCEPTION
              WHEN OTHERS THEN
                pflg_retorno := 'N';
                pmsg_retorno := 'Erro na inserção de Processo Seletivo: '||SQLERRM;
                RAISE vsaida_erro;
            END;
            --
            prc_delega_vagas_new(pes.cod_req, SUBSTR(req.nm_usuario_oracle||'(Autom.)',1,30));
            --
            FOR proc_fase IN c3 LOOP
              --
              BEGIN
                --
                IF (proc_fase.fase_superior IS NOT NULL AND proc_fase.fase_superior = 0) or (proc_fase.fase_superior is null) THEN
                  vdt_inicio_fase := TRUNC(SYSDATE)+1;
                  IF TO_CHAR(vdt_inicio_fase,'d') = 1 THEN
                    vdt_inicio_fase := vdt_inicio_fase+1;
                  ELSIF TO_CHAR(vdt_inicio_fase,'d') = 7 THEN
                    vdt_inicio_fase := vdt_inicio_fase+2;
                  END IF;
                ELSE
                  vdt_inicio_fase := NULL;
                END IF;
                --
                INSERT INTO ps_processo_fase(cod_processo,
                                             cod_fase,
                                             nota_de_corte,
                                             cod_empresa,
                                             cod_req,
                                             status,
                                             sla,
                                             tipo_entidade
                                            ,fase_superior   -- MSS 20180509
                                            ,dt_inicio_fase
                                            ,usuario
                                            ,dt_atualizacao)
                VALUES(pes.cod_req,
                       proc_fase.cod_fase,
                       proc_fase.nota_de_corte,
                       pes.cod_empresa,
                       pes.cod_req,
                       'A',
                       proc_fase.sla,
                       '5'
                       ,NVL(proc_fase.fase_superior,0)
                       ,vdt_inicio_fase
                       ,'prc_atualiza_req'
                       ,sysdate);   -- MSS 20180509
                --
              EXCEPTION
                WHEN OTHERS THEN
                  pflg_retorno := 'N';
                  pmsg_retorno := 'Erro na gravação de Processo Fase: '||SQLERRM;
                  RAISE vsaida_erro;
              END;
              --
            END LOOP;
            --
          else -- CH43151 -- CH43298
            update ps_processo_seletivo
            set    dt_aprovacao   = trunc(sysdate)
                  ,COD_CARGO      = pes.cod_cargo
                  ,COD_CCUSTO     = pes.cod_ccusto
--                  ,LOCAL          = pes.cod_local_trab
--                  ,DT_FECHAMENTO         DATE           Y
                  ,OBSERVACAO     = SUBSTR(pes.observacao,1,2000)
                  ,DT_ATUALIZACAO = SYSDATE
                  ,USUARIO        = NVL(USUARIO.BUSCA_USER,SYS_CONTEXT('USERENV','SESSION_USER'))
                  ,DESCRICAO      = pes.des_cargo
            where  cod_processo = pes.cod_req;
          end if;
          --
        END IF;
        --
      ELSE -- Verifica se houve cancelamento ou reprovação da requisição de Pessoal
        --
        --        RAISE_APPLICATION_ERROR(-20123,'AB ');
        vexiste := 'N';
        --
        BEGIN
          --
          SELECT DISTINCT 'S'
          INTO   vexiste
          FROM   aprova_req cr
          WHERE  cr.cod_req      = psolicitacao
          AND    cr.status_aprov = 'R';
          --
        EXCEPTION
          WHEN NO_DATA_FOUND THEN
            vexiste := 'N';
          WHEN OTHERS THEN
            pflg_retorno := 'N';
            pmsg_retorno := 'Erro ao verificar andamento da requisição '||req.solicitacao;
        END;
        --
        IF nvl(vexiste,'N') = 'S' AND pes.cod_sit_req <> 3 THEN -- Se a requisição foi REPROVADA
          --
          IF req.tipo_req = 'REQ_PESSOAL' THEN
               --
              UPDATE cl_vaga
                 SET disponivel  = 'S'
                    ,usuario     = SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30)
                    ,dt_atualizacao = sysdate
               WHERE disponivel  = 'N'
               AND cod_empresa = pes.cod_empresa
                 AND cod_vaga    = pes.cod_vaga
                 AND cod_filial  = pes.cod_filial;
              --
            IF SQL%FOUND THEN
              prc_cl_vaga_comp(pes.cod_empresa, pes.cod_filial, pes.cod_vaga, 'S');
            END IF;
            --
            BEGIN
              --
              UPDATE requisicao
              SET    cod_sit_req    = 4
                    ,dt_sit_req     = sysdate
                    ,usuario        = SUBSTR(req.nm_usuario_oracle||'Prc_Atualiza_Req',1,30)
                    ,dt_atualizacao = SYSDATE
              WHERE  cod_req        = pes.cod_req;
              --
            EXCEPTION
              WHEN OTHERS THEN
                pflg_retorno := 'N';
                pmsg_retorno := 'Erro ao atualizar situação da requisição '||req.solicitacao;
                RAISE vsaida_erro;
            END;
            --
          END IF;
          --
        ELSIF pes.cod_sit_req = 3 THEN-- Se foi cancelada
          --
          vexiste := 'N';
          --
          BEGIN
            --
            SELECT DISTINCT 'S'
            INTO   vexiste
            FROM   requisicao cr
            WHERE  cr.cod_req  = psolicitacao
--            AND    cr.cod_empresa  = pcod_empresa
            AND    cr.cod_sit_req  IN (3,4); -- Verifica se foi cancelada ou diretamente reprovada
            --
          EXCEPTION
            WHEN NO_DATA_FOUND THEN
              vexiste := 'N';
            WHEN OTHERS THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'Erro ao verificar andamento da requisição '||req.solicitacao;
          END;
          --
          IF vexiste = 'S' THEN
              --
            IF req.tipo_req = 'REQ_PESSOAL' THEN
              --
                UPDATE ps_processo_seletivo
                SET    status = 'C'
                      ,usuario        = SUBSTR(usuario.busca_user||'Prc_Atualiza_Req',1,30)
                      ,dt_atualizacao = SYSDATE
                WHERE  cod_processo   = psolicitacao;
                --
                UPDATE cl_vaga
                   SET disponivel = 'S'
                    ,dt_atualizacao = SYSDATE
                    ,usuario        = SUBSTR(usuario.busca_user||'Prc_Atualiza_Req',1,30)
                 WHERE cod_empresa    = pes.cod_empresa
                   AND cod_vaga       = pes.cod_vaga
                   AND cod_filial     = pes.cod_filial;
                --
              prc_cl_vaga_comp(pes.cod_empresa, pes.cod_filial, pes.cod_vaga, 'S');
              --
            END IF;
            --
          END IF;
          --
        END IF;
        --
      END IF; -- Se todos aprovaram
      --
    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Trata_Pessoal - Erro: '||SQLERRM;
    END trata_pessoal;
    --
    -- ===================================================
    PROCEDURE Trata_Ferias (pcod_empresa  requisicao_ferias.cod_empresa%TYPE,
                            psolicitacao  requisicao_ferias.cod_solicitacao%TYPE,
                            pmatricula    requisicao_ferias.matricula%TYPE,
                            pflg_retorno  IN OUT VARCHAR2,
                            pmsg_retorno  IN OUT VARCHAR2) IS
      --
      cursor c1 is
      select sit_requisicao, USUARIO, DT_INIC_PER_FERIAS, COD_EMPRESA, MATRICULA
        from requisicao_ferias
       where cod_empresa = pcod_empresa
         and cod_solicitacao = psolicitacao;

      v_c1 c1%rowtype;

      --
      V_EXCLUI_PARCELAS BOOLEAN;
      --
      CURSOR C_REQ_ANT(pdt_inic_per_ferias DATE) IS
      SELECT R.COD_SOLICITACAO, R.SIT_REQUISICAO COD_SIT_REQ, NVL(P.REQ_FERIAS_SUBS_CONCLUIDA,'N') REQ_FERIAS_SUBS_CONCLUIDA
        FROM REQUISICAO_FERIAS R,
             PARAMETROS_RECURSOS_HUMANOS P
       WHERE R.COD_EMPRESA = P.COD_EMPRESA
         AND R.SIT_REQUISICAO = 2
         AND R.COD_EMPRESA = PCOD_EMPRESA
         AND R.MATRICULA = PMATRICULA
         AND R.Dt_Inic_Per_Ferias = pdt_inic_per_ferias
         AND R.COD_SOLICITACAO <> PSOLICITACAO;

      --V_REQ_ANT C_REQ_ANT%ROWTYPE;
      --
      PROCEDURE Insere_Ferias(pcod_empresa  requisicao_ferias.cod_empresa%TYPE,
                              psolicitacao  requisicao_ferias.cod_solicitacao%TYPE,
                              pmatricula    requisicao_ferias.matricula%TYPE,
                              pflg_retorno  IN OUT VARCHAR2,
                              pmsg_retorno  IN OUT VARCHAR2) IS
      --
      CURSOR req_ferias IS
        SELECT f.cod_empresa,
               f.matricula,
               f.dc_matricula,
               nvl(rf.num_dias_parc1,f.num_dias_parc1) num_dias_parc1,
               nvl(rf.opcao_13sal1,f.opcao_13sal1) opcao_13sal1,
               nvl(rf.opcao_abono_pec1,f.opcao_abono_pec1) opcao_abono_pec1,
               nvl(rf.dt_saida_parc1,f.dt_saida_parc1) dt_saida_parc1,
               nvl(rf.dt_inic_per_ferias,f.dt_inic_per_ferias) dt_inic_per_ferias,
               nvl(rf.dt_fim_per_ferias,f.dt_fim_per_ferias) dt_fim_per_ferias,
               nvl(rf.opcao_abono_pec2,f.opcao_abono_pec2) opcao_abono_pec2,
               nvl(rf.opcao_13sal2,f.opcao_13sal2) opcao_13sal2,
               nvl(rf.dt_saida_parc2, f.dt_saida_parc2) dt_saida_parc2,
               rf.usuario,
               rf.dt_atualizacao,
               nvl(rf.dias_abono_pec1,f.dias_abono_pec1) dias_abono_pec1,
               nvl(rf.dias_abono_pec2,f.dias_abono_pec2) dias_abono_pec2,
               nvl(rf.num_dias_parc2,f.num_dias_parc2) num_dias_parc2,
               f.ind_dif_ferias,
               nvl(rf.dt_retorno_parc1,f.dt_retorno_parc1) dt_retorno_parc1,
               nvl(rf.dt_retorno_parc2,f.dt_retorno_parc2) dt_retorno_parc2,
               f.saldo,
               f.falta_hora,
               f.falta_minuto,
               f.salario_ferias,
               f.salario_ferias_anterior,
               NVL(f.ind_situacao_periodo, 'P') ind_situacao_periodo,
               nvl(rf.tipo_ferias1,f.tipo_ferias1) tipo_ferias1,
               nvl(rf.tipo_ferias2,f.tipo_ferias2) tipo_ferias2,
               nvl(rf.ind_situacao_parc_1,f.ind_situacao_parc_1) ind_situacao_parc_1,
               nvl(rf.ind_situacao_parc_2,f.ind_situacao_parc_2) ind_situacao_parc_2,
               nvl(rf.dt_retorno_col1,f.dt_retorno_col1) dt_retorno_col1,
               nvl(rf.dt_retorno_col2,f.dt_retorno_col2) dt_retorno_col2,
               f.saldo_dev,
               f.cd_nivel,
               nvl(rf.dt_saida_parc3,f.dt_saida_parc3) dt_saida_parc3,
               nvl(rf.dt_retorno_parc3,f.dt_retorno_parc3) dt_retorno_parc3,
               f.saldo_bruto,
               nvl(rf.num_dias_parc3,f.num_dias_parc3) num_dias_parc3,
               nvl(rf.tipo_ferias3,f.tipo_ferias3) tipo_ferias3,
               nvl(rf.tipo_ferias4,f.tipo_ferias4) tipo_ferias4,
               nvl(rf.desc_adicional1,f.desc_adicional1) desc_adicional1,
               nvl(rf.desc_adicional2,f.desc_adicional2) desc_adicional2,
               nvl(rf.dias_descanso_adicional,f.dias_descanso_adicional) dias_descanso_adicional,
               rf.dt_atualizacao_prog,
               rf.usuario_prog,
               rf.cod_solicitacao,
               f.dt_atualizacao_calc,
               f.usuario_calc,
               rf.dt_solicitacao,
               rf.matricula_solicitante,
               rf.sit_requisicao,
               rf.cod_sit_ferias,
               rf.dt_sit_ferias,
               rf.cod_emp_solicitante,
               nvl(rf.dt_pagto_parc1,f.dt_pagto_parc1) dt_pagto_parc1,
               nvl(rf.dt_pagto_parc2,f.dt_pagto_parc2) dt_pagto_parc2,
               f.opcao_ferias,
               rf.opcao_ferias opcao_ferias_req,
               nvl(rf.num_dias_parc4,f.num_dias_parc4) num_dias_parc4,
               nvl(rf.opcao_13sal4,f.opcao_13sal4) opcao_13sal4,
               nvl(rf.opcao_abono_pec4,f.opcao_abono_pec4) opcao_abono_pec4,
               nvl(rf.dt_saida_parc4,f.dt_saida_parc4) dt_saida_parc4,
               nvl(rf.dias_abono_pec4,f.dias_abono_pec4) dias_abono_pec4,
               nvl(rf.dt_retorno_parc4,f.dt_retorno_parc4) dt_retorno_parc4,
               nvl(rf.dt_retorno_parc4_prorrog,f.dt_retorno_parc4_prorrog) dt_retorno_parc4_prorrog,
               nvl(rf.desc_adicional4,f.desc_adicional4) desc_adicional4,
               nvl(rf.dt_retorno_col4, f.dt_retorno_col4) dt_retorno_col4,
               rf.havera_rep,
               f.num_dias_parc4 num_dias_fer_parc4
          FROM ferias f, requisicao_ferias rf -- requisicao_ferias
         WHERE f.dt_inic_per_ferias = rf.dt_inic_per_ferias
           AND f.matricula = rf.matricula
           AND f.cod_empresa = rf.cod_empresa
           AND (f.ind_situacao_parc_1 is null or f.ind_situacao_parc_2 is null or f.ind_situacao_parc_4 is null)
           AND rf.dt_inic_per_ferias = rf.dt_inic_per_ferias -- (select dt_inic_per_ferias from VALEBRUM.requisicao_ferias where cod_solicitacao = psolicitacao)
           AND rf.cod_solicitacao = psolicitacao
           AND rf.cod_empresa     = pcod_empresa
           AND rf.matricula       = pmatricula;
      --
      v_req_ferias req_ferias%ROWTYPE;


      vnum_dias_fer_parc1  number;
      vnum_dias_fer_parc2  number;
      vnum_dias_fer_parc4  number;

      vdt_saida_fer_parc1  date;
      vdt_saida_fer_parc2  date;
      vdt_saida_fer_parc4  date;

      vdt_retorno_fer_parc1 date;
      vdt_retorno_fer_parc2 date;
      vdt_retorno_fer_parc4 date;

      vtipo_fer_ferias1   varchar2(1);
      vtipo_fer_ferias2         varchar2(1);
      vtipo_fer_ferias4         varchar2(1);

      vopcao_fer_13sal1         varchar2(1);
      vopcao_fer_13sal2         varchar2(1);
      vopcao_fer_13sal4         varchar2(1);

      vopcao_abono_fer_pec1     varchar2(1);
      vopcao_abono_fer_pec2     varchar2(1);
      vopcao_abono_fer_pec4     varchar2(1);

      vdias_abono_fer_pec1      number(2);
      vdias_abono_fer_pec2      number(2);
      vdias_abono_fer_pec4      number(2);
      --
      BEGIN
      --
      --dbms_output.put_line('Abrindo cursor: '||psolicitacao||', '||pcod_empresa||', '||pmatricula);
      OPEN  req_ferias;
      FETCH req_ferias INTO v_req_ferias;
      IF req_ferias%FOUND THEN
        dbms_output.put_line('Achou cursor');
      ELSE
        dbms_output.put_line('Não achou cursor: '||v_req_ferias.dt_inic_per_ferias);
      END IF;
      CLOSE req_ferias;
      --
      BEGIN
        --
        if v_req_ferias.dt_saida_parc1 is null then
          pflg_retorno := 'N';
          pmsg_retorno := 'prc_atualiza_req dt_saida_parc1: '||v_req_ferias.dt_saida_parc1;
          raise vsaida_erro;
        end if;

        ------ alterado em 19/05/2023 -- pelo Ylem Arnaldo - chamado 29852

        vnum_dias_fer_parc1       := v_req_ferias.num_dias_parc1;
        vnum_dias_fer_parc2       := v_req_ferias.num_dias_parc2;
        vnum_dias_fer_parc4       := v_req_ferias.num_dias_parc4;

        vdt_saida_fer_parc1       := v_req_ferias.dt_saida_parc1;
        vdt_saida_fer_parc2       := v_req_ferias.dt_saida_parc2;
        vdt_saida_fer_parc4       := v_req_ferias.dt_saida_parc4;

        vdt_retorno_fer_parc1     := v_req_ferias.dt_retorno_parc1;
        vdt_retorno_fer_parc2     := v_req_ferias.dt_retorno_parc2;
        vdt_retorno_fer_parc4     := v_req_ferias.dt_retorno_parc4;

        vtipo_fer_ferias1     := v_req_ferias.tipo_ferias1;
        vtipo_fer_ferias2         := v_req_ferias.tipo_ferias2;
        vtipo_fer_ferias4         := v_req_ferias.tipo_ferias4;

        vopcao_fer_13sal1         := v_req_ferias.opcao_13sal1;
        vopcao_fer_13sal2         := v_req_ferias.opcao_13sal2;
        vopcao_fer_13sal4         := v_req_ferias.opcao_13sal4;

        vopcao_abono_fer_pec1     := v_req_ferias.opcao_abono_pec1;
        vopcao_abono_fer_pec2     := v_req_ferias.opcao_abono_pec2;
        vopcao_abono_fer_pec4     := v_req_ferias.opcao_abono_pec4;

        vdias_abono_fer_pec1      := v_req_ferias.dias_abono_pec1;
        vdias_abono_fer_pec2      := v_req_ferias.dias_abono_pec2;
        vdias_abono_fer_pec4      := v_req_ferias.dias_abono_pec4;

        if v_req_ferias.num_dias_parc1 + NVL(v_req_ferias.dias_abono_pec1,0) > 24  then

           vnum_dias_fer_parc1 := v_req_ferias.num_dias_parc1;
           vnum_dias_fer_parc2 := null;
           vnum_dias_fer_parc4 := null;

           vdt_saida_fer_parc1 := v_req_ferias.dt_saida_parc1;
           vdt_saida_fer_parc2 := null;
           vdt_saida_fer_parc4 := null;

           vdt_retorno_fer_parc1 := v_req_ferias.dt_retorno_parc1;
           vdt_retorno_fer_parc2 := null;
           vdt_retorno_fer_parc4 := null;

           vtipo_fer_ferias1        := v_req_ferias.tipo_ferias1;
           vtipo_fer_ferias2         := null;
           vtipo_fer_ferias4         := null;

           vopcao_fer_13sal1         := v_req_ferias.opcao_13sal1;
           vopcao_fer_13sal2         := null;
           vopcao_fer_13sal4         := null;

           vopcao_abono_fer_pec1     := v_req_ferias.opcao_abono_pec1;
           vopcao_abono_fer_pec2     := null;
           vopcao_abono_fer_pec4     := null;

           vdias_abono_fer_pec1      := v_req_ferias.dias_abono_pec1;
           vdias_abono_fer_pec2      := null;
           vdias_abono_fer_pec4      := null;


        elsif v_req_ferias.num_dias_parc1 > 0  and v_req_ferias.num_dias_parc2 > 0  and nvl(v_req_ferias.num_dias_fer_parc4,0) > 0 then

           vnum_dias_fer_parc1 := v_req_ferias.num_dias_parc1;
           vnum_dias_fer_parc2 := v_req_ferias.num_dias_parc2;
           vnum_dias_fer_parc4 := null;

           vdt_saida_fer_parc1 := v_req_ferias.dt_saida_parc1;
           vdt_saida_fer_parc2 := v_req_ferias.dt_saida_parc2;
           vdt_saida_fer_parc4 := null;

           vdt_retorno_fer_parc1 := v_req_ferias.dt_retorno_parc1;
           vdt_retorno_fer_parc2 := v_req_ferias.dt_retorno_parc2;
           vdt_retorno_fer_parc4 := null;

           vtipo_fer_ferias1        := v_req_ferias.tipo_ferias1;
           vtipo_fer_ferias2         := v_req_ferias.tipo_ferias2;
           vtipo_fer_ferias4         := null;

           vopcao_fer_13sal1         := v_req_ferias.opcao_13sal1;
           vopcao_fer_13sal2         := v_req_ferias.opcao_13sal2;
           vopcao_fer_13sal4         := null;

           vopcao_abono_fer_pec1     := v_req_ferias.opcao_abono_pec1;
           vopcao_abono_fer_pec2     := v_req_ferias.opcao_abono_pec2;
           vopcao_abono_fer_pec4     := null;

           vdias_abono_fer_pec1      := v_req_ferias.dias_abono_pec1;
           vdias_abono_fer_pec2      := v_req_ferias.dias_abono_pec2;
           vdias_abono_fer_pec4      := null;

       elsif nvl(v_req_ferias.num_dias_parc1,0) > 0 and nvl(v_req_ferias.num_dias_parc2,0) > 0 and nvl(v_req_ferias.num_dias_parc4,0) > 0 then

           vnum_dias_fer_parc1 := v_req_ferias.num_dias_parc1;
           vnum_dias_fer_parc2 := v_req_ferias.num_dias_parc2;
           vnum_dias_fer_parc4 := v_req_ferias.num_dias_parc4;

           vdt_saida_fer_parc1 := v_req_ferias.dt_saida_parc1;
           vdt_saida_fer_parc2 := v_req_ferias.dt_saida_parc2;
           vdt_saida_fer_parc4 := v_req_ferias.dt_saida_parc4;

           vdt_retorno_fer_parc1 := v_req_ferias.dt_retorno_parc1;
           vdt_retorno_fer_parc2 := v_req_ferias.dt_retorno_parc2;
           vdt_retorno_fer_parc4 := v_req_ferias.dt_retorno_parc4;

           vtipo_fer_ferias1        := v_req_ferias.tipo_ferias1;
           vtipo_fer_ferias2         := v_req_ferias.tipo_ferias2;
           vtipo_fer_ferias4         := v_req_ferias.tipo_ferias4;

           vopcao_fer_13sal1         := v_req_ferias.opcao_13sal1;
           vopcao_fer_13sal2         := v_req_ferias.opcao_13sal2;
           vopcao_fer_13sal4         := v_req_ferias.opcao_13sal4;

           vopcao_abono_fer_pec1     := v_req_ferias.opcao_abono_pec1;
           vopcao_abono_fer_pec2     := v_req_ferias.opcao_abono_pec2;
           vopcao_abono_fer_pec4     := v_req_ferias.opcao_abono_pec4;

           vdias_abono_fer_pec1      := v_req_ferias.dias_abono_pec1;
           vdias_abono_fer_pec2      := v_req_ferias.dias_abono_pec2;
           vdias_abono_fer_pec4      := v_req_ferias.dias_abono_pec4;
       end if;
       --------
        --dbms_output.put_line('atualizando ferias: '||to_char(v_req_ferias.dt_saida_parc1,'dd/mm/rrrr')||',dt_inic_per_ferias: '||to_char(v_req_ferias.dt_inic_per_ferias,'dd/mm/rrrr'));
        UPDATE ferias
           SET num_dias_parc1          = vnum_dias_fer_parc1,  -- alterado chamado 29852 -- v_req_ferias.num_dias_parc1,
               opcao_13sal1            = vopcao_fer_13sal1, -- alterado chamado 29852 -- v_req_ferias.opcao_13sal1,
               opcao_abono_pec1        = vopcao_abono_fer_pec1, -- alterado chamado 29852 -- v_req_ferias.opcao_abono_pec1,
               dt_saida_parc1          = vdt_saida_fer_parc1,   -- alterado chamado 29852 --  v_req_ferias.dt_saida_parc1,
               opcao_abono_pec2        = vopcao_abono_fer_pec2, -- alterado chamado 29852 -- v_req_ferias.opcao_abono_pec2,
               opcao_13sal2            = vopcao_fer_13sal2, -- alterado chamado 29852 -- v_req_ferias.opcao_13sal2,
               dt_saida_parc2          = vdt_saida_fer_parc2,   -- alterado chamado 29852 --  v_req_ferias.dt_saida_parc2,
               usuario                 = SUBSTR(v_req_ferias.usuario||'Prc_Atualiza_Req',1,30),
               dt_atualizacao          = sysdate, -- v_req_ferias.dt_atualizacao,
               dias_abono_pec1         = vdias_abono_fer_pec1, -- alterado chamado 29852 --  v_req_ferias.dias_abono_pec1,
               dias_abono_pec2         = vdias_abono_fer_pec2, -- alterado chamado 29852 --  v_req_ferias.dias_abono_pec2,
               num_dias_parc2          = vnum_dias_fer_parc2,  -- alterado chamado 29852 -- v_req_ferias.num_dias_parc2,
               ind_dif_ferias          = v_req_ferias.ind_dif_ferias,
               dt_retorno_parc1        = vdt_retorno_fer_parc1,  -- alterado chamado 29852 -- v_req_ferias.dt_retorno_parc1,
               dt_retorno_parc2        = vdt_retorno_fer_parc2,  -- alterado chamado 29852 -- v_req_ferias.dt_retorno_parc2,
               saldo                   = v_req_ferias.saldo,
               falta_hora              = v_req_ferias.falta_hora,
               falta_minuto            = v_req_ferias.falta_minuto,
               salario_ferias          = v_req_ferias.salario_ferias,
               salario_ferias_anterior = v_req_ferias.salario_ferias_anterior,
               --   , ind_situacao_periodo    =  v_req_ferias.ind_situacao_periodo      retirado chamado 9204
               tipo_ferias1            = vtipo_fer_ferias1,-- alterado chamado 29852 --  v_req_ferias.tipo_ferias1,
               tipo_ferias2            = vtipo_fer_ferias2,-- alterado chamado 29852 --  v_req_ferias.tipo_ferias2,
               tipo_ferias4            = vtipo_fer_ferias4,-- alterado chamado 29852 --
               ind_situacao_parc_1     = v_req_ferias.ind_situacao_parc_1,
               ind_situacao_parc_2     = v_req_ferias.ind_situacao_parc_2,
               dt_retorno_col1         = v_req_ferias.dt_retorno_col1,
               dt_retorno_col2         = v_req_ferias.dt_retorno_col2,
               saldo_dev               = v_req_ferias.saldo_dev,
               cd_nivel                = v_req_ferias.cd_nivel,
               dt_saida_parc3          = v_req_ferias.dt_saida_parc3,
               dt_retorno_parc3        = v_req_ferias.dt_retorno_parc3,
               saldo_bruto             = v_req_ferias.saldo_bruto,
               num_dias_parc3          = v_req_ferias.num_dias_parc3,
               tipo_ferias3            = v_req_ferias.tipo_ferias3,
               desc_adicional1         = v_req_ferias.desc_adicional1,
               desc_adicional2         = v_req_ferias.desc_adicional2,
               dias_descanso_adicional = v_req_ferias.dias_descanso_adicional,
               --dt_atualizacao_prog     = v_req_ferias.dt_atualizacao_prog,
               --usuario_prog            = v_req_ferias.usuario_prog,
               cod_solicitacao         = v_req_ferias.cod_solicitacao,
               dt_atualizacao_calc     = v_req_ferias.dt_atualizacao_calc,
               usuario_calc            = v_req_ferias.usuario_calc,
               dt_solicitacao          = v_req_ferias.dt_solicitacao,
               matricula_solicitante   = v_req_ferias.matricula_solicitante,
               dt_pagto_parc1          = v_req_ferias.dt_pagto_parc1,
               dt_pagto_parc2          = case when vdt_saida_fer_parc2 is not null then v_req_ferias.dt_pagto_parc2 else null end, --Bruno Sousa 11/01/2024
               opcao_ferias            = v_req_ferias.opcao_ferias_req,
               num_dias_parc4          = vnum_dias_fer_parc4,  -- alterado chamado 29852 -- v_req_ferias.num_dias_parc4,
               opcao_13sal4            = vopcao_fer_13sal4,-- alterado chamado 29852 --  v_req_ferias.opcao_13sal4,
               opcao_abono_pec4        = vopcao_abono_fer_pec4, -- alterado chamado 29852 -- v_req_ferias.opcao_abono_pec4,
               dt_saida_parc4          = vdt_saida_fer_parc4,   -- alterado chamado 29852 --  v_req_ferias.dt_saida_parc4,
               dias_abono_pec4         = vdias_abono_fer_pec4, -- alterado chamado 29852 --  v_req_ferias.dias_abono_pec4,
               dt_retorno_parc4        = vdt_retorno_fer_parc4,  -- alterado chamado 29852 -- v_req_ferias.dt_retorno_parc4,
               dt_retorno_parc4_prorrog = v_req_ferias.dt_retorno_parc4_prorrog,
               desc_adicional4         = v_req_ferias.desc_adicional4,
               dt_retorno_col4         = v_req_ferias.dt_retorno_col4,
               usuario_prog            = case when v_req_ferias.dt_saida_parc1 is not null then SUBSTR(v_req_ferias.usuario_prog,1,30) end,
               usuario_prog2           = case when v_req_ferias.dt_saida_parc2 is not null  then SUBSTR(v_req_ferias.usuario_prog,1,30) end,
               usuario_prog4           = case when v_req_ferias.dt_saida_parc4 is not null  then SUBSTR(v_req_ferias.usuario_prog,1,30) end,
               dt_atualizacao_prog     = case when v_req_ferias.dt_saida_parc1 is not null  then v_req_ferias.dt_atualizacao_prog end,
               dt_atualizacao_prog2    = case when v_req_ferias.dt_saida_parc2 is not null  then v_req_ferias.dt_atualizacao_prog end,
               dt_atualizacao_prog4    = case when v_req_ferias.dt_saida_parc4 is not null  then v_req_ferias.dt_atualizacao_prog end
         WHERE cod_empresa             = pcod_empresa
           AND matricula               = pmatricula
           AND dt_inic_per_ferias      = v_req_ferias.dt_inic_per_ferias;
        --
        IF SQL%FOUND THEN
          PKG_REQUISICAO_DIVERSOS.GRAVA_LOG_REQUISICAO_NOVO(v_req_ferias.cod_solicitacao,'TABELA FERIAS ATUALIZADO EM '||TO_CHAR(SYSDATE,'DD/MM/RRRR HH24:MI:SS'),v_req_ferias.usuario,'N','REQ_FERIAS');
          commit;
        ELSE

          UPDATE ferias_CAD
           SET num_dias_parc1          = vnum_dias_fer_parc1,  -- alterado chamado 29852 -- v_req_ferias.num_dias_parc1,
               opcao_13sal1            = vopcao_fer_13sal1, -- alterado chamado 29852 -- v_req_ferias.opcao_13sal1,
               opcao_abono_pec1        = vopcao_abono_fer_pec1, -- alterado chamado 29852 -- v_req_ferias.opcao_abono_pec1,
               dt_saida_parc1          = vdt_saida_fer_parc1,   -- alterado chamado 29852 --  v_req_ferias.dt_saida_parc1,
               opcao_abono_pec2        = vopcao_abono_fer_pec2, -- alterado chamado 29852 -- v_req_ferias.opcao_abono_pec2,
               opcao_13sal2            = vopcao_fer_13sal2, -- alterado chamado 29852 -- v_req_ferias.opcao_13sal2,
               dt_saida_parc2          = vdt_saida_fer_parc2,   -- alterado chamado 29852 --  v_req_ferias.dt_saida_parc2,
               usuario                 = substr(v_req_ferias.usuario||'Prc_Atualiza_Req',1,30),
               dt_atualizacao          = v_req_ferias.dt_atualizacao,
               dias_abono_pec1         = vdias_abono_fer_pec1, -- alterado chamado 29852 --  v_req_ferias.dias_abono_pec1,
               dias_abono_pec2         = vdias_abono_fer_pec2, -- alterado chamado 29852 --  v_req_ferias.dias_abono_pec2,
               num_dias_parc2          = vnum_dias_fer_parc2,  -- alterado chamado 29852 -- v_req_ferias.num_dias_parc2,
               ind_dif_ferias          = v_req_ferias.ind_dif_ferias,
               dt_retorno_parc1        = vdt_retorno_fer_parc1,  -- alterado chamado 29852 -- v_req_ferias.dt_retorno_parc1,
               dt_retorno_parc2        = vdt_retorno_fer_parc2,  -- alterado chamado 29852 -- v_req_ferias.dt_retorno_parc2,
               saldo                   = v_req_ferias.saldo,
               falta_hora              = v_req_ferias.falta_hora,
               falta_minuto            = v_req_ferias.falta_minuto,
               salario_ferias          = v_req_ferias.salario_ferias,
               salario_ferias_anterior = v_req_ferias.salario_ferias_anterior,
               --   , ind_situacao_periodo    =  v_req_ferias.ind_situacao_periodo      retirado chamado 9204
               tipo_ferias1            = vtipo_fer_ferias1,-- alterado chamado 29852 --  v_req_ferias.tipo_ferias1,
               tipo_ferias2            = vtipo_fer_ferias2,-- alterado chamado 29852 --  v_req_ferias.tipo_ferias2,
               tipo_ferias4            = vtipo_fer_ferias4,-- alterado chamado 29852
               ind_situacao_parc_1     = v_req_ferias.ind_situacao_parc_1,
               ind_situacao_parc_2     = v_req_ferias.ind_situacao_parc_2,
               dt_retorno_col1         = v_req_ferias.dt_retorno_col1,
               dt_retorno_col2         = v_req_ferias.dt_retorno_col2,
               saldo_dev               = v_req_ferias.saldo_dev,
               cd_nivel                = v_req_ferias.cd_nivel,
               dt_saida_parc3          = v_req_ferias.dt_saida_parc3,
               dt_retorno_parc3        = v_req_ferias.dt_retorno_parc3,
               saldo_bruto             = v_req_ferias.saldo_bruto,
               num_dias_parc3          = v_req_ferias.num_dias_parc3,
               tipo_ferias3            = v_req_ferias.tipo_ferias3,
               desc_adicional1         = v_req_ferias.desc_adicional1,
               desc_adicional2         = v_req_ferias.desc_adicional2,
               dias_descanso_adicional = v_req_ferias.dias_descanso_adicional,
               dt_atualizacao_prog     = v_req_ferias.dt_atualizacao_prog,
               usuario_prog            = v_req_ferias.usuario_prog,
               cod_solicitacao         = v_req_ferias.cod_solicitacao,
               dt_atualizacao_calc     = v_req_ferias.dt_atualizacao_calc,
               usuario_calc            = v_req_ferias.usuario_calc,
               dt_solicitacao          = v_req_ferias.dt_solicitacao,
               matricula_solicitante   = v_req_ferias.matricula_solicitante,
               dt_pagto_parc1          = v_req_ferias.dt_pagto_parc1,
               dt_pagto_parc2          = case when vdt_saida_fer_parc2 is not null then v_req_ferias.dt_pagto_parc2 else null end, --Bruno Sousa 11/01/2024
               opcao_ferias            = v_req_ferias.opcao_ferias_req,
               num_dias_parc4          = vnum_dias_fer_parc4,  -- alterado chamado 29852 -- v_req_ferias.num_dias_parc4,
               opcao_13sal4            = vopcao_fer_13sal4,-- alterado chamado 29852 --  v_req_ferias.opcao_13sal4,
               opcao_abono_pec4        = vopcao_abono_fer_pec4, -- alterado chamado 29852 -- v_req_ferias.opcao_abono_pec4,
               dt_saida_parc4          = vdt_saida_fer_parc4,   -- alterado chamado 29852 --  v_req_ferias.dt_saida_parc4,
               dias_abono_pec4         = vdias_abono_fer_pec4, -- alterado chamado 29852 --  v_req_ferias.dias_abono_pec4,
               dt_retorno_parc4        = vdt_retorno_fer_parc4,  -- alterado chamado 29852 -- v_req_ferias.dt_retorno_parc4,
               dt_retorno_parc4_prorrog = v_req_ferias.dt_retorno_parc4_prorrog,
               desc_adicional4          = v_req_ferias.desc_adicional4,
               dt_retorno_col4          = v_req_ferias.dt_retorno_col4
         WHERE cod_empresa             = pcod_empresa
           AND matricula               = pmatricula
           AND dt_inic_per_ferias      = v_req_ferias.dt_inic_per_ferias;

           IF SQL%FOUND THEN
              PKG_REQUISICAO_DIVERSOS.GRAVA_LOG_REQUISICAO_NOVO(v_req_ferias.cod_solicitacao,'TABELA FERIAS_CAD ATUALIZADO EM '||TO_CHAR(SYSDATE,'DD/MM/RRRR HH24:MI:SS'),v_req_ferias.usuario,'N','REQ_FERIAS');
              commit;
           ELSE
              PKG_REQUISICAO_DIVERSOS.GRAVA_LOG_REQUISICAO_NOVO(v_req_ferias.cod_solicitacao,'NAO GRAVOU TABELA FERIAS/FERIAS_CAD ATUALIZADO EM '||TO_CHAR(SYSDATE,'DD/MM/RRRR HH24:MI:SS'),v_req_ferias.usuario,'N','REQ_FERIAS');
              commit;
              PKG_REQUISICAO_DIVERSOS.ENVIA_EMAIL_ACOMP(PCOD_EMPRESA,'cibele.cristina@NATCORP.com.br','NAO GRAVOU FERIAS => REQ: '||v_req_ferias.cod_solicitacao,'Verificar.');
              PKG_REQUISICAO_DIVERSOS.ENVIA_EMAIL_ACOMP(PCOD_EMPRESA,'patricia.mota@NATCORP.com.br','NAO GRAVOU FERIAS => REQ: '||v_req_ferias.cod_solicitacao,'Verificar.');
              commit;
              pflg_retorno := 'N';
              pmsg_retorno := 'Não enviou os dados para a programação. Favor verificar!';
              raise vsaida_erro;
           END IF;

        END IF;
        --
      EXCEPTION
        WHEN VSAIDA_ERRO THEN
          RAISE VSAIDA_ERRO;
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foram encontrados dados na requisição de férias para replicar para a tabela de férias!';
          RAISE vsaida_erro;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foi possível atualizar tabela de férias! erro: '||SQLERRM(SQLCODE);
          RAISE vsaida_erro;
      END;
      --
      BEGIN
        --
        UPDATE requisicao_ferias
           SET sit_requisicao     = '2', --requisição concluída
               DT_SIT_SOLICITACAO = sysdate,
               USUARIO            = SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30),
               DT_ATUALIZACAO     = SYSDATE
         WHERE cod_solicitacao    = psolicitacao
           AND dt_inic_per_ferias = v_req_ferias.dt_inic_per_ferias;
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foram encontrados dados na requisição de férias para replicar para a tabela de férias!';
          RAISE vsaida_erro;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foi possível atualizar tabela de férias! erro: '||SQLERRM(SQLCODE);
          RAISE vsaida_erro;
      END;
      --
      EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Ferias.Insere_Ferias - Erro: '||SQLERRM;
      END Insere_Ferias;
      --
    BEGIN
      --
      pflg_retorno := 'S';
      --
      BEGIN
          --
          vexiste := 'N';
          --
          SELECT DISTINCT 'S'
          INTO   vexiste
          FROM   aprova_ferias
          WHERE  COD_SOLICITACAO = psolicitacao
          AND    status_aprov    IN ('P','R'); -- Cibele Inserido verificação de Reprovação 06/06/2018
          --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          --
          open c1;
          fetch c1 into v_c1;
          close c1;
          --
--          RAISE_APPLICATION_ERROR(-20123,'ATENÇÃO: Prc_Atualiza_Req V_C1.SIT_REQUISICAO: '||V_C1.SIT_REQUISICAO);
          if v_c1.sit_requisicao in (1,5) then
          --
            V_EXCLUI_PARCELAS := FALSE;
            FOR L_REQ_ANT IN C_REQ_ANT(V_C1.dt_inic_per_ferias)
            LOOP
              V_EXCLUI_PARCELAS := TRUE;
              IF L_REQ_ANT.COD_SIT_REQ = 2 AND NVL(L_REQ_ANT.REQ_FERIAS_SUBS_CONCLUIDA,'N') = 'S' THEN
                UPDATE REQUISICAO_FERIAS
                   SET COD_SIT_SOLICITACAO = 3
                       ,usuario         = SUBSTR(usuario.BUSCA_USER||'Prc_Atualiza_Req',1,30)
                       ,dt_atualizacao  = SYSDATE
                 WHERE COD_SOLICITACAO = L_REQ_ANT.COD_SOLICITACAO;
              END IF;
            END LOOP;

            IF V_EXCLUI_PARCELAS THEN
              PKG_FERIAS.EXCLUI_PARCELAS(PSOLICITACAO
                                       ,V_C1.USUARIO
                                       ,PFLG_RETORNO
                                       ,PMSG_RETORNO
                                       ,'S');

              IF NVL(PFLG_RETORNO,'S') <> 'S' THEN
                RAISE VSAIDA_ERRO;
              END IF;
            END IF;
            --
            insere_ferias(pcod_empresa,
                        psolicitacao,
                        pmatricula,
                        pflg_retorno,
                        pmsg_retorno);
            --
            IF NVL(pflg_retorno,'S') <> 'S' THEN
              RAISE vsaida_erro;
            END IF;
            --
  /*          processa_ferias(pcod_empresa,
                            pmatricula,
                            psolicitacao,
                            v_ini_per,
                            v_fin_per,
                            v_nome,
                            v_saida_parc1,
                            v_saida_parc2,
                            v_dt_sol,
                            v_sit_per,
                            pflg_retorno,
                            pmsg_retorno);
             --
            if nvl(pflg_retorno,'S') <> 'S' then
              raise vsaida_erro;
            end if;*/
            --
              UPDATE requisicao_ferias
              SET    sit_requisicao = '2', --requisição concluída
                     DT_SIT_SOLICITACAO = sysdate,
                     USUARIO = SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30),
                     DT_ATUALIZACAO = SYSDATE
              WHERE  cod_solicitacao = psolicitacao;
              COMMIT;
         ELSIF V_C1.SIT_REQUISICAO = 3 THEN
           PKG_FERIAS.EXCLUI_PARCELAS(PSOLICITACAO
                                     ,V_C1.USUARIO
                                     ,PFLG_RETORNO
                                     ,PMSG_RETORNO
                                     ,'S');
           IF NVL(PFLG_RETORNO,'S') <> 'S' THEN
             RAISE VSAIDA_ERRO;
           ELSE
             COMMIT;
           END IF;
         end if;
          --
      END;
      --
      IF NVL(vexiste,'N') = 'S' THEN
        --
        FOR x IN (SELECT usuario
                  FROM   aprova_ferias
                  WHERE  COD_EMPRESA     = pcod_empresa
                  AND    COD_SOLICITACAO = psolicitacao
                  AND    status_aprov    = 'R'
                  ORDER BY dt_atualizacao DESC) LOOP
          --
          UPDATE requisicao_ferias
          SET    sit_requisicao  = 4
                ,usuario         = SUBSTR(x.usuario||'Prc_Atualiza_Req',1,30)
                ,dt_atualizacao  = SYSDATE
                ,DT_SIT_SOLICITACAO = sysdate
          WHERE  cod_solicitacao = psolicitacao;
          --
        END LOOP;
        --
      END IF;
      --
    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Ferias.Trata_Ferias-Erro: '||SQLERRM;
    END Trata_Ferias;
    --
    -- ===================================================
    --
    PROCEDURE Trata_Req_Vaga(pcod_empresa           empresas.cod%TYPE
                            ,pcod_requisicao        requisicao_vaga.cod_requisicao%TYPE
                            ,pflg_retorno    IN OUT VARCHAR2
                            ,pmsg_retorno    IN OUT VARCHAR2) IS
      --
      v_orcado  cl_vaga.orcado%TYPE := 'N';
      v_vaga    NUMBER;
      v_emp_aprov empresas.cod%TYPE;
      v_mat_aprov aprova_requisicao_vaga.mat_aprov%TYPE;
      v_usuario usuario_oracle.nm_usuario_oracle%TYPE;
      --
      CURSOR c_vaga IS
        SELECT *
          FROM requisicao_vaga rv
         WHERE rv.cod_requisicao = pcod_requisicao
           AND rv.cod_empresa    = pcod_empresa;
      --
      r_vaga c_vaga%ROWTYPE;
      --

      CURSOR c1 IS
      SELECT cod_vaga
        FROM cl_vaga
       WHERE cod_requisicao = pcod_requisicao;

      v_c1 c1%ROWTYPE;

    BEGIN
      --
      OPEN c1;
      FETCH c1 INTO v_c1;
      CLOSE c1;

      IF v_c1.cod_vaga IS NULL THEN
      --
      OPEN c_vaga;
      FETCH c_vaga
        INTO r_vaga;
      CLOSE c_vaga;
      --
      --dbms_output.put_line('#01 PRC_ATUALIZA_REQ.TRATA_REQ_VAGA VEXISTE = '||VEXISTE);

      BEGIN
        --
        SELECT DISTINCT 'S'
        INTO   VEXISTE
        FROM   APROVA_REQUISICAO_VAGA ARV
        WHERE  ARV.STATUS_APROV IN ('P','R')
        AND    ARV.COD_REQUISICAO = R_VAGA.COD_REQUISICAO;
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          VEXISTE := 'N';
      END;

      IF NVL(vexiste,'N') = 'N' THEN
        -- Se todos aprovaram
        --
        IF TRUNC(SYSDATE) NOT BETWEEN r_vaga.data_inicio AND r_vaga.data_fim THEN
          v_orcado := 'S';
        END IF;
        --
        -- insert into testex VALUES (111,'prc_atualiza_req: #01 qtde_vagas: '||r_vaga.qtde_vagas); COMMIT;

        FOR i IN 1 .. r_vaga.qtde_vagas LOOP
          --
          --   select seq_vaga.nextval into v_vaga from dual;
          --

          -- insert into testex VALUES (111,'prc_atualiza_req: #02'); COMMIT;

          BEGIN
            --
            SELECT NVL(MAX(TO_NUMBER(cod_vaga)) + 1, 1) -- vlambert -- adição de to_number para selecionar o maior número
              INTO v_vaga
              FROM cl_vaga
             WHERE cod_empresa = r_vaga.cod_empresa;
             -- and cod_filial    = r_vaga.cod_filial;
            --
          EXCEPTION
            WHEN OTHERS THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'Prc_Atualiza_Req - Erro: ' || SQLERRM;
              RAISE vsaida_erro;
          END;
          --

          --dbms_output.put_line('#02 PRC_ATUALIZA_REQ.TRATA_REQ_VAGA');

          -- insert into testex VALUES (111,'prc_atualiza_req: #03'); COMMIT;

          BEGIN
            --
            INSERT INTO cl_vaga
              (cod_empresa,
            COD_FILIAL,
            DATA_INICIO,
            DATA_FIM,
            COD_VAGA,
            COEFICIENTE_FTE,
            COD_CCUSTO,
            COD_CARGO,
            COD_CARGO_REFERENCIA,
            COD_FUNCAO,
            COD_CATEGORIA,
            VINCULO,
            TIPO_SALARIO,
            VALOR_VERBA,
            DT_ABERT_VAGA,
            MOT_ABERT_VAGA,
            COD_REQUISICAO,
            DT_MUD_VAGA,
            COD_MOT_MUD_VAGA,
            SIT_VAGA,
            DT_SIT_VAGA,
            DISPONIVEL,
            ORCADO,
            TEXTO,
            TIPO_VAGA,
            VALOR_TOTAL,
            VALOR_TOTAL_CARGO,
            VALOR_TOTAL_VAGA,
            USUARIO,
            DT_ATUALIZACAO,
            COD_GRUPOS_SALARIAIS,
            COD_CAT_GRUPOS_SALARIAIS,
            COD_PONTO_FAIXA,
            COD_SINDICATO,
            RT_JORNADA_MENSAL,
            IND_VAGA_COMPARTILHADA,
            VAGA_COMPARTILHADA,
            PERC_REMUNERACAO,
            REMUNERACAO,
            COD_CCUSTO_CONTAB,
            COD_UN_NEGOCIO,
            COD_UNIDADE_ADM,
            COD_LOCAL_TRAB,
            COD_METRICA,
            COD_TIPO_PROCESSO,
            VAGA_FATURAVEL,
            VALOR_FATURAVEL,
            VAGA_CONFIDENCIAL,
            IND_DEF_FIS,
            RAIS_IND_DEF_FISICO,
            RAIS_IND_DEF_AUDITIVA,
            RAIS_IND_DEF_VISUAL,
            RAIS_IND_DEF_MENTAL,
            RAIS_IND_DEF_MULTIPLA,
            REMUNERACAO_VARIAVEL,
            PERC_BENEFICIO_VARIAVEL,
            COD_ATIVIDADE,
            REFEITORIO,
            COD_SINDICATO_PF,
            RT_JORNADA_MENSAL_PF,
            COD_HORARIO_JORNADA,
            COD_HORARIO,
            IND_INSALUB,
            IND_PERIC,
            MARCA_PONTO,
            TP_REGISTRO_PONTO,
            DT_PREVISAO_ADMISSAO,
            DT_PREV_FIM_CONTRATO,
            TIPO_CONTRATO,
            MOTIVO_EXCECAO,
            ORGAO_PUBLICO,
            NOVO_CONTRATO,
            VALOR_VENDA,
            DESC_ATIVIDADES,
            tipo_modalidade,
            vlr_aux_tipo_modalidade,
            trab_intermitente,
            cod_area
            )
            VALUES
              (r_vaga.cod_empresa,
               r_vaga.cod_filial,
               r_vaga.data_inicio,
               r_vaga.data_fim,
               NVL(v_vaga, 1),
               NVL(r_vaga.coeficiente_fte, 100),
               r_vaga.cod_ccusto,
               r_vaga.cod_cargo,
               r_vaga.cod_cargo_referencia,
               r_vaga.cod_funcao,
               r_vaga.cod_categoria,
               r_vaga.vinculo,
               r_vaga.tipo_salario,
               r_vaga.valor_verba,
               r_vaga.dt_abert_vaga,
               r_vaga.mot_abert_vaga,
               r_vaga.cod_requisicao,
               NULL,
               NULL,
               'A',
               r_vaga.dt_abert_vaga,
               'S',
               v_orcado,
               r_vaga.texto,
               NULL,
               r_vaga.valor_total,
               NULL,
               NULL,
               r_vaga.usuario,
               SYSDATE,
             r_vaga.COD_GRUPOS_SALARIAIS,
            r_vaga.COD_CAT_GRUPOS_SALARIAIS,
               r_vaga.cod_ponto_faixa,
               r_vaga.cod_sindicato,
               r_vaga.rt_jornada_mensal,
               NULL,
               NULL,
              r_vaga.PERC_REMUNERACAO,
               r_vaga.remuneracao,
               r_vaga.cod_ccusto_contab,
               r_vaga.cod_un_negocio,
               r_vaga.cod_unidade_adm,
               r_vaga.cod_local_trab,
               r_vaga.cod_metrica,
               r_vaga.cod_tipo_processo,
               r_vaga.vaga_faturavel,
               r_vaga.valor_faturavel,
               r_vaga.vaga_confidencial,
               r_vaga.ind_def_fis,
               r_vaga.rais_ind_def_fisico,
               r_vaga.rais_ind_def_auditiva,
               r_vaga.rais_ind_def_visual,
               r_vaga.rais_ind_def_mental,
               r_vaga.rais_ind_def_multipla,
               r_vaga.remuneracao_variavel,
               NVL(r_vaga.perc_benef_excecao ,r_vaga.perc_beneficio_variavel),
               r_vaga.cod_atividade,
               r_vaga.refeitorio,
               r_vaga.cod_sindicato_pf,
               r_vaga.rt_jornada_mensal_pf,
               r_vaga.cod_horario_jornada,
               r_vaga.cod_horario,
              r_vaga.ind_insalub,
               r_vaga.ind_peric,
               NVL(r_vaga.marca_ponto,'S'),
               NVL(r_vaga.tp_registro_ponto,'A'),
               r_vaga.dt_previsao_admissao,
               r_vaga.dt_prev_fim_contrato,
               r_vaga.tipo_contrato,
               r_vaga.motivo_excecao,
               r_vaga.ORGAO_PUBLICO,
               r_vaga.NOVO_CONTRATO,
               r_vaga.VALOR_VENDA,
               r_vaga.DESC_ATIVIDADES,
               r_vaga.tipo_modalidade,
               r_vaga.vlr_aux_tipo_modalidade,
               r_vaga.trab_intermitente,
               r_vaga.cod_area
               ); -- add un_adm, un_negocio e custo_contab
            --
          EXCEPTION
            WHEN OTHERS THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'Não foi possível inserir na tabela cl_vaga! '||SQLERRM(SQLCODE);
              RAISE vsaida_erro;
          END;
          --
          -- insert into testex VALUES (111,'prc_atualiza_req: #04'); COMMIT;

/*          BEGIN
            --
            INSERT INTO cl_historico_vaga
              (cod_empresa,
               cod_filial,
               data_inicio,
               data_fim,
               cod_vaga,
               coeficiente_fte,
               cod_ccusto,
               cod_cargo,
               cod_cargo_referencia,
               cod_funcao,
               cod_categoria,
               vinculo,
               tipo_salario,
               valor_verba,
               dt_abert_vaga,
               cod_requisicao,
               mot_abert_vaga,
               dt_mud_vaga,
               cod_mot_mud_vaga,
               sit_vaga,
               dt_sit_vaga,
               disponivel,
               orcado,
               texto,
               tipo_vaga,
               valor_total,
               valor_total_cargo,
               valor_total_vaga,
               cod_unidade_adm,
               cod_un_negocio,
               cod_ccusto_contab,
               usuario,
               dt_atualizacao)
            VALUES
              (r_vaga.cod_empresa,
               r_vaga.cod_filial,
               r_vaga.data_inicio,
               r_vaga.data_fim,
               NVL(v_vaga, 1),
               r_vaga.coeficiente_fte,
               r_vaga.cod_ccusto,
               r_vaga.cod_cargo,
               r_vaga.cod_cargo_referencia,
               r_vaga.cod_funcao,
               r_vaga.cod_categoria,
               r_vaga.vinculo,
               r_vaga.tipo_salario,
               r_vaga.valor_verba,
               r_vaga.dt_abert_vaga,
               r_vaga.cod_requisicao,
               r_vaga.mot_abert_vaga,
               NULL,
               NULL,
               'A',
               r_vaga.dt_abert_vaga,
               'S',
               v_orcado,
               r_vaga.texto,
               NULL,
               r_vaga.valor_total,
               NULL,
               NULL,
               r_vaga.cod_unidade_adm,
               r_vaga.cod_un_negocio,
               r_vaga.cod_ccusto_contab,
               r_vaga.usuario,
               SYSDATE); -- add un_adm, un_negocio e custo_contab
            --
          EXCEPTION
            WHEN OTHERS THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'Não foi possível inserir na tabela cl_historico_vaga! '||SQLERRM(SQLCODE);
              RAISE vsaida_erro;
          END;*/ -- Retirado Dri em 23/09/2020, já existe trigger que popula esse histórico
          --
          -- insert into testex VALUES (111,'prc_atualiza_req: #05'); COMMIT;
          --
          BEGIN

              INSERT INTO beneficios_vaga (cod_empresa, cod_filial, cod_vaga, cod_beneficio, valor, usuario, dt_atualizacao)
              (SELECT cod_empresa, cod_filial, NVL(v_vaga, 1), cod_beneficio, valor, r_vaga.usuario, SYSDATE
                                   FROM beneficios_vaga_temp
                                  WHERE cod_requisicao = pcod_requisicao);

          EXCEPTION
            WHEN OTHERS THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'Não foi possível inserir na tabela beneficios_vaga! '||SQLERRM(SQLCODE);
              RAISE vsaida_erro;
          END;

          -- insert into testex VALUES (111,'prc_atualiza_req: #06'); COMMIT;

          if r_vaga.abre_req_pessoal = 'S' then
            begin
              prc_req_pessoal_vaga (r_vaga.cod_empresa,
                                    r_vaga.cod_filial,
                                    NVL(v_vaga, 1),
                                    r_vaga.usuario);
            exception
              when others then
                null;
                -- insert into testex values (111,'prc_atualiza_req: #07 '); commit;
            end;
          end if;

        END LOOP;
        --

          --dbms_output.put_line('#03 PRC_ATUALIZA_REQ.TRATA_REQ_VAGA');

        -- insert into testex VALUES (111,'prc_atualiza_req: #07'); COMMIT;

        UPDATE requisicao_vaga rv
             SET cod_sit_requisicao = 2
                ,rv.usuario         = SUBSTR(v_usuario||'Prc_Atualiza_Req',1,30)
                ,rv.dt_atualizacao  = SYSDATE
           WHERE cod_requisicao     = r_vaga.cod_requisicao;
        --
      ELSE -- Se não está totalmente aprovada...
        --
          --dbms_output.put_line('#04 PRC_ATUALIZA_REQ.TRATA_REQ_VAGA');

        BEGIN
          --
          SELECT cod_emp_aprov
                ,mat_aprov
            INTO v_emp_aprov
                ,v_mat_aprov
            FROM aprova_requisicao_vaga
           WHERE cod_requisicao = r_vaga.cod_requisicao
             AND status_aprov   = 'R'
             AND ROWNUM         = 1;
          --
          BEGIN
            --
            SELECT nm_usuario_oracle
            INTO   v_usuario
            FROM   usuario_oracle
            WHERE  cd_matricula = v_mat_aprov
            AND    cd_empresa   = v_emp_aprov;
            --
          EXCEPTION
            WHEN OTHERS THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'Prc_Atualiza_Req - Erro: '||SQLERRM;
              RAISE vsaida_erro;
          END;
          --
          UPDATE requisicao_vaga rv
             SET cod_sit_requisicao = 4
                ,rv.usuario         = SUBSTR(v_usuario||'Prc_Atualiza_Req',1,30)
                ,rv.dt_atualizacao  = SYSDATE
           WHERE cod_requisicao     = r_vaga.cod_requisicao;
          --
        EXCEPTION
          WHEN NO_DATA_FOUND THEN
            NULL;
          WHEN OTHERS THEN
            pflg_retorno := 'N';
            pmsg_retorno := 'Prc_Atualiza_Req - Erro: '||SQLERRM;
            RAISE vsaida_erro;
        END;
        --
      END IF;
      --
          --dbms_output.put_line('#05 PRC_ATUALIZA_REQ.TRATA_REQ_VAGA');

      COMMIT;

    END IF;
      --
    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Prc_Atualiza_Req - Erro: '||SQLERRM;
    END Trata_Req_Vaga;
    --
    PROCEDURE trata_alt_func IS
      --
      vusuario_reprov aprova_solicitacao.usuario%TYPE;
      --
      PROCEDURE Cancel_Alt_Func_Compl IS
        --
        CURSOR c_requisicao IS
          SELECT r.cod_req
            FROM requisicao r
                ,cl_vaga cv
           WHERE cv.cod_vaga    = mp.cad_vaga
             AND cv.cod_filial  = mp.filial
             AND cv.cod_empresa = mp.cod_empresa_solicitado
             AND r.cod_empresa  = mp.cod_empresa_solicitado
             AND r.cod_vaga     IN (mp.cad_vaga,NVL(cv.vaga_compartilhada,cv.cod_vaga))
             AND r.cod_emp_req  = cv.cod_empresa
             AND r.cod_filial   = cv.cod_filial
             AND r.cod_sit_req  IN (1,5,6)
             AND r.dt_req       >= mp.dt_sit_solicitacao;
        --
        CURSOR c_alt_func(pdt_solicitacao DATE
                         ,pcod_empresa_solicitado empresas.cod%TYPE
                         ,pfilial filiais.cod_filial%TYPE
                         ,pcod_vaga cl_vaga.cod_vaga%TYPE) IS
          SELECT b.cod_solicitacao, b.cod_empresa_solicitado cod_empresa, b.filial cod_filial, b.cad_vaga, b.havera_reposicao
            FROM solicitacao_aprovadas a, solicitacao_alteracao_func b, cl_vaga cv
           WHERE cv.cod_vaga                                       = pcod_vaga
             AND cv.cod_filial                                     = pfilial
             AND cv.cod_empresa                                    = pcod_empresa_solicitado
             AND a.cod_solicitacao                                 = b.cod_solicitacao
             AND b.cod_sit_solicitacao                             IN (1,5,6)
             AND b.dt_solicitacao                                  >= pdt_solicitacao
             AND NVL(a.filial_aprov,b.filial)                      = cv.cod_filial
             AND NVL(a.cod_empresa_aprov,b.cod_empresa_solicitado) = cv.cod_empresa
             AND a.cad_vaga_aprov                                  IN (cv.cod_vaga,NVL(cv.vaga_compartilhada,cv.cod_vaga));
        --
        v_alt_func c_alt_func%ROWTYPE;
        --
        --v_dummy NUMBER(1);
        v_requisicao requisicao.cod_req%TYPE;
        v_form_desc aplicacoes.descricao%TYPE;
        --v_vaga2 cl_vaga.cod_vaga%TYPE;
        --
      BEGIN
       --
       IF NVL(mp.cod_sit_solicitacao,1) = 3 THEN
        --
          BEGIN
           --
           SELECT descricao
           INTO   v_form_desc
           FROM   aplicacoes
           WHERE  ROWNUM    = 1
           AND    aplicacao = 'F012019';
           --
          EXCEPTION
           WHEN OTHERS THEN
             v_form_desc := NULL;
          END;
          --
          OPEN c_requisicao;
          FETCH c_requisicao INTO v_requisicao;
          CLOSE c_requisicao;
          --
          IF NVL(v_requisicao, 0) <> 0 THEN
            --
            UPDATE requisicao
               SET cod_sit_req = 3
                  ,dt_sit_req  = sysdate
                  ,par_rh      = 'Solicitação cancelada em função do cancelamento da '||v_form_desc||' '||mp.cod_solicitacao||'.'
                  ,usuario     = SUBSTR('MP Mat'||mp.usuario||'Prc_Atualiza_Req',1,30)
                  ,DT_ATUALIZACAO = SYSDATE
             WHERE cod_req     = v_requisicao;
          --
         END IF;
          --
          OPEN c_alt_func(mp.dt_solicitacao
                         ,mp.cod_empresa_solicitado
                         ,mp.filial
                         ,mp.cad_vaga);
          FETCH c_alt_func INTO v_alt_func;
          CLOSE c_alt_func;
          --
          IF NVL(v_alt_func.cod_solicitacao, 0) <> 0 THEN
            --
            UPDATE solicitacao_alteracao_func
               SET cod_sit_solicitacao = 3
                  ,dt_sit_solicitacao  = sysdate
                  ,par_rh              = 'Solicitação cancelada em função do cancelamento da '||v_form_desc||' '||mp.cod_solicitacao||'.'
                  ,usuario             = SUBSTR('MP Mat'||mp.usuario||'Prc_Atualiza_Req',1,30)
                  ,DT_ATUALIZACAO      = SYSDATE
             WHERE cod_solicitacao     = v_alt_func.cod_solicitacao;
            --
            BEGIN
             --
             FOR x IN (SELECT saf.cod_empresa_solicitado cod_empresa, saf.filial cod_filial, saf.cad_vaga
                       FROM   solicitacao_alteracao_func saf
                       WHERE  saf.cod_solicitacao = v_alt_func.cod_solicitacao) LOOP
              --
               UPDATE cl_vaga
                  SET disponivel     = 'N'
                     ,USUARIO        = SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30)
                     ,DT_ATUALIZACAO = SYSDATE
                WHERE cod_empresa = v_alt_func.cod_empresa
                AND   cod_filial  = v_alt_func.cod_filial
                AND   cod_vaga    = v_alt_func.cad_vaga;
              --
              prc_cl_vaga_comp(v_alt_func.cod_empresa, v_alt_func.cod_filial, v_alt_func.cad_vaga, 'N');
              --
             END LOOP;
             --
            EXCEPTION
              WHEN OTHERS THEN
                NULL;
            END;
            --
          END IF;
          --
        END IF;
        --
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END Cancel_Alt_Func_Compl;
      --
    BEGIN
      --

      OPEN c4;
      FETCH c4 INTO mp;
      CLOSE c4;
      --
        BEGIN
          --
          SELECT DISTINCT 'S'
          INTO   vexiste
          FROM   aprova_solicitacao cr
          WHERE  cr.cod_solicitacao  = req.solicitacao
          AND    cr.status_aprov in ('P','R');
          --
        EXCEPTION
          WHEN NO_DATA_FOUND THEN
            vexiste := 'N';
          WHEN OTHERS THEN
            pflg_retorno := 'N';
            pmsg_retorno := 'Erro ao verificar andamento da requisição '||req.solicitacao;
        END;

      IF mp.cod_sit_solicitacao IN (1,5) AND NVL(vexiste,'N') = 'N' THEN -- Se todos aprovaram
        --
        IF mp.cod_solicitacao IS NOT NULL THEN
          --
          BEGIN
            --
            UPDATE solicitacao_alteracao_func
            SET    cod_sit_solicitacao = 5
                  ,usuario             = SUBSTR(req.nm_usuario_oracle||'Prc_Atualiza_Req',1,30)
                  ,dt_atualizacao      = SYSDATE
            WHERE  cod_sit_solicitacao = 1
            AND    cod_solicitacao     = mp.cod_solicitacao;
            --
          EXCEPTION
            WHEN OTHERS THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'Erro ao atualizar situação da requisição '||req.solicitacao;
              RAISE vsaida_erro;
          END;
          --
          OPEN c5;
          FETCH c5 INTO mp_aprov;
          CLOSE c5;
          --
          UPDATE cl_vaga
             SET disponivel = 'S'
                ,dt_atualizacao = SYSDATE
                ,usuario        = SUBSTR(usuario.busca_user||'Prc_Atualiza_Req',1,30)
           WHERE (mp_aprov.cad_vaga_aprov IS NOT NULL
              OR mp_aprov.situacao_aprov <> '01'
              OR mp_aprov.situacao_aprov_2 <> '01')
             AND nvl(mp.havera_reposicao,'S') = 'S' -- ch43927
             AND disponivel     = 'N'
             AND cod_vaga       = mp.cad_vaga
             AND cod_filial     = mp.filial
             AND cod_empresa    = mp.cod_empresa_solicitado;
          --
          IF SQL%FOUND THEN
            prc_cl_vaga_comp(mp.cod_empresa_solicitado,mp.filial,mp.cad_vaga, 'S');
          END IF;
          --
          IF mp_aprov.cad_vaga_aprov IS NOT NULL THEN
            --
            UPDATE cl_vaga
               SET disponivel     = 'N'
                  ,dt_atualizacao = SYSDATE
                  ,usuario        = SUBSTR(mp.usuario||'Prc_Atualiza_Req',1,30)
             WHERE mp_aprov.cad_vaga_aprov  IS NOT NULL
               AND disponivel     = 'S'
               AND cod_vaga       = mp_aprov.cad_vaga_aprov
               AND cod_filial     = mp_aprov.filial_vaga_aprov
               AND cod_empresa    = mp_aprov.emp_vaga_aprov;
            --
            IF SQL%FOUND THEN
              prc_cl_vaga_comp(mp_aprov.emp_vaga_aprov,mp_aprov.filial_vaga_aprov,mp_aprov.cad_vaga_aprov, 'S');
            END IF;
            --
          END IF;
          --
        END IF;
        --
      ELSE -- Verifica se houve cancelamento ou reprovação
        --
        vexiste := 'N';
        --
        BEGIN
          --
          SELECT DISTINCT 'S', usuario
          INTO   vexiste, vusuario_reprov
          FROM   aprova_solicitacao ass
          WHERE  cod_solicitacao  = psolicitacao
          AND    status_aprov = 'R';
          --
        EXCEPTION
          WHEN NO_DATA_FOUND THEN
            vexiste := 'N';
          WHEN OTHERS THEN
            pflg_retorno := 'N';
            pmsg_retorno := 'Erro ao verificar andamento da requisição '||req.solicitacao;
        END;
        --
        IF vexiste = 'S' THEN -- Se a requisição foi REPROVADA
          --
          UPDATE solicitacao_alteracao_func
          SET    cod_sit_solicitacao = 4
                ,dt_sit_solicitacao = sysdate
                ,usuario = SUBSTR(vusuario_reprov||'Prc_Atualiza_Req',1,30)
                ,dt_atualizacao = sysdate
          WHERE  cod_sit_solicitacao IN (1,4)
          AND    cod_solicitacao     = psolicitacao;
          --
        ELSE -- Se foi cancelada
          --
          vexiste := 'N';
          --
          IF mp.cod_sit_solicitacao = 3 THEN
            --
            OPEN c5;
            FETCH c5 INTO mp_aprov;
            CLOSE c5;
            --
            UPDATE cl_vaga
               SET disponivel = 'N'
                  ,dt_atualizacao = SYSDATE
                  ,usuario        = SUBSTR(usuario.busca_user||'Prc_Atualiza_Req',1,30)
             WHERE (mp_aprov.cad_vaga_aprov IS NOT NULL
                OR mp_aprov.situacao_aprov <> '01'
                OR mp_aprov.situacao_aprov_2 <> '01')
               AND disponivel     = 'S'
               AND cod_vaga       = mp.cad_vaga
               AND cod_filial     = mp.filial
               AND cod_empresa    = mp.cod_empresa_solicitado;
            --
            IF SQL%FOUND THEN
              prc_cl_vaga_comp(mp.cod_empresa_solicitado,mp.filial,mp.cad_vaga, 'N');
              --
              Cancel_Alt_Func_Compl;
              --
            END IF;
            --
            IF mp_aprov.cad_vaga_aprov IS NOT NULL THEN
              --
              UPDATE cl_vaga
                 SET disponivel = 'S'
                    ,dt_atualizacao = SYSDATE
                    ,usuario        = SUBSTR(mp.usuario||'Prc_Atualiza_Req',1,30)
               WHERE mp_aprov.cad_vaga_aprov  IS NOT NULL
                 AND disponivel     = 'N'
                 AND cod_vaga       = mp_aprov.cad_vaga_aprov
                 AND cod_filial     = mp_aprov.filial_vaga_aprov
                 AND cod_empresa    = mp_aprov.emp_vaga_aprov;
              --
              IF SQL%FOUND THEN
                --
                prc_cl_vaga_comp(mp_aprov.emp_vaga_aprov,mp_aprov.filial_vaga_aprov,mp_aprov.cad_vaga_aprov, 'S');
                --
              END IF;
              --
            END IF;
            --
          END IF;
          --
        END IF;
        --
      END IF; -- Se todos aprovaram
      --
    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Trata_Alt_Func - Erro: '||SQLERRM;
    END Trata_Alt_Func;

    PROCEDURE Trata_Req_Reembolso( pcod_empresa IN REQ_REEMBOLSO.Cod_Empresa%type
                                 , psolicitacao IN consulta_requisicoes.solicitacao%TYPE
                                 ,  pflg_retorno  IN OUT VARCHAR2
                                 ,  pmsg_retorno  IN OUT VARCHAR2
                                 ) IS

        /*cursor c1 is
        select * from req_reembolso
            where cod_empresa =  pcod_empresa
            and cod_req = psolicitacao;*/

        cursor c2 is
        select count(*) total
         from aprova_reembolso
            where cod_empresa =  pcod_empresa
            and cod_req = psolicitacao
            and status_aprov = 'P';

        --v1 c1%rowtype;
        v2 c2%rowtype;
    begin
        pflg_retorno := 'S';
        pmsg_retorno := NULL;
       open c2;
       fetch c2 into v2;
       close c2;

       if v2.total = 0 then
          update req_reembolso
              set cod_sit_req = 5, dt_atualizacao = sysdate, dt_sit_req = sysdate
          where cod_req = psolicitacao
          and cod_empresa = pcod_empresa;
       end if;
       /*
      open c1;
      fetch c1 into v1;
      close c1;
      --if v1.tipo = 6 then
         begin
            PKG_REQ_REEMBOLSO.Insere_ocorrencias(p_codreq => psolicitacao,
                               pflg_retorno  => pflg_retorno,
                               pmsg_retorno  => pmsg_retorno);

            /*PKG_REQ_REEMBOLSO.Insere_ocorrencia_diversos(p_cod_req     => psolicitacao,
                                                          pflg_retorno => pflg_retorno,
                                                          pmsg_retorno => pmsg_retorno);

         exception
           when others then
               pflg_retorno := 'N';
               pmsg_retorno := 'Erro ao inserir em OCORRENCIA_CALCULO_DIVERSOS.'||SQLERRM;
         end;
         --elsif v1.tipo = 1 then
         --   PKG_REQ_REEMBOLSO.Insere_ocorrencias(p_codreq => psolicitacao,
         --                      pflg_retorno  => pflg_retorno,
         --                      pmsg_retorno  => pmsg_retorno);
         --
       --end if;
       --
       if pflg_retorno != 'N' then
          --
          open c2;
          fetch c2 into v2;
          close c2;
          if v2.total = 0 then
             UPDATE req_reembolso
             SET  cod_sit_req     = '2', dt_sit_req = SYSDATE --requisição concluída
                 ,USUARIO         = SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30)
                 ,DT_ATUALIZACAO  = SYSDATE
             WHERE cod_req    = psolicitacao;
          end if;
       --end if;
       --
*/
    exception
    when others then
        pflg_retorno := 'N';
        pmsg_retorno := SQLERRM;

    end Trata_Req_Reembolso;

    PROCEDURE Trata_Req_Apuracao ( pcod_empresa IN PE_REQ_APURACAO.Cod_Empresa%type
                                 , psolicitacao IN consulta_requisicoes.solicitacao%TYPE
                                 ,  pflg_retorno  IN OUT VARCHAR2
                                 ,  pmsg_retorno  IN OUT VARCHAR2
                                 ) IS
        l_contador_nao_aprov number := 0;
        --l_conta              number := 0;
        p_usuario            varchar2(30);
        l_erro               varchar2(4000);
        v_evento_conversao   number := 0;
        --v_cod_site_req       pe_req_apuracao.cod_sit_req%type;
        v_status             number := 0;

        p_painel             varchar2(2);
        --
        cursor c_req is
        select * from PE_REQ_APURACAO
          where cod_empresa = pcod_empresa
          and cod_req = psolicitacao;

        r_req c_req%rowtype;
        --
        cursor c_aprovacao is
        select 1 rejeitada
        from aprova_apuracao
          where cod_empresa = pcod_empresa
          and cod_solicitacao = psolicitacao
          and status_aprov not in ( 'A', 'P');

        r_aprovacao c_aprovacao%rowtype;
        --
         --
     begin
        -- PEGAR EMPRESA DO APROVADOR
        begin
           select nvl(apex_util.get_session_state('P_PAINEL'), 'X')
             into p_painel
             from dual;
        exception
         when others then
           p_painel := null;
        end;
        if p_painel <> 'PC' then
              --
              begin
                select count(*)
                   into l_contador_nao_aprov
                from aprova_apuracao
                where cod_solicitacao = psolicitacao
                and cod_empresa = pcod_empresa
                and status_aprov not in ('A', 'R');

              exception
                when others then
                   l_contador_nao_aprov := 1;
              end;
              --
              open c_aprovacao;
              fetch c_aprovacao into r_aprovacao;
              close c_aprovacao;
              v_status := NVL(r_aprovacao.rejeitada, 0);
              --
              if l_contador_nao_aprov = 0 then
                  open c_req;
                  fetch c_req into r_req;
                  close c_req;
                  if v_status = 0 then
                  --
                    /*
                    UPDATE PE_REQ_APURACAO
                    SET    cod_sit_req = '2', dt_sit_req = SYSDATE,
                    USUARIO = SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30),
                    DT_ATUALIZACAO = SYSDATE
                    WHERE  cod_req = psolicitacao;*/
                --

                  -- 20241002 - desconsiderar a quantidade de horas - Andre - 03/01/2024

                  -- Inclusao do processo para zerar DSR quando requisicao de falta eh concluida
                  --open c_faltas(r_req.cod_empresa, r_req.matricula, r_req.data_ponto);
                  --fetch c_faltas into r_faltas;
                  --close c_faltas;
                  -- processo para apuracao manual completa
                  --if r_faltas.total > 0 then
                  begin
                     PKG_REQ_APURACAO.PRC_ZERAR_DSR_COMPLETO( p_cod_empresa => r_req.cod_empresa
                                                             , p_matricula   => r_req.matricula
                                                             , p_data        => r_req.data_ponto
                                                             , p_retorno     => l_erro);

                  exception
                    when others then
                         pflg_retorno   := 'N';
                         pmsg_retorno   := l_erro||'. Ajuste DSR para requisição '||psolicitacao||' apuracao manual completa';
                  end;
                  --end if;
                  --
                  --l_conta := 0;

                  -- 20241002 - desconsiderar a quantidade de horas - Andre - 03/01/2024
                  ----validando se faltas tiveram apuração manual PARCIAL(qtd_horas < qtd_horas_ant) de horas para zerar DSR
                  --open c_parciais(r_req.cod_empresa, r_req.matricula, r_req.data_ponto);
                  --fetch c_parciais into r_parciais;
                  --close c_parciais;
                  --
                  -- processo para apuracao manual parcial
                  --if r_parciais.total > 0 then
                  begin
                     PKG_REQ_APURACAO.PRC_ZERAR_DSR_PARCIAL( p_cod_empresa => r_req.cod_empresa
                                                             , p_matricula   => r_req.matricula
                                                             , p_data        => r_req.data_ponto
                                                             , p_retorno     => l_erro);

                  exception
                    when others then
                         pflg_retorno   := 'N';
                         pmsg_retorno   := l_erro||'. Ajuste DSR para requisição '||psolicitacao||' apuracao manual parcial';
                  end;
                  --end if;
                  --
                  if pmsg_retorno is null then

                        begin
                          select nvl(apex_util.get_session_state('P_USUARIO'), r_req.Usuario)
                                   into p_usuario
                          from dual;
                        exception
                          when others then
                               p_usuario := null;
                        end;

                        if p_usuario is not null then
                            begin
                             PKG_REQ_APURACAO.PRC_INSERE_APURACAO (P_COD_EMPRESA             => r_req.cod_empresa
                                                                    , P_MATRICULA             => r_req.matricula
                                                                    , P_DATA                  => r_req.data_ponto
                                                                    , P_DATA_NOVO             => r_req.data_ponto
                                                                    , P_tipo_evento           => r_req.tipo_evento_atual
                                                                    , P_tipo_evento_NOVO      => r_req.tipo_evento
                                                                    , P_COD_EVENTO            => r_req.cod_evento_atual
                                                                    , P_COD_EVENTO_NOVO       => r_req.cod_evento
                                                                    , P_COD_ITEM              => r_req.cod_item
                                                                    , P_ID_APURACAO           => r_req.id_apuracao
                                                                    , P_QTD_HORAS             => r_req.qtd_horas_atual
                                                                    , P_QTD_HORAS_NOVO        => r_req.qtd_horas
                                                                    , P_USUARIO               => p_usuario||'_INS'
                                                                    , P_ROWID_REMAN           => NULL
                                                                    , P_QTD_HORAS_REMAN       => NULL
                                                                    , P_COD_REQ               => r_req.cod_req
                                                                     );

                            exception
                              when others then
                                   pflg_retorno   := 'N';
                                   pmsg_retorno   := 'Erro ao tentar concluir requisicao. Inclusao historico. '||psolicitacao||SQLERRM;
                            end;
                        end if;
                        if r_req.tipo_evento_atual = 'PONTO'
                            and r_req.tipo_evento = 'BANCO' then

                                PKG_REQ_APURACAO.PRC_INSERE_APURACAO_CONVERSAO
                                                   ( p_cod_empresa               => r_req.cod_empresa
                                                   , p_cod_req                   => psolicitacao
                                                   , p_usuario                   => r_req.usuario||'_CONV'
                                                   , p_evento_atual              => r_req.cod_evento_atual
                                                   , p_evento_conversao          => v_evento_conversao
                                                   , p_retorno                   => l_erro );
                         end if;

                  end if;
                  --
                  --if p_painel <> 'PC' then
                     begin
                          UPDATE PE_REQ_APURACAO
                                 SET cod_sit_req     =  '2'
                                    --, evento_conversao = v_evento_conversao
                                    , dt_sit_req = SYSDATE --requisição concluída
                                    , usuario         = SUBSTR(USUARIO.BUSCA_USER||'Trata_Req_Apuracao',1,30)
                                    , dt_atualizacao  = SYSDATE
                          WHERE cod_req              = psolicitacao;
                          --and cod_empresa            = pcod_empresa;

                          COMMIT;
                     exception
                         when others then
                             pflg_retorno   := 'N';
                             pmsg_retorno   := 'Erro ao tentar concluir requisicao '||psolicitacao||SQLERRM;
                     end;

                     if l_contador_nao_aprov > 0 then
                          UPDATE PE_REQ_APURACAO
                          SET    cod_sit_req = '4', dt_sit_req = SYSDATE,
                          USUARIO = SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30),
                          DT_ATUALIZACAO = SYSDATE
                          WHERE  cod_req = psolicitacao;
                     end if;
                  --end if;
                  end if;
              end if;

        end if;
        --
        if r_req.tipo_evento_atual = 'BANCO'
             and r_req.tipo_evento = 'PONTO' then
                  PKG_REQ_APURACAO.PRC_INSERE_APURACAO_DSR(p_cod_empresa => r_req.cod_empresa
                                                         , p_cod_req    => r_req.cod_req
                                                         , p_usuario    => p_usuario
                                                         , p_retorno    => l_erro);

        end if;

    exception
      when others then
        pflg_retorno := 'N';
        pmsg_retorno := 'Trata_Req_Apuracao - Erro: '||SQLERRM;
    end;
    --
    PROCEDURE Trata_Abono (psolicitacao  pe_req_tratamento_batimentos.cod_req%TYPE,
                            pflg_retorno  IN OUT VARCHAR2,
                            pmsg_retorno  IN OUT VARCHAR2) IS
      --
      CURSOR req IS

        SELECT *
          FROM pe_req_tratamento_batimentos
         WHERE cod_req = psolicitacao;
      --
      v_req req%ROWTYPE;
      --
      PROCEDURE Insere_Abono(psolicitacao  pe_req_tratamento_batimentos.cod_req%TYPE,
                            pflg_retorno  IN OUT VARCHAR2,
                            pmsg_retorno  IN OUT VARCHAR2) IS
      --
      CURSOR req_abono IS
        SELECT *
          FROM pe_req_tratamento_batimentos
         WHERE cod_req = psolicitacao;
      --
      v_req_abono req_abono%ROWTYPE;
      --
      BEGIN
      --
      --dbms_output.put_line('prc_atualiza_req: Insere_Abono #01');

      OPEN  req_abono;
      FETCH req_abono INTO v_req_abono;
      CLOSE req_abono;
      --

      BEGIN

        IF (v_req_abono.hora_batida_abono IS NOT NULL OR v_req_abono.cod_justificativa IS NOT NULL)
           and nvl(v_req_abono.apagar_marcacao,'N') = 'N' THEN

          --dbms_output.put_line('prc_atualiza_req: Insere_Abono #02');

          pkg_pe_abono.prc_atualiza_batida (v_req_abono.cod_empresa,
                                            v_req_abono.matricula,
                                            v_req_abono.data_ponto,
                                            v_req_abono.hora_batida,
                                            v_req_abono.hora_batida_abono,
                                            v_req_abono.posicao,
                                            v_req_abono.cod_justificativa,
                                            v_req_abono.comentarios,
                                            v_req_abono.usuario);
         -- insert into testex values (111,'prc_atualiza_req: Insere_Abono #02 prc_req_desloc_marcacao'); commit;
--DESCOMENTAR         pkg_pe_abono.prc_req_desloc_marcacao(v_req_abono.cod_req);
         -- insert into testex values (111,'prc_atualiza_req: Insere_Abono #03 prc_req_desloc_marcacao'); commit;

        ELSIF nvl(v_req_abono.apagar_marcacao,'N') = 'S' THEN

        --dbms_output.put_line('prc_atualiza_req: Insere_Abono #03 '||v_req_abono.data_ponto);

            BEGIN
              -->> MSS 20230718
              --pkg_pe_abono.prc_deleta_batida(v_req_abono.cod_empresa, v_req_abono.matricula, v_req_abono.data_ponto, v_req_abono.posicao, v_req_abono.usuario, null, psolicitacao);
              IF v_req_abono.posicao_envio IS NULL THEN

                pkg_pe_abono.prc_deleta_batida(v_req_abono.cod_empresa, v_req_abono.matricula, v_req_abono.data_ponto, v_req_abono.posicao, v_req_abono.usuario, null, psolicitacao);
              END IF;
              --<<
            END;

        --dbms_output.put_line('prc_atualiza_req: Insere_Abono #03.1 '||v_req_abono.data_ponto);

        else

          --dbms_output.put_line('prc_atualiza_req: Insere_Abono #04');

            BEGIN

              pkg_pe_abono.prc_deleta_batida_abono(v_req_abono.cod_empresa, v_req_abono.matricula, v_req_abono.data_ponto, v_req_abono.posicao, v_req_abono.usuario);
            END;

--DESCOMENTAR            pkg_pe_abono.prc_req_desloc_marcacao(v_req_abono.cod_req);

        END IF;
        --
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foram encontrados dados na requisição de Abono para replicar para a tabela de Tratamento de Batimentos!';
          RAISE vsaida_erro;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foi possível atualizar tabela de Tratamento de Batimentos! erro: '||SQLERRM(SQLCODE);
          RAISE vsaida_erro;
      END;
      --
      BEGIN
        --
        --dbms_output.put_line('prc_atualiza_req: Insere_Abono #04');

        UPDATE pe_req_tratamento_batimentos
           SET cod_sit_req     = '2', dt_sit_req = SYSDATE --requisição concluída
              ,USUARIO         = SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30)
              ,DT_ATUALIZACAO  = SYSDATE
         WHERE cod_req    = psolicitacao;
        --
        -->> MSS 20220824 (Sidnei)
        IF SQL%FOUND THEN
          pkg_pe_abono.prc_ApuracaoReqAbono(pRequisicao => psolicitacao
                                           ,pUser       => SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30)
                                           ,pMsgErro    => pmsg_retorno);
          --
          IF pmsg_retorno IS NOT NULL THEN
            pflg_retorno := 'N';
            RAISE vsaida_erro;
          END IF;
        END IF;
        --<<
        commit;

      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foram encontrados dados na requisição de abono para replicar para a tabela de Tratamento de Batimentos! => '||pmsg_retorno;
          RAISE vsaida_erro;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foi possível atualizar tabela de Tratamento de Batimentos! erro: '||SQLERRM(SQLCODE)||' => '||pmsg_retorno;
          RAISE vsaida_erro;
      END;
      --
      EXCEPTION
      WHEN vsaida_erro THEN
        pmsg_retorno := pflg_retorno||'-'||pmsg_retorno;
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Pe_Abono.prc_atualiza_batidas - Erro: '||SQLERRM;
      END Insere_Abono;
      --
      --
      BEGIN
      --
      if instr(1/2,',') > 0 then
      EXECUTE IMMEDIATE 'ALTER SESSION SET NLS_NUMERIC_CHARACTERS= ''.,'' ';
      end if;
      --
      OPEN  req;
      FETCH req INTO v_req;
      CLOSE req;
      --
      pflg_retorno := 'S';
      --
      -- insert into testex values (111,'prc_atualiza_req: Trata_Abono #01'); commit;
    if v_req.cod_sit_req = 3 then -- Adicionado por Igor Cardoso 25/09/2019

      BEGIN
      --pkg_pe_abono.prc_deleta_batida_abono(v_req.cod_empresa, v_req.matricula, v_req.data_ponto, v_req.posicao, v_req.usuario);
      update pe_tratamento_batimentos
         set hora_batida_abono = null,
             cod_justificativa = null,
             comentarios = null,
             USUARIO = SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30),
             DT_ATUALIZACAO = SYSDATE
       where cod_empresa = v_req.cod_empresa
         and matricula = v_req.matricula
         and nvl(vira_dia, data_ponto) = v_req.data_ponto
         and posicao = v_req.posicao;

         commit;

      END;

    else

    -- insert into testex values (111,'prc_atualiza_req: Trata_Abono #02'); commit;

      BEGIN
          --
          vexiste := 'N';
          --
            SELECT DISTINCT 'S'
            INTO   vexiste
            FROM   aprova_abono
            WHERE  COD_EMPRESA     = pcod_empresa
            AND    COD_SOLICITACAO = psolicitacao
            AND    status_aprov    IN ('P','R');
            --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          --dbms_output.put_line('prc_atualiza_req: Trata_Abono #05');
          -- insert into testex values (111,'prc_atualiza_req: Trata_Abono #03'); commit;
              Insere_Abono(psolicitacao,
                        pflg_retorno,
                        pmsg_retorno);
          --
          -- insert into testex values (111,'prc_atualiza_req: Trata_Abono #04 '||pmsg_retorno); commit;

           --dbms_output.put_line('prc_atualiza_req: Insere_Abono #05.1 '||pflg_retorno||' '||pmsg_retorno);

          IF NVL(pflg_retorno,'S') <> 'S' THEN
            RAISE vsaida_erro;
          END IF;
          --
          -- insert into testex values (111,'prc_atualiza_req: Trata_Abono #05'); commit;

          --dbms_output.put_line('prc_atualiza_req: Insere_Abono #06');

              UPDATE pe_req_tratamento_batimentos
              SET    cod_sit_req = '2', dt_sit_req = SYSDATE,
              USUARIO = SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30),
              DT_ATUALIZACAO = SYSDATE
              WHERE  cod_req = psolicitacao;
          --

      END;
      --
      IF NVL(vexiste,'N') = 'S' THEN
        --
        FOR x IN (SELECT usuario
                  FROM   aprova_abono
                  WHERE  COD_EMPRESA     = pcod_empresa
                  AND    COD_solicitacao = psolicitacao
                  AND    status_aprov    = 'R'
                  ORDER BY dt_atualizacao DESC) LOOP
          --
          UPDATE pe_req_tratamento_batimentos
          SET    cod_sit_req  = 4
                ,usuario         = SUBSTR(x.usuario||'Prc_Atualiza_Req',1,30)
                ,dt_atualizacao  = SYSDATE
          WHERE  cod_req = psolicitacao;
          --
        END LOOP;
        --
      END IF;
      --
      --dbms_output.put_line('prc_atualiza_req: Insere_Abono #07');
     end if;
     --

     pkg_pe_abono.prc_ajusta_linha_req_abono( pcod_empresa    => pcod_empresa
                                            , psolicitacao => psolicitacao
                                            , pflg_retorno => pflg_retorno
                                            , pmsg_retorno => pmsg_retorno);

     --
     commit;
    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Pe_Abono.Trata_Abono - Erro: '||SQLERRM;
    END Trata_Abono;
    --

    PROCEDURE Trata_HE (psolicitacao  pe_req_hora_extra.cod_req%TYPE,
                            pflg_retorno  IN OUT VARCHAR2,
                            pmsg_retorno  IN OUT VARCHAR2) IS
      --
      PROCEDURE Insere_HE(psolicitacao  pe_req_hora_extra.cod_req%TYPE,
                            pflg_retorno  IN OUT VARCHAR2,
                            pmsg_retorno  IN OUT VARCHAR2) IS
      --
      CURSOR req_HE IS
        SELECT *
          FROM pe_req_hora_extra
         WHERE cod_req = psolicitacao;
      --
      v_req_he req_he%ROWTYPE;
      --
      BEGIN
      --
      --dbms_output.put_line('prc_atualiza_req: Insere_He #01');

      OPEN  req_he;
      FETCH req_he INTO v_req_he;
      CLOSE req_he;
      --
      BEGIN
      NULL;
      /*
        if v_req_he.hora_batida_abono is not null or v_req_he.cod_justificativa is not null then

        null;

        --dbms_output.put_line('prc_atualiza_req: Insere_Abono #02');

          pkg_pe_abono.prc_atualiza_batida (v_req_he.cod_empresa,
                                            v_req_he.matricula,
                                            v_req_he.data_ponto,
                                            v_req_he.hora_batida,
                                            v_req_he.hora_batida_abono,
                                            v_req_he.posicao,
                                            v_req_he.cod_justificativa,
                                            v_req_he.comentarios,
                                            v_req_he.usuario);

        else

        --dbms_output.put_line('prc_atualiza_req: Insere_Abono #03');

            begin
            pkg_pe_abono.prc_deleta_batida_abono(v_req_he.cod_empresa, v_req_he.matricula, v_req_he.data_ponto, v_req_he.posicao, v_req_he.usuario);
            end;


            null;
        end if;
        */
        --
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foram encontrados dados na requisição de Abono para replicar para a tabela de Tratamento de Batimentos!';
          RAISE vsaida_erro;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foi possível atualizar tabela de Tratamento de Batimentos! erro: '||SQLERRM(SQLCODE);
          RAISE vsaida_erro;
      END;
      --
      BEGIN
        --
        --dbms_output.put_line('prc_atualiza_req: Insere_HE #04');

        UPDATE pe_req_hora_extra
           SET cod_sit_req     = '2', dt_sit_req = SYSDATE --requisição concluída
              ,usuario = SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30)
              ,dt_atualizacao = sysdate
         WHERE cod_req    = psolicitacao;
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foram encontrados dados na requisição de abono para replicar para a tabela de Tratamento de Batimentos!';
          RAISE vsaida_erro;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foi possível atualizar tabela de Tratamento de Batimentos! erro: '||SQLERRM(SQLCODE);
          RAISE vsaida_erro;
      END;
      --
      EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Pe_Abono.prc_atualiza_batidas - Erro: '||SQLERRM;
      END Insere_He;
      --
    BEGIN
      --
      pflg_retorno := 'S';
      --
      BEGIN
          --
          vexiste := 'N';
          --
            SELECT DISTINCT 'S'
            INTO   vexiste
            FROM   aprova_hora_extra
            WHERE  COD_SOLICITACAO = psolicitacao
            AND    status_aprov    = 'P';
            --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          --
          --dbms_output.put_line('prc_atualiza_req: Insere_He #05');

              Insere_HE(psolicitacao,
                        pflg_retorno,
                        pmsg_retorno);
          --
          IF NVL(pflg_retorno,'S') <> 'S' THEN
            RAISE vsaida_erro;
          END IF;
          --
          --
          --dbms_output.put_line('prc_atualiza_req: Insere_HE #06');

              UPDATE pe_req_hora_extra
              SET    cod_sit_req = '2', dt_sit_req = SYSDATE
              ,USUARIO = SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30)
              ,DT_ATUALIZACAO = SYSDATE
              WHERE  cod_req = psolicitacao;
          --
      END;
      --
      IF NVL(vexiste,'N') = 'S' THEN
        --
        FOR x IN (SELECT usuario
                  FROM   aprova_hora_extra
                  WHERE  COD_EMPRESA     = pcod_empresa
                  AND    COD_solicitacao = psolicitacao
                  AND    status_aprov    = 'R'
                  ORDER BY dt_atualizacao DESC) LOOP
          --
          UPDATE pe_req_hora_extra
          SET    cod_sit_req  = 4, dt_sit_req = SYSDATE
                ,usuario         = SUBSTR(x.usuario||'Prc_Atualiza_Req',1,30)
                ,dt_atualizacao  = SYSDATE
          WHERE  cod_req = psolicitacao;
          --
        END LOOP;
        --
      END IF;
      --
      --dbms_output.put_line('prc_atualiza_req: Insere_He #07');

    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Pe_Abono.Trata_He - Erro: '||SQLERRM;
    END Trata_He;

    PROCEDURE Trata_Beneficio (psolicitacao  req_beneficios.cod_req%TYPE,
                            pflg_retorno  IN OUT VARCHAR2,
                            pmsg_retorno  IN OUT VARCHAR2) IS
      --
      cursor c10 is
      select *
        from aprova_beneficios
       where cod_solicitacao = psolicitacao
         and status_aprov = 'R';

      v_c10 c10%rowtype;

      PROCEDURE Insere_Beneficio(psolicitacao  req_beneficios.cod_req%TYPE,
                            pflg_retorno  IN OUT VARCHAR2,
                            pmsg_retorno  IN OUT VARCHAR2) IS
      --
      CURSOR req_beneficios IS
        SELECT *
          FROM req_beneficios
         WHERE cod_req = psolicitacao;
      --
      v_req_beneficios req_beneficios%ROWTYPE;
      --
      BEGIN
      --
      --dbms_output.put_line('prc_atualiza_req: Insere_Beneficio #01');

      OPEN  req_beneficios;
      FETCH req_beneficios INTO v_req_beneficios;
      CLOSE req_beneficios;
      --
      BEGIN

        IF v_req_beneficios.cod_empresa IS NOT NULL OR v_req_beneficios.matricula IS NOT NULL THEN

        dbms_output.put_line('prc_atualiza_req: Insere_beneficio #02');

          /*pkg_pe_abono.prc_atualiza_batida (v_req_abono.cod_empresa,
                                            v_req_abono.matricula,
                                            v_req_abono.data_ponto,
                                            v_req_abono.hora_batida,
                                            v_req_abono.hora_batida_abono,
                                            v_req_abono.posicao,
                                            v_req_abono.cod_justificativa,
                                            v_req_abono.comentarios,
                                            v_req_abono.usuario);*/

        ELSE

        dbms_output.put_line('prc_atualiza_req: Insere_Beneficio #03');

            /*begin
            pkg_pe_abono.prc_deleta_batida_abono(v_req_abono.cod_empresa, v_req_abono.matricula, v_req_abono.data_ponto, v_req_abono.posicao, v_req_abono.usuario);
            end;*/

        END IF;
        --
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foram encontrados dados na requisição de Beneficio para replicar para a tabela de Benefícios!';
          RAISE vsaida_erro;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foi possível atualizar tabela de Benefícios! erro: '||SQLERRM(SQLCODE);
          RAISE vsaida_erro;
      END;
      --
      BEGIN
        --
        --dbms_output.put_line('prc_atualiza_req: Insere_Beneficios #04');

        UPDATE req_beneficios
           SET cod_sit_req     = '5', dt_sit_req = SYSDATE --requisição aprovada
           ,DT_ATUALIZACAO = SYSDATE
           ,USUARIO = SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30)
         WHERE cod_req    = psolicitacao;
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foram encontrados dados na requisição de beneficios para replicar para a tabela de beneficios!';
          RAISE vsaida_erro;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foi possível atualizar tabela de Beneficios! erro: '||SQLERRM(SQLCODE);
          RAISE vsaida_erro;
      END;
      --
      EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Req_Beneficio.prc_atualiza_batidas - Erro: '||SQLERRM;
      END Insere_Beneficio;
      --
    BEGIN
      --
      pflg_retorno := 'S';
      --
      BEGIN
          --
          vexiste := 'N';
          --
            SELECT DISTINCT 'S'
            INTO   vexiste
            FROM   aprova_beneficios
            WHERE  COD_SOLICITACAO = psolicitacao
            AND    status_aprov    = 'P';
            --
          exception
          when no_data_found then
          vexiste := 'N';
          WHEN OTHERS THEN
           pflg_retorno := 'N';
           pmsg_retorno := '0 - Pkg_Req_Beneficio.Trata_Beneficio - Erro: '||SQLERRM;
      END;

      open c10;
      fetch c10 into v_c10;
      close c10;
      --
      --IF NVL(vexiste,'N') = 'S' THEN
        --
      if v_c10.status_aprov = 'R' then
        FOR x IN (SELECT usuario
                  FROM   aprova_beneficios
                  WHERE  COD_solicitacao = psolicitacao
                  AND    status_aprov    = 'R'
                  ORDER BY dt_atualizacao DESC) LOOP
          --
          begin
          UPDATE req_beneficios
          SET    cod_sit_req     = 4
                ,dt_sit_req      = sysdate
                ,usuario         = SUBSTR(x.usuario||'Prc_Atualiza_Req',1,30)
                ,dt_atualizacao  = SYSDATE
          WHERE  cod_req = psolicitacao;
          --
          exception
          WHEN OTHERS THEN
           pflg_retorno := 'N';
           pmsg_retorno := '1 - Pkg_Req_Beneficio.Trata_Beneficio - Erro: '||SQLERRM;
          end;
        END LOOP;
        --
       end if;

     IF NVL(vexiste,'N') = 'N' and v_c10.status_aprov is null /*reprovados*/ THEN -- ELSE

          --dbms_output.put_line('prc_atualiza_req: Insere_Beneficio #05');

              Insere_Beneficio(psolicitacao,
                        pflg_retorno,
                        pmsg_retorno);
          --
          IF NVL(pflg_retorno,'S') <> 'S' THEN
            RAISE vsaida_erro;
          END IF;
          --
          --
          --dbms_output.put_line('prc_atualiza_req: Insere_Beneficio #06');

          begin
              UPDATE req_beneficios
              SET    cod_sit_req = '5', dt_sit_req = SYSDATE, DT_ATUALIZACAO = SYSDATE
                     ,USUARIO = SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30)
              WHERE  cod_req = psolicitacao;
          exception
          WHEN OTHERS THEN
             pflg_retorno := 'N';
             pmsg_retorno := '2 - Pkg_Req_Beneficio.Trata_Beneficio - Erro: '||SQLERRM;
          end;
          --
      END IF;
      --
      --dbms_output.put_line('prc_atualiza_req: Insere_Beneficio #07');

    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := '3 - Pkg_Req_Beneficio.Trata_Beneficio - Erro: '||SQLERRM;
    END Trata_Beneficio;

    PROCEDURE Trata_Beneficio_Cand (psolicitacao  req_beneficios.cod_req%TYPE,
                            pflg_retorno  IN OUT VARCHAR2,
                            pmsg_retorno  IN OUT VARCHAR2) IS
      --
      PROCEDURE Insere_Beneficio_Cand(psolicitacao  req_beneficios.cod_req%TYPE,
                            pflg_retorno  IN OUT VARCHAR2,
                            pmsg_retorno  IN OUT VARCHAR2) IS
      --
      CURSOR req_beneficios IS
        SELECT *
          FROM req_beneficios_candidato
         WHERE cod_req = psolicitacao;
      --
      v_req_beneficios req_beneficios%ROWTYPE;
      --
      BEGIN
      --
      --dbms_output.put_line('prc_atualiza_req: Insere_Beneficio_Cand #01');

      OPEN  req_beneficios;
      FETCH req_beneficios INTO v_req_beneficios;
      CLOSE req_beneficios;
      --
      BEGIN

        IF v_req_beneficios.cod_empresa IS NOT NULL OR v_req_beneficios.cod_candidato IS NOT NULL THEN

        dbms_output.put_line('prc_atualiza_req: Insere_Beneficio_Cand #02');

          /*pkg_pe_abono.prc_atualiza_batida (v_req_abono.cod_empresa,
                                            v_req_abono.matricula,
                                            v_req_abono.data_ponto,
                                            v_req_abono.hora_batida,
                                            v_req_abono.hora_batida_abono,
                                            v_req_abono.posicao,
                                            v_req_abono.cod_justificativa,
                                            v_req_abono.comentarios,
                                            v_req_abono.usuario);*/

        ELSE

        dbms_output.put_line('prc_atualiza_req: Insere_Beneficio_Cand #03');

            /*begin
            pkg_pe_abono.prc_deleta_batida_abono(v_req_abono.cod_empresa, v_req_abono.matricula, v_req_abono.data_ponto, v_req_abono.posicao, v_req_abono.usuario);
            end;*/

        END IF;
        --
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foram encontrados dados na requisição de Beneficio para replicar para a tabela de Benefícios!';
          RAISE vsaida_erro;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foi possível atualizar tabela de Benefícios! erro: '||SQLERRM(SQLCODE);
          RAISE vsaida_erro;
      END;
      --
      BEGIN
        --
        --dbms_output.put_line('prc_atualiza_req: Insere_Beneficios_Cand #04');

        UPDATE req_beneficios_candidato
           SET cod_sit_req     = '5', dt_sit_req = SYSDATE --requisição concluída
           ,USUARIO = SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30)
           ,DT_ATUALIZACAO = SYSDATE
         WHERE cod_req    = psolicitacao;
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foram encontrados dados na requisição de beneficios para replicar para a tabela de beneficios!';
          RAISE vsaida_erro;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foi possível atualizar tabela de Beneficios! erro: '||SQLERRM(SQLCODE);
          RAISE vsaida_erro;
      END;
      --
      EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Req_Beneficio_Cand.prc_atualiza_batidas - Erro: '||SQLERRM;
      END Insere_Beneficio_Cand;
      --
    BEGIN
      --
      pflg_retorno := 'S';
      --
      BEGIN
          --
          vexiste := 'N';
          --
            SELECT DISTINCT 'S'
            INTO   vexiste
            FROM   aprova_beneficios_candidato
            WHERE  COD_SOLICITACAO = psolicitacao
            AND    status_aprov    = 'P';
            --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          --
          --dbms_output.put_line('prc_atualiza_req: Insere_Beneficio_Cand #05');

              Insere_Beneficio_Cand(psolicitacao,
                        pflg_retorno,
                        pmsg_retorno);
          --
          IF NVL(pflg_retorno,'S') <> 'S' THEN
            RAISE vsaida_erro;
          END IF;
          --
          --
          --dbms_output.put_line('prc_atualiza_req: Insere_Beneficio_Cand #06');

              UPDATE req_beneficios_candidato
              SET    cod_sit_req = '5', dt_sit_req = SYSDATE
                     ,USUARIO = SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30)
                     ,DT_ATUALIZACAO = SYSDATE
              WHERE  cod_req = psolicitacao;
          --
      END;
      --
      IF NVL(vexiste,'N') = 'S' THEN
        --
        FOR x IN (SELECT usuario
                  FROM   aprova_beneficios_candidato
                  WHERE  COD_EMPRESA     = pcod_empresa
                  AND    COD_solicitacao = psolicitacao
                  AND    status_aprov    = 'R'
                  ORDER BY dt_atualizacao DESC) LOOP
          --
          begin
            UPDATE req_beneficios_candidato
            SET    cod_sit_req  = 4
                  ,usuario         = SUBSTR(x.usuario||'Prc_Atualiza_Req',1,30)
                  ,dt_atualizacao  = SYSDATE
            WHERE  cod_req = psolicitacao;
          --
          exception
          WHEN OTHERS THEN
            pflg_retorno := 'N';
            pmsg_retorno := '2 - Pkg_Req_Beneficio_Cand.Trata_Beneficio - Erro: '||SQLERRM;
          end;
        END LOOP;
        --
      END IF;
      --
      --dbms_output.put_line('prc_atualiza_req: Insere_Beneficio_Cand #07');

    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := '3 - Pkg_Req_Beneficio.Trata_Beneficio_Cand - Erro: '||SQLERRM;
    END Trata_Beneficio_Cand;


    PROCEDURE Trata_Beneficiaria (psolicitacao  requisicao_beneficiaria.cod_requisicao%TYPE,
                            pflg_retorno  IN OUT VARCHAR2,
                            pmsg_retorno  IN OUT VARCHAR2) IS
      --
      PROCEDURE Insere_Beneficiaria(psolicitacao  requisicao_beneficiaria.cod_requisicao%TYPE,
                            pflg_retorno  IN OUT VARCHAR2,
                            pmsg_retorno  IN OUT VARCHAR2) IS
      --
      CURSOR req_beneficiaria IS
        SELECT *
          FROM requisicao_beneficiaria
         WHERE cod_requisicao = psolicitacao;
      --
      v_req_beneficiaria req_beneficiaria%ROWTYPE;
      --
      BEGIN
      --
      --dbms_output.put_line('prc_atualiza_req: Insere_Beneficiaria #01');

      OPEN  req_beneficiaria;
      FETCH req_beneficiaria INTO v_req_beneficiaria;
      CLOSE req_beneficiaria;
      --
      BEGIN

        IF v_req_beneficiaria.cod_empresa IS NOT NULL OR v_req_beneficiaria.matricula IS NOT NULL THEN

            BEGIN
            INSERT INTO beneficiaria (
            SEQ_BENEFICIARIA,
            NOME,
            ENDERECO,
            BAIRRO,
            CIDADE,
            CEP,
            COMPLEMENTO_CEP,
            DDD,
            TELEFONE,
            BANCO,
            AGENCIA,
            DC_AGENCIA,
            CONTA_CORRENTE,
            DC_CONTA_CORRENTE,
            MATRICULA,
            USUARIO,
            DT_ATUALIZACAO,
            UF,
            ORDEM,
            COD_EMPRESA,
            DC_MATRICULA,
            NUMERO,
            COMPLEM,
            NUM_CPF,
            DC_CPF,
            MODALIDADE,
            COD_TP_TRANS_BCA,
            VALOR_GARANTIA,
            NUM_IDENTIDADE,
            TEXT_OFICIO,
            BANCO_NOME,
            AGENCIA_NOME,
            NUM_OFICIO,
            DATA_INCLUSAO,
            DATA_SOLICITACAO,
            TIPO_OPERACAO,
            DATA_FIM,
            DT_NASCIMENTO,
            GRAU_PARENTESCO,
            CONDICAO_DEPEND_ES,
            EMAIL
            )
            VALUES (
            v_req_beneficiaria.SEQ_BENEFICIARIA,
            v_req_beneficiaria.NOME,
            v_req_beneficiaria.ENDERECO,
            v_req_beneficiaria.BAIRRO,
            v_req_beneficiaria.CIDADE,
            v_req_beneficiaria.CEP,
            v_req_beneficiaria.COMPLEMENTO_CEP,
            v_req_beneficiaria.DDD,
            v_req_beneficiaria.TELEFONE,
            v_req_beneficiaria.BANCO,
            v_req_beneficiaria.AGENCIA,
            v_req_beneficiaria.DC_AGENCIA,
            v_req_beneficiaria.CONTA_CORRENTE,
            v_req_beneficiaria.DC_CONTA_CORRENTE,
            v_req_beneficiaria.MATRICULA,
            v_req_beneficiaria.USUARIO,
            v_req_beneficiaria.DT_ATUALIZACAO,
            v_req_beneficiaria.UF,
            v_req_beneficiaria.ORDEM,
            v_req_beneficiaria.COD_EMPRESA,
            v_req_beneficiaria.DC_MATRICULA,
            v_req_beneficiaria.NUMERO,
            v_req_beneficiaria.COMPLEM,
            v_req_beneficiaria.NUM_CPF,
            v_req_beneficiaria.DC_CPF,
            v_req_beneficiaria.MODALIDADE,
            v_req_beneficiaria.COD_TP_TRANS_BCA,
            v_req_beneficiaria.VALOR_GARANTIA,
            v_req_beneficiaria.NUM_IDENTIDADE,
            v_req_beneficiaria.TEXT_OFICIO,
            v_req_beneficiaria.BANCO_NOME,
            v_req_beneficiaria.AGENCIA_NOME,
            v_req_beneficiaria.NUM_OFICIO,
            v_req_beneficiaria.DATA_INCLUSAO,
            v_req_beneficiaria.DATA_SOLICITACAO_BENEF,
            v_req_beneficiaria.TIPO_OPERACAO,
            v_req_beneficiaria.DATA_FIM,
            v_req_beneficiaria.DT_NASCIMENTO,
            v_req_beneficiaria.GRAU_PARENTESCO,
            v_req_beneficiaria.CONDICAO_DEPEND_ES,
            v_req_beneficiaria.EMAIL
            );
            COMMIT;

            END;
        --dbms_output.put_line('prc_atualiza_req: Insere_beneficiaria #02');

            IF v_req_beneficiaria.nome_arquivo IS NOT NULL THEN

            BEGIN
              INSERT INTO upload_files (cod_empresa, cod_item, seq_item, tipo_arquivo, caminho, cod_sub_item, arquivo, tipo, nome_arquivo, dt_atualizacao, usuario, tipo_sub_item)
                               VALUES (v_req_beneficiaria.cod_empresa, v_req_beneficiaria.matricula, v_req_beneficiaria.ordem, 25, NULL, v_req_beneficiaria.seq_beneficiaria, v_req_beneficiaria.arquivo, v_req_beneficiaria.tipo_arquivo, v_req_beneficiaria.nome_arquivo, SYSDATE, v_req_beneficiaria.usuario, 6);

            COMMIT;
            EXCEPTION
            WHEN OTHERS THEN
            ROLLBACK;
            NULL;

            END;

            END IF;

        END IF;
        --
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foram encontrados dados na requisição de Beneficiaria para replicar para a tabela de Beneficiaria!';
          RAISE vsaida_erro;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foi possível atualizar tabela de Beneficiaria! erro: '||SQLERRM(SQLCODE);
          RAISE vsaida_erro;
      END;
      --
      BEGIN
        --
        --dbms_output.put_line('prc_atualiza_req: Insere_Beneficiaria #04');

        UPDATE requisicao_beneficiaria
           SET status_requisicao     = '2', dt_sit_req = SYSDATE --requisição concluida
           ,USUARIO = SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30), DT_ATUALIZACAO = SYSDATE
         WHERE cod_requisicao    = psolicitacao;
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foram encontrados dados na requisição de beneficiaria para replicar para a tabela de beneficiaria!';
          RAISE vsaida_erro;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foi possível atualizar tabela de Requisicao_Beneficiaria! erro: '||SQLERRM(SQLCODE);
          RAISE vsaida_erro;
      END;
      --
      EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Req_Beneficiaria.prc_atualiza_batidas - Erro: '||SQLERRM;
      END Insere_Beneficiaria;
      --
    BEGIN
      --
      pflg_retorno := 'S';
      --
      BEGIN
          --
          vexiste := 'N';
          --
            SELECT DISTINCT 'S'
            INTO   vexiste
            FROM   aprova_req_beneficiaria
            WHERE  COD_req = psolicitacao
            AND    status_aprov    = 'P';
            --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          --
          --dbms_output.put_line('prc_atualiza_req: Insere_Beneficio #05');

              Insere_Beneficiaria(psolicitacao,
                        pflg_retorno,
                        pmsg_retorno);
          --
          IF NVL(pflg_retorno,'S') <> 'S' THEN
            RAISE vsaida_erro;
          END IF;
          --
          --
          --dbms_output.put_line('prc_atualiza_req: Insere_Beneficiaria #06');

              UPDATE requisicao_beneficiaria
                 SET status_requisicao = '2', dt_sit_req = SYSDATE
                 ,USUARIO = SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30), DT_ATUALIZACAO = SYSDATE
               WHERE cod_requisicao = psolicitacao;
          --
      END;
      --
      IF NVL(vexiste,'N') = 'S' THEN
        --
        FOR x IN (SELECT usuario
                  FROM   aprova_req_beneficiaria
                  WHERE  COD_EMPRESA     = pcod_empresa
                  AND    COD_req = psolicitacao
                  AND    status_aprov    = 'R'
                  ORDER BY dt_atualizacao DESC) LOOP
          --
          UPDATE requisicao_beneficiaria
          SET    status_requisicao  = 4, dt_sit_req = sysdate
                ,usuario         = SUBSTR(x.usuario||'Prc_Atualiza_Req',1,30)
                ,dt_atualizacao  = SYSDATE
          WHERE  cod_requisicao = psolicitacao;
          --
        END LOOP;
        --
      END IF;
      --
      --dbms_output.put_line('prc_atualiza_req: Insere_Beneficiaria #07');

    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Trata_Beneficiaria - Erro: '||SQLERRM;
    END Trata_Beneficiaria;

    /*PROCEDURE Trata_Lanc_Ponto (psolicitacao  req_lancamentos_ponto.cod_req%TYPE,
                            pflg_retorno  IN OUT VARCHAR2,
                            pmsg_retorno  IN OUT VARCHAR2) IS
      --
      CURSOR req IS

        SELECT *
          FROM req_lancamentos_ponto
         WHERE cod_req = psolicitacao;
      --
      v_req req%ROWTYPE;
      --
      PROCEDURE Insere_Lanc_Ponto(psolicitacao  REQ_LANCAMENTOS_PONTO.cod_req%TYPE,
                            pflg_retorno  IN OUT VARCHAR2,
                            pmsg_retorno  IN OUT VARCHAR2) IS
      --
      CURSOR req_lanc_ponto IS
        SELECT *
          FROM REQ_LANCAMENTOS_PONTO
         WHERE cod_req = psolicitacao;
      --
      v_req_lanc_ponto req_lanc_ponto%ROWTYPE;
      --
      BEGIN
      --
      OPEN  req_lanc_ponto;
      FETCH req_lanc_ponto INTO v_req_lanc_ponto;
      CLOSE req_lanc_ponto;
      --
      BEGIN

        IF v_req_lanc_ponto.cod_req IS NOT NULL THEN

        insert into lancamentos_ponto values (
          v_req_lanc_ponto.cod_empresa,
          v_req_lanc_ponto.matricula,
          v_req_lanc_ponto.dt_lancto,
          v_req_lanc_ponto.cod_folha,
          v_req_lanc_ponto.hora_inicio,
          v_req_lanc_ponto.hora_fim,
          v_req_lanc_ponto.hora_total,
          v_req_lanc_ponto.dt_atualizacao,
          v_req_lanc_ponto.usuario,
          v_req_lanc_ponto.cod_doenca,
          v_req_lanc_ponto.crm,
          v_req_lanc_ponto.tipo_categoria
        );


        PKG_REQ_LANC_EVENTO_PONTO.Fechamento(v_req_lanc_ponto.cod_req,
                                             v_req_lanc_ponto.usuario,
                                             pflg_retorno,
                                             pmsg_retorno);

        commit;

        END IF;
        --
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foram encontrados dados na requisição de lançamento de eventos de ponto para replicar para a tabela de Tratamento de Batimentos!';
          RAISE vsaida_erro;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foi possível atualizar tabela de lançamentos de eventos de ponto! erro: '||SQLERRM(SQLCODE);
          RAISE vsaida_erro;
      END;
      --
      BEGIN
        --
        --dbms_output.put_line('prc_atualiza_req: Insere_Abono #04');

        UPDATE REQ_LANCAMENTOS_PONTO
           SET cod_sit_req     = '2', dt_sit_req = SYSDATE --requisição concluída
         WHERE cod_req    = psolicitacao;
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foram encontrados dados na requisição de lancamentos de envetos de ponto para replicar para a tabela de lancamentos de ponto!';
          RAISE vsaida_erro;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foi possível atualizar tabela de Tratamento de Batimentos! erro: '||SQLERRM(SQLCODE);
          RAISE vsaida_erro;
      END;
      --
      EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Prc_Atualiza_Req.Insere_Lanc_Ponto - Erro: '||SQLERRM;
      END Insere_Lanc_Ponto;
      --
      --
      BEGIN
      --
      --
      OPEN  req;
      FETCH req INTO v_req;
      CLOSE req;
      --
      pflg_retorno := 'S';
      --
      BEGIN
          --
          vexiste := 'N';
          --
            SELECT DISTINCT 'S'
            INTO   vexiste
            FROM   aprova_abono
            WHERE  COD_EMPRESA     = pcod_empresa
            AND    COD_SOLICITACAO = psolicitacao
            AND    status_aprov    IN ('P','R');
            --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          --
              Insere_Lanc_Ponto(psolicitacao,
                        pflg_retorno,
                        pmsg_retorno);
          --
          IF NVL(pflg_retorno,'S') <> 'S' THEN
            RAISE vsaida_erro;
          END IF;
          --
              UPDATE req_lancamentos_Ponto
              SET    cod_sit_req = '2', dt_sit_req = SYSDATE
              WHERE  cod_req = psolicitacao;
          --
      END;
      --
      IF NVL(vexiste,'N') = 'S' THEN
        --
        FOR x IN (SELECT usuario
                  FROM   APROVA_REQ_LANC_PONTO
                  WHERE  COD_EMPRESA     = pcod_empresa
                  AND    cod_req = psolicitacao
                  AND    status_aprov    = 'R'
                  ORDER BY dt_atualizacao DESC) LOOP
          --
          UPDATE req_lancamentos_ponto
          SET    cod_sit_req  = 4
                ,usuario         = x.usuario
                ,dt_atualizacao  = SYSDATE
          WHERE  cod_req = psolicitacao;
          --
        END LOOP;
        --
      END IF;
      --
    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Pe_Abono.Trata_Lanc_Ponto - Erro: '||SQLERRM;
    END Trata_Lanc_Ponto;
*/

--++03012020
    PROCEDURE Trata_Escala (pcod_empresa  requisicao_ferias.cod_empresa%TYPE,
                            psolicitacao  requisicao_ferias.cod_solicitacao%TYPE,
                            pmatricula    requisicao_ferias.matricula%TYPE,
                            pflg_retorno  IN OUT VARCHAR2,
                            pmsg_retorno  IN OUT VARCHAR2) IS
      --
      cursor c1 is
      select cod_sit_req sit_requisicao
        from req_pe_escalas_excecoes
       where cod_empresa = pcod_empresa
         and cod_req = psolicitacao;

      v_c1 c1%rowtype;
      --
      PROCEDURE Insere_Escala(pcod_empresa  requisicao_ferias.cod_empresa%TYPE,
                              psolicitacao  requisicao_ferias.cod_solicitacao%TYPE,
                              pmatricula    requisicao_ferias.matricula%TYPE,
                              pflg_retorno  IN OUT VARCHAR2,
                              pmsg_retorno  IN OUT VARCHAR2) IS
      --
      CURSOR req_escala IS
        SELECT *
          FROM req_pe_escalas_excecoes
         WHERE cod_req = psolicitacao
           AND cod_empresa     = pcod_empresa
           AND matricula       = pmatricula;
      --
      v_req_escala req_escala%ROWTYPE;
      --
      cursor c2(p_cod_escala number) is
       select inicio, fim
       from   pe_escalas
       where  cod_escala = p_cod_escala;
      v_c2 c2%rowtype;

      cursor c3 is
      select dt_admissao
      from   informacoes_funcionais
      where  cod_empresa = pcod_empresa
      and    matricula   = pmatricula;
      v_c3 c3%rowtype;

      cursor c5 (p_excecao varchar2) is
       select max(fim) fim
       from   pe_escalas_excecoes
       where  matricula    = pmatricula
       and    cod_empresa  = pcod_empresa
       and    p_excecao = 'N' and excecao = 'N';
       v_c5 c5%rowtype;

       v_inicio date;
       v_fim    date;

       va_dt_local_trab DATE;
       --vdt_vigencia     date ;
       vcod_localizacao informacoes_funcionais.cod_localizacao%type;
       vdc_matricula    informacoes_funcionais.dc_matricula%type;
       va_descricao     local_trab.descricao%TYPE;
       v_cod_agente     aposentadoria_agente.cod_agente%TYPE;
       vrowid           varchar2(30);
       --vcount           number := 0;
      --
       vjornada_plantao pe_jornadas.jornada_plantao%type;
       vcod_plantao     pe_jornadas.cod_plantao%type;
       vqtd_real        pe_limites_plantoes.qtd_plantao%type;
       vexiste          varchar2(1) := 'N';
       vqtd_prevista    pe_limites_plantoes.qtd_plantao_disp%type;
       vqtd             pe_limites_plantoes.qtd_plantao_disp%type;

      BEGIN
      --
      --dbms_output.put_line('Abrindo cursor: '||psolicitacao||', '||pcod_empresa||', '||pmatricula);
      OPEN  req_escala;
      FETCH req_escala INTO v_req_escala;
      IF req_escala%FOUND THEN
        dbms_output.put_line('Achou cursor');
      ELSE
        dbms_output.put_line('Não achou cursor:' );
      END IF;
      CLOSE req_escala;
      --------------------------------------------------------------------------------------------------------------------------------

      begin
         select jornada_plantao,cod_plantao
          into vjornada_plantao, vcod_plantao
         from pe_jornadas
         where cod_jornada   = v_req_escala.cod_jornada;
      Exception
       when no_Data_found then
         pflg_retorno := 'N';
         pmsg_retorno := 'Jornada não encontrada.';
         RAISE vsaida_erro;
      end;

      begin
       select distinct 'S'
        into vExiste
        from pe_escalas_excecoes
       where cod_empresa = pcod_empresa
        and matricula = pmatricula
        and cod_escala = v_req_escala.cod_escala
        and v_req_escala.inicio   between inicio and fim
        and nvl(v_req_escala.escala_plantao,'N') = nvl(escala_plantao,'N');
      Exception
       when no_data_found then
        vexiste := 'N';
      end;

       begin
          select qtd_plantao_disp, qtd_plantao
           into vqtd_prevista, vqtd_real
           from pe_limites_plantoes
          where cod_plantao = vcod_plantao;
       Exception
        When no_data_found then
          --vqtd_prevista := 0;
          vqtd_real     := 0;
      End;

      IF v_req_escala.excecao = 'N' THEN

         open c5(v_req_escala.excecao);
          fetch c5 into v_c5;
          close c5;

          open  c2(v_req_escala.cod_escala);
          fetch c2 into v_c2;
          close c2;

   if v_c5.fim is not null then
     if v_req_escala.inicio > v_c5.fim then
        v_inicio := v_c5.fim + 1;
        v_fim    := v_c2.fim;
     end if;
   else
     open  c3;
     fetch c3 into v_c3;
     close c3;

     if v_c3.dt_admissao >= v_c2.inicio and v_c3.dt_admissao <= v_c2.fim then
        if v_inicio is null then
      v_inicio := v_c3.dt_admissao;
        end if;
        if v_fim is null then
      v_fim    := v_c2.fim;
        end if;
     else
        if v_inicio is null then
      v_inicio := v_c2.inicio;
        end if;
        if v_fim is null then
      v_fim    := v_c2.fim;
        end if;
     end if;

   end if;


   BEGIN
     --
     SELECT dt_local_trab, dc_matricula,  cod_localizacao
       INTO va_dt_local_trab, vdc_matricula, vcod_localizacao
       FROM informacoes_funcionais
      WHERE cod_empresa = pcod_empresa
        AND matricula = pmatricula;
     --
    Exception
     When no_data_found then
    pflg_retorno := 'N';
    pmsg_retorno := 'Insere_escala Informacoes_funcionais - Erro: '||SQLERRM;
    RAISE vsaida_erro;
          --
   END;
--
-- Andre 07-06-2024 - Evita validar local quando nao teve troca - Inicio - Chamado 33033
if v_req_escala.cod_local_trab is not null then
  begin
     --
     SELECT descricao,cod_agente
       INTO va_descricao,v_cod_agente
       FROM local_trab
      WHERE cod_local_trab = v_req_escala.cod_local_trab;
    Exception
     When no_data_found then
    pflg_retorno := 'N';
    If v_cod_agente is null then
        pmsg_retorno := 'Código do agente não cadastrado.';
          else
       pmsg_retorno := 'Insere_escala local_trab - Erro: '||SQLERRM;
    end if;
    RAISE vsaida_erro;
   end;

   begin

     SELECT rowid into vrowid from historico_cadastral_cad cad1
     where cad1.cod_empresa = pcod_empresa
      and cad1.matricula  = pmatricula
      and cad1.cod_fato   =  5
      and cad1.mot_alt   is not null
      and cad1.dt_vigencia = v_req_escala.inicio
      and cad1.dt_vigencia_fim  is null ;

     UPDATE historico_cadastral_cad
      SET dt_vigencia_fim =  v_req_escala.fim,
     usuario        =  v_req_escala.usuario,
     dt_atualizacao =  sysdate
      where rowid = vrowid;
    exception
     when no_data_found then
      null;
     when others then
    pflg_retorno := 'N';
    pmsg_retorno := 'Insere_escala historico_cadastral_cad - Erro: '||SQLERRM;
    RAISE vsaida_erro;
    end;

    begin
      INSERT INTO historico_cadastral_cad
      (cod_empresa,
       matricula,
       dc_matricula,
       cod_fato,
       cod_valor_fato,
       valor_fato,
       dt_vigencia,
       dt_atualizacao,
       usuario,
       mot_alt)
      VALUES
      (pcod_empresa,
       pmatricula,
       vdc_matricula,
       5,-- fato
       v_req_escala.cod_local_trab,
       SUBSTR(va_descricao,1,70),
       v_inicio,
       SYSDATE,
       v_req_escala.usuario,
       nvl(v_req_escala.mot_alt,'107')
       ); -- motivo alteração
    exception
     when others then
    pflg_retorno := 'N';
    pmsg_retorno := 'Insere_escala historico_cadastral_cad - Erro: '||SQLERRM;
    RAISE vsaida_erro;
    end;

    begin
     UPDATE informacoes_funcionais
      SET cod_localizacao =  v_req_escala.cod_local_trab,
       mot_alt_local_trab =  nvl(v_req_escala.mot_alt,'107'),
       dt_local_trab      =  v_req_escala.inicio,
       usuario            =  v_req_escala.usuario,
       dt_atualizacao     =  sysdate,
       cod_agente         =  v_cod_agente
    WHERE cod_empresa = pcod_empresa
    AND matricula     = pmatricula;
       exception
    when others then
      pflg_retorno := 'N';
      pmsg_retorno := 'Insere_escala historico_cadastral_cad - Erro: '||SQLERRM;
      RAISE vsaida_erro;
   end;
end if;
-- Andre 07-06-2024 - Evita validar local quando nao teve troca - Fim - Chamado 33033
--
   begin
    select rowid into vrowid
    from pe_escalas_excecoes
    where cod_empresa = pcod_empresa
    and matricula = pmatricula
    and v_req_escala.inicio between inicio and fim
    and v_req_escala.fim  between inicio and fim
    and nvl(v_req_escala.escala_plantao,'N') = nvl(escala_plantao,'N');

   update pe_escalas_excecoes set fim = v_req_escala.inicio-1
   where rowid = vrowid;
  Exception
   when no_data_found then
     null;
  End;

     else  -- excecao = S
         if vexiste = 'S' and vjornada_plantao = 'S' then
            pflg_retorno := 'N';
            pmsg_retorno := 'Já existe escala de plantão para este periodo.';
            RAISE vsaida_erro;
         end if;

         If vjornada_plantao = 'S' then
            begin
             select count(1)
             into vqtd
             from pe_escalas_excecoes ee
                 ,pe_jornadas  j
             where j.cod_jornada = v_req_escala.cod_jornada
              and ee.matricula = pmatricula
              and ee.cod_empresa = pcod_empresa
              and j.jornada_plantao = 'S'
              and v_req_escala.inicio between ee.inicio and ee.fim
              and v_req_escala.fim   between ee.inicio and ee.fim
              and nvl(v_req_escala.escala_plantao,'N') = nvl(escala_plantao,'N');
            End;

         End if;

         If vqtd_real = vqtd then
            pflg_retorno := 'N';
            pmsg_retorno := 'Colaborador já possui '||vqtd||' plantões cadastrados.';
            RAISE vsaida_erro;
         End If;

          v_inicio :=  v_req_escala.inicio;
          v_fim    :=  v_req_escala.fim;

     end if;

     BEGIN
  insert into pe_escalas_excecoes(cod_escala,
          matricula,
          inicio,
          fim,
          cod_empresa,
          usuario,
          dt_atualizacao,
          excecao,
          cod_jornada,
          cod_local_trab,
          mot_alt,
          escala_plantao,
          ccusto_plantao)
         values(v_req_escala.cod_escala,
          pmatricula,
          v_inicio,
          v_fim,
          pcod_empresa,
          v_req_escala.usuario,
          sysdate,
          v_req_escala.excecao,
          v_req_escala.cod_jornada,
          v_req_escala.cod_local_trab,
          v_req_escala.mot_alt,
          v_req_escala.escala_plantao,
          v_req_escala.ccusto_plantao);
       EXCEPTION
  WHEN OTHERS THEN
    pflg_retorno := 'N';
    pmsg_retorno := 'Não foi possível atualizar tabela pe_escalas_excecoes! erro: '||SQLERRM(SQLCODE);
    RAISE vsaida_erro;
       END;

      --------------------------------------------------------------------------------------------------------------------------------
      BEGIN
        --
        UPDATE req_pe_escalas_excecoes
           SET cod_sit_req     = '2', --requisição concluída
               dt_sit_req = sysdate
         WHERE cod_req    = psolicitacao;
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foram encontrados dados na requisição de escalas para replicar para a tabela de escalas!';
          RAISE vsaida_erro;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foi possível atualizar tabela de escalas! erro: '||SQLERRM(SQLCODE);
          RAISE vsaida_erro;
      END;
      --
      EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Insere_Escala - Erro: '||SQLERRM;
      END Insere_Escala;
      --
    BEGIN
      --
      pflg_retorno := 'S';
      --

      BEGIN
          --
          vexiste := 'N';
          --
            SELECT DISTINCT 'S'
            INTO   vexiste
            FROM   aprova_escala
            WHERE  cod_req = psolicitacao
            AND    status_aprov    IN ('P','R'); -- Cibele Inserido verificação de Reprovação 06/06/2018
            --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          --
          open c1;
          fetch c1 into v_c1;
          close c1;

          if v_c1.sit_requisicao in (1,5) then
          --
              insere_escala(pcod_empresa,
                        psolicitacao,
                        pmatricula,
                        pflg_retorno,
                        pmsg_retorno);
          --
          end if;
          --
          IF NVL(pflg_retorno,'S') <> 'S' THEN
            RAISE vsaida_erro;
          END IF;
          --

          --
         if v_c1.sit_requisicao in (1,5) then

              UPDATE req_pe_escalas_excecoes
              SET    cod_sit_req = '2', --requisição concluída
                     dt_sit_req = sysdate
              WHERE  cod_req = psolicitacao;

         end if;
          --
      END;
      --
      IF NVL(vexiste,'N') = 'S' THEN
        --
        FOR x IN (SELECT usuario
                  FROM   aprova_escala
                  WHERE  COD_EMPRESA     = pcod_empresa
                  AND    COD_REQ = psolicitacao
                  AND    status_aprov    = 'R'
                  ORDER BY dt_atualizacao DESC) LOOP
          --
          UPDATE req_pe_escalas_excecoes
          SET    cod_sit_req  = 4
                ,usuario         = x.usuario
                ,dt_atualizacao  = SYSDATE
                ,dt_sit_req = sysdate
          WHERE  cod_req = psolicitacao;
          --
        END LOOP;
        --
      END IF;
      --
    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Trata_Escala - Erro: '||SQLERRM;
    END Trata_Escala;

--++
    PROCEDURE Trata_Exame (psolicitacao  requisicao_ferias.cod_solicitacao%TYPE,
                            pflg_retorno  IN OUT VARCHAR2,
                            pmsg_retorno  IN OUT VARCHAR2) IS
      --
      cursor c1 is
      select cod_sit_req sit_requisicao
        from solicitacao_exames
       where cod_req = psolicitacao;

      v_c1 c1%rowtype;
      --
      /*
      PROCEDURE Insere_Exame(pcod_empresa  requisicao_ferias.cod_empresa%TYPE,
                              psolicitacao  requisicao_ferias.cod_solicitacao%TYPE,
                              pmatricula    requisicao_ferias.matricula%TYPE,
                              pflg_retorno  IN OUT VARCHAR2,
                              pmsg_retorno  IN OUT VARCHAR2) IS
      --

      --
      BEGIN
  null;
      --
      EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Solicitacao_Exame -> Prc_atualiza_req: Insere_Exame - Erro: '||SQLERRM;
      END Insere_Exame;
      */
      --
    BEGIN
      --
      pflg_retorno := 'S';
      --
      open c1;
      fetch c1 into v_c1;
      close c1;
      --
      IF v_c1.sit_requisicao = 1 THEN -- Essa procedure só irá tratar a aprovação ou reprovação deste tipo de requisição
                                      -- A conclusão será feita por uma trigger (se fizer por aqui irá dar erro de "mutante") disparada quando houver INSERT na tabela MV_RESULTADO_EXAMES,
                                      -- independente da requisição estar ou não totalmente aprovada (Adriana)
        --
        BEGIN
          vexiste := 'N';
          SELECT DISTINCT 'S'
          INTO   vexiste
          FROM   aprova_exames
          WHERE  COD_REQ = psolicitacao
          AND    status_aprov = 'R';
        exception
            when no_data_found then
              vexiste := 'N';
        END;
        --
        IF NVL(VEXISTE,'N') = 'S' THEN -- Se encontrou reprovação por parte de algum aprovador
          --
          BEGIN
            UPDATE solicitacao_exames
               SET cod_sit_req     = 4, --requisição concluída
                   DT_SIT_REQ = sysdate
                   ,USUARIO = SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30)
                   ,DT_ATUALIZACAO = SYSDATE
             WHERE cod_req    = psolicitacao;--daniel tasso

             --
          EXCEPTION
            WHEN OTHERS THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'Não foi possível atualizar status para REPROVADA! erro: '||SQLERRM(SQLCODE);
              RAISE vsaida_erro;
          END;
          --
        ELSE -- Se não vai reprovar, então verifica se todos aprovaram para mudar o status da req para APROVADA
          --
          BEGIN
            vexiste := 'N';
            SELECT DISTINCT 'S'
            INTO   vexiste
            FROM   aprova_exames
            WHERE  COD_REQ = psolicitacao
            AND    status_aprov = 'P';
          exception
              when no_data_found then
                vexiste := 'N';
          END;
          --
          IF NVL(VEXISTE,'N') = 'N' THEN -- Se não foi reprovada e não há pendências de aprovação, então significa que todos aprovaram
            --
            BEGIN
              --
              UPDATE solicitacao_exames
                 SET cod_sit_req     = 5, --requisição concluída
                     DT_SIT_REQ = sysdate
                     ,USUARIO = SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30)
                     ,DT_ATUALIZACAO = SYSDATE
               WHERE cod_req    = psolicitacao;
               --
            EXCEPTION
              WHEN OTHERS THEN
                pflg_retorno := 'N';
                pmsg_retorno := 'Não foi possível atualizar status para APROVADA! erro: '||SQLERRM(SQLCODE);
                RAISE vsaida_erro;
            END;
            --
          END IF;
          --
        END IF;
        --
      END IF;
      --
    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Solicitacao_Exames -> prc_atualiza_req -> Trata_Exame - Erro: '||SQLERRM;
    END Trata_Exame;

  PROCEDURE Trata_PPP(psolicitacao solicitacao_ppp.cod_req%TYPE,
                    pflg_retorno IN OUT VARCHAR2,
                    pmsg_retorno IN OUT VARCHAR2) IS
    --
    PROCEDURE Finaliza_PPP(psolicitacao solicitacao_ppp.cod_req%TYPE,
                         pflg_retorno IN OUT VARCHAR2,
                         pmsg_retorno IN OUT VARCHAR2) IS
      --
      CURSOR req_PPP IS
        SELECT * FROM solicitacao_ppp WHERE cod_sit_req = 1 and cod_req = psolicitacao;
      --
      v_req_ppp req_ppp%ROWTYPE;
      --
    BEGIN
      --
      --dbms_output.put_line('prc_atualiza_req: Finaliza_PPP #01');

      OPEN req_ppp;
      FETCH req_ppp
        INTO v_req_ppp;
      CLOSE req_ppp;
      --
      BEGIN
        --
        --dbms_output.put_line('prc_atualiza_req: Finaliza_ppp #04');

        UPDATE solicitacao_ppp
           SET cod_sit_req    = '2',
               dt_sit_req     = SYSDATE --requisição concluída
              ,
               usuario        = SUBSTR(USUARIO.BUSCA_USER ||
                                       'Prc_Atualiza_Req',
                                       1,
                                       30),
               dt_atualizacao = sysdate
         WHERE cod_req = psolicitacao;
        --
      EXCEPTION
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Finaliza_PPP - Não foi possível atualizar o status da Requisição de PPP/Laudos erro: ' ||
                          SQLERRM(SQLCODE);
          RAISE vsaida_erro;
      END;
      --
    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Finaliza_PPP - Erro: ' ||
                        SQLERRM;
    END Finaliza_PPP;
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    BEGIN
      --
      vexiste := 'N';
      --
      SELECT DISTINCT 'S'
        INTO vexiste
        FROM aprova_solicitacao_ppp
       WHERE cod_req = psolicitacao
         AND status_aprov in ('P','R');
      --
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        --
        --dbms_output.put_line('prc_atualiza_req: Finaliza_ppp #05');

        Finaliza_PPP(psolicitacao, pflg_retorno, pmsg_retorno);
        --
        IF NVL(pflg_retorno, 'S') <> 'S' THEN
          RAISE vsaida_erro;
        END IF;
        --
        --
        --dbms_output.put_line('prc_atualiza_req: Finaliza_ppp #06');
        --
    END;
    --
    IF NVL(vexiste, 'N') = 'S' THEN
      --
      FOR x IN (SELECT usuario
                  FROM aprova_solicitacao_ppp
                 WHERE COD_EMPRESA = pcod_empresa
                   AND cod_req = psolicitacao
                   AND status_aprov = 'R'
                 ORDER BY dt_atualizacao DESC) LOOP
        --
        UPDATE solicitacao_ppp
           SET cod_sit_req    = 4,
               dt_sit_req     = SYSDATE,
               usuario        = SUBSTR(x.usuario || 'Prc_Atualiza_Req', 1, 30),
               dt_atualizacao = SYSDATE
         WHERE cod_req = psolicitacao;
        --
      END LOOP;
      --
    END IF;
    --
    --dbms_output.put_line('prc_atualiza_req: Trata_PPP #07');

  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Prc_Atualiza_Req.Trata_PPP - Erro: ' || SQLERRM;
  END Trata_PPP;

    -- ===================================================
    PROCEDURE Trata_Atestado (pcod_empresa  requisicao_ferias.cod_empresa%TYPE,
                            psolicitacao  requisicao_ferias.cod_solicitacao%TYPE,
                            --pmatricula    requisicao_ferias.matricula%TYPE,
                            pflg_retorno  IN OUT VARCHAR2,
                            pmsg_retorno  IN OUT VARCHAR2) IS
      --
      cursor c1 is
      select cod_sit_req sit_requisicao, USUARIO, COD_EMPRESA, MATRICULA
        from req_atestado_funcionario
       where cod_req = psolicitacao;

      v_c1 c1%rowtype;
      p_operador_aprova_atestado varchar2(1);
      p_painel                   varchar2(2);
      --
      PROCEDURE Insere_Atestado(--pcod_empresa  requisicao_ferias.cod_empresa%TYPE,
                              psolicitacao  requisicao_ferias.cod_solicitacao%TYPE,
                              --pmatricula    requisicao_ferias.matricula%TYPE,
                              pflg_retorno  IN OUT VARCHAR2,
                              pmsg_retorno  IN OUT VARCHAR2) IS
      --
      CURSOR req_atestado IS
        SELECT ra.*
          FROM req_atestado_funcionario ra
         WHERE ra.cod_req = psolicitacao;
      --
      v_req_atestado req_atestado%ROWTYPE;
      --
      CURSOR c_mat(p_codempresa in INFORMACOES_FUNCIONAIS.Cod_Empresa%type,
                     p_matricula in INFORMACOES_FUNCIONAIS.Matricula%type ) is
      SELECT * FROM INFORMACOES_FUNCIONAIS
      WHERE COD_EMPRESA = p_codempresa
      AND MATRICULA = p_matricula;

      v_mat c_mat%rowtype;
      v_erro        varchar2(4000);
      BEGIN
      --
      --dbms_output.put_line('Abrindo cursor: '||psolicitacao||', '||pcod_empresa||', '||pmatricula);
      OPEN  req_atestado;
      FETCH req_atestado INTO v_req_atestado;
      CLOSE req_atestado;
      --
      BEGIN
        --
        --dbms_output.put_line('inserindo atestado');

        insert into atestado_funcionario
        (cod_empresa,
          matricula,
          dc_matricula,
          cod_atestado_medico,
          dt_atestado_medico,
          cod_entidade,
          tipo_entidade,
          cod_prest_serv,
          tipo_prest_serv,
          dt_inicio_afastamento,
          hora_inicio_afastamento,
          hora_termino_afastamento,
          usuario,
          dt_atualizacao,
          qtde_horas_abonadas,
          cod_motivo,
          desc_motivo,
          cod_doenca,
          ocupacional,
          observacao,
          cid_familia,
          dt_alt_prog,
          dt_pericia,
          origem_med,
          qtde_dias_afastamento,
          cod_motivo_es,
          tipo_acidente_es,
          crm_prest_serv_resp,
          uf_crm_prest_resp,
          infomesmomtv,
          cod_justificativa,
          dt_termino_afastamento
          )
          values
        (v_req_atestado.cod_empresa,
          v_req_atestado.matricula,
          v_req_atestado.dc_matricula,
          v_req_atestado.cod_atestado_medico,
          v_req_atestado.dt_atestado_medico,
          v_req_atestado.cod_entidade,
          v_req_atestado.tipo_entidade,
          v_req_atestado.cod_prest_serv,
          v_req_atestado.tipo_prest_serv,
          v_req_atestado.dt_inicio_afastamento,
          v_req_atestado.hora_inicio_afastamento,
          v_req_atestado.hora_termino_afastamento,
          usuario.busca_user,
          sysdate,
          v_req_atestado.qtde_horas_abonadas,
          v_req_atestado.cod_motivo,
          v_req_atestado.desc_motivo,
          v_req_atestado.cod_doenca,
          v_req_atestado.ocupacional,
          v_req_atestado.observacao,
          v_req_atestado.cid_familia,
          v_req_atestado.dt_alt_prog,
          v_req_atestado.dt_pericia,
          v_req_atestado.origem_med,
          v_req_atestado.qtde_dias_afastamento,
          v_req_atestado.cod_motivo_es,
          v_req_atestado.tipo_acidente_es,
          v_req_atestado.crm_prest_serv_resp,
          v_req_atestado.uf_crm_prest_resp,
          v_req_atestado.infomesmomtv,
          v_req_atestado.cod_justificativa,
          v_req_atestado.dt_termino_afastamento);

            pkg_mt_cad_atest_medico.TRATA_LANCTO_ATEST_HISTCAD(v_req_atestado.COD_EMPRESA
                                                        ,v_req_atestado.MATRICULA
                                                        ,v_req_atestado.DT_INICIO_AFASTAMENTO
                                                        ,pflg_retorno
                                                        ,pmsg_retorno
                                                        ,usuario.busca_user);

        -- Informacoes funcionais
        open c_mat(v_req_atestado.cod_empresa,
                     v_req_atestado.matricula);
        fetch c_mat into v_mat;
        close c_mat;

        -- Apura
        PKG_APURACAO_PONTO.APURA(p_empresa         => v_req_atestado.cod_empresa
                                 ,p_filial_ini     => v_mat.filial
                                 ,p_filial_fin     => v_mat.filial
                                 ,p_ccusto_ini     => v_mat.cod_ccusto
                                 ,p_ccusto_fin     => v_mat.cod_ccusto
                                 ,p_local_ini      => v_mat.cod_localizacao
                                 ,p_local_fin      => v_mat.cod_localizacao
                                 ,p_grupo_ini      => NULL
                                 ,p_grupo_fin      => NULL
                                 ,p_matricula_ini  => v_req_atestado.matricula
                                 ,p_matricula_fin  => v_req_atestado.matricula
                                 ,p_data_ini       => v_req_atestado.dt_inicio_afastamento
                                 ,p_data_fin       => v_req_atestado.dt_termino_afastamento
                                 ,p_id_apuracao    => NULL
                                 ,p_erro           => v_erro
                                 ,P_USUARIO        => v_req_atestado.usuario
                                 ,P_DT_ATUALIZACAO => SYSDATE
                                 ,p_manter_hist    => null
                                 ,P_COD_REQ        => v_req_atestado.Cod_Req
                                 ,P_APURA          => null
                                 );

        --
      EXCEPTION
        WHEN VSAIDA_ERRO THEN
          RAISE VSAIDA_ERRO;
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foram encontrados dados na requisição de atestados para replicar para a tabela de atestados!';
          RAISE vsaida_erro;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foi possível inserir dados na tabela de atestados! erro: '||SQLERRM(SQLCODE);
          RAISE vsaida_erro;
      END;
      --
      BEGIN
        --
        UPDATE req_atestado_funcionario
           SET cod_sit_req     = '2', --requisição concluída
               DT_SIT_REQ = sysdate,
               USUARIO            = SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30),
               DT_ATUALIZACAO     = SYSDATE
         WHERE cod_req    = psolicitacao;
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foram encontrados dados na requisição de atestados para replicar para a tabela de atestado!';
          RAISE vsaida_erro;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foi possível inserir na tabela de atestado! erro: '||SQLERRM(SQLCODE);
          RAISE vsaida_erro;
      END;
      --
      --
      EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Req_Atestado.Insere_Atestado - Erro: '||SQLERRM;
      END Insere_Atestado;
      --
    BEGIN
      --
      pflg_retorno := 'S';
      --
      BEGIN
          --
          vexiste := 'N';
          --
          SELECT DISTINCT 'S'
          INTO   vexiste
          FROM   aprova_atestado
          WHERE  COD_SOLICITACAO = psolicitacao
          AND    status_aprov    IN ('P','R'); -- Cibele Inserido verificação de Reprovação 06/06/2018
          --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          --
          open c1;
          fetch c1 into v_c1;
          close c1;
          --
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
            select nvl(ind_gestor_subccusto_atestado, 'N')
            into  p_operador_aprova_atestado
            from parametros_recursos_humanos
            where cod_empresa = pcod_empresa;
         exception
         when others then
            p_operador_aprova_atestado    := 'N';
         end;

         if (( p_painel = 'PG' and p_operador_aprova_atestado = 'S')
            or p_painel = 'PO' ) then
         --
--          RAISE_APPLICATION_ERROR(-20123,'ATENÇÃO: Prc_Atualiza_Req V_C1.SIT_REQUISICAO: '||V_C1.SIT_REQUISICAO);
          if v_c1.sit_requisicao in (1,5) then
          --
              insere_atestado(--pcod_empresa,
                        psolicitacao,
                        --pmatricula,
                        pflg_retorno,
                        pmsg_retorno);
            --
            IF NVL(pflg_retorno,'S') <> 'S' THEN
              RAISE vsaida_erro;
            END IF;
            --

            --
            --coloquei o IF agora
            if vexiste = 'N' then
              UPDATE req_atestado_funcionario
              SET    cod_sit_req = '2', --requisição concluída
                     DT_SIT_REQ = sysdate,
                     USUARIO = SUBSTR(USUARIO.BUSCA_USER||'Prc_Atualiza_Req',1,30),
                     DT_ATUALIZACAO = SYSDATE
              WHERE  cod_req = psolicitacao;
            end if;
              COMMIT;
           end if;
          --
         end if;
      END;
      --
      IF NVL(vexiste,'N') = 'S' THEN
        --
        FOR x IN (SELECT usuario
                  FROM   aprova_atestado
                  WHERE  COD_EMPRESA     = pcod_empresa
                  AND    COD_SOLICITACAO = psolicitacao
                  AND    status_aprov    = 'R'
                  ORDER BY dt_atualizacao DESC) LOOP
          --
          UPDATE req_atestado_funcionario
          SET    cod_sit_req  = 4
                ,usuario         = SUBSTR(x.usuario||'Prc_Atualiza_Req',1,30)
                ,dt_atualizacao  = SYSDATE
                ,DT_SIT_REQ = sysdate
          WHERE  cod_req = psolicitacao;
          --
        END LOOP;
        --
      END IF;
      --
    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Req_Atestado.Trata_Atestado-Erro: '||SQLERRM;

   --dbms_output.put_line('FIM Trata_Atestado');
  END Trata_Atestado;


  PROCEDURE Trata_Cat(pcod_empresa REQ_ANALISE_ACIDENTE.cod_empresa%TYPE,
                      psolicitacao REQ_ANALISE_ACIDENTE.cod_req%TYPE,
                      --pmatricula REQ_ANALISE_ACIDENTE.matricula%TYPE,
                      pflg_retorno IN OUT VARCHAR2,
                      pmsg_retorno IN OUT VARCHAR2) IS
    --
    vgera_incidente_automatico varchar2(1) := 'N';
    vexiste_incidente varchar2(1) := 'N';
    --
    cursor c1 is
      select cod_sit_req sit_requisicao, USUARIO, COD_EMPRESA, MATRICULA, DT_ACIDENTE
        from REQ_ANALISE_ACIDENTE
       where cod_req = psolicitacao;
    v_c1 c1%rowtype;
    --
    PROCEDURE Insere_Cat( --pcod_empresa REQ_ANALISE_ACIDENTE.cod_empresa%TYPE,
                         psolicitacao REQ_ANALISE_ACIDENTE.cod_req%TYPE,
                         --pmatricula REQ_ANALISE_ACIDENTE.matricula%TYPE,
                         pflg_retorno IN OUT VARCHAR2,
                         pmsg_retorno IN OUT VARCHAR2) IS
      --

      --
      CURSOR req_cat IS
        SELECT ra.*
              , f.cgc||ltrim(to_char(f.dc_cgc,'00')) cnpj_filial
          FROM REQ_ANALISE_ACIDENTE ra
              ,filiais_cad f
         WHERE f.cod_filial  = ra.cod_filial
         and   f.cod_empresa = ra.cod_empresa
         and   ra.cod_req    = psolicitacao;
      --
      v_req_cat req_cat%ROWTYPE;
      --
      cursor c_cat(v_emp number) is
        select ltrim(to_char(nvl(max(to_number(cod_analise_acidente)), 0) + 1)) cod
          from ANALISE_ACIDENTE
         where cod_empresa = v_emp;

      v_cat c_cat%rowtype;

      V_COD_ANALISE_ACIDENTE NUMBER;

    BEGIN
      pmsg_retorno := '1';
      if nvl(vexiste_incidente,'N') = 'N' then
      --
      --dbms_output.put_line('Abrindo cursor: '||psolicitacao||','||pcod_empresa||', '||pmatricula);
      OPEN req_cat;
      FETCH req_cat
        INTO v_req_cat;
      CLOSE req_cat;
      --
      BEGIN
        --
        open c_cat(v_req_cat.cod_empresa);
        fetch c_cat
          into v_cat;
        close c_cat;

        if v_cat.cod is not null then
          V_COD_ANALISE_ACIDENTE := nvl(v_cat.cod, 1);
        else
          V_COD_ANALISE_ACIDENTE := 1;
        end if;

        insert into analise_acidente
          (cod_empresa,
           cod_analise_acidente,
           dt_acidente,
           dt_analise,
           hor_acidente,
           cod_local_trab,
           ds_local,
           cod_empresa_tec_seguranca,
           matricula_tec_seguranca,
           dc_matricula_tec_seguranca,
           cod_empresa_eng_seguranca,
           matricula_eng_seguranca,
           dc_matricula_eng_seguranca,
           cod_acidente_tipo,
           usuario,
           dt_atualizacao,
           ind_trajeto,
           matricula_analizador,
           espec_local_acidente,
           local_acidente,
           uf_local_acidente,
           dt_emissao_cat,
           num_protocolo,
           cipeiro_area,
           status_cat,
           dt_ult_dia_trab,
           horas_trab,
           serv_med_atend,
           dt_atend,
           hora_atend,
           observacao,
           cnpj_local_acidente,
           qtde_dias_tratamento,
           afastamento_imediato,
           matricula,
           cod_analise_2,
           tipo_local_acidente,
           cod_acidente_tipo_es,
           num_local_acidente,
           cod_cnes,
           tp_registro_cat,
           cod_med_emit_cat,
           cep_local,
           complemento_cep_loc,
           bairro_acidente,
           cidade_acidente,
           endereco_acidente,
           cod_mun_ibge,
           pais_acidente,
           cod_tp_logr,
           complemento,
           cx_postal,
           tp_logr_codigo_es,
           cod_emp_acidente,
           cod_fil_acidente,
           class_acidente,
           cod_emp_solicitante,
           mat_solicitante,
           origem_med_cat,
           arq,
           nome_arq,
           mimetype_arq,
           charset_arq,
           arq_bo,
           nome_arq_bo,
           mimetype_arq_bo,
           charset_arq_bo,
           cod_req)
        values
          (v_req_cat.cod_empresa,
           V_COD_ANALISE_ACIDENTE, --v_req_cat.cod_analise_acidente,
           v_req_cat.dt_acidente,
           null, -- v_req_cat.dt_analise,
           v_req_cat.hor_acidente,
           v_req_cat.cod_local_trab,
           v_req_cat.ds_local,
           NULL, -- v_req_cat.cod_empresa_tec_seguranca,
           null, -- v_req_cat.matricula_tec_seguranca,
           null, -- v_req_cat.dc_matricula_tec_seguranca,
           null, -- v_req_cat.cod_empresa_eng_seguranca,
           null, -- v_req_cat.matricula_eng_seguranca,
           null, -- v_req_cat.dc_matricula_eng_seguranca,
           v_req_cat.cod_acidente_tipo,
           usuario.busca_user,
           sysdate,
           v_req_cat.ind_trajeto,
           null, -- v_req_cat.matricula_analizador,
           v_req_cat.espec_local_acidente,
           v_req_cat.local_acidente,
           v_req_cat.uf_local_acidente,
           null, -- v_req_cat.dt_emissao_cat,
           null, -- v_req_cat.num_protocolo,
           null, -- v_req_cat.cipeiro_area,
           v_req_cat.status_cat,
           v_req_cat.dt_ult_dia_trab,
           v_req_cat.horas_trab,
           v_req_cat.serv_med_atend,
           v_req_cat.dt_atend,
           v_req_cat.hora_atend,
           v_req_cat.observacao,
           v_req_cat.cnpj_local_acidente,--null, -- v_req_cat.cnpj_local_acidente,
           v_req_cat.qtde_dias_tratamento,
           v_req_cat.afastamento_imediato,
           v_req_cat.matricula,
           null, -- v_req_cat.cod_analise_2,
           v_req_cat.tipo_local_acidente,
           null, -- v_req_cat.cod_acidente_tipo_es,
           v_req_cat.num_local_acidente,
           null, -- v_req_cat.cod_cnes,
           v_req_cat.tp_registro_cat,
           v_req_cat.cod_med_emit_cat,
           v_req_cat.cep_local,
           v_req_cat.complemento_cep_loc,
           v_req_cat.bairro_acidente,
           v_req_cat.cidade_acidente,
           v_req_cat.endereco_acidente,
           v_req_cat.cod_mun_ibge,
           null, -- v_req_cat.pais_acidente,
           v_req_cat.cod_tp_logr,
           v_req_cat.complemento,
           null, -- v_req_cat.cx_postal,
           null, -- v_req_cat.tp_logr_codigo_es,
           v_req_cat.cod_emp_acidente,
           v_req_cat.cod_fil_acidente,
           null, -- v_req_cat.class_acidente,
           v_req_cat.cod_emp_solicitante,
           v_req_cat.mat_solicitante,
           v_req_cat.origem_med_cat,
           v_req_cat.arq,
           v_req_cat.nome_arq,
           v_req_cat.mimetype_arq,
           v_req_cat.charset_arq,
           v_req_cat.arq_bo,
           v_req_cat.nome_arq_bo,
           v_req_cat.mimetype_arq_bo,
           v_req_cat.charset_arq_bo,
           v_req_cat.cod_req);
        --

        for l_cat_parte in (select *
                              from req_analise_func_parte_lesada
                             where cod_req = psolicitacao) loop

          insert into ANALISE_FUNC_PARTE_LESADA
            (cod_empresa,
             cod_analise_acidente,
             matricula,
             dc_matricula,
             cod_parte_lesada,
             usuario,
             dt_atualizacao,
             descricao_parte_lesada,
             lateralidade,
             cod_natureza_lesao)
          values
            (l_cat_parte.cod_empresa,
             V_COD_ANALISE_ACIDENTE, --l_cat_parte.cod_analise_acidente,
             l_cat_parte.matricula,
             l_cat_parte.dc_matricula,
             l_cat_parte.cod_parte_lesada,
             usuario.busca_user,
             sysdate,
             l_cat_parte.descricao_parte_lesada,
             l_cat_parte.lateralidade,
             l_cat_parte.cod_natureza_lesao);

        end loop;

        for l_cat_func in (select *
                             from req_analise_func
                            where cod_req = psolicitacao) loop
          begin

            insert into ANALISE_FUNC
              (COD_EMPRESA,
               COD_ANALISE_ACIDENTE,
               MATRICULA,
               DC_MATRICULA,
               TIPO_ANALISE,
               COD_CCUSTO,
               IND_OBITO,
               DT_OBITO,
               COD_FATOR_PESSOAL,
               IND_ACIDENTE_ANTERIOR,
               COD_ATO_INSEGURO,
               IND_EXPERIENCIA_OPERACAO,
               COD_CONDICAO_INSEGURA,
               COD_AGENTE_LESAO,
               COD_FATOR_TRABALHO,
               IND_PROT_TIPO_ACIDENTE,
               IND_AFASTAMENTO,
               QUANTIDADE_DIAS_AFASTAMENTO,
               DT_RETORNO,
               CID,
               CODIGO,
               COD_EMPRESA_SUP_IMEDIATO,
               MATRICULA_SUP_IMEDIATO,
               DC_MATRICULA_SUP_IMEDIATO,
               DIAGNO_PROVAVEL,
               OBSERVACAO_CAT,
               IND_DEPTO_POLICIAL,
               NUM_BOLETIM_OCORR,
               DATA_BOLETIM_OCORR,
               usuario,
               dt_atualizacao)
            values
              (l_cat_func.COD_EMPRESA,
               V_COD_ANALISE_ACIDENTE, --v_req_cat.COD_ANALISE_ACIDENTE,
               l_cat_func.MATRICULA,
               l_cat_func.DC_MATRICULA,
               l_cat_func.TIPO_ANALISE,
               l_cat_func.COD_CCUSTO,
               l_cat_func.IND_OBITO,
               l_cat_func.DT_OBITO,
               l_cat_func.COD_FATOR_PESSOAL,
               l_cat_func.IND_ACIDENTE_ANTERIOR,
               l_cat_func.COD_ATO_INSEGURO,
               l_cat_func.IND_EXPERIENCIA_OPERACAO,
               l_cat_func.COD_CONDICAO_INSEGURA,
               l_cat_func.COD_AGENTE_LESAO,
               l_cat_func.COD_FATOR_TRABALHO,
               l_cat_func.IND_PROT_TIPO_ACIDENTE,
               l_cat_func.IND_AFASTAMENTO,
               l_cat_func.QUANTIDADE_DIAS_AFASTAMENTO,
               l_cat_func.DT_RETORNO,
               l_cat_func.CID,
               l_cat_func.CODIGO,
               l_cat_func.COD_EMPRESA_SUP_IMEDIATO,
               l_cat_func.MATRICULA_SUP_IMEDIATO,
               l_cat_func.DC_MATRICULA_SUP_IMEDIATO,
               l_cat_func.DIAGNO_PROVAVEL,
               l_cat_func.OBSERVACAO_CAT,
               l_cat_func.IND_DEPTO_POLICIAL,
               l_cat_func.NUM_BOLETIM_OCORR,
               l_cat_func.DATA_BOLETIM_OCORR,
               usuario.busca_user,
               sysdate);

            commit;

          exception
            when others then
              null;

          end;

        end loop;

        for l_cat_descr in (select *
                              from REQ_ANALISE_ACIDENTE_DESCRICAO
                             WHERE COD_REQ = PSOLICITACAO) LOOP
          insert into ANALISE_ACIDENTE_DESCRICAO
            (num_analise_acidente_descricao,
             cod_analise_acidente,
             texto,
             usuario,
             dt_atualizacao,
             cod_empresa,
             observacao)
          values
            (l_cat_descr.num_analise_acidente_descricao,
             V_COD_ANALISE_ACIDENTE, --l_cat_descr.cod_analise_acidente,
             l_cat_descr.texto,
             usuario.BUSCA_USER,
             SYSDATE,
             l_cat_descr.cod_empresa,
             l_cat_descr.observacao);
          COMMIT;
        END LOOP;

      EXCEPTION
        WHEN VSAIDA_ERRO THEN
          RAISE VSAIDA_ERRO;
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foram encontrados dados na requisição de CAT para replicar para a tabela de CAT!';
          RAISE vsaida_erro;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foi possível inserir dados na tabela de CAT! erro: ' ||
                          SQLERRM(SQLCODE);
          RAISE vsaida_erro;
      END;
      --
      BEGIN
        --
        vexiste := 'N';
        --
        SELECT DISTINCT 'S'
          INTO vexiste
          FROM aprova_cat
         WHERE COD_REQ = psolicitacao
           AND status_aprov IN ('P', 'R');
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          BEGIN
            --
            UPDATE REQ_ANALISE_ACIDENTE
               SET cod_sit_req    = '2', --requisição concluída
                   DT_SIT_REQ     = sysdate,
                   USUARIO        = SUBSTR(USUARIO.BUSCA_USER ||
                                           'Prc_Atualiza_Req',
                                           1,
                                           30),
                   DT_ATUALIZACAO = SYSDATE
             WHERE cod_req = psolicitacao;
            --
          EXCEPTION
            WHEN NO_DATA_FOUND THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'Não foram encontrados dados na requisição de CAT para replicar para a tabela de cat!';
              RAISE vsaida_erro;
            WHEN OTHERS THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'Não foi possível inserir na tabela de CAT! erro: ' ||
                              SQLERRM(SQLCODE);
              RAISE vsaida_erro;
          END;
        END;
      --
      end if;
      --
    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Prc_Atualiza_Req.Insere_Cat - Erro: ' || SQLERRM;
    END Insere_Cat;
    --
  BEGIN
    --
    pflg_retorno := 'S';
    -- Dados da requisicao
    open c1;
    fetch c1 into v_c1;
    close c1;
    -- verifica parâmetro de geração do incidente
    begin
      select nvl(gera_incidente_automatico,'N')
      into   vgera_incidente_automatico
      from   parametros_recursos_humanos
      where  cod_empresa = pcod_empresa;
    exception
      when others then
        vgera_incidente_automatico := 'N';
    end;
    --
    begin
      select distinct 'S'
      into   vexiste_incidente
      from   analise_acidente aa
      where  aa.dt_acidente = v_c1.dt_acidente
      and    aa.matricula   = v_c1.matricula
      and    aa.cod_empresa = v_c1.cod_empresa;
    exception
      when no_data_found then
        vexiste_incidente := 'N';
    end;
    --
    if vgera_incidente_automatico = 'S' and vexiste_incidente = 'N' and v_c1.sit_requisicao = 1 then
      insere_cat( --pcod_empresa,
                     psolicitacao,
                     --pmatricula,
                     pflg_retorno,
                     pmsg_retorno);
    end if;
    --
    BEGIN
      --
      vexiste := 'N';
      --
      SELECT DISTINCT 'S'
        INTO vexiste
        FROM aprova_cat
       WHERE COD_REQ = psolicitacao
         AND status_aprov IN ('P', 'R');
      --
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        --
        --dbms_output.put_line('#0A pflg_retorno'||pflg_retorno);

        if v_c1.sit_requisicao in (1, 4, 5) then
          --
          --dbms_output.put_line('#0B pflg_retorno'||pflg_retorno);

          insere_cat( --pcod_empresa,
                     psolicitacao,
                     --pmatricula,
                     pflg_retorno,
                     pmsg_retorno);

          --dbms_output.put_line('#00 pflg_retorno'||pflg_retorno);
          --
          IF NVL(pflg_retorno, 'S') <> 'S' THEN
            RAISE vsaida_erro;
          END IF;
          --
          UPDATE REQ_ANALISE_ACIDENTE
             SET cod_sit_req    = '2', --requisição concluída
                 DT_SIT_REQ     = sysdate,
                 USUARIO        = SUBSTR(USUARIO.BUSCA_USER ||
                                         'Prc_Atualiza_Req',
                                         1,
                                         30),
                 DT_ATUALIZACAO = SYSDATE
           WHERE cod_req = psolicitacao;
          COMMIT;
        end if;
        --
    END;
    --
    IF NVL(vexiste, 'N') = 'S' THEN
      --
      FOR x IN (SELECT usuario
                  FROM aprova_cat
                 WHERE COD_EMPRESA = pcod_empresa
                   AND COD_REQ = psolicitacao
                   AND status_aprov = 'R'
                 ORDER BY dt_atualizacao DESC) LOOP
        --
        UPDATE REQ_ANALISE_ACIDENTE
           SET cod_sit_req    = 4 -- Reprovada
              ,
               usuario        = SUBSTR(x.usuario || 'Prc_Atualiza_Req', 1, 30),
               dt_atualizacao = SYSDATE,
               DT_SIT_REQ     = sysdate
         WHERE cod_req = psolicitacao;
        --
      END LOOP;
      --
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Prc_Atualiza_Req.Trata_Cat-Erro: ' || SQLERRM;
  end trata_cat;

  BEGIN

    --dbms_output.put_line('#01 PRC_ATUALIZA_REQ.TRATA_REQ_VAGA');
    --
    pflg_retorno := 'S';
    --
    OPEN c1;
    FETCH c1 INTO req;
    CLOSE c1;
    --
    vexiste := 'N';
    --
    --dbms_output.put_line('#01.1 PRC_ATUALIZA_REQ.TRATA_REQ_VAGA req.tipo_req = '||req.tipo_req);

    BEGIN
      --
      SELECT X.VERIFICA_REQUISICAO
      INTO   vexiste
      FROM
      (SELECT DISTINCT 'S' VERIFICA_REQUISICAO
      FROM   consulta_requisicoes cr
      WHERE  cr.cod_sit      = 1
      AND    cr.solicitacao  = req.solicitacao
      AND    cr.cod_empresa  = req.cod_empresa
      AND    cr.status_aprov IN ('P','R')
/*      UNION -- Incluso query para retornar requisições de pessoal "filhotes" 16/10/2019
      SELECT DISTINCT 'S' VERIFICA_REQUISICAO
     FROM aprova_req a,
          requisicao f,
          empresas b,
          empresas c,
          inf_pessoais_cad d,
          usuario_oracle uo
    WHERE uo.cd_matricula(+) = f.mat_req
      AND uo.cd_empresa(+)   = f.cod_emp_req
      AND a.cod_req = f.cod_req
      AND a.cod_empresa = f.cod_empresa
      AND a.cod_empresa = b.cod(+)
      AND a.cod_emp_aprov = c.cod(+)
      AND a.cod_emp_aprov = d.cod_empresa(+)
      AND a.mat_aprov = d.matricula(+)
      AND f.cod_req_pai is not null
      AND f.cod_req = psolicitacao*/) X;
      --
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        vexiste := 'N';
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Erro ao verificar aprovação da requisição '||req.solicitacao;
    END;
    --
    declare
      vseq number := 0;
    begin
      select nvl(max(lr.seq),0)
      into   vseq
      from   log_requisicao lr
      where  solicitacao = req.solicitacao
      and    lr.tipo_req = req.tipo_req;
      -- Grava data e horário da chamada dessa procedure
      insert into log_requisicao(tipo_req, solicitacao, seq, descricao, dt_atualizacao, usuario)
      values (req.tipo_req,req.solicitacao,vseq+1,'PRC_ATUALIZA_REQ: '||to_char(sysdate,'dd/mm/rrrr hh24:mi:ss'),SYSDATE, USUARIO.BUSCA_USER);
      commit;
      --
    exception
      when others then
        null;
    end;
    --
    --dbms_output.put_line('#01.2 PRC_ATUALIZA_REQ.TRATA_REQ_VAGA req.tipo_req = '||req.tipo_req);

    IF req.tipo_req = 'REQ_PESSOAL' THEN
      --
      trata_pessoal;
      IF NVL(pflg_retorno,'S') <> 'S' THEN
        RAISE vsaida_erro;
      END IF;
      --
    ELSIF req.tipo_req = 'REQ_FERIAS' THEN
      --
      Trata_Ferias(pcod_empresa,psolicitacao,req.mat_solicitado,pflg_retorno,pmsg_retorno);
      IF NVL(pflg_retorno,'S') <> 'S' THEN
        RAISE vsaida_erro;
      END IF;
      --
    ELSIF req.tipo_req IN ('REQ_VAGAS','REQ_VAGA') THEN
      --
    --dbms_output.put_line('#02 PRC_ATUALIZA_REQ.TRATA_REQ_VAGA');

      FOR x IN (SELECT * FROM requisicao_vaga rv WHERE rv.cod_requisicao = psolicitacao) LOOP
        --
        --dbms_output.put_line('#03 PRC_ATUALIZA_REQ.TRATA_REQ_VAGA');

        Trata_Req_Vaga(pcod_empresa,psolicitacao,pflg_retorno,pmsg_retorno);
        IF pflg_retorno <> 'S' THEN
          RAISE vsaida_erro;
        END IF;
        --
      END LOOP;
      --
    ELSIF UPPER(TRIM(req.tipo_req)) IN ('ALT_FUNC','REQ_ALTERACAO') THEN
      --
      Trata_Alt_Func;

    ELSIF req.tipo_req = 'REQ_ABONO' THEN
      --
      --dbms_output.put_line('prc_atualiza_req: Insere_Abono #00');

      Trata_Abono(psolicitacao,pflg_retorno,pmsg_retorno);

      --dbms_output.put_line('prc_atualiza_req: Insere_Abono #10');

      IF NVL(pflg_retorno,'S') <> 'S' THEN
        RAISE vsaida_erro;
      END IF;
      --
    ELSIF req.tipo_req = 'REQ_HE' THEN
      --
      Trata_He(psolicitacao,pflg_retorno,pmsg_retorno);
      IF NVL(pflg_retorno,'S') <> 'S' THEN
        RAISE vsaida_erro;
      END IF;

    ELSIF req.tipo_req = 'REQ_BENEFICIO' THEN
      --
      Trata_Beneficio(psolicitacao,pflg_retorno,pmsg_retorno);
      IF NVL(pflg_retorno,'S') <> 'S' THEN
        RAISE vsaida_erro;
      END IF;
      --

    ELSIF req.tipo_req = 'REQ_BENEFICIO_CAND' THEN
      --
      Trata_Beneficio_Cand(psolicitacao,pflg_retorno,pmsg_retorno);
      IF NVL(pflg_retorno,'S') <> 'S' THEN
        RAISE vsaida_erro;
      END IF;

    ELSIF req.tipo_req = 'REQ_BENEFICIARIA' THEN
      --
      Trata_Beneficiaria(psolicitacao,pflg_retorno,pmsg_retorno);
      IF NVL(pflg_retorno,'S') <> 'S' THEN
        RAISE vsaida_erro;
      END IF;

    ELSIF req.tipo_req = 'REQ_ESCALA' THEN
      --
      Trata_Escala(pcod_empresa,
                   psolicitacao,
                   req.mat_solicitado,
                   pflg_retorno,
                   pmsg_retorno);

      IF NVL(pflg_retorno,'S') <> 'S' THEN
        RAISE vsaida_erro;
      END IF;

    /*ELSIF req.tipo_req = 'REQ_LANC_PONTO' THEN
      --
      Trata_Lanc_Ponto(psolicitacao,pflg_retorno,pmsg_retorno);
      IF NVL(pflg_retorno,'S') <> 'S' THEN
        RAISE vsaida_erro;
      END IF;
      */
     ELSIF req.tipo_req = 'REQ_EXAME' THEN
      --
      Trata_Exame(psolicitacao,pflg_retorno,pmsg_retorno);
      IF NVL(pflg_retorno,'S') <> 'S' THEN
        RAISE vsaida_erro;
      END IF;

    ELSIF req.tipo_req = 'REQ_PPP' THEN
      --
      Trata_PPP(psolicitacao,pflg_retorno,pmsg_retorno);
      IF NVL(pflg_retorno,'S') <> 'S' THEN
        RAISE vsaida_erro;
      END IF;

    ELSIF req.tipo_req = 'REQ_ATESTADO' THEN
      --
      Trata_Atestado(pcod_empresa,psolicitacao,/*req.mat_solicitado,*/pflg_retorno,pmsg_retorno);

      IF NVL(pflg_retorno,'S') <> 'S' THEN
        RAISE vsaida_erro;
      END IF;

    ELSIF req.tipo_req = 'REQ_CAT' THEN
     --
    --dbms_output.put_line('#01.3 DENTRO REQ_CAT po_req = '||req.mat_solicitado);

      Trata_Cat(pcod_empresa,psolicitacao,/*req.mat_solicitado,*/pflg_retorno,pmsg_retorno);---daniel tasso

    --dbms_output.put_line('#01.4 DENTRO  pcod_empresa = '||pcod_empresa);
    --dbms_output.put_line('#01.4 DENTRO  psolicitacao = '||psolicitacao);
    --dbms_output.put_line('#01.4 DENTRO  req.mat_solicitado = '||req.mat_solicitado);
    --dbms_output.put_line('#01.4 DENTRO  pflg_retorno = '||pflg_retorno);
    --dbms_output.put_line('#01.5 DENTRO  pmsg_retorno = '||pmsg_retorno);

     IF NVL(pflg_retorno,'S') <> 'S' THEN
      RAISE vsaida_erro;
     END IF;

   --dbms_output.put_line('#01.6 PASSOU' );

    ELSIF req.tipo_req = 'REQ_REEMBOLSO' THEN
          Trata_Req_Reembolso( pcod_empresa  => pcod_empresa
                              , psolicitacao  => psolicitacao
                              , pflg_retorno  => pflg_retorno
                              , pmsg_retorno  => pmsg_retorno
                              );

    ELSIF req.tipo_req = 'REQ_APURA' THEN
          Trata_Req_Apuracao( pcod_empresa  => pcod_empresa
                            , psolicitacao  => psolicitacao
                            , pflg_retorno  => pflg_retorno
                            , pmsg_retorno  => pmsg_retorno
                            );

    ELSE -- VERIFICA AS OUTRAS REQUISIÇÕES
      --
      NULL;
      --
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Pessoal.Aprova_Req - Erro: '||SQLERRM;
END PRC_ATUALIZA_REQ;
