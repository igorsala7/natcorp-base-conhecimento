import { describe, expect, it } from "vitest";
import { montarCorpo, parametrosDoTemplate, separarLista } from "./body-template";

/** O corpo real que o Graph exige para enviar e-mail. */
const SEND_MAIL = {
  message: {
    subject: "{{assunto}}",
    body: { contentType: "Text", content: "{{corpo}}" },
    toRecipients: [{ emailAddress: { address: "{{*para}}" } }],
    ccRecipients: [{ emailAddress: { address: "{{*cc}}" } }],
  },
  saveToSentItems: true,
};

/** O corpo de criação de evento, com Teams e convidados. */
const EVENTO = {
  subject: "{{titulo}}",
  body: { contentType: "HTML", content: "{{descricao}}" },
  start: { dateTime: "{{inicio}}", timeZone: "America/Sao_Paulo" },
  end: { dateTime: "{{fim}}", timeZone: "America/Sao_Paulo" },
  location: { displayName: "{{local}}" },
  attendees: [{ emailAddress: { address: "{{*convidados}}" }, type: "required" }],
  isOnlineMeeting: true,
  onlineMeetingProvider: "teamsForBusiness",
};

describe("montarCorpo — e-mail", () => {
  it("aninha e expande a lista de destinatários", () => {
    expect(
      montarCorpo(SEND_MAIL, {
        assunto: "Reunião",
        corpo: "Segue o combinado.",
        para: "a@x.com, b@y.com",
      }),
    ).toEqual({
      message: {
        subject: "Reunião",
        body: { contentType: "Text", content: "Segue o combinado." },
        toRecipients: [
          { emailAddress: { address: "a@x.com" } },
          { emailAddress: { address: "b@y.com" } },
        ],
        ccRecipients: [],
      },
      saveToSentItems: true,
    });
  });

  it("um destinatário só continua virando array", () => {
    const r = montarCorpo(SEND_MAIL, { assunto: "a", corpo: "b", para: "so@um.com" }) as Record<string, never>;
    expect((r.message as unknown as { toRecipients: unknown[] }).toRecipients).toHaveLength(1);
  });

  it("aceita ponto-e-vírgula — é o que o Outlook usa", () => {
    expect(separarLista("a@x.com; b@y.com")).toEqual(["a@x.com", "b@y.com"]);
  });
});

describe("montarCorpo — campos opcionais", () => {
  it("a chave SOME quando o parâmetro não veio", () => {
    // Não é firula: `location: {displayName: null}` faz o Graph APAGAR o local
    // num PATCH, em vez de deixar como está.
    const r = montarCorpo(EVENTO, {
      titulo: "Alinhamento", inicio: "2026-08-12T14:00:00", fim: "2026-08-12T15:00:00",
    }) as Record<string, unknown>;
    expect(r).not.toHaveProperty("location");
    expect(r).not.toHaveProperty("body");
    expect(r.subject).toBe("Alinhamento");
    expect(r.isOnlineMeeting).toBe(true);
  });

  it("string em branco conta como ausente", () => {
    const r = montarCorpo(EVENTO, { titulo: "x", inicio: "a", fim: "b", local: "   " }) as Record<string, unknown>;
    expect(r).not.toHaveProperty("location");
  });

  it("objeto que ficou vazio depois da poda também some", () => {
    // `{"body": {}}` é tão inválido quanto a chave ausente, e a ausente é honesta.
    const r = montarCorpo({ a: "1", body: { content: "{{nada}}" } }, { a: "1" }) as Record<string, unknown>;
    expect(r).not.toHaveProperty("body");
  });

  it("lista vazia vira array vazio, não objeto com campo em branco", () => {
    // `[{emailAddress:{address:""}}]` faria o Graph responder 400 obscuro.
    const r = montarCorpo(EVENTO, { titulo: "x", inicio: "a", fim: "b" }) as Record<string, unknown>;
    expect(r.attendees).toEqual([]);
  });
});

describe("montarCorpo — interpolação", () => {
  it("substitui dentro de um texto maior", () => {
    expect(montarCorpo({ msg: "Olá {{nome}}, tudo bem?" }, { nome: "Igor" })).toEqual({
      msg: "Olá Igor, tudo bem?",
    });
  });

  it("ausente vira vazio na interpolação, sem deixar o marcador à mostra", () => {
    expect(montarCorpo({ msg: "Olá {{nome}}!" }, {})).toEqual({ msg: "Olá !" });
  });

  it("preserva o TIPO quando o valor é o nó inteiro", () => {
    // `"{{qtd}}"` com 3 tem de virar 3, não "3": o Graph valida tipo.
    expect(montarCorpo({ qtd: "{{qtd}}", ok: "{{ok}}" }, { qtd: 3, ok: false })).toEqual({
      qtd: 3, ok: false,
    });
  });
});

describe("montarCorpo — bordas", () => {
  it("sem template, devolve null e o motor segue plano", () => {
    expect(montarCorpo(null, { a: 1 })).toBeNull();
    expect(montarCorpo(undefined, { a: 1 })).toBeNull();
  });

  it("template sem marcador nenhum passa intacto", () => {
    expect(montarCorpo({ fixo: true, n: 7 }, {})).toEqual({ fixo: true, n: 7 });
  });

  it("valor com chaves no conteúdo não é confundido com marcador", () => {
    expect(montarCorpo({ t: "{{txt}}" }, { txt: "use {{isto}} literalmente" })).toEqual({
      t: "use {{isto}} literalmente",
    });
  });
});

describe("parametrosDoTemplate", () => {
  it("lista todos os marcadores, inclusive os de lista", () => {
    expect(parametrosDoTemplate(SEND_MAIL).sort()).toEqual(["assunto", "cc", "corpo", "para"]);
  });

  it("pega também os interpolados", () => {
    expect(parametrosDoTemplate({ a: "x {{um}} y {{dois}}" }).sort()).toEqual(["dois", "um"]);
  });
});
