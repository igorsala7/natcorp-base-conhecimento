/**
 * O CSS de uma "peça" do widget (a bolha e o avatar), calculado do jeito que o
 * `widget.js` calcula.
 *
 * Existe para a PRÉVIA da tela de configuração. E o ponto delicado é esse: uma
 * prévia que não bate com o resultado é pior que nenhuma, porque a pessoa
 * publica confiando nela. Por isso as regras estão aqui, sozinhas e testadas,
 * espelhando `aplicarEstilo()` e `derive()` do widget — e um teste compara as
 * duas tabelas de forma e tamanho lendo o widget do disco, para elas não
 * andarem separadas.
 */

export const FORMA: Record<string, string> = { circle: "50%", rounded: "30%", square: "18%" };
export const TAMANHO: Record<string, number> = { sm: 52, md: 60, lg: 70 };

/** Cor secundária automática — mesma mistura do `derive()` do widget. */
export function derivar(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex || "").trim());
  if (!m) return hex || "#511C76";
  const n = parseInt(m[1]!, 16);
  const mistura = (c: number, alvo: number) => Math.round(c * 0.68 + alvo * 0.32);
  const r = mistura((n >> 16) & 255, 0x6d);
  const g = mistura((n >> 8) & 255, 0x5a);
  const b = mistura(n & 255, 0xe6);
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

const corValida = (v: string) => /^#[0-9a-fA-F]{6}$/.test((v || "").trim());

export type EstiloPeca = {
  /** "" = cor da marca · "transparent" · cor sólida (com `fundo2` = degradê). */
  fundo: string;
  fundo2: string;
  borda: number;
  corBorda: string;
  formato: string;
  recorte: "cover" | "contain";
  sombra?: "padrao" | "soft" | "none";
  tamanho: number;
  primaria: string;
  secundaria: string;
};

/**
 * Devolve o `style` da peça. Só propriedades — quem monta o elemento é a tela.
 *
 * `background` cobre os quatro estados na mesma ordem de decisão do widget:
 * transparente, degradê próprio, cor sólida e, por último, o gradiente da marca
 * (que é o fallback do `var()` lá).
 */
export function estiloDaPeca(p: EstiloPeca): React.CSSProperties {
  const f = (p.fundo || "").trim();
  const sec = corValida(p.secundaria) ? p.secundaria : derivar(p.primaria);

  let background: string;
  if (f === "transparent") background = "transparent";
  else if (corValida(f) && corValida(p.fundo2)) background = `linear-gradient(135deg,${f},${p.fundo2})`;
  else if (corValida(f)) background = f;
  else background = `linear-gradient(135deg,${p.primaria},${sec})`;

  const sombras: Record<string, string> = {
    padrao: "0 12px 30px rgba(40,20,80,.38)",
    soft: "0 4px 12px rgba(40,20,80,.20)",
    none: "none",
  };

  return {
    width: p.tamanho,
    height: p.tamanho,
    borderRadius: FORMA[p.formato] ?? "50%",
    background,
    border: p.borda > 0 ? `${p.borda}px solid ${corValida(p.corBorda) ? p.corBorda : "#ffffff"}` : undefined,
    boxSizing: "border-box",
    boxShadow: p.sombra ? sombras[p.sombra] : undefined,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flex: "none",
  };
}

/** Estilo da IMAGEM dentro da peça — o recorte é o que decide se o fundo aparece. */
export function estiloDaImagem(recorte: "cover" | "contain", formato: string): React.CSSProperties {
  return {
    width: "100%",
    height: "100%",
    objectFit: recorte,
    borderRadius: FORMA[formato] ?? "50%",
  };
}
