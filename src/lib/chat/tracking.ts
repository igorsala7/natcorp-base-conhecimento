/**
 * Parâmetros de rastreio de uma conversa (de onde/quem veio: base, usuário,
 * portal, empresa, matrícula ou código de candidato). Vêm do widget (data-* ou querystring da página)
 * ou do "Perguntar à IA". São tratados como DADO puro — jamais entram no prompt
 * da IA — e servem para o admin filtrar e auditar quem perguntou o quê.
 */
export const TRACKING_KEYS = [
  "p_base",
  "p_usuario",
  "p_portal",
  "p_empresa",
  "p_matricula",
  "p_perfil",
  // Painel do Candidato: quem ainda não tem matrícula. Ver `tipo-acesso.ts` —
  // matrícula preenchida continua mandando, para o contratado deixar de ser
  // candidato sem depender de o anfitrião limpar este campo.
  "p_cod_candidato",
] as const;

export type TrackingKey = (typeof TRACKING_KEYS)[number];

const MAX = 200;

/**
 * Extrai apenas os campos de rastreio de um payload não confiável, como texto
 * saneado (aparado, ≤200 chars). Devolve só as chaves presentes — pronto para
 * `.insert({ ...trackingFields(payload.track) })`.
 */
export function trackingFields(raw: unknown): Partial<Record<TrackingKey, string>> {
  const out: Partial<Record<TrackingKey, string>> = {};
  if (raw && typeof raw === "object") {
    for (const k of TRACKING_KEYS) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === "string") {
        const t = v.trim().slice(0, MAX);
        if (t) out[k] = t;
      }
    }
  }
  return out;
}
