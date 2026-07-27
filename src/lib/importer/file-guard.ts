/**
 * Guarda de arquivos anexados (Importar e "Criar com IA"): allowlist de
 * extensões + validação de assinatura (magic bytes) + detecção de binário
 * disfarçado. PURO e sem dependências de servidor, para ser testável e usado
 * tanto no cliente (hint de `accept`) quanto no servidor (o portão de verdade).
 *
 * Modelo de ameaça — o conteúdo do arquivo é sempre tratado como DADO, nunca
 * executado: escritas no banco são parametrizadas (Supabase), então um .sql
 * anexado é texto inerte (sem SQL injection). Aqui barramos o que importa nesta
 * fronteira: (1) tipo não permitido; (2) binário/executável disfarçado de
 * documento ou texto; (3) tamanho abusivo. HTML extraído tem <script>/<style>
 * removidos na extração; conteúdo vai à IA rotulado como DADO (anti-injeção).
 */

/** Formatos EXTRAÍDOS por parser dedicado (não são lidos como texto cru). */
export const EXT_EXTRAI = ["pdf", "docx", "pptx", "xlsx", "xlsm", "html", "htm", "md", "markdown"] as const;

/** Código/texto de desenvolvimento — lidos como TEXTO puro (inertes). */
export const EXT_TEXTO = [
  "txt", "text", "log", "csv", "tsv", "rtf",
  "sql", "pks", "pkb", "plsql",
  "js", "mjs", "cjs", "jsx", "ts", "tsx", "vue", "svelte",
  "css", "scss", "sass", "less",
  "xml", "json", "json5", "yaml", "yml", "toml", "ini", "env", "properties",
  "py", "rb", "php", "java", "kt", "kts", "go", "rs", "c", "h", "cpp", "cc", "hpp",
  "cs", "swift", "m", "scala", "clj", "ex", "exs", "erl", "lua", "r", "pl", "dart",
  "sh", "bash", "zsh", "ps1", "bat", "cmd", "dockerfile", "makefile",
  "graphql", "gql", "proto", "prisma", "tf", "hcl",
] as const;

/** Todas as extensões aceitas. */
export const EXT_ACEITAS: ReadonlySet<string> = new Set<string>([...EXT_EXTRAI, ...EXT_TEXTO]);

/** Valor do atributo `accept` do <input type=file> (hint no cliente). */
export const ACCEPT_ATTR = [...EXT_ACEITAS].map((e) => `.${e}`).join(",");

/** Limite padrão por arquivo (bytes). Documentos grandes vão pela Importação. */
export const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;

/** Extensão (minúscula, sem ponto) do nome. */
export function extDe(name: string): string {
  const base = name.toLowerCase().trim();
  // Nomes sem extensão convencionais (Dockerfile, Makefile).
  if (base === "dockerfile" || base.endsWith("/dockerfile")) return "dockerfile";
  if (base === "makefile" || base.endsWith("/makefile")) return "makefile";
  const i = base.lastIndexOf(".");
  return i >= 0 ? base.slice(i + 1) : "";
}

export function extensaoAceita(name: string): boolean {
  return EXT_ACEITAS.has(extDe(name));
}

/** Precisa de parser dedicado (senão é lido como texto). */
export function precisaExtrator(name: string): boolean {
  return (EXT_EXTRAI as readonly string[]).includes(extDe(name));
}

/** Heurística de binário: NUL ou muitos bytes de controle nos primeiros KB. */
export function pareceBinario(buf: Uint8Array): boolean {
  const n = Math.min(buf.length, 8192);
  if (n === 0) return false;
  let controle = 0;
  for (let i = 0; i < n; i++) {
    const b = buf[i]!;
    if (b === 0) return true; // NUL = binário
    // fora de tab/LF/CR e do imprimível ASCII (permite UTF-8 alto ≥ 0x80)
    if ((b < 9 || (b > 13 && b < 32)) && b !== 27) controle++;
  }
  return controle / n > 0.1;
}

const ZIP = [0x50, 0x4b]; // "PK" — docx/pptx/xlsx são zips OOXML
const PDF = [0x25, 0x50, 0x44, 0x46]; // "%PDF"

function comecaCom(buf: Uint8Array, sig: number[]): boolean {
  if (buf.length < sig.length) return false;
  return sig.every((b, i) => buf[i] === b);
}

/**
 * Valida assinatura/coerência do conteúdo — LANÇA `Error` com mensagem amigável
 * se o arquivo não for o que a extensão diz (binário disfarçado etc.). Barra o
 * ataque de "executável renomeado para .txt/.pdf".
 */
export function assertArquivoSeguro(buf: Uint8Array, name: string): void {
  const ext = extDe(name);
  // Mensagem amigável ANTES da allowlist para o PPT antigo (binário OLE).
  if (ext === "ppt") {
    throw new Error("PPT antigo não é suportado — salve como .pptx e anexe de novo.");
  }
  if (!EXT_ACEITAS.has(ext)) {
    throw new Error(`Tipo de arquivo não permitido (.${ext || "?"}).`);
  }
  if (buf.length > MAX_UPLOAD_BYTES) {
    throw new Error("Arquivo muito grande.");
  }
  // Formatos OOXML (zip) e PDF: exigem a assinatura correta.
  if (["docx", "pptx", "xlsx", "xlsm"].includes(ext)) {
    if (!comecaCom(buf, ZIP)) throw new Error("Arquivo corrompido ou não é um Office válido.");
    return;
  }
  if (ext === "pdf") {
    if (!comecaCom(buf, PDF)) throw new Error("Arquivo corrompido ou não é um PDF válido.");
    return;
  }
  // Texto/código/markdown/html/rtf: precisa PARECER texto (não binário disfarçado).
  if (pareceBinario(buf)) {
    throw new Error("Este arquivo parece binário, não texto — envie o arquivo correto.");
  }
}
