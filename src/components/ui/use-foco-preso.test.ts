import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Regressão de um bug que apareceu na modal "Onde importar?": a cada caractere
 * digitado no nome da nova pasta, o foco voltava sozinho para o `<select>` de
 * documentação — impossível escrever uma palavra inteira.
 *
 * A causa não estava naquela tela, e sim aqui: o efeito que prende o foco tinha
 * `onClose` nas dependências. Todo chamador passa uma arrow inline, cuja
 * identidade muda a cada render; digitar → setState → render → nova função →
 * efeito remontado → foco devolvido ao primeiro campo.
 *
 * Não há jsdom no projeto (ambiente `node`), então o teste é sobre a FONTE.
 * É um guarda grosseiro, mas pega exatamente a regressão que já aconteceu:
 * qualquer valor reativo que mude a cada render voltando para essas deps.
 *
 * O efeito saiu do `dialog.tsx` para `use-foco-preso.ts` quando o drawer
 * "Perguntar à IA" passou a usar a mesma armadilha de foco — o guarda seguiu
 * junto, e agora protege os dois de uma vez.
 */
const fonte = readFileSync(fileURLToPath(new URL("./use-foco-preso.ts", import.meta.url)), "utf8");

describe("useFocoPreso — foco preso", () => {
  it("o efeito do foco depende SÓ de `open`", () => {
    // Deps de todos os useEffect do arquivo, na ordem em que aparecem.
    const deps = [...fonte.matchAll(/\n\s*\},\s*\[([^\]]*)\]\);/g)].map((m) => m[1]!.trim());
    // O último é o efeito grande (foco + Esc + Tab); o primeiro só sincroniza o ref.
    expect(deps.at(-1)).toBe("aberto");
  });

  it("`onClose` é chamado por ref dentro do efeito, não capturado direto", () => {
    const efeito = fonte.slice(fonte.indexOf("if (!aberto) return;"), fonte.lastIndexOf("}, [aberto]);"));
    expect(efeito).toContain("onCloseRef.current()");
    // Nenhuma chamada direta a `onClose(` no corpo do efeito — seria stale.
    expect(/[^.]\bonClose\(/.test(efeito)).toBe(false);
  });
});
