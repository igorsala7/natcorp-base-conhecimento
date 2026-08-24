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

/**
 * Espaço e base NÃO são constantes: vêm do TRACE de cada caso.
 *
 * A primeira versão fixou `space` e `base_code = "natcorp"` para os 138. Medido
 * depois, casando cada caso com `ai_chat_traces` (138/138 casaram): **18 casos
 * estão em outro espaço** (painel-do-colaborador, painel-do-gestor) e **33 são
 * de outro CLIENTE** — stefanini, incor, leadec, saude, TESTE_FATURA.
 *
 * Isso importa muito além da carga: o gabarito mistura clientes, e cada cliente
 * tem catálogo de ferramentas próprio. Rotular um caso da stefanini como
 * natcorp faz o rótulo apontar para uma ferramenta que talvez nem exista na base
 * dele.
 */
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
  // Não chamou NADA. `devia_usar_tela` significa "a resposta estava na tela
  // aberta e ele não olhou" — então depende de TER HAVIDO TELA, não de a
  // ferramenta ser local.
  //
  // A primeira versão decidia por `LOCAIS.has(esperada)` e marcou 8 casos como
  // `devia_usar_tela` em turnos SEM tela nenhuma — entre eles "Ok, me gere um
  // pdf disso" e "excel", onde não havia o que olhar. Rótulo humano errado é
  // pior que rótulo faltando, porque é justamente o material que a tabela
  // existe para guardar.
  const tinhaTela = (c.tela?.length ?? 0) > 0;
  return LOCAIS.has(esperada) && tinhaTela ? "devia_usar_tela" : "devia_chamar";
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
  const db = createClient(url, key, { auth: { persistSession: false } });

  const casos: Caso[] = readFileSync("eval/cenarios.jsonl", "utf8")
    .trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as Caso);
  const anotados = casos.filter((c) => !c.revisar);

  // ── O TRACE DE CADA CASO ──────────────────────────────────────────────────
  // É de lá que saem espaço, base, perfil, conversa e o id do próprio trace —
  // o elo que permite, depois, recomputar o veredito contra uma rodada nova.
  // Paginado: o PostgREST corta em 1000 sem avisar.
  type Trace = {
    id: string; pergunta: string; space_id: string; base_code: string | null;
    p_perfil: string | null; p_portal: string | null; conversation_id: string | null; created_at: string;
  };
  const traces: Trace[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db
      .from("ai_chat_traces")
      .select("id, pergunta, space_id, base_code, p_perfil, p_portal, conversation_id, created_at")
      .range(de, de + 999);
    if (error) { console.error("falhou ao ler os traces:", error.message); process.exit(1); }
    traces.push(...((data ?? []) as unknown as Trace[]));
    if (!data || data.length < 1000) break;
  }

  /** O trace do caso: mesma pergunta e, quando houver, mesmo instante. */
  const traceDe = (c: Caso): Trace | null => {
    const iguais = traces.filter((t) => t.pergunta === c.pergunta);
    if (!iguais.length) return null;
    if (!c.foi_em) return iguais[0]!;
    const alvo = new Date(c.foi_em).getTime();
    return iguais.find((t) => Math.abs(new Date(t.created_at).getTime() - alvo) < 3000) ?? iguais[0]!;
  };

  const orfaos: string[] = [];
  const linhas = anotados.map((c) => {
    const t = traceDe(c);
    if (!t) orfaos.push(c.pergunta.slice(0, 46));
    return {
      // Sem trace não há espaço, e `space_id` é NOT NULL. Cai no espaço do chat.
      space_id: t?.space_id ?? "a5e69064-8584-4327-9116-726b717ea604",
      pergunta: c.pergunta.slice(0, 4000),
      // Minúsculas: o mesmo cliente aparece como "natcorp" e "NATCORP" nos
      // traces, e duas grafias viram dois clientes na hora de agrupar.
      base_code: (t?.base_code ?? "natcorp").trim().toLowerCase(),
      p_perfil: t?.p_perfil ?? null,
      p_portal: c.portal ?? t?.p_portal ?? null,
      conversation_id: t?.conversation_id ?? null,
      trace_id: t?.id ?? null,
      // A tabela quer o NOME da tela; o gabarito guarda id/linhas/colunas. O que
      // importa para o rótulo é se HAVIA tela e de que tamanho.
      tela: c.tela?.length
        ? c.tela.map((x) => `${x.id ?? "?"}:${x.linhas ?? 0}l`).join(" ").slice(0, 500)
        : null,
      // ARRAY, como a coluna declara (`default '[]'::jsonb`). A primeira versão
      // gravou um objeto aqui — funciona em jsonb e quebra quem for ler.
      //
      // ── `sim: null` AQUI É PERMANENTE, E NÃO É PENDÊNCIA ──────────────────
      // A captura de runtime passou a gravar nota e posição (24/08,
      // `caso-treino.ts` lendo `integracoes:ranking`). Estes 138 são de ANTES:
      // o ranking não existia quando aconteceram, e não está nos traces.
      //
      // Recomputar agora é tentador — `eval-tools.ts` faz isso e imprime "ficou
      // em 23º de 88". A diferença é o que cada número AFIRMA: no eval a
      // pergunta é "como o funil de HOJE se sai?", e recomputar é o método
      // certo. Aqui a linha afirma "foi isto que aconteceu naquele turno" — e
      // 106 dos 138 têm mais de 5 dias, 22 mais de 15, com catálogo, embeddings
      // e ontologia mudados no meio. Nota de hoje colada em caso de 15 dias
      // atrás é hindsight com cara de registro.
      //
      // A data (`em`) vai junto justamente como aviso: isto é história, não
      // cardápio de hoje.
      oferecidas: (c.ofertadas ?? []).map((k) => ({ tool: k, sim: null, em: c.foi_em ?? null })),
      tool_escolhida: (c.foi_tools ?? [])[0] ?? null,
      veredito: vereditoDe(c),
      tool_correta: c.espera_tool,
      observacao: c.nota || null,
      origem: "gabarito",
      rotulado_em: new Date().toISOString(),
    };
  });

  const cont: Record<string, number> = {};
  const porBase: Record<string, number> = {};
  for (const l of linhas) {
    cont[l.veredito] = (cont[l.veredito] ?? 0) + 1;
    porBase[l.base_code] = (porBase[l.base_code] ?? 0) + 1;
  }
  console.log(`${casos.length} casos no gabarito · ${anotados.length} anotados · ${traces.length} traces lidos`);
  if (orfaos.length) console.log(`⚠ ${orfaos.length} sem trace (espaço e base no palpite): ${orfaos.slice(0, 3).join(" | ")}`);
  console.log();
  for (const [k, n] of Object.entries(cont).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${k}`);
  console.log(`\n  clientes: ${Object.entries(porBase).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`).join(" · ")}`);
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
  // `origem = 'gabarito'` é o que este script possui. Nada mais é tocado — e é
  // por isso que a coluna existe: `conversation_id is null` não serve mais de
  // bandeira porque agora as linhas do gabarito TÊM conversa (é o elo que
  // permite recomputar o veredito depois), e `rotulado_em` também não, porque um
  // caso capturado e depois rotulado por gente teria os dois preenchidos.
  const { data: existentes, error: erroSel } = await db
    .from("ai_tool_casos").select("id").eq("origem", "gabarito");
  if (erroSel) { console.error("falhou ao ler os existentes:", erroSel.message); process.exit(1); }
  const ids = (existentes ?? []).map((r) => (r as { id: string }).id);
  if (ids.length) {
    // Apaga por ID, nunca pelo TEXTO. O filtro `in.()` do PostgREST é lista
    // separada por vírgula e o valor precisa ser escapado — pergunta de usuário
    // tem aspas e vírgulas. Custou uma duplicata para descobrir: `Mas eu desde o
    // início estou pedindo "Quais", não pedi consolidado` não era apagada, o
    // insert seguinte a recriava, e o script só percebeu porque conferia a conta.
    for (let i = 0; i < ids.length; i += 100) {
      const { error } = await db.from("ai_tool_casos").delete().in("id", ids.slice(i, i + 100));
      if (error) { console.error("falhou ao limpar os antigos:", error.message); process.exit(1); }
    }
    console.log(`\n${ids.length} do gabarito regravados com o rótulo atual (capturas de produção intactas).`);
  }

  for (let i = 0; i < linhas.length; i += 50) {
    const { error } = await db.from("ai_tool_casos").insert(linhas.slice(i, i + 50));
    if (error) { console.error(`falhou no lote ${i}:`, error.message); process.exit(1); }
  }

  // A conferência mede o GABARITO, não a tabela. Contar tudo faria este script
  // abortar na primeira linha gravada pela rota de chat — em 100% das execuções.
  const { count } = await db
    .from("ai_tool_casos").select("id", { count: "exact", head: true }).eq("origem", "gabarito");
  const { count: deRuntime } = await db
    .from("ai_tool_casos").select("id", { count: "exact", head: true }).eq("origem", "runtime");
  console.log(`\ngravados. gabarito: ${count} casos · capturados em produção: ${deRuntime ?? 0} (não tocados).`);
  if ((count ?? 0) !== linhas.length) {
    console.error(`ESPERADO ${linhas.length} do gabarito — confira antes de confiar no conjunto.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
