/** Estados de um job de importação (espelha o CHECK de `import_jobs.status`). */
export const STATUS_LABEL: Record<string, string> = {
  queued: "Na fila",
  extracting: "Extraindo",
  inferring: "Inferindo estrutura",
  preview: "Pronto para revisão",
  importing: "Importando",
  improving: "Melhorando layout com IA",
  done: "Concluído",
  error: "Erro",
};

/** Tom do badge por estado — o rótulo por extenso continua carregando o sentido. */
export const STATUS_TONE: Record<string, "neutral" | "info" | "primary" | "danger"> = {
  queued: "neutral",
  extracting: "info",
  inferring: "info",
  preview: "primary",
  importing: "info",
  improving: "info",
  done: "neutral",
  error: "danger",
};

/** Uma linha do relatório que o worker grava em `import_jobs.log`. */
export type ImportLogLine = { at: string; msg: string };

/** Job parado: não adianta continuar acompanhando. */
export function isTerminal(status: string): boolean {
  return status === "preview" || status === "done" || status === "error";
}

/** Normaliza o jsonb `log` (pode vir null/qualquer coisa). */
export function parseLog(raw: unknown): ImportLogLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((l) => {
    if (!l || typeof l !== "object") return [];
    const { at, msg } = l as { at?: unknown; msg?: unknown };
    return typeof msg === "string" ? [{ at: typeof at === "string" ? at : "", msg }] : [];
  });
}

/**
 * Os estados viram PASSOS visíveis.
 *
 * A lista existia desde sempre e nunca chegou à tela: a UI mostrava um badge
 * com o estado atual, e quem esperava não sabia quantas etapas faltavam. Três
 * minutos em "Inferindo estrutura" é indistinguível de travado.
 *
 * `done` e `error` ficam de fora dos passos: um é o fim de todos eles, o outro
 * não é uma etapa — marca ONDE o trabalho parou, e é isso que o Stepper mostra.
 * "Melhorando layout" é opcional (só existe se a pessoa pediu), mas aparece
 * apagado desde o começo para não surgir do nada no meio da espera.
 */
export const PASSOS_IMPORT = [
  { key: "queued", rotulo: "Na fila" },
  { key: "extracting", rotulo: "Extraindo" },
  { key: "inferring", rotulo: "Estruturando" },
  { key: "preview", rotulo: "Revisão" },
  { key: "importing", rotulo: "Importando" },
  { key: "improving", rotulo: "Melhorando layout", opcional: true },
] as const;

/**
 * Em que passo o job está — e, se falhou, onde parou.
 *
 * `error` não diz sozinho ONDE quebrou; o worker registra a última etapa no log
 * antes de falhar. Sem essa informação, o Stepper marcaria o primeiro passo
 * como culpado e mandaria olhar o arquivo quando o problema era o destino.
 */
export function passoDoJob(status: string, log: ImportLogLine[]): { atual: string; falhou: boolean } {
  if (status === "done") return { atual: "improving", falhou: false };
  if (status !== "error") return { atual: status, falhou: false };

  // De trás para frente: a última etapa mencionada é onde o trabalho estava.
  const chaves = PASSOS_IMPORT.map((p) => p.key);
  for (let i = log.length - 1; i >= 0; i--) {
    const achou = chaves.find((k) => log[i]!.msg.toLowerCase().includes(STATUS_LABEL[k]!.toLowerCase()));
    if (achou) return { atual: achou, falhou: true };
  }
  return { atual: "extracting", falhou: true };
}
