-- Create table
create table NATCORP.CENTRO_DE_CUSTO
(
  cod_empresa            NUMBER(3) not null,
  cod                    NUMBER(10) not null,
  cod_dc                 NUMBER(1) not null,
  nome                   VARCHAR2(70) not null,
  sigla                  VARCHAR2(5) not null,
  cod_ccusto_cont        VARCHAR2(20) not null,
  ddd                    VARCHAR2(4),
  fone                   NUMBER(10),
  ramal1                 VARCHAR2(5),
  ramal2                 VARCHAR2(5),
  entra_lista            VARCHAR2(1),
  asit                   VARCHAR2(1),
  usuario                VARCHAR2(30),
  dt_atualizacao         DATE,
  cod_localizacao        VARCHAR2(10) not null,
  perc_insalub           NUMBER(6,3),
  cod_un_negocio         NUMBER(11) not null,
  cod_ccusto_adm         NUMBER(11) not null,
  cd_nivel               VARCHAR2(15),
  cd_nivel_superior      VARCHAR2(15),
  matricula_gestor       NUMBER(32),
  matricula_suplente     NUMBER(32),
  ind_staff_linha        VARCHAR2(1),
  ind_produtivo_administ VARCHAR2(1),
  cod_ccusto_superior    NUMBER(10),
  class_ccusto           VARCHAR2(2) not null,
  dt_inic_vige           DATE,
  dt_fim_vige            DATE,
  cod_tipo_unid          NUMBER(2),
  cod_emp_gestor         NUMBER(3),
  cod_emp_suplente       NUMBER(3),
  cod_matricula_suplente NUMBER
)
tablespace TSPACE_NATCORP
  pctfree 10
  initrans 1
  maxtrans 255
  storage
  (
    initial 448K
    next 1M
    minextents 1
    maxextents unlimited
  );
-- Add comments to the columns 
comment on column NATCORP.CENTRO_DE_CUSTO.cod_empresa
  is 'Empresa - Código da empresa.';
comment on column NATCORP.CENTRO_DE_CUSTO.cod
  is 'C. custo - Campo de Preenchimento Automático. E possível ver o código de todo os centro de custo relacionado com a Empresa / Classificação de Centro de Custo.';
comment on column NATCORP.CENTRO_DE_CUSTO.cod_dc
  is 'Digito de controle do codigo';
comment on column NATCORP.CENTRO_DE_CUSTO.nome
  is 'Nome - Campo de Preenchimento Automático. E possível ver o código de todos os centros de custos relacionados com a Empresa / Classificação de Centro de Custo.';
comment on column NATCORP.CENTRO_DE_CUSTO.sigla
  is 'Sigla - Sigla para o centro de custo hierárquico.';
comment on column NATCORP.CENTRO_DE_CUSTO.cod_ccusto_cont
  is 'Contábil - Código do centro de custo contábil que já deverá estar cadastrada na aplicação F010320.';
comment on column NATCORP.CENTRO_DE_CUSTO.ddd
  is 'DDD - DDD do telefone da localização do centro de custo.';
comment on column NATCORP.CENTRO_DE_CUSTO.fone
  is 'Fone - Telefone da localização do centro de custo.';
comment on column NATCORP.CENTRO_DE_CUSTO.ramal1
  is 'Nr. ramal centro de custo';
comment on column NATCORP.CENTRO_DE_CUSTO.ramal2
  is 'Nr. ramal centro de custo';
comment on column NATCORP.CENTRO_DE_CUSTO.entra_lista
  is 'Entra Lista Telefônica - Indica se flegar neste item, indicará que esses dados irão para lista telefônica.';
comment on column NATCORP.CENTRO_DE_CUSTO.cod_localizacao
  is 'Código - Código do local de trabalho que já deverá estar cadastrada na aplicação F011105.';
comment on column NATCORP.CENTRO_DE_CUSTO.perc_insalub
  is '% de Insalubridade do CCusto';
comment on column NATCORP.CENTRO_DE_CUSTO.cod_un_negocio
  is 'Unidade de Negócio - Código da unidade de negócio que já deverá estar cadastrada na aplicação F010200.';
comment on column NATCORP.CENTRO_DE_CUSTO.cod_ccusto_adm
  is 'Administrativo - Código administrativo que já deverá estar cadastrada na aplicação F010330.';
comment on column NATCORP.CENTRO_DE_CUSTO.cd_nivel
  is 'Nível - Qual nível que deverá vir preenchido da aplicação f010205 e que será alocado neste centro de custo hierárquico.';
comment on column NATCORP.CENTRO_DE_CUSTO.cd_nivel_superior
  is 'Cod. do Nivel do Ccusto Super.';
comment on column NATCORP.CENTRO_DE_CUSTO.matricula_gestor
  is 'Gestor.';
comment on column NATCORP.CENTRO_DE_CUSTO.matricula_suplente
  is 'Suplente.';
comment on column NATCORP.CENTRO_DE_CUSTO.ind_staff_linha
  is 'Ind. de Posic?o Hierarq.(S/L)';
