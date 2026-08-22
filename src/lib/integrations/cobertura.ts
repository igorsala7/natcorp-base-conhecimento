/**
 * Chamada do classificador de COBERTURA. O prompt e os tipos vivem em
 * `cobertura-prompt.ts` (puro, testável sem provedor); aqui fica só o IO.
 */
import { generateObject } from "ai";
import { z } from "zod";
import { languageModel, aiTimeout, hasAiKey } from "@/lib/ai/config";
import { promptDeCobertura, type CandidataCobertura, type Cobertura } from "./cobertura-prompt";

/**
 * Decide se o catálogo cobre o assunto. FALHA ABERTA: qualquer erro devolve
 * `indefinido`, e quem chama mantém as ferramentas. Um classificador que
 * derruba o turno quando o provedor oscila seria pior que o problema que ele
 * resolve — a resposta é o produto; isto é conferência.
 */
export async function catalogoCobre(
  pergunta: string,
  candidatas: readonly CandidataCobertura[],
  /**
   * A mensagem CONTINUA a anterior? Vem de `deveReescrever().precisaContexto`.
   *
   * Substitui o piso de 12 caracteres que estava aqui, e a troca importa: o piso
   * de comprimento existia para não julgar continuação pelo fragmento — mas
   * barrava justamente "excel" (5) e "Opção 2" (7), que é onde o funil mais
   * erra. Em mensagem curta o `topSim` cai abaixo de `MIN_ANTIFLOOD` (0,58), o
   * anti-inundação zera as candidatas, e o que chega ao modelo são só as
   * ferramentas `always_include` — nenhuma pedida. A conferência precisava rodar
   * exatamente ali.
   *
   * `precisaContexto` é o sinal certo porque separa as duas coisas que o
   * comprimento confundia: "e em abril?" é continuação (não julgar) e "excel"
   * respondendo a uma pergunta de formato também é — mas "atestados do 23087",
   * curta ou não, é pedido autônomo e deve ser julgado.
   */
  continuacao = false,
): Promise<Cobertura> {
  const q = String(pergunta ?? "").trim();
  const indef: Cobertura = { cobre: true, qual: null, indefinido: true };
  // Continuação não se julga pelo fragmento: o assunto está no turno de trás, e
  // reprovar o catálogo por causa da elipse cortaria a ferramenta certa.
  if (!q || continuacao || !candidatas.length) return indef;
  if (!(await hasAiKey("query_rewrite"))) return indef;

  try {
    const { object } = await generateObject({
      model: await languageModel("query_rewrite"),
      abortSignal: aiTimeout("query_rewrite"),
      schema: z.object({ cobre_assunto: z.boolean(), qual: z.number().nullable() }),
      prompt: promptDeCobertura(q, candidatas),
    });
    const i = object.qual;
    const alvo = typeof i === "number" && i >= 1 && i <= candidatas.length ? candidatas[i - 1]!.key : null;
    return { cobre: object.cobre_assunto === true, qual: alvo, indefinido: false };
  } catch {
    return indef;
  }
}
