import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { tryDecryptSecret } from "@/lib/crypto/secrets";
import { decodificarRastreioDetalhado } from "./token";
import type { TrackingKey } from "@/lib/chat/tracking";

/**
 * Validação de token de rastreio AMARRADA À BASE.
 *
 * ── Por que este arquivo existe, e não dá para usar `resolve.ts` ────────
 *
 * `resolve.ts` busca a chave por `space_id`. Como os três espaços com chave
 * (`natcorp` = Operador, `painel-do-gestor`, `painel-do-colaborador`) estão
 * ligados às MESMAS 14 bases, existe UMA chave por painel para todos os
 * clientes — e ela mora, em texto puro, na constante `c_key` do bloco PL/SQL
 * dentro do APEX de cada cliente (`apex/token-rastreio.sql`).
 *
 * Como nada amarra o `p_base` do payload à chave, quem administra o APEX de um
 * cliente pode emitir `{"p_base":"<outro cliente>"}` e o servidor aceita. No
 * widget isso é contido por acidente (as ferramentas ainda batem no ERP alheio,
 * com credenciais que essa pessoa não tem). Na área de gestão não há anteparo
 * nenhum: consumo, fatura e histórico de conversas estão no nosso Postgres.
 *
 * ── A inversão ─────────────────────────────────────────────────────────
 *
 *   1. lê o payload SEM confiar nele, só para descobrir qual base ele alega ser
 *   2. busca a chave DAQUELA base em `ai_base_tracking_keys`
 *   3. verifica o HMAC com essa chave — token de outra base não fecha
 *   4. só então a identidade é confiável
 *
 * O passo 1 não é uma brecha: ler o payload de um token HMAC é público por
 * construção (o formato é assinado, não cifrado — o próprio bloco PL/SQL
 * documenta isso). O que decide é o passo 3.
 *
 * ── Só `kbt1h` ─────────────────────────────────────────────────────────
 *
 * O formato opaco (`kbt1`, AES-GCM) não permite descobrir a base antes de ter a
 * chave, e tentar chave por chave até uma decifrar transformaria isto num
 * oráculo. Como o APEX gera `kbt1h`, a área de gestão aceita só ele.
 */

export type MotivoRecusa =
  | "sem_token"
  | "formato_nao_suportado"
  | "sem_base_no_token"
  | "base_desconhecida"
  | "sem_chave_da_base"
  | "assinatura_invalida"
  | "expirado"
  | "painel_nao_permitido";

export type IdentidadeGestao = {
  baseCode: string;
  baseId: string;
  baseNome: string;
  usuario: string | null;
  perfil: string | null;
  painel: string | null;
  empresa: string | null;
  matricula: string | null;
};

export type ResultadoGestao =
  | { ok: true; identidade: IdentidadeGestao }
  | { ok: false; motivo: MotivoRecusa };

const PREFIXO_HMAC = "kbt1h.";

/**
 * Lê o payload de um token assinado SEM verificar a assinatura.
 *
 * O valor devolvido é uma ALEGAÇÃO, não um fato — serve unicamente para saber
 * qual chave usar na verificação. Nada daqui pode chegar a uma consulta antes
 * de `decodificarRastreioDetalhado` confirmar a assinatura.
 */
function baseAlegada(token: string): string | null {
  if (!token.startsWith(PREFIXO_HMAC)) return null;
  const corpo = token.slice(PREFIXO_HMAC.length).split(".");
  if (corpo.length !== 2) return null;
  try {
    const json = Buffer.from(corpo[0]!, "base64url").toString("utf8");
    const obj = JSON.parse(json) as unknown;
    if (!obj || typeof obj !== "object") return null;
    const base = (obj as Record<string, unknown>).p_base;
    if (typeof base !== "string") return null;
    const limpo = base.trim().toLowerCase();
    return limpo === "" ? null : limpo;
  } catch {
    return null;
  }
}

/** Escapa os curingas do `ilike` — um `base_code` com `%` casaria demais. */
function escaparIlike(v: string): string {
  return v.replace(/([\\%_])/g, "\\$1");
}

