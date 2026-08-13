-- Create table
create table NATCORP.FILIAIS
(
  cod_empresa                   NUMBER(3) not null,
  cod_filial                    NUMBER(4) not null,
  dc_filial                     NUMBER(1) not null,
  nome_filial                   VARCHAR2(30) not null,
  sigla                         VARCHAR2(30) not null,
  cgc                           NUMBER(14) not null,
  dc_cgc                        NUMBER(2) not null,
  ativ_iapas                    NUMBER(7) not null,
  endereco                      VARCHAR2(50) not null,
  bairro                        VARCHAR2(80) not null,
  cidade                        VARCHAR2(80) not null,
  uf                            VARCHAR2(2) not null,
  cep                           NUMBER(5) not null,
  telefone1                     NUMBER(10) not null,
  telefone2                     NUMBER(10),
  ddd                           VARCHAR2(4),
  fax                           NUMBER(11),
  cx_postal                     NUMBER(7),
  telex                         NUMBER(9),
  ender_telegrafo               VARCHAR2(12),
  pis_pasep_bco                 NUMBER(3),
  pis_pasep_ag                  NUMBER(4),
  pis_pasep_ps                  VARCHAR2(4),
  fgts_bco                      NUMBER(3),
  fgts_ps                       VARCHAR2(4),
  fgts_ag                       NUMBER(4),
  dt_cadastro                   DATE not null,
  sit                           VARCHAR2(1),
  usuario                       VARCHAR2(30),
  dt_atualizacao                DATE,
  complemento_cep               NUMBER(3) not null,
  dia_recolh_fgts               NUMBER(2),
  mes_contr_sindical            NUMBER(2),
  ind_sesi                      VARCHAR2(1),
  ind_senai                     VARCHAR2(1),
  ind_salario_educacao          VARCHAR2(1),
  num_sesi                      VARCHAR2(8),
  ind_termo_cooperacao          VARCHAR2(1),
  horario_entrada               VARCHAR2(4),
  horario_saida                 VARCHAR2(4),
  banco_conta                   NUMBER(3),
  agencia_conta                 NUMBER(4),
  conta_corrente                NUMBER(5),
  dc_corrente                   VARCHAR2(2),
  cod_fpas                      NUMBER(5),
  cod_sat                       NUMBER(10),
  perc_inss_emp                 NUMBER(7,4) not null,
  perc_sat                      NUMBER(7,4) not null,
  perc_incra                    NUMBER(7,4) not null,
  perc_sebrae                   NUMBER(7,4) not null,
  perc_senai                    NUMBER(7,4) not null,
  perc_sesi                     NUMBER(7,4) not null,
  perc_sal_educacao             NUMBER(7,4) not null,
  perc_retencao_senai           NUMBER(7,4) not null,
  perc_convenio_sesi            NUMBER(7,4) not null,
  perc_cont_adic_senai          NUMBER(7,4) not null,
  limite_dias_adto              NUMBER(2),
  calc_adiant1                  VARCHAR2(1) not null,
  calc_adiant2                  VARCHAR2(1) not null,
  calc_he1                      VARCHAR2(1) not null,
  calc_he2                      VARCHAR2(1) not null,
  calc_adic1                    VARCHAR2(1),
  calc_adic2                    VARCHAR2(1),
  calc_fgts1                    VARCHAR2(1),
  calc_fgts2                    VARCHAR2(1),
  calc_ir1                      VARCHAR2(1),
  calc_ir2                      VARCHAR2(1),
  calc_pensao_alim1             VARCHAR2(1),
  calc_pensao_alim2             VARCHAR2(1),
  perc_calculo1                 NUMBER(7,4),
  perc_calculo2                 NUMBER(7,4),
  recebe_complem1               VARCHAR2(1) not null,
  recebe_complem2               VARCHAR2(1) not null,
  calc_iapas1                   VARCHAR2(1) not null,
  calc_iapas2                   VARCHAR2(1) not null,
  resp_rh_filial                VARCHAR2(70),
  inscr_estadual                NUMBER(15),
  inscr_municipal               NUMBER(16),
  inscr_estadual_dv             VARCHAR2(1),
  avos_proporc                  VARCHAR2(1) default '3' not null,
  ind_arredonda                 CHAR(1),
  cod_remag                     NUMBER(13),
  gr_inss_emp                   VARCHAR2(1) not null,
  gr_sat                        VARCHAR2(1) not null,
  gr_incra                      VARCHAR2(1) not null,
  gr_sebrae                     VARCHAR2(1) not null,
  gr_senai                      VARCHAR2(1) not null,
  gr_sesi                       VARCHAR2(1) not null,
  gr_sal_educacao               VARCHAR2(1) not null,
  gr_retencao_senai             VARCHAR2(1) not null,
  gr_convenio_sesi              VARCHAR2(1),
  gr_cont_adic_senai            VARCHAR2(1) not null,
  unificado                     VARCHAR2(1) not null,
  cgc_unif                      NUMBER(12),
  dc_cgc_unif                   NUMBER(2),
  calc_proporcional             VARCHAR2(1),
  perc_adiantamento             NUMBER(5,2),
  base_adiantamento             NUMBER(2),
  media_horas_dsr               VARCHAR2(1) default 'S',
  numero                        NUMBER(5),
  complem                       VARCHAR2(15),
  integ_adic_ponto              CHAR(1) default 'S',
  e_mail                        VARCHAR2(100),
  estab_resp                    NUMBER(4),
  encer_ativ                    VARCHAR2(1) default 'N',
  prim_declara                  VARCHAR2(1) default 'N',
  mudanca_ender                 VARCHAR2(1) default 'N',
  centro_custo_alfanum          VARCHAR2(3),
  unidade_adm                   NUMBER(10),
  cod_terceiros                 VARCHAR2(4),
  cod_municipio_rais            NUMBER(7),
  cod_terceiros_pdet            VARCHAR2(4),
  cod_fpas_pdet                 NUMBER(5),
  perc_inss_emp_pdet            NUMBER(7,4) not null,
  perc_sat_pdet                 NUMBER(7,4) not null,
  perc_incra_pdet               NUMBER(7,4) not null,
  perc_sebrae_pdet              NUMBER(7,4) not null,
  perc_senai_pdet               NUMBER(7,4) not null,
  perc_sesi_pdet                NUMBER(7,4) not null,
  perc_sal_educacao_pdet        NUMBER(7,4) not null,
  perc_retencao_senai_pdet      NUMBER(7,4) not null,
  perc_convenio_sesi_pdet       NUMBER(7,4) not null,
  perc_cont_adic_senai_pdet     NUMBER(7,4) not null,
  gr_inss_emp_pdet              VARCHAR2(1) not null,
  gr_sat_pdet                   VARCHAR2(1) not null,
  gr_incra_pdet                 VARCHAR2(1) not null,
  gr_sebrae_pdet                VARCHAR2(1) not null,
  gr_senai_pdet                 VARCHAR2(1) not null,
  gr_sesi_pdet                  VARCHAR2(1) not null,
  gr_sal_educacao_pdet          VARCHAR2(1) not null,
  gr_retencao_senai_pdet        VARCHAR2(1) not null,
  gr_convenio_sesi_pdet         VARCHAR2(1) not null,
  gr_cont_adic_senai_pdet       VARCHAR2(1) not null,
  cod_companhia                 NUMBER(3),
  perc_fgts                     NUMBER(7,4) not null,
  perc_fgts_pdet                NUMBER(7,4) not null,
  cod_sindicato                 NUMBER(3) not null,
  conv_inss                     VARCHAR2(1),
  entra_grfc                    VARCHAR2(1),
  cs_fgts_mes                   NUMBER(7,4),
  cs_fgts_saldo                 NUMBER(7,4),
  parc_saldo_13sal1             VARCHAR2(1),
  demonstra_diferenca           VARCHAR2(1),
  gera_pagto_insuf_saldo        VARCHAR2(1) not null,
  entra_rais                    VARCHAR2(1),
  ir_mes_caixa                  VARCHAR2(1),
  perc_pis                      NUMBER(7,4),
  perc_pis_pdet                 NUMBER(7,4),
  calc_adiant_admt              VARCHAR2(1) default 'N' not null,
  calc_adiant_ferias            VARCHAR2(1) default 'N' not null,
  pagto_abono_ferias            VARCHAR2(1) default 'N' not null,
  qtde_dias_mes_13              NUMBER(2),
  mes_inic_media                NUMBER(2),
  mes_fim_media                 NUMBER(2),
  ativ_economica                NUMBER(7),
  valor_beneficio               NUMBER(6,2),
  desjejum                      NUMBER(6,2),
  limite_afastamento            NUMBER(2),
  contr_limite_afasts           VARCHAR2(1),
  cei                           NUMBER(14),
  rais_ind_centralizadora       NUMBER(1),
  fap                           NUMBER(7,4),
  rais_considera_he             VARCHAR2(2) default 'SN' not null,
  rais_considera_remun          VARCHAR2(2) default 'SN' not null,
  reg_junta_coml                NUMBER(10),
  nome_filial_caged             VARCHAR2(30),
  perc_acrescimo_constitucional NUMBER(7,4),
  perc_taxa_serv                NUMBER(7,4) default 0 not null,
  perc_taxa_entrega             NUMBER(7,4) default 0 not null,
  perc_taxa_adm_recarga         NUMBER(7,4) default 0 not null,
  perc_taxa_repasse_sptrans     NUMBER(7,4) default 0 not null,
  participa_pat                 NUMBER(1) default 2 not null,
  vinc_ate_5                    NUMBER(6),
  vinc_acima_5                  NUMBER(6),
  servico_proprio               NUMBER(3),
  adm_cozinha                   NUMBER(3),
  refeicao_convenio             NUMBER(3),
  refeicao_transportada         NUMBER(3),
  cesta_alimento                NUMBER(3),
  alimentacao_convenio          NUMBER(3),
  dt_pag_plr_ini                DATE,
  dt_pag_plr_fin                DATE,
  saldo_fer_min                 NUMBER(2) default 30 not null,
  vlr_garantia_minima           NUMBER(17,2),
  qtde_sal_minimo               NUMBER(3),
  ocorr_premio_ferias           NUMBER(3),
  tipo_sist_ctrl_ponto          VARCHAR2(2),
  ocorr_gar_min                 NUMBER(3),
  cod_tipo_inscr_es             NUMBER(3) default 1 not null,
  desc_plr_folha                NUMBER(3),
  desc_plr                      NUMBER(3),
  ind_sit_especial              NUMBER(1) default 0 not null,
  socio_ostensivo               VARCHAR2(1) default 'N' not null,
  cod_tipo_lotacao              NUMBER(3) default 1 not null,
  dt_encerramento               DATE,
  perc_rat                      NUMBER(1) default 0 not null,
  num_processo_rat              VARCHAR2(20),
  num_processo_fap              VARCHAR2(20),
  tipo_estab_resp               VARCHAR2(1) default 'E' not null,
  dt_vigencia_inicial           DATE not null,
  dt_vigencia_final             DATE,
  ocorr_media_neg               NUMBER(3),
  ocorr_media_neg_compl         NUMBER(3),
  contapr                       NUMBER(1) default 0 not null,
  nrprocjud_infoapr             VARCHAR2(20),
  contented_infoapr             VARCHAR2(1),
  contpcd                       VARCHAR2(1),
  nrprocjud_infopcd             VARCHAR2(20),
  cod_gera_esocial              NUMBER default '0',
  encargos_sociais              NUMBER(4,2),
  perc_inss_emp_desoneracao     NUMBER(7,4),
  indsubstpatrobra              NUMBER(1),
  liq_plr_folha                 NUMBER(3),
  perc_inss_13_desoneracao      NUMBER(7,4),
  estab_resp_sefip              NUMBER(4),
  contr_vinculo_adiant          VARCHAR2(30),
  ocorr_base_plr_folha          NUMBER(3),
  ocorr_irrf_plr_folha          NUMBER(3),
  ocorr_plr_folha               NUMBER(3),
  cod_gera_esocial_s1020        NUMBER default 0,
  dt_desoneracao                DATE,
  dt_desoneracao_13             DATE,
  avos_maternidade              NUMBER(1) default 1 not null,
  ocorr_pensao_plr_folha        NUMBER(4),
  fev_ult_dia                   VARCHAR2(1) default 'N' not null,
  cpf_resp_rh_filial            NUMBER(11)
)
tablespace TSPACE_NATCORP
  pctfree 10
  initrans 1
  maxtrans 255
  storage
  (
    initial 256K
    next 1M
    minextents 1
    maxextents unlimited
  );
