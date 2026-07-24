import "server-only";
import { generateText } from "ai";
import { languageModel, hasAiKey, aiTimeout, ehTimeout } from "@/lib/ai/config";
import { CONTENT_INSTRUCTIONS, CABECALHO_PREFERENCIAS, PADRAO_DE_ARTIGO } from "./prompts";
import type { Block, BlockDoc } from "@/lib/blocks/schema";
import { blocksToText } from "@/lib/blocks/serialize";
import { sanitizeDoc } from "./rich-blocks";
import {
  segmentarTexto,
  contarPalavras,
  contencaoDePalavras,
  paragrafosAusentes,
  MINIMO_PALAVRAS,
  MINIMO_CONTENCAO,
} from "./segment";
import { reinsertImages, type ImageRef } from "./reinsert-images";

/**
 * PASSA B: gera o CONTEÚDO de UM artigo como BlockDoc RICO (todos os blocos do
 * editor). Ao contrário do "Melhorar layout" (schema plano rígido), aqui a saída
 * é JSON LIVRE — validada/coercida por `sanitizeDoc`, o que destrava aninhamento,
 * marcas inline, mermaid, mídia etc.
 *
 * Fidelidade com REDE: se a IA resumir/parafrasear (ou falhar), o artigo cai
 * para PARÁGRAFOS FIÉIS do texto-fonte — nunca falha a importação inteira nem
 * grava conteúdo inventado. O aviso sobe no log.
 */
export type GenerateArticleResult = {
  doc: BlockDoc;
  /** Preenchido quando o resultado foi degradado (fallback fiel). */
  aviso?: string;
};

/** Extrai o objeto JSON de uma resposta que pode vir com cerca ```json ou prosa em volta. */
function parseLoose(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const cru = (fence ? fence[1]! : text).trim();
  const i = cru.indexOf("{");
  const j = cru.lastIndexOf("}");
  const alvo = i >= 0 && j > i ? cru.slice(i, j + 1) : cru;
  return JSON.parse(alvo);
}

function comImagens(doc: BlockDoc, images: ImageRef[]): BlockDoc {
  return images.length ? reinsertImages(doc, images) : doc;
}

export async function generateArticle(
  sectionText: string,
  images: ImageRef[] = [],
  /** Direção do autor (diretivas de FORMATO das perguntas de layout). */
  direcao?: string,
): Promise<GenerateArticleResult> {
  const texto = sectionText.trim();
  if (!texto) return { doc: sanitizeDoc(null, "") };
  if (!(await hasAiKey("import_layout"))) {
    return { doc: sanitizeDoc(null, texto), aviso: "sem IA de layout configurada; parágrafos fiéis" };
  }

  const segmentos = segmentarTexto(texto);
  const model = await languageModel("import_layout");
  // Mesmas receitas de composição do editor/estúdio/"Melhorar layout" — assim o
  // artigo importado sai no MESMO padrão dos criados à mão, não numa versão pobre.
  const cabecalho =
    CONTENT_INSTRUCTIONS +
    "\n\n" +
    PADRAO_DE_ARTIGO +
    (direcao ? `\n\n${CABECALHO_PREFERENCIAS}\n${direcao}` : "");

  const blocos: Block[] = [];
  let degradou = false;

  for (const seg of segmentos) {
    let doc: BlockDoc | null = null;
    for (let tentativa = 0; tentativa < 2 && !doc; tentativa++) {
      try {
        const reforco =
          tentativa > 0
            ? "\n\nATENÇÃO: devolva SOMENTE o JSON { \"blocks\": [...] }, sem cerca nem comentários."
            : "";
        const { text } = await generateText({
          model,
          prompt: cabecalho + reforco + "\n\nTEXTO:\n" + seg,
          abortSignal: aiTimeout("import_layout"),
        });
        doc = sanitizeDoc(parseLoose(text), seg);
      } catch (e) {
        if (ehTimeout(e)) {
          // Provedor lento: não trava a importação — cai para parágrafos fiéis.
          return {
            doc: comImagens(sanitizeDoc(null, texto), images),
            aviso: "a IA não respondeu a tempo; conteúdo mantido em parágrafos fiéis",
          };
        }
        if (tentativa === 1) {
          doc = sanitizeDoc(null, seg);
          degradou = true;
        }
      }
    }
    blocos.push(...(doc ?? sanitizeDoc(null, seg)).blocks);
  }

  const doc: BlockDoc = { version: 2, blocks: blocos.length ? blocos : sanitizeDoc(null, texto).blocks };

  // Rede de fidelidade: reformatar não pode resumir nem parafrasear. Falhou →
  // parágrafos fiéis do texto-fonte (o usuário revê na prévia).
  const antes = contarPalavras(texto);
  const depoisTxt = blocksToText(doc.blocks);
  const depois = contarPalavras(depoisTxt);
  const contencao = contencaoDePalavras(texto, depoisTxt);
  if (antes > 0 && (depois < antes * MINIMO_PALAVRAS || contencao < MINIMO_CONTENCAO)) {
    return {
      doc: comImagens(sanitizeDoc(null, texto), images),
      aviso: "a IA resumiu/parafraseou o artigo; conteúdo mantido em parágrafos fiéis",
    };
  }

  const docFinal = comImagens(doc, images);

  // Revisão de completude por parágrafo: a rede acima é global (85% das palavras),
  // então um único parágrafo omitido passa. Aqui cada parágrafo do original é
  // conferido isolado — o que a IA esqueceu volta ao fim do artigo, fiel (como a
  // rede das imagens). Assim, depois de extrair, nenhum elemento fica faltando.
  const faltando = paragrafosAusentes(texto, blocksToText(docFinal.blocks));
  if (faltando.length) {
    docFinal.blocks.push(...sanitizeDoc(null, faltando.join("\n\n")).blocks);
  }

  return {
    doc: docFinal,
    ...(degradou
      ? { aviso: "parte do artigo não pôde ser formatada e ficou em parágrafos" }
      : faltando.length
        ? { aviso: `${faltando.length} trecho(s) que a IA havia omitido foram recuperados ao fim do artigo` }
        : {}),
  };
}