/**
 * Resolve a identidade de gestão a partir do token, exigindo que a assinatura
 * feche com a chave da base que o próprio token declara.
 *
 * `paineisPermitidos` fecha a porta por painel: a área de gestão vive no Painel
 * do Operador, e um token de colaborador não deve abrir a tela de faturamento
 * do cliente inteiro nem o histórico de conversas de terceiros.
 */
export async function resolverIdentidadeGestao(
  spaceId: string,
  token: unknown,
  paineisPermitidos: readonly string[] = ["PO"],
): Promise<ResultadoGestao> {
  if (typeof token !== "string" || token.trim() === "") {
    return { ok: false, motivo: "sem_token" };
  }
  if (!token.startsWith(PREFIXO_HMAC)) {
    return { ok: false, motivo: "formato_nao_suportado" };
  }

  const alegada = baseAlegada(token);
  if (!alegada) return { ok: false, motivo: "sem_base_no_token" };

  const supabase = createAdminClient();

  const { data: base } = await supabase
    .from("ai_bases")
    .select("id, base_code, name, active")
    .ilike("base_code", escaparIlike(alegada))
    .maybeSingle();

  if (!base || !base.active) return { ok: false, motivo: "base_desconhecida" };

  const { data: linha } = await supabase
    .from("ai_base_tracking_keys")
    .select("key_enc")
    .eq("base_id", base.id)
    .eq("space_id", spaceId)
    .maybeSingle();

  // Base sem chave própria FALHA FECHADA. É deliberado: cair de volta na chave
  // do espaço reabriria exatamente o buraco que esta função existe para fechar.
  // O custo é de implantação — cada APEX precisa receber o `c_key` da sua base.
  const chave = linha?.key_enc ? tryDecryptSecret(linha.key_enc) : null;
  if (!chave) return { ok: false, motivo: "sem_chave_da_base" };

  const r = decodificarRastreioDetalhado(chave, token);
  if (!r.ok) {
    return { ok: false, motivo: r.motivo === "expirado" ? "expirado" : "assinatura_invalida" };
  }

  const campos = r.campos as Partial<Record<TrackingKey, string>>;

  // Cinto e suspensório: a assinatura já garante que o payload não foi
  // adulterado, mas se o `p_base` verificado divergir do que orientou a escolha
  // da chave, algo está muito errado — recusa em vez de seguir.
  const verificada = (campos.p_base ?? "").trim().toLowerCase();
  if (verificada !== alegada) return { ok: false, motivo: "assinatura_invalida" };

  const painel = campos.p_portal?.trim() || null;
  if (paineisPermitidos.length > 0 && (!painel || !paineisPermitidos.includes(painel))) {
    return { ok: false, motivo: "painel_nao_permitido" };
  }

  return {
    ok: true,
    identidade: {
      baseCode: base.base_code,
      baseId: base.id,
      baseNome: base.name,
      usuario: campos.p_usuario?.trim() || null,
      perfil: campos.p_perfil?.trim() || null,
      painel,
      empresa: campos.p_empresa?.trim() || null,
      matricula: campos.p_matricula?.trim() || null,
    },
  };
}

/** Texto curto e acionável para cada recusa. Aparece na tela do usuário. */
export function mensagemDaRecusa(motivo: MotivoRecusa): string {
  switch (motivo) {
    case "expirado":
      return "Sua sessão no painel expirou. Atualize a página do APEX para continuar.";
    case "sem_token":
    case "formato_nao_suportado":
    case "sem_base_no_token":
      return "Esta página precisa ser aberta de dentro do painel. O link direto não funciona.";
    case "sem_chave_da_base":
      return "Esta base ainda não foi habilitada para a área de gestão. Fale com o suporte Natcorp.";
    case "painel_nao_permitido":
      return "A área de gestão está disponível apenas no Painel do Operador.";
    case "base_desconhecida":
    case "assinatura_invalida":
      return "Não foi possível validar sua identidade. Atualize a página do APEX e tente de novo.";
  }
}
