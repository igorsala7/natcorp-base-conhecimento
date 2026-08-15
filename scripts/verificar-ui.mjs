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
    chave: "hex-em-componente",
    rx: /["'`]#[0-9a-fA-F]{3,8}["'`]/g,
    // Seletor de cor, e-mail (onde CSS var não funciona) e dataviz têm paleta própria.
    ignora: (f) =>
      ULTIMA_REDE(f) ||
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
const ondePiorou = {};
for (const p of PADROES) {
  let n = 0;
  const porArquivo = {};
  for (const f of arquivos) {
    if (p.ignora?.(f)) continue;
    const achados = readFileSync(f, "utf8").match(p.rx);
    if (achados) {
      n += achados.length;
      porArquivo[f] = achados.length;
    }
  }
  atual[p.chave] = n;
  ondePiorou[p.chave] = porArquivo;
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
    const piores = Object.entries(ondePiorou[p.chave])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    for (const [f, n] of piores) console.error(`    ${String(n).padStart(4)}  ${f}`);
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
