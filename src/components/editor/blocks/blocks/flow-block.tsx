"use client";

import { FlowCanvas } from "./flow-canvas";
import type { BlockEditProps } from "../edit-types";

/**
 * Fluxograma no editor: canvas INTERATIVO (arrastar nós + botão-direito para
 * estilizar). A edição de ESTRUTURA e o "Editar com IA" ficam no painel de
 * propriedades (flow-props.tsx); os dois mexem no mesmo `data`.
 */
export function FlowBlock(props: BlockEditProps) {
  return <FlowCanvas {...props} />;
}
