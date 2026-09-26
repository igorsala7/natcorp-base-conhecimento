/**
 * UMA FUNÇÃO SQL MORA EM UM ARQUIVO — E ESTE SCRIPT É QUEM RECUSA O SEGUNDO.
 *
 * ── O defeito que este script existe para pegar ─────────────────────────────
 * Não há ledger de migrations neste repositório, então reaplicar um arquivo à
 * mão é operação NORMAL. Com a MESMA função definida em dois arquivos,
 * reaplicar o mais antigo desfaz o mais novo em SILÊNCIO.
 *
 * Silêncio é a palavra importante: a assinatura continua única, então
 * `npm run verificar:rpc` passa, e a assertiva de assinatura de
 * `20260925120000` também. É o CORPO que retrocede, e nenhum dos dois olha o
 * corpo. Os três sintomas já pagos neste ramo:
 *
 *   · reaplicar `20260925110000` devolvia `documentos_da_base` sem
 *     `status = 'ready'`, e o RAG voltava a servir arquivo em extração —
 *     chunks pela metade que o modelo afirma como o todo;
 *   · reaplicar `20260925120000` devolvia `public.ai_bases` para a range table
 *     das duas funções de busca (SECURITY INVOKER) e MATAVA a busca pública do
 *     portal com `permission denied`, que a action engole como lista vazia;
 *   · o mesmo arquivo devolvia o `btrim` de UM argumento, reabrindo o furo do
 *     NBSP ENTRE CLIENTES: uma base que difere só por NBSP é linha distinta
 *     para o índice único e o MESMO valor para o motor de elegibilidade.
 *
 * `verificar:rpc` pega assinatura duplicada no BANCO; este pega corpo duplicado
 * nos ARQUIVOS. São complementares, e esta é a classe que mordeu duas vezes.
 *
 * ── Por que é CATRACA e não "zero duplicatas" ───────────────────────────────
 * Medido em 26/09 sobre `supabase/migrations/`: 26 funções tinham mais de um
 * sítio vivo de definição. Vinte e duas delas eram dívida HERDADA, anterior a
 * este ramo, e exigir zero faria o portão nascer vermelho e ser desligado no
 * mesmo dia — portão que ninguém consegue passar não mede nada. A tarefa 16
 * apertou a catraca para 19 ao consolidar `elegivel`, `allowlist_casa` e
 * `vocabulario_rastreio`.
 *
 * Então o contrato é uma catraca com linha de base explícita:
 *
 *   · função FORA de `DIVIDA_HERDADA` só pode ter UM sítio vivo;
 *   · função DENTRO dela não pode ter MAIS sítios do que a linha de base diz;
 *   · se tiver MENOS, o script avisa que a catraca pode ser apertada (e passa).
 *
 * Os números de `DIVIDA_HERDADA` são TOTAIS, não deltas: cada entrada diz em
 * quantos arquivos aquela função aparece hoje, não quantos foram acrescentados.
 * Ler delta onde está total já custou uma rodada de diagnóstico errado neste
 * repositório.
 *
 * ── `ARQUIVO SUPERADO` sai da contagem, e por quê ───────────────────────────
 * Oito arquivos redefinem `hybrid_search_scoped`/`knowledge_list_chunks` com
 * assinaturas ANTIGAS (4, 5, 6 ou 7 parâmetros). Eles não são o defeito desta
 * classe — reaplicar um deles cria uma SEGUNDA assinatura, que é o defeito de
 * `verificar:rpc` e da assertiva de assinatura — e todos os oito ganharam
 * cabeçalho `ARQUIVO SUPERADO — NÃO REAPLIQUE ESTE ARQUIVO SOZINHO` na tarefa
 * 12, que é a mitigação documentada em `restricoes-globais.md`. Contá-los aqui
 * misturaria as duas classes e tornaria a catraca impossível.
 *
 * ── Comentário não conta ────────────────────────────────────────────────────
 * Os comentários `--` são retirados ANTES de procurar `create function`. Sem
 * isso, uma migration que só MENCIONA `create or replace function public.x` num
 * comentário de cabeçalho — e este ramo tem vários — viraria sítio de
 * definição. Uma catraca que conta a menção no comentário mede o comentário; já
 * aconteceu aqui com um contador de emoji, e a CI ficou dez dias vermelha.
 *
 * Limite conhecido: um `create function` que venha DEPOIS de um `--` na mesma
 * linha não é visto. Isso é o comportamento certo (está comentado), e o único
 * jeito de errar seria um literal de texto com `--` na mesma linha do create —
 * que não existe em nenhum dos 150 arquivos.
 *
 * ── Sentinela: o script tem de continuar medindo ────────────────────────────
 * Se a varredura achar zero arquivo, zero função, ou perder de vista qualquer
 * uma das nove funções de `SENTINELA` (as seis de escopo por base mais as três
 * da tarefa 16), ele FALHA em vez de passar. Portão verde porque não olhou é
 * pior do que portão nenhum.
 *
 *   npm run verificar:corpo
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "supabase/migrations";

/**
 * Aceita `create function` e `create or replace function`, com ou sem o
 * qualificador `public.`. Sem o qualificador a função nasce em `public` de
 * qualquer jeito (é o `search_path` das migrations), então tratar os dois como
 * o MESMO nome é o que evita um ponto cego: bastaria escrever
 * `create function documentos_da_base(...)` para escapar de uma varredura que
 * exigisse o prefixo.
 */
