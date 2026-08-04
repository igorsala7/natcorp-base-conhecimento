import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Converte um documento de escritório (xlsx/xlsm/…) em PDF via LibreOffice headless.
 * É o que permite LER FLUXOGRAMAS desenhados com células — bibliotecas JS de xlsx só
 * leem dados, não renderizam a tela (células mescladas, bordas, preenchimento). Cada
 * ABA vira uma ou mais PÁGINAS do PDF (respeitando a área de impressão do arquivo).
 *
 * Só roda no WORKER (precisa do binário `soffice`). Caminho configurável por
 * `SOFFICE_BIN` (default: `soffice`, no PATH). Isola o perfil por chamada para
 * permitir instâncias paralelas.
 */
const SOFFICE = process.env.SOFFICE_BIN || "soffice";
const TIMEOUT_MS = 120_000;

export async function renderOfficeToPdf(buf: Buffer, filename: string): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "kb-office-"));
  try {
    const safe = (filename || "arquivo.xlsx").replace(/[^a-zA-Z0-9._-]/g, "_") || "arquivo.xlsx";
    const inPath = join(dir, safe);
    await writeFile(inPath, buf);
    await runSoffice(["--headless", "--calc", "--convert-to", "pdf:calc_pdf_Export", "--outdir", dir, inPath], dir);
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

function runSoffice(args: string[], profileDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // -env:UserInstallation isola o perfil desta chamada (instâncias paralelas no worker).
    const full = [`-env:UserInstallation=file://${join(profileDir, "profile")}`, ...args];
    const p = spawn(SOFFICE, full, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err += String(d); });
    const timer = setTimeout(() => { try { p.kill("SIGKILL"); } catch {} reject(new Error("LibreOffice: tempo esgotado.")); }, TIMEOUT_MS);
    p.on("error", (e) => { clearTimeout(timer); reject(new Error(`LibreOffice não encontrado (${SOFFICE}): ${e.message}`)); });
    p.on("close", (code) => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error(`LibreOffice saiu com ${code}: ${err.slice(0, 300)}`)); });
  });
}
