/**
 * Saneamento de texto para as fontes-padrão do PDF (Helvetica), que só codificam
 * WinAnsi/CP1252. Emoji e símbolos fora dessa tabela FAZEM o pdf-lib lançar
 * ("WinAnsi cannot encode …") e derrubam a geração do arquivo inteiro.
 *
 * `winAnsiSafe` mantém ASCII + Latin-1 + os extras do CP1252, troca alguns símbolos
 * comuns por equivalentes ASCII e DESCARTA o resto (emoji, setas exóticas, CJK…).
 * Só o PDF precisa disto — docx/xlsx/pptx/csv são Unicode nativo.
 *
 * Puro (sem `server-only`) para ser testável isoladamente.
 */

// Os ~27 caracteres imprimíveis do CP1252 fora do Latin-1 (aspas curvas, travessões,
// reticências, €, ™, bullet, œ, š…) — o WinAnsi do pdf-lib codifica todos eles.
const CP1252_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160,
  0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);
// Alguns símbolos fora do CP1252 com equivalente ASCII amigável (o resto é descartado).
const WA_MAP: Record<number, string> = {
  0x2192: "->", 0x2190: "<-", 0x2191: "^", 0x2193: "v", 0x21d2: "=>", 0x2794: "->",
  0x2713: "OK", 0x2714: "OK", 0x2717: "x", 0x2718: "x", 0x25aa: "-", 0x25cf: "-",
  0x2043: "-", 0x202f: " ", 0x2009: " ", 0x200b: "", 0xfe0f: "",
};
// Caminho rápido: qualquer char FORA do WinAnsi básico (ASCII + Latin-1 + tab/nl/cr).
const RE_WA_INSEGURO = /[^\t\n\r\x20-\x7e\xa0-\xff]/;

export function winAnsiSafe(s: string): string {
  if (!s || !RE_WA_INSEGURO.test(s)) return s; // já é WinAnsi básico → nada a fazer
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0) as number;
    if (cp === 9 || cp === 10 || cp === 13 || (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || CP1252_EXTRA.has(cp)) { out += ch; continue; }
    const repl = WA_MAP[cp];
    if (repl !== undefined) out += repl; // senão: descarta (emoji etc.)
  }
  return out;
}
