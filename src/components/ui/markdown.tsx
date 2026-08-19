import React from "react";

/**
 * Renderizador de Markdown leve e seguro (sem dependências externas).
 * Cobre o que a IA usa nas respostas: títulos, listas, negrito/itálico,
 * código (inline e bloco), links e parágrafos. Como devolve elementos React
 * (nunca HTML cru), é imune a XSS; hrefs são validados.
 */

/**
 * Só permite esquemas seguros — e quando não é URL, NÃO vira link.
 *
 * O `#` de antes não era inerte: clicar navegava para a própria página. O modelo
 * escreve `[Baixar Relatório](relatorio-auditoria.pdf)`, só o nome do arquivo,
 * e o leitor clicava achando que baixaria — a página recarregava e a conversa
 * saía da tela. O arquivo de verdade vem separado, no chip de download.
 */
function safeHref(href: string): string | null {
  const h = href.trim();
  return /^(https?:|mailto:|\/)/i.test(h) ? h : null;
}

/**
 * A CITAÇÃO `[1]` vem PRIMEIRO na alternância, e a negativa `(?!\()` é o que a
 * separa de um link `[texto](url)`: sem ela, `[1](http://x)` casaria como
 * citação e o link viraria texto solto.
 */
const INLINE =
  /(<br\s*\/?>)|(\[\d{1,2}\](?!\())|(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))|(\*[^*]+\*)|(_[^_]+_)/g;

/** Como a citação é desenhada — quem sabe se o número EXISTE é quem chama. */
export type CitacaoProps = {
  /** `true` se `n` está na lista de fontes desta resposta. */
  existe: (n: number) => boolean;
  /** Clique: abrir a sanfona de fontes e destacar o cartão. */
  onIr: (n: number) => void;
};

/** Formatação inline: citação `[1]`, `code`, **negrito**, *itálico*, [texto](url). */
function renderInline(text: string, keyBase: string, cit?: CitacaoProps): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    // `<br>` vem do relatório do ERP, que quebra a lista de verbas de propósito
    // (uma verba por linha). É a ÚNICA tag interpretada; nada mais aqui lê HTML,
    // e este renderizador devolve elementos React — não existe caminho de HTML
    // cru por onde outra tag pudesse entrar.
    if (/^<br/i.test(tok)) {
      out.push(<br key={`${keyBase}-${k++}`} />);
      last = INLINE.lastIndex;
      continue;
    }
    const numero = /^\[(\d{1,2})\]$/.exec(tok);
    if (numero) {
      const n = Number(numero[1]);
      // Só vira botão se a fonte EXISTE. O modelo às vezes escreve [3] com duas
      // fontes na lista; um botão que não leva a lugar nenhum repete o defeito
      // que isto veio consertar, agora com afordância de clique.
      if (cit?.existe(n)) {
        out.push(
          <button
            key={`${keyBase}-${k++}`}
            type="button"
            onClick={() => cit.onIr(n)}
            title={`Ver a fonte ${n}`}
            className="mx-0.5 rounded bg-primary/10 px-1 align-baseline text-[0.75em] font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            {n}
          </button>,
        );
      } else {
        out.push(tok);
      }
    } else if (tok.startsWith("`")) {
      out.push(
        <code key={`${keyBase}-${k++}`} className="rounded bg-surface-2 px-1 py-0.5 text-[0.85em]">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith("**")) {
      out.push(<strong key={`${keyBase}-${k++}`}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("[")) {
      const label = tok.slice(1, tok.indexOf("]"));
      const href = safeHref(tok.slice(tok.indexOf("(") + 1, -1));
      if (!href) { out.push(label); last = INLINE.lastIndex; continue; }
      out.push(
        <a
          key={`${keyBase}-${k++}`}
          href={href}
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

/**
 * TABELA — o formato natural das respostas com dados ("quantos por unidade",
 * "quanto por competência"), e o que faltava nos dois renderizadores: sem isto
 * a resposta chega como parede de canos verticais.
 *
 * A largura fica no BLOCO, não na conversa: o `overflow-x` mora no wrapper da
 * tabela. Sem isso, uma tabela de oito colunas põe a conversa inteira para
 * rolar na horizontal, e o texto das outras mensagens sai da tela junto.
 */
const linhaDeTabela = (l: string | undefined): boolean => !!l && /^\s*\|.*\|\s*$/.test(l);
/** Separador `|---|:--:|` — é ele que distingue tabela de um texto com canos. */
const separadorDeTabela = (l: string | undefined): boolean =>
  !!l && /^\s*\|[\s:|-]*-[\s:|-]*\|\s*$/.test(l);

function celulas(linha: string): string[] {
  return linha.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

/** `:--` esquerda, `--:` direita, `:-:` centro — o que o markdown padrão diz. */
function alinhamentos(sep: string): ("left" | "center" | "right")[] {
  return celulas(sep).map((c) => {
    const ini = c.startsWith(":");
    const fim = c.endsWith(":");
    return ini && fim ? "center" : fim ? "right" : "left";
  });
}

export function Markdown({ content, citacao }: { content: string; citacao?: CitacaoProps }) {
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

    // Tabela | a | b | + separador. Antes das listas: a linha de separador
    // (`|---|`) começa por `|`, mas as células podem conter hífen e vírgula, e
    // deixar o parágrafo pegá-la primeiro devolveria os canos como texto.
    if (linhaDeTabela(line) && separadorDeTabela(lines[i + 1])) {
      const head = celulas(line);
      const align = alinhamentos(lines[i + 1]!);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && linhaDeTabela(lines[i])) {
        rows.push(celulas(lines[i]!));
        i++;
      }
      const cls = (j: number) =>
        align[j] === "right" ? "text-right" : align[j] === "center" ? "text-center" : "text-left";
      blocks.push(
        <div key={key++} className="my-2 overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-xs">
            <thead>
              <tr>
                {head.map((c, j) => (
                  <th
                    key={j}
                    className={`border-b border-border px-2 py-1 font-semibold ${cls(j)}`}
                  >
                    {renderInline(c, `th${key}-${j}`, citacao)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {/* Percorre o CABEÇALHO, não a linha: célula faltando vira
                      vazia, e sobra é descartada — linha torta não desalinha
                      a tabela inteira. */}
                  {head.map((_, j) => (
                    <td key={j} className={`border-b border-border/60 px-2 py-1 align-top ${cls(j)}`}>
                      {renderInline(r[j] ?? "", `td${key}-${ri}-${j}`, citacao)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
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
          {renderInline(h[2]!, `h${key}`, citacao)}
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
            <li key={j}>{renderInline(it, `ul${key}-${j}`, citacao)}</li>
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
            <li key={j}>{renderInline(it, `ol${key}-${j}`, citacao)}</li>
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
        {renderInline(para.join("\n"), `p${key}`, citacao)}
      </p>,
    );
  }

  return <div className="text-sm [&>*:first-child]:mt-0">{blocks}</div>;
}
