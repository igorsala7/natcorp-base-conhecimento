import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Portão de créditos do turno de chat.
 *
 * ── Por que um cache de 30 segundos ────────────────────────────────────
 *
 * Isto roda a cada mensagem. A consulta é barata (índice
 * `ai_usage_base_norm_periodo_idx`), mas o turno já paga várias idas ao banco e
 * esta não precisa ser exata ao token: a janela é MENSAL. Trinta segundos de
 * folga significa, no pior caso, alguns turnos além do limite — irrelevante
 * contra um teto de milhões de tokens, e o consumo excedente continua sendo
 * registrado e cobrado.
 *
 * O cache é por (base, painel, perfil, usuário) porque a decisão depende da
 * alocação daquele recorte. Guardar só por base liberaria um usuário que
 * estourou a cota dele sempre que outro da mesma base tivesse acabado de passar.
 *
 * ── Falha do banco não bloqueia ────────────────────────────────────────
 *
 * Se a RPC falhar, devolvemos `null` e o chat segue. Um erro de infraestrutura
 * nossa não pode parar o atendimento do cliente — e o consumo continua sendo
 * gravado, então nada se perde na fatura.
 */

const TTL_MS = 30_000;

export type VereditoCredito = {
  permitido: boolean;
  motivo: string;
  creditos_disponiveis?: number;
  creditos_consumidos?: number;
  alvo_tipo?: string;
  alvo?: string | null;
};

type Entrada = { exp: number; veredito: VereditoCredito };
const cache = new Map<string, Entrada>();

type Track = {
  p_base?: string;
  p_portal?: string;
  p_perfil?: string;
  p_usuario?: string;
};

/**
 * Consulta o portão. `null` = não foi possível apurar (sem base, ou erro) —
 * quem chama trata como "segue".
 */
export async function creditoDoTurno(track: Track): Promise<VereditoCredito | null> {
  const base = (track.p_base ?? "").trim().toLowerCase();
  if (!base) return null;

  const painel = (track.p_portal ?? "").trim() || null;
  const perfil = (track.p_perfil ?? "").trim() || null;
  const usuario = (track.p_usuario ?? "").trim() || null;

  const k = `${base}|${painel ?? ""}|${perfil ?? ""}|${usuario ?? ""}`;
  const agora = Date.now();
  const hit = cache.get(k);
  if (hit && hit.exp > agora) return hit.veredito;

  try {
    const db = createAdminClient();
    const { data, error } = await db.rpc("gestao_portao_credito", {
      p_base: base,
      p_painel: painel ?? undefined,
      p_perfil: perfil ?? undefined,
      p_usuario: usuario ?? undefined,
    });
    if (error || !data) return null;

    const veredito = data as unknown as VereditoCredito;
    cache.set(k, { exp: agora + TTL_MS, veredito });
    return veredito;
  } catch {
    return null;
  }
}

/**
 * Zera o cache de uma base — chamado quando o cliente compra créditos, para o
 * assistente destravar na hora em vez de esperar os 30 segundos.
 */
export function invalidarPortao(baseCode: string): void {
  const prefixo = `${baseCode.trim().toLowerCase()}|`;
  for (const k of cache.keys()) {
    if (k.startsWith(prefixo)) cache.delete(k);
  }
}
