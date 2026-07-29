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
  | "breadcrumb"
  | "divider"
  | "code"
  | "image"
  | "video"
  | "file"
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
  | "chart"
  | "flow"
  | "mindmap"
  | "snippet"
  | "checklist"
  | "stats";

// Dados (payload) por tipo. Blocos sem payload omitem `data`.
export type HeadingLevel = 1 | 2 | 3;
export type CalloutVariant = "info" | "warning" | "success" | "danger" | "note";

/**
 * Rótulo do cabeçalho de cada variante de callout (padrão Microsoft Learn:
 * NOTA/DICA/ATENÇÃO/CUIDADO). Fonte única — portal e editor mostram o mesmo.
 */
export const CALLOUT_ROTULO: Record<CalloutVariant, string> = {
  info: "Nota",
  success: "Dica",
  warning: "Atenção",
  danger: "Cuidado",
  note: "Observação",
};
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
export type CodeData = { language: string | null; code: string; filename?: string };
export type ImageData = {
  src: string;
  alt: string;
  caption: string;
  /** Tamanho da referência: ausente = natural; wide = 36rem; medium = 24rem. */
  size?: "wide" | "medium";
};
/** Autor/fonte exibido sob a citação (opcional). */
export type QuoteData = { author?: string };
/** Título curto do passo, acima do conteúdo livre (opcional). */
export type StepData = { title?: string };
export type VideoData = { provider: VideoProvider; url: string };
/** Arquivo para download (upload no assets ou URL externa). `size` em bytes (0 = desconhecido). */
export type FileData = { url: string; name: string; size: number };
export type EmbedData = {
  provider: EmbedProvider;
  url: string;
  embedUrl?: string;
  html?: string;
  title?: string;
  description?: string;
};
export type ButtonData = { label: string; href: string; variant: ButtonVariant };
export type CalloutData = { variant: CalloutVariant; title?: string };
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
/** Paleta de cor de fundo de célula de tabela (tints leves, texto escuro legível). */
export type TableColor = "purple" | "pink" | "blue" | "green" | "amber" | "gray";
export type TableData = {
  rows: RichText[][];
  hasHeader: boolean;
  /** Cor de fundo por célula, paralela a `rows` (ausente/null = sem cor). */
  cellColors?: (TableColor | null)[][];
  /** Bordas: grade completa · só linhas horizontais (padrão) · nenhuma. */
  borders?: "all" | "rows" | "none";
  /** Zebra nas linhas (padrão ligado). */
  striped?: boolean;
};
export type MermaidData = { code: string };

// ── Fluxograma (renderizador de nós próprio) ────────────────────────────────
// Modelo abstrato nós + arestas; o LAYOUT é automático (flow-layout.ts), então
// a IA e o editor só descrevem a estrutura — não coordenadas.
export type FlowNodeType =
  | "start" // início (pílula)
  | "end" // fim (pílula)
  | "process" // etapa (retângulo arredondado)
  | "decision" // decisão (losango)
  | "io" // entrada/saída (paralelogramo)
  | "subroutine"; // sub-rotina (retângulo com barras)
/** Onde o ícone fica em relação ao texto do nó. */
export type FlowIconPos = "top" | "left" | "right" | "bottom";
export type FlowNodeStyle = {
  bold?: boolean;
  italic?: boolean;
  fontColor?: string; // hex do texto
  bg?: string; // hex do preenchimento
  borderColor?: string; // hex da borda
  borderWidth?: number; // px (0–6)
  icon?: string; // chave do catálogo de ícones
  iconImage?: string; // URL de imagem enviada (tem prioridade sobre `icon`)
  iconPos?: FlowIconPos;
};
export type FlowNode = {
  id: string;
  type: FlowNodeType;
  label: string;
  /** Posição FIXADA (após arrastar). Ausente = layout automático. */
  x?: number;
  y?: number;
  style?: FlowNodeStyle;
};

export type FlowEdgeShape = "bezier" | "straight" | "step" | "arc";
export type FlowArrows = "end" | "both" | "none";
export type FlowEdgeStyle = {
  shape?: FlowEdgeShape; // flexível(bezier) · reto · cotovelo · arco
  color?: string;
  width?: number; // px (1–5)
  arrows?: FlowArrows; // uma ponta · ambas · nenhuma
  arrowSize?: number; // px (6–16)
};
export type FlowEdge = { id: string; from: string; to: string; label?: string; style?: FlowEdgeStyle };
export type FlowDirection = "TB" | "LR";
export type FlowData = { nodes: FlowNode[]; edges: FlowEdge[]; direction?: FlowDirection };

export const FLOW_NODE_LABEL: Record<FlowNodeType, string> = {
  start: "Início",
  end: "Fim",
  process: "Processo",
  decision: "Decisão",
  io: "Entrada/Saída",
  subroutine: "Sub-rotina",
};

// ── Gráficos (Recharts) ─────────────────────────────────────────────────────
// Modelo agnóstico ao tipo: os DADOS (colunas/linhas) ficam separados do TIPO,
// então trocar o tipo NÃO perde os dados. `series` são as colunas plotadas (Y).
export type ChartType =
  | "column" // barras verticais
  | "bar" // barras horizontais
  | "line"
  | "area"
  | "stackedColumn"
  | "stackedArea"
  | "pie"
  | "donut"
  | "scatter"
  | "bubble" // dispersão com Z = tamanho da bolha
  | "radar"
  | "combo"; // colunas + linha