-- Add comments to the columns 
comment on column NATCORP.FILIAIS.cod_empresa
  is 'Empresa - Código da empresa.';
comment on column NATCORP.FILIAIS.cod_filial
  is 'Filial - Campo de Preenchimento Automático. E possível ver o código das Filiais relacionadas com a empresa.';
comment on column NATCORP.FILIAIS.nome_filial
  is 'Nome da Filial - Campo de Preenchimento Automático. E possível ver o nome das Filiais relacionadas com a Empresa.';
comment on column NATCORP.FILIAIS.sigla
  is 'Sigla - Sigla da filial.';
comment on column NATCORP.FILIAIS.cgc
  is 'campo muda conforme o codigo acima escolhido - Número da inscrição.';
comment on column NATCORP.FILIAIS.ativ_iapas
  is 'Ativ. Econ. - Código da atividade econômica da filial.';
comment on column NATCORP.FILIAIS.endereco
  is 'Endereço - Endereço da filial (nome rua, avenida e etc.).';
comment on column NATCORP.FILIAIS.bairro
  is 'Bairro - Bairro da filial.';
comment on column NATCORP.FILIAIS.cidade
  is 'Cidade - Cidade onde fica da filial.';
comment on column NATCORP.FILIAIS.uf
  is 'UF - Unidade Federativa da Filial.';
