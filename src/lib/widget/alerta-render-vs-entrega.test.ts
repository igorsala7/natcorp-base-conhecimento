import { describe, it, expect } from "vitest";
import fs from "node:fs";

/**
 * SERVIR NÃO É VISUALIZAR — a invariante do widget, lida no fonte.
 *
 * `public/widget.js` é um IIFE de ~9 mil linhas, sem ponto de entrada para teste
 * unitário (o mesmo limite que `bootstrap-token.test.ts` registra). Mas a
 * invariante desta tarefa é estrutural e se lê no texto: o reporte de
 * visualização tem de estar atrás de uma MEDIDA de layout, e não pode acontecer
 * no caminho em que o servidor entrega o alerta.
 *
 * Por que isso merece teste em vez de revisão: o defeito, se voltar, é invisível.
 * Reportar na entrega não quebra nada, não gera erro, não muda a tela — só
 * transforma a única contagem que o painel de campanha mostra em "quantas
 * páginas carregaram", com o nome de "quantas pessoas viram". O painel continua
 * bonito e o número passa a ser outro.
 *
 * A medida em si é o que separa os dois casos, e ela é exata: com o painel
 * fechado, `.panel` é `display:none` e o balão do alerta — que já está no DOM
 * desde o carregamento da página — mede 0×0. Aberto, ele tem altura. O próprio
 * `toggle` do widget já dependia disso para refazer a rolagem, e registra que com
 * o painel oculto `scrollHeight` é 0.
 */
const WIDGET = fs.readFileSync("public/widget.js", "utf-8");

/** O corpo de uma `function nome() {...}` do fonte, por contagem de chaves. */
function corpoDaFuncao(nome: string): string {
  const i = WIDGET.indexOf(`function ${nome}(`);
  expect(i, `função ${nome} não existe mais em widget.js`).toBeGreaterThan(-1);
  const inicio = WIDGET.indexOf("{", i);
  let nivel = 0;
  for (let j = inicio; j < WIDGET.length; j++) {
    if (WIDGET[j] === "{") nivel++;
    else if (WIDGET[j] === "}") {
      nivel--;
      if (nivel === 0) return WIDGET.slice(inicio, j + 1);
    }
  }
  throw new Error(`função ${nome} sem fechamento`);
}

const ROTA = "/api/v1/alertas/visto";

describe("o reporte de visualização do alerta", () => {
  it("é enviado de UM lugar só no fonte", () => {
    // Um segundo ponto de envio é o caminho por onde o reporte na entrega
    // voltaria: alguém acrescenta um `fetch` "para não perder visualização" no
    // handler da config e a contagem muda de significado sem nenhum sintoma.
    const n = WIDGET.split(ROTA).length - 1;
    expect(n).toBe(1);
  });

  it("sai de `confirmarAlertasVistos`, e essa função MEDE o layout antes", () => {
    const corpo = corpoDaFuncao("confirmarAlertasVistos");
    expect(corpo).toContain(ROTA);
    // A medida. Sem ela, "renderizado" viraria "existe no DOM", que é verdade
    // desde o carregamento da página, com o painel fechado.
    expect(corpo).toContain("getBoundingClientRect");
    expect(corpo).toMatch(/r\.height\s*>\s*0/);
    // E a medida tem de vir ANTES do envio.
    expect(corpo.indexOf("getBoundingClientRect")).toBeLessThan(corpo.indexOf(ROTA));
  });

  it("NÃO é enviado ao desenhar: `renderAlertas` não reporta por conta própria", () => {
    // `renderAlertas` roda no carregamento da página, com o painel fechado.
    // Ele pode CHAMAR a conferência (que mede e decide), mas não pode enviar.
    const corpo = corpoDaFuncao("renderAlertas");
    expect(corpo).not.toContain(ROTA);
    expect(corpo).toContain("confirmarAlertasVistos()");
  });

  it("NÃO é enviado no handler da config: entrega não é visualização", () => {
    const corpo = corpoDaFuncao("init");
    expect(corpo).not.toContain(ROTA);
    expect(corpo).not.toContain("confirmarAlertasVistos");
    // O que o handler da config faz com os alertas é guardar.
    expect(corpo).toContain("alertasDoServidor = data.alertas");
  });

  it("é conferido quando o painel ABRE", () => {
    const corpo = corpoDaFuncao("toggle");
    expect(corpo).toContain("confirmarAlertasVistos");
    // Depois de o painel virar visível, senão a medida devolve 0.
    expect(corpo.indexOf('classList.add("open")')).toBeLessThan(corpo.indexOf("confirmarAlertasVistos"));
  });
});

describe("o texto do alerta é DADO, nunca marcação", () => {
  it("título e corpo entram por textContent", () => {
    const corpo = corpoDaFuncao("renderAlertas");
    expect(corpo).toContain("tit.textContent = a.titulo");
    expect(corpo).toContain("cor.textContent = a.corpo");
  });

  it("nenhum innerHTML recebe título ou corpo da campanha", () => {
    // O cliente escreve esses dois campos num formulário interno; com innerHTML,
    // aquele formulário viraria XSS dentro do ERP de todos os elegíveis.
    const corpo = corpoDaFuncao("renderAlertas");
    expect(corpo).not.toMatch(/innerHTML\s*=\s*a\.(titulo|corpo)/);
    expect(corpo).not.toMatch(/innerHTML\s*[+]?=\s*[^;]*a\.(titulo|corpo)/);
  });
});

describe("o widget não decide elegibilidade", () => {
  it("não filtra os alertas do servidor por base, portal ou regra", () => {
    // `widget.js` é público: filtro aqui é sugestão, não cerca — e um filtro que
    // parece cerca faz a próxima pessoa confiar nele. O corte é em SQL
    // (`public.alertas_para`), e por isso a `regra` nem chega ao navegador.
    const corpo = corpoDaFuncao("renderAlertas");
    expect(corpo).not.toContain(".regra");
    expect(corpo).not.toMatch(/alertasDoServidor\s*\.\s*filter/);
    expect(WIDGET).not.toMatch(/alertasDoServidor\s*=\s*[^;]*\.filter\(/);
  });
});
