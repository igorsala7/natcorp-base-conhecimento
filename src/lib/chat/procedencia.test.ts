import { describe, it, expect } from "vitest";
import { temProcedencia, ehParamDePessoa, normalizarId, recusaSemProcedencia, resolvedoraDeNome } from "./procedencia";

/** O caso real: 269084 não existia em nenhum campo de nenhum dos 96 registros. */
const fonte = {
  linhas: [
    { nome: "TONY OLIVEIRA", matricula: 205818, cod_candidato: 908209, salario: 21495.65 },
    { nome: "Ana Silva", matricula: 1864, cod_candidato: 437195 },
  ],
  identidade: ["365785", "700"],
  texto: "Qual é o histórico de cargos e férias do TONY OLIVEIRA?",
};

describe("temProcedencia — a trava", () => {
  it("BARRA o número inventado", () => {
    expect(temProcedencia(269084, fonte)).toBe(false);
  });

  it("aceita o que veio de um resultado do turno", () => {
    expect(temProcedencia(205818, fonte)).toBe(true);
    // Inclusive de outra coluna: cod_candidato de uma consulta anterior é legítimo.
    expect(temProcedencia(908209, fonte)).toBe(true);
  });

  it("aceita a matrícula de quem pergunta", () => {
    expect(temProcedencia("365785", fonte)).toBe(true);
  });

  it("aceita o que a PESSOA digitou, inclusive com pontuação", () => {
    const f = { ...fonte, texto: "me traz os dados da matrícula 999.897" };
    expect(temProcedencia(999897, f)).toBe(true);
  });

  it("zero à esquerda e tipo não enganam", () => {
    expect(temProcedencia("0205818", fonte)).toBe(true);
    expect(temProcedencia("205818", fonte)).toBe(true);
  });

  it("valor curto passa — não é invenção perigosa", () => {
    // Código de empresa, filial, tipo. Barrar aqui só criaria falso positivo.
    expect(temProcedencia(97, fonte)).toBe(true);
    expect(temProcedencia("", fonte)).toBe(true);
  });
});

describe("ehParamDePessoa", () => {
  it("pega os identificadores de pessoa", () => {
    for (const n of ["matricula", "p_matricula", "cod_candidato", "cod_paciente", "cpf"]) {
      expect(ehParamDePessoa(n)).toBe(true);
    }
  });

  it("ignora a IDENTIDADE e quem não é alvo", () => {
    // `p_matricula_user` é quem pergunta — vem do token, não do modelo.
    for (const n of ["p_matricula_user", "matricula_solicitante", "mat_aprov", "p_empresa", "filial"]) {
      expect(ehParamDePessoa(n)).toBe(false);
    }
  });
});

describe("recusaSemProcedencia", () => {
  const TOOLS = ["consultar_ferias", "informacoes_pessoais_funcionais_resumido", "linha_tempo"];

  it("NOMEIA a ferramenta que resolve nome → matrícula", () => {
    // "Consulte o cadastro" é instrução que o modelo interpreta — e ele já
    // mostrou o que faz quando interpreta.
    const r = recusaSemProcedencia("matricula", 269084, TOOLS) as Record<string, string>;
    expect(r._erro).toMatch(/BLOQUEADA/);
    expect(r._erro).toMatch(/Não repita este número/);
    expect(r._erro).toContain("informacoes_pessoais_funcionais_resumido");
    expect(r._erro).toMatch(/use a MATRÍCULA que vier ali/);
  });

  it("sem resolvedora no turno, manda PEDIR a matrícula", () => {
    // Mandar chamar algo que não está no turno seria empurrar para outro erro.
    const r = recusaSemProcedencia("matricula", 1, ["consultar_ferias"]) as Record<string, string>;
    expect(r._erro).toMatch(/PEÇA a matrícula/);
    expect(r._erro).toMatch(/não tente adivinhar/i);
  });

  it("prefere a versão resumida à completa", () => {
    expect(resolvedoraDeNome(["informacoes_pessoais_funcionais", "informacoes_pessoais_funcionais_resumido"]))
      .toBe("informacoes_pessoais_funcionais_resumido");
    expect(resolvedoraDeNome(["consultar_ferias"])).toBeNull();
  });

  it("explica por que o erro é perigoso, não só que é erro", () => {
    const r = recusaSemProcedencia("matricula", 1) as Record<string, string>;
    expect(r._erro).toMatch(/dados verdadeiros da pessoa errada/);
  });
});

describe("normalizarId", () => {
  it("compara pelos dígitos", () => {
    expect(normalizarId("345.845.796-87")).toBe("34584579687");
    expect(normalizarId("000123")).toBe("123");
    expect(normalizarId(123)).toBe("123");
  });
});
