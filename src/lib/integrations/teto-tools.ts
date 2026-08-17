/**
 * QUEM FICA QUANDO A LISTA DE FERRAMENTAS NÃO CABE.
 *
 * Puro e testável de propósito: esta função decide o que o modelo VÊ, e o custo
 * de errar aqui é invisível — o agente não falha, ele responde com a ferramenta
 * errada ou com o parâmetro errado, e parece "a IA piorou".
 *
 * Foi o que aconteceu: o Igor pediu "colaboradores que trabalharam hoje em X
 * unidade" e o agente mandou `empresa` e `matrícula` em vez de só a data. O
 * trace mostrou o teto cortando `estrutura_filiais` — a ferramenta que traduz
 * "unidade X" num código.
 *
 * ── As três faixas ──────────────────────────────────────────────────────────
 *  2. FORÇADAS — a pessoa escolheu, ou é a pendência de confirmação.
 *  1. DEPENDÊNCIAS — puxadas porque uma ferramenta JÁ selecionada as cita. Não
 *     são candidatas disputando vaga; são requisito de quem já ganhou. Ordená-las
 *     por similaridade é comparar naturezas diferentes: uma ferramenta de
 *     estrutura tem baixa similaridade POR DEFINIÇÃO — `estrutura_filiais` fala
 *     de filiais, não de "quem trabalhou hoje".
 *  0. o resto, por similaridade.
 */

export type EntradaTeto = {
  candidatas: Iterable<string>;
  forcadas?: Iterable<string>;
  dependencias?: Iterable<string>;
  /** Similaridade com a pergunta, já com o bônus de aprendizado aplicado. */
  similaridade?: ReadonlyMap<string, number>;
  maxTools: number;
  /** Limite absoluto, incluindo a folga das dependências. */
  tetoDuro: number;
};

export type ResultadoTeto = {
  mantidas: string[];
  cortadas: string[];
  /** O teto que valeu de fato (base + folga de dependências, limitado pelo duro). */
  teto: number;
};

export function aplicarTetoTools(e: EntradaTeto): ResultadoTeto {
  const candidatas = [...new Set(e.candidatas)];
  const forcadas = new Set(e.forcadas ?? []);
  const deps = new Set(e.dependencias ?? []);

  /**
   * A folga é do tamanho das dependências.
   *
   * Sem ela as dependências empurrariam para fora justamente as ferramentas que
   * as puxaram — o remédio viraria outra doença. Com folga infinita reabriria o
   * problema que o corte veio resolver (medido antes: "teto de 6" chegando a 27),
   * por isso o `tetoDuro` por cima.
   */
  const teto = Math.max(1, Math.min(e.maxTools + deps.size, e.tetoDuro));
  if (candidatas.length <= teto) return { mantidas: candidatas, cortadas: [], teto };

  const faixa = (k: string) => (forcadas.has(k) ? 2 : deps.has(k) ? 1 : 0);
  const ordenadas = [...candidatas].sort((a, b) => {
    const d = faixa(b) - faixa(a);
    if (d !== 0) return d;
    const s = (e.similaridade?.get(b) ?? 0) - (e.similaridade?.get(a) ?? 0);
    // Empate resolvido pelo NOME, não pela ordem de chegada: seleção que muda
    // entre duas execuções iguais é impossível de depurar por trace.
    return s !== 0 ? s : a.localeCompare(b);
  });
  return { mantidas: ordenadas.slice(0, teto), cortadas: ordenadas.slice(teto), teto };
}
