# Estado do projeto e próximos passos

> Gravado em 16/08/2026, antes de um reinício do VSCode. Contém o que foi feito, o que
> está em curso, e o que depende de decisão sua. Leia a Parte 2 primeiro — é a tarefa
> aberta.

## AO VOLTAR, FAÇA ISTO PRIMEIRO

1. `git pull`
2. **Reiniciar o worker** (`npm run worker`) — ele estava rodando código velho e é por
   isso que a ingestão do APEX vinha achando zero colunas.
3. Subir o `f200.json` na página de Ontologia → processar. Confirmar no job:
   `componentes` deve dar ~10.694 (não 1.568) e `colunas` ~2.481 (não 0).
4. Retomar a Parte 2 — faltam as **cinco decisões** e três dos seis leitores do mapa.

---

## PARTE 1 — O que já está entregue

### Redesenho de UX do admin (fases 0 → 4a)

Plano completo em `~/.claude/plans/glistening-splashing-ritchie.md`. Entregue e no `main`:

- Catraca de UI na CI (`scripts/verificar-ui.mjs` + baseline versionado) — falha se
  qualquer contador de dívida subir.
- Escala tipográfica fiada (`fontSize` com tupla no `tailwind.config.ts`; sem a tupla o
  `line-height: 1.7` do `body` vazava para ~1.200 lugares).
- `Skeleton` · `error.tsx` · `loading.tsx` · `not-found.tsx` · `global-error.tsx` nas 31
  rotas. Antes não havia **nenhum** — erro não capturado mostrava a tela crua do Next.
- `Button loading`, `Tabs` com estado na URL, `Sheet`, `Stepper`, `Checkbox`, `Spinner`,
  `PageShell`, `SemPermissao` (nomeia a permissão que falta e o papel que a concede).
- Mapa de rotas único (`src/lib/admin/mapa-rotas.ts`) alimentando menu, breadcrumb e
  Cmd+K, **com teste que exige um `page.tsx` real para cada `href`**.
- Sidebar de 18 → 8 itens com RBAC (esconde, não desabilita), seletor de documentação no
  chrome, drawer mobile, Cmd+K alcançando telas e abas, gaveta de Atividade sobre 10
  filas de job, `search_logs` por origem e por intenção.

### Ingestão de dicionário e conexão de banco (rodada recente)

- Conexão do worker consertada: o host `db.<ref>.supabase.co` é **IPv6-only**; passou a
  usar o Session pooler (`aws-1-sa-east-1.pooler.supabase.com:5432`, prefixo `aws-1`, não
  `aws-0`), usuário `postgres.<ref>`, senha percent-encoded — e `parseDbConfig` passou a
  decodificar (antes só funcionava pelo caminho que o `pg` decodifica sozinho).
- As **quatro** ingestões da página de ontologia passam pelo Storage acima de 1 MB
  (`use-entrada-grande.ts`). Antes o `f200.json` de 22 MB estourava o corpo da Server Action.
- Importador de dicionário aceita CSV **e** JSON, despachando pelo conteúdo e não pela
  extensão (`src/lib/apex/dicionario-csv.ts`).
- Ingestão do APEX recuperada: havia dois formatos (`pkg_apex_meta` minúsculo × dump das
  views MAIÚSCULO). `pages` existe nos dois, então o normalizador casava 281 registros e
  lia todos os campos vazios — job terminava `done` com zero achados
  (`src/lib/apex/dump-views.ts`).
- Barra de progresso que sumia antes do job acabar (`use-acompanhar-jobs.ts`).
- **Lazy loading do dicionário**: as 78.126 colunas viajavam no HTML inicial e a página
  não abria. Agora `listDicPagina()` devolve 100 por vez com busca no SQL. Medido: 100
  linhas em 92 ms; `centro cod` → 118 resultados.
- **Ingestão do APEX gravava a tabela dentro do nome da coluna** (`f203c73`) — ver Parte 2,
  "Os rótulos". Traz 2.481 colunas, 1.163 com tabela e 1.921 com rótulo, onde antes eram
  zero. **Exige reiniciar o worker e reprocessar.**

Portões atuais: `tsc` limpo · 1836 testes · lint 0 erros · build passa · catraca estável.

---

## PARTE 2 — TAREFA ABERTA: o chat não pode dizer nome de tabela nem de campo

### A regra que você deu

> O chat do agente **nunca** pode mencionar a tabela e o nome do campo. Só pode se
> estiver na aplicação de **Carga de Dados**.

### O mapa do vazamento (levantado por seis leitores; três concluíram antes do reinício)

Bruto e sem truncar em `docs/_leak-map-bruto.json` (37 portas alegadas). As confirmadas:

