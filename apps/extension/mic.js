// Página de PERMISSÃO do microfone.
//
// O painel lateral (side panel) muitas vezes NÃO consegue exibir o aviso de
// permissão do microfone, então getUserMedia falha com NotAllowedError. Uma
// ABA normal exibe o aviso de forma confiável — e a permissão é por ORIGEM
// (chrome-extension://<id>), então autorizar aqui vale também para o painel.
"use strict";

const btn = document.getElementById("allow");
const status = document.getElementById("status");

function show(kind, text) {
  status.style.display = "block";
  status.className = "status " + kind;
  status.textContent = text;
}

async function pedir() {
  btn.disabled = true;
  show("info", "Aguardando sua autorização no aviso do navegador…");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop()); // só queríamos a permissão
    show("ok", "✓ Microfone autorizado! Pode fechar esta aba e voltar à extensão para gravar.");
    btn.textContent = "Autorizado ✓";
  } catch (e) {
    const nome = (e && e.name) || String(e);
    if (nome === "NotAllowedError") {
      show("err", "Permissão negada. Clique no ícone de câmera/cadeado na barra de endereço, mude o microfone para 'Permitir' e tente de novo.");
    } else if (nome === "NotFoundError" || nome === "DevicesNotFoundError") {
      show("err", "Nenhum microfone encontrado. Conecte um microfone e tente de novo.");
    } else {
      show("err", "Não foi possível autorizar (" + nome + "). Verifique o microfone e tente de novo.");
    }
    btn.disabled = false;
  }
}

btn.addEventListener("click", pedir);
// Tenta assim que a aba abre (o clique/gesto de abrir a aba costuma bastar).
pedir();
