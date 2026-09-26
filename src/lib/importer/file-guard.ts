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

/**
 * Imagens — NÃO entram na Importação (viram texto? não): só são aceitas nos
 * ANEXOS de chat, e mesmo assim apenas quando o chamador pede explicitamente
 * (`{ imagens: true }`), pois vão a um modelo com VISÃO, não ao extrator.
 */
export const EXT_IMAGEM = ["png", "jpg", "jpeg", "gif", "webp"] as const;

/** Todas as extensões aceitas (documentos/código — imagens ficam à parte). */
export const EXT_ACEITAS: ReadonlySet<string> = new Set<string>([...EXT_EXTRAI, ...EXT_TEXTO]);

/** É uma imagem (pela extensão)? */
export function ehImagem(name: string): boolean {
  return (EXT_IMAGEM as readonly string[]).includes(extDe(name));
}

/* ═══════════════════════════════════════════════════════════════════════════
   MÍDIA — o que existe SÓ para download, e por que ela é uma OPÇÃO

   Pedido do dono, verbatim: *"ele pode anexar qualquer tipo de mídia para ficar
   disponível para download"*. Até aqui a allowlist recusava vídeo, áudio,
   compactado e os formatos antigos do Office — a tela do cliente prometeria
   mídia e o servidor recusaria.

   A liberação é POR CHAMADOR (`{ midia: true }`), e não global, porque esta
   função é COMPARTILHADA com o importador e com os anexos do chat. Nesses dois
   o arquivo vira TEXTO (extrator ou visão) e um .mp4 lá dentro só produziria
   documento com zero trecho — a falha silenciosa clássica deste produto.
   Alargar a allowlist para todo mundo seria pagar, nas duas outras superfícies,
   por um requisito que é de uma só.

   Nada que entra por esta opção vira conhecimento: `podeVirarConhecimento`
   (em `src/lib/documentacoes/arquivos-da-base.ts`) continua sendo
   `extensaoAceita`, que NÃO inclui nenhuma destas extensões — então pedir
   "incluir na base de conhecimento" para um .mp4 é recusado com o motivo, e
   não aceito e indexado com zero chunk.
   ═══════════════════════════════════════════════════════════════════════════ */

export const EXT_VIDEO = ["mp4", "m4v", "mov", "webm", "mkv", "avi", "mpeg", "mpg", "wmv", "3gp"] as const;
export const EXT_AUDIO = ["mp3", "wav", "m4a", "aac", "ogg", "oga", "opus", "flac", "wma"] as const;
export const EXT_COMPACTADO = ["zip", "7z", "rar", "gz", "tgz", "tar"] as const;
/** Office binário (OLE). O moderno (docx/pptx/xlsx) já está em `EXT_EXTRAI`. */
export const EXT_OFFICE_ANTIGO = ["doc", "xls", "ppt"] as const;

/** Tudo que só existe para download, liberado apenas com `{ midia: true }`. */
export const EXT_MIDIA: ReadonlySet<string> = new Set<string>([
  ...EXT_VIDEO,
  ...EXT_AUDIO,
  ...EXT_COMPACTADO,
  ...EXT_OFFICE_ANTIGO,
]);

/**
 * EXECUTÁVEL E SCRIPT DE SISTEMA — recusados com o motivo, não com o genérico.
 *
 * Só vale no modo `midia`, e a limitação é deliberada: `sh`, `bash`, `zsh`,
 * `ps1`, `bat` e `cmd` estão em `EXT_TEXTO` e são aceitos HOJE pelo importador,
 * que os lê como texto inerte para virar documentação. Aplicar esta recusa fora
 * do modo `midia` mudaria o comportamento do importador e dos anexos de chat —
 * que esta rodada tem como requisito NÃO mudar.
 *
 * No modo `midia` a conta é outra: o arquivo não vira texto, ele vira DOWNLOAD
 * para os usuários daquele cliente pelo chatbot. Distribuir executável por esse
 * caminho é vetor, não conveniência, e a extensão sozinha não basta — o
 * conteúdo também é conferido logo abaixo (`assinaturaDeExecutavel`), porque
 * extensão é palpite e renomear é grátis.
 */
