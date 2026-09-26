/**
 * AS DUAS GARANTIAS DE SEGURANÇA DA ABA CONTEÚDO, sob teste.
 *
 * A área do cliente não tem sessão do Supabase: grava com `service_role`, que
 * tem `rolbypassrls`. Não existe RLS protegendo este caminho — as duas linhas de
 * código testadas aqui SÃO a cerca:
 *
 *   1. a base vem da sessão revalidada, nunca do formulário;
 *   2. o `space_id` que o cliente anexa tem de estar no poço de
 *      `documentacoes_universais` com `enabled = true` — sem isso ele aponta para
 *      a documentação customizada de outro cliente, e o isolamento das tarefas 1
 *      a 7 cai por uma tela.
 *
 * Garantia sem teste é garantia até alguém refatorar, e as duas falham em
 * SILÊNCIO: a gravação funcionaria, e o vazamento apareceria semanas depois como
 * uma resposta do assistente citando documento de outro cliente.
 *
 * ── O que é dublado, e o que NÃO é ───────────────────────────────────────
 * `abrirSessaoGestao` é dublado (é ele que verifica HMAC e lê o banco), mas
 * `baseDaSessao` roda de VERDADE: é ela que decide que a base sai da identidade,
 * e dublá-la apagaria justamente o que o item 1 afirma. O cliente do Supabase é
 * um gravador que registra cada tabela tocada, cada operação e cada payload —
 * assim o teste também afirma o que NÃO foi escrito
 * (`documentacoes_universais`), que é a terceira regra do arquivo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/gestao/sessao", () => ({ abrirSessaoGestao: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
// A busca no ERP não deve sair nem por acidente num teste de unidade: se alguma
// destas chamadas escapar, a dublagem estoura em vez de bater num ERP real.
vi.mock("@/lib/documentacoes/valores-erp", () => ({
  buscarValoresNoErp: vi.fn(async () => ({ ok: true, valores: [], total: 0, usuario: "?", formatoDesconhecido: false })),
}));

import {
  salvarAjusteDeDocumentacao,
  voltarAoPadraoDeDocumentacao,
  valoresParaDimensao,
} from "./actions";
import { abrirSessaoGestao } from "@/lib/gestao/sessao";
import { createAdminClient } from "@/lib/supabase/admin";
import { buscarValoresNoErp } from "@/lib/documentacoes/valores-erp";

const BASE_DA_SESSAO = { code: "natcorp", id: "11111111-1111-4111-8111-111111111111" };
const BASE_DO_VIZINHO = { code: "leadec", id: "22222222-2222-4222-8222-222222222222" };
const DOC_NO_POCO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DOC_DE_OUTRO_CLIENTE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type Operacao = {
  tabela: string;
  op: "select" | "upsert" | "delete" | "insert";
  payload?: unknown;
  filtros: Record<string, unknown>;
};

let operacoes: Operacao[] = [];

/**
 * Cliente Supabase dublado.
 *
 * `documentacoes_universais` responde uma linha só para `DOC_NO_POCO` — é o poço
 * do teste. `ai_base_documentacoes` responde vazio (nenhuma sobreposição
 * gravada), salvo quando o cenário pede o contrário.
 */
function dublarDb(opcoes: { sobreposicaoExistente?: boolean; regraDaNatcorp?: unknown } = {}) {
  function construir(tabela: string) {
    const op: Operacao = { tabela, op: "select", filtros: {} };
    const resposta = () => {
      if (tabela === "documentacoes_universais") {
        const pedido = op.filtros.space_id;
        const ativo = op.filtros.enabled !== false;
        return {
          data:
            pedido === DOC_NO_POCO && ativo
              ? { space_id: DOC_NO_POCO, regra: opcoes.regraDaNatcorp ?? {} }
              : null,
          error: null,
        };
      }
      if (tabela === "ai_base_documentacoes" && op.op === "select") {
        return {
          data: opcoes.sobreposicaoExistente
            ? { enabled: true, regra: { portal: ["PG"] }, criado_por: null }
            : null,
          error: null,
        };
      }
      return { data: null, error: null };
    };
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (campo: string, valor: unknown) => {
        op.filtros[campo] = valor;
        return q;
      },
      in: () => q,
      maybeSingle: () => Promise.resolve(resposta()),
      upsert: (payload: unknown) => {
        op.op = "upsert";
        op.payload = payload;
        return Promise.resolve({ error: null });
      },
      insert: (payload: unknown) => {
        op.op = "insert";
        op.payload = payload;
        return Promise.resolve({ error: null });
      },
      delete: () => {
        op.op = "delete";
        return q;
      },
      // `then` para o encadeamento que termina sem `maybeSingle` (o delete).
      then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
    };
    operacoes.push(op);
    return q;
  }
  return { from: (tabela: string) => construir(tabela) };
}

