/**
 * GERA UMA AMOSTRA DE CADA FORMATO, PARA OLHAR.
 *
 * Os renderizadores de PDF/DOCX/PPTX não tinham um único teste — nenhum abria um
 * arquivo gerado. E o trabalho aqui é visual: nenhuma asserção diz se a capa
 * ficou bonita ou se o degradê listrou.
 *
 * Este script fecha essa lacuna do jeito mais direto: monta uma spec com TODOS
 * os tipos de bloco e escreve os cinco arquivos num diretório. Abrir e olhar é a
 * verificação; os testes estruturais (contagem de slides, presença da capa) vêm
 * depois e cobrem outra coisa — que o arquivo não quebrou, não que ficou bom.
 *
 *   npm run relatorio:amostra -- [diretório]
 *
 * Roda sob o tsconfig do WORKER, que já stuba `server-only` (worker/tsconfig.json)
 * — os renderizadores são server-only e sem isso o import barra fora do Next.
 *
 * Os dados são fictícios de propósito: rodar isto não pode depender de banco,
 * nem despejar folha de pagamento real num diretório temporário.
 */

import fs from "node:fs";
import path from "node:path";
import { renderReport } from "../src/lib/reports/exporters";
import type { ReportSpec } from "../src/lib/reports/report-spec";
import type { BrandInfo } from "../src/lib/reports/pdf";
import { REPORT_FORMATS } from "../src/lib/reports/report-spec";

const MARCA_AMOSTRA: BrandInfo = {
  marca: "Natcorp",
  primariaHex: "#511C76",
  dataHoje: "Gerado em 16/08/2026",
};

/** Uma tabela grande o bastante para exercitar quebra de página e zebra. */
const filiais = ["Matriz — São Paulo", "Filial Campinas", "Filial Rio de Janeiro", "Filial Belo Horizonte", "Filial Curitiba", "Filial Recife"];
const linhasFolha = Array.from({ length: 28 }, (_, i) => {
  const f = filiais[i % filiais.length]!;
  return [
    f,
    String(120 + ((i * 37) % 260)),
    `R$ ${(480_000 + ((i * 91_337) % 900_000)).toLocaleString("pt-BR")},00`,
    `${(2 + ((i * 7) % 90) / 10).toFixed(1).replace(".", ",")}%`,
  ];
});

const spec = (formato: ReportSpec["formato"]): ReportSpec => ({
  titulo: "Análise de Headcount e Custo de Pessoal",
  subtitulo: "Competência 07/2026 · Todas as filiais · Gerado pelo assistente Natcorp",
  formato,
  blocos: [
    {
      tipo: "texto",
      texto:
        "## Panorama\n\nO quadro fechou julho com **1.284 colaboradores**, 3,1% acima de junho. " +
        "O crescimento se concentra em duas filiais, e o custo médio por colaborador caiu — " +
        "sinal de que as admissões vieram em faixas salariais menores.\n\n" +
        "- Admissões: 61\n- Desligamentos: 22\n- Saldo: +39",
    },
    { tipo: "tabela", titulo: "Headcount e folha por filial", colunas: ["Filial", "Colaboradores", "Folha bruta", "Turnover"], linhas: linhasFolha },
    {
      tipo: "grafico",
      grafico: {
        tipo: "pizza",
        titulo: "Distribuição do quadro por filial",
        categorias: filiais,
        series: [{ nome: "Colaboradores", valores: [412, 233, 198, 174, 151, 116] }],
      },
    },
    {
      tipo: "grafico",
      grafico: {
        tipo: "colunas",
        titulo: "Evolução do headcount",
        categorias: ["02/2026", "03/2026", "04/2026", "05/2026", "06/2026", "07/2026"],
        series: [
          { nome: "Efetivos", valores: [1102, 1128, 1164, 1190, 1245, 1284] },
          { nome: "Temporários", valores: [88, 91, 84, 79, 96, 103] },
        ],
      },
    },
    {
      tipo: "texto",
      texto:
        "## Pontos de atenção\n\n" +
        "A filial de Recife tem turnover de 9,1%, quase o triplo da média. " +
        "Vale cruzar com os desligamentos por iniciativa do colaborador antes de tratar como problema de gestão.",
    },
  ],
});

async function main() {
  const destino = process.argv[2] ?? path.join(process.cwd(), "temp", "amostra-relatorio");
  fs.mkdirSync(destino, { recursive: true });

  for (const formato of REPORT_FORMATS) {
    const t0 = Date.now();
    try {
      const arq = await renderReport(spec(formato), MARCA_AMOSTRA);
      const bytes = Buffer.from(arq.base64, "base64");
      fs.writeFileSync(path.join(destino, arq.filename), bytes);
      console.log(`  ok  ${arq.filename.padEnd(52)} ${(bytes.length / 1024).toFixed(0).padStart(5)} KB  ${Date.now() - t0}ms`);
    } catch (e) {
      // Um formato que falha não pode impedir a inspeção dos outros — a maior
      // parte do tempo o que se quer é olhar UM deles.
      console.error(`  ERRO ${formato}:`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`\n${destino}`);
}

void main();
