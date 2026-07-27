/**
 * HTML → `Block[]` — o "de/para" de conteúdo colado (Word, Google Docs, páginas
 * web) para os blocos nativos do editor.
 *
 * PURO no sentido de não depender de `server-only`, mas usa `DOMParser`: só faz
 * sentido no navegador (o colar é sempre client-side) ou em teste com jsdom.
 * Sem chamada de IA — a conversão é estrutural e instantânea.
 *
 * O importador tem um `htmlToBlocks` próprio (`lib/importer/extract.ts`), porém
 * ele é ACHATADO (perde marcas, listas e tabelas) e preso ao Node (mammoth).
 * Aqui a conversão preserva títulos, marcas inline, listas (inclusive as
 * pseudo-listas do Word via `mso-list`), tabelas, citações, código e imagens.
 */
import type { Block, HeadingLevel, Mark, RichText } from "@/lib/blocks/schema";
import { newId } from "@/lib/blocks/schema";

// ─────────────────────────── Ponto de entrada ──────────────────────────────

/** Converte HTML da área de transferência em blocos do editor. */
export function htmlToBlocks(html: string): Block[] {
  if (typeof DOMParser === "undefined" || !html.trim()) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  limpar(doc.body);
  return finalizar(itensDe(doc.body));
}

/** Texto puro → parágrafos (fallback quando não há HTML rico). */
export function textToBlocks(text: string): Block[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => paragrafo([{ text: l }]));
}

/** Cria um bloco de imagem — reusado pelo colar de imagens da área de transf. */
export function imageBlock(src: string, alt = "", caption = ""): Block {
  return { id: newId(), type: "image", data: { src, alt, caption } } as Block;
}

// ─────────────────────── Item intermediário (listas) ───────────────────────
// As listas do Word não vêm em <ul>/<ol>: são <p class="MsoListParagraph"> com
// um marcador solto. Coletamos candidatos a item e só depois os agrupamos.

type LiItem = { li: true; ordered: boolean; level: number; text: RichText };
type Item = Block | LiItem;
const ehLi = (i: Item): i is LiItem => (i as LiItem).li === true;

// ───────────────────────────── Limpeza do DOM ──────────────────────────────

const REMOVER = new Set(["STYLE", "SCRIPT", "META", "LINK", "TITLE", "O:P", "XML"]);

/** Remove ruído do Word (estilos, comentários condicionais, <o:p>). */
function limpar(root: Node): void {
  const paraRemover: ChildNode[] = [];
  const visitar = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 8 /* comentário */) {
        paraRemover.push(child as ChildNode);
        continue;
      }
      if (child.nodeType === 1) {
        const el = child as Element;
        if (REMOVER.has(el.tagName) || el.tagName.includes(":")) {
          paraRemover.push(child as ChildNode);
          continue;
        }
        visitar(child);
      }
    }
  };
  visitar(root);
  paraRemover.forEach((n) => n.remove());
}

// ───────────────────────── Percurso a nível de bloco ───────────────────────

const INLINE = new Set([
  "A", "ABBR", "B", "BDI", "BDO", "BR", "CITE", "CODE", "DATA", "DFN", "EM", "I",
  "KBD", "MARK", "Q", "S", "SAMP", "SMALL", "SPAN", "STRONG", "SUB", "SUP", "TIME",
  "U", "VAR", "WBR", "FONT", "DEL", "INS", "TT",
]);

/** Converte os filhos de `parent` numa lista de itens (blocos + candidatos). */
function itensDe(parent: Node): Item[] {
  const out: Item[] = [];
  let buffer: Node[] = [];
  const descarregar = () => {
    if (!buffer.length) return;
    const spans = inlineDe(buffer);
    buffer = [];
    if (temTexto(spans)) out.push(paragrafo(spans));
  };

  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === 3 /* texto */) {
      if (node.textContent && node.textContent.trim()) buffer.push(node);
      continue;
    }
    if (node.nodeType !== 1) continue;
    const el = node as Element;
    if (INLINE.has(el.tagName)) {
      buffer.push(node);
      continue;
    }
    descarregar();
    out.push(...blocoDe(el));
  }
  descarregar();
  return out;
}

