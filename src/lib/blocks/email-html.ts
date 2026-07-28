/**
 * BlockDoc → HTML SEGURO DE E-MAIL.
 *
 * Diferente do render do portal (React + classes Tailwind) e do `blocksToHtml`
 * (semântico, sem estilo): aqui tudo vira HTML com **estilo inline** e layout em
 * **tabela**, que é o denominador comum dos clientes de e-mail (Gmail, Outlook,
 * Apple Mail). Os tokens de `styles.ts` são traduzidos para px/hex literais.
 *
 * Blocos sem representação em e-mail (mermaid/tabs/accordion/embed/video)
 * caem num fallback (link ou filhos achatados) em vez de sumir sem aviso.
 */
import type { Block, RichText, BlockStyles, SpaceScale, CalloutVariant, MindMapNode } from "./schema";
import { CALLOUT_ROTULO } from "./schema";

// ── paleta e tokens (Tailwind → px/hex) ──────────────────────────────────────
const MARCA = { primary: "#511C76", pink: "#C95788", blue: "#2C1A63" };
const TEXTO = "#111827"; // títulos
const TEXTO_CORPO = "#3f4451"; // corpo (um degrau mais suave que o título)
const TEXTO_SUAVE = "#6b7280"; // legendas/rodapé
const BORDA = "#eceef2";

const ESCALA_PX: Record<SpaceScale, number> = { 0: 0, 1: 8, 2: 12, 3: 16, 4: 24, 5: 32, 6: 48 };
const FONT_PX: Record<string, number> = { xs: 11, sm: 12, base: 14, lg: 16, xl: 18, "2xl": 20, "3xl": 24 };
const RADIUS_PX: Record<string, number> = { none: 0, sm: 2, md: 6, lg: 8, xl: 12, "2xl": 16 };
const BG_HEX: Record<string, string> = {
  none: "",
  purple: "#f5f0fa",
  pink: "#fbeef4",
  blue: "#eef0f8",
  gray: "#f3f4f6",
  dark: MARCA.blue,
};
const BORDER_HEX: Record<string, string> = {
  border: BORDA,
  primary: MARCA.primary,
  pink: MARCA.pink,
  blue: MARCA.blue,
  gray: "#d1d5db",
  dark: MARCA.blue,
};
const CALLOUT_COR: Record<CalloutVariant, { bg: string; borda: string }> = {
  info: { bg: "#eff6ff", borda: "#3b82f6" },
  success: { bg: "#ecfdf5", borda: "#10b981" },
  warning: { bg: "#fffbeb", borda: "#f59e0b" },
  danger: { bg: "#fef2f2", borda: "#ef4444" },
  note: { bg: "#f5f3ff", borda: "#8b5cf6" },
};

// ── helpers ──────────────────────────────────────────────────────────────────
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** BlockStyles → declarações de estilo inline (px/hex). */
function estilo(s: BlockStyles | undefined, extra = ""): string {
  if (!s && !extra) return "";
  const d: string[] = [];
  if (s) {
    if (s.paddingX != null) d.push(`padding-left:${ESCALA_PX[s.paddingX]}px`, `padding-right:${ESCALA_PX[s.paddingX]}px`);
    if (s.paddingY != null) d.push(`padding-top:${ESCALA_PX[s.paddingY]}px`, `padding-bottom:${ESCALA_PX[s.paddingY]}px`);
    if (s.marginY != null) d.push(`margin-top:${ESCALA_PX[s.marginY]}px`, `margin-bottom:${ESCALA_PX[s.marginY]}px`);
    if (s.bgColor && BG_HEX[s.bgColor]) d.push(`background-color:${BG_HEX[s.bgColor]}`);
    if (s.bgColor === "dark") d.push("color:#ffffff");
    if (s.borderRadius && RADIUS_PX[s.borderRadius]) d.push(`border-radius:${RADIUS_PX[s.borderRadius]}px`);
    if (s.align) d.push(`text-align:${s.align}`);
    if (s.fontSize && FONT_PX[s.fontSize]) d.push(`font-size:${FONT_PX[s.fontSize]}px`);
    if (s.borderWidth) d.push(`border:${s.borderWidth}px solid ${BORDER_HEX[s.borderColor ?? "border"]}`);
  }
  const todos = extra ? [extra.replace(/;$/, ""), ...d] : d;
  return todos.length ? ` style="${todos.join(";")}"` : "";
}

