import { describe, it, expect } from "vitest";
import { normalizarChave, tipoPorChave, montarDados, catalogoParaPrompt, resolverModo, DOC_CATALOG } from "./doc-catalog";

describe("normalizarChave", () => {
  it("tira acento, baixa caixa, troca separadores por _", () => {
    expect(normalizarChave("Data de Nascimento")).toBe("data_de_nascimento");
    expect(normalizarChave("Filiação (Pai)")).toBe("filiacao_pai");
    expect(normalizarChave("  CEP ")).toBe("cep");
  });
});

describe("tipoPorChave", () => {
  it("acha tipos do catálogo e ignora desconhecido", () => {
    expect(tipoPorChave("comprovante_endereco")?.label).toBe("Comprovante de endereço");
    expect(tipoPorChave("inexistente")).toBeUndefined();
  });
});

describe("montarDados", () => {
  it("preenche TODAS as chaves canônicas (faltantes = null) casando por chave normalizada", () => {
    const tipo = tipoPorChave("comprovante_endereco")!;
    const dados = montarDados(tipo, [
      { campo: "Logradouro", valor: "Rua X", confianca: 0.9 },
      { campo: "cep", valor: "01310100", confianca: 0.95 },
    ]);
    expect(dados.logradouro).toEqual({ valor: "Rua X", confianca: 0.9 });
    expect(dados.cep).toEqual({ valor: "01310100", confianca: 0.95 });
    expect(dados.cidade).toEqual({ valor: null, confianca: 0 }); // faltante
    // todas as chaves canônicas presentes
    for (const c of tipo.campos) expect(dados).toHaveProperty(c.chave);
  });
  it("inclui extras não previstos no schema", () => {
    const tipo = tipoPorChave("cpf")!;
    const dados = montarDados(tipo, [{ campo: "observacao_extra", valor: "x", confianca: 0.5 }]);
    expect(dados.observacao_extra).toEqual({ valor: "x", confianca: 0.5 });
  });
  it("sem tipo (outro): só os extras", () => {
    const dados = montarDados(undefined, [{ campo: "algo", valor: "y", confianca: 1 }]);
    expect(dados).toEqual({ algo: { valor: "y", confianca: 1 } });
  });
});

describe("catalogoParaPrompt", () => {
  it("lista todos os tipos com suas chaves", () => {
    const txt = catalogoParaPrompt();
    for (const d of DOC_CATALOG) expect(txt).toContain(d.tipo);
    expect(txt).toContain("outro");
  });
  it("inclui currículo como tipo estruturado", () => {
    expect(tipoPorChave("curriculo")?.label).toContain("Currículo");
  });
});

describe("resolverModo", () => {
  it("explícito vence", () => {
    expect(resolverModo("analisar", true, "extraia")).toBe("analisar");
    expect(resolverModo("extrair", false, "faça um resumo")).toBe("extrair");
  });
  it("auto: campos da tela → extrair", () => {
    expect(resolverModo("auto", true, "faça um resumo")).toBe("extrair");
  });
  it("auto: prompt de análise → analisar", () => {
    expect(resolverModo("auto", false, "faça um resumo deste documento sobre Java")).toBe("analisar");
    expect(resolverModo(undefined, false, "explique o que este texto aborda")).toBe("analisar");
  });
  it("auto: prompt de extração ou vazio → extrair", () => {
    expect(resolverModo("auto", false, "extraia os dados do currículo")).toBe("extrair");
    expect(resolverModo("auto", false, "")).toBe("extrair");
  });
});
