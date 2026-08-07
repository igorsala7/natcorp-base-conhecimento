/**
 * PISO de vocabulário de RH brasileiro.
 *
 * O sistema não tinha nenhum termo de domínio próprio: numa base sem ontologia
 * cadastrada, "holerite", "espelho de ponto" e "aquisitivo" não casavam com nada — e
 * é exatamente o vocabulário que o analista, o gestor e o colaborador usam.
 *
 * É PISO, nunca substituto: a ontologia do cliente sempre vence. Ver `mesclarPiso`,
 * que derruba a entrada inteira ao menor conflito — meio termo aqui produziria
 * sinônimo cruzado, que é pior que sinônimo nenhum.
 *
 * Puro: sem IO, testável isolado.
 */

/** Um conceito: o termo canônico primeiro, depois como as pessoas o chamam. */
export type TermoRH = { termo: string; sinonimos: string[] };

export const VOCABULARIO_RH: TermoRH[] = [
  // ── Folha de pagamento ────────────────────────────────────────────────────
  { termo: "holerite", sinonimos: ["contracheque", "contra cheque", "recibo de pagamento", "demonstrativo de pagamento", "envelope de pagamento"] },
  { termo: "folha de pagamento", sinonimos: ["folha", "fechamento da folha", "processamento da folha", "cálculo da folha"] },
  { termo: "provento", sinonimos: ["vencimento", "rendimento", "verba de crédito"] },
  { termo: "desconto", sinonimos: ["verba de débito", "abatimento em folha"] },
  { termo: "salário base", sinonimos: ["salário contratual", "salário nominal", "vencimento base"] },
  { termo: "salário líquido", sinonimos: ["líquido a receber", "valor líquido"] },
  { termo: "décimo terceiro", sinonimos: ["13º", "13o", "gratificação natalina", "décimo terceiro salário"] },
  { termo: "adiantamento salarial", sinonimos: ["vale", "adiantamento quinzenal"] },
  { termo: "IRRF", sinonimos: ["imposto de renda retido", "imposto de renda na fonte", "IR retido"] },
  { termo: "INSS", sinonimos: ["contribuição previdenciária", "previdência social"] },
  { termo: "FGTS", sinonimos: ["fundo de garantia", "depósito de FGTS"] },
  { termo: "rubrica", sinonimos: ["evento de folha", "verba", "código de evento"] },

  // ── Ponto e jornada ───────────────────────────────────────────────────────
  { termo: "registro de ponto", sinonimos: ["marcação de ponto", "batida de ponto", "batida", "picagem"] },
  { termo: "espelho de ponto", sinonimos: ["cartão de ponto", "extrato de ponto", "folha de ponto"] },
  { termo: "apuração de ponto", sinonimos: ["fechamento do ponto", "cálculo do ponto", "processamento do ponto"] },
  { termo: "banco de horas", sinonimos: ["BH", "saldo de horas", "horas a compensar", "compensação de horas"] },
  { termo: "hora extra", sinonimos: ["horas extras", "hora suplementar", "extra"] },
  { termo: "adicional noturno", sinonimos: ["hora noturna", "adicional de hora noturna"] },
  { termo: "DSR", sinonimos: ["descanso semanal remunerado", "repouso semanal"] },
  { termo: "escala de trabalho", sinonimos: ["escala", "jornada", "turno", "12x36", "escala 12x36"] },
  { termo: "abono de falta", sinonimos: ["justificativa de falta", "falta abonada", "atestado de falta"] },
  { termo: "absenteísmo", sinonimos: ["taxa de absenteísmo", "índice de faltas"] },

  // ── Férias ────────────────────────────────────────────────────────────────
  { termo: "férias", sinonimos: ["período de férias", "gozo de férias"] },
  { termo: "período aquisitivo", sinonimos: ["aquisitivo", "período de aquisição"] },
  { termo: "período concessivo", sinonimos: ["concessivo", "prazo de concessão"] },
  { termo: "abono pecuniário", sinonimos: ["venda de férias", "abono de férias", "1/3 vendido"] },
  { termo: "terço constitucional", sinonimos: ["um terço de férias", "1/3 de férias", "terço de férias"] },
  { termo: "aviso de férias", sinonimos: ["comunicado de férias", "programação de férias"] },

  // ── Admissão, movimentação e desligamento ─────────────────────────────────
  { termo: "admissão", sinonimos: ["contratação", "entrada", "cadastro de colaborador"] },
  { termo: "rescisão", sinonimos: ["desligamento", "demissão", "término de contrato", "saída"] },
  { termo: "aviso prévio", sinonimos: ["aviso trabalhado", "aviso indenizado"] },
  { termo: "TRCT", sinonimos: ["termo de rescisão", "termo de rescisão do contrato de trabalho"] },
  { termo: "homologação", sinonimos: ["homologação da rescisão", "quitação rescisória"] },
  { termo: "experiência", sinonimos: ["contrato de experiência", "período de experiência"] },
  { termo: "afastamento", sinonimos: ["licença", "auxílio-doença", "benefício do INSS", "afastado"] },
  { termo: "licença maternidade", sinonimos: ["salário-maternidade", "licença gestante"] },
  { termo: "transferência", sinonimos: ["movimentação", "mudança de lotação", "remanejamento"] },
  { termo: "promoção", sinonimos: ["mudança de cargo", "progressão", "enquadramento"] },
  { termo: "turnover", sinonimos: ["rotatividade", "índice de rotatividade"] },
  { termo: "headcount", sinonimos: ["quadro de pessoal", "efetivo", "número de colaboradores", "quantidade de colaboradores"] },

  // ── Estrutura organizacional ──────────────────────────────────────────────
  { termo: "centro de custo", sinonimos: ["CC", "rateio", "centro de resultado"] },
  { termo: "lotação", sinonimos: ["local de trabalho", "unidade", "setor", "departamento"] },
  { termo: "cargo", sinonimos: ["função", "posição", "ocupação"] },
  { termo: "CBO", sinonimos: ["classificação brasileira de ocupações", "código CBO"] },
  { termo: "tabela salarial", sinonimos: ["faixa salarial", "estrutura salarial", "plano de cargos e salários"] },
  { termo: "matrícula", sinonimos: ["registro", "chapa", "código do colaborador"] },
  { termo: "vínculo", sinonimos: ["tipo de contrato", "categoria do trabalhador", "regime de contratação"] },

  // ── Benefícios ────────────────────────────────────────────────────────────
  { termo: "vale transporte", sinonimos: ["VT", "auxílio transporte"] },
  { termo: "vale refeição", sinonimos: ["VR", "vale alimentação", "VA", "auxílio alimentação", "ticket"] },
  { termo: "plano de saúde", sinonimos: ["assistência médica", "convênio médico", "coparticipação"] },
  { termo: "dependente", sinonimos: ["beneficiário", "agregado"] },

  // ── eSocial e obrigações ──────────────────────────────────────────────────
  { termo: "eSocial", sinonimos: ["e-social", "envio ao eSocial", "evento do eSocial"] },
  { termo: "S-1200", sinonimos: ["remuneração do trabalhador", "evento S-1200"] },
  { termo: "S-2200", sinonimos: ["admissão do trabalhador", "cadastro inicial do vínculo", "evento S-2200"] },
  { termo: "S-2299", sinonimos: ["desligamento no eSocial", "evento S-2299"] },
  { termo: "CAGED", sinonimos: ["cadastro geral de empregados e desempregados"] },
  { termo: "RAIS", sinonimos: ["relação anual de informações sociais"] },

  // ── Medicina e segurança do trabalho ──────────────────────────────────────
  { termo: "ASO", sinonimos: ["atestado de saúde ocupacional", "exame ocupacional", "exame admissional", "exame periódico"] },
  { termo: "CAT", sinonimos: ["comunicação de acidente de trabalho", "acidente de trabalho"] },
  { termo: "PPP", sinonimos: ["perfil profissiográfico previdenciário"] },
  { termo: "PCMSO", sinonimos: ["programa de controle médico de saúde ocupacional"] },
  { termo: "PGR", sinonimos: ["programa de gerenciamento de riscos", "PPRA"] },
  { termo: "EPI", sinonimos: ["equipamento de proteção individual", "entrega de EPI"] },
  { termo: "SESMT", sinonimos: ["serviço especializado em segurança e medicina do trabalho"] },
  { termo: "CIPA", sinonimos: ["comissão interna de prevenção de acidentes"] },
  { termo: "insalubridade", sinonimos: ["adicional de insalubridade", "grau de insalubridade"] },
  { termo: "periculosidade", sinonimos: ["adicional de periculosidade"] },

  // ── Recrutamento, treinamento e avaliação ─────────────────────────────────
  { termo: "requisição de pessoal", sinonimos: ["requisição de vaga", "abertura de vaga", "solicitação de contratação"] },
  { termo: "vaga", sinonimos: ["posição aberta", "oportunidade", "processo seletivo"] },
  { termo: "candidato", sinonimos: ["participante do processo seletivo", "inscrito"] },
  { termo: "triagem", sinonimos: ["screening", "seleção de currículos"] },
  { termo: "banco de talentos", sinonimos: ["banco de currículos", "cadastro de candidatos"] },
  { termo: "treinamento", sinonimos: ["capacitação", "curso", "turma de treinamento"] },
  { termo: "avaliação de desempenho", sinonimos: ["avaliação", "performance", "ciclo de avaliação"] },
  { termo: "9-box", sinonimos: ["matriz 9 box", "matriz de talentos"] },
  { termo: "PDI", sinonimos: ["plano de desenvolvimento individual"] },
  { termo: "feedback", sinonimos: ["retorno de avaliação", "devolutiva"] },
];