function children(b: Block): Block[] {
  return "children" in b && Array.isArray(b.children) ? b.children : [];
}
function childrenEmail(b: Block): string {
  return children(b).map(blockToEmail).join("");
}

/** Rich text → HTML com marcas em estilo inline (links na cor da marca). */
function richToEmail(rt: RichText | undefined): string {
  return (rt ?? [])
    .map((span) => {
      let t = esc(span.text).replace(/\n/g, "<br>");
      for (const mk of span.marks ?? []) {
        if (mk.type === "bold") t = `<strong>${t}</strong>`;
        else if (mk.type === "italic") t = `<em>${t}</em>`;
        else if (mk.type === "strike") t = `<span style="text-decoration:line-through">${t}</span>`;
        else if (mk.type === "code" || mk.type === "kbd")
          t = `<code style="font-family:monospace;background:#f3f4f6;padding:1px 4px;border-radius:3px">${t}</code>`;
        else if (mk.type === "highlight")
          t = `<span style="background:${esc(mk.color ?? "#fde68a")}">${t}</span>`;
        else if (mk.type === "color") t = `<span style="color:${esc(mk.color)}">${t}</span>`;
        else if (mk.type === "link")
          t = `<a href="${esc(mk.href)}" style="color:${MARCA.primary};text-decoration:underline">${t}</a>`;
      }
      return t;
    })
    .join("");
}

