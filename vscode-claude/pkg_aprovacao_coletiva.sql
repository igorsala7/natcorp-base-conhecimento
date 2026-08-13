create or replace package natcorp.pkg_aprovacao_coletiva is
-- Versão 13 - 01/08/2025 - Andre - Inclusao da req.de reembolso
-- Versão 12 - 10/06/2025 - Cibele ch38742

  -- Author  : IGOR.CARDOSO
  -- Created : 05/08/2019 17:02:12
  -- Purpose :

  vsaida_erro exception; -- Incluso verificação do flg_retorno Cibele 06/07/2020

cursor c_usuario(v_usuario varchar2) is
select cd_perfil perfil,
       cd_empresa cod_empresa,
       cd_matricula matricula
  from usuario_oracle
 where nm_usuario_oracle = v_usuario;

v_usuario c_usuario%rowtype;

cursor c_perfil_aprov(v_perfil varchar2) is
select cd_perfil perfil
  from perfil_aprovadores
 where cd_perfil = v_perfil;

v_perfil_aprov c_perfil_aprov%rowtype;

cursor c_suplente (v_emp number, v_cc number, v_sub_cc number, v_cod_empresa number, v_matricula number) is
select x.emp_gestor, x.mat_gestor
  from (select c.cod_emp_gestor emp_gestor,
               c.matricula_gestor mat_gestor
          from centro_de_custo c
         where c.cod_empresa = v_emp
           and c.cod = v_cc
           and c.cod_emp_suplente = v_cod_empresa
           and c.matricula_suplente = v_matricula
           and v_sub_cc is null
         union
        select c.cod_emp_gestor emp_gestor,
               c.mat_gestor mat_gestor
          from sub_ccusto c
         where c.cod_empresa = v_emp
           and c.cod_ccusto = v_cc
           and c.cod_sub_ccusto = v_sub_cc
           and c.cod_emp_subs = v_cod_empresa
           and c.mat_subs = v_matricula) x
 where x.mat_gestor is not null;

v_suplente c_suplente%rowtype;

procedure executa (pcod_req number,
                   pstatus varchar2,
                   pcod_empresa number,
                   pmatricula number,
                   pusuario varchar2,
                   pjustificativa varchar2,
                   pflg_retorno out varchar2,
                   pmsg_retorno out varchar2);

procedure req_pessoal (pcod_req number,
                       pemp_req number,
                       pstatus varchar2,
                       pcod_empresa number,
                       pmatricula number,
                       pusuario varchar2,
                       pperfil varchar2,
                       pjustificativa varchar2,
                       pflg_retorno out varchar2,
                       pmsg_retorno out varchar2);

procedure req_desligamento (pcod_req number,
                            pemp_req number,
                            pstatus varchar2,
                            pcod_empresa number,
                            pmatricula number,
                            pusuario varchar2,
                            pperfil varchar2,
                            pjustificativa varchar2,
                            pflg_retorno out varchar2,
                            pmsg_retorno out varchar2);

procedure req_ferias (pcod_req number,
                      pemp_req number,
                      pstatus varchar2,
                      pcod_empresa number,
                      pmatricula number,
                      pusuario varchar2,
                      pperfil varchar2,
                      pjustificativa varchar2,
                      pflg_retorno out varchar2,
                      pmsg_retorno out varchar2);

procedure req_alteracao (pcod_req number,
                        pemp_req number,
                        pstatus varchar2,
                        pcod_empresa number,
                        pmatricula number,
                        pusuario varchar2,
                        pperfil varchar2,
                        pjustificativa varchar2,
                        pflg_retorno out varchar2,
                        pmsg_retorno out varchar2);

procedure req_vaga (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2);

procedure req_alt_vaga (pcod_req number,
                        pemp_req number,
                        pstatus varchar2,
                        pcod_empresa number,
                        pmatricula number,
                        pusuario varchar2,
                        pperfil varchar2,
                        pjustificativa varchar2,
                        pflg_retorno out varchar2,
                        pmsg_retorno out varchar2);

procedure req_abono (pcod_req number,
                     pemp_req number,
                     pstatus varchar2,
                     pcod_empresa number,
                     pmatricula number,
                     pusuario varchar2,
                     pperfil varchar2,
                     pjustificativa varchar2,
                     pflg_retorno out varchar2,
                     pmsg_retorno out varchar2);

procedure req_he (pcod_req number,
                  pemp_req number,
                  pstatus varchar2,
                  pcod_empresa number,
                  pmatricula number,
                  pusuario varchar2,
                  pperfil varchar2,
                  pjustificativa varchar2,
                  pflg_retorno out varchar2,
                  pmsg_retorno out varchar2);

procedure req_beneficio (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2);

procedure req_beneficio_cand (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2);

procedure req_beneficiaria (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2);
/*
procedure req_ocorr (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2);

procedure req_lanc_ponto (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2);
*/
procedure req_exame (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2);

procedure req_treinamento (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2);

procedure req_treinamento_cursos (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2);

procedure req_ppp(pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2);

procedure req_escala (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2);

procedure req_atestado (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2);

procedure req_cat (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2);

  procedure req_apuracao (pcod_req number,
                       pemp_req number,
                       pstatus varchar2,
                       pcod_empresa number,
                       pmatricula number,
                       pusuario varchar2,
                       pperfil varchar2,
                       pjustificativa varchar2,
                       pflg_retorno out varchar2,
                       pmsg_retorno out varchar2);

  procedure req_reembolso (pcod_req number,
                       pemp_req number,
                       pstatus varchar2,
                       pcod_empresa number,
                       pmatricula number,
                       pusuario varchar2,
                       pperfil varchar2,
                       pjustificativa varchar2,
                       pflg_retorno out varchar2,
                       pmsg_retorno out varchar2);
end pkg_aprovacao_coletiva;
/

create or replace package body natcorp.pkg_aprovacao_coletiva is

-- Versao 31 - 23-12-2025 - Andre - Chamado 42001 Processo do suplente de outra empresa aprovar.
-- Versao 30 - 25/09/2025 - Andre - Ajuste na busca para empresa do aprovador na req.de apuracao
-- Versão 29 - 11/09/2025 - Andre ch40042
-- Versão 27 - 10/06/2025 - Cibele ch38742
-- Versão 26 - 10/06/2025 - Cibele ch38742
  procedure executa (pcod_req number,
                     pstatus varchar2,
                     pcod_empresa number,
                     pmatricula number,
                     pusuario varchar2,
                     pjustificativa varchar2,
                     pflg_retorno out varchar2,
                     pmsg_retorno out varchar2) is


  cursor c_req is
  select distinct c.tipo_req tipo, c.empresa_req empresa
    from consulta_requisicoes c
   where c.solicitacao = pcod_req;

  v_req c_req%rowtype;

  begin

  open c_req;
  fetch c_req into v_req;
  close c_req;

  open c_usuario(pusuario);
  fetch c_usuario into v_usuario;
  close c_usuario;

  if    v_req.tipo = 'REQ_PESSOAL' then
    req_pessoal(pcod_req, v_req.empresa, pstatus, pcod_empresa, pmatricula, pusuario, v_usuario.perfil, pjustificativa, pflg_retorno, pmsg_retorno);
  elsif v_req.tipo = 'REQ_DESLIGAMENTO' then
    req_desligamento(pcod_req, v_req.empresa, pstatus, pcod_empresa, pmatricula, pusuario, v_usuario.perfil, pjustificativa, pflg_retorno, pmsg_retorno);
  elsif v_req.tipo = 'REQ_FERIAS' then
    req_ferias(pcod_req, v_req.empresa, pstatus, pcod_empresa, pmatricula, pusuario, v_usuario.perfil, pjustificativa, pflg_retorno, pmsg_retorno);
  elsif v_req.tipo = 'REQ_ALTERACAO' then
    req_alteracao(pcod_req, v_req.empresa, pstatus, pcod_empresa, pmatricula, pusuario, v_usuario.perfil, pjustificativa, pflg_retorno, pmsg_retorno);
  elsif v_req.tipo = 'REQ_VAGA' then
    req_vaga(pcod_req, v_req.empresa, pstatus, pcod_empresa, pmatricula, pusuario, v_usuario.perfil, pjustificativa, pflg_retorno, pmsg_retorno);
  elsif v_req.tipo = 'PER_ALT_VAGA' then
    req_alt_vaga(pcod_req, v_req.empresa, pstatus, pcod_empresa, pmatricula, pusuario, v_usuario.perfil, pjustificativa, pflg_retorno, pmsg_retorno);
  elsif v_req.tipo = 'REQ_ABONO' then
    req_abono(pcod_req, v_req.empresa, pstatus, pcod_empresa, pmatricula, pusuario, v_usuario.perfil, pjustificativa, pflg_retorno, pmsg_retorno);
  elsif v_req.tipo = 'REQ_APURA' then
    req_apuracao(pcod_req, v_req.empresa, pstatus, pcod_empresa, pmatricula, pusuario, v_usuario.perfil, pjustificativa, pflg_retorno, pmsg_retorno);
  elsif v_req.tipo = 'REQ_HE' then
    req_he(pcod_req, v_req.empresa, pstatus, pcod_empresa, pmatricula, pusuario, v_usuario.perfil, pjustificativa, pflg_retorno, pmsg_retorno);
  elsif v_req.tipo = 'REQ_BENEFICIO' then
    req_beneficio(pcod_req, v_req.empresa, pstatus, pcod_empresa, pmatricula, pusuario, v_usuario.perfil, pjustificativa, pflg_retorno, pmsg_retorno);
  elsif v_req.tipo = 'REQ_BENEFICIO_CAND' then
    req_beneficio_cand(pcod_req, v_req.empresa, pstatus, pcod_empresa, pmatricula, pusuario, v_usuario.perfil, pjustificativa, pflg_retorno, pmsg_retorno);
  elsif v_req.tipo = 'REQ_BENEFICIARIA' then
    req_beneficiaria(pcod_req, v_req.empresa, pstatus, pcod_empresa, pmatricula, pusuario, v_usuario.perfil, pjustificativa, pflg_retorno, pmsg_retorno);
  /*elsif v_req.tipo = 'REQ_OCORR' then
    req_ocorr(pcod_req, v_req.empresa, pstatus, pcod_empresa, pmatricula, pusuario, v_usuario.perfil, pjustificativa, pflg_retorno, pmsg_retorno);
  elsif v_req.tipo = 'REQ_LANC_PONTO' then
    req_lanc_ponto(pcod_req, v_req.empresa, pstatus, pcod_empresa, pmatricula, pusuario, v_usuario.perfil, pjustificativa, pflg_retorno, pmsg_retorno);
  */
  elsif v_req.tipo = 'REQ_EXAME' then
    req_exame(pcod_req, v_req.empresa, pstatus, pcod_empresa, pmatricula, pusuario, v_usuario.perfil, pjustificativa, pflg_retorno, pmsg_retorno);
  elsif v_req.tipo = 'REQ_TREINAMENTO' then
  DBMS_OUTPUT.PUT_LINE('PKG_APROVACAO_COLETIVA.req_treinamento('||pcod_req||', '||v_req.empresa||', '||pstatus||', '||pcod_empresa||', '||pmatricula||', '||pusuario||', '||v_usuario.perfil||', '||pjustificativa||', '||pflg_retorno||', '||pmsg_retorno||');');
    req_treinamento(pcod_req, v_req.empresa, pstatus, pcod_empresa, pmatricula, pusuario, v_usuario.perfil, pjustificativa, pflg_retorno, pmsg_retorno);
  elsif v_req.tipo = 'REQ_TREINAMENTO_CURSOS' then
  DBMS_OUTPUT.PUT_LINE('PKG_APROVACAO_COLETIVA.req_treinamento_cursos('||pcod_req||', '||v_req.empresa||', '||pstatus||', '||pcod_empresa||', '||pmatricula||', '||pusuario||', '||v_usuario.perfil||', '||pjustificativa||', '||pflg_retorno||', '||pmsg_retorno||');');
    req_treinamento_cursos(pcod_req, v_req.empresa, pstatus, pcod_empresa, pmatricula, pusuario, v_usuario.perfil, pjustificativa, pflg_retorno, pmsg_retorno);
