import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

/**
 * Escalas 50→950 derivadas da paleta da marca (CLAUDE.md, Parte 6.1):
 *   Roxo (principal)   #511C76  → brand.purple.700
 *   Rosa (secundária)  #C95788  → brand.pink.500
 *   Azul (contraste)   #2C1A63  → brand.blue.800
 * Neutros com leve viés roxo/azulado (~270°) para conversar com a marca.
 *
 * Componentes NÃO referenciam estas escalas diretamente para cor de UI —
 * usam os tokens semânticos (var(--color-*)) definidos em globals.css.
 * As escalas cruas existem para fundos suaves, bordas e acentos (ex.: purple-50
 * em callouts, purple-200 em bordas) e para o tema por cliente (spaces.theme).
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx,mdx}",
    "./src/app/**/*.{ts,tsx,mdx}",
    "./src/components/**/*.{ts,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: {
            50: "#F7F4FA",
            100: "#EEE7F3",
            200: "#DBCBE7",
            300: "#C0A6D5",
            400: "#9E77BC",
            500: "#8153A3",
            600: "#683A8B",
            700: "#511C76",
            800: "#431862",
            900: "#34134B",
            950: "#220C32",
          },
          pink: {
            50: "#FCF3F7",
            100: "#FAE6EF",
            200: "#F4CADD",
            300: "#ECA3C2",
            400: "#DE76A1",
            500: "#C95788",
            600: "#B03D6E",
            700: "#922E58",
            800: "#792749",
            900: "#66233F",
            950: "#3D1122",
          },
          blue: {
            50: "#F3F2F9",
            100: "#E7E4F2",
            200: "#CBC5E3",
            300: "#A79ECF",
            400: "#7C6FB4",
            500: "#5A4B9B",
            600: "#453885",
            700: "#382C6E",
            800: "#2C1A63",
            900: "#221551",
            950: "#150C33",
          },
          // Neutros harmonizados (viés ~270°, saturação baixa).
          gray: {
            50: "#FAFAFB",
            100: "#F4F3F6",
            200: "#E8E6EC",
            300: "#D5D2DC",
            400: "#A9A4B5",
            500: "#7C7688",
            600: "#5C5768",
            700: "#47424F",
            800: "#302C38",
            900: "#201D26",
            950: "#141119",
          },
        },
        // Tokens semânticos — mapeados para CSS variables (globals.css).
        // É isto que permite trocar tema por cliente sem tocar em componente.
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        "surface-2": "var(--color-surface-2)",
        border: "var(--color-border)",
        text: "var(--color-text)",
        "text-muted": "var(--color-text-muted)",
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          fg: "var(--color-primary-fg)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          fg: "var(--color-accent-fg)",
        },
        ring: "var(--color-focus-ring)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      maxWidth: {
        // Medida de linha ideal para leitura de documentação (~65–75ch).
        prose: "72ch",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
    },
  },
  plugins: [animate, typography],
};

export default config;
