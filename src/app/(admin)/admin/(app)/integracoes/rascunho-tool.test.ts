import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * O RASCUNHO PRECISA CONHECER TODOS OS CAMPOS.
 *
 * O editor de tool guarda o que foi digitado e não salvo, e o instantâneo é o
 * próprio `payload()` — o mesmo objeto que vai para o servidor. Isso resolve
 * metade do problema: campo novo entra no rascunho de graça.
 *
 * A outra metade não é automática. Quem REPÕE o formulário lista os campos um a
 * um (`setKey(v.key)`, `setName(v.name)`…), porque o estado são vinte
 * `useState` separados. Um campo que entre no `payload` e não entre ali é
 * guardado e nunca devolvido: a pessoa recarrega a página, vê o aviso
 * "recuperamos o que você preencheu", e aquele campo volta vazio — sem erro,
 * sem aviso, e pior do que não ter recuperado nada, porque agora ela confia no
 * que está vendo.
 *
 * É a mesma anatomia que esta base já produziu várias vezes: duas listas do
 * mesmo conjunto, mantidas à mão, divergindo em silêncio. Aqui a segunda lista
 * é inevitável — o que não é inevitável é ninguém comparar.
 */
const fonte = readFileSync(fileURLToPath(new URL("./tools-manager.tsx", import.meta.url)), "utf8");

/** Campos que o `payload()` devolve. */
function camposDoPayload(): string[] {
  const i = fonte.indexOf("  function payload() {");
  expect(i, "função payload() não encontrada").toBeGreaterThan(-1);
  const corpo = fonte.slice(fonte.indexOf("return {", i), fonte.indexOf("\n  }", i));
  const campos: string[] = [];
  for (const linha of corpo.split("\n")) {
    const m = /^ {6}([a-z_][a-z0-9_]*)(:|,)/.exec(linha);
    if (m) campos.push(m[1]!);
  }
  return campos;
}

/** Campos lidos pela restauração do rascunho (`v.<campo>`). */
function camposRestaurados(): Set<string> {
  const i = fonte.indexOf("const rascunho = useRascunho(");
  expect(i, "chamada de useRascunho não encontrada").toBeGreaterThan(-1);
  const corpo = fonte.slice(i, fonte.indexOf("\n  );", i));
  return new Set([...corpo.matchAll(/\bv\.([a-z_][a-z0-9_]*)/g)].map((m) => m[1]!));
}

describe("rascunho do editor de tool", () => {
  it("o payload tem campos (a âncora do teste ainda vale)", () => {
    expect(camposDoPayload().length).toBeGreaterThan(15);
  });

  it("todo campo do payload é REPOSTO na restauração", () => {
    const restaurados = camposRestaurados();
    // `id` é a única exceção legítima: não vem do formulário, vem da tool em
    // edição. Repor o `id` de um rascunho gravaria por cima de outra tool.
    const faltando = camposDoPayload().filter((c) => c !== "id" && !restaurados.has(c));
    expect(faltando, `campos guardados e nunca devolvidos: ${faltando.join(", ")}`).toEqual([]);
  });

  it("a restauração não inventa campo que o payload não tem", () => {
    // Um `v.foo` que o payload não produz é sempre `undefined`, e apagaria o
    // valor que estava na tela.
    const doPayload = new Set(camposDoPayload());
    const sobrando = [...camposRestaurados()].filter((c) => !doPayload.has(c));
    expect(sobrando, `campos repostos que o payload não guarda: ${sobrando.join(", ")}`).toEqual([]);
  });
});
