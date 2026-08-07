/**
 * Agrupa os passos soltos de UMA chamada de ferramenta num item só, para a tela
 * de logs.
 *
 * Uma chamada emite hoje até quatro passos consecutivos — `tool_call`,
 * `integracoes:curl` (ou `integracoes:dedup`), `tool_result` e `tool_fim`. Lidos
 * como linhas independentes, um turno com 10 chamadas vira 40 linhas de peso
 * visual idêntico, e a pergunta real ("qual chamada deu errado?") exige ler
 * todas. Juntos, cada chamada é uma linha com veredito.
 *
 * ── Por que o casamento é pelo `id` da chamada ──────────────────────────────
 * O SDK executa as tool-calls de um mesmo passo EM PARALELO, então elas terminam
 * fora da ordem em que começaram. Casar por ordem de chegada — que foi a primeira
 * tentativa — colava o cURL, o status e o veredito de uma chamada no cartão de
 * outra: o log passava a mentir sobre qual consulta falhou, que é pior do que não
 * mostrar nada. Por isso todo passo carrega o `toolCallId` do SDK.
 *
 * A fila por ordem sobrevive só como plano B, para traces gravados antes de o
 * `id` existir. Nada é escondido por falta de par: passo órfão vira item próprio.
 *
 * Puro (sem IO, sem React): testável isolado.
 */

export type TracePasso = { ms: number; passo: string; info?: Record<string, unknown> };

export type ChamadaFerramenta = {
  /** `toolCallId` do SDK — correlaciona os passos desta chamada. */
  id?: string;
  tool: string;
  familia?: string;
  /** Momento do início da chamada (ms desde o começo do turno). */
  ms: number;
  params?: unknown;
  curl?: string;
  status?: unknown;
  /** Quantas requisições HTTP esta chamada disparou (loop mês a mês, lotes). */
  requisicoes?: number;
  valores?: string[];
  cache?: unknown;
  /** Chamada repetida, servida do resultado já obtido — não foi à rede. */
  dedup?: boolean;
  duracaoMs?: number;
  ok?: boolean;
  erro?: string;
  excecao?: boolean;
  resumo?: Record<string, unknown>;
  /** Relato do `tool_result`: dataset, total, amostra enviada ao modelo, poda. */
  relato?: Record<string, unknown>;
  /** Guard que recusou a chamada (e por quê) — antes só existia no console. */
  guard?: { nome: string; erro?: string };
  /** Campos que a poda do trace cortou (o cURL pode estar incompleto). */
  podado?: string[];
  /** Os passos crus que formaram este cartão (para quem quiser o dado bruto). */
  passos: TracePasso[];
};

export type ItemLog =
  | { tipo: "passo"; passo: TracePasso }
  | { tipo: "ferramenta"; chamada: ChamadaFerramenta };

const PASSOS_DE_TOOL = new Set([
  "tool_call", "tool_fim", "tool_result", "integracoes:curl", "integracoes:dedup", "integracoes:guard",
]);

const nomeDaTool = (p: TracePasso): string | null => {
  const t = p.info?.tool;
  return typeof t === "string" && t ? t : null;
};

/** Perdeu contexto? É o que precisa saltar aos olhos no meio de dezenas de linhas. */
export function chamadaFalhou(c: ChamadaFerramenta): boolean {
  if (c.ok === false) return true;
  if (c.erro) return true;
  if (c.guard) return true;
  const s = c.status;
  if (typeof s === "number" && s >= 400) return true;
  if (Array.isArray(s) && s.some((x) => typeof x === "number" && x >= 400)) return true;
  const r = c.relato ?? {};
  return r.sem_dados === true || r.poda_agressiva === true || r.encontrado === false;
}

