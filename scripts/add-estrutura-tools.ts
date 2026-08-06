/**
 * Cadastra (idempotente) as ferramentas do módulo ORDS **estrutura** que ainda
 * NÃO existiam no catálogo, a partir do export `api_estrutura.sql`.
 *
 * Das 13 rotas do módulo, 7 já eram tools (`estrutura_empresas`, `_filiais`,
 * `_centros_custo`, `_unidades_adm`, `_locais_trabalho`, `_cargos`, `_funcoes`)
 * e ficam INTOCADAS. Este script cria as 5 restantes; `v1/frequencia/eventos_ponto`
 * fica de fora porque o export tem só o TEMPLATE, sem HANDLER (sem SQL nem params).
 *
 * Todas são CADASTROS de leitura (GET) que servem para resolver NOME → CÓDIGO —
 * mesmo papel das irmãs. Por isso, seguindo o padrão delas:
 *   · disponíveis em TODOS os painéis (portais PO/PG/PC) e para TODOS os perfis
 *     (`perfis: []` = liberado), com `panel_scope` = todos nos três painéis;
 *   · vinculadas aos TRÊS agentes ativos (operador, colaborador, gestão) — o
 *     vínculo é ADITIVO (upsert), nunca apaga vínculo de outra tool/agente;
 *   · param `termo` (local=none): a IA manda o NOME e o servidor filtra a lista
 *     antes de devolver — menos tokens e nada de "invente o código";
 *   · cache por empresa (dados quase-estáticos); as duas tabelas globais
 *     (situação funcional e vínculo) usam cache global e TTL longo.
 *
 * Rodar: npm run tools:estrutura
 */
import ws from "ws";
// supabase-js recente exige WebSocket nativo (Node 22+); em Node 20, polyfill.
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
const PANEL_SCOPE = { PO: "todos", PG: "todos", PC: "todos" } as const;

// ── Fábricas de parâmetro (mesmas convenções de scripts/natcorp-tools.ts) ─────
/** Filtro (código) que a IA extrai da conversa. Código é TEXTO (pode ter zero à esquerda). */
const filtro = (nome: string, descricao: string): ToolParam => ({
  nome,
  descricao,
  tipo: "string",
  origem: "modelo",
  obrigatorio: false,
  local: "query",
});
/** Nome para o servidor filtrar a lista (não vai na requisição). */
const termo = (exemplo: string): ToolParam => ({
  nome: "termo",
  descricao:
    `Se o usuário citou um NOME (não um código), informe-o aqui: o servidor filtra a lista por nome ` +
    `(ex.: '${exemplo}'). Vazio = lista completa.`,
  tipo: "string",
  origem: "modelo",
  obrigatorio: false,
  local: "none",
});
/** Usuário logado — injetado do login; é ele que escopa o acesso no ORDS. */
const usuario = (): ToolParam => ({
  nome: "usuario",
  descricao: "",
  tipo: "string",
  origem: "identidade",
  obrigatorio: true,
  local: "query",
  campoIdentidade: "usuario",
});

type NovaTool = {
  key: string;
  name: string;
  description: string;
  path_template: string;
  params: ToolParam[];
  response_hint: string;
  search_terms: string;
  cache_ttl: number;
  cache_scope: "user" | "empresa" | "global";
  /** Tags de assunto (ai_tool_modules) — a base natcorp usa roteamento por módulo. */
  modulos: { modulo: string; submodulo: string | null }[];
  /**
   * false = fica CADASTRADA mas fora do alcance do modelo. Usado quando o endpoint
   * está quebrado no ORDS: melhor não existir para a IA do que existir e errar
   * (ela gastaria um turno para receber um HTTP 403). Vira `true` sozinho ao
   * rodar de novo depois que o lado Oracle for corrigido — basta trocar aqui.
   */
  active?: boolean;
  /** Por que está inativa (aparece no log). */
  nota?: string;
};

