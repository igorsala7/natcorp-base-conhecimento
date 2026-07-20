/**
 * Cor da marca nos dois temas.
 *
 * Uma marca escura (o próprio roxo do produto, `#511C76`) é excelente sobre
 * branco e ilegível sobre o fundo escuro do portal. Como o tema de cada
 * documentação entra por estilo inline — que vence inclusive no modo escuro —
 * sem isto o branding do cliente quebraria a leitura de quem usa dark mode.
 *
 * A saída é derivar a variante escura em vez de pedir duas cores: com um campo
 * só é impossível salvar um par ilegível.
 */

const FUNDO_ESCURO = "#16131c"; // --color-bg do tema escuro
const CONTRASTE_MIN = 4.5; // AA para texto de corpo

type RGB = { r: number; g: number; b: number };

function hexParaRgb(hex: string): RGB | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbParaHex({ r, g, b }: RGB): string {
  const p = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${p(r)}${p(g)}${p(b)}`;
}

/** Luminância relativa (WCAG 2.x). */
export function luminancia(hex: string): number {
  const rgb = hexParaRgb(hex);
  if (!rgb) return 0;
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(rgb.r) + 0.7152 * canal(rgb.g) + 0.0722 * canal(rgb.b);
}

/** Razão de contraste entre duas cores (1 a 21). */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}

function rgbParaHsl({ r, g, b }: RGB) {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

function hslParaRgb(h: number, s: number, l: number): RGB {
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const canal = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return { r: canal(h + 1 / 3) * 255, g: canal(h) * 255, b: canal(h - 1 / 3) * 255 };
}

/**
 * Variante da cor para o tema escuro: sobe a claridade em HSL até cruzar o
 * mínimo de contraste sobre o fundo escuro, preservando matiz e saturação
 * (é o que mantém a cor reconhecível como a marca).
 *
 * Devolve a cor original quando ela já passa — marca clara não é escurecida.
 */
export function derivarVarianteEscura(hex: string): string {
  const rgb = hexParaRgb(hex);
  if (!rgb) return hex;
  if (contraste(hex, FUNDO_ESCURO) >= CONTRASTE_MIN) return hex;

  const { h, s, l } = rgbParaHsl(rgb);
  // Passo pequeno para não clarear além do necessário: quanto mais perto do
  // limite parar, mais fiel à marca a variante fica.
  for (let nl = l; nl <= 0.97; nl += 0.02) {
    const candidato = rgbParaHex(hslParaRgb(h, s, nl));
    if (contraste(candidato, FUNDO_ESCURO) >= CONTRASTE_MIN) return candidato;
  }
  // Saturação altíssima pode não alcançar o alvo só com claridade; aí vale
  // dessaturar um pouco, que é menos pior do que devolver algo ilegível.
  for (let ns = s; ns >= 0; ns -= 0.1) {
    const candidato = rgbParaHex(hslParaRgb(h, ns, 0.85));
    if (contraste(candidato, FUNDO_ESCURO) >= CONTRASTE_MIN) return candidato;
  }
  return "#ffffff";
}

/** Escurece levemente para o estado :hover no tema claro. */
export function derivarHover(hex: string): string {
  const rgb = hexParaRgb(hex);
  if (!rgb) return hex;
  const { h, s, l } = rgbParaHsl(rgb);
  return rgbParaHex(hslParaRgb(h, s, Math.max(0, l - 0.07)));
}
