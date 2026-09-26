/**
 * A detecção de exclusão entre a regra da Natcorp e a da base.
 *
 * Ela existe porque a combinação é E: quem alcança precisa satisfazer as duas.
 * Duas listas disjuntas na mesma dimensão produzem uma documentação que ninguém
 * alcança — e o efeito é silencioso, então a gravação recusa.
 *
 * O caso que este teste protege de verdade é o TERCEIRO: se a comparação usasse
 * uma normalização própria em vez da do motor, `"PG"` e `" pg "` virariam
 * exclusão e a tela recusaria uma escolha legítima. É o defeito mais provável
 * numa mexida futura, porque parece inofensivo.
 */
import { describe, it, expect } from "vitest";
import {
  exclusoesEntreRegras,
  mensagemDeExclusao,
  regraRestringeAlgo,
} from "./regras-combinadas";

describe("exclusoesEntreRegras", () => {
  it("dimensão presente em só uma das duas NÃO é exclusão (a ausente libera)", () => {
    expect(exclusoesEntreRegras({ portal: ["PG"] }, {})).toEqual([]);
    expect(exclusoesEntreRegras({}, { portal: ["PO"] })).toEqual([]);
    expect(exclusoesEntreRegras({ portal: ["PG"] }, { perfil: ["MASTER"] })).toEqual([]);
  });

  it("lista vazia ou só de brancos libera, e não conflita com nada", () => {
    expect(exclusoesEntreRegras({ portal: [] }, { portal: ["PO"] })).toEqual([]);
    expect(exclusoesEntreRegras({ portal: ["", "  "] }, { portal: ["PO"] })).toEqual([]);
    expect(exclusoesEntreRegras({ portal: ["PG"] }, { portal: [] })).toEqual([]);
  });

  it("listas com algum valor em comum NÃO são exclusão", () => {
    expect(exclusoesEntreRegras({ portal: ["PG", "PO"] }, { portal: ["PO"] })).toEqual([]);
    expect(exclusoesEntreRegras({ empresa: ["700", "1"] }, { empresa: ["1", "99"] })).toEqual([]);
  });

  it("mesma normalização do motor: aparo e caixa não criam exclusão", () => {
    expect(exclusoesEntreRegras({ portal: ["PG"] }, { portal: [" pg "] })).toEqual([]);
    expect(exclusoesEntreRegras({ perfil: ["Master"] }, { perfil: ["MASTER"] })).toEqual([]);
    // Número na regra (vem de coluna jsonb) compara como texto, como no SQL.
    expect(exclusoesEntreRegras({ empresa: [700] as never }, { empresa: ["700"] })).toEqual([]);
  });

  it("listas disjuntas na mesma dimensão SÃO exclusão, e devolvem os dois lados", () => {
    expect(exclusoesEntreRegras({ portal: ["PG"] }, { portal: ["PO"] })).toEqual([
      { dimensao: "portal", permitidos: ["PG"], escolhidos: ["PO"] },
    ]);
  });

  it("os valores voltam como foram ESCRITOS, não normalizados — é o que vai à tela", () => {
    const fora = exclusoesEntreRegras({ perfil: [" Folha "] }, { perfil: ["MASTER"] });
    expect(fora[0]?.permitidos).toEqual(["Folha"]);
    expect(fora[0]?.escolhidos).toEqual(["MASTER"]);
  });

  it("acusa mais de uma dimensão, na ordem das doze", () => {
    const fora = exclusoesEntreRegras(
      { portal: ["PG"], empresa: ["700"] },
      { portal: ["PO"], empresa: ["1"] },
    );
    expect(fora.map((f) => f.dimensao)).toEqual(["portal", "empresa"]);
  });

  it("chave desconhecida e valor que não é lista não viram exclusão (quem acusa é o validador)", () => {
    expect(exclusoesEntreRegras({ centro_custos: ["1"] } as never, { centro_custo: ["2"] })).toEqual([]);
    expect(exclusoesEntreRegras({ portal: "PG" } as never, { portal: ["PO"] })).toEqual([]);
  });

  it("regra nula ou malformada não derruba", () => {
    expect(exclusoesEntreRegras(null as never, { portal: ["PO"] })).toEqual([]);
    expect(exclusoesEntreRegras({ portal: ["PG"] }, undefined as never)).toEqual([]);
    expect(exclusoesEntreRegras(7 as never, "x" as never)).toEqual([]);
  });
});

describe("mensagemDeExclusao", () => {
  it("nomeia a dimensão, os valores permitidos e aponta para Ocultar", () => {
    const msg = mensagemDeExclusao(exclusoesEntreRegras({ portal: ["PG"] }, { portal: ["PO"] }));
    expect(msg).toContain("Portal");
    // Portal aparece por NOME, como nas frases da tela.
    expect(msg).toContain("Gestor");
    expect(msg).toContain("Operador");
    expect(msg).toContain("Ocultar");
    // Nada de jargão de engenharia na cópia do cliente.
    expect(msg).not.toMatch(/interse|jsonb|dimens[ãa]o|upsert/i);
  });

  it("a dimensão de cliente NÃO lista valores — seria o código de outro cliente", () => {
    const msg = mensagemDeExclusao(exclusoesEntreRegras({ base: ["leadec"] }, { base: ["natcorp"] }));
    expect(msg).not.toContain("leadec");
    expect(msg).not.toContain("natcorp");
    expect(msg).toContain("definida pela Natcorp");
  });
});

describe("regraRestringeAlgo", () => {
  it("regra vazia, de brancos, ou malformada não restringe", () => {
    expect(regraRestringeAlgo({})).toBe(false);
    expect(regraRestringeAlgo({ portal: [] })).toBe(false);
    expect(regraRestringeAlgo({ portal: ["", " "] })).toBe(false);
    expect(regraRestringeAlgo(null as never)).toBe(false);
  });

  it("uma lista com valor restringe", () => {
    expect(regraRestringeAlgo({ portal: ["PG"] })).toBe(true);
  });
});
