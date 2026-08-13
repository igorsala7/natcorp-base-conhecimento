/**
 * Cadastra (idempotente) as ferramentas de SOLICITAÇÃO E APROVAÇÃO DE FÉRIAS,
 * que consomem o módulo ORDS `requisicoes/ferias/v1` (ver apex/api-ferias-*.sql
 * e docs/ferias-ords-contrato.md).
 *
 * São SETE — não vinte. Expor cada procedure do `pkg_ferias` como ferramenta
 * obrigaria o modelo a dirigir uma máquina de estados de 25 campos que ele não
 * enxerga; aqui ele conversa e o Oracle recalcula.
 *
 * ── Decisões que valem para todas ────────────────────────────────────────────
 *
 * MÉTODO POST + `body_template`. A API recebe a identidade ANINHADA
 * (`{"identidade": {"p_usuario": …}}`) porque o legado precisa dos seis `P_*`
 * para montar a sessão APEX. O modelo continua vendo parâmetros PLANOS; o
 * aninhamento é problema do cadastro.
 *
 * PARCELAS: o template manda SEMPRE as três posições. As vazias chegam ao
 * Oracle como objeto só com `n`, e o `le_rascunho` as ignora. Assim o índice é
 * estável (`parcelas[1]` é sempre a 1ª) sem um template por combinação.
 *
 * GUARDS. As duas de escrita usam `confirmation_detalhada`: a pessoa vê o
 * resumo do que vai ser gravado e precisa dizer "sim" — a IA não confirma
 * sozinha. As de leitura usam `escopo_pessoa` (PO=todos, PG=equipe, PC=só ele).
 * Como cada ferramenta tem UM guard, o escopo das de escrita fica por conta do
 * servidor: `PKG_API_FERIAS.aplica_escopo` levanta ORA-20403. É o certo — a UI
 * esconde, o servidor recusa.
 *
 * SEM CACHE (salvo `opcoes`): saldo e situação de requisição mudam, e responder
 * com saldo velho aqui não é "resposta desatualizada", é a pessoa programando
 * férias que não tem.
 *
 * Rodar: npm run tools:ferias
 */
import ws from "ws";
if (!globalThis.WebSocket) {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws;
}
import { createClient } from "@supabase/supabase-js";
import { syncToolEmbedding } from "../src/lib/integrations/tool-catalog";
import type { ToolParam } from "../src/lib/integrations/tools";
import type { Database, Json } from "../src/lib/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  process.exit(1);
}
const db = createClient<Database>(url, serviceRole, { auth: { persistSession: false } });

const BASE_CODE = "natcorp";
const PORTAIS = ["PO", "PG", "PC"];
const BASE_PATH = "/requisicoes/ferias/v1";

/** Consulta/ação sobre uma PESSOA: cada painel enxerga o que lhe cabe. */
const SCOPE_PESSOA = { PO: "todos", PG: "equipe", PC: "proprios", PCAND: "nenhum" } as const;
/** Sobre MIM como aprovador: não há pessoa-alvo para escopar; o filtro é a identidade. */
const SCOPE_APROVADOR = { PO: "todos", PG: "todos", PC: "todos", PCAND: "nenhum" } as const;

/** Tags de assunto — as mesmas de `requisicoes_req_ferias`, que é a irmã de leitura. */
const MODULOS = [
  { modulo: "FÉRIAS", submodulo: null },
  { modulo: "REQUISIÇÕES", submodulo: null },
  { modulo: "MOVIMENTAÇÕES", submodulo: "FÉRIAS" },
  { modulo: "ADMINISTRAÇÃO DE PESSOAL", submodulo: "MOVIMENTAÇÕES > FUNCIONAIS E CADASTRAIS > FÉRIAS" },
];

// ── Fábricas de parâmetro ────────────────────────────────────────────────────

/** Campo do TOKEN. Nunca vem do modelo. */
const ident = (nome: string, campo: ToolParam["campoIdentidade"]): ToolParam => ({
  nome,
  descricao: "",
  tipo: "string",
  origem: "identidade",
  obrigatorio: true,
  local: "body",
  campoIdentidade: campo,
});

