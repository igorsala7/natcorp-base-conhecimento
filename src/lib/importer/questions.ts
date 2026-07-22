import { generateObject } from "ai";
import { languageModel, hasAiKey, aiTimeout, ehTimeout } from "@/lib/ai/config";
import { questionsSchema, type LayoutQuestions } from "./question-schema";

/**
 * Passe INTERATIVO do "Melhorar layout": a IA lê o texto e devolve até 5
 * perguntas de formatação com opções + exemplo aplicado. As respostas viram a
 * "direção do autor" injetada no prompt da reformatação (improveLayout).
 *
 * Dois modos (pedido do produto):
 * - "detalhado" (artigo no editor): cita os trechos ambíguos do próprio texto;
 * - "generico" (importação): perguntas de política, sem citar trechos — o
 *   documento inteiro ainda nem virou artigos.
 */
export type QuestionsResult =
  | { ok: true; perguntas: LayoutQuestions["perguntas"] }
  | { ok: false; error: string };

const MAX_TEXTO = 16_000;

export async function proposeLayoutQuestions(
  texto: string,
  modo: "detalhado" | "generico",
): Promise<QuestionsResult> {
  if (!(await hasAiKey("import_layout"))) {
    return { ok: false, error: "Nenhuma IA configurada para layout (Sistema → IA)." };
  }
  const corpo = texto.trim().slice(0, MAX_TEXTO);
  if (corpo.length < 80) {
    return { ok: false, error: "Texto curto demais para valer perguntas." };
  }

  const instrucoesModo =
    modo === "detalhado"
      ? `MODO DETALHADO: cite em "trecho" o pedaço EXATO do texto a que cada pergunta se refere (copie literalmente, até 400 caracteres) e dê em "exemplo" uma demonstração aplicada de como aquela opção ficaria com o conteúdo real.`
      : `MODO GENÉRICO (importação de documento): NÃO cite trechos ("trecho" = null). Pergunte políticas gerais que valerão para o documento inteiro: destaque dos títulos, quando usar tabela vs lista, uso de passos numerados, avisos em callout, densidade de painéis. "exemplo" pode ilustrar com conteúdo fictício curto.`;

  try {
    const { object } = await generateObject({
      model: await languageModel("import_layout"),
      schema: questionsSchema,
      abortSignal: aiTimeout("import_layout"),
      prompt: `Você é o EDITOR VISUAL de uma documentação corporativa. Antes de reformatar o texto abaixo em blocos ricos, identifique os pontos em que existe MAIS DE UMA formatação razoável e pergunte ao autor — em português do Brasil.

REGRAS:
- No máximo 5 perguntas; só pergunte o que realmente muda o resultado. Nenhuma pergunta é resposta válida (perguntas: []).
- Cada pergunta com 2 a 4 opções; cada opção com uma "diretiva": instrução IMPERATIVA sobre FORMATO (ex.: "Converta relações rótulo-valor em tabela de duas colunas"). A diretiva NUNCA pode pedir reescrita, resumo ou texto novo — só formato.
- Exemplos de bons temas: nível de destaque dos títulos; listas de pares (ex. "Status 1  Realizado, Status 2  Incompleto") como tabela/lista/painel; sequências de ações como passos numerados; avisos como callout; trechos técnicos como bloco de código.
- ${instrucoesModo}

TEXTO:
${corpo}`,
    });
    return { ok: true, perguntas: object.perguntas };
  } catch (e) {
    if (ehTimeout(e)) return { ok: false, error: "A IA demorou demais na análise." };
    return { ok: false, error: `Falha na IA: ${e instanceof Error ? e.message : "?"}` };
  }
}