--  elsif v_req.tipo = 'REQ_INDICACAO_CURSO' then
--    req_indicacao_curso(pcod_req, v_req.empresa, pstatus, pcod_empresa, pmatricula, pusuario, v_usuario.perfil, pjustificativa, pflg_retorno, pmsg_retorno);
  elsif v_req.tipo = 'REQ_PPP' then
    req_ppp(pcod_req, v_req.empresa, pstatus, pcod_empresa, pmatricula, pusuario, v_usuario.perfil, pjustificativa, pflg_retorno, pmsg_retorno);
  elsif v_req.tipo = 'REQ_ESCALA' then
    req_escala(pcod_req, v_req.empresa, pstatus, pcod_empresa, pmatricula, pusuario, v_usuario.perfil, pjustificativa, pflg_retorno, pmsg_retorno);
  elsif v_req.tipo = 'REQ_ATESTADO' then
    req_atestado(pcod_req, v_req.empresa, pstatus, pcod_empresa, pmatricula, pusuario, v_usuario.perfil, pjustificativa, pflg_retorno, pmsg_retorno);
  elsif v_req.tipo = 'REQ_CAT' then
    req_cat(pcod_req, v_req.empresa, pstatus, pcod_empresa, pmatricula, pusuario, v_usuario.perfil, pjustificativa, pflg_retorno, pmsg_retorno);
  end if;

  if nvl(pflg_retorno,'S') <> 'S' then -- Incluso verificação do flg_retorno Cibele 06/07/2020
    raise vsaida_erro;
  else
    commit;
  end if;

  if pflg_retorno = 'S' then
    PRC_OPERADOR_APROVA_TODOS( p_solicitacao        => pcod_req
                              , p_tipo_solicitacao  => v_req.tipo
                              , pflg_retorno        => pflg_retorno
                              , pmsg_retorno        => pmsg_retorno );
  end if;

  exception  -- Incluso verificação do flg_retorno Cibele 06/07/2020
    when vsaida_erro then
      null;
    when others then
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Aprovacao_Coletiva.Executa Erro: '||sqlerrm;
  end executa;

  procedure req_pessoal (pcod_req number,
                         pemp_req number,
                         pstatus varchar2,
                         pcod_empresa number,
                         pmatricula number,
                         pusuario varchar2,
                         pperfil varchar2,
                         pjustificativa varchar2,
                         pflg_retorno out varchar2,
                         pmsg_retorno out varchar2) is

  v_flg_retorno varchar2(3);
  v_msg_retorno varchar2(4000);

  cursor c1 is
  select cod_req
    from requisicao
   where cod_req = pcod_req
  union
  select cod_req
    from requisicao
   where cod_req_pai = pcod_req;

  begin

  for l1 in c1
    loop

      open c_perfil_aprov(pperfil);
      fetch c_perfil_aprov into v_perfil_aprov;
      close c_perfil_aprov;

    IF v_perfil_aprov.perfil is null then
      --IF pperfil not in ('REMUNERACAO','BUSINESS PARTNER','CONT DE NEGOCIOS','TST','EST','EST_CHEFE','ADM','FIS','ERGO') THEN
          begin
           update aprova_req
              set status_aprov = pstatus,
                  usuario = pusuario,
                  dt_atualizacao = sysdate,
                  dt_aprov = sysdate,
                  justificativa = pjustificativa
            where cod_req = l1.cod_req
              and cod_emp_aprov = pcod_empresa
              and mat_aprov = pmatricula;

          commit;

          end;
      ELSE
          begin
           update aprova_req
              set status_aprov = pstatus,
                  usuario = pusuario,
                  dt_atualizacao = sysdate,
                  dt_aprov = sysdate,
                  justificativa = '('|| case when pstatus = 'A' THEN 'Aprovado'
                                             when pstatus = 'R' THEN 'Reprovado' end ||' por '||pusuario||') '||pjustificativa
            where cod_req = l1.cod_req
              and (cod_emp_aprov, mat_aprov) in (select U.cd_empresa, U.cd_matricula
                                                   from usuario_oracle U
                                                  where U.cd_Perfil = pPerfil);

          commit;

          end;
      END IF;

       pkg_pessoal.post_update(pemp_req, l1.cod_req, pflg_retorno, pmsg_retorno);
       if nvl(pflg_retorno,'S') <> 'S' then -- Incluso verificação do flg_retorno Cibele 06/07/2020
         exit;
       end if;

   end loop;

   if nvl(pflg_retorno,'S') <> 'S' then -- Incluso verificação do flg_retorno Cibele 06/07/2020
     raise vsaida_erro;
   end if;

  exception -- Incluso verificação do flg_retorno Cibele 06/07/2020
    when vsaida_erro then
      null;
    when others then
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Aprovacao_Coletiva.Req_Pessoal Erro: '||sqlerrm;
  end req_pessoal;

  procedure req_desligamento (pcod_req number,
                              pemp_req number,
                              pstatus varchar2,
                              pcod_empresa number,
                              pmatricula number,
                              pusuario varchar2,
                              pperfil varchar2,
                              pjustificativa varchar2,
                              pflg_retorno out varchar2,
                              pmsg_retorno out varchar2) is

  v_flg_retorno varchar2(3);
  v_msg_retorno varchar2(4000);

  begin

      open c_perfil_aprov(pperfil);
      fetch c_perfil_aprov into v_perfil_aprov;
      close c_perfil_aprov;

    IF v_perfil_aprov.perfil is null then
      --pperfil not in ('REMUNERACAO','BUSINESS PARTNER','CONT DE NEGOCIOS','TST','EST','EST_CHEFE','ADM','FIS','ERGO') THEN
          begin
           update aprova_desligamento
              set status_aprov = pstatus, usuario = pusuario, dt_atualizacao = sysdate, dt_aprov = sysdate,
                  justificativa = pjustificativa
            where cod_desligamento = pcod_req
              and cod_emp_aprov = pcod_empresa
              and mat_aprov = pmatricula;
          commit;

          end;

      ELSE
          begin
           update aprova_desligamento
              set status_aprov = pstatus, usuario = pusuario, dt_atualizacao = sysdate, dt_aprov = sysdate,
                    justificativa = '('|| case when pstatus = 'A' THEN 'Aprovado'
                                             when pstatus = 'R' THEN 'Reprovado' end ||' por '||pusuario||') '||pjustificativa
            where cod_desligamento = pcod_req
              and (cod_emp_aprov, mat_aprov) in (select U.cd_empresa, U.cd_matricula
                                                   from usuario_oracle U
                                                  where U.cd_Perfil = pPerfil);

          commit;

          end;
      END IF;

      pkg_deslig.trata_aprovacao(pemp_req, pcod_req, v_flg_retorno, v_msg_retorno);

      pflg_retorno := nvl(v_flg_retorno,'S'); -- Incluso verificação do flg_retorno Cibele 06/07/2020
      pmsg_retorno := v_msg_retorno;

      if nvl(pflg_retorno,'S') <> 'S' then -- Incluso verificação do flg_retorno Cibele 06/07/2020
        raise vsaida_erro;
      end if;

  exception -- Incluso verificação do flg_retorno Cibele 06/07/2020
    when vsaida_erro then
      null;
    when others then
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Aprovacao_Coletiva.Req_Desligamento Erro: '||sqlerrm;
  end req_desligamento;

  procedure req_ferias (pcod_req number,
                        pemp_req number,
                        pstatus varchar2,
                        pcod_empresa number,
                        pmatricula number,
                        pusuario varchar2,
                        pperfil varchar2,
                        pjustificativa varchar2,
                        pflg_retorno out varchar2,
                        pmsg_retorno out varchar2) is

  v_flg_retorno varchar2(3);
  v_msg_retorno varchar2(4000);

  cursor c_req is
  select i.cod_empresa, i.filial, i.cod_ccusto, i.cod_sub_ccusto
    from requisicao_ferias r,
         informacoes_funcionais_cad i
   where r.cod_empresa = i.cod_empresa
     and r.matricula = i.matricula
     and r.cod_solicitacao = pcod_req;

  v_req c_req%rowtype;
  --Novo cursor criado para o chamado 31548 - 30-11-2023 - Andre
  cursor c_suplente_aprova(v_emp number, v_cc number, v_sub_cc number, v_cod_empresa number, v_matricula number) is
    select cod_empresa_gestor, matricula_gestor
    from (
    select cod_emp_gestor cod_empresa_gestor, matricula_gestor
           from centro_de_custo c, aprova_ferias a
    where a.cod_emp_aprov = c.cod_emp_gestor
    and a.mat_aprov = c.matricula_gestor
    and c.cod_emp_suplente = pcod_empresa
    and c.matricula_suplente = pmatricula
    and a.cod_solicitacao = pcod_req
    and a.status_aprov = 'P'
    union
    select cod_emp_gestor cod_empresa_gestor , MAT_GESTOR matricula_gestor
           from sub_ccusto c, aprova_ferias a
    where a.cod_emp_aprov = c.cod_emp_gestor
    and a.mat_aprov = c.MAT_GESTOR
    and c.COD_EMP_SUBS = pcod_empresa
    and c.MAT_SUBS = pmatricula
    and a.cod_solicitacao = pcod_req
    and a.status_aprov = 'P') x;

    v_sup_aprova c_suplente_aprova%rowtype;
  v_cod_empresa informacoes_funcionais.cod_empresa%type := pcod_empresa;
  v_matricula informacoes_funcionais.matricula%type := pmatricula;

  v_just varchar2(100);

  begin
      open c_req;
      fetch c_req into v_req;
      close c_req;

      if v_req.cod_empresa is not null then
          open c_suplente_aprova(v_req.cod_empresa, v_req.cod_ccusto, v_req.cod_sub_ccusto, v_cod_empresa, v_matricula);
          fetch c_suplente_aprova into v_sup_aprova;
          close c_suplente_aprova;

          if v_sup_aprova.matricula_gestor is not null then

              v_cod_empresa := v_sup_aprova.cod_empresa_gestor;
              v_matricula := v_sup_aprova.matricula_gestor;
              if pstatus = 'A' then
                v_just := '(Aprovado por '||pusuario||') ';
              elsif pstatus = 'R' then
                v_just := '(Reprovado por '||pusuario||') ';
              end if;


          else

                open  c_suplente (v_req.cod_empresa, v_req.cod_ccusto, v_req.cod_sub_ccusto, v_cod_empresa, v_matricula);
                fetch c_suplente into v_suplente;
                close c_suplente;

                if v_suplente.mat_gestor is not null then
                  v_cod_empresa := v_suplente.emp_gestor;
                  v_matricula := v_suplente.mat_gestor;
                if pstatus = 'A' then
                   v_just := '(Aprovado por '||pusuario||') ';
                elsif pstatus = 'R' then
                      v_just := '(Reprovado por '||pusuario||') ';
                end if;
                end if;
          end if;

      else

        open c_perfil_aprov(pperfil);
        fetch c_perfil_aprov into v_perfil_aprov;
        close c_perfil_aprov;

      end if;

    IF v_perfil_aprov.perfil is null then
      --IF pperfil not in ('REMUNERACAO','BUSINESS PARTNER','CONT DE NEGOCIOS','TST','EST','EST_CHEFE','ADM','FIS','ERGO') THEN
          begin
         update aprova_ferias
            set status_aprov = pstatus, usuario = pusuario, dt_atualizacao = sysdate, dt_aprov = sysdate,
                  justificativa = v_just||pjustificativa
          where cod_solicitacao = pcod_req
             and STATUS_APROV = 'P'
            and cod_emp_aprov = v_cod_empresa--pcod_empresa
            and mat_aprov = v_matricula;--pmatricula;
          commit;

          end;
      ELSE

        if pstatus = 'A' then
          v_just := '(Aprovado por '||pusuario||') ';
        elsif pstatus = 'R' then
          v_just := '(Reprovado por '||pusuario||') ';
        end if;

          begin
         update aprova_ferias
            set status_aprov = pstatus, usuario = pusuario, dt_atualizacao = sysdate, dt_aprov = sysdate,
                  justificativa = v_just||pjustificativa
          where cod_solicitacao = pcod_req
             and STATUS_APROV = 'P'
            and (cod_emp_aprov, mat_aprov) in (select U.cd_empresa, U.cd_matricula from usuario_oracle U where U.cd_Perfil = pPerfil);

          commit;

          end;
      END IF;

      pkg_ferias.post_update(pemp_req, pcod_req, v_flg_retorno, v_msg_retorno);

      pflg_retorno := nvl(v_flg_retorno,'S'); -- Incluso verificação do flg_retorno Cibele 06/07/2020
      pmsg_retorno := v_msg_retorno;

      if nvl(pflg_retorno,'S') <> 'S' then -- Incluso verificação do flg_retorno Cibele 06/07/2020
        raise vsaida_erro;
      end if;

  exception -- Incluso verificação do flg_retorno Cibele 06/07/2020
    when vsaida_erro then
      null;
    when others then
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Aprovacao_Coletiva.Req_Ferias Erro: '||sqlerrm;
  end req_ferias;

  procedure req_alteracao (pcod_req number,
                        pemp_req number,
                        pstatus varchar2,
                        pcod_empresa number,
                        pmatricula number,
                        pusuario varchar2,
                        pperfil varchar2,
                        pjustificativa varchar2,
                        pflg_retorno out varchar2,
                        pmsg_retorno out varchar2) is

  v_flg_retorno varchar2(3);
  v_msg_retorno varchar2(4000);

  begin

      open c_perfil_aprov(pperfil);
      fetch c_perfil_aprov into v_perfil_aprov;
      close c_perfil_aprov;

    IF v_perfil_aprov.perfil is null then
      --IF pperfil not in ('REMUNERACAO','BUSINESS PARTNER','CONT DE NEGOCIOS','TST','EST','EST_CHEFE','ADM','FIS','ERGO') THEN
        begin
            update APROVA_SOLICITACAO
               set status_aprov = pstatus, dt_aprov = sysdate, usuario = pusuario, justificativa = pjustificativa
             where cod_empresa = pemp_req
               and cod_solicitacao = pcod_req
               and cod_emp_aprov = pcod_empresa
               and mat_aprov = pmatricula;

        commit;

        end;
    ELSE
        begin

            update APROVA_SOLICITACAO
               set status_aprov = pstatus
               , usuario = pusuario
               , dt_aprov = sysdate
               ,   justificativa = '('|| case when pstatus = 'A' THEN 'Aprovado'
                                             when pstatus = 'R' THEN 'Reprovado' end ||' por '||pusuario||') '||pjustificativa
             where cod_solicitacao = pcod_req
               and (cod_emp_aprov, mat_aprov) in (select U.cd_empresa, U.cd_matricula from usuario_oracle U where U.cd_Perfil = pPerfil);

        commit;

        end;
    END IF;


    PKG_alt_func.Post_Update(pemp_req,
                             pcod_req,
                             V_flg_retorno             ,
                             V_msg_retorno             );

    pflg_retorno := nvl(v_flg_retorno,'S'); -- Incluso verificação do flg_retorno Cibele 06/07/2020
    pmsg_retorno := v_msg_retorno;

    if nvl(pflg_retorno,'S') <> 'S' then -- Incluso verificação do flg_retorno Cibele 06/07/2020
      raise vsaida_erro;
    end if;

  exception -- Incluso verificação do flg_retorno Cibele 06/07/2020
    when vsaida_erro then
      null;
    when others then
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Aprovacao_Coletiva.Req_Alteracao Erro: '||sqlerrm;

  end req_alteracao;

  procedure req_vaga (pcod_req number,
                        pemp_req number,
                        pstatus varchar2,
                        pcod_empresa number,
                        pmatricula number,
                        pusuario varchar2,
                        pperfil varchar2,
                        pjustificativa varchar2,
                        pflg_retorno out varchar2,
                        pmsg_retorno out varchar2) is

  v_flg_retorno varchar2(3);
  v_msg_retorno varchar2(4000);

  begin

      open c_perfil_aprov(pperfil);
      fetch c_perfil_aprov into v_perfil_aprov;
      close c_perfil_aprov;

    IF v_perfil_aprov.perfil is null then
      --IF pperfil not in ('REMUNERACAO','BUSINESS PARTNER','CONT DE NEGOCIOS','TST','EST','EST_CHEFE','ADM','FIS','ERGO') THEN
        begin
            update APROVA_REQUISICAO_VAGA
               set status_aprov = pstatus, dt_aprov = sysdate, usuario = pusuario,
                  justificativa = pjustificativa
             where cod_empresa = pemp_req
               and cod_requisicao = pcod_req
               and cod_emp_aprov = pcod_empresa
               and mat_aprov = pmatricula;

        commit;

        end;
    ELSE
        begin

            update APROVA_REQUISICAO_VAGA
               set status_aprov = pstatus
               , usuario = pusuario
               , dt_aprov = sysdate
               ,   justificativa = '('|| case when pstatus = 'A' THEN 'Aprovado'
                                             when pstatus = 'R' THEN 'Reprovado' end ||' por '||pusuario||') '||pjustificativa
             where cod_requisicao = pcod_req
               and (cod_emp_aprov, mat_aprov) in (select U.cd_empresa, U.cd_matricula from usuario_oracle U where U.cd_Perfil = pPerfil);

        commit;

        end;
    END IF;


    PKG_vagas.Post_Update(pemp_req,
                           pcod_req,
                          V_flg_retorno             ,
                          V_msg_retorno             );

    pflg_retorno := nvl(v_flg_retorno,'S'); -- Incluso verificação do flg_retorno Cibele 06/07/2020
    pmsg_retorno := v_msg_retorno;

    if nvl(pflg_retorno,'S') <> 'S' then -- Incluso verificação do flg_retorno Cibele 06/07/2020
      raise vsaida_erro;
    end if;

  exception -- Incluso verificação do flg_retorno Cibele 06/07/2020
    when vsaida_erro then
      null;
    when others then
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Aprovacao_Coletiva.Req_Vaga Erro: '||sqlerrm;
  end req_vaga;

  procedure req_alt_vaga (pcod_req number,
                          pemp_req number,
                          pstatus varchar2,
                          pcod_empresa number,
                          pmatricula number,
                          pusuario varchar2,
                          pperfil varchar2,
                          pjustificativa varchar2,
                          pflg_retorno out varchar2,
                          pmsg_retorno out varchar2) is

  v_flg_retorno varchar2(3);
  v_msg_retorno varchar2(4000);

  begin

      open c_perfil_aprov(pperfil);
      fetch c_perfil_aprov into v_perfil_aprov;
      close c_perfil_aprov;

    IF v_perfil_aprov.perfil is null then
      --IF pperfil not in ('REMUNERACAO','BUSINESS PARTNER','CONT DE NEGOCIOS','TST','EST','EST_CHEFE','ADM','FIS','ERGO') THEN
        begin
            update APROVACAO_ALT_VAGA
               set status_aprov = pstatus, dt_aprov = sysdate, usuario = pusuario,
                  justificativa = pjustificativa
             where cod_empresa = pemp_req
               and cod_requisicao = pcod_req
               and cod_emp_aprov = pcod_empresa
               and mat_aprov = pmatricula;

        commit;

        end;
    ELSE
        begin

            update APROVACAO_ALT_VAGA
               set status_aprov = pstatus
               , usuario = pusuario
               , dt_aprov = sysdate
               , justificativa = '('|| case when pstatus = 'A' THEN 'Aprovado'
                                             when pstatus = 'R' THEN 'Reprovado' end ||' por '||pusuario||') '||pjustificativa
             where cod_requisicao = pcod_req
               and (cod_emp_aprov, mat_aprov) in (select U.cd_empresa, U.cd_matricula from usuario_oracle U where U.cd_Perfil = pPerfil);

        commit;

        end;
    END IF;

    PKG_alt_vaga.Post_Update(pemp_req,
                             pcod_req,
                             V_flg_retorno,
                             V_msg_retorno);

    pflg_retorno := nvl(v_flg_retorno,'S'); -- Incluso verificação do flg_retorno Cibele 06/07/2020
    pmsg_retorno := v_msg_retorno;

    if nvl(pflg_retorno,'S') <> 'S' then -- Incluso verificação do flg_retorno Cibele 06/07/2020
      raise vsaida_erro;
    end if;

  exception -- Incluso verificação do flg_retorno Cibele 06/07/2020
    when vsaida_erro then
      null;
    when others then
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Aprovacao_Coletiva.Req_Req_Alt_Vaga Erro: '||sqlerrm;
  end req_alt_vaga;

  procedure req_abono (pcod_req number,
                       pemp_req number,
                       pstatus varchar2,
                       pcod_empresa number,
                       pmatricula number,
                       pusuario varchar2,
                       pperfil varchar2,
                       pjustificativa varchar2,
                       pflg_retorno out varchar2,
                       pmsg_retorno out varchar2) is

  v_flg_retorno varchar2(3);
  v_msg_retorno varchar2(4000);
  v_linhas      number := 0;


  v_cod_emp_aprovador empresas.cod%type;
  v_cod_emp_gestor    empresas.cod%type;
  begin
      open c_perfil_aprov(pperfil);
      fetch c_perfil_aprov into v_perfil_aprov;
      close c_perfil_aprov;
      --
     begin
        select cod_emp_aprov
           into  v_cod_emp_gestor
         from APROVA_APURACAO aa
         where cod_solicitacao = pcod_req
         and status_aprov = 'P';
      exception
        when others then
             v_cod_emp_gestor := pemp_req;
      end;
      --
    begin
           select nvl(apex_util.get_session_state('P_EMPRESA_USER'), 0)
                  into v_cod_emp_aprovador
      from dual;
      exception
         when others then
      v_cod_emp_aprovador := pemp_req;
      end;
  --
    IF v_perfil_aprov.perfil is null then
      --IF pperfil not in ('REMUNERACAO','BUSINESS PARTNER','CONT DE NEGOCIOS','TST','EST','EST_CHEFE','ADM','FIS','ERGO') THEN
        begin
            update APROVA_ABONO
               set status_aprov = pstatus, dt_aprov = sysdate, usuario = pusuario,
                  justificativa = pjustificativa
             where cod_empresa = pemp_req
               and cod_solicitacao = pcod_req
               and cod_emp_aprov = pcod_empresa
               and mat_aprov = pmatricula
               -- Alteracao Andre para o chamado 40042
               -- Estas condicoes abaixo evitam que o suplente
               -- no centro de custo e no sub-centro aprove uma linha
               -- jah aprovada pelo requisitante gestor
               and status_aprov = 'P'
               or ((cod_solicitacao = pcod_req and status_aprov = 'P')
               -- Alteracao Andre para o chamado 40042
                and (cod_emp_aprov, mat_aprov) IN (
                           SELECT af.cod_empresa, af.mat_aprov
                        FROM   APROVA_ABONO af
                        WHERE  (EXISTS (SELECT DISTINCT 1
                        FROM   PE_REQ_TRATAMENTO_BATIMENTOS RF
                              ,INFORMACOES_FUNCIONAIS_CAD IFF
                        WHERE  (EXISTS (SELECT 1
                                       FROM   SUB_CCUSTO SC
                                       WHERE  SC.MAT_SUBS = pmatricula
                                       AND    SC.COD_EMP_SUBS = v_cod_emp_aprovador --pemp_req
                                       AND    SC.MAT_GESTOR     = AF.MAT_APROV
                                       AND    SC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                                       AND    SC.COD_SUB_CCUSTO = IFF.COD_SUB_CCUSTO
                                       AND    SC.COD_CCUSTO     = IFF.COD_CCUSTO
                                       AND    SC.COD_EMPRESA    = IFF.COD_EMPRESA)
                        OR     EXISTS (SELECT 1
                                       FROM   CENTRO_DE_CUSTO CC
                                       WHERE  CC.MATRICULA_SUPLENTE = pmatricula
                                       AND    CC.COD_EMP_SUPLENTE = v_cod_emp_aprovador --pemp_req
                                       AND    CC.MATRICULA_GESTOR = AF.MAT_APROV
                                       AND    CC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                                       AND    CC.COD = IFF.COD_CCUSTO
                                       AND    CC.COD_EMPRESA = IFF.COD_EMPRESA)

          --sub centro de custo superior
          OR     EXISTS (SELECT 1
                             FROM   SUB_CCUSTO SC
                         WHERE  ((SC.MAT_SUBS = pmatricula AND    SC.COD_EMP_SUBS = v_cod_emp_aprovador) --pemp_req)
                                or (SC.MAT_GESTOR = pmatricula and SC.COD_EMP_GESTOR = v_cod_emp_aprovador)) --pemp_req))
                             --WHERE  SC.MAT_SUBS = pmatricula
                             --AND    SC.COD_EMP_SUBS = pemp_req
                             --AND    SC.MAT_GESTOR     = AF.MAT_APROV
                             --AND    SC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                             AND    SC.COD_SUB_CCUSTO = IFF.COD_SUB_CCUSTO
                             AND SC.COD_CCUSTO = (SELECT COD_CCUSTO_SUPERIOR
                                      FROM CENTRO_DE_CUSTO
                                      WHERE COD = IFF.COD_CCUSTO
                                      AND COD_EMPRESA = IFF.COD_EMPRESA)
                         AND    sC.COD_EMPRESA = IFF.COD_EMPRESA)

          --centro de custo superior
          OR     EXISTS (SELECT 1
                         FROM   CENTRO_DE_CUSTO CC
                         WHERE  ((CC.MATRICULA_SUPLENTE = pmatricula AND    CC.COD_EMP_SUPLENTE = v_cod_emp_aprovador) --pemp_req)
                                or (CC.MATRICULA_GESTOR = pmatricula and CC.COD_EMP_GESTOR = v_cod_emp_aprovador)) --pemp_req))
                         --AND    CC.MATRICULA_GESTOR = AF.MAT_APROV
                         --AND    CC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                         AND    CC.COD = --IFF.COD_CCUSTO
                              (SELECT COD_CCUSTO_SUPERIOR
                                      FROM CENTRO_DE_CUSTO
                                      WHERE COD = IFF.COD_CCUSTO
                                      AND COD_EMPRESA = IFF.COD_EMPRESA)
                         AND    CC.COD_EMPRESA = IFF.COD_EMPRESA)

                        OR     EXISTS (SELECT 1
                                      FROM   PE_REQ_TRATAMENTO_BATIMENTOS RF2
                                            ,INFORMACOES_FUNCIONAIS_CAD IFF2
                                            ,CENTRO_DE_CUSTO CC2
                                            ,CENTRO_DE_CUSTO CCS
                                      WHERE  CCS.MATRICULA_SUPLENTE = pmatricula
                                      AND    CCS.COD_EMP_SUPLENTE   = pemp_req
                                      AND    CCS.COD                = CC2.COD_CCUSTO_SUPERIOR
                                      AND    CCS.COD_EMPRESA        = CC2.COD_EMPRESA
                                      AND    CC2.MATRICULA_GESTOR   = RF2.MATRICULA
                                      AND    CC2.COD_EMP_GESTOR     = RF2.COD_EMPRESA
                                      AND    CC2.COD                = IFF2.COD_CCUSTO
                                      AND    CC2.COD_EMPRESA        = IFF2.COD_EMPRESA
                                      AND    IFF2.MATRICULA         = RF2.MATRICULA
                                      AND    IFF2.COD_EMPRESA       = RF2.COD_EMPRESA
                                      AND    RF2.COD_REQ    = pcod_req)
                                       )
                        AND    IFF.MATRICULA = RF.MATRICULA
                        AND    IFF.COD_EMPRESA = RF.COD_EMPRESA
                        AND    RF.COD_REQ = pcod_req)
                        --OR     (af.mat_aprov     = pmatricula
                        --AND    af.cod_emp_aprov = pemp_req)
                        )
                        AND    af.status_aprov = 'P'
                        --AND    af.cod_solicitacao  = pcod_req
                        --AND    af.cod_empresa   = pemp_req
                        )
                        );
        v_linhas := SQL%ROWCOUNT;
        --
        if v_linhas = 0 then
           begin
                update APROVA_ABONO aa
                   set status_aprov = pstatus, dt_aprov = sysdate, usuario = pusuario,
                      justificativa = pjustificativa
                 where 1=1
                 and exists (SELECT af.cod_empresa, af.mat_aprov
                                        FROM   APROVA_APURACAO af
                                        WHERE  (EXISTS (SELECT DISTINCT 1
                                        FROM   PE_REQ_APURACAO RF
                                              ,INFORMACOES_FUNCIONAIS_CAD IFF
                                  where 1=1
                                       OR EXISTS ( SELECT 1
                                                       FROM   SUB_CCUSTO SC
                                                       WHERE  SC.MAT_SUBS = pmatricula
                                                       AND    SC.COD_EMP_SUBS = pemp_req
                                                       AND    SC.MAT_GESTOR     = AF.MAT_APROV
                                                       AND    SC.COD_EMP_GESTOR = v_cod_emp_gestor
                                                       AND    SC.COD_SUB_CCUSTO = IFF.COD_SUB_CCUSTO
                                                       AND    SC.COD_CCUSTO     = IFF.COD_CCUSTO
                                                       AND    SC.COD_EMPRESA    = IFF.COD_EMPRESA)
                                        OR     EXISTS (SELECT 1
                                                       FROM   CENTRO_DE_CUSTO CC
                                                       WHERE  CC.MATRICULA_SUPLENTE = pmatricula
                                                       AND    CC.COD_EMP_SUPLENTE = pemp_req
                                                       AND    CC.MATRICULA_GESTOR = v_cod_emp_gestor --AF.MAT_APROV
                                                       AND    CC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                                                       AND    CC.COD = IFF.COD_CCUSTO
                                                       AND    CC.COD_EMPRESA = IFF.COD_EMPRESA) )  ) )
                 and aa.cod_solicitacao = pcod_req
                 and aa.cod_empresa =  pemp_req
                 and aa.status_aprov = 'P';

                 v_linhas := SQL%ROWCOUNT;
           exception
             when others then
               dbms_output.put_line(sqlerrm);
           end;
        end if;

        commit;

        end;
    ELSE
        begin
