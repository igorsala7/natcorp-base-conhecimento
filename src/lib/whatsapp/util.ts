/** Rate-limit por remetente (janela deslizante em memória). Barra loops/abuso. */
const MAX = 15;
const JANELA_MS = 60_000;
const hits = new Map<string, number[]>();

export function rateLimitOk(key: string): boolean {
  const agora = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => agora - t < JANELA_MS);
  if (arr.length >= MAX) {
    hits.set(key, arr);
    return false;
  }
  arr.push(agora);
  hits.set(key, arr);
  return true;
}

/** Mascara o telefone para logs (LGPD): mantém só os 4 últimos dígitos. */
export function maskPhone(p: string): string {
  const s = String(p ?? "");
  return s.length <= 4 ? "****" : "***" + s.slice(-4);
}
