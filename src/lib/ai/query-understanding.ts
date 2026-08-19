import "server-only";
import { generateText } from "ai";
import { createAdminClient } from "@/lib/supabase/admin";
import { languageModel, hasAiKey, aiTimeout } from "@/lib/ai/config";
import { vocabularioProximo } from "@/lib/ai/ontology";
import { limparConsulta } from "@/lib/ai/query-clean";

/**
 * ENTENDIMENTO DA CONSULTA — o passo que mais aproxima "usuário que se expressa
 * mal" de "resposta precisa". Transforma a mensagem crua (gíria, erro de
 * digitação, vaga, dependente do contexto da conversa) em UMA consulta de busca
 * limpa e no VOCABULÁRIO da documentação, ANTES do RAG. Usa a ontologia como
 * dica de vocabulário (mapeia coloquial→canônico) e o histórico (resolve "e
 * como cancelo?"). Roda no caminho crítico do chat, então: modelo do Chat,
 * timeout curto, e SEMPRE degrada para a pergunta original em qualquer falha
 * (nunca piora nem trava a busca).
 *
 * Usa `createAdminClient` só para LER a ontologia (revoke-from-anon; espaço
 * filtrado) — funciona igual nas rotas públicas (widget/portal) e na autenticada.
 */

export async function interpretarConsulta(
  spaceIds: string | string[],
  pergunta: string,
  historico?: { role: string; content: string }[],
  /** Tela onde o usuário está (Fase 4) — ajuda a resolver perguntas vagas. */
  contextoTela?: string,
  /**
   * Modelo alternativo, SÓ para medição (`scripts/eval-rewrite.ts`).
   *
   * A reescrita decide qual pergunta o sistema vai responder, e hoje roda no
   * menor modelo do conjunto. Saber se um modelo melhor acerta mais exige rodar
   * o MESMO prompt nos dois — e trocar a atribuição no banco para medir mexeria
   * na produção. Em produção este parâmetro nunca é passado.
   */
  modeloMedicao?: Parameters<typeof generateText>[0]["model"],
): Promise<string> {
  const p = (pergunta ?? "").trim();
  if (p.length < 3) return pergunta;
  if (!(await hasAiKey("query_rewrite"))) return pergunta;

  const ids = Array.isArray(spaceIds) ? spaceIds : [spaceIds];
  try {
    const supabase = createAdminClient();
    // Histórico recente (sem a última msg, que é a própria pergunta) para casar referências.
    const recentes = (historico ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-6, -1)
      .map((m) => `${m.role === "user" ? "USUÁRIO" : "ASSISTENTE"}: ${m.content}`)
      .join("\n");

    const vocab = await vocabularioProximo(supabase, ids, `${p}\n${recentes}`).catch(() => "");

    const { text } = await generateText({
      model: modeloMedicao ?? (await languageModel("query_rewrite")), // finalidade própria: atribua um modelo RÁPIDO na tela (fallback → Chat)
      abortSignal: aiTimeout("query_rewrite"), // curto: está no caminho crítico
      prompt: `Você normaliza a CONSULTA DE BUSCA de um sistema de documentação, em português do Brasil. O usuário pode escrever mal: gíria, erro de digitação, vago, ou dependente do contexto da conversa. Produza UMA consulta de busca curta e clara que capture a real INTENÇÃO, no vocabulário da documentação.

REGRAS:
- Resolva referências do histórico ("e como cancelo?" → retome o assunto anterior).
- Se a mensagem for VAGA ou apontar para "isto/isso/aqui" e houver uma TELA ATUAL abaixo, use o nome da tela para inferir o assunto. Se a mensagem já tiver assunto próprio, IGNORE a tela.
- Corrija erros de digitação e troque a gíria pelo TERMO do produto quando o VOCABULÁRIO abaixo ajudar.
- NÃO responda a pergunta. NÃO invente um assunto que não está na mensagem. Se já estiver clara, devolva-a essencialmente como está.
- Responda APENAS a consulta, em uma linha, sem aspas e sem explicação.

VOCABULÁRIO DA DOCUMENTAÇÃO (termos canônicos e sinônimos — use quando casar): ${vocab || "(indisponível)"}

TELA ATUAL DO USUÁRIO (onde ele está no sistema): ${(contextoTela ?? "").trim() || "(desconhecida)"}

HISTÓRICO RECENTE:
${recentes || "(início)"}

MENSAGEM DO USUÁRIO:
${p}

CONSULTA DE BUSCA:`,
    });
    return limparConsulta(text, pergunta);
  } catch {
    return pergunta;
  }
}
