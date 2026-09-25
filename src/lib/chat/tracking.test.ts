import { describe, it, expect } from "vitest";
import { TRACKING_KEYS, trackingFields } from "./tracking";

describe("TRACKING_KEYS", () => {
  it("tem as treze chaves, incluindo as seis novas de 24/09", () => {
    expect(TRACKING_KEYS).toHaveLength(13);
    for (const k of [
      "p_filial",
      "p_centro_custo",
      "p_unidade_adm",
      "p_unidade_negocio",
      "p_vinculo",
      "p_sindicato",
    ]) {
      expect(TRACKING_KEYS).toContain(k);
    }
  });
});

describe("trackingFields", () => {
  it("extrai as novas e ignora o que não é chave de rastreio", () => {
    const out = trackingFields({
      p_filial: " F1 ",
      p_sindicato: "SINDPD",
      p_qualquer_coisa: "x",
    });
    expect(out).toEqual({ p_filial: "F1", p_sindicato: "SINDPD" });
  });

  it("descarta valor que fica vazio depois do trim", () => {
    expect(trackingFields({ p_vinculo: "   " })).toEqual({});
  });
});
