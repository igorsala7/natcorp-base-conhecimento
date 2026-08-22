/**
 * PLACAR DE SELEÇÃO DE FERRAMENTAS — read-only.
 *
 * Roda os casos anotados de `eval/casos.jsonl` pelo MESMO caminho semântico do
 * chat (`simTools` + `selecionarTopK`) e diz, com número, se a ferramenta que
 * DEVERIA ser escolhida chega ao modelo.
 *
 * É a linha de base que faltava. Sem ela, toda mudança em prompt, embedding ou
 * seleção era irreversível: ninguém conseguia provar que não piorou — e foi
 * exatamente assim que a percepção de qualidade caiu sem causa identificável.
 *
 * ── Duas perguntas, não uma ─────────────────────────────────────────────────
 * O placar separa dois fracassos que parecem o mesmo e têm causas opostas:
 *
 *   ESCOLHEU ERRADO   — a tool estava disponível e o ranking não a trouxe.
 *                       Conserta-se com embedding, descrição, ontologia.
 *   NÃO PODIA ACERTAR — a tool foi removida antes do ranking (escopo de painel,
 *                       inativa, fora do catálogo). Nenhum ajuste de modelo
 *                       resolve; é configuração.
 *
 * Sem essa separação, um caso de configuração vira meses de ajuste no modelo.
 * Caso real: `listar_colaboradores_resumo` ("Minha Equipe") tem
 * `panel_scope.PO = "nenhum"`, então some no Painel do Operador — e o modelo
 * pegava a vizinha mais próxima. Parecia erro de escolha; era cardápio.
 *
 *   npm run eval:tools
 *   npm run eval:tools -- --base natcorp --top 10
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import type { Database } from "../src/lib/database.types";
import { simTools } from "../src/lib/integrations/tool-catalog";
import { selecionarTopK } from "../src/lib/integrations/tool-narrow";
import { escopoDoPainel, normalizarPanelScope } from "../src/lib/integrations/panel-scope";

// O Node 20 não traz `WebSocket` nativo e o cliente do Supabase instancia o
// Realtime no construtor — mesmo polyfill de `simular-selecao.ts`.
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
  const { WebSocket } = await import("ws");
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
}

type Caso = {
  pergunta: string;
  faixa: string;
  palavras: number;
  portal: string | null;
  espera_tool: string | null;
  espera_params: Record<string, unknown> | null;
  espera_clarify: boolean;
  revisar?: boolean;
  /** Era gestor de equipe no turno — muda o escopo efetivo, não só o painel. */
  gestor?: boolean;
  /** Foto do que o funil entregou NO DIA do trace. Só para detectar contradição
   *  com o veredito deste simulador — nunca para decidir o veredito. */
  ofertadas?: string[];
  foi_tools: string[];
};

const arg = (nome: string, padrao: string): string => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : padrao;
};

const BASE = arg("base", "natcorp");
/**
 * Teto do top-K na simulação.
 *
 * `MAX_TOOLS_MODELO` é 6, mas produção sobe para `MAX_TOOLS_COMPOSTO` (18) em
 * pergunta multi-intenção, soma dependências e só então corta em
 * `TETO_DURO_TOOLS` (12). Simular com 6 reprovava ferramentas que a produção
 * entregou — e um eval que inventa falha é pior que nenhum: gasta o crédito de
 * quem confia nele. 12 é o teto que vale no fim de qualquer caminho.
 */
const TOP = Number(arg("top", "12"));
const ARQUIVO = arg("casos", "eval/casos.jsonl");

/**
 * Ferramentas LOCAIS: não vêm de `ai_tools`, não passam por top-K, estão sempre
 * disponíveis ao modelo. Para elas a pergunta "chegou ao modelo?" não faz
 * sentido — a pergunta é "o modelo USOU?", que só o turno real responde.
 *
 * Separar as duas importa: `gerar_relatorio` faltando é o modelo não ter
 * percebido que devia gerar; `sesmt_procedimentos` faltando pode ser a
 * ferramenta nunca ter chegado. Causas opostas, correções opostas.
 */
const LOCAIS = new Set([
  "gerar_relatorio", "montar_grafico", "gerar_convite",
  "consultar_registros", "agregar_valores", "estatisticas", "agrupar",
  "calcular", "derivar_coluna", "classificar_faixa", "projetar",
  "destacar_tela", "tutorial_tela", "preencher_campo", "marcar_opcao", "clicar_elemento",
]);