-- ACHAR O SUBSTITUTO E INCLUIR ABAIXO
            update APROVA_ABONO
               set status_aprov = pstatus
               , usuario = pusuario
               , dt_aprov = sysdate
               ,   justificativa = '('|| case when pstatus = 'A' THEN 'Aprovado'
                                             when pstatus = 'R' THEN 'Reprovado' end ||' por '||pusuario||') '||pjustificativa
             where cod_solicitacao = pcod_req
             and mat_aprov = pmatricula
               and (
               (cod_emp_aprov, mat_aprov) in (select U.cd_empresa, U.cd_matricula from usuario_oracle U where U.cd_Perfil = pPerfil)
                      or
                  ( (cod_emp_aprov, mat_aprov) IN (
                           SELECT af.cod_empresa, af.mat_aprov
                        FROM   APROVA_ABONO af
                        WHERE  (EXISTS (SELECT DISTINCT 1
                        FROM   PE_REQ_TRATAMENTO_BATIMENTOS RF
                              ,INFORMACOES_FUNCIONAIS_CAD IFF
                        WHERE  (EXISTS (SELECT 1
                                       FROM   SUB_CCUSTO SC
                                       WHERE  SC.MAT_SUBS = pmatricula
                                       AND    SC.COD_EMP_SUBS = pemp_req
                                       AND    SC.MAT_GESTOR     = AF.MAT_APROV
                                       AND    SC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                                       AND    SC.COD_SUB_CCUSTO = IFF.COD_SUB_CCUSTO
                                       AND    SC.COD_CCUSTO     = IFF.COD_CCUSTO
                                       AND    SC.COD_EMPRESA    = IFF.COD_EMPRESA)
                        OR     EXISTS (SELECT 1
                                       FROM   CENTRO_DE_CUSTO CC
                                       WHERE  CC.MATRICULA_SUPLENTE = pmatricula
                                       AND    CC.COD_EMP_SUPLENTE = pemp_req
                                       AND    CC.MATRICULA_GESTOR = AF.MAT_APROV
                                       AND    CC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                                       AND    CC.COD = IFF.COD_CCUSTO
                                       AND    CC.COD_EMPRESA = IFF.COD_EMPRESA)
          --superior
          OR     EXISTS (SELECT 1
                         FROM   CENTRO_DE_CUSTO CC
                         WHERE  CC.MATRICULA_SUPLENTE = pmatricula
                         AND    CC.COD_EMP_SUPLENTE = pemp_req
                         AND    CC.MATRICULA_GESTOR = AF.MAT_APROV
                         AND    CC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                         AND    CC.COD = --IFF.COD_CCUSTO
                              (SELECT COD_CCUSTO_SUPERIOR FROM CENTRO_DE_CUSTO WHERE COD = IFF.COD_CCUSTO AND COD_EMPRESA = IFF.COD_EMPRESA)
                         AND    CC.COD_EMPRESA = IFF.COD_EMPRESA)

                        OR     EXISTS (SELECT 1
                                      FROM   REQUISICAO_FERIAS RF2
                                            ,INFORMACOES_FUNCIONAIS_CAD IFF2
                                            ,CENTRO_DE_CUSTO CC2
                                            ,CENTRO_DE_CUSTO CCS
                                      WHERE  CCS.MATRICULA_SUPLENTE = pmatricula
                                      AND    CCS.COD_EMP_SUPLENTE   = pemp_req
                                      AND    CCS.COD                = CC2.COD_CCUSTO_SUPERIOR
                                      AND    CCS.COD_EMPRESA        = CC2.COD_EMPRESA
                                      AND    CC2.MATRICULA_GESTOR   = RF2.MATRICULA
                                      AND    CC2.COD_EMP_GESTOR     = RF2.COD_EMPRESA
                                      AND    CC2.COD                = IFF2.COD_CCUSTO
                                      AND    CC2.COD_EMPRESA        = IFF2.COD_EMPRESA
                                      AND    IFF2.MATRICULA         = RF2.MATRICULA
                                      AND    IFF2.COD_EMPRESA       = RF2.COD_EMPRESA
                                      AND    RF2.COD_SOLICITACAO    = pcod_req)
                                       )
                        AND    IFF.MATRICULA = RF.MATRICULA
                        AND    IFF.COD_EMPRESA = RF.COD_EMPRESA
                        AND    RF.COD_REQ = pcod_req)
                        OR     (af.mat_aprov     = pmatricula
                        AND    af.cod_emp_aprov = pemp_req))
                        AND    af.status_aprov = 'P'
                        AND    af.cod_solicitacao  = pcod_req
                        AND    af.cod_empresa   = pemp_req
                        ) ) );

        commit;

        end;
    END IF;

    PKG_pe_abono.Post_Update(pemp_req,
                             pcod_req,
                             V_flg_retorno,
                             V_msg_retorno);

    pflg_retorno := nvl(v_flg_retorno,'S'); -- Incluso verificação do flg_retorno Cibele 06/07/2020
    pmsg_retorno := v_msg_retorno;

    if nvl(pflg_retorno,'S') <> 'S' then -- Incluso verificação do flg_retorno Cibele 06/07/2020
      raise vsaida_erro;
    end if;

  exception -- Incluso verificação do flg_retorno Cibele 06/07/2020
    when vsaida_erro then
      null;
    when others then
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Aprovacao_Coletiva.Req_Abono Erro: '||sqlerrm;
  end req_abono;

  procedure req_he (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2) is

  v_flg_retorno varchar2(3);
  v_msg_retorno varchar2(4000);

  begin

      open c_perfil_aprov(pperfil);
      fetch c_perfil_aprov into v_perfil_aprov;
      close c_perfil_aprov;

    IF v_perfil_aprov.perfil is null then
      --IF pperfil not in ('REMUNERACAO','BUSINESS PARTNER','CONT DE NEGOCIOS','TST','EST','EST_CHEFE','ADM','FIS','ERGO') THEN
        begin
            update APROVA_HORA_EXTRA
               set status_aprov = pstatus, dt_aprov = sysdate, usuario = pusuario,
                  justificativa = pjustificativa
             where cod_empresa = pemp_req
               and cod_solicitacao = pcod_req
               and cod_emp_aprov = pcod_empresa
               and mat_aprov = pmatricula;

        commit;

        end;
    ELSE
        begin

            update APROVA_HORA_EXTRA
               set status_aprov = pstatus
               , usuario = pusuario
               , dt_aprov = sysdate
               ,  justificativa = '('|| case when pstatus = 'A' THEN 'Aprovado'
                                             when pstatus = 'R' THEN 'Reprovado' end ||' por '||pusuario||') '||pjustificativa
             where cod_solicitacao = pcod_req
               and (cod_emp_aprov, mat_aprov) in (select U.cd_empresa, U.cd_matricula from usuario_oracle U where U.cd_Perfil = pPerfil);

        commit;

        end;
    END IF;

    PKG_req_he.Post_Update(pemp_req,
                             pcod_req,
                             V_flg_retorno,
                             V_msg_retorno);

    pflg_retorno := nvl(v_flg_retorno,'S'); -- Incluso verificação do flg_retorno Cibele 06/07/2020
    pmsg_retorno := v_msg_retorno;

    if nvl(pflg_retorno,'S') <> 'S' then -- Incluso verificação do flg_retorno Cibele 06/07/2020
      raise vsaida_erro;
    end if;

  exception -- Incluso verificação do flg_retorno Cibele 06/07/2020
    when vsaida_erro then
      null;
    when others then
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Aprovacao_Coletiva.Req_HE Erro: '||sqlerrm;
  end req_he;

  procedure req_beneficio (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2) is

  v_flg_retorno varchar2(3);
  v_msg_retorno varchar2(4000);

  begin

      open c_perfil_aprov(pperfil);
      fetch c_perfil_aprov into v_perfil_aprov;
      close c_perfil_aprov;

    IF v_perfil_aprov.perfil is null then
      --IF pperfil not in ('REMUNERACAO','BUSINESS PARTNER','CONT DE NEGOCIOS','TST','EST','EST_CHEFE','ADM','FIS','ERGO') THEN
        begin
            update APROVA_BENEFICIOS
               set status_aprov = pstatus, dt_aprov = sysdate, usuario = pusuario, justificativa = pjustificativa
             where cod_empresa = pemp_req
               and cod_solicitacao = pcod_req
               and cod_emp_aprov = pcod_empresa
               and mat_aprov = pmatricula;

        commit;

        end;
    ELSE
        begin

            update APROVA_BENEFICIOS
               set status_aprov = pstatus
               , usuario = pusuario
               , dt_aprov = sysdate
               ,  justificativa = '('|| case when pstatus = 'A' THEN 'Aprovado'
                                             when pstatus = 'R' THEN 'Reprovado' end ||' por '||pusuario||') '||pjustificativa
             where cod_solicitacao = pcod_req
               and (cod_emp_aprov, mat_aprov) in (select U.cd_empresa, U.cd_matricula from usuario_oracle U where U.cd_Perfil = pPerfil);

        commit;

        end;
    END IF;

    PKG_req_beneficio.Post_Update(pemp_req,
                             pcod_req,
                             V_flg_retorno,
                             V_msg_retorno);

    pflg_retorno := nvl(v_flg_retorno,'S'); -- Incluso verificação do flg_retorno Cibele 06/07/2020
    pmsg_retorno := v_msg_retorno;

    if nvl(pflg_retorno,'S') <> 'S' then -- Incluso verificação do flg_retorno Cibele 06/07/2020
      raise vsaida_erro;
    end if;

  exception -- Incluso verificação do flg_retorno Cibele 06/07/2020
    when vsaida_erro then
      null;
    when others then
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Aprovacao_Coletiva.Req_Beneficio Erro: '||sqlerrm;
  end req_beneficio;

  procedure req_beneficio_cand (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2) is

  v_flg_retorno varchar2(3);
  v_msg_retorno varchar2(4000);

  begin

      open c_perfil_aprov(pperfil);
      fetch c_perfil_aprov into v_perfil_aprov;
      close c_perfil_aprov;

    IF v_perfil_aprov.perfil is null then
      --IF pperfil not in ('REMUNERACAO','BUSINESS PARTNER','CONT DE NEGOCIOS','TST','EST','EST_CHEFE','ADM','FIS','ERGO') THEN
        begin
            update APROVA_BENEFICIOS_CANDIDATO
               set status_aprov = pstatus, dt_aprov = sysdate, usuario = pusuario,
                  justificativa = pjustificativa
             where cod_empresa = pemp_req
               and cod_solicitacao = pcod_req
               and cod_emp_aprov = pcod_empresa
               and mat_aprov = pmatricula;

        commit;

        end;
    ELSE
        begin

            update APROVA_BENEFICIOS_CANDIDATO
               set status_aprov = pstatus
               , usuario = pusuario
               , dt_aprov = sysdate
               ,   justificativa = '('|| case when pstatus = 'A' THEN 'Aprovado'
                                             when pstatus = 'R' THEN 'Reprovado' end ||' por '||pusuario||') '||pjustificativa
             where cod_solicitacao = pcod_req
               and (cod_emp_aprov, mat_aprov) in (select U.cd_empresa, U.cd_matricula from usuario_oracle U where U.cd_Perfil = pPerfil);

        commit;

        end;
    END IF;

    PKG_req_beneficio_cand.Post_Update(pemp_req,
                             pcod_req,
                             V_flg_retorno,
                             V_msg_retorno);

    pflg_retorno := nvl(v_flg_retorno,'S'); -- Incluso verificação do flg_retorno Cibele 06/07/2020
    pmsg_retorno := v_msg_retorno;

    if nvl(pflg_retorno,'S') <> 'S' then -- Incluso verificação do flg_retorno Cibele 06/07/2020
      raise vsaida_erro;
    end if;

  exception -- Incluso verificação do flg_retorno Cibele 06/07/2020
    when vsaida_erro then
      null;
    when others then
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Aprovacao_Coletiva.Req_Beneficio_Cand Erro: '||sqlerrm;
  end req_beneficio_cand;

  procedure req_beneficiaria (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2) is

  v_flg_retorno varchar2(3);
  v_msg_retorno varchar2(4000);

  begin

      open c_perfil_aprov(pperfil);
      fetch c_perfil_aprov into v_perfil_aprov;
      close c_perfil_aprov;

    IF v_perfil_aprov.perfil is null then
      --IF pperfil not in ('REMUNERACAO','BUSINESS PARTNER','CONT DE NEGOCIOS','TST','EST','EST_CHEFE','ADM','FIS','ERGO') THEN
        begin
            update aprova_req_beneficiaria
               set status_aprov = pstatus, dt_aprov = sysdate, usuario = pusuario,
                  justificativa = pjustificativa
             where cod_empresa = pemp_req
               and cod_req = pcod_req
               and cod_emp_aprov = pcod_empresa
               and mat_aprov = pmatricula;

        commit;

        end;
    ELSE
        begin

            update aprova_req_beneficiaria
               set status_aprov = pstatus
               , usuario = pusuario
               , dt_aprov = sysdate
               ,   justificativa = '('|| case when pstatus = 'A' THEN 'Aprovado'
                                             when pstatus = 'R' THEN 'Reprovado' end ||' por '||pusuario||') '||pjustificativa
             where cod_req = pcod_req
               and (cod_emp_aprov, mat_aprov) in (select U.cd_empresa, U.cd_matricula from usuario_oracle U where U.cd_Perfil = pPerfil);

        commit;

        end;
    END IF;

    pkg_req_beneficiaria.Post_Update(pemp_req,
                             pcod_req,
                             V_flg_retorno,
                             V_msg_retorno);

    pflg_retorno := nvl(v_flg_retorno,'S'); -- Incluso verificação do flg_retorno Cibele 06/07/2020
    pmsg_retorno := v_msg_retorno;

    if nvl(pflg_retorno,'S') <> 'S' then -- Incluso verificação do flg_retorno Cibele 06/07/2020
      raise vsaida_erro;
    end if;

  exception -- Incluso verificação do flg_retorno Cibele 06/07/2020
    when vsaida_erro then
      null;
    when others then
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Aprovacao_Coletiva.Req_Beneficiaria Erro: '||sqlerrm;
  end req_beneficiaria;
 /*
  procedure req_ocorr (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2) is

  v_flg_retorno varchar2(3);
  v_msg_retorno varchar2(4000);

  begin

      open c_perfil_aprov(pperfil);
      fetch c_perfil_aprov into v_perfil_aprov;
      close c_perfil_aprov;

    IF v_perfil_aprov.perfil is null then
      -- IF pperfil not in ('REMUNERACAO','BUSINESS PARTNER','CONT DE NEGOCIOS','TST','EST','EST_CHEFE','ADM','FIS','ERGO') THEN
        begin
            update aprova_req_ocorr
               set status_aprov = pstatus, dt_aprov = sysdate, usuario = pusuario,
                  justificativa = pjustificativa
             where cod_empresa = pemp_req
               and cod_req = pcod_req
               and cod_emp_aprov = pcod_empresa
               and mat_aprov = pmatricula;

        commit;

        end;
    ELSE
        begin

            update aprova_req_ocorr
               set status_aprov = pstatus, usuario = pusuario, dt_aprov = sysdate,
                  justificativa = pjustificativa
             where cod_req = pcod_req
               and (cod_emp_aprov, mat_aprov) in (select U.cd_empresa, U.cd_matricula from usuario_oracle U where U.cd_Perfil = pPerfil);

        commit;

        end;
    END IF;

  --  pkg_req_beneficiaria.Post_Update(pemp_req,
  --                           pcod_req,
  --                           V_flg_retorno,
  --                           V_msg_retorno);

  end req_ocorr;

procedure req_lanc_ponto (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2) is

  v_flg_retorno varchar2(3);
  v_msg_retorno varchar2(4000);

  begin

      open c_perfil_aprov(pperfil);
      fetch c_perfil_aprov into v_perfil_aprov;
      close c_perfil_aprov;

    IF v_perfil_aprov.perfil is null then
      --IF pperfil not in ('REMUNERACAO','BUSINESS PARTNER','CONT DE NEGOCIOS','TST','EST','EST_CHEFE','ADM','FIS','ERGO') THEN
        begin
            update APROVA_REQ_LANC_PONTO
               set status_aprov = pstatus, dt_aprov = sysdate, usuario = pusuario,
                  justificativa = pjustificativa
             where cod_empresa = pemp_req
               and cod_req = pcod_req
               and cod_emp_aprov = pcod_empresa
               and mat_aprov = pmatricula;

        commit;

        end;
    ELSE
        begin

            update APROVA_REQ_LANC_PONTO
               set status_aprov = pstatus, usuario = pusuario, dt_aprov = sysdate,
                  justificativa = pjustificativa
             where cod_req = pcod_req
               and (cod_emp_aprov, mat_aprov) in (select U.cd_empresa, U.cd_matricula from usuario_oracle U where U.cd_Perfil = pPerfil);

        commit;

        end;
    END IF;

    pkg_req_lanc_evento_ponto.Post_Update(pemp_req,
                             pcod_req,
                             V_flg_retorno,
                             V_msg_retorno);

  end req_lanc_ponto;
*/

