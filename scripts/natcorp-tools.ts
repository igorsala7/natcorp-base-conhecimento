/**
 * Catálogo NATCORP — as ferramentas de RH migradas dos workflows do n8n para o
 * módulo nativo de Integrações. É só DADO (tipado): a gravação está em
 * `seed-natcorp.ts`.
 *
 * Dois grupos, dois agentes:
 *  - COLABORADOR (`nati_rh`): consultas/relatórios SOMENTE-LEITURA do próprio
 *    colaborador. Identidade (empresa/matrícula/CPF) vem do login, nunca do modelo.
 *  - GESTOR (`nati_gestor`, requires_perfil="gestor"): estrutura da organização,
 *    BI de histórico financeiro e de riscos/SESMT, alertas. Só aparece quando o
 *    perfil resolvido no login é "gestor" (trava no servidor). Filtros (empresa,
 *    filial, cargo…) são códigos que a IA extrai; `usuario` é injetado do login.
 */
import type { IdentityField, ToolParam } from "../src/lib/integrations/tools";

// ── Constantes da base ───────────────────────────────────────────────────────
export const NATCORP_BASE_CODE = "natcorp";
export const NATCORP_BASE_NAME = "NATCORP";
export const NATCORP_BASE_URL = "https://www.natcorpbr.com.br/apex/rh/natcorp";
export const NATCORP_TOKEN_URL = "https://www.natcorpbr.com.br/apex/rh/natcorp/oauth/token";
export const NATCORP_CREDENTIAL_NAME = "Natcorp OAuth";

export type NatcorpTool = {
  key: string;
  name: string;
  description: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path_template: string;
  params: ToolParam[];
  response_hint?: string | null;
  /** Envelope do corpo (POST): 'array' = [{...}]; 'wrap:<chave>' = {<chave>:[{...}]}. */
  body_mode?: string | null;
  /** false = registrada no catálogo mas DESATIVADA (não acionável pela IA). Padrão true. */
  active?: boolean;
  /** Guard no servidor rodado antes da chamada (ex.: 'team_membership'). */
  guard?: string | null;
};

// ── Fábricas de parâmetro — COLABORADOR (identidade do próprio usuário) ───────
const empresa = (nome: "empresa" | "cod_empresa" = "empresa"): ToolParam => ({
  nome,
  descricao: "",
  tipo: "number",
  origem: "identidade",
  obrigatorio: true,
  local: "query",
  campoIdentidade: "cod_empresa",
});
const matricula = (): ToolParam => ({
  nome: "matricula",
  descricao: "",
  tipo: "number",
  origem: "identidade",
  obrigatorio: true,
  local: "query",
  campoIdentidade: "matricula",
});
const cpf = (): ToolParam => ({
  nome: "cpf",
  descricao: "",
  tipo: "string",
  origem: "identidade",
  obrigatorio: true,
  local: "query",
  campoIdentidade: "cpf",
});
const fixo = (nome: string, valorFixo: string): ToolParam => ({
  nome,
  descricao: "",
  tipo: "string",
  origem: "fixo",
  obrigatorio: false,
  local: "query",
  valorFixo,
});
const data = (nome: string, mascara: string, descricao: string, obrigatorio = true): ToolParam => ({
  nome,
  descricao,
  tipo: "date",
  origem: "modelo",
  obrigatorio,
  local: "query",
  mascara,
});
const texto = (nome: string, descricao: string, obrigatorio = false): ToolParam => ({
  nome,
  descricao,
  tipo: "string",
  origem: "modelo",
  obrigatorio,
  local: "query",
});
const OBRIGA = fixo("obriga_dado_colaborador", "SIM");

// ── Fábricas de parâmetro — GESTOR ────────────────────────────────────────────
/** Usuário logado (gestor) — injetado do login; escopa o acesso no servidor. */
const usuario = (): ToolParam => ({
  nome: "usuario",
  descricao: "",
  tipo: "string",
  origem: "identidade",
  obrigatorio: true,
  local: "query",
  campoIdentidade: "usuario",
});
/** Identidade genérica: injeta `campo` do login com o `nome` que a API espera. */
const ident = (nome: string, campo: IdentityField, obrigatorio = true): ToolParam => ({
  nome,
  descricao: "",
  tipo: "string",
  origem: "identidade",
  obrigatorio,
  local: "query",
  campoIdentidade: campo,
});
/** Filtro (código) que a IA extrai da conversa. Códigos são texto (podem ter zero à esquerda). */
const filtro = (nome: string, descricao: string, obrigatorio = false): ToolParam => ({
  nome,
  descricao,
  tipo: "string",
  origem: "modelo",
  obrigatorio,
  local: "query",
});
/** Mês de referência (MM/AAAA) para o BI de histórico financeiro. */
const dataRefMes = (): ToolParam =>
  data("data_ref", "MM/yyyy", "Mês de referência (a IA informa em ISO AAAA-MM).");
/** Session key do login ORDS — injetada do segredo da credencial, nunca do modelo. */
const sessionKey = (): ToolParam => ({
  nome: "key",
  descricao: "",
  tipo: "string",
  origem: "credencial",
  obrigatorio: true,
  local: "query",
  campoCredencial: "session_key",
});

