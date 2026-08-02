import type { NextRequest } from "next/server";
import { resolveWidgetKey, originAllowed, corsHeaders, clientIp, extractKey, rateLimitOk } from "@/lib/widget/auth";
import { loadBaseTool, loadCredentialSecret } from "@/lib/integrations/resolve";
import { getOAuthToken, invalidateOAuthToken } from "@/lib/integrations/oauth";
import { decodeTrackForSpace } from "@/lib/tracking/resolve";

/**
 * POST /api/v1/report-data — PONTE para o Interactive Report do APEX via ORDS.
 *
 * O widget NÃO fala com o ORDS (origem diferente + o client_secret não pode ir ao
 * browser). Este route, no servidor: valida a chave do widget → descobre a BASE do
 * `track` (p_base) → resolve o TOOL registrado (key `consulta_ir`) daquela base
 * para pegar base_url + path_template + credencial → OAuth2 (client_credentials) →
 * chama o endpoint ORDS server-to-server → devolve 100% das linhas do IR.
 *
 * NADA fixo: base e caminho vêm do CADASTRO (base + tool), distintos por base.
 * Cadastre na base uma tool com key `consulta_ir` e o path_template do módulo ORDS
 * (ex.: `chatbot/dados/v1/consulta_ir`).
 *
 * Contrato de resposta (o widget depende): { ok, colunas[], linhas[][], total }.
 */
export const runtime = "nodejs";

