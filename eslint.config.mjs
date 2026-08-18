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
 * Visualização de dados (gráfico, mapa mental, fluxograma) fica de fora: uma
 * série categórica precisa de matizes distinguíveis entre si, e quatro tokens
 * de estado não formam uma paleta categórica.
 *
 * ── `components/ui/` NÃO é mais isento ──────────────────────────────────────
 * Era, sob o argumento de que "um primitivo pode precisar de um degrau exato".
 * O argumento é razoável e o resultado foi o oposto do pretendido: a válvula de
 * escape virou o caminho padrão justamente nos seis arquivos mais alavancados
 * do produto. O erro de TODO formulário (`field`), a borda de inválido de TODO
 * input, a ação destrutiva de TODO menu, a etapa com falha de TODO stepper e a
 * tela de erro de TODA rota estavam em `rose-*` cru — enquanto
 * `--color-danger` existia, tinha contraste medido e variante escura pronta.
 *
 * O `copy-button` mostra o custo por inteiro: `text-emerald-600` sem `dark:`
 * fazia o "✓ copiado" quase sumir no tema escuro. O feedback de uma ação
 * desaparecendo no tema em que se trabalha o dia todo é exatamente o tipo de
 * defeito que uma isenção ampla protege de ser notado.
 *
 * Isenção em código de alta alavancagem inverte a intenção da regra. Se um
 * primitivo realmente precisar de um degrau cru, o caminho é um
 * `eslint-disable-next-line` com a justificativa na linha — visível na revisão,
 * em vez de coberto por um glob.
 */
const CORES_CRUAS = String.raw`(bg|text|border-[ltrbxy]|border|ring|decoration|outline|fill|stroke|from|via|to|divide|shadow|accent|caret|placeholder)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-(50|[1-9]00|950)`;

/**
 * TAMANHO DE FONTE SÓ POR DEGRAU DA ESCALA.
 *
 * A migração de COR segurou porque veio acompanhada da regra acima. A de
 * TIPOGRAFIA tinha a mesma documentação, o mesmo cuidado e nenhum mecanismo —
 * e derivou exatamente como se espera: 13px escrito como `text-[0.8125rem]` em
 * 13 arquivos E como `text-[13px]` em outros 2, mais 15px em duas grafias,
 * 28px, 32px, 25,6px e 17px avulsos. É a história do 11px se repetindo, no
 * mesmo repositório, com o comentário que a explica logo acima.
 *
 * O 13px virou `--text-ui` (tem papel: densidade de cromo). Os demais
 * colapsaram para degraus existentes — quatro usos não estabelecem um papel.
 *
 * `em` continua livre: `text-[0.85em]` escala com o pai, que é o
 * comportamento certo para código inline dentro da prosa. O que a regra proíbe
 * é o tamanho ABSOLUTO, que é o que sai da escala.
 */
const TAMANHO_CRU = String.raw`text-\[[0-9]+(\.[0-9]+)?(rem|px)\]`;

/**
 * O TOKEN TEM CLASSE — não se escreve a variável à mão.
 *
 * `bg-[var(--color-primary)]` produz exatamente o mesmo CSS que `bg-primary`,
 * então nada quebra — e é justamente por isso que se espalhou: 29 ocorrências
 * em 6 arquivos, incluindo `ui/dialog.tsx`. O custo é de legibilidade e de
 * busca: quem procura "quem usa a primária" com `grep bg-primary` não encontra
 * essas, e quem lê a linha vê um valor arbitrário onde há um token.
 *
 * É a mesma deriva da cor crua, um nível mais sutil: em vez de furar o sistema,
 * escreve-se o sistema pelo lado de fora dele.
 */
const VAR_A_MAO = String.raw`(bg|text|border|ring|fill|stroke|from|via|to|divide|outline|shadow)-\[var\(--color-`;

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "node_modules/**", "supabase/**", "apps/**", "temp/**"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
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
      /**
       * `error`, não `warn`.
       *
       * O comentário do topo deste arquivo dizia o objetivo em voz alta: "sem
       * esta regra, a 402ª entra na semana que vem". Como `warn`, ela entrava —
       * só que acompanhada de uma linha amarela num build de 194 arquivos, que
       * ninguém lê. A regra que documenta a própria fragilidade do sistema era
       * a única que não reprovava nada.
       *
       * A promoção custa zero HOJE (o código está limpo fora das isenções) e
       * fica mais cara a cada semana que passa. É o único momento barato.
       */
      "no-restricted-syntax": [
        "error",
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
        {
          selector: `Literal[value=/${TAMANHO_CRU}/]`,
          message:
            "Tamanho de fonte fora da escala. Use um degrau (text-2xs, text-xs, text-ui, text-sm, text-base, text-lg, text-xl, text-2xl, text-3xl, text-4xl) ou, na leitura do portal, text-[length:var(--l-*)]. Ver o bloco da escala tipográfica em globals.css.",
        },
        {
          selector: `TemplateElement[value.raw=/${TAMANHO_CRU}/]`,
          message:
            "Tamanho de fonte fora da escala. Use um degrau (text-2xs, text-xs, text-ui, text-sm, text-base, text-lg, text-xl, text-2xl, text-3xl, text-4xl) ou, na leitura do portal, text-[length:var(--l-*)]. Ver o bloco da escala tipográfica em globals.css.",
        },
        {
          selector: `Literal[value=/${VAR_A_MAO}/]`,
          message:
            "Variável de token escrita à mão. O token já tem classe: bg-primary, text-primary, border-accent, ring… Ver o mapa em tailwind.config.ts.",
        },
        {
          selector: `TemplateElement[value.raw=/${VAR_A_MAO}/]`,
          message:
            "Variável de token escrita à mão. O token já tem classe: bg-primary, text-primary, border-accent, ring… Ver o mapa em tailwind.config.ts.",
        },
      ],
    },
  },
];

export default eslintConfig;
