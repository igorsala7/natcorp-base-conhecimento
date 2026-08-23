/**
 * CAPTURA DE CASO PARA ROTULAR — o lado que faltava do aprendizado.
 *
 * O sinal que o funil usa hoje (`ai_tool_uso`, via `vizinhosDeUso`) grava
 * `ok: true` FIXO (tool-catalog.ts) e o RPC filtra por `where u.ok` — um filtro
 * que nunca exclui nada. São ~211 registros de "foi chamada" tratados como 211
 * acertos. Quando o agente escolhe a ferramenta errada, isso vira exemplo
 * POSITIVO para a próxima pergunta parecida: o laço reforça o próprio erro.
 *
 * A migration de 17/08 já tinha dito isso, palavra por palavra, e criado
 * `ai_tool_casos` para o material de outra natureza — o rótulo humano, que é
 * "caro, raro e confiável" contra um sinal "barato, abundante e ambíguo". A
 * tabela ficou pronta e nunca foi ligada. Este arquivo é a ligação.
 *
 * ── O QUE ESTE ARQUIVO NÃO FAZ ─────────────────────────────────────────────
 * Não muda ranqueamento nenhum. É a ordem que a própria migration fixou:
 * "primeiro acumular casos e medir; só depois deixar o rótulo pesar na
 * seleção". O caso entra com `veredito` NULO — quem rotula é gente.
 *
 * ── POR QUE NÃO COPIAR `registrarUsoTool` ─────────────────────────────────
 * Ele engole o erro em silêncio (`catch { /* silencioso de propósito *\/ }`).
 * Para tabela nova isso é o padrão errado, e o projeto já pagou por isso:
 * route.ts documenta um `.insert()` com coluna inexistente que devolveu
 * PGRST204 SEM LANÇAR e derrubou a gravação de toda resposta do assistente por
 * um dia. `.insert()` do PostgREST devolve `{ error }`; um `try/catch` sozinho
 * não vê. Aqui se confere o retorno E se captura a exceção.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import type { TracePasso } from "./trace";
import { sinalDoTurnoSeguinte } from "./correcao";

/**
 * LIGADA POR ESCOLHA, não por padrão.
 *
 * A captura escreve uma linha por turno numa tabela cujo consumidor é uma
 * pessoa. Medido: ~47 turnos/dia e ~1 kB cada (~2,2 MB/mês com índices) — o
 * gargalo não é disco, é quem rotula. Ligar sem querer encheria a fila de
 * "Olá" e "obrigado" e afogaria os casos que ensinam.
 */
export function capturaLigada(): boolean {
  return process.env.CASOS_CAPTURA === "1";
}

/** Amostragem, para quando a fila humana for menor que o tráfego. 100 = tudo. */
function amostraPct(): number {
  const n = Number(process.env.CASOS_CAPTURA_PCT ?? "100");
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 100;
}

export type CasoDoTurno = {
  spaceId: string;
  pergunta: string;
  baseCode?: string | null;
  perfil?: string | null;
  portal?: string | null;
  conversationId?: string | null;
  /** Id gerado no servidor e usado TAMBÉM no insert do trace — é o elo. */
  traceId?: string | null;
  /** Os passos do turno; daqui saem tela, ferramentas oferecidas e chamadas. */
  passos: readonly TracePasso[];
};

/** Ferramentas montadas do payload da tela — não vêm do catálogo da base. */
const LOCAIS = new Set([
  "gerar_relatorio", "montar_grafico", "gerar_convite",
  "consultar_registros", "agregar_valores", "estatisticas", "agrupar",
  "calcular", "derivar_coluna", "classificar_faixa", "projetar",
  "destacar_tela", "tutorial_tela", "preencher_campo", "marcar_opcao", "clicar_elemento",
]);

const infoDo = (passos: readonly TracePasso[], nome: string): Record<string, unknown> | null =>
  (passos.find((p) => p?.passo === nome)?.info as Record<string, unknown> | undefined) ?? null;
const todosDo = (passos: readonly TracePasso[], nome: string): Record<string, unknown>[] =>
  passos.filter((p) => p?.passo === nome).map((p) => (p?.info ?? {}) as Record<string, unknown>);

/**
 * O turno tem alguma DECISÃO de ferramenta para rotular?
 *
 * Turno sem ferramenta de integração na mesa não ensina nada sobre seleção — o
 * agente não tinha o que escolher. Deixá-lo entrar encheria a fila humana de
 * saudação: medido, 574 de 1.402 turnos (41%) repetem uma pergunta anterior, e
 * "Olá" sozinho aparece 19 vezes em 20 dias.
 *
 * O que ENTRA, e é justamente o caso mais valioso: turno com ferramenta na mesa
 * e NENHUMA chamada. É o veredito `devia_chamar`, o maior grupo de erro do
 * gabarito (30 de 138) — e um filtro por "chamou alguma coisa" o perderia
 * inteiro.
 */