const TOOLS: NovaTool[] = [
  // ── 1. Eventos de banco de horas ──────────────────────────────────────────
  {
    key: "estrutura_eventos_banco_horas",
    name: "Estrutura: eventos de banco de horas",
    description:
      "Lista os EVENTOS DE BANCO DE HORAS cadastrados numa empresa: código, descrição, se é CRÉDITO ou " +
      "DÉBITO de horas, coeficiente, coeficiente do ponto, ocorrência de folha vinculada, se permite " +
      "justificar e se é remanescente. Use para RESOLVER o NOME de um evento em CÓDIGO, ou para explicar " +
      "como um evento credita/debita horas no banco. Não traz saldo de ninguém — é o CADASTRO dos eventos. " +
      "Se o usuário citou a empresa pelo NOME, resolva o código antes com estrutura_empresas.",
    path_template: "/estrutura/v1/frequencia/eventos_banco_horas",
    params: [
      filtro("empresa", "Código da empresa (já resolvido)."),
      filtro("cod_evento", "Código do evento de banco de horas, se quiser filtrar."),
      termo("Hora extra"),
      usuario(),
    ],
    response_hint:
      "Responda com código, descrição e se é crédito ou débito. Coeficiente, ocorrência de folha e " +
      "indicadores só quando o usuário perguntar por eles.",
    search_terms:
      "eventos de banco de horas\nbanco de horas\ncódigo do evento de banco de horas\ncrédito e débito de horas\n" +
      "eventos de compensação de horas\nhoras a crédito\nhoras a débito\ncoeficiente do evento\n" +
      "Quais são os eventos de banco de horas da empresa?\nQual o código do evento de crédito de horas?\n" +
      "Esse evento de banco de horas soma ou desconta?\nQuais eventos de banco de horas permitem justificar?",
    cache_ttl: 1800,
    cache_scope: "empresa",
    modulos: [
      { modulo: "ESTRUTURA", submodulo: null },
      { modulo: "FREQUÊNCIA", submodulo: null },
      { modulo: "PONTO E FREQUÊNCIA", submodulo: null },
    ],
  },
  // ── 2. Ocorrências / rubricas de pagamento ────────────────────────────────
  {
    key: "estrutura_ocorrencias_pagamento",
    name: "Estrutura: ocorrências (rubricas) de pagamento",
    description:
      "Lista as OCORRÊNCIAS DE PAGAMENTO — as rubricas/eventos da folha (código, dígito, nome e sigla) — de " +
      "uma empresa, com as regras de incidência cadastradas: INSS (incid_iapas), IRRF (incid_ir), FGTS " +
      "(incid_fgts), DSR, férias, 13º, RAIS, eSocial, unidades, categoria e afins. Use para RESOLVER o NOME " +
      "de uma rubrica em CÓDIGO (ex.: 'hora extra 50%'), para traduzir um código de ocorrência que apareceu " +
      "noutra consulta, ou para conferir se uma rubrica incide em INSS/IRRF/FGTS. Informe SEMPRE o `termo` " +
      "quando o usuário citar o nome da rubrica: a lista completa é longa. Se citou a empresa pelo NOME, " +
      "resolva o código antes com estrutura_empresas.",
    path_template: "/estrutura/v1/ocorr_pagto",
    params: [
      filtro("empresa", "Código da empresa (já resolvido)."),
      filtro("ocorrencia", "Código da ocorrência/rubrica, se quiser filtrar."),
      termo("Hora extra"),
      usuario(),
    ],
    response_hint:
      "Cada linha traz DEZENAS de campos técnicos de incidência (incid_*). Responda só o que foi perguntado — " +
      "em geral código, nome e sigla. Tradução dos principais: incid_iapas = INSS, incid_ir = IRRF, " +
      "incid_fgts = FGTS, incid_dsr = DSR. Nunca despeje a linha inteira.",
    search_terms:
      "rubricas da folha\nocorrências de pagamento\neventos da folha de pagamento\nverbas\nproventos e descontos\n" +
      "código da rubrica\ncódigo do evento da folha\nincidência de INSS\nincidência de IR\nincidência de FGTS\n" +
      "Qual é o código da rubrica de hora extra?\nEssa verba incide em INSS?\nO que significa o evento 101 do holerite?\n" +
      "Quais são as rubricas de desconto da empresa?\nA rubrica de gratificação entra na base do FGTS?",
    cache_ttl: 1800,
    cache_scope: "empresa",
    modulos: [
      { modulo: "ESTRUTURA", submodulo: null },
      { modulo: "PAGAMENTO", submodulo: null },
      { modulo: "FINANCEIRO", submodulo: null },
      { modulo: "ADMINISTRAÇÃO DE PESSOAL", submodulo: null },
    ],
    active: false,
    nota:
      "ORDS devolve HTTP 555 com ORA-00918 (coluna definida de maneira ambígua): a lista de ~200 colunas do " +
      "SELECT vai SEM prefixo de tabela e colide com as colunas homônimas de EMPRESAS (e) e " +
      "USUARIO_ORACLE_FILIAIS (u) — sit, usuario, cidade, uf, endereco, bairro, cep, categoria, " +
      "dt_atualizacao, condicao… Correção no handler: prefixar tudo com `o.`. Feito isso, troque para " +
      "active: true e rode de novo.",
  },
  // ── 3. Sindicatos ─────────────────────────────────────────────────────────
  // ATENÇÃO: no export ORDS este handler NÃO declara DEFINE_PARAMETER — os binds
  // (:p_emp, :p_cod_sindicato, :p_usuario) dependem do bind implícito do ORDS, que
  // casa pelo NOME DO BIND. Por isso os params vão como `p_*` (e não empresa/usuario
  // como nas irmãs). Validado pelo teste de endpoints antes de ativar.
  {
    key: "estrutura_sindicatos",
    name: "Estrutura: sindicatos",
    description:
      "Lista os SINDICATOS cadastrados numa empresa: código, nome, sigla, CNPJ, código do Ministério do " +
      "Trabalho, situação, data-base, dias de aviso prévio, piso salarial, percentuais de insalubridade e " +
      "periculosidade, regras de vale-transporte, DSR, adicional noturno, médias, contribuições e vigência do " +
      "acordo. Use para RESOLVER o NOME de um sindicato em CÓDIGO, ou para consultar uma regra da convenção " +
      "coletiva CADASTRADA no sistema. Se o usuário citou a empresa pelo NOME, resolva o código antes com " +
      "estrutura_empresas.",
    path_template: "/estrutura/v1/sindicatos",
    params: [
      filtro("p_emp", "Código da empresa (já resolvido)."),
      filtro("p_cod_sindicato", "Código do sindicato, se quiser filtrar."),
      termo("Comerciários"),
      {
        nome: "p_usuario",
        descricao: "",
        tipo: "string",
        origem: "identidade",
        obrigatorio: true,
        local: "query",
        campoIdentidade: "usuario",
      },
    ],
    response_hint:
      "Cada sindicato traz mais de cem campos de regra. Responda só o que foi perguntado — em geral código, " +
      "nome, sigla e CNPJ. Só cite piso, data-base, percentuais ou regras de VT/DSR quando forem o assunto da " +
      "pergunta. Estes valores são o que está CADASTRADO no sistema, não a íntegra da convenção coletiva.",
    search_terms:
      "sindicatos\nsindicato da empresa\nconvenção coletiva\nacordo coletivo\ndata-base\npiso salarial do sindicato\n" +
      "código do sindicato\nCNPJ do sindicato\nadicional de insalubridade\nadicional de periculosidade\n" +
      "Qual é o sindicato da minha empresa?\nQual o piso salarial do sindicato?\nQuando é a data-base da categoria?\n" +
      "Quantos dias de aviso prévio o sindicato prevê?\nQual o percentual de insalubridade do sindicato?",
    cache_ttl: 1800,
    cache_scope: "empresa",
    modulos: [
      { modulo: "ESTRUTURA", submodulo: null },
      { modulo: "ADMINISTRAÇÃO DE PESSOAL", submodulo: null },
      { modulo: "RECURSOS HUMANOS", submodulo: null },
    ],
  },
  // ── 4. Situações funcionais (tabela global — sem usuario) ─────────────────
  {
    key: "estrutura_situacoes_funcionais",
    name: "Estrutura: situações funcionais",
    description:
      "Lista as SITUAÇÕES FUNCIONAIS do colaborador: código, nome e o TIPO consolidado (ATIVO, AFASTADO, " +
      "TRANSFERIDO ou DESLIGADO). Use para TRADUZIR o código de situação que aparece noutras consultas " +
      "(ex.: situação '01' = ATIVO), ou para RESOLVER o NOME de uma situação em CÓDIGO antes de filtrar outra " +
      "ferramenta. Tabela geral do sistema — não é a situação de um colaborador específico.",
    path_template: "/estrutura/v1/situacao_funcional",
    params: [
      filtro("cod_sit", "Código da situação, se quiser filtrar."),
      {
        nome: "tipo_sit",
        descricao: "Tipo consolidado, para trazer só as situações daquele grupo.",
        tipo: "enum",
        origem: "modelo",
        obrigatorio: false,
        local: "query",
        opcoes: ["ATIVO", "AFASTADO", "TRANSFERIDO", "DESLIGADO"],
      },
      termo("Auxílio-doença"),
    ],
    response_hint:
      "Responda com código, nome e tipo. Serve como legenda: use-a para explicar o código de situação que " +
      "veio de outra consulta, em vez de repetir o código cru para o usuário.",
    search_terms:
      "situação funcional\nsituações do colaborador\ncódigo de situação\nafastamento\nafastado\ndesligado\n" +
      "transferido\nativo\ntabela de situações\nlegenda da situação\n" +
      "O que significa a situação 02?\nQuais são os códigos de afastamento?\nQual o código de situação de quem está de licença?\n" +
      "Quais situações contam como desligado?\nMe mostra a lista de situações funcionais.",
    cache_ttl: 43200,
    cache_scope: "global",
    modulos: [
      { modulo: "ESTRUTURA", submodulo: null },
      { modulo: "DADOS FUNCIONAIS", submodulo: null },
      { modulo: "MOVIMENTAÇÕES", submodulo: null },
    ],
  },
  // ── 5. Vínculos empregatícios (tabela global — sem usuario) ──────────────
  {
    key: "estrutura_vinculos_empregaticios",
    name: "Estrutura: vínculos empregatícios",
    description:
      "Lista os VÍNCULOS EMPREGATÍCIOS cadastrados (código e nome — ex.: CLT, estagiário, aprendiz, " +
      "temporário, autônomo). Use para TRADUZIR o código de vínculo que aparece noutras consultas, ou para " +
      "RESOLVER o NOME do vínculo em CÓDIGO antes de filtrar outra ferramenta. Tabela geral do sistema — não " +
      "é o vínculo de um colaborador específico.",
    path_template: "/estrutura/v1/vinculo_empreg",
    params: [filtro("cod_vinculo", "Código do vínculo, se quiser filtrar."), termo("Aprendiz")],
    response_hint: "Responda com código e nome. Serve como legenda do código de vínculo vindo de outra consulta.",
    search_terms:
      "vínculo empregatício\ntipos de contrato\nCLT\nestagiário\naprendiz\ntemporário\nautônomo\n" +
      "código do vínculo\ntabela de vínculos\nregime de contratação\n" +
      "Quais são os tipos de vínculo empregatício?\nO que significa o vínculo 10?\nQual o código do vínculo de estagiário?\n" +
      "Que regimes de contratação existem no sistema?",
    cache_ttl: 43200,
    cache_scope: "global",
    modulos: [
      { modulo: "ESTRUTURA", submodulo: null },
      { modulo: "DADOS FUNCIONAIS", submodulo: null },
      { modulo: "ADMINISTRAÇÃO DE PESSOAL", submodulo: null },
    ],
  },
];