comment on column NATCORP.FILIAIS.cep
  is 'CEP - Código de endereçamento postal (CEP).';
comment on column NATCORP.FILIAIS.telefone1
  is '(DDD)Tel.1o. - Tel. 2o. - Número do telefone.';
comment on column NATCORP.FILIAIS.telefone2
  is '(DDD)Tel.1o. - Tel. 2o. - Número do telefone.';
comment on column NATCORP.FILIAIS.ddd
  is '(DDD)Tel.1o. - Tel. 2o. - Código de discagem direta a distância (DDD).';
comment on column NATCORP.FILIAIS.fax
  is 'FAX - Número do fax.';
comment on column NATCORP.FILIAIS.cx_postal
  is 'Caixa postal.';
comment on column NATCORP.FILIAIS.pis_pasep_bco
  is 'PIS PASEP - Banco - Código do banco para pagamento do PIS/PASEP dos colaboradores.';
comment on column NATCORP.FILIAIS.pis_pasep_ag
  is 'PIS PASEP - Agencia - Código da agência para pagamento do PIS/PASEP dos colaboradores.';
comment on column NATCORP.FILIAIS.pis_pasep_ps
  is 'Número - Número do posto de serviço do PIS/PASEP.';
comment on column NATCORP.FILIAIS.fgts_bco
  is 'FGTS Banco - Código do banco do FGTS.';
comment on column NATCORP.FILIAIS.fgts_ps
  is 'P.S. - Código do posto de serviço do FGTS.';
comment on column NATCORP.FILIAIS.fgts_ag
  is 'Agencia - Código da agência do FGTS.';
comment on column NATCORP.FILIAIS.dt_cadastro
  is 'Data Cadastro - Data de cadastro na junta comercial.';
comment on column NATCORP.FILIAIS.sit
  is 'Situação - Situação da filial.';
comment on column NATCORP.FILIAIS.dia_recolh_fgts
  is 'Dia Recolh - Data do recolhimento do FGTS.';
comment on column NATCORP.FILIAIS.mes_contr_sindical
  is 'Mês Contrib. Sindical - Mês que deverá ser efetuado o desconto da Contribuição Sindical.';
comment on column NATCORP.FILIAIS.horario_entrada
  is 'Entrada - Horário de entrada de funcionamento da filial.';
comment on column NATCORP.FILIAIS.horario_saida
  is 'Saída - Horário de saída de funcionamento da filial.';
comment on column NATCORP.FILIAIS.cod_fpas
  is 'F.P.A.S. - Código do fundo de previdência social desta filial.';
comment on column NATCORP.FILIAIS.cod_sat
  is 'Seg Acid. Trab - Código do seguro de acidente de trabalho (SAT).';
comment on column NATCORP.FILIAIS.perc_inss_emp
  is 'INSS - Percentual do INSS da filial.';
comment on column NATCORP.FILIAIS.perc_sat
  is 'RAT Ajustada - Percentual da RAT ajustada da filial.';