// ── por bloco ────────────────────────────────────────────────────────────────
function blockToEmail(b: Block): string {
  switch (b.type) {
    case "heading": {
      const px = { 1: 26, 2: 20, 3: 16 }[b.data.level];
      return `<p${estilo(b.styles, `margin:0 0 12px;font-weight:700;font-size:${px}px;line-height:1.3;letter-spacing:-0.01em;color:${TEXTO}`)}>${richToEmail(b.text)}</p>`;
    }
    case "paragraph":
      return `<p${estilo(b.styles, `margin:0 0 16px;font-size:15px;line-height:1.65;color:${TEXTO_CORPO}`)}>${richToEmail(b.text)}</p>`;
    case "bulletList":
      return `<ul style="margin:0 0 16px;padding-left:22px;font-size:15px;line-height:1.65;color:${TEXTO_CORPO}">${childrenEmail(b)}</ul>`;
    case "orderedList":
      return `<ol style="margin:0 0 16px;padding-left:22px;font-size:15px;line-height:1.65;color:${TEXTO_CORPO}">${childrenEmail(b)}</ol>`;
    case "listItem":
      return `<li style="margin:0 0 4px">${richToEmail(b.text)}${children(b).length ? childrenEmail(b) : ""}</li>`;
    case "quote":
      return `<blockquote style="margin:0 0 14px;padding:8px 16px;border-left:3px solid ${MARCA.pink};color:${TEXTO_SUAVE};font-style:italic">${richToEmail(b.text)}${
        b.data?.author?.trim() ? `<br><span style="font-size:12px;color:${TEXTO_SUAVE}">— ${esc(b.data.author.trim())}</span>` : ""
      }</blockquote>`;
    case "breadcrumb":
      return `<p${estilo(b.styles, `margin:0 0 12px;font-size:13px;color:${TEXTO_SUAVE}`)}>${richToEmail(b.text)}</p>`;
    case "divider":
      return `<hr style="border:0;border-top:1px solid ${BORDA};margin:24px 0">`;
    case "spacer": {
      const h = { sm: 12, md: 24, lg: 48 }[b.data.size] ?? 24;
      return `<div style="height:${h}px;line-height:${h}px">&nbsp;</div>`;
    }
    case "code":
      return `<pre style="margin:0 0 14px;padding:14px;background:#0b0a12;color:#f3f4f6;border-radius:8px;overflow:auto;font-family:monospace;font-size:13px;line-height:1.5"><code>${esc(b.data.code)}</code></pre>`;
    case "image": {
      if (!b.data.src) return "";
      const w = b.data.size === "wide" ? 560 : b.data.size === "medium" ? 360 : undefined;
      const img = `<img src="${esc(b.data.src)}" alt="${esc(b.data.alt)}"${w ? ` width="${w}"` : ""} style="max-width:100%;height:auto;border:0;display:block;margin:0 auto;border-radius:6px" />`;
      return `<div style="margin:0 0 14px;text-align:center">${img}${
        b.data.caption ? `<div style="margin-top:6px;font-size:12px;color:${TEXTO_SUAVE}">${esc(b.data.caption)}</div>` : ""
      }</div>`;
    }
    case "button": {
      const sec = b.data.variant === "secondary";
      const bg = sec ? "#ffffff" : MARCA.primary;
      const cor = sec ? MARCA.primary : "#ffffff";
      const borda = sec ? `border:1.5px solid #d8dae0;` : "";
      const align = b.styles?.align ?? "left";
      // Botão "bulletproof" em tabela (funciona no Outlook), respeitando o
      // alinhamento do bloco (esquerda/centro/direita).
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px${align === "center" ? ";margin-left:auto;margin-right:auto" : align === "right" ? ";margin-left:auto" : ""}"><tr><td style="border-radius:8px;background:${bg};${borda}"><a href="${esc(b.data.href)}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:${cor};text-decoration:none;border-radius:8px;letter-spacing:0.01em">${esc(b.data.label)}</a></td></tr></table>`;
    }
    case "callout": {
      const cor = CALLOUT_COR[b.data.variant] ?? CALLOUT_COR.info;
      const titulo = b.data.title?.trim() || CALLOUT_ROTULO[b.data.variant] || "Nota";
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;background:${cor.bg};border-left:4px solid ${cor.borda};border-radius:6px"><tr><td style="padding:14px 16px"><div style="font-weight:700;font-size:13px;margin-bottom:4px;color:${TEXTO}">${esc(titulo)}</div><div style="font-size:14px;line-height:1.6;color:${TEXTO}">${childrenEmail(b)}</div></td></tr></table>`;
    }
    case "hero": {
      const escuro = b.data.bg === "dark";
      const bg = escuro
        ? `background-color:${MARCA.blue};background-image:linear-gradient(135deg,${MARCA.blue},${MARCA.primary})`
        : `background-color:${BG_HEX[b.data.bg] || "#f5f0fa"}`;
      const cor = escuro ? "#ffffff" : TEXTO;
      const suave = escuro ? "rgba(255,255,255,0.85)" : TEXTO_SUAVE;
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;${bg};border-radius:14px"><tr><td style="padding:36px 28px;text-align:center">${
        b.data.eyebrow ? `<div style="font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${escuro ? "rgba(255,255,255,0.72)" : MARCA.primary};margin-bottom:8px">${esc(b.data.eyebrow)}</div>` : ""
      }<div style="font-size:25px;font-weight:700;letter-spacing:-0.01em;line-height:1.25;color:${cor}">${esc(b.data.title)}</div>${
        b.data.subtitle ? `<div style="margin-top:10px;font-size:15px;line-height:1.6;color:${suave}">${esc(b.data.subtitle)}</div>` : ""
      }</td></tr></table>`;
    }
    case "panel":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;background:${BG_HEX[b.data.bg] || "#f5f0fa"};border-radius:8px"><tr><td style="padding:18px 20px">${childrenEmail(b)}</td></tr></table>`;
    case "card":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;border:1px solid ${BORDA};border-radius:8px"><tr><td style="padding:16px 18px">${
        b.data.title ? `<div style="font-weight:700;font-size:15px;margin-bottom:6px;color:${TEXTO}">${esc(b.data.title)}</div>` : ""
      }${childrenEmail(b)}${b.data.href ? `<div style="margin-top:8px"><a href="${esc(b.data.href)}" style="color:${MARCA.primary}">Abrir &rarr;</a></div>` : ""}</td></tr></table>`;
    case "container": {
      // Colunas lado a lado em tabela; sem media query, não empilham no mobile.
      const cols = children(b).filter((c) => c.type === "column");
      const ratios = b.data.ratios && b.data.ratios.length === cols.length ? b.data.ratios : cols.map(() => 1);
      const soma = ratios.reduce((a, r) => a + (r || 1), 0) || 1;
      const tds = cols
        .map((c, i) => `<td valign="top" width="${Math.round((100 * (ratios[i] || 1)) / soma)}%" style="padding:0 8px;vertical-align:top">${childrenEmail(c)}</td>`)
        .join("");
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px"><tr>${tds}</tr></table>`;
    }
    case "cardGrid":
      // Em e-mail viram cartões empilhados (grade real é frágil).
      return childrenEmail(b);
    case "table":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;border-collapse:collapse;border:1px solid ${BORDA};font-size:13px">${b.data.rows
        .map(
          (row, ri) =>
            `<tr>${row
              .map((c) => {
                const th = ri === 0 && b.data.hasHeader;
                return `<${th ? "th" : "td"} style="padding:8px 10px;border:1px solid ${BORDA};text-align:left;${th ? "background:#f9fafb;font-weight:700" : ""}">${richToEmail(c)}</${th ? "th" : "td"}>`;
              })
              .join("")}</tr>`,
        )
        .join("")}</table>`;
    case "checklist":
      return `<ul style="margin:0 0 14px;padding-left:0;list-style:none;font-size:14px;line-height:1.7;color:${TEXTO}">${b.data.items
        .map((i) => `<li style="margin:0 0 4px">${i.checked ? "☑" : "☐"} ${richToEmail(i.text)}</li>`)
        .join("")}</ul>`;
    case "stats":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px"><tr>${b.data.items
        .map(
          (i) => `<td valign="top" style="padding:12px;border:1px solid ${BORDA};border-radius:8px;text-align:center"><div style="font-size:22px;font-weight:700;color:${MARCA.primary}">${esc(i.value)}</div><div style="font-size:13px;font-weight:600;color:${TEXTO}">${esc(i.label)}</div>${i.trend ? `<div style="font-size:11px;color:${TEXTO_SUAVE}">${esc(i.trend)}</div>` : ""}</td>`,
        )
        .join('<td style="width:10px"></td>')}</tr></table>`;
    case "steps":
      return `<ol style="margin:0 0 14px;padding-left:22px;font-size:14px;line-height:1.6;color:${TEXTO}">${children(b)
        .map((s) => `<li style="margin:0 0 8px">${s.type === "step" && s.data?.title?.trim() ? `<strong>${esc(s.data.title.trim())}</strong><br>` : ""}${childrenEmail(s)}</li>`)
        .join("")}</ol>`;
    case "file":
      return b.data.url ? `<p style="margin:0 0 14px"><a href="${esc(b.data.url)}" style="color:${MARCA.primary}">⬇ ${esc(b.data.name || "arquivo")}</a></p>` : "";
    case "video":
      return b.data.url ? `<p style="margin:0 0 14px"><a href="${esc(b.data.url)}" style="color:${MARCA.primary}">▶ Assistir ao vídeo</a></p>` : "";
    case "embed":
      return b.data.url && b.data.provider !== "raw"
        ? `<p style="margin:0 0 14px"><a href="${esc(b.data.url)}" style="color:${MARCA.primary}">${esc(b.data.title || b.data.url)}</a></p>`
        : "";
    // Sem representação própria em e-mail: achata os filhos ou descarta.
    case "accordion":
    case "accordionItem":
    case "tabs":
    case "tab":
    case "toggle":
    case "column":
    case "step":
      return childrenEmail(b);
    case "chart": {
      // E-mail não roda Recharts: cai para os DADOS numa tabela (legível).
      const { columns, rows, title } = b.data;
      if (!rows.length || !columns.length) return "";
      const head = `<tr>${columns
        .map(
          (c) =>
            `<th style="padding:8px 10px;border:1px solid ${BORDA};text-align:left;background:#f9fafb;font-weight:700">${esc(c.label)}</th>`,
        )
        .join("")}</tr>`;
      const body = rows
        .map(
          (r) =>
            `<tr>${columns
              .map((c) => `<td style="padding:8px 10px;border:1px solid ${BORDA}">${esc(String(r[c.key] ?? ""))}</td>`)
              .join("")}</tr>`,
        )
        .join("");
      return `${
        title ? `<p style="margin:0 0 6px;font-weight:700;color:${TEXTO}">${esc(title)}</p>` : ""
      }<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;border-collapse:collapse;border:1px solid ${BORDA};font-size:13px">${head}${body}</table>`;
    }
    case "flow": {
      // E-mail não desenha SVG: lista os passos e as ligações.
      const nomes = new Map(b.data.nodes.map((n) => [n.id, n.label]));
      const linhas = b.data.edges.map(
        (e) => `${nomes.get(e.from) ?? "?"} →${e.label ? ` (${e.label})` : ""} ${nomes.get(e.to) ?? "?"}`,
      );
      if (!linhas.length) return "";
      return `<ul style="margin:0 0 14px;padding-left:20px;font-size:14px;line-height:1.7;color:${TEXTO}">${linhas
        .map((l) => `<li>${esc(l)}</li>`)
        .join("")}</ul>`;
    }
    case "mindmap": {
      // E-mail não desenha SVG: a árvore vira lista aninhada.
      const li = (n: MindMapNode): string =>
        `<li>${esc(n.label)}${n.children?.length ? `<ul style="margin:2px 0;padding-left:18px">${n.children.map(li).join("")}</ul>` : ""}</li>`;
      return `<ul style="margin:0 0 14px;padding-left:20px;font-size:14px;line-height:1.7;color:${TEXTO}">${li(b.data.root)}</ul>`;
    }
    case "mermaid":
    case "snippet":
      return "";
  }
}

