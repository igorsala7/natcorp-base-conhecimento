import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { authHeaders } from "./executor";
import { loadCredentialSecret } from "./resolve";
import { parseModulosPayload, dedupModulos, type ModuloRow } from "./module-parse";

/**
 * PERMISSÕES DO USUÁRIO LOGADO — o que ele já pode ver no APEX.
 *
 * Endpoint: GET {base_url}/permissoes/v1/modulos?usuario={login}&painel={PC|PG|PO}
 * Devolve painel/modulo/sub_modulo de `apex_programas` cruzado com
 * `apex_programas_acesso`, ou seja: exatamente as telas que aquela pessoa abre.
 *
 * Difere de `module-sync.ts`, que busca a taxonomia INTEIRA da base
 * (`/chatbot/modulos/v1/consulta`) para alimentar o seletor da tela de tools.
 * Aqui é por PESSOA, e o resultado decide quais ferramentas entram no turno.
 *
 * ── Falha de rede NÃO é ausência de permissão ──────────────────────────
 *
 * Se o ORDS estiver fora, `permissoesDoUsuario` devolve `null` — e quem chama
 * trata nulo como "não sei", seguindo com a cerca que já existia. Devolver uma
 * lista vazia faria o chat perder todas as ferramentas de dados no minuto em
 * que a rede piscasse, e o sintoma ("a IA diz que não tem acesso aos meus
 * dados") é indistinguível de um defeito de permissão. É a mesma armadilha que
 * o CLAUDE.md nomeia: somar imensurável ao denominador produz número que parece
 * completo e não é.
 */

const OK_TTL_MS = 5 * 60_000;
const ERR_TTL_MS = 30_000;
const TIMEOUT_MS = 8_000;
const MAX_PAGES = 200;

export type PermissoesUsuario = {
  modulos: ModuloRow[];
  /** Nomes de módulo (normalizados) que o usuário tem — busca O(1) no cruzamento. */
  chaves: Set<string>;
};

type Entrada = { valor: PermissoesUsuario | null; expira: number };
const cache = new Map<string, Entrada>();

function chaveCache(base: string, usuario: string, painel: string): string {
  return `${base.toLowerCase()}|${usuario.toLowerCase()}|${painel.toUpperCase()}`;
}

async function buscarPagina(
  baseUrl: string,
  auth: Record<string, string>,
  usuario: string,
  painel: string,
  offset: number,
): Promise<{ rows: ModuloRow[]; hasMore: boolean; limit: number } | null> {
  const url = new URL(`${baseUrl.replace(/\/+$/, "")}/permissoes/v1/modulos`);
  url.searchParams.set("usuario", usuario);
  url.searchParams.set("painel", painel);
  if (offset) url.searchParams.set("offset", String(offset));

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json", ...auth },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { hasMore?: boolean; limit?: number };
    return {
      rows: parseModulosPayload(payload),
      hasMore: payload?.hasMore === true,
      limit: Number(payload?.limit) || 25,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Módulos/submódulos do usuário naquele painel.
 *
 * `null` = não foi possível apurar (base sem URL, credencial ruim, ORDS fora).
 * Lista vazia = apurado, e a pessoa não tem nenhum módulo — coisas diferentes.
 */
export async function permissoesDoUsuario(
  baseCode: string,
  usuario: string,
  painel: string,
): Promise<PermissoesUsuario | null> {
  if (!baseCode || !usuario || !painel) return null;

  const k = chaveCache(baseCode, usuario, painel);
  const agora = Date.now();
  const hit = cache.get(k);
  if (hit && hit.expira > agora) return hit.valor;

  const db = createAdminClient();
  const { data: base } = await db
    .from("ai_bases")
    .select("base_code, base_url, credential_id")
    .ilike("base_code", baseCode.trim().replace(/([\\%_])/g, "\\$1"))
    .maybeSingle();

  if (!base?.base_url) {
    cache.set(k, { valor: null, expira: agora + ERR_TTL_MS });
    return null;
  }

  const cred = base.credential_id ? await loadCredentialSecret(base.credential_id) : null;
  const auth = await authHeaders(cred, fetch);

  const rows: ModuloRow[] = [];
  let offset = 0;
  let alguemRespondeu = false;

  for (let p = 0; p < MAX_PAGES; p++) {
    const pagina = await buscarPagina(base.base_url, auth, usuario, painel, offset);
    if (!pagina) break;
    alguemRespondeu = true;
    rows.push(...pagina.rows);
    if (!pagina.hasMore) break;
    offset += pagina.limit;
  }

  if (!alguemRespondeu) {
    cache.set(k, { valor: null, expira: agora + ERR_TTL_MS });
    return null;
  }

  const modulos = dedupModulos(rows);
  const valor: PermissoesUsuario = {
    modulos,
    chaves: new Set(modulos.map((m) => m.modulo.trim().toLowerCase())),
  };
  cache.set(k, { valor, expira: agora + OK_TTL_MS });
  return valor;
}

/**
 * Vocabulário de módulos que a base conhece, de `ai_modules` (cache do sync).
 *
 * Serve para separar "o usuário não tem esse módulo" de "esse módulo não existe
 * no ERP" — a distinção que evita derrubar as 37 ferramentas cujos nomes de
 * módulo nunca aparecem em `apex_programas`.
 */
export async function taxonomiaDaBase(baseCode: string): Promise<Set<string>> {
  const db = createAdminClient();
  const { data } = await db
    .from("ai_modules")
    .select("modulo")
    .ilike("base_code", baseCode.trim().replace(/([\\%_])/g, "\\$1"))
    .range(0, 4999);

  return new Set((data ?? []).map((r) => String(r.modulo).trim().toLowerCase()));
}

/** Só para os testes e para a tela de acessos forçarem releitura. */
export function limparCachePermissoes(): void {
  cache.clear();
}
