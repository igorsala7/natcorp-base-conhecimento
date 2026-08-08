import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import type { ConfigDelegada, ProviderConnect, Tokens } from "./oauth-user";

/**
 * Persistência do consentimento delegado.
 *
 * Separado de [oauth-user.ts](./oauth-user.ts) de propósito: lá fica a lógica
 * de protocolo (montar URL, trocar código, decidir renovação), testável sem
 * rede nem banco; aqui fica o que precisa de service-role. As rotas costuram os
 * dois.
 *
 * Tudo passa por service-role porque `user_connection_tokens` e `oauth_states`
 * não têm grant para papel nenhum — nem admin lê token por SQL de aplicação.
 */

/** Nonce de 32 bytes. Uso único e TTL curto substituem a assinatura do `state`. */
const TTL_MS = 10 * 60 * 1000;

export type CredencialDelegada = {
  credentialId: string;
  baseId: string;
  provider: ProviderConnect;
  cfg: ConfigDelegada;
};

/**
 * A credencial delegada de um cliente, resolvida pelo `p_base` do token de
 * rastreio — nunca por algo que venha do navegador.
 *
 * É aqui que mora o isolamento entre clientes: `ai_bases.base_code` é a empresa
 * 1:1, e a credencial pendura em `base_id`. Um `p_base` de outro cliente
 * simplesmente não alcança este registro.
 */
export async function credencialDelegada(
  baseCode: string,
  provider: ProviderConnect,
): Promise<CredencialDelegada | null> {
  const alvo = baseCode.trim();
  if (!alvo) return null;
  const db = createAdminClient();

  const { data: base } = await db
    .from("ai_bases")
    .select("id")
    .ilike("base_code", alvo)
    .eq("active", true)
    .maybeSingle();
  if (!base) return null;

  const { data: cred } = await db
    .from("ai_base_credentials")
    .select("id")
    .eq("base_id", base.id)
    .eq("auth_type", "oauth2_user")
    .eq("provider", provider)
    .eq("active", true)
    .maybeSingle();
  if (!cred) return null;

  const { data: sec } = await db
    .from("ai_base_credential_secrets")
    .select("secret_enc")
    .eq("credential_id", cred.id)
    .maybeSingle();
  if (!sec?.secret_enc) return null;

  let cfg: ConfigDelegada;
  try {
    cfg = JSON.parse(decryptSecret(sec.secret_enc)) as ConfigDelegada;
  } catch {
    return null; // segredo ilegível: melhor "não configurado" que meio configurado
  }
  if (!cfg.client_id || !cfg.client_secret) return null;

  return { credentialId: cred.id, baseId: base.id, provider, cfg };
}

/**
 * A mesma credencial, agora pelo id — é o que o callback tem em mãos depois de
 * gastar o nonce. Não repete a resolução por `p_base`: o vínculo cliente↔
 * credencial já foi decidido no `start` e gravado no estado; refazer a busca no
 * callback abriria espaço para ela dar outro resultado.
 */
export async function credencialPorId(credentialId: string): Promise<CredencialDelegada | null> {
  const db = createAdminClient();
  const { data: cred } = await db
    .from("ai_base_credentials")
    .select("id, base_id, provider, active, auth_type")
    .eq("id", credentialId)
    .maybeSingle();
  if (!cred || !cred.active || cred.auth_type !== "oauth2_user" || !cred.base_id) return null;
  if (cred.provider !== "microsoft" && cred.provider !== "google") return null;

  const { data: sec } = await db
    .from("ai_base_credential_secrets")
    .select("secret_enc")
    .eq("credential_id", cred.id)
    .maybeSingle();
  if (!sec?.secret_enc) return null;
  try {
    const cfg = JSON.parse(decryptSecret(sec.secret_enc)) as ConfigDelegada;
    if (!cfg.client_id || !cfg.client_secret) return null;
    return { credentialId: cred.id, baseId: cred.base_id, provider: cred.provider, cfg };
  } catch {
    return null;
  }
}

/**
 * O `redirect_uri`, que precisa bater BYTE A BYTE com o registrado no provedor
 * — divergência devolve `AADSTS50011` e nenhuma pista melhor.
 *
 * Sai de `NEXT_PUBLIC_SITE_URL`, que já inclui o basePath em produção
 * (`https://www.natcorpbr.com.br/natcorp/ia`), e não da URL da requisição: o
 * app está atrás de nginx, e derivar do request traria o host interno.
 */
export function redirectUri(provider: ProviderConnect): string {
  const raiz = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  return `${raiz}/api/v1/connect/${provider}/callback`;
}

/** Cria o nonce do fluxo, amarrado à credencial e à pessoa. */
export async function abrirEstado(input: {
  credentialId: string;
  pUsuario: string;
  origin: string | null;
}): Promise<string> {
  const nonce = randomBytes(32).toString("base64url");
  const db = createAdminClient();
  const { error } = await db.from("oauth_states").insert({
    nonce,
    credential_id: input.credentialId,
    p_usuario: input.pUsuario,
    origin: input.origin,
  });
  if (error) throw new Error(`Falha ao abrir o consentimento: ${error.message}`);
  return nonce;
}