type EntradaLike = { matchNorms: string[]; forms: string[] };

/**
 * Une o piso à ontologia do cliente. O CLIENTE SEMPRE VENCE, termo a termo.
 *
 * Ao menor conflito a entrada do piso cai INTEIRA — se o cliente definiu "folha" com
 * outro sentido, herdar metade dos sinônimos dela produziria expansão cruzada, que é
 * pior que expansão nenhuma. Um alias que colida com termo canônico do cliente é
 * descartado sozinho, sem derrubar o resto da entrada.
 */
export function mesclarPiso<T extends EntradaLike>(
  doCliente: T[],
  piso: TermoRH[],
  normalizar: (s: string) => string,
  criar: (matchNorms: string[], forms: string[]) => T,
): T[] {
  if (process.env.VOCAB_RH_PISO === "0") return doCliente;
  const ocupados = new Set<string>();
  for (const e of doCliente) for (const m of e.matchNorms) if (m) ocupados.add(m);

  const extras: T[] = [];
  for (const t of piso) {
    const formas = [t.termo, ...t.sinonimos];
    const norms = formas.map(normalizar).filter(Boolean);
    // Qualquer forma já falada pelo cliente → a entrada inteira do piso sai.
    if (norms.some((n) => ocupados.has(n))) continue;
    extras.push(criar(norms, formas));
    for (const n of norms) ocupados.add(n);
  }
  return [...doCliente, ...extras];
}
