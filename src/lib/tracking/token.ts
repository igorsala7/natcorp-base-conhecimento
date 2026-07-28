import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { trackingFields, type TrackingKey } from "@/lib/chat/tracking";

/**
 * Token de RASTREIO à prova de adulteração (pedido do usuário).
 *
 * Os parâmetros p_* (p_usuario, p_empresa, …) deixam de viajar em texto na URL:
 * o SISTEMA QUE EMBUTE (backend do cliente) gera um token com uma chave
 * compartilhada e o passa no lugar. O nosso servidor valida com a mesma chave.
 * Quem mexer no token no console apenas invalida a autenticação — não consegue
 * forjar outra identidade sem a chave, que nunca fica no navegador.
 *
 * Dois formatos aceitos (a chave é a mesma — 32 bytes em base64):
 *  - `kbt1.<base64url(iv(12) || tag(16) || ciphertext)>` — AES-256-GCM (OPACO).
 *  - `kbt1h.<base64url(payloadJSON)>.<base64url(hmacSha256)>` — HMAC-SHA256
 *    (ASSINADO): à prova de adulteração, porém os valores ficam legíveis. É o
 *    formato fácil de gerar em ambientes como Oracle APEX (PL/SQL).
 *
 * Payload (JSON): as chaves p_* + `exp` opcional (unix, em segundos).
 *
 * PURO e sem I/O: recebe a chave como argumento (a leitura da chave do espaço,
 * cifrada em repouso, fica em `resolve.ts`). É o que torna isto testável.
 */

const PREFIXO_GCM = "kbt1";
const PREFIXO_HMAC = "kbt1h";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const MAC_BYTES = 32;

export type TrackPayload = Partial<Record<TrackingKey, string>> & { exp?: number };
type TrackFields = Partial<Record<TrackingKey, string>>;

/** Gera a chave compartilhada (32 bytes em base64) — o segredo do cliente. */
export function gerarChaveRastreio(): string {
  return randomBytes(KEY_BYTES).toString("base64");
}

function lerChave(chaveB64: string): Buffer {
  const buf = Buffer.from(chaveB64, "base64");
  if (buf.length !== KEY_BYTES) {
    throw new Error("Chave de rastreio inválida (esperado 32 bytes em base64).");
  }
  return buf;
}

/** Valida o JSON do payload: expira e saneia (chaves p_* conhecidas, ≤200 chars). */
function lerPayload(json: string): TrackFields | null {
  const obj = JSON.parse(json) as unknown;
  if (!obj || typeof obj !== "object") return null;
  const exp = (obj as { exp?: unknown }).exp;
  if (typeof exp === "number" && Number.isFinite(exp) && Date.now() / 1000 > exp) return null;
  return trackingFields(obj);
}

/**
 * (AES-256-GCM) Cifra os parâmetros num token OPACO. Referência do algoritmo e
 * usado nos testes; o cliente reimplementa no backend dele.
 */
export function encriptarRastreio(chaveB64: string, payload: TrackPayload): string {
  const key = lerChave(chaveB64);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIXO_GCM}.${Buffer.concat([iv, tag, ct]).toString("base64url")}`;
}

/**
 * (HMAC-SHA256) Assina os parâmetros num token ASSINADO (valores legíveis, mas à
 * prova de adulteração). Formato fácil de gerar em PL/SQL, PHP, etc.
 */
export function assinarRastreio(chaveB64: string, payload: TrackPayload): string {
  const key = lerChave(chaveB64);
  const bytes = Buffer.from(JSON.stringify(payload), "utf8");
  const mac = createHmac("sha256", key).update(bytes).digest();
  return `${PREFIXO_HMAC}.${bytes.toString("base64url")}.${mac.toString("base64url")}`;
}

function decodeGcm(key: Buffer, body: string): TrackFields | null {
  const blob = Buffer.from(body, "base64url");
  if (blob.length < IV_BYTES + TAG_BYTES + 1) return null;
  const iv = blob.subarray(0, IV_BYTES);
  const tag = blob.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ct = blob.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const json = Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  return lerPayload(json);
}

function decodeHmac(key: Buffer, body: string): TrackFields | null {
  const p = body.split(".");
  if (p.length !== 2) return null;
  const payload = Buffer.from(p[0]!, "base64url");
  const mac = Buffer.from(p[1]!, "base64url");
  if (payload.length === 0 || mac.length !== MAC_BYTES) return null;
  const esperado = createHmac("sha256", key).update(payload).digest();
  if (!timingSafeEqual(mac, esperado)) return null; // ambos têm 32 bytes
  return lerPayload(payload.toString("utf8"));
}

/**
 * Decifra/valida o token (GCM ou HMAC) e devolve os p_* já saneados, ou `null`
 * se for inválido, adulterado, com a chave errada ou expirado. Nunca lança — o
 * servidor trata `null` como "sem identidade".
 */
export function decodificarRastreio(chaveB64: string, token: unknown): TrackFields | null {
  if (typeof token !== "string") return null;
  let key: Buffer;
  try {
    key = lerChave(chaveB64);
  } catch {
    return null;
  }
  try {
    if (token.startsWith(`${PREFIXO_HMAC}.`)) return decodeHmac(key, token.slice(PREFIXO_HMAC.length + 1));
    if (token.startsWith(`${PREFIXO_GCM}.`)) return decodeGcm(key, token.slice(PREFIXO_GCM.length + 1));
    return null;
  } catch {
    return null;
  }
}
