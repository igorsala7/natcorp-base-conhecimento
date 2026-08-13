-- Create table
create table NATCORP.REQUISICAO_FERIAS
(
  cod_empresa              NUMBER(3) not null,
  matricula                NUMBER(32) not null,
  dc_matricula             NUMBER(1),
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
  saldo                    NUMBER(4,1),
  falta_hora               NUMBER(4),
  falta_minuto             NUMBER(2),
  salario_ferias           NUMBER(15,2),
  salario_ferias_anterior  NUMBER(15,2),
  ind_situacao_periodo     VARCHAR2(1),
  tipo_ferias1             VARCHAR2(1),
  tipo_ferias2             VARCHAR2(1),
  ind_situacao_parc_1      VARCHAR2(1),
  ind_situacao_parc_2      VARCHAR2(1),
  dt_retorno_col1          DATE,
  dt_retorno_col2          DATE,
  saldo_dev                NUMBER(4,1),
  cd_nivel                 NUMBER(10),
  dt_saida_parc3           DATE,
  dt_retorno_parc3         DATE,
  saldo_bruto              NUMBER(4,1),
  num_dias_parc3           NUMBER(2),
  tipo_ferias3             VARCHAR2(1),
  desc_adicional1          NUMBER(2),
  desc_adicional2          NUMBER(2),
  dias_descanso_adicional  NUMBER(2),
  dt_atualizacao_prog      DATE,
  usuario_prog             VARCHAR2(30),
  cod_solicitacao          NUMBER(10),
  dt_atualizacao_calc      DATE,
  usuario_calc             VARCHAR2(30),
  dt_solicitacao           DATE,
  matricula_solicitante    NUMBER(32),
  sit_requisicao           VARCHAR2(1),
  cod_sit_solicitacao      NUMBER(3),
  dt_sit_solicitacao       DATE,
  cod_sit_ferias           NUMBER(3),
  dt_sit_ferias            DATE,
  cod_emp_solicitante      NUMBER(3),
  dt_pagto_parc1           DATE,
  dt_pagto_parc2           DATE,
  observacao               VARCHAR2(3000),
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
  havera_rep               VARCHAR2(1),
  opcao_ferias             NUMBER(3),
  ind_situacao_parc_4      VARCHAR2(1)
)
tablespace TSPACE_NATCORP
  pctfree 10
  initrans 1
  maxtrans 255
  storage
  (
    initial 64K
    next 1M
    minextents 1
    maxextents unlimited
  );
-- Add comments to the columns 
comment on column NATCORP.REQUISICAO_FERIAS.observacao
  is 'Campo de observação';
-- Create/Recreate indexes 
create index NATCORP.IDX_REQ_FERIAS_COD_SOLIC on NATCORP.REQUISICAO_FERIAS (COD_SOLICITACAO)
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
create index NATCORP.ID_REQUISICAO_FERIAS on NATCORP.REQUISICAO_FERIAS (COD_EMPRESA, MATRICULA)
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
create index NATCORP.ID_REQUISICAO_FERIAS_2 on NATCORP.REQUISICAO_FERIAS (COD_EMPRESA, MATRICULA, COD_SOLICITACAO)
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
create index NATCORP.ID_REQUISICAO_FERIAS_3 on NATCORP.REQUISICAO_FERIAS (COD_EMPRESA, MATRICULA, COD_SOLICITACAO, SIT_REQUISICAO)
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
create index NATCORP.ID_REQUISICAO_FERIAS_4 on NATCORP.REQUISICAO_FERIAS (COD_EMPRESA, COD_SOLICITACAO, SIT_REQUISICAO)
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
