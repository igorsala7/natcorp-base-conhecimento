/**
 * Conversor TipTap (ProseMirror) → blocos v2. Isomórfico e puro (sem
 * "server-only"), para o script de migração poder importar.
 *
 * `normalizeDoc` é o ponto de entrada em todo read boundary: se já for v2,
 * valida e devolve; senão converte. É idempotente (rodar duas vezes é no-op).
 * `convertNode` é TOTAL: todo tipo do TipTap tem caso; o `default` nunca
 * descarta conteúdo (vira parágrafo com o texto extraído).
 */
import {
  type Block,
  type BlockDoc,
  type Mark,
  type RichText,
  type HeadingLevel,
  type CalloutVariant,
  type PanelBg,
  type HeroBg,
  type ButtonVariant,
  type VideoProvider,
  type SpacerSize,
  emptyDoc,
  isBlockDoc,
  newId,
} from "./schema";

type TNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

// ── helpers ─────────────────────────────────────────────────────────────────

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/** Texto puro de um nó (concatena text nodes). */
function textOf(node: TNode): string {
  if (typeof node.text === "string") return node.text;
  return (node.content ?? []).map(textOf).join("");
}

// ── inline: text nodes + marks → spans ──────────────────────────────────────

function convertMarks(marks: TNode["marks"]): Mark[] | undefined {
  if (!marks || marks.length === 0) return undefined;
  const out: Mark[] = [];
  for (const m of marks) {
    switch (m.type) {
      case "bold":
        out.push({ type: "bold" });
        break;
      case "italic":
        out.push({ type: "italic" });
        break;
      case "strike":
        out.push({ type: "strike" });
        break;
      case "code":
        out.push({ type: "code" });
        break;
      case "kbd":
        out.push({ type: "kbd" });
        break;
      case "highlight": {
        const color = str(m.attrs?.color);
        out.push(color ? { type: "highlight", color } : { type: "highlight" });
        break;
      }
      case "textStyle": {
        const color = str(m.attrs?.color);
        if (color) out.push({ type: "color", color });
        break;
      }
      case "link":
        out.push({ type: "link", href: str(m.attrs?.href, "#") });
        break;
      // marks desconhecidas: ignoradas (texto preservado)
    }
  }
  return out.length ? out : undefined;
}

/** Nós inline (text/hardBreak/…) → RichText. */
export function convertInline(nodes: TNode[] | undefined): RichText {
  const spans: RichText = [];
  const walk = (n: TNode) => {
    if (n.type === "hardBreak") {
      spans.push({ text: "\n" });
      return;
    }
    if (typeof n.text === "string") {
      if (n.text.length === 0) return;
      const marks = convertMarks(n.marks);
      spans.push(marks ? { text: n.text, marks } : { text: n.text });
      return;
    }
    // inline aninhado desconhecido → desce nos filhos
    (n.content ?? []).forEach(walk);
  };
  (nodes ?? []).forEach(walk);
  return spans;
}

// ── blocos ──────────────────────────────────────────────────────────────────

function convertNodes(nodes: TNode[] | undefined): Block[] {
  return (nodes ?? []).flatMap(convertNode);
}

/** Filhos de um contêiner (ex.: callout/panel) — garante ao menos 1 parágrafo. */
function containerChildren(node: TNode): Block[] {
  const kids = convertNodes(node.content);
  return kids.length ? kids : [{ id: newId(), type: "paragraph", text: [] }];
}

function headingLevel(node: TNode): HeadingLevel {
  const raw = Number(node.attrs?.level) || 1;
  return (raw <= 1 ? 1 : raw === 2 ? 2 : 3) as HeadingLevel;
}

