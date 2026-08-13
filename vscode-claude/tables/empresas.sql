-- Create table
create table NATCORP.EMPRESAS
(
  cod                            NUMBER(3) not null,
  nome                           VARCHAR2(70) not null,
  nome_abrev                     VARCHAR2(40) not null,
  sigla                          VARCHAR2(10) not null,
  cgc                            NUMBER(15) not null,
  dc_cgc                         NUMBER(2) not null,
  insc_est                       NUMBER(12) not null,
  letra_insc                     VARCHAR2(1),
  natureza                       VARCHAR2(5) not null,
  reg_junta_coml                 NUMBER(10),
  uf_junta_coml                  VARCHAR2(2),
  dt_reg_junta                   DATE,
  endereco                       VARCHAR2(30) not null,
  bairro                         VARCHAR2(80) not null,
  cidade                         VARCHAR2(80) not null,
  uf                             VARCHAR2(2) not null,
  cep                            NUMBER(5) not null,
  ddd                            VARCHAR2(4) not null,
  telefone1                      NUMBER(10) not null,
  telefone2                      NUMBER(10),
  fax                            NUMBER(11),
  cx_postal                      NUMBER(7),
  telex                          NUMBER(7),
  ender_telegrafico              VARCHAR2(12),
  ativ_economica                 NUMBER(7) not null,
  num_diretores                  NUMBER(2),
  pis_pasep_bco                  NUMBER(3),
  pis_pasep_ag                   NUMBER(4),
  pis_pasep_agdc                 VARCHAR2(1),
  pis_pasep_bcoagdc              VARCHAR2(1),
  fgts_bco                       NUMBER(3),
  fgts_ag                        NUMBER(4),
  fgts_agdc                      VARCHAR2(1),
  fgts_bcoagdc                   VARCHAR2(1),
  dt_cadastramento               DATE not null,
  sit                            VARCHAR2(1),
  cod_empresa                    NUMBER(3),
  usuario                        VARCHAR2(30),
  dt_atualizacao                 DATE,
  complemento_cep                NUMBER(3) not null,
  ir_mes_caixa                   VARCHAR2(1) not null,
  num_conv_mtb                   NUMBER(6) not null,
  dv_mtb                         NUMBER(1) not null,
  ind_lanc_centesimal            VARCHAR2(1),
  seq_caged                      NUMBER(3),
  tipo_modulo                    VARCHAR2(3),
  utiliza_dv                     VARCHAR2(1),
  ind_desc_vale_transp           NUMBER(4,2) default 99.99 not null,
  perc_acrescimo_constitucional  NUMBER(7,4),
  pagto_fer_dobro                VARCHAR2(1),
  capp                           NUMBER(5),
  numero                         NUMBER(5) not null,
  complem                        VARCHAR2(15),
  qtde_dias_contr_fer            NUMBER(3),
  mudanca_ender                  VARCHAR2(1),
  qtde_dias_contr_exper          NUMBER(3),
  cod_municipio_rais             NUMBER(7),
  id_micro_empresa               VARCHAR2(1) default '3' not null,
  tabela_cep                     VARCHAR2(1),
  ind_duplo_vinculo              VARCHAR2(1),
  tipo_pagto_ats                 VARCHAR2(1),
  natureza_empresa               NUMBER(1),
  idade_minima                   NUMBER(2),
  idade_maxima                   NUMBER(2),
  utiliza_workflow               VARCHAR2(1),
  cod_tipo_empresa               NUMBER(3),
  rais_ind_sindicalizada         NUMBER(1),
  vlr_garantia_minima            NUMBER(17,2),
  qtde_sal_minimo                NUMBER(3),
  ocorr_premio_ferias            NUMBER(3),
  ocorr_gar_min                  NUMBER(3),
  tipo_lancamento_manual         NUMBER(1) default 1,
  indic_construtora              NUMBER(1) default 0 not null,
  indic_cooperativa              NUMBER(1) default 0 not null,
  cod_tipo_inscr_es              NUMBER(3) default 1 not null,
  classif_trib                   NUMBER(3) not null,
  ind_sit_especial               NUMBER(1) default 0,
  socio_ostensivo                VARCHAR2(1) default 'N' not null,
  indic_desoneracao_folha        NUMBER(1) default 0 not null,
  indic_opcao_reg_eletronico     NUMBER(1) default 0 not null,
  mult_tab_rubricas              VARCHAR2(1) default 'N' not null,
  siglamin_dadosisencao          VARCHAR2(70),
  nrcertif_dadosisencao          VARCHAR2(40),
  dtemiscertif_dadosisencao      DATE,
  dtvenccertif_dadosisencao      DATE,
  nrprotrenov_dadosisencao       VARCHAR2(40),
  dtprotrenov_dadosisencao       DATE,
  dtdou_dadosisencao             DATE,
  pagdou_dadosisencao            NUMBER(5),
  nome_contato_esocial           VARCHAR2(70) not null,
  num_cpf_contato_esocial        VARCHAR2(11),
  num_fone_fixo_contato_esocial  NUMBER(13),
  num_fone_cel_contato_esocial   NUMBER(13),
  email_contato_esocial          VARCHAR2(60),
  ind_rpps                       VARCHAR2(1) default 'N',
  uf_ente_fed                    VARCHAR2(2),
  cod_mun_ibge                   NUMBER(7),
  tp_pub_alvo                    NUMBER(1),
  perc_aliq_seg                  NUMBER(5,2),
  perc_aliq_normal               NUMBER(5,2),
  perc_aliq_supl                 NUMBER(5,2),
  poder_subteto                  NUMBER(1),
  valor_subteto                  NUMBER(14,2),
  maioridade_dependentes         NUMBER(2),
  ind_apur_aliq_fap              NUMBER(1) default 2 not null,
  desc_seg_dif                   VARCHAR2(50),
  indic_contrib_subst            NUMBER(1),
  dt_encerramento                DATE,
  fap                            NUMBER(7,4),
  num_processo_fap               VARCHAR2(20),
  indented                       VARCHAR2(1) default 'N',
  indett                         VARCHAR2(1) default 'N',
  nrregett                       NUMBER(30),
  ideefr                         VARCHAR2(1) default 'N',
  cnpjefr                        VARCHAR2(14),
  nmente                         VARCHAR2(115),
  cod_gera_esocial               NUMBER default 0 not null,
  certificado_esocial            BLOB,
  tipo_arq_certif_esocial        VARCHAR2(100),
  nome_certif_esocial            VARCHAR2(1000),
  senha_certif_esocial           VARCHAR2(200),
  flg_enviar_incl_esocial        VARCHAR2(1) default 'S' not null,
  indopccp                       NUMBER(1),
  cgc_proc_es                    NUMBER(15),
  dc_cgc_proc_es                 NUMBER(2),
  tipo_proc_es                   VARCHAR2(2),
  cpf_proc_es                    NUMBER(10),
  dc_cpf_proc_es                 NUMBER(2),
  indtribfolhapispasep           VARCHAR2(1),
  logo                           BLOB,
  logo_nome                      VARCHAR2(100),
  logo_mimetype                  VARCHAR2(100),
  logo_charset                   VARCHAR2(100),
  dt_fim_validade_certif_esocial DATE
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
comment on column NATCORP.EMPRESAS.cod
  is 'Código da Empresa - Código numérico da empresa que está sendo cadastrada.';
comment on column NATCORP.EMPRESAS.nome
  is 'Nome da Empresa - Razão Social da empresa.';
comment on column NATCORP.EMPRESAS.nome_abrev
  is 'Nome Abreviado - Nome abreviado da empresa.';
comment on column NATCORP.EMPRESAS.sigla
  is 'Sigla - Sigla da empresa (numérico ou alfa).';
comment on column NATCORP.EMPRESAS.cgc
  is 'campo muda conforme o codigo acima escolhido - Número da inscrição do CNPJ.';
comment on column NATCORP.EMPRESAS.dc_cgc
  is 'DIGITO DE CONTROLE CGC - Dígito de controle do CNPJ.';
comment on column NATCORP.EMPRESAS.insc_est
  is 'Inscr Estadual - Número da inscrição estadual.';
comment on column NATCORP.EMPRESAS.natureza
  is 'Natureza jurídica.';
comment on column NATCORP.EMPRESAS.reg_junta_coml
  is 'Registro - Número de registro na junta comercial.';
comment on column NATCORP.EMPRESAS.uf_junta_coml
  is 'UF - Unidade da federação.';
comment on column NATCORP.EMPRESAS.dt_reg_junta
  is 'Data Junta Comercial - Data de registro na junta comercial.';
comment on column NATCORP.EMPRESAS.endereco
  is 'Endereço - Endereço da empresa ( nome rua, avenida e etc.).';
comment on column NATCORP.EMPRESAS.bairro
  is 'Bairro - Bairro da empresa.';
comment on column NATCORP.EMPRESAS.cidade
  is 'Cidade - Cidade onde fica a empresa.';
comment on column NATCORP.EMPRESAS.uf
  is 'UF - Unidade Federativa da Empresa.';
comment on column NATCORP.EMPRESAS.cep
  is 'CEP - Código de endereçamento postal (cep).';
comment on column NATCORP.EMPRESAS.ddd
  is '(DDD)Tel.1o. - Tel. 2o. - Código de discagem direta a distância (ddd) e em seguida o número do telefone.';
comment on column NATCORP.EMPRESAS.telefone1
  is '(DDD)Tel.1o. - Tel. 2o. - Código de discagem direta a distância (ddd)e em seguida o número do telefone.';
comment on column NATCORP.EMPRESAS.telefone2
  is '(DDD)Tel.1o. - Tel. 2o. - Código de discagem direta a distância (ddd)e em seguida o número do telefone.';
comment on column NATCORP.EMPRESAS.fax
  is 'FAX - Número do fax.';
comment on column NATCORP.EMPRESAS.cx_postal
  is 'Caixa postal.';
comment on column NATCORP.EMPRESAS.ativ_economica
  is 'Ativ.Economica - Código da atividade econômica da empresa.';
comment on column NATCORP.EMPRESAS.num_diretores
  is 'Num de Diretores - Quantidade de diretores.';
comment on column NATCORP.EMPRESAS.pis_pasep_bco
  is 'Banco PIS/PASEP - Banco do PIS/PASEP em seguida o código da agência e digito e por último o digito do controle do banco.';
comment on column NATCORP.EMPRESAS.fgts_bco
  is 'Banco FGTS - Banco do FGTS em seguida a agência, digito e depois o digito do controle do banco.';
comment on column NATCORP.EMPRESAS.dt_cadastramento
  is 'Data Inicio Sistema - Data de cadastramento da empresa no sistema, data que seguirá para o e-social como produção.';
comment on column NATCORP.EMPRESAS.sit
  is 'Maioridade Dependentes - Idade correspondente a maioridade dos dependentes para o ente federativo, declarados por legislação específica.';
comment on column NATCORP.EMPRESAS.ir_mes_caixa
  is 'IR Mês Caixa - Sim: para indicar ao sistema que o pagamento de salário vai ocorrer no mês de competência. Não: para indicar ao sistema que o pagamento de salário vai ocorrer no mês seguinte ao da competência.';
comment on column NATCORP.EMPRESAS.num_conv_mtb
  is 'Convênio CAGED - Número do convênio no ministério do trabalho e em seguida o dígito ou deixar zerado pois não é mais obrigatório ter este número.';
comment on column NATCORP.EMPRESAS.ind_lanc_centesimal
  is 'Lanc Centesimal - (*) para lançamentos centesimais, o sistema irá fazer os cálculos de horas como centesimais e lançamentos sexagesimais e se optar por sexagesimais o sistema irá transformar as horas centesimais em sexagesimais.';
comment on column NATCORP.EMPRESAS.seq_caged
  is 'Seq CAGED - Código sequencial do convenio do caged.';
comment on column NATCORP.EMPRESAS.tipo_modulo
  is 'Módulo - Sempre 11b.';
comment on column NATCORP.EMPRESAS.utiliza_dv
  is 'DV - Indica se utiliza digito verificador para matricula (S) sim - (N) não.';
comment on column NATCORP.EMPRESAS.ind_desc_vale_transp
  is '% Vale Transp - Esta informação é fixa do sistema para que se faça o cálculo do vale transporte e não deverá ser preenchida.';
comment on column NATCORP.EMPRESAS.perc_acrescimo_constitucional
  is 'Acresc. Constit. - Percentual de acréscimo constitucional (1/3 férias).';
comment on column NATCORP.EMPRESAS.numero
  is 'No. - Número da empresa.';
comment on column NATCORP.EMPRESAS.complem
  is 'Compl. - Complemento do endereço caso exista.';
comment on column NATCORP.EMPRESAS.qtde_dias_contr_fer
  is 'Dias Contr Saída Fér - Quantidade de dias para controle do gozo de férias entre um período e outro.';
comment on column NATCORP.EMPRESAS.cod_municipio_rais
  is 'Munic.Rais - Código do município conforme tabela Rais.';
comment on column NATCORP.EMPRESAS.id_micro_empresa
  is 'Porte da Empresa - Porte.';
comment on column NATCORP.EMPRESAS.tabela_cep
  is 'Utiliza tabela CEP? - Acessar a tabela de código de endereçamento postal (cep) que estiverem cadastrados na tabela de cep automaticamente.';
comment on column NATCORP.EMPRESAS.ind_duplo_vinculo
  is 'Ind.Duplo Vínculo - Indica se a empresa possui funcionário que trabalha em duplo vínculo e que contém verbas remuneratórias que compõe as bases de cálculo, caso este item for marcado ir na aplicação F010403 aba de cargos e salários e anotar a data do duplo vínculo e depois ir na aplicação F016512 e anotar os dados do outro empregador.';
comment on column NATCORP.EMPRESAS.tipo_pagto_ats
  is 'Pagto ATS - ATS (Adicional de Tempo de Serviço), informar se o cálculo de pagamento do ATS será feito Mensalmente ou Anualmente, conforme determinado em Convenção Coletiva, depois ir na aplicação F010312 e cadastrar as regras do ATS.';
comment on column NATCORP.EMPRESAS.natureza_empresa
  is 'Natureza da empresa.';
comment on column NATCORP.EMPRESAS.idade_minima
  is 'Idade Limite - Idade limite mínima para registro de funcionário, o sistema irá fazer a validação desta informação e não permitirá que se faça registro de pessoas que estejam dentro do parâmetro, através da aplicação F010402.';
comment on column NATCORP.EMPRESAS.idade_maxima
  is 'Idade Limite - Idade limite máxima para registro de funcionário, o sistema irá fazer a validação desta informação e não permitirá que se faça registro de pessoas que estejam dentro do parâmetro, através da aplicação F010402.';
comment on column NATCORP.EMPRESAS.utiliza_workflow
  is 'UTILIZA WORKFLOW - Indica se a empresa cadastrada terá uma sequência de aprovação de suas requisições / processos (indicar S (Sim) se a empresa utilizar o processo de Requisição e E-mails).';
comment on column NATCORP.EMPRESAS.cod_tipo_empresa
  is 'Tipo de Empresa - Tipo da empresa.';
comment on column NATCORP.EMPRESAS.rais_ind_sindicalizada
  is 'Sindicalizada - Indica se a empresa é sindicalizada.';
comment on column NATCORP.EMPRESAS.vlr_garantia_minima
  is 'Garantia Mínima - Valor da garantia mínima caso o acréscimo constitucional calcule um valor menor que a garantia ele pegara o valor da garantia.';
comment on column NATCORP.EMPRESAS.qtde_sal_minimo
  is 'Qtde. Sal. Mínimo - Quantidade de salário mínimo caso o acréscimo constitucional calcule um valor menor que a quantidade acima ele pegara o valor da quantidade de salários mínimos.';
comment on column NATCORP.EMPRESAS.ocorr_premio_ferias
  is 'Ocorr. Prêmio Férias - Através do qual o código da ocorrência que irá sair no cálculo referente as diferenças de valores da garantia mínima ou da quantidade de salário mínimo.';
comment on column NATCORP.EMPRESAS.tipo_lancamento_manual
  is 'Tipo de Lançamentos - Como será o tipo de lançamentos em horas se optar por centesimal (exemplo: 30 minutos = 50)/ se sexagesimal (exemplo: 30 minutos = 30).';
comment on column NATCORP.EMPRESAS.indic_construtora
  is 'Construtora - Indica se é ou não construtora.';
comment on column NATCORP.EMPRESAS.indic_cooperativa
  is 'Cooperativa - Indica se é ou não cooperativa e se sim qual o tipo.';
comment on column NATCORP.EMPRESAS.cod_tipo_inscr_es
  is 'Tipo Inscrição - Tipo de inscrição.';
comment on column NATCORP.EMPRESAS.classif_trib
  is 'Classif. Tributária - Classificação tributária da empresa.';
comment on column NATCORP.EMPRESAS.ind_sit_especial
  is 'Indic.Sit.P.J. - Situação.';
comment on column NATCORP.EMPRESAS.socio_ostensivo
  is 'Sócio Ostensivo? - Indica se a empresa possui sócio ostensivo.';
comment on column NATCORP.EMPRESAS.indic_desoneracao_folha
  is 'Indicativo - Indica se aplica ou não, caso optar por (1) depois ir na aplicação F010103 aba parâmetros INSS e FGTS para lançar o percentual.';
comment on column NATCORP.EMPRESAS.indic_opcao_reg_eletronico
  is 'Opção - Indica se utiliza ou não o registro eletrônico de empregados.';
comment on column NATCORP.EMPRESAS.mult_tab_rubricas
  is 'Indicativo - Indica se utiliza ou não tabela diferenciada de ocorrências para cada empresa.';
comment on column NATCORP.EMPRESAS.siglamin_dadosisencao
  is 'Sigla Ministério - Indica se a empresa está dentro dos parâmetros de alguma isenção.';
comment on column NATCORP.EMPRESAS.nrcertif_dadosisencao
  is 'No.Certificado - Número do certificado de entidade beneficente de Assistência Social, número da portaria de concessão do certificado ou, no caso de concessão através de lei especifica.';
comment on column NATCORP.EMPRESAS.dtemiscertif_dadosisencao
  is 'Data Emissão - Data de emissão do certificação/publicação da lei.';
comment on column NATCORP.EMPRESAS.dtvenccertif_dadosisencao
  is 'Data Vencto - Data de vencimento do certificação.';
comment on column NATCORP.EMPRESAS.nrprotrenov_dadosisencao
  is 'No. Protocolo Renov. - Número do protocolo de renovação.';
comment on column NATCORP.EMPRESAS.dtprotrenov_dadosisencao
  is 'Dt Protocolo Renov - Data do protocolo de renovação.';
comment on column NATCORP.EMPRESAS.dtdou_dadosisencao
  is 'Dt Public DOU - Data de publicação no diário oficial da união.';
comment on column NATCORP.EMPRESAS.pagdou_dadosisencao
  is 'Página DOU - Número da página no dou referente a publicação do documento de concessão do certificado.';
comment on column NATCORP.EMPRESAS.nome_contato_esocial
  is 'Nome do Contato - Responsável do empregador com os órgãos gestores do e-social.';
comment on column NATCORP.EMPRESAS.num_cpf_contato_esocial
  is 'Número CPF - Número do CPF do contato do empregador com os órgãos gestores do e-social.';
comment on column NATCORP.EMPRESAS.num_fone_fixo_contato_esocial
  is 'Tel. Fixo - Número do telefone fixo do contato do empregador com os órgãos gestores do e-social.';
comment on column NATCORP.EMPRESAS.num_fone_cel_contato_esocial
  is 'Tel. Celular - Número do telefone celular do contato do empregador com os órgãos gestores do e-social.';
comment on column NATCORP.EMPRESAS.email_contato_esocial
  is 'End Eletrônico (E-Mail) - Endereço eletrônico do contato do empregador com os órgãos gestores do e-social.';
comment on column NATCORP.EMPRESAS.ind_rpps
  is 'Possui Regime Próprio - Indica se o órgão público possui ou não regime próprio de previdência social.';
comment on column NATCORP.EMPRESAS.uf_ente_fed
  is 'Sigla UF - Unidade da federação.';
comment on column NATCORP.EMPRESAS.cod_mun_ibge
  is 'Cód.Município - Código do município.';
comment on column NATCORP.EMPRESAS.tp_pub_alvo
  is 'Público Alvo - Código corresponde ao tipo de público alvo para o qual a alíquota é aplicada.';
comment on column NATCORP.EMPRESAS.perc_aliq_seg
  is '%Contrib Segurado - Percentual da alíquota de contribuição do segurado ou beneficiário para o RPPS.';
comment on column NATCORP.EMPRESAS.perc_aliq_normal
  is '%Contrib Normal - Percentual da alíquota de contribuição normal do ente federativo para o RPPS.';
comment on column NATCORP.EMPRESAS.perc_aliq_supl
  is '%Contrib Suplementar - Percentual da alíquota de contribuição suplementar do ente federativo para o RPPS.';
comment on column NATCORP.EMPRESAS.poder_subteto
  is 'Poder - Poder a que se refere o subteto.';
comment on column NATCORP.EMPRESAS.valor_subteto
  is 'Valor Subteto - Valor do subteto do ente federativo, não ultrapassando o valor do teto geral.';
comment on column NATCORP.EMPRESAS.maioridade_dependentes
  is 'MAIORIDADE DEPENDENTES - Com o número de anos (idade) correspondente a maioridade dos dependentes para o ente Federativo, declarados por legislação especifica.';
comment on column NATCORP.EMPRESAS.desc_seg_dif
  is 'Lei Espec. Seg. Dif. - Lei especifica para o enquadramento quando o campo público alvo for igual a segurados diferenciados.';
comment on column NATCORP.EMPRESAS.indic_contrib_subst
  is 'Indic. Contrib. Subst. - Indicador de contribuição substituída.';
comment on column NATCORP.EMPRESAS.dt_encerramento
  is 'Dt Encerramento - Data de encerramento da empresa.';
comment on column NATCORP.EMPRESAS.fap
  is 'FAP - Percentual atribuído a cada empresa que varia de 0,5 a 2,0% a ser aplicado sobre as alíquotas do RAT incidente sobre a folha de pagamento para custear aposentadorias especiais e benefícios decorrentes de acidentes de trabalho. Este percentual varia anualmente é calculado sempre sobre os dois últimos anos de todo o histórico de registros acidentários da previdência social da sua empresa.';
comment on column NATCORP.EMPRESAS.num_processo_fap
  is 'No. Processo - Processos que estão vinculados na aplicação F014014 referente ao FAP.';
comment on column NATCORP.EMPRESAS.indented
  is 'Ent. Educativa - Indica se é ou não entidade educativa sem fins lucrativos que tenha por objetivo a assistência ao adolescente e à educação profissional (art. 430, inciso II, CLT).';
comment on column NATCORP.EMPRESAS.indett
  is 'T.Temporário - Indica se é ou não empresa de trabalho temporário com registro no ministério do trabalho (lei no. 6.019/1974).';
comment on column NATCORP.EMPRESAS.nrregett
  is 'Número do registro da Empresa de Trabalho Temporário no Ministério do Trabalho';
comment on column NATCORP.EMPRESAS.ideefr
  is 'Ente Federativo Resp. - Indica se o órgão público é o ente federativo responsável - EFR ou se é uma unidade administrativa autônomo vinculada a um EFR.';
comment on column NATCORP.EMPRESAS.cnpjefr
  is 'C.N.P.J. - CNPJ do ente federativo responsável - EFR.';
comment on column NATCORP.EMPRESAS.nmente
  is 'Nome - Nome do ente federativo ao qual o órgão está vinculado.';
-- Create/Recreate primary, unique and foreign key constraints 
alter table NATCORP.EMPRESAS
  add constraint PK_COD primary key (COD)
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
alter table NATCORP.EMPRESAS
  add constraint FK_EMP_CLASSIF_TRIB foreign key (CLASSIF_TRIB)
  references NATCORP.CLASSIFICACAO_TRIBUTARIA_ES (CODIGO);
alter table NATCORP.EMPRESAS
  add constraint FK_EMP_OCORR_PREMIO_FERIAS foreign key (COD, OCORR_PREMIO_FERIAS)
  references NATCORP.OCORR_PAGTO (COD_EMPRESA, COD);
alter table NATCORP.EMPRESAS
  add constraint FK_EMP_OC_GAR_MIN foreign key (COD, OCORR_GAR_MIN)
  references NATCORP.OCORR_PAGTO (COD_EMPRESA, COD);
-- Create/Recreate check constraints 
alter table NATCORP.EMPRESAS
  add constraint CHECK_LANC
  check (TIPO_LANCAMENTO_MANUAL IN (1,2));
alter table NATCORP.EMPRESAS
  add constraint CHK_EMP_INDENTED
  check (indEntEd IN ('S','N'));
alter table NATCORP.EMPRESAS
  add constraint CHK_EMP_INDETT
  check (indEtt IN ('S','N'));
alter table NATCORP.EMPRESAS
  add constraint CHK_TABELA_CEP
  check (TABELA_CEP IN('S', 'N'))
  novalidate;
alter table NATCORP.EMPRESAS
  add constraint CK_EMP_IND_SIT_ESPEC
  check (IND_SIT_ESPECIAL IN(0,1,2,3,4));
alter table NATCORP.EMPRESAS
  add constraint CK_EMP_SOCIO_OSTENSIVO
  check (SOCIO_OSTENSIVO IN('S','N'));
alter table NATCORP.EMPRESAS
  add constraint CK_ENVIAR_INCL_ESOCIAL
  check (FLG_ENVIAR_INCL_ESOCIAL IN('S','N'));
alter table NATCORP.EMPRESAS
  add constraint CK_ID_MICRO_EMPRESA
  check (ID_MICRO_EMPRESA IN('1', '2', '3','4'));
alter table NATCORP.EMPRESAS
  add constraint CK_INDIC_CONTRIB_SUBST
  check (indic_contrib_subst IN(1,2,3));
alter table NATCORP.EMPRESAS
  add constraint CK_INDIC_CONTRUTORA
  check (indic_construtora IN(0,1));
alter table NATCORP.EMPRESAS
  add constraint CK_INDIC_COOPERATIVA
  check (indic_cooperativa IN(0,1,2,3));
alter table NATCORP.EMPRESAS
  add constraint CK_INDIC_DESONERACAO_FOLHA
  check (indic_desoneracao_folha IN(0,1,2));
alter table NATCORP.EMPRESAS
  add constraint CK_INDIC_OPCAO_REG_ELETRONICO
  check (indic_opcao_reg_eletronico IN(0,1));
alter table NATCORP.EMPRESAS
  add constraint CK_IND_APUR_ALIQ_FAP
  check (Ind_Apur_Aliq_Fap IN(1,2));
alter table NATCORP.EMPRESAS
  add constraint CK_MULT_TAB_RUBRICAS
  check (mult_tab_rubricas IN('S','N'));
alter table NATCORP.EMPRESAS
  add constraint CK_PODER_SUBTETO
  check (PODER_SUBTETO IN (1,2,3,9));
alter table NATCORP.EMPRESAS
  add constraint CK_SIGLAMIN_DADOSISENCAO
  check (SiglaMin_DadosIsencao IN('CNAS','MEC','MS','MDS','LEI'));
alter table NATCORP.EMPRESAS
  add constraint CK_TIPO_LANCAMENTO_MANUAL
  check (TIPO_LANCAMENTO_MANUAL IN (1,2));
alter table NATCORP.EMPRESAS
  add constraint CK_TIPO_PAGTO_ATS
  check (tipo_pagto_ats in ('M','A'))
  novalidate;
alter table NATCORP.EMPRESAS
  add constraint CK_TP_PUB_ALVO
  check (tp_pub_alvo IN(1,2,3,4,5,6));