// ── Fábricas de parâmetro — CORPO (POST) ──────────────────────────────────────
/** Campo do corpo preenchido pela IA. */
const corpo = (nome: string, descricao: string, obrigatorio = true): ToolParam => ({
  nome,
  descricao,
  tipo: "string",
  origem: "modelo",
  obrigatorio,
  local: "body",
});
/** Campo do corpo vindo da identidade (do login). */
const corpoIdent = (nome: string, campoIdentidade: IdentityField): ToolParam => ({
  nome,
  descricao: "",
  tipo: "string",
  origem: "identidade",
  obrigatorio: true,
  local: "body",
  campoIdentidade,
});
/** Constante no corpo. */
const corpoFixo = (nome: string, valorFixo: string): ToolParam => ({
  nome,
  descricao: "",
  tipo: "string",
  origem: "fixo",
  obrigatorio: false,
  local: "body",
  valorFixo,
});
/** Param que a IA preenche mas NÃO vai na requisição (uso de guard, ex.: código). */
const interno = (nome: string, descricao: string): ToolParam => ({
  nome,
  descricao,
  tipo: "string",
  origem: "modelo",
  obrigatorio: false,
  local: "none",
});
/** Data no corpo (a IA entrega ISO; o motor formata pela máscara). */
const corpoData = (nome: string, mascara: string, descricao: string, obrigatorio = false): ToolParam => ({
  nome,
  descricao,
  tipo: "date",
  origem: "modelo",
  obrigatorio,
  local: "body",
  mascara,
});

