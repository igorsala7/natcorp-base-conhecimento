/**
 * Tarefa 7, rodada de correção 1, item obrigatório 3: nada do lado
 * TypeScript protegia as QUATRO chamadas às RPCs cercadas
 * (`hybrid_search_scoped` × 3 + `knowledge_list_chunks` × 1) de perder
 * `p_base` num refactor. `verificar:isolamento` testa as funções SQL
 * direto — não as chamadas — então tirar `p_base` de uma delas (ex.:
 * `knowledge_list_chunks`, o caminho de 40 chunks) reabriria o buraco
 * sem derrubar NENHUM gate.
 *
 * Este teste dubla o cliente Supabase e força o fluxo de `retrieveWith`
 * a passar pelos quatro caminhos que chamam RPC (principal, vínculo
 * termo→artigo "forçado", continuidade "lembrada", e enumeração), e
 * afirma que TODOS os quatro payloads carregam `p_base`.
 *
 * ── O que a tarefa 9 mudou aqui, e por que os casos foram reescritos ─────
 * A versão original amarrava `p_base` a `origem === "base"` e afirmava que
 * `origem === "chave"` NÃO carregava `p_base`. Com a união de escopos
 * (25/09), `origem` deixou de dizer "de onde vem o escopo" e passou a ser
 * informativa, e manter aquela amarra desligaria a cerca justamente no
 * cliente que não configurou nada — quem mais precisa dela. A cerca é de
 * PROPRIEDADE: recusa só chunk de ARQUIVO cujo `base_id` é de outra base, e
 * chunk de artigo e de documento de espaço passam sempre, então ela não corta
 * nada que chegue pelo escopo da chave.
 *
 * Os casos passaram a ser, então: `p_base` vai nos dois valores de `origem`,
 * e NÃO vai quando não há base nenhuma (portal, Cmd+K, editor).
 *
 * Doublagem ampla de propósito: `retrievePublicContext` é a única função
 * exportada que toca as quatro chamadas, e ela arrasta consigo embedding,
 * ontologia, cache e árvore efetiva. Escopar a busca por `scope.documentId`
 * e por espaços VAZIOS (o mock de `resolverEscopoDaBase` devolve
 * `spaceIds: []` nos dois cenários) evita precisar dublar
 * `getEffectiveTreePublic`/`spaceContext` — o teste teria mais massa e
 * menos foco no que a rodada pediu.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Dublês dos módulos que `rag.ts` importa no topo ──────────────────────
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/content/overlays", () => ({
  getEffectiveTreeAdmin: vi.fn(async () => []),
  getEffectiveTreePublic: vi.fn(async () => []),
}));
vi.mock("@/lib/content/slug", () => ({
  slugify: (s: string) => s,
}));
vi.mock("@/lib/blocks/serialize", () => ({
  firstImageOf: () => null,
}));
vi.mock("@/lib/ai/ontology", () => ({
  expandirConsulta: vi.fn(),
}));
vi.mock("@/lib/ai/answer-style", () => ({
  pedeEnumeracao: () => true,
  limparConsultaLista: (q: string) => q,
}));
vi.mock("@/lib/ai/escopo-da-base", () => ({
  resolverEscopoDaBase: vi.fn(),
}));
vi.mock("@/lib/ai/config", () => ({
  embeddingModel: vi.fn(),
  embeddingCallOptions: vi.fn(),
  hasEmbeddingKey: vi.fn(async () => false),
  aiTimeout: vi.fn(),
}));
vi.mock("ai", () => ({ embed: vi.fn() }));
vi.mock("@/lib/cache/kv", () => ({
  kvGetJson: vi.fn(async () => null),
  kvSetJson: vi.fn(),
  hashKey: vi.fn(() => "chave"),
}));

import { retrievePublicContext } from "./rag";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTreePublic } from "@/lib/content/overlays";
import { resolverEscopoDaBase } from "@/lib/ai/escopo-da-base";
import { expandirConsulta } from "@/lib/ai/ontology";

type Chamada = { nome: string; args: Record<string, unknown> };

/**
 * Query builder mínimo, encadeável e "thenable", parametrizado pelas linhas que
 * a tabela devolve. Ganhou `order`/`range` com a tarefa 13: a consulta de
 * `knowledge_documents` passou a ser PAGINADA (teto de 1.000 linhas do
 * PostgREST), e um dublê sem esses dois métodos falharia com "não é função" em
 * vez de medir o que o teste mede.
 *
 * `range` devolve TODAS as linhas na primeira fatia e vazio depois, o que é o
 * que `fetchAllPaged` espera para parar (lote menor que a página).
 */
