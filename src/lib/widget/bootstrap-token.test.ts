import { describe, it, expect } from "vitest";
import fs from "node:fs";

/**
 * O BOOTSTRAP PRECISA MANDAR O TOKEN, NÃO O OBJETO QUE O CONTÉM.
 *
 * `public/widget.js` é um IIFE de ~8 mil linhas, sem ponto de entrada para
 * teste unitário. Mas o defeito que motivou este arquivo é textual e teria sido
 * pego por uma leitura do fonte:
 *
 *   var track = ... return tok ? { token: tok } : null;   // OBJETO
 *   u += "&track=" + encodeURIComponent(track);           // vira "[object Object]"
 *
 * O widget SEMPRE mandou `[object Object]` no `/api/v1/config`. O servidor não
 * decodificava, `p_base` ficava vazio, a verificação da base era pulada — e
 * desativar um cliente não surtia efeito nenhum. Valeu para todas as bases desde
 * que o parâmetro existe.
 *
 * O erro é invisível em revisão porque as OUTRAS 13 passagens de `track` estão
 * certas: nas chamadas POST ele vai como `track: track` dentro do JSON, e ali o
 * objeto é o formato esperado. Só o GET precisa da string.
 */
const WIDGET = fs.readFileSync("public/widget.js", "utf-8");

describe("token no bootstrap do widget", () => {
  it("manda a STRING do token, não o objeto", () => {
    expect(WIDGET).toContain("encodeURIComponent(track.token)");
  });

  it("NUNCA serializa o objeto `track` direto numa URL", () => {
    // `encodeURIComponent(track)` produz "[object Object]" — silenciosamente.
    expect(WIDGET).not.toMatch(/encodeURIComponent\(\s*track\s*\)/);
  });

  it("nenhuma outra concatenação de `track` em string", () => {
    // Concatenar o objeto em qualquer string tem o mesmo efeito.
    expect(WIDGET).not.toMatch(/["'`]\s*\+\s*track\s*[;,)+]/);
    expect(WIDGET).not.toMatch(/\$\{\s*track\s*\}/);
  });

  it("o guard checa o CAMPO, não só o objeto", () => {
    // `if (track)` passaria com `{token: ""}`; o que importa é haver token.
    expect(WIDGET).toMatch(/if\s*\(\s*track\s*&&\s*track\.token\s*\)/);
  });
});
