/**
 * Página de exemplo (entregável do motor de blocos):
 *   Título → Colunas 2 [texto | imagem] → botão CTA → embed Google Maps.
 * Serve de fixture para os testes de convert/render/serialize e de referência
 * do formato JSON. IDs fixos (determinístico).
 */
import type { BlockDoc } from "./schema";

export const SAMPLE_PAGE: BlockDoc = {
  version: 2,
  blocks: [
    {
      id: "blk-title",
      type: "heading",
      text: [{ text: "Bem-vindo à Central de Ajuda" }],
      data: { level: 1 },
    },
    {
      id: "blk-container",
      type: "container",
      data: { columns: 2 },
      children: [
        {
          id: "blk-col-1",
          type: "column",
          children: [
            {
              id: "blk-col-1-p",
              type: "paragraph",
              text: [
                { text: "Aprenda a usar a plataforma com nossos guias. Comece pelos " },
                { text: "primeiros passos", marks: [{ type: "bold" }] },
                { text: " e depois explore os recursos avançados." },
              ],
            },
          ],
        },
        {
          id: "blk-col-2",
          type: "column",
          children: [
            {
              id: "blk-col-2-img",
              type: "image",
              data: {
                src: "https://example.com/onboarding.png",
                alt: "Tela de boas-vindas",
                caption: "Painel inicial",
              },
            },
          ],
        },
      ],
    },
    {
      id: "blk-cta",
      type: "button",
      data: { label: "Começar agora", href: "/docs/global/primeiros-passos", variant: "primary" },
    },
    {
      id: "blk-map",
      type: "embed",
      data: {
        provider: "googlemaps",
        url: "https://www.google.com/maps/place/Av.+Paulista,+São+Paulo",
        embedUrl:
          "https://maps.google.com/maps?q=https%3A%2F%2Fwww.google.com%2Fmaps%2Fplace%2FAv.%2BPaulista&output=embed",
      },
    },
  ],
};
