CREATE OR REPLACE PACKAGE NATCORP.Pkg_Ferias IS
  --Versão 101 - 28/04/2026 - Bruno Sousa
  vexiste     VARCHAR2(1);
  vsaida_erro EXCEPTION;

  --Bruno Sousa 03/01/2024
  vcod_empresa number;
  vmatricula   number;
  vvinculo     varchar2(2);
  --
  --  usuario := substr(nvl(usuario.busca_user,colaborador.busca_empresa||'/'||colaborador.busca_matricula),1,30)
  --
  --
  PROCEDURE INSERE_LOG_CALCULO(P_COD_EMPRESA        NUMBER,
                               P_COD_PROCESSO_PAGTO VARCHAR2,
                               P_DATA_REF_PROC      DATE,
                               P_OPCAO              NUMBER,
                               P_INTERVALO_DE       NUMBER,
                               P_INTERVALO_ATE      NUMBER,
                               P_INTERVALO_DT_DE    DATE,
                               P_INTERVALO_DT_ATE   DATE,
                               P_EMPRESA_DE         NUMBER,
                               P_EMPRESA_ATE        NUMBER,
                               P_FILIAL_DE          NUMBER,
                               P_FILIAL_ATE         NUMBER,
                               P_SINDICATO_DE       NUMBER,
                               P_SINDICATO_ATE      NUMBER,
                               P_DT_INICIO          DATE,
                               P_DT_FIM             DATE,
                               P_USUARIO            VARCHAR2,
                               P_DT_ATUALIZACAO     DATE);
  --
  FUNCTION VERIF_LIMITE_AGEND_FERIAS(PCOD_EMPRESA NUMBER,
                                     PDT_REQ      DATE,
                                     PDT_SAIDA    DATE) RETURN DATE;
  --
  FUNCTION VALIDA_DSR_JORNADA(PCOD_EMPRESA   NUMBER,
                              PMATRICULA     NUMBER,
                              PDT_SAIDA_PARC IN DATE,
                              PDSR_JORNADA   IN OUT VARCHAR2,
                              PMSG_RETORNO   IN OUT VARCHAR2) RETURN BOOLEAN;
  --
  FUNCTION VALIDA_DT_SAIDA(PCOD_EMPRESA   NUMBER,
                           PMATRICULA     NUMBER,
                           PDT_SAIDA_PARC IN OUT DATE,
                           PMSG_RETORNO   IN OUT VARCHAR2) RETURN VARCHAR2;
  --
  FUNCTION DATA_SAIDA_PARC_VALIDA(PDT_SAIDA_PARC DATE,
                                  PCOD_EMPRESA   NUMBER,
                                  PFILIAL        NUMBER,
                                  PMATRICULA     NUMBER,
                                  PFLG_RETORNO   IN OUT VARCHAR2,
                                  PMSG_RETORNO   IN OUT VARCHAR2)
    RETURN VARCHAR2;
  --
  PROCEDURE PRC_USUARIO_FERIAS_APEX(TIPO                NUMBER,
                                    PCOD_EMPRESA        NUMBER,
                                    PMATRICULA          NUMBER,
                                    PDT_INIC_PER_FERIAS DATE,
                                    PDT_FIM_PER_FERIAS  DATE,
                                    PFLG_RETORNO        IN OUT VARCHAR2,
                                    PMSG_RETORNO        IN OUT VARCHAR2,
                                    PUSUARIO            VARCHAR2 DEFAULT NULL);
  --
  FUNCTION funcFeriasParamParcela_APEX(pEmp    IN NUMBER,
                                       pFilial IN NUMBER,
                                       pParc1  IN NUMBER, -- num_dias_parc1
                                       pParc2  IN NUMBER, -- num_dias_parc2
                                       pParc3  IN NUMBER -- num_dias_parc4
                                       ) RETURN BOOLEAN;
  --
  FUNCTION PERMISSAO_CANC_REQ_CONCLUIDA(PSOLICITACAO    NUMBER,
                                        PCOD_EMPRESA    NUMBER,
                                        PMATRICULA      NUMBER,
                                        PUSUARIO_LOGADO VARCHAR2)
    RETURN VARCHAR2;
  --
  PROCEDURE EXCLUI_PARCELAS(PSOLICITACAO      NUMBER,
                            PUSUARIO          VARCHAR2,
                            PFLG_RETORNO      OUT VARCHAR2,
                            PMSG_RETORNO      OUT VARCHAR2,
                            PVOLTA_STATUS_REQ VARCHAR2 DEFAULT 'S');
  --
  FUNCTION existe_p1(psolicitacao        requisicao_ferias.cod_solicitacao%TYPE DEFAULT NULL -- somente passar se o cód. solicitação for ref. à P1 (1a parcela de férias)
                    ,
                     pcod_empresa        requisicao_ferias.cod_empresa%TYPE DEFAULT NULL,
                     pmatricula          requisicao_ferias.matricula%TYPE DEFAULT NULL,
                     pdt_inic_per_ferias requisicao_ferias.dt_inic_per_ferias%TYPE DEFAULT NULL,
                     pdt_fim_per_ferias  requisicao_ferias.dt_fim_per_ferias%TYPE DEFAULT NULL)
    RETURN BOOLEAN;
  --
  -- Essa procedure deve ser chamada sempre que houver tentativa de alteração dos campos referentes
  PROCEDURE proc_verifica(pcod_empresa          EMPRESAS.cod%TYPE,
                          pmatricula            INF_PESSOAIS.matricula%TYPE,
                          pind_duplo_vinculo    VARCHAR2,
                          pind_situacao_periodo FERIAS.ind_situacao_periodo%TYPE,
                          pdt_saida_parc1       FERIAS.dt_saida_parc1%TYPE,
                          pdt_retorno_parc1     FERIAS.dt_retorno_parc1%TYPE,
                          pdt_saida_parc2       FERIAS.dt_saida_parc2%TYPE,
                          pdt_retorno_parc2     FERIAS.dt_retorno_parc2%TYPE,
                          pflg_retorno          IN OUT VARCHAR2,
                          pmsg_retorno          IN OUT VARCHAR2);
  -- Adaptação do processo da F013303 Cibele 19/06/2019
  PROCEDURE Vld_Ferias_Dobro(pCod_Empresa        empresas.cod%TYPE,
                             pMatricula          inf_pessoais.matricula%TYPE,
                             pdt_saida           ferias.dt_saida_parc1%TYPE,
                             pflg_retorno        IN OUT VARCHAR2,
                             pmsg_retorno        IN OUT VARCHAR2,
                             pdt_inic_per_ferias FERIAS.dt_inic_per_ferias%TYPE DEFAULT NULL);
  --
  FUNCTION Valida_Prazo_Programacao(pcod_empresa          empresas.cod%TYPE,
                                    pdt_saida_parc        DATE,
                                    pmsg_erro_prog_ferias IN OUT VARCHAR2)
    RETURN BOOLEAN;
  -- Essa procedure pode retornar um aviso
  PROCEDURE Valida_Inicio_Tela1(pcod_empresa EMPRESAS.cod%TYPE,
                                pmatricula   INF_PESSOAIS.matricula%TYPE,
                                pflg_retorno IN OUT VARCHAR2,
                                pmsg_retorno IN OUT VARCHAR2);
  --
  PROCEDURE Vld_Duplic_Req_Ferias(pcod_empresa        EMPRESAS.cod%TYPE,
                                  pmatricula          INF_PESSOAIS.matricula%TYPE,
                                  pdt_saida_parc1     FERIAS.dt_saida_parc1%TYPE,
                                  pdt_saida_parc2     FERIAS.dt_saida_parc2%TYPE,
                                  pdt_saida_parc4     FERIAS.dt_saida_parc4%TYPE,
                                  pdt_inic_per_ferias FERIAS.dt_inic_per_ferias%TYPE,
                                  pdt_fim_per_ferias  FERIAS.dt_fim_per_ferias%TYPE,
                                  pnum_dias_parc1     REQUISICAO_FERIAS.num_dias_parc1%TYPE,
                                  popcao_13sal1       REQUISICAO_FERIAS.opcao_13sal1%TYPE,
                                  popcao_13sal2       REQUISICAO_FERIAS.opcao_13sal2%TYPE,
                                  popcao_13sal4       REQUISICAO_FERIAS.opcao_13sal4%TYPE,
                                  pflg_retorno        IN OUT VARCHAR2,
                                  pmsg_retorno        IN OUT VARCHAR2);
  --
  /*PROCEDURE Valida_Sit_Req(pcod_empresa EMPRESAS.cod%TYPE,
  psolicitacao consulta_requisicoes.solicitacao%TYPE,
  pmatricula   INF_PESSOAIS.matricula%TYPE,
  psit_req     REQUISICAO_FERIAS.sit_requisicao%TYPE,
  pflg_retorno OUT VARCHAR2,
  pmsg_retorno OUT VARCHAR2);*/
  --
  PROCEDURE Valida_Empresa_Solicitado(pcod_empresa EMPRESAS.cod%TYPE,
                                      pflg_retorno OUT VARCHAR2,
                                      pmsg_retorno OUT VARCHAR2);
  --
  PROCEDURE Valida_Matricula_Solicitado(pcod_empresa EMPRESAS.cod%TYPE,
                                        pmatricula   INF_PESSOAIS.matricula%TYPE,
                                        pflg_retorno OUT VARCHAR2,
                                        pmsg_retorno OUT VARCHAR2);
  --
  PROCEDURE Vld_Per_Meses(pcod_empresa        EMPRESAS.cod%TYPE,
                          pmatricula          INF_PESSOAIS.matricula%TYPE,
                          p_dt_saida          DATE,
                          pdt_inic_per_ferias FERIAS.dt_inic_per_ferias%TYPE,
                          pflg_retorno        OUT VARCHAR2,
                          pmsg_retorno        OUT VARCHAR2);
  --
  --
  -- Essa procedure é chamada pelas demais procedures de validação dessa package
  --
  PROCEDURE Lanc_Abono_P1(pcod_empresa       EMPRESAS.cod%TYPE,
                          pfilial            FILIAIS.cod_filial%TYPE,
                          pdt_saida_parc1    FERIAS.dt_saida_parc1%TYPE,
                          pdt_fim_per_ferias FERIAS.dt_fim_per_ferias%TYPE,
                          psaldo             NUMBER,
                          pdias_direito      NUMBER, -- Humberto/Izidoro 03/03/2016
                          -- pnum_dias_parc1  out number,
                          -- pdias_abono_pec1 out ferias.dias_abono_pec1%type,
                          pnum_dias_parc1_dsp  OUT VARCHAR2,
                          pdias_abono_pec1_dsp OUT VARCHAR2,
                          pflag                IN OUT VARCHAR2,
                          pflg_retorno         IN OUT VARCHAR2,
                          pmsg_retorno         IN OUT VARCHAR2);
  --
  PROCEDURE Vld_Saldo1(pcod_empresa         EMPRESAS.cod%TYPE,
                       pmatricula           INF_PESSOAIS.matricula%TYPE,
                       pfalta_hora          NUMBER,
                       pdt_fim_per_ferias   FERIAS.dt_fim_per_ferias%TYPE,
                       pjornada_reduzida    VARCHAR2,
                       pdias_direito        NUMBER,
                       psaldo_bruto         NUMBER,
                       ptipo_ferias1        IN OUT FERIAS.tipo_ferias1%TYPE,
                       pnum_dias_parc1      IN OUT NUMBER,
                       pdias_abono_pec1     IN OUT FERIAS.dias_abono_pec1%TYPE,
                       psaldo               IN OUT NUMBER,
                       pdias_abono_pec1_dsp OUT VARCHAR2,
                       pnum_dias_parc1_dsp  OUT VARCHAR2,
                       pflg_retorno         IN OUT VARCHAR2,
                       pmsg_retorno         IN OUT VARCHAR2);
  --
  PROCEDURE Vld_Num_Dias_Parc1(pcod_empresa              EMPRESAS.cod%TYPE,
                               pmatricula                INF_PESSOAIS.matricula%TYPE,
                               pind_limpa                VARCHAR2,
                               pnum_dias_parc1           NUMBER,
                               pdias_direito             NUMBER,
                               pdt_retorno_parc1         IN OUT FERIAS.dt_retorno_parc1%TYPE,
                               pdias_abono_pec1          IN OUT FERIAS.dias_abono_pec1%TYPE,
                               pdt_saida_parc1           IN OUT FERIAS.dt_saida_parc1%TYPE,
                               pdias_descanso_adicional  IN OUT FERIAS.dias_descanso_adicional%TYPE,
                               pdesc_adicional1          IN OUT FERIAS.desc_adicional1%TYPE,
                               ptipo_ferias1             OUT FERIAS.tipo_ferias1%TYPE,
                               pflg_retorno              OUT VARCHAR2,
                               pmsg_retorno              OUT VARCHAR2,
                               pcod_ferias_param_parcela ferias_parametros_parcelas.cod%TYPE DEFAULT 1);
  --
  PROCEDURE Dias_Parc1(pdt_saida_parc1    FERIAS.dt_saida_parc1%TYPE,
                       pdt_fim_per_ferias FERIAS.dt_fim_per_ferias%TYPE,
                       pnum_dias_parc1    NUMBER,
                       pdias_abono_pec1   IN OUT FERIAS.dias_abono_pec1%TYPE,
                       psaldo             NUMBER, -- :global.saldo (F012014_A)
                       pcod_empresa       empresas.cod%TYPE,
                       pmatricula         inf_pessoais.matricula%TYPE,
                       pjornada_reduzida  VARCHAR2,
                       pflg_retorno       OUT VARCHAR2,
                       pmsg_retorno       OUT VARCHAR2);
  --
  PROCEDURE Pre_Text_Dt_Saida_Parc1(pcod_empresa          EMPRESAS.cod%TYPE,
                                    pmatricula            INF_PESSOAIS.matricula%TYPE,
                                    pfalta_hora           NUMBER,
                                    pdt_fim_per_ferias    FERIAS.dt_fim_per_ferias%TYPE,
                                    pjornada_reduzida     VARCHAR2,
                                    pdias_direito         NUMBER,
                                    psaldo_bruto          NUMBER,
                                    ptipo_ferias1         IN OUT FERIAS.tipo_ferias1%TYPE,
                                    pnum_dias_parc1       IN OUT NUMBER,
                                    pdias_abono_pec1      IN OUT FERIAS.dias_abono_pec1%TYPE,
                                    psaldo                IN OUT NUMBER,
                                    pind_situacao_periodo FERIAS.ind_situacao_periodo%TYPE,
                                    pdias_abono_pec1_dsp  OUT VARCHAR2,
                                    pnum_dias_parc1_dsp   OUT VARCHAR2,
                                    pflg_retorno          IN OUT VARCHAR2,
                                    pmsg_retorno          IN OUT VARCHAR2);
  --
  PROCEDURE Valida_Sit_Requisicao(pcod_empresa    EMPRESAS.cod%TYPE,
                                  psolicitacao    REQUISICAO_FERIAS.cod_solicitacao%TYPE,
                                  pmatricula      INF_PESSOAIS.matricula%TYPE,
                                  psit_requisicao REQUISICAO_FERIAS.sit_requisicao%TYPE,
                                  pusuario_logado USUARIO_ORACLE.nm_usuario_oracle%TYPE,
                                  pflg_retorno    IN OUT VARCHAR2,
                                  pmsg_retorno    IN OUT VARCHAR2);
  --
  PROCEDURE Valida_Dt_Saida_Parc1(pcod_empresa          EMPRESAS.cod%TYPE,
                                  psolicitacao          REQUISICAO_FERIAS.cod_solicitacao%TYPE,
                                  pmatricula            INF_PESSOAIS.matricula%TYPE,
                                  pdt_inic_per_ferias   FERIAS.dt_inic_per_ferias%TYPE,
                                  pdt_fim_per_ferias    FERIAS.dt_fim_per_ferias%TYPE,
                                  pdt_saida_parc2       FERIAS.dt_saida_parc2%TYPE,
                                  psaldo_bruto          NUMBER,
                                  pfalta_hora           NUMBER,
                                  pdias_direito         IN OUT NUMBER,
                                  pdt_saida_parc1       IN OUT FERIAS.dt_saida_parc1%TYPE,
                                  psaldo                IN OUT NUMBER,
                                  pdias_abono_pec1      IN OUT FERIAS.dias_abono_pec1%TYPE,
                                  pnum_dias_parc1       IN OUT NUMBER,
                                  popcao_13sal1         IN OUT FERIAS.opcao_13sal1%TYPE,
                                  popcao_13sal2         IN OUT FERIAS.opcao_13sal2%TYPE,
                                  ptipo_ferias1         IN OUT FERIAS.tipo_ferias1%TYPE,
                                  pdt_retorno_parc1     IN OUT FERIAS.dt_retorno_parc1%TYPE,
                                  pdt_pagto_parc1       IN OUT FERIAS.dt_pagto_parc1%TYPE,
                                  pjornada_reduzida     IN OUT VARCHAR2,
                                  pind_situacao_periodo FERIAS.ind_situacao_periodo%TYPE,
                                  pdias_abono_pec1_dsp  OUT VARCHAR2,
                                  pnum_dias_parc1_dsp   OUT VARCHAR2,
                                  pflg_retorno          IN OUT VARCHAR2,
                                  pmsg_retorno          IN OUT VARCHAR2);
  --
  PROCEDURE Valida_Num_Dias_Parc1(pcod_empresa              EMPRESAS.cod%TYPE,
                                  pmatricula                INF_PESSOAIS.matricula%TYPE,
                                  pind_limpa                VARCHAR2,
                                  pdt_fim_per_ferias        FERIAS.dt_fim_per_ferias%TYPE,
                                  psaldo                    NUMBER,
                                  pdt_saida_parc1           IN OUT FERIAS.dt_saida_parc1%TYPE,
                                  pnum_dias_parc1           NUMBER,
                                  pdt_retorno_parc1         IN OUT FERIAS.dt_retorno_parc1%TYPE,
                                  pdias_descanso_adicional  IN OUT FERIAS.dias_descanso_adicional%TYPE,
                                  pdesc_adicional1          IN OUT FERIAS.desc_adicional1%TYPE,
                                  ptipo_ferias1             OUT FERIAS.tipo_ferias1%TYPE,
                                  pdias_abono_pec1          OUT NUMBER,
                                  pdias_direito             NUMBER,
                                  pind_situacao_periodo     FERIAS.ind_situacao_periodo%TYPE,
                                  pjornada_reduzida         VARCHAR2,
                                  pdias_abono_pec1_dsp      OUT VARCHAR2,
                                  pnum_dias_parc1_dsp       OUT VARCHAR2,
                                  pflg_retorno              OUT VARCHAR2,
                                  pmsg_retorno              OUT VARCHAR2,
                                  pcod_ferias_param_parcela ferias_parametros_parcelas.cod%TYPE DEFAULT 7);
  --
  PROCEDURE Vld_Dias_Abono_Pec1(pcod_empresa        EMPRESAS.cod%TYPE,
                                pmatricula          INF_PESSOAIS.matricula%TYPE,
                                pdt_inic_per_ferias FERIAS.dt_inic_per_ferias%TYPE,
                                pdt_fim_per_ferias  FERIAS.dt_fim_per_ferias%TYPE,
                                pdias_abono_pec1    FERIAS.dias_abono_pec1%TYPE,
                                pnum_dias_parc1     NUMBER,
                                pdt_saida_parc1     FERIAS.dt_saida_parc1%TYPE,
                                popcao_abono_pec1   OUT FERIAS.opcao_abono_pec1%TYPE,
                                pflg_retorno        OUT VARCHAR2,
                                pmsg_retorno        OUT VARCHAR2);
  --
  PROCEDURE Valida_Dias_Abono_Pec1(pcod_empresa          EMPRESAS.cod%TYPE,
                                   pmatricula            INF_PESSOAIS.matricula%TYPE,
                                   pfilial               FILIAIS.cod_filial%TYPE,
                                   pdt_inic_per_ferias   FERIAS.dt_inic_per_ferias%TYPE,
                                   pdt_fim_per_ferias    FERIAS.dt_fim_per_ferias%TYPE,
                                   pnum_dias_parc1       NUMBER,
                                   pdt_saida_parc1       FERIAS.dt_saida_parc1%TYPE,
                                   psaldo                NUMBER,
                                   pdias_abono_pec1      OUT FERIAS.dias_abono_pec1%TYPE,
                                   popcao_abono_pec1     OUT FERIAS.opcao_abono_pec1%TYPE,
                                   pind_situacao_periodo FERIAS.ind_situacao_periodo%TYPE,
                                   pdias_direito         NUMBER, -- Humberto/Izidoro 03/03/2016
                                   pusuario              VARCHAR2,
                                   pflg_retorno          OUT VARCHAR2,
                                   pmsg_retorno          OUT VARCHAR2);
  --
  PROCEDURE ocorrencia13(pcod_empresa  EMPRESAS.cod%TYPE,
                         pmatricula    INF_PESSOAIS.matricula%TYPE,
                         pdata_retorno DATE,
                         pocorr_sal13  OUT OCORR_PAGTO.cod%TYPE,
                         pflg_retorno  OUT VARCHAR2,
                         pmsg_retorno  OUT VARCHAR2);
  --
  PROCEDURE Valida_Opcao_13Sal1(pcod_empresa          EMPRESAS.cod%TYPE,
                                pmatricula            INF_PESSOAIS.matricula%TYPE,
                                pdt_saida_parc1       FERIAS.dt_saida_parc1%TYPE,
                                pdt_retorno_parc1     FERIAS.dt_retorno_parc1%TYPE,
                                popcao_13sal1         VARCHAR2,
                                pind_situacao_periodo FERIAS.ind_situacao_periodo%TYPE,
                                PCOD_SOLICITACAO      FERIAS.COD_SOLICITACAO%TYPE,
                                pflg_retorno          OUT VARCHAR2,
                                pmsg_retorno          OUT VARCHAR2);
  --
  PROCEDURE Valida_Desc_Adicional1(pdesc_adicional1         FERIAS.desc_adicional1%TYPE,
                                   pdias_descanso_adicional FERIAS.dias_descanso_adicional%TYPE,
                                   pind_situacao_periodo    FERIAS.ind_situacao_periodo%TYPE,
                                   pflg_retorno             OUT VARCHAR2,
                                   pmsg_retorno             OUT VARCHAR2);
  --
  PROCEDURE Valida_Dt_Retorno_Parc1(pdt_retorno_parc1     FERIAS.dt_retorno_parc1%TYPE,
                                    pind_situacao_periodo FERIAS.ind_situacao_periodo%TYPE,
                                    pflg_retorno          OUT VARCHAR2,
                                    pmsg_retorno          OUT VARCHAR2,
                                    pdt_saida_parc1       ferias.dt_saida_parc1%TYPE DEFAULT NULL,
                                    pdt_fim_per_ferias    DATE,
                                    pcod_empresa          empresas.cod%TYPE,
                                    pmatricula            inf_pessoais.matricula%TYPE,
                                    pdt_inic_per_ferias   DATE);
  --
  PROCEDURE Valida_Tipo_Ferias1(pcod_empresa          EMPRESAS.cod%TYPE,
                                pmatricula            INF_PESSOAIS.matricula%TYPE,
                                pdt_inic_per_ferias   FERIAS.dt_inic_per_ferias%TYPE,
                                pdt_fim_per_ferias    FERIAS.dt_fim_per_ferias%TYPE,
                                preferencia           DATE,
                                ptipo_ferias1         FERIAS.tipo_ferias1%TYPE,
                                pind_situacao_periodo FERIAS.ind_situacao_periodo%TYPE,
                                pflg_retorno          OUT VARCHAR2,
                                pmsg_retorno          OUT VARCHAR2);
  --
  FUNCTION retorna_dt_pagto(pcod_empresa EMPRESAS.cod%TYPE,
                            pmatricula   INF_PESSOAIS.matricula%TYPE,
                            p_dt_saida   DATE) RETURN DATE;
  --
  FUNCTION verif_interv_progr_ferias(pcod_empresa EMPRESAS.cod%TYPE,
                                     pfilial      FILIAIS.cod_filial%TYPE,
                                     pdt_retorno  FERIAS.dt_retorno_parc1%TYPE,
                                     pdt_saida    FERIAS.dt_saida_parc1%TYPE,
                                     pintervalo   OUT FERIAS_PARAMETROS.interv_progr_ferias%TYPE)
    RETURN BOOLEAN;
  --
  PROCEDURE P2(pnum_dias_parc1  NUMBER,
               pdias_abono_pec1 FERIAS.dias_abono_pec1%TYPE,
               pnum_dias_parc2  IN OUT FERIAS.num_dias_parc2%TYPE,
               pdias_abono_pec2 IN OUT FERIAS.dias_abono_pec2%TYPE,
               psaldo           IN NUMBER,
               pflg_retorno     IN OUT VARCHAR2,
               pmsg_retorno     IN OUT VARCHAR);
  --
  PROCEDURE Bloqueia_Parc2(pcod_empresa         EMPRESAS.cod%TYPE,
                           pfilial              FILIAIS.cod_filial%TYPE,
                           pdt_saida_parc1      FERIAS.dt_saida_parc1%TYPE,
                           pnum_dias_parc1      NUMBER,
                           pdias_abono_pec1     FERIAS.dias_abono_pec1%TYPE,
                           pdt_fim_per_ferias   FERIAS.dt_fim_per_ferias%TYPE,
                           psaldo               NUMBER,
                           pdias_direito        NUMBER, -- Humberto/Izidoro 03/03/2016
                           popcao_13sal2        IN OUT FERIAS.opcao_13sal2%TYPE,
                           pdias_abono_pec1_dsp OUT VARCHAR2,
                           pnum_dias_parc1_dsp  OUT VARCHAR2,
                           pflg_retorno         IN OUT VARCHAR2,
                           pmsg_retorno         IN OUT VARCHAR2);
  --
  PROCEDURE When_New_Item_Parc2(pcod_empresa         EMPRESAS.cod%TYPE,
                                pmatricula           INF_PESSOAIS.matricula%TYPE,
                                pdt_saida_parc1      FERIAS.dt_saida_parc1%TYPE,
                                pnum_dias_parc1      NUMBER,
                                pdias_abono_pec1     FERIAS.dias_abono_pec1%TYPE,
                                pdt_fim_per_ferias   FERIAS.dt_fim_per_ferias%TYPE,
                                psaldo               NUMBER,
                                pdias_direito        NUMBER, -- Humberto/Izidoro 03/03/2016
                                popcao_13sal2        IN OUT FERIAS.opcao_13sal2%TYPE,
                                pdias_abono_pec1_dsp OUT VARCHAR2,
                                pnum_dias_parc1_dsp  OUT VARCHAR2,
                                pflg_retorno         IN OUT VARCHAR2,
                                pmsg_retorno         IN OUT VARCHAR2);
  --
  PROCEDURE Valida_Dt_Saida_Parc2(pcod_empresa         EMPRESAS.cod%TYPE,
                                  pcod_solicitacao     FERIAS.cod_solicitacao%TYPE,
                                  pmatricula           INF_PESSOAIS.matricula%TYPE,
                                  pdt_saida_parc1      FERIAS.dt_saida_parc1%TYPE,
                                  pdt_retorno_parc1    FERIAS.dt_retorno_parc1%TYPE,
                                  pnum_dias_parc1      NUMBER,
                                  pdt_saida_parc2      FERIAS.dt_saida_parc2%TYPE,
                                  pdias_abono_pec1     FERIAS.dias_abono_pec1%TYPE,
                                  pdt_inic_per_ferias  FERIAS.dt_inic_per_ferias%TYPE,
                                  pdt_fim_per_ferias   FERIAS.dt_fim_per_ferias%TYPE,
                                  psaldo               NUMBER,
                                  pdias_direito        NUMBER, -- Humberto/Izidoro 03/03/2016
                                  p_data_limite        DATE DEFAULT NULL, -- Chamado 29668 - Andre - 25-04-2023
                                  pnum_dias_parc2      IN OUT FERIAS.num_dias_parc2%TYPE,
                                  pdias_abono_pec2     IN OUT FERIAS.dias_abono_pec2%TYPE,
                                  pdt_retorno_parc2    IN OUT FERIAS.dt_retorno_parc2%TYPE,
                                  pdt_pagto_parc2      IN OUT FERIAS.dt_pagto_parc2%TYPE,
                                  ptipo_ferias2        IN OUT FERIAS.tipo_ferias2%TYPE,
                                  popcao_13sal2        IN OUT FERIAS.opcao_13sal2%TYPE,
                                  pdias_abono_pec1_dsp OUT VARCHAR2,
                                  pnum_dias_parc1_dsp  OUT VARCHAR2,
                                  pflg_retorno         OUT VARCHAR2,
                                  pmsg_retorno         OUT VARCHAR2);
  --
  PROCEDURE Valida_Num_Dias_Parc2(pcod_empresa             EMPRESAS.cod%TYPE,
                                  pmatricula               INF_PESSOAIS.matricula%TYPE,
                                  pnum_dias_parc1          NUMBER,
                                  pdias_abono_pec1         FERIAS.dias_abono_pec1%TYPE,
                                  pdt_saida_parc2          FERIAS.dt_saida_parc2%TYPE,
                                  pdt_inic_per_ferias      FERIAS.dt_inic_per_ferias%TYPE,
                                  pdt_fim_per_ferias       FERIAS.dt_fim_per_ferias%TYPE,
                                  pdias_descanso_adicional FERIAS.dias_descanso_adicional%TYPE,
                                  pdias_abono_pec2         IN OUT FERIAS.dias_abono_pec2%TYPE,
                                  ptipo_ferias2            IN OUT FERIAS.tipo_ferias2%TYPE,
                                  pdesc_adicional1         IN OUT FERIAS.desc_adicional1%TYPE,
                                  pdesc_adicional2         IN OUT FERIAS.desc_adicional2%TYPE,
                                  pnum_dias_parc2          FERIAS.num_dias_parc2%TYPE,
                                  pdt_retorno_parc2        IN OUT FERIAS.dt_retorno_parc2%TYPE,
                                  pdias_direito            NUMBER,
                                  --                                  pnum_dias_parc4          FERIAS.num_dias_parc4%TYPE,
                                  pusuario     VARCHAR2,
                                  pflg_retorno IN OUT VARCHAR2,
                                  pmsg_retorno IN OUT VARCHAR2);
  --
  PROCEDURE Valida_Abono_Pec2(pcod_empresa          FERIAS.cod_empresa%TYPE,
                              pmatricula            INF_PESSOAIS.matricula%TYPE,
                              pdt_inic_per_ferias   FERIAS.dt_inic_per_ferias%TYPE,
                              pdt_fim_per_ferias    FERIAS.dt_fim_per_ferias%TYPE,
                              pind_situacao_periodo ferias.ind_situacao_periodo%TYPE,
                              pdias_direito         NUMBER,
                              pnum_dias_parc1       NUMBER,
                              pdias_abono_pec1      FERIAS.dias_abono_pec1%TYPE,
                              pdt_saida_parc2       FERIAS.dt_saida_parc2%TYPE,
                              pnum_dias_parc2       FERIAS.num_dias_parc2%TYPE,
                              pdesc_adicional2      FERIAS.desc_adicional2%TYPE,
                              pdias_abono_pec2      FERIAS.dias_abono_pec2%TYPE,
                              popcao_abono_pec2     IN OUT FERIAS.opcao_abono_pec2%TYPE,
                              pdt_retorno_parc2     IN OUT FERIAS.dt_retorno_parc2%TYPE,
                              pflg_retorno          IN OUT VARCHAR2,
                              pmsg_retorno          IN OUT VARCHAR2);
  --
  PROCEDURE Valida_Opcao_13Sal2(pcod_empresa      EMPRESAS.cod%TYPE,
                                pmatricula        INF_PESSOAIS.matricula%TYPE,
                                popcao_13sal1     FERIAS.opcao_13sal1%TYPE,
                                pdt_saida_parc1   FERIAS.dt_saida_parc1%TYPE,
                                popcao_13sal2     FERIAS.opcao_13sal2%TYPE,
                                pdt_saida_parc2   FERIAS.dt_saida_parc2%TYPE,
                                pdt_retorno_parc2 FERIAS.dt_retorno_parc2%TYPE,
                                PCOD_SOLICITACAO  FERIAS.COD_SOLICITACAO%TYPE,
                                pflg_retorno      IN OUT VARCHAR2,
                                pmsg_retorno      IN OUT VARCHAR2);
  --
  PROCEDURE Valida_Desc_Adicional2(pdias_descanso_adicional FERIAS.dias_descanso_adicional%TYPE,
                                   pdesc_adicional1         FERIAS.desc_adicional1%TYPE,
                                   pdt_saida_parc2          FERIAS.dt_saida_parc2%TYPE,
                                   pnum_dias_parc2          FERIAS.num_dias_parc2%TYPE,
                                   pdesc_adicional2         FERIAS.desc_adicional2%TYPE,
                                   pdt_retorno_parc2        IN OUT FERIAS.dt_retorno_parc2%TYPE,
                                   pflg_retorno             IN OUT VARCHAR2,
                                   pmsg_retorno             IN OUT VARCHAR2);
  --
  PROCEDURE Valida_Dt_Retorno_Parc2(pdt_retorno_parc2     FERIAS.dt_retorno_parc2%TYPE,
                                    pind_situacao_periodo ferias.ind_situacao_periodo%TYPE,
                                    pflg_retorno          IN OUT VARCHAR2,
                                    pmsg_retorno          IN OUT VARCHAR2,
                                    pdt_saida_parc2       FERIAS.dt_saida_parc2%TYPE DEFAULT NULL,
                                    pdt_fim_per_ferias    DATE,
                                    pcod_empresa          empresas.cod%TYPE,
                                    pmatricula            inf_pessoais.matricula%TYPE,
                                    pdt_inic_per_ferias   DATE);
  --
  PROCEDURE Valida_Tipo_Ferias2(ptipo_ferias2 FERIAS.tipo_ferias2%TYPE,
                                pflg_retorno  IN OUT VARCHAR2,
                                pmsg_retorno  IN OUT VARCHAR2);

  /** Inicio Igor 27/04/2018 **/
  PROCEDURE P4(pnum_dias_parc1  NUMBER,
               pdias_abono_pec1 FERIAS.dias_abono_pec1%TYPE,
               pnum_dias_parc2  NUMBER,
               pdias_abono_pec2 FERIAS.dias_abono_pec2%TYPE,
               pnum_dias_parc4  IN OUT FERIAS.num_dias_parc2%TYPE,
               pdias_abono_pec4 IN OUT FERIAS.dias_abono_pec2%TYPE,
               PSALDO           IN NUMBER,
               pflg_retorno     IN OUT VARCHAR2,
               pmsg_retorno     IN OUT VARCHAR);
  --
  PROCEDURE Bloqueia_Parc4(pcod_empresa         EMPRESAS.cod%TYPE,
                           pfilial              FILIAIS.cod_filial%TYPE,
                           pdt_saida_parc1      FERIAS.dt_saida_parc1%TYPE,
                           pnum_dias_parc1      NUMBER,
                           pdias_abono_pec1     FERIAS.dias_abono_pec1%TYPE,
                           pdt_saida_parc2      FERIAS.dt_saida_parc1%TYPE,
                           pnum_dias_parc2      NUMBER,
                           pdias_abono_pec2     FERIAS.dias_abono_pec1%TYPE,
                           pdt_fim_per_ferias   FERIAS.dt_fim_per_ferias%TYPE,
                           psaldo               NUMBER,
                           pdias_direito        NUMBER, -- Humberto/Izidoro 03/03/2016
                           popcao_13sal4        IN OUT FERIAS.opcao_13sal2%TYPE,
                           pdias_abono_pec1_dsp OUT VARCHAR2,
                           pnum_dias_parc1_dsp  OUT VARCHAR2,
                           pflg_retorno         IN OUT VARCHAR2,
                           pmsg_retorno         IN OUT VARCHAR2);
  --
  PROCEDURE When_New_Item_Parc4(pcod_empresa         EMPRESAS.cod%TYPE,
                                pmatricula           INF_PESSOAIS.matricula%TYPE,
                                pdt_saida_parc1      FERIAS.dt_saida_parc1%TYPE,
                                pnum_dias_parc1      NUMBER,
                                pdias_abono_pec1     FERIAS.dias_abono_pec1%TYPE,
                                pdt_saida_parc2      FERIAS.dt_saida_parc1%TYPE,
                                pnum_dias_parc2      NUMBER,
                                pdias_abono_pec2     FERIAS.dias_abono_pec1%TYPE,
                                pdt_saida_parc4      FERIAS.dt_saida_parc1%TYPE,
                                pnum_dias_parc4      NUMBER,
                                pdias_abono_pec4     FERIAS.dias_abono_pec1%TYPE,
                                pdt_fim_per_ferias   FERIAS.dt_fim_per_ferias%TYPE,
                                psaldo               NUMBER,
                                pdias_direito        NUMBER, -- Humberto/Izidoro 03/03/2016
                                popcao_13sal4        IN OUT FERIAS.opcao_13sal2%TYPE,
                                pdias_abono_pec1_dsp OUT VARCHAR2,
                                pnum_dias_parc1_dsp  OUT VARCHAR2,
                                pflg_retorno         IN OUT VARCHAR2,
                                pmsg_retorno         IN OUT VARCHAR2);
  --
  PROCEDURE Valida_Dt_Saida_Parc4(pcod_empresa         EMPRESAS.cod%TYPE,
                                  pcod_solicitacao     FERIAS.cod_solicitacao%TYPE,
                                  pmatricula           INF_PESSOAIS.matricula%TYPE,
                                  pdt_saida_parc1      FERIAS.dt_saida_parc1%TYPE,
                                  pdt_retorno_parc1    FERIAS.dt_retorno_parc1%TYPE,
                                  pdt_saida_parc2      FERIAS.dt_saida_parc1%TYPE,
                                  pdt_retorno_parc2    FERIAS.dt_retorno_parc1%TYPE,
                                  pnum_dias_parc1      NUMBER,
                                  pnum_dias_parc2      NUMBER,
                                  pdt_saida_parc4      FERIAS.dt_saida_parc4%TYPE,
                                  pdias_abono_pec1     FERIAS.dias_abono_pec1%TYPE,
                                  pdt_inic_per_ferias  FERIAS.dt_inic_per_ferias%TYPE,
                                  pdt_fim_per_ferias   FERIAS.dt_fim_per_ferias%TYPE,
                                  psaldo               NUMBER,
                                  pdias_direito        NUMBER, -- Humberto/Izidoro 03/03/2016
                                  p_data_limite        DATE DEFAULT NULL, -- Chamado 29668 - Andre - 25-04-2023                                 
                                  pnum_dias_parc4      IN OUT FERIAS.num_dias_parc2%TYPE,
                                  pdias_abono_pec4     IN OUT FERIAS.dias_abono_pec2%TYPE,
                                  pdt_retorno_parc4    IN OUT FERIAS.dt_retorno_parc2%TYPE,
                                  pdt_pagto_parc4      IN OUT FERIAS.dt_pagto_parc2%TYPE,
                                  ptipo_ferias4        IN OUT FERIAS.tipo_ferias2%TYPE,
                                  popcao_13sal4        IN OUT FERIAS.opcao_13sal2%TYPE,
                                  pdias_abono_pec1_dsp OUT VARCHAR2,
                                  pnum_dias_parc1_dsp  OUT VARCHAR2,
                                  pflg_retorno         OUT VARCHAR2,
                                  pmsg_retorno         OUT VARCHAR2);
  --
  PROCEDURE Valida_Num_Dias_Parc4(pcod_empresa             EMPRESAS.cod%TYPE,
                                  pmatricula               INF_PESSOAIS.matricula%TYPE,
                                  pnum_dias_parc1          NUMBER,
                                  pnum_dias_parc2          NUMBER,
                                  pnum_dias_parc4          IN OUT NUMBER,
                                  pdias_abono_pec1         FERIAS.dias_abono_pec1%TYPE,
                                  pdias_abono_pec2         FERIAS.dias_abono_pec2%TYPE,
                                  pdt_saida_parc2          FERIAS.dt_saida_parc2%TYPE,
                                  pdt_saida_parc4          FERIAS.dt_saida_parc2%TYPE,
                                  pdt_inic_per_ferias      FERIAS.dt_inic_per_ferias%TYPE,
                                  pdt_fim_per_ferias       FERIAS.dt_fim_per_ferias%TYPE,
                                  pdias_descanso_adicional FERIAS.dias_descanso_adicional%TYPE,
                                  PIND_SITUACAO_PERIODO    FERIAS.IND_SITUACAO_PERIODO%TYPE, -- ACRESCENTAR NA CHAMADA DO APEX 21/09/2018
                                  PSALDO                   FERIAS.SALDO%TYPE, -- ACRESCENTAR NA CHAMADA DO APEX 21/09/2018
                                  Pind_situacao_parc_2     ferias.ind_situacao_parc_2%TYPE, -- ACRESCENTAR NA CHAMADA DO APEX 21/09/2018
                                  pdias_abono_pec4         IN OUT FERIAS.dias_abono_pec2%TYPE,
                                  ptipo_ferias4            IN OUT FERIAS.tipo_ferias2%TYPE,
                                  pdesc_adicional1         IN OUT FERIAS.desc_adicional1%TYPE,
                                  pdesc_adicional2         IN OUT FERIAS.desc_adicional2%TYPE,
                                  pdesc_adicional4         IN OUT FERIAS.desc_adicional4%TYPE,
                                  pdt_retorno_parc4        IN OUT FERIAS.dt_retorno_parc4%TYPE,
                                  pdias_direito            NUMBER,
                                  pflg_retorno             IN OUT VARCHAR2,
                                  pmsg_retorno             IN OUT VARCHAR2,
                                  PUSUARIO                 VARCHAR2 DEFAULT NULL); -- ACRESCENTAR NA CHAMADA DO APEX 21/09/2018
  --
  PROCEDURE Valida_Num_Dias_Parc4_old(pcod_empresa             EMPRESAS.cod%TYPE,
                                      pmatricula               INF_PESSOAIS.matricula%TYPE,
                                      pnum_dias_parc1          NUMBER,
                                      pnum_dias_parc2          NUMBER,
                                      pnum_dias_parc4          NUMBER,
                                      pdias_abono_pec1         FERIAS.dias_abono_pec1%TYPE,
                                      pdias_abono_pec2         FERIAS.dias_abono_pec2%TYPE,
                                      pdt_saida_parc2          FERIAS.dt_saida_parc2%TYPE,
                                      pdt_saida_parc4          FERIAS.dt_saida_parc2%TYPE,
                                      pdt_inic_per_ferias      FERIAS.dt_inic_per_ferias%TYPE,
                                      pdt_fim_per_ferias       FERIAS.dt_fim_per_ferias%TYPE,
                                      pdias_descanso_adicional FERIAS.dias_descanso_adicional%TYPE,
                                      pdias_abono_pec4         IN OUT FERIAS.dias_abono_pec2%TYPE,
                                      ptipo_ferias4            IN OUT FERIAS.tipo_ferias2%TYPE,
                                      pdesc_adicional1         IN OUT FERIAS.desc_adicional1%TYPE,
                                      pdesc_adicional2         IN OUT FERIAS.desc_adicional2%TYPE,
                                      pdesc_adicional4         IN OUT FERIAS.desc_adicional4%TYPE,
                                      pdt_retorno_parc4        IN OUT FERIAS.dt_retorno_parc4%TYPE,
                                      pdias_direito            NUMBER,
                                      pusuario                 VARCHAR2,
                                      pflg_retorno             IN OUT VARCHAR2,
                                      pmsg_retorno             IN OUT VARCHAR2);
  --
  PROCEDURE Valida_Abono_Pec4(pcod_empresa          FERIAS.cod_empresa%TYPE,
                              pmatricula            INF_PESSOAIS.matricula%TYPE,
                              pdt_inic_per_ferias   FERIAS.dt_inic_per_ferias%TYPE,
                              pdt_fim_per_ferias    FERIAS.dt_fim_per_ferias%TYPE,
                              pind_situacao_periodo ferias.ind_situacao_periodo%TYPE,
                              pdias_direito         NUMBER,
                              pnum_dias_parc1       NUMBER,
                              pdias_abono_pec1      FERIAS.dias_abono_pec1%TYPE,
                              pdt_saida_parc2       FERIAS.dt_saida_parc2%TYPE,
                              pnum_dias_parc2       FERIAS.num_dias_parc2%TYPE,
                              pdesc_adicional2      FERIAS.desc_adicional2%TYPE,
                              pdias_abono_pec2      FERIAS.dias_abono_pec2%TYPE,
                              pdt_saida_parc4       FERIAS.dt_saida_parc2%TYPE,
                              pnum_dias_parc4       FERIAS.num_dias_parc2%TYPE,
                              pdesc_adicional4      FERIAS.desc_adicional2%TYPE,
                              pdias_abono_pec4      FERIAS.dias_abono_pec2%TYPE,
                              popcao_abono_pec4     IN OUT FERIAS.opcao_abono_pec2%TYPE,
                              pdt_retorno_parc4     IN OUT FERIAS.dt_retorno_parc2%TYPE,
                              pflg_retorno          IN OUT VARCHAR2,
                              pmsg_retorno          IN OUT VARCHAR2);
  --
  PROCEDURE Valida_Opcao_13Sal4(pcod_empresa      EMPRESAS.cod%TYPE,
                                pmatricula        INF_PESSOAIS.matricula%TYPE,
                                popcao_13sal1     FERIAS.opcao_13sal1%TYPE,
                                pdt_saida_parc1   FERIAS.dt_saida_parc1%TYPE,
                                popcao_13sal2     FERIAS.opcao_13sal2%TYPE,
                                pdt_saida_parc2   FERIAS.dt_saida_parc2%TYPE,
                                pdt_retorno_parc2 FERIAS.dt_retorno_parc2%TYPE,
                                popcao_13sal4     FERIAS.opcao_13sal2%TYPE,
                                pdt_saida_parc4   FERIAS.dt_saida_parc2%TYPE,
                                pdt_retorno_parc4 FERIAS.dt_retorno_parc2%TYPE,
                                PCOD_SOLICITACAO  FERIAS.COD_SOLICITACAO%TYPE,
                                pflg_retorno      IN OUT VARCHAR2,
                                pmsg_retorno      IN OUT VARCHAR2);
  --
  PROCEDURE Valida_Desc_Adicional4(pdias_descanso_adicional FERIAS.dias_descanso_adicional%TYPE,
                                   pdesc_adicional1         FERIAS.desc_adicional1%TYPE,
                                   pdt_saida_parc2          FERIAS.dt_saida_parc2%TYPE,
                                   pnum_dias_parc2          FERIAS.num_dias_parc2%TYPE,
                                   pdesc_adicional2         FERIAS.desc_adicional2%TYPE,
                                   pdt_saida_parc4          FERIAS.dt_saida_parc2%TYPE,
                                   pnum_dias_parc4          FERIAS.num_dias_parc2%TYPE,
                                   pdesc_adicional4         FERIAS.desc_adicional2%TYPE,
                                   pdt_retorno_parc4        IN OUT FERIAS.dt_retorno_parc2%TYPE,
                                   pflg_retorno             IN OUT VARCHAR2,
                                   pmsg_retorno             IN OUT VARCHAR2);
  --
  PROCEDURE Valida_Dt_Retorno_Parc4(pdt_retorno_parc4     FERIAS.dt_retorno_parc4%TYPE,
                                    pind_situacao_periodo ferias.ind_situacao_periodo%TYPE,
                                    pflg_retorno          IN OUT VARCHAR2,
                                    pmsg_retorno          IN OUT VARCHAR2,
                                    pdt_saida_parc4       FERIAS.DT_SAIDA_PARC4%TYPE DEFAULT NULL,
                                    pdt_fim_per_ferias    DATE,
                                    pcod_empresa          empresas.cod%TYPE,
                                    pmatricula            inf_pessoais.matricula%TYPE,
                                    pdt_inic_per_ferias   DATE,
                                    pdt_saida_parc2       DATE);
  --
  PROCEDURE Valida_Tipo_Ferias4(ptipo_ferias4 FERIAS.tipo_ferias4%TYPE,
                                pflg_retorno  IN OUT VARCHAR2,
                                pmsg_retorno  IN OUT VARCHAR2);
  /** Fim Igor 27/04/2018 **/
  --
  -- O campo Dt_Saida_Parc3 possui uma mensagem de confirmação.
  -- A procedure Valida_dt_Saida_Parc3_2 somente deve ser chamada se pflg_retorno = 'S' ou se
  -- a mensagem de confirmação for exibida e confirmada pelo usuário
  PROCEDURE Valida_Dt_Saida_Parc3_1(pcod_empresa        FERIAS.cod_empresa%TYPE,
                                    pmatricula          INF_PESSOAIS.matricula%TYPE,
                                    pcod_solicitacao    REQUISICAO_FERIAS.cod_solicitacao%TYPE,
                                    pdt_inic_per_ferias FERIAS.dt_inic_per_ferias%TYPE,
                                    pdt_saida_parc3     FERIAS.dt_saida_parc3%TYPE,
                                    pflg_retorno        IN OUT VARCHAR2,
                                    pmsg_retorno        IN OUT VARCHAR2);
  --
  PROCEDURE Valida_Dt_Saida_Parc3_2(pcod_empresa        FERIAS.cod_empresa%TYPE,
                                    pmatricula          INF_PESSOAIS.matricula%TYPE,
                                    pcod_solicitacao    REQUISICAO_FERIAS.cod_solicitacao%TYPE,
                                    pdt_inic_per_ferias FERIAS.dt_inic_per_ferias%TYPE,
                                    pdt_saida_parc3     FERIAS.dt_saida_parc3%TYPE,
                                    pflg_retorno        IN OUT VARCHAR2,
                                    pmsg_retorno        IN OUT VARCHAR2);
  --
  PROCEDURE Valida_Num_Dias_Parc3(pnum_dias_parc3 FERIAS.num_dias_parc3%TYPE,
                                  pflg_retorno    IN OUT VARCHAR2,
                                  pmsg_retorno    IN OUT VARCHAR2);
  --
  PROCEDURE Valida_Dt_Retorno_Parc3(pdt_saida_parc3       FERIAS.dt_saida_parc3%TYPE,
                                    pind_situacao_periodo FERIAS.ind_situacao_periodo%TYPE,
                                    pflg_retorno          IN OUT VARCHAR2,
                                    pmsg_retorno          IN OUT VARCHAR2,
                                    pdt_retorno_parc3     FERIAS.Dt_Retorno_Parc3%TYPE DEFAULT NULL);
  --
  PROCEDURE CANCELA_REQ(psolicitacao requisicao_ferias.cod_solicitacao%TYPE,
                        pusuario     VARCHAR2,
                        pflg_retorno IN OUT VARCHAR2,
                        pmsg_retorno IN OUT VARCHAR2);
  --
  PROCEDURE Pre_Insert(pcod_solicitacao      FERIAS.cod_solicitacao%TYPE,
                       pcod_empresa          EMPRESAS.cod%TYPE,
                       pfilial               FILIAIS.cod_filial%TYPE,
                       pmatricula            INF_PESSOAIS.matricula%TYPE,
                       psit_requisicao       REQUISICAO_FERIAS.sit_requisicao%TYPE,
                       pind_situacao_periodo FERIAS.ind_situacao_periodo%TYPE,
                       pdt_inic_per_ferias   FERIAS.dt_inic_per_ferias%TYPE,
                       pdt_fim_per_ferias    FERIAS.dt_fim_per_ferias%TYPE,
                       pnum_dias_parc1       NUMBER,
                       psaldo                NUMBER,
                       pdt_saida_parc1       FERIAS.dt_saida_parc1%TYPE,
                       pdt_saida_parc2       FERIAS.dt_saida_parc2%TYPE,
                       pdt_saida_parc3       FERIAS.dt_saida_parc3%TYPE,
                       pdt_saida_parc4       FERIAS.dt_saida_parc4%TYPE,
                       pdt_retorno_parc1     FERIAS.dt_retorno_parc1%TYPE,
                       pdt_retorno_parc2     FERIAS.dt_retorno_parc2%TYPE,
                       pdt_retorno_parc3     FERIAS.dt_retorno_parc3%TYPE,
                       pdt_retorno_parc4     FERIAS.dt_retorno_parc4%TYPE,
                       popcao_13sal1         REQUISICAO_FERIAS.opcao_13sal1%TYPE,
                       popcao_13sal2         REQUISICAO_FERIAS.opcao_13sal2%TYPE,
                       popcao_13sal4         REQUISICAO_FERIAS.opcao_13sal4%TYPE,
                       pdias_abono_pec1      IN OUT FERIAS.dias_abono_pec1%TYPE,
                       pjornada_reduzida     VARCHAR2,
                       pflg_retorno          IN OUT VARCHAR2,
                       pmsg_retorno          IN OUT VARCHAR2,
                       pparcelas_opc         NUMBER DEFAULT 1);
  --
  PROCEDURE Pre_Update(psolicitacao      requisicao_ferias.cod_solicitacao%TYPE,
                       psit_requisicao   requisicao_ferias.sit_requisicao%TYPE -- Valor exibido na tela
                      ,
                       pdt_saida_parc1   FERIAS.dt_saida_parc1%TYPE,
                       pdt_saida_parc2   FERIAS.dt_saida_parc2%TYPE,
                       pdt_saida_parc3   FERIAS.dt_saida_parc3%TYPE,
                       pdt_saida_parc4   FERIAS.dt_saida_parc4%TYPE,
                       pdt_retorno_parc1 FERIAS.dt_retorno_parc1%TYPE,
                       pdt_retorno_parc2 FERIAS.dt_retorno_parc2%TYPE,
                       pdt_retorno_parc3 FERIAS.dt_retorno_parc3%TYPE,
                       pdt_retorno_parc4 FERIAS.dt_retorno_parc4%TYPE,
                       pusuario          VARCHAR2,
                       pflg_retorno      IN OUT VARCHAR2,
                       pmsg_retorno      IN OUT VARCHAR2);
  --
  -- Deve ser chamado inclusive como POST-UPDATE
  PROCEDURE Post_Insert(pcod_empresa EMPRESAS.cod%TYPE,
                        psolicitacao REQUISICAO_FERIAS.cod_solicitacao%TYPE,
                        pusuario     VARCHAR2,
                        pflg_retorno IN OUT VARCHAR2,
                        pmsg_retorno IN OUT VARCHAR2);
  --
  PROCEDURE Valida_Update_Rf(pcod_empresa       EMPRESAS.cod%TYPE,
                             pfilial            FILIAIS.cod_filial%TYPE,
                             pdt_saida_parc1    FERIAS.dt_saida_parc1%TYPE,
                             pdt_fim_per_ferias FERIAS.dt_fim_per_ferias%TYPE,
                             pnum_dias_parc1    NUMBER,
                             pdias_abono_pec1   IN OUT FERIAS.dias_abono_pec1%TYPE,
                             psaldo             NUMBER, -- :global.saldo (F012014_A)
                             pmatricula         inf_pessoais.matricula%TYPE,
                             pjornada_reduzida  VARCHAR2,
                             pflg_retorno       OUT VARCHAR2,
                             pmsg_retorno       OUT VARCHAR2);
  --
  PROCEDURE Post_Update(pcod_empresa EMPRESAS.cod%TYPE,
                        psolicitacao REQUISICAO_FERIAS.cod_solicitacao%TYPE,
                        pflg_retorno IN OUT VARCHAR2,
                        pmsg_retorno IN OUT VARCHAR2);
  --
  PROCEDURE Valida_Sequencia(pcod_empresa EMPRESAS.cod%TYPE,
                             psolicitacao consulta_requisicoes.solicitacao%TYPE,
                             pemp_aprov   EMPRESAS.cod%TYPE,
                             pmat_aprov   INF_PESSOAIS.matricula%TYPE,
                             pflg_retorno OUT VARCHAR2,
                             pmsg_retorno OUT VARCHAR2);
  --
  FUNCTION fnc_ValidaEstatutario(pEmpresa        IN NUMBER,
                                 pMatricula      IN NUMBER,
                                 pTipo           IN NUMBER,
                                 pDtSaidaParc    IN DATE,
                                 pDtSaidaParcX   IN DATE,
                                 pDtFimPerFerias IN DATE,
                                 pDtRetornParc   IN DATE) RETURN VARCHAR2;
  --
  FUNCTION fnc_VerifPerOutraEmp(pEmpresa        IN NUMBER,
                                pMatricula      IN NUMBER,
                                pDtParcSR       IN DATE,
                                pDtFimPerFerias IN DATE) RETURN VARCHAR2;
  --
  FUNCTION fnc_VerifEstatutario(pEmpresa   IN informacoes_funcionais_cad.cod_empresa%TYPE,
                                pMatricula IN informacoes_funcionais_cad.matricula%TYPE)
    RETURN VARCHAR2;
  --
  FUNCTION fnc_VerifVincEstagiario(pEmpresa   IN NUMBER,
                                   pMatricula IN NUMBER) RETURN VARCHAR2;
  --
  FUNCTION fnc_ValDtRetFeriasEstagiario(pEmpresa      IN NUMBER,
                                        pMatricula    IN NUMBER,
                                        pDtRetFerParc IN DATE)
    RETURN VARCHAR2;
  --
  PROCEDURE prc_verif_limite_agend_ferias(p_cod_empresa        IN NUMBER,
                                          p_matricula          NUMBER,
                                          p_dt_prog            IN DATE,
                                          p_num_parcela        in number,
                                          p_dt_inic_per_ferias IN DATE,
                                          p_dt_fim_per_ferias  IN DATE,
                                          pflg_retorno         IN OUT VARCHAR2,
                                          pmsg_retorno         IN OUT VARCHAR2);
  --
  FUNCTION ver_radio_estat(p_cod_empresa NUMBER, p_matricula NUMBER)
    RETURN VARCHAR2;
  --
  PROCEDURE VALIDA_ESTATUTARIO(P_COD_EMPRESA       NUMBER,
                               P_MATRICULA         NUMBER,
                               P_TIPO              NUMBER,
                               P_DT_SAIDA_PARC1    DATE,
                               P_DT_SAIDA_PARC2    DATE,
                               P_DT_RETORNO_PARC1  DATE,
                               P_DT_FIM_PER_FERIAS DATE,
                               P_DT_LIMITE_REQ     OUT DATE,
                               pflg_retorno        IN OUT VARCHAR2,
                               pmsg_retorno        IN OUT VARCHAR2);
  --
  PROCEDURE CANCELA_REQ_CAD_FERIAS(psolicitacao requisicao_ferias.cod_solicitacao%TYPE,
                                   pusuario     VARCHAR2,
                                   pflg_retorno IN OUT VARCHAR2,
                                   pmsg_retorno IN OUT VARCHAR2);
  FUNCTION LIMPA_PARC1(P_ROWID         ROWID,
                       PDT_SAIDA_PARC1 FERIAS.DT_SAIDA_PARC1%TYPE)
    RETURN VARCHAR2;
  FUNCTION LIMPA_PARC2(P_ROWID         ROWID,
                       PDT_SAIDA_PARC2 FERIAS.DT_SAIDA_PARC2%TYPE)
    RETURN VARCHAR2;
  FUNCTION LIMPA_PARC3(P_ROWID         ROWID,
                       PDT_SAIDA_PARC4 FERIAS.DT_SAIDA_PARC4%TYPE)
    RETURN VARCHAR2;
  --
  PROCEDURE PRC_LIMPA_FERIAS_PARC1(P_ROWID ROWID);
  PROCEDURE PRC_LIMPA_FERIAS_PARC2(P_ROWID ROWID);
  PROCEDURE PRC_LIMPA_FERIAS_PARC3(P_ROWID ROWID);
  --
  FUNCTION VALIDA_SAVE_MSG(PCOD_EMPRESA          FERIAS.COD_EMPRESA%TYPE,
                           PMATRICULA            FERIAS.MATRICULA%TYPE,
                           PDT_INIC_PER_FERIAS   FERIAS.DT_INIC_PER_FERIAS%TYPE,
                           PDT_SAIDA_PARC1       FERIAS.DT_SAIDA_PARC1%TYPE,
                           PDT_SAIDA_PARC2       FERIAS.DT_SAIDA_PARC2%TYPE,
                           PDT_SAIDA_PARC4       FERIAS.DT_SAIDA_PARC4%TYPE,
                           PDT_RETORNO_PARC1     FERIAS.DT_RETORNO_PARC1%TYPE,
                           PDT_RETORNO_PARC2     FERIAS.DT_RETORNO_PARC2%TYPE,
                           PDT_RETORNO_PARC4     FERIAS.DT_RETORNO_PARC4%TYPE,
                           PNUM_DIAS_PARC1       FERIAS.NUM_DIAS_PARC1%TYPE,
                           PNUM_DIAS_PARC2       FERIAS.NUM_DIAS_PARC2%TYPE,
                           PNUM_DIAS_PARC4       FERIAS.NUM_DIAS_PARC4%TYPE,
                           PIND_SITUACAO_PERIODO FERIAS.IND_SITUACAO_PERIODO%TYPE,
                           PIND_SITUACAO_PARC_1  FERIAS.IND_SITUACAO_PARC_1%TYPE,
                           PIND_SITUACAO_PARC_2  FERIAS.IND_SITUACAO_PARC_2%TYPE,
                           PIND_SITUACAO_PARC_4  FERIAS.IND_SITUACAO_PARC_4%TYPE,
                           PDIAS_DIREITO         FERIAS.SALDO%TYPE,
                           PSALDO                FERIAS.SALDO%TYPE)
    RETURN VARCHAR2;
  --
  --Bruno Sousa 20/10/2025
  FUNCTION VALIDA_SAVE_OBS(P_ROWID              ROWID,
                           PDESCONSIDERA_FALTAS FERIAS.DESCONSIDERA_FALTAS%TYPE,
                           --Parcela 1
                           PDT_SAIDA_PARC1   FERIAS.DT_SAIDA_PARC1%TYPE,
                           PNUM_DIAS_PARC1   FERIAS.NUM_DIAS_PARC1%TYPE,
                           PDIAS_ABONO_PEC1  FERIAS.DIAS_ABONO_PEC1%TYPE,
                           POPCAO_13SAL1     FERIAS.OPCAO_13SAL1%TYPE,
                           PDESC_ADICIONAL1  FERIAS.DESC_ADICIONAL1%TYPE,
                           PDT_RETORNO_PARC1 FERIAS.DT_RETORNO_PARC1%TYPE,
                           PDT_PAGTO_PARC1   FERIAS.DT_PAGTO_PARC1%TYPE,
                           PTIPO_FERIAS1     FERIAS.TIPO_FERIAS1%TYPE,
                           --Parcela 2
                           PDT_SAIDA_PARC2   FERIAS.DT_SAIDA_PARC2%TYPE,
                           PNUM_DIAS_PARC2   FERIAS.NUM_DIAS_PARC2%TYPE,
                           PDIAS_ABONO_PEC2  FERIAS.DIAS_ABONO_PEC2%TYPE,
                           POPCAO_13SAL2     FERIAS.OPCAO_13SAL2%TYPE,
                           PDESC_ADICIONAL2  FERIAS.DESC_ADICIONAL2%TYPE,
                           PDT_RETORNO_PARC2 FERIAS.DT_RETORNO_PARC2%TYPE,
                           PDT_PAGTO_PARC2   FERIAS.DT_PAGTO_PARC2%TYPE,
                           PTIPO_FERIAS2     FERIAS.TIPO_FERIAS2%TYPE,
                           --Parcela 3
                           PDT_SAIDA_PARC4   FERIAS.DT_SAIDA_PARC4%TYPE,
                           PNUM_DIAS_PARC4   FERIAS.NUM_DIAS_PARC4%TYPE,
                           PDIAS_ABONO_PEC4  FERIAS.DIAS_ABONO_PEC4%TYPE,
                           POPCAO_13SAL4     FERIAS.OPCAO_13SAL4%TYPE,
                           PDESC_ADICIONAL4  FERIAS.DESC_ADICIONAL4%TYPE,
                           PDT_RETORNO_PARC4 FERIAS.DT_RETORNO_PARC4%TYPE,
                           PDT_PAGTO_PARC4   FERIAS.DT_PAGTO_PARC4%TYPE,
                           PTIPO_FERIAS4     FERIAS.TIPO_FERIAS4%TYPE,
                           --Parcela Coletiva
                           PDT_SAIDA_PARC3   FERIAS.DT_SAIDA_PARC3%TYPE,
                           PNUM_DIAS_PARC3   FERIAS.NUM_DIAS_PARC3%TYPE,
                           PDT_RETORNO_PARC3 FERIAS.DT_RETORNO_PARC3%TYPE,
                           PTIPO_FERIAS3     FERIAS.TIPO_FERIAS3%TYPE)
    RETURN VARCHAR2;

  PROCEDURE ATUALIZA_SALDO(PCOD_EMPRESA        FERIAS.COD_EMPRESA%TYPE,
                           PMATRICULA          FERIAS.MATRICULA%TYPE,
                           PDT_INIC_PER_FERIAS FERIAS.DT_INIC_PER_FERIAS%TYPE,
                           PDT_FIM_PER_FERIAS  FERIAS.DT_FIM_PER_FERIAS%TYPE);
  --
  --Bruno Sousa 03/01/2024
  FUNCTION FNC_VINCULO_CLF(pcod_empresa in number, pmatricula in number)
    return varchar2;

  --Bruno Sousa 09/04/2024
  FUNCTION FNC_VINCULO_NOME(pcod_empresa in number, pmatricula in number)
    return varchar2;

  --Bruno Sousa 27/09/2024
  PROCEDURE LIMPA_REQUISICAO(psolicitacao    requisicao_ferias.cod_solicitacao%TYPE,
                             pdt_saida_parc1 ferias.dt_saida_parc1%type,
                             pdt_saida_parc2 ferias.dt_saida_parc2%type,
                             pdt_saida_parc4 ferias.dt_saida_parc4%type,
                             pusuario        VARCHAR2,
                             pflg_retorno    IN OUT VARCHAR2,
                             pmsg_retorno    IN OUT VARCHAR2);

--procedure debug(text varchar2);
END Pkg_Ferias;
/

CREATE OR REPLACE PACKAGE BODY NATCORP.Pkg_Ferias IS
  --Versão 101 - 28/04/2026 - Bruno Sousa
  numDias      NUMBER := 0;
  numDiasAbono NUMBER := 0;

  procedure debug(text varchar2) is
    PRAGMA AUTONOMOUS_TRANSACTION;
  begin
    BEGIN
      insert into teste
      values
        (333,
         to_char(SYSTIMESTAMP, 'dd/mm/yyyy hh24:mi:ssxff') || ' ' || text);
    EXCEPTION
      WHEN OTHERS THEN
        insert into teste
        values
          (333, to_char(sysdate, 'dd/mm/yyyy hh24:mi:ss') || ' ' || text);
    END;
    commit;
  
  end;

  PROCEDURE INSERE_LOG_CALCULO(P_COD_EMPRESA        NUMBER,
                               P_COD_PROCESSO_PAGTO VARCHAR2,
                               P_DATA_REF_PROC      DATE,
                               P_OPCAO              NUMBER,
                               P_INTERVALO_DE       NUMBER,
                               P_INTERVALO_ATE      NUMBER,
                               P_INTERVALO_DT_DE    DATE,
                               P_INTERVALO_DT_ATE   DATE,
                               P_EMPRESA_DE         NUMBER,
                               P_EMPRESA_ATE        NUMBER,
                               P_FILIAL_DE          NUMBER,
                               P_FILIAL_ATE         NUMBER,
                               P_SINDICATO_DE       NUMBER,
                               P_SINDICATO_ATE      NUMBER,
                               P_DT_INICIO          DATE,
                               P_DT_FIM             DATE,
                               P_USUARIO            VARCHAR2,
                               P_DT_ATUALIZACAO     DATE) IS
    --
    CURSOR c1 IS
      SELECT SID, MODULE, logon_time
        FROM v$session
       WHERE username = USER
         AND sid = sys_context('USERENV', 'SID');
    v_c1        c1%ROWTYPE;
    VMSG_ERRO   VARCHAR2(4000);
    VSAIDA_ERRO EXCEPTION;
    --
  BEGIN
    --
    BEGIN
      DELETE FROM log_calculo
       WHERE data_ref_proc = ADD_MONTHS(p_data_ref_proc, -12);
    END;
    --
    OPEN c1;
    FETCH c1
      INTO v_c1;
    CLOSE c1;
    --
    BEGIN
      INSERT INTO log_calculo
        (COD_EMPRESA,
         COD_PROCESSO_PAGTO,
         DATA_REF_PROC,
         OPCAO,
         INTERVALO_DE,
         INTERVALO_ATE,
         INTERVALO_DT_DE,
         INTERVALO_DT_ATE,
         EMPRESA_DE,
         EMPRESA_ATE,
         FILIAL_DE,
         FILIAL_ATE,
         SINDICATO_DE,
         SINDICATO_ATE,
         DT_INICIO,
         DT_FIM,
         Usuario,
         DT_ATUALIZACAO,
         SID,
         DT_SID,
         MODULE)
      VALUES
        (P_COD_EMPRESA,
         P_COD_PROCESSO_PAGTO,
         P_DATA_REF_PROC,
         P_OPCAO,
         P_INTERVALO_DE,
         P_INTERVALO_ATE,
         P_INTERVALO_DT_DE,
         P_INTERVALO_DT_ATE,
         P_EMPRESA_DE,
         P_EMPRESA_ATE,
         P_FILIAL_DE,
         P_FILIAL_ATE,
         P_SINDICATO_DE,
         P_SINDICATO_ATE,
         P_DT_INICIO,
         P_DT_FIM,
         P_USUARIO,
         P_DT_ATUALIZACAO,
         v_c1.sid,
         v_c1.logon_time,
         v_c1.MODULE);
    EXCEPTION
      WHEN OTHERS THEN
        VMSG_ERRO := SUBSTR('ERRO INSERE LOG CALCULO: ' || SQLERRM, 1, 4000);
        RAISE VSAIDA_ERRO;
    END;
    --
  EXCEPTION
    WHEN VSAIDA_ERRO THEN
      RAISE_APPLICATION_ERROR(-20001, VMSG_ERRO);
    WHEN OTHERS THEN
      RAISE_APPLICATION_ERROR(-20000,
                              'Insere_Log_Calculo Erro: ' || SQLERRM);
  END INSERE_LOG_CALCULO;
  -- Se a data de saída for maior que a data limite da limite_agend_ferias, retornar a data para ser
  -- exibida no alerta.
  FUNCTION VERIF_LIMITE_AGEND_FERIAS(PCOD_EMPRESA NUMBER,
                                     PDT_REQ      DATE,
                                     PDT_SAIDA    DATE) RETURN DATE IS
  
    CURSOR c1 IS
    --Bruno Sousa 14/01/2026 Alterado
    --Bruno Sousa 02/12/2024 Alterada para a mesma Regra do forms F013303
      SELECT TO_DATE(SUBSTR(LPAD(replace(L.dt_limite, '/'), 4, 0), 0, 2) || '/' ||
                     SUBSTR(LPAD(replace(L.dt_limite, '/'), 4, 0), 3, 2) || '/' ||
                     decode(l.ind_periodo_ano_seguinte,
                            'S',
                            TO_CHAR(ADD_MONTHS(PDT_SAIDA, -12), 'rrrr'),
                            TO_CHAR(PDT_SAIDA, 'rrrr')),
                     'DD/MM/RRRR') dt_limite,
             TRUNC(TO_DATE(SUBSTR(LPAD(replace(L.dt_periodo_ini, '/'), 4, 0),
                                  0,
                                  2) || '/' ||
                           SUBSTR(LPAD(replace(L.dt_periodo_ini, '/'), 4, 0),
                                  3,
                                  2) || '/' || TO_CHAR(PDT_SAIDA, 'rrrr'),
                           'DD/MM/RRRR')) dt_periodo_ini,
             CASE
               WHEN TRUNC(TO_DATE(SUBSTR(LPAD(replace(L.dt_periodo_fin, '/'),
                                              4,
                                              0),
                                         0,
                                         2) || '/' ||
                                  SUBSTR(LPAD(replace(L.dt_periodo_fin, '/'),
                                              4,
                                              0),
                                         3,
                                         2) || '/' ||
                                  TO_CHAR(PDT_SAIDA, 'rrrr'),
                                  'DD/MM/RRRR')) <
                    TRUNC(TO_DATE(SUBSTR(LPAD(replace(L.dt_periodo_ini, '/'),
                                              4,
                                              0),
                                         0,
                                         2) || '/' ||
                                  SUBSTR(LPAD(replace(L.dt_periodo_ini, '/'),
                                              4,
                                              0),
                                         3,
                                         2) || '/' ||
                                  TO_CHAR(PDT_SAIDA, 'rrrr'),
                                  'DD/MM/RRRR')) THEN
                TRUNC(TO_DATE(SUBSTR(LPAD(replace(L.dt_periodo_fin, '/'),
                                          4,
                                          0),
                                     0,
                                     2) || '/' ||
                              SUBSTR(LPAD(replace(L.dt_periodo_fin, '/'),
                                          4,
                                          0),
                                     3,
                                     2) || '/' ||
                              TO_CHAR(ADD_MONTHS(PDT_SAIDA, 12), 'rrrr'),
                              'DD/MM/RRRR'))
               ELSE
                TRUNC(TO_DATE(SUBSTR(LPAD(replace(L.dt_periodo_fin, '/'),
                                          4,
                                          0),
                                     0,
                                     2) || '/' ||
                              SUBSTR(LPAD(replace(L.dt_periodo_fin, '/'),
                                          4,
                                          0),
                                     3,
                                     2) || '/' || TO_CHAR(PDT_SAIDA, 'rrrr'),
                              'DD/MM/RRRR'))
             END dt_periodo_fin
        FROM LIMITE_AGEND_FERIAS L
       WHERE L.COD_EMPRESA = pcod_empresa
         AND PDT_SAIDA BETWEEN
             TRUNC(TO_DATE('01/' ||
                           SUBSTR(LPAD(replace(L.DT_PERIODO_INI, '/'), 4, 0),
                                  3,
                                  2) || '/' || TO_CHAR(PDT_SAIDA, 'rrrr'),
                           'DD/MM/RRRR')) AND
             LAST_DAY(TRUNC(TO_DATE(SUBSTR(LPAD(replace(L.DT_PERIODO_FIN,
                                                        '/'),
                                                4,
                                                0),
                                           0,
                                           2) || '/' ||
                                    SUBSTR(LPAD(replace(L.DT_PERIODO_FIN,
                                                        '/'),
                                                4,
                                                0),
                                           3,
                                           2) || '/' ||
                                    TO_CHAR(PDT_SAIDA, 'rrrr'),
                                    'DD/MM/RRRR')));
  
    V_C1 C1%ROWTYPE;
    -- VDT_LIMITE_FIM DATE;
  BEGIN
  
    OPEN C1;
    FETCH C1
      INTO V_C1;
    CLOSE C1;
  
    IF TRUNC(PDT_REQ) > v_c1.dt_limite THEN
      RETURN(v_c1.dt_periodo_fin);
    END IF;
  
    /*
    OPEN C1;
    FETCH C1 INTO V_C1;
    CLOSE C1;
    
    IF PDT_SAIDA NOT BETWEEN v_c1.dt_periodo_ini AND v_c1.dt_periodo_fin THEN
      RETURN(v_c1.dt_periodo_ini);
    END IF;
    */
  
    /*
    SELECT TO_DATE(REPLACE(DT_LIMITE||TO_CHAR(SYSDATE,'RRRR'),' ',''),'DDMMRRRR')
    INTO   VDT_LIMITE_FIM
    FROM   LIMITE_AGEND_FERIAS
    WHERE  PDT_SAIDA <= TO_DATE(REPLACE(DT_PERIODO_FIN||TO_CHAR(SYSDATE,'RRRR'),' ',''),'DDMMRRRR')
    AND    SUBSTR(DT_LIMITE,3) = TO_CHAR(SYSDATE,'MM')
    AND    COD_EMPRESA = PCOD_EMPRESA;
    */
    --RETURN(VDT_LIMITE_FIM);
  
    RETURN NULL;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN(NULL);
  END VERIF_LIMITE_AGEND_FERIAS;
  --

  FUNCTION DIA_ANTERIOR_EH_FERIADO(PCOD_EMPRESA   NUMBER,
                                   PMATRICULA     NUMBER,
                                   PDT_SAIDA_PARC DATE) RETURN BOOLEAN IS
    V_DT      DATE;
    V_FERIADO FERIADO_LOCAL_X.DESCRICAO%TYPE;
    v_filial  INFORMACOES_FUNCIONAIS.FILIAL%TYPE;
  BEGIN
    V_DT := PDT_SAIDA_PARC - 1;
    SELECT I.FILIAL
      INTO v_filial
      FROM INFORMACOES_FUNCIONAIS I
     WHERE I.COD_EMPRESA = PCOD_EMPRESA
       AND I.MATRICULA = PMATRICULA;
  
    V_FERIADO := Fnct_Feriado(PCOD_EMPRESA, v_filial, PMATRICULA, V_DT);
  
    RETURN(V_FERIADO IS NOT NULL);
  EXCEPTION
    WHEN OTHERS THEN
      RETURN FALSE;
  END DIA_ANTERIOR_EH_FERIADO;
  --
  FUNCTION VALIDA_DSR_JORNADA(PCOD_EMPRESA   NUMBER,
                              PMATRICULA     NUMBER,
                              PDT_SAIDA_PARC IN DATE,
                              PDSR_JORNADA   IN OUT VARCHAR2,
                              PMSG_RETORNO   IN OUT VARCHAR2) RETURN BOOLEAN IS
    V_ESCALA  PE_ESCALAS.COD_ESCALA%TYPE;
    V_JORNADA PE_JORNADAS.COD_JORNADA%TYPE;
    V_COUNT   NUMBER;
  BEGIN
    PMSG_RETORNO := null;
    IF PDSR_JORNADA = 'N' THEN
      RETURN FALSE;
    END IF;
    V_ESCALA := Fnct_Pe_Retorna_Escala(PCOD_EMPRESA,
                                       PMATRICULA,
                                       PDT_SAIDA_PARC);
  
    IF V_ESCALA IS NULL THEN
      PMSG_RETORNO := 'Nao existe escala cadastrada para este colaborador na data "' ||
                      TO_CHAR(PDT_SAIDA_PARC, 'dd/mm/yyyy') || '"! ';
      PDSR_JORNADA := 'N';
      RETURN FALSE;
    END IF;
  
    V_JORNADA := Fnct_Pe_Retorna_Jornada(PCOD_EMPRESA,
                                         PMATRICULA,
                                         PDT_SAIDA_PARC);
  
    IF V_JORNADA IS NULL THEN
      PMSG_RETORNO := 'Nao existe jornada cadastrada para este colaborador na escala "' ||
                      V_ESCALA || '" e data "' ||
                      TO_CHAR(PDT_SAIDA_PARC, 'dd/mm/yyyy') || '"! ';
      PDSR_JORNADA := 'N';
      RETURN FALSE;
    END IF;
  
    BEGIN
      SELECT 'S'
        INTO PDSR_JORNADA
        FROM PE_JORNADAS J
       WHERE J.COD_JORNADA = V_JORNADA
            --Bruno Sousa - 07/08/2024 - Alterado de tipo_jornada para tipo_folga
            --AND J.TIPO_JORNADA in (2, 3); -- Jornada Variavel mensal e semanal
         AND J.TIPO_FOLGA = 1; -- Tipo Folga Variavel
    EXCEPTION
      WHEN OTHERS THEN
        PDSR_JORNADA := 'N';
        RETURN FALSE;
    END;
  
    --Verifica se o colaborador tem folga no dia
    SELECT COUNT(*)
      INTO V_COUNT
      FROM PE_FOLGAS F
     WHERE F.COD_EMPRESA = PCOD_EMPRESA
       AND F.MATRICULA = PMATRICULA
       AND F.DT_FOLGA = PDT_SAIDA_PARC;
  
    IF V_COUNT > 0 THEN
      PMSG_RETORNO := 'Colaborador de folga na data "' ||
                      TO_CHAR(PDT_SAIDA_PARC, 'dd/mm/yyyy') ||
                      '" selecionada! ';
      --PDSR_JORNADA := 'N';
      RETURN FALSE;
    END IF;
  
    SELECT COUNT(*)
      INTO V_COUNT
      FROM PE_JORNADAS_COMPOSICAO c, PE_JORNADAS J
    --Bruno Sousa - 07/08/2024 - Alterado de tipo_jornada para tipo_folga
    --WHERE J.TIPO_JORNADA in (2, 3) -- Jornada Variavel mensal e semanal
     WHERE J.TIPO_FOLGA = 1 -- Tipo Folga Variavel
       AND c.cod_jornada = j.cod_jornada
       AND J.COD_JORNADA = V_JORNADA
       AND ((TO_CHAR(PDT_SAIDA_PARC, 'D') = 1 AND C.DOMINGO = 'S') OR
           (TO_CHAR(PDT_SAIDA_PARC, 'D') = 2 AND C.SEGUNDA = 'S') OR
           (TO_CHAR(PDT_SAIDA_PARC, 'D') = 3 AND C.TERCA = 'S') OR
           (TO_CHAR(PDT_SAIDA_PARC, 'D') = 4 AND C.QUARTA = 'S') OR
           (TO_CHAR(PDT_SAIDA_PARC, 'D') = 5 AND C.QUINTA = 'S') OR
           (TO_CHAR(PDT_SAIDA_PARC, 'D') = 6 AND C.SEXTA = 'S') OR
           (TO_CHAR(PDT_SAIDA_PARC, 'D') = 7 AND C.SABADO = 'S'));
  
    RETURN(V_COUNT > 0);
  END VALIDA_DSR_JORNADA;
  --
  FUNCTION VALIDA_DT_SAIDA(PCOD_EMPRESA   NUMBER,
                           PMATRICULA     NUMBER,
                           PDT_SAIDA_PARC IN OUT DATE,
                           PMSG_RETORNO   IN OUT VARCHAR2) RETURN VARCHAR2 IS
    v_seg         FERIAS_PARAMETROS.seg%TYPE;
    v_ter         FERIAS_PARAMETROS.ter%TYPE;
    v_qua         FERIAS_PARAMETROS.qua%TYPE;
    v_qui         FERIAS_PARAMETROS.qui%TYPE;
    v_sex         FERIAS_PARAMETROS.sex%TYPE;
    v_sab         FERIAS_PARAMETROS.sab%TYPE;
    v_todos       FERIAS_PARAMETROS.todos%TYPE;
    v_proximo_dia FERIAS_PARAMETROS.proximo_dia%type;
    v_dsr_jornada FERIAS_PARAMETROS.DSR_JORNADA%type;
    v_dt_saida    DATE := PDT_SAIDA_PARC;
    V_FERIADO     FERIADO_LOCAL_X.DESCRICAO%TYPE;
    v_filial      INFORMACOES_FUNCIONAIS.FILIAL%TYPE;
  
    v_dia_ant_feriado BOOLEAN := DIA_ANTERIOR_EH_FERIADO(pcod_empresa,
                                                         pmatricula,
                                                         pdt_saida_parc);
  BEGIN
    SELECT I.FILIAL
      INTO v_filial
      FROM INFORMACOES_FUNCIONAIS I
     WHERE I.COD_EMPRESA = PCOD_EMPRESA
       AND I.MATRICULA = PMATRICULA;
  
    SELECT NVL(FER.seg, 'N'),
           NVL(FER.ter, 'N'),
           NVL(FER.qua, 'N'),
           NVL(FER.qui, 'N'),
           NVL(FER.sex, 'N'),
           NVL(FER.sab, 'N'),
           NVL(FER.todos, 'N'),
           NVL(FER.PROXIMO_DIA, 'N'),
           NVL(FER.DSR_JORNADA, 'N')
      INTO v_seg,
           v_ter,
           v_qua,
           v_qui,
           v_sex,
           v_sab,
           v_todos,
           v_proximo_dia,
           v_dsr_jornada
      FROM FERIAS_PARAMETROS fer
     WHERE fer.cod_empresa = PCOD_EMPRESA
       AND fer.cod_filial = v_filial;
  
    IF NVL(v_seg, 'N') = 'N' AND NVL(v_ter, 'N') = 'N' AND
       NVL(v_qua, 'N') = 'N' AND NVL(v_qui, 'N') = 'N' AND
       NVL(v_sex, 'N') = 'N' AND NVL(v_sab, 'N') = 'N' AND
       NVL(v_todos, 'N') = 'N' /*Alt.1*/
       AND NVL(v_dsr_jornada, 'N') = 'N' THEN
      v_todos := 'S';
    END IF;
  
    IF VALIDA_DSR_JORNADA(PCOD_EMPRESA,
                          PMATRICULA,
                          PDT_SAIDA_PARC,
                          v_dsr_jornada,
                          PMSG_RETORNO) THEN
      NULL;
    ELSIF v_dsr_jornada = 'N' AND v_todos = 'S' THEN
      NULL;
    ELSIF v_dsr_jornada = 'N' AND
          ((TO_CHAR(PDT_SAIDA_PARC, 'D') = 2 AND v_seg = 'S') OR
          (TO_CHAR(PDT_SAIDA_PARC, 'D') = 3 AND v_seg = 'S' AND
          v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
      NULL;
    ELSIF v_dsr_jornada = 'N' AND
          ((TO_CHAR(PDT_SAIDA_PARC, 'D') = 3 AND v_ter = 'S') OR
          (TO_CHAR(PDT_SAIDA_PARC, 'D') = 4 AND v_ter = 'S' AND
          v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
      NULL;
    ELSIF v_dsr_jornada = 'N' AND
          ((TO_CHAR(PDT_SAIDA_PARC, 'D') = 4 AND v_qua = 'S') OR
          (TO_CHAR(PDT_SAIDA_PARC, 'D') = 5 AND v_qua = 'S' AND
          v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
      NULL;
    ELSIF v_dsr_jornada = 'N' AND
          ((TO_CHAR(PDT_SAIDA_PARC, 'D') = 5 AND v_qui = 'S') OR
          (TO_CHAR(PDT_SAIDA_PARC, 'D') = 6 AND v_qui = 'S' AND
          v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
      NULL;
    ELSIF v_dsr_jornada = 'N' AND
          ((TO_CHAR(PDT_SAIDA_PARC, 'D') = 6 AND v_sex = 'S') OR
          (TO_CHAR(PDT_SAIDA_PARC, 'D') = 7 AND v_sex = 'S' AND
          v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
      NULL;
    ELSIF v_dsr_jornada = 'N' AND
          ((TO_CHAR(PDT_SAIDA_PARC, 'D') = 7 AND v_sab = 'S') OR
          (TO_CHAR(PDT_SAIDA_PARC, 'D') = 1 AND v_sab = 'S' AND
          v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
      NULL;
    ELSE
      IF v_dsr_jornada = 'S' THEN
      
        PMSG_RETORNO := 'Por regra de jornada o dia escolhido não é valido para saída de férias conforme DSR. ' ||
                        nvl(PMSG_RETORNO, ' ');
        RETURN('N');
      END IF;
    
      pmsg_retorno := NULL;
      IF v_seg = 'S' THEN
        pmsg_retorno := 'Por determinação da empresa, somente segunda-feira';
      END IF;
      IF v_ter = 'S' THEN
        IF pmsg_retorno IS NULL THEN
          pmsg_retorno := 'Por determinação da empresa, somente terça-feira';
        ELSIF v_qua <> 'S' AND v_qui <> 'S' AND v_sex <> 'S' AND
              v_sab <> 'S' THEN
          pmsg_retorno := pmsg_retorno || ' e terça-feira';
        ELSE
          pmsg_retorno := pmsg_retorno || ', terça-feira';
        END IF;
      END IF;
      IF v_qua = 'S' THEN
        IF pmsg_retorno IS NULL THEN
          pmsg_retorno := 'Por determinação da empresa, somente quarta-feira';
        ELSIF v_qui <> 'S' AND v_sex <> 'S' AND v_sab <> 'S' THEN
          pmsg_retorno := pmsg_retorno || ' e quarta-feira';
        ELSE
          pmsg_retorno := pmsg_retorno || ', quarta-feira';
        END IF;
      END IF;
      IF v_qui = 'S' THEN
        IF pmsg_retorno IS NULL THEN
          pmsg_retorno := 'Por determinação da empresa, somente quinta-feira';
        ELSIF v_sex <> 'S' AND v_sab <> 'S' THEN
          pmsg_retorno := pmsg_retorno || ' e quinta-feira';
        ELSE
          pmsg_retorno := pmsg_retorno || ', quinta-feira';
        END IF;
      END IF;
      IF v_sex = 'S' THEN
        IF pmsg_retorno IS NULL THEN
          pmsg_retorno := 'Por determinação da empresa, somente sexta-feira';
        ELSIF v_sab <> 'S' THEN
          pmsg_retorno := pmsg_retorno || ' e sexta-feira';
        ELSE
          pmsg_retorno := pmsg_retorno || ', sexta-feira';
        END IF;
      END IF;
      IF v_sab = 'S' THEN
        IF pmsg_retorno IS NULL THEN
          pmsg_retorno := 'Por determinação da empresa, somente sábado';
        ELSE
          pmsg_retorno := pmsg_retorno || ' e sábado';
        END IF;
      END IF;
      IF pmsg_retorno IS NOT NULL THEN
        IF INSTR(pmsg_retorno, ' e ') <> 0 THEN
          pmsg_retorno := pmsg_retorno ||
                          ' são dias válidos para saída de férias.';
        ELSE
          pmsg_retorno := pmsg_retorno ||
                          ' é dia válido para saída de férias.';
        END IF;
      END IF;
    
      RETURN('N');
    END IF;
  
    V_FERIADO := Fnct_Feriado(PCOD_EMPRESA,
                              v_filial,
                              PMATRICULA,
                              v_dt_saida);
  
    IF v_proximo_dia = 'N' THEN
      IF v_dt_saida IS NOT NULL AND
         (V_FERIADO IS NOT NULL OR
         Fnct_Feriado(PCOD_EMPRESA, v_filial, PMATRICULA, v_dt_saida + 1) IS NOT NULL OR
         Fnct_Feriado(PCOD_EMPRESA, v_filial, PMATRICULA, v_dt_saida + 2) IS NOT NULL) THEN
      
        if V_FERIADO is null then
          PMSG_RETORNO := 'Não é permitido o início das férias no período de dois dias que antecede um feriado!';
        else
          PMSG_RETORNO := 'Não é permitido o início das férias num feriado!';
        end if;
        RETURN('N');
      END IF;
    ELSE
      IF V_FERIADO IS NOT NULL THEN
        v_dt_saida := v_dt_saida + 1;
        V_FERIADO  := Fnct_Feriado(PCOD_EMPRESA,
                                   v_filial,
                                   PMATRICULA,
                                   v_dt_saida);
      
        PMSG_RETORNO := 'Feriado no dia escolhido! A data de saída alterada automaticamente para o dia ' ||
                        to_char(v_dt_saida, 'dd/mm/yyyy') || '!';
      END IF;
    
      IF v_dt_saida IS NOT NULL AND
         (V_FERIADO IS NOT NULL OR
         Fnct_Feriado(PCOD_EMPRESA, v_filial, PMATRICULA, v_dt_saida + 1) IS NOT NULL OR
         Fnct_Feriado(PCOD_EMPRESA, v_filial, PMATRICULA, v_dt_saida + 2) IS NOT NULL) THEN
      
        PMSG_RETORNO := 'Não é permitido o início das férias no período de dois dias que antecede um feriado!';
        RETURN('N');
      END IF;
    END IF;
  
    PDT_SAIDA_PARC := v_dt_saida;
    RETURN 'S';
  EXCEPTION
    WHEN OTHERS THEN
      PMSG_RETORNO := SUBSTR('Erro ao verificar feriado: ' || SQLERRM,
                             1,
                             4000) || ' ' || PCOD_EMPRESA || ' ' ||
                      PMATRICULA;
      RETURN('N');
  END VALIDA_DT_SAIDA;
  --
  -- Se a data de saída for maior que a data limite da limite_agend_ferias, retornar a data para ser
  -- exibida no alerta.
  FUNCTION DATA_SAIDA_PARC_VALIDA(PDT_SAIDA_PARC DATE,
                                  PCOD_EMPRESA   NUMBER,
                                  PFILIAL        NUMBER,
                                  PMATRICULA     NUMBER,
                                  PFLG_RETORNO   IN OUT VARCHAR2,
                                  PMSG_RETORNO   IN OUT VARCHAR2)
    RETURN VARCHAR2 IS
  BEGIN
  
    IF PDT_SAIDA_PARC IS NOT NULL AND
       (Fnct_Feriado(PCOD_EMPRESA, PFILIAL, PMATRICULA, PDT_SAIDA_PARC) IS NOT NULL OR
       Fnct_Feriado(PCOD_EMPRESA, PFILIAL, PMATRICULA, PDT_SAIDA_PARC + 1) IS NOT NULL OR
       Fnct_Feriado(PCOD_EMPRESA, PFILIAL, PMATRICULA, PDT_SAIDA_PARC + 2) IS NOT NULL) THEN
      PFLG_RETORNO := 'N';
      PMSG_RETORNO := 'Não é permitido o início das férias no período de dois dias que antecede um feriado!';
      RAISE VSAIDA_ERRO;
    ELSE
      RETURN('S');
    END IF;
  EXCEPTION
    WHEN VSAIDA_ERRO THEN
      RETURN('N');
    WHEN OTHERS THEN
      PFLG_RETORNO := 'N';
      PMSG_RETORNO := SUBSTR('Erro ao verificar feriado: ' || SQLERRM,
                             1,
                             4000);
      RETURN('N');
  END DATA_SAIDA_PARC_VALIDA;

  PROCEDURE PRC_USUARIO_FERIAS_APEX(TIPO                NUMBER,
                                    PCOD_EMPRESA        NUMBER,
                                    PMATRICULA          NUMBER,
                                    PDT_INIC_PER_FERIAS DATE,
                                    PDT_FIM_PER_FERIAS  DATE,
                                    PFLG_RETORNO        IN OUT VARCHAR2,
                                    PMSG_RETORNO        IN OUT VARCHAR2,
                                    PUSUARIO            VARCHAR2 DEFAULT NULL) IS
  BEGIN
    NULL;
    /*
      IF TIPO = 1 THEN
        UPDATE FERIAS
           SET USUARIO_PROG        = PUSUARIO,
               DT_ATUALIZACAO_PROG = SYSDATE
         WHERE COD_EMPRESA = PCOD_EMPRESA
           AND MATRICULA = PMATRICULA
           AND DT_INIC_PER_FERIAS = PDT_INIC_PER_FERIAS
           AND DT_FIM_PER_FERIAS = PDT_FIM_PER_FERIAS;
      ELSIF TIPO = 2 THEN
        UPDATE FERIAS
           SET USUARIO_PROG2        = PUSUARIO,
               DT_ATUALIZACAO_PROG2 = SYSDATE
         WHERE COD_EMPRESA = PCOD_EMPRESA
           AND MATRICULA = PMATRICULA
           AND DT_INIC_PER_FERIAS = PDT_INIC_PER_FERIAS
           AND DT_FIM_PER_FERIAS = PDT_FIM_PER_FERIAS;
    
      ELSIF TIPO = 3 THEN
    
        UPDATE FERIAS
           SET USUARIO_PROG_COL        = PUSUARIO,
               DT_ATUALIZACAO_PROG_COL = SYSDATE
         WHERE COD_EMPRESA = PCOD_EMPRESA
           AND MATRICULA = PMATRICULA
           AND DT_INIC_PER_FERIAS = PDT_INIC_PER_FERIAS
           AND DT_FIM_PER_FERIAS = PDT_FIM_PER_FERIAS;
    
      ELSIF TIPO = 4 THEN
        UPDATE FERIAS
           SET USUARIO_PROG4        = PUSUARIO,
               DT_ATUALIZACAO_PROG4 = SYSDATE
         WHERE COD_EMPRESA = PCOD_EMPRESA
           AND MATRICULA = PMATRICULA
           AND DT_INIC_PER_FERIAS = PDT_INIC_PER_FERIAS
           AND DT_FIM_PER_FERIAS = PDT_FIM_PER_FERIAS;
    
      END IF;
      
    
    EXCEPTION
      WHEN OTHERS THEN
        PFLG_RETORNO := 'N';
        PMSG_RETORNO := SUBSTR('Erro ao Atualizar tabela de Férias: ' || SQLERRM,1,4000);
      */
  END PRC_USUARIO_FERIAS_APEX;
  --
  FUNCTION funcFeriasParamParcela_APEX(pEmp    IN NUMBER,
                                       pFilial IN NUMBER,
                                       pParc1  IN NUMBER, -- num_dias_parc1
                                       pParc2  IN NUMBER, -- num_dias_parc2
                                       pParc3  IN NUMBER -- num_dias_parc4
                                       ) RETURN BOOLEAN IS
    vReturn   BOOLEAN DEFAULT FALSE;
    vSomaParc NUMBER(5) DEFAULT 0;
    --vSomaMaior BOOLEAN DEFAULT TRUE;
    --
    CURSOR curFerPar IS
      SELECT x.cod,
             x.dias_direito,
             x.qtd_parcelas,
             x.num_dias_parc1,
             x.num_dias_parc2,
             x.num_dias_parc4
        FROM ferias_parametros_parcelas x
       WHERE x.cod_empresa = pEmp
         AND x.cod_filial = pFilial
         AND (NVL(x.num_dias_parc1, 0) = NVL(pParc1, x.num_dias_parc1) OR
             NVL(x.num_dias_parc2, 0) = NVL(pParc1, x.num_dias_parc2) OR
             NVL(x.num_dias_parc4, 0) = NVL(pParc1, x.num_dias_parc4))
         AND (NVL(x.num_dias_parc1, 0) = NVL(pParc2, x.num_dias_parc1) OR
             NVL(x.num_dias_parc2, 0) = NVL(pParc2, x.num_dias_parc2) OR
             NVL(x.num_dias_parc4, 0) = NVL(pParc2, x.num_dias_parc4))
         AND (NVL(x.num_dias_parc1, 0) = NVL(pParc3, x.num_dias_parc1) OR
             NVL(x.num_dias_parc2, 0) = NVL(pParc3, x.num_dias_parc2) OR
             NVL(x.num_dias_parc4, 0) = NVL(pParc3, x.num_dias_parc4))
       ORDER BY 1;
    --
    TYPE typ_FerPar IS TABLE OF curFerPar%ROWTYPE INDEX BY BINARY_INTEGER;
    tabFerPar typ_FerPar;
  BEGIN
    --
    vSomaParc := (NVL(pParc1, 0) + NVL(pParc2, 0) + NVL(pParc3, 0));
    --
    FOR Rec IN curFerPar LOOP
      tabFerPar(tabFerPar.COUNT + 1) := Rec;
    END LOOP;
    --
    IF tabFerPar.COUNT > 0 THEN
      IF tabFerPar.COUNT = 1 THEN
        IF vSomaParc <= tabFerPar(1).dias_direito THEN
          IF (pParc1 IS NOT NULL AND pParc2 IS NOT NULL AND
             pParc3 IS NOT NULL AND tabFerpar(1).qtd_parcelas = 3) THEN
            IF NVL(tabFerPar(1).num_dias_parc1, 0) IN
               (NVL(pParc1, 0), NVL(pParc2, 0), NVL(pParc3, 0)) AND
               NVL(tabFerPar(1).num_dias_parc2, 0) IN
               (NVL(pParc1, 0), NVL(pParc2, 0), NVL(pParc3, 0)) AND
               NVL(tabFerPar(1).num_dias_parc4, 0) IN
               (NVL(pParc1, 0), NVL(pParc2, 0), NVL(pParc3, 0)) THEN
              vReturn := TRUE;
            END IF;
          ELSE
            IF (pParc1 IS NOT NULL AND pParc2 IS NULL AND pParc3 IS NULL AND
               (tabFerpar(1).qtd_parcelas = 1 or tabFerPar(1).dias_direito = 30)) THEN
              IF NVL(tabFerPar(1).num_dias_parc1, 0) IN
                 (NVL(pParc1, 0), NVL(pParc2, 0), NVL(pParc3, 0)) OR
                 NVL(tabFerPar(1).num_dias_parc2, 0) IN
                 (NVL(pParc1, 0), NVL(pParc2, 0), NVL(pParc3, 0)) OR
                 NVL(tabFerPar(1).num_dias_parc4, 0) IN
                 (NVL(pParc1, 0), NVL(pParc2, 0), NVL(pParc3, 0)) THEN
                vReturn := TRUE;
              END IF;
            ELSIF (pParc1 IS NOT NULL AND pParc2 IS NOT NULL AND
                  pParc3 IS NULL AND
                  (tabFerpar(1).qtd_parcelas = 2 or tabFerPar(1).dias_direito = 30)) THEN
              IF NVL(tabFerPar(1).num_dias_parc1, 0) IN
                 (NVL(pParc1, 0), NVL(pParc2, 0), NVL(pParc3, 0)) AND
                 NVL(tabFerPar(1).num_dias_parc2, 0) IN
                 (NVL(pParc1, 0), NVL(pParc2, 0), NVL(pParc3, 0)) OR
                 NVL(tabFerPar(1).num_dias_parc4, 0) IN
                 (NVL(pParc1, 0), NVL(pParc2, 0), NVL(pParc3, 0)) THEN
                vReturn := TRUE;
              END IF;
            END IF;
          END IF;
        END IF;
      ELSE
        FOR i IN tabFerPar.FIRST .. tabFerPar.LAST LOOP
          -->> MSS 20220531 IF vSomaParc <= tabFerPar(i).dias_direito THEN
          IF vSomaParc <= tabFerPar(i).dias_direito THEN
            --<<
            IF (pParc1 IS NOT NULL AND pParc2 IS NOT NULL AND
               pParc3 IS NOT NULL /*AND tabFerpar(i).qtd_parcelas = 3*/
               ) THEN
              IF NVL(tabFerPar(i).num_dias_parc1, 0) IN
                 (NVL(pParc1, 0), NVL(pParc2, 0), NVL(pParc3, 0)) AND
                 NVL(tabFerPar(i).num_dias_parc2, 0) IN
                 (NVL(pParc1, 0), NVL(pParc2, 0), NVL(pParc3, 0)) AND
                 NVL(tabFerPar(i).num_dias_parc4, 0) IN
                 (NVL(pParc1, 0), NVL(pParc2, 0), NVL(pParc3, 0)) THEN
                vReturn := TRUE;
                EXIT;
              END IF;
            ELSE
              IF (pParc1 IS NOT NULL AND pParc2 IS NULL AND pParc3 IS NULL /*AND tabFerpar(i).qtd_parcelas = 1*/
                 ) THEN
                IF NVL(tabFerPar(i).num_dias_parc1, 0) IN
                   (NVL(pParc1, 0), NVL(pParc2, 0), NVL(pParc3, 0)) OR
                   NVL(tabFerPar(i).num_dias_parc2, 0) IN
                   (NVL(pParc1, 0), NVL(pParc2, 0), NVL(pParc3, 0)) OR
                   NVL(tabFerPar(i).num_dias_parc4, 0) IN
                   (NVL(pParc1, 0), NVL(pParc2, 0), NVL(pParc3, 0)) THEN
                  vReturn := TRUE;
                  EXIT;
                END IF;
              ELSIF (pParc1 IS NOT NULL AND pParc2 IS NOT NULL AND
                    pParc3 IS NULL /*AND tabFerpar(i).qtd_parcelas = 2*/
                    ) THEN
                IF NVL(tabFerPar(i).num_dias_parc1, 0) IN
                   (NVL(pParc1, 0), NVL(pParc2, 0), NVL(pParc3, 0)) AND
                   NVL(tabFerPar(i).num_dias_parc2, 0) IN
                   (NVL(pParc1, 0), NVL(pParc2, 0), NVL(pParc3, 0)) OR
                   NVL(tabFerPar(i).num_dias_parc4, 0) IN
                   (NVL(pParc1, 0), NVL(pParc2, 0), NVL(pParc3, 0)) THEN
                  vReturn := TRUE;
                  EXIT;
                END IF;
              END IF;
            END IF;
          END IF;
        END LOOP;
      END IF;
    END IF;
    --
    RETURN(vReturn);
  END funcFeriasParamParcela_APEX;
  -- Função que verifica se o usuário pode ou não cancelar a requisição, quando ela estiver Concluída (Sit.2)
  FUNCTION PERMISSAO_CANC_REQ_CONCLUIDA(PSOLICITACAO    NUMBER,
                                        PCOD_EMPRESA    NUMBER,
                                        PMATRICULA      NUMBER,
                                        PUSUARIO_LOGADO VARCHAR2)
    RETURN VARCHAR2 IS
    --
    CURSOR PARAM_FER IS
      SELECT P.DIAS_ANTES_PAGTO_FERIAS,
             P.IND_PERMISSAO_CANCELA_FERIAS,
             REPLACE(TO_CHAR(CC.COD_EMP_GESTOR, '000') ||
                     TO_CHAR(CC.MATRICULA_GESTOR, '000000'),
                     ' ',
                     '') GESTOR_CC,
             (SELECT REPLACE(TO_CHAR(UO.CD_EMPRESA, '000') ||
                             TO_CHAR(UO.CD_MATRICULA, '000000'),
                             ' ',
                             '') GESTOR_UO
                FROM USUARIO_ORACLE UO
               WHERE NM_USUARIO_ORACLE = pusuario_logado) GESTOR_UO -- EMP_MAT_LOGADO
            ,
             F.IND_SITUACAO_PARC_1,
             F.DT_SAIDA_PARC1,
             F.IND_SITUACAO_PARC_2,
             F.DT_SAIDA_PARC2,
             F.IND_SITUACAO_PARC_4,
             F.DT_SAIDA_PARC4,
             REQ_F.SIT_REQUISICAO,
             iff.cod_empresa,
             iff.cod_ccusto,
             iff.cod_sub_ccusto
        FROM INFORMACOES_FUNCIONAIS_CAD IFF,
             FERIAS_PARAMETROS          P,
             CENTRO_DE_CUSTO            CC,
             FERIAS                     F,
             REQUISICAO_FERIAS          REQ_F
       WHERE F.DT_INIC_PER_FERIAS = REQ_F.DT_INIC_PER_FERIAS
         AND F.MATRICULA = IFF.MATRICULA
         AND F.COD_EMPRESA = IFF.COD_EMPRESA
         AND CC.COD = IFF.COD_CCUSTO
         AND CC.COD_EMPRESA = IFF.COD_EMPRESA
         AND P.COD_FILIAL = IFF.FILIAL
         AND P.COD_EMPRESA = IFF.COD_EMPRESA
         AND REQ_F.COD_SOLICITACAO = PSOLICITACAO
         AND REQ_F.MATRICULA = IFF.MATRICULA
         AND REQ_F.COD_EMPRESA = IFF.COD_EMPRESA
         AND IFF.MATRICULA = PMATRICULA
         AND IFF.COD_EMPRESA = PCOD_EMPRESA;
    V_PARAM_FER PARAM_FER%ROWTYPE;
    --
    CURSOR cSubCC(pEmp   IN informacoes_funcionais_cad.cod_empresa%TYPE,
                  pCCst  IN informacoes_funcionais_cad.cod_ccusto%TYPE,
                  pSubCC IN informacoes_funcionais_cad.cod_sub_ccusto%TYPE) IS
      SELECT x.cod_emp_gestor,
             x.mat_gestor,
             REPLACE(TO_CHAR(x.cod_emp_gestor, '000') ||
                     TO_CHAR(x.mat_gestor, '000000'),
                     ' ',
                     '') GESTOR_SUBCC
        FROM sub_ccusto x
       WHERE x.cod_empresa = pEmp
         AND x.cod_ccusto = pCCst
         AND x.cod_sub_ccusto = pSubCC;
    --
    rSubCC cSubCC%ROWTYPE;
    --
    VSUPLENTE_VALIDO VARCHAR2(1) := 'N';
    --
  BEGIN
    --
    IF PARAM_FER%ISOPEN THEN
      CLOSE PARAM_FER;
    END IF;
    OPEN PARAM_FER;
    FETCH PARAM_FER
      INTO V_PARAM_FER;
    CLOSE PARAM_FER;
    --
    IF V_PARAM_FER.DIAS_ANTES_PAGTO_FERIAS IS NULL THEN
      --      RAISE_APPLICATION_ERROR(-20110,'V_PARAM_FER.DIAS_ANTES_PAGTO_FERIAS IS NULL');
      RETURN('Alteração não permitida. Procure o RH.');
    ELSE
      --
      IF V_PARAM_FER.IND_PERMISSAO_CANCELA_FERIAS IS NULL THEN
        RETURN('Alteração não permitida. Procure o RH.');
      ELSIF PUSUARIO_LOGADO = 'PORTAL' THEN
        -- MSS 20220818 IF V_PARAM_FER.IND_PERMISSAO_CANCELA_FERIAS = 'G' THEN
        IF V_PARAM_FER.IND_PERMISSAO_CANCELA_FERIAS <> 'A' THEN
          RETURN('Alteração permitida somente pelo Gestor.');
        END IF;
      ELSIF PUSUARIO_LOGADO <> 'PORTAL' AND
            V_PARAM_FER.IND_PERMISSAO_CANCELA_FERIAS IN ('A', 'G') AND
            V_PARAM_FER.GESTOR_CC <> NVL(V_PARAM_FER.GESTOR_UO, 'X') THEN
        -- MSS 20220818
        OPEN cSubCC(V_PARAM_FER.cod_empresa,
                    V_PARAM_FER.cod_ccusto,
                    V_PARAM_FER.cod_sub_ccusto);
        FETCH cSubCC
          INTO rSubCC;
        CLOSE cSubCC;
        --
        IF NVL(rSubCC.gestor_subcc, 'Z') <> NVL(V_PARAM_FER.GESTOR_UO, 'X') THEN
          BEGIN
            -- Incluso validação para permitir cancelamento pelo Suplente ou Substituto do aprovador (Adriana 25/11/2022)
            SELECT DISTINCT 'S'
              INTO VSUPLENTE_VALIDO
              FROM APROVA_FERIAS af
             WHERE (EXISTS
                    (SELECT DISTINCT 1
                       FROM REQUISICAO_FERIAS          RF,
                            INFORMACOES_FUNCIONAIS_CAD IFF
                      WHERE (EXISTS
                             (SELECT 1
                                FROM SUB_CCUSTO SC
                               WHERE SC.MAT_SUBS = PMATRICULA
                                 AND SC.COD_EMP_SUBS = PCOD_EMPRESA
                                 AND SC.MAT_GESTOR = AF.MAT_APROV
                                 AND SC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                                 AND SC.COD_SUB_CCUSTO = IFF.COD_SUB_CCUSTO
                                 AND SC.COD_CCUSTO = IFF.COD_CCUSTO
                                 AND SC.COD_EMPRESA = IFF.COD_EMPRESA) OR
                             EXISTS
                             (SELECT 1
                                FROM CENTRO_DE_CUSTO CC
                               WHERE CC.MATRICULA_SUPLENTE = PMATRICULA
                                 AND CC.COD_EMP_SUPLENTE = PCOD_EMPRESA
                                 AND CC.MATRICULA_GESTOR = AF.MAT_APROV
                                 AND CC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                                 AND CC.COD = IFF.COD_CCUSTO
                                 AND CC.COD_EMPRESA = IFF.COD_EMPRESA) OR
                             EXISTS
                             (SELECT 1
                                FROM REQUISICAO_FERIAS          RF2,
                                     INFORMACOES_FUNCIONAIS_CAD IFF2,
                                     CENTRO_DE_CUSTO            CC2,
                                     CENTRO_DE_CUSTO            CCS
                               WHERE CCS.MATRICULA_SUPLENTE = PMATRICULA
                                 AND CCS.COD_EMP_SUPLENTE = PCOD_EMPRESA
                                 AND CCS.COD = CC2.COD_CCUSTO_SUPERIOR
                                 AND CCS.COD_EMPRESA = CC2.COD_EMPRESA
                                 AND CC2.MATRICULA_GESTOR = RF2.MATRICULA
                                 AND CC2.COD_EMP_GESTOR = RF2.COD_EMPRESA
                                 AND CC2.COD = IFF2.COD_CCUSTO
                                 AND CC2.COD_EMPRESA = IFF2.COD_EMPRESA
                                 AND IFF2.MATRICULA = RF2.MATRICULA
                                 AND IFF2.COD_EMPRESA = RF2.COD_EMPRESA
                                 AND RF2.COD_SOLICITACAO = psolicitacao))
                        AND IFF.MATRICULA = RF.MATRICULA
                        AND IFF.COD_EMPRESA = RF.COD_EMPRESA
                        AND RF.COD_SOLICITACAO = psolicitacao) OR
                    (af.mat_aprov = PMATRICULA AND
                    af.cod_emp_aprov = PCOD_EMPRESA))
                  --            AND    af.status_aprov = 'P'
               AND af.cod_solicitacao = psolicitacao
               AND af.cod_empresa = pcod_empresa;
          EXCEPTION
            WHEN NO_DATA_FOUND THEN
              VSUPLENTE_VALIDO := 'N';
          END;
          --
          IF VSUPLENTE_VALIDO = 'N' THEN
            RETURN('Alteração permitida somente pelo Gestor da Área.');
          END IF;
        END IF;
      END IF;
      --
      IF V_PARAM_FER.DT_SAIDA_PARC1 IS NOT NULL THEN
        IF NVL(V_PARAM_FER.IND_SITUACAO_PARC_1, 'X') <> 'C' AND
           (V_PARAM_FER.DT_SAIDA_PARC1 - TRUNC(SYSDATE)) + 1 >=
           V_PARAM_FER.DIAS_ANTES_PAGTO_FERIAS THEN
          --            RAISE_APPLICATION_ERROR(-20114,'PARC 1 OK');
          RETURN('');
        ELSE
          --            RAISE_APPLICATION_ERROR(-20110,'PARC 1 NOK');
          --
          IF V_PARAM_FER.DT_SAIDA_PARC2 IS NOT NULL THEN
            IF NVL(V_PARAM_FER.IND_SITUACAO_PARC_2, 'X') <> 'C' AND
               (V_PARAM_FER.DT_SAIDA_PARC2 - TRUNC(SYSDATE)) + 1 >=
               V_PARAM_FER.DIAS_ANTES_PAGTO_FERIAS THEN
              --            RAISE_APPLICATION_ERROR(-20114,'PARC 2 OK');
              RETURN('');
            ELSE
              --
              IF V_PARAM_FER.DT_SAIDA_PARC4 IS NOT NULL THEN
                IF NVL(V_PARAM_FER.IND_SITUACAO_PARC_4, 'X') <> 'C' AND
                   (V_PARAM_FER.DT_SAIDA_PARC4 - TRUNC(SYSDATE)) + 1 >=
                   V_PARAM_FER.DIAS_ANTES_PAGTO_FERIAS THEN
                  --            RAISE_APPLICATION_ERROR(-20114,'PARC 4 OK');
                  RETURN('');
                ELSE
                  --            RAISE_APPLICATION_ERROR(-20110,'PARC 4 NOK');
                  IF NVL(V_PARAM_FER.IND_SITUACAO_PARC_4, 'X') = 'C' THEN
                    RETURN('Alteração não permitida. A 3a Parcela já foi calculada.');
                  ELSIF (V_PARAM_FER.DT_SAIDA_PARC4 - TRUNC(SYSDATE)) + 1 <
                        V_PARAM_FER.DIAS_ANTES_PAGTO_FERIAS THEN
                    RETURN('Alteração não permitida. Prazo para cancelamento da 3a Parcela expirou em ' ||
                           TO_CHAR((V_PARAM_FER.DT_SAIDA_PARC4 -
                                   V_PARAM_FER.DIAS_ANTES_PAGTO_FERIAS) + 1,
                                   'DD/MM/RRRR') || '.');
                  END IF;
                END IF;
                --
              ELSE
                IF NVL(V_PARAM_FER.IND_SITUACAO_PARC_2, 'X') = 'C' THEN
                  RETURN('Alteração não permitida. A 2a Parcela já foi calculada.');
                ELSIF (V_PARAM_FER.DT_SAIDA_PARC2 - TRUNC(SYSDATE)) + 1 <
                      V_PARAM_FER.DIAS_ANTES_PAGTO_FERIAS THEN
                  RETURN('Alteração não permitida. Prazo para cancelamento da 2a Parcela expirou em ' ||
                         TO_CHAR((V_PARAM_FER.DT_SAIDA_PARC2 -
                                 V_PARAM_FER.DIAS_ANTES_PAGTO_FERIAS) + 1,
                                 'DD/MM/RRRR') || '.');
                END IF;
              END IF;
              --
            END IF;
            --
          ELSE
            IF NVL(V_PARAM_FER.IND_SITUACAO_PARC_1, 'X') = 'C' THEN
              RETURN('Alteração não permitida. A 1a Parcela já foi calculada.');
            ELSIF (V_PARAM_FER.DT_SAIDA_PARC1 - TRUNC(SYSDATE)) + 1 <
                  V_PARAM_FER.DIAS_ANTES_PAGTO_FERIAS THEN
              RETURN('Alteração não permitida. Prazo para cancelamento da 1a Parcela expirou em ' ||
                     TO_CHAR((V_PARAM_FER.DT_SAIDA_PARC1 -
                             V_PARAM_FER.DIAS_ANTES_PAGTO_FERIAS) + 1,
                             'DD/MM/RRRR') || '.');
            END IF;
          END IF;
          --
        END IF;
        --
      END IF;
      --
      RETURN('');
      --
    END IF;
    --
  END PERMISSAO_CANC_REQ_CONCLUIDA;
  --
  PROCEDURE EXCLUI_PARCELAS(PSOLICITACAO      NUMBER,
                            PUSUARIO          VARCHAR2,
                            PFLG_RETORNO      OUT VARCHAR2,
                            PMSG_RETORNO      OUT VARCHAR2,
                            PVOLTA_STATUS_REQ VARCHAR2 DEFAULT 'S') IS
    --
    VPOSICAO      VARCHAR2(100);
    vdt_ref_FOLHA parametros_recursos_humanos.dt_ref_ferias%TYPE;
    v_processos   VARCHAR2(400) := NULL;
    vl_verificar  NUMBER(1);
    --    v_parcela        number(1);
    --
    VEXISTE_PARCELAS         VARCHAR2(1) := 'S'; -- para verificar se restaram parcelas na tabela ferias
    vDIAS_ANTES_PAGTO_FERIAS FERIAS_PARAMETROS.DIAS_ANTES_PAGTO_FERIAS%TYPE;
    VUSUARIO                 VARCHAR2(30) := SUBSTR(PUSUARIO || 'PkgFer',
                                                    1,
                                                    30);
    VPARCELAS_CANCELADAS     VARCHAR2(10);
    VSAIDA_ERRO              EXCEPTION;
    --
    CURSOR C_REQ_FERIAS IS
      SELECT *
        FROM REQUISICAO_FERIAS RF
       WHERE RF.COD_SOLICITACAO = PSOLICITACAO;
    R_REQ_FERIAS C_REQ_FERIAS%ROWTYPE;
    --
    CURSOR C_FERIAS(PCOD_EMPRESA        NUMBER,
                    PMATRICULA          NUMBER,
                    PDT_INIC_PER_FERIAS DATE) IS
      SELECT IFF.FILIAL, F.*
        FROM FERIAS F, INFORMACOES_FUNCIONAIS_CAD IFF
       WHERE IFF.MATRICULA = F.MATRICULA
         AND IFF.COD_EMPRESA = F.COD_EMPRESA
         AND F.DT_INIC_PER_FERIAS = PDT_INIC_PER_FERIAS
         AND F.MATRICULA = PMATRICULA
         AND F.COD_EMPRESA = PCOD_EMPRESA;
    R_FERIAS C_FERIAS%ROWTYPE;
    --
    FUNCTION EXISTE_PARCELA(P_PARCELA NUMBER) RETURN VARCHAR2 IS
      VEXISTE_PARCELA VARCHAR2(1) := 'N';
    BEGIN
      --
      SELECT DISTINCT 'S'
        INTO VEXISTE_PARCELA
        FROM FERIAS
       WHERE ((P_PARCELA = 2 AND DT_SAIDA_PARC2 IS NOT NULL) OR
             (P_PARCELA = 4 AND DT_SAIDA_PARC4 IS NOT NULL))
         AND DT_INIC_PER_FERIAS = R_FERIAS.DT_INIC_PER_FERIAS
         AND MATRICULA = R_FERIAS.MATRICULA
         AND COD_EMPRESA = R_FERIAS.COD_EMPRESA;
      --
      IF NVL(VEXISTE_PARCELA, 'N') = 'S' THEN
        RETURN('S');
      ELSE
        RETURN('N');
      END IF;
      --
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        RETURN('N');
      WHEN OTHERS THEN
        RAISE_APPLICATION_ERROR(-20010,
                                'Existe_Parcela_Posterior Erro: ' ||
                                SQLERRM);
    END EXISTE_PARCELA;
    --
    PROCEDURE EXCLUI_PARC1 IS
    BEGIN
      --
      PFLG_RETORNO := 'S';
      --
      VPOSICAO := '1';
      IF EXISTE_PARCELA(2) = 'S' THEN
        VPOSICAO := VPOSICAO || ',2';
        --    AVISO('Você deve limpar a 2ª parcela antes de limpar a 1ª!');
        Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(PSOLICITACAO,
                                                     SUBSTR(PUSUARIO ||
                                                            'PkgFer',
                                                            1,
                                                            30) ||
                                                     '-Você deve limpar a 2ª parcela antes de limpar a 1ª!',
                                                     'N',
                                                     'REQ_FERIAS');
        PFLG_RETORNO := 'S';
        RAISE VSAIDA_ERRO;
      ELSIF EXISTE_PARCELA(4) = 'S' THEN
        VPOSICAO := VPOSICAO || ',3';
        --    AVISO('Você deve limpar a 3ª parcela antes de limpar a 1ª!');
        Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(PSOLICITACAO,
                                                     SUBSTR(PUSUARIO ||
                                                            'PkgFer',
                                                            1,
                                                            30) ||
                                                     '-Você deve limpar a 3ª parcela antes de limpar a 1ª!',
                                                     'N',
                                                     'REQ_FERIAS');
        PFLG_RETORNO := 'S';
        RAISE VSAIDA_ERRO;
      END IF;
      --
      VPOSICAO := VPOSICAO || ',4';
      IF TRUNC(R_FERIAS.DT_SAIDA_PARC1, 'MM') = TRUNC(VDT_REF_FOLHA, 'MM') THEN
        VPOSICAO    := VPOSICAO || ',5';
        v_processos := NULL;
        v_processos := Pkg_Verif_Proc.F_F010332I(R_FERIAS.cod_empresa,
                                                 vdt_ref_FOLHA);
        --
        IF v_processos IS NOT NULL THEN
          VPOSICAO     := VPOSICAO || ',6';
          PFLG_RETORNO := 'N';
          PMSG_RETORNO := 'Processo de Cancelamento da Programação de Férias não permitido. Nesse momento há os seguintes processos de cálculo sendo executados => ' ||
                          v_processos;
          Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(PSOLICITACAO,
                                                       SUBSTR(PUSUARIO ||
                                                              'PkgFer',
                                                              1,
                                                              30) ||
                                                       '-Processo de Cancelamento da Programação de Férias não permitido. Nesse momento há os seguintes processos de cálculo sendo executados => ' ||
                                                       v_processos,
                                                       'N',
                                                       'REQ_FERIAS');
          RAISE VSAIDA_ERRO;
        END IF;
      END IF;
      VPOSICAO := VPOSICAO || ',7';
      --
      insere_log_calculo(R_FERIAS.cod_empresa,
                         'FERIA',
                         vdt_ref_FOLHA,
                         1,
                         0,
                         0,
                         NULL,
                         NULL,
                         R_FERIAS.cod_empresa,
                         R_FERIAS.cod_empresa,
                         NULL,
                         NULL,
                         NULL,
                         NULL,
                         SYSDATE,
                         SYSDATE,
                         VUSUARIO,
                         SYSDATE);
      --
      BEGIN
        VPOSICAO     := VPOSICAO || ',8';
        vl_verificar := NULL;
        SELECT 1
          INTO vl_verificar
          FROM ferias
         WHERE cod_empresa = R_FERIAS.cod_empresa
           AND matricula = R_FERIAS.matricula
           AND TRUNC(DT_INIC_PER_FERIAS) > R_FERIAS.DT_INIC_PER_FERIAS
           AND (TRUNC(DT_SAIDA_PARC1) > R_FERIAS.DT_SAIDA_PARC1 OR
               TRUNC(DT_SAIDA_PARC2) > R_FERIAS.DT_SAIDA_PARC1);
      EXCEPTION
        WHEN OTHERS THEN
          VPOSICAO     := VPOSICAO || ',9';
          VL_VERIFICAR := 0;
      END;
      --
      VPOSICAO := VPOSICAO || ',10';
      IF VL_VERIFICAR = 1 THEN
        VPOSICAO := VPOSICAO || ',11';
        --        AVISO('Funcionário com Programação em Periodos Superiores a  '||TO_CHAR(:ferias.DT_INIC_PER_FERIAS,'DD/MM/YYYY'));
        Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(PSOLICITACAO,
                                                     SUBSTR(PUSUARIO ||
                                                            'PkgFer',
                                                            1,
                                                            30) ||
                                                     '-Funcionário com Programação em Periodos Superiores a  ' ||
                                                     TO_CHAR(R_FERIAS.DT_INIC_PER_FERIAS,
                                                             'DD/MM/YYYY'),
                                                     'N',
                                                     'REQ_FERIAS');
        PFLG_RETORNO := 'S';
        RAISE VSAIDA_ERRO;
      ELSE
        VPOSICAO := VPOSICAO || ',12';
        IF R_FERIAS.IND_SITUACAO_PERIODO <> 'P' THEN
          VPOSICAO := VPOSICAO || ',13';
          --          AVISO('Funcionário com Programação de Férias já gozadas!');
          Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(PSOLICITACAO,
                                                       SUBSTR(PUSUARIO ||
                                                              'PkgFer',
                                                              1,
                                                              30) ||
                                                       '-Funcionário com Programação de Férias já gozadas!',
                                                       'N',
                                                       'REQ_FERIAS');
          PFLG_RETORNO := 'S';
          RAISE VSAIDA_ERRO;
        ELSE
          VPOSICAO := VPOSICAO || ',14: ' || R_FERIAS.COD_EMPRESA || '/' ||
                      R_FERIAS.MATRICULA || '/' ||
                      TO_CHAR(R_FERIAS.DT_INIC_PER_FERIAS, 'DD/MM/RRRR');
          UPDATE FERIAS
             SET DT_SAIDA_PARC1   = NULL,
                 NUM_DIAS_PARC1   = NULL,
                 DIAS_ABONO_PEC1  = NULL,
                 DESC_ADICIONAL1  = NULL,
                 OPCAO_13SAL1     = NULL,
                 DT_RETORNO_PARC1 = NULL,
                 TIPO_FERIAS1     = NULL,
                 DT_PAGTO_PARC1   = NULL,
                 COD_SOLICITACAO  = NULL,
                 Usuario          = SUBSTR(PUSUARIO || 'PkgFer', 1, 30),
                 DT_ATUALIZACAO   = SYSDATE,
                 OBSERVACOES      = SUBSTR('Parcela 1(Dt. Saída: ' ||
                                           TO_CHAR(R_FERIAS.DT_SAIDA_PARC1,
                                                   'DD/MM/RRRR') ||
                                           ') cancelada através da requisição ' ||
                                           PSOLICITACAO || ' por ' ||
                                           pusuario || ';' || OBSERVACOES,
                                           1,
                                           3000)
           WHERE DT_SAIDA_PARC1 IS NOT NULL
             AND DT_INIC_PER_FERIAS = R_FERIAS.DT_INIC_PER_FERIAS
             AND MATRICULA = R_FERIAS.MATRICULA
             AND COD_EMPRESA = R_FERIAS.COD_EMPRESA;
          --
          Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(PSOLICITACAO,
                                                       SUBSTR(PUSUARIO ||
                                                              'PkgFer',
                                                              1,
                                                              30) ||
                                                       'EXCLUIU A 1ª PARCELA',
                                                       'N',
                                                       'REQ_FERIAS');
          --
          IF SQL%FOUND THEN
            VPOSICAO             := VPOSICAO || ',15';
            VPARCELAS_CANCELADAS := '1' || VPARCELAS_CANCELADAS;
            Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(PSOLICITACAO,
                                                         SUBSTR(PUSUARIO ||
                                                                'PkgFer',
                                                                1,
                                                                30) ||
                                                         '-Parcela 1 excluída da tabela ferias (dt_saida_parc1: ' ||
                                                         TO_CHAR(R_FERIAS.DT_SAIDA_PARC1,
                                                                 'DD/MM/RRRR') ||
                                                         ',dt_retorno_parc1: ' ||
                                                         TO_CHAR(R_FERIAS.DT_RETORNO_PARC1,
                                                                 'DD/MM/RRRR') || ')',
                                                         'N',
                                                         'REQ_FERIAS');
            UPDATE log_calculo
               SET DT_FIM         = SYSDATE,
                   DT_ATUALIZACAO = SYSDATE,
                   Usuario        = SUBSTR(PUSUARIO || 'PkgFer', 1, 30)
             WHERE cod_empresa = R_FERIAS.COD_EMPRESA
               AND cod_processo_pagto = 'FOLHA'
               AND data_ref_proc = vdt_ref_FOLHA
               AND dt_inicio = SYSDATE;
          END IF;
          --
        END IF;
        --
      END IF;
      --
    EXCEPTION
      WHEN VSAIDA_ERRO THEN
        Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(R_REQ_FERIAS.COD_SOLICITACAO,
                                                     'VPOSICAO2: ' ||
                                                     VPOSICAO,
                                                     'S',
                                                     'REQ_FERIAS');
        NULL;
      WHEN OTHERS THEN
        Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(R_REQ_FERIAS.COD_SOLICITACAO,
                                                     'VPOSICAO3: ' ||
                                                     VPOSICAO || 'Erro: ' ||
                                                     SQLERRM,
                                                     'S',
                                                     'REQ_FERIAS');
        PFLG_RETORNO := 'N';
        PMSG_RETORNO := SUBSTR('Erro Exclui_Parc1: ' || SQLERRM, 1, 4000);
    END EXCLUI_PARC1;
    --
    PROCEDURE EXCLUI_PARC2 IS
    BEGIN
      --
      pflg_retorno := 'S';
      --
      IF TRUNC(R_FERIAS.DT_SAIDA_PARC2, 'MM') = TRUNC(VDT_REF_FOLHA, 'MM') THEN
        v_processos := NULL;
        v_processos := Pkg_Verif_Proc.F_F010332I(R_FERIAS.cod_empresa,
                                                 vdt_ref_FOLHA);
        --
        IF v_processos IS NOT NULL THEN
          pflg_retorno := 'N';
          pmsg_retorno := SUBSTR('Processo de Cancelamento da Programação de Férias não permitido. Nesse momento há os seguintes processos de cálculo sendo executados => ' ||
                                 v_processos,
                                 1,
                                 4000);
          RAISE vsaida_erro;
        END IF;
      END IF;
      --
      insere_log_calculo(R_FERIAS.cod_empresa,
                         'FERIA',
                         vdt_ref_FOLHA,
                         1,
                         0,
                         0,
                         NULL,
                         NULL,
                         R_FERIAS.cod_empresa,
                         R_FERIAS.cod_empresa,
                         NULL,
                         NULL,
                         NULL,
                         NULL,
                         SYSDATE,
                         SYSDATE,
                         VUSUARIO,
                         SYSDATE);
      --
      IF R_FERIAS.ind_situacao_periodo = 'R' AND
         R_FERIAS.ind_situacao_parc_2 = 'C' THEN
        /**      PFLG_RETORNO := 'N';
              PMSG_RETORNO := SUBSTR('Férias já calculada para a parcela. Limpeza de dados não permitida!',1,4000);
        **/
        Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(PSOLICITACAO,
                                                     SUBSTR(PUSUARIO ||
                                                            'PkgFer',
                                                            1,
                                                            30) ||
                                                     '-Férias já calculada para a parcela. Limpeza de dados não permitida!',
                                                     'N',
                                                     'REQ_FERIAS');
        PFLG_RETORNO := 'S'; -- Se foi calculada, retorna PFLG_RETORNO = 'S', pois não é um motivo para travar o processo,
        -- só não irá limpar a programação.
        RAISE VSAIDA_ERRO;
      END IF;
      --
      /**
         VERIFICA_REQUISICAO(v_parcela);
         if v_parcela = 2 then
           if not CONFIRMA('Requisição', 'Férias programadas através da requisição de nº '||:ferias.cod_solicitacao||', deseja limpar?') then
              raise form_trigger_failure;
           end if;
         end if;
      **/
      --
      BEGIN
        vl_verificar := NULL;
        SELECT 1
          INTO vl_verificar
          FROM ferias
         WHERE cod_empresa = R_FERIAS.cod_empresa
           AND matricula = R_FERIAS.matricula
           AND TRUNC(DT_INIC_PER_FERIAS) > R_FERIAS.DT_INIC_PER_FERIAS
           AND (TRUNC(DT_SAIDA_PARC1) > R_FERIAS.DT_SAIDA_PARC2 OR
               TRUNC(DT_SAIDA_PARC2) > R_FERIAS.DT_SAIDA_PARC2);
      EXCEPTION
        WHEN OTHERS THEN
          VL_VERIFICAR := 0;
      END;
      --
      IF VL_VERIFICAR = 1 THEN
        /**      PFLG_RETORNO := 'N';
              PMSG_RETORNO := SUBSTR('Funcionários com Programação em Periodos Superiores a '||TO_CHAR(R_FERIAS.DT_INIC_PER_FERIAS,'DD/MM/YYYY'),1,4000);
        **/
        Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(PSOLICITACAO,
                                                     SUBSTR(PUSUARIO ||
                                                            'PkgFer',
                                                            1,
                                                            30) ||
                                                     '-Funcionários com Programação em Periodos Superiores a ' ||
                                                     TO_CHAR(R_FERIAS.DT_INIC_PER_FERIAS,
                                                             'DD/MM/YYYY'),
                                                     'N',
                                                     'REQ_FERIAS');
        PFLG_RETORNO := 'S';
        RAISE VSAIDA_ERRO;
      ELSE
        --
        UPDATE FERIAS
           SET DT_SAIDA_PARC2   = NULL,
               NUM_DIAS_PARC2   = NULL,
               DIAS_ABONO_PEC2  = NULL,
               OPCAO_13SAL2     = NULL,
               DT_RETORNO_PARC2 = NULL,
               TIPO_FERIAS2     = NULL,
               DT_RETORNO_COL2  = NULL,
               OPCAO_ABONO_PEC2 = NULL,
               DESC_ADICIONAL4  = NULL,
               DT_PAGTO_PARC2   = NULL,
               COD_SOLICITACAO  = NULL,
               Usuario          = SUBSTR(PUSUARIO || 'PkgFer', 1, 30),
               DT_ATUALIZACAO   = SYSDATE,
               OBSERVACOES      = SUBSTR('Parcela 2(Dt. Saída: ' ||
                                         TO_CHAR(R_FERIAS.DT_SAIDA_PARC2,
                                                 'DD/MM/RRRR') ||
                                         ') cancelada através da requisição ' ||
                                         PSOLICITACAO || ' por ' || pusuario || ';' ||
                                         OBSERVACOES,
                                         1,
                                         3000)
         WHERE DT_SAIDA_PARC2 IS NOT NULL
           AND DT_INIC_PER_FERIAS = R_FERIAS.DT_INIC_PER_FERIAS
           AND MATRICULA = R_FERIAS.MATRICULA
           AND COD_EMPRESA = R_FERIAS.COD_EMPRESA;
        --
        IF SQL%FOUND THEN
          --
          VPARCELAS_CANCELADAS := '2' || VPARCELAS_CANCELADAS;
          Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(PSOLICITACAO,
                                                       SUBSTR(PUSUARIO ||
                                                              'PkgFer',
                                                              1,
                                                              30) ||
                                                       '-Parcela 2 excluída da tabela ferias (dt_saida_parc2: ' ||
                                                       TO_CHAR(R_FERIAS.DT_SAIDA_PARC2,
                                                               'DD/MM/RRRR') ||
                                                       ',dt_retorno_parc2: ' ||
                                                       TO_CHAR(R_FERIAS.DT_RETORNO_PARC2,
                                                               'DD/MM/RRRR') || ')',
                                                       'N',
                                                       'REQ_FERIAS');
          BEGIN
            UPDATE log_calculo
               SET DT_FIM = SYSDATE, DT_ATUALIZACAO = SYSDATE
             WHERE cod_empresa = R_FERIAS.cod_empresa
               AND cod_processo_pagto = 'FOLHA'
               AND data_ref_proc = vdt_ref_FOLHA
               AND dt_inicio = SYSDATE;
          END;
          --
        END IF;
        --
      END IF;
      --
    END EXCLUI_PARC2;
    --
    PROCEDURE EXCLUI_PARC3 IS
    BEGIN
      --
      IF TRUNC(R_FERIAS.DT_SAIDA_PARC4, 'MM') = TRUNC(VDT_REF_FOLHA, 'MM') THEN
        v_processos := NULL;
        v_processos := Pkg_Verif_Proc.F_F010332I(R_FERIAS.cod_empresa,
                                                 vdt_ref_FOLHA);
        --
        IF v_processos IS NOT NULL THEN
          --
          PFLG_RETORNO := 'N';
          PMSG_RETORNO := 'Processo de Cancelamento da Programação de Férias não permitido. Nesse momento há os seguintes processos de cálculo sendo executados => ' ||
                          v_processos;
          RAISE VSAIDA_ERRO;
          --
        END IF;
      END IF;
      --
      insere_log_calculo(R_FERIAS.cod_empresa,
                         'FERIA',
                         vdt_ref_FOLHA,
                         1,
                         0,
                         0,
                         NULL,
                         NULL,
                         R_FERIAS.cod_empresa,
                         R_FERIAS.cod_empresa,
                         NULL,
                         NULL,
                         NULL,
                         NULL,
                         SYSDATE,
                         SYSDATE,
                         SUBSTR(PUSUARIO || 'PkgFer', 1, 30),
                         SYSDATE);
      --
      BEGIN
        VL_VERIFICAR := NULL;
        SELECT 1
          INTO vl_verificar
          FROM ferias
         WHERE cod_empresa = R_FERIAS.cod_empresa
           AND matricula = R_FERIAS.matricula
           AND TRUNC(DT_INIC_PER_FERIAS) > R_FERIAS.DT_INIC_PER_FERIAS
           AND (TRUNC(DT_SAIDA_PARC2) > R_FERIAS.DT_SAIDA_PARC4 OR
               TRUNC(DT_SAIDA_PARC4) > R_FERIAS.DT_SAIDA_PARC4);
      EXCEPTION
        WHEN OTHERS THEN
          VL_VERIFICAR := 0;
      END;
      --
      IF VL_VERIFICAR = 1 THEN
        /**     PFLG_RETORNO := 'N';
             PMSG_RETORNO := SUBSTR('Funcionários com Programação em Periodos Superiores a  '||TO_CHAR(R_FERIAS.DT_INIC_PER_FERIAS,'DD/MM/YYYY'),1,4000);
        **/
        Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(PSOLICITACAO,
                                                     SUBSTR(PUSUARIO ||
                                                            'PkgFer',
                                                            1,
                                                            30) ||
                                                     '-Funcionários com Programação em Periodos Superiores a  ' ||
                                                     TO_CHAR(R_FERIAS.DT_INIC_PER_FERIAS,
                                                             'DD/MM/YYYY'),
                                                     'N',
                                                     'REQ_FERIAS');
        PFLG_RETORNO := 'S';
        RAISE VSAIDA_ERRO;
      ELSE
        UPDATE FERIAS
           SET DT_SAIDA_PARC4   = NULL,
               NUM_DIAS_PARC4   = NULL,
               DIAS_ABONO_PEC4  = NULL,
               OPCAO_13SAL4     = NULL,
               DT_RETORNO_PARC4 = NULL,
               TIPO_FERIAS4     = NULL,
               DT_RETORNO_COL4  = NULL,
               OPCAO_ABONO_PEC4 = NULL,
               DESC_ADICIONAL4  = NULL,
               DT_PAGTO_PARC4   = NULL,
               COD_SOLICITACAO  = NULL,
               Usuario          = SUBSTR(PUSUARIO || 'PkgFer', 1, 30),
               DT_ATUALIZACAO   = SYSDATE,
               OBSERVACOES      = SUBSTR('Parcela 3(Dt. Saída: ' ||
                                         TO_CHAR(R_FERIAS.DT_SAIDA_PARC4,
                                                 'DD/MM/RRRR') ||
                                         ') cancelada através da requisição ' ||
                                         PSOLICITACAO || ' por ' || pusuario || ';' ||
                                         OBSERVACOES,
                                         1,
                                         3000)
         WHERE DT_SAIDA_PARC4 IS NOT NULL
           AND DT_INIC_PER_FERIAS = R_FERIAS.DT_INIC_PER_FERIAS
           AND MATRICULA = R_FERIAS.MATRICULA
           AND COD_EMPRESA = R_FERIAS.COD_EMPRESA;
        --
        IF SQL%FOUND THEN
          VPARCELAS_CANCELADAS := '3' || VPARCELAS_CANCELADAS;
          Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(PSOLICITACAO,
                                                       SUBSTR(PUSUARIO ||
                                                              'PkgFer',
                                                              1,
                                                              30) ||
                                                       '-Parcela 3 excluída da tabela ferias (dt_saida_parc3: ' ||
                                                       TO_CHAR(R_FERIAS.DT_SAIDA_PARC3,
                                                               'DD/MM/RRRR') ||
                                                       ',dt_retorno_parc3: ' ||
                                                       TO_CHAR(R_FERIAS.DT_RETORNO_PARC3,
                                                               'DD/MM/RRRR') || ')',
                                                       'N',
                                                       'REQ_FERIAS');
          UPDATE log_calculo
             SET DT_FIM         = SYSDATE,
                 DT_ATUALIZACAO = SYSDATE,
                 Usuario        = SUBSTR(PUSUARIO || 'PkgFer', 1, 30)
           WHERE cod_empresa = R_FERIAS.COD_EMPRESA
             AND cod_processo_pagto = 'FOLHA'
             AND data_ref_proc = vdt_ref_FOLHA
             AND dt_inicio = SYSDATE;
        END IF;
        --
      END IF;
      --
    EXCEPTION
      WHEN VSAIDA_ERRO THEN
        NULL;
      WHEN OTHERS THEN
        PFLG_RETORNO := 'N';
        PMSG_RETORNO := SUBSTR('Erro Exclui_Parc3: ' || SQLERRM, 1, 4000);
    END EXCLUI_PARC3;
    --
  BEGIN
    --
    PFLG_RETORNO := 'S';
    --
    IF C_REQ_FERIAS%ISOPEN THEN
      CLOSE C_REQ_FERIAS;
    END IF;
    OPEN C_REQ_FERIAS;
    FETCH C_REQ_FERIAS
      INTO R_REQ_FERIAS;
    CLOSE C_REQ_FERIAS;
    --
    IF C_FERIAS%ISOPEN THEN
      CLOSE C_FERIAS;
    END IF;
    OPEN C_FERIAS(R_REQ_FERIAS.COD_EMPRESA,
                  R_REQ_FERIAS.MATRICULA,
                  R_REQ_FERIAS.DT_INIC_PER_FERIAS);
    FETCH C_FERIAS
      INTO R_FERIAS;
    CLOSE C_FERIAS;
    --
    SELECT X.DT_REF_FOLHA
      INTO VDT_REF_FOLHA
      FROM PARAMETROS_RECURSOS_HUMANOS X
     WHERE X.COD_EMPRESA = R_FERIAS.COD_EMPRESA;
    --
    SELECT DIAS_ANTES_PAGTO_FERIAS
      INTO VDIAS_ANTES_PAGTO_FERIAS
      FROM FERIAS_PARAMETROS
     WHERE COD_FILIAL = R_FERIAS.FILIAL
       AND COD_EMPRESA = R_FERIAS.COD_EMPRESA;
    --
    IF VDIAS_ANTES_PAGTO_FERIAS IS NOT NULL THEN
      -- Se estiver nulo, não permite o cancelamento de uma requisição CONCLUÍDA
      -- e, com isso, não é permitindo então fazer a exclusão da programação
      --
      IF R_FERIAS.DT_SAIDA_PARC4 IS NOT NULL AND
        --         R_FERIAS.DT_SAIDA_PARC4                    = R_REQ_FERIAS.DT_SAIDA_PARC4   AND -- Só vai permitir exclusão se as datas que estiverem na ferias forem
        --         R_FERIAS.DT_RETORNO_PARC4                  = R_REQ_FERIAS.DT_RETORNO_PARC4 AND -- iguais às que estão na requisição
         (R_FERIAS.DT_SAIDA_PARC4 - TRUNC(SYSDATE)) + 1 >=
         VDIAS_ANTES_PAGTO_FERIAS AND
         NVL(R_FERIAS.IND_SITUACAO_PARC_4, 'X') <> 'C' THEN
        EXCLUI_PARC3;
        IF NVL(PFLG_RETORNO, 'S') <> 'S' THEN
          RAISE VSAIDA_ERRO;
        END IF;
      END IF;
      --
      IF R_FERIAS.DT_SAIDA_PARC2 IS NOT NULL AND
        --         R_FERIAS.DT_SAIDA_PARC2                    = R_REQ_FERIAS.DT_SAIDA_PARC2   AND -- Só vai permitir exclusão se as datas que estiverem na ferias forem
        --         R_FERIAS.DT_RETORNO_PARC2                  = R_REQ_FERIAS.DT_RETORNO_PARC2 AND -- iguais às que estão na requisição
         (R_FERIAS.DT_SAIDA_PARC2 - TRUNC(SYSDATE)) + 1 >=
         VDIAS_ANTES_PAGTO_FERIAS AND
         NVL(R_FERIAS.IND_SITUACAO_PARC_2, 'X') <> 'C' THEN
        EXCLUI_PARC2;
        IF NVL(PFLG_RETORNO, 'S') <> 'S' THEN
          RAISE VSAIDA_ERRO;
        END IF;
      END IF;
      --
      Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(R_REQ_FERIAS.COD_SOLICITACAO,
                                                   'passou por exclusão da parc2',
                                                   'S',
                                                   'REQ_FERIAS');
      IF R_FERIAS.DT_SAIDA_PARC1 IS NOT NULL AND
        --         R_FERIAS.DT_SAIDA_PARC1                    = R_REQ_FERIAS.DT_SAIDA_PARC1   AND -- Só vai permitir exclusão se as datas que estiverem na ferias forem
        --         R_FERIAS.DT_RETORNO_PARC1                  = R_REQ_FERIAS.DT_RETORNO_PARC1 AND -- iguais às que estão na requisição
         (R_FERIAS.DT_SAIDA_PARC1 - TRUNC(SYSDATE)) + 1 >=
         VDIAS_ANTES_PAGTO_FERIAS AND
         NVL(R_FERIAS.IND_SITUACAO_PARC_1, 'X') <> 'C' THEN
        Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(R_REQ_FERIAS.COD_SOLICITACAO,
                                                     'chamando exclusão da parc1',
                                                     'S',
                                                     'REQ_FERIAS');
        EXCLUI_PARC1;
        IF NVL(PFLG_RETORNO, 'S') <> 'S' THEN
          RAISE VSAIDA_ERRO;
        END IF;
      END IF;
      Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(R_REQ_FERIAS.COD_SOLICITACAO,
                                                   'VPOSICAO1: ' ||
                                                   VPOSICAO,
                                                   'S',
                                                   'REQ_FERIAS');
      --
      IF VPARCELAS_CANCELADAS IS NOT NULL THEN
        IF NVL(PVOLTA_STATUS_REQ, 'S') = 'S' THEN
          UPDATE REQUISICAO_FERIAS
             SET SIT_REQUISICAO = 3, DT_ATUALIZACAO = SYSDATE
           WHERE COD_SOLICITACAO = PSOLICITACAO;
        END IF;
        VEXISTE_PARCELAS := 'S';
        BEGIN
          SELECT 'N'
            INTO VEXISTE_PARCELAS
            FROM FERIAS
           WHERE DT_SAIDA_PARC1 IS NULL
             AND DT_SAIDA_PARC2 IS NULL
             AND DT_SAIDA_PARC4 IS NULL
             AND DT_INIC_PER_FERIAS = R_FERIAS.DT_INIC_PER_FERIAS
             AND MATRICULA = R_FERIAS.MATRICULA
             AND COD_EMPRESA = R_FERIAS.COD_EMPRESA;
        EXCEPTION
          WHEN OTHERS THEN
            VEXISTE_PARCELAS := 'S';
        END;
        IF NVL(VEXISTE_PARCELAS, 'S') = 'N' THEN
          UPDATE FERIAS
             SET OPCAO_FERIAS = NULL
           WHERE DT_INIC_PER_FERIAS = R_FERIAS.DT_INIC_PER_FERIAS
             AND MATRICULA = R_FERIAS.MATRICULA
             AND COD_EMPRESA = R_FERIAS.COD_EMPRESA;
        END IF;
        Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(PSOLICITACAO,
                                                     SUBSTR(PUSUARIO ||
                                                            'PkgFer',
                                                            1,
                                                            30) ||
                                                     '-Parcela(s) ' ||
                                                     VPARCELAS_CANCELADAS ||
                                                     ' excluídas.');
        COMMIT;
        --Bruno Sousa 09/01/2024 
        --ELSE Comentado
        --Só trava a programação de ferias se retornou algum erro das exclusões de férias
      ELSIF PFLG_RETORNO = 'N' THEN
        IF NVL(PVOLTA_STATUS_REQ, 'S') = 'S' THEN
          UPDATE REQUISICAO_FERIAS
             SET SIT_REQUISICAO = 2
          --                ,DT_ATUALIZACAO = SYSDATE
           WHERE COD_SOLICITACAO = PSOLICITACAO;
        END IF;
        PFLG_RETORNO := 'N';
        Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(PSOLICITACAO,
                                                     SUBSTR(PUSUARIO ||
                                                            'PkgFer',
                                                            1,
                                                            30) ||
                                                     '-Favor verificar a programação de férias e compará-la com a requisição.',
                                                     'S');
        PMSG_RETORNO := 'Cancelamento não realizado.' || CHR(10) ||
                        'Favor verificar a programação de férias e compará-la com a requisição.';
        RAISE VSAIDA_ERRO;
      END IF;
      --
    END IF;
    --
  EXCEPTION
    WHEN VSAIDA_ERRO THEN
      Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(R_REQ_FERIAS.COD_SOLICITACAO,
                                                   'VPOSICAO4: ' ||
                                                   VPOSICAO,
                                                   'S',
                                                   'REQ_FERIAS');
      NULL;
    WHEN OTHERS THEN
      Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(R_REQ_FERIAS.COD_SOLICITACAO,
                                                   'VPOSICAO5: ' ||
                                                   VPOSICAO,
                                                   'S',
                                                   'REQ_FERIAS');
      PFLG_RETORNO := 'N';
      PMSG_RETORNO := SUBSTR('Erro Exclui_Parcelas: ' || SQLERRM, 1, 4000);
  END EXCLUI_PARCELAS;
  --
  FUNCTION existe_p1(psolicitacao        requisicao_ferias.cod_solicitacao%TYPE DEFAULT NULL -- somente passar se o cód. solicitação for ref. à P1 (1a parcela de férias)
                    ,
                     pcod_empresa        requisicao_ferias.cod_empresa%TYPE DEFAULT NULL,
                     pmatricula          requisicao_ferias.matricula%TYPE DEFAULT NULL,
                     pdt_inic_per_ferias requisicao_ferias.dt_inic_per_ferias%TYPE DEFAULT NULL,
                     pdt_fim_per_ferias  requisicao_ferias.dt_fim_per_ferias%TYPE DEFAULT NULL)
    RETURN BOOLEAN IS
    --
    vexiste VARCHAR2(1) := 'N';
    --
  BEGIN
    --
    BEGIN
      --
      SELECT 'S'
        INTO vexiste
        FROM ferias
       WHERE dt_saida_parc1 IS NOT NULL
         AND cod_solicitacao = NVL(psolicitacao, cod_solicitacao)
         AND dt_fim_per_ferias = NVL(pdt_fim_per_ferias, dt_fim_per_ferias)
         AND dt_inic_per_ferias =
             NVL(pdt_inic_per_ferias, dt_inic_per_ferias)
         AND matricula = NVL(pmatricula, matricula)
         AND cod_empresa = NVL(pcod_empresa, cod_empresa);
      --
    EXCEPTION
      WHEN OTHERS THEN
        vexiste := 'N';
    END;
    --
    IF NVL(vexiste, 'N') = 'S' THEN
      RETURN(TRUE);
    ELSE
      RETURN(FALSE);
    END IF;
    --
  END existe_p1;
  --
  -- Essa procedure deve ser chamada sempre que houver tentativa de alteração dos campos referentes
  PROCEDURE proc_verifica(pcod_empresa          EMPRESAS.cod%TYPE,
                          pmatricula            INF_PESSOAIS.matricula%TYPE,
                          pind_duplo_vinculo    VARCHAR2,
                          pind_situacao_periodo FERIAS.ind_situacao_periodo%TYPE,
                          pdt_saida_parc1       FERIAS.dt_saida_parc1%TYPE,
                          pdt_retorno_parc1     FERIAS.dt_retorno_parc1%TYPE,
                          pdt_saida_parc2       FERIAS.dt_saida_parc2%TYPE,
                          pdt_retorno_parc2     FERIAS.dt_retorno_parc2%TYPE,
                          pflg_retorno          IN OUT VARCHAR2,
                          pmsg_retorno          IN OUT VARCHAR2) IS
    --
    ERRO  EXCEPTION;
    total NUMBER;
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    IF (pind_duplo_vinculo = 'S') THEN
      --
      IF pind_situacao_periodo = 'G' OR pind_situacao_periodo = 'R' THEN
        --
        SELECT NVL(COUNT(*), 0)
          INTO total
          FROM HIST_FINAN_FERIAS
         WHERE cod_empresa = pcod_empresa
           AND matricula = pmatricula
           AND ((dt_inic_val = pdt_saida_parc1 OR
               dt_fin_val = pdt_retorno_parc1) OR
               (dt_inic_val = pdt_saida_parc2 OR
               dt_fin_val = pdt_retorno_parc2));
        --
        IF (total > 0) THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Este período de férias já possui cálculo efetuado, não pode ser alterado.';
          RAISE vsaida_erro;
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
      pmsg_retorno := 'Pkg_Ferias.Proc_Verifica - Erro: ' || SQLERRM;
  END proc_verifica;
  -- Procedure adaptada da F013303 Cibele 19/06/2019
  PROCEDURE Vld_Ferias_Dobro(pCod_Empresa        empresas.cod%TYPE,
                             pMatricula          inf_pessoais.matricula%TYPE,
                             pdt_saida           ferias.dt_saida_parc1%TYPE,
                             pflg_retorno        IN OUT VARCHAR2,
                             pmsg_retorno        IN OUT VARCHAR2,
                             pdt_inic_per_ferias FERIAS.dt_inic_per_ferias%TYPE DEFAULT NULL) IS
    Acima_Dois_Venc#   CHAR(3) := 'NAO';
    vDt_Limite_Inicial DATE;
    vDt_Limite_Final   DATE;
    nV                 NUMBER;
  BEGIN
    BEGIN
      SELECT 'SIM'
        INTO Acima_Dois_Venc#
        FROM Ferias F, Informacoes_Funcionais I
       WHERE F.Cod_Empresa = pCod_Empresa
         AND F.Matricula = pMatricula
         AND F.Ind_Situacao_Periodo IN ('P', 'R')
         AND I.Cod_Empresa = F.Cod_Empresa
         AND I.Matricula = F.Matricula
            --Add Bruno Sousa 31/10/2023
            --Buscar quantidade de férias vencidas a partir da data inicial 
            --que esta sendo programada as novas férias
         AND F.DT_INIC_PER_FERIAS >= PDT_INIC_PER_FERIAS
       GROUP BY I.Filial, I.Matricula
      HAVING COUNT(1) >= 2;
    EXCEPTION
      WHEN OTHERS THEN
        Acima_Dois_Venc# := 'NAO';
    END;
  
    IF Acima_Dois_Venc# = 'SIM' THEN
      SELECT NVL(MAX(NVL(F.NUM_DIAS_PARC1, 0) + NVL(F.DIAS_ABONO_PEC1, 0) +
                     NVL(F.NUM_DIAS_PARC2, 0) + NVL(F.DIAS_ABONO_PEC1, 0)),
                 0)
        INTO nV
        FROM Ferias F
       WHERE F.COD_EMPRESA = pCod_Empresa
         AND F.MATRICULA = pMatricula
         AND F.DT_INIC_PER_FERIAS = pdt_inic_per_ferias;
    
      nv := nV + numDias + numDiasAbono;
    
      SELECT (F.Dt_Fim_Per_Ferias -
             DECODE(NVL(P.Dias_Margem_Ferias, 0),
                     0,
                     30,
                     P.Dias_Margem_Ferias)) + nV Data_Inic_Limite,
             F.Dt_Fim_Per_Ferias
        INTO vDt_Limite_Inicial, vDt_Limite_Final
        FROM Ferias F, Informacoes_Funcionais I, Ferias_Parametros P
       WHERE F.Cod_Empresa = pCod_Empresa
         AND F.Matricula = pMatricula
         AND F.Ind_Situacao_Periodo IN ('P', 'R')
            --Add Bruno Sousa 13/10/2023
            --AND F.DT_INIC_PER_FERIAS    = pdt_inic_per_ferias
         AND F.Dt_Fim_Per_Ferias =
             (SELECT MAX(Dt_Fim_Per_Ferias)
                FROM Ferias X
               WHERE X.Cod_Empresa = F.Cod_Empresa
                 AND X.Matricula = F.Matricula
                    --Add Bruno Sousa 13/10/2023
                    --AND X.DT_INIC_PER_FERIAS    = pdt_inic_per_ferias
                 AND X.Ind_Situacao_Periodo IN ('P', 'R'))
         AND I.Cod_Empresa = F.Cod_Empresa
         AND I.Matricula = F.Matricula
         AND P.Cod_Empresa = I.Cod_Empresa
         AND P.Cod_Filial = I.Filial;
    
      IF pdt_saida IS NOT NULL THEN
        IF pdt_saida > vDt_Limite_Inicial THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Funcionário deverá iniciar suas férias até ' ||
                          TO_CHAR(vDt_Limite_Inicial - 1, 'DD/MM/RRRR') ||
                          ' devido a férias em dobro. ';
          RAISE vsaida_erro;
        END IF;
        /*IF pdt_saida BETWEEN vDt_Limite_Inicial AND vDt_Limite_Final THEN
            pflg_retorno := 'N';
            pmsg_retorno := 'No período que está sendo programado, a saída de férias ('||pdt_saida||') está dentro do limite para férias em dobro.';
            RAISE vsaida_erro;
          END IF;
        ELSE
          pflg_retorno := 'A';
          pmsg_retorno := 'Funcionário deverá iniciar suas férias até '
                           || TO_CHAR(vDt_Limite_Inicial - 1,'DD/MM/RRRR')
                           || ' devido a férias em dobro.';
          RAISE vsaida_erro;*/
      END IF;
    END IF;
    --commit;
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := SUBSTR('Erro Vld_Ferias_Dobro: ' || SQLERRM, 1, 4000);
  END Vld_Ferias_Dobro;
  --
  FUNCTION Valida_Prazo_Programacao(pcod_empresa          empresas.cod%TYPE,
                                    pdt_saida_parc        DATE,
                                    pmsg_erro_prog_ferias IN OUT VARCHAR2)
    RETURN BOOLEAN IS
  
    CURSOR c IS
      SELECT *
        FROM parametros_recursos_humanos
       WHERE cod_empresa = pcod_empresa;
  
    param_rh     c%ROWTYPE;
    prazo_limite DATE;
  
  BEGIN
  
    OPEN c;
    FETCH c
      INTO param_rh;
    CLOSE c;
  
    BEGIN
      prazo_limite := TO_DATE(REPLACE(param_rh.dia_limite_ferias || '/' ||
                                      TO_CHAR(param_rh.dt_ref_folha,
                                              'mm/rrrr'),
                                      ' ',
                                      ''),
                              'dd/mm/rrrr');
    EXCEPTION
      WHEN OTHERS THEN
        IF SQLCODE = -1839 THEN
          prazo_limite := LAST_DAY(param_rh.dt_ref_folha);
        ELSE
          RAISE_APPLICATION_ERROR(-20003, SQLERRM);
        END IF;
    END;
  
    IF TRUNC(pdt_saida_parc, 'mm') =
       ADD_MONTHS(TRUNC(param_rh.dt_ref_ferias, 'mm'),
                  NVL(param_rh.considera_ref_ferias, 0)) AND
       TRUNC(SYSDATE) > prazo_limite THEN
      pmsg_erro_prog_ferias := 'O prazo para o cadastro de requisições para o mês informado expirou em ' ||
                               TO_CHAR(prazo_limite, 'dd/mm/rrrr') || '!';
      RETURN(FALSE);
    ELSIF TRUNC(pdt_saida_parc, 'mm') <
          ADD_MONTHS(TRUNC(param_rh.dt_ref_ferias, 'mm'),
                     NVL(param_rh.considera_ref_ferias, 0)) THEN
      pmsg_erro_prog_ferias := 'A data de saída não pode ser menor que a data de referência de férias ' ||
                               TO_CHAR(ADD_MONTHS(TRUNC(param_rh.dt_ref_ferias,
                                                        'mm'),
                                                  NVL(param_rh.considera_ref_ferias,
                                                      0)),
                                       'dd/mm/rrrr') || '!';
      RETURN(FALSE);
    ELSE
      RETURN(TRUE);
    END IF;
  
  END Valida_Prazo_Programacao;
  -- Essa procedure pode retornar um aviso
  PROCEDURE Valida_Inicio_Tela1(pcod_empresa EMPRESAS.cod%TYPE,
                                pmatricula   INF_PESSOAIS.matricula%TYPE,
                                pflg_retorno IN OUT VARCHAR2,
                                pmsg_retorno IN OUT VARCHAR2) IS
    vaux DATE := NULL;
  BEGIN
    --
    pflg_retorno := 'S';
    --
    Vld_Ferias_Dobro(pCod_Empresa,
                     pMatricula,
                     vaux,
                     pflg_retorno,
                     pmsg_retorno);
    IF NVL(pflg_retorno, 'S') <> 'S' THEN
      RAISE vsaida_erro;
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := SUBSTR('Erro Valida_Inicio_Tela1: ' || SQLERRM,
                             1,
                             4000);
  END Valida_Inicio_Tela1;
  --
  PROCEDURE Vld_Duplic_Req_Ferias(pcod_empresa        EMPRESAS.cod%TYPE,
                                  pmatricula          INF_PESSOAIS.matricula%TYPE,
                                  pdt_saida_parc1     FERIAS.dt_saida_parc1%TYPE,
                                  pdt_saida_parc2     FERIAS.dt_saida_parc2%TYPE,
                                  pdt_saida_parc4     FERIAS.dt_saida_parc4%TYPE,
                                  pdt_inic_per_ferias FERIAS.dt_inic_per_ferias%TYPE,
                                  pdt_fim_per_ferias  FERIAS.dt_fim_per_ferias%TYPE,
                                  pnum_dias_parc1     REQUISICAO_FERIAS.num_dias_parc1%TYPE,
                                  popcao_13sal1       REQUISICAO_FERIAS.opcao_13sal1%TYPE,
                                  popcao_13sal2       REQUISICAO_FERIAS.opcao_13sal2%TYPE,
                                  popcao_13sal4       REQUISICAO_FERIAS.opcao_13sal4%TYPE,
                                  pflg_retorno        IN OUT VARCHAR2,
                                  pmsg_retorno        IN OUT VARCHAR2) IS
    --
    vcount_req_ferias NUMBER := 0;
    --vdt_saida_parc1   date;    
    --vnum_dias_parc1   number := 0;
    vcontador number := 0;
  
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    BEGIN
      --
      SELECT COUNT(*)
        INTO vcount_req_ferias
        FROM REQUISICAO_FERIAS rf
       WHERE rf.sit_requisicao IN (1, 2, 5)
         AND ((pdt_saida_parc1 IS NOT NULL AND
             rf.dt_saida_parc1 = pdt_saida_parc1 AND
             rf.opcao_13sal1 = popcao_13sal1) OR
             (pdt_saida_parc2 IS NOT NULL AND
             rf.dt_saida_parc2 = pdt_saida_parc2 AND
             rf.opcao_13sal2 = popcao_13sal2) OR
             (pdt_saida_parc4 IS NOT NULL AND
             rf.dt_saida_parc4 = pdt_saida_parc4 AND
             rf.opcao_13sal4 = popcao_13sal4))
         AND rf.dt_inic_per_ferias = pdt_inic_per_ferias
         AND rf.dt_fim_per_ferias = pdt_fim_per_ferias
         AND rf.matricula = pmatricula
         AND rf.cod_empresa = pcod_empresa;
      --
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        vcount_req_ferias := 0;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Erro ao verificar existência de requisição de férias: ' ||
                        SQLERRM;
        RAISE vsaida_erro;
    END;
    --
  
    IF vcount_req_ferias > 0 AND pdt_saida_parc2 IS NULL THEN
    
      SELECT count(*)
        INTO vcontador
        FROM REQUISICAO_FERIAS rf
       WHERE rf.sit_requisicao IN (1, 2, 5)
         AND ((pdt_saida_parc1 IS NOT NULL AND
             rf.dt_saida_parc1 = pdt_saida_parc1 AND
             rf.opcao_13sal1 = popcao_13sal1) OR
             (pdt_saida_parc2 IS NOT NULL AND
             rf.dt_saida_parc2 = pdt_saida_parc2 AND
             rf.opcao_13sal2 = popcao_13sal2) OR
             (pdt_saida_parc4 IS NOT NULL AND
             rf.dt_saida_parc4 = pdt_saida_parc4 AND
             rf.opcao_13sal4 = popcao_13sal4))
         AND rf.num_dias_parc1 = pnum_dias_parc1
         AND rf.dt_inic_per_ferias = pdt_inic_per_ferias
         AND rf.dt_fim_per_ferias = pdt_fim_per_ferias
         AND rf.matricula = pmatricula
         AND rf.cod_empresa = pcod_empresa;
    
      -- if (pdt_saida_parc1 IS NOT NULL AND pdt_saida_parc1 = vdt_saida_parc1 AND pnum_dias_parc1 = vnum_dias_parc1) then  -- chamado 30153 - alterado pelo ylem - 06/06/2023
    
      if vcontador > 0 then
        -- chamado 30153 - alterado pelo ylem - 06/06/2023
      
        pflg_retorno := 'N';
        pmsg_retorno := 'Já existe requisição para o período de ' ||
                        TO_CHAR(pdt_inic_per_ferias, 'dd/mm/rrrr') || ' à ' ||
                        TO_CHAR(pdt_fim_per_ferias, 'dd/mm/rrrr') || '.';
        RAISE vsaida_erro;
      
      end if;
    
    END IF;
  
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Vld_Duplic_Req_Ferias - Erro: ' ||
                      SQLERRM;
  END Vld_Duplic_Req_Ferias;
  --
  /*PROCEDURE Valida_Sit_Req(pcod_empresa EMPRESAS.cod%TYPE,
                           psolicitacao consulta_requisicoes.solicitacao%TYPE,
                           pmatricula   INF_PESSOAIS.matricula%TYPE,
                           psit_req     REQUISICAO_FERIAS.sit_requisicao%TYPE,
                           pflg_retorno OUT VARCHAR2,
                           pmsg_retorno OUT VARCHAR2) IS
    --
    v_sit_req REQUISICAO_FERIAS.sit_requisicao%TYPE;
    --
    cursor c_req_ferias is
      select * from requisicao_ferias where cod_solicitacao = psolicitacao;
    v_req_ferias c_req_ferias%rowtype;
    --
    FUNCTION retorna_perfil RETURN VARCHAR2 IS
      v_perfil USUARIO_ORACLE.cd_perfil%TYPE;
    BEGIN
      --
      SELECT cd_perfil
        INTO v_perfil
        FROM USUARIO_ORACLE uo
       WHERE uo.nm_usuario_oracle = Usuario.busca_user;
      --
      RETURN(v_perfil);
      --
    EXCEPTION
      WHEN OTHERS THEN
        RETURN NULL;
    END retorna_perfil;
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    IF pmatricula IS NULL AND psolicitacao IS NULL THEN
      --
      pflg_retorno := 'N';
      pmsg_retorno := 'Não é permitido alterar a situação!';
      RAISE vsaida_erro;
      --
    ELSE
      --
      BEGIN
        SELECT sit_requisicao
          INTO v_sit_req
          FROM REQUISICAO_FERIAS
         WHERE cod_solicitacao = psolicitacao
           AND cod_empresa = pcod_empresa;
        --
      EXCEPTION
        WHEN OTHERS THEN
          v_sit_req := NULL;
      END;
      --
      IF v_sit_req <> '1' THEN
        --
        pflg_retorno := 'N';
        pmsg_retorno := 'Não é permitido alterar o status dessa requisição.';
        RAISE vsaida_erro;
        --
      ELSE
        --
        IF psit_req = '3' THEN
          --
          open c_req_ferias;
          fetch c_req_ferias into v_req_ferias;
          close c_req_ferias;
          --
          IF (NVL(retorna_perfil, 'X') IN ('MASTER', 'FOLHA', 'REMUNERACAO')) OR (v_req_ferias.matricula_solicitante is not null and v_req_ferias.cod_emp_solicitante = pcod_empresa and v_req_ferias.matricula_solicitante = pmatricula) THEN
            NULL;
          ELSE
            pflg_retorno := 'N';
            pmsg_retorno := 'Usuário sem permissão para cancelamento.';
            RAISE vsaida_erro;
          END IF;
          --
        ELSE
          pflg_retorno := 'N';
          pmsg_retorno := 'Alteração não permitida.';
          RAISE vsaida_erro;
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
      pmsg_retorno := 'Pkg_Ferias.Valida_Sit_Req - Erro: ' || SQLERRM;
  END Valida_Sit_Req;*/
  --
  PROCEDURE Valida_Empresa_Solicitado(pcod_empresa EMPRESAS.cod%TYPE,
                                      pflg_retorno OUT VARCHAR2,
                                      pmsg_retorno OUT VARCHAR2) IS
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    vexiste := 'N';
    --
    BEGIN
      --
      SELECT 'S' INTO vexiste FROM EMPRESAS WHERE cod = pcod_empresa;
      --
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Empresa não cadastrada!';
        RAISE vsaida_erro;
    END;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Empresa_Solicitado - Erro: ' ||
                      SQLERRM;
  END Valida_Empresa_Solicitado;
  --
  PROCEDURE Valida_Matricula_Solicitado(pcod_empresa EMPRESAS.cod%TYPE,
                                        pmatricula   INF_PESSOAIS.matricula%TYPE,
                                        pflg_retorno OUT VARCHAR2,
                                        pmsg_retorno OUT VARCHAR2) IS
    --
    CURSOR c1 IS
      SELECT cod_empresa,
             matricula,
             situacao,
             dt_situacao,
             dt_retorno_afast
        FROM informacoes_funcionais
       WHERE cod_empresa = pcod_empresa
         AND matricula = pmatricula;
  
    v_c1 c1%ROWTYPE;
  
    CURSOR C_REQ(pdt_inic_per_ferias DATE) IS
      SELECT R.COD_SOLICITACAO,
             R.SIT_REQUISICAO COD_SIT_REQ,
             NVL(P.REQ_FERIAS_SUBS_CONCLUIDA, 'N') REQ_FERIAS_SUBS_CONCLUIDA,
             R.DT_INIC_PER_FERIAS,
             R.DT_FIM_PER_FERIAS
        FROM REQUISICAO_FERIAS R, PARAMETROS_RECURSOS_HUMANOS P
       WHERE R.COD_EMPRESA = P.COD_EMPRESA
         AND R.SIT_REQUISICAO = 2
         AND R.COD_EMPRESA = PCOD_EMPRESA
         AND R.MATRICULA = PMATRICULA
         AND R.Dt_Inic_Per_Ferias = pdt_inic_per_ferias;
  
    V_REQ C_REQ%ROWTYPE;
  
    CURSOR c2 IS
    /*SELECT F1.DT_INIC_PER_FERIAS, F1.DT_FIM_PER_FERIAS, F1.IND_SITUACAO_PERIODO
                              FROM   FERIAS F1
                              WHERE  F1.DT_INIC_PER_FERIAS = (SELECT MIN(F2.DT_INIC_PER_FERIAS)
                                                              FROM   FERIAS F2
                                                              WHERE  F2.IND_SITUACAO_PERIODO IN ('P','R')
                                                              AND    F2.MATRICULA   = F1.MATRICULA
                                                              AND    F2.COD_EMPRESA = F1.COD_EMPRESA)
                              AND    F1.MATRICULA   = pmatricula
                              AND    F1.COD_EMPRESA = pcod_empresa;*/
    
      SELECT A.DT_INIC_PER_FERIAS,
             A.DT_FIM_PER_FERIAS,
             A.IND_SITUACAO_PERIODO
        from FERIAS A, FERIAS_PARAMETROS P, INFORMACOES_FUNCIONAIS I
       WHERE I.COD_EMPRESA = A.COD_EMPRESA
         AND I.MATRICULA = A.MATRICULA
         AND I.COD_EMPRESA = P.COD_EMPRESA
         AND I.FILIAL = P.COD_FILIAL
         AND A.COD_EMPRESA = pcod_empresa
         and A.MATRICULA = pmatricula
         and A.IND_SITUACAO_PERIODO in ('P', 'R')
         AND ((NVL(P.RECRIAR_REQ_CONCL_FUNC, 'N') = 'S'
             -- Bruno Sousa ALTERADO condição em 24/06/2024
             AND A.COD_SOLICITACAO IS NULL AND A.DT_SAIDA_PARC1 IS NULL AND
             A.DT_SAIDA_PARC2 IS NULL AND A.DT_SAIDA_PARC4 IS NULL AND
             NOT EXISTS (SELECT 1
                            FROM REQUISICAO_FERIAS B
                           WHERE B.COD_EMPRESA = A.COD_EMPRESA
                             AND B.MATRICULA = A.MATRICULA
                             AND B.DT_INIC_PER_FERIAS = A.DT_INIC_PER_FERIAS
                             AND B.SIT_REQUISICAO NOT IN (3, 4))) OR
             (NVL(P.RECRIAR_REQ_CONCL_FUNC, 'N') = 'N' AND
             ((A.COD_SOLICITACAO IS NULL AND A.DT_SAIDA_PARC1 IS NULL AND
             A.DT_SAIDA_PARC2 IS NULL AND A.DT_SAIDA_PARC4 IS NULL AND
             NOT EXISTS
              (SELECT 1
                    FROM REQUISICAO_FERIAS B
                   WHERE B.COD_EMPRESA = A.COD_EMPRESA
                     AND B.MATRICULA = A.MATRICULA
                     AND B.DT_INIC_PER_FERIAS = A.DT_INIC_PER_FERIAS
                        --Bruno Sousa Alterado codição em 10/09/2024 - Chamado 34327 Redeflex
                     AND B.SIT_REQUISICAO NOT IN (3, 4))) or
             ((nvl(a.NUM_DIAS_PARC1, 0) + nvl(a.DIAS_ABONO_PEC1, 0) +
             nvl(a.NUM_DIAS_PARC2, 0) + nvl(a.DIAS_ABONO_PEC2, 0) +
             nvl(a.NUM_DIAS_PARC4, 0) + nvl(a.DIAS_ABONO_PEC4, 0)) < 30 and
             (A.DT_SAIDA_PARC2 is null or A.DT_SAIDA_PARC4 is null)))))
       ORDER BY A.DT_INIC_PER_FERIAS;
  
    v_c2 c2%ROWTYPE;
  
    CURSOR req_ferias(pdt_inic_per_ferias DATE) IS
      SELECT rf.cod_solicitacao,
             rf.dt_inic_per_ferias,
             rf.dt_fim_per_ferias,
             rf.dt_saida_parc1
        FROM REQUISICAO_FERIAS rf
       WHERE sit_requisicao = 1
         AND Dt_Inic_Per_Ferias = pdt_inic_per_ferias
         AND matricula = pmatricula
         AND cod_empresa = pcod_empresa
       ORDER BY rf.cod_solicitacao;
    --
    r_ferias req_ferias%ROWTYPE;
    --
    /*CURSOR c_ferias_param(p_filial NUMBER) IS
      SELECT a.meses_prog_ini, a.meses_prog_fin, NVL(A.antecipa_parc_1, 0) antecipa_parc_1
        FROM FERIAS_PARAMETROS a
       WHERE a.cod_empresa = pcod_empresa
         AND a.cod_filial = p_filial;
    --
    v_ferias_param c_ferias_param%ROWTYPE;*/
    --
    PROCEDURE VALIDA_REQ_DESLIG(VFLG_RETORNO IN OUT VARCHAR2,
                                VMSG_RETORNO IN OUT VARCHAR2) IS
      -- CHAMADO 11657
      VCOD_DESLIGAMENTO DESLIGAMENTO.COD_DESLIGAMENTO%TYPE;
    BEGIN
      VFLG_RETORNO := 'S';
      SELECT COD_DESLIGAMENTO
        INTO VCOD_DESLIGAMENTO
        FROM DESLIGAMENTO
       WHERE COD_SIT_DESLIGAMENTO IN (1, 5)
         AND MAT_SOLICITADO = PMATRICULA
         AND COD_EMPRESA = PCOD_EMPRESA;
      --
      IF VCOD_DESLIGAMENTO IS NOT NULL THEN
        VFLG_RETORNO := 'N';
        VMSG_RETORNO := 'Requisição não permitida! Já existe uma outra em andamento. Procure o Coordenador ou RH.'; -- 'Requisição inválida!'; Alteração solicitada por Camila em 13/03/2020
      END IF;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        NULL;
      WHEN OTHERS THEN
        VFLG_RETORNO := 'N';
        VMSG_RETORNO := SUBSTR('Erro ao verificar existência de outras requisições para a matrícula ' ||
                               PMATRICULA || ': ' || SQLERRM,
                               1,
                               4000);
    END VALIDA_REQ_DESLIG;
  
    PROCEDURE VALIDA_PER_PROGRAMACAO(pcod_empresa        EMPRESAS.cod%TYPE,
                                     pmatricula          INF_PESSOAIS.matricula%TYPE,
                                     p_dt                DATE,
                                     pdt_inic_per_ferias FERIAS.dt_inic_per_ferias%TYPE,
                                     pflg_retorno        OUT VARCHAR2,
                                     pmsg_retorno        OUT VARCHAR2) IS
      --
      CURSOR c0 IS
        SELECT a.filial, a.num_sind_diss, a.vinculo
          FROM INFORMACOES_FUNCIONAIS a
         WHERE a.cod_empresa = pcod_empresa
           AND a.matricula = pmatricula;
      --
      v_c0 c0%ROWTYPE;
      --
      CURSOR c1(p_filial NUMBER) IS
        SELECT a.meses_prog_ini,
               a.meses_prog_fin,
               NVL(A.antecipa_parc_1, 0) antecipa_parc_1
          FROM FERIAS_PARAMETROS a
         WHERE a.cod_empresa = pcod_empresa
           AND a.cod_filial = p_filial;
      --
      v_c1 c1%ROWTYPE;
      --
      CURSOR c2(p_filial NUMBER) IS -- Humberto/Rodrigo 26/12/2022
        SELECT a.vinculo
          FROM fer_vinc_estatutario a
         WHERE a.cod_empresa = pcod_empresa
           AND a.cod_filial = p_filial
           AND a.vinculo = v_c0.vinculo;
      v_c2 c2%ROWTYPE;
      --
      v_meses  NUMBER(5);
      v_dt_ini DATE := pdt_inic_per_ferias - 1;
      v_dt_fin DATE := p_dt;
    
      v_dias NUMBER(2) := 0;
      v_m    NUMBER(1) := 0;
    BEGIN
      --
      pflg_retorno := 'S';
      --
      OPEN c0;
      FETCH c0
        INTO v_c0;
      CLOSE c0;
      --
      OPEN c1(v_c0.filial);
      FETCH c1
        INTO v_c1;
      CLOSE c1;
    
      --Bruno Sousa 25/01/2024
      --if FNC_VINCULO_CLF(pcod_empresa, pmatricula) = '5' then
      /*Bruno Sousa 24/04/2024
      IF fnc_VerifEstatutario(pcod_empresa, pmatricula) = 'S' then
        v_dt_fin := pdt_inic_per_ferias + 365;
        IF p_dt_saida < v_dt_ini or p_dt_saida > v_dt_fin THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não é possível programar as férias! Data de saída de férias não está dentro do período aquisitivo!';
          RAISE vsaida_erro;
        END IF;
      else
      */
      --
      IF V_C1.antecipa_parc_1 = 0 AND v_c1.meses_prog_ini IS NOT NULL AND
         v_c1.meses_prog_fin IS NOT NULL THEN
        --
        v_dias  := F_Tempo(v_dt_ini, 'AA MM DD HH MIMI', v_dt_fin, 'D');
        v_meses := F_Tempo(v_dt_ini, 'aA mM dD hH miMI', v_dt_fin, 'A') * 12 +
                   F_Tempo(v_dt_ini, 'aA mM dD hH miMI', v_dt_fin, 'M');
        --DBMS_OUTPUT.PUT_LINE('v_dt_ini: '||v_dt_ini||' v_meses: '||v_meses);
        --
        IF v_dias > 0 THEN
          v_m := 1;
        END IF;
      
        -- DBMS_OUTPUT.PUT_LINE(v_meses||' + '||v_m||' NOT '||v_c1.meses_prog_ini||' E '||v_c1.meses_prog_fin);
        IF (v_meses + v_m) NOT BETWEEN v_c1.meses_prog_ini AND
           v_c1.meses_prog_fin THEN
          pflg_retorno := 'N';
          -- Humberto/Rodrigo 26/12/2022
          v_c2.vinculo := NULL;
          OPEN c2(v_c0.filial);
          FETCH c2
            INTO v_c2;
          CLOSE c2;
          --
          IF v_c2.vinculo IS NULL THEN
            pmsg_retorno := 'A requisição de férias somente poderá ser programada a partir de ' ||
                            TO_CHAR(ADD_MONTHS(pdt_inic_per_ferias,
                                               v_c1.meses_prog_ini - 1),
                                    'dd/mm/rrrr') || ' até ' ||
                            TO_CHAR(ADD_MONTHS(pdt_inic_per_ferias,
                                               v_c1.meses_prog_fin) - 1,
                                    'dd/mm/rrrr') || '!';
            RAISE vsaida_erro;
          END IF;
        END IF;
        --
      END IF;
    
      /*end if; Bruno Sousa 24/04/2024*/
    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'VALIDA_PER_PROGRAMACAO - Erro: ' || SQLERRM;
    END VALIDA_PER_PROGRAMACAO;
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    VALIDA_REQ_DESLIG(PFLG_RETORNO, PMSG_RETORNO);
    IF NVL(PFLG_RETORNO, 'S') = 'N' THEN
      RAISE VSAIDA_ERRO;
    END IF;
    --
    OPEN c2;
    FETCH c2
      INTO v_c2;
    CLOSE c2;
    vexiste := 'N';
    BEGIN
      SELECT DISTINCT 'S'
        INTO vexiste
        FROM requisicao_ferias
       WHERE sit_requisicao IN (1, 2)
         AND dt_inic_per_ferias = v_c2.dt_inic_per_ferias
         AND matricula = pmatricula
         AND cod_empresa = pcod_empresa;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        vexiste := 'N';
    END;
    --
    OPEN req_ferias(v_c2.dt_inic_per_ferias);
    FETCH req_ferias
      INTO r_ferias;
    /*IF r_ferias.cod_solicitacao IS NOT NULL THEN
    CLOSE req_ferias;
    pflg_retorno := 'N';
    pmsg_retorno := 'Já existe requisição de férias em andamento!'||CHR(9)||
    'Período aquisitivo: '||TO_CHAR(r_ferias.dt_inic_per_ferias,'dd/mm/rrrr')||' à '||TO_CHAR(r_ferias.dt_fim_per_ferias,'dd/mm/rrrr')||', '||
    'Data de saída: '||TO_CHAR(r_ferias.dt_saida_parc1,'dd/mm/rrrr')||', '||
    'Nr. da Requisição: '||r_ferias.cod_solicitacao;
    RAISE vsaida_erro;*/
    --elsif --- Robson/Sidnei
    IF vexiste = 'S' THEN
      -- Adriana/Cibele se, no período em aberto, existir requisição aberta ou concluída, deve ser solicitado cancelamento
    
      --
      OPEN c_req(v_c2.dt_inic_per_ferias);
      FETCH c_req
        INTO v_req;
      CLOSE c_req;
    
      IF v_req.cod_sit_req = 2 AND v_req.REQ_FERIAS_SUBS_CONCLUIDA = 'S' THEN
        pflg_retorno := 'S';
        pmsg_retorno := 'Já existe programação para o período aquisitivo: ' ||
                        TO_CHAR(V_REQ.dt_inic_per_ferias, 'dd/mm/rrrr') ||
                        ' à ' ||
                        TO_CHAR(V_REQ.dt_fim_per_ferias, 'dd/mm/rrrr') ||
                        '. Caso esta nova solicitação seja aprovada, cancelará a requisição ' ||
                        V_REQ.COD_SOLICITACAO || '.';
        RAISE vsaida_erro;
      ELSE
      
        pflg_retorno := 'N';
        pmsg_retorno := 'Já existe programação para o período aquisitivo: ' ||
                        TO_CHAR(r_ferias.dt_inic_per_ferias, 'dd/mm/rrrr') ||
                        ' à ' ||
                        TO_CHAR(r_ferias.dt_fim_per_ferias, 'dd/mm/rrrr') ||
                        '. Entre em contato com o RH e solicite o cancelamento.';
        RAISE vsaida_erro;
      
      END IF;
    
    ELSE
      CLOSE req_ferias;
      --
      BEGIN
        --
        SELECT DISTINCT 'S'
          INTO vexiste
          FROM FERIAS
         WHERE cod_empresa = pcod_empresa
           AND matricula = pmatricula
           AND (cod_solicitacao IS NULL OR dt_saida_parc2 IS NULL OR
               dt_saida_parc4 IS NULL AND
               (NVL(num_dias_parc1, 0) + NVL(dias_abono_pec1, 0)) <= 20)
           AND ind_situacao_periodo IN ('P', 'R');
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          vexiste := 'N';
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := SUBSTR('Pkg_Ferias.Valida_Matricula_Solicitado - Erro ao verificar período de férias em aberto: ' ||
                                 SQLERRM,
                                 1,
                                 4000);
          RAISE vsaida_erro;
      END;
      --
      IF NVL(vexiste, 'N') = 'N' THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Não há períodos em aberto para a programação! Solicite ao RH a criação.';
        RAISE vsaida_erro;
      END IF;
      --
      BEGIN
        --
        vexiste := 'N';
        --
        SELECT DISTINCT 'S'
          INTO vexiste
          FROM FERIAS a
         WHERE a.cod_empresa = pcod_empresa
           AND a.matricula = pmatricula
           AND a.dt_inic_per_ferias IN
               (SELECT MAX(b.dt_inic_per_ferias)
                  FROM FERIAS b
                 WHERE b.cod_empresa = a.cod_empresa
                   AND b.matricula = a.matricula
                   AND b.ind_situacao_periodo IN ('P', 'R'));
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          vexiste := 'N';
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := SUBSTR('Pkg_Ferias.Valida_Matricula_Solicitado - Erro ao verificar período de férias em aberto: ' ||
                                 SQLERRM,
                                 1,
                                 4000);
          RAISE vsaida_erro;
      END;
      --
      IF NVL(vexiste, 'N') = 'N' THEN
        --
        pflg_retorno := 'N';
        pmsg_retorno := 'Não há periodo de Férias em aberto! Favor entrar em contato com o Recursos Humanos.';
        RAISE vsaida_erro;
        --
      END IF;
      --
    END IF;
    --
    OPEN c1;
    FETCH c1
      INTO v_c1;
    CLOSE c1;
  
    IF TO_NUMBER(v_c1.situacao) BETWEEN 2 AND 89 AND
       v_c1.dt_retorno_afast IS NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Colaborador afastado sem perspectiva de retorno.';
      RAISE vsaida_erro;
    END IF;
  
    -- Bruno Sousa 24/04/2024
    VALIDA_PER_PROGRAMACAO(PCOD_EMPRESA,
                           PMATRICULA,
                           SYSDATE,
                           v_c2.dt_inic_per_ferias,
                           PFLG_RETORNO,
                           PMSG_RETORNO);
    IF NVL(PFLG_RETORNO, 'S') = 'N' THEN
      RAISE VSAIDA_ERRO;
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Matricula_Solicitado - Erro: ' ||
                      SQLERRM;
  END Valida_Matricula_Solicitado;
  --
  PROCEDURE Vld_Per_Meses(pcod_empresa        EMPRESAS.cod%TYPE,
                          pmatricula          INF_PESSOAIS.matricula%TYPE,
                          p_dt_saida          DATE,
                          pdt_inic_per_ferias FERIAS.dt_inic_per_ferias%TYPE,
                          pflg_retorno        OUT VARCHAR2,
                          pmsg_retorno        OUT VARCHAR2) IS
    --
    CURSOR c0 IS
      SELECT a.filial, a.num_sind_diss, a.vinculo
        FROM INFORMACOES_FUNCIONAIS a
       WHERE a.cod_empresa = pcod_empresa
         AND a.matricula = pmatricula;
    --
    v_c0 c0%ROWTYPE;
    --
    CURSOR c1(p_filial NUMBER) IS
      SELECT a.meses_prog_ini,
             a.meses_prog_fin,
             NVL(A.antecipa_parc_1, 0) antecipa_parc_1
        FROM FERIAS_PARAMETROS a
       WHERE a.cod_empresa = pcod_empresa
         AND a.cod_filial = p_filial;
    --
    v_c1 c1%ROWTYPE;
    --
    CURSOR c2(p_filial NUMBER) IS -- Humberto/Rodrigo 26/12/2022
      SELECT a.vinculo
        FROM fer_vinc_estatutario a
       WHERE a.cod_empresa = pcod_empresa
         AND a.cod_filial = p_filial
         AND a.vinculo = v_c0.vinculo;
    v_c2 c2%ROWTYPE;
    --
    v_meses  NUMBER(5);
    v_dt_ini DATE := pdt_inic_per_ferias - 1;
    v_dt_fin DATE := p_dt_saida;
  
    v_dias NUMBER(2) := 0;
    v_m    NUMBER(1) := 0;
  BEGIN
    --
    pflg_retorno := 'S';
    --
    IF p_dt_saida IS NOT NULL THEN
      --
      OPEN c0;
      FETCH c0
        INTO v_c0;
      CLOSE c0;
      --
      OPEN c1(v_c0.filial);
      FETCH c1
        INTO v_c1;
      CLOSE c1;
    
      --Bruno Sousa 25/01/2024
      --if FNC_VINCULO_CLF(pcod_empresa, pmatricula) = '5' then
      IF fnc_VerifEstatutario(pcod_empresa, pmatricula) = 'S' then
      
        v_dt_fin := pdt_inic_per_ferias + 365;
        --Bruno Sousa 14/06/2024 -- Considerei como fim do periodo para programação das férias o último dia do ano,
        -- pois é assim que funciona para colaboradores com vinculo estatutários. Ponto de observação: É necessário
        -- verificar se o melhor é alterar o processo de criação dos periódos de férias para colaboradores estatutários.
        v_dt_fin := TO_DATE('3112' || TO_CHAR(v_dt_fin, 'YYYY'), 'DDMMYYYY');
      
        IF p_dt_saida < v_dt_ini or p_dt_saida > v_dt_fin THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não é possível programar as férias! Data de saída de férias não está dentro do período aquisitivo!';
          RAISE vsaida_erro;
        END IF;
      else
        --
        IF V_C1.antecipa_parc_1 = 0 AND v_c1.meses_prog_ini IS NOT NULL AND
           v_c1.meses_prog_fin IS NOT NULL THEN
          --
          v_dias  := F_Tempo(v_dt_ini, 'AA MM DD HH MIMI', v_dt_fin, 'D');
          v_meses := F_Tempo(v_dt_ini, 'aA mM dD hH miMI', v_dt_fin, 'A') * 12 +
                     F_Tempo(v_dt_ini, 'aA mM dD hH miMI', v_dt_fin, 'M');
          --DBMS_OUTPUT.PUT_LINE('v_dt_ini: '||v_dt_ini||' v_meses: '||v_meses);
          --
          IF v_dias > 0 THEN
            v_m := 1;
          END IF;
        
          -- DBMS_OUTPUT.PUT_LINE(v_meses||' + '||v_m||' NOT '||v_c1.meses_prog_ini||' E '||v_c1.meses_prog_fin);
          IF (v_meses + v_m) NOT BETWEEN v_c1.meses_prog_ini AND
             v_c1.meses_prog_fin THEN
            pflg_retorno := 'N';
            -- Humberto/Rodrigo 26/12/2022
            v_c2.vinculo := NULL;
            OPEN c2(v_c0.filial);
            FETCH c2
              INTO v_c2;
            CLOSE c2;
            --
            IF v_c2.vinculo IS NULL THEN
              pmsg_retorno := 'A saída de férias somente poderá ser programada de ' ||
                              TO_CHAR(ADD_MONTHS(pdt_inic_per_ferias,
                                                 v_c1.meses_prog_ini - 1),
                                      'dd/mm/rrrr') || ' até ' ||
                              TO_CHAR(ADD_MONTHS(pdt_inic_per_ferias,
                                                 v_c1.meses_prog_fin) - 1,
                                      'dd/mm/rrrr') || '!';
              RAISE vsaida_erro;
            END IF;
          END IF;
          --
        END IF;
        /*Bruno Sousa 15/04/2024 - 
        Chamado Antecipação de férias - natcorp
        Comentado bloco abaixo para unificação de mensagens, pois existe uma validação 
        externa a essa rotina com uma mensagem mais clara para o usuario
        v_dt_fin := pdt_inic_per_ferias + 365;
        --IF p_dt_saida < v_dt_fin THEN
          --Bruno Sousa 15/03/2024 Alterado condiçao abaixo
          IF p_dt_saida < ADD_MONTHS(v_dt_ini, V_C1.antecipa_parc_1) THEN
            pflg_retorno := 'N';
            pmsg_retorno := 'Não é possível programar as férias! Período aquisitivo não está completo ou não está no prazo de antecipação!';
            RAISE vsaida_erro;
          END IF;
        --END IF;
        --*/
      end if;
    END IF;
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Vld_Per_Meses - Erro: ' || SQLERRM;
  END Vld_Per_Meses;
  --
  --
  -- Essa procedure é chamada pelas demais procedures de validação dessa package
  --
  PROCEDURE Lanc_Abono_P1(pcod_empresa       EMPRESAS.cod%TYPE,
                          pfilial            FILIAIS.cod_filial%TYPE,
                          pdt_saida_parc1    FERIAS.dt_saida_parc1%TYPE,
                          pdt_fim_per_ferias FERIAS.dt_fim_per_ferias%TYPE,
                          psaldo             NUMBER,
                          pdias_direito      NUMBER, -- Humberto/Izidoro 03/03/2016
                          -- pnum_dias_parc1  out number,
                          -- pdias_abono_pec1 out ferias.dias_abono_pec1%type,
                          pnum_dias_parc1_dsp  OUT VARCHAR2,
                          pdias_abono_pec1_dsp OUT VARCHAR2,
                          pflag                IN OUT VARCHAR2,
                          pflg_retorno         IN OUT VARCHAR2,
                          pmsg_retorno         IN OUT VARCHAR2) IS
    CURSOR c1 IS
      SELECT a.qtd_parcelas,
             a.meses_prog_ini,
             b.dt_ref_folha,
             c.saldo_fer_min
        FROM FERIAS_PARAMETROS a, PARAMETROS_RECURSOS_HUMANOS b, FILIAIS c
       WHERE a.cod_empresa = pcod_empresa
         AND a.cod_filial = pfilial
         AND b.cod_empresa = a.cod_empresa
         AND c.cod_empresa = a.cod_empresa
         AND c.cod_filial = a.cod_filial;
    --
    v_c1 c1%ROWTYPE;
    --
  BEGIN
  
    -- dbms_output.put_line('Lanc_Abono_P1 #01 '||psaldo||', '||pdias_direito);
  
    pflg_retorno := 'S';
    --
  
    -- dbms_output.put_line('Lanc_Abono_P1 #02');
    OPEN c1;
    FETCH c1
      INTO v_c1;
    CLOSE c1;
  
    pnum_dias_parc1_dsp  := 'S';
    pdias_abono_pec1_dsp := 'S';
    --
    /*
    set_item_instance_property('ferias.num_dias_parc1', current_record, update_allowed, property_true);
    set_item_instance_property('ferias.dias_abono_pec1', current_record, update_allowed, property_true);
    */
  
    -- dbms_output.put_line('Lanc_Abono_P1 #03');
    IF v_c1.qtd_parcelas = 1 AND v_c1.meses_prog_ini >= 12 AND
       pdt_saida_parc1 IS NOT NULL THEN
      --
      -- dbms_output.put_line('Lanc_Abono_P1 #04');
      pflag := 'S';
      --
      -- dbms_output.put_line('Lanc_Abono_P1 #05');
      IF psaldo < 30 AND pdt_fim_per_ferias <= LAST_DAY(v_c1.dt_ref_folha) AND
         v_c1.saldo_fer_min >= psaldo AND
         NVL(pdias_direito, 0) < v_c1.saldo_fer_min -- Humberto/Izidoro 02/03/2016
       THEN
        /* COMENTADO 11/11/2016
        if pdt_saida_parc1 is not null then --cibele
          pnum_dias_parc1  := psaldo;
        end if;
        
        pdias_abono_pec1 := 0;
        */
      
        pnum_dias_parc1_dsp  := 'N';
        pdias_abono_pec1_dsp := 'N';
      
        /*
        set_item_instance_property('ferias.num_dias_parc1', current_record, update_allowed, property_false);
        set_item_instance_property('ferias.dias_abono_pec1', current_record, update_allowed, property_false);
        */
        --
        -- dbms_output.put_line('Lanc_Abono_P1 #06');
        --
        pflg_retorno := 'N';
        -- dbms_output.put_line('Lanc_Abono_P1 #06.1');
        pmsg_retorno := 'A quantidade de dias não pode ser diferente do saldo!';
        -- dbms_output.put_line('Lanc_Abono_P1 #06.2');
        RAISE vsaida_erro;
        --
        -- dbms_output.put_line('Lanc_Abono_P1 #07');
        --
      END IF;
      --
    END IF;
    --
    -- dbms_output.put_line('Lanc_Abono_P1 #08 ');
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
      -- dbms_output.put_line('Lanc_Abono_P1 #09');
    WHEN OTHERS THEN
      -- dbms_output.put_line('Lanc_Abono_P1 #10');
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Lanc_Abono_P1 - Erro: ' || SQLERRM;
  END Lanc_Abono_P1;
  --
  PROCEDURE Vld_Saldo1(pcod_empresa         EMPRESAS.cod%TYPE,
                       pmatricula           INF_PESSOAIS.matricula%TYPE,
                       pfalta_hora          NUMBER,
                       pdt_fim_per_ferias   FERIAS.dt_fim_per_ferias%TYPE,
                       pjornada_reduzida    VARCHAR2,
                       pdias_direito        NUMBER,
                       psaldo_bruto         NUMBER,
                       ptipo_ferias1        IN OUT FERIAS.tipo_ferias1%TYPE,
                       pnum_dias_parc1      IN OUT NUMBER,
                       pdias_abono_pec1     IN OUT FERIAS.dias_abono_pec1%TYPE,
                       psaldo               IN OUT NUMBER,
                       pdias_abono_pec1_dsp OUT VARCHAR2,
                       pnum_dias_parc1_dsp  OUT VARCHAR2,
                       pflg_retorno         IN OUT VARCHAR2,
                       pmsg_retorno         IN OUT VARCHAR2) IS
    CURSOR c1 IS
      SELECT NVL(a.pagto_abono_ferias, 'N') abono_ferias,
             a.saldo_fer_min,
             c.dt_ref_folha,
             d.jornada_reduzida
        FROM filiais_cad                 a,
             INFORMACOES_FUNCIONAIS      b,
             PARAMETROS_RECURSOS_HUMANOS c,
             REG_TRABALHO                d
       WHERE b.cod_empresa = a.cod_empresa
         AND b.filial = a.cod_filial
         AND b.cod_empresa = pcod_empresa
         AND b.matricula = pmatricula
         AND c.cod_empresa = b.cod_empresa
         AND d.cod_empresa = b.cod_empresa
         AND d.cod = b.reg_trab;
    --
    v_c1 c1%ROWTYPE;
    --
    --vsaldoo VARCHAR2(1000);
    vposicao NUMBER := 0;
    --vsaldo NUMBER;
    vsaida_erro EXCEPTION;
    --
  BEGIN
    --
    dbms_output.put_line('Vld_Saldo1 #01 pnum_dias_parc1: ' ||
                         pnum_dias_parc1);
    --
    pflg_retorno := 'S';
    --
    vposicao := 1;
    --
    OPEN c1;
    FETCH c1
      INTO v_c1;
    CLOSE c1;
    --vsaldo := NULL;
    --
    vposicao := 2;
    --
    IF v_c1.abono_ferias = 'N' THEN
      vposicao := 3;
      -- condicao 1
      pdias_abono_pec1 := 0;
    
      dbms_output.put_line('Vld_Saldo1 #02 pnum_dias_parc1: ' ||
                           pnum_dias_parc1);
    
      IF pnum_dias_parc1 IS NULL AND pdias_direito < v_c1.saldo_fer_min THEN
        -- Humberto/Izidoro 02/03/2016
        -- Chamado 8379 - Não alterar se o campo já estiver preenchido
        -- if pdt_saida_parc1 is not null then  --cibele
        pnum_dias_parc1 := psaldo;
        -- end if;
      
        dbms_output.put_line('Vld_Saldo1 #03 pnum_dias_parc1: ' ||
                             pnum_dias_parc1 || ' psaldo: ' || psaldo);
      END IF;
    
      pdias_abono_pec1_dsp := 'N';
      pnum_dias_parc1_dsp  := 'N';
    
      -- set_item_property('ferias.dias_abono_pec1', enabled, property_false);
      -- set_item_property('ferias.num_dias_parc1' , enabled, property_false);
    
    ELSIF v_c1.abono_ferias = 'S' -- condicao 2
          AND psaldo < v_c1.saldo_fer_min THEN
    
      dbms_output.put_line('Vld_Saldo1 #03.1 pnum_dias_parc1: ' ||
                           pnum_dias_parc1 || ' psaldo: ' || psaldo ||
                           ' v_c1.saldo_fer_min: ' || v_c1.saldo_fer_min);
    
      vposicao := 4;
      IF pdt_fim_per_ferias > LAST_DAY(v_c1.dt_ref_folha) AND
         NVL(pfalta_hora, 0) <= 5 THEN
        NULL;
        dbms_output.put_line('Vld_Saldo1 #03.2 pnum_dias_parc1: ' ||
                             pnum_dias_parc1 || ' psaldo: ' || psaldo ||
                             ' v_c1.saldo_fer_min: ' || v_c1.saldo_fer_min);
      ELSE
        vposicao         := 5;
        pdias_abono_pec1 := 0;
        vposicao         := 51;
      
        dbms_output.put_line('Vld_Saldo1 #04 pnum_dias_parc1: ' ||
                             pnum_dias_parc1 || ' pjornada_reduzida: ' ||
                             pjornada_reduzida);
      
        IF NVL(pjornada_reduzida, 'N') = 'N' THEN
          psaldo := (30 - NVL(trim(psaldo_bruto), 0)) +
                    NVL(trim(psaldo), 0);
        
          dbms_output.put_line('Vld_Saldo1 #04.1 pnum_dias_parc1: ' ||
                               pnum_dias_parc1);
        
        ELSE
          vposicao        := 52;
          psaldo          := (18 - NVL(trim(psaldo_bruto), 0)) +
                             (NVL(trim(psaldo), 0));
          vposicao        := 533 || pcod_empresa || pmatricula || psaldo;
          pnum_dias_parc1 := psaldo; --f_jornada_reduzida(pcod_empresa,pmatricula,psaldo,null); -- Rodrigo (Chamado 9869)
          vposicao        := 54;
          dbms_output.put_line('Vld_Saldo1 #03.2 pnum_dias_parc1: ' ||
                               pnum_dias_parc1 || ' psaldo: ' || psaldo ||
                               ' v_c1.saldo_fer_min: ' ||
                               v_c1.saldo_fer_min);
        
        END IF;
      
        IF trim(pnum_dias_parc1) IS NULL /*and pdt_saida_parc1 is not null */
           AND pdias_direito < v_c1.saldo_fer_min THEN
          dbms_output.put_line('Vld_Saldo1 #04.1.2 pnum_dias_parc1: ' ||
                               pnum_dias_parc1);
          vposicao := 55;
          -- Chamado 8379 - Não alterar se o campo já estiver preenchido
          pnum_dias_parc1 := psaldo;
          dbms_output.put_line('Vld_Saldo1 #05.2 pnum_dias_parc1: ' ||
                               pnum_dias_parc1);
        END IF;
      
        -- set_item_property('ferias.dias_abono_pec1', enabled, property_false);
        -- set_item_property('ferias.num_dias_parc1' , enabled, property_false);
        pdias_abono_pec1_dsp := 'N';
        pnum_dias_parc1_dsp  := 'N';
      
      END IF;
      --
    ELSIF v_c1.abono_ferias = 'S' AND pSALDO_BRUTO < 30 AND
          v_c1.saldo_fer_min <= pdias_direito THEN
      vposicao := 6;
      -- condicao 4
      dbms_output.put_line('Vld_Saldo1 #06 pnum_dias_parc1: ' ||
                           pnum_dias_parc1);
      IF NVL(pjornada_reduzida, 'N') = 'N' THEN
        psaldo := (30 - NVL(trim(psaldo_bruto), 0)) +
                  (NVL(trim(psaldo), 0));
      ELSE
        psaldo          := (18 - NVL(trim(psaldo_bruto), 0)) +
                           (NVL(trim(psaldo), 0));
        pnum_dias_parc1 := psaldo; -- f_jornada_reduzida(pcod_empresa,pmatricula,:global.saldo,null); -- Rodrigo (Chamado 9869)
        dbms_output.put_line('Vld_Saldo1 #07 pnum_dias_parc1: ' ||
                             pnum_dias_parc1);
      END IF;
      --:global.saldo           := (30 - nvl(psaldo_bruto,0)) + nvl(psaldo,0);
      dbms_output.put_line('Vld_Saldo1 #08 pnum_dias_parc1: ' ||
                           pnum_dias_parc1);
      IF pnum_dias_parc1 IS NULL THEN
        -- Chamado 8379 - Não alterar se o campo já estiver preenchido
        pnum_dias_parc1 := psaldo;
        dbms_output.put_line('Vld_Saldo1 #09 pnum_dias_parc1: ' ||
                             pnum_dias_parc1);
      END IF;
    
    ELSE
      vposicao := 7;
      -- condicao 5
      psaldo := pdias_direito; -- Humberto/Izidoro 29/09/2014
    END IF;
    vposicao      := 8;
    pTIPO_FERIAS1 := 'N';
    dbms_output.put_line('Vld_Saldo1 #10 pnum_dias_parc1: ' ||
                         pnum_dias_parc1);
    -- Humberto/Izidoro 02/03/2016
    IF pJORNADA_REDUZIDA = 'S' THEN
      pnum_dias_parc1 := pdias_direito;
      dbms_output.put_line('Vld_Saldo1 #11 pnum_dias_parc1: ' ||
                           pnum_dias_parc1);
    END IF;
    -----------------------------------------
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      pmsg_retorno := vposicao || pmsg_retorno;
      NULL;
    WHEN OTHERS THEN
      dbms_output.put_line('Vld_Saldo1 ERRO ' || SQLERRM);
      pflg_retorno := 'N';
      pmsg_retorno := vposicao || 'Pkg_Ferias.Vld_Saldo1 - Erro: ' ||
                      SQLERRM;
  END Vld_Saldo1;
  --
  PROCEDURE Vld_Num_Dias_Parc1(pcod_empresa              EMPRESAS.cod%TYPE,
                               pmatricula                INF_PESSOAIS.matricula%TYPE,
                               pind_limpa                VARCHAR2,
                               pnum_dias_parc1           NUMBER,
                               pdias_direito             NUMBER,
                               pdt_retorno_parc1         IN OUT FERIAS.dt_retorno_parc1%TYPE,
                               pdias_abono_pec1          IN OUT FERIAS.dias_abono_pec1%TYPE,
                               pdt_saida_parc1           IN OUT FERIAS.dt_saida_parc1%TYPE,
                               pdias_descanso_adicional  IN OUT FERIAS.dias_descanso_adicional%TYPE,
                               pdesc_adicional1          IN OUT FERIAS.desc_adicional1%TYPE,
                               ptipo_ferias1             OUT FERIAS.tipo_ferias1%TYPE,
                               pflg_retorno              OUT VARCHAR2,
                               pmsg_retorno              OUT VARCHAR2,
                               pcod_ferias_param_parcela ferias_parametros_parcelas.cod%TYPE DEFAULT 1) IS
    --
    vl_abono_ferias FERIAS_PARAMETROS.abono_ferias%TYPE;
    numero_filial   INFORMACOES_FUNCIONAIS.filial%TYPE;
    vl_anos         NUMBER;
    vl_idade_minima FERIAS_PARAMETROS.idade_minima%TYPE;
    vl_idade_maxima FERIAS_PARAMETROS.idade_maxima%TYPE;
    vl_filial       INFORMACOES_FUNCIONAIS.filial%TYPE;
    vl_dt_nasc      INF_PESSOAIS.dt_nasc%TYPE;
    vl_sit          NUMBER := 0;
    c_dias_ferias CONSTANT NUMBER DEFAULT 30;
    --
    v_qtde_min_dias    FERIAS_PARAMETROS.qtde_minimo_dias%TYPE DEFAULT 0;
    v_qtde_tot_dias    FERIAS.saldo%TYPE DEFAULT 0;
    V_JORNADA_REDUZIDA REG_TRABALHO.JORNADA_REDUZIDA%TYPE;
    --
  
    --++30032020
    --vAnos        NUMBER(4);
    vMeses       NUMBER(10);
    vAdmissao    DATE;
    vDiasDireito NUMBER(2);
  
    PROCEDURE Valida_Bonus_Ferias(pcod_empresa             EMPRESAS.cod%TYPE,
                                  pmatricula               INF_PESSOAIS.matricula%TYPE,
                                  pdias_descanso_adicional IN OUT FERIAS.dias_descanso_adicional%TYPE,
                                  pdesc_adicional1         IN OUT FERIAS.desc_adicional1%TYPE,
                                  pnum_dias_parc1          NUMBER,
                                  pflg_retorno             OUT VARCHAR2,
                                  pmsg_retorno             OUT VARCHAR2) IS
      --
      numero_filial    INFORMACOES_FUNCIONAIS.filial%TYPE;
      vl_abono_ferias  FERIAS_PARAMETROS.abono_ferias%TYPE;
      vl_dias_comparar NUMBER(2) := 0;
      vnum_dias_parc1  FERIAS.num_dias_parc1%TYPE;
      --
    BEGIN
      --
      BEGIN
        --
        SELECT A.filial, B.JORNADA_REDUZIDA
          INTO numero_filial, V_JORNADA_REDUZIDA
          FROM informacoes_funcionais_cad A, REG_TRABALHO B
         WHERE A.cod_empresa = pcod_empresa
           AND A.matricula = pmatricula
           AND B.COD_EMPRESA = A.COD_EMPRESA
           AND B.COD = A.REG_TRAB;
        --
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
      --
      BEGIN
        --
        SELECT abono_ferias
          INTO vl_abono_ferias
          FROM FERIAS_PARAMETROS
         WHERE cod_empresa = pcod_empresa
           AND cod_filial = numero_filial;
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          vl_abono_ferias := 0;
        WHEN TOO_MANY_ROWS THEN
          vl_abono_ferias := 0;
      END;
      --
      IF vl_abono_ferias = 1 THEN
        --
        BEGIN
          --
          SELECT DISTINCT prfer.dias_descanso, prfer.desc_adicional
            INTO vnum_dias_parc1, pdesc_adicional1
            FROM PARAM_REGRA_FERIAS         prfer,
                 CATEGORIA_FERIAS           cfer,
                 REGRA_FERIAS               rfer,
                 CATEG_FERIAS_X_CCUSTO      ctgf,
                 informacoes_funcionais_cad FUNC,
                 CARGOS                     crga
           WHERE rfer.id_regra_ferias = cfer.id_regra_ferias
             AND rfer.id_regra_ferias = prfer.id_regra_ferias
             AND cfer.id_categoria_ferias = ctgf.id_categoria_ferias(+)
             AND FUNC.matricula = pmatricula
             AND FUNC.cargo = crga.cod
             AND prfer.direito_adquirido >= (NVL(prfer.dias_descanso, 0) +
                 NVL(prfer.desc_adicional, 0))
             AND prfer.desc_adicional <= pdias_descanso_adicional
             AND crga.CLASS_CARGO = cfer.cod_class_cargo
             AND prfer.dias_descanso = pnum_dias_parc1;
          --
        EXCEPTION
          WHEN TOO_MANY_ROWS THEN
            BEGIN
              --
              IF pdias_descanso_adicional = 12 THEN
                vl_dias_comparar := 11;
              ELSIF pdias_descanso_adicional = 5 THEN
                vl_dias_comparar := 4;
              END IF;
              --
              SELECT DISTINCT prfer.dias_descanso, prfer.desc_adicional
                INTO vnum_dias_parc1, pdesc_adicional1
                FROM PARAM_REGRA_FERIAS         prfer,
                     CATEGORIA_FERIAS           cfer,
                     REGRA_FERIAS               rfer,
                     CATEG_FERIAS_X_CCUSTO      ctgf,
                     informacoes_funcionais_cad FUNC,
                     CARGOS                     crga
               WHERE rfer.id_regra_ferias = cfer.id_regra_ferias
                 AND rfer.id_regra_ferias = prfer.id_regra_ferias
                 AND cfer.id_categoria_ferias = ctgf.id_categoria_ferias(+)
                 AND FUNC.matricula = pmatricula
                 AND FUNC.cargo = crga.cod
                    --        and prfer.direito_adquirido              = ( nvl(prfer.dias_descanso,0) + nvl(prfer.desc_adicional,0) )
                 AND prfer.desc_adicional = vl_dias_comparar
                 AND crga.CLASS_CARGO = cfer.cod_class_cargo
                 AND prfer.dias_descanso = pnum_dias_parc1;
              --
            EXCEPTION
              WHEN NO_DATA_FOUND THEN
                BEGIN
                  SELECT DISTINCT prfer.dias_descanso, prfer.desc_adicional
                    INTO vnum_dias_parc1, pdesc_adicional1
                    FROM PARAM_REGRA_FERIAS         prfer,
                         CATEGORIA_FERIAS           cfer,
                         REGRA_FERIAS               rfer,
                         informacoes_funcionais_cad FUNC,
                         CARGOS                     crga
                   WHERE rfer.id_regra_ferias = cfer.id_regra_ferias
                     AND rfer.id_regra_ferias = prfer.id_regra_ferias
                     AND FUNC.matricula = pmatricula
                     AND FUNC.cargo = crga.cod
                     AND crga.CLASS_CARGO = cfer.cod_class_cargo
                     AND prfer.dias_descanso = pnum_dias_parc1
                     AND prfer.direito_adquirido =
                         (NVL(prfer.dias_descanso, 0) +
                         NVL(prfer.desc_adicional, 0))
                        --              and prfer.desc_adicional                 <= pdias_descanso_adicional
                     AND cfer.id_categoria_ferias NOT IN
                         (SELECT ctgf.id_categoria_ferias
                            FROM CATEG_FERIAS_X_CCUSTO ctgf
                           WHERE ctgf.id_categoria_ferias =
                                 cfer.id_categoria_ferias);
                EXCEPTION
                  WHEN NO_DATA_FOUND THEN
                    --                    vnum_dias_parc1  := 0;
                    pdesc_adicional1 := 0;
                  WHEN TOO_MANY_ROWS THEN
                    pflg_retorno := 'N';
                    pmsg_retorno := 'Registros duplicados na base !!!!';
                    --                    vnum_dias_parc1  := 0;
                    pdesc_adicional1 := 0;
                    RAISE vsaida_erro;
                END;
                --
            END;
            --
        END;
        --
      END IF;
      --
    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Ferias.Valida_Bonus_Ferias - Erro: ' ||
                        SQLERRM;
    END Valida_Bonus_Ferias;
    --
  BEGIN
    --
    /*PFLG_RETORNO := 'N';
    PMSG_RETORNO := 'pind_situacao_periodo '||pind_situacao_periodo||', pdias_abono_pec1 '||pdias_abono_pec1;
    RAISE VSAIDA_ERRO;*/
    /*          pflg_retorno := 'N';
      pmsg_retorno := 'pnum_dias_parc1 '||pnum_dias_parc1||' + pdias_abono_pec1 '||pdias_abono_pec1||'=> ('||
      (pnum_dias_parc1 + nvl(pdias_abono_pec1,0))||') > vDiasDireito '||vDiasDireito;
      raise vsaida_erro;
    pflg_retorno := 'N';
    pmsg_retorno := 'pcod_empresa '||pcod_empresa||', pmatricula '||pmatricula||', pind_limpa '||pind_limpa
                    ||', pnum_dias_parc1 '||pnum_dias_parc1||', pdias_direito '||pdias_direito
                    ||', pdt_retorno_parc1 '||pdt_retorno_parc1||', pdias_abono_pec1 '||pdias_abono_pec1
                    ||', pdt_saida_parc1 '||pdt_saida_parc1||', pdt_saida_parc1 '||pdt_saida_parc1
                    ||', pdias_descanso_adicional '||pdias_descanso_adicional||', pdesc_adicional1 '||pdesc_adicional1
                    ||', ptipo_ferias1 '||ptipo_ferias1;
    raise vsaida_erro;*/
  
    --
    pflg_retorno := 'S';
    --
    -- Validação dos dias de férias, a pedido de Ana Camillo e Alex Yamada,
    -- passou a considerar sempre 30 dias como saldo de férias, independente
    -- de quantos dias o funcionário possua para gozo de férias
    --
    -- validação dos dias de férias, a pedido de ana camillo e alex yamada,
    -- passou a considerar sempre 30 dias como saldo de férias, independente
    -- de quantos dias o funcionário possua para gozo de férias
    --
    BEGIN
      --
      SELECT ifu.filial, ip.dt_nasc, ifu.dt_admissao
        INTO vl_filial, vl_dt_nasc, vAdmissao
        FROM informacoes_funcionais_cad ifu, inf_pessoais_cad ip
       WHERE ifu.cod_empresa = ip.cod_empresa
         AND ifu.matricula = ip.matricula
         AND ifu.cod_empresa = pcod_empresa
         AND ifu.matricula = pmatricula;
      --
      vl_sit := 1;
      --
      SELECT idade_minima, idade_maxima
        INTO vl_idade_minima, vl_idade_maxima
        FROM FERIAS_PARAMETROS
       WHERE cod_empresa = pcod_empresa
         AND cod_filial = vl_filial;
      --
      vl_anos := TRUNC(MONTHS_BETWEEN(pdt_saida_parc1, vl_dt_nasc) / 12);
      --
      IF (pnum_dias_parc1 + NVL(pdias_abono_pec1, 0)) < c_dias_ferias AND
         V_jornada_reduzida = 'N' -- Humberto/Izidoro 03/03/2016: acrescentado este and
       THEN
        IF ((vl_anos < vl_idade_minima) OR (vl_anos > vl_idade_maxima)) AND
           ((vl_idade_minima + vl_idade_maxima) != 0) THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Colaborador com idade que não permite parcelamento de férias!';
          RAISE vsaida_erro;
        END IF;
      END IF;
      --
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        IF vl_sit = 0 THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Pkg_Ferias.Valida_Num_Dias_Parc1 - Erro ao verificar a data de nascimento do colaborador: ' ||
                          SQLERRM;
          RAISE vsaida_erro;
        ELSIF vl_sit = 1 THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Pkg_Ferias.Valida_Num_Dias_Parc1 - Erro ao verificar idade limite no parâmetro de férias: ' ||
                          SQLERRM;
          RAISE vsaida_erro;
        END IF;
    END;
    --
    BEGIN
      --
      SELECT filial
        INTO numero_filial
        FROM informacoes_funcionais_cad
       WHERE cod_empresa = pcod_empresa
         AND matricula = pmatricula;
      --
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
    --
    BEGIN
      --
      SELECT abono_ferias
        INTO vl_abono_ferias
        FROM FERIAS_PARAMETROS
       WHERE cod_empresa = pcod_empresa
         AND cod_filial = numero_filial;
      --
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        vl_abono_ferias := 0;
    END;
    --
    IF NVL(pnum_dias_parc1, 0) = 0 AND NVL(pdias_abono_pec1, 0) = 0 THEN
      ptipo_ferias1 := NULL;
    ELSE
      ptipo_ferias1 := 'N';
    END IF;
    --
    IF pnum_dias_parc1 IS NULL AND pdt_saida_parc1 IS NOT NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Vld_Num_Dias_Parc1.pNum_Dias_Parc1: Campo obrigatório!';
      RAISE vsaida_erro;
    END IF;
  
    --
    /*    if vl_abono_ferias <> 1 then
      --
      if pnum_dias_parc1 > (c_dias_ferias - nvl(pdias_abono_pec1, 0)) then
        --
        disponivel := c_dias_ferias - nvl(pdias_abono_pec1, 0);
        --
        if nvl(pdias_abono_pec1,0) > 0 then
          pdias_abono_pec1 := 0;
        else
          pflg_retorno := 'N';
          pmsg_retorno := 'Número de dias de férias maior que '||to_char(pdias_direito);
          raise vsaida_erro;
        end if;
        --
      end if;
    end if;*/ -- Comentado Adriana/Cibele 05/02/2016
    --
    BEGIN
      --
      SELECT fer.qtde_minimo_dias
        INTO v_qtde_min_dias
        FROM FERIAS_PARAMETROS fer, inf_pessoais_cad inf
       WHERE inf.cod_empresa = fer.cod_empresa
         AND inf.cod_empresa = pcod_empresa
         AND inf.matricula = pmatricula
         AND inf.filial = fer.cod_filial;
      --
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        v_qtde_min_dias := 0;
      WHEN OTHERS THEN
        v_qtde_min_dias := 0;
    END;
    --
    v_qtde_tot_dias := NVL(pnum_dias_parc1, 0);
    --
    IF NVL(pind_limpa, 'N') = 'N' AND V_jornada_reduzida = 'N' THEN
      -- Humberto/Izidoro 03/03/2016: acrescentado este and
      --
      IF NVL(v_qtde_tot_dias, 0) > 0 AND
         v_qtde_tot_dias < NVL(v_qtde_min_dias, 0) AND pdias_direito >= 30 THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'O número de dias de férias deve ser maior ou igual ao mínimo permitido de ' ||
                        LPAD(v_qtde_min_dias, 2, 0) || ' dias!';
        RAISE vsaida_erro;
      END IF;
      --
    END IF;
    --
    Valida_Bonus_Ferias(pcod_empresa,
                        pmatricula,
                        pdias_descanso_adicional,
                        pdesc_adicional1,
                        pnum_dias_parc1,
                        pflg_retorno,
                        pmsg_retorno);
    IF NVL(pflg_retorno, 'S') <> 'S' THEN
      --      pmsg_retorno := pdias_descanso_adicional||', '||pnum_dias_parc1||' = > '||pmsg_retorno;
      RAISE vsaida_erro;
    END IF;
    --
    pdt_retorno_parc1 := (pdt_saida_parc1 + NVL(pnum_dias_parc1, 0) +
                         NVL(pdesc_adicional1, 0));
    --
    IF pnum_dias_parc1 = 0 THEN
      pdesc_adicional1 := 0;
    END IF;
    --
    IF pnum_dias_parc1 IS NOT NULL AND pnum_dias_parc1 > c_dias_ferias THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'A quantidade de dias de férias não pode exceder o saldo de ' ||
                      c_dias_ferias || ' dias!';
      RAISE vsaida_erro;
    END IF;
  
    /***************************************************/
  
    --++30032020
    /* vAnos  := F_Tempo(vAdmissao,'aA mM dD hH miMI', pdt_saida_parc1, 'A');
    vMeses := F_Tempo(vAdmissao,'aA mM dD hH miMI', pdt_saida_parc1, 'A') * 12
            + F_Tempo(vAdmissao,'aA mM dD hH miMI', pdt_saida_parc1, 'M');
            */
  
    vMeses := FLOOR(MONTHS_BETWEEN(TRUNC(SYSDATE), TRUNC(vAdmissao)));
  
    IF NVL(vMeses, 0) < 12 THEN
    
      BEGIN
        SELECT dias_direito
          INTO vDiasDireito
          FROM ferias_parametros_parcelas
         WHERE cod_Empresa = pcod_empresa
           AND cod_filial = vl_filial
           AND cod = pcod_ferias_param_parcela
           AND NVL(vMeses, 0) BETWEEN meses_min AND meses_max;
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          vDiasDireito := 0;
      END;
    
      IF (pnum_dias_parc1 + NVL(pdias_abono_pec1, 0)) > vDiasDireito THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Colaborador com menos de 6 meses tem direito a ' ||
                        vDiasDireito || ' dias!';
      
        RAISE vsaida_erro;
      END IF;
    
    END IF;
    --++
  
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Vld_Num_Dias_Parc1 - Erro: ' || SQLERRM;
  END Vld_Num_Dias_Parc1;
  --
  PROCEDURE Dias_Parc1(pdt_saida_parc1    FERIAS.dt_saida_parc1%TYPE,
                       pdt_fim_per_ferias FERIAS.dt_fim_per_ferias%TYPE,
                       pnum_dias_parc1    NUMBER,
                       pdias_abono_pec1   IN OUT FERIAS.dias_abono_pec1%TYPE,
                       psaldo             NUMBER, -- :global.saldo (F012014_A)
                       pcod_empresa       empresas.cod%TYPE,
                       pmatricula         inf_pessoais.matricula%TYPE,
                       pjornada_reduzida  VARCHAR2,
                       pflg_retorno       OUT VARCHAR2,
                       pmsg_retorno       OUT VARCHAR2) IS
    --
    CURSOR c1 IS
      SELECT a.qtd_parcelas,
             nvl(a.antecipa_parc_1, 0) antecipa_parc_1,
             nvl(a.valida_saldo_ferias, 'S') valida_saldo_ferias,
             a.QTDE_DIAS_DIREITO,
             a.FALTAS_FERIAS --, a.QTDE_DIAS_SEG_PERIODO
        FROM ferias_parametros a, informacoes_funcionais b
       WHERE a.cod_empresa = pcod_empresa
         AND b.cod_empresa = a.cod_empresa
         AND b.matricula = pmatricula
         AND a.cod_filial = b.filial;
    v_c1 c1%ROWTYPE;
    --
    CURSOR c2 IS
      SELECT f.dt_inic_per_ferias, f.dt_fim_per_ferias
        FROM ferias f
       WHERE f.cod_empresa = pcod_empresa
         AND f.matricula = pmatricula
         AND f.dt_fim_per_ferias = pdt_fim_per_ferias;
    v_c2 c2%ROWTYPE;
    --global_saldo NUMBER := NULL;
    v_saldo number := 0;
    --V_ERRO  VARCHAR2(300);
  BEGIN
  
    pflg_retorno := 'S';
    --
    --insert into testex values (888,'Dias_Parc1 -> pdt_saida_parc1: '||pdt_saida_parc1||' num_dias_parc1: '||NVL(pnum_dias_parc1, 0)); commit;
  
    OPEN c1;
    FETCH c1
      INTO v_c1;
    CLOSE c1;
    --
    --Bruno Sousa 15/03/2024 Comentado pois precisa validar o saldo
    --IF existe_p1(NULL,pcod_empresa,pmatricula,NULL,pdt_fim_per_ferias) THEN
    IF V_C1.Valida_Saldo_Ferias = 'S' AND V_C1.ANTECIPA_PARC_1 > 0 THEN
      --global_saldo := NULL;
      --
      IF pjornada_reduzida = 'N' THEN
        -- Humberto/Izidoro 07/03/2016: acrescentado jornada_reduzida
        --
        /*
        PFLG_RETORNO := 'N';
        PMSG_RETORNO := 'SALDO: '||psaldo||', pdt_saida_parc1: '||pdt_saida_parc1||', pdt_fim_per_ferias: '||pdt_fim_per_ferias||', pnum_dias_parc1: '||pnum_dias_parc1||', pdias_abono_pec1: '||pdias_abono_pec1;
        RAISE VSAIDA_ERRO;
        */
        begin
          OPEN c2;
          FETCH c2
            INTO v_c2;
          CLOSE c2;
        
          v_saldo := Pkg_Atlz_Saldo_Ferias.CALCULA_SALDO(COD_EMPRESA_        => pcod_empresa,
                                                         MATRICULA_          => pmatricula,
                                                         DT_INIC_            => V_C2.DT_INIC_PER_FERIAS,
                                                         DT_FIM_             => V_C2.DT_FIM_PER_FERIAS,
                                                         DT_REFERENCIA_      => pdt_saida_parc1,
                                                         V_QTDE_DIAS_DIREITO => V_C1.QTDE_DIAS_DIREITO,
                                                         V_FALTAS_FERIAS     => V_C1.FALTAS_FERIAS /*,
                                                                                                                                                                                                                                                                                                                                                                              V_QTDE_DIAS_SEG_PERIODO => V_C1.QTDE_DIAS_SEG_PERIODO*/);
        
        exception
          when others then
            --V_ERRO := SUBSTR(SQLERRM, 1, 300);
            v_saldo := psaldo;
        end;
      
        -- Em caso de antecipação de férias valida o saldo de dias que está sendo solicitado
        IF V_C1.antecipa_parc_1 > 0 AND
           NVL(pnum_dias_parc1, 0) + NVL(pdias_abono_pec1, 0) > v_saldo THEN
          --global_saldo THEN
          --
          -- insert into testex values (888, 'num_dias_parc1: '||NVL(pnum_dias_parc1, 0)||' + dias_abono_pec1: '||NVL(pdias_abono_pec1, 0)||' > saldo: '||psaldo); commit;
        
          pflg_retorno := 'N';
          pmsg_retorno := 'A quantidade de dias da parcela não pode ser maior que ""' ||
                          v_saldo || '""!';
          RAISE vsaida_erro;
          --
        ELSIF NVL(pnum_dias_parc1, 0) + NVL(pdias_abono_pec1, 0) <= v_saldo THEN
          --global_saldo THEN
          --
          IF v_c1.qtd_parcelas = 1 THEN
            --
          
            -- Comentado para implementar a terceira parcela com parametrizacao por empresa. Igor Cardoso  04/05/2018
            NULL;
            /*IF psaldo = 30 THEN
              IF pnum_dias_parc1 <> 20 THEN
                pflg_retorno := 'N';
                pmsg_retorno := 'O valor para este campo deve ser 20 ou 30! Saldo atual: ' ||
                                psaldo || '.';
                RAISE vsaida_erro;
              ELSIF pnum_dias_parc1 = 20 THEN
                pdias_abono_pec1 := 10;
              END IF;
            END IF;*/
            --
            /* IF psaldo = 24 THEN
              IF pnum_dias_parc1 <> 16 THEN
                pflg_retorno := 'N';
                pmsg_retorno := 'O valor para este campo deve ser 16 ou 24! Saldo atual: ' ||
                                psaldo || '.';
                RAISE vsaida_erro;
              ELSIF pnum_dias_parc1 = 16 THEN
                pdias_abono_pec1 := 8;
              END IF;
              --
            END IF;*/
            --
            /*IF psaldo = 18 THEN
              IF pnum_dias_parc1 <> 12 THEN
                pflg_retorno := 'N';
                pmsg_retorno := 'O valor para este campo deve ser 12 ou 18! Saldo atual: ' ||
                                psaldo || '.';
                RAISE vsaida_erro;
              ELSIF pnum_dias_parc1 = 12 THEN
                pdias_abono_pec1 := 6;
              END IF;
            END IF;*/
            --
            /*IF psaldo = 12 THEN
              IF pnum_dias_parc1 <> 8 THEN
                pflg_retorno := 'N';
                pmsg_retorno := 'O valor para este campo deve ser 8 ou 12! Saldo atual: ' ||
                                psaldo || '.';
                RAISE vsaida_erro;
              ELSIF pnum_dias_parc1 = 8 THEN
                pdias_abono_pec1 := 4;
              END IF;
            END IF;*/
            --
            /*IF psaldo = 0 THEN
              IF pnum_dias_parc1 <> 0 THEN
                pflg_retorno     := 'N';
                pmsg_retorno     := 'O valor para este campo deve ser 0! Saldo atual: ' ||psaldo || '.';
                pdias_abono_pec1 := 0;
                RAISE vsaida_erro;
              END IF;
            END IF;*/
          
          ELSIF v_c1.qtd_parcelas >= 2 THEN
            --
            -- Comentado para implementar a terceira parcela com parametrizacao por empresa. Igor Cardoso  04/05/2018
            NULL;
            /*
            if psaldo = 30
            and pnum_dias_parc1 not in(30, 15, 20, 10) then
               pflg_retorno := 'N';
               pmsg_retorno := 'Só é permitido informar: 10, 20, 15, ou 30 dias!';
               raise vsaida_erro;
            end if;
            */
            --
          END IF;
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
      pmsg_retorno := 'Pkg_Ferias.Dias_Parc1 - Erro: ' || SQLERRM;
  END Dias_Parc1;
  --
  -- Trigger PRE-TEXT-ITEM do campo Dt_Saida_Parc1
  PROCEDURE Pre_Text_Dt_Saida_Parc1(pcod_empresa          EMPRESAS.cod%TYPE,
                                    pmatricula            INF_PESSOAIS.matricula%TYPE,
                                    pfalta_hora           NUMBER,
                                    pdt_fim_per_ferias    FERIAS.dt_fim_per_ferias%TYPE,
                                    pjornada_reduzida     VARCHAR2,
                                    pdias_direito         NUMBER,
                                    psaldo_bruto          NUMBER,
                                    ptipo_ferias1         IN OUT FERIAS.tipo_ferias1%TYPE,
                                    pnum_dias_parc1       IN OUT NUMBER,
                                    pdias_abono_pec1      IN OUT FERIAS.dias_abono_pec1%TYPE,
                                    psaldo                IN OUT NUMBER,
                                    pind_situacao_periodo FERIAS.ind_situacao_periodo%TYPE,
                                    pdias_abono_pec1_dsp  OUT VARCHAR2,
                                    pnum_dias_parc1_dsp   OUT VARCHAR2,
                                    pflg_retorno          IN OUT VARCHAR2,
                                    pmsg_retorno          IN OUT VARCHAR2) IS
  BEGIN
    --
    pflg_retorno := 'S';
    --
    IF NVL(pind_situacao_periodo, 'P') = 'P' THEN
      NULL;
    ELSE
      ptipo_ferias1    := ptipo_ferias1;
      pnum_dias_parc1  := pnum_dias_parc1;
      pdias_abono_pec1 := pdias_abono_pec1;
      psaldo           := psaldo;
      RAISE vsaida_erro;
    END IF;
    --
    dbms_output.put_line('Pre_Text_Dt_Saida_Parc1 #01 pnum_dias_parc1: ' ||
                         pnum_dias_parc1);
  
    Vld_Saldo1(pcod_empresa,
               pmatricula,
               pfalta_hora,
               pdt_fim_per_ferias,
               pjornada_reduzida,
               pdias_direito,
               psaldo_bruto,
               ptipo_ferias1,
               pnum_dias_parc1,
               pdias_abono_pec1,
               psaldo,
               pdias_abono_pec1_dsp,
               pnum_dias_parc1_dsp,
               pflg_retorno,
               pmsg_retorno);
  
    dbms_output.put_line('Pre_Text_Dt_Saida_Parc1 #02 pnum_dias_parc1: ' ||
                         pnum_dias_parc1);
  
    IF NVL(pflg_retorno, 'S') <> 'S' THEN
      RAISE vsaida_erro;
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Pre_TextItem_Dt_Saida_Parc1 - Erro: ' ||
                      SQLERRM;
  END Pre_Text_Dt_Saida_Parc1;
  --
  PROCEDURE Valida_Sit_Requisicao(pcod_empresa    EMPRESAS.cod%TYPE,
                                  psolicitacao    REQUISICAO_FERIAS.cod_solicitacao%TYPE,
                                  pmatricula      INF_PESSOAIS.matricula%TYPE,
                                  psit_requisicao REQUISICAO_FERIAS.sit_requisicao%TYPE,
                                  pusuario_logado USUARIO_ORACLE.nm_usuario_oracle%TYPE,
                                  pflg_retorno    IN OUT VARCHAR2,
                                  pmsg_retorno    IN OUT VARCHAR2) IS
    --
    --VTESTE VARCHAR2(4000);
    v_sit_req REQUISICAO_FERIAS.sit_requisicao%TYPE;
    --
    CURSOR c_req_ferias IS
      SELECT * FROM requisicao_ferias WHERE cod_solicitacao = psolicitacao;
    v_req_ferias c_req_ferias%ROWTYPE;
    --
    --    v_existe_aprov varchar2(1);
    --
    FUNCTION retorna_perfil RETURN VARCHAR2 IS
      v_perfil USUARIO_ORACLE.cd_perfil%TYPE;
    BEGIN
      --
      SELECT cd_perfil
        INTO v_perfil
        FROM USUARIO_ORACLE uo
       WHERE uo.nm_usuario_oracle = pusuario_logado;
      --
      RETURN(v_perfil);
      --
    EXCEPTION
      WHEN OTHERS THEN
        --        v_perfil := null;
        RETURN NULL;
    END retorna_perfil;
    --
    FUNCTION retorna_mat_solicitante RETURN VARCHAR2 IS
      v_MATRICULA USUARIO_ORACLE.CD_MATRICULA%TYPE;
    BEGIN
      --
      SELECT CD_MATRICULA
        INTO v_MATRICULA
        FROM USUARIO_ORACLE uo
       WHERE uo.nm_usuario_oracle = pusuario_logado;
      --
      RETURN(v_MATRICULA);
      --
    EXCEPTION
      WHEN OTHERS THEN
        --        v_perfil := null;
        RETURN NULL;
    END retorna_mat_solicitante;
    --
    PROCEDURE VALIDA_PARCELAS IS
      --
      vdt_ref_FOLHA parametros_recursos_humanos.dt_ref_ferias%TYPE;
      v_processos   VARCHAR2(400) := NULL;
      vl_verificar  NUMBER(1);
      --    v_parcela        number(1);
      --
      vDIAS_ANTES_PAGTO_FERIAS FERIAS_PARAMETROS.DIAS_ANTES_PAGTO_FERIAS%TYPE;
      --VUSUARIO         VARCHAR2(30) := SUBSTR(PUSUARIO_LOGADO||'PkgFer',1,30);
      VPARC_PERMITIDAS_CANCEL NUMBER := 0;
      VSAIDA_ERRO             EXCEPTION;
      --
      CURSOR C_REQ_FERIAS IS
        SELECT *
          FROM REQUISICAO_FERIAS RF
         WHERE RF.COD_SOLICITACAO = PSOLICITACAO;
      R_REQ_FERIAS C_REQ_FERIAS%ROWTYPE;
      --
      CURSOR C_FERIAS(PCOD_EMPRESA        NUMBER,
                      PMATRICULA          NUMBER,
                      PDT_INIC_PER_FERIAS DATE) IS
        SELECT IFF.FILIAL, F.*
          FROM FERIAS F, INFORMACOES_FUNCIONAIS_CAD IFF
         WHERE IFF.MATRICULA = F.MATRICULA
           AND IFF.COD_EMPRESA = F.COD_EMPRESA
           AND F.DT_INIC_PER_FERIAS = PDT_INIC_PER_FERIAS
           AND F.MATRICULA = PMATRICULA
           AND F.COD_EMPRESA = PCOD_EMPRESA;
      R_FERIAS C_FERIAS%ROWTYPE;
      --
      PROCEDURE VALIDA_PARC1 IS
      BEGIN
        --
        PFLG_RETORNO := 'S';
        --
        IF TRUNC(R_FERIAS.DT_SAIDA_PARC1, 'MM') =
           TRUNC(vdt_ref_FOLHA, 'MM') THEN
          v_processos := NULL;
          v_processos := Pkg_Verif_Proc.F_F010332I(R_FERIAS.cod_empresa,
                                                   vdt_ref_FOLHA);
          --
          IF v_processos IS NOT NULL THEN
            DBMS_OUTPUT.PUT_LINE('1');
            PFLG_RETORNO := 'N';
            PMSG_RETORNO := 'P1-Processo de Cancelamento da Programação de Férias não permitido. Nesse momento há os seguintes processos de cálculo sendo executados => ' ||
                            v_processos;
            --**            PKG_REQUISICAO_DIVERSOS.GRAVA_LOG_REQUISICAO(PSOLICITACAO,VUSUARIO||'-Processo de Cancelamento da Programação de Férias não permitido. Nesse momento há os seguintes processos de cálculo sendo executados => '||v_processos||'.'||CHR(10)||'Tente mais tarde novamente.','N','REQ_FERIAS');
            RAISE VSAIDA_ERRO;
          END IF;
        END IF;
        --
        BEGIN
          vl_verificar := NULL;
          SELECT 1
            INTO vl_verificar
            FROM ferias
           WHERE cod_empresa = R_FERIAS.cod_empresa
             AND matricula = R_FERIAS.matricula
             AND TRUNC(DT_INIC_PER_FERIAS) > R_FERIAS.DT_INIC_PER_FERIAS
             AND (TRUNC(DT_SAIDA_PARC1) > R_FERIAS.DT_SAIDA_PARC1 OR
                 TRUNC(DT_SAIDA_PARC2) > R_FERIAS.DT_SAIDA_PARC1);
        EXCEPTION
          WHEN OTHERS THEN
            VL_VERIFICAR := 0;
        END;
        --
        IF VL_VERIFICAR = 1 THEN
          --        AVISO('Funcionário com Programação em Periodos Superiores a  '||TO_CHAR(:ferias.DT_INIC_PER_FERIAS,'DD/MM/YYYY'));
          --**           PKG_REQUISICAO_DIVERSOS.GRAVA_LOG_REQUISICAO(PSOLICITACAO,VUSUARIO||'-Funcionário com Programação em Periodos Superiores a  '||TO_CHAR(R_FERIAS.DT_INIC_PER_FERIAS,'DD/MM/YYYY'),'N','REQ_FERIAS');
          DBMS_OUTPUT.PUT_LINE('2');
          PFLG_RETORNO := 'N';
          PMSG_RETORNO := 'P1-Funcionário com Programação em Periodos Superiores a  ' ||
                          TO_CHAR(R_FERIAS.DT_INIC_PER_FERIAS, 'DD/MM/YYYY');
          RAISE VSAIDA_ERRO;
        ELSE
          IF R_FERIAS.IND_SITUACAO_PERIODO NOT IN ('P', 'R') THEN
            --          AVISO('Funcionário com Programação de Férias já gozadas!');
            --**             PKG_REQUISICAO_DIVERSOS.GRAVA_LOG_REQUISICAO(PSOLICITACAO,VUSUARIO||'-Funcionário com Programação de Férias já gozadas!','N','REQ_FERIAS');
            PFLG_RETORNO := 'N';
            PMSG_RETORNO := 'P1-Funcionário com Programação de Férias já gozadas!';
            DBMS_OUTPUT.PUT_LINE('3');
            RAISE VSAIDA_ERRO;
          ELSE
            DBMS_OUTPUT.PUT_LINE('PARC1 PODE CANCELAR');
            VPARC_PERMITIDAS_CANCEL := VPARC_PERMITIDAS_CANCEL + 1;
          END IF;
        END IF;
        --
      EXCEPTION
        WHEN VSAIDA_ERRO THEN
          NULL;
        WHEN OTHERS THEN
          PFLG_RETORNO := 'N';
          PMSG_RETORNO := SUBSTR('Erro Valida_Parc1: ' || SQLERRM, 1, 4000);
      END VALIDA_PARC1;
      --
      PROCEDURE VALIDA_PARC2 IS
      BEGIN
        --
        pflg_retorno := 'S';
        --
        IF TRUNC(R_FERIAS.DT_SAIDA_PARC2, 'MM') =
           TRUNC(vdt_ref_FOLHA, 'MM') THEN
          v_processos := NULL;
          v_processos := Pkg_Verif_Proc.F_F010332I(R_FERIAS.cod_empresa,
                                                   vdt_ref_FOLHA);
          --
          IF v_processos IS NOT NULL THEN
            pflg_retorno := 'N';
            pmsg_retorno := SUBSTR('Processo de Cancelamento da Programação de Férias não permitido. Nesse momento há os seguintes processos de cálculo sendo executados => ' ||
                                   v_processos || '.' || CHR(10) ||
                                   'Tente mais tarde novamente.',
                                   1,
                                   4000);
            DBMS_OUTPUT.PUT_LINE('4');
            RAISE vsaida_erro;
          END IF;
        END IF;
        --
        IF R_FERIAS.ind_situacao_periodo = 'R' AND
           R_FERIAS.ind_situacao_parc_2 = 'C' THEN
          /**      PFLG_RETORNO := 'N';
                PMSG_RETORNO := SUBSTR('Férias já calculada para a parcela. Limpeza de dados não permitida!',1,4000);
          **/
          --**           PKG_REQUISICAO_DIVERSOS.GRAVA_LOG_REQUISICAO(PSOLICITACAO,VUSUARIO||'-Férias já calculada para a parcela. Limpeza de dados não permitida!','N','REQ_FERIAS');
          PFLG_RETORNO := 'N';
          DBMS_OUTPUT.PUT_LINE('5');
          RAISE VSAIDA_ERRO;
        END IF;
        --
        BEGIN
          vl_verificar := NULL;
          SELECT 1
            INTO vl_verificar
            FROM ferias
           WHERE cod_empresa = R_FERIAS.cod_empresa
             AND matricula = R_FERIAS.matricula
             AND TRUNC(DT_INIC_PER_FERIAS) > R_FERIAS.DT_INIC_PER_FERIAS
             AND (TRUNC(DT_SAIDA_PARC1) > R_FERIAS.DT_SAIDA_PARC2 OR
                 TRUNC(DT_SAIDA_PARC2) > R_FERIAS.DT_SAIDA_PARC2);
        EXCEPTION
          WHEN OTHERS THEN
            VL_VERIFICAR := 0;
        END;
        --
        IF VL_VERIFICAR = 1 THEN
          /**      PFLG_RETORNO := 'N';
                PMSG_RETORNO := SUBSTR('Funcionários com Programação em Periodos Superiores a '||TO_CHAR(R_FERIAS.DT_INIC_PER_FERIAS,'DD/MM/YYYY'),1,4000);
          **/
          --**           PKG_REQUISICAO_DIVERSOS.GRAVA_LOG_REQUISICAO(PSOLICITACAO,VUSUARIO||'-Funcionários com Programação em Periodos Superiores a '||TO_CHAR(R_FERIAS.DT_INIC_PER_FERIAS,'DD/MM/YYYY'),'N','REQ_FERIAS');
          PFLG_RETORNO := 'N';
          PMSG_RETORNO := 'Funcionários com Programação em Periodos Superiores a ' ||
                          TO_CHAR(R_FERIAS.DT_INIC_PER_FERIAS, 'DD/MM/YYYY');
          DBMS_OUTPUT.PUT_LINE('6');
          RAISE VSAIDA_ERRO;
        ELSE
          DBMS_OUTPUT.PUT_LINE('PARC2 PODE CANCELAR');
          VPARC_PERMITIDAS_CANCEL := VPARC_PERMITIDAS_CANCEL + 1;
        END IF;
        --
      END VALIDA_PARC2;
      --
      PROCEDURE VALIDA_PARC3 IS
      BEGIN
        --
        IF TRUNC(R_FERIAS.DT_SAIDA_PARC4, 'MM') =
           TRUNC(vdt_ref_FOLHA, 'MM') THEN
          v_processos := NULL;
          v_processos := Pkg_Verif_Proc.F_F010332I(R_FERIAS.cod_empresa,
                                                   vdt_ref_FOLHA);
          --
          IF v_processos IS NOT NULL THEN
            --
            PFLG_RETORNO := 'N';
            PMSG_RETORNO := SUBSTR('Processo de Cancelamento da Programação de Férias não permitido. Nesse momento há os seguintes processos de cálculo sendo executados => ' ||
                                   v_processos || '.' || CHR(10) ||
                                   'Tente mais tarde novamente.',
                                   1,
                                   4000);
            DBMS_OUTPUT.PUT_LINE('7');
            RAISE VSAIDA_ERRO;
            --
          END IF;
        END IF;
        --
        BEGIN
          VL_VERIFICAR := NULL;
          SELECT 1
            INTO vl_verificar
            FROM ferias
           WHERE cod_empresa = R_FERIAS.cod_empresa
             AND matricula = R_FERIAS.matricula
             AND TRUNC(DT_INIC_PER_FERIAS) > R_FERIAS.DT_INIC_PER_FERIAS
             AND (TRUNC(DT_SAIDA_PARC2) > R_FERIAS.DT_SAIDA_PARC4 OR
                 TRUNC(DT_SAIDA_PARC4) > R_FERIAS.DT_SAIDA_PARC4);
        EXCEPTION
          WHEN OTHERS THEN
            VL_VERIFICAR := 0;
        END;
        --
        IF VL_VERIFICAR = 1 THEN
          /**     PFLG_RETORNO := 'N';
               PMSG_RETORNO := SUBSTR('Funcionários com Programação em Periodos Superiores a  '||TO_CHAR(R_FERIAS.DT_INIC_PER_FERIAS,'DD/MM/YYYY'),1,4000);
          **/
          --**          PKG_REQUISICAO_DIVERSOS.GRAVA_LOG_REQUISICAO(PSOLICITACAO,VUSUARIO||'-Funcionários com Programação em Periodos Superiores a  '||TO_CHAR(R_FERIAS.DT_INIC_PER_FERIAS,'DD/MM/YYYY'),'N','REQ_FERIAS');
          PFLG_RETORNO := 'N';
          PMSG_RETORNO := 'Funcionários com Programação em Periodos Superiores a  ' ||
                          TO_CHAR(R_FERIAS.DT_INIC_PER_FERIAS, 'DD/MM/YYYY');
          DBMS_OUTPUT.PUT_LINE('8');
          RAISE VSAIDA_ERRO;
        ELSE
          DBMS_OUTPUT.PUT_LINE('PARC3 PODE CANCELAR');
          VPARC_PERMITIDAS_CANCEL := VPARC_PERMITIDAS_CANCEL + 1;
        END IF;
        --
      EXCEPTION
        WHEN VSAIDA_ERRO THEN
          NULL;
        WHEN OTHERS THEN
          PFLG_RETORNO := 'N';
          PMSG_RETORNO := SUBSTR('Erro Valida_Parc3: ' || SQLERRM, 1, 4000);
      END VALIDA_PARC3;
      --
    BEGIN
      --
      PFLG_RETORNO := 'S';
      --
      IF C_REQ_FERIAS%ISOPEN THEN
        CLOSE C_REQ_FERIAS;
      END IF;
      OPEN C_REQ_FERIAS;
      FETCH C_REQ_FERIAS
        INTO R_REQ_FERIAS;
      CLOSE C_REQ_FERIAS;
      --
      IF C_FERIAS%ISOPEN THEN
        CLOSE C_FERIAS;
      END IF;
      OPEN C_FERIAS(R_REQ_FERIAS.COD_EMPRESA,
                    R_REQ_FERIAS.MATRICULA,
                    R_REQ_FERIAS.DT_INIC_PER_FERIAS);
      FETCH C_FERIAS
        INTO R_FERIAS;
      CLOSE C_FERIAS;
      --
      SELECT X.DT_REF_FOLHA
        INTO VDT_REF_FOLHA
        FROM PARAMETROS_RECURSOS_HUMANOS X
       WHERE X.COD_EMPRESA = R_FERIAS.COD_EMPRESA;
      --
      SELECT DIAS_ANTES_PAGTO_FERIAS
        INTO VDIAS_ANTES_PAGTO_FERIAS
        FROM FERIAS_PARAMETROS
       WHERE COD_FILIAL = R_FERIAS.FILIAL
         AND COD_EMPRESA = R_FERIAS.COD_EMPRESA;
      --
      IF VDIAS_ANTES_PAGTO_FERIAS IS NOT NULL THEN
        -- Se estiver nulo, não permite o cancelamento de uma requisição CONCLUÍDA
        -- e, com isso, não é permitindo então fazer a exclusão da programação
        --
        IF R_FERIAS.DT_SAIDA_PARC4 IS NOT NULL AND
          --         R_FERIAS.DT_SAIDA_PARC4                    = R_REQ_FERIAS.DT_SAIDA_PARC4   AND -- Só vai permitir exclusão se as datas que estiverem na ferias forem
          --         R_FERIAS.DT_RETORNO_PARC4                  = R_REQ_FERIAS.DT_RETORNO_PARC4 AND -- iguais às que estão na requisição
           (R_FERIAS.DT_SAIDA_PARC4 - TRUNC(SYSDATE)) + 1 >=
           VDIAS_ANTES_PAGTO_FERIAS AND
           NVL(R_FERIAS.IND_SITUACAO_PARC_4, 'X') <> 'C' THEN
          DBMS_OUTPUT.PUT_LINE('VALIDA_PARC3');
          VALIDA_PARC3;
          IF NVL(PFLG_RETORNO, 'S') <> 'S' THEN
            RAISE VSAIDA_ERRO;
          END IF;
        END IF;
        --
        IF R_FERIAS.DT_SAIDA_PARC2 IS NOT NULL AND
          --         R_FERIAS.DT_SAIDA_PARC2                    = R_REQ_FERIAS.DT_SAIDA_PARC2   AND -- Só vai permitir exclusão se as datas que estiverem na ferias forem
          --         R_FERIAS.DT_RETORNO_PARC2                  = R_REQ_FERIAS.DT_RETORNO_PARC2 AND -- iguais às que estão na requisição
           (R_FERIAS.DT_SAIDA_PARC2 - TRUNC(SYSDATE)) + 1 >=
           VDIAS_ANTES_PAGTO_FERIAS AND
           NVL(R_FERIAS.IND_SITUACAO_PARC_2, 'X') <> 'C' THEN
          DBMS_OUTPUT.PUT_LINE('VALIDA_PARC2');
          VALIDA_PARC2;
          IF NVL(PFLG_RETORNO, 'S') <> 'S' THEN
            RAISE VSAIDA_ERRO;
          END IF;
        END IF;
        --
        IF R_FERIAS.DT_SAIDA_PARC1 IS NOT NULL AND
          --         R_FERIAS.DT_SAIDA_PARC1                    = R_REQ_FERIAS.DT_SAIDA_PARC1   AND -- Só vai permitir exclusão se as datas que estiverem na ferias forem
          --         R_FERIAS.DT_RETORNO_PARC1                  = R_REQ_FERIAS.DT_RETORNO_PARC1 AND -- iguais às que estão na requisição
           (R_FERIAS.DT_SAIDA_PARC1 - TRUNC(SYSDATE)) + 1 >=
           VDIAS_ANTES_PAGTO_FERIAS AND
           NVL(R_FERIAS.IND_SITUACAO_PARC_1, 'X') <> 'C' THEN
          DBMS_OUTPUT.PUT_LINE('VALIDA_PARC1');
          VALIDA_PARC1;
          IF NVL(PFLG_RETORNO, 'S') <> 'S' THEN
            RAISE VSAIDA_ERRO;
          END IF;
        END IF;
        --
        IF NVL(VPARC_PERMITIDAS_CANCEL, 0) = 0 THEN
          PFLG_RETORNO := 'N';
          PMSG_RETORNO := 'Não há parcelas que possam ser excluídas. Cancelamento não permitido.';
          DBMS_OUTPUT.PUT_LINE('9');
          RAISE VSAIDA_ERRO;
        END IF;
        --
      END IF;
      --
    EXCEPTION
      WHEN VSAIDA_ERRO THEN
        DBMS_OUTPUT.PUT_LINE('10');
        IF NVL(PFLG_RETORNO, 'S') = 'N' AND PMSG_RETORNO IS NULL THEN
          DBMS_OUTPUT.PUT_LINE('11');
          PMSG_RETORNO := 'Não há parcelas que possam ser excluídas. Cancelamento não permitido.';
        END IF;
      WHEN OTHERS THEN
        PFLG_RETORNO := 'N';
        DBMS_OUTPUT.PUT_LINE('12');
        PMSG_RETORNO := SUBSTR('Erro Valida_Parcelas: ' || SQLERRM, 1, 4000);
    END VALIDA_PARCELAS;
    --
  BEGIN
    --
    pflg_retorno := 'S';
    Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(PSOLICITACAO,
                                                 'VALIDA_SIT_REQUISICAO',
                                                 'N',
                                                 'REQ_FERIAS');
    --
    IF pmatricula IS NULL AND psolicitacao IS NULL THEN
      --
      pflg_retorno := 'N';
      pmsg_retorno := 'Não é permitido alterar a situação.';
      RAISE vsaida_erro;
      --
    ELSE
      --
      BEGIN
        SELECT sit_requisicao
          INTO v_sit_req
          FROM REQUISICAO_FERIAS
         WHERE cod_solicitacao = psolicitacao
           AND cod_empresa = pcod_empresa;
        --
      EXCEPTION
        WHEN OTHERS THEN
          v_sit_req := NULL;
      END;
      --
      OPEN c_req_ferias;
      FETCH c_req_ferias
        INTO v_req_ferias;
      CLOSE c_req_ferias;
      --
      IF v_sit_req = 1 THEN
        IF psit_requisicao = 3 THEN
          --
          IF retorna_perfil IN ('MASTER', 'FOLHA', 'REMUNERACAO') OR
             (v_req_ferias.matricula_solicitante IS NOT NULL AND
             v_req_ferias.cod_emp_solicitante = pcod_empresa AND
             (v_req_ferias.matricula_solicitante = pmatricula OR
             v_req_ferias.matricula_solicitante = retorna_mat_solicitante)) THEN
            NULL;
          ELSE
            pflg_retorno := 'N';
            pmsg_retorno := 'Usuário sem permissão para cancelamento.';
            RAISE vsaida_erro;
          END IF;
          --
        ELSE
          pflg_retorno := 'N';
          pmsg_retorno := 'Alteração não permitida.';
          RAISE vsaida_erro;
        END IF;
      ELSIF V_SIT_REQ = 2 THEN
        IF psit_requisicao = 3 THEN
          PMSG_RETORNO := NULL;
          PMSG_RETORNO := PERMISSAO_CANC_REQ_CONCLUIDA(PSOLICITACAO,
                                                       PCOD_EMPRESA,
                                                       PMATRICULA,
                                                       PUSUARIO_LOGADO);
          IF PMSG_RETORNO IS NOT NULL THEN
            PFLG_RETORNO := 'N';
            RAISE VSAIDA_ERRO;
          ELSE
            VALIDA_PARCELAS;
          END IF;
        ELSE
          pflg_retorno := 'N';
          pmsg_retorno := 'Alteração não permitida.';
          RAISE vsaida_erro;
        END IF;
      ELSIF V_SIT_REQ = 3 AND psit_requisicao = 3 THEN
        PFLG_RETORNO := 'S';
        RAISE vsaida_erro;
      END IF;
      --
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'ERRO Valida_Sit_Requisicao: ' || SQLERRM;
  END Valida_Sit_Requisicao;
  --
  PROCEDURE Valida_Dt_Saida_Parc1(pcod_empresa          EMPRESAS.cod%TYPE,
                                  psolicitacao          REQUISICAO_FERIAS.cod_solicitacao%TYPE,
                                  pmatricula            INF_PESSOAIS.matricula%TYPE,
                                  pdt_inic_per_ferias   FERIAS.dt_inic_per_ferias%TYPE,
                                  pdt_fim_per_ferias    FERIAS.dt_fim_per_ferias%TYPE,
                                  pdt_saida_parc2       FERIAS.dt_saida_parc2%TYPE,
                                  psaldo_bruto          NUMBER,
                                  pfalta_hora           NUMBER,
                                  pdias_direito         IN OUT NUMBER,
                                  pdt_saida_parc1       IN OUT FERIAS.dt_saida_parc1%TYPE,
                                  psaldo                IN OUT NUMBER,
                                  pdias_abono_pec1      IN OUT FERIAS.dias_abono_pec1%TYPE,
                                  pnum_dias_parc1       IN OUT NUMBER,
                                  popcao_13sal1         IN OUT FERIAS.opcao_13sal1%TYPE,
                                  popcao_13sal2         IN OUT FERIAS.opcao_13sal2%TYPE,
                                  ptipo_ferias1         IN OUT FERIAS.tipo_ferias1%TYPE,
                                  pdt_retorno_parc1     IN OUT FERIAS.dt_retorno_parc1%TYPE,
                                  pdt_pagto_parc1       IN OUT FERIAS.dt_pagto_parc1%TYPE,
                                  pjornada_reduzida     IN OUT VARCHAR2,
                                  pind_situacao_periodo FERIAS.ind_situacao_periodo%TYPE,
                                  pdias_abono_pec1_dsp  OUT VARCHAR2,
                                  pnum_dias_parc1_dsp   OUT VARCHAR2,
                                  pflg_retorno          IN OUT VARCHAR2,
                                  pmsg_retorno          IN OUT VARCHAR2) IS
    /*
    Alt.1, trat. ref. valores das colunas da tab. FERIAS_PARAMETROS onde "seg', "ter"... sao preenchidos pela aplicacao
           como 'N' e nao como nulos, PSMarconato/Sidnei, 03/03/2022
    */
    --
    V_RADIO_ESTAT          VARCHAR2(1);
    V_VINCULO              VINCULO_EMPREG.NOME%TYPE;
    VDT_AGEND_LIMITE       DATE;
    vfilial                INF_PESSOAIS.filial%TYPE;
    v_flag                 VARCHAR2(1);
    v_existe               VARCHAR2(1) := 'N';
    vl_idade_minima        FERIAS_PARAMETROS.idade_minima%TYPE;
    vl_idade_maxima        FERIAS_PARAMETROS.idade_minima%TYPE;
    vl_dias_margem_ferias  FERIAS_PARAMETROS.dias_margem_ferias%TYPE;
    vl_data_limite         DATE;
    Vl_antecipa_parc_1     ferias_parametros.antecipa_parc_1%TYPE; -- Tratar antecipação de férias por conta do coronavírus Rodrigo 24/03/2020
    Vl_lim_antecipa_parc_1 DATE; -- Tratar antecipação de férias por conta do coronavírus Rodrigo 24/03/2020
    --Bruno Sousa 22/10/2024
    --Esse paramentro usado para cancelamento das férias tbm sera usado para criar as parcelas de férias
    V_QTD_MAX_DIAS_FERIAS PARAMETROS_RECURSOS_HUMANOS.QTD_MAX_DIAS_FERIAS%TYPE;
    --
    --vconsidera_ref_ferias parametros_recursos_humanos.considera_ref_ferias%TYPE;
    --vdt_ref_ferias        parametros_recursos_humanos.dt_ref_ferias%TYPE;
    --vdia_limite_ferias    parametros_recursos_humanos.dia_limite_ferias%TYPE;
    --
    --++30032020
    vAnos     NUMBER(4);
    vAdmissao DATE;
    --vAntecipaParc1 NUMBER(2);
    --++
    /*
    CURSOR c1 IS
      SELECT NVL(a.pagto_abono_ferias, 'N') abono_ferias,
             a.saldo_fer_min,
             c.dt_ref_folha,
             c.QTD_MAX_DIAS_FERIAS
        FROM filiais_cad                 a,
             informacoes_funcionais_cad  b,
             PARAMETROS_RECURSOS_HUMANOS c
       WHERE b.cod_empresa = a.cod_empresa
         AND b.filial = a.cod_filial
         AND b.cod_empresa = pcod_empresa
         AND b.matricula = pmatricula
         AND c.cod_empresa = b.cod_empresa;
    --
    v_c1 c1%ROWTYPE;
    */
    --
    CURSOR c2 IS
      SELECT COUNT(*) total
        FROM FERIAS a
       WHERE a.cod_empresa = pcod_empresa
         AND a.matricula = pmatricula
         AND a.dt_saida_parc1 = pdt_saida_parc1;
    --
    v_c2 c2%ROWTYPE;
  
    PROCEDURE Vld_Primeira_Parcela(pcod_empresa         EMPRESAS.cod%TYPE,
                                   psolicitacao         REQUISICAO_FERIAS.cod_solicitacao%TYPE,
                                   pmatricula           INF_PESSOAIS.matricula%TYPE,
                                   pdt_inic_per_ferias  FERIAS.dt_inic_per_ferias%TYPE,
                                   pdt_fim_per_ferias   FERIAS.dt_fim_per_ferias%TYPE,
                                   pdias_abono_pec1     FERIAS.dias_abono_pec1%TYPE,
                                   pdt_saida_parc2      FERIAS.dt_saida_parc2%TYPE,
                                   psaldo               NUMBER,
                                   pdt_saida_parc1      IN OUT FERIAS.dt_saida_parc1%TYPE,
                                   pnum_dias_parc1      IN OUT NUMBER,
                                   ptipo_ferias1        IN OUT FERIAS.tipo_ferias1%TYPE,
                                   popcao_13sal1        IN OUT FERIAS.opcao_13sal1%TYPE,
                                   pdt_retorno_parc1    IN OUT FERIAS.dt_retorno_parc1%TYPE,
                                   pdias_abono_pec1_dsp OUT VARCHAR2,
                                   pnum_dias_parc1_dsp  OUT VARCHAR2,
                                   pflg_retorno         IN OUT VARCHAR2,
                                   pmsg_retorno         IN OUT VARCHAR2) IS
      --
      qtde_dias_contr_fer_   EMPRESAS.qtde_dias_contr_fer%TYPE := 330;
      vl_cod                 INFORMACOES_FUNCIONAIS.situacao%TYPE;
      vl_dt_situacao         INFORMACOES_FUNCIONAIS.dt_situacao%TYPE;
      vl_dt_sit_outros_afast INFORMACOES_FUNCIONAIS.Dt_Retorno_Afast%TYPE;
      vl_idade_minima        FERIAS_PARAMETROS.idade_minima%TYPE;
      vl_idade_maxima        FERIAS_PARAMETROS.idade_minima%TYPE;
      vl_dt_nasc             INF_PESSOAIS.dt_nasc%TYPE;
      vl_dias_margem_ferias  FERIAS_PARAMETROS.dias_margem_ferias%TYPE;
      v_cat_13m              FERIAS_PARAMETROS.cat_13m%TYPE;
      v_cat_13h              FERIAS_PARAMETROS.cat_13h%TYPE;
      v_ferias_coletiva      FERIAS_PARAMETROS.ferias_coletiva%TYPE;
      v_antecipa             FERIAS_PARAMETROS.antecipa_parc_1%TYPE;
      v_seg                  FERIAS_PARAMETROS.seg%TYPE;
      v_ter                  FERIAS_PARAMETROS.ter%TYPE;
      v_qua                  FERIAS_PARAMETROS.qua%TYPE;
      v_qui                  FERIAS_PARAMETROS.qui%TYPE;
      v_sex                  FERIAS_PARAMETROS.sex%TYPE;
      v_sab                  FERIAS_PARAMETROS.sab%TYPE;
      v_todos                FERIAS_PARAMETROS.todos%TYPE;
      v_qtde_prog            PLS_INTEGER;
      v_proximo_dia          FERIAS_PARAMETROS.proximo_dia%type;
      v_dsr_jornada          FERIAS_PARAMETROS.DSR_JORNADA%type;
      --
      v_dia_ant_feriado BOOLEAN := DIA_ANTERIOR_EH_FERIADO(pcod_empresa,
                                                           pmatricula,
                                                           pdt_saida_parc1);
      --
      v_erro EXCEPTION;
      --
      vl_anos      NUMBER(5) := 0;
      vl_permissao DATE;
      wl_dt_ini    DATE;
      wl_dt_fim    DATE;
      vl_err       EXCEPTION;
      vl_err2      EXCEPTION;
      vl_retorno   DATE;
      --
      --ind_situacao_periodo_ VARCHAR2(1);
      --
    
      CURSOR c1 IS
        SELECT fer.perc_dobro
          FROM FERIAS_PARAMETROS fer, informacoes_funcionais_cad inf
         WHERE inf.cod_empresa = fer.cod_empresa
           AND inf.cod_empresa = pcod_empresa
           AND inf.matricula = pmatricula
           AND inf.filial = fer.cod_filial;
      v_c1 c1%ROWTYPE;
      --
      PROCEDURE Vld_Ferias(pcod_empresa        EMPRESAS.cod%TYPE,
                           pmatricula          INF_PESSOAIS.matricula%TYPE,
                           pdt_inic_per_ferias FERIAS.dt_inic_per_ferias%TYPE,
                           pdt_saida_parc1     FERIAS.dt_saida_parc1%TYPE,
                           pdt_saida_parc2     FERIAS.dt_saida_parc2%TYPE,
                           pdt_retorno_parc1   FERIAS.dt_retorno_parc1%TYPE,
                           pflg_retorno        IN OUT VARCHAR2,
                           pmsg_retorno        IN OUT VARCHAR2) IS
        --
        v_existe VARCHAR2(1);
        --
      BEGIN
        --
        dbms_output.put_line('Vld_Ferias #01');
      
        FOR linha1 IN (SELECT dt_saida_parc1,
                              dt_inic_per_ferias,
                              dt_fim_per_ferias,
                              dt_retorno_parc1
                         FROM FERIAS
                        WHERE cod_empresa = pcod_empresa
                          AND matricula = pmatricula
                          AND dt_inic_per_ferias < pdt_inic_per_ferias
                          AND ind_situacao_periodo IN ('P', 'R')) LOOP
        
          dbms_output.put_line('Vld_Ferias #02 ' || linha1.dt_saida_parc1 || ' ' ||
                               linha1.dt_inic_per_ferias);
          BEGIN
            SELECT DISTINCT 'S'
              INTO v_existe
              FROM FERIAS
             WHERE cod_empresa = pcod_empresa
               AND matricula = pmatricula
               AND ind_situacao_periodo IN ('P', 'R')
               AND pdt_saida_parc1 BETWEEN linha1.dt_saida_parc1 AND
                   (linha1.dt_retorno_parc1 - 1);
            pflg_retorno := 'N';
            pmsg_retorno := 'A data de saída de férias é inferior a data de retorno da parcela anterior!';
            RAISE vsaida_erro;
          EXCEPTION
            WHEN OTHERS THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'Pkg_Ferias.Vld_Ferias - Erro: ' || SQLERRM;
              RAISE vsaida_erro;
          END;
        END LOOP;
        --
        dbms_output.put_line('Vld_Ferias #03');
        FOR linha2 IN (SELECT dt_saida_parc2,
                              dt_inic_per_ferias,
                              dt_fim_per_ferias,
                              dt_retorno_parc2
                         FROM FERIAS
                        WHERE cod_empresa = pcod_empresa
                          AND matricula = pmatricula
                          AND dt_inic_per_ferias < pdt_inic_per_ferias
                          AND ind_situacao_periodo IN ('P', 'R')) LOOP
          BEGIN
            SELECT DISTINCT 'S'
              INTO v_existe
              FROM FERIAS
             WHERE cod_empresa = pcod_empresa
               AND matricula = pmatricula
               AND ind_situacao_periodo IN ('P', 'R')
               AND pdt_saida_parc2 BETWEEN linha2.dt_saida_parc2 AND
                   (linha2.dt_retorno_parc2 - 1);
            --
            pflg_retorno := 'N';
            pmsg_retorno := 'A data de saída de férias é inferior a data de retorno da parcela anterior!';
            RAISE vsaida_erro;
            --
          EXCEPTION
            WHEN OTHERS THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'Pkg_Ferias.Vld_Ferias - Erro: ' || SQLERRM;
              RAISE vsaida_erro;
          END;
        END LOOP;
        --
        dbms_output.put_line('Vld_Ferias #04');
        FOR linha3 IN (SELECT dt_saida_parc1,
                              dt_inic_per_ferias,
                              dt_fim_per_ferias,
                              dt_retorno_parc1
                         FROM FERIAS
                        WHERE cod_empresa = pcod_empresa
                          AND matricula = pmatricula
                          AND dt_inic_per_ferias < pdt_inic_per_ferias
                          AND ind_situacao_periodo IN ('P', 'R')) LOOP
          BEGIN
            SELECT DISTINCT 'S'
              INTO v_existe
              FROM FERIAS
             WHERE cod_empresa = pcod_empresa
               AND matricula = pmatricula
               AND ind_situacao_periodo IN ('P', 'R')
               AND pdt_retorno_parc1 BETWEEN linha3.dt_saida_parc1 AND
                   (linha3.dt_retorno_parc1 - 1);
            --
            pflg_retorno := 'N';
            pmsg_retorno := 'A data de saída de férias é inferior a data de retorno da parcela anterior!';
            RAISE vsaida_erro;
            --
          EXCEPTION
            WHEN OTHERS THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'Pkg_Ferias.Vld_Ferias - Erro: ' || SQLERRM;
              RAISE vsaida_erro;
          END;
        END LOOP;
        --
        dbms_output.put_line('Vld_Ferias #05');
        FOR linha4 IN (SELECT dt_saida_parc2,
                              dt_inic_per_ferias,
                              dt_fim_per_ferias,
                              dt_retorno_parc2
                         FROM FERIAS
                        WHERE cod_empresa = pcod_empresa
                          AND matricula = pmatricula
                          AND dt_inic_per_ferias < pdt_inic_per_ferias
                          AND ind_situacao_periodo IN ('P', 'R')) LOOP
          --
          BEGIN
            --
            SELECT DISTINCT 'S'
              INTO v_existe
              FROM FERIAS
             WHERE cod_empresa = pcod_empresa
               AND matricula = pmatricula
               AND ind_situacao_periodo IN ('P', 'R')
               AND pdt_saida_parc2 BETWEEN linha4.dt_saida_parc2 AND
                   (linha4.dt_retorno_parc2 - 1);
            --
            pflg_retorno := 'N';
            pmsg_retorno := 'A data de saída de férias é inferior a data de retorno da parcela anterior!';
            RAISE vsaida_erro;
            --
          EXCEPTION
            WHEN OTHERS THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'Pkg_Ferias.Vld_Ferias - Erro: ' || SQLERRM;
              RAISE vsaida_erro;
          END;
        END LOOP;
        --
        dbms_output.put_line('Vld_Ferias #06');
      EXCEPTION
        WHEN vsaida_erro THEN
          NULL;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Pkg_Ferias.Vld_Ferias - Erro: ' || SQLERRM;
      END Vld_Ferias;
      --
      PROCEDURE Vld_Dt_Saida_Parc1(pcod_empresa         EMPRESAS.cod%TYPE,
                                   psolicitacao         REQUISICAO_FERIAS.cod_solicitacao%TYPE,
                                   pmatricula           INF_PESSOAIS.matricula%TYPE,
                                   pdt_saida_parc1      FERIAS.dt_saida_parc1%TYPE,
                                   pnum_dias_parc1      NUMBER,
                                   pdias_abono_pec1     FERIAS.dias_abono_pec1%TYPE,
                                   psaldo               NUMBER,
                                   pdias_direito        NUMBER, -- Humberto/Izidoro 03/03/2016
                                   pdias_abono_pec1_dsp OUT VARCHAR2,
                                   pnum_dias_parc1_dsp  OUT VARCHAR2,
                                   pflg_retorno         IN OUT VARCHAR2,
                                   pmsg_retorno         IN OUT VARCHAR2) IS
        --
        CURSOR c1 IS
          SELECT fer.meses_prog_ini, fer.qtd_parcelas
            FROM FERIAS_PARAMETROS fer, informacoes_funcionais_cad inf
           WHERE inf.cod_empresa = fer.cod_empresa
             AND inf.cod_empresa = pcod_empresa
             AND inf.matricula = pmatricula
             AND inf.filial = fer.cod_filial;
        v_c1 c1%ROWTYPE;
      
        CURSOR c2(p_dt_inic DATE) IS
          SELECT COUNT(*) total
            FROM FERIAS
           WHERE cod_empresa = pcod_empresa
             AND matricula = pmatricula
             AND dt_saida_parc1 = p_dt_inic;
        --
        v_c2 c2%ROWTYPE;
        --
        v_dt_ref_folha DATE;
        --v_dt_limite    DATE;
        --
        v_dia_limite NUMBER(2);
        --
      BEGIN
        dbms_output.put_line('Vld_Dt_Saida_Parc1 #01');
        IF psolicitacao IS NULL THEN
          OPEN c1;
          FETCH c1
            INTO v_c1;
          CLOSE c1;
        
          BEGIN
            dbms_output.put_line('Vld_Dt_Saida_Parc1 #02');
            -- carrega limite para data de req. pessoal
            IF pcod_empresa IS NOT NULL THEN
              BEGIN
                SELECT p.dt_ref_folha,
                       NVL(LPAD(dia_limite_ferias, 2, 0),
                           TO_CHAR(LAST_DAY(p.dt_ref_folha), 'DD')) dia_limite
                  INTO v_dt_ref_folha, v_dia_limite
                  FROM PARAMETROS_RECURSOS_HUMANOS p
                 WHERE p.cod_empresa = pcod_empresa;
              
                /*
                IF v_dia_limite >
                   TO_NUMBER(TO_CHAR(LAST_DAY(v_dt_ref_folha), 'DD')) THEN
                  v_dia_limite := TO_NUMBER(TO_CHAR(LAST_DAY(v_dt_ref_folha),
                                                    'DD'));
                END IF;
                v_dt_limite := TO_DATE(v_dia_limite || '/' ||
                                       TO_CHAR(v_dt_ref_folha, 'mmrrrr'),
                                       'dd/mm/rrrr');
                */
              EXCEPTION
                WHEN OTHERS THEN
                  pflg_retorno := 'N';
                  pmsg_retorno := 'Não foi possível buscar a data limite: ' ||
                                  SQLERRM;
                  RAISE vsaida_erro;
              END;
              dbms_output.put_line('Vld_Dt_Saida_Parc1 #03');
              --
              OPEN c2(pdt_saida_parc1);
              FETCH c2
                INTO v_c2;
              CLOSE c2;
            
              IF pdt_saida_parc1 < v_dt_ref_folha AND v_c2.total = 0 THEN
                pflg_retorno := 'N';
                pmsg_retorno := 'A data de saída não pode ser menor que a data de referência da folha ' ||
                                TO_CHAR(v_dt_ref_folha, 'dd/mm/rrrr') || '!';
                RAISE vsaida_erro;
              END IF;
            
              IF NOT VALIDA_PRAZO_PROGRAMACAO(pcod_empresa,
                                              pdt_saida_parc1,
                                              pmsg_retorno) THEN
                pflg_retorno := 'N';
                RAISE vsaida_erro;
              END IF;
            
              /*               dbms_output.put_line('Vld_Dt_Saida_Parc1 #04');
              
              IF TRUNC(SYSDATE) > v_dt_limite AND NOT (pdt_saida_parc1 > LAST_DAY(v_dt_ref_folha)) THEN
                pflg_retorno := 'N';
                pmsg_retorno := 'O prazo para o cadastro de requisições expirou em ' || ' ' ||
                                TO_CHAR(v_dt_limite, 'dd/mm/yyyy') ||
                                '! Somente é permitido cadastro com data do mês seguinte.';
                RAISE vsaida_erro;
              END IF;*/
            
              dbms_output.put_line('Vld_Dt_Saida_Parc1 #05');
            
              IF TRUNC(SYSDATE) > pdt_saida_parc1 AND v_c2.total = 0 THEN
                pflg_retorno := 'N';
                pmsg_retorno := 'A data informada é menor do que a data atual do sistema!';
                RAISE vsaida_erro;
              END IF;
            END IF;
          END;
        
          /*         dbms_output.put_line('Vld_Dt_Saida_Parc1 #06');
          
          IF v_c1.qtd_parcelas = 1 AND v_c1.meses_prog_ini >= 12 AND
             pnum_dias_parc1 + NVL(pdias_abono_pec1, 0) <> NVL(psaldo, 0) THEN
            pflg_retorno := 'N';
            pmsg_retorno := 'A somatória dos campos Número De Dias e Dias De Abono não pode ser diferente do campo Saldo Final!';
            RAISE vsaida_erro;
          END IF;*/
          dbms_output.put_line('Vld_Dt_Saida_Parc1 #07');
        
        END IF;
      EXCEPTION
        WHEN vsaida_erro THEN
          NULL;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Pkg_Ferias.Vld_Dt_Saida_Parc1 - Erro: ' ||
                          SQLERRM;
      END Vld_Dt_Saida_Parc1;
      --
    
    BEGIN
      --
      dbms_output.put_line('Vld_Primeira_Parcela #01');
      PFLG_RETORNO := 'S';
      -- Valida saída pela tabela LIMITE_AGEND_FERIAS (Rodrigo 08/07/2022)
      IF psolicitacao IS NULL THEN
        VDT_AGEND_LIMITE := VERIF_LIMITE_AGEND_FERIAS(PCOD_EMPRESA,
                                                      SYSDATE,
                                                      pdt_saida_parc1);
      END IF;
    
      IF VDT_AGEND_LIMITE IS NOT NULL THEN
        PFLG_RETORNO := 'N';
        --PMSG_RETORNO := 'Data Limite de Programação de férias deverá ser até '||TO_CHAR(VDT_AGEND_LIMITE,'DD/MM/RRRR')||'.';
        PMSG_RETORNO := 'Data de Programação de férias deverá ser após ' ||
                        TO_CHAR(VDT_AGEND_LIMITE, 'DD/MM/RRRR') || '.';
        RAISE VSAIDA_ERRO;
      END IF;
    
      BEGIN
        --
        SELECT fer.cat_13m,
               fer.cat_13h,
               fer.ferias_coletiva,
               nvl(fer.antecipa_parc_1, 0),
               fer.seg,
               fer.ter,
               fer.qua,
               fer.qui,
               fer.sex,
               fer.sab,
               fer.todos,
               NVL(fer.qtde_prog_ferias, 0) AS prog_ferias,
               NVL(fer.proximo_dia, 'N'),
               NVL(fer.dsr_jornada, 'N')
          INTO v_cat_13m,
               v_cat_13h,
               v_ferias_coletiva,
               v_antecipa,
               v_seg,
               v_ter,
               v_qua,
               v_qui,
               v_sex,
               v_sab,
               v_todos,
               v_qtde_prog,
               v_proximo_dia,
               v_dsr_jornada
          FROM FERIAS_PARAMETROS fer, informacoes_funcionais_cad inf
         WHERE inf.cod_empresa = fer.cod_empresa
           AND inf.filial = fer.cod_filial
           AND inf.cod_empresa = pcod_empresa
           AND inf.matricula = pmatricula;
      
        dbms_output.put_line('Vld_Primeira_Parcela #02');
        --
        IF NVL(v_seg, 'N') = 'N' AND NVL(v_ter, 'N') = 'N' AND
           NVL(v_qua, 'N') = 'N' AND NVL(v_qui, 'N') = 'N' AND
           NVL(v_sex, 'N') = 'N' AND NVL(v_sab, 'N') = 'N' AND
           NVL(v_todos, 'N') = 'N' /*Alt.1*/
           AND NVL(v_dsr_jornada, 'N') = 'N' THEN
          v_todos := 'S';
        END IF;
        --
        dbms_output.put_line('Vld_Primeira_Parcela #03 pnum_dias_parc1: ' ||
                             pnum_dias_parc1);
        IF (pdt_saida_parc1 IS NOT NULL) THEN
          --
          Vld_Dt_Saida_Parc1(pcod_empresa,
                             psolicitacao,
                             pmatricula,
                             pdt_saida_parc1,
                             pnum_dias_parc1,
                             pdias_abono_pec1,
                             psaldo,
                             pdias_direito, -- Humberto/Izidoro 03/03/2016
                             pdias_abono_pec1_dsp,
                             pnum_dias_parc1_dsp,
                             pflg_retorno,
                             pmsg_retorno);
          --
          dbms_output.put_line('Vld_Primeira_Parcela #04 pnum_dias_parc1: ' ||
                               pnum_dias_parc1);
          IF NVL(pflg_retorno, 'S') <> 'S' THEN
            RAISE vsaida_erro;
          END IF;
          --
          dbms_output.put_line('Vld_Primeira_Parcela #05');
          IF VALIDA_DSR_JORNADA(PCOD_EMPRESA,
                                PMATRICULA,
                                PDT_SAIDA_PARC1,
                                v_dsr_jornada,
                                PMSG_RETORNO) THEN
            NULL;
          ELSIF v_dsr_jornada = 'N' AND v_todos = 'S' THEN
            NULL;
          ELSIF v_dsr_jornada = 'N' AND
                ((TO_CHAR(pdt_saida_parc1, 'D') = 2 AND v_seg = 'S') OR
                (TO_CHAR(pdt_saida_parc1, 'D') = 3 AND v_seg = 'S' AND
                v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
            NULL;
          ELSIF v_dsr_jornada = 'N' AND
                ((TO_CHAR(pdt_saida_parc1, 'D') = 3 AND v_ter = 'S') OR
                (TO_CHAR(pdt_saida_parc1, 'D') = 4 AND v_ter = 'S' AND
                v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
            NULL;
          ELSIF v_dsr_jornada = 'N' AND
                ((TO_CHAR(pdt_saida_parc1, 'D') = 4 AND v_qua = 'S') OR
                (TO_CHAR(pdt_saida_parc1, 'D') = 5 AND v_qua = 'S' AND
                v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
            NULL;
          ELSIF v_dsr_jornada = 'N' AND
                ((TO_CHAR(pdt_saida_parc1, 'D') = 5 AND v_qui = 'S') OR
                (TO_CHAR(pdt_saida_parc1, 'D') = 6 AND v_qui = 'S' AND
                v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
            NULL;
          ELSIF v_dsr_jornada = 'N' AND
                ((TO_CHAR(pdt_saida_parc1, 'D') = 6 AND v_sex = 'S') OR
                (TO_CHAR(pdt_saida_parc1, 'D') = 7 AND v_sex = 'S' AND
                v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
            NULL;
          ELSIF v_dsr_jornada = 'N' AND
                ((TO_CHAR(pdt_saida_parc1, 'D') = 7 AND v_sab = 'S') OR
                (TO_CHAR(pdt_saida_parc1, 'D') = 1 AND v_sab = 'S' AND
                v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
            NULL;
          ELSE
            IF v_dsr_jornada = 'S' THEN
              pflg_retorno := 'N';
              PMSG_RETORNO := 'Por regra de jornada o dia escolhido não é valido para saída de férias conforme DSR. ' ||
                              nvl(PMSG_RETORNO, ' ');
              RAISE vsaida_erro;
            END IF;
            pflg_retorno := 'N';
            pmsg_retorno := NULL;
            --            pmsg_retorno := 'Este dia não é permitido para data de saída de férias. Verifique os parâmetros da filial!';
            IF v_seg = 'S' THEN
              pmsg_retorno := 'Por determinação da empresa, somente segunda-feira';
            END IF;
            IF v_ter = 'S' THEN
              IF pmsg_retorno IS NULL THEN
                pmsg_retorno := 'Por determinação da empresa, somente terça-feira';
              ELSIF v_qua <> 'S' AND v_qui <> 'S' AND v_sex <> 'S' AND
                    v_sab <> 'S' THEN
                pmsg_retorno := pmsg_retorno || ' e terça-feira';
              ELSE
                pmsg_retorno := pmsg_retorno || ', terça-feira';
              END IF;
            END IF;
            IF v_qua = 'S' THEN
              IF pmsg_retorno IS NULL THEN
                pmsg_retorno := 'Por determinação da empresa, somente quarta-feira';
              ELSIF v_qui <> 'S' AND v_sex <> 'S' AND v_sab <> 'S' THEN
                pmsg_retorno := pmsg_retorno || ' e quarta-feira';
              ELSE
                pmsg_retorno := pmsg_retorno || ', quarta-feira';
              END IF;
            END IF;
            IF v_qui = 'S' THEN
              IF pmsg_retorno IS NULL THEN
                pmsg_retorno := 'Por determinação da empresa, somente quinta-feira';
              ELSIF v_sex <> 'S' AND v_sab <> 'S' THEN
                pmsg_retorno := pmsg_retorno || ' e quinta-feira';
              ELSE
                pmsg_retorno := pmsg_retorno || ', quinta-feira';
              END IF;
            END IF;
            IF v_sex = 'S' THEN
              IF pmsg_retorno IS NULL THEN
                pmsg_retorno := 'Por determinação da empresa, somente sexta-feira';
              ELSIF v_sab <> 'S' THEN
                pmsg_retorno := pmsg_retorno || ' e sexta-feira';
              ELSE
                pmsg_retorno := pmsg_retorno || ', sexta-feira';
              END IF;
            END IF;
            IF v_sab = 'S' THEN
              IF pmsg_retorno IS NULL THEN
                pmsg_retorno := 'Por determinação da empresa, somente sábado';
              ELSE
                pmsg_retorno := pmsg_retorno || ' e sábado';
              END IF;
            END IF;
            IF pmsg_retorno IS NOT NULL THEN
              IF INSTR(pmsg_retorno, ' e ') <> 0 THEN
                pmsg_retorno := pmsg_retorno ||
                                ' são dias válidos para saída de férias.';
              ELSE
                pmsg_retorno := pmsg_retorno ||
                                ' é dia válido para saída de férias.';
              END IF;
            END IF;
            RAISE vsaida_erro;
          END IF;
        END IF;
        --
        dbms_output.put_line('Vld_Primeira_Parcela #06');
        --Bruno Sousa 25/01/2024
        --if FNC_VINCULO_CLF(pcod_empresa, pmatricula) = '5' then
        IF fnc_VerifEstatutario(pcod_empresa, pmatricula) = 'S' then
        
          if pdt_saida_parc1 < pdt_inic_per_ferias or
             pdt_saida_parc1 > pdt_fim_per_ferias then
            pflg_retorno := 'N';
            pmsg_retorno := 'A data de saída deve ser entre as datas ' ||
                            TO_CHAR(pdt_inic_per_ferias, 'dd/mm/rrrr') ||
                            ' e ' ||
                            TO_CHAR(pdt_fim_per_ferias, 'dd/mm/rrrr') || ' !';
            RAISE vsaida_erro;
          end if;
        else
          --Bruno Sousa 15/03/2024 Alterado condição abaixo
          --IF pdt_saida_parc1 < ADD_MONTHS(pdt_fim_per_ferias, v_antecipa * -1) THEN
          IF pdt_saida_parc1 < ADD_MONTHS(pdt_inic_per_ferias, v_antecipa) THEN
            pflg_retorno := 'N';
            --pmsg_retorno := 'A data de saída deve ser maior que ' ||
            --                TO_CHAR(ADD_MONTHS(pdt_fim_per_ferias,
            --                                   v_antecipa * -1),
            --                        'dd/mm/rrrr') || ' !';
            pmsg_retorno := 'A data de saída deve ser maior que ' ||
                            TO_CHAR(ADD_MONTHS(pdt_inic_per_ferias,
                                               v_antecipa),
                                    'dd/mm/rrrr') || ' !';
            RAISE vsaida_erro;
          END IF;
          --
          IF v_antecipa = 0 and pdt_saida_parc1 < pdt_fim_per_ferias THEN
            pflg_retorno := 'N';
            pmsg_retorno := 'A data de saída deve ser maior que ' ||
                            TO_CHAR(pdt_fim_per_ferias, 'dd/mm/rrrr') || ' !';
            RAISE vsaida_erro;
          END IF;
          --
          IF pdt_saida_parc1 > ADD_MONTHS(pdt_fim_per_ferias, 12) THEN
            -- Adicionado por Igor Cardoso 12/07/2019 - Chamado 17969
            pflg_retorno := 'N';
            pmsg_retorno := 'Data de saída maior que o permitido na vigência de férias!';
            RAISE vsaida_erro;
          END IF;
          --
          dbms_output.put_line('Vld_Primeira_Parcela #07');
          IF (pdt_saida_parc1 < TRUNC(SYSDATE + v_qtde_prog)) AND
             v_antecipa = 0 THEN
            pflg_retorno := 'N';
            pmsg_retorno := 'A data de saída deve ser maior ou igual a ' ||
                            TO_CHAR(TRUNC(SYSDATE + v_qtde_prog),
                                    'dd/mm/rrrr') || '!';
            RAISE vsaida_erro;
          END IF;
          --
        end if;
      
        dbms_output.put_line('Vld_Primeira_Parcela #08');
        ptipo_ferias1 := 'N';
        --
        IF v_cat_13m = 'N' THEN
          popcao_13sal1 := 'N';
        END IF;
        --
        dbms_output.put_line('Vld_Primeira_Parcela #09');
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foi possível verificar categoria de 13º salário e férias coletiva no parametro de férias!';
          RAISE vsaida_erro;
      END;
      --
      dbms_output.put_line('Vld_Primeira_Parcela #10');
      BEGIN
        --
        --SERENA
        /*        pflg_retorno := 'N';
        pmsg_retorno := 'TESTE';
        raise vsaida_erro;    */
      
        SELECT i.situacao,
               (i.dt_situacao + s.qtd_max_dias) - 1,
               (NVL(i.dt_retorno_afast, (i.dt_situacao + s.qtd_max_dias)) - 1),
               dt_admissao
          INTO vl_cod, vl_dt_situacao, vl_dt_sit_outros_afast, vAdmissao --++30032020
          FROM informacoes_funcionais_cad i, SIT_FUNC s
         WHERE i.cod_empresa = pcod_empresa
           AND i.matricula = pmatricula
           AND i.situacao > '01' -- (i.situacao = '02' OR i.situacao >= '90')
           AND s.cod = i.situacao;
        --
        dbms_output.put_line('Vld_Primeira_Parcela #11');
      
        /*        pflg_retorno := 'N';
        pmsg_retorno := vl_cod||', '||to_char(pdt_saida_parc1,'dd/mm/rrrr')||', '||to_char(vl_dt_situacao,'dd/mm/rrrr')||', '||to_char(vl_dt_sit_outros_afast,'dd/mm/rrrr');
        raise vsaida_erro;*/
      
        IF vl_cod = '02' AND pdt_saida_parc1 <= vl_dt_situacao THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Colaboradora em liçenca maternidade. Data de saída deve ser maior que ' ||
                          TO_CHAR(vl_dt_situacao, 'dd/mm/rrrr') || '.';
          RAISE vsaida_erro;
        ELSIF vl_cod > '02' AND vl_cod < '90' AND
              pdt_saida_parc1 <= vl_dt_sit_outros_afast THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Colaborador(a) em afastamento. Data de saída deve ser maior que ' ||
                          TO_CHAR(vl_dt_sit_outros_afast, 'dd/mm/rrrr') || '.';
          RAISE vsaida_erro;
        ELSIF vl_cod >= '90' THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Colaborador demitido !!!';
          RAISE vsaida_erro;
        END IF;
        --
        dbms_output.put_line('Vld_Primeira_Parcela #12');
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          NULL;
      END;
      --
      dbms_output.put_line('Vld_Primeira_Parcela #13');
      SELECT qtde_dias_contr_fer
        INTO qtde_dias_contr_fer_
        FROM empresas_cad
       WHERE cod = pcod_empresa;
      --
      dbms_output.put_line('Vld_Primeira_Parcela #14');
      pdt_retorno_parc1 := (pdt_saida_parc1 + pnum_dias_parc1);
      dbms_output.put_line('Vld_Primeira_Parcela #15');
      --------------------------------------------------------
      -- verifica se ha ferias cadastradas para o mesmo mes --
      --------------------------------------------------------
      IF pdt_saida_parc1 = pdt_saida_parc2 THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Data de saida da 1o parcela = 2o parcela';
        RAISE vsaida_erro;
      END IF;
      --
      dbms_output.put_line('Vld_Primeira_Parcela #16');
      BEGIN
        --
        SELECT MAX(f.dt_retorno_parc1)
          INTO vl_retorno
          FROM FERIAS f
         WHERE f.cod_empresa = pcod_empresa
           AND f.matricula = pmatricula
           AND f.dt_retorno_parc1 < pdt_saida_parc1;
        --
        IF pdt_saida_parc1 <= vl_retorno THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'A data de saída deve ser maior que a data de retorno da último período gozado.';
          RAISE vsaida_erro;
        END IF;
        --
      END;
      --
      dbms_output.put_line('Vld_Primeira_Parcela #17');
      BEGIN
        SELECT dt_vigencia, dt_vigencia_fim
          INTO wl_dt_ini, wl_dt_fim
          FROM HISTORICO_CADASTRAL
         WHERE cod_empresa = pcod_empresa
           AND matricula = pmatricula
           AND cod_fato = 1
           AND cod_valor_fato = '02';
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
      --
      dbms_output.put_line('Vld_Primeira_Parcela #18');
      IF (pdt_saida_parc1 >= wl_dt_ini AND pdt_saida_parc1 <= wl_dt_fim) THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A data de saida tem que ser superior ao final da data de gestação';
        RAISE vsaida_erro;
      END IF;
      --
      dbms_output.put_line('Vld_Primeira_Parcela #19');
      BEGIN
        --
        SELECT idade_minima, idade_maxima, dias_margem_ferias
          INTO vl_idade_minima, vl_idade_maxima, vl_dias_margem_ferias
          FROM FERIAS_PARAMETROS
         WHERE cod_empresa = 0
           AND cod_filial = 0;
        --
        dbms_output.put_line('Vld_Primeira_Parcela #20');
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          BEGIN
            SELECT fer.idade_minima, fer.idade_maxima, dias_margem_ferias
              INTO vl_idade_minima, vl_idade_maxima, vl_dias_margem_ferias
              FROM FERIAS_PARAMETROS fer, inf_pessoais_cad pes
             WHERE fer.cod_empresa = pcod_empresa
               AND fer.cod_empresa = pes.cod_empresa
               AND fer.cod_filial = pes.filial
               AND pes.matricula = pmatricula;
          EXCEPTION
            WHEN NO_DATA_FOUND THEN
              vl_idade_minima       := 0;
              vl_idade_maxima       := 0;
              vl_dias_margem_ferias := 0;
          END;
      END;
      dbms_output.put_line('Vld_Primeira_Parcela #21');
      --
      BEGIN
        SELECT dt_nasc
          INTO vl_dt_nasc
          FROM inf_pessoais_cad
         WHERE cod_empresa = pcod_empresa
           AND matricula = pmatricula;
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          vl_dt_nasc   := NULL;
          pflg_retorno := 'N';
          pmsg_retorno := 'A data de nascimento do funcionário não cadastrada !!!';
          RAISE vsaida_erro;
      END;
      --
      dbms_output.put_line('Vld_Primeira_Parcela #22');
      IF vl_dias_margem_ferias > 0 THEN
        vl_permissao := TRUNC(pdt_saida_parc1) - vl_dias_margem_ferias;
      END IF;
      --
      dbms_output.put_line('Vld_Primeira_Parcela #23');
      vl_anos := TO_NUMBER(TO_CHAR(TRUNC((pdt_saida_parc1 - vl_dt_nasc) / 365)));
      --
      dbms_output.put_line('Vld_Primeira_Parcela #24 pnum_dias_parc1: ' ||
                           pnum_dias_parc1);
      IF vl_permissao IS NOT NULL AND vl_permissao <= TRUNC(SYSDATE) THEN
        NULL;
      ELSE
        IF (vl_anos > 0 AND vl_anos < vl_idade_minima) OR
           (vl_anos > 0 AND vl_anos > vl_idade_maxima AND
           vl_idade_maxima > 0) THEN
          pnum_dias_parc1 := 30;
        
          PNUM_DIAS_PARC1_DSP := 'N';
        
          /*
               SET_ITEM_PROPERTY('ferias.num_dias_parc1', ENABLED, PROPERTY_FALSE);
               SET_ITEM_PROPERTY('ferias.num_dias_parc1', NAVIGABLE, PROPERTY_FALSE);
               SET_ITEM_PROPERTY('ferias.num_dias_parc1', DELETE_ALLOWED, PROPERTY_FALSE);
               SET_ITEM_PROPERTY('ferias.num_dias_parc1', UPDATE_ALLOWED, PROPERTY_FALSE);
          */
          /*ELSE Comentada por Robson / Sidnei
          --      valida_ferias; -- ==========================cibele
          BEGIN
            SELECT ind_situacao_periodo
              INTO ind_situacao_periodo_
              FROM FERIAS
             WHERE cod_empresa = pcod_empresa
               AND matricula = pmatricula
               AND (ind_situacao_periodo = 'P' OR
                   ind_situacao_periodo = 'R')
               AND dt_inic_per_ferias < pdt_inic_per_ferias;
            --
            IF (ind_situacao_periodo_ = 'P' OR ind_situacao_periodo_ = 'R') THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'Existem férias pendentes com período anterior ao atual.';
              RAISE vsaida_erro;
            END IF;
            --
          EXCEPTION
            WHEN OTHERS THEN
              NULL;
          END;*/
        END IF;
      END IF;
      --
      dbms_output.put_line('Vld_Primeira_Parcela #25 pnum_dias_parc1: ' ||
                           pnum_dias_parc1);
      --
      --
      /*
      OPEN c1;
      FETCH c1
        INTO v_c1;
      CLOSE c1;*/
      --
      SELECT qtde_dias_contr_fer
        INTO qtde_dias_contr_fer_
        FROM EMPRESAS
       WHERE cod = pcod_empresa;
      --
      dbms_output.put_line('Vld_Primeira_Parcela #26');
      --
      IF Pdt_saida_parc1 > (Pdt_fim_per_ferias + qtde_dias_contr_fer_) AND
         v_c1.perc_dobro > 0 THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A data é maior que ' ||
                        TO_CHAR((pdt_fim_per_ferias + qtde_dias_contr_fer_),
                                'dd/mm/yyyy') ||
                        ', a mesma deverá ser paga em dobro.';
        RAISE vsaida_erro;
      END IF;
      --
      dbms_output.put_line('Vld_Primeira_Parcela #27');
      --
      BEGIN
        --
        SELECT DISTINCT '1'
          INTO vexiste
          FROM FERIAS
         WHERE cod_empresa = pcod_empresa
           AND matricula = pmatricula
           AND dt_inic_per_ferias < pdt_inic_per_ferias
           AND TRUNC(pdt_saida_parc1) <
               TRUNC(NVL(dt_retorno_parc4,
                         NVL(dt_retorno_parc2, dt_retorno_parc1)));
        --
        IF vexiste IS NOT NULL THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Colaborador em gozo de férias nesta data!!!';
          RAISE vsaida_erro;
        END IF;
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          NULL;
        WHEN OTHERS THEN
          NULL;
          /*
          pflg_retorno := 'N';
          pmsg_retorno := '1 Pkg_Ferias.Vld_Primeira_Parcela - Erro: ' ||
                          SQLERRM;
                          */
          RAISE vsaida_erro;
      END;
      --
      dbms_output.put_line('Vld_Primeira_Parcela #28');
      --
    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := '2 Pkg_Ferias.Vld_Primeira_Parcela - Erro: ' ||
                        SQLERRM;
    END Vld_Primeira_Parcela;
    --
  
  BEGIN
    --
    pflg_retorno := 'S';
    --
    /*DEBUG('pcod_empresa='||pcod_empresa||
          ' psolicitacao='||psolicitacao||
          ' pmatricula='||pmatricula||
          ' pdt_inic_per_ferias='||pdt_inic_per_ferias||
          ' pdt_fim_per_ferias='||pdt_fim_per_ferias||
          ' pdt_saida_parc2='||pdt_saida_parc2||
          ' psaldo_bruto='||psaldo_bruto||
          ' pfalta_hora='||pfalta_hora);
    */
    Vld_Ferias_Dobro(pCod_Empresa,
                     pMatricula,
                     pdt_saida_parc1,
                     pflg_retorno,
                     pmsg_retorno,
                     pdt_inic_per_ferias);
    IF NVL(pflg_retorno, 'S') <> 'S' THEN
      RAISE vsaida_erro;
    END IF;
    --
    IF NVL(pind_situacao_periodo, 'P') = 'P' THEN
      NULL;
    ELSE
      pdias_direito     := pdias_direito;
      pdt_saida_parc1   := pdt_saida_parc1;
      psaldo            := psaldo;
      pdias_abono_pec1  := pdias_abono_pec1;
      pnum_dias_parc1   := pnum_dias_parc1;
      popcao_13sal1     := popcao_13sal1;
      popcao_13sal2     := popcao_13sal2;
      ptipo_ferias1     := ptipo_ferias1;
      pdt_retorno_parc1 := pdt_retorno_parc1;
      pdt_pagto_parc1   := pdt_pagto_parc1;
      pjornada_reduzida := pjornada_reduzida;
      RAISE vsaida_erro;
    END IF;
    --
    /*    if pdt_saida_parc1 is not null then
          --
        begin
            --
            select prh.considera_ref_ferias
                    ,prh.dt_ref_ferias
                    ,prh.dia_limite_ferias
              into   vconsidera_ref_ferias
                    ,vdt_ref_ferias
                    ,vdia_limite_ferias
              from   parametros_recursos_humanos prh
              where  prh.cod_empresa = pcod_empresa;
          --
        exception
            when others then
          pflg_retorno := 'N';
          pmsg_retorno := 'Erro ao buscar parametros para validação de datas: '||sqlerrm;
              raise vsaida_erro;
        end;
        --
        if vconsidera_ref_ferias = -1 then
            if to_number(to_char(sysdate,'dd')) < vdia_limite_ferias then
                if pdt_saida_parc1 < vdt_ref_ferias and psolicitacao is null then
            pflg_retorno := 'N';
                pmsg_retorno := 'A data de saída das férias deve ser maior ou igual à '||to_char(vdt_ref_ferias,'dd/mm/rrrr')||'!';
                raise vsaida_erro;
              end if;
            else
                if pdt_saida_parc1 <= last_day(vdt_ref_ferias) and psolicitacao is null then
            pflg_retorno := 'N';
                pmsg_retorno := 'A data de saída das férias deve ser maior que '||to_char(last_day(vdt_ref_ferias),'dd/mm/rrrr')||'!';
                raise vsaida_erro;
              end if;
          end if;
        end if;
          --
    end if;*/
    --
  
    dbms_output.put_line('Valida_Dt_Saida_Parc1 #01 ' || pcod_empresa || ', ' ||
                         psolicitacao || ', ' || pmatricula || ', ' ||
                         pdt_inic_per_ferias || ', ' || pdt_fim_per_ferias || ', ' ||
                         pdias_abono_pec1 || ', ' || pdt_saida_parc2 || ', ' ||
                         psaldo || ', ' || pdt_saida_parc1 || ', ' ||
                         pnum_dias_parc1 || ', ' || ptipo_ferias1 || ', ' ||
                         popcao_13sal1 || ', ' || pdt_retorno_parc1);
  
    Vld_Per_Meses(pcod_empresa,
                  pmatricula,
                  pdt_saida_parc1,
                  pdt_inic_per_ferias,
                  pflg_retorno,
                  pmsg_retorno);
  
    dbms_output.put_line('Valida_Dt_Saida_Parc1 #02');
  
    IF NVL(pflg_retorno, 'S') <> 'S' THEN
      RAISE vsaida_erro;
    END IF;
    --
    IF pdt_saida_parc1 IS NOT NULL THEN
      --
      IF pdt_retorno_parc1 IS NOT NULL AND
         pdt_saida_parc1 >= pdt_retorno_parc1 THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A data de saída não pode ser maior ou igual à data de retorno!';
        RAISE vsaida_erro;
      END IF;
      --
      BEGIN
        --
        SELECT fer.idade_minima,
               fer.idade_maxima,
               dias_margem_ferias,
               pes.filial,
               nvl(fer.antecipa_parc_1, 0) -- Tratar antecipação de férias por conta do coronavírus Rodrigo 24/03/2020
          INTO vl_idade_minima,
               vl_idade_maxima,
               vl_dias_margem_ferias,
               vfilial,
               Vl_antecipa_parc_1 -- Tratar antecipação de férias por conta do coronavírus Rodrigo 24/03/2020
          FROM FERIAS_PARAMETROS fer, INF_PESSOAIS pes
         WHERE fer.cod_empresa = pcod_empresa
           AND fer.cod_empresa = pes.cod_empresa
           AND fer.cod_filial = pes.filial
           AND pes.matricula = pmatricula;
        --
      EXCEPTION
        WHEN OTHERS THEN
          vl_idade_minima       := 0;
          vl_idade_maxima       := 0;
          vl_dias_margem_ferias := 0;
      END;
      --
    
      V_RADIO_ESTAT := ver_radio_estat(PCOD_EMPRESA, PMATRICULA);
    
      V_VINCULO := FNC_VINCULO_NOME(PCOD_EMPRESA, PMATRICULA);
    
      IF vl_dias_margem_ferias > 0 THEN
        --Alterado/Comentado Bruno Sousa 29/04/2024
        --vl_data_limite := pdt_fim_per_ferias - vl_dias_margem_ferias;
        vl_data_limite := pdt_fim_per_ferias + 1;
      END IF;
      --
      IF Vl_antecipa_parc_1 > 0 THEN
        -- Tratar antecipação de férias por conta do coronavírus Rodrigo 24/03/2020
        Vl_lim_antecipa_parc_1 := ADD_MONTHS(pdt_inic_per_ferias,
                                             Vl_antecipa_parc_1);
        IF pdt_saida_parc1 < Vl_lim_antecipa_parc_1 AND V_RADIO_ESTAT = 'N' -- Humberto/Rodrigo 09/08/2022
        
         THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'A data de saída informada é menor que a data de início para programação de férias! Data de início: ' ||
                          TO_CHAR(Vl_lim_antecipa_parc_1, 'dd/mm/rrrr');
          RAISE vsaida_erro;
        END IF;
      ELSIF Vl_antecipa_parc_1 = 0 AND vl_data_limite > pdt_saida_parc1 AND
            V_RADIO_ESTAT = 'N' -- Humberto/Rodrigo 09/08/2022
            AND V_VINCULO <> 'ESTAGIARIO' -- Bruno Sousa 09/04/2024
       THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A data de saída informada é menor que a data de início para programação de férias! Data de início: ' ||
                        TO_CHAR(Vl_Data_Limite, 'DD/MM/RRRR');
        RAISE vsaida_erro;
      ELSE
        --++30032020
        vAnos := F_Tempo(vAdmissao,
                         'aA mM dD hH miMI',
                         pDt_Saida_Parc1,
                         'A');
      
        IF NVL(vAnos, 0) > 0 THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'A data de saída informada é menor que a data de início para programação de férias! Data de início: ' ||
                          TO_CHAR(vl_data_limite, 'dd/mm/rrrr');
          RAISE vsaida_erro;
        END IF;
        --
      END IF;
    
      dbms_output.put_line('Valida_Dt_Saida_Parc1 #03');
      -- chamado 9408
      FOR linha1 IN (SELECT dt_saida_parc1,
                            dt_inic_per_ferias,
                            dt_fim_per_ferias,
                            dt_retorno_parc1
                       FROM FERIAS
                      WHERE cod_empresa = pcod_empresa
                        AND matricula = pmatricula
                        AND dt_inic_per_ferias < pdt_inic_per_ferias) LOOP
        --
        BEGIN
          --
          SELECT DISTINCT 'S'
            INTO v_existe
            FROM FERIAS
           WHERE cod_empresa = pcod_empresa
             AND matricula = pmatricula
             AND pdt_saida_parc1 BETWEEN linha1.dt_saida_parc1 AND
                 (linha1.dt_retorno_parc1 - 1);
          --
          IF v_existe = 'S' THEN
            EXIT;
          END IF;
          --
        EXCEPTION
          WHEN OTHERS THEN
            NULL;
        END;
        --
      END LOOP;
      --
      dbms_output.put_line('Valida_Dt_Saida_Parc1 #04 pnum_dias_parc1: ' ||
                           pnum_dias_parc1);
      --
      IF NVL(v_existe, 'N') = 'S' THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A data de saída de férias é inferior a data de retorno da parcela anterior!';
        RAISE vsaida_erro;
      END IF;
      --
      --IF DATA_SAIDA_PARC_VALIDA(PDT_SAIDA_PARC1, PCOD_EMPRESA, VFILIAL, PMATRICULA, PFLG_RETORNO, PMSG_RETORNO) = 'S' AND NVL(PFLG_RETORNO,'S') = 'S' THEN -- Chamado 14368 28/09/2018
      IF VALIDA_DT_SAIDA(PCOD_EMPRESA,
                         PMATRICULA,
                         PDT_SAIDA_PARC1,
                         PMSG_RETORNO) = 'S' THEN
      
        NULL;
      ELSE
        RAISE VSAIDA_ERRO;
      END IF;
      --
      OPEN c2;
      FETCH c2
        INTO v_c2;
      CLOSE c2;
      IF v_c2.total = 0 THEN
        Vld_Primeira_Parcela(pcod_empresa,
                             psolicitacao,
                             pmatricula,
                             pdt_inic_per_ferias,
                             pdt_fim_per_ferias,
                             pdias_abono_pec1,
                             pdt_saida_parc2,
                             psaldo,
                             pdt_saida_parc1,
                             pnum_dias_parc1,
                             ptipo_ferias1,
                             popcao_13sal1,
                             pdt_retorno_parc1,
                             pdias_abono_pec1_dsp,
                             pnum_dias_parc1_dsp,
                             pflg_retorno,
                             pmsg_retorno);
        IF NVL(pflg_retorno, 'S') <> 'S' THEN
          RAISE vsaida_erro;
        END IF;
      END IF;
    END IF;
    --
  
    dbms_output.put_line('Valida_Dt_Saida_Parc1 #05 ' || pcod_empresa || ', ' ||
                         vfilial || ', ' || pdt_saida_parc1 || ', ' ||
                         pdt_fim_per_ferias || ', ' || pnum_dias_parc1 || ', ' ||
                         psaldo || ', ' || v_flag || ', ' || pdias_direito);
  
    lanc_abono_p1(pcod_empresa,
                  vfilial,
                  pdt_saida_parc1,
                  pdt_fim_per_ferias,
                  psaldo,
                  pdias_direito, --Humberto/Izidoro 03/03/2016
                  --pnum_dias_parc1,
                  --pdias_abono_pec1,
                  pnum_dias_parc1_dsp,
                  pdias_abono_pec1_dsp,
                  v_flag,
                  pflg_retorno,
                  pmsg_retorno);
  
    dbms_output.put_line('Valida_Dt_Saida_Parc1 #05.1 ' || psaldo || ', ' ||
                         pdias_direito || ', ' || pmsg_retorno);
  
    IF NVL(pflg_retorno, 'S') <> 'S' THEN
      dbms_output.put_line('Valida_Dt_Saida_Parc1 #05.2 ' || psaldo || ', ' ||
                           pdias_direito || ', ' || pmsg_retorno);
      RAISE vsaida_erro;
    END IF;
    --
    dbms_output.put_line('Valida_Dt_Saida_Parc1 #06');
    /*OPEN c1;
    FETCH c1
      INTO v_c1;
    CLOSE c1;*/
    --
    /* -- Comentado por Igor Cardoso 22/06/2016
     dbms_output.put_line('Valida_Dt_Saida_Parc1 #07 PSALDO: '||PSALDO);
    IF v_c1.abono_ferias = 'N' THEN
      pdias_abono_pec1 := 0;
      pnum_dias_parc1  := psaldo;
      dbms_output.put_line('Valida_Dt_Saida_Parc1 #07.1 PSALDO: '||PSALDO);
    ELSIF v_c1.abono_ferias = 'S' AND psaldo < v_c1.saldo_fer_min THEN
      --
      IF pdt_fim_per_ferias > LAST_DAY(v_c1.dt_ref_folha) AND
         NVL(pfalta_hora, 0) <= 5 THEN
        NULL;
        dbms_output.put_line('Valida_Dt_Saida_Parc1 #07.2 PSALDO: '||PSALDO);
      ELSE
        pdias_abono_pec1 := 0;
    
        -- Alterado por Igor Cardoso 22/06/2016 De.
    
          if NVL(pjornada_reduzida, 'N') = 'N' then
            psaldo := (30 - nvl(trim(psaldo_bruto), 0)) + (nvl(trim(psaldo), 0));
            dbms_output.put_line('Valida_Dt_Saida_Parc1 #07.3 PSALDO: '||PSALDO);
          else
            psaldo := (18 - nvl(trim(psaldo_bruto), 0)) + (nvl(trim(psaldo), 0));
            pnum_dias_parc1 := f_jornada_reduzida(pcod_empresa,pmatricula,psaldo,null); -- Rodrigo (Chamado 9869)
            dbms_output.put_line('Valida_Dt_Saida_Parc1 #07.4 PSALDO: '||PSALDO);
          end if;
    
          if pnum_dias_parc1 Is Null then
            -- Chamado 8379 - Não alterar se o campo já estiver preenchido
            pnum_dias_parc1 := psaldo;
            dbms_output.put_line('Valida_Dt_Saida_Parc1 #07.5 PSALDO: '||PSALDO);
          end if;
    
      END IF;
      --
    ELSIF v_c1.abono_ferias = 'S' AND psaldo_bruto < 30 AND
          v_c1.saldo_fer_min <= pdias_direito THEN
    
        if NVL(pjornada_reduzida, 'N') = 'N' then
          psaldo := (30 - nvl(trim(psaldo_bruto), 0)) + (nvl(trim(psaldo), 0));
          dbms_output.put_line('Valida_Dt_Saida_Parc1 #07.6 PSALDO: '||PSALDO);
        else
          dbms_output.put_line('Valida_Dt_Saida_Parc1 #07.7.1 PSALDO: '||PSALDO||' psaldo_bruto: '||psaldo_bruto);
          psaldo := (18 - nvl(trim(psaldo_bruto), 0)) + (nvl(trim(psaldo), 0));
          pnum_dias_parc1 := psaldo; -- f_jornada_reduzida(pcod_empresa,pmatricula,:global.saldo,null); -- Rodrigo (Chamado 9869)
          dbms_output.put_line('Valida_Dt_Saida_Parc1 #07.7.2 PSALDO: '||PSALDO||' psaldo_bruto: '||psaldo_bruto);
        end if;
    
        --:global.saldo           := (30 - nvl(psaldo_bruto,0)) + nvl(psaldo,0);
        if pnum_dias_parc1 Is Null then
          -- Chamado 8379 - Não alterar se o campo já estiver preenchido
          pnum_dias_parc1 := psaldo;
        end if;
    else
    -- condicao 5
    psaldo := pdias_direito; -- Humberto/Izidoro 29/09/2014
    dbms_output.put_line('Valida_Dt_Saida_Parc1 #07.8 PSALDO: '||PSALDO);
    -- Alterado por Igor Cardoso 22/06/2016 Até.
    END IF;
    --
    
    */
  
    /*Comentado Rodrigo 10/07/2020    IF pdt_saida_parc1 < trunc(sysdate)+2 and Vl_antecipa_parc_1 is not null then
      pflg_retorno := 'N';
      pmsg_retorno := 'A data de saída deverá ser solicitada com antecedência de, no mínimo, quarenta e oito horas. Data permitida à partir de '||to_char(trunc(sysdate)+2,'dd/mm/rrrr')||'.';
      raise vsaida_erro;
    END IF;*/ --
    --Bruno Sousa 22/10/2024
    --Esse paramentro usado para cancelamento das férias tbm sera usado para criar as parcelas de férias
    SELECT nvl(c.QTD_MAX_DIAS_FERIAS, 0)
      INTO V_QTD_MAX_DIAS_FERIAS
      FROM PARAMETROS_RECURSOS_HUMANOS c
     WHERE c.cod_empresa = pcod_empresa;
    -- Comentado Bruno Sousa 08/01/2026 AND Vl_antecipa_parc_1 > 0
    IF pdt_saida_parc1 < TRUNC(SYSDATE) + V_QTD_MAX_DIAS_FERIAS /*AND Vl_antecipa_parc_1 > 0*/
     THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'A data de saída deverá ser solicitada com antecedência de, no mínimo, ' ||
                      V_QTD_MAX_DIAS_FERIAS ||
                      ' dias. Data permitida à partir de ' ||
                      TO_CHAR(TRUNC(SYSDATE) + V_QTD_MAX_DIAS_FERIAS,
                              'dd/mm/rrrr') || '.';
      RAISE vsaida_erro;
    END IF;
    -- Solicitação Rodrigo 10/07/2020
    --IF DATA_SAIDA_PARC_VALIDA(pdt_saida_parc1,pcod_empresa, vfilial, pmatricula, pflg_retorno, pmsg_retorno) = 'S' AND NVL(pflg_retorno,'S') = 'S' THEN -- Incluso em 25/03/2020 (já tinha na F013303)
    IF VALIDA_DT_SAIDA(PCOD_EMPRESA,
                       PMATRICULA,
                       PDT_SAIDA_PARC1,
                       PMSG_RETORNO) = 'S' THEN
      NULL;
    ELSE
      RAISE vsaida_erro;
    END IF;
  
    /*****/ -- Solicitação Rodrigo 05/08/2022 - Adicionado por Igor Sala
    IF pdt_saida_parc1 IS NOT NULL THEN
      prc_verif_limite_agend_ferias(pcod_empresa,
                                    pmatricula,
                                    pdt_saida_parc1,
                                    1,
                                    pdt_inic_per_ferias,
                                    pdt_fim_per_ferias,
                                    pflg_retorno,
                                    pmsg_retorno);
      IF pflg_retorno = 'N' THEN
        RAISE vsaida_erro;
      END IF;
    END IF;
    /*****/
    dbms_output.put_line('Valida_Dt_Saida_Parc1 #08 PSALDO: ' || PSALDO ||
                         ' pnum_dias_parc1: ' || pnum_dias_parc1);
    vld_saldo1(pcod_empresa,
               pmatricula,
               pfalta_hora,
               pdt_fim_per_ferias,
               pjornada_reduzida,
               pdias_direito,
               psaldo_bruto,
               ptipo_ferias1,
               pnum_dias_parc1,
               pdias_abono_pec1,
               psaldo,
               pdias_abono_pec1_dsp,
               pnum_dias_parc1_dsp,
               pflg_retorno,
               pmsg_retorno);
    --
    dbms_output.put_line('Valida_Dt_Saida_Parc1 #09 pnum_dias_parc1: ' ||
                         pnum_dias_parc1);
    --
    pdias_direito := psaldo;
    /*
    ------------------------------------------------------------------------------------------------------
         -- Humberto/Izidoro 29/02/2016: acrescentado novo tratamento
         pdias_direito :=  nvl(f_jornada_reduzida(pcod_empresa,pmatricula,nvl(pdias_direito,0),null),0); -- Humberto/Izidoro 29/02/2015
    
      if pfalta_hora > 7 and pjornada_reduzida = 'S' then -- Humberto/Izidoro 01/03/2016
         pdias_direito := pdias_direito / 2;
       end if;
    ------------------------------------------------------------------------------------------------------
        */
    --
    popcao_13sal1 := NVL(popcao_13sal1, 'N');
    popcao_13sal2 := NVL(popcao_13sal2, 'N');
    --
    --IF pdt_saida_parc1 IS NOT NULL THEN
    pdt_pagto_parc1 := retorna_dt_pagto(pcod_empresa,
                                        pmatricula,
                                        pdt_saida_parc1);
    --ELSE
    --  pdt_pagto_parc1 := NULL;
    --END IF;
    --
    dbms_output.put_line('Valida_Dt_Saida_Parc1 #10');
  
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
      dbms_output.put_line('Valida_Dt_Saida_Parc1 #11');
    WHEN OTHERS THEN
      dbms_output.put_line('Valida_Dt_Saida_Parc1 #12');
      pflg_retorno := 'N';
      pmsg_retorno := '3 Pkg_Ferias.Valida_Dt_Saida_Parc1 - Erro: ' ||
                      SQLERRM;
  END Valida_Dt_Saida_Parc1;
  --
  PROCEDURE Valida_Num_Dias_Parc1(pcod_empresa              EMPRESAS.cod%TYPE,
                                  pmatricula                INF_PESSOAIS.matricula%TYPE,
                                  pind_limpa                VARCHAR2,
                                  pdt_fim_per_ferias        FERIAS.dt_fim_per_ferias%TYPE,
                                  psaldo                    NUMBER,
                                  pdt_saida_parc1           IN OUT FERIAS.dt_saida_parc1%TYPE,
                                  pnum_dias_parc1           NUMBER,
                                  pdt_retorno_parc1         IN OUT FERIAS.dt_retorno_parc1%TYPE,
                                  pdias_descanso_adicional  IN OUT FERIAS.dias_descanso_adicional%TYPE,
                                  pdesc_adicional1          IN OUT FERIAS.desc_adicional1%TYPE,
                                  ptipo_ferias1             OUT FERIAS.tipo_ferias1%TYPE,
                                  pdias_abono_pec1          OUT NUMBER,
                                  pdias_direito             NUMBER,
                                  pind_situacao_periodo     FERIAS.ind_situacao_periodo%TYPE,
                                  pjornada_reduzida         VARCHAR2,
                                  pdias_abono_pec1_dsp      OUT VARCHAR2,
                                  pnum_dias_parc1_dsp       OUT VARCHAR2,
                                  pflg_retorno              OUT VARCHAR2,
                                  pmsg_retorno              OUT VARCHAR2,
                                  pcod_ferias_param_parcela ferias_parametros_parcelas.cod%TYPE DEFAULT 7) IS
    --
    v_flag VARCHAR2(1);
    --
    CURSOR c1 IS
      SELECT a.dt_ref_folha
        FROM PARAMETROS_RECURSOS_HUMANOS a
       WHERE a.cod_empresa = pcod_empresa;
    --
    v_c1 c1%ROWTYPE;
    --
    CURSOR c2 IS
      SELECT NVL(a.pagto_abono_ferias, 'N') abono_ferias,
             a.saldo_fer_min,
             b.filial
        FROM filiais_cad a, informacoes_funcionais_cad b
       WHERE b.cod_empresa = a.cod_empresa
         AND b.filial = a.cod_filial
         AND b.cod_empresa = pcod_empresa
         AND b.matricula = pmatricula;
    --
    v_c2 c2%ROWTYPE;
    --
    CURSOR c3(p_filial NUMBER) IS
      SELECT a.qtd_parcelas
        FROM FERIAS_PARAMETROS a
       WHERE a.cod_empresa = pcod_empresa
         AND a.cod_filial = p_filial;
    v_c3 c3%ROWTYPE;
    --
  
  BEGIN
    --
    pflg_retorno := 'S';
    --
    -- insert into testex values (888, 'Valida_Num_Dias_Parc1 -> pnum_dias_parc1: '||pnum_dias_parc1); commit;
    IF NVL(pind_situacao_periodo, 'P') = 'P' THEN
      NULL;
    ELSE
      pdt_saida_parc1          := pdt_saida_parc1;
      pdt_retorno_parc1        := pdt_retorno_parc1;
      pdias_descanso_adicional := pdias_descanso_adicional;
      pdesc_adicional1         := pdesc_adicional1;
      ptipo_ferias1            := ptipo_ferias1;
      pdias_abono_pec1         := pdias_abono_pec1;
      RAISE vsaida_erro;
    END IF;
    --
    OPEN c1;
    FETCH c1
      INTO v_c1;
    CLOSE c1;
    --
    OPEN c2;
    FETCH c2
      INTO v_c2;
    CLOSE c2;
    --
    OPEN c3(v_c2.filial);
    FETCH c3
      INTO v_c3;
    CLOSE c3;
    --
    IF pdt_saida_parc1 IS NOT NULL THEN
    
      Vld_Num_Dias_Parc1(pcod_empresa,
                         pmatricula,
                         pind_limpa,
                         pnum_dias_parc1,
                         pdias_direito,
                         pdt_retorno_parc1,
                         pdias_abono_pec1,
                         pdt_saida_parc1,
                         pdias_descanso_adicional,
                         pdesc_adicional1,
                         ptipo_ferias1,
                         pflg_retorno,
                         pmsg_retorno);
      IF NVL(pflg_retorno, 'S') <> 'S' THEN
        RAISE vsaida_erro;
      END IF;
    END IF;
    --
    lanc_abono_p1(pcod_empresa,
                  v_c2.filial,
                  pdt_saida_parc1,
                  pdt_fim_per_ferias,
                  psaldo,
                  pdias_direito, --Humberto/Izidoro 03/03/2016
                  --pnum_dias_parc1,
                  --pdias_abono_pec1,
                  pnum_dias_parc1_dsp,
                  pdias_abono_pec1_dsp,
                  v_flag,
                  pflg_retorno,
                  pmsg_retorno);
    --
    IF NVL(pflg_retorno, 'S') <> 'S' THEN
      RAISE vsaida_erro;
    END IF;
    --
    /*
    IF psaldo = 30 AND v_flag = 'S' AND
       pnum_dias_parc1 NOT IN (10, 15, 20, 30) THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Informe 10, 15, 20 ou 30 dias!';
      RAISE vsaida_erro;
    END IF;
    */
    --
    /*
    IF pnum_dias_parc1 IN (10, 15, 20, 30) AND
       (psaldo = 30 OR LAST_DAY(v_c1.dt_ref_folha) <= pdt_fim_per_ferias) THEN
      --
      IF pnum_dias_parc1 = 20 THEN
        pdias_abono_pec1 := 10;
      ELSIF pnum_dias_parc1 IN (10, 15, 30) THEN
        pdias_abono_pec1 := 0;
      END IF;
      --
    ELSE
      pdias_abono_pec1 := 0;
    END IF;
    */
    --
    IF pnum_dias_parc1 > NVL(pdias_direito, 0) THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Número de dias de férias maior que ' ||
                      TO_CHAR(pdias_direito);
      RAISE vsaida_erro;
    END IF;
    --
  
    IF v_c2.abono_ferias = 'S' AND v_c2.saldo_fer_min <= psaldo THEN
      IF psaldo = 24 THEN
        IF pnum_dias_parc1 = 16 THEN
          pdias_abono_pec1 := 8;
        END IF;
      ELSIF psaldo = 18 THEN
        IF pnum_dias_parc1 = 12 THEN
          pdias_abono_pec1 := 6;
        END IF;
      ELSIF psaldo = 12 THEN
        IF pnum_dias_parc1 = 8 THEN
          pdias_abono_pec1 := 4;
        END IF;
      END IF;
      --
    END IF;
  
    --
    Dias_Parc1(pdt_saida_parc1,
               pdt_fim_per_ferias,
               pnum_dias_parc1,
               pdias_abono_pec1,
               psaldo,
               pcod_empresa,
               pmatricula,
               pjornada_reduzida,
               pflg_retorno,
               pmsg_retorno);
    --
    IF pflg_retorno = 'N' THEN
      RAISE vsaida_erro;
    END IF;
    --
    /*    PFLG_RETORNO := 'N';
    PMSG_RETORNO := 'DT_RETORNO_PARC1: '||PDT_RETORNO_PARC1;
    RAISE VSAIDA_ERRO; */
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Num_Dias_Parc1 - Erro: ' ||
                      SQLERRM;
  END Valida_Num_Dias_Parc1;
  --
  PROCEDURE Vld_Dias_Abono_Pec1(pcod_empresa        EMPRESAS.cod%TYPE,
                                pmatricula          INF_PESSOAIS.matricula%TYPE,
                                pdt_inic_per_ferias FERIAS.dt_inic_per_ferias%TYPE,
                                pdt_fim_per_ferias  FERIAS.dt_fim_per_ferias%TYPE,
                                pdias_abono_pec1    FERIAS.dias_abono_pec1%TYPE,
                                pnum_dias_parc1     NUMBER,
                                pdt_saida_parc1     FERIAS.dt_saida_parc1%TYPE,
                                popcao_abono_pec1   OUT FERIAS.opcao_abono_pec1%TYPE,
                                pflg_retorno        OUT VARCHAR2,
                                pmsg_retorno        OUT VARCHAR2) IS
    --
    abono_ferias    VARCHAR2(1);
    v_qtde_min_dias PLS_INTEGER := 0;
    --
    disponivel      NUMBER;
    vl_anos         NUMBER;
    vl_idade_minima FERIAS_PARAMETROS.idade_minima%TYPE;
    vl_idade_maxima FERIAS_PARAMETROS.idade_maxima%TYPE;
    vl_filial       INFORMACOES_FUNCIONAIS.filial%TYPE;
    vl_dt_nasc      INF_PESSOAIS.dt_nasc%TYPE;
    vl_sit          NUMBER := 0;
    --
  BEGIN
    --
    BEGIN
      --
      SELECT NVL(fil.pagto_abono_ferias, 'N')
        INTO abono_ferias
        FROM informacoes_funcionais_cad inf, FERIAS fer, filiais_cad fil
       WHERE fil.cod_empresa = pcod_empresa
         AND fer.cod_empresa = fil.cod_empresa
         AND fer.matricula = pmatricula
         AND fer.dt_inic_per_ferias = pdt_inic_per_ferias
         AND fer.dt_fim_per_ferias = pdt_fim_per_ferias
         AND inf.cod_empresa = fil.cod_empresa
         AND inf.filial = fil.cod_filial
         AND inf.matricula = fer.matricula;
      --
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        abono_ferias := 'N';
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Ferias.Vld_Dias_Abono_Pec1 - Erro ao buscar pagto_abono_ferias: ' ||
                        SQLERRM;
        RAISE vsaida_erro;
    END;
    --
    IF NVL(abono_ferias, 'N') = 'N' THEN
      IF NVL(pdias_abono_pec1, 0) > 0 THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Este colaborador não pode receber dias de abono, conforme dados parametrizados na Filial.';
        RAISE vsaida_erro;
      END IF;
    END IF;
    --
    IF NVL(pdias_abono_pec1, 0) = 0 THEN
      popcao_abono_pec1 := 'N';
    ELSIF NVL(pdias_abono_pec1, 0) > 0 THEN
      popcao_abono_pec1 := 'S';
    END IF;
    --
    IF NVL(pdias_abono_pec1, 0) > 30 - NVL(pnum_dias_parc1, 0) THEN
      disponivel   := 30 - NVL(pnum_dias_parc1, 0);
      pflg_retorno := 'N';
      pmsg_retorno := 'Dias de abono maior que ' || TO_CHAR(disponivel);
      RAISE vsaida_erro;
    END IF;
    --
    BEGIN
      --
      SELECT ifu.filial, ip.dt_nasc
        INTO vl_filial, vl_dt_nasc
        FROM informacoes_funcionais_cad ifu, inf_pessoais_cad ip
       WHERE ifu.cod_empresa = ip.cod_empresa
         AND ifu.matricula = ip.matricula
         AND ifu.cod_empresa = pcod_empresa
         AND ifu.matricula = pmatricula;
      --
    EXCEPTION
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Ferias.Vld_Dias_Abono_Pec1 - Erro ao buscar a filial e a data de nascimento: ' ||
                        SQLERRM;
        RAISE vsaida_erro;
    END;
    --
    vl_sit := 1;
    --
    BEGIN
      --
      SELECT idade_minima, idade_maxima
        INTO vl_idade_minima, vl_idade_maxima
        FROM FERIAS_PARAMETROS
       WHERE cod_empresa = pcod_empresa
         AND cod_filial = vl_filial;
      --
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        IF vl_sit = 0 THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Pkg_Ferias.Vld_Dias_Abono_Pec1 - Erro ao verificar data de nascimento do colaborador!';
          RAISE vsaida_erro;
        ELSIF vl_sit = 1 THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Pkg_Ferias.Vld_Dias_Abono_Pec1 - Erro ao verificar idade limite no parâmetro de férias!';
          RAISE vsaida_erro;
        END IF;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Erro ao buscar idade mínima e idade máxima: ' ||
                        SQLERRM;
        RAISE vsaida_erro;
    END;
    --
    vl_anos := TO_NUMBER(TO_CHAR(TRUNC((pdt_saida_parc1 - vl_dt_nasc) / 365)));
    --
    IF (NVL(pnum_dias_parc1, 0) + NVL(pdias_abono_pec1, 0)) < 30 THEN
      --
      IF ((vl_anos < vl_idade_minima) OR (vl_anos > vl_idade_maxima)) AND
         ((NVL(vl_idade_minima, 0) + NVL(vl_idade_maxima, 0)) != 0) THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Colaborador com idade que não permite parcelamento de férias!';
        RAISE vsaida_erro;
      END IF;
      --
    END IF;
    --
    IF pnum_dias_parc1 IS NOT NULL AND
       (NVL(pnum_dias_parc1, 0) + NVL(pdias_abono_pec1, 0)) > 30 THEN
      --*  and Get_Item_Property('ferias.num_dias_parc1',Enabled) = 'TRUE') Then
      pflg_retorno := 'N';
      pmsg_retorno := 'A quantidade de dias de férias não pode exceder o saldo de 30 dias!';
      RAISE vsaida_erro;
    END IF;
    --
    IF (pnum_dias_parc1 IS NOT NULL) THEN
      --
      BEGIN
        --
        SELECT fer.qtde_minimo_dias
          INTO v_qtde_min_dias
          FROM FERIAS_PARAMETROS fer, inf_pessoais_cad inf
         WHERE inf.cod_empresa = fer.cod_empresa
           AND inf.cod_empresa = pcod_empresa
           AND inf.matricula = pmatricula
           AND inf.filial = fer.cod_filial;
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Pkg_Ferias.Vld_Dias_Abono_Pec1 - Não foi possível buscar os parâmetros da filial: ' ||
                          SQLERRM;
          RAISE vsaida_erro;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Pkg_Ferias.Vld_Dias_Abono_Pec1 - Erro ao buscar a quantidade mínima de dias: ' ||
                          SQLERRM;
          RAISE vsaida_erro;
      END;
      --
      IF pdias_abono_pec1 IS NULL OR pnum_dias_parc1 IS NULL THEN
        -- incluso pq o Apex pode não ter ainda o valor do dias_abono_pec1 pra fazer essa validação
        NULL;
      ELSE
        IF ((NVL(pnum_dias_parc1, 0) + NVL(pdias_abono_pec1, 0)) <
           v_qtde_min_dias) THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'O número de dias de férias deve ser maior ou igual ao mínimo permitido de ' ||
                          LPAD(v_qtde_min_dias, 2, 0) || ' dias!';
          RAISE vsaida_erro;
        END IF;
      END IF;
      --
      /*IF ((pnum_dias_parc1 + NVL(pdias_abono_pec1, 0)) < v_qtde_min_dias) THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'O número de dias de férias deve ser maior ou igual ao mínimo permitido de ' ||
                        LPAD(v_qtde_min_dias, 2, 0) || ' dias!';
        RAISE vsaida_erro;
      END IF;*/
      --
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Vld_Dias_Abono_Pec1 - Erro: ' || SQLERRM;
  END Vld_Dias_Abono_Pec1;
  --
  PROCEDURE Valida_Dias_Abono_Pec1(pcod_empresa          EMPRESAS.cod%TYPE,
                                   pmatricula            INF_PESSOAIS.matricula%TYPE,
                                   pfilial               FILIAIS.cod_filial%TYPE,
                                   pdt_inic_per_ferias   FERIAS.dt_inic_per_ferias%TYPE,
                                   pdt_fim_per_ferias    FERIAS.dt_fim_per_ferias%TYPE,
                                   pnum_dias_parc1       NUMBER,
                                   pdt_saida_parc1       FERIAS.dt_saida_parc1%TYPE,
                                   psaldo                NUMBER,
                                   pdias_abono_pec1      OUT FERIAS.dias_abono_pec1%TYPE,
                                   popcao_abono_pec1     OUT FERIAS.opcao_abono_pec1%TYPE,
                                   pind_situacao_periodo FERIAS.ind_situacao_periodo%TYPE,
                                   pdias_direito         NUMBER, -- Humberto/Izidoro 03/03/2016
                                   pusuario              VARCHAR2,
                                   pflg_retorno          OUT VARCHAR2,
                                   pmsg_retorno          OUT VARCHAR2) IS
    --
    --v_flag VARCHAR2(1);
    --
    abono_ferias VARCHAR2(1);
    CURSOR c1 IS
      SELECT dt_ref_ferias
        FROM parametros_recursos_humanos
       WHERE cod_empresa = pcod_empresa;
    v_c1 c1%ROWTYPE;
  
    CURSOR c2 IS
      SELECT a.qtd_parcelas
        FROM ferias_parametros a, informacoes_funcionais b
       WHERE a.cod_empresa = pcod_empresa
         AND b.cod_empresa = a.cod_empresa
         AND b.matricula = pmatricula
         AND a.cod_filial = b.filial;
    v_c2 c2%ROWTYPE;
    /* ?????????????
    PROCEDURE PRC_USUARIO_FERIAS (TIPO NUMBER , Usuario VARCHAR2) IS
      BEGIN
         NULL;
         --?????????????
           IF TIPO = 1 THEN
               UPDATE FERIAS
               SET USUARIO_PROG = Usuario
                   ,DT_ATUALIZACAO_PROG = SYSDATE
                WHERE COD_EMPRESA       = pCOD_EMPRESA
                  AND MATRICULA           = pMATRICULA
                  AND DT_INIC_PER_FERIAS  = pDT_INIC_PER_FERIAS
                  AND DT_FIM_PER_FERIAS   = pDT_FIM_PER_FERIAS;
           ELSIF TIPO = 2 THEN
                UPDATE FERIAS
               SET USUARIO_PROG2 = Usuario
                   ,DT_ATUALIZACAO_PROG2 = SYSDATE
                WHERE COD_EMPRESA       = pCOD_EMPRESA
                  AND MATRICULA           = pMATRICULA
                  AND DT_INIC_PER_FERIAS  = pDT_INIC_PER_FERIAS
                  AND DT_FIM_PER_FERIAS   = pDT_FIM_PER_FERIAS;
    
           ELSIF TIPO = 3 THEN
             UPDATE FERIAS
               SET USUARIO_PROG_COL = Usuario
                   ,DT_ATUALIZACAO_PROG_COL = SYSDATE
                WHERE COD_EMPRESA       = pCOD_EMPRESA
                  AND MATRICULA           = pMATRICULA
                  AND DT_INIC_PER_FERIAS  = pDT_INIC_PER_FERIAS
                  AND DT_FIM_PER_FERIAS   = pDT_FIM_PER_FERIAS;
    
           ELSIF TIPO = 4 THEN
                UPDATE FERIAS
               SET USUARIO_PROG4 = Usuario
                   ,DT_ATUALIZACAO_PROG4 = SYSDATE
                WHERE COD_EMPRESA       = pCOD_EMPRESA
                  AND MATRICULA           = pMATRICULA
                  AND DT_INIC_PER_FERIAS  = pDT_INIC_PER_FERIAS
                  AND DT_FIM_PER_FERIAS   = pDT_FIM_PER_FERIAS;
    
           END IF;
           
           EXCEPTION
               WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Erro ao Atualizar tabela de Férias: '||SQLERRM;
               RAISE vsaida_erro;
      END prc_usuario_ferias;
      */
  BEGIN
    --
    pflg_retorno := 'S';
    --
    IF existe_p1(NULL, pcod_empresa, pmatricula, pdt_inic_per_ferias, NULL) THEN
      --
      pdias_abono_pec1  := pdias_abono_pec1;
      popcao_abono_pec1 := popcao_abono_pec1;
      --
    ELSE
      --
      --  valida_jor_red;
      -- Humberto/Sidnei 20/01/2011: Acrescentado esta validação a pedido do Sidnei.
      OPEN c1;
      FETCH c1
        INTO v_c1;
      CLOSE c1;
      --
      IF NVL(pnum_dias_parc1, 0) + NVL(pDIAS_ABONO_PEC1, 0) > pdias_direito AND
         TRUNC(pDT_FIM_PER_FERIAS, 'mm') < v_c1.DT_REF_FERIAS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Nº de dias maior que saldo final!';
        RAISE vsaida_erro;
      END IF;
    
      OPEN c2;
      FETCH c2
        INTO v_c2;
      CLOSE c2;
      IF NVL(pnum_dias_parc1, 0) + NVL(pDIAS_ABONO_PEC1, 0) IN (10, 15) -- Humberto/Izidoro 29/09/2014
         AND (v_c2.qtd_parcelas = 1 AND pdias_direito = 30) THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Quantidade de dias somente para períodos com permissão para parcelar em 2 vezes.';
        RAISE vsaida_erro;
      
      ELSIF v_c2.qtd_parcelas = 2 THEN
        -- Humberto/Izidoro 29/09/2014: Acrescentado este elsif abaixo...
        --
        -- Para as opções de 10 ou 15, somente na de 10 permitirá que o usuário informe zero ou dez de abono.
        IF pNUM_DIAS_PARC1 = 10 AND pDIAS_ABONO_PEC1 NOT IN (0, 10) THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Somente é permitido informar 0 ou 10 dias de abono!';
          RAISE vsaida_erro;
        END IF;
        --
      END IF;
      --------------------------------------------------------------------------------
      SELECT NVL(fil.pagto_abono_ferias, 'N')
        INTO abono_ferias
        FROM informacoes_funcionais inf, ferias fer, filiais fil
       WHERE fil.cod_empresa = pcod_empresa
         AND fer.cod_empresa = fil.cod_empresa
         AND fer.matricula = pmatricula
         AND fer.dt_inic_per_ferias = pdt_inic_per_ferias
         AND fer.dt_fim_per_ferias = pdt_fim_per_ferias
         AND inf.cod_empresa = fil.cod_empresa
         AND inf.filial = fil.cod_filial
         AND inf.matricula = fer.matricula;
      --
      IF NVL(abono_ferias, 'N') = 'N' THEN
      
        IF NVL(pdias_abono_pec1, 0) > 0 THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Este funcionário não pode receber dias de abono, conforme dados parametrizados na Filial.';
          RAISE vsaida_erro;
        
        END IF;
      
      END IF;
      --
      IF NVL(pdias_abono_pec1, 0) = 0 THEN
        popcao_abono_pec1 := 'N';
      ELSIF NVL(pdias_abono_pec1, 0) > 0 THEN
        popcao_abono_pec1 := 'S';
      END IF;
    
      --
    
      DECLARE
      
        disponivel   NUMBER;
        v_idade_min  ferias_parametros.idade_minima%TYPE DEFAULT 0;
        v_idade_max  ferias_parametros.idade_maxima%TYPE DEFAULT 0;
        v_cod_filial filiais.cod_filial%TYPE DEFAULT 0;
        v_idade_apu  NUMBER(3) DEFAULT 0;
        --v_qtde_tot_dias ferias.saldo_bruto%TYPE DEFAULT 0;
      
      BEGIN
      
        --PRC_USUARIO_FERIAS(1,pusuario);
      
        BEGIN
        
          IF pdt_saida_parc1 IS NOT NULL THEN
          
            IF pdias_abono_pec1 > 30 - NVL(pnum_dias_parc1, 0) THEN
            
              disponivel   := 30 - NVL(pnum_dias_parc1, 0);
              pflg_retorno := 'N';
              pmsg_retorno := 'DIAS DE ABONO MAIOR QUE ' ||
                              TO_CHAR(disponivel);
              RAISE vsaida_erro;
            END IF;
          END IF;
        END;
      
        BEGIN
          SELECT fil.cod_filial,
                 fer.idade_minima,
                 fer.idade_maxima,
                 TRUNC((par.dt_ref_ferias - inf.dt_nasc) / 365.25)
            INTO v_cod_filial, v_idade_min, v_idade_max, v_idade_apu
            FROM ferias_parametros           fer,
                 parametros_recursos_humanos par,
                 inf_pessoais                inf,
                 filiais                     fil
           WHERE inf.cod_empresa = fer.cod_empresa
             AND inf.cod_empresa = par.cod_empresa
             AND inf.cod_empresa = fil.cod_empresa
             AND inf.cod_empresa = pcod_empresa
             AND inf.matricula = pmatricula
             AND inf.filial = fil.cod_filial
             AND inf.filial = fer.cod_filial;
        EXCEPTION
          WHEN NO_DATA_FOUND THEN
            NULL;
          WHEN OTHERS THEN
            NULL;
        END;
      END;
      --
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Dias_Abono_Pec1 - Erro: ' ||
                      SQLERRM;
  END Valida_Dias_Abono_Pec1;
  --
  PROCEDURE ocorrencia13(pcod_empresa  EMPRESAS.cod%TYPE,
                         pmatricula    INF_PESSOAIS.matricula%TYPE,
                         pdata_retorno DATE,
                         pocorr_sal13  OUT OCORR_PAGTO.cod%TYPE,
                         pflg_retorno  OUT VARCHAR2,
                         pmsg_retorno  OUT VARCHAR2) IS
    /* Verifica ocorrencias de adiantamento do 13o. salario */
    vcod_ocorr OCORR_PAGTO.cod%TYPE;
    vcod       OCORR_PAGTO.cod%TYPE;
  BEGIN
    --
    SELECT cod_ocorr, cod
      INTO vcod_ocorr, vcod
      FROM HISTORICO_MEDIA hm, OCORR_PAGTO op
     WHERE hm.cod_empresa = op.cod_empresa
       AND hm.cod_empresa = pcod_empresa
       AND hm.matricula = pmatricula
       AND hm.cod_ocorr = op.cod
       AND op.incid_adiant_13 = 'S'
       AND TO_CHAR(hm.data_ref, 'yyyy') = TO_CHAR(pdata_retorno, 'yyyy');
  
    pocorr_sal13 := 1;
  
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      pocorr_sal13 := 0;
    WHEN TOO_MANY_ROWS THEN
      pocorr_sal13 := 1;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Ocorrencia13 - Erro: ' || SQLERRM;
  END ocorrencia13;
  --
  PROCEDURE Valida_Opcao_13Sal1(pcod_empresa          EMPRESAS.cod%TYPE,
                                pmatricula            INF_PESSOAIS.matricula%TYPE,
                                pdt_saida_parc1       FERIAS.dt_saida_parc1%TYPE,
                                pdt_retorno_parc1     FERIAS.dt_retorno_parc1%TYPE,
                                popcao_13sal1         VARCHAR2,
                                pind_situacao_periodo FERIAS.ind_situacao_periodo%TYPE,
                                PCOD_SOLICITACAO      FERIAS.COD_SOLICITACAO%TYPE,
                                pflg_retorno          OUT VARCHAR2,
                                pmsg_retorno          OUT VARCHAR2) IS
    --
    CURSOR c0 IS
      SELECT a.filial, a.num_sind_diss
        FROM INFORMACOES_FUNCIONAIS a
       WHERE a.cod_empresa = pcod_empresa
         AND a.matricula = pmatricula;
    --
    v_c0 c0%ROWTYPE;
    --
    CURSOR c1(p_filial NUMBER) IS
      SELECT a.mes01,
             a.mes02,
             a.mes03,
             a.mes04,
             a.mes05,
             a.mes06,
             a.mes07,
             a.mes08,
             a.mes09,
             a.mes10,
             a.mes11,
             a.mes12
        FROM FER_MES_SEM_13SAL a
       WHERE a.cod_empresa = pcod_empresa
         AND a.cod_filial = p_filial;
    v_c1 c1%ROWTYPE;
    --
    -- Humberto/Rodrigo 27/08/2021
    CURSOR c1b(p_sindicato NUMBER) IS
      SELECT a.mes01,
             a.mes02,
             a.mes03,
             a.mes04,
             a.mes05,
             a.mes06,
             a.mes07,
             a.mes08,
             a.mes09,
             a.mes10,
             a.mes11,
             a.mes12
        FROM FER_MES_SEM_13SAL_SIND a
       WHERE a.cod_empresa = pcod_empresa
         AND a.cod_sindicato = p_SINDICATO;
    v_c1B c1B%ROWTYPE;
    --
    vocorr_sal13 VARCHAR2(1);
    --
    PROCEDURE Valida_13Sal_Ano_Parc1(pcod_empresa     EMPRESAS.cod%TYPE,
                                     pmatricula       INF_PESSOAIS.matricula%TYPE,
                                     pdt_saida_parc1  FERIAS.dt_saida_parc1%TYPE,
                                     PCOD_SOLICITACAO FERIAS.COD_SOLICITACAO%TYPE,
                                     pflg_retorno     OUT VARCHAR2,
                                     pmsg_retorno     OUT VARCHAR2) IS
      --
      v_cat_13m      FERIAS_PARAMETROS.cat_13m%TYPE DEFAULT 'N';
      v_cat_13h      FERIAS_PARAMETROS.cat_13h%TYPE DEFAULT 'N';
      v_tipo_salario FERIAS_PARAMETROS.cat_13h%TYPE DEFAULT 'N';
      vl_valida_13   NUMBER(1) := 0;
      --
    BEGIN
      --
      BEGIN
        --Bruno Sousa 26/12/2024
        SELECT COUNT(1) opcao_13sal1
          INTO vl_valida_13
          FROM FERIAS
         WHERE cod_empresa = pcod_empresa
           AND matricula = pmatricula
           AND ((TO_CHAR(dt_saida_parc1, 'RRRR') =
               TO_CHAR(pdt_saida_parc1, 'RRRR') AND
               (COD_SOLICITACAO <> PCOD_SOLICITACAO OR
               PCOD_SOLICITACAO IS NULL) AND opcao_13sal1 = 'S') or
               (TO_CHAR(dt_saida_parc2, 'RRRR') =
               TO_CHAR(pdt_saida_parc1, 'RRRR') AND
               (COD_SOLICITACAO <> PCOD_SOLICITACAO OR
               PCOD_SOLICITACAO IS NULL) AND opcao_13sal2 = 'S') or
               (TO_CHAR(dt_saida_parc4, 'RRRR') =
               TO_CHAR(pdt_saida_parc1, 'RRRR') AND
               (COD_SOLICITACAO <> PCOD_SOLICITACAO OR
               PCOD_SOLICITACAO IS NULL) AND opcao_13sal4 = 'S'))
        /* Comentado Bruno Sousa 26/12/2024
        Pode ser qualquer periodo
        --Bruno Sousa 01/03/2024
        AND IND_SITUACAO_PARC_1 = 'C' -- Periodo de férias calculadas
        AND IND_SITUACAO_PERIODO = 'R'
        */
        ;
        --Bruno Sousa 30/12/2024 - Verificar se já existe requisição de férias também
        IF vl_valida_13 = 0 THEN
          SELECT COUNT(1) opcao_13sal1
            INTO vl_valida_13
            FROM REQUISICAO_FERIAS
           WHERE cod_empresa = pcod_empresa
             AND matricula = pmatricula
             AND SIT_REQUISICAO = 1
             AND ((TO_CHAR(dt_saida_parc1, 'RRRR') =
                 TO_CHAR(pdt_saida_parc1, 'RRRR') AND opcao_13sal1 = 'S') or
                 (TO_CHAR(dt_saida_parc2, 'RRRR') =
                 TO_CHAR(pdt_saida_parc1, 'RRRR') AND opcao_13sal2 = 'S') or
                 (TO_CHAR(dt_saida_parc4, 'RRRR') =
                 TO_CHAR(pdt_saida_parc1, 'RRRR') AND opcao_13sal4 = 'S'));
        end if;
        --Bruno Sousa 30/12/2024 - Verificar se existe requisição de férias DIFERENTE da que esta sendo alterada
        IF vl_valida_13 = 1 AND PCOD_SOLICITACAO IS NOT NULL THEN
          SELECT COUNT(1) opcao_13sal1
            INTO vl_valida_13
            FROM REQUISICAO_FERIAS
           WHERE cod_empresa = pcod_empresa
             AND matricula = pmatricula
             AND (COD_SOLICITACAO <> PCOD_SOLICITACAO AND
                 PCOD_SOLICITACAO IS NOT NULL)
             AND SIT_REQUISICAO = 1
             AND ((TO_CHAR(dt_saida_parc1, 'RRRR') =
                 TO_CHAR(pdt_saida_parc1, 'RRRR') AND opcao_13sal1 = 'S') or
                 (TO_CHAR(dt_saida_parc2, 'RRRR') =
                 TO_CHAR(pdt_saida_parc1, 'RRRR') AND opcao_13sal2 = 'S') or
                 (TO_CHAR(dt_saida_parc4, 'RRRR') =
                 TO_CHAR(pdt_saida_parc1, 'RRRR') AND opcao_13sal4 = 'S'));
        end if;
        --
      EXCEPTION
        WHEN OTHERS THEN
          vl_valida_13 := 0;
      END;
      --
      IF vl_valida_13 >= 1 AND popcao_13sal1 = 'S' THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Opção 13º salário já solicitada no ano calendário.';
        RAISE vsaida_erro;
      ELSE
        --
        BEGIN
          --
          SELECT fer.cat_13m, fer.cat_13h, inf.TIPO_SALARIO
            INTO v_cat_13m, v_cat_13h, v_tipo_salario
            FROM FERIAS_PARAMETROS fer, informacoes_funcionais_cad inf
           WHERE inf.cod_empresa = fer.cod_empresa
             AND inf.cod_empresa = pcod_empresa
             AND inf.matricula = pmatricula
             AND inf.filial = fer.cod_filial;
          --
        EXCEPTION
          WHEN OTHERS THEN
            NULL;
        END;
        --
        IF v_tipo_salario = 'M' THEN
          --
          IF NVL(v_cat_13m, 'N') = 'N' AND popcao_13sal1 = 'S' THEN
            pflg_retorno := 'N';
            pmsg_retorno := 'Não é permitido adiantamento de 13º salário nas férias para esta data de saída.';
            RAISE vsaida_erro;
          END IF;
          --
        ELSE
          IF NVL(v_cat_13h, 'N') = 'N' AND popcao_13sal1 = 'S' THEN
            pflg_retorno := 'N';
            pmsg_retorno := 'Não é permitido adiantamento de 13º salário nas férias para esta data de saída.';
            RAISE vsaida_erro;
          END IF;
        END IF;
        --
      END IF;
      --
    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Ferias.Valida_13Sal_Ano_Parc1 - Erro: ' ||
                        SQLERRM;
    END Valida_13Sal_Ano_Parc1;
    --
    PROCEDURE Vld_13_Sal1(pcod_empresa  EMPRESAS.cod%TYPE,
                          pmatricula    INF_PESSOAIS.matricula%TYPE,
                          popcao_13sal1 FERIAS.opcao_13sal1%TYPE,
                          pflg_retorno  OUT VARCHAR2,
                          pmsg_retorno  OUT VARCHAR2) IS
      --
      v_cat_13m      FERIAS_PARAMETROS.cat_13m%TYPE DEFAULT 'N';
      v_cat_13h      FERIAS_PARAMETROS.cat_13h%TYPE DEFAULT 'N';
      v_tipo_salario FERIAS_PARAMETROS.cat_13h%TYPE DEFAULT 'N';
      --
    BEGIN
      --
      BEGIN
        --
        SELECT fer.cat_13m, fer.cat_13h, inf.TIPO_SALARIO
          INTO v_cat_13m, v_cat_13h, v_tipo_salario
          FROM FERIAS_PARAMETROS fer, informacoes_funcionais_cad inf
         WHERE inf.cod_empresa = fer.cod_empresa
           AND inf.cod_empresa = pcod_empresa
           AND inf.matricula = pmatricula
           AND inf.filial = fer.cod_filial;
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          NULL;
        WHEN OTHERS THEN
          NULL;
      END;
      --
      IF v_tipo_salario = 'M' THEN
        --
        IF NVL(v_cat_13m, 'N') = 'N' AND popcao_13sal1 = 'S' THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não é permitido adiantamento de 13º salário nas férias para esta data de saída.';
          RAISE vsaida_erro;
        END IF;
        --
      ELSE
        --
        IF NVL(v_cat_13h, 'N') = 'N' AND popcao_13sal1 = 'S' THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não é permitido adiantamento de 13º salário nas férias para esta data de saída.';
          RAISE vsaida_erro;
        END IF;
        --
      END IF;
      --
    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Ferias.Vld_13_Sal1 - Erro: ' || SQLERRM;
    END Vld_13_Sal1;
    --
  BEGIN
    --
    --DEBUG('PCOD_SOLICITACAO='||PCOD_SOLICITACAO);
    pflg_retorno := 'S';
    --
    IF NVL(pind_situacao_periodo, 'P') = 'P' THEN
      NULL;
    ELSE
      RAISE vsaida_erro;
    END IF;
    --
    vld_13_Sal1(pcod_empresa,
                pmatricula,
                popcao_13sal1,
                pflg_retorno,
                pmsg_retorno);
    --
    IF pflg_retorno = 'N' THEN
      RAISE vsaida_erro;
    END IF;
    --
    IF popcao_13sal1 NOT IN ('S', 'N') OR popcao_13sal1 IS NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Informar "S" ou "N"!';
      RAISE vsaida_erro;
    END IF;
    --
    IF popcao_13sal1 = 'S' THEN
      --
      ocorrencia13(pcod_empresa,
                   pmatricula,
                   pdt_retorno_parc1,
                   vocorr_sal13,
                   pflg_retorno,
                   pmsg_retorno);
      --
      IF vocorr_sal13 = 1 THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Primeira parcela do salário já foi paga.';
        RAISE vsaida_erro;
      ELSIF pflg_retorno = 'N' THEN
        RAISE vsaida_erro;
      END IF;
      --
    END IF;
    --
    Valida_13Sal_Ano_Parc1(pcod_empresa,
                           pmatricula,
                           pdt_saida_parc1,
                           PCOD_SOLICITACAO,
                           pflg_retorno,
                           pmsg_retorno);
    --
    IF pflg_retorno = 'N' THEN
      RAISE vsaida_erro;
    END IF;
    --
    OPEN c0;
    FETCH c0
      INTO v_c0;
    CLOSE c0;
    --
    OPEN c1(v_c0.filial);
    FETCH c1
      INTO v_c1;
    CLOSE c1;
    --
    IF popcao_13sal1 = 'S' AND
       (TO_CHAR(pdt_saida_parc1, 'mm') = '01' AND v_c1.mes01 = 'S' OR
       TO_CHAR(pdt_saida_parc1, 'mm') = '02' AND v_c1.mes02 = 'S' OR
       TO_CHAR(pdt_saida_parc1, 'mm') = '03' AND v_c1.mes03 = 'S' OR
       TO_CHAR(pdt_saida_parc1, 'mm') = '04' AND v_c1.mes04 = 'S' OR
       TO_CHAR(pdt_saida_parc1, 'mm') = '05' AND v_c1.mes05 = 'S' OR
       TO_CHAR(pdt_saida_parc1, 'mm') = '06' AND v_c1.mes06 = 'S' OR
       TO_CHAR(pdt_saida_parc1, 'mm') = '07' AND v_c1.mes07 = 'S' OR
       TO_CHAR(pdt_saida_parc1, 'mm') = '08' AND v_c1.mes08 = 'S' OR
       TO_CHAR(pdt_saida_parc1, 'mm') = '09' AND v_c1.mes09 = 'S' OR
       TO_CHAR(pdt_saida_parc1, 'mm') = '10' AND v_c1.mes10 = 'S' OR
       TO_CHAR(pdt_saida_parc1, 'mm') = '11' AND v_c1.mes11 = 'S' OR
       TO_CHAR(pdt_saida_parc1, 'mm') = '12' AND v_c1.mes12 = 'S') THEN
      --
      pflg_retorno := 'N';
      pmsg_retorno := 'Não é permitido a antecipação do 13º salário nesta refefência!';
      RAISE vsaida_erro;
      --
    END IF;
    --
    -------------------------------------------------------------------------------------------------------------
    v_c1b := NULL;
    OPEN c1b(v_c0.num_sind_diss);
    FETCH c1b
      INTO v_c1b;
    CLOSE c1b;
    --
    IF popcao_13sal1 = 'S' AND
       (TO_CHAR(pdt_saida_parc1, 'mm') = '01' AND v_c1b.mes01 = 'S' OR
       TO_CHAR(pdt_saida_parc1, 'mm') = '02' AND v_c1b.mes02 = 'S' OR
       TO_CHAR(pdt_saida_parc1, 'mm') = '03' AND v_c1b.mes03 = 'S' OR
       TO_CHAR(pdt_saida_parc1, 'mm') = '04' AND v_c1b.mes04 = 'S' OR
       TO_CHAR(pdt_saida_parc1, 'mm') = '05' AND v_c1b.mes05 = 'S' OR
       TO_CHAR(pdt_saida_parc1, 'mm') = '06' AND v_c1b.mes06 = 'S' OR
       TO_CHAR(pdt_saida_parc1, 'mm') = '07' AND v_c1b.mes07 = 'S' OR
       TO_CHAR(pdt_saida_parc1, 'mm') = '08' AND v_c1b.mes08 = 'S' OR
       TO_CHAR(pdt_saida_parc1, 'mm') = '09' AND v_c1b.mes09 = 'S' OR
       TO_CHAR(pdt_saida_parc1, 'mm') = '10' AND v_c1b.mes10 = 'S' OR
       TO_CHAR(pdt_saida_parc1, 'mm') = '11' AND v_c1b.mes11 = 'S' OR
       TO_CHAR(pdt_saida_parc1, 'mm') = '12' AND v_c1b.mes12 = 'S') THEN
      --
      pflg_retorno := 'N';
      pmsg_retorno := 'Não é permitido a antecipação do 13º salário nesta refefência!';
      RAISE vsaida_erro;
      --
    END IF;
    -------------------------------------------------------------------------------------------------------------
  
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Opcao_13Sal1 - Erro: ' || SQLERRM;
  END Valida_Opcao_13Sal1;
  --
  PROCEDURE Valida_Desc_Adicional1(pdesc_adicional1         FERIAS.desc_adicional1%TYPE,
                                   pdias_descanso_adicional FERIAS.dias_descanso_adicional%TYPE,
                                   pind_situacao_periodo    FERIAS.ind_situacao_periodo%TYPE,
                                   pflg_retorno             OUT VARCHAR2,
                                   pmsg_retorno             OUT VARCHAR2) IS
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    IF NVL(pind_situacao_periodo, 'P') = 'P' THEN
      NULL;
    ELSE
      RAISE vsaida_erro;
    END IF;
    --
    IF NVL(pdesc_adicional1, 0) > NVL(pdias_descanso_adicional, 0) THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Dias de bônus maior que o permitido!';
      RAISE vsaida_erro;
    END IF;
    --
    IF pflg_retorno = 'N' THEN
      RAISE vsaida_erro;
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Desc_Adicional1 - Erro: ' ||
                      SQLERRM;
  END Valida_Desc_Adicional1;
  --
  PROCEDURE Valida_Dt_Retorno_Parc1(pdt_retorno_parc1     FERIAS.dt_retorno_parc1%TYPE,
                                    pind_situacao_periodo FERIAS.ind_situacao_periodo%TYPE,
                                    pflg_retorno          OUT VARCHAR2,
                                    pmsg_retorno          OUT VARCHAR2,
                                    pdt_saida_parc1       ferias.dt_saida_parc1%TYPE DEFAULT NULL,
                                    pdt_fim_per_ferias    DATE,
                                    pcod_empresa          empresas.cod%TYPE,
                                    pmatricula            inf_pessoais.matricula%TYPE,
                                    pdt_inic_per_ferias   DATE) IS
    --
    CURSOR c1 IS
      SELECT *
        FROM ferias
       WHERE dt_inic_per_ferias = pdt_inic_per_ferias
         AND matricula = pmatricula
         AND cod_empresa = pcod_empresa;
    v_c1 c1%ROWTYPE;
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    IF pind_situacao_periodo = 'P' THEN
      NULL;
    ELSE
      IF c1%isopen THEN
        CLOSE c1;
      END IF;
      OPEN c1;
      FETCH c1
        INTO v_c1;
      CLOSE c1;
      IF v_c1.ind_situacao_parc_1 = 'C' THEN
        NULL;
      ELSE
        pflg_retorno := 'N';
        pmsg_retorno := 'A situação do período não permite mais alterações!';
        RAISE vsaida_erro;
      END IF;
    END IF;
    --
    IF pdt_retorno_parc1 IS NULL AND pdt_saida_parc1 IS NOT NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Data de Retorno Parcela 1: Campo obrigatório!';
      RAISE vsaida_erro;
    ELSE
      IF pdt_saida_parc1 IS NOT NULL AND
         pdt_retorno_parc1 <= pdt_saida_parc1 THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A data de retorno não pode ser menor ou igual à data de saída!';
        RAISE vsaida_erro;
      END IF;
    
      IF pdt_retorno_parc1 > ADD_MONTHS(pdt_fim_per_ferias, 12) THEN
        -- Adicionado por Igor Cardoso 27/07/2019 - Chamado 17969
        pflg_retorno := 'N';
        pmsg_retorno := 'Data de retorno maior que o permitido na vigência de férias! ';
        RAISE vsaida_erro;
      END IF;
    
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Dt_Retorno_Parc1 - Erro: ' ||
                      SQLERRM;
  END Valida_Dt_Retorno_Parc1;
  --
  PROCEDURE Valida_Tipo_Ferias1(pcod_empresa          EMPRESAS.cod%TYPE,
                                pmatricula            INF_PESSOAIS.matricula%TYPE,
                                pdt_inic_per_ferias   FERIAS.dt_inic_per_ferias%TYPE,
                                pdt_fim_per_ferias    FERIAS.dt_fim_per_ferias%TYPE,
                                preferencia           DATE,
                                ptipo_ferias1         FERIAS.tipo_ferias1%TYPE,
                                pind_situacao_periodo FERIAS.ind_situacao_periodo%TYPE,
                                pflg_retorno          OUT VARCHAR2,
                                pmsg_retorno          OUT VARCHAR2) IS
    --
    vcontrole_ferias NUMBER := 0;
    --
    PROCEDURE afastamento(pcod_empresa        EMPRESAS.cod%TYPE,
                          pmatricula          INF_PESSOAIS.matricula%TYPE,
                          pdt_inic_per_ferias FERIAS.dt_inic_per_ferias%TYPE,
                          pdt_fim_per_ferias  FERIAS.dt_fim_per_ferias%TYPE,
                          preferencia         DATE,
                          pcontrole_ferias    OUT NUMBER,
                          pflg_retorno        OUT VARCHAR2,
                          pmsg_retorno        OUT VARCHAR2) IS
      --
      CURSOR cur1 IS
        SELECT cod_valor_fato, dt_vigencia, dt_vigencia_fim
          FROM historico_cadastral
         WHERE cod_empresa = pcod_empresa
           AND matricula = pmatricula
           AND cod_fato = 1
              --      AND cod_valor_fato !='01'
           AND cod_valor_fato in ('07', '10')
           AND dt_vigencia BETWEEN pdt_inic_per_ferias AND
               pdt_fim_per_ferias;
      -- AND dt_vigencia <= LAST_DAY(''); -- preferencia);
      ndias                    NUMBER(10) := 0; -- total dias afast. 4 e 5
      ndias_lr                 NUMBER(10) := 0; -- total dias afast. licenca remunerada
      aux                      NUMBER(10) := 0;
      aux_flag                 NUMBER(1) := 0;
      dt_ant                   DATE;
      dt_ant_vigencia_fim      DATE;
      cod_valor_fato_ant       historico_cadastral.cod_valor_fato%TYPE;
      v_qtde_dias_perde_ferias ferias_parametros.qtde_dias_perde_ferias%TYPE DEFAULT 0;
    BEGIN
      /*
      insert into testex values (33334, 'PKG_FERIAS.VALIDA_TIPO_FERIAS1.AFASTAMENTO #00 '||pcod_empresa||', '||
                            pmatricula||', '||
                            pdt_inic_per_ferias||', '||
                            pdt_fim_per_ferias||', '||
                            preferencia); commit;
      */
      FOR hist IN cur1 LOOP
        IF aux_flag = 0 THEN
          dt_ant             := hist.dt_vigencia;
          cod_valor_fato_ant := hist.cod_valor_fato;
        END IF;
      
        --  insert into testex values (33334, 'PKG_FERIAS.VALIDA_TIPO_FERIAS1.AFASTAMENTO #00.1 aux = '||hist.dt_vigencia||' - '||dt_ant); commit;
        if hist.dt_vigencia_fim is null then
          aux := hist.dt_vigencia - dt_ant;
        else
          aux := (hist.dt_vigencia_fim - hist.dt_vigencia) + 1;
        end if;
        -- insert into testex values (33334, 'PKG_FERIAS.VALIDA_TIPO_FERIAS1.AFASTAMENTO #00.2 aux = '||aux); commit;
        --IF cod_valor_fato_ant = 4 OR cod_valor_fato_ant = 5 THEN
        IF cod_valor_fato_ant = 10 THEN
          -- 4 - afastado seguro acidente de trabalho
          ndias := ndias + aux; -- 5 - afastado INSS
          -- ndias := ndias + aux;
        END IF;
        IF cod_valor_fato_ant = 7 THEN
          -- afast. licenca remunerada
          ndias_lr := ndias_lr + aux;
        END IF;
        dt_ant              := hist.dt_vigencia;
        dt_ant_vigencia_fim := hist.dt_vigencia_fim;
        cod_valor_fato_ant  := hist.cod_valor_fato;
        aux_flag            := 1;
        aux                 := null;
      END LOOP;
    
      -- insert into testex values (33334, 'PKG_FERIAS.VALIDA_TIPO_FERIAS1.AFASTAMENTO #01 ndias: '||ndias||', aux = '||pdt_fim_per_ferias||' - '||dt_ant); commit;
      if dt_ant_vigencia_fim is null then
        aux := pdt_fim_per_ferias - dt_ant;
      end if;
    
      -- insert into testex values (33334, 'PKG_FERIAS.VALIDA_TIPO_FERIAS1.AFASTAMENTO #02 ndias: '||ndias||', aux: '||aux); commit;
    
      BEGIN
        SELECT fer.qtde_dias_perde_ferias
          INTO v_qtde_dias_perde_ferias
          FROM ferias_parametros fer, informacoes_funcionais inf
         WHERE inf.cod_empresa = fer.cod_empresa
           AND inf.cod_empresa = pcod_empresa
           AND inf.matricula = pmatricula
           AND inf.filial = fer.cod_filial;
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          NULL;
        WHEN OTHERS THEN
          NULL;
      END;
    
      -- insert into testex values (33334, 'PKG_FERIAS.VALIDA_TIPO_FERIAS1.AFASTAMENTO #03 v_qtde_dias_perde_ferias: '||v_qtde_dias_perde_ferias); commit;
    
      --IF cod_valor_fato_ant = 4 OR cod_valor_fato_ant = 5 THEN
      IF cod_valor_fato_ant = 10 THEN
        --  insert into testex values (33334, 'PKG_FERIAS.VALIDA_TIPO_FERIAS1.AFASTAMENTO #04 ndias: '||ndias||', aux: '||aux); commit;
        ndias := ndias + nvl(aux, 0);
      END IF;
    
      -- insert into testex values (33334, 'PKG_FERIAS.VALIDA_TIPO_FERIAS1.AFASTAMENTO #05 ndias: '||ndias||', aux: '||aux); commit;
    
      IF cod_valor_fato_ant = 7 THEN
        ndias_lr := ndias_lr + aux;
      END IF;
      pcontrole_ferias := 0; -- tem direito as ferias
      IF ndias >= v_qtde_dias_perde_ferias THEN
        pcontrole_ferias := 1; -- perde direito as ferias
      END IF;
      IF ndias_lr > 30 THEN
        pcontrole_ferias := 2; -- perde direito as ferias
      END IF;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        pcontrole_ferias := 0; -- tem direito as ferias
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Erro ao verificar os afastamentos da matrícula ' ||
                        pmatricula || ' da empresa ' || pcod_empresa || '.';
        RAISE vsaida_erro;
        /*      CURSOR cur1 IS
            SELECT cod_valor_fato, dt_vigencia
              FROM HISTORICO_CADASTRAL
             WHERE cod_empresa = pcod_empresa
               AND matricula = pmatricula
               AND cod_fato = 1
               AND dt_vigencia BETWEEN pdt_inic_per_ferias AND
                   pdt_fim_per_ferias
               AND dt_vigencia <= LAST_DAY(preferencia);
          --
          ndias    NUMBER(10) := 0; -- total dias afast. 4 e 5
          ndias_lr NUMBER(10) := 0; -- total dias afast. licenca remunerada
          aux      NUMBER(10) := 0;
          aux_flag NUMBER(1) := 0;
          dt_ant   DATE;
          --
          cod_valor_fato_ant       HISTORICO_CADASTRAL.cod_valor_fato%TYPE;
          v_qtde_dias_perde_ferias FERIAS_PARAMETROS.qtde_dias_perde_ferias%TYPE DEFAULT 0;
          --
        BEGIN
          --
          FOR hist IN cur1 LOOP
            IF aux_flag = 0 THEN
              dt_ant             := hist.dt_vigencia;
              cod_valor_fato_ant := hist.cod_valor_fato;
            END IF;
            aux := hist.dt_vigencia - dt_ant;
            IF cod_valor_fato_ant = 4 OR cod_valor_fato_ant = 5 THEN
              -- 4 - afastado seguro acidente de trabalho
              ndias := ndias + aux; -- 5 - afastado INSS
              ndias := ndias + aux;
            END IF;
            IF cod_valor_fato_ant = 6 THEN
              -- afast. licenca remunerada
              ndias_lr := ndias_lr + aux;
            END IF;
            dt_ant             := hist.dt_vigencia;
            cod_valor_fato_ant := hist.cod_valor_fato;
            aux_flag           := 1;
          END LOOP;
          --
          aux := pdt_fim_per_ferias - dt_ant;
          --
          BEGIN
            SELECT fer.qtde_dias_perde_ferias
              INTO v_qtde_dias_perde_ferias
              FROM FERIAS_PARAMETROS  fer,
                   informacoes_funcionais_cad inf
             WHERE inf.cod_empresa = fer.cod_empresa
               AND inf.cod_empresa = pcod_empresa
               AND inf.matricula = pmatricula
               AND inf.filial = fer.cod_filial;
          EXCEPTION
            WHEN NO_DATA_FOUND THEN
              NULL;
            WHEN OTHERS THEN
              NULL;
          END;
          --
          IF cod_valor_fato_ant = 4 OR cod_valor_fato_ant = 5 THEN
            ndias := ndias + aux;
          END IF;
          --
          IF cod_valor_fato_ant = 6 THEN
            ndias_lr := ndias_lr + aux;
          END IF;
          --
          pcontrole_ferias := 0; -- tem direito as ferias
          --
          IF ndias >= v_qtde_dias_perde_ferias THEN
            pcontrole_ferias := 1; -- perde direito as ferias
          END IF;
          --
          IF ndias_lr > 30 THEN
            pcontrole_ferias := 1; -- perde direito as ferias
          END IF;
          --
        EXCEPTION
          WHEN NO_DATA_FOUND THEN
            pcontrole_ferias := 0; -- tem direito as ferias
          WHEN OTHERS THEN
            pflg_retorno := 'N';
            pmsg_retorno := 'Erro ao verificar os afastamentos da matrícula ' ||
                            pmatricula || ' da empresa ' || pcod_empresa || '.';
            RAISE vsaida_erro;*/
    END Afastamento; --
  BEGIN
  
    /*insert into teste values (222, 'PKG_FERIAS.VALIDA_TIPO_FERIAS1 #00 '||pcod_empresa||', '||
    pmatricula||', '||
    pdt_inic_per_ferias||', '||
    pdt_fim_per_ferias||', '||
    preferencia||', '||
    ptipo_ferias1||', '||
    pind_situacao_periodo);*/
  
    /*dbms_output.put_line('PKG_FERIAS.VALIDA_TIPO_FERIAS1 #00 '||pcod_empresa||', '||
    pmatricula||', '||
    pdt_inic_per_ferias||', '||
    pdt_fim_per_ferias||', '||
    preferencia||', '||
    ptipo_ferias1||', '||
    pind_situacao_periodo);*/
    --
    pflg_retorno := 'S';
    --
    IF NVL(pind_situacao_periodo, 'P') = 'P' THEN
      NULL;
    ELSE
      RAISE vsaida_erro;
    END IF;
    --
    IF ptipo_ferias1 NOT IN ('N', 'C') THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Entre com a opção correta: N - Normal, C - Coletivas';
      RAISE vsaida_erro;
    END IF;
    --
    /*    pflg_retorno := 'N';
    pmsg_retorno := pcod_empresa||','||pmatricula||','||pdt_inic_per_ferias||','||pdt_fim_per_ferias||','||preferencia||','||vcontrole_ferias;
    raise vsaida_erro;*/
    afastamento(pcod_empresa,
                pmatricula,
                pdt_inic_per_ferias,
                pdt_fim_per_ferias,
                preferencia,
                vcontrole_ferias,
                pflg_retorno,
                pmsg_retorno);
    --
    IF NVL(pflg_retorno, 'S') <> 'S' THEN
      RAISE vsaida_erro;
    END IF;
    --
    IF NVL(vcontrole_ferias, 0) <> 0 THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Colaborador afastado por mais de 6 meses!';
      RAISE vsaida_erro;
    END IF;
    --
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Colaborador não está ativo - dados não poderão ser preenchidos!';
      RAISE vsaida_erro;
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Tipo_Ferias1 - Erro: ' || SQLERRM;
  END Valida_Tipo_Ferias1;
  --
  FUNCTION retorna_dt_pagto(pcod_empresa EMPRESAS.cod%TYPE,
                            pmatricula   INF_PESSOAIS.matricula%TYPE,
                            p_dt_saida   DATE) RETURN DATE IS
    CURSOR c0 IS
      SELECT a.filial, a.num_sind_diss
        FROM INFORMACOES_FUNCIONAIS a
       WHERE a.cod_empresa = pcod_empresa
         AND a.matricula = pmatricula;
    v_c0 c0%ROWTYPE;
  
    CURSOR c1(p_filial NUMBER) IS
      SELECT qtde_dias_anteced
        FROM FERIAS_PARAMETROS a
       WHERE a.cod_empresa = pcod_empresa
         AND a.cod_filial = p_filial;
    v_c1 c1%ROWTYPE;
  
    v_dt DATE := p_dt_saida;
  
    CURSOR c2(p_filial NUMBER) IS
      SELECT a.dt_feriado
        FROM FERIADO_NACIONAL a
       WHERE a.cod_empresa = pcod_empresa
         AND a.dt_feriado = v_dt
      UNION
      SELECT a.dt_feriado
        FROM FERIADO_LOCAL a
       WHERE a.cod_empresa = pcod_empresa
         AND a.cod_filial = p_filial
         AND a.dt_feriado = v_dt;
    v_c2   c2%ROWTYPE;
    v_cont NUMBER(10) := 0;
  BEGIN
    --
    OPEN c0;
    FETCH c0
      INTO v_c0;
    CLOSE c0;
    --
    OPEN c1(v_c0.filial);
    FETCH c1
      INTO v_c1;
    CLOSE c1;
  
    v_c1.qtde_dias_anteced := NVL(v_c1.qtde_dias_anteced, 0);
    --
    IF v_c1.qtde_dias_anteced > 0 AND p_dt_saida IS NOT NULL THEN
      LOOP
        v_dt := v_dt - 1;
        IF TO_NUMBER(TO_CHAR(v_dt, 'd')) NOT IN (1, 7) THEN
          v_c2.dt_feriado := NULL;
          OPEN c2(v_c0.filial);
          FETCH c2
            INTO v_c2;
          CLOSE c2;
        
          IF v_c2.dt_feriado IS NULL THEN
            v_cont := v_cont + 1;
          END IF;
        
        END IF;
      
        IF v_cont = v_c1.qtde_dias_anteced THEN
          EXIT;
        END IF;
      
      END LOOP;
    END IF;
  
    IF v_dt = p_dt_saida THEN
      v_dt := NULL;
    END IF;
  
    RETURN v_dt;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN(NULL);
  END retorna_dt_pagto;
  --
  FUNCTION verif_interv_progr_ferias(pcod_empresa EMPRESAS.cod%TYPE,
                                     pfilial      FILIAIS.cod_filial%TYPE,
                                     pdt_retorno  FERIAS.dt_retorno_parc1%TYPE,
                                     pdt_saida    FERIAS.dt_saida_parc1%TYPE,
                                     pintervalo   OUT FERIAS_PARAMETROS.interv_progr_ferias%TYPE)
    RETURN BOOLEAN IS
    --
  BEGIN
    BEGIN
      SELECT INTERV_PROGR_FERIAS
        INTO pintervalo
        FROM FERIAS_PARAMETROS
       WHERE COD_EMPRESA = pcod_empresa
         AND COD_FILIAL = pfilial;
    
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        pintervalo := 0;
    END;
  
    IF pdt_saida < (pdt_retorno + pintervalo) THEN
      RETURN FALSE;
    ELSE
      RETURN TRUE;
    END IF;
  END;
  --
  PROCEDURE P2(pnum_dias_parc1  NUMBER,
               pdias_abono_pec1 FERIAS.dias_abono_pec1%TYPE,
               pnum_dias_parc2  IN OUT FERIAS.num_dias_parc2%TYPE,
               pdias_abono_pec2 IN OUT FERIAS.dias_abono_pec2%TYPE,
               PSALDO           IN NUMBER,
               pflg_retorno     IN OUT VARCHAR2,
               pmsg_retorno     IN OUT VARCHAR) IS
  BEGIN
    pnum_dias_parc2  := PSALDO; --Cibele 30 - NVL(pnum_dias_parc1, 0) + NVL(pdias_abono_pec1,0);
    pdias_abono_pec2 := 0;
  EXCEPTION
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Dt_Saida_Parc2/P2 - Erro: ' ||
                      SQLERRM;
  END P2;
  --
  PROCEDURE Bloqueia_Parc2(pcod_empresa         EMPRESAS.cod%TYPE,
                           pfilial              FILIAIS.cod_filial%TYPE,
                           pdt_saida_parc1      FERIAS.dt_saida_parc1%TYPE,
                           pnum_dias_parc1      NUMBER,
                           pdias_abono_pec1     FERIAS.dias_abono_pec1%TYPE,
                           pdt_fim_per_ferias   FERIAS.dt_fim_per_ferias%TYPE,
                           psaldo               NUMBER,
                           pdias_direito        NUMBER, -- Humberto/Izidoro 03/03/2016
                           popcao_13sal2        IN OUT FERIAS.opcao_13sal2%TYPE,
                           pdias_abono_pec1_dsp OUT VARCHAR2,
                           pnum_dias_parc1_dsp  OUT VARCHAR2,
                           pflg_retorno         IN OUT VARCHAR2,
                           pmsg_retorno         IN OUT VARCHAR2) IS
    --
    v_flag VARCHAR2(1);
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    /*
        lanc_abono_p1(pcod_empresa,
                      pfilial,
                      pdt_saida_parc1,
                      pdt_fim_per_ferias,
                      psaldo,
                      pdias_direito,--Humberto/Izidoro 03/03/2016
                      --pnum_dias_parc1,
                      --pdias_abono_pec1,
                      pnum_dias_parc1_dsp,
                      pdias_abono_pec1_dsp,
                      v_flag,
                      pflg_retorno,
                      pmsg_retorno);
    */
    IF pflg_retorno <> 'S' THEN
      RAISE vsaida_erro;
    END IF;
    --
    IF v_flag = 'S' OR
       NVL(pnum_dias_parc1, 0) + NVL(pdias_abono_pec1, 0) >= 30 THEN
      popcao_13sal2 := 'N';
      pflg_retorno  := 'N';
      pmsg_retorno  := 'Não é permitido programar a Segunda Parcela!';
      RAISE vsaida_erro;
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Bloqueia_Parc2 - Erro: ' || SQLERRM;
  END Bloqueia_Parc2;
  --
  -- Chamado pelos campos (dt_saida_parc2,num_dias_parc2,dias_abono_pec2,opcao_13sl2)
  PROCEDURE When_New_Item_Parc2(pcod_empresa         EMPRESAS.cod%TYPE,
                                pmatricula           INF_PESSOAIS.matricula%TYPE,
                                pdt_saida_parc1      FERIAS.dt_saida_parc1%TYPE,
                                pnum_dias_parc1      NUMBER,
                                pdias_abono_pec1     FERIAS.dias_abono_pec1%TYPE,
                                pdt_fim_per_ferias   FERIAS.dt_fim_per_ferias%TYPE,
                                psaldo               NUMBER,
                                pdias_direito        NUMBER, -- Humberto/Izidoro 03/03/2016
                                popcao_13sal2        IN OUT FERIAS.opcao_13sal2%TYPE,
                                pdias_abono_pec1_dsp OUT VARCHAR2,
                                pnum_dias_parc1_dsp  OUT VARCHAR2,
                                pflg_retorno         IN OUT VARCHAR2,
                                pmsg_retorno         IN OUT VARCHAR2) IS
    --
    vfilial FILIAIS.cod_filial%TYPE;
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    BEGIN
      --
      SELECT filial
        INTO vfilial
        FROM inf_pessoais_cad
       WHERE matricula = pmatricula
         AND cod_empresa = pcod_empresa;
      --
    EXCEPTION
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Ferias.When_New_Item_Parc2 - Erro ao buscar a filial: ' ||
                        SQLERRM;
        RAISE vsaida_erro;
    END;
    --
    Bloqueia_Parc2(pcod_empresa,
                   vfilial,
                   pdt_saida_parc1,
                   pnum_dias_parc1,
                   pdias_abono_pec1,
                   pdt_fim_per_ferias,
                   psaldo,
                   pdias_direito, -- Humberto/Izidoro 03/03/2016
                   popcao_13sal2,
                   pdias_abono_pec1_dsp,
                   pnum_dias_parc1_dsp,
                   pflg_retorno,
                   pmsg_retorno);
    --
    IF NVL(pflg_retorno, 'S') <> 'S' THEN
      RAISE vsaida_erro;
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.When_New_Item_Parc2 - Erro: ' || SQLERRM;
  END When_New_Item_Parc2;
  --
  PROCEDURE Valida_Dt_Saida_Parc2(pcod_empresa         EMPRESAS.cod%TYPE,
                                  pcod_solicitacao     FERIAS.cod_solicitacao%TYPE,
                                  pmatricula           INF_PESSOAIS.matricula%TYPE,
                                  pdt_saida_parc1      FERIAS.dt_saida_parc1%TYPE,
                                  pdt_retorno_parc1    FERIAS.dt_retorno_parc1%TYPE,
                                  pnum_dias_parc1      NUMBER,
                                  pdt_saida_parc2      FERIAS.dt_saida_parc2%TYPE,
                                  pdias_abono_pec1     FERIAS.dias_abono_pec1%TYPE,
                                  pdt_inic_per_ferias  FERIAS.dt_inic_per_ferias%TYPE,
                                  pdt_fim_per_ferias   FERIAS.dt_fim_per_ferias%TYPE,
                                  psaldo               NUMBER,
                                  pdias_direito        NUMBER, -- Humberto/Izidoro 03/03/2016
                                  p_data_limite        DATE DEFAULT NULL, -- Chamado 29668 - Andre - 25-04-2023
                                  pnum_dias_parc2      IN OUT FERIAS.num_dias_parc2%TYPE,
                                  pdias_abono_pec2     IN OUT FERIAS.dias_abono_pec2%TYPE,
                                  pdt_retorno_parc2    IN OUT FERIAS.dt_retorno_parc2%TYPE,
                                  pdt_pagto_parc2      IN OUT FERIAS.dt_pagto_parc2%TYPE,
                                  ptipo_ferias2        IN OUT FERIAS.tipo_ferias2%TYPE,
                                  popcao_13sal2        IN OUT FERIAS.opcao_13sal2%TYPE,
                                  pdias_abono_pec1_dsp OUT VARCHAR2,
                                  pnum_dias_parc1_dsp  OUT VARCHAR2,
                                  pflg_retorno         OUT VARCHAR2,
                                  pmsg_retorno         OUT VARCHAR2) IS
    /*
    Alt.1, trat. ref. valores das colunas da tab. FERIAS_PARAMETROS onde "seg', "ter"... sao preenchidos pela aplicacao
           como 'N' e nao como nulos, PSMarconato/Sidnei, 03/03/2022
    */
    --
    V_RADIO_ESTAT          VARCHAR2(1);
    V_VINCULO              VINCULO_EMPREG.NOME%TYPE;
    VDT_AGEND_LIMITE       DATE;
    vdt_data_limite        DATE;
    vl_dias_margem_ferias  FERIAS_PARAMETROS.dias_margem_ferias%TYPE;
    vl_data_limite         DATE;
    Vl_antecipa_parc_2     ferias_parametros.antecipa_parc_2%TYPE; -- Tratar antecipação de férias por conta do coronavírus Rodrigo 24/03/2020
    Vl_lim_antecipa_parc_2 DATE; -- Tratar antecipação de férias por conta do coronavírus Rodrigo 24/03/2020
    --Bruno Sousa 22/10/2024
    --Esse paramentro usado para cancelamento das férias tbm sera usado para criar as parcelas de férias
    V_QTD_MAX_DIAS_FERIAS PARAMETROS_RECURSOS_HUMANOS.QTD_MAX_DIAS_FERIAS%TYPE;
    --++30032020
    vAnos     NUMBER(4);
    vAdmissao DATE;
    --
    vfilial FILIAIS.cod_filial%TYPE;
    --
    CURSOR c1 IS
      SELECT dt_saida_parc1 -- , sit_requisicao
        FROM FERIAS
       WHERE cod_empresa = pcod_empresa
         AND matricula = pmatricula
         AND dt_saida_parc1 < pdt_saida_parc2
         AND dt_saida_parc2 IS NULL
         AND DT_INIC_PER_FERIAS = pdt_inic_per_ferias
         AND DT_FIM_PER_FERIAS = pdt_fim_per_ferias; -- Ajustado em 21/03/2019
    --
    /*      SELECT dt_saida_parc1, sit_requisicao
     FROM REQUISICAO_FERIAS
    WHERE cod_empresa = pcod_empresa
      AND matricula = pmatricula
      AND dt_saida_parc1 < pdt_saida_parc2
      AND dt_saida_parc2 IS NULL
      AND sit_requisicao IN ('1', '2') -- concluída
      AND DT_INIC_PER_FERIAS = pdt_inic_per_ferias
      AND DT_FIM_PER_FERIAS  = pdt_fim_per_ferias;*/ -- Comentado em 21/03/2019
    --
    v_c1 c1%ROWTYPE;
    --
    PROCEDURE Vld_Segunda_Parcela(pcod_empresa        EMPRESAS.cod%TYPE,
                                  pmatricula          INF_PESSOAIS.matricula%TYPE,
                                  pdt_inic_per_ferias FERIAS.dt_inic_per_ferias%TYPE,
                                  pdt_fim_per_ferias  FERIAS.dt_fim_per_ferias%TYPE,
                                  pdt_saida_parc1     FERIAS.dt_saida_parc1%TYPE,
                                  pdt_retorno_parc1   FERIAS.dt_retorno_parc1%TYPE,
                                  --                                  pnum_dias_parc2     in out ferias.num_dias_parc2%type,
                                  pdt_saida_parc2      FERIAS.dt_saida_parc2%TYPE,
                                  pdt_retorno_parc2    IN OUT FERIAS.dt_retorno_parc2%TYPE,
                                  ptipo_ferias2        IN OUT FERIAS.tipo_ferias2%TYPE,
                                  popcao_13sal2        IN OUT FERIAS.opcao_13sal2%TYPE,
                                  pdias_direito        NUMBER, -- Humberto/Izidoro 03/03/2016
                                  pdias_abono_pec1_dsp OUT VARCHAR2,
                                  pnum_dias_parc1_dsp  OUT VARCHAR2,
                                  pflg_retorno         OUT VARCHAR2,
                                  pmsg_retorno         OUT VARCHAR2) IS
      --
      wl_dt_ini              DATE;
      wl_dt_fim              DATE;
      v_erro                 EXCEPTION;
      vl_cod                 INFORMACOES_FUNCIONAIS.situacao%TYPE;
      vl_dt_situacao         INFORMACOES_FUNCIONAIS.dt_situacao%TYPE;
      vl_dt_sit_outros_afast INFORMACOES_FUNCIONAIS.Dt_Retorno_Afast%TYPE;
      v_cat_13m              FERIAS_PARAMETROS.cat_13m%TYPE;
      v_intervalo            FERIAS_PARAMETROS.Interv_Progr_Ferias%TYPE;
      v_filial               FERIAS_PARAMETROS.Cod_Filial%TYPE;
      v_ferias_coletiva      FERIAS_PARAMETROS.ferias_coletiva%TYPE;
      v_antecipa             FERIAS_PARAMETROS.antecipa_parc_2%TYPE;
      v_seg                  FERIAS_PARAMETROS.seg%TYPE;
      v_ter                  FERIAS_PARAMETROS.ter%TYPE;
      v_qua                  FERIAS_PARAMETROS.qua%TYPE;
      v_qui                  FERIAS_PARAMETROS.qui%TYPE;
      v_sex                  FERIAS_PARAMETROS.sex%TYPE;
      v_sab                  FERIAS_PARAMETROS.sab%TYPE;
      v_todos                FERIAS_PARAMETROS.todos%TYPE;
      v_qtde_prog            PLS_INTEGER;
      v_proximo_dia          FERIAS_PARAMETROS.proximo_dia%TYPE;
      v_dsr_jornada          FERIAS_PARAMETROS.DSR_JORNADA%type;
      --
      v_dia_ant_feriado BOOLEAN := DIA_ANTERIOR_EH_FERIADO(pcod_empresa,
                                                           pmatricula,
                                                           pdt_saida_parc2);
      --
      qtde_dias_contr_fer_ NUMBER(3) := 330;
      --
      CURSOR c1 IS
        SELECT fer.perc_dobro
          FROM FERIAS_PARAMETROS fer, informacoes_funcionais_cad inf
         WHERE inf.cod_empresa = fer.cod_empresa
           AND inf.cod_empresa = pcod_empresa
           AND inf.matricula = pmatricula
           AND inf.filial = fer.cod_filial;
      --
      v_c1 c1%ROWTYPE;
      --
      PROCEDURE Vld_Dt_Saida_Parc2(pcod_empresa EMPRESAS.cod%TYPE,
                                   pflg_retorno OUT VARCHAR2,
                                   pmsg_retorno OUT VARCHAR2) IS
        --
        v_dt_ref_folha DATE;
        v_dt_limite    DATE;
        v_dia_limite   NUMBER(2);
        --
      BEGIN
        --
        IF pcod_solicitacao IS NULL THEN
          -- Carrega limite para data de req. pessoal
          IF pcod_empresa IS NOT NULL THEN
            --
            BEGIN
              --
              SELECT P.DT_REF_FOLHA,
                     NVL(LPAD(Dia_Limite_ferias, 2, 0),
                         TO_CHAR(LAST_DAY(P.DT_REF_FOLHA), 'DD')) dia_limite
                INTO v_dt_ref_folha, v_dia_limite
                FROM PARAMETROS_RECURSOS_HUMANOS P
               WHERE P.Cod_Empresa = pcod_empresa;
              --
              IF v_dia_limite >
                 TO_NUMBER(TO_CHAR(LAST_DAY(v_dt_ref_folha), 'dd')) THEN
                v_dia_limite := TO_NUMBER(TO_CHAR(LAST_DAY(v_dt_ref_folha),
                                                  'dd'));
              END IF;
              --
              v_dt_limite := TO_DATE(v_dia_limite || '/' ||
                                     TO_CHAR(v_dt_ref_folha, 'mmrrrr'),
                                     'dd/mm/rrrr');
              --
            EXCEPTION
              WHEN OTHERS THEN
                pflg_retorno := 'N';
                pmsg_retorno := 'Não foi possível buscar a data limite: ' ||
                                SQLERRM;
                RAISE vsaida_erro;
            END;
            --
            IF pdt_saida_parc2 < v_dt_ref_folha THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'A data de saída não pode ser menor que a data de referência da Folha ' ||
                              TO_CHAR(v_dt_ref_folha, 'dd/mm/rrrr') || '!';
              RAISE vsaida_erro;
            END IF;
            --
            IF NOT VALIDA_PRAZO_PROGRAMACAO(pcod_empresa,
                                            pdt_saida_parc2,
                                            pmsg_retorno) THEN
              pflg_retorno := 'N';
              RAISE vsaida_erro;
            END IF;
            --
            IF TRUNC(SYSDATE) > v_dt_limite AND
               NOT (pdt_saida_parc2 > LAST_DAY(v_dt_ref_folha)) THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'O prazo para o cadastro de requisições expirou em ' || ' ' ||
                              TO_CHAR(v_dt_limite, 'DD/MM/YYYY') || '!';
              RAISE vsaida_erro;
            END IF;
            --
            IF TRUNC(SYSDATE) > pdt_saida_parc2 THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'A data informada é menor do que a data atual do sistema!';
              RAISE vsaida_erro;
            END IF;
          END IF;
          --
        END IF;
        --
      EXCEPTION
        WHEN vsaida_erro THEN
          NULL;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Pkg_Ferias.Valida_Dt_Saida_Parc2/Vld_Dt_Saida_Parc2 - Erro: ' ||
                          SQLERRM;
      END Vld_Dt_Saida_Parc2;
      --
    BEGIN
      --
      pflg_retorno := 'S';
      --
      IF p_data_limite IS NOT NULL THEN
        vdt_data_limite := p_data_limite + nvl(pnum_dias_parc1, 0) +
                           nvl(pdias_abono_pec1, 0);
        numDias         := nvl(pnum_dias_parc1, 0);
        numDiasAbono    := nvl(pdias_abono_pec1, 0);
      ELSE
        vdt_data_limite := pdt_saida_parc2;
        numDias         := nvl(pnum_dias_parc1, 0);
        numDiasAbono    := nvl(pdias_abono_pec1, 0);
      END IF;
    
      Vld_Ferias_Dobro(pCod_Empresa,
                       pMatricula,
                       pdt_saida_parc2,
                       pflg_retorno,
                       pmsg_retorno,
                       pdt_inic_per_ferias);
      --Vld_Ferias_Dobro(pCod_Empresa, pMatricula, vdt_data_limite, pflg_retorno, pmsg_retorno,pdt_inic_per_ferias);
      IF NVL(pflg_retorno, 'S') <> 'S' THEN
        RAISE vsaida_erro;
      END IF;
      --
      -- Valida saída pela tabela LIMITE_AGEND_FERIAS (Rodrigo 08/07/2022)
      IF pcod_solicitacao IS NULL THEN
        VDT_AGEND_LIMITE := VERIF_LIMITE_AGEND_FERIAS(PCOD_EMPRESA,
                                                      SYSDATE,
                                                      pdt_saida_parc2);
      END IF;
    
      -- IF VDT_AGEND_LIMITE IS NOT NULL and pdt_saida_parc2 is not null THEN
      --   PFLG_RETORNO := 'N';
      --   PMSG_RETORNO := 'Data de saída de férias deve ser superior à '||TO_CHAR(VDT_AGEND_LIMITE,'DD/MM/RRRR')||'.';
      --   RAISE VSAIDA_ERRO;
      -- END IF;
      --
      BEGIN
        --
        SELECT fer.cat_13m,
               fer.ferias_coletiva,
               fer.cod_filial,
               fer.interv_progr_ferias,
               NVL(fer.antecipa_parc_2, 0),
               fer.seg,
               fer.ter,
               fer.qua,
               fer.qui,
               fer.sex,
               fer.sab,
               fer.todos,
               NVL(fer.qtde_prog_ferias, 0) AS prog_ferias,
               NVL(fer.proximo_dia, 'N'),
               NVL(fer.dsr_jornada, 'N')
          INTO v_cat_13m,
               v_ferias_coletiva,
               v_filial,
               v_intervalo,
               v_antecipa,
               v_seg,
               v_ter,
               v_qua,
               v_qui,
               v_sex,
               v_sab,
               v_todos,
               v_qtde_prog,
               v_proximo_dia,
               v_dsr_jornada
          FROM FERIAS_PARAMETROS fer, informacoes_funcionais_cad inf
         WHERE inf.cod_empresa = fer.cod_empresa
           AND inf.filial = fer.cod_filial
           AND inf.cod_empresa = pcod_empresa
           AND inf.matricula = pmatricula;
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foi possível verificar categoria de 13º salário no parametro de férias!';
          RAISE vsaida_erro;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Pkg_Ferias.Valida_Dt_Saida_Parc2/Vld_Segunda_Parcela - Erro ao verificar categoria de 13º salário no parametro de férias: ' ||
                          SQLERRM;
          RAISE vsaida_erro;
      END;
      --
      IF NVL(v_seg, 'N') = 'N' AND NVL(v_ter, 'N') = 'N' AND
         NVL(v_qua, 'N') = 'N' AND NVL(v_qui, 'N') = 'N' AND
         NVL(v_sex, 'N') = 'N' AND NVL(v_sab, 'N') = 'N' AND
         NVL(v_todos, 'N') = 'N' /*Alt.1*/
         AND NVL(v_dsr_jornada, 'N') = 'N' THEN
        v_todos := 'S';
      END IF;
    
      IF (pdt_saida_parc2 IS NOT NULL) THEN
        --
        IF pdt_retorno_parc2 IS NOT NULL AND
           pdt_saida_parc2 >= pdt_retorno_parc2 THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'A data de saída não pode ser maior ou igual à data de retorno!';
          RAISE vsaida_erro;
        END IF;
        --
        IF pdt_saida_parc2 > ADD_MONTHS(pdt_fim_per_ferias, 12) THEN
          -- Adicionado por Igor Cardoso 12/07/2019 - Chamado 17969
          pflg_retorno := 'N';
          pmsg_retorno := 'Data de saída maior que o permitido na vigência de férias!';
          RAISE vsaida_erro;
        END IF;
        --
        vld_dt_saida_parc2(pcod_empresa, pflg_retorno, pmsg_retorno);
        --
        IF NVL(pflg_retorno, 'S') <> 'S' THEN
          RAISE vsaida_erro;
        END IF;
        --
        IF NOT verif_interv_progr_ferias(pcod_empresa,
                                         v_filial,
                                         pdt_retorno_parc1,
                                         pdt_saida_parc2,
                                         v_intervalo) THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Necessário cumprir os ' || v_intervalo ||
                          ' dias de intervalo mínimo entre as parcelas da programação de férias.';
          pmsg_retorno := pmsg_retorno || CHR(13) ||
                          'Data mínima para Saída: ' ||
                          TO_CHAR(pdt_retorno_parc1 + v_intervalo,
                                  'DD/MM/RRRR');
          RAISE vsaida_erro;
        END IF;
        --
        --verifica se o dia da semana esta habilitado para programar saída de férias
        IF VALIDA_DSR_JORNADA(PCOD_EMPRESA,
                              PMATRICULA,
                              PDT_SAIDA_PARC2,
                              v_dsr_jornada,
                              PMSG_RETORNO) THEN
          NULL;
        ELSIF v_dsr_jornada = 'N' AND v_todos = 'S' THEN
          NULL;
        ELSIF v_dsr_jornada = 'N' AND
              ((TO_CHAR(pdt_saida_parc2, 'D') = 2 AND v_seg = 'S') OR
              (TO_CHAR(pdt_saida_parc2, 'D') = 3 AND v_seg = 'S' AND
              v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
          NULL;
        ELSIF v_dsr_jornada = 'N' AND
              ((TO_CHAR(pdt_saida_parc2, 'D') = 3 AND v_ter = 'S') OR
              (TO_CHAR(pdt_saida_parc2, 'D') = 4 AND v_ter = 'S' AND
              v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
          NULL;
        ELSIF v_dsr_jornada = 'N' AND
              ((TO_CHAR(pdt_saida_parc2, 'D') = 4 AND v_qua = 'S') OR
              (TO_CHAR(pdt_saida_parc2, 'D') = 5 AND v_qua = 'S' AND
              v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
          NULL;
        ELSIF v_dsr_jornada = 'N' AND
              ((TO_CHAR(pdt_saida_parc2, 'D') = 5 AND v_qui = 'S') OR
              (TO_CHAR(pdt_saida_parc2, 'D') = 6 AND v_qui = 'S' AND
              v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
          NULL;
        ELSIF v_dsr_jornada = 'N' AND
              ((TO_CHAR(pdt_saida_parc2, 'D') = 6 AND v_sex = 'S') OR
              (TO_CHAR(pdt_saida_parc2, 'D') = 7 AND v_sex = 'S' AND
              v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
          NULL;
        ELSIF v_dsr_jornada = 'N' AND
              ((TO_CHAR(pdt_saida_parc2, 'D') = 7 AND v_sab = 'S') OR
              (TO_CHAR(pdt_saida_parc2, 'D') = 1 AND v_sab = 'S' AND
              v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
          NULL;
        ELSE
          IF v_dsr_jornada = 'S' THEN
            pflg_retorno := 'N';
            PMSG_RETORNO := 'Por regra de jornada o dia escolhido não é valido para saída de férias conforme DSR. ' ||
                            nvl(PMSG_RETORNO, ' ');
            RAISE vsaida_erro;
          END IF;
          pflg_retorno := 'N';
          pmsg_retorno := NULL;
          --            pmsg_retorno := 'Este dia não é permitido para data de saída de férias. Verifique os parâmetros da filial!';
          IF v_seg = 'S' THEN
            pmsg_retorno := 'Por determinação da empresa, somente segunda-feira';
          END IF;
          IF v_ter = 'S' THEN
            IF pmsg_retorno IS NULL THEN
              pmsg_retorno := 'Por determinação da empresa, somente terça-feira';
            ELSIF v_qua <> 'S' AND v_qui <> 'S' AND v_sex <> 'S' AND
                  v_sab <> 'S' THEN
              pmsg_retorno := pmsg_retorno || ' e terça-feira';
            ELSE
              pmsg_retorno := pmsg_retorno || ', terça-feira';
            END IF;
          END IF;
          IF v_qua = 'S' THEN
            IF pmsg_retorno IS NULL THEN
              pmsg_retorno := 'Por determinação da empresa, somente quarta-feira';
            ELSIF v_qui <> 'S' AND v_sex <> 'S' AND v_sab <> 'S' THEN
              pmsg_retorno := pmsg_retorno || ' e quarta-feira';
            ELSE
              pmsg_retorno := pmsg_retorno || ', quarta-feira';
            END IF;
          END IF;
          IF v_qui = 'S' THEN
            IF pmsg_retorno IS NULL THEN
              pmsg_retorno := 'Por determinação da empresa, somente quinta-feira';
            ELSIF v_sex <> 'S' AND v_sab <> 'S' THEN
              pmsg_retorno := pmsg_retorno || ' e quinta-feira';
            ELSE
              pmsg_retorno := pmsg_retorno || ', quinta-feira';
            END IF;
          END IF;
          IF v_sex = 'S' THEN
            IF pmsg_retorno IS NULL THEN
              pmsg_retorno := 'Por determinação da empresa, somente sexta-feira';
            ELSIF v_sab <> 'S' THEN
              pmsg_retorno := pmsg_retorno || ' e sexta-feira';
            ELSE
              pmsg_retorno := pmsg_retorno || ', sexta-feira';
            END IF;
          END IF;
          IF v_sab = 'S' THEN
            IF pmsg_retorno IS NULL THEN
              pmsg_retorno := 'Por determinação da empresa, somente sábado';
            ELSE
              pmsg_retorno := pmsg_retorno || ' e sábado';
            END IF;
          END IF;
          IF pmsg_retorno IS NOT NULL THEN
            IF INSTR(pmsg_retorno, ' e ') <> 0 THEN
              pmsg_retorno := pmsg_retorno ||
                              ' são dias válidos para saída de férias.';
            ELSE
              pmsg_retorno := pmsg_retorno ||
                              ' é dia válido para saída de férias.';
            END IF;
          END IF;
          RAISE vsaida_erro;
        END IF;
      END IF;
      --
      BEGIN
        --
        SELECT fer.cat_13m,
               fer.ferias_coletiva,
               NVL(fer.antecipa_parc_2, 0)
          INTO v_cat_13m, v_ferias_coletiva, v_antecipa
          FROM FERIAS_PARAMETROS fer, informacoes_funcionais_cad inf
         WHERE inf.cod_empresa = fer.cod_empresa
           AND inf.filial = fer.cod_filial
           AND inf.cod_empresa = pcod_empresa
           AND inf.matricula = pmatricula;
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foi possível verificar categoria de 13º salário no parametro de férias!';
          RAISE vsaida_erro;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Pkg_Ferias.Valida_Dt_Saida_Parc2/Vld_Segunda_Parcela - Erro: ' ||
                          SQLERRM;
          RAISE vsaida_erro;
      END;
      --
      --Bruno Sousa 25/01/2024
      --if FNC_VINCULO_CLF(pcod_empresa, pmatricula) = '5' then
      IF fnc_VerifEstatutario(pcod_empresa, pmatricula) = 'S' then
        if pdt_saida_parc1 < pdt_inic_per_ferias or
           pdt_saida_parc1 > pdt_fim_per_ferias then
          pflg_retorno := 'N';
          pmsg_retorno := 'A data de saída deve ser entre as datas ' ||
                          TO_CHAR(pdt_inic_per_ferias, 'dd/mm/rrrr') ||
                          ' e ' ||
                          TO_CHAR(pdt_fim_per_ferias, 'dd/mm/rrrr') || ' !';
          RAISE vsaida_erro;
        end if;
      else
        --Bruno Sousa 15/03/2024 Alterado condição abaixo
        --IF pdt_saida_parc2 < ADD_MONTHS(pdt_fim_per_ferias, v_antecipa * -1) THEN
        IF pdt_saida_parc2 < ADD_MONTHS(pdt_inic_per_ferias, v_antecipa) THEN
          pflg_retorno := 'N';
          --pmsg_retorno := 'A data de saída deve ser maior que ' ||
          --                TO_CHAR(ADD_MONTHS(pdt_fim_per_ferias, v_antecipa * -1),
          --                        'dd/mm/rrrr') || ' !';
          pmsg_retorno := 'A data de saída deve ser maior que ' ||
                          TO_CHAR(ADD_MONTHS(pdt_inic_per_ferias,
                                             v_antecipa),
                                  'dd/mm/rrrr') || ' !';
          RAISE vsaida_erro;
        END IF;
        --
        IF v_antecipa = 0 and pdt_saida_parc2 < pdt_fim_per_ferias THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'A data de saída deve ser maior que ' ||
                          TO_CHAR(pdt_fim_per_ferias, 'dd/mm/rrrr') || ' !';
          RAISE vsaida_erro;
        END IF;
        --
        IF pdt_saida_parc2 < pdt_retorno_parc1 THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'A data de saída deve ser maior que ' ||
                          TO_CHAR(pdt_retorno_parc1, 'DD/MM/RRRR') || '!';
          RAISE vsaida_erro;
        ELSIF (pdt_saida_parc2 < TRUNC(SYSDATE + v_qtde_prog)) THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'A data de saída deve ser maior ou igual a ' ||
                          TO_CHAR(TRUNC(SYSDATE + v_qtde_prog),
                                  'DD/MM/RRRR') || '!';
          RAISE vsaida_erro;
        END IF;
      end if;
      --
      ptipo_ferias2 := 'N';
      --
      IF v_cat_13m = 'N' THEN
        popcao_13sal2 := 'N';
      END IF;
      --+
      BEGIN
        --
        SELECT I.Situacao,
               (I.dt_situacao + s.QTD_MAX_DIAS) - 1,
               (NVL(i.dt_retorno_afast, (i.dt_situacao + s.qtd_max_dias)) - 1)
          INTO vl_cod, vl_dt_situacao, vl_dt_sit_outros_afast
          FROM Informacoes_Funcionais_Cad I, SIT_FUNC S
         WHERE I.Cod_Empresa = pcod_empresa
           AND I.Matricula = pmatricula
           AND I.Situacao > '01'
           AND S.Cod = I.Situacao;
        --
        /*
                IF vl_cod = '02' AND pdt_saida_parc2 <= vl_dt_situacao THEN
                  pflg_retorno := 'N';
                  pmsg_retorno := 'Colaboradora em liçenca maternidade. A data de saída deve ser maior que ' ||
                                  vl_dt_situacao || '.';
                  RAISE vsaida_erro;
                END IF;
        */
        IF vl_cod = '02' AND pdt_saida_parc2 <= vl_dt_situacao THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Colaboradora em liçenca maternidade. Data de saída deve ser maior que ' ||
                          vl_dt_situacao || '.';
        ELSIF vl_cod > '02' AND vl_cod < '90' AND
              pdt_saida_parc2 <= vl_dt_sit_outros_afast THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Colaborador(a) em afastamento. Data de saída deve ser maior que ' ||
                          to_char(vl_dt_sit_outros_afast, 'dd/mm/yyyy') || '.';
        ELSIF vl_cod >= '90' THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Colaborador demitido !!!';
          RAISE vsaida_erro;
        END IF;
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          NULL;
      END;
      --
      OPEN c1;
      FETCH c1
        INTO v_c1;
      CLOSE c1;
      --
      BEGIN
        --
        SELECT QTDE_DIAS_CONTR_FER
          INTO QTDE_DIAS_CONTR_FER_
          FROM empresas_cad
         WHERE cod = pcod_empresa;
        --
      EXCEPTION
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Pkg_Ferias.Valida_Dt_Saida_Parc2/Vld_Segunda_Parcela - Erro: ' ||
                          SQLERRM;
          RAISE vsaida_erro;
      END;
      --
      IF pdt_saida_parc2 > (pdt_fim_per_ferias + qtde_dias_contr_fer_) /*AND v_c1.perc_dobro > 0*/
       THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A Data é Maior que ' ||
                        TO_CHAR((pdt_fim_per_ferias + qtde_dias_contr_fer_),
                                'DD/MM/YYYY') ||
                        ', a Mesma Deverá ser Paga em Dobro.';
        RAISE vsaida_erro;
      END IF;
      --
      pdt_retorno_parc2 := (pdt_saida_parc2 + pnum_dias_parc2);
      --------------------------------------------------------
      -- VERIFICA SE HA FERIAS CADASTRADAS PARA O MESMO MES --
      --------------------------------------------------------
      IF pdt_saida_parc1 = pdt_saida_parc2 THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Data de saída da 1a parcela é igual à 2a parcela!';
        RAISE vsaida_erro;
      END IF;
      --
      IF pdt_saida_parc2 < pdt_retorno_parc1 THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Saída da 2a parcela não pode ocorrer antes de ' ||
                        TO_CHAR(pdt_retorno_parc1, 'dd/mm/yyyy');
        RAISE vsaida_erro;
      END IF;
      --
      BEGIN
        --
        SELECT dt_vigencia, dt_vigencia_fim
          INTO wl_dt_ini, wl_dt_fim
          FROM HISTORICO_CADASTRAL
         WHERE (pdt_saida_parc2 >= wl_dt_ini AND
               pdt_saida_parc2 <= wl_dt_fim)
           AND cod_empresa = pcod_empresa
           AND matricula = pmatricula
           AND cod_fato = 1
           AND cod_valor_fato = '02';
        --
        IF SQL%FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Data de saída tem que ser superior ao final da data de gestação';
          RAISE vsaida_erro;
        END IF;
        --
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
      --
    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Ferias.Valida_Dt_Saida_Parc2/Vld_Segunda_Parcela - Erro: ' ||
                        SQLERRM;
    END Vld_Segunda_Parcela;
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    IF pdt_saida_parc2 IS NOT NULL AND pdt_saida_parc1 IS NULL THEN
      --
      OPEN c1;
      FETCH c1
        INTO v_c1;
      CLOSE c1;
      --
      IF v_c1.dt_saida_parc1 IS NULL THEN
        --
        pflg_retorno := 'N';
        pmsg_retorno := 'Antes de programar a 2ª parcela, a 1ª deve estar aprovada/programada!';
        RAISE vsaida_erro;
        --
      END IF;
    END IF;
    --
    BEGIN
      --
      SELECT FILIAL
        INTO VFILIAL
        FROM INFORMACOES_FUNCIONAIS_CAD
       WHERE MATRICULA = PMATRICULA
         AND COD_EMPRESA = PCOD_EMPRESA;
      --
    EXCEPTION
      WHEN OTHERS THEN
        PFLG_RETORNO := 'N';
        PMSG_RETORNO := 'Erro ao buscar filial do colaborador!';
        RAISE VSAIDA_ERRO;
    END;
    --
    Vld_Per_Meses(pcod_empresa,
                  pmatricula,
                  PDT_SAIDA_PARC2,
                  pdt_inic_per_ferias,
                  pflg_retorno,
                  pmsg_retorno);
    IF NVL(pflg_retorno, 'S') <> 'S' THEN
      RAISE vsaida_erro;
    END IF;
    --
    IF DATA_SAIDA_PARC_VALIDA(PDT_SAIDA_PARC2,
                              PCOD_EMPRESA,
                              VFILIAL,
                              PMATRICULA,
                              PFLG_RETORNO,
                              PMSG_RETORNO) = 'S' AND
       NVL(PFLG_RETORNO, 'S') = 'S' THEN
      -- Chamado 14368 28/09/2018
      --IF VALIDA_DT_SAIDA(PCOD_EMPRESA, PMATRICULA, PDT_SAIDA_PARC2, PMSG_RETORNO) = 'S' THEN
      NULL;
    ELSE
      RAISE VSAIDA_ERRO;
    END IF;
    --
    BEGIN
      --
      SELECT fer.dias_margem_ferias, nvl(fer.antecipa_parc_2, 0) -- Tratar antecipação de férias por conta do coronavírus Rodrigo 24/03/2020
        INTO vl_dias_margem_ferias, Vl_antecipa_parc_2 -- Tratar antecipação de férias por conta do coronavírus Rodrigo 24/03/2020
        FROM FERIAS_PARAMETROS fer, INF_PESSOAIS pes
       WHERE fer.cod_empresa = pcod_empresa
         AND fer.cod_empresa = pes.cod_empresa
         AND fer.cod_filial = pes.filial
         AND pes.matricula = pmatricula;
      --
    EXCEPTION
      WHEN OTHERS THEN
        vl_dias_margem_ferias := 0;
    END;
    --
  
    V_RADIO_ESTAT := ver_radio_estat(PCOD_EMPRESA, PMATRICULA);
  
    V_VINCULO := FNC_VINCULO_NOME(PCOD_EMPRESA, PMATRICULA);
  
    IF vl_dias_margem_ferias > 0 THEN
      --Alterado / Comentado Bruno Sousa 29/04/2024
      --vl_data_limite := pdt_fim_per_ferias - vl_dias_margem_ferias;
      vl_data_limite := pdt_fim_per_ferias + 1;
    END IF;
  
    IF Vl_antecipa_parc_2 > 0 THEN
      -- Tratar antecipação de férias por conta do coronavírus Rodrigo 24/03/2020
    
      Vl_lim_antecipa_parc_2 := ADD_MONTHS(pdt_inic_per_ferias,
                                           Vl_antecipa_parc_2);
      IF pdt_saida_parc2 < Vl_lim_antecipa_parc_2 AND V_RADIO_ESTAT = 'N' -- Humberto/Rodrigo 09/08/2022
       THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A data de saída informada é menor que a data de início para programação de férias! Data de início: ' ||
                        TO_CHAR(Vl_lim_antecipa_parc_2, 'dd/mm/rrrr');
        RAISE vsaida_erro;
      END IF;
    ELSIF Vl_antecipa_parc_2 = 0 AND vl_data_limite > pdt_saida_parc2 AND
          V_RADIO_ESTAT = 'N' -- Humberto/Rodrigo 09/08/2022
          AND V_VINCULO <> 'ESTAGIARIO' -- Bruno Sousa 09/04/2024
     THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'A Data de saída informada é menor que a data de início para programação de férias! Data de início: ' ||
                      TO_CHAR(Vl_Data_Limite, 'DD/MM/RRRR');
      RAISE vsaida_erro;
    ELSE
      --++30032020
      vAnos := F_Tempo(vAdmissao, 'aA mM dD hH miMI', pDt_Saida_Parc2, 'A');
    
      IF NVL(vAnos, 0) > 0 THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A data de saída informada é menor que a data de início para programação de férias! Data de início: ' ||
                        TO_CHAR(vl_data_limite, 'dd/mm/rrrr');
        RAISE vsaida_erro;
      END IF;
      --
    END IF;
    --
    vld_segunda_parcela(pcod_empresa,
                        pmatricula,
                        pdt_inic_per_ferias,
                        pdt_fim_per_ferias,
                        pdt_saida_parc1,
                        pdt_retorno_parc1,
                        --                        pnum_dias_parc2,
                        pdt_saida_parc2,
                        pdt_retorno_parc2,
                        ptipo_ferias2,
                        popcao_13sal2,
                        pdias_direito, -- Humberto/Izidoro 03/03/2016
                        pdias_abono_pec1_dsp,
                        pnum_dias_parc1_dsp,
                        pflg_retorno,
                        pmsg_retorno);
    --
    IF NVL(pflg_retorno, 'S') <> 'S' THEN
      RAISE vsaida_erro;
    END IF;
    --
    --Bruno Sousa 22/10/2024
    --Esse paramentro usado para cancelamento das férias tbm sera usado para criar as parcelas de férias
    SELECT nvl(c.QTD_MAX_DIAS_FERIAS, 0)
      INTO V_QTD_MAX_DIAS_FERIAS
      FROM PARAMETROS_RECURSOS_HUMANOS c
     WHERE c.cod_empresa = pcod_empresa;
    -- Bruno Sousa 14/01/2026
    IF pdt_saida_parc2 < TRUNC(SYSDATE) + V_QTD_MAX_DIAS_FERIAS /*AND Vl_antecipa_parc_1 > 0*/
     THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'A data de saída deverá ser solicitada com antecedência de, no mínimo, ' ||
                      V_QTD_MAX_DIAS_FERIAS ||
                      ' dias. Data permitida à partir de ' ||
                      TO_CHAR(TRUNC(SYSDATE) + V_QTD_MAX_DIAS_FERIAS,
                              'dd/mm/rrrr') || '.';
      RAISE vsaida_erro;
      -- Comentado Bruno Sousa 08/01/2026 AND Vl_antecipa_parc_1 > 0
    ELSIF pdt_saida_parc2 <
          TRUNC(pdt_retorno_parc1) + V_QTD_MAX_DIAS_FERIAS /*AND Vl_antecipa_parc_2 > 0*/
     THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'A data de saída deverá ser solicitada com antecedência de, no mínimo, ' ||
                      V_QTD_MAX_DIAS_FERIAS ||
                      ' dias. Data permitida à partir de ' ||
                      TO_CHAR(TRUNC(pdt_retorno_parc1) +
                              V_QTD_MAX_DIAS_FERIAS,
                              'dd/mm/rrrr') || '.';
      RAISE vsaida_erro;
    END IF;
  
    IF pdt_saida_parc2 IS NOT NULL THEN
      --
      popcao_13sal2 := NVL(popcao_13sal2, 'N');
      --
      /*
      P2(pnum_dias_parc1,
         pdias_abono_pec1,
         pnum_dias_parc2,
         pdias_abono_pec2,
         PSALDO,
         pflg_retorno,
         pmsg_retorno);
         */
      IF NVL(pflg_retorno, 'S') <> 'S' THEN
        RAISE vsaida_erro;
      END IF;
      --
      /*****/ -- Solicitação Rodrigo 05/08/2022 - Adicionado por Igor Sala
      prc_verif_limite_agend_ferias(pcod_empresa,
                                    pmatricula,
                                    pdt_saida_parc2,
                                    2,
                                    pdt_inic_per_ferias,
                                    pdt_fim_per_ferias,
                                    pflg_retorno,
                                    pmsg_retorno);
      IF pflg_retorno = 'N' THEN
        RAISE vsaida_erro;
      END IF;
      /*****/
      --
      BEGIN
        --
        SELECT a.filial
          INTO vfilial
          FROM informacoes_funcionais_cad a
         WHERE a.cod_empresa = pcod_empresa
           AND a.matricula = pmatricula;
        --
      EXCEPTION
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Pkg_Ferias.Valida_Dt_Saida_Parc2 - Erro ao buscar a filial do colaborador: ' ||
                          SQLERRM;
          RAISE vsaida_erro;
      END;
      --
      Bloqueia_Parc2(pcod_empresa,
                     vfilial,
                     pdt_saida_parc1,
                     pnum_dias_parc1,
                     pdias_abono_pec1,
                     pdt_fim_per_ferias,
                     psaldo,
                     pdias_direito, -- Humberto/Izidoro 03/03/2016
                     popcao_13sal2,
                     pdias_abono_pec1_dsp,
                     pnum_dias_parc1_dsp,
                     pflg_retorno,
                     pmsg_retorno);
      --
      IF NVL(pflg_retorno, 'S') <> 'S' THEN
        RAISE vsaida_erro;
      END IF;
      --
      pdt_pagto_parc2 := retorna_dt_pagto(pcod_empresa,
                                          pmatricula,
                                          pdt_saida_parc2);
      --
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Dt_Saida_Parc2 - Erro: ' ||
                      SQLERRM;
  END Valida_Dt_Saida_Parc2;
  --
  PROCEDURE Dias_Parc2(pdt_saida_parc2    FERIAS.dt_saida_parc1%TYPE,
                       pdt_fim_per_ferias FERIAS.dt_fim_per_ferias%TYPE,
                       pnum_dias_PARC1    NUMBER,
                       pnum_dias_PARC2    NUMBER,
                       pdias_abono_pec2   IN OUT FERIAS.dias_abono_pec1%TYPE,
                       pcod_empresa       empresas.cod%TYPE,
                       pmatricula         inf_pessoais.matricula%TYPE,
                       pflg_retorno       OUT VARCHAR2,
                       pmsg_retorno       OUT VARCHAR2) IS
    --
    CURSOR c1 IS
      SELECT a.qtd_parcelas,
             nvl(a.antecipa_parc_2, 0) antecipa_parc_2,
             nvl(a.valida_saldo_ferias, 'S') valida_saldo_ferias,
             a.QTDE_DIAS_DIREITO,
             a.FALTAS_FERIAS --, a.QTDE_DIAS_SEG_PERIODO
        FROM ferias_parametros a, informacoes_funcionais b
       WHERE a.cod_empresa = pcod_empresa
         AND b.cod_empresa = a.cod_empresa
         AND b.matricula = pmatricula
         AND a.cod_filial = b.filial;
    v_c1 c1%ROWTYPE;
    --
    CURSOR c2 IS
      SELECT f.dt_inic_per_ferias, f.dt_fim_per_ferias
        FROM ferias f
       WHERE f.cod_empresa = pcod_empresa
         AND f.matricula = pmatricula
         AND f.dt_fim_per_ferias = pdt_fim_per_ferias;
    v_c2 c2%ROWTYPE;
    --global_saldo NUMBER := NULL;
    v_saldo            number;
    v_jornada_reduzida REG_TRABALHO.jornada_reduzida%TYPE;
  BEGIN
    --
    BEGIN
      --
      SELECT B.JORNADA_REDUZIDA
        INTO V_JORNADA_REDUZIDA
        FROM informacoes_funcionais_cad A, REG_TRABALHO B
       WHERE A.cod_empresa = pcod_empresa
         AND A.matricula = pmatricula
         AND B.COD_EMPRESA = A.COD_EMPRESA
         AND B.COD = A.REG_TRAB;
      --
    EXCEPTION
      WHEN OTHERS THEN
        V_JORNADA_REDUZIDA := NULL;
    END;
    --insert into testex values (888,'Dias_Parc2 -> num_dias_parc1: '||NVL(pnum_dias_parc1, 0));
    --insert into testex values (888,'Dias_Parc2 -> num_dias_parc2: '||NVL(pnum_dias_parc2, 0)); commit;
  
    OPEN c1;
    FETCH c1
      INTO v_c1;
    CLOSE c1;
    pflg_retorno := 'S';
    --
    --Bruno Sousa 15/03/2024 Comentado pois precisa validar o saldo
    --IF existe_p1(NULL,pcod_empresa,pmatricula,NULL,pdt_fim_per_ferias) THEN
    IF V_C1.Valida_Saldo_Ferias = 'S' AND V_C1.ANTECIPA_PARC_2 > 0 THEN
      --global_saldo := NULL;
      --
      IF v_jornada_reduzida = 'N' THEN
        -- Humberto/Izidoro 07/03/2016: acrescentado jornada_reduzida
        --
        /*
        PFLG_RETORNO := 'N';
        PMSG_RETORNO := 'SALDO: '||psaldo||', pdt_saida_parc1: '||pdt_saida_parc1||', pdt_fim_per_ferias: '||pdt_fim_per_ferias||', pnum_dias_parc1: '||pnum_dias_parc1||', pdias_abono_pec1: '||pdias_abono_pec1;
        RAISE VSAIDA_ERRO;
        */
        begin
          OPEN c2;
          FETCH c2
            INTO v_c2;
          CLOSE c2;
        
          v_saldo := Pkg_Atlz_Saldo_Ferias.CALCULA_SALDO(COD_EMPRESA_        => pcod_empresa,
                                                         MATRICULA_          => pmatricula,
                                                         DT_INIC_            => V_C2.DT_INIC_PER_FERIAS,
                                                         DT_FIM_             => V_C2.DT_FIM_PER_FERIAS,
                                                         DT_REFERENCIA_      => pdt_saida_parc2,
                                                         V_QTDE_DIAS_DIREITO => V_C1.QTDE_DIAS_DIREITO,
                                                         V_FALTAS_FERIAS     => V_C1.FALTAS_FERIAS /*,
                                                                                                                                                                                                                                                                                                                                                                              V_QTDE_DIAS_SEG_PERIODO => V_C1.QTDE_DIAS_SEG_PERIODO*/);
        
        exception
          when others then
            v_saldo := 0;
        end;
      
        -- Em caso de antecipação de férias valida o saldo de dias que está sendo solicitado
        IF V_C1.antecipa_parc_2 > 0 AND
           NVL(pnum_dias_PARC2, 0) + NVL(pdias_abono_pec2, 0) > v_saldo THEN
          --global_saldo THEN
          --
          -- insert into testex values (888, 'num_dias_parc1: '||NVL(pnum_dias_parc1, 0)||' + dias_abono_pec1: '||NVL(pdias_abono_pec1, 0)||' > saldo: '||psaldo); commit;
        
          pflg_retorno := 'N';
          pmsg_retorno := 'A quantidade de dias da parcela não pode ser maior que ""' ||
                          (v_saldo - NVL(pnum_dias_PARC1, 0)) || '""!';
          RAISE vsaida_erro;
          --
        ELSIF NVL(pnum_dias_PARC1, 0) + NVL(pnum_dias_PARC2, 0) +
              NVL(pdias_abono_pec2, 0) <= v_saldo THEN
          --global_saldo THEN
          --
          IF v_c1.qtd_parcelas = 1 THEN
            --
          
            -- Comentado para implementar a terceira parcela com parametrizacao por empresa. Igor Cardoso  04/05/2018
            NULL;
            /*IF psaldo = 30 THEN
              IF pnum_dias_parc1 <> 20 THEN
                pflg_retorno := 'N';
                pmsg_retorno := 'O valor para este campo deve ser 20 ou 30! Saldo atual: ' ||
                                psaldo || '.';
                RAISE vsaida_erro;
              ELSIF pnum_dias_parc1 = 20 THEN
                pdias_abono_pec1 := 10;
              END IF;
            END IF;*/
            --
            /* IF psaldo = 24 THEN
              IF pnum_dias_parc1 <> 16 THEN
                pflg_retorno := 'N';
                pmsg_retorno := 'O valor para este campo deve ser 16 ou 24! Saldo atual: ' ||
                                psaldo || '.';
                RAISE vsaida_erro;
              ELSIF pnum_dias_parc1 = 16 THEN
                pdias_abono_pec1 := 8;
              END IF;
              --
            END IF;*/
            --
            /*IF psaldo = 18 THEN
              IF pnum_dias_parc1 <> 12 THEN
                pflg_retorno := 'N';
                pmsg_retorno := 'O valor para este campo deve ser 12 ou 18! Saldo atual: ' ||
                                psaldo || '.';
                RAISE vsaida_erro;
              ELSIF pnum_dias_parc1 = 12 THEN
                pdias_abono_pec1 := 6;
              END IF;
            END IF;*/
            --
            /*IF psaldo = 12 THEN
              IF pnum_dias_parc1 <> 8 THEN
                pflg_retorno := 'N';
                pmsg_retorno := 'O valor para este campo deve ser 8 ou 12! Saldo atual: ' ||
                                psaldo || '.';
                RAISE vsaida_erro;
              ELSIF pnum_dias_parc1 = 8 THEN
                pdias_abono_pec1 := 4;
              END IF;
            END IF;*/
            --
            /*IF psaldo = 0 THEN
              IF pnum_dias_parc1 <> 0 THEN
                pflg_retorno     := 'N';
                pmsg_retorno     := 'O valor para este campo deve ser 0! Saldo atual: ' ||psaldo || '.';
                pdias_abono_pec1 := 0;
                RAISE vsaida_erro;
              END IF;
            END IF;*/
          
          ELSIF v_c1.qtd_parcelas >= 2 THEN
            --
            -- Comentado para implementar a terceira parcela com parametrizacao por empresa. Igor Cardoso  04/05/2018
            NULL;
            /*
            if psaldo = 30
            and pnum_dias_parc1 not in(30, 15, 20, 10) then
               pflg_retorno := 'N';
               pmsg_retorno := 'Só é permitido informar: 10, 20, 15, ou 30 dias!';
               raise vsaida_erro;
            end if;
            */
            --
          END IF;
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
      pmsg_retorno := 'Pkg_Ferias.Dias_Parc1 - Erro: ' || SQLERRM;
  END Dias_Parc2;
  --
  PROCEDURE Valida_Num_Dias_Parc2(pcod_empresa             EMPRESAS.cod%TYPE,
                                  pmatricula               INF_PESSOAIS.matricula%TYPE,
                                  pnum_dias_parc1          NUMBER,
                                  pdias_abono_pec1         FERIAS.dias_abono_pec1%TYPE,
                                  pdt_saida_parc2          FERIAS.dt_saida_parc2%TYPE,
                                  pdt_inic_per_ferias      FERIAS.dt_inic_per_ferias%TYPE,
                                  pdt_fim_per_ferias       FERIAS.dt_fim_per_ferias%TYPE,
                                  pdias_descanso_adicional FERIAS.dias_descanso_adicional%TYPE,
                                  pdias_abono_pec2         IN OUT FERIAS.dias_abono_pec2%TYPE,
                                  ptipo_ferias2            IN OUT FERIAS.tipo_ferias2%TYPE,
                                  pdesc_adicional1         IN OUT FERIAS.desc_adicional1%TYPE,
                                  pdesc_adicional2         IN OUT FERIAS.desc_adicional2%TYPE,
                                  pnum_dias_parc2          FERIAS.num_dias_parc2%TYPE,
                                  pdt_retorno_parc2        IN OUT FERIAS.dt_retorno_parc2%TYPE,
                                  pdias_direito            NUMBER,
                                  --                                  pnum_dias_parc4          FERIAS.num_dias_parc4%TYPE,
                                  pusuario     VARCHAR2,
                                  pflg_retorno IN OUT VARCHAR2,
                                  pmsg_retorno IN OUT VARCHAR2) IS
    --
    vfilial         INFORMACOES_FUNCIONAIS.filial%TYPE;
    v_qtde_min_dias FERIAS_PARAMETROS.qtde_minimo_dias%TYPE DEFAULT 0;
    --v_qtde_tot_dias  ferias.saldo%TYPE DEFAULT 0;
  
    abono_ferias   VARCHAR2(1);
    v_qtd_parcelas ferias_parametros.qtd_parcelas%TYPE DEFAULT 0;
    -- disponivel number;
    --v_jornada_reduzida REG_TRABALHO.jornada_reduzida%TYPE;
    --v_saldo         ferias.saldo%TYPE;
    vdisponivel_aux NUMBER := 0;
    --
    CURSOR c1 IS
      SELECT dt_saida_parc1,
             sit_requisicao,
             num_dias_parc1,
             desc_adicional1,
             ind_situacao_periodo
        FROM REQUISICAO_FERIAS
       WHERE cod_empresa = pcod_empresa
         AND matricula = pmatricula
         AND dt_saida_parc1 < pdt_saida_parc2
         AND dt_saida_parc2 IS NULL
         AND sit_requisicao = '5' -- aprovada
         AND DT_INIC_PER_FERIAS = pdt_inic_per_ferias
         AND DT_FIM_PER_FERIAS = pdt_fim_per_Ferias;
    --
    v_c1 c1%ROWTYPE;
    --
    CURSOR c2 IS
      SELECT *
        FROM ferias
       WHERE dt_inic_per_ferias = pdt_inic_per_ferias
         AND matricula = pmatricula
         AND cod_empresa = pcod_empresa;
    v_c2 c2%ROWTYPE;
    --
    PROCEDURE PRC_USUARIO_FERIAS(TIPO NUMBER, Usuario VARCHAR2) IS
    BEGIN
      NULL;
      /* ???????????????
      IF TIPO = 1 THEN
          UPDATE FERIAS
          SET USUARIO_PROG = Usuario
              ,DT_ATUALIZACAO_PROG = SYSDATE
           WHERE COD_EMPRESA         = PCOD_EMPRESA
             AND MATRICULA           = PMATRICULA
             AND DT_INIC_PER_FERIAS  = PDT_INIC_PER_FERIAS
             AND DT_FIM_PER_FERIAS   = PDT_FIM_PER_FERIAS;
      ELSIF TIPO = 2 THEN
           UPDATE FERIAS
          SET USUARIO_PROG2 = Usuario
              ,DT_ATUALIZACAO_PROG2 = SYSDATE
           WHERE COD_EMPRESA       = PCOD_EMPRESA
             AND MATRICULA           = PMATRICULA
             AND DT_INIC_PER_FERIAS  = PDT_INIC_PER_FERIAS
             AND DT_FIM_PER_FERIAS   = PDT_FIM_PER_FERIAS;
      
      ELSIF TIPO = 3 THEN
        UPDATE FERIAS
          SET USUARIO_PROG_COL = Usuario
              ,DT_ATUALIZACAO_PROG_COL = SYSDATE
           WHERE COD_EMPRESA       = PCOD_EMPRESA
             AND MATRICULA           = PMATRICULA
             AND DT_INIC_PER_FERIAS  = PDT_INIC_PER_FERIAS
             AND DT_FIM_PER_FERIAS   = PDT_FIM_PER_FERIAS;
      
      ELSIF TIPO = 4 THEN
        UPDATE FERIAS
          SET USUARIO_PROG4 = Usuario
              ,DT_ATUALIZACAO_PROG4 = SYSDATE
           WHERE COD_EMPRESA       = PCOD_EMPRESA
             AND MATRICULA           = PMATRICULA
             AND DT_INIC_PER_FERIAS  = PDT_INIC_PER_FERIAS
             AND DT_FIM_PER_FERIAS   = PDT_FIM_PER_FERIAS;
      
      END IF;
      */
    EXCEPTION
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Erro ao Atualizar tabela de Férias: ' || SQLERRM;
        RAISE vsaida_erro;
    END prc_usuario_ferias;
    --
    PROCEDURE Vld_Bonus_Ferias2(pcod_empresa             EMPRESAS.cod%TYPE,
                                pmatricula               INF_PESSOAIS.matricula%TYPE,
                                pdias_descanso_adicional FERIAS.dias_descanso_adicional%TYPE,
                                pdesc_adicional1         IN OUT FERIAS.desc_adicional1%TYPE,
                                pnum_dias_parc2          FERIAS.num_dias_parc2%TYPE,
                                pdesc_adicional2         IN OUT FERIAS.desc_adicional2%TYPE,
                                pflg_retorno             IN OUT VARCHAR2,
                                pmsg_retorno             IN OUT VARCHAR2) IS
      --
      vl_abono_ferias    FERIAS_PARAMETROS.abono_ferias%TYPE;
      vl_num_dias_parc2  FERIAS.num_dias_parc1%TYPE;
      vl_desc_adicional2 FERIAS.desc_adicional1%TYPE;
      vl_dias_comparar   NUMBER(2) := 0;
      --
    BEGIN
      --
      pflg_retorno := 'S';
      --
      BEGIN
        --
        SELECT abono_ferias
          INTO vl_abono_ferias
          FROM FERIAS_PARAMETROS
         WHERE cod_empresa = pcod_empresa
           AND cod_filial = vfilial;
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          vl_abono_ferias := 0;
        WHEN TOO_MANY_ROWS THEN
          vl_abono_ferias := 0;
      END;
      --
      IF vl_abono_ferias = 1 THEN
        --
        BEGIN
          --
          SELECT DISTINCT prfer.dias_descanso, prfer.desc_adicional
            INTO vl_num_dias_parc2, vl_desc_adicional2
            FROM PARAM_REGRA_FERIAS         prfer,
                 CATEGORIA_FERIAS           cfer,
                 REGRA_FERIAS               rfer,
                 CATEG_FERIAS_X_CCUSTO      ctgf,
                 informacoes_funcionais_cad FUNC,
                 CARGOS                     crga
           WHERE rfer.id_regra_ferias = cfer.id_regra_ferias
             AND rfer.id_regra_ferias = prfer.id_regra_ferias
             AND cfer.id_categoria_ferias = ctgf.id_categoria_ferias(+)
             AND FUNC.matricula = pmatricula
             AND FUNC.cargo = crga.cod
             AND prfer.desc_adicional <=
                 (pdias_descanso_adicional + NVL(pdesc_adicional1, 0))
             AND crga.CLASS_CARGO = cfer.cod_class_cargo
             AND prfer.dias_descanso = pnum_dias_parc2;
          --
          --          pnum_dias_parc2  := vl_num_dias_parc2;
          pdesc_adicional2 := vl_desc_adicional2;
          --
        EXCEPTION
          WHEN TOO_MANY_ROWS THEN
            BEGIN
              --
              IF pdias_descanso_adicional = 12 THEN
                vl_dias_comparar := 11;
              ELSIF pdias_descanso_adicional = 5 THEN
                vl_dias_comparar := 4;
              END IF;
              --
              SELECT DISTINCT prfer.dias_descanso, prfer.desc_adicional
                INTO vl_num_dias_parc2, vl_desc_adicional2
                FROM PARAM_REGRA_FERIAS         prfer,
                     CATEGORIA_FERIAS           cfer,
                     REGRA_FERIAS               rfer,
                     CATEG_FERIAS_X_CCUSTO      ctgf,
                     informacoes_funcionais_cad FUNC,
                     CARGOS                     crga
               WHERE rfer.id_regra_ferias = cfer.id_regra_ferias
                 AND rfer.id_regra_ferias = prfer.id_regra_ferias
                 AND cfer.id_categoria_ferias = ctgf.id_categoria_ferias(+)
                 AND FUNC.matricula = pmatricula
                 AND FUNC.cargo = crga.cod
                 AND prfer.desc_adicional = vl_dias_comparar
                 AND crga.CLASS_CARGO = cfer.cod_class_cargo
                 AND prfer.dias_descanso = pnum_dias_parc2;
              --
              --              pnum_dias_parc2  := vl_num_dias_parc2;
              pdesc_adicional2 := vl_desc_adicional2;
              --
            EXCEPTION
              WHEN NO_DATA_FOUND THEN
              
                BEGIN
                  SELECT DISTINCT prfer.dias_descanso, prfer.desc_adicional
                    INTO vl_num_dias_parc2, vl_desc_adicional2
                    FROM param_regra_ferias     prfer,
                         categoria_ferias       cfer,
                         regra_ferias           rfer,
                         informacoes_funcionais func,
                         cargos                 crga
                   WHERE rfer.id_regra_ferias = cfer.id_regra_ferias
                     AND rfer.id_regra_ferias = prfer.id_regra_ferias
                     AND func.matricula = pmatricula
                     AND FUNC.cargo = crga.cod
                     AND crga.class_cargo = cfer.cod_class_cargo
                     AND prfer.dias_descanso = pnum_dias_parc2
                     AND prfer.desc_adicional <= (pdias_descanso_adicional +
                         NVL(pdesc_adicional1, 0))
                     AND cfer.id_categoria_ferias NOT IN
                         (SELECT ctgf.id_categoria_ferias
                            FROM categ_ferias_x_ccusto ctgf
                           WHERE ctgf.id_categoria_ferias =
                                 cfer.id_categoria_ferias);
                EXCEPTION
                  WHEN NO_DATA_FOUND THEN
                  
                    --vl_num_dias_parc2  := 0;
                    --vl_desc_adicional2 := 0;
                    pdesc_adicional1 := 0;
                  WHEN TOO_MANY_ROWS THEN
                    NULL;
                    --vl_num_dias_parc2  := 0;
                  --vl_desc_adicional2 := 0;
                END;
              
            END;
          
        END;
        --
      END IF;
      --
      IF (NVL(pdesc_adicional2, 0) > 0) THEN
        pdesc_adicional2 := pdias_descanso_adicional - pdesc_adicional1;
      END IF;
      --
    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Ferias.Vld_Bonus_Ferias2 - Erro: ' || SQLERRM;
    END Vld_Bonus_Ferias2;
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    OPEN c2;
    FETCH c2
      INTO v_c2;
    CLOSE c2;
    --
    BEGIN
      --
      SELECT filial
        INTO vfilial
        FROM informacoes_funcionais_cad
       WHERE cod_empresa = pcod_empresa
         AND matricula = pmatricula;
      --
    EXCEPTION
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Ferias.Vld_Bonus_Ferias2 - Erro ao buscar filial: ' ||
                        SQLERRM;
        RAISE vsaida_erro;
    END;
    --
    IF NOT funcFeriasParamParcela_Apex(pcod_empresa,
                                       vfilial,
                                       pnum_dias_parc1,
                                       pnum_dias_parc2,
                                       NULL /*pnum_dias_parc4*/) THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'P2 - Quantidade de dias não encontrada na parametrização, favor alterar.';
      RAISE vsaida_erro;
    END IF;
  
    PRC_USUARIO_FERIAS(2, pusuario);
  
    BEGIN
      SELECT fer.qtde_minimo_dias
        INTO v_qtde_min_dias
        FROM ferias_parametros fer, inf_pessoais inf
       WHERE inf.cod_empresa = fer.cod_empresa
         AND inf.cod_empresa = pcod_empresa
         AND inf.matricula = pmatricula
         AND inf.filial = fer.cod_filial;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        v_qtde_min_dias := 0;
      WHEN OTHERS THEN
        v_qtde_min_dias := 0;
    END;
  
    --v_qtde_tot_dias := NVL(pnum_dias_parc2,0);-- + nvl(:ferias.dias_abono_pec2,0);
  
    IF NVL(pnum_dias_parc2, 0) = 0 AND NVL(pDIAS_ABONO_PEC2, 0) = 0 THEN
      ptipo_ferias2 := NULL;
    ELSE
      ptipo_ferias2 := 'N';
    END IF;
  
    --
    -- Validação dos dias de férias, a pedido de Ana Camillo e Alex Yamada,
    -- passou a considerar sempre 30 dias como saldo de férias, independente
    -- de quantos dias o funcionário possua para gozo de férias
    --
    IF pnum_dias_parc2 IS NOT NULL THEN
      --
      OPEN c1;
      FETCH c1
        INTO v_C1;
      CLOSE c1;
      --
      BEGIN
        BEGIN
          SELECT fer.qtde_minimo_dias
            INTO v_qtde_min_dias
            FROM FERIAS_PARAMETROS fer, inf_pessoais_cad inf
           WHERE inf.cod_empresa = fer.cod_empresa
             AND inf.cod_empresa = pcod_empresa
             AND inf.matricula = pmatricula
             AND inf.filial = fer.cod_filial;
        
        EXCEPTION
          WHEN NO_DATA_FOUND THEN
            v_qtde_min_dias := 0;
          WHEN OTHERS THEN
            v_qtde_min_dias := 0;
        END;
        --
        DECLARE
          disponivel NUMBER;
        BEGIN
        
          BEGIN
            SELECT a.qtd_parcelas
              INTO v_qtd_parcelas
              FROM ferias_parametros a
             WHERE a.cod_empresa = pcod_empresa
               AND a.cod_filial IN
                   (SELECT x.filial
                      FROM informacoes_funcionais x
                     WHERE x.cod_empresa = pcod_empresa
                       AND x.matricula = pmatricula);
          EXCEPTION
            WHEN OTHERS THEN
              v_qtd_parcelas := 2;
          END;
        
          IF pdt_saida_parc2 IS NOT NULL THEN
            -- Humberto/Izidoro 20/02/2014
            vdisponivel_aux := pdias_direito - NVL(pdias_abono_pec2, 0);
            --IF NVL(v_c2.ind_situacao_parc_1,'P') <> 'C' THEN -- Comentado Robson/Rodrigo em 25/11/2022
            vdisponivel_aux := vdisponivel_aux - (NVL(pnum_dias_parc1, 0) +
                               NVL(pdias_abono_pec1, 0));
            --END IF;
            -- Humberto/Izidoro 29/09/2014p Alterado de 30 para dias_direito
            IF pnum_dias_parc2 > vdisponivel_aux THEN
              -- Humberto/Izidoro 29/09/2014p Alterado de 30 para pdias_direito
              disponivel   := vdisponivel_aux;
              pflg_retorno := 'N';
              pmsg_retorno := 'Número de dias de Férias maior que ' ||
                              TO_CHAR(disponivel) || '. Favor corrigir.';
              RAISE vsaida_erro;
            ELSIF pnum_dias_parc2 < vdisponivel_aux THEN
            
              IF v_qtd_parcelas = 2 THEN
                disponivel   := vdisponivel_aux;
                pflg_retorno := 'N';
                pmsg_retorno := 'Número de dias de Férias menor que ' ||
                                TO_CHAR(disponivel) || '. Favor corrigir.';
                RAISE vsaida_erro;
              END IF;
            
            END IF;
          END IF;
        END;
        --
      
        /*
        BEGIN
          --
          SELECT NVL(fil.pagto_abono_ferias, 'N'), reg.jornada_reduzida, fer.saldo
            INTO abono_ferias, v_jornada_reduzida, v_saldo
            FROM informacoes_funcionais_cad inf,
                 FERIAS                     fer,
                 filiais_cad                fil,
                 REG_TRABALHO reg
           WHERE fil.cod_empresa = pcod_empresa
             AND fer.cod_empresa = fil.cod_empresa
             AND fer.matricula = Pmatricula
             AND fer.dt_inic_per_ferias = pdt_inic_per_ferias
             AND fer.dt_fim_per_ferias = pdt_fim_per_ferias
             AND inf.cod_empresa = fil.cod_empresa
             AND inf.filial = fil.cod_filial
             AND inf.matricula = fer.matricula
             AND reg.cod_empresa = inf.cod_empresa
             AND reg.cod         = inf.reg_trab;
          --
          IF (NVL(abono_ferias, 'N') = 'N' AND NVL(pnum_dias_parc2, 0) = 0) THEN
            pflg_retorno := 'N';
            pmsg_retorno := 'Informe a quantidade de dias para gozo de férias.';
            RAISE vsaida_erro;
          ELSIF (nvl(pnum_dias_parc2,0) > v_saldo) THEN
            pflg_retorno := 'N';
            pmsg_retorno := 'A quantidade de dias de férias não pode exceder o disponível de ' ||
                            LPAD(v_saldo, 2, 0) || ' dias!';
            RAISE vsaida_erro;
          ELSE
            IF NVL(pnum_dias_parc2, 0) <> 0 THEN
              IF (NVL(pnum_dias_parc2, 0) < NVL(v_qtde_min_dias, 0))
              AND v_jornada_reduzida = 'N' -- Humberto/Izidoro 03/03/2016: acrescentado este and
               THEN
                pflg_retorno := 'N';
                pmsg_retorno := 'Número de dias de férias deve ser maior ou igual ao mínimo permitido de ' ||
                                LPAD(v_qtde_min_dias, 2, 0) || ' dias!';
                RAISE vsaida_erro;
              END IF;
            END IF;
          END IF;
        END;
        */
      
      END;
      --
      IF NVL(pnum_dias_parc2, 0) = 0 AND NVL(pDIAS_ABONO_PEC2, 0) = 0 THEN
        ptipo_ferias2 := NULL;
      ELSE
        ptipo_ferias2 := 'N';
      END IF;
      --
      /* BEGIN
      
        disponivel := 30 -
                      (NVL(NVL(pnum_dias_parc1, v_c1.num_dias_parc1), 0) +
                      NVL(pdias_abono_pec1, 0) + NVL(pdias_abono_pec2, 0));
      
        IF (pnum_dias_parc2 > disponivel) THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'A quantidade de dias de férias não pode exceder o disponível de ' ||
                          LPAD(disponivel, 2, 0) || ' dias!';
          RAISE vsaida_erro;
        END IF;
      END;
      */
      --
      IF pnum_dias_parc2 = 0 THEN
        pdesc_adicional2 := 0;
      END IF;
    
      IF NVL(pdias_descanso_adicional, 0) > 0 THEN
        --
        Vld_Bonus_Ferias2(pcod_empresa,
                          pmatricula,
                          pdias_descanso_adicional,
                          pdesc_adicional1,
                          pnum_dias_parc2,
                          pdesc_adicional2,
                          pflg_retorno,
                          pmsg_retorno);
        --
        IF NVL(pflg_retorno, 'S') <> 'S' THEN
          RAISE vsaida_erro;
        END IF;
        --
      END IF;
      --
      pdt_retorno_parc2 := (pdt_saida_parc2 + NVL(pnum_dias_parc2, 0) +
                           NVL(NVL(pdesc_adicional1, v_c1.desc_adicional1),
                                0));
      --
    
      --
    END IF;
    --
    /*In/Out    if pdt_saida_parc2 is not null then
      P2(pnum_dias_parc1,
         pdias_abono_pec1,
         pnum_dias_parc2,
         pdias_abono_pec2,
         pflg_retorno,
         pmsg_retorno);
      if nvl(pflg_retorno, 'S') <> 'S' then
        raise vsaida_erro;
      end if;
    end if;*/
    --
  
    DECLARE
    
      v_qtde_min_dias FERIAS.NUM_DIAS_PARC1%TYPE;
    BEGIN
    
      BEGIN
        SELECT fer.qtde_minimo_dias
          INTO v_qtde_min_dias
          FROM ferias_parametros fer, inf_pessoais inf
         WHERE inf.cod_empresa = fer.cod_empresa
           AND inf.cod_empresa = pcod_empresa
           AND inf.matricula = pmatricula
           AND inf.filial = fer.cod_filial;
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          v_qtde_min_dias := 0;
        WHEN OTHERS THEN
          v_qtde_min_dias := 0;
      END;
    
      IF NVL(pnum_dias_parc2, 0) < NVL(v_qtde_min_dias, 0) AND
         pdias_direito >= 30 THEN
        -- Humberto/Izidoro 29/09/2014: Acrescentado dias_direito >= 30
        pflg_retorno := 'N';
        pmsg_retorno := 'Mínimo de dias do Parâmetro de Férias, é maior que o informado. Verifique Parâmetros de Férias da Filial desse funcionário.';
        RAISE vsaida_erro;
      END IF;
    
    END;
  
    IF pnum_dias_parc2 = 0 THEN
      pdesc_adicional2 := 0;
    END IF;
  
    Dias_Parc2(pdt_saida_parc2,
               pdt_fim_per_ferias,
               pnum_dias_parc1,
               pnum_dias_parc2,
               pdias_abono_pec2,
               pcod_empresa,
               pmatricula,
               pflg_retorno,
               pmsg_retorno);
    --
    IF pflg_retorno = 'N' THEN
      RAISE vsaida_erro;
    END IF;
  
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Num_Dias_Parc2 - Erro: ' ||
                      SQLERRM;
  END Valida_Num_Dias_Parc2;
  --
  PROCEDURE Valida_Abono_Pec2(pcod_empresa          FERIAS.cod_empresa%TYPE,
                              pmatricula            INF_PESSOAIS.matricula%TYPE,
                              pdt_inic_per_ferias   FERIAS.dt_inic_per_ferias%TYPE,
                              pdt_fim_per_ferias    FERIAS.dt_fim_per_ferias%TYPE,
                              pind_situacao_periodo ferias.ind_situacao_periodo%TYPE,
                              pdias_direito         NUMBER,
                              pnum_dias_parc1       NUMBER,
                              pdias_abono_pec1      FERIAS.dias_abono_pec1%TYPE,
                              pdt_saida_parc2       FERIAS.dt_saida_parc2%TYPE,
                              pnum_dias_parc2       FERIAS.num_dias_parc2%TYPE,
                              pdesc_adicional2      FERIAS.desc_adicional2%TYPE,
                              pdias_abono_pec2      FERIAS.dias_abono_pec2%TYPE,
                              popcao_abono_pec2     IN OUT FERIAS.opcao_abono_pec2%TYPE,
                              pdt_retorno_parc2     IN OUT FERIAS.dt_retorno_parc2%TYPE,
                              pflg_retorno          IN OUT VARCHAR2,
                              pmsg_retorno          IN OUT VARCHAR2) IS
    --
    abono_ferias   VARCHAR2(1);
    v_qtd_parcelas ferias_parametros.qtd_parcelas%TYPE;
    disponivel     NUMBER;
    --v_qtde_min_dias PLS_INTEGER := 0;
    --
    CURSOR c1 IS
      SELECT a.dt_saida_parc1,
             a.sit_requisicao,
             a.num_dias_parc1,
             a.dias_abono_pec1
        FROM REQUISICAO_FERIAS a
       WHERE a.cod_empresa = pcod_empresa
         AND a.matricula = pmatricula
         AND a.dt_saida_parc1 < pdt_saida_parc2
         AND a.dt_saida_parc2 IS NULL
         AND a.sit_requisicao IN ('1', '2', '5')
         AND a.dt_inic_per_ferias = pdt_inic_per_ferias
         AND a.dt_fim_per_ferias = pdt_fim_per_ferias
      UNION
      SELECT a.dt_saida_parc1,
             '5' sit_requisicao,
             a.num_dias_parc1,
             a.dias_abono_pec1
        FROM FERIAS a
       WHERE a.cod_empresa = pcod_empresa
         AND a.matricula = pmatricula
         AND a.dt_saida_parc1 < pdt_saida_parc2
         AND a.dt_saida_parc2 IS NULL
         AND a.dt_inic_per_ferias = pdt_inic_per_ferias
         AND a.dt_fim_per_ferias = pdt_fim_per_ferias
         AND NOT EXISTS
       (SELECT 1
                FROM REQUISICAO_FERIAS x
               WHERE x.cod_empresa = a.cod_empresa
                 AND x.matricula = a.matricula
                 AND x.dt_saida_parc1 IS NOT NULL
                 AND x.dt_inic_per_ferias = a.dt_inic_per_ferias
                 AND x.dt_fim_per_ferias = a.dt_fim_per_ferias
                 AND x.sit_requisicao IN ('1', '2', '5'))
       ORDER BY 1 DESC;
    --
    v_c1 c1%ROWTYPE;
    --
    v_jornada_reduzida REG_TRABALHO.jornada_reduzida%TYPE;
  BEGIN
    --
    pflg_retorno := 'S';
    --
    IF pdias_abono_pec2 IS NOT NULL THEN
      --
      SELECT NVL(fil.pagto_abono_ferias, 'N'), reg.jornada_reduzida
        INTO abono_ferias, v_jornada_reduzida
        FROM informacoes_funcionais_cad inf,
             FERIAS                     fer,
             filiais_cad                fil,
             REG_TRABALHO               reg
       WHERE fil.cod_empresa = pcod_empresa
         AND fer.cod_empresa = fil.cod_empresa
         AND fer.matricula = pmatricula
         AND fer.dt_inic_per_ferias = pdt_inic_per_ferias
         AND fer.dt_fim_per_ferias = pdt_fim_per_ferias
         AND inf.cod_empresa = fil.cod_empresa
         AND inf.filial = fil.cod_filial
         AND inf.matricula = fer.matricula
         AND reg.cod_empresa = inf.cod_empresa
         AND reg.cod = inf.reg_trab;
      --
      IF NVL(abono_ferias, 'N') = 'N' THEN
        --
        IF NVL(pdias_abono_pec2, 0) > 0 THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Este colaborador não pode receber dias de abono, conforme dados parametrizados na filial.';
          RAISE vsaida_erro;
        END IF;
        --
      END IF;
      --
      /*In/Out
        if nvl(pdias_abono_pec2, '-1') = '-1' then
        pdias_abono_pec2 := 0;
      end if;*/
      --
      IF NVL(NVL(pdias_abono_pec1, v_c1.dias_abono_pec1), 0) > 0 AND
         NVL(pdias_abono_pec2, 0) > 0 AND NVL(pnum_dias_parc2, 0) = 0 THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A programação do abono para este colaborador já foi efetuada no primeiro período!';
        RAISE vsaida_erro;
      ELSE
      
        OPEN c1;
        FETCH c1
          INTO v_c1;
        CLOSE c1;
      
        DECLARE
          v_qtd_parcelas ferias_parametros.qtd_parcelas%TYPE;
          disponivel     NUMBER;
        
        BEGIN
          BEGIN
            SELECT a.qtd_parcelas
              INTO v_qtd_parcelas
              FROM ferias_parametros a
             WHERE a.cod_empresa = pcod_empresa
               AND a.cod_filial IN
                   (SELECT x.filial
                      FROM informacoes_funcionais x
                     WHERE x.cod_empresa = pcod_empresa
                       AND x.matricula = pmatricula);
          EXCEPTION
            WHEN OTHERS THEN
              v_qtd_parcelas := 2;
          END;
        
          IF pdt_saida_parc2 IS NOT NULL THEN
            IF v_qtd_parcelas = 2 THEN
              IF pind_situacao_periodo <> 'R' THEN
                -- Humberto/Izidoro 29/09/2014: alterado de 30 para dias_direito
                IF pdias_abono_pec2 >
                   pdias_direito -
                   (NVL(pnum_dias_parc1, 0) + NVL(pdias_abono_pec1, 0) +
                   NVL(pnum_dias_parc2, 0)) THEN
                
                  -- Humberto/Izidoro 29/09/2014: alterado de 30 para dias_direito
                  disponivel := pdias_direito - (NVL(pnum_dias_parc1, 0) +
                                NVL(pdias_abono_pec1, 0) +
                                NVL(pnum_dias_parc2, 0));
                
                  pflg_retorno := 'N';
                  pmsg_retorno := 'Dias de Abono maior que ' ||
                                  TO_CHAR(disponivel) ||
                                  '. Favor corrigir.';
                  RAISE vsaida_erro;
                
                ELSIF pdias_abono_pec2 <
                      pdias_direito -
                      (NVL(pnum_dias_parc1, 0) + NVL(pdias_abono_pec1, 0) +
                      NVL(pnum_dias_parc2, 0)) THEN
                  -- Humberto/Izidoro 29/09/2014: alterado de 30 para dias_direito
                  disponivel := pdias_direito - (NVL(pnum_dias_parc1, 0) +
                                NVL(pdias_abono_pec1, 0) +
                                NVL(pnum_dias_parc2, 0));
                
                  pflg_retorno := 'N';
                  pmsg_retorno := 'Dias de Abono menor que ' ||
                                  TO_CHAR(disponivel) ||
                                  '. Favor corrigir.';
                  RAISE vsaida_erro;
                
                END IF;
              ELSE
                -- Humberto/Izidoro 29/09/2014: alterado de 30 para dias_direito
                IF pdias_direito -
                   (NVL(pnum_dias_parc2, 0) + NVL(pdias_abono_pec2, 0)) > 0 THEN
                
                  -- Humberto/Izidoro 29/09/2014: alterado de 30 para dias_direito
                  disponivel := pdias_direito - (NVL(pnum_dias_parc2, 0) +
                                NVL(pdias_abono_pec2, 0));
                
                  pflg_retorno := 'N';
                  pmsg_retorno := 'Dias de Abono maior que ' ||
                                  TO_CHAR(disponivel) ||
                                  '. Favor corrigir.';
                  RAISE vsaida_erro;
                
                ELSIF pdias_direito -
                      (NVL(pnum_dias_parc2, 0) + NVL(pdias_abono_pec2, 0)) < 0 THEN
                
                  -- Humberto/Izidoro 29/09/2014: alterado de 30 para dias_direito
                  disponivel := pdias_direito - (NVL(pnum_dias_parc2, 0) +
                                NVL(pdias_abono_pec2, 0));
                
                  pflg_retorno := 'N';
                  pmsg_retorno := 'Dias de Abono menor que ' ||
                                  TO_CHAR(disponivel) ||
                                  '. Favor corrigir.';
                  RAISE vsaida_erro;
                
                END IF;
              END IF;
            END IF;
          END IF;
        
        END;
      
        --
        pdt_retorno_parc2 := pdt_saida_parc2 + NVL(pnum_dias_parc2, 0) +
                             NVL(pdesc_adicional2, 0);
      
      END IF;
    
    END IF;
  
    IF NVL(pdias_abono_pec2, 0) = 0 THEN
      popcao_abono_pec2 := 'N';
    ELSIF NVL(pdias_abono_pec2, 0) > 0 THEN
      popcao_abono_pec2 := 'S';
    END IF;
  
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Abono_Pec2 - Erro: ' || SQLERRM;
  END Valida_Abono_Pec2;
  --
  PROCEDURE Valida_Opcao_13Sal2(pcod_empresa      EMPRESAS.cod%TYPE,
                                pmatricula        INF_PESSOAIS.matricula%TYPE,
                                popcao_13sal1     FERIAS.opcao_13sal1%TYPE,
                                pdt_saida_parc1   FERIAS.dt_saida_parc1%TYPE,
                                popcao_13sal2     FERIAS.opcao_13sal2%TYPE,
                                pdt_saida_parc2   FERIAS.dt_saida_parc2%TYPE,
                                pdt_retorno_parc2 FERIAS.dt_retorno_parc2%TYPE,
                                PCOD_SOLICITACAO  FERIAS.COD_SOLICITACAO%TYPE,
                                pflg_retorno      IN OUT VARCHAR2,
                                pmsg_retorno      IN OUT VARCHAR2) IS
  
    --
    CURSOR c0 IS
      SELECT a.filial, a.num_sind_diss
        FROM INFORMACOES_FUNCIONAIS a
       WHERE a.cod_empresa = pcod_empresa
         AND a.matricula = pmatricula;
    --
    v_c0 c0%ROWTYPE;
    --
    CURSOR c1(p_filial NUMBER) IS
      SELECT a.mes01,
             a.mes02,
             a.mes03,
             a.mes04,
             a.mes05,
             a.mes06,
             a.mes07,
             a.mes08,
             a.mes09,
             a.mes10,
             a.mes11,
             a.mes12
        FROM FER_MES_SEM_13SAL a
       WHERE a.cod_empresa = pcod_empresa
         AND a.cod_filial = p_filial;
    --
    v_c1 c1%ROWTYPE;
    ------------------------------------------------------------------------------------------------------------
    -- Humberto/Rodrigo 27/08/2021
    CURSOR c1b(p_sindicato NUMBER) IS
      SELECT a.mes01,
             a.mes02,
             a.mes03,
             a.mes04,
             a.mes05,
             a.mes06,
             a.mes07,
             a.mes08,
             a.mes09,
             a.mes10,
             a.mes11,
             a.mes12
        FROM FER_MES_SEM_13SAL_sind a
       WHERE a.cod_empresa = pcod_empresa
         AND a.cod_sindicato = p_sindicato;
    --
    v_c1b c1b%ROWTYPE;
    ------------------------------------------------------------------------------------------------------------
    PROCEDURE valida_13sal_ano_parc2(pcod_empresa     EMPRESAS.cod%TYPE,
                                     pmatricula       INF_PESSOAIS.matricula%TYPE,
                                     pdt_saida_parc2  FERIAS.dt_saida_parc2%TYPE,
                                     PCOD_SOLICITACAO FERIAS.COD_SOLICITACAO%TYPE,
                                     pflg_retorno     IN OUT VARCHAR2,
                                     pmsg_retorno     IN OUT VARCHAR2) IS
      --
      v_cat_13m      FERIAS_PARAMETROS.cat_13m%TYPE DEFAULT 'N';
      v_cat_13h      FERIAS_PARAMETROS.cat_13h%TYPE DEFAULT 'N';
      v_tipo_salario FERIAS_PARAMETROS.cat_13h%TYPE DEFAULT 'N';
      vl_valida_13   NUMBER(1) := 0;
      --
    BEGIN
      --
      pflg_retorno := 'S';
      --
      BEGIN
        --Bruno Sousa 26/12/2024
        SELECT COUNT(1) opcao_13sal2
          INTO vl_valida_13
          FROM FERIAS
         WHERE cod_empresa = pcod_empresa
           AND matricula = pmatricula
           AND ((TO_CHAR(dt_saida_parc1, 'RRRR') =
               TO_CHAR(pdt_saida_parc1, 'RRRR') AND
               (COD_SOLICITACAO <> PCOD_SOLICITACAO OR
               PCOD_SOLICITACAO IS NULL) AND opcao_13sal1 = 'S') or
               (TO_CHAR(dt_saida_parc2, 'RRRR') =
               TO_CHAR(pdt_saida_parc1, 'RRRR') AND
               (COD_SOLICITACAO <> PCOD_SOLICITACAO OR
               PCOD_SOLICITACAO IS NULL) AND opcao_13sal2 = 'S') or
               (TO_CHAR(dt_saida_parc4, 'RRRR') =
               TO_CHAR(pdt_saida_parc1, 'RRRR') AND
               (COD_SOLICITACAO <> PCOD_SOLICITACAO OR
               PCOD_SOLICITACAO IS NULL) AND opcao_13sal4 = 'S'));
        --Bruno Sousa 30/12/2024 - Verificar se já existe requisição de férias também
        IF vl_valida_13 = 0 THEN
          SELECT COUNT(1) opcao_13sal1
            INTO vl_valida_13
            FROM REQUISICAO_FERIAS
           WHERE cod_empresa = pcod_empresa
             AND matricula = pmatricula
             AND SIT_REQUISICAO = 1
             AND ((TO_CHAR(dt_saida_parc1, 'RRRR') =
                 TO_CHAR(pdt_saida_parc1, 'RRRR') AND opcao_13sal1 = 'S') or
                 (TO_CHAR(dt_saida_parc2, 'RRRR') =
                 TO_CHAR(pdt_saida_parc1, 'RRRR') AND opcao_13sal2 = 'S') or
                 (TO_CHAR(dt_saida_parc4, 'RRRR') =
                 TO_CHAR(pdt_saida_parc1, 'RRRR') AND opcao_13sal4 = 'S'));
        end if;
        --Bruno Sousa 30/12/2024 - Verificar se existe requisição de férias DIFERENTE da que esta sendo alterada
        IF vl_valida_13 = 1 AND PCOD_SOLICITACAO IS NOT NULL THEN
          SELECT COUNT(1) opcao_13sal1
            INTO vl_valida_13
            FROM REQUISICAO_FERIAS
           WHERE cod_empresa = pcod_empresa
             AND matricula = pmatricula
             AND (COD_SOLICITACAO <> PCOD_SOLICITACAO AND
                 PCOD_SOLICITACAO IS NOT NULL)
             AND SIT_REQUISICAO = 1
             AND ((TO_CHAR(dt_saida_parc1, 'RRRR') =
                 TO_CHAR(pdt_saida_parc1, 'RRRR') AND opcao_13sal1 = 'S') or
                 (TO_CHAR(dt_saida_parc2, 'RRRR') =
                 TO_CHAR(pdt_saida_parc1, 'RRRR') AND opcao_13sal2 = 'S') or
                 (TO_CHAR(dt_saida_parc4, 'RRRR') =
                 TO_CHAR(pdt_saida_parc1, 'RRRR') AND opcao_13sal4 = 'S'));
        end if;
        --
      EXCEPTION
        WHEN OTHERS THEN
          vl_valida_13 := 0;
      END;
      --
      IF vl_valida_13 >= 1 AND popcao_13sal2 = 'S' THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Opção 13º salário já solicitada no ano calendário.';
        RAISE vsaida_erro;
      ELSE
        --
        BEGIN
          --
          SELECT fer.cat_13m, fer.cat_13h, inf.TIPO_SALARIO
            INTO v_cat_13m, v_cat_13h, v_tipo_salario
            FROM FERIAS_PARAMETROS fer, INFORMACOES_FUNCIONAIS inf
           WHERE inf.cod_empresa = fer.cod_empresa
             AND inf.cod_empresa = pcod_empresa
             AND inf.matricula = pmatricula
             AND inf.filial = fer.cod_filial;
          --
        EXCEPTION
          WHEN NO_DATA_FOUND THEN
            NULL;
          WHEN OTHERS THEN
            NULL;
        END;
        --
        IF v_tipo_salario = 'M' THEN
          IF NVL(v_cat_13m, 'N') = 'N' AND popcao_13sal2 = 'S' THEN
            pflg_retorno := 'N';
            --pmsg_retorno := 'Não é permitido adiantamento de 13º salário nas férias. Verifique parâmetros de férias da filial desse colaborador.';
            pmsg_retorno := 'Não é permitido adiantamento de 13º salário nas férias para esta data de saída.';
            RAISE vsaida_erro;
          END IF;
        ELSE
          IF NVL(v_cat_13h, 'n') = 'N' AND popcao_13sal2 = 'S' THEN
            pflg_retorno := 'N';
            --pmsg_retorno := 'Não é permitido adiantamento de 13º salário nas férias. Verifique parâmetros de férias da filial desse colaborador.';
            pmsg_retorno := 'Não é permitido adiantamento de 13º salário nas férias para esta data de saída.';
            RAISE vsaida_erro;
          END IF;
        END IF;
        --
      END IF;
      --
    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Ferias.Valida_13Sal_Ano_Parc2 - Erro: ' ||
                        SQLERRM;
    END valida_13sal_ano_parc2;
    --
    PROCEDURE vld_13_sal2(pcod_empresa      EMPRESAS.cod%TYPE,
                          pmatricula        INF_PESSOAIS.matricula%TYPE,
                          popcao_13sal1     FERIAS.opcao_13sal1%TYPE,
                          pdt_saida_parc1   FERIAS.dt_saida_parc1%TYPE,
                          popcao_13sal2     FERIAS.opcao_13sal2%TYPE,
                          pdt_saida_parc2   FERIAS.dt_saida_parc2%TYPE,
                          pdt_retorno_parc2 FERIAS.dt_retorno_parc2%TYPE,
                          pflg_retorno      IN OUT VARCHAR2,
                          pmsg_retorno      IN OUT VARCHAR2) IS
      vano           VARCHAR2(2) := NULL;
      v_cat_13m      FERIAS_PARAMETROS.cat_13m%TYPE DEFAULT 'N';
      v_cat_13h      FERIAS_PARAMETROS.cat_13h%TYPE DEFAULT 'N';
      v_tipo_salario FERIAS_PARAMETROS.cat_13h%TYPE DEFAULT 'N';
      vocorr_sal13   OCORR_PAGTO.cod%TYPE;
      --
    BEGIN
      --
      pflg_retorno := 'S';
      --
      IF popcao_13sal2 IS NOT NULL THEN
        BEGIN
          SELECT fer.cat_13m, fer.cat_13h, inf.TIPO_SALARIO
            INTO v_cat_13m, v_cat_13h, v_tipo_salario
            FROM FERIAS_PARAMETROS fer, informacoes_funcionais_cad inf
           WHERE inf.cod_empresa = fer.cod_empresa
             AND inf.cod_empresa = pcod_empresa
             AND inf.matricula = pmatricula
             AND inf.filial = fer.cod_filial;
        EXCEPTION
          WHEN NO_DATA_FOUND THEN
            NULL;
          WHEN OTHERS THEN
            NULL;
        END;
        IF v_tipo_salario = 'M' THEN
          IF NVL(v_cat_13m, 'N') = 'N' AND popcao_13sal2 = 'S' THEN
            pflg_retorno := 'N';
            --pmsg_retorno := 'Não é permitido adiantamento de 13º salário nas férias. Verifique parâmetros de férias da filial desse colaborador.';
            pmsg_retorno := 'Não é permitido adiantamento de 13º salário nas férias para esta data de saída.';
            RAISE vsaida_erro;
          END IF;
        ELSE
          IF NVL(v_cat_13h, 'N') = 'N' AND popcao_13sal2 = 'S' THEN
            pflg_retorno := 'N';
            --pmsg_retorno := 'Não é permitido adiantamento de 13º salário nas férias. Verifique parâmetros de férias da filial desse colaborador.';
            pmsg_retorno := 'Não é permitido adiantamento de 13º salário nas férias para esta data de saída.';
            RAISE vsaida_erro;
          END IF;
        END IF;
        IF popcao_13sal2 NOT IN ('S', 'N') THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Opção deve ser S ou N';
          RAISE vsaida_erro;
        END IF;
        --
        IF popcao_13sal1 = 'S' AND popcao_13sal2 = 'S' THEN
          vano := TO_CHAR(pdt_saida_parc1, 'YY');
          IF vano = TO_CHAR(pdt_saida_parc2, 'YY') THEN
            pflg_retorno := 'N';
            pmsg_retorno := '13º permitido apenas em uma parcela de ferias por ano!';
            RAISE vsaida_erro;
          END IF;
        ELSE
          IF popcao_13sal2 = 'S' THEN
            --
            ocorrencia13(pcod_empresa,
                         pmatricula,
                         pdt_retorno_parc2,
                         vocorr_sal13,
                         pflg_retorno,
                         pmsg_retorno);
            IF pflg_retorno = 'N' THEN
              RAISE vsaida_erro;
            END IF;
            --
            IF vocorr_sal13 = 1 THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'A primeira parcela do 13o. salario ja foi paga';
              RAISE vsaida_erro;
            END IF;
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
        pmsg_retorno := 'Pkg_Ferias.Vld_13_Sal2 - Erro: ' || SQLERRM;
    END vld_13_sal2;
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    IF popcao_13sal2 = 'S' THEN
      --
      valida_13sal_ano_parc2(pcod_empresa,
                             pmatricula,
                             pdt_saida_parc2,
                             PCOD_SOLICITACAO,
                             pflg_retorno,
                             pmsg_retorno);
      --
      OPEN c0;
      FETCH c0
        INTO v_c0;
      CLOSE c0;
      --
      OPEN c1(v_c0.filial);
      FETCH c1
        INTO v_c1;
      CLOSE c1;
      --
      IF TO_CHAR(pdt_saida_parc2, 'mm') = '01' AND v_c1.mes01 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '02' AND v_c1.mes02 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '03' AND v_c1.mes03 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '04' AND v_c1.mes04 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '05' AND v_c1.mes05 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '06' AND v_c1.mes06 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '07' AND v_c1.mes07 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '08' AND v_c1.mes08 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '09' AND v_c1.mes09 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '10' AND v_c1.mes10 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '11' AND v_c1.mes11 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '12' AND v_c1.mes12 = 'S' THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Não é permitido a antecipação do 13° Salário nesta refefência!';
        RAISE vsaida_erro;
      END IF;
      -----------------------------------------------------------------------------------------------------------
      -- Humberto/Rodrigo 27/08/2021
      v_c1b := NULL;
      OPEN c1b(v_c0.num_sind_diss);
      FETCH c1b
        INTO v_c1b;
      CLOSE c1b;
      --
      IF TO_CHAR(pdt_saida_parc2, 'mm') = '01' AND v_c1b.mes01 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '02' AND v_c1b.mes02 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '03' AND v_c1b.mes03 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '04' AND v_c1b.mes04 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '05' AND v_c1b.mes05 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '06' AND v_c1b.mes06 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '07' AND v_c1b.mes07 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '08' AND v_c1b.mes08 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '09' AND v_c1b.mes09 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '10' AND v_c1b.mes10 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '11' AND v_c1b.mes11 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '12' AND v_c1b.mes12 = 'S' THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Não é permitido a antecipação do 13° Salário nesta refefência!';
        RAISE vsaida_erro;
      END IF;
    
    END IF;
  
    OPEN c1(v_c0.filial);
    FETCH c1
      INTO v_c1;
    CLOSE c1;
    --
    IF TO_CHAR(pdt_saida_parc2, 'mm') = '01' AND v_c1.mes01 = 'S' OR
       TO_CHAR(pdt_saida_parc2, 'mm') = '02' AND v_c1.mes02 = 'S' OR
       TO_CHAR(pdt_saida_parc2, 'mm') = '03' AND v_c1.mes03 = 'S' OR
       TO_CHAR(pdt_saida_parc2, 'mm') = '04' AND v_c1.mes04 = 'S' OR
       TO_CHAR(pdt_saida_parc2, 'mm') = '05' AND v_c1.mes05 = 'S' OR
       TO_CHAR(pdt_saida_parc2, 'mm') = '06' AND v_c1.mes06 = 'S' OR
       TO_CHAR(pdt_saida_parc2, 'mm') = '07' AND v_c1.mes07 = 'S' OR
       TO_CHAR(pdt_saida_parc2, 'mm') = '08' AND v_c1.mes08 = 'S' OR
       TO_CHAR(pdt_saida_parc2, 'mm') = '09' AND v_c1.mes09 = 'S' OR
       TO_CHAR(pdt_saida_parc2, 'mm') = '10' AND v_c1.mes10 = 'S' OR
       TO_CHAR(pdt_saida_parc2, 'mm') = '11' AND v_c1.mes11 = 'S' OR
       TO_CHAR(pdt_saida_parc2, 'mm') = '12' AND v_c1.mes12 = 'S' THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Não é permitido a antecipação do 13° Salário nesta refefência!';
      RAISE vsaida_erro;
    END IF;
    -----------------------------------------------------------------------------------------------------------
    -- Humberto/Rodrigo 27/08/2021
    v_c1b := NULL;
    OPEN c1b(v_c0.num_sind_diss);
    FETCH c1b
      INTO v_c1b;
    CLOSE c1b;
    --
    IF TO_CHAR(pdt_saida_parc2, 'mm') = '01' AND v_c1b.mes01 = 'S' OR
       TO_CHAR(pdt_saida_parc2, 'mm') = '02' AND v_c1b.mes02 = 'S' OR
       TO_CHAR(pdt_saida_parc2, 'mm') = '03' AND v_c1b.mes03 = 'S' OR
       TO_CHAR(pdt_saida_parc2, 'mm') = '04' AND v_c1b.mes04 = 'S' OR
       TO_CHAR(pdt_saida_parc2, 'mm') = '05' AND v_c1b.mes05 = 'S' OR
       TO_CHAR(pdt_saida_parc2, 'mm') = '06' AND v_c1b.mes06 = 'S' OR
       TO_CHAR(pdt_saida_parc2, 'mm') = '07' AND v_c1b.mes07 = 'S' OR
       TO_CHAR(pdt_saida_parc2, 'mm') = '08' AND v_c1b.mes08 = 'S' OR
       TO_CHAR(pdt_saida_parc2, 'mm') = '09' AND v_c1b.mes09 = 'S' OR
       TO_CHAR(pdt_saida_parc2, 'mm') = '10' AND v_c1b.mes10 = 'S' OR
       TO_CHAR(pdt_saida_parc2, 'mm') = '11' AND v_c1b.mes11 = 'S' OR
       TO_CHAR(pdt_saida_parc2, 'mm') = '12' AND v_c1b.mes12 = 'S' THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Não é permitido a antecipação do 13° Salário nesta refefência!';
      RAISE vsaida_erro;
    END IF;
    -----------------------------------------------------------------------------------------------------------
    IF pdt_saida_parc1 IS NOT NULL THEN
      vld_13_sal2(pcod_empresa,
                  pmatricula,
                  popcao_13sal1,
                  pdt_saida_parc1,
                  popcao_13sal2,
                  pdt_saida_parc2,
                  pdt_retorno_parc2,
                  pflg_retorno,
                  pmsg_retorno);
      IF pflg_retorno = 'N' THEN
        RAISE vsaida_erro;
      END IF;
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Opcao_13Sal2 - Erro: ' || SQLERRM;
  END Valida_Opcao_13Sal2;
  --
  PROCEDURE Valida_Desc_Adicional2(pdias_descanso_adicional FERIAS.dias_descanso_adicional%TYPE,
                                   pdesc_adicional1         FERIAS.desc_adicional1%TYPE,
                                   pdt_saida_parc2          FERIAS.dt_saida_parc2%TYPE,
                                   pnum_dias_parc2          FERIAS.num_dias_parc2%TYPE,
                                   pdesc_adicional2         FERIAS.desc_adicional2%TYPE,
                                   pdt_retorno_parc2        IN OUT FERIAS.dt_retorno_parc2%TYPE,
                                   pflg_retorno             IN OUT VARCHAR2,
                                   pmsg_retorno             IN OUT VARCHAR2) IS
  BEGIN
    --
    pdt_retorno_parc2 := pdt_saida_parc2 + NVL(pnum_dias_parc2, 0) +
                         NVL(pdesc_adicional2, 0);
    --
    IF (NVL(pdesc_adicional1, 0) + NVL(pdesc_adicional2, 0)) >
       NVL(pdias_descanso_adicional, 0) THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Dias do Bonus maior que o Permitido !!!! ';
      RAISE vsaida_erro;
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Desc_Adicional2 - Erro: ' ||
                      SQLERRM;
  END Valida_Desc_Adicional2;
  --
  PROCEDURE Valida_Dt_Retorno_Parc2(pdt_retorno_parc2     FERIAS.dt_retorno_parc2%TYPE,
                                    pind_situacao_periodo ferias.ind_situacao_periodo%TYPE,
                                    pflg_retorno          IN OUT VARCHAR2,
                                    pmsg_retorno          IN OUT VARCHAR2,
                                    pdt_saida_parc2       FERIAS.dt_saida_parc2%TYPE DEFAULT NULL,
                                    pdt_fim_per_ferias    DATE,
                                    pcod_empresa          empresas.cod%TYPE,
                                    pmatricula            inf_pessoais.matricula%TYPE,
                                    pdt_inic_per_ferias   DATE) IS
    --
    CURSOR c1 IS
      SELECT *
        FROM ferias
       WHERE dt_inic_per_ferias = pdt_inic_per_ferias
         AND matricula = pmatricula
         AND cod_empresa = pcod_empresa;
    v_c1 c1%ROWTYPE;
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    IF pind_situacao_periodo = 'P' THEN
      NULL;
    ELSE
      IF c1%isopen THEN
        CLOSE c1;
      END IF;
      OPEN c1; -- Alterado Dri/Rodrigo 10/09/2019
      FETCH c1
        INTO v_c1;
      CLOSE c1;
      IF v_c1.ind_situacao_parc_1 = 'C' THEN
        NULL;
      ELSE
        pflg_retorno := 'N';
        pmsg_retorno := 'A situação do período não permite mais alterações!';
        RAISE vsaida_erro;
      END IF;
    END IF;
    --
    IF pdt_retorno_parc2 IS NULL AND pdt_saida_parc2 IS NOT NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Data de Retorno Parcela 2: Campo obrigatório!';
      RAISE vsaida_erro;
    ELSE
      IF pdt_saida_parc2 IS NOT NULL AND
         pdt_retorno_parc2 <= pdt_saida_parc2 THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A data de retorno não pode ser menor ou igual à data de saída!';
        RAISE vsaida_erro;
      END IF;
    
      IF pdt_retorno_parc2 > ADD_MONTHS(pdt_fim_per_ferias, 12) THEN
        -- Adicionado por Igor Cardoso 27/07/2019 - Chamado 17969
        pflg_retorno := 'N';
        pmsg_retorno := 'Data de retorno maior que o permitido na vigência de férias!';
        RAISE vsaida_erro;
      END IF;
    
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Dt_Retorno_Parc2 - Erro: ' ||
                      SQLERRM;
  END Valida_Dt_Retorno_Parc2;
  --
  PROCEDURE Valida_Tipo_Ferias2(ptipo_ferias2 FERIAS.tipo_ferias2%TYPE,
                                pflg_retorno  IN OUT VARCHAR2,
                                pmsg_retorno  IN OUT VARCHAR2) IS
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    IF ptipo_ferias2 NOT IN ('N', 'C') OR ptipo_ferias2 IS NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Entre com a opção correta, N-Normal, C-Coletivas';
      RAISE vsaida_erro;
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Tipo_Ferias2 - Erro: ' || SQLERRM;
  END Valida_Tipo_Ferias2;

  /** Inicio Igor 27/04/2018 **/

  PROCEDURE P4(pnum_dias_parc1  NUMBER,
               pdias_abono_pec1 FERIAS.dias_abono_pec1%TYPE,
               pnum_dias_parc2  NUMBER,
               pdias_abono_pec2 FERIAS.dias_abono_pec2%TYPE,
               pnum_dias_parc4  IN OUT FERIAS.num_dias_parc2%TYPE,
               pdias_abono_pec4 IN OUT FERIAS.dias_abono_pec2%TYPE,
               PSALDO           IN NUMBER,
               pflg_retorno     IN OUT VARCHAR2,
               pmsg_retorno     IN OUT VARCHAR) IS
  BEGIN
    pnum_dias_parc4  := PSALDO; --Cibele 30 - NVL(pnum_dias_parc1, 0) + NVL(pdias_abono_pec1,0);
    pdias_abono_pec4 := 0;
  EXCEPTION
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Dt_Saida_Parc2/P2 - Erro: ' ||
                      SQLERRM;
  END P4;
  --
  PROCEDURE Bloqueia_Parc4(pcod_empresa         EMPRESAS.cod%TYPE,
                           pfilial              FILIAIS.cod_filial%TYPE,
                           pdt_saida_parc1      FERIAS.dt_saida_parc1%TYPE,
                           pnum_dias_parc1      NUMBER,
                           pdias_abono_pec1     FERIAS.dias_abono_pec1%TYPE,
                           pdt_saida_parc2      FERIAS.dt_saida_parc1%TYPE,
                           pnum_dias_parc2      NUMBER,
                           pdias_abono_pec2     FERIAS.dias_abono_pec1%TYPE,
                           pdt_fim_per_ferias   FERIAS.dt_fim_per_ferias%TYPE,
                           psaldo               NUMBER,
                           pdias_direito        NUMBER, -- Humberto/Izidoro 03/03/2016
                           popcao_13sal4        IN OUT FERIAS.opcao_13sal2%TYPE,
                           pdias_abono_pec1_dsp OUT VARCHAR2,
                           pnum_dias_parc1_dsp  OUT VARCHAR2,
                           pflg_retorno         IN OUT VARCHAR2,
                           pmsg_retorno         IN OUT VARCHAR2) IS
    --
    v_flag VARCHAR2(1);
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    /*
        lanc_abono_p1(pcod_empresa,
                      pfilial,
                      pdt_saida_parc1,
                      pdt_fim_per_ferias,
                      psaldo,
                      pdias_direito,--Humberto/Izidoro 03/03/2016
                      --pnum_dias_parc1,
                      --pdias_abono_pec1,
                      pnum_dias_parc1_dsp,
                      pdias_abono_pec1_dsp,
                      v_flag,
                      pflg_retorno,
                      pmsg_retorno);
    */
    IF pflg_retorno <> 'S' THEN
      RAISE vsaida_erro;
    END IF;
    --
    IF v_flag = 'S' OR
       NVL(pnum_dias_parc1, 0) + NVL(pdias_abono_pec1, 0) +
       NVL(pnum_dias_parc2, 0) + NVL(pdias_abono_pec2, 0) >= 30 THEN
      popcao_13sal4 := 'N';
      pflg_retorno  := 'N';
      pmsg_retorno  := 'Não é permitido programar a Terceira Parcela!';
      RAISE vsaida_erro;
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Bloqueia_Parc2 - Erro: ' || SQLERRM;
  END Bloqueia_Parc4;
  --
  -- Chamado pelos campos (dt_saida_parc2,num_dias_parc2,dias_abono_pec2,opcao_13sl2)
  PROCEDURE When_New_Item_Parc4(pcod_empresa         EMPRESAS.cod%TYPE,
                                pmatricula           INF_PESSOAIS.matricula%TYPE,
                                pdt_saida_parc1      FERIAS.dt_saida_parc1%TYPE,
                                pnum_dias_parc1      NUMBER,
                                pdias_abono_pec1     FERIAS.dias_abono_pec1%TYPE,
                                pdt_saida_parc2      FERIAS.dt_saida_parc1%TYPE,
                                pnum_dias_parc2      NUMBER,
                                pdias_abono_pec2     FERIAS.dias_abono_pec1%TYPE,
                                pdt_saida_parc4      FERIAS.dt_saida_parc1%TYPE,
                                pnum_dias_parc4      NUMBER,
                                pdias_abono_pec4     FERIAS.dias_abono_pec1%TYPE,
                                pdt_fim_per_ferias   FERIAS.dt_fim_per_ferias%TYPE,
                                psaldo               NUMBER,
                                pdias_direito        NUMBER, -- Humberto/Izidoro 03/03/2016
                                popcao_13sal4        IN OUT FERIAS.opcao_13sal2%TYPE,
                                pdias_abono_pec1_dsp OUT VARCHAR2,
                                pnum_dias_parc1_dsp  OUT VARCHAR2,
                                pflg_retorno         IN OUT VARCHAR2,
                                pmsg_retorno         IN OUT VARCHAR2) IS
    --
    vfilial FILIAIS.cod_filial%TYPE;
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    BEGIN
      --
      SELECT filial
        INTO vfilial
        FROM inf_pessoais_cad
       WHERE matricula = pmatricula
         AND cod_empresa = pcod_empresa;
      --
    EXCEPTION
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Ferias.When_New_Item_Parc2 - Erro ao buscar a filial: ' ||
                        SQLERRM;
        RAISE vsaida_erro;
    END;
    --
    Bloqueia_Parc4(pcod_empresa,
                   vfilial,
                   pdt_saida_parc1,
                   pnum_dias_parc1,
                   pdias_abono_pec1,
                   pdt_saida_parc2,
                   pnum_dias_parc2,
                   pdias_abono_pec2,
                   pdt_fim_per_ferias,
                   psaldo,
                   pdias_direito, -- Humberto/Izidoro 03/03/2016
                   popcao_13sal4,
                   pdias_abono_pec1_dsp,
                   pnum_dias_parc1_dsp,
                   pflg_retorno,
                   pmsg_retorno);
    --
  
    IF NVL(pflg_retorno, 'S') <> 'S' THEN
      RAISE vsaida_erro;
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.When_New_Item_Parc2 - Erro: ' || SQLERRM;
  END When_New_Item_Parc4;
  --
  PROCEDURE Valida_Dt_Saida_Parc4(pcod_empresa         EMPRESAS.cod%TYPE,
                                  pcod_solicitacao     FERIAS.cod_solicitacao%TYPE,
                                  pmatricula           INF_PESSOAIS.matricula%TYPE,
                                  pdt_saida_parc1      FERIAS.dt_saida_parc1%TYPE,
                                  pdt_retorno_parc1    FERIAS.dt_retorno_parc1%TYPE,
                                  pdt_saida_parc2      FERIAS.dt_saida_parc1%TYPE,
                                  pdt_retorno_parc2    FERIAS.dt_retorno_parc1%TYPE,
                                  pnum_dias_parc1      NUMBER,
                                  pnum_dias_parc2      NUMBER,
                                  pdt_saida_parc4      FERIAS.dt_saida_parc4%TYPE,
                                  pdias_abono_pec1     FERIAS.dias_abono_pec1%TYPE,
                                  pdt_inic_per_ferias  FERIAS.dt_inic_per_ferias%TYPE,
                                  pdt_fim_per_ferias   FERIAS.dt_fim_per_ferias%TYPE,
                                  psaldo               NUMBER,
                                  pdias_direito        NUMBER, -- Humberto/Izidoro 03/03/2016
                                  p_data_limite        DATE DEFAULT NULL, -- Chamado 29668 - Andre - 25-04-2023                                  
                                  pnum_dias_parc4      IN OUT FERIAS.num_dias_parc2%TYPE,
                                  pdias_abono_pec4     IN OUT FERIAS.dias_abono_pec2%TYPE,
                                  pdt_retorno_parc4    IN OUT FERIAS.dt_retorno_parc2%TYPE,
                                  pdt_pagto_parc4      IN OUT FERIAS.dt_pagto_parc2%TYPE,
                                  ptipo_ferias4        IN OUT FERIAS.tipo_ferias2%TYPE,
                                  popcao_13sal4        IN OUT FERIAS.opcao_13sal2%TYPE,
                                  pdias_abono_pec1_dsp OUT VARCHAR2,
                                  pnum_dias_parc1_dsp  OUT VARCHAR2,
                                  pflg_retorno         OUT VARCHAR2,
                                  pmsg_retorno         OUT VARCHAR2) IS
    /*
    Alt.1, trat. ref. valores das colunas da tab. FERIAS_PARAMETROS onde "seg', "ter"... sao preenchidos pela aplicacao
           como 'N' e nao como nulos, PSMarconato/Sidnei, 03/03/2022
    */
    --
    --VDT_AGEND_LIMITE DATE;
    vdt_data_limite DATE;
    --
    --Bruno Sousa 22/10/2024
    --Esse paramentro usado para cancelamento das férias tbm sera usado para criar as parcelas de férias
    V_QTD_MAX_DIAS_FERIAS PARAMETROS_RECURSOS_HUMANOS.QTD_MAX_DIAS_FERIAS%TYPE;
  
    vfilial FILIAIS.cod_filial%TYPE;
    -- Cursor refeito em 18/09/2019
    -- Durante os testes, foi criada uma requisição para a 1a e 2a parcela. Ao cancelar uma das programações, a F013303 cancela a requisição criada,
    -- não importando se há ainda 1 parcela válida.
    -- Foi programada a 2a parcela via forms, portanto, não há requisição e, devido ao cursor comentado abaixo,
    -- não estava sendo possível criar a 3a parcela
    CURSOR c1 IS
      SELECT f.dt_saida_parc1, f.dt_saida_parc2
        FROM ferias f
       WHERE f.dt_saida_parc1 < pdt_saida_parc2
         AND f.dt_saida_parc2 < pdt_saida_parc4
         AND f.dt_saida_parc4 IS NULL
         AND f.dt_inic_per_ferias = pdt_inic_per_ferias
         AND f.matricula = pmatricula
         AND f.cod_empresa = pcod_empresa;
    /*      SELECT nvl(rf.dt_saida_parc1,f.dt_saida_parc1) dt_saida_parc1, nvl(rf.dt_saida_parc2,f.dt_saida_parc2) dt_saida_parc2, rf.sit_requisicao
     FROM REQUISICAO_FERIAS rf, ferias f
    WHERE f.dt_inic_per_ferias = rf.dt_inic_per_ferias
      AND f.matricula = rf.matricula
      AND f.cod_empresa = rf.cod_empresa
      AND rf.cod_empresa = pcod_empresa
      AND rf.matricula = pmatricula
      AND rf.dt_saida_parc1 < pdt_saida_parc2
      AND rf.dt_saida_parc2 < pdt_saida_parc4
      AND rf.dt_saida_parc4 IS NULL
      AND rf.sit_requisicao IN ('1', '2') -- concluída
      AND rf.DT_INIC_PER_FERIAS = pdt_inic_per_ferias
      AND rf.DT_FIM_PER_FERIAS  = pdt_fim_per_ferias;*/
    --
    v_c1 c1%ROWTYPE;
    --
    PROCEDURE Vld_Terceira_Parcela(pcod_empresa        EMPRESAS.cod%TYPE,
                                   pmatricula          INF_PESSOAIS.matricula%TYPE,
                                   pdt_inic_per_ferias FERIAS.dt_inic_per_ferias%TYPE,
                                   pdt_fim_per_ferias  FERIAS.dt_fim_per_ferias%TYPE,
                                   pdt_saida_parc1     FERIAS.dt_saida_parc1%TYPE,
                                   pdt_retorno_parc1   FERIAS.dt_retorno_parc1%TYPE,
                                   --                                  pnum_dias_parc2     in out ferias.num_dias_parc2%type,
                                   pdt_saida_parc4      FERIAS.dt_saida_parc2%TYPE,
                                   pdt_retorno_parc4    IN OUT FERIAS.dt_retorno_parc2%TYPE,
                                   ptipo_ferias4        IN OUT FERIAS.tipo_ferias2%TYPE,
                                   popcao_13sal4        IN OUT FERIAS.opcao_13sal2%TYPE,
                                   pdias_direito        NUMBER, -- Humberto/Izidoro 03/03/2016
                                   pdias_abono_pec1_dsp OUT VARCHAR2,
                                   pnum_dias_parc1_dsp  OUT VARCHAR2,
                                   pflg_retorno         OUT VARCHAR2,
                                   pmsg_retorno         OUT VARCHAR2) IS
      --
      wl_dt_ini         DATE;
      wl_dt_fim         DATE;
      v_erro            EXCEPTION;
      vl_cod            INFORMACOES_FUNCIONAIS.situacao%TYPE;
      vl_dt_situacao    INFORMACOES_FUNCIONAIS.dt_situacao%TYPE;
      v_cat_13m         FERIAS_PARAMETROS.cat_13m%TYPE;
      v_ferias_coletiva FERIAS_PARAMETROS.ferias_coletiva%TYPE;
      v_antecipa        FERIAS_PARAMETROS.antecipa_parc_4%TYPE;
      v_intervalo       FERIAS_PARAMETROS.Interv_Progr_Ferias%TYPE;
      v_filial          FERIAS_PARAMETROS.Cod_Filial%TYPE;
      v_seg             FERIAS_PARAMETROS.seg%TYPE;
      v_ter             FERIAS_PARAMETROS.ter%TYPE;
      v_qua             FERIAS_PARAMETROS.qua%TYPE;
      v_qui             FERIAS_PARAMETROS.qui%TYPE;
      v_sex             FERIAS_PARAMETROS.sex%TYPE;
      v_sab             FERIAS_PARAMETROS.sab%TYPE;
      v_todos           FERIAS_PARAMETROS.todos%TYPE;
      v_qtde_prog       PLS_INTEGER;
      v_proximo_dia     FERIAS_PARAMETROS.proximo_dia%TYPE;
      v_dsr_jornada     FERIAS_PARAMETROS.DSR_JORNADA%type;
      --
      v_dia_ant_feriado BOOLEAN := DIA_ANTERIOR_EH_FERIADO(pcod_empresa,
                                                           pmatricula,
                                                           pdt_saida_parc4);
      --
      qtde_dias_contr_fer_ NUMBER(3) := 330;
      --
      CURSOR c1 IS
        SELECT fer.perc_dobro
          FROM FERIAS_PARAMETROS fer, informacoes_funcionais_cad inf
         WHERE inf.cod_empresa = fer.cod_empresa
           AND inf.cod_empresa = pcod_empresa
           AND inf.matricula = pmatricula
           AND inf.filial = fer.cod_filial;
      --
      v_c1 c1%ROWTYPE;
      --
      PROCEDURE Vld_Dt_Saida_Parc4(pcod_empresa EMPRESAS.cod%TYPE,
                                   pflg_retorno OUT VARCHAR2,
                                   pmsg_retorno OUT VARCHAR2) IS
        --
        v_dt_ref_folha DATE;
        v_dt_limite    DATE;
        v_dia_limite   NUMBER(2);
        --
      BEGIN
        --
        IF pcod_solicitacao IS NULL THEN
          -- Carrega limite para data de req. pessoal
          IF pcod_empresa IS NOT NULL THEN
            --
            BEGIN
              --
              SELECT P.DT_REF_FOLHA,
                     NVL(LPAD(Dia_Limite_ferias, 2, 0),
                         TO_CHAR(LAST_DAY(P.DT_REF_FOLHA), 'DD')) dia_limite
                INTO v_dt_ref_folha, v_dia_limite
                FROM PARAMETROS_RECURSOS_HUMANOS P
               WHERE P.Cod_Empresa = pcod_empresa;
              --
              IF v_dia_limite >
                 TO_NUMBER(TO_CHAR(LAST_DAY(v_dt_ref_folha), 'dd')) THEN
                v_dia_limite := TO_NUMBER(TO_CHAR(LAST_DAY(v_dt_ref_folha),
                                                  'dd'));
              END IF;
              --
              v_dt_limite := TO_DATE(v_dia_limite || '/' ||
                                     TO_CHAR(v_dt_ref_folha, 'mmrrrr'),
                                     'dd/mm/rrrr');
              --
            EXCEPTION
              WHEN OTHERS THEN
                pflg_retorno := 'N';
                pmsg_retorno := 'Não foi possível buscar a data limite: ' ||
                                SQLERRM;
                RAISE vsaida_erro;
            END;
            --
            IF pdt_saida_parc4 < v_dt_ref_folha THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'A data de saída não pode ser menor que a data de referência da Folha ' ||
                              TO_CHAR(v_dt_ref_folha, 'dd/mm/rrrr') || '!';
              RAISE vsaida_erro;
            END IF;
            --
            IF NOT VALIDA_PRAZO_PROGRAMACAO(pcod_empresa,
                                            pdt_saida_parc4,
                                            pmsg_retorno) THEN
              pflg_retorno := 'N';
              RAISE vsaida_erro;
            END IF;
            --
            IF TRUNC(SYSDATE) > v_dt_limite AND
               NOT (pdt_saida_parc4 > LAST_DAY(v_dt_ref_folha)) THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'O prazo para o cadastro de requisições expirou em ' || ' ' ||
                              TO_CHAR(v_dt_limite, 'DD/MM/YYYY') || '!';
              RAISE vsaida_erro;
            END IF;
            --
            IF TRUNC(SYSDATE) > pdt_saida_parc4 THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'A data informada é menor do que a data atual do sistema!';
              RAISE vsaida_erro;
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
          pmsg_retorno := 'Pkg_Ferias.Valida_Dt_Saida_Parc2/Vld_Dt_Saida_Parc2 - Erro: ' ||
                          SQLERRM;
      END Vld_Dt_Saida_Parc4;
      --
    BEGIN
      --
      pflg_retorno := 'S';
      --
      IF p_data_limite IS NOT NULL THEN
        vdt_data_limite := p_data_limite + nvl(pnum_dias_parc1, 0) +
                           nvl(pdias_abono_pec1, 0);
        numDias         := nvl(pnum_dias_parc1, 0);
        numDiasAbono    := nvl(pdias_abono_pec1, 0);
      ELSE
        vdt_data_limite := pdt_saida_parc4;
        numDias         := nvl(pnum_dias_parc1, 0);
        numDiasAbono    := nvl(pdias_abono_pec1, 0);
      END IF;
      --Vld_Ferias_Dobro(pCod_Empresa, pMatricula, vdt_data_limite, pflg_retorno, pmsg_retorno,pdt_inic_per_ferias);
      Vld_Ferias_Dobro(pCod_Empresa,
                       pMatricula,
                       pdt_saida_parc4,
                       pflg_retorno,
                       pmsg_retorno,
                       pdt_inic_per_ferias);
      IF NVL(pflg_retorno, 'S') <> 'S' THEN
        RAISE vsaida_erro;
      END IF;
      -- Valida saída pela tabela LIMITE_AGEND_FERIAS (Rodrigo 08/07/2022)
    
      -- if pcod_solicitacao is null and pdt_saida_parc4 is not null then
      --    VDT_AGEND_LIMITE := VERIF_LIMITE_AGEND_FERIAS(PCOD_EMPRESA, sysdate, pdt_saida_parc4);
      -- end if;
    
      -- IF VDT_AGEND_LIMITE IS NOT NULL and pdt_saida_parc4 is not null THEN
      --  PFLG_RETORNO := 'N';
      --  PMSG_RETORNO := 'Data de saída de férias deve ser superior à '||TO_CHAR(VDT_AGEND_LIMITE,'DD/MM/RRRR')||'.';
      --  RAISE VSAIDA_ERRO;
      -- END IF;
      --
      BEGIN
        --
        SELECT fer.cat_13m,
               fer.ferias_coletiva,
               fer.cod_filial,
               fer.interv_progr_ferias,
               NVL(fer.antecipa_parc_4, 0),
               fer.seg,
               fer.ter,
               fer.qua,
               fer.qui,
               fer.sex,
               fer.sab,
               fer.todos,
               NVL(fer.qtde_prog_ferias, 0) AS prog_ferias,
               NVL(fer.proximo_dia, 'N'),
               NVL(fer.dsr_jornada, 'N')
          INTO v_cat_13m,
               v_ferias_coletiva,
               v_filial,
               v_intervalo,
               v_antecipa,
               v_seg,
               v_ter,
               v_qua,
               v_qui,
               v_sex,
               v_sab,
               v_todos,
               v_qtde_prog,
               v_proximo_dia,
               v_dsr_jornada
          FROM FERIAS_PARAMETROS fer, informacoes_funcionais_cad inf
         WHERE inf.cod_empresa = fer.cod_empresa
           AND inf.filial = fer.cod_filial
           AND inf.cod_empresa = pcod_empresa
           AND inf.matricula = pmatricula;
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foi possível verificar categoria de 13º salário no parametro de férias!';
          RAISE vsaida_erro;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Pkg_Ferias.Valida_Dt_Saida_Parc2/Vld_Segunda_Parcela - Erro ao verificar categoria de 13º salário no parametro de férias: ' ||
                          SQLERRM;
          RAISE vsaida_erro;
      END;
      --
      IF NVL(v_seg, 'N') = 'N' AND NVL(v_ter, 'N') = 'N' AND
         NVL(v_qua, 'N') = 'N' AND NVL(v_qui, 'N') = 'N' AND
         NVL(v_sex, 'N') = 'N' AND NVL(v_sab, 'N') = 'N' AND
         NVL(v_todos, 'N') = 'N' /*Alt.1*/
         AND NVL(v_dsr_jornada, 'N') = 'N' THEN
        v_todos := 'S';
      END IF;
    
      IF (pdt_saida_parc4 IS NOT NULL) THEN
        --
        vld_dt_saida_parc4(pcod_empresa, pflg_retorno, pmsg_retorno);
        --
        IF NVL(pflg_retorno, 'S') <> 'S' THEN
          RAISE vsaida_erro;
        END IF;
        --
        IF NOT verif_interv_progr_ferias(pcod_empresa,
                                         v_filial,
                                         pdt_retorno_parc2,
                                         pdt_saida_parc4,
                                         v_intervalo) THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Necessário cumprir os ' || v_intervalo ||
                          ' dias de intervalo mínimo entre as parcelas da programação de férias.';
          pmsg_retorno := pmsg_retorno || CHR(13) ||
                          'Data mínima para Saída: ' ||
                          TO_CHAR(pdt_retorno_parc2 + v_intervalo,
                                  'DD/MM/RRRR');
          RAISE vsaida_erro;
        END IF;
        --
        --verifica se o dia da semana esta habilitado para programar saída de férias
        IF VALIDA_DSR_JORNADA(PCOD_EMPRESA,
                              PMATRICULA,
                              PDT_SAIDA_PARC4,
                              v_dsr_jornada,
                              PMSG_RETORNO) THEN
          NULL;
        ELSIF v_dsr_jornada = 'N' AND v_todos = 'S' THEN
          NULL;
        ELSIF v_dsr_jornada = 'N' AND
              ((TO_CHAR(pdt_saida_parc4, 'D') = 2 AND v_seg = 'S') OR
              (TO_CHAR(pdt_saida_parc4, 'D') = 3 AND v_seg = 'S' AND
              v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
          NULL;
        ELSIF v_dsr_jornada = 'N' AND
              ((TO_CHAR(pdt_saida_parc4, 'D') = 3 AND v_ter = 'S') OR
              (TO_CHAR(pdt_saida_parc4, 'D') = 4 AND v_ter = 'S' AND
              v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
          NULL;
        ELSIF v_dsr_jornada = 'N' AND
              ((TO_CHAR(pdt_saida_parc4, 'D') = 4 AND v_qua = 'S') OR
              (TO_CHAR(pdt_saida_parc4, 'D') = 5 AND v_qua = 'S' AND
              v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
          NULL;
        ELSIF v_dsr_jornada = 'N' AND
              ((TO_CHAR(pdt_saida_parc4, 'D') = 5 AND v_qui = 'S') OR
              (TO_CHAR(pdt_saida_parc4, 'D') = 6 AND v_qui = 'S' AND
              v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
          NULL;
        ELSIF v_dsr_jornada = 'N' AND
              ((TO_CHAR(pdt_saida_parc4, 'D') = 6 AND v_sex = 'S') OR
              (TO_CHAR(pdt_saida_parc4, 'D') = 7 AND v_sex = 'S' AND
              v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
          NULL;
        ELSIF v_dsr_jornada = 'N' AND
              ((TO_CHAR(pdt_saida_parc4, 'D') = 7 AND v_sab = 'S') OR
              (TO_CHAR(pdt_saida_parc4, 'D') = 1 AND v_sab = 'S' AND
              v_proximo_dia = 'S' AND V_DIA_ANT_FERIADO)) THEN
          NULL;
        ELSE
          IF v_dsr_jornada = 'S' THEN
            pflg_retorno := 'N';
            PMSG_RETORNO := 'Por regra de jornada o dia escolhido não é valido para saída de férias conforme DSR. ' ||
                            nvl(PMSG_RETORNO, ' ');
            RAISE vsaida_erro;
          END IF;
          pflg_retorno := 'N';
          pmsg_retorno := NULL;
          --            pmsg_retorno := 'Este dia não é permitido para data de saída de férias. Verifique os parâmetros da filial!';
          IF v_seg = 'S' THEN
            pmsg_retorno := 'Por determinação da empresa, somente segunda-feira';
          END IF;
          IF v_ter = 'S' THEN
            IF pmsg_retorno IS NULL THEN
              pmsg_retorno := 'Por determinação da empresa, somente terça-feira';
            ELSIF v_qua <> 'S' AND v_qui <> 'S' AND v_sex <> 'S' AND
                  v_sab <> 'S' THEN
              pmsg_retorno := pmsg_retorno || ' e terça-feira';
            ELSE
              pmsg_retorno := pmsg_retorno || ', terça-feira';
            END IF;
          END IF;
          IF v_qua = 'S' THEN
            IF pmsg_retorno IS NULL THEN
              pmsg_retorno := 'Por determinação da empresa, somente quarta-feira';
            ELSIF v_qui <> 'S' AND v_sex <> 'S' AND v_sab <> 'S' THEN
              pmsg_retorno := pmsg_retorno || ' e quarta-feira';
            ELSE
              pmsg_retorno := pmsg_retorno || ', quarta-feira';
            END IF;
          END IF;
          IF v_qui = 'S' THEN
            IF pmsg_retorno IS NULL THEN
              pmsg_retorno := 'Por determinação da empresa, somente quinta-feira';
            ELSIF v_sex <> 'S' AND v_sab <> 'S' THEN
              pmsg_retorno := pmsg_retorno || ' e quinta-feira';
            ELSE
              pmsg_retorno := pmsg_retorno || ', quinta-feira';
            END IF;
          END IF;
          IF v_sex = 'S' THEN
            IF pmsg_retorno IS NULL THEN
              pmsg_retorno := 'Por determinação da empresa, somente sexta-feira';
            ELSIF v_sab <> 'S' THEN
              pmsg_retorno := pmsg_retorno || ' e sexta-feira';
            ELSE
              pmsg_retorno := pmsg_retorno || ', sexta-feira';
            END IF;
          END IF;
          IF v_sab = 'S' THEN
            IF pmsg_retorno IS NULL THEN
              pmsg_retorno := 'Por determinação da empresa, somente sábado';
            ELSE
              pmsg_retorno := pmsg_retorno || ' e sábado';
            END IF;
          END IF;
          IF pmsg_retorno IS NOT NULL THEN
            IF INSTR(pmsg_retorno, ' e ') <> 0 THEN
              pmsg_retorno := pmsg_retorno ||
                              ' são dias válidos para saída de férias.';
            ELSE
              pmsg_retorno := pmsg_retorno ||
                              ' é dia válido para saída de férias.';
            END IF;
          END IF;
          RAISE vsaida_erro;
        END IF;
      END IF;
      --
      BEGIN
        --
        SELECT fer.cat_13m,
               fer.ferias_coletiva,
               NVL(fer.antecipa_parc_4, 0)
          INTO v_cat_13m, v_ferias_coletiva, v_antecipa
          FROM FERIAS_PARAMETROS fer, informacoes_funcionais_cad inf
         WHERE inf.cod_empresa = fer.cod_empresa
           AND inf.filial = fer.cod_filial
           AND inf.cod_empresa = pcod_empresa
           AND inf.matricula = pmatricula;
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Não foi possível verificar categoria de 13º salário no parametro de férias!';
          RAISE vsaida_erro;
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Pkg_Ferias.Valida_Dt_Saida_Parc2/Vld_Segunda_Parcela - Erro: ' ||
                          SQLERRM;
          RAISE vsaida_erro;
      END;
      --
      IF pdt_saida_parc4 < ADD_MONTHS(pdt_inic_per_ferias, v_antecipa) THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A data de saída deve ser maior que ' ||
                        TO_CHAR(ADD_MONTHS(pdt_inic_per_ferias, v_antecipa),
                                'dd/mm/rrrr') || ' !';
        RAISE vsaida_erro;
      END IF;
      --
      IF pdt_saida_parc4 < pdt_retorno_parc2 THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A data de saída deve ser maior que ' ||
                        TO_CHAR(pdt_retorno_parc2, 'DD/MM/RRRR') || '!';
        RAISE vsaida_erro;
      ELSIF (pdt_saida_parc4 < TRUNC(SYSDATE + v_qtde_prog)) THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A data de saída deve ser maior ou igual a ' ||
                        TO_CHAR(TRUNC(SYSDATE + v_qtde_prog), 'DD/MM/RRRR') || '!';
        RAISE vsaida_erro;
      END IF;
      --
      IF pdt_saida_parc4 > ADD_MONTHS(pdt_fim_per_ferias, 12) THEN
        -- Adicionado por Igor Cardoso 12/07/2019 - Chamado 17969
        pflg_retorno := 'N';
        pmsg_retorno := 'Data de saída maior que o permitido na vigência de férias!';
        RAISE vsaida_erro;
      END IF;
      --
      ptipo_ferias4 := 'N';
      --
      IF v_cat_13m = 'N' THEN
        popcao_13sal4 := 'N';
      END IF;
      --+
      BEGIN
        --
        SELECT I.Situacao, (I.dt_situacao + s.QTD_MAX_DIAS) - 1
          INTO vl_cod, vl_dt_situacao
          FROM Informacoes_Funcionais_Cad I, SIT_FUNC S
         WHERE I.Cod_Empresa = pcod_empresa
           AND I.Matricula = pmatricula
           AND I.Situacao = '02'
           AND S.Cod = I.Situacao;
        --
        IF vl_cod = '02' AND pdt_saida_parc4 <= vl_dt_situacao THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Colaboradora em liçenca maternidade. A data de saída deve ser maior que ' ||
                          vl_dt_situacao || '.';
          RAISE vsaida_erro;
        END IF;
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          NULL;
      END;
      --
      OPEN c1;
      FETCH c1
        INTO v_c1;
      CLOSE c1;
      --
      BEGIN
        --
        SELECT QTDE_DIAS_CONTR_FER
          INTO QTDE_DIAS_CONTR_FER_
          FROM empresas_cad
         WHERE cod = pcod_empresa;
        --
      EXCEPTION
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Pkg_Ferias.Valida_Dt_Saida_Parc2/Vld_Segunda_Parcela - Erro: ' ||
                          SQLERRM;
          RAISE vsaida_erro;
      END;
      --
      IF pdt_saida_parc4 > (pdt_fim_per_ferias + qtde_dias_contr_fer_) /*AND v_c1.perc_dobro > 0*/
       THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A Data é Maior que ' ||
                        TO_CHAR((pdt_fim_per_ferias + qtde_dias_contr_fer_),
                                'DD/MM/YYYY') ||
                        ', a Mesma Deverá ser Paga em Dobro.';
        RAISE vsaida_erro;
      END IF;
      --
      pdt_retorno_parc4 := (pdt_saida_parc4 + pnum_dias_parc4);
      --------------------------------------------------------
      -- VERIFICA SE HA FERIAS CADASTRADAS PARA O MESMO MES --
      --------------------------------------------------------
      IF pdt_saida_parc2 = pdt_saida_parc4 THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Data de saída da 2a parcela é igual à 3a parcela!';
        RAISE vsaida_erro;
      END IF;
      --
      IF pdt_saida_parc4 < pdt_retorno_parc2 THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Saída da 3a parcela não pode ocorrer antes de ' ||
                        TO_CHAR(pdt_retorno_parc2, 'dd/mm/yyyy');
        RAISE vsaida_erro;
      END IF;
      --
      BEGIN
        --
        SELECT dt_vigencia, dt_vigencia_fim
          INTO wl_dt_ini, wl_dt_fim
          FROM HISTORICO_CADASTRAL
         WHERE (pdt_saida_parc4 >= wl_dt_ini AND
               pdt_saida_parc4 <= wl_dt_fim)
           AND cod_empresa = pcod_empresa
           AND matricula = pmatricula
           AND cod_fato = 1
           AND cod_valor_fato = '02';
        --
        IF SQL%FOUND THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Data de saída tem que ser superior ao final da data de gestação';
          RAISE vsaida_erro;
        END IF;
        --
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
      --
    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Ferias.Valida_Dt_Saida_Parc2/Vld_Segunda_Parcela - Erro: ' ||
                        SQLERRM;
    END Vld_Terceira_Parcela;
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    IF pdt_saida_parc4 IS NOT NULL AND pdt_saida_parc1 IS NULL AND
       pdt_saida_parc2 IS NULL THEN
      --
      OPEN c1;
      FETCH c1
        INTO v_c1;
      CLOSE c1;
      --
      IF v_c1.dt_saida_parc2 IS NULL THEN
        --
        pflg_retorno := 'N';
        pmsg_retorno := 'Antes de programar a 3ª parcela, a 2ª deve estar aprovada!';
        RAISE vsaida_erro;
        --
      END IF;
    END IF;
    --
    BEGIN
      --
      SELECT FILIAL
        INTO VFILIAL
        FROM INFORMACOES_FUNCIONAIS_CAD
       WHERE MATRICULA = PMATRICULA
         AND COD_EMPRESA = PCOD_EMPRESA;
      --
    EXCEPTION
      WHEN OTHERS THEN
        PFLG_RETORNO := 'N';
        PMSG_RETORNO := 'Erro ao buscar filial do colaborador!';
        RAISE VSAIDA_ERRO;
    END;
    --
    IF DATA_SAIDA_PARC_VALIDA(PDT_SAIDA_PARC4,
                              PCOD_EMPRESA,
                              VFILIAL,
                              PMATRICULA,
                              PFLG_RETORNO,
                              PMSG_RETORNO) = 'S' AND
       NVL(PFLG_RETORNO, 'S') = 'S' THEN
      -- Chamado 14368 28/09/2018
      --IF VALIDA_DT_SAIDA(PCOD_EMPRESA, PMATRICULA, PDT_SAIDA_PARC4, PMSG_RETORNO) = 'S' THEN
      NULL;
    ELSE
      RAISE VSAIDA_ERRO;
    END IF;
    --
    vld_terceira_parcela(pcod_empresa,
                         pmatricula,
                         pdt_inic_per_ferias,
                         pdt_fim_per_ferias,
                         pdt_saida_parc1,
                         pdt_retorno_parc1,
                         --                        pnum_dias_parc2,
                         pdt_saida_parc4,
                         pdt_retorno_parc4,
                         ptipo_ferias4,
                         popcao_13sal4,
                         pdias_direito, -- Humberto/Izidoro 03/03/2016
                         pdias_abono_pec1_dsp,
                         pnum_dias_parc1_dsp,
                         pflg_retorno,
                         pmsg_retorno);
    --
    IF NVL(pflg_retorno, 'S') <> 'S' THEN
      RAISE vsaida_erro;
    END IF;
    --
    --Bruno Sousa 22/10/2024
    --Esse paramentro usado para cancelamento das férias tbm sera usado para criar as parcelas de férias
    SELECT nvl(c.QTD_MAX_DIAS_FERIAS, 0)
      INTO V_QTD_MAX_DIAS_FERIAS
      FROM PARAMETROS_RECURSOS_HUMANOS c
     WHERE c.cod_empresa = pcod_empresa;
    -- Bruno Sousa 14/01/2026
    IF pdt_saida_parc4 < TRUNC(SYSDATE) + V_QTD_MAX_DIAS_FERIAS /*AND Vl_antecipa_parc_1 > 0*/
     THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'A data de saída deverá ser solicitada com antecedência de, no mínimo, ' ||
                      V_QTD_MAX_DIAS_FERIAS ||
                      ' dias. Data permitida à partir de ' ||
                      TO_CHAR(TRUNC(SYSDATE) + V_QTD_MAX_DIAS_FERIAS,
                              'dd/mm/rrrr') || '.';
      RAISE vsaida_erro;
      -- Comentado Bruno Sousa 08/01/2026 AND Vl_antecipa_parc_2 > 0
    ELSIF pdt_saida_parc4 <
          TRUNC(pdt_retorno_parc2) + V_QTD_MAX_DIAS_FERIAS /*AND Vl_antecipa_parc_2 > 0*/
     THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'A data de saída deverá ser solicitada com antecedência de, no mínimo, ' ||
                      V_QTD_MAX_DIAS_FERIAS ||
                      ' dias. Data permitida à partir de ' ||
                      TO_CHAR(TRUNC(pdt_retorno_parc2) +
                              V_QTD_MAX_DIAS_FERIAS,
                              'dd/mm/rrrr') || '.';
      RAISE vsaida_erro;
    END IF;
    IF pdt_saida_parc4 IS NOT NULL THEN
      --
      IF pdt_retorno_parc4 IS NOT NULL AND
         pdt_saida_parc4 >= pdt_retorno_parc4 THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A data de saída não pode ser maior ou igual à data de retorno!';
        RAISE vsaida_erro;
      END IF;
      --
      popcao_13sal4 := NVL(popcao_13sal4, 'N');
      --
      /*****/ -- Solicitação Rodrigo 05/08/2022 - Adicionado por Igor Sala
      IF pdt_saida_parc4 IS NOT NULL THEN
        prc_verif_limite_agend_ferias(pcod_empresa,
                                      pmatricula,
                                      pdt_saida_parc4,
                                      4,
                                      pdt_inic_per_ferias,
                                      pdt_fim_per_ferias,
                                      pflg_retorno,
                                      pmsg_retorno);
        IF pflg_retorno = 'N' THEN
          RAISE vsaida_erro;
        END IF;
      END IF;
      /*****/
      /*
      P4(pnum_dias_parc1,
         pdias_abono_pec1,
         pnum_dias_parc2,
         pdias_abono_pec2,
         pnum_dias_parc4,
         pdias_abono_pec4,
         PSALDO,
         pflg_retorno,
         pmsg_retorno);
         */
      IF NVL(pflg_retorno, 'S') <> 'S' THEN
        RAISE vsaida_erro;
      END IF;
      --
      BEGIN
        --
        SELECT a.filial
          INTO vfilial
          FROM informacoes_funcionais_cad a
         WHERE a.cod_empresa = pcod_empresa
           AND a.matricula = pmatricula;
        --
      EXCEPTION
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Pkg_Ferias.Valida_Dt_Saida_Parc2 - Erro ao buscar a filial do colaborador: ' ||
                          SQLERRM;
          RAISE vsaida_erro;
      END;
      --
      /*Bloqueia_Parc4(pcod_empresa,
      vfilial,
      pdt_saida_parc1,
      pnum_dias_parc1,
      pdias_abono_pec1,
      pdt_saida_parc2,
      pnum_dias_parc2,
      pdias_abono_pec2,
      pdt_fim_per_ferias,
      psaldo,
      pdias_direito, -- Humberto/Izidoro 03/03/2016
      popcao_13sal4,
      pdias_abono_pec1_dsp,
      pnum_dias_parc1_dsp,
      pflg_retorno,
      pmsg_retorno);*/
      --
      IF NVL(pflg_retorno, 'S') <> 'S' THEN
        RAISE vsaida_erro;
      END IF;
      --
      pdt_pagto_parc4 := retorna_dt_pagto(pcod_empresa,
                                          pmatricula,
                                          pdt_saida_parc4);
      --
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Dt_Saida_Parc2 - Erro: ' ||
                      SQLERRM;
  END Valida_Dt_Saida_Parc4;
  --
  PROCEDURE Dias_Parc4(pdt_saida_parc4    FERIAS.dt_saida_parc1%TYPE,
                       pdt_fim_per_ferias FERIAS.dt_fim_per_ferias%TYPE,
                       pnum_dias_PARC1    NUMBER,
                       pnum_dias_PARC2    NUMBER,
                       pnum_dias_PARC4    NUMBER,
                       pdias_abono_pec4   IN OUT FERIAS.dias_abono_pec1%TYPE,
                       pcod_empresa       empresas.cod%TYPE,
                       pmatricula         inf_pessoais.matricula%TYPE,
                       pflg_retorno       OUT VARCHAR2,
                       pmsg_retorno       OUT VARCHAR2) IS
    --
    CURSOR c1 IS
      SELECT a.qtd_parcelas, /*nvl(a.antecipa_parc_2, 0) antecipa_parc_2,*/
             nvl(a.valida_saldo_ferias, 'S') valida_saldo_ferias,
             a.QTDE_DIAS_DIREITO,
             a.FALTAS_FERIAS --, a.QTDE_DIAS_SEG_PERIODO
        FROM ferias_parametros a, informacoes_funcionais b
       WHERE a.cod_empresa = pcod_empresa
         AND b.cod_empresa = a.cod_empresa
         AND b.matricula = pmatricula
         AND a.cod_filial = b.filial;
    v_c1 c1%ROWTYPE;
    --
    CURSOR c2 IS
      SELECT f.dt_inic_per_ferias, f.dt_fim_per_ferias
        FROM ferias f
       WHERE f.cod_empresa = pcod_empresa
         AND f.matricula = pmatricula
         AND f.dt_fim_per_ferias = pdt_fim_per_ferias;
    v_c2 c2%ROWTYPE;
    --global_saldo NUMBER := NULL;
    v_saldo            number;
    v_jornada_reduzida REG_TRABALHO.jornada_reduzida%TYPE;
  BEGIN
    --
    BEGIN
      --
      SELECT B.JORNADA_REDUZIDA
        INTO V_JORNADA_REDUZIDA
        FROM informacoes_funcionais_cad A, REG_TRABALHO B
       WHERE A.cod_empresa = pcod_empresa
         AND A.matricula = pmatricula
         AND B.COD_EMPRESA = A.COD_EMPRESA
         AND B.COD = A.REG_TRAB;
      --
    EXCEPTION
      WHEN OTHERS THEN
        V_JORNADA_REDUZIDA := NULL;
    END;
    --
    --insert into testex values (888,'Dias_Parc2 -> num_dias_parc1: '||NVL(pnum_dias_parc1, 0));
    --insert into testex values (888,'Dias_Parc2 -> num_dias_parc2: '||NVL(pnum_dias_parc2, 0)); commit;
  
    OPEN c1;
    FETCH c1
      INTO v_c1;
    CLOSE c1;
    pflg_retorno := 'S';
    --
    --Bruno Sousa 15/03/2024 Comentado pois precisa validar o saldo
    --IF existe_p1(NULL,pcod_empresa,pmatricula,NULL,pdt_fim_per_ferias) THEN
    IF V_C1.Valida_Saldo_Ferias = 'S' /*AND V_C1.ANTECIPA_PARC_2 > 0*/
     THEN
      --global_saldo := NULL;
      --
      IF v_jornada_reduzida = 'N' THEN
        -- Humberto/Izidoro 07/03/2016: acrescentado jornada_reduzida
        --
        /*
        PFLG_RETORNO := 'N';
        PMSG_RETORNO := 'SALDO: '||psaldo||', pdt_saida_parc1: '||pdt_saida_parc1||', pdt_fim_per_ferias: '||pdt_fim_per_ferias||', pnum_dias_parc1: '||pnum_dias_parc1||', pdias_abono_pec1: '||pdias_abono_pec1;
        RAISE VSAIDA_ERRO;
        */
        begin
          OPEN c2;
          FETCH c2
            INTO v_c2;
          CLOSE c2;
        
          v_saldo := Pkg_Atlz_Saldo_Ferias.CALCULA_SALDO(COD_EMPRESA_        => pcod_empresa,
                                                         MATRICULA_          => pmatricula,
                                                         DT_INIC_            => V_C2.DT_INIC_PER_FERIAS,
                                                         DT_FIM_             => V_C2.DT_FIM_PER_FERIAS,
                                                         DT_REFERENCIA_      => pdt_saida_parc4,
                                                         V_QTDE_DIAS_DIREITO => V_C1.QTDE_DIAS_DIREITO,
                                                         V_FALTAS_FERIAS     => V_C1.FALTAS_FERIAS /*,
                                                                                                                                                                                                                                                                                                                                                                              V_QTDE_DIAS_SEG_PERIODO => V_C1.QTDE_DIAS_SEG_PERIODO*/);
        
        exception
          when others then
            v_saldo := 0;
        end;
      
        -- Em caso de antecipação de férias valida o saldo de dias que está sendo solicitado
        IF /* V_C1.antecipa_parc_2 > 0 AND*/
         NVL(pnum_dias_PARC1, 0) + NVL(pnum_dias_PARC2, 0) +
         NVL(pnum_dias_PARC4, 0) + NVL(pdias_abono_pec4, 0) > v_saldo THEN
          --global_saldo THEN
          --
          -- insert into testex values (888, 'num_dias_parc1: '||NVL(pnum_dias_parc1, 0)||' + dias_abono_pec1: '||NVL(pdias_abono_pec1, 0)||' > saldo: '||psaldo); commit;
        
          pflg_retorno := 'N';
          pmsg_retorno := 'A quantidade de dias da parcela não pode ser maior que ""' ||
                          (v_saldo - NVL(pnum_dias_PARC1, 0) -
                          NVL(pnum_dias_PARC2, 0)) || '""!';
          RAISE vsaida_erro;
          --
        ELSIF NVL(pnum_dias_PARC1, 0) + NVL(pnum_dias_PARC2, 0) +
              NVL(pnum_dias_PARC4, 0) + NVL(pdias_abono_pec4, 0) <= v_saldo THEN
          --global_saldo THEN
          --
          IF v_c1.qtd_parcelas = 1 THEN
            --
          
            -- Comentado para implementar a terceira parcela com parametrizacao por empresa. Igor Cardoso  04/05/2018
            NULL;
            /*IF psaldo = 30 THEN
              IF pnum_dias_parc1 <> 20 THEN
                pflg_retorno := 'N';
                pmsg_retorno := 'O valor para este campo deve ser 20 ou 30! Saldo atual: ' ||
                                psaldo || '.';
                RAISE vsaida_erro;
              ELSIF pnum_dias_parc1 = 20 THEN
                pdias_abono_pec1 := 10;
              END IF;
            END IF;*/
            --
            /* IF psaldo = 24 THEN
              IF pnum_dias_parc1 <> 16 THEN
                pflg_retorno := 'N';
                pmsg_retorno := 'O valor para este campo deve ser 16 ou 24! Saldo atual: ' ||
                                psaldo || '.';
                RAISE vsaida_erro;
              ELSIF pnum_dias_parc1 = 16 THEN
                pdias_abono_pec1 := 8;
              END IF;
              --
            END IF;*/
            --
            /*IF psaldo = 18 THEN
              IF pnum_dias_parc1 <> 12 THEN
                pflg_retorno := 'N';
                pmsg_retorno := 'O valor para este campo deve ser 12 ou 18! Saldo atual: ' ||
                                psaldo || '.';
                RAISE vsaida_erro;
              ELSIF pnum_dias_parc1 = 12 THEN
                pdias_abono_pec1 := 6;
              END IF;
            END IF;*/
            --
            /*IF psaldo = 12 THEN
              IF pnum_dias_parc1 <> 8 THEN
                pflg_retorno := 'N';
                pmsg_retorno := 'O valor para este campo deve ser 8 ou 12! Saldo atual: ' ||
                                psaldo || '.';
                RAISE vsaida_erro;
              ELSIF pnum_dias_parc1 = 8 THEN
                pdias_abono_pec1 := 4;
              END IF;
            END IF;*/
            --
            /*IF psaldo = 0 THEN
              IF pnum_dias_parc1 <> 0 THEN
                pflg_retorno     := 'N';
                pmsg_retorno     := 'O valor para este campo deve ser 0! Saldo atual: ' ||psaldo || '.';
                pdias_abono_pec1 := 0;
                RAISE vsaida_erro;
              END IF;
            END IF;*/
          
          ELSIF v_c1.qtd_parcelas >= 2 THEN
            --
            -- Comentado para implementar a terceira parcela com parametrizacao por empresa. Igor Cardoso  04/05/2018
            NULL;
            /*
            if psaldo = 30
            and pnum_dias_parc1 not in(30, 15, 20, 10) then
               pflg_retorno := 'N';
               pmsg_retorno := 'Só é permitido informar: 10, 20, 15, ou 30 dias!';
               raise vsaida_erro;
            end if;
            */
            --
          END IF;
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
      pmsg_retorno := 'Pkg_Ferias.Dias_Parc1 - Erro: ' || SQLERRM;
  END Dias_Parc4;
  --
  PROCEDURE Valida_Num_Dias_Parc4(pcod_empresa             EMPRESAS.cod%TYPE,
                                  pmatricula               INF_PESSOAIS.matricula%TYPE,
                                  pnum_dias_parc1          NUMBER,
                                  pnum_dias_parc2          NUMBER,
                                  pnum_dias_parc4          IN OUT NUMBER, -- ACRESCENTADO IN OUT 21/09/2018
                                  pdias_abono_pec1         FERIAS.dias_abono_pec1%TYPE,
                                  pdias_abono_pec2         FERIAS.dias_abono_pec2%TYPE,
                                  pdt_saida_parc2          FERIAS.dt_saida_parc2%TYPE,
                                  pdt_saida_parc4          FERIAS.dt_saida_parc2%TYPE,
                                  pdt_inic_per_ferias      FERIAS.dt_inic_per_ferias%TYPE,
                                  pdt_fim_per_ferias       FERIAS.dt_fim_per_ferias%TYPE,
                                  pdias_descanso_adicional FERIAS.dias_descanso_adicional%TYPE,
                                  PIND_SITUACAO_PERIODO    FERIAS.IND_SITUACAO_PERIODO%TYPE, -- ACRESCENTAR NA CHAMADA DO APEX 21/09/2018
                                  PSALDO                   FERIAS.SALDO%TYPE, -- ACRESCENTAR NA CHAMADA DO APEX 21/09/2018
                                  Pind_situacao_parc_2     ferias.ind_situacao_parc_2%TYPE, -- ACRESCENTAR NA CHAMADA DO APEX 21/09/2018
                                  pdias_abono_pec4         IN OUT FERIAS.dias_abono_pec2%TYPE,
                                  ptipo_ferias4            IN OUT FERIAS.tipo_ferias2%TYPE,
                                  pdesc_adicional1         IN OUT FERIAS.desc_adicional1%TYPE,
                                  pdesc_adicional2         IN OUT FERIAS.desc_adicional2%TYPE,
                                  pdesc_adicional4         IN OUT FERIAS.desc_adicional4%TYPE,
                                  pdt_retorno_parc4        IN OUT FERIAS.dt_retorno_parc4%TYPE,
                                  pdias_direito            NUMBER,
                                  pflg_retorno             IN OUT VARCHAR2,
                                  pmsg_retorno             IN OUT VARCHAR2,
                                  PUSUARIO                 VARCHAR2 DEFAULT NULL -- ACRESCENTAR NA CHAMADA DO APEX 21/09/2018
                                  ) IS
    vcod_filial     filiais.cod_filial%TYPE;
    v_qtde_min_dias ferias_parametros.qtde_minimo_dias%TYPE DEFAULT 0;
    v_qtde_tot_dias ferias.saldo%TYPE DEFAULT 0;
    var             NUMBER;
    vdisponivel_aux NUMBER := 0;
    nodatafound     EXCEPTION;
    --
    CURSOR c1 IS
      SELECT *
        FROM ferias
       WHERE dt_inic_per_ferias = pdt_inic_per_ferias
         AND matricula = pmatricula
         AND cod_empresa = pcod_empresa;
    v_c1 c1%ROWTYPE;
    --
    CURSOR c2 IS
      SELECT *
        FROM ferias
       WHERE dt_inic_per_ferias = pdt_inic_per_ferias
         AND matricula = pmatricula
         AND cod_empresa = pcod_empresa;
    v_c2 c2%ROWTYPE;
    --
    PROCEDURE VALIDA_BONUS_FERIAS3_APEX /*(PCOD_EMPRESA             NUMBER,
                                                           PMATRICULA               NUMBER,
                                                           Pdias_descanso_adicional FERIAS.DIAS_DESCANSO_ADICIONAL%TYPE,
                                                           Pnum_dias_parc2          FERIAS.num_dias_parc2%TYPE,
                                                           Pdesc_adicional1         IN OUT FERIAS.DESC_ADICIONAL1%TYPE,
                                                           Pnum_dias_parc4          IN OUT FERIAS.num_dias_parc4%TYPE,
                                                           Pdesc_adicional4         IN OUT FERIAS.DESC_ADICIONAL4%TYPE,
                                                           PFLG_RETORNO             IN OUT VARCHAR2,
                                                           PMSG_RETORNO             IN OUT VARCHAR2)*/
     IS
    
      vl_abono_ferias   ferias_parametros.abono_ferias%TYPE;
      vl_num_dias_parc4 ferias.num_dias_parc1%TYPE;
      --vl_dias_abono_pec4 ferias.dias_abono_pec1%TYPE;
      vl_desc_adicional4 ferias.desc_adicional1%TYPE;
      numero_filial      informacoes_funcionais.filial%TYPE;
      vl_dias_comparar   NUMBER(2) := 0;
    
    BEGIN
    
      BEGIN
      
        SELECT filial
          INTO numero_filial
          FROM informacoes_funcionais
         WHERE cod_empresa = Pcod_empresa
           AND matricula = Pmatricula;
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;
    
      BEGIN
      
        SELECT abono_ferias
          INTO vl_abono_ferias
          FROM ferias_parametros
         WHERE cod_empresa = Pcod_empresa
           AND cod_filial = numero_filial;
      
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          vl_abono_ferias := 0;
        WHEN TOO_MANY_ROWS THEN
          vl_abono_ferias := 0;
      END;
    
      IF vl_abono_ferias = 1 THEN
      
        BEGIN
        
          SELECT DISTINCT prfer.dias_descanso, prfer.desc_adicional
            INTO vl_num_dias_parc4, vl_desc_adicional4
            FROM param_regra_ferias     prfer,
                 categoria_ferias       cfer,
                 regra_ferias           rfer,
                 categ_ferias_x_ccusto  ctgf,
                 informacoes_funcionais func,
                 cargos                 crga
           WHERE rfer.id_regra_ferias = cfer.id_regra_ferias
             AND rfer.id_regra_ferias = prfer.id_regra_ferias
             AND cfer.id_categoria_ferias = ctgf.id_categoria_ferias(+)
             AND func.matricula = Pmatricula
             AND FUNC.cargo = crga.cod
                --and prfer.desc_adicional                 <= :ferias.dias_descanso_adicional
             AND prfer.desc_adicional <=
                 (Pdias_descanso_adicional + NVL(Pdesc_adicional1, 0))
             AND crga.class_cargo = cfer.cod_class_cargo
             AND prfer.dias_descanso = Pnum_dias_parc2;
        
          Pnum_dias_parc4  := vl_num_dias_parc4;
          Pdesc_adicional4 := vl_desc_adicional4;
        EXCEPTION
          WHEN TOO_MANY_ROWS THEN
            BEGIN
            
              IF Pdias_descanso_adicional = 12 THEN
                vl_dias_comparar := 11;
              ELSIF Pdias_descanso_adicional = 5 THEN
                vl_dias_comparar := 4;
              END IF;
            
              SELECT DISTINCT prfer.dias_descanso, prfer.desc_adicional
                INTO vl_num_dias_parc4, vl_desc_adicional4
                FROM param_regra_ferias     prfer,
                     categoria_ferias       cfer,
                     regra_ferias           rfer,
                     categ_ferias_x_ccusto  ctgf,
                     informacoes_funcionais func,
                     cargos                 crga
               WHERE rfer.id_regra_ferias = cfer.id_regra_ferias
                 AND rfer.id_regra_ferias = prfer.id_regra_ferias
                 AND cfer.id_categoria_ferias = ctgf.id_categoria_ferias(+)
                 AND func.matricula = Pmatricula
                 AND FUNC.cargo = crga.cod
                    --         AND PRFER.DIREITO_ADQUIRIDO              = ( NVL(prfer.dias_descanso,0) + NVL(prfer.desc_adicional,0) )
                 AND prfer.desc_adicional = vl_dias_comparar
                 AND crga.class_cargo = cfer.cod_class_cargo
                 AND prfer.dias_descanso = Pnum_dias_parc2;
            
              Pnum_dias_parc4  := vl_num_dias_parc4;
              Pdesc_adicional4 := vl_desc_adicional4;
            
            EXCEPTION
            
              WHEN NO_DATA_FOUND THEN
              
                BEGIN
                  SELECT DISTINCT prfer.dias_descanso, prfer.desc_adicional
                    INTO vl_num_dias_parc4, vl_desc_adicional4
                    FROM param_regra_ferias     prfer,
                         categoria_ferias       cfer,
                         regra_ferias           rfer,
                         informacoes_funcionais func,
                         cargos                 crga
                   WHERE rfer.id_regra_ferias = cfer.id_regra_ferias
                     AND rfer.id_regra_ferias = prfer.id_regra_ferias
                     AND func.matricula = Pmatricula
                     AND FUNC.cargo = crga.cod
                     AND crga.class_cargo = cfer.cod_class_cargo
                     AND prfer.dias_descanso = Pnum_dias_parc4
                     AND prfer.desc_adicional <= (Pdias_descanso_adicional +
                         NVL(Pdesc_adicional1, 0))
                     AND cfer.id_categoria_ferias NOT IN
                         (SELECT ctgf.id_categoria_ferias
                            FROM categ_ferias_x_ccusto ctgf
                           WHERE ctgf.id_categoria_ferias =
                                 cfer.id_categoria_ferias);
                EXCEPTION
                  WHEN NO_DATA_FOUND THEN
                  
                    --vl_num_dias_parc4       := 0;
                    --vl_desc_adicional4      := 0;
                    Pdesc_adicional1 := 0;
                  WHEN TOO_MANY_ROWS THEN
                    NULL;
                    --vl_num_dias_parc4  := 0;
                  --vl_desc_adicional4 := 0;
                END;
            END;
        END;
      
      END IF;
    
      IF (NVL(Pdesc_adicional4, 0) > 0) THEN
        Pdesc_adicional4 := Pdias_descanso_adicional - Pdesc_adicional1;
      END IF;
    EXCEPTION
      WHEN VSAIDA_ERRO THEN
        NULL;
      WHEN OTHERS THEN
        PFLG_RETORNO := 'N';
        PMSG_RETORNO := SUBSTR('Erro VALIDA_BONUS_FERIAS3_APEX: ' ||
                               SQLERRM,
                               1,
                               4000);
    END VALIDA_BONUS_FERIAS3_APEX;
    --
  BEGIN
    --
    PFLG_RETORNO := 'S';
    --
    OPEN c2;
    FETCH c2
      INTO v_c2;
    CLOSE c2;
    --
    BEGIN
      --
      SELECT filial
        INTO vcod_filial
        FROM informacoes_funcionais_cad
       WHERE matricula = pmatricula
         AND cod_empresa = pcod_empresa;
      --
    EXCEPTION
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := SUBSTR('Erro ao buscar filial do colaborador: ' ||
                               SQLERRM,
                               1,
                               4000);
        RAISE vsaida_erro;
    END;
    --
    OPEN c1;
    FETCH c1
      INTO v_c1;
    CLOSE c1;
    --
    IF funcFeriasParamParcela_APEX(pcod_empresa,
                                   vcod_filial,
                                   NVL(pnum_dias_parc1, v_c1.num_dias_parc1),
                                   NVL(pnum_dias_parc2, v_c1.num_dias_parc2),
                                   pnum_dias_parc4) THEN
      var := 1;
    ELSE
      RAISE nodatafound;
    END IF;
    --<<
    --
    IF var = 1 AND pnum_dias_parc4 <> 0 AND pnum_dias_parc4 IS NOT NULL THEN
      BEGIN
        /* ?????????????????????????????????????
        PRC_USUARIO_FERIAS_APEX(4
                        ,PCOD_EMPRESA
                        ,PMATRICULA
                        ,PDT_INIC_PER_FERIAS
                        ,PDT_FIM_PER_FERIAS
                        ,PFLG_RETORNO
                        ,PMSG_RETORNO
                        ,PUSUARIO);
         */
        IF NVL(PFLG_RETORNO, 'S') <> 'S' THEN
          RAISE VSAIDA_ERRO;
        END IF;
      
        BEGIN
          SELECT fer.qtde_minimo_dias
            INTO v_qtde_min_dias
            FROM ferias_parametros fer, inf_pessoais inf
           WHERE inf.cod_empresa = fer.cod_empresa
             AND inf.cod_empresa = Pcod_empresa
             AND inf.matricula = Pmatricula
             AND inf.filial = fer.cod_filial;
        EXCEPTION
          WHEN NO_DATA_FOUND THEN
            v_qtde_min_dias := 0;
          WHEN OTHERS THEN
            v_qtde_min_dias := 0;
        END;
      
        v_qtde_tot_dias := NVL(Pnum_dias_parc2, 0); -- + nvl(:ferias.dias_abono_pec2,0);
      
        --            if nvl(:ferias.ind_limpa,'N') = 'N' then -- O valor é S somente qdo solicitado cancelamento da P1
      
        IF NVL(v_qtde_tot_dias, 0) > 0 AND
           v_qtde_tot_dias < NVL(v_qtde_min_dias, 0) AND
           pdias_direito >= 30 THEN
          -- Humberto/Izidoro 29/09/2014: Acrescentado dias_direito >= 30
          pflg_retorno := 'N';
          pmsg_retorno := 'Mínimo de dias do Parâmetro de Férias, é maior que o informado. Verifique Parâmetros de Férias da Filial desse funcionário.';
          RAISE vsaida_erro;
        END IF;
        --            end if;
      END;
    
      IF NVL(pnum_dias_parc4, 0) = 0 AND NVL(pDIAS_ABONO_PEC4, 0) = 0 THEN
        Ptipo_ferias4 := NULL;
      ELSE
        Ptipo_ferias4 := 'N';
      END IF;
    
      DECLARE
        disponivel     NUMBER;
        v_qtd_parcelas ferias_parametros.qtd_parcelas%TYPE DEFAULT 0;
      
      BEGIN
        BEGIN
          SELECT a.qtd_parcelas
            INTO v_qtd_parcelas
            FROM ferias_parametros a
           WHERE a.cod_empresa = Pcod_empresa
             AND a.cod_filial IN
                 (SELECT x.filial
                    FROM informacoes_funcionais x
                   WHERE x.cod_empresa = Pcod_empresa
                     AND x.matricula = Pmatricula);
        EXCEPTION
          WHEN OTHERS THEN
            v_qtd_parcelas := 3;
        END;
      
        IF Pdt_saida_parc4 IS NOT NULL THEN
          -- Humberto/Izidoro 29/09/2014: Alterado de 30 para dias_direito
          vdisponivel_aux := pdias_direito - NVL(Pdias_abono_pec4, 0);
          IF NVL(v_c2.ind_situacao_parc_1, 'P') <> 'C' THEN
            vdisponivel_aux := vdisponivel_aux - (NVL(pnum_dias_parc1, 0) +
                               NVL(pdias_abono_pec1, 0));
          END IF;
          IF NVL(v_c2.ind_situacao_parc_2, 'P') <> 'C' THEN
            vdisponivel_aux := vdisponivel_aux - (NVL(pnum_dias_parc2, 0) +
                               NVL(pdias_abono_pec2, 0));
          END IF;
          --
          IF Pnum_dias_parc4 > vdisponivel_aux THEN
            -- Humberto/Izidoro 29/09/2014: Alterado de 30 para :dias_direito
            disponivel   := vdisponivel_aux;
            PFLG_RETORNO := 'N';
            PMSG_RETORNO := 'Numero de dias de Ferias maior que ' ||
                            TO_CHAR(disponivel) || '. Favor corrigir.';
            RAISE VSAIDA_ERRO;
          ELSIF Pnum_dias_parc4 < vdisponivel_aux THEN
            IF v_qtd_parcelas = 3 THEN
              disponivel   := vdisponivel_aux;
              PFLG_RETORNO := 'N';
              PMSG_RETORNO := 'Numero de dias de Ferias menor que ' ||
                              TO_CHAR(disponivel) || '. Favor corrigir.';
              RAISE VSAIDA_ERRO;
            END IF;
          END IF;
        END IF;
      END;
    
      IF Pnum_dias_parc4 = 0 THEN
        Pdesc_adicional4 := 0;
      END IF;
    
      IF NVL(Pdias_descanso_adicional, 0) > 0 THEN
        valida_bonus_ferias3_APEX;
      END IF;
    
      --PFLG_RETORNO := 'N';
      -- := TO_CHAR(Pdt_saida_parc4,'DD/MM/RRRR')||' + '||NVL(Pnum_dias_parc4,0)||' + '||NVL(Pdesc_adicional4,0);
      --RAISE VSAIDA_ERRO;
    END IF;
  
    IF Pdt_saida_parc4 IS NOT NULL AND NVL(Pnum_dias_parc4, 0) > 0 THEN
      Pdt_retorno_parc4 := (Pdt_saida_parc4 + NVL(Pnum_dias_parc4, 0) +
                           NVL(Pdesc_adicional4, 0));
    END IF;
    --    Pdt_retorno_parc4 := to_date('18/10/2018','dd/mm/rrrr');
  
    Dias_Parc4(pdt_saida_parc4,
               pdt_fim_per_ferias,
               pnum_dias_parc1,
               pnum_dias_parc2,
               pnum_dias_parc4,
               pdias_abono_pec4,
               pcod_empresa,
               pmatricula,
               pflg_retorno,
               pmsg_retorno);
    --
    IF pflg_retorno = 'N' THEN
      RAISE vsaida_erro;
    END IF;
  
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN nodatafound THEN
      IF pnum_dias_parc4 <> 0 OR pnum_dias_parc4 IS NOT NULL THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'P4 - Quantidade de dias não encontrada na parametrização, favor alterar.';
      END IF;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := SUBSTR('Erro ao validar o número de dias informado: ' ||
                             SQLERRM,
                             1,
                             4000);
  END Valida_Num_Dias_Parc4;
  --
  PROCEDURE Valida_Num_Dias_Parc4_old(pcod_empresa             EMPRESAS.cod%TYPE,
                                      pmatricula               INF_PESSOAIS.matricula%TYPE,
                                      pnum_dias_parc1          NUMBER,
                                      pnum_dias_parc2          NUMBER,
                                      pnum_dias_parc4          NUMBER,
                                      pdias_abono_pec1         FERIAS.dias_abono_pec1%TYPE,
                                      pdias_abono_pec2         FERIAS.dias_abono_pec2%TYPE,
                                      pdt_saida_parc2          FERIAS.dt_saida_parc2%TYPE,
                                      pdt_saida_parc4          FERIAS.dt_saida_parc2%TYPE,
                                      pdt_inic_per_ferias      FERIAS.dt_inic_per_ferias%TYPE,
                                      pdt_fim_per_ferias       FERIAS.dt_fim_per_ferias%TYPE,
                                      pdias_descanso_adicional FERIAS.dias_descanso_adicional%TYPE,
                                      pdias_abono_pec4         IN OUT FERIAS.dias_abono_pec2%TYPE,
                                      ptipo_ferias4            IN OUT FERIAS.tipo_ferias2%TYPE,
                                      pdesc_adicional1         IN OUT FERIAS.desc_adicional1%TYPE,
                                      pdesc_adicional2         IN OUT FERIAS.desc_adicional2%TYPE,
                                      pdesc_adicional4         IN OUT FERIAS.desc_adicional4%TYPE,
                                      pdt_retorno_parc4        IN OUT FERIAS.dt_retorno_parc4%TYPE,
                                      pdias_direito            NUMBER,
                                      pusuario                 VARCHAR2,
                                      pflg_retorno             IN OUT VARCHAR2,
                                      pmsg_retorno             IN OUT VARCHAR2) IS
    --
    v_qtde_min_dias FERIAS_PARAMETROS.qtde_minimo_dias%TYPE DEFAULT 0;
    --v_qtde_tot_dias  ferias.saldo%TYPE DEFAULT 0;
  
    abono_ferias   VARCHAR2(1);
    v_qtd_parcelas ferias_parametros.qtd_parcelas%TYPE DEFAULT 0;
    -- disponivel number;
    --v_jornada_reduzida REG_TRABALHO.jornada_reduzida%TYPE;
    --v_saldo         ferias.saldo%TYPE;
    --
    CURSOR c1 IS
      SELECT dt_saida_parc1,
             sit_requisicao,
             num_dias_parc1,
             desc_adicional1,
             dt_saida_parc2,
             num_dias_parc2,
             desc_adicional2,
             ind_situacao_periodo
        FROM REQUISICAO_FERIAS
       WHERE cod_empresa = pcod_empresa
         AND matricula = pmatricula
         AND dt_saida_parc1 < pdt_saida_parc2
         AND dt_saida_parc2 < pdt_saida_parc4
         AND dt_saida_parc4 IS NULL
         AND sit_requisicao = '5' -- aprovada
         AND DT_INIC_PER_FERIAS = pdt_inic_per_ferias
         AND DT_FIM_PER_FERIAS = pdt_fim_per_Ferias;
    --
    v_c1 c1%ROWTYPE;
    --
    /*
    PROCEDURE PRC_USUARIO_FERIAS (TIPO NUMBER , Usuario VARCHAR2) IS
    BEGIN
       NULL;
       -- ?????????????????????????????????????
         IF TIPO = 1 THEN
             UPDATE FERIAS
             SET USUARIO_PROG = Usuario
                 ,DT_ATUALIZACAO_PROG = SYSDATE
              WHERE COD_EMPRESA         = PCOD_EMPRESA
                AND MATRICULA           = PMATRICULA
                AND DT_INIC_PER_FERIAS  = PDT_INIC_PER_FERIAS
                AND DT_FIM_PER_FERIAS   = PDT_FIM_PER_FERIAS;
         ELSIF TIPO = 2 THEN
              UPDATE FERIAS
             SET USUARIO_PROG2 = Usuario
                 ,DT_ATUALIZACAO_PROG2 = SYSDATE
              WHERE COD_EMPRESA       = PCOD_EMPRESA
                AND MATRICULA           = PMATRICULA
                AND DT_INIC_PER_FERIAS  = PDT_INIC_PER_FERIAS
                AND DT_FIM_PER_FERIAS   = PDT_FIM_PER_FERIAS;
    
         ELSIF TIPO = 3 THEN
           UPDATE FERIAS
             SET USUARIO_PROG_COL = Usuario
                 ,DT_ATUALIZACAO_PROG_COL = SYSDATE
              WHERE COD_EMPRESA       = PCOD_EMPRESA
                AND MATRICULA           = PMATRICULA
                AND DT_INIC_PER_FERIAS  = PDT_INIC_PER_FERIAS
                AND DT_FIM_PER_FERIAS   = PDT_FIM_PER_FERIAS;
    
         ELSIF TIPO = 4 THEN
              UPDATE FERIAS
             SET USUARIO_PROG4 = Usuario
                 ,DT_ATUALIZACAO_PROG4 = SYSDATE
              WHERE COD_EMPRESA       = PCOD_EMPRESA
                AND MATRICULA           = PMATRICULA
                AND DT_INIC_PER_FERIAS  = PDT_INIC_PER_FERIAS
                AND DT_FIM_PER_FERIAS   = PDT_FIM_PER_FERIAS;
    
         END IF;
         
         EXCEPTION
             WHEN OTHERS THEN
        pflg_retorno := 'N';
             pmsg_retorno := 'Erro ao Atualizar tabela de Férias: '||SQLERRM;
             RAISE vsaida_erro;
    END prc_usuario_ferias;
    */
    --
    PROCEDURE Vld_Bonus_Ferias4(pcod_empresa             EMPRESAS.cod%TYPE,
                                pmatricula               INF_PESSOAIS.matricula%TYPE,
                                pdias_descanso_adicional FERIAS.dias_descanso_adicional%TYPE,
                                pnum_dias_parc2          FERIAS.num_dias_parc2%TYPE,
                                pdesc_adicional2         FERIAS.num_dias_parc2%TYPE,
                                pnum_dias_parc4          FERIAS.num_dias_parc2%TYPE,
                                pdesc_adicional4         IN OUT FERIAS.desc_adicional2%TYPE,
                                pflg_retorno             IN OUT VARCHAR2,
                                pmsg_retorno             IN OUT VARCHAR2) IS
      --
      vl_abono_ferias    FERIAS_PARAMETROS.abono_ferias%TYPE;
      vl_num_dias_parc4  FERIAS.num_dias_parc1%TYPE;
      vl_desc_adicional4 FERIAS.desc_adicional1%TYPE;
      vfilial            INFORMACOES_FUNCIONAIS.filial%TYPE;
      vl_dias_comparar   NUMBER(2) := 0;
      --
    BEGIN
      --
      pflg_retorno := 'S';
      --
      BEGIN
        --
        SELECT filial
          INTO vfilial
          FROM informacoes_funcionais_cad
         WHERE cod_empresa = pcod_empresa
           AND matricula = pmatricula;
        --
      EXCEPTION
        WHEN OTHERS THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Pkg_Ferias.Vld_Bonus_Ferias2 - Erro ao buscar filial: ' ||
                          SQLERRM;
          RAISE vsaida_erro;
      END;
      --
      BEGIN
        --
        SELECT abono_ferias
          INTO vl_abono_ferias
          FROM FERIAS_PARAMETROS
         WHERE cod_empresa = pcod_empresa
           AND cod_filial = vfilial;
        --
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          vl_abono_ferias := 0;
        WHEN TOO_MANY_ROWS THEN
          vl_abono_ferias := 0;
      END;
      --
      IF vl_abono_ferias = 1 THEN
        --
        BEGIN
          --
          SELECT DISTINCT prfer.dias_descanso, prfer.desc_adicional
            INTO vl_num_dias_parc4, vl_desc_adicional4
            FROM PARAM_REGRA_FERIAS         prfer,
                 CATEGORIA_FERIAS           cfer,
                 REGRA_FERIAS               rfer,
                 CATEG_FERIAS_X_CCUSTO      ctgf,
                 informacoes_funcionais_cad FUNC,
                 CARGOS                     crga
           WHERE rfer.id_regra_ferias = cfer.id_regra_ferias
             AND rfer.id_regra_ferias = prfer.id_regra_ferias
             AND cfer.id_categoria_ferias = ctgf.id_categoria_ferias(+)
             AND FUNC.matricula = pmatricula
             AND FUNC.cargo = crga.cod
             AND prfer.desc_adicional <=
                 (pdias_descanso_adicional + NVL(pdesc_adicional1, 0) +
                 NVL(pdesc_adicional2, 0))
             AND crga.CLASS_CARGO = cfer.cod_class_cargo
             AND prfer.dias_descanso = pnum_dias_parc4;
          --
          --          pnum_dias_parc4  := vl_num_dias_parc4;
          pdesc_adicional4 := vl_desc_adicional4;
          --
        EXCEPTION
          WHEN TOO_MANY_ROWS THEN
            BEGIN
              --
              IF pdias_descanso_adicional = 12 THEN
                vl_dias_comparar := 11;
              ELSIF pdias_descanso_adicional = 5 THEN
                vl_dias_comparar := 4;
              END IF;
              --
              SELECT DISTINCT prfer.dias_descanso, prfer.desc_adicional
                INTO vl_num_dias_parc4, vl_desc_adicional4
                FROM PARAM_REGRA_FERIAS         prfer,
                     CATEGORIA_FERIAS           cfer,
                     REGRA_FERIAS               rfer,
                     CATEG_FERIAS_X_CCUSTO      ctgf,
                     informacoes_funcionais_cad FUNC,
                     CARGOS                     crga
               WHERE rfer.id_regra_ferias = cfer.id_regra_ferias
                 AND rfer.id_regra_ferias = prfer.id_regra_ferias
                 AND cfer.id_categoria_ferias = ctgf.id_categoria_ferias(+)
                 AND FUNC.matricula = pmatricula
                 AND FUNC.cargo = crga.cod
                 AND prfer.desc_adicional = vl_dias_comparar
                 AND crga.CLASS_CARGO = cfer.cod_class_cargo
                 AND prfer.dias_descanso = pnum_dias_parc4;
              --
              --              pnum_dias_parc2  := vl_num_dias_parc2;
              pdesc_adicional4 := vl_desc_adicional4;
              --
            EXCEPTION
              WHEN NO_DATA_FOUND THEN
              
                BEGIN
                  SELECT DISTINCT prfer.dias_descanso, prfer.desc_adicional
                    INTO vl_num_dias_parc4, vl_desc_adicional4
                    FROM param_regra_ferias     prfer,
                         categoria_ferias       cfer,
                         regra_ferias           rfer,
                         informacoes_funcionais func,
                         cargos                 crga
                   WHERE rfer.id_regra_ferias = cfer.id_regra_ferias
                     AND rfer.id_regra_ferias = prfer.id_regra_ferias
                     AND func.matricula = pmatricula
                     AND FUNC.cargo = crga.cod
                     AND crga.class_cargo = cfer.cod_class_cargo
                     AND prfer.dias_descanso = pnum_dias_parc4
                     AND prfer.desc_adicional <= (pdias_descanso_adicional +
                         NVL(pdesc_adicional1, 0) +
                         NVL(pdesc_adicional2, 0))
                     AND cfer.id_categoria_ferias NOT IN
                         (SELECT ctgf.id_categoria_ferias
                            FROM categ_ferias_x_ccusto ctgf
                           WHERE ctgf.id_categoria_ferias =
                                 cfer.id_categoria_ferias);
                EXCEPTION
                  WHEN NO_DATA_FOUND THEN
                  
                    --vl_num_dias_parc4  := 0;
                    --vl_desc_adicional4 := 0;
                    pdesc_adicional1 := 0;
                    -- pdesc_adicional2  := 0;
                  WHEN TOO_MANY_ROWS THEN
                    NULL;
                    --vl_num_dias_parc4  := 0;
                  --vl_desc_adicional4 := 0;
                END;
              
            END;
          
        END;
        --
      END IF;
      --
      IF (NVL(pdesc_adicional4, 0) > 0) THEN
        pdesc_adicional4 := pdias_descanso_adicional - pdesc_adicional1 -
                            pdesc_adicional2;
      END IF;
      --
    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Ferias.Vld_Bonus_Ferias2 - Erro: ' || SQLERRM;
    END Vld_Bonus_Ferias4;
    --
  BEGIN
    --
    pflg_retorno := 'S';
  
    -- PRC_USUARIO_FERIAS(2);
  
    BEGIN
      SELECT fer.qtde_minimo_dias
        INTO v_qtde_min_dias
        FROM ferias_parametros fer, inf_pessoais inf
       WHERE inf.cod_empresa = fer.cod_empresa
         AND inf.cod_empresa = pcod_empresa
         AND inf.matricula = pmatricula
         AND inf.filial = fer.cod_filial;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        v_qtde_min_dias := 0;
      WHEN OTHERS THEN
        v_qtde_min_dias := 0;
    END;
  
    --v_qtde_tot_dias := NVL(pnum_dias_parc4,0);-- + nvl(:ferias.dias_abono_pec2,0);
  
    IF NVL(pnum_dias_parc4, 0) = 0 AND NVL(pDIAS_ABONO_PEC4, 0) = 0 THEN
      ptipo_ferias4 := NULL;
    ELSE
      ptipo_ferias4 := 'N';
    END IF;
  
    --
    -- Validação dos dias de férias, a pedido de Ana Camillo e Alex Yamada,
    -- passou a considerar sempre 30 dias como saldo de férias, independente
    -- de quantos dias o funcionário possua para gozo de férias
    --
    IF pnum_dias_parc4 IS NOT NULL THEN
      --
      OPEN c1;
      FETCH c1
        INTO v_C1;
      CLOSE c1;
      --
      BEGIN
        BEGIN
          SELECT fer.qtde_minimo_dias
            INTO v_qtde_min_dias
            FROM FERIAS_PARAMETROS fer, inf_pessoais_cad inf
           WHERE inf.cod_empresa = fer.cod_empresa
             AND inf.cod_empresa = pcod_empresa
             AND inf.matricula = pmatricula
             AND inf.filial = fer.cod_filial;
        
        EXCEPTION
          WHEN NO_DATA_FOUND THEN
            v_qtde_min_dias := 0;
          WHEN OTHERS THEN
            v_qtde_min_dias := 0;
        END;
        --
        --DECLARE
        --  disponivel NUMBER;
        BEGIN
        
          BEGIN
            SELECT a.qtd_parcelas
              INTO v_qtd_parcelas
              FROM ferias_parametros a
             WHERE a.cod_empresa = pcod_empresa
               AND a.cod_filial IN
                   (SELECT x.filial
                      FROM informacoes_funcionais x
                     WHERE x.cod_empresa = pcod_empresa
                       AND x.matricula = pmatricula);
          EXCEPTION
            WHEN OTHERS THEN
              v_qtd_parcelas := 3;
          END;
        
          IF pdt_saida_parc4 IS NOT NULL THEN
            IF v_c1.IND_SITUACAO_PERIODO <> 'R' THEN
              -- Humberto/Izidoro 20/02/2014
            
              -- Humberto/Izidoro 29/09/2014p Alterado de 30 para dias_direito
              IF pnum_dias_parc4 >
                 pdias_direito -
                 (NVL(pnum_dias_parc1, 0) + NVL(pdias_abono_pec1, 0) +
                 NVL(pnum_dias_parc2, 0) + NVL(pdias_abono_pec2, 0) +
                 NVL(pdias_abono_pec4, 0)) THEN
                -- Humberto/Izidoro 29/09/2014p Alterado de 30 para pdias_direito
                --disponivel := pdias_direito - (NVL(pnum_dias_parc1, 0) + NVL(pdias_abono_pec1, 0) + NVL(pnum_dias_parc2, 0) + NVL(pdias_abono_pec2, 0) + NVL(pnum_dias_parc4, 0) + NVL(pdias_abono_pec4, 0));
                pflg_retorno := 'N';
                pmsg_retorno := 'Número de dias de Férias maior que o disponível' || /* to_char(disponivel) */
                                '. Favor corrigir.';
                RAISE vsaida_erro;
              ELSIF pnum_dias_parc4 <
                    (pdias_direito -
                    (NVL(pnum_dias_parc1, 0) + NVL(pdias_abono_pec1, 0) +
                    NVL(pnum_dias_parc2, 0) + NVL(pdias_abono_pec2, 0) +
                    NVL(pdias_abono_pec4, 0))) THEN
              
                -- insert into testex values (78,'#09 Vld_Bonus_Ferias4 -> vld_pdias_direito: '||pdias_direito||', pnum_dias_parc1: '||pnum_dias_parc1||', pdias_abono_pec1: '||pdias_abono_pec1||', pdias_abono_pec2: '||pdias_abono_pec2||', pdias_abono_pec4: '||pdias_abono_pec4); commit;
              
                IF v_qtd_parcelas = 3 THEN
                  IF pdias_direito -
                     (NVL(pnum_dias_parc1, 0) + NVL(pdias_abono_pec1, 0) +
                     NVL(pnum_dias_parc2, 0) + NVL(pdias_abono_pec2, 0) +
                     NVL(pnum_dias_parc4, 0) + NVL(pdias_abono_pec4, 0)) > 0 THEN
                    --disponivel := pdias_direito - (NVL(pnum_dias_parc1, 0) + NVL(pdias_abono_pec1, 0) + NVL(pnum_dias_parc2, 0) + NVL(pdias_abono_pec2, 0)+ NVL(pnum_dias_parc4, 0) +  NVL(pdias_abono_pec4, 0));
                    pflg_retorno := 'N';
                    pmsg_retorno := 'Número de dias de Férias menor que o disponível' || /*to_char(disponivel)*/
                                    '. Favor corrigir.';
                    RAISE vsaida_erro;
                  END IF;
                END IF;
              
              END IF;
            ELSE
              IF (NVL(pnum_dias_parc4, 0) + NVL(pdias_abono_pec4, 0) +
                 NVL(pnum_dias_parc2, 0) + NVL(pdias_abono_pec2, 0) +
                 NVL(pnum_dias_parc1, 0) + NVL(pdias_abono_pec1, 0)) >
                 pdias_direito THEN
                -- Humberto/Izidoro 29/09/2014p Alterado de 30 para pdias_direito
                --disponivel := (NVL(pnum_dias_parc4, 0) + NVL(pdias_abono_pec4, 0)) - pdias_direito;
                pflg_retorno := 'N';
                pmsg_retorno := 'Número de dias de Férias maior que o disponível' || /*to_char(disponivel) */
                                '. Favor corrigir.';
                RAISE vsaida_erro;
              ELSIF (NVL(pnum_dias_parc4, 0) + NVL(pdias_abono_pec4, 0)) <
                    pdias_direito THEN
                IF v_qtd_parcelas = 3 THEN
                  IF (pdias_direito -
                     (NVL(pnum_dias_parc4, 0) + NVL(pdias_abono_pec4, 0) +
                     NVL(pnum_dias_parc2, 0) + NVL(pdias_abono_pec2, 0) +
                     NVL(pnum_dias_parc1, 0) + NVL(pdias_abono_pec1, 0))) > 0 THEN
                    --disponivel := pdias_direito - (NVL(pnum_dias_parc4, 0) + NVL(pdias_abono_pec4, 0) + NVL(pnum_dias_parc2, 0) + NVL(pdias_abono_pec2, 0) + NVL(pnum_dias_parc1, 0) + NVL(pdias_abono_pec1, 0));
                    pflg_retorno := 'N';
                    pmsg_retorno := 'Número de dias de Férias menor que o disponível' || /* to_char(disponivel) */
                                    '. Favor corrigir.';
                    RAISE vsaida_erro;
                  END IF;
                END IF;
              END IF;
            END IF;
          END IF;
        END;
        --
      
        /*
        BEGIN
          --
          SELECT NVL(fil.pagto_abono_ferias, 'N'), reg.jornada_reduzida, fer.saldo
            INTO abono_ferias, v_jornada_reduzida, v_saldo
            FROM informacoes_funcionais_cad inf,
                 FERIAS                     fer,
                 filiais_cad                fil,
                 REG_TRABALHO reg
           WHERE fil.cod_empresa = pcod_empresa
             AND fer.cod_empresa = fil.cod_empresa
             AND fer.matricula = Pmatricula
             AND fer.dt_inic_per_ferias = pdt_inic_per_ferias
             AND fer.dt_fim_per_ferias = pdt_fim_per_ferias
             AND inf.cod_empresa = fil.cod_empresa
             AND inf.filial = fil.cod_filial
             AND inf.matricula = fer.matricula
             AND reg.cod_empresa = inf.cod_empresa
             AND reg.cod         = inf.reg_trab;
          --
          IF (NVL(abono_ferias, 'N') = 'N' AND NVL(pnum_dias_parc2, 0) = 0) THEN
            pflg_retorno := 'N';
            pmsg_retorno := 'Informe a quantidade de dias para gozo de férias.';
            RAISE vsaida_erro;
          ELSIF (nvl(pnum_dias_parc2,0) > v_saldo) THEN
            pflg_retorno := 'N';
            pmsg_retorno := 'A quantidade de dias de férias não pode exceder o disponível de ' ||
                            LPAD(v_saldo, 2, 0) || ' dias!';
            RAISE vsaida_erro;
          ELSE
            IF NVL(pnum_dias_parc2, 0) <> 0 THEN
              IF (NVL(pnum_dias_parc2, 0) < NVL(v_qtde_min_dias, 0))
              AND v_jornada_reduzida = 'N' -- Humberto/Izidoro 03/03/2016: acrescentado este and
               THEN
                pflg_retorno := 'N';
                pmsg_retorno := 'Número de dias de férias deve ser maior ou igual ao mínimo permitido de ' ||
                                LPAD(v_qtde_min_dias, 2, 0) || ' dias!';
                RAISE vsaida_erro;
              END IF;
            END IF;
          END IF;
        END;
        */
      
      END;
      --
      IF NVL(pnum_dias_parc4, 0) = 0 AND NVL(pDIAS_ABONO_PEC4, 0) = 0 THEN
        ptipo_ferias4 := NULL;
      ELSE
        ptipo_ferias4 := 'N';
      END IF;
      --
      /* BEGIN
      
        disponivel := 30 -
                      (NVL(NVL(pnum_dias_parc1, v_c1.num_dias_parc1), 0) +
                      NVL(pdias_abono_pec1, 0) + NVL(pdias_abono_pec2, 0));
      
        IF (pnum_dias_parc2 > disponivel) THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'A quantidade de dias de férias não pode exceder o disponível de ' ||
                          LPAD(disponivel, 2, 0) || ' dias!';
          RAISE vsaida_erro;
        END IF;
      END;
      */
      --
      IF pnum_dias_parc4 = 0 THEN
        pdesc_adicional4 := 0;
      END IF;
    
      IF NVL(pdias_descanso_adicional, 0) > 0 THEN
        --
        Vld_Bonus_Ferias4(pcod_empresa,
                          pmatricula,
                          pdias_descanso_adicional,
                          pnum_dias_parc2,
                          pdesc_adicional2,
                          pnum_dias_parc4,
                          pdesc_adicional4,
                          pflg_retorno,
                          pmsg_retorno);
        --
        IF NVL(pflg_retorno, 'S') <> 'S' THEN
          RAISE vsaida_erro;
        END IF;
        --
      END IF;
      --
      pdt_retorno_parc4 := (pdt_saida_parc4 + NVL(pnum_dias_parc4, 0) +
                           NVL(NVL(pdesc_adicional1, v_c1.desc_adicional1),
                                0) +
                           NVL(NVL(pdesc_adicional2, v_c1.desc_adicional2),
                                0));
      --
    
      --
    END IF;
    --
    /*In/Out    if pdt_saida_parc2 is not null then
      P2(pnum_dias_parc1,
         pdias_abono_pec1,
         pnum_dias_parc2,
         pdias_abono_pec2,
         pflg_retorno,
         pmsg_retorno);
      if nvl(pflg_retorno, 'S') <> 'S' then
        raise vsaida_erro;
      end if;
    end if;*/
    --
  
    DECLARE
    
      v_qtde_min_dias FERIAS.NUM_DIAS_PARC1%TYPE;
    BEGIN
    
      BEGIN
        SELECT fer.qtde_minimo_dias
          INTO v_qtde_min_dias
          FROM ferias_parametros fer, inf_pessoais inf
         WHERE inf.cod_empresa = fer.cod_empresa
           AND inf.cod_empresa = pcod_empresa
           AND inf.matricula = pmatricula
           AND inf.filial = fer.cod_filial;
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          v_qtde_min_dias := 0;
        WHEN OTHERS THEN
          v_qtde_min_dias := 0;
      END;
    
      IF NVL(pnum_dias_parc4, 0) < NVL(v_qtde_min_dias, 0) AND
         pdias_direito >= 30 THEN
        -- Humberto/Izidoro 29/09/2014: Acrescentado dias_direito >= 30
        pflg_retorno := 'N';
        pmsg_retorno := 'Mínimo de dias do Parâmetro de Férias, é maior que o informado. Verifique Parâmetros de Férias da Filial desse funcionário.';
        RAISE vsaida_erro;
      END IF;
    
    END;
  
    IF pnum_dias_parc4 = 0 THEN
      pdesc_adicional4 := 0;
    END IF;
  
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Num_Dias_Parc2 - Erro: ' ||
                      SQLERRM;
  END Valida_Num_Dias_Parc4_OLD;
  --
  PROCEDURE Valida_Abono_Pec4(pcod_empresa          FERIAS.cod_empresa%TYPE,
                              pmatricula            INF_PESSOAIS.matricula%TYPE,
                              pdt_inic_per_ferias   FERIAS.dt_inic_per_ferias%TYPE,
                              pdt_fim_per_ferias    FERIAS.dt_fim_per_ferias%TYPE,
                              pind_situacao_periodo ferias.ind_situacao_periodo%TYPE,
                              pdias_direito         NUMBER,
                              pnum_dias_parc1       NUMBER,
                              pdias_abono_pec1      FERIAS.dias_abono_pec1%TYPE,
                              pdt_saida_parc2       FERIAS.dt_saida_parc2%TYPE,
                              pnum_dias_parc2       FERIAS.num_dias_parc2%TYPE,
                              pdesc_adicional2      FERIAS.desc_adicional2%TYPE,
                              pdias_abono_pec2      FERIAS.dias_abono_pec2%TYPE,
                              pdt_saida_parc4       FERIAS.dt_saida_parc2%TYPE,
                              pnum_dias_parc4       FERIAS.num_dias_parc2%TYPE,
                              pdesc_adicional4      FERIAS.desc_adicional2%TYPE,
                              pdias_abono_pec4      FERIAS.dias_abono_pec2%TYPE,
                              popcao_abono_pec4     IN OUT FERIAS.opcao_abono_pec2%TYPE,
                              pdt_retorno_parc4     IN OUT FERIAS.dt_retorno_parc2%TYPE,
                              pflg_retorno          IN OUT VARCHAR2,
                              pmsg_retorno          IN OUT VARCHAR2) IS
    --
    abono_ferias   VARCHAR2(1);
    v_qtd_parcelas ferias_parametros.qtd_parcelas%TYPE;
    disponivel     NUMBER;
    --v_qtde_min_dias PLS_INTEGER := 0;
    --
    CURSOR c1 IS
      SELECT a.dt_saida_parc1,
             a.sit_requisicao,
             a.num_dias_parc1,
             a.dias_abono_pec1
        FROM REQUISICAO_FERIAS a
       WHERE a.cod_empresa = pcod_empresa
         AND a.matricula = pmatricula
         AND a.dt_saida_parc1 < pdt_saida_parc2
         AND a.dt_saida_parc2 < pdt_saida_parc4
         AND a.dt_saida_parc4 IS NULL
         AND a.sit_requisicao IN ('1', '2', '5')
         AND a.dt_inic_per_ferias = pdt_inic_per_ferias
         AND a.dt_fim_per_ferias = pdt_fim_per_ferias
      UNION
      SELECT a.dt_saida_parc1,
             '5' sit_requisicao,
             a.num_dias_parc1,
             a.dias_abono_pec1
        FROM FERIAS a
       WHERE a.cod_empresa = pcod_empresa
         AND a.matricula = pmatricula
         AND a.dt_saida_parc1 < pdt_saida_parc2
         AND a.dt_saida_parc2 < pdt_saida_parc4
         AND a.dt_saida_parc4 IS NULL
         AND a.dt_inic_per_ferias = pdt_inic_per_ferias
         AND a.dt_fim_per_ferias = pdt_fim_per_ferias
         AND NOT EXISTS
       (SELECT 1
                FROM REQUISICAO_FERIAS x
               WHERE x.cod_empresa = a.cod_empresa
                 AND x.matricula = a.matricula
                 AND x.dt_saida_parc1 IS NOT NULL
                 AND x.dt_inic_per_ferias = a.dt_inic_per_ferias
                 AND x.dt_fim_per_ferias = a.dt_fim_per_ferias
                 AND x.sit_requisicao IN ('1', '2', '5'))
       ORDER BY 1 DESC;
    --
    v_c1 c1%ROWTYPE;
    --
    v_jornada_reduzida REG_TRABALHO.jornada_reduzida%TYPE;
  BEGIN
    --
    pflg_retorno := 'S';
    --
    IF pdias_abono_pec4 IS NOT NULL THEN
      --
      SELECT NVL(fil.pagto_abono_ferias, 'N'), reg.jornada_reduzida
        INTO abono_ferias, v_jornada_reduzida
        FROM informacoes_funcionais_cad inf,
             FERIAS                     fer,
             filiais_cad                fil,
             REG_TRABALHO               reg
       WHERE fil.cod_empresa = pcod_empresa
         AND fer.cod_empresa = fil.cod_empresa
         AND fer.matricula = pmatricula
         AND fer.dt_inic_per_ferias = pdt_inic_per_ferias
         AND fer.dt_fim_per_ferias = pdt_fim_per_ferias
         AND inf.cod_empresa = fil.cod_empresa
         AND inf.filial = fil.cod_filial
         AND inf.matricula = fer.matricula
         AND reg.cod_empresa = inf.cod_empresa
         AND reg.cod = inf.reg_trab;
      --
      IF NVL(abono_ferias, 'N') = 'N' THEN
        --
        IF NVL(pdias_abono_pec4, 0) > 0 THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Este colaborador não pode receber dias de abono, conforme dados parametrizados na filial.';
          RAISE vsaida_erro;
        END IF;
        --
      END IF;
      --
      /*In/Out
        if nvl(pdias_abono_pec2, '-1') = '-1' then
        pdias_abono_pec2 := 0;
      end if;*/
      --
      IF NVL(NVL(pdias_abono_pec1, v_c1.dias_abono_pec1), 0) > 0 AND
         NVL(pdias_abono_pec4, 0) > 0 AND NVL(pnum_dias_parc4, 0) = 0 THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A programação do abono para este colaborador já foi efetuada no primeiro período!';
        RAISE vsaida_erro;
      ELSE
      
        OPEN c1;
        FETCH c1
          INTO v_c1;
        CLOSE c1;
      
        DECLARE
          v_qtd_parcelas ferias_parametros.qtd_parcelas%TYPE;
          disponivel     NUMBER;
        
        BEGIN
          BEGIN
            SELECT a.qtd_parcelas
              INTO v_qtd_parcelas
              FROM ferias_parametros a
             WHERE a.cod_empresa = pcod_empresa
               AND a.cod_filial IN
                   (SELECT x.filial
                      FROM informacoes_funcionais x
                     WHERE x.cod_empresa = pcod_empresa
                       AND x.matricula = pmatricula);
          EXCEPTION
            WHEN OTHERS THEN
              v_qtd_parcelas := 3;
          END;
        
          IF pdt_saida_parc4 IS NOT NULL THEN
            IF v_qtd_parcelas = 3 AND NVL(pdias_abono_pec4, 0) <> 0 THEN
              IF pind_situacao_periodo <> 'R' THEN
                -- Humberto/Izidoro 29/09/2014: alterado de 30 para dias_direito
                IF pdias_abono_pec4 >
                   pdias_direito -
                   (NVL(pnum_dias_parc1, 0) + NVL(pdias_abono_pec1, 0) +
                   NVL(pnum_dias_parc2, 0) + NVL(pnum_dias_parc4, 0)) THEN
                
                  -- Humberto/Izidoro 29/09/2014: alterado de 30 para dias_direito
                  disponivel := pdias_direito - (NVL(pnum_dias_parc1, 0) +
                                NVL(pdias_abono_pec1, 0) +
                                NVL(pnum_dias_parc2, 0) +
                                NVL(pnum_dias_parc4, 0));
                
                  pflg_retorno := 'N';
                  pmsg_retorno := 'Dias de Abono maior que ' ||
                                  TO_CHAR(disponivel) ||
                                  '. Favor corrigir.';
                  RAISE vsaida_erro;
                
                ELSIF pdias_abono_pec4 <
                      pdias_direito -
                      (NVL(pnum_dias_parc1, 0) + NVL(pdias_abono_pec1, 0) +
                      NVL(pnum_dias_parc2, 0) + NVL(pnum_dias_parc4, 0)) THEN
                  -- Humberto/Izidoro 29/09/2014: alterado de 30 para dias_direito
                  disponivel := pdias_direito - (NVL(pnum_dias_parc1, 0) +
                                NVL(pdias_abono_pec1, 0) +
                                NVL(pnum_dias_parc2, 0) +
                                NVL(pnum_dias_parc4, 0));
                
                  pflg_retorno := 'N';
                  pmsg_retorno := 'Dias de Abono menor que ' ||
                                  TO_CHAR(disponivel) ||
                                  '. Favor corrigir.';
                  RAISE vsaida_erro;
                
                END IF;
              ELSE
                -- Humberto/Izidoro 29/09/2014: alterado de 30 para dias_direito
                IF pdias_direito -
                   (NVL(pnum_dias_parc4, 0) + NVL(pdias_abono_pec4, 0)) > 0 THEN
                
                  -- Humberto/Izidoro 29/09/2014: alterado de 30 para dias_direito
                  disponivel := pdias_direito - (NVL(pnum_dias_parc4, 0) +
                                NVL(pdias_abono_pec4, 0));
                
                  pflg_retorno := 'N';
                  pmsg_retorno := 'Dias de Abono maior que ' ||
                                  TO_CHAR(disponivel) ||
                                  '. Favor corrigir.';
                  RAISE vsaida_erro;
                
                ELSIF pdias_direito -
                      (NVL(pnum_dias_parc4, 0) + NVL(pdias_abono_pec4, 0)) < 0 THEN
                
                  -- Humberto/Izidoro 29/09/2014: alterado de 30 para dias_direito
                  disponivel := pdias_direito - (NVL(pnum_dias_parc4, 0) +
                                NVL(pdias_abono_pec4, 0));
                
                  pflg_retorno := 'N';
                  pmsg_retorno := 'Dias de Abono menor que ' ||
                                  TO_CHAR(disponivel) ||
                                  '. Favor corrigir.';
                  RAISE vsaida_erro;
                
                END IF;
              END IF;
            END IF;
          END IF;
        
        END;
      
        --
        pdt_retorno_parc4 := pdt_saida_parc4 + NVL(pnum_dias_parc4, 0) +
                             NVL(pdesc_adicional4, 0);
      
      END IF;
    
    END IF;
  
    IF NVL(pdias_abono_pec4, 0) = 0 THEN
      popcao_abono_pec4 := 'N';
    ELSIF NVL(pdias_abono_pec4, 0) > 0 THEN
      popcao_abono_pec4 := 'S';
    END IF;
  
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Abono_Pec2 - Erro: ' || SQLERRM;
  END Valida_Abono_Pec4;
  --
  PROCEDURE Valida_Opcao_13Sal4(pcod_empresa      EMPRESAS.cod%TYPE,
                                pmatricula        INF_PESSOAIS.matricula%TYPE,
                                popcao_13sal1     FERIAS.opcao_13sal1%TYPE,
                                pdt_saida_parc1   FERIAS.dt_saida_parc1%TYPE,
                                popcao_13sal2     FERIAS.opcao_13sal2%TYPE,
                                pdt_saida_parc2   FERIAS.dt_saida_parc2%TYPE,
                                pdt_retorno_parc2 FERIAS.dt_retorno_parc2%TYPE,
                                popcao_13sal4     FERIAS.opcao_13sal2%TYPE,
                                pdt_saida_parc4   FERIAS.dt_saida_parc2%TYPE,
                                pdt_retorno_parc4 FERIAS.dt_retorno_parc2%TYPE,
                                PCOD_SOLICITACAO  FERIAS.COD_SOLICITACAO%TYPE,
                                pflg_retorno      IN OUT VARCHAR2,
                                pmsg_retorno      IN OUT VARCHAR2) IS
  
    --
    CURSOR c0 IS
      SELECT a.filial, a.num_sind_diss
        FROM INFORMACOES_FUNCIONAIS a
       WHERE a.cod_empresa = pcod_empresa
         AND a.matricula = pmatricula;
    --
    v_c0 c0%ROWTYPE;
    --
    CURSOR c1(p_filial NUMBER) IS
      SELECT a.mes01,
             a.mes02,
             a.mes03,
             a.mes04,
             a.mes05,
             a.mes06,
             a.mes07,
             a.mes08,
             a.mes09,
             a.mes10,
             a.mes11,
             a.mes12
        FROM FER_MES_SEM_13SAL a
       WHERE a.cod_empresa = pcod_empresa
         AND a.cod_filial = p_filial;
    --
    v_c1 c1%ROWTYPE;
    --
    -- Humberto/Rodrigo 27/08/2021
    CURSOR c1b(p_sindicato NUMBER) IS
      SELECT a.mes01,
             a.mes02,
             a.mes03,
             a.mes04,
             a.mes05,
             a.mes06,
             a.mes07,
             a.mes08,
             a.mes09,
             a.mes10,
             a.mes11,
             a.mes12
        FROM FER_MES_SEM_13SAL_sind a
       WHERE a.cod_empresa = pcod_empresa
         AND a.cod_sindicato = p_sindicato;
    v_c1b c1b%ROWTYPE;
    --
    PROCEDURE valida_13sal_ano_parc4(pcod_empresa     EMPRESAS.cod%TYPE,
                                     pmatricula       INF_PESSOAIS.matricula%TYPE,
                                     pdt_saida_parc4  FERIAS.dt_saida_parc4%TYPE,
                                     PCOD_SOLICITACAO FERIAS.COD_SOLICITACAO%TYPE,
                                     pflg_retorno     IN OUT VARCHAR2,
                                     pmsg_retorno     IN OUT VARCHAR2) IS
      --
      v_cat_13m      FERIAS_PARAMETROS.cat_13m%TYPE DEFAULT 'N';
      v_cat_13h      FERIAS_PARAMETROS.cat_13h%TYPE DEFAULT 'N';
      v_tipo_salario FERIAS_PARAMETROS.cat_13h%TYPE DEFAULT 'N';
      vl_valida_13   NUMBER(1) := 0;
      --
    BEGIN
      --
      pflg_retorno := 'S';
      --
      BEGIN
        --Bruno Sousa 26/12/2024
        SELECT COUNT(1)
          INTO vl_valida_13
          FROM FERIAS
         WHERE cod_empresa = pcod_empresa
           AND matricula = pmatricula
           AND ((TO_CHAR(dt_saida_parc1, 'RRRR') =
               TO_CHAR(pdt_saida_parc1, 'RRRR') AND
               (COD_SOLICITACAO <> PCOD_SOLICITACAO OR
               PCOD_SOLICITACAO IS NULL) AND opcao_13sal1 = 'S') or
               (TO_CHAR(dt_saida_parc2, 'RRRR') =
               TO_CHAR(pdt_saida_parc1, 'RRRR') AND
               (COD_SOLICITACAO <> PCOD_SOLICITACAO OR
               PCOD_SOLICITACAO IS NULL) AND opcao_13sal2 = 'S') or
               (TO_CHAR(dt_saida_parc4, 'RRRR') =
               TO_CHAR(pdt_saida_parc1, 'RRRR') AND
               (COD_SOLICITACAO <> PCOD_SOLICITACAO OR
               PCOD_SOLICITACAO IS NULL) AND opcao_13sal4 = 'S'));
        --Bruno Sousa 30/12/2024 - Verificar se já existe requisição de férias também
        IF vl_valida_13 = 0 THEN
          SELECT COUNT(1) opcao_13sal1
            INTO vl_valida_13
            FROM REQUISICAO_FERIAS
           WHERE cod_empresa = pcod_empresa
             AND matricula = pmatricula
             AND SIT_REQUISICAO = 1
             AND ((TO_CHAR(dt_saida_parc1, 'RRRR') =
                 TO_CHAR(pdt_saida_parc1, 'RRRR') AND opcao_13sal1 = 'S') or
                 (TO_CHAR(dt_saida_parc2, 'RRRR') =
                 TO_CHAR(pdt_saida_parc1, 'RRRR') AND opcao_13sal2 = 'S') or
                 (TO_CHAR(dt_saida_parc4, 'RRRR') =
                 TO_CHAR(pdt_saida_parc1, 'RRRR') AND opcao_13sal4 = 'S'));
        end if;
        --Bruno Sousa 30/12/2024 - Verificar se existe requisição de férias DIFERENTE da que esta sendo alterada
        IF vl_valida_13 = 1 AND PCOD_SOLICITACAO IS NOT NULL THEN
          SELECT COUNT(1) opcao_13sal1
            INTO vl_valida_13
            FROM REQUISICAO_FERIAS
           WHERE cod_empresa = pcod_empresa
             AND matricula = pmatricula
             AND (COD_SOLICITACAO <> PCOD_SOLICITACAO AND
                 PCOD_SOLICITACAO IS NOT NULL)
             AND SIT_REQUISICAO = 1
             AND ((TO_CHAR(dt_saida_parc1, 'RRRR') =
                 TO_CHAR(pdt_saida_parc1, 'RRRR') AND opcao_13sal1 = 'S') or
                 (TO_CHAR(dt_saida_parc2, 'RRRR') =
                 TO_CHAR(pdt_saida_parc1, 'RRRR') AND opcao_13sal2 = 'S') or
                 (TO_CHAR(dt_saida_parc4, 'RRRR') =
                 TO_CHAR(pdt_saida_parc1, 'RRRR') AND opcao_13sal4 = 'S'));
        end if;
        --
      EXCEPTION
        WHEN OTHERS THEN
          vl_valida_13 := 0;
      END;
      --
      IF vl_valida_13 >= 1 AND popcao_13sal4 = 'S' THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Opção 13º salário já solicitada no ano calendário.';
        RAISE vsaida_erro;
      ELSE
        --
        BEGIN
          --
          SELECT fer.cat_13m, fer.cat_13h, inf.TIPO_SALARIO
            INTO v_cat_13m, v_cat_13h, v_tipo_salario
            FROM FERIAS_PARAMETROS fer, INFORMACOES_FUNCIONAIS inf
           WHERE inf.cod_empresa = fer.cod_empresa
             AND inf.cod_empresa = pcod_empresa
             AND inf.matricula = pmatricula
             AND inf.filial = fer.cod_filial;
          --
        EXCEPTION
          WHEN NO_DATA_FOUND THEN
            NULL;
          WHEN OTHERS THEN
            NULL;
        END;
        --
        IF v_tipo_salario = 'M' THEN
          IF NVL(v_cat_13m, 'N') = 'N' AND popcao_13sal4 = 'S' THEN
            pflg_retorno := 'N';
            --pmsg_retorno := 'Não é permitido adiantamento de 13º salário nas férias. Verifique parâmetros de férias da filial desse colaborador.';
            pmsg_retorno := 'Não é permitido adiantamento de 13º salário nas férias para esta data de saída.';
            RAISE vsaida_erro;
          END IF;
        ELSE
          IF NVL(v_cat_13h, 'n') = 'N' AND popcao_13sal4 = 'S' THEN
            pflg_retorno := 'N';
            --pmsg_retorno := 'Não é permitido adiantamento de 13º salário nas férias. Verifique parâmetros de férias da filial desse colaborador.';
            pmsg_retorno := 'Não é permitido adiantamento de 13º salário nas férias para esta data de saída.';
            RAISE vsaida_erro;
          END IF;
        END IF;
        --
      END IF;
      --
    EXCEPTION
      WHEN vsaida_erro THEN
        NULL;
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Ferias.Valida_13Sal_Ano_Parc4 - Erro: ' ||
                        SQLERRM;
    END valida_13sal_ano_parc4;
    --
    PROCEDURE vld_13_sal4(pcod_empresa      EMPRESAS.cod%TYPE,
                          pmatricula        INF_PESSOAIS.matricula%TYPE,
                          popcao_13sal1     FERIAS.opcao_13sal1%TYPE,
                          pdt_saida_parc1   FERIAS.dt_saida_parc1%TYPE,
                          popcao_13sal2     FERIAS.opcao_13sal2%TYPE,
                          pdt_saida_parc2   FERIAS.dt_saida_parc2%TYPE,
                          pdt_retorno_parc2 FERIAS.dt_retorno_parc2%TYPE,
                          popcao_13sal4     FERIAS.opcao_13sal2%TYPE,
                          pdt_saida_parc4   FERIAS.dt_saida_parc2%TYPE,
                          pdt_retorno_parc4 FERIAS.dt_retorno_parc2%TYPE,
                          pflg_retorno      IN OUT VARCHAR2,
                          pmsg_retorno      IN OUT VARCHAR2) IS
      vano           VARCHAR2(2) := NULL;
      v_cat_13m      FERIAS_PARAMETROS.cat_13m%TYPE DEFAULT 'N';
      v_cat_13h      FERIAS_PARAMETROS.cat_13h%TYPE DEFAULT 'N';
      v_tipo_salario FERIAS_PARAMETROS.cat_13h%TYPE DEFAULT 'N';
      vocorr_sal13   OCORR_PAGTO.cod%TYPE;
      --
    BEGIN
      --
      pflg_retorno := 'S';
      --
      IF popcao_13sal4 IS NOT NULL THEN
        BEGIN
          SELECT fer.cat_13m, fer.cat_13h, inf.TIPO_SALARIO
            INTO v_cat_13m, v_cat_13h, v_tipo_salario
            FROM FERIAS_PARAMETROS fer, informacoes_funcionais_cad inf
           WHERE inf.cod_empresa = fer.cod_empresa
             AND inf.cod_empresa = pcod_empresa
             AND inf.matricula = pmatricula
             AND inf.filial = fer.cod_filial;
        EXCEPTION
          WHEN NO_DATA_FOUND THEN
            NULL;
          WHEN OTHERS THEN
            NULL;
        END;
        IF v_tipo_salario = 'M' THEN
          IF NVL(v_cat_13m, 'N') = 'N' AND popcao_13sal4 = 'S' THEN
            pflg_retorno := 'N';
            --pmsg_retorno := 'Não é permitido adiantamento de 13º salário nas férias. Verifique parâmetros de férias da filial desse colaborador.';
            pmsg_retorno := 'Não é permitido adiantamento de 13º salário nas férias para esta data de saída.';
            RAISE vsaida_erro;
          END IF;
        ELSE
          IF NVL(v_cat_13h, 'N') = 'N' AND popcao_13sal4 = 'S' THEN
            pflg_retorno := 'N';
            --pmsg_retorno := 'Não é permitido adiantamento de 13º salário nas férias. Verifique parâmetros de férias da filial desse colaborador.';
            pmsg_retorno := 'Não é permitido adiantamento de 13º salário nas férias para esta data de saída.';
            RAISE vsaida_erro;
          END IF;
        END IF;
        IF popcao_13sal4 NOT IN ('S', 'N') THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'Opção deve ser S ou N';
          RAISE vsaida_erro;
        END IF;
        --
        IF popcao_13sal1 = 'S' AND popcao_13sal2 = 'S' AND
           popcao_13sal4 = 'S' THEN
          vano := TO_CHAR(pdt_saida_parc1, 'YY');
          IF vano = TO_CHAR(pdt_saida_parc2, 'YY') THEN
            pflg_retorno := 'N';
            pmsg_retorno := '13º permitido apenas em uma parcela de ferias por ano!';
            RAISE vsaida_erro;
          END IF;
        ELSE
          IF popcao_13sal4 = 'S' THEN
            --
            ocorrencia13(pcod_empresa,
                         pmatricula,
                         pdt_retorno_parc4,
                         vocorr_sal13,
                         pflg_retorno,
                         pmsg_retorno);
            IF pflg_retorno = 'N' THEN
              RAISE vsaida_erro;
            END IF;
            --
            IF vocorr_sal13 = 1 THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'A primeira parcela do 13o. salario ja foi paga';
              RAISE vsaida_erro;
            END IF;
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
        pmsg_retorno := 'Pkg_Ferias.Vld_13_Sal2 - Erro: ' || SQLERRM;
    END vld_13_sal4;
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    IF popcao_13sal4 = 'S' THEN
      --
      valida_13sal_ano_parc4(pcod_empresa,
                             pmatricula,
                             pdt_saida_parc4,
                             PCOD_SOLICITACAO,
                             pflg_retorno,
                             pmsg_retorno);
      --
      OPEN c0;
      FETCH c0
        INTO v_c0;
      CLOSE c0;
      --
      OPEN c1(v_c0.filial);
      FETCH c1
        INTO v_c1;
      CLOSE c1;
      --
      IF TO_CHAR(pdt_saida_parc4, 'mm') = '01' AND v_c1.mes01 = 'S' OR
         TO_CHAR(pdt_saida_parc4, 'mm') = '02' AND v_c1.mes02 = 'S' OR
         TO_CHAR(pdt_saida_parc4, 'mm') = '03' AND v_c1.mes03 = 'S' OR
         TO_CHAR(pdt_saida_parc4, 'mm') = '04' AND v_c1.mes04 = 'S' OR
         TO_CHAR(pdt_saida_parc4, 'mm') = '05' AND v_c1.mes05 = 'S' OR
         TO_CHAR(pdt_saida_parc4, 'mm') = '06' AND v_c1.mes06 = 'S' OR
         TO_CHAR(pdt_saida_parc4, 'mm') = '07' AND v_c1.mes07 = 'S' OR
         TO_CHAR(pdt_saida_parc4, 'mm') = '08' AND v_c1.mes08 = 'S' OR
         TO_CHAR(pdt_saida_parc4, 'mm') = '09' AND v_c1.mes09 = 'S' OR
         TO_CHAR(pdt_saida_parc4, 'mm') = '10' AND v_c1.mes10 = 'S' OR
         TO_CHAR(pdt_saida_parc4, 'mm') = '11' AND v_c1.mes11 = 'S' OR
         TO_CHAR(pdt_saida_parc4, 'mm') = '12' AND v_c1.mes12 = 'S' THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Não é permitido a antecipação do 13° Salário nesta refefência!';
        RAISE vsaida_erro;
      END IF;
      -----------------------------------------------------------------------------------------------------------
      -- Humberto/Rodrigo 27/08/2021
      v_c1b := NULL;
      OPEN c1b(v_c0.num_sind_diss);
      FETCH c1b
        INTO v_c1b;
      CLOSE c1b;
      --
      IF TO_CHAR(pdt_saida_parc2, 'mm') = '01' AND v_c1b.mes01 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '02' AND v_c1b.mes02 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '03' AND v_c1b.mes03 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '04' AND v_c1b.mes04 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '05' AND v_c1b.mes05 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '06' AND v_c1b.mes06 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '07' AND v_c1b.mes07 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '08' AND v_c1b.mes08 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '09' AND v_c1b.mes09 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '10' AND v_c1b.mes10 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '11' AND v_c1b.mes11 = 'S' OR
         TO_CHAR(pdt_saida_parc2, 'mm') = '12' AND v_c1b.mes12 = 'S' THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Não é permitido a antecipação do 13° Salário nesta refefência!';
        RAISE vsaida_erro;
      END IF;
      -----------------------------------------------------------------------------------------------------------
    
    END IF;
    --
    IF pdt_saida_parc2 IS NOT NULL THEN
      vld_13_sal4(pcod_empresa,
                  pmatricula,
                  popcao_13sal1,
                  pdt_saida_parc1,
                  popcao_13sal2,
                  pdt_saida_parc2,
                  pdt_retorno_parc2,
                  popcao_13sal4,
                  pdt_saida_parc4,
                  pdt_retorno_parc4,
                  pflg_retorno,
                  pmsg_retorno);
      IF pflg_retorno = 'N' THEN
        RAISE vsaida_erro;
      END IF;
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Opcao_13Sal2 - Erro: ' || SQLERRM;
  END Valida_Opcao_13Sal4;
  --
  PROCEDURE Valida_Desc_Adicional4(pdias_descanso_adicional FERIAS.dias_descanso_adicional%TYPE,
                                   pdesc_adicional1         FERIAS.desc_adicional1%TYPE,
                                   pdt_saida_parc2          FERIAS.dt_saida_parc2%TYPE,
                                   pnum_dias_parc2          FERIAS.num_dias_parc2%TYPE,
                                   pdesc_adicional2         FERIAS.desc_adicional2%TYPE,
                                   pdt_saida_parc4          FERIAS.dt_saida_parc2%TYPE,
                                   pnum_dias_parc4          FERIAS.num_dias_parc2%TYPE,
                                   pdesc_adicional4         FERIAS.desc_adicional2%TYPE,
                                   pdt_retorno_parc4        IN OUT FERIAS.dt_retorno_parc2%TYPE,
                                   pflg_retorno             IN OUT VARCHAR2,
                                   pmsg_retorno             IN OUT VARCHAR2) IS
  BEGIN
    --
    pdt_retorno_parc4 := pdt_saida_parc4 + NVL(pnum_dias_parc4, 0) +
                         NVL(pdesc_adicional4, 0);
    --
    IF (NVL(pdesc_adicional1, 0) + NVL(pdesc_adicional2, 0) +
       NVL(pdesc_adicional4, 0)) > NVL(pdias_descanso_adicional, 0) THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Dias do Bonus maior que o Permitido !!!! ';
      RAISE vsaida_erro;
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Desc_Adicional2 - Erro: ' ||
                      SQLERRM;
  END Valida_Desc_Adicional4;
  --
  PROCEDURE Valida_Dt_Retorno_Parc4(pdt_retorno_parc4     FERIAS.dt_retorno_parc4%TYPE,
                                    pind_situacao_periodo ferias.ind_situacao_periodo%TYPE,
                                    pflg_retorno          IN OUT VARCHAR2,
                                    pmsg_retorno          IN OUT VARCHAR2,
                                    pdt_saida_parc4       FERIAS.DT_SAIDA_PARC4%TYPE DEFAULT NULL,
                                    pdt_fim_per_ferias    DATE,
                                    pcod_empresa          empresas.cod%TYPE,
                                    pmatricula            inf_pessoais.matricula%TYPE,
                                    pdt_inic_per_ferias   DATE,
                                    pdt_saida_parc2       DATE) IS
    --
    CURSOR c1 IS
      SELECT *
        FROM ferias
       WHERE dt_inic_per_ferias = pdt_inic_per_ferias
         AND matricula = pmatricula
         AND cod_empresa = pcod_empresa;
    v_c1 c1%ROWTYPE;
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    /*    IF pind_situacao_periodo = 'P' THEN
      NULL;
    ELSE
      if c1%isopen then
        close c1;
      end if;
      open c1;
      fetch c1 into v_c1;
      close c1;
      if v_c1.ind_situacao_parc_4 = 'C' then
        null;
      else
        pflg_retorno := 'N';
        pmsg_retorno := 'P4 - A situação do período não permite mais alterações!';
        RAISE vsaida_erro;
      end if;
    END IF;*/
    --
    IF pind_situacao_periodo = 'P' THEN
      NULL;
    ELSE
      IF c1%isopen THEN
        CLOSE c1;
      END IF;
      OPEN c1; -- Alterado Dri/Rodrigo 10/09/2019
      FETCH c1
        INTO v_c1;
      CLOSE c1;
    
      IF pdt_retorno_parc4 IS NULL OR
         (pdt_retorno_parc4 IS NOT NULL AND
         NVL(v_c1.ind_situacao_parc_2, 'C') = 'C' AND
         pdt_saida_parc2 IS NOT NULL AND pdt_saida_parc2 < pdt_saida_parc4) THEN
        NULL;
      ELSE
        pflg_retorno := 'N';
        pmsg_retorno := 'A situação do período não permite mais alterações!';
        RAISE vsaida_erro;
      END IF;
    END IF;
    --
    IF pdt_retorno_parc4 IS NULL AND pdt_saida_parc4 IS NOT NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Data de Retorno Parcela 3: Campo obrigatório!';
      RAISE vsaida_erro;
    ELSE
      IF pdt_saida_parc4 IS NOT NULL AND
         pdt_retorno_parc4 <= pdt_saida_parc4 THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A data de retorno não pode ser menor ou igual à data de saída!';
        RAISE vsaida_erro;
      END IF;
    
      IF pdt_retorno_parc4 > ADD_MONTHS(pdt_fim_per_ferias, 12) THEN
        -- Adicionado por Igor Cardoso 27/07/2019 - Chamado 17969
        pflg_retorno := 'N';
        pmsg_retorno := 'Data de retorno maior que o permitido na vigência de férias!';
        RAISE vsaida_erro;
      END IF;
    
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Dt_Retorno_Parc4 - Erro: ' ||
                      SQLERRM;
  END Valida_Dt_Retorno_Parc4;
  --
  PROCEDURE Valida_Tipo_Ferias4(ptipo_ferias4 FERIAS.tipo_ferias4%TYPE,
                                pflg_retorno  IN OUT VARCHAR2,
                                pmsg_retorno  IN OUT VARCHAR2) IS
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    IF ptipo_ferias4 NOT IN ('N', 'C') OR ptipo_ferias4 IS NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Entre com a opção correta, N-Normal, C-Coletivas';
      RAISE vsaida_erro;
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Tipo_Ferias2 - Erro: ' || SQLERRM;
  END Valida_Tipo_Ferias4;

  /** Fim Igor 27/04/2018 **/
  --
  -- O campo Dt_Saida_Parc3 possui uma mensagem de confirmação.
  -- A procedure Valida_dt_Saida_Parc3_2 somente deve ser chamada se pflg_retorno = 'S' ou se
  -- a mensagem de confirmação for exibida e confirmada pelo usuário
  PROCEDURE Valida_Dt_Saida_Parc3_1(pcod_empresa        FERIAS.cod_empresa%TYPE,
                                    pmatricula          INF_PESSOAIS.matricula%TYPE,
                                    pcod_solicitacao    REQUISICAO_FERIAS.cod_solicitacao%TYPE,
                                    pdt_inic_per_ferias FERIAS.dt_inic_per_ferias%TYPE,
                                    pdt_saida_parc3     FERIAS.dt_saida_parc3%TYPE,
                                    pflg_retorno        IN OUT VARCHAR2,
                                    pmsg_retorno        IN OUT VARCHAR2) IS
    --
    v_dt_ref_folha DATE;
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    Vld_Per_Meses(pcod_empresa,
                  pmatricula,
                  pdt_saida_parc3,
                  pdt_inic_per_ferias,
                  pflg_retorno,
                  pmsg_retorno);
    IF pflg_retorno = 'N' THEN
      RAISE vsaida_erro;
    END IF;
    --
    IF pcod_solicitacao IS NULL THEN
      -- carrega limite para data de req. pessoal
      IF pcod_empresa IS NOT NULL THEN
        --
        BEGIN
          --
          SELECT p.dt_ref_folha
            INTO v_dt_ref_folha
            FROM PARAMETROS_RECURSOS_HUMANOS p
           WHERE p.cod_empresa = pcod_empresa;
          --
        EXCEPTION
          WHEN OTHERS THEN
            pflg_retorno := 'N';
            pmsg_retorno := 'Não foi possível buscar a data limite: ' ||
                            SQLERRM;
        END;
        --
        IF pdt_saida_parc3 > LAST_DAY(v_dt_ref_folha) THEN
          pflg_retorno := 'Q';
          pmsg_retorno := 'A data de saída é maior do que a data de referência da folha (' ||
                          TO_CHAR(v_dt_ref_folha, 'dd/mm/rrrr') ||
                          '). deseja continuar?';
          RAISE vsaida_erro;
        END IF;
        --
        IF NOT VALIDA_PRAZO_PROGRAMACAO(pcod_empresa,
                                        pdt_saida_parc3,
                                        pmsg_retorno) THEN
          pflg_retorno := 'N';
          RAISE vsaida_erro;
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
      pmsg_retorno := 'Pkg_Ferias.Valida_Dt_Saida_Parc3_1 - Erro: ' ||
                      SQLERRM;
  END Valida_Dt_Saida_Parc3_1;
  --
  PROCEDURE Valida_Dt_Saida_Parc3_2(pcod_empresa        FERIAS.cod_empresa%TYPE,
                                    pmatricula          INF_PESSOAIS.matricula%TYPE,
                                    pcod_solicitacao    REQUISICAO_FERIAS.cod_solicitacao%TYPE,
                                    pdt_inic_per_ferias FERIAS.dt_inic_per_ferias%TYPE,
                                    pdt_saida_parc3     FERIAS.dt_saida_parc3%TYPE,
                                    pflg_retorno        IN OUT VARCHAR2,
                                    pmsg_retorno        IN OUT VARCHAR2) IS
    --
    v_dt_ref_folha DATE;
    v_dt_limite    DATE;
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    Vld_Per_Meses(pcod_empresa,
                  pmatricula,
                  pdt_saida_parc3,
                  pdt_inic_per_ferias,
                  pflg_retorno,
                  pmsg_retorno);
    IF pflg_retorno = 'N' THEN
      RAISE vsaida_erro;
    END IF;
    --
    IF pcod_solicitacao IS NULL THEN
      -- carrega limite para data de req. pessoal
      IF pcod_empresa IS NOT NULL THEN
        --
        IF pdt_saida_parc3 < v_dt_ref_folha THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'A data de saída não pode ser menor que a data de referência da folha ' ||
                          TO_CHAR(v_dt_ref_folha, 'dd/mm/rrrr') || '!';
          RAISE vsaida_erro;
        END IF;
        --
        IF TRUNC(SYSDATE) > v_dt_limite AND
           NOT (pdt_saida_parc3 > LAST_DAY(v_dt_ref_folha)) THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'O prazo para o cadastro de requisições expirou em ' || ' ' ||
                          TO_CHAR(v_dt_limite, 'dd/mm/yyyy') || '!';
          RAISE vsaida_erro;
        END IF;
        --
        IF TRUNC(SYSDATE) > pdt_saida_parc3 THEN
          pflg_retorno := 'N';
          pmsg_retorno := 'A data informada é menor do que a data atual do sistema!';
          RAISE vsaida_erro;
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
      pmsg_retorno := 'Pkg_Ferias.Valida_Dt_Saida_Parc3_2 - Erro: ' ||
                      SQLERRM;
  END Valida_Dt_Saida_Parc3_2;
  --
  PROCEDURE Valida_Num_Dias_Parc3(pnum_dias_parc3 FERIAS.num_dias_parc3%TYPE,
                                  pflg_retorno    IN OUT VARCHAR2,
                                  pmsg_retorno    IN OUT VARCHAR2) IS
  BEGIN
    --
    pflg_retorno := 'S';
    --
    IF pnum_dias_parc3 IS NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Valida_Num_Dias_Parc3.pNum_Dias_Parc3: Campo obrigatório!';
      RAISE vsaida_erro;
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Num_Dias_Parc3 - Erro: ' ||
                      SQLERRM;
  END Valida_Num_Dias_Parc3;
  --
  PROCEDURE Valida_Dt_Retorno_Parc3(pdt_saida_parc3       FERIAS.dt_saida_parc3%TYPE,
                                    pind_situacao_periodo FERIAS.ind_situacao_periodo%TYPE,
                                    pflg_retorno          IN OUT VARCHAR2,
                                    pmsg_retorno          IN OUT VARCHAR2,
                                    pdt_retorno_parc3     FERIAS.Dt_Retorno_Parc3%TYPE DEFAULT NULL) IS
  BEGIN
    --
    pflg_retorno := 'S';
    --
    IF NVL(pind_situacao_periodo, 'P') = 'P' THEN
      NULL;
    ELSE
      pflg_retorno := 'N';
      pmsg_retorno := 'P3 - A situação do período não permite mais alterações!';
      RAISE vsaida_erro;
    END IF;
    --
    IF pdt_retorno_parc3 IS NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Valida_Dt_Retorno_Parc3.pDt_Retorno_Parc3: Campo obrigatório!';
      RAISE vsaida_erro;
    ELSE
      IF pdt_saida_parc3 IS NOT NULL AND
         pdt_retorno_parc3 <= pdt_saida_parc3 THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A data de retorno não pode ser menor ou igual à data de saída!';
        RAISE vsaida_erro;
      END IF;
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Num_Dias_Parc3 - Erro: ' ||
                      SQLERRM;
  END Valida_Dt_Retorno_Parc3;
  --
  PROCEDURE Cancela_Req(psolicitacao requisicao_ferias.cod_solicitacao%TYPE,
                        pusuario     VARCHAR2,
                        pflg_retorno IN OUT VARCHAR2,
                        pmsg_retorno IN OUT VARCHAR2) IS
    /*
    
    
    
    */
    -- Regras::;
    -- 1) Ao cancelar requisição, se existir requisição específica para uma parcela posterior, esta deve ser cancelada primeiro;
    -- 2) Não é possível cancelar requisição quando houver programação para períodos superiores;
    -- 3) Não é possível cancelar requisição com férias já gozadas (ferias.ind_situacao_periodo <> P);
    -- parâmetros de entrada:
    /*
      psolicitacao requisicao_ferias.cod_solicitacao%type;
      pflg_retorno varchar2(1) := 'S';
      pmsg_retorno varchar2(4000);
    */
    vsaida_erro EXCEPTION;
    --
    --    v_parcela number(1);
    --vexiste   VARCHAR2(1) := 'N';
    --
    CURSOR c_req IS
      SELECT *
        FROM requisicao_ferias rf
       WHERE cod_solicitacao = psolicitacao;
    req c_req%ROWTYPE;
    --
    /*
    CURSOR c_fer IS
      SELECT *
      FROM   ferias f
      WHERE  f.dt_inic_per_ferias = req.dt_inic_per_ferias
      AND    f.matricula          = req.matricula
      AND    f.cod_empresa        = req.cod_empresa;
    fer c_fer%ROWTYPE;
    */
    --
  BEGIN
    --
    pflg_retorno := 'S';
    Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(PSOLICITACAO,
                                                 'CANCELA_REQ',
                                                 'N',
                                                 'REQ_FERIAS');
    --
    OPEN c_req;
    FETCH c_req
      INTO req;
    IF c_req%NOTFOUND THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Requisição não encontrada. Favor verificar!';
      CLOSE c_req;
      RAISE vsaida_erro;
    ELSIF req.sit_requisicao = 1 THEN
      --
      /*update requisicao_ferias --DEVERÁ SER FEITO PELO APEX
      set    sit_requisicao = 3
            ,usuario        = substr(pusuario||'Cancela_Req',1,30)
            ,dt_atualizacao = sysdate
      where  cod_solicitacao = req.cod_solicitacao;*/
      --
      RAISE vsaida_erro; -- Encerra o processo por aqui se a sit. da requisição não estiver concluída
    ELSIF req.sit_requisicao = 3 THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Esta requisição já encontra-se cancelada!';
      RAISE vsaida_erro;
    ELSIF req.sit_requisicao = 4 THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Esta requisição já encontra-se reprovada!';
      RAISE vsaida_erro;
    ELSIF REQ.SIT_REQUISICAO = 2 AND
          NVL(PERMISSAO_CANC_REQ_CONCLUIDA(PSOLICITACAO,
                                           REQ.COD_EMPRESA,
                                           REQ.MATRICULA,
                                           PUSUARIO),
              'N') = 'N' THEN
      -- Validação nova para cancelamento de req. CONCLUÍDA
      PFLG_RETORNO := 'N';
      PMSG_RETORNO := 'Cancelamento não permitido!';
      RAISE VSAIDA_ERRO;
    END IF;
    --
    /* Comentado em 28/01/2021 -- A tratativa será feita pela procedure EXCLUI_PARCELAS, chamada
                               -- pela PRC_ATUALIZA_REQ
        if req.sit_requisicao = 2 then
          --
          open c_fer;
          fetch c_fer into fer;
          close c_fer;
          --
          vexiste := 'N';
          --
          begin
            --
            select distinct 'S'
            into   vexiste
            from   ferias
            where  (dt_saida_parc1     is not null or dt_saida_parc2 is not null or dt_saida_parc3 is not null)
            and    dt_inic_per_ferias > req.dt_inic_per_ferias
            and    matricula          = req.matricula
            and    cod_empresa        = req.cod_empresa;
            --
          exception
            when no_data_found then
              vexiste := 'N';
            when others then
              pflg_retorno := 'N';
              pmsg_retorno := substr('Erro ao verificar programação em períodos superiores: '||sqlerrm,1,4000);
              raise vsaida_erro;
          end;
          --
          if nvl(vexiste,'N') = 'S' then
            pflg_retorno := 'N';
            pmsg_retorno := 'Funcionário com programação em períodos superiores à '||to_char(fer.dt_inic_per_ferias,'DD/MM/YYYY')||'!';
            raise vsaida_erro;
          elsif fer.ind_situacao_periodo <> 'P' then
            pflg_retorno := 'N';
            pmsg_retorno := 'Funcionário com programação de férias já gozadas!';
            raise vsaida_erro;
          end if;
          --
          -- Verifica se há requisição para parcelas posteriores
          --
          for x in (select rf.cod_solicitacao
                    from   requisicao_ferias rf
                    where  ((req.dt_saida_parc2 is not null and rf.dt_saida_parc3 is not null)
                    or      (req.dt_saida_parc2 is null and rf.dt_saida_parc2 is not null))
                    and    rf.sit_requisicao     not in (3,4)
                    and    rf.dt_inic_per_ferias = req.dt_inic_per_ferias
                    and    rf.cod_solicitacao    <> req.cod_solicitacao
                    and    rf.matricula          = req.matricula
                    and    rf.cod_empresa        = req.cod_empresa
                    order  by dt_saida_parc3 desc, dt_saida_parc2 desc) loop
            --
            pflg_retorno := 'N';
            pmsg_retorno := 'Para cancelar, você deverá cancelar a requisição '||x.cod_solicitacao||' antes!';
            raise vsaida_erro;
            --
          end loop;
          --
          if req.dt_saida_parc3 is not null then
            --
            update ferias
            set    dt_saida_parc3   = null
                  ,num_dias_parc3   = null
        --          ,dias_abono_pec3  = null
        --          ,desc_adicional3  = null
        --          ,opcao_13sal3     = null
                  ,dt_retorno_parc3 = null
                  ,tipo_ferias3     = null
        --          ,dt_pagto_parc3   = null
                  ,matricula_solicitante = null
            where  dt_saida_parc3     is not null
            and    dt_inic_per_ferias = req.dt_inic_per_ferias
            and    matricula          = req.matricula
            and    cod_empresa        = req.cod_empresa
            and    cod_solicitacao    = req.cod_solicitacao;
            --
          end if;
          --
          --
          if req.dt_saida_parc4 is not null then
            --
            update ferias
            set    dt_saida_parc4   = null
                  ,num_dias_parc4   = null
                  ,dias_abono_pec4  = null
                  ,desc_adicional4  = null
                  ,opcao_13sal4     = null
                  ,dt_retorno_parc4 = null
                  ,tipo_ferias4     = null
                  ,dt_pagto_parc4   = null
                  ,matricula_solicitante = null
                  ,usuario_prog4     = null
                  ,dt_atualizacao_prog4 = null
            where  dt_saida_parc4     is not null
            and    dt_inic_per_ferias = req.dt_inic_per_ferias
            and    matricula          = req.matricula
            and    cod_empresa        = req.cod_empresa
            and    cod_solicitacao    = req.cod_solicitacao;
            --
          end if;
          --
          if req.dt_saida_parc2 is not null then
            --
            update ferias
            set    dt_saida_parc2   = null
                  ,num_dias_parc2   = null
                  ,dias_abono_pec2  = null
                  ,desc_adicional2  = null
                  ,opcao_13sal2     = null
                  ,dt_retorno_parc2 = null
                  ,tipo_ferias2     = null
                  ,dt_pagto_parc2   = null
                  ,matricula_solicitante = null
                  ,usuario_prog2     = null
                  ,dt_atualizacao_prog2 = null
            where  dt_saida_parc2     is not null
            and    dt_inic_per_ferias = req.dt_inic_per_ferias
            and    matricula          = req.matricula
            and    cod_empresa        = req.cod_empresa
            and    cod_solicitacao    = req.cod_solicitacao;
            --
          end if;
          --
          if req.dt_saida_parc1 is not null then
            --
            update ferias
            set    dt_saida_parc1   = null
                  ,num_dias_parc1   = null
                  ,dias_abono_pec1  = null
                  ,desc_adicional1  = null
                  ,opcao_13sal1     = null
                  ,dt_retorno_parc1 = null
                  ,tipo_ferias1     = null
                  ,dt_pagto_parc1   = null
                  ,opcao_abono_pec1 = null
                  ,usuario_prog     = null
                  ,dt_atualizacao_prog = null
                  ,matricula_solicitante = null
                  ,opcao_ferias          = null
            where  dt_saida_parc1     is not null
            and    dt_inic_per_ferias = req.dt_inic_per_ferias
            and    matricula          = req.matricula
            and    cod_empresa        = req.cod_empresa
            and    cod_solicitacao    = req.cod_solicitacao;
            --
          end if;
          --
          update ferias
          set    cod_solicitacao = null
                ,dt_solicitacao  = null
                ,usuario         = substr(pusuario||'ReqFer',1,30)
                ,dt_atualizacao  = sysdate
          where  dt_inic_per_ferias = req.dt_inic_per_ferias
          and    matricula          = req.matricula
          and    cod_empresa        = req.cod_empresa
          and    cod_solicitacao    = req.cod_solicitacao;
          --
        end if;
    */
    CLOSE c_req;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      IF c_req%isopen THEN
        CLOSE c_req;
      END IF;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := SUBSTR('Erro ao cancelar requisição: ' || SQLERRM,
                             1,
                             4000);
      IF c_req%isopen THEN
        CLOSE c_req;
      END IF;
  END Cancela_Req;
  --
  PROCEDURE Pre_Insert(pcod_solicitacao      FERIAS.cod_solicitacao%TYPE,
                       pcod_empresa          EMPRESAS.cod%TYPE,
                       pfilial               FILIAIS.cod_filial%TYPE,
                       pmatricula            INF_PESSOAIS.matricula%TYPE,
                       psit_requisicao       REQUISICAO_FERIAS.sit_requisicao%TYPE,
                       pind_situacao_periodo FERIAS.ind_situacao_periodo%TYPE,
                       pdt_inic_per_ferias   FERIAS.dt_inic_per_ferias%TYPE,
                       pdt_fim_per_ferias    FERIAS.dt_fim_per_ferias%TYPE,
                       pnum_dias_parc1       NUMBER,
                       psaldo                NUMBER,
                       pdt_saida_parc1       FERIAS.dt_saida_parc1%TYPE,
                       pdt_saida_parc2       FERIAS.dt_saida_parc2%TYPE,
                       pdt_saida_parc3       FERIAS.dt_saida_parc3%TYPE,
                       pdt_saida_parc4       FERIAS.dt_saida_parc4%TYPE,
                       pdt_retorno_parc1     FERIAS.dt_retorno_parc1%TYPE,
                       pdt_retorno_parc2     FERIAS.dt_retorno_parc2%TYPE,
                       pdt_retorno_parc3     FERIAS.dt_retorno_parc3%TYPE,
                       pdt_retorno_parc4     FERIAS.dt_retorno_parc4%TYPE,
                       popcao_13sal1         REQUISICAO_FERIAS.opcao_13sal1%TYPE,
                       popcao_13sal2         REQUISICAO_FERIAS.opcao_13sal2%TYPE,
                       popcao_13sal4         REQUISICAO_FERIAS.opcao_13sal4%TYPE,
                       pdias_abono_pec1      IN OUT FERIAS.dias_abono_pec1%TYPE,
                       pjornada_reduzida     VARCHAR2,
                       pflg_retorno          IN OUT VARCHAR2,
                       pmsg_retorno          IN OUT VARCHAR2,
                       pparcelas_opc         NUMBER DEFAULT 1 --30/11/2022 - Adicionado por Robson/Rodrigo
                       ) IS
    --
    CURSOR c1 IS
      SELECT a.qtd_parcelas,
             a.meses_prog_ini,
             b.dt_ref_folha,
             c.saldo_fer_min
        FROM FERIAS_PARAMETROS a, PARAMETROS_RECURSOS_HUMANOS b, FILIAIS c
       WHERE a.cod_empresa = pcod_empresa
         AND a.cod_filial = pfilial
         AND b.cod_empresa = a.cod_empresa
         AND c.cod_empresa = a.cod_empresa
         AND c.cod_filial = a.cod_filial;
    --
    v_c1 c1%ROWTYPE;
    --
    --    vexiste varchar2(1) := 'N';
    --
    V_DT_LIMITE_REQ DATE;
    --
    --
    CURSOR C_FERIAS(V_EMP                NUMBER,
                    V_MAT                NUMBER,
                    V_DT_INIC_PER_FERIAS DATE,
                    V_DT_FIM_PER_FERIAS  DATE) IS
      SELECT IND_SITUACAO_PERIODO,
             IND_SITUACAO_PARC_1,
             IND_SITUACAO_PARC_2,
             IND_SITUACAO_PARC_4,
             DT_SAIDA_PARC1,
             DT_SAIDA_PARC2,
             DT_SAIDA_PARC4
        FROM FERIAS
       WHERE COD_EMPRESA = V_EMP
         AND MATRICULA = V_MAT
         AND DT_INIC_PER_FERIAS = V_DT_INIC_PER_FERIAS
         AND DT_FIM_PER_FERIAS = V_DT_FIM_PER_FERIAS;
  
    V_FERIAS C_FERIAS%ROWTYPE;
  
  BEGIN
    --
    pflg_retorno := 'S';
    --
    IF ((pcod_solicitacao IS NULL AND pdt_saida_parc1 IS NULL AND
       pdt_saida_parc2 IS NULL AND pdt_saida_parc4 IS NULL) /* OR -- Comentado por Igor 06/03/2019
                                                 (pcod_solicitacao IS NOT NULL AND NVL(psit_requisicao, 1) <> 3)*/
       ) THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Não há alterações para serem gravadas.';
      RAISE vsaida_erro;
    ELSE
      --
      IF NVL(pind_situacao_periodo, 'P') = 'R' THEN
        IF pdt_saida_parc4 IS NULL THEN
          IF pdt_saida_parc2 IS NULL THEN
            pflg_retorno := 'N';
            pmsg_retorno := 'Informe a data de saída da 2º parcela!';
            RAISE vsaida_erro;
          END IF;
        END IF;
        /*ELSIF pcod_solicitacao IS NOT NULL AND pdt_saida_parc2 IS NULL AND
            psit_requisicao <> 3 THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Essa requisição de férias já existe e não pode ser alterada.';
        RAISE vsaida_erro;*/ -- Comentado por Igor 06/03/2019
      END IF; -- Tratativa criada para verificação de alterações no preenchimento do forms
      --
      /*      Dias_Parc1(pdt_saida_parc1,
                 pdt_fim_per_ferias,
                 pnum_dias_parc1,
                 pdias_abono_pec1,
                 psaldo,
                 pcod_empresa,
                 pmatricula,
                 pjornada_reduzida,
                 pflg_retorno,
                 pmsg_retorno);
      IF NVL(pflg_retorno, 'S') <> 'S' THEN
        RAISE vsaida_erro;
      END IF;*/ -- Chamada redundante
      --
    
      -- Adicionado por Igor Cardoso / Rodrigo Soares (06/02/2023)
      OPEN C_FERIAS(PCOD_EMPRESA,
                    PMATRICULA,
                    PDT_INIC_PER_FERIAS,
                    PDT_FIM_PER_FERIAS);
      FETCH C_FERIAS
        INTO V_FERIAS;
      CLOSE C_FERIAS;
    
      IF V_FERIAS.IND_SITUACAO_PERIODO = 'G' THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Este período já encontra-se gozado!';
        RAISE vsaida_erro;
      END IF;
    
      IF V_FERIAS.IND_SITUACAO_PARC_1 = 'G' and pdt_saida_parc1 is not null THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Parcela 1: Este período já encontra-se gozado!';
        RAISE vsaida_erro;
      END IF;
      IF V_FERIAS.IND_SITUACAO_PARC_2 = 'G' and pdt_saida_parc2 is not null THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Parcela 2: Este período já encontra-se gozado!';
        RAISE vsaida_erro;
      END IF;
      IF V_FERIAS.IND_SITUACAO_PARC_4 = 'G' and pdt_saida_parc4 is not null THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Parcela 3: Este período já encontra-se gozado!';
        RAISE vsaida_erro;
      END IF;
    
    END IF;
    --
    Vld_Duplic_Req_Ferias(pcod_empresa,
                          pmatricula,
                          pdt_saida_parc1,
                          pdt_saida_parc2,
                          pdt_saida_parc4,
                          pdt_inic_per_ferias,
                          pdt_fim_per_ferias,
                          pnum_dias_parc1,
                          popcao_13sal1,
                          popcao_13sal2,
                          popcao_13sal4,
                          pflg_retorno,
                          pmsg_retorno);
    IF NVL(pflg_retorno, 'S') <> 'S' THEN
      RAISE vsaida_erro;
    END IF;
    --
    /*
    -- verifica se já existe requisição de férias para a matrícula solicitada, a fim de evitar duplicidade
    begin
     --
     select distinct 'S'
     into   vexiste
     from   requisicao_ferias rf
      where rf.dt_inic_per_ferias = pdt_inic_per_ferias
      and   rf.sit_requisicao     not in (3,4,6)
      and   rf.matricula          = pmatricula;
     --
    exception
      when no_data_found then
        vexiste := 'N';
      when others then
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Ferias.Pre_Insert - Erro: '||sqlerrm;
        raise vsaida_erro;
    end;
    --
    if nvl(vexiste,'N') = 'S' then
      pflg_retorno := 'N';
      pmsg_retorno := 'Já existe requisição de férias para a matrícula '||to_char(pmatricula)||'. Favor verificar.';
      raise vsaida_erro;
    end if;
    */
    --
    /* 30/11/2022 - Comentado por Robson/Rodrigo (Foi criando de outra forma logo abaixo)
    IF pdt_saida_parc1 IS NOT NULL AND pdt_retorno_parc1 IS NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'A data de retorno da 1a parcela deve ser informada!';
      RAISE vsaida_erro;
    ELSIF pdt_saida_parc1 IS NULL AND pdt_retorno_parc1 IS NOT NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'A data de saída da 1a parcela deve ser informada!';
      RAISE vsaida_erro;
    ELSIF pdt_saida_parc2 IS NOT NULL AND pdt_retorno_parc2 IS NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'A data de retorno da 2a parcela deve ser informada!';
      RAISE vsaida_erro;
    ELSIF pdt_saida_parc2 IS NULL AND pdt_retorno_parc2 IS NOT NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'A data de saída da 2a parcela deve ser informada!';
      RAISE vsaida_erro;
    ELSIF pdt_saida_parc3 IS NOT NULL AND pdt_retorno_parc3 IS NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'A data de retorno da 3a parcela deve ser informada!';
      RAISE vsaida_erro;
    ELSIF pdt_saida_parc3 IS NULL AND pdt_retorno_parc3 IS NOT NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'A data de saída da 3a parcela deve ser informada!';
      RAISE vsaida_erro;
    ELSIF pdt_saida_parc4 IS NOT NULL AND pdt_retorno_parc4 IS NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'A data de retorno da 4a parcela deve ser informada!';
      RAISE vsaida_erro;
    ELSIF pdt_saida_parc4 IS NULL AND pdt_retorno_parc4 IS NOT NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'A data de saída da 4a parcela deve ser informada!';
      RAISE vsaida_erro;
    END IF;*/
  
    /*  30/11/2022 - Adicionado por Robson/Rodrigo */
    IF pdt_saida_parc1 IS NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'A data de saída da 1a parcela deve ser informada!';
      RAISE vsaida_erro;
    ELSIF pdt_retorno_parc1 IS NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'A data de retorno da 1a parcela deve ser informada!';
      RAISE vsaida_erro;
    ELSIF pparcelas_opc > 1 AND pdt_saida_parc2 IS NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'A data de saída da 2a parcela deve ser informada!';
      RAISE vsaida_erro;
    ELSIF pparcelas_opc > 1 AND pdt_retorno_parc2 IS NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'A data de retorno da 2a parcela deve ser informada!';
      RAISE vsaida_erro;
    ELSIF pparcelas_opc > 2 AND pdt_saida_parc4 IS NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'A data de saída da 4a parcela deve ser informada!';
      RAISE vsaida_erro;
    ELSIF pparcelas_opc > 2 AND pdt_retorno_parc4 IS NULL THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'A data de retorno da 4a parcela deve ser informada!';
      RAISE vsaida_erro;
    END IF;
  
    IF V_FERIAS.IND_SITUACAO_PARC_1 <> 'C' THEN
      Dias_Parc1(pdt_saida_parc1,
                 pdt_fim_per_ferias,
                 pnum_dias_parc1,
                 pdias_abono_pec1,
                 psaldo,
                 pcod_empresa,
                 pmatricula,
                 pjornada_reduzida,
                 pflg_retorno,
                 pmsg_retorno);
    END IF;
    IF NVL(pflg_retorno, 'S') <> 'S' THEN
      RAISE vsaida_erro;
    END IF;
    --
    OPEN c1;
    FETCH c1
      INTO v_c1;
    CLOSE c1;
    --
    IF v_c1.qtd_parcelas = 1 AND v_c1.meses_prog_ini >= 12 AND
       NVL(pnum_dias_parc1, 0) + NVL(pdias_abono_pec1, 0) < psaldo THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'A somatória dos campos ""número de dias"" e ""dias de abono"" deve ser igual ao campo ""saldo final""!';
      RAISE vsaida_erro;
    END IF;
  
    VALIDA_ESTATUTARIO(PCOD_EMPRESA,
                       PMATRICULA,
                       3, --P_TIPO NUMBER,
                       PDT_SAIDA_PARC1,
                       PDT_SAIDA_PARC2,
                       PDT_RETORNO_PARC1,
                       PDT_FIM_PER_FERIAS,
                       V_DT_LIMITE_REQ,
                       pflg_retorno,
                       pmsg_retorno);
  
    IF pflg_retorno = 'N' THEN
      RAISE vsaida_erro;
    END IF;
  
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Pre_Insert: Erro - ' || SQLERRM;
  END Pre_Insert;
  --
  PROCEDURE Pre_Update(psolicitacao      requisicao_ferias.cod_solicitacao%TYPE,
                       psit_requisicao   requisicao_ferias.sit_requisicao%TYPE -- Valor exibido na tela
                      ,
                       pdt_saida_parc1   FERIAS.dt_saida_parc1%TYPE,
                       pdt_saida_parc2   FERIAS.dt_saida_parc2%TYPE,
                       pdt_saida_parc3   FERIAS.dt_saida_parc3%TYPE,
                       pdt_saida_parc4   FERIAS.dt_saida_parc4%TYPE,
                       pdt_retorno_parc1 FERIAS.dt_retorno_parc1%TYPE,
                       pdt_retorno_parc2 FERIAS.dt_retorno_parc2%TYPE,
                       pdt_retorno_parc3 FERIAS.dt_retorno_parc3%TYPE,
                       pdt_retorno_parc4 FERIAS.dt_retorno_parc4%TYPE,
                       pusuario          VARCHAR2,
                       pflg_retorno      IN OUT VARCHAR2,
                       pmsg_retorno      IN OUT VARCHAR2) IS
  
    CURSOR c1 IS
      SELECT cod_empresa, matricula, sit_requisicao
        FROM requisicao_ferias
       WHERE cod_solicitacao = psolicitacao;
  
    v_c1 c1%ROWTYPE;
  
  BEGIN
    --
    pflg_retorno := 'S';
    --
    OPEN c1;
    FETCH c1
      INTO v_c1;
    CLOSE c1;
    Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(PSOLICITACAO,
                                                 'PRE_UPDATE: PSIT_REQUISICAO/V_C1.SIT_REQUISICAO: ' ||
                                                 PSIT_REQUISICAO || '/' ||
                                                 V_C1.SIT_REQUISICAO,
                                                 'N',
                                                 'REQ_FERIAS');
    --
    Valida_Sit_Requisicao(v_c1.cod_empresa,
                          psolicitacao,
                          v_c1.matricula,
                          psit_requisicao,
                          pusuario,
                          pflg_retorno,
                          pmsg_retorno);
    --
    IF PSIT_REQUISICAO = 1 AND NVL(V_C1.SIT_REQUISICAO, '1') = '1' THEN
      -- 28/01/2021
      --
      IF pdt_saida_parc1 IS NOT NULL AND pdt_retorno_parc1 IS NULL THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A data de retorno da 1a parcela deve ser informada!';
        RAISE vsaida_erro;
      ELSIF pdt_saida_parc1 IS NULL AND pdt_retorno_parc1 IS NOT NULL THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A data de saída da 1a parcela deve ser informada!';
        RAISE vsaida_erro;
      ELSIF pdt_saida_parc2 IS NOT NULL AND pdt_retorno_parc2 IS NULL THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A data de retorno da 2a parcela deve ser informada!';
        RAISE vsaida_erro;
      ELSIF pdt_saida_parc2 IS NULL AND pdt_retorno_parc2 IS NOT NULL THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A data de saída da 2a parcela deve ser informada!';
        RAISE vsaida_erro;
      ELSIF pdt_saida_parc3 IS NOT NULL AND pdt_retorno_parc3 IS NULL THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A data de retorno da 3a parcela deve ser informada!';
        RAISE vsaida_erro;
      ELSIF pdt_saida_parc3 IS NULL AND pdt_retorno_parc3 IS NOT NULL THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A data de saída da 3a parcela deve ser informada!';
        RAISE vsaida_erro;
      ELSIF pdt_saida_parc4 IS NOT NULL AND pdt_retorno_parc4 IS NULL THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A data de retorno da 4a parcela deve ser informada!';
        RAISE vsaida_erro;
      ELSIF pdt_saida_parc4 IS NULL AND pdt_retorno_parc4 IS NOT NULL THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'A data de saída da 4a parcela deve ser informada!';
        RAISE vsaida_erro;
      END IF;
      --
    END IF;
    --
    /*    IF PSIT_REQUISICAO = 2 AND V_C1.SIT_REQUISICAO = 3 THEN
          --
          UPDATE REQUISICAO_FERIAS SET SIT_REQUISICAO = 3, USUARIO = PUSUARIO, DT_ATUALIZACAO = SYSDATE WHERE COD_SOLICITACAO = PSOLICITACAO;
          Prc_Atualiza_Req(V_C1.cod_empresa,
                                 psolicitacao,
                                 pflg_retorno,
                                 pmsg_retorno);
          IF NVL(pflg_retorno, 'S') <> 'S' THEN
            RAISE vsaida_erro;
          ELSE
            COMMIT;
            PFLG_RETORNO := 'N';
            PMSG_RETORNO := 'COMMIT REALIZADO.'||CHR(10)||'Retirar esse atalho quando o botão Salvar for habilitado';
            RAISE VSAIDA_ERRO;
          END IF;
          --
        END IF;
    */
    --
    /*
        Valida_Sit_Requisicao(v_c1.cod_empresa,
                              psolicitacao,
                              v_c1.matricula,
                              psit_requisicao ,
                              pusuario        ,
                              pflg_retorno    ,
                              pmsg_retorno    );
    */
    --
    /*
        if psit_requisicao is not null and psit_requisicao = 3 then
          cancela_req(psolicitacao, pusuario, pflg_retorno, pmsg_retorno);
          if nvl(pflg_retorno,'S') <> 'S' then
            pflg_retorno := 'N';
            raise vsaida_erro;
          end if;
        end if;
    */
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := SUBSTR('Pre_Update - Erro: ' || SQLERRM, 1, 4000);
  END;
  --
  PROCEDURE Post_Insert(pcod_empresa EMPRESAS.cod%TYPE,
                        psolicitacao REQUISICAO_FERIAS.cod_solicitacao%TYPE,
                        pusuario     VARCHAR2,
                        pflg_retorno IN OUT VARCHAR2,
                        pmsg_retorno IN OUT VARCHAR2) IS
  
    CURSOR c1 IS
      SELECT NVL(r.havera_rep, 'N') havera_rep,
             r.cod_empresa,
             r.matricula,
             i.cad_vaga,
             i.filial,
             i.cod_ccusto,
             r.dt_saida_parc2,
             r.dt_saida_parc4
        FROM requisicao_ferias r, informacoes_funcionais i
       WHERE r.cod_solicitacao = psolicitacao
         AND r.cod_empresa = i.cod_empresa
         AND r.matricula = i.matricula;
  
    v_c1 c1%ROWTYPE;
  
  BEGIN
  
    OPEN c1;
    FETCH c1
      INTO v_c1;
    CLOSE c1;
  
    --
    pflg_retorno := 'S';
    Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(PSOLICITACAO,
                                                 'POST-INSERT',
                                                 'N',
                                                 'REQ_FERIAS');
    --
    /*      IF NVL(v_c1.havera_rep,'S') = 'N' THEN
      --
      UPDATE cl_vaga
         SET sit_vaga       = 'A'
           , disponivel     = 'S'
           , dt_sit_vaga    = SYSDATE
           , Usuario        = pusuario
           , dt_atualizacao = SYSDATE
       WHERE cod_empresa    = v_c1.cod_empresa
         AND cod_filial     = v_c1.filial
         AND cod_vaga       = v_c1.cad_vaga;
      --
    END IF;*/ -- Não disponibilizar e não alterar os dados da vaga (Patrícia) 29/12/2021
  
    Prc_Insere_Aprovador(psolicitacao,
                         'REQ_FERIAS',
                         pflg_retorno,
                         pmsg_retorno);
    IF NVL(pflg_retorno, 'S') <> 'S' THEN
      RAISE vsaida_erro;
    END IF;
    --
    Prc_Atualiza_Req(pcod_empresa,
                     psolicitacao,
                     pflg_retorno,
                     pmsg_retorno);
    IF NVL(pflg_retorno, 'S') <> 'S' THEN
      RAISE vsaida_erro;
    END IF;
    --
  
    COMMIT;
  
    if v_c1.dt_saida_Parc2 is null then
    
      update requisicao_ferias
         set dt_saida_parc2   = null,
             num_dias_parc2   = null,
             dias_abono_pec2  = null,
             opcao_13sal2     = null,
             desc_adicional2  = null,
             dt_retorno_parc2 = null,
             tipo_ferias2     = null
       where cod_solicitacao = psolicitacao;
    
      commit;
    
    end if;
  
    if v_c1.dt_saida_Parc4 is null then
    
      update requisicao_ferias
         set dt_saida_parc4   = null,
             num_dias_parc4   = null,
             dias_abono_pec4  = null,
             opcao_13sal4     = null,
             desc_adicional4  = null,
             dt_retorno_parc4 = null,
             tipo_ferias4     = null
       where cod_solicitacao = psolicitacao;
    
      commit;
    
    end if;
  
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Post_Insert - Erro: ' || SQLERRM;
  END Post_Insert;
  --
  PROCEDURE Valida_Update_Rf(pcod_empresa       EMPRESAS.cod%TYPE,
                             pfilial            FILIAIS.cod_filial%TYPE,
                             pdt_saida_parc1    FERIAS.dt_saida_parc1%TYPE,
                             pdt_fim_per_ferias FERIAS.dt_fim_per_ferias%TYPE,
                             pnum_dias_parc1    NUMBER,
                             pdias_abono_pec1   IN OUT FERIAS.dias_abono_pec1%TYPE,
                             psaldo             NUMBER, -- :global.saldo (F012014_A)
                             pmatricula         inf_pessoais.matricula%TYPE,
                             pjornada_reduzida  VARCHAR2,
                             pflg_retorno       OUT VARCHAR2,
                             pmsg_retorno       OUT VARCHAR2) IS
    --
    CURSOR c1 IS
      SELECT a.qtd_parcelas,
             a.meses_prog_ini,
             b.dt_ref_folha,
             c.saldo_fer_min
        FROM FERIAS_PARAMETROS a, PARAMETROS_RECURSOS_HUMANOS b, FILIAIS c
       WHERE a.cod_empresa = pcod_empresa
         AND a.cod_filial = pfilial
         AND b.cod_empresa = a.cod_empresa
         AND c.cod_empresa = a.cod_empresa
         AND c.cod_filial = a.cod_filial;
    --
    v_c1 c1%ROWTYPE;
    --
  BEGIN
    --
    pflg_retorno := 'S';
    Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(0,
                                                 'VALIDA_UPDATE_RF',
                                                 'N',
                                                 'REQ_FERIAS');
    --
    Dias_Parc1(pdt_saida_parc1,
               pdt_fim_per_ferias,
               pnum_dias_parc1,
               pdias_abono_pec1,
               psaldo,
               pcod_empresa,
               pmatricula,
               pjornada_reduzida,
               pflg_retorno,
               pmsg_retorno);
    --
    IF NVL(pflg_retorno, 'S') <> 'S' THEN
      RAISE vsaida_erro;
    END IF;
    --
    OPEN c1;
    FETCH c1
      INTO v_c1;
    CLOSE c1;
    --
    IF v_c1.qtd_parcelas = 1 AND v_c1.meses_prog_ini >= 12 AND
       NVL(pnum_dias_parc1, 0) + NVL(pdias_abono_pec1, 0) < psaldo THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'A somatória dos campos "Número de Dias" e "Dias de Abono" deve ser igual ao campo "Saldo Final"!';
      RAISE vsaida_erro;
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Pre_Update_Rf - Erro: ' || SQLERRM;
  END Valida_Update_Rf;
  --
  PROCEDURE Post_Update(pcod_empresa EMPRESAS.cod%TYPE,
                        psolicitacao REQUISICAO_FERIAS.cod_solicitacao%TYPE,
                        pflg_retorno IN OUT VARCHAR2,
                        pmsg_retorno IN OUT VARCHAR2) IS
    --
    VSIT_REQUISICAO REQUISICAO_FERIAS.SIT_REQUISICAO%TYPE;
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    BEGIN
      SELECT SIT_REQUISICAO
        INTO VSIT_REQUISICAO
        FROM REQUISICAO_FERIAS
       WHERE COD_SOLICITACAO = PSOLICITACAO;
    END;
    Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(PSOLICITACAO,
                                                 'POST_UPDATE SIT_REQUISICAO: ' ||
                                                 VSIT_REQUISICAO,
                                                 'N',
                                                 'REQ_FERIAS');
    --
    Prc_Atualiza_Req(pcod_empresa,
                     psolicitacao,
                     pflg_retorno,
                     pmsg_retorno);
    IF NVL(pflg_retorno, 'S') <> 'S' THEN
      RAISE vsaida_erro;
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Post_Update - Erro: ' || SQLERRM;
  END Post_Update;
  --
  PROCEDURE Valida_Sequencia(pcod_empresa EMPRESAS.cod%TYPE,
                             psolicitacao consulta_requisicoes.solicitacao%TYPE,
                             pemp_aprov   EMPRESAS.cod%TYPE,
                             pmat_aprov   INF_PESSOAIS.matricula%TYPE,
                             pflg_retorno OUT VARCHAR2,
                             pmsg_retorno OUT VARCHAR2) IS
    --
    v_existe_aprov_pendente VARCHAR2(1) := NULL;
    vseq_aprov              APROVA_REQ.seq_aprov%TYPE;
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    BEGIN
      --
      /*
            SELECT af.seq_aprov
            INTO   vseq_aprov
            FROM   APROVA_FERIAS af
            WHERE  af.mat_aprov     = pmat_aprov
            AND    af.cod_emp_aprov = pemp_aprov
            AND    af.cod_solicitacao       = psolicitacao
            AND    af.cod_empresa   = pcod_empresa;
      */ -- Substituído por Adriana
      SELECT af.seq_aprov
        INTO vseq_aprov
        FROM APROVA_FERIAS af
       WHERE (EXISTS
              (SELECT DISTINCT 1
                 FROM REQUISICAO_FERIAS RF, INFORMACOES_FUNCIONAIS_CAD IFF
                WHERE (EXISTS
                       (SELECT 1
                          FROM SUB_CCUSTO SC
                         WHERE SC.MAT_SUBS = pmat_aprov
                           AND SC.COD_EMP_SUBS = pemp_aprov
                           AND SC.MAT_GESTOR = AF.MAT_APROV
                           AND SC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                           AND SC.COD_SUB_CCUSTO = IFF.COD_SUB_CCUSTO
                           AND SC.COD_CCUSTO = IFF.COD_CCUSTO
                           AND SC.COD_EMPRESA = IFF.COD_EMPRESA) OR EXISTS
                       (SELECT 1
                          FROM CENTRO_DE_CUSTO CC
                         WHERE CC.MATRICULA_SUPLENTE = pmat_aprov
                           AND CC.COD_EMP_SUPLENTE = pemp_aprov
                           AND CC.MATRICULA_GESTOR = AF.MAT_APROV
                           AND CC.COD_EMP_GESTOR = AF.COD_EMP_APROV
                           AND CC.COD = IFF.COD_CCUSTO
                           AND CC.COD_EMPRESA = IFF.COD_EMPRESA) OR EXISTS
                       (SELECT 1
                          FROM REQUISICAO_FERIAS          RF2,
                               INFORMACOES_FUNCIONAIS_CAD IFF2,
                               CENTRO_DE_CUSTO            CC2,
                               CENTRO_DE_CUSTO            CCS
                         WHERE CCS.MATRICULA_SUPLENTE = pmat_aprov
                           AND CCS.COD_EMP_SUPLENTE = pemp_aprov
                           AND CCS.COD = CC2.COD_CCUSTO_SUPERIOR
                           AND CCS.COD_EMPRESA = CC2.COD_EMPRESA
                           AND CC2.MATRICULA_GESTOR = RF2.MATRICULA
                           AND CC2.COD_EMP_GESTOR = RF2.COD_EMPRESA
                           AND CC2.COD = IFF2.COD_CCUSTO
                           AND CC2.COD_EMPRESA = IFF2.COD_EMPRESA
                           AND IFF2.MATRICULA = RF2.MATRICULA
                           AND IFF2.COD_EMPRESA = RF2.COD_EMPRESA
                           AND RF2.COD_SOLICITACAO = psolicitacao))
                  AND IFF.MATRICULA = RF.MATRICULA
                  AND IFF.COD_EMPRESA = RF.COD_EMPRESA
                  AND RF.COD_SOLICITACAO = psolicitacao) OR
              (af.mat_aprov = pmat_aprov AND af.cod_emp_aprov = pemp_aprov))
         AND af.status_aprov = 'P'
         AND af.cod_solicitacao = psolicitacao
         AND af.cod_empresa = pcod_empresa;
      --
    EXCEPTION
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Ferias.Valida_Sequencia - Erro: ' || SQLERRM;
        RAISE vsaida_erro;
    END;
    --
    BEGIN
      --
      SELECT DISTINCT 'S'
        INTO v_existe_aprov_pendente
        FROM APROVA_FERIAS af
       WHERE af.status_aprov = 'P'
         AND af.seq_aprov < vseq_aprov
         AND af.cod_solicitacao = psolicitacao
         AND af.cod_empresa = pcod_empresa;
      --
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        v_existe_aprov_pendente := 'N';
      WHEN OTHERS THEN
        pflg_retorno := 'N';
        pmsg_retorno := 'Pkg_Ferias.Valida_Sequencia - Erro ao validar a sequência de aprovações: ' ||
                        SQLERRM;
        RAISE vsaida_erro;
    END;
    --
    IF v_existe_aprov_pendente = 'S' THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'É necessário a aprovação de uma sequência anterior para qualquer alteração!';
      RAISE vsaida_erro;
    END IF;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      NULL;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Pkg_Ferias.Valida_Sequencia - Erro: ' || SQLERRM;
  END Valida_Sequencia;
  -- ============================================================================= --
  FUNCTION fnc_ValidaEstatutario(pEmpresa        IN NUMBER,
                                 pMatricula      IN NUMBER,
                                 pTipo           IN NUMBER,
                                 pDtSaidaParc    IN DATE,
                                 pDtSaidaParcX   IN DATE,
                                 pDtFimPerFerias IN DATE,
                                 pDtRetornParc   IN DATE) RETURN VARCHAR2 IS
    vReturn VARCHAR2(250) DEFAULT NULL;
    --
    CURSOR c1 IS
      SELECT b.vinculo, a.dt_admissao
        FROM informacoes_funcionais a, fer_vinc_estatutario b
       WHERE a.cod_empresa = pEmpresa
         AND a.matricula = pMatricula
         AND b.cod_empresa = a.cod_empresa
         AND b.cod_filial = a.filial
         AND b.vinculo = a.vinculo;
    --
    v_c1             c1%ROWTYPE;
    v_limite_retorno DATE;
  BEGIN
  
    IF pEmpresa IS NOT NULL AND pMatricula IS NOT NULL AND
       pDtSaidaParc IS NOT NULL THEN
      --
      OPEN c1;
      FETCH c1
        INTO v_c1;
      CLOSE c1;
      --
      IF TO_CHAR(v_c1.dt_admissao, 'mm') = '12' AND
         pDtSaidaParc <=
         LAST_DAY(ADD_MONTHS(TRUNC(v_c1.dt_admissao, 'mm'), 24)) AND
         pDtSaidaParcX IS NULL THEN
        GOTO PULA;
      END IF;
      --
      IF v_c1.vinculo IS NOT NULL THEN
        v_limite_retorno := TO_DATE('31/12/' ||
                                    TO_CHAR(pDtFimPerFerias, 'YYYY'),
                                    'DD/MM/YYYY');
        IF pTipo = 1 OR pTipo = 3 THEN
          IF pDtSaidaParc > v_limite_retorno THEN
            vReturn := '.A data de saída não pode ultrapassar o ano letivo.';
          END IF;
        END IF;
        --
        IF pTipo = 2 OR pTipo = 3 THEN
          IF pDtRetornParc > v_limite_retorno THEN
            vReturn := vReturn ||
                       '.A data de retorno não pode ultrapassar o ano letivo.';
          END IF;
        END IF;
      END IF;
    ELSE
      vReturn := 'Os parâmetros [PEMPRESA, PMATRICULA, PTIPO e PDTFIMPERFERIAS] devem ser informados!';
    END IF;
    --
    IF vReturn IS NOT NULL THEN
      vReturn := '.Funcionário com vínculo Estatutário!' || '|' || vReturn || '|' ||
                 '.Limite: ' || TO_CHAR(v_limite_retorno, 'DD/MM/YYYY') || '.';
    END IF;
    <<PULA>>
  --NULL;
    RETURN(vReturn);
  END;
  -- ============================================================================= --
  FUNCTION fnc_VerifPerOutraEmp(pEmpresa        IN NUMBER,
                                pMatricula      IN NUMBER,
                                pDtParcSR       IN DATE,
                                pDtFimPerFerias IN DATE) RETURN VARCHAR2 IS
  
    vReturn VARCHAR2(250) DEFAULT NULL;
  
    CURSOR C0 IS
      SELECT A.NUM_CPF,
             A.DC_CPF,
             B.VINCULO,
             c.dias_fer,
             c.dias_per_aquis,
             b.dt_admissao
        FROM INF_PESSOAIS A, INFORMACOES_FUNCIONAIS B, sindicatos c
       WHERE A.COD_EMPRESA = pEMPRESA
         AND A.MATRICULA = pMATRICULA
         AND B.COD_EMPRESA = A.COD_EMPRESA
         AND B.MATRICULA = A.MATRICULA
         -- Funcionario com vinculo em outra empresa
         AND b.VINCULO IN ('1', 'C', '92', '2', '3', '4', '10', '32', '85')
         AND c.cod_empresa = b.cod_empresa
         AND c.cod = b.num_sind_diss;
    V_C0 C0%ROWTYPE;
  
    CURSOR C1 IS
      SELECT A.COD_EMPRESA,
             A.MATRICULA,
             b.dc_matricula,
             a.dt_fim_per_ferias,
             A.IND_SITUACAO_PERIODO,
             b.num_cpf,
             b.dc_cpf,
             c.dt_admissao
        FROM ferias                 a,
             inf_pessoais           b,
             INFORMACOES_FUNCIONAIS C,
             FER_VINC_ESTATUTARIO   d
       WHERE b.cod_empresa = a.cod_empresa
         AND b.matricula = a.matricula
         AND C.COD_EMPRESA = A.COD_EMPRESA
         AND C.MATRICULA = A.MATRICULA
         AND C.SITUACAO < '90'
         AND b.NUM_CPF = V_C0.NUM_CPF
         AND b.dc_cpf = V_C0.DC_CPF
         AND a.ind_situacao_periodo IN ('P', 'R')
         -- o funcionário da outra empresa deve ser complementarista
         AND c.VINCULO IN ('T', '4', '10') -- Complementarista
         AND D.COD_EMPRESA = C.COD_EMPRESA
         AND D.COD_FILIAL = C.FILIAL
         AND D.VINCULO = C.VINCULO
       ORDER BY A.DT_INIC_PER_FERIAS ASC;
    V_C1 C1%ROWTYPE;
  
    CURSOR C2 IS
      SELECT a.cod_empresa,
             A.MATRICULA,
             a.dt_inic_per_ferias,
             a.dt_fim_per_Ferias
        FROM ferias a, inf_pessoais b, INFORMACOES_FUNCIONAIS C
       WHERE b.cod_empresa = a.cod_empresa
         AND b.matricula = a.matricula
         AND C.COD_EMPRESA = A.COD_EMPRESA
         AND C.MATRICULA = A.MATRICULA
         AND C.SITUACAO < '90'
         AND b.NUM_CPF = V_C0.NUM_CPF
         AND b.dc_cpf = V_C0.DC_CPF
         AND A.DT_FIM_PER_FERIAS = pDtFimPerFerias
         AND a.ind_situacao_periodo IN ('P', 'R')
         AND c.VINCULO IN ('1', 'C', '92', '2', '3', '4', '10', '32', '85');
       --ORDER BY A.DT_INIC_PER_FERIAS DESC;
    V_C2 C2%ROWTYPE;
  
    CURSOR C3 IS
      SELECT a.cod_empresa,
             A.MATRICULA,
             a.dt_inic_per_ferias,
             a.dt_fim_per_Ferias,
             pDtFimPerFerias + 1 INIC_PER,
             a.dt_fim_per_Ferias + 365 FIM_PER
        FROM ferias a, inf_pessoais b, INFORMACOES_FUNCIONAIS C
       WHERE b.cod_empresa = a.cod_empresa
         AND b.matricula = a.matricula
         AND C.COD_EMPRESA = A.COD_EMPRESA
         AND C.MATRICULA = A.MATRICULA
         AND C.SITUACAO < '90'
         AND b.NUM_CPF = V_C0.NUM_CPF
         AND b.dc_cpf = V_C0.DC_CPF
         AND a.ind_situacao_periodo IN ('P', 'R')
         AND c.VINCULO IN
             ('1', 'C', '92', '2', '3', '4', '10', '32', '85', 'T')
         AND a.cod_empresa <> 3
       ORDER BY A.DT_INIC_PER_FERIAS ASC;
    V_C3 C3%ROWTYPE;
  
    CURSOR C4 IS
      SELECT b.dc_matricula,
             b.num_cpf,
             b.dc_cpf,
             c.dt_admissao,
             c.cod_empresa
        FROM inf_pessoais           b,
             INFORMACOES_FUNCIONAIS C,
             FER_VINC_ESTATUTARIO   d
       WHERE C.COD_EMPRESA = b.COD_EMPRESA
         AND C.MATRICULA = b.MATRICULA
         AND C.SITUACAO < '90'
         AND b.NUM_CPF = V_C0.NUM_CPF
         AND b.dc_cpf = V_C0.DC_CPF
         AND c.VINCULO IN ('T', '4', '10')
         AND D.COD_EMPRESA = C.COD_EMPRESA
         AND D.COD_FILIAL = C.FILIAL
         AND D.VINCULO = C.VINCULO;
    V_C4 C4%ROWTYPE;
  
    function valida_periodo(pper1_ini date,
                            pper1_fim date,
                            pper2_ini date,
                            pper2_fim date,
                            pdt_saida date) return varchar2 is
    
      v_dt_ini date;
      v_dt_fim date;
    
      vReturn varchar2(250);
    begin
      /*if to_char(pper1_ini, 'yyyy') = to_char(pper2_ini, 'yyyy') then
        if pper1_ini > pper2_ini then
          v_dt_ini := add_months(pper1_ini, 12);
          v_dt_fim := add_months(pper2_fim, 12);
        else
          v_dt_ini := add_months(pper2_ini, 12);
          v_dt_fim := add_months(pper1_fim, 12);
        end if;
      els*/
      if pper1_ini between pper2_ini and pper2_fim then
        v_dt_ini := add_months(pper1_ini, 12);
        v_dt_fim := add_months(pper2_fim, 12);
      
        --elsif pper2_ini between pper1_ini and pper1_fim then
      else
        v_dt_ini := add_months(pper2_ini, 12);
        v_dt_fim := add_months(pper1_fim, 12);
      
      end if;
    
      dbms_output.put_line('interseção de férias ' || v_dt_ini || ' - ' ||
                           v_dt_fim);
    
      IF pdt_saida NOT BETWEEN v_dt_ini AND v_dt_fim THEN
        IF vReturn IS NOT NULL THEN
          vReturn := vReturn || '|' ||
                     '.Informe uma data que esteja entre ' ||
                     TO_CHAR(v_dt_ini, 'dd/mm/yyyy') || ' e ' ||
                     TO_CHAR((v_dt_fim) - 31, 'dd/mm/yyyy') || '.';
        ELSE
          vReturn := '.Esta data de saída ' ||
                     to_char(pdt_saida, 'dd/mm/yyyy') ||
                     ' está fora do período de interseção de férias.' || '|' ||
                     '.Informe uma data entre ' ||
                     TO_CHAR(v_dt_ini, 'dd/mm/yyyy') || ' e ' ||
                     TO_CHAR((v_dt_fim) - 31, 'dd/mm/yyyy') || '.';
        END IF;
      END IF;
    
      return vReturn;
    end;
  
  BEGIN
    --
    OPEN C0;
    FETCH C0
      INTO V_C0;
    CLOSE C0;
    --
    --Senão retornar o CPF, essa matricula não trabalha em outra empresa
    if v_c0.num_cpf is null then
      return null;
    end if;
    
    OPEN C1;
    FETCH C1
      INTO V_C1;
    CLOSE C1;
    --
    OPEN C4;
    FETCH C4
      INTO V_C4;
    CLOSE C4;
    --
    OPEN C2;
    FETCH C2
      INTO V_C2;
    CLOSE C2;
  
    IF pEmpresa = 3 AND NVL(v_C1.cod_empresa, pEmpresa) <> pEmpresa AND
       V_C0.dias_fer = 0 AND V_C0.dias_per_aquis = 0 THEN
    
      OPEN C3;
      FETCH C3
        INTO V_C3;
      CLOSE C3;
    
      vReturn := valida_periodo(v_c2.dt_inic_per_ferias,
                                v_c2.dt_fim_per_ferias,
                                v_c3.dt_inic_per_ferias,
                                v_c3.dt_fim_per_ferias,
                                pDtParcSR);
    
    ELSIF pEmpresa = 3 AND NVL(v_C4.cod_empresa, pEmpresa) <> pEmpresa AND
          V_C0.dias_fer = 0 AND V_C0.dias_per_aquis = 0 THEN
    
      vReturn := valida_periodo(v_c2.dt_inic_per_ferias,
                                v_c2.dt_fim_per_ferias,
                                v_c4.dt_admissao,
                                add_months(v_c4.dt_admissao, 12)-1,
                                pDtParcSR);
    
    END IF;
  
    RETURN vReturn;
  END fnc_VerifPerOutraEmp;
  -- ============================================================================= --
  FUNCTION fnc_VerifEstatutario(pEmpresa   IN informacoes_funcionais_cad.cod_empresa%TYPE,
                                pMatricula IN informacoes_funcionais_cad.matricula%TYPE)
    RETURN VARCHAR2 IS
    vReturn VARCHAR2(1) DEFAULT NULL;
    --
    CURSOR cEstatutario IS
      SELECT 1
        FROM informacoes_funcionais_cad f
       WHERE f.cod_empresa = pEmpresa
         AND f.matricula = pMatricula
         AND EXISTS (SELECT 1
                FROM fer_vinc_estatutario x
               WHERE x.cod_empresa = f.cod_empresa
                 AND x.cod_filial = f.filial
                 AND x.vinculo = f.vinculo);
    --
    vEstatutario NUMBER DEFAULT 0;
  BEGIN
    IF pEmpresa IS NOT NULL AND pMatricula IS NOT NULL THEN
      OPEN cEstatutario;
      FETCH cEstatutario
        INTO vEstatutario;
      CLOSE cEstatutario;
      --
      IF vEstatutario = 1 THEN
        vReturn := 'S';
      ELSE
        vReturn := 'N';
      END IF;
    END IF;
    --
    RETURN(vReturn);
  END;
  -- ============================================================================= --
  FUNCTION fnc_VerifVincEstagiario(pEmpresa   IN NUMBER,
                                   pMatricula IN NUMBER) RETURN VARCHAR2 IS
    vReturn VARCHAR2(1) DEFAULT NULL;
    --
    CURSOR cInf IS
      SELECT f.vinculo
        FROM informacoes_funcionais_cad f
       WHERE f.cod_empresa = pEmpresa
         AND f.matricula = pMatricula;
    --
    rInf cInf%ROWTYPE;
  BEGIN
    IF pEmpresa IS NOT NULL AND pMatricula IS NOT NULL THEN
      OPEN cInf;
      FETCH cInf
        INTO rInf;
      CLOSE cInf;
      --
      IF rInf.vinculo = 'E' THEN
        vReturn := 'S';
      ELSE
        vReturn := 'N';
      END IF;
    END IF;
    --
    RETURN(vReturn);
  END;
  -- ============================================================================= --
  FUNCTION fnc_ValDtRetFeriasEstagiario(pEmpresa      IN NUMBER,
                                        pMatricula    IN NUMBER,
                                        pDtRetFerParc IN DATE)
    RETURN VARCHAR2 IS
    vReturn VARCHAR2(250) DEFAULT NULL;
    --
    CURSOR cInf IS
      SELECT f.vinculo,
             f.prorrog_contrato_prz_determ,
             f.data_contrato_prz_determinado
        FROM informacoes_funcionais_cad f
       WHERE f.cod_empresa = pEmpresa
         AND f.matricula = pMatricula;
    --
    rInf cInf%ROWTYPE;
  BEGIN
    IF pEmpresa IS NOT NULL AND pMatricula IS NOT NULL AND
       pDtRetFerParc IS NOT NULL THEN
      OPEN cInf;
      FETCH cInf
        INTO rInf;
      CLOSE cInf;
      --
      IF rInf.vinculo = 'E' THEN
        IF rInf.prorrog_contrato_prz_determ IS NOT NULL THEN
          IF pDtRetFerParc > rInf.prorrog_contrato_prz_determ THEN
            vReturn := 'Retorno deve ser menor ou igual a [' ||
                       TO_CHAR(rInf.prorrog_contrato_prz_determ,
                               'DD/MM/RRRR') || ']!';
          END IF;
        ELSIF rInf.data_contrato_prz_determinado IS NOT NULL THEN
          IF pDtRetFerParc > rInf.data_contrato_prz_determinado THEN
            vReturn := 'Retorno deve ser menor ou igual a [' ||
                       TO_CHAR(rInf.data_contrato_prz_determinado,
                               'DD/MM/RRRR') || ']!';
          END IF;
        END IF;
      END IF;
    ELSE
      vReturn := 'Os parâmetros [PEMPRESA, PMATRICULA e PDTRETFERPARC] devem ser informados!';
    END IF;
    --
    RETURN(vReturn);
  END;
  -- ============================================================================= --

  PROCEDURE prc_verif_limite_agend_ferias(p_cod_empresa        IN NUMBER,
                                          p_matricula          NUMBER,
                                          p_dt_prog            IN DATE,
                                          p_num_parcela        IN NUMBER,
                                          p_dt_inic_per_ferias IN DATE,
                                          p_dt_fim_per_ferias  IN DATE,
                                          pflg_retorno         IN OUT VARCHAR2,
                                          pmsg_retorno         IN OUT VARCHAR2) IS
    v_dt_limite_      DATE;
    v_dt_periodo_fin_ DATE;
    v_contador        NUMBER;
    v_tem_periodo     VARCHAR2(1);
    v_dt_saida_parc1  DATE;
    v_dt_saida_parc2  DATE;
    v_dt_saida_parc4  DATE;
    v_dt_saida        DATE;
  
    CURSOR C0(p_emp NUMBER, p_mat NUMBER) IS
      SELECT TEXTO ACAO_JUDICIAL
        FROM CAMPO_DE_CADASTRO
       WHERE EMPRESA = P_EMP
         AND CHAVE_DE_TABELA = P_MAT
         AND TABELA = 'INF-FUNCIONAIS'
         AND CAMPO = 'ACAO_JUDICIAL'
         AND ROWNUM = 1;
    V_C0 C0%ROWTYPE;
  
    CURSOR c1 IS -- Humberto/Rodrigo 05/08/2022
      SELECT a.num_sind_diss, b.LIMITE_AG_FERIAS
        FROM informacoes_funcionais a, sindicatos b
       WHERE a.cod_empresa = p_cod_empresa
         AND a.matricula = p_matricula
         AND b.cod_empresa = a.cod_empresa
         AND b.cod = a.num_sind_diss;
    v_c1 c1%ROWTYPE;
  BEGIN
    OPEN c0(p_cod_empresa, p_matricula);
    FETCH c0
      INTO v_C0;
    CLOSE c0;
    v_c0.acao_judicial := NVL(v_c0.acao_judicial, 'N');
  
    /*obtem os parametros da tabela que contem as limitacoes*/
  
    ----------------------------------------------------------------------------------
    -- Humberto/Rodrigo 05/08/2022: acrescentado cursor e if
    OPEN c1;
    FETCH c1
      INTO v_c1;
    CLOSE c1;
  
    -- Bruno Sousa 08/01/2026 - 
    -- Acrescentado condição AND v_c0.acao_judicial = 'S'
    IF v_c1.limite_ag_ferias = 'N' AND v_c0.acao_judicial = 'S' THEN
      pflg_retorno := 'S';
    ELSE
    
      ---- alterado pelo Ylem em 23/05/2023  ---
      v_tem_periodo := 'N';
    
      BEGIN
        select dt_saida_parc1, dt_saida_parc2, dt_saida_parc4
          into v_dt_saida_parc1, v_dt_saida_parc2, v_dt_saida_parc4
          from ferias f
         where f.cod_empresa = p_cod_empresa
           and f.matricula = p_matricula
           and (f.dt_saida_parc1 is not null or
               f.dt_saida_parc2 is not null or
               f.dt_saida_parc4 is not null)
           and f.dt_inic_per_ferias = p_dt_inic_per_ferias
           and f.dt_fim_per_ferias = p_dt_fim_per_ferias
           and f.ind_situacao_periodo != 'G';
      
        v_contador := 1;
      
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          v_contador := 0;
        
      END;
    
      IF nvl(v_contador, 0) > 0 then
        --- tem periodo de férias programado     
      
        --- verificar em qual periodo da agenda utilizando das datas parc1 , parc2 ou parc4
      
        IF p_num_parcela = 1 AND v_dt_saida_parc1 IS NOT NULL THEN
        
          v_dt_saida := v_dt_saida_parc1;
        
        ELSIF p_num_parcela = 2 AND v_dt_saida_parc2 IS NOT NULL THEN
        
          v_dt_saida := v_dt_saida_parc2;
        
        ELSIF p_num_parcela = 4 AND v_dt_saida_parc4 IS NOT NULL THEN
        
          v_dt_saida := v_dt_saida_parc4;
        
        END IF;
      
        BEGIN
          SELECT TO_DATE(replace(t.dt_limite, '/') || '/' ||
                         TO_CHAR(SYSDATE, 'yyyy'),
                         'ddmm/yyyy') dt_limite,
                 TO_DATE(replace(t.dt_periodo_fin, '/') || '/' ||
                         trim(TO_CHAR(TO_NUMBER(TO_CHAR(SYSDATE, 'yyyy')) + CASE
                                        WHEN NVL(t.ind_periodo_ano_seguinte, 'N') = 'S' THEN
                                         1
                                        ELSE
                                         0
                                      END)),
                         'ddmm/yyyy') dt_periodo_fin
            INTO v_dt_limite_, v_dt_periodo_fin_
            FROM limite_agend_ferias t
           WHERE v_dt_saida BETWEEN
                 TO_DATE(replace(t.dt_periodo_ini, '/') || '/' ||
                         trim(TO_CHAR(TO_NUMBER(TO_CHAR(SYSDATE, 'yyyy')) + CASE
                                        WHEN NVL(t.ind_periodo_ano_seguinte, 'N') = 'S' THEN
                                         1
                                        ELSE
                                         0
                                      END)),
                         'ddmm/yyyy') AND
                 TO_DATE(replace(t.dt_periodo_fin, '/') || '/' ||
                         trim(TO_CHAR(TO_NUMBER(TO_CHAR(SYSDATE, 'yyyy')) + CASE
                                        WHEN NVL(t.ind_periodo_ano_seguinte, 'N') = 'S' THEN
                                         1
                                        ELSE
                                         0
                                      END)),
                         'ddmm/yyyy')
             AND t.cod_empresa = p_cod_empresa;
        EXCEPTION
          WHEN NO_DATA_FOUND THEN
            pflg_retorno := 'S';
        END;
      
        if v_dt_limite_ < p_dt_prog and trunc(sysdate) > v_dt_limite_ then
        
          v_tem_periodo := 'S';
          pflg_retorno  := 'N';
          pmsg_retorno  := 'Já existe férias programadas na data : ' ||
                           TO_CHAR(v_dt_saida, 'dd/mm/yyyy') ||
                           ' ,ultrapassando a data limite de : ' ||
                           TO_CHAR(v_dt_limite_, 'dd/mm/yyyy');
        
        end if;
      
      END IF;
      ---- fim da alteração Ylem em 23/05/2023 ----
    
      ----------------------------------------------------------------------------------
      IF v_tem_periodo = 'N' THEN
        BEGIN
          SELECT TO_DATE(t.dt_limite || '/' || TO_CHAR(SYSDATE, 'yyyy'),
                         'dd/mm/yyyy') dt_limite,
                 --to_date(t.dt_periodo_ini||'/'||to_char(sysdate,'yyyy'),'dd/mm/yyyy') dt_periodo_ini,
                 TO_DATE(t.dt_periodo_fin || '/' ||
                         trim(TO_CHAR(TO_NUMBER(TO_CHAR(SYSDATE, 'yyyy')) + CASE
                                        WHEN NVL(t.ind_periodo_ano_seguinte, 'N') = 'S' THEN
                                         1
                                        ELSE
                                         0
                                      END)),
                         'dd/mm/yyyy') dt_periodo_fin
            INTO v_dt_limite_, v_dt_periodo_fin_
            FROM limite_agend_ferias t
           WHERE p_dt_prog BETWEEN
                 TO_DATE(t.dt_periodo_ini || '/' ||
                         trim(TO_CHAR(TO_NUMBER(TO_CHAR(SYSDATE, 'yyyy')) + CASE
                                        WHEN NVL(t.ind_periodo_ano_seguinte, 'N') = 'S' THEN
                                         1
                                        ELSE
                                         0
                                      END)),
                         'dd/mm/yyyy') AND
                 TO_DATE(t.dt_periodo_fin || '/' ||
                         trim(TO_CHAR(TO_NUMBER(TO_CHAR(SYSDATE, 'yyyy')) + CASE
                                        WHEN NVL(t.ind_periodo_ano_seguinte, 'N') = 'S' THEN
                                         1
                                        ELSE
                                         0
                                      END)),
                         'dd/mm/yyyy')
             AND t.cod_empresa = p_cod_empresa;
          --
        
          IF TRUNC(SYSDATE) > v_dt_limite_ THEN
            IF p_dt_prog <= v_dt_periodo_fin_ THEN
              pflg_retorno := 'N';
              pmsg_retorno := 'Data de saída de férias deve ser superior a: ' ||
                              TO_CHAR(v_dt_periodo_fin_, 'dd/mm/yyyy');
              -- p_retorno   := 'DT_INVALIDA';
              -- p_dt_valida := v_dt_periodo_fin_;
            
            ELSE
              pflg_retorno := 'S';
            END IF;
          ELSE
            pflg_retorno := 'S';
          END IF;
        EXCEPTION
          WHEN NO_DATA_FOUND THEN
            pflg_retorno := 'S';
        END;
      END IF;
    
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Erro na execução VERIF_LIMITE_AGEND_FERIAS: ' ||
                      SQLERRM;
  END prc_verif_limite_agend_ferias;

  FUNCTION ver_radio_estat(p_cod_empresa NUMBER, p_matricula NUMBER)
    RETURN VARCHAR2 IS
    CURSOR C1 IS -- Humberto/Rodrigo 09/08/2022
      SELECT A.COD_EMPRESA,
             A.MATRICULA,
             A.DC_MATRICULA,
             A.DT_ADMISSAO,
             a.filial,
             a.vinculo,
             B.DIAS_PER_AQUIS,
             B.DIAS_FER
        FROM INFORMACOES_FUNCIONAIS A, SINDICATOS b
       WHERE B.COD_EMPRESA = A.COD_EMPRESA
         AND B.COD = A.NUM_SIND_DISS
         AND A.COD_EMPRESA = P_COD_EMPRESA
         AND A.MATRICULA = P_MATRICULA;
    V_C1 C1%ROWTYPE;
  
    CURSOR C2 IS
      SELECT A.DT_REF_FERIAS
        FROM PARAMETROS_RECURSOS_HUMANOS A
       WHERE A.COD_EMPRESA = P_COD_EMPRESA;
    V_C2 C2%ROWTYPE;
    /*
    CURSOR C3 IS
           SELECT A.COD_EMPRESA, A.MATRICULA, A.DC_MATRICULA, B.DIAS_PER_AQUIS, B.DIAS_FER, A.DT_ADMISSAO
           FROM   INFORMACOES_FUNCIONAIS A, SINDICATOS B
           WHERE  B.COD_EMPRESA    = A.COD_EMPRESA
           AND    B.COD            = A.NUM_SIND_DISS
           AND    A.COD_EMPRESA    = P_COD_EMPRESA
           AND    A.MATRICULA      = P_MATRICULA
           AND    B.DIAS_PER_AQUIS > 0
           AND    B.DIAS_FER       > 0
           AND    V_C2.DT_REF_FERIAS = TRUNC(A.DT_ADMISSAO,'MM');*/
  
  BEGIN
    -- Humberto/Rodrigo 09/08/2022 ----------------------------------------------------------------------------------
    v_c1 := NULL;
    OPEN c1; -- Informações Funcionais
    FETCH c1
      INTO v_c1;
    CLOSE c1;
    --
    v_c2 := NULL;
    OPEN c2; -- Informações Funcionais
    FETCH c2
      INTO v_c2;
    CLOSE c2;
    --
    IF Pkg_Atlz_Saldo_Ferias.F_VINC_ESTATUTARIO(P_COD_EMPRESA,
                                                P_MATRICULA,
                                                v_c1.dt_admissao,
                                                v_c1.FILIAL,
                                                v_c1.VINCULO,
                                                V_C2.DT_REF_FERIAS) =
       v_c1.vinculo THEN
      RETURN('S');
    END IF;
  
    IF V_C1.DIAS_PER_AQUIS > 0 AND V_C1.DIAS_FER > 0 AND
       V_C2.DT_REF_FERIAS = TRUNC(V_C1.DT_ADMISSAO, 'MM') THEN
      RETURN('S');
    ELSE
      RETURN('N');
    END IF;
    -------------------------------------------------------------
  
  END ver_radio_estat;

  -----

  PROCEDURE VALIDA_ESTATUTARIO(P_COD_EMPRESA       NUMBER,
                               P_MATRICULA         NUMBER,
                               P_TIPO              NUMBER,
                               P_DT_SAIDA_PARC1    DATE,
                               P_DT_SAIDA_PARC2    DATE,
                               P_DT_RETORNO_PARC1  DATE,
                               P_DT_FIM_PER_FERIAS DATE,
                               P_DT_LIMITE_REQ     OUT DATE,
                               
                               pflg_retorno IN OUT VARCHAR2,
                               pmsg_retorno IN OUT VARCHAR2) IS
    /*Alt.1, alteracao ref. necessidade base I N C O R, PSMarconato/Rodrigo, 24/08/2022*/
    CURSOR c1 IS
      SELECT b.vinculo, a.dt_admissao
        FROM INFORMACOES_FUNCIONAIS A, FER_VINC_ESTATUTARIO b
       WHERE A.COD_EMPRESA = P_COD_EMPRESA
         AND A.MATRICULA = P_MATRICULA
         AND B.COD_EMPRESA = A.COD_EMPRESA
         AND B.COD_FILIAL = A.FILIAL
         AND B.VINCULO = A.VINCULO;
    V_C1 C1%ROWTYPE;
  
    v_limite_retorno DATE;
    v_limite_saida   DATE; /*Alt.1*/
  
    V_FLG VARCHAR2(1) := 'S';
    V_MSG VARCHAR2(4000);
  
    saida EXCEPTION;
  
  BEGIN
    OPEN C1;
    FETCH C1
      INTO V_C1;
    CLOSE C1;
  
    IF TO_CHAR(v_C1.dt_admissao, 'mm') = '12' AND
       P_DT_SAIDA_PARC1 <=
       LAST_DAY(ADD_MONTHS(TRUNC(V_C1.dt_admissao, 'mm'), 24)) AND
       P_DT_SAIDA_PARC2 IS NULL THEN
      GOTO pula;
    END IF;
  
    IF V_C1.VINCULO IS NOT NULL and P_DT_FIM_PER_FERIAS IS NOT NULL THEN
      v_limite_retorno := TO_DATE('31/12/' ||
                                  TO_CHAR(P_DT_FIM_PER_FERIAS, 'YYYY'),
                                  'DD/MM/YYYY');
      v_limite_saida   := TO_DATE('01/12/' ||
                                  TO_CHAR(P_DT_FIM_PER_FERIAS, 'YYYY'),
                                  'DD/MM/YYYY'); /*Alt.1*/
      IF P_TIPO = 1 OR p_tipo = 3 THEN
        IF P_DT_SAIDA_PARC1 > v_limite_retorno THEN
          v_flg := 'N';
          v_msg := 'Funcionário com vínculo Estatutário. A data de saida não pode ultrapassar o ano letivo. Limite: "' ||
                   TO_CHAR(v_limite_saida /*Alt.1*/, 'DD/MM/YYYY') || '"!';
          --P_dt_saida_parc1 := null;
          RAISE saida;
        END IF;
      END IF;
    
      IF P_TIPO = 2 OR p_tipo = 3 THEN
        IF P_DT_RETORNO_PARC1 > v_limite_retorno THEN
          v_flg := 'N';
          v_msg := 'Funcionário com vínculo Estatutário. A data de retorno não pode ultrapassar o ano letivo. Limite: "' ||
                   TO_CHAR(v_limite_retorno, 'DD/MM/YYYY') || '"!';
          --P_dt_retorno_parc1 := null;
          RAISE saida;
        END IF;
      END IF;
    END IF;
  
    <<PULA>>
    NULL;
    pflg_retorno := 'S';
    pmsg_retorno := NULL;
  EXCEPTION
    WHEN saida THEN
      pflg_retorno := v_flg;
      pmsg_retorno := v_msg;
    
  END VALIDA_ESTATUTARIO;

  PROCEDURE CANCELA_REQ_CAD_FERIAS(psolicitacao requisicao_ferias.cod_solicitacao%TYPE,
                                   pusuario     VARCHAR2,
                                   pflg_retorno IN OUT VARCHAR2,
                                   pmsg_retorno IN OUT VARCHAR2) IS
    /*
    
    
    
    */
    -- Regras::;
    -- 1) Ao cancelar requisição, se existir requisição específica para uma parcela posterior, esta deve ser cancelada primeiro;
    -- 2) Não é possível cancelar requisição quando houver programação para períodos superiores;
    -- 3) Não é possível cancelar requisição com férias já gozadas (ferias.ind_situacao_periodo <> P);
    -- parâmetros de entrada:
    /*
      psolicitacao requisicao_ferias.cod_solicitacao%type;
      pflg_retorno varchar2(1) := 'S';
      pmsg_retorno varchar2(4000);
    */
    vsaida_erro EXCEPTION;
    --
    --    v_parcela number(1);
    --vexiste   VARCHAR2(1) := 'N';
    --
    CURSOR c_req IS
      SELECT *
        FROM requisicao_ferias rf
       WHERE cod_solicitacao = psolicitacao;
    req c_req%ROWTYPE;
    --
    /*
    CURSOR c_fer IS
      SELECT *
      FROM   ferias f
      WHERE  f.dt_inic_per_ferias = req.dt_inic_per_ferias
      AND    f.matricula          = req.matricula
      AND    f.cod_empresa        = req.cod_empresa;
    fer c_fer%ROWTYPE;
    */
    --
  BEGIN
    --
    pflg_retorno := 'S';
    Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(PSOLICITACAO,
                                                 'CANCELA_REQ',
                                                 'N',
                                                 'REQ_FERIAS');
    --
    OPEN c_req;
    FETCH c_req
      INTO req;
    IF c_req%NOTFOUND THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Requisição não encontrada. Favor verificar!';
      CLOSE c_req;
      RAISE vsaida_erro;
    ELSIF req.sit_requisicao in (1, 2) THEN
      --
      UPDATE FERIAS F
         SET COD_SOLICITACAO = NULL, DT_SOLICITACAO = NULL
       WHERE f.dt_inic_per_ferias = req.dt_inic_per_ferias
         AND f.matricula = req.matricula
         AND f.cod_empresa = req.cod_empresa;
      --
      update requisicao_ferias
         set sit_requisicao = 3,
             usuario        = substr(pusuario || '#CANCELA_REQ', 1, 30),
             observacao     = substr('Cancelamento de requisicao devido a acerto manual nas férias. ' ||
                                     NVL(observacao, ' '),
                                     1,
                                     3000),
             dt_atualizacao = sysdate
       where cod_solicitacao = req.cod_solicitacao;
      --
    ELSIF req.sit_requisicao = 3 THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Esta requisição já encontra-se cancelada!';
      RAISE vsaida_erro;
    ELSIF req.sit_requisicao = 4 THEN
      pflg_retorno := 'N';
      pmsg_retorno := 'Esta requisição já encontra-se reprovada!';
      RAISE vsaida_erro;
      /*ELSIF REQ.SIT_REQUISICAO = 2 AND NVL(PERMISSAO_CANC_REQ_CONCLUIDA(PSOLICITACAO, REQ.COD_EMPRESA, REQ.MATRICULA, pusuario),'N') = 'N' THEN -- Validação nova para cancelamento de req. CONCLUÍDA
      PFLG_RETORNO := 'N';
      PMSG_RETORNO := 'Cancelamento não permitido!';
      RAISE VSAIDA_ERRO;*/
    END IF;
    --
    CLOSE c_req;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      IF c_req%isopen THEN
        CLOSE c_req;
      END IF;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := SUBSTR('Erro ao cancelar requisição: ' || SQLERRM,
                             1,
                             4000);
      IF c_req%isopen THEN
        CLOSE c_req;
      END IF;
  END CANCELA_REQ_CAD_FERIAS;

  FUNCTION LIMPA_PARC1(P_ROWID         ROWID,
                       PDT_SAIDA_PARC1 FERIAS.DT_SAIDA_PARC1%TYPE)
    RETURN VARCHAR2 IS
    --pragma autonomous_transaction;
    --v_parcela number(1);
    v_processos   varchar2(400) := null; -- AIDA 04/07/2019
    vdt_ref_FOLHA parametros_recursos_humanos.dt_ref_ferias%type;
    v_atualizou   varchar2(1);
    CURSOR C3 IS
      SELECT COD_EMPRESA,
             DT_SAIDA_PARC1,
             DT_SAIDA_PARC2,
             DT_SAIDA_PARC4,
             matricula,
             DT_INIC_PER_FERIAS,
             IND_SITUACAO_PERIODO,
             DIAS_ABONO_PEC1 DESC_ADICIONAL1,
             OPCAO_13SAL1,
             cod_solicitacao
        FROM vw_f013303
       WHERE ROWID = P_ROWID;
    V_C3 C3%ROWTYPE;
  BEGIN
    open c3;
    fetch c3
      into v_c3;
    close c3;
  
    IF v_c3.DT_SAIDA_PARC1 = NVL(PDT_SAIDA_PARC1, v_c3.DT_SAIDA_PARC1) OR
       NVL(PDT_SAIDA_PARC1, v_c3.DT_SAIDA_PARC1) IS NULL THEN
      RETURN 'N';
    END IF;
  
    IF V_C3.DT_SAIDA_PARC2 IS NOT NULL THEN
      --RETURN 'Você deve limpar a 2ª parcela antes de limpar a 1ª!';
      raise_application_error(-20000,
                              'Você deve limpar a 2ª parcela antes de limpar a 1ª!');
    ELSIF V_C3.DT_SAIDA_PARC4 IS NOT NULL THEN
      --RETURN 'Você deve limpar a 3ª parcela antes de limpar a 1ª!';
      raise_application_error(-20000,
                              'Você deve limpar a 3ª parcela antes de limpar a 1ª!');
    END IF;
  
    -- raise_application_error(-20000,'entrei');
    begin
      --v_processos  := NULL;
      --begin
      SELECT X.DT_REF_FOLHA
        INTO VDT_REF_FOLHA
        FROM PARAMETROS_RECURSOS_HUMANOS X
       WHERE X.COD_EMPRESA = V_C3.COD_EMPRESA;
      /*exception
        when no_data_found then
          raise_application_error(-20000,'Data de referência da folha não encontrado.');
      end;*/
      v_processos := Pkg_Verif_Proc.F_F010332I(V_C3.cod_empresa,
                                               vdt_ref_FOLHA);
    
      if v_processos is not null then
        --RETURN'Processo de Cancelamento da Programação de Férias não permitido. Nesse momento há os seguintes processos de cálculo sendo executados => '||v_processos;
        raise_application_error(-20000,
                                'Processo de Cancelamento da Programação de Férias não permitido. Nesse momento há os seguintes processos de cálculo sendo executados => ' ||
                                v_processos);
      else
        insere_log_calculo(V_C3.cod_empresa,
                           'FERIA',
                           vdt_ref_FOLHA,
                           1,
                           0,
                           0,
                           null,
                           null,
                           V_C3.cod_empresa,
                           V_C3.cod_empresa,
                           null,
                           null,
                           null,
                           null,
                           sysdate,
                           sysdate,
                           V('APP_USER') || ' ' || 'FERIA',
                           sysdate);
        v_atualizou := 'S';
      end if;
      /*
            VERIFICA_REQUISICAO(v_parcela);
      
            if v_parcela = 1 then
              IF not CONFIRMA('Requisição', 'Férias programadas através da requisição de nº '||:ferias.cod_solicitacao||', deseja limpar?') then
                raise form_trigger_failure;
              end if;
      
            end if;
      */
    
      -- 14/08/2007
      --
      DECLARE
        vl_verificar number(1);
      BEGIN
        BEGIN
          SELECT 1
            INTO vl_verificar
            FROM ferias
           WHERE cod_empresa = V_C3.cod_empresa
             AND matricula = V_C3.matricula
             AND trunc(DT_INIC_PER_FERIAS) > V_C3.DT_INIC_PER_FERIAS
             AND (TRUNC(DT_SAIDA_PARC1) > V_C3.DT_SAIDA_PARC1 OR
                 TRUNC(DT_SAIDA_PARC2) > V_C3.DT_SAIDA_PARC1);
        EXCEPTION
          WHEN OTHERS THEN
            VL_VERIFICAR := 0;
        END;
      
        IF VL_VERIFICAR = 1 THEN
          --RETURN 'Funcionário com Programação em Periodos Superiores a  '||TO_CHAR(V_C3.DT_INIC_PER_FERIAS,'DD/MM/YYYY');
          raise_application_error(-20000,
                                  'Funcionário com Programação em Periodos Superiores a  ' ||
                                  TO_CHAR(V_C3.DT_INIC_PER_FERIAS,
                                          'DD/MM/YYYY'));
        ELSE
          IF V_C3.IND_SITUACAO_PERIODO <> 'P' THEN
            --RETURN 'Funcionário com Programação de Férias já gozadas!';
            raise_application_error(-20000,
                                    'Funcionário com Programação de Férias já gozadas!');
          ELSE
            /*
            UPDATE FERIAS
               SET DT_SAIDA_PARC1 = NULL,
                   NUM_DIAS_PARC1  = NULL,
                   DIAS_ABONO_PEC1 = NULL,
                   DESC_ADICIONAL1 = NULL,
                   OPCAO_13SAL1    = NULL,
                   DT_RETORNO_PARC1= NULL,
                   TIPO_FERIAS1    = NULL,
                   DT_PAGTO_PARC1  = NULL,
                   COD_SOLICITACAO = NULL
             WHERE ROWID = P_ROWID;
            */
            update REQUISICAO_FERIAS
               set sit_requisicao = '3',
                   dt_atualizacao = sysdate,
                   usuario        = usuario.BUSCA_USER,
                   observacao     = substr('Cancelamento de requisicao devido a acerto manual nas férias. ' ||
                                           NVL(observacao, ' '),
                                           1,
                                           3000)
             where cod_solicitacao = V_C3.cod_solicitacao;
            /*
            update ferias -- Se chegar a limpar a 1a parcela, limpar tb a opção férias para que o colaborador possa escolher uma nova opção de parcelamento de férias (Rodrigo/Patrícia)
               set opcao_ferias       = null
             where opcao_ferias       is not null
              and dt_inic_per_ferias = V_C3.dt_inic_per_ferias
              and matricula          = V_C3.matricula
              and cod_empresa        = V_C3.cod_empresa
              and V_C3.DT_SAIDA_PARC1 is null;
            */
            --V_C3.COD_SOLICITACAO  := NULL;
            --FERIAS.ind_limpa        := 'S';
          END IF;
        END IF;
      END;
    END;
  
    if v_atualizou = 'S' then
      begin
        update log_calculo
           set DT_FIM = sysdate, DT_ATUALIZACAO = sysdate
         where cod_empresa = V_C3.cod_empresa
           and cod_processo_pagto = 'FOLHA'
           and data_ref_proc = vdt_ref_FOLHA
           and dt_inicio = sysdate;
      
        --commit;
        RETURN 'S';
      end;
    end if;
  
    --commit;
    RETURN 'N';
  END LIMPA_PARC1;

  FUNCTION LIMPA_PARC2(P_ROWID         ROWID,
                       PDT_SAIDA_PARC2 FERIAS.DT_SAIDA_PARC2%TYPE)
    RETURN VARCHAR2 IS
    --pragma autonomous_transaction;
    vl_verificar number(1);
    --v_parcela number(1);
    v_processos   varchar2(400) := null; -- AIDA 04/07/2019
    vdt_ref_FOLHA parametros_recursos_humanos.dt_ref_ferias%type;
    v_atualizou   varchar2(1);
  
    CURSOR cf IS
      SELECT COD_EMPRESA,
             ind_situacao_periodo,
             ind_situacao_parc_2,
             matricula,
             DT_INIC_PER_FERIAS,
             DT_SAIDA_PARC2,
             dt_saida_parc1,
             cod_solicitacao,
             num_dias_parc1,
             DT_SAIDA_PARC4
        FROM FERIAS
       WHERE ROWID = P_ROWID;
    v_cf cf%ROWTYPE;
  
    CURSOR c0(p_empresa        number,
              p_matricula      number,
              p_codsolicitacao number) IS
      SELECT MAX(cod_solicitacao) cod_solicitacao
        FROM REQUISICAO_FERIAS
       WHERE cod_empresa = p_empresa
         AND matricula = p_matricula
         AND cod_solicitacao < p_codsolicitacao
         AND sit_requisicao = '3';
    v_c0 c0%ROWTYPE;
  
    cursor c0b(p_empresa number, p_matricula number, p_solicitacao number) is
      select dt_saida_parc1, NUM_DIAS_PARC1
        from requisicao_ferias
       where cod_empresa = p_empresa
         and matricula = p_matricula
         and cod_solicitacao = p_solicitacao;
    v_c0b c0b%ROWTYPE;
  
    /*CURSOR c1(p_solicitacao NUMBER) IS
      SELECT COUNT(*) tot_aprovados
        FROM APROVA_FERIAS
       WHERE cod_solicitacao = p_solicitacao
         AND status_aprov = 'A';
    v_c1 c1%ROWTYPE;*/
  
    /*CURSOR c2(p_solicitacao NUMBER) IS
      SELECT COUNT(*) tot_aprovadores
        FROM APROVA_FERIAS
       WHERE cod_solicitacao = p_solicitacao;
    v_c2 c2%ROWTYPE;*/
  
    /*CURSOR c3(p_solicitacao NUMBER) IS
      SELECT COUNT(*) tot_reprovado
        FROM APROVA_FERIAS
       WHERE cod_solicitacao = p_solicitacao
         AND status_aprov    = 'R';
    v_c3 c3%ROWTYPE;*/
    --v_sit_req VARCHAR2(1);
  BEGIN
    OPEN cf; -- solicitação
    FETCH cf
      INTO v_cf;
    CLOSE cf;
  
    IF v_cf.DT_SAIDA_PARC2 = NVL(PDT_SAIDA_PARC2, v_cf.DT_SAIDA_PARC2) OR
       NVL(PDT_SAIDA_PARC2, v_cf.DT_SAIDA_PARC2) IS NULL THEN
      RETURN 'N';
    END IF;
  
    IF V_cf.DT_SAIDA_PARC4 IS NOT NULL THEN
      --RETURN 'Você deve limpar a 3ª parcela antes de limpar a 2ª!';
      raise_application_error(-20000,
                              'Você deve limpar a 3ª parcela antes de limpar a 2ª!');
    END IF;
    --v_processos  := NULL;
  
    SELECT X.DT_REF_FOLHA
      INTO VDT_REF_FOLHA
      FROM PARAMETROS_RECURSOS_HUMANOS X
     WHERE X.COD_EMPRESA = v_cf.COD_EMPRESA;
  
    v_processos := Pkg_Verif_Proc.F_F010332I(v_cf.cod_empresa,
                                             vdt_ref_FOLHA);
  
    if v_processos is not null then
      --RETURN 'Processo de Cancelamento da Programação de Férias não permitido. Nesse momento há os seguintes processos de cálculo sendo executados => '||v_processos;
      raise_application_error(-20000,
                              'Processo de Cancelamento da Programação de Férias não permitido. Nesse momento há os seguintes processos de cálculo sendo executados => ' ||
                              v_processos);
    else
      insere_log_calculo(v_cf.COD_EMPRESA,
                         'FERIA',
                         vdt_ref_FOLHA,
                         1,
                         0,
                         0,
                         null,
                         null,
                         v_cf.COD_EMPRESA,
                         v_cf.COD_EMPRESA,
                         null,
                         null,
                         null,
                         null,
                         sysdate,
                         sysdate,
                         v('APP_USER') || ' ' || 'FERIA',
                         sysdate);
      v_atualizou := 'S';
    end if;
  
    -->> MSS 20181016 ch.14775 [Rodrigo]
    IF v_cf.ind_situacao_periodo = 'R' AND v_cf.ind_situacao_parc_2 = 'C' THEN
      --RETURN 'Férias já calculada para a parcela. Limpeza de dados não permitida!';
      raise_application_error(-20000,
                              'Férias já calculada para a parcela. Limpeza de dados não permitida!');
    END IF;
    --<<
  
    --VERIFICA_REQUISICAO(v_parcela);
  
    -- if v_parcela = 2 then
    --   if not CONFIRMA('Requisição', 'Férias programadas através da requisição de nº '||:ferias.cod_solicitacao||', deseja limpar?') then
    --      raise form_trigger_failure;
    --   end if;
    -- end if;
  
    BEGIN
      SELECT 1
        INTO vl_verificar
        FROM ferias
       WHERE cod_empresa = v_cf.cod_empresa
         AND matricula = v_cf.matricula
         AND trunc(DT_INIC_PER_FERIAS) > v_cf.DT_INIC_PER_FERIAS
         AND (TRUNC(DT_SAIDA_PARC1) > v_cf.DT_SAIDA_PARC2 OR
             TRUNC(DT_SAIDA_PARC2) > v_cf.DT_SAIDA_PARC2);
    EXCEPTION
      WHEN OTHERS THEN
        VL_VERIFICAR := 0;
    END;
  
    IF VL_VERIFICAR = 1 THEN
      --RETURN 'Funcionários com Programação em Periodos Superiores a  '||TO_CHAR(v_cf.DT_INIC_PER_FERIAS,'DD/MM/YYYY');
      raise_application_error(-20000,
                              'Funcionários com Programação em Periodos Superiores a  ' ||
                              TO_CHAR(v_cf.DT_INIC_PER_FERIAS, 'DD/MM/YYYY'));
    ELSE
      /*
      update ferias
         set DT_SAIDA_PARC2  = null,
             NUM_DIAS_PARC2   = null,
             DIAS_ABONO_PEC2  = null,
             OPCAO_13SAL2     = null,
             DT_RETORNO_PARC2 = null,
             TIPO_FERIAS2     = null,
             DT_RETORNO_COL2  = null,
             OPCAO_ABONO_PEC2 = null,
             DESC_ADICIONAL2  = null,
             DT_PAGTO_PARC2   = null
       where rowid = p_rowid;
      */
    
      -- :GLOBAL.LIMPA_PARC2      := 'S';
      update REQUISICAO_FERIAS
         set sit_requisicao = '3',
             dt_atualizacao = sysdate,
             usuario        = usuario.BUSCA_USER,
             observacao     = substr('Cancelamento de requisicao devido a acerto manual nas férias. ' ||
                                     NVL(observacao, ' '),
                                     1,
                                     3000)
       where cod_solicitacao = v_cf.cod_solicitacao;
      /*
      update ferias
         set COD_SOLICITACAO  = null
       where rowid = p_rowid;
       */
      OPEN c0(v_cf.cod_empresa, v_cf.matricula, v_cf.cod_solicitacao); -- solicitação
      FETCH c0
        INTO v_c0;
      CLOSE c0;
    
      OPEN c0b(v_cf.cod_empresa, v_cf.matricula, v_c0.cod_solicitacao); -- solicitação
      FETCH c0b
        INTO v_c0b;
      CLOSE c0b;
      /*
        
      if v_c0b.dt_saida_parc1 = v_cf.dt_saida_parc1 and
         v_c0b.num_dias_parc1 = v_cf.num_dias_parc1 then
        update ferias 
           set cod_solicitacao = v_c0.cod_solicitacao
         where rowid = p_rowid;
      else
        update ferias
           set cod_solicitacao = null
         where rowid = p_rowid;
      end if;
      */
    END IF;
  
    --VALIDA_PROG_PER_SUPERIOR;
    --VALIDA_P1_P2;
  
    if v_atualizou = 'S' then
      begin
        update log_calculo
           set DT_FIM = sysdate, DT_ATUALIZACAO = sysdate
         where cod_empresa = v_cf.cod_empresa
           and cod_processo_pagto = 'FOLHA'
           and data_ref_proc = vdt_ref_FOLHA
           and dt_inicio = sysdate;
        --v_atualizou := 'N';
      end;
    
      --commit;
      RETURN 'S';
    end if;
    --commit;
    RETURN 'N';
  END LIMPA_PARC2;

  FUNCTION LIMPA_PARC3(P_ROWID         ROWID,
                       PDT_SAIDA_PARC4 FERIAS.DT_SAIDA_PARC4%TYPE)
    RETURN VARCHAR2 IS
    --pragma autonomous_transaction;
    vl_verificar number(1);
    --v_parcela number(1);
    v_processos   varchar2(400) := null; -- AIDA 04/07/2019
    vdt_ref_FOLHA parametros_recursos_humanos.dt_ref_ferias%type;
    v_atualizou   varchar2(1);
  
    CURSOR cf IS
      SELECT COD_EMPRESA,
             ind_situacao_periodo,
             ind_situacao_parc_2,
             matricula,
             DT_INIC_PER_FERIAS,
             DT_SAIDA_PARC2,
             dt_saida_parc1,
             cod_solicitacao,
             num_dias_parc1,
             DT_SAIDA_PARC4
        FROM FERIAS
       WHERE ROWID = P_ROWID;
    v_cf cf%ROWTYPE;
  
    CURSOR c0(p_empresa        number,
              p_matricula      number,
              p_codsolicitacao number) IS
      SELECT MAX(cod_solicitacao) cod_solicitacao
        FROM REQUISICAO_FERIAS
       WHERE cod_empresa = p_empresa
         AND matricula = p_matricula
         AND cod_solicitacao < p_codsolicitacao
         AND sit_requisicao = '3';
    v_c0 c0%ROWTYPE;
  
    cursor c0b(p_empresa number, p_matricula number, p_solicitacao number) is
      select dt_saida_parc1, NUM_DIAS_PARC1
        from requisicao_ferias
       where cod_empresa = p_empresa
         and matricula = p_matricula
         and cod_solicitacao = p_solicitacao;
    v_c0b c0b%ROWTYPE;
  
    /*CURSOR c1(p_solicitacao NUMBER) IS
      SELECT COUNT(*)  tot_aprovados
        FROM APROVA_FERIAS
       WHERE cod_solicitacao = p_solicitacao
         AND status_aprov = 'A';
    v_c1 c1%ROWTYPE;*/
  
    /*CURSOR c2(p_solicitacao NUMBER) IS
      SELECT COUNT(*)  tot_aprovadores
        FROM APROVA_FERIAS
       WHERE cod_solicitacao = p_solicitacao;
    v_c2 c2%ROWTYPE;*/
  
    /*CURSOR c3(p_solicitacao NUMBER) IS
      SELECT COUNT(*)  tot_reprovado
        FROM APROVA_FERIAS
       WHERE cod_solicitacao = p_solicitacao
         AND status_aprov    = 'R';
    v_c3 c3%ROWTYPE;*/
  
    --v_sit_req VARCHAR2(1);
  BEGIN
    /*VERIFICA_REQUISICAO(v_parcela);
    
    if v_parcela = 3 then
      if not CONFIRMA('Requisição', 'Férias programadas através da requisição de nº '||:ferias.cod_solicitacao||', deseja limpar?') then
        raise form_trigger_failure;
      end if;
    end if;
    */
    OPEN cf; -- solicitação
    FETCH cf
      INTO v_cf;
    CLOSE cf;
  
    IF v_cf.DT_SAIDA_PARC4 = NVL(PDT_SAIDA_PARC4, v_cf.DT_SAIDA_PARC4) OR
       NVL(PDT_SAIDA_PARC4, v_cf.DT_SAIDA_PARC4) IS NULL THEN
      RETURN 'N';
    END IF;
  
    --v_processos  := NULL;
  
    SELECT X.DT_REF_FOLHA
      INTO VDT_REF_FOLHA
      FROM PARAMETROS_RECURSOS_HUMANOS X
     WHERE X.COD_EMPRESA = v_cf.COD_EMPRESA;
  
    v_processos := Pkg_Verif_Proc.F_F010332I(v_cf.cod_empresa,
                                             vdt_ref_FOLHA);
  
    if v_processos is not null then
      raise_application_error(-20000,
                              'Processo de Cancelamento da Programação de Férias não permitido. Nesse momento há os seguintes processos de cálculo sendo executados => ' ||
                              v_processos);
      --RETURN 'Processo de Cancelamento da Programação de Férias não permitido. Nesse momento há os seguintes processos de cálculo sendo executados => '||v_processos;
    else
      insere_log_calculo(v_cf.cod_empresa,
                         'FERIA',
                         vdt_ref_FOLHA,
                         1,
                         0,
                         0,
                         null,
                         null,
                         v_cf.cod_empresa,
                         v_cf.cod_empresa,
                         null,
                         null,
                         null,
                         null,
                         sysdate,
                         sysdate,
                         v('APP_USER') || ' ' || 'FERIA',
                         sysdate);
      v_atualizou := 'S';
    end if;
  
    BEGIN
      SELECT 1
        INTO vl_verificar
        FROM ferias
       WHERE cod_empresa = v_cf.cod_empresa
         AND matricula = v_cf.matricula
         AND trunc(DT_INIC_PER_FERIAS) > v_cf.DT_INIC_PER_FERIAS
         AND (TRUNC(DT_SAIDA_PARC2) > v_cf.DT_SAIDA_PARC4 OR
             TRUNC(DT_SAIDA_PARC4) > v_cf.DT_SAIDA_PARC4);
    EXCEPTION
      WHEN OTHERS THEN
        VL_VERIFICAR := 0;
    END;
  
    IF VL_VERIFICAR = 1 THEN
      raise_application_error(-20000,
                              'Funcionários com Programação em Periodos Superiores a  ' ||
                              TO_CHAR(v_cf.DT_INIC_PER_FERIAS, 'DD/MM/YYYY'));
      --RETURN 'Funcionários com Programação em Periodos Superiores a  '||TO_CHAR(v_cf.DT_INIC_PER_FERIAS,'DD/MM/YYYY');
    ELSE
      update REQUISICAO_FERIAS
         set sit_requisicao = '3',
             dt_atualizacao = sysdate,
             usuario        = usuario.BUSCA_USER,
             observacao     = substr('Cancelamento de requisicao devido a acerto manual nas férias. ' ||
                                     NVL(observacao, ' '),
                                     1,
                                     3000)
       where cod_solicitacao = v_cf.cod_solicitacao;
      /*
      update ferias
         SET COD_SOLICITACAO  = null
       where rowid = p_rowid;
      */
      OPEN c0(v_cf.cod_empresa, v_cf.matricula, v_cf.cod_solicitacao); -- solicitação
      FETCH c0
        INTO v_c0;
      CLOSE c0;
    
      OPEN c0b(v_cf.cod_empresa, v_cf.matricula, v_c0.cod_solicitacao); -- solicitação
      FETCH c0b
        INTO v_c0b;
      CLOSE c0b;
    
      /*
      if v_c0b.dt_saida_parc1 = v_cf.dt_saida_parc1 and 
         v_c0b.num_dias_parc1 = v_cf.num_dias_parc1 then
        update ferias
           set cod_solicitacao = v_c0.cod_solicitacao
          where rowid = p_rowid;
        null;
      else
        update ferias
           set cod_solicitacao = null
         where rowid = p_rowid;
      end if;
      */
    END IF;
  
    --VALIDA_PROG_PER_SUPERIOR_3;
    --VALIDA_P1_P2_P3;
  
    if v_atualizou = 'S' then
      begin
        update log_calculo
           set DT_FIM = sysdate, DT_ATUALIZACAO = sysdate
         where cod_empresa = v_cf.cod_empresa
           and cod_processo_pagto = 'FOLHA'
           and data_ref_proc = vdt_ref_FOLHA
           and dt_inicio = sysdate;
      
        --commit;
        RETURN 'S';
      end;
    end if;
    --commit;
    RETURN 'N';
  END LIMPA_PARC3;

  PROCEDURE PRC_LIMPA_FERIAS_PARC1(P_ROWID ROWID) IS
    --v_parcela number(1);
    v_processos   varchar2(400) := null; -- AIDA 04/07/2019
    vdt_ref_FOLHA parametros_recursos_humanos.dt_ref_ferias%type;
    v_atualizou   varchar2(1);
    CURSOR C3 IS
      SELECT COD_EMPRESA,
             DT_SAIDA_PARC1,
             DT_SAIDA_PARC2,
             DT_SAIDA_PARC4,
             matricula,
             DT_INIC_PER_FERIAS,
             IND_SITUACAO_PERIODO,
             DIAS_ABONO_PEC1 DESC_ADICIONAL1,
             OPCAO_13SAL1,
             cod_solicitacao
        FROM vw_f013303
       WHERE ROWID = P_ROWID;
  
    v_C3 C3%ROWTYPE;
  BEGIN
    debug('P_ROWID=' || P_ROWID);
    open c3;
    fetch c3
      into v_c3;
    close c3;
  
    -- raise_application_error(-20000,V_C3.COD_EMPRESA);
    IF V_C3.DT_SAIDA_PARC2 IS NOT NULL THEN
      raise_application_error(-20000,
                              'Você deve limpar a 2ª parcela antes de limpar a 1ª!');
    ELSIF V_C3.DT_SAIDA_PARC4 IS NOT NULL THEN
      raise_application_error(-20000,
                              'Você deve limpar a 3ª parcela antes de limpar a 1ª!');
    END IF;
    -- raise_application_error(-20000,'entrei');
    begin
      --v_processos  := NULL;
      --begin
      SELECT X.DT_REF_FOLHA
        INTO VDT_REF_FOLHA
        FROM PARAMETROS_RECURSOS_HUMANOS X
       WHERE X.COD_EMPRESA = V_C3.COD_EMPRESA;
      /*exception
        when no_data_found then
          raise_application_error(-20000,'Data de referência da folha não encontrado.');
      end;    */
      v_processos := Pkg_Verif_Proc.F_F010332I(V_C3.cod_empresa,
                                               vdt_ref_FOLHA);
    
      if v_processos is not null then
        raise_application_error(-20000,
                                'Processo de Cancelamento da Programação de Férias não permitido. Nesse momento há os seguintes processos de cálculo sendo executados => ' ||
                                v_processos);
        v_atualizou := 'N';
      
      else
      
        insere_log_calculo(V_C3.cod_empresa,
                           'FERIA',
                           vdt_ref_FOLHA,
                           1,
                           0,
                           0,
                           null,
                           null,
                           V_C3.cod_empresa,
                           V_C3.cod_empresa,
                           null,
                           null,
                           null,
                           null,
                           sysdate,
                           sysdate,
                           V('APP_USER') || ' ' || 'FERIA',
                           sysdate);
        v_atualizou := 'S';
      
      end if;
      /*
          VERIFICA_REQUISICAO(v_parcela);
      
          if v_parcela = 1 then
            IF not CONFIRMA('Requisição', 'Férias programadas através da requisição de nº '||:ferias.cod_solicitacao||', deseja limpar?') then
              raise form_trigger_failure;
            end if;
      
          end if;
      */
    
      -- 14/08/2007
      --
      DECLARE
        vl_verificar number(1);
      
      BEGIN
      
        BEGIN
          SELECT 1
            INTO vl_verificar
            FROM ferias
           WHERE cod_empresa = V_C3.cod_empresa
             AND matricula = V_C3.matricula
             AND trunc(DT_INIC_PER_FERIAS) > V_C3.DT_INIC_PER_FERIAS
             AND (TRUNC(DT_SAIDA_PARC1) > V_C3.DT_SAIDA_PARC1 OR
                 TRUNC(DT_SAIDA_PARC2) > V_C3.DT_SAIDA_PARC1);
        EXCEPTION
          WHEN OTHERS THEN
            VL_VERIFICAR := 0;
        END;
      
        IF VL_VERIFICAR = 1 THEN
          raise_application_error(-20000,
                                  'Funcionário com Programação em Periodos Superiores a  ' ||
                                  TO_CHAR(V_C3.DT_INIC_PER_FERIAS,
                                          'DD/MM/YYYY'));
        
        ELSE
          IF V_C3.IND_SITUACAO_PERIODO <> 'P' THEN
            raise_application_error(-20000,
                                    'Funcionário com Programação de Férias já gozadas!');
          ELSE
            UPDATE FERIAS
               SET DT_SAIDA_PARC1      = NULL,
                   NUM_DIAS_PARC1      = NULL,
                   DIAS_ABONO_PEC1     = NULL,
                   DESC_ADICIONAL1     = NULL,
                   OPCAO_13SAL1        = NULL,
                   DT_RETORNO_PARC1    = NULL,
                   TIPO_FERIAS1        = NULL,
                   DT_PAGTO_PARC1      = NULL,
                   COD_SOLICITACAO     = NULL,
                   USUARIO_PROG        = USUARIO.BUSCA_USER,
                   DT_ATUALIZACAO_PROG = SYSDATE
             WHERE ROWID = P_ROWID;
          
            update REQUISICAO_FERIAS
               set sit_requisicao = '3'
             where cod_solicitacao = V_C3.cod_solicitacao;
          
            update ferias -- Se chegar a limpar a 1a parcela, limpar tb a opção férias para que o colaborador possa escolher uma nova opção de parcelamento de férias (Rodrigo/Patrícia)
               set opcao_ferias = null
             where opcao_ferias is not null
               and dt_inic_per_ferias = V_C3.dt_inic_per_ferias
               and matricula = V_C3.matricula
               and cod_empresa = V_C3.cod_empresa
            --and    V_C3.DT_SAIDA_PARC1 is null
            ;
          
            V_C3.COD_SOLICITACAO := NULL;
            --FERIAS.ind_limpa        := 'S';
          
          END IF;
        END IF;
      END;
    
    END;
  
    if v_atualizou = 'S' then
    
      begin
      
        update log_calculo
           set DT_FIM = sysdate, DT_ATUALIZACAO = sysdate
         where cod_empresa = V_C3.cod_empresa
           and cod_processo_pagto = 'FOLHA'
           and data_ref_proc = vdt_ref_FOLHA
           and dt_inicio = sysdate;
        --v_atualizou := 'N';
      end;
    
    end if;
  
    commit;
  END;

  PROCEDURE PRC_LIMPA_FERIAS_PARC2(P_ROWID ROWID) IS
    vl_verificar number(1);
    --v_parcela number(1);
    v_processos   varchar2(400) := null; -- AIDA 04/07/2019
    vdt_ref_FOLHA parametros_recursos_humanos.dt_ref_ferias%type;
    v_atualizou   varchar2(1);
  
    CURSOR cf IS
      SELECT COD_EMPRESA,
             ind_situacao_periodo,
             ind_situacao_parc_2,
             matricula,
             DT_INIC_PER_FERIAS,
             DT_SAIDA_PARC2,
             dt_saida_parc1,
             cod_solicitacao,
             num_dias_parc1,
             DT_SAIDA_PARC4
        FROM FERIAS
       WHERE ROWID = P_ROWID;
    v_cf cf%ROWTYPE;
  
    CURSOR c0(p_empresa        number,
              p_matricula      number,
              p_codsolicitacao number) IS
      SELECT MAX(cod_solicitacao) cod_solicitacao
        FROM REQUISICAO_FERIAS
       WHERE cod_empresa = p_empresa
         AND matricula = p_matricula
         AND cod_solicitacao < p_codsolicitacao
         AND sit_requisicao = '3';
    v_c0 c0%ROWTYPE;
  
    cursor c0b(p_empresa number, p_matricula number, p_solicitacao number) is
      select dt_saida_parc1, NUM_DIAS_PARC1
        from requisicao_ferias
       where cod_empresa = p_empresa
         and matricula = p_matricula
         and cod_solicitacao = p_solicitacao;
    v_c0b c0b%ROWTYPE;
  
    /*CURSOR c1(p_solicitacao NUMBER) IS
      SELECT COUNT(*)  tot_aprovados
      FROM   APROVA_FERIAS
      WHERE  cod_solicitacao = p_solicitacao
      AND    status_aprov = 'A';
    v_c1 c1%ROWTYPE;*/
  
    /*CURSOR c2(p_solicitacao NUMBER) IS
      SELECT COUNT(*)  tot_aprovadores
      FROM   APROVA_FERIAS
      WHERE  cod_solicitacao = p_solicitacao;
    v_c2 c2%ROWTYPE;*/
  
    /*CURSOR c3(p_solicitacao NUMBER) IS
      SELECT COUNT(*)  tot_reprovado
      FROM   APROVA_FERIAS
      WHERE  cod_solicitacao = p_solicitacao
      AND    status_aprov    = 'R';
    v_c3 c3%ROWTYPE;*/
    --v_sit_req VARCHAR2(1);
  
  BEGIN
    OPEN cf; -- solicitação
    FETCH cf
      INTO v_cf;
    CLOSE cf;
  
    IF V_cf.DT_SAIDA_PARC4 IS NOT NULL THEN
      raise_application_error(-20000,
                              'Você deve limpar a 3ª parcela antes de limpar a 2ª!');
    END IF;
    --v_processos  := NULL;
  
    SELECT X.DT_REF_FOLHA
      INTO VDT_REF_FOLHA
      FROM PARAMETROS_RECURSOS_HUMANOS X
     WHERE X.COD_EMPRESA = v_cf.COD_EMPRESA;
  
    v_processos := Pkg_Verif_Proc.F_F010332I(v_cf.cod_empresa,
                                             vdt_ref_FOLHA);
  
    if v_processos is not null then
      raise_application_error(-20000,
                              'Processo de Cancelamento da Programação de Férias não permitido. Nesse momento há os seguintes processos de cálculo sendo executados => ' ||
                              v_processos);
      v_atualizou := 'N';
    else
      insere_log_calculo(v_cf.COD_EMPRESA,
                         'FERIA',
                         vdt_ref_FOLHA,
                         1,
                         0,
                         0,
                         null,
                         null,
                         v_cf.COD_EMPRESA,
                         v_cf.COD_EMPRESA,
                         null,
                         null,
                         null,
                         null,
                         sysdate,
                         sysdate,
                         v('APP_USER') || ' ' || 'FERIA',
                         sysdate);
      v_atualizou := 'S';
    end if;
  
    -->> MSS 20181016 ch.14775 [Rodrigo]
    IF v_cf.ind_situacao_periodo = 'R' AND v_cf.ind_situacao_parc_2 = 'C' THEN
      raise_application_error(-20000,
                              'Férias já calculada para a parcela. Limpeza de dados não permitida!');
    END IF;
    --<<
  
    --VERIFICA_REQUISICAO(v_parcela);
  
    -- if v_parcela = 2 then
    --   if not CONFIRMA('Requisição', 'Férias programadas através da requisição de nº '||:ferias.cod_solicitacao||', deseja limpar?') then
    --      raise form_trigger_failure;
    --   end if;
    -- end if;
  
    BEGIN
      SELECT 1
        INTO vl_verificar
        FROM ferias
       WHERE cod_empresa = v_cf.cod_empresa
         AND matricula = v_cf.matricula
         AND trunc(DT_INIC_PER_FERIAS) > v_cf.DT_INIC_PER_FERIAS
         AND (TRUNC(DT_SAIDA_PARC1) > v_cf.DT_SAIDA_PARC2 OR
             TRUNC(DT_SAIDA_PARC2) > v_cf.DT_SAIDA_PARC2);
    EXCEPTION
      WHEN OTHERS THEN
        VL_VERIFICAR := 0;
    END;
  
    IF VL_VERIFICAR = 1 THEN
      raise_application_error(-20000,
                              'Funcionários com Programação em Periodos Superiores a  ' ||
                              TO_CHAR(v_cf.DT_INIC_PER_FERIAS, 'DD/MM/YYYY'));
    ELSE
      update ferias
         set DT_SAIDA_PARC2       = null,
             NUM_DIAS_PARC2       = null,
             DIAS_ABONO_PEC2      = null,
             OPCAO_13SAL2         = null,
             DT_RETORNO_PARC2     = null,
             TIPO_FERIAS2         = null,
             DT_RETORNO_COL2      = null,
             OPCAO_ABONO_PEC2     = null,
             DESC_ADICIONAL2      = null,
             DT_PAGTO_PARC2       = null,
             USUARIO_PROG2        = USUARIO.BUSCA_USER,
             DT_ATUALIZACAO_PROG2 = SYSDATE
       where rowid = p_rowid;
    
      -- :GLOBAL.LIMPA_PARC2      := 'S';
    
      update REQUISICAO_FERIAS
         set sit_requisicao = '3'
       where cod_solicitacao = v_cf.cod_solicitacao;
    
      update ferias set COD_SOLICITACAO = null where rowid = p_rowid;
    
      OPEN c0(v_cf.cod_empresa, v_cf.matricula, v_cf.cod_solicitacao); -- solicitação
      FETCH c0
        INTO v_c0;
      CLOSE c0;
    
      OPEN c0b(v_cf.cod_empresa, v_cf.matricula, v_c0.cod_solicitacao); -- solicitação
      FETCH c0b
        INTO v_c0b;
      CLOSE c0b;
    
      if v_c0b.dt_saida_parc1 = v_cf.dt_saida_parc1 and
         v_c0b.num_dias_parc1 = v_cf.num_dias_parc1 then
        update ferias
           set cod_solicitacao = v_c0.cod_solicitacao
         where rowid = p_rowid;
      else
        update ferias set cod_solicitacao = null where rowid = p_rowid;
      end if;
    
    END IF;
  
    --VALIDA_PROG_PER_SUPERIOR;
    --VALIDA_P1_P2;
  
    if v_atualizou = 'S' then
      begin
        update log_calculo
           set DT_FIM = sysdate, DT_ATUALIZACAO = sysdate
         where cod_empresa = v_cf.cod_empresa
           and cod_processo_pagto = 'FOLHA'
           and data_ref_proc = vdt_ref_FOLHA
           and dt_inicio = sysdate;
        --v_atualizou := 'N';
      end;
    end if;
  
    commit;
  
  END;

  PROCEDURE PRC_LIMPA_FERIAS_PARC3(P_ROWID ROWID) IS
    vl_verificar number(1);
    --v_parcela number(1);
    v_processos   varchar2(400) := null; -- AIDA 04/07/2019
    vdt_ref_FOLHA parametros_recursos_humanos.dt_ref_ferias%type;
    v_atualizou   varchar2(1);
  
    CURSOR cf IS
      SELECT COD_EMPRESA,
             ind_situacao_periodo,
             ind_situacao_parc_2,
             matricula,
             DT_INIC_PER_FERIAS,
             DT_SAIDA_PARC2,
             dt_saida_parc1,
             cod_solicitacao,
             num_dias_parc1,
             DT_SAIDA_PARC4
        FROM FERIAS
       WHERE ROWID = P_ROWID;
    v_cf cf%ROWTYPE;
  
    CURSOR c0(p_empresa        number,
              p_matricula      number,
              p_codsolicitacao number) IS
      SELECT MAX(cod_solicitacao) cod_solicitacao
        FROM REQUISICAO_FERIAS
       WHERE cod_empresa = p_empresa
         AND matricula = p_matricula
         AND cod_solicitacao < p_codsolicitacao
         AND sit_requisicao = '3';
    v_c0 c0%ROWTYPE;
  
    cursor c0b(p_empresa number, p_matricula number, p_solicitacao number) is
      select dt_saida_parc1, NUM_DIAS_PARC1
        from requisicao_ferias
       where cod_empresa = p_empresa
         and matricula = p_matricula
         and cod_solicitacao = p_solicitacao;
    v_c0b c0b%ROWTYPE;
  
    /*CURSOR c1(p_solicitacao NUMBER) IS
      SELECT COUNT(*)  tot_aprovados
      FROM   APROVA_FERIAS
      WHERE  cod_solicitacao = p_solicitacao
      AND    status_aprov = 'A';
    v_c1 c1%ROWTYPE;*/
  
    /*CURSOR c2(p_solicitacao NUMBER) IS
      SELECT COUNT(*)  tot_aprovadores
      FROM   APROVA_FERIAS
      WHERE  cod_solicitacao = p_solicitacao;
    v_c2 c2%ROWTYPE;*/
  
    /*CURSOR c3(p_solicitacao NUMBER) IS
      SELECT COUNT(*)  tot_reprovado
      FROM   APROVA_FERIAS
      WHERE  cod_solicitacao = p_solicitacao
      AND    status_aprov    = 'R';
    v_c3 c3%ROWTYPE;*/
  
    --v_sit_req VARCHAR2(1);
  
  BEGIN
    /*VERIFICA_REQUISICAO(v_parcela);
    
     if v_parcela = 3 then
       if not CONFIRMA('Requisição', 'Férias programadas através da requisição de nº '||:ferias.cod_solicitacao||', deseja limpar?') then
          raise form_trigger_failure;
       end if;
     end if;
    */
    OPEN cf; -- solicitação
    FETCH cf
      INTO v_cf;
    CLOSE cf;
  
    --v_processos  := NULL;
  
    SELECT X.DT_REF_FOLHA
      INTO VDT_REF_FOLHA
      FROM PARAMETROS_RECURSOS_HUMANOS X
     WHERE X.COD_EMPRESA = v_cf.COD_EMPRESA;
  
    v_processos := Pkg_Verif_Proc.F_F010332I(v_cf.cod_empresa,
                                             vdt_ref_FOLHA);
  
    if v_processos is not null then
      raise_application_error(-20000,
                              'Processo de Cancelamento da Programação de Férias não permitido. Nesse momento há os seguintes processos de cálculo sendo executados => ' ||
                              v_processos);
      v_atualizou := 'N';
    else
      insere_log_calculo(v_cf.cod_empresa,
                         'FERIA',
                         vdt_ref_FOLHA,
                         1,
                         0,
                         0,
                         null,
                         null,
                         v_cf.cod_empresa,
                         v_cf.cod_empresa,
                         null,
                         null,
                         null,
                         null,
                         sysdate,
                         sysdate,
                         v('APP_USER') || ' ' || 'FERIA',
                         sysdate);
      v_atualizou := 'S';
    end if;
  
    BEGIN
      SELECT 1
        INTO vl_verificar
        FROM ferias
       WHERE cod_empresa = v_cf.cod_empresa
         AND matricula = v_cf.matricula
         AND trunc(DT_INIC_PER_FERIAS) > v_cf.DT_INIC_PER_FERIAS
         AND (TRUNC(DT_SAIDA_PARC2) > v_cf.DT_SAIDA_PARC4 OR
             TRUNC(DT_SAIDA_PARC4) > v_cf.DT_SAIDA_PARC4);
    EXCEPTION
      WHEN OTHERS THEN
        VL_VERIFICAR := 0;
    END;
  
    IF VL_VERIFICAR = 1 THEN
      raise_application_error(-20000,
                              'Funcionários com Programação em Periodos Superiores a  ' ||
                              TO_CHAR(v_cf.DT_INIC_PER_FERIAS, 'DD/MM/YYYY'));
    ELSE
      update ferias
         SET DT_SAIDA_PARC4       = null,
             NUM_DIAS_PARC4       = null,
             DIAS_ABONO_PEC4      = null,
             OPCAO_13SAL4         = null,
             DT_RETORNO_PARC4     = null,
             TIPO_FERIAS4         = null,
             DT_RETORNO_COL4      = null,
             OPCAO_ABONO_PEC4     = null,
             DESC_ADICIONAL4      = null,
             DT_PAGTO_PARC4       = null,
             USUARIO_PROG4        = USUARIO.BUSCA_USER,
             DT_ATUALIZACAO_PROG4 = SYSDATE
       where rowid = p_rowid;
    
      --:GLOBAL.LIMPA_PARC4      := 'S';
    
      update REQUISICAO_FERIAS
         set sit_requisicao = '3'
       where cod_solicitacao = v_cf.cod_solicitacao;
    
      update ferias SET COD_SOLICITACAO = null where rowid = p_rowid;
    
      OPEN c0(v_cf.cod_empresa, v_cf.matricula, v_cf.cod_solicitacao); -- solicitação
      FETCH c0
        INTO v_c0;
      CLOSE c0;
    
      OPEN c0b(v_cf.cod_empresa, v_cf.matricula, v_c0.cod_solicitacao); -- solicitação
      FETCH c0b
        INTO v_c0b;
      CLOSE c0b;
    
      if v_c0b.dt_saida_parc1 = v_cf.dt_saida_parc1 and
         v_c0b.num_dias_parc1 = v_cf.num_dias_parc1 then
        update ferias
           set cod_solicitacao = v_c0.cod_solicitacao
         where rowid = p_rowid;
      else
        update ferias set cod_solicitacao = null where rowid = p_rowid;
      end if;
    
    END IF;
  
    --VALIDA_PROG_PER_SUPERIOR_3;
    --VALIDA_P1_P2_P3;
  
    if v_atualizou = 'S' then
      begin
        update log_calculo
           set DT_FIM = sysdate, DT_ATUALIZACAO = sysdate
         where cod_empresa = v_cf.cod_empresa
           and cod_processo_pagto = 'FOLHA'
           and data_ref_proc = vdt_ref_FOLHA
           and dt_inicio = sysdate;
        --v_atualizou := 'N';
      end;
    end if;
    commit;
  END;

  FUNCTION VALIDA_SAVE_MSG(PCOD_EMPRESA          FERIAS.COD_EMPRESA%TYPE,
                           PMATRICULA            FERIAS.MATRICULA%TYPE,
                           PDT_INIC_PER_FERIAS   FERIAS.DT_INIC_PER_FERIAS%TYPE,
                           PDT_SAIDA_PARC1       FERIAS.DT_SAIDA_PARC1%TYPE,
                           PDT_SAIDA_PARC2       FERIAS.DT_SAIDA_PARC2%TYPE,
                           PDT_SAIDA_PARC4       FERIAS.DT_SAIDA_PARC4%TYPE,
                           PDT_RETORNO_PARC1     FERIAS.DT_RETORNO_PARC1%TYPE,
                           PDT_RETORNO_PARC2     FERIAS.DT_RETORNO_PARC2%TYPE,
                           PDT_RETORNO_PARC4     FERIAS.DT_RETORNO_PARC4%TYPE,
                           PNUM_DIAS_PARC1       FERIAS.NUM_DIAS_PARC1%TYPE,
                           PNUM_DIAS_PARC2       FERIAS.NUM_DIAS_PARC2%TYPE,
                           PNUM_DIAS_PARC4       FERIAS.NUM_DIAS_PARC4%TYPE,
                           PIND_SITUACAO_PERIODO FERIAS.IND_SITUACAO_PERIODO%TYPE,
                           PIND_SITUACAO_PARC_1  FERIAS.IND_SITUACAO_PARC_1%TYPE,
                           PIND_SITUACAO_PARC_2  FERIAS.IND_SITUACAO_PARC_2%TYPE,
                           PIND_SITUACAO_PARC_4  FERIAS.IND_SITUACAO_PARC_4%TYPE,
                           PDIAS_DIREITO         FERIAS.SALDO%TYPE,
                           PSALDO                FERIAS.SALDO%TYPE)
    RETURN VARCHAR2 IS
    vReturn            VARCHAR2(4000) DEFAULT NULL;
    vFlg               VARCHAR2(1);
    v_dt_validacao1    date;
    v_dt_validacao2    date;
    v_filial           NUMBER;
    V_INTERV           NUMBER;
    V_DT_SAIDA_PARC1   DATE;
    V_DT_SAIDA_PARC2   DATE;
    V_DT_SAIDA_PARC4   DATE;
    V_DT_RETORNO_PARC1 DATE;
    V_DT_RETORNO_PARC2 DATE;
    V_DT_RETORNO_PARC4 DATE;
    vmeses_prog_ini    FERIAS_PARAMETROS.MESES_PROG_INI%TYPE;
    function VERIF_REQ_DESLIGAMENTO(p_emp number, p_mat number)
      return varchar2 IS
      /*Procedure copiada do forms F013303, para realização da mesma validação no Apex*/
      /*Implementacao em atend. ao chamado 25323, PSMarconato/Sidnei, 21/10/2021*/
      VCOD_DESLIGAMENTO DESLIGAMENTO.COD_DESLIGAMENTO%TYPE;
    BEGIN
      SELECT COD_DESLIGAMENTO
        INTO VCOD_DESLIGAMENTO
        FROM DESLIGAMENTO
       WHERE COD_SIT_DESLIGAMENTO IN (1, 5)
         AND COD_EMPRESA = p_emp
         AND MAT_SOLICITADO = p_mat;
      --
      IF VCOD_DESLIGAMENTO IS NOT NULL THEN
        return 'Há requisição de desligamento em andamento. Não permitido!';
      END IF;
    
      return NULL;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        return NULL;
      WHEN OTHERS THEN
        return SUBSTR('Erro ao verificar existência de outras requisições para a matrícula ' ||
                      p_mat || ': ' || SQLERRM,
                      1,
                      4000);
    END;
  BEGIN
    select filial
      into v_filial
      from informacoes_funcionais
     where cod_empresa = PCOD_EMPRESA
       and matricula = PMATRICULA;
  
    SELECT INTERV_PROGR_FERIAS, MESES_PROG_INI
      INTO V_INTERV, vmeses_prog_ini
      FROM FERIAS_PARAMETROS
     WHERE COD_EMPRESA = PCOD_EMPRESA
       AND COD_FILIAL = v_filial;
  
    V_DT_VALIDACAO1 := PDT_RETORNO_PARC1 + NVL(V_INTERV, 0);
  
    V_DT_VALIDACAO2 := PDT_INIC_PER_FERIAS;
    V_DT_VALIDACAO2 := V_DT_VALIDACAO2 + NVL(V_INTERV, 730);
  
    V_DT_SAIDA_PARC1   := PDT_SAIDA_PARC1;
    V_DT_SAIDA_PARC2   := PDT_SAIDA_PARC2;
    V_DT_SAIDA_PARC4   := PDT_SAIDA_PARC4;
    V_DT_RETORNO_PARC1 := PDT_RETORNO_PARC1;
    V_DT_RETORNO_PARC2 := PDT_RETORNO_PARC2;
    V_DT_RETORNO_PARC4 := PDT_RETORNO_PARC4;
  
    Vld_Per_Meses(PCOD_EMPRESA,
                  PMATRICULA,
                  V_DT_SAIDA_PARC1,
                  PDT_INIC_PER_FERIAS,
                  VFLG,
                  vReturn);
  
    CASE
      WHEN PIND_SITUACAO_PERIODO = 'G' /*OR PIND_SITUACAO_PARC_1 = 'C' OR PIND_SITUACAO_PARC_2 = 'C' OR PIND_SITUACAO_PARC_4 = 'C'*/
       THEN
        vReturn := 'Férias não pode ser alterada.';
      
      WHEN V_DT_SAIDA_PARC1 IS NULL AND V_DT_SAIDA_PARC2 IS NULL AND
           V_DT_SAIDA_PARC4 IS NULL THEN
        vReturn := 'Nenhum período de férias definido.';
      
      WHEN PDT_SAIDA_PARC1 IS NOT NULL AND PDT_SAIDA_PARC1 <= SYSDATE AND
           PIND_SITUACAO_PARC_1 <> 'C' THEN
        vReturn := 'Data de saída da 1ª parcela inferior a data atual.';
      
      WHEN PDT_SAIDA_PARC2 IS NOT NULL AND PDT_SAIDA_PARC2 <= SYSDATE AND
           PIND_SITUACAO_PARC_2 <> 'C' THEN
        vReturn := 'Data de saída da 2ª parcela inferior a data atual.';
      
      WHEN PDT_SAIDA_PARC4 IS NOT NULL AND PDT_SAIDA_PARC4 <= SYSDATE AND
           PIND_SITUACAO_PARC_4 <> 'C' THEN
        vReturn := 'Data de saída da 3ª parcela inferior a data atual.';
      
      WHEN NVL(PNUM_DIAS_PARC1, 0) <= 0 AND
           (PDT_SAIDA_PARC1 IS NOT NULL OR PDT_RETORNO_PARC1 IS NOT NULL) THEN
        vReturn := 'Número de dias primeira parcela deve ser informado.';
      
      WHEN NVL(PNUM_DIAS_PARC2, 0) <= 0 AND
           (PDT_SAIDA_PARC2 IS NOT NULL OR PDT_RETORNO_PARC2 IS NOT NULL) THEN
        vReturn := 'Número de dias segunda parcela deve ser informado.';
      
      WHEN NVL(PNUM_DIAS_PARC4, 0) <= 0 AND
           (PDT_SAIDA_PARC4 IS NOT NULL OR PDT_RETORNO_PARC4 IS NOT NULL) THEN
        vReturn := 'Número de dias terceira parcela deve ser informado.';
        /*WHEN V_DT_RETORNO_PARC4 IS NOT NULL and V_DT_RETORNO_PARC4 > v_dt_validacao2 THEN
        vReturn := 'XX A data de retorno da terceira parcela não pode ser maior que a data de '||v_dt_validacao2 ||'.';*/
    
      WHEN V_DT_RETORNO_PARC4 IS NOT NULL and
           V_DT_RETORNO_PARC4 <=
           NVL(V_DT_RETORNO_PARC2, V_DT_RETORNO_PARC4) THEN
        vReturn := 'A data de retorno da terceira parcela não pode ser menor ou igual que a data de retorno da segunda parcela.';
      
      WHEN V_DT_RETORNO_PARC2 IS NOT NULL and
           V_DT_RETORNO_PARC2 <=
           NVL(V_DT_RETORNO_PARC1, V_DT_RETORNO_PARC2) THEN
        vReturn := 'A data de retorno da segunda parcela(' ||
                   V_DT_RETORNO_PARC2 ||
                   ') não pode ser menor ou igual que a data de retorno da primeira parcela(' ||
                   V_DT_RETORNO_PARC1 || ').';
        /*
            WHEN V_DT_RETORNO_PARC2 IS NOT NULL and V_DT_RETORNO_PARC2 <= NVL(V_DT_RETORNO_PARC1, V_DT_RETORNO_PARC2) THEN
              vReturn := 'A data de retorno da segunda parcela não pode ser menor ou igual que a data de retorno da primeira parcela.';
        */
      WHEN V_DT_SAIDA_PARC4 IS NOT NULL AND
           V_DT_SAIDA_PARC4 <= NVL(V_DT_SAIDA_PARC2, V_DT_SAIDA_PARC4) THEN
        vReturn := 'A data de Saída da terceira parcela não pode ser menor que a data de Saída da segunda parcela.';
      
      WHEN V_DT_SAIDA_PARC2 IS NOT NULL AND
           V_DT_SAIDA_PARC2 <= NVL(V_DT_SAIDA_PARC1, V_DT_SAIDA_PARC2) THEN
        vReturn := 'A data de Saída da segunda parcela(' ||
                   V_DT_SAIDA_PARC2 ||
                   ') não pode ser menor que a data de Saída da primeira parcela(' ||
                   V_DT_SAIDA_PARC1 || ').';
      
      WHEN V_DT_SAIDA_PARC2 < V_DT_VALIDACAO1 THEN
        vReturn := 'Necessário cumprir os ' || v_interv ||
                   ' dias de intervalo mínimo entre as parcelas da programação de férias.                             ' ||
                   'Data mínima para Saída: ' ||
                   TO_CHAR(V_DT_VALIDACAO1, 'DD/MM/RRRR');
      
      WHEN V_DT_SAIDA_PARC4 < V_DT_VALIDACAO2 THEN
        vReturn := 'Necessário cumprir os ' || v_interv ||
                   ' dias de intervalo mínimo entre as parcelas da programação de férias.                             ' ||
                   'Data mínima para Saída: ' ||
                   TO_CHAR(V_DT_VALIDACAO2, 'DD/MM/RRRR');
      
      WHEN PNUM_DIAS_PARC4 > 0 and
           NOT funcFeriasParamParcela_Apex(PCOD_EMPRESA,
                                           v_filial,
                                           PNUM_DIAS_PARC1,
                                           PNUM_DIAS_PARC2,
                                           PNUM_DIAS_PARC4) THEN
        vReturn := 'P4 - Quantidade de dias não encontrada na parametrização, favor alterar.';
      WHEN PNUM_DIAS_PARC2 > 0 and
           NOT funcFeriasParamParcela_Apex(PCOD_EMPRESA,
                                           v_filial,
                                           PNUM_DIAS_PARC1,
                                           PNUM_DIAS_PARC2,
                                           null) THEN
        vReturn := 'P2 - Quantidade de dias não encontrada na parametrização, favor alterar.';
      WHEN PNUM_DIAS_PARC1 > 0 and
           NOT funcFeriasParamParcela_Apex(PCOD_EMPRESA,
                                           v_filial,
                                           PNUM_DIAS_PARC1,
                                           null,
                                           null) THEN
        vReturn := 'P1 - Quantidade de dias não encontrada na parametrização, favor alterar.';
      
      WHEN VFLG = 'N' THEN
        NULL;
      ELSE
        vReturn := VERIF_REQ_DESLIGAMENTO(PCOD_EMPRESA, PMATRICULA);
    END CASE;
  
    RETURN(vReturn);
  END VALIDA_SAVE_MSG;

  --Bruno Sousa 20/10/2025
  FUNCTION VALIDA_SAVE_OBS(P_ROWID              ROWID,
                           PDESCONSIDERA_FALTAS FERIAS.DESCONSIDERA_FALTAS%TYPE,
                           --Parcela 1
                           PDT_SAIDA_PARC1   FERIAS.DT_SAIDA_PARC1%TYPE,
                           PNUM_DIAS_PARC1   FERIAS.NUM_DIAS_PARC1%TYPE,
                           PDIAS_ABONO_PEC1  FERIAS.DIAS_ABONO_PEC1%TYPE,
                           POPCAO_13SAL1     FERIAS.OPCAO_13SAL1%TYPE,
                           PDESC_ADICIONAL1  FERIAS.DESC_ADICIONAL1%TYPE,
                           PDT_RETORNO_PARC1 FERIAS.DT_RETORNO_PARC1%TYPE,
                           PDT_PAGTO_PARC1   FERIAS.DT_PAGTO_PARC1%TYPE,
                           PTIPO_FERIAS1     FERIAS.TIPO_FERIAS1%TYPE,
                           --Parcela 2
                           PDT_SAIDA_PARC2   FERIAS.DT_SAIDA_PARC2%TYPE,
                           PNUM_DIAS_PARC2   FERIAS.NUM_DIAS_PARC2%TYPE,
                           PDIAS_ABONO_PEC2  FERIAS.DIAS_ABONO_PEC2%TYPE,
                           POPCAO_13SAL2     FERIAS.OPCAO_13SAL2%TYPE,
                           PDESC_ADICIONAL2  FERIAS.DESC_ADICIONAL2%TYPE,
                           PDT_RETORNO_PARC2 FERIAS.DT_RETORNO_PARC2%TYPE,
                           PDT_PAGTO_PARC2   FERIAS.DT_PAGTO_PARC2%TYPE,
                           PTIPO_FERIAS2     FERIAS.TIPO_FERIAS2%TYPE,
                           --Parcela 3
                           PDT_SAIDA_PARC4   FERIAS.DT_SAIDA_PARC4%TYPE,
                           PNUM_DIAS_PARC4   FERIAS.NUM_DIAS_PARC4%TYPE,
                           PDIAS_ABONO_PEC4  FERIAS.DIAS_ABONO_PEC4%TYPE,
                           POPCAO_13SAL4     FERIAS.OPCAO_13SAL4%TYPE,
                           PDESC_ADICIONAL4  FERIAS.DESC_ADICIONAL4%TYPE,
                           PDT_RETORNO_PARC4 FERIAS.DT_RETORNO_PARC4%TYPE,
                           PDT_PAGTO_PARC4   FERIAS.DT_PAGTO_PARC4%TYPE,
                           PTIPO_FERIAS4     FERIAS.TIPO_FERIAS4%TYPE,
                           --Parcela Coletiva
                           PDT_SAIDA_PARC3   FERIAS.DT_SAIDA_PARC3%TYPE,
                           PNUM_DIAS_PARC3   FERIAS.NUM_DIAS_PARC3%TYPE,
                           PDT_RETORNO_PARC3 FERIAS.DT_RETORNO_PARC3%TYPE,
                           PTIPO_FERIAS3     FERIAS.TIPO_FERIAS3%TYPE
                           
                           ) RETURN VARCHAR2 IS
    vReturn VARCHAR2(4000) DEFAULT NULL;
    CURSOR C_FERIAS IS
      select DESCONSIDERA_FALTAS,
             DT_SAIDA_PARC1,
             NUM_DIAS_PARC1,
             DIAS_ABONO_PEC1,
             OPCAO_13SAL1,
             DESC_ADICIONAL1,
             DT_RETORNO_PARC1,
             DT_PAGTO_PARC1,
             TIPO_FERIAS1,
             DT_SAIDA_PARC2,
             NUM_DIAS_PARC2,
             DIAS_ABONO_PEC2,
             OPCAO_13SAL2,
             DESC_ADICIONAL2,
             DT_RETORNO_PARC2,
             DT_PAGTO_PARC2,
             TIPO_FERIAS2,
             DT_SAIDA_PARC4,
             NUM_DIAS_PARC4,
             DIAS_ABONO_PEC4,
             OPCAO_13SAL4,
             DESC_ADICIONAL4,
             DT_RETORNO_PARC4,
             DT_PAGTO_PARC4,
             TIPO_FERIAS4,
             DT_SAIDA_PARC3,
             NUM_DIAS_PARC3,
             DT_RETORNO_PARC3,
             TIPO_FERIAS3
        from FERIAS
       WHERE ROWID = P_ROWID;
  
    V_FERIAS C_FERIAS%ROWTYPE;
  BEGIN
    /*
        debug('Pkg_Ferias.VALIDA_SAVE_OBS(P_ROWID => '||P_ROWID||','||chr(13)||
    '                                       PDESCONSIDERA_FALTAS => '||PDESCONSIDERA_FALTAS||','||chr(13)||
    '                                        pdt_saida_parc1 => '||pdt_saida_parc1||','||chr(13)||
    '                                        pnum_dias_parc1 => '||pnum_dias_parc1||','||chr(13)||
    '                                        pdias_abono_pec1 => '||pdias_abono_pec1||','||chr(13)||
    '                                        popcao_13sal1 => '||popcao_13sal1||','||chr(13)||
    '                                        pdesc_adicional1 => '||pdesc_adicional1||','||chr(13)||
    '                                        pdt_retorno_parc1 => '||pdt_retorno_parc1||','||chr(13)||
    '                                        pdt_pagto_parc1 => '||pdt_pagto_parc1||','||chr(13)||
    '                                        ptipo_ferias1 => '||ptipo_ferias1||','||chr(13)||
    '                                        pdt_saida_parc2 => '||pdt_saida_parc2||','||chr(13)||
    '                                        pnum_dias_parc2 => '||pnum_dias_parc2||','||chr(13)||
    '                                        pdias_abono_pec2 => '||pdias_abono_pec2||','||chr(13)||
    '                                        popcao_13sal2 => '||popcao_13sal2||','||chr(13)||
    '                                        pdesc_adicional2 => '||pdesc_adicional2||','||chr(13)||
    '                                        pdt_retorno_parc2 => '||pdt_retorno_parc2||','||chr(13)||
    '                                        pdt_pagto_parc2 => '||pdt_pagto_parc2||','||chr(13)||
    '                                        ptipo_ferias2 => '||ptipo_ferias2||','||chr(13)||
    '                                        pdt_saida_parc4 => '||pdt_saida_parc4||','||chr(13)||
    '                                        pnum_dias_parc4 => '||pnum_dias_parc4||','||chr(13)||
    '                                        pdias_abono_pec4 => '||pdias_abono_pec4||','||chr(13)||
    '                                        popcao_13sal4 => '||popcao_13sal4||','||chr(13)||
    '                                        pdesc_adicional4 => '||pdesc_adicional4||','||chr(13)||
    '                                        pdt_retorno_parc4 => '||pdt_retorno_parc4||','||chr(13)||
    '                                        pdt_pagto_parc4 => '||pdt_pagto_parc4||','||chr(13)||
    '                                        ptipo_ferias4 => '||ptipo_ferias4||','||chr(13)||
    '                                        pdt_saida_parc3 => '||pdt_saida_parc3||','||chr(13)||
    '                                        pnum_dias_parc3 => '||pnum_dias_parc3||','||chr(13)||
    '                                        pdt_retorno_parc3 => '||pdt_retorno_parc3||','||chr(13)||
    '                                        PTIPO_FERIAS3 => '||PTIPO_FERIAS3||');');*/
    OPEN C_FERIAS;
    FETCH C_FERIAS
      INTO V_FERIAS;
    CLOSE C_FERIAS;
  
    CASE
      WHEN PDESCONSIDERA_FALTAS <> V_FERIAS.DESCONSIDERA_FALTAS AND
           PDESCONSIDERA_FALTAS <> 'N' THEN
        vReturn := 'Desconsidera faltas não pode ser alterada.';
        --Parcela 1
      WHEN PDT_SAIDA_PARC1 <> V_FERIAS.DT_SAIDA_PARC1 AND
           PDT_SAIDA_PARC1 IS NOT NULL THEN
        vReturn := 'Data de saida parcela 1 não pode ser alterada.';
      WHEN PNUM_DIAS_PARC1 <> V_FERIAS.NUM_DIAS_PARC1 AND
           PNUM_DIAS_PARC1 IS NOT NULL THEN
        vReturn := 'Número de dias parcela 1 não pode ser alterado.';
      WHEN PDIAS_ABONO_PEC1 <> V_FERIAS.DIAS_ABONO_PEC1 AND
           PDIAS_ABONO_PEC1 IS NOT NULL THEN
        vReturn := 'Dias Abono parcela 1 não pode ser alterado.';
      WHEN POPCAO_13SAL1 <> V_FERIAS.OPCAO_13SAL1 AND POPCAO_13SAL1 <> 'N' THEN
        vReturn := 'Opção 13º Salário parcela 1 não pode ser alterado.';
      WHEN PDESC_ADICIONAL1 <> V_FERIAS.DESC_ADICIONAL1 AND
           PDESC_ADICIONAL1 IS NOT NULL THEN
        vReturn := 'Desconto adicional parcela 1 não pode ser alterado.';
      WHEN PDT_RETORNO_PARC1 <> V_FERIAS.DT_RETORNO_PARC1 AND
           PDT_RETORNO_PARC1 IS NOT NULL THEN
        vReturn := 'Data de retorno parcela 1 não pode ser alterada.';
      WHEN PDT_PAGTO_PARC1 <> V_FERIAS.DT_PAGTO_PARC1 AND
           PDT_PAGTO_PARC1 IS NOT NULL THEN
        vReturn := 'Data de pagamento parcela 1 não pode ser alterada.';
      WHEN PTIPO_FERIAS1 <> V_FERIAS.TIPO_FERIAS1 AND PTIPO_FERIAS1 <> 'N' THEN
        vReturn := 'Tipo de férias parcela 1 não pode ser alterado.';
        --Parcela 2
      WHEN PDT_SAIDA_PARC2 <> V_FERIAS.DT_SAIDA_PARC2 AND
           PDT_SAIDA_PARC2 IS NOT NULL THEN
        vReturn := 'Data de saida parcela 2 não pode ser alterada.';
      WHEN PNUM_DIAS_PARC2 <> V_FERIAS.NUM_DIAS_PARC2 AND
           PNUM_DIAS_PARC2 IS NOT NULL THEN
        vReturn := 'Número de dias parcela 2 não pode ser alterado.';
      WHEN PDIAS_ABONO_PEC2 <> V_FERIAS.DIAS_ABONO_PEC2 AND
           PDIAS_ABONO_PEC2 IS NOT NULL THEN
        vReturn := 'Dias Abono parcela 2 não pode ser alterado.';
      WHEN POPCAO_13SAL2 <> V_FERIAS.OPCAO_13SAL2 AND POPCAO_13SAL2 <> 'N' THEN
        vReturn := 'Opção 13º Salário parcela 2 não pode ser alterado.';
      WHEN PDESC_ADICIONAL2 <> V_FERIAS.DESC_ADICIONAL2 AND
           PDESC_ADICIONAL2 IS NOT NULL THEN
        vReturn := 'Desconto adicional parcela 2 não pode ser alterado.';
      WHEN PDT_RETORNO_PARC2 <> V_FERIAS.DT_RETORNO_PARC2 AND
           PDT_RETORNO_PARC2 IS NOT NULL THEN
        vReturn := 'Data de retorno parcela 2 não pode ser alterada.';
      WHEN PDT_PAGTO_PARC2 <> V_FERIAS.DT_PAGTO_PARC2 AND
           PDT_PAGTO_PARC2 IS NOT NULL THEN
        vReturn := 'Data de pagamento parcela 2 não pode ser alterada.';
      WHEN PTIPO_FERIAS2 <> V_FERIAS.TIPO_FERIAS2 AND PTIPO_FERIAS2 <> 'N' THEN
        vReturn := 'Tipo de férias parcela 2 não pode ser alterado.';
        --Parcela 3
      WHEN PDT_SAIDA_PARC4 <> V_FERIAS.DT_SAIDA_PARC4 AND
           PDT_SAIDA_PARC4 IS NOT NULL THEN
        vReturn := 'Data de saida parcela 3 não pode ser alterada.';
      WHEN PNUM_DIAS_PARC4 <> V_FERIAS.NUM_DIAS_PARC4 AND
           PNUM_DIAS_PARC4 IS NOT NULL THEN
        vReturn := 'Número de dias parcela 3 não pode ser alterado.';
      WHEN PDIAS_ABONO_PEC4 <> V_FERIAS.DIAS_ABONO_PEC4 AND
           PDIAS_ABONO_PEC4 IS NOT NULL THEN
        vReturn := 'Dias Abono parcela 3 não pode ser alterado.';
      WHEN POPCAO_13SAL4 <> V_FERIAS.OPCAO_13SAL4 AND POPCAO_13SAL4 <> 'N' THEN
        vReturn := 'Opção 13º Salário parcela 3 não pode ser alterado.';
      WHEN PDESC_ADICIONAL4 <> V_FERIAS.DESC_ADICIONAL4 AND
           PDESC_ADICIONAL4 IS NOT NULL THEN
        vReturn := 'Desconto adicional parcela 3 não pode ser alterado.';
      WHEN PDT_RETORNO_PARC4 <> V_FERIAS.DT_RETORNO_PARC4 AND
           PDT_RETORNO_PARC4 IS NOT NULL THEN
        vReturn := 'Data de retorno parcela 3 não pode ser alterada.';
      WHEN PDT_PAGTO_PARC4 <> V_FERIAS.DT_PAGTO_PARC4 AND
           PDT_PAGTO_PARC4 IS NOT NULL THEN
        vReturn := 'Data de pagamento parcela 3 não pode ser alterada.';
      WHEN PTIPO_FERIAS4 <> V_FERIAS.TIPO_FERIAS4 AND
           PTIPO_FERIAS4 IS NOT NULL THEN
        vReturn := 'Tipo de férias parcela 3 não pode ser alterado.';
        --Parcela Coletiva
      WHEN PDT_SAIDA_PARC3 <> V_FERIAS.DT_SAIDA_PARC3 AND
           PDT_SAIDA_PARC3 IS NOT NULL THEN
        vReturn := 'Data de saida parcela coletiva não pode ser alterada.';
      WHEN PNUM_DIAS_PARC3 <> V_FERIAS.NUM_DIAS_PARC3 AND
           PNUM_DIAS_PARC3 IS NOT NULL THEN
        vReturn := 'Número de dias parcela coletiva não pode ser alterado.';
      WHEN PDT_RETORNO_PARC3 <> V_FERIAS.DT_RETORNO_PARC3 AND
           PDT_RETORNO_PARC3 IS NOT NULL THEN
        vReturn := 'Data de retorno parcela coletiva não pode ser alterada.';
      WHEN PTIPO_FERIAS3 <> V_FERIAS.TIPO_FERIAS3 AND
           PTIPO_FERIAS3 IS NOT NULL THEN
        vReturn := 'Tipo de férias parcela coletiva não pode ser alterado.';
      ELSE
        vReturn := null;
    END CASE;
  
    RETURN vReturn;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN 'Erro ao gravar a Observação. Erro:' || substr(sqlerrm,
                                                            1,
                                                            200);
  END VALIDA_SAVE_OBS;

  PROCEDURE ATUALIZA_SALDO(PCOD_EMPRESA        FERIAS.COD_EMPRESA%TYPE,
                           PMATRICULA          FERIAS.MATRICULA%TYPE,
                           PDT_INIC_PER_FERIAS FERIAS.DT_INIC_PER_FERIAS%TYPE,
                           PDT_FIM_PER_FERIAS  FERIAS.DT_FIM_PER_FERIAS%TYPE) IS
    CURSOR C0 IS
      SELECT A.MATRICULA
        FROM informacoes_funcionais_cad A, SINDICATOS B
       WHERE B.COD_EMPRESA = A.COD_EMPRESA
         AND B.COD = A.NUM_SIND_DISS
         AND A.COD_EMPRESA = PCOD_EMPRESA
         AND A.MATRICULA = PMATRICULA
         AND B.DIAS_PER_AQUIS > 0
         AND B.DIAS_FER > 0
            --
         AND EXISTS (SELECT TEXTO -- Humberto/Rodrigo 20/05/2022 
                FROM CAMPO_DE_CADASTRO
               WHERE EMPRESA = a.cod_empresa
                 AND CHAVE_DE_TABELA = a.matricula
                 AND TABELA = 'INF-FUNCIONAIS'
                 AND CAMPO = 'ACAO_JUDICIAL'
                 AND ROWNUM = 1
                 AND texto = 'S');
    V_C0 C0%ROWTYPE;
    --
    cursor C1 is
      select a.dt_ref_folha
        from parametros_recursos_humanos a
       where a.cod_empresa = PCOD_EMPRESA;
    v_C1 C1%rowtype;
    --
    CURSOR C2 IS
      SELECT SUM(A.DIAS_FALTAS) SOMA
        FROM FERIAS_DIAS_FALTAS A
       WHERE A.COD_EMPRESA = PCOD_EMPRESA
         AND A.MATRICULA = PMATRICULA
         AND A.DT_INIC_PER_FERIAS = PDT_INIC_PER_FERIAS
         AND A.DT_FIM_PER_FERIAS = PDT_FIM_PER_FERIAS
         AND A.OPERADOR = '+';
    V_C2 C2%ROWTYPE;
  
    CURSOR C3 IS
      SELECT SUM(A.DIAS_FALTAS) SUBTRAI
        FROM FERIAS_DIAS_FALTAS A
       WHERE A.COD_EMPRESA = PCOD_EMPRESA
         AND A.MATRICULA = PMATRICULA
         AND A.DT_INIC_PER_FERIAS = PDT_INIC_PER_FERIAS
         AND A.DT_FIM_PER_FERIAS = PDT_FIM_PER_FERIAS
         AND A.OPERADOR = '-';
    V_C3 C3%ROWTYPE;
  
    CURSOR C4 IS
      SELECT FALTA_HORA,
             FALTA_HORA_ORIG,
             IND_SITUACAO_PERIODO,
             SALDO_BRUTO,
             SALDO,
             IND_SITUACAO_PARC_1,
             IND_SITUACAO_PARC_2,
             NUM_DIAS_PARC2,
             NUM_DIAS_PARC3,
             DIAS_ABONO_PEC2
        FROM FERIAS
       WHERE COD_EMPRESA = PCOD_EMPRESA
         AND MATRICULA = PMATRICULA
         AND DT_INIC_PER_FERIAS = PDT_INIC_PER_FERIAS
         AND DT_FIM_PER_FERIAS = PDT_FIM_PER_FERIAS;
    V_C4 C4%ROWTYPE;
    --
    CURSOR C5(P_EMP NUMBER, P_MAT NUMBER) IS
      SELECT TEXTO ACAO_JUDICIAL
        FROM CAMPO_DE_CADASTRO
       WHERE EMPRESA = P_EMP
         AND CHAVE_DE_TABELA = P_MAT
         AND TABELA = 'INF-FUNCIONAIS'
         AND CAMPO = 'ACAO_JUDICIAL'
         AND ROWNUM = 1;
    V_C5 C5%ROWTYPE;
  
    --V_SALDO_ORIG           FERIAS.SALDO%TYPE := 0; --BUSCAR SALDO NA TABELA DE FERIAS:FERIAS.SALDO;
    V_SALDO             FERIAS.SALDO%TYPE;
    V_SALDO_BRUTO       FERIAS.SALDO_BRUTO%TYPE;
    V_PERC_SALDO        NUMBER := 0;
    v_FALTA_HORA        FERIAS.FALTA_HORA%TYPE;
    V_DIAS_DIREITO      FERIAS.FALTA_HORA%TYPE;
    V_FALTA_HORA_ORIG   FERIAS.FALTA_HORA_ORIG%TYPE;
    V_DT_FIM_PER_FERIAS FERIAS.DT_FIM_PER_FERIAS%TYPE;
    --V_IND_SITUACAO_PERIODO FERIAS.IND_SITUACAO_PERIODO%TYPE;
    --V_IND_SITUACAO_PARC_1  FERIAS.IND_SITUACAO_PARC_1%TYPE;
    --V_IND_SITUACAO_PARC_2  FERIAS.IND_SITUACAO_PARC_2%TYPE;
    --V_NUM_DIAS_PARC2       FERIAS.NUM_DIAS_PARC2%TYPE;
    --V_NUM_DIAS_PARC3       FERIAS.NUM_DIAS_PARC3%TYPE;
    --V_DIAS_ABONO_PEC2      FERIAS.DIAS_ABONO_PEC2%TYPE;
    V_JORNADA_REDUZIDA REG_TRABALHO.JORNADA_REDUZIDA%TYPE;
  
    PROCEDURE DIAS_DIREITO(p_perc_saldo in out number) IS
      CURSOR C0 IS -- Humberto/Rodrigo 20/07/2022
        SELECT A.COD_EMPRESA,
               A.MATRICULA,
               A.DC_MATRICULA,
               B.DIAS_PER_AQUIS,
               B.DIAS_FER,
               A.DT_ADMISSAO
          FROM informacoes_funcionais_cad A, SINDICATOS B
         WHERE B.COD_EMPRESA = A.COD_EMPRESA
           AND B.COD = A.NUM_SIND_DISS
           AND B.DIAS_PER_AQUIS > 0
           AND B.DIAS_FER > 0
              --AND    DT_REFERENCIA_ >= TRUNC(A.DT_ADMISSAO,'MM')
           AND A.COD_EMPRESA = PCOD_EMPRESA
           AND A.MATRICULA = PMATRICULA;
      V_C0 C0%ROWTYPE;
      --
      CURSOR C1(P_EMP NUMBER, P_MAT NUMBER) IS
        SELECT TEXTO ACAO_JUDICIAL
          FROM CAMPO_DE_CADASTRO
         WHERE EMPRESA = P_EMP
           AND CHAVE_DE_TABELA = P_MAT
           AND TABELA = 'INF-FUNCIONAIS'
           AND CAMPO = 'ACAO_JUDICIAL'
           AND ROWNUM = 1;
      V_C1 C1%ROWTYPE;
      --
    BEGIN
      OPEN C0;
      FETCH C0
        INTO V_C0;
      CLOSE C0;
    
      -- Humberto/Rodrigo 17/05/2022 -----------------------------
      OPEN C1(PCOD_EMPRESA, PMATRICULA);
      FETCH C1
        INTO V_C1;
      CLOSE C1;
      v_c1.acao_judicial := nvl(v_c1.acao_judicial, 'N');
      ------------------------------------------------------------
      IF V_C0.MATRICULA IS NOT NULL THEN
        -- RADIOLOGISTA
        IF V_C1.ACAO_JUDICIAL = 'N' THEN
          IF V_FALTA_HORA <= 7 THEN
            -- 1 ATÉ 7
            v_dias_direito := 40;
            p_perc_saldo   := 3.33;
          ELSIF V_FALTA_HORA >= 8 AND V_FALTA_HORA <= 16 THEN
            v_dias_direito := 34;
            p_perc_saldo   := 2.83;
          ELSIF V_FALTA_HORA >= 17 AND V_FALTA_HORA <= 25 THEN
            V_dias_direito := 28;
            p_perc_saldo   := 2.33;
          ELSIF V_FALTA_HORA >= 26 AND V_FALTA_HORA <= 34 THEN
            v_dias_direito := 22;
            p_perc_saldo   := 1.83;
          ELSIF V_FALTA_HORA >= 35 THEN
            v_dias_direito := 0;
            p_perc_saldo   := 0;
          END IF;
        ELSIF V_C1.ACAO_JUDICIAL = 'S' THEN
          -- HUMBERTO/RODRIGO 20/07/2022
          V_DIAS_DIREITO := 20;
          P_PERC_SALDO   := 4;
        END IF;
        -------------------------------------------------------------------------------------------------------
      ELSIF V_C0.MATRICULA IS NULL THEN
        IF V_C1.ACAO_JUDICIAL = 'N' THEN
          IF V_FALTA_HORA <= 5 THEN
            V_dias_direito := 30;
            p_perc_saldo   := 2.5;
          ELSIF V_FALTA_HORA >= 6 AND V_FALTA_HORA <= 14 THEN
            V_dias_direito := 24;
            p_perc_saldo   := 2;
          ELSIF V_FALTA_HORA >= 15 AND V_FALTA_HORA <= 23 THEN
            V_dias_direito := 18;
            p_perc_saldo   := 1.5;
          ELSIF V_FALTA_HORA >= 24 AND V_FALTA_HORA <= 32 THEN
            v_dias_direito := 12;
            p_perc_saldo   := 1;
          ELSIF V_FALTA_HORA > 32 THEN
            V_dias_direito := 0;
            p_perc_saldo   := 0;
          END IF;
        ELSIF V_C1.ACAO_JUDICIAL = 'S' THEN
          IF V_FALTA_HORA <= 7 THEN
            v_dias_direito := 40;
            p_perc_saldo   := 3.3333;
          ELSIF V_FALTA_HORA >= 8 AND V_FALTA_HORA <= 16 THEN
            V_dias_direito := 34;
            p_perc_saldo   := 2.8333;
          ELSIF V_FALTA_HORA >= 17 AND V_FALTA_HORA <= 25 THEN
            V_dias_direito := 28;
            p_perc_saldo   := 2.3333;
          ELSIF V_FALTA_HORA >= 26 AND V_FALTA_HORA <= 34 THEN
            v_dias_direito := 22;
            p_perc_saldo   := 1.8333;
          ELSIF V_FALTA_HORA >= 35 THEN
            V_dias_direito := 0;
            p_perc_saldo   := 0;
          END IF;
        END IF;
      END IF; -- IF V_C0.MATRICULA IS NULL
    END;
  BEGIN
  
    select DISTINCT r.jornada_reduzida
      into v_jornada_reduzida
      from informacoes_funcionais_cad inf,
           inf_pessoais_cad           ip,
           reg_trabalho               r
     where inf.cod_empresa = pcod_empresa
       and ip.cod_empresa = inf.cod_empresa
       and inf.matricula = pmatricula
       and ip.matricula = inf.matricula
       and r.cod_empresa = inf.cod_empresa
       and r.cod = inf.reg_trab;
  
    open C0;
    fetch C0
      into v_C0;
    close C0;
    --
    open C1;
    fetch C1
      into v_C1;
    close C1;
    --
    OPEN C4;
    FETCH C4
      INTO V_C4;
    CLOSE C4;
    -- 
    -- Humberto/Rodrigo 17/05/2022 -----------------------------
    OPEN C5(pCOD_EMPRESA, pMATRICULA);
    FETCH C5
      INTO V_C5;
    CLOSE C5;
    v_C5.acao_judicial := nvl(v_C5.acao_judicial, 'N');
  
    ------------------------------------------------------------
  
    IF V_C4.IND_SITUACAO_PERIODO in ('P', 'R') /*AND V_C4.SALDO_BRUTO = 30*/
     THEN
      -- Comentado por Matheus/Rodrigo - 02/09/2019
      --
      OPEN C2;
      FETCH C2
        INTO V_C2;
      CLOSE C2;
      --
      OPEN C3;
      FETCH C3
        INTO V_C3;
      CLOSE C3;
      --
      v_FALTA_HORA      := v_dias_direito; --V_C4.FALTA_HORA;
      V_FALTA_HORA_ORIG := V_C4.FALTA_HORA_ORIG;
      --
      V_FALTA_HORA := NVL(v_FALTA_HORA_ORIG, 0) + NVL(V_C2.SOMA, 0);
      V_FALTA_HORA := V_FALTA_HORA - NVL(V_C3.SUBTRAI, 0);
      --
      --
      IF V_C0.MATRICULA IS NOT NULL THEN
        -- Humberto/Rodrigo 20/05/2022
        V_DT_FIM_PER_FERIAS := (PDT_INIC_PER_FERIAS + 159) +
                               NVL(V_C2.SOMA, 0) - NVL(V_C3.SUBTRAI, 0);
      
        UPDATE FERIAS_CAD
           SET DT_FIM_PER_FERIAS = V_DT_FIM_PER_FERIAS
         WHERE COD_EMPRESA = PCOD_EMPRESA
           AND MATRICULA = PMATRICULA
           AND DT_INIC_PER_FERIAS = PDT_INIC_PER_FERIAS
           AND DT_FIM_PER_FERIAS = PDT_FIM_PER_FERIAS;
      
        --FORMS_DDL('COMMIT');
        COMMIT;
      
        goto pula;
      end if;
      --
      -->> Adicionado por Matheus/Rodrigo - 02/09/2019
    
      DIAS_DIREITO(v_perc_saldo);
    
      v_saldo := ROUND(MONTHS_BETWEEN(LAST_DAY(v_C1.dt_ref_folha),
                                      TRUNC(PDT_INIC_PER_FERIAS, 'MM')));
    
      --
      IF ROUND(MONTHS_BETWEEN(LAST_DAY(v_C1.dt_ref_folha),
                              TRUNC(PDT_INIC_PER_FERIAS, 'MM'))) > 12 THEN
        v_saldo := 12;
      END IF;
    
      v_saldo       := v_saldo * v_perc_saldo;
      v_saldo_bruto := v_saldo;
      --
      IF (TO_NUMBER(TO_CHAR(LAST_DAY(PDT_INIC_PER_FERIAS), 'DD')) -
         TO_NUMBER(TO_CHAR(PDT_INIC_PER_FERIAS, 'DD'))) + 1 < 15 AND
         PDT_FIM_PER_FERIAS > LAST_DAY(v_C1.dt_ref_folha) THEN
        v_saldo       := v_saldo - v_perc_saldo;
        v_saldo_bruto := v_saldo;
      END IF;
      --<< Adicionado por Matheus/Rodrigo - 02/09/2019
    
      -->> MSS 20181017 [Rodrigo]
      /*if :ferias.ind_situacao_periodo = 'R' then
        :ferias.saldo := :ferias.saldo - nvl(:NUM_DIAS_PARC2,0); -- Humberto/Izidoro 02/06/2016: acrescentado - num_dias_parC2
      end if;   
      
      if :ferias.saldo < 0 then  -- Humberto/Izidoro 02/06/2016: acrescentad
         :ferias.saldo := 0;
      end if;*/
      --
      IF V_C4.IND_SITUACAO_PERIODO = 'R' THEN
        IF V_C4.IND_SITUACAO_PARC_1 = 'C' THEN
          V_SALDO       := V_SALDO - (NVL(V_C4.NUM_DIAS_PARC2, 0) +
                           V_C4.DIAS_ABONO_PEC2);
          V_SALDO_BRUTO := V_SALDO;
        END IF;
        --
        IF V_C4.IND_SITUACAO_PARC_2 = 'C' THEN
          V_SALDO       := V_SALDO - NVL(V_C4.NUM_DIAS_PARC3, 0);
          V_SALDO_BRUTO := V_SALDO;
        END IF;
      END IF;
      --<<
      <<pula>> -- Humberto/Rodrigo 20/05/2022
      --
      IF V_C0.MATRICULA IS NOT NULL THEN
        UPDATE FERIAS_CAD
           SET FALTA_HORA      = V_FALTA_HORA,
               FALTA_HORA_ORIG = V_FALTA_HORA_ORIG
         WHERE COD_EMPRESA = PCOD_EMPRESA
           AND MATRICULA = PMATRICULA
           AND DT_INIC_PER_FERIAS = PDT_INIC_PER_FERIAS
           AND DT_FIM_PER_FERIAS = PDT_FIM_PER_FERIAS;
      ELSE
        UPDATE FERIAS_CAD
           SET SALDO           = V_SALDO,
               SALDO_BRUTO     = V_SALDO_BRUTO,
               FALTA_HORA      = V_FALTA_HORA,
               FALTA_HORA_ORIG = V_FALTA_HORA_ORIG
         WHERE COD_EMPRESA = PCOD_EMPRESA
           AND MATRICULA = PMATRICULA
           AND DT_INIC_PER_FERIAS = PDT_INIC_PER_FERIAS
           AND DT_FIM_PER_FERIAS = PDT_FIM_PER_FERIAS;
      END IF;
      --
      --FORMS_DDL('COMMIT');
      COMMIT;
    END IF;
    --
    /*
    if NVL(v_jornada_reduzida,'N') = 'N' then
      IF V_C5.ACAO_JUDICIAL = 'S' THEN
        v_dias_direito := (40 - nvl(trim(v_saldo_bruto),0)) + (nvl(trim(v_saldo),0)); -- Humberto/Izidoro 29/09/2014
      ELSE    
        v_dias_direito := (30 - nvl(trim(v_saldo_bruto),0)) + (nvl(trim(v_saldo),0)); -- Humberto/Izidoro 29/09/2014
      END IF; 
    else
      v_dias_direito := (18 - nvl(trim(v_saldo_bruto),0)) + (nvl(trim(v_saldo),0)); -- Humberto/Izidoro 29/09/2014
    end if;  
    v_dias_direito := f_jornada_reduzida(pcod_empresa, pmatricula, v_dias_direito,null); -- Rodrigo (Chamado 9869)
    */
  END ATUALIZA_SALDO;

  --Bruno Sousa 03/01/2024
  FUNCTION FNC_VINCULO_CLF(pcod_empresa in number, pmatricula in number)
    return varchar2 is
    CURSOR cclf IS
      SELECT a.vinculo
        FROM INFORMACOES_FUNCIONAIS a, vinculo_empreg b
       WHERE a.cod_empresa = vcod_empresa
         AND a.matricula = vmatricula
         AND a.vinculo = b.cod
         AND trim(b.nome) = 'CLF';
    v_clf cclf%ROWTYPE;
    --
  begin
    if (vcod_empresa = pcod_empresa and vcod_empresa is not null) and
       (vmatricula = pmatricula and vmatricula is not null) then
      return vvinculo;
    end if;
    --
    vcod_empresa  := pcod_empresa;
    vmatricula    := pmatricula;
    v_clf.vinculo := NULL;
    OPEN cclf;
    FETCH cclf
      INTO v_clf;
    CLOSE cclf;
    --
    vvinculo := nvl(v_clf.vinculo, '*');
    return vvinculo;
  end FNC_VINCULO_CLF;

  --Bruno Sousa 09/04/2024
  FUNCTION FNC_VINCULO_NOME(pcod_empresa in number, pmatricula in number)
    return varchar2 is
    CURSOR cvinc IS
      SELECT UPPER(F_TIRA_ACENTOS(B.NOME)) NOME
        FROM INFORMACOES_FUNCIONAIS a, vinculo_empreg b
       WHERE a.cod_empresa = pcod_empresa
         AND a.matricula = pmatricula
         AND a.vinculo = b.cod;
    v_vinc cvinc%ROWTYPE;
    --
  begin
  
    OPEN cvinc;
    FETCH cvinc
      INTO v_vinc;
    CLOSE cvinc;
    --
  
    return v_vinc.nome;
  exception
    when others then
      return null;
  end FNC_VINCULO_NOME;

  --Bruno Sousa 27/09/2024
  PROCEDURE LIMPA_REQUISICAO(psolicitacao    requisicao_ferias.cod_solicitacao%TYPE,
                             pdt_saida_parc1 ferias.dt_saida_parc1%type,
                             pdt_saida_parc2 ferias.dt_saida_parc2%type,
                             pdt_saida_parc4 ferias.dt_saida_parc4%type,
                             pusuario        VARCHAR2,
                             pflg_retorno    IN OUT VARCHAR2,
                             pmsg_retorno    IN OUT VARCHAR2) IS
    --
    CURSOR c_req IS
      SELECT *
        FROM requisicao_ferias rf
       WHERE cod_solicitacao = psolicitacao;
    req c_req%ROWTYPE;
    --
  BEGIN
    --
    pflg_retorno := 'S';
    --
    OPEN c_req;
    FETCH c_req
      INTO req;
    IF c_req%NOTFOUND THEN
      UPDATE FERIAS F
         SET COD_SOLICITACAO = NULL, DT_SOLICITACAO = NULL
       WHERE f.dt_inic_per_ferias = req.dt_inic_per_ferias
         AND f.matricula = req.matricula
         AND f.cod_empresa = req.cod_empresa;
      CLOSE c_req;
      RAISE vsaida_erro;
    END IF;
  
    IF (pdt_saida_parc1 IS NOT NULL AND REQ.DT_SAIDA_PARC1 IS NOT NULL AND
       REQ.DT_SAIDA_PARC1 <> pdt_saida_parc1) OR
       (pdt_saida_parc2 IS NOT NULL AND REQ.DT_SAIDA_PARC2 IS NOT NULL AND
       REQ.DT_SAIDA_PARC2 <> pdt_saida_parc2) OR
       (pdt_saida_parc4 IS NOT NULL AND REQ.DT_SAIDA_PARC4 IS NOT NULL AND
       REQ.DT_SAIDA_PARC4 <> pdt_saida_parc4) THEN
      UPDATE FERIAS F
         SET COD_SOLICITACAO = NULL, DT_SOLICITACAO = NULL
       WHERE f.dt_inic_per_ferias = req.dt_inic_per_ferias
         AND f.matricula = req.matricula
         AND f.cod_empresa = req.cod_empresa;
    END IF;
  
    IF req.sit_requisicao in (1, 2) THEN
      --
      Pkg_Requisicao_Diversos.GRAVA_LOG_REQUISICAO(PSOLICITACAO,
                                                   'CANCELA_REQ',
                                                   'N',
                                                   'REQ_FERIAS');
    
      UPDATE FERIAS F
         SET COD_SOLICITACAO = NULL, DT_SOLICITACAO = NULL
       WHERE f.dt_inic_per_ferias = req.dt_inic_per_ferias
         AND f.matricula = req.matricula
         AND f.cod_empresa = req.cod_empresa;
      --
      update requisicao_ferias
         set sit_requisicao = 3,
             usuario        = substr(pusuario || '#CANCELA_REQ', 1, 30),
             observacao     = substr('Cancelamento de requisicao devido a acerto manual nas férias. ' ||
                                     NVL(observacao, ' '),
                                     1,
                                     3000),
             dt_atualizacao = sysdate
       where cod_solicitacao = req.cod_solicitacao;
      --
    END IF;
    --
    CLOSE c_req;
    --
  EXCEPTION
    WHEN vsaida_erro THEN
      IF c_req%isopen THEN
        CLOSE c_req;
      END IF;
    WHEN OTHERS THEN
      pflg_retorno := 'N';
      pmsg_retorno := SUBSTR('Erro ao cancelar requisição: ' || SQLERRM,
                             1,
                             4000);
      IF c_req%isopen THEN
        CLOSE c_req;
      END IF;
  END LIMPA_REQUISICAO;
end pkg_ferias;
/