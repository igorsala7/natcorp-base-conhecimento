// Service worker (MV3).
//  · Abre o painel lateral ao clicar no ícone.
//  · Atalho Ctrl+Espaço (chrome.commands) → captura a tela visível e manda para
//    o painel recortar/confirmar. O comando concede `activeTab` no momento do
//    print, então `captureVisibleTab` funciona sem permissão ampla.
"use strict";

function habilitarPainel() {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(function () {});
  }
}
chrome.runtime.onInstalled.addListener(habilitarPainel);
chrome.runtime.onStartup.addListener(habilitarPainel);
habilitarPainel();

// Captura a aba visível e guarda como "print pendente" para o painel recortar.
async function capturar() {
  const abas = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const aba = abas && abas[0];
  if (!aba) throw new Error("Nenhuma aba ativa.");
  const dataUrl = await chrome.tabs.captureVisibleTab(aba.windowId, { format: "png" });
  const pendingShot = { dataUrl: dataUrl, url: aba.url || "", title: aba.title || "", ts: Date.now() };
  await chrome.storage.local.set({ pendingShot: pendingShot });
  // Abre o painel (o comando é um gesto do usuário) e avisa quem estiver ouvindo.
  try {
    await chrome.sidePanel.open({ windowId: aba.windowId });
  } catch (e) {
    /* pode falhar se já estiver aberto; o painel lê o print pendente ao carregar */
  }
  chrome.runtime.sendMessage({ type: "pendingShot" }).catch(function () {});
  return pendingShot;
}

function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

// Captura a PÁGINA INTEIRA: rola em passos e captura cada viewport; o painel
// junta (stitch) os pedaços num só print. Usa `scripting` + `activeTab` — sem
// content script em "todos os sites".
async function capturarPaginaInteira() {
  const abas = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const aba = abas && abas[0];
  if (!aba) throw new Error("Nenhuma aba ativa.");
  const met = await chrome.scripting.executeScript({
    target: { tabId: aba.id },
    func: function () {
      return {
        totalH: Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0),
        viewH: window.innerHeight,
        viewW: window.innerWidth,
        dpr: window.devicePixelRatio || 1,
        scrollY: window.scrollY,
      };
    },
  });
  const m = met && met[0] && met[0].result;
  if (!m || !m.viewH) throw new Error("Não consegui medir a página.");
  const passos = Math.min(Math.ceil(m.totalH / m.viewH), 12); // teto de segurança
  const shots = [];
  for (let i = 0; i < passos; i++) {
    const r = await chrome.scripting.executeScript({
      target: { tabId: aba.id },
      func: function (yy) { window.scrollTo(0, yy); return window.scrollY; },
      args: [i * m.viewH],
    });
    const realY = r && r[0] && typeof r[0].result === "number" ? r[0].result : i * m.viewH;
    await sleep(560); // repaint + limite do captureVisibleTab (~2/s)
    const dataUrl = await chrome.tabs.captureVisibleTab(aba.windowId, { format: "png" });
    shots.push({ dataUrl: dataUrl, y: realY });
    if (realY + m.viewH >= m.totalH) break; // chegou ao rodapé
  }
  await chrome.scripting.executeScript({ target: { tabId: aba.id }, func: function (yy) { window.scrollTo(0, yy); }, args: [m.scrollY] });
  const pending = { fullPage: { shots: shots, metrics: m }, url: aba.url || "", title: aba.title || "", ts: Date.now() };
  await chrome.storage.local.set({ pendingShot: pending });
  try {
    await chrome.sidePanel.open({ windowId: aba.windowId });
  } catch (e) {
    /* já aberto — o painel lê o print pendente */
  }
  chrome.runtime.sendMessage({ type: "pendingShot" }).catch(function () {});
  return pending;
}

function erroCaptura(e) {
  chrome.runtime.sendMessage({ type: "captureError", error: String((e && e.message) || e) }).catch(function () {});
}

chrome.commands.onCommand.addListener(function (command) {
  if (command === "capturar-tela") capturar().catch(erroCaptura);
  else if (command === "capturar-pagina") capturarPaginaInteira().catch(erroCaptura);
});

// Botões do painel (capturas). A gravação de microfone roda no PRÓPRIO painel
// (contexto visível → o pedido de permissão de microfone aparece).
chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
  if (!msg) return;
  if (msg.type === "capture" || msg.type === "captureFull") {
    const fn = msg.type === "captureFull" ? capturarPaginaInteira : capturar;
    fn()
      .then(function () { sendResponse({ ok: true }); })
      .catch(function (e) { sendResponse({ ok: false, error: String((e && e.message) || e) }); });
    return true;
  }
  if (msg.type === "scan") {
    varrerAba()
      .then(function (texto) { sendResponse({ ok: true, texto: texto }); })
      .catch(function (e) { sendResponse({ ok: false, error: String((e && e.message) || e) }); });
    return true;
  }
});

