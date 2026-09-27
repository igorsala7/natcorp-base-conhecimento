/**
 * A ENTREGA DOS ALERTAS NA ABERTURA DO WIDGET.
 *
 * Duas coisas que só um teste de rota pega, e as duas são de contrato:
 *
 * 1. `alertas` é chave de TOPO, ao lado de `config`. Os clientes rodam o
 *    `widget.js` que a página deles tem em cache, e o laço de bootstrap daquele
 *    arquivo copia as chaves de `data.config` para dentro do `cfg` que monta cor,
 *    avatar, saudação e sugestões. Uma chave nova ali dentro entraria naquele
 *    objeto sem ninguém pedir; no topo, a versão antiga simplesmente não a vê.
 *
 * 2. A base e a identidade que vão para `alertas_para` saem do TOKEN. A
 *    querystring desta rota é pública e chega do navegador: se ela pudesse dizer
 *    a base, qualquer um leria os avisos de qualquer cliente.
 *
 * O corte por base, janela e regra é de `public.alertas_para` (assertivas na
 * própria migration). Aqui o dublê só devolve o que aquela função devolveria para
 * cada base, e o que roda de verdade é a rota.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const originAllowed = vi.fn(() => true);
const resolveWidgetKey = vi.fn(async () => ({
  id: "k1",
  space_id: "sp-1",
  space_ids: ["sp-1"],
  allowed_origins: [],
  rate_limit: 100,
  config: { title: "Assistente" },
  system_prompt: null,
}));
vi.mock("@/lib/widget/auth", () => ({
  resolveWidgetKey: (...a: unknown[]) => resolveWidgetKey(...(a as [])),
  originAllowed: (...a: unknown[]) => originAllowed(...(a as [])),
  corsHeaders: () => ({}),
  extractKey: () => "pk_x",
}));

vi.mock("@/lib/ai/config", () => ({ hasAiKey: async () => true }));

const decode = vi.fn(async () => ({
  campos: { p_base: "zz-cliente-a", p_portal: "PG", p_usuario: "ana.silva", p_matricula: "9001" } as Record<
    string,
    string
  >,
  motivo: null as string | null,
}));
vi.mock("@/lib/tracking/resolve", () => ({
  decodeTrackDetalhado: (...a: unknown[]) => decode(...(a as [])),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { GET } from "./route";
import { createAdminClient } from "@/lib/supabase/admin";

const ALERTA_A = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  titulo: "Folha fechada",
  corpo: "Fechamento em 25/09.",
  publicar_em: "2026-09-25T12:00:00.000Z",
};
const ALERTA_B = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  titulo: "Aviso do cliente B",
  corpo: "Nada a ver com o cliente A.",
  publicar_em: "2026-09-25T12:00:00.000Z",
};

let chamadas: { nome: string; args: Record<string, unknown> }[] = [];

/** `active` e `widget_paineis` liberam; `alertas_para` responde por base. */
function dublarDb(opcoes: { baseAtiva?: boolean; falharAlertas?: boolean } = {}) {
  chamadas = [];
  const porBase: Record<string, unknown[]> = {
    "zz-cliente-a": [ALERTA_A],
    "zz-cliente-b": [ALERTA_B],
  };

  const db = {
    from: vi.fn(() => {
      const q: Record<string, unknown> = {
        select: () => q,
        ilike: () => q,
        maybeSingle: async () => ({
          data: opcoes.baseAtiva === false ? { active: false, widget_paineis: null } : { active: true, widget_paineis: null },
          error: null,
        }),
      };
      return q;
    }),
    rpc: vi.fn(async (nome: string, args: Record<string, unknown>) => {
      chamadas.push({ nome, args });
      if (nome === "titulos_de_partida") return { data: [], error: null };
      if (nome === "alertas_para") {
        if (opcoes.falharAlertas) return { data: null, error: { message: "boom" } };
        return { data: porBase[String(args.p_base ?? "")] ?? [], error: null };
      }
      return { data: null, error: { message: `rpc inesperada: ${nome}` } };
    }),
  };
  vi.mocked(createAdminClient).mockReturnValue(db as never);
  return db;
}

function pedir(query = "key=pk_x&track=tok") {
  const req = new Request(`https://api/api/v1/config?${query}`);
  Object.defineProperty(req, "nextUrl", { value: new URL(req.url) });
  return GET(req as unknown as Parameters<typeof GET>[0]);
}

beforeEach(() => {
  originAllowed.mockReturnValue(true);
  decode.mockResolvedValue({
    campos: { p_base: "zz-cliente-a", p_portal: "PG", p_usuario: "ana.silva", p_matricula: "9001" },
    motivo: null,
  });
});

