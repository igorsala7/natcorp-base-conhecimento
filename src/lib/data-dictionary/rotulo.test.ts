import { describe, it, expect } from "vitest";
import { rotuloDoComentario, ehRotuloUtil } from "./rotulo";

describe("rótulo escondido no comentário", () => {
  it("OS CASOS REAIS do ERP, copiados do banco", () => {
    expect(rotuloDoComentario("Codigo - Código, que deseja incluir o cadastro de controle de alçadas.")).toEqual({
      label: "Codigo",
      descricao: "Código, que deseja incluir o cadastro de controle de alçadas.",
    });
    expect(rotuloDoComentario("Prazo - Código para o prazo de validade desta amortização.")).toEqual({
      label: "Prazo",
      descricao: "Código para o prazo de validade desta amortização.",
    });
  });

  it("comentário curto SEM separador é o próprio rótulo", () => {
    // "Data de envio do arquivo" nomeia o campo tão bem quanto um rótulo formal.
    expect(rotuloDoComentario("Data de envio do arquivo")).toEqual({
      label: "Data de envio do arquivo",
      descricao: null,
    });
  });

  it("frase longa sem separador fica só como descrição", () => {
    // Inventar rótulo a partir dela daria um termo que ninguém reconhece.
    const longo = "S = mensagem já condensada em um resumo; excluída do payload da IA, mantida para exibição";
    expect(rotuloDoComentario(longo)).toEqual({ label: null, descricao: longo });
  });

  it("não parte quando a frente é longa demais para ser rótulo", () => {
    // O hífen aqui é da frase, não separador de rótulo.
    const r = rotuloDoComentario("Este campo guarda o identificador do processo - veja o manual");
    expect(r.label).toBeNull();
  });

  it("hífen sem espaços não separa — faz parte do nome", () => {
    expect(rotuloDoComentario("Centro-Custo")).toEqual({ label: "Centro-Custo", descricao: null });
  });

  it("aceita travessão e dois-pontos", () => {
    expect(rotuloDoComentario("Matrícula – número do colaborador na empresa").label).toBe("Matrícula");
    expect(rotuloDoComentario("Filial : unidade onde o colaborador trabalha").label).toBe("Filial");
  });

  it("vazio e nulo não quebram", () => {
    for (const v of [null, undefined, "", "   "]) expect(rotuloDoComentario(v)).toEqual({ label: null, descricao: null });
  });
});

describe("o que NÃO serve como rótulo", () => {
  it("recusa o lixo real vindo do APEX", () => {
    // 15 dos 2.221 rótulos do APEX são assim. Lixo em vocabulário é pior que
    // ausência: ausência não confunde a busca nem polui o glossário do prompt.
    for (const v of ["-", "&nbsp;", "---", "  ", "", "...", "()", null]) expect(ehRotuloUtil(v)).toBe(false);
  });

  it("aceita rótulo de verdade, inclusive com pontuação em volta", () => {
    for (const v of ["Filial", "(%) Remuneração Variável", "Dt. Admissão", "Cód."]) expect(ehRotuloUtil(v)).toBe(true);
  });

  it("recusa texto longo demais para ser nome de campo", () => {
    expect(ehRotuloUtil("x".repeat(41))).toBe(false);
  });
});
