/**
 * Testa TODOS os endpoints (tools) GET de uma base contra a API real, usando os valores
 * de `fixture.json`. Reporta só o STATUS (nunca os dados). NÃO executa escritas
 * (POST/DELETE) — efeito colateral. Reutilizável: edite o fixture e rode de novo.
 *
 *   scripts/endpoint-test/run.sh
 *   (ou: NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/endpoint-test/run.ts)
 */
const _log = console.log;
console.log = (...a: unknown[]) => {
  const s = String(a[0] ?? "");
  if (/^\[tool-curl\]|^curl -X|^\s+-H /.test(s)) return; // silencia o log de cURL do executor
  _log(...a);
};

import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { parseDbConfig } from "../../src/lib/jobs/db-config";
import { decryptSecret } from "../../src/lib/crypto/secrets";
import { executeTool } from "../../src/lib/integrations/executor";
import { resolveIdentity } from "../../src/lib/integrations/identity-resolver";

type Fix = {
  base: string;
  identity: Record<string, string>;
  params: Record<string, string>;
  requisicoes: Record<string, string>;
  /** Override por ENDPOINT: overrides[toolKey][nomeParam] = valor (ex.: p_situacao A/D/T). */
  overrides?: Record<string, Record<string, string>>;
};

// Caminho relativo à RAIZ do repo — o run.sh faz `cd` para a raiz antes de rodar.
const fix = JSON.parse(readFileSync(join(process.cwd(), "scripts/endpoint-test/fixture.json"), "utf8")) as Fix;
const CONC = 6;
const TIMEOUT = 30_000;

/** Valor de um parâmetro origem=modelo, a partir do fixture (por nome + chave da tool). */
function valorParam(nome: string, toolKey: string): string | undefined {
  // Override por ENDPOINT tem prioridade (fixture.overrides[toolKey][nomeParam]).
  const ov = (fix.overrides || {})[toolKey];
  if (ov && ov[nome] != null && String(ov[nome]) !== "") return String(ov[nome]);
  const n = String(nome || "").toLowerCase().replace(/^p_/, "");
  const P = fix.params || {};
  const R = fix.requisicoes || {};
  // Nº de requisição: casa o TIPO pela chave da tool (requisicoes_req_desligamento → desligamento).
  // Ancorado no início: só o PRÓPRIO nº (requisicao/id_req/num_req/protocolo), nunca
  // "data_requisicao_ini" (data) nem "sit_requisicao" (situação).
  if (/^(requisic|id_?req|num_?req|nr_?req|cod_?req|protocolo)/.test(n)) {
    const tk = toolKey.toLowerCase();
    for (const [tipo, val] of Object.entries(R)) if (val && tk.includes(tipo)) return String(val);
  }
  const mapa: [RegExp, string][] = [
    [/^cod_?candidat|candidat/, "cod_candidato"],
    [/cnpj/, "cnpj"],
    [/matric/, "matricula"],
    [/cpf/, "cpf"],
    [/(^|_)emp$|empresa/, "empresa"],
    [/filial/, "filial"],
    [/centro|(^|_)cc(_|$)/, "centro_custo"],
    [/unidade/, "unidade"],
    [/sindicat/, "sindicato"],
    [/situac/, "situacao"],
    [/vinculo/, "vinculo"],
    [/data_?fim|data_?final|dt_?fim|data_?ate|(^|_)ate(_|$)/, "data_fim"],
    [/data_?ini|data_?inicial|dt_?ini|data_?de|(^|_)de(_|$)/, "data_ini"],
    [/data_?ref|competenc|mes_?ref|(^|_)mes(_|$)|referenc/, "data_ref"],
    [/(^|_)data(_|$)/, "data_ini"], // 'data' genérico → data inicial (depois dos específicos)
    [/ano/, "ano"],
    [/cep/, "cep"],
    [/agrupa/, "agrupamento"],
    [/tipo_?lista|lista/, "tipo_lista"],
    [/fato/, "fato"],
    [/e_?mail/, "email"],
  ];
  for (const [rx, key] of mapa) if (rx.test(n)) { const v = P[key]; if (v != null && String(v) !== "") return String(v); }
  return undefined;
}

const withTimeout = <T>(p: Promise<T>): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), TIMEOUT))]);