async function main() {
  const { data: base, error: eb } = await db
    .from("ai_bases")
    .select("id, name, base_url, credential_id")
    .ilike("base_code", BASE_CODE)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (eb) throw eb;
  if (!base) throw new Error(`Base "${BASE_CODE}" não encontrada (ou inativa).`);
  console.log(`Base: ${base.name} (${base.id})  base_url=${base.base_url ?? "(vazio)"}`);

  // Agentes ATIVOS: as tools de estrutura ficam em todos (mesmo padrão das irmãs).
  const { data: agentes, error: ea } = await db.from("ai_agents").select("id, key").eq("active", true);
  if (ea) throw ea;
  console.log(`Agentes ativos: ${(agentes ?? []).map((a) => a.key).join(", ") || "(nenhum)"}`);

  for (const t of TOOLS) {
    const { data: tool, error: et } = await db
      .from("ai_tools")
      .upsert(
        {
          key: t.key,
          name: t.name,
          description: t.description,
          method: "GET",
          path_template: t.path_template,
          auth_type: "oauth2",
          endpoint_kind: "base", // herda base_url + credencial da base
          params: t.params as unknown as Json,
          response_hint: t.response_hint,
          search_terms: t.search_terms,
          panel_scope: PANEL_SCOPE as unknown as Json,
          exclude_self: false,
          guard: null,
          cache_ttl: t.cache_ttl,
          cache_scope: t.cache_scope,
          always_include: false,
          active: t.active ?? true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      )
      .select("id")
      .single();
    if (et) throw et;

    // Ativação na base + acesso: todos os painéis, todos os perfis.
    const { error: el } = await db
      .from("ai_base_tools")
      .upsert(
        { base_id: base.id, tool_id: tool.id, enabled: true, portais: PORTAIS, perfis: [] },
        { onConflict: "base_id,tool_id" },
      );
    if (el) throw el;

    // Vínculo com os agentes — ADITIVO (upsert), nunca apaga vínculo alheio.
    if (agentes?.length) {
      const { error: eg } = await db
        .from("ai_agent_tools")
        .upsert(
          agentes.map((a) => ({ agent_id: a.id, tool_id: tool.id })),
          { onConflict: "agent_id,tool_id", ignoreDuplicates: true },
        );
      if (eg) throw eg;
    }

    // Tags de assunto (a base usa roteamento por módulo). Recria só as DESTA tool.
    await db.from("ai_tool_modules").delete().eq("tool_id", tool.id);
    const { error: em } = await db
      .from("ai_tool_modules")
      .insert(t.modulos.map((m) => ({ tool_id: tool.id, modulo: m.modulo, submodulo: m.submodulo })));
    if (em) throw em;

    // Embedding do catálogo (seleção semântica de ferramentas).
    await syncToolEmbedding(db, tool.id, t.name, t.description, {
      searchTerms: t.search_terms,
      responseHint: t.response_hint,
    });

    const ativa = t.active ?? true;
    console.log(
      `  ${ativa ? "✓" : "⏸"} ${t.key.padEnd(34)} ${t.path_template.padEnd(46)} ` +
        `params=${t.params.length} portais=${PORTAIS.join("/")} agentes=${agentes?.length ?? 0} tags=${t.modulos.length}` +
        `${ativa ? "" : "  [INATIVA]"}`,
    );
    if (!ativa && t.nota) console.log(`      ↳ ${t.nota}`);
  }

  const ativas = TOOLS.filter((t) => t.active ?? true).length;
  console.log(
    `\n✅ ${TOOLS.length} ferramentas de estrutura no catálogo (${ativas} ativas, ${TOOLS.length - ativas} aguardando ` +
      `correção no ORDS). Confira em /admin/integracoes.`,
  );
}

main().catch((e) => {
  console.error("Falhou:", e?.message ?? e);
  process.exit(1);
});