/** Os seis `P_*` que a API usa para montar a sessão APEX. */
const IDENTIDADE: ToolParam[] = [
  ident("p_usuario", "usuario"),
  ident("p_empresa_user", "cod_empresa"),
  ident("p_matricula_user", "matricula"),
  ident("p_perfil", "perfil"),
  ident("p_painel", "portal"),
  ident("p_base", "base"),
];

const texto = (nome: string, descricao: string, obrigatorio = false): ToolParam => ({
  nome, descricao, tipo: "string", origem: "modelo", obrigatorio, local: "body",
});
const numero = (nome: string, descricao: string, obrigatorio = false): ToolParam => ({
  nome, descricao, tipo: "number", origem: "modelo", obrigatorio, local: "body",
});
const data = (nome: string, descricao: string): ToolParam => ({
  nome, descricao, tipo: "date", origem: "modelo", obrigatorio: false, local: "body",
  mascara: "yyyy-MM-dd",
});
/** Matrícula-alvo: o guard `escopo_pessoa` valida/ajusta conforme o painel. */
const alvo = (): ToolParam => ({
  nome: "matricula",
  descricao:
    "Matrícula do colaborador. Deixe vazio para o próprio usuário. " +
    "Gestor e operador podem informar a de outra pessoa dentro do seu alcance.",
  tipo: "number", origem: "pessoa", obrigatorio: false, local: "body",
  campoIdentidade: "matricula",
});
const empresaAlvo = (): ToolParam => ({
  nome: "cod_empresa",
  descricao: "Código da empresa do colaborador. Vazio = a mesma de quem está perguntando.",
  tipo: "number", origem: "modelo", obrigatorio: false, local: "body",
});

/** Parâmetros de UMA parcela (n = 1, 2 ou 3 — a 3ª é a parcela 4 no banco). */
function parcela(n: number): ToolParam[] {
  const ord = n === 1 ? "1ª" : n === 2 ? "2ª" : "3ª";
  return [
    data(`dt_saida_${n}`, `Data de saída da ${ord} parcela.`),
    numero(`num_dias_${n}`, `Dias de férias da ${ord} parcela (tem de existir na parametrização — veja ferias_opcoes).`),
    numero(`dias_abono_${n}`, `Dias vendidos (abono pecuniário) na ${ord} parcela. 0 = não vende.`),
    texto(`opcao_13sal_${n}`, `'S' para adiantar a 1ª parcela do 13º nesta parcela, 'N' para não. Só é permitido UMA vez por ano.`),
  ];
}

const RASCUNHO: ToolParam[] = [
  empresaAlvo(),
  alvo(),
  numero("opcao_ferias", "Código da opção de programação (venha de ferias_opcoes, não invente)."),
  data("dt_inic_per_ferias", "Início do período aquisitivo (veio de ferias_situacao)."),
  data("dt_fim_per_ferias", "Fim do período aquisitivo (veio de ferias_situacao)."),
  numero("desc_adicional", "Dias de descanso adicional (bônus férias). 0 quando não houver."),
  ...parcela(1),
  ...parcela(2),
  ...parcela(3),
  texto(
    "confirmacoes",
    "Quando uma chamada anterior devolveu mensagem do tipo 'confirmar' e a PESSOA respondeu que sim, " +
      "repita aqui a 'chave' daquela mensagem (separe por vírgula se houver mais de uma). Nunca preencha " +
      "sem a pessoa ter confirmado.",
  ),
];

