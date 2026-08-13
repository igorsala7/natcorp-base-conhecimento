-- Create table
create table NATCORP.INF_PESSOAIS
(
  tipo_sanguineo           VARCHAR2(2) default 'NI',
  fator_rh                 VARCHAR2(1),
  mes_inss                 NUMBER(2),
  ano_inss                 NUMBER(2),
  dt_nasc                  DATE not null,
  maioridade               VARCHAR2(1) default 'S' not null,
  nacionalidade            NUMBER(2) not null,
  uf_nacto                 VARCHAR2(2),
  naturalizacao            VARCHAR2(1),
  ano_chegada              NUMBER(4),
  sexo                     VARCHAR2(1) not null,
  estado_civil             VARCHAR2(1) not null,
  instrucao                VARCHAR2(2) not null,
  num_identidade           VARCHAR2(20),
  tipo_ident               VARCHAR2(1),
  emissao_ident            DATE,
  est_emis_ident           VARCHAR2(2),
  num_cart_prof            NUMBER(9) not null,
  mod_cart_prof            VARCHAR2(1) default 'U' not null,
  ser_cart_prof            VARCHAR2(5) not null,
  est_emis_prof            VARCHAR2(2) not null,
  num_tit_eleitor          NUMBER(15),
  zon_tit_eleitor          NUMBER(6),
  sec_tit_eleitor          NUMBER(6),
  dt_emis_eleitor          DATE,
  est_emis_titulo          VARCHAR2(2),
  num_pis_pasep            NUMBER(11),
  bco_pis_pasep            NUMBER(3) default 104,
  ag_pis_pasep             NUMBER(4),
  num_cpf                  NUMBER(9) not null,
  dc_cpf                   NUMBER(2) not null,
  cod_candidato            NUMBER(6),
  dc_candidato             NUMBER(1),
  peso                     NUMBER(4,1),
  altura                   NUMBER(3,2),
  dt_admissao              DATE not null,
  usuario                  VARCHAR2(30),
  dt_atualizacao           DATE,
  complemento_cep          NUMBER(3) not null,
  cod_empresa              NUMBER(3) not null,
  matricula                NUMBER(38) not null,
  dc_matricula             NUMBER(1) default 0 not null,
  nome                     VARCHAR2(70) not null,
  endereco                 VARCHAR2(100) not null,
  bairro                   VARCHAR2(80) not null,
  cidade                   VARCHAR2(80) not null,
  uf                       VARCHAR2(2) not null,
  cep                      NUMBER(5) not null,
  ddd                      VARCHAR2(4),
  telefone                 NUMBER(10),
  cod_orgao                NUMBER(10),
  num_calca                VARCHAR2(2),
  num_camisa               VARCHAR2(4),
  num_calcado              VARCHAR2(2),
  naturalidade             VARCHAR2(60) not null,
  certif_reserv            VARCHAR2(30),
  dt_opcao_pis             DATE,
  nome_pai                 VARCHAR2(70),
  nome_mae                 VARCHAR2(70) not null,
  cd_nivel                 NUMBER(10) default 1 not null,
  cod_formacao_escolar     VARCHAR2(2),
  numero                   NUMBER(5) not null,
  complem                  VARCHAR2(40),
  filial                   NUMBER(4) not null,
  cod_raca_cor             NUMBER(2) not null,
  org_emis_ident           VARCHAR2(10) default 'SSP',
  valid_cart_trab          DATE,
  num_registro             VARCHAR2(11),
  regiao                   VARCHAR2(20),
  sigla_cons_reg           NUMBER(3),
  tipo_visto               VARCHAR2(15),
  valid_ident_est          DATE,
  ind_def_fis              VARCHAR2(1) default 'N' not null,
  dt_emis_cart             DATE,
  cnh                      NUMBER(11),
  n_registro_cnh           NUMBER(11),
  categoria_cnh            VARCHAR2(5),
  dt_1_habilit_cnh         DATE,
  dt_emissao_cnh           DATE,
  dt_valid_cnh             DATE,
  e_mail                   VARCHAR2(50),
  titulacao                VARCHAR2(5),
  uf_cnh                   VARCHAR2(2),
  nome_funcao_reg          VARCHAR2(70),
  ind_def_fis_br           VARCHAR2(1),
  instrucao_new            VARCHAR2(2),
  ddd_cell                 VARCHAR2(4),
  telefone_celular         NUMBER(10),
  rais_ind_def_fisico      VARCHAR2(1) default 'N',
  rais_ind_def_auditiva    VARCHAR2(1) default 'N',
  rais_ind_def_visual      VARCHAR2(1) default 'N',
  rais_ind_def_mental      VARCHAR2(1) default 'N',
  rais_ind_def_multipla    VARCHAR2(1) default 'N',
  cod_solicitacao          NUMBER(10),
  nome_conjuge             VARCHAR2(70),
  num_cpf_mae              NUMBER(9),
  dc_cpf_mae               NUMBER(2),
  num_cpf_pai              NUMBER(9),
  dc_cpf_pai               NUMBER(2),
  num_cpf_conjuge          NUMBER(9),
  dc_cpf_conjuge           NUMBER(2),
  tipo_deficiencia         VARCHAR2(1),
  manequim                 VARCHAR2(15),
  cod_nacional_saude       VARCHAR2(15),
  dc_ident                 VARCHAR2(2),
  observacoes              VARCHAR2(4000),
  num_passaporte           VARCHAR2(30),
  emis_passaporte          VARCHAR2(30),
  uf_emis_passaporte       VARCHAR2(30),
  dt_emis_passaporte       DATE,
  dt_val_passaporte        DATE,
  pais_emis_passaporte     VARCHAR2(50),
  cidade_emis_titulo       VARCHAR2(60),
  dia_mes_chegada          VARCHAR2(5),
  cod_mun_cidade           NUMBER(7),
  cod_mun_naturalidade     NUMBER(7),
  pais_nascimento          NUMBER(3) default 105 not null,
  pais_nacionalidade       NUMBER(3) default 105 not null,
  reside_brasil            VARCHAR2(1) default 'S' not null,
  cod_postal               VARCHAR2(10),
  obs_deficiente           VARCHAR2(255),
  class_trab_estrang       NUMBER(2),
  nr_ric                   VARCHAR2(14),
  orgao_emis_ric           VARCHAR2(20),
  dt_emis_ric              DATE,
  dt_val_cons_reg          DATE,
  dt_emis_cons_reg         DATE,
  dt_alt_endereco          DATE,
  pais_residencia          NUMBER(3) not null,
  es2205                   DATE,
  foto                     BLOB,
  nome_social              VARCHAR2(70),
  infocota                 VARCHAR2(1) default 'N' not null,
  tipo_logradouro_es       VARCHAR2(4),
  tipo_logradouro          NUMBER(3),
  uf_ric                   VARCHAR2(2),
  cod_gera_esocial         NUMBER default 0,
  prefixo_ddi              NUMBER(5),
  rais_ind_def_intelectual VARCHAR2(1) default 'N' not null,
  dt_certidao              DATE,
  end_referencia           VARCHAR2(100),
  ddd_nextel               NUMBER(4),
  telefone_nextel          NUMBER(10),
  id_nextel                VARCHAR2(20),
  ramal_comercial          NUMBER(4),
  possui_socio             VARCHAR2(1) default 'N',
  ddd_comerc               NUMBER(4),
  telefone_comerc          NUMBER(10),
  tmpresid                 NUMBER(1)
)
tablespace TSPACE_NATCORP
  pctfree 10
  initrans 1
  maxtrans 255
  storage
  (
    initial 16M
    next 1M
    minextents 1
    maxextents unlimited
  );
