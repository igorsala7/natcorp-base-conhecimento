-- Create table
create table NATCORP.INFORMACOES_FUNCIONAIS
(
  ind_aposentado                VARCHAR2(1),
  ind_contr_sindical            VARCHAR2(1) not null,
  cod_tp_movto                  VARCHAR2(2) not null,
  cod_tipo_pagto                VARCHAR2(5) not null,
  codigo_plano                  VARCHAR2(5),
  codigo_tipo                   VARCHAR2(5),
  num_conta                     NUMBER(10),
  dc_conta                      VARCHAR2(2),
  opcao_fgts                    VARCHAR2(1) default 'S' not null,
  dt_opcao_fgts                 DATE not null,
  taxa                          NUMBER(1) default 3,
  convenio                      NUMBER(3),
  cod_ccusto                    NUMBER(10) not null,
  dc_ccusto                     NUMBER(1) default 0,
  entra_lista                   VARCHAR2(1) default 'S' not null,
  nome_de_guerra                VARCHAR2(40),
  dt_ccusto                     DATE not null,
  dt_cargo                      DATE not null,
  dt_funcao                     DATE not null,
  grupo_salarial                VARCHAR2(5) default 1,
  ponto_de_fx                   VARCHAR2(1) default 'Z' not null,
  desc_contr_sind               VARCHAR2(1),
  desc_mens_sind                VARCHAR2(1),
  ramal1                        VARCHAR2(5),
  ramal2                        VARCHAR2(5),
  isencao_iapas                 VARCHAR2(1) default 'N' not null,
  isencao_ir                    VARCHAR2(1) default 'N' not null,
  adto_salarial                 VARCHAR2(1) default 'N' not null,
  usuario                       VARCHAR2(30),
  dt_atualizacao                DATE,
  dt_reg_trab                   DATE,
  dt_filial                     DATE,
  perc_adiant                   NUMBER(5,2),
  ind_cipa                      VARCHAR2(1),
  data_car_cipa                 DATE,
  ind_sind                      VARCHAR2(1),
  data_car_sind                 DATE,
  conta_vinc_fgts               NUMBER(12),
  dias_aviso                    NUMBER(3),
  ind_avprev_indeniz            VARCHAR2(1),
  cod_localizacao               VARCHAR2(10) not null,
  dt_admissao_basica            DATE not null,
  cod_empresa                   NUMBER(3) not null,
  filial                        NUMBER(4),
  dc_filial                     NUMBER(1),
  matricula                     NUMBER(38) not null,
  dc_matricula                  NUMBER(1) not null,
  dt_admissao                   DATE not null,
  num_drt                       NUMBER(15) not null,
  num_sind_diss                 NUMBER(3),
  num_sind_cat                  NUMBER(3) not null,
  tipo_ats                      VARCHAR2(4),
  dt_base_ats                   DATE,
  vinculo                       VARCHAR2(2) not null,
  situacao                      VARCHAR2(2) not null,
  dt_situacao                   DATE not null,
  salario                       NUMBER(15,2) not null,
  dt_salario                    DATE,
  tipo_salario                  VARCHAR2(1) default 'M' not null,
  mot_alt_funcao                VARCHAR2(3),
  mot_alt_cargo                 VARCHAR2(3),
  mot_alt_sal                   VARCHAR2(3),
  cargo                         VARCHAR2(7),
  funcao                        VARCHAR2(7),
  reg_trab                      VARCHAR2(3) not null,
  marca_ponto                   VARCHAR2(1) default 'S' not null,
  num_relogio                   NUMBER(2),
  banco                         NUMBER(3),
  agencia                       NUMBER(4),
  posto_servico                 VARCHAR2(4),
  modalidade                    NUMBER(4),
  cod_orgao                     NUMBER(10),
  cod_cargo_cipa                VARCHAR2(7),
  opc_vale_alimentacao          VARCHAR2(1) default 'S' not null,
  maior_remuneracao             NUMBER(15,2),
  saldo_fgts                    NUMBER(15,2),
  mot_alt_situacao              VARCHAR2(3) not null,
  mot_alt_centro                VARCHAR2(3),
  mot_alt_reg_trab              VARCHAR2(3),
  mot_alt_filial                VARCHAR2(3),
  dt_retroacao_fgts             DATE,
  dt_retratacao_fgts            DATE,
  cod_aposentadoria             VARCHAR2(5),
  cod_situacao_prev             VARCHAR2(1),
  tsa_pat_c_ades_anos           NUMBER(2),
  tsa_pat_c_ades_meses          NUMBER(2),
  tsa_pat_s_ades_anos           NUMBER(2),
  tsa_pat_s_ades_meses          NUMBER(2),
  tsa_nao_pat_anos              NUMBER(2),
  tsa_nao_pat_meses             NUMBER(2),
  tsa_outras_emp_anos           NUMBER(2),
  tsa_outras_emp_meses          NUMBER(2),
  opc_ticket_compra             VARCHAR2(1) default 'N' not null,
  cod_tipo_mao_obra             VARCHAR2(1) default 'D' not null,
  qualificacao_funcionario      VARCHAR2(1) default 'A' not null,
  matricula_sindicato           NUMBER(38),
  dc_matricula_sindicato        NUMBER(1),
  dt_sindicalizacao             DATE,
  cd_nivel                      NUMBER(10) default 1 not null,
  perc_insalub                  NUMBER(6,3),
  perc_peric                    NUMBER(6,3),
  senha_funcional               VARCHAR2(30),
  matricula_gestor              NUMBER(38),
  ind_contrato_prz_determinado  VARCHAR2(1) default 'I' not null,
  data_contrato_prz_determinado DATE,
  prorrog_contrato_prz_determ   DATE,
  unidade_adm                   NUMBER(10),
  cod_agente                    VARCHAR2(2) default '01' not null,
  dt_fim_ats                    DATE,
  cod_complemento_plano         VARCHAR2(1),
  perc_ats                      NUMBER(9,6),
  cad_vaga                      VARCHAR2(6),
  dt_preench_vaga               DATE,
  mot_inicio_vaga               VARCHAR2(3),
  opcao_vale_transporte         VARCHAR2(1) default 'N' not null,
  e_mail                        VARCHAR2(100),
  data_adesao                   DATE,
  opc_convenios_diversos        VARCHAR2(1) default 'N' not null,
  complemento                   VARCHAR2(6),
  dt_aviso                      DATE,
  valor_convenio                NUMBER(15,2),
  valor_convenio_acumulado      NUMBER(15,2),
  nr_cracha                     VARCHAR2(10),
  via_do_cracha                 NUMBER(2),
  cod_horario                   VARCHAR2(4),
  id_cesta_basica               NUMBER(1),
  tp_cesta_basica               NUMBER(1),
  cd_fornec_cesta               NUMBER(6),
  dt_inicio_cesta               DATE,
  dt_fim_cesta                  DATE,
  salario_duplo_vinculo         NUMBER(15,2),
  total_salario                 NUMBER(15,2),
  cd_posto                      NUMBER(5),
  mot_alt_local_trab            VARCHAR2(3) default '111',
  dt_local_trab                 DATE,
  data_duplo_vinculo            DATE,
  qtd_sal_minimo                NUMBER(2) default 1,
  cod_cat_grupos_salariais      VARCHAR2(5),
  mot_alt_horario               VARCHAR2(3),
  dt_horario                    DATE,
  dt_retorno_afast              DATE,
  cod_categoria                 VARCHAR2(3) default '1',
  cod_nova_sit                  VARCHAR2(2),
  jornada_duplo_vinculo         VARCHAR2(3),
  jornada_ponto_de_fx           VARCHAR2(3) default 'NUL',
  sindicato_ponto_de_fx         NUMBER(3) default 999,
  cat_p_sefip                   VARCHAR2(2) default '1',
  dt_adesao_prev_priv           DATE,
  cod_tp_trans_bca              NUMBER(3) not null,
  cod_conectividade             VARCHAR2(30),
  sindicalizado                 VARCHAR2(1) default 'N' not null,
  dt_fim_sindicalizacao         DATE,
  tipo_vinculo                  VARCHAR2(20),
  cod_grupo_trabalho            NUMBER,
  codigo_plano2                 VARCHAR2(5),
  codigo_tipo2                  VARCHAR2(5),
  dt_adesao                     DATE,
  dt_adesao2                    DATE,
  cod_complemento_plano2        VARCHAR2(1),
  tipo_demissao                 VARCHAR2(100),
  remuneracao                   NUMBER(17,2) default 0,
  total_remuneracao             NUMBER(17,2),
  dt_remuneracao                DATE,
  cod_politica                  NUMBER(5),
  nm_usuario_pc                 VARCHAR2(30),
  obs_insalubridade             VARCHAR2(4000),
  obs_periculosidade            VARCHAR2(4000),
  obs_ats                       VARCHAR2(4000),
  tipo_vinculo_empreg           VARCHAR2(2) not null,
  dt_adesao_final               DATE,
  dt_adesao2_final              DATE,
  primeiro_acesso               VARCHAR2(1) default 'S',
  bloqueia_acesso               VARCHAR2(1) default 'N',
  mot_alt_nova_sit              VARCHAR2(3),
  requereu_sd                   VARCHAR2(1) default 'N' not null,
  observacoes                   VARCHAR2(4000),
  tp_av_previo                  NUMBER(1),
  observ_av_previo              VARCHAR2(255),
  dt_canc_av_previo             DATE,
  mot_canc_av_previo            NUMBER(1),
  observ_canc_avprevio          VARCHAR2(255),
  estat_indprovim               NUMBER(1),
  estat_tpprov                  NUMBER(2),
  estat_dtnomeacao              DATE,
  estat_dtposse                 DATE,
  estat_dtexercicio             DATE,
  num_certif_obito              VARCHAR2(32),
  es2206                        DATE,
  prefixo                       NUMBER(5),
  ddd                           NUMBER(3),
  celular                       NUMBER(12),
  codcarreira                   VARCHAR2(30),
  dtingrcarr                    DATE,
  tpplanrp                      NUMBER(1),
  ind_tmp_parcial               VARCHAR2(1) default '0' not null,
  trab_intermitente             VARCHAR2(1) default 'N',
  clauasseg                     VARCHAR2(1) default 'N' not null,
  cod_atividade                 VARCHAR2(10),
  vaga_faturavel                VARCHAR2(1),
  remuneracao_variavel          NUMBER(15,2),
  perc_beneficio_variavel       NUMBER(5,2),
  tp_registro_ponto             VARCHAR2(1) default 'A',
  cod_gera_esocial              NUMBER default 0,
  matricula_esocial             VARCHAR2(38),
  secao_natcorp                 VARCHAR2(50),
  chave_acesso                  as (TO_CHAR("COD_EMPRESA")||'-'||TO_CHAR("FILIAL")||'-'||TO_CHAR("COD_CCUSTO")||'-'||TO_CHAR("CD_NIVEL")),
  penosidade                    VARCHAR2(1) default 'N',
  cod_sub_ccusto                NUMBER(3),
  objdet                        VARCHAR2(255),
  toler_ponto                   VARCHAR2(5),
  cod_gp_exposicao              VARCHAR2(30),
  tipo_adesao                   NUMBER(1),
  dt_acordo                     DATE,
  percent_reducao_carga_horaria NUMBER(2),
  dias_duracao                  NUMBER(3),
  data_antecipacao              DATE,
  dias_prorrogacao              NUMBER(2),
  desc_contrib_assist           VARCHAR2(1) default 'N',
  tipo_modalidade               VARCHAR2(1) default 'P',
  mot_alt_tipo_modalidade       VARCHAR2(3),
  vlr_aux_tipo_modalidade       NUMBER(10,2),
  dt_vlr_aux_tipo_modalidade    DATE,
  mot_alt_vlr_aux_tp_modalidade VARCHAR2(3),
  dt_tipo_modalidade            DATE,
  indtetorgps                   VARCHAR2(1),
  indabonoperm                  VARCHAR2(1),
  dtiniabono                    DATE,
  tp_id_chave_pix               VARCHAR2(2),
  chave_pix                     VARCHAR2(36)
)
tablespace TSPACE_NATCORP
  pctfree 10
  initrans 1
  maxtrans 255
  storage
  (
    initial 18M
    next 1M
    minextents 1
    maxextents unlimited
  );
