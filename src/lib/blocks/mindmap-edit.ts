import { newId, type MindMapNode } from "./schema";

/**
 * Edição IMUTÁVEL da árvore do mapa mental (pura e testável). Cada função
 * devolve uma NOVA raiz, preservando ids (e portanto notas/cores/ícones) dos
 * nós não afetados. Usada pelo editor do bloco.
 */

/** Aplica um patch ao nó `id`. */
export function mapUpdateNode(root: MindMapNode, id: string, patch: Partial<MindMapNode>): MindMapNode {
  if (root.id === id) return { ...root, ...patch };
  if (!root.children) return root;
  return { ...root, children: root.children.map((c) => mapUpdateNode(c, id, patch)) };
}

export function findNode(root: MindMapNode, id: string): MindMapNode | undefined {
  if (root.id === id) return root;
  for (const c of root.children ?? []) {
    const f = findNode(c, id);
    if (f) return f;
  }
  return undefined;
}

/** Adiciona um filho ao nó `parentId`. Devolve a nova raiz + o id criado. */
export function mapAddChild(root: MindMapNode, parentId: string): { root: MindMapNode; id: string } {
  const id = newId();
  const novo: MindMapNode = { id, label: "Novo tópico" };
  const rec = (n: MindMapNode): MindMapNode => {
    if (n.id === parentId) return { ...n, children: [...(n.children ?? []), novo] };
    if (!n.children) return n;
    return { ...n, children: n.children.map(rec) };
  };
  return { root: rec(root), id };
}

/** Adiciona um irmão APÓS `id` (a raiz não tem irmão → null). */
export function mapAddSibling(root: MindMapNode, id: string): { root: MindMapNode; id: string } | null {
  if (root.id === id) return null;
  const newid = newId();
  const novo: MindMapNode = { id: newid, label: "Novo tópico" };
  let ok = false;
  const rec = (n: MindMapNode): MindMapNode => {
    if (!n.children) return n;
    const idx = n.children.findIndex((c) => c.id === id);
    if (idx >= 0) {
      ok = true;
      const kids = [...n.children];
      kids.splice(idx + 1, 0, novo);
      return { ...n, children: kids };
    }
    return { ...n, children: n.children.map(rec) };
  };
  const out = rec(root);
  return ok ? { root: out, id: newid } : null;
}

/** Remove um nó (a raiz nunca é removida). */
export function mapRemove(root: MindMapNode, id: string): MindMapNode {
  if (root.id === id) return root;
  const rec = (n: MindMapNode): MindMapNode => {
    if (!n.children) return n;
    const kids = n.children.filter((c) => c.id !== id).map(rec);
    return { ...n, children: kids.length ? kids : undefined };
  };
  return rec(root);
}

/** Move um nó entre os irmãos (-1 = sobe, 1 = desce). */
export function mapMove(root: MindMapNode, id: string, dir: -1 | 1): MindMapNode {
  const rec = (n: MindMapNode): MindMapNode => {
    if (!n.children) return n;
    const idx = n.children.findIndex((c) => c.id === id);
    if (idx >= 0) {
      const j = idx + dir;
      if (j < 0 || j >= n.children.length) return { ...n, children: n.children.map(rec) };
      const kids = [...n.children];
      [kids[idx], kids[j]] = [kids[j]!, kids[idx]!];
      return { ...n, children: kids };
    }
    return { ...n, children: n.children.map(rec) };
  };
  return rec(root);
}
