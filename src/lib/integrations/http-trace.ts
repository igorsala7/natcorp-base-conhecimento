/**
 * Rastro reproduzível de uma chamada HTTP: o cURL equivalente e o resumo do que
 * voltou.
 *
 * Motivo concreto: a validação de login da Stefanini falhava, e o log dizia
 * apenas "sem_resposta_login". A causa real — `ORA-00942: a tabela ou view não
 * existe` — vinha NO CORPO da resposta, que era descartado antes de qualquer um
 * poder ler. Descobrir isso exigiu reproduzir a chamada à mão, com o segredo
 * decifrado do banco. Este módulo existe para que a próxima vez seja copiar uma
 * linha do log e colar no terminal.
 *
 * PURO e testável: quem faz I/O é quem chama.
 */

/** Valores a esconder (segredos concretos, não nomes de campo). */
export type Redacoes = (string | null | undefined)[];

/**
 * Troca segredos por `***`. Trabalha por VALOR, não por nome de campo: o mesmo
 * segredo aparece na URL, no cabeçalho e no corpo com nomes diferentes, e
 * redigir por nome deixa escapar justamente a cópia que ninguém previu.
 *
 * Ignora valores curtos: um segredo de 3 caracteres não existe, mas "ok" ou "1"
 * apareceriam no meio de qualquer palavra e destruiriam o texto.
 */
export function redigir(texto: string, segredos: Redacoes): string {
  let out = texto;
  for (const s of segredos) {
    const v = String(s ?? "").trim();
    if (v.length < 8) continue;
    out = out.split(v).join("***");
  }
  return out;
}

export type ReqTrace = {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string | null;
};

/**
 * cURL equivalente, pronto para colar no terminal.
 *
 * O `Authorization` sai sempre redigido, mesmo que ninguém o liste em
 * `segredos`: é o cabeçalho que mais vaza em cópia de log, e o token é
 * descartável (dura minutos) — quem for reproduzir gera outro.
 */
export function montarCurl(req: ReqTrace, segredos: Redacoes = []): string {
  const partes: string[] = [`curl -i -X ${req.method.toUpperCase()}`];
  partes.push(`'${redigir(req.url, segredos).replace(/'/g, "'\\''")}'`);
  for (const [k, v] of Object.entries(req.headers ?? {})) {
    const valor = /^authorization$/i.test(k) ? `${String(v).split(" ")[0]} ***` : redigir(String(v), segredos);
    partes.push(`-H '${k}: ${valor.replace(/'/g, "'\\''")}'`);
  }
  if (req.body) {
    partes.push(`--data '${redigir(req.body, segredos).replace(/'/g, "'\\''")}'`);
  }
  return partes.join(" ");
}

/** Erros de banco que o ORDS devolve dentro de uma página HTML. */
const RX_ORACLE = /\b(?:ORA|PLS|SP2)-\d{3,5}[^<\n\r]{0,200}/g;

/**
 * Resumo do corpo de uma resposta de erro.
 *
 * Uma falha de ORDS chega como ~40 KB de HTML com CSS e um logo em SVG; a única
 * linha que importa está enterrada no meio. Guardar tudo inflaria o log e ainda
 * assim ninguém acharia a causa. Guardar os primeiros 200 caracteres — a saída
 * óbvia — pegaria só a folha de estilo.
 *
 * Então: se houver erro Oracle, são ELES o resumo. Senão, o texto sem marcação.
 */
export function resumirCorpoErro(corpo: string | null | undefined, teto = 600): string {
  const bruto = String(corpo ?? "");
  if (!bruto.trim()) return "";

  const oracle = [...bruto.matchAll(RX_ORACLE)].map((m) => m[0].trim());
  if (oracle.length) {
    // `Set` porque o ORDS repete o mesmo ORA- em cada nível da pilha.
    return [...new Set(oracle)].join(" | ").slice(0, teto);
  }

  const semMarcacao = bruto
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:quot|apos|amp|lt|gt|nbsp|#\d+);/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return semMarcacao.slice(0, teto);
}

/** Uma chamada inteira, do jeito que vai para o log. */
export type ChamadaTrace = {
  curl: string;
  status: number;
  ms: number;
  resposta: string;
};

export function montarTrace(
  req: ReqTrace,
  res: { status: number; corpo: string | null | undefined },
  ms: number,
  segredos: Redacoes = [],
): ChamadaTrace {
  return {
    curl: montarCurl(req, segredos),
    status: res.status,
    ms,
    // A resposta também passa pela redação: uma API que devolve a chave enviada
    // — mais comum do que deveria — vazaria o segredo pelo log.
    resposta: redigir(resumirCorpoErro(res.corpo), segredos),
  };
}
