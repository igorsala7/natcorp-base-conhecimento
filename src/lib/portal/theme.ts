import { z } from "zod";

/**
 * Aparência da home pública de uma documentação.
 *
 * Mora em `spaces.theme` (jsonb), que já existia carregando `primaryColor` e
 * os contatos de suporte — por isso não há migration: o formato foi estendido,
 * não trocado.
 *
 * O contrato é o mesmo de `normalizeDoc` para blocos: **normaliza na leitura**.
 * O que está gravado é dado externo (jsonb aceita qualquer coisa, e temas
 * antigos existem), então nada aqui confia na forma do que vem do banco.
 */

/** Regiões da home, na ordem em que nasceram na página. */
export const REGIOES = ["cover", "hero", "search", "ask", "categories", "recent", "support"] as const;
export type RegiaoKey = (typeof REGIOES)[number];

export const ROTULO_REGIAO: Record<RegiaoKey, string> = {
  cover: "Cabeçalho com imagem",
  hero: "Título e subtítulo",
  search: "Campo de busca",
  // Preciso de propósito: desligar aqui não tira o botão de IA do cabeçalho
  // nem o do bloco de suporte, e um rótulo genérico prometeria isso.
  ask: "Botão de IA na abertura",
  categories: "Categorias",
  recent: "Recentemente atualizados",
  support: "Bloco de suporte",
};

/**
 * Só aceitamos imagem servida pelo próprio Supabase Storage.
 *
 * Sem isto, o campo vira um *hotlink* arbitrário na página pública: quem
 * configura o tema passaria a poder carregar conteúdo de um domínio de
 * terceiros (e vazar o IP de cada leitor para ele).
 */
function imagemDoProjeto(url: string): boolean {
  if (!url) return true; // vazio = sem imagem
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /\/storage\/v1\/object\/public\/assets\//.test(u.pathname);
  } catch {
    return false;
  }
}

const UrlAsset = z
  .string()
  .trim()
  .refine(imagemDoProjeto, "A imagem precisa ter sido enviada por esta tela.");

const RegiaoSchema = z.object({
  key: z.enum(REGIOES),
  on: z.boolean(),
});

export const ThemeSchema = z.object({
  brand: z
    .object({
      /** Cor da marca no tema claro. A variante escura é derivada. */
      color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor no formato #RRGGBB.")
        .optional(),
      logoUrl: UrlAsset.optional(),
      coverUrl: UrlAsset.optional(),
      /** Altura do cabeçalho em px — reservada para não haver layout shift. */
      coverHeight: z.number().int().min(80).max(480).optional(),
    })
    .optional(),
  home: z
    .object({
      title: z.string().max(120).optional(),
      subtitle: z.string().max(300).optional(),
      supportTitle: z.string().max(120).optional(),
      supportText: z.string().max(300).optional(),
      /** A ORDEM do array é a ordem na página. */
      regions: z.array(RegiaoSchema).optional(),
    })
    .optional(),
  // Campos que já existiam — preservados.
  supportUrl: z.string().trim().optional(),
  supportEmail: z.string().trim().optional(),
});

export type SpaceTheme = z.infer<typeof ThemeSchema>;

/** Tema resolvido: todos os campos presentes, regiões completas e ordenadas. */
export type TemaResolvido = {
  brand: { color: string | null; logoUrl: string | null; coverUrl: string | null; coverHeight: number };
  home: {
    title: string | null;
    subtitle: string;
    supportTitle: string;
    supportText: string;
    regions: { key: RegiaoKey; on: boolean }[];
  };
  supportUrl: string | null;
  supportEmail: string | null;
};

const PADRAO = {
  subtitle: "Encontre respostas na documentação — ou pergunte à IA.",
  supportTitle: "Não encontrou o que procurava?",
  supportText: "Pergunte à IA com base nesta documentação ou fale com o suporte.",
  coverHeight: 200,
  /** `cover` nasce desligada: quem não configurou nada não ganha um vazio. */
  regioesPadrao: REGIOES.map((key) => ({ key, on: key !== "cover" })),
};

/**
 * Normaliza o que veio do banco. NUNCA lança: tema inválido vira tema padrão,
 * porque uma home pública não pode cair por causa de um jsonb torto.
 */
export function resolveTheme(raw: unknown): TemaResolvido {
  const parsed = ThemeSchema.safeParse(raw ?? {});
  const t: SpaceTheme = parsed.success ? parsed.data : {};

  // Regiões: mantém a ordem gravada, descarta chave desconhecida (o enum já
  // barrou) e acrescenta no fim as que faltarem, com o padrão delas. Assim um
  // tema salvo antes de uma região existir segue válido e ganha a região nova.
  // Dedup pela primeira ocorrência: um jsonb com a mesma região duas vezes
  // renderizaria a seção duplicada na página pública.
  const vistas = new Set<RegiaoKey>();
  const gravadas = (t.home?.regions ?? []).filter((r) => {
    if (vistas.has(r.key)) return false;
    vistas.add(r.key);
    return true;
  });
  const regions = [...gravadas, ...PADRAO.regioesPadrao.filter((r) => !vistas.has(r.key))];

  return {
    brand: {
      color: t.brand?.color ?? null,
      logoUrl: t.brand?.logoUrl || null,
      coverUrl: t.brand?.coverUrl || null,
      coverHeight: t.brand?.coverHeight ?? PADRAO.coverHeight,
    },
    home: {
      title: t.home?.title?.trim() || null,
      subtitle: t.home?.subtitle?.trim() || PADRAO.subtitle,
      supportTitle: t.home?.supportTitle?.trim() || PADRAO.supportTitle,
      supportText: t.home?.supportText?.trim() || PADRAO.supportText,
      regions,
    },
    supportUrl: t.supportUrl || null,
    supportEmail: t.supportEmail || null,
  };
}

/** A região está ligada? (região ausente conta como ligada, menos `cover`.) */
export function regiaoAtiva(tema: TemaResolvido, key: RegiaoKey): boolean {
  return tema.home.regions.find((r) => r.key === key)?.on ?? key !== "cover";
}
