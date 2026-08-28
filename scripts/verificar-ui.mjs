/**
 * RATCHET DE UI — a catraca que só gira para um lado.
 *
 * O redesenho é gradual: 304 `<button>` crus e 315 `title=` não somem numa
 * semana, e perseguir zero em todas as frentes custa semanas e entrega pouco
 * além do número. O que NÃO pode acontecer é a conta subir enquanto a migração
 * anda — foi assim que ela chegou aqui.
 *
 * Este script conta cada padrão e falha se algum contador ficar ACIMA do
 * baseline versionado. Quando um número cai, o baseline é atualizado (rode com
 * `--gravar`) e aquele patamar vira o novo teto. Regra AST ficaria cara e
 * frágil: os padrões vivem dentro de strings de className.
 *
 * Rodar: node scripts/verificar-ui.mjs [--gravar]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const BASELINE = "scripts/ui-baseline.json";
const GRAVAR = process.argv.includes("--gravar");

/**
 * A ÚLTIMA REDE não pode depender do que ela existe para socorrer.
 *
 * `global-error.tsx` só dispara quando o layout raiz quebrou: nenhum provider
 * está montado e o `globals.css` pode não ter carregado. Importar `<Button>` ou
 * referenciar um token ali arriscaria a tela de erro ser a segunda coisa a
 * quebrar — por isso ela usa botão cru e hex inline, de propósito.
 *
 * Exceção estreita e nomeada: um arquivo, não um diretório.
 */
const ULTIMA_REDE = (f) => f === "src/app/global-error.tsx";

/**
 * Apaga COMENTÁRIOS antes de contar, para os padrões que pedem `semComentarios`.
 *
 * Comentário não renderiza. Uma regra cuja justificativa é "renderiza diferente
 * por SO e não herda cor nem tamanho do token" não tem o que dizer sobre um
 * emoji dentro de um bloco de comentário. Foi exatamente esse o caso que travou
 * a CI de 18/08 a 28/08: os três emoji que levaram o contador de 64 a 67
 * estavam os três em comentário — um deles no `copy-button.tsx`, explicando por
 * que aquele arquivo usa `<Check>` do lucide. A catraca acusando dívida no
 * arquivo que faz certo.
 *
 * É o mesmo remédio já aplicado em `title-como-tooltip` e em `select-sem-teto`:
 * regra que acusa uso correto ensina a equipe a ignorar a catraca inteira, e aí
 * morrem junto as ocorrências que valiam.
 *
 * DUAS LIMITAÇÕES CONHECIDAS, e ambas erram para MENOS (nunca inventam dívida):
 *   - URL crua em TEXTO JSX (`Veja https://x`, fora de aspas) come o resto da
 *     linha como se fosse `//`. Dentro de aspas não acontece, que é onde URL
 *     mora em quase todo caso.
 *   - Literal de expressão regular contendo aspas pode confundir o estado.
 * Um parser de verdade custaria mais do que a catraca inteira vale — este
 * arquivo já registra que regra AST aqui seria "cara e frágil".
 */
function semComentarios(src) {
  let out = "";
  let estado = "codigo"; // codigo | aspas | linha | bloco
  let aspa = "";
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const d = src[i + 1];
    if (estado === "codigo") {
      if (c === "/" && d === "/") { estado = "linha"; i++; continue; }
      if (c === "/" && d === "*") { estado = "bloco"; i++; continue; }
      if (c === '"' || c === "'" || c === "`") { estado = "aspas"; aspa = c; }
      out += c;
    } else if (estado === "aspas") {
      // Escape consome o próximo caractere: `"\""` não fecha a string.
      if (c === "\\") { out += c + (d ?? ""); i++; continue; }
      if (c === aspa) estado = "codigo";
      out += c;
    } else if (estado === "linha") {
      if (c === "\n") { estado = "codigo"; out += c; }
    } else {
      if (c === "*" && d === "/") { estado = "codigo"; i++; continue; }
      if (c === "\n") out += c; // preserva as quebras, para o texto não colar
    }
  }
  return out;
}

/**
 * Cada padrão diz o que conta e POR QUE é dívida — a mensagem aparece quando o
 * contador sobe, e é o que impede o próximo a mexer de achar que é frescura.
 */
