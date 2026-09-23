import { describe, it, expect } from "vitest";
import { resumoElegibilidade, avisoDeAlcance, nomeDoPortal } from "./elegibilidade";

const vazio = { portais: [], perfis: [], usuarios: [] };

describe("resumo da elegibilidade", () => {
  it("sem restrição, afirma o alcance em vez de dizer 'nenhuma regra'", () => {
    expect(resumoElegibilidade(vazio)).toBe("Todos os usuários desta base veem este prompt.");
  });

  it("traduz o código do painel para o nome que o cliente conhece", () => {
    expect(resumoElegibilidade({ ...vazio, portais: ["PG"] })).toBe(
      "Só quem estiver no portal do Gestor.",
    );
    expect(nomeDoPortal("pc")).toBe("Colaborador");
  });

  it("um portal desconhecido aparece como veio — não some da frase", () => {
    expect(nomeDoPortal("PX")).toBe("PX");
  });

  /**
   * O caso do dono, literal: "'Me retorne os dados deste centro de custo' pode
   * estar disponível apenas no portal do gestor para o perfil FOLHA".
   */
  it("combina portal E perfil, que é o exemplo que originou a funcionalidade", () => {
    expect(resumoElegibilidade({ portais: ["PG"], perfis: ["FOLHA"], usuarios: [] })).toBe(
      "Só quem estiver no portal do Gestor e for do perfil FOLHA.",
    );
  });

  /**
   * "ou" dentro de uma dimensão, "e" entre elas. Marcar dois portais libera
   * qualquer um dos dois; o que a frase não pode sugerir é que portal e perfil
   * também sejam alternativos — eles são interseção.
   */
  it("usa 'ou' dentro da dimensão e 'e' entre dimensões", () => {
    const f = resumoElegibilidade({ portais: ["PG", "PO"], perfis: ["FOLHA", "RH"], usuarios: [] });
    expect(f).toBe("Só quem estiver no portal Gestor ou Operador e for do perfil FOLHA ou RH.");
  });

  it("um usuário aparece pelo nome; vários viram contagem", () => {
    expect(resumoElegibilidade({ ...vazio, usuarios: ["ana.silva"] })).toBe(
      "Só quem for o usuário ana.silva.",
    );
    expect(resumoElegibilidade({ ...vazio, usuarios: ["a", "b", "c"] })).toBe(
      "Só quem estiver entre os 3 usuários listados.",
    );
  });

  it("ignora item em branco em vez de produzir frase com buraco", () => {
    expect(resumoElegibilidade({ portais: ["PG", ""], perfis: [], usuarios: [] })).toBe(
      "Só quem estiver no portal do Gestor.",
    );
  });
});

describe("aviso de alcance", () => {
  const conhecidos = ["MASTER", "PORTAL_COLAB", "FOLHA"];

  it("cala quando todos os perfis já foram vistos", () => {
    expect(avisoDeAlcance({ ...vazio, perfis: ["FOLHA"] }, conhecidos)).toBeNull();
  });

  it("não reclama de diferença de caixa — o banco também não separa", () => {
    expect(avisoDeAlcance({ ...vazio, perfis: ["folha"] }, conhecidos)).toBeNull();
  });

  it("nomeia o perfil suspeito, que é o ponto do aviso", () => {
    expect(avisoDeAlcance({ ...vazio, perfis: ["FOLHAA"] }, conhecidos)).toContain("FOLHAA");
  });

  it("lista vários quando há vários", () => {
    const a = avisoDeAlcance({ ...vazio, perfis: ["X", "Y"] }, conhecidos);
    expect(a).toContain("X e Y");
  });

  /**
   * Base nova não tem conversa nenhuma — avisar de TODOS os perfis viraria
   * ruído garantido. Mas o aviso continua correto: eles realmente não
   * apareceram. O que impede o ruído é a tela só pedir o aviso quando há
   * vocabulário; aqui só travamos o comportamento da função.
   */
  it("com vocabulário vazio, todo perfil é desconhecido", () => {
    expect(avisoDeAlcance({ ...vazio, perfis: ["FOLHA"] }, [])).toContain("FOLHA");
  });
});