#### A. Caminho do DADO (ferramentas ORDS) — o volume

| Onde | O quê |
|---|---|
| `src/lib/integrations/executor.ts:294` | `JSON.parse` do corpo ORDS. As chaves são as colunas do `SELECT`, em MAIÚSCULA. **Não existe renomeação em ponto nenhum.** |
| `src/lib/integrations/tool-builder.ts:882-904` | Seis transformações (dedup, filtro, redação de credencial, limpeza de HTML). Todas filtram LINHAS e mascaram VALORES; nenhuma renomeia CHAVE. |
| `src/lib/chat/datasets.ts:331` | `injetarDatasetComRelato` fatia a amostra do objeto **original** — as chaves ORDS vão inteiras ao modelo. |
| `src/lib/chat/datasets.ts:325` | `_colunas`: um array com **até 150 nomes de coluna literais**, sem valor em volta. A forma mais concentrada do vazamento. |
| `src/lib/chat/query-tools.ts:88` | As 8 tools de análise devolvem `colunas` ao modelo — e o modelo **precisa citar o nome** para chamá-las (`coluna: z.string()`). |
| `src/lib/chat/datasets.ts:646` | Quando o modelo erra o nome, o servidor responde `"Colunas reais: …"` com 14 nomes. É o caso mais provável de virar resposta literal. |
| `src/lib/chat/report-tools.ts:565` | **Cabeçalho do PDF/XLSX gerado.** Sem modelo no meio: o usuário abre a planilha e lê `COD_FILIAL`. |
| `src/lib/integrations/tool-builder.ts:710` | Nome do parâmetro no schema da tool (`P_COD_CANDIDATO`) — entra no prompt e na `tool_call`. |

**O gargalo único:** toda tool de integração passa por `injetarDatasetComRelato`
(`tool-builder.ts:1057`), nas três rotas de chat. Traduzir/suprimir ali cobre o volume
inteiro, numa função pura já testada.

#### B. Caminho da DOCUMENTAÇÃO (RAG) — o mais difícil

| Onde | O quê |
|---|---|
| `src/lib/apex/docs.ts:53` | **O produto gera o vazamento.** `gerarDocsPagina` pede à IA um artigo `"tecnico"` com "os itens e a COLUNA do banco de cada um, as regiões e suas consultas SQL". `docs-run.ts:46` o cria na árvore como `<página> — Documentação técnica`. |
| `src/lib/ai/rag.ts:425` | O chat do **admin** usa `getEffectiveTreeAdmin`, que não filtra status: o artigo técnico é alcançável **como rascunho**. No público, só publicado. Hoje a única barreira é o ato de publicar. |
| `src/lib/ai/rag.ts:487` | `buildContextBlock` concatena o `content` do chunk literalmente. Zero saneamento. |
| `public/widget.js:7738` | **Cartão de citação.** Mostra `title` e `heading_path` sem passar pelo modelo: `[3] Página 10 — Documentação técnica` / `P10_COD_CCUSTO > Origem`. Nenhuma regra de prompt alcança isso. |
| `src/lib/ai/rag.ts:374` | Nome do arquivo vira título da fonte: `DICIONARIO_TB_FERIAS.xlsx`. |
| `src/app/api/v1/search/route.ts:53` | API pública devolve `snippet` e `heading_path` crus. |
| `src/lib/ai/prompt-cascade.ts:44` | As REGRAS_ABSOLUTAS mandam "cite o ARTIGO PELO NOME" — empurram o modelo a pronunciar "Documentação técnica". |
| `supabase/migrations/20260805130000…:45` | `hybrid_search_scoped` só filtra escopo. A tabela `chunks` **não tem coluna de tipo** — não há como excluir "conteúdo técnico" da recuperação hoje. |

#### C. Contexto da TELA

- `public/widget.js:206` — o rótulo de um campo vem de `label`/`aria-label`, com fallback
  `el.name || el.id`. **Sem label, o identificador técnico do item APEX vira o "rótulo".**

#### D. Glossário da ontologia

- `src/lib/data-dictionary/ontology-feed.ts:30` — a ingestão grava a **label como termo
  canônico e a `db_column` como alias**. Depois `glossarioCasado`
  (`src/lib/ai/ontology.ts:261`) imprime `canônico (sinônimos)` no prompt — reintroduzindo
  o nome técnico. *Melhor caso de todos:* basta não imprimir os aliases que parecem
  identificador; o casamento da consulta continua funcionando.

### A regra que JÁ EXISTE e não cobre o caso

