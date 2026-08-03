import type { NextRequest } from "next/server";
import {
  resolveWidgetKey,
  originAllowed,
  corsHeaders,
  clientIp,
  extractKey,
  rateLimitOk,
} from "@/lib/widget/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { glossarioParaTraducao } from "@/lib/ai/ontology";
import { traduzirTextosUI } from "@/lib/ai/ui-translate";
import { idiomaValido } from "@/lib/i18n/languages";

export const runtime = "nodejs";

/** Preflight CORS. */
export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

// Cache em memória por (espaço, idioma, texto) — a mesma string não é retraduzida
// (o widget também guarda em localStorage). Limite defensivo do lote.
const cache = new Map<string, string>();
const MAX_TEXTOS = 200;

/**
 * POST /api/v1/translate-ui — traduz textos de UI da tela host para o idioma do
 * seletor, usando o glossário da ontologia (Fase 3 — runtime, best-effort). Auth:
 * chave pública do widget + allowlist de origem + rate limit. Body: { key, lang, texts:[] }.
 * Resposta: { translations: { [texto]: traducao } }.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = (body: unknown, status: number) => Response.json(body, { status, headers: cors });

  let payload: { key?: string; lang?: string; texts?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const key = await resolveWidgetKey(extractKey(req, payload.key));
  if (!key) return json({ error: "Chave inválida ou inativa." }, 401);
  if (!originAllowed(key.allowed_origins, origin)) return json({ error: "Origem não autorizada." }, 403);
  if (!(await rateLimitOk(key.id, clientIp(req), key.rate_limit))) return json({ error: "Muitas requisições." }, 429);

  const lang = String(payload.lang ?? "").trim().toLowerCase();
  if (!idiomaValido(lang) || lang === "pt") return json({ translations: {} }, 200);
  const texts = Array.isArray(payload.texts)
    ? [...new Set(payload.texts.map((t) => String(t)).filter((t) => t.trim()))].slice(0, MAX_TEXTOS)
    : [];
  if (!texts.length) return json({ translations: {} }, 200);

  const out: Record<string, string> = {};
  const faltam: string[] = [];
  for (const t of texts) {
    const hit = cache.get(`${key.space_id}|${lang}|${t}`);
    if (hit !== undefined) out[t] = hit;
    else faltam.push(t);
  }

  if (faltam.length) {
    const supabase = createAdminClient();
    const glossario = await glossarioParaTraducao(supabase, key.space_id, lang).catch(() => []);
    const unidades = faltam.map((source, i) => ({ id: "u" + i, source }));
    const alvo = await traduzirTextosUI(unidades, lang, glossario);
    for (const u of unidades) {
      const tr = alvo.get(u.id);
      if (tr) {
        out[u.source] = tr;
        cache.set(`${key.space_id}|${lang}|${u.source}`, tr);
      }
    }
  }

  return json({ translations: out }, 200);
}
