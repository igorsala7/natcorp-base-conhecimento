/**
 * Duas famílias de ferramenta, com papéis diferentes no turno.
 *
 * Existe porque `temTools` (qualquer ferramenta no turno) passou a ser verdadeiro em
 * 100% dos casos quando as visuais viraram sempre-ligadas — e dois gates dependiam
 * de `!temTools` para existir:
 *
 *  - a RECUSA honesta ("não encontrei isso na documentação");
 *  - o CLARIFY DE TEMA ("você quer saber sobre X ou sobre Y?").
 *
 * Os dois viraram código morto da noite para o dia. `montar_grafico` e
 * `gerar_relatorio` não fabricam documentação: elas transformam o que já existe.
 * Contá-las como "tenho de onde tirar a resposta" é o erro de categoria.
 *
 * DADOS   → podem produzir FATO novo (API, consulta sobre dataset, coleta de páginas).
 * SISTEMA → transformam ou apresentam o que já existe (gráfico, arquivo, .ics, tela).
 *
 * Puro (sem server-only/IO) — testável isolado.
 */

/** Só o que interessa aqui: quantas chaves cada conjunto tem. */
type Conjunto = Record<string, unknown>;

export type EntradaEscopo = {
  /** APIs de integração já com o corte do modo relatório aplicado. */
  integTools: Conjunto;
  /** `coletar_relatorio` — varre todas as páginas e traz dado novo. */
  harvestTools: Conjunto;
  /** `consultar_registros`, `agregar_valores`, `agrupar`… sobre datasets do turno. */
  queryTools: Conjunto;
  /** `preencher_campo`, `destacar_tela`, `tutorial_tela`. */
  formTools: Conjunto;
  /** `montar_grafico`, `gerar_relatorio`. */
  visualTools: Conjunto;
  /** Convite de agenda (.ics). */
  inviteTools: Conjunto;
  /** O usuário DECLAROU intenção visual/de arquivo neste turno. */
  intencaoVisual: boolean;
};

export type EscopoTools = {
  temDataTools: boolean;
  /**
   * Existe alguma ferramenta capaz de responder no lugar da documentação?
   *
   * Reproduz EXATAMENTE o predicado que valia antes de as visuais ficarem sempre
   * ligadas — elas só contam quando o usuário PEDIU, que era o efeito da regex
   * antiga. Ou seja: não cria recusa nova, só devolve as que sumiram.
   */
  temToolsDeConteudo: boolean;
};

const n = (o: Conjunto | undefined) => (o ? Object.keys(o).length : 0);

export function categorizarTools(e: EntradaEscopo): EscopoTools {
  const temDataTools = n(e.integTools) + n(e.harvestTools) + n(e.queryTools) > 0;
  return {
    temDataTools,
    temToolsDeConteudo:
      temDataTools || n(e.formTools) > 0 || n(e.inviteTools) > 0 || (n(e.visualTools) > 0 && e.intencaoVisual),
  };
}
