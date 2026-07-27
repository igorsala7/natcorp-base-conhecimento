"use server";

import { z } from "zod";
import { generateObject } from "ai";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { languageModel, hasAiKey, aiTimeout, ehTimeout } from "@/lib/ai/config";
import { editorChatSchema, type EditorChatTurn } from "@/lib/ai/editor-chat-schema";
import { PADRAO_DE_ARTIGO } from "@/lib/importer/prompts";
import { contextoParaCriacao } from "@/lib/ai/creation-context";
import { interpretarConsulta } from "@/lib/ai/query-understanding";
import { createNode } from "./actions";

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

  // Entende a intenção do pedido (gíria/vago) e busca o contexto da documentação
  // (RAG + ontologia) para editar/sugerir com mais precisão.
  const consulta = await interpretarConsulta(
    node.space_id,
    parsed.data.instrucao,
    parsed.data.historico.map((m) => ({ role: m.role, content: m.text })),
  );
  const contexto = await contextoParaCriacao(node.space_id, consulta);

  try {
    const { object } = await generateObject({
      model: await languageModel("editor_generate"),
      schema: editorChatSchema,
      abortSignal: aiTimeout("editor_generate"),
      prompt: `Você é um EDITOR PROFISSIONAL trabalhando DENTRO do editor do artigo de documentação "${node.title}", em português do Brasil. Colabore como um par editorial: altere o artigo por OPERAÇÕES, MELHORE o texto, ofereça opções e sugira organização — não é um transcritor.

COMO RESPONDER:
- MELHORE o texto do autor: ao inserir/substituir, escreva em prosa de documentação clara, correta e objetiva (gramática, tom, coesão) — nunca apenas copie o que ele digitou. Não invente fatos; onde faltar dado, escreva [COMPLETAR] e pergunte.
- Pedido de mudança no conteúdo → "ops": substituir / inserir_apos / inserir_topo / remover, SEMPRE referenciando um blockId da LISTA DE BLOCOS abaixo (ids de topo-nível; nada além deles existe para você).
- Pedido de APARÊNCIA ("centralize", "meia largura", "fundo roxo", "mais espaço", "fonte maior", "ícone de alerta", "tire o fundo") → op "estilizar" com o campo "estilo" (null = não mexer; "nenhum"/"auto"/"normal" = REMOVER aquele ajuste). REGRA: posição só funciona junto com uma largura menor que a cheia — defina as duas. Estilo com parcimônia: fundo escuro nunca em texto longo.
- Pedido de FLUXOGRAMA (ex.: "faça um fluxograma desses passos") → inserir { kind: "flow", mermaid } em sintaxe Mermaid \`flowchart TD\`: nós id([Início]) · id[Etapa] · id{Decisão?} · id([Fim]); arestas \`a --> b\` e \`a -->|Sim| b\` (decisão SEMPRE com 2 saídas rotuladas), derivado FIELMENTE do texto. Outros diagramas (organograma, sequência) → { kind: "mermaid", code }.
- Pedido de GRÁFICO a partir de dados (ex.: "gráfico de barras dessa tabela") → inserir { kind: "chart", chartType, dataCsv } com os números REAIS do artigo em CSV (1ª linha = cabeçalhos, 1ª coluna = categorias/eixo X). NUNCA invente números. chartType: column|bar|line|area|stackedColumn|combo|pie|donut|scatter|radar.
- Pedido de TABELA a partir de dados (colados ou descritos) → inserir { kind: "table", rows:[[<cell>,...], ...] } com a 1ª linha = cabeçalho.
- NUNCA remova ou substitua blocos de mídia (imagem, vídeo, arquivo) — se o pedido exigir, explique em "mensagem" e pergunte.
- Pedido genérico de "melhorar/reformatar o layout" do artigo → "ferramenta": "melhorar_layout" (a ferramenta própria pergunta as preferências).
- Pedido genérico de "melhorar/reescrever o texto" de um trecho → "ferramenta": "melhorar_texto" (o autor escolhe o subtipo: reescrever, expandir, resumir, tom).
- PERGUNTE como um editor que oferece opções (use "perguntas", 2-4 opções, "diretiva" imperativa) sobre linguagem/tom, TIPO DE BLOCO para um trecho (tabela × lista × passos; callout × painel) e LAYOUT. Quando a opção for um TIPO DE BLOCO, preencha "preview" com a chave do bloco (o autor VÊ o exemplo real); senão "preview": null. Chaves de preview: callout, steps, table, bullets, checklist, quote, code, accordion, toggle, hero, panel, stats, cardGrid, columns, heading. Confirme antes de afirmar comportamento de código.
- SUGIRA ORGANIZAÇÃO: se o artigo ficou amplo ou mistura temas distintos, proponha em "estrutura" novas pastas/artigos (ex.: separar uma seção grande em um artigo próprio, ou agrupar numa pasta) — explique o porquê na "mensagem". O sistema pede confirmação ao autor antes de criar; os novos artigos nascem vazios para o autor (ou você) preencher depois. Use com critério, não para tudo.
- "mensagem" sempre descreve, como um editor, o que você fez, o que sugere e o que precisa.
- Ao INSERIR seções/blocos, siga o PADRÃO DE ARTIGO abaixo (composição dos artigos-modelo).

${PADRAO_DE_ARTIGO}

LISTA DE BLOCOS (id → conteúdo):
${parsed.data.resumoDoc || "(artigo vazio)"}

TEXTO INTEGRAL DO ARTIGO:
${parsed.data.textoDoc || "(vazio)"}
${contexto ? `\n${contexto}\n` : ""}
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

export type ChatStructureItem = {
  tmp: string;
  tipo: "folder" | "article";
  titulo: string;
  pai: string | null;
};

/**
 * Cria a ESTRUTURA proposta pelo chat do editor (pastas/artigos novos), relativa
 * ao artigo aberto: item com `pai` null vira IRMÃO do artigo; com `pai` = `tmp`
 * de uma pasta da lista, vira FILHO dela. Reusa `createNode` (slug, posição,
 * RLS, linha de article). Cria por passes até resolver o aninhamento; item com
 * `pai` inexistente cai como irmão do artigo (fallback). Artigos nascem vazios.
 */
export async function applyChatStructure(
  nodeId: string,
  itens: ChatStructureItem[],
): Promise<{ ok: true; criados: number; primeiroId: string | null } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: node } = await supabase
    .from("nodes")
    .select("space_id, parent_id")
    .eq("id", nodeId)
    .single();
  if (!node) return { ok: false, error: "Artigo não encontrado." };
  try {
    await requirePermission("content.create", node.space_id);
  } catch {
    return { ok: false, error: "Sem permissão para criar conteúdo." };
  }
  if (!itens.length || itens.length > 12) return { ok: false, error: "Estrutura inválida." };

  const tmpToId = new Map<string, string>();
  const pendentes = [...itens];
  let criados = 0;
  let primeiroId: string | null = null;

  const criar = async (tipo: "folder" | "article", titulo: string, parentId: string | null, tmp?: string) => {
    const r = await createNode({ spaceId: node.space_id, parentId, type: tipo, title: titulo || "Sem título" });
    if (r.ok && r.id) {
      criados++;
      if (tmp) tmpToId.set(tmp, r.id);
      if (!primeiroId) primeiroId = r.id;
    }
  };

  // Passes: cria quem tem pai resolvível (null → irmão do artigo; tmp já criado → filho).
  let progrediu = true;
  while (pendentes.length && progrediu) {
    progrediu = false;
    for (let i = 0; i < pendentes.length; i++) {
      const it = pendentes[i]!;
      let parentId: string | null;
      if (!it.pai) parentId = node.parent_id;
      else if (tmpToId.has(it.pai)) parentId = tmpToId.get(it.pai)!;
      else continue;
      await criar(it.tipo, it.titulo, parentId, it.tmp);
      pendentes.splice(i, 1);
      i--;
      progrediu = true;
    }
  }
  // Sobras com pai inexistente → irmão do artigo (não perde a intenção).
  for (const it of pendentes) await criar(it.tipo, it.titulo, node.parent_id, it.tmp);

  await audit({
    action: "content.chat_structure",
    entityType: "node",
    entityId: nodeId,
    spaceId: node.space_id,
    after: { criados },
  });
  return { ok: true, criados, primeiroId };
}
