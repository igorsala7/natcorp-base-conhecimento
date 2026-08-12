import { describe, it, expect } from "vitest";
import { avisoContaPendente } from "./conta-pendente";

describe("avisoContaPendente", () => {
  it("sem pendência, não gasta um token de prompt", () => {
    expect(avisoContaPendente([])).toBe("");
  });

  // O caso real: `ms_email_enviar` cadastrado e habilitado, cortado por falta de
  // conexão, e o modelo respondendo "não tenho uma ferramenta de envio de
  // e-mail". O aviso precisa dizer as três coisas: a ferramenta EXISTE, o que
  // falta, e que não é para inventar contorno.
  it("diz que a ferramenta existe, o que falta e proíbe o contorno", () => {
    const txt = avisoContaPendente([
      { provider: "microsoft", motivo: "sem_conexao", tools: ["Enviar e-mail"] },
    ]);
    expect(txt).toContain("EXISTEM");
    expect(txt).toContain("Conectar Microsoft");
    expect(txt).toContain("NUNCA diga que a ferramenta não existe");
    expect(txt).toContain("Outlook"); // o contorno nomeado, para o modelo não repetir
  });

  it("separa o que o usuário resolve do que é do administrador", () => {
    const usuario = avisoContaPendente([
      { provider: "microsoft", motivo: "sem_conexao", tools: ["Enviar e-mail"] },
    ]);
    const admin = avisoContaPendente([
      { provider: "microsoft", motivo: "sem_credencial", tools: ["Enviar e-mail"] },
    ]);
    expect(usuario).toContain("AINDA NÃO conectou");
    expect(admin).toContain("ADMINISTRADOR");
    expect(admin).not.toContain("Conectar Microsoft"); // botão que não resolveria nada
  });

  it("nomeia o provedor de cada pendência", () => {
    const txt = avisoContaPendente([
      { provider: "microsoft", motivo: "sem_conexao", tools: ["Enviar e-mail"] },
      { provider: "google", motivo: "sem_conexao", tools: ["Agenda"] },
    ]);
    expect(txt).toContain("Microsoft (Enviar e-mail)");
    expect(txt).toContain("Google (Agenda)");
  });

  it("sem identidade na conversa, não manda conectar — manda entrar logado", () => {
    const txt = avisoContaPendente([
      { provider: "microsoft", motivo: "sem_identidade", tools: ["Enviar e-mail"] },
    ]);
    expect(txt).toContain("matrícula");
    expect(txt).not.toContain("Conectar Microsoft");
  });
});
