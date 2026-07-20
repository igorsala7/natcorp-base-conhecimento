/**
 * Motor de blocos — modelo de dados (isomórfico: usado no servidor, no cliente
 * e no script de migração; NÃO importar "server-only" aqui).
 *
 * Um artigo é um `BlockDoc = { version: 2, blocks: Block[] }`. Cada bloco é um
 * objeto JSON independente `{ id, type, text?, data?, styles?, children? }`.
 * O editor gerencia essa árvore como estado (JSON State), não HTML.
 *
 * Texto formatado (inline) é um array de spans `{ text, marks? }` — 1:1 com o
 * leaf do TipTap `{type:"text", text, marks}`, o que torna o conversor uma
 * renomeação quase sem perda e a leitura de texto puro trivial.
 */
import { z } from "zod";

// ── Inline (texto formatado) ────────────────────────────────────────────────

export type Mark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "strike" }
  | { type: "code" }
  | { type: "kbd" }
  | { type: "highlight"; color?: string }
  | { type: "color"; color: string }
  | { type: "link"; href: string };

export type InlineSpan = { text: string; marks?: Mark[] };
export type RichText = InlineSpan[];

// ── Estilos por bloco (escala de tokens, nunca px cru) ──────────────────────

export type SpaceScale = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type StyleBg = "none" | "purple" | "pink" | "blue" | "gray" | "dark";
export type StyleRadius = "none" | "sm" | "md" | "lg" | "xl" | "2xl";
export type StyleAlign = "left" | "center" | "right";
export type StyleFontSize = "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl";
export type StyleBorderWidth = 0 | 1 | 2 | 4 | 8;
export type StyleBorderColor = "border" | "primary" | "pink" | "blue" | "gray" | "dark";
/** Largura da região dentro da página. */
export type StyleWidth = "auto" | "half" | "third" | "twoThirds" | "threeQuarters" | "full";

export type BlockStyles = {
  paddingX?: SpaceScale;
  paddingY?: SpaceScale;
  marginY?: SpaceScale;
  bgColor?: StyleBg;
  borderRadius?: StyleRadius;
  /** Alinhamento do TEXTO dentro da região. */
  align?: StyleAlign;
  fontSize?: StyleFontSize;
  borderWidth?: StyleBorderWidth;
  borderColor?: StyleBorderColor;
  /** Tamanho horizontal da região. */
  width?: StyleWidth;
  /** Altura mínima da região. */
  minHeight?: SpaceScale;
  /** Onde a região fica na página (quando não ocupa a largura toda). */
  justify?: StyleAlign;
  /** Ícone exibido no título/topo da região (chave do catálogo). */
  icon?: string;
};

// ── Tipos de bloco ──────────────────────────────────────────────────────────

export type BlockType =
  | "paragraph"
  | "heading"
  | "bulletList"
  | "orderedList"
  | "listItem"
  | "quote"
  | "divider"
  | "code"
  | "image"
  | "video"
  | "embed"
  | "button"
  | "callout"
  | "steps"
  | "step"
  | "accordion"
  | "accordionItem"
  | "tabs"
  | "tab"
  | "toggle"
  | "container"
  | "column"
  | "panel"
  | "cardGrid"
  | "card"
  | "hero"
  | "spacer"
  | "table"
  | "mermaid"
  | "snippet";

// Dados (payload) por tipo. Blocos sem payload omitem `data`.
export type HeadingLevel = 1 | 2 | 3;
export type CalloutVariant = "info" | "warning" | "success" | "danger";
export type PanelBg = "purple" | "pink" | "blue" | "gray";
export type HeroBg = "purple" | "blue" | "gray" | "dark";
export type ButtonVariant = "primary" | "secondary";
export type VideoProvider = "youtube" | "vimeo" | "upload";
export type SpacerSize = "sm" | "md" | "lg";
export type EmbedProvider =
  | "youtube"
  | "vimeo"
  | "loom"
  | "figma"
  | "googlemaps"
  | "twitter"
  | "gist"
  | "pdf"
  | "link"
  | "raw";