/** Bloco de identidade do corpo — igual em todas. */
const T_IDENT = {
  identidade: {
    p_usuario: "{{p_usuario}}",
    p_empresa_user: "{{p_empresa_user}}",
    p_matricula_user: "{{p_matricula_user}}",
    p_perfil: "{{p_perfil}}",
    p_painel: "{{p_painel}}",
    p_base: "{{p_base}}",
  },
};
const T_PESSOA = { cod_empresa: "{{cod_empresa}}", matricula: "{{matricula}}" };
const T_RASCUNHO = {
  ...T_IDENT,
  ...T_PESSOA,
  opcao_ferias: "{{opcao_ferias}}",
  dt_inic_per_ferias: "{{dt_inic_per_ferias}}",
  dt_fim_per_ferias: "{{dt_fim_per_ferias}}",
  desc_adicional: "{{desc_adicional}}",
  // As três posições SEMPRE presentes: é o que mantém o índice estável.
  parcelas: [
    { n: 1, dt_saida: "{{dt_saida_1}}", num_dias: "{{num_dias_1}}", dias_abono_pec: "{{dias_abono_1}}", opcao_13sal: "{{opcao_13sal_1}}" },
    { n: 2, dt_saida: "{{dt_saida_2}}", num_dias: "{{num_dias_2}}", dias_abono_pec: "{{dias_abono_2}}", opcao_13sal: "{{opcao_13sal_2}}" },
    { n: 3, dt_saida: "{{dt_saida_3}}", num_dias: "{{num_dias_3}}", dias_abono_pec: "{{dias_abono_3}}", opcao_13sal: "{{opcao_13sal_3}}" },
  ],
  confirmacoes: ["{{*confirmacoes}}"],
};

/** Regra que vale para toda a família: número e data vêm da ferramenta. */
const REGRA_VALORES =
  "NUNCA calcule nem sugira data de retorno, data de pagamento, quantidade de dias ou saldo por conta própria: " +
  "todos vêm da resposta da ferramenta. Se a ferramenta ALTEROU o que a pessoa pediu (feriado, saldo, " +
  "parametrização), diga que alterou e por quê. Nunca ofereça uma divisão de dias que não esteja em ferias_opcoes.";

type NovaTool = {
  key: string;
  name: string;
  description: string;
  path: string;
  params: ToolParam[];
  body_template: unknown;
  guard: string;
  panel_scope: Record<string, string>;
  response_hint: string;
  search_terms: string;
  system_prompt?: string;
  cache_ttl?: number;
  cache_scope?: "user" | "empresa" | "global";
};

