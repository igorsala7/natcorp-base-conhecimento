import type { ReactNode } from "react";
import type { Block, BlockType } from "@/lib/blocks/schema";
import type { RichTextHandle } from "./rich-text/rich-text";

/** API estável de mutação da árvore, exposta pelo block-editor a cada bloco. */
export type EditorActions = {
  patch: (id: string, patch: Partial<Block>) => void;
  insertAfter: (id: string, type: BlockType) => void;
  /**
   * Insere blocos JÁ construídos após `afterId` (null = fim do documento).
   * Se `afterId` for um parágrafo vazio, é substituído. Usado ao colar
   * conteúdo de Word/Docs/web já convertido em blocos.
   */
  insertBlocks: (afterId: string | null, blocks: Block[]) => void;
  /** Acrescenta um filho ao contêiner (coluna, card, passo, item…). */
  addChild: (parentId: string, type: BlockType) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  transform: (id: string, type: BlockType) => void;
  /** Transforma em título já no nível pedido. */
  transformHeading: (id: string, level: 1 | 2 | 3) => void;
  move: (id: string, dir: -1 | 1) => void;
  select: (id: string | null) => void;
  /** Alterna a presença do bloco na seleção múltipla (shift/ctrl/cmd+clique). */
  selectToggle: (id: string) => void;
  openSlash: (id: string, rect: DOMRect) => void;
};

/** Props comuns a todo componente de edição de bloco. */
export type BlockEditProps = {
  block: Block;
  /** Mescla `patch` neste bloco (o pai aplica via patchBlock). */
  onChange: (patch: Partial<Block>) => void;
  /** Enter em bloco de texto: criar um novo bloco depois. */
  onEnter?: () => void;
  /** Backspace no início e vazio: mesclar/remover. */
  onEmptyBackspace?: () => void;
  /** "/" em bloco vazio: abrir o slash menu. */
  onSlash?: (rect: DOMRect) => void;
  registerHandle?: (h: RichTextHandle | null) => void;
  autoFocus?: boolean;
  spaceId: string;
  /** Filhos já renderizados (para contêineres). */
  children?: ReactNode;
};
