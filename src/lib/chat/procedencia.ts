/**
 * IDENTIFICADOR DE PESSOA PRECISA TER PROCEDÊNCIA.
 *
 * O modelo escreveu "Encontrei! TONY OLIVEIRA tem a matrícula 269084" e chamou
 * seis ferramentas com esse número. Conferido contra a API: 269084 **não existe
 * em nenhum campo de nenhum dos 96 registros** da filial — não é cod_candidato,
 * não é centro de custo, não é de outro colaborador. Foi inventado, e narrado
 * como se fosse resultado de consulta (14/08/2026).
 *
 * Regra de prompt não cobre isto: ela depende de o modelo ser honesto sobre uma
 * consulta que ele acha que fez. Aqui a verificação é do servidor e é binária —
 * o número está entre os dados que passaram por este turno, ou a chamada não sai.
 *
 * ── As três procedências legítimas ──────────────────────────────────────────
 *   · apareceu em algum RESULTADO deste turno (inclusive tabelas da tela);
 *   · é a matrícula de QUEM PERGUNTA (consulta dos próprios dados);
 *   · a pessoa DIGITOU o número na mensagem.
 *
 * Fora disso é invenção — e invenção que "funciona" é a pior, porque devolve
 * dados verdadeiros da pessoa errada.
 *
 * Puro e sem IO.
 */

/** Parâmetros que identificam PESSOA. `_user` fica de fora: é a identidade. */
const RX_PESSOA = /(^|_)(matricula|mat_alvo|cod_candidato|cod_paciente|cpf)$/i;

export function ehParamDePessoa(nome: string): boolean {
  const n = String(nome ?? "").toLowerCase();
  if (/_user$|solicitante|aprov/.test(n)) return false;
  return RX_PESSOA.test(n);
}

/** Só dígitos — compara 000123, "123" e 123 como o mesmo número. */
export function normalizarId(v: unknown): string {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.replace(/^0+/, "") || d;
}

export type FonteDeIds = {
  /** Linhas de todos os datasets do turno (resultados de ferramenta + tabelas da tela). */
  linhas: Record<string, unknown>[];
  /** Identidade de quem pergunta. */
  identidade: (string | null | undefined)[];
  /** Texto que a pessoa escreveu neste turno e nos anteriores. */
  texto: string;
  /**
   * Identificadores que passaram por TURNOS ANTERIORES desta conversa.
   *
   * Sem isto, encadear era impossível: "quais colaboradores do meu centro de
   * custo" trazia 15 matrículas, e "quais deles estão de férias" era RECUSADA —
   * os datasets são por turno, então na pergunta seguinte aqueles números já não
   * tinham procedência. Visto em produção (19/08/2026): o agente foi barrado,
   * tentou de novo com lista vazia e respondeu com os dados de uma pessoa só.
   * Para quem usava, ele "se perdeu".
   *
   * Vem de `idsParaProcedencia`, que extrai dos DADOS (resultado de API, tabela
   * da tela) — nunca do texto da resposta anterior. A distinção é o guard
   * inteiro: o incidente que o criou foi o modelo ESCREVER uma matrícula
   * inventada e consultá-la. Texto que o modelo produziu não é procedência.
   */
  idsAnteriores?: ReadonlySet<string>;
};

/**
 * O identificador tem procedência?
 *
 * Varre TODOS os valores das linhas, não só as colunas com cara de matrícula: o
 * número pode ter vindo de `cod_candidato` numa consulta anterior e ser
 * legítimo. O que se quer barrar é o número que não veio de lugar nenhum.
 */
export function temProcedencia(valor: unknown, fonte: FonteDeIds): boolean {
  const alvo = normalizarId(valor);
  if (!alvo || alvo.length < 3) return true; // curto demais para ser invenção perigosa

  for (const id of fonte.identidade) {
    if (id && normalizarId(id) === alvo) return true;
  }
  // Dígitos que a pessoa escreveu — inclusive com pontuação de CPF.
  for (const m of String(fonte.texto ?? "").matchAll(/\d[\d.\-/]{2,}/g)) {
    if (normalizarId(m[0]) === alvo) return true;
  }
  for (const linha of fonte.linhas) {
    for (const v of Object.values(linha)) {
      if (v == null) continue;
      const t = typeof v;
      if (t !== "string" && t !== "number") continue;
      if (normalizarId(v) === alvo) return true;
    }
  }
  // Turnos anteriores da MESMA conversa — só o que veio de dados reais.
  return fonte.idsAnteriores?.has(alvo) === true;
}

