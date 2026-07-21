import { Fragment, type ReactNode } from "react";
import DOMPurify from "isomorphic-dompurify";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Info,
  OctagonAlert,
} from "lucide-react";
import { slugify } from "@/lib/content/slug";
import { highlightCode } from "@/lib/content/highlight";
import { PortalTabs } from "@/components/portal/tabs";
import { CopyAnchor } from "@/components/portal/copy-anchor";
import { CodeCopy } from "@/components/portal/code-copy";
import { MermaidView } from "@/components/editor/mermaid-view";
import type { TocItem } from "@/components/portal/toc";
import { embedIframe } from "./embed";
import { type Block, type RichText } from "./schema";
import { richToText } from "./serialize";
import { styleClass } from "./styles";
import { iconByKey, ICON_IN_TITLE } from "./icons";

type Ctx = {
  slugs: Set<string>;
  snippets: Map<string, Block[]>;
  /** Prefixo das âncoras — evita colisão quando vários artigos vão na mesma página. */
  idPrefix: string;
  /** Desloca o nível dos títulos (1 = o H1 do conteúdo vira H2). */
  headingShift: number;
};

function uniqueSlug(ctx: Ctx, text: string) {
  const base = `${ctx.idPrefix}${slugify(text) || "secao"}`;
  let slug = base;
  let i = 1;
  while (ctx.slugs.has(slug)) slug = `${base}-${++i}`;
  ctx.slugs.add(slug);
  return slug;
}

// ── inline ───────────────────────────────────────────────────────────────────

function withMarks(text: string, span: RichText[number], key: number): ReactNode {
  // quebras de linha viram <br>
  const pieces = text.split("\n");
  let el: ReactNode =
    pieces.length > 1
      ? pieces.map((p, i) => (
          <Fragment key={i}>
            {i > 0 && <br />}
            {p}
          </Fragment>
        ))
      : text;
  for (const mark of span.marks ?? []) {
    if (mark.type === "bold") el = <strong>{el}</strong>;
    else if (mark.type === "italic") el = <em>{el}</em>;
    else if (mark.type === "strike") el = <s>{el}</s>;
    else if (mark.type === "code") el = <code>{el}</code>;
    else if (mark.type === "kbd")
      el = (
        <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[0.85em]">
          {el}
        </kbd>
      );
    else if (mark.type === "highlight")
      el = (
        <mark style={{ backgroundColor: mark.color ?? "#fde68a", padding: "0 2px", borderRadius: 2 }}>
          {el}
        </mark>
      );
    else if (mark.type === "color") el = <span style={{ color: mark.color }}>{el}</span>;
    else if (mark.type === "link")
      el = (
        <a
          href={mark.href}
          rel="noopener noreferrer"
          className="text-primary underline-offset-4 hover:underline"
        >
          {el}
        </a>
      );
  }
  return <Fragment key={key}>{el}</Fragment>;
}

function renderRich(rt: RichText | undefined): ReactNode {
  return (rt ?? []).map((span, i) => withMarks(span.text, span, i));
}

// ── blocos ───────────────────────────────────────────────────────────────────

function renderChildren(blocks: Block[] | undefined, ctx: Ctx): ReactNode {
  return (blocks ?? []).map((b, i) => renderBlock(b, i, ctx));
}

function renderBlock(block: Block, key: number, ctx: Ctx): ReactNode {
  const inner = renderInner(block, ctx);
  const cls = styleClass(block.styles);
  // Ícone da região: tipos com título o posicionam junto do título; os demais
  // ganham o ícone no topo da região.
  const Icon = ICON_IN_TITLE.has(block.type) ? null : iconByKey(block.styles?.icon);
  if (!cls && !Icon) return <Fragment key={key}>{inner}</Fragment>;
  return (
    <div key={key} className={cls}>
      {Icon && <Icon className="mb-2 size-5 text-primary" />}
      {inner}
    </div>
  );
}

