import { describe, it, expect } from "vitest";
import { emailFuncionalDe, blocoAssinatura, recortarMeusDados } from "./meus-dados";

const PAYLOAD = {
  items: [
    {
      nome: "MARIA DA SILVA",
      matricula: "57292",
      email_funcional: " e_iscardoso@stefanini.com ",
      email_pessoal: "pessoal@gmail.com",
    },
  ],
};

describe("emailFuncionalDe", () => {
  it("lê o campo cru e apara espaços", () => {
    expect(emailFuncionalDe(PAYLOAD)).toBe("e_iscardoso@stefanini.com");
  });

  it("nunca devolve o e-mail PESSOAL no lugar do funcional", () => {
    // A caixa a conectar é a corporativa; cair no pessoal por 'fallback
    // esperto' conectaria justamente a conta errada que a checagem existe para
    // impedir.
    expect(emailFuncionalDe({ items: [{ email_pessoal: "x@gmail.com" }] })).toBeNull();
  });

  it("trata ausente, nulo, 'null' e lixo sem @ como desconhecido", () => {
    expect(emailFuncionalDe({ items: [{}] })).toBeNull();
    expect(emailFuncionalDe({ items: [{ email_funcional: null }] })).toBeNull();
    expect(emailFuncionalDe({ items: [{ email_funcional: "null" }] })).toBeNull();
    expect(emailFuncionalDe({ items: [{ email_funcional: "sem-arroba" }] })).toBeNull();
    expect(emailFuncionalDe(null)).toBeNull();
  });
});

describe("blocoAssinatura", () => {
  it("assina com nome e e-mail funcional, e fixa o remetente real", () => {
    const txt = blocoAssinatura(recortarMeusDados(PAYLOAD));
    expect(txt).toContain("MARIA DA SILVA");
    expect(txt).toContain("e_iscardoso@stefanini.com");
    expect(txt).toContain("não invente outro remetente");
  });

  it("prefere o nome social quando existe", () => {
    const dados = recortarMeusDados({ items: [{ nome: "MARIA DA SILVA", nome_social: "Marina", email_funcional: "m@x.com" }] });
    expect(blocoAssinatura(dados)).toContain("nome: Marina");
  });

  it("sem nome e sem e-mail, não gasta prompt", () => {
    expect(blocoAssinatura(recortarMeusDados({ items: [{ matricula: "1" }] }))).toBe("");
  });
});
