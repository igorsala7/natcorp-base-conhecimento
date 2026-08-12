/**
 * ESCOPO DE DADOS POR PAINEL (PO=Operador, PG=Gestor, PC=Colaborador,
 * PCAND=Candidato).
 *
 * Cada ferramenta pode declarar, por painel, o alcance da consulta:
 *   "todos"    → sem recorte extra (o sistema aplica o acesso já parametrizado)
 *   "equipe"   → só a equipe do gestor (a matrícula-alvo é validada na equipe)
 *   "proprios" → FORÇA a matrícula/empresa do próprio usuário (a IA não escolhe)
 *   "nenhum"   → a tool nem aparece para aquele painel (bloqueada)
 *
 * A parte "proprios/equipe" reescreve os PARÂMETROS (empresa/matrícula viram
 * identidade), o que é aplicado ANTES de montar o schema do modelo — a IA nem
 * enxerga esses campos, então não há como pedir outra pessoa. A parte "equipe"
 * e o "nunca os próprios" (exclude_self) são validados no guard, por chamada.
 *
 * Puro/sem I/O de propósito — testável isolado.
 */
import type { LoopConfig, ToolParam } from "./tools";

export type EscopoPainel = "todos" | "equipe" | "proprios" | "nenhum";
export type Painel = "PO" | "PG" | "PC" | "PCAND";
export type PanelScopeMap = Partial<Record<Painel, EscopoPainel>>;

const PAINEIS = ["PO", "PG", "PC", "PCAND"] as const;
const ESCOPOS: readonly EscopoPainel[] = ["todos", "equipe", "proprios", "nenhum"];

