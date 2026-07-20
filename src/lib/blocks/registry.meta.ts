/**
 * Metadados dos blocos (isomórfico) — fonte única para slash menu, menu de
 * contexto ⋮⋮ e painel de propriedades. NÃO contém JSX: os componentes de
 * render (servidor) vivem em `render.tsx`; os de edição (cliente) em
 * `registry.edit.tsx`. Ambos são chaveados por este mesmo `BlockType`, com
 * `satisfies Record<BlockType, …>` garantindo exaustividade em compilação.
 *
 * Serialização (texto/markdown/html) fica centralizada em `serialize.ts`.
 */
import {
  AlignLeft,
  Heading,
  List,
  ListOrdered,
  Quote,
  Minus,
  Code2,
  Image as ImageIcon,
  Video,
  Globe,
  MousePointerClick,
  Info,
  ListChecks,
  ChevronDown,
  PanelTop,
  Columns3,
  Square,
  LayoutGrid,
  Sparkles,
  Space,
  Table as TableIcon,
  Workflow,
  Puzzle,
  type LucideIcon,
} from "lucide-react";
import {
  type Block,
  type BlockType,
  isContainerType,
  newId,
} from "./schema";

export type BlockCategory =
  | "basico"
  | "layout"
  | "midia"
  | "avancado"
  | "integracao"
  | "importar"
  | "dados";

export type BlockMeta = {
  type: BlockType;
  label: string;
  keywords: string[];
  icon: LucideIcon;
  category: BlockCategory;
  isContainer: boolean;
  isVoid: boolean; // sem texto e sem filhos editáveis (image/embed/divider/…)
  transformableTo: BlockType[];
  defaultData: () => Block;
};

// Categorias na ordem em que aparecem no slash menu.
export const CATEGORIES: { key: BlockCategory; label: string; comingSoon?: boolean }[] = [
  { key: "basico", label: "Básicos" },
  { key: "layout", label: "Layout" },
  { key: "midia", label: "Mídia / Embeds" },
  { key: "avancado", label: "Avançados" },
  { key: "integracao", label: "Integrações" },
  { key: "importar", label: "Importar" },
  { key: "dados", label: "Base de Dados", comingSoon: true },
];

// Itens "Em breve" (não são blocos reais — placeholders no slash menu).
export const COMING_SOON: { label: string; keywords: string[]; icon: LucideIcon; category: BlockCategory }[] = [
  { label: "Base de Dados", keywords: ["database", "tabela", "grade", "kanban"], icon: Workflow, category: "dados" },
  { label: "Bases de Dados Sincronizadas", keywords: ["sync", "externo", "integração"], icon: Puzzle, category: "dados" },
];

const TEXT_TRANSFORMS: BlockType[] = ["paragraph", "heading", "quote", "callout"];

// Fábricas de bloco padrão (id novo a cada chamada).
function para(): Block {
  return { id: newId(), type: "paragraph", text: [] };
}

