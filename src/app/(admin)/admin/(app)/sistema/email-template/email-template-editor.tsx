"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Mail, Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { useConfirm } from "@/components/ui/confirm";
import { EmbeddedBlockEditor } from "@/components/editor/blocks/embedded-editor";
import { normalizeDoc } from "@/lib/blocks/convert";
import { blocksToEmailHtml, injectEmailBody, wrapEmailDocument } from "@/lib/blocks/email-html";
import type { Block } from "@/lib/blocks/schema";
import { EMAIL_PRESETS, templatePadrao } from "@/lib/email/presets";
import { saveEmailTemplate, sendTestEmail } from "../actions";

/** Corpo de exemplo mostrado na pré-visualização no lugar do {{conteudo}}. */
const CORPO_EXEMPLO =
  `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3f4451">Olá! Este é um exemplo do corpo — o convite, a confirmação, as novidades etc. entram aqui, no lugar do <code style="font-family:monospace;background:#f3f4f6;padding:1px 4px;border-radius:3px">{{conteudo}}</code>.</p>` +
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px"><tr><td style="border-radius:8px;background:#511C76"><a href="#" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;border-radius:8px">Botão de exemplo</a></td></tr></table>`;
const CORPO_MINI = `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f4451">Prévia do conteúdo da mensagem, que entra aqui automaticamente.</p>`;

export function EmailTemplateEditor({
  initialDoc,
  spaceId,
  remetente,
}: {
  initialDoc: unknown;
  spaceId: string;
  remetente: string;
}) {
  const iniciais = useMemo(() => {
    const { blocks } = normalizeDoc(initialDoc);
    return blocks.length ? blocks : templatePadrao().blocks;
  }, [initialDoc]);

  const [blocks, setBlocks] = useState<Block[]>(iniciais);
  const [salvoJson, setSalvoJson] = useState(() => JSON.stringify(iniciais));
  const [editorKey, setEditorKey] = useState(0);
  const [dispositivo, setDispositivo] = useState<"desktop" | "mobile">("desktop");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const { confirmar } = useConfirm();

  const sujo = JSON.stringify(blocks) !== salvoJson;
  const ano = String(new Date().getFullYear());

  const previewHtml = useMemo(
    () => wrapEmailDocument(injectEmailBody(blocksToEmailHtml(blocks), CORPO_EXEMPLO, { remetente, ano })),
    [blocks, remetente, ano],
  );

  // Miniaturas dos modelos (renderizadas de verdade e escaladas no card).
  const thumbs = useMemo(
    () =>
      EMAIL_PRESETS.map((p) => ({
        ...p,
        html: wrapEmailDocument(injectEmailBody(blocksToEmailHtml(p.criar().blocks), CORPO_MINI, { remetente, ano })),
      })),
    [remetente, ano],
  );

  function salvar(): Promise<boolean> {
    return new Promise((resolve) => {
      setMsg(null);
      startTransition(async () => {
        try {
          const res = await saveEmailTemplate({ version: 2, blocks });
          if (!res.ok) {
            setMsg(res.error);
            return resolve(false);
          }
          setSalvoJson(JSON.stringify(blocks));
          setMsg("Template salvo.");
          resolve(true);
        } catch (e) {
          setMsg(e instanceof Error ? `Falha ao salvar: ${e.message}` : "Falha ao salvar.");
          resolve(false);
        }
      });
    });
  }

  async function testar() {
    if (sujo && !(await salvar())) return; // testa sempre o que está salvo/no ar
    startTransition(async () => {
      const res = await sendTestEmail();
      setMsg(res.ok ? res.msg ?? "E-mail de teste enviado." : res.error);
    });
  }

  async function aplicarPreset(criar: () => { blocks: Block[] }) {
    if (
      sujo &&
      !(await confirmar({
        title: "Trocar de modelo",
        description: "As alterações não salvas serão substituídas por este modelo. Continuar?",
        confirmLabel: "Trocar",
      }))
    )
      return;
    setBlocks(criar().blocks);
    setEditorKey((k) => k + 1);
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <Link
          href="/admin/sistema"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
        >
          <ArrowLeft className="size-4" /> Sistema
        </Link>
        <span aria-hidden className="text-border-strong">
          /
        </span>
        <h1 className="text-sm font-semibold">Template de e-mail</h1>

        <div className="ml-auto flex items-center gap-2">
          {msg && <span className="mr-1 text-xs text-text-muted">{msg}</span>}
          <Button size="sm" variant="secondary" onClick={testar} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Enviar teste
          </Button>
          <Button size="sm" onClick={() => void salvar()} disabled={pending || !sujo}>
            <Check className="size-4" /> {sujo ? "Salvar" : "Salvo"}
          </Button>
        </div>
      </div>

      {/* Galeria de modelos prontos (miniaturas ao vivo) */}
      <div className="border-b border-border py-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Modelos prontos</p>
          <p className="hidden text-xs text-text-muted sm:block">
            Deixe um <code className="rounded bg-surface-2 px-1">{"{{conteudo}}"}</code> onde o corpo de cada e-mail
            deve entrar.
          </p>
        </div>
        <div className="slim-scroll flex gap-3 overflow-x-auto pb-1">
          {thumbs.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => void aplicarPreset(p.criar)}
              title={p.descricao}
              className="group shrink-0 text-left"
            >
              <div className="h-[132px] w-[168px] overflow-hidden rounded-lg border border-border bg-white transition-all group-hover:border-primary group-hover:shadow-2">
                <iframe
                  title={`Modelo ${p.nome}`}
                  srcDoc={p.html}
                  sandbox=""
                  tabIndex={-1}
                  aria-hidden
                  scrolling="no"
                  style={{
                    width: 600,
                    height: 560,
                    border: 0,
                    transform: "scale(0.28)",
                    transformOrigin: "top left",
                    pointerEvents: "none",
                  }}
                />
              </div>
              <span className="mt-1.5 block text-xs font-medium group-hover:text-primary">{p.nome}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Duas colunas: design | pré-visualização (cada uma rola sozinha) */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 pt-4 lg:flex-row">
        <div className="min-h-0 flex-1 overflow-auto lg:w-1/2">
          <EmbeddedBlockEditor
            key={editorKey}
            instanceId="email-template"
            spaceId={spaceId}
            initialBlocks={blocks}
            onChange={setBlocks}
          />
        </div>
        <div className="flex min-h-[24rem] flex-col overflow-hidden rounded-lg border border-border bg-surface-2 lg:w-1/2">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Pré-visualização</p>
            <Segmented<"desktop" | "mobile">
              value={dispositivo}
              onChange={setDispositivo}
              options={[
                { value: "desktop", label: <Monitor className="size-3.5" />, title: "Computador" },
                { value: "mobile", label: <Smartphone className="size-3.5" />, title: "Celular" },
              ]}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <div className={dispositivo === "mobile" ? "mx-auto w-[390px] max-w-full" : "w-full"}>
              <iframe
                title="Pré-visualização do e-mail"
                srcDoc={previewHtml}
                sandbox=""
                className="h-[calc(100dvh-16rem)] w-full rounded-md border border-border bg-white"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
