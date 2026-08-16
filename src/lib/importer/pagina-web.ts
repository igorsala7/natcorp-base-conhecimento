/**
 * UMA PÁGINA DA WEB VIRA DOCUMENTO PARA O CHATBOT.
 *
 * A base de conhecimento aceitava arquivo — PDF, DOCX, HTML solto. Só que muita
 * documentação de fornecedor, norma e procedimento vive numa URL e não num
 * arquivo: baixar o PDF, subir e refazer isso a cada revisão é trabalho que o
 * scraping dispensa.
 *
 * ── O problema real não é buscar o HTML, é achar o CONTEÚDO nele ────────────
 * Uma página tem menu, rodapé, banner de cookie, "artigos relacionados" e
 * newsletter. Indexar tudo isso enche os chunks de ruído e faz o chatbot citar
 * o menu como se fosse resposta. Por isso a extração vai atrás do miolo, na
 * ordem em que a web de fato o marca:
 *
 *   1. `<article>` — quem usa, usa certo;
 *   2. `<main>` — o padrão do HTML5;
 *   3. `[role="main"]` — variação comum em tema antigo;
 *   4. a maior densidade de `<p>` — quando nada acima existe, o miolo é o
 *      bloco com mais texto corrido, e não o com mais elementos (menu tem
 *      dezenas de links e quase nenhuma prosa).
 *
 * ── Título e hierarquia ─────────────────────────────────────────────────────
 * O `<title>` da aba costuma trazer o nome do site junto ("Como pedir férias —
 * RH Acme"), e esse sufixo repetido em todo documento polui a busca. O `<h1>`
 * do miolo é mais fiel; o `<title>` fica de reserva, com o sufixo cortado.
 *
 * Os headings viram Markdown para o chunker manter o `heading_path` — é ele que
 * dá ao chatbot o "Financeiro > Faturamento > Emitir NF" das citações. Perder a
 * hierarquia aqui transforma a página num bloco de texto sem endereço.
 *
 * Puro: recebe HTML, devolve texto. Quem busca (com a trava SSRF) é o chamador.
 */

export type PaginaExtraida = {
  titulo: string;
  /** Markdown com a hierarquia preservada. */
  conteudo: string;
  /** Quantos caracteres de texto sobraram — abaixo de ~200 não vale indexar. */
  caracteres: number;
};

/** Remove o que nunca é conteúdo, antes de qualquer outra decisão. */
function semRuido(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|svg|iframe|form)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(nav|header|footer|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
}

/** O bloco com mais PROSA — menu tem muitos elementos e pouca prosa. */
function maiorDensidadeDeTexto(html: string): string | null {
  let melhor: string | null = null;
  let maior = 0;
  for (const m of html.matchAll(/<(div|section)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const bloco = m[2] ?? "";
    const prosa = (bloco.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) ?? []).join(" ");
    const n = prosa.replace(/<[^>]+>/g, "").trim().length;
    if (n > maior) {
      maior = n;
      melhor = bloco;
    }
  }
  return maior > 200 ? melhor : null;
}

function miolo(html: string): string {
  for (const rx of [
    /<article\b[^>]*>([\s\S]*?)<\/article>/i,
    /<main\b[^>]*>([\s\S]*?)<\/main>/i,
    /<[^>]+role=["']main["'][^>]*>([\s\S]*?)<\/[a-z]+>/i,
  ]) {
    const m = html.match(rx);
    if (m?.[1] && m[1].replace(/<[^>]+>/g, "").trim().length > 200) return m[1];
  }
  return maiorDensidadeDeTexto(html) ?? html;
}

function texto(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .replace(/[ \t ]+/g, " ")
    .trim();
}

/**
 * Título: o `<h1>` do miolo vence o `<title>` da aba.
 *
 * O `<title>` quase sempre carrega o nome do site ("Como pedir férias — RH
 * Acme"), e esse sufixo repetido em todo documento indexado polui a busca. Se
 * só houver `<title>`, o sufixo é cortado no separador.
 */
function acharTitulo(htmlCompleto: string, htmlMiolo: string): string {
  const h1 = htmlMiolo.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const doH1 = h1?.[1] ? texto(h1[1]) : "";
  if (doH1.length > 2) return doH1;

  const t = htmlCompleto.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const bruto = t?.[1] ? texto(t[1]) : "";
  return bruto.split(/\s+[|–—-]\s+/)[0]?.trim() || bruto || "Página sem título";
}

export function extrairPaginaWeb(html: string): PaginaExtraida {
  const limpo = semRuido(html);
  const corpo = miolo(limpo);
  const titulo = acharTitulo(limpo, corpo);

  const linhas: string[] = [];
  // Percorre na ORDEM do documento: heading, parágrafo, item de lista e célula.
  // Sem isso a hierarquia se perde e o chunker não consegue montar o
  // `heading_path` que vira a citação do chatbot.
  for (const m of corpo.matchAll(
    /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>|<p\b[^>]*>([\s\S]*?)<\/p>|<li\b[^>]*>([\s\S]*?)<\/li>|<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi,
  )) {
    const [, tag, hTexto, pTexto, liTexto, tdTexto] = m;
    if (tag && hTexto !== undefined) {
      const t = texto(hTexto);
      if (t) linhas.push(`\n${"#".repeat(Number(tag[1]))} ${t}\n`);
    } else {
      const t = texto(pTexto ?? liTexto ?? tdTexto ?? "");
      // Fragmento de duas palavras costuma ser rótulo de UI, não conteúdo.
      if (t.length > 2) linhas.push(liTexto !== undefined ? `- ${t}` : t);
    }
  }

  const conteudo = linhas.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { titulo, conteudo, caracteres: conteudo.replace(/[#\-\s]/g, "").length };
}
