/**
 * ONTOLOGIA POR BASE — o vocabulário do cliente SOMA, e não sai da casa dele.
 *
 * Quatro afirmações, e as quatro falham em silêncio se ninguém as vigiar:
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
 *   4. A CHAVE DO CACHE É O `base_id`, NUNCA O CÓDIGO. Duas bases que só diferem
 *      por um branco que o JavaScript apara e o banco não (o BOM) são bases
 *      DISTINTAS, e dentro de um processo Node o cache de módulo era o caminho
 *      curto entre o vocabulário de uma e o turno da outra.
 *
 * O Supabase é um GRAVADOR: registra cada consulta emitida (tabela e filtros), o
 * que permite afirmar o que NÃO aconteceu. Há DOIS caches de módulo, os dois de
 * 60 s: o da ontologia (espaços + idioma + `base_id`) e o de código→`base_id`.
 * Então cada caso usa IDs de espaço E códigos de base próprios — dois casos que
 * compartilhem qualquer um dos dois mediriam o cache, não o código.
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

/**
 * `public.codigo_normalizado`, tal como está em produção:
 * `lower(btrim(p_codigo, ' ' || chr(9) || chr(10) || chr(13) || chr(160)))`.
 *
 * O dublê tem de aparar os CINCO caracteres e nenhum a mais. Um dublê que usasse
 * `String.prototype.trim()` aparia também o BOM e o tab vertical, e aí o caso do
 * BOM abaixo passaria por acidente — mediria o dublê, não o código.
 */
const BRANCOS_DO_BTRIM = " \\t\\n\\r\\u00a0";
function codigoNormalizado(s: string): string {
  return s
    .replace(new RegExp(`^[${BRANCOS_DO_BTRIM}]+`), "")
    .replace(new RegExp(`[${BRANCOS_DO_BTRIM}]+$`), "")
    .toLowerCase();
}

