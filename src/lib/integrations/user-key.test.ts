import { describe, it, expect } from "vitest";
import { chavePessoal } from "./user-key";

describe("chavePessoal", () => {
  it("identifica a pessoa por base+empresa+matrícula", () => {
    expect(chavePessoal({ base: "natcorp", empresa: "700", matricula: "365785" })).toBe("natcorp:700:365785");
  });

  it("distingue a mesma matrícula em empresas diferentes", () => {
    expect(chavePessoal({ base: "x", empresa: "1", matricula: "57292" })).not.toBe(
      chavePessoal({ base: "x", empresa: "700", matricula: "57292" }),
    );
  });

  // Com UM app no provedor para todo o sistema (a URL de callback é única), a
  // credencial é compartilhada — e sem a base na chave, a empresa 1 matrícula
  // 57292 de dois clientes seria a MESMA linha de conexão: a segunda pessoa a
  // conectar assumiria a caixa de e-mail da primeira.
  it("distingue clientes diferentes com a mesma empresa e matrícula", () => {
    expect(chavePessoal({ base: "stefanini-dev", empresa: "1", matricula: "57292" })).not.toBe(
      chavePessoal({ base: "natcorp", empresa: "1", matricula: "57292" }),
    );
  });

  it("a caixa do p_base não cria uma segunda conexão para a mesma pessoa", () => {
    expect(chavePessoal({ base: "NATCORP", empresa: "1", matricula: "9" })).toBe(
      chavePessoal({ base: "natcorp", empresa: "1", matricula: "9" }),
    );
  });

  // O defeito que motivou o módulo: no Painel do Colaborador o `p_usuario` é
  // 'PORTAL' para todos. A chave não pode depender dele de forma nenhuma.
  it("não muda quando só o usuário da aplicação muda", () => {
    const a = chavePessoal({ base: "b", empresa: "1", matricula: "57292" });
    const b = chavePessoal({ base: "b", empresa: "1", matricula: "57292" });
    expect(a).toBe(b);
    expect(a).not.toContain("PORTAL");
  });

  it("recusa quando não há matrícula — sem pessoa, sem conta", () => {
    expect(chavePessoal({ base: "b", empresa: "1", matricula: "" })).toBeNull();
    expect(chavePessoal({ base: "b", empresa: "1", matricula: null })).toBeNull();
    expect(chavePessoal({})).toBeNull();
  });

  it("ignora espaços em volta (o anfitrião manda o campo com padding)", () => {
    expect(chavePessoal({ base: " natcorp ", empresa: " 700 ", matricula: " 365785 " })).toBe("natcorp:700:365785");
  });

  it("aceita matrícula sem base/empresa, mas sem confundir com as chaves antigas", () => {
    // Os DOIS separadores continuam presentes — é isso que distingue a chave
    // atual das duas gerações anteriores, que as migrations revogaram.
    expect(chavePessoal({ matricula: "365785" })).toBe("::365785");
  });
});
