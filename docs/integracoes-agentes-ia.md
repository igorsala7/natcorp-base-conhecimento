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
| **Origem do parâmetro** | `identidade` (injetado do token — seguro), `modelo` (a IA extrai da conversa), `fixo` (constante). |
| **Agente** | Especialista num módulo: tem seu **modelo de IA**, suas **APIs/Tools** e, opcionalmente, um **agente‑pai** (hierarquia). Os agentes **curam** quais APIs a IA pode usar. |

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
   - **Documentação do chatbot:** a base de conhecimento que o bot usa para responder dúvidas
     (RAG) e onde as conversas do WhatsApp são registradas. *Obrigatória para o WhatsApp.*
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
| Erro de autenticação | Credencial errada, ou o `auth_type` da tool ≠ o da credencial escolhida. |
| Data no formato errado | Ajuste a **máscara** do parâmetro de data. |
| Dado de outro usuário | Confira que o parâmetro de identidade está com **origem = identidade** (não *modelo*). |
| Aviso de "texto simples" | Defina `APP_ENCRYPTION_KEY` e salve as credenciais de novo. |
