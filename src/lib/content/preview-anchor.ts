/**
 * Âncora de um nó dentro da prévia da documentação.
 *
 * Mora sozinha num módulo puro porque os dois lados precisam dela: a tela da
 * prévia (servidor) para gerar os `id`, e o editor (`"use client"`) para montar
 * o link do botão "Prévia". Se ela vivesse junto da tela, o editor arrastaria
 * um módulo de servidor para o bundle do cliente.
 *
 * Baseada só no `id`: o editor consegue montar o link tendo apenas o `nodeId`,
 * e o link não apodrece quando o artigo é renomeado ou movido.
 */
export const ancoraDePrevia = (nodeId: string) => `p-${nodeId}`;
