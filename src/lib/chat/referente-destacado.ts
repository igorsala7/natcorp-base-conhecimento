/**
 * "ME TRAGA O CARGO DELES" — quem são "eles".
 *
 * Regra que o Igor deu em 17/08:
 *
 * > Se a resposta anterior trouxe uma listagem e o agente DESTACOU um ou mais
 * > registros, um pronome sem sujeito ("dele", "desses", "aquele") se refere aos
 * > DESTACADOS. Se o usuário quiser outros, ele diz quem.
 *
 * ── Por que isto não é o mesmo que `subject-clarify` ────────────────────────
 * O `subject-clarify.ts` detecta a anáfora e PERGUNTA qual é o referente, com
 * botões. Está certo quando o contexto tem várias candidatas igualmente
 * plausíveis — mas quando o próprio agente acabou de destacar três linhas,
 * perguntar é burocracia: ele já disse de quem estava falando, e a pergunta faz
 * o usuário repetir o que a tela mostra.
 *
 * O destaque não é inferido de prosa: `destacar_tela` grava
 * `linhas: [{coluna, valor}]`, uma afirmação estruturada de QUAIS registros. Ter
 * o dado explícito é o que permite resolver em vez de perguntar.
 *
 * ── E por que não deixar o modelo resolver sozinho ─────────────────────────
 * Ele erra justamente onde custa: numa lista de 40 pessoas com 3 destacadas, um
 * "cargo deles" pode virar consulta das 40 — e a resposta sai plausível, com os
 * dados errados, sem nada sinalizando. Resolver no servidor torna o vínculo
 * verificável no trace.
 *
 * Puro e sem `server-only`: é o que permite testar a regra sem subir chat.
 */

/** O que `destacar_tela` gravou: casar `coluna` contendo `valor`. */
export type LinhaDestacada = { coluna: string; valor: string };

/**
 * Marcadores de referência a algo JÁ mencionado.
 *
 * A lista veio do Igor e cobre as três famílias: pronome oblíquo (dele, dela),
 * demonstrativo (esse, aquela) e neutro (isso, disso, aquilo). O neutro importa
 * porque "me explica isso" depois de um destaque é a mesma situação — só que o
 * referente não é pessoa.
 *
 * `\b` nas bordas para "dela" não casar dentro de "candela"; e a busca é sobre
 * o texto SEM acento, senão "aquele" pega e "aquilo" com til escapa conforme a
 * digitação.
 */
const RX_REFERENCIA = new RegExp(
  "\\b(" +
    "dele|dela|deles|delas|nele|nela|neles|nelas|lhe|lhes|" +
    "esse|essa|esses|essas|este|esta|estes|estas|" +
    "desse|dessa|desses|dessas|deste|desta|destes|destas|" +
    "nesse|nessa|nesses|nessas|neste|nesta|" +
    "aquele|aquela|aqueles|aquelas|daquele|daquela|daqueles|daquelas|" +
    "isso|disso|nisso|isto|disto|aquilo|daquilo" +
    ")\\b",
  "i",
);

const semAcento = (v: string) =>
  String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** A mensagem aponta para algo já dito, sem nomear? */
export function temReferencia(mensagem: string): boolean {
  return RX_REFERENCIA.test(semAcento(mensagem));
}

/**
 * A mensagem NOMEIA um alvo próprio?
 *
 * "o cargo do João" e "a matrícula 4821" trazem o sujeito — e aí o destaque
 * anterior não manda, porque o usuário está trocando de assunto de propósito. É
 * a segunda metade da regra do Igor: "caso contrário o usuário vai informar de
 * quem ele quer buscar".
 *
 * Sinais: matrícula (4+ dígitos) ou nome próprio (duas palavras capitalizadas
 * seguidas, o que evita casar início de frase). Deliberadamente conservador —
 * na dúvida, o destaque continua valendo, que é o comportamento que o Igor
 * descreveu como o normal.
 */
export function nomeiaAlvoProprio(mensagem: string): boolean {
  const m = String(mensagem ?? "");
  if (/\b\d{4,}\b/.test(m)) return true;
  return /\b[A-ZÀ-Ú][a-zà-ú]{2,}\s+(?:d[aeo]s?\s+)?[A-ZÀ-Ú][a-zà-ú]{2,}/.test(m);
}

export type Referente =
  | { tipo: "destacados"; linhas: LinhaDestacada[]; diretriz: string }
  | { tipo: "nenhum" };

/**
 * Resolve o referente pelos destaques do turno anterior.
 *
 * Devolve `nenhum` — e não um palpite — quando falta qualquer das condições. É o
 * que mantém o `subject-clarify` no jogo: sem destaque, continua valendo
 * perguntar.
 */
export function resolverReferente(input: {
  mensagem: string;
  /** O que `destacar_tela` destacou na resposta ANTERIOR. */
  destacadasAntes: readonly LinhaDestacada[] | null | undefined;
}): Referente {
  const linhas = (input.destacadasAntes ?? []).filter((l) => l && l.coluna && l.valor);
  if (linhas.length === 0) return { tipo: "nenhum" };
  if (!temReferencia(input.mensagem)) return { tipo: "nenhum" };
  if (nomeiaAlvoProprio(input.mensagem)) return { tipo: "nenhum" };

  /**
   * A diretriz cita os valores, não "as linhas destacadas".
   *
   * O modelo precisa dos valores para montar a chamada; uma referência abstrata
   * o obrigaria a reencontrá-los no histórico, que é exatamente o passo em que
   * ele erra e passa a consultar a lista inteira.
   */
  const porColuna = new Map<string, string[]>();
  for (const l of linhas) {
    const v = porColuna.get(l.coluna) ?? [];
    if (!v.includes(l.valor)) v.push(l.valor);
    porColuna.set(l.coluna, v);
  }
  const descricao = [...porColuna.entries()].map(([col, vals]) => `${col} = ${vals.join(", ")}`).join(" · ");

  return {
    tipo: "destacados",
    linhas,
    diretriz:
      "REFERENTE: a mensagem usa pronome/demonstrativo sem nomear o alvo, e na resposta ANTERIOR você destacou " +
      `registros específicos. Ela se refere a ESSES, e somente a eles: ${descricao}. ` +
      "Consulte apenas esses registros — NÃO repita a lista inteira e NÃO pergunte de quem se trata.",
  };
}
