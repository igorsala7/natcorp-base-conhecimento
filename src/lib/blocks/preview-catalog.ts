import { newId, type Block, type RichText } from "./schema";

/**
 * Catálogo PURO de exemplos de bloco por tipo — as chaves são os `kind` do
 * schema de layout (o vocabulário que a IA já usa), casadas com o campo
 * `preview` das opções de pergunta. Sem React, para ser testável (validamos os
 * shapes contra o BlockDocSchema real).
 */

const rt = (t: string): RichText => [{ text: t }];
const p = (t: string): Block => ({ id: newId(), type: "paragraph", text: rt(t) }) as Block;

/** Exemplo representativo do tipo de bloco; `null` se a chave for desconhecida. */
export function previewBlocks(kind: string): Block[] | null {
  switch (kind) {
    case "heading":
      return [
        { id: newId(), type: "heading", data: { level: 2 }, text: rt("Título da seção") } as Block,
        p("Texto de apoio da seção."),
      ];
    case "callout":
      return [
        {
          id: newId(),
          type: "callout",
          data: { variant: "info", title: "Atenção" },
          children: [p("Destaque uma observação importante para o leitor.")],
        } as Block,
      ];
    case "steps":
      return [
        {
          id: newId(),
          type: "steps",
          children: [
            { id: newId(), type: "step", data: { title: "Abrir a tela" }, children: [p("Acesse o menu principal.")] } as Block,
            { id: newId(), type: "step", data: { title: "Preencher" }, children: [p("Informe os dados pedidos.")] } as Block,
            { id: newId(), type: "step", data: { title: "Salvar" }, children: [p("Confirme para concluir.")] } as Block,
          ],
        } as Block,
      ];
    case "bullets":
    case "list":
      return [
        {
          id: newId(),
          type: "bulletList",
          children: [
            { id: newId(), type: "listItem", text: rt("Primeiro ponto") } as Block,
            { id: newId(), type: "listItem", text: rt("Segundo ponto") } as Block,
            { id: newId(), type: "listItem", text: rt("Terceiro ponto") } as Block,
          ],
        } as Block,
      ];
    case "numbered":
    case "orderedList":
      return [
        {
          id: newId(),
          type: "orderedList",
          children: [
            { id: newId(), type: "listItem", text: rt("Etapa um") } as Block,
            { id: newId(), type: "listItem", text: rt("Etapa dois") } as Block,
          ],
        } as Block,
      ];
    case "checklist":
      return [
        {
          id: newId(),
          type: "checklist",
          data: {
            items: [
              { id: newId(), text: rt("Pré-requisito atendido"), checked: true },
              { id: newId(), text: rt("Configuração revisada"), checked: false },
            ],
          },
        } as Block,
      ];
    case "table":
      return [
        {
          id: newId(),
          type: "table",
          data: {
            hasHeader: true,
            rows: [
              [rt("Campo"), rt("Descrição")],
              [rt("Nome"), rt("Identifica o registro")],
              [rt("Status"), rt("Situação atual")],
            ],
          },
        } as Block,
      ];
    case "code":
      return [
        {
          id: newId(),
          type: "code",
          data: { language: "sql", code: "SELECT * FROM clientes\nWHERE ativo = true;" },
        } as Block,
      ];
    case "quote":
      return [
        {
          id: newId(),
          type: "quote",
          text: rt("Uma citação em destaque dá peso a uma recomendação."),
          data: { author: "Equipe de Documentação" },
        } as Block,
      ];
    case "stats":
      return [
        {
          id: newId(),
          type: "stats",
          data: {
            items: [
              { id: newId(), value: "99,9%", label: "Disponibilidade", trend: "" },
              { id: newId(), value: "24h", label: "Suporte", trend: "" },
            ],
          },
        } as Block,
      ];
    case "panel":
      return [
        {
          id: newId(),
          type: "panel",
          data: { bg: "purple" },
          children: [p("Uma caixa colorida para agrupar um aviso ou resumo.")],
        } as Block,
      ];
    case "columns":
    case "container":
      return [
        {
          id: newId(),
          type: "container",
          data: { columns: 2 },
          children: [
            { id: newId(), type: "column", children: [p("Coluna da esquerda.")] } as Block,
            { id: newId(), type: "column", children: [p("Coluna da direita.")] } as Block,
          ],
        } as Block,
      ];
    case "hero":
      return [
        {
          id: newId(),
          type: "hero",
          data: { eyebrow: "Guia", title: "Comece por aqui", subtitle: "Um cabeçalho de destaque.", bg: "purple" },
        } as Block,
      ];
    case "cardGrid":
    case "cards":
      return [
        {
          id: newId(),
          type: "cardGrid",
          data: { cols: 2 },
          children: [
            { id: newId(), type: "card", data: { icon: "book", title: "Primeiros passos", href: "" }, children: [p("Introdução rápida.")] } as Block,
            { id: newId(), type: "card", data: { icon: "settings", title: "Configuração", href: "" }, children: [p("Ajuste o sistema.")] } as Block,
          ],
        } as Block,
      ];
    case "accordion":
      return [
        {
          id: newId(),
          type: "accordion",
          children: [
            { id: newId(), type: "accordionItem", data: { title: "Pergunta frequente" }, children: [p("Resposta que abre ao clicar.")] } as Block,
          ],
        } as Block,
      ];
    case "toggle":
      return [
        {
          id: newId(),
          type: "toggle",
          data: { title: "Detalhes opcionais" },
          children: [p("Conteúdo secundário que fica recolhido.")],
        } as Block,
      ];
    case "paragraph":
      return [p("Um parágrafo de texto corrido, o corpo comum da documentação.")];
    default:
      return null;
  }
}

/** Existe um exemplo visual para esta chave? */
export function temPreview(typeKey: string | null | undefined): boolean {
  return !!typeKey && previewBlocks(typeKey) !== null;
}
