import { describe, it, expect } from "vitest";
import { achatarLoop, listaDeRegistros, rotuloDoLoop } from "./loop-flatten";

/**
 * Regressão do bug real: o loop devolvia `{itens:[{valor, dados:{…}}]}` e o registro
 * de datasets criava uma tabela de 2 colunas com `dados` virando JSON cortado em 200
 * chars. Contar/somar/filtrar em cima disso dava número errado, em silêncio.
 */
describe("listaDeRegistros", () => {
  it("acha a lista no topo", () => {
    expect(listaDeRegistros([{ a: 1 }, { a: 2 }])).toHaveLength(2);
  });

  it("acha a lista nas chaves conhecidas", () => {
    expect(listaDeRegistros({ items: [{ a: 1 }] })).toHaveLength(1);
    expect(listaDeRegistros({ registros: [{ a: 1 }, { a: 2 }] })).toHaveLength(2);
  });

  it("objeto de campos escalares vira UMA linha (agregado por iteração)", () => {
    expect(listaDeRegistros({ total: 1200, moeda: "BRL" })).toEqual([{ total: 1200, moeda: "BRL" }]);
  });

  it("erro e lista vazia não viram linha", () => {
    expect(listaDeRegistros({ erro: "403" })).toBeNull();
    expect(listaDeRegistros({ _sem_dados: true })).toBeNull();
    expect(listaDeRegistros({ items: [] })).toBeNull();
    expect(listaDeRegistros([])).toBeNull();
  });

  it("ignora metadados (_) ao montar a linha escalar", () => {
    expect(listaDeRegistros({ total: 5, _dataset: "ds1" })).toEqual([{ total: 5 }]);
  });
});

describe("achatarLoop", () => {
  const mes = (rotulo: string, linhas: Record<string, unknown>[]) => ({ rotulo, dados: { items: linhas } });

  it("junta as iterações numa lista só, com o rótulo como 1ª coluna", () => {
    const r = achatarLoop(
      [mes("01/2026", [{ nome: "Ana", valor: 10 }]), mes("02/2026", [{ nome: "Bia", valor: 20 }, { nome: "Cid", valor: 30 }])],
      "Competência",
    );
    expect(r.achatou).toBe(true);
    if (!r.achatou) return;
    expect(r.total).toBe(3);
    expect(r.itens[0]).toEqual({ "Competência": "01/2026", nome: "Ana", valor: 10 });
    // O rótulo vem primeiro: é a 1ª coluna do dataset e do arquivo exportado.
    expect(Object.keys(r.itens[0]!)[0]).toBe("Competência");
  });

  it("iteração que falhou vai para `falhas` em vez de sumir", () => {
    const r = achatarLoop(
      [mes("01/2026", [{ a: 1 }]), { rotulo: "02/2026", dados: { erro: "sem permissão" } }],
      "Competência",
    );
    expect(r.achatou).toBe(true);
    expect(r.falhas).toMatchObject([{ rotulo: "02/2026", motivo: "sem permissão" }]);
  });

  it("nenhuma iteração com dados → não achata (o chamador mantém o formato antigo)", () => {
    const r = achatarLoop([{ rotulo: "01/2026", dados: { erro: "x" } }], "Competência");
    expect(r.achatou).toBe(false);
    expect(r.falhas).toHaveLength(1);
  });

  it("respeita o teto de linhas", () => {
    const muitas = Array.from({ length: 50 }, (_, i) => ({ i }));
    const r = achatarLoop([mes("01/2026", muitas), mes("02/2026", muitas)], "Competência", 60);
    expect(r.achatou).toBe(true);
    if (!r.achatou) return;
    expect(r.total).toBe(60);
  });

  it("colisão de nome: o rótulo do loop não apaga a coluna da API", () => {
    // A API já traz "Competência"? O spread do registro vem DEPOIS, então o dado real vence.
    const r = achatarLoop([{ rotulo: "01/2026", dados: { items: [{ "Competência": "12/2025", v: 1 }] } }], "Competência");
    expect(r.achatou).toBe(true);
    if (!r.achatou) return;
    expect(r.itens[0]!["Competência"]).toBe("12/2025");
  });
});

describe("rotuloDoLoop", () => {
  it("usa o nome conhecido quando existe", () => {
    expect(rotuloDoLoop("matricula")).toBe("Matrícula");
    expect(rotuloDoLoop("cod_empresa")).toBe("Empresa");
  });

  it("limpa o prefixo técnico e capitaliza o resto", () => {
    expect(rotuloDoLoop("cod_situacao")).toBe("Situacao");
    expect(rotuloDoLoop("ds_evento")).toBe("Evento");
  });

  it("param vazio tem um rótulo utilizável", () => {
    expect(rotuloDoLoop("")).toBe("Valor");
  });
});

/**
 * Antes, a iteração que não virava lista ia para `falhas` só com {rotulo, motivo} —
 * a CARGA era jogada fora e o modelo nem sabia que existia algo ali. E o retorno
 * agregado com sub-objetos (`{cabecalho:{…}, totais:{…}}`) desaparecia inteiro.
 */
describe("preservação da carga", () => {
  it("agregado com sub-objetos vira linha achatada (era null)", () => {
    const r = listaDeRegistros({ cabecalho: { competencia: "01/2026" }, totais: { valor: 1200, qtd: 5 } });
    expect(r).toEqual([{ "cabecalho.competencia": "01/2026", "totais.valor": 1200, "totais.qtd": 5 }]);
  });

  it("iteração não-achatada preserva os dados, podados", () => {
    const gordo = { blocos: Array.from({ length: 40 }, (_, i) => ({ i, txt: "x".repeat(900) })) };
    const r = achatarLoop(
      [{ rotulo: "01/2026", dados: { items: [{ a: 1 }] } }, { rotulo: "02/2026", dados: gordo }],
      "Competência",
    );
    expect(r.achatou).toBe(true);
    const f = r.falhas[0]!;
    expect(f.dados).toBeDefined();
    // Podado: no máximo 5 itens do array e strings cortadas.
    expect(JSON.stringify(f.dados).length).toBeLessThan(5000);
  });

  it("erro da API não carrega payload inútil, mas mantém o motivo", () => {
    const r = achatarLoop(
      [{ rotulo: "01/2026", dados: { items: [{ a: 1 }] } }, { rotulo: "02/2026", dados: { erro: "403" } }],
      "Competência",
    );
    expect(r.falhas[0]!.motivo).toBe("403");
  });
});
