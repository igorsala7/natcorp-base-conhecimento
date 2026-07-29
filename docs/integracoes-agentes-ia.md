# Integrações de IA — Agentes que consultam suas APIs

Guia completo de como configurar o chatbot para **consultar dados reais** de sistemas
externos (ERP, RH, financeiro…) via APIs, com a IA escolhendo sozinha qual API usar e
quais parâmetros passar.

> **Onde fica:** menu **Integrações** (`/admin/integracoes`). Exige um papel **global**
> com a permissão `integrations.manage` (Admin técnico, nível 80+).

---

## 1. Como funciona (visão geral)

```
Pergunta do usuário
  → a IA lê a DESCRIÇÃO das APIs disponíveis e decide qual usar
  → o sistema injeta a IDENTIDADE (do token/telefone) e as CREDENCIAIS no servidor
  → chama a API, lê o retorno
  → a IA interpreta e responde (podendo encadear várias chamadas)
```

Regra de ouro de segurança: **a identidade do usuário (matrícula, empresa…) NUNCA vem do
modelo** — ela é injetada pelo servidor a partir do token cifrado (widget) ou da API de
identificação (WhatsApp). O modelo só preenche os parâmetros de *consulta* (datas, filtros).

## 2. Conceitos

| Conceito | O que é |
|---|---|
| **Base / Cliente** | Um cliente/empresa. Chaveada por um **`base_code`** (= o `p_base` que o token do cliente envia). Guarda credenciais e quais APIs estão ativas. |
| **Credencial** | Como autenticar nas APIs daquele cliente: OAuth 2.0, Basic, API key, Bearer. Guardada **cifrada**. |
| **API / Tool** | Uma API do catálogo (endpoint, método, parâmetros, descrição). Global; a URL e a credencial são por base. |
| **Parâmetro** | Cada campo da API. Tem **tipo** (texto/número/data/…), **origem** e, para datas, **máscara**. |
| **Origem do parâmetro** | `identidade` (injetado do token/login — seguro), `modelo` (a IA extrai da conversa), `fixo` (constante), `credencial` (um campo do segredo da credencial, ex.: `session_key` — nunca do modelo). |
| **Envelope do corpo** (`body_mode`) | Para POST: `object` (padrão, `{...}`), `array` (`[{...}]`) ou `wrap:<chave>` (`{<chave>:[{...}]}`) — algumas APIs ORDS exigem o corpo embrulhado. |
| **Guard** (`ai_tools.guard`) | Uma checagem no SERVIDOR rodada ANTES da chamada, que pode recusar: `team_membership` (gestor só consulta a própria equipe), `saque_confirmation` (só efetiva com código de confirmação válido). Falha fechada. |
| **Agente** | Especialista num módulo: tem seu **modelo de IA**, suas **APIs/Tools**, opcional **agente‑pai** e um opcional **`requires_perfil`** (ex.: `gestor`). Os agentes **curam** quais APIs a IA pode usar; um agente com `requires_perfil` só é exposto quando o **perfil resolvido no login** confere (trava no servidor). |

## 3. Pré‑requisitos

1. **Permissão** `integrations.manage` (Admin técnico ou Owner).
2. **`APP_ENCRYPTION_KEY`** definida no ambiente (≥16 caracteres). Sem ela, as credenciais
   são gravadas em texto simples (a tela avisa). Defina e salve de novo para cifrar.
3. Pelo menos **um provedor de IA** configurado em **Sistema → IA** (para o modelo do agente).

---

## 4. Passo a passo

### Passo 1 — Cadastrar a Base (cliente)

1. **Integrações → aba Bases / Clientes → Nova base**.
2. Preencha:
   - **Código da base (p_base):** exatamente o valor que o token do cliente envia em `p_base`
     (ex.: `ACME`). É a chave que liga a requisição ao cliente.
   - **Nome do cliente:** rótulo amigável (ex.: `Acme S/A`).
   - **Documentações do chatbot:** uma ou **mais** bases de conhecimento que o bot usa (RAG).
     Marque quantas quiser; a **1ª marcada** é onde as conversas do WhatsApp são registradas.
     *Pelo menos uma é obrigatória para o WhatsApp.*
