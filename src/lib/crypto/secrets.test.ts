import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isPlainSecret,
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

  // Concessão consciente ao ambiente de desenvolvimento: sem a chave-mestra o
  // segredo é gravado em CLARO, com prefixo explícito, em vez de bloquear.
  it("SEM a env, grava em texto simples com prefixo e faz a volta", () => {
    delete process.env.APP_ENCRYPTION_KEY;
    expect(hasEncryptionKey()).toBe(false);
    const guardado = encryptSecret("sk-proj-em-claro");
    expect(guardado).toBe("plain:sk-proj-em-claro");
    expect(isPlainSecret(guardado)).toBe(true);
    expect(decryptSecret(guardado)).toBe("sk-proj-em-claro");
  });

  it("env curta demais também cai no modo em claro (não finge segurança)", () => {
    process.env.APP_ENCRYPTION_KEY = "curta";
    expect(hasEncryptionKey()).toBe(false);
    expect(isPlainSecret(encryptSecret("x"))).toBe(true);
  });

  // O caso que justifica `slice` em vez de `split(":")`.
  it("segredo em claro com ':' no meio sobrevive inteiro", () => {
    delete process.env.APP_ENCRYPTION_KEY;
    const bicho = "user:pass:with:colons";
    expect(decryptSecret(encryptSecret(bicho))).toBe(bicho);
  });

  it("segredo CIFRADO não é confundido com texto simples", () => {
    const cifrado = encryptSecret("valor");
    expect(cifrado.startsWith("v1:")).toBe(true);
    expect(isPlainSecret(cifrado)).toBe(false);
  });

  // Compatibilidade nos dois sentidos: definir a env depois não invalida o que
  // já foi gravado em claro.
  it("segredo gravado em claro continua legível DEPOIS de definir a chave-mestra", () => {
    delete process.env.APP_ENCRYPTION_KEY;
    const antigo = encryptSecret("chave-antiga");
    process.env.APP_ENCRYPTION_KEY = CHAVE;
    expect(decryptSecret(antigo)).toBe("chave-antiga");
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