`src/lib/chat/regras-nucleo.ts:44` — `regraRotulosColuna` já diz literalmente o que você
quer ("NUNCA pela chave técnica do JSON/banco"). Três buracos:

1. O escopo declarado é "de ferramenta, da tela ou de arquivo" — **documentação ficou de fora**.
2. Só entra no prompt quando há ferramentas (`route.ts:1899`: `temTools ? [...]`).
3. O chat do **portal** não a usa.

### Dá para saber se o usuário está na "Carga de Dados"? **Dá — hoje.**

- `body.page = {href, path, title}` é enviado **sempre** (`public/widget.js:7339`).
- O `href` do APEX carrega `f?p=<APP_ID>:<PAGE_ID>:<SESSION>`. **O app id já chega ao
  servidor**, só não é lido. É gravado inteiro em `conversations.page`.
- `title` é o `document.title` — no APEX, o nome da aplicação/página.
- `apexInfo()` (`widget.js:646`) já lê `APP_ID`/`PAGE_ID` do runtime do APEX, mas só
  manda para `/api/v1/report-data` — **não** para `/chat`.
- O que **não** serve: `p_base` (é o cliente), `p_portal` (é o painel PO/PG/PC),
  `ai_bases.widget_paineis` (por painel), `Origin` (todas as apps do mesmo ORDS
  compartilham a origem).

**Recomendação:** ligar o `apexInfo()` ao `/chat` e casar por **app id**, que é exato e
estável. Casar por `document.title` funcionaria sem mexer no widget, mas quebra se alguém
renomear a aplicação.

### Os rótulos: por que não existiam, e como recuperá-los  ✔ RESOLVIDO no código

Estado do banco quando a pergunta apareceu:

```
data_dictionary  kind=column  source=db_ddl   78.126 linhas
                 com db_table  78.126
                 com label          0     ← zero
ontology_terms                  2.240 termos, 0 vindos do dicionário
```

O CSV de `ALL_TAB_COLUMNS` só traz `TABLE_NAME, COLUMN_NAME, DATA_TYPE`. E os rótulos do
APEX nunca chegaram — **não foram apagados**: os dois `delete` são escopados por `source`
(`ingest-run.ts:44` apaga só `apex_dict` do mesmo app; `dbobjects/run.ts:31` só `db_ddl`).

Três causas, investigadas e corrigidas (commit `f203c73`):

1. **O worker rodava código velho.** O job das 12:48 gravou `componentes: 1568`, que é
   exatamente 1 app + 281 páginas + 1.286 regiões — sem itens nem colunas de relatório.
   Com o código atual esse número é 10.694. O conserto do dump das views entrou 12:30 e o
   worker não foi reiniciado.
2. **`dump-views.ts` juntava tabela e coluna numa string** `"TABELA.COLUNA"` esperando que
   a IA a partisse lendo o SQL da região. Sem resolução, o fallback gravava
   `db_table: null` e a string inteira em `db_column`. Agora a entrada é partida no último
   ponto — `database_items` já afirma as duas coisas, não precisa de IA.
3. **O portão `ehColuna(sourceType)` descartava os itens de banco.** Eu gravara
   `source_type: null`, e o `page_items` declara `"Always Null"`/`"SQL Query"` mesmo para
   itens que a view de banco lista com tabela e coluna. Estar em `database_items` é a
   prova; passou a valer isso.

Medido no `f200.json` real, com a IA desligada:

| | antes | depois |
|---|---|---|
| colunas | 0 | 2.481 |
| com tabela | 0 | 1.163 *(44 tabelas distintas)* |
| com rótulo | 0 | 1.921 |
| tabela **e** rótulo | 0 | **727** |

**Consequência para o desenho:** a tradução `COD_FILIAL → "Filial"` passa a ser possível
para os 727 pares — uma fatia do ERP, não ele todo. Para o resto continua valendo
**supressão**, porque não há rótulo para pôr no lugar. Cobertura maior exige subir o
metadado das outras aplicações APEX além da 200.

> **AÇÃO PENDENTE, na ordem:** `git pull` → **reiniciar o worker** (foi o passo que faltou)
> → subir o `f200.json` e processar. O arquivo já está no Storage (cinco cópias de 21,8 MB
> em `imports/a5e69064-…/apex-*-f200.json`), mas o fluxo da tela é upload → processar.
> A ingestão apaga só as linhas `apex_dict` do mesmo app: não duplica e não encosta nas
> 78.126 do CSV. As duas fontes convivem — o CSV dá cobertura, o APEX dá os rótulos.

### Decisões que dependem de você

1. **Como identificar a Carga de Dados** — app id do APEX (preciso do número), ou pelo
   título da aplicação? Se app id: eu ligo `apexInfo()` ao `/chat`.