function renderInner(block: Block, ctx: Ctx): ReactNode {
  switch (block.type) {
    case "paragraph":
      return <p>{renderRich(block.text)}</p>;

    case "heading": {
      // Com deslocamento, um H1 do conteúdo vira H2 (e ganha âncora) — usado
      // quando vários artigos dividem a mesma página.
      // Vai até H4: na leitura contínua o título do artigo já ocupa o H3, e um
      // heading do conteúdo maior que o título do próprio artigo inverte a
      // hierarquia — é o erro visual mais caro numa documentação.
      const level = Math.min(4, block.data.level + ctx.headingShift);
      if (level === 1) return <h1>{renderRich(block.text)}</h1>;
      const id = uniqueSlug(ctx, richToText(block.text));
      const Tag = (level === 2 ? "h2" : level === 3 ? "h3" : "h4") as "h2" | "h3" | "h4";
      return (
        <Tag id={id} className="group scroll-mt-24">
          {renderRich(block.text)}
          <CopyAnchor anchor={id} />
        </Tag>
      );
    }

    case "bulletList":
      return <ul>{renderChildren(block.children, ctx)}</ul>;
    case "orderedList":
      return <ol>{renderChildren(block.children, ctx)}</ol>;
    case "listItem":
      return (
        <li>
          {renderRich(block.text)}
          {block.children?.length ? renderChildren(block.children, ctx) : null}
        </li>
      );
    case "quote":
      return <blockquote>{renderRich(block.text)}</blockquote>;
    case "divider":
      return <hr />;

    case "code": {
      const code = block.data.code;
      const lang = block.data.language ?? undefined;
      const html = highlightCode(code, lang);
      return (
        <pre>
          {/* Barra de linguagem discreta, no lugar onde todo dev já procura. */}
          {lang && <span className="code-lang">{lang}</span>}
          <CodeCopy code={code} />
          {html ? (
            <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <code>{code}</code>
          )}
        </pre>
      );
    }

    case "image": {
      const { src, alt, caption } = block.data;
      if (!src) return null;
      return (
        <figure className="my-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} loading="lazy" decoding="async" className="mx-auto rounded-lg" />
          {caption ? <figcaption className="mt-2 text-sm text-text-muted">{caption}</figcaption> : null}
        </figure>
      );
    }

    case "video": {
      const { provider, url } = block.data;
      if (provider === "upload")
        return <video src={url} controls className="my-6 mx-auto rounded-lg" />;
      let embed = url;
      if (provider === "youtube") {
        const id = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/)?.[1];
        embed = id ? `https://www.youtube.com/embed/${id}` : url;
      } else if (provider === "vimeo") {
        const id = url.match(/vimeo\.com\/(\d+)/)?.[1];
        embed = id ? `https://player.vimeo.com/video/${id}` : url;
      }
      return (
        <div className="relative my-6 aspect-video overflow-hidden rounded-lg">
          <iframe src={embed} className="absolute inset-0 size-full" allowFullScreen title="Vídeo" />
        </div>
      );
    }

    case "embed":
      return renderEmbed(block);

    case "button": {
      const { href, variant, label } = block.data;
      return (
        <div className="my-4">
          <a
            href={href}
            className={
              variant === "secondary"
                ? "inline-flex items-center rounded-md border border-border bg-surface-2 px-5 py-2.5 text-sm font-medium no-underline"
                : "inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-fg no-underline hover:bg-primary-hover"
            }
          >
            {label}
          </a>
        </div>
      );
    }

    case "callout": {
      const base = CALLOUT[block.data.variant] ?? CALLOUT.info;
      const cls = base.cls;
      const Icon = iconByKey(block.styles?.icon) ?? base.Icon;
      return (
        <div className={`my-6 flex gap-3 rounded-r-md border-l-[3px] px-4 py-3.5 ${cls}`}>
          <Icon className="mt-0.5 size-[18px] shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1 text-[0.9375rem] leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {renderChildren(block.children, ctx)}
          </div>
        </div>
      );
    }

    case "steps":
      return <div className="my-4 [counter-reset:step]">{renderChildren(block.children, ctx)}</div>;
    case "step":
      return (
        <div className="relative mb-4 border-l-2 border-border pb-1 pl-8 [counter-increment:step] before:absolute before:left-[-13px] before:top-0 before:flex before:size-6 before:items-center before:justify-center before:rounded-full before:bg-primary before:text-xs before:font-semibold before:text-primary-fg before:content-[counter(step)] [&>*:first-child]:mt-0">
          {renderChildren(block.children, ctx)}
        </div>
      );

    case "accordion":
      return <div className="my-4 space-y-1">{renderChildren(block.children, ctx)}</div>;
    case "accordionItem": {
      const ItemIcon = iconByKey(block.styles?.icon);
      return (
        <details className="overflow-hidden rounded-md border border-border">
          <summary className="flex cursor-pointer list-none items-center gap-2 bg-surface-2 px-3.5 py-2.5 text-sm font-medium transition-colors hover:text-primary">
            {ItemIcon && <ItemIcon className="size-4 shrink-0 text-primary" />}
            {block.data.title}
          </summary>
          <div className="px-3.5 py-3 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {renderChildren(block.children, ctx)}
          </div>
        </details>
      );
    }

    case "tabs": {
      const items = block.children.filter((c): c is Extract<Block, { type: "tab" }> => c.type === "tab");
      const labels = items.map((t) => t.data.label || "Aba");
      const panels = items.map((t, i) => (
        <div key={i} className="[&>*:first-child]:mt-0">
          {renderChildren(t.children, ctx)}
        </div>
      ));
      return <PortalTabs labels={labels} panels={panels} />;
    }
    case "tab":
      return <div className="[&>*:first-child]:mt-0">{renderChildren(block.children, ctx)}</div>;

    case "toggle": {
      const TIcon = iconByKey(block.styles?.icon);
      return (
        <details className="my-4 rounded-md border border-border">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-sm font-medium transition-colors hover:text-primary">
            {TIcon ? (
              <TIcon className="size-4 shrink-0 text-primary" />
            ) : (
              <ChevronDown className="size-4 shrink-0 text-text-muted" />
            )}
            {block.data.title}
          </summary>
          <div className="border-t border-border px-3.5 py-3 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {renderChildren(block.children, ctx)}
          </div>
        </details>
      );
    }

    case "container":
      return renderContainer(block, ctx);
    case "column":
      return <div className="min-w-0 [&>*:first-child]:mt-0">{renderChildren(block.children, ctx)}</div>;

    case "panel": {
      const cls: Record<string, string> = {
        purple: "bg-brand-purple-50 dark:bg-brand-purple-950/30",
        pink: "bg-brand-pink-50 dark:bg-brand-pink-950/30",
        blue: "bg-brand-blue-50 dark:bg-brand-blue-950/30",
        gray: "bg-brand-gray-100 dark:bg-brand-gray-800",
      };
      return (
        <div
          className={`my-6 rounded-lg p-5 sm:p-6 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 ${cls[block.data.bg] ?? cls.purple}`}
        >
          {renderChildren(block.children, ctx)}
        </div>
      );
    }

    case "cardGrid": {
      const cols = block.data.cols || 3;
      const grid =
        cols === 2 ? "sm:grid-cols-2" : cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";
      return <div className={`my-5 grid gap-3 ${grid}`}>{renderChildren(block.children, ctx)}</div>;
    }
    case "card": {
      // styles.icon (escolhido nas propriedades) tem prioridade sobre data.icon.
      const Icon = iconByKey(block.styles?.icon) ?? iconByKey(block.data.icon) ?? BookOpen;
      const { title, href } = block.data;
      const body = (
        <>
          <span className="mb-3 flex size-9 items-center justify-center rounded-md bg-brand-purple-50 text-primary dark:bg-brand-purple-950/40">
            <Icon className="size-[18px]" />
          </span>
          {title && <div className="font-semibold leading-snug">{title}</div>}
          <div className="mt-1 text-sm leading-relaxed text-text-muted [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {renderChildren(block.children, ctx)}
          </div>
        </>
      );
      // Elevação no hover em vez de trocar a cor da borda: sinaliza "clicável"
      // sem piscar a marca a cada passagem do mouse.
      return href ? (
        <a
          href={href}
          className="block rounded-lg border border-border bg-surface p-5 no-underline transition-shadow hover:shadow-2"
        >
          {body}
        </a>
      ) : (
        <div className="rounded-lg border border-border bg-surface p-5">{body}</div>
      );
    }

    case "hero": {
      /* Sem gradiente roxo→rosa: é a assinatura visual de "landing page de
         startup de IA" e destoa de uma documentação corporativa. Fundo chapado
         e tênue, hairline, e a marca só no eyebrow/ícone. */
      const cls: Record<string, string> = {
        purple: "border-brand-purple-200 bg-brand-purple-50/60 dark:border-brand-purple-900 dark:bg-brand-purple-950/30",
        blue: "border-brand-blue-200 bg-brand-blue-50/60 dark:border-brand-blue-900 dark:bg-brand-blue-950/30",
        gray: "border-border bg-surface-2",
        dark: "border-brand-blue-800 bg-brand-blue-800 text-white dark:bg-brand-blue-950",
      };
      const dark = block.data.bg === "dark";
      const { eyebrow, title, subtitle, bg } = block.data;
      const HeroIcon = iconByKey(block.styles?.icon);
      return (
        <div className={`my-6 rounded-xl border p-6 sm:p-8 ${cls[bg] ?? cls.purple}`}>
          {HeroIcon && (
            <HeroIcon className={`mb-3 size-7 ${dark ? "text-white/80" : "text-primary"}`} />
          )}
          {eyebrow && (
            <p
              className={`text-[0.6875rem] font-semibold uppercase tracking-[0.08em] ${
                dark ? "text-white/70" : "text-primary"
              }`}
            >
              {eyebrow}
            </p>
          )}
          {title && (
            /* Na leitura contínua, `--l-hero` (definida pelo wrapper .leitura)
               segura o hero ABAIXO do título do artigo — um banner de conteúdo
               maior que o título que o contém inverte a hierarquia da página.
               Fora da leitura (editor, prévia solta) o fallback mantém 24→30px. */
            <p className="mt-1.5 text-[length:var(--l-hero,1.5rem)] font-semibold leading-tight tracking-tight sm:text-[length:var(--l-hero,1.875rem)]">
              {title}
            </p>
          )}
          {subtitle && (
            <p className={`mt-2.5 leading-relaxed ${dark ? "text-white/80" : "text-text-muted"}`}>
              {subtitle}
            </p>
          )}
        </div>
      );
    }

    case "spacer": {
      const h = block.data.size === "sm" ? "h-3" : block.data.size === "lg" ? "h-12" : "h-6";
      return <div className={h} aria-hidden />;
    }

    case "table": {
      const [head, ...rest] = block.data.hasHeader
        ? [block.data.rows[0] ?? [], ...block.data.rows.slice(1)]
        : [null, ...block.data.rows];
      return (
        // Rola dentro do próprio contêiner: uma tabela larga jamais pode fazer
        // a PÁGINA rolar na horizontal.
        <div className="table-portal my-6 overflow-x-auto">
          <table>
            {head && (
              <thead>
                <tr>
                  {head.map((cell, ci) => (
                    <th key={ci} scope="col">
                      {renderRich(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rest.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{renderRich(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case "mermaid":
      return <MermaidView code={block.data.code} />;

    case "snippet": {
      const blocks = ctx.snippets.get(block.data.snippetKey);
      if (!blocks) return null;
      return <>{renderChildren(blocks, ctx)}</>;
    }
  }
}

/**
 * Região dividida em colunas. Com `ratios`, a proporção de cada divisão vem de
 * uma CSS var (só números — seguro) aplicada a partir de md; no mobile empilha.
 * `divider` desenha a linha entre as divisões.
 */
function renderContainer(block: Extract<Block, { type: "container" }>, ctx: Ctx): ReactNode {
  const cols = Math.min(5, Math.max(2, block.data.columns || 2));
  const raw = block.data.ratios;
  const ratios =
    raw && raw.length === cols
      ? raw.map((r) => Math.min(12, Math.max(1, Math.round(Number(r) || 1))))
      : null;

  const grid: Record<number, string> = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
    5: "md:grid-cols-3 lg:grid-cols-5",
  };
  const divider = block.data.divider
    ? "md:[&>*+*]:border-l md:[&>*+*]:border-border md:[&>*+*]:pl-4"
    : "";

  if (ratios) {
    return (
      <div
        className={`my-4 grid grid-cols-1 gap-4 md:[grid-template-columns:var(--block-cols)] ${divider}`}
        style={{ "--block-cols": ratios.map((r) => `${r}fr`).join(" ") } as React.CSSProperties}
      >
        {renderChildren(block.children, ctx)}
      </div>
    );
  }
  return (
    <div className={`my-4 grid gap-4 ${grid[cols] ?? "md:grid-cols-2"} ${divider}`}>
      {renderChildren(block.children, ctx)}
    </div>
  );
}

/**
 * Callouts: borda-guia à esquerda + fundo bem tênue (padrão Microsoft Learn /
 * SAP Help). Nada de bloco saturado — o leitor precisa continuar lendo.
 *
 * `warning` e `danger` saem da paleta da marca de propósito: em rosa os dois
 * ficariam indistinguíveis, e "cuidado" vs. "pare" é compreensão, não enfeite.
 * A cor nunca carrega o significado sozinha — o ícone sempre acompanha.
 */
const CALLOUT = {
  info: {
    Icon: Info,
    cls: "border-brand-blue-500 bg-brand-blue-50/70 text-brand-blue-900 dark:bg-brand-blue-950/30 dark:text-brand-blue-100",
  },
  success: {
    Icon: CheckCircle2,
    cls: "border-brand-purple-500 bg-brand-purple-50/70 text-brand-purple-900 dark:bg-brand-purple-950/30 dark:text-brand-purple-100",
  },
  warning: {
    Icon: AlertTriangle,
    cls: "border-amber-500 bg-amber-50/70 text-amber-900 dark:bg-amber-950/25 dark:text-amber-100",
  },
  danger: {
    Icon: OctagonAlert,
    cls: "border-red-500 bg-red-50/70 text-red-900 dark:bg-red-950/25 dark:text-red-100",
  },
} as const;

function renderEmbed(block: Extract<Block, { type: "embed" }>): ReactNode {
  const data = block.data;
  if (data.provider === "raw" && data.html) {
    const clean = DOMPurify.sanitize(data.html, {
      ADD_TAGS: ["iframe"],
      ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling", "sandbox"],
    });
    return <div className="my-4" dangerouslySetInnerHTML={{ __html: clean }} />;
  }
  const frame = embedIframe(data);
  if (frame) {
    return (
      <div className="relative my-6 overflow-hidden rounded-lg border border-border" style={{ aspectRatio: frame.aspect }}>
        <iframe
          src={frame.src}
          title={frame.title}
          loading="lazy"
          className="absolute inset-0 size-full"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
          allowFullScreen
        />
      </div>
    );
  }
  // link / twitter / gist → card de link (sem carregar scripts externos)
  return (
    <a
      href={data.url || "#"}
      className="my-3 block rounded-lg border border-border p-4 no-underline transition hover:border-primary"
    >
      <div className="font-semibold text-text">{data.title || data.url}</div>
      {data.description ? <div className="mt-1 text-sm text-text-muted">{data.description}</div> : null}
      <div className="mt-1 text-xs text-primary">{data.url}</div>
    </a>
  );
}

// ── entrypoints ──────────────────────────────────────────────────────────────

/**
 * Extrai H2/H3 para o índice da página (MESMA slugificação do render — passe o
 * mesmo `idPrefix` usado em <RenderBlocks> para as âncoras baterem).
 */
export function extractToc(blocks: Block[], idPrefix = "", headingShift = 0): TocItem[] {
  const slugs = new Set<string>();
  const items: TocItem[] = [];
  const walk = (bs: Block[]) => {
    for (const b of bs) {
      const lvl = b.type === "heading" ? Math.min(4, b.data.level + headingShift) : 0;
      if (b.type === "heading" && lvl >= 2) {
        const text = richToText(b.text);
        const base = `${idPrefix}${slugify(text) || "secao"}`;
        let slug = base;
        let i = 1;
        while (slugs.has(slug)) slug = `${base}-${++i}`;
        slugs.add(slug);
        items.push({ id: slug, text, level: lvl });
      }
      if ("children" in b && Array.isArray(b.children)) walk(b.children);
    }
  };
  walk(blocks);
  return items;
}

/** Renderiza um documento de blocos como React (Server Component). */
export function RenderBlocks({
  blocks,
  snippets,
  idPrefix = "",
  headingShift = 0,
}: {
  blocks: Block[];
  snippets: Map<string, Block[]>;
  /** Prefixo das âncoras de título (usar o slug do artigo em páginas com vários). */
  idPrefix?: string;
  /** Desloca o nível dos títulos (1 = H1 do conteúdo vira H2). */
  headingShift?: number;
}) {
  const ctx: Ctx = { slugs: new Set(), snippets, idPrefix, headingShift };
  return <>{renderChildren(blocks, ctx)}</>;
}
