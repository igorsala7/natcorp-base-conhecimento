import {
  BlockSchema,
  CHART_TYPES,
  newId,
  type Block,
  type BlockType,
  type BlockDoc,
  type ChartType,
  type RichText,
} from "@/lib/blocks/schema";
import { csvToChartData, mermaidToFlowData, outlineToMindMap } from "@/lib/blocks/ai-data-blocks";

/**
 * SANITIZADOR da saída livre da IA (Fase B) → BlockDoc válido e seguro para o
 * renderizador.
 *
 * A IA emite JSON de blocos ricos (todos os tipos do editor, com aninhamento e
 * marcas inline) SEM `id` e com `data` em formato solto. `BlockDocSchema` valida
 * a ESTRUTURA (id/type/text/children) mas deixa `data` livre — então um `data`
 * malformado passaria na validação e quebraria a tela. Aqui cada tipo tem seus
 * campos de `data` COERCIDOS/whitelisted para o que o motor espera; `text` vira
 * spans; ids são atribuídos; bloco inválido é descartado (bottom-up) e, no pior
 * caso, tudo cai para parágrafos do texto-fonte — nunca gravamos doc inválido.
 */

const TIPOS_VALIDOS = new Set<BlockType>([
  "paragraph", "heading", "bulletList", "orderedList", "listItem", "quote",
  "divider", "code", "image", "video", "file", "embed", "button", "callout",
  "steps", "step", "accordion", "accordionItem", "tabs", "tab", "toggle",
  "container", "column", "panel", "cardGrid", "card", "hero", "spacer", "table",
  "mermaid", "chart", "flow", "mindmap", "snippet", "checklist", "stats",
]);

/** Blocos que carregam filhos (contêineres). */
const COM_FILHOS = new Set<BlockType>([
  "bulletList", "orderedList", "listItem", "callout", "steps", "step",
  "accordion", "accordionItem", "tabs", "tab", "toggle", "container", "column",
  "panel", "cardGrid", "card",
]);

function str(v: unknown, max = 20_000): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}
function pick<T extends string>(v: unknown, allowed: readonly T[], def: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : def;
}
function num(v: unknown, def: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : def;
}

/** string | spans | array de strings → RichText (spans). Marcas passam adiante e são validadas depois. */
export function toRich(t: unknown): RichText {
  if (typeof t === "string") return t ? [{ text: t }] : [];
  if (!Array.isArray(t)) return [];
  const spans: RichText = [];
  for (const s of t) {
    if (typeof s === "string") {
      if (s) spans.push({ text: s });
    } else if (s && typeof (s as { text?: unknown }).text === "string") {
      const span: RichText[number] = { text: (s as { text: string }).text };
      const marks = (s as { marks?: unknown }).marks;
      if (Array.isArray(marks)) {
        const ok = marks.filter((m): m is { type: string } => !!m && typeof (m as { type?: unknown }).type === "string");
        if (ok.length) span.marks = ok as RichText[number]["marks"];
      }
      spans.push(span);
    }
  }
  return spans;
}

/** Igual a toRich mas sem marcas — usado para salvar conteúdo quando a marca invalida o bloco. */
function toPlain(t: unknown): RichText {
  return toRich(t).map((s) => ({ text: s.text }));
}

const raw = (b: unknown) => (b && typeof b === "object" ? (b as Record<string, unknown>) : {});
const textOf = (b: Record<string, unknown>) => b.text ?? b.texto ?? b.content;
const dataOf = (b: Record<string, unknown>) => raw(b.data);