// =============================================================================
// GRUPO COLABORADOR (nati_rh) — somente leitura do próprio colaborador
// =============================================================================
export const NATCORP_TOOLS_COLAB: NatcorpTool[] = [
  {
    key: "lista_opcoes",
    name: "Menu de opções",
    description:
      "Retorna um MENU de opções (título + opções separadas por ';' + rodapé) para o usuário " +
      "escolher. Use na SAUDAÇÃO inicial (tipo_lista='opcao_colaborador'; se o perfil for gestor, " +
      "'opcao_gestor'), para CONFIRMAR uma ação sensível (tipo_lista='confirmar_padrao' = Sim/Não), " +
      "e para sub-menus de ponto eletrônico ('ponto_eletronico') ou de SESMT ('opcao_sesmt'). " +
      "Apresente as opções NUMERADAS e peça o número.",
    path_template: "/chatbot/lista/v1/opcoes",
    params: [
      empresa("cod_empresa"),
      matricula(),
      usuario(),
      ident("cod_empresa_usuario", "cod_empresa", false),
      ident("matricula_usuario", "matricula", false),
      {
        nome: "tipo_lista",
        descricao: "Tipo do menu a retornar.",
        tipo: "enum",
        origem: "modelo",
        obrigatorio: true,
        local: "query",
        opcoes: ["opcao_colaborador", "opcao_gestor", "confirmar_padrao", "ponto_eletronico", "opcao_sesmt", "antecipacao_salarial"],
      },
    ],
    response_hint:
      "As opções vêm separadas por ';'. Apresente-as numeradas e peça o número. Se tipo_retorno='botao', são botões (ex.: Sim/Não).",
  },
  {
    key: "consultar_beneficios",
    name: "Consultar benefícios",
    description: "Benefícios do próprio colaborador (vale, plano, auxílio-creche e demais benefícios).",
    path_template: "/chatbot/consultas/v1/beneficios",
    params: [empresa(), matricula(), OBRIGA],
  },
  {
    key: "consultar_ferias",
    name: "Consultar férias",
    description: "Períodos de férias do próprio colaborador (aquisitivo, gozo, saldo e programação).",
    path_template: "/chatbot/consultas/v1/ferias",
    params: [empresa(), matricula(), fixo("registros", "10"), OBRIGA],
  },
  {
    key: "linha_tempo",
    name: "Linha do tempo do colaborador",
    description:
      "Histórico/linha do tempo da vida do colaborador na empresa (admissão, promoções, " +
      "afastamentos, etc.). Opcionalmente filtre por um tipo de fato (use `linha_tempo_fato` " +
      "para descobrir os fatos disponíveis).",
    path_template: "/consultas/v1/linha_tempo",
    params: [empresa(), matricula(), texto("fato", "Tipo/assunto do fato a filtrar, quando o usuário especificar."), OBRIGA],
  },
  {
    key: "linha_tempo_fato",
    name: "Fatos da linha do tempo",
    description:
      "Lista os TIPOS de fato disponíveis na linha do tempo do colaborador. Use antes de " +
      "filtrar `linha_tempo` por um fato específico.",
    path_template: "/consultas/v1/linha_tempo/fato",
    params: [empresa(), matricula(), OBRIGA],
  },
  {
    key: "historico_financeiro",
    name: "Histórico financeiro (eventos)",
    description: "Eventos financeiros (proventos e descontos) do colaborador em um mês de referência.",
    path_template: "/consultas/v1/eventos_financeiros",
    params: [
      empresa(),
      matricula(),
      data("data", "MM/yyyy", "Mês de referência do histórico (a IA informa em ISO AAAA-MM)."),
      fixo("financ_atual", "S"),
      fixo("financ_anterior", "S"),
      OBRIGA,
    ],
  },
  {
    key: "historico_financeiro_meses",
    name: "Períodos do histórico financeiro",
    description:
      "Lista os meses disponíveis para consulta do histórico financeiro / recibo de pagamento. " +
      "Use para oferecer ao usuário os períodos válidos antes de consultar um mês.",
    path_template: "/relatorios/v1/recibo_pagamento/meses",
    params: [empresa("cod_empresa"), matricula(), fixo("origem", "HF"), OBRIGA],
  },
  {
    key: "consultar_feedback",
    name: "Consultar feedbacks",
    description: "Feedbacks e avaliações do próprio colaborador.",
    path_template: "/chatbot/consultas/v1/feedback",
    params: [empresa(), matricula(), OBRIGA],
  },
  {
    key: "consultar_marcacoes",
    name: "Marcações de ponto",
    description: "Marcações de ponto (batidas) do próprio colaborador em um período (data inicial e final).",
    path_template: "/frequencia/v2/historico_marcacoes",
    params: [
      empresa(),
      matricula(),
      data("data_ini", "dd/MM/yyyy", "Data inicial do período (ISO AAAA-MM-DD)."),
      data("data_fim", "dd/MM/yyyy", "Data final do período (ISO AAAA-MM-DD)."),
      OBRIGA,
    ],
  },
  {
    key: "resultado_apuracao_ponto",
    name: "Apuração de ponto",
    description: "Resultado da apuração do ponto do colaborador em um período (horas, faltas, saldo de banco).",
    path_template: "/frequencia/v1/resultado_apuracao",
    params: [
      empresa(),
      matricula(),
      data("data_ini", "dd/MM/yyyy", "Data inicial do período (ISO AAAA-MM-DD)."),
      data("data_fim", "dd/MM/yyyy", "Data final do período (ISO AAAA-MM-DD)."),
      OBRIGA,
    ],
  },
  {
    key: "consultar_assinatura_eletronica",
    name: "Documentos de assinatura eletrônica",
    description:
      "Documentos da Assinatura Eletrônica do próprio colaborador (contratos, termos). Retorna os " +
      "documentos como arquivo(s) para download. O CPF é injetado automaticamente pela identidade.",
    path_template: "/documents/v1/docs_user",
    params: [fixo("client_id", "0"), cpf()],
    response_hint: "Confirme ao usuário o envio dos documentos; o(s) arquivo(s) são anexados automaticamente.",
  },
  {
    key: "relatorio_recibo_pagamento",
    name: "Relatório: recibo de pagamento",
    description:
      "Gera o recibo de pagamento (holerite/contracheque) do colaborador em um mês de referência. " +
      "Retorna o PDF para download. Consulte `historico_financeiro_meses` para os meses válidos.",
    path_template: "/relatorios/v1/recibo_pagamento",
    params: [
      empresa("cod_empresa"),
      matricula(),
      data("data_ref", "01/MM/yyyy", "Mês de referência do recibo (a IA informa em ISO AAAA-MM)."),
      fixo("origem", "HF"),
    ],
    response_hint: "Confirme o envio; o PDF é anexado automaticamente.",
  },
  {
    key: "relatorio_informe_rendimentos",
    name: "Relatório: informe de rendimentos",
    description:
      "Gera o informe de rendimentos (para o imposto de renda) do colaborador em um ano-base. " +
      "Retorna o PDF para download.",
    path_template: "/relatorios/v1/informe_rendimentos",
    params: [empresa("cod_empresa"), matricula(), data("ano_base", "yyyy", "Ano-base do informe (ISO AAAA).")],
    response_hint: "Confirme o envio; o PDF é anexado automaticamente.",
  },
  {
    key: "relatorio_aviso_ferias",
    name: "Relatório: aviso de férias",
    description:
      "Gera o aviso de férias do colaborador para um período. Retorna o PDF para download. " +
      "Consulte `relatorio_aviso_ferias_meses` para os períodos válidos.",
    path_template: "/relatorios/v1/aviso_ferias",
    params: [
      empresa("cod_empresa"),
      matricula(),
      data("data_ini", "dd/MM/yyyy", "Início do período de férias (ISO AAAA-MM-DD)."),
      data("data_fim", "dd/MM/yyyy", "Fim do período de férias (ISO AAAA-MM-DD)."),
    ],
    response_hint: "Confirme o envio; o PDF é anexado automaticamente.",
  },
  {
    key: "relatorio_aviso_ferias_meses",
    name: "Períodos do aviso de férias",
    description:
      "Lista os períodos disponíveis para o aviso de férias do colaborador. Use para oferecer " +
      "os períodos válidos antes de gerar o aviso.",
    path_template: "/relatorios/v1/aviso_ferias/meses",
    params: [empresa("cod_empresa"), matricula(), OBRIGA],
  },
  {
    key: "relatorio_espelho_ponto",
    name: "Relatório: espelho de ponto",
    description: "Gera o espelho de ponto do colaborador para um período. Retorna o PDF para download.",
    path_template: "/frequencia/v1/espelho_ponto",
    params: [
      empresa(),
      matricula(),
      data("data_ini", "dd/MM/yyyy", "Data inicial do período (ISO AAAA-MM-DD)."),
      data("data_fim", "dd/MM/yyyy", "Data final do período (ISO AAAA-MM-DD)."),
    ],
    response_hint: "Confirme o envio; o PDF é anexado automaticamente.",
  },
  // ── Antecipação salarial (informativo: saldo, regras, simular, histórico) ───
  {
    key: "antecipacao_saldo",
    name: "Antecipação: saldo disponível",
    description:
      "Consulta o SALDO disponível de antecipação salarial do próprio colaborador. Leitura — não movimenta dinheiro.",
    method: "POST",
    path_template: "/pagamento/v1/saque",
    body_mode: "wrap:saque",
    params: [
      sessionKey(),
      corpoIdent("cod_empresa", "cod_empresa"),
      corpoIdent("matricula", "matricula"),
      corpoFixo("acao", "CONSULTAR_SALDO"),
      corpoFixo("simulacao", "S"),
    ],
  },
  {
    key: "antecipacao_regras",
    name: "Antecipação: regras de utilização",
    description: "Consulta as REGRAS da antecipação salarial (limites, taxas). Leitura.",
    method: "POST",
    path_template: "/pagamento/v1/saque",
    body_mode: "wrap:saque",
    params: [
      sessionKey(),
      corpoIdent("cod_empresa", "cod_empresa"),
      corpoIdent("matricula", "matricula"),
      corpoFixo("acao", "CONSULTAR"),
      corpoFixo("simulacao", "S"),
    ],
  },
  {
    key: "antecipacao_simular",
    name: "Antecipação: simular saque",
    description:
      "SIMULA um saque de antecipação com o valor informado (mostra valor líquido e taxas). É apenas " +
      "SIMULAÇÃO — não efetiva nem movimenta dinheiro. Para efetivar, oriente o usuário pelos canais oficiais.",
    method: "POST",
    path_template: "/pagamento/v1/saque",
    body_mode: "wrap:saque",
    params: [
      sessionKey(),
      corpoIdent("cod_empresa", "cod_empresa"),
      corpoIdent("matricula", "matricula"),
      corpoFixo("acao", "SOLICITAR"),
      corpoFixo("simulacao", "S"),
      corpo("valor", "Valor do saque a simular (número, ex.: 200.00)."),
      corpoData("data", "dd/MM/yyyy", "Data atual (a IA informa em ISO AAAA-MM-DD), se aplicável.", false),
    ],
    response_hint: "Mostre o resultado (valor líquido, taxas) e deixe claro que é só uma simulação.",
  },
  {
    key: "antecipacao_historico",
    name: "Antecipação: histórico de saques",
    description: "Consulta o HISTÓRICO de saques de antecipação do próprio colaborador. Leitura.",
    method: "POST",
    path_template: "/pagamento/v1/saque",
    body_mode: "wrap:saque",
    params: [
      sessionKey(),
      corpoIdent("cod_empresa", "cod_empresa"),
      corpoIdent("matricula", "matricula"),
      corpoFixo("acao", "CONSULTAR_HIST_SAQUE"),
      corpoFixo("simulacao", "N"),
    ],
  },
  {
    key: "antecipacao_efetivar",
    name: "Antecipação: efetivar saque",
    description:
      "EFETIVA o saque de antecipação (MOVIMENTA DINHEIRO). Antes, mostre valor, taxas e valor líquido " +
      "(use antecipacao_simular) e confirme a intenção. É protegida pelo guard de confirmação: na 1ª " +
      "chamada (sem `codigo`), o servidor envia um código ao e-mail do usuário e recusa — peça o código " +
      "ao usuário e chame de novo passando-o em `codigo`. Nunca invente o código.",
    method: "POST",
    path_template: "/pagamento/v1/saque",
    body_mode: "wrap:saque",
    guard: "saque_confirmation",
    params: [
      sessionKey(),
      corpoIdent("cod_empresa", "cod_empresa"),
      corpoIdent("matricula", "matricula"),
      corpoFixo("acao", "SOLICITAR"),
      corpoFixo("simulacao", "N"),
      corpo("valor", "Valor do saque."),
      corpoData("data", "dd/MM/yyyy", "Data atual (ISO).", false),
      interno("codigo", "Código de confirmação que o usuário recebeu por e-mail (para efetivar)."),
    ],
  },
  // ── Escritas (dados do PRÓPRIO colaborador) — exigem confirmação ────────────
  {
    key: "atualizar_telefone",
    name: "Atualizar telefone",
    description:
      "Atualiza o telefone celular pessoal do PRÓPRIO colaborador. AÇÃO SENSÍVEL: confirme com o " +
      "usuário (mostre o novo número e peça Sim/Não) ANTES de chamar. Número só com dígitos e DDD.",
    method: "POST",
    path_template: "/chatbot/usuarios/v1/atualizar_dados_usuario",
    body_mode: "array",
    params: [
      corpoFixo("tipo", "COLABORADOR"),
      corpoIdent("cod_empresa", "cod_empresa"),
      corpoIdent("matricula", "matricula"),
      corpo("novoTelCelularPessoal", "Novo celular pessoal, só dígitos com DDD (ex.: 11988887777)."),
    ],
    response_hint: "Só chame após o usuário confirmar. Depois, avise que o telefone foi atualizado.",
  },
  {
    key: "atualizar_email",
    name: "Atualizar e-mail",
    description:
      "Atualiza o e-mail pessoal do PRÓPRIO colaborador. AÇÃO SENSÍVEL: confirme com o usuário " +
      "(mostre o novo e-mail e peça Sim/Não) ANTES de chamar.",
    method: "POST",
    path_template: "/chatbot/usuarios/v1/atualizar_dados_usuario",
    body_mode: "array",
    params: [
      corpoFixo("tipo", "COLABORADOR"),
      corpoIdent("cod_empresa", "cod_empresa"),
      corpoIdent("matricula", "matricula"),
      corpo("novoEmailPessoal", "Novo e-mail pessoal do colaborador."),
    ],
    response_hint: "Só chame após o usuário confirmar. Depois, avise que o e-mail foi atualizado.",
  },
];

