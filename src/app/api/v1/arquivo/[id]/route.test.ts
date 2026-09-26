/**
 * O DOWNLOAD DO ARQUIVO DA EMPRESA — e a propriedade que só um teste pega.
 *
 * As três recusas (não é do meu cliente · download não liberado · a regra não
 * me alcança) têm de sair IDÊNTICAS. Idênticas de verdade: mesmo status, mesmo
 * corpo, byte a byte. É a única forma de o endpoint não virar oráculo de
 * existência — com id de 36 caracteres e resposta que varia por motivo, dá
 * para varrer ids e mapear o acervo de outro cliente sem baixar um byte.
 *
 * Um teste que checasse só "as três dão 404" passaria com três mensagens
 * diferentes, que é exatamente o vazamento. Por isso os corpos são comparados
 * entre si, e não contra um literal.
 *
 * ── O que é dublado, e o que NÃO é ───────────────────────────────────────
 * A cerca (`arquivoBaixavel`) roda de VERDADE sobre um Supabase gravador: é
 * ela que decide, e dublá-la apagaria a decisão sob teste. O que é dublado é a
 * fronteira — a chave do widget, o token de rastreio e o Storage.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rateLimitOk = vi.fn(async () => true);
const originAllowed = vi.fn(() => true);
const resolveWidgetKey = vi.fn(async () => ({
  id: "k1",
  space_id: "sp-1",
  space_ids: ["sp-1"],
  allowed_origins: [],
  rate_limit: 100,
}));
vi.mock("@/lib/widget/auth", () => ({
  resolveWidgetKey: (...a: unknown[]) => resolveWidgetKey(...(a as [])),
  originAllowed: (...a: unknown[]) => originAllowed(...(a as [])),
  corsHeaders: () => ({}),
  clientIp: () => "1.2.3.4",
  extractKey: (_req: unknown, k: unknown) => (typeof k === "string" ? k : "pk_x"),
  rateLimitOk: (...a: unknown[]) => rateLimitOk(...(a as [])),
}));

const track = vi.fn(async () => ({ p_base: "zz-cliente", p_perfil: "MASTER" }) as Record<string, string>);
vi.mock("@/lib/tracking/resolve", () => ({ decodeTrackForSpace: (...a: unknown[]) => track(...(a as [])) }));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { GET } from "./route";
import { createAdminClient } from "@/lib/supabase/admin";

const MEU = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DO_VIZINHO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type Linha = { id: string; original_name: string; storage_path: string; mime: string | null; download_liberado: boolean };

let assinados: { caminho: string; segundos: number; nome?: string }[] = [];

/**
 * O banco, como gravador.
 *
 * `documentos_da_base` devolve o que a IDENTIDADE alcança naquela base — é a
 * cerca de propriedade + `public.elegivel`, as duas em SQL. Aqui ela é uma
 * lista fixa por caso, e o que o teste exercita é o código que a consome.
 */
function dublarDb(opcoes: { elegiveis?: string[]; linhas?: Linha[]; falharAssinatura?: boolean } = {}) {
  const elegiveis = opcoes.elegiveis ?? [];
  const linhas = opcoes.linhas ?? [];
  assinados = [];

  const db = {
    rpc: vi.fn(async (nome: string) => {
      if (nome !== "documentos_da_base") return { data: null, error: { message: `rpc inesperada: ${nome}` } };
      return { data: elegiveis.map((document_id) => ({ document_id })), error: null };
    }),
    from: vi.fn(() => {
      let ids: string[] = [];
      let soLiberado = false;
      const q: Record<string, unknown> = {
        select: () => q,
        in: (_campo: string, valores: string[]) => {
          ids = valores;
          return q;
        },
        filter: (campo: string, _op: string, valor: unknown) => {
          if (campo === "download_liberado" && valor === true) soLiberado = true;
          return q;
        },
        then: (resolver: (r: unknown) => void) =>
          resolver({
            data: linhas.filter((l) => ids.includes(l.id) && (!soLiberado || l.download_liberado)),
            error: null,
          }),
      };
      return q;
    }),
    storage: {
      from: () => ({
        createSignedUrl: async (caminho: string, segundos: number, opts?: { download?: string }) => {
          assinados.push({ caminho, segundos, nome: opts?.download });
          return opcoes.falharAssinatura
            ? { data: null, error: { message: "boom" } }
            : { data: { signedUrl: `https://storage/assinado?p=${encodeURIComponent(caminho)}` }, error: null };
        },
      }),
    },
  };
  vi.mocked(createAdminClient).mockReturnValue(db as never);
  return db;
}

function pedir(id: string, query = "key=pk_x&track=tok") {
  const req = new Request(`https://api/api/v1/arquivo/${id}?${query}`);
  // A rota lê `req.nextUrl`; o `NextRequest` real não é necessário para isto.
  Object.defineProperty(req, "nextUrl", { value: new URL(req.url) });
  return GET(req as unknown as Parameters<typeof GET>[0], { params: Promise.resolve({ id }) });
}

const linhaLiberada: Linha = {
  id: MEU,
  original_name: "zz-manual.pdf",
  storage_path: "bases/b1/zz-manual.pdf",
  mime: "application/pdf",
  download_liberado: true,
};

