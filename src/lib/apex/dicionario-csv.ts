import { parseCsv, detectarDelim } from "@/lib/importer/extract-csv";

/**
 * DICIONÁRIO DE DADOS A PARTIR DE UM CSV.
 *
 * As duas ingestões que existiam — APEX e banco — pedem um JSON gerado por
 * package PL/SQL. Elas cobrem muito, mas exigem acesso ao banco do cliente e
 * uma rodada de DBA para cada base. Um CSV de tabelas e colunas é o que
 * qualquer pessoa consegue exportar de qualquer lugar: do próprio Oracle, de
 * uma planilha de levantamento, ou do modelo de dados que já existe em papel.
 *
 * Ele também cobre o buraco encontrado no `f200.json`: os labels do APEX vivem
 * nas colunas de relatório, que NÃO sabem a tabela de origem. Nenhum
 * `DB_TABLE_NAME` daquele arquivo menciona `FILIAL` ou `CENTRO_DE_CUSTO` — e
 * era justamente `CENTRO_DE_CUSTO.COD` que se queria ensinar ao assistente.
 * O CSV afirma o que o metadado do APEX só insinua.
 *
 * ── Cabeçalhos flexíveis, de propósito ─────────────────────────────────────
 * Quem exporta do SQL Developer recebe `TABLE_NAME`/`COLUMN_NAME`; quem monta
 * na mão escreve `tabela`/`coluna`. Exigir um nome exato transformaria a
 * primeira tentativa numa mensagem de erro, e a segunda numa edição manual do
 * arquivo. Reconhecer os dois custa dez linhas.
 *
 * Puro e sem IO — daí ser testável sem banco.
 */

export type LinhaDicionario = {
  tabela: string;
  coluna: string;
  label: string | null;
  descricao: string | null;
  tipo: string | null;
};

export type ResultadoCsv = {
  linhas: LinhaDicionario[];
  /** Cabeçalhos que o arquivo trouxe e não foram usados — some no `ignoradas`. */
  ignoradas: string[];
  /** Linhas descartadas por não ter tabela ou coluna. */
  descartadas: number;
};

/** Sem acento, minúsculo, sem separador — "Nome da Tabela" ≡ "nome_da_tabela". */
function chave(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Sinônimos por campo. A ORDEM importa: o primeiro que casar vence, e os mais
 * específicos vêm antes — `nomedacoluna` antes de `nome`, senão uma planilha
 * com as duas colunas mapearia a errada.
 */
const SINONIMOS: Record<keyof LinhaDicionario, string[]> = {
  tabela: ["tablename", "tabela", "nomedatabela", "table", "objeto", "entidade"],
  coluna: ["columnname", "coluna", "nomedacoluna", "column", "campo", "field", "atributo"],
  label: ["label", "rotulo", "titulo", "descricaocurta", "nomeamigavel", "aliasexibicao", "reportlabel", "formlabel"],
  descricao: ["comments", "comentario", "descricao", "description", "observacao", "significado", "comentarios"],
  tipo: ["datatype", "tipo", "type", "tipodado", "tipodedados"],
};

function acharColuna(cabecalho: string[], campo: keyof LinhaDicionario): number {
  const normalizado = cabecalho.map(chave);
  for (const alvo of SINONIMOS[campo]) {
    const i = normalizado.indexOf(alvo);
    if (i >= 0) return i;
  }
  return -1;
}

export function lerDicionarioCsv(texto: string): ResultadoCsv {
  // `""` como extensão: quem cola no textarea não tem arquivo, e a detecção
  // por conteúdo cobre vírgula, ponto e vírgula e tabulação.
  const linhas = parseCsv(texto, detectarDelim(texto, ""));
  if (linhas.length < 2) return { linhas: [], ignoradas: [], descartadas: 0 };

  const cabecalho = linhas[0]!;
  const idx = {
    tabela: acharColuna(cabecalho, "tabela"),
    coluna: acharColuna(cabecalho, "coluna"),
    label: acharColuna(cabecalho, "label"),
    descricao: acharColuna(cabecalho, "descricao"),
    tipo: acharColuna(cabecalho, "tipo"),
  };
  // Sem tabela e coluna não há dicionário — é o par que dá endereço ao dado.
  if (idx.tabela < 0 || idx.coluna < 0) return { linhas: [], ignoradas: cabecalho, descartadas: 0 };

  const usadas = new Set(Object.values(idx).filter((i) => i >= 0));
  const ignoradas = cabecalho.filter((_, i) => !usadas.has(i)).filter(Boolean);

  const out: LinhaDicionario[] = [];
  let descartadas = 0;
  const vistos = new Set<string>();

  for (const l of linhas.slice(1)) {
    const pega = (i: number) => (i >= 0 ? (l[i] ?? "").trim() : "");
    // Tabela e coluna em MAIÚSCULA: é como o Oracle as guarda, e é o que faz
    // "centro_de_custo" e "CENTRO_DE_CUSTO" virarem o mesmo endereço.
    const tabela = pega(idx.tabela).toUpperCase();
    const coluna = pega(idx.coluna).toUpperCase();
    if (!tabela || !coluna) {
      descartadas++;
      continue;
    }
    // Repetição no mesmo arquivo é comum quando a exportação junta views e
    // tabelas; a primeira ocorrência vence.
    const id = `${tabela}.${coluna}`;
    if (vistos.has(id)) continue;
    vistos.add(id);

    out.push({
      tabela,
      coluna,
      label: pega(idx.label) || null,
      descricao: pega(idx.descricao) || null,
      tipo: pega(idx.tipo) || null,
    });
  }

  return { linhas: out, ignoradas, descartadas };
}