3. **Salvar.**

### Passo 2 — Cadastrar a credencial da base

1. Expanda a base → seção **Credenciais → Nova credencial**.
2. Escolha o **tipo de autenticação** e preencha os campos que aparecem:
   - **OAuth 2.0 (client credentials):** `URL do token`, `Client ID`, `Client Secret`, `Scope` (opcional).
   - **Bearer token:** `Token`.
   - **API key:** `API key` + `Nome do header` (padrão `Authorization`).
   - **Basic:** `Usuário` + `Senha`.
3. **Salvar.** Aparece o selo **Configurada**. Os segredos ficam **cifrados** e nunca são
   devolvidos à tela — para trocar, basta digitar de novo (em branco = manter).

> Normalmente **uma credencial por base** (o mesmo OAuth serve as APIs do cliente). Mas você
> pode ter várias e escolher qual cada API usa.

### Passo 3 — Cadastrar a API/Tool no catálogo

1. **Aba APIs / Tools → Nova API/Tool.**
2. Preencha:
   - **Chave:** identificador único (minúsculas, números, `_`) — ex.: `consultar_ferias`.
   - **Nome:** ex.: `Consultar férias`.
   - **Descrição:** *o texto que a IA lê para decidir usar esta API.* Capriche — é o que faz
     o roteamento acertar. Ex.: *"Datas de férias de um colaborador num período."*
   - **Método** e **Caminho** (relativo à `base_url`): use `{nome}` para parâmetros de caminho.
     Ex.: `GET` + `/ferias/{matricula}`.
   - **Autenticação:** o tipo (deve casar com a credencial da base).
3. **Parâmetros** (`+ Parâmetro`), para cada um:
   - **Nome** (na API) e **Tipo** (texto/número/data/lista/booleano).
   - **Origem:**
     - `Identidade (token)` → escolha qual campo do token injetar (`matrícula`, `cód. empresa`,
       `usuário`, `perfil`, `portal`). **Nunca vem do modelo.**
     - `IA extrai da conversa` → informe a **descrição** para o modelo saber o que preencher.
     - `Valor fixo` → informe a constante.
   - **Local:** onde entra na requisição (query, path, body, header).
   - **Data:** informe a **máscara** exigida pela API (`dd/MM/yyyy`, `MM/yyyy`, `dd/mm/rrrr`…).
     A IA sempre entrega a data em ISO; o sistema formata para a máscara.
   - **Obrigatório:** marque se a API exige.
4. **Dica de resposta** (opcional): como a IA deve resumir/interpretar o retorno.
5. **Salvar.**

### Passo 4 — Ativar a API para a base

1. Volte à **aba Bases**, expanda a base → seção **APIs / Tools**.
2. Clique no ícone de editar da API → **Configurar para esta base**:
   - **Ativa para esta base.**
   - **Endpoint (base_url):** o endereço-base daquela API para **este cliente**
     (ex.: `https://api.acme.com/v1`).
   - **Credencial:** qual credencial da base usar.
3. **Salvar.** A badge muda para **Ativa**. *Sem essa linha, a API não existe para a base.*

### Passo 5 — Criar o Agente

1. **Aba Agentes → Novo agente.**
2. Preencha:
   - **Chave** e **Nome** (ex.: `agente_rh`, "Agente de RH").
   - **Descrição:** quando usar este agente (o roteador usa isto).
   - **Provedor de IA / Modelo:** o modelo deste agente (vazio = usa a IA padrão de chat).
     Ex.: um modelo forte em *tool calling* para raciocínio + várias APIs.
   - **Prompt do sistema** (opcional): instruções específicas do agente.
   - **APIs / Tools deste agente:** marque as tools que ele pode usar.
   - **Agente‑pai** (opcional): hierarquia orquestrador → especialista.
   - **Prioridade** e **Permissão exigida** (opcional).
3. **Salvar.**

> **Curadoria:** no chat, a IA só recebe as APIs que estão **habilitadas na base** *e*
> **vinculadas a um agente ativo**. Se não houver nenhum agente ativo, todas as APIs
> habilitadas da base ficam disponíveis (para você começar antes de criar agentes).

