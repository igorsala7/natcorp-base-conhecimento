/**
 * SIMULADOR DE SELEÇÃO DE FERRAMENTAS — read-only.
 *
 * Manda perguntas reais pelo MESMO caminho semântico do chat (`simTools` +
 * `selecionarTopK`) e diz se a ferramenta esperada chegou ao modelo. Não grava
 * nada, não chama API de cliente — só embeda a pergunta e compara vetores.
 *
 * Existe porque a pergunta "as tools certas voltam?" só tinha uma resposta
 * possível até agora: abrir o chat e testar à mão, um caso por vez. As 10
 * ferramentas Microsoft ficaram semanas fora do catálogo sem ninguém notar —
 * este script transforma essa classe de falha em saída de terminal.
 *
 *   npm run simular:selecao              # bateria padrão, base natcorp
 *   npm run simular:selecao -- --base X  # outra base
 *   npm run simular:selecao -- --top 15  # mostra mais candidatas por pergunta
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { simTools } from "../src/lib/integrations/tool-catalog";
import { selecionarTopK } from "../src/lib/integrations/tool-narrow";

// O Node 20 não traz `WebSocket` nativo, e o cliente do Supabase instancia o
// Realtime dentro do construtor — sem isto o script morre antes da 1ª consulta.
// Este script não usa Realtime; o polyfill só existe para o construtor passar,
// e assim ele roda igual no Node 20 e no 22+.
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
  const { WebSocket } = await import("ws");
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
}

type Caso = {
  pergunta: string;
  /** Chave que PRECISA estar entre as selecionadas. */
  espera: string;
  /** Rótulo do grupo, só para a leitura do relatório. */
  grupo: string;
};

/**
 * A bateria. Os casos de RH vieram de `ai_chat_traces` (perguntas que pessoas
 * realmente fizeram); os de Microsoft cobrem a regressão recém-corrigida.
 */
const BATERIA: Caso[] = [
  // ── Microsoft: o que estava quebrado ──────────────────────────────────────
  { grupo: "Microsoft", pergunta: "envie um e-mail para o joão avisando da reunião", espera: "ms_email_enviar" },
  { grupo: "Microsoft", pergunta: "quais e-mails eu recebi hoje?", espera: "ms_email_recentes" },
  { grupo: "Microsoft", pergunta: "o que eu tenho na agenda amanhã?", espera: "ms_agenda_periodo" },
  { grupo: "Microsoft", pergunta: "marca uma reunião com a equipe na sexta às 10h", espera: "ms_evento_criar" },
  { grupo: "Microsoft", pergunta: "cancela o compromisso de amanhã de manhã", espera: "ms_evento_excluir" },
  { grupo: "Microsoft", pergunta: "adia a reunião de segunda para quarta", espera: "ms_evento_editar" },
  { grupo: "Microsoft", pergunta: "aceita o convite da reunião de alinhamento", espera: "ms_convite_responder" },
  { grupo: "Microsoft", pergunta: "acha a planilha de orçamento na nuvem", espera: "ms_arquivo_buscar" },
  { grupo: "Microsoft", pergunta: "quais arquivos eu mexi recentemente?", espera: "ms_arquivos_recentes" },
  { grupo: "Microsoft", pergunta: "gera um link de compartilhamento desse documento", espera: "ms_arquivo_compartilhar" },

  // ── RH: perguntas reais, para provar que nada regrediu ────────────────────
  { grupo: "RH", pergunta: "quais são os meus dados cadastrais?", espera: "meus_dados" },
  { grupo: "RH", pergunta: "quais empresas existem no sistema?", espera: "estrutura_empresas" },
  { grupo: "RH", pergunta: "lista as filiais da empresa", espera: "estrutura_filiais" },
];

const arg = (nome: string, padrao: string) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : padrao;
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local.");
    process.exit(1);
  }
  const baseCode = arg("base", "natcorp");
  const topN = Number(arg("top", "8"));
  const db = createClient<Database>(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

  // Catálogo da base: o mesmo recorte que o chat enxerga (ativas + habilitadas).
  const { data: base } = await db.from("ai_bases").select("id").ilike("base_code", baseCode).eq("active", true).maybeSingle();
  if (!base) {
    console.error(`Base "${baseCode}" não encontrada ou inativa.`);
    process.exit(1);
  }
  const { data: vinculos } = await db
    .from("ai_base_tools")
    .select("tool:ai_tools(key, name, description, search_terms, always_include, active)")
    .eq("base_id", base.id)
    .eq("enabled", true);
  type T = { key: string; name: string; description: string | null; search_terms: string | null; always_include: boolean | null; active: boolean };
  const tools = (vinculos ?? [])
    .map((r) => (r as { tool: T | null }).tool)
    .filter((t): t is T => !!t && t.active)
    .map((t) => ({
      key: t.key,
      name: t.name,
      description: t.description ?? "",
      searchTerms: t.search_terms ?? "",
      alwaysInclude: t.always_include === true,
    }));

  console.log(`\nBase: ${baseCode} | ferramentas habilitadas: ${tools.length} | teto do top-K: 12\n`);

  let passou = 0;
  const falhas: { caso: Caso; posicao: number; sim: number }[] = [];

  for (const caso of BATERIA) {
    const sim = await simTools(db, baseCode, caso.pergunta);
    if (sim.size === 0) {
      console.log(`✗ [${caso.grupo}] "${caso.pergunta}"\n    embedding falhou ou catálogo vazio — sem julgamento`);
      continue;
    }
    const escolhidas = selecionarTopK(tools, caso.pergunta, 12, undefined, sim);
    const ranking = [...sim.entries()].sort((a, b) => b[1] - a[1]);
    const posicao = ranking.findIndex(([k]) => k === caso.espera) + 1;
    const simEsperada = sim.get(caso.espera) ?? 0;
    const ok = escolhidas.has(caso.espera);

    if (ok) passou++;
    else falhas.push({ caso, posicao, sim: simEsperada });

    console.log(`${ok ? "✓" : "✗"} [${caso.grupo}] "${caso.pergunta}"`);
    console.log(
      `    esperada: ${caso.espera} → ${ok ? "SELECIONADA" : "FORA"} ` +
        `(similaridade ${simEsperada.toFixed(3)}, ${posicao > 0 ? `${posicao}º no ranking` : "ausente do catálogo"})`,
    );
    console.log(
      `    top ${topN}: ${ranking.slice(0, topN).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(" · ")}`,
    );
    console.log(`    selecionadas (${escolhidas.size}): ${[...escolhidas].join(", ")}\n`);
  }

  console.log("─".repeat(72));
  console.log(`RESULTADO: ${passou}/${BATERIA.length} casos com a ferramenta esperada selecionada.`);
  if (falhas.length) {
    console.log("\nFALHAS:");
    for (const f of falhas) {
      console.log(
        `  ${f.caso.espera.padEnd(28)} sim=${f.sim.toFixed(3)} ` +
          `${f.posicao > 0 ? `(${f.posicao}º)` : "(fora do catálogo — falta embedding?)"} ← "${f.caso.pergunta}"`,
      );
    }
  }
  process.exit(falhas.length ? 1 : 0);
}

void main();