/** Key da tool (por base) que aponta o endpoint de consulta ao IR. */
const TOOL_KEY = "consulta_ir";

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });

  let payload: { app_id?: unknown; page_id?: unknown; session?: unknown; region?: unknown; appUser?: unknown; track?: unknown; key?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, erro: "JSON inválido." }, 400);
  }

  const key = await resolveWidgetKey(extractKey(req, payload.key));
  if (!key) return json({ ok: false, erro: "Chave inválida ou inativa." }, 401);
  if (!originAllowed(key.allowed_origins, origin)) return json({ ok: false, erro: "Origem não autorizada." }, 403);
  if (!(await rateLimitOk(key.id, clientIp(req), key.rate_limit))) return json({ ok: false, erro: "Muitas requisições. Tente em instantes." }, 429);

  const app_id = Number(payload.app_id);
  const page_id = Number(payload.page_id);
  // session como TEXTO: ids do APEX podem exceder a precisão de Number (JS e JSON).
  const session = String(payload.session ?? "").trim();
  const region = String(payload.region ?? "").trim();
  if (!Number.isFinite(app_id) || !Number.isFinite(page_id) || !session) {
    return json({ ok: false, erro: "Parâmetros obrigatórios: app_id, page_id, session." }, 400);
  }

  // BASE do token de rastreio (p_base) — mesma resolução do chat. Nada fixo.
  const track = await decodeTrackForSpace(key.space_id, payload.track);
  if (!track.p_base) return json({ ok: false, erro: "Sem base no rastreio (p_base) — não sei qual base consultar." }, 400);

  // TOOL `consulta_ir` da base → base_url + path_template + credencial (cadastro).
  const tool = await loadBaseTool(track.p_base, TOOL_KEY);
  if (!tool?.baseUrl || !tool.pathTemplate) {
    return json({ ok: false, erro: `Cadastre na base "${track.p_base}" uma tool com key "${TOOL_KEY}" e o caminho do módulo ORDS.` }, 503);
  }
  if (!tool.credentialId) return json({ ok: false, erro: "Tool/base sem credencial configurada." }, 503);
  const cred = await loadCredentialSecret(tool.credentialId);
  if (!cred || cred.auth_type !== "oauth2") return json({ ok: false, erro: "Credencial OAuth2 ausente." }, 503);

  // Identidade para o create_session no ORDS: APP_USER (lido no navegador) + os
  // APPLICATION ITEMS que o relatório usa no VPD/filtro, montados a partir do TOKEN
  // de rastreio (confiável — não do navegador). Só entram os que vieram no track.
  const appUser = String(payload.appUser ?? "").trim();
  const items: Record<string, string> = {};
  const addItem = (nome: string, v: string | undefined) => { if (v != null && String(v).trim() !== "") items[nome] = String(v); };
  addItem("P_USUARIO", track.p_usuario);
  addItem("P_EMPRESA_USER", track.p_empresa);
  addItem("P_MATRICULA_USER", track.p_matricula);
  addItem("P_PERFIL", track.p_perfil);
  addItem("P_BASE", track.p_base);
  addItem("P_PAINEL", track.p_portal);

  const url = tool.baseUrl.replace(/\/+$/, "") + "/" + tool.pathTemplate.replace(/^\/+/, "");
  const body = JSON.stringify({ app_id, page_id, session, region, username: appUser, items: JSON.stringify(items) });
  // Diagnóstico: confirma a URL/token/identidade que o servidor usa.
  console.log(`[report-data] base=${track.p_base} alvo ORDS: ${url} | user=${appUser || "-"} | items=${Object.keys(items).join(",")}`);
  const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
  // NÃO seguir redirect: se o ORDS redirecionar (sessão/login), queremos VER o 3xx,
  // não a página do APEX. Accept: application/json para não cair em roteamento HTML.
  const chamar = (token: string) =>
    fetch(url, {
      method: tool.method || "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
      body,
    });

  // Passo 1: token OAuth (isolado — falha aqui é diferente de falha no ORDS).
  let token: string;
  try {
    token = await getOAuthToken(cred.id, cred.secret);
  } catch (e) {
    console.error("[report-data] falha no token OAuth:", e);
    return json({ ok: false, erro: `Falha no token OAuth: ${msg(e)}` }, 502);
  }

  // Passo 2: chamada ao ORDS (com 1 renovação de token no 401).
  try {
    let resp = await chamar(token);
    if (resp.status === 401) {
      invalidateOAuthToken(cred.id);
      token = await getOAuthToken(cred.id, cred.secret);
      resp = await chamar(token);
    }
    const ctype = resp.headers.get("content-type") ?? "";
    // Redirect (3xx): quase sempre auth (token não aceito) ou módulo inexistente que
    // cai no login/página do APEX. Mostra o destino em vez de seguir até o HTML.
    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get("location");
      console.error(`[report-data] ORDS redirecionou ${resp.status} → ${loc} (auth do token OU módulo inexistente)`);
      return json({ ok: false, erro: `ORDS redirecionou (${resp.status}) para ${loc ?? "?"} — token não aceito ou módulo não publicado.` }, 502);
    }
    const raw = await resp.text();
    console.log(`[report-data] ORDS resp status=${resp.status} content-type=${ctype} len=${raw.length}`);
    // DEBUG (temporário): corpo pequeno (0/poucas linhas) → loga tudo, inclui _debug
    // (usuário, itens setados, SQL do IR, binds) para diagnosticar filtro que zera.
    if (raw.length < 60000) console.log(`[report-data] ORDS body: ${raw}`);
    if (!resp.ok) {
      console.error(`[report-data] ORDS HTTP ${resp.status} em ${url} — body: ${raw.slice(0, 500)}`);
      return json({ ok: false, erro: `ORDS HTTP ${resp.status}: ${raw.slice(0, 200)}` }, 502);
    }
    let data: { ok?: boolean; colunas?: unknown; linhas?: unknown; total?: unknown; erro?: unknown; detalhe?: unknown } | null = null;
    try {
      data = JSON.parse(raw);
    } catch {
      // O corpo pode vir "sujo": {"error":...} do ORDS + headers vazados + o nosso
      // JSON (apex_json com quebras de linha). Extrai o objeto que contém "ok".
      const m = raw.match(/\{\s*"ok"[\s\S]*\}/);
      if (m) { try { data = JSON.parse(m[0]); } catch { data = null; } }
    }
    // Erro estruturado da função (ORA-...): repassa com o backtrace para diagnóstico.
    if (data && data.ok === false) {
      const det = typeof data.detalhe === "string" ? ` [${data.detalhe}]` : "";
      console.error(`[report-data] função retornou erro: ${data.erro}${det}`);
      return json({ ok: false, erro: `${typeof data.erro === "string" ? data.erro : "Erro na função"}${det}` }, 502);
    }
    if (!data || data.ok !== true || !Array.isArray(data.colunas) || !Array.isArray(data.linhas)) {
      const dica = /text\/html/i.test(ctype)
        ? " (veio HTML do APEX — o POST provavelmente NÃO atingiu o módulo REST: caminho/método divergente do Postman, ou módulo não publicado)"
        : "";
      console.error(`[report-data] resposta inválida (content-type=${ctype})${dica} — body: ${raw.slice(0, 500)}`);
      const erro = data && typeof data.erro === "string" ? data.erro : `Resposta inesperada do ORDS${dica}: ${raw.slice(0, 200)}`;
      return json({ ok: false, erro }, 502);
    }
    const total = typeof data.total === "number" ? data.total : (data.linhas as unknown[]).length;
    return json({ ok: true, colunas: data.colunas, linhas: data.linhas, total }, 200);
  } catch (e) {
    console.error("[report-data] exceção ao chamar o ORDS:", e);
    return json({ ok: false, erro: `Falha ao consultar o ORDS: ${msg(e)}` }, 502);
  }
}
