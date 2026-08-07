import { describe, it, expect } from "vitest";
import { sanitizarUrl, sanitizarBody, previewSaida } from "./run-log-sanitize";
import type { ToolParam } from "./tools";

const sessionKeyParam: ToolParam = {
  nome: "key",
  descricao: "",
  tipo: "string",
  origem: "credencial",
  obrigatorio: true,
  local: "query",
  campoCredencial: "session_key",
};

describe("sanitizarUrl", () => {
  it("mascara params sensíveis por nome (token, api_key)", () => {
    const url = "https://api.x.com/v1/dados?empresa=700&token=abc123&api_key=zzz";
    const out = sanitizarUrl(url, []);
    expect(out).toContain("empresa=700");
    expect(out).toContain("token=***");
    expect(out).toContain("api_key=***");
    expect(out).not.toContain("abc123");
    expect(out).not.toContain("zzz");
  });

  it("mascara params de origem=credencial mesmo com nome incomum", () => {
    const url = "https://api.x.com/v1/saque?key=SESSION_SECRET&matricula=1";
    const out = sanitizarUrl(url, [sessionKeyParam]);
    expect(out).not.toContain("SESSION_SECRET");
    expect(out).toContain("matricula=1");
  });

  it("URL inválida volta como veio (não quebra)", () => {
    expect(sanitizarUrl("(não é url)", [])).toBe("(não é url)");
  });
});

describe("sanitizarBody", () => {
  it("redige campos sensíveis recursivamente e preserva o resto", () => {
    const body = JSON.stringify({ saque: [{ matricula: 9, client_secret: "SH", nested: { password: "p" } }] });
    const out = sanitizarBody(body, []) as { saque: { matricula: number; client_secret: string; nested: { password: string } }[] };
    expect(out.saque[0]!.matricula).toBe(9);
    expect(out.saque[0]!.client_secret).toBe("***");
    expect(out.saque[0]!.nested.password).toBe("***");
  });

  it("corpo não-JSON não vira exceção", () => {
    expect(sanitizarBody("<xml/>", [])).toBe("(corpo não-JSON)");
  });

  it("sem corpo = undefined", () => {
    expect(sanitizarBody(undefined, [])).toBeUndefined();
  });
});

describe("previewSaida", () => {
  it("passa curto inteiro", () => {
    const p = previewSaida({ a: 1 });
    expect(p.truncated).toBe(false);
    expect(p.preview).toBe('{"a":1}');
  });

  it("trunca saída grande e marca truncated", () => {
    const p = previewSaida("x".repeat(5000));
    expect(p.truncated).toBe(true);
    expect(p.bytes).toBe(5000);
    expect(p.preview.endsWith("…")).toBe(true);
    expect(p.preview.length).toBeLessThan(5000);
  });
});

// ── Redação por SUBSTRING e por VALOR ────────────────────────────────────────
// Dois furos reais fechados aqui: (1) o casamento exato deixava passar toda a
// convenção `p_*` das APIs ORDS quando o segredo era cadastrado como 'fixo' em
// vez de 'credencial'; (2) a sanitização só varria a query, então um segredo no
// CAMINHO (`/ords/{key}/rh/...`) saía em claro no cURL e no ai_tool_runs.
describe("redação de segredos — nome por substring", () => {
  const p = (nome: string, origem: ToolParam["origem"] = "fixo"): ToolParam => ({
    nome, descricao: "", tipo: "string", origem, obrigatorio: false, local: "query",
  });

  it("pega a convenção p_* das APIs ORDS mesmo fora de origem='credencial'", () => {
    const params = [p("p_session_key"), p("token_acesso"), p("X-Access-Key")];
    const url = sanitizarUrl("https://api/rh?p_session_key=abc123&token_acesso=xyz789&mes=2026-08", params);
    expect(url).toContain("p_session_key=***");
    expect(url).toContain("token_acesso=***");
    expect(url).toContain("mes=2026-08"); // não mascara o que é de negócio
  });

  it("NÃO mascara parâmetro de negócio — mascarar demais mata a depuração", () => {
    const params = [p("matricula"), p("empresa"), p("centro_custo"), p("competencia")];
    const url = sanitizarUrl("https://api/rh?matricula=4471&empresa=1&centro_custo=97", params);
    expect(url).toContain("matricula=4471");
    expect(url).toContain("empresa=1");
    expect(url).toContain("centro_custo=97");
  });

  it("mascara campo com cara de segredo no corpo, recursivamente", () => {
    const body = JSON.stringify({ dados: { p_token: "abc123def", matricula: "4471" } });
    const r = sanitizarBody(body, []) as { dados: Record<string, unknown> };
    expect(r.dados.p_token).toBe("***");
    expect(r.dados.matricula).toBe("4471");
  });
});

describe("redação de segredos — por VALOR (cobre o caminho da URL)", () => {
  it("redige o segredo embutido no PATH, onde não há nome de query para casar", () => {
    const url = sanitizarUrl("https://api/ords/SESSAO7f3a91b2/rh/v1/emps?mes=2026-08", [], ["SESSAO7f3a91b2"]);
    expect(url).not.toContain("SESSAO7f3a91b2");
    expect(url).toContain("***");
    expect(url).toContain("mes=2026-08");
  });

  it("também redige o valor percent-encoded", () => {
    const url = sanitizarUrl("https://api/rh?x=chave%2Fcom%2Fbarra", [], ["chave/com/barra"]);
    expect(url).not.toContain("chave%2Fcom%2Fbarra");
  });

  it("ignora valor curto — 'replaceAll' de '1' destruiria a URL inteira", () => {
    const url = sanitizarUrl("https://api/rh/v1/emps?empresa=1", [], ["1", "v1"]);
    expect(url).toContain("/rh/v1/emps");
    expect(url).toContain("empresa=1");
  });
});
