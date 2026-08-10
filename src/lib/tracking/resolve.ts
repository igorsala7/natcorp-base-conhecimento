import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { tryDecryptSecret } from "@/lib/crypto/secrets";
import { decodificarRastreioDetalhado } from "./token";
import type { TrackingKey } from "@/lib/chat/tracking";

export type TrackFields = Partial<Record<TrackingKey, string>>;

/**
 * Por que a identidade não veio. `sem_token` é o caso legítimo do portal
 * público; `expirado` é a sessão do painel que acabou; `sem_chave` é instalação
 * incompleta. Só `expirado` vira aviso na tela do usuário — os outros dois são
 * problema de configuração, não dele.
 */
export type MotivoSemIdentidade = "sem_token" | "sem_chave" | "expirado" | "invalido";

/** Extrai o token de um `track` do cliente (`{ token }` ou a própria string). */
function extrairToken(track: unknown): string | null {
  if (typeof track === "string") return track;
  if (track && typeof track === "object") {
    const t = (track as { token?: unknown }).token;
    if (typeof t === "string") return t;
  }
  return null;
}

/** Lê a chave de rastreio do espaço (cifrada em repouso) via service-role. */
async function chaveDoEspaco(spaceId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("space_tracking_keys")
    .select("key_enc")
    .eq("space_id", spaceId)
    .maybeSingle();
  return data?.key_enc ? tryDecryptSecret(data.key_enc) : null;
}

/**
 * Resolve a IDENTIDADE de rastreio (p_*) a partir do TOKEN cifrado enviado pelo
 * cliente, usando a chave do ESPAÇO. Substitui o antigo `trackingFields`, que
 * confiava em p_* em texto puro. Devolve {} quando não há token válido ou o
 * espaço não tem chave configurada — nunca lança, nunca aceita texto forjado.
 */
export async function decodeTrackForSpace(spaceId: string, track: unknown): Promise<TrackFields> {
  return (await decodeTrackDetalhado(spaceId, track)).campos;
}

/**
 * Igual ao anterior, mas diz POR QUE não houve identidade.
 *
 * Existe porque o silêncio custava caro: com o token vencido, a conversa seguia
 * como anônima, as ferramentas que dependem de `p_usuario` eram cortadas e a IA
 * respondia "não tenho acesso" — indistinguível de um defeito do produto. Com o
 * motivo em mãos, o widget diz "sua sessão no painel expirou, atualize a
 * página", que é acionável.
 */
export async function decodeTrackDetalhado(
  spaceId: string,
  track: unknown,
): Promise<{ campos: TrackFields; motivo: MotivoSemIdentidade | null }> {
  const token = extrairToken(track);
  if (!token || !spaceId) return { campos: {}, motivo: "sem_token" };
  const chave = await chaveDoEspaco(spaceId);
  if (!chave) return { campos: {}, motivo: "sem_chave" };
  const r = decodificarRastreioDetalhado(chave, token);
  return r.ok ? { campos: r.campos, motivo: null } : { campos: {}, motivo: r.motivo };
}

/** Só existe identidade de cliente (biblioteca de prompts) com base + usuário. */
export function temIdentidadeCliente(t: TrackFields): t is TrackFields & { p_base: string; p_usuario: string } {
  return Boolean(t.p_base && t.p_usuario);
}
