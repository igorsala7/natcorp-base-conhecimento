import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { languageModel, hasAiKey, aiTimeout } from "@/lib/ai/config";
import { promptField } from "@/lib/ai/prompts";

/**
 * Extração de TERMOS DE DOMÍNIO de um lote de texto dos artigos — o "cérebro"
 * da varredura de ontologia. Usa a MESMA IA configurada no **Chat** (Sistema →
 * IA), não um provedor fixo. Schema pequeno de propósito.
 */
const schema = z.object({
  terms: z.array(
    z.object({
      term: z.string(),
      kind: z.enum(["conceito", "entidade", "acao", "sigla", "outro"]),
      description: z.string(),
      aliases: z.array(z.string()),
    }),
  ),
});

export type TermoExtraido = {
  term: string;
  kind: "conceito" | "entidade" | "acao" | "sigla" | "outro";
  description: string | null;
  aliases: string[];
};

/** Extrai termos+sinônimos de um lote de texto. `[]` se não há IA de Chat. */
export async function extrairTermos(texto: string): Promise<TermoExtraido[]> {
  if (!texto.trim() || !(await hasAiKey("chat"))) return [];
  const model = await languageModel("chat");
  const prompt = await promptField("ontologia", "prompt");
  const { object } = await generateObject({
    model,
    schema,
    prompt: prompt + "\n\nDOCUMENTAÇÃO:\n" + texto,
    abortSignal: aiTimeout("ontology_scan"),
  });
  return object.terms
    .map((t) => ({
      term: t.term.trim(),
      kind: t.kind,
      description: t.description.trim() || null,
      aliases: [...new Set(t.aliases.map((a) => a.trim()).filter(Boolean))],
    }))
    .filter((t) => t.term.length >= 2);
}

/**
 * Dada uma LISTA de termos fornecida pelo usuário (importação por arquivo),
 * gera para cada um o termo canônico + tipo + descrição curta + SINÔNIMOS.
 * Ao contrário de `extrairTermos` (que garimpa termos de um texto), aqui os
 * termos JÁ SÃO os da lista — a IA só normaliza e ENRIQUECE com sinônimos,
 * incluindo os fornecidos. NÃO deve inventar termos fora da lista.
 */
export async function sinonimosDeTermos(
  entradas: { term: string; aliases: string[] }[],
): Promise<TermoExtraido[]> {
  const limpos = entradas
    .map((e) => ({ term: e.term.trim(), aliases: [...new Set(e.aliases.map((a) => a.trim()).filter(Boolean))] }))
    .filter((e) => e.term.length >= 2);
  if (!limpos.length || !(await hasAiKey("chat"))) return [];
  const model = await languageModel("chat");

  const lista = limpos
    .map((e) => (e.aliases.length ? `- ${e.term} (sinônimos dados: ${e.aliases.join(", ")})` : `- ${e.term}`))
    .join("\n");
  /**
   * A INSTRUÇÃO QUE PROTEGIA CONTRA ALUCINAÇÃO BLOQUEAVA O TRABALHO.
   *
   * A versão anterior dizia "corrija capitalização/acento óbvios, mas mantenha o
   * sentido" e "NÃO invente termos que não estejam na lista". A IA obedecia: dado
   * "Adto salarial", devolvia "Adto salarial". Foi o relato do Igor (16/08) —
   * pediu ontologia dos campos com rótulo e os termos saíram abreviados, como
   * `ADTO_13` em vez de "Adiantamento de 13º".
   *
   * O prompt não distinguia duas coisas muito diferentes:
   *  · INVENTAR um conceito que não está na lista → continua proibido;
   *  · escrever o MESMO conceito por extenso → é justamente o que se quer.
   *
   * Rótulo de tela é abreviado por falta de espaço na tela, não porque o negócio
   * chama assim. Quem pergunta ao chat escreve "adiantamento", não "adto".
   *
   * A forma abreviada volta como SINÔNIMO — sem isso, quem digitasse "adto"
   * deixaria de encontrar, e o conserto teria trocado um buraco por outro.
   */
  const instrucao =
    "Você recebe uma LISTA de termos de um sistema de RH, extraídos de rótulos de tela. " +
    "Rótulos de tela são ABREVIADOS por falta de espaço — sua tarefa é devolver cada um " +
    "por EXTENSO, como uma pessoa da área falaria.\n\n" +
    "Para CADA termo da lista devolva:\n" +
    "- `term`: o conceito ESCRITO POR EXTENSO. Expanda abreviações e siglas do domínio: " +
    "\"Adto salarial\" → \"Adiantamento Salarial\"; \"Adto 13\" → \"Adiantamento de 13º Salário\"; " +
    "\"Dt Adm\" → \"Data de Admissão\"; \"Qtd Depend\" → \"Quantidade de Dependentes\". " +
    // SÍMBOLO também é abreviação. A primeira versão só deu exemplos de palavra
    // abreviada, e o Igor apareceu com "% Adiantamento" — que a IA manteria,
    // porque "%" não parece uma abreviação a expandir, e sim pontuação.
    "SÍMBOLO conta como abreviação: \"% Adiantamento\" → \"Percentual de Adiantamento\"; " +
    "\"Nº Dependentes\" → \"Número de Dependentes\"; \"R$ Salário\" → \"Valor do Salário\"; " +
    "\"Adm/Dem\" → \"Admissões e Demissões\". " +
    "Se já estiver por extenso, só corrija capitalização e acento.\n" +
    "- `kind`: conceito/entidade/acao/sigla/outro.\n" +
    "- `description`: uma frase, ou vazio se não souber.\n" +
    "- `aliases`: como as pessoas REALMENTE se referem a isso ao perguntar — INCLUA " +
    "obrigatoriamente a forma abreviada que veio na lista, mais variações comuns " +
    "(sinônimos do RH, plural/singular, com e sem acento). Ex.: para \"Adiantamento de 13º " +
    "Salário\" → [\"Adto 13\", \"adiantamento de décimo terceiro\", \"13º salário\", \"antecipação do 13\"].\n\n" +
    "REGRA: é PROIBIDO inventar um conceito que não esteja na lista. Expandir a abreviação " +
    "de um termo da lista NÃO é inventar — é a tarefa. Devolva exatamente um item por " +
    "linha da lista, na mesma ordem.\n\nLISTA:\n" +
    lista;

  const { object } = await generateObject({
    model,
    schema,
    prompt: instrucao,
    abortSignal: aiTimeout("ontology_scan"),
  });
  return object.terms
    .map((t) => ({
      term: t.term.trim(),
      kind: t.kind,
      description: t.description.trim() || null,
      aliases: [...new Set(t.aliases.map((a) => a.trim()).filter(Boolean))],
    }))
    .filter((t) => t.term.length >= 2);
}
