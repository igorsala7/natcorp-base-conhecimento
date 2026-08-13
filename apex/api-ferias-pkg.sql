--------------------------------------------------------------------------------
-- PKG_API_FERIAS — casca REST para solicitação e aprovação de férias
--                                                    [ Oracle + APEX 19.2 ]
--
-- Implementa o contrato de docs/ferias-ords-contrato.md. É CASCA: nenhuma regra
-- de negócio mora aqui. Cada procedure orquestra a mesma sequência de chamadas
-- que a cascata de Dynamic Actions da página 78 executa, converte os parâmetros
-- IN OUT do pkg_ferias em JSON e tipa as mensagens.
--
-- Serve QUALQUER base: o id da aplicação APEX nunca aparece como constante —
-- sai do alias `painel_base` (PO_NATCORP, PG_NATCORP, PC_NATCORP). Ver app_id().
--
-- Instalar como o schema NATCORP (dono de pkg_ferias, prc_atualiza_req,
-- prc_insere_aprovador e pkg_aprovacao_coletiva).
--
--------------------------------------------------------------------------------
-- ⚠ ANTES DE COMPILAR — o que foi escrito com fonte à vista e o que NÃO foi
--
-- EXATO (assinatura conferida no fonte de pkg_ferias / prc_* / pkg_aprovacao_*):
--   Valida_Matricula_Solicitado · Valida_Dt_Saida_Parc1 · Valida_Num_Dias_Parc1
--   Valida_Dias_Abono_Pec1 · Valida_Opcao_13Sal1 · Valida_Desc_Adicional1
--   Valida_Dt_Retorno_Parc1 · Valida_Tipo_Ferias1 · funcFeriasParamParcela_APEX
--   Pre_Insert · Post_Insert · Valida_Update_Rf · Valida_Sequencia
--   PRC_INSERE_APROVADOR · PRC_ATUALIZA_REQ · pkg_aprovacao_coletiva.executa
--
-- COLUNAS conferidas contra o DDL em vscode-claude/tables/ — o que estava errado
-- e foi corrigido:
--   · REQUISICAO_FERIAS **não tem** `filial` (ela vive em INFORMACOES_FUNCIONAIS)
--   · `sit_requisicao` é VARCHAR2(1): o legado grava '1', '2', '4' como TEXTO
--   · `opcao_ferias` é NUMBER(3), não texto
--   · `desc_adicional1` é NUMBER(2) — QUANTIDADE de dias, não flag S/N
--   · FERIAS **não tem** `dias_direito`: quem calcula é Valida_Dt_Saida_Parc1,
--     a partir do saldo (jornada reduzida, e /2 quando o período está em dobro)
--   · CENTRO_DE_CUSTO chama o centro de custo de `cod` — `cod_ccusto` é o nome
--     dele em INFORMACOES_FUNCIONAIS
--
-- A CONFIRMAR (fonte não fornecido — marcado com "⚠ CONFIRMAR" no corpo):
--   1. pkg_req_ferias.pg78_carrega   — carga de período/saldo em `situacao`
--   2. pkg_list.fnc_list_opc_prog_ferias e
--      pkg_list_matricula.fnc_list_numdias — catálogos em `opcoes`
--   3. Parcelas 2 e 4 em `simular`: a parcela 1 está completa e é o gabarito;
--      Valida_Dt_Saida_Parc2/4 e Valida_Num_Dias_Parc2/4 seguem o mesmo padrão
--   4. INFORMACOES_FUNCIONAIS × INFORMACOES_FUNCIONAIS_CAD e INF_PESSOAIS ×
--      INF_PESSOAIS_CAD: o legado usa as duas formas. Aqui ficaram as tabelas
--      base, que são as que tenho o DDL. Se a variante _CAD filtrar algo
--      (histórico, situação), trocar.
--
-- Este script NÃO foi compilado contra o banco. Trate a primeira compilação
-- como parte da implementação, não como regressão.
--------------------------------------------------------------------------------

CREATE OR REPLACE PACKAGE NATCORP.PKG_API_FERIAS AS

  -- Todas recebem e devolvem JSON (contrato em docs/ferias-ords-contrato.md).
  -- Recusa de NEGÓCIO sai com ok=false e HTTP 200; falha TÉCNICA levanta
  -- exceção e o handler ORDS devolve 5xx.

  PROCEDURE situacao     (p_json IN CLOB, p_out OUT CLOB);
  PROCEDURE opcoes       (p_json IN CLOB, p_out OUT CLOB);
  PROCEDURE simular      (p_json IN CLOB, p_out OUT CLOB);
  PROCEDURE criar        (p_json IN CLOB, p_out OUT CLOB);
  PROCEDURE minhas       (p_json IN CLOB, p_out OUT CLOB);
  PROCEDURE aprovacoes   (p_json IN CLOB, p_out OUT CLOB);
  PROCEDURE aprovar      (p_json IN CLOB, p_out OUT CLOB);
  PROCEDURE reprocessar  (p_json IN CLOB, p_out OUT CLOB);

END PKG_API_FERIAS;
/

