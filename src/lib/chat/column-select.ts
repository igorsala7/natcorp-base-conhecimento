/**
 * Escolhe QUAIS COLUNAS de um relatório da tela entram no prompt.
 *
 * Um Interactive Report de RH pode ter 60+ colunas, e a prévia manda 40 linhas ×
 * todas elas × até 300 chars por célula — milhares de tokens por passo, multiplicados
 * por até 9 passos. Quando a pergunta é sobre 3 colunas, as outras 57 são custo puro.
 *
 * O que torna isto SEGURO é que o dataset completo é registrado ANTES da prévia
 * (`registrarTabelaTela`): estreitar aqui não tira dado do agente, só tira do que ele
 * LÊ direto. `consultar_registros`, `agregar_valores` e `agrupar` continuam sobre 100%
 * das linhas e colunas via `dados_de`.
 *
 * ── O risco que este módulo existe para evitar ──────────────────────────────────
 * Cortar uma coluna de DIMENSÃO não produz resposta incompleta: produz NÚMERO ERRADO.
 * "Qual centro de custo tem maior custo?" casa `Centro de Custo` e `Valor`; se o
 * relatório também tiver `Empresa` e `Competência` e elas saírem, o agente soma meses
 * e empresas diferentes e entrega um total plausível e falso. Por isso a regra nunca é
 * "as colunas que casaram" — é elas MAIS todas as dimensões (identificador, data,
 * categórica de baixa cardinalidade), e mais as numéricas quando o pedido é agregado.
 *
 * Puro (sem IO): testável isolado.
 */

/** Perfil de uma coluna, inferido da amostra — mesmo critério do resumo estatístico. */
export type PerfilColuna = {
  idx: number;
  nome: string;
  tipo: "numero" | "data" | "texto";
  /** Valores distintos na amostra (baixa cardinalidade ⇒ é dimensão). */
  distintos: number;
  preenchidas: number;
};

const norm = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const RX_NUM = /^-?\s*R?\$?\s*-?[\d.]+(,\d+)?\s*%?$/;
const RX_DATA = /^\d{2}[/-]\d{2}[/-]\d{2,4}$|^\d{4}-\d{2}(-\d{2})?$|^\d{2}\/\d{4}$/;

/** Amostra distribuída (stride), não as primeiras N: relatório ordenado engana. */
export function perfilarColunas(colunas: string[], linhas: string[][], alvoAmostra = 200): PerfilColuna[] {
  const passo = Math.max(1, Math.ceil(linhas.length / alvoAmostra));
  return colunas.map((nome, idx) => {
    const vistos = new Set<string>();
    let num = 0, data = 0, preenchidas = 0;
    for (let r = 0; r < linhas.length; r += passo) {
      const v = String(linhas[r]?.[idx] ?? "").trim();
      if (!v) continue;
      preenchidas++;
      if (vistos.size < 500) vistos.add(norm(v));
      if (RX_DATA.test(v)) data++;
      else if (RX_NUM.test(v)) num++;
    }
    const tipo: PerfilColuna["tipo"] =
      preenchidas === 0 ? "texto" : data / preenchidas >= 0.7 ? "data" : num / preenchidas >= 0.7 ? "numero" : "texto";
    return { idx, nome, tipo, distintos: vistos.size, preenchidas };
  });
}

/** Palavras significativas (≥ 4 chars, sem acento) — mesmo critério de `mensagemRelacionaTela`. */
function termos(s: string): string[] {
  return norm(s).split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
}

/** Tokens que denunciam uma coluna-chave, mesmo com muitos valores distintos. */
const TOKENS_CHAVE = new Set([
  "codigo", "cod", "matricula", "chapa", "registro", "id", "cpf", "cnpj", "pis",
  "empresa", "filial", "unidade", "estabelecimento", "lotacao", "centro", "custo",
  "competencia", "periodo", "referencia", "mes", "ano", "data", "vinculo", "cargo",
  "situacao", "status", "tipo", "categoria", "departamento", "setor", "nome",
]);

export type EscolhaColunas = {
  /** Índices a manter na prévia, em ordem original. */
  manter: number[];
  /** Nomes das colunas que ficaram de fora — o prompt PRECISA declará-los. */
  omitidas: string[];
  motivo: "estreito" | "completo" | "sem-casamento" | "pouco-ganho" | "recorte";
};

export type EntradaEscolha = {
  colunas: string[];
  linhas: string[][];
  /** Pergunta do usuário (já com o histórico resolvido, quando houver). */
  pergunta: string;
  /** Formas da ontologia casadas na pergunta — sinônimos que o usuário não digitou. */
  formasOntologia?: string[];
  /** Pedido geral/estratégico/completo → 100% das colunas, sem discussão. */
  pedidoCompleto?: boolean;
  /** Colunas escolhidas por uma camada externa (IA rápida), por NOME. */
  escolhidasPorIa?: string[] | null;
};

/** Abaixo disto o corte não paga o risco: o relatório já cabe no prompt. */
const MIN_LARGURA = 12;
/** Se sobraria quase tudo, não estreita — evita meia-medida com risco de dimensão. */
const GANHO_MINIMO = 0.75;
/** Acima disto, a coluna é identificador/texto livre, não dimensão de agrupamento. */
const MAX_DISTINTOS_DIMENSAO = 40;

