(function () {
  "use strict";
  // Marcador de versão: sem ele não dá para saber se o navegador (ou o proxy) está
  // servindo um widget.js VELHO em cache — e um bug "que não foi corrigido" costuma
  // ser só isso. Aparece no console em toda carga e fica em window.__KB_WIDGET__.
  var KB_WIDGET_BUILD = "2026-08-08.lov-modal";
  try {
    window.__KB_WIDGET__ = KB_WIDGET_BUILD;
    if (window.console && console.log) console.log("[kb-widget] build " + KB_WIDGET_BUILD);
  } catch { }
  // ==== Bootstrap: descobre a chave e a URL base a partir do próprio <script> ====
  var script =
    document.currentScript ||
    (function () {
      var s = document.getElementsByTagName("script");
      return s[s.length - 1];
    })();
  var KEY = script.getAttribute("data-key");
  if (!KEY) {
    console.error("[widget] data-key ausente no <script>.");
    return;
  }
  // Base da API = a URL do PRÓPRIO script, sem o "/widget.js" — assim funciona tanto
  // na raiz do domínio quanto sob um prefixo de caminho (a Natcorp serve em
  // /natcorp/ia). Usar só o `origin` fazia toda chamada cair na raiz e tomar 404.
  var API = new URL(script.src).href.replace(/\/widget\.js(\?.*)?$/, "");
  var LS_POS = "kb.widget.pos." + KEY;
  var LS_PANEL = "kb.widget.panelpos." + KEY; // posição própria da JANELA (arrastada pelo cabeçalho)
  var LS_SID = "kb.widget.sid." + KEY;
  // Abaixo desta largura o painel vira TELA CHEIA (modo app): sem transparência ao
  // rolar, sem arrastar, sem expandir. É o mesmo 640 que a CSS e o guard do modo
  // expandido já usavam — a constante existe para os três nunca divergirem (a CSS
  // é string, então dá para interpolar).
  var BP_MOBILE = 640;
  // Idioma escolhido no seletor: usa a ontologia daquele idioma + responde nele. Espelha
  // src/lib/i18n/languages.ts (pt = canônico). Guardado por chave do widget.
  var LS_LANG = "kb.widget.lang." + KEY;
  var LANGS = [
    { code: "pt", nativo: "Português" }, { code: "en", nativo: "English" },
    { code: "es", nativo: "Español" }, { code: "fr", nativo: "Français" },
    { code: "de", nativo: "Deutsch" }, { code: "it", nativo: "Italiano" },
    { code: "ja", nativo: "日本語" }, { code: "zh", nativo: "中文" },
  ];
  // (TEMPORÁRIO) Tradução ESCONDIDA do usuário final a pedido do produto — em
  // avaliação, NÃO removida. Reverter = trocar para true (só isto).
  // O backend (/api/v1/translate-ui), o parâmetro `lang` do chat, o I18N da casca
  // e o admin de Ontologia continuam intactos e voltam a funcionar sozinhos.
  var MOSTRAR_TRADUZIR = false;
  var widgetLang = "pt";
  try { widgetLang = localStorage.getItem(LS_LANG) || "pt"; } catch (e) { }
  // Escondido o seletor, quem já tinha "English" salvo continuaria recebendo em
  // inglês SEM ter como voltar. Sobrepõe em runtime — sem apagar o localStorage,
  // para a escolha do usuário voltar quando o recurso voltar.
  if (!MOSTRAR_TRADUZIR) widgetLang = "pt";
  // Textos da PRÓPRIA interface do widget por idioma (o chatbot responde no idioma; a casca
  // também acompanha). Fallback no PT. Só as strings mais visíveis — o resto segue em PT.
  var I18N = {
    pt: { placeholder: "Escreva ou fale sua pergunta…", baseDados: "Base de Dados", historico: "Histórico", traduzir: "Traduzir a tela", limpar: "Limpar" },
    en: { placeholder: "Type or speak your question…", baseDados: "Data sources", historico: "History", traduzir: "Translate screen", limpar: "Clear" },
    es: { placeholder: "Escribe o habla tu pregunta…", baseDados: "Base de datos", historico: "Historial", traduzir: "Traducir pantalla", limpar: "Limpiar" },
    fr: { placeholder: "Écrivez ou dites votre question…", baseDados: "Sources de données", historico: "Historique", traduzir: "Traduire l'écran", limpar: "Effacer" },
    de: { placeholder: "Schreiben oder sprechen Sie Ihre Frage…", baseDados: "Datenquellen", historico: "Verlauf", traduzir: "Bildschirm übersetzen", limpar: "Löschen" },
    it: { placeholder: "Scrivi o pronuncia la tua domanda…", baseDados: "Fonti dati", historico: "Cronologia", traduzir: "Traduci schermo", limpar: "Cancella" },
    ja: { placeholder: "質問を入力するか話してください…", baseDados: "データソース", historico: "履歴", traduzir: "画面を翻訳", limpar: "クリア" },
    zh: { placeholder: "输入或说出您的问题…", baseDados: "数据源", historico: "历史", traduzir: "翻译屏幕", limpar: "清除" },
  };
  function wt(k) { return (I18N[widgetLang] && I18N[widgetLang][k]) || I18N.pt[k] || k; }
  // Instante da última limpeza VISUAL da conversa (o histórico anterior não volta).
  var LS_CLEARED = "kb.widget.cleared." + KEY;
  // Rascunho do campo de texto (preserva o que foi digitado ao minimizar/recarregar).
  var LS_DRAFT = "kb.widget.draft." + KEY;

  // Parâmetros de rastreio: de onde/quem veio a conversa. Lidos do atributo
  // data-* do <script> (tem prioridade) ou da querystring da página (p_*).
  // Só DADO — nunca vão para o prompt da IA; servem para o admin filtrar.
  // Rastreio à prova de adulteração: o backend do cliente gera um TOKEN cifrado
  // (AES-GCM, formato kbt1.…) com os parâmetros p_* e o passa em `data-token` ou
  // em `?kbt=` na URL da página. O widget só carrega esse token opaco — os p_*
  // em texto NÃO são mais aceitos, então ninguém forja identidade no console.
  var track = (function () {
    var tok = script.getAttribute("data-token");
    if (!tok) {
      try {
        tok = new URLSearchParams(window.location.search).get("kbt");
      } catch {
        tok = null;
      }
    }
    tok = tok ? String(tok).trim() : "";
    return tok ? { token: tok } : null;
  })();

  // Tela atual do usuário (Fase 4): o widget roda na página do produto do
  // cliente, então href/path/título descrevem ONDE a pessoa está. Só DADO —
  // ajuda a IA a entender perguntas vagas ("como faço isso?"). Lido a cada
  // pergunta (a página pode mudar numa SPA). NUNCA pede URL nem login.
  function pageContext() {
    try {
      return {
        href: String(location.href).slice(0, 500),
        path: String(location.pathname || "").slice(0, 300),
        title: String(document.title || "").slice(0, 300),
      };
    } catch {
      return null;
    }
  }

  // Varredura da PÁGINA: coleta campos (rótulo + valor, mascarando segredos),
  // e o texto visível (títulos, tabelas/relatórios, MODAIS) — inclusive iframes
  // de MESMA ORIGEM (cross-origin é bloqueado pelo navegador). Vira DADO para a
  // IA interpretar a tela em que o usuário está. Nunca captura senha/segredo.
  var SCAN_MAX = 12000; // maior: as TABELAS estruturadas (prioritárias) vêm antes do texto
  function scanTexto(s) {
    return String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  }
  function scanValor(el) {
    var t = (el.type || "").toLowerCase();
    if (t === "password") return "(oculto)";
    var nome = (el.name || "") + " " + (el.id || "") + " " + (el.getAttribute("autocomplete") || "");
    if (/senha|password|cvv|cvc|secret|token|pin|otp|cart(a|ã)o|card/i.test(nome)) return "(oculto)";
    if (t === "checkbox" || t === "radio") return el.checked ? "marcado" : "desmarcado";
    return scanTexto(el.value).slice(0, 120);
  }
  function scanDoc(doc, marca, campos, textos, tabelas) {
    if (!doc) return;
    var lm = {};
    try {
      doc.querySelectorAll("label[for]").forEach(function (l) { lm[l.getAttribute("for")] = scanTexto(l.textContent); });
    } catch { }
    try {
      doc.querySelectorAll("input,select,textarea").forEach(function (el) {
        if ((el.type || "") === "hidden") return;
        // Pula só o realmente invisível. `getClientRects` (≠ offsetParent) NÃO
        // descarta campos `position:fixed` — os de modais entram.
        if (el.getClientRects && el.getClientRects().length === 0) return;
        var rot = rotuloEspecial(el) || el.getAttribute("aria-label") || lm[el.id] || el.placeholder || el.name || el.id || (el.type || "campo");
        var val = scanValor(el);
        campos.push((marca ? marca + " " : "") + "- " + scanTexto(rot) + (val ? ": " + val : " (vazio)"));
      });
    } catch { }
    // Relatórios APEX estruturados (Classic Report / Interactive Report / Interactive Grid).
    if (tabelas) { try { scanReports(doc, marca, tabelas); } catch { } }
    try {
      var txt = scanTexto(doc.body ? doc.body.innerText : "");
      if (txt) textos.push((marca ? marca + " " : "") + txt);
    } catch { }
    // iframes de MESMA ORIGEM (cross-origin lança e retorna null → ignorado)
    try {
      doc.querySelectorAll("iframe").forEach(function (f) {
        var d = null;
        try { d = f.contentDocument; } catch { d = null; }
        if (d) scanDoc(d, "[IFRAME]", campos, textos, tabelas);
      });
    } catch { }
  }

  // Texto limpo de uma célula (limita tamanho).
  function celTxt(el) { return scanTexto(el ? (el.innerText || el.textContent) : "").slice(0, 200); }
  // Nome legível do relatório: título da região que o contém.
  function nomeRegiao(el) {
    try {
      var reg = el.closest && el.closest(".t-Region, .a-Region, .a-IRR-region, [role='region'], [id$='_region']");
      if (reg) {
        var h = reg.querySelector(".t-Region-title, .a-IRR-title, .a-CardView-title, h1, h2, h3, [id$='_heading']");
        if (h) { var t = scanTexto(h.textContent); if (t) return t.slice(0, 80); }
        var al = reg.getAttribute("aria-label"); if (al) return scanTexto(al).slice(0, 80);
      }
    } catch { }
    return "";
  }
  // Coleta multi-página em andamento (dados de TODAS as páginas de um IR).
  var _harvested = null; // { key, colunas, linhas } — sobrepõe a página visível no scan
  var _harvestCache = null; // { key, fp, nome, colunas, linhas } — coleta reutilizável entre perguntas
  // B — relatório coletado com SUCESSO porém VAZIO (0 linhas): sinal p/ o servidor
  // oferecer FILTRAR + pesquisar em vez de "não há dados". { nome } enquanto vazio.
  var _relatorioVazioSinal = null;
  // Fonte de dados escolhida ("relatorio" | "ia") e o relatório a que se aplica —
  // para perguntar UMA vez por relatório e reaproveitar nas próximas mensagens.
  var _fonte = null, _fonteKey = null;

  // Chave estável de uma região de relatório (para casar a coleta multi-página).
  function regionKey(rv) {
    try {
      var el = rv.closest ? (rv.closest(".a-IRR") || rv) : rv;
      return el.id || rv.id || nomeRegiao(rv) || "";
    } catch { return ""; }
  }
  // Chave do relatório PRINCIPAL da tela (IR/IG) — para lembrar a fonte escolhida
  // por relatório. "" quando não há relatório na tela.
  function keyRelatorioTela() {
    try {
      var rv = document.querySelector(".a-IRR-reportView, .a-IRR, .a-GV");
      return rv ? regionKey(rv) : "";
    } catch { return ""; }
  }
  // O IR tem paginação por lotes ("Próximo/Anterior")? Busca na REGIÃO do IR
  // (.a-IRR), não só no reportView — no APEX a paginação (.a-IRR-paginationWrap) é
  // IRMÃ do reportView, não filha; procurar só no reportView dava sempre falso.
  function temPaginacao(rv) { try { var reg = (rv.closest && rv.closest(".a-IRR")) || rv; return !!reg.querySelector(".a-IRR-pagination"); } catch { return false; } }
  // Lê o RÓTULO de paginação ("1 - 50 de 2.000" / "1-50 of 2000" / "linhas 1 a 50 de
  // 2000") e devolve { de, ate, total } em números (ou null). É a FONTE DA VERDADE
  // sobre "há mais páginas" — NÃO depende da classe/tema do botão. Sem isto, um tema
  // que não use a classe esperada faz o relatório passar por "não paginado" e a IA
  // analisa só a página visível (bug grave: 50 de 2000).
  function infoPag(rv) {
    try {
      var reg = (rv.closest && rv.closest(".a-IRR")) || rv;
      var num = function (s) { return s ? parseInt(String(s).replace(/[^\d]/g, ""), 10) || null : null; };
      // FONTE MAIS CONFIÁVEL: o aria-label da <table> do IR traz "Total de Linhas = N",
      // "Início das Linhas Exibidas = X", "Fim das Linhas Exibidas = Y" (mesmo quando o
      // rótulo de paginação é só "46 - 50" sem total, ou estamos na última página).
      var tbl = reg.querySelector("table.a-IRR-table[aria-label]");
      if (tbl) {
        var al = tbl.getAttribute("aria-label") || "";
        var mt = al.match(/Total (?:de Linhas|Rows)\s*=\s*([\d.,]+)/i);
        var md = al.match(/(?:In[íi]cio das Linhas Exibidas|Displayed Row Start)\s*=\s*([\d.,]+)/i);
        var ma = al.match(/(?:Fim das Linhas Exibidas|Displayed Row End)\s*=\s*([\d.,]+)/i);
        if (mt || md || ma) return { de: md ? num(md[1]) : null, ate: ma ? num(ma[1]) : null, total: mt ? num(mt[1]) : null };
      }
      // Fallback: rótulo de paginação ("1 - 50 de 2.000" / "1-50 of 2000" / "1 a 50 de 2000").
      var lab = reg.querySelector(".a-IRR-pagination-label, .a-IRR-pagination");
      var txt = lab ? scanTexto(lab.textContent) : "";
      if (!txt) return { de: null, ate: null, total: null };
      var m = txt.match(/(\d[\d.]*)\s*[-–]\s*(\d[\d.]*)(?:\s*(?:de|of)\s*(\d[\d.]*))?/i)
        || txt.match(/(\d[\d.]*)\s+a\s+(\d[\d.]*)\s+de\s+(\d[\d.]*)/i);
      if (m) return { de: num(m[1]), ate: num(m[2]), total: num(m[3]) };
      var m2 = txt.match(/(?:de|of)\s*(\d[\d.]*)/i);
      if (m2) return { de: null, ate: null, total: num(m2[1]) };
      return { de: null, ate: null, total: null };
    } catch (e) { return { de: null, ate: null, total: null }; }
  }
  // Quantas linhas de dados estão VISÍVEIS na página atual do IR.
  function linhasVisiveis(rv) { try { return rv.querySelectorAll("tbody tr td[headers]").length ? rv.querySelectorAll("tbody tr").length : 0; } catch { return 0; } }
  // Há mais páginas do que a visível? total>visível, OU fim<total, OU começo>1
  // (estamos além da 1ª página), OU há "Próximo"/"Anterior" HABILITADO. Cobre a
  // ÚLTIMA página (sem "Próximo") e temas sem "de N" no rótulo. Independe da classe.
  function haMaisPaginas(rv, visiveis) {
    var ip = infoPag(rv);
    var vis = visiveis != null ? visiveis : linhasVisiveis(rv);
    if (ip.total != null && ip.total > vis) return true;
    if (ip.total != null && ip.ate != null && ip.ate < ip.total) return true;
    if (ip.de != null && ip.de > 1) return true; // começo > 1 → há páginas anteriores
    var nx = botaoProximo(rv);
    if (nx && !ehDesabilitado(nx)) return true;
    var pv = botaoAnterior(rv);
    return !!(pv && !ehDesabilitado(pv)); // "Anterior" habilitado → é paginado
  }
  // Botão de paginação do IR por rótulo/título (PT ou EN). `rx` = o que casar,
  // `rxNeg` = o que NÃO casar (evita pegar o oposto).
  // Resolve para o elemento CLICÁVEL (o botão/link), não o <li> que o envolve —
  // clicar no <li> não dispara a paginação do APEX.
  function clicavel(el) {
    if (!el) return null;
    var tag = (el.tagName || "").toUpperCase();
    if (tag === "BUTTON" || tag === "A") return el;
    var inner = el.querySelector && el.querySelector("button, a, [role='button']");
    return inner || el;
  }
  function varrerBotoes(cands, rx, rxNeg, iconClass) {
    for (var i = 0; i < cands.length; i++) {
      var el = cands[i];
      var t = (el.getAttribute("title") || "") + " " + (el.getAttribute("aria-label") || "") + " " + scanTexto(el.textContent);
      if (rx.test(t) && !rxNeg.test(t)) return clicavel(el);
      // Fallback por ÍCONE (temas sem title/aria): chevron esquerda=anterior, direita=próximo.
      if (iconClass && el.querySelector && el.querySelector("." + iconClass)) return clicavel(el);
    }
    return null;
  }
  function botaoPag(rv, rx, rxNeg, iconClass) {
    try {
      var reg = (rv.closest && rv.closest(".a-IRR")) || rv;
      // 1) Candidatos específicos de paginação do IR.
      var esp = reg.querySelectorAll(".a-IRR-button--pagination, .a-IRR-pagination a, .a-IRR-pagination button, .a-IRR-pagination-item, .a-IRR-pagination [role='button']");
      var hit = varrerBotoes(esp, rx, rxNeg, iconClass);
      if (hit) return hit;
      // 2) Fallback AMPLO na região do IR (temas onde o botão não usa a classe de
      //    paginação): qualquer botão/link cujo título/rótulo/ícone bata. Mantido
      //    dentro da região do relatório para não pegar controles de outra área.
      var amplos = reg.querySelectorAll("button, a, [role='button']");
      return varrerBotoes(amplos, rx, rxNeg, iconClass);
    } catch { }
    return null;
  }
  function botaoProximo(rv) { return botaoPag(rv, /pr[óo]ximo|next/i, /anterior|previous/i, "icon-right-chevron"); }
  function botaoAnterior(rv) { return botaoPag(rv, /anterior|previous|\bprev\b/i, /pr[óo]ximo|next/i, "icon-left-chevron"); }
  function ehDesabilitado(el) {
    if (!el) return true;
    try {
      if (el.disabled) return true;
      if (/is-disabled|u-disabled|apex_disabled/.test(el.className || "")) return true;
      if (el.getAttribute("aria-disabled") === "true") return true;
      var li = el.closest && el.closest("li, .a-IRR-pagination-item");
      if (li && /is-disabled/.test(li.className || "")) return true;
    } catch { }
    return false;
  }
  // Extrai UMA região de IR (colunas por th[id], dados por td[headers]); genérico
  // — não assume colunas fixas, serve a qualquer tela.
  function extrairIRRegiao(rv, maxLin) {
    var LIN = maxLin || 60, idx = {}, colunas = [];
    rv.querySelectorAll("th.a-IRR-header").forEach(function (th) {
      var link = th.querySelector(".a-IRR-headerLink");
      var id = th.id || (link && link.getAttribute("data-column") ? "C" + link.getAttribute("data-column") : "");
      if (!id || idx[id] != null) return;
      var nome = celTxt(link || th);
      if (!nome) return;
      idx[id] = colunas.length; colunas.push(nome);
    });
    if (colunas.length < 1) return null;
    var linhas = [];
    rv.querySelectorAll("tbody tr").forEach(function (tr) {
      if (linhas.length >= LIN) return;
      var tds = tr.querySelectorAll("td[headers]");
      if (!tds.length) return;
      var row = []; for (var i = 0; i < colunas.length; i++) row.push("");
      Array.prototype.forEach.call(tds, function (td) {
        var h = (td.getAttribute("headers") || "").split(/\s+/)[0];
        if (idx[h] != null) row[idx[h]] = celTxt(td);
      });
      if (row.join("").trim()) linhas.push(row);
    });
    return linhas.length ? { colunas: colunas, linhas: linhas } : null;
  }
  // ── DESTAQUE (realce EFÊMERO do que a IA aponta): campos/botões, colunas e linhas
  // do IR. Não altera a tela do APEX — só um contorno/fundo temporário via classe CSS.
  var _destacados = [], _destaqueTimer = null;
  function ensureDestaqueCSS() {
    if (document.getElementById("kb-destaque-css")) return;
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    try {
      var st = document.createElement("style");
      st.id = "kb-destaque-css";
      st.textContent =
        ".kb-destaque-el{outline:2.5px solid " + pc + " !important;outline-offset:1px;border-radius:4px;box-shadow:0 0 0 4px " + pc + "26 !important;}" +
        ".kb-destaque-cell{background:" + pc + "2b !important;box-shadow:inset 0 0 0 1px " + pc + "55 !important;}";
      (document.head || document.documentElement).appendChild(st);
    } catch (e) { }
  }
  function limparDestaques() {
    clearTimeout(_destaqueTimer);
    _destacados.forEach(function (el) { try { el.classList.remove("kb-destaque-el", "kb-destaque-cell"); } catch (e) { } });
    _destacados = [];
  }
  function marcarDestaque(el, cls) { if (el) { try { el.classList.add(cls); _destacados.push(el); } catch (e) { } } }
  // Mapa nome-da-coluna (minúsculo) → id do header (Cxxx) na região do IR.
  function mapaColunas(reg) {
    var m = {};
    try {
      reg.querySelectorAll("th.a-IRR-header").forEach(function (th) {
        var link = th.querySelector(".a-IRR-headerLink");
        var nome = celTxt(link || th).toLowerCase();
        var id = th.id || (link && link.getAttribute("data-column") ? "C" + link.getAttribute("data-column") : "");
        if (nome && id) m[nome] = id;
      });
    } catch (e) { }
    return m;
  }
  function aplicarDestaque(evt) {
    try {
      limparDestaques();
      ensureDestaqueCSS();
      var primeiro = null;
      (evt.campos || []).forEach(function (ref) {
        var el = fieldEl(ref);
        if (el) { marcarDestaque(el, "kb-destaque-el"); if (!primeiro) primeiro = el; }
      });
      var rv = document.querySelector(".a-IRR-reportView, .a-IRR");
      if (rv) {
        var reg = (rv.closest && rv.closest(".a-IRR")) || rv;
        var cmap = mapaColunas(reg); // usado só para casar as LINHAS por coluna-chave
        // LINHAS por conteúdo — UNIÃO dos predicados {coluna, valor}
        var preds = (evt.linhas || [])
          .map(function (p) { return { id: cmap[String(p && p.coluna || "").trim().toLowerCase()], valor: String(p && p.valor == null ? "" : p.valor).trim().toLowerCase() }; })
          .filter(function (p) { return p.id && p.valor; });
        if (preds.length) {
          rv.querySelectorAll("tbody tr").forEach(function (tr) {
            var casa = preds.some(function (p) {
              var td = null;
              tr.querySelectorAll("td[headers]").forEach(function (c) { if (!td && (c.getAttribute("headers") || "").split(/\s+/)[0] === p.id) td = c; });
              return td && celTxt(td).toLowerCase().indexOf(p.valor) >= 0;
            });
            if (casa) { tr.querySelectorAll("td[headers]").forEach(function (td) { marcarDestaque(td, "kb-destaque-cell"); }); if (!primeiro) primeiro = tr; }
          });
        }
      }
      if (_destacados.length) {
        try { if (primeiro && primeiro.scrollIntoView) primeiro.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { }
        clearTimeout(_destaqueTimer);
        _destaqueTimer = setTimeout(limparDestaques, 20000); // realce some após ~20s
      } else { diag("destaque: nada casou (campos/colunas/linhas)"); }
    } catch (e) { diag("destaque: exceção " + (e && e.message)); }
  }
  // Assinatura da página atual (para detectar a troca após clicar "Próximo"). Lê o
  // rótulo na REGIÃO do IR (o label é irmão do reportView) — é o sinal mais
  // confiável de troca de página, sobretudo quando o rótulo não traz total ("51 - 100").
  function assinaturaPagina(rv) {
    var reg = (rv.closest && rv.closest(".a-IRR")) || rv;
    var lab = reg.querySelector(".a-IRR-pagination-label, .a-IRR-pagination");
    var first = rv.querySelector("tbody tr td[headers]");
    return (lab ? scanTexto(lab.textContent) : "") + "|" + (first ? scanTexto(first.textContent) : "") + "|" + rv.querySelectorAll("tbody tr").length;
  }
  function esperarMudanca(rv, antes, timeout) {
    return new Promise(function (resolve) {
      var t0 = Date.now();
      (function tick() {
        if (assinaturaPagina(rv) !== antes) return resolve(true);
        if (Date.now() - t0 > timeout) return resolve(false);
        setTimeout(tick, 150);
      })();
    });
  }
  // Espera o "Fim das Linhas Exibidas" AVANÇAR (autoridade do próprio APEX), não só a
  // assinatura visual — sobrevive a páginas com linhas visualmente IGUAIS, onde a
  // assinatura (1º texto + contagem) pode repetir e faria a coleta parar cedo.
  // Resolve com o novo `ate` (>0) ou 0 se estourou o tempo sem avançar.
  function esperarAvanco(rv, ateAntes, timeout) {
    return new Promise(function (resolve) {
      var t0 = Date.now();
      (function tick() {
        var ip = infoPag(rv);
        if (ip && ip.ate && ip.ate > ateAntes) return resolve(ip.ate);
        if (Date.now() - t0 > timeout) return resolve(0);
        setTimeout(tick, 150);
      })();
    });
  }
  // "Impressão digital" do estado do relatório: total de registros + colunas +
  // termo de busca + FILTROS ATIVOS (chips do Ações). INVARIANTE à página exibida, mas
  // SENSÍVEL a filtro/busca/colunas — permite reusar a coleta em cache e detectar
  // mudança de resultado (novo filtro / submit na página). Se a fingerprint é IGUAL à
  // da última coleta, os dados não mudaram → NÃO reconsulta a procedure (usa o cache).
  // (Ordenação NÃO entra: temos todas as linhas e reordenamos no servidor.)
  function fingerprintRelatorio(rv) {
    try {
      var irr = (rv.closest && rv.closest(".a-IRR")) || rv;
      // Total pela FONTE MAIS CONFIÁVEL (aria-label "Total de Linhas = N"); muda quando
      // o filtro muda o resultado. Fallback pro rótulo "de N".
      var total = infoPag(rv).total;
      if (total == null) { var lab = irr.querySelector(".a-IRR-pagination-label"); if (lab) { var m = scanTexto(lab.textContent).match(/de[\s ]+([\d.,]+)/i); if (m) total = m[1].replace(/\D/g, ""); } }
      var cols = [];
      rv.querySelectorAll("th.a-IRR-header .a-IRR-headerLink").forEach(function (a) { cols.push(scanTexto(a.textContent)); });
      var busca = "";
      var s = irr.querySelector(".a-IRR-search-field, input.a-IRR-search-field, input[id$='_search_field']");
      if (s) busca = String(s.value || "");
      // Chips de filtro do Ações (ex.: "Texto da linha contém 'Analista'") — captura o
      // filtro mesmo quando o total coincide. Ordenados p/ ser estável.
      var filtros = [];
      irr.querySelectorAll(".a-IRR-controlsLabel").forEach(function (l) { var t = scanTexto(l.textContent); if (t) filtros.push(t); });
      return "t" + (total == null ? "" : total) + "|c" + cols.join(",") + "|s" + busca + "|f" + filtros.sort().join("¦");
    } catch (e) { return "err" + Date.now(); } // erro → nunca casa → força coleta
  }
  // Percorre TODAS as páginas do IR (clicando "Próximo"), acumulando as linhas.
  async function coletarRelatorio(rv, onProgress) {
    // SEM teto artificial de linhas/páginas — o limite prático é o TEMPO (para não
    // travar a tela). Volumes grandes são enviados como RESUMO ESTATÍSTICO à IA.
    var CAP_PAG = 100000, CAP_LIN = 500000, ESPERA = 8000, TEMPO_MAX = 240000; // ~4 min
    var t0ini = Date.now();
    // REBOBINA: se o usuário parou numa página adiante (ex.: 31-60), volta ao
    // INÍCIO clicando "Anterior" até ele desabilitar (1ª página), para coletar TUDO.
    for (var rw = 0; rw < CAP_PAG; rw++) {
      var prev = botaoAnterior(rv);
      if (!prev || ehDesabilitado(prev)) break;
      var aRew = assinaturaPagina(rv);
      try { prev.click(); } catch { break; }
      if (!(await esperarMudanca(rv, aRew, ESPERA))) break;
    }
    var t0 = extrairIRRegiao(rv, 1000);
    if (!t0) return null;
    var colunas = t0.colunas, todas = [], seen = {}, truncou = false;
    // AUTORIDADE do APEX: se o relatorio informa Total + Fim-Exibido (aria-label
    // "Total de Linhas = N"), pagina por POSICAO — cada avanco traz linhas novas, que
    // entram TODAS (sem dedup de conteudo, que descartaria registros visualmente iguais
    // e parava cedo, ex.: 350 de 1142). Sem esse dado, dedup + parada em "nada novo".
    var ip0 = infoPag(rv);
    var usaPos = !!(ip0 && ip0.total && ip0.ate);
    var total = usaPos ? ip0.total : 0, ate = usaPos ? ip0.ate : 0;
    function add(linhas) { for (var i = 0; i < linhas.length; i++) { if (usaPos) { todas.push(linhas[i]); } else { var k = linhas[i].join(""); if (!seen[k]) { seen[k] = 1; todas.push(linhas[i]); } } } }
    add(t0.linhas);
    if (onProgress) onProgress(todas.length);
    for (var pag = 1; pag < CAP_PAG; pag++) {
      if (usaPos && ate >= total) break; // fim pela AUTORIDADE (Fim-Exibido alcancou o Total)
      if (todas.length >= CAP_LIN) { truncou = true; break; }
      if (Date.now() - t0ini > TEMPO_MAX) { truncou = true; break; } // orçamento de tempo
      var btn = botaoProximo(rv);
      if (!btn || ehDesabilitado(btn)) { if (usaPos && ate < total) truncou = true; break; }
      var antes = assinaturaPagina(rv);
      try { btn.click(); } catch { break; }
      if (usaPos) {
        var nAte = await esperarAvanco(rv, ate, ESPERA);
        if (!nAte) nAte = await esperarAvanco(rv, ate, ESPERA); // 2o ciclo (pagina lenta), sem reclicar
        if (!nAte) { truncou = true; break; }
        ate = nAte;
      } else if (!(await esperarMudanca(rv, antes, ESPERA))) break; // não avançou → fim/travou
      var t = extrairIRRegiao(rv, 1000);
      if (!t) break;
      var antesN = todas.length;
      add(t.linhas);
      if (!usaPos && todas.length === antesN) break; // nada novo → evita loop infinito
      if (onProgress) onProgress(todas.length);
    }
    return { colunas: colunas, linhas: todas, truncou: truncou };
  }
  // Acha o 1º IR paginado (doc principal + iframes de mesma origem). Aceita pelo
  // RÓTULO (haMaisPaginas) mesmo quando o botão não é encontrado pela classe — a
  // coleta tenta avançar; se não conseguir, é marcada como incompleta (fail-loud).
  function acharIRPaginado(doc) {
    try {
      var cands = doc.querySelectorAll(".a-IRR-reportView, .a-IRR");
      for (var i = 0; i < cands.length; i++) if (haMaisPaginas(cands[i]) || (temPaginacao(cands[i]) && botaoProximo(cands[i]))) return cands[i];
      var frames = doc.querySelectorAll("iframe");
      for (var j = 0; j < frames.length; j++) { var d = null; try { d = frames[j].contentDocument; } catch { d = null; } if (d) { var r = acharIRPaginado(d); if (r) return r; } }
    } catch { }
    return null;
  }
  // Acha na tela a região que CASA a coleta em cache (mesma chave + mesmo
  // fingerprint = relatório inalterado). Independe de estar paginada ou de qual
  // página está visível — serve para REAPROVEITAR a coleta em perguntas seguintes.
  function acharRegiaoCache(doc) {
    if (!_harvestCache || !_harvestCache.key) return null;
    try {
      var cands = doc.querySelectorAll(".a-IRR-reportView, .a-IRR");
      for (var i = 0; i < cands.length; i++) {
        if (regionKey(cands[i]) === _harvestCache.key && fingerprintRelatorio(cands[i]) === _harvestCache.fp) return cands[i];
      }
      var frames = doc.querySelectorAll("iframe");
      for (var j = 0; j < frames.length; j++) { var d = null; try { d = frames[j].contentDocument; } catch { d = null; } if (d) { var r = acharRegiaoCache(d); if (r) return r; } }
    } catch { }
    return null;
  }
  // Diagnóstico da coleta no console (para o teste da OPÇÃO B).
  function diag(msg) { try { if (window.console && console.log) console.log("[kb-widget][coleta] " + msg); } catch { } }

  // ── OPÇÃO B (teste): busca 100% das linhas em UMA tacada, pedindo uma "página
  // gigante" pela PRÓPRIA máquina de paginação do APEX. Os botões trazem
  // data-pagination="pgR_min_row=..max_rows=50rows_fetched=50" — é o CLIENTE que
  // manda max_rows ao servidor. Sobrescrevemos max_rows, clicamos UMA vez e o APEX
  // refaz o relatório com tudo (respeitando filtros/segurança e o "Maximum Row
  // Count" do IR). Reversível (restaura o atributo). Retorna null se não funcionar
  // → o chamador cai na varredura por página (Opção C).
  var _bulkMax = 100000; // teto pedido numa tacada (o IR ainda limita pelo Max Row Count)
  async function coletarViaPaginaGrande(rv, onProgress) {
    try {
      var btn = botaoProximo(rv);
      if (!btn || ehDesabilitado(btn)) btn = botaoAnterior(rv);
      if (!btn || ehDesabilitado(btn)) { diag("B: sem botão de paginação habilitado"); return null; }
      var orig = btn.getAttribute("data-pagination");
      if (!orig || !/max_rows=\d+/.test(orig)) { diag("B: botão sem data-pagination/max_rows → " + orig); return null; }
      var antes = assinaturaPagina(rv);
      var grande = orig
        .replace(/pgR_min_row=\d+/, "pgR_min_row=1")
        .replace(/max_rows=\d+/, "max_rows=" + _bulkMax)
        .replace(/rows_fetched=\d+/, "rows_fetched=" + _bulkMax);
      btn.setAttribute("data-pagination", grande);
      diag("B: pedindo página gigante (max_rows=" + _bulkMax + ")");
      try { btn.click(); } catch { btn.setAttribute("data-pagination", orig); diag("B: click falhou"); return null; }
      // Timeout curto: se o APEX não recarregar por aqui (não dispara pelo atributo),
      // falha rápido e cai na varredura por página — nada de esperar 30s.
      var mudou = await esperarMudanca(rv, antes, 7000);
      btn.setAttribute("data-pagination", orig); // restaura o atributo original
      if (!mudou) { diag("B: relatório não recarregou (timeout)"); return null; }
      var t = extrairIRRegiao(rv, _bulkMax);
      if (!t || !t.linhas.length) { diag("B: nada extraído após recarregar"); return null; }
      if (onProgress) onProgress(t.linhas.length);
      diag("B: extraiu " + t.linhas.length + " linha(s) numa tacada");
      return { colunas: t.colunas, linhas: t.linhas, via: "pagina-grande" };
    } catch (e) { diag("B: exceção " + (e && e.message)); return null; }
  }
  // ── OPÇÃO A: NOSSO servidor (guarda o secret OAuth2) chama o endpoint ORDS
  // (apex_ir.get_report) e devolve 100% das linhas do IR — com filtros/segurança,
  // sem tocar nos apps e sem teto de Max Row Count. O widget NÃO fala com o ORDS
  // (origem diferente + secret no browser seria falha). Ligada por config:
  // cfg.reportServer = true. O ORDS/base/credencial ficam no backend (modelo Integrações).
  function valHidden(sel, doc) { try { var el = (doc || document).querySelector(sel); return el ? String(el.value || "") : ""; } catch { return ""; } }
  // Contexto APEX da JANELA `win` (padrão: a página top). Quando o IR está dentro de um
  // iframe, passe a janela DONA da região — o app/page/session são os DELA, não os do host.
  function apexInfo(win) {
    win = win || window;
    var g = win.apex, env = g && g.env, doc = win.document || document;
    var app = (env && env.APP_ID) || valHidden("#pFlowId", doc);
    var page = (env && env.APP_PAGE_ID) || valHidden("#pFlowStepId", doc);
    var sess = (env && env.APP_SESSION) || valHidden("#pInstance", doc);
    if (!app || !page || !sess) { // fallback: URL f?p=APP:PAGE:SESSION:...
      var href = ""; try { href = String(win.location.href); } catch { href = ""; }
      var m = href.match(/[?&]p=(\d+):(\d+):(\d+)/);
      if (m) { app = app || m[1]; page = page || m[2]; sess = sess || m[3]; }
    }
    return { app: app, page: page, sess: sess };
  }
  // APP_USER do APEX (usuário do create_session no ORDS). apex.env.APP_USER é o
  // acessor do próprio APEX; fallback = o hidden input do IR (..._app_user).
  function appUserTela(win) {
    win = win || window;
    try {
      if (win.apex && win.apex.env && win.apex.env.APP_USER) return String(win.apex.env.APP_USER);
      var el = (win.document || document).querySelector("input[id$='_app_user']");
      return el ? String(el.value || "") : "";
    } catch { return ""; }
  }
  // ── PROCESSO On-Demand (in-session): chama o PRC_DADOS_IR pela PRÓPRIA sessão do
  // usuário (apex.server.process → mesmo cookie/sessão do APEX). Traz 100% das linhas
  // da visão ATUAL do relatório, RESPEITANDO o filtro do Ações — o que o ORDS (sessão
  // nova) não conseguia. Método PRIMÁRIO quando a página é APEX. Retorna null se não
  // houver apex.server.process (host não-APEX) → cai na varredura por página.
  // Candidatos de identificador de região, em ordem de confiança. O PL/SQL resolve
  // por static id, "R<region_id>", número ou nome — o container costuma trazer um
  // desses; o id do .a-IRR às vezes vem com sufixo "_ir" (removido aqui).
  function regiaoCandidatos(rv) {
    var cands = [];
    function push(v) { v = v && String(v).trim(); if (v && cands.indexOf(v) < 0) cands.push(v); }
    try {
      var tReg = rv.closest && rv.closest(".t-Region"); if (tReg) push(tReg.id);      // static id ou R<region_id>
      var irr = rv.closest && rv.closest(".a-IRR");
      if (irr && irr.id) { push(irr.id.replace(/_(worksheet_region|ir|report)$/i, "")); push(irr.id); } // sufixo do tema → static id
      push(nomeRegiao(rv));                                                            // título = region_name
      var b = botaoProximo(rv) || botaoAnterior(rv); if (b) push(b.getAttribute("aria-controls"));
      push(regionKey(rv));
    } catch { }
    return cands;
  }
  function chamarProcessoIR(win, info, region) {
    return new Promise(function (resolve) {
      try {
        // Guarda o jqXHR: `Parar` chama _coletaXhr.abort() → fecha a conexão com o APEX/
        // ORDS (e, conforme a config do ORDS, cancela a query no banco = derruba a sessão).
        _coletaXhr = (win || window).apex.server.process("PRC_DADOS_IR",
          { x01: String(info.app), x02: String(info.page), x03: String(region) },
          {
            dataType: "json",
            success: function (d) { _coletaXhr = null; resolve(d); },
            error: function (xhr, st) {
              _coletaXhr = null;
              if (st === "abort") { diag("P: coleta abortada pelo usuário (Parar)"); resolve(null); return; }
              diag("P: erro AJAX " + st + " " + (xhr && xhr.responseText ? String(xhr.responseText).slice(0, 120) : ""));
              resolve(null);
            },
          });
      } catch (e) { diag("P: exceção na chamada " + (e && e.message)); resolve(null); }
    });
  }
  async function coletarViaProcesso(rv) {
    try {
      // A região do IR pode viver DENTRO de um iframe (aplicação/página APEX aninhada).
      // O contexto (app/page/session + apex.server.process) TEM de ser o da JANELA DONA
      // da região — não o da página hospedeira — senão o processo procura a região no app
      // errado ("a região não existe no aplicativo X"). rv.ownerDocument.defaultView = essa janela.
      var win = (rv && rv.ownerDocument && rv.ownerDocument.defaultView) || window;
      var A = win.apex;
      if (!A || !A.server || typeof A.server.process !== "function") { diag("P: sem apex.server.process (host/iframe não-APEX)"); return null; }
      var info = apexInfo(win);
      if (!info.app || !info.page) { diag("P: sem contexto APEX (app/page)"); return null; }
      var cands = regiaoCandidatos(rv);
      if (!cands.length) { diag("P: sem identificador de região"); return null; }
      diag("P: PRC_DADOS_IR app=" + info.app + " page=" + info.page + (win !== window ? " (via iframe)" : "") + " candidatos=[" + cands.join(", ") + "]");
      // Tenta cada candidato até o processo achar a região (ok:true).
      var meta = null;
      for (var ci = 0; ci < cands.length; ci++) {
        meta = await chamarProcessoIR(win, info, cands[ci]);
        if (meta && meta.ok === true) { diag("P: região resolvida por '" + cands[ci] + "'"); break; }
        if (meta && meta.erro) diag("P: '" + cands[ci] + "' → " + meta.erro);
      }
      if (!meta || meta.ok !== true || !Array.isArray(meta.colunas)) { diag("P: nenhum candidato resolveu a região"); return null; }
      var colunas = meta.colunas.map(String);
      var amostra = Array.isArray(meta.amostra)
        ? meta.amostra.map(function (r) { return (Array.isArray(r) ? r : [r]).map(function (c) { return c == null ? "" : String(c); }); })
        : [];
      var total = typeof meta.total_linhas === "number" ? meta.total_linhas : amostra.length;
      var incompleto = total > amostra.length; // grande: amostra < total → parcial + download por id
      diag("P: total=" + total + " amostra=" + amostra.length + " incompleto=" + incompleto + " id=" + meta.id);
      // Diagnóstico de desempenho: onde o banco gastou o tempo da leitura (ms).
      //   consulta (execução + ORDER BY) = abrir_ctx + ate_primeira_linha
      //   serializar (montar CSV/JSON célula a célula) = serializar
      if (meta.tempos_ms) {
        var t = meta.tempos_ms;
        var consulta = (Number(t.abrir_ctx) || 0) + (Number(t.ate_primeira_linha) || 0);
        try { if (window.console && console.log) console.log("[kb-widget][coleta] tempos(ms) — total=" + t.total + " | consulta(exec+ordenação)=" + consulta + " (abrir=" + t.abrir_ctx + ", 1ª linha=" + t.ate_primeira_linha + ") | serializar=" + t.serializar + " | gravar=" + t.gravar + " | linhas=" + total, t); } catch { }
      }
      return { colunas: colunas, linhas: amostra, total: total, truncou: incompleto, via: "processo", downloadId: meta.id };
    } catch (e) { diag("P: exceção " + (e && e.message)); return null; }
  }
  // Coleta via processo com SINGLE-FLIGHT: se já há uma coleta em andamento para o
  // MESMO relatório+filtro (ex.: o pré-aquecer disparou e o usuário perguntou antes
  // de terminar), reaproveita a MESMA promessa em vez de abrir uma segunda leitura.
  var _coletaInflight = null; // { key, fp, p }
  function coletarProcessoDedup(rv, key, fp) {
    if (_coletaInflight && _coletaInflight.key === key && _coletaInflight.fp === fp) { diag("dedup: reaproveita coleta em andamento"); return _coletaInflight.p; }
    var p = coletarViaProcesso(rv);
    var reg = { key: key, fp: fp, p: p };
    _coletaInflight = reg;
    var limpar = function () { if (_coletaInflight === reg) _coletaInflight = null; };
    p.then(limpar, limpar);
    return p;
  }
  async function coletarViaServidor(rv) {
    try {
      if (cfg.reportServer !== true) return null;
      // Mesmo cuidado do processo in-session: se a região está num iframe, o app/page/
      // session/appUser vêm da janela DONA da região, não da página hospedeira.
      var win = (rv && rv.ownerDocument && rv.ownerDocument.defaultView) || window;
      var info = apexInfo(win);
      if (!info.app || !info.page || !info.sess) { diag("A: sem contexto APEX (app/page/session)"); return null; }
      var b = botaoProximo(rv) || botaoAnterior(rv);
      var region = (b && b.getAttribute("aria-controls")) || regionKey(rv) || "";
      var appUser = appUserTela(win);
      diag("A: POST " + API + "/api/v1/report-data app=" + info.app + " page=" + info.page + " region=" + region + " appUser=" + (appUser || "-"));
      // session como STRING: ids do APEX podem exceder a precisão de Number em JS.
      // `track` leva a BASE + identidade (p_*); appUser é o APP_USER lido no navegador.
      // O servidor decide base/caminho e monta os application items a partir do track.
      _coletaAbort = new AbortController(); // PARAR: aborta a coleta via ORDS
      var resp = await fetch(API + "/api/v1/report-data", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Widget-Key": KEY },
        body: JSON.stringify({ app_id: Number(info.app), page_id: Number(info.page), session: String(info.sess), region: region, appUser: appUser, track: track }),
        signal: _coletaAbort.signal,
      });
      if (!resp.ok) {
        var errJson = await resp.json().catch(function () { return null; });
        diag("A: HTTP " + resp.status + (errJson && errJson.erro ? " — " + errJson.erro : ""));
        return null;
      }
      var j = await resp.json().catch(function () { return null; });
      if (!j || j.ok !== true || !Array.isArray(j.colunas) || !Array.isArray(j.linhas)) { diag("A: resposta inválida " + (j && j.erro ? j.erro : "")); return null; }
      diag("A: recebi " + j.linhas.length + " linha(s) via servidor/ORDS");
      var linhas = j.linhas.map(function (r) { return (Array.isArray(r) ? r : [r]).map(function (c) { return c == null ? "" : String(c); }); });
      return { colunas: j.colunas.map(String), linhas: linhas, via: "ORDS", total: (typeof j.total === "number" ? j.total : linhas.length) };
    } catch (e) { diag("A: exceção " + (e && e.message)); return null; }
  }
  // A coleta em tacada trouxe tudo? (rótulo diz N → linhas ≈ N; sem total → não há
  // mais "Próximo".)
  function bulkPareceCompleto(rv, rb, esperado) {
    if (esperado != null) return rb.linhas.length >= esperado - 2;
    return !haMaisPaginas(rv, rb.linhas.length);
  }
  // Grava o resultado da coleta (venha do B ou da varredura) e reenvia à IA.
  function finalizarColeta(rv, key, fp, res, esperado, via) {
    if (res && res.linhas.length) {
      _relatorioVazioSinal = null; // achou dados → não está mais vazio
      // Fail-loud: se o rótulo indicava N e coletamos menos (margem de 2), NÃO
      // apresente como completo — a IA precisa avisar o usuário.
      var incompleto = (esperado != null && res.linhas.length < esperado - 2) || !!res.truncou;
      _harvested = { key: key, nome: nomeRegiao(rv) || "Relatório", colunas: res.colunas, linhas: res.linhas, total: res.total || esperado || res.linhas.length, incompleto: incompleto };
      _harvestCache = { key: key, fp: fp, nome: _harvested.nome, colunas: res.colunas, linhas: res.linhas, total: _harvested.total, incompleto: incompleto }; // guarda p/ reuso
      procStatus(incompleto
        ? "Analisando os " + res.linhas.length + (esperado ? " de ~" + esperado : "") + " registro(s) (parcial). Aguarde"
        : "Analisando os " + res.linhas.length + " registro(s). Aguarde", incompleto ? "#b45309" : null);
    } else {
      limparProcStatus();
      statusMsg("Não consegui coletar os dados; sigo com o que está visível.", "#b45309");
    }
    ask(undefined, undefined, { continuation: true });
  }
  // Orquestra a coleta e reenvia à IA para a análise/exportação pedida.
  function iniciarColeta() {
    // Acha o relatório PAGINADO; se a detecção falhar, cai em QUALQUER região de
    // relatório (IR/IG) — o coletor tenta ORDS (traz 100% sem depender de paginação)
    // e, se não, a varredura por página. Assim "Relatório da tela" sempre tenta.
    var rv = acharIRPaginado(document) || document.querySelector(".a-IRR-reportView, .a-IRR, .a-GV");
    if (!rv) { statusMsg("Não encontrei um relatório na tela — sigo com os dados visíveis.", null); ask(undefined, undefined, { continuation: true }); return; }
    var key = regionKey(rv), fp = fingerprintRelatorio(rv);
    // CACHE: mesmo relatório + mesmo fingerprint (total/colunas/busca) = sem mudança
    // de filtro/resultado → reusa a coleta anterior, SEM paginar de novo.
    if (_harvestCache && _harvestCache.key === key && _harvestCache.fp === fp && _harvestCache.linhas.length) {
      diag("cache reaproveitado (" + _harvestCache.linhas.length + " linha(s)) — NÃO consultou o banco");
      _harvested = { key: key, nome: _harvestCache.nome, colunas: _harvestCache.colunas, linhas: _harvestCache.linhas, total: _harvestCache.total, incompleto: _harvestCache.incompleto };
      procStatus("Analisando os " + _harvested.linhas.length + " registro(s). Aguarde", null);
      ask(undefined, undefined, { continuation: true });
      return;
    }
    // Log do MOTIVO do miss — mostra QUAL componente mudou (região × filtro/resultado).
    if (!_harvestCache || !_harvestCache.linhas || !_harvestCache.linhas.length) diag("cache vazio → 1ª coleta deste relatório");
    else if (_harvestCache.key !== key) diag("cache não serve: região mudou (\"" + _harvestCache.key + "\" → \"" + key + "\")");
    else diag("cache não serve: filtro/resultado mudou → fp anterior [" + _harvestCache.fp + "] ≠ atual [" + fp + "]");
    var esperado = infoPag(rv).total; // total do rótulo ("de N") — pode ser null
    setBusyUI(true); // botão vira "Parar" durante a coleta do Oracle
    var stEl = procStatus("Realizando a leitura dos dados", null);
    var prog = function (n) { try { if (stEl && stEl._txt) stEl._txt.textContent = "Realizando a leitura dos dados — " + n + " registro(s)"; } catch { } };
    // Ordem: P (processo On-Demand in-session — 100% da visão ATUAL, respeitando o
    // filtro do Ações) → C (varredura por página, reserva confiável em host não-APEX).
    // O ORDS (coletarViaServidor) NÃO entra no caminho da tela: sessão nova não
    // enxerga o filtro ad-hoc — fica reservado ao catálogo cross-report (Fase 2).
    (async function () {
      // P) Processo On-Demand in-session (PRC_DADOS_IR)
      if (cfg.reportProcess !== false) {
        var rp = await coletarProcessoDedup(rv, key, fp);
        if (_parando) return; // PARAR: usuário interrompeu a coleta
        if (rp && rp.linhas.length) { diag("P OK — " + rp.total + " via processo (in-session)"); finalizarColeta(rv, key, fp, rp, rp.total, "relatório da tela"); return; }
        // Coletou com SUCESSO porém VAZIO (0 linhas): NÃO é falha — é relatório sem
        // resultados (não filtrado). Sinaliza p/ o servidor oferecer FILTRAR + pesquisar.
        if (rp && rp.colunas && (rp.total === 0 || !rp.linhas.length)) { diag("P OK porém VAZIO (0 linhas) → relatório sem resultados"); relatorioVazioEReenvia(rv); return; }
        diag("P indisponível → varredura por página");
      }
      if (_parando) return; // PARAR
      // C) varredura por página (reserva)
      try {
        var res = await coletarRelatorio(rv, prog);
        if (_parando) return; // PARAR
        if (res && res.colunas && !res.linhas.length) { diag("varredura VAZIA → relatório sem resultados"); relatorioVazioEReenvia(rv); return; }
        finalizarColeta(rv, key, fp, res, esperado, "paginação");
      }
      catch { if (_parando) return; ask(undefined, undefined, { continuation: true }); }
    })();
  }
  // B — marca o relatório como VAZIO (sem resultados) e reenvia p/ a IA oferecer filtrar.
  function relatorioVazioEReenvia(rv) {
    limparProcStatus();
    _relatorioVazioSinal = { nome: nomeRegiao(rv) || "Relatório" };
    _harvested = null;
    ask(undefined, undefined, { continuation: true });
  }

  // Extrai relatórios APEX como { nome, tipo, colunas[], linhas[][] }.
  function scanReports(doc, marca, tabelas) {
    var LIN = 400, TAB = 8; // linhas por tabela enviadas (viram dataset p/ exportar TODAS)
    var pre = marca ? marca + " " : "";
    var consumidas = [];
    function jaConsumida(t) { for (var i = 0; i < consumidas.length; i++) if (consumidas[i] === t) return true; return false; }

    // (1) INTERACTIVE REPORT (APEX): o cabeçalho e os dados ficam em <table>
    // SEPARADAS (Frozen Header Table) e SEM <thead>. As colunas estão em
    // th.a-IRR-header[id] (nome no .a-IRR-headerLink) e cada dado em
    // td[headers="Cxxx"] — casamos por ID (à prova de ordem/split).
    try {
      var extrairIR = function (rv) {
        if (tabelas.length >= TAB) return;
        var t = extrairIRRegiao(rv, LIN);
        if (!t) return;
        rv.querySelectorAll("table").forEach(function (x) { consumidas.push(x); });
        // Se ESTE relatório já foi coletado por completo, marca (o conjunto vai no reportData).
        var completo = _harvested && _harvested.key === regionKey(rv);
        // PAGINADO pela FONTE DA VERDADE (rótulo "X de N"), não só pela classe do
        // botão — assim um tema diferente não escapa como "não paginado". Envia o
        // total real (N) para o servidor/IA saberem que a página visível é parcial.
        var ip = infoPag(rv);
        // Truncamos no próprio scan (relatório com muitas linhas numa página só)?
        // Então há mais do que enviamos → também conta como "paginado" (a coleta
        // pega o resto). Evita analisar 400 de N em silêncio.
        var truncadoNoScan = t.linhas.length >= LIN;
        var maisPag = !completo && (truncadoNoScan || haMaisPaginas(rv, t.linhas.length) || (temPaginacao(rv) && !!botaoProximo(rv)));
        tabelas.push({ nome: pre + (nomeRegiao(rv) || "Interactive Report"), tipo: "Interactive Report", colunas: t.colunas, linhas: t.linhas, paginado: maisPag, coletaCompleta: completo, total: completo ? _harvested.linhas.length : (ip.total || 0) });
      };
      // Uma passada por reportView; depois .a-IRR SEM reportView (evita duplicar).
      doc.querySelectorAll(".a-IRR-reportView").forEach(extrairIR);
      doc.querySelectorAll(".a-IRR").forEach(function (a) { if (!a.querySelector(".a-IRR-reportView")) extrairIR(a); });
    } catch { }

    // (2) INTERACTIVE GRID (.a-GV) — grid virtualizado (NÃO é <table>).
    try {
      doc.querySelectorAll(".a-GV").forEach(function (gv) {
        if (tabelas.length >= TAB) return;
        if (!(gv.getClientRects && gv.getClientRects().length)) return;
        var colunas = [];
        gv.querySelectorAll(".a-GV-header .a-GV-headerLabel, .a-GV-columnHeaders .a-GV-headerLabel").forEach(function (h) { var t = celTxt(h); if (t) colunas.push(t); });
        var linhas = [];
        gv.querySelectorAll(".a-GV-bdy .a-GV-row, .a-GV-w-scroll .a-GV-row").forEach(function (r) {
          if (linhas.length >= LIN) return;
          var cels = r.querySelectorAll(".a-GV-cell");
          if (!cels.length) return;
          var row = []; Array.prototype.forEach.call(cels, function (c) { row.push(celTxt(c)); });
          if (row.join("").trim()) linhas.push(row);
        });
        if (linhas.length < 1) return;
        if (!colunas.length) { for (var i = 0; i < linhas[0].length; i++) colunas.push("Coluna " + (i + 1)); }
        gv.querySelectorAll("table").forEach(function (t) { consumidas.push(t); });
        tabelas.push({ nome: pre + (nomeRegiao(gv) || "Interactive Grid"), tipo: "Interactive Grid", colunas: colunas, linhas: linhas });
      });
    } catch { }

    // (3) TABELAS HTML genéricas (Classic Report e afins) — pula as já consumidas.
    try {
      doc.querySelectorAll("table").forEach(function (tb) {
        if (tabelas.length >= TAB || jaConsumida(tb)) return;
        if (tb.closest && tb.closest(".a-IRR, .a-GV")) return; // IR/IG já tratados
        if (!(tb.getClientRects && tb.getClientRects().length)) return;
        var colunas = [];
        tb.querySelectorAll("thead th").forEach(function (th) { colunas.push(celTxt(th)); });
        var corpo = Array.prototype.slice.call(tb.querySelectorAll("tbody tr"));
        if (!corpo.length) {
          var trs = tb.querySelectorAll("tr");
          if (trs.length < 2) return;
          if (!colunas.length) trs[0].querySelectorAll("th,td").forEach(function (c) { colunas.push(celTxt(c)); });
          corpo = Array.prototype.slice.call(trs, 1);
        }
        var linhas = [];
        corpo.forEach(function (tr) {
          if (linhas.length >= LIN) return;
          var cels = tr.querySelectorAll("td,th");
          if (!cels.length) return;
          var row = []; Array.prototype.forEach.call(cels, function (c) { row.push(celTxt(c)); });
          if (row.join("").trim()) linhas.push(row);
        });
        if (linhas.length < 1) return;
        if (!colunas.length) { for (var i = 0; i < linhas[0].length; i++) colunas.push("Coluna " + (i + 1)); }
        if (colunas.length < 2 && linhas.length < 2) return;
        tabelas.push({ nome: pre + (nomeRegiao(tb) || "Relatório"), tipo: "Classic Report", colunas: colunas, linhas: linhas });
      });
    } catch { }
  }
  // Devolve { text, tables }: `text` = campos + texto corrido (contexto); `tables`
  // = relatórios ESTRUTURADOS (enviados à parte e registrados como datasets no
  // servidor — o modelo exporta/grafica por id, sem redigitar as linhas).
  function scanPage() {
    try {
      var campos = [], textos = [], tabelas = [];
      scanDoc(document, "", campos, textos, tabelas);
      var partes = [];
      if (campos.length) partes.push("CAMPOS DA TELA:\n" + campos.slice(0, 80).join("\n"));
      if (textos.length) partes.push("TEXTO DA TELA:\n" + textos.join("\n"));
      var s = partes.join("\n\n");
      if (s.length > SCAN_MAX) s = s.slice(0, SCAN_MAX) + "\n…(truncado)";
      return { text: s, tables: tabelas };
    } catch {
      return { text: "", tables: [] };
    }
  }

  // B — RELATÓRIO VAZIO: há uma região de IR/IG na tela mas SEM linhas de dados (0
  // resultados ou a mensagem "sem dados" do APEX). Devolve { nome } para o servidor
  // oferecer FILTRAR; null se não há relatório na tela ou se ele TEM dados.
  // Obs.: seletores dependem do tema do APEX — validar em produção.
  function relatorioVazioNaTela() {
    try {
      var rv = document.querySelector(".a-IRR-reportView, .a-IRR, .a-GV");
      if (!rv) return null; // não há relatório na tela
      var reg = (rv.closest && rv.closest(".a-IRR")) || rv;
      // Mensagem de "sem dados" do IR/IG (sinal mais direto e confiável).
      var noData = reg.querySelector(".a-IRR-noDataMsg, .a-GV-noDataMessage, .a-GV-noData, .t-Report-noData");
      // Linhas REAIS de dados (ignora cabeçalho, paginação e a própria linha de "sem dados").
      var rows = reg.querySelectorAll("table.a-IRR-table tbody tr, .a-GV-table tbody tr, table.a-IRR-table tr.a-IRR-row");
      var temLinha = false;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].querySelector("td") && !rows[i].querySelector(".a-IRR-noDataMsg, .a-GV-noDataMessage")) { temLinha = true; break; }
      }
      if (!noData && temLinha) return null; // tem dados → não é o cenário
      return { nome: nomeRegiao(rv) || "Relatório" };
    } catch { return null; }
  }

  // ── Assistente de formulário: ler os CAMPOS (estruturados) e preenchê-los ─────
  // Só roda quando `cfg.formAssist`. Lê um mapa {ref,label,type,value} da tela e
  // guarda os elementos para escrever depois (com confirmação visual do usuário).
  var _fieldRefs = [];       // ref (índice) -> elemento, do último scan
  var _acoes = [];           // ações propostas pela IA (fill/check/click), em ordem
  var _picking = null;       // ativo enquanto aguardamos o usuário clicar num campo
  var _hlOv = null, _hlEl = null, _hlReposition = null, _hlTimer = null; // destaque (overlay flutuante)
  var _callout = null, _calloutAtivo = false; // balão do tutorial, ancorado ao campo
  var _tutorial = null;      // walkthrough guiado em andamento (passos + índice)
  var _tutDocs = null;       // documentos com o listener de "clique no campo" (topo + iframes do modal)
  // Loop autônomo (Fase B): após executar uma ação, re-varremos a tela e reenviamos
  // à IA p/ ela DAR O PRÓXIMO PASSO (menus/janelas do APEX abrem em etapas), até
  // concluir. Confirma só o que grava/navega — o resto roda direto.
  var LOOP_CAP = 14;         // teto de passos (evita loop infinito)
  var _loopStep = 0;         // passo atual do loop autônomo
  var _turnActed = false;    // a IA executou alguma ação NESTE turno?
  var _loopCancel = false;   // usuário cancelou → interrompe o loop
  var _execLabels = [];      // trilha de ações executadas (nota de continuação)
  var _filtroConfirmado = false; // já perguntei sobre limpar filtro neste turno?
  var _focusedEl = null;         // último campo focado NA PÁGINA (contexto "aqui/isto")
  var _ultimoSalvo = null;       // { id, name, created_at } do último relatório salvo (compare)
  // Botões/links cujo clique GRAVA/ENVIA/EXCLUI/NAVEGA → pedem confirmação. Ações de
  // VISUALIZAÇÃO (abrir menu, filtrar, ordenar, gráfico…) rodam direto.
  var RX_VIEW = /a[çc][õo]es|filtr|ordenar|classificar|pesquisar|buscar|expandir|recolher|abrir|menu|mostrar|exibir|detalhes|op[çc][õo]es|ajuda|colunas|agrupar|gr[áa]fico|destac|destaqu|real[çc]|formatar|format|highlight|totaliz|cubo|refresh|atualizar lista|recarregar|aplicar|apply|fechar/i;
  // Rótulos que GRAVAM/ENVIAM/EXCLUEM/NAVEGAM → sempre confirmam (têm prioridade
  // sobre a lista de visualização; ex.: "Salvar Relatório" no menu Ações).
  var RX_GRAVA = /salvar|gravar|enviar|submeter|confirmar|excluir|apagar|deletar|\bremover\b|logout|encerrar sess|sair da conta|finalizar|efetivar|\bpagar\b|processar/i;
  function ehVisualizacao(label, el) {
    var s = String(label || "");
    if ((el.type || "").toLowerCase() === "submit") return false;
    if (RX_GRAVA.test(s)) return false; // grava/navega vence → confirma
    var role = (el.getAttribute && el.getAttribute("role")) || "";
    if (/^menuitem/.test(role)) return true; // item do menu Ações = navegação do relatório
    // Cabeçalho de coluna do IR/IG: clicar apenas ABRE o menu de filtro/ordenação.
    if (el.closest && el.closest("[role='columnheader'],.a-IRR-header,.a-GV-header,.a-IRR-headerLink,.a-GV-headerLabel")) return true;
    return RX_VIEW.test(s);
  }
  // Campo de POPUP LOV do APEX (abre uma janela de busca em vez de preencher direto)?
  function ehPopupLov(el) {
    try {
      if (/popup.?lov|apex-item-popup/i.test(el.className || "")) return true;
      if (el.closest && el.closest(".apex-item-group--popup-lov,.a-PopupLOV,.apex-item-popup-lov")) return true;
      var p = el.parentElement;
      if (p && p.querySelector && p.querySelector(".a-Button--popupLov,.a-Button--popupLOV,button[id$='_lov'],.apex-item-popup-lov-button")) return true;
    } catch { }
    return false;
  }
  // Tipo/formato do campo — o modelo precisa saber se é número, texto, data,
  // tamanho máximo, lista nativa ou lista de valores (para não preencher errado).
  function fieldTipo(el) {
    var tag = (el.tagName || "").toLowerCase();
    // Barra de pesquisa GLOBAL do Interactive Report (busca todas as colunas de uma vez)
    // — tipo próprio p/ o servidor tratá-la como ÚLTIMO recurso e PREFERIR os campos de
    // filtro com rótulo (ex.: "Filial"). Ainda é preenchível normalmente se preciso.
    try {
      var _sid = el.id || "", _scls = (typeof el.className === "string" ? el.className : "");
      if (/_search_field$/i.test(_sid) || /a-IRR-search-field/.test(_scls)) return "busca";
    } catch { }
    if (tag === "textarea") return "texto longo";
    if (tag === "select") return el.multiple ? "select-multiplo" : "lista";
    if (el.isContentEditable) return "texto";
    var t = (el.type || "text").toLowerCase();
    if (t === "radio" || t === "checkbox") return t;
    if (ehPopupLov(el)) return "lista de valores";
    var base = (t === "number" || el.inputMode === "numeric" || el.inputMode === "decimal") ? "número"
      : t === "date" ? "data"
        : t === "email" ? "email"
          : t === "tel" ? "telefone"
            : t === "url" ? "url"
              : t === "time" ? "hora"
                : "texto";
    var extra = [];
    try {
      if (el.maxLength && el.maxLength > 0 && el.maxLength < 4000) extra.push("máx " + el.maxLength);
      if (el.getAttribute && el.getAttribute("pattern")) extra.push("formato específico");
    } catch { }
    return base + (extra.length ? " (" + extra.join(", ") + ")" : "");
  }
  function fieldValor(el) {
    if (el.isContentEditable) return scanTexto(el.textContent).slice(0, 400);
    return scanValor(el);
  }
  // Rótulo "limpo": tira marcadores de obrigatório que o APEX embute no label
  // ("(valor obrigatório)", "(obrigatório)", "*") — o chat cita só o nome do campo.
  function limparRotulo(s) {
    return String(s || "")
      .replace(/[([{]\s*(?:valor\s+)?obrigat[óo]ri[ao]\s*[)\]}]/gi, "")
      .replace(/[([{]\s*required\s*[)\]}]/gi, "")
      .replace(/\s*\*\s*$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  // Rótulo amigável para controles conhecidos do APEX cujo id/name é técnico — ex.:
  // a barra de pesquisa do IR ("<REGIAO>_search_field") vira "Barra de pesquisa", em
  // vez de expor o id cru pro usuário/IA. Retorna null quando não é um caso especial.
  function rotuloEspecial(el) {
    try {
      var id = el.id || "", cls = (typeof el.className === "string" ? el.className : "");
      if (/_search_field$/i.test(id) || /a-IRR-search-field/.test(cls)) return "Barra de pesquisa";
      if (/_search_button$/i.test(id) || /a-IRR-search-button/.test(cls)) return "Pesquisar";
    } catch (e) { }
    return null;
  }
  // Itens INTERNOS do APEX (token de processamento, instância, flow, checksum…) NÃO são
  // campos do usuário: usam prefixo `p_` minúsculo ou `pCamel` (ex.: p_accept_processing,
  // pInstance, p_flow_id). Os itens de tela do usuário são `P<numero>_NOME` (P maiúsculo).
  // Barrar isto evita "filtro" falso nos documentos e ruído no mapa de campos da IA.
  function nomeInternoApex(s) {
    s = String(s || "").trim();
    return /^p_[a-z]/.test(s) || /^p[A-Z]/.test(s);
  }
  // MODAL no topo que BLOQUEIA o fundo (aria-modal, ou jQuery-UI/APEX dialog com
  // backdrop visível). Enquanto um está aberto, a coleta de campos (scan e tutorial)
  // é RESTRITA a ele — sem isso o tutorial passava pelos campos da página de trás.
  function modalAtivo() {
    try {
      var back = document.querySelector(".ui-widget-overlay");
      var backVis = !!(back && back.getClientRects && back.getClientRects().length);
      var cands = document.querySelectorAll('[aria-modal="true"], .ui-dialog[role="dialog"], .t-Dialog, .a-Dialog');
      var melhor = null, maiorZ = -1;
      for (var i = 0; i < cands.length; i++) {
        var d = cands[i];
        if (host && host.contains && host.contains(d)) continue;               // não é o widget
        if (!d.getClientRects || d.getClientRects().length === 0) continue;    // invisível
        if (d.getAttribute && d.getAttribute("aria-hidden") === "true") continue;
        // Sem aria-modal e sem backdrop visível → não bloqueia o fundo → ignora.
        if ((!d.getAttribute || d.getAttribute("aria-modal") !== "true") && !backVis) continue;
        var z = 0; try { z = parseInt(getComputedStyle(d).zIndex, 10) || 0; } catch (e) { }
        if (z >= maiorZ) { maiorZ = z; melhor = d; }
      }
      return melhor;
    } catch (e) { return null; }
  }
  // Raiz da varredura de CAMPOS: o modal aberto (se houver), senão o documento inteiro.
  function raizVarredura() { return modalAtivo() || document; }
  function scanFields() {
    _fieldRefs = [];
    var out = [], lm = {};
    function push(el, label, type, value, oculto) {
      var ref = String(_fieldRefs.length);
      try { el.setAttribute("data-kb-field", ref); } catch { }
      _fieldRefs.push(el);
      var item = { ref: ref, label: limparRotulo(scanTexto(label)).slice(0, 120), type: type, value: value };
      if (oculto) item.oculto = true;
      out.push(item);
    }
    function collect(doc) {
      if (!doc) return;
      try { doc.querySelectorAll("label[for]").forEach(function (l) { lm[l.getAttribute("for")] = scanTexto(l.textContent); }); } catch { }
      // Campos editáveis + radios/checkboxes (o modelo preenche/marca).
      try {
        doc.querySelectorAll("input,select,textarea,[contenteditable='true'],[contenteditable='']").forEach(function (el) {
          if (out.length >= 80) return; // campos: até 80 (botões têm folga própria até 120)
          if (host && host.contains && host.contains(el)) return;
          // Itens INTERNOS do APEX (p_accept_processing, pInstance…): não são campos da tela.
          if (nomeInternoApex(el.id || el.name || "")) return;
          // Busca do MENU superior (P9999_SEARCH do APEX) e campos da barra de
          // navegação/cabeçalho: não fazem parte da tela — fora do escopo.
          if (/^p9999_search$/i.test(el.id || "")) return;
          if (el.closest && el.closest('.t-Header,#t_Header,[role="banner"],.t-Header-navBar,.a-MenuBar,.t-NavigationBar')) return;
          var t = (el.type || "").toLowerCase();
          if (t === "hidden" || t === "password" || t === "submit" || t === "button" || t === "reset" || t === "file") return;
          // NUNCA expõe/mexe em campos restritos: desabilitados sempre fora.
          if (el.disabled) return;
          // Somente-leitura fica fora — EXCETO popup-LOV do APEX (Filial, Centro
          // de Custo, Matrícula…): são readonly mas o usuário PREENCHE via o popup,
          // logo fazem parte da tela e do tutorial.
          var ehLov = (typeof el.className === "string" && /(^|\s)(popup_lov|apex-item-popup-lov)(\s|$)/.test(el.className)) ||
            (el.closest && el.closest(".apex-item-group--popup-lov, .apex-item-popup-lov"));
          if (!ehLov && (el.readOnly || el.getAttribute("aria-readonly") === "true")) return;
          // Invisível → fora, EXCETO: (a) numa ABA oculta (o tutorial ativa a aba antes
          // de destacar); (b) numa REGIÃO DE FILTROS RECOLHIDA ("Ver mais" do APEX, ex.:
          // .collapseRegion) — aí INCLUÍMOS o campo MARCADO como oculto, para a IA saber
          // que ele existe e mandar EXPANDIR os filtros antes de preencher.
          var _semRect = el.getClientRects && el.getClientRects().length === 0;
          var _emAba = el.closest && el.closest('[role="tabpanel"]');
          var _emColapso = el.closest && el.closest('.collapseRegion, [class*="collaps"]');
          if (_semRect && !_emAba && !_emColapso) return;
          var _oculto = !!(_semRect && _emColapso);
          var rot = rotuloEspecial(el) || el.getAttribute("aria-label") || lm[el.id] || el.placeholder || el.name || el.id || (el.type || "campo");
          // radio/checkbox costumam ter o texto no <label> que os envolve.
          if (t === "radio" || t === "checkbox") {
            var wrap = el.closest && el.closest("label");
            if (wrap) { var wt = scanTexto(wrap.textContent); if (wt) rot = wt; }
          }
          push(el, rot, fieldTipo(el), fieldValor(el), _oculto);
        });
      } catch { }
      // Botões/links de ação (o modelo clica).
      try {
        doc.querySelectorAll(
          "button,input[type='submit'],input[type='button'],input[type='reset'],[role='button']," +
          "[role='menuitem'],[role='menuitemcheckbox'],[role='menuitemradio'],a.t-Button,a.a-Button,.a-Menu a,.a-Menu-content a," +
          // Cabeçalhos de coluna do Interactive Report/Grid (abrem o menu de filtro/ordenação da coluna).
          ".a-IRR-headerLink,.a-GV-headerLabel,[role='columnheader'] a,[role='columnheader'] button"
        ).forEach(function (el) {
          if (out.length >= 120) return; // botões: teto total 120 (garante espaço p/ itens de menu)
          if (host && host.contains && host.contains(el)) return;
          if (el.disabled || el.getAttribute("aria-disabled") === "true") return;
          if (el.getClientRects && el.getClientRects().length === 0) return; // invisível
          var tag = (el.tagName || "").toLowerCase();
          var lbl = el.getAttribute("aria-label") || (tag === "input" ? el.value : scanTexto(el.textContent)) || el.title || el.name || "";
          lbl = limparRotulo(scanTexto(lbl));
          if (!lbl) return; // sem rótulo o modelo não consegue referenciar
          push(el, lbl, "botao", "");
        });
      } catch { }
      // REGIÕES da tela (type "regiao"): o tutorial DESTACA a seção e a IA EXPLICA o que
      // ela é, pelo TÍTULO + o RESUMO do conteúdo (nº de campos, se tem IR/IG/relatório).
      try {
        doc.querySelectorAll(".t-Region").forEach(function (reg) {
          if (out.length >= 130) return;
          if (host && host.contains && host.contains(reg)) return;
          if (reg.getClientRects && reg.getClientRects().length === 0) return; // oculta
          if (nomeInternoApex(reg.id || "")) return;
          var h = reg.querySelector(".t-Region-header .t-Region-title, .t-Region-title, [id$='_heading']");
          var titulo = h ? limparRotulo(scanTexto(h.textContent)).trim() : "";
          if (!titulo || titulo.length > 90 || /^(itens|par[âa]metros|breadcrumb|global)/i.test(titulo)) return;
          var nC = 0; try { nC = reg.querySelectorAll("input:not([type=hidden]),select,textarea").length; } catch (e) { }
          var temIR = !!reg.querySelector(".a-IRR, .a-IRR-reportView"), temIG = !!reg.querySelector(".a-GV");
          if (!nC && !temIR && !temIG && !reg.querySelector("table")) return; // região vazia/decorativa → fora
          var resumo = [];
          if (nC) resumo.push(nC + " campo(s)");
          if (temIR) resumo.push("relatório interativo");
          else if (temIG) resumo.push("grade interativa (IG)");
          else if (reg.querySelector("table")) resumo.push("relatório/tabela");
          push(reg, titulo, "regiao", resumo.join(", "));
        });
      } catch { }
      try {
        doc.querySelectorAll("iframe").forEach(function (f) {
          var d = null; try { d = f.contentDocument; } catch { d = null; }
          if (d) collect(d);
        });
      } catch { }
    }
    collect(raizVarredura()); // modal aberto restringe ao seu conteúdo (não à página de trás)
    return out;
  }
  // Descreve o campo em FOCO na página (o último focado fora do widget), p/ dar
  // contexto a pedidos como "aqui/isto/esse campo". scanFields() já marcou
  // data-kb-field; se o focado for um deles, vai o ref (permite preencher_campo).
  function campoEmFoco() {
    try {
      var el = _focusedEl;
      if (!el || !el.isConnected) return null;
      if (host && host.contains && host.contains(el)) return null;
      if (el.getClientRects && el.getClientRects().length === 0) return null; // sumiu da tela
      var ref = el.getAttribute && el.getAttribute("data-kb-field");
      var label = rotuloEspecial(el) || rotuloCampo(el) || el.id || (el.type || "campo");
      var val = ""; try { val = fieldValor(el); } catch (e) { }
      return { ref: ref || null, label: String(label).slice(0, 120), type: fieldTipo(el), value: String(val || "").slice(0, 200) };
    } catch (e) { return null; }
  }
  function fieldEl(ref) {
    var el = _fieldRefs[Number(ref)];
    if (el && el.isConnected) return el;
    try { return document.querySelector('[data-kb-field="' + ref + '"]'); } catch { return null; }
  }
  // Destaque por OVERLAY flutuante (não outline no elemento): position:fixed no
  // topo do documento, nunca é cortado por ancestral com overflow:hidden — era o
  // que deixava a borda parcial/"topo estranho". Segue o campo no scroll/resize.
  function ensureHlOverlay() {
    if (_hlOv) return _hlOv;
    var c = (cfg && cfg.primaryColor) || "#511C76";
    try {
      var st = document.createElement("style");
      st.textContent = "@keyframes kbHlPulse{0%,100%{box-shadow:0 0 0 3px " + c + "66,0 0 16px 3px " + c + "3a}50%{box-shadow:0 0 0 8px " + c + "22,0 0 26px 8px " + c + "22}}";
      (document.head || document.documentElement).appendChild(st);
    } catch { }
    var ov = document.createElement("div");
    ov.setAttribute("aria-hidden", "true");
    ov.style.cssText =
      "position:fixed;z-index:2147483646;pointer-events:none;display:none;box-sizing:border-box;" +
      "border:3px solid " + c + ";border-radius:7px;background:" + c + "12;" +
      "animation:kbHlPulse 1.1s ease-in-out infinite"; // sem transition: seguir o scroll tem de ser 1:1
    (document.body || document.documentElement).appendChild(ov);
    _hlOv = ov;
    return ov;
  }
  // Retângulo do elemento em coordenadas da PÁGINA TOP: para campos dentro de
  // iframe(s) de mesma origem, o getBoundingClientRect é relativo ao iframe —
  // então somamos o offset de cada iframe da cadeia até o topo. Sem isto o
  // overlay (fixed no topo) fica deslocado nas telas em iframe.
  function rectInTop(el) {
    var r = el.getBoundingClientRect();
    var top = r.top, left = r.left, width = r.width, height = r.height;
    var win = el.ownerDocument && el.ownerDocument.defaultView, guard = 0;
    while (win && win !== window && guard++ < 6) {
      var fe = null; try { fe = win.frameElement; } catch { fe = null; }
      if (!fe) break;
      var fr = fe.getBoundingClientRect();
      top += fr.top; left += fr.left; // iframe sem borda: a origem do conteúdo = canto do iframe
      win = win.parent;
    }
    return { top: top, left: left, width: width, height: height };
  }
  // Rola o campo para o centro E garante que o(s) iframe(s) ancestrais também
  // fiquem visíveis na página top (senão o campo pode estar fora da tela).
  function scrollFieldIntoView(el) {
    try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { }
    var win = el.ownerDocument && el.ownerDocument.defaultView, guard = 0;
    while (win && win !== window && guard++ < 6) {
      var fe = null; try { fe = win.frameElement; } catch { fe = null; }
      if (!fe) break;
      try { fe.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch { }
      win = win.parent;
    }
  }
  function posHlOverlay() {
    if (!_hlOv) return;
    if (!_hlEl || !_hlEl.isConnected) { _hlOv.style.display = "none"; return; }
    var r = rectInTop(_hlEl);
    if (!r.width && !r.height) { _hlOv.style.display = "none"; return; } // oculto agora → some (reaparece qdo voltar)
    if (_hlOv.style.display === "none") _hlOv.style.display = "block";
    var pad = 3;
    _hlOv.style.top = (r.top - pad) + "px";
    _hlOv.style.left = (r.left - pad) + "px";
    _hlOv.style.width = (r.width + pad * 2) + "px";
    _hlOv.style.height = (r.height + pad * 2) + "px";
  }
  // Se o campo está numa ABA (tabpanel) INATIVA, clica na aba correspondente
  // para revelá-lo antes de destacar. Retorna true se trocou de aba.
  function revelarAbaSePreciso(el) {
    try {
      if (el.getClientRects().length) return false; // já visível
      var doc = el.ownerDocument;
      // 1) Aba ARIA / jQuery UI (role=tabpanel): clica o tab que a controla.
      var tp = el.closest('[role="tabpanel"]');
      if (tp) {
        var tab = null;
        if (tp.id) { try { tab = doc.querySelector('[role="tab"][aria-controls="' + tp.id + '"]'); } catch { tab = null; } }
        if (!tab && tp.getAttribute("aria-labelledby")) { try { tab = doc.getElementById(tp.getAttribute("aria-labelledby")); } catch { tab = null; } }
        if (tab) { try { tab.click(); } catch { } return true; }
      }
      // 2) APEX Region Display Selector / abas por link (#id): sobe até um ancestral OCULTO
      // com id e clica o link de aba (.apex-rds / .t-Tabs / role=tab) que aponta para ele.
      var node = el.parentElement, guard = 0;
      while (node && node.tagName !== "BODY" && guard++ < 40) {
        if (node.id && (!node.getClientRects || node.getClientRects().length === 0)) {
          var aba = null;
          try { aba = doc.querySelector('.apex-rds a[href="#' + node.id + '"], .t-Tabs a[href="#' + node.id + '"], a[role="tab"][href="#' + node.id + '"]'); } catch { aba = null; }
          if (aba) { try { aba.click(); } catch { } return true; }
        }
        node = node.parentElement;
      }
    } catch { }
    return false;
  }
  // Se o campo está numa REGIÃO RECOLHIDA (colapso), tenta EXPANDIR (clica o toggle
  // do cabeçalho, ou abre o <details>). Sobe pelos ancestrais. Retorna true se tentou.
  function expandirColapsoSePreciso(el) {
    try {
      if (el.getClientRects().length) return false; // já visível
      var node = el.parentElement, tentou = false, guard = 0;
      while (node && node.tagName !== "BODY" && guard++ < 40) {
        var cls = (typeof node.className === "string" ? node.className : "") || "";
        var ehColap = /collaps/i.test(cls) || node.tagName === "DETAILS" || (node.classList && node.classList.contains("t-Region--collapsible"));
        if (ehColap) {
          if (node.tagName === "DETAILS" && !node.open) { try { node.open = true; tentou = true; } catch (e) { } }
          var tog = node.querySelector('[aria-expanded="false"]');
          if (!tog) { var head = node.querySelector('.t-Region-header, .t-Region-headerItems, .a-CollapsibleRegion-heading'); if (head) tog = head.querySelector('button, a, [role="button"]'); }
          if (tog) { try { tog.click(); tentou = true; } catch (e) { } }
          if (tentou && el.getClientRects().length) return true; // revelou
        }
        node = node.parentElement;
      }
      return tentou;
    } catch (e) { return false; }
  }
  function highlightField(el) {
    if (!el) return;
    var trocouAba = revelarAbaSePreciso(el);      // ativa a aba do campo, se preciso
    var expandiu = expandirColapsoSePreciso(el);  // expande a região recolhida, se preciso
    var ov = ensureHlOverlay();
    _hlEl = el;
    ov.style.display = "block";
    if (!_hlReposition) {
      _hlReposition = reposDestaque;
      window.addEventListener("scroll", _hlReposition, true); // scroll do documento top
      window.addEventListener("resize", _hlReposition);
    }
    // Reposiciona CONTÍNUO (leve, 1 elemento): cobre o scrollIntoView suave E o
    // scroll DENTRO de iframes, que não dispara o listener da página top.
    clearInterval(_hlTimer);
    _hlTimer = setInterval(reposDestaque, 80);
    // Rola e reposiciona; se trocou de aba / expandiu, espera o painel renderizar.
    var focar = function () { scrollFieldIntoView(el); reposDestaque(); };
    if (trocouAba || expandiu) setTimeout(focar, 300); else focar();
    // FALLBACK: se, mesmo após tentar, o campo continua oculto (aba/seção que não
    // consegui abrir sozinho), peço ao usuário para revelar e seguir.
    setTimeout(function () {
      if (_hlEl === el && el.isConnected && el.getClientRects && el.getClientRects().length === 0) {
        statusMsg("Não consegui revelar este campo sozinho — abra a seção/aba correspondente e clique em “Prosseguir” para continuar.", null);
      }
    }, 600);
  }
  function unhighlightField() {
    if (_hlOv) _hlOv.style.display = "none";
    _hlEl = null;
    clearInterval(_hlTimer);
    if (_hlReposition) {
      window.removeEventListener("scroll", _hlReposition, true);
      window.removeEventListener("resize", _hlReposition);
      _hlReposition = null;
    }
  }
  function reposDestaque() { posHlOverlay(); posCallout(); }

  // ==== Balão de diálogo (callout) do tutorial, ancorado ao campo ====
  // Fica no document top (fixed), reposicionado junto do destaque; ACIMA do
  // campo, ou ABAIXO se não couber; clampado nas bordas (nunca sai da tela).
  function ensureCallout() {
    if (_callout) return _callout;
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var c = document.createElement("div");
    c.setAttribute("aria-live", "polite");
    c.style.cssText =
      "position:fixed;z-index:2147483647;display:none;box-sizing:border-box;max-width:330px;min-width:230px;width:max-content;" +
      "background:#fff;color:#1a1a1a;border:1px solid " + pc + "33;border-radius:14px;padding:11px 13px 11px 48px;" +
      "box-shadow:0 16px 44px rgba(30,15,60,.30);font:400 13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;";
    var av = document.createElement("div"); // avatar no canto superior esquerdo
    av.style.cssText = "position:absolute;top:10px;left:11px;width:28px;height:28px;border-radius:50%;overflow:hidden;" +
      "background:linear-gradient(135deg," + pc + "," + (cfg.primaryColor2 || pc) + ");display:flex;align-items:center;justify-content:center;box-shadow:0 3px 9px rgba(40,20,80,.3);color:#fff;";
    av.innerHTML = cfg.avatarUrl ? '<img src="' + esc(cfg.avatarUrl) + '" alt="" style="width:100%;height:100%;object-fit:cover">' : ICON_BOT;
    try { var _svg = av.querySelector("svg"); if (_svg) { _svg.style.width = "16px"; _svg.style.height = "16px"; } } catch { }
    var body = document.createElement("div"); body.setAttribute("data-cbody", "");
    var arrow = document.createElement("div"); arrow.setAttribute("data-carrow", "");
    c.appendChild(av); c.appendChild(body); c.appendChild(arrow);
    (document.body || document.documentElement).appendChild(c);
    _callout = c;
    return c;
  }
  function posCallout() {
    if (!_callout || !_calloutAtivo || !_hlEl || !_hlEl.isConnected) return;
    var r0 = rectInTop(_hlEl);
    if (!r0.width && !r0.height) { _callout.style.display = "none"; return; } // campo oculto → some (reaparece qdo voltar)
    if (_callout.style.display === "none") _callout.style.display = "block";
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var r = rectInTop(_hlEl);
    var cw = _callout.offsetWidth, ch = _callout.offsetHeight;
    var vw = window.innerWidth, vh = window.innerHeight, m = 8, gap = 12;
    var cx = r.left + r.width / 2;
    var left = Math.max(m, Math.min(cx - cw / 2, vw - cw - m));
    var acima = (r.top - gap - ch) >= m;                      // cabe acima?
    var top = acima ? (r.top - gap - ch) : (r.top + r.height + gap);
    top = Math.max(m, Math.min(top, vh - ch - m));
    _callout.style.left = left + "px";
    _callout.style.top = top + "px";
    var arrow = _callout.querySelector("[data-carrow]");
    if (arrow) {
      var ax = Math.max(10, Math.min(cx - left, cw - 10)) - 6; // seta aponta pro campo
      arrow.style.cssText = "position:absolute;width:12px;height:12px;background:#fff;transform:rotate(45deg);left:" + ax + "px;" +
        (acima ? "bottom:-7px;border-right:1px solid " + pc + "33;border-bottom:1px solid " + pc + "33;"
          : "top:-7px;border-left:1px solid " + pc + "33;border-top:1px solid " + pc + "33;");
    }
  }
  function hideCallout() { _calloutAtivo = false; if (_callout) _callout.style.display = "none"; }
  function mostrarCallout(passo, n, total, ultimo, onAvancar, onSair, podeVoltar, onVoltar) {
    var c = ensureCallout();
    _calloutAtivo = true;
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var body = c.querySelector("[data-cbody]");
    body.innerHTML = "";
    var tit = document.createElement("div");
    tit.style.cssText = "font-weight:700;color:" + pc + ";margin-bottom:3px;font-size:12.5px;";
    tit.textContent = "Passo " + n + " de " + total + (passo.titulo ? " · " + passo.titulo : "");
    var exp = document.createElement("div");
    exp.style.cssText = "margin-bottom:10px;color:#2a2a2a;";
    exp.textContent = passo.explicacao;
    var btns = document.createElement("div");
    btns.style.cssText = "display:flex;gap:7px;flex-wrap:wrap;";
    var av = tutBtn(ultimo ? "Concluir ✓" : "Prosseguir →", true);
    av.addEventListener("click", onAvancar);
    btns.appendChild(av);
    if (podeVoltar && onVoltar) { var vo = tutBtn("← Voltar", false); vo.addEventListener("click", onVoltar); btns.appendChild(vo); }
    var sa = tutBtn("Sair", false); sa.addEventListener("click", onSair); btns.appendChild(sa);
    body.appendChild(tit); body.appendChild(exp); body.appendChild(btns);
    c.style.display = "block";
    posCallout();
  }

  // ==== Tutorial guiado (walkthrough passo a passo) ====
  function tutBtn(txt, primario) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = txt;
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    b.style.cssText = "font-size:12.5px;font-weight:600;padding:6px 13px;border-radius:9px;cursor:pointer;" +
      (primario ? "border:1px solid " + pc + ";background:" + pc + ";color:#fff;" : "border:1px solid " + pc + "44;background:transparent;color:" + pc + ";");
    return b;
  }
  function encerrarTutorial() { desligarCliqueTutorial(); unhighlightField(); hideCallout(); _tutorial = null; }
  // Rola o CHAT para o fim AGORA e nos próximos frames. O append de um passo do
  // tutorial vem seguido do destaque do campo (scrollIntoView no host) e do balão,
  // cujos reflows podem reposicionar a lista de mensagens — sem esta reafirmação,
  // o chat às vezes ficava preso no topo em vez de acompanhar o passo atual.
  function scrollChatFim() { try { messagesEl.scrollTop = messagesEl.scrollHeight; } catch (e) { } }
  function scrollChatFimSoon() {
    scrollChatFim();
    try { requestAnimationFrame(function () { scrollChatFim(); requestAnimationFrame(scrollChatFim); }); } catch (e) { }
    setTimeout(scrollChatFim, 200);
  }
  // Porta de confirmação: depois de apresentar o programa, PERGUNTA se quer o
  // tutorial guiado — só destaca campos após o usuário clicar em "Iniciar".
  function confirmarTutorial() {
    var t = _tutorial;
    if (!t || !t.passos || !t.passos.length) { _tutorial = null; return; }
    var box = document.createElement("div");
    box.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin:2px 0 6px 40px;";
    var sim = tutBtn("Iniciar tutorial →", true);
    sim.addEventListener("click", function () { if (box.parentNode) box.remove(); iniciarTutorial(); });
    var nao = tutBtn("Agora não", false);
    nao.addEventListener("click", function () {
      if (box.parentNode) box.remove();
      _tutorial = null;
      statusMsg("Beleza — é só pedir quando quiser o passo a passo.", null);
    });
    box.appendChild(sim); box.appendChild(nao);
    messagesEl.appendChild(box);
    scrollChatFimSoon();
  }
  function iniciarTutorial() {
    var t = _tutorial;
    if (!t) return;
    // A tela é DINÂMICA (regiões/campos aparecem e somem conforme o preenchimento).
    // Por isso NÃO fixamos a lista de passos: guardamos só as EXPLICAÇÕES da IA,
    // por CHAVE ESTÁVEL do campo (id/name/rótulo), e a sequência é VARRIDA AO VIVO
    // a cada passo — respeitando o show/hide de regiões e campos.
    t.expl = {};
    (t.passos || []).forEach(function (p) {
      if (!p || !p.explicacao) return;
      var el = fieldEl(p.ref);
      var ch = el ? chaveCampo(el) : null;
      if (ch) t.expl[ch] = { titulo: (p.titulo || "").trim(), explicacao: (p.explicacao || "").trim() };
    });
    t.visitados = {};
    t.pilha = [];   // trilha (ordem) dos campos já avançados — habilita o "Voltar"
    t.n = 0;
    if (!coletarCamposTutorial().length) { _tutorial = null; return; }
    mostrarPassoTutorial();
    ligarCliqueTutorial(); // clicar num campo passa a mostrar a explicação dele
  }
  // Chave ESTÁVEL de um campo — sobrevive a mudanças de layout/refs entre passos.
  function chaveCampo(el) {
    try { return (el.id || el.name || el.getAttribute("aria-label") || rotuloCampo(el) || "").toString() || null; } catch { return null; }
  }
  // Rótulo legível: aria-label → <label for> → placeholder → name → id.
  function ehRegiao(el) { return !!(el && el.classList && el.classList.contains("t-Region")); }
  function rotuloCampo(el) {
    try {
      // Região: usa o TÍTULO da seção como rótulo do passo.
      if (ehRegiao(el)) { var rh = el.querySelector(".t-Region-title, [id$='_heading']"); if (rh) return limparRotulo(scanTexto(rh.textContent)).slice(0, 120); }
      var rot = el.getAttribute("aria-label") || "";
      if (!rot && el.id) { var lab = (el.ownerDocument || document).querySelector('label[for="' + el.id + '"]'); if (lab) rot = scanTexto(lab.textContent); }
      if (!rot) rot = el.placeholder || el.name || el.id || (el.type || "campo");
      var tt = (el.type || "").toLowerCase();
      if (tt === "radio" || tt === "checkbox") { var wrap = el.closest && el.closest("label"); if (wrap) { var wt = scanTexto(wrap.textContent); if (wt) rot = wt; } }
      return limparRotulo(scanTexto(rot)).slice(0, 120);
    } catch { return "campo"; }
  }
  // Explicação genérica (quando a IA não cobriu o campo — ex.: surgido dinamicamente).
  function explicacaoGenerica(el) {
    var rot = rotuloCampo(el);
    if (ehRegiao(el)) return 'Seção "' + rot + '" da tela — reúne os campos/itens relacionados a seguir.';
    var tipo = fieldTipo(el);
    return 'Campo "' + rot + '"' + (tipo && tipo.indexOf("texto") !== 0 ? " (" + tipo + ")" : "") + ". Informe aqui o valor de " + rot + ".";
  }
  // Campo elegível ao tutorial? (mesma regra do scan, sem o teste de visibilidade.)
  function campoElegivelTutorial(el) {
    try {
      if (host && host.contains && host.contains(el)) return false;
      if (/^p9999_search$/i.test(el.id || "")) return false;
      if (el.closest && el.closest('.t-Header,#t_Header,[role="banner"],.t-Header-navBar,.a-MenuBar,.t-NavigationBar')) return false;
      var t = (el.type || "").toLowerCase();
      if (t === "hidden" || t === "password" || t === "submit" || t === "button" || t === "reset" || t === "file") return false;
      if (el.disabled) return false;
      var ehLov = (typeof el.className === "string" && /(^|\s)(popup_lov|apex-item-popup-lov)(\s|$)/.test(el.className)) ||
        (el.closest && el.closest(".apex-item-group--popup-lov, .apex-item-popup-lov"));
      if (!ehLov && (el.readOnly || el.getAttribute("aria-readonly") === "true")) return false;
      return true;
    } catch { return false; }
  }
  // Varre a tela AO VIVO e devolve os campos a percorrer, na ORDEM DE LEITURA:
  //  - VISÍVEIS primeiro (linha por linha, esquerda→direita, por sobreposição);
  //  - campos em ABA inativa ao fim (reveláveis por clique na aba);
  //  - campos ocultos por regra DINÂMICA (região escondida) ficam de FORA — voltam
  //    sozinhos quando a região aparece, porque re-varremos a cada passo.
  // Botões de AÇÃO que CONCLUEM o processo — vão por ÚLTIMO no tutorial (mesmo no topo).
  var RX_ACAO_TUT = /\b(criar|salvar|gravar|apagar|excluir|deletar|remover|cadastrar)\b/i;
  // Está numa REGIÃO COLAPSADA (recolhida)? (APEX Universal Theme, genérico, <details>)
  function emRegiaoColapsada(el) {
    return !!(el.closest && el.closest('.collapseRegion, [class*="collaps"], [class*="Collaps"], .t-Region--collapsible, details:not([open])'));
  }
  function coletarCamposTutorial() {
    var vis = [], tab = [], colap = [], acoes = [], seen = [];
    function jaTem(el) { for (var i = 0; i < seen.length; i++) if (seen[i] === el) return true; seen.push(el); return false; }
    function coletar(doc) {
      if (!doc) return;
      try {
        doc.querySelectorAll("input,select,textarea,[contenteditable='true'],[contenteditable='']").forEach(function (el) {
          if (!campoElegivelTutorial(el) || jaTem(el)) return;
          var visivel = el.getClientRects && el.getClientRects().length > 0;
          var emAba = el.closest && el.closest('[role="tabpanel"]');
          if (visivel) { var r = rectInTop(el); vis.push({ el: el, top: r.top, bottom: r.top + (r.height || 0), left: r.left }); }
          else if (emAba) tab.push(el);              // aba inativa → revelável por clique na aba
          else if (emRegiaoColapsada(el)) colap.push(el); // região recolhida → expandimos no walk
          // else: realmente oculto por regra dinâmica → pula (volta sozinho quando aparecer)
        });
      } catch { }
      // Botões de AÇÃO (criar/salvar/apagar/deletar) — entram no tutorial, sempre por ÚLTIMO.
      try {
        doc.querySelectorAll("button,input[type='submit'],input[type='button'],a.t-Button,a.a-Button,[role='button']").forEach(function (el) {
          if (jaTem(el)) return;
          if (host && host.contains && host.contains(el)) return;
          if (el.disabled || el.getAttribute("aria-disabled") === "true") return;
          if (el.getClientRects && el.getClientRects().length === 0) return; // invisível
          var lbl = (el.getAttribute("aria-label") || (el.tagName === "INPUT" ? el.value : scanTexto(el.textContent)) || el.title || "").toString();
          if (RX_ACAO_TUT.test(lbl)) acoes.push(el);
        });
      } catch { }
      try { doc.querySelectorAll("iframe").forEach(function (f) { var d = null; try { d = f.contentDocument; } catch { d = null; } if (d) coletar(d); }); } catch { }
    }
    coletar(raizVarredura()); // modal aberto restringe o walk ao modal (não à página de trás)
    vis.sort(function (a, b) { return a.top - b.top || a.left - b.left; });
    var ord = [], k = 0;
    while (k < vis.length) {
      var band = vis[k].bottom, j = k + 1;
      while (j < vis.length && vis[j].top < band - 2) { band = Math.max(band, vis[j].bottom); j++; }
      vis.slice(k, j).sort(function (a, b) { return a.left - b.left; }).forEach(function (v) { ord.push(v.el); });
      k = j;
    }
    tab.forEach(function (el) { ord.push(el); });     // campos de aba inativa
    colap.forEach(function (el) { ord.push(el); });   // campos de região recolhida
    acoes.forEach(function (el) { ord.push(el); });   // botões de AÇÃO por ÚLTIMO
    // Intercala um passo de REGIÃO antes do 1º item de cada seção (destaca a região
    // inteira + explica o que ela é). Só regiões TITULADAS (as mesmas do scanFields).
    var passos = [], regVista = {};
    for (var q = 0; q < ord.length; q++) {
      var reg = regiaoTituladaDe(ord[q]);
      if (reg && reg.id && !regVista[reg.id]) { regVista[reg.id] = 1; passos.push({ el: reg, chave: chaveCampo(reg), regiao: true }); }
      passos.push({ el: ord[q], chave: chaveCampo(ord[q]) });
    }
    return passos;
  }
  // A .t-Region TITULADA mais próxima do elemento (sobe por regiões aninhadas). Casa com
  // as regiões coletadas no scanFields, para reusar a explicação da IA (por id/chave).
  function regiaoTituladaDe(el) {
    try {
      var reg = el.closest && el.closest(".t-Region");
      while (reg) {
        var h = reg.querySelector(".t-Region-title, [id$='_heading']");
        var t = h ? scanTexto(h.textContent).trim() : "";
        if (reg.id && t && !/^(itens|par[âa]metros|breadcrumb|global)/i.test(t)) return reg;
        reg = reg.parentElement && reg.parentElement.closest ? reg.parentElement.closest(".t-Region") : null;
      }
    } catch (e) { }
    return null;
  }
  function mostrarPassoTutorial(alvoForcado) {
    var t = _tutorial;
    if (!t) return;
    if (t._box && t._box.parentNode) { try { t._box.remove(); } catch (e) { } } t._box = null; // tira os botões do passo anterior
    // Re-varre a tela AGORA (respeita regiões/campos que apareceram ou sumiram) e
    // pega o PRÓXIMO campo visível ainda não visitado, na ordem de leitura atual.
    var lista = coletarCamposTutorial();
    // CLIQUE num campo à frente: marca os campos ANTES dele como visitados, para que o
    // "primeiro não-visitado" passe a ser ELE — assim "Prosseguir" segue A PARTIR daqui
    // (não volta pra trás). Ajusta t.n para a posição real do campo clicado.
    if (alvoForcado) {
      var idxF = -1;
      for (var x = 0; x < lista.length; x++) if (lista[x].el === alvoForcado) { idxF = x; break; }
      if (idxF >= 0) {
        for (var y = 0; y < idxF; y++) { var ch = lista[y].chave; if (ch && !t.visitados[ch]) { t.visitados[ch] = true; t.pilha.push(ch); } }
        t.n = idxF; // +1 abaixo → nº do passo = posição do campo clicado
      }
    }
    var alvo = null, restantes = 0;
    for (var i = 0; i < lista.length; i++) { if (lista[i].chave && !t.visitados[lista[i].chave]) { restantes++; if (!alvo) alvo = lista[i]; } }
    if (!alvo) { statusMsg("Tutorial concluído — é só me chamar quando precisar.", null); encerrarTutorial(); return; }
    var el = alvo.el, chave = alvo.chave;
    t.n += 1;
    var total = t.n + restantes - 1;      // estimativa (cresce se novas regiões surgirem)
    var ultimo = restantes <= 1;
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var ex = t.expl[chave];
    var titulo = (ex && ex.titulo) || rotuloCampo(el);
    var explic = (ex && ex.explicacao) || explicacaoGenerica(el);

    // Ações compartilhadas pelos botões do CHAT e do BALÃO flutuante.
    var box; // botões do chat (removidos ao avançar)
    function avancar() {
      if (box && box.parentNode) box.remove();
      hideCallout();
      if (chave) t.pilha.push(chave);     // registra na trilha (para o "Voltar")
      t.visitados[chave] = true;          // marca e RE-VARRE (a tela pode ter mudado)
      unhighlightField();
      mostrarPassoTutorial();
    }
    function voltar() {
      if (!t.pilha || !t.pilha.length) return;
      if (box && box.parentNode) box.remove();
      hideCallout();
      unhighlightField();
      var prev = t.pilha.pop();           // último campo avançado volta a ser o alvo
      delete t.visitados[prev];
      t.n = Math.max(0, t.n - 2);         // desfaz o +1 desta etapa e recua uma
      mostrarPassoTutorial();
    }
    function sair() {
      if (box && box.parentNode) box.remove();
      hideCallout();
      statusMsg("Saí do tutorial.", null);
      encerrarTutorial();
    }

    // (1) Registro no CHAT: bolha "Passo N de M · Campo" + explicação + botões.
    var bolha = document.createElement("div");
    bolha.className = "m a";
    var tit = document.createElement("div");
    tit.style.cssText = "font-weight:700;margin-bottom:4px;color:" + pc + ";";
    tit.textContent = "Passo " + t.n + " de " + total + (titulo ? " · " + titulo : "");
    var exp = document.createElement("div");
    exp.textContent = explic;
    bolha.appendChild(tit); bolha.appendChild(exp);
    messagesEl.appendChild(botRow(bolha));
    box = document.createElement("div");
    box.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin:2px 0 6px 40px;";
    var avC = tutBtn(ultimo ? "Concluir ✓" : "Prosseguir →", true);
    avC.addEventListener("click", avancar);
    box.appendChild(avC);
    var podeVoltar = !!(t.pilha && t.pilha.length);
    if (podeVoltar) { var voC = tutBtn("← Voltar", false); voC.addEventListener("click", voltar); box.appendChild(voC); }
    var saC = tutBtn("Sair", false); saC.addEventListener("click", sair); box.appendChild(saC);
    messagesEl.appendChild(box);
    t._box = box; // rastreia os botões do passo atual (removidos ao mostrar o próximo)
    scrollChatFimSoon(); // o chat acompanha o passo (fica no fim), antes de mexer no host

    // (2) Destaca o campo no HOST e ancora o BALÃO flutuante (avatar + etapa + botões).
    highlightField(el); // ativa a aba se preciso, rola o host e destaca
    mostrarCallout({ titulo: titulo, explicacao: explic }, t.n, total, ultimo, avancar, sair, podeVoltar, voltar);
  }
  // ==== Clicar num campo DURANTE o tutorial → mostra a explicação DAQUELE campo ====
  // Documentos onde o clique é escutado: o topo + os iframes DENTRO do escopo (modal).
  function docsTutorial() {
    var docs = [document];
    try {
      var raiz = raizVarredura();
      var frames = raiz.querySelectorAll ? raiz.querySelectorAll("iframe") : [];
      for (var i = 0; i < frames.length; i++) {
        var d = null; try { d = frames[i].contentDocument; } catch (e) { d = null; }
        if (d && docs.indexOf(d) < 0) docs.push(d);
      }
    } catch (e) { }
    return docs;
  }
  // Clique num campo DURANTE o tutorial: PULA a demonstração para ELE (mostrarPassoTutorial
  // marca os anteriores como vistos), então "Prosseguir" segue A PARTIR daqui — não volta.
  function explicarCampoTutorial(el) {
    if (!_tutorial) return;
    hideCallout(); unhighlightField();
    mostrarPassoTutorial(el);
  }
  function onTutorialClick(e) {
    try {
      if (!_tutorial || _picking) return; // não interfere no fluxo de "clique p/ preencher"
      var el = e.target;
      if (!el) return;
      if (host && host.contains && host.contains(el)) return;               // clique no widget
      if (_callout && _callout.contains && _callout.contains(el)) return;   // clique no próprio balão
      // Resolve o CAMPO: o próprio, um <label for>/envolvente, ou um ancestral editável.
      var sel = "input,select,textarea,[contenteditable='true'],[contenteditable='']";
      var campo = null;
      if (el.matches && el.matches(sel)) campo = el;
      if (!campo && el.closest) {
        var lab = el.closest("label");
        if (lab) {
          var forId = lab.getAttribute("for");
          campo = forId ? (el.ownerDocument || document).getElementById(forId) : lab.querySelector(sel);
        }
        if (!campo) campo = el.closest(sel);
      }
      if (!campo || !campoElegivelTutorial(campo)) return;
      // Campo do TOPO fora do modal → ignora (os de iframe já vêm só do escopo escutado).
      var raiz = raizVarredura();
      if (campo.ownerDocument === document && raiz !== document && raiz.contains && !raiz.contains(campo)) return;
      explicarCampoTutorial(campo);
    } catch (e2) { }
  }
  function ligarCliqueTutorial() {
    desligarCliqueTutorial();
    _tutDocs = docsTutorial();
    _tutDocs.forEach(function (d) { try { d.addEventListener("click", onTutorialClick, true); } catch (e) { } });
  }
  function desligarCliqueTutorial() {
    if (!_tutDocs) return;
    _tutDocs.forEach(function (d) { try { d.removeEventListener("click", onTutorialClick, true); } catch (e) { } });
    _tutDocs = null;
  }
  // Uma opção de <select> casa o valor pedido? Casa por CÓDIGO (value) ou por
  // NOME (texto), com limite de palavra para "200" não casar "2000" nem "1200".
  function opcaoCasa(o, v) {
    var nv = scanTexto(v).toLowerCase(); if (!nv) return false;
    if (o.value != null && String(o.value).toLowerCase() === nv) return true;
    var ot = scanTexto(o.textContent).toLowerCase();
    if (ot === nv) return true;
    var esc = nv.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try { return new RegExp("(^|[^0-9a-zà-ú])" + esc + "([^0-9a-zà-ú]|$)", "i").test(ot); } catch { return ot.indexOf(nv) >= 0; }
  }
  // ══ POPUP LOV do APEX ═══════════════════════════════════════════════════════
  // Campo "lista de valores" que NÃO se preenche digitando: o input é readonly e o
  // valor real mora num hidden. É preciso abrir a janela, pesquisar, ESPERAR a lista
  // voltar e clicar no item. Até aqui isso era pedido ao MODELO em 3 turnos — caro,
  // lento e fácil de perder o fio no meio. Aqui a sequência inteira vira UMA ação
  // determinística; o modelo só diz o campo e o valor.

  /** Rastro no console do navegador — é por onde se descobre ONDE a sequência parou. */
  function diagLov(msg) { try { if (window.console && console.log) console.log("[kb-widget][lov] " + msg); } catch { } }

  /** O elemento é um popup LOV do APEX? */
  function ehPopupLov(el) {
    try {
      if (!el) return false;
      if (typeof el.className === "string" && /(^|\s)(popup_lov|apex-item-popup-lov)(\s|$)/.test(el.className)) return true;
      return !!(el.closest && el.closest(".apex-item-group--popup-lov, .apex-item-popup-lov"));
    } catch { return false; }
  }

  /** Botão da lupa que abre a janela. Sem ele, o próprio input costuma abrir. */
  function botaoDoLov(el) {
    try {
      var doc = el.ownerDocument || document;
      if (el.id) {
        var b = doc.getElementById(el.id + "_lov_btn");
        if (b) return b;
      }
      var grupo = el.closest && el.closest(".apex-item-group--popup-lov, .apex-item-group");
      var alvo = grupo && grupo.querySelector(".a-Button--popupLOV, .a-Button--popupLov, button[id$='_lov_btn']");
      return alvo || el; // sem botão: clicar no input abre
    } catch { return el; }
  }

  /** O dialog aberto DESTE campo (o APEX nomeia o conteúdo com o id do item). */
  function dialogDoLov(el) {
    try {
      var doc = el.ownerDocument || document;
      var visivel = function (d) { return d && d.getClientRects && d.getClientRects().length > 0; };
      if (el.id) {
        var conteudo = doc.querySelector('[id^="PopupLov_"][id$="_' + el.id + '_dlg"], #PopupLov_' + el.id + "_dlg");
        var d1 = conteudo && conteudo.closest(".ui-dialog");
        if (visivel(d1)) return d1;
      }
      // Sem casar pelo id, vale o dialog de LOV visível mais recente.
      var todos = Array.prototype.slice.call(doc.querySelectorAll(".ui-dialog-popuplov")).filter(visivel);
      return todos.length ? todos[todos.length - 1] : null;
    } catch { return null; }
  }

  /** Poll simples até `cond()` virar verdade. Resolve com o valor ou null no timeout. */
  function ateQue(cond, timeout, intervalo) {
    return new Promise(function (resolve) {
      var t0 = Date.now();
      (function tick() {
        var v = null;
        try { v = cond(); } catch { v = null; }
        if (v) return resolve(v);
        if (Date.now() - t0 > timeout) return resolve(null);
        setTimeout(tick, intervalo || 120);
      })();
    });
  }

  /** Itens atualmente na lista de resultados do dialog. */
  function itensDoLov(dlg) {
    try {
      return Array.prototype.slice.call(dlg.querySelectorAll("ul.a-IconList li.a-IconList-item, .a-GV-table tbody tr[data-id]"));
    } catch { return []; }
  }

  /** "Impressão digital" da lista — é o que diz se a PESQUISA já voltou. */
  function assinaturaLov(dlg) {
    var it = itensDoLov(dlg);
    var ids = it.slice(0, 30).map(function (li) { return li.getAttribute("data-id") || scanTexto(li.textContent).slice(0, 30); });
    return it.length + "|" + ids.join(",");
  }

  /** A janela informou "Nenhum resultado encontrado"? */
  function lovSemResultado(dlg) {
    try {
      var m = dlg.querySelector(".a-GV-noDataMsg");
      return !!(m && m.getClientRects && m.getClientRects().length > 0);
    } catch { return false; }
  }

  /**
   * Casa o item pedido contra a lista, em ORDEM DE PRECISÃO.
   *
   * O texto do item vem como "700 - Natcorp Do Brasil" e o código no `data-id`. O
   * usuário pode dizer o código, o nome inteiro, ou parte dele. Escolher errado aqui
   * GRAVA dado errado numa tela do sistema — diferente de errar uma leitura. Por isso
   * a ambiguidade não é resolvida no chute: devolve os candidatos para o modelo
   * perguntar.
   */
  function casarItemLov(itens, valor) {
    var alvo = scanTexto(valor).toLowerCase();
    if (!alvo) return { erro: "sem valor" };
    var norm = function (t) { return scanTexto(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); };
    var alvoN = norm(valor);
    var info = itens.map(function (li) {
      var id = String(li.getAttribute("data-id") || "").toLowerCase();
      var txt = norm(li.textContent);
      // "700 - Natcorp Do Brasil" → descrição sem o código.
      var desc = txt.replace(/^\s*[\w.\-]+\s*[-–]\s*/, "");
      return { li: li, id: id, txt: txt, desc: desc };
    });
    var por = function (f) { return info.filter(f); };
    // 1) código exato · 2) descrição exata · 3) texto inteiro exato
    var c = por(function (x) { return x.id && x.id === alvo; });
    if (c.length === 1) return { li: c[0].li, via: "codigo" };
    c = por(function (x) { return x.desc === alvoN; });
    if (c.length === 1) return { li: c[0].li, via: "descricao" };
    c = por(function (x) { return x.txt === alvoN; });
    if (c.length === 1) return { li: c[0].li, via: "texto" };
    // 4) começa com · 5) contém — só valem quando UM item sobra.
    c = por(function (x) { return x.desc.indexOf(alvoN) === 0; });
    if (c.length === 1) return { li: c[0].li, via: "prefixo" };
    var contem = por(function (x) { return x.txt.indexOf(alvoN) >= 0; });
    if (contem.length === 1) return { li: contem[0].li, via: "contem" };
    if (contem.length > 1) {
      return { ambiguo: contem.slice(0, 8).map(function (x) { return scanTexto(x.li.textContent); }) };
    }
    return { erro: "nao encontrado" };
  }

  /**
   * Preenche um popup LOV de ponta a ponta. Resolve com
   * `{ ok }` ou `{ ok:false, motivo, candidatos? }` — o motivo volta ao modelo para
   * ele reagir (perguntar, refinar o termo), em vez de só "não consegui".
   */
  function preencherPopupLov(el, valor) {
    var termo = String(valor == null ? "" : valor).trim();
    diagLov("início — campo " + (el && el.id ? el.id : "?") + ", valor “" + termo + "”");
    if (!termo) return Promise.resolve({ ok: false, motivo: "valor vazio" });
    var dlg = null;
    // Idempotência: já está com o valor pedido → não abre janela nenhuma.
    try {
      var atual = scanTexto(el.value || "");
      var hid = el.id && (el.ownerDocument || document).getElementById(el.id + "_HIDDENVALUE");
      var codigo = hid ? String(hid.value || "") : "";
      if (atual && (atual.toLowerCase() === termo.toLowerCase() || codigo === termo)) {
        return Promise.resolve({ ok: true, jaEstava: true });
      }
    } catch { }

    return Promise.resolve()
      .then(function () {
        clickElement(botaoDoLov(el));
        // Espera a JANELA e o CAMPO DE BUSCA — o dialog do jQuery UI aparece no DOM
        // antes de o APEX montar o conteúdo, então checar só a janela pegava um
        // momento em que a barra de pesquisa ainda não existia.
        return ateQue(function () {
          var d = dialogDoLov(el);
          return d && d.querySelector(".a-PopupLOV-search") ? d : null;
        }, 8000);
      })
      .then(function (d) {
        if (!d) {
          // Distingue os dois fracassos: sem isso o motivo era sempre "não abriu".
          var abriu = !!dialogDoLov(el);
          diagLov(abriu ? "janela abriu mas SEM campo de busca" : "janela não abriu");
          return { ok: false, motivo: abriu ? "a janela abriu mas não achei o campo de pesquisa dela" : "a janela de busca não abriu" };
        }
        dlg = d;
        var busca = dlg.querySelector(".a-PopupLOV-search");
        diagLov("janela aberta; pesquisando “" + termo + "”");
        var antes = assinaturaLov(dlg);
        // Digita com o setter nativo (o APEX escuta `input`) e dispara a pesquisa.
        // Foca ANTES de escrever: alguns handlers do APEX só assinam o campo ativo.
        try { busca.focus(); busca.click(); } catch { }
        try {
          var desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
          if (desc && desc.set) desc.set.call(busca, termo); else busca.value = termo;
        } catch { busca.value = termo; }
        // Três eventos: `input` (padrão), `keyup` (versões que escutam digitação) e
        // `change` (jQuery). Emitir os três é barato e cobre as variações do tema.
        ["input", "keyup", "change"].forEach(function (tp) {
          try { busca.dispatchEvent(new Event(tp, { bubbles: true })); } catch { }
        });
        diagLov("busca preenchida com “" + busca.value + "”");
        var botaoBuscar = dlg.querySelector(".a-PopupLOV-doSearch");
        if (botaoBuscar) { clickElement(botaoBuscar); diagLov("cliquei em Pesquisar"); }
        else diagLov("botão Pesquisar não encontrado — só Enter");
        // Enter também: em algumas versões é o único gatilho.
        ["keydown", "keypress", "keyup"].forEach(function (tp) {
          try { busca.dispatchEvent(new KeyboardEvent(tp, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true })); } catch { }
        });
        // ESPERA A LISTA VOLTAR. Não basta "ter item": a lista JÁ vem preenchida antes
        // da busca, então selecionar cedo pegaria o resultado velho. O sinal é a
        // assinatura MUDAR — ou o próprio APEX dizer que não há resultado.
        return ateQue(function () {
          return assinaturaLov(dlg) !== antes || lovSemResultado(dlg) ? true : null;
        }, 8000).then(function (mudou) {
          // A busca pode legitimamente devolver o MESMO conjunto (termo amplo). Nesse
          // caso seguimos assim mesmo, depois de dar tempo ao AJAX.
          if (!mudou) return new Promise(function (r) { setTimeout(r, 400); });
          return null;
        });
      })
      .then(function (parcial) {
        if (parcial && parcial.ok === false) return parcial;
        if (!dlg) return { ok: false, motivo: "a janela de busca não abriu" };
        if (lovSemResultado(dlg)) {
          diagLov("APEX respondeu: nenhum resultado");
          fecharDialogLov(dlg);
          return { ok: false, motivo: 'a busca por "' + termo + '" não retornou nenhum resultado' };
        }
        var itens = itensDoLov(dlg);
        if (!itens.length) {
          fecharDialogLov(dlg);
          return { ok: false, motivo: "a lista de resultados não carregou a tempo" };
        }
        diagLov(itens.length + " item(ns) na lista após a busca");
        var m = casarItemLov(itens, termo);
        if (m.ambiguo) {
          fecharDialogLov(dlg);
          return { ok: false, motivo: "mais de uma opção casa com esse valor", candidatos: m.ambiguo };
        }
        if (!m.li) {
          var amostra = itens.slice(0, 8).map(function (li) { return scanTexto(li.textContent); });
          fecharDialogLov(dlg);
          return { ok: false, motivo: 'nenhum item da lista corresponde a "' + termo + '"', candidatos: amostra };
        }
        clickElement(m.li);
        // Confirma que a seleção PEGOU: o dialog fecha e o campo recebe valor. Fechar
        // sozinho não basta — o usuário pode ter cancelado.
        return ateQue(function () {
          var fechado = !dialogDoLov(el);
          var temValor = !!scanTexto(el.value || "");
          return fechado && temValor ? true : null;
        }, 4000).then(function (pegou) {
          diagLov(pegou ? "selecionado com sucesso" : "cliquei no item mas o campo não recebeu valor");
          if (pegou) return { ok: true };
          fecharDialogLov(dialogDoLov(el));
          return { ok: false, motivo: "cliquei no item mas o campo não recebeu o valor" };
        });
      })
      .catch(function (e) {
        try { fecharDialogLov(dlg); } catch { }
        return { ok: false, motivo: "falha inesperada ao operar a janela (" + (e && e.message ? e.message : "erro") + ")" };
      });
  }

  /** Fecha a janela — sequência que falha no meio não pode deixar lixo na tela. */
  function fecharDialogLov(dlg) {
    try {
      if (!dlg) return;
      var x = dlg.querySelector(".ui-dialog-titlebar-close");
      if (x) x.click();
    } catch { }
  }

  function fillField(el, valor, valores) {
    // Blindagem: nunca escreve em campo restrito (mesmo se o usuário clicar nele
    // no modo "escolher"). O scan já os oculta; aqui é a garantia técnica.
    if (!el || el.disabled || el.readOnly || el.getAttribute("aria-readonly") === "true") return false;
    try {
      if (el.isContentEditable) {
        el.textContent = valor;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      } else if ((el.tagName || "").toLowerCase() === "select") {
        var alvos = (valores && valores.length) ? valores : [valor];
        if (el.multiple) {
          // Múltipla seleção: marca TODAS as opções que casam qualquer alvo.
          var algum = false;
          Array.prototype.forEach.call(el.options, function (o) {
            var sel = alvos.some(function (v) { return opcaoCasa(o, v); });
            o.selected = sel; if (sel) algum = true;
          });
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          if (!algum) return false; // nenhum item casou → falha (não finge sucesso)
        } else {
          var achou = false;
          Array.prototype.forEach.call(el.options, function (o) {
            if (!achou && opcaoCasa(o, alvos[0])) { el.value = o.value; achou = true; }
          });
          el.dispatchEvent(new Event("change", { bubbles: true }));
          if (!achou) return false;
        }
      } else {
        // setter nativo -> React/Angular percebem a mudança
        var proto = (el.tagName || "").toLowerCase() === "textarea" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        var desc = Object.getOwnPropertyDescriptor(proto, "value");
        if (desc && desc.set) desc.set.call(el, valor); else el.value = valor;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
      try { el.focus(); } catch { }
      return true;
    } catch { return false; }
  }
  // Marca/desmarca radio ou checkbox (blindado contra restritos, como fillField).
  function checkOption(el, marcar) {
    if (!el || el.disabled || el.readOnly || el.getAttribute("aria-readonly") === "true") return false;
    try {
      var t = (el.type || "").toLowerCase();
      if (t === "checkbox") {
        if (el.checked !== marcar) el.click();
      } else if (t === "radio") {
        if (marcar) { if (!el.checked) el.click(); }
        else { el.checked = false; el.dispatchEvent(new Event("change", { bubbles: true })); }
      } else {
        el.checked = marcar; el.dispatchEvent(new Event("change", { bubbles: true }));
      }
      // Garantia: se o click foi barrado, reflete o estado direto (exceto radio, que
      // não se "desmarca" por click).
      if (el.checked !== marcar && t !== "radio") { el.checked = marcar; el.dispatchEvent(new Event("change", { bubbles: true })); }
      try { el.focus(); } catch { }
      return true;
    } catch { return false; }
  }
  // Clica um botão/link (blindado contra desabilitados). Dispara hover antes do
  // clique porque menus do APEX (a-Menu) abrem submenus no passar do mouse — e o
  // menu escuta o hover no <li> do item, não só no <button>.
  function clickElement(el) {
    if (!el || el.disabled || el.getAttribute("aria-disabled") === "true") return false;
    try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { }
    try {
      var alvos = [el];
      var li = el.closest ? el.closest("li.a-Menu-item, li[role='menuitem'], li") : null;
      if (li && li !== el) alvos.push(li);
      alvos.forEach(function (t) {
        ["pointerover", "mouseover", "mouseenter", "mousemove"].forEach(function (tp) {
          t.dispatchEvent(new MouseEvent(tp, { bubbles: true, cancelable: true, view: window }));
        });
      });
    } catch { }
    try { el.focus(); } catch { }
    try { el.click(); return true; } catch { return false; }
  }
  // Linha compacta de status (sem botões) — informa uma ação já executada.
  function statusMsg(txt, cor) {
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var d = document.createElement("div");
    d.style.cssText =
      "margin:6px 0 6px 40px;padding:8px 12px;border-radius:14px;max-width:88%;font-size:12.5px;font-weight:700;" +
      "color:" + (cor || pc) + ";border:1px solid " + pc + "40;background:" + pc + "0d;";
    d.textContent = txt;
    messagesEl.appendChild(d); messagesEl.scrollTop = messagesEl.scrollHeight;
    return d;
  }
  // Status COM animação de "digitando" (dots), para fases EM ANDAMENTO (busca/análise).
  // Retorna o elemento; use `._txt.textContent` para atualizar só o texto (progresso).
  function statusMsgTyping(txt, cor) {
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var d = document.createElement("div");
    d.style.cssText =
      "margin:6px 0 6px 40px;padding:8px 12px;border-radius:14px;max-width:88%;font-size:12.5px;font-weight:700;" +
      "display:inline-flex;align-items:center;gap:9px;color:" + (cor || pc) + ";border:1px solid " + pc + "40;background:" + pc + "0d;";
    var t = document.createElement("span"); t.textContent = txt;
    var dots = document.createElement("span"); dots.className = "dots";
    dots.innerHTML = "<span></span><span></span><span></span>";
    d.appendChild(t); d.appendChild(dots); d._txt = t;
    messagesEl.appendChild(d); messagesEl.scrollTop = messagesEl.scrollHeight;
    return d;
  }
  // Slot ÚNICO de status de processo (busca → análise): substitui/limpa o anterior.
  var _procStatus = null;
  function procStatus(txt, cor) { limparProcStatus(); _procStatus = statusMsgTyping(txt, cor); return _procStatus; }
  function limparProcStatus() { if (_procStatus) { try { if (_procStatus.parentNode) _procStatus.remove(); } catch (e) { } _procStatus = null; } }
  // Spinner CSS-only (círculo girando) — para "processando" em botões e status.
  function spinnerEl(cor, sz) {
    var s = document.createElement("span"); sz = sz || 14;
    var c = cor || ((cfg && cfg.primaryColor) || "#511C76");
    s.className = "kbspin";
    s.style.cssText = "display:inline-block;flex:none;width:" + sz + "px;height:" + sz + "px;border:2px solid " + c + "44;border-top-color:" + c + ";border-radius:50%;box-sizing:border-box;vertical-align:-2px;";
    return s;
  }
  // Linha de status COM spinner (fase em andamento, sem barra de progresso). Devolve
  // o elemento — chame `.remove()` ao terminar.
  function statusSpin(txt, cor) {
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var d = document.createElement("div");
    d.style.cssText = "margin:6px 0 6px 40px;padding:8px 12px;border-radius:14px;max-width:88%;font-size:12.5px;font-weight:700;display:inline-flex;align-items:center;gap:9px;color:" + (cor || pc) + ";border:1px solid " + pc + "40;background:" + pc + "0d;";
    d.appendChild(spinnerEl(cor || pc, 14));
    var t = document.createElement("span"); t.textContent = txt; d.appendChild(t);
    messagesEl.appendChild(d); messagesEl.scrollTop = messagesEl.scrollHeight;
    return d;
  }
  // Disclaimer CONTEXTUAL: reflete a fonte REAL da resposta (relatório da tela × base
  // de dados × cruzamento × campos da tela), em linguagem simples. Retorna null quando
  // não há fonte de tela/base clara (aí não mostra nada).
  function disclaimerTexto(body) {
    var bd = body.baseDados;
    var temFontes = bd && ((bd.relatorioIds && bd.relatorioIds.length) || (bd.attachmentIds && bd.attachmentIds.length));
    var temTela = !!(body.reportData || (body.screenTables && body.screenTables.length));
    var temCampos = !!(body.fields && body.fields.length);
    if (temFontes) {
      var base = "Resposta baseada nos arquivos e relatórios que você escolheu";
      if (bd.modo === "so_fontes") return base + " (apenas essas fontes).";
      var trecho = temTela ? " e no relatório desta tela" : (temCampos ? " e nas informações desta tela" : "");
      if (bd.modo === "exclusiva") return base + trecho + ".";
      return base + trecho + " e no conhecimento da IA.";
    }
    if (body.comparacao) return "Resposta baseada no cruzamento entre esta tela e o relatório salvo, considerando os filtros aplicados.";
    if (body.reportData) return "Resposta baseada nos dados do relatório desta tela, considerando os filtros aplicados.";
    if (temTela) return "Resposta baseada no relatório visível nesta tela.";
    return null;
  }
  function mostrarDisclaimer(body) {
    var txt = disclaimerTexto(body);
    if (!txt) return;
    var d = document.createElement("div");
    d.style.cssText = "margin:2px 0 8px 40px;max-width:88%;font-size:11.5px;font-style:italic;color:#6b7280;";
    d.textContent = "ℹ️ " + txt;
    messagesEl.appendChild(d); messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  // Trilha curta da ação (para a nota de continuação enviada à IA).
  function labelExec(a) {
    return (a.tipo === "fill" ? "preencheu " : a.tipo === "check" ? (a.marcar ? "marcou " : "desmarcou ") : "clicou em ") + a.label;
  }
  // Marca que a IA agiu neste turno (habilita o próximo passo do loop autônomo).
  function registrarExec(a) { _turnActed = true; _execLabels.push(labelExec(a)); }
  // Executa a ação SEM confirmação (preencher/marcar e cliques de visualização),
  // mostra um status compacto e segue a fila.
  function execDireto(a, el) {
    highlightField(el);
    // POPUP LOV é a única ação ASSÍNCRONA: abrir a janela, pesquisar, esperar a lista
    // voltar e clicar leva segundos. O resto do fluxo continua igual — `terminar`
    // recebe o resultado venha ele de onde vier.
    var ehLovFill = a.tipo === "fill" && ehPopupLov(el);
    var passo = ehLovFill
      ? preencherPopupLov(el, a.valor)
      : Promise.resolve({
          ok: a.tipo === "fill" ? fillField(el, a.valor, a.valores) : a.tipo === "check" ? checkOption(el, a.marcar) : clickElement(el),
        });
    if (ehLovFill) statusMsg("🔎 Abrindo a lista de “" + a.label + "”…", "#6b7280");

    passo.then(function (r) {
      var ok = !!(r && r.ok);
      setTimeout(function () { unhighlightField(el); }, 700);
      var nome = a.tipo === "fill" ? "Preenchi " : a.tipo === "check" ? (a.marcar ? "Marquei " : "Desmarquei ") : "Cliquei em ";
      var multi = a.tipo === "fill" && a.valores && a.valores.length;
      var extra = multi ? " (" + a.valores.length + " itens)"
        : (a.tipo === "fill" && a.valor ? ": " + (a.valor.length > 60 ? a.valor.slice(0, 60) + "…" : a.valor) : "");
      if (ok) { registrarExec(a); statusMsg("✅ " + nome + "“" + a.label + "”" + extra, "#15803d"); }
      else {
        // O MOTIVO volta ao modelo (via `_execLabels`), para ele reagir — perguntar
        // qual das opções, refinar o termo — em vez de só repetir "não consegui".
        var motivo = r && r.motivo ? " — " + r.motivo : "";
        var cands = r && r.candidatos && r.candidatos.length ? " Opções: " + r.candidatos.join(" · ") : "";
        statusMsg("⚠️ Não consegui " + nome.toLowerCase() + "“" + a.label + "”" + motivo, "#b45309");
        _turnActed = true;
        _execLabels.push("NÃO conseguiu preencher “" + a.label + "”" + motivo + "." + cands);
      }
      // Campos em CASCATA: preencher/marcar um campo pode disparar o carregamento
      // (AJAX) das opções do campo dependente. Se há mais ações na fila, espera o
      // dependente assentar antes da próxima — senão o filho ainda estaria vazio.
      var mudouValor = ok && (a.tipo === "fill" || a.tipo === "check");
      if (mudouValor && _acoes.length > 0) setTimeout(proximaAcao, ehLovFill ? 900 : 550);
      else proximaAcao();
    });
  }
  // ── Filtro do IR: se JÁ existe filtro ativo e a IA vai aplicar uma NOVA busca pela
  // barra de pesquisa, pergunta se limpa o filtro atual antes (evita empilhar filtros).
  function filtrosAtivos(rv) {
    try {
      var reg = (rv && rv.closest && rv.closest(".a-IRR")) || rv || document;
      return Array.prototype.slice.call(reg.querySelectorAll(".a-IRR-controls .a-IRR-button--remove, .a-IRR-controls-item .a-IRR-button--remove"));
    } catch { return []; }
  }
  function rotulosFiltro(rv) {
    try {
      var reg = (rv && rv.closest && rv.closest(".a-IRR")) || rv || document;
      return Array.prototype.slice.call(reg.querySelectorAll(".a-IRR-controlsLabel"))
        .map(function (l) { return scanTexto(l.textContent); }).filter(Boolean);
    } catch { return []; }
  }
  // CONTEXTO do relatório: PROGRAMA (título/nome da página) + FILTROS aplicados — os
  // campos de filtro PREENCHIDOS da tela ("Rótulo: valor") e os chips do Interactive
  // Report ("Coluna = valor" ou o texto do filtro, inclusive filtros complexos). Vira o
  // subtítulo dos arquivos gerados, a legenda da modal/tabela do gráfico e é salvo no spec.
  // Título PRINCIPAL da página (o que o usuário lê no topo) → título do APEX quando
  // existir; senão o título da aba (document.title); por último o nome do caminho.
  function tituloPrincipalPagina() {
    var sels = [".t-Body-title", ".t-BreadcrumbRegion-title", "#t_Body_title", ".apex-page-title", "h1"];
    for (var i = 0; i < sels.length; i++) {
      try {
        var el = document.querySelector(sels[i]);
        if (el) { var t = scanTexto(el.textContent || "").trim(); if (t && t.length <= 160) return t; }
      } catch { }
    }
    try { var dt = scanTexto(document.title || "").trim(); if (dt) return dt; } catch { }
    try { return (location.pathname || "").split("/").filter(Boolean).pop() || location.hostname || ""; } catch { }
    return "";
  }
  // Títulos das REGIÕES da tela (ex.: "Região Sindical", "Adicional de Insalubridade") —
  // identidade compacta da tela p/ o RAG do tutorial achar a doc sem despejar todos os campos.
  function coletarTitulosRegioes() {
    var out = [], seen = {};
    function coletar(doc) {
      if (!doc) return;
      try {
        doc.querySelectorAll(".t-Region-title, .a-CollapsibleRegion-heading, .a-IRR-title, .a-CardView-title").forEach(function (h) {
          if (host && host.contains && host.contains(h)) return;
          if (h.getClientRects && h.getClientRects().length === 0) return; // região oculta/técnica
          var t = scanTexto(h.textContent || "").trim();
          if (!t || t.length > 80 || seen[t.toLowerCase()]) return;
          if (/^(itens|par[âa]metros|breadcrumb)$/i.test(t)) return;      // regiões internas/técnicas
          seen[t.toLowerCase()] = 1; out.push(t);
        });
      } catch (e) { }
      try { doc.querySelectorAll("iframe").forEach(function (f) { var d = null; try { d = f.contentDocument; } catch (e) { d = null; } if (d) coletar(d); }); } catch (e) { }
    }
    coletar(raizVarredura());
    return out.slice(0, 12);
  }
  function contextoRelatorio(flds, rv) {
    var programa = tituloPrincipalPagina();
    var filtros = [], vistos = {};
    function add(s) {
      var t = scanTexto(String(s == null ? "" : s)).trim();
      if (!t) return;
      var k = t.toLowerCase();
      if (vistos[k]) return;
      vistos[k] = 1; filtros.push(t);
    }
    // Campos de filtro PREENCHIDOS (rótulo + valor). Ignora botões e a barra do IR (vira chip).
    try {
      (flds || []).forEach(function (f) {
        if (!f || f.type === "botao" || f.type === "busca") return;
        var v = String(f.value == null ? "" : f.value).trim();
        var lab = String(f.label == null ? "" : f.label).trim();
        // Ignora item interno do APEX que porventura tenha escapado (rótulo = nome técnico).
        if (nomeInternoApex(lab)) return;
        if (v && lab) add(lab + ": " + v);
      });
    } catch { }
    // Chips do Interactive Report (label já vem "Coluna = valor"/texto; cobre filtro complexo).
    try { if (rv) rotulosFiltro(rv).forEach(add); } catch { }
    return { programa: programa, filtros: filtros };
  }
  function ehBuscaIR(el) {
    try {
      return /_search_field$/i.test(el.id || "") || /a-IRR-search-field/.test(typeof el.className === "string" ? el.className : "");
    } catch { return false; }
  }
  // Realça a barra de controles de filtro (deixa claro o que vai ser removido).
  function highlightFiltros(rv) {
    try {
      var reg = (rv && rv.closest && rv.closest(".a-IRR")) || rv;
      var ctrl = reg && reg.querySelector(".a-IRR-controls");
      if (ctrl) { highlightField(ctrl); setTimeout(function () { unhighlightField(ctrl); }, 1500); }
    } catch { }
  }
  // Clica cada botão "Remover Filtro" e espera o IR recarregar (a lista muda a cada um).
  async function limparFiltros(rv) {
    var cap = 25;
    while (cap-- > 0) {
      var botoes = filtrosAtivos(rv);
      if (!botoes.length) break;
      var antes = assinaturaPagina(rv);
      try { botoes[0].click(); } catch { break; }
      await esperarMudanca(rv, antes, 4000);
    }
  }
  // Aplica a busca pela barra do IR de forma determinística (após limpar o filtro, os
  // refs antigos ficam obsoletos com o recarregamento — por isso re-localizamos aqui).
  async function aplicarBuscaIR(rv, valor) {
    var reg = (rv && rv.closest && rv.closest(".a-IRR")) || rv;
    var campo = reg.querySelector(".a-IRR-search-field, input[id$='_search_field']");
    if (campo) { highlightField(campo); fillField(campo, valor); }
    var antes = assinaturaPagina(rv);
    var botao = reg.querySelector(".a-IRR-search-button, button[id$='_search_button']");
    if (botao) { try { botao.click(); } catch { } }
    else if (campo) { try { campo.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, which: 13, bubbles: true })); } catch { } }
    await esperarMudanca(rv, antes, 5000);
    if (campo) setTimeout(function () { unhighlightField(campo); }, 700);
  }
  // Card de confirmação: limpar o filtro atual antes da nova busca, ou manter (empilhar).
  function confirmarLimparFiltro(a, el, rv) {
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var rots = rotulosFiltro(rv);
    var card = document.createElement("div");
    card.style.cssText = "margin:6px 0 6px 40px;padding:10px 12px;border-radius:14px;max-width:88%;border:1px solid " + pc + "40;background:" + pc + "0d;";
    var head = document.createElement("div");
    head.style.cssText = "font-size:12.5px;font-weight:700;color:" + pc + ";margin-bottom:7px;";
    head.textContent = "Já há filtro no relatório" + (rots.length ? " (" + rots.join("; ") + ")" : "") + ". Limpar antes de pesquisar “" + (a.valor || "") + "”?";
    card.appendChild(head);
    var box = document.createElement("div");
    box.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
    var limpar = tutBtn("Limpar e pesquisar", true);
    var manter = tutBtn("Manter e pesquisar", false);
    highlightFiltros(rv);
    limpar.addEventListener("click", async function () {
      if (card.parentNode) card.remove();
      _filtroConfirmado = true;
      _acoes = []; // descarta a fila (fill + Ir): refazemos determinístico pós-recarga
      statusMsg("🧹 Limpando o filtro atual…", null);
      await limparFiltros(rv);
      statusMsg("✅ Filtro removido. Pesquisando: " + (a.valor || ""), "#15803d");
      await aplicarBuscaIR(rv, a.valor);
      registrarExec({ tipo: "fill", label: "Barra de pesquisa", valor: a.valor });
      aoTerminarAcoes();
    });
    manter.addEventListener("click", function () {
      if (card.parentNode) card.remove();
      _filtroConfirmado = true;
      execDireto(a, el); // segue normal (a fila prossegue com o clique "Ir")
    });
    box.appendChild(limpar); box.appendChild(manter);
    card.appendChild(box);
    messagesEl.appendChild(card);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  // Processa as ações da IA EM ORDEM. Preencher/marcar e cliques de VISUALIZAÇÃO
  // rodam direto; só cliques que GRAVAM/NAVEGAM pedem confirmação.
  function proximaAcao() {
    if (_picking) return;
    var a = _acoes.shift();
    if (!a) { aoTerminarAcoes(); return; } // fila vazia → decide se continua o loop
    var el = fieldEl(a.ref);
    if (a.tipo === "fill") {
      if (!el) { pickField(a); return; } // campo sumiu -> pede o clique
      // Nova busca pela barra do IR com filtro já ativo → confirma limpar antes.
      if (ehBuscaIR(el) && !_filtroConfirmado) {
        var rvIR = (el.closest && el.closest(".a-IRR")) || el;
        if (filtrosAtivos(rvIR).length) { confirmarLimparFiltro(a, el, rvIR); return; }
      }
      execDireto(a, el); return;
    }
    if (!el) { statusMsg("⚠️ Não encontrei “" + a.label + "” na tela.", "#b45309"); proximaAcao(); return; }
    if (a.tipo === "check" || ehVisualizacao(a.label, el)) { execDireto(a, el); return; }
    // GRAVA ou DESTRÓI (Criar/Salvar/Apply Changes/Excluir…) → modal na página com o
    // resumo dos dados. O cartão do chat é fácil demais de aceitar no automático.
    if (RX_COMMIT.test(a.label || "") || (el.type || "").toLowerCase() === "submit") { confirmarGravacao(a, el); return; }
    cardConfirmar(a, el); // demais cliques que navegam → confirmação simples
  }
  // Fila esvaziada: se a IA agiu, re-varre a tela e pede que ela dê o PRÓXIMO passo
  // (menus/janelas do APEX abrem em etapas), até concluir ou bater o teto.
  function aoTerminarAcoes() {
    if (_loopCancel || !_turnActed) return;      // usuário cancelou, ou a IA não agiu → fim
    if (_loopStep >= LOOP_CAP) {
      statusMsg("⏹️ Parei após " + LOOP_CAP + " passos. Se faltou algo, me diga como seguir.", "#6b7280");
      return;
    }
    _loopStep++;
    setBusyUI(true);        // botão vira "Parar" enquanto o loop autônomo roda
    // Espera o DOM assentar (hover-intent do submenu + animação de menu/janela do
    // APEX) antes de re-varrer, senão o item recém-revelado ainda não apareceu.
    setTimeout(function () { if (!_loopCancel) ask(undefined, undefined, { continuation: true, loopStep: true }); }, 550);
  }
  // ══ CONFIRMAÇÃO DE GRAVAÇÃO ═════════════════════════════════════════════════
  // Criar / Salvar / Apagar / Apply Changes gravam ou destroem dado. Um cartãozinho
  // no chat, fácil de aceitar no automático, é pouco para isso: aqui vai uma MODAL
  // sobre a página, com o RESUMO do que será gravado, para o usuário conferir antes.
  // "Novo"/"Nova" e "Aplicar" sozinhos ficam DE FORA: normalmente navegam (abrem um
  // formulário em branco) ou aplicam um FILTRO — resumir os dados da tela ali seria
  // ruído, e o resumo mostraria a tela ANTIGA. "Apply Changes" entra como frase.
  var RX_COMMIT = new RegExp(
    "\\b(" +
      "criar|cria|create|cadastrar|cadastra|incluir|inclui|adicionar|adiciona|inserir|insere|" +
      "salvar|salva|save|gravar|grava|guardar|" +
      "apply\\s*changes|aplicar\\s*(altera|mudan)|submeter|submete|submit|enviar|envia|" +
      "excluir|exclui|apagar|apaga|deletar|deleta|delete|remover|remove|" +
      "finalizar|finaliza|efetivar|efetiva|confirmar|confirma|processar|processa" +
    ")\\b", "i");

  /** A ação DESTRÓI dado? Muda o tom e o rótulo do botão da modal. */
  var RX_DESTRUTIVA = /\b(excluir|exclui|apagar|apaga|deletar|deleta|delete|remover|remove)\b/i;

  /**
   * RESUMO do que está preenchido na tela AGORA — "Rótulo: valor".
   *
   * Reusa o mesmo `scanFields` que já alimenta a IA, então enxerga exatamente os
   * campos que ela enxerga (inclusive popup LOV, que é readonly). Só campos com
   * valor: uma lista de 60 linhas vazias não ajuda ninguém a conferir.
   */
  function resumoCamposPreenchidos() {
    try {
      return (scanFields() || [])
        .filter(function (f) {
          if (!f || f.type === "botao") return false;
          var v = String(f.value == null ? "" : f.value).trim();
          if (!v) return false;
          if (f.type === "checkbox" || f.type === "radio") return v !== "false" && v !== "0";
          return true;
        })
        .map(function (f) { return { label: f.label || "(sem rótulo)", valor: String(f.value).slice(0, 200) }; });
    } catch { return []; }
  }

  /**
   * Modal de confirmação com o resumo. `onDecisao(true)` = prosseguir.
   *
   * A modal vive no shadow root (como as outras do widget), então o CSS do sistema
   * não a alcança nem vice-versa, e ela fica acima de qualquer coisa do APEX.
   */
  function modalConfirmarGravacao(a, itens, onDecisao) {
    var destrutiva = RX_DESTRUTIVA.test(a.label || "");
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var acento = destrutiva ? "#b42318" : pc;
    var m = widgetModal((destrutiva ? "Confirmar exclusão" : "Confirmar antes de gravar"), { wide: true });
    var decidido = false;
    function decidir(ok) {
      if (decidido) return;
      decidido = true;
      m.fechar();
      onDecisao(ok);
    }

    var intro = document.createElement("div");
    intro.style.cssText = "font-size:13.5px;color:#333;line-height:1.5;margin-bottom:10px;";
    intro.textContent = destrutiva
      ? "Vou clicar em “" + a.label + "”. Esta ação REMOVE dados e normalmente não pode ser desfeita. Confira antes de prosseguir:"
      : "Vou clicar em “" + a.label + "”. Confira os dados que serão gravados:";
    m.body.appendChild(intro);

    if (itens.length) {
      var lista = document.createElement("div");
      // Região de scroll: um formulário do APEX pode ter dezenas de campos.
      lista.style.cssText =
        "max-height:46vh;overflow-y:auto;overscroll-behavior:contain;border:1px solid #e9e6f0;border-radius:12px;" +
        "background:#faf9fc;padding:4px 0;";
      itens.forEach(function (it, i) {
        var linha = document.createElement("div");
        linha.style.cssText =
          "display:flex;gap:10px;align-items:baseline;padding:7px 12px;font-size:13px;" +
          (i ? "border-top:1px solid #efecf5;" : "");
        var lb = document.createElement("span");
        lb.style.cssText = "flex:0 0 40%;min-width:0;color:#6b6577;font-weight:600;word-break:break-word;";
        lb.textContent = it.label;
        var vl = document.createElement("span");
        vl.style.cssText = "flex:1;min-width:0;color:#1a1a1f;word-break:break-word;white-space:pre-wrap;";
        vl.textContent = it.valor;
        linha.appendChild(lb); linha.appendChild(vl);
        lista.appendChild(linha);
      });
      m.body.appendChild(lista);
      var cont = document.createElement("div");
      cont.style.cssText = "font-size:11.5px;color:#8a8496;margin-top:7px;";
      cont.textContent = itens.length + " campo(s) preenchido(s) na tela.";
      m.body.appendChild(cont);
    } else {
      // Sem campo preenchido não há o que resumir — e o silêncio seria pior: diz isso.
      var vazio = document.createElement("div");
      vazio.style.cssText = "font-size:13px;color:#8a8496;border:1px dashed #ddd8e6;border-radius:12px;padding:12px;background:#faf9fc;";
      vazio.textContent = "Não há campos preenchidos nesta tela para eu resumir. Confira a tela antes de confirmar.";
      m.body.appendChild(vazio);
    }

    var acts = document.createElement("div");
    acts.style.cssText = "display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap;";
    function botao(txt, primario) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = txt;
      b.style.cssText =
        "font-size:13px;font-weight:700;padding:9px 16px;border-radius:11px;cursor:pointer;min-height:40px;" +
        (primario
          ? "background:" + acento + ";color:#fff;border:1px solid " + acento + ";"
          : "background:#fff;color:#555;border:1px solid #ddd8e6;");
      return b;
    }
    var nao = botao("Cancelar", false);
    var sim = botao(destrutiva ? "Excluir mesmo assim" : "Confirmar e " + (a.label || "gravar"), true);
    nao.addEventListener("click", function () { decidir(false); });
    sim.addEventListener("click", function () { decidir(true); });
    acts.appendChild(nao); acts.appendChild(sim);
    m.body.appendChild(acts);
    try { nao.focus(); } catch { } // foco no seguro, não no que grava
    // Fechar pelo × ou pelo fundo = NÃO prosseguir.
    m.ov.addEventListener("click", function (e) { if (e.target === m.ov) decidir(false); });
    var obs = null;
    try {
      obs = new MutationObserver(function () {
        if (!m.ov.isConnected && !decidido) { obs.disconnect(); decidir(false); }
      });
      obs.observe((messagesEl.getRootNode && messagesEl.getRootNode()) || document.body, { childList: true });
    } catch { }
  }

  /** Ponte entre a fila de ações e a modal — mantém o fluxo do `proximaAcao`. */
  function confirmarGravacao(a, el) {
    highlightField(el);
    modalConfirmarGravacao(a, resumoCamposPreenchidos(), function (ok) {
      unhighlightField(el);
      if (!ok) {
        _loopCancel = true; // cancelar interrompe o loop autônomo
        statusMsg("Cancelado: “" + a.label + "”", "#6b7280");
        _execLabels.push("o usuário CANCELOU “" + a.label + "” na confirmação");
        proximaAcao();
        return;
      }
      var okClique = clickElement(el);
      if (okClique) { registrarExec(a); statusMsg("✅ Cliquei em “" + a.label + "”", "#15803d"); }
      else statusMsg("⚠️ Não consegui clicar em “" + a.label + "”", "#b45309");
      proximaAcao();
    });
  }

  // Card compacto que se ATUALIZA no lugar (título + valor + ações). Confirma
  // preenchimentos, marcações e cliques que gravam/navegam. Evita poluir o chat.
  function cardConfirmar(a, el) {
    highlightField(el);
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var trecho = a.tipo === "fill" ? (a.valor.length > 220 ? a.valor.slice(0, 220) + "…" : a.valor) : "";
    var titulo =
      a.tipo === "fill" ? "Preencher “" + a.label + "”"
        : a.tipo === "check" ? (a.marcar ? "Marcar “" : "Desmarcar “") + a.label + "”"
          : "Clicar em “" + a.label + "”";
    var okTxt =
      a.tipo === "fill" ? "✅ Preenchido: “" + a.label + "”"
        : a.tipo === "check" ? (a.marcar ? "✅ Marcado: “" : "✅ Desmarcado: “") + a.label + "”"
          : "✅ Cliquei em “" + a.label + "”";
    var falhaTxt =
      a.tipo === "fill" ? "⚠️ Não consegui preencher “" + a.label + "”"
        : a.tipo === "check" ? "⚠️ Não consegui alterar “" + a.label + "”"
          : "⚠️ Não consegui clicar em “" + a.label + "”";
    var acaoTxt = a.tipo === "fill" ? "Preencher" : a.tipo === "check" ? (a.marcar ? "Marcar" : "Desmarcar") : "Clicar";
    var card = document.createElement("div");
    card.style.cssText =
      "margin:6px 0 6px 40px;padding:10px 12px;border-radius:14px;max-width:88%;" +
      "border:1px solid " + pc + "40;background:" + pc + "0d;";
    var head = document.createElement("div");
    head.style.cssText = "font-size:12.5px;font-weight:700;color:" + pc + ";margin-bottom:" + (trecho ? "5px" : "8px") + ";";
    head.textContent = titulo;
    card.appendChild(head);
    var val = null;
    if (trecho) {
      val = document.createElement("div");
      val.style.cssText = "font-size:13px;color:#333;white-space:pre-wrap;word-break:break-word;max-height:120px;overflow:auto;margin-bottom:8px;";
      val.textContent = trecho;
      card.appendChild(val);
    }
    var acts = document.createElement("div");
    acts.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;";
    function botao(txt, primario) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = txt;
      b.style.cssText = "font-size:12px;font-weight:600;padding:5px 12px;border-radius:9px;cursor:pointer;border:1px solid " + pc + "44;" +
        (primario ? "background:" + pc + ";color:#fff;border-color:" + pc + ";" : "background:transparent;color:" + pc + ";");
      return b;
    }
    function encerrar(txt, cor) {
      acts.remove(); if (val) val.remove();
      head.style.color = cor; head.style.marginBottom = "0"; head.textContent = txt;
      proximaAcao();
    }
    var sim = botao(acaoTxt, true);
    var nao = botao(a.tipo === "fill" ? "Escolher outro campo" : "Cancelar", false);
    sim.addEventListener("click", function () {
      unhighlightField(el);
      // Popup LOV também aqui: o caminho com confirmação usa a MESMA sequência
      // assíncrona (abrir → pesquisar → esperar → escolher).
      var passo = a.tipo === "fill" && ehPopupLov(el)
        ? preencherPopupLov(el, a.valor)
        : Promise.resolve({
            ok: a.tipo === "fill" ? fillField(el, a.valor, a.valores) : a.tipo === "check" ? checkOption(el, a.marcar) : clickElement(el),
          });
      passo.then(function (r) {
        var ok = !!(r && r.ok);
        if (ok) registrarExec(a);
        else if (r && r.motivo) {
          _turnActed = true;
          _execLabels.push("NÃO conseguiu preencher “" + a.label + "” — " + r.motivo +
            (r.candidatos && r.candidatos.length ? ". Opções: " + r.candidatos.join(" · ") : ""));
        }
        encerrar(ok ? okTxt : falhaTxt + (r && r.motivo ? " — " + r.motivo : ""), ok ? "#15803d" : "#b45309");
      });
    });
    nao.addEventListener("click", function () {
      unhighlightField(el);
      _loopCancel = true; // cancelar interrompe o loop autônomo
      if (a.tipo === "fill") { card.remove(); pickField(a); return; }
      encerrar("Cancelado: “" + a.label + "”", "#6b7280");
    });
    acts.appendChild(sim); acts.appendChild(nao);
    card.appendChild(acts);
    messagesEl.appendChild(card); messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  function pickField(a) {
    addMsg("assistant", "Clique no campo da tela onde você quer que eu escreva.");
    var timer = null;
    function onClick(e) {
      var el = e.target && e.target.closest ? e.target.closest("input,textarea,select,[contenteditable]") : null;
      if (!el) return;                       // clicou fora de um campo -> segue esperando
      if (host && host.contains && host.contains(el)) return; // ignora o próprio widget
      cleanup();
      fillField(el, a.valor, a.valores);
      addMsg("assistant", "Pronto ✅ Escrevi no campo que você escolheu.");
      proximaAcao();
    }
    function cleanup() { _picking = null; document.removeEventListener("click", onClick, true); if (timer) clearTimeout(timer); }
    _picking = { cancel: cleanup };
    document.addEventListener("click", onClick, true);
    timer = setTimeout(function () { if (_picking) { cleanup(); addMsg("assistant", "Cancelei o preenchimento — é só pedir de novo."); proximaAcao(); } }, 30000);
  }

  // ==== Gráficos (montar_grafico): card interativo — trocar tipo + exportar ====
  var _charts = []; // specs recebidas NESTE turno (guard de stream vazio)
  var CHART_PAL = ["#511C76", "#C95788", "#2C1A63", "#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#0EA5E9", "#EC4899"];
  var CHART_TIPOS = [
    ["colunas", "Colunas"], ["colunas_emp", "Colunas empilhadas"], ["barras", "Barras"], ["barras_emp", "Barras empilhadas"],
    ["linha", "Linha"], ["area", "Área"], ["area_emp", "Área empilhada"], ["combo", "Combo (colunas + linha)"],
    ["pizza", "Pizza"], ["rosca", "Rosca"], ["radar", "Radar / Teia"],
    ["dispersao", "Dispersão"], ["bolha", "Bolha"], ["heatmap", "Mapa de calor"], ["candle", "Candle (OHLC)"],
  ];
  // JANELA de categorias (scroll/zoom): os tipos com eixo X de categorias mostram só uma
  // FAIXA [i0,i1) por vez (guardada em canvas._view) — assim 2000 pontos ficam navegáveis
  // e o eixo/legenda ficam fixos. scroll = mover a janela; zoom = encolher a janela.
  function chartWindowable(tipo) {
    return tipo === "colunas" || tipo === "barras" || tipo === "linha" || tipo === "area" ||
      tipo === "colunas_emp" || tipo === "barras_emp" || tipo === "area_emp" || tipo === "combo" ||
      tipo === "heatmap" || tipo === "candle";
  }
  function chartView(canvas, n) {
    var v = canvas && canvas._view;
    if (!v || v.i0 == null) return { i0: 0, i1: n };
    var i0 = Math.max(0, Math.min(v.i0 | 0, n - 1));
    var i1 = Math.max(i0 + 1, Math.min(v.i1 | 0, n));
    return { i0: i0, i1: i1 };
  }

  function kbChartBtn(txt, pc, fn) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = txt;
    b.style.cssText =
      "font-size:12px;font-weight:600;padding:5px 10px;border-radius:9px;cursor:pointer;white-space:nowrap;" +
      "border:1px solid " + pc + "44;background:" + pc + "14;color:" + pc + ";";
    b.addEventListener("click", fn);
    return b;
  }
  function kbBaixar(nome, href) {
    var a = document.createElement("a");
    a.href = href; a.download = nome; a.rel = "noopener";
    (document.body || document.documentElement).appendChild(a);
    a.click();
    setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 0);
  }
  function kbFmt(v) {
    var a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(1).replace(".", ",") + "M";
    if (a >= 1e3) return (v / 1e3).toFixed(1).replace(".", ",") + "k";
    return String(Math.round(v * 100) / 100).replace(".", ",");
  }
  function kbTrunc(ctx, txt, maxW) {
    txt = String(txt == null ? "" : txt);
    if (ctx.measureText(txt).width <= maxW) return txt;
    while (txt.length > 1 && ctx.measureText(txt + "…").width > maxW) txt = txt.slice(0, -1);
    return txt + "…";
  }
  function kbNum(v) {
    try { return Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 }); } catch { return String(v); }
  }
  function kbMediana(arr) {
    var xs = arr.filter(function (n) { return isFinite(n); }).sort(function (a, b) { return a - b; });
    if (!xs.length) return null;
    var m = Math.floor(xs.length / 2);
    return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
  }
  function kbReg(ys) {
    var n = ys.length; if (n < 2) return null;
    var sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (var i = 0; i < n; i++) { var y = ys[i] || 0; sx += i; sy += y; sxy += i * y; sxx += i * i; }
    var den = n * sxx - sx * sx; if (den === 0) return null;
    var b = (n * sxy - sx * sy) / den;
    return { a: (sy - b * sx) / n, b: b };
  }
  // Testa o ponteiro contra as "hit regions" registradas pelo desenho (retângulos
  // e fatias de pizza). Devolve a região sob o cursor (com .html do tooltip).
  function kbHitTest(hits, px, py) {
    if (!hits) return null;
    for (var i = 0; i < hits.length; i++) {
      var r = hits[i];
      if (r.pie) {
        var dx = px - r.pie.cx, dy = py - r.pie.cy, d = Math.sqrt(dx * dx + dy * dy);
        if (d >= r.pie.ri && d <= r.pie.ro) {
          var two = Math.PI * 2;
          var aa = ((Math.atan2(dy, dx) - r.pie.a0) % two + two) % two;
          var sp = ((r.pie.a1 - r.pie.a0) % two + two) % two;
          if (aa <= sp) return r;
        }
      } else if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
        return r;
      }
    }
    return null;
  }
  // Liga o tooltip de hover a um canvas de gráfico (lê canvas._hits do último draw).
  function attachChartHover(canvas, wrap) {
    var tip = document.createElement("div");
    tip.style.cssText =
      "position:absolute;pointer-events:none;z-index:6;display:none;background:#17171a;color:#fff;" +
      "font-size:11px;line-height:1.4;padding:6px 8px;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.28);max-width:240px;";
    wrap.appendChild(tip);
    canvas.addEventListener("mousemove", function (e) {
      if (canvas._dragging) { tip.style.display = "none"; return; } // durante o arraste de zoom, sem tooltip
      var rect = canvas.getBoundingClientRect();
      var hit = kbHitTest(canvas._hits, e.clientX - rect.left, e.clientY - rect.top);
      if (!hit) { tip.style.display = "none"; canvas.style.cursor = ""; return; }
      tip.innerHTML = hit.html;
      tip.style.display = "block";
      canvas.style.cursor = "pointer";
      var px = e.clientX - rect.left, py = e.clientY - rect.top;
      var left = px + 12, top = py - tip.offsetHeight - 8;
      if (left + tip.offsetWidth > wrap.clientWidth) left = px - tip.offsetWidth - 12;
      if (left < 0) left = 2;
      if (top < 0) top = py + 16;
      tip.style.left = left + "px";
      tip.style.top = top + "px";
    });
    canvas.addEventListener("mouseleave", function () { tip.style.display = "none"; canvas.style.cursor = ""; });
  }
  // Lê o contexto do gráfico (programa + filtros) do spec, normalizado. `null` se vazio.
  function lerContextoChart(spec) {
    var ctx = spec && spec.contexto;
    if (!ctx || typeof ctx !== "object") return null;
    var programa = String(ctx.programa == null ? "" : ctx.programa).trim();
    var filtros = Array.isArray(ctx.filtros)
      ? ctx.filtros.map(function (x) { return String(x == null ? "" : x).trim(); }).filter(Boolean)
      : [];
    if (!programa && !filtros.length) return null;
    return { programa: programa, filtros: filtros };
  }
  // Legenda de contexto (programa + filtros aplicados) — sutil mas visível. Aparece no
  // card, na modal ampliada e acompanha o gráfico salvo (spec.contexto). `null` se vazio.
  function kbChartCaption(spec) {
    var ctx = lerContextoChart(spec);
    if (!ctx) return null;
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var box = document.createElement("div");
    box.style.cssText = "font-size:11px;line-height:1.55;color:#4a4a52;background:" + pc + "0d;border:1px solid " + pc + "26;border-left:3px solid " + pc + ";border-radius:8px;padding:6px 10px;margin-bottom:8px;word-break:break-word;";
    if (ctx.programa) {
      var p = document.createElement("div");
      var pl = document.createElement("strong"); pl.textContent = "Programa: "; pl.style.color = pc;
      p.appendChild(pl); p.appendChild(document.createTextNode(ctx.programa));
      box.appendChild(p);
    }
    if (ctx.filtros.length) {
      var f = document.createElement("div"); f.style.marginTop = ctx.programa ? "2px" : "0";
      var fl = document.createElement("strong"); fl.textContent = "Filtros: "; fl.style.color = pc;
      f.appendChild(fl); f.appendChild(document.createTextNode(ctx.filtros.join(" · ")));
      box.appendChild(f);
    }
    return box;
  }
  function kbChartCsv(spec) {
    // Separador SEMPRE ";" (padrão pt-BR / Excel local).
    function cell(v) { v = String(v); return /[";\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    var head = ["Categoria"].concat(spec.series.map(function (s) { return s.nome; }));
    var linhas = spec.categorias.map(function (c, r) {
      return [c].concat(spec.series.map(function (s) { return s.valores[r] == null ? "" : s.valores[r]; }));
    });
    // Prefixo com o contexto (programa + filtros) — o CSV do gráfico também carrega a origem.
    var pref = "sep=;\r\n";
    var ctx = lerContextoChart(spec);
    if (ctx) {
      if (ctx.programa) pref += cell("Programa: " + ctx.programa) + "\r\n";
      if (ctx.filtros.length) pref += cell("Filtros: " + ctx.filtros.join("; ")) + "\r\n";
      pref += "\r\n";
    }
    return pref + [head].concat(linhas).map(function (cols) { return cols.map(cell).join(";"); }).join("\r\n");
  }

  // Tabela dos dados do gráfico (aba "Tabela"): categorias × séries + linha de total.
  function kbChartTable(spec, pc) {
    var wrap = document.createElement("div");
    wrap.style.cssText = "overflow:auto;max-height:300px;margin-top:2px;";
    var t = document.createElement("table");
    t.style.cssText = "border-collapse:collapse;width:100%;font-size:12px;color:#1a1a1a;";
    var cols = ["Categoria"].concat(spec.series.map(function (s) { return s.nome; }));
    var thr = document.createElement("tr");
    cols.forEach(function (c, i) {
      var th = document.createElement("th");
      th.textContent = c;
      th.style.cssText = "position:sticky;top:0;text-align:" + (i ? "right" : "left") + ";padding:7px 9px;background:" + pc + ";color:#fff;font-weight:600;white-space:nowrap;";
      thr.appendChild(th);
    });
    var thead = document.createElement("thead"); thead.appendChild(thr); t.appendChild(thead);
    var tb = document.createElement("tbody");
    spec.categorias.forEach(function (cat, r) {
      var tr = document.createElement("tr");
      if (r % 2) tr.style.background = "rgba(0,0,0,.035)";
      var td0 = document.createElement("td"); td0.textContent = cat;
      td0.style.cssText = "text-align:left;padding:6px 9px;border-bottom:1px solid rgba(0,0,0,.08);white-space:nowrap;";
      tr.appendChild(td0);
      spec.series.forEach(function (s) {
        var td = document.createElement("td");
        td.textContent = kbNum(s.valores[r] == null ? 0 : s.valores[r]);
        td.style.cssText = "text-align:right;padding:6px 9px;border-bottom:1px solid rgba(0,0,0,.08);white-space:nowrap;font-variant-numeric:tabular-nums;";
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    var trt = document.createElement("tr");
    var tdt = document.createElement("td"); tdt.textContent = "Total";
    tdt.style.cssText = "text-align:left;padding:7px 9px;font-weight:700;border-top:2px solid rgba(0,0,0,.14);";
    trt.appendChild(tdt);
    spec.series.forEach(function (s) {
      var tot = s.valores.reduce(function (a, b) { return a + (b || 0); }, 0);
      var td = document.createElement("td"); td.textContent = kbNum(tot);
      td.style.cssText = "text-align:right;padding:7px 9px;font-weight:700;border-top:2px solid rgba(0,0,0,.14);font-variant-numeric:tabular-nums;";
      trt.appendChild(td);
    });
    tb.appendChild(trt); t.appendChild(tb); wrap.appendChild(t);
    return wrap;
  }
  function kbTab(txt) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = txt;
    b.style.cssText = "font-size:12px;font-weight:600;padding:4px 11px;border-radius:8px;cursor:pointer;border:1px solid transparent;background:transparent;";
    return b;
  }
  function kbTabState(btn, active, pc) {
    btn.style.background = active ? pc + "14" : "transparent";
    btn.style.color = active ? pc : "#6b6b72";
    btn.style.borderColor = active ? pc + "40" : "transparent";
  }

  // Link de download de arquivo (holerite, relatório PDF…) — live (dataURL) ou
  // do histórico (URL assinada). `target=_blank` cobre URL assinada cross-origin.
  function appendFileLink(href, filename) {
    if (!href) return null;
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var rowf = document.createElement("div");
    rowf.style.cssText = "display:flex;align-items:center;gap:6px;margin:4px 0 4px 40px;max-width:88%;flex-wrap:wrap;";
    var fa = document.createElement("a");
    fa.href = href;
    fa.download = filename || "arquivo";
    fa.rel = "noopener";
    fa.target = "_blank";
    fa.textContent = "📎 " + (filename || "arquivo");
    fa.style.cssText =
      "display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:12px;border:1px solid rgba(0,0,0,.12);background:#fff;color:#111;text-decoration:none;font-size:13px;font-weight:600;";
    rowf.appendChild(fa);
    // Botão salvar em "Meus relatórios".
    var save = document.createElement("button");
    save.type = "button"; save.title = "Salvar em Meus relatórios"; save.setAttribute("aria-label", "Salvar");
    save.innerHTML = ICON_SAVEREP;
    save.style.cssText = "display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9px;border:1px solid rgba(0,0,0,.12);background:#fff;color:" + pc + ";cursor:pointer;flex:none;";
    var sv = save.querySelector("svg"); if (sv) { sv.setAttribute("width", "15"); sv.setAttribute("height", "15"); }
    save.addEventListener("click", function () { salvarArquivo(href, filename); });
    rowf.appendChild(save);
    messagesEl.appendChild(rowf);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return rowf;
  }
  // Reexibe a mídia persistida do assistente ao recarregar o histórico.
  function renderMedia(media) {
    if (!media || !media.length) return;
    media.forEach(function (it) {
      if (it && it.kind === "chart" && it.spec) renderChart(it.spec);
      else if (it && it.kind === "file" && it.url) appendFileLink(it.url, it.filename);
    });
  }

  function renderChart(spec) {
    _charts.push(spec);
    var built = construirCardGrafico(spec, { salvar: true });
    messagesEl.appendChild(built.card);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  // Constrói o card interativo do gráfico (idêntico ao do chat). opts: { salvar, emModal }.
  // Navegação de MUITOS pontos (scroll + zoom por JANELA de categorias). Devolve a barra
  // (minimapa) ou null quando não faz sentido (tipo sem eixo de categorias, ou ≤40 pontos).
  // Minimapa: arrastar o miolo = mover a janela (scroll); arrastar numa área vazia = marcar
  // uma FAIXA (zoom); "Tudo" = ver o intervalo inteiro. Opera por ÍNDICE (serve a todos os
  // tipos com eixo de categorias, sem depender da geometria do desenho).
  function attachChartNav(canvas, spec, redraw) {
    if (canvas._navCleanup) { canvas._navCleanup(); canvas._navCleanup = null; }
    var n = (spec.categorias || []).length;
    var v0 = canvas._view;
    var cheia = !v0 || (v0.i0 <= 0 && v0.i1 >= n);
    // Aparece com muitos pontos OU quando o gráfico está com ZOOM (janela parcial) — aí o
    // botão "Tudo" é a forma de VOLTAR ao gráfico inteiro.
    if (!chartWindowable(spec.tipo) || (n <= 40 && cheia)) { if (cheia) canvas._view = null; return null; }
    if (!canvas._view) canvas._view = { i0: 0, i1: Math.min(40, n) };
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;align-items:center;gap:6px;margin-top:6px;";
    var strip = document.createElement("div");
    strip.style.cssText = "position:relative;flex:1;height:22px;background:" + pc + "10;border:1px solid " + pc + "26;border-radius:6px;cursor:crosshair;overflow:hidden;touch-action:none;";
    var thumb = document.createElement("div");
    thumb.style.cssText = "position:absolute;top:0;bottom:0;background:" + pc + "40;cursor:grab;";
    strip.appendChild(thumb);
    var info = document.createElement("span");
    info.style.cssText = "font-size:10px;color:#8a8a92;white-space:nowrap;min-width:88px;text-align:right;font-variant-numeric:tabular-nums;";
    function sync() { var v = canvas._view; thumb.style.left = (v.i0 / n * 100) + "%"; thumb.style.width = Math.max(2, (v.i1 - v.i0) / n * 100) + "%"; info.textContent = (v.i0 + 1) + "–" + v.i1 + " de " + n; }
    function setView(i0, i1) { i0 = Math.max(0, Math.round(i0)); i1 = Math.min(n, Math.round(i1)); if (i1 - i0 < 2) i1 = Math.min(n, i0 + 2); canvas._view = { i0: i0, i1: i1 }; sync(); redraw(); }
    function idxAt(clientX) { var r = strip.getBoundingClientRect(); return Math.max(0, Math.min(n, (clientX - r.left) / (r.width || 1) * n)); }
    var mode = null, start = 0, sv = null;
    strip.addEventListener("mousedown", function (e) {
      var r = strip.getBoundingClientRect(), px = e.clientX - r.left, tx0 = canvas._view.i0 / n * r.width, tx1 = canvas._view.i1 / n * r.width;
      start = idxAt(e.clientX);
      if (px >= tx0 - 4 && px <= tx1 + 4) { mode = "pan"; sv = { i0: canvas._view.i0, i1: canvas._view.i1 }; thumb.style.cursor = "grabbing"; } else { mode = "sel"; }
      e.preventDefault();
    });
    function move(e) { if (!mode) return; var cur = idxAt(e.clientX); if (mode === "pan") { var d = cur - start, len = sv.i1 - sv.i0, ni0 = Math.max(0, Math.min(n - len, sv.i0 + d)); setView(ni0, ni0 + len); } else { setView(Math.min(start, cur), Math.max(start, cur)); } }
    function up() { mode = null; thumb.style.cursor = "grab"; }
    document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
    canvas._navCleanup = function () { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
    var btnTudo = kbChartBtn("⤢ Tudo", pc, function () { setView(0, n); }); btnTudo.title = "Ver todos os pontos";
    wrap.appendChild(strip); wrap.appendChild(info); wrap.appendChild(btnTudo);
    sync();
    return wrap;
  }
  // Zoom por SELEÇÃO NO próprio gráfico: arrasta uma faixa no eixo de categorias e amplia só
  // aquele trecho. Usa a geometria (canvas._geom) do último desenho — funciona em qualquer
  // gráfico com eixo de categorias, inclusive os pequenos (≤40). `afterZoom` redesenha + mostra
  // o minimapa (com "Tudo" para voltar). Só os tipos com _geom (colunas/barras/linha/área/combo).
  function attachChartZoom(canvas, cwrap, afterZoom) {
    if (canvas._zoomCleanup) canvas._zoomCleanup();
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var sel = document.createElement("div");
    sel.style.cssText = "position:absolute;display:none;background:" + pc + "26;border:1px solid " + pc + ";pointer-events:none;z-index:5;border-radius:2px;";
    cwrap.appendChild(sel);
    var dragging = false, startPos = 0, geom = null;
    function pos(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function down(e) {
      geom = canvas._geom; if (!geom) return;
      var p = pos(e), v = geom.vert ? p.y : p.x, lo = geom.a, hi = geom.a + geom.len;
      if (v < lo - 2 || v > hi + 2) return;
      dragging = true; canvas._dragging = true; startPos = Math.max(lo, Math.min(hi, v)); sel.style.display = "block";
      if (geom.vert) { sel.style.left = geom.x + "px"; sel.style.width = geom.wpx + "px"; sel.style.top = startPos + "px"; sel.style.height = "0px"; }
      else { sel.style.top = geom.y + "px"; sel.style.height = geom.hpx + "px"; sel.style.left = startPos + "px"; sel.style.width = "0px"; }
      e.preventDefault();
    }
    function mv(e) {
      if (!dragging || !geom) return;
      var p = pos(e), v = Math.max(geom.a, Math.min(geom.a + geom.len, geom.vert ? p.y : p.x)), a = Math.min(startPos, v), b = Math.max(startPos, v);
      if (geom.vert) { sel.style.top = a + "px"; sel.style.height = (b - a) + "px"; } else { sel.style.left = a + "px"; sel.style.width = (b - a) + "px"; }
    }
    function idxOf(px) { return geom.i0 + ((px - geom.a) / (geom.len || 1)) * (geom.i1 - geom.i0); }
    function up(e) {
      if (!dragging) return;
      dragging = false; canvas._dragging = false; sel.style.display = "none"; if (!geom) return;
      var p = pos(e), v = Math.max(geom.a, Math.min(geom.a + geom.len, geom.vert ? p.y : p.x));
      if (Math.abs(v - startPos) < 8) return; // clique/arraste minúsculo → não é seleção
      var ni0 = Math.floor(Math.min(idxOf(startPos), idxOf(v))), ni1 = Math.ceil(Math.max(idxOf(startPos), idxOf(v)));
      if (ni1 - ni0 >= 1 && ni1 - ni0 < geom.i1 - geom.i0) {
        canvas._view = { i0: Math.max(0, ni0), i1: Math.min(canvas._ncats || ni1, ni1) };
        if (afterZoom) afterZoom();
      }
    }
    canvas.addEventListener("mousedown", down);
    document.addEventListener("mousemove", mv); document.addEventListener("mouseup", up);
    canvas._zoomCleanup = function () { canvas.removeEventListener("mousedown", down); document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up); try { sel.remove(); } catch (e) { } };
  }
  function construirCardGrafico(spec, opts) {
    opts = opts || {};
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var card = document.createElement("div");
    card.style.cssText = opts.emModal
      ? "padding:0;background:transparent;"
      : "margin:6px 0 6px 40px;padding:12px;border-radius:14px;max-width:88%;border:1px solid rgba(0,0,0,.10);background:#ffffff;";
    // Cabeçalho: título + abas Gráfico / Tabela.
    var head = document.createElement("div");
    head.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:8px;";
    if (spec.titulo && !opts.emModal) {
      var h = document.createElement("div");
      h.textContent = spec.titulo;
      h.style.cssText = "font-size:13px;font-weight:700;color:#17171a;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
      head.appendChild(h);
    } else {
      var sp0 = document.createElement("span"); sp0.style.cssText = "flex:1;"; head.appendChild(sp0);
    }
    var tabs = document.createElement("div"); tabs.style.cssText = "display:flex;gap:4px;";
    var tabG = kbTab("Gráfico"), tabT = kbTab("Tabela");
    tabs.appendChild(tabG); tabs.appendChild(tabT); head.appendChild(tabs);
    card.appendChild(head);
    // Legenda de contexto (programa + filtros) — visível nas duas abas.
    var capCard = kbChartCaption(spec); if (capCard) card.appendChild(capCard);
    // Conteúdo: gráfico (canvas) e tabela.
    var cwrap = document.createElement("div");
    cwrap.style.cssText = "position:relative;";
    var canvas = document.createElement("canvas");
    canvas.style.cssText = "width:100%;height:" + (opts.emModal ? "300px" : "240px") + ";display:block;";
    cwrap.appendChild(canvas);
    card.appendChild(cwrap);
    attachChartHover(canvas, cwrap);
    // Minimapa de navegação (scroll/zoom) — só aparece com muitos pontos OU com zoom ativo.
    var navBox = document.createElement("div"); card.appendChild(navBox);
    function redrawCard() { drawChart(canvas, spec); }
    function refreshNav() { navBox.innerHTML = ""; var wnav = attachChartNav(canvas, spec, redrawCard); if (wnav) navBox.appendChild(wnav); }
    // Zoom arrastando NO gráfico → redesenha e mostra o minimapa (com "Tudo" para voltar).
    attachChartZoom(canvas, cwrap, function () { drawChart(canvas, spec); refreshNav(); });
    var twrap = kbChartTable(spec, pc);
    twrap.style.display = "none";
    card.appendChild(twrap);
    // Barra de ações.
    var bar = document.createElement("div");
    bar.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:10px;";
    var sel = document.createElement("select");
    sel.setAttribute("aria-label", "Tipo do gráfico");
    sel.style.cssText =
      "font-size:12px;padding:5px 8px;border-radius:9px;cursor:pointer;" +
      "border:1px solid rgba(0,0,0,.15);background:#fff;color:#222;";
    CHART_TIPOS.forEach(function (t) {
      var o = document.createElement("option");
      o.value = t[0]; o.textContent = t[1];
      if (t[0] === spec.tipo) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () { spec.tipo = sel.value; canvas._view = null; drawChart(canvas, spec); refreshNav(); });
    var espaco = document.createElement("span"); espaco.style.cssText = "flex:1;";
    var abaTabela = false; // aba atual do card (false=Gráfico, true=Tabela) — p/ o Ampliar
    var amp = kbChartBtn("⤢ Ampliar", pc, function () { abrirModalGrafico(spec, canvas, abaTabela); });
    amp.title = "Ampliar no centro da tela";
    var png = kbChartBtn("⬇ PNG", pc, function () {
      try { kbBaixar((spec.titulo || "grafico") + ".png", canvas.toDataURL("image/png")); } catch { }
    });
    bar.appendChild(sel);
    bar.appendChild(espaco);
    bar.appendChild(amp);
    bar.appendChild(kbChartBtn("⬇ CSV", pc, function () {
      kbBaixar((spec.titulo || "grafico") + ".csv", "data:text/csv;charset=utf-8," + encodeURIComponent("﻿" + kbChartCsv(spec)));
    }));
    bar.appendChild(png);
    if (opts.salvar) bar.appendChild(kbChartBtn("💾 Salvar", pc, function () { salvarGrafico(spec); }));
    card.appendChild(bar);
    // Alternância de abas (esconde os controles só-do-gráfico na aba Tabela).
    function setTab(g) {
      abaTabela = !g;
      cwrap.style.display = g ? "" : "none";
      navBox.style.display = g ? "" : "none";
      twrap.style.display = g ? "none" : "";
      sel.style.display = g ? "" : "none";
      png.style.display = g ? "" : "none";
      // "Ampliar" fica visível nas DUAS abas (expandir também no modo Tabela).
      kbTabState(tabG, g, pc); kbTabState(tabT, !g, pc);
      if (g) drawChart(canvas, spec);
    }
    tabG.addEventListener("click", function () { setTab(true); });
    tabT.addEventListener("click", function () { setTab(false); });
    kbTabState(tabG, true, pc); kbTabState(tabT, false, pc);
    refreshNav();
    requestAnimationFrame(function () { drawChart(canvas, spec); });
    // Redesenha ao mudar a LARGURA (expandir o painel, resize): o canvas tem
    // largura em % e, sem redesenhar, o buffer antigo estica e deforma as labels.
    try {
      var _lw = 0;
      var ro = new ResizeObserver(function () {
        var w = canvas.clientWidth || cwrap.clientWidth;
        if (w && Math.abs(w - _lw) > 2 && canvas.style.display !== "none") { _lw = w; drawChart(canvas, spec); }
      });
      ro.observe(cwrap);
    } catch (e) { }
    return { card: card, canvas: canvas, cwrap: cwrap };
  }

  // Abre o gráfico ampliado, centralizado na tela (overlay dentro do shadow do
  // widget — fica acima da página e herda o z-index máximo do host).
  function abrirModalGrafico(spec, inlineCanvas, iniciarNaTabela) {
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var raiz = (messagesEl.getRootNode && messagesEl.getRootNode()) || document.body;
    var ov = document.createElement("div");
    ov.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(15,15,20,.55);padding:16px;";
    var card = document.createElement("div");
    // Respeita o viewport: max-height (dvh p/ mobile com barra do navegador) + overflow
    // hidden; coluna flex com cabeçalho/rodapé FIXOS e a área do gráfico/tabela flexível
    // — assim a barra de botões nunca some e nenhuma informação fica escondida.
    card.style.cssText =
      "background:#fff;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.4);width:min(940px,94vw);" +
      "max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);overflow:hidden;" +
      "display:flex;flex-direction:column;padding:16px;";
    var hd = document.createElement("div");
    hd.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-shrink:0;";
    var ttl = document.createElement("div");
    ttl.textContent = spec.titulo || "Gráfico";
    ttl.style.cssText = "font-size:15px;font-weight:700;color:#17171a;flex:1;";
    var fechar = document.createElement("button");
    fechar.type = "button"; fechar.setAttribute("aria-label", "Fechar"); fechar.innerHTML = "&times;";
    fechar.style.cssText = "border:none;background:transparent;font-size:26px;line-height:1;cursor:pointer;color:#555;padding:0 6px;";
    var tabs = document.createElement("div"); tabs.style.cssText = "display:flex;gap:4px;";
    var tabG = kbTab("Gráfico"), tabT = kbTab("Tabela");
    tabs.appendChild(tabG); tabs.appendChild(tabT);
    hd.appendChild(ttl); hd.appendChild(tabs); hd.appendChild(fechar);
    var bwrap = document.createElement("div");
    // flex:1 + min-height:0 → ocupa o espaço entre cabeçalho e rodapé e ENCOLHE quando
    // o viewport é curto, para o rodapé (botões) nunca ser empurrado para fora.
    bwrap.style.cssText = "position:relative;flex:1;min-height:0;";
    var big = document.createElement("canvas");
    big.style.cssText = "width:100%;height:100%;display:block;";
    bwrap.appendChild(big);
    var navBoxM = document.createElement("div"); navBoxM.style.flexShrink = "0"; // minimapa (scroll/zoom)
    var twrap = kbChartTable(spec, pc); // aba Tabela
    twrap.style.flex = "1";
    twrap.style.minHeight = "0";
    twrap.style.maxHeight = "none";
    twrap.style.overflow = "auto";
    twrap.style.display = "none";
    var ft = document.createElement("div");
    // Rodapé FIXO (não encolhe): a barra de botões fica sempre visível.
    ft.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:12px;flex-shrink:0;";
    var sel = document.createElement("select");
    sel.setAttribute("aria-label", "Tipo do gráfico");
    sel.style.cssText = "font-size:13px;padding:6px 9px;border-radius:9px;cursor:pointer;border:1px solid rgba(0,0,0,.15);background:#fff;color:#222;";
    CHART_TIPOS.forEach(function (t) {
      var o = document.createElement("option"); o.value = t[0]; o.textContent = t[1];
      if (t[0] === spec.tipo) o.selected = true; sel.appendChild(o);
    });
    var espaco = document.createElement("span"); espaco.style.cssText = "flex:1;";
    ft.appendChild(sel); ft.appendChild(espaco);
    ft.appendChild(kbChartBtn("⬇ CSV", pc, function () {
      kbBaixar((spec.titulo || "grafico") + ".csv", "data:text/csv;charset=utf-8," + encodeURIComponent("﻿" + kbChartCsv(spec)));
    }));
    var png = kbChartBtn("⬇ PNG", pc, function () {
      try { kbBaixar((spec.titulo || "grafico") + ".png", big.toDataURL("image/png")); } catch { }
    });
    ft.appendChild(png);
    ft.appendChild(kbChartBtn("💾 Salvar", pc, function () { salvarGrafico(spec); }));
    // Botão explícito de VOLTAR (além do × e do Esc) — some dúvida de como fechar a modal.
    ft.appendChild(kbChartBtn("✕ Fechar", pc, function () { fecharModal(); }));
    // Legenda de contexto FIXA (não encolhe) — visível no gráfico e na tabela.
    var capModal = kbChartCaption(spec); if (capModal) capModal.style.flexShrink = "0";
    card.appendChild(hd); if (capModal) card.appendChild(capModal); card.appendChild(bwrap); card.appendChild(navBoxM); card.appendChild(twrap); card.appendChild(ft);
    ov.appendChild(card);
    raiz.appendChild(ov);
    attachChartHover(big, bwrap);
    function redraw() { drawChart(big, spec, big.clientHeight || 520); }
    function refreshNavM() { navBoxM.innerHTML = ""; var wnav = attachChartNav(big, spec, redraw); if (wnav) navBoxM.appendChild(wnav); }
    // Alterna Gráfico/Tabela no modal (PNG e seletor de tipo só valem no gráfico).
    function setTabM(g) {
      bwrap.style.display = g ? "" : "none";
      navBoxM.style.display = g ? "" : "none";
      twrap.style.display = g ? "none" : "";
      sel.style.display = g ? "" : "none";
      png.style.display = g ? "" : "none";
      kbTabState(tabG, g, pc); kbTabState(tabT, !g, pc);
      if (g) redraw();
    }
    tabG.addEventListener("click", function () { setTabM(true); });
    tabT.addEventListener("click", function () { setTabM(false); });
    kbTabState(tabG, true, pc); kbTabState(tabT, false, pc);
    if (iniciarNaTabela) setTabM(false); else requestAnimationFrame(redraw);
    function fecharModal() {
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKey);
      if (big._navCleanup) { try { big._navCleanup(); } catch (e) { } }
      if (big._zoomCleanup) { try { big._zoomCleanup(); } catch (e) { } }
      if (inlineCanvas) drawChart(inlineCanvas, spec); // sincroniza o tipo escolhido
    }
    function onKey(e) { if (e.key === "Escape") fecharModal(); }
    function onResize() { redraw(); }
    fechar.addEventListener("click", fecharModal);
    ov.addEventListener("click", function (e) { if (e.target === ov) fecharModal(); });
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    sel.addEventListener("change", function () {
      spec.tipo = sel.value; big._view = null; redraw(); refreshNavM(); if (inlineCanvas) { inlineCanvas._view = null; drawChart(inlineCanvas, spec); }
    });
    // Navegação (minimapa) + zoom por seleção — LIGADOS por último, DEPOIS de fechar/Esc/clique-
    // fora já estarem ativos, para uma eventual falha aqui nunca bloquear o VOLTAR (fechar).
    try { refreshNavM(); attachChartZoom(big, bwrap, function () { redraw(); refreshNavM(); }); } catch (e) { }
  }

  function drawChart(canvas, spec, cssHArg) {
    var dpr = window.devicePixelRatio || 1;
    var cssW = canvas.clientWidth || (canvas.parentNode ? canvas.parentNode.clientWidth - 24 : 300);
    var cssH = cssHArg || 240;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    var hits = []; canvas._hits = hits; // regiões de hover (rebuild a cada draw)
    var fg = "#1a1a1a", muted = "#6b6b72", gridc = "rgba(0,0,0,.08)";
    ctx.font = "11px system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
    ctx.textBaseline = "middle";
    var catsAll = spec.categorias || [], seriesAll = spec.series || [];
    if (!catsAll.length || !seriesAll.length) return;
    var tipo = spec.tipo;
    // JANELA (scroll/zoom): tipos com eixo de categorias mostram só [i0,i1); os demais usam tudo.
    var _win = chartWindowable(tipo) ? chartView(canvas, catsAll.length) : { i0: 0, i1: catsAll.length };
    canvas._win = _win; canvas._ncats = catsAll.length; canvas._geom = null;
    var cats = catsAll.slice(_win.i0, _win.i1);
    var series = seriesAll.map(function (s) { return { nome: s.nome, valores: (s.valores || []).slice(_win.i0, _win.i1) }; });
    if (!cats.length) return;
    // Tipos com renderizador PRÓPRIO (fora do eixo de barras/colunas padrão).
    if (tipo === "radar") { drawRadar(ctx, cssW, cssH, cats, series, fg, muted, gridc, hits); return; }
    if (tipo === "dispersao" || tipo === "bolha") { drawScatter(ctx, cssW, cssH, catsAll, seriesAll, tipo === "bolha", fg, muted, gridc, hits); return; }
    if (tipo === "heatmap") { drawHeatmap(ctx, cssW, cssH, cats, series, fg, muted, hits); return; }
    if (tipo === "candle") { drawCandle(ctx, cssW, cssH, cats, series, fg, muted, gridc, hits); return; }
    // Empilhado (soma as séries numa pilha) e combo (1ª série colunas, resto linha).
    var emp = tipo === "colunas_emp" || tipo === "barras_emp" || tipo === "area_emp";
    var combo = tipo === "combo";
    var baseTipo = tipo === "colunas_emp" || tipo === "combo" ? "colunas" : tipo === "barras_emp" ? "barras" : tipo === "area_emp" ? "area" : tipo;
    // Somas por série → percentuais no tooltip (sobre TODOS os dados, não só a janela).
    var somas = seriesAll.map(function (s) { return s.valores.reduce(function (a, b) { return a + (b || 0); }, 0); });
    function pct(v, si) { var t = somas[si] || 0; return t ? Math.round((v / t) * 1000) / 10 : 0; }
    function tipCat(ci) {
      var out = "<b>" + esc(cats[ci]) + "</b>";
      for (var s = 0; s < series.length; s++) {
        var v = series[s].valores[ci] || 0;
        out += "<br>" + (series.length > 1 ? esc(series[s].nome) + ": " : "") + kbNum(v) + " (" + pct(v, s) + "%)";
      }
      return out;
    }
    function tipVal(ci, si) {
      var v = series[si].valores[ci] || 0;
      return "<b>" + esc(cats[ci]) + "</b><br>" + (series.length > 1 ? esc(series[si].nome) + ": " : "") + kbNum(v) + " (" + pct(v, si) + "%)";
    }
    if (tipo === "pizza" || tipo === "rosca") { drawPie(ctx, cssW, cssH, spec, tipo === "rosca", fg, hits); return; }
    var topo = 8;
    if (series.length > 1) topo = drawLegend(ctx, cssW, series, fg);
    var padT = topo, padR = 12, steps = 4;
    var vmax = -Infinity, vmin = Infinity;
    if (emp) {
      // Empilhado: a escala vai até a SOMA das séries por categoria (a pilha inteira).
      for (var re = 0; re < cats.length; re++) {
        var pos = 0, neg = 0;
        for (var se = 0; se < series.length; se++) { var ve = series[se].valores[re] || 0; if (ve >= 0) pos += ve; else neg += ve; }
        if (pos > vmax) vmax = pos; if (pos < vmin) vmin = pos; if (neg < vmin) vmin = neg; if (neg > vmax) vmax = neg;
      }
    } else {
      for (var si2 = 0; si2 < series.length; si2++) for (var ri = 0; ri < cats.length; ri++) {
        var v0 = series[si2].valores[ri] || 0; if (v0 > vmax) vmax = v0; if (v0 < vmin) vmin = v0;
      }
    }
    if (vmax === -Infinity) return;
    vmin = Math.min(0, vmin); if (vmax === vmin) vmax = vmin + 1;
    var span = vmax - vmin, zeroFrac = (0 - vmin) / span;
    // Mediana (de todos os valores) e tendência (regressão da 1ª série), quando
    // a IA marcou pelo contexto. Nunca em pizza/rosca (já retornou acima).
    var COR_MED = "#C95788", COR_TREND = "#2563EB";
    var fontMed = "10px system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
    var todos = []; for (var ai = 0; ai < series.length; ai++) todos = todos.concat(series[ai].valores);
    var med = spec.mediana ? kbMediana(todos) : null;
    var reg = spec.tendencia ? kbReg(series[0].valores) : null;

    if (baseTipo === "barras") {
      // Rótulos à esquerda: largura DINÂMICA para não truncar quando há espaço.
      var maxLab = 0;
      for (var m = 0; m < cats.length; m++) { var lw = ctx.measureText(cats[m]).width; if (lw > maxLab) maxLab = lw; }
      var padL = Math.max(44, Math.min(Math.ceil(maxLab) + 12, Math.floor(cssW * 0.42)));
      var padB = 26;
      var plotW = Math.max(10, cssW - padL - padR), plotH = Math.max(10, cssH - padT - padB);
      var x0 = padL, y0 = padT;
      for (var g = 0; g <= steps; g++) {
        var vv = vmin + span * g / steps, gx = x0 + plotW * (vv - vmin) / span;
        ctx.strokeStyle = gridc; ctx.beginPath(); ctx.moveTo(gx, y0); ctx.lineTo(gx, y0 + plotH); ctx.stroke();
        ctx.fillStyle = muted; ctx.textAlign = "center"; ctx.fillText(kbFmt(vv), gx, y0 + plotH + 12);
      }
      var bandH = plotH / cats.length, zeroX = x0 + plotW * zeroFrac;
      // Geometria p/ o zoom por seleção NO gráfico (barras = eixo de categorias VERTICAL).
      canvas._geom = { vert: true, a: y0, len: plotH, i0: _win.i0, i1: _win.i1, x: x0, wpx: plotW };
      for (var c = 0; c < cats.length; c++) {
        var by = y0 + bandH * c;
        ctx.fillStyle = muted; ctx.textAlign = "right"; ctx.fillText(kbTrunc(ctx, cats[c], padL - 8), x0 - 6, by + bandH / 2);
        hits.push({ x: 0, y: by, w: padL, h: bandH, html: tipCat(c) });
        if (emp) {
          var cur = zeroX, hh = bandH * 0.72, ry0 = by + bandH * 0.14;
          for (var se2 = 0; se2 < series.length; se2++) {
            var vE = series[se2].valores[c] || 0, bwE = plotW * vE / span;
            ctx.fillStyle = CHART_PAL[se2 % CHART_PAL.length];
            ctx.fillRect(cur, ry0, bwE, hh);
            hits.push({ x: Math.min(cur, cur + bwE), y: ry0, w: Math.max(3, Math.abs(bwE)), h: hh, html: tipVal(c, se2) });
            cur += bwE;
          }
        } else {
          var sh = (bandH * 0.7) / series.length;
          for (var s2 = 0; s2 < series.length; s2++) {
            var val = series[s2].valores[c] || 0, bw = plotW * val / span, ry = by + bandH * 0.15 + sh * s2;
            ctx.fillStyle = CHART_PAL[s2 % CHART_PAL.length];
            ctx.fillRect(zeroX, ry, bw, sh * 0.86);
            hits.push({ x: Math.min(zeroX, zeroX + bw), y: ry, w: Math.max(3, Math.abs(bw)), h: sh * 0.86, html: tipVal(c, s2) });
          }
        }
        hits.push({ x: x0, y: by, w: plotW, h: bandH, html: tipCat(c) }); // faixa (fallback)
      }
      if (med != null) {
        var mvx = x0 + plotW * (med - vmin) / span;
        ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = COR_MED; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(mvx, y0); ctx.lineTo(mvx, y0 + plotH); ctx.stroke(); ctx.restore();
        ctx.fillStyle = COR_MED; ctx.textAlign = "left"; ctx.font = fontMed;
        ctx.fillText("Mediana " + kbFmt(med), Math.min(mvx + 4, x0 + plotW - 58), y0 + 7);
      }
      return;
    }

    // colunas / linha / área
    var padL2 = 44;
    var plotW2 = Math.max(10, cssW - padL2 - padR);
    var band = plotW2 / cats.length;
    // Rótulos X responsivos: inteiros se couberem; senão rotaciona (usa o espaço).
    var maxLab2 = 0;
    for (var mm = 0; mm < cats.length; mm++) { var lw2 = ctx.measureText(cats[mm]).width; if (lw2 > maxLab2) maxLab2 = lw2; }
    var girar = maxLab2 > band - 6;
    var padB2 = girar ? Math.min(Math.floor(cssH * 0.30), 56) : 24;
    var plotH2 = Math.max(10, cssH - padT - padB2);
    var x02 = padL2, y02 = padT;
    // Geometria p/ o zoom por seleção NO gráfico (colunas/linha/área = eixo X HORIZONTAL).
    canvas._geom = { vert: false, a: x02, len: plotW2, i0: _win.i0, i1: _win.i1, y: y02, hpx: plotH2 };
    var valorY = function (val) { return y02 + plotH2 - plotH2 * (val - vmin) / span; };
    var zeroY = valorY(0);
    for (var g2 = 0; g2 <= steps; g2++) {
      var vv2 = vmin + span * g2 / steps, gy = valorY(vv2);
      ctx.strokeStyle = gridc; ctx.beginPath(); ctx.moveTo(x02, gy); ctx.lineTo(x02 + plotW2, gy); ctx.stroke();
      ctx.fillStyle = muted; ctx.textAlign = "right"; ctx.fillText(kbFmt(vv2), x02 - 6, gy);
    }
    for (var c2 = 0; c2 < cats.length; c2++) {
      var cxp = x02 + band * c2 + band / 2;
      ctx.fillStyle = muted;
      if (girar) {
        ctx.save(); ctx.translate(cxp, y02 + plotH2 + 8); ctx.rotate(-Math.PI / 5); ctx.textAlign = "right";
        ctx.fillText(kbTrunc(ctx, cats[c2], padB2 * 1.9), 0, 0); ctx.restore();
      } else {
        ctx.textAlign = "center"; ctx.fillText(cats[c2], cxp, y02 + plotH2 + 12);
      }
      hits.push({ x: x02 + band * c2, y: y02 + plotH2, w: band, h: padB2, html: tipCat(c2) });
    }
    if (combo) {
      // COMBO: 1ª série = colunas; as demais = linhas sobrepostas.
      var sc0 = series[0];
      for (var cc = 0; cc < cats.length; cc++) {
        var vC = sc0.valores[cc] || 0, vyC = valorY(vC), bxC = x02 + band * cc + band * 0.2;
        ctx.fillStyle = CHART_PAL[0];
        ctx.fillRect(bxC, Math.min(vyC, zeroY), band * 0.6, Math.max(1, Math.abs(zeroY - vyC)));
        hits.push({ x: bxC, y: Math.min(vyC, zeroY), w: band * 0.6, h: Math.max(3, Math.abs(zeroY - vyC)), html: tipVal(cc, 0) });
        hits.push({ x: x02 + band * cc, y: y02, w: band, h: plotH2, html: tipCat(cc) });
      }
      for (var sl = 1; sl < series.length; sl++) {
        var colL = CHART_PAL[sl % CHART_PAL.length]; ctx.strokeStyle = colL; ctx.lineWidth = 2.3; ctx.beginPath();
        var ptsL = [];
        for (var cl = 0; cl < cats.length; cl++) { var vl = series[sl].valores[cl] || 0, pxl = x02 + band * cl + band / 2, pyl = valorY(vl); ptsL.push([pxl, pyl]); if (cl === 0) ctx.moveTo(pxl, pyl); else ctx.lineTo(pxl, pyl); }
        ctx.stroke(); ctx.fillStyle = colL;
        for (var pl2 = 0; pl2 < ptsL.length; pl2++) { ctx.beginPath(); ctx.arc(ptsL[pl2][0], ptsL[pl2][1], 2.6, 0, 6.2832); ctx.fill(); }
      }
    } else if (baseTipo === "colunas" && emp) {
      // COLUNAS EMPILHADAS: cada série soma sobre a anterior (pos/neg separados).
      for (var ce = 0; ce < cats.length; ce++) {
        var accP = 0, accN = 0, bxs = x02 + band * ce + band * 0.2, bws = band * 0.6;
        for (var ss = 0; ss < series.length; ss++) {
          var vs = series[ss].valores[ce] || 0, base0 = vs >= 0 ? accP : accN, yTop = valorY(base0 + vs), yBot = valorY(base0);
          ctx.fillStyle = CHART_PAL[ss % CHART_PAL.length];
          ctx.fillRect(bxs, Math.min(yTop, yBot), bws, Math.max(1, Math.abs(yBot - yTop)));
          hits.push({ x: bxs, y: Math.min(yTop, yBot), w: bws, h: Math.max(3, Math.abs(yBot - yTop)), html: tipVal(ce, ss) });
          if (vs >= 0) accP += vs; else accN += vs;
        }
        hits.push({ x: x02 + band * ce, y: y02, w: band, h: plotH2, html: tipCat(ce) });
      }
    } else if (baseTipo === "colunas") {
      var sw = (band * 0.7) / series.length;
      for (var c3 = 0; c3 < cats.length; c3++) {
        for (var s3 = 0; s3 < series.length; s3++) {
          var val3 = series[s3].valores[c3] || 0, vy = valorY(val3), bx = x02 + band * c3 + band * 0.15 + sw * s3;
          ctx.fillStyle = CHART_PAL[s3 % CHART_PAL.length];
          ctx.fillRect(bx, Math.min(vy, zeroY), sw * 0.9, Math.abs(zeroY - vy));
          hits.push({ x: bx, y: Math.min(vy, zeroY), w: sw * 0.9, h: Math.max(3, Math.abs(zeroY - vy)), html: tipVal(c3, s3) });
        }
        hits.push({ x: x02 + band * c3, y: y02, w: band, h: plotH2, html: tipCat(c3) }); // faixa (fallback)
      }
    } else if (baseTipo === "area" && emp) {
      // ÁREA EMPILHADA: cada série ocupa a faixa entre o acumulado anterior e o novo.
      var accArr = cats.map(function () { return 0; });
      for (var sa = 0; sa < series.length; sa++) {
        var colA = CHART_PAL[sa % CHART_PAL.length], top = [], botp = [];
        for (var ca = 0; ca < cats.length; ca++) {
          var prev = accArr[ca], nv = prev + (series[sa].valores[ca] || 0), pxa = x02 + band * ca + band / 2;
          accArr[ca] = nv; top.push([pxa, valorY(nv)]); botp.push([pxa, valorY(prev)]);
        }
        ctx.beginPath(); ctx.moveTo(top[0][0], top[0][1]);
        for (var t2 = 1; t2 < top.length; t2++) ctx.lineTo(top[t2][0], top[t2][1]);
        for (var bb = botp.length - 1; bb >= 0; bb--) ctx.lineTo(botp[bb][0], botp[bb][1]);
        ctx.closePath(); ctx.globalAlpha = 0.5; ctx.fillStyle = colA; ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = colA; ctx.lineWidth = 1.5; ctx.beginPath();
        for (var tt = 0; tt < top.length; tt++) { if (tt === 0) ctx.moveTo(top[tt][0], top[tt][1]); else ctx.lineTo(top[tt][0], top[tt][1]); }
        ctx.stroke();
      }
      for (var ch2 = 0; ch2 < cats.length; ch2++) hits.push({ x: x02 + band * ch2, y: y02, w: band, h: plotH2, html: tipCat(ch2) });
    } else {
      for (var s4 = 0; s4 < series.length; s4++) {
        var col = CHART_PAL[s4 % CHART_PAL.length]; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
        var pts = [];
        for (var c4 = 0; c4 < cats.length; c4++) {
          var v4 = series[s4].valores[c4] || 0, px2 = x02 + band * c4 + band / 2, py2 = valorY(v4);
          pts.push([px2, py2]); if (c4 === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
        }
        ctx.stroke();
        if (baseTipo === "area" && pts.length) {
          ctx.lineTo(pts[pts.length - 1][0], zeroY); ctx.lineTo(pts[0][0], zeroY); ctx.closePath();
          ctx.globalAlpha = 0.15; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1;
        }
        ctx.fillStyle = col;
        for (var pi = 0; pi < pts.length; pi++) { ctx.beginPath(); ctx.arc(pts[pi][0], pts[pi][1], 2.5, 0, 6.2832); ctx.fill(); }
      }
      for (var c5 = 0; c5 < cats.length; c5++) {
        hits.push({ x: x02 + band * c5, y: y02, w: band, h: plotH2, html: tipCat(c5) }); // faixa por X
      }
    }
    if (med != null) {
      var my = valorY(med);
      ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = COR_MED; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x02, my); ctx.lineTo(x02 + plotW2, my); ctx.stroke(); ctx.restore();
      ctx.fillStyle = COR_MED; ctx.textAlign = "right"; ctx.font = fontMed;
      ctx.fillText("Mediana " + kbFmt(med), x02 + plotW2, my - 6);
    }
    if (reg) {
      var clY = function (y) { return Math.max(y02, Math.min(y02 + plotH2, y)); };
      var xa = x02 + band / 2, xb = x02 + band * (cats.length - 1) + band / 2;
      var ya = clY(valorY(reg.a)), yb = clY(valorY(reg.a + reg.b * (cats.length - 1)));
      ctx.save(); ctx.setLineDash([6, 4]); ctx.strokeStyle = COR_TREND; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke(); ctx.restore();
      ctx.fillStyle = COR_TREND; ctx.textAlign = "right"; ctx.font = fontMed;
      ctx.fillText("Tendência " + (reg.b > 0 ? "↗" : reg.b < 0 ? "↘" : "→"), xb - 2, yb - 6);
    }
  }

  // RADAR / TEIA: categorias = eixos (raios), séries = polígonos. Legível com poucos eixos.
  function drawRadar(ctx, w, h, cats, series, fg, muted, gridc, hits) {
    var n = Math.min(cats.length, 24);
    if (n < 3) { ctx.fillStyle = muted; ctx.textAlign = "center"; ctx.fillText("Radar precisa de ao menos 3 categorias.", w / 2, h / 2); return; }
    var topo = series.length > 1 ? drawLegend(ctx, w, series, fg) : 8;
    var cx = w / 2, cy = (h + topo) / 2, R = Math.min(w, h - topo) * 0.36, vmax = 0;
    for (var s = 0; s < series.length; s++) for (var i = 0; i < n; i++) { var v = series[s].valores[i] || 0; if (v > vmax) vmax = v; }
    if (vmax <= 0) vmax = 1;
    ctx.strokeStyle = gridc;
    for (var r = 1; r <= 4; r++) { ctx.beginPath(); for (var a = 0; a <= n; a++) { var ang = -Math.PI / 2 + (a % n) * 2 * Math.PI / n, rr = R * r / 4, px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr; if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.stroke(); }
    ctx.fillStyle = muted; ctx.font = "10px system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
    for (var e = 0; e < n; e++) {
      var ea = -Math.PI / 2 + e * 2 * Math.PI / n, ex = cx + Math.cos(ea) * R, ey = cy + Math.sin(ea) * R;
      ctx.strokeStyle = gridc; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.textAlign = Math.abs(Math.cos(ea)) < 0.3 ? "center" : (Math.cos(ea) > 0 ? "left" : "right");
      ctx.fillText(kbTrunc(ctx, cats[e], 70), cx + Math.cos(ea) * (R + 12), cy + Math.sin(ea) * (R + 12));
    }
    for (var si = 0; si < series.length; si++) {
      var col = CHART_PAL[si % CHART_PAL.length]; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
      for (var p = 0; p <= n; p++) { var idx = p % n, va = -Math.PI / 2 + idx * 2 * Math.PI / n, rv = R * (series[si].valores[idx] || 0) / vmax, vx = cx + Math.cos(va) * rv, vy = cy + Math.sin(va) * rv; if (p === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy); }
      ctx.closePath(); ctx.globalAlpha = 0.14; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
      for (var pp = 0; pp < n; pp++) { var pa = -Math.PI / 2 + pp * 2 * Math.PI / n, prv = R * (series[si].valores[pp] || 0) / vmax, ppx = cx + Math.cos(pa) * prv, ppy = cy + Math.sin(pa) * prv; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ppx, ppy, 2.6, 0, 6.2832); ctx.fill(); hits.push({ x: ppx - 6, y: ppy - 6, w: 12, h: 12, html: "<b>" + esc(cats[pp]) + "</b><br>" + (series.length > 1 ? esc(series[si].nome) + ": " : "") + kbNum(series[si].valores[pp] || 0) }); }
    }
  }
  // DISPERSÃO / BOLHA: série0=X, série1=Y, série2=tamanho (bolha). 1 série → X=índice.
  function drawScatter(ctx, w, h, catsAll, seriesAll, bubble, fg, muted, gridc, hits) {
    var xs, ys, sz;
    if (seriesAll.length >= 2) { xs = seriesAll[0].valores; ys = seriesAll[1].valores; sz = bubble && seriesAll[2] ? seriesAll[2].valores : null; }
    else { xs = catsAll.map(function (_, i) { return i; }); ys = seriesAll[0] ? seriesAll[0].valores : []; sz = null; }
    var n = Math.min(xs.length, ys.length); if (!n) return;
    var xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity, smax = 0;
    for (var i = 0; i < n; i++) { var x = xs[i] || 0, y = ys[i] || 0; if (x < xmin) xmin = x; if (x > xmax) xmax = x; if (y < ymin) ymin = y; if (y > ymax) ymax = y; if (sz) { var sv = sz[i] || 0; if (sv > smax) smax = sv; } }
    if (xmin === xmax) { xmin -= 1; xmax += 1; } if (ymin === ymax) { ymin -= 1; ymax += 1; } ymin = Math.min(0, ymin);
    var padL = 46, padR = 12, padT = 10, padB = 26, plotW = Math.max(10, w - padL - padR), plotH = Math.max(10, h - padT - padB), x0 = padL, y0 = padT;
    var X = function (v) { return x0 + plotW * (v - xmin) / (xmax - xmin); }, Y = function (v) { return y0 + plotH - plotH * (v - ymin) / (ymax - ymin); };
    ctx.font = "11px system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
    for (var g = 0; g <= 4; g++) { var vy = ymin + (ymax - ymin) * g / 4, gy = Y(vy); ctx.strokeStyle = gridc; ctx.beginPath(); ctx.moveTo(x0, gy); ctx.lineTo(x0 + plotW, gy); ctx.stroke(); ctx.fillStyle = muted; ctx.textAlign = "right"; ctx.fillText(kbFmt(vy), x0 - 6, gy); }
    for (var gx = 0; gx <= 4; gx++) { var vx = xmin + (xmax - xmin) * gx / 4; ctx.fillStyle = muted; ctx.textAlign = "center"; ctx.fillText(kbFmt(vx), X(vx), y0 + plotH + 12); }
    var xlbl = seriesAll.length >= 2 ? seriesAll[0].nome : "índice", ylbl = seriesAll.length >= 2 ? seriesAll[1].nome : (seriesAll[0] ? seriesAll[0].nome : "valor");
    for (var p = 0; p < n; p++) {
      var cxp = X(xs[p] || 0), cyp = Y(ys[p] || 0), rr = bubble && smax > 0 ? 4 + 16 * Math.sqrt((sz[p] || 0) / smax) : 4.5;
      ctx.fillStyle = CHART_PAL[p % CHART_PAL.length] + "cc"; ctx.beginPath(); ctx.arc(cxp, cyp, rr, 0, 6.2832); ctx.fill();
      hits.push({ x: cxp - rr, y: cyp - rr, w: rr * 2, h: rr * 2, html: "<b>" + esc(catsAll[p] || ("#" + (p + 1))) + "</b><br>" + esc(xlbl) + ": " + kbNum(xs[p] || 0) + "<br>" + esc(ylbl) + ": " + kbNum(ys[p] || 0) + (bubble && sz ? "<br>" + esc(seriesAll[2].nome) + ": " + kbNum(sz[p] || 0) : "") });
    }
  }
  // MAPA DE CALOR: linhas = categorias, colunas = séries, célula = valor → intensidade.
  function drawHeatmap(ctx, w, h, cats, series, fg, muted, hits) {
    var rows = cats.length, cols = series.length; if (!rows || !cols) return;
    var vmin = Infinity, vmax = -Infinity;
    for (var i = 0; i < rows; i++) for (var j = 0; j < cols; j++) { var v = series[j].valores[i] || 0; if (v < vmin) vmin = v; if (v > vmax) vmax = v; }
    if (vmin === vmax) vmax = vmin + 1;
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    ctx.font = "11px system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
    var maxLab = 0; for (var m = 0; m < rows; m++) { var lw = ctx.measureText(cats[m]).width; if (lw > maxLab) maxLab = lw; }
    var padL = Math.max(44, Math.min(Math.ceil(maxLab) + 10, Math.floor(w * 0.4))), padT = 24, padR = 10, padB = 8;
    var gw = Math.max(6, (w - padL - padR) / cols), gh = Math.max(6, (h - padT - padB) / rows);
    ctx.fillStyle = muted; ctx.textAlign = "center";
    for (var jc = 0; jc < cols; jc++) ctx.fillText(kbTrunc(ctx, series[jc].nome, gw - 4), padL + gw * jc + gw / 2, padT - 8);
    for (var r = 0; r < rows; r++) {
      ctx.fillStyle = muted; ctx.textAlign = "right"; ctx.fillText(kbTrunc(ctx, cats[r], padL - 8), padL - 6, padT + gh * r + gh / 2);
      for (var c = 0; c < cols; c++) {
        var val = series[c].valores[r] || 0, t = (val - vmin) / (vmax - vmin);
        ctx.fillStyle = pc; ctx.globalAlpha = 0.1 + 0.86 * t; ctx.fillRect(padL + gw * c + 1, padT + gh * r + 1, gw - 2, gh - 2); ctx.globalAlpha = 1;
        hits.push({ x: padL + gw * c, y: padT + gh * r, w: gw, h: gh, html: "<b>" + esc(cats[r]) + " · " + esc(series[c].nome) + "</b><br>" + kbNum(val) });
      }
    }
  }
  // CANDLE (OHLC): série0=abertura, 1=máxima, 2=mínima, 3=fechamento.
  function drawCandle(ctx, w, h, cats, series, fg, muted, gridc, hits) {
    if (series.length < 4) { ctx.fillStyle = muted; ctx.textAlign = "center"; ctx.fillText("Candle precisa de 4 séries: abertura, máxima, mínima, fechamento.", w / 2, h / 2); return; }
    var O = series[0].valores, H = series[1].valores, L = series[2].valores, C = series[3].valores, n = cats.length;
    var vmin = Infinity, vmax = -Infinity;
    for (var i = 0; i < n; i++) { var lo = L[i], hi = H[i]; if (lo < vmin) vmin = lo; if (hi > vmax) vmax = hi; }
    if (!isFinite(vmin) || !isFinite(vmax)) return; if (vmin === vmax) vmax = vmin + 1;
    var pd = (vmax - vmin) * 0.05; vmin -= pd; vmax += pd;
    var padL = 48, padR = 10, padT = 10, padB = 26, plotW = Math.max(10, w - padL - padR), plotH = Math.max(10, h - padT - padB), x0 = padL, y0 = padT;
    var Y = function (v) { return y0 + plotH - plotH * (v - vmin) / (vmax - vmin); };
    ctx.font = "11px system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
    for (var g = 0; g <= 4; g++) { var vv = vmin + (vmax - vmin) * g / 4, gy = Y(vv); ctx.strokeStyle = gridc; ctx.beginPath(); ctx.moveTo(x0, gy); ctx.lineTo(x0 + plotW, gy); ctx.stroke(); ctx.fillStyle = muted; ctx.textAlign = "right"; ctx.fillText(kbFmt(vv), x0 - 6, gy); }
    var band = plotW / n, girar = band < 34;
    for (var c = 0; c < n; c++) {
      var cx = x0 + band * c + band / 2, o = O[c] || 0, cl = C[c] || 0, up = cl >= o, col = up ? "#10B981" : "#EF4444";
      ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, Y(H[c] || 0)); ctx.lineTo(cx, Y(L[c] || 0)); ctx.stroke();
      var yO = Y(o), yC = Y(cl), bw = Math.max(3, band * 0.5); ctx.fillStyle = col; ctx.fillRect(cx - bw / 2, Math.min(yO, yC), bw, Math.max(1, Math.abs(yC - yO)));
      ctx.fillStyle = muted;
      if (girar) { ctx.save(); ctx.translate(cx, y0 + plotH + 8); ctx.rotate(-Math.PI / 5); ctx.textAlign = "right"; ctx.fillText(kbTrunc(ctx, cats[c], 46), 0, 0); ctx.restore(); }
      else { ctx.textAlign = "center"; ctx.fillText(kbTrunc(ctx, cats[c], band), cx, y0 + plotH + 12); }
      hits.push({ x: x0 + band * c, y: y0, w: band, h: plotH, html: "<b>" + esc(cats[c]) + "</b><br>Abt: " + kbNum(o) + "<br>Máx: " + kbNum(H[c] || 0) + "<br>Mín: " + kbNum(L[c] || 0) + "<br>Fch: " + kbNum(cl) });
    }
  }
  function drawLegend(ctx, w, series, fg) {
    var x = 6, y = 12; ctx.textAlign = "left";
    for (var i = 0; i < series.length; i++) {
      var lbl = series[i].nome || ("Série " + (i + 1));
      ctx.fillStyle = CHART_PAL[i % CHART_PAL.length]; ctx.fillRect(x, y - 4, 9, 9);
      ctx.fillStyle = fg; ctx.fillText(lbl, x + 13, y);
      x += 13 + ctx.measureText(lbl).width + 14;
      if (x > w - 60 && i < series.length - 1) { x = 6; y += 15; }
    }
    return y + 8;
  }

  function drawPie(ctx, w, h, spec, donut, fg, hits) {
    var serie = spec.series[0]; if (!serie) return;
    var cats = spec.categorias;
    var vals = cats.map(function (_, i) { return Math.max(0, serie.valores[i] || 0); });
    var total = vals.reduce(function (a, b) { return a + b; }, 0);
    if (total <= 0) return;
    var cx = w * 0.32, cy = h / 2, R = Math.min(w * 0.28, h * 0.40), ang = -Math.PI / 2;
    var ri = donut ? R * 0.55 : 0;
    for (var i = 0; i < vals.length; i++) {
      var frac = vals[i] / total, a2 = ang + frac * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, ang, a2); ctx.closePath();
      ctx.fillStyle = CHART_PAL[i % CHART_PAL.length]; ctx.fill();
      if (hits) hits.push({
        pie: { cx: cx, cy: cy, ri: ri, ro: R, a0: ang, a1: a2 },
        html: "<b>" + esc(cats[i]) + "</b><br>" + kbNum(vals[i]) + " (" + (Math.round(frac * 1000) / 10) + "%)"
      });
      ang = a2;
    }
    if (donut) { ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(cx, cy, R * 0.55, 0, 6.2832); ctx.fill(); }
    var lx = w * 0.60, ly = cy - (cats.length * 16) / 2 + 8; ctx.textAlign = "left";
    for (var j = 0; j < cats.length; j++) {
      ctx.fillStyle = CHART_PAL[j % CHART_PAL.length]; ctx.fillRect(lx, ly - 5, 10, 10);
      ctx.fillStyle = fg;
      var p = Math.round((vals[j] / total) * 1000) / 10;
      ctx.fillText(kbTrunc(ctx, cats[j], w - lx - 60) + " " + p + "%", lx + 15, ly);
      if (hits) hits.push({
        x: lx - 2, y: ly - 9, w: w - lx, h: 16,
        html: "<b>" + esc(cats[j]) + "</b><br>" + kbNum(vals[j]) + " (" + p + "%)"
      });
      ly += 16;
    }
  }

  // Sessão anônima estável (para agrupar a conversa).
  var sessionId = localStorage.getItem(LS_SID);
  if (!sessionId) {
    sessionId =
      "s_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(LS_SID, sessionId);
  }

  var cfg = {
    primaryColor: "#511C76",
    title: "Assistente",
    welcome: "Olá! Como posso ajudar com a documentação?",
    suggestions: [],
    position: "right",
    // Coleta do IR via NOSSO servidor → ORDS (Opção A: 100% das linhas). Ligado
    // por padrão; cai no fallback (varredura por página) se o endpoint não
    // responder. Para desligar numa chave específica: widget_keys.config.reportServer = false.
    reportServer: true,
  };
  var conversationId = null;
  var open = false;
  var expanded = false;
  try { expanded = localStorage.getItem("kb.widget.exp") === "1"; } catch { }
  var _animT = null;
  var _closeT = null;
  var host, root, bubble, panel, messagesEl, inputEl, sendBtn, attzEl, fileInput, micBtn;
  // Anexos pendentes deste turno: {id?,name,mime?,size?,uploading?}.
  var pendingAtts = [];
  // Estado da gravação de voz: "idle" | "recording" | "transcribing".
  var micState = "idle";
  var mediaRec = null;
  var micChunks = [];
  // UI de áudio estilo WhatsApp (barra na entrada: onda, tempo, ouvir, enviar/apagar).
  var voiceBar = null, _voStream = null, _voCtx = null, _voAnalyser = null, _voRAF = 0, _voT0 = 0, _voTimerInt = 0;
  var _voBlob = null, _voUrl = null, _voAudio = null, _voCancelado = false;

  // ==== Estilos (isolados no Shadow DOM) ====
  function styles() {
    return (
      "" +
      ":host{all:initial}" +
      "*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}" +
      // Gradiente da marca (--pc primária; --pc2 derivada em JS, com fallback p/ --pc).
      ".grad{background:linear-gradient(135deg,var(--pc),var(--pc2,var(--pc)))}" +
      // Bolha flutuante
      ".bubble{position:fixed;z-index:2147483647;width:var(--bs,60px);height:var(--bs,60px);border-radius:50%;" +
      "background:linear-gradient(135deg,var(--pc),var(--pc2,var(--pc)));color:#fff;border:none;cursor:grab;" +
      "box-shadow:0 12px 30px rgba(40,20,80,.38);display:flex;align-items:center;justify-content:center;" +
      "transition:transform .18s ease,box-shadow .18s ease;touch-action:none}" +
      ".bubble:hover{transform:scale(1.07);box-shadow:0 16px 40px rgba(40,20,80,.46)}" +
      ".bubble:active{cursor:grabbing}" +
      // `pointer-events:none` no conteúdo: o pointerdown/move é SEMPRE da bolha,
      // e a imagem não inicia um drag NATIVO (era o que quebrava o arrastar
      // depois que a bolha passou a exibir uma imagem/avatar).
      ".bubble svg,.bubble .bic,.bubble .bimg{pointer-events:none;-webkit-user-drag:none;user-select:none}" +
      ".bubble svg{width:27px;height:27px}" +
      // Avatar/ícone configurado dentro da bolha: ícone (SVG) centralizado; foto preenche.
      ".bubble .bic{width:30px;height:30px;object-fit:contain}" +
      ".bubble .bimg{width:100%;height:100%;object-fit:cover;border-radius:50%}" +
      // Painel
      ".panel{position:fixed;z-index:2147483647;width:440px;max-width:calc(100vw - 20px);height:680px;" +
      "max-height:calc(100vh - 96px);background:#fff;border-radius:22px;overflow:hidden;display:none;flex-direction:column;" +
      "box-shadow:0 26px 72px rgba(30,15,60,.34);border:1px solid rgba(120,90,180,.14)}" +
      // Abrir/minimizar: cresce/encolhe a partir do canto da bolha (scale+fade).
      ".panel.open{display:flex;animation:kbin .34s cubic-bezier(.2,.8,.2,1)}" +
      ".panel.closing{animation:kbout .26s cubic-bezier(.4,0,1,1) forwards}" +
      // Expandido: a GEOMETRIA (left/width/top/height/raio) é px inline (setGeom);
      // a classe só solta os limites de tamanho para a área central caber.
      ".panel.exp{max-width:none;max-height:none;right:auto;bottom:auto}" +
      // Transição SÓ durante o expandir/recolher (0,5s smooth). Ligada por JS e
      // removida ao fim — para o arrastar da bolha não ficar com lag.
      ".panel.anim{transition:left .5s cubic-bezier(.4,0,.2,1),top .5s cubic-bezier(.4,0,.2,1),width .5s cubic-bezier(.4,0,.2,1),height .5s cubic-bezier(.4,0,.2,1),border-radius .5s cubic-bezier(.4,0,.2,1)}" +
      "@media(prefers-reduced-motion:reduce){.panel.anim{transition:none}.panel.open,.panel.closing{animation-duration:.01s}}" +
      // MOBILE — modo app: o painel ocupa a tela inteira. A geometria em px é do
      // setGeom (viewport VISUAL); a classe existe para SOLTAR os limites de tamanho
      // de .panel, que senão clampariam a altura inline.
      "@media(max-width:" + BP_MOBILE + "px){" +
      ".hd [data-expand]{display:none}" +
      ".panel.full{max-width:none;max-height:100dvh;border-radius:0;border:none;box-shadow:none}" +
      ".panel.full .hd{padding:calc(12px + env(safe-area-inset-top)) 10px 14px;gap:8px;cursor:default;touch-action:auto}" +
      ".panel.full .hd button{width:36px;height:36px}" +
      // Alvo de toque de 44px no minimizar — é o único caminho de sair da tela cheia.
      ".panel.full .hd [data-close]{width:44px;height:44px;font-size:26px}" +
      // Sem isto o gesto de rolar o chat "vaza" e arrasta a página do sistema host
      // (rubber-band). Resolve sem travar o <body> do host, que destruiria o scroll dele.
      ".panel.full .msgs{overscroll-behavior:contain;padding:14px 12px 8px}" +
      ".panel.full .opts{padding-left:12px}" +
      // 16px: abaixo disso o iOS Safari dá auto-zoom ao focar e desalinha o painel fixo.
      ".panel.full .ft textarea{font-size:16px}" +
      ".panel.full .pw{padding-bottom:calc(9px + env(safe-area-inset-bottom))}" +
      "}" +
      "@keyframes kbin{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:scale(1)}}" +
      "@keyframes kbout{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(.82)}}" +
      // Cabeçalho (gradiente)
      ".hd{background:linear-gradient(135deg,var(--pc),var(--pc2,var(--pc)));color:#fff;padding:16px 15px 18px;display:flex;align-items:center;gap:12px;cursor:move;touch-action:none;user-select:none}" +
      ".hd button{cursor:pointer;touch-action:auto}" +
      ".panel.exp .hd{cursor:default}" +
      ".hd .hav{width:44px;height:44px;border-radius:var(--ash,50%);background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;flex:none;overflow:hidden;box-shadow:0 3px 10px rgba(0,0,0,.15)}" +
      ".hd .hav img{width:100%;height:100%;object-fit:cover}" +
      ".hd .hav svg{width:24px;height:24px;color:#fff}" +
      ".hd .ti{flex:1;min-width:0}" +
      ".hd .t{font-weight:700;font-size:16px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".hd .s{font-size:12px;opacity:.85;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".hd button{background:rgba(255,255,255,.16);border:none;color:#fff;cursor:pointer;width:30px;height:30px;border-radius:50%;font-size:19px;line-height:1;display:flex;align-items:center;justify-content:center;transition:background .15s;flex:none}" +
      ".hd button:hover{background:rgba(255,255,255,.32)}" +
      ".hd button svg{width:15px;height:15px;display:block}" +
      // Mensagens
      ".msgs{flex:1;overflow-y:auto;padding:18px 15px 8px;background:#f6f4fb;display:flex;flex-direction:column;gap:14px}" +
      ".msgs::-webkit-scrollbar{width:8px}.msgs::-webkit-scrollbar-thumb{background:#dcd2ec;border-radius:8px}" +
      // Linha do assistente (avatar + balão)
      ".arow{display:flex;gap:9px;align-items:flex-start;max-width:92%}" +
      ".arow .av{width:30px;height:30px;border-radius:var(--ash,50%);flex:none;background:linear-gradient(135deg,var(--pc),var(--pc2,var(--pc)));display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 4px 12px rgba(40,20,80,.28)}" +
      ".arow .av svg{width:16px;height:16px;color:#fff}" +
      ".arow .av img{width:100%;height:100%;object-fit:cover}" +
      // Balões
      ".m{padding:11px 14px;border-radius:18px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere}" +
      ".m.u{align-self:flex-end;background:linear-gradient(135deg,var(--pc),var(--pc2,var(--pc)));color:#fff;border-bottom-right-radius:6px;max-width:82%;box-shadow:0 8px 20px rgba(60,30,110,.26)}" +
      ".m.a{background:#fff;color:#1c1726;border:1px solid #efe7f7;border-bottom-left-radius:6px;box-shadow:0 5px 16px rgba(60,40,100,.07)}" +
      ".arow .m.a{flex:1;min-width:0}" +
      // Carimbo de data/hora, bem sutil, logo abaixo de cada mensagem.
      ".mt{font-size:10px;line-height:1;color:#7a7091;opacity:.9;margin-top:-9px;user-select:none;pointer-events:none}" +
      ".mt.u{align-self:flex-end;margin-right:6px}" +
      ".mt.a{align-self:flex-start;margin-left:40px}" +
      ".m.a a{color:var(--pc);font-weight:600}" +
      ".m.a p{margin:6px 0}.m.a p:first-child{margin-top:0}.m.a p:last-child{margin-bottom:0}" +
      ".m.a strong{font-weight:700}.m.a em{font-style:italic}.m.a .mh{font-weight:700;margin:8px 0 4px}" +
      ".m.a ul,.m.a ol{margin:6px 0;padding-left:20px}.m.a li{margin:3px 0}" +
      ".m.a code{background:#f0ebf7;border-radius:5px;padding:1px 5px;font-size:.85em}" +
      ".m.a pre{background:#f4f0fa;border-radius:10px;padding:10px;overflow-x:auto;margin:6px 0}" +
      ".m.a pre code{background:none;padding:0}" +
      // Citações (alinhadas sob o balão do assistente: 30 av + 9 gap = 39)
      ".cdet{align-self:stretch;margin:0 0 0 39px}" +
      ".cites{display:flex;flex-direction:column;gap:8px;margin-top:6px}" +
      ".cite{display:flex;align-items:center;gap:10px;text-decoration:none;border:1px solid #ece3f6;border-radius:14px;padding:9px 10px;background:#fff;transition:border-color .15s,box-shadow .15s;box-shadow:0 3px 10px rgba(60,40,100,.05)}" +
      ".cite:hover{border-color:var(--pc);box-shadow:0 8px 18px rgba(60,40,100,.12)}" +
      ".cite-nolink{cursor:default}.cite-nolink:hover{border-color:#ece3f6;box-shadow:0 3px 10px rgba(60,40,100,.05)}" +
      ".csum{cursor:pointer;list-style:none;font-size:12px;font-weight:600;color:#6b6577;padding:4px 2px;user-select:none}" +
      ".csum::-webkit-details-marker{display:none}" +
      ".csum:before{content:\"\\25B8\";display:inline-block;margin-right:6px;transition:transform .15s}" +
      ".cdet[open] .csum:before{transform:rotate(90deg)}" +
      ".csum:hover{color:#201d26}" +
      ".cthumb{width:42px;height:42px;border-radius:9px;object-fit:cover;flex:none;background:#f3edfa}" +
      ".cthumb.cph{display:flex;align-items:center;justify-content:center;font-size:20px}" +
      ".cbody{min-width:0;display:flex;flex-direction:column}" +
      ".ctitle{font-size:12.5px;font-weight:600;color:var(--pc);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".cpath{font-size:11px;color:#8a7ea3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      // Feedback
      ".fbk{align-self:flex-start;display:flex;align-items:center;gap:6px;font-size:12px;color:#8a7ea3;margin:-4px 0 0 39px}" +
      ".fbk-btn{background:none;border:none;cursor:pointer;font-size:15px;line-height:1;padding:3px;border-radius:8px;opacity:.7;transition:.15s}" +
      ".fbk-btn:hover{opacity:1;background:#efe8f8}.fbk-btn.on{opacity:1;transform:scale(1.15)}" +
      // Chips de sugestão / desambiguação (pílulas contornadas)
      ".sugg{display:flex;flex-wrap:wrap;gap:8px;padding-left:39px}" +
      ".sugg button{font-size:13px;font-weight:500;color:var(--pc);border:1.5px solid;border-color:color-mix(in srgb,var(--pc) 38%,#fff);background:#fff;border-radius:999px;padding:8px 14px;cursor:pointer;text-align:left;line-height:1.35;transition:border-color .15s,background .15s,transform .1s;box-shadow:0 2px 7px rgba(60,40,100,.05)}" +
      ".sugg button:hover{border-color:var(--pc);background:color-mix(in srgb,var(--pc) 8%,#fff)}" +
      ".sugg button:active{transform:scale(.97)}" +
      // Opções de desambiguação = CARTÕES (nome do artigo + resumo), como no portal.
      ".opts{display:flex;flex-direction:column;gap:8px;padding-left:39px}" +
      ".opts button{text-align:left;border:1.5px solid;border-color:color-mix(in srgb,var(--pc) 38%,#fff);background:#fff;border-radius:14px;padding:10px 12px;cursor:pointer;box-shadow:0 2px 7px rgba(60,40,100,.05);transition:border-color .15s,background .15s}" +
      ".opts button:hover{border-color:var(--pc);background:color-mix(in srgb,var(--pc) 8%,#fff)}" +
      ".opts .ol{display:block;font-size:13px;font-weight:600;color:var(--pc)}" +
      ".opts .os{display:block;font-size:12px;color:#6b6577;margin-top:2px;line-height:1.4}" +
      // Multi-seleção: cada fonte é um cartão com caixa de marcação. Alvo de 44px
      // (dedo) e estado marcado destacado pela borda — o `.on` é alternado por JS,
      // não por :has(), para não depender do suporte do navegador.
      ".opts .opt{display:flex;align-items:flex-start;gap:10px;min-height:44px;text-align:left;cursor:pointer;" +
      "border:1.5px solid;border-color:color-mix(in srgb,var(--pc) 22%,#fff);background:#fff;border-radius:14px;padding:10px 12px;transition:border-color .15s,background .15s}" +
      ".opts .opt:hover{border-color:var(--pc)}" +
      ".opts .opt.on{border-color:var(--pc);background:color-mix(in srgb,var(--pc) 7%,#fff)}" +
      ".opts .opt input{flex:none;width:18px;height:18px;margin-top:2px;cursor:pointer;accent-color:var(--pc)}" +
      ".opts .otx{display:flex;flex-direction:column;gap:2px;min-width:0}" +
      // Gaveta do "Outra fonte": só aparece ao marcar a linha.
      ".opts .ofx{display:none;margin-left:28px;flex-direction:column;gap:8px}" +
      ".opts .ofx.on{display:flex}" +
      // 16px no campo: abaixo disso o iOS Safari dá auto-zoom ao focar.
      ".opts .find{width:100%;box-sizing:border-box;font-size:16px;border:1.5px solid #e6ddf1;border-radius:12px;padding:10px 12px;outline:none;background:#faf8fd;min-height:44px}" +
      ".opts .find:focus{border-color:var(--pc);background:#fff}" +
      ".opts .flist{max-height:172px;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:6px}" +
      ".opts .fnone{font-size:12px;color:#6b6577;padding:8px 4px;line-height:1.4}" +
      // Confirmar: botão PRIMÁRIO. Sem isto ele herda `.opts button` e fica idêntico
      // a mais uma linha de opção. `.opts .go` (0,2,0) vence `.opts button` (0,1,1).
      ".opts .go{background:linear-gradient(135deg,var(--pc),var(--pc2,var(--pc)));color:#fff;border:none;border-radius:14px;" +
      "padding:12px 16px;min-height:44px;font-weight:700;font-size:14px;text-align:center;box-shadow:0 8px 18px rgba(60,30,110,.28)}" +
      ".opts .go:hover{background:linear-gradient(135deg,var(--pc),var(--pc2,var(--pc)));filter:brightness(1.08)}" +
      // Rodapé / entrada
      ".ft{border-top:1px solid #efe9f6;padding:12px;display:flex;gap:9px;align-items:flex-end;background:#fff}" +
      ".ft textarea{flex:1;resize:none;border:1.5px solid #e6ddf1;border-radius:16px;padding:11px 14px;font-size:14px;line-height:1.4;outline:none;overflow-y:hidden;background:#faf8fd;transition:border-color .15s,background .15s;min-height:44px}" +
      ".ft textarea:focus{border-color:var(--pc);background:#fff}" +
      ".ft button{background:linear-gradient(135deg,var(--pc),var(--pc2,var(--pc)));color:#fff;border:none;border-radius:50%;width:44px;height:44px;flex:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s,box-shadow .15s,opacity .15s;box-shadow:0 8px 18px rgba(60,30,110,.3)}" +
      ".ft button:hover:not(:disabled){transform:scale(1.06)}" +
      ".ft button:disabled{opacity:.4;cursor:default;box-shadow:none}" +
      ".ft button svg{width:19px;height:19px}" +
      // Barra de áudio (estilo WhatsApp): esconde os controles normais e ocupa a linha.
      ".ft.voz > :not(.vbar){display:none!important}" +
      ".vbar{display:none;flex:1;align-items:center;gap:9px;background:#f4eefb;border-radius:22px;padding:6px 7px 6px 13px}" +
      ".ft.voz .vbar{display:flex}" +
      ".vdot{width:11px;height:11px;border-radius:50%;background:#e53935;flex:none;animation:kbblink 1.1s ease-in-out infinite}" +
      "@keyframes kbblink{50%{opacity:.18}}" +
      "@keyframes kbspin{to{transform:rotate(360deg)}}" +
      ".kbspin{animation:kbspin .7s linear infinite}" +
      // Transparência ao rolar a página ATRÁS do chat (permite ler o conteúdo).
      ".kb-dimmable{transition:opacity .2s ease}" +
      ".panel.kb-dim{opacity:.30!important}" +
      "@media(prefers-reduced-motion:reduce){.kb-dimmable{transition:none}}" +
      "@media(prefers-reduced-motion:reduce){.vdot,.kbspin{animation-duration:1.6s}}" +
      ".vtime{font-size:12.5px;font-weight:700;color:#4a4458;flex:none;font-variant-numeric:tabular-nums;min-width:34px}" +
      ".vwave{flex:1;height:26px;display:block;min-width:20px}" +
      ".vbtn{width:36px;height:36px;border-radius:50%;border:none;flex:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:none}" +
      ".vbtn svg{width:16px;height:16px}" +
      ".vbtn.del{background:#9ca3af}.vbtn.ok{background:var(--pc)}.vbtn.play{background:var(--pc)}" +
      // "Digitando…": três pontos que sobem em onda, na cor da marca do widget.
      ".dots{display:inline-flex;gap:4px;align-items:flex-end;height:8px}" +
      ".dots span{width:7px;height:7px;border-radius:50%;background:var(--pc);animation:bl 1.4s ease-in-out infinite}" +
      ".dots span:nth-child(2){animation-delay:.16s}.dots span:nth-child(3){animation-delay:.32s}" +
      "@keyframes bl{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}" +
      "@media (prefers-reduced-motion:reduce){.dots span{animation:blf 1.4s ease-in-out infinite}.panel.open{animation:none}}" +
      "@keyframes blf{0%,100%{opacity:.35}50%{opacity:1}}" +
      // Barra "Prompts salvos" (acima da entrada) + botão de salvar ao pairar o balão
      ".pbar{display:none;position:relative;background:#fff;padding:6px 12px 0}" +
      ".pbtn{display:inline-flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:#6b6577;font-size:12px;font-weight:600;padding:5px 8px;border-radius:8px;transition:background .15s,color .15s}" +
      ".pbtn:hover{background:#f2edfa;color:var(--pc)}" +
      ".pbtn svg{width:14px;height:14px}" +
      ".ppanel{display:none;position:absolute;bottom:100%;left:12px;right:12px;margin-bottom:6px;background:#fff;border:1px solid #e9e0f4;border-radius:14px;box-shadow:0 18px 46px rgba(40,20,80,.22);padding:8px;max-height:320px;overflow:auto;z-index:5}" +
      ".ppanel.open{display:block}" +
      ".pph{display:flex;align-items:center;justify-content:space-between;padding:2px 4px 6px}" +
      ".ppt{font-size:12px;font-weight:700;color:#201d26}" +
      ".ppa{display:flex;gap:4px}" +
      ".ppa button{background:none;border:none;cursor:pointer;color:#8a7ea3;padding:3px;border-radius:6px;display:flex;align-items:center;line-height:1}" +
      ".ppa button:hover{color:var(--pc);background:#f2edfa}" +
      ".ppa .ppx{font-size:17px}" +
      ".ppa svg{width:15px;height:15px}" +
      ".ppf{background:#faf8fd;border:1px solid #ece3f6;border-radius:10px;padding:8px;margin-bottom:8px;display:flex;flex-direction:column;gap:6px}" +
      ".ppf input,.ppf textarea{border:1.5px solid #e6ddf1;border-radius:9px;padding:7px 9px;font-size:13px;outline:none;font-family:inherit;background:#fff;width:100%}" +
      ".ppf textarea{min-height:56px;resize:vertical}" +
      ".ppf input:focus,.ppf textarea:focus{border-color:var(--pc)}" +
      ".ppfb{display:flex;justify-content:flex-end;gap:6px}" +
      ".ppbtn{border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;background:var(--pc);color:#fff}" +
      ".ppbtn.ghost{background:#efe9f6;color:#5b5468}" +
      ".ppl{display:flex;flex-direction:column;gap:2px}" +
      ".ppe{font-size:12px;color:#8a7ea3;padding:8px 6px;line-height:1.4}" +
      ".ppi{display:flex;align-items:flex-start;gap:4px;border-radius:8px;padding:5px 6px}" +
      ".ppi:hover{background:#f6f2fc}" +
      ".ppuse{flex:1;min-width:0;text-align:left;background:none;border:none;cursor:pointer;padding:0;display:block}" +
      ".ppil{display:block;font-size:12px;font-weight:600;color:#201d26;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".ppit{display:block;font-size:12px;color:#7a7088;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".ppedit,.ppdel{background:none;border:none;cursor:pointer;color:#a99fbe;padding:3px;border-radius:6px;display:flex;flex:none}" +
      ".ppedit:hover{color:var(--pc);background:#f2edfa}" +
      ".ppdel:hover{color:#c0392b;background:#fbecea}" +
      ".ppedit svg,.ppdel svg{width:14px;height:14px}" +
      ".urow{display:flex;justify-content:flex-end;align-items:center;gap:6px;max-width:100%}" +
      ".savep{background:none;border:none;cursor:pointer;color:#b3a9c6;padding:4px;border-radius:7px;opacity:0;transition:opacity .15s,color .15s,background .15s;flex:none}" +
      ".urow:hover .savep{opacity:1}" +
      ".savep:hover{color:var(--pc);background:#f2edfa}" +
      ".savep.done{opacity:1;color:#3a9d5d}" +
      ".savep svg{width:14px;height:14px;display:block}" +
      // Anexos: botão (clipe), chips pendentes e chips na mensagem
      ".attb{background:none;border:1.5px solid #e6ddf1;color:#8a7ea3;border-radius:50%;width:44px;height:44px;flex:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:border-color .15s,color .15s,background .15s}" +
      ".attb svg{width:18px;height:18px}" +
      ".attb.rec{border-color:#c95788;color:#c95788;animation:pcpulse 1s infinite}" +
      ".attb:disabled{opacity:.5;cursor:default}" +
      "@keyframes pcpulse{50%{opacity:.5}}" +
      ".attb:hover{border-color:var(--pc);color:var(--pc);background:#faf8fd}" +
      ".attb svg{width:19px;height:19px}" +
      ".attz{display:none;flex-wrap:wrap;gap:6px;padding:8px 12px 0;background:#fff}" +
      ".attc{display:inline-flex;align-items:center;gap:6px;max-width:210px;background:#f2edfa;border:1px solid #e6ddf1;border-radius:10px;padding:5px 8px;font-size:12px;color:#4b4459}" +
      ".attc.up{opacity:.65}" +
      ".attc .atti{display:flex;flex:none;color:var(--pc)}.attc .atti svg{width:14px;height:14px}" +
      ".attc .attn{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".attc .attx{background:none;border:none;cursor:pointer;color:#8a7ea3;font-size:15px;line-height:1;padding:0 2px;flex:none}" +
      ".attc .attx:hover{color:#c0392b}" +
      ".attc .atts{color:#8a7ea3;flex:none}" +
      ".matts{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;max-width:100%}" +
      ".attc.ro{background:#efe8f8;max-width:82%}" +
      //  ".disc{padding:6px 14px 0;font-size:10px;line-height:1.35;color:#9a90b0;text-align:center;background:#fff}" +
      ".disc{padding:6px 14px 0;font-size:12px;line-height:1.35;color:#9a90b0;text-align:center;background:#fff}" +
      ".pw{padding:5px 12px 9px;font-size:10.5px;color:#a99fbe;text-align:center;background:#fff;letter-spacing:.02em}"
    );
  }

  var ICON_CHAT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var ICON_SEND =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
  // Ícone de PARAR (quadrado) — o botão de enviar vira "Parar" enquanto processa.
  var ICON_STOP =
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>';
  // Avatar do assistente: um brilho ("sparkle"), como nas referências.
  var ICON_BOT =
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.7 4.8L18 8.5l-4.3 1.7L12 15l-1.7-4.8L6 8.5l4.3-1.7L12 2z"/><path d="M19 13l.8 2.3L22 16l-2.2.8L19 19l-.8-2.2L16 16l2.2-.7L19 13z" opacity=".65"/></svg>';
  // Biblioteca de prompts salvos (só quando a visita traz o token de rastreio).
  var ICON_BOOKMARK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
  var ICON_PLUS =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  // Salvar resultado (disquete) e "meus relatórios" (grade/planilha).
  var ICON_SAVEREP =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
  var ICON_REPORTS =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="9" x2="9" y2="21"/></svg>';
  var ICON_CHART =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>';
  var ICON_DB =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>';
  var ICON_PENCIL =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  var ICON_TRASH =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
  var ICON_EXPAND =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
  var ICON_COLLAPSE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
  // Anexos de documento (Fase 3C).
  var ICON_CLIP =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
  var ICON_MIC =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
  var ICON_STOP =
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
  var ICON_PLAY =
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="7 4 20 12 7 20 7 4"/></svg>';
  var ICON_PAUSE =
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
  var ICON_FILE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  var ICON_IMG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
  function attIcon(a) {
    return a && a.mime && a.mime.indexOf("image/") === 0 ? ICON_IMG : ICON_FILE;
  }

  /**
   * Deriva a 2ª cor do gradiente a partir da primária configurada (mistura em
   * direção a um índigo vivo) — sem depender de color-mix p/ o gradiente.
   */
  function derive(hex) {
    var m = /^#?([0-9a-fA-F]{6})$/.exec((hex || "").trim());
    if (!m) return hex || "#511C76";
    var n = parseInt(m[1], 16);
    var r = (n >> 16) & 255,
      g = (n >> 8) & 255,
      b = n & 255;
    var tr = 0x6d,
      tg = 0x5a,
      tb = 0xe6;
    r = Math.round(r * 0.68 + tr * 0.32);
    g = Math.round(g * 0.68 + tg * 0.32);
    b = Math.round(b * 0.68 + tb * 0.32);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /**
   * Conteúdo da BOLHA fechada: o avatar/ícone configurado (para o ícone
   * escolhido no admin aparecer também na bolha, não só no cabeçalho); sem
   * avatar, o ícone de conversa padrão. Ícone (SVG) = centralizado; foto = preenche.
   */
  function bubbleInner() {
    // Imagem própria da BOLHA; se não houver, cai no avatar do bot; senão, ícone.
    var src = cfg.launcherUrl || cfg.avatarUrl;
    if (src) {
      var isSvg = src.indexOf("data:image/svg") === 0;
      return '<img src="' + esc(src) + '" alt="" class="' + (isSvg ? "bic" : "bimg") + '">';
    }
    return ICON_CHAT;
  }

  // Ensina o jQuery UI Dialog (usado pelo APEX) a PERMITIR interação com o widget:
  // sem isto, um dialog modal aberto rouba o foco do nosso textarea (não dá para
  // digitar). Idempotente; se o jQuery UI ainda não carregou, tenta de novo.
  function permitirNoModal(tentativas) {
    try {
      var jq = (window.apex && window.apex.jQuery) || window.jQuery || window.$;
      if (jq && jq.ui && jq.ui.dialog && jq.ui.dialog.prototype) {
        var proto = jq.ui.dialog.prototype;
        if (!proto.__kbAllow) {
          proto.__kbAllow = true;
          var orig = proto._allowInteraction;
          proto._allowInteraction = function (e) {
            try {
              if (e && e.target && e.target.closest && e.target.closest("[data-kb-widget]")) return true;
            } catch { }
            return orig ? orig.apply(this, arguments) : false;
          };
        }
        return;
      }
    } catch { }
    // jQuery UI ainda não disponível → tenta mais algumas vezes.
    if ((tentativas || 0) < 20) setTimeout(function () { permitirNoModal((tentativas || 0) + 1); }, 300);
  }

  // ==== Fase B: comparar a tela atual com um relatório SALVO (cruzar por chave) ====
  var _comparacao = null; // resultado do cruzamento p/ enviar no próximo ask
  // Intenção EXPLÍCITA de cruzar com um relatório SALVO (Meus relatórios salvos) —
  // NÃO é o Interactive Report da tela. Ex.: "compara com outro relatório salvo".
  function intencaoCompararSalvo(text) {
    var t = String(text || "").toLowerCase();
    return /(compar|cruz|confront)/.test(t) &&
      /(salv|guard|meus relat|outro relat|relat[óo]rio anterior|que (eu )?salvei|de (ontem|antes)|anterior)/.test(t);
  }
  // Intenção de ACESSAR/VER os relatórios salvos (sem comparar). Ex.: "me mostra meus
  // relatórios salvos", "quais relatórios eu salvei", "abre meus relatórios".
  function intencaoVerSalvos(text) {
    var t = String(text || "").toLowerCase().trim();
    var refSalvo = /meus\s+relat[óo]rios|relat[óo]rios?\s+salvos?|arquivos?\s+salvos?|relat[óo]rios?\s+(que\s+)?(eu\s+)?salvei/.test(t);
    if (!refSalvo) return false;
    var acesso = /(ver|abrir|abra|mostr|exib|acess|list|consult|quais|onde|me d[êe]|quero|ir para|vai para)/.test(t);
    var curto = t.split(/\s+/).length <= 4; // "meus relatórios salvos" isolado
    return acesso || curto;
  }
  // O usuário pediu explicitamente → abre o seletor de salvos direto (não manda à IA,
  // que interpretaria "relatório salvo" como o relatório da tela).
  function iniciarComparacaoExplicita(text, ids) {
    var rv = acharIRPaginado(document) || document.querySelector(".a-IRR-reportView, .a-IRR, .a-GV");
    if (!rv) { statusMsg("Para cruzar com um relatório salvo, abra uma tela com um relatório/dados e peça de novo.", "#b45309"); return; }
    escolherOutroSalvo(function (sel) { compararCom(sel, rv, ids); });
  }
  function escolherOutroSalvo(cb) {
    var m = widgetModal("Escolher relatório salvo", { wide: true });
    m.body.textContent = "Carregando…";
    apiSaved({ action: "list" }).then(function (r) {
      m.body.innerHTML = "";
      var itens = (r && r.ok && Array.isArray(r.itens)) ? r.itens : [];
      if (!itens.length) { m.body.textContent = "Nenhum relatório salvo ainda. Salve um resultado (ícone de tabela → Salvar) e depois compare."; return; }
      itens.forEach(function (it) {
        var row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid #eef0f2;border-radius:10px;margin-bottom:7px;cursor:pointer;";
        var mt = metaTipo(it);
        var ico = document.createElement("span"); ico.innerHTML = mt.icone; ico.style.cssText = "display:inline-flex;width:18px;height:18px;flex:none;color:" + mt.cor + ";";
        var sg = ico.querySelector("svg"); if (sg) { sg.setAttribute("width", "16"); sg.setAttribute("height", "16"); }
        var info = document.createElement("div"); info.style.cssText = "flex:1;min-width:0;";
        var nm = document.createElement("div"); nm.style.cssText = "font-weight:700;font-size:13px;color:#1f2937;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"; nm.textContent = it.name;
        var sub = document.createElement("div"); sub.style.cssText = "font-size:11px;color:#6b7280;"; sub.textContent = mt.ext + " · " + formatarData(it.created_at);
        info.appendChild(nm); info.appendChild(sub);
        row.appendChild(ico); row.appendChild(info);
        row.addEventListener("click", function () { m.fechar(); cb(it); });
        m.body.appendChild(row);
      });
    }).catch(function () { m.body.textContent = "Falha ao carregar."; });
  }
  // --- Apoio ao cruzamento: parse de arquivos salvos (CSV) e sugestão de chave ---
  function decodeBase64Utf8(b64) {
    try {
      var bin = atob(String(b64 || "")); var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder("utf-8").decode(bytes);
    } catch { return ""; }
  }
  function parseCSVrows(txt, delim) {
    var rows = [], row = [], cur = "", inQ = false;
    for (var i = 0; i < txt.length; i++) {
      var ch = txt[i];
      if (inQ) { if (ch === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += ch; }
      else if (ch === '"') inQ = true;
      else if (ch === delim) { row.push(cur); cur = ""; }
      else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (ch !== "\r") cur += ch;
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }
  function parseCSVtabela(txt) {
    txt = String(txt || "").replace(/^﻿/, "").replace(/^sep=(.)\r?\n/i, "");
    if (!txt.trim()) return null;
    var first = txt.split(/\r?\n/)[0] || "";
    var delim = (first.split(";").length > first.split(",").length) ? ";" : (first.split("\t").length > 1 ? "\t" : ",");
    var rows = parseCSVrows(txt, delim);
    if (!rows.length) return null;
    var colunas = (rows[0] || []).map(String);
    var linhas = rows.slice(1).filter(function (r) { return r.some(function (c) { return String(c).trim(); }); });
    return colunas.length ? { colunas: colunas, linhas: linhas } : null;
  }
  // Item salvo → {colunas,linhas}: report/chart usam columns/rows; CSV/texto é parseado;
  // binário (xlsx/pdf) → null (não dá pra cruzar por coluna aqui).
  function parseSalvoParaTabela(det) {
    if (Array.isArray(det.columns) && det.columns.length && Array.isArray(det.rows)) return { colunas: det.columns, linhas: det.rows };
    if (det.kind === "file" && det.content) {
      var mime = String(det.mime || ""), fn = String(det.file_name || det.name || "").toLowerCase();
      if (/csv|text|plain|tab-separated/i.test(mime) || /\.(csv|txt|tsv)$/.test(fn)) { var t = parseCSVtabela(decodeBase64Utf8(det.content)); if (t) return t; }
    }
    return null;
  }
  // Sugere o par de colunas-chave (de/para): 1º por NOME normalizado igual; senão pela
  // MAIOR sobreposição de VALORES (a chave costuma repetir nos dois). null = sem palpite.
  function sugerirChave(atual, salvo) {
    function norm(s) { return String(s == null ? "" : s).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
    var cA = atual.colunas || [], cB = salvo.colunas || [];
    for (var i = 0; i < cA.length; i++) for (var j = 0; j < cB.length; j++) if (norm(cA[i]) && norm(cA[i]) === norm(cB[j])) return { iA: i, iB: j };
    function setVals(linhas, idx) { var s = {}; for (var r = 0; r < Math.min(200, linhas.length); r++) { var v = norm(linhas[r][idx]); if (v) s[v] = 1; } return s; }
    var best = null, bestN = 0;
    for (var a = 0; a < cA.length; a++) {
      var sA = setVals(atual.linhas || [], a);
      for (var b = 0; b < cB.length; b++) {
        var sB = setVals(salvo.linhas || [], b), n = 0;
        for (var k in sA) if (sB[k]) n++;
        if (n > bestN) { bestN = n; best = { iA: a, iB: b }; }
      }
    }
    return bestN >= 2 ? best : null;
  }
  // "Desconsiderar o de/para": manda os dois conjuntos p/ a IA comparar livremente.
  function cruzarSemChave(atual, salvo, salvoItem, ids) {
    var CAP = 40;
    _comparacao = {
      semChave: true, nomeSalvo: salvoItem.name,
      colunas: atual.colunas, colunasSalvo: salvo.colunas,
      total_atual: (atual.linhas || []).length, total_salvo: (salvo.linhas || []).length,
      amostra_atual: (atual.linhas || []).slice(0, CAP),
      amostra_salvo: (salvo.linhas || []).slice(0, CAP),
    };
    statusMsg("✅ Vou comparar os dois conjuntos (sem vincular por coluna).", "#15803d");
    ask(undefined, ids);
  }
  // Cruza por COLUNA-CHAVE. `chaveMap`={iA,iB} força o par (de/para); senão auto-detecta
  // (MATRICULA/CPF/ID/CÓDIGO ou a 1ª comum). Sem coluna comum E sem chaveMap →
  // { erro:"sem-colunas-comuns" } (o chamador abre o de/para).
  function cruzarDados(atual, salvo, chaveMap) {
    function norm(s) { return String(s == null ? "" : s).trim().toLowerCase(); }
    var colsA = atual.colunas || [], colsB = salvo.colunas || [];
    var mapA = {}, mapB = {};
    colsA.forEach(function (c, i) { mapA[norm(c)] = i; });
    colsB.forEach(function (c, i) { mapB[norm(c)] = i; });
    var comuns = colsA.map(norm).filter(function (c) { return mapB[c] != null; });
    var iAk, iBk, chaveNome;
    if (chaveMap && chaveMap.iA != null && chaveMap.iB != null) {
      iAk = chaveMap.iA; iBk = chaveMap.iB;
      chaveNome = colsA[iAk] + (norm(colsA[iAk]) === norm(colsB[iBk]) ? "" : " ↔ " + colsB[iBk]);
    } else {
      if (!comuns.length) return { erro: "sem-colunas-comuns" };
      var pref = ["matricula", "matrícula", "cpf", "id", "codigo", "código", "matricula_esocial"];
      var chave = null;
      for (var i = 0; i < pref.length && !chave; i++) if (comuns.indexOf(pref[i]) >= 0) chave = pref[i];
      if (!chave) chave = comuns[0];
      iAk = mapA[chave]; iBk = mapB[chave]; chaveNome = colsA[iAk];
    }
    var nomeChaveA = norm(colsA[iAk]), nomeChaveB = norm(colsB[iBk]);
    var comunsSemChave = comuns.filter(function (c) { return c !== nomeChaveA && c !== nomeChaveB; });
    var idxB = {}; (salvo.linhas || []).forEach(function (r) { var k = norm(r[iBk]); if (k) idxB[k] = r; });
    var idxA = {}; (atual.linhas || []).forEach(function (r) { var k = norm(r[iAk]); if (k) idxA[k] = r; });
    var soAtual = [], soSalvo = [], ambos = 0, mudancas = [];
    (atual.linhas || []).forEach(function (rA) {
      var k = norm(rA[iAk]); if (!k) return;
      var rB = idxB[k];
      if (rB != null) {
        ambos++;
        var difs = [];
        comunsSemChave.forEach(function (c) {
          var va = String(rA[mapA[c]] == null ? "" : rA[mapA[c]]), vb = String(rB[mapB[c]] == null ? "" : rB[mapB[c]]);
          if (norm(va) !== norm(vb)) difs.push({ coluna: c, antes: vb, agora: va });
        });
        if (difs.length) mudancas.push({ chave: rA[iAk], difs: difs });
      } else soAtual.push(rA);
    });
    (salvo.linhas || []).forEach(function (rB) { var k = norm(rB[iBk]); if (k && idxA[k] == null) soSalvo.push(rB); });
    return {
      chave: chaveNome, colunasAtual: colsA,
      total_atual: (atual.linhas || []).length, total_salvo: (salvo.linhas || []).length, em_ambos: ambos,
      so_no_atual: soAtual, so_no_salvo: soSalvo, mudancas: mudancas,
    };
  }
  // Resultado do cruzamento → contexto p/ a IA (amostras cap 40) + status + reenvia.
  function aplicarCruzamento(cruz, salvoItem, ids) {
    var CAP = 40;
    _comparacao = {
      nomeSalvo: salvoItem.name, chave: cruz.chave, colunas: cruz.colunasAtual,
      total_atual: cruz.total_atual, total_salvo: cruz.total_salvo, em_ambos: cruz.em_ambos,
      so_no_atual: cruz.so_no_atual.length, so_no_salvo: cruz.so_no_salvo.length, mudancas: cruz.mudancas.length,
      amostra_so_no_atual: cruz.so_no_atual.slice(0, CAP),
      amostra_so_no_salvo: cruz.so_no_salvo.slice(0, CAP),
      amostra_mudancas: cruz.mudancas.slice(0, CAP),
    };
    statusMsg("✅ Cruzei por “" + cruz.chave + "”: " + cruz.so_no_atual.length + " só nesta tela, " + cruz.so_no_salvo.length + " só no salvo, " + cruz.em_ambos + " em ambos (" + cruz.mudancas.length + " com mudança).", "#15803d");
    ask(undefined, ids);
  }
  // Modal DE/PARA: sem coluna comum automática, o usuário escolhe qual coluna da tela ↔
  // qual do salvo identifica o MESMO registro (com amostra de valores para ajudar).
  function abrirDeParaModal(atual, salvo, salvoItem, ids, rv) {
    var m = widgetModal("Como cruzar os dados?", { wide: true });
    var sug = sugerirChave(atual, salvo); // palpite automático (nome/valores)
    var intro = document.createElement("div");
    intro.style.cssText = "font-size:12.5px;color:#374151;margin-bottom:14px;line-height:1.5;";
    intro.textContent = sug
      ? "Sugeri automaticamente as colunas que parecem identificar o MESMO registro. Confira e confirme (ou ajuste):"
      : "Escolha a coluna que identifica o MESMO registro nos dois (ex.: Matrícula ↔ Código do funcionário):";
    m.body.appendChild(intro);
    var grid = document.createElement("div"); grid.style.cssText = "display:grid;grid-template-columns:1fr 28px 1fr;gap:8px;align-items:start;";
    function lado(titulo, cols, linhas, sel0) {
      var wrap = document.createElement("div");
      var lb = document.createElement("div"); lb.style.cssText = "font-size:11px;font-weight:700;color:#6b7280;margin-bottom:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"; lb.textContent = titulo;
      var sel = document.createElement("select"); sel.style.cssText = "width:100%;padding:8px;border:1px solid #d1d5db;border-radius:9px;font-size:13px;box-sizing:border-box;";
      (cols || []).forEach(function (c, i) { var o = document.createElement("option"); o.value = String(i); o.textContent = c; if (i === sel0) o.selected = true; sel.appendChild(o); });
      var am = document.createElement("div"); am.style.cssText = "font-size:11px;color:#6b7280;margin-top:5px;line-height:1.5;word-break:break-word;";
      function upd() { var i = Number(sel.value), vals = []; for (var r = 0; r < Math.min(3, (linhas || []).length); r++) { var v = linhas[r][i]; if (v != null && String(v).trim()) vals.push(String(v)); } am.textContent = vals.length ? "Ex.: " + vals.join(", ") : ""; }
      sel.addEventListener("change", upd); setTimeout(upd, 0);
      wrap.appendChild(lb); wrap.appendChild(sel); wrap.appendChild(am);
      return { wrap: wrap, sel: sel };
    }
    var la = lado("Tela atual", atual.colunas, atual.linhas, sug ? sug.iA : 0);
    var seta = document.createElement("div"); seta.style.cssText = "text-align:center;font-size:16px;color:#9ca3af;padding-top:24px;"; seta.textContent = "↔";
    var lc = lado("Salvo: " + salvoItem.name, salvo.colunas, salvo.linhas, sug ? sug.iB : 0);
    grid.appendChild(la.wrap); grid.appendChild(seta); grid.appendChild(lc.wrap);
    m.body.appendChild(grid);
    var row = document.createElement("div"); row.style.cssText = "display:flex;gap:8px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap;";
    var voltar = tutBtn("Trocar arquivo", false);
    var semv = tutBtn("Sem vincular", false);
    var ok = tutBtn("Cruzar", true);
    voltar.addEventListener("click", function () { m.fechar(); escolherOutroSalvo(function (sel) { compararCom(sel, rv, ids); }); });
    semv.title = "Comparar os dois conjuntos sem casar por coluna";
    semv.addEventListener("click", function () { m.fechar(); cruzarSemChave(atual, salvo, salvoItem, ids); });
    ok.addEventListener("click", function () {
      var chaveMap = { iA: Number(la.sel.value), iB: Number(lc.sel.value) };
      m.fechar();
      var cruz = cruzarDados(atual, salvo, chaveMap);
      if (cruz.erro) { toastWidget("Não consegui cruzar com essas colunas.", true); ask(undefined, ids); return; }
      aplicarCruzamento(cruz, salvoItem, ids);
    });
    row.appendChild(voltar); row.appendChild(semv); row.appendChild(ok);
    m.body.appendChild(row);
  }
  async function compararCom(salvoItem, rv, ids) {
    procStatus("Cruzando os dados com “" + salvoItem.name + "”", null);
    var atual = await coletarAtual();
    if (!atual) { limparProcStatus(); toastWidget("Não consegui ler os dados desta tela para comparar.", true); ask(undefined, ids); return; }
    var det = await apiSaved({ action: "get", id: salvoItem.id });
    limparProcStatus();
    if (!det || !det.ok) { toastWidget("Não consegui abrir o relatório salvo.", true); ask(undefined, ids); return; }
    var salvo = parseSalvoParaTabela(det);
    if (!salvo) {
      // arquivo não tabular (Excel/PDF binário) → não dá pra ler colunas aqui p/ cruzar.
      toastWidget("Não consigo ler as colunas desse arquivo aqui (Excel/PDF). Escolha um relatório salvo tabular ou um CSV.", true);
      escolherOutroSalvo(function (sel) { compararCom(sel, rv, ids); });
      return;
    }
    var cruz = cruzarDados(atual, salvo);
    if (cruz.erro === "sem-colunas-comuns") { abrirDeParaModal(atual, salvo, salvoItem, ids, rv); return; } // de/para
    if (cruz.erro) { toastWidget(cruz.erro, true); ask(undefined, ids); return; }
    aplicarCruzamento(cruz, salvoItem, ids);
  }

  // ==== Menu suspenso de Relatórios (um botão → Salvar / Relatórios salvos) ====
  var _reportsMenu = null, _reportsBtn = null;
  function fecharMenuRelatorios() {
    if (_reportsMenu) { try { _reportsMenu.remove(); } catch (e) { } _reportsMenu = null; }
    _reportsBtn = null;
    document.removeEventListener("click", _reportsFora, true);
  }
  function _reportsFora(e) {
    if (_reportsMenu && !_reportsMenu.contains(e.target) && (!_reportsBtn || !_reportsBtn.contains(e.target))) fecharMenuRelatorios();
  }
  function abrirMenuRelatorios(btn) {
    if (_reportsMenu) { fecharMenuRelatorios(); return; } // toggle
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var menu = document.createElement("div");
    menu.style.cssText = "position:absolute;z-index:78;background:#fff;border:1px solid #e5e7eb;border-radius:11px;box-shadow:0 12px 30px rgba(0,0,0,.18);padding:6px;min-width:200px;";
    function item(icone, texto, fn) {
      var b = document.createElement("button"); b.type = "button";
      b.style.cssText = "display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;border:0;background:transparent;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;color:#374151;text-align:left;";
      var ic = document.createElement("span"); ic.innerHTML = icone; ic.style.cssText = "display:inline-flex;width:16px;height:16px;flex:none;color:" + pc + ";";
      var svg = ic.querySelector("svg"); if (svg) { svg.setAttribute("width", "16"); svg.setAttribute("height", "16"); }
      var tx = document.createElement("span"); tx.textContent = texto;
      b.appendChild(ic); b.appendChild(tx);
      b.addEventListener("mouseenter", function () { b.style.background = pc + "12"; });
      b.addEventListener("mouseleave", function () { b.style.background = "transparent"; });
      b.addEventListener("click", function (e) { e.stopPropagation(); fecharMenuRelatorios(); fn(); });
      return b;
    }
    menu.appendChild(item(ICON_SAVEREP, "Salvar resultado", salvarResultado));
    menu.appendChild(item(ICON_REPORTS, "Relatórios salvos", abrirRelatoriosSalvos));
    (panel || root).appendChild(menu);
    _reportsMenu = menu; _reportsBtn = btn;
    try {
      var rb = btn.getBoundingClientRect(), rp = (panel || root).getBoundingClientRect();
      var top = rb.bottom - rp.top + 6;
      var left = Math.min(rb.left - rp.left, rp.width - menu.offsetWidth - 10);
      menu.style.top = top + "px"; menu.style.left = Math.max(8, left) + "px";
    } catch (e) { }
    setTimeout(function () { document.addEventListener("click", _reportsFora, true); }, 0);
  }

  // ==== Relatórios salvos (Fase A: salvar/listar/ver/exportar/apagar) ====
  // Fala com /api/v1/saved-reports (o servidor valida a chave + o rastreio e grava
  // no banco em nome do usuário). O widget NUNCA toca o banco direto.
  async function apiSaved(payload) {
    try {
      var resp = await fetch(API + "/api/v1/saved-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Widget-Key": KEY },
        body: JSON.stringify(Object.assign({ key: KEY, track: track }, payload)),
      });
      return await resp.json().catch(function () { return null; });
    } catch (e) { return null; }
  }
  // Persiste o CONJUNTO coletado do relatório por id (Fase F1). Mesma auth do saved-reports
  // (o servidor valida a chave + o rastreio e grava no ESCOPO do usuário).
  async function apiDataset(payload) {
    try {
      var resp = await fetch(API + "/api/v1/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Widget-Key": KEY },
        body: JSON.stringify(Object.assign({ key: KEY, track: track }, payload)),
      });
      return await resp.json().catch(function () { return null; });
    } catch (e) { return null; }
  }
  // Salva o conjunto coletado UMA vez (em 2º plano) e guarda o id no cache, para os
  // PRÓXIMOS turnos mandarem só o id em vez de reenviar todas as linhas. Idempotente
  // (a rota faz upsert por client_key). O escopo do usuário é garantido no servidor.
  async function persistirDataset(c) {
    if (!c || !c.linhas || !c.linhas.length || c.dsId || c._saving) return;
    c._saving = true;
    try {
      var r = await apiDataset({ action: "save", clientKey: (c.key || "") + ":" + (c.fp || ""), sourceName: c.nome, columns: c.colunas, rows: c.linhas, total: c.total || c.linhas.length });
      if (r && r.ok && r.id) { c.dsId = r.id; diag("dataset persistido id=" + r.id + " — próximos turnos mandam só o id"); }
      else if (r && r.erro) diag("dataset não persistido: " + r.erro);
    } catch (e) { diag("dataset persist falhou: " + (e && e.message)); }
    finally { c._saving = false; }
  }
  // Estado do job de ANÁLISE SEMÂNTICA (modo B) — mesma auth do saved-reports.
  async function apiAnalysisJob(payload) {
    try {
      var resp = await fetch(API + "/api/v1/analysis-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Widget-Key": KEY },
        body: JSON.stringify(Object.assign({ key: KEY, track: track }, payload)),
      });
      return await resp.json().catch(function () { return null; });
    } catch (e) { return null; }
  }
  // Acompanha a análise profunda (modo B) por POLLING (o widget é anônimo, sem Realtime)
  // e renderiza o resultado no chat quando conclui. O worker também posta na conversa,
  // então a resposta sobrevive a um reload.
  function iniciarAcompanhamentoAnalise(jobId, estimate, criterio, coluna) {
    if (!jobId) { addMsg("assistant", "Não consegui iniciar a análise profunda agora. Tente novamente."); return; }
    var mins = estimate && estimate.segundos ? Math.max(1, Math.round(estimate.segundos / 60)) : 1;
    var nreg = estimate && estimate.linhas ? estimate.linhas : 0;
    var statusEl = addMsg("assistant", "");
    statusEl.innerHTML = mdToHtml("🔎 **Análise profunda iniciada** — lendo e classificando " + (nreg ? nreg.toLocaleString("pt-BR") + " registro(s)" : "os registros") + (coluna ? " da coluna *" + coluna + "*" : "") + ". Pode levar ~" + mins + " min; aviso aqui quando terminar.");
    var tentativas = 0;
    var poll = function () {
      tentativas++;
      apiAnalysisJob({ action: "get", id: jobId }).then(function (r) {
        if (!r || !r.ok) { if (tentativas < 200) setTimeout(poll, 3000); else statusEl.innerHTML = mdToHtml("Não consegui acompanhar a análise; ela pode ainda estar rodando."); return; }
        if (r.status === "done") {
          var res = r.result || {};
          var texto = res.narrativa || "Análise concluída.";
          if (res.distribuicao && typeof res.distribuicao === "object") {
            var dist = Object.keys(res.distribuicao).map(function (k) { return "- **" + k + "**: " + res.distribuicao[k]; }).join("\n");
            if (dist) texto += "\n\n**Distribuição (100% dos registros analisados):**\n" + dist;
          }
          statusEl.innerHTML = mdToHtml(texto);
          avisarMensagem();
          try { messagesEl.scrollTop = messagesEl.scrollHeight; } catch (e) { }
          return;
        }
        if (r.status === "error") { statusEl.innerHTML = mdToHtml("A análise falhou: " + (r.error || "erro desconhecido") + "."); return; }
        var pct = typeof r.progress === "number" ? r.progress : 0;
        statusEl.innerHTML = mdToHtml("🔎 **Analisando…** " + pct + "% (" + (r.processed || 0) + "/" + (r.total || nreg) + "). Aviso aqui quando terminar.");
        if (tentativas < 300) setTimeout(poll, 3000);
      }).catch(function () { if (tentativas < 200) setTimeout(poll, 3000); });
    };
    setTimeout(poll, 3000);
  }
  // Toast curto dentro do painel (sucesso/erro), sem poluir a conversa.
  function toastWidget(msg, erro) {
    var raiz = (messagesEl.getRootNode && messagesEl.getRootNode()) || document.body;
    var t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText =
      "position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:2147483647;padding:9px 16px;border-radius:20px;" +
      "font-size:12.5px;font-weight:700;color:#fff;background:" + (erro ? "#b45309" : "#15803d") + ";box-shadow:0 8px 22px rgba(0,0,0,.3);max-width:88vw;text-align:center;";
    raiz.appendChild(t);
    setTimeout(function () { try { t.remove(); } catch (e) { } }, 3200);
  }
  // Modal genérica do widget. Renderiza no NÍVEL do shadow root (fixed, z-index máximo)
  // para ficar SEMPRE por cima — inclusive do gráfico expandido (que também usa z máximo).
  function widgetModal(titulo, opts) {
    opts = opts || {};
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var raiz = (messagesEl.getRootNode && messagesEl.getRootNode()) || document.body;
    var ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(15,15,25,.42);padding:16px;";
    var box = document.createElement("div");
    box.style.cssText = "background:#fff;border-radius:16px;width:100%;max-width:" + (opts.wide ? "600px" : "430px") + ";max-height:90%;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 55px rgba(0,0,0,.32);";
    var hd = document.createElement("div");
    hd.style.cssText = "display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #eef0f2;";
    var t = document.createElement("div");
    t.style.cssText = "font-weight:800;font-size:14px;color:" + pc + ";flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
    t.textContent = titulo || "";
    var x = document.createElement("button");
    x.type = "button"; x.innerHTML = "&times;"; x.setAttribute("aria-label", "Fechar");
    x.style.cssText = "border:0;background:transparent;font-size:22px;line-height:1;cursor:pointer;color:#6b7280;flex:none;";
    var body = document.createElement("div");
    body.style.cssText = "padding:13px 14px;overflow:auto;";
    hd.appendChild(t); hd.appendChild(x); box.appendChild(hd); box.appendChild(body); ov.appendChild(box);
    function fechar() { try { ov.remove(); } catch (e) { } }
    x.addEventListener("click", fechar);
    ov.addEventListener("click", function (e) { if (e.target === ov) fechar(); });
    raiz.appendChild(ov);
    return { ov: ov, box: box, body: body, tituloEl: t, fechar: fechar };
  }
  function pad2(n) { return ("0" + n).slice(-2); }
  function formatarData(iso) {
    try { var d = new Date(iso); if (isNaN(d.getTime())) return ""; return pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + d.getFullYear() + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()); } catch (e) { return ""; }
  }
  // Termo/filtro corrente do IR (p/ sugerir o nome ao salvar).
  function termoFiltroAtual() {
    try {
      var rv = document.querySelector(".a-IRR-reportView, .a-IRR");
      if (!rv) return "";
      var rots = rotulosFiltro(rv);
      if (rots.length) return rots.join("; ").slice(0, 60);
      var s = rv.querySelector(".a-IRR-search-field, input[id$='_search_field']");
      return s && s.value ? String(s.value).slice(0, 40) : "";
    } catch (e) { return ""; }
  }
  function sugerirNome(dados) {
    var d = new Date();
    var data = pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    var filtro = termoFiltroAtual();
    return ((dados.nome || "Relatório") + (filtro ? " — " + filtro : "") + " — " + data).slice(0, 120);
  }
  // Coleta o resultado ATUAL da tela (reusa cache; senão processo in-session; senão DOM).
  async function coletarAtual() {
    var rv = acharIRPaginado(document) || document.querySelector(".a-IRR-reportView, .a-IRR, .a-GV");
    if (!rv) return null;
    var key = regionKey(rv), fp = fingerprintRelatorio(rv);
    if (_harvestCache && _harvestCache.key === key && _harvestCache.fp === fp && _harvestCache.linhas && _harvestCache.linhas.length) {
      return { nome: _harvestCache.nome, colunas: _harvestCache.colunas, linhas: _harvestCache.linhas, total: _harvestCache.total };
    }
    var rp = await coletarProcessoDedup(rv, key, fp);
    if (!rp || !rp.linhas.length) { try { rp = await coletarRelatorio(rv); } catch (e) { rp = null; } }
    if (!rp || !rp.linhas.length) return null;
    _harvestCache = { key: key, fp: fp, nome: nomeRegiao(rv) || "Relatório", colunas: rp.colunas, linhas: rp.linhas, total: rp.total || rp.linhas.length, incompleto: !!rp.truncou };
    return { nome: _harvestCache.nome, colunas: rp.colunas, linhas: rp.linhas, total: _harvestCache.total };
  }

  // PRÉ-AQUECIMENTO: assim que o IR é filtrado/submetido, coleta os dados em
  // BACKGROUND e guarda no cache — a próxima pergunta fica instantânea, sem clicar
  // em nada. Roda mesmo com o widget fechado (decisão do usuário). O cache é em
  // memória: ao sair/recarregar a página, some sozinho.
  var _preAqBusy = false, _preAqTimer = 0;
  function preAquecer() {
    if (_preAqBusy) return;
    var A = window.apex;
    if (!A || !A.server || typeof A.server.process !== "function") return; // só in-session (host APEX)
    var rv = acharIRPaginado(document) || document.querySelector(".a-IRR-reportView, .a-IRR, .a-GV");
    if (!rv) return;
    var key = regionKey(rv), fp = fingerprintRelatorio(rv);
    // Nada mudou desde a última coleta (mesma impressão digital) → já está em cache.
    if (_harvestCache && _harvestCache.key === key && _harvestCache.fp === fp && _harvestCache.linhas && _harvestCache.linhas.length) return;
    _preAqBusy = true;
    coletarProcessoDedup(rv, key, fp).then(function (rp) {
      if (rp && rp.linhas && rp.linhas.length) {
        _harvestCache = { key: key, fp: fp, nome: nomeRegiao(rv) || "Relatório", colunas: rp.colunas, linhas: rp.linhas, total: rp.total || rp.linhas.length, incompleto: !!rp.truncou };
        diag("pré-aquecido: " + _harvestCache.total + " linha(s) em cache");
      }
    }).catch(function () { }).then(function () { _preAqBusy = false; });
  }
  function agendarPreAquecer() {
    try { if (_preAqTimer) clearTimeout(_preAqTimer); } catch { }
    _preAqTimer = setTimeout(preAquecer, 700); // debounce: um filtro pode disparar vários refresh
  }
  // Liga no evento nativo do APEX (dispara após filtro, busca, ordenação, paginação
  // e submit que atualizam o IR/IG). Delegado no document → pega regiões criadas
  // depois. A própria preAquecer decide, pela impressão digital, se há algo novo.
  function setupPreAquecimento() {
    try {
      var A = window.apex;
      if (!A || !A.jQuery) return; // host não-APEX: sem pré-aquecimento
      A.jQuery(document).on("apexafterrefresh", agendarPreAquecer);
      setTimeout(preAquecer, 1800); // aquece uma vez ao carregar (1ª pergunta também instantânea)
    } catch { }
  }

  // Modal genérica de "dar um nome e salvar". onConfirm(nome) → Promise do apiSaved.
  function promptNome(titulo, sugestao, info, onConfirm) {
    var m = widgetModal(titulo || "Salvar");
    var lbl = document.createElement("div"); lbl.textContent = "Nome"; lbl.style.cssText = "font-size:12px;font-weight:700;color:#374151;margin-bottom:6px;";
    var inp = document.createElement("input"); inp.type = "text"; inp.maxLength = 120; inp.value = sugestao || "";
    inp.style.cssText = "width:100%;padding:9px 11px;border:1px solid #d1d5db;border-radius:9px;font-size:13px;box-sizing:border-box;";
    var inf = document.createElement("div"); inf.style.cssText = "font-size:11.5px;color:#6b7280;margin-top:8px;"; inf.textContent = info || "";
    var row = document.createElement("div"); row.style.cssText = "display:flex;gap:8px;justify-content:flex-end;margin-top:14px;";
    var cancelar = tutBtn("Cancelar", false); var salvar = tutBtn("Salvar", true);
    row.appendChild(cancelar); row.appendChild(salvar);
    m.body.appendChild(lbl); m.body.appendChild(inp); m.body.appendChild(inf); m.body.appendChild(row);
    cancelar.addEventListener("click", m.fechar);
    salvar.addEventListener("click", async function () {
      var nome = (inp.value || "").trim();
      if (!nome) { inp.focus(); return; }
      salvar.disabled = true; cancelar.disabled = true;
      salvar.textContent = ""; salvar.appendChild(spinnerEl("#fff", 13));
      var slbl = document.createElement("span"); slbl.textContent = "Salvando…"; slbl.style.marginLeft = "7px"; salvar.appendChild(slbl);
      salvar.style.display = "inline-flex"; salvar.style.alignItems = "center";
      var r = await onConfirm(nome);
      if (r && r.ok) { if (r.id) _ultimoSalvo = { id: r.id, name: r.name, created_at: r.created_at }; m.fechar(); toastWidget("Salvo em Meus relatórios."); }
      else { salvar.disabled = false; cancelar.disabled = false; salvar.style.display = ""; salvar.textContent = "Salvar"; toastWidget((r && r.erro) || "Falha ao salvar.", true); }
    });
    setTimeout(function () { try { inp.focus(); inp.select(); } catch (e) { } }, 60);
  }
  function nomeComData(base) {
    var d = new Date();
    return (String(base || "Item") + " — " + pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes())).slice(0, 120);
  }
  // Salvar RESULTADO (dados tabulares do relatório).
  async function salvarResultado() {
    var dados = (_harvestCache && _harvestCache.linhas && _harvestCache.linhas.length)
      ? { nome: _harvestCache.nome, colunas: _harvestCache.colunas, linhas: _harvestCache.linhas, total: _harvestCache.total }
      : null;
    if (!dados) {
      var sp = statusSpin("Preparando os dados para salvar…");
      try { dados = await coletarAtual(); } finally { try { sp.remove(); } catch { } }
    }
    if (!dados) { toastWidget("Faça uma pesquisa no relatório antes de salvar.", true); return; }
    promptNome("Salvar resultado", sugerirNome(dados),
      (dados.total || dados.linhas.length) + " registro(s) · " + dados.colunas.length + " coluna(s)",
      function (nome) { return apiSaved({ action: "save", kind: "report", name: nome, sourceName: dados.nome, columns: dados.colunas, rows: dados.linhas, total: dados.total || dados.linhas.length }); });
  }
  // Salvar ARQUIVO gerado (xlsx/pptx/docx/pdf/csv…). Extrai o conteúdo do data URL
  // (arquivo recém-gerado) ou busca a URL (histórico).
  async function salvarArquivo(href, filename, origem) {
    var mime = "", b64 = "", sp = null;
    try {
      if (/^data:/i.test(href)) {
        mime = (href.match(/^data:([^;,]+)/) || ["", ""])[1] || "";
        b64 = href.split(",")[1] || "";
      } else {
        sp = statusSpin("Preparando o arquivo…");
        var resp = await fetch(href); var blob = await resp.blob(); mime = blob.type || "";
        b64 = await new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(String(fr.result).split(",")[1] || ""); }; fr.onerror = rej; fr.readAsDataURL(blob); });
      }
    } catch { } finally { if (sp) { try { sp.remove(); } catch { } } }
    if (!b64) { toastWidget("Não consegui ler o arquivo para salvar.", true); return; }
    var base = String(filename || "arquivo").replace(/\.[a-z0-9]+$/i, "");
    var ext = (String(filename || "").match(/\.([a-z0-9]+)$/i) || ["", ""])[1];
    promptNome("Salvar arquivo", nomeComData(base),
      (ext ? ext.toUpperCase() + " · " : "") + Math.round(b64.length * 0.75 / 1024) + " KB",
      function (nome) { return apiSaved({ action: "save", kind: "file", name: nome, fileName: filename, mime: mime, content: b64, origem: origem === "upload" ? "upload" : "gerado" }); });
  }
  // Tabela do gráfico (colunas/linhas) — mesmo formato do CSV/aba Tabela.
  function chartToTabela(spec) {
    var colunas = ["Categoria"].concat((spec.series || []).map(function (s) { return String(s.nome); }));
    var linhas = (spec.categorias || []).map(function (c, r) {
      return [String(c)].concat((spec.series || []).map(function (s) { return s.valores[r] == null ? "" : String(s.valores[r]); }));
    });
    return { colunas: colunas, linhas: linhas };
  }
  // Salvar GRÁFICO: guarda a spec (re-renderiza) + a TABELA (colunas/linhas) p/ CSV.
  function salvarGrafico(spec) {
    var tab = chartToTabela(spec);
    promptNome("Salvar gráfico", nomeComData(spec.titulo || "Gráfico"),
      "Gráfico" + (spec.tipo ? " (" + spec.tipo + ")" : "") + " + tabela (" + tab.linhas.length + " linha(s))",
      function (nome) { return apiSaved({ action: "save", kind: "chart", name: nome, sourceName: spec.titulo || "Gráfico", chart: spec, columns: tab.colunas, rows: tab.linhas, total: tab.linhas.length }); });
  }
  // Ícone + cor + rótulo por tipo do item salvo (para a listagem).
  function metaTipo(it) {
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    if (it.kind === "chart") return { icone: ICON_CHART, cor: "#c95788", ext: "Gráfico" };
    if (it.kind === "file") {
      var fn = String(it.file_name || it.name || "").toLowerCase(), mm = String(it.mime || "").toLowerCase();
      if (/sheet|excel|xls/.test(mm) || /xlsx?$/.test(fn)) return { icone: ICON_FILE, cor: "#207245", ext: "XLSX" };
      if (/pdf/.test(mm) || /pdf$/.test(fn)) return { icone: ICON_FILE, cor: "#c0392b", ext: "PDF" };
      if (/word|document/.test(mm) || /docx?$/.test(fn)) return { icone: ICON_FILE, cor: "#2b5797", ext: "DOCX" };
      if (/presentation|powerpoint|ppt/.test(mm) || /pptx?$/.test(fn)) return { icone: ICON_FILE, cor: "#d24726", ext: "PPTX" };
      if (/csv/.test(mm) || /csv$/.test(fn)) return { icone: ICON_FILE, cor: "#0a8f6b", ext: "CSV" };
      var e = (fn.match(/\.([a-z0-9]+)$/) || ["", ""])[1];
      return { icone: ICON_FILE, cor: "#6b7280", ext: (e || "ARQ").toUpperCase() };
    }
    return { icone: ICON_REPORTS, cor: pc, ext: "Tabela" };
  }
  // Categoria do item salvo — para o filtro "Tipo" da listagem.
  function categoriaSalvo(it) {
    if (it.kind === "chart") return "grafico";
    if (!it.kind || it.kind === "report") return "tabela";
    var fn = String(it.file_name || it.name || "").toLowerCase(), mm = String(it.mime || "").toLowerCase();
    if (/sheet|excel|xls|csv/.test(mm) || /\.(xlsx?|csv)$/.test(fn)) return "planilha";
    if (/pdf/.test(mm) || /\.pdf$/.test(fn)) return "pdf";
    if (/word|document/.test(mm) || /\.docx?$/.test(fn)) return "word";
    if (/presentation|powerpoint|ppt/.test(mm) || /\.pptx?$/.test(fn)) return "ppt";
    return "outro";
  }
  // Botão "Apagar" (2 cliques) que fecha a modal ao concluir.
  function botaoApagarSalvo(id, m) {
    var del = tutBtn("Apagar", false); del.style.borderColor = "#b4530955"; del.style.color = "#b45309";
    var armado = false;
    del.addEventListener("click", async function () {
      if (!armado) { armado = true; del.textContent = "Confirmar apagar"; setTimeout(function () { armado = false; del.textContent = "Apagar"; }, 2500); return; }
      del.disabled = true;
      var dr = await apiSaved({ action: "delete", id: id });
      if (dr && dr.ok) { m.fechar(); toastWidget("Apagado."); } else { del.disabled = false; toastWidget("Falha ao apagar.", true); }
    });
    return del;
  }
  async function abrirRelatoriosSalvos() {
    var m = widgetModal("Meus relatórios salvos", { wide: true });
    m.body.textContent = "Carregando…";
    var r = await apiSaved({ action: "list" });
    m.body.innerHTML = "";
    if (!r || !r.ok) { m.body.textContent = ((r && r.erro) || "Falha ao carregar.") + (r && r.detalhe ? " (" + r.detalhe + ")" : ""); return; }
    var itens = r.itens || [];
    if (!itens.length) {
      var e = document.createElement("div");
      e.style.cssText = "color:#6b7280;font-size:13px;text-align:center;padding:22px 8px;";
      e.textContent = "Nenhum relatório salvo ainda. Faça uma pesquisa e clique em “Salvar resultado”.";
      m.body.appendChild(e); return;
    }
    // FILTROS enxutos (fixos no topo): busca por nome em destaque; tipo + intervalo
    // de datas numa 2ª linha compacta que quebra bem — sem virar um aglomerado.
    var bar = document.createElement("div");
    bar.style.cssText = "position:sticky;top:0;background:#fff;z-index:3;padding:0 0 8px;margin:-2px 0 6px;border-bottom:1px solid #f1f2f4;";
    var busca = document.createElement("input"); busca.type = "search"; busca.placeholder = "🔍  Buscar pelo nome do arquivo…";
    busca.style.cssText = "width:100%;padding:8px 11px;border:1px solid #e5e7eb;border-radius:9px;font-size:13px;box-sizing:border-box;";
    var linha2 = document.createElement("div"); linha2.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;align-items:center;";
    var tipo = document.createElement("select");
    tipo.style.cssText = "flex:1 1 120px;min-width:110px;padding:6px 8px;border:1px solid #e5e7eb;border-radius:8px;font-size:12px;color:#374151;background:#fff;cursor:pointer;";
    [["", "Todos os tipos"], ["tabela", "Tabela"], ["grafico", "Gráfico"], ["planilha", "Planilha"], ["pdf", "PDF"], ["word", "Word"], ["ppt", "PowerPoint"], ["outro", "Outro arquivo"]].forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; tipo.appendChild(op); });
    var estiloData = "padding:6px 8px;border:1px solid #e5e7eb;border-radius:8px;font-size:12px;color:#374151;min-width:0;flex:0 1 auto;";
    var de = document.createElement("input"); de.type = "date"; de.title = "Data inicial"; de.setAttribute("aria-label", "Data inicial"); de.style.cssText = estiloData;
    var seta = document.createElement("span"); seta.textContent = "→"; seta.style.cssText = "color:#9ca3af;font-size:12px;flex:none;";
    var ate = document.createElement("input"); ate.type = "date"; ate.title = "Data final"; ate.setAttribute("aria-label", "Data final"); ate.style.cssText = estiloData;
    linha2.appendChild(tipo); linha2.appendChild(de); linha2.appendChild(seta); linha2.appendChild(ate);
    bar.appendChild(busca); bar.appendChild(linha2);
    m.body.appendChild(bar);
    var contador = document.createElement("div"); contador.style.cssText = "font-size:11px;color:#9ca3af;margin:0 2px 8px;";
    m.body.appendChild(contador);
    var lista = document.createElement("div"); m.body.appendChild(lista);

    function normaliza(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
    function passa(it) {
      var q = normaliza(busca.value.trim());
      if (q && normaliza(it.name).indexOf(q) < 0 && normaliza(it.file_name).indexOf(q) < 0) return false;
      if (tipo.value && categoriaSalvo(it) !== tipo.value) return false;
      var d = String(it.created_at || "").slice(0, 10);
      if (de.value && d < de.value) return false;
      if (ate.value && d > ate.value) return false;
      return true;
    }
    function linhaSalvo(it) {
      var row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #eef0f2;border-radius:10px;margin-bottom:8px;cursor:pointer;";
      var mt = metaTipo(it);
      var ico = document.createElement("span"); ico.innerHTML = mt.icone;
      ico.style.cssText = "display:inline-flex;width:20px;height:20px;flex:none;color:" + mt.cor + ";";
      var sg = ico.querySelector("svg"); if (sg) { sg.setAttribute("width", "18"); sg.setAttribute("height", "18"); }
      var info = document.createElement("div"); info.style.cssText = "flex:1;min-width:0;";
      var nm = document.createElement("div"); nm.style.cssText = "font-weight:700;font-size:13px;color:#1f2937;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"; nm.textContent = it.name;
      var sub = document.createElement("div"); sub.style.cssText = "font-size:11px;color:#6b7280;margin-top:2px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;";
      if (it.origem === "upload") {
        var tag = document.createElement("span"); tag.textContent = "upload";
        tag.title = "Arquivo ENVIADO por você (não gerado pelo widget)";
        tag.style.cssText = "background:#c957881f;color:#a23a6a;border-radius:6px;padding:1px 6px;font-size:10px;font-weight:800;letter-spacing:.02em;text-transform:uppercase;flex:none;";
        sub.appendChild(tag);
      }
      var subtxt = document.createElement("span");
      subtxt.textContent = mt.ext + (it.kind === "report" || !it.kind ? " · " + (it.total || 0) + " registro(s)" : "") + " · " + formatarData(it.created_at);
      sub.appendChild(subtxt);
      info.appendChild(nm); info.appendChild(sub);
      var del = document.createElement("button"); del.type = "button"; del.innerHTML = ICON_TRASH; del.title = "Apagar (clique 2× p/ confirmar)"; del.setAttribute("aria-label", "Apagar");
      del.style.cssText = "border:0;background:transparent;color:#b45309;cursor:pointer;width:30px;height:30px;flex:none;border-radius:8px;";
      row.appendChild(ico); row.appendChild(info); row.appendChild(del);
      row.addEventListener("click", function (ev) { if (ev.target === del || del.contains(ev.target)) return; abrirDetalheSalvo(it.id, it.name); });
      var armado = false, tmr = null;
      del.addEventListener("click", async function (ev) {
        ev.stopPropagation();
        if (!armado) { armado = true; del.style.background = "#b4530922"; tmr = setTimeout(function () { armado = false; del.style.background = "transparent"; }, 2500); return; }
        clearTimeout(tmr); del.disabled = true;
        var dr = await apiSaved({ action: "delete", id: it.id });
        if (dr && dr.ok) { var ix = itens.indexOf(it); if (ix >= 0) itens.splice(ix, 1); aplicar(); toastWidget("Relatório apagado."); }
        else { del.disabled = false; armado = false; del.style.background = "transparent"; toastWidget("Falha ao apagar.", true); }
      });
      return row;
    }
    function aplicar() {
      lista.innerHTML = "";
      var vis = itens.filter(passa);
      contador.textContent = vis.length === itens.length ? (itens.length + " item(ns)") : (vis.length + " de " + itens.length);
      if (!vis.length) {
        var z = document.createElement("div"); z.style.cssText = "color:#6b7280;font-size:13px;text-align:center;padding:22px 8px;";
        z.textContent = itens.length ? "Nenhum item bate com o filtro." : "Nenhum relatório salvo.";
        lista.appendChild(z); return;
      }
      vis.forEach(function (it) { lista.appendChild(linhaSalvo(it)); });
    }
    busca.addEventListener("input", aplicar);
    tipo.addEventListener("change", aplicar);
    de.addEventListener("change", aplicar);
    ate.addEventListener("change", aplicar);
    aplicar();
  }
  async function abrirDetalheSalvo(id, nome) {
    var m = widgetModal(nome || "Item salvo", { wide: true });
    m.body.textContent = "Carregando…";
    var r = await apiSaved({ action: "get", id: id });
    m.body.innerHTML = "";
    if (!r || !r.ok) { m.body.textContent = ((r && r.erro) || "Falha ao carregar.") + (r && r.detalhe ? " (" + r.detalhe + ")" : ""); return; }

    // GRÁFICO: re-renderiza a partir da spec + exporta CSV/PNG.
    if (r.kind === "chart" && r.chart) {
      // Mesma renderização do gráfico do chat (abas, tipos, ampliar, CSV, PNG), sem Salvar.
      var built = construirCardGrafico(r.chart, { salvar: false, emModal: true });
      m.body.appendChild(built.card);
      var barD = document.createElement("div"); barD.style.cssText = "display:flex;justify-content:flex-end;margin-top:12px;";
      barD.appendChild(botaoApagarSalvo(id, m));
      m.body.appendChild(barD);
      return;
    }

    // ARQUIVO: info + baixar.
    if (r.kind === "file") {
      var dataUrl = "data:" + (r.mime || "application/octet-stream") + ";base64," + (r.content || "");
      var infoF = document.createElement("div"); infoF.style.cssText = "font-size:12px;color:#6b7280;margin-bottom:10px;word-break:break-word;";
      infoF.textContent = (r.file_name || r.name) + (r.mime ? " · " + r.mime : "");
      m.body.appendChild(infoF);
      // PRÉVIA do conteúdo (antes de baixar): planilha (CSV) · PDF · imagem · texto ·
      // sem-prévia. Office (Word/Excel/PPT) NÃO é texto — o mime traz "openxmlformats"
      // (tem "xml"), então precisa ser excluído senão vira binário embaralhado.
      var mimeF = String(r.mime || ""), fnF = String(r.file_name || r.name || "").toLowerCase();
      var ext = (fnF.match(/\.([a-z0-9]+)$/) || ["", ""])[1];
      var ehOffice = /officedocument|ms-excel|msword|ms-powerpoint|opendocument|spreadsheet|presentation|wordprocessing/i.test(mimeF) || /^(xls|xlsx|xlsm|doc|docx|ppt|pptx|odt|ods|odp)$/.test(ext);
      var tab = parseSalvoParaTabela(r);
      if (tab && tab.linhas.length) {
        var wrapP = document.createElement("div"); wrapP.style.cssText = "overflow:auto;max-height:50vh;border:1px solid #eef0f2;border-radius:10px;margin-bottom:10px;";
        var tblP = document.createElement("table"); tblP.style.cssText = "border-collapse:collapse;width:100%;font-size:12px;";
        var thP = document.createElement("thead"); var htrP = document.createElement("tr");
        tab.colunas.forEach(function (c) { var th = document.createElement("th"); th.textContent = c; th.style.cssText = "position:sticky;top:0;background:#f9fafb;text-align:left;padding:7px 9px;border-bottom:1px solid #e5e7eb;font-weight:700;color:#374151;white-space:nowrap;"; htrP.appendChild(th); });
        thP.appendChild(htrP); tblP.appendChild(thP);
        var tbP = document.createElement("tbody");
        tab.linhas.slice(0, 500).forEach(function (l) { var tr = document.createElement("tr"); (Array.isArray(l) ? l : []).forEach(function (cel) { var td = document.createElement("td"); td.textContent = cel == null ? "" : String(cel); td.style.cssText = "padding:6px 9px;border-bottom:1px solid #f1f2f4;white-space:nowrap;color:#374151;"; tr.appendChild(td); }); tbP.appendChild(tr); });
        tblP.appendChild(tbP); wrapP.appendChild(tblP); m.body.appendChild(wrapP);
      } else if (/pdf/i.test(mimeF) || ext === "pdf") {
        var frm = document.createElement("iframe"); frm.src = dataUrl; frm.style.cssText = "width:100%;height:54vh;border:1px solid #eef0f2;border-radius:10px;margin-bottom:10px;background:#fff;"; m.body.appendChild(frm);
      } else if (/^image\//.test(mimeF)) {
        var img = document.createElement("img"); img.src = dataUrl; img.style.cssText = "max-width:100%;max-height:50vh;border-radius:8px;display:block;margin-bottom:10px;"; m.body.appendChild(img);
      } else if (!ehOffice && (/^text\//i.test(mimeF) || /(json|csv|plain|tab-separated)/i.test(mimeF) || /^(txt|csv|tsv|json|xml|md|log|htm|html)$/.test(ext) || (/xml/i.test(mimeF) && /^(text|application)\/xml/i.test(mimeF)))) {
        var pre = document.createElement("pre"); pre.style.cssText = "max-height:50vh;overflow:auto;background:#f9fafb;border:1px solid #eef0f2;border-radius:10px;padding:10px;font-size:12px;white-space:pre-wrap;word-break:break-word;color:#374151;margin-bottom:10px;"; pre.textContent = decodeBase64Utf8(r.content || "").slice(0, 20000); m.body.appendChild(pre);
      } else {
        var sem = document.createElement("div"); sem.style.cssText = "font-size:12.5px;color:#9ca3af;margin-bottom:10px;padding:16px;text-align:center;border:1px dashed #e5e7eb;border-radius:10px;"; sem.textContent = ehOffice ? "Word/Excel/PowerPoint não têm prévia no navegador. Baixe para abrir no programa." : "Sem prévia para este tipo de arquivo. Baixe para abrir."; m.body.appendChild(sem);
      }
      var barF = document.createElement("div"); barF.style.cssText = "display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;";
      var dl = tutBtn("Baixar", true);
      // Download via BLOB (reconstrói o binário certinho — data URL grande pode corromper).
      dl.addEventListener("click", function () {
        try {
          var bin = atob(String(r.content || "")); var bytes = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          var blob = new Blob([bytes], { type: mimeF || "application/octet-stream" });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a"); a.href = url; a.download = r.file_name || r.name || "arquivo";
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(function () { try { URL.revokeObjectURL(url); } catch { } }, 2000);
        } catch { toastWidget("Falha ao baixar.", true); }
      });
      barF.appendChild(dl); barF.appendChild(botaoApagarSalvo(id, m));
      m.body.appendChild(barF);
      return;
    }

    // RELATÓRIO/TABELA (padrão): planilha rolável + Exportar CSV.
    var colunas = Array.isArray(r.columns) ? r.columns : [];
    var linhas = Array.isArray(r.rows) ? r.rows : [];
    var bar = document.createElement("div"); bar.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;";
    var cnt = document.createElement("div"); cnt.style.cssText = "flex:1;font-size:12px;color:#6b7280;min-width:90px;"; cnt.textContent = (r.total || linhas.length) + " registro(s)";
    var exp = tutBtn("Exportar CSV", true);
    bar.appendChild(cnt); bar.appendChild(exp); bar.appendChild(botaoApagarSalvo(id, m)); m.body.appendChild(bar);
    var wrapT = document.createElement("div"); wrapT.style.cssText = "overflow:auto;max-height:52vh;border:1px solid #eef0f2;border-radius:10px;";
    var tbl = document.createElement("table"); tbl.style.cssText = "border-collapse:collapse;width:100%;font-size:12px;";
    var thead = document.createElement("thead"); var htr = document.createElement("tr");
    colunas.forEach(function (c) { var th = document.createElement("th"); th.textContent = c; th.style.cssText = "position:sticky;top:0;background:#f9fafb;text-align:left;padding:7px 9px;border-bottom:1px solid #e5e7eb;font-weight:700;color:#374151;white-space:nowrap;"; htr.appendChild(th); });
    thead.appendChild(htr); tbl.appendChild(thead);
    var tbody = document.createElement("tbody");
    linhas.slice(0, 1000).forEach(function (lin) {
      var tr = document.createElement("tr");
      (Array.isArray(lin) ? lin : []).forEach(function (cel) { var td = document.createElement("td"); td.textContent = cel == null ? "" : String(cel); td.style.cssText = "padding:6px 9px;border-bottom:1px solid #f1f2f4;white-space:nowrap;color:#374151;"; tr.appendChild(td); });
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody); wrapT.appendChild(tbl); m.body.appendChild(wrapT);
    if (linhas.length > 1000) { var mais = document.createElement("div"); mais.style.cssText = "font-size:11px;color:#6b7280;margin-top:6px;"; mais.textContent = "Mostrando 1000 de " + linhas.length + " — exporte o CSV para todos."; m.body.appendChild(mais); }
    exp.addEventListener("click", function () { exportarCSV(nome, colunas, linhas); });
  }
  function exportarCSV(nome, colunas, linhas) {
    try {
      var cel = function (v) { v = v == null ? "" : String(v); return '"' + v.replace(/"/g, '""') + '"'; };
      var out = [colunas.map(cel).join(";")];
      linhas.forEach(function (l) { out.push((Array.isArray(l) ? l : []).map(cel).join(";")); });
      var csv = "﻿" + out.join("\r\n"); // BOM p/ Excel PT-BR abrir com acentos/; certos
      var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = String(nome || "relatorio").replace(/[^\w\- À-ú]/g, "_").slice(0, 80) + ".csv";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    } catch (e) { toastWidget("Falha ao exportar CSV.", true); }
  }

  // ==== Histórico de conversas (Fase 3) ====
  var ICON_HISTORY =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>';
  // API do histórico — mesma auth do saved-reports (chave pública + token de rastreio).
  async function apiConversas(payload) {
    try {
      var resp = await fetch(API + "/api/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Widget-Key": KEY },
        body: JSON.stringify(Object.assign({ key: KEY, track: track }, payload)),
      });
      return await resp.json().catch(function () { return null; });
    } catch (e) { return null; }
  }
  // Clique em "limpar" → pergunta: só LIMPAR (mantém no histórico) ou APAGAR (remove).
  function pedirLimparOuApagar() {
    // Sem identidade não há histórico por usuário → limpa direto (comportamento antigo).
    if (!hasPromptIdentity()) { clearChat(); return; }
    var m = widgetModal("Limpar conversa");
    var txt = document.createElement("div");
    txt.style.cssText = "font-size:13px;color:#374151;line-height:1.55;";
    txt.textContent = "O que você quer fazer com esta conversa?";
    var opts = document.createElement("div"); opts.style.cssText = "display:flex;flex-direction:column;gap:9px;margin-top:12px;";
    var b1 = optCardLimpar("🧹  Limpar a tela", "A conversa continua salva no Histórico e você começa uma nova.");
    var b2 = optCardLimpar("🗑️  Apagar as mensagens", "Remove esta conversa do histórico. Não dá para desfazer.");
    opts.appendChild(b1); opts.appendChild(b2);
    var rowc = document.createElement("div"); rowc.style.cssText = "display:flex;justify-content:flex-end;margin-top:14px;";
    var cancelar = tutBtn("Cancelar", false); rowc.appendChild(cancelar);
    m.body.appendChild(txt); m.body.appendChild(opts); m.body.appendChild(rowc);
    cancelar.addEventListener("click", m.fechar);
    b1.addEventListener("click", function () { m.fechar(); clearChat(); toastWidget("Conversa mantida no Histórico."); });
    b2.addEventListener("click", async function () {
      b2.style.pointerEvents = "none"; b2.style.opacity = ".6";
      await apagarConversaAtual(); m.fechar();
    });
  }
  // Cartão de opção (botão grande) do diálogo Limpar×Apagar.
  function optCardLimpar(titulo, desc) {
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var b = document.createElement("button"); b.type = "button";
    b.style.cssText = "text-align:left;border:1px solid " + pc + "33;background:" + pc + "08;border-radius:11px;padding:11px 13px;cursor:pointer;display:block;width:100%;";
    var h = document.createElement("div"); h.textContent = titulo; h.style.cssText = "font-size:13px;font-weight:800;color:" + pc + ";";
    var d = document.createElement("div"); d.textContent = desc; d.style.cssText = "font-size:11.5px;color:#6b7280;margin-top:3px;line-height:1.45;";
    b.appendChild(h); b.appendChild(d); return b;
  }
  // Apaga a conversa ATUAL do histórico (se já existir no servidor) e limpa a tela.
  async function apagarConversaAtual() {
    var cid = conversationId; // ler ANTES do clearChat (que zera o id)
    if (cid) {
      var r = await apiConversas({ action: "delete", id: cid });
      if (r && r.ok) toastWidget("Conversa apagada.");
      else toastWidget("Não deu para apagar no servidor — a tela foi limpa.", true);
    }
    clearChat();
  }
  // Lista o histórico do usuário (título/subtítulo/data + ressalva), com busca por termo
  // e intervalo de datas. Espelha "Meus relatórios salvos".
  async function abrirHistorico() {
    var m = widgetModal("Histórico de conversas", { wide: true });
    m.body.textContent = "Carregando…";
    var r = await apiConversas({ action: "list" });
    m.body.innerHTML = "";
    if (!r || !r.ok) { m.body.textContent = ((r && r.erro) || "Falha ao carregar.") + (r && r.detalhe ? " (" + r.detalhe + ")" : ""); return; }
    var itens = r.itens || [];
    if (!itens.length) {
      var e = document.createElement("div");
      e.style.cssText = "color:#6b7280;font-size:13px;text-align:center;padding:22px 8px;";
      e.textContent = "Nenhuma conversa no histórico ainda.";
      m.body.appendChild(e); return;
    }
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var bar = document.createElement("div");
    bar.style.cssText = "position:sticky;top:0;background:#fff;z-index:3;padding:0 0 8px;margin:-2px 0 6px;border-bottom:1px solid #f1f2f4;";
    var busca = document.createElement("input"); busca.type = "search"; busca.placeholder = "🔍  Buscar por termo na conversa…";
    busca.style.cssText = "width:100%;padding:8px 11px;border:1px solid #e5e7eb;border-radius:9px;font-size:13px;box-sizing:border-box;";
    var linha2 = document.createElement("div"); linha2.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;align-items:center;";
    var estiloData = "padding:6px 8px;border:1px solid #e5e7eb;border-radius:8px;font-size:12px;color:#374151;min-width:0;flex:0 1 auto;";
    var de = document.createElement("input"); de.type = "date"; de.title = "Data inicial"; de.setAttribute("aria-label", "Data inicial"); de.style.cssText = estiloData;
    var seta = document.createElement("span"); seta.textContent = "→"; seta.style.cssText = "color:#9ca3af;font-size:12px;flex:none;";
    var ate = document.createElement("input"); ate.type = "date"; ate.title = "Data final"; ate.setAttribute("aria-label", "Data final"); ate.style.cssText = estiloData;
    linha2.appendChild(de); linha2.appendChild(seta); linha2.appendChild(ate);
    bar.appendChild(busca); bar.appendChild(linha2);
    m.body.appendChild(bar);
    var contador = document.createElement("div"); contador.style.cssText = "font-size:11px;color:#9ca3af;margin:0 2px 8px;";
    m.body.appendChild(contador);
    var lista = document.createElement("div"); m.body.appendChild(lista);
    function normaliza(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
    function passa(it) {
      var q = normaliza(busca.value.trim());
      if (q && normaliza(it.title).indexOf(q) < 0 && normaliza(it.subtitle).indexOf(q) < 0 && normaliza(it.disclaimer).indexOf(q) < 0) return false;
      var d = String(it.created_at || "").slice(0, 10);
      if (de.value && d < de.value) return false;
      if (ate.value && d > ate.value) return false;
      return true;
    }
    function linhaConversa(it) {
      var row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:flex-start;gap:10px;padding:10px;border:1px solid #eef0f2;border-radius:10px;margin-bottom:8px;cursor:pointer;";
      var ico = document.createElement("span"); ico.innerHTML = ICON_CHAT;
      ico.style.cssText = "display:inline-flex;width:20px;height:20px;flex:none;color:" + pc + ";margin-top:1px;";
      var sg = ico.querySelector("svg"); if (sg) { sg.setAttribute("width", "18"); sg.setAttribute("height", "18"); }
      var info = document.createElement("div"); info.style.cssText = "flex:1;min-width:0;";
      var nm = document.createElement("div"); nm.style.cssText = "font-weight:700;font-size:13px;color:#1f2937;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"; nm.textContent = it.title || "Conversa";
      info.appendChild(nm);
      if (it.subtitle) { var sb = document.createElement("div"); sb.style.cssText = "font-size:11.5px;color:#6b7280;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"; sb.textContent = it.subtitle; info.appendChild(sb); }
      var meta = document.createElement("div"); meta.style.cssText = "font-size:11px;color:#9ca3af;margin-top:3px;"; meta.textContent = formatarData(it.created_at) + (it.mensagens ? " · " + it.mensagens + " mensagem(ns)" : ""); info.appendChild(meta);
      // Coluna da RESSALVA do agente (ex.: "Resposta baseada no relatório desta tela…").
      if (it.disclaimer) { var dz = document.createElement("div"); dz.style.cssText = "font-size:11px;font-style:italic;color:#6b7280;margin-top:5px;background:#f9fafb;border-radius:7px;padding:5px 8px;line-height:1.4;"; dz.textContent = "ℹ️ " + it.disclaimer; info.appendChild(dz); }
      var del = document.createElement("button"); del.type = "button"; del.innerHTML = ICON_TRASH; del.title = "Apagar (clique 2× p/ confirmar)"; del.setAttribute("aria-label", "Apagar");
      del.style.cssText = "border:0;background:transparent;color:#b45309;cursor:pointer;width:30px;height:30px;flex:none;border-radius:8px;";
      row.appendChild(ico); row.appendChild(info); row.appendChild(del);
      row.addEventListener("click", function (ev) { if (ev.target === del || del.contains(ev.target)) return; abrirDetalheConversa(it.id, it.title); });
      var armado = false, tmr = null;
      del.addEventListener("click", async function (ev) {
        ev.stopPropagation();
        if (!armado) { armado = true; del.style.background = "#b4530922"; tmr = setTimeout(function () { armado = false; del.style.background = "transparent"; }, 2500); return; }
        clearTimeout(tmr); del.disabled = true;
        var dr = await apiConversas({ action: "delete", id: it.id });
        if (dr && dr.ok) { var ix = itens.indexOf(it); if (ix >= 0) itens.splice(ix, 1); if (conversationId === it.id) conversationId = null; aplicar(); toastWidget("Conversa apagada."); }
        else { del.disabled = false; armado = false; del.style.background = "transparent"; toastWidget("Falha ao apagar.", true); }
      });
      return row;
    }
    function aplicar() {
      lista.innerHTML = "";
      var vis = itens.filter(passa);
      contador.textContent = vis.length === itens.length ? (itens.length + " conversa(s)") : (vis.length + " de " + itens.length);
      if (!vis.length) {
        var z = document.createElement("div"); z.style.cssText = "color:#6b7280;font-size:13px;text-align:center;padding:22px 8px;";
        z.textContent = itens.length ? "Nenhuma conversa bate com o filtro." : "Nenhuma conversa no histórico.";
        lista.appendChild(z); return;
      }
      vis.forEach(function (it) { lista.appendChild(linhaConversa(it)); });
    }
    busca.addEventListener("input", aplicar);
    de.addEventListener("change", aplicar);
    ate.addEventListener("change", aplicar);
    aplicar();
  }
  // Abre uma conversa do histórico: transcrição + Ampliar + Exportar (Word/PDF/CSV).
  async function abrirDetalheConversa(id, titulo) {
    var m = widgetModal(titulo || "Conversa", { wide: true });
    m.body.textContent = "Carregando…";
    var r = await apiConversas({ action: "get", id: id });
    m.body.innerHTML = "";
    if (!r || !r.ok) { m.body.textContent = ((r && r.erro) || "Falha ao carregar.") + (r && r.detalhe ? " (" + r.detalhe + ")" : ""); return; }
    var msgs = r.mensagens || [];
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var bar = document.createElement("div"); bar.style.cssText = "display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:10px;";
    var meta = document.createElement("div"); meta.style.cssText = "flex:1;font-size:11.5px;color:#6b7280;min-width:80px;"; meta.textContent = formatarData(r.created_at) + " · " + msgs.length + " mensagem(ns)";
    bar.appendChild(meta);
    bar.appendChild(kbChartBtn("⤢ Ampliar", pc, function () { abrirConversaAmpliada(titulo, r); }));
    bar.appendChild(kbChartBtn("⬇ Word", pc, function () { exportarConversa(id, "docx"); }));
    bar.appendChild(kbChartBtn("⬇ PDF", pc, function () { exportarConversa(id, "pdf"); }));
    bar.appendChild(kbChartBtn("⬇ CSV", pc, function () { exportarConversa(id, "csv"); }));
    m.body.appendChild(bar);
    if (r.disclaimer) { var ds = document.createElement("div"); ds.style.cssText = "font-size:11.5px;font-style:italic;color:#6b7280;margin-bottom:10px;background:#f9fafb;border-radius:8px;padding:7px 10px;"; ds.textContent = "ℹ️ " + r.disclaimer; m.body.appendChild(ds); }
    var wrap = document.createElement("div"); wrap.style.cssText = "max-height:56vh;overflow:auto;";
    wrap.appendChild(construirTranscricao(msgs, pc, r.usuario));
    m.body.appendChild(wrap);
  }
  // Monta a transcrição como no chat de verdade: cada mensagem com QUEM (usuário
  // identificado × Assistente IA) + QUANDO (data/hora/min), o balão com markdown
  // (reusa as classes .m.a/.m.u), e a MÍDIA do assistente (gráficos interativos +
  // arquivos). `usuario` = identificador do dono da conversa (nome/matrícula).
  function construirTranscricao(msgs, pc, usuario) {
    var box = document.createElement("div");
    // FIX: a transcrição do HISTÓRICO é montada FORA do escopo onde --pc/--pc2 vivem (o
    // dialog fica fora do wrap principal do widget) → o balão do USUÁRIO (.m.u usa
    // background:var(--pc)) ficava SEM fundo, enquanto o do assistente (#fff fixo) mantinha.
    // Fixa as variáveis no próprio container da transcrição.
    box.style.setProperty("--pc", pc);
    box.style.setProperty("--pc2", derive(pc));
    var rotuloUser = usuario ? "Você · " + usuario : "Você";
    (msgs || []).forEach(function (mm) {
      var ehUser = mm.role === "user";
      var wrap = document.createElement("div");
      wrap.style.cssText = "display:flex;flex-direction:column;margin-bottom:14px;" + (ehUser ? "align-items:flex-end;" : "align-items:flex-start;");
      // Cabeçalho: quem enviou + data/hora:minuto.
      var head = document.createElement("div");
      head.style.cssText = "font-size:10.5px;color:#9ca3af;margin:0 4px 3px;font-weight:700;";
      head.textContent = (ehUser ? rotuloUser : "Assistente (IA)") + (mm.created_at ? " · " + formatarData(mm.created_at) : "");
      wrap.appendChild(head);
      // Balão (mesmas classes do chat: markdown no assistente, texto no usuário).
      var bolha = document.createElement("div");
      bolha.className = "m " + (ehUser ? "u" : "a");
      if (ehUser) { bolha.textContent = String(mm.content == null ? "" : mm.content); }
      else { bolha.innerHTML = mdToHtml(String(mm.content == null ? "" : mm.content)); bolha.style.maxWidth = "92%"; }
      wrap.appendChild(bolha);
      // Fontes/citações do assistente (mesma sanfona do chat).
      if (!ehUser && mm.citations && mm.citations.length) {
        var cit = construirCitacoes(mm.citations);
        if (cit) { cit.style.maxWidth = "92%"; cit.style.marginTop = "6px"; wrap.appendChild(cit); }
      }
      // Anexos ENVIADOS pelo usuário (chips).
      if (ehUser && mm.attachments && mm.attachments.length) {
        var chips = document.createElement("div"); chips.style.cssText = "display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;justify-content:flex-end;";
        mm.attachments.forEach(function (a) {
          var chip = document.createElement("span"); chip.textContent = "📎 " + (a && a.name ? a.name : "arquivo");
          chip.style.cssText = "font-size:10.5px;color:#4a4a52;background:#eef0f2;border-radius:8px;padding:3px 8px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
          chips.appendChild(chip);
        });
        wrap.appendChild(chips);
      }
      // MÍDIA do assistente: gráficos (card interativo) + arquivos (download), como no chat.
      if (!ehUser && mm.media && mm.media.length) {
        var mwrap = document.createElement("div"); mwrap.style.cssText = "width:100%;max-width:92%;margin-top:6px;";
        mm.media.forEach(function (it) {
          if (it && it.kind === "chart" && it.spec) {
            var built = construirCardGrafico(it.spec, { salvar: false });
            built.card.style.margin = "6px 0 0 0"; built.card.style.maxWidth = "100%";
            mwrap.appendChild(built.card);
          } else if (it && it.kind === "file" && it.url) {
            mwrap.appendChild(linkArquivoTranscricao(it.url, it.filename));
          }
        });
        wrap.appendChild(mwrap);
      }
      box.appendChild(wrap);
    });
    if (!msgs || !msgs.length) { var z = document.createElement("div"); z.style.cssText = "color:#9ca3af;font-size:12.5px;text-align:center;padding:16px;"; z.textContent = "Sem mensagens."; box.appendChild(z); }
    return box;
  }
  // Link de download de um arquivo dentro da transcrição (URL assinada do bucket).
  function linkArquivoTranscricao(href, filename) {
    var a = document.createElement("a");
    a.href = href; a.download = filename || "arquivo"; a.rel = "noopener"; a.target = "_blank";
    a.textContent = "📎 " + (filename || "arquivo");
    a.style.cssText = "display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:8px 12px;border-radius:12px;border:1px solid rgba(0,0,0,.12);background:#fff;color:#111;text-decoration:none;font-size:12.5px;font-weight:600;max-width:100%;";
    return a;
  }
  // Amplia a conversa (overlay grande, centralizado) — espelha a modal do gráfico.
  function abrirConversaAmpliada(titulo, r) {
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var raiz = (messagesEl.getRootNode && messagesEl.getRootNode()) || document.body;
    var ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(15,15,20,.55);padding:16px;";
    var card = document.createElement("div");
    card.style.cssText = "background:#fff;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.4);width:min(940px,94vw);max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);overflow:hidden;display:flex;flex-direction:column;padding:16px;";
    var hd = document.createElement("div"); hd.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-shrink:0;";
    var ttl = document.createElement("div"); ttl.textContent = titulo || "Conversa"; ttl.style.cssText = "font-size:15px;font-weight:700;color:#17171a;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
    var fechar = document.createElement("button"); fechar.type = "button"; fechar.setAttribute("aria-label", "Fechar"); fechar.innerHTML = "&times;"; fechar.style.cssText = "border:none;background:transparent;font-size:26px;line-height:1;cursor:pointer;color:#555;padding:0 6px;";
    hd.appendChild(ttl); hd.appendChild(fechar);
    var body = document.createElement("div"); body.style.cssText = "flex:1;min-height:0;overflow:auto;";
    if (r.disclaimer) { var ds = document.createElement("div"); ds.style.cssText = "font-size:11.5px;font-style:italic;color:#6b7280;margin-bottom:10px;background:#f9fafb;border-radius:8px;padding:7px 10px;"; ds.textContent = "ℹ️ " + r.disclaimer; body.appendChild(ds); }
    body.appendChild(construirTranscricao(r.mensagens || [], pc, r.usuario));
    card.appendChild(hd); card.appendChild(body);
    ov.appendChild(card); raiz.appendChild(ov);
    function fecharOv() { if (ov.parentNode) ov.parentNode.removeChild(ov); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") fecharOv(); }
    fechar.addEventListener("click", fecharOv);
    ov.addEventListener("click", function (e) { if (e.target === ov) fecharOv(); });
    document.addEventListener("keydown", onKey);
  }
  // Exporta a conversa (Word/PDF/CSV) — o servidor monta o arquivo com a ressalva no subtítulo.
  async function exportarConversa(id, formato) {
    try {
      var r = await apiConversas({ action: "export", id: id, formato: formato });
      if (!r || !r.ok || !r.content) { toastWidget((r && r.erro) || "Falha ao gerar o arquivo.", true); return; }
      var bin = atob(String(r.content)); var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var blob = new Blob([bytes], { type: r.mime || "application/octet-stream" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a"); a.href = url; a.download = r.filename || ("conversa." + formato);
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch { } }, 2000);
    } catch (e) { toastWidget("Falha ao gerar o arquivo.", true); }
  }

  // ==== Montagem ====
  function mount() {
    host = document.createElement("div");
    host.setAttribute("data-kb-widget", "");
    document.body.appendChild(host);
    root = host.attachShadow({ mode: "open" });

    // Compatibilidade com MODAIS (APEX/jQuery UI e afins): um dialog modal "rouba"
    // o foco de tudo que está fora dele — como o widget vive no <body>, fora do
    // dialog, o textarea perdia o foco na hora. Duas camadas:
    //  (1) barra os eventos de foco do widget antes de chegarem ao document;
    ["focusin", "focusout"].forEach(function (ev) {
      host.addEventListener(ev, function (e) { e.stopPropagation(); }, false);
    });
    // Lembra o ÚLTIMO campo que o usuário focou/clicou NA PÁGINA (não no widget) — dá
    // contexto p/ pedidos como "aqui", "isto", "esse campo". Captura na fase de CAPTURA
    // (pega foco dentro de contêineres); foco no próprio widget NÃO sobrescreve.
    document.addEventListener("focusin", function (e) {
      try {
        var t = e.target;
        if (!t || t === host || (host.contains && host.contains(t))) return; // widget → mantém o anterior
        var tag = (t.tagName || "").toLowerCase();
        if (tag === "input" || tag === "select" || tag === "textarea" || t.isContentEditable) {
          var ty = (t.type || "").toLowerCase();
          if (ty === "hidden" || ty === "submit" || ty === "button" || ty === "reset") return;
          _focusedEl = t;
        }
      } catch (err) { }
    }, true);
    //  (2) correção canônica: ensina o jQuery UI Dialog a PERMITIR interação com o
    //      widget (patch em _allowInteraction) — é o que realmente destrava o foco.
    permitirNoModal();

    var st = document.createElement("style");
    st.textContent = styles();
    root.appendChild(st);

    var wrap = document.createElement("div");
    var pc = cfg.primaryColor || "#511C76";
    wrap.style.setProperty("--pc", pc);
    // Cor secundária escolhida (hex válido) OU derivada da primária.
    var sec = /^#?[0-9a-fA-F]{6}$/.test(cfg.secondaryColor || "")
      ? (cfg.secondaryColor.charAt(0) === "#" ? cfg.secondaryColor : "#" + cfg.secondaryColor)
      : derive(pc);
    wrap.style.setProperty("--pc2", sec);
    // Tamanho da bolha e formato do avatar (parametrizados no admin).
    var TAM = { sm: "52px", md: "60px", lg: "70px" };
    wrap.style.setProperty("--bs", TAM[cfg.bubbleSize] || "60px");
    var FORMA = { circle: "50%", rounded: "30%", square: "18%" };
    wrap.style.setProperty("--ash", FORMA[cfg.avatarShape] || "50%");

    bubble = document.createElement("button");
    bubble.className = "bubble";
    bubble.setAttribute("aria-label", "Abrir assistente");
    bubble.innerHTML = bubbleInner();
    // Badge de notificação (contador) no canto da bolha.
    badge = document.createElement("span");
    badge.setAttribute("aria-hidden", "true");
    badge.style.cssText =
      "position:absolute;top:-3px;right:-3px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;" +
      "background:#e5484d;color:#fff;font:700 11px/1 system-ui,-apple-system,sans-serif;" +
      "align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);" +
      "display:none;pointer-events:none;box-sizing:border-box;z-index:1;";
    bubble.appendChild(badge);

    panel = document.createElement("div");
    panel.className = "panel kb-dimmable";
    panel.innerHTML =
      '<div class="hd">' +
      '<div class="hav">' +
      (cfg.avatarUrl ? '<img src="' + esc(cfg.avatarUrl) + '" alt="">' : ICON_BOT) +
      "</div>" +
      '<div class="ti"><div class="t">' + esc(cfg.title) + "</div>" +
      '<div class="s">' + esc(cfg.subtitle || "Pergunte o que quiser") + "</div></div>" +
      '<button aria-label="Relatórios" title="Relatórios" data-reports-menu>' + ICON_REPORTS + "</button>" +
      '<button aria-label="Limpar conversa" title="Limpar conversa" data-clear>' + ICON_TRASH + "</button>" +
      '<button aria-label="Expandir" title="Expandir para o centro" data-expand>' + ICON_EXPAND + "</button>" +
      '<button aria-label="Minimizar" data-close>&minus;</button></div>' +
      '<div class="msgs"></div>' +
      '<div class="pbar"></div>' +
      '<div class="attz"></div>' +
      '<div class="ft">' +
      '<button class="attb" data-attach aria-label="Anexar arquivo" title="Anexar documento ou imagem (PDF, Word, Excel, CSV, PNG, JPG…)">' + ICON_CLIP + "</button>" +
      '<button class="attb" data-mic aria-label="Gravar áudio" title="Falar (gravar áudio)">' + ICON_MIC + "</button>" +
      '<input type="file" data-file hidden multiple accept=".pdf,.docx,.pptx,.xlsx,.xlsm,.csv,.txt,.md,.png,.jpg,.jpeg,.gif,.webp">' +
      '<textarea rows="1" placeholder="Escreva ou fale sua pergunta…"></textarea>' +
      '<button data-send aria-label="Enviar">' + ICON_SEND + "</button></div>" +
      '<div class="disc">Sou uma IA e posso cometer enganos — sempre valide as informações.</div>' +
      '<div class="pw">Powered by Natcorp</div>';

    wrap.appendChild(bubble);
    wrap.appendChild(panel);
    root.appendChild(wrap);

    messagesEl = panel.querySelector(".msgs");
    inputEl = panel.querySelector("textarea");
    if (inputEl && widgetLang !== "pt") inputEl.placeholder = wt("placeholder");
    sendBtn = panel.querySelector("[data-send]");
    attzEl = panel.querySelector(".attz");
    fileInput = panel.querySelector("[data-file]");
    micBtn = panel.querySelector("[data-mic]");

    panel.querySelector("[data-close]").addEventListener("click", toggle);
    panel.querySelector("[data-expand]").addEventListener("click", toggleExpand);
    panel.querySelector("[data-clear]").addEventListener("click", pedirLimparOuApagar);
    panel.querySelector("[data-reports-menu]").addEventListener("click", function (e) { e.stopPropagation(); abrirMenuRelatorios(e.currentTarget); });
    panel.querySelector("[data-attach]").addEventListener("click", function () {
      fileInput.click();
    });
    micBtn.addEventListener("click", toggleMic);
    fileInput.addEventListener("change", function () {
      var files = fileInput.files ? Array.prototype.slice.call(fileInput.files) : [];
      files.forEach(uploadAttachment);
      fileInput.value = ""; // permite reanexar o mesmo arquivo
    });
    // Enquanto processa, o botão é "Parar"; senão, "Enviar".
    sendBtn.addEventListener("click", function () { if (busy) pararTudo(); else submit(); });
    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    });
    // A caixa cresce com as linhas, até 5 linhas; depois rola por dentro. Também
    // salva o RASCUNHO (preserva o texto ao minimizar/recarregar).
    inputEl.addEventListener("input", function () { autoGrow(); try { localStorage.setItem(LS_DRAFT, inputEl.value); } catch { } });
    // Restaura o rascunho salvo (se houver) — não perde o que estava digitado.
    try { var _rasc = localStorage.getItem(LS_DRAFT); if (_rasc) { inputEl.value = _rasc; autoGrow(); } } catch { }

    positionBubble();
    setupDrag();
    setupPanelDrag();
    setupDimScroll();
    loadInitialMessages();
    setupPrompts();
    setupBaseDados();
    setupPreAquecimento();
    manterNoTopo();
    observarTopo();
    blindarHost();
  }

  // Mantém o widget SEMPRE em primeiro plano: além do z-index máximo, garante que
  // o host seja o ÚLTIMO filho do body (desempata com modais que também usam
  // z-index alto e entram no DOM depois). Reage a mudanças no body, mas não mexe
  // se o usuário está digitando dentro do widget (não rouba o foco).
  function manterNoTopo() {
    try {
      if (!host || !document.body) return;
      if (document.body.lastElementChild === host) return;
      if (document.activeElement === host) return; // foco dentro do widget: não move
      document.body.appendChild(host);
    } catch {
      /* ignora */
    }
  }
  function observarTopo() {
    try {
      var mo = new MutationObserver(function () { manterNoTopo(); });
      mo.observe(document.body, { childList: true });
    } catch {
      /* navegador sem MutationObserver — z-index máximo já cobre o comum */
    }
  }

  // Alguns modais (Radix, MUI, react-aria, focus-trap…) marcam TODO o resto da
  // página como `inert`/`aria-hidden` — o que congela o host do widget e impede
  // clicar/digitar. Removemos essas marcas do NOSSO host assim que aparecem.
  function limparBloqueiosHost() {
    try {
      if (!host) return;
      if (host.hasAttribute("inert")) host.removeAttribute("inert");
      if (host.getAttribute("aria-hidden") === "true") host.removeAttribute("aria-hidden");
      if (host.getAttribute("tabindex") === "-1") host.removeAttribute("tabindex");
    } catch {
      /* ignora */
    }
  }
  function blindarHost() {
    limparBloqueiosHost();
    try {
      var mo = new MutationObserver(limparBloqueiosHost);
      mo.observe(host, { attributes: true, attributeFilter: ["inert", "aria-hidden", "tabindex"] });
    } catch {
      /* ignora */
    }
  }

  // Escapa da ARMADILHA DE FOCO do modal: quando o painel está aberto, impede que
  // os handlers de foco do site (em document/janela) reajam ao foco ENTRANDO ou
  // SAINDO do widget — assim o modal para de "puxar" o cursor de volta e dá para
  // digitar. Só age quando o widget está envolvido; o foco do resto da página
  // segue normal. Captura na janela (roda antes dos handlers do site).
  function escaparFoco(e) {
    try {
      if (e.target === host || e.relatedTarget === host) e.stopImmediatePropagation();
    } catch {
      /* ignora */
    }
  }
  var focoBlindado = false;
  function ligarEscapeFoco(ligar) {
    try {
      if (ligar && !focoBlindado) {
        window.addEventListener("focusin", escaparFoco, true);
        window.addEventListener("focusout", escaparFoco, true);
        focoBlindado = true;
      } else if (!ligar && focoBlindado) {
        window.removeEventListener("focusin", escaparFoco, true);
        window.removeEventListener("focusout", escaparFoco, true);
        focoBlindado = false;
      }
    } catch {
      /* ignora */
    }
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Markdown mínimo e seguro (escapa primeiro; só injeta tags próprias).
  function inlineMd(t) {
    t = esc(t);
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, lab, url) {
      var u = url.trim();
      var safe = /^(https?:|mailto:|\/|#)/i.test(u) ? u : "#";
      return '<a href="' + safe + '" target="_blank" rel="noopener">' + lab + "</a>";
    });
    t = t.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
    return t;
  }
  function mdToHtml(src) {
    var lines = String(src == null ? "" : src).replace(/\r\n/g, "\n").split("\n");
    var html = "", i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (/^```/.test(line.trim())) {
        var code = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i].trim())) { code.push(esc(lines[i])); i++; }
        i++;
        html += "<pre><code>" + code.join("\n") + "</code></pre>";
        continue;
      }
      var h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) { html += '<p class="mh">' + inlineMd(h[2]) + "</p>"; i++; continue; }
      if (/^\s*[-*+]\s+/.test(line)) {
        var ul = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
          ul.push("<li>" + inlineMd(lines[i].replace(/^\s*[-*+]\s+/, "")) + "</li>"); i++;
        }
        html += "<ul>" + ul.join("") + "</ul>";
        continue;
      }
      if (/^\s*\d+[.)]\s+/.test(line)) {
        var ol = [];
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
          ol.push("<li>" + inlineMd(lines[i].replace(/^\s*\d+[.)]\s+/, "")) + "</li>"); i++;
        }
        html += "<ol>" + ol.join("") + "</ol>";
        continue;
      }
      if (line.trim() === "") { i++; continue; }
      var para = [];
      while (
        i < lines.length && lines[i].trim() !== "" &&
        !/^```/.test(lines[i].trim()) && !/^#{1,6}\s+/.test(lines[i]) &&
        !/^\s*[-*+]\s+/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i])
      ) { para.push(lines[i]); i++; }
      html += "<p>" + inlineMd(para.join("\n")) + "</p>";
    }
    return html;
  }

  // ==== Posição / arrastar / snap ====
  function savedPos() {
    try {
      return JSON.parse(localStorage.getItem(LS_POS) || "null");
    } catch {
      return null;
    }
  }
  function positionBubble() {
    var p = savedPos();
    var size = Math.round(bubble.getBoundingClientRect().width) || 60, margin = 20;
    var x = p ? p.x : (cfg.position === "left" ? margin : window.innerWidth - size - margin);
    var y = p ? p.y : window.innerHeight - size - margin;
    x = Math.max(margin, Math.min(x, window.innerWidth - size - margin));
    y = Math.max(margin, Math.min(y, window.innerHeight - size - margin));
    bubble.style.left = x + "px";
    bubble.style.top = y + "px";
    bubble.style.right = "auto";
    bubble.style.bottom = "auto";
    placePanel();
  }
  // Geometria em PX (nos DOIS estados) — transição sempre px→px, sem depender de
  // classe vs inline. `origem` é o ponto do scale de abrir/minimizar.
  function geomExp() {
    var W = window.innerWidth, H = window.innerHeight;
    return { left: Math.round(W * 0.2), width: Math.round(W * 0.6), top: Math.round(H * 0.05), height: Math.round(H * 0.9), radius: 16, origem: "center" };
  }
  function savedPanelPos() {
    try { return JSON.parse(localStorage.getItem(LS_PANEL) || "null"); } catch { return null; }
  }
  function ehMobile() { return window.innerWidth <= BP_MOBILE; }
  // Altura/topo do viewport VISUAL. No iOS o teclado NÃO muda innerHeight (o layout
  // viewport fica igual) — só o visual viewport encolhe e o Safari rola a página.
  // Sem isto, o campo de digitar some atrás do teclado no modo tela cheia.
  function vvH() { var v = window.visualViewport; return (v && v.height) ? Math.round(v.height) : window.innerHeight; }
  function vvTop() { var v = window.visualViewport; return (v && v.offsetTop) ? Math.round(v.offsetTop) : 0; }
  function geomCanto() {
    // MOBILE: tela cheia, como um app aberto. Sai antes de savedPanelPos() — a
    // posição arrastada no desktop fica GUARDADA (não apagada) e volta ao girar.
    if (ehMobile()) return { left: 0, width: window.innerWidth, top: vvTop(), height: vvH(), radius: 0, origem: "center" };
    var margem = window.innerWidth <= 480 ? 10 : 12; // celular: cola mais nas bordas
    var pw = Math.min(440, window.innerWidth - margem * 2);
    var ph = Math.min(680, window.innerHeight - 96);
    // Se o usuário arrastou a JANELA, ela fica onde ele deixou (clampada).
    var pos = savedPanelPos();
    if (pos) {
      var pl = Math.max(margem, Math.min(pos.left, window.innerWidth - pw - margem));
      var pt = Math.max(12, Math.min(pos.top, window.innerHeight - ph - 12));
      return { left: pl, width: pw, top: pt, height: ph, radius: 22, origem: "center" };
    }
    // Padrão: ancorada à bolha.
    var b = bubble.getBoundingClientRect();
    var esq = b.left + b.width / 2 < window.innerWidth / 2;
    var left = esq ? b.left : b.right - pw;
    left = Math.max(margem, Math.min(left, window.innerWidth - pw - margem));
    var top = b.top - ph - 12;
    var acima = true;
    if (top < 12) { top = Math.min(b.bottom + 12, window.innerHeight - ph - 12); acima = false; }
    top = Math.max(12, Math.min(top, window.innerHeight - ph - 12));
    // O scale de abrir cresce do canto perto da bolha.
    return { left: left, width: pw, top: top, height: ph, radius: 22, origem: (acima ? "bottom " : "top ") + (esq ? "left" : "right") };
  }
  function setGeom(g) {
    panel.style.left = g.left + "px";
    panel.style.width = g.width + "px";
    panel.style.top = g.top + "px";
    panel.style.height = g.height + "px";
    panel.style.borderRadius = g.radius + "px";
    panel.style.transformOrigin = g.origem;
  }
  // Em tela cheia a bolha (que vira "×" ao abrir) fica ATRÁS do painel: seria um
  // segundo botão de fechar que ninguém vê. Esconde enquanto o painel ocupa a tela
  // — minimizar é o "−" do cabeçalho, como pedido.
  function atualizarBolha() {
    try { bubble.style.display = (open && ehMobile()) ? "none" : ""; } catch (e) { }
  }

  // Aplica o estado (canto × expandido) INSTANTANEAMENTE — usado ao abrir e no
  // resize. `adiarRemocao` mantém a classe .exp durante a retração animada, para
  // os limites de tamanho não "clamparem" a altura no meio da transição.
  function aplicarExpansao(adiarRemocao) {
    var btn = panel.querySelector("[data-expand]");
    if (ehMobile()) {
      // Modo app: tela cheia. Sem .exp (o Expandir já é escondido aqui) e sem o
      // escurecimento ao rolar — a página atrás está 100% coberta, não há o que ler.
      panel.classList.add("full");
      panel.classList.remove("exp");
      panel.classList.remove("kb-dim"); // mata um escurecimento em voo ao girar a tela
      setGeom(geomCanto());
    } else if (expanded && window.innerWidth > BP_MOBILE) {
      panel.classList.remove("full");
      panel.classList.add("exp");
      setGeom(geomExp());
      if (btn) { btn.innerHTML = ICON_COLLAPSE; btn.setAttribute("aria-label", "Recolher"); btn.setAttribute("title", "Recolher"); }
    } else {
      panel.classList.remove("full"); // voltou para desktop: solta a tela cheia
      if (!adiarRemocao) panel.classList.remove("exp");
      setGeom(geomCanto());
      if (btn) { btn.innerHTML = ICON_EXPAND; btn.setAttribute("aria-label", "Expandir"); btn.setAttribute("title", "Expandir para o centro"); }
    }
    atualizarBolha();
  }
  function toggleExpand() {
    expanded = !expanded;
    try { localStorage.setItem("kb.widget.exp", expanded ? "1" : "0"); } catch { }
    // Anima a ida/volta (0,5s): liga a transição, commita antes de mudar a
    // geometria (garante o start), e desliga ao fim (senão o arrastar fica com lag).
    panel.classList.add("anim");
    void panel.offsetWidth;
    aplicarExpansao(true);
    clearTimeout(_animT);
    _animT = setTimeout(function () {
      panel.classList.remove("anim");
      if (!expanded) panel.classList.remove("exp"); // solta os limites só no FIM da retração
    }, 520);
  }

  function placePanel() {
    if (panel.classList.contains("exp")) return; // expandido: geometria já aplicada
    // Mantém a classe de tela cheia em sincronia com a largura (resize/rotação):
    // sem ela os limites de tamanho de .panel clampariam a geometria inline.
    if (ehMobile()) { panel.classList.add("full"); panel.classList.remove("kb-dim"); }
    else panel.classList.remove("full");
    setGeom(geomCanto());
    atualizarBolha();
  }
  function setupDrag() {
    var dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
    bubble.addEventListener("pointerdown", function (e) {
      dragging = true;
      moved = false;
      sx = e.clientX;
      sy = e.clientY;
      var r = bubble.getBoundingClientRect();
      ox = r.left;
      oy = r.top;
      bubble.setPointerCapture(e.pointerId);
    });
    bubble.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      bubble.style.left = ox + dx + "px";
      bubble.style.top = oy + dy + "px";
    });
    // Se o ponteiro for CANCELADO (rolagem, o host "rouba" o gesto), zera o estado —
    // senão `dragging` fica preso e um pointerup seguinte vira um "tap" que minimiza
    // o chat sozinho (bug: a janela fechava ao enviar a 1ª mensagem).
    bubble.addEventListener("pointercancel", function () { dragging = false; moved = false; });
    bubble.addEventListener("pointerup", function (e) {
      if (!dragging) return;
      dragging = false;
      try { bubble.releasePointerCapture(e.pointerId); } catch { }
      if (!moved) {
        toggle();
        return;
      }
      // Snap horizontal na borda mais próxima.
      var size = Math.round(bubble.getBoundingClientRect().width) || 60, margin = 20;
      var r = bubble.getBoundingClientRect();
      var x = r.left + size / 2 < window.innerWidth / 2 ? margin : window.innerWidth - size - margin;
      var y = Math.max(margin, Math.min(r.top, window.innerHeight - size - margin));
      bubble.style.left = x + "px";
      bubble.style.top = y + "px";
      localStorage.setItem(LS_POS, JSON.stringify({ x: x, y: y }));
      placePanel();
    });
    window.addEventListener("resize", function () {
      positionBubble();
      if (expanded) aplicarExpansao(); // recalcula (ou volta ao canto no mobile)
      else placePanel();               // mantém a janela arrastada dentro da tela
    });
    // TECLADO / barra de URL no mobile: reancora a tela cheia no viewport VISUAL.
    // Um quadro por rajada de eventos (o iOS dispara vários por gesto).
    var _vvRaf = 0;
    function reancorarMobile() {
      if (_vvRaf) return;
      _vvRaf = requestAnimationFrame(function () {
        _vvRaf = 0;
        if (!open || !ehMobile()) return;
        setGeom(geomCanto());
        try { messagesEl.scrollTop = messagesEl.scrollHeight; } catch (e) { } // última mensagem acima do teclado
      });
    }
    try {
      var vv = window.visualViewport;
      if (vv) { vv.addEventListener("resize", reancorarMobile); vv.addEventListener("scroll", reancorarMobile); }
      // O iOS reporta dimensões erradas NO instante do orientationchange.
      window.addEventListener("orientationchange", function () {
        setTimeout(function () { positionBubble(); aplicarExpansao(); }, 250);
      });
    } catch (e) { }
  }
  // TRANSPARÊNCIA AO ROLAR ATRÁS: enquanto o usuário rola a PÁGINA (não o chat), o
  // painel fica a 30% de opacidade para deixar ler o conteúdo por trás; volta ao
  // normal ~650ms após parar. Cobre a janela, elementos roláveis (scroll capturado)
  // e iframes MESMO-ORIGEM (cross-origin não emite eventos ao pai — limitação real).
  var _dimTimer = 0;
  function dimPanel() {
    if (!panel || !panel.classList.contains("open")) return;
    // Tela cheia (mobile): NUNCA escurecer. Um guard aqui cobre todas as origens de
    // uma vez — touchmove, wheel, scroll capturado e os iframes mesmo-origem.
    if (panel.classList.contains("full")) return;
    panel.classList.add("kb-dim");
    try { if (_dimTimer) clearTimeout(_dimTimer); } catch { }
    _dimTimer = setTimeout(function () { try { if (panel) panel.classList.remove("kb-dim"); } catch { } }, 650);
  }
  function onScrollDim(e) {
    // Rolar DENTRO do próprio widget (o chat) não deve escurecer. Eventos do shadow
    // são reapontados para o host → t === host; scroll de descendentes → host.contains.
    try { var t = e && e.target; if (t && (t === host || (t.nodeType === 1 && host && host.contains && host.contains(t)))) return; } catch { }
    dimPanel();
  }
  function ligarIframesScroll() {
    try {
      document.querySelectorAll("iframe").forEach(function (f) {
        var d; try { d = f.contentDocument; } catch { return; } // cross-origin → SecurityError → ignora
        if (!d || d.__kbDim) return;
        try {
          d.__kbDim = true;
          d.addEventListener("scroll", dimPanel, true);
          d.addEventListener("wheel", dimPanel, { passive: true });
          d.addEventListener("touchmove", dimPanel, { passive: true });
        } catch { }
      });
    } catch { }
  }
  function setupDimScroll() {
    try {
      document.addEventListener("scroll", onScrollDim, true); // scroll não borbulha → captura pega qualquer elemento
      window.addEventListener("wheel", onScrollDim, { passive: true });
      window.addEventListener("touchmove", onScrollDim, { passive: true });
      ligarIframesScroll();
      // iframes podem carregar depois — reavalia algumas vezes e ao rolar.
      setTimeout(ligarIframesScroll, 2500); setTimeout(ligarIframesScroll, 6000);
      window.addEventListener("wheel", ligarIframesScroll, { passive: true, once: true });
    } catch { }
  }
  // Arrastar a JANELA do chat pelo cabeçalho (independe da bolha). Não arrasta ao
  // clicar nos botões do cabeçalho nem no modo expandido (centralizado).
  function setupPanelDrag() {
    var hd = panel.querySelector(".hd");
    if (!hd) return;
    var dragging = false, moved = false, sx = 0, sy = 0, ol = 0, ot = 0;
    hd.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button !== 0) return;
      if (e.target.closest && e.target.closest("button")) return; // botões do cabeçalho
      if (panel.classList.contains("exp")) return;                // expandido: não arrasta
      if (panel.classList.contains("full")) return;               // tela cheia: não há para onde arrastar
      dragging = true; moved = false;
      sx = e.clientX; sy = e.clientY;
      var r = panel.getBoundingClientRect();
      ol = r.left; ot = r.top;
      panel.classList.remove("anim");          // sem transição durante o arraste
      try { hd.setPointerCapture(e.pointerId); } catch { }
    });
    hd.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      var pw = panel.offsetWidth, ph = panel.offsetHeight, m = 8;
      // Clampa mantendo o cabeçalho sempre alcançável na tela.
      var left = Math.max(m - pw + 80, Math.min(ol + dx, window.innerWidth - 80));
      var top = Math.max(m, Math.min(ot + dy, window.innerHeight - 44));
      panel.style.left = left + "px";
      panel.style.top = top + "px";
    });
    function fim(e) {
      if (!dragging) return;
      dragging = false;
      try { hd.releasePointerCapture(e.pointerId); } catch { }
      if (moved) {
        var r = panel.getBoundingClientRect();
        try { localStorage.setItem(LS_PANEL, JSON.stringify({ left: Math.round(r.left), top: Math.round(r.top) })); } catch { }
      }
    }
    hd.addEventListener("pointerup", fim);
    hd.addEventListener("pointercancel", fim);
    // Duplo-clique no cabeçalho: solta a janela e reancora à bolha.
    hd.addEventListener("dblclick", function (e) {
      if (e.target.closest && e.target.closest("button")) return;
      try { localStorage.removeItem(LS_PANEL); } catch { }
      placePanel();
    });
  }

  // Completa a revelação da resposta em curso (definida por `ask`). Chamado ao
  // reabrir o chat e quando a aba volta ao primeiro plano — porque o navegador
  // PAUSA o requestAnimationFrame com a aba em segundo plano, e sem isto a
  // resposta ficaria "parada" (o usuário via como se o chat pausasse a sessão).
  var _revealFlush = null;
  try {
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && _revealFlush) _revealFlush();
    });
  } catch { }

  // ==== Notificação (badge na bolha + contagem na aba + som) quando chega
  //      resposta com o widget minimizado ====
  var badge = null;         // contador na bolha
  var _naoLidas = 0;        // nº de respostas não lidas (widget minimizado)
  var _avisouTurno = false; // já avisou nesta resposta (evita repetir)
  var _audioCtx = null;
  function mostrarBadge() {
    if (!badge) return;
    try {
      if (_naoLidas > 0) {
        if (badge.parentNode !== bubble) bubble.appendChild(badge); // re-insere (innerHTML da bolha muda ao abrir/fechar)
        badge.textContent = _naoLidas > 9 ? "9+" : String(_naoLidas);
        badge.style.display = "flex";
      } else {
        badge.style.display = "none";
      }
    } catch { }
  }
  // Contagem na ABA do navegador: prefixa "(N) " no título; some ao ler.
  function atualizarTitulo() {
    try {
      var base = String(document.title || "").replace(/^\(\d+\)\s*/, "");
      document.title = _naoLidas > 0 ? "(" + _naoLidas + ") " + base : base;
    } catch { }
  }
  // Destrava o áudio num gesto do usuário (política de autoplay dos navegadores).
  function desbloquearAudio() {
    try {
      if (!_audioCtx) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) _audioCtx = new AC(); }
      if (_audioCtx && _audioCtx.state === "suspended") _audioCtx.resume();
    } catch { }
  }
  // Bip curto e DISCRETO (dois tons suaves) — sem arquivo externo. Retoma o
  // contexto (se suspenso) e só então toca.
  function tocarBip() {
    try {
      if (!_audioCtx) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; _audioCtx = new AC(); }
      var ctx = _audioCtx;
      var play = function () {
        var t = ctx.currentTime;
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(660, t);
        o.frequency.setValueAtTime(880, t + 0.09);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.09, t + 0.02); // discreto, mas audível
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + 0.28);
      };
      if (ctx.state === "suspended") ctx.resume().then(play).catch(function () { });
      else play();
    } catch { }
  }
  // Chegou resposta com o widget MINIMIZADO → conta, badge, título e som (1×/resposta).
  function avisarMensagem() {
    if (open || _avisouTurno) return;
    _avisouTurno = true;
    _naoLidas += 1;
    mostrarBadge();
    atualizarTitulo();
    tocarBip();
  }
  // Abriu o widget = confirmou a leitura → zera contagem/badge/título.
  function marcarLido() {
    _naoLidas = 0;
    mostrarBadge();
    atualizarTitulo();
  }

  function toggle() {
    open = !open;
    if (open) {
      clearTimeout(_closeT);
      panel.classList.remove("closing");
      aplicarExpansao(); // geometria + origem do scale ANTES da entrada (kbin)
      panel.classList.add("open"); // dispara o crescimento a partir do canto da bolha
      bubble.innerHTML = "";
      bubble.textContent = "×";
      bubble.style.fontSize = "28px";
      limparBloqueiosHost(); // caso um modal já tenha marcado o host
      ligarEscapeFoco(true); // escapa da armadilha de foco do modal
      desbloquearAudio(); // gesto do usuário: libera o som de notificação
      marcarLido(); // abrir = confirmou a leitura → zera badge/contagem/título
      if (_revealFlush) _revealFlush(); // completa a resposta que ficou parada enquanto minimizado
      // Rola para a ÚLTIMA mensagem: com histórico, o scroll foi calculado com o
      // painel oculto (scrollHeight=0), então refazemos agora que ele é visível.
      setTimeout(function () {
        messagesEl.scrollTop = messagesEl.scrollHeight;
        inputEl.focus();
      }, 50);
    } else {
      // Minimizar animado: encolhe/desaparece (kbout) e só então esconde.
      bubble.style.fontSize = "";
      bubble.innerHTML = bubbleInner();
      ligarEscapeFoco(false);
      panel.classList.add("closing");
      clearTimeout(_closeT);
      _closeT = setTimeout(function () {
        if (!open) { panel.classList.remove("open"); panel.classList.remove("closing"); }
      }, 260);
    }
    atualizarBolha();
  }

  // ==== Mensagens ====
  // Linha do assistente: avatar (brilho/foto) + balão. Retorna a LINHA.
  function botRow(bubbleEl) {
    var row = document.createElement("div");
    row.className = "arow";
    var av = document.createElement("div");
    av.className = "av";
    av.innerHTML = cfg.avatarUrl ? '<img src="' + esc(cfg.avatarUrl) + '" alt="">' : ICON_BOT;
    row.appendChild(av);
    row.appendChild(bubbleEl);
    return row;
  }
  // Data/hora local da mensagem: "DD/MM/AAAA HH:MM" (usa o ISO se vier do histórico).
  function fmtHora(iso) {
    var d = iso ? new Date(iso) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function addTimestamp(role, iso) {
    var t = document.createElement("div");
    t.className = "mt " + (role === "user" ? "u" : "a");
    t.textContent = fmtHora(iso);
    messagesEl.appendChild(t);
  }
  function addMsg(role, text, iso) {
    var el = document.createElement("div");
    el.className = "m " + (role === "user" ? "u" : "a");
    el.textContent = text;
    if (role === "user") {
      // Com token de rastreio, o balão do usuário ganha um botão de "salvar
      // prompt" que aparece ao passar o mouse.
      if (hasPromptIdentity()) {
        var row = document.createElement("div");
        row.className = "urow";
        var sv = document.createElement("button");
        sv.className = "savep";
        sv.type = "button";
        sv.title = "Salvar como prompt para reusar";
        sv.innerHTML = ICON_BOOKMARK;
        sv.addEventListener("click", function () {
          saveCurrentPrompt(text, sv);
        });
        row.appendChild(sv);
        row.appendChild(el);
        messagesEl.appendChild(row);
      } else {
        messagesEl.appendChild(el);
      }
    } else {
      messagesEl.appendChild(botRow(el)); // assistente ganha avatar ao lado
    }
    addTimestamp(role, iso);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }
  function renderWelcome() {
    if (cfg.welcome) addMsg("assistant", cfg.welcome);
    if (cfg.suggestions && cfg.suggestions.length) {
      var box = document.createElement("div");
      box.className = "sugg";
      cfg.suggestions.forEach(function (q) {
        var b = document.createElement("button");
        b.textContent = q;
        b.addEventListener("click", function () {
          inputEl.value = q;
          submit();
          box.remove();
        });
        box.appendChild(b);
      });
      messagesEl.appendChild(box);
    }
  }

  // Ao montar: relê o histórico desta identidade/sessão (respeitando o "Limpar"
  // anterior). Se houver, mostra a conversa; senão, a saudação padrão.
  function loadInitialMessages() {
    var cleared = null;
    try {
      cleared = localStorage.getItem(LS_CLEARED);
    } catch {
      cleared = null;
    }
    var body = { sessionId: sessionId };
    if (track) body.track = track;
    if (cleared) body.afterIso = cleared;
    fetch(API + "/api/v1/history", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Widget-Key": KEY },
      body: JSON.stringify(body),
    })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (h) {
        if (h && h.messages && h.messages.length) {
          renderHistory(h.messages);
          if (h.conversationId) conversationId = h.conversationId;
        } else {
          renderWelcome();
        }
      })
      .catch(function () {
        renderWelcome();
      });
  }

  function renderHistory(msgs) {
    msgs.forEach(function (m) {
      // Mensagem SÓ de mídia (ex.: gráfico do fluxo de botões): renderiza a mídia SEM a
      // bolha vazia de texto.
      if (m.role === "assistant" && (!m.content || !m.content.trim()) && m.media && m.media.length) {
        renderMedia(m.media);
        history.push({ role: m.role, content: m.content || "" });
        return;
      }
      var el = addMsg(m.role, m.content, m.createdAt);
      if (m.role === "assistant") {
        el.innerHTML = mdToHtml(m.content);
        if (m.citations && m.citations.length) renderCitations(m.citations);
        if (m.media && m.media.length) renderMedia(m.media); // gráficos/PDFs persistidos
      } else if (m.attachments && m.attachments.length) {
        renderMsgAtts(m.attachments);
      }
      history.push({ role: m.role, content: m.content });
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // "Limpar" VISUAL: esvazia a tela e recomeça; grava o instante para o histórico
  // anterior não voltar. Nada é apagado no servidor (admin/analytics veem tudo).
  function clearChat() {
    history = [];
    conversationId = null;
    contextScope = null;
    _harvested = null; _harvestCache = null; // esquece a coleta em cache
    _relatorioVazioSinal = null; // esquece o sinal de relatório vazio
    _fonte = null; _fonteKey = null; // esquece a fonte escolhida (relatório/IA)
    try {
      localStorage.setItem(LS_CLEARED, new Date().toISOString());
    } catch {
      /* storage indisponível */
    }
    messagesEl.innerHTML = "";
    renderWelcome();
  }

  var history = [];
  var busy = false;
  // PARAR: controle de interrupção. `_chatAbort` aborta o fetch do chat (o servidor
  // recebe req.signal e para o streamText); `_coletaXhr`/`_coletaAbort` abortam a coleta
  // do Oracle (apex.server.process / ORDS); `_parando` marca que o usuário interrompeu,
  // para descartar continuações/coletas em voo sem mostrar erro.
  var _chatAbort = null, _coletaXhr = null, _coletaAbort = null, _parando = false;
  // Alterna o botão enviar↔parar e mantém `busy` num só lugar (não desabilita: durante o
  // processamento o mesmo botão vira "Parar" e continua clicável).
  function setBusyUI(b) {
    busy = b;
    if (!sendBtn) return;
    try {
      sendBtn.disabled = false;
      sendBtn.classList.toggle("kb-stop", b);
      sendBtn.setAttribute("aria-label", b ? "Parar" : "Enviar");
      sendBtn.innerHTML = b ? ICON_STOP : ICON_SEND;
    } catch { }
  }
  // Interrompe TUDO que estiver em voo: geração da IA e coleta do Oracle.
  function pararTudo() {
    _parando = true;
    try { if (_chatAbort) _chatAbort.abort(); } catch { }
    try { if (_coletaXhr && _coletaXhr.abort) _coletaXhr.abort(); } catch { }
    try { if (_coletaAbort) _coletaAbort.abort(); } catch { }
    _chatAbort = null; _coletaXhr = null; _coletaAbort = null;
    try { limparProcStatus(); } catch { }
    // remove o balão "digitando" se houver (a coleta não tem catch p/ limpá-lo).
    try { var d = messagesEl && messagesEl.querySelector(".m.a .dots"); if (d) { var row = d.closest(".row") || d.closest(".m"); if (row && row.parentNode) row.parentNode.removeChild(row); } } catch { }
    setBusyUI(false);
    statusMsg("Interrompido.", "#b45309");
  }
  // Tema em foco na conversa (eco do servidor via evento SSE `theme`). Vai como
  // `contextScope` na próxima pergunta — evita perguntar de novo no mesmo assunto.
  var contextScope = null;

  // Pergunta de desambiguação: renderiza os botões de tema; ao clicar, re-consulta
  // já filtrada (reaproveita o estilo `.sugg` das perguntas sugeridas).
  // Botões para escolher o TIPO do gráfico. Ao clicar, completa a spec e desenha
  // NA HORA (reusa renderChart) — sem ida ao servidor.
  // Após clicar um botão de pergunta do agente: NÃO remove — TRAVA (desabilita todos,
  // destaca o escolhido, apaga os outros) para tudo ficar visível no chat.
  function travarEscolha(box, btn) {
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    try {
      var bs = box.querySelectorAll("button");
      for (var i = 0; i < bs.length; i++) {
        var b = bs[i];
        b.disabled = true; b.style.cursor = "default";
        if (b === btn) { b.style.background = pc; b.style.color = "#fff"; b.style.borderColor = pc; b.style.fontWeight = "700"; b.style.opacity = "1"; }
        else { b.style.opacity = ".45"; }
      }
      // Multi-seleção: trava também os checkboxes e a busca — senão continuam
      // clicáveis depois de confirmado e não fazem mais nada.
      var ins = box.querySelectorAll("input");
      for (var j = 0; j < ins.length; j++) { ins[j].disabled = true; ins[j].style.cursor = "default"; }
    } catch (e) { }
  }
  // Registra a pergunta do agente + a opção clicada (+ gráfico) no HISTÓRICO, para o Q&A
  // dos botões reaparecer ao reabrir a conversa. Best-effort (só com identidade + conversa).
  function persistirEscolha(pergunta, escolha, chart) {
    if (!conversationId || !hasPromptIdentity()) return;
    var payload = { action: "append", conversationId: conversationId };
    if (pergunta) payload.pergunta = pergunta;
    if (escolha) payload.escolha = escolha;
    if (chart) payload.chart = chart;
    try { apiConversas(payload); } catch (e) { }
  }
  function renderChartChoice(pergunta, spec, recomendado) {
    if (pergunta) addMsg("assistant", pergunta);
    var box = document.createElement("div");
    box.className = "opts";
    CHART_TIPOS.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = t[1] + (t[0] === recomendado ? "  ★" : "");
      if (t[0] === recomendado) b.title = "Recomendado";
      b.addEventListener("click", function () {
        travarEscolha(box, b);
        var s = {}; for (var k in spec) s[k] = spec[k];
        s.tipo = t[0];
        renderChart(s);
        persistirEscolha(pergunta, t[1], s); // pergunta + tipo escolhido + o gráfico resultante
        messagesEl.scrollTop = messagesEl.scrollHeight;
      });
      box.appendChild(b);
    });
    messagesEl.appendChild(box);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  function normFonte(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function renderClarify(question, options, multiSelect, outros) {
    if (question) addMsg("assistant", question);
    var box = document.createElement("div");
    box.className = "opts";
    // MULTI-SELEÇÃO (pergunta composta): CHECKBOXES reais — o usuário marca TODAS as fontes
    // (relatório + N ferramentas) de uma vez e clica UMA vez em confirmar; vira um scope único.
    if (multiSelect) {
      var checks = [];
      var marcadosOutros = {};   // chave da tool → marcada (sobrevive à refiltragem da lista)
      var campoOutro = null;     // input de descrição livre, quando "Outra fonte" está aberta
      (options || []).forEach(function (o) {
        var row = document.createElement("label");
        row.className = "opt";
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = !!o.checked; // a IA já pré-marca as fontes ADERENTES; o usuário só confirma/ajusta
        var txt = document.createElement("span");
        txt.className = "otx";
        if (o.sublabel) {
          var ol = document.createElement("span"); ol.className = "ol"; ol.textContent = o.label;
          var os = document.createElement("span"); os.className = "os"; os.textContent = o.sublabel;
          txt.appendChild(ol); txt.appendChild(os);
        } else {
          txt.textContent = o.label;
        }
        row.appendChild(cb);
        row.appendChild(txt);
        row.classList.toggle("on", cb.checked);
        cb.addEventListener("change", function () { row.classList.toggle("on", cb.checked); });
        box.appendChild(row);
        if (!o.outro) { checks.push({ cb: cb, o: o }); return; }
        // "OUTRA FONTE": abre uma gaveta com o catálogo COMPLETO — o usuário escolhe
        // da lista OU escreve o que precisa. Marcar a linha já mostra as primeiras,
        // então quem não sabe o que digitar continua tendo o que clicar.
        var gav = document.createElement("div");
        gav.className = "ofx";
        var busca = document.createElement("input");
        busca.className = "find";
        busca.type = "text";
        busca.placeholder = "Busque pelo nome ou escreva o que você precisa…";
        var lista = document.createElement("div");
        lista.className = "flist";
        gav.appendChild(busca); gav.appendChild(lista);
        box.appendChild(gav);
        campoOutro = busca;
        function pintarLista() {
          var termo = normFonte(busca.value).trim();
          var base = outros || [];
          var achou = termo
            ? base.filter(function (t) { return normFonte(t.n + " " + (t.d || "")).indexOf(termo) >= 0; })
            : base;
          lista.textContent = "";
          achou.slice(0, 8).forEach(function (t) {
            var l = document.createElement("label");
            l.className = "opt";
            var c = document.createElement("input");
            c.type = "checkbox";
            c.checked = !!marcadosOutros[t.k]; // restaura o que já estava marcado
            c.addEventListener("change", function () {
              marcadosOutros[t.k] = c.checked;
              l.classList.toggle("on", c.checked);
            });
            var s = document.createElement("span");
            s.className = "otx";
            var sl = document.createElement("span"); sl.className = "ol"; sl.textContent = t.n;
            s.appendChild(sl);
            if (t.d) { var sd = document.createElement("span"); sd.className = "os"; sd.textContent = t.d; s.appendChild(sd); }
            l.appendChild(c); l.appendChild(s);
            l.classList.toggle("on", c.checked);
            lista.appendChild(l);
          });
          if (!achou.length) {
            var vazio = document.createElement("div");
            vazio.className = "fnone";
            vazio.textContent = "Nenhuma fonte com esse nome — vou usar sua descrição: “" + busca.value.trim() + "”";
            lista.appendChild(vazio);
          }
        }
        busca.addEventListener("input", pintarLista);
        cb.addEventListener("change", function () {
          gav.classList.toggle("on", cb.checked);
          if (!cb.checked) return;
          pintarLista();                       // mostra a lista ANTES de digitar nada
          try { busca.focus(); } catch (e) { }
          try { row.scrollIntoView({ block: "nearest" }); } catch (e) { }
        });
      });
      var conf = document.createElement("button");
      conf.className = "go";
      conf.textContent = "Buscar nessas fontes";
      conf.addEventListener("click", function () {
        var sel = checks.filter(function (c) { return c.cb.checked; }).map(function (c) { return c.o; });
        var extras = (outros || []).filter(function (t) { return marcadosOutros[t.k]; });
        var descricao = campoOutro ? campoOutro.value.replace(/\s+/g, " ").trim().slice(0, 200) : "";
        if (!sel.length && !extras.length && !descricao) { conf.textContent = "Marque uma fonte ou descreva…"; return; }
        // Junta as escolhas num scope único: força TODAS as tools + mantém o relatório.
        var scope = { direto: true }, tools = [], usarRel = false;
        sel.forEach(function (o) { if (o.relatorio) usarRel = true; else if (o.tool) tools.push(o.tool); });
        extras.forEach(function (t) { tools.push({ k: t.k, n: t.n, d: t.d || "" }); });
        if (tools.length) { scope.fonte = "ia"; scope.tools = tools; }
        if (usarRel) { scope.usarRelatorio = true; if (!tools.length) scope.fonte = "relatorio"; }
        // Só descrição livre: precisa de `fonte` explícita, senão o roteador do
        // servidor não vê escolha nenhuma e reabre o gate.
        if (descricao) { scope.outraFonte = descricao; if (!scope.fonte) scope.fonte = "ia"; }
        travarEscolha(box, conf);
        var rotulos = sel.map(function (o) { return o.label; })
          .concat(extras.map(function (t) { return t.n; }));
        if (descricao) rotulos.push("“" + descricao + "”");
        persistirEscolha(question, rotulos.join(" + "));
        ask(scope);
      });
      box.appendChild(conf);
      messagesEl.appendChild(box);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return;
    }
    (options || []).forEach(function (o) {
      var b = document.createElement("button");
      if (o.sublabel) {
        // Cartão: nome do artigo em destaque + resumo abaixo (igual ao portal).
        var ol = document.createElement("span");
        ol.className = "ol";
        ol.textContent = o.label;
        var os = document.createElement("span");
        os.className = "os";
        os.textContent = o.sublabel;
        b.appendChild(ol);
        b.appendChild(os);
      } else {
        b.textContent = o.label;
      }
      b.addEventListener("click", function () {
        travarEscolha(box, b);
        persistirEscolha(question, o.label);
        if (o.outro) {
          // [Outro]: em vez de enviar, deixa o usuário detalhar melhor o pedido.
          if (inputEl) { inputEl.focus(); inputEl.placeholder = "Descreva com mais detalhes o que você precisa…"; }
        } else {
          ask(o.scope);
        }
      });
      box.appendChild(b);
    });
    messagesEl.appendChild(box);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Auto-cresce a caixa de texto conforme as linhas, até 5 linhas; depois rola.
  function autoGrow() {
    inputEl.style.height = "auto";
    var cs = getComputedStyle(inputEl);
    var lh = parseFloat(cs.lineHeight) || 18;
    var padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    var max = lh * 5 + padY;
    inputEl.style.height = Math.min(inputEl.scrollHeight, max) + "px";
    inputEl.style.overflowY = inputEl.scrollHeight > max ? "auto" : "hidden";
  }

  // ==== Anexos (documentos) ====
  // Sobe cada arquivo para /api/v1/attach; o servidor valida, guarda e extrai o
  // texto. O id volta e vai em `attachmentIds` na próxima pergunta.
  function uploadAttachment(file) {
    var entry = { name: file.name, uploading: true };
    pendingAtts.push(entry);
    renderAtts();
    var fd = new FormData();
    fd.append("file", file);
    fetch(API + "/api/v1/attach", { method: "POST", headers: { "X-Widget-Key": KEY }, body: fd })
      .then(function (r) {
        return r.json().catch(function () {
          return {};
        });
      })
      .then(function (j) {
        var idx = pendingAtts.indexOf(entry);
        if (idx < 0) return; // removido enquanto subia
        if (j && j.attachment) {
          pendingAtts[idx] = j.attachment;
        } else {
          pendingAtts.splice(idx, 1);
          addMsg("assistant", "Não consegui anexar “" + file.name + "”: " + ((j && j.error) || "falha no envio") + ".");
        }
        renderAtts();
      })
      .catch(function () {
        var idx = pendingAtts.indexOf(entry);
        if (idx >= 0) pendingAtts.splice(idx, 1);
        renderAtts();
        addMsg("assistant", "Falha ao anexar “" + file.name + "”.");
      });
  }

  function renderAtts() {
    attzEl.innerHTML = "";
    if (!pendingAtts.length) {
      attzEl.style.display = "none";
      return;
    }
    attzEl.style.display = "flex";
    pendingAtts.forEach(function (a) {
      var chip = document.createElement("span");
      chip.className = "attc" + (a.uploading ? " up" : "");
      var ic = document.createElement("span");
      ic.className = "atti";
      ic.innerHTML = attIcon(a);
      var nm = document.createElement("span");
      nm.className = "attn";
      nm.textContent = a.name;
      chip.appendChild(ic);
      chip.appendChild(nm);
      if (a.uploading) {
        var sp = document.createElement("span");
        sp.className = "atts";
        sp.textContent = "…";
        chip.appendChild(sp);
      } else {
        var rm = document.createElement("button");
        rm.className = "attx";
        rm.type = "button";
        rm.setAttribute("aria-label", "Remover anexo");
        rm.textContent = "×";
        rm.addEventListener("click", function () {
          var i = pendingAtts.indexOf(a);
          if (i >= 0) {
            pendingAtts.splice(i, 1);
            renderAtts();
          }
        });
        chip.appendChild(rm);
      }
      attzEl.appendChild(chip);
    });
  }

  // Chips dos anexos ENVIADOS, sob a mensagem do usuário (alinhados à direita).
  function renderMsgAtts(atts) {
    var row = document.createElement("div");
    row.className = "matts";
    atts.forEach(function (a) {
      var chip = document.createElement("span");
      chip.className = "attc ro";
      var ic = document.createElement("span");
      ic.className = "atti";
      ic.innerHTML = attIcon(a);
      var nm = document.createElement("span");
      nm.className = "attn";
      nm.textContent = a.name;
      chip.appendChild(ic);
      chip.appendChild(nm);
      row.appendChild(chip);
    });
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ==== Voz: gravação estilo WhatsApp (onda ao vivo, tempo, ouvir, enviar/apagar) ====
  function setMic(state) {
    micState = state;
    if (!micBtn) return;
    micBtn.disabled = state === "transcribing";
    micBtn.innerHTML = ICON_MIC;
    micBtn.title = state === "transcribing" ? "Transcrevendo…" : "Falar (gravar áudio)";
  }
  function vbtn(cls, icone, title, fn) {
    var b = document.createElement("button"); b.type = "button"; b.className = "vbtn " + cls; b.title = title; b.setAttribute("aria-label", title);
    b.innerHTML = icone; if (fn) b.addEventListener("click", fn); return b;
  }
  function fmtTempo(seg) { seg = seg || 0; var m = Math.floor(seg / 60), s = Math.floor(seg % 60); return m + ":" + (s < 10 ? "0" : "") + s; }
  function roundRectFill(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill(); }
  function vozFt() { return panel && panel.querySelector(".ft"); }
  function criarVoiceBar() {
    if (voiceBar) return voiceBar;
    var ft = vozFt(); if (!ft) return null;
    voiceBar = document.createElement("div"); voiceBar.className = "vbar"; ft.appendChild(voiceBar);
    return voiceBar;
  }
  function limparVoz() {
    if (_voRAF) { cancelAnimationFrame(_voRAF); _voRAF = 0; }
    if (_voTimerInt) { clearInterval(_voTimerInt); _voTimerInt = 0; }
    try { if (_voStream) _voStream.getTracks().forEach(function (t) { t.stop(); }); } catch { }
    _voStream = null;
    try { if (_voCtx) _voCtx.close(); } catch { }
    _voCtx = null; _voAnalyser = null;
    try { if (_voAudio) _voAudio.pause(); } catch { }
    if (_voUrl) { try { URL.revokeObjectURL(_voUrl); } catch { } _voUrl = null; }
    _voAudio = null; _voBlob = null;
    var ft = vozFt(); if (ft) ft.classList.remove("voz");
    if (voiceBar) voiceBar.innerHTML = "";
    setMic("idle");
  }
  function toggleMic() {
    if (micState === "recording") { if (mediaRec && mediaRec.state === "recording") mediaRec.stop(); return; }
    if (micState !== "idle") return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { addMsg("bot", "Gravação de voz não é suportada neste navegador."); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      _voStream = stream; _voCancelado = false;
      try { mediaRec = new MediaRecorder(stream); }
      catch { limparVoz(); addMsg("bot", "Não foi possível iniciar a gravação neste navegador."); return; }
      micChunks = [];
      mediaRec.ondataavailable = function (e) { if (e.data && e.data.size) micChunks.push(e.data); };
      mediaRec.onstop = function () {
        if (_voRAF) { cancelAnimationFrame(_voRAF); _voRAF = 0; }
        if (_voTimerInt) { clearInterval(_voTimerInt); _voTimerInt = 0; }
        try { if (_voStream) _voStream.getTracks().forEach(function (t) { t.stop(); }); } catch { }
        try { if (_voCtx) _voCtx.close(); } catch { } _voCtx = null; _voAnalyser = null;
        if (_voCancelado) { limparVoz(); return; } // usuário apagou durante a gravação
        var blob = new Blob(micChunks, { type: (mediaRec && mediaRec.mimeType) || "audio/webm" });
        if (blob.size < 800) { limparVoz(); return; } // vazio/curtíssimo
        _voBlob = blob; revisarVoz(blob);
      };
      try {
        _voCtx = new (window.AudioContext || window.webkitAudioContext)();
        var src = _voCtx.createMediaStreamSource(stream);
        _voAnalyser = _voCtx.createAnalyser(); _voAnalyser.fftSize = 256; src.connect(_voAnalyser);
      } catch { _voAnalyser = null; }
      mediaRec.start(); setMic("recording"); montarBarraGravando();
    }, function () { addMsg("bot", "Não consegui acessar o microfone (permissão negada?)."); });
  }
  function montarBarraGravando() {
    var ft = vozFt(); if (!ft) return;
    criarVoiceBar(); voiceBar.innerHTML = ""; ft.classList.add("voz");
    var del = vbtn("del", ICON_TRASH, "Cancelar", function () { _voCancelado = true; if (mediaRec && mediaRec.state === "recording") mediaRec.stop(); else limparVoz(); });
    var dot = document.createElement("span"); dot.className = "vdot";
    var time = document.createElement("span"); time.className = "vtime"; time.textContent = "0:00";
    var canvas = document.createElement("canvas"); canvas.className = "vwave";
    var stop = vbtn("ok", ICON_STOP, "Parar", function () { if (mediaRec && mediaRec.state === "recording") mediaRec.stop(); });
    voiceBar.appendChild(del); voiceBar.appendChild(dot); voiceBar.appendChild(time); voiceBar.appendChild(canvas); voiceBar.appendChild(stop);
    _voT0 = Date.now();
    _voTimerInt = setInterval(function () { try { time.textContent = fmtTempo((Date.now() - _voT0) / 1000); } catch { } }, 250);
    ondasAoVivo(canvas);
  }
  function ondasAoVivo(canvas) {
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var buf = _voAnalyser ? new Uint8Array(_voAnalyser.frequencyBinCount) : null;
    (function frame() {
      _voRAF = requestAnimationFrame(frame);
      var dpr = window.devicePixelRatio || 1, w = canvas.clientWidth || 120, h = canvas.clientHeight || 26;
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      var ctx = canvas.getContext("2d"); if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      if (buf && _voAnalyser) _voAnalyser.getByteFrequencyData(buf);
      var bars = Math.max(8, Math.floor(w / 5)), bw = 3, gap = bars > 1 ? (w - bars * bw) / (bars - 1) : 0;
      ctx.fillStyle = pc; ctx.globalAlpha = 0.85;
      for (var i = 0; i < bars; i++) {
        var v = 0.14;
        if (buf) { var idx = Math.floor(i / bars * buf.length); v = Math.max(0.14, (buf[idx] || 0) / 255); }
        var bh = Math.max(2, v * h);
        roundRectFill(ctx, i * (bw + gap), (h - bh) / 2, bw, bh, 1.5);
      }
      ctx.globalAlpha = 1;
    })();
  }
  function ondasEstatico(canvas) {
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    requestAnimationFrame(function () {
      var dpr = window.devicePixelRatio || 1, w = canvas.clientWidth || 120, h = canvas.clientHeight || 26;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      var ctx = canvas.getContext("2d"); if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      var bars = Math.max(8, Math.floor(w / 5)), bw = 3, gap = bars > 1 ? (w - bars * bw) / (bars - 1) : 0;
      ctx.fillStyle = pc; ctx.globalAlpha = 0.55;
      for (var i = 0; i < bars; i++) { var v = 0.25 + 0.6 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.31)); var bh = Math.max(2, v * h); roundRectFill(ctx, i * (bw + gap), (h - bh) / 2, bw, bh, 1.5); }
      ctx.globalAlpha = 1;
    });
  }
  function revisarVoz(blob) {
    var ft = vozFt(); if (!ft) { limparVoz(); return; }
    criarVoiceBar(); voiceBar.innerHTML = ""; ft.classList.add("voz");
    _voUrl = URL.createObjectURL(blob); _voAudio = new Audio(_voUrl);
    var del = vbtn("del", ICON_TRASH, "Apagar", function () { limparVoz(); });
    var play = vbtn("play", ICON_PLAY, "Ouvir", null);
    var time = document.createElement("span"); time.className = "vtime"; time.textContent = "0:00";
    var canvas = document.createElement("canvas"); canvas.className = "vwave";
    var send = vbtn("ok", ICON_SEND, "Enviar", function () { enviarVoz(); });
    play.addEventListener("click", function () {
      if (_voAudio.paused) { _voAudio.play(); play.innerHTML = ICON_PAUSE; } else { _voAudio.pause(); play.innerHTML = ICON_PLAY; }
    });
    _voAudio.addEventListener("timeupdate", function () { try { time.textContent = fmtTempo(_voAudio.currentTime); } catch { } });
    _voAudio.addEventListener("ended", function () { play.innerHTML = ICON_PLAY; });
    _voAudio.addEventListener("loadedmetadata", function () { try { if (isFinite(_voAudio.duration)) time.textContent = fmtTempo(_voAudio.duration); } catch { } });
    voiceBar.appendChild(del); voiceBar.appendChild(play); voiceBar.appendChild(time); voiceBar.appendChild(canvas); voiceBar.appendChild(send);
    ondasEstatico(canvas);
  }
  function enviarVoz() {
    if (!_voBlob) { limparVoz(); return; }
    var blob = _voBlob;
    var ft = vozFt(); if (ft) ft.classList.remove("voz");
    if (voiceBar) voiceBar.innerHTML = "";
    try { if (_voAudio) _voAudio.pause(); } catch { }
    if (_voUrl) { try { URL.revokeObjectURL(_voUrl); } catch { } _voUrl = null; }
    _voAudio = null;
    setMic("transcribing");
    var fd = new FormData(); fd.append("file", blob, "audio.webm"); fd.append("key", KEY);
    fetch(API + "/api/v1/transcribe", { method: "POST", headers: { "X-Widget-Key": KEY }, body: fd })
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (d) {
        _voBlob = null; setMic("idle");
        var text = d && d.transcribed && d.text ? String(d.text).trim() : "";
        if (text) {
          if (busy) { inputEl.value = (inputEl.value.trim() ? inputEl.value + " " : "") + text; autoGrow(); try { localStorage.setItem(LS_DRAFT, inputEl.value); } catch { } }
          else { inputEl.value = text; submit(); }
        } else addMsg("bot", (d && d.error) || "Não consegui transcrever o áudio.");
      })
      .catch(function () { _voBlob = null; setMic("idle"); addMsg("bot", "Falha ao transcrever o áudio."); });
  }

  function submit() {
    if (busy) return;
    // Espera terminar uploads em andamento.
    if (pendingAtts.some(function (a) { return a.uploading; })) return;
    var atts = pendingAtts.filter(function (a) { return a.id; });
    var text = inputEl.value.trim();
    if (!text && !atts.length) return;
    // Anexo sem texto: dá uma instrução padrão para o modelo ter o que fazer.
    if (!text && atts.length) text = "Pode analisar o(s) arquivo(s) que anexei e me ajudar?";
    inputEl.value = "";
    try { localStorage.removeItem(LS_DRAFT); } catch { } // enviou → limpa o rascunho
    autoGrow();
    addMsg("user", text);
    if (atts.length) renderMsgAtts(atts);
    history.push({ role: "user", content: text });
    var ids = atts.map(function (a) { return a.id; });
    pendingAtts = [];
    renderAtts();
    _comparacao = null; // nova mensagem → zera a comparação anterior
    // Fase B: pedido EXPLÍCITO de comparar com um salvo → abre o seletor (não vai à IA,
    // que confundiria com o relatório da tela). Sem oferta automática (removida).
    if (cfg.formAssist && intencaoCompararSalvo(text)) { iniciarComparacaoExplicita(text, ids); return; }
    // Pedido de ACESSAR/VER os relatórios salvos → abre a lista (a IA não consegue).
    if (cfg.formAssist && intencaoVerSalvos(text)) { statusMsg("Abrindo seus relatórios salvos…", null); abrirRelatoriosSalvos(); return; }
    ask(undefined, ids);
  }

  function ask(scope, attachmentIds, opts) {
    var continuacao = !!(opts && opts.continuation);
    var loopStep = !!(opts && opts.loopStep); // continuação do loop autônomo (pós-ação)
    // PARAR: se o usuário interrompeu, descarta continuações/coletas em voo. Uma ação do
    // usuário (nova mensagem / clique em botão — !continuacao) reinicia o estado.
    if (continuacao && _parando) return;
    if (!continuacao) _parando = false;
    // Mensagem nova do usuário (ou desambiguação) → zera o loop autônomo e
    // encerra um tutorial em andamento (o usuário mudou de assunto).
    if (!continuacao) { _loopStep = 0; _loopCancel = false; _execLabels = []; _filtroConfirmado = false; _harvested = null; limparDestaques(); if (_tutorial) encerrarTutorial(); }
    // FONTE (Fase 1): ao clicar num botão de fonte, memoriza a escolha por relatório.
    // Em novas mensagens do MESMO relatório, reaproveita (não pergunta de novo).
    if (scope && scope.fonte) { _fonte = scope.fonte; _fonteKey = keyRelatorioTela(); }
    if (!scope && !continuacao && _fonte && _fonteKey && _fonteKey === keyRelatorioTela()) {
      scope = { fonte: _fonte };
    }
    _turnActed = false; // recomeça a cada turno; habilita o próximo passo se agir
    _avisouTurno = continuacao; // continuação do loop não toca o som; resposta nova pode
    desbloquearAudio(); // envio é gesto do usuário → libera o som p/ tocar depois
    setBusyUI(true); // botão vira "Parar"
    var typingBubble = document.createElement("div");
    typingBubble.className = "m a";
    typingBubble.innerHTML = '<span class="dots"><span></span><span></span><span></span></span>';
    var typing = botRow(typingBubble); // avatar + balão de "digitando"
    messagesEl.appendChild(typing);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    var answerEl = null;
    var full = ""; // texto completo já recebido do servidor
    var citations = [];
    var clarified = false;
    var ehFinalTurno = true; // false em passos intermediários do loop (sem feedback/citações)
    _acoes = []; // ações de tela recebidas NESTE turno (guard de stream vazio)
    _charts = []; // gráficos recebidos NESTE turno (guard de stream vazio)
    var _teveArquivo = false; // arquivo (PDF/Excel/Word…) entregue neste turno
    var _teveEscolha = false; // botões de escolha (ex.: tipo de gráfico) exibidos
    var _teveDestaque = false; // a IA realçou algo na tela neste turno
    var _coletando = false;   // a IA pediu a coleta multi-página do relatório
    // Revelação suave: exibe o texto num ritmo constante (rAF), desacoplado das
    // rajadas do streaming — em vez de aparecer em blocos, "digita" liso.
    var shown = 0, stopped = false, rafId = null, feito = false;
    function finalizarReveal() {
      // Passos intermediários do loop não mostram citações/feedback (só o resumo final).
      feito = true;
      if (ehFinalTurno) {
        if (citations.length) renderCitations(citations);
        renderFeedback();
      }
      if (_revealFlush === flushReveal) _revealFlush = null;
    }
    // Pinta a resposta INTEIRA de uma vez (sem a animação) e conclui se o stream
    // já acabou. Usado quando o rAF está pausado (aba oculta) ou ao reabrir o chat.
    function flushReveal() {
      if (feito) return;
      if (rafId != null) { try { cancelAnimationFrame(rafId); } catch { } rafId = null; }
      if (answerEl) {
        shown = full.length;
        answerEl.innerHTML = mdToHtml(full);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
      if (stopped) finalizarReveal();
    }
    _revealFlush = flushReveal; // exposto p/ toggle()/visibilitychange completarem se travar
    function agendarReveal() {
      if (rafId != null) return;
      // Aba em segundo plano: o navegador PAUSA o rAF → pinta tudo já, senão a
      // resposta fica "parada" enquanto está oculta e só apareceria ao voltar.
      if (typeof document !== "undefined" && document.hidden) { flushReveal(); return; }
      rafId = requestAnimationFrame(passoReveal);
    }
    function passoReveal() {
      rafId = null;
      if (answerEl && shown < full.length) {
        // Auto-scroll só se já está perto do fim (não "puxa" quem rolou p/ ler).
        var perto = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 80;
        // Ritmo suave: no mínimo 2 chars/quadro; acelera se acumulou muito (não fica pra trás).
        var restante = full.length - shown;
        shown += Math.min(restante, Math.max(2, Math.ceil(restante / 12)));
        answerEl.innerHTML = mdToHtml(full.slice(0, shown));
        if (perto) messagesEl.scrollTop = messagesEl.scrollHeight;
      }
      if (shown < full.length) agendarReveal();
      else if (stopped && !feito) finalizarReveal();
    }

    var body = { messages: history, conversationId: conversationId, sessionId: sessionId };
    if (scope) body.scope = scope;
    if (contextScope) body.contextScope = contextScope;
    if (track) body.track = track;
    if (widgetLang && widgetLang !== "pt") body.lang = widgetLang; // idioma escolhido no seletor

    if (attachmentIds && attachmentIds.length) body.attachmentIds = attachmentIds;
    // Loop autônomo: pede à IA que CONTINUE a tarefa com a tela já atualizada.
    if (continuacao) { body.continuation = true; body.executedActions = _execLabels.slice(-40); }
    var pg = pageContext();
    if (pg) body.page = pg;
    // Varredura da tela (DADOS/VALORES) — só quando o "Assistente de formulário
    // (ler e preencher campos)" está LIGADO: é a leitura da tela. Desligado, NADA
    // dos dados/valores da tela é enviado. (`cfg.scan === false` desliga mesmo
    // com o assistente ligado.) O servidor também ignora sem formAssist.
    if (cfg.formAssist && cfg.scan !== false) {
      var scan = scanPage();
      if (scan.text) body.pageContent = scan.text;
      if (scan.tables && scan.tables.length) body.screenTables = scan.tables;
      // B — sinaliza relatório VAZIO: (1) a coleta retornou 0 linhas (_relatorioVazioSinal,
      // sinal confiável) ou (2) heurística de DOM quando NÃO há nenhuma tabela com dados.
      if (_relatorioVazioSinal) { body.emptyReport = _relatorioVazioSinal; }
      else if (!(body.screenTables && body.screenTables.length)) {
        var _rvz = relatorioVazioNaTela();
        if (_rvz) { body.emptyReport = _rvz; diag("relatório vazio na tela → oferece filtrar (" + (_rvz.nome || "-") + ")"); }
      }
    }
    // Assistente de formulário: envia o mapa estruturado dos campos da tela para
    // a IA opinar/preencher (só se habilitado na config deste widget).
    if (cfg.formAssist) {
      var flds = scanFields();
      if (flds.length) body.fields = flds;
      // DIAGNÓSTICO: campos editáveis captados (rótulo:tipo) — p/ conferir se o campo
      // de filtro (ex.: "Filial") está sendo detectado e como (e a barra vira "busca").
      try { diag("campos: " + flds.filter(function (f) { return f.type !== "botao"; }).map(function (f) { return f.label + "(" + f.type + ")"; }).join(" · ")); } catch { }
      // Campo em foco (após o scan, que marca data-kb-field): contexto p/ "aqui/isto".
      var foco = campoEmFoco();
      if (foco) body.focusedField = foco;
      // Identidade compacta da tela (nome/breadcrumb + títulos das regiões) → o RAG do
      // tutorial acha a doc DESTA tela sem despejar todos os campos na consulta.
      try {
        var _tit = tituloPrincipalPagina(), _reg = coletarTitulosRegioes();
        if (_tit || _reg.length) body.tela = { titulo: _tit || "", regioes: _reg };
      } catch (e) { }
    }
    // CONTEXTO (programa + filtros aplicados) → subtítulo do arquivo gerado e legenda do
    // gráfico/tabela. Independe do formAssist: o programa (título da página) e os chips do
    // Interactive Report vêm do DOM; os campos preenchidos entram só quando o assistente de
    // formulário os capturou (`flds`). Respeita `cfg.scan` (privacidade).
    if (cfg.scan !== false) {
      try {
        var _rvCtx = acharRegiaoCache(document) || document.querySelector(".a-IRR-reportView, .a-IRR, .a-GV");
        var _ctx = contextoRelatorio(typeof flds !== "undefined" ? flds : null, _rvCtx);
        if (_ctx.programa || _ctx.filtros.length) body.contexto = _ctx;
      } catch { }
    }
    // REAPROVEITA a coleta anterior em NOVAS perguntas sobre o MESMO relatório
    // (sem alteração de filtro/busca) — sem paginar de novo. Sem isto, uma 2ª
    // pergunta ("qual o mais antigo?") via só a página visível na tela (ex.: a
    // última, com 1 registro) e respondia errado, ignorando os dados já coletados.
    if (cfg.formAssist && !_harvested && _harvestCache && _harvestCache.linhas && _harvestCache.linhas.length) {
      if (acharRegiaoCache(document)) {
        // Relatório com a MESMA fingerprint (sem novo filtro/submit) → reusa os dados
        // já carregados; NÃO reconsulta a procedure PRC_DADOS_IR.
        _harvested = { key: _harvestCache.key, nome: _harvestCache.nome, colunas: _harvestCache.colunas, linhas: _harvestCache.linhas, total: _harvestCache.total, incompleto: _harvestCache.incompleto };
        diag("reuso: mesma fingerprint → usa cache (" + _harvestCache.linhas.length + " linhas), sem nova consulta");
      } else {
        diag("sem reuso: fingerprint mudou (novo filtro/submit) ou relatório diferente → vai reconsultar");
      }
    }
    // Coleta multi-página do relatório (todas as páginas) — enviada à parte para
    // não ser truncada com o resto da tela.
    if (cfg.formAssist && _harvested) {
      // F1: se já persistimos ESTE conjunto (mesmo relatório+filtro), manda só o id —
      // evita reenviar todas as linhas a cada turno. 1ª vez: manda inline (compat) e
      // persiste em 2º plano para os próximos turnos usarem o id.
      var _cch = (_harvestCache && _harvestCache.key === _harvested.key) ? _harvestCache : null;
      if (_cch && _cch.dsId) {
        body.reportDataId = _cch.dsId;
      } else {
        body.reportData = { nome: _harvested.nome, colunas: _harvested.colunas, linhas: _harvested.linhas, total: _harvested.total || _harvested.linhas.length, incompleto: !!_harvested.incompleto };
        if (_cch) persistirDataset(_cch);
      }
    }
    // Fase B: cruzamento com um relatório salvo (enviado quando o usuário compara).
    if (cfg.formAssist && _comparacao) body.comparacao = _comparacao;
    // "Base de Dados": fontes fixadas pelo usuário (relatórios salvos + uploads) + modo.
    if (cfg.formAssist) {
      var _fUp = baseUploads.filter(function (u) { return u.id; }).map(function (u) { return u.id; });
      if (baseRelIds.length || _fUp.length) body.baseDados = { relatorioIds: baseRelIds, attachmentIds: _fUp, modo: baseModo };
    }
    try {
      diag("envio: fonte=" + ((body.scope && body.scope.fonte) || "-") +
        " reportData=" + (body.reportData ? body.reportData.linhas.length : "-") +
        " reportDataId=" + (body.reportDataId || "-") +
        " screenTables=" + (body.screenTables ? body.screenTables.length : 0) +
        " paginado=" + (body.screenTables && body.screenTables[0] ? body.screenTables[0].paginado : "-") +
        " total=" + (body.screenTables && body.screenTables[0] ? body.screenTables[0].total : "-"));
    } catch { }
    _chatAbort = new AbortController(); // PARAR: permite abortar a geração da IA
    fetch(API + "/api/v1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Widget-Key": KEY },
      body: JSON.stringify(body),
      signal: _chatAbort.signal,
    })
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (j) {
            throw new Error(j.error || "Erro " + res.status);
          });
        }
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buf = "";
        function pump() {
          return reader.read().then(function (r) {
            if (r.done) return finish();
            buf += decoder.decode(r.value, { stream: true });
            var parts = buf.split("\n\n");
            buf = parts.pop();
            parts.forEach(function (chunk) {
              var line = chunk.replace(/^data:\s?/, "").trim();
              if (!line) return;
              var evt;
              try {
                evt = JSON.parse(line);
              } catch {
                return;
              }
              handle(evt);
            });
            return pump();
          });
        }
        return pump();
      })
      .catch(function (err) {
        if (typing.parentNode) typing.remove();
        // PARAR: aborto do usuário não é erro — só encerra o turno em silêncio.
        if (_parando || (err && err.name === "AbortError")) { done(); return; }
        addMsg("assistant", "Desculpe, houve um erro: " + err.message);
        done();
      });

    function handle(evt) {
      if (evt.type === "citations") {
        citations = evt.citations || [];
      } else if (evt.type === "theme") {
        contextScope = evt.scope || null;
      } else if (evt.type === "trace") {
        // RASTREIO do fluxo (envio → resposta): passo a passo no console p/ diagnóstico.
        try {
          var ps = Array.isArray(evt.passos) ? evt.passos : [];
          if (window.console && console.groupCollapsed) {
            console.groupCollapsed("[kb-chat][fluxo] " + (evt.desfecho || "?") + " — " + (evt.ms || 0) + "ms · " + ps.length + " passo(s)");
            ps.forEach(function (p) { console.log("+" + p.ms + "ms  " + p.passo, p.info || ""); });
            console.groupEnd();
          } else if (window.console && console.log) {
            console.log("[kb-chat][fluxo] " + (evt.desfecho || "?"), ps);
          }
        } catch { }
      } else if (evt.type === "clarify") {
        // COMPLEMENTAR × SUBSTITUTO: os gates de fonte chegam ANTES de qualquer texto e
        // são a resposta inteira do turno. Já a troca de fonte ("a tela não tem isso,
        // quer que eu busque?") chega DEPOIS da resposta — ali os botões acompanham o
        // texto em vez de descartá-lo. `clarified` só corta o turno quando não há texto.
        clarified = true;
        _teveEscolha = true;
        if (typing.parentNode) typing.remove();
        avisarMensagem();
        renderClarify(evt.question, evt.options, evt.multiSelect, evt.outros);
      } else if (evt.type === "token") {
        if (typing.parentNode) typing.remove();
        limparProcStatus(); // a resposta começou → tira o status "Analisando…"
        if (!answerEl) answerEl = addMsg("assistant", "");
        avisarMensagem(); // resposta chegando com o widget minimizado → badge + som (1×/resposta)
        full += evt.value;
        agendarReveal(); // exibe suave, no ritmo do rAF (não em blocos)
      } else if (evt.type === "done") {
        if (evt.conversationId) conversationId = evt.conversationId;
      } else if (evt.type === "error") {
        if (typing.parentNode) typing.remove();
        addMsg("assistant", evt.message || "Erro ao gerar a resposta.");
      } else if (evt.type === "file") {
        // Arquivo retornado por uma API (holerite, recibo…) ou gerado pela IA
        // (relatório/planilha/documento) → link de download.
        if (typing.parentNode) typing.remove();
        avisarMensagem();
        _teveArquivo = true;
        appendFileLink(evt.dataUrl, evt.filename);
      } else if (evt.type === "fill") {
        // A IA propôs preencher um campo → enfileira; processa no fim (com confirmação).
        if (typing.parentNode) typing.remove();
        _acoes.push({ tipo: "fill", ref: evt.ref, label: evt.label, valor: evt.valor, valores: evt.valores });
      } else if (evt.type === "check") {
        // A IA propôs marcar/desmarcar um radio/checkbox → enfileira.
        if (typing.parentNode) typing.remove();
        _acoes.push({ tipo: "check", ref: evt.ref, label: evt.label, marcar: evt.marcar });
      } else if (evt.type === "click") {
        // A IA propôs clicar num botão/link → enfileira (confirma só se grava/navega).
        if (typing.parentNode) typing.remove();
        _acoes.push({ tipo: "click", ref: evt.ref, label: evt.label });
      } else if (evt.type === "destacar") {
        // A IA apontou algo na tela → realce efêmero (campos/colunas/linhas do IR).
        // NÃO é ação de fila nem dispara o loop — só um pointer visual junto da resposta.
        _teveDestaque = true;
        aplicarDestaque(evt);
      } else if (evt.type === "chart") {
        // A IA montou um gráfico → card interativo (trocar tipo + exportar CSV/PNG).
        if (typing.parentNode) typing.remove();
        avisarMensagem();
        if (evt.chart) renderChart(evt.chart);
      } else if (evt.type === "chart_choice") {
        // A IA quer o TIPO do gráfico → mostra os tipos como botões; escolher desenha na hora.
        if (typing.parentNode) typing.remove();
        avisarMensagem();
        _teveEscolha = true;
        if (evt.spec) renderChartChoice(evt.pergunta, evt.spec, evt.recomendado);
      } else if (evt.type === "analysis_started") {
        // Modo B: a análise semântica em lote foi enfileirada → acompanha por polling.
        if (typing.parentNode) typing.remove();
        avisarMensagem();
        iniciarAcompanhamentoAnalise(evt.jobId, evt.estimate, evt.criterio, evt.coluna);
      } else if (evt.type === "harvest") {
        // A IA pediu a coleta de TODAS as páginas do relatório paginado.
        if (typing.parentNode) typing.remove();
        _coletando = true;
      } else if (evt.type === "tutorial") {
        // A IA montou um tutorial guiado → walkthrough passo a passo no fim do turno.
        if (typing.parentNode) typing.remove();
        avisarMensagem();
        var _ps = Array.isArray(evt.passos)
          ? evt.passos.filter(function (p) { return p && p.ref != null && p.explicacao; })
          : [];
        if (_ps.length) _tutorial = { passos: _ps, idx: 0 };
      }
    }
    function finish() {
      if (typing.parentNode) typing.remove();
      limparProcStatus(); // resposta vazia sem token → não deixa "Analisando…" preso
      if (clarified && !full) {
        done();
        return;
      }
      // Coleta pendente: IGNORA qualquer texto prematuro (a IA não deve responder a
      // análise antes de ter os dados) — apenas varre e responde no passo seguinte.
      if (_coletando) {
        done();
        iniciarColeta();
        return;
      }
      // Se a IA emitiu ações neste turno, é um passo do loop (segue outra rodada) —
      // não é o resumo final, então não mostra citações/feedback ainda.
      ehFinalTurno = _acoes.length === 0;
      if (full) {
        history.push({ role: "assistant", content: full });
        // Deixa a revelação suave terminar; ao chegar ao fim, mostra as fontes
        // e o feedback (feito dentro de passoReveal).
        stopped = true;
        agendarReveal();
        // Disclaimer CONTEXTUAL: reflete a fonte real (relatório da tela / base de dados
        // / cruzamento). Só aparece quando há fonte de tela/base — texto coerente c/ ela.
        mostrarDisclaimer(body);
      } else if (!_acoes.length && !_charts.length && !_teveArquivo && !_teveEscolha && !_teveDestaque && !_coletando && !loopStep) {
        // Stream vazio SEM ação de tela, gráfico, arquivo, botões NEM coleta =
        // a chamada ao provedor falhou. (Se a IA só chamou uma tool visual/de
        // arquivo/escolha/coleta, não há texto — mas o resultado aparece.)
        // loopStep: a continuação do loop autônomo (pós-ação) vem vazia quando a
        // tarefa já acabou — isso é conclusão normal, NÃO erro. Não alarma o usuário.
        addMsg(
          "assistant",
          "Não foi possível gerar a resposta agora. Tente de novo em instantes."
        );
        if (citations.length) renderCitations(citations);
      }
      done();
      if (_tutorial) confirmarTutorial(); // pergunta ANTES de começar o tutorial guiado
      else if (_acoes.length) proximaAcao(); // ações de tela propostas pela IA
    }
    function done() {
      _chatAbort = null;
      setBusyUI(false); // botão volta a "Enviar"
    }
  }

  function renderFeedback() {
    if (!conversationId) return;
    var row = document.createElement("div");
    row.className = "fbk";
    var label = document.createElement("span");
    label.textContent = "Foi útil?";
    row.appendChild(label);
    var sent = false;
    ["up", "down"].forEach(function (dir) {
      var b = document.createElement("button");
      b.className = "fbk-btn";
      b.setAttribute("aria-label", dir === "up" ? "Útil" : "Não útil");
      b.textContent = dir === "up" ? "👍" : "👎";
      b.addEventListener("click", function () {
        if (sent) return;
        sent = true;
        b.classList.add("on");
        fetch(API + "/api/v1/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Widget-Key": KEY },
          body: JSON.stringify({ conversationId: conversationId, value: dir === "up" ? 1 : -1 }),
        }).catch(function () { });
        label.textContent = "Obrigado!";
      });
      row.appendChild(b);
    });
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Constrói a sanfona de FONTES e a RETORNA (o Histórico reusa este bloco).
  function construirCitacoes(cites) {
    if (!cites || !cites.length) return null;
    // Sanfona FECHADA: no painel do widget a lista de fontes ocupava mais
    // altura que a resposta. <details> nativo — sem estado, sem JS de toggle.
    var det = document.createElement("details");
    det.className = "cdet";
    var sum = document.createElement("summary");
    sum.className = "csum";
    sum.textContent = "Fontes (" + cites.length + ")";
    det.appendChild(sum);

    var box = document.createElement("div");
    box.className = "cites";
    cites.forEach(function (c) {
      // Sem url a fonte é um arquivo da base de conhecimento, que não tem
      // página no portal: vira <span>, senão o href ficaria só com a origem da
      // API e o clique levaria o leitor para lugar nenhum.
      var temLink = !!c.url;
      var a = document.createElement(temLink ? "a" : "span");
      a.className = temLink ? "cite" : "cite cite-nolink";
      if (temLink) {
        a.href = API + c.url;
        a.target = "_blank";
        a.rel = "noopener";
      }
      var thumb;
      if (c.image) {
        thumb = document.createElement("img");
        thumb.src = c.image;
        thumb.alt = "";
        thumb.className = "cthumb";
      } else {
        thumb = document.createElement("div");
        thumb.className = "cthumb cph";
        thumb.textContent = "📄";
      }
      var body = document.createElement("div");
      body.className = "cbody";
      var t = document.createElement("span");
      t.className = "ctitle";
      t.textContent = "[" + c.n + "] " + c.title;
      body.appendChild(t);
      if (c.heading_path) {
        var hp = document.createElement("span");
        hp.className = "cpath";
        hp.textContent = c.heading_path;
        body.appendChild(hp);
      }
      a.appendChild(thumb);
      a.appendChild(body);
      box.appendChild(a);
    });
    det.appendChild(box);
    return det;
  }
  // Reexibe as fontes no chat (append). A construção fica em construirCitacoes para
  // o Histórico de conversas reusar o mesmo bloco de fontes.
  function renderCitations(cites) {
    var det = construirCitacoes(cites);
    if (det) { messagesEl.appendChild(det); messagesEl.scrollTop = messagesEl.scrollHeight; }
  }

  // ==== Base de Dados (fontes do chat: uploads + relatórios salvos) ====
  var baseBtn, basePanel, baseOpen = false, baseFileInput;
  var baseRelIds = [], baseUploads = [], baseModo = "completa";
  // ── Fase 3: tradução da TELA host em runtime (best-effort, opt-in) ────────────
  // Só texto ESTÁTICO visível; pula inputs/scripts/editáveis e o próprio widget (que
  // vive em Shadow DOM, isolado do walk da luz). Guarda o original p/ reverter. NÃO
  // cobre conteúdo dinâmico via canvas nem validação do servidor.
  var _trOrig = null, _trObserver = null, _trOn = false;
  function trCacheGet(lang) { try { return JSON.parse(localStorage.getItem("kb.tr." + KEY + "." + lang) || "{}"); } catch (e) { return {}; } }
  function trCacheSet(lang, m) { try { localStorage.setItem("kb.tr." + KEY + "." + lang, JSON.stringify(m)); } catch (e) { } }
  function coletarNosTexto() {
    var out = [];
    if (!document.body || !document.createTreeWalker) return out;
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement; if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "TEXTAREA") return NodeFilter.FILTER_REJECT;
        if (p.closest && p.closest("input,select,textarea,[contenteditable],[data-kb-notranslate]")) return NodeFilter.FILTER_REJECT;
        var t = (n.nodeValue || "").trim();
        if (t.length < 2 || !/[a-zA-ZÀ-ÿ]/.test(t)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var node; while ((node = w.nextNode())) out.push(node);
    return out;
  }
  function aplicarTr(n, orig, trad) {
    var pre = (orig.match(/^\s*/) || [""])[0], pos = (orig.match(/\s*$/) || [""])[0];
    var novo = pre + trad + pos;
    if (n.nodeValue !== novo) n.nodeValue = novo; // guarda contra loop do observer
  }
  function traduzirTela(lang) {
    if (!lang || lang === "pt") return;
    _trOrig = _trOrig || new Map();
    var nodes = coletarNosTexto();
    var cache = trCacheGet(lang), pend = [], seen = {};
    nodes.forEach(function (n) {
      if (!_trOrig.has(n)) _trOrig.set(n, n.nodeValue || "");
      var t = (_trOrig.get(n) || "").trim();
      if (cache[t]) { aplicarTr(n, _trOrig.get(n), cache[t]); return; }
      if (!seen[t]) { seen[t] = 1; pend.push(t); }
    });
    for (var i = 0; i < pend.length; i += 50) {
      (function (lote) {
        fetch(API + "/api/v1/translate-ui", {
          method: "POST", headers: { "Content-Type": "application/json", "X-Widget-Key": KEY },
          body: JSON.stringify({ key: KEY, track: track, lang: lang, texts: lote })
        }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
          if (!d || !d.translations) return;
          var c = trCacheGet(lang);
          Object.keys(d.translations).forEach(function (s) { c[s] = d.translations[s]; });
          trCacheSet(lang, c);
          if (!_trOn) return;
          coletarNosTexto().forEach(function (n) {
            var t = (_trOrig && _trOrig.get(n) ? _trOrig.get(n) : (n.nodeValue || "")).trim();
            if (d.translations[t]) { if (_trOrig && !_trOrig.has(n)) _trOrig.set(n, n.nodeValue || ""); aplicarTr(n, (_trOrig && _trOrig.get(n)) || n.nodeValue, d.translations[t]); }
          });
        }).catch(function () { });
      })(pend.slice(i, i + 50));
    }
  }
  function reverterTela() {
    if (_trOrig) { _trOrig.forEach(function (orig, n) { try { n.nodeValue = orig; } catch (e) { } }); _trOrig = null; }
    if (_trObserver) { try { _trObserver.disconnect(); } catch (e) { } _trObserver = null; }
    _trOn = false;
  }
  function ligarTraducaoTela(lang) {
    if (!lang || lang === "pt") { reverterTela(); return; }
    _trOn = true;
    traduzirTela(lang);
    if (!_trObserver && window.MutationObserver) {
      var deb = null;
      _trObserver = new MutationObserver(function () { if (deb) clearTimeout(deb); deb = setTimeout(function () { if (_trOn) traduzirTela(lang); }, 500); });
      try { _trObserver.observe(document.body, { childList: true, subtree: true, characterData: true }); } catch (e) { }
    }
  }

  function setupBaseDados() {
    if (!hasPromptIdentity()) return; // precisa de identidade (escopo por usuário)
    promptBar = promptBar || panel.querySelector(".pbar");
    promptBar.style.display = "block";
    baseBtn = document.createElement("button");
    baseBtn.type = "button"; baseBtn.className = "pbtn";
    baseBtn.innerHTML = ICON_DB + "<span>" + wt("baseDados") + "</span>";
    baseBtn.addEventListener("click", toggleBaseDados);
    promptBar.appendChild(baseBtn);
    // Botão "Histórico" ao lado de "Base de Dados" — abre a lista de conversas do usuário.
    var histBtn = document.createElement("button");
    histBtn.type = "button"; histBtn.className = "pbtn";
    histBtn.innerHTML = ICON_HISTORY + "<span>" + wt("historico") + "</span>";
    histBtn.addEventListener("click", abrirHistorico);
    promptBar.appendChild(histBtn);
    // Idioma do assistente + tradução da tela. Escondidos temporariamente por
    // MOSTRAR_TRADUZIR (ver o topo do arquivo) — nada foi removido.
    if (MOSTRAR_TRADUZIR) {
      // Seletor de idioma: muda a ontologia usada e o idioma das respostas do chatbot.
      var langSel = document.createElement("select");
      langSel.className = "pbtn"; langSel.title = "Idioma do assistente";
      langSel.style.cursor = "pointer";
      LANGS.forEach(function (l) {
        var o = document.createElement("option");
        o.value = l.code; o.textContent = l.nativo;
        if (l.code === widgetLang) o.selected = true;
        langSel.appendChild(o);
      });
      langSel.addEventListener("change", function () {
        widgetLang = langSel.value;
        try { localStorage.setItem(LS_LANG, widgetLang); } catch (e) { }
        // Se a tradução da tela está ligada, reverte e reaplica no novo idioma.
        if (_trOn) { reverterTela(); if (widgetLang !== "pt") ligarTraducaoTela(widgetLang); }
        if (trChk) { trChk.disabled = widgetLang === "pt"; if (widgetLang === "pt") trChk.checked = false; }
        // Reaplica os textos da casca do widget no novo idioma.
        try {
          if (inputEl) inputEl.placeholder = wt("placeholder");
          var _bs = baseBtn && baseBtn.querySelector("span"); if (_bs) _bs.textContent = wt("baseDados");
          var _hs = histBtn && histBtn.querySelector("span"); if (_hs) _hs.textContent = wt("historico");
          if (trTxt) trTxt.textContent = wt("traduzir");
        } catch (e) { }
      });
      promptBar.appendChild(langSel);
      // Toggle opt-in: traduzir a TELA host em runtime (best-effort). Fora do PT.
      var trWrap = document.createElement("label");
      trWrap.className = "pbtn"; trWrap.style.cursor = "pointer"; trWrap.title = "Traduz os textos da tela para o idioma escolhido (experimental)";
      var trChk = document.createElement("input");
      trChk.type = "checkbox"; trChk.style.margin = "0 4px 0 0"; trChk.disabled = widgetLang === "pt";
      trChk.addEventListener("change", function () {
        if (trChk.checked && widgetLang !== "pt") ligarTraducaoTela(widgetLang);
        else reverterTela();
      });
      trWrap.appendChild(trChk);
      var trTxt = document.createTextNode(wt("traduzir"));
      trWrap.appendChild(trTxt);
      promptBar.appendChild(trWrap);
    }
    basePanel = document.createElement("div");
    basePanel.className = "ppanel";
    promptBar.appendChild(basePanel);
    baseFileInput = document.createElement("input");
    baseFileInput.type = "file"; baseFileInput.multiple = true; baseFileInput.style.display = "none";
    baseFileInput.accept = ".pdf,.docx,.pptx,.xlsx,.xlsm,.csv,.txt,.md,.json,.xml,.png,.jpg,.jpeg";
    baseFileInput.addEventListener("change", function () {
      var files = baseFileInput.files ? Array.prototype.slice.call(baseFileInput.files) : [];
      files.forEach(uploadBaseArquivo);
      baseFileInput.value = "";
    });
    promptBar.appendChild(baseFileInput);
    apiSaved({ action: "base_get" }).then(function (r) {
      if (r && r.ok) { baseRelIds = Array.isArray(r.relatorioIds) ? r.relatorioIds : []; baseModo = r.modo === "exclusiva" ? "exclusiva" : "completa"; atualizarBadgeBase(); }
    });
  }
  function toggleBaseDados() {
    baseOpen = !baseOpen;
    basePanel.classList.toggle("open", baseOpen);
    if (baseOpen) renderBaseDados();
  }
  function atualizarBadgeBase() {
    var n = baseRelIds.length + baseUploads.filter(function (u) { return u.id; }).length;
    if (baseBtn) { var s = baseBtn.querySelector("span"); if (s) s.textContent = "Base de Dados" + (n ? " (" + n + ")" : ""); }
  }
  function temFontesBase() { return baseRelIds.length > 0 || baseUploads.some(function (u) { return u.id; }); }
  function salvarSelecaoBase() {
    atualizarBadgeBase();
    apiSaved({ action: "base_set", relatorioIds: baseRelIds, modo: baseModo });
  }
  var _baseRadios = [];
  function sincronizarRadios() { _baseRadios.forEach(function (r) { try { r.el.checked = baseModo === r.modo; } catch { } }); }
  // Após MUDAR as fontes: se ficou SEM fonte, volta ao padrão ("Base completa").
  function aposMudarFontes() {
    if (!temFontesBase() && baseModo !== "completa") { baseModo = "completa"; sincronizarRadios(); }
    salvarSelecaoBase();
  }
  // "Voltar ao padrão": limpa relatórios, remove uploads e volta a Base completa.
  function resetarBase() {
    baseRelIds = []; baseUploads = []; baseModo = "completa";
    salvarSelecaoBase(); renderBaseDados();
  }
  function uploadBaseArquivo(file) {
    var entry = { name: file.name, uploading: true };
    baseUploads.push(entry); renderBaseDados();
    var fd = new FormData(); fd.append("file", file);
    fetch(API + "/api/v1/attach", { method: "POST", headers: { "X-Widget-Key": KEY }, body: fd })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) {
        var i = baseUploads.indexOf(entry); if (i < 0) return;
        if (j && j.attachment) baseUploads[i] = { id: j.attachment.id, name: j.attachment.name || file.name, raw: file };
        else { baseUploads.splice(i, 1); toastWidget("Falha ao subir “" + file.name + "”.", true); }
        atualizarBadgeBase(); renderBaseDados();
      })
      .catch(function () { var i = baseUploads.indexOf(entry); if (i >= 0) baseUploads.splice(i, 1); toastWidget("Falha no upload.", true); renderBaseDados(); });
  }
  function adicionarUploadAMeusRelatorios(file) {
    var fr = new FileReader();
    fr.onload = function () { salvarArquivo(String(fr.result), file.name, "upload"); };
    fr.onerror = function () { toastWidget("Falha ao ler o arquivo.", true); };
    fr.readAsDataURL(file);
  }
  function renderBaseDados() {
    if (!basePanel) return;
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    basePanel.innerHTML = "";
    _baseRadios = [];
    function titulo(t) { var d = document.createElement("div"); d.style.cssText = "font-size:10.5px;font-weight:800;color:" + pc + ";text-transform:uppercase;letter-spacing:.03em;margin:8px 4px 4px;"; d.textContent = t; return d; }
    // Cabeçalho com título + botão FECHAR.
    var hd = document.createElement("div"); hd.style.cssText = "display:flex;align-items:center;gap:8px;margin:2px 2px 4px;";
    var ht = document.createElement("div"); ht.style.cssText = "flex:1;font-size:13px;font-weight:800;color:" + pc + ";"; ht.textContent = "Base de Dados";
    var fx = document.createElement("button"); fx.type = "button"; fx.innerHTML = "&times;"; fx.title = "Fechar"; fx.setAttribute("aria-label", "Fechar");
    fx.style.cssText = "border:0;background:transparent;font-size:20px;line-height:1;color:#6b7280;cursor:pointer;flex:none;padding:0 4px;";
    fx.addEventListener("click", function () { toggleBaseDados(); });
    hd.appendChild(ht); hd.appendChild(fx); basePanel.appendChild(hd);
    // Upload
    basePanel.appendChild(titulo("Upload de arquivo"));
    var up = document.createElement("button"); up.type = "button"; up.textContent = "+ Enviar arquivo(s)";
    up.style.cssText = "width:100%;padding:8px;border:1px dashed " + pc + "66;border-radius:9px;background:" + pc + "0a;color:" + pc + ";font-size:12.5px;font-weight:700;cursor:pointer;";
    up.addEventListener("click", function () { baseFileInput.click(); });
    basePanel.appendChild(up);
    baseUploads.forEach(function (u, i) {
      var row = document.createElement("div"); row.style.cssText = "display:flex;align-items:center;gap:6px;padding:6px 4px;font-size:12px;color:#374151;";
      var nm = document.createElement("span"); nm.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"; nm.textContent = (u.uploading ? "⏳ " : "📎 ") + u.name;
      row.appendChild(nm);
      if (!u.uploading) {
        var add = document.createElement("button"); add.type = "button"; add.textContent = "Salvar"; add.title = "Adicionar a Meus relatórios";
        add.style.cssText = "border:1px solid " + pc + "44;background:transparent;color:" + pc + ";border-radius:7px;font-size:11px;font-weight:700;padding:3px 7px;cursor:pointer;flex:none;";
        add.addEventListener("click", function () { if (u.raw) adicionarUploadAMeusRelatorios(u.raw); });
        row.appendChild(add);
      }
      var x = document.createElement("button"); x.type = "button"; x.innerHTML = "&times;"; x.title = "Remover"; x.style.cssText = "border:0;background:transparent;color:#9ca3af;font-size:16px;cursor:pointer;flex:none;line-height:1;";
      x.addEventListener("click", function () { baseUploads.splice(i, 1); aposMudarFontes(); renderBaseDados(); });
      row.appendChild(x);
      basePanel.appendChild(row);
    });
    // Meus relatórios salvos (multi-seleção)
    basePanel.appendChild(titulo("Meus relatórios salvos"));
    var lista = document.createElement("div"); lista.textContent = "Carregando…"; lista.style.cssText = "font-size:12px;color:#6b7280;padding:4px;"; basePanel.appendChild(lista);
    apiSaved({ action: "list" }).then(function (r) {
      lista.innerHTML = "";
      var itens = (r && r.ok && Array.isArray(r.itens)) ? r.itens : [];
      if (!itens.length) { lista.textContent = "Nenhum relatório salvo ainda."; lista.style.color = "#9ca3af"; return; }
      itens.forEach(function (it) {
        var row = document.createElement("label"); row.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 4px;font-size:12.5px;color:#374151;cursor:pointer;";
        var cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = baseRelIds.indexOf(it.id) >= 0; cb.style.cssText = "flex:none;";
        var mt = metaTipo(it);
        var ico = document.createElement("span"); ico.innerHTML = mt.icone; ico.style.cssText = "display:inline-flex;width:15px;height:15px;flex:none;color:" + mt.cor + ";";
        var sg = ico.querySelector("svg"); if (sg) { sg.setAttribute("width", "14"); sg.setAttribute("height", "14"); }
        var nm = document.createElement("span"); nm.style.cssText = "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"; nm.textContent = it.name;
        cb.addEventListener("change", function () {
          if (cb.checked) { if (baseRelIds.indexOf(it.id) < 0) baseRelIds.push(it.id); }
          else baseRelIds = baseRelIds.filter(function (x) { return x !== it.id; });
          aposMudarFontes();
        });
        row.appendChild(cb); row.appendChild(ico); row.appendChild(nm); lista.appendChild(row);
      });
    }).catch(function () { lista.textContent = "Falha ao carregar."; });
    // Escopo (modo)
    basePanel.appendChild(titulo("Escopo da consulta"));
    [["completa", "Base completa (padrão)"], ["exclusiva", "Só estas fontes + a tela"], ["so_fontes", "Só estas fontes"]].forEach(function (op) {
      var row = document.createElement("label"); row.style.cssText = "display:flex;align-items:center;gap:8px;padding:5px 4px;font-size:12.5px;color:#374151;cursor:pointer;";
      var rb = document.createElement("input"); rb.type = "radio"; rb.name = "kbbasemodo"; rb.checked = baseModo === op[0]; rb.style.cssText = "flex:none;";
      rb.addEventListener("change", function () { if (rb.checked) { baseModo = op[0]; salvarSelecaoBase(); } });
      _baseRadios.push({ el: rb, modo: op[0] });
      var tx = document.createElement("span"); tx.textContent = op[1];
      row.appendChild(rb); row.appendChild(tx); basePanel.appendChild(row);
    });
    var hint = document.createElement("div"); hint.style.cssText = "font-size:10.5px;color:#9ca3af;padding:2px 4px 6px;line-height:1.4;";
    hint.textContent = "“Só estas fontes + a tela” e “Só estas fontes” não usam a base de conhecimento da IA. A segunda também ignora os dados da tela.";
    basePanel.appendChild(hint);
    // Voltar ao padrão (limpa tudo e volta a Base completa).
    var reset = document.createElement("button"); reset.type = "button"; reset.textContent = "↺ Voltar ao padrão";
    reset.style.cssText = "width:100%;margin-top:6px;padding:8px;border:1px solid #e5e7eb;border-radius:9px;background:#fff;color:#6b7280;font-size:12px;font-weight:700;cursor:pointer;";
    reset.addEventListener("click", function () { resetarBase(); });
    basePanel.appendChild(reset);
  }

  // ==== Prompts salvos (biblioteca do visitante) ====
  // Só existe quando a visita traz um TOKEN de rastreio; o servidor o decifra e
  // chaveia por (space, p_base, p_usuario). O widget NUNCA pede login e não lê
  // os p_* — só carrega o token opaco.
  var promptBar, promptPanel;
  var promptOpen = false, promptLoading = false, promptCache = [];
  var promptForm = false, promptEditId = null, promptFormLabel = "", promptFormTexto = "";

  function hasPromptIdentity() {
    return !!(track && track.token);
  }

  function promptApi(action, extra) {
    var body = { action: action, track: track };
    if (extra) for (var k in extra) body[k] = extra[k];
    return fetch(API + "/api/v1/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Widget-Key": KEY },
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().catch(function () {
        return {};
      });
    });
  }

  function setupPrompts() {
    if (!hasPromptIdentity()) return; // sem identidade, sem biblioteca
    promptBar = panel.querySelector(".pbar");
    promptBar.style.display = "block";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pbtn";
    btn.innerHTML = ICON_BOOKMARK + "<span>Prompts salvos</span>";
    btn.addEventListener("click", togglePrompts);
    promptBar.appendChild(btn);
    promptPanel = document.createElement("div");
    promptPanel.className = "ppanel";
    promptBar.appendChild(promptPanel);
  }

  function togglePrompts() {
    if (!promptPanel) return;
    promptOpen = !promptOpen;
    promptPanel.classList.toggle("open", promptOpen);
    if (promptOpen) loadPrompts();
    else promptForm = false;
  }

  function loadPrompts() {
    promptLoading = true;
    renderPrompts();
    promptApi("list")
      .then(function (r) {
        promptCache = (r && r.prompts) || [];
        promptLoading = false;
        renderPrompts();
      })
      .catch(function () {
        promptLoading = false;
        promptCache = [];
        renderPrompts();
      });
  }

  function openPromptForm(p) {
    promptForm = true;
    promptEditId = p ? p.id : null;
    promptFormLabel = p ? p.label || "" : "";
    promptFormTexto = p ? p.texto : "";
    renderPrompts();
  }

  function submitPromptForm() {
    var texto = promptFormTexto.trim();
    if (!texto) return;
    promptApi("save", {
      id: promptEditId,
      label: promptFormLabel.trim() || null,
      texto: texto,
    }).then(function (r) {
      if (r && r.ok) {
        promptForm = false;
        loadPrompts();
      }
    });
  }

  function deletePrompt(id) {
    promptApi("delete", { id: id }).then(function () {
      loadPrompts();
    });
  }

  function usePrompt(texto) {
    inputEl.value = inputEl.value.trim() ? inputEl.value + "\n" + texto : texto;
    autoGrow();
    togglePrompts();
    inputEl.focus();
  }

  // Salvar direto do balão (hover): não abre o formulário, só grava o texto.
  function saveCurrentPrompt(texto, btnEl) {
    if (btnEl) btnEl.disabled = true;
    promptApi("save", { texto: texto })
      .then(function (r) {
        if (btnEl) {
          btnEl.disabled = false;
          if (r && r.ok) btnEl.classList.add("done");
        }
        if (promptOpen) loadPrompts();
      })
      .catch(function () {
        if (btnEl) btnEl.disabled = false;
      });
  }

  function renderPrompts() {
    if (!promptPanel) return;
    promptPanel.innerHTML = "";

    var head = document.createElement("div");
    head.className = "pph";
    var title = document.createElement("span");
    title.className = "ppt";
    title.textContent = "Prompts salvos";
    head.appendChild(title);
    var acts = document.createElement("div");
    acts.className = "ppa";
    var addb = document.createElement("button");
    addb.type = "button";
    addb.title = "Novo prompt";
    addb.innerHTML = ICON_PLUS;
    addb.addEventListener("click", function () {
      openPromptForm(null);
    });
    var clb = document.createElement("button");
    clb.type = "button";
    clb.title = "Fechar";
    clb.className = "ppx";
    clb.textContent = "×";
    clb.addEventListener("click", togglePrompts);
    acts.appendChild(addb);
    acts.appendChild(clb);
    head.appendChild(acts);
    promptPanel.appendChild(head);

    if (promptForm) {
      var f = document.createElement("div");
      f.className = "ppf";
      var li = document.createElement("input");
      li.type = "text";
      li.placeholder = "Rótulo (opcional)";
      li.value = promptFormLabel;
      li.addEventListener("input", function () {
        promptFormLabel = li.value;
      });
      var ta = document.createElement("textarea");
      ta.placeholder = "Texto do prompt";
      ta.value = promptFormTexto;
      ta.addEventListener("input", function () {
        promptFormTexto = ta.value;
      });
      var fb = document.createElement("div");
      fb.className = "ppfb";
      var cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "ppbtn ghost";
      cancel.textContent = "Cancelar";
      cancel.addEventListener("click", function () {
        promptForm = false;
        renderPrompts();
      });
      var save = document.createElement("button");
      save.type = "button";
      save.className = "ppbtn";
      save.textContent = promptEditId ? "Atualizar" : "Salvar";
      save.addEventListener("click", submitPromptForm);
      fb.appendChild(cancel);
      fb.appendChild(save);
      f.appendChild(li);
      f.appendChild(ta);
      f.appendChild(fb);
      promptPanel.appendChild(f);
    }

    var listWrap = document.createElement("div");
    listWrap.className = "ppl";
    if (promptLoading) {
      var ld = document.createElement("div");
      ld.className = "ppe";
      ld.textContent = "Carregando…";
      listWrap.appendChild(ld);
    } else if (!promptCache.length) {
      var em = document.createElement("div");
      em.className = "ppe";
      em.textContent = "Nenhum prompt salvo ainda. Use “+” ou salve uma mensagem.";
      listWrap.appendChild(em);
    } else {
      promptCache.forEach(function (p) {
        var it = document.createElement("div");
        it.className = "ppi";
        var use = document.createElement("button");
        use.type = "button";
        use.className = "ppuse";
        use.title = "Usar este prompt";
        if (p.label) {
          var lb = document.createElement("span");
          lb.className = "ppil";
          lb.textContent = p.label;
          use.appendChild(lb);
        }
        var tx = document.createElement("span");
        tx.className = "ppit";
        tx.textContent = p.texto;
        use.appendChild(tx);
        use.addEventListener("click", function () {
          usePrompt(p.texto);
        });
        var edit = document.createElement("button");
        edit.type = "button";
        edit.className = "ppedit";
        edit.title = "Editar";
        edit.innerHTML = ICON_PENCIL;
        edit.addEventListener("click", function () {
          openPromptForm(p);
        });
        var del = document.createElement("button");
        del.type = "button";
        del.className = "ppdel";
        del.title = "Excluir";
        del.innerHTML = ICON_TRASH;
        del.addEventListener("click", function () {
          deletePrompt(p.id);
        });
        it.appendChild(use);
        it.appendChild(edit);
        it.appendChild(del);
        listWrap.appendChild(it);
      });
    }
    promptPanel.appendChild(listWrap);
  }

  // ==== Init ====
  function init() {
    fetch(API + "/api/v1/config?key=" + encodeURIComponent(KEY))
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        if (data && data.config) {
          for (var k in data.config) {
            if (data.config[k] != null) cfg[k] = data.config[k];
          }
        }
        mount();
      })
      .catch(function () {
        mount(); // usa defaults mesmo se o config falhar
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
