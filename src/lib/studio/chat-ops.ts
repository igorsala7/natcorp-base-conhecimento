/**
 * Aplicação das operações do CHAT DO EDITOR sobre o documento de blocos.
 *
 * PURA (client-safe). Regras da revisão adversarial:
 * - blockId só resolve no TOPO-NÍVEL (a IA só enxerga o topo no resumo);
 *   id inexistente/não-topo → op ignorada e reportada (nunca no-op mudo);
 * - `substituir` REAPROVEITA o id antigo no 1º bloco novo — âncora estável
 *   para ops seguintes na mesma resposta;
 * - o doc nunca fica vazio;
 * - blocos que a IA não sabe emitir (imagem/vídeo/arquivo/embed) sobrevivem
 *   intactos porque as ops são pontuais, nunca o doc inteiro.
 */
import { newId, type Block } from "@/lib/blocks/schema";
import { blockToBlock } from "@/lib/importer/blocks-to-doc";
import { richToText } from "@/lib/blocks/serialize";
import type { EditorChatOp } from "@/lib/ai/editor-chat-schema";

export type ChatOpsResultado = {
  blocks: Block[];
  aplicadas: number;
  ignoradas: string[];
};

function paraBlocos(op: EditorChatOp): Block[] {
  return (op.blocks ?? []).map((b) =>
    // Mermaid é vocabulário SÓ do chat — converte aqui, sem ampliar o
    // conversor compartilhado com o improve.
    b.kind === "mermaid"
      ? { id: newId(), type: "mermaid" as const, data: { code: b.code } }
      : blockToBlock(b),
  );
}

/** Espelho IA do painel de Propriedades: op estilizar → BlockStyles. */
const LARGURA = {
  cheia: "full",
  metade: "half",
  terco: "third",
  "dois-tercos": "twoThirds",
  "tres-quartos": "threeQuarters",
} as const;
const POSICAO = { esquerda: "left", centro: "center", direita: "right" } as const;
const MARGEM = { pequena: 2, media: 4, grande: 6 } as const;

type Estilo = NonNullable<EditorChatOp["estilo"]>;

export function mesclarEstilo(
  atual: Block["styles"],
  estilo: Estilo,
): { styles: Block["styles"]; avisos: string[] } {
  const s: Record<string, unknown> = { ...(atual ?? {}) };
  const avisos: string[] = [];
  // null = não mexe; sentinela ("nenhum"/"auto"/"normal") = apaga a chave.
  if (estilo.bg) {
    if (estilo.bg === "nenhum") delete s.bgColor;
    else s.bgColor = estilo.bg;
  }
  if (estilo.largura) {
    if (estilo.largura === "auto") delete s.width;
    else s.width = LARGURA[estilo.largura];
  }
  if (estilo.posicao) {
    if (estilo.posicao === "nenhuma") delete s.justify;
    else s.justify = POSICAO[estilo.posicao];
  }
  if (estilo.alinhamento) {
    if (estilo.alinhamento === "nenhum") delete s.align;
    else s.align = POSICAO[estilo.alinhamento];
  }
  if (estilo.margemVertical) {
    if (estilo.margemVertical === "nenhuma") delete s.marginY;
    else s.marginY = MARGEM[estilo.margemVertical];
  }
  if (estilo.tamanhoFonte) {
    if (estilo.tamanhoFonte === "normal") delete s.fontSize;
    else s.fontSize = estilo.tamanhoFonte;
  }
  if (estilo.icone) {
    if (estilo.icone === "nenhum") delete s.icon;
    else s.icon = estilo.icone;
  }
  // Posição só tem efeito visual com largura restrita (styleClass ignora sem
  // width ≠ auto/full) — avisa em vez de silêncio.
  if (s.justify && (!s.width || s.width === "full")) {
    avisos.push("Posição só tem efeito com uma largura menor que a cheia — defina a largura também.");
  }
  return { styles: Object.keys(s).length ? (s as Block["styles"]) : undefined, avisos };
}

