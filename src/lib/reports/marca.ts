/**
 * A MARCA NATCORP COMO SISTEMA — para PDF, Word e PowerPoint.
 *
 * Antes desta rodada havia três implementações independentes de cor dentro de
 * `reports/`: `hexToRgb`/`mix` no `pdf.ts`, `HEX`/`mixWhite`/`paleta` no
 * `exporters.ts`, e um `#2C1A63` cravado no meio da segunda. Nenhuma sabia o que
 * a outra fazia, e o resultado aparecia: os gráficos do PDF saíam numa paleta e
 * os do Word em outra.
 *
 * Aqui a marca é UM sistema, e ele é o mesmo que a tela usa — as rampas abaixo
 * são as de `tailwind.config.ts:26-83`, com os mesmos valores. Copiadas e não
 * importadas de propósito: o `tailwind.config.ts` é configuração de build, e
 * arrastá-lo para dentro do runtime do servidor por três dezenas de hex custa
 * mais do que a duplicação. O teste guarda a igualdade.
 *
 * ── Decisão do Igor (16/08/2026): SEMPRE NATCORP ────────────────────────────
 * O relatório gerado dentro do ERP do INCOR ou da Stefanini sai com a identidade
 * da Natcorp. Por isso este módulo não recebe parâmetro de cor: ele É a marca.
 * A cor de `widget_keys.config.primaryColor` deixa de pintar documento — ela
 * continua valendo para a bolha do widget, que é outro assunto.
 *
 * Puro: sem IO, sem `server-only`. É o que permite testá-lo.
 */

/** Rampas 50→950 — idênticas a `tailwind.config.ts`. */
export const RAMPA = {
  roxo: {
    50: "#F7F4FA", 100: "#EEE7F3", 200: "#DBCBE7", 300: "#C0A6D5", 400: "#9E77BC",
    500: "#8153A3", 600: "#683A8B", 700: "#511C76", 800: "#431862", 900: "#34134B", 950: "#220C32",
  },
  rosa: {
    50: "#FCF3F7", 100: "#FAE6EF", 200: "#F4CADD", 300: "#ECA3C2", 400: "#DE76A1",
    500: "#C95788", 600: "#B03D6E", 700: "#922E58", 800: "#792749", 900: "#66233F", 950: "#3D1122",
  },
  azul: {
    50: "#F3F2F9", 100: "#E7E4F2", 200: "#CBC5E3", 300: "#A79ECF", 400: "#7C6FB4",
    500: "#5A4B9B", 600: "#453885", 700: "#382C6E", 800: "#2C1A63", 900: "#221551", 950: "#150C33",
  },
} as const;

/**
 * Os três âncoras, como o `CLAUDE.md` os define.
 *
 * `ROSA` é `pink.500` e serve para PREENCHIMENTO — número grande, filete, ícone.
 * Para TEXTO pequeno sobre branco ele dá ~4:1 e reprova AA; nesses casos vale
 * `ROSA_TEXTO` (`pink.600`), a mesma escolha que a UI já fez em
 * `globals.css:32-35`. Documento é lido de perto e às vezes impresso — errar
 * contraste aqui é pior do que na tela.
 */
export const ROXO = RAMPA.roxo[700];        // #511C76
export const ROSA = RAMPA.rosa[500];        // #C95788
export const ROSA_TEXTO = RAMPA.rosa[600];  // #B03D6E
export const AZUL = RAMPA.azul[800];        // #2C1A63

/**
 * Papéis de documento — o vocabulário que os renderizadores usam.
 *
 * Nomeado por FUNÇÃO e não por cor: quando alguém trocar o tom da faixa, troca
 * num lugar e os três formatos acompanham. `faixa` são as paradas do degradê
 * escuro→roxo→magenta que atravessa o deck institucional.
 */
export const MARCA = {
  faixa: [RAMPA.azul[950], ROXO, RAMPA.rosa[600]] as const,
  faixaTexto: "#FFFFFF",
  superficie: "#FFFFFF",
  superficieAlt: "#F7F5FA",
  cartao: "#FFFFFF",
  borda: "#E8E6EC",
  bordaForte: RAMPA.roxo[200],
  texto: "#201D26",
  textoSuave: "#6B6577",
  /** O filete curto sob os títulos de seção do deck. */
  regua: ROSA,
  /** Número grande de destaque. */
  destaque: ROSA_TEXTO,
  zebra: RAMPA.roxo[50],
} as const;

/**
 * Cores das séries de gráfico.
 *
 * Começa pela tríade da marca e segue por tons das próprias rampas, em vez de
 * cair em azul/verde/laranja genéricos como a paleta antiga. Onze cores: acima
 * disso a leitura já falha por excesso de série, não por falta de cor.
 *
 * Alterna claro e escuro entre vizinhas para continuar legível em impressão
 * preto-e-branco, onde só a luminosidade sobrevive.
 */
export const CORES_GRAFICO: string[] = [
  ROXO, ROSA, AZUL,
  RAMPA.roxo[400], RAMPA.rosa[300], RAMPA.azul[400],
  RAMPA.roxo[900], RAMPA.rosa[700], RAMPA.azul[600],
  RAMPA.roxo[200], RAMPA.rosa[100],
];

