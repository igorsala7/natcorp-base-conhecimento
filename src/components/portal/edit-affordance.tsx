"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { ancoraDePrevia } from "@/lib/content/preview-anchor";

/**
 * Atalho de edição para quem está logado com permissão, mostrado no portal.
 *
 * A checagem acontece no NAVEGADOR, via `fetch` a um endpoint que se autentica
 * sozinho. É o que permite oferecer a edição sem o portal ler sessão no
 * servidor: a rota `/docs` continua anônima e cacheável, o HTML entregue é
 * idêntico para todo mundo, e nenhum código do admin entra neste bundle.
 *
 * O destino é a prévia em modo edição, e não uma edição aqui: o portal só
 * enxerga o que está publicado, então editar em massa por aqui seria cego a
 * todo rascunho e artigo nunca publicado.
 */
export function EditAffordance({
  spaceId,
  nodeId,
}: {
  spaceId: string;
  /** Artigo em foco, para cair direto nele na prévia. */
  nodeId?: string | null;
}) {
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    const chave = `kb.editAccess.${spaceId}`;
    const cache = sessionStorage.getItem(chave);
    if (cache !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCanEdit(cache === "1");
      return;
    }
    let vivo = true;
    fetch(`/api/admin/edit-access?space=${encodeURIComponent(spaceId)}`, {
      credentials: "same-origin",
    })
      .then((r) => (r.ok ? r.json() : { canEdit: false }))
      .then((d: { canEdit?: boolean }) => {
        if (!vivo) return;
        const pode = d.canEdit === true;
        // Cache por sessão: um visitante anônimo faz esta pergunta uma vez só.
        sessionStorage.setItem(chave, pode ? "1" : "0");
        setCanEdit(pode);
      })
      .catch(() => {
        /* offline ou bloqueado: simplesmente não oferece a edição */
      });
    return () => {
      vivo = false;
    };
  }, [spaceId]);

  if (!canEdit) return null;

  const destino = `/admin/previa/${spaceId}?edit=1${nodeId ? `#${ancoraDePrevia(nodeId)}` : ""}`;

  return (
    <a
      href={destino}
      target="_blank"
      rel="noopener"
      title="Abrir a documentação inteira em modo edição, incluindo o que não foi publicado"
      className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-sm font-medium shadow-2 transition-colors hover:border-primary hover:text-primary"
    >
      <Pencil className="size-4" />
      Modo edição
    </a>
  );
}
