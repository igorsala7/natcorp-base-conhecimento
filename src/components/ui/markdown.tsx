import React from "react";

/**
 * Renderizador de Markdown leve e seguro (sem dependências externas).
 * Cobre o que a IA usa nas respostas: títulos, listas, negrito/itálico,
 * código (inline e bloco), links e parágrafos. Como devolve elementos React
 * (nunca HTML cru), é imune a XSS; hrefs são validados.
 */

/** Só permite esquemas seguros; caso contrário, vira link inerte. */
function safeHref(href: string): string {
  const h = href.trim();
  if (/^(https?:|mailto:|\/|#)/i.test(h)) return h;
  return "#";
}

const INLINE =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))|(\*[^*]+\*)|(_[^_]+_)/g;

/** Formatação inline: `code`, **negrito**, *itálico*, _itálico_, [texto](url). */
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) {
      out.push(
        <code key={`${keyBase}-${k++}`} className="rounded bg-surface-2 px-1 py-0.5 text-[0.85em]">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith("**")) {
      out.push(<strong key={`${keyBase}-${k++}`}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("[")) {
      const label = tok.slice(1, tok.indexOf("]"));
      const href = tok.slice(tok.indexOf("(") + 1, -1);
      out.push(
        <a
          key={`${keyBase}-${k++}`}
          href={safeHref(href)}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary hover:underline"
        >
          {label}
        </a>,
      );
    } else {
      // *itálico* ou _itálico_
      out.push(<em key={`${keyBase}-${k++}`}>{tok.slice(1, -1)}</em>);
    }
    last = INLINE.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Bloco de código ```
    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith("```")) {
        code.push(lines[i]!);
        i++;
      }
      i++; // fecha ```
      blocks.push(
        <pre key={key++} className="my-2 overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs">
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Título #, ##, ###
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1]!.length;
      const size = level <= 1 ? "text-lg" : level === 2 ? "text-base" : "text-sm";
      blocks.push(
        <p key={key++} className={`mt-3 mb-1 font-semibold ${size}`}>
          {renderInline(h[2]!, `h${key}`)}
        </p>,
      );
      i++;
      continue;
    }

    // Lista não ordenada
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-1 list-disc space-y-0.5 pl-5">
          {items.map((it, j) => (
            <li key={j}>{renderInline(it, `ul${key}-${j}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Lista ordenada
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\s*\d+[.)]\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={key++} className="my-1 list-decimal space-y-0.5 pl-5">
          {items.map((it, j) => (
            <li key={j}>{renderInline(it, `ol${key}-${j}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Linha em branco
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Parágrafo: junta linhas até a próxima em branco/bloco.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !lines[i]!.trim().startsWith("```") &&
      !/^(#{1,6})\s+/.test(lines[i]!) &&
      !/^\s*[-*+]\s+/.test(lines[i]!) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]!)
    ) {
      para.push(lines[i]!);
      i++;
    }
    blocks.push(
      <p key={key++} className="my-1 leading-relaxed">
        {renderInline(para.join("\n"), `p${key}`)}
      </p>,
    );
  }

  return <div className="text-sm [&>*:first-child]:mt-0">{blocks}</div>;
}