// ── Utilidades de cor ───────────────────────────────────────────────────────

const HEX6 = /^#?([0-9a-f]{6})$/i;

/** `#RRGGBB` → `[0-255, 0-255, 0-255]`. Hex torto devolve o roxo da marca. */
export function paraRgb(hex: string): [number, number, number] {
  const m = String(hex ?? "").trim().match(HEX6);
  if (!m) return [81, 28, 118];
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `#RRGGBB` → `[0-1, 0-1, 0-1]`, que é o que o pdf-lib quer. */
export function paraUnidade(hex: string): [number, number, number] {
  const [r, g, b] = paraRgb(hex);
  return [r / 255, g / 255, b / 255];
}

/** Sem `#` e em MAIÚSCULA — a forma que `docx`/`pptxgenjs`/`exceljs` esperam. */
export function semCerquilha(hex: string): string {
  return String(hex ?? "").replace("#", "").padEnd(6, "0").slice(0, 6).toUpperCase();
}

const doisDigitos = (c: number) => c.toString(16).padStart(2, "0");

/** Clareia em direção ao branco. `p=0` não mexe, `p=1` vira branco. */
export function clarear(hex: string, p: number): string {
  const [r, g, b] = paraRgb(hex);
  const m = (c: number) => Math.round(c + (255 - c) * Math.min(1, Math.max(0, p)));
  return "#" + [m(r), m(g), m(b)].map(doisDigitos).join("").toUpperCase();
}

/** Interpola duas cores. `t=0` devolve `a`, `t=1` devolve `b`. */
export function entre(a: string, b: string, t: number): string {
  const [r1, g1, b1] = paraRgb(a);
  const [r2, g2, b2] = paraRgb(b);
  const k = Math.min(1, Math.max(0, t));
  const m = (x: number, y: number) => Math.round(x + (y - x) * k);
  return "#" + [m(r1, r2), m(g1, g2), m(b1, b2)].map(doisDigitos).join("").toUpperCase();
}

/**
 * O degradê da faixa, em `n` paradas.
 *
 * O pdf-lib não tem degradê: o renderizador desenha estas paradas como fatias
 * verticais coladas. Cento e vinte fatias numa faixa A4 dá ~5pt cada — nenhum
 * olho separa isso, e são 120 retângulos, o que não pesa em lugar nenhum.
 *
 * Interpola por TRECHO e não do primeiro ao último: a cor do meio (o roxo da
 * marca) precisa aparecer de fato, senão o degradê vira azul→rosa e a identidade
 * some justamente no elemento mais visível do documento.
 */
export function degrade(n = 120, paradas: readonly string[] = MARCA.faixa): string[] {
  if (n <= 1) return [paradas[0] ?? ROXO];
  const trechos = Math.max(1, paradas.length - 1);
  return Array.from({ length: n }, (_, i) => {
    const pos = (i / (n - 1)) * trechos;
    const t = Math.min(trechos - 1, Math.floor(pos));
    return entre(paradas[t] ?? ROXO, paradas[t + 1] ?? paradas[t] ?? ROXO, pos - t);
  });
}

/**
 * O LOSANGO da marca — a forma do logo, em vetor.
 *
 * Existe para carregar a identidade enquanto não há arquivo de logo no projeto
 * (não há nenhum: nem em `public/`, nem em lugar algum — só uma URL opcional no
 * tema do portal, que nunca chegou a um documento). E continua útil depois, como
 * marca d'água e ícone de cartão, onde o logo inteiro seria pesado demais.
 *
 * Devolve os 4 vértices no sentido horário a partir do topo. Quem desenha decide
 * se vira `drawSvgPath` (pdf-lib), `addShape` (pptx) ou polígono.
 */
export function losango(cx: number, cy: number, tam: number): { x: number; y: number }[] {
  const r = tam / 2;
  return [
    { x: cx, y: cy - r },
    { x: cx + r, y: cy },
    { x: cx, y: cy + r },
    { x: cx - r, y: cy },
  ];
}

/**
 * O losango como `path` SVG, com o canto suave do logo.
 *
 * Sem o arredondamento ele parece losango de baralho; a marca tem o canto
 * quebrado. `raio` é o quanto cada ponta recua antes de curvar.
 */
export function losangoPath(cx: number, cy: number, tam: number, raio = 0): string {
  const p = losango(cx, cy, tam);
  if (raio <= 0) return `M ${p[0]!.x} ${p[0]!.y} L ${p[1]!.x} ${p[1]!.y} L ${p[2]!.x} ${p[2]!.y} L ${p[3]!.x} ${p[3]!.y} Z`;
  const q = losango(cx, cy, Math.max(1, tam - raio * 2));
  return (
    `M ${q[0]!.x} ${q[0]!.y} Q ${p[1]!.x} ${p[0]!.y} ${q[1]!.x} ${q[1]!.y} ` +
    `Q ${p[1]!.x} ${p[2]!.y} ${q[2]!.x} ${q[2]!.y} ` +
    `Q ${p[3]!.x} ${p[2]!.y} ${q[3]!.x} ${q[3]!.y} ` +
    `Q ${p[3]!.x} ${p[0]!.y} ${q[0]!.x} ${q[0]!.y} Z`
  );
}