describe("os alertas na resposta do bootstrap", () => {
  it("vêm no TOPO, moldados, e nunca dentro de `config`", async () => {
    dublarDb();
    const corpo = (await (await pedir()).json()) as {
      config: Record<string, unknown>;
      alertas: unknown[];
    };

    expect(corpo.alertas).toEqual([
      {
        id: ALERTA_A.id,
        titulo: "Folha fechada",
        corpo: "Fechamento em 25/09.",
        publicarEm: "2026-09-25T12:00:00.000Z",
      },
    ]);
    // A versão antiga do widget copia `config` para dentro do `cfg` dela. Um
    // alerta ali viraria `cfg.alertas` num objeto de aparência visual.
    expect(corpo.config).not.toHaveProperty("alertas");
  });

  it("a base sai do TOKEN: a querystring pedindo outro cliente não é lida", async () => {
    dublarDb();
    const corpo = (await (await pedir("key=pk_x&track=tok&p_base=zz-cliente-b&base=zz-cliente-b")).json()) as {
      alertas: { id: string }[];
    };

    // O alerta do cliente B não aparece para quem o token diz ser do cliente A.
    expect(corpo.alertas.map((a) => a.id)).toEqual([ALERTA_A.id]);
    const chamada = chamadas.find((c) => c.nome === "alertas_para")!;
    expect(chamada.args).toEqual({
      p_base: "zz-cliente-a",
      // `identidadeDoRastreio`: chaves das doze dimensões, sem o prefixo `p_`.
      p_identidade: { base: "zz-cliente-a", portal: "PG", usuario: "ana.silva", matricula: "9001" },
    });
  });

  it("o MESMO token com a outra base recebe o alerta da outra base, e só ele", async () => {
    // O controle da anterior: sem ele, a ausência do alerta de B passaria com a
    // função não devolvendo nada.
    dublarDb();
    decode.mockResolvedValue({ campos: { p_base: "zz-cliente-b", p_portal: "PG" }, motivo: null });
    const corpo = (await (await pedir()).json()) as { alertas: { id: string }[] };
    expect(corpo.alertas.map((a) => a.id)).toEqual([ALERTA_B.id]);
  });

  it("widget desativado nesta base não entrega alerta nenhum", async () => {
    // A resposta de recusa não tem `alertas`, e a RPC não é nem chamada: alerta
    // de uma base desligada não pode sair por uma rota que já disse "não".
    dublarDb({ baseAtiva: false });
    const res = await pedir();
    const corpo = (await res.json()) as Record<string, unknown>;
    expect(corpo).toEqual({ desativado: true, motivo: "base_inativa" });
    expect(chamadas.some((c) => c.nome === "alertas_para")).toBe(false);
  });

  it("sem token não há identidade, então não há alerta (e o widget nem monta)", async () => {
    dublarDb();
    decode.mockResolvedValue({ campos: {}, motivo: null });
    const res = await pedir("key=pk_x");
    const corpo = (await res.json()) as Record<string, unknown>;
    expect(corpo.desativado).toBe(true);
    expect(chamadas.some((c) => c.nome === "alertas_para")).toBe(false);
  });

  it("falha da RPC não derruba a abertura: lista vazia e o resto da config intacto", async () => {
    // Widget sem alerta é o comportamento de sempre; widget que não monta por
    // causa de um alerta é regressão.
    dublarDb({ falharAlertas: true });
    const corpo = (await (await pedir()).json()) as { alertas: unknown[]; config: Record<string, unknown> };
    expect(corpo.alertas).toEqual([]);
    expect(corpo.config.title).toBe("Assistente");
  });

  /**
   * UM CLIENTE ADMIN POR REQUISIÇÃO, E ZERO NO CAMINHO BLOQUEADO.
   *
   * `createAdminClient()` monta um cliente novo a cada chamada — não há cache no
   * módulo —, e esta rota chamava TRÊS vezes no mesmo bootstrap (a base, os títulos
   * de partida e os alertas), justamente no caminho que o usuário sente: a abertura
   * da bolha. O segundo ramo é o que impede a correção de virar o contrário: com o
   * cliente montado no topo da função, a recusa passaria a construir um cliente
   * para não ler nada.
   */
  it("monta UM cliente admin no caminho liberado e NENHUM no bloqueado", async () => {
    dublarDb();
    vi.mocked(createAdminClient).mockClear();
    await pedir();
    expect(createAdminClient).toHaveBeenCalledTimes(1);

    dublarDb();
    decode.mockResolvedValue({ campos: {}, motivo: null });
    vi.mocked(createAdminClient).mockClear();
    await pedir("key=pk_x");
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
