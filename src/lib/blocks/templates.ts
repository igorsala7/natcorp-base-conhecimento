import { newId, type Block } from "./schema";

/**
 * Modelos embutidos de artigo (padrão HubSpot: escolher template antes de
 * escrever). São FÁBRICAS — cada uso gera ids novos; um modelo nunca pode
 * espalhar o mesmo id de bloco por vários artigos.
 */
export type ArticleTemplate = {
  key: string;
  name: string;
  description: string;
  blocks: () => Block[];
};

const p = (text: string): Block => ({ id: newId(), type: "paragraph", text: [{ text }] });
const h2 = (text: string): Block => ({
  id: newId(),
  type: "heading",
  text: [{ text }],
  data: { level: 2 },
});

export const BUILTIN_TEMPLATES: ArticleTemplate[] = [
  {
    key: "faq",
    name: "FAQ (perguntas frequentes)",
    description: "Acordeão de perguntas e respostas.",
    blocks: () => [
      p("Respostas rápidas para as dúvidas mais comuns sobre este tema."),
      {
        id: newId(),
        type: "accordion",
        children: [1, 2, 3].map((n) => ({
          id: newId(),
          type: "accordionItem" as const,
          data: { title: `Pergunta ${n}?` },
          children: [p("Resposta objetiva, com link para o artigo completo quando houver.")],
        })),
      },
    ],
  },
  {
    key: "passo-a-passo",
    name: "Guia passo a passo",
    description: "Objetivo, pré-requisitos e passos numerados.",
    blocks: () => [
      p("O que este guia faz e quando usá-lo."),
      h2("Antes de começar"),
      {
        id: newId(),
        type: "bulletList",
        children: [
          { id: newId(), type: "listItem" as const, text: [{ text: "Pré-requisito 1" }] },
          { id: newId(), type: "listItem" as const, text: [{ text: "Pré-requisito 2" }] },
        ],
      },
      h2("Passos"),
      {
        id: newId(),
        type: "steps",
        children: [1, 2, 3].map(() => ({
          id: newId(),
          type: "step" as const,
          children: [p("Descreva a ação deste passo — uma ação por passo.")],
        })),
      },
      {
        id: newId(),
        type: "callout",
        data: { variant: "success" },
        children: [p("Como verificar que deu certo.")],
      },
    ],
  },
  {
    key: "troubleshooting",
    name: "Solução de problemas",
    description: "Sintoma, causas e soluções, do mais provável ao raro.",
    blocks: () => [
      h2("Sintoma"),
      p("Como o problema aparece para o usuário (mensagem de erro, comportamento)."),
      h2("Causas e soluções"),
      {
        id: newId(),
        type: "accordion",
        children: [1, 2].map((n) => ({
          id: newId(),
          type: "accordionItem" as const,
          data: { title: `Causa provável ${n}` },
          children: [p("Como confirmar esta causa e o passo a passo para resolver.")],
        })),
      },
      {
        id: newId(),
        type: "callout",
        data: { variant: "warning" },
        children: [p("Quando escalar para o suporte, e com quais informações.")],
      },
    ],
  },
];