comment on column NATCORP.FILIAIS.perc_incra
  is 'INCRA - Percentual do INCRA da filial.';
comment on column NATCORP.FILIAIS.perc_sebrae
  is 'SEBRAE - Percentual do SEBRAE da filial.';
comment on column NATCORP.FILIAIS.perc_senai
  is 'SENAI/SENAC - Percentual do SENAI/SENAC da filial.';
comment on column NATCORP.FILIAIS.perc_sesi
  is 'SESI/SESC - Percentual do SESI/SESC da filial.';
comment on column NATCORP.FILIAIS.perc_sal_educacao
  is 'Sal. Educação - Percentual do salário educação da filial.';
comment on column NATCORP.FILIAIS.perc_retencao_senai
  is 'Reten. SENAI/SENAC - Percentual da retenção do SENAI/SENAC da filial.';
comment on column NATCORP.FILIAIS.perc_convenio_sesi
  is 'Conv. SESI/SESC - Percentual do convenio do SESI/SESC da filial.';
comment on column NATCORP.FILIAIS.perc_cont_adic_senai
  is 'Adic. SENAI/SENAC - Percentual do adic. do SENAI/SENAC da filial.';
comment on column NATCORP.FILIAIS.limite_dias_adto
  is 'Limite Dias - Limite de dias trabalhados para se ter direito ao cálculo do adiantamento.';
comment on column NATCORP.FILIAIS.calc_adiant1
  is 'Adiantamento - Nforme (S) sim ou (N) não se, adiantamentos anteriores de 13o. salário devem entrar na primeira parcela do cálculo.';
comment on column NATCORP.FILIAIS.calc_adiant2
  is 'Adiantamento - (S) sim ou (N) não se, adiantamentos anteriores de 13o. entram na segunda parcela no cálculo.';
comment on column NATCORP.FILIAIS.calc_he1
  is 'Horas Extras - (S) sim ou (N) não se as horas extras entrarão no cálculo da primeira parcela do 13o.';
comment on column NATCORP.FILIAIS.calc_he2
  is 'Horas Extras - (S) sim ou (N) não para as horas extras entrem na média do cálculo da segunda parcela do 13o.';
comment on column NATCORP.FILIAIS.calc_adic1
  is 'Adicionais - (S) sim ou (N) não se o adicional entrará no cálculo da primeira parcela do 13o.';
comment on column NATCORP.FILIAIS.calc_adic2
  is 'Adicionais - (S) sim ou (N) não para o adicional entrar no cálculo da segunda parcela do 13o.';
comment on column NATCORP.FILIAIS.calc_fgts1
  is 'Fundo de Garantia - (S) sim ou (N) não se o FGTS entrará no cálculo da primeira parcela do 13o.';
comment on column NATCORP.FILIAIS.calc_fgts2
  is 'Fundo de Garantia - (S) sim ou (N) não para o FGTS entrar no cálculo da segunda parcela do 13o.';
comment on column NATCORP.FILIAIS.calc_ir1
  is 'Imposto de Renda - (S) sim ou (N) não se o imposto de renda entrará no cálculo da primeira parcela do 13o.';
comment on column NATCORP.FILIAIS.calc_ir2
  is 'Imposto de Renda - (S) sim ou (N) não para o imposto de renda entrar no cálculo da segunda parcela do 13o.';
comment on column NATCORP.FILIAIS.calc_pensao_alim1
  is 'Pensão Alimentícia - (S) sim ou (N) não se a pensão alimentícia entrará no cálculo da primeira parcela do 13o.';
comment on column NATCORP.FILIAIS.calc_pensao_alim2
  is 'Pensão Alimentícia - (S) sim ou (N) não para a pensão alimentícia entrar no cálculo da segunda parcela do 13o.';
comment on column NATCORP.FILIAIS.perc_calculo1
  is 'Percent de Cálculo - Percentual do cálculo da primeira parcela do 13o.';
comment on column NATCORP.FILIAIS.perc_calculo2
  is 'Percent de Cálculo - Percentual do cálculo da segunda parcela do 13o.';
comment on column NATCORP.FILIAIS.recebe_complem1
  is 'Recebe Compl. - (S) sim ou (N) não se terá complemento no cálculo da primeira parcela do 13o.';
comment on column NATCORP.FILIAIS.recebe_complem2
  is 'Recebe Compl. - (S) sim ou (N) não se terá complemento no cálculo da segunda parcela do 13o.';
comment on column NATCORP.FILIAIS.calc_iapas1
  is 'INSS - (S) sim ou (N) não se o INSS entrará no cálculo da primeira parcela do 13o.';
comment on column NATCORP.FILIAIS.calc_iapas2
  is 'INSS - (S) sim ou (N) não para o INSS entrar no cálculo da segunda parcela do 13o.';
comment on column NATCORP.FILIAIS.resp_rh_filial
  is 'Responsavel RH - Nome do responsável pelo RH na filial.';
comment on column NATCORP.FILIAIS.inscr_estadual
  is 'Inscr Estadual - Número da inscrição estadual.';
comment on column NATCORP.FILIAIS.inscr_municipal
  is 'Inscr. Mun - Número da inscrição municipal.';
comment on column NATCORP.FILIAIS.avos_proporc
  is 'Calcula Avos - 1 para cálculo de avos proporcionais até o fim do ano / informe 2 para cálculo até a data de referência / informe 3 para que a base seja mês admissão e data de referência/ informe 4 para que o cálculo seja realizado conforme da data de referência para admitidos.';
comment on column NATCORP.FILIAIS.ind_arredonda
  is 'Arredondamento - De 0 a 9 casas decimais caso queira trabalhar com arredondamento.';
comment on column NATCORP.FILIAIS.unificado
  is 'Unif - (S) se for unificadora ou (N) se não for.';
