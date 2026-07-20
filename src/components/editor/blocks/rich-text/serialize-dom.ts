/**
 * (De)serialização entre `RichText` (array de spans) e o DOM inline de um
 * contentEditable. Modelo controlado, DOM não-controlado:
 *  - spansToHtml: modelo → innerHTML (render inicial e após toggle de marca)
 *  - domToSpans: innerHTML → modelo (leitura no input/blur)
 * Além disso, operações de marca sobre o modelo por faixa de offset de caractere
 * (usadas pela barra de formatação), evitando cirurgia no DOM.
 */
import type { Mark, RichText } from "@/lib/blocks/schema";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function wrap(inner: string, mark: Mark): string {
  switch (mark.type) {
    case "bold":
      return `<strong>${inner}</strong>`;
    case "italic":
      return `<em>${inner}</em>`;
    case "strike":
      return `<s>${inner}</s>`;
    case "code":
      return `<code>${inner}</code>`;
    case "kbd":
      return `<kbd>${inner}</kbd>`;
    case "highlight":
      return `<mark data-mark="highlight"${mark.color ? ` style="background-color:${esc(mark.color)}"` : ""}>${inner}</mark>`;
    case "color":
      return `<span data-mark="color" style="color:${esc(mark.color)}">${inner}</span>`;
    case "link":
      return `<a data-mark="link" href="${esc(mark.href)}">${inner}</a>`;
  }
}

/** Modelo → innerHTML. Quebra de linha vira <br>. */
export function spansToHtml(rt: RichText): string {
  return rt
    .map((span) => {
      const body = esc(span.text).replace(/\n/g, "<br>");
      let el = body;
      for (const mark of span.marks ?? []) el = wrap(el, mark);
      return el;
    })
    .join("");
}

function markOf(el: Element): Mark | null {
  const tag = el.tagName;
  if (tag === "STRONG" || tag === "B") return { type: "bold" };
  if (tag === "EM" || tag === "I") return { type: "italic" };
  if (tag === "S" || tag === "STRIKE" || tag === "DEL") return { type: "strike" };
  if (tag === "CODE") return { type: "code" };
  if (tag === "KBD") return { type: "kbd" };
  if (tag === "MARK") {
    const color = (el as HTMLElement).style.backgroundColor;
    return color ? { type: "highlight", color } : { type: "highlight" };
  }
  if (tag === "A") return { type: "link", href: (el as HTMLAnchorElement).getAttribute("href") ?? "#" };
  if (tag === "SPAN") {
    const color = (el as HTMLElement).style.color;
    if (color) return { type: "color", color };
  }
  return null;
}

function sameMarks(a: Mark[] | undefined, b: Mark[] | undefined): boolean {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

/** Junta spans adjacentes com marcas idênticas. */
function mergeSpans(rt: RichText): RichText {
  const out: RichText = [];
  for (const span of rt) {
    if (!span.text) continue;
    const last = out[out.length - 1];
    if (last && sameMarks(last.marks, span.marks)) last.text += span.text;
    else out.push({ text: span.text, ...(span.marks ? { marks: span.marks } : {}) });
  }
  return out;
}

/** DOM (contentEditable) → modelo. */
export function domToSpans(root: Node): RichText {
  const spans: RichText = [];
  const walk = (node: Node, marks: Mark[]) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent ?? "";
        if (text) spans.push({ text, ...(marks.length ? { marks: [...marks] } : {}) });
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const el = child as Element;
      if (el.tagName === "BR") {
        spans.push({ text: "\n", ...(marks.length ? { marks: [...marks] } : {}) });
        return;
      }
      const mark = markOf(el);
      walk(el, mark ? [...marks, mark] : marks);
    });
  };
  walk(root, []);
  return mergeSpans(spans);
}

// ── operações de marca por faixa de offset (barra de formatação) ─────────────

export function textLength(rt: RichText): number {
  return rt.reduce((n, s) => n + s.text.length, 0);
}

function hasMark(marks: Mark[] | undefined, type: Mark["type"]): boolean {
  return (marks ?? []).some((m) => m.type === type);
}

/** A marca `type` está ativa em TODA a faixa [start,end)? (para alternar) */
export function isMarkActive(rt: RichText, start: number, end: number, type: Mark["type"]): boolean {
  if (start >= end) {
    // colapsado: olha o caractere anterior
    return charMarkAt(rt, start - 1)?.some((m) => m.type === type) ?? false;
  }
  let pos = 0;
  for (const span of rt) {
    const s = pos;
    const e = pos + span.text.length;
    const from = Math.max(start, s);
    const to = Math.min(end, e);
    if (from < to && !hasMark(span.marks, type)) return false;
    pos = e;
  }
  return true;
}

function charMarkAt(rt: RichText, index: number): Mark[] | undefined {
  if (index < 0) return undefined;
  let pos = 0;
  for (const span of rt) {
    if (index < pos + span.text.length) return span.marks;
    pos += span.text.length;
  }
  return undefined;
}

function addMark(marks: Mark[] | undefined, mark: Mark): Mark[] {
  const rest = (marks ?? []).filter((m) => m.type !== mark.type);
  return [...rest, mark];
}
function delMark(marks: Mark[] | undefined, type: Mark["type"]): Mark[] | undefined {
  const out = (marks ?? []).filter((m) => m.type !== type);
  return out.length ? out : undefined;
}

/**
 * Aplica (ou remove) uma marca na faixa [start,end). `mark` traz o tipo e os
 * atributos; `remove=true` remove a marca daquele tipo.
 */
export function applyMark(
  rt: RichText,
  start: number,
  end: number,
  mark: Mark,
  remove: boolean,
): RichText {
  if (start >= end) return rt;
  const out: RichText = [];
  let pos = 0;
  for (const span of rt) {
    const s = pos;
    const e = pos + span.text.length;
    pos = e;
    if (e <= start || s >= end) {
      out.push(span);
      continue;
    }
    // partes antes / dentro / depois da faixa
    const beforeLen = Math.max(0, start - s);
    const inLen = Math.min(e, end) - Math.max(s, start);
    const before = span.text.slice(0, beforeLen);
    const inside = span.text.slice(beforeLen, beforeLen + inLen);
    const after = span.text.slice(beforeLen + inLen);
    if (before) out.push({ text: before, ...(span.marks ? { marks: span.marks } : {}) });
    if (inside) {
      const nm = remove ? delMark(span.marks, mark.type) : addMark(span.marks, mark);
      out.push({ text: inside, ...(nm ? { marks: nm } : {}) });
    }
    if (after) out.push({ text: after, ...(span.marks ? { marks: span.marks } : {}) });
  }
  return mergeSpans(out);
}