-- Add comments to the columns 
comment on column NATCORP.INF_PESSOAIS.tipo_sanguineo
  is 'Tipo Sanguineo';
comment on column NATCORP.INF_PESSOAIS.fator_rh
  is 'Fator RH';
comment on column NATCORP.INF_PESSOAIS.mes_inss
  is 'Total Meses de Contribuição para o INSS';
comment on column NATCORP.INF_PESSOAIS.ano_inss
  is 'Total Anos de Contrib. INSS';
comment on column NATCORP.INF_PESSOAIS.dt_nasc
  is 'Data de Nascimento';
comment on column NATCORP.INF_PESSOAIS.maioridade
  is 'Indicador de Maioridade';
comment on column NATCORP.INF_PESSOAIS.nacionalidade
  is 'Nacionalidade do funcionário';
comment on column NATCORP.INF_PESSOAIS.uf_nacto
  is 'Estado Natal do funcionário';
comment on column NATCORP.INF_PESSOAIS.naturalizacao
  is 'Func.estrang.naturaliz.(S/N)';
comment on column NATCORP.INF_PESSOAIS.ano_chegada
  is 'Ano chegada ao pais para funcionários estrangeiros';
comment on column NATCORP.INF_PESSOAIS.sexo
  is 'Sexo do funcionário (M/F)';