comment on column NATCORP.FILIAIS.cgc_unif
  is 'C.N.P.J. Unif. - C.N.P.J. da empresa unificadora.';
comment on column NATCORP.FILIAIS.calc_proporcional
  is 'Proporcional - (S) caso o cálculo do adiantamento for proporcional pelos dias trabalhados do colaborador ou (N) se não for ter cálculo proporcional.';
comment on column NATCORP.FILIAIS.perc_adiantamento
  is 'Percentual - Percentual para o cálculo do adiantamento.';
comment on column NATCORP.FILIAIS.base_adiantamento
  is 'Base - Quantidade de dias para base de adiantamento.';
comment on column NATCORP.FILIAIS.media_horas_dsr
  is 'Média Horas DSR - Deixar flegado obrigatório para que as médias de DSR integrem as ocorrências de ponto.';
comment on column NATCORP.FILIAIS.numero
  is 'No. - Número da filial.';
comment on column NATCORP.FILIAIS.complem
  is 'Compl. - Complemento de endereço caso exista.';
comment on column NATCORP.FILIAIS.integ_adic_ponto
  is 'Integ. Adic. PONTO - Deixar flegado obrigatório para que os adicionais de periculosidade e insalubridade integrem as ocorrências de ponto.';
comment on column NATCORP.FILIAIS.e_mail
  is 'E-mail - E-mail de contato na filial.';
comment on column NATCORP.FILIAIS.estab_resp
  is 'Estab. Responsável - Código da empresa responsável.';
comment on column NATCORP.FILIAIS.encer_ativ
  is 'Encerr. Ativ. - Flegar esta opção caso seja o encerramento da filial.';
comment on column NATCORP.FILIAIS.prim_declara
  is 'Primeira Declaração - Indica se for a primeira declaração.';
comment on column NATCORP.FILIAIS.mudanca_ender
  is 'Mudança de End. - Indica se houve mudança de endereço.';
comment on column NATCORP.FILIAIS.centro_custo_alfanum
  is 'Centr. Cust. Alfanum - Código fixo no sistema 3.';
comment on column NATCORP.FILIAIS.cod_terceiros
  is 'Terceiros - Neste parâmetro o código está parametrizado através do código FPAS.';
comment on column NATCORP.FILIAIS.cod_municipio_rais
  is 'Munic.Rais - Código do município conforme tabela RAIS.';
comment on column NATCORP.FILIAIS.cod_companhia
  is 'Cód. Companhia - Código fixo no sistema 3.';
comment on column NATCORP.FILIAIS.perc_fgts
  is 'FGTS - Percentual do FGTS da filial.';
comment on column NATCORP.FILIAIS.cod_sindicato
  is 'Sindicato - Sindicato que deve ser cadastrado junto a esta filial, caso não tenha nenhum sindicato na tabela ir na aplicação F010102 para efetuar o cadastro.';
comment on column NATCORP.FILIAIS.conv_inss
  is 'Convênio INSS - Flegar esta opção caso tenha o convênio com o INSS.';
comment on column NATCORP.FILIAIS.entra_grfc
  is 'Entra na GRFC - Fleg caso queira carregar para GRRF.';
comment on column NATCORP.FILIAIS.cs_fgts_mes
  is '% C.S. FGTS Mês - Percentual da contribuição social a ser depositado no mês.';
comment on column NATCORP.FILIAIS.cs_fgts_saldo
  is '% C.S. FGTS Saldo - Percentual da contribuição social sobre o deposito na C.E.F.';
comment on column NATCORP.FILIAIS.parc_saldo_13sal1
  is 'Parc. Saldo - Já vem preenchido automático pelo sistema.';
comment on column NATCORP.FILIAIS.demonstra_diferenca
  is 'Demonstra Diferença - (S) sim ou (N) não se vai demonstrar a diferença no cálculo da primeira parcela do 13o.';
comment on column NATCORP.FILIAIS.gera_pagto_insuf_saldo
  is 'Insuf.Saldo - (S) sim ou (N) não se vai demonstrar caso tenha insuficiência de saldo no cálculo da primeira parcela do 13o.';
comment on column NATCORP.FILIAIS.entra_rais
  is 'Entra na RAIS - Indica se as rescisões complementares entram na RAIS.';
comment on column NATCORP.FILIAIS.ir_mes_caixa
  is 'IR Mês Caixa - Sim: para indicar ao sistema que o pagamento de salário vai ocorrer no mês de competência. Não: para indicar ao sistema que o pagamento de salário vai ocorrer no mês seguinte ao da competência se esta informação for diferente no cadastro da empresa será acatado o parâmetro da filial.';
comment on column NATCORP.FILIAIS.perc_pis
  is 'PIS - Percentual do PIS da filial.';
comment on column NATCORP.FILIAIS.calc_adiant_admt
  is 'Admitidos - Indica se os admitidos no mês terão direito a adiantamento.';
comment on column NATCORP.FILIAIS.calc_adiant_ferias
  is 'Calc. Adiant.. Férias - Indica se os colabores em férias terão direito ao adiantamento.';
comment on column NATCORP.FILIAIS.pagto_abono_ferias
  is 'Pagto Abono - Indica se terá direito ao pagamento do abono de férias.';
comment on column NATCORP.FILIAIS.qtde_dias_mes_13
  is 'Qtde Dias - Quantidade de dias trabalhados durante o mês para o colaborador ter direito ao avo de 13o. Salário.';
comment on column NATCORP.FILIAIS.mes_inic_media
  is 'Mês Inicio Médias - Mês que deverá ser considerado no ano para início de apuração de cálculo das médias do 13o. Salário.';
