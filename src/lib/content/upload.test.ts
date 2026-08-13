import { describe, it, expect, vi } from "vitest";

/**
 * O envio de imagem tinha DUAS formas de travar o botão em "Enviando…" para
 * sempre (relatado no avatar do widget, 13/08/2026):
 *
 *  1. CANCELAR — `input.onchange` não dispara quando a pessoa fecha o seletor,
 *     e o callback nunca era chamado. A própria documentação da função dizia
 *     que devolvia `null` no cancelamento; não devolvia.
 *  2. FALHA DE REDE — o cliente do Storage LANÇA, a exceção escapava do
 *     `onchange` (que é async e ninguém aguarda) e o callback também não vinha.
 *
 * E havia um terceiro, silencioso: quando o Storage devolvia erro, o botão
 * voltava ao normal e a imagem simplesmente não mudava, sem dizer por quê.
 */

const upload = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload,
        getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn/${p}` } }),
      }),
    },
  }),
}));

const { enviarParaBucket } = await import("./upload");

// Sem `beforeEach` de reset: cada teste define a própria implementação, e o
// reset entre eles fazia o vitest debitar a exceção do teste de rede como se
// fosse falha dele — a função capturava certinho.
const arquivo = () => new File(["x"], "foto legal.png", { type: "image/png" });

describe("enviarParaBucket", () => {
  it("devolve a URL pública quando dá certo", async () => {
    upload.mockResolvedValue({ error: null });
    const r = await enviarParaBucket("assets", "esp/", arquivo());
    expect(r.url).toMatch(/^https:\/\/cdn\/esp\/\d+-foto_legal\.png$/);
    expect(r.erro).toBeUndefined();
  });

  it("erro do Storage vira MOTIVO em português, não silêncio", async () => {
    upload.mockResolvedValue({ error: { message: "new row violates row-level security policy" } });
    const r = await enviarParaBucket("assets", "esp/", arquivo());
    expect(r.url).toBeNull();
    expect(r.erro).toMatch(/permissão/i);
  });

  it("arquivo grande demais explica o tamanho", async () => {
    upload.mockResolvedValue({ error: { message: "The object exceeded the maximum allowed size" } });
    expect((await enviarParaBucket("assets", "", arquivo())).erro).toMatch(/grande demais/i);
  });

  it("EXCEÇÃO não escapa — era o que travava o botão para sempre", async () => {
    // Lança SÍNCRONO de propósito: uma promessa rejeitada criada pelo mock fica
    // registrada como "não tratada" e o vitest a debita deste teste mesmo com o
    // await capturando. O `await` pega o throw síncrono igual.
    upload.mockImplementation(() => { throw new Error("Failed to fetch"); });
    const r = await enviarParaBucket("assets", "esp/", arquivo());
    expect(r.url).toBeNull();
    expect(r.erro).toMatch(/rede/i);
  });

  it("sempre devolve algo — nunca fica pendente", async () => {
    upload.mockResolvedValue({ error: { message: "coisa nova que ninguém previu" } });
    const r = await enviarParaBucket("assets", "", arquivo());
    expect(r.url).toBeNull();
    expect(r.erro).toBeTruthy();
  });

  it("higieniza o nome do arquivo", async () => {
    upload.mockResolvedValue({ error: null });
    const r = await enviarParaBucket("avatars", "", new File(["x"], "ação & cia?.png"));
    expect(r.url).not.toMatch(/[&?]/);
    expect(r.url).toContain("_cia_.png");
  });
});
