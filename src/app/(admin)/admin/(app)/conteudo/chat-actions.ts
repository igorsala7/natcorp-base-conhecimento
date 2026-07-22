"use server";

import { z } from "zod";
import { generateObject } from "ai";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { languageModel, hasAiKey, aiTimeout, ehTimeout } from "@/lib/ai/config";
import { editorChatSchema, type EditorChatTurn } from "@/lib/ai/editor-chat-schema";

/**
 * Turno do CHAT DO EDITOR: o autor conversa e a IA responde com OPERAÇÕES
 * pontuais sobre blocos de topo-nível (aplicadas em tempo real no canvas, com
 * desfazer), com PERGUNTAS quando faltar contexto, ou ROTEANDO para as
 * ferramentas existentes ("melhorar layout" / "melhorar texto").
 *
 * A IA enxerga o doc como lista `blockId → resumo` + o texto integral — e só
 * pode referenciar ids de topo-nível (a aplicação recusa o resto).
 */
const inputSchema = z.object({
  nodeId: z.string().uuid(),
  instrucao: z.string().trim().min(1).max(4000),
  historico: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) }))
    .max(30),
  resumoDoc: z.string().max(16_000),
  textoDoc: z.string().max(16_000),
});

export type EditorChatResult =
  | { ok: true; data: EditorChatTurn }
  | { ok: false; error: string };

export async function editorChatTurn(
  input: z.infer<typeof inputSchema>,
): Promise<EditorChatResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const supabase = await createClient();
  const { data: node } = await supabase
    .from("nodes")
    .select("space_id, title")
    .eq("id", parsed.data.nodeId)
    .single();
  if (!node) return { ok: false, error: "Artigo não encontrado." };
  try {
    await requirePermission("content.edit", node.space_id);
  } catch {
    return { ok: false, error: "Sem permissão para editar." };
  }
  if (!(await hasAiKey("editor_generate"))) {
    return { ok: false, error: "Nenhuma IA configurada (Sistema → IA)." };
  }

  const historico = parsed.data.historico
    .slice(-12)
    .map((m) => `${m.role === "user" ? "AUTOR" : "VOCÊ"}: ${m.text}`)
    .join("\n");

  try {
    const { object } = await generateObject({
      model: await languageModel("editor_generate"),
      schema: editorChatSchema,
      abortSignal: aiTimeout("editor_generate"),
      prompt: `Você é o assistente de edição DENTRO do editor de um artigo de documentação ("${node.title}"), em português do Brasil. Você altera o artigo por OPERAÇÕES, responde dúvidas e roteia para ferramentas.

COMO RESPONDER:
- Pedido de mudança no conteúdo → "ops": substituir / inserir_apos / inserir_topo / remover, SEMPRE referenciando um blockId da LISTA DE BLOCOS abaixo (ids de topo-nível; nada além deles existe para você). Os blocos novos são cópia fiel do estilo do artigo — não invente fatos; onde faltar dado, escreva [COMPLETAR] e pergunte.
- Pedido de APARÊNCIA ("centralize", "meia largura", "fundo roxo", "mais espaço", "fonte maior", "ícone de alerta", "tire o fundo") → op "estilizar" com o campo "estilo" (null = não mexer; "nenhum"/"auto"/"normal" = REMOVER aquele ajuste). REGRA: posição só funciona junto com uma largura menor que a cheia — defina as duas. Estilo com parcimônia: fundo escuro nunca em texto longo.
- Pedido de DIAGRAMA/FLUXOGRAMA a partir do conteúdo (ex.: "faça um fluxograma desses passos") → inserir bloco { kind: "mermaid", code } com sintaxe Mermaid válida (flowchart TD/LR) derivada FIELMENTE do texto do artigo — o autor revisa e desfaz com Ctrl+Z.
- NUNCA remova ou substitua blocos de mídia (imagem, vídeo, arquivo) — se o pedido exigir, explique em "mensagem" e pergunte.
- Pedido genérico de "melhorar/reformatar o layout" do artigo → "ferramenta": "melhorar_layout" (a ferramenta própria pergunta as preferências).
- Pedido genérico de "melhorar/reescrever o texto" de um trecho → "ferramenta": "melhorar_texto" (o autor escolhe o subtipo: reescrever, expandir, resumir, tom).
- Faltou contexto ou a interpretação é incerta (inclusive sobre CÓDIGO citado) → "perguntas" com 2-4 opções e exemplo aplicado; confirme antes de afirmar comportamento.
- "mensagem" sempre descreve o que você fez ou precisa.

LISTA DE BLOCOS (id → conteúdo):
${parsed.data.resumoDoc || "(artigo vazio)"}

TEXTO INTEGRAL DO ARTIGO:
${parsed.data.textoDoc || "(vazio)"}

CONVERSA:
${historico || "(início)"}

AUTOR AGORA DIZ:
${parsed.data.instrucao}`,
    });
    return { ok: true, data: object };
  } catch (e) {
    if (ehTimeout(e)) return { ok: false, error: "A IA demorou demais. Tente de novo." };
    return { ok: false, error: `Falha na IA: ${e instanceof Error ? e.message : "?"}` };
  }
}
