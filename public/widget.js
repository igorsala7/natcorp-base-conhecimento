(function () {
  "use strict";
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
  var API = new URL(script.src).origin;
  var LS_POS = "kb.widget.pos." + KEY;
  var LS_SID = "kb.widget.sid." + KEY;
  // Instante da última limpeza VISUAL da conversa (o histórico anterior não volta).
  var LS_CLEARED = "kb.widget.cleared." + KEY;

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
  var SCAN_MAX = 7000;
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
  function scanDoc(doc, marca, campos, textos) {
    if (!doc) return;
    var lm = {};
    try {
      doc.querySelectorAll("label[for]").forEach(function (l) { lm[l.getAttribute("for")] = scanTexto(l.textContent); });
    } catch {}
    try {
      doc.querySelectorAll("input,select,textarea").forEach(function (el) {
        if ((el.type || "") === "hidden") return;
        // Pula só o realmente invisível. `getClientRects` (≠ offsetParent) NÃO
        // descarta campos `position:fixed` — os de modais entram.
        if (el.getClientRects && el.getClientRects().length === 0) return;
        var rot = el.getAttribute("aria-label") || lm[el.id] || el.placeholder || el.name || el.id || (el.type || "campo");
        var val = scanValor(el);
        campos.push((marca ? marca + " " : "") + "- " + scanTexto(rot) + (val ? ": " + val : " (vazio)"));
      });
    } catch {}
    try {
      var txt = scanTexto(doc.body ? doc.body.innerText : "");
      if (txt) textos.push((marca ? marca + " " : "") + txt);
    } catch {}
    // iframes de MESMA ORIGEM (cross-origin lança e retorna null → ignorado)
    try {
      doc.querySelectorAll("iframe").forEach(function (f) {
        var d = null;
        try { d = f.contentDocument; } catch { d = null; }
        if (d) scanDoc(d, "[IFRAME]", campos, textos);
      });
    } catch {}
  }
  function scanPage() {
    try {
      var campos = [], textos = [];
      scanDoc(document, "", campos, textos);
      var partes = [];
      if (campos.length) partes.push("CAMPOS DA TELA:\n" + campos.slice(0, 80).join("\n"));
      if (textos.length) partes.push("TEXTO DA TELA:\n" + textos.join("\n"));
      var s = partes.join("\n\n");
      return s.length > SCAN_MAX ? s.slice(0, SCAN_MAX) + "\n…(truncado)" : s;
    } catch {
      return "";
    }
  }

  // ── Assistente de formulário: ler os CAMPOS (estruturados) e preenchê-los ─────
  // Só roda quando `cfg.formAssist`. Lê um mapa {ref,label,type,value} da tela e
  // guarda os elementos para escrever depois (com confirmação visual do usuário).
  var _fieldRefs = [];       // ref (índice) -> elemento, do último scan
  var _acoes = [];           // ações propostas pela IA (fill/check/click), em ordem
  var _picking = null;       // ativo enquanto aguardamos o usuário clicar num campo
  var _hlAdded = false;
  // Loop autônomo (Fase B): após executar uma ação, re-varremos a tela e reenviamos
  // à IA p/ ela DAR O PRÓXIMO PASSO (menus/janelas do APEX abrem em etapas), até
  // concluir. Confirma só o que grava/navega — o resto roda direto.
  var LOOP_CAP = 14;         // teto de passos (evita loop infinito)
  var _loopStep = 0;         // passo atual do loop autônomo
  var _turnActed = false;    // a IA executou alguma ação NESTE turno?
  var _loopCancel = false;   // usuário cancelou → interrompe o loop
  var _execLabels = [];      // trilha de ações executadas (nota de continuação)
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
    } catch {}
    return false;
  }
  // Tipo/formato do campo — o modelo precisa saber se é número, texto, data,
  // tamanho máximo, lista nativa ou lista de valores (para não preencher errado).
  function fieldTipo(el) {
    var tag = (el.tagName || "").toLowerCase();
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
    } catch {}
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
  function scanFields() {
    _fieldRefs = [];
    var out = [], lm = {};
    function push(el, label, type, value) {
      var ref = String(_fieldRefs.length);
      try { el.setAttribute("data-kb-field", ref); } catch {}
      _fieldRefs.push(el);
      out.push({ ref: ref, label: limparRotulo(scanTexto(label)).slice(0, 120), type: type, value: value });
    }
    function collect(doc) {
      if (!doc) return;
      try { doc.querySelectorAll("label[for]").forEach(function (l) { lm[l.getAttribute("for")] = scanTexto(l.textContent); }); } catch {}
      // Campos editáveis + radios/checkboxes (o modelo preenche/marca).
      try {
        doc.querySelectorAll("input,select,textarea,[contenteditable='true'],[contenteditable='']").forEach(function (el) {
          if (out.length >= 80) return; // campos: até 80 (botões têm folga própria até 120)
          if (host && host.contains && host.contains(el)) return;
          var t = (el.type || "").toLowerCase();
          if (t === "hidden" || t === "password" || t === "submit" || t === "button" || t === "reset" || t === "file") return;
          // NUNCA expõe/mexe em campos restritos: desabilitados, somente-leitura
          // ou marcados como não-editáveis (aria-readonly). O modelo nem os vê.
          if (el.disabled || el.readOnly || el.getAttribute("aria-readonly") === "true") return;
          if (el.getClientRects && el.getClientRects().length === 0) return; // invisível
          var rot = el.getAttribute("aria-label") || lm[el.id] || el.placeholder || el.name || el.id || (el.type || "campo");
          // radio/checkbox costumam ter o texto no <label> que os envolve.
          if (t === "radio" || t === "checkbox") {
            var wrap = el.closest && el.closest("label");
            if (wrap) { var wt = scanTexto(wrap.textContent); if (wt) rot = wt; }
          }
          push(el, rot, fieldTipo(el), fieldValor(el));
        });
      } catch {}
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
      } catch {}
      try {
        doc.querySelectorAll("iframe").forEach(function (f) {
          var d = null; try { d = f.contentDocument; } catch { d = null; }
          if (d) collect(d);
        });
      } catch {}
    }
    collect(document);
    return out;
  }
  function fieldEl(ref) {
    var el = _fieldRefs[Number(ref)];
    if (el && el.isConnected) return el;
    try { return document.querySelector('[data-kb-field="' + ref + '"]'); } catch { return null; }
  }
  function ensureHl() {
    if (_hlAdded) return;
    _hlAdded = true;
    try {
      var c = (cfg && cfg.primaryColor) || "#511C76";
      var st = document.createElement("style");
      st.textContent =
        "@keyframes kbFieldPulse{0%,100%{box-shadow:0 0 0 3px " + c + "55}50%{box-shadow:0 0 0 7px " + c + "22}}" +
        ".kb-field-hl{outline:2px solid " + c + "!important;outline-offset:2px;border-radius:5px;animation:kbFieldPulse 1s ease-in-out infinite!important}";
      (document.head || document.documentElement).appendChild(st);
    } catch {}
  }
  function highlightField(el) { ensureHl(); try { el.classList.add("kb-field-hl"); el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch {} }
  function unhighlightField(el) { try { el.classList.remove("kb-field-hl"); } catch {} }
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
      try { el.focus(); } catch {}
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
      try { el.focus(); } catch {}
      return true;
    } catch { return false; }
  }
  // Clica um botão/link (blindado contra desabilitados). Dispara hover antes do
  // clique porque menus do APEX (a-Menu) abrem submenus no passar do mouse — e o
  // menu escuta o hover no <li> do item, não só no <button>.
  function clickElement(el) {
    if (!el || el.disabled || el.getAttribute("aria-disabled") === "true") return false;
    try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch {}
    try {
      var alvos = [el];
      var li = el.closest ? el.closest("li.a-Menu-item, li[role='menuitem'], li") : null;
      if (li && li !== el) alvos.push(li);
      alvos.forEach(function (t) {
        ["pointerover", "mouseover", "mouseenter", "mousemove"].forEach(function (tp) {
          t.dispatchEvent(new MouseEvent(tp, { bubbles: true, cancelable: true, view: window }));
        });
      });
    } catch {}
    try { el.focus(); } catch {}
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
    var ok = a.tipo === "fill" ? fillField(el, a.valor, a.valores) : a.tipo === "check" ? checkOption(el, a.marcar) : clickElement(el);
    setTimeout(function () { unhighlightField(el); }, 700);
    var nome = a.tipo === "fill" ? "Preenchi " : a.tipo === "check" ? (a.marcar ? "Marquei " : "Desmarquei ") : "Cliquei em ";
    var multi = a.tipo === "fill" && a.valores && a.valores.length;
    var extra = multi ? " (" + a.valores.length + " itens)"
      : (a.tipo === "fill" && a.valor ? ": " + (a.valor.length > 60 ? a.valor.slice(0, 60) + "…" : a.valor) : "");
    if (ok) { registrarExec(a); statusMsg("✅ " + nome + "“" + a.label + "”" + extra, "#15803d"); }
    else { statusMsg("⚠️ Não consegui " + nome.toLowerCase() + "“" + a.label + "”", "#b45309"); }
    // Campos em CASCATA: preencher/marcar um campo pode disparar o carregamento
    // (AJAX) das opções do campo dependente. Se há mais ações na fila, espera o
    // dependente assentar antes da próxima — senão o filho ainda estaria vazio.
    var mudouValor = ok && (a.tipo === "fill" || a.tipo === "check");
    if (mudouValor && _acoes.length > 0) setTimeout(proximaAcao, 550);
    else proximaAcao();
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
      execDireto(a, el); return;
    }
    if (!el) { statusMsg("⚠️ Não encontrei “" + a.label + "” na tela.", "#b45309"); proximaAcao(); return; }
    if (a.tipo === "check" || ehVisualizacao(a.label, el)) { execDireto(a, el); return; }
    cardConfirmar(a, el); // clique que grava/navega → confirma
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
    busy = true; sendBtn.disabled = true;        // segura a UI enquanto o loop roda
    // Espera o DOM assentar (hover-intent do submenu + animação de menu/janela do
    // APEX) antes de re-varrer, senão o item recém-revelado ainda não apareceu.
    setTimeout(function () { if (!_loopCancel) ask(undefined, undefined, { continuation: true }); }, 550);
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
      var ok = a.tipo === "fill" ? fillField(el, a.valor, a.valores) : a.tipo === "check" ? checkOption(el, a.marcar) : clickElement(el);
      if (ok) registrarExec(a);
      encerrar(ok ? okTxt : falhaTxt, ok ? "#15803d" : "#b45309");
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
  var CHART_PAL = ["#511C76","#C95788","#2C1A63","#2563EB","#10B981","#F59E0B","#EF4444","#8B5CF6","#0EA5E9","#EC4899"];
  var CHART_TIPOS = [["colunas","Colunas"],["barras","Barras"],["linha","Linha"],["area","Área"],["pizza","Pizza"],["rosca","Rosca"]];

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
  function kbChartCsv(spec) {
    function cell(v) { v = String(v); return /[",\r\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    var head = ["Categoria"].concat(spec.series.map(function (s) { return s.nome; }));
    var linhas = spec.categorias.map(function (c, r) {
      return [c].concat(spec.series.map(function (s) { return s.valores[r] == null ? "" : s.valores[r]; }));
    });
    return [head].concat(linhas).map(function (cols) { return cols.map(cell).join(","); }).join("\r\n");
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
    var fa = document.createElement("a");
    fa.href = href;
    fa.download = filename || "arquivo";
    fa.rel = "noopener";
    fa.target = "_blank";
    fa.textContent = "📎 " + (filename || "arquivo");
    fa.style.cssText =
      "display:inline-flex;align-items:center;gap:6px;margin:4px 0 4px 40px;padding:8px 12px;border-radius:12px;border:1px solid rgba(0,0,0,.12);background:#fff;color:#111;text-decoration:none;font-size:13px;font-weight:600;max-width:80%;";
    messagesEl.appendChild(fa);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return fa;
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
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var card = document.createElement("div");
    card.style.cssText =
      "margin:6px 0 6px 40px;padding:12px;border-radius:14px;max-width:88%;" +
      "border:1px solid rgba(0,0,0,.10);background:#ffffff;";
    // Cabeçalho: título + abas Gráfico / Tabela.
    var head = document.createElement("div");
    head.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:8px;";
    if (spec.titulo) {
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
    // Conteúdo: gráfico (canvas) e tabela.
    var cwrap = document.createElement("div");
    cwrap.style.cssText = "position:relative;";
    var canvas = document.createElement("canvas");
    canvas.style.cssText = "width:100%;height:240px;display:block;";
    cwrap.appendChild(canvas);
    card.appendChild(cwrap);
    attachChartHover(canvas, cwrap);
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
    sel.addEventListener("change", function () { spec.tipo = sel.value; drawChart(canvas, spec); });
    var espaco = document.createElement("span"); espaco.style.cssText = "flex:1;";
    var amp = kbChartBtn("⤢ Ampliar", pc, function () { abrirModalGrafico(spec, canvas); });
    amp.title = "Ampliar no centro da tela";
    var png = kbChartBtn("⬇ PNG", pc, function () {
      try { kbBaixar((spec.titulo || "grafico") + ".png", canvas.toDataURL("image/png")); } catch {}
    });
    bar.appendChild(sel);
    bar.appendChild(espaco);
    bar.appendChild(amp);
    bar.appendChild(kbChartBtn("⬇ CSV", pc, function () {
      kbBaixar((spec.titulo || "grafico") + ".csv", "data:text/csv;charset=utf-8," + encodeURIComponent("﻿" + kbChartCsv(spec)));
    }));
    bar.appendChild(png);
    card.appendChild(bar);
    // Alternância de abas (esconde os controles só-do-gráfico na aba Tabela).
    function setTab(g) {
      cwrap.style.display = g ? "" : "none";
      twrap.style.display = g ? "none" : "";
      sel.style.display = g ? "" : "none";
      amp.style.display = g ? "" : "none";
      png.style.display = g ? "" : "none";
      kbTabState(tabG, g, pc); kbTabState(tabT, !g, pc);
      if (g) drawChart(canvas, spec);
    }
    tabG.addEventListener("click", function () { setTab(true); });
    tabT.addEventListener("click", function () { setTab(false); });
    kbTabState(tabG, true, pc); kbTabState(tabT, false, pc);
    messagesEl.appendChild(card);
    requestAnimationFrame(function () { drawChart(canvas, spec); });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Abre o gráfico ampliado, centralizado na tela (overlay dentro do shadow do
  // widget — fica acima da página e herda o z-index máximo do host).
  function abrirModalGrafico(spec, inlineCanvas) {
    var pc = (cfg && cfg.primaryColor) || "#511C76";
    var raiz = (messagesEl.getRootNode && messagesEl.getRootNode()) || document.body;
    var ov = document.createElement("div");
    ov.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(15,15,20,.55);padding:16px;";
    var card = document.createElement("div");
    card.style.cssText =
      "background:#fff;border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.4);width:min(940px,94vw);" +
      "display:flex;flex-direction:column;padding:16px;";
    var hd = document.createElement("div");
    hd.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:10px;";
    var ttl = document.createElement("div");
    ttl.textContent = spec.titulo || "Gráfico";
    ttl.style.cssText = "font-size:15px;font-weight:700;color:#17171a;flex:1;";
    var fechar = document.createElement("button");
    fechar.type = "button"; fechar.setAttribute("aria-label", "Fechar"); fechar.innerHTML = "&times;";
    fechar.style.cssText = "border:none;background:transparent;font-size:26px;line-height:1;cursor:pointer;color:#555;padding:0 6px;";
    hd.appendChild(ttl); hd.appendChild(fechar);
    var bwrap = document.createElement("div");
    bwrap.style.cssText = "position:relative;";
    var big = document.createElement("canvas");
    big.style.cssText = "width:100%;height:min(64vh,560px);display:block;";
    bwrap.appendChild(big);
    var ft = document.createElement("div");
    ft.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:12px;";
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
    ft.appendChild(kbChartBtn("⬇ PNG", pc, function () {
      try { kbBaixar((spec.titulo || "grafico") + ".png", big.toDataURL("image/png")); } catch {}
    }));
    card.appendChild(hd); card.appendChild(bwrap); card.appendChild(ft);
    ov.appendChild(card);
    raiz.appendChild(ov);
    attachChartHover(big, bwrap);
    function redraw() { drawChart(big, spec, big.clientHeight || 520); }
    requestAnimationFrame(redraw);
    function fecharModal() {
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKey);
      if (inlineCanvas) drawChart(inlineCanvas, spec); // sincroniza o tipo escolhido
    }
    function onKey(e) { if (e.key === "Escape") fecharModal(); }
    function onResize() { redraw(); }
    fechar.addEventListener("click", fecharModal);
    ov.addEventListener("click", function (e) { if (e.target === ov) fecharModal(); });
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    sel.addEventListener("change", function () {
      spec.tipo = sel.value; redraw(); if (inlineCanvas) drawChart(inlineCanvas, spec);
    });
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
    var cats = spec.categorias || [], series = spec.series || [];
    if (!cats.length || !series.length) return;
    var tipo = spec.tipo;
    // Somas por série → percentuais no tooltip.
    var somas = series.map(function (s) { return s.valores.reduce(function (a, b) { return a + (b || 0); }, 0); });
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
    for (var si2 = 0; si2 < series.length; si2++) for (var ri = 0; ri < cats.length; ri++) {
      var v0 = series[si2].valores[ri] || 0; if (v0 > vmax) vmax = v0; if (v0 < vmin) vmin = v0;
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

    if (tipo === "barras") {
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
      for (var c = 0; c < cats.length; c++) {
        var by = y0 + bandH * c;
        ctx.fillStyle = muted; ctx.textAlign = "right"; ctx.fillText(kbTrunc(ctx, cats[c], padL - 8), x0 - 6, by + bandH / 2);
        hits.push({ x: 0, y: by, w: padL, h: bandH, html: tipCat(c) });
        var sh = (bandH * 0.7) / series.length;
        for (var s2 = 0; s2 < series.length; s2++) {
          var val = series[s2].valores[c] || 0, bw = plotW * val / span, ry = by + bandH * 0.15 + sh * s2;
          ctx.fillStyle = CHART_PAL[s2 % CHART_PAL.length];
          ctx.fillRect(zeroX, ry, bw, sh * 0.86);
          hits.push({ x: Math.min(zeroX, zeroX + bw), y: ry, w: Math.max(3, Math.abs(bw)), h: sh * 0.86, html: tipVal(c, s2) });
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
    if (tipo === "colunas") {
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
    } else {
      for (var s4 = 0; s4 < series.length; s4++) {
        var col = CHART_PAL[s4 % CHART_PAL.length]; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
        var pts = [];
        for (var c4 = 0; c4 < cats.length; c4++) {
          var v4 = series[s4].valores[c4] || 0, px2 = x02 + band * c4 + band / 2, py2 = valorY(v4);
          pts.push([px2, py2]); if (c4 === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
        }
        ctx.stroke();
        if (tipo === "area" && pts.length) {
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
      if (hits) hits.push({ pie: { cx: cx, cy: cy, ri: ri, ro: R, a0: ang, a1: a2 },
        html: "<b>" + esc(cats[i]) + "</b><br>" + kbNum(vals[i]) + " (" + (Math.round(frac * 1000) / 10) + "%)" });
      ang = a2;
    }
    if (donut) { ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(cx, cy, R * 0.55, 0, 6.2832); ctx.fill(); }
    var lx = w * 0.60, ly = cy - (cats.length * 16) / 2 + 8; ctx.textAlign = "left";
    for (var j = 0; j < cats.length; j++) {
      ctx.fillStyle = CHART_PAL[j % CHART_PAL.length]; ctx.fillRect(lx, ly - 5, 10, 10);
      ctx.fillStyle = fg;
      var p = Math.round((vals[j] / total) * 1000) / 10;
      ctx.fillText(kbTrunc(ctx, cats[j], w - lx - 60) + " " + p + "%", lx + 15, ly);
      if (hits) hits.push({ x: lx - 2, y: ly - 9, w: w - lx, h: 16,
        html: "<b>" + esc(cats[j]) + "</b><br>" + kbNum(vals[j]) + " (" + p + "%)" });
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
  };
  var conversationId = null;
  var open = false;
  var host, root, bubble, panel, messagesEl, inputEl, sendBtn, attzEl, fileInput, micBtn;
  // Anexos pendentes deste turno: {id?,name,mime?,size?,uploading?}.
  var pendingAtts = [];
  // Estado da gravação de voz: "idle" | "recording" | "transcribing".
  var micState = "idle";
  var mediaRec = null;
  var micChunks = [];

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
      ".panel.open{display:flex;animation:kbin .22s cubic-bezier(.2,.8,.2,1)}" +
      "@keyframes kbin{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}" +
      // Cabeçalho (gradiente)
      ".hd{background:linear-gradient(135deg,var(--pc),var(--pc2,var(--pc)));color:#fff;padding:16px 15px 18px;display:flex;align-items:center;gap:12px}" +
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
      // Rodapé / entrada
      ".ft{border-top:1px solid #efe9f6;padding:12px;display:flex;gap:9px;align-items:flex-end;background:#fff}" +
      ".ft textarea{flex:1;resize:none;border:1.5px solid #e6ddf1;border-radius:16px;padding:11px 14px;font-size:14px;line-height:1.4;outline:none;overflow-y:hidden;background:#faf8fd;transition:border-color .15s,background .15s;min-height:44px}" +
      ".ft textarea:focus{border-color:var(--pc);background:#fff}" +
      ".ft button{background:linear-gradient(135deg,var(--pc),var(--pc2,var(--pc)));color:#fff;border:none;border-radius:50%;width:44px;height:44px;flex:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s,box-shadow .15s,opacity .15s;box-shadow:0 8px 18px rgba(60,30,110,.3)}" +
      ".ft button:hover:not(:disabled){transform:scale(1.06)}" +
      ".ft button:disabled{opacity:.4;cursor:default;box-shadow:none}" +
      ".ft button svg{width:19px;height:19px}" +
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
      ".pw{padding:8px 12px 10px;font-size:10.5px;color:#a99fbe;text-align:center;background:#fff;letter-spacing:.02em}"
    );
  }

  var ICON_CHAT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var ICON_SEND =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
  // Avatar do assistente: um brilho ("sparkle"), como nas referências.
  var ICON_BOT =
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.7 4.8L18 8.5l-4.3 1.7L12 15l-1.7-4.8L6 8.5l4.3-1.7L12 2z"/><path d="M19 13l.8 2.3L22 16l-2.2.8L19 19l-.8-2.2L16 16l2.2-.7L19 13z" opacity=".65"/></svg>';
  // Biblioteca de prompts salvos (só quando a visita traz o token de rastreio).
  var ICON_BOOKMARK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
  var ICON_PLUS =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  var ICON_PENCIL =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  var ICON_TRASH =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
  // Anexos de documento (Fase 3C).
  var ICON_CLIP =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
  var ICON_MIC =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
  var ICON_STOP =
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
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
            } catch {}
            return orig ? orig.apply(this, arguments) : false;
          };
        }
        return;
      }
    } catch {}
    // jQuery UI ainda não disponível → tenta mais algumas vezes.
    if ((tentativas || 0) < 20) setTimeout(function () { permitirNoModal((tentativas || 0) + 1); }, 300);
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
    // Badge de notificação (novo) — pontinho no canto da bolha.
    badge = document.createElement("span");
    badge.setAttribute("aria-hidden", "true");
    badge.style.cssText =
      "position:absolute;top:3px;right:3px;min-width:13px;height:13px;border-radius:7px;" +
      "background:#e5484d;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);display:none;pointer-events:none;";
    bubble.appendChild(badge);

    panel = document.createElement("div");
    panel.className = "panel";
    panel.innerHTML =
      '<div class="hd">' +
      '<div class="hav">' +
      (cfg.avatarUrl ? '<img src="' + esc(cfg.avatarUrl) + '" alt="">' : ICON_BOT) +
      "</div>" +
      '<div class="ti"><div class="t">' + esc(cfg.title) + "</div>" +
      '<div class="s">' + esc(cfg.subtitle || "Pergunte o que quiser") + "</div></div>" +
      '<button aria-label="Limpar conversa" title="Limpar conversa" data-clear>' + ICON_TRASH + "</button>" +
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
      '<div class="pw">Powered by Base de Conhecimento</div>';

    wrap.appendChild(bubble);
    wrap.appendChild(panel);
    root.appendChild(wrap);

    messagesEl = panel.querySelector(".msgs");
    inputEl = panel.querySelector("textarea");
    sendBtn = panel.querySelector("[data-send]");
    attzEl = panel.querySelector(".attz");
    fileInput = panel.querySelector("[data-file]");
    micBtn = panel.querySelector("[data-mic]");

    panel.querySelector("[data-close]").addEventListener("click", toggle);
    panel.querySelector("[data-clear]").addEventListener("click", clearChat);
    panel.querySelector("[data-attach]").addEventListener("click", function () {
      fileInput.click();
    });
    micBtn.addEventListener("click", toggleMic);
    fileInput.addEventListener("change", function () {
      var files = fileInput.files ? Array.prototype.slice.call(fileInput.files) : [];
      files.forEach(uploadAttachment);
      fileInput.value = ""; // permite reanexar o mesmo arquivo
    });
    sendBtn.addEventListener("click", submit);
    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    });
    // A caixa cresce com as linhas, até 5 linhas; depois rola por dentro.
    inputEl.addEventListener("input", autoGrow);

    positionBubble();
    setupDrag();
    loadInitialMessages();
    setupPrompts();
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
  function placePanel() {
    var b = bubble.getBoundingClientRect();
    // Precisa BATER com o CSS do .panel (width:440; height:680; max-w:100vw-20;
    // max-h:100vh-96), senão a base/lado do painel passa do limite da janela.
    var margem = window.innerWidth <= 480 ? 10 : 12; // celular: cola mais nas bordas
    var pw = Math.min(440, window.innerWidth - margem * 2);
    var left = b.left + b.width / 2 < window.innerWidth / 2 ? b.left : b.right - pw;
    left = Math.max(margem, Math.min(left, window.innerWidth - pw - margem));
    panel.style.left = left + "px";
    panel.style.width = pw + "px";
    // Altura REAL renderizada = min(680, 100vh - 96). Abre acima da bolha por
    // padrão; se não couber, abaixo — sempre grudado ao topo/base visível.
    var ph = Math.min(680, window.innerHeight - 96);
    var top = b.top - ph - 12;
    if (top < 12) top = Math.min(b.bottom + 12, window.innerHeight - ph - 12);
    panel.style.top = Math.max(12, Math.min(top, window.innerHeight - ph - 12)) + "px";
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
    bubble.addEventListener("pointerup", function (e) {
      if (!dragging) return;
      dragging = false;
      bubble.releasePointerCapture(e.pointerId);
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
  } catch {}

  // ==== Notificação (badge + som) quando chega resposta com o widget minimizado ====
  var badge = null;       // pontinho na bolha
  var _naoLido = false;   // há resposta não lida (widget minimizado)
  var _avisouTurno = false; // já avisou nesta resposta (evita beep repetido)
  var _audioCtx = null;
  function mostrarBadge(v) {
    if (!badge) return;
    try {
      if (v && badge.parentNode !== bubble) bubble.appendChild(badge); // re-insere (innerHTML da bolha é trocado ao abrir/fechar)
      badge.style.display = v ? "block" : "none";
    } catch {}
  }
  // Destrava o áudio num gesto do usuário (política de autoplay dos navegadores).
  function desbloquearAudio() {
    try {
      if (!_audioCtx) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) _audioCtx = new AC(); }
      if (_audioCtx && _audioCtx.state === "suspended") _audioCtx.resume();
    } catch {}
  }
  // Bip curto e DISCRETO (dois tons suaves, volume baixo) — sem arquivo externo.
  function tocarBip() {
    try {
      desbloquearAudio();
      if (!_audioCtx) return;
      var ctx = _audioCtx, t = ctx.currentTime;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(660, t);
      o.frequency.setValueAtTime(880, t + 0.09);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.02); // baixo = discreto
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + 0.26);
    } catch {}
  }
  // Chegou resposta com o widget MINIMIZADO → badge + som (uma vez por resposta).
  function avisarMensagem() {
    if (open || _avisouTurno) return;
    _avisouTurno = true;
    _naoLido = true;
    mostrarBadge(true);
    tocarBip();
  }

  function toggle() {
    open = !open;
    if (open) {
      placePanel();
      panel.classList.add("open");
      bubble.innerHTML = "";
      bubble.textContent = "×";
      bubble.style.fontSize = "28px";
      limparBloqueiosHost(); // caso um modal já tenha marcado o host
      ligarEscapeFoco(true); // escapa da armadilha de foco do modal
      desbloquearAudio(); // gesto do usuário: libera o som de notificação
      _naoLido = false; mostrarBadge(false); // abrir = confirmou a leitura → some o badge
      if (_revealFlush) _revealFlush(); // completa a resposta que ficou parada enquanto minimizado
      // Rola para a ÚLTIMA mensagem: com histórico, o scroll foi calculado com o
      // painel oculto (scrollHeight=0), então refazemos agora que ele é visível.
      setTimeout(function () {
        messagesEl.scrollTop = messagesEl.scrollHeight;
        inputEl.focus();
      }, 50);
    } else {
      panel.classList.remove("open");
      bubble.style.fontSize = "";
      bubble.innerHTML = bubbleInner();
      ligarEscapeFoco(false);
    }
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
  function addMsg(role, text) {
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
      var el = addMsg(m.role, m.content);
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
  // Tema em foco na conversa (eco do servidor via evento SSE `theme`). Vai como
  // `contextScope` na próxima pergunta — evita perguntar de novo no mesmo assunto.
  var contextScope = null;

  // Pergunta de desambiguação: renderiza os botões de tema; ao clicar, re-consulta
  // já filtrada (reaproveita o estilo `.sugg` das perguntas sugeridas).
  function renderClarify(question, options) {
    if (question) addMsg("assistant", question);
    var box = document.createElement("div");
    box.className = "opts";
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
        box.remove();
        ask(o.scope);
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

  // ==== Voz: grava do microfone e transcreve (Whisper/provedor parametrizado) ====
  function setMic(state) {
    micState = state;
    if (!micBtn) return;
    micBtn.classList.toggle("rec", state === "recording");
    micBtn.disabled = state === "transcribing";
    micBtn.innerHTML = state === "recording" ? ICON_STOP : ICON_MIC;
    micBtn.title =
      state === "recording"
        ? "Parar e transcrever"
        : state === "transcribing"
        ? "Transcrevendo…"
        : "Falar (gravar áudio)";
  }

  function toggleMic() {
    if (micState === "recording") {
      if (mediaRec && mediaRec.state === "recording") mediaRec.stop();
      return;
    }
    if (micState !== "idle") return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      addMsg("bot", "Gravação de voz não é suportada neste navegador.");
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(
      function (stream) {
        try {
          mediaRec = new MediaRecorder(stream);
        } catch (err) {
          void err;
          stream.getTracks().forEach(function (t) { t.stop(); });
          addMsg("bot", "Não foi possível iniciar a gravação neste navegador.");
          return;
        }
        micChunks = [];
        mediaRec.ondataavailable = function (e) {
          if (e.data && e.data.size) micChunks.push(e.data);
        };
        mediaRec.onstop = function () {
          stream.getTracks().forEach(function (t) { t.stop(); });
          var blob = new Blob(micChunks, { type: mediaRec.mimeType || "audio/webm" });
          if (blob.size < 800) {
            setMic("idle"); // gravação vazia/curtíssima: ignora
            return;
          }
          setMic("transcribing");
          var fd = new FormData();
          fd.append("file", blob, "audio.webm");
          fd.append("key", KEY);
          fetch(API + "/api/v1/transcribe", {
            method: "POST",
            headers: { "X-Widget-Key": KEY },
            body: fd,
          })
            .then(function (r) { return r.json().catch(function () { return null; }); })
            .then(function (d) {
              setMic("idle");
              var text = d && d.transcribed && d.text ? String(d.text).trim() : "";
              if (text) {
                if (busy) {
                  inputEl.value = (inputEl.value.trim() ? inputEl.value + " " : "") + text;
                  autoGrow();
                } else {
                  inputEl.value = text;
                  submit();
                }
              } else {
                addMsg("bot", (d && d.error) || "Não consegui transcrever o áudio.");
              }
            })
            .catch(function () {
              setMic("idle");
              addMsg("bot", "Falha ao transcrever o áudio.");
            });
        };
        mediaRec.start();
        setMic("recording");
      },
      function () {
        addMsg("bot", "Não consegui acessar o microfone (permissão negada?).");
      }
    );
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
    autoGrow();
    addMsg("user", text);
    if (atts.length) renderMsgAtts(atts);
    history.push({ role: "user", content: text });
    var ids = atts.map(function (a) { return a.id; });
    pendingAtts = [];
    renderAtts();
    ask(undefined, ids);
  }

  function ask(scope, attachmentIds, opts) {
    var continuacao = !!(opts && opts.continuation);
    // Mensagem nova do usuário (ou desambiguação) → zera o loop autônomo.
    if (!continuacao) { _loopStep = 0; _loopCancel = false; _execLabels = []; }
    _turnActed = false; // recomeça a cada turno; habilita o próximo passo se agir
    _avisouTurno = continuacao; // continuação do loop não toca o som; resposta nova pode
    desbloquearAudio(); // envio é gesto do usuário → libera o som p/ tocar depois
    busy = true;
    sendBtn.disabled = true;
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
      if (rafId != null) { try { cancelAnimationFrame(rafId); } catch {} rafId = null; }
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
      if (scan) body.pageContent = scan;
    }
    // Assistente de formulário: envia o mapa estruturado dos campos da tela para
    // a IA opinar/preencher (só se habilitado na config deste widget).
    if (cfg.formAssist) {
      var flds = scanFields();
      if (flds.length) body.fields = flds;
    }
    fetch(API + "/api/v1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Widget-Key": KEY },
      body: JSON.stringify(body),
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
        addMsg("assistant", "Desculpe, houve um erro: " + err.message);
        done();
      });

    function handle(evt) {
      if (evt.type === "citations") {
        citations = evt.citations || [];
      } else if (evt.type === "theme") {
        contextScope = evt.scope || null;
      } else if (evt.type === "clarify") {
        clarified = true;
        if (typing.parentNode) typing.remove();
        avisarMensagem();
        renderClarify(evt.question, evt.options);
      } else if (evt.type === "token") {
        if (typing.parentNode) typing.remove();
        if (!answerEl) answerEl = addMsg("assistant", "");
        if (!full) avisarMensagem(); // 1º pedaço da resposta com o widget minimizado → badge + som
        full += evt.value;
        agendarReveal(); // exibe suave, no ritmo do rAF (não em blocos)
      } else if (evt.type === "done") {
        if (evt.conversationId) conversationId = evt.conversationId;
      } else if (evt.type === "error") {
        if (typing.parentNode) typing.remove();
        addMsg("assistant", evt.message || "Erro ao gerar a resposta.");
      } else if (evt.type === "file") {
        // Arquivo retornado por uma API (holerite, recibo…) → link de download.
        if (typing.parentNode) typing.remove();
        avisarMensagem();
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
      } else if (evt.type === "chart") {
        // A IA montou um gráfico → card interativo (trocar tipo + exportar CSV/PNG).
        if (typing.parentNode) typing.remove();
        avisarMensagem();
        if (evt.chart) renderChart(evt.chart);
      }
    }
    function finish() {
      if (typing.parentNode) typing.remove();
      if (clarified) {
        done();
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
      } else if (!_acoes.length && !_charts.length) {
        // Stream vazio SEM ação de tela nem gráfico = a chamada ao provedor
        // falhou. (Se a IA só chamou uma tool visual, não há texto — mas o card aparece.)
        addMsg(
          "assistant",
          "Não foi possível gerar a resposta agora. Tente de novo em instantes."
        );
        if (citations.length) renderCitations(citations);
      }
      done();
      if (_acoes.length) proximaAcao(); // ações de tela propostas pela IA
    }
    function done() {
      busy = false;
      sendBtn.disabled = false;
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
        }).catch(function () {});
        label.textContent = "Obrigado!";
      });
      row.appendChild(b);
    });
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderCitations(cites) {
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
    messagesEl.appendChild(det);
    messagesEl.scrollTop = messagesEl.scrollHeight;
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
