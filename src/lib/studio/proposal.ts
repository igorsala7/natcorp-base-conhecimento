/**
 * Proposta do Estúdio IA — árvore de pastas/artigos que a conversa constrói —
 * e a aplicação das OPERAÇÕES ESTRUTURAIS que a IA emite por turno.
 *
 * PURA (testável; sem imports de servidor). Regras da revisão adversarial:
 * aplicar em ordem; tmpId duplicado rejeita; pai desconhecido anexa na raiz
 * com aviso; remover é em cascata; mover tem guarda de ciclo; `gerarCorpo` é
 * validado DEPOIS das ops; teto de artigos na proposta.
 */
import type { BlockDoc } from "@/lib/blocks/schema";

export type ProposalNode = {
  tmpId: string;
  tipo: "folder" | "article";
  titulo: string;
  doc: BlockDoc | null;
  children: ProposalNode[];
};

export type StudioOp = {
  op: "criar_no" | "renomear" | "remover" | "mover";
  tmpId: string;
  paiTmpId: string | null;
  /** Irmão APÓS o qual inserir; null = fim da lista do pai. */
  aposTmpId: string | null;
  tipo: "folder" | "article" | null;
  titulo: string | null;
};

export const MAX_ARTIGOS_PROPOSTA = 30;

export function contarArtigos(nodes: ProposalNode[]): number {
  return nodes.reduce(
    (n, x) => n + (x.tipo === "article" ? 1 : 0) + contarArtigos(x.children),
    0,
  );
}

export function acharNo(nodes: ProposalNode[], tmpId: string): ProposalNode | null {
  for (const n of nodes) {
    if (n.tmpId === tmpId) return n;
    const f = acharNo(n.children, tmpId);
    if (f) return f;
  }
  return null;
}

function removerNo(nodes: ProposalNode[], tmpId: string): ProposalNode[] {
  return nodes
    .filter((n) => n.tmpId !== tmpId)
    .map((n) => ({ ...n, children: removerNo(n.children, tmpId) }));
}

function inserirEm(
  lista: ProposalNode[],
  novo: ProposalNode,
  aposTmpId: string | null,
): ProposalNode[] {
  if (!aposTmpId) return [...lista, novo];
  const i = lista.findIndex((n) => n.tmpId === aposTmpId);
  if (i < 0) return [...lista, novo];
  return [...lista.slice(0, i + 1), novo, ...lista.slice(i + 1)];
}

function inserirSob(
  nodes: ProposalNode[],
  paiTmpId: string | null,
  novo: ProposalNode,
  aposTmpId: string | null,
): { nodes: ProposalNode[]; ok: boolean } {
  if (paiTmpId === null) return { nodes: inserirEm(nodes, novo, aposTmpId), ok: true };
  let ok = false;
  const anda = (lista: ProposalNode[]): ProposalNode[] =>
    lista.map((n) => {
      if (n.tmpId === paiTmpId) {
        ok = true;
        return { ...n, children: inserirEm(n.children, novo, aposTmpId) };
      }
      return { ...n, children: anda(n.children) };
    });
  const out = anda(nodes);
  return { nodes: out, ok };
}

export type AplicarResultado = {
  proposal: ProposalNode[];
  avisos: string[];
  /** tmpIds de `gerarCorpo` que sobreviveram à validação (existem e são artigos). */
  gerarCorpo: string[];
};

