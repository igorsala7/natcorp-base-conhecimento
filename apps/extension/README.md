# Natcorp — Extensão de captura de documentação

Ferramenta **interna** de autoria (Fase 5). Documente enquanto navega: a
extensão captura a trilha e a plataforma monta artigos. Esta é a **Fase 5.0 —
fundação**: conectar (endereço + token) e iniciar uma sessão.

> É uma ferramenta de equipe autenticada — o oposto do widget público, que nunca
> pede login.

## Instalar (modo desenvolvedor, sem Web Store)

1. Abra `chrome://extensions` e ligue o **Modo do desenvolvedor**.
2. Clique em **Carregar sem compactação** e escolha esta pasta (`apps/extension`).
3. Clique no ícone da extensão → abre o **painel lateral**.
4. No painel, informe o **endereço da plataforma** (ex.: `http://localhost:3008`)
   e **entre com seu e-mail e senha** da plataforma (os mesmos do admin).
5. Clique em **Iniciar sessão**. A sessão aparece em **Sistema → Extensão →
   Sessões recentes** no admin.
6. Em qualquer página, aperte **`Ctrl` + `Espaço`** (ou o botão **Área visível**)
   para tirar um print; **📋 Capturar dados da tela** lê os campos/textos/tabelas
   (mesma varredura do widget); **🎙️ Gravar narração** grava a voz e transcreve.
   Recorte/reveja e o conteúdo entra na sessão (visível no admin).

> A extensão pede **acesso aos sites** (para capturar tela e ler os dados) e ao
> **microfone** (na 1ª gravação). Autorize quando o Chrome perguntar.

### Atalhos e modos de captura

- **`Ctrl` + `Espaço`** — captura a **área visível**.
- **`Ctrl` + `Shift` + `Espaço`** — captura a **página inteira** (rola e junta
  os pedaços). Também há botões no painel (Área visível / Página inteira).
- No crop, **✨ Sugerir recorte com IA** propõe o retângulo do conteúdo principal
  (você ajusta e confirma).
- No macOS o `Cmd + Espaço` é do Spotlight (o sistema o captura antes do
  navegador), por isso usamos `Ctrl`. Customize em `chrome://extensions/shortcuts`.
- Os atalhos concedem o acesso à aba no momento do print, então não é preciso dar
  permissão a "todos os sites".

### Narração por voz (transcrição)

- Card **Narração (microfone)** → **Gravar narração**: grava sua voz; ao parar, o
  servidor transcreve (Whisper) e o texto entra no rascunho ao finalizar.
- Precisa de um provedor **OpenAI** atribuído em **Sistema → IA → Transcrição de
  voz** (ou o provedor do Chat sendo OpenAI). Sem isso, o áudio é guardado mas
  não transcrito.
- A permissão de **microfone** é pedida na primeira gravação.

## Estrutura

- `manifest.json` — MV3 (permissões `storage`, `sidePanel`).
- `background.js` — service worker; abre o painel ao clicar no ícone.
- `sidepanel.html` / `sidepanel.js` — UI: conexão + iniciar sessão.

## Privacidade e retenção

- **Armazenamento privado:** prints e áudios ficam num bucket privado; nada é
  público. As imagens que entram no rascunho são cópias re-hospedadas à parte.
- **Máscara de URL:** segredos na querystring (`token`, `senha`, `api_key`, `cvv`…)
  e credenciais no userinfo são **redigidos** antes de salvar.
- **Revisão humana:** em **Sistema → Extensão → (sessão)** você revê cada
  print/tela/narração e **descarta** o que tiver dado sensível antes de gerar o
  rascunho. Ali também dá para **excluir a captura** (apaga os arquivos brutos).
- **Retenção:** `purgeOldSessions(dias)` (em `src/lib/ext/retention.ts`) remove
  capturas antigas — agende no worker quando quiser (padrão 30 dias).

## Empacotamento

Distribuição **interna** (sem Chrome Web Store): a pasta já carrega "sem
compactação". Para distribuir, compacte a pasta (`zip -r extensao.zip .` a partir
de `apps/extension`) ou use uma política de enterprise. Sem revisão da Google.

## Fases concluídas

5.0 fundação · 5.1 print + crop · 5.2 trilha → rascunho · 5.3 página inteira +
crop pela IA · 5.4 gravação + microfone + transcrição · 5.5 revisão + tempo real
· 5.6 polimento. Ver `docs/fase-5-extensao-navegador.md`.