-- Add comments to the columns 
comment on column NATCORP.INFORMACOES_FUNCIONAIS.ind_aposentado
  is 'Indicador de Aposentadoria ( S / N )';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.ind_contr_sindical
  is 'Ind. descto Contrib.Sind. ano ( S / N )';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cod_tp_movto
  is 'Código Tipo de Movimento';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cod_tipo_pagto
  is 'Código Tipo de Pagamento';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.codigo_plano
  is 'Código do Plano Médico';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.codigo_tipo
  is 'Tipo do Plano Médico';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.num_conta
  is 'Número da Conta Corrente';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dc_conta
  is 'Dígito da Conta Corrente';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.opcao_fgts
  is 'Opção Fundo de Garantia';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_opcao_fgts
  is 'Data da Opção pelo FGTS';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.taxa
  is 'Taxa do FGTS';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cod_ccusto
  is 'Centro de Custo - Preenchido automaticamente assim que o usuário fazer a pesquisa.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dc_ccusto
  is 'Díg. do Centro de Custo';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.entra_lista
  is 'Ind. se entra na Lista Telefôn. (S / N)';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.nome_de_guerra
  is 'Apelido do funcionário';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_ccusto
  is 'Data Alteração do Centro de Custo';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_cargo
  is 'Data de Alteração do Cargo';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_funcao
  is 'Data de Alteração da Função';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.grupo_salarial
  is 'Grupo Salarial';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.ponto_de_fx
  is 'Ponto de Faixa';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.desc_contr_sind
  is 'Indicador para desconto de contribuiçcão Sindical';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.desc_mens_sind
  is 'Indicador para desconto de mensalidade sindical';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.ramal1
  is 'Ramal 1';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.ramal2
  is 'Ramal 2';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.isencao_iapas
  is 'Ind. Isenção do INSS  (S / N)';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.isencao_ir
  is 'Ind. Isenção do IR  (S / N)';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.adto_salarial
  is 'Ind. Opção pelo Ad.Salarial (S / N)';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.usuario
  is 'Usuário';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_atualizacao
  is 'Data de Atualização';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_reg_trab
  is 'Data de Alteração do Reg. de Trab.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_filial
  is 'Data de Alteração da Filial';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.perc_adiant
  is 'Percentual de Adiantamento  Salarial';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.ind_cipa
  is 'Ind. se é Membro da CIPA   (S / N)';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.data_car_cipa
  is 'Data do Cargo na CIPA';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.ind_sind
  is 'Indica se é Sindicalizado  (S / N)';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.data_car_sind
  is 'Data do Cargo no Sindicato';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.conta_vinc_fgts
  is 'Número da Conta do FGTS';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dias_aviso
  is 'Dias de Aviso';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.ind_avprev_indeniz
  is 'Indicador Aviso Prévio Indenizado ( ISENTO = N, TRABALHADO = T, INDENIZADO = I, DESCONTADO = D)';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cod_localizacao
  is 'Código do Local de Trabalho';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_admissao_basica
  is 'Data de Admissão Básica';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cod_empresa
  is 'Empresa - Usuário vai usar esta aplicação para lançar uma restrição para desligamento para um determinado funcionário, ou seja, esta aplicação permite dar estabilidade a um determinado funcionário (referente à Medicina do Trabalho).Neste campo o usuário deve informar o código da empresa que pertence o funcionário que vai ter a restrição de desligamento.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.filial
  is 'Código da Filial de Trabalho';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dc_filial
  is 'Dígito de Controle da Filial';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.matricula
  is 'Matricula - Pesquisa do código da matricula o sistema irá preencher de forma automática todos os campos atuais do colaborador.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dc_matricula
  is 'Dígito da Matricula do funcionário';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_admissao
  is 'Data de Admissão do Funcionário';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.num_drt
  is 'Número da DRT';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.num_sind_diss
  is 'Número do Sindicato de Dissidio';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.num_sind_cat
  is 'Número do Sindicato da Categoria';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.tipo_ats
  is 'Código do Adic.Tempo de Serviço';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_base_ats
  is 'Data Base do ATS';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.vinculo
  is 'Vínculo Empregatício';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.situacao
  is 'Sit. Funcionário - Este campo vai ser preenchido automaticamente. Possível ver a situação atual do funcionário.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_situacao
  is 'Data Situação - Este campo vai ser preenchido automaticamente. Possível ver a data que o funcionário entra na situação indicada.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.salario
  is 'Valor do Salário';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_salario
  is 'Data de Alteração do Salário';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.tipo_salario
  is 'Tipo de Salário';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.mot_alt_funcao
  is 'Motivo de Alteração da Função';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.mot_alt_cargo
  is 'Motivo de Alteração do Cargo';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.mot_alt_sal
  is 'Motivo de Alteração do Salário';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cargo
  is 'Código do Cargo';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.funcao
  is 'Código do Função';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.reg_trab
  is 'Código do Regime de Trabalho';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.marca_ponto
  is 'Ind. se Marca Ponto (S / N)';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.num_relogio
  is 'Número do Relógio';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.banco
  is 'Cód. do Banco da Conta Corrente';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.agencia
  is 'Cód. da Agência  da Conta Corrente';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.posto_servico
  is 'Cód. do Posto de Serviço';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.modalidade
  is 'Modalidade da Conta';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cod_orgao
  is 'Código Órgão';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cod_cargo_cipa
  is 'Cargo Cipa - Preenchido automaticamente assim que o usuário fazer a pesquisa . Observe e caso CARGO NA CIPA esteja em branco isto significa que o funcionário não e CIPEIRO.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.opc_vale_alimentacao
  is 'Opção Vale Alimentação (S / N)';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.maior_remuneracao
  is 'Maior Remuneração';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.saldo_fgts
  is 'Saldo FGTS';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.mot_alt_situacao
  is 'Motivo de Alteração da Situação';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.mot_alt_centro
  is 'Motivo de Alter. do Centro de Custo';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.mot_alt_reg_trab
  is 'Motivo de Alteração do Reg.Trabalho';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.mot_alt_filial
  is 'Motivo de Alteração da Filial';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_retroacao_fgts
  is 'Data de retroação do FGTS';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_retratacao_fgts
  is 'Data de retratação do FGTS';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cod_aposentadoria
  is 'Cód. de Aposentadoria';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cod_situacao_prev
  is 'Cód.Situacao Previdênciária';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.tsa_pat_c_ades_anos
  is 'Tempo Serv. Anos ¿ Patroc. c/ Ades.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.tsa_pat_c_ades_meses
  is 'Tempo Serv. Meses ¿ Patr. c/ Ades.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.tsa_pat_s_ades_anos
  is 'Tempo Serv. Anos ¿ Patroc. s/ Ades.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.tsa_pat_s_ades_meses
  is 'Tempo Serv. Meses ¿ Patr. s/ Ades.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.tsa_nao_pat_anos
  is 'Tempo Serv. Anos ¿Não Patrocin.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.tsa_nao_pat_meses
  is 'Tempo Serv. Meses ¿Não Patrocin.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.tsa_outras_emp_anos
  is 'Tempo Serv. Anos ¿Outras Empresas';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.tsa_outras_emp_meses
  is 'Tempo Serv. Meses ¿ Outras Empres';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.opc_ticket_compra
  is 'Ind. Opção TICKET de Compra (S/N)';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cod_tipo_mao_obra
  is 'Cód. Tipo de Mão-de-obra';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.qualificacao_funcionario
  is 'Qualificação do Funcionário';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.matricula_sindicato
  is 'Matrícula no Sindicato';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dc_matricula_sindicato
  is 'Dígito de Controle da Matr.no Sind.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_sindicalizacao
  is 'Data da Sindicalização';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cd_nivel
  is 'Código do Nível';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.perc_insalub
  is 'Percentual Insalubridade';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.perc_peric
  is 'Percentual Periculosidade';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.senha_funcional
  is 'Senha Funcional';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.matricula_gestor
  is 'Matricula Gestor';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.ind_contrato_prz_determinado
  is 'Indicação Contrato Prazo Determinado.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.data_contrato_prz_determinado
  is 'Data Contrato Prazo Determinado';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.prorrog_contrato_prz_determ
  is 'Data do último dia Prorrogação do Contrato prazo determinado';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.unidade_adm
  is 'Unidade Administrativa';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cod_agente
  is 'Código Agente Nocivo';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_fim_ats
  is 'Data Fim Ats';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cod_complemento_plano
  is 'Código Complemento do Plano';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.perc_ats
  is 'Percentual Adicional por tempo de serviço';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cad_vaga
  is 'Código da Vaga';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_preench_vaga
  is 'Data Preenchimento da Vaga';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.mot_inicio_vaga
  is 'Motivo de Inicio da Vaga.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.opcao_vale_transporte
  is 'Opção Vale Transporte S ou N';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.e_mail
  is 'E_MAIL  Funcional';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.data_adesao
  is 'Data de adesão do Vale Transporte';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.opc_convenios_diversos
  is 'Indicador de opção para convênios diversos';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.complemento
  is 'Campo para qualquer informação ref. À tabela salarial, a critério do usuário';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_aviso
  is 'DT DO AV PREVIO TRABALHADO/INDENIZADO OU PROJEÇÃO';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.nr_cracha
  is 'Número do crachá';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.via_do_cracha
  is 'Via do crachá';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cod_horario
  is 'Código do horário';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.salario_duplo_vinculo
  is 'Valor do salário para funcionários de empresas com duplo_vinculo=S';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.total_salario
  is 'Valor total do salario + salario_duplo_vinculo';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.mot_alt_local_trab
  is 'Motivo de Alteração de Local de Trabalho';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_local_trab
  is 'Data do Local de Trabalho';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.data_duplo_vinculo
  is 'Data de duplo vínculo para empresas com funcionários com cálculos baseados em valores de duas empresas';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.qtd_sal_minimo
  is 'Quantidade de salários mínimos para pagto da insalubridade. Sempre que tiver percentua lde insalubridade, este campo deve ser preenchido com pelo menos 1.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cod_cat_grupos_salariais
  is 'Código da categoria de grupos salariais onde o salário está enquandrado';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.mot_alt_horario
  is 'Código do motivo de alteração do horário de trabalho';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_horario
  is 'Data do horário';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_retorno_afast
  is 'Data de retorno do último afastamento';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cod_categoria
  is 'Código da categoria de cargo do funcionário';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cod_nova_sit
  is 'Código nova situação - para carga deixar nulo';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.jornada_duplo_vinculo
  is 'Código da jornada para funcionário de empresas com duplo_vinculo = S';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cat_p_sefip
  is 'Categoria do trabalhador para FGTS';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_adesao_prev_priv
  is 'Data de adesão à previdência privada';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cod_tp_trans_bca
  is 'Tipo  de Conta';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cod_conectividade
  is 'Codigo da Conectividade';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.sindicalizado
  is 'Indicador de funcionário sindicalizado';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_fim_sindicalizacao
  is 'Data de final da sindicalização';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.tipo_vinculo
  is 'Tipo de Vinculo';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cod_grupo_trabalho
  is 'Codigo do grupo de trabalho ';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.codigo_plano2
  is 'Codigo de Plano Odontologico';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.codigo_tipo2
  is 'Tipo de Plano ';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_adesao
  is 'Data de adesão à plano medico';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_adesao2
  is 'Data de adesão à plano odontologico';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cod_complemento_plano2
  is 'Codigo Complemento do plano Odontologico';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.tipo_demissao
  is 'Tipo de Demissão';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.remuneracao
  is 'Valor da Remuneração';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.total_remuneracao
  is 'Data da Remuneração';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_remuneracao
  is 'Código da Política';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.cod_politica
  is 'Total de remuneração (Salário Nominal + Outros).';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.nm_usuario_pc
  is 'Nome do usuário na rede.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.obs_insalubridade
  is 'Observações para o Adicional de Insalubridade.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.obs_periculosidade
  is 'Observações para o Adicional de Periculosidade.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.obs_ats
  is 'Observações para o Adicional por Tempo de Serviço.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.tipo_vinculo_empreg
  is 'Tipo de Vínculo Empregatício.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_adesao_final
  is 'Data de Adesão Final para Plano Médico.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_adesao2_final
  is 'Data de Adesão Final para Plano Odontológico.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.primeiro_acesso
  is 'Indicativo de primeiro acesso ao Portal do Colaborador.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.bloqueia_acesso
  is 'Indicativo de Bloqueio de acesso ao usuário.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.mot_alt_nova_sit
  is 'Motivo da nova alteração de situação.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.requereu_sd
  is 'Indicativo de Requerimento do Seguro Desemprego.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.observacoes
  is 'Observações gerais.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.tp_av_previo
  is 'Tipo de Aviso Prévio.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.observ_av_previo
  is 'Observações do Aviso Prévio';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_canc_av_previo
  is 'Data de Cancelamento do Aviso Prévio.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.mot_canc_av_previo
  is 'Motivo do Cancelamento do Aviso Prévio.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.observ_canc_avprevio
  is 'Observações do Cancelamento do Aviso Prévio.';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.estat_dtnomeacao
  is 'Data de Nomeação';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.estat_dtposse
  is 'Data de Posse';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.estat_dtexercicio
  is 'Data de Exercício';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.num_certif_obito
  is 'Numero do certificado de Óbito';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.es2206
  is 'Instrução Esocial';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.prefixo
  is 'Prefixo telefone Corporativo';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.ddd
  is 'DDD telefone Corporativo';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.celular
  is 'Numero do Celular Corporativo';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.trab_intermitente
  is 'Indicativo de trabalho intermitente - S ou N';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.tipo_adesao
  is 'Indicador do tipo de adesão do contrato.
     ( 0 - Suspensão do Contrato 
       1 - Redução carga horária)';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dt_acordo
  is 'Data do acordo entre empregador e empregado';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.percent_reducao_carga_horaria
  is 'Percentual de redução da carga horária';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.dias_duracao
  is 'Número de dias de duração do acordo';