const CRIACAO = /^[ \t]*create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)/gim;

/**
 * Marcador do cabeçalho dos arquivos cuja assinatura foi superada (tarefa 12).
 *
 * Vale SÓ no cabeçalho, e isso não é detalhe: a primeira versão deste script
 * procurava o marcador no arquivo INTEIRO, e o arquivo canônico da tarefa 15 —
 * que explica a convenção num comentário perto do fim — se auto-isentou da
 * contagem. O script passou de "mede" para "não olha" sem mudar de cor; foi a
 * sentinela de `SENTINELA` que gritou. Nos oito arquivos superados o marcador
 * está sempre na LINHA 2, logo abaixo da régua de `=`.
 */
const SUPERADO = /ARQUIVO SUPERADO/i;
const LINHAS_DE_CABECALHO = 5;

/**
 * Dívida HERDADA, medida em 26/09 e anterior a este ramo. O número é o TOTAL de
 * arquivos em que cada função aparece hoje. Passar deste total falha; ficar
 * abaixo dele só rende um aviso para apertar a catraca.
 *
 * Cada linha aqui é um lugar onde reaplicar o arquivo mais antigo à mão desfaz,
 * em silêncio, uma correção posterior — a MESMA classe que a tarefa 15 fechou
 * para as funções de escopo por base. Zerar esta lista é trabalho por domínio
 * (cada função tem um dono e um conjunto de assertivas que viajam com ela), não
 * um mutirão.
 *
 * A catraca já foi apertada uma vez, na tarefa 16: `elegivel` (4 sítios),
 * `allowlist_casa` (3) e `vocabulario_rastreio` (2) SAÍRAM desta lista e valem
 * UM sítio cada. As duas primeiras decidem isolamento entre clientes, e a
 * terceira veio junto por força da ordem — ela era definida no mesmo arquivo
 * que virou o sítio canônico de `allowlist_casa`, e enquanto estivesse lá
 * reaplicar aquele arquivo continuaria sendo destrutivo. Linha de base: 22
 * funções antes, 19 depois.
 */
const DIVIDA_HERDADA: Record<string, number> = {
  ai_usage_report: 5,
  approve_review: 2,
  create_article_version: 2,
  gestao_alocacoes: 2,
  gestao_ciclos: 2,
  gestao_compras: 2,
  gestao_consumo: 2,
  gestao_plano: 3,
  gestao_portao_credito: 3,
  gestao_saldo: 2,
  prompts_sugeridos: 2,
  reject_review: 2,
  set_ai_provider_key: 2,
  set_email_secret: 2,
  set_space_password: 2,
  set_whatsapp_secret: 2,
  soft_delete_subtree: 2,
  submit_for_review: 2,
  verify_space_password: 2,
};

/**
 * As seis funções de escopo por base (tarefa 15) mais as três consolidadas na
 * tarefa 16. Não ganham tratamento especial na regra (elas simplesmente não
 * estão em `DIVIDA_HERDADA`, logo valem UM sítio); estão aqui só como
 * sentinela de que a varredura continua enxergando o que deveria.
 *
 * Perder de vista uma destas é o modo de falha que quase passou na tarefa 15:
 * o script parou de MEDIR sem mudar de cor. Portão verde porque não olhou é
 * pior do que portão nenhum.
 */
const SENTINELA = [
  "codigo_normalizado",
  "bases_do_codigo",
  "escopo_documentacao",
  "documentos_da_base",
  "hybrid_search_scoped",
  "knowledge_list_chunks",
  "elegivel",
  "allowlist_casa",
  "vocabulario_rastreio",
];

