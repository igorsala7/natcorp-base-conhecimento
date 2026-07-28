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
  FileDown,
  AlignLeft,
  Heading,
  List,
  ListOrdered,
  Quote,
  Milestone,
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
  CheckSquare,
  BarChart3,
  Waypoints,
  Network,
} from "lucide-react";
import {
  type Block,
  type BlockType,
  type ChartType,
  isContainerType,
  newId,
} from "./schema";

/** Mapa mental de exemplo (tema central + 3 ramos). */
export function mapaMentalPadrao(): Block {
  return {
    id: newId(),
    type: "mindmap",
    data: {
      root: {
        id: newId(),
        label: "Tema central",
        children: [
          { id: newId(), label: "Ramo 1", children: [{ id: newId(), label: "Detalhe" }] },
          { id: newId(), label: "Ramo 2" },
          { id: newId(), label: "Ramo 3" },
        ],
      },
    },
  };
}

/** Fluxograma de exemplo (início → tarefa → decisão → correção/fim). */
export function fluxoPadrao(): Block {
  return {
    id: newId(),
    type: "flow",
    data: {
      nodes: [
        { id: "n1", type: "start", label: "Início" },
        { id: "n2", type: "process", label: "Executar a tarefa" },
        { id: "n3", type: "decision", label: "Deu certo?" },
        { id: "n4", type: "process", label: "Concluir" },
        { id: "n5", type: "process", label: "Corrigir" },
        { id: "n6", type: "end", label: "Fim" },
      ],
      edges: [
        { id: "e1", from: "n1", to: "n2" },
        { id: "e2", from: "n2", to: "n3" },
        { id: "e3", from: "n3", to: "n4", label: "Sim" },
        { id: "e4", from: "n3", to: "n5", label: "Não" },
        { id: "e5", from: "n4", to: "n6" },
        { id: "e6", from: "n5", to: "n2" },
      ],
    },
  };
}

/** Gráfico com dados de exemplo. Trocar o tipo depois preserva os dados. */
export function graficoPadrao(chartType: ChartType): Block {
  return {
    id: newId(),
    type: "chart",
    data: {
      chartType,
      title: "",
      columns: [
        { key: "categoria", label: "Categoria" },
        { key: "serie1", label: "Série 1" },
        { key: "serie2", label: "Série 2" },
      ],
      rows: [
        { categoria: "Jan", serie1: 120, serie2: 90 },
        { categoria: "Fev", serie1: 150, serie2: 130 },
        { categoria: "Mar", serie1: 100, serie2: 110 },
        { categoria: "Abr", serie1: 180, serie2: 140 },
      ],
      xKey: "categoria",
      series: [
        { key: "serie1", label: "Série 1" },
        { key: "serie2", label: "Série 2" },
      ],
      legend: true,
      grid: true,
    },
  };
}

export type BlockCategory =
  | "basico"
  | "midia"
  | "layout"
  | "interativo"
  | "integracao"
  | "dados";

export type BlockMeta = {
  type: BlockType;
  label: string;
  keywords: string[];
  /** Linha de apoio exibida na paleta lateral (blocos filhos podem omitir). */
  description?: string;
  icon: LucideIcon;
  category: BlockCategory;
  isContainer: boolean;
  isVoid: boolean; // sem texto e sem filhos editáveis (image/embed/divider/…)
  transformableTo: BlockType[];
  defaultData: () => Block;
};

// Grupos na ordem em que aparecem na paleta e no slash menu (padrão Lumina).
export const CATEGORIES: { key: BlockCategory; label: string; comingSoon?: boolean }[] = [
  { key: "basico", label: "Texto" },
  { key: "midia", label: "Mídia" },
  { key: "layout", label: "Estrutura" },
  { key: "interativo", label: "Interativo" },
  { key: "integracao", label: "Integrações" },
  { key: "dados", label: "Base de Dados", comingSoon: true },
];