export function temDecisaoParaRotular(passos: readonly TracePasso[]): boolean {
  const ofertadas = (infoDo(passos, "ferramentas")?.tools as string[] | undefined) ?? [];
  return ofertadas.some((k) => !LOCAIS.has(k));
}

/** Monta a linha a partir dos passos. Puro — testável sem banco. */
export function linhaDoCaso(c: CasoDoTurno): Record<string, unknown> {
  const ofertadas = (infoDo(c.passos, "ferramentas")?.tools as string[] | undefined) ?? [];
  const chamadas = todosDo(c.passos, "tool_call")
    .map((i) => String(i?.tool ?? "")).filter(Boolean);
  const tabelas = (infoDo(c.passos, "dataset:registro")?.itens as { id?: string; linhas?: number }[] | undefined) ?? [];
  return {
    space_id: c.spaceId,
    pergunta: String(c.pergunta ?? "").slice(0, 4000),
    base_code: (c.baseCode ?? "").trim().toLowerCase() || null,
    p_perfil: c.perfil ?? null,
    p_portal: c.portal ?? null,
    tela: tabelas.length ? tabelas.map((t) => `${t.id ?? "?"}:${t.linhas ?? 0}l`).join(" ").slice(0, 500) : null,
    // Array, como a coluna declara. Sem similaridade: ela morre dentro do
    // tool-builder e não sai nos passos — quando sair, entra aqui.
    oferecidas: ofertadas.map((k) => ({ tool: k })) as unknown as Json,
    tool_escolhida: chamadas[0] ?? null,
    // Todas as chamadas, porque um turno chama várias e a coluna é singular.
    parametros: (chamadas.length > 1 ? { todas_as_chamadas: chamadas } : null) as unknown as Json,
    // `curl` fica FORA de propósito: ele recoloca matrícula e empresa, que o
    // esquema desta tabela deliberadamente não guarda. Quem for rotular lê do
    // trace, que já é restrito.
    conversation_id: c.conversationId ?? null,
    trace_id: c.traceId ?? null,
    origem: "runtime",
    // NULO: quem rotula é gente. É a fila de trabalho (índice parcial
    // `where veredito is null` na migration de 17/08).
    veredito: null,
  };
}

/**
 * Grava o caso. Best-effort — nunca derruba o turno, e nunca some em silêncio.
 */
export async function registrarCasoTool(
  supabase: SupabaseClient<Database>,
  c: CasoDoTurno,
): Promise<void> {
  if (!capturaLigada()) return;
  if (!c.spaceId || !String(c.pergunta ?? "").trim()) return;
  // ── O TURNO SEGUINTE JULGA O ANTERIOR ─────────────────────────────────────
  // Antes de gravar o caso de agora: se ESTA mensagem corrige o agente, quem
  // errou foi o turno passado. Marca o caso anterior desta conversa.
  //
  // Roda mesmo quando o turno atual NÃO vira caso (o filtro abaixo pode barrá-lo):
  // "Você não fez o word" pode não ter ferramenta de integração na mesa e ainda
  // assim ser a prova de que o turno anterior falhou.
  const sinal = sinalDoTurnoSeguinte(c.pergunta, !!c.conversationId);
  if (sinal && c.conversationId) {
    try {
      const { data: anterior } = await supabase
        .from("ai_tool_casos")
        .select("id")
        .eq("conversation_id", c.conversationId)
        .is("sinal_seguinte", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (anterior?.id) {
        const { error } = await supabase
          .from("ai_tool_casos")
          .update({ sinal_seguinte: sinal } as never)
          .eq("id", (anterior as { id: string }).id);
        if (error) console.error("[ai_tool_casos] sinal recusado:", error.message);
      }
    } catch (e) {
      console.error("[ai_tool_casos] falha ao marcar o anterior:", e instanceof Error ? e.message : e);
    }
  }

  if (!temDecisaoParaRotular(c.passos)) return;
  // Amostragem por sorteio: o turno é a unidade, e não há estado entre turnos
  // para amostrar de outro jeito.
  if (amostraPct() < 100 && Math.random() * 100 >= amostraPct()) return;
  try {
    const { error } = await supabase
      .from("ai_tool_casos")
      .insert(linhaDoCaso(c) as never);
    // O PostgREST devolve `{ error }` sem lançar — um try/catch sozinho não vê,
    // e foi assim que a gravação de respostas sumiu por um dia inteiro.
    if (error) console.error("[ai_tool_casos] recusado:", error.message);
  } catch (e) {
    console.error("[ai_tool_casos] falha ao gravar:", e instanceof Error ? e.message : e);
  }
}