comment on column NATCORP.INFORMACOES_FUNCIONAIS.tipo_modalidade
  is '(P)resencial, (S)emi-presencial, (H)ome-Office';
-- Create/Recreate indexes 
create index NATCORP.IDX$$_03640007 on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, DT_ADMISSAO_BASICA, MATRICULA)
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
create index NATCORP.IDX$$_03640008 on NATCORP.INFORMACOES_FUNCIONAIS (COD_TP_MOVTO, COD_EMPRESA, DT_SITUACAO, MATRICULA)
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
create index NATCORP.IDX$$_03640009 on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, DT_SITUACAO, MATRICULA)
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
create index NATCORP.IDX$$_2E9D0003 on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, SITUACAO, MATRICULA)
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
create index NATCORP.IDX_ES1200_V2_2 on NATCORP.INFORMACOES_FUNCIONAIS (MATRICULA_ESOCIAL)
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
create index NATCORP.IDX_FUNCIONAIS on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, FILIAL, CD_NIVEL)
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
create index NATCORP.IDX_FUNC_11 on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, SITUACAO)
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
create index NATCORP.IDX_INF_FUNC_01 on NATCORP.INFORMACOES_FUNCIONAIS (CHAVE_ACESSO)
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
create index NATCORP.IDX_INF_FUNC_02 on NATCORP.INFORMACOES_FUNCIONAIS (TO_CHAR(DT_ADMISSAO,'DD/MM'))
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
create index NATCORP.IDX_INF_FUNC_03 on NATCORP.INFORMACOES_FUNCIONAIS (TO_CHAR(DT_ADMISSAO,'MM'))
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
create index NATCORP.IDX_INF_FUNC_04 on NATCORP.INFORMACOES_FUNCIONAIS (TRUNC(DT_AVISO))
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
create index NATCORP.IDX_INF_FUNC_EMP_MAT_SIT on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, MATRICULA, SITUACAO)
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
create index NATCORP.IDX_INF_FUNC_VAGA on NATCORP.INFORMACOES_FUNCIONAIS (CAD_VAGA, SITUACAO)
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
create index NATCORP.IDX_INF_FUN_FIN on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, FILIAL, COD_CCUSTO, DT_ADMISSAO_BASICA, NUM_SIND_DISS, SITUACAO, VINCULO, MATRICULA)
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
create index NATCORP.IND_FK_INF_FUNC_SIND_CAT on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, NUM_SIND_CAT)
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
create index NATCORP.IND_FUNC_1 on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, MATRICULA, FILIAL)
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
create index NATCORP.IND_FUNC_2 on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, MATRICULA, FILIAL, SITUACAO)
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
create index NATCORP.IND_IND_FUNC_16 on NATCORP.INFORMACOES_FUNCIONAIS (SITUACAO, COD_EMPRESA, FILIAL, COD_CCUSTO, UNIDADE_ADM, COD_ATIVIDADE, CARGO, MATRICULA)
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
create index NATCORP.IND_IND_FUNC_18 on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, FILIAL, COD_CCUSTO, UNIDADE_ADM, COD_ATIVIDADE, CARGO, MATRICULA)
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
create index NATCORP.IND_INF_FUNC_1 on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, MATRICULA)
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
create index NATCORP.IND_INF_FUNC_10 on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, MATRICULA, COD_CCUSTO, FILIAL)
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
create index NATCORP.IND_INF_FUNC_11 on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, MATRICULA, FILIAL, CD_NIVEL)
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
create index NATCORP.IND_INF_FUNC_12 on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, MATRICULA, FILIAL, CD_NIVEL, SITUACAO)
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
create index NATCORP.IND_INF_FUNC_13 on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, COD_CCUSTO, COD_SUB_CCUSTO, MATRICULA)
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
create index NATCORP.IND_INF_FUNC_14 on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, COD_CCUSTO, COD_SUB_CCUSTO)
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
create index NATCORP.IND_INF_FUNC_15 on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, MATRICULA, MARCA_PONTO)
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
create index NATCORP.IND_INF_FUNC_16 on NATCORP.INFORMACOES_FUNCIONAIS (SITUACAO, COD_EMPRESA, MATRICULA, FILIAL, CD_NIVEL)
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
create index NATCORP.IND_INF_FUNC_2 on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, FILIAL, MATRICULA)
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
create index NATCORP.IND_INF_FUNC_3 on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, MATRICULA, FILIAL, COD_CCUSTO)
  tablespace TSPACE_NATCORP
  pctfree 10
  initrans 2
  maxtrans 255
  storage
  (
    initial 2M
    next 1M
    minextents 1
    maxextents unlimited
  );
