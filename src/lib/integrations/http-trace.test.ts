import { describe, expect, it } from "vitest";
import { montarCurl, montarTrace, redigir, resumirCorpoErro } from "./http-trace";

const SEGREDO = "Fjsn223akse8SS0SKws0197333SvvfadgaOJsXZZ862s";

describe("redigir", () => {
  it("esconde o segredo onde quer que ele apareça", () => {
    const t = `url?key=${SEGREDO} corpo {"key":"${SEGREDO}"}`;
    const r = redigir(t, [SEGREDO]);
    expect(r).not.toContain(SEGREDO);
    expect(r.match(/\*\*\*/g)).toHaveLength(2);
  });

  it("ignora valores curtos — destruiriam o texto", () => {
    // Redigir "1" ou "ok" trocaria pedaços de palavras comuns e tornaria o log
    // ilegível, sem esconder nada que seja de fato segredo.
    expect(redigir("empresa=1 status=ok", ["1", "ok"])).toBe("empresa=1 status=ok");
  });

  it("aguenta nulo e indefinido na lista", () => {
    expect(redigir("texto", [null, undefined])).toBe("texto");
  });
});

describe("montarCurl", () => {
  const req = {
    method: "post",
    url: "https://api.cliente.com/chatbot/login/v1/autenticacao",
    headers: { Authorization: "Bearer eyJhbGciOi.muito.longo", "Content-Type": "application/json" },
    body: `[{"key":"${SEGREDO}","matricula":"57292"}]`,
  };

  it("sai colável, com método em maiúsculo", () => {
    const c = montarCurl(req, [SEGREDO]);
    expect(c.startsWith("curl -i -X POST ")).toBe(true);
    expect(c).toContain("'https://api.cliente.com/chatbot/login/v1/autenticacao'");
    expect(c).toContain("-H 'Content-Type: application/json'");
    expect(c).toContain("--data");
  });

  it("REDIGE o Authorization mesmo sem ninguém pedir", () => {
    // É o cabeçalho que mais vaza em log copiado para uma conversa.
    const c = montarCurl(req);
    expect(c).toContain("-H 'Authorization: Bearer ***'");
    expect(c).not.toContain("eyJhbGciOi.muito.longo");
  });

  it("redige o segredo do corpo, preservando o resto", () => {
    const c = montarCurl(req, [SEGREDO]);
    expect(c).not.toContain(SEGREDO);
    expect(c).toContain("57292"); // a matrícula precisa aparecer para reproduzir
  });

  it("escapa aspas simples — senão o comando quebra ao colar", () => {
    const c = montarCurl({ method: "GET", url: "https://x/a'b" });
    expect(c).toContain("'\\''");
  });

  it("sem corpo não emite --data", () => {
    expect(montarCurl({ method: "GET", url: "https://x" })).not.toContain("--data");
  });
});

describe("resumirCorpoErro", () => {
  const paginaOrds = `<html><head><style>body{margin:0}</style></head><body>
    <svg><path d="M320.07,49.63h8.64l-4.57-7.35"/></svg>
    <pre>ORA-06550: linha 106, coluna 8:
    ORA-00942: a tabela ou view não existe
    ORA-06550: linha 106, coluna 8:
    PLS-00341: a declaração do cursor 'C_BLACKLIST' está incompleta</pre></body></html>`;

  it("o erro Oracle É o resumo — não os primeiros 200 caracteres", () => {
    // Cortar o começo pegaria a folha de estilo e o SVG do logo, e a causa
    // ficaria de fora. Foi por isso que a investigação demorou.
    const r = resumirCorpoErro(paginaOrds);
    expect(r).toContain("ORA-00942");
    expect(r).toContain("C_BLACKLIST");
    expect(r).not.toContain("margin");
    expect(r).not.toContain("path d=");
  });

  it("não repete o mesmo ORA- de cada nível da pilha", () => {
    expect(resumirCorpoErro(paginaOrds).match(/ORA-06550/g)).toHaveLength(1);
  });

  it("sem erro Oracle, devolve o texto sem marcação", () => {
    expect(resumirCorpoErro("<p>Não autorizado</p>")).toBe("Não autorizado");
  });

  it("descarta script e style inteiros", () => {
    expect(resumirCorpoErro("<script>var a=1</script><p>oi</p>")).toBe("oi");
  });

  it("corpo vazio devolve vazio", () => {
    expect(resumirCorpoErro("")).toBe("");
    expect(resumirCorpoErro(null)).toBe("");
  });

  it("respeita o teto", () => {
    expect(resumirCorpoErro("a".repeat(2000), 100)).toHaveLength(100);
  });
});

describe("montarTrace", () => {
  it("junta curl, status, tempo e resposta resumida", () => {
    const t = montarTrace(
      { method: "POST", url: "https://x/login", body: `{"key":"${SEGREDO}"}` },
      { status: 555, corpo: "<html><pre>ORA-00942: a tabela não existe</pre></html>" },
      412,
      [SEGREDO],
    );
    expect(t.status).toBe(555);
    expect(t.ms).toBe(412);
    expect(t.resposta).toContain("ORA-00942");
    expect(t.curl).not.toContain(SEGREDO);
  });

  it("redige o segredo QUE VOLTA na resposta", () => {
    // Há API que devolve a chave enviada. Sem isto, o log vazaria o segredo
    // justamente pelo caminho que ninguém inspeciona.
    const t = montarTrace(
      { method: "GET", url: "https://x" },
      { status: 400, corpo: `chave invalida: ${SEGREDO}` },
      1,
      [SEGREDO],
    );
    expect(t.resposta).not.toContain(SEGREDO);
    expect(t.resposta).toContain("***");
  });
});
