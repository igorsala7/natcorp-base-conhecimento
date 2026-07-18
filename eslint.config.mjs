// eslint-config-next v16 exporta flat configs nativos (arrays) — sem FlatCompat.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "node_modules/**", "supabase/**"],
  },
];

export default eslintConfig;
