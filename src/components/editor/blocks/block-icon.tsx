"use client";

import { createElement } from "react";
import { ICONS } from "@/lib/blocks/icons";

/**
 * Desenha um ícone do catálogo pela chave. Usa `createElement` porque, em
 * arquivos "use client", o compilador do React acusa "componente criado durante
 * o render" quando se faz `const Icon = mapa[k]; <Icon />`.
 */
export function BlockIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = name ? ICONS[name] : undefined;
  return Icon ? createElement(Icon, { className }) : null;
}
