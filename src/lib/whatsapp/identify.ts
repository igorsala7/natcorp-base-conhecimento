import "server-only";
import { executeTool, type RuntimeTool, type RuntimeCredential } from "@/lib/integrations/executor";
import type { ParamLocal } from "@/lib/integrations/tools";
import type { TrackFields } from "@/lib/tracking/resolve";
import type { WhatsappRuntime } from "./config";
import { mapIdentityResponse } from "./map";

export type WhatsappIdentity = { baseCode: string; track: TrackFields; nome?: string };

// Cache curto telefone→identidade: evita chamar a API de identificação a cada
// mensagem. Guarda também o "não identificado" (value=null) por pouco tempo.
const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { value: WhatsappIdentity | null; exp: number }>();

export async function identifyByPhone(rt: WhatsappRuntime, phone: string): Promise<WhatsappIdentity | null> {
  const hit = cache.get(phone);
  if (hit && hit.exp > Date.now()) return hit.value;
  const value = await doIdentify(rt, phone);
  cache.set(phone, { value, exp: Date.now() + CACHE_TTL_MS });
  return value;
}

/**
 * Identifica o remetente pelo telefone chamando a API de identificação e
 * mapeando a resposta para base_code + identidade (p_*). Reusa o executor do
 * módulo de integração: o telefone entra como um parâmetro FIXO.
 */
async function doIdentify(rt: WhatsappRuntime, phone: string): Promise<WhatsappIdentity | null> {
  if (!rt.identity.endpoint) return null;

  const tool: RuntimeTool = {
    key: "wa_identify",
    name: "identify",
    method: rt.identity.method,
    path_template: "",
    auth_type: rt.identity.authType,
    params: [
      {
        nome: rt.identity.phoneParam,
        descricao: "",
        tipo: "string",
        origem: "fixo",
        obrigatorio: true,
        local: (rt.identity.phoneLocal as ParamLocal) || "query",
        valorFixo: phone,
      },
    ],
  };
  const credential: RuntimeCredential | null =
    rt.identity.authType === "none"
      ? null
      : { id: "wa-identity", auth_type: rt.identity.authType, secret: rt.identity.secret };

  const res = await executeTool({
    tool,
    baseUrl: rt.identity.endpoint,
    credential,
    modelArgs: {},
    identity: {},
  });
  if (!res.ok || !res.data || typeof res.data !== "object") return null;
  return mapIdentityResponse(res.data as Record<string, unknown>, rt.identity.map);
}
