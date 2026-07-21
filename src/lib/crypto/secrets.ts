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
/**
 * Marcador de segredo NÃO cifrado.
 *
 * Existe para o produto funcionar sem `APP_ENCRYPTION_KEY` durante o
 * desenvolvimento. É explícito de propósito: um segredo em claro fica
 * reconhecível no banco, e a leitura sabe exatamente o que está lendo em vez de
 * adivinhar formato. Nenhuma chave de API real começa com este prefixo.
 */
const PLANO = "plain";
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

/**
 * Há chave-mestra configurada?
 *
 * NÃO bloqueia mais o cadastro de segredos — serve para a tela avisar que eles
 * estão sendo guardados em claro.
 */
export function hasEncryptionKey(): boolean {
  const bruta = process.env[NOME_ENV];
  return Boolean(bruta && bruta.length >= 16);
}

const b64 = (b: Buffer) => b.toString("base64url");
const deB64 = (s: string) => Buffer.from(s, "base64url");

/**
 * Guarda um segredo.
 *
 * COM `APP_ENCRYPTION_KEY`: cifra em AES-256-GCM (duas chamadas com o mesmo
 * texto produzem saídas diferentes).
 * SEM a chave: grava em TEXTO SIMPLES com o prefixo `plain:`.
 *
 * O modo em claro é uma concessão consciente ao ambiente de desenvolvimento.
 * A proteção de ACESSO continua valendo — `ai_provider_keys` e `email_secrets`
 * não têm grant para nenhum papel comum, então o segredo segue inalcançável por
 * SQL de aplicação. O que se perde é a proteção em repouso: quem obtiver um
 * dump do banco lê a chave. Definir a env e salvar de novo já cifra.
 */
export function encryptSecret(plain: string): string {
  if (!hasEncryptionKey()) return `${PLANO}:${plain}`;
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
  const bruto = payload ?? "";
  // Segredo gravado em claro: devolve o que vier depois do prefixo. `slice`
  // e não `split`, porque o valor pode conter ":".
  if (bruto.startsWith(`${PLANO}:`)) return bruto.slice(PLANO.length + 1);

  const partes = bruto.split(":");
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

/** O segredo está guardado em claro? A tela usa para mostrar o aviso. */
export function isPlainSecret(payload: string | null | undefined): boolean {
  return !!payload && payload.startsWith(`${PLANO}:`);
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