const TOOLS: NovaTool[] = [
  {
    key: "ferias_situacao",
    name: "Férias: situação para solicitar",
    description:
      "Ponto de partida para SOLICITAR férias: devolve o período aquisitivo aberto do colaborador, o saldo de " +
      "dias e os impedimentos que já se sabem de antemão (período em dobro, ação judicial, requisição já " +
      "existente no mesmo período, aprovadores não parametrizados). Use SEMPRE antes de ferias_simular. " +
      "Não é consulta de férias já programadas — para isso use consultar_ferias.",
    path: `${BASE_PATH}/situacao`,
    params: [...IDENTIDADE, empresaAlvo(), alvo()],
    body_template: { ...T_IDENT, ...T_PESSOA },
    guard: "escopo_pessoa",
    panel_scope: SCOPE_PESSOA,
    response_hint:
      "Diga o período aquisitivo e quantos dias a pessoa tem. Repasse os avisos com as palavras da resposta — " +
      "eles são a diferença entre uma solicitação que passa e uma que é recusada.",
    search_terms:
      "quero tirar férias\nsolicitar férias\npedir férias\nagendar férias\nprogramar férias\n" +
      "quantos dias de férias eu tenho\nsaldo de férias\nperíodo aquisitivo\nposso tirar férias\n" +
      "Quero solicitar minhas férias\nComo faço para pedir férias?\nTenho direito a quantos dias?\n" +
      "Quero programar minhas férias para setembro",
  },
  {
    key: "ferias_opcoes",
    name: "Férias: divisões de dias permitidas",
    description:
      "Combinações de parcelamento que a parametrização da empresa/filial ACEITA (30 de uma vez, 20+10, " +
      "15+15…), com os dias de abono possíveis em cada uma. Use antes de propor qualquer divisão: uma " +
      "combinação fora desta lista é recusada pelo sistema com 'quantidade de dias não encontrada na " +
      "parametrização'. Ofereça as opções à pessoa em vez de perguntar quantos dias ela quer.",
    path: `${BASE_PATH}/opcoes`,
    params: [...IDENTIDADE, empresaAlvo(), alvo()],
    body_template: { ...T_IDENT, ...T_PESSOA },
    guard: "escopo_pessoa",
    panel_scope: SCOPE_PESSOA,
    response_hint:
      "Apresente as combinações em linguagem simples ('30 dias de uma vez' ou '20 dias + 10 dias'). Não " +
      "mostre a tabela crua nem invente combinação que não veio.",
    search_terms:
      "posso dividir as férias\nparcelar férias\nquantas parcelas de férias\nvender dias de férias\n" +
      "abono pecuniário\ndividir férias em duas\n15 dias\n20 mais 10\n" +
      "Posso dividir minhas férias em duas vezes?\nDá para vender 10 dias?\nQuantas parcelas eu posso fazer?",
    cache_ttl: 3600,
    cache_scope: "empresa",
  },
  {
    key: "ferias_simular",
    name: "Férias: montar e validar a solicitação",
    description:
      "Monta a solicitação de férias e devolve ela RECALCULADA pelo sistema, com as datas de retorno e de " +
      "pagamento, além dos erros e avisos de cada campo. NÃO grava nada — é a etapa de conferência. Chame de " +
      "novo a cada resposta da pessoa: o sistema pode ajustar o que ela pediu (data que cai em feriado, por " +
      "exemplo). Só ofereça confirmar quando a resposta vier com pronto_para_criar = true.",
    path: `${BASE_PATH}/simular`,
    params: [...IDENTIDADE, ...RASCUNHO],
    body_template: T_RASCUNHO,
    guard: "escopo_pessoa",
    panel_scope: SCOPE_PESSOA,
    response_hint:
      "Mostre como ficou: saída, retorno e dias de cada parcela, e quando cai o pagamento. Diga TODOS os " +
      "avisos. Se houver mensagem do tipo 'confirmar', pergunte à pessoa e só siga com a resposta dela.",
    search_terms:
      "quero sair dia\nférias a partir de\nsimular férias\nconferir minhas férias antes de pedir\n" +
      "data de retorno das férias\nquando cai o pagamento das férias\nadiantar 13º nas férias\n" +
      "Quero sair de férias no dia 1º de setembro\nSe eu sair dia 10, volto quando?\n" +
      "Quero 20 dias em setembro e 10 em dezembro",
    system_prompt: REGRA_VALORES,
  },
  {
    key: "ferias_criar",
    name: "Férias: criar a solicitação (grava)",
    description:
      "CRIA a requisição de férias e dispara o fluxo de aprovação. Só chame depois de ferias_simular ter " +
      "voltado pronto_para_criar = true e a pessoa ter confirmado, com os MESMOS valores da simulação. " +
      "Grava no sistema e não tem desfazer pelo chat.",
    path: `${BASE_PATH}/criar`,
    params: [...IDENTIDADE, ...RASCUNHO],
    body_template: T_RASCUNHO,
    guard: "confirmation_detalhada",
    panel_scope: SCOPE_PESSOA,
    response_hint:
      "Informe o número da solicitação. Quando a resposta trouxer ja_concluida = true, diga que a solicitação " +
      "foi criada E JÁ ESTÁ CONCLUÍDA. Caso contrário, apenas confirme que foi criada — não prometa prazo " +
      "nem diga quem vai aprovar.",
    search_terms:
      "confirmar solicitação de férias\npode criar minhas férias\npode enviar o pedido de férias\n" +
      "finalizar pedido de férias\nsim, quero solicitar essas férias\n" +
      "Pode confirmar minhas férias\nEnvia esse pedido de férias",
    system_prompt: REGRA_VALORES,
  },
  {
    key: "ferias_minhas",
    name: "Férias: minhas solicitações e em quem estão paradas",
    description:
      "Requisições de férias JÁ SOLICITADAS pelo colaborador, com a situação de cada uma (Aberta, Concluída, " +
      "Cancelada, Reprovada, Aprovada, Suspensa) e quantos aprovadores ainda faltam. Use para 'minha " +
      "solicitação saiu?', 'está parada em quem?', 'foi aprovada?'.",
    path: `${BASE_PATH}/minhas`,
    params: [...IDENTIDADE, empresaAlvo(), alvo()],
    body_template: { ...T_IDENT, ...T_PESSOA },
    guard: "escopo_pessoa",
    panel_scope: SCOPE_PESSOA,
    response_hint:
      "Diga a situação em palavras e, quando ainda houver aprovador pendente, que ela está aguardando " +
      "aprovação. Não afirme que foi aprovada enquanto a situação não for Concluída.",
    search_terms:
      "minha solicitação de férias\nstatus do pedido de férias\nminhas férias foram aprovadas\n" +
      "pedido de férias parado\nem quem está minha requisição de férias\nsolicitações de férias pendentes\n" +
      "Minhas férias já foram aprovadas?\nO que aconteceu com meu pedido de férias?",
  },
  {
    key: "ferias_aprovacoes",
    name: "Férias: solicitações aguardando MINHA aprovação",
    description:
      "Requisições de férias pendentes de aprovação PELO USUÁRIO LOGADO — incluindo aquelas em que ele é " +
      "suplente ou substituto do gestor. Cada item diz se é a vez dele (minha_vez) e se ele é o ÚLTIMO " +
      "aprovador. Use quando alguém perguntar o que tem para aprovar.",
    path: `${BASE_PATH}/aprovacoes`,
    params: [...IDENTIDADE],
    body_template: T_IDENT,
    guard: "escopo_painel",
    panel_scope: SCOPE_APROVADOR,
    response_hint:
      "Liste colaborador, período e dias. Quando minha_vez for false, diga que ainda não é a vez dele e o " +
      "motivo. Quando sou_ultimo_aprovador for true, avise que ao aprovar as férias vão para a folha.",
    search_terms:
      "o que tenho para aprovar\naprovações pendentes\nférias para aprovar\nsolicitações aguardando aprovação\n" +
      "minha equipe pediu férias\npendências de aprovação de férias\n" +
      "Tenho alguma férias para aprovar?\nO que está esperando minha aprovação?",
  },
  {
    key: "ferias_aprovar",
    name: "Férias: aprovar ou reprovar (grava)",
    description:
      "APROVA ou REPROVA uma solicitação de férias. A justificativa é obrigatória nos dois casos. Só chame " +
      "depois de ferias_aprovacoes ter mostrado a solicitação com minha_vez = true e a pessoa ter dito " +
      "claramente o que quer fazer. Grava no sistema e não tem desfazer pelo chat.",
    path: `${BASE_PATH}/aprovar`,
    params: [
      ...IDENTIDADE,
      numero("cod_solicitacao", "Número da solicitação, como veio de ferias_aprovacoes.", true),
      { ...texto("status", "'A' para aprovar, 'R' para reprovar.", true), tipo: "enum", opcoes: ["A", "R"] } as ToolParam,
      texto("justificativa", "Justificativa da pessoa, com as palavras dela. Obrigatória — não invente.", true),
    ],
    body_template: {
      ...T_IDENT,
      cod_solicitacao: "{{cod_solicitacao}}",
      status: "{{status}}",
      justificativa: "{{justificativa}}",
    },
    guard: "confirmation_detalhada",
    panel_scope: SCOPE_APROVADOR,
    response_hint:
      "Responda pelo campo `efeito`: concluida = aprovada e efetivada na folha; reprovada; " +
      "aguardando_proximo = registrada, falta outro aprovador. Se vier nenhum_efeito, diga que NÃO foi " +
      "possível registrar e que ela confira se a solicitação ainda está pendente para ela — nunca diga " +
      "que aprovou. Quando vier programacoes_canceladas, avise que a programação anterior do mesmo " +
      "período foi cancelada — quem aprovou precisa saber disso.",
    search_terms:
      "aprovar férias\nreprovar férias\nnegar pedido de férias\naprovar solicitação de férias da equipe\n" +
      "recusar férias\naprovar requisição\n" +
      "Pode aprovar as férias do João\nReprova esse pedido de férias",
  },
];