/** Converte um elemento de bloco em um ou mais itens. */
function blocoDe(el: Element): Item[] {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case "h1": case "h2": case "h3": case "h4": case "h5": case "h6":
      return [titulo(Number(tag[1]), inlineDe([el]))];
    case "p":
    case "div":
      return paragrafoOuItem(el);
    case "ul":
    case "ol":
      return [listaDeUlOl(el, tag === "ol")];
    case "li":
      return [{ li: true, ordered: false, level: 0, text: inlineDe([el]) }];
    case "table":
      return [tabelaDe(el)];
    case "blockquote":
      return [{ id: newId(), type: "quote", text: inlineDe([el]) } as Block];
    case "pre":
      return [{ id: newId(), type: "code", data: { language: null, code: (el.textContent ?? "").replace(/\n$/, "") } } as Block];
    case "figure":
      return figuraDe(el);
    case "img": {
      const b = imagemDe(el);
      return b ? [b] : [];
    }
    case "hr":
      return [{ id: newId(), type: "divider" } as Block];
    default:
      // Wrapper desconhecido (section/article/header/…): desce nos filhos.
      return itensDe(el);
  }
}

/** <p>/<div>: parágrafo, título estilizado ou item de lista do Word. */
function paragrafoOuItem(el: Element): Item[] {
  const style = (el.getAttribute("style") ?? "").toLowerCase();
  const cls = (el.getAttribute("class") ?? "");
  const marcador = spanMarcador(el);

  const ehListaWord = style.includes("mso-list") || /MsoListParagraph/i.test(cls) || !!marcador;
  if (ehListaWord) {
    if (marcador) marcador.remove();
    const texto = inlineDe([el]);
    if (!temTexto(texto)) return [];
    const rotulo = (marcador?.textContent ?? "").trim();
    const ordered = /\d/.test(rotulo) || /^[a-z][.)]/i.test(rotulo);
    return [{ li: true, ordered, level: nivelLista(style), text: texto }];
  }

  // Imagens embutidas no parágrafo viram blocos próprios (após o texto).
  const imagens = imagensDe(el);

  // Título por estilo do Word (Title/Heading N) — sem tag <hN>.
  const mHead = /Mso(?:Title|Heading\s*([1-6]))/i.exec(cls);
  if (mHead) {
    const spans = inlineDe([el]);
    if (temTexto(spans)) return [titulo(mHead[1] ? Number(mHead[1]) : 1, spans), ...imagens];
  }

  const spans = inlineDe([el]);
  const out: Item[] = [];
  if (temTexto(spans)) out.push(paragrafo(spans));
  out.push(...imagens);
  return out;
}

/** Blocos de imagem para toda <img> reaproveitável dentro do elemento. */
function imagensDe(el: Element): Block[] {
  const out: Block[] = [];
  for (const img of Array.from(el.querySelectorAll("img"))) {
    const b = imagemDe(img);
    if (b) out.push(b);
  }
  return out;
}

/** Procura o span do marcador da lista do Word (`mso-list:Ignore`). */
function spanMarcador(el: Element): Element | null {
  for (const span of Array.from(el.querySelectorAll("span"))) {
    if ((span.getAttribute("style") ?? "").toLowerCase().includes("mso-list:ignore")) return span;
  }
  return null;
}

/** Nível (1-based) a partir de `mso-list:l0 level2 lfo1`. */
function nivelLista(style: string): number {
  const m = /level(\d+)/.exec(style);
  return m ? Math.max(1, Number(m[1])) : 1;
}

/** <ul>/<ol> → bloco de lista, com <li> aninhados virando sub-listas. */
function listaDeUlOl(el: Element, ordered: boolean): Block {
  const itens: Block[] = [];
  for (const li of Array.from(el.children)) {
    if (li.tagName.toLowerCase() !== "li") continue;
    // Texto do item = tudo, exceto sub-listas; sub-<ul>/<ol> viram children.
    const subListas: Block[] = [];
    const inlineNodes: Node[] = [];
    for (const child of Array.from(li.childNodes)) {
      const t = child.nodeType === 1 ? (child as Element).tagName.toLowerCase() : "";
      if (t === "ul" || t === "ol") subListas.push(listaDeUlOl(child as Element, t === "ol"));
      else inlineNodes.push(child);
    }
    const item: Block = { id: newId(), type: "listItem", text: inlineDe(inlineNodes) } as Block;
    if (subListas.length) (item as { children?: Block[] }).children = subListas;
    itens.push(item);
  }
  return {
    id: newId(),
    type: ordered ? "orderedList" : "bulletList",
    children: itens.length ? itens : [{ id: newId(), type: "listItem", text: [] } as Block],
  } as Block;
}

