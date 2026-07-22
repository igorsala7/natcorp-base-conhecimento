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
  return (op.blocks ?? []).map((b) => blockToBlock(b));
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
