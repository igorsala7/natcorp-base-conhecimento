import { describe, it, expect } from "vitest";
import { pageContextFields, pageContextHint, pageContextNote, mesmaPagina, pageChangeNote, apexDaTela, telaEstaEm } from "./page-context";

describe("mudança de tela (#5)", () => {
  it("mesmaPagina compara por path; null nunca é igual", () => {
    expect(mesmaPagina({ path: "/a" }, { path: "/a", title: "X" })).toBe(true);
    expect(mesmaPagina({ path: "/a" }, { path: "/b" })).toBe(false);
    expect(mesmaPagina(null, { path: "/a" })).toBe(false);
    expect(mesmaPagina({ title: "" }, { title: "" })).toBe(false); // chave vazia
  });

  it("pageChangeNote só aparece quando a tela mudou", () => {
    expect(pageChangeNote({ path: "/a" }, { path: "/a" })).toBe("");
    expect(pageChangeNote(null, null)).toBe("");
    const nota = pageChangeNote({ path: "/ferias", title: "Férias" }, { path: "/ponto", title: "Ponto" });
    expect(nota).toContain("MUDANÇA DE TELA");
    expect(nota).toContain("Férias");
    expect(nota).toContain("Ponto");
  });
});

describe("page-context", () => {
  it("saneia e mantém só os campos presentes", () => {
    expect(pageContextFields({ href: " https://app/x ", path: "/x", title: "Emitir NF" })).toEqual({
      href: "https://app/x",
      path: "/x",
      title: "Emitir NF",
    });
    expect(pageContextFields({ title: "Só título" })).toEqual({ title: "Só título" });
  });

  it("descarta payload vazio ou não-objeto", () => {
    expect(pageContextFields(null)).toBeNull();
    expect(pageContextFields("x")).toBeNull();
    expect(pageContextFields({})).toBeNull();
    expect(pageContextFields({ href: "   " })).toBeNull();
    expect(pageContextFields({ title: 42 })).toBeNull();
  });

  it("aplica os tetos de tamanho", () => {
    const p = pageContextFields({ title: "a".repeat(1000), href: "b".repeat(1000) });
    expect(p?.title?.length).toBe(300);
    expect(p?.href?.length).toBe(500);
  });

  it("hint junta título e caminho", () => {
    expect(pageContextHint({ title: "Emitir NF", path: "/nf" })).toBe("Emitir NF — /nf");
    expect(pageContextHint(null)).toBe("");
  });

  it("nota rotula como DADO e cita a tela", () => {
    const nota = pageContextNote({ title: "Emitir NF", path: "/nf" });
    expect(nota).toContain("TELA ATUAL");
    expect(nota).toContain("DADO");
    expect(nota).toContain('"Emitir NF"');
    expect(nota).toContain("/nf");
    expect(pageContextNote(null)).toBe("");
    expect(pageContextNote({ href: "https://x" })).toBe(""); // sem título/caminho → sem nota
  });
});

describe("qual aplicação APEX", () => {
  // Os href abaixo são REAIS, copiados de `conversations.page` em produção.
  it("lê app e página da forma clássica", () => {
    expect(apexDaTela({ href: "https://natcorpbr.com.br/apex/dev/f?p=200:2:862771319882::NO:::" })).toEqual({ app: "200", page: "2" });
    expect(apexDaTela({ href: "https://www.natcorpbr.com.br/apex/rh/f?p=200:799:1045460033940::NO:799:P799_APP_CALLED,P79" })).toEqual({ app: "200", page: "799" });
    // Com querystring depois do `p=` — o `&cs=…` aparece em produção.
    expect(apexDaTela({ href: "https://natcorpbr.com.br/apex/dev/f?p=200:791:171598::NO:791::&cs=3kfE_z" })?.app).toBe("200");
  });

  it("lê a forma amigável, que é o padrão do APEX desde a v20", () => {
    // A "Carga de Dados" pode ser uma aplicação mais nova; se só a clássica
    // fosse tratada, a exceção nunca valeria lá.
    expect(apexDaTela({ href: "https://natcorpbr.com.br/apex/r/natcorp/po_natcorp/colaboradores" })).toEqual({ app: "po_natcorp", page: "colaboradores" });
  });

  it("aceita alias no lugar do id na forma clássica", () => {
    // O APEX aceita os dois; quem configura não deveria precisar saber qual.
    expect(apexDaTela({ href: "https://x/apex/f?p=PO_NATCORP:1:0" })?.app).toBe("po_natcorp");
  });

  it("tela que não é APEX devolve null — e o portal é uma delas", () => {
    expect(apexDaTela({ href: "https://www.natcorpbr.com.br/natcorp/ia/docs/natcorp" })).toBeNull();
    expect(apexDaTela(null)).toBeNull();
    expect(apexDaTela({ title: "Só o título" })).toBeNull();
  });

  it("href malformado não derruba o turno", () => {
    expect(() => apexDaTela({ href: "https://x/f?p=%:1:0" })).not.toThrow();
  });

  it("lista vazia não libera nada", () => {
    // O padrão de uma exceção é NÃO existir: um campo esquecido não pode virar
    // permissão silenciosa.
    const tela = { href: "https://x/apex/f?p=300:1:0" };
    expect(telaEstaEm(tela, [])).toBe(false);
    expect(telaEstaEm(tela, null)).toBe(false);
    expect(telaEstaEm(tela, ["300"])).toBe(true);
    expect(telaEstaEm(tela, ["200", "300"])).toBe(true);
    expect(telaEstaEm(tela, ["200"])).toBe(false);
  });

  it("casa por id OU por alias, sem depender de caixa", () => {
    expect(telaEstaEm({ href: "https://x/apex/f?p=300:1:0" }, ["  300  "])).toBe(true);
    expect(telaEstaEm({ href: "https://x/apex/r/ws/carga_dados/home" }, ["CARGA_DADOS"])).toBe(true);
  });
});
