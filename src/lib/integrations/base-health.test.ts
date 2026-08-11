import { describe, expect, it } from "vitest";
import {
  camposDeCredencialExigidos,
  passosDeConfiguracao,
  resumo,
  temFalha,
  type BaseDiag,
  type CredDiag,
  type ToolDiag,
} from "./base-health";

const base = (extra: Partial<BaseDiag> = {}): BaseDiag => ({
  base_code: "acme",
  active: true,
  base_url: "https://api.acme.com/v1",
  credential_id: "cred-1",
  ...extra,
});

const cred: CredDiag = { name: "ACME OAuth", auth_type: "oauth2", active: true };

/** Réplica do `meus_dados` real: `key` vem de `session_key` da credencial. */
const meusDados: ToolDiag = {
  key: "meus_dados",
  name: "Meus Dados",
  params: [
    { nome: "key", origem: "credencial", obrigatorio: true, campoCredencial: "session_key" },
    { nome: "matricula", origem: "identidade", obrigatorio: true },
  ],
};

describe("camposDeCredencialExigidos", () => {
  it("cruza as ferramentas com os campos que elas leem", () => {
    const m = camposDeCredencialExigidos([meusDados]);
    expect(m.get("session_key")).toEqual(["meus_dados"]);
  });

  it("agrupa todas as ferramentas que dependem do mesmo campo", () => {
    const outra: ToolDiag = { ...meusDados, key: "meu_holerite" };
    expect(camposDeCredencialExigidos([meusDados, outra]).get("session_key")).toEqual([
      "meus_dados",
      "meu_holerite",
    ]);
  });

  it("ignora parâmetro OPCIONAL de credencial", () => {
    // Opcional em branco não quebra nada; apontá-lo como problema faria a
    // pessoa procurar defeito onde não há.
    const t: ToolDiag = {
      key: "x",
      name: "X",
      params: [{ nome: "k", origem: "credencial", obrigatorio: false, campoCredencial: "session_key" }],
    };
    expect(camposDeCredencialExigidos([t]).size).toBe(0);
  });

  it("ignora origens que não são credencial", () => {
    const t: ToolDiag = { key: "x", name: "X", params: [{ nome: "m", origem: "identidade", obrigatorio: true }] };
    expect(camposDeCredencialExigidos([t]).size).toBe(0);
  });
});

describe("passosDeConfiguracao", () => {
  it("tudo no lugar não gera falha", () => {
    const p = passosDeConfiguracao(base(), cred, ["client_id", "client_secret", "token_url", "session_key"], [meusDados]);
    expect(temFalha(p)).toBe(false);
    expect(resumo(p)).toBe("Tudo certo.");
  });

  it("O CASO stefanini-dev: campo em branco que uma ferramenta exige", () => {
    // O diagnóstico existe por causa deste caso — a mensagem precisa nomear o
    // campo E quem depende dele, senão volta a ser uma investigação.
    const p = passosDeConfiguracao(base(), cred, ["client_id", "client_secret", "token_url"], [meusDados]);
    expect(temFalha(p)).toBe(true);
    const falha = p.find((x) => x.estado === "erro")!;
    expect(falha.nome).toContain("session_key");
    expect(falha.detalhe).toContain("meus_dados");
  });

  it("O CASO stefanini: sem credencial padrão, PARA de checar", () => {
    // Apontar campo de credencial em branco quando não há credencial apontada
    // faria corrigir o segundo problema e continuar travado no primeiro.
    const p = passosDeConfiguracao(base({ credential_id: null }), null, [], [meusDados]);
    expect(temFalha(p)).toBe(true);
    expect(p.at(-1)!.nome).toBe("Credencial padrão");
    expect(p.some((x) => x.nome.includes("session_key"))).toBe(false);
  });

  it("base inativa e sem URL viram erro", () => {
    const p = passosDeConfiguracao(base({ active: false, base_url: "  " }), cred, ["client_id"], []);
    expect(p.filter((x) => x.estado === "erro").map((x) => x.nome)).toContain("Base ativa");
    expect(p.filter((x) => x.estado === "erro").map((x) => x.nome)).toContain("URL base");
  });

  it("credencial inativa é erro, não aviso", () => {
    const p = passosDeConfiguracao(base(), { ...cred!, active: false }, ["client_id"], []);
    expect(p.find((x) => x.nome === "Credencial padrão")!.estado).toBe("erro");
  });

  it("credencial apagada por fora é reportada", () => {
    const p = passosDeConfiguracao(base(), null, [], []);
    expect(p.at(-1)!.detalhe).toMatch(/não existe mais/);
  });

  it("nenhuma ferramenta liberada é AVISO, não erro", () => {
    // É configuração legítima (base só de documentação), não defeito.
    const p = passosDeConfiguracao(base(), cred, ["client_id"], []);
    expect(temFalha(p)).toBe(false);
    expect(resumo(p)).toMatch(/1 aviso/);
  });

  it("não lista 40 chaves na tela", () => {
    const muitas = Array.from({ length: 9 }, (_, i) => ({ ...meusDados, key: `t${i}` }));
    const p = passosDeConfiguracao(base(), cred, ["client_id"], muitas);
    expect(p.find((x) => x.estado === "erro")!.detalhe).toMatch(/e mais 5/);
  });
});

describe("resumo", () => {
  it("conta os problemas", () => {
    expect(resumo([{ nome: "a", estado: "erro", detalhe: "" }, { nome: "b", estado: "erro", detalhe: "" }])).toBe(
      "2 problema(s) encontrado(s).",
    );
  });
});