function sessaoDeCliente(usuario: string | null = "ana.silva") {
  return {
    ok: true as const,
    modo: "cliente" as const,
    identidade: {
      baseCode: BASE_DA_SESSAO.code,
      baseId: BASE_DA_SESSAO.id,
      baseNome: "Natcorp",
      usuario,
      perfil: "MASTER",
      painel: "PO",
      empresa: "700",
      matricula: "1024",
    },
    spaceId: "espaco-da-chave",
    key: "pk_x",
    token: "kbt1h.a.b",
    operador: null,
  };
}

function sessaoDeSuporte() {
  return {
    ...sessaoDeCliente(null),
    modo: "suporte" as const,
    key: null,
    token: null,
    operador: { id: "operador-1", email: "suporte@natcorp.com.br" },
  };
}

const escritas = () => operacoes.filter((o) => o.op !== "select");

beforeEach(() => {
  vi.clearAllMocks();
  operacoes = [];
  vi.mocked(createAdminClient).mockImplementation(() => dublarDb() as never);
});

describe("a base vem da sessão, nunca do formulário", () => {
  it("POST forjado com a base do vizinho grava na base DA SESSÃO", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);

    const r = await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      // O atacante manda de tudo: a base do vizinho em todos os nomes plausíveis.
      base: BASE_DO_VIZINHO.code,
      baseId: BASE_DO_VIZINHO.id,
      base_id: BASE_DO_VIZINHO.id,
      spaceId: DOC_NO_POCO,
      enabled: true,
      regra: { portal: ["PG"] },
    });

    expect(r).toEqual({ ok: true });
    const upsert = escritas().find((o) => o.tabela === "ai_base_documentacoes");
    expect(upsert?.op).toBe("upsert");
    expect(upsert?.payload).toMatchObject({
      base_id: BASE_DA_SESSAO.id,
      space_id: DOC_NO_POCO,
    });
    // E, explicitamente, NÃO a do vizinho — a asserção que quebra se alguém
    // passar a ler a base do payload "porque já vem no formulário".
    expect((upsert?.payload as { base_id: string }).base_id).not.toBe(BASE_DO_VIZINHO.id);
  });

  it("apagar a sobreposição também usa a base da sessão, não a do formulário", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);
    vi.mocked(createAdminClient).mockImplementation(
      () => dublarDb({ sobreposicaoExistente: true }) as never,
    );

    const r = await voltarAoPadraoDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      base: BASE_DO_VIZINHO.code,
      baseId: BASE_DO_VIZINHO.id,
      spaceId: DOC_NO_POCO,
    });

    expect(r).toEqual({ ok: true });
    const del = escritas().find((o) => o.op === "delete");
    expect(del?.tabela).toBe("ai_base_documentacoes");
    expect(del?.filtros.base_id).toBe(BASE_DA_SESSAO.id);
  });

  it("sessão recusada não escreve nada", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue({
      ok: false,
      motivo: "expirado",
      mensagem: "Sua sessão expirou.",
    } as never);

    const r = await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      spaceId: DOC_NO_POCO,
      enabled: true,
      regra: {},
    });

    expect(r).toEqual({ ok: false, erro: "Sua sessão expirou." });
    expect(escritas()).toHaveLength(0);
  });
});

describe("o poço: o cliente só ajusta o que a Natcorp oferece", () => {
  it("space_id fora do poço é RECUSADO e nada é escrito", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);

    const r = await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      // A documentação customizada de outro cliente: existe em `spaces`, não
      // está em `documentacoes_universais`.
      spaceId: DOC_DE_OUTRO_CLIENTE,
      enabled: true,
      regra: {},
    });

    expect(r.ok).toBe(false);
    expect(r.ok === false && r.erro).toContain("não está entre as que a Natcorp oferece");
    expect(escritas()).toHaveLength(0);
  });

  it("a conferência do poço vem ANTES da gravação, e olha enabled", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);

    await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      spaceId: DOC_NO_POCO,
      enabled: false,
      regra: {},
    });

    const conferencia = operacoes.find((o) => o.tabela === "documentacoes_universais");
    expect(conferencia, "o poço tem de ser consultado").toBeDefined();
    expect(conferencia?.filtros).toMatchObject({ space_id: DOC_NO_POCO, enabled: true });
    // Ordem: a conferência acontece antes de qualquer escrita.
    expect(operacoes.indexOf(conferencia!)).toBeLessThan(
      operacoes.indexOf(escritas().find((o) => o.op === "upsert")!),
    );
  });

  it("documentacoes_universais NUNCA é escrita pela área do cliente", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);

    await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      spaceId: DOC_NO_POCO,
      enabled: true,
      regra: {},
    });
    await voltarAoPadraoDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      spaceId: DOC_NO_POCO,
    });

    expect(escritas().map((o) => o.tabela)).not.toContain("documentacoes_universais");
    expect(escritas().every((o) => o.tabela !== "spaces")).toBe(true);
  });
});

