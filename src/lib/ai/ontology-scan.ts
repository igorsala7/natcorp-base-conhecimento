import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { languageModel, hasAiKey, aiTimeout } from "@/lib/ai/config";

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

const PROMPT = `Você é um TERMINÓLOGO montando a ontologia de busca de uma documentação de sistema SaaS. Recebe um ou mais artigos da documentação e EXTRAI os TERMOS DE DOMÍNIO que um usuário buscaria no assistente/chat.

ENTENDA O CONTEXTO PRIMEIRO
- Cada artigo vem com o CAMINHO DE PASTAS entre colchetes (ex.: [Financeiro > Faturamento]) e o TÍTULO após "#". Use isso para entender o ASSUNTO e classificar/agrupar os termos com sentido.
- LEIA todo o material como um conjunto coerente antes de listar: agrupe as variações sob o termo canônico CERTO (não crie dois termos para o mesmo conceito), e escolha o canônico mais claro para o usuário.

O QUE EXTRAIR (seja COMPLETO)
- TODAS as funcionalidades, telas, entidades de negócio, ações, relatórios, campos importantes e SIGLAS relevantes (ex.: "Nota Fiscal", "Chamado", "Colaborador", "Emitir NF", "Dashboard"). Não deixe de fora um termo importante que apareça no texto.
- Para CADA termo devolva:
  · term: o nome canônico como aparece no texto (limpo, sem numeração).
  · kind: conceito | entidade | acao | sigla | outro.
  · description: UMA frase curta do que é, tirada do próprio texto (vazio se não der).
  · aliases: TODAS as variações reais pelas quais o usuário pode digitar — sinônimos, siglas, abreviações, plural/singular, forma coloquial, com/sem acento, e o nome de campos/botões equivalentes. Ex.: para "Nota Fiscal" → ["NF", "NF-e", "nota", "nota fiscal eletrônica"]. Seja GENEROSO nas variações reais, mas não invente palavras que ninguém usaria.

REGRAS
- NÃO invente termos que não estão no texto. Na dúvida sobre um termo, não inclua; mas na dúvida sobre um SINÔNIMO real de um termo que existe, inclua.
- Prefira termos FORTES e específicos do produto. Ignore palavras genéricas ("sistema", "tela", "usuário", "clique") a menos que sejam entidades específicas do produto.
- Devolva SÓ o objeto no formato pedido.`;

/** Extrai termos+sinônimos de um lote de texto. `[]` se não há IA de Chat. */
export async function extrairTermos(texto: string): Promise<TermoExtraido[]> {
  if (!texto.trim() || !(await hasAiKey("chat"))) return [];
  const model = await languageModel("chat");
  const { object } = await generateObject({
    model,
    schema,
    prompt: PROMPT + "\n\nDOCUMENTAÇÃO:\n" + texto,
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
