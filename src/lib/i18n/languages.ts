/**
 * Idiomas suportados pela ontologia multilíngue e pelo chatbot. `pt` é o CANÔNICO
 * (as linhas de `ontology_terms`/`aliases`). Os demais são traduções contextuais.
 * Puro/compartilhado: usado pelo chat (route), pelo seletor do widget e pelo admin.
 */
export type Idioma = { code: string; nome: string; nativo: string };

export const IDIOMAS: Idioma[] = [
  { code: "pt", nome: "Português", nativo: "Português" },
  { code: "en", nome: "Inglês", nativo: "English" },
  { code: "es", nome: "Espanhol", nativo: "Español" },
  { code: "fr", nome: "Francês", nativo: "Français" },
  { code: "de", nome: "Alemão", nativo: "Deutsch" },
  { code: "it", nome: "Italiano", nativo: "Italiano" },
  { code: "ja", nome: "Japonês", nativo: "日本語" },
  { code: "zh", nome: "Chinês", nativo: "中文" },
];

/** Idiomas que NÃO são o canônico (os que a IA traduz e o seletor oferece). */
export const IDIOMA_CANONICO = "pt";

const MAPA = new Map(IDIOMAS.map((i) => [i.code, i]));

function normalizar(code?: string | null): string {
  return (code ?? "").trim().toLowerCase();
}

export function idiomaValido(code?: string | null): boolean {
  return MAPA.has(normalizar(code));
}

/** Nome do idioma em PT (ex.: "Inglês"). `null` se desconhecido. */
export function idiomaNome(code?: string | null): string | null {
  return MAPA.get(normalizar(code))?.nome ?? null;
}

/** Nome NATIVO do idioma (ex.: "English", "日本語"). `null` se desconhecido. */
export function idiomaNativo(code?: string | null): string | null {
  return MAPA.get(normalizar(code))?.nativo ?? null;
}
