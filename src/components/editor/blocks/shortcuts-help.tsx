"use client";

import { Dialog } from "@/components/ui/dialog";

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: "Formatação do texto",
    items: [
      ["⌘/Ctrl + B", "Negrito"],
      ["⌘/Ctrl + I", "Itálico"],
      ["⌘/Ctrl + E", "Código inline"],
      ["⌘/Ctrl + K", "Link"],
      ["⌘/Ctrl + ⇧ + X", "Tachado"],
      ["⌘/Ctrl + ⇧ + H", "Marca-texto"],
    ],
  },
  {
    title: "Inserir e transformar blocos",
    items: [
      ["/", "Menu de blocos (em bloco vazio)"],
      ["⌘/Ctrl + /", "Menu de blocos (em qualquer bloco)"],
      ["⌘/Ctrl + ↵", "Novo bloco abaixo"],
      ["⌘/Ctrl + ⇧ + 0", "Transformar em parágrafo"],
      ["⌘/Ctrl + ⇧ + 1 / 2 / 3", "Transformar em título 1 / 2 / 3"],
      ["⌘/Ctrl + ⇧ + 7", "Lista numerada"],
      ["⌘/Ctrl + ⇧ + 8", "Lista com marcadores"],
      ["⌘/Ctrl + ⇧ + 9", "Citação"],
    ],
  },
  {
    title: "Manipular o bloco selecionado",
    items: [
      ["Botão direito", "Menu de ações do bloco"],
      ["⌘/Ctrl + D", "Duplicar bloco"],
      ["⌘/Ctrl + ⇧ + ⌫", "Excluir bloco"],
      ["⌥/Alt + ⇧ + ↑ / ↓", "Mover bloco para cima / baixo"],
      ["Esc", "Desselecionar / fechar menus"],
      ["⌘/Ctrl + Z", "Desfazer"],
      ["⌘/Ctrl + ⇧ + Z", "Refazer"],
    ],
  },
  {
    title: "Página",
    items: [
      ["⌘/Ctrl + ⇧ + P", "Alternar Visualizar / Editar"],
      ["⌘/Ctrl + ⇧ + /", "Mostrar estes atalhos"],
    ],
  },
];

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} size="lg" title="Atalhos do teclado">
      <div className="grid max-h-[65vh] gap-x-8 gap-y-6 overflow-auto sm:grid-cols-2">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
              {g.title}
            </h3>
            <ul className="space-y-1.5">
              {g.items.map(([keys, desc]) => (
                <li key={keys} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-text-muted">{desc}</span>
                  <kbd className="shrink-0 rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-text">
                    {keys}
                  </kbd>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
