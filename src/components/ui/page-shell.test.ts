import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * TODA TELA USA A MOLDURA — verificado, não combinado.
 *
 * O `PageShell` existia, documentava bem suas três larguras, e **16 das 31
 * páginas o usavam**. As outras 15 montavam a moldura à mão: cada uma com seu
 * `<h1>` e sua classe, seu espaçamento até o conteúdo, e sua largura máxima
 * escolhida caso a caso — havia seis em uso ao mesmo tempo. A Importar chegava
 * a TROCAR de largura conforme a aba, então a página saltava de tamanho quando
 * se alternava entre abas irmãs.
 *
 * Isso é o que o usuário descreve como "os layouts não seguem um padrão", e não
 * se resolve com disciplina: a sexta largura entrou sem ninguém decidir. Ou a
 * moldura é obrigatória e verificada, ou a sétima entra na semana que vem.
 *
 * ── Por que análise estática e não render ───────────────────────────────────
 * Renderizar um Server Component do App Router num teste unitário exige subir
 * meio Next. O que precisa ser garantido aqui é estrutural — "esta rota delega
 * a moldura a alguém" —, e isso se lê no import. Um teste que custa 20ms e roda
 * sempre vale mais que um perfeito que ninguém liga.
 */

const RAIZ = "src/app/(admin)/admin/(app)";

/**
 * As exceções, cada uma com o motivo escrito.
 *
 * Uma lista de exceções sem justificativa vira um lugar para esconder dívida:
 * o próximo desenvolvedor acrescenta a sua e ninguém pergunta. Com o motivo ao
 * lado, acrescentar exige defender.
 */
const SEM_MOLDURA: Record<string, string> = {
  "base-conhecimento/page.tsx":
    "Só `redirect()`. Não renderiza nada — moldura seria HTML que ninguém vê.",
  "conteudo/page.tsx":
    "Canvas de duas colunas (árvore + conteúdo) via ContentShell, que gere o próprio espaço.",
  "conteudo/[nodeId]/page.tsx": "Mesmo canvas, com o editor na coluna da direita.",
  "documentacoes/page.tsx":
    "Delega ao DocsHub, que monta o PageShell — a ação 'Nova documentação' abre diálogo com estado de cliente.",
  "estilo/page.tsx": "Delega ao EstiloView, que monta o PageShell.",
  "estudio/[sessionId]/page.tsx": "Canvas do Estúdio: chat + prévia ocupam a tela inteira.",
  "importar/[jobId]/page.tsx":
    "Prévia lado a lado (documento original × árvore proposta) — as duas colunas precisam da largura toda.",
  "previa/[spaceId]/page.tsx": "Prévia da documentação inteira: simula o portal, sem casca de admin.",
  "sistema/email-template/page.tsx": "Editor de template com prévia do e-mail em tamanho real.",
};

function paginas(dir: string, prefixo = ""): string[] {
  const achadas: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      achadas.push(...paginas(caminho, prefixo ? `${prefixo}/${nome}` : nome));
    } else if (nome === "page.tsx") {
      achadas.push(prefixo ? `${prefixo}/page.tsx` : "page.tsx");
    }
  }
  return achadas;
}

describe("anatomia de página", () => {
  const todas = paginas(RAIZ);

  it("encontra as páginas do admin", () => {
    // Se o glob quebrar, os testes abaixo passariam vazios e não protegeriam nada.
    expect(todas.length).toBeGreaterThan(25);
  });

  it("toda rota usa PageShell, ou está na lista de exceções com motivo", () => {
    const semJustificativa = todas.filter((rel) => {
      const fonte = readFileSync(join(RAIZ, rel), "utf8");
      return !fonte.includes("PageShell") && !SEM_MOLDURA[rel];
    });
    expect(
      semJustificativa,
      "Rota sem PageShell e sem exceção declarada em page-shell.test.ts",
    ).toEqual([]);
  });

  it("a lista de exceções não guarda rota que já foi migrada", () => {
    // Exceção que sobra é pior que exceção que falta: ela dá cobertura a uma
    // tela que já se comporta, e some do radar quando o motivo deixa de valer.
    const obsoletas = Object.keys(SEM_MOLDURA).filter((rel) => {
      if (!todas.includes(rel)) return true;
      const fonte = readFileSync(join(RAIZ, rel), "utf8");
      // `documentacoes` e `estilo` delegam: elas não importam PageShell, mas o
      // componente para o qual delegam importa. Delegação continua sendo exceção.
      return fonte.includes('from "@/components/ui/page-shell"');
    });
    expect(obsoletas, "Exceção obsoleta — a rota já usa PageShell ou não existe mais").toEqual([]);
  });

  it("nenhuma rota inventa a própria largura máxima no elemento raiz", () => {
    /**
     * O sintoma que denunciou o problema. Seis larguras conviviam — 2xl, 3xl,
     * 4xl, 5xl, 6xl e 1400px —, escolhidas caso a caso, e o `PageShell` existe
     * justamente para reduzir a escolha a quatro nomeadas por TIPO de conteúdo.
     *
     * A busca é por `mx-auto max-w-`, que é a assinatura de moldura própria.
     * Um `max-w-` isolado dentro do conteúdo (limitar um parágrafo, um campo) é
     * legítimo e não casa aqui.
     */
    const comMolduraPropria = todas.filter((rel) => {
      // Rota de exceção é dona do próprio layout por definição — cobrar dela a
      // largura do PageShell seria cobrar o que ela justificadamente não usa.
      if (SEM_MOLDURA[rel]) return false;
      const fonte = readFileSync(join(RAIZ, rel), "utf8");
      return /mx-auto[^"'`]*\bmax-w-/.test(fonte);
    });
    expect(comMolduraPropria, "Largura própria no lugar das larguras do PageShell").toEqual([]);
  });
});
