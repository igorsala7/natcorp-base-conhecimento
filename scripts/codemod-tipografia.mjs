/**
 * Colapsa os tamanhos micro escritos à mão nos degraus do sistema.
 *
 * Por que existia o problema: `--text-*` nunca chegava ao JSX (a chave `fontSize`
 * não existia no tailwind.config). Sem degrau alcançável, cada tela inventou o
 * seu — e o MESMO tamanho ganhou três grafias: `text-[11px]`, `text-[0.6875rem]`
 * e `text-[10px]`. Com a fiação feita, isso vira `text-2xs`.
 *
 * ── O que este script NÃO toca, de propósito ────────────────────────────────
 *  · `text-[length:var(--l-…)]` — é a escala de leitura configurável pelo
 *    usuário (Aparência → Leitura). Está certa e é intencional.
 *  · `text-[13px]`, `text-[15px]`, `text-[1.6rem]` e afins — caem ENTRE dois
 *    degraus. Arredondar sem olhar a tela é chute; ficam para revisão manual e
 *    são contados pelo ratchet para não crescerem.
 *
 * Rodar: node scripts/codemod-tipografia.mjs [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const DRY = process.argv.includes("--dry");

/**
 * Tudo abaixo de 12px vira o degrau único de 11px. Subir 9→11 e 10→11 é
 * deliberado: abaixo disso não é rótulo, é ruído — e era justamente a faixa
 * onde as grafias se multiplicavam.
 */
const MAPA = [
  [/\btext-\[9px\]/g, "text-2xs"],
  [/\btext-\[0\.5625rem\]/g, "text-2xs"],
  [/\btext-\[10px\]/g, "text-2xs"],
  [/\btext-\[0\.625rem\]/g, "text-2xs"],
  [/\btext-\[11px\]/g, "text-2xs"],
  [/\btext-\[0\.6875rem\]/g, "text-2xs"],
  // `size-3` (12px) é aposentado: o par size-4/size-3.5 já cobre normal e denso,
  // e três tamanhos de ícone pequeno sem regra é o que produz a deriva.
  [/\bsize-3\b(?!\.)/g, "size-3.5"],
];

const arquivos = execSync('git ls-files "src/**/*.tsx" "src/**/*.ts"', { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

let tocados = 0;
let trocas = 0;
for (const f of arquivos) {
  const antes = readFileSync(f, "utf8");
  let depois = antes;
  for (const [rx, para] of MAPA) {
    depois = depois.replace(rx, (m) => {
      trocas++;
      return para;
    });
  }
  if (depois !== antes) {
    tocados++;
    if (!DRY) writeFileSync(f, depois);
  }
}

console.log(`${DRY ? "[dry] " : ""}${trocas} trocas em ${tocados} arquivos`);