function semComentario(sql: string): string {
  // Só o comentário de linha. `/* */` não é usado em nenhuma migration deste
  // repositório, e um regex de bloco aqui arriscaria comer corpo de função.
  return sql.replace(/--[^\n]*/g, "");
}

const sitios = new Map<string, string[]>();
let arquivosLidos = 0;
let arquivosSuperados = 0;

for (const nome of readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  const texto = readFileSync(join(DIR, nome), "utf8");
  const cabecalho = texto.split("\n", LINHAS_DE_CABECALHO).join("\n");
  if (SUPERADO.test(cabecalho)) {
    arquivosSuperados++;
    continue;
  }
  arquivosLidos++;
  for (const m of semComentario(texto).matchAll(CRIACAO)) {
    const funcao = m[1]!;
    const lista = sitios.get(funcao) ?? [];
    if (!lista.includes(nome)) lista.push(nome);
    sitios.set(funcao, lista);
  }
}

// ── Sentinela ───────────────────────────────────────────────────────────────
const cegueira: string[] = [];
if (arquivosLidos === 0) cegueira.push(`nenhum .sql lido em ${DIR}/`);
if (sitios.size === 0) cegueira.push("nenhuma definição de função encontrada");
for (const f of SENTINELA) {
  if (!sitios.has(f)) cegueira.push(`perdeu de vista public.${f}`);
}
if (cegueira.length > 0) {
  console.error("Esta varredura DEIXOU DE MEDIR — corrija o script antes de confiar nele:\n");
  for (const c of cegueira) console.error(`  ${c}`);
  process.exit(1);
}

// ── A catraca ───────────────────────────────────────────────────────────────
const novas: [string, string[]][] = [];
const pioraram: [string, string[], number][] = [];
const melhoraram: [string, number, number][] = [];

for (const [funcao, arquivos] of [...sitios].sort((a, b) => a[0].localeCompare(b[0]))) {
  const base = DIVIDA_HERDADA[funcao];
  if (base === undefined) {
    if (arquivos.length > 1) novas.push([funcao, arquivos]);
    continue;
  }
  if (arquivos.length > base) pioraram.push([funcao, arquivos, base]);
  else if (arquivos.length < base) melhoraram.push([funcao, arquivos.length, base]);
}

for (const [funcao, agora, base] of melhoraram) {
  console.warn(
    `AVISO  public.${funcao} caiu de ${base} para ${agora} sítio(s). Aperte a catraca: ` +
      `${agora === 1 ? `retire a entrada de DIVIDA_HERDADA` : `troque o total por ${agora}`} em .audit/corpo-canonico-de-funcao.ts.`,
  );
}

if (novas.length > 0 || pioraram.length > 0) {
  console.error("\nFunção SQL definida em mais de um arquivo (reaplicar o mais antigo desfaz o mais novo, em silêncio):\n");
  for (const [funcao, arquivos] of novas) {
    console.error(`  public.${funcao} — ${arquivos.length} sítios:`);
    for (const a of arquivos) console.error(`      ${DIR}/${a}`);
  }
  for (const [funcao, arquivos, base] of pioraram) {
    console.error(`  public.${funcao} — ${arquivos.length} sítios, e a linha de base tolerava ${base}:`);
    for (const a of arquivos) console.error(`      ${DIR}/${a}`);
  }
  console.error(
    "\nO conserto NÃO é acrescentar a função a DIVIDA_HERDADA. É deixar UM sítio de\n" +
      "definição — o corpo VIVO do banco, via `pg_get_functiondef` — e levar junto as\n" +
      "assertivas que CHAMAM a função, senão uma aplicação do zero as roda antes de a\n" +
      "função existir. O molde está em\n" +
      "supabase/migrations/20260926120000_funcoes_de_escopo_canonicas.sql.\n" +
      "\nQuando a ASSINATURA muda, o caso é outro: o arquivo antigo ganha cabeçalho\n" +
      "`ARQUIVO SUPERADO — NÃO REAPLIQUE ESTE ARQUIVO SOZINHO` e sai desta contagem.\n",
  );
  process.exit(1);
}

const herdadas = Object.keys(DIVIDA_HERDADA).length;
console.log(
  `Corpo canônico: ${sitios.size} funções em ${arquivosLidos} migrations ` +
    `(${arquivosSuperados} marcadas ARQUIVO SUPERADO, fora da contagem). ` +
    `Nenhum sítio de definição novo. Dívida herdada tolerada: ${herdadas} funções (total, não delta).`,
);
