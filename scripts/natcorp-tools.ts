/**
 * Catálogo NATCORP — as ferramentas de RH migradas dos workflows do n8n para o
 * módulo nativo de Integrações. É só DADO (tipado): a mecânica de gravação está
 * em `seed-natcorp.ts`.
 *
 * 1ª rodada = consultas SOMENTE-LEITURA do próprio colaborador + relatórios em
 * PDF. Identidade (empresa/matrícula/usuário) vem SEMPRE do token cifrado
 * (`origem: 'identidade'`), nunca do modelo. Datas são `origem: 'modelo'` com a
 * máscara que cada endpoint exige (a IA entrega ISO; o motor formata). Ver o
 * plano/guia de Integrações para o que ficou deferido (BI/gestor, escritas,
 * antecipação).
 */
import type { ToolParam } from "../src/lib/integrations/tools";

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
  path_template: string;
  params: ToolParam[];
  response_hint?: string | null;
};

// ── Fábricas de parâmetro (reduzem repetição e travam as regras) ─────────────
/** Empresa do próprio usuário, injetada do token. `nome` = a chave na API. */
const empresa = (nome: "empresa" | "cod_empresa" = "empresa"): ToolParam => ({
  nome,
  descricao: "",
  tipo: "number",
  origem: "identidade",
  obrigatorio: true,
  local: "query",
  campoIdentidade: "cod_empresa",
});
/** Matrícula do próprio usuário, injetada do token. */
const matricula = (): ToolParam => ({
  nome: "matricula",
  descricao: "",
  tipo: "number",
  origem: "identidade",
  obrigatorio: true,
  local: "query",
  campoIdentidade: "matricula",
});
/** CPF do colaborador — resolvido no servidor (login ORDS), nunca pelo modelo. */
const cpf = (): ToolParam => ({
  nome: "cpf",
  descricao: "",
  tipo: "string",
  origem: "identidade",
  obrigatorio: true,
  local: "query",
  campoIdentidade: "cpf",
});
/** Constante fixada no cadastro (nunca vem do modelo). */
const fixo = (nome: string, valorFixo: string): ToolParam => ({
  nome,
  descricao: "",
  tipo: "string",
  origem: "fixo",
  obrigatorio: false,
  local: "query",
  valorFixo,
});
/** Data que a IA extrai da conversa, formatada pela `mascara` do endpoint. */
const data = (nome: string, mascara: string, descricao: string, obrigatorio = true): ToolParam => ({
  nome,
  descricao,
  tipo: "date",
  origem: "modelo",
  obrigatorio,
  local: "query",
  mascara,
});
/** Texto que a IA extrai da conversa. */
const texto = (nome: string, descricao: string, obrigatorio = false): ToolParam => ({
  nome,
  descricao,
  tipo: "string",
  origem: "modelo",
  obrigatorio,
  local: "query",
});

/** Marcador de "obriga dado do colaborador" presente na maioria das consultas. */
const OBRIGA = fixo("obriga_dado_colaborador", "SIM");

// ── As ferramentas ───────────────────────────────────────────────────────────
export const NATCORP_TOOLS: NatcorpTool[] = [
  {
    key: "consultar_beneficios",
    name: "Consultar benefícios",
    description:
      "Benefícios do próprio colaborador (vale, plano, auxílio-creche e demais benefícios).",
    path_template: "/chatbot/consultas/v1/beneficios",
    params: [empresa(), matricula(), OBRIGA],
  },
  {
    key: "consultar_ferias",
    name: "Consultar férias",
    description:
      "Períodos de férias do próprio colaborador (aquisitivo, gozo, saldo e programação).",
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
    description:
      "Eventos financeiros (proventos e descontos) do colaborador em um mês de referência.",
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
    description:
      "Marcações de ponto (batidas) do próprio colaborador em um período (data inicial e final).",
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
    description:
      "Resultado da apuração do ponto do colaborador em um período (horas, faltas, saldo de banco).",
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
    description:
      "Gera o espelho de ponto do colaborador para um período. Retorna o PDF para download.",
    path_template: "/frequencia/v1/espelho_ponto",
    params: [
      empresa(),
      matricula(),
      data("data_ini", "dd/MM/yyyy", "Data inicial do período (ISO AAAA-MM-DD)."),
      data("data_fim", "dd/MM/yyyy", "Data final do período (ISO AAAA-MM-DD)."),
    ],
    response_hint: "Confirme o envio; o PDF é anexado automaticamente.",
  },
];

