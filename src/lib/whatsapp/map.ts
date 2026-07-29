import type { TrackFields } from "@/lib/tracking/resolve";

/** Lê um campo da resposta, com caminho por ponto ("dados.matricula"). */
export function getPath(obj: Record<string, unknown>, path: string | undefined): string | undefined {
  if (!path) return undefined;
  const v = path.split(".").reduce<unknown>(
    (o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined),
    obj,
  );
  return v == null ? undefined : String(v);
}

/**
 * Converte a resposta da API de identificação em base_code + identidade (p_*),
 * usando o mapa configurado (nosso_campo → campo_na_resposta). Sem base_code
 * identificado → null.
 */
export function mapIdentityResponse(
  data: Record<string, unknown>,
  map: Record<string, string>,
): { baseCode: string; track: TrackFields; nome?: string } | null {
  const baseCode = getPath(data, map.base_code);
  if (!baseCode) return null;
  const track: TrackFields = {
    p_base: baseCode,
    p_usuario: getPath(data, map.p_usuario),
    p_empresa: getPath(data, map.p_empresa),
    p_matricula: getPath(data, map.p_matricula),
    p_perfil: getPath(data, map.p_perfil),
    p_portal: getPath(data, map.p_portal),
  };
  return { baseCode, track, nome: getPath(data, map.nome) };
}