---

## 5. Como o chat usa isso

- **Widget/portal:** o token cifrado traz o `p_base` (e a identidade). O sistema resolve a base,
  monta as tools dos agentes e a IA responde consultando as APIs quando necessário. O consumo
  de IA é atribuído ao **usuário** (Sistema → IA → Consumo).
- **WhatsApp:** ver o guia [whatsapp-canal.md](whatsapp-canal.md).

A IA decide sozinha entre **responder pela documentação** (RAG) e **consultar uma API**. Para
pedidos de dado específico, ela chama a API; para dúvidas de "como fazer", usa a documentação.
Ela pode **encadear** chamadas (ex.: buscar a matrícula pelo nome e depois consultar as férias).

## 5.1 APIs que retornam arquivo (base64)

Algumas APIs devolvem um documento embutido no JSON em **base64** (holerite, recibo, boleto…):

```json
{ "status": "OK", "filename": "RECIBO.pdf", "charset": "base64",
  "mimetype": "application/pdf", "documento": "JVBERi0xLjQK..." }
```

O sistema **detecta isso automaticamente** (em qualquer profundidade do JSON), **remove o base64**
do que vai para a IA (economiza tokens — o modelo não faz nada com bytes) e **entrega o arquivo**:

- **WhatsApp:** enviado como **documento** — o usuário recebe o PDF direto no chat.
- **Widget e portal ("Perguntar à IA"):** vira um **link de download** (📎) na conversa.

**Não precisa configurar nada:** basta a API retornar um campo de MIME (`mimetype`), um nome
(`filename`) e o conteúdo base64 (campo `documento`/`arquivo`/`file`/… ou `charset: "base64"`).
A IA apenas confirma o envio (ex.: *"segue seu holerite de março 📄"*).

## 5.2 Ontologia — assertividade máxima

Todo o fluxo — RAG, **escolha da API/Tool** e **extração dos parâmetros** — usa a **ontologia** da
documentação (Admin → **Ontologia**): os termos canônicos e seus sinônimos entram no contexto da
IA como um **glossário**. Assim, quando o usuário usa uma gíria ou sinônimo (ex.: *"contracheque"*
em vez de *"holerite"*), o modelo entende o conceito e acerta a ferramenta e os valores.

Vale nos **quatro fluxos**: **widget**, **portal**, **WhatsApp** e a **busca** (RAG) — sem
configuração extra além de manter a ontologia da documentação atualizada.

## 5.3 Resolução de identidade no servidor (login)

Algumas APIs precisam de dados que **não vêm no token** (ex.: o **CPF**) e exigem **validar** o
usuário antes de liberar dados. Para isso, o módulo faz um "login" no servidor **quando a
credencial da base tem uma `session_key`** (campo opcional da credencial OAuth):

1. **Valida** o usuário em `…/chatbot/login/v1/autenticacao` (empresa+matrícula+usuário da
   identidade). Se a API não reconhecer (status ≠ OK), **as ferramentas de dados não são
   oferecidas** — a IA responde só pela documentação e orienta procurar o RH.
2. **Enriquece** a identidade com `…/chatbot/login/v1/dados_colab_usuario`: **CPF**, **perfil**
   (gestor/colaborador), nome e cargo. Esses campos passam a estar disponíveis como **identidade**
   (`origem = identidade`, ex.: `campoIdentidade = cpf`) — injetados no servidor, **nunca** pelo
   modelo.

O resultado é cacheado por usuário (poucos minutos). É assim que a NATCORP entrega os documentos de
assinatura eletrônica: o `docs_user` recebe o CPF pela identidade, sem que a IA precise perguntá-lo
nem encadear chamadas. O perfil (gestor) resolvido aqui também é a base para, no futuro, liberar as
ferramentas de gestor. *A `session_key` é específica do padrão ORDS/APEX; bases que não a definem
seguem usando apenas a identidade do token.*

## 6. Exemplo completo — "quero as férias de agosto"