// Itens "Em breve" (não são blocos reais — placeholders no slash menu).
export const COMING_SOON: { label: string; keywords: string[]; icon: LucideIcon; category: BlockCategory }[] = [
  { label: "Base de Dados", keywords: ["database", "tabela", "grade", "kanban"], icon: Workflow, category: "dados" },
  { label: "Bases de Dados Sincronizadas", keywords: ["sync", "externo", "integração"], icon: Puzzle, category: "dados" },
];

/**
 * Todos os blocos que ACEITAM TEXTO — os alvos possíveis do "Transformar em".
 * (Mídia/void — imagem, vídeo, link, botão, divisor… — ficam de fora, com
 * `transformableTo: []`, então o dropdown de conversão nem aparece neles.)
 */
export const TEXT_CONVERT_TARGETS: BlockType[] = [
  "paragraph",
  "heading",
  "quote",
  "breadcrumb",
  "bulletList",
  "orderedList",
  "checklist",
  "callout",
  "code",
  "table",
  "toggle",
  "steps",
  "hero",
  "cardGrid",
  "container",
];
/** Os alvos de um bloco de texto = todos os de texto menos ele mesmo. */
const alvosTexto = (self: BlockType): BlockType[] => TEXT_CONVERT_TARGETS.filter((t) => t !== self);

// Fábricas de bloco padrão (id novo a cada chamada).
function para(): Block {
  return { id: newId(), type: "paragraph", text: [] };
}