(async () => {
  const c = new pg.Client(parseDbConfig());
  await c.connect();
  const base = (await c.query(`SELECT base_url, credential_id FROM ai_bases WHERE base_code=$1`, [fix.base])).rows[0];
  if (!base) throw new Error(`base "${fix.base}" não encontrada`);
  const cr = (await c.query(
    `SELECT c.id, c.auth_type, s.secret_enc FROM ai_base_credentials c
     LEFT JOIN ai_base_credential_secrets s ON s.credential_id=c.id WHERE c.id=$1`,
    [base.credential_id],
  )).rows[0];
  const secret = cr.secret_enc ? JSON.parse(decryptSecret(cr.secret_enc)) : {};
  const cred = { id: cr.id, auth_type: cr.auth_type, secret } as Parameters<typeof executeTool>[0]["credential"];

  let identity = { ...fix.identity } as Record<string, string>;
  const en = await resolveIdentity({ baseUrl: base.base_url, credential: cred!, identity });
  identity = en.identity as Record<string, string>;

  const rows = (await c.query(
    `SELECT key,name,method,path_template,auth_type,params,body_mode,guard,cache_ttl,cache_scope,loop,panel_scope,exclude_self
     FROM ai_tools WHERE active AND upper(coalesce(method,'GET'))='GET' ORDER BY key`,
  )).rows;

  type Res = { key: string; cat: string; status?: number; msg?: string; path?: string };
  const results: Res[] = [];
  const testOne = async (r: Record<string, unknown>) => {
    const params = Array.isArray(r.params) ? (r.params as { origem?: string; nome: string }[]) : [];
    const modelArgs: Record<string, unknown> = {};
    for (const p of params) if (p.origem === "modelo") { const v = valorParam(p.nome, r.key as string); if (v !== undefined) modelArgs[p.nome] = v; }
    const tool = { ...r, params } as Parameters<typeof executeTool>[0]["tool"];
    try {
      const res = await withTimeout(executeTool({ tool, baseUrl: base.base_url, credential: cred, modelArgs, identity }));
      let cat = "OK";
      if (!res.ok) { const s = res.status; cat = s === 404 ? "PATH_404" : s === 401 || s === 403 ? "AUTH" : s >= 500 ? "SERVER_5xx" : `HTTP_${s}`; }
      results.push({ key: r.key as string, cat, status: res.status, path: r.path_template as string });
    } catch (e) {
      const m = String((e as Error).message || "");
      results.push({ key: r.key as string, cat: /ausente/.test(m) ? "NEEDS_PARAM" : m === "TIMEOUT" ? "TIMEOUT" : "ERROR", msg: m.slice(0, 80), path: r.path_template as string });
    }
  };
  for (let i = 0; i < rows.length; i += CONC) await Promise.all(rows.slice(i, i + CONC).map(testOne));

  const by = (cat: string) => results.filter((r) => r.cat === cat);
  const prob = results.filter((r) => ["PATH_404", "AUTH", "SERVER_5xx", "TIMEOUT", "ERROR"].includes(r.cat) || /^HTTP_4/.test(r.cat));
  _log(`\nbase=${fix.base} · login=${en.ok ? "ok" : "FALHOU(" + en.motivo + ")"} · perfil=${identity.perfil || "—"} · cpf=${identity.cpf ? "s" : "n"} · cod_cand=${identity.cod_candidato ? "s" : "n"}`);
  _log(`=== ${rows.length} GETs · OK:${by("OK").length} · precisa-param:${by("NEEDS_PARAM").length} · PROBLEMAS:${prob.length} ===\n`);
  if (prob.length) { _log("PROBLEMAS:"); for (const p of prob) _log(`  ${p.key} -> ${p.cat}${p.status != null ? ` (${p.status})` : ""}${p.msg ? ` - ${p.msg}` : ""}  [${String(p.path).slice(0, 48)}]`); }
  if (by("NEEDS_PARAM").length) { _log("\nprecisa-parâmetro (adicione o valor em fixture.json):"); for (const p of by("NEEDS_PARAM")) _log(`  ${p.key}: ${String(p.msg).replace("Parâmetro obrigatório ausente:", "falta")}`); }
  await c.end();
})().catch((e) => { console.error("ERRO:", (e as Error).message); process.exit(1); });
