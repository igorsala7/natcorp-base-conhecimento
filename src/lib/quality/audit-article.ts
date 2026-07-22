/**
 * Auditoria de qualidade/SEO de um artigo (padrão "Optimize" do HubSpot):
 * meta description, alt de imagens, estrutura de títulos, links internos
 * quebrados e oportunidades de linkagem interna.
 *
 * PURA e isomórfica: roda no editor (feedback imediato) e no worker (scan da
 * documentação inteira). Links EXTERNOS não são checados aqui — isso é rede,
 * vive no worker com cache (`link_checks`).
 */
import type { Block, RichText } from "@/lib/blocks/schema";

export type Impacto = "alto" | "medio" | "baixo";

export type QualityIssue = {
  tipo: "meta" | "alt" | "heading" | "link" | "linkagem";
  impacto: Impacto;
  mensagem: string;
  /** Bloco de origem — o painel usa para selecionar/rolar até ele. */
  blockId?: string;
};

export type QualityContext = {
  /** Caminhos internos válidos, SEM "/docs/" e sem barra inicial: "espaco/a/b". */
  validPaths: Set<string>;
  /** Outros artigos publicados (para sugerir linkagem interna). */
  otherArticles: { title: string; path: string }[];
};

export type ArticleInput = {
  title: string;
  description: string | null;
  blocks: Block[];
};

const DESC_MIN = 50;
const DESC_MAX = 160;
const TITULO_MAX = 70;
const MAX_SUGESTOES = 3;

function richText(rt: RichText | undefined): string {
  return (rt ?? []).map((s) => s.text).join("");
}

function linksDoRich(rt: RichText | undefined): string[] {
  const out: string[] = [];
  for (const span of rt ?? []) {
    for (const m of span.marks ?? []) {
      if (m.type === "link" && m.href) out.push(m.href);
    }
  }
  return out;
}

type Walk = {
  headings: { id: string; level: number; texto: string }[];
  imagensSemAlt: string[];
  links: { blockId: string; href: string }[];
  textoCorrido: string[];
};

function walk(blocks: Block[], acc: Walk): void {
  for (const b of blocks) {
    if ("text" in b && b.text) {
      acc.textoCorrido.push(richText(b.text));
      for (const href of linksDoRich(b.text)) acc.links.push({ blockId: b.id, href });
    }
    switch (b.type) {
      case "heading":
        acc.headings.push({ id: b.id, level: b.data.level, texto: richText(b.text) });
        break;
      case "image":
        if (b.data.src && !b.data.alt.trim()) acc.imagensSemAlt.push(b.id);
        break;
      case "button":
      case "card":
        if (b.data.href) acc.links.push({ blockId: b.id, href: b.data.href });
        break;
      case "table":
        for (const row of b.data.rows) {
          for (const cell of row) {
            acc.textoCorrido.push(richText(cell));
            for (const href of linksDoRich(cell)) acc.links.push({ blockId: b.id, href });
          }
        }
        break;
      default:
        break;
    }
    if ("children" in b && b.children) walk(b.children, acc);
  }
}

/** "/docs/espaco/a/b#x?y" → "espaco/a/b"; null quando não é link interno de docs. */
export function caminhoInterno(href: string): string | null {
  if (!href.startsWith("/docs/")) return null;
  const semPrefixo = href.slice("/docs/".length);
  const limpo = semPrefixo.split(/[#?]/)[0]?.replace(/\/+$/, "") ?? "";
  return limpo || null;
}

export function auditArticle(artigo: ArticleInput, ctx: QualityContext): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // 1. Meta description (o card de busca/SEO do artigo).
  const desc = artigo.description?.trim() ?? "";
  if (!desc) {
    issues.push({
      tipo: "meta",
      impacto: "alto",
      mensagem: "Sem descrição (meta description) — busca e cards ficam sem resumo.",
    });
  } else if (desc.length < DESC_MIN) {
    issues.push({
      tipo: "meta",
      impacto: "baixo",
      mensagem: `Descrição curta (${desc.length} caracteres; ideal ${DESC_MIN}–${DESC_MAX}).`,
    });
  } else if (desc.length > DESC_MAX) {
    issues.push({
      tipo: "meta",
      impacto: "medio",
      mensagem: `Descrição longa (${desc.length} caracteres) — buscadores cortam em ~${DESC_MAX}.`,
    });
  }

  const acc: Walk = { headings: [], imagensSemAlt: [], links: [], textoCorrido: [] };
  walk(artigo.blocks, acc);

  // 2. Imagens sem texto alternativo (acessibilidade + SEO de imagem).
  for (const id of acc.imagensSemAlt) {
    issues.push({
      tipo: "alt",
      impacto: "medio",
      mensagem: "Imagem sem texto alternativo (alt).",
      blockId: id,
    });
  }

  // 3. Estrutura de títulos: nível pulado e título longo demais.
  let anterior = 0;
  for (const h of acc.headings) {
    if (anterior > 0 && h.level > anterior + 1) {
      issues.push({
        tipo: "heading",
        impacto: "medio",
        mensagem: `Título pula de nível (H${anterior} → H${h.level}) — leitores de tela se perdem.`,
        blockId: h.id,
      });
    }
    anterior = h.level;
    if (h.texto.length > TITULO_MAX) {
      issues.push({
        tipo: "heading",
        impacto: "baixo",
        mensagem: `Título com ${h.texto.length} caracteres — acima de ${TITULO_MAX} fica difícil de varrer.`,
        blockId: h.id,
      });
    }
  }

  // 4. Links internos quebrados (só /docs/…; externos ficam com o worker).
  for (const { blockId, href } of acc.links) {
    const caminho = caminhoInterno(href);
    if (caminho && !ctx.validPaths.has(caminho)) {
      issues.push({
        tipo: "link",
        impacto: "alto",
        mensagem: `Link interno quebrado: /docs/${caminho}`,
        blockId,
      });
    }
  }

  // 5. Oportunidade de linkagem interna: título de OUTRO artigo aparece como
  //    texto puro e nada aqui aponta para ele.
  const texto = acc.textoCorrido.join("\n").toLowerCase();
  const jaLinkados = new Set(
    acc.links.map((l) => caminhoInterno(l.href)).filter((c): c is string => !!c),
  );
  let sugestoes = 0;
  for (const outro of ctx.otherArticles) {
    if (sugestoes >= MAX_SUGESTOES) break;
    const t = outro.title.trim();
    // Título curto demais casa com qualquer coisa e vira ruído.
    if (t.length < 8) continue;
    if (texto.includes(t.toLowerCase()) && !jaLinkados.has(outro.path)) {
      issues.push({
        tipo: "linkagem",
        impacto: "baixo",
        mensagem: `"${t}" é citado no texto — vale linkar para /docs/${outro.path}.`,
      });
      sugestoes += 1;
    }
  }

  const peso: Record<Impacto, number> = { alto: 0, medio: 1, baixo: 2 };
  return issues.sort((a, b) => peso[a.impacto] - peso[b.impacto]);
}

/** Links http(s) únicos do artigo — o worker checa cada um com cache. */
export function collectExternalLinks(blocks: Block[]): string[] {
  const acc: Walk = { headings: [], imagensSemAlt: [], links: [], textoCorrido: [] };
  walk(blocks, acc);
  return [
    ...new Set(
      acc.links.map((l) => l.href).filter((h) => h.startsWith("http://") || h.startsWith("https://")),
    ),
  ];
}