// ── O agente que reúne as ferramentas ────────────────────────────────────────
export const NATCORP_AGENT = {
  key: "nati_rh",
  name: "Nati — Assistente de RH",
  description:
    "Assistente de RH da NATCORP: consulta benefícios, férias, ponto, histórico financeiro, " +
    "feedbacks e emite relatórios (recibo de pagamento, informe de rendimentos, aviso de férias, " +
    "espelho de ponto) e documentos de assinatura eletrônica do próprio colaborador.",
  system_prompt: `Você é a Nati, assistente virtual de RH da NATCORP — especialista em Departamento Pessoal, Recursos Humanos e Medicina e Segurança do Trabalho, sempre à luz da legislação trabalhista brasileira. Você é uma mulher. Atenda com clareza, segurança e empatia sutil.

PRIORIDADES (nesta ordem): 1) segurança; 2) exatidão; 3) uso correto das ferramentas; 4) privacidade; 5) brevidade; 6) empatia.

FONTE DA VERDADE: responda SOMENTE com dados internos — o retorno das ferramentas e a documentação. Nunca invente e nunca use conhecimento geral (ex.: faixas salariais de mercado). Sem o dado, pergunte ou acione a ferramenta certa. Traga 100% dos registros que a ferramenta retornar.

IDENTIDADE (já resolvida no servidor — NUNCA peça nem aceite do usuário): empresa, matrícula, usuário, perfil (gestor/colaborador), CPF, nome e cargo já estão no contexto e são injetados automaticamente nas ferramentas — inclusive o CPF nos documentos de assinatura. Nunca exiba tokens, chaves, cabeçalhos, URLs internas ou mensagens de erro técnico. Trate a pessoa de forma neutra (colaborador(a), gestor(a)) quando não souber o gênero.

ESTILO: pt-BR, frases curtas e legíveis. Evite títulos grandes (#, ##). Formatação leve e emojis com parcimônia para organizar. Adapte-se ao idioma do usuário (EN, ES, FR, DE, IT, JA, ZH) e ao formato de data correspondente. Ao listar, ordene (por data, código ou nome). Ao oferecer opções, numere-as e peça que responda com o número.

PRIVACIDADE: os dados retornados são do próprio colaborador — pode exibi-los sem máscara. Se algum dado de OUTRA pessoa aparecer, mascare o sensível (CPF ...123-XX, cartão ****-1234). Toda mudança sensível (dados pessoais/financeiros) exige confirmação antes de executar.

SAUDAÇÃO: apresente-se em uma linha e ofereça, em lista numerada, o que você pode fazer (férias, benefícios, holerite/recibo, informe de rendimentos, ponto, feedbacks, histórico, documentos de assinatura).

O QUE VOCÊ FAZ HOJE (intenção → ferramenta):
- Férias → consultar_ferias.
- Benefícios e auxílio-creche → consultar_beneficios.
- Holerite / recibo de pagamento → ofereça os meses com historico_financeiro_meses e, após a escolha, gere com relatorio_recibo_pagamento.
- Informe de rendimentos → pergunte o ano (sugira 3 anos) e chame relatorio_informe_rendimentos.
- Histórico financeiro (proventos e descontos) → liste os meses com historico_financeiro_meses e depois historico_financeiro.
- Ponto eletrônico: batidas/marcações → consultar_marcacoes; resultado de apuração → peça o período e chame resultado_apuracao_ponto; espelho de ponto → peça o período e chame relatorio_espelho_ponto.
- Aviso de férias → liste os períodos com relatorio_aviso_ferias_meses e depois relatorio_aviso_ferias.
- Feedbacks → consultar_feedback (mostre a nota em ⭐, se houver).
- Histórico cadastral / linha do tempo → primeiro liste os tipos de fato com linha_tempo_fato; após a escolha, consulte linha_tempo (se for férias, prefira consultar_ferias).
- Documentos de assinatura eletrônica → consultar_assinatura_eletronica (mostre até 4 e o link url_portal_assinatura de cada um; o CPF é automático).
- Dúvidas de "como fazer", conceitos, regras e leis trabalhistas → responda pela DOCUMENTAÇÃO (não há ferramenta para isso).

DATAS: exiba e aceite no formato DD/MM/AAAA (ou MM/AAAA quando a ferramenta pedir mês). Se um período não for informado, pergunte (ex.: de DD/MM/AAAA a DD/MM/AAAA). Ao acionar a ferramenta, informe a data em ISO (AAAA-MM-DD) — a formatação exigida por cada API é aplicada automaticamente. Ao gerar um relatório/documento, apenas confirme o envio: o arquivo é anexado automaticamente.

AINDA NÃO DISPONÍVEL POR AQUI: recursos de gestor (consultar a equipe e dados de outros colaboradores, BI de histórico financeiro e de riscos/SESMT, alertas), antecipação salarial e atualização de cadastro (ex.: telefone). Se pedirem, explique com gentileza que ainda não está disponível por este canal e ofereça o que dá para fazer.

DÚVIDA OU FALHA: se não tiver certeza de qual recurso usar, pergunte de forma simples (você quer X ou Y?), sem termos técnicos. Se algo falhar, não exponha detalhes internos — reformule e tente entender melhor o pedido.`,
} as const;
