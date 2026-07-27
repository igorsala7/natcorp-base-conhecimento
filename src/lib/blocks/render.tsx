import { Fragment, type ReactNode } from "react";
import DOMPurify from "isomorphic-dompurify";
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileDown,
  Info,
  Lightbulb,
  OctagonAlert,
  Quote as QuoteIcon,
} from "lucide-react";
import { slugify } from "@/lib/content/slug";
import { CALLOUT_ROTULO } from "@/lib/blocks/schema";
import { highlightCode } from "@/lib/content/highlight";
import { PortalTabs } from "@/components/portal/tabs";
import { CopyAnchor } from "@/components/portal/copy-anchor";
import { CodeCopy } from "@/components/portal/code-copy";
import { TableFrame } from "@/components/portal/table-frame";
import { cellBgClass } from "./table-styles";
import { MermaidView } from "@/components/editor/mermaid-view";
import { ChartView } from "@/components/portal/chart-view";
import { FlowView } from "@/components/portal/flow-view";
import type { TocItem } from "@/components/portal/toc";
import { embedIframe } from "./embed";
import { type Block, type RichText } from "./schema";
import { richToText } from "./serialize";
import { styleClass } from "./styles";
import { formatarBytes, extensaoDoNome } from "./file-utils";
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
      return (
        <figure className="my-5 rounded-lg border border-brand-purple-100 bg-brand-purple-50/50 p-5 dark:border-brand-purple-900 dark:bg-brand-purple-950/30">
          <QuoteIcon className="mb-2 size-5 text-brand-purple-300" aria-hidden="true" />
          <blockquote className="!m-0 !border-0 !p-0 font-medium leading-[1.6] not-italic !text-text">
            {renderRich(block.text)}
          </blockquote>
          {block.data?.author?.trim() ? (
            <figcaption className="mt-2 text-xs font-medium text-primary">
              {block.data.author}
            </figcaption>
          ) : null}
        </figure>
      );
    case "breadcrumb": {
      const partes = richToText(block.text)
        .split(/\s*[›»>/]\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!partes.length) return null;
      return (
        <nav
          aria-label="Trilha de navegação"
          className="my-4 flex flex-wrap items-center gap-1.5 text-sm text-text-muted"
        >
          {partes.map((p, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="size-3.5 text-brand-gray-400" aria-hidden="true" />}
              <span className={i === partes.length - 1 ? "font-medium text-text" : ""}>{p}</span>
            </span>
          ))}
        </nav>
      );
    }
    case "divider":
      return (
        <div className="my-7 flex items-center gap-3" role="separator">
          <span className="h-px flex-1 bg-border" />
          <span className="size-1.5 rounded-full bg-border-strong" />
          <span className="h-px flex-1 bg-border" />
        </div>
      );

    case "code": {
      const code = block.data.code;
      const lang = block.data.language ?? undefined;
      const filename = block.data.filename;
      const html = highlightCode(code, lang);
      return (
        /* Janela estilo terminal: 3 pontos + nome do arquivo + linguagem. */
        <div className="code-window my-4 overflow-hidden rounded-lg border border-brand-gray-800 bg-brand-gray-950 shadow-1">
          <div className="flex items-center justify-between border-b border-brand-gray-800 px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-rose-500/80" />
              <span className="size-2.5 rounded-full bg-amber-500/80" />
              <span className="size-2.5 rounded-full bg-emerald-500/80" />
              {filename && (
                <span className="ml-2 font-mono text-xs text-brand-gray-400">{filename}</span>
              )}
            </div>
            {lang && (
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-brand-gray-500">
                {lang}
              </span>
            )}
          </div>
          <pre className="slim-scroll relative !my-0 !rounded-none !border-0 !bg-transparent !p-4 font-mono text-[13px] leading-[1.6] !text-brand-gray-100">
            <CodeCopy code={code} />
            {html ? (
              <code className="hljs text-brand-gray-100" dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <code className="text-brand-gray-100">{code}</code>
            )}
          </pre>
        </div>
      );
    }

    case "image": {
      const { src, alt, caption, size } = block.data;
      if (!src) return null;
      return (
        <figure className="my-5 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            className={`mx-auto rounded-lg border border-border shadow-1 ${
              size === "wide" ? "w-full max-w-[36rem]" : size === "medium" ? "w-full max-w-[24rem]" : ""
            }`}
          />
          {caption ? (
            <figcaption className="mt-2 text-center text-xs text-text-muted">{caption}</figcaption>
          ) : null}
        </figure>
      );
    }

    case "video": {
      const { provider, url } = block.data;
      if (provider === "upload")
        return (
          /* preload="none": ZERO bytes até o play — na leitura contínua uma
             página pode ter vários vídeos, e até o metadata de um .mov (moov
             no fim do arquivo) pode custar caro. Ao dar play, o navegador
             bufferiza em pedaços via HTTP Range (o Storage responde 206 —
             verificado), nunca o arquivo inteiro de uma vez. */
          <video
            src={url}
            controls
            preload="none"
            className="my-5 mx-auto w-full max-w-full rounded-lg border border-border bg-black/90 shadow-1"
          />
        );
      let embed = url;
      if (provider === "youtube") {
        const id = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/)?.[1];
        embed = id ? `https://www.youtube.com/embed/${id}` : url;
      } else if (provider === "vimeo") {
        const id = url.match(/vimeo\.com\/(\d+)/)?.[1];
        embed = id ? `https://player.vimeo.com/video/${id}` : url;
      }
      return (
        <div className="relative my-5 aspect-video overflow-hidden rounded-lg border border-border shadow-1">
          <iframe src={embed} className="absolute inset-0 size-full" allowFullScreen title="Vídeo" />
        </div>
      );
    }

    case "embed":
      return renderEmbed(block);

    case "file": {
      const { url, name, size } = block.data;
      if (!url) return null;
      return <FileCardView url={url} name={name} size={size} />;
    }

    case "button": {
      const { href, variant, label } = block.data;
      return (
        <div className="my-5">
          <a
            href={href}
            className={
              variant === "secondary"
                ? "inline-flex items-center gap-2 rounded-md border border-brand-purple-200 bg-surface px-5 py-2.5 text-sm font-semibold text-primary no-underline shadow-1 transition-all hover:border-brand-purple-400 hover:bg-brand-purple-50 dark:border-brand-purple-800 dark:hover:bg-brand-purple-950/40"
                : "inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg no-underline shadow-1 transition-all hover:bg-primary-hover hover:shadow-2"
            }
          >
            {label}
          </a>
        </div>
      );
    }

    case "callout": {
      const base = CALLOUT[block.data.variant] ?? CALLOUT.info;
      const Icon = iconByKey(block.styles?.icon) ?? base.Icon;
      const titulo = block.data.title?.trim() || (CALLOUT_ROTULO[block.data.variant] ?? CALLOUT_ROTULO.info);
      return (
        /* Anatomia da referência: cartão com quadrado de ícone + TÍTULO
           específico ("Limite de importação") ou o rótulo da variante. */
        <div className={`my-4 flex gap-3 rounded-lg border p-4 ${base.cls}`}>
          <span
            aria-hidden="true"
            className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md ${base.iconWrap}`}
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="!mb-0.5 !mt-0 text-sm font-semibold text-text">{titulo}</p>
            <div className="min-w-0 text-[length:var(--l-body,0.9375rem)] leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              {renderChildren(block.children, ctx)}
            </div>
          </div>
        </div>
      );
    }

    case "steps":
      return <div className="my-5 [counter-reset:step]">{renderChildren(block.children, ctx)}</div>;
    case "step":
      return (
        <div className="relative pb-6 pl-11 last:pb-0 [counter-increment:step] before:absolute before:left-0 before:top-0 before:z-10 before:flex before:size-8 before:items-center before:justify-center before:rounded-full before:bg-primary before:text-sm before:font-semibold before:text-primary-fg before:shadow-1 before:ring-4 before:ring-brand-purple-50 before:content-[counter(step)] after:absolute after:bottom-0 after:left-[15px] after:top-8 after:w-px after:bg-gradient-to-b after:from-brand-purple-300 after:to-brand-purple-100 last:after:hidden dark:before:ring-brand-purple-950 dark:after:from-brand-purple-800 dark:after:to-brand-purple-950 [&>*:first-child]:mt-0 [&>*:first-child]:pt-1">
          {block.data?.title?.trim() ? (
            <div className="pt-1 text-sm font-semibold">{block.data.title}</div>
          ) : null}
          {renderChildren(block.children, ctx)}
        </div>
      );

    case "accordion":
      /* Cartão ÚNICO da referência: itens separados por border-b. */
      return (
        <div className="my-4 rounded-lg border border-border bg-surface px-5 shadow-1 [&>details]:border-b [&>details]:border-border [&>details:last-child]:border-b-0">
          {renderChildren(block.children, ctx)}
        </div>
      );
    case "accordionItem": {
      const ItemIcon = iconByKey(block.styles?.icon);
      return (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3.5 text-left text-sm font-medium transition-colors hover:text-primary">
            <span className="flex min-w-0 items-center gap-2">
              {ItemIcon && <ItemIcon className="size-4 shrink-0 text-primary" />}
              {block.data.title}
            </span>
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 text-text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <div className="pb-4 text-sm leading-[1.6] text-text-muted [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
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
            <p className="mt-1.5 text-[length:var(--l-hero,1.0625rem)] font-semibold leading-tight tracking-tight sm:text-[length:var(--l-hero,1.1875rem)]">
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
      const cores = block.data.cellColors;
      const rows = block.data.rows;
      const headRowIdx = block.data.hasHeader ? 0 : -1;
      const [head, ...rest] = block.data.hasHeader
        ? [rows[0] ?? [], ...rows.slice(1)]
        : [null, ...rows];
      // Rola dentro do próprio contêiner (TableFrame) — uma tabela larga jamais
      // faz a PÁGINA rolar — e ganha o botão "Expandir" quando há colunas
      // escondidas pelo scroll.
      return (
        <TableFrame borders={block.data.borders ?? "rows"} striped={block.data.striped ?? true}>
          <table>
            {head && (
              <thead>
                <tr>
                  {head.map((cell, ci) => (
                    <th key={ci} scope="col" className={cellBgClass(cores, 0, ci)}>
                      {renderRich(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rest.map((row, ri) => {
                const realR = headRowIdx === 0 ? ri + 1 : ri;
                return (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className={cellBgClass(cores, realR, ci)}>
                        {renderRich(cell)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableFrame>
      );
    }

    case "mermaid":
      return <MermaidView code={block.data.code} />;

    case "chart":
      return <ChartView data={block.data} />;

    case "flow":
      return <FlowView data={block.data} />;

    case "checklist":
      return (
        <ul className="nao-prosa my-4 list-none space-y-2 !pl-0">
          {block.data.items.map((item) => (
            <li key={item.id} className="flex items-start gap-2.5 text-sm">
              <span
                aria-hidden="true"
                className={`mt-0.5 flex size-[1.125rem] shrink-0 items-center justify-center rounded-sm border ${
                  item.checked
                    ? "border-primary bg-primary text-primary-fg"
                    : "border-border-strong bg-surface"
                }`}
              >
                {item.checked && <Check className="size-3" />}
              </span>
              <span className={item.checked ? "text-text-muted line-through" : ""}>
                {renderRich(item.text)}
              </span>
            </li>
          ))}
        </ul>
      );

    case "stats":
      return (
        <div className="nao-prosa my-5 grid gap-3 sm:grid-cols-3">
          {block.data.items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-border bg-gradient-to-b from-surface to-surface-2/60 p-4 shadow-1"
            >
              <p className="!m-0 text-2xl font-bold tracking-tight text-primary">{item.value}</p>
              <p className="!mb-0 !mt-1 text-sm font-semibold">{item.label}</p>
              {item.trend && <p className="!mb-0 !mt-0.5 text-xs text-text-muted">{item.trend}</p>}
            </div>
          ))}
        </div>
      );

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
 * Callouts nos tons semânticos LITERAIS da referência Lumina:
 * info=sky · success=emerald · warning=amber · danger=rose · note=violet.
 * O título fica em texto pleno; o tom vive na borda, no fundo tênue e no
 * quadrado do ícone. A cor nunca carrega o significado sozinha — o ícone
 * sempre acompanha.
 */
const CALLOUT = {
  info: {
    Icon: Info,
    cls: "border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/30",
    iconWrap: "bg-sky-100 text-sky-600 dark:bg-sky-900/60 dark:text-sky-400",
  },
  success: {
    Icon: CheckCircle2,
    cls: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30",
    iconWrap: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-400",
  },
  warning: {
    Icon: AlertTriangle,
    cls: "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30",
    iconWrap: "bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-400",
  },
  danger: {
    Icon: OctagonAlert,
    cls: "border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/30",
    iconWrap: "bg-rose-100 text-rose-600 dark:bg-rose-900/60 dark:text-rose-400",
  },
  note: {
    Icon: Lightbulb,
    cls: "border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/30",
    iconWrap: "bg-violet-100 text-violet-600 dark:bg-violet-900/60 dark:text-violet-400",
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
      <div className="relative my-5 overflow-hidden rounded-lg border border-border" style={{ aspectRatio: frame.aspect }}>
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
/**
 * Card de arquivo para download — usado pelo portal E pela prévia do editor
 * (contrato WYSIWYG: um lugar só desenha o card). `size` 0 = tamanho oculto.
 */
export function FileCardView({ url, name, size }: { url: string; name: string; size: number }) {
  const rotulo = name.trim() || url.split("/").pop() || "arquivo";
  const tamanho = formatarBytes(size);
  return (
    <div className="my-3">
      <a
        href={url}
        download
        target="_blank"
        rel="noopener noreferrer"
        className="group flex w-full max-w-md items-center gap-4 rounded-lg border border-border bg-surface p-4 no-underline shadow-1 transition-all hover:border-brand-purple-300 hover:shadow-2 dark:hover:border-brand-purple-700"
      >
        <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-md bg-brand-purple-50 text-primary dark:bg-brand-purple-950/40">
          <FileDown className="size-4" aria-hidden />
          <span className="mt-0.5 text-[0.5625rem] font-bold leading-none tracking-wide">
            {extensaoDoNome(rotulo)}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-text">{rotulo}</span>
          <span className="block text-xs text-text-muted">
            {tamanho ? `${tamanho} · ` : ""}Clique para baixar
          </span>
        </span>
        {/* No hover do CARTÃO o botão inverte: borda+fundo primários, seta branca. */}
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-brand-gray-400 transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-fg"
        >
          <Download className="size-4" />
        </span>
      </a>
    </div>
  );
}

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