comment on column NATCORP.INF_PESSOAIS.estado_civil
  is 'Estado civil do funcionário';
comment on column NATCORP.INF_PESSOAIS.instrucao
  is 'Grau de instrução do funcionário';
comment on column NATCORP.INF_PESSOAIS.num_identidade
  is 'Número do documento de identidade';
comment on column NATCORP.INF_PESSOAIS.tipo_ident
  is 'Tipo documento de identidade';
comment on column NATCORP.INF_PESSOAIS.emissao_ident
  is 'Data de emissão do documento de identidade';
comment on column NATCORP.INF_PESSOAIS.est_emis_ident
  is 'Estado de emissão do  documento de identidade';
comment on column NATCORP.INF_PESSOAIS.num_cart_prof
  is 'Número do documento da Carteria Profissional';
comment on column NATCORP.INF_PESSOAIS.mod_cart_prof
  is 'Tipo Sanguineo';
comment on column NATCORP.INF_PESSOAIS.ser_cart_prof
  is 'Série da carteira profissional';
comment on column NATCORP.INF_PESSOAIS.est_emis_prof
  is 'Estado de Emissão Carteira Profissional';
comment on column NATCORP.INF_PESSOAIS.num_tit_eleitor
  is 'Número do titulo de eleitor';
comment on column NATCORP.INF_PESSOAIS.zon_tit_eleitor
  is 'Zona eleitoral do titulo de eleitor';
comment on column NATCORP.INF_PESSOAIS.sec_tit_eleitor
  is 'Seção do titulo de eleitor';
comment on column NATCORP.INF_PESSOAIS.dt_emis_eleitor
  is 'Data emissão do titulo de eleitor';
comment on column NATCORP.INF_PESSOAIS.est_emis_titulo
  is 'Uf de emissão do titulo de eleitor';
comment on column NATCORP.INF_PESSOAIS.num_pis_pasep
  is 'Número do PIS/Pasep';
comment on column NATCORP.INF_PESSOAIS.bco_pis_pasep
  is 'Banco do Pis/Pasep';
comment on column NATCORP.INF_PESSOAIS.ag_pis_pasep
  is 'AG_PIS_PASEP';
comment on column NATCORP.INF_PESSOAIS.num_cpf
  is 'Número do CPF';
comment on column NATCORP.INF_PESSOAIS.dc_cpf
  is 'Digito verificador do CPF';
comment on column NATCORP.INF_PESSOAIS.cod_candidato
  is 'COD_CANDIDATO';
comment on column NATCORP.INF_PESSOAIS.dc_candidato
  is 'DC_CANDIDATO';
comment on column NATCORP.INF_PESSOAIS.peso
  is 'Peso do funcionário';
comment on column NATCORP.INF_PESSOAIS.altura
  is 'Altura do funcionário';
comment on column NATCORP.INF_PESSOAIS.dt_admissao
  is 'Data de admissão';
comment on column NATCORP.INF_PESSOAIS.usuario
  is 'Usuario de Carga';
comment on column NATCORP.INF_PESSOAIS.dt_atualizacao
  is 'Data Atualização';
comment on column NATCORP.INF_PESSOAIS.complemento_cep
  is 'Complemento do CEP';
comment on column NATCORP.INF_PESSOAIS.cod_empresa
  is 'Código  empresa de  trabalho.';
comment on column NATCORP.INF_PESSOAIS.matricula
  is 'Matricula do funcionário.';
comment on column NATCORP.INF_PESSOAIS.dc_matricula
  is 'Digito verificador da matrícula do funcionário.';
comment on column NATCORP.INF_PESSOAIS.nome
  is 'Nome do funcionário';
comment on column NATCORP.INF_PESSOAIS.endereco
  is 'Endereco do funcionário';
comment on column NATCORP.INF_PESSOAIS.bairro
  is 'Bairro onde mora o funcionário';
