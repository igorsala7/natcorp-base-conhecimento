import { describe, it, expect } from "vitest";
import { podarInfo, passosPublicos } from "./trace-limits";

const tam = (o: unknown) => JSON.stringify(o)!.length;

describe("podarInfo", () => {
  it("não mexe no que já cabe", () => {
    const info = { tool: "bi_headcount", status: 200, ms: 120 };
    expect(podarInfo(info, 4000)).toBe(info);
  });

  it("corta o cURL grande mas PRESERVA tool/status/ms — antes o objeto inteiro sumia", () => {
    const info = { tool: "bi_headcount", status: 200, ms: 842, curl: "c".repeat(3000), params: { a: "p".repeat(2000) } };
    const r = podarInfo(info, 4000)!;
    expect(tam(r)).toBeLessThanOrEqual(4000);
    expect(r.tool).toBe("bi_headcount");
    expect(r.status).toBe(200);
    expect(r.ms).toBe(842);
    expect(r._podado).toBeDefined();
    expect(String(r.curl)).toContain("…");
  });

  it("preserva a mensagem de erro, que é o que explica a falha", () => {
    const info = { tool: "x", erro: "Ação indisponível no momento.", curl: "c".repeat(9000) };
    const r = podarInfo(info, 1000)!;
    expect(r.erro).toBe("Ação indisponível no momento.");
    expect(tam(r)).toBeLessThanOrEqual(1000);
  });

  it("remove o campo inteiro quando cortar não basta, e declara o que removeu", () => {
    const info = { tool: "x", status: 200, curl: "c".repeat(50_000), params: { b: "p".repeat(50_000) } };
    const r = podarInfo(info, 300)!;
    expect(tam(r)).toBeLessThanOrEqual(300);
    expect(r.tool).toBe("x");
    expect(r._podado).toEqual(expect.arrayContaining(["curl", "params"]));
  });

  it("undefined passa sem erro", () => {
    expect(podarInfo(undefined, 4000)).toBeUndefined();
  });
});

describe("passosPublicos", () => {
  it("remove o cURL do que vai ao navegador e declara a remoção", () => {
    const passos = [
      { ms: 10, passo: "mensagem", info: { pergunta: "oi" } },
      { ms: 90, passo: "integracoes:curl", info: { tool: "bi_headcount", status: 200, curl: "curl -X GET 'https://interno/ords/rh'" } },
    ];
    const pub = passosPublicos(passos);
    expect(pub[0]).toBe(passos[0]); // sem info sensível: mesmo objeto, sem cópia
    expect(pub[1]!.info!.curl).toBeUndefined();
    expect(pub[1]!.info!.tool).toBe("bi_headcount");
    expect(pub[1]!.info!.status).toBe(200);
    expect(pub[1]!.info!._servidor).toEqual(["curl"]);
  });

  it("não altera o array de origem — o banco continua recebendo o trace íntegro", () => {
    const passos = [{ ms: 1, passo: "integracoes:curl", info: { tool: "t", curl: "curl -X GET 'x'" } }];
    passosPublicos(passos);
    expect(passos[0]!.info!.curl).toBe("curl -X GET 'x'");
  });

  it("passo sem info passa direto", () => {
    const passos = [{ ms: 1, passo: "fim" }];
    expect(passosPublicos(passos)).toEqual(passos);
  });
});