procedure req_exame (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2) is

  v_flg_retorno varchar2(3);
  v_msg_retorno varchar2(4000);

  begin

      open c_perfil_aprov(pperfil);
      fetch c_perfil_aprov into v_perfil_aprov;
      close c_perfil_aprov;

    IF v_perfil_aprov.perfil is null then

        begin
            update APROVA_EXAMES
               set status_aprov = pstatus, dt_aprov = sysdate, usuario = pusuario,
                  justificativa = pjustificativa
             where cod_empresa = pemp_req
               and cod_req = pcod_req
               and cod_emp_aprov = pcod_empresa
               and mat_aprov = pmatricula;

        commit;

        end;
    ELSE
        begin

            update APROVA_EXAMES
               set status_aprov = pstatus
               , usuario = pusuario
               , dt_aprov = sysdate
               ,   justificativa = '('|| case when pstatus = 'A' THEN 'Aprovado'
                                             when pstatus = 'R' THEN 'Reprovado' end ||' por '||pusuario||') '||pjustificativa
             where cod_req = pcod_req
               and (cod_emp_aprov, mat_aprov) in (select U.cd_empresa, U.cd_matricula from usuario_oracle U where U.cd_Perfil = pPerfil);

        commit;

        end;
    END IF;

    pkg_solicitacao_exames.Post_Update(
                             pcod_req,
                             pemp_req,
                             pusuario,
                             V_flg_retorno,
                             V_msg_retorno);

    pflg_retorno := nvl(v_flg_retorno,'S'); -- Incluso verificação do flg_retorno Cibele 06/07/2020
    pmsg_retorno := v_msg_retorno;

    if nvl(pflg_retorno,'S') <> 'S' then -- Incluso verificação do flg_retorno Cibele 06/07/2020
      raise vsaida_erro;
    end if;

  exception -- Incluso verificação do flg_retorno Cibele 06/07/2020
    when vsaida_erro then
      null;
    when others then
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Aprovacao_Coletiva.Req_Exame Erro: '||sqlerrm;
  end req_exame;