const EXT_EXECUTAVEL: ReadonlySet<string> = new Set<string>([
  // Nativos, bibliotecas e instaladores
  "exe", "com", "scr", "pif", "msi", "msp", "cpl", "sys", "dll", "drv", "ocx",
  "jar", "apk", "app", "dmg", "pkg", "deb", "rpm", "appimage", "snap",
  "so", "dylib", "elf", "bin", "run",
  // Scripts que o sistema operacional executa por clique
  "bat", "cmd", "ps1", "psm1", "psd1", "vbs", "vbe", "wsf", "wsh", "hta",
  "scf", "lnk", "reg", "scpt", "command",
  "sh", "bash", "zsh", "ksh", "csh", "fish",
]);

/**
 * MIME types acrescentados ao `accept` além das extensões. Sem eles, o seletor
 * de arquivos do macOS costuma DESABILITAR o .csv — em especial os salvos pelo
 * Excel, que ficam com o tipo `application/vnd.ms-excel` no sistema — porque o
 * `accept` só com extensão vira uma UTI estrita que o arquivo não bate. Os MIMEs
 * (e o `text/plain` como rede) deixam o seletor reconhecê-los. O portão de
 * verdade continua sendo a allowlist de EXTENSÃO em `assertArquivoSeguro`.
 */
