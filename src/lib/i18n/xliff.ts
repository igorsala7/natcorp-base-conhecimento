/**
 * XLIFF 1.2 — o formato que o Oracle APEX exporta/importa na tradução NATIVA da
 * aplicação (Shared Components → Translate). Fluxo: o cliente exporta o XLIFF do
 * APEX (com os `<source>`), nós PREENCHEMOS os `<target>` com a tradução da IA
 * (consistente com o glossário/ontologia) e ele reimporta no APEX. Não é runtime.
 *
 * Puro/sem dependência de parser XML: transformação DIRIGIDA por `trans-unit`
 * (extrai o texto e injeta só o `<target>`, preservando o resto do XML). Coberto
 * por teste.
 */

export type UnidadeXliff = { id: string; source: string; target?: string };

const RX_TRANS_UNIT = /<trans-unit\b[^>]*>[\s\S]*?<\/trans-unit>/gi;
const RX_ID = /\bid\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const RX_SOURCE = /<source\b[^>]*>([\s\S]*?)<\/source>/i;
const RX_TARGET = /<target\b[^>]*>[\s\S]*?<\/target>/i;

function decodeXml(s: string): string {
  const t = s.trim();
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(t);
  const bruto = (cdata ? cdata[1] : t) ?? "";
  return bruto
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

export function encodeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function idDe(bloco: string): string | null {
  const m = RX_ID.exec(bloco);
  return m ? (m[1] ?? m[2] ?? null) : null;
}

/** Extrai os `<source>` (id + texto decodificado) de um XLIFF do APEX. */
export function extrairSourcesXliff(xml: string): { id: string; source: string }[] {
  const out: { id: string; source: string }[] = [];
  const vistos = new Set<string>();
  for (const bloco of xml.match(RX_TRANS_UNIT) ?? []) {
    const id = idDe(bloco);
    const src = RX_SOURCE.exec(bloco);
    if (!id || !src || vistos.has(id)) continue;
    const source = decodeXml(src[1] ?? "");
    if (!source) continue;
    vistos.add(id);
    out.push({ id, source });
  }
  return out;
}

/** Injeta/atualiza os `<target>` no XLIFF a partir do mapa id→tradução, preservando
 *  todo o resto do arquivo. Unidades sem tradução no mapa ficam intactas. */
export function preencherTargetsXliff(xml: string, alvo: Map<string, string>): string {
  return xml.replace(RX_TRANS_UNIT, (bloco) => {
    const id = idDe(bloco);
    if (!id || !alvo.has(id)) return bloco;
    const target = `<target>${encodeXml(alvo.get(id) ?? "")}</target>`;
    if (RX_TARGET.test(bloco)) return bloco.replace(RX_TARGET, target);
    if (RX_SOURCE.test(bloco)) return bloco.replace(/(<\/source>)/i, `$1\n        ${target}`);
    return bloco;
  });
}

/** Monta um XLIFF do zero (para o caminho "colar lista de textos", 1 por linha). */
export function buildXliff(units: UnidadeXliff[], srcLang = "pt-BR", tgtLang = "en"): string {
  const body = units
    .map(
      (u) =>
        `      <trans-unit id="${encodeXml(u.id)}">\n` +
        `        <source>${encodeXml(u.source)}</source>\n` +
        `        <target>${encodeXml(u.target ?? "")}</target>\n` +
        `      </trans-unit>`,
    )
    .join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n` +
    `  <file original="apex" source-language="${encodeXml(srcLang)}" target-language="${encodeXml(tgtLang)}" datatype="plaintext">\n` +
    `    <body>\n${body}\n    </body>\n` +
    `  </file>\n</xliff>\n`
  );
}

/** Uma lista de textos (1 por linha) → unidades com id sequencial (caminho "colar"). */
export function linhasParaUnidades(texto: string): { id: string; source: string }[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((source, i) => ({ id: `t${i + 1}`, source }));
}