/** Um nó do TipTap → 0..n blocos. Total (todo tipo tratado). */
export function convertNode(node: TNode): Block[] {
  const t = node.type;
  switch (t) {
    case "paragraph":
      return [{ id: newId(), type: "paragraph", text: convertInline(node.content) }];

    case "heading":
      return [
        {
          id: newId(),
          type: "heading",
          text: convertInline(node.content),
          data: { level: headingLevel(node) },
        },
      ];

    case "bulletList":
      return [{ id: newId(), type: "bulletList", children: convertNodes(node.content) }];
    case "orderedList":
      return [{ id: newId(), type: "orderedList", children: convertNodes(node.content) }];

    case "listItem": {
      // listItem = [paragraph, (lista aninhada|extras)?]. Texto = 1º parágrafo;
      // o resto (listas aninhadas, parágrafos extras) vira children.
      const content = node.content ?? [];
      const firstP = content.find((c) => c.type === "paragraph");
      const text = firstP ? convertInline(firstP.content) : convertInline(content);
      const rest = content.filter((c) => c !== firstP);
      const children = convertNodes(rest);
      const item: Block = children.length
        ? { id: newId(), type: "listItem", text, children }
        : { id: newId(), type: "listItem", text };
      return [item];
    }

    case "blockquote": {
      // quote guarda RichText; junta os parágrafos com quebra de linha.
      const paras = (node.content ?? []).filter((c) => c.type === "paragraph");
      const src = paras.length ? paras : [node];
      const text: RichText = [];
      src.forEach((p, i) => {
        if (i > 0) text.push({ text: "\n" });
        text.push(...convertInline(p.content));
      });
      return [{ id: newId(), type: "quote", text }];
    }

    case "horizontalRule":
      return [{ id: newId(), type: "divider" }];

    case "codeBlock":
      return [
        {
          id: newId(),
          type: "code",
          data: { language: str(node.attrs?.language) || null, code: textOf(node) },
        },
      ];

    case "table":
      return [convertTable(node)];

    case "callout":
      return [
        {
          id: newId(),
          type: "callout",
          data: { variant: (str(node.attrs?.variant, "info") as CalloutVariant) },
          children: containerChildren(node),
        },
      ];

    case "steps":
      return [{ id: newId(), type: "steps", children: convertNodes(node.content) }];
    case "stepItem":
      return [{ id: newId(), type: "step", children: containerChildren(node) }];

    case "accordion":
      return [{ id: newId(), type: "accordion", children: convertNodes(node.content) }];
    case "accordionItem":
      return [
        {
          id: newId(),
          type: "accordionItem",
          data: { title: str(node.attrs?.title, "Seção") },
          children: containerChildren(node),
        },
      ];

    case "tabs":
      return [{ id: newId(), type: "tabs", children: convertNodes(node.content) }];
    case "tabItem":
      return [
        {
          id: newId(),
          type: "tab",
          data: { label: str(node.attrs?.label, "Aba") },
          children: containerChildren(node),
        },
      ];

    case "toggle":
      return [
        {
          id: newId(),
          type: "toggle",
          data: { title: str(node.attrs?.title, "Detalhes") },
          children: containerChildren(node),
        },
      ];

    case "columns": {
      const cols = convertNodes(node.content);
      const columns = cols.length ? cols.length : 2;
      return [
        { id: newId(), type: "container", data: { columns }, children: cols },
      ];
    }
    case "column":
      return [{ id: newId(), type: "column", children: containerChildren(node) }];

    case "panel":
      return [
        {
          id: newId(),
          type: "panel",
          data: { bg: (str(node.attrs?.bg, "purple") as PanelBg) },
          children: containerChildren(node),
        },
      ];

    case "cardGrid": {
      const cols = Number(node.attrs?.cols) || 3;
      return [
        {
          id: newId(),
          type: "cardGrid",
          data: { cols },
          children: convertNodes(node.content),
        },
      ];
    }
    case "card":
      return [
        {
          id: newId(),
          type: "card",
          data: {
            icon: str(node.attrs?.icon, "book"),
            title: str(node.attrs?.title),
            href: str(node.attrs?.href),
          },
          children: containerChildren(node),
        },
      ];

    case "figureImage":
    case "image":
      return [
        {
          id: newId(),
          type: "image",
          data: {
            src: str(node.attrs?.src),
            alt: str(node.attrs?.alt),
            caption: str(node.attrs?.caption),
          },
        },
      ];

    case "video":
      return [
        {
          id: newId(),
          type: "video",
          data: {
            provider: (str(node.attrs?.provider, "youtube") as VideoProvider),
            url: str(node.attrs?.src),
          },
        },
      ];

    case "linkCard":
      return [
        {
          id: newId(),
          type: "embed",
          data: {
            provider: "link",
            url: str(node.attrs?.url, "#"),
            title: str(node.attrs?.title),
            description: str(node.attrs?.description),
          },
        },
      ];

    case "htmlEmbed":
      return [
        {
          id: newId(),
          type: "embed",
          data: { provider: "raw", url: "", html: str(node.attrs?.html) },
        },
      ];

    case "snippet":
      return [
        { id: newId(), type: "snippet", data: { snippetKey: str(node.attrs?.snippetKey) } },
      ];

    case "hero":
      return [
        {
          id: newId(),
          type: "hero",
          data: {
            eyebrow: str(node.attrs?.eyebrow),
            title: str(node.attrs?.title),
            subtitle: str(node.attrs?.subtitle),
            bg: (str(node.attrs?.bg, "purple") as HeroBg),
          },
        },
      ];

    case "spacer":
      return [
        { id: newId(), type: "spacer", data: { size: (str(node.attrs?.size, "md") as SpacerSize) } },
      ];

    case "mermaid":
      return [{ id: newId(), type: "mermaid", data: { code: str(node.attrs?.code) } }];

    case "buttonLink":
      return [
        {
          id: newId(),
          type: "button",
          data: {
            label: str(node.attrs?.label, "Saiba mais"),
            href: str(node.attrs?.href, "#"),
            variant: (str(node.attrs?.variant, "primary") as ButtonVariant),
          },
        },
      ];

    // itens de lista/tabela chegam via seus pais; se aparecerem soltos, viram texto
    case "hardBreak":
      return [];

    default: {
      // Tipo desconhecido: nunca descarta — vira parágrafo com o texto extraído.
      const text = textOf(node);
      if (!text && !(node.content ?? []).length) return [];
      const inline = convertInline(node.content);
      return [
        { id: newId(), type: "paragraph", text: inline.length ? inline : text ? [{ text }] : [] },
      ];
    }
  }
}

