import { describe, it, expect } from "vitest";
import fs from "node:fs";

/**
 * SERVIR NÃO É VISUALIZAR, E ESTAR NO LAYOUT TAMBÉM NÃO — lido no fonte.
 *
 * `public/widget.js` é um IIFE de ~9 mil linhas, sem ponto de entrada para teste
 * unitário (o mesmo limite que `bootstrap-token.test.ts` registra). Mas a
 * invariante desta tarefa é estrutural e se lê no texto: o reporte de
 * visualização tem de sair de UM lugar, e esse lugar tem de ser alcançado pelo
 * observador de interseção — nunca pelo caminho em que o servidor entrega o
 * alerta, e nunca por uma medida de retângulo.
 *
 * ── O QUE MUDOU, E POR QUE O TESTE ANTIGO NÃO SERVIA MAIS ────────────────────
 * A versão anterior media `getBoundingClientRect().height > 0`, e esse teste
 * exigia essa medida. A medida separava painel fechado (0×0) de painel aberto, e
 * só isso: um aviso no topo de um histórico longo tem altura de sobra enquanto
 * está rolado para FORA da vista, e contava. O número dizia "gente viu" e media
 * "o painel abriu".
 *
 * Então o teste foi reescrito para a invariante nova, não afrouxado para aceitar
 * as duas: ele agora EXIGE o `IntersectionObserver`, exige o limiar antes do
 * envio, e RECUSA a volta da medida de retângulo no caminho do alerta. Aceitar
 * "uma das duas" transformaria o teste em documentação de que qualquer coisa
 * serve.
 *
 * Por que isso merece teste em vez de revisão: o defeito, se voltar, é invisível.
 * Reportar na entrega (ou no layout) não quebra nada, não gera erro, não muda a
 * tela — só transforma a única contagem que o painel de campanha mostra em
 * "quantas páginas carregaram", com o nome de "quantas pessoas viram".
 */
const WIDGET = fs.readFileSync("public/widget.js", "utf-8");

/**
 * O MESMO texto, com comentário virando espaço — e é por isso que ele existe.
 *
 * A primeira versão deste teste comparava substring no fonte CRU, e a assertiva
 * "a abertura do painel não chama mais o observador" falhou contra o comentário
 * que EXPLICA que ela não chama. Substring em fonte cru não distingue chamada de
 * menção, e este repositório já pagou essa conta inteira: uma catraca de CI
 * contava emoji dentro de comentário e ficou dez dias vermelha.
 *
 * O texto trocado por espaço mantém o COMPRIMENTO, então as comparações de
 * posição (`indexOf(a) < indexOf(b)`) continuam valendo sobre o mesmo recorte.
 * Literais de texto são pulados para não engolir um `//` de dentro de uma URL.
 *
 * Limite conhecido: literal de expressão regular não é tratado (não existe um
 * dentro das funções que este arquivo inspeciona). E as assertivas POSITIVAS
 * (`toContain("new IntersectionObserver")`) são a sentinela — se este apagador
 * passar a apagar demais, elas caem antes de as negativas virarem vazias.
 */
function semComentarios(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; ) {
    const c = s[i];
    if (c === "/" && s[i + 1] === "/") {
      const fim = s.indexOf("\n", i);
      const ate = fim === -1 ? s.length : fim;
      out += " ".repeat(ate - i);
      i = ate;
    } else if (c === "/" && s[i + 1] === "*") {
      const fim = s.indexOf("*/", i + 2);
      const ate = fim === -1 ? s.length : fim + 2;
      out += (s.slice(i, ate).match(/\n/g) || []).length
        ? s.slice(i, ate).replace(/[^\n]/g, " ")
        : " ".repeat(ate - i);
      i = ate;
    } else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < s.length && s[j] !== c) j += s[j] === "\\" ? 2 : 1;
      out += s.slice(i, Math.min(j + 1, s.length));
      i = j + 1;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/**
 * O corpo de uma `function nome() {...}` do fonte, por contagem de chaves, já
 * sem comentário. A contagem roda sobre o texto sem comentário para uma chave
 * dentro de comentário não desequilibrar a varredura.
 */
const WIDGET_SEM_COMENTARIO = semComentarios(WIDGET);

