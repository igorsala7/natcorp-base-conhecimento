import type { ProposalNode } from "./proposal";

/**
 * O QUE VAI SER CRIADO — antes de criar.
 *
 * "Criar na documentação" materializava direto: sem resumo, sem confirmação, e
 * sem volta. Depois disso o botão vira "Já criada" e o seletor de destino fica
 * desabilitado — caminho de mão única sobre uma árvore que a IA montou.
 *
 * O contraste dentro do próprio produto era gritante: o editor de blocos põe um
 * modal antes/depois em CADA proposta de IA, e o Estúdio, que gera muito mais
 * conteúdo de uma vez, não tinha portão nenhum.
 *
 * ── O que o resumo precisa dizer ────────────────────────────────────────────
 * Contagem de pasta e artigo responde "quanto"; o alerta de artigo VAZIO
 * responde a pergunta que ninguém faz e todos deveriam: quantos desses artigos
 * a IA nomeou mas não escreveu. Materializar um esqueleto de trinta títulos sem
 * corpo é o erro mais fácil de cometer aqui — a árvore parece pronta na
 * proposta, e só depois de criada se descobre que está oca.
 *
 * Puro e sem IO.
 */

export type ResumoProposta = {
  pastas: number;
  artigos: number;
  /** Artigos sem corpo — nomeados, não escritos. */
  vazios: number;
  /** Profundidade máxima, para dar noção da forma sem desenhar a árvore. */
  niveis: number;
  /** Os primeiros títulos, na ordem em que aparecem. */
  amostra: string[];
};

export function resumirProposta(nos: ProposalNode[]): ResumoProposta {
  const r: ResumoProposta = { pastas: 0, artigos: 0, vazios: 0, niveis: 0, amostra: [] };

  const anda = (lista: ProposalNode[], nivel: number) => {
    if (lista.length > 0) r.niveis = Math.max(r.niveis, nivel);
    for (const n of lista) {
      if (n.tipo === "folder") r.pastas++;
      else {
        r.artigos++;
        if (vazio(n)) r.vazios++;
      }
      if (r.amostra.length < 8) r.amostra.push(`${"  ".repeat(nivel - 1)}${n.titulo}`);
      anda(n.children ?? [], nivel + 1);
    }
  };
  anda(nos, 1);
  return r;
}

/**
 * Artigo sem corpo.
 *
 * Não basta `doc == null`: a IA às vezes devolve um documento com blocos vazios
 * — um parágrafo sem texto conta como bloco e faria o artigo passar por
 * escrito. Olha o texto de verdade.
 */
function vazio(n: ProposalNode): boolean {
  const blocos = (n.doc as { blocks?: { text?: string }[] } | null)?.blocks;
  if (!Array.isArray(blocos) || blocos.length === 0) return true;
  return blocos.every((b) => !String(b?.text ?? "").trim());
}