CREATE OR REPLACE PACKAGE BODY NATCORP.PKG_API_FERIAS AS

  -- ── Declarações ───────────────────────────────────────────────────────────
  -- Em corpo de package, TIPO, VARIÁVEL e CONSTANTE têm de vir ANTES de
  -- qualquer subprograma. Tudo o que é declaração mora neste bloco.

  -- A página de férias é a 78 nos TRÊS painéis (operador, gestor, colaborador).
  c_pagina_ferias CONSTANT NUMBER := 78;

  -- ── Identidade do chamador ────────────────────────────────────────────────
  TYPE t_ident IS RECORD (
    usuario        VARCHAR2(100),   -- usuario_oracle.nm_usuario_oracle
    empresa_user   NUMBER,
    matricula_user NUMBER,
    perfil         VARCHAR2(100),
    painel         VARCHAR2(10),    -- PO | PG | PC
    base           VARCHAR2(50),
    app_id         NUMBER           -- opcional: dispensa a busca pelo alias
  );

  -- ── Mensagem para a pessoa ────────────────────────────────────────────────
  TYPE t_msg IS RECORD (
    campo VARCHAR2(100), tipo VARCHAR2(10), chave VARCHAR2(120), texto VARCHAR2(4000)
  );
  TYPE t_msgs IS TABLE OF t_msg INDEX BY PLS_INTEGER;

  g_msgs t_msgs;

  /* Rascunho da solicitação: os mesmos campos dos itens P78_* da página.
     Tipos conferidos contra o DDL (vscode-claude/tables):
       opcao_ferias    NUMBER(3)  — é código, não texto
       desc_adicional1 NUMBER(2)  — é QUANTIDADE de dias, não flag S/N
       filial e dias_direito NÃO são colunas: filial vem de
       INFORMACOES_FUNCIONAIS e dias_direito é calculado dentro de
       Valida_Dt_Saida_Parc1 (pdias_direito := psaldo, ajustado por jornada
       reduzida e dividido por 2 quando o período está em dobro). */
  TYPE t_rasc IS RECORD (
    cod_empresa           NUMBER,
    matricula             NUMBER,
    dc_matricula          NUMBER,
    filial                NUMBER,
    opcao_ferias          NUMBER,
    parcelas_opc          NUMBER,
    ind_situacao_periodo  VARCHAR2(1),
    dt_inic_per_ferias    DATE,
    dt_fim_per_ferias     DATE,
    dias_direito          NUMBER,
    saldo                 NUMBER,
    saldo_bruto           NUMBER,
    falta_hora            NUMBER,
    falta_minuto          NUMBER,
    jornada_reduzida      VARCHAR2(1),
    havera_rep            VARCHAR2(1),
    desc_adicional1       NUMBER,
    dias_descanso_adic    NUMBER,
    -- parcela 1
    dt_saida_parc1        DATE,
    dt_retorno_parc1      DATE,
    dt_pagto_parc1        DATE,
    num_dias_parc1        NUMBER,
    dias_abono_pec1       NUMBER,
    opcao_abono_pec1      VARCHAR2(1),
    opcao_13sal1          VARCHAR2(1),
    tipo_ferias1          VARCHAR2(1),
    -- parcela 2
    dt_saida_parc2        DATE,
    dt_retorno_parc2      DATE,
    num_dias_parc2        NUMBER,
    dias_abono_pec2       NUMBER,
    opcao_13sal2          VARCHAR2(1),
    -- parcela 3 (na tela é a "3ª"; no banco é a 4)
    dt_saida_parc4        DATE,
    dt_retorno_parc4      DATE,
    num_dias_parc4        NUMBER,
    dias_abono_pec4       NUMBER,
    tipo_ferias2          VARCHAR2(1),
    opcao_abono_pec2      VARCHAR2(1),
    tipo_ferias4          VARCHAR2(1),
    opcao_abono_pec4      VARCHAR2(1),
    opcao_13sal4          VARCHAR2(1)
  );

  -- Cache alias -> id da aplicação APEX (ver app_id()).
  TYPE t_apps IS TABLE OF NUMBER INDEX BY VARCHAR2(100);
  g_apps t_apps;

  -- ══════════════════════════════════════════════════════════════════════════
  -- Infra
  -- ══════════════════════════════════════════════════════════════════════════

  /* Leitura TOLERANTE de número e data.

     Quem chama é o motor de ferramentas do chat, e ele serializa o valor como
     ele veio do token — `"1"` e `1` são ambos possíveis para a mesma empresa.
     `apex_json.get_number` estoura no primeiro caso. Ler como texto e converter
     aceita os dois, e devolve NULL em vez de derrubar a requisição por causa de
     um par de aspas. */
  FUNCTION num_de(p_path VARCHAR2) RETURN NUMBER IS
    v VARCHAR2(200);
  BEGIN
    v := TRIM(apex_json.get_varchar2(p_path));
    IF v IS NULL THEN RETURN NULL; END IF;
    RETURN TO_NUMBER(REPLACE(v, ',', '.'), '9999999999999.9999',
                     'NLS_NUMERIC_CHARACTERS=''.,''');
  EXCEPTION WHEN OTHERS THEN RETURN NULL;
  END num_de;

  FUNCTION dt_de(p_path VARCHAR2) RETURN DATE IS
    v VARCHAR2(60);
  BEGIN
    v := TRIM(apex_json.get_varchar2(p_path));
    IF v IS NULL THEN RETURN NULL; END IF;
    -- ISO primeiro (é o que a máscara da ferramenta produz), depois pt-BR, que
    -- é o que aparece quando alguém testa a API na mão.
    BEGIN RETURN TO_DATE(SUBSTR(v, 1, 10), 'YYYY-MM-DD');
    EXCEPTION WHEN OTHERS THEN RETURN TO_DATE(SUBSTR(v, 1, 10), 'DD/MM/YYYY');
    END;
  EXCEPTION WHEN OTHERS THEN RETURN NULL;
  END dt_de;

  /* Lê a identidade do corpo. `p_usuario` NUNCA é literal ('PORTAL'/'CHAT'):
     pkg_aprovacao_coletiva.executa resolve o PERFIL do aprovador por
     usuario_oracle.nm_usuario_oracle, e o nome vai para aprova_ferias.usuario. */
  FUNCTION ident RETURN t_ident IS
    l t_ident;
  BEGIN
    l.usuario        := apex_json.get_varchar2('identidade.p_usuario');
    l.empresa_user   := num_de('identidade.p_empresa_user');
    l.matricula_user := num_de('identidade.p_matricula_user');
    l.perfil         := apex_json.get_varchar2('identidade.p_perfil');
    l.painel         := NVL(apex_json.get_varchar2('identidade.p_painel'), 'PC');
    l.base           := apex_json.get_varchar2('identidade.p_base');
    l.app_id         := num_de('identidade.p_app_id');

    IF l.usuario IS NULL OR l.empresa_user IS NULL OR l.matricula_user IS NULL THEN
      raise_application_error(-20401, 'Identidade incompleta.');
    END IF;
    RETURN l;
  END ident;

  /* Qual APLICAÇÃO APEX é esta.

     O id é NUMÉRICO e muda de base para base — nada de constante aqui. O que é
     estável é o ALIAS, pela convenção painel + '_' + base: PO_NATCORP,
     PG_NATCORP, PC_NATCORP. `apex_session.create_session` só aceita id, então o
     alias vira id por consulta a APEX_APPLICATIONS, com cache por chamada de
     pacote (a resposta não muda dentro de uma sessão de banco).

     Instalação que fuja da convenção manda `identidade.p_app_id` e o alias nem
     é consultado. */
  FUNCTION app_id(p t_ident) RETURN NUMBER IS
    l_alias VARCHAR2(100) := UPPER(p.painel || '_' || p.base);
    l_id    NUMBER;
  BEGIN
    IF p.app_id IS NOT NULL THEN
      RETURN p.app_id;
    END IF;
    IF g_apps.EXISTS(l_alias) THEN
      RETURN g_apps(l_alias);
    END IF;

    SELECT application_id INTO l_id
      FROM apex_applications
     WHERE UPPER(alias) = l_alias
       AND ROWNUM = 1;

    g_apps(l_alias) := l_id;
    RETURN l_id;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      raise_application_error(-20404,
        'Não encontrei aplicação APEX com o alias ' || l_alias ||
        '. Envie identidade.p_app_id ou confira a convenção painel_base.');
  END app_id;

  /* Sessão APEX: usuario.busca_user devolve P_USUARIO. Sem sessão, o carimbo de
     `usuario` na conclusão (PRC_ATUALIZA_REQ l.1012 e l.1060) se perde — e, se
     busca_user usar apex_util.get_session_state, pode até levantar exceção e
     derrubar a conclusão. Criar a sessão cobre os dois casos e faz o legado se
     comportar exatamente como pela tela.

     `p_page_id => 78` é a página de férias, e ela tem o MESMO número nos três
     painéis (operador, gestor e colaborador). Nada aqui renderiza página — a
     sessão existe só para o estado — mas usar a página real deixa a sessão
     idêntica à que a tela cria, inclusive para quem leia v('APP_PAGE_ID'). */
  PROCEDURE abre_sessao(p t_ident) IS
  BEGIN
    apex_session.create_session(p_app_id   => app_id(p),
                                p_page_id  => c_pagina_ferias,
                                p_username => p.usuario);
    apex_util.set_session_state('P_USUARIO',        p.usuario);
    apex_util.set_session_state('P_EMPRESA_USER',   p.empresa_user);
    apex_util.set_session_state('P_MATRICULA_USER', p.matricula_user);
    apex_util.set_session_state('P_PERFIL',         p.perfil);
    apex_util.set_session_state('P_PAINEL',         p.painel);
    apex_util.set_session_state('P_BASE',           p.base);
  END abre_sessao;

  PROCEDURE fecha_sessao IS
  BEGIN
    apex_session.delete_session;
  EXCEPTION WHEN OTHERS THEN NULL;
  END fecha_sessao;

  PROCEDURE zera_msgs IS
  BEGIN
    g_msgs.DELETE;
  END zera_msgs;

  /* Traduz pflg_retorno/pmsg_retorno do pkg_ferias:
       'N' -> erro (não segue)   'S' com msg -> aviso (segue, mas precisa dizer)
       'Q' -> confirmar (pergunta e só segue com o "sim")                     */
  PROCEDURE guarda(p_campo VARCHAR2, p_flg VARCHAR2, p_msg VARCHAR2, p_chave VARCHAR2 DEFAULT NULL) IS
    i PLS_INTEGER := g_msgs.COUNT + 1;
  BEGIN
    IF TRIM(p_msg) IS NULL AND NVL(p_flg,'S') = 'S' THEN
      RETURN;
    END IF;
    g_msgs(i).campo := p_campo;
    g_msgs(i).chave := NVL(p_chave, p_campo);
    g_msgs(i).tipo  := CASE NVL(p_flg,'S') WHEN 'N' THEN 'erro'
                                           WHEN 'Q' THEN 'confirmar'
                                           ELSE 'aviso' END;
    -- SQLERRM nunca chega à pessoa: quase toda procedure faz
    -- 'WHEN OTHERS THEN pmsg_retorno := "..." || SQLERRM'.
    g_msgs(i).texto := CASE WHEN INSTR(UPPER(p_msg), 'ORA-') > 0
                            THEN 'Não foi possível validar este campo. A equipe técnica foi notificada.'
                            ELSE SUBSTR(p_msg, 1, 4000) END;
  END guarda;

  FUNCTION tem_erro RETURN BOOLEAN IS
  BEGIN
    FOR i IN 1 .. g_msgs.COUNT LOOP
      IF g_msgs(i).tipo = 'erro' THEN RETURN TRUE; END IF;
    END LOOP;
    RETURN FALSE;
  END tem_erro;

  /* Um 'Q' já confirmado pela pessoa vale como 'S'. É o equivalente do
     alertify.confirm da página 78. */
  FUNCTION confirmado(p_chave VARCHAR2) RETURN BOOLEAN IS
    n NUMBER := 0;
  BEGIN
    n := apex_json.get_count('confirmacoes');
    FOR i IN 1 .. NVL(n,0) LOOP
      IF apex_json.get_varchar2('confirmacoes[%d]', i) = p_chave THEN RETURN TRUE; END IF;
    END LOOP;
    RETURN FALSE;
  END confirmado;

  PROCEDURE escreve_msgs IS
  BEGIN
    apex_json.open_array('mensagens');
    FOR i IN 1 .. g_msgs.COUNT LOOP
      apex_json.open_object;
      apex_json.write('campo', g_msgs(i).campo);
      apex_json.write('tipo',  g_msgs(i).tipo);
      IF g_msgs(i).tipo = 'confirmar' THEN apex_json.write('chave', g_msgs(i).chave); END IF;
      apex_json.write('texto', g_msgs(i).texto);
      apex_json.close_object;
    END LOOP;
    apex_json.close_array;
  END escreve_msgs;

  /* Escopo por painel — mesma semântica da LOV
     pkg_list_matricula.fnc_list2(cod_empresa, p_painel, p_empresa_user, p_matricula_user).
     PC ignora a matrícula recebida e usa a da identidade: a UI esconde, o
     servidor recusa. */
  PROCEDURE aplica_escopo(p t_ident, p_cod_empresa IN OUT NUMBER, p_matricula IN OUT NUMBER) IS
    v NUMBER := 0;
  BEGIN
    IF p.painel = 'PC' OR p_matricula IS NULL THEN
      p_cod_empresa := p.empresa_user;
      p_matricula   := p.matricula_user;
      RETURN;
    END IF;

    -- Empresa em branco = a de quem perguntou. O modelo raramente informa a
    -- empresa quando pergunta de alguém da própria equipe.
    p_cod_empresa := NVL(p_cod_empresa, p.empresa_user);

    IF p.painel = 'PG' THEN
      -- ⚠ CONFIRMAR: trocar por fnc_list2 quando o fonte estiver disponível.
      -- O código do centro de custo em CENTRO_DE_CUSTO é a coluna `cod`
      -- (não `cod_ccusto`, que é o nome dela em INFORMACOES_FUNCIONAIS).
      SELECT COUNT(*) INTO v
        FROM informacoes_funcionais i
       WHERE i.cod_empresa = p_cod_empresa
         AND i.matricula   = p_matricula
         AND (i.cod_ccusto, i.cod_empresa) IN
             (SELECT c.cod, c.cod_empresa FROM centro_de_custo c
               WHERE (c.cod_emp_gestor = p.empresa_user AND c.matricula_gestor = p.matricula_user)
                  OR (c.cod_emp_suplente = p.empresa_user AND c.matricula_suplente = p.matricula_user));
      IF v = 0 THEN
        raise_application_error(-20403, 'Sem permissão para esta matrícula.');
      END IF;
    END IF;
  END aplica_escopo;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 2.1  GET /ferias/situacao
  -- ══════════════════════════════════════════════════════════════════════════
  PROCEDURE situacao(p_json IN CLOB, p_out OUT CLOB) IS
    l_id   t_ident;
    l_emp  NUMBER;
    l_mat  NUMBER;
    l_flg  VARCHAR2(3);
    l_msg  VARCHAR2(4000);
    l_r    t_rasc;
    l_nome VARCHAR2(200);
  BEGIN
    apex_json.parse(p_json);
    zera_msgs;
    l_id  := ident;
    l_emp := num_de('cod_empresa');
    l_mat := num_de('matricula');
    aplica_escopo(l_id, l_emp, l_mat);
    abre_sessao(l_id);

    pkg_ferias.Valida_Matricula_Solicitado(l_emp, l_mat, l_flg, l_msg);
    guarda('matricula', l_flg, l_msg);

    IF NOT tem_erro THEN
      -- ⚠ CONFIRMAR: na página isto é pkg_req_ferias.pg78_carrega. Sem o fonte,
      -- a leitura abaixo cobre o essencial; trocar pela chamada quando houver.
      --
      -- `dias_direito` NÃO é coluna de FERIAS: quem o calcula é
      -- Valida_Dt_Saida_Parc1, a partir do saldo. Aqui ele nem aparece — antes
      -- de haver data escolhida, o número honesto é o SALDO.
      BEGIN
        SELECT i.filial, p.nome
          INTO l_r.filial, l_nome
          FROM informacoes_funcionais i, inf_pessoais p
         WHERE i.cod_empresa = l_emp AND i.matricula = l_mat
           AND p.cod_empresa = i.cod_empresa AND p.matricula = i.matricula;

        SELECT f.dt_inic_per_ferias, f.dt_fim_per_ferias, f.ind_situacao_periodo,
               f.saldo, f.saldo_bruto
          INTO l_r.dt_inic_per_ferias, l_r.dt_fim_per_ferias, l_r.ind_situacao_periodo,
               l_r.saldo, l_r.saldo_bruto
          FROM ferias f
         WHERE f.cod_empresa = l_emp AND f.matricula = l_mat
           AND f.ind_situacao_periodo IN ('A','P')
           AND ROWNUM = 1;
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          guarda('periodo','N','Não encontrei período aquisitivo aberto para este colaborador.');
      END;
    END IF;

    apex_json.initialize_clob_output;
    apex_json.open_object;
      apex_json.write('ok', NOT tem_erro);
      apex_json.open_object('colaborador');
        apex_json.write('cod_empresa', l_emp);
        apex_json.write('matricula',   l_mat);
        apex_json.write('nome',        l_nome);
        apex_json.write('filial',      l_r.filial);
      apex_json.close_object;
      apex_json.open_object('periodo');
        apex_json.write('dt_inic_per_ferias',   l_r.dt_inic_per_ferias);
        apex_json.write('dt_fim_per_ferias',    l_r.dt_fim_per_ferias);
        apex_json.write('ind_situacao_periodo', l_r.ind_situacao_periodo);
      apex_json.close_object;
      apex_json.open_object('saldo');
        apex_json.write('saldo',        l_r.saldo);
        apex_json.write('saldo_bruto',  l_r.saldo_bruto);
      apex_json.close_object;
      escreve_msgs;
    apex_json.close_object;
    p_out := apex_json.get_clob_output;
    apex_json.free_output;
    fecha_sessao;
  EXCEPTION
    WHEN OTHERS THEN fecha_sessao; RAISE;
  END situacao;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 2.2  GET /ferias/opcoes
  -- ⚠ CONFIRMAR: depende de pkg_list.fnc_list_opc_prog_ferias e de
  --    pkg_list_matricula.fnc_list_numdias, cujos fontes não foram fornecidos.
  --    A leitura de FERIAS_PARAMETROS_PARCELAS abaixo já é a fonte da verdade
  --    de funcFeriasParamParcela_APEX, então serve de base.
  -- ══════════════════════════════════════════════════════════════════════════
  PROCEDURE opcoes(p_json IN CLOB, p_out OUT CLOB) IS
    l_id  t_ident;
    l_emp NUMBER;
    l_mat NUMBER;
    l_fil NUMBER;
  BEGIN
    apex_json.parse(p_json);
    zera_msgs;
    l_id  := ident;
    l_emp := num_de('cod_empresa');
    l_mat := num_de('matricula');
    aplica_escopo(l_id, l_emp, l_mat);
    abre_sessao(l_id);

    SELECT i.filial INTO l_fil
      FROM informacoes_funcionais i
     WHERE i.cod_empresa = l_emp AND i.matricula = l_mat;

    apex_json.initialize_clob_output;
    apex_json.open_object;
      apex_json.write('ok', TRUE);
      apex_json.open_array('combinacoes');
      FOR c IN (SELECT p.num_dias_parc1, p.num_dias_parc2, p.num_dias_parc4,
                       p.dias_abono_pec1, p.dias_abono_pec2, p.dias_abono_pec4
                  FROM ferias_parametros_parcelas p
                 WHERE p.cod_empresa = l_emp AND p.cod_filial = l_fil
                 ORDER BY p.num_dias_parc1 DESC, p.num_dias_parc2, p.num_dias_parc4)
      LOOP
        apex_json.open_object;
          apex_json.write('num_dias_parc1',  c.num_dias_parc1);
          apex_json.write('num_dias_parc2',  c.num_dias_parc2);
          apex_json.write('num_dias_parc4',  c.num_dias_parc4);
          apex_json.write('dias_abono_pec1', c.dias_abono_pec1);
          apex_json.write('dias_abono_pec2', c.dias_abono_pec2);
          apex_json.write('dias_abono_pec4', c.dias_abono_pec4);
        apex_json.close_object;
      END LOOP;
      apex_json.close_array;
      escreve_msgs;
    apex_json.close_object;
    p_out := apex_json.get_clob_output;
    apex_json.free_output;
    fecha_sessao;
  EXCEPTION
    WHEN OTHERS THEN fecha_sessao; RAISE;
  END opcoes;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 2.3  POST /ferias/simular
  --
  -- As validações do pkg_ferias são IN OUT: elas CALCULAM e ALTERAM. Por isso a
  -- resposta é o RASCUNHO RECALCULADO, não um ok/erro — VALIDA_DT_SAIDA chega a
  -- mover a data de saída (+1) quando o dia é feriado e proximo_dia = 'S'.
  -- ══════════════════════════════════════════════════════════════════════════
  PROCEDURE le_rascunho(r IN OUT t_rasc) IS
    pfx VARCHAR2(40);
  BEGIN
    r.cod_empresa          := num_de('cod_empresa');
    r.matricula            := num_de('matricula');
    r.opcao_ferias         := num_de('opcao_ferias');                    -- NUMBER(3)
    r.dt_inic_per_ferias   := dt_de ('dt_inic_per_ferias');
    r.dt_fim_per_ferias    := dt_de ('dt_fim_per_ferias');
    r.ind_situacao_periodo := apex_json.get_varchar2('ind_situacao_periodo');
    r.desc_adicional1      := num_de('desc_adicional');                  -- dias, não flag
    r.havera_rep           := NVL(apex_json.get_varchar2('havera_rep'), 'N');

    /* Parcelas: despacho pelo campo `n`, NUNCA pela posição no array.

       O motor de ferramentas do chat REMOVE do corpo as posições que a pessoa
       não preencheu. Uma solicitação com 1ª e 3ª parcelas chega como um array de
       DOIS elementos — ler por posição gravaria a terceira parcela no lugar da
       segunda, sem erro nenhum: datas plausíveis, no campo errado.

       `n` 1 e 2 são as parcelas 1 e 2; `n` 3 é a "3ª" da tela, que no banco é a
       parcela 4 (a 3 é férias coletiva). */
    FOR i IN 1 .. NVL(apex_json.get_count('parcelas'), 0) LOOP
      pfx := 'parcelas[' || i || '].';
      CASE num_de(pfx || 'n')
        WHEN 1 THEN
          r.dt_saida_parc1   := dt_de (pfx || 'dt_saida');
          r.num_dias_parc1   := num_de(pfx || 'num_dias');
          r.dias_abono_pec1  := num_de(pfx || 'dias_abono_pec');
          r.opcao_abono_pec1 := NVL(apex_json.get_varchar2(pfx || 'opcao_abono_pec'), 'N');
          r.opcao_13sal1     := NVL(apex_json.get_varchar2(pfx || 'opcao_13sal'), 'N');
        WHEN 2 THEN
          r.dt_saida_parc2   := dt_de (pfx || 'dt_saida');
          r.num_dias_parc2   := num_de(pfx || 'num_dias');
          r.dias_abono_pec2  := num_de(pfx || 'dias_abono_pec');
          r.opcao_abono_pec2 := NVL(apex_json.get_varchar2(pfx || 'opcao_abono_pec'), 'N');
          r.opcao_13sal2     := NVL(apex_json.get_varchar2(pfx || 'opcao_13sal'), 'N');
        WHEN 3 THEN
          r.dt_saida_parc4   := dt_de (pfx || 'dt_saida');
          r.num_dias_parc4   := num_de(pfx || 'num_dias');
          r.dias_abono_pec4  := num_de(pfx || 'dias_abono_pec');
          r.opcao_abono_pec4 := NVL(apex_json.get_varchar2(pfx || 'opcao_abono_pec'), 'N');
          r.opcao_13sal4     := NVL(apex_json.get_varchar2(pfx || 'opcao_13sal'), 'N');
        ELSE NULL;  -- posição sem `n` reconhecível: ignora em vez de adivinhar
      END CASE;
    END LOOP;
  END le_rascunho;

  PROCEDURE carrega_contexto(r IN OUT t_rasc) IS
  BEGIN
    SELECT i.filial, i.dc_matricula INTO r.filial, r.dc_matricula
      FROM informacoes_funcionais i
     WHERE i.cod_empresa = r.cod_empresa AND i.matricula = r.matricula;

    SELECT f.saldo, f.saldo_bruto, f.ind_situacao_periodo,
           NVL(f.falta_hora,0), NVL(f.falta_minuto,0)
      INTO r.saldo, r.saldo_bruto, r.ind_situacao_periodo,
           r.falta_hora, r.falta_minuto
      FROM ferias f
     WHERE f.cod_empresa = r.cod_empresa AND f.matricula = r.matricula
       AND f.dt_inic_per_ferias = r.dt_inic_per_ferias
       AND ROWNUM = 1;

    -- dias_direito entra IN OUT em Valida_Dt_Saida_Parc1, que o recalcula a
    -- partir do saldo (jornada reduzida, período em dobro). Semear com o saldo
    -- é o que a própria procedure faz na primeira linha.
    r.dias_direito     := NVL(r.dias_direito, r.saldo);
    r.jornada_reduzida := NVL(r.jornada_reduzida, 'N');
  END carrega_contexto;

  /* Cadeia da PARCELA 1 — gabarito. Parcelas 2 e 4 repetem o padrão com
     Valida_Dt_Saida_Parc2/4 e Valida_Num_Dias_Parc2/4. */
  PROCEDURE valida_parc1(r IN OUT t_rasc) IS
    l_flg      VARCHAR2(3) := 'S';
    l_msg      VARCHAR2(4000);
    l_abono_ds VARCHAR2(200);
    l_dias_ds  VARCHAR2(200);
    l_saida_ant DATE := r.dt_saida_parc1;
  BEGIN
    IF r.dt_saida_parc1 IS NULL THEN RETURN; END IF;

    pkg_ferias.Valida_Dt_Saida_Parc1(
      pcod_empresa          => r.cod_empresa,
      psolicitacao          => NULL,
      pmatricula            => r.matricula,
      pdt_inic_per_ferias   => r.dt_inic_per_ferias,
      pdt_fim_per_ferias    => r.dt_fim_per_ferias,
      pdt_saida_parc2       => r.dt_saida_parc2,
      psaldo_bruto          => r.saldo_bruto,
      pfalta_hora           => r.falta_hora,
      pdias_direito         => r.dias_direito,
      pdt_saida_parc1       => r.dt_saida_parc1,
      psaldo                => r.saldo,
      pdias_abono_pec1      => r.dias_abono_pec1,
      pnum_dias_parc1       => r.num_dias_parc1,
      popcao_13sal1         => r.opcao_13sal1,
      popcao_13sal2         => r.opcao_13sal2,
      ptipo_ferias1         => r.tipo_ferias1,
      pdt_retorno_parc1     => r.dt_retorno_parc1,
      pdt_pagto_parc1       => r.dt_pagto_parc1,
      pjornada_reduzida     => r.jornada_reduzida,
      pind_situacao_periodo => r.ind_situacao_periodo,
      pdias_abono_pec1_dsp  => l_abono_ds,
      pnum_dias_parc1_dsp   => l_dias_ds,
      pflg_retorno          => l_flg,
      pmsg_retorno          => l_msg);

    -- 'Q' já confirmado pela pessoa vale como 'S'.
    IF l_flg = 'Q' AND confirmado('parcelas[0].dt_saida') THEN l_flg := 'S'; END IF;
    guarda('parcelas[0].dt_saida', l_flg, l_msg, 'parcelas[0].dt_saida');

    -- A data pode ter ANDADO. Se o chat não disser isso, a pessoa vê no
    -- contracheque uma data que ela nunca escolheu.
    IF l_saida_ant IS NOT NULL AND r.dt_saida_parc1 <> l_saida_ant THEN
      guarda('parcelas[0].dt_saida', 'S',
             'A data de saída foi ajustada de ' || TO_CHAR(l_saida_ant,'dd/mm/yyyy') ||
             ' para ' || TO_CHAR(r.dt_saida_parc1,'dd/mm/yyyy') || '.');
    END IF;
    IF tem_erro THEN RETURN; END IF;

    IF r.num_dias_parc1 IS NOT NULL THEN
      pkg_ferias.Valida_Num_Dias_Parc1(
        pcod_empresa             => r.cod_empresa,
        pmatricula               => r.matricula,
        pind_limpa               => 'N',
        pdt_fim_per_ferias       => r.dt_fim_per_ferias,
        psaldo                   => r.saldo,
        pdt_saida_parc1          => r.dt_saida_parc1,
        pnum_dias_parc1          => r.num_dias_parc1,
        pdt_retorno_parc1        => r.dt_retorno_parc1,
        pdias_descanso_adicional => r.dias_descanso_adic,
        pdesc_adicional1         => r.desc_adicional1,
        ptipo_ferias1            => r.tipo_ferias1,
        pdias_abono_pec1         => r.dias_abono_pec1,
        pdias_direito            => r.dias_direito,
        pind_situacao_periodo    => r.ind_situacao_periodo,
        pjornada_reduzida        => r.jornada_reduzida,
        pdias_abono_pec1_dsp     => l_abono_ds,
        pnum_dias_parc1_dsp      => l_dias_ds,
        pflg_retorno             => l_flg,
        pmsg_retorno             => l_msg);
      guarda('parcelas[0].num_dias', l_flg, l_msg);
      IF tem_erro THEN RETURN; END IF;
    END IF;

    pkg_ferias.Valida_Dias_Abono_Pec1(
      pcod_empresa          => r.cod_empresa,
      pmatricula            => r.matricula,
      pfilial               => r.filial,
      pdt_inic_per_ferias   => r.dt_inic_per_ferias,
      pdt_fim_per_ferias    => r.dt_fim_per_ferias,
      pnum_dias_parc1       => r.num_dias_parc1,
      pdt_saida_parc1       => r.dt_saida_parc1,
      psaldo                => r.saldo,
      pdias_abono_pec1      => r.dias_abono_pec1,
      popcao_abono_pec1     => r.opcao_abono_pec1,
      pind_situacao_periodo => r.ind_situacao_periodo,
      pdias_direito         => r.dias_direito,
      pusuario              => apex_util.get_session_state('P_USUARIO'),
      pflg_retorno          => l_flg,
      pmsg_retorno          => l_msg);
    guarda('parcelas[0].dias_abono_pec', l_flg, l_msg);
    IF tem_erro THEN RETURN; END IF;

    pkg_ferias.Valida_Opcao_13Sal1(
      pcod_empresa          => r.cod_empresa,
      pmatricula            => r.matricula,
      pdt_saida_parc1       => r.dt_saida_parc1,
      pdt_retorno_parc1     => r.dt_retorno_parc1,
      popcao_13sal1         => r.opcao_13sal1,
      pind_situacao_periodo => r.ind_situacao_periodo,
      PCOD_SOLICITACAO      => NULL,
      pflg_retorno          => l_flg,
      pmsg_retorno          => l_msg);
    guarda('parcelas[0].opcao_13sal', l_flg, l_msg);
    IF tem_erro THEN RETURN; END IF;

    pkg_ferias.Valida_Desc_Adicional1(
      pdesc_adicional1         => r.desc_adicional1,
      pdias_descanso_adicional => r.dias_descanso_adic,
      pind_situacao_periodo    => r.ind_situacao_periodo,
      pflg_retorno             => l_flg,
      pmsg_retorno             => l_msg);
    guarda('desc_adicional', l_flg, l_msg);
    IF tem_erro THEN RETURN; END IF;

    pkg_ferias.Valida_Dt_Retorno_Parc1(
      pdt_retorno_parc1     => r.dt_retorno_parc1,
      pind_situacao_periodo => r.ind_situacao_periodo,
      pflg_retorno          => l_flg,
      pmsg_retorno          => l_msg,
      pdt_saida_parc1       => r.dt_saida_parc1,
      pdt_fim_per_ferias    => r.dt_fim_per_ferias,
      pcod_empresa          => r.cod_empresa,
      pmatricula            => r.matricula,
      pdt_inic_per_ferias   => r.dt_inic_per_ferias);
    guarda('parcelas[0].dt_retorno', l_flg, l_msg);
    IF tem_erro THEN RETURN; END IF;

    pkg_ferias.Valida_Tipo_Ferias1(
      pcod_empresa          => r.cod_empresa,
      pmatricula            => r.matricula,
      pdt_inic_per_ferias   => r.dt_inic_per_ferias,
      pdt_fim_per_ferias    => r.dt_fim_per_ferias,
      preferencia           => r.dt_saida_parc1,
      ptipo_ferias1         => r.tipo_ferias1,
      pind_situacao_periodo => r.ind_situacao_periodo,
      pflg_retorno          => l_flg,
      pmsg_retorno          => l_msg);
    guarda('parcelas[0].tipo_ferias', l_flg, l_msg);
  END valida_parc1;

  PROCEDURE escreve_estado(r t_rasc, p_pronto BOOLEAN) IS
  BEGIN
    apex_json.open_object('estado');
      apex_json.write('opcao_ferias', r.opcao_ferias);
      apex_json.open_array('parcelas');
        apex_json.open_object;
          apex_json.write('n', 1);
          apex_json.write('dt_saida',        r.dt_saida_parc1);
          apex_json.write('num_dias',        r.num_dias_parc1);
          apex_json.write('dias_abono_pec',  r.dias_abono_pec1);
          apex_json.write('opcao_abono_pec', r.opcao_abono_pec1);
          apex_json.write('opcao_13sal',     r.opcao_13sal1);
          apex_json.write('dt_retorno',      r.dt_retorno_parc1);
          apex_json.write('dt_pagto',        r.dt_pagto_parc1);
          apex_json.write('tipo_ferias',     r.tipo_ferias1);
        apex_json.close_object;
        IF r.dt_saida_parc2 IS NOT NULL THEN
          apex_json.open_object;
            apex_json.write('n', 2);
            apex_json.write('dt_saida',   r.dt_saida_parc2);
            apex_json.write('num_dias',   r.num_dias_parc2);
            apex_json.write('dt_retorno', r.dt_retorno_parc2);
            apex_json.write('opcao_13sal', r.opcao_13sal2);
          apex_json.close_object;
        END IF;
        IF r.dt_saida_parc4 IS NOT NULL THEN
          apex_json.open_object;
            apex_json.write('n', 3);
            apex_json.write('dt_saida',   r.dt_saida_parc4);
            apex_json.write('num_dias',   r.num_dias_parc4);
            apex_json.write('dt_retorno', r.dt_retorno_parc4);
            apex_json.write('opcao_13sal', r.opcao_13sal4);
          apex_json.close_object;
        END IF;
      apex_json.close_array;
      apex_json.open_object('saldo');
        apex_json.write('dias_direito', r.dias_direito);
        apex_json.write('saldo',        r.saldo);
        apex_json.write('dias_distribuidos',
                        NVL(r.num_dias_parc1,0) + NVL(r.num_dias_parc2,0) + NVL(r.num_dias_parc4,0));
      apex_json.close_object;
    apex_json.close_object;
    apex_json.write('pronto_para_criar', p_pronto);
  END escreve_estado;

  PROCEDURE simular(p_json IN CLOB, p_out OUT CLOB) IS
    l_id     t_ident;
    l_r      t_rasc;
    l_pronto BOOLEAN;
  BEGIN
    apex_json.parse(p_json);
    zera_msgs;
    l_id := ident;
    le_rascunho(l_r);
    aplica_escopo(l_id, l_r.cod_empresa, l_r.matricula);
    abre_sessao(l_id);
    carrega_contexto(l_r);

    valida_parc1(l_r);
    -- ⚠ CONFIRMAR: parcelas 2 e 4 seguem o mesmo padrão de valida_parc1, com
    -- Valida_Dt_Saida_Parc2/4, Valida_Num_Dias_Parc2/4, Valida_Abono_Pec2/4,
    -- Valida_Opcao_13Sal2/4, Valida_Desc_Adicional2/4 e Valida_Dt_Retorno_Parc2/4.

    -- A combinação de dias TEM que existir na parametrização — é a mesma porta
    -- que funcFeriasParamParcela_APEX guarda na página.
    IF NOT tem_erro AND l_r.num_dias_parc1 IS NOT NULL THEN
      IF NOT pkg_ferias.funcFeriasParamParcela_APEX(
               l_r.cod_empresa, l_r.filial,
               l_r.num_dias_parc1, l_r.num_dias_parc2, l_r.num_dias_parc4) THEN
        guarda('parcelas', 'N',
               'Esta divisão de dias não existe na parametrização de férias da sua filial.');
      END IF;
    END IF;

    l_pronto := NOT tem_erro
                AND l_r.dt_saida_parc1 IS NOT NULL
                AND l_r.num_dias_parc1 IS NOT NULL
                AND l_r.opcao_ferias   IS NOT NULL;

    apex_json.initialize_clob_output;
    apex_json.open_object;
      apex_json.write('ok', NOT tem_erro);
      escreve_estado(l_r, l_pronto);
      escreve_msgs;
    apex_json.close_object;
    p_out := apex_json.get_clob_output;
    apex_json.free_output;
    fecha_sessao;
  EXCEPTION
    WHEN OTHERS THEN fecha_sessao; RAISE;
  END simular;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 2.4  POST /ferias/criar        ESCRITA
  -- ══════════════════════════════════════════════════════════════════════════
  PROCEDURE criar(p_json IN CLOB, p_out OUT CLOB) IS
    l_id       t_ident;
    l_r        t_rasc;
    l_flg      VARCHAR2(3) := 'S';
    l_msg      VARCHAR2(4000);
    l_sol      NUMBER;
    l_sit      VARCHAR2(1);   -- REQUISICAO_FERIAS.sit_requisicao é VARCHAR2(1)
    l_pend     NUMBER := 0;
  BEGIN
    apex_json.parse(p_json);
    zera_msgs;
    l_id := ident;
    le_rascunho(l_r);
    aplica_escopo(l_id, l_r.cod_empresa, l_r.matricula);
    abre_sessao(l_id);
    carrega_contexto(l_r);

    -- 1. Revalida do zero. Nunca confiar no que veio do cliente — é o que o
    --    AFTER_SUBMIT da página 78 também faz.
    valida_parc1(l_r);
    IF NOT tem_erro THEN
      pkg_ferias.Valida_Update_Rf(
        pcod_empresa       => l_r.cod_empresa,
        pfilial            => l_r.filial,
        pdt_saida_parc1    => l_r.dt_saida_parc1,
        pdt_fim_per_ferias => l_r.dt_fim_per_ferias,
        pnum_dias_parc1    => l_r.num_dias_parc1,
        pdias_abono_pec1   => l_r.dias_abono_pec1,
        psaldo             => l_r.saldo,
        pmatricula         => l_r.matricula,
        pjornada_reduzida  => l_r.jornada_reduzida,
        pflg_retorno       => l_flg,
        pmsg_retorno       => l_msg);
      guarda('requisicao', l_flg, l_msg);
    END IF;

    IF tem_erro THEN
      apex_json.initialize_clob_output;
      apex_json.open_object;
        apex_json.write('ok', FALSE);
        escreve_msgs;
      apex_json.close_object;
      p_out := apex_json.get_clob_output;
      apex_json.free_output;
      fecha_sessao;
      RETURN;
    END IF;

    -- 2. Numeração e situação inicial (PRE-INSERT_1 da página).
    SELECT seq_requisicao.NEXTVAL INTO l_sol FROM dual;

    -- 3. Pre_Insert
    l_flg := 'S'; l_msg := NULL;
    pkg_ferias.Pre_Insert(
      pcod_solicitacao      => l_sol,
      pcod_empresa          => l_r.cod_empresa,
      pfilial               => l_r.filial,
      pmatricula            => l_r.matricula,
      psit_requisicao       => 1,
      pind_situacao_periodo => l_r.ind_situacao_periodo,
      pdt_inic_per_ferias   => l_r.dt_inic_per_ferias,
      pdt_fim_per_ferias    => l_r.dt_fim_per_ferias,
      pnum_dias_parc1       => l_r.num_dias_parc1,
      psaldo                => l_r.saldo,
      pdt_saida_parc1       => l_r.dt_saida_parc1,
      pdt_saida_parc2       => l_r.dt_saida_parc2,
      pdt_saida_parc3       => NULL,           -- parc3 = coletiva, nunca pela tela
      pdt_saida_parc4       => l_r.dt_saida_parc4,
      pdt_retorno_parc1     => l_r.dt_retorno_parc1,
      pdt_retorno_parc2     => l_r.dt_retorno_parc2,
      pdt_retorno_parc3     => NULL,
      pdt_retorno_parc4     => l_r.dt_retorno_parc4,
      popcao_13sal1         => l_r.opcao_13sal1,
      popcao_13sal2         => l_r.opcao_13sal2,
      popcao_13sal4         => l_r.opcao_13sal4,
      pdias_abono_pec1      => l_r.dias_abono_pec1,
      pjornada_reduzida     => l_r.jornada_reduzida,
      pflg_retorno          => l_flg,
      pmsg_retorno          => l_msg,
      pparcelas_opc         => NVL(l_r.parcelas_opc, 1));
    guarda('requisicao', l_flg, l_msg);
    IF tem_erro THEN ROLLBACK; GOTO devolve; END IF;

    -- 4. INSERT — colunas conferidas contra o DDL (vscode-claude/tables).
    --    REQUISICAO_FERIAS NÃO tem `filial` (ela vive em INFORMACOES_FUNCIONAIS
    --    e só serve de parâmetro para as validações) e `sit_requisicao` é
    --    VARCHAR2(1) — o legado grava '1', '2', '4' como TEXTO.
    INSERT INTO requisicao_ferias (
      cod_solicitacao, cod_empresa, matricula, dc_matricula,
      sit_requisicao, dt_solicitacao,
      cod_emp_solicitante, matricula_solicitante, usuario,
      ind_situacao_periodo, dt_inic_per_ferias, dt_fim_per_ferias,
      opcao_ferias, saldo, saldo_bruto, falta_hora, falta_minuto,
      dt_saida_parc1, dt_retorno_parc1, num_dias_parc1, dias_abono_pec1,
      opcao_abono_pec1, opcao_13sal1, tipo_ferias1, dt_pagto_parc1,
      dt_saida_parc2, dt_retorno_parc2, num_dias_parc2, dias_abono_pec2,
      opcao_abono_pec2, opcao_13sal2, tipo_ferias2,
      dt_saida_parc4, dt_retorno_parc4, num_dias_parc4, dias_abono_pec4,
      opcao_abono_pec4, opcao_13sal4, tipo_ferias4,
      desc_adicional1, dias_descanso_adicional, havera_rep, dt_atualizacao
    ) VALUES (
      l_sol, l_r.cod_empresa, l_r.matricula, l_r.dc_matricula,
      '1', SYSDATE,
      l_id.empresa_user, l_id.matricula_user, SUBSTR(l_id.usuario,1,30),
      l_r.ind_situacao_periodo, l_r.dt_inic_per_ferias, l_r.dt_fim_per_ferias,
      l_r.opcao_ferias, l_r.saldo, l_r.saldo_bruto, l_r.falta_hora, l_r.falta_minuto,
      l_r.dt_saida_parc1, l_r.dt_retorno_parc1, l_r.num_dias_parc1, l_r.dias_abono_pec1,
      l_r.opcao_abono_pec1, l_r.opcao_13sal1, l_r.tipo_ferias1, l_r.dt_pagto_parc1,
      l_r.dt_saida_parc2, l_r.dt_retorno_parc2, l_r.num_dias_parc2, l_r.dias_abono_pec2,
      l_r.opcao_abono_pec2, l_r.opcao_13sal2, l_r.tipo_ferias2,
      l_r.dt_saida_parc4, l_r.dt_retorno_parc4, l_r.num_dias_parc4, l_r.dias_abono_pec4,
      l_r.opcao_abono_pec4, l_r.opcao_13sal4, l_r.tipo_ferias4,
      l_r.desc_adicional1, l_r.dias_descanso_adic, l_r.havera_rep, SYSDATE
    );

    -- 5. Aprovadores.
    l_flg := 'S'; l_msg := NULL;
    PRC_INSERE_APROVADOR(l_sol, 'REQ_FERIAS', l_flg, l_msg);
    guarda('aprovadores', l_flg, l_msg);
    IF tem_erro THEN ROLLBACK; GOTO devolve; END IF;

    -- 6. Avança o workflow.
    l_flg := 'S'; l_msg := NULL;
    PRC_ATUALIZA_REQ(l_r.cod_empresa, l_sol, l_flg, l_msg);
    guarda('workflow', l_flg, l_msg);
    IF tem_erro THEN ROLLBACK; GOTO devolve; END IF;

    -- 7. Post_Insert e commit único.
    l_flg := 'S'; l_msg := NULL;
    pkg_ferias.Post_Insert(l_r.cod_empresa, l_sol, l_id.usuario, l_flg, l_msg);
    guarda('requisicao', l_flg, l_msg);
    IF tem_erro THEN ROLLBACK; GOTO devolve; END IF;

    COMMIT;

    <<devolve>>
    -- 8. RELEITURA. Não é zelo: PRC_INSERE_APROVADOR só chama
    --    pkg_req.propostas_req_ferias se a janela de ferias_parametros
    --    (workflow_1/workflow_2) bater. Quando não bate, a única linha em
    --    APROVA_FERIAS é a do próprio solicitante, já 'A' — e o passo 6
    --    CONCLUI na hora, gravando na tabela FERIAS (a folha).
    BEGIN
      SELECT sit_requisicao INTO l_sit
        FROM requisicao_ferias WHERE cod_solicitacao = l_sol;
      SELECT COUNT(*) INTO l_pend
        FROM aprova_ferias WHERE cod_solicitacao = l_sol AND status_aprov = 'P';
    EXCEPTION WHEN NO_DATA_FOUND THEN l_sit := NULL;
    END;

    apex_json.initialize_clob_output;
    apex_json.open_object;
      apex_json.write('ok', NOT tem_erro);
      IF NOT tem_erro THEN
        apex_json.write('cod_solicitacao', l_sol);
        apex_json.write('sit_requisicao',  l_sit);
        apex_json.write('ja_concluida',    l_sit = '2');
        apex_json.open_array('aprovadores');
        FOR a IN (SELECT a.seq_aprov, a.cod_emp_aprov, a.mat_aprov, a.status_aprov, p.nome
                    FROM aprova_ferias a, inf_pessoais p
                   WHERE a.cod_solicitacao = l_sol
                     AND p.cod_empresa(+) = a.cod_emp_aprov
                     AND p.matricula(+)   = a.mat_aprov
                   ORDER BY a.seq_aprov)
        LOOP
          apex_json.open_object;
            apex_json.write('seq',         a.seq_aprov);
            apex_json.write('cod_empresa', a.cod_emp_aprov);
            apex_json.write('matricula',   a.mat_aprov);
            apex_json.write('nome',        a.nome);
            apex_json.write('status',      a.status_aprov);
          apex_json.close_object;
        END LOOP;
        apex_json.close_array;
      END IF;
      escreve_msgs;
    apex_json.close_object;
    p_out := apex_json.get_clob_output;
    apex_json.free_output;
    fecha_sessao;
  EXCEPTION
    WHEN OTHERS THEN ROLLBACK; fecha_sessao; RAISE;
  END criar;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 2.5  GET /ferias/minhas
  -- ══════════════════════════════════════════════════════════════════════════
  PROCEDURE minhas(p_json IN CLOB, p_out OUT CLOB) IS
    l_id  t_ident;
    l_emp NUMBER;
    l_mat NUMBER;
  BEGIN
    apex_json.parse(p_json);
    zera_msgs;
    l_id  := ident;
    l_emp := num_de('cod_empresa');
    l_mat := num_de('matricula');
    aplica_escopo(l_id, l_emp, l_mat);

    apex_json.initialize_clob_output;
    apex_json.open_object;
      apex_json.write('ok', TRUE);
      apex_json.open_array('itens');
      FOR r IN (SELECT rf.cod_solicitacao, rf.sit_requisicao, rf.dt_solicitacao,
                       rf.dt_saida_parc1, rf.dt_retorno_parc1, rf.num_dias_parc1,
                       (SELECT COUNT(*) FROM aprova_ferias a
                         WHERE a.cod_solicitacao = rf.cod_solicitacao
                           AND a.status_aprov = 'P') pendentes
                  FROM requisicao_ferias rf
                 WHERE rf.cod_empresa = l_emp AND rf.matricula = l_mat
                 ORDER BY rf.dt_solicitacao DESC)
      LOOP
        apex_json.open_object;
          apex_json.write('cod_solicitacao', r.cod_solicitacao);
          apex_json.write('sit_requisicao',  r.sit_requisicao);
          apex_json.write('situacao_texto',
            CASE r.sit_requisicao WHEN '1' THEN 'Aberta'    WHEN '2' THEN 'Concluída'
                                  WHEN '3' THEN 'Cancelada' WHEN '4' THEN 'Reprovada'
                                  WHEN '5' THEN 'Aprovada'  WHEN '6' THEN 'Suspensa' END);
          apex_json.write('dt_solicitacao',  r.dt_solicitacao);
          apex_json.write('dt_saida_parc1',  r.dt_saida_parc1);
          apex_json.write('dt_retorno_parc1',r.dt_retorno_parc1);
          apex_json.write('num_dias_parc1',  r.num_dias_parc1);
          apex_json.write('aprovadores_pendentes', r.pendentes);
        apex_json.close_object;
      END LOOP;
      apex_json.close_array;
    apex_json.close_object;
    p_out := apex_json.get_clob_output;
    apex_json.free_output;
  END minhas;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 2.6  GET /ferias/aprovacoes
  --
  -- A união abaixo reproduz o cursor c_suplente_aprova de
  -- pkg_aprovacao_coletiva.req_ferias (l.583-602) e as condições de exibição dos
  -- botões da página 78. Sem ela, o SUPLENTE não enxerga o que pode aprovar.
  -- ══════════════════════════════════════════════════════════════════════════
  PROCEDURE aprovacoes(p_json IN CLOB, p_out OUT CLOB) IS
    l_id  t_ident;
    l_flg VARCHAR2(3);
    l_msg VARCHAR2(4000);
  BEGIN
    apex_json.parse(p_json);
    zera_msgs;
    l_id := ident;
    abre_sessao(l_id);

    apex_json.initialize_clob_output;
    apex_json.open_object;
      apex_json.write('ok', TRUE);
      apex_json.open_array('itens');
      FOR r IN (
        SELECT a.cod_solicitacao, a.cod_empresa, a.cod_emp_aprov, a.mat_aprov, a.seq_aprov,
               rf.matricula, rf.dt_inic_per_ferias, rf.dt_fim_per_ferias,
               rf.dt_saida_parc1, rf.dt_retorno_parc1, rf.num_dias_parc1,
               p.nome nome_colaborador,
               (SELECT COUNT(*) FROM aprova_ferias x
                 WHERE x.cod_solicitacao = a.cod_solicitacao AND x.status_aprov = 'P') pendentes
          FROM aprova_ferias a, requisicao_ferias rf, inf_pessoais p
         WHERE a.cod_solicitacao = rf.cod_solicitacao
           AND p.cod_empresa(+)  = rf.cod_empresa
           AND p.matricula(+)    = rf.matricula
           AND a.status_aprov    = 'P'
           AND rf.sit_requisicao = '1'
           AND (    -- aprovador direto
                    (a.cod_emp_aprov = l_id.empresa_user AND a.mat_aprov = l_id.matricula_user)
                    -- suplente do centro de custo
                 OR EXISTS (SELECT 1 FROM centro_de_custo c
                             WHERE c.cod_emp_gestor    = a.cod_emp_aprov
                               AND c.matricula_gestor  = a.mat_aprov
                               AND c.cod_emp_suplente  = l_id.empresa_user
                               AND c.matricula_suplente= l_id.matricula_user)
                    -- substituto do sub-centro
                 OR EXISTS (SELECT 1 FROM sub_ccusto s
                             WHERE s.cod_emp_gestor = a.cod_emp_aprov
                               AND s.mat_gestor     = a.mat_aprov
                               AND s.cod_emp_subs   = l_id.empresa_user
                               AND s.mat_subs       = l_id.matricula_user))
         ORDER BY rf.dt_solicitacao)
      LOOP
        -- executa() NÃO confere a ordem de alçada; na aplicação a
        -- Valida_Sequencia só decide se o botão aparece.
        l_flg := 'S'; l_msg := NULL;
        pkg_ferias.Valida_Sequencia(r.cod_empresa, r.cod_solicitacao,
                                    r.cod_emp_aprov, r.mat_aprov, l_flg, l_msg);
        apex_json.open_object;
          apex_json.write('cod_solicitacao', r.cod_solicitacao);
          apex_json.open_object('colaborador');
            apex_json.write('matricula', r.matricula);
            apex_json.write('nome',      r.nome_colaborador);
          apex_json.close_object;
          apex_json.open_object('periodo');
            apex_json.write('dt_inic_per_ferias', r.dt_inic_per_ferias);
            apex_json.write('dt_fim_per_ferias',  r.dt_fim_per_ferias);
          apex_json.close_object;
          apex_json.write('dt_saida',   r.dt_saida_parc1);
          apex_json.write('dt_retorno', r.dt_retorno_parc1);
          apex_json.write('num_dias',   r.num_dias_parc1);
          apex_json.write('minha_vez',  NVL(l_flg,'S') = 'S');
          apex_json.write('motivo_bloqueio', CASE WHEN NVL(l_flg,'S') <> 'S' THEN l_msg END);
          apex_json.write('aprovadores_pendentes', r.pendentes);
          apex_json.write('sou_ultimo_aprovador',  r.pendentes = 1);
        apex_json.close_object;
      END LOOP;
      apex_json.close_array;
    apex_json.close_object;
    p_out := apex_json.get_clob_output;
    apex_json.free_output;
    fecha_sessao;
  EXCEPTION
    WHEN OTHERS THEN fecha_sessao; RAISE;
  END aprovacoes;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 2.7  POST /ferias/aprovacoes/{cod}        ESCRITA
  -- ══════════════════════════════════════════════════════════════════════════
  PROCEDURE aprovar(p_json IN CLOB, p_out OUT CLOB) IS
    l_id     t_ident;
    l_sol    NUMBER;
    l_status VARCHAR2(1);
    l_just   VARCHAR2(4000);
    l_emp    NUMBER;
    l_flg    VARCHAR2(3);
    l_msg    VARCHAR2(4000);
    l_antes  NUMBER;
    l_depois NUMBER;
    l_sit    VARCHAR2(1);
    l_efeito VARCHAR2(30);
    l_canceladas PLS_INTEGER := 0;
  BEGIN
    apex_json.parse(p_json);
    zera_msgs;
    l_id     := ident;
    l_sol    := num_de('cod_solicitacao');
    l_status := UPPER(apex_json.get_varchar2('status'));
    l_just   := apex_json.get_varchar2('justificativa');

    -- 1. Justificativa é obrigatória — validação da própria página 2973.
    IF TRIM(l_just) IS NULL THEN
      guarda('justificativa','N','A justificativa é obrigatória!');
    ELSIF l_status NOT IN ('A','R') THEN
      guarda('status','N','Status inválido. Use A (aprovar) ou R (reprovar).');
    END IF;

    IF NOT tem_erro THEN
      abre_sessao(l_id);
      SELECT c.empresa_req INTO l_emp
        FROM consulta_requisicoes c WHERE c.solicitacao = l_sol AND ROWNUM = 1;

      -- 2. Ordem de alçada — obrigatório aqui, executa() não confere.
      l_flg := 'S';
      pkg_ferias.Valida_Sequencia(l_emp, l_sol, l_id.empresa_user, l_id.matricula_user, l_flg, l_msg);
      guarda('sequencia', l_flg, l_msg);
    END IF;

    IF NOT tem_erro AND l_status = 'A' THEN
      /* 3. Cancela a programação ANTERIOR do mesmo período aquisitivo.

         Isto é da página 2973, não do pkg_aprovacao_coletiva: quando
         FERIAS_PARAMETROS.RECRIAR_REQ_CONCL_FUNC = 'S', aprovar uma requisição
         de férias CANCELA (sit_requisicao = 3) as outras do mesmo período que
         ainda estejam a mais de DIAS_ANTES_PAGTO_FERIAS da saída.

         Sem isto, aprovar pelo chat deixaria DUAS programações vivas para o
         mesmo período aquisitivo — e a tela deixaria uma. Ninguém veria a
         diferença até a folha. */
      FOR c IN (
        SELECT b.cod_solicitacao
          FROM requisicao_ferias b,
               consulta_requisicoes cr,
               ferias_parametros fp
         WHERE cr.solicitacao   = l_sol
           AND fp.cod_empresa(+) = cr.cod_empresa
           AND fp.cod_filial(+)  = cr.filial
           AND NVL(fp.recriar_req_concl_func, 'N') = 'S'
           AND b.cod_empresa     = cr.cod_empresa
           AND b.matricula       = cr.mat_solicitado
           AND b.cod_solicitacao <> l_sol
           AND (b.dt_saida_parc1 - TRUNC(SYSDATE)) + 1 >= fp.dias_antes_pagto_ferias
           AND EXISTS (SELECT 1
                         FROM requisicao_ferias a
                        WHERE a.cod_empresa       = b.cod_empresa
                          AND a.cod_solicitacao   = l_sol
                          AND a.dt_inic_per_ferias = b.dt_inic_per_ferias
                          AND a.dt_fim_per_ferias  = b.dt_fim_per_ferias))
      LOOP
        UPDATE requisicao_ferias
           SET sit_requisicao = '3',
               usuario        = TO_CHAR(l_id.empresa_user) || '/' || TO_CHAR(l_id.matricula_user),
               dt_atualizacao = SYSDATE
         WHERE cod_solicitacao = c.cod_solicitacao;
        l_canceladas := l_canceladas + 1;
      END LOOP;
    END IF;

    IF NOT tem_erro THEN
      -- 4. Estado ANTES.
      SELECT COUNT(*) INTO l_antes
        FROM aprova_ferias WHERE cod_solicitacao = l_sol AND status_aprov = 'P';

      -- 5. O legado. Ele commita por dentro — não há transação para desfazer.
      l_flg := 'S'; l_msg := NULL;
      pkg_aprovacao_coletiva.executa(l_sol, l_status, l_id.empresa_user,
                                     l_id.matricula_user, l_id.usuario, l_just,
                                     l_flg, l_msg);
      guarda('aprovacao', l_flg, l_msg);

      -- 6. Estado DEPOIS.
      SELECT COUNT(*) INTO l_depois
        FROM aprova_ferias WHERE cod_solicitacao = l_sol AND status_aprov = 'P';
      SELECT sit_requisicao INTO l_sit
        FROM requisicao_ferias WHERE cod_solicitacao = l_sol;

      -- 7. Responde pelo estado OBSERVADO, nunca pelo pflg_retorno: o
      --    'update aprova_ferias' de req_ferias não olha SQL%ROWCOUNT, então
      --    zero linhas afetadas devolveria 'S' do mesmo jeito.
      l_efeito := CASE WHEN l_sit = '2' THEN 'concluida'
                       WHEN l_sit = '4' THEN 'reprovada'
                       WHEN l_depois < l_antes THEN 'aguardando_proximo'
                       ELSE 'nenhum_efeito' END;
    END IF;

    apex_json.initialize_clob_output;
    apex_json.open_object;
      apex_json.write('ok', NOT tem_erro AND l_efeito <> 'nenhum_efeito');
      apex_json.write('registrou', l_depois < l_antes OR l_sit IN ('2','4'));
      apex_json.write('efeito', l_efeito);
      apex_json.write('sit_requisicao', l_sit);
      apex_json.write('aprovadores_pendentes', l_depois);
      IF l_sit = '2' THEN
        apex_json.write('aviso_folha', 'As férias foram efetivadas na folha.');
      END IF;
      IF l_canceladas > 0 THEN
        apex_json.write('programacoes_canceladas', l_canceladas);
      END IF;
      escreve_msgs;
    apex_json.close_object;
    p_out := apex_json.get_clob_output;
    apex_json.free_output;
    fecha_sessao;
  EXCEPTION
    WHEN OTHERS THEN fecha_sessao; RAISE;
  END aprovar;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 2.8  POST /ferias/reprocessar/{cod}   — uso administrativo, não vira tool
  --
  -- Rede para a falta de atomicidade: executa() commita antes do post_update.
  -- Repetir é seguro — com sit_requisicao = 2 o Trata_Ferias cai fora do
  -- `if ... in (1,5)` e não faz nada.
  -- ══════════════════════════════════════════════════════════════════════════
  PROCEDURE reprocessar(p_json IN CLOB, p_out OUT CLOB) IS
    l_id  t_ident;
    l_sol NUMBER;
    l_emp NUMBER;
    l_flg VARCHAR2(3);
    l_msg VARCHAR2(4000);
    l_sit VARCHAR2(1);
  BEGIN
    apex_json.parse(p_json);
    zera_msgs;
    l_id  := ident;
    l_sol := num_de('cod_solicitacao');
    abre_sessao(l_id);

    SELECT c.empresa_req INTO l_emp
      FROM consulta_requisicoes c WHERE c.solicitacao = l_sol AND ROWNUM = 1;

    PRC_ATUALIZA_REQ(l_emp, l_sol, l_flg, l_msg);
    guarda('workflow', l_flg, l_msg);
    COMMIT;

    SELECT sit_requisicao INTO l_sit
      FROM requisicao_ferias WHERE cod_solicitacao = l_sol;

    apex_json.initialize_clob_output;
    apex_json.open_object;
      apex_json.write('ok', NOT tem_erro);
      apex_json.write('sit_requisicao', l_sit);
      escreve_msgs;
    apex_json.close_object;
    p_out := apex_json.get_clob_output;
    apex_json.free_output;
    fecha_sessao;
  EXCEPTION
    WHEN OTHERS THEN fecha_sessao; RAISE;
  END reprocessar;

END PKG_API_FERIAS;
/

SHOW ERRORS PACKAGE BODY NATCORP.PKG_API_FERIAS