2. **É a aplicação inteira ou algumas páginas dela?**
3. **O que o chat responde quando precisaria nomear a coluna e não pode** — usa o rótulo
   da tela, descreve ("o campo de centro de custo"), ou diz que não pode informar?
4. **O artigo "Documentação técnica" gerado pelo produto** — paro de gerá-lo, gero em
   espaço separado, ou marco como fora do escopo do chatbot? (Hoje o gêmeo "usuário",
   por rótulo, já é gerado no mesmo passe — `docs.ts:51`.)
5. **Vale para o PDF/XLSX gerado também?** Lá não há modelo no meio: o cabeçalho é a
   coluna crua e só sai limpo com tradução ou com rótulo vindo da tela.

### Plano de execução proposto (depois das respostas)

| # | O quê | Por quê primeiro |
|---|---|---|
| 1 | `regraRotulosColuna` sai de trás do gate `temTools`, ganha a documentação no escopo e passa a valer no portal | Uma linha de escopo, cobre as três rotas, reversível |
| 2 | Suprimir `_colunas` e as mensagens `"Colunas reais: …"` do que vai ao modelo | É o vazamento mais concentrado e não tem função para o usuário |
| 3 | `glossarioCasado` deixa de imprimir aliases que parecem identificador técnico | O casamento da consulta não depende de imprimir |
| 4 | Detecção da app + portão: fora da Carga de Dados, a supressão vale; dentro, não | Depende da decisão 1 |
| 5 | Camada de tradução em `injetarDatasetComRelato` (gargalo único) | Já há 727 pares tabela+rótulo depois de reprocessar o APEX; o que não tiver rótulo cai na supressão |
| 6 | Cartão de citação e cabeçalho de PDF/XLSX | Não passam pelo modelo — exigem tradução de verdade |
| 7 | Marcar conteúdo técnico fora do escopo do chatbot | Exige coluna de tipo em `chunks` (migration) |

**Regra de desenho que atravessa tudo:** as ferramentas *precisam* dos nomes de coluna
para funcionar. O corte não pode ser "o modelo não vê" — tem de ser "o modelo não
repete". Exceto nos três pontos onde não há modelo no meio (cartão de citação, cabeçalho
de arquivo, API de busca), que exigem tradução real.

### Como retomar o levantamento

O workflow foi interrompido com 3 de 6 leitores concluídos. Faltaram: **prompt** (blocos
do system prompt), **tela** (widget/formAssist) e **dicionário** (ontologia no chat), mais
as fases de refutação e síntese.

```
Script: ~/.claude/projects/-Users-igor-sala-…/workflows/scripts/mapear-vazamento-schema-no-chat-wf_9f16c2e9-308.js
Run ID: wf_9f16c2e9-308   (resume é só na mesma sessão — depois do reinício, re-executar)
```

---

## PARTE 3 — Dívidas pendentes, fora desta tarefa

### Segurança — sua execução, não minha

O repositório `igorsala7/natcorp-base-conhecimento` é **público** e o `.env` está
versionado por decisão sua (commit `df9937b`). Estão expostos: `SUPABASE_SERVICE_ROLE_KEY`,
`APP_ENCRYPTION_KEY`, `PORTAL_COOKIE_SECRET`, token do Upstash e a senha do banco. As
chaves S3 que você colou no chat também precisam ser revogadas.

Ordem de rotação: `service_role` → senha do banco → `APP_ENCRYPTION_KEY` **só depois** de
rodar `scripts/rekey-secrets.ts` → `PORTAL_COOKIE_SECRET`.

### Outras

- `scripts/testar-endpoints.ts` segue **fora do git** de propósito (contém matrículas
  reais e imprime tokens vivos). Três saídas em aberto: gitignore · higienizar · commitar.
- `ai_tools.params`: parâmetros de data cadastrados como texto, então o motor não
  converte para `DD/MM/YYYY`.
- Lado ORDS de vocês: `sesmt_procedimentos` e `usuarios_usuarios_fotos_2` (555), três
  403s, sete timeouts na STEFANINI, `bi_medicina` (ORA-00980), `resultado_apuracao_ponto`
  (ORA-06502).
- Fases 5/7/8 do redesenho: convite em `Sheet` com escopo obrigatório · editor de tool
  (modal de 57 estados → `Sheet` em 3 etapas + botão Testar) · portão de aceite no
  Construtor IA e no Estúdio · `Stepper` dos jobs · editor (despublicar sai do primário,
  6 caminhos de IA viram 1).
- O portal ainda registra busca por tecla.
- Disco da sua máquina em ~99% (425 GB de 460 GB).