/** <table> → bloco de tabela (células = RichText). */
function tabelaDe(el: Element): Block {
  const linhas: RichText[][] = [];
  let temCabecalho = false;
  const trs = Array.from(el.querySelectorAll("tr"));
  trs.forEach((tr, i) => {
    const celulas = Array.from(tr.children).filter((c) =>
      ["td", "th"].includes(c.tagName.toLowerCase()),
    );
    if (!celulas.length) return;
    if (i === 0 && celulas.every((c) => c.tagName.toLowerCase() === "th")) temCabecalho = true;
    linhas.push(celulas.map((c) => inlineDe([c])));
  });
  if (!linhas.length) return paragrafo([]);
  const cols = Math.max(...linhas.map((r) => r.length));
  const rows = linhas.map((r) => {
    const copia = r.slice();
    while (copia.length < cols) copia.push([]);
    return copia;
  });
  return { id: newId(), type: "table", data: { hasHeader: temCabecalho, rows } } as Block;
}

/** <figure><img><figcaption> → bloco de imagem com legenda. */
function figuraDe(el: Element): Item[] {
  const img = el.querySelector("img");
  if (!img) return itensDe(el);
  const b = imagemDe(img);
  if (!b) return [];
  const cap = el.querySelector("figcaption");
  if (cap?.textContent) (b as Extract<Block, { type: "image" }>).data.caption = cap.textContent.trim();
  return [b];
}

/** <img> → bloco de imagem; devolve null quando a URL não é reaproveitável. */
function imagemDe(el: Element): Block | null {
  const src = (el.getAttribute("src") ?? "").trim();
  // Só data:/http(s) servem. file://, cid:, blob:, relativo e marcadores do
  // importador (__IMG_n__) não persistem — melhor pular do que ficar quebrado.
  if (!src || !/^(data:|https?:)/i.test(src)) return null;
  return imageBlock(src, el.getAttribute("alt") ?? "");
}

// ──────────────────────────── Agrupamento de listas ────────────────────────

/** Junta candidatos a item consecutivos em blocos de lista (com aninhamento). */
function finalizar(itens: Item[]): Block[] {
  const out: Block[] = [];
  let corrida: LiItem[] = [];
  const descarregar = () => {
    if (corrida.length) {
      out.push(...aninharListas(corrida));
      corrida = [];
    }
  };
  for (const it of itens) {
    if (ehLi(it)) corrida.push(it);
    else {
      descarregar();
      out.push(it);
    }
  }
  descarregar();
  return out.length ? out : [];
}

/** Constrói listas aninhadas a partir de itens planos com nível. */
function aninharListas(itens: LiItem[]): Block[] {
  let i = 0;
  const construir = (nivel: number): Block[] => {
    const listas: Block[] = [];
    let atual: { ordered: boolean; itens: Block[] } | null = null;
    while (i < itens.length) {
      const it = itens[i];
      if (!it || it.level < nivel) break;
      if (it.level > nivel) {
        const sub = construir(it.level);
        const ultimo = atual?.itens[atual.itens.length - 1] as { children?: Block[] } | undefined;
        if (ultimo) ultimo.children = [...(ultimo.children ?? []), ...sub];
        else listas.push(...sub);
        continue;
      }
      if (!atual || atual.ordered !== it.ordered) {
        atual = { ordered: it.ordered, itens: [] };
        listas.push({
          id: newId(),
          type: it.ordered ? "orderedList" : "bulletList",
          children: atual.itens,
        } as Block);
      }
      atual.itens.push({ id: newId(), type: "listItem", text: it.text } as Block);
      i++;
    }
    return listas;
  };
  return construir(itens[0]?.level ?? 1);
}

// ─────────────────────────── Inline (marcas + CSS) ─────────────────────────

/** Percorre nós inline preservando marcas de TAG e de CSS (negrito do Word). */
function inlineDe(nodes: Node[], herdadas: Mark[] = []): RichText {
  const out: RichText = [];
  for (const node of nodes) andarInline(node, herdadas, out);
  return juntarSpans(out);
}

function andarInline(node: Node, marcas: Mark[], out: RichText): void {
  if (node.nodeType === 3) {
    const t = normalizarEspaco(node.textContent ?? "");
    if (t) out.push({ text: t, ...(marcas.length ? { marks: marcas } : {}) });
    return;
  }
  if (node.nodeType !== 1) return;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (tag === "br") {
    out.push({ text: "\n" });
    return;
  }
  if (tag === "img") return; // imagens são tratadas a nível de bloco
  // Marcador de lista do Word não vira texto.
  if ((el.getAttribute("style") ?? "").toLowerCase().includes("mso-list:ignore")) return;
  const proximas = mesclarMarcas(marcas, marcasDe(el));
  for (const child of Array.from(el.childNodes)) andarInline(child, proximas, out);
}

