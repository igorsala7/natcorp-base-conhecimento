import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

/**
 * Cifra e decifra segredos guardados no banco (chaves de API de provedores,
 * senha de SMTP).
 *
 * **Por que na aplicação e não no `pgp_sym_encrypt` do pgcrypto:** ali a
 * chave-mestra viajaria como parâmetro de SQL e poderia acabar em
 * `pg_stat_statements` e nos logs do Postgres. Cifrando aqui, o banco só
 * enxerga base64 — nem o DBA lê a chave.
 *
 * AES-256-GCM: além de cifrar, AUTENTICA. Um byte adulterado no banco faz o
 * `decrypt` falhar em vez de devolver lixo silencioso.
 *
 * Formato: `v1:<iv>:<tag>:<ciphertext>`, tudo em base64url. O prefixo de versão
 * existe para permitir rotação futura sem adivinhar o formato do que já está
 * gravado.
 */

const VERSAO = "v1";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // recomendado para GCM
const NOME_ENV = "APP_ENCRYPTION_KEY";

export class SecretError extends Error {}

/**
 * Deriva a chave de 32 bytes a partir da env.
 *
 * SHA-256 do valor bruto: aceita qualquer comprimento de senha sem exigir que
 * o operador gere exatamente 32 bytes — a alternativa seria falhar no deploy
 * por um detalhe de formato.
 */
function chave(): Buffer {
  const bruta = process.env[NOME_ENV];
  if (!bruta || bruta.length < 16) {
    throw new SecretError(
      `${NOME_ENV} ausente ou curta demais (mínimo 16 caracteres). ` +
        `Sem ela não é possível ler nem gravar segredos.`,
    );
  }
  return createHash("sha256").update(bruta, "utf8").digest();
}

/** Há chave-mestra configurada? Use para desabilitar a UI com uma explicação. */
export function hasEncryptionKey(): boolean {
  const bruta = process.env[NOME_ENV];
  return Boolean(bruta && bruta.length >= 16);
}

const b64 = (b: Buffer) => b.toString("base64url");
const deB64 = (s: string) => Buffer.from(s, "base64url");

/** Cifra um texto. Duas chamadas com o mesmo texto produzem saídas DIFERENTES. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, chave(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSAO, b64(iv), b64(cipher.getAuthTag()), b64(ct)].join(":");
}

/**
 * Decifra. Lança `SecretError` se o payload estiver malformado, adulterado ou
 * se a chave estiver errada — nunca devolve texto parcial.
 */
export function decryptSecret(payload: string): string {
  const partes = (payload ?? "").split(":");
  if (partes.length !== 4 || partes[0] !== VERSAO) {
    throw new SecretError("Segredo em formato desconhecido.");
  }
  try {
    const decipher = createDecipheriv(ALGO, chave(), deB64(partes[1]!));
    decipher.setAuthTag(deB64(partes[2]!));
    return Buffer.concat([decipher.update(deB64(partes[3]!)), decipher.final()]).toString("utf8");
  } catch (e) {
    if (e instanceof SecretError) throw e;
    // A mensagem do OpenSSL ("unable to authenticate data") não ajuda quem lê
    // o log do admin; o que importa é a causa provável.
    throw new SecretError("Não foi possível decifrar: chave-mestra errada ou dado corrompido.");
  }
}

/** Versão tolerante: devolve `null` em vez de lançar. */
export function tryDecryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    return decryptSecret(payload);
  } catch {
    return null;
  }
}

/**
 * Mascara um segredo para exibição. NUNCA envie o valor real para o cliente —
 * é isto que a tela mostra.
 */
export function maskSecret(plain: string | null | undefined): string {
  if (!plain) return "—";
  const limpo = plain.trim();
  if (limpo.length <= 8) return "•".repeat(limpo.length);
  return `${limpo.slice(0, 3)}…${limpo.slice(-4)}`;
}