export type HeadingData = { level: HeadingLevel };
export type CodeData = { language: string | null; code: string };
export type ImageData = { src: string; alt: string; caption: string };
export type VideoData = { provider: VideoProvider; url: string };
export type EmbedData = {
  provider: EmbedProvider;
  url: string;
  embedUrl?: string;
  html?: string;
  title?: string;
  description?: string;
};
export type ButtonData = { label: string; href: string; variant: ButtonVariant };
export type CalloutData = { variant: CalloutVariant };
export type AccordionItemData = { title: string };
export type TabData = { label: string };
export type ToggleData = { title: string };
/**
 * Região dividida em colunas. `ratios` dá a proporção de cada divisão (ex.:
 * [1,2] = imagem estreita à esquerda + texto largo à direita); `divider`
 * desenha a linha separadora entre as divisões.
 */
export type ContainerData = { columns: number; ratios?: number[]; divider?: boolean };
export type PanelData = { bg: PanelBg };
export type CardGridData = { cols: number };
export type CardData = { icon: string; title: string; href: string };
export type HeroData = {
  eyebrow: string;
  title: string;
  subtitle: string;
  bg: HeroBg;
};
export type SpacerData = { size: SpacerSize };
export type TableData = { rows: RichText[][]; hasHeader: boolean };
export type MermaidData = { code: string };
export type SnippetData = { snippetKey: string };

// Bloco base comum a todos.
type BlockBase = { id: string; styles?: BlockStyles };

// União discriminada. `text` presente em blocos com texto; `children` em
// contêineres; `data` no payload tipado por tipo.
export type Block =
  | (BlockBase & { type: "paragraph"; text: RichText })
  | (BlockBase & { type: "heading"; text: RichText; data: HeadingData })
  | (BlockBase & { type: "bulletList"; children: Block[] })
  | (BlockBase & { type: "orderedList"; children: Block[] })
  | (BlockBase & { type: "listItem"; text: RichText; children?: Block[] })
  | (BlockBase & { type: "quote"; text: RichText })
  | (BlockBase & { type: "divider" })
  | (BlockBase & { type: "code"; data: CodeData })
  | (BlockBase & { type: "image"; data: ImageData })
  | (BlockBase & { type: "video"; data: VideoData })
  | (BlockBase & { type: "embed"; data: EmbedData })
  | (BlockBase & { type: "button"; data: ButtonData })
  | (BlockBase & { type: "callout"; data: CalloutData; children: Block[] })
  | (BlockBase & { type: "steps"; children: Block[] })
  | (BlockBase & { type: "step"; children: Block[] })
  | (BlockBase & { type: "accordion"; children: Block[] })
  | (BlockBase & { type: "accordionItem"; data: AccordionItemData; children: Block[] })
  | (BlockBase & { type: "tabs"; children: Block[] })
  | (BlockBase & { type: "tab"; data: TabData; children: Block[] })
  | (BlockBase & { type: "toggle"; data: ToggleData; children: Block[] })
  | (BlockBase & { type: "container"; data: ContainerData; children: Block[] })
  | (BlockBase & { type: "column"; children: Block[] })
  | (BlockBase & { type: "panel"; data: PanelData; children: Block[] })
  | (BlockBase & { type: "cardGrid"; data: CardGridData; children: Block[] })
  | (BlockBase & { type: "card"; data: CardData; children: Block[] })
  | (BlockBase & { type: "hero"; data: HeroData })
  | (BlockBase & { type: "spacer"; data: SpacerData })
  | (BlockBase & { type: "table"; data: TableData })
  | (BlockBase & { type: "mermaid"; data: MermaidData })
  | (BlockBase & { type: "snippet"; data: SnippetData });

export type BlockDoc = { version: 2; blocks: Block[] };

