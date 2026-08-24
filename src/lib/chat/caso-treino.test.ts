import { describe, it, expect } from "vitest";
import { temDecisaoParaRotular, linhaDoCaso } from "./caso-treino";
import type { TracePasso } from "./trace";

/**
 * O que importa medir aqui é o FILTRO, porque ele decide o que uma pessoa vai
 * ter de olhar. Filtro frouxo demais enche a fila de "Olá" — 574 de 1.402
 * turnos (41%) repetem uma pergunta anterior. Filtro apertado demais perde
 * justamente o caso mais valioso: ferramenta na mesa e NENHUMA chamada, que é o
 * veredito `devia_chamar` e o maior grupo de erro do gabarito (30 de 138).
 */
const passo = (nome: string, info: Record<string, unknown>): TracePasso => ({ ms: 0, passo: nome, info });

describe("temDecisaoParaRotular", () => {
  it("turno com ferramenta de integração na mesa: entra", () => {
    expect(temDecisaoParaRotular([passo("ferramentas", { tools: ["consultar_ferias", "destacar_tela"] })])).toBe(true);
  });

  it("turno SÓ com ferramenta de tela: fica de fora — não houve escolha de catálogo", () => {
    expect(temDecisaoParaRotular([
      passo("ferramentas", { tools: ["destacar_tela", "consultar_registros", "agrupar", "gerar_relatorio"] }),
    ])).toBe(false);
  });

  it("turno sem passo de ferramentas (saudação): fica de fora", () => {
    expect(temDecisaoParaRotular([passo("fim", { desfecho: "resposta" })])).toBe(false);
  });

  it("O CASO QUE NÃO PODE ESCAPAR: ferramenta na mesa e nenhuma chamada", () => {
    // É o `devia_chamar`. Um filtro por "chamou alguma coisa" o perderia inteiro.
    expect(temDecisaoParaRotular([passo("ferramentas", { tools: ["linha_tempo"] })])).toBe(true);
  });
});

describe("linhaDoCaso", () => {
  const base = {
    spaceId: "s1", pergunta: "Ao tony mesmo", baseCode: "NATCORP",
    perfil: "MASTER", portal: "PO", conversationId: "c1", traceId: "t1",
  };

  it("entra com veredito NULO — quem rotula é gente", () => {
    const l = linhaDoCaso({ ...base, passos: [passo("ferramentas", { tools: ["linha_tempo"] })] });
    expect(l.veredito).toBeNull();
    expect(l.origem).toBe("runtime");
  });

  it("guarda o elo com o trace e a conversa", () => {
    const l = linhaDoCaso({ ...base, passos: [] });
    expect(l.trace_id).toBe("t1");
    expect(l.conversation_id).toBe("c1");
  });

  /**
   * A NOTA E A POSIÇÃO — o que a tabela previa desde 17/08 e nunca recebeu.
   *
   * Um caso rotulado `tool_errada` sem isto não diz qual conserto aplicar: a
   * certa pode ter perdido por 0,01 (desempate) ou estar em 40º (embedding).
   */
  it("oferecidas levam nota e posição; cortadas viram registro próprio", () => {
    const l = linhaDoCaso({
      ...base,
      passos: [
        passo("ferramentas", { tools: ["bi_avaliacoes", "gerar_relatorio"] }),
        passo("integracoes:ranking", { rank: [["bi_avaliacoes", 0.81], ["consultar_feedback", 0.74], ["consultar_ferias", 0.4]] }),
      ],
    });
    expect(l.oferecidas).toEqual([
      { tool: "bi_avaliacoes", sim: 0.81, pos: 1 },
      // Local: não disputa vaga por similaridade, então NULO — não zero.
      { tool: "gerar_relatorio", sim: null, pos: null },
    ]);
    expect(l.cortadas).toEqual([
      { tool: "consultar_feedback", sim: 0.74, pos: 2 },
      { tool: "consultar_ferias", sim: 0.4, pos: 3 },
    ]);
  });

  it("turno sem ranking (modo lexical) não inventa nota nem cortadas", () => {
    const l = linhaDoCaso({ ...base, passos: [passo("ferramentas", { tools: ["linha_tempo"] })] });
    expect(l.oferecidas).toEqual([{ tool: "linha_tempo", sim: null, pos: null }]);
    expect(l.cortadas).toEqual([]);
  });

  it("normaliza a base para minúsculas — 'NATCORP' e 'natcorp' são o mesmo cliente", () => {
    expect(linhaDoCaso({ ...base, passos: [] }).base_code).toBe("natcorp");
  });

  it("a primeira chamada vai em tool_escolhida; as demais não se perdem", () => {
    const l = linhaDoCaso({
      ...base,
      passos: [
        passo("ferramentas", { tools: ["bi_avaliacoes", "consultar_ferias"] }),
        passo("tool_call", { tool: "bi_avaliacoes" }),
        passo("tool_call", { tool: "consultar_ferias" }),
      ],
    });
    expect(l.tool_escolhida).toBe("bi_avaliacoes");
    expect(l.parametros).toEqual({ todas_as_chamadas: ["bi_avaliacoes", "consultar_ferias"] });
  });

  it("chamada única não infla o campo de parâmetros", () => {
    const l = linhaDoCaso({ ...base, passos: [passo("tool_call", { tool: "meus_dados" })] });
    expect(l.tool_escolhida).toBe("meus_dados");
    expect(l.parametros).toBeNull();
  });

  it("registra o tamanho da tela — é o que separa 'devia olhar o relatório' de 'não tinha relatório'", () => {
    const l = linhaDoCaso({
      ...base,
      passos: [passo("dataset:registro", { itens: [{ id: "tela1", linhas: 10 }, { id: "tela2", linhas: 380 }] })],
    });
    expect(l.tela).toBe("tela1:10l tela2:380l");
  });

  it("sem tela, o campo fica nulo em vez de string vazia", () => {
    expect(linhaDoCaso({ ...base, passos: [] }).tela).toBeNull();
  });

  it("NÃO grava curl — ele recolocaria a identidade que o esquema deixou de fora", () => {
    const l = linhaDoCaso({ ...base, passos: [passo("tool_call", { tool: "x", curl: "curl -H 'x-matricula: 205818'" })] });
    expect(l).not.toHaveProperty("curl");
    expect(JSON.stringify(l)).not.toContain("205818");
  });
});