procedure req_treinamento (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2) is

  v_flg_retorno varchar2(3);
  v_msg_retorno varchar2(4000);

  procedure prc_treinamento_aprova (pcod_req number,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2) is
      --
      CURSOR c1 IS
        SELECT 'X'
          FROM tr_aprova_requisicao
         WHERE cod_requisicao = pcod_req
           AND status_aprov <> 'A';

      r1 c1%ROWTYPE;


     cursor c_aprovadores is
         SELECT count (*) total
          FROM tr_aprova_requisicao
         WHERE cod_requisicao = pcod_req;

     v_aprovadores c_aprovadores%rowtype;

     cursor c_aprovados is
         SELECT count (*) total
          FROM tr_aprova_requisicao
         WHERE cod_requisicao = pcod_req
           AND status_aprov = 'A';

     v_aprovados c_aprovados%rowtype;

     SAIDA EXCEPTION;

     cursor c_req is
     select *
       from tr_requisicoes
      where cod_requisicao = pcod_req;

     v_req c_req%rowtype;

    v_cancelada VARCHAR2(1);

    v_flg_retorno varchar2(3);
    v_msg_retorno varchar2(4000);

    BEGIN

      OPEN c_aprovadores;
      FETCH c_aprovadores INTO v_aprovadores;
      CLOSE c_aprovadores;

      OPEN c_aprovados;
      FETCH c_aprovados INTO v_aprovados;
      CLOSE c_aprovados;

      OPEN c1;
      FETCH c1 INTO r1;
      CLOSE C1;
      --
      IF NVL(v_aprovados.total,0) = NVL(v_aprovadores.total,0) THEN
        --
        open c_req;
        fetch c_req into v_req;
        close c_req;


        BEGIN
          --
          INSERT INTO tr_turma_participantes
            (cod_turma, --1
             cod_empresa, --2
             matricula, --3
             situacao, --4
             data_situacao, --5
             cod_requisicao, --6
             tipo_origem, --7
             observacao, --8
             usuario, --9
             dt_atualizacao, --10
             cod_curso) --11
          VALUES
            (v_req.cod_turma, --1
             v_req.emp_solicitado, --2
             v_req.mat_solicitado, --3
             1, --4
             SYSDATE, --5
             v_req.cod_requisicao, --6
             v_req.tipo_origem, --7
             v_req.observacao, --8
             v_req.USUARIO, --9
             SYSDATE, --10
             v_req.cod_curso); --11
          --
          commit;
        EXCEPTION
          --
          WHEN OTHERS THEN
            --
            rollback;

            v_flg_retorno := 'N';
            v_msg_retorno := '1 - Erro na inserção TR_TURMA_PARTICIPANTES: '||sqlerrm;
            RAISE SAIDA;
            --
        END;

        --
        UPDATE tr_requisicoes
           SET situacao = 2, dt_atualizacao = sysdate
         WHERE cod_requisicao = pcod_req;
        --
        commit;
      END IF;
      --

      BEGIN
        --
        SELECT 'X'
          INTO v_cancelada
          FROM tr_aprova_requisicao
         WHERE cod_requisicao = pcod_req
           AND status_aprov = 'R'
           AND ROWNUM = 1;

        --
        UPDATE tr_requisicoes
           SET situacao = 4, dt_atualizacao = sysdate
         WHERE cod_requisicao = pcod_req;

         commit;
        --
      EXCEPTION
        --
        WHEN NO_DATA_FOUND THEN
          --
          NULL;
          --
        WHEN OTHERS THEN
          --
          rollback;
            v_flg_retorno := 'N';
            v_msg_retorno := '2 - Erro na inserção TR_TURMA_PARTICIPANTES: '||sqlerrm;
            RAISE SAIDA;
          --
      END;
      --
      commit;

    EXCEPTION
      --
      WHEN SAIDA THEN
        --
        pflg_retorno := v_flg_retorno;
        pmsg_retorno := v_msg_retorno;
        rollback;
        NULL;
        --
      WHEN OTHERS THEN
        --
        rollback;
            v_flg_retorno := 'N';
            v_msg_retorno := '3 - Erro na inserção TR_TURMA_PARTICIPANTES: '||sqlerrm;
            pflg_retorno := v_flg_retorno;
            pmsg_retorno := v_msg_retorno;
        --
  end prc_treinamento_aprova;


  begin

      open c_perfil_aprov(pperfil);
      fetch c_perfil_aprov into v_perfil_aprov;
      close c_perfil_aprov;

    IF v_perfil_aprov.perfil is null then

        begin
            update TR_APROVA_REQUISICAO
               set status_aprov = pstatus, dt_aprov = sysdate, usuario = pusuario,
                  justificativa = pjustificativa
             where cod_requisicao = pcod_req
               and empresa_aprov = pcod_empresa
               and matricula_aprov = pmatricula;

        commit;

        end;
    ELSE
        begin

            update TR_APROVA_REQUISICAO
               set status_aprov = pstatus
               , usuario = pusuario
               , dt_aprov = sysdate
               ,   justificativa = '('|| case when pstatus = 'A' THEN 'Aprovado'
                                             when pstatus = 'R' THEN 'Reprovado' end ||' por '||pusuario||') '||pjustificativa
             where cod_requisicao = pcod_req
               and (empresa_aprov, matricula_aprov) in (select U.cd_empresa, U.cd_matricula from usuario_oracle U where U.cd_Perfil = pPerfil);

        commit;

        end;
    END IF;

    prc_treinamento_aprova (pcod_req,
                    v_flg_retorno,
                    v_msg_retorno);

    pflg_retorno := nvl(v_flg_retorno,'S'); -- Incluso verificação do flg_retorno Cibele 06/07/2020
    pmsg_retorno := v_msg_retorno;

    if nvl(pflg_retorno,'S') <> 'S' then -- Incluso verificação do flg_retorno Cibele 06/07/2020
      raise vsaida_erro;
    end if;

  exception -- Incluso verificação do flg_retorno Cibele 06/07/2020
    when vsaida_erro then
      null;
    when others then
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Aprovacao_Coletiva.Req_Treinamento Erro: '||sqlerrm;
  end req_treinamento;

