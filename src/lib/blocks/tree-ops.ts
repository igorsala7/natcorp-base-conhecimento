/**
 * Operações puras sobre a árvore de blocos (isomórfico). Todas usam
 * *structural sharing*: só a cadeia de ancestrais do bloco alvo é reclonada;
 * irmãos mantêm identidade referencial. É isso que permite `React.memo` por
 * bloco re-renderizar apenas o que mudou.
 */
import { type Block, newId } from "./schema";

function kids(b: Block): Block[] | undefined {
  return "children" in b ? (b.children as Block[] | undefined) : undefined;
}

/** Substitui children preservando o tipo (cast centralizado aqui). */
function setKids(b: Block, children: Block[]): Block {
  return { ...b, children } as Block;
}

/** Aplica `fn` ao bloco com `id`, reclonando só os ancestrais. */
export function updateBlock(blocks: Block[], id: string, fn: (b: Block) => Block): Block[] {
  let changed = false;
  const out = blocks.map((b) => {
    if (b.id === id) {
      changed = true;
      return fn(b);
    }
    const ch = kids(b);
    if (ch) {
      const nextCh = updateBlock(ch, id, fn);
      if (nextCh !== ch) {
        changed = true;
        return setKids(b, nextCh);
      }
    }
    return b;
  });
  return changed ? out : blocks;
}

/** Atalho: mescla `patch` no bloco alvo. */
export function patchBlock(blocks: Block[], id: string, patch: Partial<Block>): Block[] {
  return updateBlock(blocks, id, (b) => ({ ...b, ...patch }) as Block);
}

/** Remove o bloco com `id` (em qualquer profundidade). */
export function removeBlock(blocks: Block[], id: string): Block[] {
  let changed = false;
  const out: Block[] = [];
  for (const b of blocks) {
    if (b.id === id) {
      changed = true;
      continue;
    }
    const ch = kids(b);
    if (ch) {
      const nextCh = removeBlock(ch, id);
      if (nextCh !== ch) {
        changed = true;
        out.push(setKids(b, nextCh));
        continue;
      }
    }
    out.push(b);
  }
  return changed ? out : blocks;
}

/** Insere `block` imediatamente após o irmão `afterId`. */
export function insertAfter(blocks: Block[], afterId: string, block: Block): Block[] {
  const idx = blocks.findIndex((b) => b.id === afterId);
  if (idx >= 0) {
    const out = blocks.slice();
    out.splice(idx + 1, 0, block);
    return out;
  }
  let changed = false;
  const out = blocks.map((b) => {
    const ch = kids(b);
    if (ch) {
      const nextCh = insertAfter(ch, afterId, block);
      if (nextCh !== ch) {
        changed = true;
        return setKids(b, nextCh);
      }
    }
    return b;
  });
  return changed ? out : blocks;
}

/** Adiciona `block` ao fim dos filhos de `parentId`. */
export function appendChild(blocks: Block[], parentId: string, block: Block): Block[] {
  return updateBlock(blocks, parentId, (b) => {
    const ch = kids(b) ?? [];
    return setKids(b, [...ch, block]);
  });
}

/** Localiza um bloco por id (busca em profundidade). */
export function findBlock(blocks: Block[], id: string): Block | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    const ch = kids(b);
    if (ch) {
      const found = findBlock(ch, id);
      if (found) return found;
    }
  }
  return null;
}

/** Clona um bloco (e subárvore) com novos ids. */
export function cloneWithNewIds(b: Block): Block {
  const copy = { ...b, id: newId() } as Block & { data?: unknown; text?: unknown; children?: Block[] };
  if ("data" in b && b.data) copy.data = structuredClone(b.data);
  if ("text" in b && b.text) copy.text = structuredClone(b.text);
  const ch = kids(b);
  if (ch) copy.children = ch.map(cloneWithNewIds);
  return copy as Block;
}

/** Duplica o bloco `id`, inserindo a cópia logo depois. */
export function duplicateBlock(blocks: Block[], id: string): Block[] {
  const target = findBlock(blocks, id);
  if (!target) return blocks;
  return insertAfter(blocks, id, cloneWithNewIds(target));
}

export function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const copy = array.slice();
  const [item] = copy.splice(from, 1);
  if (item !== undefined) copy.splice(to, 0, item);
  return copy;
}

/** Move `activeId` para a posição de `overId` DENTRO da mesma lista de irmãos. */
export function moveBlock(blocks: Block[], activeId: string, overId: string): Block[] {
  const ai = blocks.findIndex((b) => b.id === activeId);
  const oi = blocks.findIndex((b) => b.id === overId);
  if (ai >= 0 && oi >= 0) return arrayMove(blocks, ai, oi);
  let changed = false;
  const out = blocks.map((b) => {
    const ch = kids(b);
    if (ch) {
      const next = moveBlock(ch, activeId, overId);
      if (next !== ch) {
        changed = true;
        return setKids(b, next);
      }
    }
    return b;
  });
  return changed ? out : blocks;
}

/** Move o bloco `id` uma posição para cima/baixo entre os irmãos. */
export function nudgeBlock(blocks: Block[], id: string, dir: -1 | 1): Block[] {
  const idx = blocks.findIndex((b) => b.id === id);
  if (idx >= 0) {
    const to = idx + dir;
    if (to < 0 || to >= blocks.length) return blocks;
    return arrayMove(blocks, idx, to);
  }
  let changed = false;
  const out = blocks.map((b) => {
    const ch = kids(b);
    if (ch) {
      const next = nudgeBlock(ch, id, dir);
      if (next !== ch) {
        changed = true;
        return setKids(b, next);
      }
    }
    return b;
  });
  return changed ? out : blocks;
}

// ── DnD: achatar / reconstruir ───────────────────────────────────────────────

export type FlatBlock = {
  id: string;
  block: Block;
  depth: number;
  parentId: string | null;
  index: number; // posição entre irmãos
};

/** Achata a árvore para o SortableContext (todos os níveis). */
export function flattenBlocks(
  blocks: Block[],
  parentId: string | null = null,
  depth = 0,
): FlatBlock[] {
  return blocks.flatMap((block, index) => {
    const self: FlatBlock = { id: block.id, block, depth, parentId, index };
    const ch = kids(block);
    return ch && ch.length ? [self, ...flattenBlocks(ch, block.id, depth + 1)] : [self];
  });
}

/**
 * Reconstrói a árvore a partir de uma lista achatada com (id, parentId). A ordem
 * da lista define a ordem dos irmãos. Cada bloco reaproveita seu objeto original
 * (sem filhos) e recebe os filhos recalculados.
 */
export function rebuildTree(flat: { id: string; parentId: string | null; block: Block }[]): Block[] {
  const byParent = new Map<string | null, { id: string; block: Block }[]>();
  for (const f of flat) {
    const list = byParent.get(f.parentId) ?? [];
    list.push({ id: f.id, block: f.block });
    byParent.set(f.parentId, list);
  }
  const build = (parentId: string | null): Block[] => {
    const list = byParent.get(parentId) ?? [];
    return list.map(({ id, block }) => {
      const children = build(id);
      return "children" in block ? (setKids(block, children)) : block;
    });
  };
  return build(null);
}
