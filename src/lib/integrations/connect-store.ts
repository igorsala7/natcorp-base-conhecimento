import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import type { ConfigDelegada, ProviderConnect, Tokens } from "./oauth-user";
import { redirectUri } from "./redirect-uri";

// Reexportado: as rotas de consentimento importam os dois daqui desde sempre.
export { redirectUri };

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
 * A credencial de conta pessoal que vale para uma base: a DELA, e na falta, a
 * marcada como global.
 *
 * A cascata existe porque a URL de callback do sistema é única
 * (`NEXT_PUBLIC_SITE_URL`), então só um registro no provedor pode funcionar —
 * cobrar uma credencial por cliente seria cobrar N apps que só poderiam
 * registrar a MESMA URL. O isolamento entre clientes não vive aqui: vive na
 * conexão, amarrada a (credencial, base, pessoa).
 *
 * Uma função só, usada pelo consentimento, pelo catálogo de ferramentas e pela
 * tela do widget. Foi exatamente a divergência entre esses três caminhos que
 * fez a conta "conectada" continuar aparecendo como não conectada.
 */
export async function idCredencialPessoal(
  baseId: string,
  provider: string,
): Promise<string | null> {
  const db = createAdminClient();
  const { data: propria } = await db
    .from("ai_base_credentials")
    .select("id")
    .eq("base_id", baseId)
    .eq("auth_type", "oauth2_user")
    .eq("provider", provider)
    .eq("active", true)
    .maybeSingle();
  if (propria) return propria.id;

  const { data: global } = await db
    .from("ai_base_credentials")
    .select("id")
    .eq("is_global", true)
    .eq("auth_type", "oauth2_user")
    .eq("provider", provider)
    .eq("active", true)
    .maybeSingle();
  return global?.id ?? null;
}

/**
 * A credencial delegada para um cliente, resolvida pelo `p_base` do token de
 * rastreio — nunca por algo que venha do navegador.
 *
 * `baseId` é sempre a base DO CLIENTE (resolvida pelo `p_base`), mesmo quando a
 * credencial usada é a global: é ela que amarra a conexão ao cliente certo. O
 * isolamento não depende mais de haver um app por cliente no provedor — a URL
 * de callback é única, então o app é um só — e sim de (credencial, base,
 * pessoa) na conexão.
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

  const credId = await idCredencialPessoal(base.id, provider);
  if (!credId) return null;
  const cred = { id: credId };

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

/** Cria o nonce do fluxo, amarrado à credencial e à pessoa. */
export async function abrirEstado(input: {
  credentialId: string;
  /** Chave da PESSOA (`chavePessoal`: base:empresa:matrícula). */
  pessoa: string;
  origin: string | null;
  /** Base do CLIENTE. Com credencial global ela não sai mais da credencial —
   *  e é ela que a conexão grava (ver a migration 20260812000000). */
  baseId: string;
  /** E-mail funcional do cadastro — `null` quando não se sabe (ver a migration
   *  20260811230000: desconhecido nunca vira bloqueio). */
  emailEsperado: string | null;
}): Promise<string> {
  const nonce = randomBytes(32).toString("base64url");
  const db = createAdminClient();
  const { error } = await db.from("oauth_states").insert({
    nonce,
    credential_id: input.credentialId,
    person_key: input.pessoa,
    origin: input.origin,
    base_id: input.baseId,
    expected_email: input.emailEsperado,
  });
  if (error) throw new Error(`Falha ao abrir o consentimento: ${error.message}`);
  return nonce;
}

