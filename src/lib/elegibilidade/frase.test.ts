import { describe, it, expect } from "vitest";
import { resumoElegibilidade, avisoDeAlcance, nomeDoPortal } from "./frase";

/**
 * As DOZE chaves, todas vazias. A versão anterior deste fixture tinha seis, e
 * por isso nenhum teste passava pelas seis orações novas (filial, centro de
 * custo, unidade administrativa, unidade de negócio, vínculo, sindicato): a
 * frase é o que impede o admin de ler interseção como união, e metade dela não
 * era exercitada por teste nenhum.
 */
const vazio = {
  base: [],
  portal: [],
  perfil: [],
  usuario: [],
  empresa: [],
  matricula: [],
  filial: [],
  centro_custo: [],
  unidade_adm: [],
  unidade_negocio: [],
  vinculo: [],
  sindicato: [],
};

describe("resumo da elegibilidade", () => {
  it("sem restrição, afirma o alcance em vez de dizer 'nenhuma regra'", () => {
    expect(resumoElegibilidade(vazio)).toBe("Todos os usuários desta base veem este prompt.");
    // Objeto parcial (prompt antigo, sem as dimensões novas) é o mesmo caso.
    expect(resumoElegibilidade({})).toBe("Todos os usuários desta base veem este prompt.");
  });

  it("traduz o código do painel para o nome que o cliente conhece", () => {
    expect(resumoElegibilidade({ ...vazio, portal: ["PG"] })).toBe(
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
    expect(resumoElegibilidade({ ...vazio, portal: ["PG"], perfil: ["FOLHA"] })).toBe(
      "Só quem estiver no portal do Gestor e for do perfil FOLHA.",
    );
  });

  /**
   * "ou" dentro de uma dimensão, "e" entre elas. Marcar dois portais libera
   * qualquer um dos dois; o que a frase não pode sugerir é que portal e perfil
   * também sejam alternativos — eles são interseção.
   */
  it("usa 'ou' dentro da dimensão e 'e' entre dimensões", () => {
    const f = resumoElegibilidade({ ...vazio, portal: ["PG", "PO"], perfil: ["FOLHA", "RH"] });
    expect(f).toBe("Só quem estiver no portal Gestor ou Operador e for do perfil FOLHA ou RH.");
  });

  /**
   * AS DOZE NUMA FRASE SÓ, escrita por extenso aqui de propósito.
   *
   * A frase é o produto: é ela que impede quem cadastra de ler a interseção
   * como união. Conferir só "contém filial" deixaria passar oração torta,
   * ordem trocada ou conector errado — que é o defeito que essa tela existe
   * para não ter.
   */
  it("cobre as DOZE dimensões, do recorte mais largo ao mais estreito", () => {
    expect(
      resumoElegibilidade({
        base: ["leadec"],
        portal: ["PG"],
        empresa: ["700"],
        perfil: ["FOLHA"],
        usuario: ["ana.silva"],
        matricula: ["12"],
        filial: ["F1"],
        centro_custo: ["100"],
        unidade_adm: ["UA1"],
        unidade_negocio: ["UN1"],
        vinculo: ["CLT"],
        sindicato: ["SINDPD"],
      }),
    ).toBe(
      "Só quem for da base leadec, estiver no portal do Gestor, for da empresa 700, " +
        "for do perfil FOLHA, for da filial F1, for do centro de custo 100, " +
        "for da unidade administrativa UA1, for da unidade de negócio UN1, " +
        "tiver o vínculo CLT, for do sindicato SINDPD, for o usuário ana.silva " +
        "e tiver a matrícula 12.",
    );
  });

  it("prompt antigo, com só as seis dimensões originais, continua descrito por inteiro", () => {
    expect(
      resumoElegibilidade({
        base: ["leadec"],
        portal: ["PG"],
        empresa: ["700"],
        perfil: ["FOLHA"],
        usuario: ["ana.silva"],
        matricula: ["12"],
      }),
    ).toBe(
      "Só quem for da base leadec, estiver no portal do Gestor, for da empresa 700, " +
        "for do perfil FOLHA, for o usuário ana.silva e tiver a matrícula 12.",
    );
  });

  /**
   * UMA ORAÇÃO POR VEZ, para a que estiver torta aparecer sozinha.
   *
   * O artigo definido é a parte que se erra sem perceber: as irmãs dizem "for
   * DA filial", "for DO centro de custo", "tiver A matrícula", e vínculo dizia
   * "tiver vínculo CLT" — sem artigo, fora do padrão de todas as outras.
   */
  it("descreve cada uma das seis dimensões novas, sozinha", () => {
    expect(resumoElegibilidade({ ...vazio, filial: ["F1"] })).toBe("Só quem for da filial F1.");
    expect(resumoElegibilidade({ ...vazio, centro_custo: ["100"] })).toBe(
      "Só quem for do centro de custo 100.",
    );
    expect(resumoElegibilidade({ ...vazio, unidade_adm: ["UA1"] })).toBe(
      "Só quem for da unidade administrativa UA1.",
    );
    expect(resumoElegibilidade({ ...vazio, unidade_negocio: ["UN1"] })).toBe(
      "Só quem for da unidade de negócio UN1.",
    );
    expect(resumoElegibilidade({ ...vazio, vinculo: ["CLT"] })).toBe("Só quem tiver o vínculo CLT.");
    expect(resumoElegibilidade({ ...vazio, sindicato: ["SINDPD"] })).toBe(
      "Só quem for do sindicato SINDPD.",
    );
  });

  it("nas dimensões novas também é 'ou' dentro e 'e' entre", () => {
    expect(
      resumoElegibilidade({ ...vazio, centro_custo: ["100", "200"], vinculo: ["CLT", "PJ"] }),
    ).toBe("Só quem for do centro de custo 100 ou 200 e tiver o vínculo CLT ou PJ.");
  });

  it("mostra o NOME da base, não o código, quando a tela sabe traduzir", () => {
    const nomes: Record<string, string> = { leadec: "Leadec Brasil" };
    expect(resumoElegibilidade({ ...vazio, base: ["leadec"] }, (c) => nomes[c] ?? c)).toBe(
      "Só quem for da base Leadec Brasil.",
    );
  });

  it("um usuário/matrícula aparece pelo valor; vários viram contagem", () => {
    expect(resumoElegibilidade({ ...vazio, usuario: ["ana.silva"] })).toBe(
      "Só quem for o usuário ana.silva.",
    );
    expect(resumoElegibilidade({ ...vazio, usuario: ["a", "b", "c"] })).toBe(
      "Só quem estiver entre os 3 usuários listados.",
    );
    expect(resumoElegibilidade({ ...vazio, matricula: ["12"] })).toBe(
      "Só quem tiver a matrícula 12.",
    );
    expect(resumoElegibilidade({ ...vazio, matricula: ["1", "2"] })).toBe(
      "Só quem estiver entre as 2 matrículas listadas.",
    );
  });

  it("ignora item em branco em vez de produzir frase com buraco", () => {
    expect(resumoElegibilidade({ ...vazio, portal: ["PG", ""] })).toBe(
      "Só quem estiver no portal do Gestor.",
    );
    // Só brancos equivale a não restringir — é o que o banco faz.
    expect(resumoElegibilidade({ ...vazio, perfil: ["  "] })).toBe(
      "Todos os usuários desta base veem este prompt.",
    );
  });
});

describe("aviso de alcance", () => {
  const conhecidos = { perfis: ["MASTER", "PORTAL_COLAB", "FOLHA"], empresas: ["700", "1"] };

  it("cala quando tudo já foi visto", () => {
    expect(avisoDeAlcance({ perfil: ["FOLHA"], empresa: ["700"] }, conhecidos)).toBeNull();
  });

  it("não reclama de diferença de caixa — o banco também não separa", () => {
    expect(avisoDeAlcance({ perfil: ["folha"] }, conhecidos)).toBeNull();
  });

  it("nomeia o perfil suspeito, que é o ponto do aviso", () => {
    expect(avisoDeAlcance({ perfil: ["FOLHAA"] }, conhecidos)).toContain("FOLHAA");
  });

  it("avisa também de empresa, que é código e por isso fácil de errar", () => {
    expect(avisoDeAlcance({ empresa: ["070"] }, conhecidos)).toContain("070");
  });

  it("junta perfil e empresa numa frase só", () => {
    const a = avisoDeAlcance({ perfil: ["X"], empresa: ["9"] }, conhecidos)!;
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
      avisoDeAlcance({ usuario: ["quem.quer.que.seja"], matricula: ["999"] }, conhecidos),
    ).toBeNull();
  });

  it("com vocabulário vazio, todo perfil é desconhecido", () => {
    expect(avisoDeAlcance({ perfil: ["FOLHA"] }, { perfis: [], empresas: [] })).toContain("FOLHA");
  });
});
