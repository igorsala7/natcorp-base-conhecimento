/**
 * APRENDIZADO DE SELEÇÃO — a experiência entra no ranqueamento.
 *
 * A escolha de ferramenta hoje compara o embedding da PERGUNTA com o do
 * CADASTRO. O cadastro é texto que alguém escreveu; a realidade é qual
 * ferramenta resolveu perguntas parecidas. Este módulo junta as duas.
 *
 * Não treina modelo: guarda cada uso bem-sucedido com o vetor da consulta e, na
 * próxima, consulta os k vizinhos. É o mesmo mecanismo do RAG, aplicado a
 * decisões em vez de documentos — e tem uma vantagem que modelo treinado não
 * tem: dá para abrir a tabela e ver POR QUE ele escolheu.
 *
 * ── O que impede a bola de neve ─────────────────────────────────────────────
 * Um ranqueador que aprende do próprio ranqueamento se reforça: a ferramenta que
 * aparece mais é usada mais, e passa a aparecer ainda mais. Três freios:
 *
 *  · grava USO, não OFERTA — a lista oferecida é justamente o que se quer
 *    corrigir, então ensinar com ela seria copiar o erro;
 *  · o bônus é TETO BAIXO (`MAX_BONUS`) e SOMA à similaridade, em vez de
 *    substituí-la: uma ferramenta que o texto reprova não sobe sozinha pelo
 *    histórico;
 *  · exige `MIN_AMOSTRAS` para valer, senão um acerto isolado vira regra.
 */

/** Teto do empurrão. 0,06 na escala de similaridade (0–1) desempata sem mandar. */
export const MAX_BONUS = 0.06;
/** Abaixo disto é anedota, não padrão. */
export const MIN_AMOSTRAS = 3;

export type Vizinho = { tool_key: string; peso: number; amostras: number };

/**
 * Converte os vizinhos em bônus por ferramenta.
 *
 * Normaliza pelo MAIOR peso do próprio turno: o que importa é a ordem relativa
 * entre as candidatas de agora, não o volume absoluto de histórico — senão uma
 * base antiga daria bônus maior que uma nova só por ter mais registro.
 */
export function bonusDeUso(vizinhos: Vizinho[]): Map<string, number> {
  const out = new Map<string, number>();
  const validos = vizinhos.filter((v) => v.amostras >= MIN_AMOSTRAS && v.peso > 0);
  if (validos.length === 0) return out;
  const topo = Math.max(...validos.map((v) => v.peso));
  for (const v of validos) out.set(v.tool_key, (v.peso / topo) * MAX_BONUS);
  return out;
}

/**
 * Aplica o bônus sobre as similaridades do turno.
 *
 * Só mexe em quem JÁ está no mapa: o histórico reordena candidatas, não
 * ressuscita ferramenta que o recorte de assunto ou a permissão excluíram.
 * Deixar o histórico furar esses filtros trocaria uma decisão de segurança por
 * uma estatística.
 */
export function aplicarAprendizado(
  sim: Map<string, number>,
  bonus: Map<string, number>,
): Map<string, number> {
  if (bonus.size === 0) return sim;
  const out = new Map(sim);
  for (const [k, v] of sim) {
    const b = bonus.get(k);
    if (b) out.set(k, Math.min(1, v + b));
  }
  return out;
}