export type EstadoConsumido = {
  credentialId: string;
  pessoa: string;
  origin: string | null;
  baseId: string | null;
  emailEsperado: string | null;
};

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
    .select("credential_id, person_key, origin, base_id, expected_email")
    .maybeSingle();
  if (!data) return null;
  return {
    credentialId: data.credential_id,
    pessoa: data.person_key,
    origin: data.origin,
    baseId: data.base_id,
    emailEsperado: data.expected_email,
  };
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
  /** Chave da PESSOA (`chavePessoal`: base:empresa:matrícula). */
  pessoa: string;
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
        person_key: input.pessoa,
        account_email: input.email,
        account_name: input.nome,
        scopes: input.tokens.scopes,
        access_expires_at: new Date(input.tokens.expiresAt).toISOString(),
        revoked_at: null,
        updated_at: agora,
      },
      // Mira a restrição única SIMPLES (migration 20260809140000). O índice
      // parcial original — `where revoked_at is null` — não podia ser alvo de
      // ON CONFLICT, e o consentimento morria na gravação depois de todo o
      // fluxo já ter dado certo.
      { onConflict: "credential_id,person_key", ignoreDuplicates: false },
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
  pessoa: string,
): Promise<ConexaoAtiva | null> {
  const db = createAdminClient();
  const { data: conn } = await db
    .from("user_connections")
    .select("id, access_expires_at")
    .eq("credential_id", credentialId)
    .eq("person_key", pessoa)
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

/**
 * Credenciais em que ESTA pessoa tem conexão ativa nesta base.
 *
 * Serve ao corte de disponibilidade: uma ferramenta que exige conta pessoal
 * não deve nem ser oferecida ao modelo enquanto a conta não estiver conectada.
 * Oferecer e falhar na execução ensina o agente a prometer o que não entrega —
 * e o usuário lê "não consegui agora" como defeito, não como "falta conectar".
 *
 * Uma consulta indexada por (credential_id, person_key); roda uma vez por turno.
 */
export async function credenciaisConectadas(
  baseId: string,
  pessoa: string,
): Promise<Set<string>> {
  const usuario = pessoa?.trim();
  if (!baseId || !usuario) return new Set();
  const db = createAdminClient();
  const { data } = await db
    .from("user_connections")
    .select("credential_id")
    .eq("base_id", baseId)
    .eq("person_key", usuario)
    .is("revoked_at", null);
  return new Set((data ?? []).map((r) => r.credential_id));
}

export type ContaDaPessoa = {
  credentialId: string;
  provider: string;
  conectada: boolean;
  /** E-mail da conta conectada, quando há uma. */
  email: string | null;
};

/**
 * O que ESTA base oferece de conta pessoal e o que ESTA pessoa já conectou.
 *
 * Uma linha por credencial `oauth2_user` cadastrada na base — inclusive as não
 * conectadas, que são justamente as que viram botão no widget. Sem isto, a
 * única forma de descobrir que dá para conectar era esbarrar no assunto no
 * chat e receber um "conecte sua conta" — e antes desta rodada nem isso.
 */
export async function contasDaPessoa(
  baseCode: string,
  pessoa: string,
): Promise<ContaDaPessoa[]> {
  const alvo = baseCode.trim().replace(/([\\%_])/g, "\\$1");
  const chave = pessoa?.trim();
  if (!alvo || !chave) return [];
  const db = createAdminClient();

  const { data: base } = await db
    .from("ai_bases")
    .select("id")
    .ilike("base_code", alvo)
    .eq("active", true)
    .maybeSingle();
  if (!base) return [];

  // As da base MAIS as globais (a mesma cascata de `idCredencialPessoal`), sem
  // repetir provedor: a da base ganha da global quando as duas existem, que é a
  // ordem em que a conexão vai ser feita.
  const { data: creds } = await db
    .from("ai_base_credentials")
    .select("id, provider, base_id, is_global")
    .eq("auth_type", "oauth2_user")
    .eq("active", true)
    .or(`base_id.eq.${base.id},is_global.is.true`);
  const porProvedor = new Map<string, { id: string; provider: string }>();
  for (const c of creds ?? []) {
    const p = c.provider ?? "";
    if (!p) continue;
    const jaTem = porProvedor.get(p);
    if (!jaTem || c.base_id === base.id) porProvedor.set(p, { id: c.id, provider: p });
  }
  const efetivas = [...porProvedor.values()];
  if (!efetivas.length) return [];

  const { data: conns } = await db
    .from("user_connections")
    .select("credential_id, account_email")
    .eq("person_key", chave)
    .in("credential_id", efetivas.map((c) => c.id))
    .is("revoked_at", null);
  const porCred = new Map((conns ?? []).map((c) => [c.credential_id, c.account_email]));

  return efetivas.map((c) => ({
    credentialId: c.id,
    provider: c.provider,
    conectada: porCred.has(c.id),
    email: porCred.get(c.id) ?? null,
  }));
}

/**
 * Desconecta a conta desta pessoa.
 *
 * Marca `revoked_at` e APAGA o token — deixar o refresh_token guardado numa
 * linha revogada seria manter a chave da caixa de e-mail de alguém que pediu
 * para desconectar. A linha fica, com a trilha de quando e de qual conta era.
 */
export async function revogarConexao(credentialId: string, pessoa: string): Promise<void> {
  const db = createAdminClient();
  const { data: conn } = await db
    .from("user_connections")
    .select("id")
    .eq("credential_id", credentialId)
    .eq("person_key", pessoa)
    .is("revoked_at", null)
    .maybeSingle();
  if (!conn) return;
  await db.from("user_connection_tokens").delete().eq("connection_id", conn.id);
  await db
    .from("user_connections")
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", conn.id);
}