comment on column NATCORP.CENTRO_DE_CUSTO.ind_produtivo_administ
  is 'Indica se o centro de custo e Adm. ou Produtivo ou Isento';
comment on column NATCORP.CENTRO_DE_CUSTO.cod_ccusto_superior
  is 'Superior - Centro de custo superior ao centro de custo que está sendo criado este centro de custo já deverá estar criado nesta aplicação.';
comment on column NATCORP.CENTRO_DE_CUSTO.class_ccusto
  is 'Class. Ccusto - Código da classificação do centro de custo que já deverá estar cadastrada na aplicação FP10409.';
comment on column NATCORP.CENTRO_DE_CUSTO.dt_inic_vige
  is 'Vigência Inicial - Vigência inicial para o centro de custo hierárquico.';
comment on column NATCORP.CENTRO_DE_CUSTO.dt_fim_vige
  is 'Vigência Final - Vigência final para o centro de custo hierárquico deve se ter em mente que a partir da data final que colocar este centro de custo hierárquico não será mais visto por isto pedimos para sempre colocar uma data fim como exemplo 31122099 e quando realmente finalizar voltar nesta tela e colocar a data fim original.';
comment on column NATCORP.CENTRO_DE_CUSTO.cod_tipo_unid
  is 'Tipo Unidade - Tipo de unidade que já deverá estar cadastrada na aplicação F011505.';
comment on column NATCORP.CENTRO_DE_CUSTO.cod_emp_gestor
  is 'EMPRESA Gestor - Empresa do gestor.';
comment on column NATCORP.CENTRO_DE_CUSTO.cod_emp_suplente
  is 'Empresa Suplente - Empresa.';
-- Create/Recreate indexes 
create index NATCORP.IDX$$_2F190006 on NATCORP.CENTRO_DE_CUSTO (COD)
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
create index NATCORP.IDX_CCUSTO1 on NATCORP.CENTRO_DE_CUSTO (COD_EMPRESA, COD, CLASS_CCUSTO)
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
create index NATCORP.IDX_CCUSTO2 on NATCORP.CENTRO_DE_CUSTO (COD_EMPRESA, COD, DT_INIC_VIGE, DT_FIM_VIGE)
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
create index NATCORP.IDX_CCUSTO3 on NATCORP.CENTRO_DE_CUSTO (COD_EMPRESA, COD, COD_EMP_GESTOR, MATRICULA_GESTOR)
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
create index NATCORP.IDX_CCUSTO4 on NATCORP.CENTRO_DE_CUSTO (COD_EMPRESA, COD_CCUSTO_SUPERIOR, COD_EMP_GESTOR, MATRICULA_GESTOR)
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
create index NATCORP.IDX_CCUSTO5 on NATCORP.CENTRO_DE_CUSTO (COD_CCUSTO_SUPERIOR, COD_EMP_GESTOR, MATRICULA_GESTOR)
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
create index NATCORP.IDX_CCUSTO6 on NATCORP.CENTRO_DE_CUSTO (COD_EMPRESA, COD_CCUSTO_SUPERIOR)
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
alter table NATCORP.CENTRO_DE_CUSTO
  add constraint PK_CENTRO_DE_CUSTO primary key (COD_EMPRESA, COD)
  using index 
  tablespace TSPACE_NATCORP
  pctfree 10
  initrans 2
  maxtrans 255
  storage
  (
    initial 128K
    next 1M
    minextents 1
    maxextents unlimited
  );
alter table NATCORP.CENTRO_DE_CUSTO
  add constraint FK_CCUSTO_CCSUP foreign key (COD_EMPRESA, COD_CCUSTO_SUPERIOR)
  references NATCORP.CENTRO_DE_CUSTO (COD_EMPRESA, COD)
  disable
  novalidate;
alter table NATCORP.CENTRO_DE_CUSTO
  add constraint FK_CCUSTO_EMP foreign key (COD_EMPRESA)
  references NATCORP.EMPRESAS (COD);
alter table NATCORP.CENTRO_DE_CUSTO
  add constraint FK_CC_CCUSTO_CONTAB foreign key (COD_EMPRESA, COD_CCUSTO_CONT)
  references NATCORP.CCUSTO_CONTAB (COD_EMPRESA, COD);
alter table NATCORP.CENTRO_DE_CUSTO
  add constraint FK_CC_MAT_GESTOR foreign key (COD_EMP_GESTOR, MATRICULA_GESTOR)
  references NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, MATRICULA);
alter table NATCORP.CENTRO_DE_CUSTO
  add constraint FK_CC_MAT_SUPLENTE foreign key (COD_EMP_SUPLENTE, MATRICULA_SUPLENTE)
  references NATCORP.INFORMACOES_FUNCIONAIS (COD_EMPRESA, MATRICULA);
-- Create/Recreate check constraints 
alter table NATCORP.CENTRO_DE_CUSTO
  add constraint CK_PROD_ADM
  check (IND_PRODUTIVO_ADMINIST IN ('P', 'A'));
alter table NATCORP.CENTRO_DE_CUSTO
  add constraint CK_STAFF
  check (IND_STAFF_LINHA IN ('S', 'L'));
