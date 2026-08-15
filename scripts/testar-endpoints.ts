/**
 * Testa os endpoints ATIVOS de cada base com dados REAIS de um colaborador.
 *
 * Primeiro busca o cadastro da pessoa informada e monta um dicionário de valores
 * (filial, centro de custo, cargo, unidade, admissão, CPF…). Depois chama cada
 * ferramenta preenchendo os parâmetros que casam com esse dicionário — que é
 * como o agente faz, e por isso testa o que de fato acontece em produção.
 *
 * ── SÓ LEITURA ──────────────────────────────────────────────────────────────
 * Nada além de GET é executado. Entre as ferramentas há escritas reais
 * (`ferias_criar`, `ferias_aprovar`, `atualizar_email`), e um lote dessas em
 * cinco ERPs de produção não é teste, é incidente. As de escrita entram no
 * relatório como "não testada (escrita)".
 *
 * Rodar: npm run testar:endpoints
 */
import ws from "ws";
if (!globalThis.WebSocket) { (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws; }
import { loadBaseContext, loadCredentialSecret, type BaseToolContext } from "../src/lib/integrations/resolve";
import { executeTool, buildHttpRequest, authHeaders } from "../src/lib/integrations/executor";
import { resolveParams } from "../src/lib/integrations/params";
import { writeFileSync } from "node:fs";
import type { RuntimeCredential } from "../src/lib/integrations/executor";

type Alvo = { base: string; usuario: string; empresa: string; matricula: string };

const ALVOS: Alvo[] = [
  { base: "incor", usuario: "antonio.hernandes", empresa: "600", matricula: "47265" },
  { base: "redeflex", usuario: "", empresa: "300", matricula: "7036" },
  { base: "leadec", usuario: "BATTAGR", empresa: "4", matricula: "1367" },
  { base: "saude", usuario: "darcio.freitas", empresa: "3", matricula: "57149" },
  { base: "stefanini", usuario: "jineto", empresa: "1", matricula: "57292" },
];

/** Nome do parâmetro → chave do cadastro. Só o que dá para preencher com segurança. */
const DE_PARA: { rx: RegExp; campos: string[] }[] = [
  { rx: /^p?_?empresa$|^cod_empresa$/i, campos: ["cod_empresa"] },
  { rx: /^p?_?matricula$/i, campos: ["matricula"] },
  { rx: /^p?_?filial$/i, campos: ["filial"] },
  { rx: /ccusto/i, campos: ["cod_ccusto"] },
  { rx: /unidade/i, campos: ["unidade"] },
  { rx: /local_trab|local$/i, campos: ["local_trab"] },
  { rx: /^p?_?cargo$/i, campos: ["cargo"] },
  { rx: /^p?_?funcao$/i, campos: ["funcao"] },
  { rx: /situacao/i, campos: ["situacao"] },
  { rx: /vinculo/i, campos: ["vinculo"] },
  { rx: /candidato/i, campos: ["cod_candidato"] },
  { rx: /cpf/i, campos: ["cpf_func", "cpf"] },
  { rx: /sindicato/i, campos: ["num_sind_cat", "num_sind_diss"] },
  { rx: /atividade/i, campos: ["cod_atividade"] },
];

type Resultado = {
  base: string; tool: string; status: number | string; ok: boolean;
  detalhe?: string;
  /** Vazio conta como problema: endpoint que responde 200 sem dado não serve ao agente. */
  vazio?: boolean;
  curl?: string;
  corpo?: string;
};

/**
 * cURL REAL, com o token. O `curlDeChamada` do motor redige os segredos — certo
 * para log, inútil para reproduzir contra o ORDS. Aqui o pedido é reproduzir.
 */
async function curlReal(bt: BaseToolContext, args: Record<string, string>, ident: never, cred: RuntimeCredential | null): Promise<string> {
  try {
    const buckets = resolveParams(bt.tool.params, args, ident, cred?.secret);
    const req = buildHttpRequest(bt.tool, bt.baseUrl!, buckets);
    const auth = await authHeaders(cred, fetch).catch(() => ({}) as Record<string, string>);
    const hs = { ...req.headers, ...auth };
    const linhas = [`curl -X ${req.method} '${req.url}'`];
    for (const [k, v] of Object.entries(hs)) linhas.push(`  -H '${k}: ${v}'`);
    if (req.body) linhas.push(`  --data '${req.body}'`);
    return linhas.join(" \\\n");
  } catch (e) {
    return `(não foi possível montar o cURL: ${(e as Error).message})`;
  }
}

const HOJE = "2026-08-15";

/**
 * O ORDS devolve o erro dentro de uma página HTML cuja folha de estilo ocupa os
 * primeiros 2 KB. Cortar em 1.200 caracteres entregava só o CSS. Aqui fica o
 * texto: <h1>, <p> e o <pre> do stack do Oracle, que é onde está o motivo.
 */
function mensagemDoErro(bruto: string): string {
  if (!/<html/i.test(bruto)) return bruto.slice(0, 1200);
  const partes: string[] = [];
  for (const m of bruto.matchAll(/<(h1|h3|p|pre|li)[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const t = (m[2] ?? "").replace(/<[^>]+>/g, " ").replace(/&#(\d+);/g, (_, c) => String.fromCharCode(+c))
      .replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/\s+/g, " ").trim();
    if (t && !partes.includes(t)) partes.push(t);
  }
  return partes.join("\n").slice(0, 1500) || bruto.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 800);
}

function valorPara(nome: string, cad: Record<string, unknown>, alvo: Alvo, tipo: string): string | undefined {
  for (const { rx, campos } of DE_PARA) {
    if (!rx.test(nome)) continue;
    for (const c of campos) {
      const v = cad[c];
      if (v != null && String(v).trim() !== "") return String(v);
    }
  }
  // Sem o cadastro: ao menos empresa e matrícula, que vieram do Igor.
  if (/^p?_?empresa$/i.test(nome)) return alvo.empresa;
  if (/^p?_?matricula$/i.test(nome)) return alvo.matricula;
  // Períodos: sem eles muita consulta devolve vazio e o teste vira falso negativo.
  if (tipo === "date" || /data|dt_|periodo|mes|competencia|ano/i.test(nome)) {
    if (/ini|inicio|de$|from|_de/i.test(nome)) return "1990-01-01";
    if (/fim|final|ate|to$|_ate/i.test(nome)) return HOJE;
    return HOJE;
  }
  return undefined;
}

async function cadastroDe(ctx: Awaited<ReturnType<typeof loadBaseContext>>, alvo: Alvo, ident: never) {
  for (const key of ["informacoes_pessoais_funcionais_resumido", "informacoes_pessoais_funcionais"]) {
    const bt = ctx?.tools.find((t) => t.tool.key === key);
    if (!bt?.baseUrl) continue;
    const cred = bt.credentialId ? await loadCredentialSecret(bt.credentialId) : null;
    try {
      const r = await executeTool({
        tool: bt.tool, baseUrl: bt.baseUrl, credential: cred,
        // Mesma montagem da varredura: sem a janela larga de datas o ORDS
        // filtra por um período curto e devolve zero — foi o que escondeu o
        // cadastro nas cinco bases na rodada anterior.
        modelArgs: (() => {
          const a: Record<string, string> = {};
          for (const pr of bt.tool.params) {
            if (pr.origem !== "modelo" && pr.origem !== "pessoa") continue;
            const v = valorPara(pr.nome, {}, alvo, pr.tipo);
            if (v !== undefined) a[pr.nome] = v;
          }
          return { ...a, p_empresa: alvo.empresa, p_matricula: alvo.matricula };
        })(),
        identity: ident, timeoutMs: 25_000,
      });
      const it = (r.data as { items?: Record<string, unknown>[] })?.items ?? [];
      const achou = it.find((x) => String(x.matricula) === alvo.matricula) ?? it[0];
      if (achou) return { cad: achou, via: key };
    } catch { /* tenta a próxima */ }
  }
  return { cad: null as Record<string, unknown> | null, via: null };
}

async function main() {
  // `npm run testar:endpoints -- incor` limita a rodada a uma base.
  const filtro = process.argv.slice(2).map((x) => x.toLowerCase()).filter((x) => !x.startsWith("-"));
  const alvos = filtro.length ? ALVOS.filter((a) => filtro.includes(a.base)) : ALVOS;
  const linhas: Resultado[] = [];
  for (const alvo of alvos) {
    const ctx = await loadBaseContext(alvo.base);
    if (!ctx) { console.log(`\n### ${alvo.base.toUpperCase()} — base não encontrada`); continue; }
    const ident = {
      usuario: alvo.usuario || alvo.matricula, cod_empresa: alvo.empresa, matricula: alvo.matricula,
      perfil: "MASTER", portal: "PO", base: alvo.base.toUpperCase(),
    } as never;

    const { cad, via } = await cadastroDe(ctx, alvo, ident);
    console.log(`\n### ${alvo.base.toUpperCase()}  empresa=${alvo.empresa} matricula=${alvo.matricula}`);
    if (!cad) {
      console.log("   ⚠ NÃO consegui ler o cadastro — os testes seguem só com empresa/matrícula.");
    } else {
      console.log(`   cadastro via ${via}: ${cad.nome ?? "?"} · filial ${cad.filial ?? "-"} · ccusto ${cad.cod_ccusto ?? "-"} · cargo ${cad.nome_cargo ?? cad.cargo ?? "-"} · ${cad.desc_situacao ?? cad.situacao ?? "-"}`);
    }

    const ativas = (ctx.tools as BaseToolContext[])
      .filter((t) => t.tool && t.baseUrl)
      .sort((a, b) => a.tool.key.localeCompare(b.tool.key));

    for (const bt of ativas) {
      const metodo = String(bt.tool.method ?? "GET").toUpperCase();
      if (metodo !== "GET") { linhas.push({ base: alvo.base, tool: bt.tool.key, status: "—", ok: true, detalhe: "não testada (escrita)" }); continue; }
      if (bt.tool.identity_mode === "user") { linhas.push({ base: alvo.base, tool: bt.tool.key, status: "—", ok: true, detalhe: "não testada (conta pessoal)" }); continue; }

      const args: Record<string, string> = {};
      const faltando: string[] = [];
      for (const p of bt.tool.params) {
        if (p.origem !== "modelo" && p.origem !== "pessoa") continue;
        const v = valorPara(p.nome, cad ?? {}, alvo, p.tipo);
        if (v !== undefined) args[p.nome] = v;
        else if (p.obrigatorio) faltando.push(p.nome);
      }
      if (faltando.length) {
        // Preencher um obrigatório com lixo devolve 0 registros e vira falso negativo.
        linhas.push({ base: alvo.base, tool: bt.tool.key, status: "—", ok: true, detalhe: `não testada (falta ${faltando.join(", ")})` });
        continue;
      }
      let cred: RuntimeCredential | null = null;
      try { cred = bt.credentialId ? await loadCredentialSecret(bt.credentialId) : null; } catch { /* segue */ }
      try {
        const r = await executeTool({ tool: bt.tool, baseUrl: bt.baseUrl!, credential: cred, modelArgs: args, identity: ident, timeoutMs: 25_000 });
        const d = r.data as { items?: unknown[] } | string | undefined;
        const n = Array.isArray((d as { items?: unknown[] })?.items) ? (d as { items: unknown[] }).items.length : null;
        const vazio = r.ok && (n === 0 || d == null || (typeof d === "string" && !d.trim()));
        const precisaDetalhe = !r.ok || vazio;
        linhas.push({
          base: alvo.base, tool: bt.tool.key, status: r.status, ok: r.ok, vazio,
          detalhe: r.ok ? (n === null ? "ok" : `${n} registro(s)`) : "erro",
          curl: precisaDetalhe ? await curlReal(bt, args, ident, cred) : undefined,
          corpo: precisaDetalhe ? mensagemDoErro(typeof d === "string" ? d : JSON.stringify(d)) : undefined,
        });
      } catch (e) {
        linhas.push({
          base: alvo.base, tool: bt.tool.key, status: "exceção", ok: false,
          detalhe: (e as Error).message.slice(0, 200),
          curl: await curlReal(bt, args, ident, cred),
        });
      }
    }
    const daBase = linhas.filter((l) => l.base === alvo.base);
    const testadas = daBase.filter((l) => l.status !== "—");
    console.log(`   ${testadas.filter((l) => l.ok).length}/${testadas.length} ok · ${daBase.length - testadas.length} não testadas`);
  }

  // RELATÓRIO DETALHADO em arquivo: o cURL leva o token, e token não deve rolar
  // no terminal nem ficar em histórico de sessão.
  const doc: string[] = ["# Endpoints com erro ou retorno vazio", "", "> ⚠ Este arquivo contém TOKENS VIVOS. Apague depois de usar.", ""];
  for (const alvo of alvos) {
    const rs = linhas.filter((l) => l.base === alvo.base && (!l.ok || l.vazio));
    const test = linhas.filter((l) => l.base === alvo.base && l.status !== "—");
    doc.push(`\n## ${alvo.base.toUpperCase()} — empresa ${alvo.empresa}, matrícula ${alvo.matricula}`);
    doc.push(`${test.filter((l) => l.ok && !l.vazio).length} ok · ${test.filter((l) => !l.ok).length} com erro · ${test.filter((l) => l.vazio).length} vazios\n`);
    for (const r of rs) {
      doc.push(`### ${r.tool} — ${r.ok ? "RETORNO VAZIO" : `ERRO HTTP ${r.status}`}`);
      if (r.corpo) doc.push("", "**Resposta:**", "```", r.corpo, "```");
      if (r.detalhe && r.detalhe !== "erro") doc.push("", `**Detalhe:** ${r.detalhe}`);
      if (r.curl) doc.push("", "**cURL:**", "```bash", r.curl, "```");
      doc.push("");
    }
  }
  writeFileSync("/tmp/endpoints-detalhado.md", doc.join("\n"));
  console.log("\n📄 Relatório detalhado (com cURL e token): /tmp/endpoints-detalhado.md");

  console.log("\n\n═══════════ O QUE NÃO ESTÁ FUNCIONANDO ═══════════");
  const ruins = linhas.filter((l) => !l.ok);
  if (!ruins.length) console.log("nada — todos os endpoints testados responderam");
  const porBase = new Map<string, Resultado[]>();
  for (const r of ruins) porBase.set(r.base, [...(porBase.get(r.base) ?? []), r]);
  for (const [base, rs] of porBase) {
    console.log(`\n${base.toUpperCase()} — ${rs.length} com falha`);
    const porStatus = new Map<string, string[]>();
    for (const r of rs) porStatus.set(String(r.status), [...(porStatus.get(String(r.status)) ?? []), r.tool]);
    for (const [st, tools] of porStatus) {
      console.log(`   HTTP ${st} (${tools.length}): ${tools.slice(0, 12).join(", ")}${tools.length > 12 ? ` … +${tools.length - 12}` : ""}`);
      const ex = rs.find((r) => String(r.status) === st);
      if (ex?.detalhe) console.log(`      ex.: ${ex.detalhe}`);
    }
  }
}

main().catch((e) => { console.error("Falhou:", e?.message ?? e); process.exit(1); });
