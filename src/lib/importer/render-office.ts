import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm, readdir, access } from "node:fs/promises";
import { constants as FS } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Converte um documento de escritório (xlsx/xlsm/…) em PDF via LibreOffice headless.
 * É o que permite LER FLUXOGRAMAS desenhados com células — bibliotecas JS de xlsx só
 * leem dados, não renderizam a tela (células mescladas, bordas, preenchimento).
 *
 * Antes de converter, cada ABA é ajustada para caber em UMA página (fit-to-page).
 * Sem isso, um fluxograma grande é FATIADO em dezenas de páginas (na prática o mesmo
 * arquivo dava 102 páginas para 9 abas) — e a IA de visão veria pedaços soltos do
 * desenho, não o fluxo inteiro. Com o ajuste: 1 aba = 1 página com o fluxograma todo.
 *
 * Só roda no WORKER. Acha o binário automaticamente (env `SOFFICE_BIN`, depois caminhos
 * comuns de macOS/Linux, por fim `soffice` no PATH) — não exige nada configurado se o
 * LibreOffice estiver instalado. Isola o perfil por chamada (instâncias paralelas).
 */
const TIMEOUT_MS = 120_000;

// Ordem de busca do binário: env → app do macOS → caminhos Linux → PATH.
const CANDIDATOS = [
  process.env.SOFFICE_BIN,
  "/Applications/LibreOffice.app/Contents/MacOS/soffice", // macOS (dev)
  "/usr/bin/soffice",
  "/usr/local/bin/soffice",
  "/opt/libreoffice/program/soffice",
].filter((x): x is string => !!x);

let _bin: string | null = null;
async function acharSoffice(): Promise<string> {
  if (_bin) return _bin;
  for (const c of CANDIDATOS) {
    try { await access(c, FS.X_OK); _bin = c; return c; } catch { /* tenta o próximo */ }
  }
  _bin = "soffice"; // por fim, tenta pelo PATH (se não existir, o spawn dá ENOENT)
  return _bin;
}

/**
 * Ajusta cada aba do xlsx para caber em UMA página impressa (fit-to-page), de modo
 * que o fluxograma inteiro fique numa única página do PDF. A orientação é escolhida
 * pela forma da área usada (mais larga → paisagem; mais alta → retrato) e as margens
 * são reduzidas ao mínimo para o desenho ocupar o máximo da folha.
 *
 * Preserva bordas, células mescladas e preenchimento (o desenho do fluxograma) — só
 * mexe nas configurações de impressão. Em QUALQUER falha, devolve o buffer original:
 * um PDF fatiado ainda é melhor que abortar a importação.
 */
async function ajustarUmaPaginaPorAba(buf: Buffer): Promise<Buffer> {
  try {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    let abas = 0;
    wb.eachSheet((ws) => {
      abas++;
      const cols = ws.actualColumnCount || ws.columnCount || 0;
      const rows = ws.actualRowCount || ws.rowCount || 0;
      // Orientação pela GEOMETRIA (soma de larguras de coluna × alturas de linha),
      // não pela contagem de células: colunas estreitas fazem um diagrama largo
      // parecer "alto" na contagem. Paisagem quando é mais largo que alto — os
      // modelos de visão reduzem a imagem pela MAIOR aresta (~1568px), então
      // retrato num diagrama largo desperdiça essa aresta em vazio vertical e
      // encolhe o desenho. (7px/unidade de largura, 1,333px/ponto de altura.)
      let larguraPx = 0;
      let alturaPx = 0;
      for (let c = 1; c <= cols; c++) larguraPx += (ws.getColumn(c).width ?? 8.43) * 7 + 5;
      for (let r = 1; r <= rows; r++) alturaPx += (ws.getRow(r).height ?? 15) * 1.333;
      const orientation: "landscape" | "portrait" = larguraPx >= alturaPx ? "landscape" : "portrait";
      ws.pageSetup = {
        ...ws.pageSetup,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        orientation,
        horizontalCentered: true,
        verticalCentered: true,
        margins: { left: 0.2, right: 0.2, top: 0.2, bottom: 0.2, header: 0, footer: 0 },
      };
    });
    if (!abas) return buf; // nenhuma aba lida → não arrisca, converte o original
    return Buffer.from(await wb.xlsx.writeBuffer());
  } catch {
    return buf; // .ods/.xls ou parser recusou → segue com o original (pode fatiar)
  }
}

export async function renderOfficeToPdf(buf: Buffer, filename: string): Promise<Buffer> {
  const bin = await acharSoffice();
  const dir = await mkdtemp(join(tmpdir(), "kb-office-"));
  try {
    const safe = (filename || "arquivo.xlsx").replace(/[^a-zA-Z0-9._-]/g, "_") || "arquivo.xlsx";
    const inPath = join(dir, safe);
    // Fit-to-page só faz sentido (e o exceljs só lê) para planilhas xlsx/xlsm.
    const ehXlsx = /\.xls[mx]$/i.test(safe);
    const paraConverter = ehXlsx ? await ajustarUmaPaginaPorAba(buf) : buf;
    await writeFile(inPath, paraConverter);
    await runSoffice(bin, ["--headless", "--calc", "--convert-to", "pdf:calc_pdf_Export", "--outdir", dir, inPath], dir);
    const files = await readdir(dir);
    const pdf = files.find((f) => f.toLowerCase().endsWith(".pdf"));
    if (!pdf) throw new Error("LibreOffice não gerou o PDF (verifique o binário soffice no worker).");
    const out = await readFile(join(dir, pdf));
    if (!out.length) throw new Error("LibreOffice gerou um PDF vazio.");
    return out;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function runSoffice(bin: string, args: string[], profileDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // -env:UserInstallation isola o perfil desta chamada (instâncias paralelas no worker).
    const full = [`-env:UserInstallation=file://${join(profileDir, "profile")}`, ...args];
    const p = spawn(bin, full, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err += String(d); });
    const timer = setTimeout(() => { try { p.kill("SIGKILL"); } catch {} reject(new Error("LibreOffice: tempo esgotado.")); }, TIMEOUT_MS);
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(
        `LibreOffice não encontrado (${bin}: ${e.message}). Instale-o — macOS: "brew install --cask libreoffice"; ` +
        `Debian/Ubuntu: "apt install libreoffice-calc" — ou aponte a variável SOFFICE_BIN para o binário soffice.`,
      ));
    });
    p.on("close", (code) => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error(`LibreOffice saiu com ${code}: ${err.slice(0, 300)}`)); });
  });
}