export function agruparPassos(passos: TracePasso[]): ItemLog[] {
  const itens: ItemLog[] = [];
  /** Chamadas abertas indexadas pelo id do SDK — o caminho correto. */
  const porId = new Map<string, ChamadaFerramenta>();
  /** Plano B, só para traces sem id: vagas por ferramenta, na ordem de abertura. */
  const abertas = new Map<string, ChamadaFerramenta[]>();

  const abrirVaga = (tool: string, c: ChamadaFerramenta) => {
    if (c.id) porId.set(c.id, c);
    const fila = abertas.get(tool) ?? [];
    fila.push(c);
    abertas.set(tool, fila);
  };
  /**
   * Vaga da chamada: pelo id quando houver; senão a mais antiga da ferramenta que
   * ainda não recebeu este tipo de passo. SEM o antigo `?? fila[0]`: um passo sem
   * vaga livre precisa virar cartão próprio, e não sobrescrever o de outra chamada.
   */
  const vagaPara = (
    tool: string,
    id: string | undefined,
    jaTem: (c: ChamadaFerramenta) => boolean,
  ): ChamadaFerramenta | null => {
    if (id) return porId.get(id) ?? null;
    const fila = abertas.get(tool);
    if (!fila?.length) return null;
    return fila.find((c) => !c.id && !jaTem(c)) ?? null;
  };
  const fecharVaga = (tool: string, c: ChamadaFerramenta) => {
    if (c.id) porId.delete(c.id);
    const fila = abertas.get(tool);
    if (!fila) return;
    const i = fila.indexOf(c);
    if (i >= 0) fila.splice(i, 1);
    if (!fila.length) abertas.delete(tool);
  };

  for (const p of passos) {
    if (!PASSOS_DE_TOOL.has(p.passo)) {
      itens.push({ tipo: "passo", passo: p });
      continue;
    }
    const tool = nomeDaTool(p);
    if (!tool) {
      itens.push({ tipo: "passo", passo: p });
      continue;
    }
    const info = p.info ?? {};
    const id = typeof info.id === "string" && info.id ? info.id : undefined;
    const podado = Array.isArray(info._podado) ? info._podado.map(String) : undefined;

    if (p.passo === "tool_call") {
      const c: ChamadaFerramenta = {
        id,
        tool,
        familia: typeof info.familia === "string" ? info.familia : undefined,
        ms: p.ms,
        params: info.params,
        podado,
        passos: [p],
      };
      abrirVaga(tool, c);
      itens.push({ tipo: "ferramenta", chamada: c });
      continue;
    }

    // Demais passos preenchem uma vaga aberta. Sem vaga (trace antigo, ou passo
    // fora de ordem), o passo vira um cartão próprio — nunca some da tela.
    const jaTem =
      p.passo === "integracoes:curl"
        ? (c: ChamadaFerramenta) => c.curl !== undefined || c.requisicoes !== undefined
        : p.passo === "integracoes:dedup"
          ? (c: ChamadaFerramenta) => c.dedup === true
          : p.passo === "integracoes:guard"
            ? (c: ChamadaFerramenta) => c.guard !== undefined
            : p.passo === "tool_result"
              ? (c: ChamadaFerramenta) => c.relato !== undefined
              : (c: ChamadaFerramenta) => c.ok !== undefined;

    let alvo = vagaPara(tool, id, jaTem);
    if (!alvo) {
      alvo = { id, tool, ms: p.ms, passos: [] };
      abrirVaga(tool, alvo);
      itens.push({ tipo: "ferramenta", chamada: alvo });
    }
    alvo.passos.push(p);
    if (podado) alvo.podado = [...new Set([...(alvo.podado ?? []), ...podado])];

    if (p.passo === "integracoes:curl") {
      alvo.curl = typeof info.curl === "string" ? info.curl : undefined;
      alvo.status = info.status;
      alvo.cache = info.cache;
      if (typeof info.requisicoes === "number") alvo.requisicoes = info.requisicoes;
      if (Array.isArray(info.valores)) alvo.valores = info.valores.map(String);
      if (alvo.params === undefined) alvo.params = info.params;
      if (typeof info.ms === "number" && alvo.duracaoMs === undefined) alvo.duracaoMs = info.ms;
    } else if (p.passo === "integracoes:dedup") {
      alvo.dedup = true;
    } else if (p.passo === "integracoes:guard") {
      alvo.guard = {
        nome: typeof info.guard === "string" ? info.guard : "?",
        erro: typeof info.erro === "string" ? info.erro : undefined,
      };
    } else if (p.passo === "tool_result") {
      const { tool: _t, id: _i, _podado: _p, ...relato } = info;
      void _t; void _i; void _p;
      alvo.relato = relato;
    } else {
      // tool_fim
      alvo.ok = info.ok !== false;
      if (typeof info.erro === "string") alvo.erro = info.erro;
      if (info.excecao === true) alvo.excecao = true;
      if (typeof info.ms === "number") alvo.duracaoMs = info.ms;
      if (info.resumo && typeof info.resumo === "object") alvo.resumo = info.resumo as Record<string, unknown>;
      if (!alvo.familia && typeof info.familia === "string") alvo.familia = info.familia;
      fecharVaga(tool, alvo);
    }
  }

  return itens;
}

/** Verbo HTTP do comando (`curl -X POST '...'`). */
export function verboDoCurl(curl?: string): string | null {
  const m = curl?.match(/^curl -X (\w+)/);
  return m ? m[1]! : null;
}

/**
 * Caminho + query da URL do comando. O host repetido dez vezes é ruído; o que
 * distingue uma chamada da outra é o final da URL.
 */
export function alvoDoCurl(curl?: string): { curto: string; completo: string } | null {
  const m = curl?.match(/'(https?:\/\/[^']+)'/);
  if (!m) return null;
  const completo = m[1]!;
  try {
    const u = new URL(completo);
    return { curto: u.pathname + u.search, completo };
  } catch {
    return { curto: completo, completo };
  }
}

/** Todos os cURLs do turno, na ordem, para reproduzir a sequência no terminal. */
export function todosOsCurls(itens: ItemLog[]): string {
  return itens
    .flatMap((i) => (i.tipo === "ferramenta" && i.chamada.curl ? [`# ${i.chamada.tool}\n${i.chamada.curl}`] : []))
    .join("\n\n");
}
