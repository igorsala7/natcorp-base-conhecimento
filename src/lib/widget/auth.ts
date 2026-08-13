import "server-only";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Configuração visual do widget (guardada em widget_keys.config). */
export type WidgetConfig = {
  primaryColor?: string;
  title?: string;
  welcome?: string;
  avatarUrl?: string;
  /**
   * Estilo da BOLHA e do AVATAR. Tudo opcional: ausente = o visual de sempre
   * (gradiente da cor primária, círculo, sem borda). Os valores são validados no
   * `widget.js` antes de virarem CSS — `config` é escrito por quem administra,
   * mas entra num `style`.
   */
  bubbleBg?: string;
  /** Fim do degradê próprio da peça. Vazio = cor sólida. */
  bubbleBg2?: string;
  bubbleBorderWidth?: number;
  bubbleBorderColor?: string;
  bubbleShape?: "circle" | "rounded" | "square";
  bubbleFit?: "cover" | "contain";
  bubbleShadow?: "padrao" | "soft" | "none";
  avatarBg?: string;
  avatarBg2?: string;
  avatarBorderWidth?: number;
  avatarBorderColor?: string;
  avatarFit?: "cover" | "contain";
  suggestions?: string[];
  position?: "right" | "left";
  /**
   * Varredura da tela: se o widget lê os dados/campos/textos da página do
   * cliente e os envia como contexto para a IA. Por widget. `undefined`/`true`
   * = ligado (comportamento atual); `false` = desligado (mais privacidade).
   */
  scan?: boolean;
  /**
   * Assistente de formulário: o widget lê os CAMPOS da tela (estruturados) e a
   * IA pode OPINAR sobre valores e PROPOR preencher um campo (com confirmação
   * visual do usuário). `true` liga; `undefined`/`false` = desligado (padrão).
   */
  formAssist?: boolean;
};

export type ResolvedKey = {
  id: string;
  /** Espaço DONO: permissão e `conversations.space_id` (que é NOT NULL). */
  space_id: string;
  /**
   * ESCOPO de leitura do RAG — uma ou várias documentações. Sempre inclui o
   * dono, mesmo que a junção esteja vazia: uma chave sem escopo emudeceria o
   * widget, e um estado de dados incompleto não pode derrubar o produto.
   */
  space_ids: string[];
  allowed_origins: string[];
  rate_limit: number;
  config: WidgetConfig;
  /** Prompt próprio deste chatbot (nulo = herda o da documentação). */
  system_prompt: string | null;
};

/**
 * Resolve uma chave pública (pk_...) ativa via service-role. Retorna null se
 * inexistente/inativa. A chave é PÚBLICA: a segurança vem da allowlist de
 * origem + rate limit + escopo fixo nas documentações vinculadas.
 */
export async function resolveWidgetKey(
  publicKey: string | null,
): Promise<ResolvedKey | null> {
  if (!publicKey || !publicKey.startsWith("pk_")) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("widget_keys")
    .select("id, space_id, allowed_origins, rate_limit, config, active, system_prompt")
    .eq("public_key", publicKey)
    .maybeSingle();
  if (!data || !data.active) return null;

  const { data: escopo } = await supabase
    .from("widget_key_spaces")
    .select("space_id")
    .eq("widget_key_id", data.id);

  // O dono entra sempre e sem duplicar: se a junção perdeu a linha por algum
  // motivo, o chatbot continua respondendo sobre a própria documentação.
  const space_ids = [...new Set([data.space_id, ...(escopo ?? []).map((e) => e.space_id)])];

  return {
    id: data.id,
    space_id: data.space_id,
    space_ids,
    allowed_origins: data.allowed_origins ?? [],
    rate_limit: data.rate_limit ?? 30,
    config: (data.config ?? {}) as WidgetConfig,
    system_prompt: data.system_prompt ?? null,
  };
}

/**
 * Origem permitida? Allowlist vazia = qualquer origem (conveniente para testar;
 * o admin recomenda restringir). Requisição sem Origin (server-to-server via
 * API REST) é permitida — CORS só se aplica a navegador.
 */
export function originAllowed(allowed: string[], origin: string | null): boolean {
  if (!origin) return true;
  if (allowed.length === 0) return true;
  return allowed.some((a) => a.trim().replace(/\/$/, "") === origin.replace(/\/$/, ""));
}

/** Cabeçalhos CORS. Reflete a origem quando permitida. */
export function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Widget-Key, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** IP do requisitante (por trás de proxy). */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

/** Extrai a chave pública do header, query ou body. */
export function extractKey(req: NextRequest, bodyKey?: unknown): string | null {
  const header = req.headers.get("x-widget-key");
  if (header) return header;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const q = req.nextUrl.searchParams.get("key");
  if (q) return q;
  if (typeof bodyKey === "string") return bodyKey;
  return null;
}

/**
 * Consome uma requisição do bucket. Janela de 60s. Aplica DOIS limites
 * (por chave e por IP) — o menor prevalece. Retorna true se permitido.
 */
/**
 * Teto por minuto.
 *
 * ── Por que o balde deixou de ser a CHAVE ────────────────────────────────────
 * O balde `k:<chave>` é UM só para todo mundo que usa aquele widget. Com o
 * padrão de 30/min, trinta requisições da EMPRESA INTEIRA no mesmo minuto
 * derrubavam todos com "Muitas requisições. Tente em instantes." — e um único
 * usuário ativo gasta várias por turno (a conversa, o dataset, o relatório
 * salvo, a ação de lista). Relatado em 13/08/2026.
 *
 * Um teto por chave protege contra roubo da chave pública. Mas quando o token de
 * rastreio identifica QUEM está falando — e ele é cifrado, não forjável —, a
 * pessoa é o balde certo: limita o abuso individual sem punir o colega ao lado.
 * O balde por IP continua, e é ele que segura o caso da chave vazada usada em
 * massa de um mesmo ponto.
 */
export async function rateLimitOk(
  keyId: string,
  ip: string,
  max: number,
  /** Quem está falando (do token de rastreio). Ausente = anônimo, cai no balde da chave. */
  sujeito?: string | null,
): Promise<boolean> {
  const supabase = createAdminClient();
  const quem = String(sujeito ?? "").trim();
  const [principal, byIp] = await Promise.all([
    supabase.rpc("rate_limit_hit", {
      p_bucket: quem ? `u:${keyId}:${quem}` : `k:${keyId}`,
      p_max: max,
      p_window_seconds: 60,
    }),
    // Por IP: teto mais folgado (2×) para não punir NAT corporativo, mas ainda barra abuso.
    // Com usuário identificado o IP é compartilhado pelo escritório inteiro, então
    // o teto acompanha — senão trocaríamos um gargalo global por um por prédio.
    supabase.rpc("rate_limit_hit", {
      p_bucket: `ip:${ip}`,
      p_max: quem ? max * 20 : max * 2,
      p_window_seconds: 60,
    }),
  ]);
  return (principal.data ?? true) === true && (byIp.data ?? true) === true;
}

/** Gera uma chave pública nova: pk_live_<32 hex>. */
export function generatePublicKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `pk_live_${hex}`;
}
