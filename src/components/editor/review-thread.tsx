"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Send, MessageSquare, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/input";
import {
  listReviewComments,
  addReviewComment,
  type ReviewComment,
} from "@/app/(admin)/admin/(app)/conteudo/review-actions";

const KIND: Record<ReviewComment["kind"], { label: string; icon: typeof Inbox; cls: string }> = {
  submit: { label: "Enviado para revisão", icon: Inbox, cls: "text-text-muted" },
  approve: { label: "Aprovado", icon: CheckCircle2, cls: "text-primary" },
  reject: { label: "Rejeitado", icon: XCircle, cls: "text-brand-pink-700" },
  comment: { label: "Comentário", icon: MessageSquare, cls: "text-text-muted" },
};

export function ReviewThread({ nodeId, canComment }: { nodeId: string; canComment: boolean }) {
  const [items, setItems] = useState<ReviewComment[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setItems(await listReviewComments(nodeId));
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  async function add() {
    if (!body.trim()) return;
    setBusy(true);
    const r = await addReviewComment(nodeId, body);
    setBusy(false);
    if (r.ok) {
      setBody("");
      load();
    }
  }

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-text-muted">Nenhuma atividade de revisão ainda.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => {
            const k = KIND[c.kind];
            const Icon = k.icon;
            return (
              <li key={c.id} className="flex gap-2 text-sm">
                <Icon className={`mt-0.5 size-4 shrink-0 ${k.cls}`} />
                <div className="min-w-0">
                  <span className="text-xs text-text-muted">
                    <span className={k.cls}>{k.label}</span>
                    {c.author ? ` · ${c.author}` : ""} · {new Date(c.created_at).toLocaleString("pt-BR")}
                  </span>
                  {c.body && <p className="whitespace-pre-wrap">{c.body}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canComment && (
        <div className="flex items-start gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="Comentar para o revisor / editor…"
            className={`${controlClass} min-h-0 flex-1`}
          />
          <Button size="sm" onClick={add} disabled={busy || !body.trim()}>
            <Send className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
