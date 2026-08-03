/**
 * Lógica PURA dos perfis de análise de relatório — sem `server-only`, sem IA/DB,
 * para ser testável (o motor com classificador/DB fica em `report-profile.ts`).
 */
import { toolNoRecorte, type ModuleTag } from "@/lib/integrations/module-match";
import { perfilAtende } from "@/lib/integrations/gating";

export type PerfilAnalise = {
  id: string;
  titulo: string;
  nome: string | null;
  descricao: string | null;
  cargo: string | null;
  comportamento: string | null;
  acoes: string[];
  prompt_refino: string | null;
  requires_perfil: string | null;
  priority: number;
  modulos: ModuleTag[];
};

function norm(s: unknown): string {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Hash curto determinístico (djb2) — base36, para chave de cache estável. */
export function hashCurto(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Chave estável de um relatório = título + colunas ORDENADAS (ordem não importa) +
 *  hash do vocabulário de perfis (muda ao mexer nos perfis → re-detecta). */
export function chaveRelatorio(nome: string, colunas: string[], vocabHash: string): string {
  const cols = [...colunas].map((c) => norm(c)).sort().join("|");
  return hashCurto(`${norm(nome)}::${cols}::${vocabHash}`);
}

/** Hash do vocabulário de módulos (para a chave de cache do relatório). */
export function vocabHashDe(vocabTags: ModuleTag[]): string {
  return hashCurto(vocabTags.map((t) => norm(t.modulo) + "|" + (t.submodulo ? norm(t.submodulo) : "")).sort().join(","));
}

/** Escolhe o perfil de maior prioridade que casa algum módulo detectado e o perfil de login. */
export function selecionarPerfil(
  perfis: PerfilAnalise[],
  modulos: ModuleTag[],
  perfilUsuario: string | undefined,
): PerfilAnalise | null {
  if (!modulos.length) return null;
  return (
    perfis
      .filter((p) => perfilAtende(p.requires_perfil, perfilUsuario))
      .filter((p) => toolNoRecorte(p.modulos, modulos))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0] ?? null
  );
}

const ACOES_TXT: Record<string, string> = {
  sugestoes: "sugestões",
  pontos_atencao: "pontos de atenção",
  alertas: "alertas",
  estrategias: "estratégias",
  diagnostico: "diagnóstico",
};
function listarPt(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return items.slice(0, -1).join(", ") + " e " + items[items.length - 1];
}

/** Compõe o texto da ESPECIALIZAÇÃO a partir dos campos estruturados + prompt de refino. */
export function comporPersona(p: PerfilAnalise): string {
  const partes: string[] = [];
  const nome = (p.nome || p.titulo || "").trim();
  partes.push(`Você é ${nome}${p.cargo?.trim() ? `, ${p.cargo.trim()}` : ""}.`);
  if (p.descricao?.trim()) partes.push(p.descricao.trim());
  const comp = p.comportamento?.trim();
  if (comp) partes.push(comp);
  else {
    const acoes = (p.acoes ?? []).map((a) => ACOES_TXT[a] ?? a).filter(Boolean);
    if (acoes.length) partes.push(`Ao analisar os dados do relatório enviados pelo usuário, entregue ${listarPt(acoes)}.`);
  }
  if (p.prompt_refino?.trim()) partes.push(p.prompt_refino.trim());
  return partes.join(" ").slice(0, 2000);
}
