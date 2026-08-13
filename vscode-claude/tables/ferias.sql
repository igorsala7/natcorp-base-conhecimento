-- Create table
create table NATCORP.FERIAS
(
  cod_empresa              NUMBER(3) not null,
  matricula                NUMBER(32) not null,
  dc_matricula             NUMBER(1) not null,
  num_dias_parc1           NUMBER(2),
  opcao_13sal1             VARCHAR2(1),
  opcao_abono_pec1         VARCHAR2(1),
  dt_saida_parc1           DATE,
  dt_inic_per_ferias       DATE not null,
  dt_fim_per_ferias        DATE not null,
  opcao_abono_pec2         VARCHAR2(1),
  opcao_13sal2             VARCHAR2(1),
  dt_saida_parc2           DATE,
  usuario                  VARCHAR2(30),
  dt_atualizacao           DATE,
  dias_abono_pec1          NUMBER(2),
  dias_abono_pec2          NUMBER(2),
  num_dias_parc2           NUMBER(2),
  ind_dif_ferias           VARCHAR2(1),
  dt_retorno_parc1         DATE,
  dt_retorno_parc2         DATE,
  saldo                    NUMBER(4,1) not null,
  falta_hora               NUMBER(4),
  falta_minuto             NUMBER(2),
  salario_ferias           NUMBER(15,2),
  salario_ferias_anterior  NUMBER(15,2),
  ind_situacao_periodo     VARCHAR2(1) not null,
  tipo_ferias1             VARCHAR2(1),
  tipo_ferias2             VARCHAR2(1),
  ind_situacao_parc_1      VARCHAR2(1),
  ind_situacao_parc_2      VARCHAR2(1),
  dt_retorno_col1          DATE,
  dt_retorno_col2          DATE,
  saldo_dev                NUMBER(4,1),
  cd_nivel                 NUMBER(10),
  dt_saida_parc3           DATE,
  num_dias_parc3           NUMBER(2),
  dt_retorno_parc3         DATE,
  tipo_ferias3             VARCHAR2(1),
  saldo_bruto              NUMBER(4,1) not null,
  dias_descanso_adicional  NUMBER(2),
  desc_adicional1          NUMBER(2),
  desc_adicional2          NUMBER(2),
  usuario_prog             VARCHAR2(30),
  dt_atualizacao_prog      DATE,
  cod_solicitacao          NUMBER(7),
  usuario_calc             VARCHAR2(30),
  dt_atualizacao_calc      DATE,
  dt_solicitacao           DATE,
  matricula_solicitante    NUMBER(32),
  desconsidera_faltas      VARCHAR2(1) not null,
  usuario_prog2            VARCHAR2(30),
  dt_atualizacao_prog2     DATE,
  usuario_prog_col         VARCHAR2(30),
  dt_atualizacao_prog_col  DATE,
  falta_hora_orig          NUMBER(4),
  dt_pagto_parc1           DATE,
  dt_pagto_parc2           DATE,
  observacoes              VARCHAR2(3000),
  dt_retorno_parc1_prorrog DATE,
  dt_retorno_parc2_prorrog DATE,
  reintegracao             VARCHAR2(1) default 'N' not null,
  num_dias_parc4           NUMBER(2),
  opcao_13sal4             VARCHAR2(1),
  opcao_abono_pec4         VARCHAR2(1),
  dt_saida_parc4           DATE,
  dias_abono_pec4          NUMBER(2),
  dt_retorno_parc4         DATE,
  tipo_ferias4             VARCHAR2(1),
  dt_pagto_parc4           DATE,
  dt_retorno_parc4_prorrog DATE,
  desc_adicional4          NUMBER(2),
  dt_retorno_col4          DATE,
  ind_situacao_parc_4      VARCHAR2(1),
  opcao_ferias             NUMBER(3),
  usuario_prog4            VARCHAR2(30),
  dt_atualizacao_prog4     DATE,
  origem                   VARCHAR2(50)
)
tablespace TSPACE_NATCORP
  pctfree 10
  initrans 1
  maxtrans 255
  storage
  (
    initial 15M
    next 1M
    minextents 1
    maxextents unlimited
  );
-- Add comments to the columns 
comment on column NATCORP.FERIAS.cod_empresa
  is 'Codigo  empresa de trabalho';
comment on column NATCORP.FERIAS.matricula
  is 'Funcionario a ser tratado';
comment on column NATCORP.FERIAS.dc_matricula
  is 'Digito de controle matricula';
comment on column NATCORP.FERIAS.num_dias_parc1
  is 'Num. De Dias de Gozo Parc 1';
comment on column NATCORP.FERIAS.opcao_13sal1
  is '1? Salario 1? parc(S/N)';
comment on column NATCORP.FERIAS.opcao_abono_pec1
  is 'Abono pecuniario 1? parc.(S/N)';
comment on column NATCORP.FERIAS.dt_saida_parc1
  is 'Data de saida da 1? parcela';
comment on column NATCORP.FERIAS.dt_inic_per_ferias
  is 'Data inicio periodo de ferias';
comment on column NATCORP.FERIAS.dt_fim_per_ferias
  is 'OPCAO_ABONO_PEC2';
comment on column NATCORP.FERIAS.opcao_abono_pec2
  is 'Abono pecuniario 2? parc.(S/N)';
comment on column NATCORP.FERIAS.opcao_13sal2
  is '13? Salario 2? parc. (S/N)';
