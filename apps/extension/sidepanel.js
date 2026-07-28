// Painel lateral.
//  Fase 5.0: conexão + iniciar sessão.
//  Fase 5.1: capturar a tela (Ctrl+Espaço ou botão), recortar e enviar o print
//  para a sessão ativa.
"use strict";

const $ = (id) => document.getElementById(id);
const DEFAULT_BASE = "http://localhost:3008";

let shotCount = 0;

// ── Config (chrome.storage.local) ───────────────────────────────────────────
function loadConfig() {
  return new Promise((resolve) => chrome.storage.local.get(["apiBase", "token", "email", "sessionId"], (v) => resolve(v || {})));
}
function setConn(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}
function normalizeBase(v) {
  return (v || "").trim().replace(/\/+$/, "");
}
function sessionMsg(kind, html) {
  const el = $("sessionStatus");
  el.style.display = "block";
  el.className = "status " + kind;
  el.innerHTML = html;
}
function connMsg(kind, text) {
  const el = $("connStatus");
  el.style.display = "block";
  el.className = "status " + kind;
  el.textContent = text;
}

// ── Início ──────────────────────────────────────────────────────────────────
(async function init() {
  const cfg = await loadConfig();
  $("base").value = cfg.apiBase || DEFAULT_BASE;
  refreshConn(cfg);

  $("login").addEventListener("click", login);
  $("logout").addEventListener("click", logout);
  $("pass").addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
  });

  $("start").addEventListener("click", startSession);
  $("capture").addEventListener("click", captureNow);
  $("captureFull").addEventListener("click", captureFullNow);
  $("scan").addEventListener("click", scanNow);
  $("cropCancel").addEventListener("click", () => closeCrop());
  $("cropOk").addEventListener("click", confirmCrop);
  $("cropAi").addEventListener("click", aiCropSuggest);
  $("finalize").addEventListener("click", finalizeSession);
  $("space").addEventListener("change", updateFinalizeEnabled);
  $("rec").addEventListener("click", toggleRec);
  $("chatSend").addEventListener("click", chatSend);
  $("chatInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatSend();
    }
  });

  // Menu da conta (chip no topo → Sair).
  $("acctChip").addEventListener("click", (e) => {
    e.stopPropagation();
    $("acctMenu").hidden = !$("acctMenu").hidden;
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".acct")) $("acctMenu").hidden = true;
  });

  // Chat flutuante (assistente).
  $("chatFab").addEventListener("click", () => openChat(true));
  $("chatClose").addEventListener("click", () => openChat(false));

  setupSelection();
  loadSpaces();

  // Print pendente (capturado antes do painel abrir)?
  if (cfg.pendingShot) showCrop(cfg.pendingShot);
  chrome.storage.local.get(["pendingShot"], (v) => v.pendingShot && showCrop(v.pendingShot));
})();

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg) return;
  if (msg.type === "pendingShot") {
    chrome.storage.local.get(["pendingShot"], (v) => v.pendingShot && showCrop(v.pendingShot));
  } else if (msg.type === "captureError") {
    sessionMsg("err", "Não consegui capturar: " + msg.error + "<br>Tente o atalho <b>Ctrl+Espaço</b> na página.");
  }
});

let conectadoAgora = false;

function refreshConn(cfg) {
  const conectado = !!(cfg.token && cfg.token.startsWith("ext_live_"));
  conectadoAgora = conectado;
  // Onboarding: mostra a tela de login OU o app, nunca os dois.
  $("loginView").hidden = conectado;
  $("appView").hidden = !conectado;
  $("chatFab").hidden = !conectado;
  if (conectado) {
    $("acctEmail").textContent = cfg.email || "usuário";
    $("acctEmail").title = cfg.email || "";
  } else {
    openChat(false);
    $("connStatus").style.display = "none";
  }
  $("start").disabled = !conectado || !cfg.apiBase;
  refreshSession(cfg);
}