const FAIXAS = ["telegrafica", "curta", "media", "detalhada"] as const;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const db = createClient<Database>(url, key, { auth: { persistSession: false } });

  const casos: Caso[] = readFileSync(ARQUIVO, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Caso);

  // Só o que tem gabarito de ferramenta. Caso sem tool esperada mede outra
  // coisa (recuperação/conversa) e entra no eval de RAG, não neste.
  const comGabarito = casos.filter((c) => c.espera_tool);
  const naoAnotados = casos.filter((c) => c.revisar).length;

  // Catálogo do que EXISTE e está ativo — para separar "escolheu errado" de
  // "não podia acertar".
  const { data: catalogo } = await db.from("ai_tools").select("key, name, active, panel_scope");
  const porKey = new Map((catalogo ?? []).map((t) => [t.key as string, t]));

  // As ferramentas HABILITADAS nesta base — o mesmo conjunto que o chat monta
  // (`simular-selecao.ts` faz idêntico). Sem o vínculo, o top-K rodaria sobre um
  // catálogo que a base não tem.
  const { data: base } = await db.from("ai_bases").select("id").eq("base_code", BASE).maybeSingle();
  if (!base) {
    console.error(`Base "${BASE}" não encontrada.`);
    process.exit(1);
  }
  const { data: vinculos } = await db
    .from("ai_base_tools")
    .select("tool:ai_tools(key, name, description, search_terms, always_include, active)")
    .eq("base_id", base.id)
    .eq("enabled", true);
  type T = {
    key: string;
    name: string;
    description: string | null;
    search_terms: string | null;
    always_include: boolean | null;
    active: boolean;
  };
  const tools = (vinculos ?? [])
    .map((r) => (r as unknown as { tool: T | null }).tool)
    .filter((t): t is T => !!t && t.active)
    .map((t) => ({
      key: t.key,
      name: t.name,
      description: t.description ?? "",
      searchTerms: t.search_terms ?? "",
      alwaysInclude: t.always_include === true,
    }));
  const habilitadas = new Set(tools.map((t) => t.key));
  console.log(`base ${BASE} · ${tools.length} ferramentas habilitadas · teto do top-K: ${TOP}`);

  console.log(`\n${casos.length} casos · ${comGabarito.length} com ferramenta esperada`);
  if (naoAnotados) console.log(`⚠ ${naoAnotados} ainda com "revisar": true — o placar conta só o que foi conferido`);
  console.log();

  type Linha = { caso: Caso; ok: boolean; motivo: string; posicao: number | null };
  const linhas: Linha[] = [];

  for (const c of comGabarito) {
    const alvo = c.espera_tool!;

    // (0) Local: sempre disponível — o que se mede é o USO no turno real.
    if (LOCAIS.has(alvo)) {
      const usou = c.foi_tools.includes(alvo);
      linhas.push({
        caso: c,
        ok: usou,
        motivo: usou ? "" : "USO: ferramenta local disponível e não usada",
        posicao: null,
      });
      continue;
    }

    const meta = porKey.get(alvo);

    // (a) O gabarito aponta para uma ferramenta que não existe? Erro de anotação.
    if (!meta) {
      linhas.push({ caso: c, ok: false, motivo: "GABARITO: chave inexistente", posicao: null });
      continue;
    }
    // (b) Inativa ou barrada no painel deste caso → não podia acertar.
    //
    // Chama `escopoDoPainel`, a MESMA função que o `tool-builder` usa. Aqui havia
    // uma cópia da regra (`panel_scope[portal] === "nenhum"`), e cópia de regra é
    // o modo de falha dominante deste código: ela não conhecia a elevação do
    // gestor e reprovaria casos que a produção libera. Um eval com regra própria
    // mede o eval, não o sistema.
    if (meta.active === false) {
      linhas.push({ caso: c, ok: false, motivo: "CONFIG: ferramenta inativa", posicao: null });
      continue;
    }
    const escopo = escopoDoPainel(
      normalizarPanelScope(meta.panel_scope),
      c.portal ?? undefined,
      false,
      c.gestor === true,
    );
    if (escopo === "nenhum") {
      // O simulador acabou de dizer que a ferramenta estava barrada. Se o turno
      // REAL mostra ela ofertada (ou chamada), quem está errado é o simulador —
      // e o motivo mais comum é falta de dado no caso, não bloqueio de verdade:
      // as duas CONFIG de 22/08/2026 eram `gestor` ausente, e o eval passava
      // `false` para uma pessoa que o trace registrava como gestora de equipe.
      //
      // Troca só o RÓTULO, nunca o veredito: `ofertadas` é instantâneo velho, e
      // se um dia o cadastro passar a bloquear de verdade uma ferramenta que a
      // foto antiga mostrava, um detector que absolvesse o caso leria bloqueio
      // legítimo de segurança como erro de anotação.
      const producaoTinha = c.ofertadas?.includes(alvo) === true || c.foi_tools.includes(alvo);
      linhas.push({
        caso: c,
        ok: false,
        motivo: producaoTinha
          ? `ANOTAÇÃO: escopo calculado diz bloqueada em ${c.portal}, mas a produção ofereceu esta ferramenta no turno — provável falta do campo "gestor" no caso`
          : `CONFIG: escopo "nenhum" em ${c.portal}${c.gestor ? " (mesmo sendo gestor)" : ""}`,
        posicao: null,
      });
      continue;
    }
    if (!habilitadas.has(alvo)) {
      linhas.push({ caso: c, ok: false, motivo: `CONFIG: não habilitada na base ${BASE}`, posicao: null });
      continue;
    }

    // (c) Disponível: o ranking a traz?
    const sim = await simTools(db, BASE, c.pergunta);
    if (sim.size === 0) {
      linhas.push({ caso: c, ok: false, motivo: "EMBEDDING: falhou ou catálogo vazio", posicao: null });
      continue;
    }
    const escolhidas = selecionarTopK(tools, c.pergunta, TOP, undefined, sim);
    // A posição no ranking bruto explica QUÃO longe ficou: 7º de 87 é ajuste
    // fino; 60º é a descrição da ferramenta não falar a língua da pergunta.
    const ranking = [...sim.entries()].sort((a, b) => b[1] - a[1]);
    const pos = ranking.findIndex(([k]) => k === alvo) + 1;
    const ok = escolhidas.has(alvo);
    linhas.push({
      caso: c,
      ok,
      motivo: ok ? "" : `RANKING: disponível, ficou em ${pos || "?"}º de ${ranking.length}`,
      posicao: pos || null,
    });
  }

  // ── Placar ────────────────────────────────────────────────────────────────
  const acertos = linhas.filter((l) => l.ok).length;
  const config = linhas.filter((l) => l.motivo.startsWith("CONFIG")).length;
  const ranking = linhas.filter((l) => l.motivo.startsWith("RANKING")).length;
  const gabarito = linhas.filter((l) => l.motivo.startsWith("GABARITO")).length;
  const uso = linhas.filter((l) => l.motivo.startsWith("USO")).length;
  const anotacao = linhas.filter((l) => l.motivo.startsWith("ANOTAÇÃO")).length;

  console.log("── PLACAR ".padEnd(62, "─"));
  console.log(`  acerto de ferramenta   ${acertos}/${linhas.length}  (${pct(acertos, linhas.length)})`);
  console.log(`  falha de RANKING       ${ranking}   ← ajuste de modelo/embedding/ontologia resolve`);
  console.log(`  falha de CONFIG        ${config}   ← NENHUM ajuste de modelo resolve`);
  console.log(`  falha de USO           ${uso}   ← estava disponível; o modelo não usou (prompt/descrição)`);
  if (anotacao) console.log(`  contradiz a produção   ${anotacao}   ← o simulador diz bloqueada e o trace diz ofertada: falta dado no caso`);
  if (gabarito) console.log(`  gabarito inválido      ${gabarito}   ← corrija eval/casos.jsonl`);

  console.log("\n── POR FAIXA DE TAMANHO ".padEnd(62, "─"));
  for (const f of FAIXAS) {
    const g = linhas.filter((l) => l.caso.faixa === f);
    if (!g.length) continue;
    const a = g.filter((l) => l.ok).length;
    console.log(`  ${f.padEnd(12)} ${a}/${g.length}  ${pct(a, g.length)}`);
  }

  const falhas = linhas.filter((l) => !l.ok);
  if (falhas.length) {
    console.log("\n── FALHAS ".padEnd(62, "─"));
    for (const l of falhas) {
      console.log(`  "${l.caso.pergunta.slice(0, 46)}"`);
      console.log(`      esperado: ${l.caso.espera_tool}   ${l.motivo}`);
      if (l.caso.foi_tools.length) console.log(`      chamou:   ${l.caso.foi_tools.join(", ")}`);
    }
  }
  console.log();
}

const pct = (a: number, b: number): string => (b ? `${Math.round((a / b) * 100)}%` : "—");

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
