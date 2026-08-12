import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { redirectUri } from "./redirect-uri";

/**
 * `AADSTS900971: No reply address provided` (12/08/2026, produção): a variável
 * estava vazia no container, o retorno saiu como CAMINHO relativo e o provedor
 * leu como "endereço nenhum" — mandando investigar o cadastro do app, onde não
 * havia nada de errado.
 */
const original = process.env.NEXT_PUBLIC_SITE_URL;
afterEach(() => { process.env.NEXT_PUBLIC_SITE_URL = original; });
beforeEach(() => { delete process.env.NEXT_PUBLIC_SITE_URL; });

describe("redirectUri", () => {
  it("monta a URL de retorno a partir da URL pública, com o basePath", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.natcorpbr.com.br/natcorp/ia";
    expect(redirectUri("microsoft")).toBe(
      "https://www.natcorpbr.com.br/natcorp/ia/api/v1/connect/microsoft/callback",
    );
  });

  it("ignora barra sobrando no fim — o provedor compara byte a byte", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://x.com/ia//";
    expect(redirectUri("google")).toBe("https://x.com/ia/api/v1/connect/google/callback");
  });

  it("recusa quando a variável falta, em vez de mandar um caminho relativo", () => {
    expect(() => redirectUri("microsoft")).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("recusa valor sem esquema — 'www.site.com' não é endereço de retorno", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "www.natcorpbr.com.br/natcorp/ia";
    expect(() => redirectUri("microsoft")).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });
});