// Indicador "capturando" quando há uma sessão ativa (esconde o botão iniciar).
function refreshSession(cfg) {
  const ativa = !!cfg.sessionId;
  $("start").hidden = ativa;
  $("sessionHint").hidden = ativa;
  $("sessionLive").hidden = !ativa;
  if (ativa) {
    $("sessionLiveText").textContent = shotCount
      ? "Capturando · " + shotCount + " print(s)"
      : "Sessão ativa · capture as telas";
  }
}
async function syncSession() {
  refreshSession(await loadConfig());
}

// ── Chat flutuante (assistente) ─────────────────────────────────────────────
function openChat(open) {
  $("chatPanel").hidden = !open;
  $("chatFab").hidden = open || !conectadoAgora; // o painel cobre a bolha
  if (open) {
    renderChat();
    setTimeout(() => $("chatInput").focus(), 30);
  }
}
// Some com o chat enquanto o print está sendo recortado (não atrapalha a leitura).
function hideChatForCapture() {
  openChat(false);
  $("chatFab").hidden = true;
}
function restoreChat() {
  $("chatFab").hidden = !conectadoAgora;
}

async function login() {
  const base = normalizeBase($("base").value) || DEFAULT_BASE;
  const email = $("email").value.trim();
  const pass = $("pass").value;
  if (!email || !pass) return connMsg("err", "Informe e-mail e senha.");
  $("login").disabled = true;
  connMsg("info", "Entrando…");
  try {
    const res = await fetch(base + "/api/v1/ext/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      connMsg("err", data.error || "Erro " + res.status);
      return;
    }
    await setConn({ apiBase: base, token: data.token, email: data.email });
    $("pass").value = "";
    $("connStatus").style.display = "none";
    refreshConn({ apiBase: base, token: data.token, email: data.email });
    loadSpaces();
  } catch (e) {
    connMsg("err", "Falha de rede: " + (e && e.message ? e.message : e));
  } finally {
    $("login").disabled = false;
  }
}

async function logout() {
  await new Promise((r) => chrome.storage.local.remove(["token", "email", "sessionId"], r));
  $("acctMenu").hidden = true;
  shotCount = 0;
  refreshConn({ apiBase: normalizeBase($("base").value) });
  $("space").innerHTML = '<option value="">—</option>';
  updateFinalizeEnabled();
}

