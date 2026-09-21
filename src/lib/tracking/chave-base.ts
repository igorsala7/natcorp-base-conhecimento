import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { gerarChaveRastreio } from "@/lib/tracking/token";
import { encryptSecret, tryDecryptSecret } from "@/lib/crypto/secrets";

/**
 * CHAVE DE RASTREIO POR BASE — a que assina o token da área de gestão.
 *
 * Esta lógica nasceu dentro de `scripts/gerar-chave-gestao.ts` porque a área de
 * gestão saiu antes de haver tela. Agora ela mora aqui e o script virou um dos
 * dois chamadores; o outro é o cadastro de base no admin, que emite a chave
 * sozinho. Uma implementação só: se o formato do token mudar, muda num lugar.
 *
 * ── Por que a chave é da BASE, e não do espaço ──────────────────────────────
 * A chave do widget (`space_tracking_keys`) é UMA por espaço, e os três espaços
 * com chave atendem as mesmas 14 bases. Ela vive em texto puro na constante
 * `c_key` do bloco PL/SQL dentro do APEX de cada cliente — então quem administra
 * o APEX de um cliente podia assinar um token dizendo ser outro. No widget o
 * estrago é contido pelas credenciais do ERP alheio; numa tela que mostra
 * consumo, fatura e conversas, não haveria anteparo nenhum.
 *
 * ── Trocar a chave é ato destrutivo ─────────────────────────────────────────
 * Sem `forcar`, uma base que já tem chave NUNCA é sobrescrita — a função devolve
 * a que existe. Emitir outra derruba a área de gestão daquele cliente até o
 * bloco do APEX dele ser atualizado, e isso é visível para o cliente final.
 */

/** Espaço onde a área de gestão vive: o Painel do Operador. */
export const ESPACO_GESTAO = "natcorp";

export type ChaveDaBase = {
  chave: string;
  /** `true` quando esta chamada emitiu uma chave nova (cadastro ou rotação). */
  novo: boolean;
  /** Quando a chave que está valendo foi gravada. `null` se nasceu agora. */
  criadaEm: string | null;
};

export type FalhaChave =
  | { erro: "base_nao_encontrada" }
  | { erro: "espaco_nao_encontrado" }
  | { erro: "indecifravel" }
  | { erro: "falha_ao_gravar"; detalhe: string };

/**
 * Devolve a chave desta base, emitindo se ainda não houver.
 *
 * Idempotente de propósito: chamar de novo não troca nada. É o que permite o
 * cadastro chamar sem medo e o backfill rodar mais de uma vez.
 */
export async function garantirChaveDaBase(args: {
  baseId: string;
  espaco?: string;
  /** Emite outra POR CIMA da existente. Derruba o cliente até o APEX mudar. */
  forcar?: boolean;
}): Promise<ChaveDaBase | FalhaChave> {
  const db = createAdminClient();
  const slug = args.espaco ?? ESPACO_GESTAO;

  const { data: espaco } = await db.from("spaces").select("id").eq("slug", slug).maybeSingle();
  if (!espaco) return { erro: "espaco_nao_encontrado" };

  const { data: existente } = await db
    .from("ai_base_tracking_keys")
    .select("key_enc, updated_at")
    .eq("base_id", args.baseId)
    .eq("space_id", espaco.id)
    .maybeSingle();

  if (existente && !args.forcar) {
    const decifrada = tryDecryptSecret(existente.key_enc);
    // Chave gravada que não abre significa `APP_ENCRYPTION_KEY` trocada. Não
    // emitimos outra por conta própria: quem decide derrubar o cliente é quem
    // clicou em rotacionar, não uma função chamada por um cadastro.
    if (!decifrada) return { erro: "indecifravel" };
    return { chave: decifrada, novo: false, criadaEm: existente.updated_at };
  }

  const chave = gerarChaveRastreio();
  const { error } = await db.from("ai_base_tracking_keys").upsert(
    {
      base_id: args.baseId,
      space_id: espaco.id,
      key_enc: encryptSecret(chave),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "base_id,space_id" },
  );
  if (error) return { erro: "falha_ao_gravar", detalhe: error.message };
  return { chave, novo: true, criadaEm: null };
}

export const ehFalha = (r: ChaveDaBase | FalhaChave): r is FalhaChave => "erro" in r;

/**
 * As três constantes do bloco PL/SQL, prontas para colar.
 *
 * É isto que o operador precisa — não a chave solta. O trabalho real é abrir a
 * região "PL/SQL Dynamic Content" no APEX do cliente e substituir três linhas.
 */
export function montarBlocoApex(args: {
  chave: string;
  /** Chave pública do widget DAQUELE painel. */
  widgetKey: string | null;
  /** URL do site (NEXT_PUBLIC_SITE_URL). */
  site: string;
}): string {
  return [
    `c_key    constant varchar2(64)  := '${args.chave}';`,
    `c_widget constant varchar2(80)  := '${args.widgetKey ?? "<chave pública do widget deste painel>"}';`,
    `c_site   constant varchar2(200) := '${args.site}';`,
  ].join("\n");
}

/** Chave pública do widget ativo do espaço da gestão (vai em `c_widget`). */
export async function widgetKeyDoEspaco(espaco = ESPACO_GESTAO): Promise<string | null> {
  const db = createAdminClient();
  const { data: sp } = await db.from("spaces").select("id").eq("slug", espaco).maybeSingle();
  if (!sp) return null;
  const { data } = await db
    .from("widget_keys")
    .select("public_key")
    .eq("space_id", sp.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  return data?.public_key ?? null;
}

/**
 * URL do site para `c_site`, sem barra no fim.
 *
 * O `??` NÃO cobre string vazia — só null/undefined. Com
 * `NEXT_PUBLIC_SITE_URL=""` (variável declarada e vazia, que é o estado normal
 * de um `.env.example` copiado sem preencher), a versão anterior devolvia `""`
 * e o bloco saía com `c_site constant varchar2(200) := '';`. Isso COMPILA no
 * APEX e só falha na tela do cliente, sem dizer por quê. Herdado de
 * `scripts/gerar-chave-gestao.ts`, achado por teste.
 */
export function siteDaGestao(): string {
  const v = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "").trim();
  return v || "https://SEU-SITE";
}
