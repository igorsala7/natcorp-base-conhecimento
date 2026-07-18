import { Fragment, type ReactNode } from "react";
import DOMPurify from "isomorphic-dompurify";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  OctagonAlert,
} from "lucide-react";
import { slugify } from "@/lib/content/slug";
import { PortalTabs } from "./tabs";
import { CopyAnchor } from "./copy-anchor";
import type { TocItem } from "./toc";

type TipTapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

type Ctx = {
  slugs: Set<string>;
  snippets: Map<string, TipTapNode>;
};

function uniqueSlug(ctx: Ctx, text: string) {
  const base = slugify(text) || "secao";
  let slug = base;
  let i = 1;
  while (ctx.slugs.has(slug)) slug = `${base}-${++i}`;
  ctx.slugs.add(slug);
  return slug;
}

function textOf(node: TipTapNode): string {
  if (node.text) return node.text;
  return (node.content ?? []).map(textOf).join("");
}

/** Extrai H2/H3 para o índice da página (mesma slugificação do render). */
export function extractToc(docInput: unknown): TocItem[] {
  const doc = docInput as TipTapNode;
  const slugs = new Set<string>();
  const items: TocItem[] = [];
  const walk = (n: TipTapNode) => {
    if (n.type === "heading") {
      const level = (n.attrs?.level as number) ?? 1;
      if (level === 2 || level === 3) {
        const text = textOf(n);
        const base = slugify(text) || "secao";
        let slug = base;
        let i = 1;
        while (slugs.has(slug)) slug = `${base}-${++i}`;
        slugs.add(slug);
        items.push({ id: slug, text, level });
      }
    }
    (n.content ?? []).forEach(walk);
  };
  walk(doc);
  return items;
}

const CALLOUT = {
  info: { Icon: Info, cls: "border-brand-blue-400 bg-brand-blue-50 dark:bg-brand-blue-950/30" },
  warning: { Icon: AlertTriangle, cls: "border-brand-pink-400 bg-brand-pink-50 dark:bg-brand-pink-950/30" },
  success: { Icon: CheckCircle2, cls: "border-brand-purple-400 bg-brand-purple-50 dark:bg-brand-purple-950/30" },
  danger: { Icon: OctagonAlert, cls: "border-brand-pink-500 bg-brand-pink-100 dark:bg-brand-pink-950/40" },
} as const;

function applyMarks(text: string, marks: TipTapNode["marks"], key: number): ReactNode {
  let el: ReactNode = text;
  for (const mark of marks ?? []) {
    if (mark.type === "bold") el = <strong>{el}</strong>;
    else if (mark.type === "italic") el = <em>{el}</em>;
    else if (mark.type === "strike") el = <s>{el}</s>;
    else if (mark.type === "code") el = <code>{el}</code>;
    else if (mark.type === "link")
      el = (
        <a href={String(mark.attrs?.href ?? "#")} rel="noopener noreferrer" className="text-primary underline-offset-4 hover:underline">
          {el}
        </a>
      );
  }
  return <Fragment key={key}>{el}</Fragment>;
}

function renderChildren(nodes: TipTapNode[] | undefined, ctx: Ctx): ReactNode {
  return (nodes ?? []).map((n, i) => renderNode(n, i, ctx));
}

