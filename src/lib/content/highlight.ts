import { createLowlight, common } from "lowlight";

const lowlight = createLowlight(common);

type HNode =
  | { type: "root"; children: HNode[] }
  | { type: "element"; tagName: string; properties?: { className?: string[] }; children: HNode[] }
  | { type: "text"; value: string };

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** Serializa o hast do lowlight em HTML (só spans + texto escapado). */
function toHtml(node: HNode): string {
  if (node.type === "text") return esc(node.value);
  if (node.type === "element") {
    const cls = (node.properties?.className ?? []).join(" ");
    const inner = node.children.map(toHtml).join("");
    return `<span class="${esc(cls)}">${inner}</span>`;
  }
  return node.children.map(toHtml).join(""); // root
}

/**
 * Realça código no servidor com lowlight → HTML seguro (spans .hljs-*).
 * As classes já têm estilo em globals.css. Retorna null se falhar/sem código.
 */
export function highlightCode(code: string, language?: string | null): string | null {
  if (!code) return null;
  try {
    const tree =
      language && lowlight.registered(language)
        ? lowlight.highlight(language, code)
        : lowlight.highlightAuto(code);
    return toHtml(tree as unknown as HNode);
  } catch {
    return null;
  }
}