export function aplicarOperacoes(
  proposal: ProposalNode[],
  ops: StudioOp[],
  gerarCorpoPedidos: string[],
): AplicarResultado {
  let atual = proposal;
  const avisos: string[] = [];

  for (const op of ops) {
    if (op.op === "criar_no") {
      if (!op.tipo || !op.titulo?.trim()) {
        avisos.push(`criar_no sem tipo/título ignorado (${op.tmpId}).`);
        continue;
      }
      if (acharNo(atual, op.tmpId)) {
        avisos.push(`tmpId duplicado "${op.tmpId}" — operação rejeitada.`);
        continue;
      }
      if (op.tipo === "article" && contarArtigos(atual) >= MAX_ARTIGOS_PROPOSTA) {
        avisos.push(`Limite de ${MAX_ARTIGOS_PROPOSTA} artigos por proposta atingido.`);
        continue;
      }
      const novo: ProposalNode = {
        tmpId: op.tmpId,
        tipo: op.tipo,
        titulo: op.titulo.trim(),
        doc: null,
        children: [],
      };
      const paiExiste = op.paiTmpId === null || !!acharNo(atual, op.paiTmpId);
      if (!paiExiste) avisos.push(`Pasta-pai "${op.paiTmpId}" não existe — "${novo.titulo}" foi para a raiz.`);
      atual = inserirSob(atual, paiExiste ? op.paiTmpId : null, novo, op.aposTmpId).nodes;
      continue;
    }

    const alvo = acharNo(atual, op.tmpId);
    if (!alvo) {
      avisos.push(`Operação ${op.op} em nó inexistente "${op.tmpId}" ignorada.`);
      continue;
    }

    if (op.op === "renomear") {
      if (!op.titulo?.trim()) continue;
      const titulo = op.titulo.trim();
      const renomeia = (lista: ProposalNode[]): ProposalNode[] =>
        lista.map((n) =>
          n.tmpId === op.tmpId ? { ...n, titulo } : { ...n, children: renomeia(n.children) },
        );
      atual = renomeia(atual);
      continue;
    }

    if (op.op === "remover") {
      atual = removerNo(atual, op.tmpId);
      continue;
    }

    // mover: guarda de ciclo (novo pai não pode estar na subárvore do movido).
    if (op.paiTmpId && (op.paiTmpId === op.tmpId || acharNo([alvo], op.paiTmpId))) {
      avisos.push(`Mover "${alvo.titulo}" para dentro de si mesmo — ignorado.`);
      continue;
    }
    const sem = removerNo(atual, op.tmpId);
    const paiExiste = op.paiTmpId === null || !!acharNo(sem, op.paiTmpId);
    if (!paiExiste) {
      avisos.push(`Pasta-pai "${op.paiTmpId}" não existe — "${alvo.titulo}" foi para a raiz.`);
    }
    atual = inserirSob(sem, paiExiste ? op.paiTmpId : null, alvo, op.aposTmpId).nodes;
  }

  // gerarCorpo só vale para artigos que EXISTEM após as operações.
  const gerarCorpo = [...new Set(gerarCorpoPedidos)].filter((id) => {
    const n = acharNo(atual, id);
    if (!n) return false;
    return n.tipo === "article";
  });

  return { proposal: atual, avisos, gerarCorpo };
}

/** Resumo textual da proposta para o prompt (árvore com tamanhos de corpo). */
export function resumoDaProposta(nodes: ProposalNode[], nivel = 0): string {
  return nodes
    .map((n) => {
      const corpo =
        n.tipo === "article"
          ? n.doc?.blocks.length
            ? ` [corpo: ${n.doc.blocks.length} blocos]`
            : " [sem corpo]"
          : "";
      const linha = `${"  ".repeat(nivel)}- (${n.tmpId}) ${n.tipo === "folder" ? "📁" : "📄"} ${n.titulo}${corpo}`;
      const filhos = resumoDaProposta(n.children, nivel + 1);
      return filhos ? `${linha}\n${filhos}` : linha;
    })
    .join("\n");
}

/** Patch granular do cliente (um escritor só: o servidor mescla). */
export type ProposalPatch =
  | { kind: "titulo"; tmpId: string; titulo: string }
  | { kind: "doc"; tmpId: string; doc: BlockDoc }
  | { kind: "remover"; tmpId: string }
  | { kind: "mover"; tmpId: string; paiTmpId: string | null; aposTmpId: string | null };

export function aplicarPatch(proposal: ProposalNode[], patch: ProposalPatch): ProposalNode[] {
  if (patch.kind === "remover") return removerNo(proposal, patch.tmpId);
  if (patch.kind === "mover") {
    const r = aplicarOperacoes(
      proposal,
      [{ op: "mover", tmpId: patch.tmpId, paiTmpId: patch.paiTmpId, aposTmpId: patch.aposTmpId, tipo: null, titulo: null }],
      [],
    );
    return r.proposal;
  }
  const anda = (lista: ProposalNode[]): ProposalNode[] =>
    lista.map((n) => {
      if (n.tmpId === patch.tmpId) {
        return patch.kind === "titulo" ? { ...n, titulo: patch.titulo } : { ...n, doc: patch.doc };
      }
      return { ...n, children: anda(n.children) };
    });
  return anda(proposal);
}
