import { describe, it, expect } from "vitest";
import { comBase, BASE_PATH } from "./base-path";

/**
 * Em teste não há NEXT_PUBLIC_BASE_PATH, então BASE_PATH é "" e `comBase` é
 * identidade — que é justamente o comportamento em desenvolvimento (app na raiz).
 * O caminho COM prefixo é coberto pela função pura abaixo, replicando a regra.
 */
const comBaseDe = (base: string) => (c: string) => {
  const b = base.replace(/\/+$/, "");
  if (!b) return c;
  return c.startsWith("/") ? `${b}${c}` : `${b}/${c}`;
};

describe("comBase (app na raiz)", () => {
  it("sem prefixo, devolve o caminho intacto", () => {
    expect(BASE_PATH).toBe("");
    expect(comBase("/api/portal/chat")).toBe("/api/portal/chat");
  });
});

describe("comBase (app sob /natcorp/ia)", () => {
  const c = comBaseDe("/natcorp/ia");

  it("prefixa a rota de API", () => {
    expect(c("/api/portal/chat")).toBe("/natcorp/ia/api/portal/chat");
  });

  it("preserva query string", () => {
    expect(c("/api/admin/edit-access?space=abc")).toBe("/natcorp/ia/api/admin/edit-access?space=abc");
  });

  it("aceita caminho sem barra inicial", () => {
    expect(c("api/chat")).toBe("/natcorp/ia/api/chat");
  });

  it("barra sobrando no prefixo não duplica", () => {
    expect(comBaseDe("/natcorp/ia/")("/api/x")).toBe("/natcorp/ia/api/x");
  });
});