comment on column NATCORP.INF_PESSOAIS.cidade
  is 'Cidade onde mora o funcionário';
comment on column NATCORP.INF_PESSOAIS.uf
  is 'Estado onde mora  funcionário';
comment on column NATCORP.INF_PESSOAIS.cep
  is 'Cep da localidade';
comment on column NATCORP.INF_PESSOAIS.ddd
  is 'DDD da telefone do funcionário';
comment on column NATCORP.INF_PESSOAIS.telefone
  is 'Número do Telefone';
comment on column NATCORP.INF_PESSOAIS.cod_orgao
  is 'Codigo do Org?o';
comment on column NATCORP.INF_PESSOAIS.num_calca
  is 'Número da Calça';
comment on column NATCORP.INF_PESSOAIS.num_camisa
  is 'Número da Camisa';
comment on column NATCORP.INF_PESSOAIS.num_calcado
  is 'Número de Calçado';
comment on column NATCORP.INF_PESSOAIS.naturalidade
  is 'Naturalidade';
comment on column NATCORP.INF_PESSOAIS.certif_reserv
  is 'Certificado de reservista';
comment on column NATCORP.INF_PESSOAIS.dt_opcao_pis
  is 'Data de Opcao do Pis';
comment on column NATCORP.INF_PESSOAIS.nome_pai
  is 'Nome do Pai';
comment on column NATCORP.INF_PESSOAIS.nome_mae
  is 'Nome da Mãe';
comment on column NATCORP.INF_PESSOAIS.cd_nivel
  is 'Codigo do Nivel';
comment on column NATCORP.INF_PESSOAIS.cod_formacao_escolar
  is 'Cód. da Formação Escolar';
comment on column NATCORP.INF_PESSOAIS.numero
  is 'Número do Endereço do Funcionário';
comment on column NATCORP.INF_PESSOAIS.complem
  is 'Complemento do Endereço do Func.';
comment on column NATCORP.INF_PESSOAIS.filial
  is 'Código da Filial do Funcionário';
comment on column NATCORP.INF_PESSOAIS.cod_raca_cor
  is 'Grupo étnico ao qual o funcionário pertence';
comment on column NATCORP.INF_PESSOAIS.org_emis_ident
  is 'Órgão Emissor do documento de identidade';
comment on column NATCORP.INF_PESSOAIS.valid_cart_trab
  is 'Validade carteira de trabalho do funcionário estrangeiro';
comment on column NATCORP.INF_PESSOAIS.num_registro
  is 'Número Registro (no Conselho Regional)';
comment on column NATCORP.INF_PESSOAIS.regiao
  is 'Região do Conselho Regional';
comment on column NATCORP.INF_PESSOAIS.sigla_cons_reg
  is 'Sigla Conselho Regional';
comment on column NATCORP.INF_PESSOAIS.tipo_visto
  is 'Tipo de Visto';
comment on column NATCORP.INF_PESSOAIS.valid_ident_est
  is 'Validade do documento de Identidade do funcionário estrangeiro';
comment on column NATCORP.INF_PESSOAIS.ind_def_fis
  is 'Indicador de Portador de necessidades especiais';
comment on column NATCORP.INF_PESSOAIS.dt_emis_cart
  is 'Data de emissão da carteira de trabalho';
comment on column NATCORP.INF_PESSOAIS.cnh
  is 'Carteira Nacional de motorista';
comment on column NATCORP.INF_PESSOAIS.n_registro_cnh
  is 'Número do Registro Nacional de motorista';
comment on column NATCORP.INF_PESSOAIS.categoria_cnh
  is 'Categoria da Carteira Nac. Motorista';
comment on column NATCORP.INF_PESSOAIS.dt_1_habilit_cnh
  is 'Data 1­ª Carteira de Motorista';
comment on column NATCORP.INF_PESSOAIS.dt_emissao_cnh
  is 'Data de Emissão da Carteira de Motorista';
comment on column NATCORP.INF_PESSOAIS.dt_valid_cnh
  is 'Data de Validade da Carteira de Motorista';
comment on column NATCORP.INF_PESSOAIS.e_mail
  is 'Email Pessoal do funcioário';
comment on column NATCORP.INF_PESSOAIS.titulacao
  is 'TITULAÇÃO';
