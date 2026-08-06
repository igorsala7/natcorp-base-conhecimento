/**
 * ACHATA o resultado de um LOOP de integração (mês a mês, por valor, por lote).
 *
 * Problema que isto resolve: o loop devolvia `{ itens: [{ valor, dados: {…} }] }`.
 * O registro de datasets encontrava a chave `itens` e criava um dataset de DUAS
 * colunas — `valor` e `dados` —, com `dados` reduzido a um JSON truncado em 200
 * caracteres. As ferramentas de consulta então filtravam, contavam e somavam em
 * cima desse texto truncado, e o número saía errado sem ninguém perceber. O loop
 * `month` era pior ainda: devolvia `{ meses: [...] }`, chave que o registro nem
 * reconhecia — o resultado mês a mês simplesmente não era consultável.
 *
 * A correção é na ORIGEM: se todas as iterações trouxeram listas de registros,
 * devolvemos UMA lista achatada com o rótulo do loop como coluna extra. As
 * iterações que falharam (erro/objeto solto) vão para `_falhas` — antes sumiam.
 *
 * Puro (sem IO): testável direto.
 */

/** Uma iteração do loop: o rótulo (mês/valor/lote) e o que a API devolveu. */
export type IteracaoLoop = { rotulo: string; dados: unknown };

/** Nome de coluna legível para o parâmetro do loop (`cod_empresa` → "Cod empresa"). */
export function rotuloDoLoop(param: string): string {
  const conhecidos: Record<string, string> = {
    matricula: "Matrícula", cod_empresa: "Empresa", empresa: "Empresa",
    cod_filial: "Filial", filial: "Filial", competencia: "Competência",
    cod_cargo: "Cargo", centro_custo: "Centro de custo", cod_vinculo: "Vínculo",
  };
  const k = String(param ?? "").trim().toLowerCase();
  if (conhecidos[k]) return conhecidos[k];
  const legivel = k.replace(/^(cod|ds|vl|dt|nr)_/, "").replace(/_/g, " ").trim();
  return legivel ? legivel.charAt(0).toUpperCase() + legivel.slice(1) : "Valor";
}

export type LoopAchatado =
  | { achatou: true; itens: Record<string, unknown>[]; total: number; falhas: { rotulo: string; motivo: string }[] }
  | { achatou: false; falhas: { rotulo: string; motivo: string }[] };

/** Chaves em que uma API costuma pendurar a lista de registros. */
const CHAVES_LISTA = ["items", "itens", "data", "dados", "rows", "registros", "result", "results", "lista"];

/** É uma "linha" (objeto simples), não um escalar nem um array? */
function ehLinha(v: unknown): boolean {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Extrai a lista de registros de um retorno de API (topo ou chave conhecida). */
export function listaDeRegistros(dados: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(dados)) {
    const linhas = dados.filter(ehLinha) as Record<string, unknown>[];
    return linhas.length ? linhas : null;
  }
  if (!ehLinha(dados)) return null;
  const o = dados as Record<string, unknown>;
  for (const k of CHAVES_LISTA) {
    const v = o[k];
    if (Array.isArray(v)) {
      const linhas = v.filter(ehLinha) as Record<string, unknown>[];
      if (linhas.length) return linhas;
    }
  }
  // Sem lista, mas com campos escalares: é UMA linha. Cobre o caso comum de um
  // agregado por iteração ("total do mês"), que senão não viraria dataset nenhum.
  if (typeof o.erro === "string" || o._sem_dados === true) return null;
  const escalares = Object.entries(o).filter(([k, v]) => !k.startsWith("_") && (v == null || typeof v !== "object"));
  return escalares.length ? [Object.fromEntries(escalares)] : null;
}

/** Motivo da falha, quando a iteração não trouxe registros. */
function motivoFalha(dados: unknown): string {
  if (ehLinha(dados)) {
    const o = dados as Record<string, unknown>;
    if (typeof o.erro === "string") return o.erro;
    if (o._sem_dados === true) return "zero registros";
  }
  if (Array.isArray(dados) && dados.length === 0) return "zero registros";
  return "sem lista de registros no retorno";
}

/**
 * Junta as iterações numa lista só, com `coluna` (ex.: "Competência") marcando de
 * qual iteração veio cada linha. Só achata quando ao menos uma iteração trouxe
 * registros — senão devolve `achatou:false` e o chamador mantém o formato antigo.
 *
 * `teto` protege o contexto: o registro de datasets guarda tudo, mas uma lista
 * absurda ainda passaria pelo `JSON.stringify` da rede de segurança.
 */
export function achatarLoop(iteracoes: IteracaoLoop[], coluna: string, teto = 20_000): LoopAchatado {
  const itens: Record<string, unknown>[] = [];
  const falhas: { rotulo: string; motivo: string }[] = [];
  for (const it of iteracoes) {
    const linhas = listaDeRegistros(it.dados);
    if (!linhas) { falhas.push({ rotulo: it.rotulo, motivo: motivoFalha(it.dados) }); continue; }
    // O rótulo vem PRIMEIRO: vira a 1ª coluna do dataset e do arquivo exportado.
    for (const l of linhas) {
      if (itens.length >= teto) break;
      itens.push({ [coluna]: it.rotulo, ...l });
    }
  }
  if (!itens.length) return { achatou: false, falhas };
  return { achatou: true, itens, total: itens.length, falhas };
}