/** Marcas trazidas por um elemento (tag + estilo inline). */
function marcasDe(el: Element): Mark[] {
  const tag = el.tagName.toLowerCase();
  const s = parseStyle(el.getAttribute("style") ?? "");
  const m: Mark[] = [];

  if (tag === "strong" || tag === "b") m.push({ type: "bold" });
  if (tag === "em" || tag === "i" || tag === "cite" || tag === "dfn") m.push({ type: "italic" });
  if (tag === "s" || tag === "strike" || tag === "del") m.push({ type: "strike" });
  if (tag === "code" || tag === "tt" || tag === "samp") m.push({ type: "code" });
  if (tag === "kbd") m.push({ type: "kbd" });
  if (tag === "mark") m.push({ type: "highlight", ...(s["background-color"] ? { color: s["background-color"] } : {}) });
  if (tag === "a") {
    const href = el.getAttribute("href") ?? "";
    if (href && !/^(file:|#|javascript:)/i.test(href)) m.push({ type: "link", href });
  }

  const fw = s["font-weight"];
  if (fw && (fw === "bold" || fw === "bolder" || Number(fw) >= 600)) m.push({ type: "bold" });
  if (s["font-style"] === "italic") m.push({ type: "italic" });
  const td = s["text-decoration"] ?? s["text-decoration-line"] ?? "";
  if (td.includes("line-through")) m.push({ type: "strike" });
  const cor = s["color"];
  if (cor && !corPadrao(cor)) m.push({ type: "color", color: cor });
  const bg = s["background-color"] ?? primeiraCorBackground(s["background"]);
  if (bg && !corTransparente(bg)) m.push({ type: "highlight", color: bg });

  return m;
}

/** Concatena marcas herdadas + novas, sem repetir tipo (a primeira vence). */
function mesclarMarcas(base: Mark[], novas: Mark[]): Mark[] {
  const out = [...base];
  for (const m of novas) if (!out.some((x) => x.type === m.type)) out.push(m);
  return out;
}

// ──────────────────────────────── Utilidades ───────────────────────────────

function paragrafo(text: RichText): Block {
  return { id: newId(), type: "paragraph", text } as Block;
}

function titulo(nivel: number, text: RichText): Block {
  const level = Math.min(3, Math.max(1, nivel)) as HeadingLevel;
  return { id: newId(), type: "heading", text, data: { level } } as Block;
}

function temTexto(spans: RichText): boolean {
  return spans.some((s) => s.text.trim().length > 0);
}

/** Colapsa espaços em branco como o HTML faz (inclui `&nbsp;`, que é `\s`). */
function normalizarEspaco(text: string): string {
  return text.replace(/\s+/g, " ");
}

/** Une spans adjacentes de marcas iguais (menos ruído no JSON). */
function juntarSpans(spans: RichText): RichText {
  const out: RichText = [];
  for (const s of spans) {
    const prev = out[out.length - 1];
    if (prev && mesmasMarcas(prev.marks, s.marks)) prev.text += s.text;
    else out.push({ ...s });
  }
  return out;
}

function mesmasMarcas(a?: Mark[], b?: Mark[]): boolean {
  const ka = a ? a.map(chaveMarca).sort().join("|") : "";
  const kb = b ? b.map(chaveMarca).sort().join("|") : "";
  return ka === kb;
}
function chaveMarca(m: Mark): string {
  if (m.type === "link") return `link:${m.href}`;
  if (m.type === "color") return `color:${m.color}`;
  if (m.type === "highlight") return `highlight:${m.color ?? ""}`;
  return m.type;
}

/** "a:1; b: 2" → { a:"1", b:"2" } (chaves minúsculas). */
function parseStyle(style: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const decl of style.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const k = decl.slice(0, i).trim().toLowerCase();
    const v = decl.slice(i + 1).trim().toLowerCase();
    if (k && v) out[k] = v;
  }
  return out;
}

function primeiraCorBackground(bg?: string): string | undefined {
  if (!bg) return undefined;
  const m = /#[0-9a-f]{3,8}|rgba?\([^)]+\)/i.exec(bg);
  return m ? m[0] : undefined;
}

const CORES_NEUTRAS = new Set(["#000", "#000000", "black", "windowtext", "rgb(0,0,0)", "inherit", "currentcolor"]);
function corPadrao(cor: string): boolean {
  return CORES_NEUTRAS.has(cor.replace(/\s/g, ""));
}
const CORES_TRANSP = new Set(["transparent", "none", "#fff", "#ffffff", "white", "rgb(255,255,255)", "window"]);
function corTransparente(cor: string): boolean {
  return CORES_TRANSP.has(cor.replace(/\s/g, ""));
}