function dublarDb(dados: {
  termos: TermoFake[];
  aliases?: AliasFake[];
  /** `base_code` → id, comparado como `public.bases_do_codigo` compararia. */
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
        // Compara como `bases_do_codigo` compara: os DOIS lados por
        // `codigo_normalizado`. Nada de `.trim()` do JavaScript aqui — era ele,
        // no código de verdade, que fazia `acme` e `acme`+BOM virarem a mesma base.
        const pedido = codigoNormalizado(String((args as { p_base?: string }).p_base ?? ""));
        const achados = Object.entries(dados.bases ?? {})
          .filter(([codigo]) => codigoNormalizado(codigo) === pedido)
          .map(([, id]) => id);
        return Promise.resolve({ data: achados, error: null });
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

describe("a chave do cache é o `base_id`, nunca o código", () => {
  /*
    O CASO QUE DERRUBAVA A CERCA DENTRO DO PROCESSO.

    A chave era montada com `base.trim().toLowerCase()`, e o `.trim()` do
    JavaScript apara todo branco Unicode — o BOM (U+FEFF) incluído. O `btrim` do
    `codigo_normalizado` apara CINCO caracteres e não apara o BOM, e o CHECK
    `ai_bases_codigo_nao_branco` usa justamente ele: `acme` e `acme`+BOM são duas
    bases legais, com ids diferentes e vocabulários diferentes.

    Com a chave aparada pelo JavaScript as duas caíam na MESMA entrada (mesmos
    espaços, mesmo idioma — o caso comum, porque os clientes compartilham a
    documentação global), e quem chegasse depois recebia o jargão interno do
    vizinho por até 60 s, na expansão léxica e no enriquecimento do vetor.

    Este caso roda as duas bases em sequência, de propósito: é a sequência que
    produzia o vazamento. O `Map` do cache é de MÓDULO, então a segunda chamada
    enxerga o que a primeira gravou.
  */
  const COM_BOM = "acme\uFEFF";

  it("duas bases que só diferem por um BOM recebem vocabulários diferentes", async () => {
    const espaco = `${ESPACO}-bom`;
    const { db, consultas } = dublarDb({
      termos: [
        { id: "t-global", term: "Requisição de Baliza", term_norm: "requisicao de baliza", node_id: null, space_id: espaco, base_id: null },
        { id: "t-acme", term: "Ficha Amarela", term_norm: "ficha amarela", node_id: null, space_id: null, base_id: BASE_A },
        { id: "t-acme-bom", term: "Guia Roxa", term_norm: "guia roxa", node_id: null, space_id: null, base_id: BASE_B },
      ],
      aliases: [
        { id: "a1", term_id: "t-global", alias: "baliza", alias_norm: "baliza" },
        { id: "a2", term_id: "t-acme", alias: "baliza", alias_norm: "baliza" },
        { id: "a3", term_id: "t-acme-bom", alias: "baliza", alias_norm: "baliza" },
      ],
      bases: { acme: BASE_A, [COM_BOM]: BASE_B },
    });

    const primeira = await expandirConsulta(db as never, [espaco], "como abro uma baliza?", null, "acme");
    const segunda = await expandirConsulta(db as never, [espaco], "como abro uma baliza?", null, COM_BOM);

    // Cada uma vê o global e o PRÓPRIO jargão — e nada do vizinho.
    expect(primeira.lexica).toContain("Ficha Amarela");
    expect(primeira.lexica).not.toContain("Guia Roxa");
    expect(segunda.lexica).toContain("Guia Roxa");
    expect(segunda.lexica).not.toContain("Ficha Amarela");
    expect(primeira.lexica).toContain("Requisição de Baliza");
    expect(segunda.lexica).toContain("Requisição de Baliza");

    // O mecanismo: DUAS consultas por base, uma para cada id. Com a chave antiga
    // a segunda nem era emitida — o cache respondia com os termos da primeira.
    expect(consultas.filter((c) => c.filtros.base_id === BASE_A)).toHaveLength(1);
    expect(consultas.filter((c) => c.filtros.base_id === BASE_B)).toHaveLength(1);
  });

  it("o mesmo código no mesmo minuto não resolve a base duas vezes", async () => {
    // A resolução passou a vir ANTES da chave, então ela roda também nos acertos
    // do cache. O cache de código→id é o que impede uma ida ao banco por busca.
    const espaco = `${ESPACO}-cache-id`;
    const { db, rpcs } = dublarDb({ termos: termos(espaco), aliases: ALIASES, bases: { "cliente-cacheado": BASE_A } });

    await expandirConsulta(db as never, [espaco], "como abro uma baliza?", null, "cliente-cacheado");
    await expandirConsulta(db as never, [espaco], "e a baliza do mês?", null, "cliente-cacheado");

    expect(rpcs.filter((r) => r.fn === "bases_do_codigo")).toHaveLength(1);
  });

  it("FALHA de leitura não fica colada: a próxima busca tenta de novo", async () => {
    // Cachear o erro tiraria o vocabulário do cliente por 60 s por causa de uma
    // queda de um segundo. Só a RESPOSTA do banco é cacheada.
    const espaco = `${ESPACO}-erro-nao-cola`;
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const base = dublarDb({ termos: termos(espaco), aliases: ALIASES, bases: { "cliente-erro": BASE_A } });
    let chamadas = 0;
    const db = {
      ...base.db,
      rpc: (fn: string, args: unknown) => {
        chamadas += 1;
        if (chamadas === 1) return Promise.resolve({ data: null, error: { message: "conexão caiu" } });
        return (base.db.rpc as (f: string, a: unknown) => Promise<unknown>)(fn, args);
      },
    };

    const caiu = await expandirConsulta(db as never, [espaco], "como abro uma baliza?", null, "cliente-erro");
    const voltou = await expandirConsulta(db as never, [espaco], "outra baliza agora", null, "cliente-erro");

    expect(caiu.lexica).not.toContain("Ficha Amarela");
    expect(voltou.lexica).toContain("Ficha Amarela");
    expect(chamadas).toBe(2);
    expect(erro).toHaveBeenCalled();
    erro.mockRestore();
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
