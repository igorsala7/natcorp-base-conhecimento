import { describe, it, expect } from "vitest";
import {
  lerMemoria,
  nosParaBoost,
  atualizarMemoria,
  TETO_MEMORIA,
  JANELA_TURNOS,
  type EntradaMemoria,
} from "./rag-memoria";

const e = (node_id: string | null, turno: number, document_id: string | null = null): EntradaMemoria => ({
  node_id,
  document_id,
  turno,
});

describe("lerMemoria", () => {
  it("lê o formato normal", () => {
    expect(lerMemoria([{ node_id: "a", document_id: null, turno: 2 }])).toEqual([
      { node_id: "a", document_id: null, turno: 2 },
    ]);
  });

  it("tolera lixo sem quebrar — perder continuidade é aceitável, quebrar não é", () => {
    expect(lerMemoria(null)).toEqual([]);
    expect(lerMemoria("nada disso")).toEqual([]);
    expect(lerMemoria([null, 42, "x", {}])).toEqual([]);
  });

  it("descarta entrada sem identidade", () => {
    expect(lerMemoria([{ node_id: null, document_id: null, turno: 1 }])).toEqual([]);
  });

  it("turno ausente ou inválido vira 0 — envelhece na primeira limpeza", () => {
    expect(lerMemoria([{ node_id: "a" }, { node_id: "b", turno: NaN }])).toEqual([
      { node_id: "a", document_id: null, turno: 0 },
      { node_id: "b", document_id: null, turno: 0 },
    ]);
  });
});

describe("nosParaBoost", () => {
  it("devolve só o que está dentro da janela", () => {
    const mem = [e("recente", 5), e("limite", 3), e("velho", 2)];
    // turno 5, janela 3 → sobrevive quem entrou nos turnos 3, 4 e 5
    expect(nosParaBoost(mem, 5)).toEqual(["recente", "limite"]);
  });

  it("ignora entradas que são documento (não têm nó para priorizar)", () => {
    expect(nosParaBoost([e(null, 5, "doc-1")], 5)).toEqual([]);
  });

  it("memória vazia devolve vazio", () => {
    expect(nosParaBoost([], 3)).toEqual([]);
  });
});

describe("atualizarMemoria", () => {
  it("acrescenta o que foi recuperado agora", () => {
    const out = atualizarMemoria([], [{ node_id: "a", document_id: null }], 1);
    expect(out).toEqual([{ node_id: "a", document_id: null, turno: 1 }]);
  });

  it("RENOVA o turno de quem reapareceu — é como um trecho recorrente sobrevive", () => {
    const out = atualizarMemoria([e("a", 1)], [{ node_id: "a", document_id: null }], 4);
    expect(out).toEqual([{ node_id: "a", document_id: null, turno: 4 }]);
  });

  it("descarta quem saiu da janela e não reapareceu", () => {
    const out = atualizarMemoria([e("velho", 1), e("novo", 3)], [], 4);
    expect(out.map((x) => x.node_id)).toEqual(["novo"]);
  });

  it("não duplica quando o mesmo nó vem duas vezes no mesmo turno", () => {
    const out = atualizarMemoria(
      [],
      [
        { node_id: "a", document_id: null },
        { node_id: "a", document_id: null },
      ],
      1,
    );
    expect(out).toHaveLength(1);
  });

  it("artigo e documento com o mesmo id são entradas distintas", () => {
    const out = atualizarMemoria(
      [],
      [
        { node_id: "x", document_id: null },
        { node_id: null, document_id: "x" },
      ],
      1,
    );
    expect(out).toHaveLength(2);
  });

  it("aplica o teto, mantendo os turnos mais recentes", () => {
    const muitos = Array.from({ length: TETO_MEMORIA + 5 }, (_, i) => ({
      node_id: `n${i}`,
      document_id: null,
    }));
    const out = atualizarMemoria([], muitos, 1);
    expect(out).toHaveLength(TETO_MEMORIA);
  });

  it("o recente vence o antigo quando o teto aperta", () => {
    const antigos = Array.from({ length: TETO_MEMORIA }, (_, i) => e(`velho${i}`, 3));
    const out = atualizarMemoria(antigos, [{ node_id: "novissimo", document_id: null }], 4);
    expect(out[0]!.node_id).toBe("novissimo");
    expect(out).toHaveLength(TETO_MEMORIA);
  });

  it("ignora recuperado sem identidade", () => {
    expect(atualizarMemoria([], [{ node_id: null, document_id: null }], 1)).toEqual([]);
  });

  it("não muta a entrada", () => {
    const mem = [e("a", 1)];
    const copia = JSON.parse(JSON.stringify(mem));
    atualizarMemoria(mem, [{ node_id: "b", document_id: null }], 2);
    expect(mem).toEqual(copia);
  });

  it("a janela é a mesma usada pelo boost — as duas pontas precisam concordar", () => {
    const mem = [e("a", 1)];
    const turnoLimite = 1 + JANELA_TURNOS - 1;
    expect(nosParaBoost(mem, turnoLimite)).toEqual(["a"]);
    expect(atualizarMemoria(mem, [], turnoLimite).map((x) => x.node_id)).toEqual(["a"]);
    expect(nosParaBoost(mem, turnoLimite + 1)).toEqual([]);
    expect(atualizarMemoria(mem, [], turnoLimite + 1)).toEqual([]);
  });
});
