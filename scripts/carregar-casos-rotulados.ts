/**
 * CARREGA O GABARITO EM `ai_tool_casos` — o substrato de treinamento que a
 * migration de 17/08 criou e que nunca foi preenchido.
 *
 * `eval/cenarios.jsonl` guarda 138 decisões do DONO sobre qual ferramenta era a
 * certa, com o raciocínio escrito à mão. Até aqui isso servia só de régua: nada
 * em `src/` lê o arquivo. `ai_tool_casos` é exatamente o formato dessas
 * decisões — pergunta, painel, tela, o que foi oferecido, o que o agente
 * escolheu, o que estava certo e por quê.
 *
 * ── O QUE ENTRA E O QUE FICA DE FORA, E POR QUÊ ────────────────────────────
 * O caso tem duas metades de naturezas diferentes:
 *
 *   O QUE O AGENTE FEZ  (`foi_tools`, `ofertadas`) é retrato do dia do trace.
 *     Medido: 106 dos 138 registros têm mais de 5 dias, 22 têm mais de 15. O
 *     funil mudou várias vezes desde então — carregar isso como "o cardápio de
 *     hoje" repetiria o erro que já custou uma sessão inteira (ver o commit
 *     "As três falhas de funil eram do meu instrumento").
 *
 *   O QUE ESTAVA CERTO  (`espera_tool`, `nota`) NÃO EXPIRA. A regra "afastamento
 *     é fato da linha do tempo" vale hoje e valerá em dezembro.
 *
 * Então a metade humana entra como rótulo, e a metade histórica entra MARCADA
 * como histórica: `oferecidas` e `tool_escolhida` vêm com a data em que foram
 * observadas, para ninguém os ler como estado atual.
 *
 * ── IDEMPOTENTE ────────────────────────────────────────────────────────────
 * Casa por (space_id, pergunta). Rodar de novo atualiza o rótulo em vez de
 * duplicar — a anotação evolui (três casos foram corrigidos em 22/08) e um
 * gabarito com duas verdades para a mesma pergunta é pior que gabarito nenhum.
 *
 *   npx tsx --env-file=.env.local scripts/carregar-casos-rotulados.ts [--seco]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

/** Ferramentas montadas do payload da tela — não passam pelo funil. */
const LOCAIS = new Set([
  "gerar_relatorio", "montar_grafico", "gerar_convite",
  "consultar_registros", "agregar_valores", "estatisticas", "agrupar",
  "calcular", "derivar_coluna", "classificar_faixa", "projetar",
  "destacar_tela", "tutorial_tela", "preencher_campo", "marcar_opcao", "clicar_elemento",
]);

/** O espaço em que as conversas de chat da base vivem (349 de 413 recentes). */
const SPACE = process.env.CASOS_SPACE_ID ?? "a5e69064-8584-4327-9116-726b717ea604";
const BASE = "natcorp";
const SECO = process.argv.includes("--seco");

type Caso = {
  pergunta: string;
  portal: string | null;
  tela: { id?: string; linhas?: number; colunas?: string[] }[];
  ofertadas: string[];
  espera_tool: string | null;
  foi_tools: string[];
  foi_em?: string | null;
  nota?: string;
  revisar?: boolean;
};

/**
 * O veredito do dono, derivado do gabarito.
 *
 * `devia_chamar` é o valor acrescentado em 23/08 (migration
 * 20260823150000_veredito_devia_chamar.sql): 22 dos 138 casos são "a ferramenta
 * certa estava na mesa e o agente respondeu em texto", e nenhum dos cinco
 * valores originais descrevia isso.
 */