comment on column NATCORP.FILIAIS.mes_fim_media
  is 'Mês Fim Médias - Mês que deverá ser considerado no ano para o fim de apuração de cálculo das médias do 13o. Salário.';
comment on column NATCORP.FILIAIS.ativ_economica
  is 'CNAE - CNAE da filial.';
comment on column NATCORP.FILIAIS.valor_beneficio
  is 'Valor Refeição - Utilizado caso tenha algum valor fixo de refeição que será descontado de todos os colaboradores, caso não utilizar o módulo de benefícios.';
comment on column NATCORP.FILIAIS.desjejum
  is 'Valor Desjejum - Utilizado caso tenha algum valor fixo de desjejum que será descontado de todos os colaboradores, caso não utilizar o módulo de benefícios.';
comment on column NATCORP.FILIAIS.limite_afastamento
  is 'Limite Dias Adianta - Limite de dias para o funcionários afastado ter direito ao adiantamento.';
comment on column NATCORP.FILIAIS.contr_limite_afasts
  is 'Calc. Adiant.. > 15 dias - Indica se os afastados terão um controle automático para o cálculo ou não do adiantamento.';
comment on column NATCORP.FILIAIS.cei
  is 'CEI - Número do CEI caso se aplique a esta filial.';
comment on column NATCORP.FILIAIS.rais_ind_centralizadora
  is 'Centralizadora - Flegar este parâmetro caso esta filial seja centralizadora na RAIS.';
comment on column NATCORP.FILIAIS.fap
  is 'FAP - Percentual do FAP da filial.';
comment on column NATCORP.FILIAIS.rais_considera_he
  is 'Considera H. Extra - Como deverá ser realizado o cálculo das horas extras na rescisão complementar.';
comment on column NATCORP.FILIAIS.rais_considera_remun
  is 'Considera Remuneração - Como deverá ser realizado o cálculo da remuneração na rescisão complementar.';
comment on column NATCORP.FILIAIS.reg_junta_coml
  is 'No. Junta Comercial - Número do registro na junta comercial.';
comment on column NATCORP.FILIAIS.nome_filial_caged
  is 'Nome da Filial - Nome da filial caso o tipo responsável for a filial.';
comment on column NATCORP.FILIAIS.perc_acrescimo_constitucional
  is '% Acresc. Constit. - Percentual para o cálculo do abono de férias.';
comment on column NATCORP.FILIAIS.perc_taxa_serv
  is 'Taxa de Serviço - Utilizado caso trabalhe com benefícios e tenha taxa de serviço a pagar o percentual, se não coloque 0.';
comment on column NATCORP.FILIAIS.perc_taxa_entrega
  is 'Taxa de Entrega - Utilizado caso trabalhe com benefícios e tenha taxa de entrega a pagar o percentual, se não coloque 0.';
comment on column NATCORP.FILIAIS.perc_taxa_adm_recarga
  is 'Taxa Adm. Recarga - Utilizado caso trabalhe com benefícios e tenha taxa administrativa de recarga a pagar o percentual, se não coloque 0.';
comment on column NATCORP.FILIAIS.perc_taxa_repasse_sptrans
  is 'Taxa Rep. SPTRANS - Utilizado caso trabalhe com benefícios e tenha taxa de repasse a SPTrans a pagar o percentual, se não coloque 0.';
comment on column NATCORP.FILIAIS.participa_pat
  is 'Participa do PAT - Definir este parâmetro.';
comment on column NATCORP.FILIAIS.vinc_ate_5
  is 'Até 5 Sal. Min - Indica se participar do PAT informar a quantidade de colaboradores que estarão dentro desta opção.';
comment on column NATCORP.FILIAIS.vinc_acima_5
  is 'Acima de 5 Sal. Min. - Indica se participar do PAT informar a quantidade de colaboradores que estarão dentro desta opção.';
comment on column NATCORP.FILIAIS.servico_proprio
  is '% Serviço Proprio - Utilizado caso tenha % para serviço próprio.';
comment on column NATCORP.FILIAIS.adm_cozinha
  is '% Adm. Cozinha - Utilizado caso tenha % para admistração de Cozinha.';
comment on column NATCORP.FILIAIS.refeicao_convenio
  is 'Refeição Convênio - Percentual da refeição caso tenha convênio.';
comment on column NATCORP.FILIAIS.refeicao_transportada
  is 'Ref. Transportadas - Percentual da refeição transportadas caso tenha.';
comment on column NATCORP.FILIAIS.cesta_alimento
  is 'Cesta Alimentos - Percentual da cesta alimentos caso tenha.';
comment on column NATCORP.FILIAIS.alimentacao_convenio
  is '% Aliment. Convenios - Percentual da alimentação caso tenha convênio.';
comment on column NATCORP.FILIAIS.dt_pag_plr_ini
  is 'Dt. Pag, PLR Inicial - Utilizado caso a filial pague PLR a data inicial para o cálculo.';
comment on column NATCORP.FILIAIS.dt_pag_plr_fin
  is 'Dt. Pag, PLR Final - Utilizado caso a filial pague PLR a data final para o cálculo.';
comment on column NATCORP.FILIAIS.saldo_fer_min
  is 'Saldo Mínimo - Quantidade mínima de saldo de férias para ter direito ao abono de férias.';
comment on column NATCORP.FILIAIS.vlr_garantia_minima
  is 'Garantia Mínima - Utilizado caso exista uma garantia mínima no valor do abono pago ao colaborador.';
comment on column NATCORP.FILIAIS.qtde_sal_minimo
  is 'Qtde. Sal. Minimo - Utilizado caso exista uma quantidade mínima de salários para pagamento do valor do abono ao colaborador.';