comment on column NATCORP.INF_PESSOAIS.uf_cnh
  is 'Estado de emissão da Carteira de motorista';
comment on column NATCORP.INF_PESSOAIS.nome_funcao_reg
  is 'Nome da função regulamentada (EX.médico, advogado , administrador)';
comment on column NATCORP.INF_PESSOAIS.ind_def_fis_br
  is 'Indicador de Reabilitação de funcionário ';
comment on column NATCORP.INF_PESSOAIS.instrucao_new
  is 'Novo codigo de instrução';
comment on column NATCORP.INF_PESSOAIS.ddd_cell
  is 'DDD da telefone celular do funcionário';
comment on column NATCORP.INF_PESSOAIS.telefone_celular
  is 'Telefone celular do funcionário';
comment on column NATCORP.INF_PESSOAIS.rais_ind_def_fisico
  is 'Indicador de deficiencia Física';
comment on column NATCORP.INF_PESSOAIS.rais_ind_def_auditiva
  is 'Indicador de deficiencia Auditiva';
comment on column NATCORP.INF_PESSOAIS.rais_ind_def_visual
  is 'Indicador de deficiencia Visual';
comment on column NATCORP.INF_PESSOAIS.rais_ind_def_mental
  is 'Indicador de deficiencia Mental';
comment on column NATCORP.INF_PESSOAIS.rais_ind_def_multipla
  is 'Indicador de deficiencia Multipla';
comment on column NATCORP.INF_PESSOAIS.cod_solicitacao
  is 'Codigo da solicitação de admissão (requisição)';
comment on column NATCORP.INF_PESSOAIS.nome_conjuge
  is 'Nome do Conjuge';
comment on column NATCORP.INF_PESSOAIS.num_cpf_mae
  is 'Número do CPF da mãe';
comment on column NATCORP.INF_PESSOAIS.dc_cpf_mae
  is 'Digito verificador do CPF Mae';
comment on column NATCORP.INF_PESSOAIS.num_cpf_pai
  is 'Número do CPF do pai';
comment on column NATCORP.INF_PESSOAIS.dc_cpf_pai
  is 'Digito verificador do CPF Pai';
comment on column NATCORP.INF_PESSOAIS.num_cpf_conjuge
  is 'Número do CPF do cônjuge';
comment on column NATCORP.INF_PESSOAIS.dc_cpf_conjuge
  is 'Digito verificador do CPF Conjuge';
comment on column NATCORP.INF_PESSOAIS.tipo_deficiencia
  is 'Tipo de deficiencia (campo não esta sendo utilizado)';
comment on column NATCORP.INF_PESSOAIS.manequim
  is 'Número do Manequin do funcionario ';
comment on column NATCORP.INF_PESSOAIS.cod_nacional_saude
  is 'Número do Cadastro Nacional de Saúde';
comment on column NATCORP.INF_PESSOAIS.dc_ident
  is 'Digito de Controle do documento de Identidade';
comment on column NATCORP.INF_PESSOAIS.observacoes
  is 'OBSERVACOES';
comment on column NATCORP.INF_PESSOAIS.num_passaporte
  is 'Número do Passaporte';
comment on column NATCORP.INF_PESSOAIS.emis_passaporte
  is 'Órgão Emissor do Passaporte';
comment on column NATCORP.INF_PESSOAIS.uf_emis_passaporte
  is 'UF da emissão do Passaporte.';
comment on column NATCORP.INF_PESSOAIS.dt_emis_passaporte
  is 'Data de emissão do Passaporte';
comment on column NATCORP.INF_PESSOAIS.dt_val_passaporte
  is 'Data de Validade do Passaporte';
comment on column NATCORP.INF_PESSOAIS.pais_emis_passaporte
  is 'País de emissão do Passaporte';
comment on column NATCORP.INF_PESSOAIS.cidade_emis_titulo
  is 'Cidade de Emissão do Título de Eleitor';
comment on column NATCORP.INF_PESSOAIS.dia_mes_chegada
  is 'Dia e Mês de chegada de estrangeiro no Brasil';
comment on column NATCORP.INF_PESSOAIS.cod_mun_cidade
  is 'Código de Município do Endereço, conforme tabela do IBGE';
comment on column NATCORP.INF_PESSOAIS.cod_mun_naturalidade
  is 'Código de Município de Nascimento, conforme tabela do IBGE';