async function main() {
  const { data: base, error: eb } = await db
    .from("ai_bases")
    .select("id, name, base_url")
    .ilike("base_code", BASE_CODE)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (eb) throw eb;
  if (!base) throw new Error(`Base "${BASE_CODE}" não encontrada (ou inativa).`);
  console.log(`Base: ${base.name} (${base.id})  base_url=${base.base_url ?? "(vazio)"}`);

  // Candidato NÃO entra: quem está em processo seletivo não tem férias. O
  // panel_scope PCAND = "nenhum" já barraria a chamada, mas deixar a ferramenta
  // no catálogo dele seria pagar tokens de schema por algo que nunca roda — e
  // dar ao modelo uma opção que só pode terminar em recusa.
  const { data: todos, error: ea } = await db.from("ai_agents").select("id, key").eq("active", true);
  if (ea) throw ea;
  const agentes = (todos ?? []).filter((a) => !/candidat/i.test(a.key));
  console.log(`Agentes: ${agentes.map((a) => a.key).join(", ") || "(nenhum)"}`);
  const fora = (todos ?? []).filter((a) => /candidat/i.test(a.key));
  if (fora.length) console.log(`Fora (candidato): ${fora.map((a) => a.key).join(", ")}\n`);

  for (const t of TOOLS) {
    const { data: tool, error: et } = await db
      .from("ai_tools")
      .upsert(
        {
          key: t.key,
          name: t.name,
          description: t.description,
          method: "POST",
          path_template: t.path,
          auth_type: "oauth2",
          endpoint_kind: "base",
          params: t.params as unknown as Json,
          body_template: t.body_template as Json,
          response_hint: t.response_hint,
          search_terms: t.search_terms,
          system_prompt: t.system_prompt ?? "",
          panel_scope: t.panel_scope as unknown as Json,
          exclude_self: false,
          guard: t.guard,
          cache_ttl: t.cache_ttl ?? 0,
          cache_scope: t.cache_scope ?? "user",
          always_include: false,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      )
      .select("id")
      .single();
    if (et) throw et;

    const { error: el } = await db
      .from("ai_base_tools")
      .upsert(
        { base_id: base.id, tool_id: tool.id, enabled: true, portais: PORTAIS, perfis: [] },
        { onConflict: "base_id,tool_id" },
      );
    if (el) throw el;

    if (agentes.length) {
      const { error: eg } = await db
        .from("ai_agent_tools")
        .upsert(
          agentes.map((a) => ({ agent_id: a.id, tool_id: tool.id })),
          { onConflict: "agent_id,tool_id", ignoreDuplicates: true },
        );
      if (eg) throw eg;
    }

    // Desfaz vínculo com agente de candidato — a primeira versão deste script
    // ligava em TODOS os agentes ativos.
    for (const f of fora) await db.from("ai_agent_tools").delete().eq("agent_id", f.id).eq("tool_id", tool.id);

    await db.from("ai_tool_modules").delete().eq("tool_id", tool.id);
    const { error: em } = await db
      .from("ai_tool_modules")
      .insert(MODULOS.map((m) => ({ tool_id: tool.id, modulo: m.modulo, submodulo: m.submodulo })));
    if (em) throw em;

    await syncToolEmbedding(db, tool.id, t.name, t.description, {
      searchTerms: t.search_terms,
      responseHint: t.response_hint,
    });

    const escreve = t.guard === "confirmation_detalhada";
    console.log(
      `  ${escreve ? "✎" : "→"} ${t.key.padEnd(20)} ${t.path.padEnd(34)} ` +
        `params=${String(t.params.length).padStart(2)} guard=${t.guard}`,
    );
  }

  console.log(
    `\n✅ ${TOOLS.length} ferramentas de férias no catálogo — 5 de leitura e 2 de escrita ` +
      `(ferias_criar e ferias_aprovar, atrás de confirmação explícita da pessoa).\n` +
      `   Confira em /admin/integracoes. Para tirar do ar sem apagar: active = false.`,
  );
}

main().catch((e) => {
  console.error("Falhou:", e?.message ?? e);
  process.exit(1);
});
