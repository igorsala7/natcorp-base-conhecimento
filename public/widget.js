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
      ".bubble{position:fixed;z-index:2147483000;width:56px;height:56px;border-radius:50%;" +
      "background:var(--pc);color:#fff;border:none;cursor:grab;box-shadow:0 6px 24px rgba(0,0,0,.28);" +
      "display:flex;align-items:center;justify-content:center;transition:transform .15s ease,box-shadow .15s ease;touch-action:none}" +
      ".bubble:hover{transform:scale(1.06)}" +
      ".bubble:active{cursor:grabbing}" +
      ".bubble svg{width:26px;height:26px}" +
      ".panel{position:fixed;z-index:2147483000;width:380px;max-width:calc(100vw - 24px);height:560px;" +
      "max-height:calc(100vh - 96px);background:#fff;border-radius:16px;overflow:hidden;display:none;flex-direction:column;" +
      "box-shadow:0 12px 48px rgba(0,0,0,.32);border:1px solid #e7e2ee}" +
      ".panel.open{display:flex}" +
      ".hd{background:var(--pc);color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}" +
      ".hd img{width:28px;height:28px;border-radius:50%;object-fit:cover;background:rgba(255,255,255,.2)}" +
      ".hd .t{font-weight:600;font-size:15px;flex:1}" +
      ".hd button{background:transparent;border:none;color:#fff;cursor:pointer;font-size:20px;line-height:1;opacity:.9}" +
      ".hd button:hover{opacity:1}" +
      ".msgs{flex:1;overflow-y:auto;padding:16px;background:#faf8fc;display:flex;flex-direction:column;gap:12px}" +
      ".m{max-width:85%;padding:10px 12px;border-radius:12px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-wrap:break-word}" +
      ".m.u{align-self:flex-end;background:var(--pc);color:#fff;border-bottom-right-radius:4px}" +
      ".m.a{align-self:flex-start;background:#fff;color:#1a1523;border:1px solid #ece7f2;border-bottom-left-radius:4px}" +
      ".m.a a{color:var(--pc);font-weight:600}" +
      ".cites{align-self:flex-start;display:flex;flex-wrap:wrap;gap:6px;margin-top:-4px}" +
      ".cites a{font-size:12px;color:var(--pc);border:1px solid #e2d8ee;border-radius:999px;padding:2px 8px;text-decoration:none;background:#fff}" +
      ".cites a:hover{background:#f3edfa}" +
      ".sugg{display:flex;flex-wrap:wrap;gap:6px}" +
      ".sugg button{font-size:13px;color:var(--pc);border:1px solid #e2d8ee;background:#fff;border-radius:999px;padding:6px 10px;cursor:pointer}" +
      ".sugg button:hover{background:#f3edfa}" +
      ".ft{border-top:1px solid #ece7f2;padding:10px;display:flex;gap:8px;background:#fff}" +
      ".ft textarea{flex:1;resize:none;border:1px solid #ddd4e8;border-radius:10px;padding:9px 11px;font-size:14px;max-height:96px;outline:none}" +
      ".ft textarea:focus{border-color:var(--pc)}" +
      ".ft button{background:var(--pc);color:#fff;border:none;border-radius:10px;width:40px;cursor:pointer;display:flex;align-items:center;justify-content:center}" +
      ".ft button:disabled{opacity:.5;cursor:default}" +
      ".dots{display:inline-flex;gap:3px}.dots span{width:6px;height:6px;border-radius:50%;background:#b9a9cf;animation:bl 1s infinite}" +
      ".dots span:nth-child(2){animation-delay:.2s}.dots span:nth-child(3){animation-delay:.4s}" +
      "@keyframes bl{0%,80%,100%{opacity:.3}40%{opacity:1}}" +
      ".pw{padding:6px 12px;font-size:11px;color:#9a8fb0;text-align:center;background:#fff}"
    );
  }

  var ICON_CHAT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var ICON_SEND =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

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
    wrap.style.setProperty("--pc", cfg.primaryColor || "#511C76");

    bubble = document.createElement("button");
    bubble.className = "bubble";
    bubble.setAttribute("aria-label", "Abrir assistente");
    bubble.innerHTML = ICON_CHAT;

    panel = document.createElement("div");
    panel.className = "panel";
    panel.innerHTML =
      '<div class="hd">' +
      (cfg.avatarUrl ? '<img src="' + esc(cfg.avatarUrl) + '" alt="">' : "") +
      '<span class="t">' + esc(cfg.title) + "</span>" +
      '<button aria-label="Fechar" data-close>&times;</button></div>' +
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

    positionBubble();
    setupDrag();
    renderWelcome();
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
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
    var size = 56, margin = 20;
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
    var pw = Math.min(380, window.innerWidth - 24);
    var left = b.left + b.width / 2 < window.innerWidth / 2 ? b.left : b.right - pw;
    left = Math.max(12, Math.min(left, window.innerWidth - pw - 12));
    panel.style.left = left + "px";
    panel.style.width = pw + "px";
    // Abre acima da bolha por padrão.
    var ph = Math.min(560, window.innerHeight - 96);
    var top = b.top - ph - 12;
    if (top < 12) top = Math.min(b.bottom + 12, window.innerHeight - ph - 12);
    panel.style.top = Math.max(12, top) + "px";
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
      var size = 56, margin = 20;
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
      bubble.innerHTML = ICON_CHAT;
    }
  }

  // ==== Mensagens ====
  function addMsg(role, text) {
    var el = document.createElement("div");
    el.className = "m " + (role === "user" ? "u" : "a");
    el.textContent = text;
    messagesEl.appendChild(el);
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

  function submit() {
    var text = inputEl.value.trim();
    if (!text || busy) return;
    inputEl.value = "";
    inputEl.style.height = "auto";
    addMsg("user", text);
    history.push({ role: "user", content: text });
    ask();
  }

  function ask() {
    busy = true;
    sendBtn.disabled = true;
    var typing = document.createElement("div");
    typing.className = "m a";
    typing.innerHTML = '<span class="dots"><span></span><span></span><span></span></span>';
    messagesEl.appendChild(typing);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    var answerEl = null;
    var full = "";
    var citations = [];

    fetch(API + "/api/v1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Widget-Key": KEY },
      body: JSON.stringify({
        messages: history,
        conversationId: conversationId,
        sessionId: sessionId,
      }),
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
      } else if (evt.type === "token") {
        if (typing.parentNode) typing.remove();
        if (!answerEl) answerEl = addMsg("assistant", "");
        full += evt.value;
        answerEl.textContent = full;
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
      if (full) {
        history.push({ role: "assistant", content: full });
        if (citations.length) renderCitations(citations);
      }
      done();
    }
    function done() {
      busy = false;
      sendBtn.disabled = false;
    }
  }

  function renderCitations(cites) {
    var box = document.createElement("div");
    box.className = "cites";
    cites.forEach(function (c) {
      var a = document.createElement("a");
      a.href = API + c.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "[" + c.n + "] " + c.title;
      box.appendChild(a);
    });
    messagesEl.appendChild(box);
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