/** Sanitiza o JSON gravado em `ai_tools.panel_scope`. Retorna null se vazio/ inválido. */
export function normalizarPanelScope(v: unknown): PanelScopeMap | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const out: PanelScopeMap = {};
  for (const p of PAINEIS) {
    const s = String(o[p] ?? "").trim().toLowerCase();
    if ((ESCOPOS as string[]).includes(s)) out[p] = s as EscopoPainel;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Escopo efetivo para o painel do usuário.
 *
 * Colaborador/gestor/operador: sem configuração → "todos" (retrocompatível —
 * tools antigas seguem sem recorte extra); painel desconhecido é tratado como
 * Colaborador, o mais restritivo dos três.
 *
 * CANDIDATO é o contrário: silêncio significa NÃO. O painel do candidato manda
 * o mesmo `p_portal` do colaborador (decisão do produto, 12/08/2026 — o token
 * só ganhou `p_cod_candidato`), então quem separa os dois é `tipoDeAcesso`. Sem
 * essa inversão, o catálogo inteiro de RH — cadastrado quando candidato não
 * existia — passaria a valer para alguém de fora da empresa por omissão. Cada
 * ferramenta liberada ao candidato é uma decisão explícita no cadastro (PCAND).
 */
export function escopoDoPainel(
  ps: PanelScopeMap | null | undefined,
  portal: string | undefined,
  candidato = false,
): EscopoPainel {
  if (candidato) return ps?.PCAND ?? "nenhum";
  if (!ps) return "todos";
  let p = String(portal ?? "").trim().toUpperCase();
  if (p !== "PO" && p !== "PG" && p !== "PC") p = "PC";
  return ps[p as "PO" | "PG" | "PC"] ?? "todos";
}

const semUser = (nome: string) => !/_user\b|_user$|usuario/i.test(nome);

/** Parâmetro que MIRA a matrícula de uma pessoa (não a do usuário logado). */
export function ehParamMatricula(p: ToolParam): boolean {
  if (p.campoIdentidade === "matricula") return true;
  const n = String(p.nome ?? "");
  return /matric/i.test(n) && semUser(n);
}

/** Parâmetro que MIRA o código de empresa (filtro), não o do usuário logado. */
export function ehParamEmpresa(p: ToolParam): boolean {
  if (p.campoIdentidade === "cod_empresa") return true;
  const n = String(p.nome ?? "").toLowerCase();
  return (n === "empresa" || n === "emp" || n === "cod_empresa" || n === "codempresa" || /(^|_)empresa/.test(n)) && semUser(n);
}

/** Parâmetro que MIRA o código de CANDIDATO (recrutamento), não o do usuário logado. */
export function ehParamCandidato(p: ToolParam): boolean {
  if (p.campoIdentidade === "cod_candidato") return true;
  const n = String(p.nome ?? "").toLowerCase();
  return /(^|_)(cod_?)?candidat/.test(n) && semUser(n);
}

/**
 * Reescreve os parâmetros SÓ em "proprios": empresa, matrícula E cod_candidato passam
 * a vir da IDENTIDADE (o próprio usuário/candidato logado), então a IA nem enxerga
 * esses campos — é isso que fixa o "só o próprio dado" (ex.: um candidato só vê o
 * SEU cod_candidato; o recrutador em PO/PG segue com origem=modelo, vendo qualquer um).
 * Em "equipe" os parâmetros ficam intactos — a matrícula-alvo vem do modelo e é
 * validada na equipe pelo guard (forçar a empresa quebraria gestor multi-empresa,
 * espelhando o antigo escopo_pessoa). "todos"/"nenhum" não mexem.
 */
export function aplicarEscopoParams(params: ToolParam[], scope: EscopoPainel): ToolParam[] {
  if (scope !== "proprios") return params;
  return params.map((p) => {
    if (ehParamEmpresa(p) && p.origem !== "identidade")
      return { ...p, origem: "identidade" as const, campoIdentidade: "cod_empresa" as const };
    if (ehParamMatricula(p) && p.origem !== "identidade")
      return { ...p, origem: "identidade" as const, campoIdentidade: "matricula" as const };
    if (ehParamCandidato(p) && p.origem !== "identidade")
      return { ...p, origem: "identidade" as const, campoIdentidade: "cod_candidato" as const };
    return p;
  });
}

/**
 * O loop sobre matrícula/empresa deixa de fazer sentido em "proprios" (a consulta
 * é sempre do próprio usuário, um só valor) — desliga o loop nesse caso para não
 * pedir uma lista que a IA não deveria fornecer.
 */
export function loopSobEscopo(loop: LoopConfig | null | undefined, params: ToolParam[], scope: EscopoPainel): LoopConfig | null {
  const l = loop ?? null;
  if (!l || scope !== "proprios") return l;
  const alvo = params.find((p) => p.nome === l.param);
  if (alvo && (ehParamMatricula(alvo) || ehParamEmpresa(alvo) || ehParamCandidato(alvo))) return null;
  return l;
}

/**
 * Remove dos RESULTADOS as linhas do PRÓPRIO usuário (exclude_self) — ex.: numa
 * requisição de desligamento, ninguém pode ver a linha em que é o "matrícula
 * solicitada". Filtra arrays de objetos por qualquer campo de matrícula.
 */
export function filtrarProprioDosResultados(dados: unknown, own: string): unknown {
  const o = String(own ?? "").trim();
  if (!o) return dados;
  const ehPropria = (row: unknown): boolean => {
    if (!row || typeof row !== "object") return false;
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      if (/matric/i.test(k) && String(v ?? "").trim() === o) return true;
    }
    return false;
  };
  const filtrar = (arr: unknown[]) => arr.filter((r) => !ehPropria(r));
  if (Array.isArray(dados)) return filtrar(dados);
  if (dados && typeof dados === "object") {
    const obj = { ...(dados as Record<string, unknown>) };
    for (const k of ["items", "dados", "registros", "rows", "data", "result", "lista"]) {
      if (Array.isArray(obj[k])) obj[k] = filtrar(obj[k] as unknown[]);
    }
    return obj;
  }
  return dados;
}