create index NATCORP.IND_INF_FUNC_3X on NATCORP.INFORMACOES_FUNCIONAIS (COD_CCUSTO, UNIDADE_ADM, COD_LOCALIZACAO)
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
create index NATCORP.IND_INF_FUNC_5 on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, COD_CCUSTO)
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
create index NATCORP.IND_INF_FUNC_6 on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, FILIAL, COD_CCUSTO)
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
create index NATCORP.IND_INF_FUNC_7 on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, FILIAL)
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
create index NATCORP.IND_INF_FUNC_8 on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, FILIAL, COD_CCUSTO, MATRICULA)
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
create index NATCORP.IND_INF_FUNC_9 on NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, FILIAL, MATRICULA, COD_CCUSTO)
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
create index NATCORP.IND_SITUACAO on NATCORP.INFORMACOES_FUNCIONAIS (SITUACAO)
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
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint PK_INF_FUNC primary key (COD_EMPRESA, MATRICULA);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint COD_INF_FUNC_EMPRESA foreign key (COD_EMPRESA)
  references NATCORP.EMPRESAS (COD);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint COD_SIT_FUNC foreign key (SITUACAO)
  references NATCORP.SIT_FUNC (COD);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_CARGO_IF foreign key (CARGO)
  references NATCORP.CARGOS (COD)
  disable
  novalidate;
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_CD_TIPO_MOVTO foreign key (COD_TP_MOVTO)
  references NATCORP.TIPO_MOVTO (COD_TP_MOVTO);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_COD_APOSENTADORIA foreign key (COD_APOSENTADORIA)
  references NATCORP.TIPO_APOSENTADORIA (COD_APOSENTADORIA);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_COD_CARGO_CIPA foreign key (COD_CARGO_CIPA)
  references NATCORP.CARGO_CIPA (COD_CARGO_CIPA);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_COD_CATEGORIA_FUNC foreign key (COD_CATEGORIA)
  references NATCORP.CATEGORIA_CARGO (COD);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_COD_CAT_GRP_SAL_FUNC foreign key (COD_CAT_GRUPOS_SALARIAIS)
  references NATCORP.CATEGORIA_GRUPOS_SALARIAIS (COD_CAT_GRUPOS_SALARIAIS);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_COD_CCUSTO_IF foreign key (COD_EMPRESA, COD_CCUSTO)
  references NATCORP.CENTRO_DE_CUSTO (COD_EMPRESA, COD);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_COD_TP_PAGTO foreign key (COD_TIPO_PAGTO)
  references NATCORP.TIPO_PAGAMENTO (COD_TIPO_PAGTO);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_EMPR_FIL foreign key (COD_EMPRESA, FILIAL)
  references NATCORP.FILIAIS (COD_EMPRESA, COD_FILIAL);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_FUNCAO foreign key (FUNCAO)
  references NATCORP.FUNCAO (COD);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_FUNC_PESS foreign key (COD_EMPRESA, MATRICULA)
  references NATCORP.INF_PESSOAIS (COD_EMPRESA, MATRICULA);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_IFFBANCO foreign key (BANCO)
  references NATCORP.BANCOS (COD_BANCO);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_IFFCD_NIVEL foreign key (CD_NIVEL)
  references NATCORP.ORGANIZACAO (CD_NIVEL);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_IFFCODIGO_PLANO foreign key (CODIGO_PLANO)
  references NATCORP.PLANO_MEDICO (CODIGO_PLANO);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_IFFCODIGO_TIPO foreign key (CODIGO_TIPO)
  references NATCORP.TIPO_PLANO (CODIGO_TIPO);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_IFFCOD_GRUPO_TRABALHO foreign key (COD_GRUPO_TRABALHO)
  references NATCORP.PE_GRUPOS (COD_GRUPO);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_IFFCOD_PLANO2 foreign key (CODIGO_PLANO2)
  references NATCORP.PLANO_MEDICO (CODIGO_PLANO);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_IFFCOD_SITUACAO_PREV foreign key (COD_SITUACAO_PREV)
  references NATCORP.SITUACAO_PREVIDENCIA (COD_SITUACAO_PREV);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_IFFNUM_SIND_CAT foreign key (COD_EMPRESA, NUM_SIND_CAT)
  references NATCORP.SINDICATOS (COD_EMPRESA, COD);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_IFFNUM_SIND_DISS foreign key (COD_EMPRESA, NUM_SIND_DISS)
  references NATCORP.SINDICATOS (COD_EMPRESA, COD);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_IFFTIPO_ATS foreign key (TIPO_ATS)
  references NATCORP.TIPO_ATS (COD);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_IFFTIPO_PLANO2 foreign key (CODIGO_TIPO2)
  references NATCORP.TIPO_PLANO (CODIGO_TIPO);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_IF_CARREIRA_PUBLICA foreign key (COD_EMPRESA, CODCARREIRA)
  references NATCORP.CARREIRA_PUBLICA (COD_EMPRESA, CODCARREIRA);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_INF_FUNC foreign key (COD_EMPRESA, MATRICULA)
  references NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, MATRICULA);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_INF_FUNCIONAIS_TPTRANSBCA foreign key (COD_TP_TRANS_BCA)
  references NATCORP.TIPO_TRANSACAO_BANCARIA (COD);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_INF_FUNC_EMP_REG_TRAB foreign key (COD_EMPRESA, REG_TRAB)
  references NATCORP.REG_TRABALHO (COD_EMPRESA, COD);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_LOCAL_TRABALHO foreign key (COD_LOCALIZACAO)
  references NATCORP.LOCAL_TRAB (COD_LOCAL_TRAB);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_MOTIVO_ALTERACOES01 foreign key (MOT_ALT_FUNCAO)
  references NATCORP.MOTIVO_ALTERACOES (COD);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_MOTIVO_ALTERACOES02 foreign key (MOT_ALT_CARGO)
  references NATCORP.MOTIVO_ALTERACOES (COD);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_MOTIVO_ALTERACOES03 foreign key (MOT_ALT_SAL)
  references NATCORP.MOTIVO_ALTERACOES (COD);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_MOTIVO_ALTERACOES04 foreign key (MOT_ALT_SITUACAO)
  references NATCORP.MOTIVO_ALTERACOES (COD);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_MOTIVO_ALTERACOES05 foreign key (MOT_ALT_CENTRO)
  references NATCORP.MOTIVO_ALTERACOES (COD);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_MOTIVO_ALTERACOES06 foreign key (MOT_ALT_REG_TRAB)
  references NATCORP.MOTIVO_ALTERACOES (COD);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_MOTIVO_ALTERACOES07 foreign key (MOT_ALT_FILIAL)
  references NATCORP.MOTIVO_ALTERACOES (COD);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_MOTIVO_ALTERACOES08 foreign key (MOT_ALT_HORARIO)
  references NATCORP.MOTIVO_ALTERACOES (COD);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_MOT_ALT_NOVA_SIT foreign key (MOT_ALT_NOVA_SIT)
  references NATCORP.MOTIVO_ALTERACOES (COD);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_TIPO_SALARIO01 foreign key (TIPO_SALARIO)
  references NATCORP.TIPO_SALARIO (COD);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_TIPO_VINC_EMPREG foreign key (TIPO_VINCULO_EMPREG)
  references NATCORP.TIPO_VINCULO_EMPREG (COD);
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint FK_VINCULO foreign key (VINCULO)
  references NATCORP.VINCULO_EMPREG (COD);
