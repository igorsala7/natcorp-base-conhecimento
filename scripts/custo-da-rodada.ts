/**
 * O QUE UMA RODADA DE EVAL VAI CUSTAR, E O QUE CUSTOU.
 *
 * Os scripts de eval chamam os provedores DIRETO (`createAnthropic(...)`), fora
 * do `languageModel()` — de propósito, porque medir o modelo X exige instanciar
 * o modelo X, não o que está configurado. O efeito colateral é que esse consumo
 * não passa por `ai_usage` e não aparece em relatório nenhum.
 *
 * Em 20/08/2026 isso cobrou o preço: uma rodada de 37 casos × 23 modelos,
 * incluindo `claude-fable-5` (US$ 10/Mtok) e cinco Opus, esgotou o crédito da
 * Anthropic e DERRUBOU A PRODUÇÃO — toda pergunta com ferramenta passou a
 * responder erro ao cliente. O gasto não apareceu em nenhuma medição minha
 * justamente porque o caminho é outro.
 *
 * Aqui a rodada declara o custo ANTES (com o teto para abortar) e o total
 * DEPOIS. Não impede gastar; impede gastar sem ver.
 */

export type Preco = { provider: string; model: string; pin: number; pout: number; mr: number; mw: number };

/** Estimativa grosseira, feita para ALERTAR — não para faturar. */
export function estimarCusto(
  modelos: readonly string[],
  casos: number,
  tokensEntradaPorCaso: number,
  precos: readonly Preco[],
): { total: number; porModelo: { spec: string; usd: number; semPreco: boolean }[] } {
  const porModelo = modelos.map((spec) => {
    const [kind, ...r] = spec.split(":");
    const p = precos.find((x) => x.provider === kind && x.model === r.join(":"));
    // Saída estimada em 12% da entrada — a ordem de grandeza basta para o alerta.
    const usd = p ? (casos * tokensEntradaPorCaso * (p.pin + p.pout * 0.12)) / 1e6 : 0;
    // `semPreco` explícito, e não inferido de `usd === 0`: um modelo sem preço
    // custa ZERO na conta e some do total — a estimativa sai baixa e o teto não
    // aborta, que é cegueira exatamente onde a proteção deveria estar. E `usd`
    // também é 0 quando `casos` é 0, então os dois casos são indistinguíveis
    // pelo valor.
    return { spec, usd, semPreco: !p };
  });
  return { total: porModelo.reduce((a, b) => a + b.usd, 0), porModelo };
}

/**
 * Imprime a previsão e ABORTA acima do teto, a menos que `--aceito-o-custo`
 * esteja presente. O teto existe porque o erro caro não é rodar um eval caro de
 * propósito — é rodar um sem perceber que era caro.
 */
export function avisarCusto(
  modelos: readonly string[],
  casos: number,
  tokensEntradaPorCaso: number,
  precos: readonly Preco[],
  tetoUsd = 5,
): void {
  const { total, porModelo } = estimarCusto(modelos, casos, tokensEntradaPorCaso, precos);
  const caros = porModelo.filter((m) => m.usd > total / modelos.length).sort((a, b) => b.usd - a.usd).slice(0, 4);
  console.log(`\nCUSTO ESTIMADO DESTA RODADA: ~US$ ${total.toFixed(2)}  (${casos} casos × ${modelos.length} modelos)`);
  if (caros.length) console.log(`  os mais caros: ${caros.map((m) => `${m.spec} ~US$ ${m.usd.toFixed(2)}`).join(" · ")}`);
  const semPreco = porModelo.filter((m) => m.semPreco).map((m) => m.spec);
  const forcado = process.argv.includes("--aceito-o-custo");
  // Modelo sem preço ABORTA por padrão. Deixar passar seria pior que abortar:
  // ele gasta de verdade e entra na estimativa como zero, então o teto — a única
  // proteção que existe — deixa de valer sem ninguém perceber. Preço novo é uma
  // linha em `ai_model_prices`; crédito derrubado custa a produção.
  if (semPreco.length && !forcado) {
    console.error(
      `\nABORTADO: sem preço cadastrado para ${semPreco.join(", ")}.\n` +
      `Um modelo sem preço conta ZERO na estimativa: o teto de US$ ${tetoUsd.toFixed(2)} deixaria de valer\n` +
      `justamente na rodada que ninguém conseguiria prever. Cadastre em \`ai_model_prices\`\n` +
      `ou rode com --aceito-o-custo assumindo que a previsão está incompleta.\n`,
    );
    process.exit(2);
  }
  if (semPreco.length) console.log(`  ⚠ SEM PREÇO (a estimativa acima NÃO os inclui): ${semPreco.join(", ")}`);
  if (total > tetoUsd && !forcado) {
    console.error(
      `\nABORTADO: acima do teto de US$ ${tetoUsd.toFixed(2)}.\n` +
      `Uma rodada assim esgotou o crédito da Anthropic em 20/08 e derrubou a produção.\n` +
      `Para rodar mesmo assim: acrescente --aceito-o-custo\n`,
    );
    process.exit(2);
  }
  console.log("");
}

/** Total REAL ao fim da rodada, a partir dos tokens medidos. */
export function totalGasto(
  usados: readonly { spec: string; entrada: number; saida: number }[],
  precos: readonly Preco[],
): number {
  let t = 0;
  for (const u of usados) {
    const [kind, ...r] = u.spec.split(":");
    const p = precos.find((x) => x.provider === kind && x.model === r.join(":"));
    if (p) t += (u.entrada * p.pin + u.saida * p.pout) / 1e6;
  }
  return t;
}