beforeEach(() => {
  rateLimitOk.mockClear();
  originAllowed.mockReturnValue(true);
  track.mockResolvedValue({ p_base: "zz-cliente", p_perfil: "MASTER" });
});

describe("o caminho feliz", () => {
  it("assina por pouco tempo, com o nome original, e redireciona", async () => {
    dublarDb({ elegiveis: [MEU], linhas: [linhaLiberada] });

    const res = await pedir(MEU);

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("https://storage/assinado");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(assinados).toHaveLength(1);
    expect(assinados[0]!.caminho).toBe("bases/b1/zz-manual.pdf");
    // Curta: a URL assinada É o arquivo, e link vaza em print.
    expect(assinados[0]!.segundos).toBeLessThanOrEqual(300);
    // Sem isto o navegador salvaria o uuid do caminho.
    expect(assinados[0]!.nome).toBe("zz-manual.pdf");
  });

  it("o corpo da requisição não decide nada: a base sai do token", async () => {
    dublarDb({ elegiveis: [MEU], linhas: [linhaLiberada] });

    // O atacante manda a base e o perfil na querystring; nada disso é lido.
    await pedir(MEU, "key=pk_x&track=tok&p_base=outro&p_perfil=MASTER&base=outro");

    const db = vi.mocked(createAdminClient).mock.results[0]!.value as { rpc: ReturnType<typeof vi.fn> };
    expect(db.rpc).toHaveBeenCalledWith("documentos_da_base", {
      p_base: "zz-cliente",
      p_identidade: { base: "zz-cliente", perfil: "MASTER" },
    });
  });
});

describe("as três recusas são a MESMA resposta", () => {
  /** Roda um cenário e devolve status + corpo cru, para comparar entre si. */
  async function recusa(cenario: Parameters<typeof dublarDb>[0], id = MEU) {
    dublarDb(cenario);
    const res = await pedir(id);
    return { status: res.status, corpo: await res.text() };
  }

  it("não é da minha base · download fechado · fora do alcance saem idênticas", async () => {
    // 1. PROPRIEDADE: `documentos_da_base` não devolve arquivo de outra base,
    //    então o id do vizinho não está no conjunto elegível.
    const deOutraBase = await recusa({ elegiveis: [MEU], linhas: [linhaLiberada] }, DO_VIZINHO);

    // 2. DOWNLOAD FECHADO: alcança o arquivo, mas `download_liberado` é falso.
    const fechado = await recusa({
      elegiveis: [MEU],
      linhas: [{ ...linhaLiberada, download_liberado: false }],
    });

    // 3. ALCANCE: `public.elegivel` fecha dentro da RPC, então o id não volta.
    const inelegivel = await recusa({ elegiveis: [], linhas: [linhaLiberada] });

    expect(deOutraBase.status).toBe(404);
    // Comparadas ENTRE SI, não contra um literal: um literal passaria com três
    // mensagens diferentes, que é exatamente o vazamento sob teste.
    expect(fechado).toEqual(deOutraBase);
    expect(inelegivel).toEqual(deOutraBase);
  });

  it("token sem base cai na MESMA resposta, e o banco nem é consultado", async () => {
    track.mockResolvedValue({});
    const db = dublarDb({ elegiveis: [MEU], linhas: [linhaLiberada] });

    const res = await pedir(MEU, "key=pk_x");

    expect(res.status).toBe(404);
    expect(await res.text()).toBe(JSON.stringify({ error: "Arquivo não disponível para download." }));
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("id fora de forma para antes do banco", async () => {
    const db = dublarDb({ elegiveis: [MEU], linhas: [linhaLiberada] });

    const res = await pedir("nao-e-uuid");

    expect(res.status).toBe(404);
    expect(db.rpc).not.toHaveBeenCalled();
  });
});

describe("as recusas que falam do CHAMADOR continuam distintas", () => {
  it("chave inválida é 401, origem é 403, excesso é 429", async () => {
    dublarDb({ elegiveis: [MEU], linhas: [linhaLiberada] });

    resolveWidgetKey.mockResolvedValueOnce(null as never);
    expect((await pedir(MEU)).status).toBe(401);

    originAllowed.mockReturnValueOnce(false);
    expect((await pedir(MEU)).status).toBe(403);

    rateLimitOk.mockResolvedValueOnce(false);
    expect((await pedir(MEU)).status).toBe(429);
  });

  it("o teto é por PESSOA quando há identidade, não pela chave inteira", async () => {
    dublarDb({ elegiveis: [MEU], linhas: [linhaLiberada] });
    track.mockResolvedValue({ p_base: "zz-cliente", p_usuario: "fulano" });

    await pedir(MEU);

    expect(rateLimitOk).toHaveBeenCalledWith("k1", "1.2.3.4", 100, "zz-cliente:fulano");
  });
});

describe("falha nossa não vira recusa", () => {
  it("assinatura que quebra devolve 502, não 'não disponível'", async () => {
    dublarDb({ elegiveis: [MEU], linhas: [linhaLiberada], falharAssinatura: true });
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await pedir(MEU);

    // O arquivo existe e a pessoa PODE baixá-lo. Dizer "não disponível" aqui
    // mandaria quem tem direito procurar permissão que ela já tem.
    expect(res.status).toBe(502);
    expect(erro).toHaveBeenCalled();
    erro.mockRestore();
  });
});
