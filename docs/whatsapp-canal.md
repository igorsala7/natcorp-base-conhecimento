# Canal WhatsApp — chatbot com IA pelo WhatsApp

Guia completo para atender os usuários dos seus clientes **pelo WhatsApp**, com as mesmas
capacidades da IA do widget: responder pela documentação (RAG), **consultar as APIs** dos
clientes e entender **áudio, imagem, vídeo, arquivos e localização**.

> **Onde fica:** menu **Integrações → aba WhatsApp** (`/admin/integracoes`). Exige
> `integrations.manage`. Antes, leia o guia de [Integrações de IA](integracoes-agentes-ia.md).

---

## 1. Como funciona (visão geral)

```
Usuário manda mensagem para o SEU número oficial (Meta)
  → webhook recebe (assinatura validada)
  → pega o TELEFONE do remetente e chama a sua API de IDENTIFICAÇÃO
  → a API devolve: de qual CLIENTE (base_code) ele é + a identidade (matrícula, empresa…)
  → resolve a base → documentação + APIs + agentes (as mesmas do widget)
  → a IA responde; envia a resposta pela Cloud API
```

Pontos‑chave:
- **Um único número, seu** (a conta oficial Meta da sua empresa). Todos os clientes usam ele.
- **Quem é o usuário** vem da **sua API de identificação** (pelo telefone) — não do que ele digita.
- Reusa **base, credenciais, APIs/Tools e agentes** já cadastrados (guia de Integrações).

## 2. Pré‑requisitos (na Meta)

1. Uma **Conta Comercial (Business Manager)** verificada da sua empresa.
2. Um app na **Meta for Developers** com o produto **WhatsApp** adicionado.
3. Um **número** de telefone no WhatsApp Business Platform (Cloud API). Anote o
   **Phone number ID** e o **WhatsApp Business Account (WABA) ID**.
4. Um **token de acesso** para enviar mensagens (permanente / de usuário do sistema, recomendado).
5. O **App secret** (Configurações do app) e um **Verify token** à sua escolha (uma senha
   qualquer que você inventa e repete nos dois lados).

## 3. Passo a passo

### Passo 1 — Preencher a configuração (Integrações → WhatsApp)

Na seção **Conta Meta (Cloud API)**:
- **Phone number ID**, **WABA ID**, **Business account ID**.
- **App secret** — valida a assinatura do webhook.
- **Access token** — envia as mensagens.
- **Verify token** — o mesmo que você vai colar na Meta.
- **Mensagem para telefone não identificado** — a resposta quando a API de identificação não
  reconhece o número.
- Marque **Canal ativo**.

> Os três segredos são **cifrados**; mostram o selo "✓ configurado" e ficam em branco para manter.

### Passo 2 — Configurar a API de identificação

É a API sua que, **recebendo o telefone**, devolve **quem é o usuário e de qual cliente**.
Na seção **API de identificação**:
- **Endpoint**, **Método**, **Autenticação** (+ credencial, se houver).
- **Parâmetro do telefone** e **onde vai** (query/path/body/header). Ex.: parâmetro `telefone`
  em `query` → o sistema chama `...?telefone=5511988202334`.
- **Mapa da resposta → nossos campos:** para cada campo, informe **o nome do campo na resposta**
  da sua API (use ponto para aninhado, ex.: `dados.matricula`):
  - **Base / cliente** → o campo que identifica o cliente. **Deve ser igual a um `base_code`
    cadastrado** (guia de Integrações).
  - **Usuário, Cód. empresa, Matrícula, Perfil, Portal** → os dados de identidade.
  - **Nome** → para saudação.

Exemplo: se sua API responde
`{ "empresa": "ACME", "matricula": "12345", "nome": "Fábio" }`, o mapa é
`base_code = empresa`, `p_matricula = matricula`, `nome = nome`.

### Passo 3 — Cadastrar o webhook na Meta

1. Copie a **URL do webhook** mostrada no topo da aba (`https://SEU_DOMINIO/api/whatsapp/webhook`).
2. Na Meta (WhatsApp → Configuração → Webhook): cole a **Callback URL** e o **Verify token**
   (o mesmo do Passo 1). A Meta faz um *handshake* — deve dar **verificado**.