1. **Base** `ACME` com credencial OAuth.
2. **API** `consultar_ferias` (`GET /ferias/{matricula}`), parâmetros:
   - `matricula` — origem *identidade → matrícula*, local *path*.
   - `data_ini` — tipo *data*, origem *modelo*, local *query*, máscara `dd/MM/yyyy`.
   - `data_fim` — igual.
3. **Ativada** na base `ACME` com `base_url` e credencial.
4. **Agente** "RH" com essa tool, ativo.
5. Usuário pergunta *"quando saio de férias em agosto?"* → a IA extrai `2026-08-01`/`2026-08-31`,
   o sistema injeta a matrícula do token, formata as datas e chama
   `GET https://api.acme.com/v1/ferias/12345?data_ini=01/08/2026&data_fim=31/08/2026`, e responde
   com o dado.

## 6.1 Exemplo real: NATCORP (seed reproduzível)

A base **NATCORP** já vem pronta como exemplo — a migração das ferramentas de RH que
antes viviam no n8n. Ela registra, de forma **idempotente**, a base, a credencial OAuth, **16
ferramentas somente‑leitura** (benefícios, férias, ponto, históricos, feedback, assinatura
eletrônica + os relatórios em PDF: recibo de pagamento, informe de rendimentos, aviso de
férias, espelho de ponto) e o agente **"Nati — Assistente de RH"**.

**Como rodar** (`base_code` = `natcorp`):

1. No `.env.local` (não versionado):
   ```
   NATCORP_OAUTH_CLIENT_ID=<client id>
   NATCORP_OAUTH_CLIENT_SECRET=<client secret>
   NATCORP_SESSION_KEY=<chave de sessão do login ORDS>    # habilita validação + CPF/perfil
   NATCORP_SPACE_SLUG=<slug da documentação para o RAG>   # opcional
   ```
2. `npm run seed:natcorp` — cria/atualiza tudo. Reexecutar é seguro (upsert por chave natural).
3. Confira em **/admin/integracoes**: base **natcorp**, credencial **Configurada**, 16 tools
   ativas, agente **nati_rh**. Vincule a documentação do chatbot (aba Bases) se não passou o slug.

O código do catálogo fica em `scripts/natcorp-tools.ts` (uma linha por ferramenta) e a gravação
em `scripts/seed-natcorp.ts`. Para adicionar/ajustar uma ferramenta, edite o catálogo e rode de novo.

**Notas de compatibilidade observadas ao vivo:**
- **OAuth:** o endpoint da NATCORP (Oracle ORDS/APEX) exige **HTTP Basic** na autenticação do
  cliente. O motor tenta primeiro os dados no corpo e **cai para Basic automaticamente** — sem
  configuração. Vale para qualquer provedor ORDS‑like.
- **Datas:** cada relatório usa sua máscara (recibo `01/MM/yyyy`, informe `yyyy`, ponto
  `dd/MM/yyyy`, eventos `MM/yyyy`); a IA entrega ISO e o motor formata.
- **Arquivos:** os relatórios voltam com o PDF em base64 dentro do JSON → **entrega automática**
  como download (widget/portal) ou documento (WhatsApp), sem tocar em nada.
- **Login no servidor (CPF/perfil):** a NATCORP resolve a identidade completa via login ORDS — ver
  a seção **5.3**. Com a `session_key` na credencial, o sistema **valida** o usuário e busca o
  cadastro (**CPF, perfil gestor/colaborador, nome, cargo**) antes das ferramentas. Assim o
  `docs_user` (assinatura eletrônica) recebe o **CPF pela identidade** — sem passar pelo modelo — e
  usuários não reconhecidos ficam sem acesso aos dados.

## 6.2 NATCORP — gestor, escritas e antecipação

Além das consultas do próprio colaborador (6.1), a base NATCORP traz mais três blocos, cada um com
sua trava:

**Gestor (agente `nati_gestor`, `requires_perfil = gestor`).** Só aparece quando o **perfil
resolvido no login** é gestor — a trava é no servidor, o perfil nunca vem do modelo. Inclui a
**estrutura** da organização (empresas, filiais, cargos, centros de custo, funções, locais — para
descobrir códigos), o **BI de histórico financeiro** (8 agrupamentos por empresa/filial/cargo/centro
de custo…), o **BI de riscos/SESMT** (5 agrupamentos), os **alertas** da equipe e a **listagem da
equipe** (`listar_colaboradores_resumo`, já **escopada ao gestor** por `usuario`+`gestor`).

Os **dados completos de um colaborador da equipe** (`dados_colaborador_equipe`) são liberados por um
**guard `team_membership`**: como a API de dados não escopa por gestor, o servidor valida a matrícula
pedida contra a **lista da equipe** (a `colaboradores_resumo`, essa sim escopada) e **recusa** se não
for da equipe — antes de chamar a API.

**Escritas com confirmação (colaborador).** `atualizar_telefone` e `atualizar_email` alteram os
dados do **próprio** colaborador. São `POST` com corpo embrulhado (`body_mode = array`) e a
identidade vai no corpo. A **confirmação é obrigatória**: o agente mostra o novo valor e pede
Sim/Não antes de chamar (instruído no prompt).

**Antecipação salarial.** `antecipacao_saldo`, `antecipacao_regras`, `antecipacao_simular` (com
`simulacao=S` — não movimenta) e `antecipacao_historico` (leitura/simulação). Usam o corpo
`wrap:saque` (`{saque:[{…}]}`) e a `session_key`. A **efetivação do saque** (`antecipacao_efetivar`)
está **ATIVA**, protegida pelo **guard `saque_confirmation`** (gate **fora‑da‑banda**): na 1ª chamada
(sem código) o servidor gera um código, guarda só o **hash** (`ai_pending_confirmations`), envia ao
**e‑mail cadastrado** do usuário (o modelo NUNCA vê o código) e recusa pedindo o código; com o código
correto (não usado, não expirado), efetiva. Assim a IA não move dinheiro sozinha — nem com um "Sim" no
chat. Requer o **e‑mail cadastrado** e o **envio de e‑mail** configurado (Sistema → IA); faça um teste
controlado. O **PIX externo (Asaas)** não é registrado.

**Menus (`lista_opcoes`).** Devolve MENUS prontos (título + opções separadas por `;`) para o usuário
escolher: saudação (`opcao_colaborador`/`opcao_gestor`), confirmações Sim/Não (`confirmar_padrao`) e
submenus de ponto (`ponto_eletronico`), SESMT (`opcao_sesmt`) e antecipação (`antecipacao_salarial`).

> Reaplicar: `npm run seed:natcorp` registra tudo isso (46 ferramentas ativas, agentes `nati_rh` e
> `nati_gestor`). As capacidades acima reusam mecanismos genéricos do módulo (`requires_perfil`, origem
> `credencial`, `body_mode`, `guard`, `local:none`) — servem a qualquer base ORDS‑like.

## 7. Segurança

- **Identidade sempre do servidor** (token/telefone), nunca do modelo → um usuário não consegue
  pedir dados de outra empresa.
- **Credenciais cifradas** (AES‑256‑GCM) em tabela isolada; só o servidor lê.
- **RLS** em todas as tabelas; cadastro exige `integrations.manage`.
- **Auditoria:** toda alteração de base/credencial/tool/agente vai para o log.

## 8. Solução de problemas

| Sintoma | Provável causa |
|---|---|
| A IA não usa a API | Tool não **ativada na base**, ou não **vinculada a um agente ativo**, ou descrição vaga. |
| "Endpoint não configurado" | Faltou a `base_url` na ativação por base. |
| Erro de autenticação | Credencial errada, ou o `auth_type` da tool ≠ o da credencial escolhida. Em OAuth, o motor tenta client_id/secret no corpo e, se recusado, via **HTTP Basic** — então não é preciso escolher o estilo. |
| Data no formato errado | Ajuste a **máscara** do parâmetro de data. |
| Dado de outro usuário | Confira que o parâmetro de identidade está com **origem = identidade** (não *modelo*). |
| Aviso de "texto simples" | Defina `APP_ENCRYPTION_KEY` e salve as credenciais de novo. |
