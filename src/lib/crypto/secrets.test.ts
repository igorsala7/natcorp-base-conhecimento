import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  encryptSecret,
  decryptSecret,
  tryDecryptSecret,
  maskSecret,
  hasEncryptionKey,
  SecretError,
} from "./secrets";

const CHAVE = "chave-mestra-de-teste-com-tamanho-suficiente";

beforeEach(() => {
  process.env.APP_ENCRYPTION_KEY = CHAVE;
});
afterEach(() => {
  delete process.env.APP_ENCRYPTION_KEY;
});

describe("encrypt/decrypt", () => {
  it("ida e volta preserva o valor", () => {
    const segredo = "sk-proj-abc123XYZ/+=";
    expect(decryptSecret(encryptSecret(segredo))).toBe(segredo);
  });

  it("preserva acento e emoji (a chave pode ser qualquer string)", () => {
    const s = "señha-çom-acento-🔐";
    expect(decryptSecret(encryptSecret(s))).toBe(s);
  });

  // Se duas cifragens do mesmo texto fossem iguais, dava para inferir que duas
  // contas usam a mesma chave só olhando o banco.
  it("o mesmo texto cifra DIFERENTE a cada chamada (IV aleatório)", () => {
    const a = encryptSecret("mesma-coisa");
    const b = encryptSecret("mesma-coisa");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  it("o texto cifrado não contém o segredo em claro", () => {
    expect(encryptSecret("SEGREDO-VISIVEL")).not.toContain("SEGREDO-VISIVEL");
  });

  // O ponto do GCM: adulteração é DETECTADA, não devolve lixo.
  it("payload adulterado falha em vez de devolver texto errado", () => {
    const bom = encryptSecret("valor-original");
    const partes = bom.split(":");
    const ctAdulterado = Buffer.from(partes[3]!, "base64url");
    ctAdulterado[0] = ctAdulterado[0]! ^ 0xff;
    const ruim = [partes[0], partes[1], partes[2], ctAdulterado.toString("base64url")].join(":");
    expect(() => decryptSecret(ruim)).toThrow(SecretError);
  });

  it("tag de autenticação trocada falha", () => {
    const a = encryptSecret("um");
    const b = encryptSecret("dois");
    const pa = a.split(":");
    const pb = b.split(":");
    const misturado = [pa[0], pa[1], pb[2], pa[3]].join(":");
    expect(() => decryptSecret(misturado)).toThrow(SecretError);
  });

  it("chave-mestra diferente não decifra", () => {
    const cifrado = encryptSecret("valor");
    process.env.APP_ENCRYPTION_KEY = "outra-chave-mestra-completamente-distinta";
    expect(() => decryptSecret(cifrado)).toThrow(SecretError);
  });

  it.each(["", "lixo", "v1:só:duas", "v2:a:b:c", "::::"])(
    "payload malformado (%s) lança SecretError, não quebra o processo",
    (ruim) => {
      expect(() => decryptSecret(ruim)).toThrow(SecretError);
    },
  );

  it("sem a env, cifrar e decifrar falham com mensagem clara", () => {
    delete process.env.APP_ENCRYPTION_KEY;
    expect(hasEncryptionKey()).toBe(false);
    expect(() => encryptSecret("x")).toThrow(/APP_ENCRYPTION_KEY/);
  });

  it("env curta demais é recusada (senão a segurança seria de fachada)", () => {
    process.env.APP_ENCRYPTION_KEY = "curta";
    expect(hasEncryptionKey()).toBe(false);
    expect(() => encryptSecret("x")).toThrow(SecretError);
  });
});

describe("tryDecryptSecret", () => {
  it("devolve null em vez de lançar", () => {
    expect(tryDecryptSecret("lixo")).toBeNull();
    expect(tryDecryptSecret(null)).toBeNull();
    expect(tryDecryptSecret(undefined)).toBeNull();
  });
  it("decifra normalmente quando o payload é válido", () => {
    expect(tryDecryptSecret(encryptSecret("ok"))).toBe("ok");
  });
});

describe("maskSecret", () => {
  it("mostra pontas e esconde o miolo", () => {
    expect(maskSecret("sk-proj-1234567890abcd")).toBe("sk-…abcd");
  });
  it("segredo curto vira só pontos (não dá pistas)", () => {
    expect(maskSecret("1234")).toBe("••••");
  });
  it("vazio vira travessão", () => {
    expect(maskSecret(null)).toBe("—");
  });
});