export const BLOCKS = {
  paragraph: {
    type: "paragraph",
    label: "Texto",
    description: "Texto corrido com formatação rica",
    keywords: ["paragrafo", "texto", "p"],
    icon: AlignLeft,
    category: "basico",
    isContainer: false,
    isVoid: false,
    transformableTo: alvosTexto("paragraph"),
    defaultData: para,
  },
  heading: {
    type: "heading",
    label: "Título",
    description: "Organize o artigo em seções navegáveis",
    keywords: ["heading", "titulo", "h1", "h2", "h3", "cabecalho"],
    icon: Heading,
    category: "basico",
    isContainer: false,
    isVoid: false,
    transformableTo: alvosTexto("heading"),
    defaultData: () => ({ id: newId(), type: "heading", text: [], data: { level: 2 } }),
  },
  bulletList: {
    type: "bulletList",
    label: "Lista",
    description: "Lista de itens sem ordem",
    keywords: ["lista", "bullet", "marcadores", "ul"],
    icon: List,
    category: "basico",
    isContainer: true,
    isVoid: false,
    transformableTo: alvosTexto("bulletList"),
    defaultData: () => ({
      id: newId(),
      type: "bulletList",
      children: [{ id: newId(), type: "listItem", text: [] }],
    }),
  },
  orderedList: {
    type: "orderedList",
    label: "Lista numerada",
    description: "Sequência numerada simples",
    keywords: ["lista", "numerada", "ol", "ordenada"],
    icon: ListOrdered,
    category: "basico",
    isContainer: true,
    isVoid: false,
    transformableTo: alvosTexto("orderedList"),
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
    description: "Trecho ou depoimento em destaque",
    keywords: ["citacao", "quote", "blockquote"],
    icon: Quote,
    category: "basico",
    isContainer: false,
    isVoid: false,
    transformableTo: alvosTexto("quote"),
    defaultData: () => ({ id: newId(), type: "quote", text: [] }),
  },
  breadcrumb: {
    type: "breadcrumb",
    label: "Breadcrumb",
    description: "Trilha de navegação (Início › Seção › Página)",
    keywords: ["breadcrumb", "caminho", "navegacao", "trilha", "menu", "rota"],
    icon: Milestone,
    category: "basico",
    isContainer: false,
    isVoid: false,
    transformableTo: alvosTexto("breadcrumb"),
    defaultData: () => ({ id: newId(), type: "breadcrumb", text: [] }),
  },
  divider: {
    type: "divider",
    label: "Divisória",
    description: "Separação visual entre assuntos",
    keywords: ["divisoria", "linha", "hr", "separador"],
    icon: Minus,
    category: "layout",
    isContainer: false,
    isVoid: true,
    transformableTo: [],
    defaultData: () => ({ id: newId(), type: "divider" }),
  },
  code: {
    type: "code",
    label: "Código",
    description: "Trecho de código com destaque",
    keywords: ["codigo", "code", "snippet"],
    icon: Code2,
    category: "midia",
    isContainer: false,
    isVoid: false,
    transformableTo: alvosTexto("code"),
    defaultData: () => ({ id: newId(), type: "code", data: { language: null, code: "" } }),
  },
  image: {
    type: "image",
    label: "Imagem",
    description: "Upload ou URL, com legenda",
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
    description: "YouTube, Vimeo ou arquivo enviado",
    keywords: ["video", "youtube", "vimeo"],
    icon: Video,
    category: "midia",
    isContainer: false,
    isVoid: true,
    transformableTo: [],
    defaultData: () => ({ id: newId(), type: "video", data: { provider: "youtube", url: "" } }),
  },
  file: {
    type: "file",
    label: "Arquivo (download)",
    description: "Cartão de download de anexo",
    keywords: ["arquivo", "download", "anexo", "pdf", "planilha", "baixar"],
    icon: FileDown,
    category: "midia",
    isContainer: false,
    isVoid: true,
    transformableTo: [],
    defaultData: () => ({ id: newId(), type: "file", data: { url: "", name: "", size: 0 } }),
  },
  embed: {
    type: "embed",
    label: "Embed",
    description: "Loom, Figma, Maps, PDF e outros",
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
    description: "Chamada para ação com link",
    keywords: ["botao", "button", "cta", "acao"],
    icon: MousePointerClick,
    category: "interativo",
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
    description: "Nota, dica, atenção ou cuidado",
    keywords: ["callout", "aviso", "destaque", "nota", "atencao"],
    icon: Info,
    category: "basico",
    isContainer: true,
    isVoid: false,
    transformableTo: alvosTexto("callout"),
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
    description: "Passo a passo numerado",
    keywords: ["passos", "steps", "procedimento", "tutorial"],
    icon: ListChecks,
    category: "interativo",
    isContainer: true,
    isVoid: false,
    transformableTo: alvosTexto("steps"),
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
    category: "interativo",
    isContainer: true,
    isVoid: false,
    transformableTo: [],
    defaultData: () => ({ id: newId(), type: "step", children: [para()] }),
  },
  accordion: {
    type: "accordion",
    label: "Acordeão",
    description: "Perguntas e respostas expansíveis",
    keywords: ["accordion", "acordeao", "faq", "recolhivel"],
    icon: ChevronDown,
    category: "interativo",
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
    category: "interativo",
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
    description: "Conteúdo alternado por abas",
    keywords: ["tabs", "abas"],
    icon: PanelTop,
    category: "interativo",
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
    category: "interativo",
    isContainer: true,
    isVoid: false,
    transformableTo: [],
    defaultData: () => ({ id: newId(), type: "tab", data: { label: "Aba" }, children: [para()] }),
  },
  toggle: {
    type: "toggle",
    label: "Recolhível",
    description: "Bloco recolhível para detalhes",
    keywords: ["toggle", "recolhivel", "detalhes", "spoiler"],
    icon: ChevronDown,
    category: "interativo",
    isContainer: true,
    isVoid: false,
    transformableTo: alvosTexto("toggle"),
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
    description: "Região dividida lado a lado",
    keywords: ["colunas", "container", "grid", "layout", "columns"],
    icon: Columns3,
    category: "layout",
    isContainer: true,
    isVoid: false,
    transformableTo: alvosTexto("container"),
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
    description: "Caixa colorida de destaque",
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
    description: "Grade de cartões com ícone",
    keywords: ["cards", "grade", "grid", "cardgrid"],
    icon: LayoutGrid,
    category: "layout",
    isContainer: true,
    isVoid: false,
    transformableTo: alvosTexto("cardGrid"),
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
    description: "Banner de abertura do artigo",
    keywords: ["hero", "banner", "capa", "cabecalho"],
    icon: Sparkles,
    category: "layout",
    isContainer: false,
    isVoid: true,
    transformableTo: alvosTexto("hero"),
    defaultData: () => ({
      id: newId(),
      type: "hero",
      data: { eyebrow: "", title: "Título", subtitle: "", bg: "purple" },
    }),
  },
  spacer: {
    type: "spacer",
    label: "Espaçador",
    description: "Respiro vertical controlado",
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
    description: "Dados tabulares comparativos",
    keywords: ["tabela", "table", "grade"],
    icon: TableIcon,
    category: "midia",
    isContainer: false,
    isVoid: false,
    transformableTo: alvosTexto("table"),
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
    description: "Diagramas de fluxo e decisão",
    keywords: ["mermaid", "diagrama", "fluxograma"],
    icon: Workflow,
    category: "midia",
    isContainer: false,
    isVoid: false,
    transformableTo: [],
    defaultData: () => ({ id: newId(), type: "mermaid", data: { code: "graph TD;\n  A-->B;" } }),
  },
  chart: {
    type: "chart",
    label: "Gráfico",
    description: "Colunas, linha, pizza, dispersão…",
    keywords: ["grafico", "chart", "barras", "colunas", "linha", "pizza", "dados", "graph"],
    icon: BarChart3,
    category: "midia",
    isContainer: false,
    isVoid: true,
    transformableTo: [],
    defaultData: () => graficoPadrao("column"),
  },
  flow: {
    type: "flow",
    label: "Fluxograma",
    description: "Fluxo de nós com decisões e ramos",
    keywords: ["fluxograma", "flow", "fluxo", "processo", "decisao", "diagrama"],
    icon: Waypoints,
    category: "midia",
    isContainer: false,
    isVoid: true,
    transformableTo: [],
    defaultData: () => fluxoPadrao(),
  },
  mindmap: {
    type: "mindmap",
    label: "Mapa mental",
    description: "Árvore de ideias interativa (expandir, zoom, tela cheia)",
    keywords: ["mapa mental", "mindmap", "mind map", "árvore", "ideias", "brainstorm", "tópicos"],
    icon: Network,
    category: "midia",
    isContainer: false,
    isVoid: true,
    transformableTo: [],
    defaultData: () => mapaMentalPadrao(),
  },
  snippet: {
    type: "snippet",
    label: "Snippet reutilizável",
    description: "Conteúdo reutilizado entre artigos",
    keywords: ["snippet", "transclusao", "reutilizavel"],
    icon: Puzzle,
    category: "integracao",
    isContainer: false,
    isVoid: true,
    transformableTo: [],
    defaultData: () => ({ id: newId(), type: "snippet", data: { snippetKey: "" } }),
  },
  checklist: {
    type: "checklist",
    label: "Checklist",
    description: "Verificações com caixas de marcar",
    keywords: ["checklist", "verificacao", "tarefas", "todo", "checkbox"],
    icon: CheckSquare,
    category: "basico",
    isContainer: false,
    isVoid: false,
    transformableTo: alvosTexto("checklist"),
    defaultData: () => ({
      id: newId(),
      type: "checklist",
      data: { items: [{ id: newId(), text: [], checked: false }] },
    }),
  },
  stats: {
    type: "stats",
    label: "Indicadores (KPIs)",
    description: "Cartões de métricas e KPIs",
    keywords: ["indicadores", "kpi", "metricas", "stats", "numeros"],
    icon: BarChart3,
    category: "layout",
    isContainer: false,
    isVoid: true,
    transformableTo: [],
    defaultData: () => ({
      id: newId(),
      type: "stats",
      data: {
        items: [
          { id: newId(), value: "100%", label: "Indicador", trend: "Descrição do indicador" },
          { id: newId(), value: "24/7", label: "Outro indicador", trend: "Descrição do indicador" },
        ],
      },
    }),
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
