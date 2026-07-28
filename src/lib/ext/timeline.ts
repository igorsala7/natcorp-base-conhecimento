/**
 * Linha do tempo da captura da extensão (req. 3) — parte PURA e determinística,
 * sem I/O, para que a ordem "print no meio da narração cai entre os trechos
 * certos" seja testável sem tocar em Storage. A `assemble.ts` re-hospeda os
 * prints e transforma este plano em blocos.
 */
export type TrailEvent = {
  kind: string;
  url: string | null;
  title: string | null;
  label: string | null;
  storage_path: string | null;
  created_at: string;
  /** Instante do cliente (epoch ms). Para 'transcript', é o início da gravação. */
  t_ms: number | null;
  /** Para 'transcript': `{ segments: [{text, start(seg)}] }`. */
  meta: unknown;
};

/** Um acontecimento posto no tempo (t = epoch ms). */
export type TimelineItem =
  | { t: number; kind: "nav"; url: string | null; title: string | null }
  | { t: number; kind: "shot"; storagePath: string; title: string | null }
  | { t: number; kind: "text"; text: string };

/** Plano de bloco em ordem — o print ainda como caminho no bucket privado. */
export type PlanoBloco =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "shot"; storagePath: string; title: string };

const INTRO =
  "Rascunho gerado a partir da captura da extensão. Revise a redação, complete os detalhes e publique quando estiver pronto.";

/** Segmentos temporizados guardados em `meta.segments`. */
function lerSegmentos(meta: unknown): { text: string; start: number }[] {
  if (!meta || typeof meta !== "object") return [];
  const segs = (meta as { segments?: unknown }).segments;
  if (!Array.isArray(segs)) return [];
  return segs
    .filter(
      (s): s is { text: string; start: number } =>
        !!s && typeof (s as { text?: unknown }).text === "string" && typeof (s as { start?: unknown }).start === "number",
    )
    .map((s) => ({ text: s.text.trim(), start: s.start }))
    .filter((s) => s.text);
}

/**
 * Posiciona cada evento no tempo: nav/shot em `t_ms` (ou no `created_at`); a
 * narração é quebrada nos SEGMENTOS temporizados (t = início da gravação +
 * início do segmento). Assim um print tirado no meio da fala fica ENTRE os
 * trechos certos. Ordena por tempo. `scan` é só contexto p/ a IA — não entra.
 */
export function montarItensTimeline(eventos: TrailEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const ev of eventos) {
    const base = ev.t_ms != null ? Number(ev.t_ms) : Date.parse(ev.created_at) || 0;
    if (ev.kind === "nav") {
      items.push({ t: base, kind: "nav", url: ev.url, title: ev.title });
    } else if (ev.kind === "shot" && ev.storage_path) {
      items.push({ t: base, kind: "shot", storagePath: ev.storage_path, title: ev.title });
    } else if (ev.kind === "transcript") {
      const segs = lerSegmentos(ev.meta);
      if (segs.length && ev.t_ms != null) {
        for (const s of segs) items.push({ t: Number(ev.t_ms) + Math.round(s.start * 1000), kind: "text", text: s.text });
      } else if (ev.label && ev.label.trim()) {
        items.push({ t: base, kind: "text", text: ev.label });
      }
    }
  }
  items.sort((a, b) => a.t - b.t);
  return items;
}

/**
 * Uma SEÇÃO do artigo = uma tela/passo, com a narração e os prints que caíram na
 * janela de tempo daquela tela (na ordem). É a unidade que a IA escreve por vez
 * na prévia ao vivo (req. 4a) — cada seção fica pronta e aparece na tela.
 */
export type SecaoCaptura = {
  titulo: string;
  url: string | null;
  /** Trechos de narração daquela tela, em ordem. */
  textos: string[];
  /** Prints daquela tela, em ordem. */
  prints: { storagePath: string; title: string | null }[];
};

/**
 * Agrupa a linha do tempo em seções por TELA: uma `nav` abre uma seção nova
 * (dedup de telas repetidas); a narração e os prints anteriores à 1ª tela caem
 * numa seção de abertura. Puro e determinístico — a prévia por IA escreve seção
 * a seção a partir daqui.
 */
export function agruparEmSecoes(items: TimelineItem[]): SecaoCaptura[] {
  const secoes: SecaoCaptura[] = [];
  let atual: SecaoCaptura | null = null;
  let ultimaUrl: string | null = null;
  const abrir = (titulo: string, url: string | null) => {
    atual = { titulo, url, textos: [], prints: [] };
    secoes.push(atual);
  };
  for (const it of items) {
    if (it.kind === "nav") {
      if (it.url && it.url === ultimaUrl) continue; // mesma tela — segue na seção atual
      ultimaUrl = it.url;
      abrir((it.title || it.url || "Tela").slice(0, 120), it.url);
      continue;
    }
    if (!atual) abrir("Visão geral", null); // narração/print antes da 1ª tela
    if (it.kind === "text") atual!.textos.push(it.text);
    else atual!.prints.push({ storagePath: it.storagePath, title: it.title });
  }
  return secoes;
}

/**
 * Emite os blocos na ordem do tempo. Narração consecutiva vira um parágrafo; um
 * print ou uma troca de tela quebra o parágrafo (o print entra no meio da fala).
 */
export function planejarBlocos(items: TimelineItem[]): PlanoBloco[] {
  const plano: PlanoBloco[] = [{ kind: "paragraph", text: INTRO }];
  let passo = 0;
  let ultimaUrl: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (!buf.length) return;
    const t = buf.join(" ").replace(/\s+/g, " ").trim();
    buf = [];
    if (t) plano.push({ kind: "paragraph", text: t });
  };
  for (const it of items) {
    if (it.kind === "text") {
      buf.push(it.text);
      continue;
    }
    flush();
    if (it.kind === "nav") {
      if (it.url && it.url === ultimaUrl) continue; // dedup de telas repetidas
      ultimaUrl = it.url;
      passo++;
      plano.push({ kind: "heading", text: `${passo}. ${(it.title || it.url || "Tela").slice(0, 120)}` });
      if (it.url) plano.push({ kind: "paragraph", text: it.url });
    } else if (it.kind === "shot") {
      plano.push({ kind: "shot", storagePath: it.storagePath, title: it.title || "" });
    }
  }
  flush();
  // Sem navegação (só prints)? Ainda entrega um rascunho útil.
  if (passo === 0 && items.some((i) => i.kind === "shot")) plano.splice(1, 0, { kind: "heading", text: "Capturas" });
  return plano;
}
