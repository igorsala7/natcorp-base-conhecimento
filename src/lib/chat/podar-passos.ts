/**
 * PODA DOS PASSOS ANTERIORES do laço agêntico.
 *
 * O AI SDK reenvia, a cada passo, `tools + system + histórico + TODOS os
 * resultados de ferramenta acumulados`. Medido em 20 dias de produção, por
 * chamada ao modelo na finalidade `chat_ferramentas`:
 *
 *   entrada total          44.601 tokens
 *   − bloco de ferramentas  ~7.779  (17%)
 *   − prompt de sistema     ~3.319  (7%)
 *   = histórico + resultados ~33.503 (75%)
 *
 * E o histórico não é o culpado: `limitarHistorico` o trava em 24.000
 * caracteres e a média real das últimas 20 mensagens é 4.535 (~1.100 tokens).
 * O que resta é resultado de ferramenta, reenviado inteiro em cada passo — com
 * a amostra no teto de 60.000 caracteres (p90 medido: 61.268 bytes), um único
 * retorno viaja ~15.000 tokens por passo.
 *
 * ── O que NÃO se perde ──────────────────────────────────────────────────────
 * O dado continua ÍNTEGRO no servidor: `datasets.ts` guarda 100% das linhas e as
 * 8 ferramentas de consulta operam sobre elas. O modelo perde a amostra CRUA de
 * passos antigos, não a capacidade de consultar — e o resumo diz exatamente qual
 * identificador usar.
 *
 * ── Por que o ÚLTIMO resultado fica intacto ────────────────────────────────
 * É dele que o modelo está redigindo. Podar o resultado recém-chegado seria
 * tirar a resposta da mão de quem está escrevendo — o risco que o plano
 * levantou ("se o modelo estiver usando a amostra antiga para redigir, encolher
 * piora"). Poda-se o que já foi lido e consumido; nunca a última leitura.
 */

/** Teto do que sobra de um retorno podado — o bastante para o modelo se orientar. */
const MAX_CHARS_PODADO = 400;

type ParteMsg = { type?: string; output?: { type?: string; value?: unknown } | unknown; toolName?: string };
type Msg = { role?: string; content?: unknown };

/** Resumo de um retorno já consumido: o que ele era, e como voltar aos dados. */
export function resumirRetorno(valor: unknown): Record<string, unknown> {
  const v = valor as Record<string, unknown> | null;
  if (!v || typeof v !== "object") {
    const txt = String(valor ?? "");
    return txt.length > MAX_CHARS_PODADO ? { _resumo: txt.slice(0, MAX_CHARS_PODADO) + "…" } : { _resumo: txt };
  }
  const fora: Record<string, unknown> = { _podado: true };
  // Os campos que permitem CONTINUAR trabalhando sobrevivem à poda.
  for (const k of ["_dataset", "_total", "_completo", "_colunas", "_erro", "_perguntar"]) {
    if (v[k] !== undefined) fora[k] = v[k];
  }
  if (fora._dataset) {
    fora._nota =
      `Amostra removida para economizar contexto — ela JÁ foi lida por você. Os dados seguem ` +
      `íntegros no servidor: use as ferramentas de consulta com dados_de="${String(fora._dataset)}".`;
  } else {
    const txt = JSON.stringify(v);
    fora._resumo = txt.length > MAX_CHARS_PODADO ? txt.slice(0, MAX_CHARS_PODADO) + "…" : txt;
  }
  return fora;
}

/**
 * Substitui, nas mensagens do passo, os retornos de ferramenta JÁ CONSUMIDOS por
 * um resumo — preservando intactos os `manter` mais recentes.
 *
 * Puro: devolve estruturas novas e não toca na entrada. Mensagens que não são de
 * ferramenta passam sem alteração.
 */
export function podarPassosAnteriores<T extends Msg>(messages: readonly T[], manter = 1): T[] {
  // Índices (mensagem, parte) de todos os retornos, na ordem em que chegaram.
  const alvos: { i: number; j: number }[] = [];
  messages.forEach((m, i) => {
    if (m?.role !== "tool" || !Array.isArray(m.content)) return;
    (m.content as ParteMsg[]).forEach((p, j) => {
      if (p?.type === "tool-result") alvos.push({ i, j });
    });
  });
  if (alvos.length <= manter) return messages as T[];

  const podar = new Set(alvos.slice(0, alvos.length - manter).map(({ i, j }) => `${i}:${j}`));
  return messages.map((m, i) => {
    if (m?.role !== "tool" || !Array.isArray(m.content)) return m;
    let mudou = false;
    const content = (m.content as ParteMsg[]).map((p, j) => {
      if (!podar.has(`${i}:${j}`) || p?.type !== "tool-result") return p;
      const out = p.output as { type?: string; value?: unknown } | undefined;
      // Só retornos JSON são podados: `text`/`content` podem carregar o que o
      // provedor precisa reproduzir literalmente (imagem, arquivo).
      if (out?.type !== "json") return p;
      mudou = true;
      return { ...p, output: { type: "json", value: resumirRetorno(out.value) } };
    });
    return mudou ? ({ ...m, content } as T) : m;
  });
}

/** Quantos caracteres a poda economizaria — para o trace, sem alterar nada. */
export function economiaDaPoda(antes: readonly unknown[], depois: readonly unknown[]): number {
  return JSON.stringify(antes).length - JSON.stringify(depois).length;
}
