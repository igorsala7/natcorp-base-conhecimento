import { describe, it, expect } from "vitest";
import { perfilAtende, acessoFerramenta } from "./gating";

describe("perfilAtende (trava de agente por perfil)", () => {
  it("sem exigência (null/vazio) vale para qualquer perfil, inclusive ausente", () => {
    expect(perfilAtende(null, "colaborador")).toBe(true);
    expect(perfilAtende("", "gestor")).toBe(true);
    expect(perfilAtende(null, undefined)).toBe(true);
  });

  it("exige gestor: só gestor passa", () => {
    expect(perfilAtende("gestor", "gestor")).toBe(true);
    expect(perfilAtende("gestor", "colaborador")).toBe(false);
    expect(perfilAtende("gestor", undefined)).toBe(false); // sem perfil resolvido → nega
    expect(perfilAtende("gestor", "")).toBe(false);
  });

  it("comparação é case-insensitive e aparada", () => {
    expect(perfilAtende(" Gestor ", "GESTOR")).toBe(true);
  });

  it("o perfil comparado é o do TOKEN (p_perfil), como o portal manda", () => {
    // PG manda GESTOR e o agente nati_gestor exige "gestor" → casa.
    expect(perfilAtende("gestor", "GESTOR")).toBe(true);
    // PO manda MASTER: o agente de gestor NÃO se aplica pelo perfil (no portal PO
    // ele entra por outro caminho — o operador é elegível a todos os agentes).
    expect(perfilAtende("gestor", "MASTER")).toBe(false);
    // PC manda COLABORADOR.
    expect(perfilAtende("gestor", "COLABORADOR")).toBe(false);
  });
});

describe("acessoFerramenta (allowlist por portal × empresa × perfil)", () => {
  it("vazio = liberado para qualquer um", () => {
    expect(acessoFerramenta({}, { portal: "PC", perfil: "X", empresa: "1" })).toBe(true);
    expect(acessoFerramenta({ portais: [], empresas: [], perfis: [] }, {})).toBe(true);
  });

  it("restringe por portal e por perfil (AND), case-insensitive", () => {
    const regra = { portais: ["PG", "PC"], perfis: ["MASTER"] };
    expect(acessoFerramenta(regra, { portal: "pg", perfil: "master" })).toBe(true);
    expect(acessoFerramenta(regra, { portal: "PO", perfil: "MASTER" })).toBe(false); // portal fora
    expect(acessoFerramenta(regra, { portal: "PG", perfil: "OUTRO" })).toBe(false); // perfil fora
  });

  it("operador (PO) ignora a lista de PORTAIS, mas NÃO a de PERFIS", () => {
    const soPG = { portais: ["PG"], perfis: [] };
    expect(acessoFerramenta(soPG, { portal: "PO", perfil: "X", operador: true })).toBe(true);
    const soMaster = { portais: ["PG"], perfis: ["MASTER"] };
    expect(acessoFerramenta(soMaster, { portal: "PO", perfil: "MASTER", operador: true })).toBe(true);
    expect(acessoFerramenta(soMaster, { portal: "PO", perfil: "COMUM", operador: true })).toBe(false); // perfil trava
  });

  it("perfil ausente é negado quando há allowlist de perfil", () => {
    expect(acessoFerramenta({ perfis: ["MASTER"] }, { portal: "PG" })).toBe(false);
  });

  it("restringe por EMPRESA (AND), case-insensitive", () => {
    const regra = { empresas: ["1001", "2002"] };
    expect(acessoFerramenta(regra, { empresa: "1001" })).toBe(true);
    expect(acessoFerramenta(regra, { empresa: "9999" })).toBe(false); // empresa fora
    expect(acessoFerramenta(regra, {})).toBe(false); // empresa ausente com allowlist → nega
    expect(acessoFerramenta({ empresas: [" AB "] }, { empresa: "ab" })).toBe(true);
  });

  it("o Operador (PO) NÃO ignora a lista de EMPRESAS", () => {
    const regra = { empresas: ["1001"] };
    expect(acessoFerramenta(regra, { portal: "PO", empresa: "2002", operador: true })).toBe(false); // empresa trava mesmo PO
    expect(acessoFerramenta(regra, { portal: "PO", empresa: "1001", operador: true })).toBe(true);
  });

  it("as três dimensões combinam por AND", () => {
    const regra = { portais: ["PG"], empresas: ["1001"], perfis: ["MASTER"] };
    expect(acessoFerramenta(regra, { portal: "PG", empresa: "1001", perfil: "MASTER" })).toBe(true);
    expect(acessoFerramenta(regra, { portal: "PG", empresa: "2002", perfil: "MASTER" })).toBe(false); // empresa fora
  });

  /**
   * ENTRADA EM BRANCO NA ALLOWLIST NÃO PODE LIBERAR QUEM NÃO MANDA O VALOR.
   *
   * O mesmo furo que 24/09 fechou em `public.allowlist_casa`, aqui na versão
   * TypeScript: com `portais: ["", "PG"]`, a comparação de `""` com um portal
   * AUSENTE dá `"" === ""` e liberava. Uma linha em branco salva sem intenção
   * abria a ferramenta para todo mundo que não manda `p_portal`, e não havia
   * erro em lugar nenhum para investigar.
   *
   * Latente e não explorado quando encontrado: 1.586 linhas em
   * `ai_base_tools`, zero entrada em branco — exatamente como o outro estava
   * antes de alguém olhar.
   *
   * De propósito NÃO unificado com o motor de elegibilidade: allowlist de
   * FERRAMENTA decide qual API o modelo chama, allowlist de CONTEÚDO decide
   * quem vê um documento, e o funil de ferramentas é superfície medida. Ver
   * src/lib/elegibilidade/dimensoes.ts:63-77.
   */
  it("branco na lista NÃO libera quem não manda o valor", () => {
    expect(acessoFerramenta({ portais: ["", "PG"] }, {})).toBe(false);
    expect(acessoFerramenta({ portais: ["", "PG"] }, { portal: "PG" })).toBe(true);
    expect(acessoFerramenta({ empresas: ["  ", "1001"] }, {})).toBe(false);
    expect(acessoFerramenta({ empresas: ["  ", "1001"] }, { empresa: "1001" })).toBe(true);
    expect(acessoFerramenta({ perfis: ["", "MASTER"] }, {})).toBe(false);
    expect(acessoFerramenta({ perfis: ["", "MASTER"] }, { perfil: "master" })).toBe(true);
    // Nem quem manda valor vazio, que é o mesmo caso por outro caminho.
    expect(acessoFerramenta({ portais: ["", "PG"] }, { portal: "  " })).toBe(false);
  });

  it("lista SÓ de brancos não restringe, como lista vazia", () => {
    // Convenção do projeto, igual a `cardinality = 0` no SQL: o que restringe
    // para ninguém é lido como "sem restrição". Quem recusa o salvamento de
    // uma lista assim é a tela, não este predicado.
    expect(acessoFerramenta({ portais: ["", "  "] }, {})).toBe(true);
    expect(acessoFerramenta({ portais: ["", "  "] }, { portal: "QUALQUER" })).toBe(true);
  });

  it("branco não estraga o resto: a lista com um valor real continua restringindo", () => {
    expect(acessoFerramenta({ portais: ["", "PG"] }, { portal: "PC" })).toBe(false);
    expect(acessoFerramenta({ perfis: [" ", "MASTER"] }, { perfil: "COMUM" })).toBe(false);
  });
});
