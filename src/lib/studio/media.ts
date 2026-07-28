import { newId, type Block, type RichText } from "@/lib/blocks/schema";
import { richToPlain } from "@/lib/blocks/find-replace";

/**
 * Mídias anexadas a um artigo do Estúdio (imagem no corpo ou arquivo para
 * download). Ficam registradas no nó da proposta (`ProposalNode.midias`); a IA
 * só escolhe a POSIÇÃO, escrevendo um marcador de texto `[[media:<id>]]` no
 * ponto certo do corpo. O bloco real (image/file) é montado aqui, no
 * pós-processo — assim não é preciso mexer no schema de blocos da IA (que já
 * vive no teto da gramática do provedor).
 */
export type MediaRef = {
  /** id curto usado no marcador `[[media:id]]`. */
  id: string;
  kind: "image" | "file";
  /** URL pública (bucket `assets`). */
  url: string;
  name: string;
  /** bytes (arquivo p/ download); 0 = desconhecido. */
  size?: number;
  /** texto alternativo (imagem). */
  alt?: string;
};

/** Marcador que a IA escreve para posicionar uma mídia. */
const TOKEN = /\[\[\s*media\s*:\s*([a-zA-Z0-9_-]+)\s*\]\]/gi;

/** Constrói o bloco real (image/file) de uma mídia. */
export function midiaParaBloco(m: MediaRef): Block {
  if (m.kind === "image") {
    return { id: newId(), type: "image", data: { src: m.url, alt: m.alt ?? m.name, caption: "" } } as Block;
  }
  return { id: newId(), type: "file", data: { url: m.url, name: m.name, size: m.size ?? 0 } } as Block;
}

/** Texto rico do bloco, se houver. */
function textoDe(b: Block): RichText | null {
  const t = (b as { text?: RichText }).text;
  return Array.isArray(t) ? t : null;
}

/** URL que um bloco de mídia referencia (para deduplicar). */
function urlDoBloco(b: Block): string | null {
  if (b.type === "image") return (b as { data?: { src?: string } }).data?.src ?? null;
  if (b.type === "file") return (b as { data?: { url?: string } }).data?.url ?? null;
  return null;
}

/** Percorre a árvore (inclui `children`). */
function percorrer(blocks: Block[], fn: (b: Block) => void): void {
  for (const b of blocks) {
    fn(b);
    const ch = "children" in b ? (b.children as Block[] | undefined) : undefined;
    if (ch) percorrer(ch, fn);
  }
}

/** Remove os marcadores do texto rico, span a span; descarta spans vazias. */
function limparMarcadores(text: RichText): RichText {
  return text.map((s) => ({ ...s, text: s.text.replace(TOKEN, "") })).filter((s) => s.text.length > 0);
}

/**
 * Reconcilia os blocos de um artigo com as mídias registradas — PURA, testável:
 *  - troca cada marcador `[[media:id]]` pelo bloco real, no ponto onde a IA o pôs;
 *  - marcador de id desconhecido é só removido do texto;
 *  - mídia que a IA não posicionou entra no FIM (garantia de presença);
 *  - deduplica por URL (uma mídia nunca aparece duas vezes) → idempotente.
 * Só processa marcadores em blocos de texto de topo (onde a IA os escreve).
 */
export function resolverMidias(
  blocks: Block[],
  midias: MediaRef[],
  opts?: { apenasPosicionadas?: boolean },
): Block[] {
  if (!midias.length) return blocks;
  const porId = new Map(midias.map((m) => [m.id, m]));

  // URLs de mídia JÁ presentes no doc (evita duplicar em regeneração/idempotência).
  const presentes = new Set<string>();
  percorrer(blocks, (b) => {
    const u = urlDoBloco(b);
    if (u) presentes.add(u);
  });

  const saida: Block[] = [];
  for (const b of blocks) {
    const text = textoDe(b);
    if (!text) {
      saida.push(b);
      continue;
    }
    const plano = richToPlain(text);
    const achados = [...plano.matchAll(TOKEN)];
    if (!achados.length) {
      saida.push(b);
      continue;
    }
    const ids = achados.map((m) => m[1]!);
    const novoTexto = limparMarcadores(text);
    const midiaBlocks: Block[] = [];
    for (const id of ids) {
      const m = porId.get(id);
      if (m && !presentes.has(m.url)) {
        midiaBlocks.push(midiaParaBloco(m));
        presentes.add(m.url);
      }
    }
    // Se sobrou texto além do marcador, mantém o parágrafo; senão ele some.
    if (richToPlain(novoTexto).trim().length > 0) saida.push({ ...b, text: novoTexto } as Block);
    saida.push(...midiaBlocks);
  }

  // Não posicionadas pela IA → ao fim, na ordem de anexação. No scraping do chat,
  // as imagens são só CANDIDATAS (a IA escolhe quais colar), então não anexa.
  if (!opts?.apenasPosicionadas) {
    for (const m of midias) {
      if (!presentes.has(m.url)) {
        saida.push(midiaParaBloco(m));
        presentes.add(m.url);
      }
    }
  }
  return saida;
}
