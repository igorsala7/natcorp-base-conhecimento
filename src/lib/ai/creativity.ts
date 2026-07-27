/**
 * Nível de criatividade da IA nos recursos do editor (Melhorar Layout / Texto).
 * Puro e isomórfico: a UI escolhe o nível, mapeia para uma `temperature` e passa
 * às actions.
 */
export type Criatividade = "conservador" | "equilibrado" | "criativo";

export const CRIATIVIDADES: { key: Criatividade; label: string; hint: string }[] = [
  { key: "conservador", label: "Conservador", hint: "Mais literal e previsível." },
  { key: "equilibrado", label: "Equilibrado", hint: "Padrão." },
  { key: "criativo", label: "Criativo", hint: "Mais liberdade de formatação/redação." },
];

/**
 * Temperatura para o MELHORAR LAYOUT — limitada de propósito: a rede de
 * fidelidade barra paráfrase, então valores altos só variam a FORMATAÇÃO, não
 * as palavras. Passar de ~0.7 só aumentaria a taxa de recusa.
 */
export function tempLayout(c: Criatividade): number {
  return c === "conservador" ? 0.2 : c === "criativo" ? 0.7 : 0.45;
}

/** Temperatura para o MELHORAR TEXTO (reescrever/expandir/resumir/tom): livre. */
export function tempTexto(c: Criatividade): number {
  return c === "conservador" ? 0.2 : c === "criativo" ? 0.9 : 0.6;
}
