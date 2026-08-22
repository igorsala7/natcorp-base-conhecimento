/**
 * O CATÁLOGO COBRE O ASSUNTO PEDIDO? — e, se não cobre, sai da frente.
 *
 * O caso que originou este módulo, medido em 21/08/2026 com o catálogo real:
 *
 *   "Me retorne os atestados do colaborador 23087"
 *      1º  0.686  consultar_feedback
 *      2º  0.675  informacoes_pessoais_funcionais
 *      3º  0.669  relatorio_espelho_ponto
 *
 * Não existe ferramenta de atestado na base — e o assistente entregava feedback.
 * Pior: com CONFIANÇA, porque 0.686 está acima do piso `MIN_SEM` (0,60).
 *
 * ── Por que a similaridade não podia resolver isto ──────────────────────────
 * Comparando dois turnos reais:
 *
 *   "quero ver as férias do 205818"      topo 0.647  →  ferramenta CERTA
 *   "atestados do colaborador 23087"     topo 0.686  →  ferramenta ERRADA
 *
 * A errada pontua MAIS ALTO que a certa. Embedding mede proximidade de DOMÍNIO,
 * não de assunto: qualquer frase sobre um colaborador de RH passa de 0,60. Um
 * piso absoluto sobre essa grandeza não separa acerto de erro, e é por isso que
 * o alerta de seleção fraca disparava em 7,8% dos turnos sem pegar este.
 *
 * ── Três heurísticas testadas e derrubadas antes desta ──────────────────────
 * 1. ÂNCORA LEXICAL (algum termo da pergunta aparece no texto de alguma tool):
 *    turnos sem âncora usam ferramenta a 22%, com âncora a 21% — sinal ZERO.
 * 2. A mesma, restrita a perguntas autônomas: 35% de falso alarme. Quebra em
 *    "Quais são os dados do Tony Oliveira?" (nome próprio) e "os colaboradores
 *    que eu lidero" (verbo fora do catálogo).
 * 3. COERÊNCIA DO TOPO (as candidatas falam entre si?): acerta "atestados" (0%)
 *    e erra "quanto recebeu em março" (também 0%, e ali a ferramenta existe).
 *
 * As três falham porque a pergunta "este catálogo cobre este assunto?" é
 * semântica, e nenhuma delas lê significado. O modelo barato lê: 9 de 10 no
 * conjunto de checagem, incluindo o "atestados" que as três erraram.
 *
 * ── O que fazer quando não cobre ────────────────────────────────────────────
 * Regra do dono, 21/08/2026: "sem tool, prioritariamente buscar da
 * documentação, nem precisa dizer que não encontrou ferramenta". Então o
 * desfecho é CORTAR as ferramentas do turno e deixar o RAG responder — não
 * anunciar ausência. O usuário não precisa saber como o cardápio é montado.
 *
 * ── Por que este arquivo é PURO ─────────────────────────────────────────────
 * O tipo e o prompt ficam separados da chamada ao modelo (`cobertura.ts`) pelo
 * mesmo motivo de `module-match` × `module-select` e `guard-catalog` × `guards`:
 * o prompt é a parte que se erra, e testá-lo não pode exigir chave de provedor
 * nem variável de ambiente. A primeira versão dele reprovava "marcações de
 * ponto DA MINHA EQUIPE" por confundir recorte com assunto — defeito de texto,
 * pego por leitura, não por execução.
 */
/** O mínimo que o classificador precisa saber de cada candidata. */
export type CandidataCobertura = { key: string; name: string; description?: string | null };

export type Cobertura = {
  /** `false` = nenhuma candidata trata do assunto; o turno vira documentação. */
  cobre: boolean;
  /** Chave da que cobre, quando o modelo aponta uma. Só diagnóstico. */
  qual: string | null;
  /** Não deu para decidir (sem chave, timeout, erro) — o turno segue como antes. */
  indefinido: boolean;
};

const MAX_CANDIDATAS = 6;
const MAX_DESC = 150;

/** Monta o prompt. Separado para ser inspecionável em teste sem chamar modelo. */
export function promptDeCobertura(pergunta: string, candidatas: readonly CandidataCobertura[]): string {
  const lista = candidatas
    .slice(0, MAX_CANDIDATAS)
    .map((t, i) => `${i + 1}. ${t.name} — ${String(t.description ?? "").replace(/\s+/g, " ").slice(0, MAX_DESC)}`)
    .join("\n");
  return `Assistente de RH. Pedido do usuário:
"${pergunta}"

Ferramentas disponíveis:
${lista}

Alguma dessas ferramentas trata do ASSUNTO pedido?
- true se alguma cobre o assunto, MESMO que o pedido acrescente um recorte (uma pessoa, um período, uma equipe) — recorte é parâmetro, não assunto diferente.
- false quando NENHUMA trata do assunto pedido, ainda que todas sejam de RH. Ex.: pedir ATESTADO e só existirem ferramentas de feedback, ponto e cadastro → false.
- false quando o pedido é sobre NORMA, POLÍTICA ou COMO FAZER (documentação), não sobre dados.
"qual" = número da ferramenta que cobre, ou null.`;
}
