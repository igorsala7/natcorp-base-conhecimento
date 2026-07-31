import type { OutFile } from "@/lib/integrations/documents";

/**
 * Convite de agenda no padrão iCalendar (.ics) — o usuário baixa e adiciona ao
 * Google Agenda / Outlook / Apple Calendar. `normalizeInvite` é PURO (só
 * `Date.UTC` para aritmética de horário, sem `now`/`random`) → testável; o
 * `buildIcs` (UID + DTSTAMP com relógio) monta o arquivo.
 *
 * Horários são "flutuantes" (sem Z nem TZID): o calendário os interpreta na
 * hora local do usuário — o que, para o público (horário de Brasília), é o certo
 * e evita cálculo de fuso frágil.
 */

export type InviteSpec = {
  titulo: string;
  /** ICS: `AAAAMMDD` (dia inteiro) ou `AAAAMMDDTHHMMSS` (com hora). */
  inicio: string;
  fim: string;
  diaInteiro: boolean;
  local?: string;
  descricao?: string;
  organizador?: string;
  organizadorNome?: string;
  participantes: string[];
  lembreteMin?: number;
  /** Rótulo humano para a confirmação (ex.: "12/08/2026 às 14:30"). */
  inicioLabel: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const ehEmail = (s: string) => /.+@.+\..+/.test(s);

type Parsed = { y: number; m: number; d: number; hh: number; mi: number; temHora: boolean };

/** Aceita `AAAA-MM-DD[ T]HH:MM`, `DD/MM/AAAA[ ]HH:MM` e só-data das duas formas. */
function parseDT(s: string): Parsed | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ]\s*(\d{1,2}):(\d{2}))?/);
  if (m) return { y: +m[1]!, m: +m[2]!, d: +m[3]!, hh: m[4] ? +m[4] : 0, mi: m[5] ? +m[5] : 0, temHora: !!m[4] };
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[T ]?\s*(\d{1,2}):(\d{2}))?/);
  if (m) return { y: +m[3]!, m: +m[2]!, d: +m[1]!, hh: m[4] ? +m[4] : 0, mi: m[5] ? +m[5] : 0, temHora: !!m[4] };
  return null;
}

const valido = (p: Parsed) =>
  p.m >= 1 && p.m <= 12 && p.d >= 1 && p.d <= 31 && p.hh >= 0 && p.hh <= 23 && p.mi >= 0 && p.mi <= 59;

const fmtHora = (ms: number) => {
  const dt = new Date(ms);
  return (
    `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}` +
    `T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00`
  );
};
const fmtDia = (ms: number) => {
  const dt = new Date(ms);
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
};

/** Saneia a intenção do modelo. `null` quando falta o essencial (título + início válido). */
export function normalizeInvite(raw: unknown): InviteSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const titulo = String(o.titulo ?? "").trim().slice(0, 200);
  const p = parseDT(String(o.inicio ?? ""));
  if (!titulo || !p || !valido(p)) return null;

  const opcionais = {
    local: o.local ? String(o.local).slice(0, 300) : undefined,
    descricao: o.descricao ? String(o.descricao).slice(0, 2000) : undefined,
    organizador: o.organizador_email && ehEmail(String(o.organizador_email)) ? String(o.organizador_email).trim() : undefined,
    organizadorNome: o.organizador_nome ? String(o.organizador_nome).slice(0, 120) : undefined,
    participantes: Array.isArray(o.participantes)
      ? o.participantes.map((x) => String(x).trim()).filter(ehEmail).slice(0, 50)
      : [],
  };
  const lembrete = Number(o.lembrete_min);
  const lembreteMin = Number.isFinite(lembrete) && lembrete > 0 ? Math.min(Math.round(lembrete), 40320) : undefined;

  const diaInteiro = o.dia_inteiro === true || !p.temHora;
  if (diaInteiro) {
    const startMs = Date.UTC(p.y, p.m - 1, p.d);
    return {
      titulo,
      inicio: fmtDia(startMs),
      fim: fmtDia(startMs + 86400000), // DTEND de dia inteiro é EXCLUSIVO → dia seguinte
      diaInteiro: true,
      ...opcionais,
      lembreteMin,
      inicioLabel: `${pad(p.d)}/${pad(p.m)}/${p.y}`,
    };
  }

  const startMs = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mi);
  const pf = o.fim ? parseDT(String(o.fim)) : null;
  let endMs: number;
  if (pf && pf.temHora && valido(pf)) endMs = Date.UTC(pf.y, pf.m - 1, pf.d, pf.hh, pf.mi);
  else {
    const dur = Number(o.duracao_min);
    endMs = startMs + (Number.isFinite(dur) && dur > 0 ? dur : 60) * 60000;
  }
  if (endMs <= startMs) endMs = startMs + 60 * 60000;

  return {
    titulo,
    inicio: fmtHora(startMs),
    fim: fmtHora(endMs),
    diaInteiro: false,
    ...opcionais,
    lembreteMin,
    inicioLabel: `${pad(p.d)}/${pad(p.m)}/${p.y} às ${pad(p.hh)}:${pad(p.mi)}`,
  };
}

/** Escapa texto de campo (RFC 5545). */
function esc(v: string): string {
  return String(v).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
/** Dobra linhas com mais de 74 octetos (continuação com espaço). */
function fold(line: string): string {
  if (line.length <= 74) return line;
  let out = line.slice(0, 74);
  let rest = line.slice(74);
  while (rest.length > 73) {
    out += "\r\n " + rest.slice(0, 73);
    rest = rest.slice(73);
  }
  return out + "\r\n " + rest;
}
function nomeArquivo(titulo: string): string {
  const base = titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60)
    .toLowerCase();
  return (base || "convite") + ".ics";
}

/** Monta o arquivo .ics (adiciona UID + DTSTAMP com relógio) como OutFile. */
export function buildIcs(spec: InviteSpec): OutFile {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Base de Conhecimento//Convite//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
  ];
  const now = new Date();
  const dtstamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  lines.push(`UID:${crypto.randomUUID()}@base-conhecimento`);
  lines.push(`DTSTAMP:${dtstamp}`);
  if (spec.diaInteiro) {
    lines.push(`DTSTART;VALUE=DATE:${spec.inicio}`);
    lines.push(`DTEND;VALUE=DATE:${spec.fim}`);
  } else {
    lines.push(`DTSTART:${spec.inicio}`);
    lines.push(`DTEND:${spec.fim}`);
  }
  lines.push(fold(`SUMMARY:${esc(spec.titulo)}`));
  if (spec.descricao) lines.push(fold(`DESCRIPTION:${esc(spec.descricao)}`));
  if (spec.local) lines.push(fold(`LOCATION:${esc(spec.local)}`));
  if (spec.organizador) lines.push(fold(`ORGANIZER${spec.organizadorNome ? `;CN=${esc(spec.organizadorNome)}` : ""}:mailto:${spec.organizador}`));
  for (const p of spec.participantes) lines.push(fold(`ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${p}`));
  if (spec.lembreteMin != null) {
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", fold(`DESCRIPTION:${esc(spec.titulo)}`), `TRIGGER:-PT${spec.lembreteMin}M`, "END:VALARM");
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  const ics = lines.join("\r\n") + "\r\n";
  return { filename: nomeArquivo(spec.titulo), mimeType: "text/calendar", base64: Buffer.from(ics, "utf8").toString("base64") };
}
