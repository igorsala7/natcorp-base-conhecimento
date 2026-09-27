/**
 * MESCLAGEM DE TERMOS — o que é PERDIDO tem de aparecer em algum lugar.
 *
 * O número que esta função devolve (`found`) é o que a tela mostra ao cliente
 * depois de ele marcar "extrair vocabulário" e pagar a chamada de IA. Enquanto o
 * `insert` era lido como `if (!novo) continue`, um termo perdido era
 * indistinguível de um termo que já existia: nenhum log, nenhum contador, e o
 * número menor que a extração sem nada explicando.
 *
 * Três afirmações:
 *
 *   1. `unique_violation` quer dizer que o conceito EXISTE — relê o id e segue com
 *      ele. O `continue` antigo descartava também os sinônimos novos atrelados
 *      àquele conceito, que são a razão de a varredura ter sido pedida;
 *   2. falha que NÃO é colisão é registrada, com o dono e o `term_norm` — e nunca
 *      com o termo nem com a descrição, que são conteúdo do cliente;
 *   3. `found` conta o que não deu erro — não o que foi de fato INSERIDO. O
 *      `upsert` de alias usa `ignoreDuplicates: true` e o retorno não distingue
 *      "gravei" de "já existia, ignorei": um sinônimo que já estava lá também
 *      soma. O que fica de fora é só o que falhou de verdade (erro no
 *      `insert`/`upsert`, ou colisão sem id para pendurar os sinônimos).
 */
import { describe, it, expect, vi } from "vitest";
import { mesclarTermos, type TermoAcumulado } from "./ontology-merge";

const BASE = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";

type Chamada = { tabela: string; op: string; filtros: Record<string, unknown> };

/**
 * Dublê do PostgREST com o bastante para esta função: a leitura paginada, o
 * `insert ... select single`, a releitura por `term_norm` e o `upsert` de alias.
 *
 * `erros` diz qual operação falha e com qual código — é assim que os casos
 * injetam a colisão e a queda.
 */
function dublarDb(opts: {
  /** Termos que a leitura inicial devolve. */
  existentes?: { id: string; term_norm: string; description: string | null }[];
  /** Termos que EXISTEM no banco mas não na leitura (a corrida). */
  invisiveis?: { id: string; term_norm: string; description: string | null }[];
  erroNoInsert?: { code?: string; message: string } | null;
  erroNoUpsert?: { message: string } | null;
}) {
  const chamadas: Chamada[] = [];
  const inseridos: Record<string, unknown>[] = [];
  const aliasesGravados: { term_id: string; alias_norm: string }[] = [];
  const existentes = opts.existentes ?? [];
  const invisiveis = opts.invisiveis ?? [];

  function construir(tabela: string) {
    const c: Chamada = { tabela, op: "select", filtros: {} };
    chamadas.push(c);
    let corpo: Record<string, unknown> | null = null;

    const q: Record<string, unknown> = {
      select: () => q,
      insert: (linha: Record<string, unknown>) => {
        c.op = "insert";
        corpo = linha;
        return q;
      },
      update: (linha: Record<string, unknown>) => {
        c.op = "update";
        corpo = linha;
        return q;
      },
      upsert: (linha: Record<string, unknown>) => {
        c.op = "upsert";
        if (opts.erroNoUpsert) return Promise.resolve({ data: null, error: opts.erroNoUpsert });
        aliasesGravados.push(linha as { term_id: string; alias_norm: string });
        return Promise.resolve({ data: null, error: null });
      },
      eq: (campo: string, valor: unknown) => {
        c.filtros[campo] = valor;
        return q;
      },
      filter: (campo: string, _op: string, valor: unknown) => {
        c.filtros[campo] = valor;
        return q;
      },
      in: (campo: string, valores: unknown[]) => {
        c.filtros[campo] = valores;
        return Promise.resolve({ data: [], error: null });
      },
      order: () => q,
      range: (de: number, ate: number) =>
        Promise.resolve({ data: existentes.slice(de, ate + 1), error: null }),
      single: () => {
        if (opts.erroNoInsert) return Promise.resolve({ data: null, error: opts.erroNoInsert });
        const id = `novo-${inseridos.length + 1}`;
        inseridos.push({ ...(corpo ?? {}), id });
        return Promise.resolve({ data: { id }, error: null });
      },
      maybeSingle: () => {
        const norm = String(c.filtros.term_norm ?? "");
        const achado = invisiveis.find((t) => t.term_norm === norm) ?? null;
        return Promise.resolve({ data: achado, error: null });
      },
      then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
        resolve({ data: [], error: null }),
    };
    return q;
  }

  return { db: { from: (t: string) => construir(t) }, chamadas, inseridos, aliasesGravados };
}