procedure req_treinamento_cursos (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2) is

  v_flg_retorno varchar2(3);
  v_msg_retorno varchar2(4000);

  v_cod_curso  TR_REQUISICOES_CURSOS.cod_curso%type;

  procedure prc_treinamento_curso_aprova (pcod_req number,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2) is
      --
      CURSOR c1 IS
        SELECT 'X'
          FROM TR_APROVA_REQUISICAO_CURSO
         WHERE cod_requisicao = pcod_req
           AND status_aprov <> 'A';

      r1 c1%ROWTYPE;

     cursor c_aprovadores is
         SELECT count (*) total
          FROM TR_APROVA_REQUISICAO_CURSO
         WHERE cod_requisicao = pcod_req;

     v_aprovadores c_aprovadores%rowtype;

     cursor c_aprovados is
         SELECT count (*) total
          FROM TR_APROVA_REQUISICAO_CURSO
         WHERE cod_requisicao = pcod_req
           AND status_aprov = 'A';

     v_aprovados c_aprovados%rowtype;

     SAIDA EXCEPTION;

     cursor c_req is
     select *
       from TR_REQUISICOES_CURSOS
      where cod_requisicao = pcod_req;

     v_req c_req%rowtype;

    v_cancelada VARCHAR2(1);

    v_flg_retorno varchar2(3);
    v_msg_retorno varchar2(4000);

    BEGIN

      OPEN c_aprovadores;
      FETCH c_aprovadores INTO v_aprovadores;
      CLOSE c_aprovadores;

      OPEN c_aprovados;
      FETCH c_aprovados INTO v_aprovados;
      CLOSE c_aprovados;

      OPEN c1;
      FETCH c1 INTO r1;
      CLOSE C1;
      --
      IF NVL(v_aprovados.total,0) = NVL(v_aprovadores.total,0) THEN
        --
        open c_req;
        fetch c_req into v_req;
        close c_req;

        begin

        select max(cod_curso)+1
          into v_cod_curso
          from tr_cursos;


        insert into tr_cursos (cod_curso,
                               nome_curso,
                               cod_tipo,
                               observacao)
                       values (v_cod_curso,
                               v_req.nome_curso,
                               v_req.cod_tipo,
                               v_req.observacao);

         commit;

         update tr_requisicoes_cursos
            set cod_curso = v_cod_curso
          where cod_requisicao = v_req.cod_requisicao;


          commit;
        EXCEPTION
          --
          WHEN OTHERS THEN
            --
            rollback;

            v_flg_retorno := 'N';
            v_msg_retorno := '1 - Erro ao processar TR_REQUISICOES_CURSOS: '||sqlerrm;
            RAISE SAIDA;
            --
        END;

        --
        UPDATE tr_requisicoes_cursos
           SET situacao = 2, dt_atualizacao = sysdate
         WHERE cod_requisicao = pcod_req;
        --
        commit;
      END IF;
      --

      BEGIN
        --
        SELECT 'X'
          INTO v_cancelada
          FROM tr_aprova_requisicao_curso
         WHERE cod_requisicao = pcod_req
           AND status_aprov = 'R'
           AND ROWNUM = 1;

        --
        UPDATE tr_requisicoes_cursos
           SET situacao = 4, dt_atualizacao = sysdate
         WHERE cod_requisicao = pcod_req;

         commit;
        --
      EXCEPTION
        --
        WHEN NO_DATA_FOUND THEN
          --
          NULL;
          --
        WHEN OTHERS THEN
          --
          rollback;
            v_flg_retorno := 'N';
            v_msg_retorno := '2 - Erro ao processar TR_REQUISICOES_CURSOS: '||sqlerrm;
            RAISE SAIDA;
          --
      END;
      --
      commit;

    EXCEPTION
      --
      WHEN SAIDA THEN
        --
        pflg_retorno := v_flg_retorno;
        pmsg_retorno := v_msg_retorno;
        rollback;
        NULL;
        --
      WHEN OTHERS THEN
        --
        rollback;
            v_flg_retorno := 'N';
            v_msg_retorno := '3 - Erro ao processar TR_REQUISICOES_CURSOS: '||sqlerrm;
            pflg_retorno := v_flg_retorno;
            pmsg_retorno := v_msg_retorno;
        --
  end prc_treinamento_curso_aprova;


  begin

      open c_perfil_aprov(pperfil);
      fetch c_perfil_aprov into v_perfil_aprov;
      close c_perfil_aprov;

    IF v_perfil_aprov.perfil is null then

        begin
            update TR_APROVA_REQUISICAO_CURSO
               set status_aprov = pstatus, dt_aprov = sysdate, usuario = pusuario,
                  justificativa = pjustificativa
             where cod_requisicao = pcod_req
               and empresa_aprov = pcod_empresa
               and matricula_aprov = pmatricula;

        commit;

        end;
    ELSE
        begin

            update TR_APROVA_REQUISICAO_CURSO
               set status_aprov = pstatus
               , usuario = pusuario
               , dt_aprov = sysdate
               ,  justificativa = '('|| case when pstatus = 'A' THEN 'Aprovado'
                                             when pstatus = 'R' THEN 'Reprovado' end ||' por '||pusuario||') '||pjustificativa
             where cod_requisicao = pcod_req
               and (empresa_aprov, matricula_aprov) in (select U.cd_empresa, U.cd_matricula from usuario_oracle U where U.cd_Perfil = pPerfil);

        commit;

        end;
    END IF;

    prc_treinamento_curso_aprova (pcod_req,
                    v_flg_retorno,
                    v_msg_retorno);

    pflg_retorno := nvl(v_flg_retorno,'S'); -- Incluso verificação do flg_retorno Cibele 06/07/2020
    pmsg_retorno := v_msg_retorno;

    if nvl(pflg_retorno,'S') <> 'S' then -- Incluso verificação do flg_retorno Cibele 06/07/2020
      raise vsaida_erro;
    end if;

  exception -- Incluso verificação do flg_retorno Cibele 06/07/2020
    when vsaida_erro then
      null;
    when others then
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Aprovacao_Coletiva.Req_Treinamento_Curso Erro: '||sqlerrm;
  end req_treinamento_cursos;

  procedure req_ppp(pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2) is

  v_flg_retorno varchar2(3);
  v_msg_retorno varchar2(4000);

  begin


      open c_perfil_aprov(pperfil);
      fetch c_perfil_aprov into v_perfil_aprov;
      close c_perfil_aprov;

    IF v_perfil_aprov.perfil is null then
      --IF pperfil not in ('REMUNERACAO','BUSINESS PARTNER','CONT DE NEGOCIOS','TST','EST','EST_CHEFE','ADM','FIS','ERGO') THEN
        begin
            update APROVA_SOLICITACAO_PPP
               set status_aprov = pstatus, dt_aprov = sysdate, usuario = pusuario,
                  justificativa = pjustificativa
             where cod_empresa = pemp_req
               and cod_req = pcod_req
               and cod_emp_aprov = pcod_empresa
               and mat_aprov = pmatricula;

        commit;

        end;
    ELSE
        begin

            update APROVA_SOLICITACAO_PPP
               set status_aprov = pstatus
               , usuario = pusuario
               , dt_aprov = sysdate
               ,  justificativa = '('|| case when pstatus = 'A' THEN 'Aprovado'
                                             when pstatus = 'R' THEN 'Reprovado' end ||' por '||pusuario||') '||pjustificativa
             where cod_req = pcod_req
               and (cod_emp_aprov, mat_aprov) in (select U.cd_empresa, U.cd_matricula from usuario_oracle U where U.cd_Perfil = pPerfil);

        commit;

        end;
    END IF;

    PKG_req_ppp.Post_Update(pemp_req,
                             pcod_req,
                             V_flg_retorno,
                             V_msg_retorno);

    pflg_retorno := nvl(v_flg_retorno,'S'); -- Incluso verificação do flg_retorno Cibele 06/07/2020
    pmsg_retorno := v_msg_retorno;

    if nvl(pflg_retorno,'S') <> 'S' then -- Incluso verificação do flg_retorno Cibele 06/07/2020
      raise vsaida_erro;
    end if;

  exception -- Incluso verificação do flg_retorno Cibele 06/07/2020
    when vsaida_erro then
      null;
    when others then
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Aprovacao_Coletiva.Req_HE Erro: '||sqlerrm;
  end req_ppp;

procedure req_escala (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2) is

  v_flg_retorno varchar2(3);
  v_msg_retorno varchar2(4000);

  begin

      open c_perfil_aprov(pperfil);
      fetch c_perfil_aprov into v_perfil_aprov;
      close c_perfil_aprov;

    IF v_perfil_aprov.perfil is null then

        begin
            update APROVA_ESCALA
               set status_aprov = pstatus, dt_aprov = sysdate, usuario = pusuario,
                  justificativa = pjustificativa
             where cod_empresa = pemp_req
               and cod_req = pcod_req
               and cod_emp_aprov = pcod_empresa
               and mat_aprov = pmatricula;

        commit;

        end;
    ELSE
        begin

            update APROVA_ESCALA
               set status_aprov = pstatus
               , usuario = pusuario
               , dt_aprov = sysdate
               ,  justificativa = '('|| case when pstatus = 'A' THEN 'Aprovado'
                                             when pstatus = 'R' THEN 'Reprovado' end ||' por '||pusuario||') '||pjustificativa
             where cod_req = pcod_req
               and (cod_emp_aprov, mat_aprov) in (select U.cd_empresa, U.cd_matricula from usuario_oracle U where U.cd_Perfil = pPerfil);

        commit;

        end;
    END IF;

   pkg_req_escala.Post_Update(pemp_req,
                        pcod_req,
                        v_flg_retorno,
                        v_msg_retorno);

    pflg_retorno := nvl(v_flg_retorno,'S'); -- Incluso verificação do flg_retorno Cibele 06/07/2020
    pmsg_retorno := v_msg_retorno;

    if nvl(pflg_retorno,'S') <> 'S' then -- Incluso verificação do flg_retorno Cibele 06/07/2020
      raise vsaida_erro;
    end if;

  exception -- Incluso verificação do flg_retorno Cibele 06/07/2020
    when vsaida_erro then
      null;
    when others then
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Aprovacao_Coletiva.Req_Escala Erro: '||sqlerrm;
  end req_escala;

procedure req_atestado (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2) is

  v_flg_retorno varchar2(3);
  v_msg_retorno varchar2(4000);

  begin

      open c_perfil_aprov(pperfil);
      fetch c_perfil_aprov into v_perfil_aprov;
      close c_perfil_aprov;

    IF v_perfil_aprov.perfil is null then

        begin
            update APROVA_ATESTADO
               set status_aprov = pstatus, dt_aprov = sysdate, usuario = pusuario,
                  justificativa = pjustificativa
             where cod_empresa = pemp_req
               and cod_solicitacao = pcod_req
               and cod_emp_aprov = pcod_empresa
               and mat_aprov = pmatricula;

        commit;

        end;
    ELSE
        begin

            update APROVA_ATESTADO
               set status_aprov = pstatus
               , usuario = pusuario
               , dt_aprov = sysdate
               ,  justificativa = '('|| case when pstatus = 'A' THEN 'Aprovado'
                                             when pstatus = 'R' THEN 'Reprovado' end ||' por '||pusuario||') '||pjustificativa
             where cod_solicitacao = pcod_req
               and (cod_emp_aprov, mat_aprov) in (select U.cd_empresa, U.cd_matricula from usuario_oracle U where U.cd_Perfil = pPerfil);

        commit;

        end;
    END IF;

   pkg_req_atestado.Post_Update(pemp_req,
                        pcod_req,
                        v_flg_retorno,
                        v_msg_retorno);

    pflg_retorno := nvl(v_flg_retorno,'S'); -- Incluso verificação do flg_retorno Cibele 06/07/2020
    pmsg_retorno := v_msg_retorno;

    if nvl(pflg_retorno,'S') <> 'S' then -- Incluso verificação do flg_retorno Cibele 06/07/2020
      raise vsaida_erro;
    end if;

  exception -- Incluso verificação do flg_retorno Cibele 06/07/2020
    when vsaida_erro then
      null;
    when others then
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Aprovacao_Coletiva.Req_Atestado Erro: '||sqlerrm;
  end req_atestado;