-- Create/Recreate check constraints 
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CHK_TIPO_ADESAO
  check (TIPO_ADESAO IN (NULL, 0, 1));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_ADTO_SALARIAL
  check (ADTO_SALARIAL IN('S','N'));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_COD_TIPO_MAO_OBRA
  check (COD_TIPO_MAO_OBRA IN('I','D'));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_CONTR_PRZ_DET
  check (ind_contrato_prz_determinado IN('D','I','P','F'));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_ESTAT_INDPROVIM
  check (estat_indprovim IN(1,2,3));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_ESTAT_TPPROV
  check (ESTAT_TPPROV IN (1, 2, 3, 4, 5, 6, 7,8, 9,10, 99));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_IFFCOD_COMPLEM_PANO2
  check (COD_COMPLEMENTO_PLANO2 IN ('1','2,','3','4','5'));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_IFFCOD_COMPLEM_PLANO
  check (COD_COMPLEMENTO_PLANO IN ('1','2,','3','4','5'));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_IFFPENOSIDADE
  check (PENOSIDADE IN ('S','N'));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_IFFTIPO_MODALIDADE
  check (TIPO_MODALIDADE IN ('P','S','H','T'));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_IFFTP_REGISTRO_PONTO
  check (TP_REGISTRO_PONTO IN ('A','F','M'));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_IF_MOT_CALC_AV_PREVIO
  check (mot_canc_av_previo IN(1, 2, 3, 9));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_IF_TP_AV_PREVIO
  check (tp_av_previo IN(1, 2, 3, 4));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_IND_APOSENTADO
  check (IND_APOSENTADO IN('S','N'));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_IND_CONTR_SINDICAL
  check (IND_CONTR_SINDICAL IN('S','N'));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_IND_TMP_PARCIAL
  check (IND_TMP_PARCIAL IN  ('0','1','2','3'));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_INF_FUNC_REQUEREU_SD
  check (REQUEREU_SD IN('S','N'));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_INF_FUNC_TPPLANRP
  check (TPPLANRP IN(1,2));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_ISENCAO_IAPAS
  check (ISENCAO_IAPAS IN('S','N'));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_ISENCAO_IR
  check (ISENCAO_IR IN('S','N'));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_OPCAO_FGTS
  check (OPCAO_FGTS IN('S','N'));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_OPCAO_VALE_TRANSPORTE
  check (OPCAO_VALE_TRANSPORTE IN('S','N'));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_OPC_CONVENIOS_DIVERSOS
  check (OPC_CONVENIOS_DIVERSOS IN ('S', 'N'));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_OPC_CONVENIOS_DIVERSOS_FUNC
  check (OPC_CONVENIOS_DIVERSOS IN('S','N'));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_OPC_TICKET_COMPRA
  check (OPC_TICKET_COMPRA IN('S','N'));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_PERC_RED_CARGA_HOR
  check (percent_reducao_carga_horaria in (25,50,70));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_QUALIFICACAO_FUNCIONARIO
  check (QUALIFICACAO_FUNCIONARIO IN('A','P'));
alter table NATCORP.INFORMACOES_FUNCIONAIS
  add constraint CK_SINDICALIZADO
  check (SINDICALIZADO IN('S','N'));