describe("as três travas da regra continuam na ordem", () => {
  it("chave fora das doze é recusada com o nome do campo, sem gravar", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);

    const r = await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      spaceId: DOC_NO_POCO,
      enabled: true,
      // O typo clássico: plural. `public.elegivel` FECHA nele.
      regra: { centro_custos: ["1"] },
    });

    expect(r.ok).toBe(false);
    expect(r.ok === false && r.erro).toContain("centro_custos");
    expect(escritas()).toHaveLength(0);
  });

  it("lista toda em branco é recusada — ela LIBERA, o oposto do que se pediu", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);

    const r = await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      spaceId: DOC_NO_POCO,
      enabled: true,
      regra: { portal: ["", "  "] },
    });

    expect(r.ok).toBe(false);
    expect(escritas()).toHaveLength(0);
  });

  it("a regra gravada sai normalizada (sem branco, caixa e duplicata)", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);

    await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      spaceId: DOC_NO_POCO,
      enabled: true,
      regra: { portal: ["PG", "pg", " PG ", ""] },
    });

    const upsert = escritas().find((o) => o.op === "upsert");
    // Minúscula é a forma canônica de `normalizarRegra`: quatro grafias do mesmo
    // portal viram um valor, e a comparação em `public.elegivel` é insensível a
    // caixa dos dois lados.
    expect((upsert?.payload as { regra: Record<string, string[]> }).regra.portal).toEqual(["pg"]);
  });
});

describe("as listas de valor usam o login de quem está na tela", () => {
  it("modo cliente: consulta o ERP com o login do token", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente("ana.silva") as never);

    await valoresParaDimensao({ key: "pk_x", kbt: "kbt1h.a.b", dimensao: "empresa" });

    expect(buscarValoresNoErp).toHaveBeenCalledWith({
      base: BASE_DA_SESSAO.code,
      dimensao: "empresa",
      usuario: "ana.silva",
    });
  });

  it("modo suporte: NÃO consulta o ERP e devolve o motivo para a tela", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeSuporte() as never);

    const r = await valoresParaDimensao({ suporte: "1", base: BASE_DA_SESSAO.code, dimensao: "empresa" });

    expect(r).toEqual({ ok: false, motivo: "O modo suporte não tem login do ERP; digite o valor." });
    expect(buscarValoresNoErp).not.toHaveBeenCalled();
  });
});

/**
 * A QUARTA TRAVA: as duas regras valem ao mesmo tempo.
 *
 * Sem ela, o cliente escolhe um portal que a regra da Natcorp não permite, a
 * gravação passa, e a documentação não alcança ninguém — sem erro em lugar
 * nenhum. É o mesmo modo de falha das três primeiras, e por isso a mesma
 * postura: recusar, nomeando o que fazer.
 */
describe("a combinação das duas regras", () => {
  it("escolha sem valor em comum com a da Natcorp é RECUSADA, sem gravar", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);
    vi.mocked(createAdminClient).mockImplementation(
      () => dublarDb({ regraDaNatcorp: { portal: ["PG"] } }) as never,
    );

    const r = await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      spaceId: DOC_NO_POCO,
      enabled: true,
      regra: { portal: ["PO"] },
    });

    expect(r.ok).toBe(false);
    expect(r.ok === false && r.erro).toContain("Gestor");
    expect(r.ok === false && r.erro).toContain("Ocultar");
    expect(escritas()).toHaveLength(0);
  });

  it("escolha com valor em comum passa", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);
    vi.mocked(createAdminClient).mockImplementation(
      () => dublarDb({ regraDaNatcorp: { portal: ["PG", "PO"] } }) as never,
    );

    const r = await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      spaceId: DOC_NO_POCO,
      enabled: true,
      regra: { portal: ["PO"] },
    });

    expect(r).toEqual({ ok: true });
    expect(escritas().some((o) => o.op === "upsert")).toBe(true);
  });

  it("OCULTAR não é recusado: é o caminho legítimo para ninguém alcançar", async () => {
    vi.mocked(abrirSessaoGestao).mockResolvedValue(sessaoDeCliente() as never);
    vi.mocked(createAdminClient).mockImplementation(
      () => dublarDb({ regraDaNatcorp: { portal: ["PG"] } }) as never,
    );

    const r = await salvarAjusteDeDocumentacao({
      key: "pk_x",
      kbt: "kbt1h.a.b",
      spaceId: DOC_NO_POCO,
      enabled: false,
      regra: { portal: ["PO"] },
    });

    expect(r).toEqual({ ok: true });
    const upsert = escritas().find((o) => o.op === "upsert");
    expect((upsert?.payload as { enabled: boolean }).enabled).toBe(false);
  });
});
