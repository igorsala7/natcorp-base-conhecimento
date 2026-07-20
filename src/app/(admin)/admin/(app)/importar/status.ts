/** Estados de um job de importação (espelha o CHECK de `import_jobs.status`). */
export const STATUS_LABEL: Record<string, string> = {
  queued: "Na fila",
  extracting: "Extraindo",
  inferring: "Inferindo estrutura",
  preview: "Pronto para revisão",
  importing: "Importando",
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
