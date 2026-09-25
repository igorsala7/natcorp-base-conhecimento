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
 * afirma que TODOS os quatro payloads carregam `p_base` quando
 * `resolverEscopoDaBase` devolveu `origem === "base"`, e nenhum carrega
 * (fica `undefined`) quando devolveu `origem === "chave"`.
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
import { resolverEscopoDaBase } from "@/lib/ai/escopo-da-base";
import { expandirConsulta } from "@/lib/ai/ontology";

type Chamada = { nome: string; args: Record<string, unknown> };

/** Query builder mínimo, encadeável e "thenable" — o suficiente para o
 * único `.from(...)` que este cenário alcança (`articles`, miniatura). */
function tabelaVazia() {
  const resultado = { data: [], error: null };
  const q: PromiseLike<typeof resultado> & Record<string, unknown> = {
    select: () => q,
    eq: () => q,
    in: () => q,
    maybeSingle: () => Promise.resolve(resultado),
    then: (resolve: (v: typeof resultado) => void) => resolve(resultado),
  } as never;
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
function dublarDb(chamadas: Chamada[]) {
  return {
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
    from: vi.fn(() => tabelaVazia()),
  };
}

async function rodarCenario(origem: "base" | "chave"): Promise<Chamada[]> {
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
    [], // spaceIds — irrelevante: resolverEscopoDaBase (dublado) manda
    "consulta de teste",
    8,
    { documentId: "doc-x" }, // força documentIds=["doc-x"] sem tocar herança de espaço
    null,
    {
      base: "base-a",
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
    const chamadas = await rodarCenario("base");

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

  it("origem 'chave': NENHUMA das quatro chamadas carrega p_base (undefined)", async () => {
    const chamadas = await rodarCenario("chave");

    const hss = chamadas.filter((c) => c.nome === "hybrid_search_scoped");
    const klc = chamadas.filter((c) => c.nome === "knowledge_list_chunks");

    expect(hss).toHaveLength(3);
    expect(klc).toHaveLength(1);

    for (const c of [...hss, ...klc]) {
      expect(c.args.p_base, `${c.nome} com p_node_ids=${JSON.stringify(c.args.p_node_ids)}`).toBeUndefined();
    }
  });
});