/** A pergunta pede AGREGAÇÃO (soma/média/total/ranking)? Então as numéricas entram. */
const RX_AGREGACAO = /\b(soma|somat|total|m[ée]dia|maior|menor|ranking|rankear|top\b|acumul|percentual|propor[çc]|m[áa]ximo|m[íi]nimo|quanto|valor)/i;
/** Pedido de CONTAGEM: conta linhas, não soma coluna. */
const RX_CONTAGEM = /\b(quant[oa]s|n[ºo°]\s*de|n[úu]mero de|contagem|quantidade)\b/i;

export function selecionarColunas(e: EntradaEscolha): EscolhaColunas {
  const todas = e.colunas.map((_c, i) => i);
  const tudo = (motivo: EscolhaColunas["motivo"]): EscolhaColunas => ({ manter: todas, omitidas: [], motivo });

  // Relatório estreito ou pedido explicitamente completo/estratégico → tudo.
  if (e.colunas.length <= MIN_LARGURA) return tudo("estreito");
  if (e.pedidoCompleto) return tudo("completo");

  const perfis = perfilarColunas(e.colunas, e.linhas);
  const nLinhas = Math.max(1, e.linhas.length);

  // 1) CASAMENTO com a pergunta (+ ontologia): o alvo do usuário.
  const alvo = new Set([...termos(e.pergunta), ...(e.formasOntologia ?? []).flatMap(termos)]);
  const casou = (p: PerfilColuna) => termos(p.nome).some((t) => alvo.has(t));

  // 2) Camada de IA rápida (opcional): nomes escolhidos por ela entram como casamento.
  const porIa = new Set((e.escolhidasPorIa ?? []).map(norm));

  // 3) DIMENSÕES — a proteção contra o agregado errado. Entram SEMPRE.
  const ehDimensao = (p: PerfilColuna) => {
    if (p.tipo === "data") return true;
    if (termos(p.nome).some((t) => TOKENS_CHAVE.has(t))) return true;
    // Categórica de baixa cardinalidade: é por onde se agrupa.
    return p.tipo === "texto" && p.distintos > 0 && p.distintos <= MAX_DISTINTOS_DIMENSAO && p.distintos < nLinhas * 0.5;
  };

  // MEDIDAS: num pedido agregado, as colunas numéricas são candidatas a medida. Mas
  // "todas as numéricas" é largo demais — um relatório de folha tem 30 verbas e o
  // recorte não sobra nada. Se alguma numérica CASOU, ela é a medida e as outras saem;
  // se nenhuma casou, não sabemos qual é e mantemos todas (o `pouco-ganho` abaixo
  // provavelmente desiste do corte, que é o desfecho certo quando não há sinal).
  const querAgregar = RX_AGREGACAO.test(e.pergunta);
  const alvoDireto = (p: PerfilColuna) => casou(p) || porIa.has(norm(p.nome));
  const algumaMedidaCasou = perfis.some((p) => p.tipo === "numero" && alvoDireto(p));
  // CONTAGEM não tem medida: "quantos colaboradores por cargo?" conta LINHAS. Sem esta
  // ressalva o "quantos" casava a regex de agregação, puxava as 33 colunas numéricas e
  // o recorte desistia por "pouco ganho" — justamente no pedido mais comum de RH.
  const soContagem = RX_CONTAGEM.test(e.pergunta) && !algumaMedidaCasou;
  const ehMedida = (p: PerfilColuna) =>
    querAgregar && !soContagem && p.tipo === "numero" && !algumaMedidaCasou;

  const manter = perfis
    .filter((p) => alvoDireto(p) || ehDimensao(p) || ehMedida(p))
    .map((p) => p.idx);

  // FAIL-OPEN em dois casos: nada casou (não sabemos o alvo) ou o corte é irrisório.
  // Estreitar sem sinal é o pior dos mundos — some contexto sem economizar nada.
  const casaramAlgo = perfis.some(alvoDireto);
  if (!casaramAlgo) return tudo("sem-casamento");
  if (manter.length >= e.colunas.length * GANHO_MINIMO) return tudo("pouco-ganho");

  const mantidas = new Set(manter);
  return {
    manter,
    omitidas: e.colunas.filter((_c, i) => !mantidas.has(i)),
    motivo: "recorte",
  };
}

/**
 * Nota que ACOMPANHA o recorte no prompt.
 *
 * Sem ela o agente diria "o relatório não tem essa informação" — o defeito mais caro
 * do sistema. Ele precisa saber que as colunas existem e continuam consultáveis.
 */
export function notaColunasOmitidas(omitidas: string[], id: string): string {
  if (!omitidas.length) return "";
  const lista = omitidas.slice(0, 40).join(", ");
  const resto = omitidas.length > 40 ? ` (+${omitidas.length - 40})` : "";
  return (
    `\nOBSERVAÇÃO: para economizar espaço, a prévia acima traz só as colunas relevantes para o pedido. ` +
    `O relatório TEM outras ${omitidas.length} coluna(s): ${lista}${resto}. ` +
    `Elas continuam disponíveis — use consultar_registros/agregar_valores/agrupar com dados_de="${id}" para qualquer uma delas. ` +
    `NUNCA diga que o relatório não tem uma informação sem antes conferir nesta lista.`
  );
}

/** Aplica o recorte a uma linha, preservando a ordem original das colunas. */
export function recortarLinha(linha: string[], manter: number[]): string[] {
  return manter.map((i) => linha[i] ?? "");
}