procedure req_cat (pcod_req number,
                    pemp_req number,
                    pstatus varchar2,
                    pcod_empresa number,
                    pmatricula number,
                    pusuario varchar2,
                    pperfil varchar2,
                    pjustificativa varchar2,
                    pflg_retorno out varchar2,
                    pmsg_retorno out varchar2) is

  v_flg_retorno varchar2(3);
  v_msg_retorno varchar2(4000);

  begin

      open c_perfil_aprov(pperfil);
      fetch c_perfil_aprov into v_perfil_aprov;
      close c_perfil_aprov;

    IF v_perfil_aprov.perfil is null then

        begin
            update APROVA_CAT
               set status_aprov = pstatus, dt_aprov = sysdate, usuario = pusuario,
                  justificativa = pjustificativa
             where cod_empresa = pemp_req
               and cod_req = pcod_req
               and cod_emp_aprov = pcod_empresa
               and mat_aprov = pmatricula;

        commit;

        end;
    ELSE
        begin

            update APROVA_CAT
               set status_aprov = pstatus, usuario = pusuario, dt_aprov = sysdate,
                  justificativa = '('|| case when pstatus = 'A' THEN 'Aprovado'
                                             when pstatus = 'R' THEN 'Reprovado' end ||' por '||pusuario||') '||pjustificativa
             where cod_req = pcod_req
               and (cod_emp_aprov, mat_aprov) in (select U.cd_empresa, U.cd_matricula from usuario_oracle U where U.cd_Perfil = pPerfil);

        commit;

        end;
    END IF;

   pkg_req_analise_acidente.Post_Update(pemp_req,
                                        pcod_req,
                                        v_flg_retorno,
                                        v_msg_retorno);

    pflg_retorno := nvl(v_flg_retorno,'S'); -- Incluso verificação do flg_retorno Cibele 06/07/2020
    pmsg_retorno := v_msg_retorno;

    if nvl(pflg_retorno,'S') <> 'S' then -- Incluso verificação do flg_retorno Cibele 06/07/2020
      raise vsaida_erro;
    end if;

  exception -- Incluso verificação do flg_retorno Cibele 06/07/2020
    when vsaida_erro then
      null;
    when others then
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Aprovacao_Coletiva.Req_CAT Erro: '||sqlerrm;
  end req_cat;

  procedure req_apuracao (pcod_req number,
                       pemp_req number,
                       pstatus varchar2,
                       pcod_empresa number,
                       pmatricula number,
                       pusuario varchar2,
                       pperfil varchar2,
                       pjustificativa varchar2,
                       pflg_retorno out varchar2,
                       pmsg_retorno out varchar2) is

  v_flg_retorno varchar2(3);
  v_msg_retorno varchar2(4000);

  v_cod_emp_aprovador  empresas.cod%type;
  v_cod_emp_gestor     empresas.cod%type;
  v_matricula_suplente centro_de_custo.matricula_suplente%type;
  v_cod_ccusto         centro_de_custo.cod%type;  
  v_linhas            number := 0;
  
   cursor c_req is
      select distinct c.tipo_req tipo, c.empresa_req empresa, c.mat_aprov, c.mat_solicitado
       from consulta_requisicoes c
      where c.solicitacao = pcod_req;
   v_req  c_req%ROWTYPE;  
  begin
     
   open c_req;
   fetch c_req into v_req;
   close c_req;
   
   open c_perfil_aprov(pperfil);
   fetch c_perfil_aprov into v_perfil_aprov;
   close c_perfil_aprov;
   --
   begin
      select cod_emp_aprov
         into  v_cod_emp_gestor
       from APROVA_APURACAO aa
       where cod_solicitacao = pcod_req
       and status_aprov = 'P';
    exception
      when others then
           v_cod_emp_gestor := pemp_req;
    end;
    v_cod_emp_aprovador := v_cod_emp_gestor;
    --
    /*
    begin
      select nvl(apex_util.get_session_state('P_EMPRESA_USER'), 0)
               into v_cod_emp_aprovador
      from dual;
    exception
      when others then
           v_cod_emp_aprovador := pemp_req;
    end;*/
    --
    if v_perfil_aprov.perfil is null then
      --IF pperfil not in ('REMUNERACAO','BUSINESS PARTNER','CONT DE NEGOCIOS','TST','EST','EST_CHEFE','ADM','FIS','ERGO') THEN
        begin
            update APROVA_APURACAO a
               set status_aprov = pstatus, dt_aprov = sysdate, usuario = pusuario,
                  justificativa = pjustificativa
             where cod_empresa = pemp_req
               and cod_solicitacao = pcod_req
               and cod_emp_aprov = pcod_empresa
               and a.status_aprov = 'P'
               and mat_aprov = pmatricula
               or (cod_solicitacao = pcod_req
                and (cod_emp_aprov, mat_aprov) IN (
                           SELECT af.cod_empresa, af.mat_aprov
                        FROM   APROVA_APURACAO af
                        WHERE  (EXISTS (SELECT DISTINCT 1
                        FROM   PE_REQ_APURACAO RF
                              ,INFORMACOES_FUNCIONAIS_CAD IFF
                        WHERE  (EXISTS (SELECT 1
                                       FROM   SUB_CCUSTO SC
                                       WHERE  SC.MAT_SUBS = pmatricula
                                       AND    SC.COD_EMP_SUBS = v_cod_emp_aprovador --pemp_req
                                       AND    SC.MAT_GESTOR     = AF.MAT_APROV
                                       AND    SC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                                       AND    SC.COD_SUB_CCUSTO = IFF.COD_SUB_CCUSTO
                                       AND    SC.COD_CCUSTO     = IFF.COD_CCUSTO
                                       AND    SC.COD_EMPRESA    = IFF.COD_EMPRESA)
                        OR     EXISTS (SELECT 1
                                       FROM   CENTRO_DE_CUSTO CC
                                       WHERE  CC.MATRICULA_SUPLENTE = pmatricula
                                       AND    CC.COD_EMP_SUPLENTE = v_cod_emp_aprovador --pemp_req
                                       AND    CC.MATRICULA_GESTOR = AF.MAT_APROV
                                       AND    CC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                                       AND    CC.COD = IFF.COD_CCUSTO
                                       AND    CC.COD_EMPRESA = IFF.COD_EMPRESA)
          --sub centro de custo superior
          OR     EXISTS (SELECT 1
                             FROM   SUB_CCUSTO SC
                         WHERE  ((SC.MAT_SUBS = pmatricula AND    SC.COD_EMP_SUBS = v_cod_emp_aprovador) --pemp_req)
                                or (SC.MAT_GESTOR = pmatricula and SC.COD_EMP_GESTOR = v_cod_emp_aprovador)) --pemp_req))
                             --WHERE  SC.MAT_SUBS = pmatricula
                             --AND    SC.COD_EMP_SUBS = pemp_req
                             --AND    SC.MAT_GESTOR     = AF.MAT_APROV
                             --AND    SC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                             AND    SC.COD_SUB_CCUSTO = IFF.COD_SUB_CCUSTO
                             AND SC.COD_CCUSTO = (SELECT COD_CCUSTO_SUPERIOR
                                      FROM CENTRO_DE_CUSTO
                                      WHERE COD = IFF.COD_CCUSTO
                                      AND COD_EMPRESA = IFF.COD_EMPRESA)
                         AND    SC.COD_EMPRESA = IFF.COD_EMPRESA)

          --centro de custo superior
          OR     EXISTS (SELECT 1
                         FROM   CENTRO_DE_CUSTO CC
                         WHERE  ((CC.MATRICULA_SUPLENTE = pmatricula AND    CC.COD_EMP_SUPLENTE = v_cod_emp_aprovador) --pemp_req)
                                or (CC.MATRICULA_GESTOR = pmatricula and CC.COD_EMP_GESTOR = v_cod_emp_aprovador)) --pemp_req))
                         --AND    CC.MATRICULA_GESTOR = AF.MAT_APROV
                         --AND    CC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                         AND    CC.COD = --IFF.COD_CCUSTO
                              (SELECT COD_CCUSTO_SUPERIOR
                                      FROM CENTRO_DE_CUSTO
                                      WHERE COD = IFF.COD_CCUSTO
                                      AND COD_EMPRESA = IFF.COD_EMPRESA)
                         AND    CC.COD_EMPRESA = IFF.COD_EMPRESA)

                        OR     EXISTS (SELECT 1
                                      FROM   PE_REQ_TRATAMENTO_BATIMENTOS RF2
                                            ,INFORMACOES_FUNCIONAIS_CAD IFF2
                                            ,CENTRO_DE_CUSTO CC2
                                            ,CENTRO_DE_CUSTO CCS
                                      WHERE  CCS.MATRICULA_SUPLENTE = pmatricula
                                      AND    CCS.COD_EMP_SUPLENTE   = pemp_req
                                      AND    CCS.COD                = CC2.COD_CCUSTO_SUPERIOR
                                      AND    CCS.COD_EMPRESA        = CC2.COD_EMPRESA
                                      AND    CC2.MATRICULA_GESTOR   = RF2.MATRICULA
                                      AND    CC2.COD_EMP_GESTOR     = RF2.COD_EMPRESA
                                      AND    CC2.COD                = IFF2.COD_CCUSTO
                                      AND    CC2.COD_EMPRESA        = IFF2.COD_EMPRESA
                                      AND    IFF2.MATRICULA         = RF2.MATRICULA
                                      AND    IFF2.COD_EMPRESA       = RF2.COD_EMPRESA
                                      AND    RF2.COD_REQ    = pcod_req)
                                       )
                        AND    IFF.MATRICULA = RF.MATRICULA
                        AND    IFF.COD_EMPRESA = RF.COD_EMPRESA
                        AND    RF.COD_REQ = pcod_req)
                        --OR     (af.mat_aprov     = pmatricula
                        --AND    af.cod_emp_aprov = pemp_req)
                        )
                        AND    af.status_aprov = 'P'
                        --AND    af.cod_solicitacao  = pcod_req
                        --AND    af.cod_empresa   = pemp_req
                        )
                        );

        v_linhas := SQL%ROWCOUNT;
        --
        if v_linhas = 0 then
           begin
                update APROVA_APURACAO aa
                   set status_aprov = pstatus, dt_aprov = sysdate, usuario = pusuario,
                      justificativa = pjustificativa
                 where  exists (SELECT af.cod_empresa, af.mat_aprov
                                        FROM   APROVA_APURACAO af
                                        WHERE  (EXISTS (SELECT DISTINCT 1
                                        FROM   PE_REQ_APURACAO RF
                                              ,INFORMACOES_FUNCIONAIS_CAD IFF
                                  where 1=1
                                       OR EXISTS ( SELECT 1
                                                       FROM   SUB_CCUSTO SC
                                                       WHERE  SC.MAT_SUBS = pmatricula
                                                       AND    SC.COD_EMP_SUBS = pemp_req
                                                       AND    SC.MAT_GESTOR     = AF.MAT_APROV
                                                       AND    SC.COD_EMP_GESTOR = v_cod_emp_gestor
                                                       AND    SC.COD_SUB_CCUSTO = IFF.COD_SUB_CCUSTO
                                                       AND    SC.COD_CCUSTO     = IFF.COD_CCUSTO
                                                       AND    SC.COD_EMPRESA    = IFF.COD_EMPRESA)
                                        OR     EXISTS (SELECT 1
                                                       FROM   CENTRO_DE_CUSTO CC
                                                       WHERE  CC.MATRICULA_SUPLENTE = pmatricula
                                                       AND    CC.COD_EMP_SUPLENTE = pemp_req
                                                       AND    CC.MATRICULA_GESTOR = v_cod_emp_gestor --AF.MAT_APROV
                                                       AND    CC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                                                       AND    CC.COD = IFF.COD_CCUSTO
                                                       AND    CC.COD_EMPRESA = IFF.COD_EMPRESA) )  ) )
                 and aa.cod_solicitacao = pcod_req
                 and aa.cod_empresa =  pemp_req
                 and aa.status_aprov = 'P'
                 ;

                 v_linhas := SQL%ROWCOUNT;
           exception
             when others then
               dbms_output.put_line(sqlerrm);
           end;
        end if;

        commit;
        end;
    ELSE

        begin
