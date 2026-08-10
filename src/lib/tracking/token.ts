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

/**
 * Resultado DETALHADO da validação.
 *
 * A diferença entre "expirou" e "não presta" não é acadêmica: expirado é o
 * caminho normal de quem ficou com a aba aberta e merece "atualize a página";
 * inválido é chave errada ou adulteração, e merece outro texto e outro log.
 * Enquanto os dois viravam o mesmo `null`, a sessão vencida degradava para
 * anônimo em silêncio e a pessoa só via a IA dizer que não tinha acesso.
 */
export type ResultadoRastreio =
  | { ok: true; campos: TrackFields }
  | { ok: false; motivo: "expirado" | "invalido" };

const INVALIDO = { ok: false, motivo: "invalido" } as const;

/** Valida o JSON do payload: expira e saneia (chaves p_* conhecidas, ≤200 chars). */
function lerPayload(json: string): ResultadoRastreio {
  const obj = JSON.parse(json) as unknown;
  if (!obj || typeof obj !== "object") return INVALIDO;
  const exp = (obj as { exp?: unknown }).exp;
  if (typeof exp === "number" && Number.isFinite(exp) && Date.now() / 1000 > exp) {
    return { ok: false, motivo: "expirado" };
  }
  return { ok: true, campos: trackingFields(obj) };
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

function decodeGcm(key: Buffer, body: string): ResultadoRastreio {
  const blob = Buffer.from(body, "base64url");
  if (blob.length < IV_BYTES + TAG_BYTES + 1) return INVALIDO;
  const iv = blob.subarray(0, IV_BYTES);
  const tag = blob.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ct = blob.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const json = Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  return lerPayload(json);
}

function decodeHmac(key: Buffer, body: string): ResultadoRastreio {
  const p = body.split(".");
  if (p.length !== 2) return INVALIDO;
  const payload = Buffer.from(p[0]!, "base64url");
  const mac = Buffer.from(p[1]!, "base64url");
  if (payload.length === 0 || mac.length !== MAC_BYTES) return INVALIDO;
  const esperado = createHmac("sha256", key).update(payload).digest();
  if (!timingSafeEqual(mac, esperado)) return INVALIDO; // ambos têm 32 bytes
  return lerPayload(payload.toString("utf8"));
}

/**
 * Decifra/valida o token (GCM ou HMAC) dizendo POR QUE recusou. Nunca lança.
 */
export function decodificarRastreioDetalhado(chaveB64: string, token: unknown): ResultadoRastreio {
  if (typeof token !== "string") return INVALIDO;
  let key: Buffer;
  try {
    key = lerChave(chaveB64);
  } catch {
    return INVALIDO;
  }
  try {
    if (token.startsWith(`${PREFIXO_HMAC}.`)) return decodeHmac(key, token.slice(PREFIXO_HMAC.length + 1));
    if (token.startsWith(`${PREFIXO_GCM}.`)) return decodeGcm(key, token.slice(PREFIXO_GCM.length + 1));
    return INVALIDO;
  } catch {
    return INVALIDO;
  }
}

/**
 * Decifra/valida o token (GCM ou HMAC) e devolve os p_* já saneados, ou `null`
 * se for inválido, adulterado, com a chave errada ou expirado. Nunca lança — o
 * servidor trata `null` como "sem identidade".
 */
export function decodificarRastreio(chaveB64: string, token: unknown): TrackFields | null {
  const r = decodificarRastreioDetalhado(chaveB64, token);
  return r.ok ? r.campos : null;
}
