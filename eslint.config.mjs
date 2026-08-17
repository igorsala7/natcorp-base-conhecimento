// eslint-config-next v16 exporta flat configs nativos (arrays) — sem FlatCompat.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * COR DE ESTADO SÓ POR TOKEN.
 *
 * O produto tinha 401 ocorrências de classe de cor crua do Tailwind
 * (`bg-amber-50`, `text-red-600`, `border-emerald-300`) em mais de 60 arquivos.
 * A causa não era indisciplina: `globals.css` não definia NENHUM token de
 * estado, então quem precisava pintar um aviso não tinha o que usar.
 *
 * Os tokens agora existem (`bg-danger-soft`, `text-warning`, `border-success-line`,
 * `bg-info`…). Sem esta regra, a 402ª entra na semana que vem — porque copiar a
 * linha do arquivo vizinho continua sendo mais rápido que procurar o token.
 *
 * ── O que a regra NÃO proíbe ────────────────────────────────────────────────
 * A escala da MARCA (`brand-purple-*`, `brand-pink-*`, `brand-blue-*`,
 * `brand-gray-*`) é permitida: ela é o sistema, e existe justamente para
 * fundos suaves e bordas que não são estado.
 *
 * `components/ui/` também é permitido: é onde os primitivos moram, e um deles
 * pode precisar de um degrau exato. Quando precisar, a decisão fica em um
 * arquivo, não espalhada por sessenta.
 *
 * Visualização de dados (gráfico, mapa mental, fluxograma) fica de fora pelo
 * mesmo motivo: uma série categórica precisa de matizes distinguíveis entre si,
 * e quatro tokens de estado não formam uma paleta categórica.
 */
const CORES_CRUAS = String.raw`(bg|text|border-[ltrbxy]|border|ring|decoration|outline|fill|stroke|from|via|to|divide|shadow|accent|caret|placeholder)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-(50|[1-9]00|950)`;

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "node_modules/**", "supabase/**", "apps/**", "temp/**"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      // Os primitivos podem precisar de um degrau exato — ver acima.
      "src/components/ui/**",
      // Paleta categórica de visualização, não cor de estado.
      "src/components/portal/chart-view.tsx",
      "src/components/portal/flow-view.tsx",
      "src/components/portal/mindmap-view.tsx",
      "src/components/editor/blocks/blocks/flow-canvas.tsx",
      "src/components/editor/blocks/blocks/mindmap-block.tsx",
      "src/components/editor/blocks/chart-props.tsx",
      // Renderizador de blocos: o autor do artigo escolhe a cor do callout,
      // e essas escolhas são conteúdo, não interface.
      "src/lib/blocks/render.tsx",
      "src/components/editor/blocks/blocks/container-block.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: `Literal[value=/${CORES_CRUAS}/]`,
          message:
            "Cor crua do Tailwind. Use o token de estado (bg-danger-soft, text-warning, border-success-line, bg-info…) ou a escala da marca (brand-purple-*). Ver o bloco 'Estado' em globals.css.",
        },
        {
          selector: `TemplateElement[value.raw=/${CORES_CRUAS}/]`,
          message:
            "Cor crua do Tailwind. Use o token de estado (bg-danger-soft, text-warning, border-success-line, bg-info…) ou a escala da marca (brand-purple-*). Ver o bloco 'Estado' em globals.css.",
        },
      ],
    },
  },
];

export default eslintConfig;
