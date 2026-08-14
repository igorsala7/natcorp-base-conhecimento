/**
 * O DADO É DE QUEM FOI PEDIDO?
 *
 * Duas vezes em dois dias o agente consultou com a matrícula errada e entregou,
 * bem formatada, a vida funcional de outra pessoa. Na segunda ele anunciou "vou
 * trazer o histórico do TONY OLIVEIRA", os dados voltaram de SIDNEI CARVALHO —
 * e ele apresentou Sidnei, trocando o titular no meio da própria resposta.
 *
 * O retorno TRAZIA o nome. Faltava alguém comparar.
 *
 * Isto é uma checagem de SERVIDOR, não uma regra de prompt: o modelo não precisa
 * obedecer, ele recebe o resultado já marcado como divergente. Regra ajuda;
 * verificação garante.
 *
 * Puro e sem IO.
 */

const CAMPOS_NOME = ["nome", "colaborador", "nome_colaborador", "nome_funcionario", "funcionario", "nome_social"];

/** Sem acento, sem pontuação, minúsculo, espaço único. */
export function normalizarNome(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Palavras que parecem nome mas são cargo, tratamento ou ruído da pergunta. */
const RUIDO = new Set([
  "dr", "dra", "sr", "sra", "doutor", "doutora", "senhor", "senhora",
  "de", "da", "do", "dos", "das", "e", "o", "a", "os", "as",
  "qual", "quais", "como", "quanto", "quantos", "historico", "cargos", "salarios",
  "avaliacoes", "feedbacks", "ferias", "colaborador", "funcionario", "matricula",
]);

/**
 * Nomes citados na pergunta.
 *
 * Heurística deliberadamente ESTREITA: dois ou mais tokens seguidos começando em
 * maiúscula. "Tony Oliveira" entra; "Tony" sozinho não, e é intencional —
 * primeiro nome isolado gera homônimo, e um alarme falso que trava a resposta
 * seria pior que o problema.
 */
export function nomesNaPergunta(texto: string): string[] {
  const achados: string[] = [];
  const rx = /\b([A-ZÀ-Þ][\wÀ-ÿ]+(?:\s+(?:d[aeo]s?\s+)?[A-ZÀ-Þ][\wÀ-ÿ]+)+)/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(String(texto ?? ""))) !== null) {
    const n = normalizarNome(m[1]);
    const toks = n.split(" ").filter((t) => !RUIDO.has(t));
    if (toks.length >= 2) achados.push(toks.join(" "));
  }
  return [...new Set(achados)];
}

/** O nome que veio no registro, se houver algum campo de nome. */
export function nomeDoRegistro(linha: unknown): string | null {
  if (!linha || typeof linha !== "object") return null;
  const o = linha as Record<string, unknown>;
  for (const c of CAMPOS_NOME) {
    const v = o[c];
    if (typeof v === "string" && v.trim().length > 2) return normalizarNome(v);
  }
  return null;
}

/** Colhe os nomes de um retorno de ferramenta, seja lista, envelope ou objeto. */
export function nomesNoRetorno(dados: unknown, max = 50): string[] {
  const linhas: unknown[] = Array.isArray(dados)
    ? dados
    : dados && typeof dados === "object"
      ? (() => {
          for (const k of ["items", "itens", "dados", "rows", "registros"]) {
            const v = (dados as Record<string, unknown>)[k];
            if (Array.isArray(v)) return v;
          }
          return [dados];
        })()
      : [];
  const out = new Set<string>();
  for (const l of linhas.slice(0, max)) {
    const n = nomeDoRegistro(l);
    if (n) out.add(n);
  }
  return [...out];
}

/** Um nome contém o outro em tokens? ("tony oliveira" ≈ "tony de oliveira silva") */
function combina(a: string, b: string): boolean {
  const ta = a.split(" ").filter((t) => !RUIDO.has(t));
  const tb = b.split(" ").filter((t) => !RUIDO.has(t));
  if (ta.length === 0 || tb.length === 0) return false;
  const [curto, longo] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return curto.every((t) => longo.includes(t));
}

export type Divergencia = { pedido: string; veio: string[] };

/**
 * Retorna a divergência quando a pergunta nomeou alguém e NENHUM registro é
 * dessa pessoa.
 *
 * `null` (tudo bem) em todos os casos duvidosos: pergunta sem nome, retorno sem
 * campo de nome, retorno vazio. Uma checagem que trava no incerto seria pior que
 * o defeito — a maioria das consultas é legítima e não menciona nome nenhum.
 */
export function conferirTitular(pergunta: string, dados: unknown): Divergencia | null {
  const pedidos = nomesNaPergunta(pergunta);
  if (pedidos.length === 0) return null;
  const vieram = nomesNoRetorno(dados);
  if (vieram.length === 0) return null;
  // Basta UM pedido bater: "férias do Tony Oliveira e da Ana Silva" traz os dois.
  const bateu = pedidos.some((p) => vieram.some((v) => combina(p, v)));
  if (bateu) return null;
  return { pedido: pedidos[0]!, veio: vieram.slice(0, 3) };
}

/** O aviso que vai NO RESULTADO — o modelo o lê junto com os dados. */
export function avisoDivergencia(d: Divergencia): string {
  return (
    `ATENÇÃO — TITULAR DIVERGENTE. A pergunta é sobre "${d.pedido}", mas este resultado é de ` +
    `"${d.veio.join('", "')}". A matrícula usada NÃO é da pessoa pedida. ` +
    `NÃO apresente estes dados, NÃO troque o nome da resposta para o que veio aqui. ` +
    `Diga que precisa confirmar a matrícula, busque a pessoa pelo nome no cadastro e refaça a consulta.`
  );
}
