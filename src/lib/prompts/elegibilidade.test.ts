import { describe, it, expect } from "vitest";
import { resumoElegibilidade, avisoDeAlcance, nomeDoPortal } from "./elegibilidade";

const vazio = { bases: [], portais: [], perfis: [], empresas: [], usuarios: [], matriculas: [] };

describe("resumo da elegibilidade", () => {
  it("sem restrição, afirma o alcance em vez de dizer 'nenhuma regra'", () => {
    expect(resumoElegibilidade(vazio)).toBe("Todos os usuários desta base veem este prompt.");
    // Objeto parcial (prompt antigo, sem as dimensões novas) é o mesmo caso.
    expect(resumoElegibilidade({})).toBe("Todos os usuários desta base veem este prompt.");
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
    expect(resumoElegibilidade({ ...vazio, portais: ["PG"], perfis: ["FOLHA"] })).toBe(
      "Só quem estiver no portal do Gestor e for do perfil FOLHA.",
    );
  });

  /**
   * "ou" dentro de uma dimensão, "e" entre elas. Marcar dois portais libera
   * qualquer um dos dois; o que a frase não pode sugerir é que portal e perfil
   * também sejam alternativos — eles são interseção.
   */
  it("usa 'ou' dentro da dimensão e 'e' entre dimensões", () => {
    const f = resumoElegibilidade({ ...vazio, portais: ["PG", "PO"], perfis: ["FOLHA", "RH"] });
    expect(f).toBe("Só quem estiver no portal Gestor ou Operador e for do perfil FOLHA ou RH.");
  });

  it("cobre as seis dimensões, do recorte mais largo ao mais estreito", () => {
    expect(
      resumoElegibilidade({
        bases: ["leadec"],
        portais: ["PG"],
        empresas: ["700"],
        perfis: ["FOLHA"],
        usuarios: ["ana.silva"],
        matriculas: ["12"],
      }),
    ).toBe(
      "Só quem for da base leadec, estiver no portal do Gestor, for da empresa 700, " +
        "for do perfil FOLHA, for o usuário ana.silva e tiver a matrícula 12.",
    );
  });

  it("mostra o NOME da base, não o código, quando a tela sabe traduzir", () => {
    const nomes: Record<string, string> = { leadec: "Leadec Brasil" };
    expect(resumoElegibilidade({ ...vazio, bases: ["leadec"] }, (c) => nomes[c] ?? c)).toBe(
      "Só quem for da base Leadec Brasil.",
    );
  });

  it("um usuário/matrícula aparece pelo valor; vários viram contagem", () => {
    expect(resumoElegibilidade({ ...vazio, usuarios: ["ana.silva"] })).toBe(
      "Só quem for o usuário ana.silva.",
    );
    expect(resumoElegibilidade({ ...vazio, usuarios: ["a", "b", "c"] })).toBe(
      "Só quem estiver entre os 3 usuários listados.",
    );
    expect(resumoElegibilidade({ ...vazio, matriculas: ["12"] })).toBe(
      "Só quem tiver a matrícula 12.",
    );
    expect(resumoElegibilidade({ ...vazio, matriculas: ["1", "2"] })).toBe(
      "Só quem estiver entre as 2 matrículas listadas.",
    );
  });

  it("ignora item em branco em vez de produzir frase com buraco", () => {
    expect(resumoElegibilidade({ ...vazio, portais: ["PG", ""] })).toBe(
      "Só quem estiver no portal do Gestor.",
    );
    // Só brancos equivale a não restringir — é o que o banco faz.
    expect(resumoElegibilidade({ ...vazio, perfis: ["  "] })).toBe(
      "Todos os usuários desta base veem este prompt.",
    );
  });
});

describe("aviso de alcance", () => {
  const conhecidos = { perfis: ["MASTER", "PORTAL_COLAB", "FOLHA"], empresas: ["700", "1"] };

  it("cala quando tudo já foi visto", () => {
    expect(avisoDeAlcance({ perfis: ["FOLHA"], empresas: ["700"] }, conhecidos)).toBeNull();
  });

  it("não reclama de diferença de caixa — o banco também não separa", () => {
    expect(avisoDeAlcance({ perfis: ["folha"] }, conhecidos)).toBeNull();
  });

  it("nomeia o perfil suspeito, que é o ponto do aviso", () => {
    expect(avisoDeAlcance({ perfis: ["FOLHAA"] }, conhecidos)).toContain("FOLHAA");
  });

  it("avisa também de empresa, que é código e por isso fácil de errar", () => {
    expect(avisoDeAlcance({ empresas: ["070"] }, conhecidos)).toContain("070");
  });

  it("junta perfil e empresa numa frase só", () => {
    const a = avisoDeAlcance({ perfis: ["X"], empresas: ["9"] }, conhecidos)!;
    expect(a).toContain("X");
    expect(a).toContain("9");
  });

  /**
   * Usuário e matrícula NÃO entram: não há lista conhecida deles (a tela não
   * oferece seletor, de propósito), então todo valor pareceria suspeito e o
   * aviso viraria ruído garantido.
   */
  it("ignora usuário e matrícula", () => {
    expect(
      avisoDeAlcance({ usuarios: ["quem.quer.que.seja"], matriculas: ["999"] }, conhecidos),
    ).toBeNull();
  });

  it("com vocabulário vazio, todo perfil é desconhecido", () => {
    expect(avisoDeAlcance({ perfis: ["FOLHA"] }, { perfis: [], empresas: [] })).toContain("FOLHA");
  });
});