// ── Varredura da página (4b): mesmo poder do widget ─────────────────────────
// Injeta a coleta na aba ativa (host_permissions <all_urls>) e devolve o texto:
// campos (com valores mascarando segredos), textos, tabelas/relatórios, MODAIS
// e iframes de MESMA ORIGEM.
async function varrerAba() {
  const abas = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const aba = abas && abas[0];
  if (!aba) throw new Error("Nenhuma aba ativa.");
  const res = await chrome.scripting.executeScript({ target: { tabId: aba.id, allFrames: true }, func: coletaDaPagina });
  // allFrames cobre iframes de mesma origem; junta os resultados dos frames.
  var partes = (res || [])
    .map(function (r) { return r && r.result ? r.result : ""; })
    .filter(Boolean);
  var s = partes.join("\n\n");
  return s.length > 7000 ? s.slice(0, 7000) + "\n…(truncado)" : s;
}

// Função INJETADA na página (roda no contexto dela). Autocontida (sem depender
// de nada do service worker).
function coletaDaPagina() {
  function t(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function val(el) {
    var ty = (el.type || "").toLowerCase();
    if (ty === "password") return "(oculto)";
    var nm = (el.name || "") + " " + (el.id || "") + " " + (el.getAttribute("autocomplete") || "");
    if (/senha|password|cvv|cvc|secret|token|pin|otp|cart(a|ã)o|card/i.test(nm)) return "(oculto)";
    if (ty === "checkbox" || ty === "radio") return el.checked ? "marcado" : "desmarcado";
    return t(el.value).slice(0, 120);
  }
  try {
    var doc = document;
    var lm = {};
    doc.querySelectorAll("label[for]").forEach(function (l) { lm[l.getAttribute("for")] = t(l.textContent); });
    var campos = [];
    doc.querySelectorAll("input,select,textarea").forEach(function (el) {
      if ((el.type || "") === "hidden") return;
      if (el.getClientRects && el.getClientRects().length === 0) return;
      var rot = el.getAttribute("aria-label") || lm[el.id] || el.placeholder || el.name || el.id || (el.type || "campo");
      var v = val(el);
      campos.push("- " + t(rot) + (v ? ": " + v : " (vazio)"));
    });
    var out = [];
    if (campos.length) out.push("CAMPOS:\n" + campos.slice(0, 80).join("\n"));
    var txt = t(doc.body ? doc.body.innerText : "");
    if (txt) out.push("TEXTO:\n" + txt);
    return out.join("\n\n");
  } catch (e) {
    return "";
  }
}

// ── Trilha de navegação (5.2) ────────────────────────────────────────────────
// Enquanto há uma sessão ativa, cada nova página da ABA ATIVA vira um evento
// `nav`. Dedup por URL. Ignora páginas internas do navegador.
function cfg() {
  return new Promise(function (resolve) {
    chrome.storage.local.get(["apiBase", "token", "sessionId", "lastNavUrl"], function (v) { resolve(v || {}); });
  });
}
function ehInterna(url) {
  return !url || url.indexOf("chrome://") === 0 || url.indexOf("chrome-extension://") === 0 || url.indexOf("about:") === 0 || url.indexOf("edge://") === 0;
}
async function registrarNav(tab) {
  if (!tab || !tab.active || ehInterna(tab.url)) return;
  const c = await cfg();
  if (!c.apiBase || !c.token || !c.sessionId) return;
  if (tab.url === c.lastNavUrl) return;
  try {
    const res = await fetch(c.apiBase.replace(/\/+$/, "") + "/api/v1/ext/event", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Extension-Token": c.token },
      body: JSON.stringify({ sessionId: c.sessionId, kind: "nav", url: tab.url, title: tab.title || "", t_ms: Date.now() }),
    });
    if (res.ok) await chrome.storage.local.set({ lastNavUrl: tab.url });
  } catch (e) {
    /* offline / plataforma fora do ar — ignora, tenta na próxima navegação */
  }
}
chrome.tabs.onActivated.addListener(function (info) {
  chrome.tabs.get(info.tabId, function (tab) {
    if (!chrome.runtime.lastError) registrarNav(tab);
  });
});
chrome.tabs.onUpdated.addListener(function (_id, changeInfo, tab) {
  if (changeInfo.status === "complete") registrarNav(tab);
});
