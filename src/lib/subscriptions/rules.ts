/**
 * Regra de horário dos digests — pura, sem imports de servidor (testável).
 * instant = todo tick; daily = 12h UTC com 20h de intervalo; weekly = segunda
 * 12h UTC com 6 dias de intervalo.
 */
export const HORA_ENVIO_UTC = 12;

export function frequenciaDue(freq: string, agora: Date, lastRun: string | null): boolean {
  if (freq === "instant") return true;
  const idadeHoras = lastRun
    ? (agora.getTime() - new Date(lastRun).getTime()) / 3_600_000
    : Infinity;
  if (freq === "daily") return agora.getUTCHours() === HORA_ENVIO_UTC && idadeHoras >= 20;
  if (freq === "weekly")
    return agora.getUTCDay() === 1 && agora.getUTCHours() === HORA_ENVIO_UTC && idadeHoras >= 24 * 6;
  return false;
}