const ACCEPT_MIMES = [
  "text/plain",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel", // .csv salvo pelo Excel costuma vir assim
  "text/tab-separated-values",
  "text/markdown",
  "text/html",
  "application/json",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

/** Valor do atributo `accept` do <input type=file> (hint no cliente). */
export const ACCEPT_ATTR = [...[...EXT_ACEITAS].map((e) => `.${e}`), ...ACCEPT_MIMES].join(",");

/**
 * O `accept` da superfície que aceita MÍDIA (arquivo da empresa).
 *
 * Separado de `ACCEPT_ATTR` de propósito: o seletor de arquivos do importador e
 * o dos anexos de chat continuam oferecendo exatamente o que aqueles caminhos
 * sabem processar. Como lá, isto é só HINT — o portão é `assertArquivoSeguro`.
 */
export const ACCEPT_ATTR_MIDIA = [
  ...[...EXT_ACEITAS].map((e) => `.${e}`),
  ...[...EXT_IMAGEM].map((e) => `.${e}`),
  ...[...EXT_MIDIA].map((e) => `.${e}`),
  ...ACCEPT_MIMES,
].join(",");

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
const PNG = [0x89, 0x50, 0x4e, 0x47]; // "\x89PNG"
const JPG = [0xff, 0xd8, 0xff]; // JFIF/Exif
const GIF = [0x47, 0x49, 0x46, 0x38]; // "GIF8"
const RIFF = [0x52, 0x49, 0x46, 0x46]; // "RIFF" (webp)
const WEBP = [0x57, 0x45, 0x42, 0x50]; // "WEBP" no offset 8

function comecaCom(buf: Uint8Array, sig: number[]): boolean {
  if (buf.length < sig.length) return false;
  return sig.every((b, i) => buf[i] === b);
}

/** Assinatura de imagem coerente com a extensão. */
function imagemValida(buf: Uint8Array, ext: string): boolean {
  if (ext === "png") return comecaCom(buf, PNG);
  if (ext === "jpg" || ext === "jpeg") return comecaCom(buf, JPG);
  if (ext === "gif") return comecaCom(buf, GIF);
  if (ext === "webp") return comecaCom(buf, RIFF) && buf.length >= 12 && WEBP.every((b, i) => buf[8 + i] === b);
  return false;
}

// ── Assinaturas de mídia ───────────────────────────────────────────────────
// Só o que é preciso para casar EXTENSÃO com CONTEÚDO. A função existe porque
// extensão é palpite: `virus.exe` renomeado para `treinamento.mp4` passa por
// qualquer checagem de nome e morre aqui.

const EBML = [0x1a, 0x45, 0xdf, 0xa3]; // webm/mkv
const ASF = [0x30, 0x26, 0xb2, 0x75]; // wmv/wma (GUID do cabeçalho ASF)
const OGG = [0x4f, 0x67, 0x67, 0x53]; // "OggS"
const FLAC = [0x66, 0x4c, 0x61, 0x43]; // "fLaC"
const ID3 = [0x49, 0x44, 0x33]; // "ID3" (mp3 com tag)
const SETE_Z = [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]; // 7z
const RAR = [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]; // "Rar!\x1A\x07"
const GZ = [0x1f, 0x8b];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // doc/xls/ppt antigos
const MZ = [0x4d, 0x5a]; // PE/DOS
const ELF = [0x7f, 0x45, 0x4c, 0x46];
/** Mach-O nos quatro sabores (32/64 bits, big/little endian) e o universal. */
const MACHO = [
  [0xfe, 0xed, 0xfa, 0xce],
  [0xfe, 0xed, 0xfa, 0xcf],
  [0xce, 0xfa, 0xed, 0xfe],
  [0xcf, 0xfa, 0xed, 0xfe],
  [0xca, 0xfe, 0xba, 0xbe],
];

/** Texto ASCII em um deslocamento fixo (o `ftyp` do MP4, o `ustar` do tar). */
function marcaEm(buf: Uint8Array, offset: number, texto: string): boolean {
  if (buf.length < offset + texto.length) return false;
  for (let i = 0; i < texto.length; i++) {
    if (buf[offset + i] !== texto.charCodeAt(i)) return false;
  }
  return true;
}

/** Cabeçalho RIFF com a marca do formato no byte 8 ("AVI " ou "WAVE"). */
function riffCom(buf: Uint8Array, marca: string): boolean {
  return comecaCom(buf, RIFF) && marcaEm(buf, 8, marca);
}

/**
 * O conteúdo é um executável, independentemente do nome?
 *
 * Roda ANTES da allowlist no modo `midia`. Um `.mp4` com cabeçalho PE não é um
 * vídeo, e a checagem por extensão sozinha não o pegaria se alguém acrescentasse
 * um formato novo à lista e esquecesse a assinatura dele.
 */
function assinaturaDeExecutavel(buf: Uint8Array): boolean {
  if (comecaCom(buf, MZ) || comecaCom(buf, ELF)) return true;
  return MACHO.some((sig) => comecaCom(buf, sig));
}

/**
 * Assinatura de MÍDIA coerente com a extensão.
 *
 * Falso = recusa. Nenhum ramo devolve `true` por omissão: extensão nova sem
 * assinatura aqui é recusada, que é a direção segura — o contrário deixaria a
 * lista de extensões crescer sem a conferência de conteúdo acompanhar.
 */
function midiaValida(buf: Uint8Array, ext: string): boolean {
  switch (ext) {
    // Família ISO-BMFF: a caixa `ftyp` fica no byte 4, depois do tamanho.
    case "mp4":
    case "m4v":
    case "m4a":
    case "mov":
    case "3gp":
      return marcaEm(buf, 4, "ftyp");
    case "webm":
    case "mkv":
      return comecaCom(buf, EBML);
    case "avi":
      return riffCom(buf, "AVI ");
    case "wav":
      return riffCom(buf, "WAVE");
    case "mpeg":
    case "mpg":
      // Pacote de sistema (BA) ou início de sequência de vídeo (B3).
      return buf.length >= 4 && buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && (buf[3] === 0xba || buf[3] === 0xb3);
    case "wmv":
    case "wma":
      return comecaCom(buf, ASF);
    case "mp3":
    case "aac":
      // "ID3" (com tag) ou o sync de quadro MPEG/ADTS (11 bits em 1).
      return comecaCom(buf, ID3) || (buf.length >= 2 && buf[0] === 0xff && (buf[1]! & 0xe0) === 0xe0);
    case "ogg":
    case "oga":
    case "opus":
      return comecaCom(buf, OGG);
    case "flac":
      return comecaCom(buf, FLAC);
    case "zip":
      return comecaCom(buf, ZIP);
    case "7z":
      return comecaCom(buf, SETE_Z);
    case "rar":
      return comecaCom(buf, RAR);
    case "gz":
    case "tgz":
      return comecaCom(buf, GZ);
    case "tar":
      // O tar não tem número mágico no começo: a marca "ustar" mora no byte 257.
      return marcaEm(buf, 257, "ustar");
    case "doc":
    case "xls":
    case "ppt":
      return comecaCom(buf, OLE);
    default:
      return false;
  }
}

/**
 * Valida assinatura/coerência do conteúdo — LANÇA `Error` com mensagem amigável
 * se o arquivo não for o que a extensão diz (binário disfarçado etc.). Barra o
 * ataque de "executável renomeado para .txt/.pdf".
 */
export function assertArquivoSeguro(
  buf: Uint8Array,
  name: string,
  opts?: { imagens?: boolean; midia?: boolean },
): void {
  const ext = extDe(name);

  /*
    O MODO MÍDIA, e por que ele vem antes de tudo.

    A recusa de executável precisa vir ANTES da allowlist e antes do ramo de
    imagem: `.bat` e `.sh` ESTÃO em `EXT_TEXTO` e passariam pelo caminho de
    texto, e um PE renomeado para `.png` só é pego olhando o conteúdo.

    Fora do modo mídia nada disto roda, e é por isso que o importador e os
    anexos de chat não mudam de comportamento: para eles o `.bat` continua
    sendo texto inerte que vira documentação.
  */
  if (opts?.midia) {
    if (EXT_EXECUTAVEL.has(ext)) {
      throw new Error(
        `Executável ou script de sistema não pode ser anexado (.${ext}): ele ficaria disponível para download ` +
          `aos seus usuários pelo assistente. Envie o documento ou a mídia correspondente.`,
      );
    }
    if (assinaturaDeExecutavel(buf)) {
      throw new Error(
        "O conteúdo deste arquivo é um programa executável, seja qual for o nome dele. " +
          "Envie o documento ou a mídia correspondente.",
      );
    }
  }

  // Mensagem amigável ANTES da allowlist para o PPT antigo (binário OLE). No
  // modo mídia o `.ppt` é ACEITO — para download, nunca para a base de
  // conhecimento —, então a mensagem que manda converter não se aplica.
  if (ext === "ppt" && !opts?.midia) {
    throw new Error("PPT antigo não é suportado — salve como .pptx e anexe de novo.");
  }
  // Imagens: só quando o chamador permite (anexos de chat → modelo com visão;
  // arquivo da empresa → download). Ficam antes da allowlist de documentos,
  // que não as inclui.
  if ((EXT_IMAGEM as readonly string[]).includes(ext)) {
    if (!opts?.imagens && !opts?.midia) throw new Error(`Tipo de arquivo não permitido (.${ext}).`);
    if (buf.length > MAX_UPLOAD_BYTES) throw new Error("Arquivo muito grande.");
    if (!imagemValida(buf, ext)) throw new Error("Imagem corrompida ou em formato não suportado.");
    return;
  }
  // Mídia (vídeo, áudio, compactado, Office antigo): download apenas.
  if (opts?.midia && EXT_MIDIA.has(ext)) {
    if (buf.length > MAX_UPLOAD_BYTES) throw new Error("Arquivo muito grande.");
    if (!midiaValida(buf, ext)) {
      throw new Error(`Este arquivo não parece um .${ext} de verdade — confira o arquivo e envie de novo.`);
    }
    return;
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
