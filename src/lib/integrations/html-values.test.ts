import { describe, it, expect } from "vitest";
import { limparMarcacaoHtml, limparValorHtml, pareceHtml } from "./html-values";

/** O valor REAL que motivou a limpeza (endpoint /requisicoes/v1/req_vaga). */
const REAL = '<span aria-hidden="true" class="fa fa-check-circle colorSuccess"></span> Concluida';

describe("limparValorHtml", () => {
  it("caso real: sobra só o texto que interessa", () => {
    expect(limparValorHtml(REAL)).toBe("Concluida");
  });

  it("string sem tag passa intacta", () => {
    expect(limparValorHtml("Aguardando aprovação")).toBe("Aguardando aprovação");
  });

  it("comparação com < não é confundida com tag", () => {
    expect(limparValorHtml("saldo < 0 e horas > 8")).toBe("saldo < 0 e horas > 8");
  });

  it("entidades viram os caracteres de verdade", () => {
    expect(limparValorHtml("<b>Férias&nbsp;&amp;&nbsp;Abono</b>")).toBe("Férias & Abono");
  });

  it("conteúdo LONGO (documento/relatório) passa intacto — ali a marcação é o conteúdo", () => {
    const doc = `<html><body>${"conteúdo do relatório ".repeat(40)}</body></html>`;
    expect(doc.length).toBeGreaterThan(500);
    expect(limparValorHtml(doc)).toBe(doc);
  });

  it("só ícone, sem texto → vazio (honesto), não o embrulho", () => {
    expect(limparValorHtml('<span class="fa fa-check"></span>')).toBe("");
  });

  it("quebra de linha e espaço repetido viram um espaço só", () => {
    expect(limparValorHtml("<p>Em\n\n  análise</p>")).toBe("Em análise");
  });
});

describe("limparMarcacaoHtml — estrutura preservada", () => {
  it("limpa dentro de items, sem mexer no resto", () => {
    const api = {
      items: [
        { requisicao: 57713, situacao: REAL, motivo: "Aumento De Quadro", ativo: true, valor: null },
        { requisicao: 57714, situacao: "Aguardando", motivo: "Substituição", ativo: false, valor: 12.5 },
      ],
    };
    const out = limparMarcacaoHtml(api);
    expect(out.items[0]!.situacao).toBe("Concluida");
    expect(out.items[0]!.requisicao).toBe(57713);
    expect(out.items[0]!.ativo).toBe(true);
    expect(out.items[0]!.valor).toBeNull();
    expect(out.items[1]!.situacao).toBe("Aguardando");
    expect(out.items[1]!.valor).toBe(12.5);
  });

  it("desce em JSON aninhado (retorno de vaga/requisição)", () => {
    const api = { items: [{ vaga: { cargo: { nome: "<b>Analista</b>" } } }] };
    expect(limparMarcacaoHtml(api).items[0]!.vaga.cargo.nome).toBe("Analista");
  });

  it("não entra em recursão infinita com aninhamento absurdo", () => {
    let n: Record<string, unknown> = { fim: "<i>ok</i>" };
    for (let i = 0; i < 30; i++) n = { dentro: n };
    expect(() => limparMarcacaoHtml(n)).not.toThrow();
  });

  it("array de strings também é limpo", () => {
    expect(limparMarcacaoHtml(["<b>a</b>", "b"])).toEqual(["a", "b"]);
  });
});

describe("pareceHtml", () => {
  it("distingue tag de sinal de menor", () => {
    expect(pareceHtml("<span>x</span>")).toBe(true);
    expect(pareceHtml("1 < 2")).toBe(false);
  });
});
