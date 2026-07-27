"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { controlClass } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  getSchedule,
  listPublishedArticles,
  setSchedule,
} from "@/app/(admin)/admin/(app)/conteudo/article-actions";

/** ISO (UTC) → valor de <input type="datetime-local"> no fuso do navegador. */
function isoParaLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Valor local do input → ISO UTC (a conversão de fuso é do NAVEGADOR). */
function localParaIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * "Agendar publicação" (padrão HubSpot): publicar e/ou despublicar em data
 * marcada; despublicar pede destino de redirect — link compartilhado nunca
 * pode quebrar. Quem executa é o worker, com a MESMA lógica do publicar manual.
 */
export function ScheduleDialog({
  nodeId,
  spaceId,
  onClose,
}: {
  nodeId: string;
  spaceId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pub, setPub] = useState("");
  const [unpub, setUnpub] = useState("");
  const [redirectTo, setRedirectTo] = useState("");
  const [destinos, setDestinos] = useState<{ id: string; title: string }[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    void Promise.all([getSchedule(nodeId), listPublishedArticles(spaceId)]).then(
      ([agenda, artigos]) => {
        if (!alive) return;
        setPub(isoParaLocal(agenda.publishAt));
        setUnpub(isoParaLocal(agenda.unpublishAt));
        setRedirectTo(agenda.redirectTo ?? "");
        setDestinos(artigos.filter((a) => a.id !== nodeId));
        setCarregado(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [nodeId, spaceId]);

  function salvar(limpar = false) {
    startTransition(async () => {
      const r = await setSchedule(nodeId, {
        publishAt: limpar ? null : localParaIso(pub),
        unpublishAt: limpar ? null : localParaIso(unpub),
        redirectTo: limpar ? null : redirectTo || null,
      });
      if (!r.ok) return toast.error(r.error);
      toast.success(limpar ? "Agendamento removido." : "Publicação agendada.");
      router.refresh();
      onClose();
    });
  }

  const temAgendamento = !!(pub || unpub);

  return (
    <Dialog
      open
      onClose={() => !pending && onClose()}
      title="Agendar publicação"
      description="O worker executa no horário marcado, com snapshot de versão e embeddings — igual ao publicar manual."
      footer={
        <>
          {temAgendamento && (
            <Button variant="ghost" disabled={pending || !carregado} onClick={() => salvar(true)}>
              Limpar agendamento
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button disabled={pending || !carregado || !temAgendamento} onClick={() => salvar()}>
            {pending ? "Salvando…" : "Agendar"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Publicar em" htmlFor="agd-pub" hint="Vazio = não agendar a publicação.">
          <input
            id="agd-pub"
            type="datetime-local"
            value={pub}
            onChange={(e) => setPub(e.target.value)}
            disabled={!carregado}
            className={`${controlClass} h-10`}
          />
        </Field>

        <Field
          label="Despublicar em"
          htmlFor="agd-unpub"
          hint="O artigo sai do ar neste horário. Vazio = permanece publicado."
        >
          <input
            id="agd-unpub"
            type="datetime-local"
            value={unpub}
            onChange={(e) => setUnpub(e.target.value)}
            disabled={!carregado}
            className={`${controlClass} h-10`}
          />
        </Field>

        {unpub && (
          <Field
            label="Redirecionar visitantes para"
            htmlFor="agd-redirect"
            hint="Quem abrir o link antigo cai neste artigo — URLs compartilhadas não quebram."
          >
            <select
              id="agd-redirect"
              value={redirectTo}
              onChange={(e) => setRedirectTo(e.target.value)}
              disabled={!carregado}
              className={`${controlClass} h-10`}
            >
              <option value="">Sem redirect (o link passa a dar 404)</option>
              {destinos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </Field>
        )}

      </div>
    </Dialog>
  );
}