/** Monta `data` seguro por tipo (só campos que o motor lê). */
function coerceData(type: BlockType, d: Record<string, unknown>): Record<string, unknown> | undefined {
  switch (type) {
    case "heading":
      // H1 é o título principal do artigo; H2/H3 são as seções. Antes o nível 1
      // era rebaixado para 2 — o "Melhorar layout" não conseguia marcar o título.
      return {
        level: d.level === 1 || d.level === "1" ? 1 : d.level === 3 || d.level === "3" ? 3 : 2,
      };
    case "quote":
      return d.author || d.autor ? { author: str(d.author ?? d.autor, 200) } : {};
    case "code":
      return { language: d.language ? str(d.language, 40) : null, code: str(d.code, 40_000), ...(d.filename ? { filename: str(d.filename, 200) } : {}) };
    case "callout":
      return { variant: pick(d.variant, ["info", "warning", "success", "danger", "note"], "info"), ...(d.title || d.titulo ? { title: str(d.title ?? d.titulo, 200) } : {}) };
    case "panel":
      return { bg: pick(d.bg, ["purple", "pink", "blue", "gray"], "purple") };
    case "hero":
      return { eyebrow: str(d.eyebrow, 120), title: str(d.title ?? d.titulo, 200), subtitle: str(d.subtitle ?? d.subtitulo, 400), bg: pick(d.bg, ["purple", "blue", "gray", "dark"], "purple") };
    case "step":
      return d.title || d.titulo ? { title: str(d.title ?? d.titulo, 200) } : {};
    case "accordionItem":
    case "toggle":
      return { title: str(d.title ?? d.titulo, 200) };
    case "tab":
      return { label: str(d.label ?? d.rotulo, 120) };
    case "container":
      return { columns: Math.max(1, Math.min(4, num(d.columns, 2))), ...(Array.isArray(d.ratios) ? { ratios: (d.ratios as unknown[]).map((r) => num(r, 1)) } : {}), ...(d.divider ? { divider: true } : {}) };
    case "cardGrid":
      return { cols: Math.max(1, Math.min(4, num(d.cols, 3))) };
    case "card":
      return { icon: str(d.icon, 40), title: str(d.title ?? d.titulo, 200), href: str(d.href, 500) };
    case "button":
      return { label: str(d.label ?? d.rotulo, 200), href: str(d.href ?? d.url, 500), variant: pick(d.variant, ["primary", "secondary"], "primary") };
    case "spacer":
      return { size: pick(d.size, ["sm", "md", "lg"], "md") };
    case "video":
      return { provider: pick(d.provider, ["youtube", "vimeo", "upload"], "youtube"), url: str(d.url, 800) };
    case "file":
      return { url: str(d.url, 800), name: str(d.name ?? d.nome, 200), size: num(d.size, 0) };
    case "embed":
      return { provider: pick(d.provider, ["youtube", "vimeo", "loom", "figma", "googlemaps", "twitter", "gist", "pdf", "link", "raw"], "link"), url: str(d.url, 800) };
    case "mermaid":
      return { code: str(d.code, 20_000) };
    case "table": {
      const rowsRaw = Array.isArray(d.rows) ? d.rows : [];
      const rows = rowsRaw
        .filter(Array.isArray)
        .map((row) => (row as unknown[]).map((cell) => toRich(cell)));
      return { rows, hasHeader: d.hasHeader !== false };
    }
    case "chart": {
      // Forma preferida da IA: `chartType` + CSV. Aceita também dados diretos.
      const tipos = CHART_TYPES.map((t) => t.type) as [ChartType, ...ChartType[]];
      const ct = pick(d.chartType, tipos, "column");
      if (typeof d.dataCsv === "string" && d.dataCsv.trim())
        return csvToChartData(ct, d.dataCsv, str(d.title, 120)) ?? undefined;
      const columns = (Array.isArray(d.columns) ? d.columns : [])
        .map((c) => {
          const o = raw(c);
          return { key: str(o.key, 60), label: str(o.label ?? o.key, 120) };
        })
        .filter((c) => c.key);
      const rows = (Array.isArray(d.rows) ? d.rows : []).map(
        (r) => raw(r) as Record<string, string | number>,
      );
      if (!columns.length || !rows.length) return undefined;
      const series = (
        Array.isArray(d.series) && d.series.length
          ? d.series.map((s) => {
              const o = raw(s);
              return { key: str(o.key, 60), label: str(o.label ?? o.key, 120) };
            })
          : columns.slice(1)
      ).filter((s) => s.key);
      return {
        chartType: ct,
        title: str(d.title, 120) || undefined,
        columns,
        rows,
        xKey: str(d.xKey, 60) || columns[0]!.key,
        series,
        legend: true,
        grid: true,
      };
    }
    case "mindmap": {
      // Forma preferida: outline indentado (1ª linha = raiz, indentação = ramos).
      if (typeof d.outline === "string" && d.outline.trim()) return outlineToMindMap(d.outline) ?? undefined;
      return d.root && typeof d.root === "object" ? { root: d.root } : undefined;
    }
    case "flow": {
      // Forma preferida: sintaxe Mermaid. Aceita também nós/arestas diretos.
      if (typeof d.mermaid === "string" && d.mermaid.trim()) {
        const f = mermaidToFlowData(d.mermaid);
        return f.nodes.length ? f : undefined;
      }
      const tipos = ["start", "end", "process", "decision", "io", "subroutine"] as const;
      const nodes = (Array.isArray(d.nodes) ? d.nodes : [])
        .map((n) => {
          const o = raw(n);
          return { id: str(o.id, 40), type: pick(o.type, tipos, "process"), label: str(o.label, 120) };
        })
        .filter((n) => n.id);
      if (!nodes.length) return undefined;
      const ids = new Set(nodes.map((n) => n.id));
      const edges = (Array.isArray(d.edges) ? d.edges : [])
        .map((e, i) => {
          const o = raw(e);
          return {
            id: str(o.id, 40) || `e${i + 1}`,
            from: str(o.from, 40),
            to: str(o.to, 40),
            label: str(o.label, 60) || undefined,
          };
        })
        .filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);
      return { nodes, edges };
    }
    case "checklist": {
      const itemsRaw = Array.isArray(d.items) ? d.items : [];
      const items = itemsRaw
        .map((it) => {
          const o = raw(it);
          const text = toRich(o.text ?? o.texto ?? it);
          return text.length ? { id: newId(), text, checked: o.checked === true } : null;
        })
        .filter(Boolean);
      return { items };
    }
    case "stats": {
      const itemsRaw = Array.isArray(d.items) ? d.items : [];
      const items = itemsRaw
        .map((it) => {
          const o = raw(it);
          const value = str(o.value ?? o.valor, 40);
          const label = str(o.label ?? o.rotulo, 120);
          return value || label ? { id: newId(), value, label, trend: str(o.trend, 40) } : null;
        })
        .filter(Boolean);
      return { items };
    }
    default:
      return undefined;
  }
}

