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

  // Parâmetros de rastreio: de onde/quem veio a conversa. Lidos do atributo
  // data-* do <script> (tem prioridade) ou da querystring da página (p_*).
  // Só DADO — nunca vão para o prompt da IA; servem para o admin filtrar.
  var track = (function () {
    var qs;
    try {
      qs = new URLSearchParams(window.location.search);
    } catch (e) {
      qs = null;
    }
    var t = {};
    ["base", "usuario", "portal", "empresa", "matricula", "perfil"].forEach(function (n) {
      var v = script.getAttribute("data-" + n);
      if (v == null || v === "") v = qs ? qs.get("p_" + n) : null;
      if (v != null) {
        v = String(v).trim().slice(0, 200);
        if (v) t["p_" + n] = v;
      }
    });
    return Object.keys(t).length ? t : null;
  })();

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
  var host, root, bubble, panel, messagesEl, inputEl, sendBtn;

  // ==== Estilos (isolados no Shadow DOM) ====
  function styles() {
    return (
      "" +
      ":host{all:initial}" +
      "*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}" +
      // Gradiente da marca (--pc primária; --pc2 derivada em JS, com fallback p/ --pc).
      ".grad{background:linear-gradient(135deg,var(--pc),var(--pc2,var(--pc)))}" +
      // Bolha flutuante
      ".bubble{position:fixed;z-index:2147483000;width:var(--bs,60px);height:var(--bs,60px);border-radius:50%;" +
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
      ".panel{position:fixed;z-index:2147483000;width:392px;max-width:calc(100vw - 24px);height:620px;" +
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

  // ==== Montagem ====
  function mount() {
    host = document.createElement("div");
    host.setAttribute("data-kb-widget", "");
    document.body.appendChild(host);
    root = host.attachShadow({ mode: "open" });

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

    panel = document.createElement("div");
    panel.className = "panel";
    panel.innerHTML =
      '<div class="hd">' +
      '<div class="hav">' +
      (cfg.avatarUrl ? '<img src="' + esc(cfg.avatarUrl) + '" alt="">' : ICON_BOT) +
      "</div>" +
      '<div class="ti"><div class="t">' + esc(cfg.title) + "</div>" +
      '<div class="s">' + esc(cfg.subtitle || "Pergunte o que quiser") + "</div></div>" +
      '<button aria-label="Minimizar" data-close>&minus;</button></div>' +
      '<div class="msgs"></div>' +
      '<div class="ft"><textarea rows="1" placeholder="Escreva sua pergunta…"></textarea>' +
      '<button data-send aria-label="Enviar">' + ICON_SEND + "</button></div>" +
      '<div class="pw">Powered by Base de Conhecimento</div>';

    wrap.appendChild(bubble);
    wrap.appendChild(panel);
    root.appendChild(wrap);

    messagesEl = panel.querySelector(".msgs");
    inputEl = panel.querySelector("textarea");
    sendBtn = panel.querySelector("[data-send]");

    panel.querySelector("[data-close]").addEventListener("click", toggle);
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
    renderWelcome();
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
    // Precisa BATER com o CSS do .panel (width:392; height:620; max-h:100vh-96),
    // senão a base do painel passa do limite da janela.
    var pw = Math.min(392, window.innerWidth - 24);
    var left = b.left + b.width / 2 < window.innerWidth / 2 ? b.left : b.right - pw;
    left = Math.max(12, Math.min(left, window.innerWidth - pw - 12));
    panel.style.left = left + "px";
    panel.style.width = pw + "px";
    // Altura REAL renderizada = min(620, 100vh - 96). Abre acima da bolha por
    // padrão; se não couber, abaixo — sempre grudado ao topo/base visível.
    var ph = Math.min(620, window.innerHeight - 96);
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

  function toggle() {
    open = !open;
    if (open) {
      placePanel();
      panel.classList.add("open");
      bubble.innerHTML = "";
      bubble.textContent = "×";
      bubble.style.fontSize = "28px";
      setTimeout(function () {
        inputEl.focus();
      }, 50);
    } else {
      panel.classList.remove("open");
      bubble.style.fontSize = "";
      bubble.innerHTML = bubbleInner();
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
    if (role === "user") messagesEl.appendChild(el);
    else messagesEl.appendChild(botRow(el)); // assistente ganha avatar ao lado
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

  function submit() {
    var text = inputEl.value.trim();
    if (!text || busy) return;
    inputEl.value = "";
    autoGrow();
    addMsg("user", text);
    history.push({ role: "user", content: text });
    ask();
  }

  function ask(scope) {
    busy = true;
    sendBtn.disabled = true;
    var typingBubble = document.createElement("div");
    typingBubble.className = "m a";
    typingBubble.innerHTML = '<span class="dots"><span></span><span></span><span></span></span>';
    var typing = botRow(typingBubble); // avatar + balão de "digitando"
    messagesEl.appendChild(typing);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    var answerEl = null;
    var full = "";
    var citations = [];
    var clarified = false;

    var body = { messages: history, conversationId: conversationId, sessionId: sessionId };
    if (scope) body.scope = scope;
    if (contextScope) body.contextScope = contextScope;
    if (track) body.track = track;
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
        renderClarify(evt.question, evt.options);
      } else if (evt.type === "token") {
        if (typing.parentNode) typing.remove();
        if (!answerEl) answerEl = addMsg("assistant", "");
        full += evt.value;
        answerEl.innerHTML = mdToHtml(full);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      } else if (evt.type === "done") {
        if (evt.conversationId) conversationId = evt.conversationId;
      } else if (evt.type === "error") {
        if (typing.parentNode) typing.remove();
        addMsg("assistant", evt.message || "Erro ao gerar a resposta.");
      }
    }
    function finish() {
      if (typing.parentNode) typing.remove();
      if (clarified) {
        done();
        return;
      }
      if (full) {
        history.push({ role: "assistant", content: full });
        if (citations.length) renderCitations(citations);
        renderFeedback();
      } else {
        // Stream vazio = a chamada ao provedor falhou. Antes daqui não saía
        // nada na tela e o widget parecia simplesmente ignorar a pergunta.
        addMsg(
          "assistant",
          "Não foi possível gerar a resposta agora. Tente de novo em instantes."
        );
        if (citations.length) renderCitations(citations);
      }
      done();
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