/** Blocos do template → HTML de e-mail (o miolo, sem o documento em volta). */
export function blocksToEmailHtml(blocks: Block[]): string {
  return blocks.map(blockToEmail).join("\n");
}

/**
 * Botão CTA "bulletproof" para montar CORPOS de e-mail (fora do BlockDoc) — o
 * mesmo visual do bloco de botão. Usado pelos e-mails transacionais (convite,
 * confirmação) no lugar de um link solto.
 */
export function emailButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px"><tr><td style="border-radius:8px;background:${MARCA.primary}"><a href="${esc(href)}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;letter-spacing:0.01em">${esc(label)}</a></td></tr></table>`;
}

/** Parágrafo de corpo de e-mail com o mesmo estilo do bloco de parágrafo. */
export function emailParagraph(html: string, opts?: { muted?: boolean; small?: boolean }): string {
  const cor = opts?.muted ? TEXTO_SUAVE : TEXTO_CORPO;
  const size = opts?.small ? 12 : 15;
  return `<p style="margin:0 0 16px;font-size:${size}px;line-height:1.65;color:${cor}">${html}</p>`;
}

/**
 * Injeta o corpo e os tokens no miolo renderizado do template. Puro (sem
 * server-only) para servir TANTO ao envio (template.ts) QUANTO à pré-visualização
 * do editor — uma lógica só, sem divergir. Um parágrafo que contém só
 * `{{conteudo}}` é trocado inteiro pelo corpo; token solto também; se o template
 * não tem o token, o corpo entra no fim (nunca some).
 */
