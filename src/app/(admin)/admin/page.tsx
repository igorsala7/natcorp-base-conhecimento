import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Painel",
};

/**
 * Painel do Admin — vazio por ora (Fase 0). Existe para provar o shell,
 * os tokens de cor e o dark mode. Conteúdo real chega nas próximas fases.
 */
export default function AdminHome() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Painel</h1>
      <p className="mt-2 max-w-prose text-text-muted">
        Fundação pronta. A partir daqui construímos a árvore de conteúdo, o
        editor, o portal público, a busca híbrida, o importador e o assistente
        de IA — uma fase por vez.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { titulo: "Espaços", valor: "—", nota: "Fase 1" },
          { titulo: "Artigos", valor: "—", nota: "Fase 1" },
          { titulo: "Publicados", valor: "—", nota: "Fase 1" },
        ].map((card) => (
          <div
            key={card.titulo}
            className="rounded-lg border border-border bg-surface p-5"
          >
            <div className="text-sm text-text-muted">{card.titulo}</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums">
              {card.valor}
            </div>
            <div className="mt-2 inline-flex items-center rounded-full bg-brand-pink-50 px-2 py-0.5 text-xs font-medium text-brand-pink-700 dark:bg-brand-pink-950/40 dark:text-brand-pink-300">
              {card.nota}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <span className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg">
          Botão primário
        </span>
        <span className="inline-flex items-center rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-medium">
          Secundário
        </span>
        <a
          href="#"
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Um link da marca
        </a>
      </div>
    </div>
  );
}