export const BLOCKS = {
  paragraph: {
    type: "paragraph",
    label: "Texto",
    keywords: ["paragrafo", "texto", "p"],
    icon: AlignLeft,
    category: "basico",
    isContainer: false,
    isVoid: false,
    transformableTo: TEXT_TRANSFORMS,
    defaultData: para,
  },
  heading: {
    type: "heading",
    label: "Título",
    keywords: ["heading", "titulo", "h1", "h2", "h3", "cabecalho"],
    icon: Heading,
    category: "basico",
    isContainer: false,
    isVoid: false,
    transformableTo: ["paragraph", "quote"],
    defaultData: () => ({ id: newId(), type: "heading", text: [], data: { level: 2 } }),
  },
  bulletList: {
    type: "bulletList",
    label: "Lista",
    keywords: ["lista", "bullet", "marcadores", "ul"],
    icon: List,
    category: "basico",
    isContainer: true,
    isVoid: false,
    transformableTo: ["orderedList"],
    defaultData: () => ({
      id: newId(),
      type: "bulletList",
      children: [{ id: newId(), type: "listItem", text: [] }],
    }),
  },
  orderedList: {
    type: "orderedList",
    label: "Lista numerada",
    keywords: ["lista", "numerada", "ol", "ordenada"],
    icon: ListOrdered,
    category: "basico",
    isContainer: true,
    isVoid: false,
    transformableTo: ["bulletList"],
    defaultData: () => ({
      id: newId(),
      type: "orderedList",
      children: [{ id: newId(), type: "listItem", text: [] }],
    }),
  },
  listItem: {
    type: "listItem",
    label: "Item de lista",
    keywords: ["item", "li"],
    icon: List,
    category: "basico",
    isContainer: true,
    isVoid: false,
    transformableTo: [],
    defaultData: () => ({ id: newId(), type: "listItem", text: [] }),
  },
  quote: {
    type: "quote",
    label: "Citação",
    keywords: ["citacao", "quote", "blockquote"],
    icon: Quote,
    category: "basico",
    isContainer: false,
    isVoid: false,
    transformableTo: ["paragraph", "heading"],
    defaultData: () => ({ id: newId(), type: "quote", text: [] }),
  },
  divider: {
    type: "divider",
    label: "Divisória",
    keywords: ["divisoria", "linha", "hr", "separador"],
    icon: Minus,
    category: "basico",
    isContainer: false,
    isVoid: true,
    transformableTo: [],
    defaultData: () => ({ id: newId(), type: "divider" }),
  },
  code: {
    type: "code",
    label: "Código",
    keywords: ["codigo", "code", "snippet"],
    icon: Code2,
    category: "avancado",
    isContainer: false,
    isVoid: false,
    transformableTo: [],
    defaultData: () => ({ id: newId(), type: "code", data: { language: null, code: "" } }),
  },
  image: {
    type: "image",
    label: "Imagem",
    keywords: ["imagem", "image", "foto", "figura"],
    icon: ImageIcon,
    category: "midia",
    isContainer: false,
    isVoid: true,
    transformableTo: [],
    defaultData: () => ({ id: newId(), type: "image", data: { src: "", alt: "", caption: "" } }),
  },
  video: {
    type: "video",
    label: "Vídeo",
    keywords: ["video", "youtube", "vimeo"],
    icon: Video,
    category: "midia",
    isContainer: false,
    isVoid: true,
    transformableTo: [],
    defaultData: () => ({ id: newId(), type: "video", data: { provider: "youtube", url: "" } }),
  },
  embed: {
    type: "embed",
    label: "Embed",
    keywords: ["embed", "iframe", "figma", "maps", "loom", "gist", "pdf", "twitter"],
    icon: Globe,
    category: "integracao",
    isContainer: false,
    isVoid: true,
    transformableTo: [],
    defaultData: () => ({ id: newId(), type: "embed", data: { provider: "link", url: "" } }),
  },
  button: {
    type: "button",
    label: "Botão",
    keywords: ["botao", "button", "cta", "acao"],
    icon: MousePointerClick,
    category: "avancado",
    isContainer: false,
    isVoid: true,
    transformableTo: [],
    defaultData: () => ({
      id: newId(),
      type: "button",
      data: { label: "Saiba mais", href: "#", variant: "primary" },
    }),
  },
  callout: {
    type: "callout",
    label: "Destaque",
    keywords: ["callout", "aviso", "destaque", "nota", "atencao"],
    icon: Info,
    category: "avancado",
    isContainer: true,
    isVoid: false,
    transformableTo: ["paragraph"],
    defaultData: () => ({
      id: newId(),
      type: "callout",
      data: { variant: "info" },
      children: [para()],
    }),
  },
  steps: {
    type: "steps",
    label: "Passo a passo",
    keywords: ["passos", "steps", "procedimento", "tutorial"],
    icon: ListChecks,
    category: "avancado",
    isContainer: true,
    isVoid: false,
    transformableTo: [],
    defaultData: () => ({
      id: newId(),
      type: "steps",
      children: [{ id: newId(), type: "step", children: [para()] }],
    }),
  },
  step: {
    type: "step",
    label: "Passo",
    keywords: ["passo", "step"],
    icon: ListChecks,
    category: "avancado",
    isContainer: true,
    isVoid: false,
    transformableTo: [],
    defaultData: () => ({ id: newId(), type: "step", children: [para()] }),
  },
  accordion: {
    type: "accordion",
    label: "Acordeão",
    keywords: ["accordion", "acordeao", "faq", "recolhivel"],
    icon: ChevronDown,
    category: "layout",
    isContainer: true,
    isVoid: false,
    transformableTo: [],
    defaultData: () => ({
      id: newId(),
      type: "accordion",
      children: [{ id: newId(), type: "accordionItem", data: { title: "Seção" }, children: [para()] }],
    }),
  },
  accordionItem: {
    type: "accordionItem",
    label: "Item de acordeão",
    keywords: ["accordion", "item"],
    icon: ChevronDown,
    category: "layout",
    isContainer: true,
    isVoid: false,
    transformableTo: [],
    defaultData: () => ({
      id: newId(),
      type: "accordionItem",
      data: { title: "Seção" },
      children: [para()],
    }),
  },
  tabs: {
    type: "tabs",
    label: "Abas",
    keywords: ["tabs", "abas"],
    icon: PanelTop,
    category: "layout",
    isContainer: true,
    isVoid: false,
    transformableTo: [],
    defaultData: () => ({
      id: newId(),
      type: "tabs",
      children: [
        { id: newId(), type: "tab", data: { label: "Aba 1" }, children: [para()] },
        { id: newId(), type: "tab", data: { label: "Aba 2" }, children: [para()] },
      ],
    }),
  },
  tab: {
    type: "tab",
    label: "Aba",
    keywords: ["tab", "aba"],
    icon: PanelTop,
    category: "layout",
    isContainer: true,
    isVoid: false,
    transformableTo: [],
    defaultData: () => ({ id: newId(), type: "tab", data: { label: "Aba" }, children: [para()] }),
  },
  toggle: {
    type: "toggle",
    label: "Recolhível",
    keywords: ["toggle", "recolhivel", "detalhes", "spoiler"],
    icon: ChevronDown,
    category: "layout",
    isContainer: true,
    isVoid: false,
    transformableTo: [],
    defaultData: () => ({
      id: newId(),
      type: "toggle",
      data: { title: "Detalhes" },
      children: [para()],
    }),
  },
  container: {
    type: "container",
    label: "Colunas",
    keywords: ["colunas", "container", "grid", "layout", "columns"],
    icon: Columns3,
    category: "layout",
    isContainer: true,
    isVoid: false,
    transformableTo: [],
    defaultData: () => ({
      id: newId(),
      type: "container",
      data: { columns: 2 },
      children: [
        { id: newId(), type: "column", children: [para()] },
        { id: newId(), type: "column", children: [para()] },
      ],
    }),
  },
  column: {
    type: "column",
    label: "Coluna",
    keywords: ["coluna", "column"],
    icon: Square,
    category: "layout",
    isContainer: true,
    isVoid: false,
    transformableTo: [],
    defaultData: () => ({ id: newId(), type: "column", children: [para()] }),
  },
  panel: {
    type: "panel",
    label: "Painel",
    keywords: ["painel", "panel", "caixa", "destaque"],
    icon: PanelTop,
    category: "layout",
    isContainer: true,
    isVoid: false,
    transformableTo: [],
    defaultData: () => ({
      id: newId(),
      type: "panel",
      data: { bg: "purple" },
      children: [para()],
    }),
  },
  cardGrid: {
    type: "cardGrid",
    label: "Grade de cards",
    keywords: ["cards", "grade", "grid", "cardgrid"],
    icon: LayoutGrid,
    category: "layout",
    isContainer: true,
    isVoid: false,
    transformableTo: [],
    defaultData: () => ({
      id: newId(),
      type: "cardGrid",
      data: { cols: 3 },
      children: [
        { id: newId(), type: "card", data: { icon: "book", title: "Card", href: "" }, children: [para()] },
      ],
    }),
  },
  card: {
    type: "card",
    label: "Card",
    keywords: ["card", "cartao"],
    icon: Square,
    category: "layout",
    isContainer: true,
    isVoid: false,
    transformableTo: [],
    defaultData: () => ({
      id: newId(),
      type: "card",
      data: { icon: "book", title: "Card", href: "" },
      children: [para()],
    }),
  },
  hero: {
    type: "hero",
    label: "Banner (Hero)",
    keywords: ["hero", "banner", "capa", "cabecalho"],
    icon: Sparkles,
    category: "layout",
    isContainer: false,
    isVoid: true,
    transformableTo: [],
    defaultData: () => ({
      id: newId(),
      type: "hero",
      data: { eyebrow: "", title: "Título", subtitle: "", bg: "purple" },
    }),
  },
  spacer: {
    type: "spacer",
    label: "Espaçador",
    keywords: ["espaco", "spacer", "vazio"],
    icon: Space,
    category: "layout",
    isContainer: false,
    isVoid: true,
    transformableTo: [],
    defaultData: () => ({ id: newId(), type: "spacer", data: { size: "md" } }),
  },
  table: {
    type: "table",
    label: "Tabela",
    keywords: ["tabela", "table", "grade"],
    icon: TableIcon,
    category: "avancado",
    isContainer: false,
    isVoid: false,
    transformableTo: [],
    defaultData: () => ({
      id: newId(),
      type: "table",
      data: {
        hasHeader: true,
        rows: [
          [[{ text: "Coluna 1" }], [{ text: "Coluna 2" }]],
          [[], []],
        ],
      },
    }),
  },
  mermaid: {
    type: "mermaid",
    label: "Diagrama (Mermaid)",
    keywords: ["mermaid", "diagrama", "fluxograma"],
    icon: Workflow,
    category: "avancado",
    isContainer: false,
    isVoid: false,
    transformableTo: [],
    defaultData: () => ({ id: newId(), type: "mermaid", data: { code: "graph TD;\n  A-->B;" } }),
  },
  snippet: {
    type: "snippet",
    label: "Snippet reutilizável",
    keywords: ["snippet", "transclusao", "reutilizavel"],
    icon: Puzzle,
    category: "integracao",
    isContainer: false,
    isVoid: true,
    transformableTo: [],
    defaultData: () => ({ id: newId(), type: "snippet", data: { snippetKey: "" } }),
  },
} satisfies Record<BlockType, BlockMeta>;