function acumulado(term: string, aliases: string[]): Map<string, TermoAcumulado> {
  return new Map([
    [term.toLowerCase(), { term, kind: "conceito", description: null, aliases: new Set(aliases) }],
  ]);
}

const OPTS = { source: "ia", createdBy: null };

describe("colisão de chave única não descarta o conceito", () => {
  it("relê o id e grava os sinônimos no termo que já existia", async () => {
    const { db, aliasesGravados, chamadas } = dublarDb({
      // A leitura não viu o termo (teto de linhas, ou outra varredura gravou depois).
      existentes: [],
      invisiveis: [{ id: "t-existente", term_norm: "ficha amarela", description: null }],
      erroNoInsert: { code: "23505", message: "duplicate key value violates unique constraint" },
    });

    const found = await mesclarTermos(
      db as never,
      { baseId: BASE },
      acumulado("Ficha Amarela", ["FA", "ficha"]),
      OPTS,
    );

    // Os dois sinônimos foram para o termo que já existia...
    expect(aliasesGravados.map((a) => a.alias_norm).sort()).toEqual(["fa", "ficha"]);
    expect(aliasesGravados.every((a) => a.term_id === "t-existente")).toBe(true);
    // ...e o `found` conta só eles: o termo não é novo.
    expect(found).toBe(2);
    // A releitura usou o DONO e o `term_norm` — nunca `id` cru, que alcançaria
    // termo de outro cliente.
    const releitura = chamadas.find((c) => c.filtros.term_norm === "ficha amarela");
    expect(releitura?.filtros.base_id).toBe(BASE);
  });
});

describe("falha que não é colisão vira log, e o log não leva conteúdo do cliente", () => {
  it("registra o dono e o term_norm, e não o termo nem a descrição", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db, aliasesGravados } = dublarDb({
      erroNoInsert: { code: "42501", message: "permission denied for table ontology_terms" },
    });

    const found = await mesclarTermos(
      db as never,
      { baseId: BASE },
      new Map([
        [
          "ficha amarela",
          {
            term: "Ficha Amarela",
            kind: "conceito",
            description: "O documento que o RH do cliente chama assim.",
            aliases: new Set(["FA"]),
          },
        ],
      ]),
      OPTS,
    );

    expect(found).toBe(0);
    expect(aliasesGravados).toHaveLength(0);
    const linha = erro.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(linha).toContain("term_norm=\"ficha amarela\"");
    expect(linha).toContain(BASE);
    expect(linha).toContain("permission denied");
    // O conteúdo do cliente fica fora: o log do servidor é lido por quem opera a
    // plataforma, e o `term_norm` já basta para achar a linha.
    expect(linha).not.toContain("O documento que o RH do cliente chama assim.");
    erro.mockRestore();
  });

  it("sinônimo que falhou não entra no número que a tela mostra", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = dublarDb({ erroNoUpsert: { message: "deadlock detected" } });

    // O termo novo conta 1; os dois sinônimos falharam e não contam.
    const found = await mesclarTermos(db as never, { baseId: BASE }, acumulado("Guia Roxa", ["GR", "guia"]), OPTS);

    expect(found).toBe(1);
    expect(erro).toHaveBeenCalled();
    erro.mockRestore();
  });
});
