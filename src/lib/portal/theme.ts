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

/** Regiões da home, na ordem em que nascem para um tema novo. */
export const REGIOES = [
  "cover",
  "hero",
  "search",
  "ask",
  "featured",
  "categories",
  "top",
  "recent",
  "support",
  "subscribe",
] as const;
export type RegiaoKey = (typeof REGIOES)[number];

export const ROTULO_REGIAO: Record<RegiaoKey, string> = {
  cover: "Cabeçalho com imagem",
  hero: "Título e subtítulo",
  search: "Campo de busca",
  // Preciso de propósito: desligar aqui não tira o botão de IA do cabeçalho
  // nem o do bloco de suporte, e um rótulo genérico prometeria isso.
  ask: "Botão de IA na abertura",
  featured: "Artigos em destaque",
  categories: "Categorias",
  top: "Mais úteis (por feedback)",
  recent: "Recentemente atualizados",
  support: "Bloco de suporte",
  subscribe: "Receber novidades (e-mail)",
};

/**
 * Regiões que nascem DESLIGADAS: `cover` porque quem não configurou nada não
 * ganha um vazio; `featured` porque depende de curadoria; `top` porque sem
 * feedback acumulado a lista seria ruído.
 */
// `subscribe` nasce desligada: depende do envio de e-mail estar configurado.
const DESLIGADAS_PADRAO = new Set<RegiaoKey>(["cover", "featured", "top", "subscribe"]);

/** Como a abertura (título/busca/IA) é apresentada. Opções do editor. */
export const HERO_STYLES = ["plain", "color", "image"] as const;
export type HeroStyle = (typeof HERO_STYLES)[number];
/**
 * Aceitos na leitura: inclui o legado `"brand"` (antes do seletor de cor
 * separar cor+textura). `resolveTheme` mapeia `"brand" → "color"` — sem isto,
 * o enum rejeitaria o valor salvo e derrubaria o tema inteiro para o padrão.
 */
const HERO_STYLES_ACEITOS = ["plain", "brand", "color", "image"] as const;

/** Textura/efeito do fundo colorido da abertura. */
export const HERO_TEXTURES = ["none", "grid", "dots", "noise", "gradient"] as const;
export type HeroTexture = (typeof HERO_TEXTURES)[number];

/** Como a lista de categorias é apresentada. */
export const CATEGORIES_STYLES = ["cards", "tiles", "list"] as const;
export type CategoriesStyle = (typeof CATEGORIES_STYLES)[number];

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

/**
 * URL de link do cabeçalho/rodapé: caminho relativo do próprio site ("/...")
 * ou http(s) absoluto. `new URL` sozinho deixaria passar `javascript:` — um
 * link do tema viraria XSS armazenado na página pública.
 */
function urlDeLink(url: string): boolean {
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

const UrlAsset = z
  .string()
  .trim()
  .refine(imagemDoProjeto, "A imagem precisa ter sido enviada por esta tela.");

const LinkSchema = z.object({
  label: z.string().trim().min(1, "Dê um nome ao link.").max(40),
  url: z
    .string()
    .trim()
    .min(1)
    .refine(urlDeLink, "Use um endereço https:// ou um caminho começando com /."),
});
export type ThemeLink = z.infer<typeof LinkSchema>;

/** Redes sociais suportadas no rodapé (ícone + URL). */
export const SOCIAL_NETWORKS = [
  "instagram", "facebook", "linkedin", "x", "youtube",
  "whatsapp", "tiktok", "github", "email", "website",
] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];
export const ROTULO_REDE: Record<SocialNetwork, string> = {
  instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", x: "X (Twitter)",
  youtube: "YouTube", whatsapp: "WhatsApp", tiktok: "TikTok", github: "GitHub",
  email: "E-mail", website: "Site",
};

/** URL de rede social: http(s), mailto: (e-mail) ou tel:. */
function urlDeRedeSocial(url: string): boolean {
  if (/^https?:\/\//i.test(url)) {
    try {
      return !!new URL(url);
    } catch {
      return false;
    }
  }
  return /^(mailto:|tel:)/i.test(url);
}