comment on column NATCORP.FERIAS.dt_saida_parc2
  is 'Data de saida da 2? parcela';
comment on column NATCORP.FERIAS.usuario
  is 'Usuario';
comment on column NATCORP.FERIAS.dt_atualizacao
  is 'Data de atualizac?o';
comment on column NATCORP.FERIAS.dias_abono_pec1
  is 'Dias de Abono Prim.Periodo';
comment on column NATCORP.FERIAS.dias_abono_pec2
  is 'Dias de Abono Seg. Periodo';
comment on column NATCORP.FERIAS.num_dias_parc2
  is 'Num. De Dias de Gozo Parc 2';
comment on column NATCORP.FERIAS.ind_dif_ferias
  is 'Ind.Pagto Dif. Ferias (S / N)';
comment on column NATCORP.FERIAS.dt_retorno_parc1
  is 'Data de Retorno Parc 1';
comment on column NATCORP.FERIAS.dt_retorno_parc2
  is 'Data de Retorno Parc 2';
comment on column NATCORP.FERIAS.saldo
  is 'Saldo de Ferias';
comment on column NATCORP.FERIAS.falta_hora
  is 'Quant. De Horas de Faltas';
comment on column NATCORP.FERIAS.falta_minuto
  is 'Quant. De Minutos de Faltas';
comment on column NATCORP.FERIAS.salario_ferias
  is 'Salario de Ferias';
comment on column NATCORP.FERIAS.salario_ferias_anterior
  is 'Salario de Ferias Anterior';
comment on column NATCORP.FERIAS.ind_situacao_periodo
  is 'Ind. Situacao do Periodo de Ferias';
comment on column NATCORP.FERIAS.tipo_ferias1
  is 'Tipo de Ferias Parc. 1';
comment on column NATCORP.FERIAS.tipo_ferias2
  is 'Tipo de Ferias Parc. 2';
comment on column NATCORP.FERIAS.ind_situacao_parc_1
  is 'Tipo de Ferias Parc. 2';
comment on column NATCORP.FERIAS.ind_situacao_parc_2
  is 'Ind. Situac?o Parcela 2';
comment on column NATCORP.FERIAS.dt_retorno_col1
  is 'Data de Retorno Fer. Parc 1';
comment on column NATCORP.FERIAS.dt_retorno_col2
  is 'Data de Retorno Fer. Parc 2';
comment on column NATCORP.FERIAS.saldo_dev
  is 'Saldo Devedor';
comment on column NATCORP.FERIAS.cd_nivel
  is 'Codigo do Nivel';
comment on column NATCORP.FERIAS.dt_saida_parc3
  is 'Data saida gozo ferias col.';
comment on column NATCORP.FERIAS.num_dias_parc3
  is 'Data retorno  gozo ferias col.';
comment on column NATCORP.FERIAS.tipo_ferias3
  is 'Tipo C (Coletivas)';
comment on column NATCORP.FERIAS.saldo_bruto
  is 'Saldo de ferias s/ faltas';
-- Create/Recreate indexes 
create index NATCORP.IDX_FERIAS1 on NATCORP.FERIAS (COD_EMPRESA, MATRICULA)
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
create index NATCORP.IDX_FERIAS2 on NATCORP.FERIAS (COD_EMPRESA, MATRICULA, IND_SITUACAO_PERIODO)
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
alter table NATCORP.FERIAS
  add constraint FK_FER_CD_NIVEL foreign key (CD_NIVEL)
  references NATCORP.ORGANIZACAO (CD_NIVEL);
alter table NATCORP.FERIAS
  add constraint FK_FER_EMP foreign key (COD_EMPRESA)
  references NATCORP.EMPRESAS (COD);
alter table NATCORP.FERIAS
  add constraint FK_FER_EMP_MAT foreign key (COD_EMPRESA, MATRICULA)
  references NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, MATRICULA);
-- Create/Recreate check constraints 
alter table NATCORP.FERIAS
  add constraint CK_REINTEGRACAO
  check (REINTEGRACAO IN('S','N'));
alter table NATCORP.FERIAS
  add constraint FK_FER_DESCONSIDERA_FALTAS
  check (DESCONSIDERA_FALTAS IN ('S','N'));
alter table NATCORP.FERIAS
  add constraint FK_FER_IND_DIF_FERIAS
  check (IND_DIF_FERIAS IN ('S','N'));
alter table NATCORP.FERIAS
  add constraint FK_FER_IND_SITUACAO_PARC_1
  check (IND_SITUACAO_PARC_1 IN ('C'));
alter table NATCORP.FERIAS
  add constraint FK_FER_IND_SITUACAO_PARC_2
  check (IND_SITUACAO_PARC_2 IN ('C'));
alter table NATCORP.FERIAS
  add constraint FK_FER_OPCAO_13SAL1
  check (OPCAO_13SAL1 IN ('S','N'));
alter table NATCORP.FERIAS
  add constraint FK_FER_OPCAO_13SAL2
  check (OPCAO_13SAL2 IN ('S','N'));
alter table NATCORP.FERIAS
  add constraint FK_FER_OPCAO_ABONO_PEC1
  check (OPCAO_ABONO_PEC1 IN ('S','N'));
alter table NATCORP.FERIAS
  add constraint FK_FER_OPCAO_ABONO_PEC2
  check (OPCAO_ABONO_PEC2 IN ('S','N'));
