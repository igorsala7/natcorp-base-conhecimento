import { createHmac, timingSafeEqual } from "node:crypto";

/** Assinatura esperada do webhook (formato da Meta: "sha256=<hex>"). */
export function computeSignature(raw: string, appSecret: string): string {
  return "sha256=" + createHmac("sha256", appSecret).update(raw).digest("hex");
}

/** Comparação em tempo constante (evita timing attack). */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Valida o header X-Hub-Signature-256 contra o corpo cru. */
export function verifySignature(raw: string, appSecret: string, header: string | null): boolean {
  if (!header) return false;
  return safeEqual(header, computeSignature(raw, appSecret));
}
