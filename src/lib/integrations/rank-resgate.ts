/**
 * Regra do RESGATE pela ontologia — a decisão isolada, para poder ser testada.
 *
 * A expansão da consulta com os sinônimos do cliente existe para um caso: o
 * usuário diz "holerite" e a ferramenta se chama "eventos financeiros". Fora
 * dele, ela faz mal — e o mal foi medido no catálogo real:
 *
 *   "Quero meu histórico financeiro do mês de 05/2025"
 *     pergunta crua   → historico_financeiro 0.698 > relatorio_recibo 0.691  ✓
 *     + ontologia      → relatorio_recibo 0.796 > historico_financeiro 0.744  ✗
 *
 * Duas das seis formas coladas ("holerite", "recibo de salario") são os
 * sinônimos cadastrados de uma ferramenta IRMÃ. A expansão injeta a identidade
 * de uma na pergunta da outra, e ainda dilui: a frase do usuário vira 1 linha
 * entre 7 e perde de 6 a 1 para palavras que ele não escreveu.
 *
 * Daí a regra: quem manda é o que o usuário escreveu. A ontologia só entra
 * quando a pergunta crua não achou ninguém.
 */

export type ComSim = { sim: number };

/**
 * Qual ranking usar. Aditivo por construção: a ontologia só ACRESCENTA quando
 * não havia candidata; nunca reordena as que a pergunta já encontrou.
 */
export function escolherRanking<T extends ComSim>(
  pura: T[],
  expandida: T[],
): { matches: T[]; viaOntologia: boolean } {
  if (pura.length > 0) return { matches: pura, viaOntologia: false };
  return { matches: expandida, viaOntologia: expandida.length > 0 };
}
