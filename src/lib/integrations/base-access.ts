/**
 * Regras da tela "Acesso por base" — quais ferramentas cada cliente enxerga.
 *
 * PURO e sem I/O, fora do componente, para ser testável: é aqui que mora a
 * decisão de o que gravar, e gravar demais numa base em produção derruba o
 * chatbot de um cliente.
 */

/** O mínimo que estas funções precisam saber de um vínculo base↔tool. */
export type VinculoBaseTool = { base_id: string; tool_id: string; enabled: boolean };
/** O mínimo que precisam saber de uma ferramenta. */
export type ToolBusca = { id: string; name: string; key: string; description?: string | null };

const norm = (s: string) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Conjunto de tools habilitadas numa base.
 *
 * LINHA AUSENTE = INDISPONÍVEL, e não "liberado por omissão": é assim que o
 * runtime lê (`resolve.ts` filtra por `enabled = true`). Inverter esta leitura
 * aqui faria a tela mostrar como bloqueado o que o chat responde — ou o
 * contrário, que é pior.
 */
export function habilitadasDaBase(vinculos: VinculoBaseTool[], baseId: string): Set<string> {
  const out = new Set<string>();
  for (const v of vinculos) if (v.base_id === baseId && v.enabled) out.add(v.tool_id);
  return out;
}

/**
 * O que mudou em relação ao gravado. Só o diff vai ao servidor: mandar a lista
 * inteira reescreveria linhas intocadas, apagando de quem foi a última mexida
 * no log de auditoria e regerando embeddings à toa.
 */
export function diffAcesso(
  original: Set<string>,
  atual: Set<string>,
): { ligar: string[]; desligar: string[] } {
  const ligar: string[] = [];
  const desligar: string[] = [];
  for (const id of atual) if (!original.has(id)) ligar.push(id);
  for (const id of original) if (!atual.has(id)) desligar.push(id);
  return { ligar, desligar };
}

/**
 * Filtra por PEDAÇOS em qualquer ordem, ignorando acento — mesma regra do
 * seletor com busca. Quem procura não lembra o nome exato da ferramenta;
 * lembra "ponto" e "apuração".
 *
 * A busca é o que substitui o agrupamento por módulo nesta tela: ela reduz 118
 * linhas a um punhado, e a ação em lote age sobre o resultado.
 */
export function filtrarTools<T extends ToolBusca>(tools: T[], busca: string): T[] {
  const q = norm(busca).trim();
  if (!q) return tools;
  const partes = q.split(/\s+/).filter(Boolean);
  return tools.filter((t) => {
    const alvo = norm(`${t.name} ${t.key} ${t.description ?? ""}`);
    return partes.every((p) => alvo.includes(p));
  });
}

/** Ordem alfabética por nome, com as regras do português (acento não separa). */
export function ordenarPorNome<T extends { name: string }>(tools: T[]): T[] {
  return tools.slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/**
 * Aplica o mesmo valor a um intervalo da lista visível (shift+clique).
 *
 * Trabalha sobre a lista VISÍVEL, não sobre o catálogo: com a busca ativa,
 * marcar "da linha 2 à 5" tem que pegar as 4 que a pessoa está vendo, não 4
 * quaisquer do meio das 118.
 */
export function aplicarIntervalo(
  visiveis: { id: string }[],
  selecao: Set<string>,
  ancoraId: string,
  alvoId: string,
  valor: boolean,
): Set<string> {
  const i = visiveis.findIndex((t) => t.id === ancoraId);
  const j = visiveis.findIndex((t) => t.id === alvoId);
  const n = new Set(selecao);
  // Âncora fora da lista (a busca mudou desde o último clique): trata como
  // clique simples em vez de adivinhar um intervalo que a pessoa não vê.
  if (i < 0 || j < 0) {
    if (valor) n.add(alvoId);
    else n.delete(alvoId);
    return n;
  }
  const [ini, fim] = i < j ? [i, j] : [j, i];
  for (let k = ini; k <= fim; k++) {
    const id = visiveis[k]!.id;
    if (valor) n.add(id);
    else n.delete(id);
  }
  return n;
}
