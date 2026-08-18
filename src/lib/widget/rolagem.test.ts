import { describe, it, expect } from "vitest";
import fs from "node:fs";

/**
 * A ROLAGEM PRECISA ROLAR.
 *
 * Em 17/08 a refatoração "Rolagem que respeita quem está lendo" trocou
 * `scrollChatFim()` (que fazia `scrollTop = scrollHeight`) por `rolarChat()` —
 * e no corpo da função nova a linha que ROLA virou uma chamada a ela mesma:
 *
 *   function rolarChat(forcar) {
 *     …
 *     rolarChat();        // recursão infinita
 *   } catch (e) { }       // RangeError engolido
 *
 * A pilha estourava, o `catch` vazio engolia o erro, e o resultado era rolagem
 * que nunca acontecia SEM nada no console. O `catch` existia para tolerar o
 * elemento não montado; acabou tolerando o defeito.
 *
 * `public/widget.js` é um IIFE de 8 mil linhas sem ponto de entrada para teste
 * unitário, mas este defeito é textual — e a função é chamada em 30 lugares.
 */
const W = fs.readFileSync("public/widget.js", "utf-8");
// Fatia DEPOIS da linha de declaração: o nome da função aparece nela, e casaria
// com a busca por "chama a si mesma".
const _ini = W.indexOf("function rolarChat(forcar)");
const corpo = W.slice(W.indexOf("\n", _ini), W.indexOf("function scrollChatFim()"));

describe("rolarChat", () => {
  it("atribui scrollTop — a linha que de fato rola", () => {
    expect(corpo).toMatch(/messagesEl\.scrollTop\s*=\s*messagesEl\.scrollHeight/);
  });

  it("NÃO chama a si mesma", () => {
    // Comentários fora antes de procurar: o comentário do conserto CITA o
    // defeito ("virou `rolarChat()`"), e sem tirá-lo documentar o bug faria o
    // teste acusar o bug.
    const codigo = corpo.replace(/\/\/.*$/gm, "");
    expect(codigo).not.toMatch(/\brolarChat\s*\(/);
  });

  it("continua respeitando quem subiu para reler", () => {
    // O conserto não pode desfazer o propósito da refatoração: status de
    // ferramenta não arrasta de volta quem foi ler um número mais acima.
    expect(corpo).toContain("_leitorSubiu");
    expect(corpo).toMatch(/if\s*\(\s*forcar\s*\)/);
  });
});
