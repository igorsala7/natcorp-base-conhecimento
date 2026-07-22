/** Utilitários do bloco de arquivo — puros, usados pelo portal E pelo editor. */

/** "1.5 MB", "820 KB", "12 B". 0/negativo = "" (tamanho desconhecido some). */
export function formatarBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

/** Extensão do nome ("Relatorio.PDF" → "PDF"); sem extensão → "ARQ". */
export function extensaoDoNome(name: string): string {
  const m = /\.([a-z0-9]{1,8})$/i.exec(name.trim());
  return (m?.[1] ?? "ARQ").toUpperCase();
}
