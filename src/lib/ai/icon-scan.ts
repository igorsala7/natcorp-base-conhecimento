import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { languageModel, hasAiKey, aiTimeout } from "@/lib/ai/config";
import { ICONS, ICON_KEYWORDS } from "@/lib/blocks/icons";

/**
 * Escolha de ÍCONE por IA para diretórios, em lote. A IA recebe o título de cada
 * diretório e os títulos dos itens dentro dele e devolve UMA chave de ícone por
 * diretório, sempre do vocabulário fechado de `ICONS`. Usa a MESMA IA do Chat
 * (Sistema → IA). Sem IA configurada → mapa vazio (o chamador cai na heurística).
 */

export type DiretorioParaIcone = { id: string; titulo: string; filhos: string[] };

const schema = z.object({
  icones: z.array(z.object({ id: z.string(), icon: z.string() })),
});

// "chave: significado" só das chaves que EXISTEM em ICONS — o vocabulário
// que a IA pode usar. Montado uma vez.
const CATALOGO = Object.keys(ICONS)
  .map((k) => `${k}: ${ICON_KEYWORDS[k] ?? k}`)
  .join("\n");

const CHAVES_VALIDAS = new Set(Object.keys(ICONS));

const PROMPT = `Você escolhe um ÍCONE para cada DIRETÓRIO de uma base de documentação técnica (sistema SaaS/ERP em português).

Para cada diretório, escolha a CHAVE de ícone que melhor representa o ASSUNTO, olhando o TÍTULO do diretório e os TÍTULOS dos itens dentro dele. Pense no tema (financeiro, RH/folha, cadastros, relatórios, configurações, segurança, integração, estoque, vendas, etc.) e escolha o ícone que um leitor associaria de imediato.

REGRAS
- Use SOMENTE chaves da LISTA abaixo. O texto após cada chave é só o SIGNIFICADO, para você entender — nunca use esse texto como resposta, só a chave.
- Nunca invente uma chave fora da lista.
- Uma chave por diretório. Se realmente nada se encaixar, use "folder".
- Devolva um item { id, icon } para CADA diretório recebido, preservando o id.

LISTA DE CHAVES (chave: significado):
${CATALOGO}`;

/** Mapa diretorioId→chaveDeIcone. Só chaves válidas entram. */
export async function escolherIcones(
  itens: DiretorioParaIcone[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!itens.length || !(await hasAiKey("chat"))) return out;
  const model = await languageModel("chat");

  const TAMANHO = 40;
  for (let i = 0; i < itens.length; i += TAMANHO) {
    const lote = itens.slice(i, i + TAMANHO);
    const entrada = lote.map((d) => ({
      id: d.id,
      titulo: d.titulo,
      itens: d.filhos.slice(0, 20),
    }));
    try {
      const { object } = await generateObject({
        model,
        schema,
        prompt: `${PROMPT}\n\nDIRETÓRIOS:\n${JSON.stringify(entrada)}`,
        abortSignal: aiTimeout("ontology_scan"),
      });
      for (const it of object.icones) {
        if (CHAVES_VALIDAS.has(it.icon)) out.set(it.id, it.icon);
      }
    } catch {
      // Lote falho não derruba a operação: a heurística cobre o que faltar.
    }
  }
  return out;
}