comment on column NATCORP.FILIAIS.ocorr_premio_ferias
  is 'Ocorr. Gar. Minima - Em qual ocorrência deverá sair esta garantia na folha.';
comment on column NATCORP.FILIAIS.tipo_sist_ctrl_ponto
  is 'Tipo - Tipo de sistema de ponto a filial utilizará.';
comment on column NATCORP.FILIAIS.cod_tipo_inscr_es
  is 'Tipo Inscrição - Tipo de inscrição.';
comment on column NATCORP.FILIAIS.desc_plr_folha
  is 'Desconto PLR Folha - Código da ocorrência que deverá sair o desconto do PLR na folha.';
comment on column NATCORP.FILIAIS.desc_plr
  is 'Desconto PLR - Código da ocorrência que deverá sair o desconto do PLR.';
comment on column NATCORP.FILIAIS.ind_sit_especial
  is 'Indic. Sit. Especial - Indica se a filial possui situação especial.';
comment on column NATCORP.FILIAIS.socio_ostensivo
  is 'Sócio Ostensivo? - Indica se a filial possui sócio ostensivo.';
comment on column NATCORP.FILIAIS.cod_tipo_lotacao
  is 'Tipo Lotação - Tipo de lotação da filial.';
comment on column NATCORP.FILIAIS.dt_encerramento
  is 'Data Encerramento - Data de encerramento desta filial.';
comment on column NATCORP.FILIAIS.perc_rat
  is '% RAT - Percentual do RAT da filial.';
comment on column NATCORP.FILIAIS.num_processo_rat
  is 'No. Processo RAT - Número do processo se tiver referente ao RAT.';
comment on column NATCORP.FILIAIS.num_processo_fap
  is 'No. Processo FAP - Processos que estão vinculados na aplicação F014014 referente ao FAP.';
comment on column NATCORP.FILIAIS.tipo_estab_resp
  is 'Tipo Resp. - Tipo de empresa responsável pelo CAGED.';
comment on column NATCORP.FILIAIS.dt_vigencia_inicial
  is 'Data Inicial - Data de início da filial junto ao E-social.';
comment on column NATCORP.FILIAIS.dt_vigencia_final
  is 'Data Final - Data final da filial junto ao E-social.';
comment on column NATCORP.FILIAIS.ocorr_media_neg
  is 'Ocorr Médias Negativas - Código de ocorrência caso as médias sejam negativas.';
comment on column NATCORP.FILIAIS.ocorr_media_neg_compl
  is 'Ocorr Médias Negativas Compl. - Código de ocorrência caso as médias sejam negativas no complemento.';
comment on column NATCORP.FILIAIS.perc_inss_emp_desoneracao
  is 'Desoneração - Percentual de desoneração da filial.';
comment on column NATCORP.FILIAIS.indsubstpatrobra
  is 'Indicador de Contribuição Patronal ';
comment on column NATCORP.FILIAIS.liq_plr_folha
  is 'Líquido PLR Folha - Código da ocorrência que deverá sair o liquido do PLR na folha.';
comment on column NATCORP.FILIAIS.perc_inss_13_desoneracao
  is 'Desoneração - Percentual de desoneração da filial.';
comment on column NATCORP.FILIAIS.estab_resp_sefip
  is 'Estab. Resp. SEFIP/GRRF - Utilizado caso tenha mais de uma empresa cadastrada no sistema o código da empresa responsável pelo certificado digital para envio da SEFIP/GRRF.';
comment on column NATCORP.FILIAIS.contr_vinculo_adiant
  is 'Vinculo Adiant. - Tipo de vínculo terá direito a adiantamento.';
comment on column NATCORP.FILIAIS.ocorr_base_plr_folha
  is 'Base de PLR Folha - Código da ocorrência que deverá sair a base do PLR na folha.';
comment on column NATCORP.FILIAIS.ocorr_irrf_plr_folha
  is 'IRRF PLR Folha - Código da ocorrência que deverá sair o IRRF do PLR na folha.';
comment on column NATCORP.FILIAIS.ocorr_plr_folha
  is 'PLR Folha - Código da ocorrência que deverá sair o PLR na folha.';
comment on column NATCORP.FILIAIS.dt_desoneracao
  is 'Data de desoneração';
comment on column NATCORP.FILIAIS.dt_desoneracao_13
  is 'Data de desoneração sobre o 13° salário';
-- Create/Recreate indexes 
create index NATCORP.IDX$$_2F190004 on NATCORP.FILIAIS (COD_FILIAL, COD_EMPRESA)
  tablespace TSPACE_NATCORP
  pctfree 10
  initrans 2
  maxtrans 255
  storage
  (
    initial 64K
    next 1M
    minextents 1
    maxextents unlimited
  );
create index NATCORP.IDX_FILIAL_1 on NATCORP.FILIAIS (COD_EMPRESA, ESTAB_RESP)
  tablespace TSPACE_NATCORP
  pctfree 10
  initrans 2
  maxtrans 255
  storage
  (
    initial 64K
    next 1M
    minextents 1
    maxextents unlimited
  );
create index NATCORP.IDX_FILIAL_2 on NATCORP.FILIAIS (COD_EMPRESA, CGC, DC_CGC)
  tablespace TSPACE_NATCORP
  pctfree 10
  initrans 2
  maxtrans 255
  storage
  (
    initial 64K
    next 1M
    minextents 1
    maxextents unlimited
  );
-- Create/Recreate primary, unique and foreign key constraints 
alter table NATCORP.FILIAIS
  add constraint PK_FIL primary key (COD_EMPRESA, COD_FILIAL)
  using index 
  tablespace TSPACE_NATCORP
  pctfree 10
  initrans 2
  maxtrans 255
  storage
  (
    initial 64K
    next 1M
    minextents 1
    maxextents unlimited
  );