comment on column NATCORP.INF_PESSOAIS.pais_nascimento
  is 'Código do Páis de Nascimento, conforme tabela 6 do eSocial.';
comment on column NATCORP.INF_PESSOAIS.pais_nacionalidade
  is 'Código do Páis de Nacionalidade, conforme tabela 6 do eSocial.';
comment on column NATCORP.INF_PESSOAIS.reside_brasil
  is 'Informe se o trabalhador reside no Brasil.';
comment on column NATCORP.INF_PESSOAIS.cod_postal
  is 'Código Postal, em casos de endereços fora do Brasil.';
comment on column NATCORP.INF_PESSOAIS.obs_deficiente
  is 'Observações para a deficiência.';
comment on column NATCORP.INF_PESSOAIS.class_trab_estrang
  is 'Classificação da condição do trabalhador estrangeiro no Brasil.';
comment on column NATCORP.INF_PESSOAIS.nr_ric
  is 'Número do Registro Individual do Contribuinte.';
comment on column NATCORP.INF_PESSOAIS.orgao_emis_ric
  is 'Orgão emissor do RIC.';
comment on column NATCORP.INF_PESSOAIS.dt_emis_ric
  is 'Data emissão do RIC.';
comment on column NATCORP.INF_PESSOAIS.dt_val_cons_reg
  is 'Data de Validade do Conselho de Classe (Ex.: CRM, OAB, etc).';
comment on column NATCORP.INF_PESSOAIS.dt_emis_cons_reg
  is 'Data de Emissão do Conselho de Classe.';
comment on column NATCORP.INF_PESSOAIS.dt_alt_endereco
  is 'Data de alteração do endereço residencial.';
comment on column NATCORP.INF_PESSOAIS.pais_residencia
  is 'Código do País de residência, conforme tabela 6 do eSocial.';
comment on column NATCORP.INF_PESSOAIS.es2205
  is 'Instrução do Esocial';
comment on column NATCORP.INF_PESSOAIS.nome_social
  is 'Nome Social';
comment on column NATCORP.INF_PESSOAIS.infocota
  is 'Se colaborador pertence a cota de PCD';
comment on column NATCORP.INF_PESSOAIS.tipo_logradouro_es
  is 'Tipo_logradouro para o Esocial';
comment on column NATCORP.INF_PESSOAIS.tipo_logradouro
  is 'tipo_logradouro';
comment on column NATCORP.INF_PESSOAIS.uf_ric
  is 'Uf emissao do Documento RIC';
comment on column NATCORP.INF_PESSOAIS.tmpresid
  is '1 - Prazo indeterminado; 2 - Prazo determinado';
-- Create/Recreate indexes 
create index NATCORP.IDX$$_04810001 on NATCORP.INF_PESSOAIS (COD_EMPRESA, MATRICULA, NOME)
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
create index NATCORP.IDX_ES1200_V2 on NATCORP.INF_PESSOAIS (NUM_CPF, DC_CPF)
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
create index NATCORP.IDX_INF_PES on NATCORP.INF_PESSOAIS (COD_EMPRESA, MATRICULA, NUM_CPF, DC_CPF, FILIAL, DT_ADMISSAO)
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
create index NATCORP.IDX_INF_PESSOAIS_6 on NATCORP.INF_PESSOAIS (NUM_CPF)
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
create index NATCORP.IDX_INF_PESSOAIS_CPF_COMP on NATCORP.INF_PESSOAIS (LPAD(TO_CHAR(NUM_CPF),9,'0')||LPAD(TO_CHAR(DC_CPF),2,'0'))
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
create index NATCORP.IDX_INF_PES_01 on NATCORP.INF_PESSOAIS (TO_CHAR(DT_NASC,'DD/MM'))
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
create index NATCORP.IDX_INF_PES_02 on NATCORP.INF_PESSOAIS (TO_CHAR(DT_NASC,'MM'))
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
create index NATCORP.IND_INF_PES_1 on NATCORP.INF_PESSOAIS (COD_EMPRESA, MATRICULA)
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
create index NATCORP.IND_INF_PES_2 on NATCORP.INF_PESSOAIS (COD_EMPRESA, FILIAL, MATRICULA)
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
create index NATCORP.IND_INF_PES_4 on NATCORP.INF_PESSOAIS (COD_EMPRESA, MATRICULA, FILIAL)
  tablespace TSPACE_NATCORP
  pctfree 10
  initrans 2
  maxtrans 255
  storage
  (
    initial 3M
    next 1M
    minextents 1
    maxextents unlimited
  );
