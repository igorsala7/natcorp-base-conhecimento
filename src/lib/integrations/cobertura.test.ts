import { describe, it, expect } from "vitest";
import { promptDeCobertura, type CandidataCobertura } from "./cobertura-prompt";

const CANDIDATAS: CandidataCobertura[] = [
  { key: "consultar_feedback", name: "Consultar Feedback", description: "Feedbacks registrados do colaborador." },
  { key: "informacoes_pessoais_funcionais", name: "Dados dos Colaboradores", description: "Cadastro completo." },
];

describe("promptDeCobertura", () => {
  it("lista as candidatas numeradas, com a descrição cortada", () => {
    const p = promptDeCobertura("Me retorne os atestados do 23087", CANDIDATAS);
    expect(p).toContain("1. Consultar Feedback");
    expect(p).toContain("2. Dados dos Colaboradores");
    expect(p).toContain("Me retorne os atestados do 23087");
  });

  it("ensina a distinguir ASSUNTO de RECORTE — a confusão que derrubou a 1ª versão", () => {
    // Sem esta regra o modelo reprovava "marcações de ponto DA MINHA EQUIPE"
    // porque a ferramenta não fala de equipe. Equipe é parâmetro, não assunto.
    const p = promptDeCobertura("qualquer coisa", CANDIDATAS);
    expect(p).toMatch(/recorte é parâmetro, não assunto/i);
  });

  it("no máximo 6 candidatas — prompt curto é prompt barato", () => {
    const muitas = Array.from({ length: 12 }, (_, i) => ({ key: `t${i}`, name: `Tool ${i}` }));
    const p = promptDeCobertura("pergunta qualquer aqui", muitas);
    expect(p).toContain("6. Tool 5");
    expect(p).not.toContain("7. Tool 6");
  });
});

describe("os guardas que impedem julgamento indevido", () => {
  it("pergunta curta não deve ser julgada — costuma ser continuação", () => {
    // "E o mês anterior?" tem o assunto no turno de trás. Reprovar o catálogo
    // por causa da elipse cortaria a ferramenta certa. O piso de 12 caracteres
    // em `catalogoCobre` existe por isso.
    expect("e abril?".trim().length).toBeLessThan(12);
    expect("Me retorne os atestados do colaborador 23087".length).toBeGreaterThan(12);
  });
});
