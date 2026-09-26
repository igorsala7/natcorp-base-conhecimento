/**
 * ONTOLOGIA POR BASE — o vocabulário do cliente SOMA, e não sai da casa dele.
 *
 * Três afirmações, e as três falham em silêncio se ninguém as vigiar:
 *
 *   1. SEM BASE, NADA MUDA. O portal e o Cmd+K não passam base, e a consulta que
 *      sai tem de ser byte a byte a de antes desta rodada. O `eval-rag` mede isso
 *      pelo resultado; aqui o teste afirma o MECANISMO — a consulta por `base_id`
 *      não é nem emitida, e a RPC que resolve a base não é chamada;
 *   2. SOMA, NUNCA SUBSTITUI. Um termo do cliente que casa a mesma palavra que um
 *      termo global não rebaixa o global: os dois entram na expansão. É o mesmo
 *      desenho do roteamento de ferramentas, que toma o MAX entre o vetor por base
 *      e o global e nunca rebaixa;
 *   3. O TERMO DE UM CLIENTE NÃO ALCANÇA OUTRO. A consulta de base filtra por UM
 *      `base_id` resolvido da sessão, então o jargão do cliente A não tem caminho
 *      para a expansão do cliente B — nem para a de quem lê a documentação sem
 *      base. Vazaria informação comercial: os termos que uma empresa usa dizem o
 *      que ela faz.
 *
 * O Supabase é um GRAVADOR: registra cada consulta emitida (tabela e filtros), o
 * que permite afirmar o que NÃO aconteceu. O cache de `carregarOntologia` é por
 * conjunto de espaços + idioma + base e vive 60 s no módulo, então cada caso usa
 * IDs próprios — dois casos com a mesma chave mediriam o cache, não o código.
 */
import { describe, it, expect, vi } from "vitest";
import { expandirConsulta, expandirConsultaLexica } from "./ontology";

type TermoFake = {
  id: string;
  term: string;
  term_norm: string;
  node_id: string | null;
  space_id: string | null;
  base_id: string | null;
};
type AliasFake = { id: string; term_id: string; alias: string; alias_norm: string };

type Consulta = { tabela: string; filtros: Record<string, unknown> };

function dublarDb(dados: {
  termos: TermoFake[];
  aliases?: AliasFake[];
  /** `base_code` → id, como `public.bases_do_codigo` responderia. */
  bases?: Record<string, string>;
}) {
  const consultas: Consulta[] = [];
  const rpcs: { fn: string; args: unknown }[] = [];
  const aliases = dados.aliases ?? [];

  function construir(tabela: string) {
    const c: Consulta = { tabela, filtros: {} };
    consultas.push(c);
    const listas: Record<string, unknown[]> = {};

    const casam = (): unknown[] => {
      const fonte: unknown[] =
        tabela === "ontology_terms" ? dados.termos : tabela === "ontology_aliases" ? aliases : [];
      return fonte.filter((linha) => {
        const l = linha as Record<string, unknown>;
        return (
          Object.entries(c.filtros).every(([campo, valor]) => l[campo] === valor) &&
          Object.entries(listas).every(([campo, valores]) => valores.includes(l[campo]))
        );
      });
    };

    const q: Record<string, unknown> = {
      select: () => q,
      eq: (campo: string, valor: unknown) => {
        c.filtros[campo] = valor;
        return q;
      },
      filter: (campo: string, _op: string, valor: unknown) => {
        c.filtros[campo] = valor;
        return q;
      },
      in: (campo: string, valores: unknown[]) => {
        listas[campo] = valores;
        return q;
      },
      order: () => q,
      range: (de: number, ate: number) => Promise.resolve({ data: casam().slice(de, ate + 1), error: null }),
      // `spaces` é lido sem `range` (o await cai direto no builder).
      then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: [], error: null }),
    };
    return q;
  }

  return {
    db: {
      from: (tabela: string) => construir(tabela),
      rpc: (fn: string, args: unknown) => {
        rpcs.push({ fn, args });
        const codigo = String((args as { p_base?: string }).p_base ?? "").trim();
        const id = dados.bases?.[codigo];
        return Promise.resolve({ data: id ? [id] : [], error: null });
      },
    },
    consultas,
    rpcs,
  };
}

const ESPACO = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const BASE_A = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const BASE_B = "cccccccc-3333-4333-8333-cccccccccccc";

/** Termo da documentação da Natcorp (compartilhado) e termo do cliente A. */
function termos(espacoId: string): TermoFake[] {
  return [
    { id: "t-global", term: "Requisição de Baliza", term_norm: "requisicao de baliza", node_id: null, space_id: espacoId, base_id: null },
    { id: "t-cliente", term: "Ficha Amarela", term_norm: "ficha amarela", node_id: null, space_id: null, base_id: BASE_A },
  ];
}