create index NATCORP.IND_INF_PES_5 on NATCORP.INF_PESSOAIS (COD_EMPRESA, MATRICULA, NUM_PIS_PASEP)
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
create index NATCORP.IND_INF_PES_CAND on NATCORP.INF_PESSOAIS (COD_CANDIDATO)
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
create index NATCORP.IND_INF_PES_CPF on NATCORP.INF_PESSOAIS (COD_EMPRESA, NUM_CPF)
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
create index NATCORP.IND_INF_PES_IDENT on NATCORP.INF_PESSOAIS (COD_EMPRESA, NUM_IDENTIDADE)
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
alter table NATCORP.INF_PESSOAIS
  add primary key (COD_EMPRESA, MATRICULA);
alter table NATCORP.INF_PESSOAIS
  add constraint FK_COD_EMPRESAS foreign key (COD_EMPRESA)
  references NATCORP.EMPRESAS (COD);
alter table NATCORP.INF_PESSOAIS
  add constraint FK_COD_RACA_COR_IP foreign key (COD_RACA_COR)
  references NATCORP.RACA_COR (COD);
alter table NATCORP.INF_PESSOAIS
  add constraint FK_ESTADO_CIVIL03 foreign key (ESTADO_CIVIL)
  references NATCORP.ESTADO_CIVIL (COD);
alter table NATCORP.INF_PESSOAIS
  add constraint FK_INSTRUCAO04 foreign key (INSTRUCAO)
  references NATCORP.INSTRUCAO (COD)
  novalidate;
alter table NATCORP.INF_PESSOAIS
  add constraint FK_IPCD_NIVEL foreign key (CD_NIVEL)
  references NATCORP.ORGANIZACAO (CD_NIVEL);
alter table NATCORP.INF_PESSOAIS
  add constraint FK_IPTIPO_LOGRADOURO foreign key (TIPO_LOGRADOURO)
  references NATCORP.TIPO_LOGRADOURO (COD_TP_LOGR);
alter table NATCORP.INF_PESSOAIS
  add constraint FK_IPTIPO_LOGRAD_ES foreign key (TIPO_LOGRADOURO_ES)
  references NATCORP.TIPOS_LOGRADOUROS_ES (CODIGO);
alter table NATCORP.INF_PESSOAIS
  add constraint FK_IPUF_EMIS_PASSAPORTE foreign key (UF_EMIS_PASSAPORTE)
  references NATCORP.UF (SIGLA);
alter table NATCORP.INF_PESSOAIS
  add constraint FK_IP_FORM_ESCOLAR foreign key (COD_FORMACAO_ESCOLAR)
  references NATCORP.FORMACAO_ESCOLAR (COD_FORMACAO_ESCOLAR);
alter table NATCORP.INF_PESSOAIS
  add constraint FK_IP_PAIS_NACIONALIDADE foreign key (PAIS_NACIONALIDADE)
  references NATCORP.PAISES_ES (CODIGO);
alter table NATCORP.INF_PESSOAIS
  add constraint FK_IP_PAIS_NASCIMENTO foreign key (PAIS_NASCIMENTO)
  references NATCORP.PAISES_ES (CODIGO);
alter table NATCORP.INF_PESSOAIS
  add constraint FK_NACIONALIDADE01 foreign key (NACIONALIDADE)
  references NATCORP.NACIONALIDADE (COD);
alter table NATCORP.INF_PESSOAIS
  add constraint FK_PAIS_RESIDENCIA foreign key (PAIS_RESIDENCIA)
  references NATCORP.PAISES_ES (CODIGO);
alter table NATCORP.INF_PESSOAIS
  add constraint FK_PESS_SIGLA_CONS_REG foreign key (SIGLA_CONS_REG)
  references NATCORP.CONSELHO_REGIONAL (NUM_ORDEM);
alter table NATCORP.INF_PESSOAIS
  add constraint FK_PESS_UF_CNH foreign key (UF_CNH)
  references NATCORP.UF (SIGLA);