/** Teto de identificadores guardados por turno. Metadado, não arquivo. */
const MAX_IDS_TURNO = 400;
/** Comprimento plausível de matrícula/CPF, já normalizado (só dígitos). */
const MIN_DIGITOS = 3;
const MAX_DIGITOS = 14;

/**
 * Os identificadores de um turno, para a conversa seguinte poder encadear.
 *
 * Varre TODOS os valores das linhas, como `temProcedencia` faz — restringir às
 * colunas com cara de matrícula deixaria de fora justamente o caso real, em que
 * o número aparece numa coluna de nome inesperado.
 *
 * Guarda só o que TEM FORMA de identificador de pessoa (3 a 14 dígitos): sem
 * esse filtro, um dataset de 400 linhas × 20 colunas viraria 8 mil valores em
 * `messages.payload`, em toda mensagem — o metadado ficaria maior que a
 * mensagem.
 */
export function idsParaProcedencia(
  linhas: Record<string, unknown>[],
  max = MAX_IDS_TURNO,
): string[] {
  const out = new Set<string>();
  for (const linha of linhas) {
    for (const v of Object.values(linha)) {
      if (v == null) continue;
      const t = typeof v;
      if (t !== "string" && t !== "number") continue;
      // Texto com letras não é identificador — evita guardar nome e endereço.
      if (t === "string" && /[a-zA-ZÀ-ÿ]/.test(v as string)) continue;
      const id = normalizarId(v);
      if (id.length < MIN_DIGITOS || id.length > MAX_DIGITOS) continue;
      out.add(id);
      if (out.size >= max) return [...out];
    }
  }
  return [...out];
}

/**
 * Qual ferramenta do turno resolve NOME → matrícula.
 *
 * A recusa precisa dizer O QUE FAZER com nome próprio, não "consulte o
 * cadastro": instrução genérica é instrução que o modelo interpreta, e ele já
 * mostrou o que faz quando interpreta. Se nenhuma resolvedora sobrou no turno
 * (o teto de ferramentas é 6), a recusa diz isso — melhor admitir que não dá do
 * que mandar chamar algo que não está lá.
 */
export function resolvedoraDeNome(disponiveis: string[]): string | null {
  const ordem = [/informacoes_pessoais_funcionais_resumido/, /informacoes_pessoais_funcionais/, /colaborador/, /pessoa/];
  for (const rx of ordem) {
    const achou = disponiveis.find((k) => rx.test(k));
    if (achou) return achou;
  }
  return null;
}

/** A recusa que volta ao modelo no lugar do resultado. */
export function recusaSemProcedencia(
  param: string,
  valor: unknown,
  disponiveis: string[] = [],
): Record<string, unknown> {
  const resolvedora = resolvedoraDeNome(disponiveis);
  const comoResolver = resolvedora
    ? `Se a pessoa foi citada pelo NOME, chame "${resolvedora}" filtrando pela empresa/filial dela, ache o ` +
      `registro cujo nome corresponde e use a MATRÍCULA que vier ali. Só então refaça esta consulta.`
    : `Nenhuma ferramenta de cadastro está disponível neste turno para achar a matrícula pelo nome. ` +
      `Diga isso à pessoa e PEÇA a matrícula — não tente adivinhar.`;
  return {
    _recusado: true,
    _erro:
      `O valor "${String(valor)}" informado em "${param}" NÃO veio de nenhuma consulta deste turno, ` +
      `nem da identidade de quem perguntou, nem do que a pessoa escreveu. A chamada foi BLOQUEADA. ` +
      `Não repita este número. ${comoResolver} ` +
      `Nunca deduza nem componha um identificador: um número inventado que por acaso exista devolve ` +
      `dados verdadeiros da pessoa errada.`,
  };
}