export function aplicarOpsNoDoc(blocks: Block[], ops: EditorChatOp[]): ChatOpsResultado {
  let atual = blocks;
  let aplicadas = 0;
  const ignoradas: string[] = [];

  for (const op of ops) {
    if (op.op === "inserir_topo") {
      const novos = paraBlocos(op);
      if (!novos.length) {
        ignoradas.push("inserir_topo sem blocos.");
        continue;
      }
      atual = [...novos, ...atual];
      aplicadas += 1;
      continue;
    }

    const i = op.blockId ? atual.findIndex((b) => b.id === op.blockId) : -1;
    if (i < 0) {
      ignoradas.push(`Bloco "${op.blockId ?? "?"}" não encontrado no topo do artigo (${op.op}).`);
      continue;
    }

    if (op.op === "remover") {
      atual = [...atual.slice(0, i), ...atual.slice(i + 1)];
      aplicadas += 1;
      continue;
    }

    if (op.op === "estilizar") {
      if (!op.estilo) {
        ignoradas.push("estilizar sem estilo.");
        continue;
      }
      const alvo = atual[i]!;
      const r = mesclarEstilo(alvo.styles, op.estilo);
      atual = [
        ...atual.slice(0, i),
        { ...alvo, ...(r.styles ? { styles: r.styles } : {}) },
        ...atual.slice(i + 1),
      ];
      // styles undefined precisa REMOVER a chave do bloco (spread não apaga).
      if (!r.styles) {
        const semStyles = { ...atual[i]! };
        delete (semStyles as { styles?: unknown }).styles;
        atual = [...atual.slice(0, i), semStyles as Block, ...atual.slice(i + 1)];
      }
      ignoradas.push(...r.avisos);
      aplicadas += 1;
      continue;
    }

    const novos = paraBlocos(op);
    if (!novos.length) {
      ignoradas.push(`${op.op} sem blocos.`);
      continue;
    }

    if (op.op === "inserir_apos") {
      atual = [...atual.slice(0, i + 1), ...novos, ...atual.slice(i + 1)];
      aplicadas += 1;
      continue;
    }

    // substituir: o PRIMEIRO bloco novo herda o id antigo (âncora estável).
    const comAncora = novos.map((b, j) => (j === 0 ? { ...b, id: op.blockId! } : b));
    atual = [...atual.slice(0, i), ...comAncora, ...atual.slice(i + 1)];
    aplicadas += 1;
  }

  // O doc nunca fica vazio (mesmo fallback do editor).
  if (!atual.length) {
    atual = [{ id: newId(), type: "paragraph", text: [] }];
  }
  return { blocks: atual, aplicadas, ignoradas };
}

/**
 * Resumo do documento para o prompt: só os blocos de TOPO-NÍVEL, com id e uma
 * linha de conteúdo — é tudo o que a IA pode referenciar.
 */
export function resumoDoDoc(blocks: Block[]): string {
  const linha = (b: Block): string => {
    const texto =
      "text" in b && b.text ? richToText(b.text) : "";
    switch (b.type) {
      case "heading":
        return `título(h${b.data.level}): ${texto}`;
      case "image":
        return `imagem: ${b.data.alt || b.data.caption || b.data.src.slice(0, 60)}`;
      case "video":
        return `vídeo: ${b.data.url.slice(0, 60)}`;
      case "file":
        return `arquivo p/ download: ${b.data.name}`;
      case "code":
        return `código(${b.data.language ?? "?"}): ${b.data.code.slice(0, 60)}`;
      case "table":
        return `tabela ${b.data.rows.length} linha(s)`;
      default: {
        const filhos =
          "children" in b && b.children?.length ? ` [${b.children.length} filho(s)]` : "";
        return `${b.type}${filhos}: ${texto.slice(0, 90)}`;
      }
    }
  };
  return blocks.map((b) => `${b.id} → ${linha(b).slice(0, 140)}`).join("\n");
}