export type EstadoConsumido = { credentialId: string; pUsuario: string; origin: string | null };

/**
 * Gasta o nonce. Devolve `null` se não existe, já foi usado ou expirou.
 *
 * O `update ... is null` faz a marcação de uso ser ATÔMICA: dois callbacks
 * simultâneos com o mesmo `state` — um deles de um atacante que interceptou a
 * URL — só um vence, porque o segundo update não casa a condição e não devolve
 * linha. Ler-depois-gravar deixaria essa corrida aberta.
 */
export async function consumirEstado(nonce: string): Promise<EstadoConsumido | null> {
  if (!nonce) return null;
  const db = createAdminClient();
  const limite = new Date(Date.now() - TTL_MS).toISOString();
  const { data } = await db
    .from("oauth_states")
    .update({ used_at: new Date().toISOString() })
    .eq("nonce", nonce)
    .is("used_at", null)
    .gte("created_at", limite)
    .select("credential_id, p_usuario, origin")
    .maybeSingle();
  if (!data) return null;
  return { credentialId: data.credential_id, pUsuario: data.p_usuario, origin: data.origin };
}

/**
 * Grava a conexão e os tokens.
 *
 * `refresh_enc` só é sobrescrito quando o provedor mandou um novo: a Microsoft
 * rotaciona e invalida o anterior, mas o Google devolve `null` na renovação e
 * mantém o antigo válido. Gravar `null` por cima quebraria a conexão do Google
 * na renovação seguinte.
 */
export async function salvarConexao(input: {
  credentialId: string;
  baseId: string;
  provider: ProviderConnect;
  pUsuario: string;
  tokens: Tokens;
  email: string | null;
  nome: string | null;
}): Promise<void> {
  const db = createAdminClient();
  const agora = new Date().toISOString();

  const { data: conn, error } = await db
    .from("user_connections")
    .upsert(
      {
        credential_id: input.credentialId,
        base_id: input.baseId,
        provider: input.provider,
        p_usuario: input.pUsuario,
        account_email: input.email,
        account_name: input.nome,
        scopes: input.tokens.scopes,
        access_expires_at: new Date(input.tokens.expiresAt).toISOString(),
        revoked_at: null,
        updated_at: agora,
      },
      { onConflict: "credential_id,p_usuario", ignoreDuplicates: false },
    )
    .select("id")
    .single();
  if (error || !conn) throw new Error(`Falha ao gravar a conexão: ${error?.message}`);

  const patch: Record<string, string> = {
    connection_id: conn.id,
    access_enc: encryptSecret(input.tokens.accessToken),
    updated_at: agora,
  };
  if (input.tokens.refreshToken) patch.refresh_enc = encryptSecret(input.tokens.refreshToken);

  const { error: errTok } = await db
    .from("user_connection_tokens")
    .upsert(patch as never, { onConflict: "connection_id" });
  if (errTok) throw new Error(`Falha ao gravar o token: ${errTok.message}`);
}

export type ConexaoAtiva = {
  connectionId: string;
  refreshToken: string;
  accessToken: string | null;
  expiresAt: number | null;
};

/** A conexão ativa de uma pessoa numa credencial, com os tokens decifrados. */
export async function conexaoAtiva(
  credentialId: string,
  pUsuario: string,
): Promise<ConexaoAtiva | null> {
  const db = createAdminClient();
  const { data: conn } = await db
    .from("user_connections")
    .select("id, access_expires_at")
    .eq("credential_id", credentialId)
    .eq("p_usuario", pUsuario)
    .is("revoked_at", null)
    .maybeSingle();
  if (!conn) return null;

  const { data: tok } = await db
    .from("user_connection_tokens")
    .select("refresh_enc, access_enc")
    .eq("connection_id", conn.id)
    .maybeSingle();
  if (!tok?.refresh_enc) return null;

  const decifra = (v: string | null): string | null => {
    if (!v) return null;
    try {
      return decryptSecret(v);
    } catch {
      return null;
    }
  };
  const refresh = decifra(tok.refresh_enc);
  if (!refresh) return null;

  return {
    connectionId: conn.id,
    refreshToken: refresh,
    accessToken: decifra(tok.access_enc),
    expiresAt: conn.access_expires_at ? Date.parse(conn.access_expires_at) : null,
  };
}

/** Atualiza o access_token em cache depois de uma renovação. */
export async function atualizarTokens(connectionId: string, tokens: Tokens): Promise<void> {
  const db = createAdminClient();
  const patch: Record<string, string> = {
    access_enc: encryptSecret(tokens.accessToken),
    updated_at: new Date().toISOString(),
  };
  if (tokens.refreshToken) patch.refresh_enc = encryptSecret(tokens.refreshToken);
  await db.from("user_connection_tokens").update(patch as never).eq("connection_id", connectionId);
  await db
    .from("user_connections")
    .update({ access_expires_at: new Date(tokens.expiresAt).toISOString() })
    .eq("id", connectionId);
}
