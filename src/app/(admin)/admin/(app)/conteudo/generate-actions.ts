"use server";

import { z } from "zod";
import { generateObject, generateText } from "ai";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { languageModel, hasAiKey, aiTimeout, ehTimeout } from "@/lib/ai/config";
import { extractDocument } from "@/lib/importer/extract";
import { normalizeDoc } from "@/lib/blocks/convert";
import { blocksToText } from "@/lib/blocks/serialize";
import { newId, type Block } from "@/lib/blocks/schema";

/**
 * Wizard "Artigo com IA" (padrão Breeze do HubSpot: tema → outline EDITÁVEL →
 * corpo seção a seção) e remix de artigo existente (FAQ / resumo TL;DR).
 *
 * Regras: o outline volta para o autor ANTES de gerar corpo; o corpo é gerado
 * por seção (nunca o documento inteiro num prompt); tudo nasce RASCUNHO e
 * nada é aplicado sem aceite. Finalidade `editor_generate` (fallback: chat).
 */

const MAX_CONTEXTO = 24_000;

// ── Outline ──────────────────────────────────────────────────────────────────

const OutlineSchema = z.object({
  titulo: z.string().max(120),
  secoes: z
    .array(
      z.object({
        titulo: z.string().max(120),
        pontos: z.array(z.string().max(200)).max(5),
      }),
    )
    .min(2)
    .max(8),
});
export type Outline = z.infer<typeof OutlineSchema>;