-- ACHAR O SUBSTITUTO E INCLUIR ABAIXO
            update APROVA_APURACAO
               set status_aprov = pstatus
               , usuario = pusuario
               , dt_aprov = sysdate
               ,   justificativa = '('|| case when pstatus = 'A' THEN 'Aprovado'
                                             when pstatus = 'R' THEN 'Reprovado' end ||' por '||pusuario||') '||pjustificativa
             where cod_solicitacao = pcod_req
             and mat_aprov = pmatricula
               and (
               (cod_emp_aprov, mat_aprov) in 
                               (select U.cd_empresa, U.cd_matricula 
                               from usuario_oracle U 
                               where U.cd_Perfil = pPerfil
                               and (cd_empresa = pemp_req or cd_empresa = 1))
                      or
                  ( (cod_emp_aprov, mat_aprov) IN (
                           SELECT af.cod_empresa, af.mat_aprov
                        FROM   APROVA_APURACAO af
                        WHERE  (EXISTS (SELECT DISTINCT 1
                        FROM   PE_REQ_APURACAO RF
                              ,INFORMACOES_FUNCIONAIS_CAD IFF
                        WHERE  (EXISTS (SELECT 1
                                       FROM   SUB_CCUSTO SC
                                       WHERE  SC.MAT_SUBS = pmatricula
                                       AND    SC.COD_EMP_SUBS = pemp_req
                                       AND    SC.MAT_GESTOR     = AF.MAT_APROV
                                       AND    SC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                                       AND    SC.COD_SUB_CCUSTO = IFF.COD_SUB_CCUSTO
                                       AND    SC.COD_CCUSTO     = IFF.COD_CCUSTO
                                       AND    SC.COD_EMPRESA    = IFF.COD_EMPRESA)
                        OR     EXISTS (SELECT 1
                                       FROM   CENTRO_DE_CUSTO CC
                                       WHERE  CC.MATRICULA_SUPLENTE = pmatricula
                                       AND    (CC.COD_EMP_SUPLENTE = pemp_req or CC.COD_EMP_SUPLENTE = 1)
                                       AND    CC.MATRICULA_GESTOR = AF.MAT_APROV
                                       AND    CC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                                       AND    CC.COD = IFF.COD_CCUSTO
                                       AND    CC.COD_EMPRESA = IFF.COD_EMPRESA)
          --superior
          OR     EXISTS (SELECT 1
                         FROM   CENTRO_DE_CUSTO CC
                         WHERE  CC.MATRICULA_SUPLENTE = pmatricula
                         AND    (CC.COD_EMP_SUPLENTE = pemp_req or CC.COD_EMP_SUPLENTE = 1)
                         AND    CC.MATRICULA_GESTOR = AF.MAT_APROV
                         AND    CC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                         AND    CC.COD = --IFF.COD_CCUSTO
                              (SELECT COD_CCUSTO_SUPERIOR FROM CENTRO_DE_CUSTO WHERE COD = IFF.COD_CCUSTO AND COD_EMPRESA = IFF.COD_EMPRESA)
                         AND    CC.COD_EMPRESA = IFF.COD_EMPRESA)

                        OR     EXISTS (SELECT 1
                                      FROM   REQUISICAO_FERIAS RF2
                                            ,INFORMACOES_FUNCIONAIS_CAD IFF2
                                            ,CENTRO_DE_CUSTO CC2
                                            ,CENTRO_DE_CUSTO CCS
                                      WHERE  CCS.MATRICULA_SUPLENTE = pmatricula
                                      AND    (CCS.COD_EMP_SUPLENTE   = pemp_req or CCS.COD_EMP_SUPLENTE   = 1)
                                      AND    CCS.COD                = CC2.COD_CCUSTO_SUPERIOR
                                      AND    CCS.COD_EMPRESA        = CC2.COD_EMPRESA
                                      AND    CC2.MATRICULA_GESTOR   = RF2.MATRICULA
                                      AND    CC2.COD_EMP_GESTOR     = RF2.COD_EMPRESA
                                      AND    CC2.COD                = IFF2.COD_CCUSTO
                                      AND    CC2.COD_EMPRESA        = IFF2.COD_EMPRESA
                                      AND    IFF2.MATRICULA         = RF2.MATRICULA
                                      AND    IFF2.COD_EMPRESA       = RF2.COD_EMPRESA
                                      AND    RF2.COD_SOLICITACAO    = pcod_req)
                                       )
                        AND    IFF.MATRICULA = RF.MATRICULA
                        AND    IFF.COD_EMPRESA = RF.COD_EMPRESA
                        AND    RF.COD_REQ = pcod_req)
                        OR     (af.mat_aprov     = pmatricula
                        AND    af.cod_emp_aprov = pemp_req))
                        AND    af.status_aprov = 'P'
                        AND    af.cod_solicitacao  = pcod_req
                        AND    af.cod_empresa   = pemp_req
                        ) ) );
        v_linhas := SQL%ROWCOUNT;

        if v_linhas = 0 then
           if v_req.mat_aprov != pmatricula then
              -- recupera centro de custo do colaborador
              begin 
                 select cod_ccusto
                 into v_cod_ccusto
                   from informacoes_funcionais 
                   where matricula = v_req.mat_solicitado  
                   and cod_empresa = pemp_req;
              exception
                 when others then
                     v_cod_ccusto := null;      
              end;
              if v_cod_ccusto is not null then
                 -- recupera o suplente
                 begin
                    select matricula_suplente 
                      into v_matricula_suplente
                    from centro_de_custo 
                    where cod = v_cod_ccusto and cod_empresa = pemp_req;
                 end;
                 -- aprova se suplente igual matricula do parametro
                 if pmatricula = v_matricula_suplente then
                     update APROVA_APURACAO
                        set status_aprov = pstatus
                        , usuario = pusuario
                        , dt_aprov = sysdate
                        ,   justificativa = '('|| case when pstatus = 'A' THEN 'Aprovado'
                                                      when pstatus = 'R' THEN 'Reprovado' end ||' por '||pusuario||') '||pjustificativa
                      where cod_solicitacao = pcod_req
                      and cod_empresa = pemp_req
                      and status_aprov = 'P';
                      v_linhas := SQL%ROWCOUNT;
                 end if;
              end if;
           end if;         
        end if;
        end;
    END IF;

    PKG_REQ_APURACAO.Post_Update(pemp_req,
                             pcod_req,
                             V_flg_retorno,
                             V_msg_retorno);

    pflg_retorno := nvl(v_flg_retorno,'S'); -- Incluso verificação do flg_retorno Cibele 06/07/2020
    pmsg_retorno := v_msg_retorno;

    if nvl(pflg_retorno,'S') <> 'S' then -- Incluso verificação do flg_retorno Cibele 06/07/2020
      raise vsaida_erro;
    end if;

  exception -- Incluso verificação do flg_retorno Cibele 06/07/2020
    when vsaida_erro then
      null;
    when others then
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Aprovacao_Coletiva.Req_Apuracao Erro: '||sqlerrm;
  end req_apuracao;

  procedure req_reembolso (pcod_req number,
                       pemp_req number,
                       pstatus varchar2,
                       pcod_empresa number,
                       pmatricula number,
                       pusuario varchar2,
                       pperfil varchar2,
                       pjustificativa varchar2,
                       pflg_retorno out varchar2,
                       pmsg_retorno out varchar2) is
  v_flg_retorno varchar2(3);
  v_msg_retorno varchar2(4000);

  v_cod_emp_aprovador empresas.cod%type;
  v_cod_emp_gestor    empresas.cod%type;

  v_linhas            number := 0;
  begin
   open c_perfil_aprov(pperfil);
   fetch c_perfil_aprov into v_perfil_aprov;
   close c_perfil_aprov;
   --
   begin
      select cod_emp_aprov
         into  v_cod_emp_gestor
       from APROVA_REEMBOLSO aa
       where COD_REQ = pcod_req
       and status_aprov = 'P';
    exception
      when others then
           v_cod_emp_gestor := pemp_req;
    end;
    --
    begin
      select nvl(apex_util.get_session_state('P_EMPRESA_USER'), 0)
               into v_cod_emp_aprovador
      from dual;
    exception
      when others then
           v_cod_emp_aprovador := pemp_req;
    end;
    --
    if v_perfil_aprov.perfil is null then
      --IF pperfil not in ('REMUNERACAO','BUSINESS PARTNER','CONT DE NEGOCIOS','TST','EST','EST_CHEFE','ADM','FIS','ERGO') THEN
        begin
            update APROVA_REEMBOLSO
               set status_aprov = pstatus, dt_aprov = sysdate, usuario = pusuario,
                  justificativa = pjustificativa
             where cod_empresa = pemp_req
               and cod_req = pcod_req
               and cod_emp_aprov = pcod_empresa
               and cod_mat_aprov = pmatricula
               or (cod_req = pcod_req
                and (cod_emp_aprov, COD_MAT_APROV) IN (
                           SELECT af.cod_empresa, af.cod_mat_aprov
                        FROM   APROVA_REEMBOLSO af
                        WHERE  (EXISTS (SELECT DISTINCT 1
                        FROM   REQ_REEMBOLSO RF
                              ,INFORMACOES_FUNCIONAIS_CAD IFF
                        WHERE  (EXISTS (SELECT 1
                                       FROM   SUB_CCUSTO SC
                                       WHERE  SC.MAT_SUBS = pmatricula
                                       AND    SC.COD_EMP_SUBS = v_cod_emp_aprovador --pemp_req
                                       AND    SC.MAT_GESTOR     = AF.COD_MAT_APROV
                                       AND    SC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                                       AND    SC.COD_SUB_CCUSTO = IFF.COD_SUB_CCUSTO
                                       AND    SC.COD_CCUSTO     = IFF.COD_CCUSTO
                                       AND    SC.COD_EMPRESA    = IFF.COD_EMPRESA)
                        OR     EXISTS (SELECT 1
                                       FROM   CENTRO_DE_CUSTO CC
                                       WHERE  CC.MATRICULA_SUPLENTE = pmatricula
                                       AND    CC.COD_EMP_SUPLENTE = v_cod_emp_aprovador --pemp_req
                                       AND    CC.MATRICULA_GESTOR = AF.COD_MAT_APROV
                                       AND    CC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                                       AND    CC.COD = IFF.COD_CCUSTO
                                       AND    CC.COD_EMPRESA = IFF.COD_EMPRESA)
          --sub centro de custo superior
          OR     EXISTS (SELECT 1
                             FROM   SUB_CCUSTO SC
                         WHERE  ((SC.MAT_SUBS = pmatricula AND    SC.COD_EMP_SUBS = v_cod_emp_aprovador) --pemp_req)
                                or (SC.MAT_GESTOR = pmatricula and SC.COD_EMP_GESTOR = v_cod_emp_aprovador)) --pemp_req))
                             --WHERE  SC.MAT_SUBS = pmatricula
                             --AND    SC.COD_EMP_SUBS = pemp_req
                             --AND    SC.MAT_GESTOR     = AF.MAT_APROV
                             --AND    SC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                             AND    SC.COD_SUB_CCUSTO = IFF.COD_SUB_CCUSTO
                             AND SC.COD_CCUSTO = (SELECT COD_CCUSTO_SUPERIOR
                                      FROM CENTRO_DE_CUSTO
                                      WHERE COD = IFF.COD_CCUSTO
                                      AND COD_EMPRESA = IFF.COD_EMPRESA)
                         AND    SC.COD_EMPRESA = IFF.COD_EMPRESA)

          --centro de custo superior
          OR     EXISTS (SELECT 1
                         FROM   CENTRO_DE_CUSTO CC
                         WHERE  ((CC.MATRICULA_SUPLENTE = pmatricula AND    CC.COD_EMP_SUPLENTE = v_cod_emp_aprovador) --pemp_req)
                                or (CC.MATRICULA_GESTOR = pmatricula and CC.COD_EMP_GESTOR = v_cod_emp_aprovador)) --pemp_req))
                         --AND    CC.MATRICULA_GESTOR = AF.MAT_APROV
                         --AND    CC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                         AND    CC.COD = --IFF.COD_CCUSTO
                              (SELECT COD_CCUSTO_SUPERIOR
                                      FROM CENTRO_DE_CUSTO
                                      WHERE COD = IFF.COD_CCUSTO
                                      AND COD_EMPRESA = IFF.COD_EMPRESA)
                         AND    CC.COD_EMPRESA = IFF.COD_EMPRESA)

                        OR     EXISTS (SELECT 1
                                      FROM   REQ_REEMBOLSO RF2
                                            ,INFORMACOES_FUNCIONAIS_CAD IFF2
                                            ,CENTRO_DE_CUSTO CC2
                                            ,CENTRO_DE_CUSTO CCS
                                      WHERE  CCS.MATRICULA_SUPLENTE = pmatricula
                                      AND    CCS.COD_EMP_SUPLENTE   = pemp_req
                                      AND    CCS.COD                = CC2.COD_CCUSTO_SUPERIOR
                                      AND    CCS.COD_EMPRESA        = CC2.COD_EMPRESA
                                      AND    CC2.MATRICULA_GESTOR   = RF2.MATRICULA
                                      AND    CC2.COD_EMP_GESTOR     = RF2.COD_EMPRESA
                                      AND    CC2.COD                = IFF2.COD_CCUSTO
                                      AND    CC2.COD_EMPRESA        = IFF2.COD_EMPRESA
                                      AND    IFF2.MATRICULA         = RF2.MATRICULA
                                      AND    IFF2.COD_EMPRESA       = RF2.COD_EMPRESA
                                      AND    RF2.COD_REQ    = pcod_req)
                                       )
                        AND    IFF.MATRICULA = RF.MATRICULA
                        AND    IFF.COD_EMPRESA = RF.COD_EMPRESA
                        AND    RF.COD_REQ = pcod_req)
                        --OR     (af.mat_aprov     = pmatricula
                        --AND    af.cod_emp_aprov = pemp_req)
                        )
                        AND    af.status_aprov = 'P'
                        --AND    af.cod_solicitacao  = pcod_req
                        --AND    af.cod_empresa   = pemp_req
                        )
                        );

        v_linhas := SQL%ROWCOUNT;
        --
        if v_linhas = 0 then
           begin
                update APROVA_REEMBOLSO aa
                   set status_aprov = pstatus, dt_aprov = sysdate, usuario = pusuario,
                      justificativa = pjustificativa
                 where  exists (SELECT af.cod_empresa, af.cod_mat_aprov
                                        FROM   APROVA_REEMBOLSO af
                                        WHERE  (EXISTS (SELECT DISTINCT 1
                                        FROM   REQ_REEMBOLSO RF
                                              ,INFORMACOES_FUNCIONAIS_CAD IFF
                                  where 1=1
                                       OR EXISTS ( SELECT 1
                                                       FROM   SUB_CCUSTO SC
                                                       WHERE  SC.MAT_SUBS = pmatricula
                                                       AND    SC.COD_EMP_SUBS = pemp_req
                                                       AND    SC.MAT_GESTOR     = AF.COD_MAT_APROV
                                                       AND    SC.COD_EMP_GESTOR = v_cod_emp_gestor
                                                       AND    SC.COD_SUB_CCUSTO = IFF.COD_SUB_CCUSTO
                                                       AND    SC.COD_CCUSTO     = IFF.COD_CCUSTO
                                                       AND    SC.COD_EMPRESA    = IFF.COD_EMPRESA)
                                        OR     EXISTS (SELECT 1
                                                       FROM   CENTRO_DE_CUSTO CC
                                                       WHERE  CC.MATRICULA_SUPLENTE = pmatricula
                                                       AND    CC.COD_EMP_SUPLENTE = pemp_req
                                                       AND    CC.MATRICULA_GESTOR = v_cod_emp_gestor --AF.MAT_APROV
                                                       AND    CC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                                                       AND    CC.COD = IFF.COD_CCUSTO
                                                       AND    CC.COD_EMPRESA = IFF.COD_EMPRESA) )  ) )
                 and aa.cod_req = pcod_req
                 and aa.cod_empresa =  pemp_req
                 and aa.status_aprov = 'P'
                 ;

                 v_linhas := SQL%ROWCOUNT;
           exception
             when others then
               dbms_output.put_line(sqlerrm);
           end;
        end if;

        commit;
        end;
    ELSE
        begin
-- ACHAR O SUBSTITUTO E INCLUIR ABAIXO
            update APROVA_REEMBOLSO
               set status_aprov = pstatus
               , usuario = pusuario
               , dt_aprov = sysdate
               ,   justificativa = '('|| case when pstatus = 'A' THEN 'Aprovado'
                                             when pstatus = 'R' THEN 'Reprovado' end ||' por '||pusuario||') '||pjustificativa
             where cod_req = pcod_req
             and cod_mat_aprov = pmatricula
               and (
               (cod_emp_aprov, cod_mat_aprov) in (select U.cd_empresa, U.cd_matricula from usuario_oracle U where U.cd_Perfil = pPerfil)
                      or
                  ( (cod_emp_aprov, cod_mat_aprov) IN (
                           SELECT af.cod_empresa, af.cod_mat_aprov
                        FROM   APROVA_REEMBOLSO af
                        WHERE  (EXISTS (SELECT DISTINCT 1
                        FROM   REQ_REEMBOLSO RF
                              ,INFORMACOES_FUNCIONAIS_CAD IFF
                        WHERE  (EXISTS (SELECT 1
                                       FROM   SUB_CCUSTO SC
                                       WHERE  SC.MAT_SUBS = pmatricula
                                       AND    SC.COD_EMP_SUBS = pemp_req
                                       AND    SC.MAT_GESTOR     = AF.COD_MAT_APROV
                                       AND    SC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                                       AND    SC.COD_SUB_CCUSTO = IFF.COD_SUB_CCUSTO
                                       AND    SC.COD_CCUSTO     = IFF.COD_CCUSTO
                                       AND    SC.COD_EMPRESA    = IFF.COD_EMPRESA)
                        OR     EXISTS (SELECT 1
                                       FROM   CENTRO_DE_CUSTO CC
                                       WHERE  CC.MATRICULA_SUPLENTE = pmatricula
                                       AND    CC.COD_EMP_SUPLENTE = pemp_req
                                       AND    CC.MATRICULA_GESTOR = AF.COD_MAT_APROV
                                       AND    CC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                                       AND    CC.COD = IFF.COD_CCUSTO
                                       AND    CC.COD_EMPRESA = IFF.COD_EMPRESA)
          --superior
          OR     EXISTS (SELECT 1
                         FROM   CENTRO_DE_CUSTO CC
                         WHERE  CC.MATRICULA_SUPLENTE = pmatricula
                         AND    CC.COD_EMP_SUPLENTE = pemp_req
                         AND    CC.MATRICULA_GESTOR = AF.COD_MAT_APROV
                         AND    CC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                         AND    CC.COD = --IFF.COD_CCUSTO
                              (SELECT COD_CCUSTO_SUPERIOR FROM CENTRO_DE_CUSTO WHERE COD = IFF.COD_CCUSTO AND COD_EMPRESA = IFF.COD_EMPRESA)
                         AND    CC.COD_EMPRESA = IFF.COD_EMPRESA)

                        OR     EXISTS (SELECT 1
                                      FROM   REQ_REEMBOLSO RF2
                                            ,INFORMACOES_FUNCIONAIS_CAD IFF2
                                            ,CENTRO_DE_CUSTO CC2
                                            ,CENTRO_DE_CUSTO CCS
                                      WHERE  CCS.MATRICULA_SUPLENTE = pmatricula
                                      AND    CCS.COD_EMP_SUPLENTE   = pemp_req
                                      AND    CCS.COD                = CC2.COD_CCUSTO_SUPERIOR
                                      AND    CCS.COD_EMPRESA        = CC2.COD_EMPRESA
                                      AND    CC2.MATRICULA_GESTOR   = RF2.MATRICULA
                                      AND    CC2.COD_EMP_GESTOR     = RF2.COD_EMPRESA
                                      AND    CC2.COD                = IFF2.COD_CCUSTO
                                      AND    CC2.COD_EMPRESA        = IFF2.COD_EMPRESA
                                      AND    IFF2.MATRICULA         = RF2.MATRICULA
                                      AND    IFF2.COD_EMPRESA       = RF2.COD_EMPRESA
                                      AND    RF2.COD_REQ    = pcod_req)
                                       )
                        AND    IFF.MATRICULA = RF.MATRICULA
                        AND    IFF.COD_EMPRESA = RF.COD_EMPRESA
                        AND    RF.COD_REQ = pcod_req)
                        OR     (af.cod_mat_aprov     = pmatricula
                        AND    af.cod_emp_aprov = pemp_req))
                        AND    af.status_aprov = 'P'
                        AND    af.cod_req  = pcod_req
                        AND    af.cod_empresa   = pemp_req
                        ) ) );

        commit;

        end;
    END IF;

    PKG_REQ_REEMBOLSO.Post_Update(pemp_req,
                             pcod_req,
                             V_flg_retorno,
                             V_msg_retorno);

    pflg_retorno := nvl(v_flg_retorno,'S'); -- Incluso verificação do flg_retorno Cibele 06/07/2020
    pmsg_retorno := v_msg_retorno;

    if nvl(pflg_retorno,'S') <> 'S' then -- Incluso verificação do flg_retorno Cibele 06/07/2020
      raise vsaida_erro;
    end if;
  exception -- Incluso verificação do flg_retorno Cibele 06/07/2020
    when vsaida_erro then
      null;
    when others then
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Aprovacao_Coletiva.Req_Apuracao Erro: '||sqlerrm;
  end req_reembolso;


end pkg_aprovacao_coletiva;
/