function tabelaCom(linhas: Record<string, unknown>[]) {
  let jaServiu = false;
  const q: Record<string, unknown> = {
    select: () => q,
    eq: () => q,
    in: () => q,
    is: () => q,
    order: () => q,
    range: () => {
      const dados = jaServiu ? [] : linhas;
      jaServiu = true;
      return Promise.resolve({ data: dados, error: null });
    },
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
      resolve({ data: linhas, error: null }),
  };
  return q;
}

/**
 * Dubla o cliente admin: registra toda chamada RPC em `chamadas` e devolve
 * respostas que fazem o fluxo passar pelos QUATRO caminhos:
 *   1. principal            → 0 linhas (sobra vaga para os próximos)
 *   2. "forçado" (subtree)  → 1 linha (node_id "art-1")
 *   3. "lembrado" (continuidade) → 1 linha (node_id "n-continuidade")
 *   4. enumeração (knowledge_list_chunks) → 0 linhas
 */
function dublarDb(chamadas: Chamada[], arquivosDeEspaco: string[] = ["doc-x"]) {
  return {
    from: vi.fn((tabela: string) =>
      tabela === "knowledge_documents"
        ? tabelaCom(arquivosDeEspaco.map((id) => ({ id })))
        : tabelaCom([]),
    ),
    rpc: vi.fn(async (nome: string, args: Record<string, unknown>) => {
      chamadas.push({ nome, args });
      if (nome === "subtree_ids") {
        return { data: [{ id: "art-1", type: "article" }], error: null };
      }
      if (nome === "hybrid_search_scoped") {
        const nodeIds = (args.p_node_ids as string[] | undefined) ?? [];
        if (nodeIds.includes("art-1")) {
          return {
            data: [
              { node_id: "art-1", document_id: null, title: "t1", heading_path: null, snippet: "s1", content: "c1", score: 1 },
            ],
            error: null,
          };
        }
        if (nodeIds.includes("n-continuidade")) {
          return {
            data: [
              {
                node_id: "n-continuidade",
                document_id: null,
                title: "t2",
                heading_path: null,
                snippet: "s2",
                content: "c2",
                score: 1,
              },
            ],
            error: null,
          };
        }
        return { data: [], error: null }; // chamada principal
      }
      if (nome === "knowledge_list_chunks") {
        return { data: [], error: null };
      }
      return { data: null, error: null };
    }),
  };
}

/**
 * `base` é o que o chamador passa em `opts.base`: um código, `null` (portal,
 * Cmd+K, editor) ou string VAZIA — os quatro chamadores fazem
 * `track.p_base ?? null`, e um `p_base=` vazio na querystring chega como "".
 */
