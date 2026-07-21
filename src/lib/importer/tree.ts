import type { Extraction } from "./extract";

/**
 * Heurísticas PURAS de montagem da árvore.
 *
 * Vivem fora de `structure.ts` de propósito: aquele módulo importa o provedor
 * de IA, que por sua vez arrasta `server-only` e o cliente admin do Supabase.
 * Sem a separação, testar `heuristicTree` exigia variável de ambiente e um stub
 * de `server-only` — e uma função sem efeito colateral não deve custar isso.
 */

export type ContentItem =
  | { type: "p"; text: string }
  | { type: "img"; image: number };

export type ProposedNode = {
  title: string;
  content: ContentItem[];
  children: ProposedNode[];
};

export function contarNos(nodes: ProposedNode[]): number {
  return nodes.reduce((a, n) => a + 1 + contarNos(n.children), 0);
}

export function profundidade(nodes: ProposedNode[]): number {
  return nodes.reduce(
    (max, n) => Math.max(max, n.children.length ? 1 + profundidade(n.children) : 1),
    0,
  );
}

/**
 * A passada de IA sobre a estrutura vale a pena?
 *
 * `refineStructureWithLLM` só REARRANJA seções que a heurística já achou — ela
 * não cria seção nenhuma. Daí saem dois casos, e um deles é ruim:
 *
 *  - Documento com hierarquia própria (h1–h5 do Word/HTML, tamanhos de fonte no
 *    PDF): a árvore já está certa e a IA só tem o que estragar. Medido no manual
 *    de Chamado Interno, em quatro execuções: ela remexeu de 14% a 43% das
 *    seções e TODA mudança foi para pior — tirou "Fases de análise" de dentro de
 *    "Fase do chamado", jogou "Comentários" e "Anexos" para a raiz, enfiou o
 *    capítulo de topo dentro da "Introdução".
 *  - Árvore PLANA com muitas seções (o típico PDF em que a fonte revelou os
 *    títulos mas não o aninhamento): aqui sim ela agrupa por assunto, que é
 *    exatamente o que uma heurística não sabe fazer.
 *
 * Então a IA entra no segundo caso e fica de fora do primeiro.
 */
const NIVEIS_QUE_DISPENSAM_IA = 2;
const SECOES_PARA_VALER_AGRUPAR = 8;

export function precisaAgruparComIa(nodes: ProposedNode[]): boolean {
  return profundidade(nodes) < NIVEIS_QUE_DISPENSAM_IA && contarNos(nodes) >= SECOES_PARA_VALER_AGRUPAR;
}

/**
 * Aceita o título "limpo" que a IA propôs — ou devolve o original.
 *
 * O contrato dela é LIMPAR o rótulo (capitalização, numeração "1.2 ", quebras
 * da extração), nunca reescrever. Observado com o gpt-4o: ele grudava o trecho
 * no título ("Fases de análise Surgem Muitas Vezes ao se Trabalh…"). Prompt não
 * segura isso; o código segura — limpeza só REMOVE, então toda palavra da
 * sugestão precisa já existir no original.
 */
const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

export function tituloLimpo(original: string, sugerido: string | null | undefined): string {
  const novo = sugerido?.trim();
  if (!novo) return original;
  const doOriginal = new Set(semAcento(original).split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  // Palavras curtas ficam de fora: preposições e artigos entram e saem na limpeza.
  const inventadas = semAcento(novo)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((p) => p.length >= 4 && !doOriginal.has(p));
  return inventadas.length > 0 ? original : novo;
}

/**
 * Detecta nível por numeração ("1.2.3 Faturamento", "4) Relatórios").
 *
 * Exige o separador `.`/`)` OU numeração de mais de um nível — sem isso, um
 * "1 dia" de célula de tabela virava uma pasta chamada "dia" na árvore. Também
 * limita o comprimento: título é rótulo, não parágrafo.
 */
const LIMITE_TITULO = 120;

export function numberingLevel(text: string): number | null {
  if (text.length > LIMITE_TITULO) return null;
  const m =
    text.match(/^(\d+(?:\.\d+){1,3})[.)]?\s+/) ?? // 1.2 / 1.2.3 — o ponto já separa
    text.match(/^(\d+)[.)]\s+/); //                  1. / 1) — separador obrigatório
  if (!m || !m[1]) return null;
  return Math.min(m[1].split(".").length, 3);
}

/**
 * Árvore heurística: títulos (por fonte/heading/numeração) criam nós; o corpo
 * acumula sob o título corrente. Imagens entram após o bloco correspondente.
 */
/**
 * A numeração é um PALPITE, útil só quando o documento não diz onde estão os
 * títulos. Quando ele diz (h1–h6 do HTML/DOCX, tamanho de fonte do PDF), o
 * palpite atrapalha: no manual de Chamado Interno os itens do sumário
 * ("1. Configuração", "2. Colaborador") viravam seções de primeiro nível e
 * empurravam os capítulos reais para dentro delas.
 */
const TITULOS_PARA_CONFIAR_NA_ORIGEM = 3;

export function heuristicTree(ex: Extraction): ProposedNode[] {
  const explicitos = ex.blocks.filter((b) => b.level > 0).length;
  const usarNumeracao = explicitos < TITULOS_PARA_CONFIAR_NA_ORIGEM;
  const root: ProposedNode = { title: "__root__", content: [], children: [] };
  const stack: { level: number; node: ProposedNode }[] = [
    { level: 0, node: root },
  ];

  const imgByBlock = new Map<number, number[]>();
  ex.images.forEach((img, i) => {
    const list = imgByBlock.get(img.afterBlock) ?? [];
    list.push(i);
    imgByBlock.set(img.afterBlock, list);
  });

  const top = () => stack[stack.length - 1]!;

  ex.blocks.forEach((b, i) => {
    // Item de lista é passo do procedimento; "1. Clique em Salvar" não é seção.
    const porNumeracao = usarNumeracao && !b.listItem ? numberingLevel(b.text) : null;
    const level = b.level || porNumeracao || 0;
    if (level > 0) {
      while (stack.length > 1 && top().level >= level) {
        stack.pop();
      }
      const node: ProposedNode = {
        // Só tira a numeração que a gente mesmo usou para inferir o nível —
        // senão "1 · Área de atendimento" (um h5 de verdade) virava "· Área…".
        title: (porNumeracao ? b.text.replace(/^\d+(?:\.\d+){0,3}[.)]?\s+/, "") : b.text).slice(0, 200),
        content: [],
        children: [],
      };
      top().node.children.push(node);
      stack.push({ level, node });
    } else {
      top().node.content.push({ type: "p", text: b.text });
    }
    for (const imgIdx of imgByBlock.get(i) ?? []) {
      top().node.content.push({ type: "img", image: imgIdx });
    }
  });

  // Se tudo virou corpo (nenhum título), cria um único artigo.
  if (root.children.length === 0 && root.content.length > 0) {
    return [{ title: "Documento importado", content: root.content, children: [] }];
  }
  // Corpo antes do primeiro título vira um artigo "Introdução".
  if (root.content.length > 0) {
    root.children.unshift({
      title: "Introdução",
      content: root.content,
      children: [],
    });
  }
  return root.children;
}
