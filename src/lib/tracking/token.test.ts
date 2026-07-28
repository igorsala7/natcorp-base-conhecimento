import { describe, it, expect } from "vitest";
import { gerarChaveRastreio, encriptarRastreio, assinarRastreio, decodificarRastreio } from "./token";

describe("token de rastreio (AES-256-GCM)", () => {
  const chave = gerarChaveRastreio();

  it("ida e volta preserva os p_*", () => {
    const token = encriptarRastreio(chave, { p_usuario: "joao", p_empresa: "ACME", p_perfil: "gestor" });
    expect(token.startsWith("kbt1.")).toBe(true);
    expect(decodificarRastreio(chave, token)).toEqual({ p_usuario: "joao", p_empresa: "ACME", p_perfil: "gestor" });
  });

  it("token opaco não revela os valores em texto", () => {
    const token = encriptarRastreio(chave, { p_usuario: "joao" });
    expect(token).not.toContain("joao");
  });

  it("adulteração é rejeitada (autenticação falha)", () => {
    const token = encriptarRastreio(chave, { p_usuario: "joao" });
    // vira o último caractere do corpo base64url
    const corpo = token.slice("kbt1.".length);
    const trocado = corpo.slice(0, -1) + (corpo.at(-1) === "A" ? "B" : "A");
    expect(decodificarRastreio(chave, "kbt1." + trocado)).toBeNull();
  });

  it("chave errada não decifra", () => {
    const token = encriptarRastreio(chave, { p_usuario: "joao" });
    expect(decodificarRastreio(gerarChaveRastreio(), token)).toBeNull();
  });

  it("token expirado é descartado", () => {
    const passado = Math.floor(Date.now() / 1000) - 60;
    const token = encriptarRastreio(chave, { p_usuario: "joao", exp: passado });
    expect(decodificarRastreio(chave, token)).toBeNull();
  });

  it("exp no futuro é aceito, e o exp não vira campo p_*", () => {
    const futuro = Math.floor(Date.now() / 1000) + 3600;
    const token = encriptarRastreio(chave, { p_usuario: "joao", exp: futuro });
    expect(decodificarRastreio(chave, token)).toEqual({ p_usuario: "joao" });
  });

  it("lixo / prefixo ausente / não-string → null", () => {
    expect(decodificarRastreio(chave, "abc")).toBeNull();
    expect(decodificarRastreio(chave, "kbt1.$$$")).toBeNull();
    expect(decodificarRastreio(chave, null)).toBeNull();
    expect(decodificarRastreio(chave, 123)).toBeNull();
    expect(decodificarRastreio(chave, "")).toBeNull();
  });

  it("chave malformada não quebra (retorna null)", () => {
    const token = encriptarRastreio(chave, { p_usuario: "joao" });
    expect(decodificarRastreio("chave-curta", token)).toBeNull();
  });
});

describe("token de rastreio ASSINADO (HMAC-SHA256)", () => {
  const chave = gerarChaveRastreio();

  it("ida e volta preserva os p_*", () => {
    const token = assinarRastreio(chave, { p_usuario: "joao", p_empresa: "ACME", p_perfil: "gestor" });
    expect(token.startsWith("kbt1h.")).toBe(true);
    expect(decodificarRastreio(chave, token)).toEqual({ p_usuario: "joao", p_empresa: "ACME", p_perfil: "gestor" });
  });

  it("preserva acentos (UTF-8) — nomes com ç/ã", () => {
    const token = assinarRastreio(chave, { p_usuario: "joão", p_empresa: "Conceição" });
    expect(decodificarRastreio(chave, token)).toEqual({ p_usuario: "joão", p_empresa: "Conceição" });
  });

  it("adulterar o payload é rejeitado (assinatura não bate)", () => {
    const token = assinarRastreio(chave, { p_usuario: "joao" });
    const [, payload, mac] = token.split(".");
    // Troca o payload por um forjado, mantendo a assinatura antiga.
    const forjado = Buffer.from(JSON.stringify({ p_usuario: "maria" }), "utf8").toString("base64url");
    expect(payload).not.toEqual(forjado);
    expect(decodificarRastreio(chave, `kbt1h.${forjado}.${mac}`)).toBeNull();
  });

  it("chave errada não valida", () => {
    const token = assinarRastreio(chave, { p_usuario: "joao" });
    expect(decodificarRastreio(gerarChaveRastreio(), token)).toBeNull();
  });

  it("expirado é descartado; exp futuro é aceito", () => {
    const passado = Math.floor(Date.now() / 1000) - 60;
    const futuro = Math.floor(Date.now() / 1000) + 3600;
    expect(decodificarRastreio(chave, assinarRastreio(chave, { p_usuario: "joao", exp: passado }))).toBeNull();
    expect(decodificarRastreio(chave, assinarRastreio(chave, { p_usuario: "joao", exp: futuro }))).toEqual({ p_usuario: "joao" });
  });

  it("formato inválido (partes faltando) → null", () => {
    expect(decodificarRastreio(chave, "kbt1h.soquepayload")).toBeNull();
    expect(decodificarRastreio(chave, "kbt1h..")).toBeNull();
  });

  it("o mesmo decodificador aceita GCM e HMAC", () => {
    expect(decodificarRastreio(chave, encriptarRastreio(chave, { p_usuario: "a" }))).toEqual({ p_usuario: "a" });
    expect(decodificarRastreio(chave, assinarRastreio(chave, { p_usuario: "b" }))).toEqual({ p_usuario: "b" });
  });
});