const ALIASES: AliasFake[] = [
  { id: "a1", term_id: "t-global", alias: "baliza", alias_norm: "baliza" },
  { id: "a2", term_id: "t-cliente", alias: "baliza", alias_norm: "baliza" },
];

describe("sem base, a expansão é a de sempre", () => {
  it("não emite consulta por base_id nem resolve base nenhuma", async () => {
    const espaco = `${ESPACO}-sem-base`;
    const { db, consultas, rpcs } = dublarDb({ termos: termos(espaco), aliases: ALIASES });

    const r = await expandirConsulta(db as never, [espaco], "como abro uma baliza?");

    // O termo do espaço expande...
    expect(r.lexica).toContain("Requisição de Baliza");
    // ...e o do cliente não existe para quem não passou base.
    expect(r.lexica).not.toContain("Ficha Amarela");
    // O mecanismo: nenhuma consulta filtrou `base_id`, e a RPC não foi chamada.
    expect(consultas.some((c) => "base_id" in c.filtros)).toBe(false);
    expect(rpcs).toHaveLength(0);
  });
});

describe("com base, o vocabulário do cliente SOMA ao global", () => {
  it("os dois termos entram — o global não é rebaixado nem substituído", async () => {
    const espaco = `${ESPACO}-soma`;
    const { db, consultas, rpcs } = dublarDb({
      termos: termos(espaco),
      aliases: ALIASES,
      bases: { "cliente-a": BASE_A },
    });

    const r = await expandirConsulta(db as never, [espaco], "como abro uma baliza?", null, "cliente-a");

    expect(r.lexica).toContain("Requisição de Baliza");
    expect(r.lexica).toContain("Ficha Amarela");
    // A base foi resolvida pela MESMA função que a cerca de propriedade usa.
    expect(rpcs.map((x) => x.fn)).toEqual(["bases_do_codigo"]);
    // E a consulta do cliente filtrou pelo id resolvido, não pelo código.
    expect(consultas.filter((c) => c.filtros.base_id === BASE_A)).toHaveLength(1);
  });

  it("`expandirConsultaLexica` segue o mesmo caminho", async () => {
    const espaco = `${ESPACO}-lexica`;
    const { db } = dublarDb({ termos: termos(espaco), aliases: ALIASES, bases: { "cliente-a": BASE_A } });

    const lexica = await expandirConsultaLexica(db as never, [espaco], "como abro uma baliza?", null, "cliente-a");

    expect(lexica).toContain("Requisição de Baliza");
    expect(lexica).toContain("Ficha Amarela");
  });
});

describe("o termo de um cliente não alcança outro", () => {
  it("o cliente B não recebe o vocabulário do cliente A", async () => {
    const espaco = `${ESPACO}-outro-cliente`;
    const { db, consultas } = dublarDb({
      termos: termos(espaco),
      aliases: ALIASES,
      bases: { "cliente-b": BASE_B },
    });

    const r = await expandirConsulta(db as never, [espaco], "como abro uma baliza?", null, "cliente-b");

    // O global continua valendo para todo mundo...
    expect(r.lexica).toContain("Requisição de Baliza");
    // ...e o jargão do vizinho não aparece. O filtro é na CONSULTA, nunca no prompt.
    expect(r.lexica).not.toContain("Ficha Amarela");
    expect(consultas.filter((c) => c.filtros.base_id === BASE_B)).toHaveLength(1);
    expect(consultas.some((c) => c.filtros.base_id === BASE_A)).toBe(false);
  });

  it("base desconhecida degrada para a ontologia dos espaços, sem quebrar a busca", async () => {
    const espaco = `${ESPACO}-base-desconhecida`;
    const { db, consultas } = dublarDb({ termos: termos(espaco), aliases: ALIASES, bases: {} });

    const r = await expandirConsulta(db as never, [espaco], "como abro uma baliza?", null, "cliente-fantasma");

    expect(r.lexica).toContain("Requisição de Baliza");
    expect(r.lexica).not.toContain("Ficha Amarela");
    // Sem id resolvido, a segunda consulta não é emitida: nada de `base_id` nulo
    // varrendo o vocabulário de todos os clientes.
    expect(consultas.some((c) => "base_id" in c.filtros)).toBe(false);
  });

  it("código que resolve mais de uma base não expande nada por base (e diz por quê)", async () => {
    const espaco = `${ESPACO}-ambigua`;
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const dup = dublarDb({ termos: termos(espaco), aliases: ALIASES });
    const db = {
      ...dup.db,
      rpc: () => Promise.resolve({ data: [BASE_A, BASE_B], error: null }),
    };

    const r = await expandirConsulta(db as never, [espaco], "como abro uma baliza?", null, "cliente-duplicado");

    // Escolher uma no escuro daria ao cliente A o vocabulário do B.
    expect(r.lexica).not.toContain("Ficha Amarela");
    expect(erro).toHaveBeenCalled();
    erro.mockRestore();
  });
});
