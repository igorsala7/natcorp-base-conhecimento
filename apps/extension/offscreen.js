// Documento offscreen (MV3): grava o MICROFONE (a narração) e, ao parar, envia
// o áudio para /api/v1/ext/audio, que transcreve (Whisper) e guarda como evento
// da sessão. O service worker não tem DOM/mídia — por isso a gravação vive aqui.
"use strict";

let recorder = null;
let chunks = [];
let stream = null;

chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
  if (!msg || msg.target !== "offscreen") return;
  if (msg.type === "recStart") {
    startRec()
      .then(function () { sendResponse({ ok: true }); })
      .catch(function (e) { sendResponse({ ok: false, error: String((e && e.message) || e) }); });
    return true;
  }
  if (msg.type === "recStop") {
    stopRec()
      .then(function (r) { sendResponse(r); })
      .catch(function (e) { sendResponse({ ok: false, error: String((e && e.message) || e) }); });
    return true;
  }
});

async function startRec() {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  chunks = [];
  const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
  recorder = new MediaRecorder(stream, { mimeType: mime });
  recorder.ondataavailable = function (e) {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  recorder.start();
}

async function stopRec() {
  if (!recorder) return { ok: false, error: "Nada está sendo gravado." };
  const parou = new Promise(function (resolve) { recorder.onstop = resolve; });
  recorder.stop();
  await parou;
  if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
  const blob = new Blob(chunks, { type: "audio/webm" });
  recorder = null;
  stream = null;
  chunks = [];

  const cfg = await new Promise(function (res) {
    chrome.storage.local.get(["apiBase", "token", "sessionId"], res);
  });
  const base = (cfg.apiBase || "").replace(/\/+$/, "");
  if (!base || !cfg.token || !cfg.sessionId) return { ok: false, error: "Sem sessão ou conexão." };
  if (!blob.size) return { ok: false, error: "Gravação vazia." };

  const fd = new FormData();
  fd.append("file", blob, "narracao.webm");
  fd.append("sessionId", cfg.sessionId);
  const r = await fetch(base + "/api/v1/ext/audio", {
    method: "POST",
    headers: { "X-Extension-Token": cfg.token },
    body: fd,
  });
  const data = await r.json().catch(function () { return {}; });
  if (!r.ok) return { ok: false, error: data.error || "HTTP " + r.status };
  return { ok: true, text: data.text || "", transcribed: !!data.transcribed };
}
