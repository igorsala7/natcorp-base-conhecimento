# Fase 5 — Extensão de navegador (plano)

> Trilha à parte, grande. Produto novo (extensão Chrome MV3 + APIs de ingestão).
> Este documento é o plano; nada aqui foi codado ainda. Decisões em aberto no fim.

---

## 1. Visão do produto

Documentar **fazendo**. O membro da equipe abre a extensão, inicia uma sessão e
navega pelo produto normalmente. Enquanto isso a extensão registra a trilha
(navegação, cliques, prints, gravação de tela + microfone) e a plataforma vai
**montando um artigo de rascunho em tempo real** — a IA sugere, pergunta,
printa com recorte inteligente e transforma a fala transcrita em texto. Tudo
fica salvo na **sessão (chat)** como base, e o resultado nasce como **rascunho
editável na árvore**, passando pelo editor que já existe.

É o mesmo espírito do Importador e da Captura (Fase 2): **captura → revisão
humana → rascunho**. Nunca vai direto para produção.

---

## 2. Princípios e decisões-âncora

- **É uma ferramenta INTERNA de autoria — não é o widget.** O widget público
  *nunca* pede login (regra de ouro). A extensão é o oposto: **exige
  autenticação** de um membro com permissão de autoria (`content.create`+).
  Os dois caminhos nunca se cruzam.
- **Codebase próprio.** A extensão vive em **`apps/extension/`** (monorepo,
  compartilha tipos com a plataforma). O servidor ganha um conjunto de **APIs de
  ingestão** autenticadas por **token pessoal revogável** (não cookies).
  Distribuição **interna** (unpacked/enterprise), sem Web Store.
- **Reusar o backend ao máximo** (mapa na §11): motor de escrita de artigo,
  re-hospedagem de imagens, block engine, criação de nós, storage de assets,
  RAG/ontologia, jobs do worker, Realtime.
- **Privacidade em primeiro lugar.** A extensão enxerga telas potencialmente
  sensíveis (o produto do cliente, dados pessoais). Capturas ficam em Storage
  **privado**; máscara de campos sensíveis por padrão; retenção configurável;
  **revisão humana** de cada print/trecho antes de virar doc; token revogável;
  auditoria.

---

## 3. Modelo de autenticação (recomendado)

**Token pessoal de extensão.** Nova tabela `extension_tokens` (id, user_id,
token_hash, label, scopes, created_at, last_used_at, revoked_at). Gerado em
**Sistema → Extensão** no admin e colado na extensão. Toda chamada de ingestão:
valida o token → resolve o `user_id` → checa `has_permission('content.create',
space_id)`. Revogável a qualquer momento; uso registrado em `audit_log`.

*Alternativa rejeitada:* ler a sessão do Supabase por content script na origem
da plataforma — frágil, acoplado a cookies, risco de vazamento.

---

## 4. Arquitetura da extensão (Chrome MV3)

| Componente | Papel |
|---|---|
| **Service worker** (background) | Orquestra a sessão; ouve navegação (`chrome.webNavigation` / `tabs.onUpdated`, inclusive novas abas); guarda o token; fala com as APIs de ingestão. É efêmero — estado em `chrome.storage`. |
| **Content script** (`<all_urls>`) | Captura cliques/inputs (rótulo + seletor, **sem valores** por padrão); desenha o **overlay de seleção** para o crop; destaca elementos que a IA sugere. |
| **Side panel** (`chrome.sidePanel`) | UI principal: sessão atual, timeline de eventos/prints, **chat com a IA**, botões (print da área visível / página inteira, iniciar/parar gravação), **prévia do rascunho** em construção. |
| **Offscreen document** (`chrome.offscreen`) | Obrigatório no MV3 para mídia sem DOM: **gravação de tela** (`getDisplayMedia`/`tabCapture`) + **microfone**, encode via `MediaRecorder`, fatiamento em chunks. |
| **Popup** | Login/colar token, começar sessão. |

---

## 5. Os fluxos de captura

### 5a. Trilha de navegação + cliques
`chrome.webNavigation` → cada troca de página/aba vira um evento
`{url, title, ts}`. Content script → cliques em botões/links/campos viram
`{rótulo, seletor, ts}` (valores só com opt-in por campo). Vira a espinha dos
**passos numerados** do artigo.

### 5b. Screenshot
- **Área visível:** `chrome.tabs.captureVisibleTab` (PNG).
- **Página inteira:** rolar-capturar-costurar (scroll-and-stitch) no
  content script + canvas; alternativa mais pesada via `chrome.debugger`
  (`Page.captureScreenshot`).
- **Crop antes de confirmar:** overlay de retângulo arrastável no content
  script → recorta no canvas → prévia → confirmar/descartar.
- **Crop pela IA:** manda o print + contexto e a IA sugere o recorte
  (reusa a lógica "IA escolhe/destaca/recorta" da Fase 2).

### 5c. Gravação de tela + microfone
Offscreen: `getDisplayMedia({video, audio})` + trilha de microfone;
`MediaRecorder` → chunks `webm` enviados incrementalmente. Durante a gravação a
IA pode disparar **prints automáticos** em momentos-chave (troca de tela) — o
usuário **revê e decide manter**. A voz vira **transcrição → texto do artigo**
via **Whisper no servidor** (nova finalidade `transcricao` em `resolveAi`;
áudio enviado por chunk para `POST /api/v1/ext/audio`).

---

## 6. Montagem do artigo em tempo real

- Cada sessão = **`extension_sessions`** no servidor (nova tabela; espelha
  `capture_jobs`). Eventos/prints/áudio chegam por ingestão incremental.
- A IA (reusa **`escreverArtigoEducativo`** + block engine) monta um rascunho
  evolutivo: passos a partir dos cliques, prints ancorados no ponto certo,
  texto a partir da transcrição. Imagens **re-hospedadas** (`reHospedarImagens`)
  no Storage de assets.
