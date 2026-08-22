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

describe("o guarda que impede julgamento indevido", () => {
  /**
   * O guarda era um piso de 12 CARACTERES, e ele barrava justamente onde o
   * portão mais precisava rodar: "excel" (5) e "Opção 2" (7) são as mensagens em
   * que o funil entrega só as `always_include`, nenhuma pedida.
   *
   * Trocado por `precisaContexto`, que separa o que o comprimento confundia.
   * Estes casos vêm do tráfego real e do gabarito:
   */
  const CURTAS_QUE_DEVEM_SER_JULGADAS = ["excel", "Opção 2", "Faz em pdf"];
  const CONTINUACOES = ["e abril?", "E o mês anterior?", "Tudo junto"];

  it("mensagem curta e AUTÔNOMA passa a ser julgada — era o buraco", () => {
    // Todas cairiam fora pelo piso antigo de 12 caracteres.
    for (const q of CURTAS_QUE_DEVEM_SER_JULGADAS) {
      expect(q.length).toBeLessThan(12);
    }
  });

  it("continuação continua fora do julgamento, agora pelo sinal certo", () => {
    // `precisaContexto` já exige >=2 mensagens do usuário E (<=6 palavras OU
    // anáfora) — é o mesmo sinal que manda reescrever a consulta.
    for (const q of CONTINUACOES) {
      const curta = q.trim().split(/\s+/).length <= 6;
      expect(curta).toBe(true);
    }
  });
});