const PADROES = [
  {
    chave: "button-cru",
    rx: /<button\b/g,
    ignora: (f) => f.startsWith("src/components/ui/") || ULTIMA_REDE(f),
    porque: "Use <Button> ou <IconButton>. Botão cru não herda variante, foco, loading nem tamanho de ícone.",
  },
  {
    chave: "title-como-tooltip",
    /**
     * Só o ATRIBUTO HTML — a tag precisa começar com minúscula.
     *
     * A primeira versão contava `\btitle="` cru e pegava junto os componentes
     * que têm uma prop chamada `title` (`<Dialog title=…>`, `<EmptyState
     * title=…>`), que são o nome do bloco e não têm nada a ver com tooltip. A
     * catraca acusou dívida em cima de um uso correto, que é o jeito mais rápido
     * de a equipe aprender a ignorá-la.
     *
     * `[^<>]*?` impede a busca de atravessar para dentro de outra tag.
     */
    rx: /<[a-z][a-zA-Z0-9-]*(?:\s[^<>]*?)?\stitle="/gs,
    porque: "Use <Tooltip> + aria-label. O atributo title não aparece em toque e não é confiável em leitor de tela.",
  },
  {
    chave: "checkbox-cru",
    rx: /type="checkbox"/g,
    ignora: (f) => f.startsWith("src/components/ui/"),
    porque: "Use <Checkbox> ou <Switch>. Cada input cru traz seu próprio estilo e seu próprio foco.",
  },
  {
    chave: "texto-arbitrario",
    // A escala de leitura do portal (--l-*) é intencional e fica de fora.
    rx: /\btext-\[(?!length:|var\()/g,
    porque: "Use um degrau da escala (text-2xs … text-4xl). Tamanho à mão é como nasceram três grafias para 11px.",
  },
  {
    chave: "outline-none-sem-substituto",
    // Só conta quando não há foco alternativo na MESMA string de classe.
    rx: /class(?:Name)?="[^"]*\boutline-none\b(?![^"]*(?:focus-visible:|focus:ring|focus:border))[^"]*"/g,
    porque: "outline-none incondicional vence o :focus-visible global e apaga o foco. Junte focus-visible: ou focus:ring.",
  },
  {
    chave: "emoji-como-icone",
    rx: /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}]/gu,
    ignora: (f) => f.endsWith(".test.ts") || f.endsWith(".test.tsx"),
    // Só o que RENDERIZA conta — ver `semComentarios` lá em cima.
    semComentarios: true,
    porque: "Use lucide-react. Emoji renderiza diferente por SO e não herda cor nem tamanho do token.",
  },
  {
    chave: "spinner-solto",
    rx: /\banimate-spin\b/g,
    ignora: (f) => f.startsWith("src/components/ui/"),
    porque: "Use <Button loading> ou <Skeleton>. Spinner solto é a terceira resposta para a mesma pergunta.",
  },
  {
    chave: "caixa-tracejada",
    rx: /\bborder-dashed\b/g,
    ignora: (f) => f.startsWith("src/components/ui/"),
    porque: "Use <EmptyState>. A caixa tracejada copiada perde a ação de saída, que é o ponto do estado vazio.",
  },
  {
    chave: "select-sem-teto",
    /**
     * `.eq(...)` sem `.range()`, `.limit()`, `.single()` ou `.maybeSingle()`.
     *
     * O PostgREST tem um teto padrão de linhas por resposta e uma consulta sem
     * paginação simplesmente PARA nele: não dá erro, não avisa, só devolve
     * menos. Foi assim que a ontologia perdeu 1.240 termos de 2.240 sem que
     * nada na tela sugerisse problema — e o mesmo teto já tinha mordido a
     * árvore de conteúdo antes.
     *
     * O sintoma é o pior possível: em vez de falhar, o produto fica plausível.
     *
     * Restrita às tabelas que de fato CRESCEM. A primeira versão pegava
     * qualquer `.from(...).eq(...)` e acusou 566 ocorrências — quase todas
     * legítimas, em tabela que nunca passa de dezenas de linhas. Uma regra que
     * grita 566 vezes ensina a equipe a ignorar a catraca inteira, e aí as nove
     * que funcionam morrem junto. Precisão importa mais que cobertura numa
     * ferramenta que só vale enquanto é levada a sério.
     *
     * Lista fechada, revisada contra o banco: são as que já passam de mil linhas
     * ou vão passar. Tabela nova que crescer entra aqui.
     */
    // A regra vale para LEITURA: escrita não tem teto de retorno para estourar.
    // `.update().eq("id", …)` mexe numa linha e era marcado junto com um `select`
    // de tabela inteira — ruído que empurra para subir o baseline em vez de
    // olhar. `insert`/`upsert`/`delete`/`update` saem da conta.
    rx: /\.from\("(ontology_terms|ontology_aliases|ontology_translations|data_dictionary|chunks|nodes|messages|conversations|search_logs|article_views|audit_log|ai_tool_runs)"\)(?![^;]*\.(range|limit|single|maybeSingle|count|insert|upsert|update|delete)\()[^;]*;/gs,
    ignora: (f) => f.endsWith(".test.ts") || f.includes("database.types"),
    porque:
      "Consulta sem .range() para no teto do PostgREST em silêncio. Use fetchAllPaged onde a tabela cresce.",
  },
  {
    chave: "hex-em-componente",
    rx: /["'`]#[0-9a-fA-F]{3,8}["'`]/g,
    // Seletor de cor, e-mail (onde CSS var não funciona) e dataviz têm paleta própria.
    //
    // `reports/marca.ts` é a DEFINIÇÃO dos tokens de documento — é o único lugar
    // onde o hex tem que morar, do mesmo jeito que `globals.css` é onde ele mora
    // para a tela. Marcá-lo seria a regra reclamando da própria fundação. O
    // teste `marca.test.ts` é o que garante que esses valores não divergem do
    // Tailwind; a catraca aqui não teria como.
    ignora: (f) =>
      ULTIMA_REDE(f) ||
      /reports\/marca\./.test(f) ||
      /appearance-editor|widget-manager|email-html|email-template|chart-view|flow-view|flow-canvas|mindmap/.test(f),
    porque: "Use um token semântico. Hex em componente é o que impede trocar tema por cliente.",
  },
];

// `git ls-files` sozinho só enxerga arquivo RASTREADO — arquivo novo passava
// batido até ser commitado, e aí a dívida "aparecia" num commit que não a
// introduziu. `--others` traz os não rastreados; `--exclude-standard` respeita
// o .gitignore, senão viria node_modules inteiro.
const arquivos = execSync(
  'git ls-files --cached --others --exclude-standard "src/**/*.tsx" "src/**/*.ts"',
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean);

const atual = {};
// NOME HONESTO: é onde o padrão ESTÁ, não onde ele piorou. A versão anterior
// chamava isto de `ondePiorou` e imprimia a lista embaixo de um "✗ subiu" —
// quem lia entendia "foi aqui que subiu" e ia consertar o arquivo errado.
// Aconteceu: o maior contador de emoji é uma rota que não muda há semanas,
// enquanto os 3 que subiram estavam em três outros arquivos.
const ondeEsta = {};
// Semeado na ordem de PADROES: como a contagem agora percorre ARQUIVOS por
// fora (para ler cada um uma vez só), sem isto as chaves entrariam na ordem em
// que aparecem no primeiro arquivo — e o baseline.json se reembaralharia a cada
// gravação, sujando todo diff futuro com ruído que não é dívida.
for (const p of PADROES) {
  atual[p.chave] = 0;
  ondeEsta[p.chave] = {};
}
for (const f of arquivos) {
  const bruto = readFileSync(f, "utf8");
  let semCom = null; // calculado sob demanda, e uma vez só por arquivo
  for (const p of PADROES) {
    if (p.ignora?.(f)) continue;
    const alvo = p.semComentarios ? (semCom ??= semComentarios(bruto)) : bruto;
    const achados = alvo.match(p.rx);
    if (!achados) continue;
    atual[p.chave] += achados.length;
    ondeEsta[p.chave][f] = achados.length;
  }
}

if (GRAVAR) {
  writeFileSync(BASELINE, JSON.stringify(atual, null, 2) + "\n");
  console.log("Baseline gravado:");
  for (const [k, v] of Object.entries(atual)) console.log(`  ${String(v).padStart(5)}  ${k}`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(`Baseline ausente. Rode: node ${process.argv[1]} --gravar`);
  process.exit(1);
}

const base = JSON.parse(readFileSync(BASELINE, "utf8"));
let subiu = false;
let caiu = false;

for (const p of PADROES) {
  const antes = base[p.chave];
  const agora = atual[p.chave];
  if (antes === undefined) {
    console.log(`  novo   ${p.chave}: ${agora} (grave o baseline)`);
    subiu = true;
    continue;
  }
  if (agora > antes) {
    subiu = true;
    console.error(`\n✗ ${p.chave}: ${antes} → ${agora}  (+${agora - antes})`);
    console.error(`  ${p.porque}`);
    // O RÓTULO IMPORTA. A lista é por total, e o arquivo com maior total quase
    // nunca é o que acabou de subir — dizer só "✗ subiu" seguido dela manda o
    // leitor consertar o lugar errado, e depois desconfiar da catraca.
    console.error(`  maiores TOTAIS (não necessariamente quem subiu):`);
    const maiores = Object.entries(ondeEsta[p.chave])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    for (const [f, n] of maiores) console.error(`    ${String(n).padStart(4)}  ${f}`);
    console.error(`  quem subiu: compare com o commit que gravou ${BASELINE}`);
    console.error(`    git log -1 --format=%h -- ${BASELINE}`);
  } else if (agora < antes) {
    caiu = true;
    console.log(`✓ ${p.chave}: ${antes} → ${agora}  (−${antes - agora})`);
  }
}

if (subiu) {
  console.error("\nA dívida de UI aumentou. Use os primitivos, ou justifique e atualize o baseline conscientemente.");
  process.exit(1);
}
if (caiu) console.log("\nA dívida caiu. Rode com --gravar para travar o novo patamar.");
else console.log("Dívida de UI estável.");
