/**
 * Validar conteúdo: alinha o TEXTO/IMAGENS do documento original (transcrição
 * re-extraída) com os artigos gerados, achando o que FALTOU e ONDE inserir cada
 * item (por âncora — entre os vizinhos que já existem). Puro e testável; o
 * backend cuida de re-extrair, ler os artigos e aplicar.
 */
import type { Block, RichText } from "@/lib/blocks/schema";
import { richToText, blocksToText } from "@/lib/blocks/serialize";

/** Uma unidade do documento ORIGINAL, na ordem da transcrição. */
export type UnidadeOriginal =
  | { kind: "text"; text: string; level: number } // level 0 = corpo, 1..4 = título
  | { kind: "image"; url: string };

/** Uma unidade de um ARTIGO já existente (com âncora de onde ela está). */
export type UnidadeArtigo =
  | { kind: "text"; text: string; nodeId: string; blockId: string }
  | { kind: "image"; url: string; nodeId: string; blockId: string };

/** Onde inserir um faltante: depois de `afterBlockId` no artigo `nodeId`
 *  (null = no início do artigo). */
export type Alvo = { nodeId: string; afterBlockId: string | null };

export type Faltante =
  | { id: string; kind: "text"; text: string; level: number; alvo: Alvo }
  | { id: string; kind: "image"; url: string; alvo: Alvo };

export type Alinhamento = {
  faltantes: Faltante[];
  total: number;
  presentes: number;
  /** Fração das unidades do original presentes nos artigos (0..1). */
  completude: number;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const palavras = (s: string) => norm(s).split(" ").filter(Boolean);

/** Fração das palavras de `a` presentes em `b` (multiconjunto). */
function contido(a: string, b: string): number {
  const wa = palavras(a);
  if (!wa.length) return 1;
  const mb = new Map<string, number>();
  for (const w of palavras(b)) mb.set(w, (mb.get(w) ?? 0) + 1);
  let hit = 0;
  for (const w of wa) {
    const c = mb.get(w);
    if (c) {
      hit += 1;
      mb.set(w, c - 1);
    }
  }
  return hit / wa.length;
}

/** Um parágrafo do original está "presente" num bloco do artigo? */
function casa(o: UnidadeOriginal, a: UnidadeArtigo): boolean {
  if (o.kind === "image") return a.kind === "image" && a.url === o.url;
  if (a.kind !== "text") return false;
  // Curtos (títulos) exigem casamento mais forte; longos toleram alguma perda.
  const min = palavras(o.text).length <= 4 ? 0.85 : 0.7;
  return contido(o.text, a.text) >= min;
}

// ─────────────────────────── Parsers de unidades ───────────────────────────

/** Transcrição (linha a linha, com `#`/`⟦IMG:k⟧`/`[Página N]`) → unidades. */
export function unidadesDoTranscript(transcript: string, imageUrls: string[]): UnidadeOriginal[] {
  const out: UnidadeOriginal[] = [];
  for (const linha of transcript.split("\n")) {
    const t = linha.trim();
    if (!t || /^\[Página \d+\]$/.test(t)) continue;
    const mi = /^⟦IMG:(\d+)⟧$/.exec(t);
    if (mi) {
      const url = imageUrls[Number(mi[1])];
      if (url) out.push({ kind: "image", url });
      continue;
    }
    const mh = /^(#{1,4})\s+(.*)$/.exec(t);
    if (mh) out.push({ kind: "text", text: mh[2]!, level: mh[1]!.length });
    else out.push({ kind: "text", text: t, level: 0 });
  }
  return out;
}

/** Blocos de um artigo → unidades (texto/imagem) com âncora (nodeId, blockId). */
export function unidadesDoArtigo(nodeId: string, blocks: Block[]): UnidadeArtigo[] {
  const out: UnidadeArtigo[] = [];
  const walk = (bs: Block[]) => {
    for (const b of bs) {
      if (b.type === "image") {
        const src = b.data?.src;
        if (src) out.push({ kind: "image", url: src, nodeId, blockId: b.id });
      } else if ("text" in b && b.text && (b.text as RichText).length) {
        out.push({ kind: "text", text: richToText(b.text as RichText), nodeId, blockId: b.id });
      } else if (b.type === "table" || b.type === "code") {
        const t = blocksToText([b]);
        if (t.trim()) out.push({ kind: "text", text: t, nodeId, blockId: b.id });
      }
      const ch = "children" in b ? (b.children as Block[] | undefined) : undefined;
      if (ch) walk(ch);
    }
  };
  walk(blocks);
  return out;
}

// ──────────────────────────── Alinhamento por âncora ───────────────────────

/**
 * Ponteiro para a frente (tolera reordenações locais numa janela): para cada
 * unidade do original, procura um casamento nos artigos a partir da última
 * casada; se acha, a âncora avança; se não, é FALTANTE e vai depois da última
 * âncora conhecida (ou no início do 1º artigo).
 */
export function alinhar(original: UnidadeOriginal[], artigos: UnidadeArtigo[]): Alinhamento {
  const faltantes: Faltante[] = [];
  const primeiro = artigos[0]?.nodeId ?? null;
  const JANELA = 50;
  let ai = 0;
  let presentes = 0;
  let ultimo: Alvo | null = null;
  let seq = 0;
  for (const o of original) {
    let achou = -1;
    for (let j = ai; j < Math.min(artigos.length, ai + JANELA); j++) {
      if (casa(o, artigos[j]!)) {
        achou = j;
        break;
      }
    }
    if (achou >= 0) {
      presentes += 1;
      const a = artigos[achou]!;
      ultimo = { nodeId: a.nodeId, afterBlockId: a.blockId };
      ai = achou + 1;
    } else if (primeiro) {
      const alvo: Alvo = ultimo ?? { nodeId: primeiro, afterBlockId: null };
      const id = `f${seq++}`;
      faltantes.push(
        o.kind === "image"
          ? { id, kind: "image", url: o.url, alvo }
          : { id, kind: "text", text: o.text, level: o.level, alvo },
      );
    }
  }
  const total = original.length;
  return { faltantes, total, presentes, completude: total ? presentes / total : 1 };
}