async function startSession() {
  const cfg = await loadConfig();
  const base = normalizeBase(cfg.apiBase);
  const token = (cfg.token || "").trim();
  if (!base || !token) return sessionMsg("err", "Configure o endereço e o token primeiro.");
  $("start").disabled = true;
  sessionMsg("info", "Iniciando sessão…");
  try {
    const res = await fetch(base + "/api/v1/ext/session", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Extension-Token": token },
      body: JSON.stringify({ title: "Sessão via extensão" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      sessionMsg("err", "Erro: " + (data.error || "HTTP " + res.status));
    } else {
      await chrome.storage.local.set({ sessionId: data.sessionId });
      await chrome.storage.local.remove("lastNavUrl");
      shotCount = 0;
      $("shots").innerHTML = "";
      $("shotCount").textContent = "Nenhum print ainda.";
      sessionMsg("ok", "Sessão iniciada ✓ — capture as telas com <kbd>Ctrl</kbd>+<kbd>Espaço</kbd>.");
      await syncSession();
      loadSpaces();
      updateFinalizeEnabled();
    }
  } catch (e) {
    sessionMsg("err", "Falha de rede: " + (e && e.message ? e.message : e));
  } finally {
    $("start").disabled = false;
  }
}

// ── Captura ───────────────────────────────────────────────────────────────
function captureNow() {
  chrome.runtime.sendMessage({ type: "capture" }, (resp) => {
    if (chrome.runtime.lastError || !resp || !resp.ok) {
      const err = (resp && resp.error) || (chrome.runtime.lastError && chrome.runtime.lastError.message) || "sem acesso à aba";
      sessionMsg("err", "Não consegui capturar (" + err + ").<br>Use o atalho <b>Ctrl+Espaço</b> direto na página.");
    }
    // Sucesso: o service worker guarda o print pendente e avisa via mensagem.
  });
}
function captureFullNow() {
  sessionMsg("info", "Capturando a página inteira…");
  chrome.runtime.sendMessage({ type: "captureFull" }, (resp) => {
    if (chrome.runtime.lastError || !resp || !resp.ok) {
      const err = (resp && resp.error) || (chrome.runtime.lastError && chrome.runtime.lastError.message) || "sem acesso à aba";
      sessionMsg("err", "Não consegui capturar a página (" + err + ").<br>Use o atalho <b>Ctrl+Shift+Espaço</b> na página.");
    }
  });
}

// Varredura da tela (mesmo poder do widget): lê campos/textos/tabelas/modais/
// iframes e guarda como evento 'scan' (contexto para a IA).
function scanNow() {
  sessionMsg("info", "Lendo os dados da tela…");
  chrome.runtime.sendMessage({ type: "scan" }, async (resp) => {
    if (chrome.runtime.lastError || !resp || !resp.ok) {
      const err = (resp && resp.error) || (chrome.runtime.lastError && chrome.runtime.lastError.message) || "sem acesso à aba";
      sessionMsg("err", "Não consegui ler a tela (" + err + ").");
      return;
    }
    const texto = resp.texto || "";
    if (!texto) {
      sessionMsg("info", "Nada relevante para capturar nesta tela.");
      return;
    }
    const cfg = await loadConfig();
    const base = normalizeBase(cfg.apiBase);
    if (!base || !cfg.token || !cfg.sessionId) {
      sessionMsg("err", "Inicie uma sessão primeiro.");
      return;
    }
    try {
      const res = await fetch(base + "/api/v1/ext/event", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Extension-Token": cfg.token },
        body: JSON.stringify({ sessionId: cfg.sessionId, kind: "scan", label: texto, t_ms: Date.now() }),
      });
      if (res.ok) sessionMsg("ok", "Dados da tela capturados ✓ (a IA usa como contexto).");
      else {
        const j = await res.json().catch(() => ({}));
        sessionMsg("err", "Erro: " + (j.error || res.status));
      }
    } catch (e) {
      sessionMsg("err", "Falha ao enviar: " + (e && e.message ? e.message : e));
    }
  });
}

// ── Recorte ───────────────────────────────────────────────────────────────
let pending = null; // { dataUrl, url, title }
let sel = null; // seleção em px do stage: { x, y, w, h }

function showCrop(shot) {
  pending = shot;
  sel = null;
  hideChatForCapture(); // enquanto o print está na tela, o assistente some
  $("cropSel").style.display = "none";
  $("cropAiStatus").style.display = "none";
  $("cropOverlay").style.display = "flex";
  chrome.storage.local.get(["sessionId"], (v) => {
    const semSessao = !v.sessionId;
    $("cropWarn").style.display = semSessao ? "block" : "none";
    if (semSessao) $("cropWarn").textContent = "Inicie uma sessão antes de salvar o print.";
    $("cropOk").disabled = semSessao;
  });
  if (shot.fullPage) {
    $("cropImg").removeAttribute("src");
    cropAiMsg("Montando a página inteira…");
    stitchFullPage(shot.fullPage)
      .then((url) => {
        $("cropImg").src = url;
        $("cropAiStatus").style.display = "none";
      })
      .catch(() => {
        const first = shot.fullPage.shots && shot.fullPage.shots[0];
        if (first) $("cropImg").src = first.dataUrl;
        $("cropAiStatus").style.display = "none";
      });
  } else {
    $("cropImg").src = shot.dataUrl;
  }
}

// Junta os viewports capturados num único print (respeita devicePixelRatio e a
// posição real de rolagem de cada pedaço).
function loadImg(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}
async function stitchFullPage(fp) {
  const imgs = await Promise.all(fp.shots.map((s) => loadImg(s.dataUrl)));
  const dpr = fp.metrics.dpr || 1;
  const W = imgs[0] ? imgs[0].naturalWidth : Math.round(fp.metrics.viewW * dpr);
  const H = Math.round(fp.metrics.totalH * dpr);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  imgs.forEach((im, i) => ctx.drawImage(im, 0, Math.round(fp.shots[i].y * dpr)));
  return canvas.toDataURL("image/png");
}

// Recorte sugerido pela IA: manda a imagem (reduzida) e aplica o retângulo.
function cropAiMsg(t) {
  const el = $("cropAiStatus");
  el.style.display = "block";
  el.textContent = t;
}
function applyCropFraction(crop) {
  const img = $("cropImg");
  const r = img.getBoundingClientRect();
  sel = { x: crop.x * r.width, y: crop.y * r.height, w: crop.w * r.width, h: crop.h * r.height };
  const s = $("cropSel");
  s.style.display = "block";
  s.style.left = sel.x + "px";
  s.style.top = sel.y + "px";
  s.style.width = sel.w + "px";
  s.style.height = sel.h + "px";
}
async function aiCropSuggest() {
  const cfg = await loadConfig();
  const base = normalizeBase(cfg.apiBase);
  if (!base || !cfg.token) return cropAiMsg("Configure a conexão primeiro.");
  const img = $("cropImg");
  if (!img.naturalWidth) return cropAiMsg("Aguarde a imagem carregar.");
  $("cropAi").disabled = true;
  cropAiMsg("Analisando com IA…");
  try {
    const scale = Math.min(1, 1024 / img.naturalWidth);
    const cw = Math.round(img.naturalWidth * scale);
    const ch = Math.round(img.naturalHeight * scale);
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    c.getContext("2d").drawImage(img, 0, 0, cw, ch);
    const blob = await new Promise((res) => c.toBlob(res, "image/png"));
    const fd = new FormData();
    fd.append("file", blob, "crop.png");
    const res = await fetch(base + "/api/v1/ext/suggest-crop", {
      method: "POST",
      headers: { "X-Extension-Token": cfg.token },
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return cropAiMsg("Erro: " + (data.error || "HTTP " + res.status));
    if (!data.crop) return cropAiMsg("A IA achou a tela inteira relevante — sem recorte.");
    applyCropFraction(data.crop);
    cropAiMsg("Recorte sugerido pela IA — ajuste se quiser e confirme.");
  } catch (e) {
    cropAiMsg("Falha: " + (e && e.message ? e.message : e));
  } finally {
    $("cropAi").disabled = false;
  }
}

function closeCrop() {
  $("cropOverlay").style.display = "none";
  pending = null;
  sel = null;
  restoreChat(); // print resolvido: a bolha do assistente volta
  chrome.storage.local.remove("pendingShot");
}

function setupSelection() {
  const stage = $("cropStage");
  let dragging = false;
  let start = null;

  const ponto = (e) => {
    const r = $("cropImg").getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - r.left, r.width)),
      y: Math.max(0, Math.min(e.clientY - r.top, r.height)),
    };
  };
  stage.addEventListener("pointerdown", (e) => {
    dragging = true;
    start = ponto(e);
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const p = ponto(e);
    sel = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) };
    const s = $("cropSel");
    s.style.display = "block";
    s.style.left = sel.x + "px";
    s.style.top = sel.y + "px";
    s.style.width = sel.w + "px";
    s.style.height = sel.h + "px";
  });
  stage.addEventListener("pointerup", () => {
    dragging = false;
    if (sel && (sel.w < 6 || sel.h < 6)) {
      sel = null;
      $("cropSel").style.display = "none";
    }
  });
}