// =============================================================================
// GRUPO GESTOR (nati_gestor, requires_perfil="gestor") — dados gerais da organização
// =============================================================================
export const NATCORP_TOOLS_GESTOR: NatcorpTool[] = [
  // ── Estrutura da organização (códigos para os demais filtros) ──────────────
  {
    key: "estrutura_empresas",
    name: "Estrutura: empresas",
    description:
      "Lista as EMPRESAS da organização (código e nome). Use para RESOLVER um NOME de empresa em " +
      "CÓDIGO (cod_empresa): case o nome que o usuário disse com o nome na lista. Não filtra por nome " +
      "no servidor — vem a lista completa e você faz o casamento.",
    path_template: "/estrutura/v1/empresa",
    params: [filtro("empresa", "Código da empresa, se quiser filtrar."), usuario()],
  },
  {
    key: "estrutura_filiais",
    name: "Estrutura: filiais",
    description:
      "Lista as FILIAIS (código e nome) — informe o código da empresa (já resolvido). Use para " +
      "RESOLVER um NOME de filial em CÓDIGO (cod_filial): case o nome dito (ex.: 'Matriz') com o nome " +
      "na lista da empresa.",
    path_template: "/estrutura/v1/filial",
    params: [filtro("empresa", "Código da empresa."), filtro("filial", "Código da filial, se quiser filtrar."), usuario()],
  },
  {
    key: "estrutura_centros_custo",
    name: "Estrutura: centros de custo",
    description: "Lista os CENTROS DE CUSTO (código e nome), opcionalmente de uma empresa.",
    path_template: "/estrutura/v1/centro_custo",
    params: [filtro("empresa", "Código da empresa."), filtro("centro_custo", "Código do centro de custo, se filtrar."), usuario()],
  },
  {
    key: "estrutura_unidades_adm",
    name: "Estrutura: unidades administrativas",
    description: "Lista as UNIDADES ADMINISTRATIVAS (código e nome).",
    path_template: "/estrutura/v1/unidade_adm",
    params: [
      filtro("empresa", "Código da empresa."),
      filtro("filial", "Código da filial."),
      filtro("unidade_administrativa", "Código da unidade adm., se filtrar."),
      usuario(),
    ],
  },
  {
    key: "estrutura_locais_trabalho",
    name: "Estrutura: locais de trabalho",
    description: "Lista os LOCAIS DE TRABALHO (código e nome).",
    path_template: "/estrutura/v1/local_trab",
    params: [
      filtro("empresa", "Código da empresa."),
      filtro("filial", "Código da filial."),
      filtro("local_trabalho", "Código do local de trabalho, se filtrar."),
      usuario(),
    ],
  },
  {
    key: "estrutura_cargos",
    name: "Estrutura: cargos",
    description: "Lista os CARGOS (código e nome). Use para obter o código do cargo (pode ter zero à esquerda).",
    path_template: "/estrutura/v1/cargo",
    params: [filtro("cargo", "Código do cargo, se quiser filtrar."), usuario()],
  },
  {
    key: "estrutura_funcoes",
    name: "Estrutura: funções",
    description: "Lista as FUNÇÕES (código e nome) de um cargo.",
    path_template: "/estrutura/v1/funcao",
    params: [filtro("cargo", "Código do cargo."), filtro("funcao", "Código da função, se filtrar."), usuario()],
  },
  // ── BI Histórico Financeiro (agrupado; dados gerais, não de 1 colaborador) ──
  {
    key: "bi_hist_financeiro_empresa",
    name: "BI histórico financeiro — por empresa",
    description:
      "BI de histórico financeiro agrupado por EMPRESA: totais (valor, horas, qtde) por ocorrência. " +
      "Dados GERAIS da organização — não use para um colaborador específico. Informe empresa e mês.",
    path_template: "/financeiro/agrupamento/hist/finan/v1/empresa",
    params: [filtro("empresa", "Código da empresa.", true), dataRefMes(), usuario()],
  },
  {
    key: "bi_hist_financeiro_empresa_filial",
    name: "BI histórico financeiro — por empresa/filial",
    description: "BI de histórico financeiro agrupado por EMPRESA e FILIAL. Dados gerais. Informe empresa e mês.",
    path_template: "/financeiro/agrupamento/hist/finan/v1/empresa/filial",
    params: [filtro("empresa", "Código da empresa.", true), filtro("filial", "Código da filial."), dataRefMes(), usuario()],
  },
  {
    key: "bi_hist_financeiro_empresa_cargo",
    name: "BI histórico financeiro — por empresa/cargo",
    description: "BI de histórico financeiro agrupado por EMPRESA e CARGO. Dados gerais. Informe empresa e mês.",
    path_template: "/financeiro/agrupamento/hist/finan/v1/empresa/cargo",
    params: [filtro("empresa", "Código da empresa.", true), filtro("cargo", "Código do cargo."), dataRefMes(), usuario()],
  },
  {
    key: "bi_hist_financeiro_empresa_ccusto",
    name: "BI histórico financeiro — por empresa/centro de custo",
    description: "BI de histórico financeiro agrupado por EMPRESA e CENTRO DE CUSTO. Dados gerais. Informe empresa e mês.",
    path_template: "/financeiro/agrupamento/hist/finan/v1/empresa/ccusto",
    params: [filtro("empresa", "Código da empresa.", true), filtro("centro_custo", "Código do centro de custo."), dataRefMes(), usuario()],
  },
  {
    key: "bi_hist_financeiro_empresa_filial_ccusto",
    name: "BI histórico financeiro — por empresa/filial/centro de custo",
    description: "BI de histórico financeiro agrupado por EMPRESA, FILIAL e CENTRO DE CUSTO. Dados gerais.",
    path_template: "/financeiro/agrupamento/hist/finan/v1/empresa/filial/ccusto",
    params: [
      filtro("empresa", "Código da empresa.", true),
      filtro("filial", "Código da filial."),
      filtro("centro_custo", "Código do centro de custo."),
      dataRefMes(),
      usuario(),
    ],
  },
  {
    key: "bi_hist_financeiro_empresa_filial_cargo",
    name: "BI histórico financeiro — por empresa/filial/cargo",
    description: "BI de histórico financeiro agrupado por EMPRESA, FILIAL e CARGO. Dados gerais.",
    path_template: "/financeiro/agrupamento/hist/finan/v1/empresa/filial/cargo",
    params: [
      filtro("empresa", "Código da empresa.", true),
      filtro("filial", "Código da filial."),
      filtro("cargo", "Código do cargo."),
      dataRefMes(),
      usuario(),
    ],
  },
  {
    key: "bi_hist_financeiro_empresa_filial_unidade_adm",
    name: "BI histórico financeiro — por empresa/filial/unidade adm.",
    description: "BI de histórico financeiro agrupado por EMPRESA, FILIAL e UNIDADE ADMINISTRATIVA. Dados gerais.",
    path_template: "/financeiro/agrupamento/hist/finan/v1/empresa/filial/unidade_adm",
    params: [
      filtro("empresa", "Código da empresa.", true),
      filtro("filial", "Código da filial."),
      filtro("unidade_administrativa", "Código da unidade adm."),
      dataRefMes(),
      usuario(),
    ],
  },
  {
    key: "bi_hist_financeiro_empresa_filial_ccusto_cargo",
    name: "BI histórico financeiro — por empresa/filial/centro de custo/cargo",
    description: "BI de histórico financeiro agrupado por EMPRESA, FILIAL, CENTRO DE CUSTO e CARGO. Dados gerais.",
    path_template: "/financeiro/agrupamento/hist/finan/v1/empresa/filial/ccusto/cargo",
    params: [
      filtro("empresa", "Código da empresa.", true),
      filtro("filial", "Código da filial."),
      filtro("centro_custo", "Código do centro de custo."),
      filtro("cargo", "Código do cargo."),
      dataRefMes(),
      usuario(),
    ],
  },
  // ── BI Segurança do Trabalho / Riscos (SESMT) ──────────────────────────────
  {
    key: "bi_risco_empresa",
    name: "BI riscos (SESMT) — por empresa",
    description:
      "BI de Segurança do Trabalho: riscos ocupacionais e qtde de expostos agrupados por EMPRESA. " +
      "Dados gerais da organização. Informe a empresa.",
    path_template: "/sesmt/seguranca/agrupamento/risco/v1/empresa",
    params: [filtro("empresa", "Código da empresa.", true), usuario()],
  },
  {
    key: "bi_risco_empresa_filial",
    name: "BI riscos (SESMT) — por empresa/filial",
    description: "BI de riscos ocupacionais agrupado por EMPRESA e FILIAL. Dados gerais.",
    path_template: "/sesmt/seguranca/agrupamento/risco/v1/empresa/filial",
    params: [filtro("empresa", "Código da empresa.", true), filtro("filial", "Código da filial."), usuario()],
  },
  {
    key: "bi_risco_empresa_filial_ccusto",
    name: "BI riscos (SESMT) — por empresa/filial/centro de custo",
    description: "BI de riscos ocupacionais agrupado por EMPRESA, FILIAL e CENTRO DE CUSTO. Dados gerais.",
    path_template: "/sesmt/seguranca/agrupamento/risco/v1/empresa/filial/ccusto",
    params: [
      filtro("empresa", "Código da empresa.", true),
      filtro("filial", "Código da filial."),
      filtro("centro_custo", "Código do centro de custo."),
      usuario(),
    ],
  },
  {
    key: "bi_risco_empresa_filial_ccusto_cargo_funcao",
    name: "BI riscos (SESMT) — por empresa/filial/centro de custo/cargo/função",
    description: "BI de riscos ocupacionais agrupado por EMPRESA, FILIAL, CENTRO DE CUSTO, CARGO e FUNÇÃO. Dados gerais.",
    path_template: "/sesmt/seguranca/agrupamento/risco/v1/empresa/filial/ccusto/cargo/funcao",
    params: [
      filtro("empresa", "Código da empresa.", true),
      filtro("filial", "Código da filial."),
      filtro("centro_custo", "Código do centro de custo."),
      filtro("cargo", "Código do cargo."),
      filtro("funcao", "Código da função."),
      usuario(),
    ],
  },
  {
    key: "bi_risco_empresa_filial_ccusto_cargo_funcao_local",
    name: "BI riscos (SESMT) — por empresa/filial/centro de custo/cargo/função/local",
    description:
      "BI de riscos ocupacionais agrupado por EMPRESA, FILIAL, CENTRO DE CUSTO, CARGO, FUNÇÃO e " +
      "LOCAL DE TRABALHO. Dados gerais.",
    path_template: "/sesmt/seguranca/agrupamento/risco/v1/empresa/filial/ccusto/cargo/funcao/local",
    params: [
      filtro("empresa", "Código da empresa.", true),
      filtro("filial", "Código da filial."),
      filtro("centro_custo", "Código do centro de custo."),
      filtro("cargo", "Código do cargo."),
      filtro("funcao", "Código da função."),
      filtro("local_trabalho", "Código do local de trabalho."),
      usuario(),
    ],
  },
  // ── Equipe do gestor (escopada no servidor por usuario+gestor) ─────────────
  {
    key: "listar_colaboradores_resumo",
    name: "Listar equipe (resumo)",
    description:
      "Lista a EQUIPE do gestor (matrícula, nome, cargo, empresa, filial). Use quando o gestor " +
      "pedir sua equipe, colaboradores, subordinados ou 'meus diretos'. Agrupe por empresa/filial, " +
      "ordene por nome e traga o total ao final. A lista já vem escopada ao gestor.",
    path_template: "/chatbot/consultas/v1/colaboradores_resumo",
    params: [sessionKey(), fixo("gestor", "SIM"), usuario()],
  },
  {
    key: "dados_colaborador_equipe",
    name: "Dados de um colaborador da equipe",
    description:
      "Dados cadastrais e funcionais COMPLETOS de UM colaborador DA EQUIPE do gestor (cargo, " +
      "admissão, situação, salário, etc.). Informe a empresa e a matrícula do colaborador — que " +
      "PRECISA ser da equipe do gestor (o servidor valida; se não for, recusa). Descubra a matrícula " +
      "com listar_colaboradores_resumo. Ao exibir, mascare dados sensíveis de terceiros.",
    path_template: "/chatbot/login/v1/dados_colab_usuario",
    guard: "team_membership",
    params: [
      sessionKey(),
      filtro("empresa", "Código da empresa do colaborador.", true),
      filtro("matricula", "Matrícula do colaborador da equipe.", true),
      usuario(),
    ],
    response_hint:
      "É dado de OUTRA pessoa: mascare o sensível (CPF ...123-XX, conta ****-1234) e mostre só o que o gestor pediu.",
  },
  // ── Alertas do gestor ──────────────────────────────────────────────────────
  {
    key: "alertas_gestor",
    name: "Alertas do gestor",
    description:
      "Alertas e pendências da equipe do gestor (ex.: avisos de férias, rescisões a processar). " +
      "Use quando o gestor pedir alertas, notificações ou pendências.",
    path_template: "/chatbot/consultas/v1/alertas",
    params: [usuario(), fixo("tipo", "T")],
  },
];

