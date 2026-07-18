// Conversor content_json (TipTap) → Markdown, sem dependências.
// Reformata sem perder conteúdo; nós desconhecidos caem para os filhos/texto.

type Node = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

function inline(nodes: Node[] | undefined): string {
  if (!nodes) return "";
  return nodes
    .map((n) => {
      if (n.type === "text") {
        let t = n.text ?? "";
        for (const mk of n.marks ?? []) {
          if (mk.type === "bold") t = `**${t}**`;
          else if (mk.type === "italic") t = `*${t}*`;
          else if (mk.type === "code") t = `\`${t}\``;
          else if (mk.type === "strike") t = `~~${t}~~`;
          else if (mk.type === "link") {
            const href = (mk.attrs?.href as string) ?? "";
            t = `[${t}](${href})`;
          }
        }
        return t;
      }
      if (n.type === "hardBreak") return "\n";
      // inline desconhecido → texto dos filhos
      return inline(n.content);
    })
    .join("");
}

function tableToMd(node: Node): string {
  const rows = node.content ?? [];
  const lines: string[] = [];
  rows.forEach((row, ri) => {
    const cells = (row.content ?? []).map((cell) => inline(cell.content?.flatMap((p) => p.content ?? [])).replace(/\|/g, "\\|") || " ");
    lines.push(`| ${cells.join(" | ")} |`);
    if (ri === 0) lines.push(`| ${cells.map(() => "---").join(" | ")} |`);
  });
  return lines.join("\n");
}

function block(node: Node, depth = 0): string {
  const t = node.type;
  switch (t) {
    case "heading": {
      const level = Math.min(6, Math.max(1, (node.attrs?.level as number) ?? 1));
      return `${"#".repeat(level)} ${inline(node.content)}`;
    }
    case "paragraph":
      return inline(node.content);
    case "bulletList":
      return (node.content ?? [])
        .map((li) => `- ${blocks(li.content, depth + 1).replace(/\n/g, "\n  ")}`)
        .join("\n");
    case "orderedList":
      return (node.content ?? [])
        .map((li, i) => `${i + 1}. ${blocks(li.content, depth + 1).replace(/\n/g, "\n   ")}`)
        .join("\n");
    case "listItem":
      return blocks(node.content, depth);
    case "steps":
      return (node.content ?? [])
        .map((s, i) => `${i + 1}. ${blocks(s.content, depth + 1).replace(/\n/g, "\n   ")}`)
        .join("\n");
    case "codeBlock": {
      const lang = (node.attrs?.language as string) ?? "";
      return "```" + lang + "\n" + inline(node.content) + "\n```";
    }
    case "blockquote":
      return blocks(node.content, depth)
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n");
    case "callout": {
      const variant = (node.attrs?.variant as string) ?? "info";
      const body = blocks(node.content, depth).split("\n").map((l) => `> ${l}`).join("\n");
      return `> **[${variant.toUpperCase()}]**\n${body}`;
    }
    case "panel":
      return blocks(node.content, depth);
    case "columns":
      return (node.content ?? []).map((c) => blocks(c.content, depth)).join("\n\n");
    case "column":
      return blocks(node.content, depth);
    case "accordion":
    case "tabs":
      return (node.content ?? [])
        .map((item) => {
          const label = (item.attrs?.title as string) ?? (item.attrs?.label as string) ?? "";
          return (label ? `**${label}**\n\n` : "") + blocks(item.content, depth);
        })
        .join("\n\n");
    case "figureImage": {
      const src = (node.attrs?.src as string) ?? "";
      const alt = (node.attrs?.alt as string) ?? "";
      const cap = (node.attrs?.caption as string) ?? "";
      return `![${alt}](${src})${cap ? `\n*${cap}*` : ""}`;
    }
    case "video": {
      const src = (node.attrs?.src as string) ?? "";
      return `[▶ vídeo](${src})`;
    }
    case "buttonLink": {
      const href = (node.attrs?.href as string) ?? "";
      const label = (node.attrs?.label as string) ?? "Link";
      return `[${label}](${href})`;
    }
    case "mermaid":
      return "```mermaid\n" + ((node.attrs?.code as string) ?? "") + "\n```";
    case "table":
      return tableToMd(node);
    case "horizontalRule":
      return "---";
    default:
      return node.content ? blocks(node.content, depth) : inline(node.content);
  }
}

function blocks(nodes: Node[] | undefined, depth = 0): string {
  if (!nodes) return "";
  return nodes
    .map((n) => block(n, depth))
    .filter((s) => s.length > 0)
    .join("\n\n");
}

/** Documento TipTap → Markdown. */
export function docToMarkdown(doc: unknown): string {
  const d = doc as Node;
  if (!d || !d.content) return "";
  return blocks(d.content).trim() + "\n";
}