alter table NATCORP.FILIAIS
  add constraint FK_FILIAL_SIND foreign key (COD_EMPRESA, COD_SINDICATO)
  references NATCORP.SINDICATOS (COD_EMPRESA, COD);
alter table NATCORP.FILIAIS
  add constraint FK_FIL_EMP foreign key (COD_EMPRESA)
  references NATCORP.EMPRESAS (COD);
alter table NATCORP.FILIAIS
  add constraint FK_FIL_OCORR_PREMIO_FERIAS foreign key (COD_EMPRESA, OCORR_PREMIO_FERIAS)
  references NATCORP.OCORR_PAGTO (COD_EMPRESA, COD);
alter table NATCORP.FILIAIS
  add constraint FK_FIL_OC_GAR_MIN foreign key (COD_EMPRESA, OCORR_GAR_MIN)
  references NATCORP.OCORR_PAGTO (COD_EMPRESA, COD);
alter table NATCORP.FILIAIS
  add constraint FK_FIL_TIP_LOTAL_ES foreign key (COD_TIPO_LOTACAO)
  references NATCORP.TIPOS_LOTACAO_ES (CODIGO);
alter table NATCORP.FILIAIS
  add constraint FK_OCORR_MEDIA_NEG foreign key (COD_EMPRESA, OCORR_MEDIA_NEG)
  references NATCORP.OCORR_PAGTO (COD_EMPRESA, COD);
alter table NATCORP.FILIAIS
  add constraint FK_OCORR_MEDIA_NEG_COMPL foreign key (COD_EMPRESA, OCORR_MEDIA_NEG_COMPL)
  references NATCORP.OCORR_PAGTO (COD_EMPRESA, COD);
alter table NATCORP.FILIAIS
  add constraint FK_OC_PENS_PLF_FOL foreign key (COD_EMPRESA, OCORR_PENSAO_PLR_FOLHA)
  references NATCORP.OCORR_PAGTO (COD_EMPRESA, COD);
alter table NATCORP.FILIAIS
  add constraint OCORR_FILF_FK foreign key (COD_EMPRESA, DESC_PLR_FOLHA)
  references NATCORP.OCORR_PAGTO (COD_EMPRESA, COD);
alter table NATCORP.FILIAIS
  add constraint OCORR_FIL_FK foreign key (COD_EMPRESA, DESC_PLR)
  references NATCORP.OCORR_PAGTO (COD_EMPRESA, COD);
-- Create/Recreate check constraints 
alter table NATCORP.FILIAIS
  add constraint CHK_ENTRA_RAIS
  check (entra_rais in('S', 'N'))
  novalidate;
alter table NATCORP.FILIAIS
  add constraint CHK_GER_PAG_INSUF_SALDO
  check (gera_pagto_insuf_saldo in('S','N'))
  novalidate;
alter table NATCORP.FILIAIS
  add constraint CK_AVOS_PROPORC
  check (AVOS_PROPORC IN ('1','2','3', '4', '5'));
alter table NATCORP.FILIAIS
  add constraint CK_DIAS_MES_13
  check (QTDE_DIAS_MES_13 BETWEEN 1 AND 31)
  novalidate;
alter table NATCORP.FILIAIS
  add constraint CK_FEV_ULT_DIA
  check (fev_ult_dia IN('S', 'N'));
alter table NATCORP.FILIAIS
  add constraint CK_FILIAL_AVOS_MAT
  check (avos_maternidade IN(1,2));
alter table NATCORP.FILIAIS
  add constraint CK_FIL_CONTAPR
  check (contApr IN (0,1,2));
alter table NATCORP.FILIAIS
  add constraint CK_FIL_CONTPCD
  check (contPCD IN(0,1,2,9));
alter table NATCORP.FILIAIS
  add constraint CK_FIL_INDSPOBRA
  check (participa_pat IN(1,2));
alter table NATCORP.FILIAIS
  add constraint CK_FIL_IND_SIT_ESPEC
  check (IND_SIT_ESPECIAL IN(0,1,2,3,4));
alter table NATCORP.FILIAIS
  add constraint CK_FIL_PART_PAT
  check (participa_pat IN(1,2));
alter table NATCORP.FILIAIS
  add constraint CK_FIL_SOCIO_OSTENSIVO
  check (SOCIO_OSTENSIVO IN('S','N'));
alter table NATCORP.FILIAIS
  add constraint CK_FIL_TP_ESTAB_RESP
  check (tipo_estab_resp IN('E','F'));
alter table NATCORP.FILIAIS
  add constraint CK_IR_MES_CAIXA
  check (IR_MES_CAIXA IN ('S', 'N'))
  novalidate;
alter table NATCORP.FILIAIS
  add constraint CK_MES_FIM_MEDIA
  check (MES_FIM_MEDIA    BETWEEN 1 AND 12)
  novalidate;
alter table NATCORP.FILIAIS
  add constraint CK_MES_INI_MEDIA
  check (MES_INIC_MEDIA   BETWEEN 1 AND 12)
  novalidate;
alter table NATCORP.FILIAIS
  add constraint CK_RAIS_CONSIDERA_HE
  check (rais_considera_he IN('N', 'SS', 'SN'));
alter table NATCORP.FILIAIS
  add constraint CK_RAIS_CONSIDERA_REMUN
  check (rais_considera_REMUN IN('N', 'SS', 'SN'));
alter table NATCORP.FILIAIS
  add constraint CK_SIT
  check (SIT in ('I', 'A', 'E' ));
alter table NATCORP.FILIAIS
  add constraint CK_TIPO_SIST_CTRL_PONTO
  check (tipo_sist_ctrl_ponto IN('00','01','02','03','04','05','06'));