const SocialSchema = z.object({
  network: z.enum(SOCIAL_NETWORKS),
  url: z
    .string()
    .trim()
    .min(1)
    .refine(urlDeRedeSocial, "Use https://…, mailto:… (e-mail) ou tel:… (telefone)."),
});
export type ThemeSocial = z.infer<typeof SocialSchema>;

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
  header: z
    .object({
      /** Links extras no topo do portal (site, ticket, portal do cliente…). */
      links: z.array(LinkSchema).max(4).optional(),
      /** Mostrar o nome do espaço ao lado do logo. */
      showTitle: z.boolean().optional(),
      /** Altura da barra superior em px — o logo cresce junto. */
      height: z.number().int().min(48).max(120).optional(),
    })
    .optional(),
  footer: z
    .object({
      text: z.string().max(280).optional(),
      links: z.array(LinkSchema).max(6).optional(),
      social: z.array(SocialSchema).max(10).optional(),
    })
    .optional(),
  home: z
    .object({
      title: z.string().max(120).optional(),
      subtitle: z.string().max(300).optional(),
      heroStyle: z.enum(HERO_STYLES_ACEITOS).optional(),
      /** Cor de fundo da abertura quando `heroStyle="color"`. null = usar a cor da marca. */
      heroColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor no formato #RRGGBB.")
        .nullable()
        .optional(),
      heroTexture: z.enum(HERO_TEXTURES).optional(),
      /** Repetir o logo (o do cabeçalho) na abertura, acima do título. */
      heroLogo: z.boolean().optional(),
      categoriesStyle: z.enum(CATEGORIES_STYLES).optional(),
      /** Artigos escolhidos à mão para a região "destaques" (ids de nodes). */
      featured: z.array(z.string().uuid()).max(6).optional(),
      supportTitle: z.string().max(120).optional(),
      supportText: z.string().max(300).optional(),
      /** A ORDEM do array é a ordem na página. */
      regions: z.array(RegiaoSchema).optional(),
    })
    .optional(),
  article: z
    .object({
      /** "Artigos relacionados" no fim das páginas de leitura. */
      related: z.boolean().optional(),
      /** Escala tipográfica da leitura. `large` = a escala original. */
      fontSize: z.enum(["compact", "normal", "large"]).optional(),
      /** O que separa um diretório do outro na leitura contínua. */
      divider: z.enum(["band", "line", "space"]).optional(),
    })
    .optional(),
  /**
   * Assistente de IA do portal (o drawer "Perguntar à IA").
   *
   * As perguntas de partida moram AQUI, e não na config da chave de widget:
   * `widget_keys.config.suggestions` é por CHAVE DE WIDGET — o drawer do portal
   * não tem chave, ele é do espaço da documentação. Amarrar um no outro faria a
   * tela do portal depender de uma chave que pode nem existir para o espaço.
   */
  ia: z
    .object({
      /** Perguntas mostradas na conversa vazia. Caixa vazia é o pior convite:
       *  quem não sabe o que a ferramenta faz não sabe o que perguntar. */
      sugestoes: z.array(z.string().trim().min(3).max(120)).max(6).optional(),
    })
    .optional(),
  /** Integrações de rastreio do portal. Só o Measurement ID do GA4 —
   *  snippet livre de script é vetor de XSS e não entra no tema. */
  tracking: z
    .object({
      ga4: z
        .string()
        .trim()
        .regex(/^G-[A-Z0-9]{4,20}$/)
        .nullable()
        .optional(),
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
  header: { links: ThemeLink[]; showTitle: boolean; height: number };
  footer: { text: string | null; links: ThemeLink[]; social: ThemeSocial[] };
  home: {
    title: string | null;
    subtitle: string;
    heroStyle: HeroStyle;
    /** null = usar a cor da marca (`brand.color`). */
    heroColor: string | null;
    heroTexture: HeroTexture;
    heroLogo: boolean;
    categoriesStyle: CategoriesStyle;
    featured: string[];
    supportTitle: string;
    supportText: string;
    regions: { key: RegiaoKey; on: boolean }[];
  };
  ia: { sugestoes: string[] };
  article: {
    related: boolean;
    fontSize: "compact" | "normal" | "large";
    divider: "band" | "line" | "space";
  };
  tracking: { ga4: string | null };
  supportUrl: string | null;
  supportEmail: string | null;
};

const PADRAO = {
  subtitle: "Encontre respostas na documentação — ou pergunte à IA.",
  supportTitle: "Não encontrou o que procurava?",
  supportText: "Pergunte à IA com base nesta documentação ou fale com o suporte.",
  coverHeight: 200,
  headerHeight: 56,
  regioesPadrao: REGIOES.map((key) => ({ key, on: !DESLIGADAS_PADRAO.has(key) })),
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

  // Legado: "brand" (fundo colorido simples) vira "color" + textura "grid",
  // preservando o visual de quem já tinha a abertura na cor da marca.
  const heroBruto = t.home?.heroStyle;
  const heroStyle: HeroStyle = heroBruto === "brand" ? "color" : (heroBruto ?? "plain");
  const heroTexture: HeroTexture =
    t.home?.heroTexture ?? (heroBruto === "brand" ? "grid" : "none");

  return {
    brand: {
      color: t.brand?.color ?? null,
      logoUrl: t.brand?.logoUrl || null,
      coverUrl: t.brand?.coverUrl || null,
      coverHeight: t.brand?.coverHeight ?? PADRAO.coverHeight,
    },
    header: {
      links: t.header?.links ?? [],
      showTitle: t.header?.showTitle ?? true,
      height: t.header?.height ?? PADRAO.headerHeight,
    },
    footer: {
      text: t.footer?.text?.trim() || null,
      links: t.footer?.links ?? [],
      social: t.footer?.social ?? [],
    },
    home: {
      title: t.home?.title?.trim() || null,
      subtitle: t.home?.subtitle?.trim() || PADRAO.subtitle,
      heroStyle,
      heroColor: t.home?.heroColor ?? null,
      heroTexture,
      heroLogo: t.home?.heroLogo ?? false,
      categoriesStyle: t.home?.categoriesStyle ?? "cards",
      featured: t.home?.featured ?? [],
      supportTitle: t.home?.supportTitle?.trim() || PADRAO.supportTitle,
      supportText: t.home?.supportText?.trim() || PADRAO.supportText,
      regions,
    },
    article: {
      related: t.article?.related ?? true,
      // O padrão NOVO é um degrau menor que a escala original ("large").
      fontSize: t.article?.fontSize ?? "normal",
      divider: t.article?.divider ?? "band",
    },
    ia: { sugestoes: (t.ia?.sugestoes ?? []).filter((q) => q.trim()).slice(0, 6) },
    tracking: { ga4: t.tracking?.ga4 ?? null },
    supportUrl: t.supportUrl || null,
    supportEmail: t.supportEmail || null,
  };
}

/** A região está ligada? (região ausente conta como o padrão dela.) */
export function regiaoAtiva(tema: TemaResolvido, key: RegiaoKey): boolean {
  return tema.home.regions.find((r) => r.key === key)?.on ?? !DESLIGADAS_PADRAO.has(key);
}
