/**
 * Serializers de blocos (isomórfico, puro). Derivam as várias representações a
 * partir do BlockDoc v2:
 *  - blocksToText              → texto puro (excerpt/content_text/RAG)
 *  - blocksToPlainWithImageMarkers → texto com ⟦IMG:n⟧ (entrada do "Melhorar layout")
 *  - blocksToMarkdown          → export .md
 *  - blocksToHtml              → export/cache HTML semântico
 *  - firstImageOf              → 1ª imagem (thumbnail de citação no RAG)
 */
import { type Block, type RichText, type ImageData } from "./schema";
import { normalizeDoc } from "./convert";

// ── inline ───────────────────────────────────────────────────────────────────

export function richToText(rt: RichText | undefined): string {
  return (rt ?? []).map((s) => s.text).join("");
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function richToMarkdown(rt: RichText | undefined): string {
  return (rt ?? [])
    .map((span) => {
      let t = span.text;
      for (const mk of span.marks ?? []) {
        if (mk.type === "bold") t = `**${t}**`;
        else if (mk.type === "italic") t = `*${t}*`;
        else if (mk.type === "code") t = `\`${t}\``;
        else if (mk.type === "strike") t = `~~${t}~~`;
        else if (mk.type === "link") t = `[${t}](${mk.href})`;
      }
      return t;
    })
    .join("");
}

function richToHtml(rt: RichText | undefined): string {
  return (rt ?? [])
    .map((span) => {
      let t = escHtml(span.text);
      for (const mk of span.marks ?? []) {
        if (mk.type === "bold") t = `<strong>${t}</strong>`;
        else if (mk.type === "italic") t = `<em>${t}</em>`;
        else if (mk.type === "strike") t = `<s>${t}</s>`;
        else if (mk.type === "code") t = `<code>${t}</code>`;
        else if (mk.type === "kbd") t = `<kbd>${t}</kbd>`;
        else if (mk.type === "highlight") t = `<mark>${t}</mark>`;
        else if (mk.type === "color") t = `<span style="color:${escHtml(mk.color)}">${t}</span>`;
        else if (mk.type === "link")
          t = `<a href="${escHtml(mk.href)}" rel="noopener noreferrer">${t}</a>`;
      }
      return t;
    })
    .join("");
}

// ── acesso tipado a data/children ────────────────────────────────────────────

function children(b: Block): Block[] {
  return "children" in b && Array.isArray(b.children) ? b.children : [];
}

// ── texto puro ───────────────────────────────────────────────────────────────

function blockToText(b: Block): string {
  switch (b.type) {
    case "paragraph":
    case "heading":
    case "quote":
    case "listItem":
      return richToText(b.text);
    case "code":
      return b.data.code;
    case "mermaid":
      return "";
    case "image":
      return [b.data.alt, b.data.caption].filter(Boolean).join(" ");
    case "embed":
      return [b.data.title ?? "", b.data.description ?? "", b.data.url].filter(Boolean).join(" ");
    case "button":
      return b.data.label;
    case "hero":
      return [b.data.eyebrow, b.data.title, b.data.subtitle].filter(Boolean).join(" ");
    case "accordionItem":
      return [b.data.title, childrenText(b)].filter(Boolean).join(" ");
    case "tab":
      return [b.data.label, childrenText(b)].filter(Boolean).join(" ");
    case "toggle":
      return [b.data.title, childrenText(b)].filter(Boolean).join(" ");
    case "card":
      return [b.data.title, childrenText(b)].filter(Boolean).join(" ");
    case "table":
      return b.data.rows.map((row) => row.map(richToText).join(" ")).join("\n");
    case "divider":
    case "spacer":
    case "video":
    case "snippet":
      return "";
    default:
      return childrenText(b);
  }
}

function childrenText(b: Block): string {
  return children(b)
    .map(blockToText)
    .filter((s) => s.trim().length > 0)
    .join("\n");
}

/** Texto puro do documento (usa a mesma trilha de recursão do render). */
export function blocksToText(blocks: Block[]): string {
  return blocks
    .map(blockToText)
    .filter((s) => s.trim().length > 0)
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

// ── texto com marcadores de imagem (entrada do "Melhorar layout") ────────────

export type ImageMarker = { src: string; alt: string; caption: string };

export function blocksToPlainWithImageMarkers(blocks: Block[]): {
  text: string;
  images: ImageMarker[];
} {
  const parts: string[] = [];
  const images: ImageMarker[] = [];

  const walk = (bs: Block[]) => {
    for (const b of bs) {
      if (b.type === "image") {
        const d: ImageData = b.data;
        if (d.src) {
          parts.push(`\n\n⟦IMG:${images.length}⟧\n\n`);
          images.push({ src: d.src, alt: d.alt, caption: d.caption });
        }
        continue;
      }
      if (b.type === "paragraph" || b.type === "heading" || b.type === "quote" || b.type === "listItem") {
        const t = richToText(b.text);
        if (t) parts.push(t + "\n\n");
        continue;
      }
      if (b.type === "code") {
        if (b.data.code) parts.push(b.data.code + "\n\n");
        continue;
      }
      const kids = children(b);
      if (kids.length) walk(kids);
      else {
        const t = blockToText(b);
        if (t) parts.push(t + "\n\n");
      }
    }
  };

  walk(blocks);
  return { text: parts.join("").replace(/\n{3,}/g, "\n\n").trim(), images };
}

// ── Markdown ─────────────────────────────────────────────────────────────────

function listToMd(items: Block[], ordered: boolean): string {
  return items
    .map((li, i) => {
      const marker = ordered ? `${i + 1}.` : "-";
      const indent = " ".repeat(marker.length + 1);
      const body = blockToMd(li).replace(/\n/g, `\n${indent}`);
      return `${marker} ${body}`;
    })
    .join("\n");
}

function tableToMd(rows: RichText[][]): string {
  // Markdown exige a linha separadora após o cabeçalho para renderizar a tabela.
  const lines: string[] = [];
  rows.forEach((row, ri) => {
    const cells = row.map((c) => richToMarkdown(c).replace(/\|/g, "\\|").replace(/\n/g, " ") || " ");
    lines.push(`| ${cells.join(" | ")} |`);
    if (ri === 0) lines.push(`| ${cells.map(() => "---").join(" | ")} |`);
  });
  return lines.join("\n");
}

function blockToMd(b: Block): string {
  switch (b.type) {
    case "heading":
      return `${"#".repeat(b.data.level)} ${richToMarkdown(b.text)}`;
    case "paragraph":
      return richToMarkdown(b.text);
    case "listItem":
      return richToMarkdown(b.text) + (children(b).length ? "\n" + childrenMd(b) : "");
    case "bulletList":
      return listToMd(children(b), false);
    case "orderedList":
      return listToMd(children(b), true);
    case "quote":
      return richToMarkdown(b.text)
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n");
    case "divider":
      return "---";
    case "code":
      return "```" + (b.data.language ?? "") + "\n" + b.data.code + "\n```";
    case "image":
      return `![${b.data.alt}](${b.data.src})${b.data.caption ? `\n*${b.data.caption}*` : ""}`;
    case "video":
      return `[▶ vídeo](${b.data.url})`;
    case "embed":
      return b.data.provider === "raw" ? "" : `[${b.data.title || b.data.url}](${b.data.url})`;
    case "button":
      return `[${b.data.label}](${b.data.href})`;
    case "mermaid":
      return "```mermaid\n" + b.data.code + "\n```";
    case "table":
      return tableToMd(b.data.rows);
    case "callout":
      return `> **[${b.data.variant.toUpperCase()}]**\n` + childrenMd(b).split("\n").map((l) => `> ${l}`).join("\n");
    case "steps":
      return children(b)
        .map((s, i) => `${i + 1}. ${blockToMd(s).replace(/\n/g, "\n   ")}`)
        .join("\n");
    case "hero":
      return `# ${b.data.title}${b.data.subtitle ? `\n\n${b.data.subtitle}` : ""}`;
    case "accordionItem":
    case "tab":
    case "card": {
      const label = "title" in b.data ? b.data.title : b.data.label;
      return (label ? `**${label}**\n\n` : "") + childrenMd(b);
    }
    case "toggle":
      return `**${b.data.title}**\n\n` + childrenMd(b);
    case "spacer":
    case "snippet":
      return "";
    default:
      return childrenMd(b);
  }
}

function childrenMd(b: Block): string {
  return blocksToMarkdownInner(children(b));
}

function blocksToMarkdownInner(blocks: Block[]): string {
  return blocks
    .map(blockToMd)
    .filter((s) => s.length > 0)
    .join("\n\n");
}

export function blocksToMarkdown(blocks: Block[]): string {
  return blocksToMarkdownInner(blocks).trim() + "\n";
}

// ── HTML semântico (export/cache) ────────────────────────────────────────────

function blockToHtml(b: Block): string {
  switch (b.type) {
    case "heading":
      return `<h${b.data.level}>${richToHtml(b.text)}</h${b.data.level}>`;
    case "paragraph":
      return `<p>${richToHtml(b.text)}</p>`;
    case "listItem":
      return `<li>${richToHtml(b.text)}${children(b).length ? childrenHtml(b) : ""}</li>`;
    case "bulletList":
      return `<ul>${childrenHtml(b)}</ul>`;
    case "orderedList":
      return `<ol>${childrenHtml(b)}</ol>`;
    case "quote":
      return `<blockquote>${richToHtml(b.text)}</blockquote>`;
    case "divider":
      return "<hr>";
    case "code":
      return `<pre><code>${escHtml(b.data.code)}</code></pre>`;
    case "image":
      return `<figure><img src="${escHtml(b.data.src)}" alt="${escHtml(b.data.alt)}">${
        b.data.caption ? `<figcaption>${escHtml(b.data.caption)}</figcaption>` : ""
      }</figure>`;
    case "button":
      return `<a href="${escHtml(b.data.href)}">${escHtml(b.data.label)}</a>`;
    case "callout":
      return `<aside data-variant="${b.data.variant}">${childrenHtml(b)}</aside>`;
    case "table":
      return `<table><tbody>${b.data.rows
        .map(
          (row, ri) =>
            `<tr>${row
              .map((c) => {
                const tag = ri === 0 && b.data.hasHeader ? "th" : "td";
                return `<${tag}>${richToHtml(c)}</${tag}>`;
              })
              .join("")}</tr>`,
        )
        .join("")}</tbody></table>`;
    case "hero":
      return `<header><h1>${escHtml(b.data.title)}</h1>${
        b.data.subtitle ? `<p>${escHtml(b.data.subtitle)}</p>` : ""
      }</header>`;
    case "container":
      return `<div class="container">${childrenHtml(b)}</div>`;
    case "column":
    case "panel":
    case "steps":
    case "step":
    case "toggle":
    case "cardGrid":
    case "card":
    case "accordion":
    case "accordionItem":
    case "tabs":
    case "tab":
      return `<div>${childrenHtml(b)}</div>`;
    case "spacer":
    case "snippet":
    case "mermaid":
    case "video":
    case "embed":
      return "";
    default:
      return childrenHtml(b);
  }
}

function childrenHtml(b: Block): string {
  return children(b).map(blockToHtml).join("");
}

export function blocksToHtml(blocks: Block[]): string {
  return blocks.map(blockToHtml).join("\n");
}

// ── primeira imagem ──────────────────────────────────────────────────────────

export function firstImageOf(doc: unknown): string | null {
  const { blocks } = normalizeDoc(doc);
  let found: string | null = null;
  const walk = (bs: Block[]) => {
    for (const b of bs) {
      if (found) return;
      if (b.type === "image" && b.data.src) {
        found = b.data.src;
        return;
      }
      walk(children(b));
    }
  };
  walk(blocks);
  return found;
}
