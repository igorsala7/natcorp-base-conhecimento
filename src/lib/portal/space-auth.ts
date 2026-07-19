import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env.server";

// Cookie assinado (HMAC) que prova que o visitante acertou a senha do espaço.
// Não confiamos em "URL secreta": o conteúdo só é lido via service-role DEPOIS
// de validar este cookie no servidor.
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export function spaceCookieName(spaceId: string): string {
  return `kb_pw_${spaceId}`;
}

function sign(payload: string): string {
  return createHmac("sha256", serverEnv.SUPABASE_SERVICE_ROLE_KEY).update(payload).digest("hex");
}

/** Gera o token `exp.sig` para o cookie do espaço. */
export function makeSpaceToken(spaceId: string): string {
  const exp = String(Date.now() + TTL_MS);
  return `${exp}.${sign(`${spaceId}.${exp}`)}`;
}

/** Valida o token do cookie (assinatura + expiração). */
export function verifySpaceToken(spaceId: string, token: string | undefined): boolean {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = sign(`${spaceId}.${exp}`);
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const SPACE_COOKIE_MAX_AGE = TTL_MS / 1000;