export type GenerateResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function generateOutline(input: {
  spaceId: string;
  tema: string;
  publico: string;
  contexto: string;
}): Promise<GenerateResult<Outline>> {
  const parsed = z
    .object({
      spaceId: z.string().uuid(),
      tema: z.string().trim().min(4).max(600),
      publico: z.string().trim().max(200),
      contexto: z.string().max(MAX_CONTEXTO * 2),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  try {
    await requirePermission("content.create", parsed.data.spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para criar conteúdo." };
  }
  if (!(await hasAiKey("editor_generate"))) {
    return { ok: false, error: "Nenhuma IA configurada (Sistema → IA)." };
  }

  const contexto = parsed.data.contexto.slice(0, MAX_CONTEXTO);
  try {
    const { object } = await generateObject({
      model: await languageModel("editor_generate"),
      schema: OutlineSchema,
      abortSignal: aiTimeout("editor_generate"),
      prompt: `Você planeja um artigo de DOCUMENTAÇÃO CORPORATIVA em português do Brasil.

Tema pedido pelo autor: ${parsed.data.tema}
${parsed.data.publico ? `Público-alvo: ${parsed.data.publico}` : ""}

${contexto ? `MATERIAL DE REFERÊNCIA (única fonte de fatos — não invente além dele):\n<<<\n${contexto}\n>>>` : "Não há material de referência: proponha uma estrutura genérica e objetiva; NÃO invente fatos, números ou nomes de telas."}

Proponha o título do artigo e de 2 a 8 seções, cada uma com até 5 pontos-chave curtos do que cobrir. Títulos claros e escaneáveis (padrão Microsoft Learn), sem numeração.`,
    });
    return { ok: true, data: object };
  } catch (e) {
    if (ehTimeout(e)) return { ok: false, error: "A IA demorou demais. Tente de novo." };
    return { ok: false, error: `Falha na IA: ${e instanceof Error ? e.message : "?"}` };
  }
}

// ── Corpo, seção a seção ─────────────────────────────────────────────────────

/** Converte texto simples da IA (parágrafos e listas "- ") em blocos. */
function textoParaBlocos(texto: string): Block[] {
  const blocos: Block[] = [];
  for (const trecho of texto.split(/\n{2,}/)) {
    const linhas = trecho.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!linhas.length) continue;
    const ehLista = linhas.every((l) => /^[-*•]\s+/.test(l));
    if (ehLista && linhas.length > 1) {
      blocos.push({
        id: newId(),
        type: "bulletList",
        children: linhas.map((l) => ({
          id: newId(),
          type: "listItem" as const,
          text: [{ text: l.replace(/^[-*•]\s+/, "") }],
        })),
      });
    } else {
      blocos.push({ id: newId(), type: "paragraph", text: [{ text: linhas.join(" ") }] });
    }
  }
  return blocos;
}

export async function generateSection(input: {
  spaceId: string;
  tema: string;
  publico: string;
  contexto: string;
  tituloArtigo: string;
  secao: { titulo: string; pontos: string[] };
  jaEscritas: string[];
}): Promise<GenerateResult<Block[]>> {
  try {
    await requirePermission("content.create", input.spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  try {
    const { text } = await generateText({
      model: await languageModel("editor_generate"),
      abortSignal: aiTimeout("editor_generate"),
      prompt: `Escreva UMA seção de um artigo de documentação corporativa em português do Brasil.

Artigo: ${input.tituloArtigo}
Tema geral: ${input.tema}
${input.publico ? `Público: ${input.publico}` : ""}
Seção a escrever AGORA: ${input.secao.titulo}
${input.secao.pontos.length ? `Pontos a cobrir: ${input.secao.pontos.join("; ")}` : ""}
${input.jaEscritas.length ? `Seções JÁ escritas (não repita o conteúdo delas): ${input.jaEscritas.join("; ")}` : ""}

${input.contexto ? `MATERIAL DE REFERÊNCIA (única fonte de fatos):\n<<<\n${input.contexto.slice(0, MAX_CONTEXTO)}\n>>>` : "Sem material de referência: seja genérico e correto; onde faltar um dado específico escreva [COMPLETAR]."}

Regras: NÃO repita o título da seção; 2 a 5 parágrafos curtos e/ou UMA lista com "- "; sem markdown de títulos (#), sem negrito; tom claro e direto (padrão Microsoft Learn).`,
    });
    const blocos = textoParaBlocos(text);
    if (!blocos.length) return { ok: false, error: "A IA devolveu vazio." };
    return { ok: true, data: blocos };
  } catch (e) {
    if (ehTimeout(e)) return { ok: false, error: "A IA demorou demais nesta seção." };
    return { ok: false, error: `Falha na IA: ${e instanceof Error ? e.message : "?"}` };
  }
}

// ── Contexto por arquivo (reusa a extração do importador) ────────────────────

export async function extractWizardContext(input: {
  spaceId: string;
  path: string;
  name: string;
  mime: string | null;
}): Promise<GenerateResult<string>> {
  try {
    await requirePermission("content.create", input.spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  // O caminho precisa ser do próprio espaço — sem isso, qualquer editor leria
  // arquivos importados de outras documentações.
  if (!input.path.startsWith(`${input.spaceId}/`)) {
    return { ok: false, error: "Caminho inválido." };
  }
  const supabase = await createClient();
  const { data: file, error } = await supabase.storage.from("imports").download(input.path);
  if (error || !file) return { ok: false, error: "Não consegui baixar o arquivo." };
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const extraido = await extractDocument(buf, input.name, input.mime ?? undefined);
    const texto = extraido.blocks
      .map((b) => b.text)
      .filter(Boolean)
      .join("\n\n")
      .slice(0, MAX_CONTEXTO);
    if (!texto.trim()) return { ok: false, error: "O arquivo não tem texto extraível." };
    return { ok: true, data: texto };
  } catch (e) {
    return { ok: false, error: `Falha ao extrair: ${e instanceof Error ? e.message : "?"}` };
  }
}

// ── Remix (FAQ / TL;DR) do artigo aberto ────────────────────────────────────

const FaqSchema = z.object({
  itens: z
    .array(z.object({ pergunta: z.string().max(200), resposta: z.string().max(1000) }))
    .min(3)
    .max(8),
});

export type RemixTipo = "faq" | "tldr";

export async function remixArticle(
  nodeId: string,
  tipo: RemixTipo,
): Promise<GenerateResult<Block[]>> {
  const supabase = await createClient();
  const { data: node } = await supabase
    .from("nodes")
    .select("space_id, title")
    .eq("id", nodeId)
    .single();
  if (!node) return { ok: false, error: "Artigo não encontrado." };
  try {
    await requirePermission("content.edit", node.space_id);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }

  // Rascunho tem precedência — mesmo critério do "Melhorar layout".
  const [{ data: draft }, { data: article }] = await Promise.all([
    supabase.from("article_drafts").select("content_json").eq("node_id", nodeId).maybeSingle(),
    supabase.from("articles").select("content_json").eq("node_id", nodeId).maybeSingle(),
  ]);
  const texto = blocksToText(
    normalizeDoc(draft?.content_json ?? article?.content_json).blocks,
  ).slice(0, MAX_CONTEXTO);
  if (texto.trim().length < 80) {
    return { ok: false, error: "O artigo é curto demais para remixar." };
  }

  try {
    if (tipo === "faq") {
      const { object } = await generateObject({
        model: await languageModel("editor_generate"),
        schema: FaqSchema,
        abortSignal: aiTimeout("editor_generate"),
        prompt: `A partir do artigo de documentação abaixo, gere de 3 a 8 perguntas frequentes com respostas CURTAS e fiéis ao texto — não invente nada que não esteja nele. Português do Brasil.

ARTIGO "${node.title}":
<<<
${texto}
>>>`,
      });
      const blocos: Block[] = [
        {
          id: newId(),
          type: "accordion",
          children: object.itens.map((i) => ({
            id: newId(),
            type: "accordionItem" as const,
            data: { title: i.pergunta },
            children: [
              { id: newId(), type: "paragraph" as const, text: [{ text: i.resposta }] },
            ],
          })),
        },
      ];
      return { ok: true, data: blocos };
    }

    const { text } = await generateText({
      model: await languageModel("editor_generate"),
      abortSignal: aiTimeout("editor_generate"),
      prompt: `Resuma o artigo de documentação abaixo em 3 a 5 frases curtas ("resumo executivo" para quem tem pressa), fiéis ao texto, em português do Brasil. Uma frase por linha, começando com "- ".

ARTIGO "${node.title}":
<<<
${texto}
>>>`,
    });
    const linhas = text
      .split("\n")
      .map((l) => l.replace(/^[-*•]\s+/, "").trim())
      .filter(Boolean)
      .slice(0, 5);
    if (!linhas.length) return { ok: false, error: "A IA devolveu vazio." };
    const blocos: Block[] = [
      {
        id: newId(),
        type: "callout",
        data: { variant: "info" },
        children: [
          {
            id: newId(),
            type: "bulletList",
            children: linhas.map((l) => ({
              id: newId(),
              type: "listItem" as const,
              text: [{ text: l }],
            })),
          },
        ],
      },
    ];
    return { ok: true, data: blocos };
  } catch (e) {
    if (ehTimeout(e)) return { ok: false, error: "A IA demorou demais. Tente de novo." };
    return { ok: false, error: `Falha na IA: ${e instanceof Error ? e.message : "?"}` };
  }
}
