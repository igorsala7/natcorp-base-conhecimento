import { streamText, stepCountIs } from "ai";
import type { NextRequest } from "next/server";
import { hasPermission } from "@/lib/auth/permissions";
import { chatModel, hasAiKey } from "@/lib/ai/config";
import { comContextoDeConsumo } from "@/lib/ai/usage-context";
import { buildSchemaTools, resumoEsquema } from "@/lib/integrations/builder-tools";
import { emSimulacao, type Operacao } from "@/lib/integrations/builder-plano";

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
/** Uso INTERNO da equipe: marcado como `admin`, fora de qualquer fatura de
 *  cliente, mas separado de `sistema` para dar para medir quanto a operação
 *  consome por conta própria. */
export async function POST(req: NextRequest) {
  return comContextoDeConsumo({ origem: "admin" }, () => handlePost(req));
}

async function handlePost(req: NextRequest) {
  if (!(await hasPermission("integrations.manage", null))) {
    return Response.json({ error: "Sem permissão para gerenciar integrações." }, { status: 403 });
  }
  if (!(await hasAiKey())) {
    return Response.json({ error: "Nenhuma IA configurada (Sistema → IA)." }, { status: 400 });
  }

  const body = (await req.json()) as { messages: Msg[]; aplicar?: Operacao[] };

  /**
   * APLICAR — executa o plano que a pessoa aprovou, sem passar pelo modelo.
   *
   * Reexecutar o LLM seria pedir outra resposta, possivelmente diferente da que
   * ela aprovou. Aqui as operações registradas na simulação rodam diretamente,
   * na mesma ordem, com as ferramentas de verdade.
   */
  if (Array.isArray(body.aplicar) && body.aplicar.length > 0) {
    const reais = buildSchemaTools() as Record<string, { execute?: (a: unknown) => Promise<unknown> }>;
    const feitas: string[] = [];
    for (const op of body.aplicar) {
      const f = reais[op.ferramenta]?.execute;
      if (!f) continue;
      try {
        await f(op.args);
        feitas.push(op.ferramenta);
      } catch (e) {
        // Para na primeira falha e diz o que já foi feito: seguir em frente
        // deixaria o esquema meio aplicado, sem ninguém saber onde parou.
        return Response.json(
          { error: `Falhou em "${op.ferramenta}": ${(e as Error).message}`, feitas },
          { status: 500 },
        );
      }
    }
    return Response.json({ ok: true, feitas });
  }

  const { messages } = body;
  const resumo = await resumoEsquema();

  /**
   * SIMULAÇÃO por padrão. As escritas apenas registram o que fariam; as leituras
   * seguem reais, porque o plano precisa ser feito com o estado verdadeiro.
   *
   * O prompt já pedia "resuma e peça confirmação antes de mudança grande" — e
   * não bastava: nada impedia o modelo de chamar a ferramenta e resumir depois.
   * A garantia tem que estar fora do modelo.
   */
  const plano: Operacao[] = [];

  const result = streamText({
    model: await chatModel({ origem: "admin" }),
    system: `${SYSTEM}\n\nESQUEMA ATUAL:\n${resumo}`,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    tools: emSimulacao(buildSchemaTools(), plano),
    stopWhen: stepCountIs(10),
    onError: ({ error }) => console.error("[builder] falha ao gerar resposta:", error),
  });

  const enc = new TextEncoder();
  const corpo = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of result.textStream) controller.enqueue(enc.encode(delta));
      } catch {
        /* stream vazio/erro do provedor: o cliente trata resposta vazia */
      }
      // O plano só existe DEPOIS do último passo, então viaja no fim do mesmo
      // stream, atrás de um marcador que não aparece em texto natural.
      if (plano.length > 0) {
        controller.enqueue(enc.encode(`\n<<<PLANO>>>${JSON.stringify(plano)}`));
      }
      controller.close();
    },
  });
  return new Response(corpo, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