function confirmCrop() {
  if (!pending) return;
  const img = $("cropImg");
  const r = img.getBoundingClientRect();
  const scaleX = img.naturalWidth / r.width;
  const scaleY = img.naturalHeight / r.height;
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
  if (sel && sel.w >= 6 && sel.h >= 6) {
    sx = Math.round(sel.x * scaleX);
    sy = Math.round(sel.y * scaleY);
    sw = Math.round(sel.w * scaleX);
    sh = Math.round(sel.h * scaleY);
  }
  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  canvas.toBlob((blob) => {
    if (blob) void uploadShot(blob, pending);
    closeCrop();
  }, "image/png");
}

async function uploadShot(blob, meta) {
  const cfg = await loadConfig();
  const base = normalizeBase(cfg.apiBase);
  if (!base || !cfg.token || !cfg.sessionId) {
    sessionMsg("err", "Sessão ou conexão ausente — não enviei o print.");
    return;
  }
  const thumbUrl = URL.createObjectURL(blob);
  const fd = new FormData();
  fd.append("file", blob, "captura.png");
  fd.append("sessionId", cfg.sessionId);
  fd.append("t_ms", String((meta && meta.ts) || Date.now())); // momento da captura
  if (meta && meta.url) fd.append("url", meta.url);
  if (meta && meta.title) fd.append("title", meta.title);
  try {
    const res = await fetch(base + "/api/v1/ext/shot", {
      method: "POST",
      headers: { "X-Extension-Token": cfg.token },
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      sessionMsg("err", "Print não salvo: " + (data.error || "HTTP " + res.status));
      return;
    }
    shotCount++;
    const im = document.createElement("img");
    im.src = thumbUrl;
    im.title = (meta && meta.title) || "";
    $("shots").prepend(im);
    $("shotCount").textContent = shotCount + " print(s) nesta sessão.";
    refreshSession(cfg); // atualiza o "Capturando · N print(s)"
    sessionMsg("ok", "Print salvo ✓");
  } catch (e) {
    sessionMsg("err", "Falha ao enviar o print: " + (e && e.message ? e.message : e));
  }
}

// ── Narração (gravação de microfone → transcrição) ──────────────────────────
let recording = false;
function recMsg(kind, html) {
  const el = $("recStatus");
  el.style.display = "block";
  el.className = "status " + kind;
  el.innerHTML = html;
}
// Grava no PRÓPRIO painel (contexto visível → o pedido de permissão de
// microfone aparece; o documento offscreen não conseguia perguntar).
let mediaRecorder = null, recStream = null, recChunks = [], recStartMs = 0;
async function toggleRec() {
  const cfg = await loadConfig();
  if (!cfg.sessionId) return recMsg("err", "Inicie uma sessão antes de gravar.");
  if (!recording) {
    recMsg("info", "Pedindo acesso ao microfone…");
    try {
      recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const nome = (e && e.name) || String(e);
      // O painel lateral quase nunca consegue exibir o aviso de permissão do
      // microfone (→ NotAllowedError). Abrimos uma ABA dedicada, onde o aviso
      // aparece de forma confiável; a permissão é por ORIGEM e passa a valer
      // aqui também. Depois é só voltar e gravar.
      if (nome === "NotAllowedError" || nome === "SecurityError" || nome === "PermissionDeniedError") {
        recMsg("info", "Abri uma aba para você autorizar o microfone. Permita lá e volte aqui para gravar.");
        try {
          chrome.tabs.create({ url: chrome.runtime.getURL("mic.html") });
        } catch {
          window.open(chrome.runtime.getURL("mic.html"), "_blank");
        }
      } else if (nome === "NotFoundError" || nome === "DevicesNotFoundError") {
        recMsg("err", "Nenhum microfone encontrado. Conecte um microfone e tente de novo.");
      } else {
        recMsg("err", "Sem acesso ao microfone (" + nome + "). Tente de novo.");
      }
      return;
    }
    recChunks = [];
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
    mediaRecorder = new MediaRecorder(recStream, { mimeType: mime });
    mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
    recStartMs = Date.now(); // âncora dos segmentos (o print no meio da fala cai no lugar certo)
    mediaRecorder.start();
    recording = true;
    $("rec").textContent = "⏹️ Parar e transcrever";
    recMsg("info", "Gravando… fale a explicação e clique para parar.");
  } else {
    $("rec").disabled = true;
    recMsg("info", "Transcrevendo…");
    const blob = await pararGravacao();
    recording = false;
    $("rec").disabled = false;
    $("rec").textContent = "🎙️ Gravar narração";
    await enviarAudio(blob, cfg);
  }
}
function pararGravacao() {
  return new Promise((resolve) => {
    if (!mediaRecorder) return resolve(new Blob([], { type: "audio/webm" }));
    mediaRecorder.onstop = () => {
      if (recStream) recStream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(recChunks, { type: "audio/webm" });
      mediaRecorder = null;
      recStream = null;
      recChunks = [];
      resolve(blob);
    };
    mediaRecorder.stop();
  });
}
async function enviarAudio(blob, cfg) {
  const base = normalizeBase(cfg.apiBase);
  if (!base || !cfg.token || !cfg.sessionId) return recMsg("err", "Sem sessão ou conexão.");
  if (!blob.size) return recMsg("err", "Gravação vazia.");
  try {
    const fd = new FormData();
    fd.append("file", blob, "narracao.webm");
    fd.append("sessionId", cfg.sessionId);
    fd.append("t_ms", String(recStartMs || Date.now())); // início da gravação
    const res = await fetch(base + "/api/v1/ext/audio", {
      method: "POST",
      headers: { "X-Extension-Token": cfg.token },
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return recMsg("err", "Erro: " + (data.error || "HTTP " + res.status));
    if (data.transcribed && data.text) {
      recMsg("ok", "Narração transcrita ✓ — entra no rascunho ao finalizar.<br><span style=\"opacity:.8\">" + escapeHtml(data.text.slice(0, 200)) + (data.text.length > 200 ? "…" : "") + "</span>");
    } else {
      recMsg("info", "Áudio salvo. A transcrição automática não está configurada (Sistema → IA → Transcrição de voz).");
    }
  } catch (e) {
    recMsg("err", "Falha ao enviar o áudio: " + (e && e.message ? e.message : e));
  }
}

// ── Chatbot da IA (estruturação prévia) ─────────────────────────────────────
const chatMsgs = [];
let chatBusy = false;
function renderChat() {
  const box = $("chatMsgs");
  box.innerHTML = "";
  if (!chatMsgs.length) {
    const empty = document.createElement("div");
    empty.className = "chat-empty";
    empty.innerHTML = 'Pergunte como organizar o que você está capturando.<br>Ex.: <i>"como divido isso em passos?"</i>';
    box.appendChild(empty);
    return;
  }
  chatMsgs.forEach((m) => {
    const el = document.createElement("div");
    el.className = "cm " + (m.role === "user" ? "u" : "a");
    el.textContent = m.content;
    box.appendChild(el);
  });
  box.scrollTop = box.scrollHeight;
}
async function chatSend() {
  if (chatBusy) return;
  const text = $("chatInput").value.trim();
  if (!text) return;
  const cfg = await loadConfig();
  const base = normalizeBase(cfg.apiBase);
  if (!base || !cfg.token) {
    chatMsgs.push({ role: "assistant", content: "Entre com e-mail e senha primeiro." });
    return renderChat();
  }
  if (!cfg.sessionId) {
    chatMsgs.push({ role: "assistant", content: "Inicie uma sessão para eu ver o material que você está capturando." });
    return renderChat();
  }
  $("chatInput").value = "";
  chatMsgs.push({ role: "user", content: text });
  chatBusy = true;
  $("chatSend").disabled = true;
  const pensando = { role: "assistant", content: "…" };
  chatMsgs.push(pensando);
  renderChat();
  try {
    const enviar = chatMsgs.filter((m) => m !== pensando).map((m) => ({ role: m.role, content: m.content }));
    const res = await fetch(base + "/api/v1/ext/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Extension-Token": cfg.token },
      body: JSON.stringify({ sessionId: cfg.sessionId, messages: enviar }),
    });
    const data = await res.json().catch(() => ({}));
    const i = chatMsgs.indexOf(pensando);
    if (i >= 0) chatMsgs.splice(i, 1);
    chatMsgs.push({ role: "assistant", content: res.ok ? data.reply || "(sem resposta)" : "Erro: " + (data.error || "HTTP " + res.status) });
  } catch (e) {
    const i = chatMsgs.indexOf(pensando);
    if (i >= 0) chatMsgs.splice(i, 1);
    chatMsgs.push({ role: "assistant", content: "Falha: " + (e && e.message ? e.message : e) });
  } finally {
    chatBusy = false;
    $("chatSend").disabled = false;
    renderChat();
  }
}

// ── Finalizar → rascunho ────────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function finMsg(kind, html) {
  const el = $("finalizeStatus");
  el.style.display = "block";
  el.className = "status " + kind;
  el.innerHTML = html;
}
async function updateFinalizeEnabled() {
  const cfg = await loadConfig();
  $("finalize").disabled = !cfg.sessionId || !$("space").value;
}
async function loadSpaces() {
  const cfg = await loadConfig();
  const base = normalizeBase(cfg.apiBase);
  const sel = $("space");
  if (!base || !cfg.token) {
    sel.innerHTML = '<option value="">—</option>';
    return updateFinalizeEnabled();
  }
  try {
    const res = await fetch(base + "/api/v1/ext/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Extension-Token": cfg.token },
    });
    const data = await res.json().catch(() => ({}));
    const spaces = (data && data.spaces) || [];
    sel.innerHTML = spaces.length
      ? spaces.map((s) => '<option value="' + s.id + '">' + (s.type === "global" ? "🌐 " : "👤 ") + escapeHtml(s.name) + "</option>").join("")
      : '<option value="">(nenhuma documentação disponível)</option>';
  } catch {
    sel.innerHTML = '<option value="">(falha ao carregar)</option>';
  }
  updateFinalizeEnabled();
}
async function finalizeSession() {
  const cfg = await loadConfig();
  const base = normalizeBase(cfg.apiBase);
  const spaceId = $("space").value;
  if (!cfg.sessionId) return finMsg("err", "Nenhuma sessão ativa.");
  if (!spaceId) return finMsg("err", "Escolha a documentação de destino.");
  $("finalize").disabled = true;
  finMsg("info", "Montando o rascunho…");
  try {
    const res = await fetch(base + "/api/v1/ext/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Extension-Token": cfg.token },
      body: JSON.stringify({ sessionId: cfg.sessionId, spaceId, title: $("draftTitle").value.trim() || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      finMsg("err", "Erro: " + (data.error || "HTTP " + res.status));
      return;
    }
    await chrome.storage.local.remove(["sessionId", "lastNavUrl"]);
    shotCount = 0;
    $("shots").innerHTML = "";
    $("shotCount").textContent = "Nenhum print ainda.";
    $("draftTitle").value = "";
    await syncSession(); // volta o botão "Iniciar sessão" e esconde o "Capturando…"
    finMsg(
      "ok",
      'Rascunho criado ✓ "' + escapeHtml(data.title || "") + '"<br><a href="' + base + '/admin/conteudo" target="_blank" style="color:inherit;font-weight:700">Abrir no admin →</a>',
    );
    sessionMsg("info", "Sessão finalizada. Inicie outra para uma nova captura.");
  } catch (e) {
    finMsg("err", "Falha ao finalizar: " + (e && e.message ? e.message : e));
  } finally {
    updateFinalizeEnabled();
  }
}