/** Blocos que contêm outros blocos (aceitam `children`). */
export const CONTAINER_TYPES: ReadonlySet<BlockType> = new Set<BlockType>([
  "bulletList",
  "orderedList",
  "listItem",
  "callout",
  "steps",
  "step",
  "accordion",
  "accordionItem",
  "tabs",
  "tab",
  "toggle",
  "container",
  "column",
  "panel",
  "cardGrid",
  "card",
]);

export function isContainerType(t: BlockType): boolean {
  return CONTAINER_TYPES.has(t);
}

// ── Zod (validação em runtime na fronteira de persistência) ─────────────────
//
// Permissivo de propósito: valida o formato geral (version, blocos com id/type,
// spans bem-formados) sem duplicar a união discriminada acima. `data` fica como
// objeto livre — a tipagem forte vive nos tipos TS; o Zod só barra lixo.

const MarkSchema: z.ZodType<Mark> = z.union([
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({ type: z.literal("strike") }),
  z.object({ type: z.literal("code") }),
  z.object({ type: z.literal("kbd") }),
  z.object({ type: z.literal("highlight"), color: z.string().optional() }),
  z.object({ type: z.literal("color"), color: z.string() }),
  z.object({ type: z.literal("link"), href: z.string() }),
]);

export const InlineSpanSchema = z.object({
  text: z.string(),
  marks: z.array(MarkSchema).optional(),
});

export const RichTextSchema = z.array(InlineSpanSchema);

export const BlockStylesSchema = z.object({
  paddingX: z.number().int().min(0).max(6).optional(),
  paddingY: z.number().int().min(0).max(6).optional(),
  marginY: z.number().int().min(0).max(6).optional(),
  bgColor: z.enum(["none", "purple", "pink", "blue", "gray", "dark"]).optional(),
  borderRadius: z.enum(["none", "sm", "md", "lg", "xl", "2xl"]).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  fontSize: z.enum(["xs", "sm", "base", "lg", "xl", "2xl", "3xl"]).optional(),
  borderWidth: z.number().int().min(0).max(8).optional(),
  borderColor: z.enum(["border", "primary", "pink", "blue", "gray", "dark"]).optional(),
  width: z.enum(["auto", "half", "third", "twoThirds", "threeQuarters", "full"]).optional(),
  minHeight: z.number().int().min(0).max(6).optional(),
  justify: z.enum(["left", "center", "right"]).optional(),
  icon: z.string().max(40).optional(),
});

const BLOCK_TYPES: [BlockType, ...BlockType[]] = [
  "paragraph", "heading", "bulletList", "orderedList", "listItem", "quote",
  "divider", "code", "image", "video", "embed", "button", "callout", "steps",
  "step", "accordion", "accordionItem", "tabs", "tab", "toggle", "container",
  "column", "panel", "cardGrid", "card", "hero", "spacer", "table", "mermaid",
  "snippet",
];

type ZodBlock = {
  id: string;
  type: BlockType;
  text?: RichText;
  data?: Record<string, unknown>;
  styles?: z.infer<typeof BlockStylesSchema>;
  children?: ZodBlock[];
};

export const BlockSchema: z.ZodType<ZodBlock> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.enum(BLOCK_TYPES),
    text: RichTextSchema.optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    styles: BlockStylesSchema.optional(),
    children: z.array(BlockSchema).optional(),
  }),
);

export const BlockDocSchema = z.object({
  version: z.literal(2),
  blocks: z.array(BlockSchema),
});

/** Documento vazio padrão. */
export function emptyDoc(): BlockDoc {
  return { version: 2, blocks: [] };
}

/** Type-guard leve: já é um BlockDoc v2? */
export function isBlockDoc(x: unknown): x is BlockDoc {
  return (
    !!x &&
    typeof x === "object" &&
    (x as { version?: unknown }).version === 2 &&
    Array.isArray((x as { blocks?: unknown }).blocks)
  );
}

/** Gera um id de bloco (crypto.randomUUID — sem pacote uuid). */
export function newId(): string {
  return crypto.randomUUID();
}