async function rodarCenario(origem: "base" | "chave", base: string | null): Promise<Chamada[]> {
  const chamadas: Chamada[] = [];
  const db = dublarDb(chamadas);
  vi.mocked(createAdminClient).mockReturnValue(db as never);
  vi.mocked(resolverEscopoDaBase).mockResolvedValue({
    spaceIds: [], // vazio de propósito: evita precisar dublar a árvore efetiva
    documentIds: ["doc-x"],
    origem,
  });
  vi.mocked(expandirConsulta).mockResolvedValue({
    lexica: "consulta",
    vetor: "consulta",
    boost: null,
    responsaveis: ["node-x"], // dispara o caminho "forçado" (passo 2)
  } as never);

  await retrievePublicContext(
    // Com base, `resolverEscopoDaBase` (dublado) manda e este valor é ignorado.
    // SEM base ele é o escopo de espaço do turno, e é dele que sai o conjunto
    // ELEGÍVEL contra o qual `scope.documentId` é conferido desde a tarefa 13 —
    // o dublê de `knowledge_documents` devolve "doc-x" como arquivo pronto
    // desse espaço, então o id continua sendo honrado nos quatro cenários e o
    // que este teste mede (os quatro `p_base`) segue sendo o que ele mede.
    ["sp-1"],
    "consulta de teste",
    8,
    { documentId: "doc-x" }, // força documentIds=["doc-x"] sem tocar herança de espaço
    null,
    {
      base,
      track: {},
      continuidade: ["n-continuidade"], // dispara o caminho "lembrado" (passo 3)
    },
  );

  return chamadas;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("retrievePublicContext propaga p_base às quatro chamadas cercadas", () => {
  it("origem 'base': as três hybrid_search_scoped E a knowledge_list_chunks carregam p_base", async () => {
    const chamadas = await rodarCenario("base", "base-a");

    const hss = chamadas.filter((c) => c.nome === "hybrid_search_scoped");
    const klc = chamadas.filter((c) => c.nome === "knowledge_list_chunks");

    // As três chamadas de hybrid_search_scoped: principal, forçada (art-1)
    // e a de continuidade (n-continuidade) — as três precisam existir.
    expect(hss).toHaveLength(3);
    expect(klc).toHaveLength(1);

    for (const c of [...hss, ...klc]) {
      expect(c.args.p_base, `${c.nome} com p_node_ids=${JSON.stringify(c.args.p_node_ids)}`).toBe("base-a");
    }
  });

  /**
   * A GUARDA DA TAREFA 9. Era o oposto disto, e a inversão é o ponto: com
   * `origem === "chave"` o cliente não configurou nada, e é exatamente aí que
   * a cerca de propriedade precisa estar de pé — se a aplicação montar uma
   * lista de `p_document_ids` errada, é o banco que recusa o arquivo interno
   * de outro cliente. A cerca não corta o que vem da chave: ela só olha
   * `knowledge_documents.base_id`, e documento de espaço tem esse campo nulo.
   */
  it("origem 'chave': as quatro chamadas TAMBÉM carregam p_base — a cerca não depende de configuração", async () => {
    const chamadas = await rodarCenario("chave", "base-a");

    const hss = chamadas.filter((c) => c.nome === "hybrid_search_scoped");
    const klc = chamadas.filter((c) => c.nome === "knowledge_list_chunks");

    expect(hss).toHaveLength(3);
    expect(klc).toHaveLength(1);

    for (const c of [...hss, ...klc]) {
      expect(c.args.p_base, `${c.nome} com p_node_ids=${JSON.stringify(c.args.p_node_ids)}`).toBe("base-a");
    }
  });

  it("chamador SEM base (portal, Cmd+K, editor): nenhuma das quatro carrega p_base", async () => {
    const chamadas = await rodarCenario("chave", null);

    const hss = chamadas.filter((c) => c.nome === "hybrid_search_scoped");
    const klc = chamadas.filter((c) => c.nome === "knowledge_list_chunks");

    expect(hss).toHaveLength(3);
    expect(klc).toHaveLength(1);

    for (const c of [...hss, ...klc]) {
      expect(c.args.p_base, `${c.nome} com p_node_ids=${JSON.stringify(c.args.p_node_ids)}`).toBeUndefined();
    }
  });

  /**
   * `p_base=` VAZIO na querystring. Os quatro chamadores fazem
   * `track.p_base ?? null`, e `??` não pega string vazia: com `opts.base = ""`,
   * um `?? null` aqui dentro mandaria `p_base: ""` ao banco, `p_base is null`
   * seria FALSO, e a cerca ativaria com `base_alvo` vazio — recusando TODO
   * arquivo de base, de todo cliente, em silêncio.
   */
  it("base como string VAZIA é tratada como sem base: nenhuma das quatro carrega p_base", async () => {
    const chamadas = await rodarCenario("chave", "");

    const hss = chamadas.filter((c) => c.nome === "hybrid_search_scoped");
    const klc = chamadas.filter((c) => c.nome === "knowledge_list_chunks");

    expect(hss).toHaveLength(3);
    expect(klc).toHaveLength(1);

    for (const c of [...hss, ...klc]) {
      expect(c.args.p_base, `${c.nome} com p_node_ids=${JSON.stringify(c.args.p_node_ids)}`).toBeUndefined();
    }
  });
});

/**
 * TAREFA 13, PASSO 2 — o furo: `scope.documentId` vem do CORPO da requisição
 * (`payload.scope` no widget e no Ask-AI do portal) e substituía a lista de
 * arquivos sem nenhuma interseção com o que as RPCs de escopo resolveram.
 *
 * A cerca de propriedade da tarefa 7 (`p_base`) segura arquivo de OUTRA base,
 * mas ela não olha `regra`: arquivo DA PRÓPRIA base restrito por portal, perfil
 * ou centro de custo era servido a quem NÃO é elegível, porque a elegibilidade
 * só rodava ao MONTAR a lista. E no portal, que não passa base, a cerca está
 * desligada por desenho e qualquer uuid valia. O que protegia era um UUID ser
 * imprevisível — segredo por acidente, que vaza em citação, print e tela.
 *
 * Do lado do TypeScript, "restrito por regra na mesma base" e "de outra base"
 * são o MESMO fato: o id não está no conjunto elegível. Quem sabe distinguir os
 * dois é o SQL (`documentos_da_base` aplica `public.elegivel` e o join por
 * base_code), e é `.audit/isolamento-documentacao-e2e.ts` que prova aquele lado.
 * Aqui se prova o que só existe aqui: a INTERSEÇÃO, e que o id recusado cai no
 * escopo normal em vez de devolver vazio.
 */
describe("retrieveWith interseca scope.documentId com o conjunto elegível", () => {
  /** Nó de artigo mínimo para a árvore efetiva dublada. */
  const no = (id: string) => ({
    id,
    sourceId: null,
    parent_id: null,
    type: "article" as const,
    title: id,
    slug: id,
    position: "a0",
    status: "published" as const,
    link_url: null,
    icon: null,
    description: null,
    updated_at: "2026-09-26T00:00:00Z",
    badge: "proprio" as const,
    hidden: false,
    children: [],
  });

  const ARQUIVOS_DO_ESPACO = ["doc-espaco-1", "doc-espaco-2"];
  const ARQUIVO_DA_BASE = "doc-da-base";
  const NO_DO_ESPACO = "art-do-espaco";

  /**
   * Cenário com escopo de verdade dos DOIS lados: um espaço com um artigo (para
   * `p_node_ids` não ser vazio e a queda no escopo normal ser observável) e três
   * arquivos elegíveis — dois do espaço e um da base.
   */
  async function rodar(documentId: string): Promise<Chamada[]> {
    const chamadas: Chamada[] = [];
    const db = dublarDb(chamadas, ARQUIVOS_DO_ESPACO);
    vi.mocked(createAdminClient).mockReturnValue(db as never);
    vi.mocked(getEffectiveTreePublic).mockResolvedValue([no(NO_DO_ESPACO)] as never);
    vi.mocked(resolverEscopoDaBase).mockResolvedValue({
      spaceIds: ["sp-1"],
      documentIds: [ARQUIVO_DA_BASE],
      origem: "base",
    });
    vi.mocked(expandirConsulta).mockResolvedValue({
      lexica: "consulta",
      vetor: "consulta",
      boost: null,
      responsaveis: [], // sem vínculo termo→artigo: só a chamada PRINCIPAL
    } as never);

    await retrievePublicContext(["sp-1"], "consulta de teste", 8, { documentId }, null, {
      base: "base-a",
      track: {},
    });
    return chamadas;
  }

  /** A chamada PRINCIPAL da busca (a única, neste cenário). */
  const principal = (chamadas: Chamada[]) => chamadas.find((c) => c.nome === "hybrid_search_scoped")!.args;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("id elegível (arquivo da base) é HONRADO: a busca vai só nele e os artigos saem do escopo", async () => {
    const args = principal(await rodar(ARQUIVO_DA_BASE));

    expect(args.p_document_ids).toEqual([ARQUIVO_DA_BASE]);
    // Escopo por arquivo estreita os ARTIGOS a nada — é o que o escopo significa.
    expect(args.p_node_ids).toBeUndefined();
  });

  it("id elegível (arquivo do espaço) é HONRADO: estreita entre os arquivos do espaço e os da base continuam somando", async () => {
    const args = principal(await rodar("doc-espaco-1"));
    const ids = args.p_document_ids as string[];

    expect(ids).toContain("doc-espaco-1");
    expect(ids).not.toContain("doc-espaco-2"); // estreitou de verdade
    // A união com os arquivos DA BASE é deliberada e inalterada: são os arquivos
    // do próprio cliente, sempre no escopo daquela identidade.
    expect(ids).toContain(ARQUIVO_DA_BASE);
    expect(args.p_node_ids).toBeUndefined();
  });

  it("id NÃO elegível da MESMA base (restrito por regra) é IGNORADO e o turno segue com o escopo normal", async () => {
    const args = principal(await rodar("doc-restrito-por-regra"));

    // Nem entra na lista, nem zera a busca: o escopo normal do turno, inteiro.
    expect(args.p_document_ids).toEqual([...ARQUIVOS_DO_ESPACO, ARQUIVO_DA_BASE]);
    expect(args.p_document_ids).not.toContain("doc-restrito-por-regra");
    // E os ARTIGOS voltam ao escopo — é isto que "cair no comportamento SEM
    // escopo" quer dizer, e é a diferença entre ignorar o id e devolver vazio.
    expect(args.p_node_ids).toEqual([NO_DO_ESPACO]);
  });

  it("id de OUTRA base é IGNORADO do mesmo jeito (para o TypeScript é o mesmo fato: fora do conjunto)", async () => {
    const args = principal(await rodar("doc-de-outra-base"));

    expect(args.p_document_ids).toEqual([...ARQUIVOS_DO_ESPACO, ARQUIVO_DA_BASE]);
    expect(args.p_node_ids).toEqual([NO_DO_ESPACO]);
  });

  /**
   * Devolver vazio ensinaria a EXISTÊNCIA do id (a resposta mudaria de forma
   * conforme o uuid chutado, que é justamente o oráculo que a correção fecha) e
   * mataria o turno do usuário legítimo cujo escopo envelheceu — arquivo
   * apagado, ou regra que mudou entre um turno e o seguinte.
   */
  it("id recusado NÃO produz recuperação vazia: a busca é chamada e devolve o escopo normal", async () => {
    const chamadas = await rodar("doc-inexistente");
    expect(chamadas.filter((c) => c.nome === "hybrid_search_scoped")).toHaveLength(1);
  });
});