// Blocos oferecidos no slash menu (exclui os que só existem como filhos).
const CHILD_ONLY: ReadonlySet<BlockType> = new Set<BlockType>([
  "listItem",
  "step",
  "accordionItem",
  "tab",
  "column",
  "card",
]);

export function slashBlocks(): BlockMeta[] {
  return (Object.values(BLOCKS) as BlockMeta[]).filter((b) => !CHILD_ONLY.has(b.type));
}

export function blockMeta(type: BlockType): BlockMeta {
  return BLOCKS[type];
}

/** Regra de aninhamento: `child` pode ser filho de `parent`? */
export function canNest(parent: BlockType, child: BlockType): boolean {
  if (!isContainerType(parent)) return false;
  // Contêineres estruturais só aceitam seu filho específico.
  const strict: Partial<Record<BlockType, BlockType>> = {
    bulletList: "listItem",
    orderedList: "listItem",
    steps: "step",
    accordion: "accordionItem",
    tabs: "tab",
    container: "column",
    cardGrid: "card",
  };
  const required = strict[parent];
  if (required) return child === required;
  // column/panel/callout/toggle/step/card/listItem/accordionItem/tab: qualquer
  // bloco de conteúdo, menos os "child-only" de outra estrutura.
  return !CHILD_ONLY.has(child) || child === "listItem";
}
