import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PROVIDER_LABEL,
  PURPOSES,
  PURPOSE_GROUPS,
  enxergaImagem,
  modelosDe,
  processaNoBrasil,
  recusaTemperatura,
  suportaFinalidade,
  type ProviderKind,
} from "./catalog";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

/**
 * Lista do CHECK da migration MAIS RECENTE que recria a constraint. É ela que
 * vale no banco: cada recriação substitui a anterior inteira.
 */
function listaDoCheck(constraint: string): string[] {
  const arquivo = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .reverse()
    .find((f) => readFileSync(join(MIGRATIONS, f), "utf8").includes(`add constraint ${constraint}`));
  if (!arquivo) throw new Error(`nenhuma migration recria ${constraint}`);
  const sql = readFileSync(join(MIGRATIONS, arquivo), "utf8");
  const trecho = sql.slice(sql.indexOf(`add constraint ${constraint}`));
  const dentro = trecho.slice(trecho.indexOf("in (") + 4, trecho.indexOf(")"));
  return [...dentro.matchAll(/'([^']+)'/g)].map((m) => m[1] ?? "");
}

describe("catálogo × banco", () => {
  // Já aconteceu duas vezes: finalidade nova no catálogo, CHECK antigo no
  // banco, e salvar a atribuição falhava com "violates check constraint".
  it("toda finalidade do catálogo é aceita pelo CHECK de ai_assignments", () => {
    const noBanco = listaDoCheck("ai_assignments_purpose_check");
    for (const p of PURPOSES) expect(noBanco, `falta '${p.key}' na migration`).toContain(p.key);
  });

  it("todo provedor do catálogo é aceito pelo CHECK de ai_providers", () => {
    const noBanco = listaDoCheck("ai_providers_kind_check");
    for (const k of Object.keys(PROVIDER_LABEL)) expect(noBanco, `falta '${k}' na migration`).toContain(k);
  });

  it("toda finalidade pertence a um grupo que existe na tela", () => {
    const grupos = new Set<string>(PURPOSE_GROUPS.map((g) => g.key));
    for (const p of PURPOSES) expect(grupos.has(p.grupo), p.key).toBe(true);
  });

  it("provedor gravado no banco que o código ainda não conhece não quebra a tela", () => {
    // 13/10/2026: linha `maritaca` gravada antes do deploy derrubou Sistema → IA.
    const novo = "provedor-do-futuro" as ProviderKind;
    for (const p of PURPOSES) {
      expect(suportaFinalidade(novo, p.key)).toBe(false);
      expect(modelosDe(novo, p.key)).toEqual([]);
    }
  });
});

describe("Maritaca", () => {
  const m: ProviderKind = "maritaca";

  it("não aparece em Embeddings nem em Transcrição (a API não tem)", () => {
    expect(suportaFinalidade(m, "embedding")).toBe(false);
    expect(suportaFinalidade(m, "transcricao")).toBe(false);
  });

  it("serve para chat e para OCR, com sugestões próprias", () => {
    expect(suportaFinalidade(m, "chat")).toBe(true);
    expect(suportaFinalidade(m, "ocr")).toBe(true);
    expect(modelosDe(m, "chat")).toContain("sabia-4");
    expect(modelosDe(m, "ocr")[0]).toBe("sabiazinho-4-br-sp");
  });

  it("só os modelos -br-sp contam como processados no Brasil", () => {
    expect(processaNoBrasil(m, "sabia-4-br-sp")).toBe(true);
    expect(processaNoBrasil(m, "sabia-4")).toBe(false);
    expect(processaNoBrasil("google", "gemini-3.5-flash-br-sp")).toBe(false);
  });

  it("é o único provedor sem visão", () => {
    expect(enxergaImagem(m)).toBe(false);
    for (const k of ["anthropic", "openai", "google"] as const) expect(enxergaImagem(k)).toBe(true);
  });
});

describe("recusaTemperatura (sondado contra a API em 14/10/2026)", () => {
  it("só os Claude que devolvem 400 por causa do parâmetro", () => {
    for (const m of ["claude-opus-5", "claude-opus-5-5", "claude-haiku-5-5", "claude-opus-5-20261001"])
      expect(recusaTemperatura("anthropic", m), m).toBe(true);
    for (const m of ["claude-haiku-4-5", "claude-sonnet-5", "claude-sonnet-5-5", "claude-fable-5", "claude-fable-5-1", "claude-opus-4-8"])
      expect(recusaTemperatura("anthropic", m), m).toBe(false);
  });

  it("nome igual em outro provedor não conta", () => {
    expect(recusaTemperatura("openai", "claude-opus-5")).toBe(false);
    expect(recusaTemperatura("maritaca", "sabia-4")).toBe(false);
  });
});