export function injectEmailBody(
  inner: string,
  bodyHtml: string,
  opts: { remetente: string; ano: string },
): string {
  let corpo = inner.replaceAll("{{remetente}}", esc(opts.remetente)).replaceAll("{{ano}}", esc(opts.ano));
  const tinha = /\{\{\s*conteudo\s*\}\}/i.test(corpo);
  corpo = corpo
    .replace(/<p[^>]*>\s*\{\{\s*conteudo\s*\}\}\s*<\/p>/gi, bodyHtml)
    .replace(/\{\{\s*conteudo\s*\}\}/gi, bodyHtml);
  if (!tinha) corpo += bodyHtml;
  return corpo;
}

/**
 * Envolve o miolo num documento de e-mail completo: fundo suave, cartão branco
 * centrado a 600px com cantos arredondados e uma pilha de fontes de sistema —
 * a base visual moderna (Stripe/Linear/Vercel-like) sobre a qual os modelos
 * desenham.
 */
const FONTE_SISTEMA =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function wrapEmailDocument(inner: string): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<style>@media (max-width:620px){.email-card{padding:28px 22px!important}}</style></head>
<body style="margin:0;padding:0;background:#f4f4f7;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f7"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #ececf1;border-radius:16px;overflow:hidden;font-family:${FONTE_SISTEMA}"><tr><td class="email-card" style="padding:40px 44px">
${inner}
</td></tr></table>
</td></tr></table>
</body></html>`;
}
