import type { MdRun } from "./markdown";

/**
 * QUEBRAR RUNS DE MARKDOWN EM PALAVRAS SEM INVENTAR ESPAÇO.
 *
 * O desenho de texto do PDF não tem layout de parágrafo: ele posiciona palavra
 * por palavra e soma a largura de um espaço entre elas. Para isso precisa de
 * tokens — e a versão anterior fazia `runs.flatMap(r => r.text.split(/\s+/))`,
 * que joga fora justamente a informação que importa nas fronteiras.
 *
 * `**1.284 colaboradores**, 3,1% acima` vira dois runs: `1.284 colaboradores`
 * (negrito) e `, 3,1% acima` (normal). Tokenizados em separado e recolados com
 * espaço, saem como **"colaboradores ,"** — com o espaço antes da vírgula. Isso
 * aparecia em todo negrito seguido de pontuação, que em texto de relatório é
 * quase todo negrito.
 *
 * A correção é carregar um bit por token: ele COLA no anterior? Cola quando é o
 * primeiro do seu run e o run anterior terminou sem espaço em branco.
 *
 * Puro e sem `server-only`: é o que permite testá-lo sem abrir um PDF.
 */

export type Token = {
  texto: string;
  negrito: boolean;
  /** Segue o token anterior sem espaço (pontuação após negrito, parêntese, etc.). */
  colado: boolean;
};

export function tokenizarRuns(runs: readonly MdRun[]): Token[] {
  const out: Token[] = [];
  let anteriorTerminaColado = false;

  for (const r of runs ?? []) {
    const txt = String(r?.text ?? "");
    if (!txt) continue;
    const negrito = !!r?.bold;

    // Duas bordas, e as duas contam. Só cola quem começa sem espaço DEPOIS de
    // alguém que terminou sem espaço — os dois testes que falharam na primeira
    // versão eram exatamente isto: `" subiu"` abrindo com espaço, e um run de
    // puro espaço no meio.
    const colaNoAnterior = anteriorTerminaColado && !/^\s/.test(txt);
    let primeiroDoRun = true;

    for (const p of txt.split(/\s+/)) {
      if (!p) continue;
      out.push({ texto: p, negrito, colado: primeiroDoRun && colaNoAnterior });
      primeiroDoRun = false;
    }

    // Run de puro espaço SEPARA: o próximo não cola em nada.
    anteriorTerminaColado = txt.trim() ? !/\s$/.test(txt) : false;
  }
  return out;
}
