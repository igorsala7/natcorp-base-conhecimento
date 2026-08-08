/**
 * A pergunta pede DOCUMENTAÇÃO (como usar, o que é, qual a regra)?
 *
 * Serve a uma decisão só: no modo RELATÓRIO, carregar ou não os trechos da
 * documentação no prompt.
 *
 * ── O que a medição mostrou ─────────────────────────────────────────────────
 * Em 156 turnos de modo relatório, o bloco de RAG custou 1.078.130 tokens (já
 * multiplicados pelos passos do laço) e **93% das respostas não citaram fonte
 * alguma** — o prompt obriga a citar, então a ausência da marca `[n]` é sinal
 * forte de que a documentação não foi usada. Faz sentido: "Quantos colaboradores
 * por centro de custo?" e "Gere um gráfico" se respondem com os dados da tela,
 * não com o manual.
 *
 * ── Por que este recorte é seguro ───────────────────────────────────────────
 * O modo relatório JÁ exclui `perguntaComposta`, que captura "regra", "política",
 * "manual", "documento", "no sistema". Ou seja, pergunta de relatório misturada
 * com norma nem chega aqui — sai do modo relatório antes. O que resta é a
 * intenção de USO ("como preencho isso?", "o que faz esta tela?"), que é
 * justamente o que esta função reconhece.
 *
 * Na dúvida, MANTÉM a documentação: perder um trecho útil estraga a resposta;
 * carregar um trecho inútil só custa token.
 *
 * Puro (sem IO): testável isolado.
 */
import { pareceTutorial } from "./form-fields";

/**
 * Conceito e regra de negócio — o que o `pareceTutorial` não cobre porque ele
 * mira em "como opero ESTA tela". Aqui entram as perguntas de significado.
 */
const RX_CONCEITO = [
  // "o que é/são/significa <algo>" — sem exigir o demonstrativo do pareceTutorial.
  /\bo que (e|sao|significa|quer dizer)\b/,
  // "o que ESSE PROGRAMA FAZ?" — pergunta real do trace. O verbo vem depois do
  // sujeito, então não casa nenhum padrão de prefixo; a janela curta entre "o
  // que" e o verbo evita casar frase de dado ("o que mostra a coluna 3").
  /\bo que\b[^?.!]{0,40}\b(faz|fazem|serve|servem|significa|representa)\b/,
  /\bpara que serve\b/,
  /\bqual (e )?(a|o) (regra|politica|norma|criterio|prazo|diferenca)\b/,
  /\bquando (devo|posso|deve|precisa)\b/,
  /\b(posso|devo|preciso) (fazer|lancar|solicitar|pedir|registrar)\b/,
  /\bcomo (faco|fazer|funciona|proceder|solicito|solicitar|lanco|lancar)\b/,
  /\b(explica|explique|explicar|documenta|documentacao|manual|ajuda sobre)\b/,
  /\bme (ajuda|ajude) a (usar|utilizar|entender|preencher)\b/,
];

export function intencaoDocumental(pergunta: string): boolean {
  const q = String(pergunta ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (!q.trim()) return false;
  if (pareceTutorial(pergunta)) return true;
  return RX_CONCEITO.some((r) => r.test(q));
}
