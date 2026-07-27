/**
 * AGRUPAR: envolve N blocos irmãos selecionados numa nova região-contêiner do
 * tipo escolhido, organizando os filhos automaticamente.
 *
 * Puro e isomórfico (sem `server-only`, sem DOM). Regras de aninhamento vêm de
 * `canNest` (registry.meta): contêineres "estritos" exigem um wrapper por filho
 * (colunas→column, grade→card, passos→step, abas→tab, acordeão→accordionItem);
 * callout/painel/toggle recebem os blocos direto.
 */
import type { Block, BlockType, RichText } from "@/lib/blocks/schema";
import { newId } from "@/lib/blocks/schema";
import { BLOCKS, canNest } from "@/lib/blocks/registry.meta";
import { flattenBlocks, findBlock, patchBlock, topAncestorId } from "@/lib/blocks/tree-ops";

/**
 * Tipos oferecidos ao agrupar. Os quatro primeiros ABSORVEM o texto de cada
 * bloco selecionado (vira item da lista/checklist, ou um único parágrafo); os
 * demais são regiões-contêiner que recebem os blocos como filhos.
 */
export const GROUP_TARGETS: BlockType[] = [
  "paragraph",
  "bulletList",
  "orderedList",
  "checklist",
  "breadcrumb",
  "container",
  "cardGrid",
  "steps",
  "callout",
  "panel",
  "toggle",
  "tabs",
  "accordion",
];

/** Texto rico de um bloco que carrega texto (paragraph/heading/quote/listItem); `[]` se não tiver. */
function textDe(b: Block): RichText {
  const t = (b as { text?: RichText }).text;
  return Array.isArray(t) ? t : [];
}

/** Cada bloco vira um item de lista: levanta o texto; sem texto, o bloco entra como filho do item. */
function paraListItem(b: Block): Block {
  const txt = textDe(b);
  return txt.length
    ? ({ id: newId(), type: "listItem", text: txt } as Block)
    : ({ id: newId(), type: "listItem", text: [], children: [b] } as Block);
}

/** Junta os textos dos blocos num único parágrafo, separados por um espaço. */
function juntarTexto(filhos: Block[]): RichText {
  const out: RichText = [];
  for (const f of filhos) {
    const t = textDe(f);
    if (!t.length) continue;
    if (out.length) out.push({ text: " " });
    out.push(...t);
  }
  return out;
}

/** Junta os textos dos blocos numa trilha de navegação, separados por " › ". */
function juntarComoTrilha(filhos: Block[]): RichText {
  const out: RichText = [];
  for (const f of filhos) {
    const t = textDe(f);
    if (!t.length) continue;
    if (out.length) out.push({ text: " › " });
    out.push(...t);
  }
  return out;
}

/** Contêiner estrito → wrapper obrigatório de cada filho. */
const STRICT_WRAP: Partial<Record<BlockType, BlockType>> = {
  container: "column",
  cardGrid: "card",
  steps: "step",
  tabs: "tab",
  accordion: "accordionItem",
};

/** Envolve um bloco no wrapper SÓ-FILHO do contêiner estrito. */
function wrapChild(wrap: BlockType, filho: Block, i: number): Block {
  switch (wrap) {
    case "column":
      return { id: newId(), type: "column", children: [filho] } as Block;
    case "card":
      return { id: newId(), type: "card", data: { icon: "", title: "", href: "" }, children: [filho] } as Block;
    case "step":
      return { id: newId(), type: "step", children: [filho] } as Block;
    case "tab":
      return { id: newId(), type: "tab", data: { label: `Aba ${i + 1}` }, children: [filho] } as Block;
    default:
      return { id: newId(), type: "accordionItem", data: { title: `Seção ${i + 1}` }, children: [filho] } as Block;
  }
}

