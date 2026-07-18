export type DiffOp = { type: "eq" | "del" | "ins"; text: string };

/**
 * Diff por palavra entre dois textos (LCS clássico). Preserva a pontuação e
 * as quebras de linha como tokens próprios, para o destaque ficar legível.
 * Suficiente para artigos; O(n·m) no nº de tokens.
 */
export function wordDiff(a: string, b: string): DiffOp[] {
  const A = tokenize(a);
  const B = tokenize(b);
  const n = A.length;
  const m = B.length;

  // Tabela de LCS.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = A[i] === B[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  const push = (type: DiffOp["type"], text: string) => {
    const last = ops[ops.length - 1];
    if (last && last.type === type) last.text += text;
    else ops.push({ type, text });
  };
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      push("eq", A[i]!);
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      push("del", A[i]!);
      i++;
    } else {
      push("ins", B[j]!);
      j++;
    }
  }
  while (i < n) push("del", A[i++]!);
  while (j < m) push("ins", B[j++]!);
  return ops;
}

/** Quebra em palavras, espaços e quebras de linha (cada um vira um token). */
function tokenize(s: string): string[] {
  return s.match(/\n|\s+|[^\s]+/g) ?? [];
}