- **Tempo real:** o rascunho aparece numa aba do admin (editor/preview) via
  **Supabase Realtime** (canal por sessão) — mesmo padrão do progresso do
  Importador. Alternativa: polling.
- **Revisão humana obrigatória:** nasce como nó **`draft`** na árvore, editável
  no editor existente. Nada publica sem confirmação.

---

## 7. APIs de ingestão (servidor, autenticadas por `extension_tokens`)

| Rota | Função |
|---|---|
| `POST /api/v1/ext/session` | Inicia sessão → devolve id. |
| `POST /api/v1/ext/event` | Navegação / clique (`{tipo, url, título, rótulo, ts}`). |
| `POST /api/v1/ext/shot` (multipart) | Screenshot → valida (file-guard imagens) → Storage. |
| `POST /api/v1/ext/audio` (multipart, chunk) | Áudio → fila de transcrição. |
| `POST /api/v1/ext/finalize` | Dispara a montagem (job no worker) → cria `draft`. |

Todas: token + `has_permission`, rate limit, reuso de `receiveAttachment` /
`reHospedarImagens`. CORS restrito à origem `chrome-extension://<id>`.

---

## 8. Segurança & permissões

- **Host permissions `<all_urls>`** (necessário para capturar em qualquer site)
  — justificar na revisão da Web Store; considerar `activeTab`/sob demanda para
  reduzir superfície.
- **Máscara de dados sensíveis** por padrão (senha/cartão/campos marcados);
  nunca capturar valores sem opt-in.
- **Storage privado** + retenção configurável; sessão **cifrada** (reusa o
  padrão AES já usado nos segredos de captura).
- **Token revogável**; **auditoria** (`audit_log`) de sessões e criações.
- **LGPD:** avisar que a extensão pode capturar dados pessoais; permitir
  **borrar/descartar** prints antes de salvar.

---

## 9. Sub-fases (cada uma roda e você clica)

- **5.0 — Fundação.** Scaffold MV3 (side panel + popup + service worker),
  `extension_tokens` + tela **Sistema → Extensão**, `POST /api/v1/ext/session`.
  *Pronto quando:* colo o token, abro o painel, inicio uma sessão e ela aparece
  no admin.
- **5.1 — Screenshot + crop manual.** Print da área visível + overlay de
  seleção + confirmar → vira asset + evento na sessão.
  *Pronto quando:* capturo uma tela, recorto e vejo o print salvo.
- **5.2 — Trilha + montagem de rascunho.** Navegação/cliques viram passos;
  `finalize` → a IA monta um artigo `draft` com prints ancorados.
  *Pronto quando:* navego por 4 telas, finalizo, e nasce um rascunho navegável.
- **5.3 — Crop pela IA + página inteira.** Stitch de página inteira + a IA
  sugere o recorte.
- **5.4 — Gravação + microfone + transcrição.** Offscreen recording + STT →
  texto do artigo; prints automáticos revisáveis.
- **5.5 — Tempo real + revisão.** Preview ao vivo via Realtime; painel de
  revisão (manter/descartar cada print/trecho) antes de publicar.
- **5.6 — Polimento.** Máscara de dados, retenção, auditoria, empacotamento
  (Web Store ou interno), doc no manual.

---

## 10. Decisões (confirmadas)

1. **Distribuição / auth:** extensão **INTERNA** — instalada *unpacked* ou por
   política enterprise, **sem Web Store**. Sem revisão da Google, sem justificar
   `<all_urls>` publicamente → itera rápido para a equipe interna. (Mesmo assim,
   auth por **token pessoal** e CORS restrito a `chrome-extension://<id>`.)
2. **Transcrição de voz:** **Whisper no servidor** — nova "finalidade" de STT em
   `resolveAi` (`transcricao`), áudio enviado por chunk para a API. Custa por
   minuto, em troca de qualidade. (Web Speech pode entrar depois como prévia ao
   vivo, opcional.)
3. **Onde mora o código:** **monorepo `apps/extension`** — compartilha
   tipos/utilitários com a plataforma e um só CI.
4. **Transporte tempo real:** **Supabase Realtime** (canal por sessão), como no
   progresso do Importador.

---

## 11. Reuso (não reinventar)

- **Escrita de artigo + plano de captura:** `src/lib/capture/generate.ts`
  (`escreverArtigoEducativo`, `planejarCaptura`, `sugerirCaminho`,
  `converterPlano`) — Fase 2.
- **Re-hospedagem de imagens:** `src/lib/capture/rehost-images.ts`
  (`reHospedarImagens`).
- **Anexos / validação de imagem / Storage:** `src/lib/chat/attachment-store.ts`
  (`receiveAttachment`), `src/lib/importer/file-guard.ts`
  (`ehImagem`, `assertArquivoSeguro(..., {imagens:true})`).
- **Block engine + criação de nós + salvar:** motor de blocos, `createNode`,
  `saveArticle`.
- **Jobs assíncronos:** worker pg-boss (`npm run worker`).
- **Realtime:** já usado no progresso do Importador / backup / ontologia.
- **Contexto da doc para a IA:** RAG + ontologia (`retrieveContext`,
  `contextoParaCriacao`).

---

## 12. Riscos

- **MV3 é chato com mídia** (service worker efêmero, offscreen para
  gravação/`getUserMedia`, permissões de tela).
- **Revisão da Web Store** com `<all_urls>` pode travar — o caminho interno
  contorna.
- **Custo de transcrição** por minuto se for Whisper.
- **Privacidade/LGPD** — a captura ampla exige máscara e descarte fáceis.
- **Sincronização em tempo real** de rascunhos grandes (throttling/debounce).