/** Monta o bloco-alvo do tipo pedido com os blocos selecionados dentro. */
function buildContainer(type: BlockType, filhos: Block[], id: string): Block {
  // Texto/listas/checklist: absorvem o TEXTO de cada bloco selecionado.
  if (type === "paragraph") {
    return { id, type: "paragraph", text: juntarTexto(filhos) } as Block;
  }
  if (type === "breadcrumb") {
    return { id, type: "breadcrumb", text: juntarComoTrilha(filhos) } as Block;
  }
  if (type === "bulletList" || type === "orderedList") {
    return { id, type, children: filhos.map(paraListItem) } as Block;
  }
  if (type === "checklist") {
    return {
      id,
      type: "checklist",
      data: { items: filhos.map((f) => ({ id: newId(), text: textDe(f), checked: false })) },
    } as Block;
  }

  const wrap = STRICT_WRAP[type];
  if (wrap) {
    const children = filhos.map((b, i) => wrapChild(wrap, b, i));
    if (type === "container") return { id, type, data: { columns: children.length }, children } as Block;
    if (type === "cardGrid") return { id, type, data: { cols: Math.min(Math.max(children.length, 1), 4) }, children } as Block;
    return { id, type, children } as Block; // steps/tabs/accordion não têm data
  }
  // callout/panel/toggle: recebem os blocos direto, mantendo o data padrão.
  const base = BLOCKS[type].defaultData();
  return { ...base, id, children: filhos } as Block;
}

/** O bloco `parentId` (ou a raiz) aceita conter uma região `type`? */
function podeConter(blocks: Block[], parentId: string | null, type: BlockType): boolean {
  if (parentId == null) return true; // a raiz aceita qualquer região
  const p = findBlock(blocks, parentId);
  return !!p && canNest(p.type, type);
}

function filhosDe(b: Block | null): Block[] {
  return b && "children" in b ? ((b.children as Block[]) ?? []) : [];
}

/**
 * Agrupa os blocos `ids` numa nova região `type`. Agrupa NO LUGAR quando são
 * irmãos e o pai aceita a região; senão normaliza para os ancestrais de topo
 * (raiz, que sempre aceita). Preserva a ordem do documento e insere o grupo na
 * posição do primeiro selecionado. Devolve a nova árvore + o id do contêiner,
 * ou `null` quando não há o que agrupar (menos de 2 blocos resolvidos).
 */
export function groupBlocks(
  blocks: Block[],
  ids: string[],
  type: BlockType,
  groupId: string = newId(),
): { blocks: Block[]; groupId: string } | null {
  const flat = flattenBlocks(blocks);
  const porId = new Map(flat.map((f) => [f.id, f]));
  const infos = ids.map((id) => porId.get(id)).filter((f): f is NonNullable<typeof f> => !!f);
  if (infos.length < 2) return null;

  // Pai comum? Só agrupa no lugar se o pai aceitar a região escolhida.
  const paiUnico = new Set(infos.map((f) => f.parentId)).size === 1 ? infos[0]!.parentId : undefined;

  let parentId: string | null;
  let alvoIds: string[];
  if (paiUnico !== undefined && podeConter(blocks, paiUnico, type)) {
    parentId = paiUnico;
    alvoIds = infos.map((f) => f.id);
  } else {
    // Pais diferentes (ou pai estrito): normaliza para os blocos de topo.
    parentId = null;
    const tops: string[] = [];
    for (const id of ids) {
      const t = topAncestorId(blocks, id);
      if (t && !tops.includes(t)) tops.push(t);
    }
    if (tops.length < 2) return null;
    alvoIds = tops;
  }

  const lista = parentId == null ? blocks : filhosDe(findBlock(blocks, parentId));

  const ordenados = alvoIds
    .map((id) => ({ id, pos: lista.findIndex((b) => b.id === id) }))
    .filter((x) => x.pos >= 0)
    .sort((a, b) => a.pos - b.pos);
  if (ordenados.length < 2) return null;

  const sel = new Set(ordenados.map((x) => x.id));
  const filhos = ordenados.map((x) => lista.find((b) => b.id === x.id)!);
  const grupo = buildContainer(type, filhos, groupId);

  const ancoraPos = ordenados[0]!.pos;
  const restante = lista.filter((b) => !sel.has(b.id));
  const antes = lista.slice(0, ancoraPos).filter((b) => !sel.has(b.id)).length;
  const novaLista = [...restante.slice(0, antes), grupo, ...restante.slice(antes)];

  const novaArvore =
    parentId == null ? novaLista : patchBlock(blocks, parentId, { children: novaLista } as Partial<Block>);
  return { blocks: novaArvore, groupId };
}