export type ChartValue = string | number;
export type ChartRow = Record<string, ChartValue>;
export type ChartColumn = { key: string; label: string };
export type ChartSeries = { key: string; label: string; color?: string };
export type ChartData = {
  chartType: ChartType;
  title?: string;
  columns: ChartColumn[]; // cabeçalhos das colunas dos dados
  rows: ChartRow[]; // uma entrada por chave de coluna
  xKey: string; // coluna de categoria / eixo X
  series: ChartSeries[]; // colunas plotadas (Y)
  zKey?: string; // coluna Z (tamanho da bolha, só bubble)
  showMedian?: boolean; // linha de mediana (barras/colunas/linha/área/combo)
  showTrend?: boolean; // linha de tendência (regressão da 1ª série; colunas/linha/área)
  legend?: boolean;
  grid?: boolean;
};

/** Catálogo dos tipos (rótulo + submenu do slash). Ordem = ordem de exibição. */
export const CHART_TYPES: { type: ChartType; label: string }[] = [
  { type: "column", label: "Colunas" },
  { type: "bar", label: "Barras" },
  { type: "line", label: "Linha" },
  { type: "area", label: "Área" },
  { type: "stackedColumn", label: "Colunas empilhadas" },
  { type: "stackedArea", label: "Área empilhada" },
  { type: "combo", label: "Combo (colunas + linha)" },
  { type: "pie", label: "Pizza" },
  { type: "donut", label: "Rosca" },
  { type: "scatter", label: "Dispersão" },
  { type: "bubble", label: "Bolhas (X·Y·Z)" },
  { type: "radar", label: "Radar" },
];

/** Bubble usa Z como tamanho. */
export function chartSupportsZ(t: ChartType): boolean {
  return t === "bubble";
}
/** Mediana faz sentido em eixos numéricos cartesianos (não em pizza/rosca/radar). */
export function chartSupportsMedian(t: ChartType): boolean {
  return ["column", "bar", "line", "area", "stackedColumn", "stackedArea", "combo"].includes(t);
}
/** Pizza/rosca usam UMA série (a 1ª). */
export function chartIsCircular(t: ChartType): boolean {
  return t === "pie" || t === "donut";
}
// ── Mapa mental (MindMap — árvore interativa) ───────────────────────────────
// Árvore de nós (raiz + filhos, recursivo). O LAYOUT é automático
// (mindmap-layout.ts); a IA e o editor só descrevem a hierarquia. Interativo no
// leitor: expandir/retrair, zoom e tela cheia.
export type MindMapNode = {
  id: string;
  label: string;
  note?: string; // detalhe/descrição (tooltip no leitor, painel no editor)
  link?: string; // URL — o nó abre em nova aba
  icon?: string; // chave do catálogo de ícones (ICONS)
  color?: string; // hex do acento/borda do nó
  bg?: string; // hex do preenchimento do nó
  collapsed?: boolean; // começa retraído (filhos ocultos)
  children?: MindMapNode[];
};
export type MindMapDirection = "LR" | "TB"; // raiz à esquerda (padrão) ou no topo
export type MindMapData = { root: MindMapNode; direction?: MindMapDirection };

/** Item de checklist: texto RICO (negrito/código/link) como as células da tabela. */
export type ChecklistItem = { id: string; text: RichText; checked: boolean };
export type ChecklistData = { items: ChecklistItem[] };
/** Indicadores/KPIs: cartões de valor + rótulo + detalhe. */
export type StatItem = { id: string; value: string; label: string; trend: string };
export type StatsData = { items: StatItem[] };
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
  | (BlockBase & { type: "quote"; text: RichText; data?: QuoteData })
  | (BlockBase & { type: "breadcrumb"; text: RichText })
  | (BlockBase & { type: "divider" })
  | (BlockBase & { type: "code"; data: CodeData })
  | (BlockBase & { type: "image"; data: ImageData })
  | (BlockBase & { type: "video"; data: VideoData })
  | (BlockBase & { type: "file"; data: FileData })
  | (BlockBase & { type: "embed"; data: EmbedData })
  | (BlockBase & { type: "button"; data: ButtonData })
  | (BlockBase & { type: "callout"; data: CalloutData; children: Block[] })
  | (BlockBase & { type: "steps"; children: Block[] })
  | (BlockBase & { type: "step"; data?: StepData; children: Block[] })
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
  | (BlockBase & { type: "chart"; data: ChartData })
  | (BlockBase & { type: "flow"; data: FlowData })
  | (BlockBase & { type: "mindmap"; data: MindMapData })
  | (BlockBase & { type: "snippet"; data: SnippetData })
  | (BlockBase & { type: "checklist"; data: ChecklistData })
  | (BlockBase & { type: "stats"; data: StatsData });

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
  "paragraph", "heading", "bulletList", "orderedList", "listItem", "quote", "breadcrumb",
  "divider", "code", "image", "video", "file", "embed", "button", "callout", "steps",
  "step", "accordion", "accordionItem", "tabs", "tab", "toggle", "container",
  "column", "panel", "cardGrid", "card", "hero", "spacer", "table", "mermaid",
  "chart", "flow", "mindmap", "snippet", "checklist", "stats",
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