export function vereditoDe(c: Caso): string {
  const esperada = c.espera_tool;
  const chamou = c.foi_tools ?? [];
  if (!esperada) return chamou.length ? "nao_devia_chamar" : "certo";
  if (chamou.includes(esperada)) return "certo";
  if (chamou.length) return "tool_errada";
  // Não chamou nada. Se a certa era de TELA, o defeito é não ter olhado a tela;
  // se era de integração, é simplesmente não ter chamado.
  return LOCAIS.has(esperada) ? "devia_usar_tela" : "devia_chamar";
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
  const db = createClient(url, key, { auth: { persistSession: false } });

  const casos: Caso[] = readFileSync("eval/cenarios.jsonl", "utf8")
    .trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as Caso);
  const anotados = casos.filter((c) => !c.revisar);

  const linhas = anotados.map((c) => ({
    space_id: SPACE,
    pergunta: c.pergunta.slice(0, 4000),
    base_code: BASE,
    p_portal: c.portal,
    // A tabela quer o NOME da tela; o gabarito guarda id/linhas/colunas. O que
    // importa para o rótulo é se HAVIA tela e de que tamanho.
    tela: c.tela?.length
      ? c.tela.map((t) => `${t.id ?? "?"}:${t.linhas ?? 0}l`).join(" ").slice(0, 500)
      : null,
    // Sem similaridade: o gabarito só guarda as chaves. Marcado com a data para
    // ninguém confundir com o cardápio de hoje.
    oferecidas: { em: c.foi_em ?? null, chaves: c.ofertadas ?? [], nota: "histórico do trace, sem similaridade" },
    tool_escolhida: (c.foi_tools ?? [])[0] ?? null,
    veredito: vereditoDe(c),
    tool_correta: c.espera_tool,
    observacao: c.nota || null,
    rotulado_em: new Date().toISOString(),
  }));

  const cont: Record<string, number> = {};
  for (const l of linhas) cont[l.veredito] = (cont[l.veredito] ?? 0) + 1;
  console.log(`${casos.length} casos no gabarito · ${anotados.length} anotados\n`);
  for (const [k, n] of Object.entries(cont).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${k}`);
  if (SECO) { console.log("\n--seco: nada foi gravado."); return; }

  // ── IDEMPOTÊNCIA SEM ATROPELAR A PRODUÇÃO ─────────────────────────────────
  //
  // `conversation_id IS NULL` é o que separa o gabarito do runtime, e não é
  // convenção: as 138 linhas deste carregador não têm conversa nenhuma, e o
  // gravador da rota de chat sempre tem (`convId`, route.ts:602). Sem esse
  // filtro o DELETE abaixo apaga turnos REAIS cuja pergunta calhe de ser igual
  // à de um caso do gabarito — e em silêncio, porque a linha impressa conta as
  // perguntas do arquivo, não as linhas levadas junto.
  //
  // Não é hipótese remota. Medido em 1.402 turnos de 20 dias: 574 (41%) repetem
  // exatamente alguma pergunta anterior, e 48 das 138 do gabarito já apareceram
  // de novo, somando 126 turnos — "Olá" 19×, "obrigado" 9×, "Quero ver as
  // marcações de ponto da minha equipe" 8×.
  // Apaga por ID, nunca pelo TEXTO DA PERGUNTA. O filtro `in.()` do PostgREST é
  // uma lista separada por vírgula, e o valor precisa ser escapado — pergunta de
  // usuário tem aspas e vírgulas à vontade. Custou uma duplicata para descobrir:
  // `Mas eu desde o início estou pedindo "Quais", não pedi consolidado` não foi
  // apagada, o insert seguinte a recriou, e o script só percebeu porque a
  // conferência final contava. Um DELETE que casa 137 de 138 e não reclama é o
  // pior formato de defeito. UUID não tem esse problema.
  const alvo = new Set(linhas.map((l) => l.pergunta));
  const { data: existentes, error: erroSel } = await db
    .from("ai_tool_casos").select("id, pergunta")
    .eq("space_id", SPACE).eq("base_code", BASE).is("conversation_id", null);
  if (erroSel) { console.error("falhou ao ler os existentes:", erroSel.message); process.exit(1); }
  const idsRepor = (existentes ?? [])
    .filter((r) => alvo.has((r as { pergunta: string }).pergunta))
    .map((r) => (r as { id: string }).id);
  if (idsRepor.length) {
    const { error } = await db.from("ai_tool_casos").delete().in("id", idsRepor);
    if (error) { console.error("falhou ao limpar os antigos:", error.message); process.exit(1); }
    console.log(`\n${idsRepor.length} já existiam — regravados com o rótulo atual (turnos de produção intactos).`);
  }

  for (let i = 0; i < linhas.length; i += 50) {
    const { error } = await db.from("ai_tool_casos").insert(linhas.slice(i, i + 50));
    if (error) { console.error(`falhou no lote ${i}:`, error.message); process.exit(1); }
  }

  // A conferência mede o GABARITO, não o espaço. Contar o espaço inteiro faria
  // este script abortar na primeira linha gravada pela rota de chat — em 100%
  // das execuções, não só quando houvesse colisão de pergunta.
  const { count } = await db
    .from("ai_tool_casos").select("id", { count: "exact", head: true })
    .eq("space_id", SPACE).eq("base_code", BASE).is("conversation_id", null);
  const { count: deProducao } = await db
    .from("ai_tool_casos").select("id", { count: "exact", head: true })
    .eq("space_id", SPACE).not("conversation_id", "is", null);
  console.log(`\ngravados. gabarito: ${count} casos · vindos da produção: ${deProducao ?? 0} (não tocados).`);
  if ((count ?? 0) !== linhas.length) {
    console.error(`ESPERADO ${linhas.length} do gabarito — confira antes de confiar no conjunto.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
