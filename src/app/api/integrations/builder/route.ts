import { streamText, stepCountIs } from "ai";
import type { NextRequest } from "next/server";
import { hasPermission } from "@/lib/auth/permissions";
import { chatModel, hasAiKey } from "@/lib/ai/config";
import { buildSchemaTools, resumoEsquema } from "@/lib/integrations/builder-tools";

export const runtime = "nodejs";

type Msg = { role: "user" | "assistant"; content: string };

const SYSTEM = `Você é o assistente CONSTRUTOR das Integrações desta plataforma. Ajuda a montar e editar o esquema: ferramentas/APIs, agentes de IA e os vínculos entre eles.

O QUE VOCÊ FAZ:
- Criar e editar ferramentas (salvar_ferramenta) e agentes (salvar_agente); vincular/desvincular ferramentas a agentes (vincular/desvincular).
- SEMPRE leia o estado atual (estado_atual) antes de editar, para não sobrescrever o que já existe.
- Ao criar uma ferramenta nova, lembre de vinculá-la a um agente ATIVO — senão a IA não a enxerga.

LIMITES (importante):
- Você NUNCA apaga bases, ferramentas ou agentes; e NUNCA mexe em credenciais, segredos, tokens ou nas URLs base de cliente — isso é feito manualmente na interface. Se pedirem, explique como fazer na tela.
- Antes de uma mudança grande (várias tools, reconfigurar um agente), RESUMA o que vai fazer e peça confirmação.

ESTILO: pt-BR, direto e claro. Ao concluir uma ação, confirme em uma linha o que foi feito. Se algo falhar, explique e proponha o próximo passo.`;

/**
 * Chat CONSTRUTOR das Integrações: o assistente cria/edita ferramentas, agentes e
 * vínculos conversando com o admin. Só `integrations.manage`. Não-destrutivo (as
 * ferramentas de esquema não apagam nada nem tocam em segredos).
 */
export async function POST(req: NextRequest) {
  if (!(await hasPermission("integrations.manage", null))) {
    return Response.json({ error: "Sem permissão para gerenciar integrações." }, { status: 403 });
  }
  if (!(await hasAiKey())) {
    return Response.json({ error: "Nenhuma IA configurada (Sistema → IA)." }, { status: 400 });
  }

  const { messages } = (await req.json()) as { messages: Msg[] };
  const resumo = await resumoEsquema();

  const result = streamText({
    model: await chatModel(),
    system: `${SYSTEM}\n\nESQUEMA ATUAL:\n${resumo}`,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    tools: buildSchemaTools(),
    stopWhen: stepCountIs(10),
    onError: ({ error }) => console.error("[builder] falha ao gerar resposta:", error),
  });

  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of result.textStream) controller.enqueue(enc.encode(delta));
      } catch {
        /* stream vazio/erro do provedor: o cliente trata resposta vazia */
      }
      controller.close();
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
