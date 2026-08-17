"use client";

import { useState, useTransition } from "react";
import { Surface } from "@/components/ui/surface";
import { sectionTitleClass } from "@/components/ui/page-shell";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/input";
import { ChatPanel, type SimIdentity } from "@/components/admin/chat-panel";
import { useToast } from "@/components/ui/toast";
import { updateSpaceChatPrompt } from "../configuracoes/actions";
import { Select } from "@/components/ui/select";

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
  bases = [],
}: {
  spaceId: string;
  chatPromptSalvo: string;
  canEdit: boolean;
  aiReady: boolean;
  /** Bases de integração para SIMULAR um usuário (só admin de integrações). */
  bases?: { base_code: string; name: string }[];
}) {
  const [prompt, setPrompt] = useState(chatPromptSalvo);
  const [salvo, setSalvo] = useState(chatPromptSalvo);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const sujo = prompt !== salvo;
  const [sim, setSim] = useState<SimIdentity>({});
  const setSimField = (k: keyof SimIdentity, v: string) => setSim((s) => ({ ...s, [k]: v || undefined }));

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
            <h2 className={sectionTitleClass}>
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
          {/* U3: contador — a persona é CORTADA em 2000 chars ao aplicar; sem aviso, era
              cortada no meio da frase em silêncio. */}
          <p className={`-mt-2 text-xs ${prompt.length > 2000 ? "text-danger" : "text-text-muted"}`}>
            {prompt.length}/2000 caracteres{prompt.length > 2000 ? " — o excedente será CORTADO ao aplicar a persona." : ""}
          </p>

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

        {bases.length > 0 && (
          <Surface elevation={1} padding="lg" className="mt-4 space-y-3">
            <div>
              <h2 className={sectionTitleClass}>
                Simular identidade
              </h2>
              <p className="mt-1 text-xs text-text-muted">
                Teste o chat como um usuário de uma base: a IA ganha as ferramentas daquela base e
                resolve o login (perfil, CPF…) como no widget. Base vazia = chat normal da documentação.
              </p>
            </div>

            <Field label="Base (cliente)" htmlFor="sim-base">
              <Select
                id="sim-base"
                value={sim.base_code ?? ""}
                onChange={(v) => setSimField("base_code", v)}
               
              >
                <option value="">— nenhuma (documentação) —</option>
                {bases.map((b) => (
                  <option key={b.base_code} value={b.base_code}>
                    {b.name} ({b.base_code})
                  </option>
                ))}
              </Select>
            </Field>

            {sim.base_code && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Usuário" htmlFor="sim-usuario">
                    <input id="sim-usuario" value={sim.usuario ?? ""} onChange={(e) => setSimField("usuario", e.target.value)} className={controlClass} placeholder="p_usuario" />
                  </Field>
                  <Field label="Empresa" htmlFor="sim-empresa">
                    <input id="sim-empresa" value={sim.empresa ?? ""} onChange={(e) => setSimField("empresa", e.target.value)} className={controlClass} placeholder="cod_empresa" />
                  </Field>
                  <Field label="Matrícula" htmlFor="sim-matricula">
                    <input id="sim-matricula" value={sim.matricula ?? ""} onChange={(e) => setSimField("matricula", e.target.value)} className={controlClass} placeholder="matrícula" />
                  </Field>
                  <Field label="Portal" htmlFor="sim-portal">
                    <input id="sim-portal" value={sim.portal ?? ""} onChange={(e) => setSimField("portal", e.target.value)} className={controlClass} placeholder="p_portal" />
                  </Field>
                </div>
                <Field label="Perfil" htmlFor="sim-perfil" hint="Se a base resolver o login, o perfil real vem de lá (sobrepõe este).">
                  <Select id="sim-perfil" value={sim.perfil ?? ""} onChange={(v) => setSimField("perfil", v)}>
                    <option value="">— (resolvido no login) —</option>
                    <option value="colaborador">colaborador</option>
                    <option value="gestor">gestor</option>
                  </Select>
                </Field>
                <p className="text-xs text-text-muted">Trocar a base começa uma conversa nova.</p>
              </>
            )}
          </Surface>
        )}
      </div>

      {/* ── Testar ─────────────────────────────────────────────────── */}
      <div className="flex min-h-[32rem] flex-1 flex-col lg:h-full lg:min-h-0">
        {/* key por base: trocar a base reinicia a conversa. */}
        <ChatPanel key={sim.base_code ?? "doc"} fixedSpaceId={spaceId} promptOverride={prompt} aiReady={aiReady} sim={sim} />
      </div>
    </div>
  );
}
