/**
 * FATIAMENTO DE ARTIGO EM CHUNKS — puro, sem servidor.
 *
 * Separado de `chunk.ts` porque aquele módulo importa `@/lib/ai/config` (que lê
 * env na carga) e `server-only`: a função mais importante da busca não tinha um
 * único teste porque não dava para importá-la fora do runtime do Next. Aqui não
 * há env, nem rede, nem Supabase — só texto entra e sai.
 *
 * `chunk.ts` reexporta o que está aqui; nenhum chamador precisou mudar.
 */
import { normalizeDoc } from "@/lib/blocks/convert";
import { blocksToText, richToText } from "@/lib/blocks/serialize";

export type Chunk = { heading_path: string; content: string };

// Tamanho-alvo do chunk (chars). ~500 tokens: bom para embedding (fica MUITO
// abaixo do limite do modelo) e para precisão da busca. Uma seção grande SEM
// heading (ex.: um artigo com milhares de parágrafos) era virava 1 chunk gigante
// que estourava o modelo e era inútil na busca — por isso o corte por tamanho.
export const CHUNK_MAX = 2000;

/**
 * Piso de contexto. Abaixo disto o trecho não se sustenta sozinho na busca:
 * casa por semelhança de letras com quase qualquer pergunta curta e ganha de
 * conteúdo de verdade. Medido no acervo: 815 de 4.526 chunks de artigo (18%)
 * estavam abaixo deste piso.
 */
export const MIN_CONTEXTO = 120;

/** Fatia um texto longo em pedaços de até `max`, cortando em espaço quando dá. */
export function fatiar(s: string, max: number): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    let end = Math.min(i + max, s.length);
    if (end < s.length) {
      const sp = s.lastIndexOf(" ", end);
      if (sp > i + max * 0.6) end = sp; // corta numa palavra, se razoável
    }
    const p = s.slice(i, end).trim();
    if (p) out.push(p);
    i = end;
  }
  return out;
}

/**
 * Particiona o documento por headings: cada H1/H2/H3 inicia um chunk, cujo
 * conteúdo é o texto até o próximo heading. heading_path acumula a trilha.
 * Seções grandes são ainda sub-divididas por TAMANHO (~CHUNK_MAX). Aceita
 * BlockDoc v2 ou TipTap legado (normalizeDoc converte na leitura).
 */
export function chunkArticle(docInput: unknown): Chunk[] {
  const { blocks } = normalizeDoc(docInput);
  const chunks: Chunk[] = [];
  let trail: { level: number; text: string }[] = [];
  let current: { heading_path: string; titulo: string; parts: string[] } = {
    heading_path: "",
    titulo: "",
    parts: [],
  };

  /**
   * Títulos de seções SEM CORPO, esperando o próximo chunk.
   *
   * Um heading seguido direto de outro heading produzia um chunk com o título e
   * nada mais: "Ativar Processos", 16 caracteres. Medido no acervo, 300 dos 365
   * chunks com menos de 40 caracteres eram exatamente isso.
   *
   * O estrago não é ocupar espaço, é competir na busca. Trecho minúsculo casa
   * por semelhança de letras com quase qualquer pergunta curta — foi assim que
   * "preencha o campo" recuperava um documento inteiro por causa de um chunk de
   * 22 caracteres que dizia só "Campo de Preenchimento", cabeçalho de uma
   * tabela. Acerto por coincidência, não por conteúdo.
   *
   * Some para FRENTE, nunca para trás: um título anuncia o que vem depois.
   */
  let pendentes: string[] = [];

  const push = (texto: string) => {
    const content = texto.replace(/\s+\n/g, "\n").trim();
    if (!content) return;
    const comTitulos = pendentes.length ? pendentes.join("\n") + "\n" + content : content;
    pendentes = [];

    /**
     * Trecho ainda curto depois de tudo (seção real, corpo de uma linha) leva a
     * trilha dos ANCESTRAIS junto. O título imediato já está no conteúdo — quem
     * falta é o caminho que diz de qual manual e de qual capítulo ele veio.
     *
     * Não é fundir com a seção vizinha: em manual importado isso misturaria
     * assuntos que só estão perto por acidente de diagramação. É dar ao trecho o
     * mínimo para ele significar alguma coisa sozinho. "resistência do
     * talabarte." não distingue nada; sob "NR-35 > ALTURA > Proteção contra
     * quedas", distingue.
     */
    const final =
      comTitulos.length < MIN_CONTEXTO
        ? [current.heading_path.split(" > ").slice(0, -1).join(" > "), comTitulos]
            .filter(Boolean)
            .join("\n")
        : comTitulos;

    chunks.push({ heading_path: current.heading_path, content: final });
  };

  const flush = () => {
    const corpo = current.parts
      .filter((p) => p.trim())
      .join("\n")
      .trim();
    // Seção que só tem o próprio título: não vira chunk, viaja para o próximo.
    // `heading_path` sozinho não bastaria para preservá-lo — a trilha é filtrada
    // por nível, então um título irmão seguinte o apagaria do caminho.
    if (corpo && corpo === current.titulo.trim()) {
      pendentes.push(corpo);
      current.parts = [];
      return;
    }
    let buf = "";
    for (const p of current.parts) {
      if (p.length > CHUNK_MAX) {
        // parágrafo isolado maior que o limite → fecha o buffer e fatia por tamanho
        if (buf) { push(buf); buf = ""; }
        for (const pedaco of fatiar(p, CHUNK_MAX)) push(pedaco);
        continue;
      }
      if (buf && buf.length + 1 + p.length > CHUNK_MAX) { push(buf); buf = ""; }
      buf = buf ? buf + "\n" + p : p;
    }
    if (buf) push(buf);
  };

  for (const block of blocks) {
    if (block.type === "heading") {
      flush();
      const level = block.data.level;
      const text = richToText(block.text).trim();
      trail = trail.filter((t) => t.level < level);
      trail.push({ level, text });
      current = {
        heading_path: trail.map((t) => t.text).join(" > "),
        titulo: text,
        parts: text ? [text] : [],
      };
    } else {
      current.parts.push(blocksToText([block]));
    }
  }
  flush();

  /**
   * Títulos que sobraram no fim (documento termina em heading sem corpo).
   * Grudam no ÚLTIMO chunk em vez de virar fragmento — e se não houver chunk
   * nenhum, viram um: documento só de títulos precisa continuar achável, senão
   * a correção derrubaria o nó da busca inteira.
   */
  if (pendentes.length) {
    const ultimo = chunks[chunks.length - 1];
    if (ultimo) ultimo.content = `${ultimo.content}\n${pendentes.join("\n")}`;
    else chunks.push({ heading_path: current.heading_path, content: pendentes.join("\n") });
  }
  return chunks;
}