function convertTable(node: TNode): Block {
  const trs = (node.content ?? []).filter((r) => r.type === "tableRow");
  const rows: RichText[][] = trs.map((row) =>
    (row.content ?? []).map((cell) => {
      // célula = parágrafos; achata a inline de todos num RichText só.
      const paras = cell.content ?? [];
      const text: RichText = [];
      paras.forEach((p, i) => {
        if (i > 0) text.push({ text: "\n" });
        text.push(...convertInline(p.content ?? [p]));
      });
      return text;
    }),
  );
  const firstRow = trs[0];
  const hasHeader = !!firstRow && (firstRow.content ?? []).some((c) => c.type === "tableHeader");
  return { id: newId(), type: "table", data: { rows, hasHeader } };
}

// ── entrypoints ──────────────────────────────────────────────────────────────

/** Documento TipTap `{type:"doc",content}` → BlockDoc v2. */
export function convertTipTapDoc(doc: unknown): BlockDoc {
  const d = doc as TNode | null;
  if (!d || typeof d !== "object") return emptyDoc();
  return { version: 2, blocks: convertNodes(d.content) };
}

/**
 * Normaliza qualquer conteúdo persistido para BlockDoc v2. Idempotente:
 * - já v2 → devolve como está;
 * - TipTap/legado/null → converte.
 */
export function normalizeDoc(raw: unknown): BlockDoc {
  if (isBlockDoc(raw)) return raw;
  if (raw == null) return emptyDoc();
  return convertTipTapDoc(raw);
}
