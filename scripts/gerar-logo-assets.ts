/**
 * REGERA `src/lib/reports/assets/logo.ts` a partir dos PNGs da marca.
 *
 *   npx tsx scripts/gerar-logo-assets.ts
 *
 * O logo vive embutido em base64 dentro de um `.ts` porque o Next rastreia
 * IMPORTS para decidir o que empacota, não caminhos montados em tempo de
 * execução — um `readFileSync(path.join(process.cwd(), …))` funciona em dev e
 * some no build standalone, e some do pior jeito: o relatório sai sem logo, sem
 * erro, e ninguém liga uma coisa à outra.
 *
 * Este script existe porque a primeira geração foi feita à mão. Um asset que só
 * uma pessoa sabe regerar é um asset que ninguém regenera — quando a marca
 * mudar, isto aqui é a diferença entre um comando e uma arqueologia.
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

/** 120pt a 300dpi são 500px; 560 cobre impressão com folga e o resto é peso morto. */
const LARGURA = 560;
const DIR = path.join(process.cwd(), "src/lib/reports/assets");

const ORIGENS = [
  { chave: "LOGO_COR", arquivo: "natcorp-logo.png", doc: "Colorido — para fundo claro." },
  { chave: "LOGO_BRANCO", arquivo: "natcorp-logo-branco.png", doc: "Branco monocromático — para a faixa em degradê e qualquer fundo escuro." },
];

function quebrar(b64: string, w = 76): string {
  const partes: string[] = [];
  for (let i = 0; i < b64.length; i += w) partes.push(`  "${b64.slice(i, i + w)}"`);
  return partes.join(" +\n");
}

async function main() {
  const blocos: string[] = [];
  for (const o of ORIGENS) {
    const buf = await sharp(path.join(DIR, o.arquivo))
      .resize({ width: LARGURA, withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer();
    const { width = 0, height = 1 } = await sharp(buf).metadata();
    const b64 = buf.toString("base64");
    console.log(`  ${o.chave.padEnd(12)} ${width}x${height}  ${(buf.length / 1024).toFixed(0)}KB → base64 ${(b64.length / 1024).toFixed(0)}KB`);
    blocos.push(
      `/** ${o.doc} */\nexport const ${o.chave}: Logo = {\n` +
        `  largura: ${width},\n  altura: ${height},\n  proporcao: ${(width / height).toFixed(4)},\n  base64:\n${quebrar(b64)},\n};`,
    );
  }

  const cab = [
    "/**",
    " * O LOGO DA NATCORP, EMBUTIDO. GERADO — não edite à mão.",
    " *",
    " *   npx tsx scripts/gerar-logo-assets.ts",
    " *",
    " * Duas variantes porque o material usa as duas: a COLORIDA sobre fundo claro e",
    " * a BRANCA sobre a faixa em degradê. Recolorir um PNG em tempo de execução",
    " * exigiria biblioteca de imagem no servidor, e a marca entrega as duas prontas.",
    " *",
    " * Base64 e não `fs.readFileSync`: o Next rastreia imports, não caminhos montados",
    " * em runtime. Ver o cabeçalho de `scripts/gerar-logo-assets.ts`.",
    " */",
    "",
    "export type Logo = { base64: string; largura: number; altura: number; proporcao: number };",
    "",
  ].join("\n");

  const rodape = [
    "",
    "/** O buffer pronto para `embedPng` (pdf-lib) e `ImageRun` (docx). */",
    "export function logoPng(l: Logo): Buffer {",
    "  return Buffer.from(l.base64, \"base64\");",
    "}",
    "",
    "/** Data URL — o que `pptxgenjs` aceita direto. */",
    "export function logoDataUrl(l: Logo): string {",
    "  return `data:image/png;base64,${l.base64}`;",
    "}",
    "",
  ].join("\n");

  fs.writeFileSync(path.join(DIR, "logo.ts"), cab + blocos.join("\n\n") + "\n" + rodape);
  console.log(`\n  ${path.join(DIR, "logo.ts")}`);
}

void main();