function renderNode(node: TipTapNode, key: number, ctx: Ctx): ReactNode {
  switch (node.type) {
    case "text":
      return applyMarks(node.text ?? "", node.marks, key);

    case "paragraph":
      return <p key={key}>{renderChildren(node.content, ctx)}</p>;

    case "heading": {
      const level = (node.attrs?.level as number) ?? 1;
      const text = textOf(node);
      if (level === 1) return <h1 key={key}>{renderChildren(node.content, ctx)}</h1>;
      const id = uniqueSlug(ctx, text);
      const Tag = (level === 2 ? "h2" : "h3") as "h2" | "h3";
      return (
        <Tag key={key} id={id} className="group scroll-mt-24">
          {renderChildren(node.content, ctx)}
          <CopyAnchor anchor={id} />
        </Tag>
      );
    }

    case "bulletList":
      return <ul key={key}>{renderChildren(node.content, ctx)}</ul>;
    case "orderedList":
      return <ol key={key}>{renderChildren(node.content, ctx)}</ol>;
    case "listItem":
      return <li key={key}>{renderChildren(node.content, ctx)}</li>;
    case "blockquote":
      return <blockquote key={key}>{renderChildren(node.content, ctx)}</blockquote>;
    case "horizontalRule":
      return <hr key={key} />;
    case "hardBreak":
      return <br key={key} />;

    case "codeBlock":
      return (
        <pre key={key}>
          <code>{textOf(node)}</code>
        </pre>
      );

    case "table":
      return (
        <div key={key} className="my-4 overflow-x-auto">
          <table>
            <tbody>{renderChildren(node.content, ctx)}</tbody>
          </table>
        </div>
      );
    case "tableRow":
      return <tr key={key}>{renderChildren(node.content, ctx)}</tr>;
    case "tableHeader":
      return <th key={key}>{renderChildren(node.content, ctx)}</th>;
    case "tableCell":
      return <td key={key}>{renderChildren(node.content, ctx)}</td>;

    case "callout": {
      const variant = (node.attrs?.variant as keyof typeof CALLOUT) ?? "info";
      const { Icon, cls } = CALLOUT[variant] ?? CALLOUT.info;
      return (
        <div key={key} className={`my-4 flex gap-3 rounded-lg border-l-4 p-4 ${cls}`}>
          <Icon className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {renderChildren(node.content, ctx)}
          </div>
        </div>
      );
    }

    case "steps":
      return (
        <div key={key} className="my-4 [counter-reset:step]">
          {renderChildren(node.content, ctx)}
        </div>
      );
    case "stepItem":
      return (
        <div key={key} className="relative mb-4 border-l-2 border-border pb-1 pl-8 [counter-increment:step] before:absolute before:left-[-13px] before:top-0 before:flex before:size-6 before:items-center before:justify-center before:rounded-full before:bg-primary before:text-xs before:font-semibold before:text-primary-fg before:content-[counter(step)] [&>*:first-child]:mt-0">
          {renderChildren(node.content, ctx)}
        </div>
      );

    case "accordion":
      return <div key={key} className="my-4 space-y-1">{renderChildren(node.content, ctx)}</div>;
    case "accordionItem":
      return (
        <details key={key} className="overflow-hidden rounded-md border border-border">
          <summary className="cursor-pointer bg-surface-2 px-3 py-2 text-sm font-medium">
            {String(node.attrs?.title ?? "Seção")}
          </summary>
          <div className="p-3 [&>*:first-child]:mt-0">{renderChildren(node.content, ctx)}</div>
        </details>
      );

    case "tabs": {
      const items = node.content ?? [];
      const labels = items.map((it) => String(it.attrs?.label ?? "Aba"));
      const panels = items.map((it, i) => (
        <div key={i} className="[&>*:first-child]:mt-0">
          {renderChildren(it.content, ctx)}
        </div>
      ));
      return <PortalTabs key={key} labels={labels} panels={panels} />;
    }

    case "figureImage": {
      const src = node.attrs?.src as string | undefined;
      if (!src) return null;
      return (
        <figure key={key} className="my-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={String(node.attrs?.alt ?? "")} className="mx-auto rounded-lg" />
          {node.attrs?.caption ? (
            <figcaption className="mt-2 text-sm text-text-muted">
              {String(node.attrs.caption)}
            </figcaption>
          ) : null}
        </figure>
      );
    }

    case "video": {
      const provider = String(node.attrs?.provider ?? "youtube");
      const src = String(node.attrs?.src ?? "");
      if (provider === "upload") {
        return <video key={key} src={src} controls className="my-6 mx-auto rounded-lg" />;
      }
      let embed = src;
      if (provider === "youtube") {
        const id = src.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/)?.[1];
        embed = id ? `https://www.youtube.com/embed/${id}` : src;
      } else if (provider === "vimeo") {
        const id = src.match(/vimeo\.com\/(\d+)/)?.[1];
        embed = id ? `https://player.vimeo.com/video/${id}` : src;
      }
      return (
        <div key={key} className="relative my-6 aspect-video overflow-hidden rounded-lg">
          <iframe src={embed} className="absolute inset-0 size-full" allowFullScreen title="Vídeo" />
        </div>
      );
    }

    case "linkCard": {
      const url = String(node.attrs?.url ?? "#");
      return (
        <a key={key} href={url} className="my-3 block rounded-lg border border-border p-4 no-underline transition hover:border-primary">
          <div className="font-semibold text-text">{String(node.attrs?.title ?? url)}</div>
          {node.attrs?.description ? (
            <div className="mt-1 text-sm text-text-muted">{String(node.attrs.description)}</div>
          ) : null}
          <div className="mt-1 text-xs text-primary">{url}</div>
        </a>
      );
    }

    case "htmlEmbed": {
      const clean = DOMPurify.sanitize(String(node.attrs?.html ?? ""));
      return <div key={key} className="my-4" dangerouslySetInnerHTML={{ __html: clean }} />;
    }

    case "snippet": {
      const snippetKey = String(node.attrs?.snippetKey ?? "");
      const snippet = ctx.snippets.get(snippetKey);
      if (!snippet) return null; // snippet inexistente → não renderiza
      return <Fragment key={key}>{renderChildren(snippet.content, ctx)}</Fragment>;
    }

    default:
      // Tipos desconhecidos: tenta renderizar filhos para não perder conteúdo.
      return <Fragment key={key}>{renderChildren(node.content, ctx)}</Fragment>;
  }
}

/** Renderiza um documento TipTap publicado como React. */
export function RenderDoc({
  doc,
  snippets,
}: {
  doc: unknown;
  snippets: Map<string, unknown>;
}) {
  const ctx: Ctx = {
    slugs: new Set(),
    snippets: snippets as Map<string, TipTapNode>,
  };
  return <>{renderChildren((doc as TipTapNode).content, ctx)}</>;
}
