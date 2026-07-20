/**
 * Conversão entre a seleção do DOM e offsets de caractere no texto do bloco.
 * Conta nós de texto e trata <br> como 1 caractere ("\n"). Usado para aplicar
 * marcas no modelo e restaurar a seleção após re-render.
 */

function nodeLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent?.length ?? 0;
  if (node.nodeName === "BR") return 1;
  let sum = 0;
  node.childNodes.forEach((c) => (sum += nodeLength(c)));
  return sum;
}

/** Offset de caractere de uma posição (container, offset) dentro de `root`. */
function offsetOf(root: Node, container: Node, offset: number): number {
  let total = 0;
  let found = false;
  const rec = (node: Node) => {
    if (found) return;
    if (node === container) {
      if (node.nodeType === Node.TEXT_NODE) {
        total += offset;
      } else {
        for (let i = 0; i < offset && i < node.childNodes.length; i++) {
          total += nodeLength(node.childNodes[i]!);
        }
      }
      found = true;
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      total += node.textContent?.length ?? 0;
      return;
    }
    if (node.nodeName === "BR") {
      total += 1;
      return;
    }
    node.childNodes.forEach(rec);
  };
  rec(root);
  return total;
}

export function getSelectionOffsets(root: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  const a = offsetOf(root, range.startContainer, range.startOffset);
  const b = offsetOf(root, range.endContainer, range.endOffset);
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

/** Acha (nó de texto, offset local) para um offset de caractere absoluto. */
function locate(root: Node, target: number): { node: Node; offset: number } {
  let remaining = target;
  let lastText: { node: Node; offset: number } | null = null;
  let result: { node: Node; offset: number } | null = null;
  const rec = (node: Node) => {
    if (result) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length ?? 0;
      lastText = { node, offset: len };
      if (remaining <= len) {
        result = { node, offset: remaining };
        return;
      }
      remaining -= len;
      return;
    }
    if (node.nodeName === "BR") {
      if (remaining <= 0) {
        result = lastText ?? { node, offset: 0 };
        return;
      }
      remaining -= 1;
      return;
    }
    node.childNodes.forEach(rec);
  };
  rec(root);
  return result ?? lastText ?? { node: root, offset: 0 };
}

export function setSelectionOffsets(root: HTMLElement, start: number, end: number): void {
  const sel = window.getSelection();
  if (!sel) return;
  const a = locate(root, start);
  const b = locate(root, end);
  const range = document.createRange();
  try {
    range.setStart(a.node, a.offset);
    range.setEnd(b.node, b.offset);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    // posições inválidas após re-render: ignora
  }
}

/** Coloca o caret no fim do conteúdo editável. */
export function caretToEnd(root: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}
