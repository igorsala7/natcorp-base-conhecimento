/**
 * A parte PURA da releitura dos arquivos gerados na conversa.
 *
 * Mora fora de `arquivos-conversa.ts` pelo mesmo motivo que `chunk-split.ts`
 * saiu do módulo de chunking: o irmão importa `server-only` e o admin client,
 * que lê env na CARGA do módulo. Quem importasse isto para testar levava junto
 * a validação de env e o teste morria antes da primeira asserção — foi assim
 * que a função mais importante da busca ficou sem um único teste.
 */

export type ArquivoGerado = {
  filename: string;
  mimeType: string;
  /** Caminho no bucket `chat-media`. Não é URL: a assinada é de curta duração. */
  path: string;
  criadoEm: string;
};

/**
 * Teto de arquivos oferecidos ao modelo. A lista vai INTEIRA para a descrição
 * da ferramenta, então crescer sem limite encarece todo turno da conversa — e
 * uma lista longa piora a escolha em vez de melhorar.
 */
export const MAX_ARQUIVOS = 12;

export type LinhaMedia = { media: unknown; created_at: string | null };

/**
 * Extrai os arquivos das linhas de `messages`, do mais recente para o mais
 * antigo.
 *
 * Deduplica por nome mantendo o MAIS RECENTE: regerar o relatório com o mesmo
 * título é rotina (o usuário ajusta e pede de novo), e oferecer as versões
 * antigas junto só dá ao modelo uma escolha que ele não tem como fazer certo.
 */
export function extrairArquivosDeMensagens(linhas: LinhaMedia[]): ArquivoGerado[] {
  const achados: ArquivoGerado[] = [];
  for (const linha of linhas) {
    if (!Array.isArray(linha.media)) continue;
    for (const item of linha.media) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      // `kind: "chart"` é spec inline, não arquivo — não se anexa a e-mail.
      if (o.kind !== "file" || typeof o.path !== "string") continue;
      achados.push({
        filename: String(o.filename ?? "arquivo"),
        mimeType: String(o.mimeType ?? "application/octet-stream"),
        path: o.path,
        criadoEm: linha.created_at ?? "",
      });
    }
  }
  achados.sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : a.criadoEm > b.criadoEm ? -1 : 0));
  const porNome = new Map<string, ArquivoGerado>();
  for (const a of achados) if (!porNome.has(a.filename)) porNome.set(a.filename, a);
  return [...porNome.values()].slice(0, MAX_ARQUIVOS);
}