alter table NATCORP.INF_PESSOAIS
  add constraint FK_TITULACAO foreign key (TITULACAO)
  references NATCORP.TITULACAO (COD_TITULACAO);
alter table NATCORP.INF_PESSOAIS
  add constraint FK_UF02 foreign key (UF_NACTO)
  references NATCORP.UF (SIGLA);
alter table NATCORP.INF_PESSOAIS
  add constraint FK_UF04 foreign key (EST_EMIS_PROF)
  references NATCORP.UF (SIGLA);
alter table NATCORP.INF_PESSOAIS
  add constraint FK_UF05 foreign key (EST_EMIS_IDENT)
  references NATCORP.UF (SIGLA);
alter table NATCORP.INF_PESSOAIS
  add constraint FK_UF08 foreign key (EST_EMIS_TITULO)
  references NATCORP.UF (SIGLA);
alter table NATCORP.INF_PESSOAIS
  add constraint FK_UF09 foreign key (UF_RIC)
  references NATCORP.UF (SIGLA);
alter table NATCORP.INF_PESSOAIS
  add constraint FK_UF12 foreign key (UF)
  references NATCORP.UF (SIGLA);
-- Create/Recreate check constraints 
alter table NATCORP.INF_PESSOAIS
  add constraint CHK_FIL_INFOCOTA
  check (infocota IN ('S','N'));
alter table NATCORP.INF_PESSOAIS
  add constraint CK_CLASS_TRAB_ESTRANG
  check (CLASS_TRAB_ESTRANG IN (1,2,3,4,5,6,7,8,9,10,11,12));
alter table NATCORP.INF_PESSOAIS
  add constraint CK_COD_CANDIDATO
  check (COD_CANDIDATO <> 0);
alter table NATCORP.INF_PESSOAIS
  add constraint CK_FATOR
  check (FATOR_RH IN ('+', '-', NULL));
alter table NATCORP.INF_PESSOAIS
  add constraint CK_IND_DEF_FIS_PESS
  check (ind_def_fis IN('S','N'));
alter table NATCORP.INF_PESSOAIS
  add constraint CK_IPMOD_CART_PROF
  check (MOD_CART_PROF IN ('U','R'));
alter table NATCORP.INF_PESSOAIS
  add constraint CK_IPSEXO
  check (SEXO IN ('F','M'));
alter table NATCORP.INF_PESSOAIS
  add constraint CK_IPTIPO_IDENT
  check (TIPO_IDENT IN ('1','2','3'));
alter table NATCORP.INF_PESSOAIS
  add constraint CK_IP_RESIDE_BRASIL
  check (reside_brasil IN ('S','N'));
alter table NATCORP.INF_PESSOAIS
  add constraint CK_RAIS_IND_DEF_AUDITIVA_PESS
  check (RAIS_IND_DEF_AUDITIVA IN('S','N'));
alter table NATCORP.INF_PESSOAIS
  add constraint CK_RAIS_IND_DEF_FISICO_PESS
  check (RAIS_IND_DEF_FISICO IN('S','N'));
alter table NATCORP.INF_PESSOAIS
  add constraint CK_RAIS_IND_DEF_INTELECTUAL
  check (rais_ind_def_intelectual IN('S', 'N'));
alter table NATCORP.INF_PESSOAIS
  add constraint CK_RAIS_IND_DEF_MENTAL_PESS
  check (RAIS_IND_DEF_MENTAL IN('S','N'));
alter table NATCORP.INF_PESSOAIS
  add constraint CK_RAIS_IND_DEF_MULTIPLA_PESS
  check (RAIS_IND_DEF_MULTIPLA IN('S','N'));
alter table NATCORP.INF_PESSOAIS
  add constraint CK_RAIS_IND_DEF_VISUAL_PESS
  check (RAIS_IND_DEF_VISUAL IN('S','N'));
alter table NATCORP.INF_PESSOAIS
  add constraint CK_REGIAO
  check (REGIAO IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO', NULL));
alter table NATCORP.INF_PESSOAIS
  add constraint CK_SEXO
  check (SEXO IN ('M','F'));
alter table NATCORP.INF_PESSOAIS
  add constraint CK_TIPO_SANGUE
  check (TIPO_SANGUINEO IN ('NI','A', 'B', 'O', 'AB', null));