3. **Assine o campo `messages`** (Webhook fields).

### Passo 4 — Ligar a base à documentação e às APIs

Para cada cliente (guia de Integrações):
- A **Base** com `base_code` = o que a API de identificação devolve.
- As **Documentações do chatbot** marcadas na base (uma ou **mais**; o WhatsApp precisa de pelo
  menos uma — o RAG usa todas e a 1ª registra a conversa).
- As **APIs/Tools** ativas + um **Agente ativo** vinculando as tools (para consultar dados).

### Passo 5 — Testar

Mande uma mensagem para o número. O bot deve identificar você, responder dúvidas pela
documentação e consultar as APIs quando você pedir um dado.

## 4. Tipos de mensagem que o bot entende

| Tipo | O que acontece |
|---|---|
| **Texto** | Direto para a IA. |
| **Áudio (voz)** | **Transcrito** (Whisper) e tratado como texto. Requer *Transcrição de voz* = OpenAI/Whisper em **Sistema → IA**. |
| **Imagem** | Enviada para a IA **analisar visualmente** (usa a legenda como pergunta, se houver). Requer modelo com **visão**. |
| **Arquivo** | Texto **extraído** (PDF, DOCX, XLSX, PPTX, HTML, MD…) e usado como dado na resposta. |
| **Vídeo** | Usa a **legenda**; a IA avisa que não analisa o conteúdo do vídeo (peça foto/áudio/descrição). |
| **Localização** | Latitude/longitude/nome/endereço entram como **contexto** para a IA. |
| Outros (sticker, contato…) | Resposta educada pedindo um dos formatos acima. |

**Arquivos que a IA envia:** quando uma API retorna um documento em **base64** (holerite, recibo,
boleto…), o bot **envia o arquivo como documento** no WhatsApp, além da resposta em texto —
automático, sem configuração (ver o guia de [Integrações](integracoes-agentes-ia.md), seção 5.1).

## 5. Como funciona por dentro (robustez)

- **Assinatura** `X‑Hub‑Signature‑256` validada em todo `POST` (HMAC com o App secret).
- Responde **200 na hora** e processa em segundo plano (o LLM pode demorar).
- **Deduplicação:** a Meta reenvia eventos; cada mensagem é processada **uma vez**.
- **Rate‑limit** por remetente (barra loops/abuso).
- **Cache** telefone→identidade (5 min) — não chama a API de identificação a cada mensagem.
- **Ontologia:** o glossário do domínio (termos + sinônimos) entra no contexto para o modelo
  entender gírias/sinônimos e acertar as APIs e os parâmetros.
- **Histórico:** as conversas ficam em **/admin/conversas** (sessão = telefone); o consumo de IA
  é atribuído ao usuário.

## 6. Segurança e LGPD

- Tokens/segredos **cifrados**, só o servidor lê.
- **Identidade sempre da API de identificação** (servidor), nunca do texto do usuário → sem
  vazamento entre clientes.
- Telefone é **dado pessoal**: aparece **mascarado** nos logs (só os 4 últimos dígitos).
- Respostas a mensagens do usuário ficam dentro da **janela de 24h** da Meta (texto livre) —
  não é preciso *template*.

## 7. Solução de problemas

| Sintoma | Provável causa |
|---|---|
| Webhook não verifica | **Verify token** diferente entre Meta e a tela; ou **Canal ativo** desmarcado. |
| Recebe mas não responde | Assine o campo **`messages`**; confira o **Access token** e o **Phone number ID**. |
| "invalid signature" | **App secret** errado. |
| Sempre "não identificado" | A API de identificação não devolve o **base_code**, ou o **mapa** aponta o campo errado, ou não existe base com aquele `base_code`. |
| "atendimento não configurado" | A base não tem nenhuma **Documentação do chatbot** marcada. |
| Áudio não transcreve | Configure *Transcrição de voz* = OpenAI/Whisper em **Sistema → IA**. |
| Imagem não é analisada | O modelo de chat precisa ter **visão**. |
| Não consulta dados | Falta **API ativa na base** + **agente ativo** com a tool (guia de Integrações). |
