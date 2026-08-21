/**
 * PLACAR DE RECUPERAÇÃO — o instrumento que faltava.
 *
 * Roda cada pergunta anotada de `eval/rag.jsonl` pelo MESMO caminho do chat
 * (`retrievePublicContext`) e diz, com número, se a fonte que DEVERIA vir vem —
 * e em que posição. Sem isto, mexer em peso de RRF, `p_group_limit` ou chunking
 * é trocar um defeito por outro: já se mediu que essas alavancas MUDAM 95% dos
 * turnos, nunca que MELHORAM algum.
 *
 * ── O que entra no placar, e o que não ──────────────────────────────────────
 * Só caso com fonte esperada. Ficam de fora:
 *   descartado      não é pergunta (confirmação, desabafo, valor de campo)
 *   comportamento   o certo é chamar ferramenta, não recuperar documento
 * Metade do conjunto caiu nessas duas — o que é, por si só, um achado: turnos
 * marcados `motivo: normal` no trace são majoritariamente turnos de AÇÃO.
 *
 * ── Por que @4 é a métrica que decide ───────────────────────────────────────
 * `ragLimit` em produção fica em torno de 4 fontes. Acertar em 7º é acertar
 * fora da janela: o modelo nunca vê. @8 entra só para separar "o ranking errou"
 * de "a fonte não estava no conjunto de jeito nenhum" — que têm consertos
 * diferentes (ranking x indexação/chunking).
 *
 *   npx tsx --env-file=.env.local scripts/eval-rag.ts
 *   npx tsx --env-file=.env.local scripts/eval-rag.ts --k 8 --saida eval/rag.md
 */
import ws from "ws";
if (!globalThis.WebSocket) {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws;
}
import { readFileSync, writeFileSync } from "node:fs";
import { retrievePublicContext } from "../src/lib/ai/rag";

const arg = (nome: string, padrao: string): string => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : padrao;
};
const K = Number(arg("k", "8"));
const JANELA = Number(arg("janela", "4"));
const SAIDA = arg("saida", "");

type Caso = {
  tipo: string;
  pergunta: string;
  space_id: string;
  espera_nos?: string[] | null;
  espera_docs?: string[];
  descartado?: boolean;
  comportamento?: string;
  nota?: string;
};

async function main() {
  const todos = readFileSync("eval/rag.jsonl", "utf8")
    .split("\n").filter(Boolean).map((l) => JSON.parse(l) as Caso);

  const pontuaveis = todos.filter(
    (c) => !c.descartado && ((c.espera_nos ?? []).length > 0 || (c.espera_docs ?? []).length > 0),
  );

  console.log(
    `\n${todos.length} casos anotados · ${pontuaveis.length} pontuáveis ` +
      `(${todos.filter((c) => c.descartado).length} descartados, ` +
      `${todos.length - pontuaveis.length - todos.filter((c) => c.descartado).length} de comportamento)`,
  );
  if (pontuaveis.length < 30) {
    console.log(`⚠ abaixo de 30 casos: serve para achar defeito, NÃO para concluir que uma mudança melhorou.`);
  }

  const linhas: string[] = [];
  let em1 = 0, naJanela = 0, emK = 0, fora = 0;
  let somaReciproco = 0;
  const porTipo = new Map<string, { n: number; janela: number }>();

  for (const c of pontuaveis) {
    const fontes = await retrievePublicContext(c.space_id, c.pergunta, K);
    // "Acertou" = QUALQUER uma das fontes esperadas apareceu. Exigir todas
    // puniria o caso em que o dono listou duas ordens aceitáveis, e exigir a
    // primeira puniria uma escolha entre alternativas equivalentes (a CLT está
    // carregada 3× no espaço, por exemplo).
    const esperados = new Set([...(c.espera_nos ?? []), ...(c.espera_docs ?? [])]);
    const pos = fontes.findIndex((f) => (f.node_id && esperados.has(f.node_id)) || (f.document_id && esperados.has(f.document_id)));

    const t = porTipo.get(c.tipo) ?? { n: 0, janela: 0 };
    t.n++;
    if (pos === 0) em1++;
    if (pos >= 0 && pos < JANELA) { naJanela++; t.janela++; }
    if (pos >= 0) { emK++; somaReciproco += 1 / (pos + 1); } else fora++;
    porTipo.set(c.tipo, t);

    const marca = pos < 0 ? "✗ fora" : pos < JANELA ? `✓ ${pos + 1}º` : `~ ${pos + 1}º`;
    linhas.push(`| ${marca} | ${c.tipo} | ${c.pergunta.slice(0, 62)} |`);
  }

  const n = pontuaveis.length;
  const pct = (x: number) => `${((x / n) * 100).toFixed(0)}%`;
  console.log(`\n── PLACAR ────────────────────────────────────────────────`);
  console.log(`  em 1º ......................... ${em1}/${n}  (${pct(em1)})`);
  console.log(`  dentro da janela (top-${JANELA}) ..... ${naJanela}/${n}  (${pct(naJanela)})   ← a que decide`);
  console.log(`  aparece até ${K}º ................ ${emK}/${n}  (${pct(emK)})`);
  console.log(`  NÃO aparece ................... ${fora}/${n}  (${pct(fora)})   ← ranking não resolve`);
  console.log(`  MRR ........................... ${(somaReciproco / n).toFixed(3)}`);

  console.log(`\n── POR TIPO (dentro da janela) ───────────────────────────`);
  for (const [tipo, t] of porTipo) {
    console.log(`  ${tipo.padEnd(11)} ${t.janela}/${t.n}  ${((t.janela / t.n) * 100).toFixed(0)}%`);
  }

  console.log(`\n── CASO A CASO ───────────────────────────────────────────`);
  for (const l of linhas) console.log("  " + l.replace(/\|/g, "").trim());

  if (SAIDA) {
    const md = [
      `# Placar de recuperação — ${new Date().toISOString().slice(0, 10)}`,
      ``,
      `${n} casos pontuáveis de ${todos.length} anotados.`,
      n < 30 ? `\n> Abaixo de 30: serve para achar defeito, não para concluir ganho.\n` : ``,
      ``,
      `| métrica | resultado |`,
      `|---|---|`,
      `| em 1º | ${em1}/${n} (${pct(em1)}) |`,
      `| dentro da janela (top-${JANELA}) | ${naJanela}/${n} (${pct(naJanela)}) |`,
      `| aparece até ${K}º | ${emK}/${n} (${pct(emK)}) |`,
      `| não aparece | ${fora}/${n} (${pct(fora)}) |`,
      `| MRR | ${(somaReciproco / n).toFixed(3)} |`,
      ``,
      `| posição | tipo | pergunta |`,
      `|---|---|---|`,
      ...linhas,
      ``,
    ].join("\n");
    writeFileSync(SAIDA, md, "utf8");
    console.log(`\nEscrito em ${SAIDA}`);
  }
  console.log("");
}

main().catch((e) => { console.error(e); process.exit(1); });