function corpoDaFuncao(nome: string): string {
  const i = WIDGET.indexOf(`function ${nome}(`);
  expect(i, `função ${nome} não existe mais em widget.js`).toBeGreaterThan(-1);
  const limpo = WIDGET_SEM_COMENTARIO;
  const inicio = limpo.indexOf("{", i);
  let nivel = 0;
  for (let j = inicio; j < limpo.length; j++) {
    if (limpo[j] === "{") nivel++;
    else if (limpo[j] === "}") {
      nivel--;
      if (nivel === 0) return limpo.slice(inicio, j + 1);
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

  it("sai de `reportarAlertaVisto`, e essa função só envia", () => {
    const corpo = corpoDaFuncao("reportarAlertaVisto");
    expect(corpo).toContain(ROTA);
    // Quem decide é a callback do observador. Se a decisão migrasse para cá, a
    // função de envio voltaria a poder ser chamada de qualquer lugar.
    expect(corpo).not.toContain("intersectionRatio");
    expect(corpo).not.toContain("getBoundingClientRect");
  });

  it("é decidido por um `IntersectionObserver`, não por medida de layout", () => {
    const corpo = corpoDaFuncao("observarAlertasNaVista");
    expect(corpo).toContain("new IntersectionObserver");
    expect(corpo).toContain("alertaEntrouNaVista");
    expect(corpo).toContain("threshold");
    // `disconnect` antes de religar: "Limpar" redesenha os balões, e observar os
    // elementos velhos (fora do DOM) é observar o que ninguém vai ver.
    expect(corpo).toContain("disconnect()");
  });

  it("a medida de RETÂNGULO não voltou para o caminho do alerta", () => {
    // Esta é a assertiva que recusa o afrouxamento. A medida antiga é verdadeira
    // para um aviso rolado para fora da vista, e mantê-la ao lado do observador
    // faria a próxima pessoa mexer numa e confiar na outra.
    for (const fn of ["observarAlertasNaVista", "alertaEntrouNaVista", "reportarAlertaVisto", "renderAlertas"]) {
      expect(corpoDaFuncao(fn), `${fn} voltou a medir retângulo`).not.toContain("getBoundingClientRect");
    }
  });

  it("aplica o limiar ANTES de reportar, e o limiar não é zero", () => {
    const corpo = corpoDaFuncao("alertaEntrouNaVista");
    expect(corpo).toContain("isIntersecting");
    expect(corpo).toContain("LIMIAR_ALERTA");
    expect(corpo).toContain("intersectionRatio");
    // A decisão vem antes da chamada que envia.
    expect(corpo.indexOf("intersectionRatio")).toBeLessThan(corpo.indexOf("reportarAlertaVisto("));
    // Limiar 0 contaria um pixel do balão roçando a borda da rolagem — a mesma
    // mentira da medida antiga com outro nome.
    const limiar = WIDGET.match(/var LIMIAR_ALERTA = ([\d.]+);/);
    expect(limiar, "LIMIAR_ALERTA saiu do fonte").not.toBeNull();
    expect(Number(limiar![1])).toBeGreaterThan(0);
  });

  it("conta o aviso mais ALTO que a janela pela fração da janela", () => {
    // Sem este ramo, um aviso comprido nunca cruzaria 0,5 do próprio tamanho e
    // nunca contaria — a campanha mais longa seria justamente a que não mede.
    const corpo = corpoDaFuncao("alertaEntrouNaVista");
    expect(corpo).toContain("rootBounds");
    expect(corpo).toContain("intersectionRect");
    // E o `0` na lista de limiares é o que garante a callback nesse caso.
    expect(corpoDaFuncao("observarAlertasNaVista")).toMatch(/threshold:\s*\[\s*0\s*,/);
  });

  it("reporta UMA vez por campanha por sessão", () => {
    const decide = corpoDaFuncao("alertaEntrouNaVista");
    expect(decide).toContain("alertasReportados[id]");
    // Só o transitório volta para a fila; recusa do portão é assunto encerrado.
    const envia = corpoDaFuncao("reportarAlertaVisto");
    expect(envia).toMatch(/status === 429 \|\| resp\.status >= 500/);
  });

  it("NÃO é enviado ao desenhar: `renderAlertas` liga o observador e nada mais", () => {
    // `renderAlertas` roda no carregamento da página, com o painel fechado.
    const corpo = corpoDaFuncao("renderAlertas");
    expect(corpo).not.toContain(ROTA);
    expect(corpo).not.toMatch(/reportarAlertaVisto\s*\(/);
    expect(corpo).toContain("observarAlertasNaVista()");
    // O id do balão vai para o atributo de onde a callback o lê.
    expect(corpo).toContain('box.setAttribute("data-alerta", a.id)');
  });

  it("NÃO é enviado no handler da config: entrega não é visualização", () => {
    const corpo = corpoDaFuncao("init");
    expect(corpo).not.toContain(ROTA);
    expect(corpo).not.toMatch(/reportarAlertaVisto\s*\(/);
    expect(corpo).not.toMatch(/observarAlertasNaVista\s*\(/);
    // O que o handler da config faz com os alertas é guardar.
    expect(corpo).toContain("alertasDoServidor = data.alertas");
  });

  it("a ABERTURA do painel não reporta mais por conta própria", () => {
    // Trocar `display:none` por `display:flex` muda o layout, e o observador
    // dispara sozinho no quadro seguinte. Uma chamada à mão aqui seria um segundo
    // caminho de reporte — e, pior, um que dispara na abertura mesmo quando o
    // aviso está rolado para fora da vista, que é o defeito consertado.
    const corpo = corpoDaFuncao("toggle");
    expect(corpo).not.toContain(ROTA);
    expect(corpo).not.toMatch(/reportarAlertaVisto\s*\(/);
    expect(corpo).not.toMatch(/observarAlertasNaVista\s*\(/);
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

/**
 * A AUTO-ABERTURA PELO AVISO — as quatro propriedades que a tornam aceitável.
 *
 * O aviso nascia FORA DA VISTA para quem tem histórico: `renderAlertas` desenha
 * antes de `renderHistory`, e o histórico termina rolando para o fim. A medida de
 * viewport estava certa em não contar — e por estar certa, contaria quase zero.
 * A resposta do dono foi deixar o aviso de passivo: badge na bolha e, quando é
 * campanha e o painel está minimizado, o painel se abre com o aviso.
 *
 * Um painel que se abre sozinho é hostil em três jeitos diferentes, e é por isso
 * que estas assertivas existem. Todas são estruturais e se leem no fonte; o que
 * exigiria DOM (o `scrollTop` de fato acontecendo, o cursor não saindo do campo
 * do host) está declarado no relatório como limite do arreio, não fingido aqui.
 */
describe("a auto-abertura do painel pelo aviso", () => {
  it("é o único caminho que passa `paraAlerta`, e ele vem de PROPRIEDADE", () => {
    // `addEventListener("click", toggle)` entrega o EVENTO como primeiro
    // argumento. Um booleano posicional seria satisfeito por qualquer
    // `MouseEvent` (objeto é verdadeiro), e todo clique em "minimizar" viraria
    // abertura-sem-foco. Ler de uma propriedade que evento não tem é o que
    // impede isso.
    expect(corpoDaFuncao("toggle")).toContain("opts && opts.paraAlerta === true");
    const chamadas = WIDGET_SEM_COMENTARIO.match(/toggle\(\{[^}]*\}\)/g) || [];
    expect(chamadas).toEqual(["toggle({ paraAlerta: true })"]);
  });

  it("NÃO move o foco: o caminho do aviso roda `verAlertaNoTopo`, que não foca", () => {
    // Quem está digitando uma matrícula na folha continua digitando. A prova
    // estrutural é que a única função com `focus()` na saída do `toggle` é a do
    // caminho manual, e o ternário escolhe uma OU outra.
    expect(corpoDaFuncao("toggle")).toContain("setTimeout(paraAlerta ? verAlertaNoTopo : focarEntrada, 50)");
    expect(corpoDaFuncao("verAlertaNoTopo")).not.toContain("focus");
    expect(corpoDaFuncao("focarEntrada")).toContain("inputEl.focus()");
    // E o `toggle` não voltou a focar por fora do ternário.
    expect(corpoDaFuncao("toggle")).not.toContain("focus(");
    // A função que decide a abertura também não mexe em foco.
    expect(corpoDaFuncao("anunciarAlertasNovos")).not.toContain("focus");
  });

  it("NÃO rola a página do host: `scrollTop` do container, nunca `scrollIntoView`", () => {
    // `scrollIntoView` rola TODOS os ancestrais roláveis, e o mais externo é o
    // documento do ERP — a tela do cliente saltando por causa do widget.
    const corpo = corpoDaFuncao("verAlertaNoTopo");
    expect(corpo).toContain("messagesEl.scrollTop = 0");
    expect(corpo).not.toContain("scrollIntoView");
    expect(corpo).not.toContain("window.scroll");
  });

  it("abre UMA vez por aviso por sessão de aba, com marcador em `sessionStorage`", () => {
    // `localStorage` guardaria para sempre (o aviso nunca mais abriria o painel);
    // variável de módulo não guardaria nada (cada navegação do APEX recarrega o
    // arquivo, e o painel abriria em TODAS). `sessionStorage` é a única das três
    // que sobrevive à navegação e morre com a aba.
    expect(WIDGET).toMatch(/var SS_ALERTA_ANUNCIADO = "kb\.widget\.alerta\.anunciado\." \+ KEY \+ ESCOPO_SESSAO;/);
    for (const fn of ["alertasAnunciados", "marcarAnunciados"]) {
      expect(corpoDaFuncao(fn)).toContain("sessionStorage");
      expect(corpoDaFuncao(fn)).not.toContain("localStorage");
    }
    // A gravação é PRÉ-CONDIÇÃO do anúncio: anunciar sem gravar repetiria a
    // abertura na navegação seguinte, que é o comportamento hostil.
    const decide = corpoDaFuncao("anunciarAlertasNovos");
    expect(decide).toContain("if (!marcarAnunciados(novos)) return;");
    expect(decide.indexOf("marcarAnunciados")).toBeLessThan(decide.indexOf("toggle({"));
  });

  it("respeita o fechamento deliberado: minimizar dispensa a abertura na sessão", () => {
    // Abertura automática que briga com um fechamento deliberado é a pior versão
    // deste recurso. Quem registra é o ramo de FECHAR do toggle, e quem consulta
    // é a decisão de abrir — as duas coisas, ou a regra não existe.
    expect(corpoDaFuncao("toggle")).toContain("dispensarAutoAbertura()");
    expect(corpoDaFuncao("anunciarAlertasNovos")).toContain("if (autoAberturaDispensada()) return;");
    // Sem armazenamento, a resposta é "dispensado": erra para o lado de não
    // incomodar, que é a direção certa num painel usado o dia inteiro.
    expect(corpoDaFuncao("autoAberturaDispensada")).toMatch(/catch\s*\{\s*return true;/);
  });

  it("não abre sozinho no CELULAR, onde o painel é tela cheia", () => {
    // No desktop o painel é um cartão no canto; no celular `aplicarExpansao` põe
    // a classe `full` e ele ocupa a tela inteira. Abrir sozinho ali cobriria o
    // formulário de quem está no meio de um lançamento — e o badge, que resolve o
    // defeito original, continua aparecendo.
    const decide = corpoDaFuncao("anunciarAlertasNovos");
    expect(decide).toContain("if (ehMobile()) return;");
    expect(decide.indexOf("ehMobile()")).toBeLessThan(decide.indexOf("toggle({"));
  });

  it("não afrouxa a contagem: nada reporta visualização no caminho da abertura", () => {
    // O número continua significando "entrou no campo de visão". Ele sobe porque
    // a pessoa passou a ver o aviso, não porque a régua mudou.
    for (const fn of ["anunciarAlertasNovos", "verAlertaNoTopo", "avisarAlerta", "marcarAnunciados"]) {
      expect(corpoDaFuncao(fn), `${fn} reporta visualização`).not.toContain(ROTA);
      expect(corpoDaFuncao(fn), `${fn} reporta visualização`).not.toMatch(/reportarAlertaVisto\s*\(/);
    }
  });
});

describe("o badge de não lido do aviso", () => {
  it("reusa o contador que já existia para a resposta não lida", () => {
    // O sinal de "tem coisa para ler" não é inventado aqui: `_naoLidas` já
    // pintava o número na bolha e o "(N)" no título da aba para a resposta que
    // chega com o widget minimizado. Dois indicadores para a mesma pergunta
    // seriam dois números para explicar ao cliente.
    const corpo = corpoDaFuncao("avisarAlerta");
    expect(corpo).toContain("_naoLidas += n");
    expect(corpo).toContain("mostrarBadge()");
    expect(corpo).toContain("atualizarTitulo()");
    // Painel aberto não ganha badge: contar como não lido o que está na tela é a
    // mentira que o resto deste arquivo existe para evitar.
    expect(corpo).toContain("if (open || !n) return;");
  });

  it("não toca o bip: o caminho roda sem gesto do usuário", () => {
    // Política de autoplay: sem gesto, `tocarBip` fica em silêncio (ou reclama no
    // console do host). Código que parece avisar e não avisa é pior que nenhum.
    expect(corpoDaFuncao("avisarAlerta")).not.toContain("tocarBip");
    // E a auto-abertura não gasta um gesto que não houve.
    expect(corpoDaFuncao("toggle")).toContain("if (!paraAlerta) desbloquearAudio();");
  });
});

describe("o destaque do aviso novo", () => {
  it("é decidido no desenho, pelo marcador de sessão, e é só visual", () => {
    const corpo = corpoDaFuncao("renderAlertas");
    expect(corpo).toContain("var ehNovo = !!anunciados && anunciados.indexOf(a.id) === -1;");
    expect(corpo).toContain('box.classList.add("kbav-novo")');
    // Rótulo diferente para o aviso novo, pelo dicionário (o widget fala 8
    // idiomas; texto cru aqui só apareceria em português).
    expect(corpo).toContain('rotTxt.textContent = ehNovo ? wt("avisoNovo") : wt("aviso")');
    expect(WIDGET).toContain('avisoNovo: "Novo aviso"');
  });

  it("o pulso PARA sozinho e respeita `prefers-reduced-motion`", () => {
    // Animação infinita dentro do ERP de um cliente é ruído permanente. Duas
    // batidas chamam atenção e acabam — sem JS para desligar.
    expect(WIDGET).toMatch(/animation:kbavnovo 1\.5s ease-out 2/);
    expect(WIDGET).toContain("@keyframes kbavnovo");
    expect(WIDGET).toMatch(/@media\(prefers-reduced-motion:reduce\)\{\.kbav\.kbav-novo\{animation:none\}\}/);
  });

  it("não vira autoridade: continua sem filtrar o que o servidor mandou", () => {
    // O destaque é aparência. Quem decide quem vê o quê é o SQL — este arquivo é
    // público, e filtro aqui seria sugestão.
    const corpo = corpoDaFuncao("renderAlertas");
    expect(corpo).not.toContain(".regra");
    expect(corpo).not.toMatch(/alertasDoServidor\s*\.\s*filter/);
  });
});

describe("o widget não decide elegibilidade nem repetição", () => {
  it("não filtra os alertas do servidor por base, portal ou regra", () => {
    // `widget.js` é público: filtro aqui é sugestão, não cerca — e um filtro que
    // parece cerca faz a próxima pessoa confiar nele. O corte é em SQL
    // (`public.alertas_para`), e por isso a `regra` nem chega ao navegador.
    const corpo = corpoDaFuncao("renderAlertas");
    expect(corpo).not.toContain(".regra");
    expect(corpo).not.toMatch(/alertasDoServidor\s*\.\s*filter/);
    expect(WIDGET).not.toMatch(/alertasDoServidor\s*=\s*[^;]*\.filter\(/);
  });

  it("não conhece o interruptor `repetir`: quem não repete o servidor não entrega", () => {
    // "Uma vez por pessoa" é predicado de `alertas_para`, que para de devolver a
    // campanha já vista. Se a bandeira chegasse ao navegador, a próxima pessoa
    // escreveria o filtro aqui — em arquivo público, portanto sem cerca.
    // No fonte SEM comentário e olhando acesso a propriedade: "repetir" aparece
    // como palavra portuguesa em vários comentários e numa mensagem de tela.
    expect(WIDGET_SEM_COMENTARIO).not.toMatch(/\.repetir\b/);
  });
});