/** Um bloco cru → Block válido, ou null. Recursivo (bottom-up nos filhos). */
function sanitizeBlock(input: unknown): Block | null {
  const b = raw(input);
  const type = String(b.type ?? b.tipo) as BlockType;
  if (!TIPOS_VALIDOS.has(type)) return null;
  // A imagem entra por marcador ⟦IMG:n⟧ (reinsert), nunca como bloco direto; e
  // snippet exige uma chave real. Descartamos ambos silenciosamente.
  if (type === "image" || type === "snippet") return null;

  // `data`: mescla um `items` de topo (checklist/stats às vezes vêm assim).
  const dBase = dataOf(b);
  const d =
    !("items" in dBase) && Array.isArray(b.items) && (type === "checklist" || type === "stats")
      ? { ...dBase, items: b.items }
      : dBase;
  const data = coerceData(type, d);

  // Blocos tabulares/lista vazios não têm o que mostrar.
  if (type === "table" && !((data?.rows as unknown[])?.length)) return null;
  if (type === "chart" && !data) return null;
  if (type === "flow" && !((data?.nodes as unknown[])?.length)) return null;
  if (type === "mindmap" && !(data as { root?: unknown })?.root) return null;
  if ((type === "checklist" || type === "stats") && !((data?.items as unknown[])?.length)) return null;

  // Filhos: `children`, ou `items` nos contêineres. Em listas, entradas soltas
  // (string ou { text }) viram listItem.
  let filhosRaw: unknown[] = Array.isArray(b.children)
    ? (b.children as unknown[])
    : COM_FILHOS.has(type) && Array.isArray(b.items)
      ? (b.items as unknown[])
      : [];
  if (type === "bulletList" || type === "orderedList") {
    filhosRaw = filhosRaw.map((it) => {
      if (typeof it === "string") return { type: "listItem", text: [{ text: it }] };
      const o = raw(it);
      if (o.type === "listItem") return it;
      if (o.text !== undefined && o.type === undefined) return { type: "listItem", text: o.text };
      return { type: "listItem", children: [it] };
    });
  }
  const children = filhosRaw.map(sanitizeBlock).filter((x): x is Block => x !== null);

  const temTexto = textOf(b) !== undefined;
  // Só listItem (dentro dos contêineres) usa `text` direto; nos demais
  // contêineres um texto solto vira parágrafo-filho para não se perder.
  const usaTextoDireto = !COM_FILHOS.has(type) || type === "listItem";

  const construir = (rich: (t: unknown) => RichText): Block => {
    const bloco: Record<string, unknown> = { id: newId(), type };
    if (data !== undefined) bloco.data = data;
    const kids = [...children];
    if (temTexto && usaTextoDireto) {
      bloco.text = rich(textOf(b));
    } else if (temTexto) {
      const t = rich(textOf(b));
      if (t.length) kids.unshift({ id: newId(), type: "paragraph", text: t } as Block);
    }
    if (kids.length) bloco.children = kids;
    return bloco as Block;
  };

  // Contêiner que ficou sem corpo (sem filhos e sem texto) não renderiza.
  if (COM_FILHOS.has(type) && children.length === 0 && !temTexto) return null;

  const comMarcas = construir(toRich);
  if (BlockSchema.safeParse(comMarcas).success) return comMarcas;
  // Marca malformada invalidou o bloco: salva o conteúdo sem marcas.
  const semMarcas = construir(toPlain);
  if (BlockSchema.safeParse(semMarcas).success) return semMarcas;
  return null;
}

/** Parágrafos do texto-fonte — rede final quando a IA falha por completo. */
function paragrafosDe(text: string): Block[] {
  const blocks = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p): Block => ({ id: newId(), type: "paragraph", text: [{ text: p }] }));
  return blocks.length ? blocks : [{ id: newId(), type: "paragraph", text: [] }];
}

/**
 * Saída livre da IA (objeto com `blocks`/`nodes`, ou array direto) → BlockDoc
 * válido. `fallbackText` vira parágrafos quando nada aproveitável sobra.
 */
export function sanitizeDoc(rawDoc: unknown, fallbackText = ""): BlockDoc {
  const arr =
    Array.isArray(rawDoc) ? rawDoc
    : Array.isArray((rawDoc as { blocks?: unknown })?.blocks) ? (rawDoc as { blocks: unknown[] }).blocks
    : Array.isArray((rawDoc as { nodes?: unknown })?.nodes) ? (rawDoc as { nodes: unknown[] }).nodes
    : [];
  const blocks = arr.map(sanitizeBlock).filter((x): x is Block => x !== null);
  return {
    version: 2,
    blocks: blocks.length ? blocks : paragrafosDe(fallbackText),
  };
}
