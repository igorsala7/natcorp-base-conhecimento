"use client";

import { useState, useTransition } from "react";
import { Surface } from "@/components/ui/surface";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/input";
import { ChatPanel } from "@/components/admin/chat-panel";
import { useToast } from "@/components/ui/toast";
import { updateSpaceChatPrompt } from "../configuracoes/actions";

/**
 * Bancada do Assistente: à esquerda a PARAMETRIZAÇÃO da persona (system prompt)
 * da documentação; à direita o CHAT de teste. O chat testa o RASCUNHO ao vivo
 * (via `promptOverride`) — dá para iterar antes de salvar. Salvar grava em
 * `spaces.chat_prompt` e o portal/widgets passam a usar pela cascata.
 */
export function AssistantWorkbench({
  spaceId,
  chatPromptSalvo,
  canEdit,
  aiReady,
}: {
  spaceId: string;
  chatPromptSalvo: string;
  canEdit: boolean;
  aiReady: boolean;
}) {
  const [prompt, setPrompt] = useState(chatPromptSalvo);
  const [salvo, setSalvo] = useState(chatPromptSalvo);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const sujo = prompt !== salvo;

  function salvar() {
    startTransition(async () => {
      try {
        const res = await updateSpaceChatPrompt(spaceId, prompt);
        if (!res.ok) return toast.error(res.error);
        setSalvo(prompt);
        toast.success("Persona salva. O portal e os chatbots desta documentação já usam.");
      } catch (e) {
        toast.error(e instanceof Error ? `Falha ao salvar: ${e.message}` : "Falha ao salvar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 lg:h-[calc(100dvh-13rem)] lg:flex-row lg:items-stretch">
      {/* ── Parametrização ─────────────────────────────────────────── */}
      <div className="w-full shrink-0 lg:h-full lg:w-[26rem] lg:overflow-y-auto lg:pr-1">
        <Surface elevation={1} padding="lg" className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
              Parametrização
            </h2>
            <p className="mt-1 text-xs text-text-muted">
              A persona vale para o Ask-AI do portal e para os chatbots desta documentação sem
              persona própria. As regras de citar as fontes e não responder por conhecimento
              próprio continuam valendo, sempre.
            </p>
          </div>

          <Field
            label="Persona / system prompt"
            htmlFor="chat-prompt"
            hint="Descreva o papel, o tom e os limites. Vazio = persona padrão do produto."
          >
            <textarea
              id="chat-prompt"
              rows={10}
              value={prompt}
              readOnly={!canEdit}
              placeholder="Ex.: Você é o suporte do Produto Alfa. Responda de forma objetiva e sempre indique o artigo."
              onChange={(e) => setPrompt(e.target.value)}
              className={`${controlClass} resize-y ${canEdit ? "" : "opacity-70"}`}
            />
          </Field>

          {canEdit ? (
            <>
              <div className="flex items-center gap-3">
                <Button onClick={salvar} disabled={pending || !sujo}>
                  {pending ? "Salvando…" : "Salvar persona"}
                </Button>
                {sujo && (
                  <Button variant="ghost" onClick={() => setPrompt(salvo)} disabled={pending}>
                    Descartar
                  </Button>
                )}
              </div>
              {sujo && (
                <p className="text-xs text-primary">
                  O chat ao lado já testa este rascunho — salve para valer no portal.
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-text-muted">
              Você não tem permissão para editar a persona desta documentação — mas pode testá-la
              no chat ao lado.
            </p>
          )}
        </Surface>
      </div>

      {/* ── Testar ─────────────────────────────────────────────────── */}
      <div className="flex min-h-[32rem] flex-1 flex-col lg:h-full lg:min-h-0">
        <ChatPanel fixedSpaceId={spaceId} promptOverride={prompt} aiReady={aiReady} />
      </div>
    </div>
  );
}