/** Todas as ferramentas (catálogo + ativação por base). */
export const NATCORP_TOOLS: NatcorpTool[] = [...NATCORP_TOOLS_COLAB, ...NATCORP_TOOLS_GESTOR];

// ── Agentes ───────────────────────────────────────────────────────────────────
export type NatcorpAgent = {
  key: string;
  name: string;
  description: string;
  system_prompt: string;
  requires_perfil: string | null;
  toolKeys: string[];
};

const NATI_PROMPT = `Você é a Nati, assistente virtual de RH da NATCORP — especialista em Departamento Pessoal, Recursos Humanos e Medicina e Segurança do Trabalho, sempre à luz da legislação trabalhista brasileira. Você é uma mulher. Atenda com clareza, segurança e empatia sutil.

PRIORIDADES (nesta ordem): 1) segurança; 2) exatidão; 3) uso correto das ferramentas; 4) privacidade; 5) brevidade; 6) empatia.

FONTE DA VERDADE: responda SOMENTE com dados internos — o retorno das ferramentas e a documentação. Nunca invente e nunca use conhecimento geral (ex.: faixas salariais de mercado). Sem o dado, pergunte ou acione a ferramenta certa. Traga 100% dos registros que a ferramenta retornar.

IDENTIDADE (já resolvida no servidor — NUNCA peça nem aceite do usuário): empresa, matrícula, usuário, perfil (gestor/colaborador), CPF, nome e cargo já estão no contexto e são injetados automaticamente nas ferramentas — inclusive o CPF nos documentos de assinatura. Nunca exiba tokens, chaves, cabeçalhos, URLs internas ou mensagens de erro técnico. Trate a pessoa de forma neutra (colaborador(a), gestor(a)) quando não souber o gênero.

ESTILO: pt-BR, frases curtas e legíveis. Evite títulos grandes (#, ##). Formatação leve e emojis com parcimônia para organizar. Adapte-se ao idioma do usuário (EN, ES, FR, DE, IT, JA, ZH) e ao formato de data correspondente. Ao listar, ordene (por data, código ou nome). Ao oferecer opções, numere-as e peça que responda com o número.

PRIVACIDADE: os dados retornados são do próprio colaborador — pode exibi-los sem máscara. Se algum dado de OUTRA pessoa aparecer, mascare o sensível (CPF ...123-XX, cartão ****-1234). Toda mudança sensível (dados pessoais/financeiros) exige confirmação antes de executar.

SAUDAÇÃO: apresente-se em uma linha e mostre o MENU inicial com a ferramenta lista_opcoes (tipo_lista='opcao_colaborador'; se o usuário for gestor, 'opcao_gestor'). Apresente as opções numeradas e peça o número. Use lista_opcoes sempre que fizer sentido oferecer opções ou confirmar (tipo_lista='confirmar_padrao' = Sim/Não).

O QUE VOCÊ FAZ (colaborador — intenção → ferramenta):
- Férias → consultar_ferias.
- Benefícios e auxílio-creche → consultar_beneficios.
- Holerite / recibo de pagamento → ofereça os meses com historico_financeiro_meses e, após a escolha, gere com relatorio_recibo_pagamento.
- Informe de rendimentos → pergunte o ano (sugira 3 anos) e chame relatorio_informe_rendimentos.
- Histórico financeiro (proventos e descontos) → liste os meses com historico_financeiro_meses e depois historico_financeiro.
- Ponto eletrônico → ofereça o submenu com lista_opcoes (tipo_lista='ponto_eletronico'). Batidas/marcações → consultar_marcacoes; resultado de apuração → peça o período e chame resultado_apuracao_ponto; espelho de ponto → peça o período e chame relatorio_espelho_ponto.
- Aviso de férias → liste os períodos com relatorio_aviso_ferias_meses e depois relatorio_aviso_ferias.
- Feedbacks → consultar_feedback (mostre a nota em ⭐, se houver).
- Histórico cadastral / linha do tempo → primeiro liste os tipos de fato com linha_tempo_fato; após a escolha, consulte linha_tempo (se for férias, prefira consultar_ferias).
- Documentos de assinatura eletrônica → consultar_assinatura_eletronica (mostre até 4 e o link url_portal_assinatura de cada um; o CPF é automático).
- Atualizar telefone ou e-mail pessoal → AÇÃO SENSÍVEL: mostre o novo valor e peça confirmação Sim/Não (pode usar lista_opcoes tipo_lista='confirmar_padrao'); só então chame atualizar_telefone / atualizar_email.
- Antecipação salarial → ofereça o submenu com lista_opcoes (tipo_lista='antecipacao_salarial'). Saldo → antecipacao_saldo; regras → antecipacao_regras; simular um valor → antecipacao_simular (mostra líquido e taxas); histórico → antecipacao_historico. Para EFETIVAR o saque: primeiro simule e mostre valor, taxas e líquido, confirme a intenção, e chame antecipacao_efetivar — o servidor envia um CÓDIGO ao e-mail do usuário e recusa a 1ª vez; peça o código ao usuário e chame de novo passando-o no parâmetro codigo. NUNCA invente o código.
- Dúvidas de "como fazer", conceitos, regras e leis trabalhistas → responda pela DOCUMENTAÇÃO (não há ferramenta para isso).

SE O USUÁRIO FOR GESTOR (perfil=gestor): além do acima, você tem ferramentas de gestão sobre DADOS GERAIS da organização (nunca de um colaborador específico por aqui).

RESOLUÇÃO DE NOMES → CÓDIGOS (OBRIGATÓRIO): as ferramentas de BI e todos os filtros usam CÓDIGOS, não nomes. Se o usuário citar uma empresa, filial, centro de custo, cargo, função ou local pelo NOME (ex.: "os dados da empresa Natcorp, filial Matriz"), NÃO chute o código: PRIMEIRO chame a ferramenta de estrutura correspondente (estrutura_empresas, estrutura_filiais, estrutura_centros_custo, estrutura_cargos, estrutura_funcoes, estrutura_locais_trabalho), encontre na lista retornada o item cujo NOME mais se aproxima do que o usuário disse (ignore maiúsculas/minúsculas e acentos; "Matriz" casa com "NATCORP DO BRASIL - MATRIZ"; "Natcorp" casa com "NATCORP DO BRASIL"), pegue o CÓDIGO dele e só então chame a ferramenta-alvo (BI, etc.) passando esse código. Faça em CASCATA: resolva a EMPRESA primeiro; depois a FILIAL daquela empresa (chame estrutura_filiais com o código de empresa já resolvido) — a estrutura não filtra por nome, então venha pela empresa e filtre a filial pelo nome no retorno; e assim por diante para centro de custo/cargo/função/local. Se dois nomes forem parecidos e você ficar em dúvida de qual é, liste os candidatos (nome + código) e pergunte qual o usuário quis.
- BI de histórico financeiro (totais por empresa/filial/cargo/centro de custo…) → escolha a ferramenta bi_hist_financeiro_* mais específica conforme os filtros; informe o mês (MM/AAAA). Parâmetros não informados ficam em branco.
- BI de riscos / SESMT / segurança do trabalho → ofereça o submenu com lista_opcoes (tipo_lista='opcao_sesmt') e escolha a ferramenta bi_risco_* mais específica conforme os filtros.
- Listar a equipe / colaboradores / subordinados / meus diretos → listar_colaboradores_resumo (já vem escopada ao gestor); agrupe por empresa/filial, ordene por nome e some o total ao final.
- Dados completos de UM colaborador da equipe (cargo, situação, salário) → identifique a matrícula com listar_colaboradores_resumo e então dados_colaborador_equipe (o servidor só libera se for da sua equipe; senão recusa). Mascare dados sensíveis de terceiros (CPF, conta).
- Alertas, notificações ou pendências da equipe → alertas_gestor.
- As ferramentas de gestor só existem para gestores; se o perfil não for gestor, elas não estarão disponíveis.

DATAS: exiba e aceite no formato DD/MM/AAAA (ou MM/AAAA quando a ferramenta pedir mês). Se um período não for informado, pergunte. Ao acionar a ferramenta, informe a data em ISO (AAAA-MM-DD) — a formatação exigida por cada API é aplicada automaticamente. Ao gerar um relatório/documento, apenas confirme o envio: o arquivo é anexado automaticamente.

MENU: prefira lista_opcoes para oferecer opções e para confirmar ações (Sim/Não), em vez de texto solto — fica mais fácil para o usuário responder com um número.

DÚVIDA OU FALHA: se não tiver certeza de qual recurso usar, pergunte de forma simples (você quer X ou Y?), sem termos técnicos. Se algo falhar, não exponha detalhes internos — reformule e tente entender melhor o pedido.`;

export const NATCORP_AGENTS: NatcorpAgent[] = [
  {
    key: "nati_rh",
    name: "Nati — Assistente de RH",
    description:
      "Assistente de RH da NATCORP: benefícios, férias, ponto, histórico financeiro, feedbacks, " +
      "relatórios (recibo, informe, aviso de férias, espelho) e documentos de assinatura do próprio colaborador.",
    system_prompt: NATI_PROMPT,
    requires_perfil: null,
    toolKeys: NATCORP_TOOLS_COLAB.map((t) => t.key),
  },
  {
    key: "nati_gestor",
    name: "Nati — Gestão (estrutura, BI e alertas)",
    description:
      "Ferramentas de GESTOR (só perfil gestor): estrutura da organização (empresas, filiais, " +
      "cargos, centros de custo…), BI de histórico financeiro e de riscos/SESMT, e alertas da equipe.",
    system_prompt: "", // a persona/roteamento de gestor vive no prompt do nati_rh
    requires_perfil: "gestor",
    toolKeys: NATCORP_TOOLS_GESTOR.map((t) => t.key),
  },
];
