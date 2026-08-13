/**
 * AÇÃO SOBRE UMA LISTA — de resposta em texto para lista clicável.
 *
 * "O que eu tenho para aprovar?" devolve 10 requisições, e o passo seguinte é
 * aprovar 4 delas. Hoje isso vira digitação: a pessoa lê os números na tela e
 * escreve "aprova a 57463 e a 57465". Ler número de tela e redigitar é
 * exatamente onde se aprova a requisição errada.
 *
 * Aqui a ferramenta de LEITURA declara (em `ai_tools.acao_em_lista`) que seus
 * itens aceitam uma ação; este módulo transforma o retorno dela num CARTÃO que o
 * chat renderiza com seleção. Puro e sem IO — a execução é da rota
 * `/api/v1/acao`, que revalida tudo.
 *
 * ── Duas decisões que valem a leitura ────────────────────────────────────────
 *
 * DECLARADO, NÃO ADIVINHADO. Seria possível parear sozinho ("esta lista tem um
 * campo que aquela ação aceita"), mas aí qualquer consulta viraria formulário de
 * ação. Só vira lista clicável o que alguém marcou — e isso é auditável.
 *
 * `condicao` NÃO É SEGURANÇA. Ela existe para não OFERECER o que vai ser
 * recusado (uma requisição que ainda não é a vez da pessoa). Quem decide se pode
 * é o servidor, na execução, com os mesmos guards da ferramenta. Um id que chega
 * do navegador é intenção, nunca permissão.
 */

export type VarianteAcao = { valor: string; rotulo: string; estilo?: "normal" | "perigo" };
export type CampoAcao = {
  nome: string;
  rotulo: string;
  obrigatorio?: boolean;
  multilinha?: boolean;
  /** Texto de apoio abaixo do campo (ex.: "vale para as 4 selecionadas"). */
  ajuda?: string;
};

export type AcaoEmLista = {
  /** Ferramenta que executa a ação. */
  tool: string;
  /** Caminho da lista dentro do retorno (ex.: "itens"). Vazio = o retorno é a lista. */
  lista?: string;
  /** Campo que identifica o item. */
  chave_item: string;
  /** Parâmetro da ferramenta de ação que recebe o id. Padrão = `chave_item`. */
  param_item?: string;
  /** Campo (com ponto) exibido como título da linha. */
  titulo?: string;
  /** Campo (com ponto) exibido como subtítulo. */
  detalhe?: string;
  /** Só oferece a ação nos itens que satisfazem — não é permissão, é cortesia. */
  condicao?: { campo: string; igual: unknown };
  /** Campo do item cujo texto explica por que a ação NÃO está disponível. */
  motivo?: string;
  /** Parâmetro que recebe a variante escolhida (ex.: "status"). */
  param_variante?: string;
  variantes: VarianteAcao[];
  campos?: CampoAcao[];
  /** Permite selecionar vários. false = um de cada vez. */
  lote?: boolean;
  /** Título do cartão. */
  titulo_cartao?: string;
};

export type ItemAcao = {
  id: string;
  titulo: string;
  detalhe?: string;
  /** A ação está disponível para este item agora? */
  disponivel: boolean;
  motivo?: string;
};

export type CartaoAcao = {
  /** Ferramenta de LEITURA que produziu a lista. É o vínculo que autoriza a ação
   *  na rota: sem ele, quem forjasse o corpo escolheria qualquer ferramenta de
   *  escrita da base e usaria a rota como atalho para sair do chat. */
  origem: string;
  tool: string;
  titulo: string;
  param_item: string;
  param_variante?: string;
  variantes: VarianteAcao[];
  campos: CampoAcao[];
  lote: boolean;
  itens: ItemAcao[];
};

/** Lê "a.b.c" dentro de um objeto. */
function porCaminho(obj: unknown, caminho: string): unknown {
  if (!caminho) return undefined;
  let cur: unknown = obj;
  for (const parte of caminho.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[parte];
  }
  return cur;
}

function texto(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

/** A lista pode vir crua, em `{items:[…]}` (ORDS) ou no caminho declarado. */
function extrairLista(data: unknown, caminho?: string): Record<string, unknown>[] {
  const alvo = caminho ? porCaminho(data, caminho) : data;
  const bruto = Array.isArray(alvo)
    ? alvo
    : Array.isArray((alvo as { items?: unknown })?.items)
      ? (alvo as { items: unknown[] }).items
      : Array.isArray((data as { items?: unknown })?.items)
        ? (data as { items: unknown[] }).items
        : null;
  if (!bruto) return [];
  return bruto.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x));
}

export function ehAcaoEmLista(v: unknown): v is AcaoEmLista {
  if (!v || typeof v !== "object") return false;
  const a = v as Partial<AcaoEmLista>;
  return (
    typeof a.tool === "string" &&
    a.tool.trim() !== "" &&
    typeof a.chave_item === "string" &&
    a.chave_item.trim() !== "" &&
    Array.isArray(a.variantes) &&
    a.variantes.length > 0 &&
    a.variantes.every((x) => x && typeof x.valor === "string" && typeof x.rotulo === "string")
  );
}

/**
 * Monta o cartão a partir do retorno da ferramenta de leitura.
 *
 * Devolve `null` quando não há nada acionável — e é o caso comum: lista vazia,
 * ou nenhum item disponível. Mostrar um cartão com tudo desabilitado seria pior
 * que não mostrar cartão nenhum.
 */
export function montarCartaoAcao(data: unknown, decl: AcaoEmLista, origem: string): CartaoAcao | null {
  const linhas = extrairLista(data, decl.lista);
  if (linhas.length === 0) return null;

  const itens: ItemAcao[] = [];
  for (const linha of linhas) {
    const id = texto(porCaminho(linha, decl.chave_item));
    if (!id) continue; // sem identificador não há ação possível
    const disponivel = decl.condicao
      ? porCaminho(linha, decl.condicao.campo) === decl.condicao.igual
      : true;
    itens.push({
      id,
      titulo: texto(porCaminho(linha, decl.titulo ?? "")) || `#${id}`,
      detalhe: texto(porCaminho(linha, decl.detalhe ?? "")) || undefined,
      disponivel,
      motivo: disponivel ? undefined : texto(porCaminho(linha, decl.motivo ?? "")) || undefined,
    });
  }

  // Nenhum item acionável: a resposta em texto já diz o que há; um cartão só com
  // linhas apagadas viraria ruído com aparência de botão.
  if (!itens.some((i) => i.disponivel)) return null;

  return {
    origem,
    tool: decl.tool,
    titulo: decl.titulo_cartao ?? "Selecione o que deseja processar",
    param_item: decl.param_item ?? decl.chave_item,
    param_variante: decl.param_variante,
    variantes: decl.variantes,
    campos: decl.campos ?? [],
    // Um item só nunca vira checkbox: a pessoa já escolheu ao perguntar.
    lote: (decl.lote ?? true) && itens.filter((i) => i.disponivel).length > 1,
    itens,
  };
}
