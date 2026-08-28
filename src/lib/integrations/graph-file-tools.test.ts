import { describe, expect, it, vi } from "vitest";

// `confirmations.ts` puxa o admin client, que valida env na carga do módulo.
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
// O portão de confirmação tem teste próprio; aqui o que está sob prova é se o
// ANEXO chega ao `sendMail`, então ele passa direto.
vi.mock("./guards", () => ({ runGuard: async () => ({ ok: true }) }));

import { graphFileTools } from "./graph-file-tools";
import type { Identity } from "./params";

const identity = { p_empresa: "700", p_matricula: "205818" } as unknown as Identity;
const ctxBase = { token: "tok", identity, baseCode: "natcorp" };

const anterior = {
  filename: "relatorio-executivo-tony-oliveira.pdf",
  mimeType: "application/pdf",
  path: "conv-1/uuid-relatorio-executivo-tony-oliveira.pdf",
  criadoEm: "2026-08-27T15:56:15Z",
};

describe("graphFileTools — arquivo de turno anterior", () => {
  it("REGRESSÃO 27/08: sem os anteriores, a ferramenta com anexo nem existe", () => {
    // Este era o defeito: PPT gerado às 15:56, e-mail pedido às 16:24. No turno
    // do envio `gerados` está vazio, a ferramenta não é registrada, e o modelo
    // cai em `ms_email_enviar` — que não tem campo de arquivo. O e-mail sai sem
    // anexo e relata sucesso.
    const tools = graphFileTools({ ...ctxBase, gerados: [] });
    expect(tools.ms_email_enviar_arquivo).toBeUndefined();
    expect(tools.ms_arquivo_salvar).toBeUndefined();
  });

  it("com arquivo da conversa, as duas ferramentas voltam a existir", () => {
    const tools = graphFileTools({ ...ctxBase, gerados: [], anteriores: [anterior] });
    expect(tools.ms_email_enviar_arquivo).toBeDefined();
    expect(tools.ms_arquivo_salvar).toBeDefined();
  });

  it("o nome do arquivo anterior aparece na descrição, para o modelo poder pedi-lo", () => {
    const tools = graphFileTools({ ...ctxBase, gerados: [], anteriores: [anterior] });
    expect(tools.ms_email_enviar_arquivo!.description).toContain(anterior.filename);
  });

  it("anexa os bytes buscados no Storage — o e-mail sai COM anexo", async () => {
    const baixar = vi.fn().mockResolvedValue(Buffer.from("conteudo-do-pdf"));
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 202, json: async () => ({}) });
    const tools = graphFileTools({
      ...ctxBase,
      gerados: [],
      anteriores: [anterior],
      baixar,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await tools.ms_email_enviar_arquivo!.execute!(
      { para: "igor@natcorp.com.br", assunto: "Relatório", corpo: "Segue.", arquivo: anterior.filename },
      { toolCallId: "t1", messages: [] },
    );

    expect(baixar).toHaveBeenCalledWith(anterior.path);
    const chamadaSendMail = fetchImpl.mock.calls.find(([url]) => String(url).includes("/me/sendMail"));
    expect(chamadaSendMail).toBeDefined();
    const corpo = JSON.parse(String((chamadaSendMail![1] as RequestInit).body));
    expect(corpo.message.attachments).toHaveLength(1);
    expect(corpo.message.attachments[0].name).toBe(anterior.filename);
    expect(Buffer.from(corpo.message.attachments[0].contentBytes, "base64").toString()).toBe("conteudo-do-pdf");
  });

  it("o arquivo DESTE turno tem precedência sobre o de mesmo nome na conversa", async () => {
    const baixar = vi.fn().mockResolvedValue(Buffer.from("versao-antiga"));
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 202, json: async () => ({}) });
    const tools = graphFileTools({
      ...ctxBase,
      gerados: [{
        filename: anterior.filename,
        mimeType: "application/pdf",
        base64: Buffer.from("versao-nova").toString("base64"),
      }],
      anteriores: [anterior],
      baixar,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await tools.ms_email_enviar_arquivo!.execute!(
      { para: "a@b.com", assunto: "x", corpo: "y", arquivo: anterior.filename },
      { toolCallId: "t2", messages: [] },
    );

    expect(baixar).not.toHaveBeenCalled();
    const chamada = fetchImpl.mock.calls.find(([url]) => String(url).includes("/me/sendMail"));
    const corpo = JSON.parse(String((chamada![1] as RequestInit).body));
    expect(Buffer.from(corpo.message.attachments[0].contentBytes, "base64").toString()).toBe("versao-nova");
  });

  it("nome que o modelo reescreveu ainda casa, em vez de recusar o envio", async () => {
    const baixar = vi.fn().mockResolvedValue(Buffer.from("pdf"));
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 202, json: async () => ({}) });
    const tools = graphFileTools({
      ...ctxBase, gerados: [], anteriores: [anterior], baixar,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const r = await tools.ms_email_enviar_arquivo!.execute!(
      { para: "a@b.com", assunto: "x", corpo: "y", arquivo: "relatorio-executivo-tony-oliveira" },
      { toolCallId: "t3", messages: [] },
    );

    expect((r as { erro?: string }).erro).toBeUndefined();
    expect(baixar).toHaveBeenCalled();
  });
});
