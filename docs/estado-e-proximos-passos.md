# Estado do projeto e próximos passos

> **Atualizado em 24/08/2026, 15h, antes de um reinício do notebook.**
> A rodada corrente é a de **assertividade e custo do chat**, aberta pelo guia técnico
> externo de 107 seções. O que está abaixo da linha "HISTÓRICO" é de 16/08 e já foi
> superado — leia como registro, não como tarefa.

## AO VOLTAR, FAÇA ISTO PRIMEIRO

1. **O disco está em 99% (150 MB livres).** Encheu duas vezes durante o trabalho de 24/08,
   e com ele cheio o Bash para de funcionar por inteiro — nem a saída dos comandos grava.
   Limpe antes de qualquer coisa: `~/Library/Caches`, `~/.npm`, e as transcrições em
   `~/.claude/projects/`. O Bloco 2 roda `EXPLAIN ANALYZE` e comparações de RAG; sem
   espaço, não sai do lugar.
2. **Nada foi commitado.** Oito arquivos modificados no disco, todos verdes
   (2.339 testes, typecheck limpo). Ver "O que está no disco" abaixo.
3. O plano aprovado está em `~/.claude/plans/glistening-splashing-ritchie.md`.

---

## RODADA DE 24/08 — guia técnico externo × o que o projeto já é

### O que aconteceu

O dono trouxe um guia de 4.177 linhas e 107 seções propondo uma arquitetura alvo para
este chatbot. Três agentes estudaram o documento inteiro contra o código
(§9–33 ferramentas/RAG, §36–57+66–69 custo/latência, §58–65+70–107 medição/governança).

**Conclusão do estudo:** a maior parte do guia **já está implementada**, e em vários
pontos em versão melhor. O valor esteve em separar o que falta de verdade do que já foi
medido e reprovado.

### O achado que decidiu o plano

Duas medições de frentes diferentes se encaixaram:

- ontem, para **reprovar** uma proposta: alargar o teto do top-K de 12 para 88 é
  **inerte** — 73/97 em todos os valores;
- hoje, a maior despesa do sistema: o bloco `tools` ocupa a **posição 0** do payload e é
  remontado a cada pergunta, dando **5,8% de identidade entre turnos** — o cache
  praticamente nunca casa, e junto com ele caem persona, regras e núcleo.

Se alargar o corte não muda o acerto, alargar para o conjunto do módulo é seguro — e é
isso que estabiliza a posição 0. **~9.451 tokens-equivalentes por turno**, e a inércia
medida é a licença para tentar.

### O que já foi feito e verificado (Bloco 1, item 1)

**A similaridade parou de morrer dentro do funil.** `selecionarTopK` calculava a nota de
cada ferramenta e descartava; agora ela sai no passo `integracoes:ranking` — **incluindo
as cortadas**, que é a metade que carrega o diagnóstico.

Por que importa: "o agente escolheu a ferramenta errada" é um fato sem conserto. A certa
em 2º pede desempate; a certa em 40º pede embedding. São remédios opostos, e o trace não
distinguia os dois casos.

Uma decisão que a medição mudou no meio do trabalho: o ranking estava pendurado no
`onSelecao`, que já existia — mas ele só é chamado num dos **três** caminhos de saída, e o
multi-faceta são **15% do tráfego**, justamente a pergunta de várias intenções. O cálculo
foi movido para **antes de qualquer bifurcação**. Há teste que prova que o multi-faceta
realmente não reporta seleção.

**Cobertura de nota no trace: 4% → 85%.** Antes só gravava quando a seleção era fraca — e
o erro que mais interessa acontece no turno *saudável*, com topo alto e a certa atrás da
errada.

**A cadeia fechou até o rótulo humano.** `ai_tool_casos.cortadas` existe desde 17/08, com
o comentário do esquema descrevendo exatamente este uso, e estava vazia sete dias porque a
nota não chegava. Agora `oferecidas` leva `{tool, sim, pos}` e `cortadas` recebe quem
ficou de fora.

**Provas:** 2.339 testes passando · typecheck limpo · e a saída de `npm run eval:tools`
**byte a byte idêntica** antes e depois (stash → roda → pop → `diff`), que é o que
demonstra que a instrumentação não toca a seleção.

### O que está no disco, não commitado

| arquivo | o quê |
|---|---|
| `src/lib/integrations/tool-narrow.ts` | `RankingSelecao`, `rankingDe`, `onRanking` antes da bifurcação, `TOP_RANKING=20` |
| `src/lib/integrations/tool-builder.ts` | coleta em `diag.ranking`, emite o passo `integracoes:ranking` |
| `src/lib/chat/caso-treino.ts` | preenche `oferecidas` com `{tool,sim,pos}` e `cortadas` |
| `scripts/carregar-casos-rotulados.ts` | **só comentário** — por que os 138 históricos ficam com `sim: null` para sempre |
| `*.test.ts` (2 arquivos) | 5 testes novos, inclusive o do caminho multi-faceta |
| `package.json` · `package-lock.json` | **NÃO são meus** — `@tanstack/ai*`, origem não confirmada. Commit seletivo. |

### A armadilha que ficou documentada, e não "consertada"

Os 138 casos do gabarito continuam com `sim: null`, **e isso é permanente**. Recomputar
hoje é tentador — `eval-tools.ts` faz e imprime *"ficou em 23º de 88"*. Mas os dois
números afirmam coisas diferentes: no eval a pergunta é "como o funil de HOJE se sai?", e
recomputar é o método certo; na linha do caso a afirmação é "foi isto que aconteceu
naquele turno" — e 106 dos 138 têm mais de 5 dias, com catálogo e embeddings mudados no
meio. Seria hindsight com cara de registro. O motivo está escrito no próprio arquivo.

### O que vem a seguir, na ordem

**Bloco 1 — instrumento (0 tok, 0 ms, destrava o resto). COMPLETO em 24/08.**

1. ✅ Ranking das ferramentas no trace (`integracoes:ranking`), com as cortadas.
2. ✅ **`turn_id` em `ai_chat_traces`.** Liga O QUE o turno fez a QUANTO custou.
   Backfill 1:1 de 828 turnos por texto da pergunta — ver a armadilha na migration
   `20260824153000`. Já responde: turno com fonte `ia` custa **75.566 tokens** (7,1
   chamadas de IA), contra 20.494 do `relatorio`.
3. ✅ **`ai_eval_runs` / `ai_eval_results`** + `npm run eval:comparar`. A rodada guarda
   `git_sha`, `git_sujo`, flags e o **checksum do gabarito** — a guarda que impede
   comparar placares medidos com réguas diferentes. O comparador mostra quais casos
   viraram para cada lado e grita `CHURN` quando o saldo é pequeno e a troca é grande.
4. ✅ **`npm run perf:latencia`** — p50/p90/p95/p99, série por dia e **tempo por passo**.

**O que o item 4 revelou logo de cara** (e não estava no plano): `dataset:registro`
aparecia com **30,4% do tempo bloqueante**, p50 de 4,8s. Não era custo dele — era a
geração do modelo escorrendo para o passo seguinte, porque nada era registrado quando o
`streamText` terminava. Corrigido com um `onFinish` que fecha o balde (`modelo:fim`), e o
instrumento avisa sozinho enquanto a janela pegar turnos antigos.

Latência hoje, 20 dias: **p50 13,7s · p95 40,5s · p99 62,5s**, pior caso 150,5s.

**Bloco 2 — performance. Trigram de conteúdo REMOVIDO em 24/08** (migration
`20260824170000`). Função inteira, braço léxico: **~2.752 ms → 18,8 ms (146×)**.

O diagnóstico anotado antes estava **simplificado demais**. O índice GIN É usado — e é
quase inútil: uma pergunta qualquer tem trigramas comuns do português, o índice devolve
**9.020 candidatos de 10.333 chunks (87%)** e o RECHECK recomputa a similaridade sobre
documentos inteiros para descartar 8.727. Sobram 4 linhas, por 2,47 s. O mesmo ramo sobre
`nodes.title` custa **2,6 ms** e devolve 19 linhas — fica, é ele que tolera typo.

**Custo: recall@4 caiu de 13/20 para 12/20.** O instrumento é determinístico (duas
execuções idênticas dão o mesmo número), então a queda é real, não ruído. O caso perdido é
`"preencha o campo"` — e vale saber COMO ele passava: por um chunk de **22 caracteres**
contendo só `"Campo de Preenchimento"`, cabeçalho de coluna de tabela. Era artefato de
chunking, não recuperação. **365 chunks (3,5%) têm menos de 40 caracteres** — defeito
separado, ainda aberto.

Três saídas testadas e **descartadas com medição**:
- filtrar por tamanho da consulta — não adianta: consulta de 10 chars custa 2.406 ms igual
  (8.923 candidatos). O custo é do corpus, não da pergunta;
- `word_similarity` (`<%`), feito para consulta curta × documento longo — 1.451 ms, ainda
  inaceitável;
- reescrita da consulta com histórico resgataria o caso? **Não.** Testado com três
  reescritas: o nó não volta nem em 8º.

O índice `chunks_content_trgm` **não foi derrubado**: se a decisão for revista, o caminho
de volta não passa por reindexar 10 mil chunks.

### Chunks-fragmento — o defeito de verdade por trás do caso perdido

O caso `"preencha o campo"` passava por um chunk de 22 caracteres. Fui medir a extensão:
**815 de 4.526 chunks de artigo (18%) tinham menos de 120 caracteres**, o menor com **3**.
Destes, **437 eram só o título de uma seção sem corpo** — um heading seguido direto de
outro heading virava um chunk com o título e nada mais.

Por que importa mais do que o tamanho sugere: com `ragLimit` em torno de 4, cada fragmento
premiado ocupa **uma das quatro vagas** que o modelo vai ler.

**Corrigido nos dois caminhos de fatiamento:**
- `chunkArticle` — título órfão **viaja para o próximo chunk** (um título anuncia o que vem
  depois). Trecho ainda curto leva a trilha dos ancestrais junto.
- `chunkExtracted` (arquivos importados) — trecho abaixo do piso leva a trilha junto.
  **Não funde seções**: em manual importado isso misturaria assuntos que só estão perto
  por acidente de diagramação.

`chunkArticle` foi extraído para **`chunk-split.ts`**, puro. O módulo antigo importa
`@/lib/ai/config` (que lê env na carga) e `server-only` — é por isso que a função mais
importante da busca **não tinha um único teste**. Agora tem 10.

**Reindexação:** `npx tsx --env-file=.env.local scripts/reindexar-fragmentos.ts --seco`
roda o chunker novo em memória sobre o acervo real e **prevê** o resultado antes de
escrever. Previsão medida: **815 → 261 fragmentos (−68%)**.

Fora de escopo: os 58 fragmentos vindos de **arquivos importados** (15 documentos).
Refazê-los exige rebaixar e reparsear o arquivo do Storage — os blocos extraídos não ficam
guardados. Corrigem-se sozinhos no próximo reprocessamento.

Ainda aberto no bloco: paralelizar o preparo (estimativa antiga, até −3.970 ms) — agora
mensurável de verdade com `npm run perf:latencia`.

**Bloco 3 — assertividade** (`ferramenta 64/125`). Quatro mudanças de **ORDEM**, uma por
vez: módulo no texto embedado (a mais barata) · fusão léxico+vetor no funil · rerank
condicional reusando `selecionarToolsAderentes` · roteador de fonte extraído como módulo
puro.

**Bloco 4 — robustez.** Evidence Validator (o único componente da arquitetura alvo que não
existe) · segurança, que tem **cobertura zero** — começar pela metade determinística
(`tool-scope`, `panel-scope`, `escopo-identidade`), que roda na CI sem modelo.

### Decisões que são suas, não minhas

- **A bifurcação de custo.** haiku + estabilizar `tools` (**9.451 tok-eq/turno**) e gemini
  (2.786 tok/turno) **se excluem** — só o haiku honra `cacheControl`. Dá para medir sem
  refatorar nada: atribuir `chat_ferramentas` a um e `chat` ao outro em Sistema→IA.
  Recomendo o haiku: é 3,4× maior.
- **`CASOS_CAPTURA=1` não está no contêiner de produção**, só no `.env.local`. Sem isso a
  instrumentação nova roda e não grava caso nenhum.
- **As três chaves expostas no repositório público** (`SUPABASE_SERVICE_ROLE_KEY`,
  `SUPABASE_DB_URL` com senha, `APP_ENCRYPTION_KEY`) seguem sem rotação.
- **47 rótulos `espera_fonte` não confirmados.** O eixo FERRAMENTA é ouro em 138; o de
  FONTE, em ~78.

### Duas lacunas de governança que o estudo achou

1. **`CLAUDE.md` tem 407 linhas sobre OUTRO produto** — é o prompt-mestre da plataforma de
   documentação. Não menciona o chatbot, as ferramentas, o RAG do chat nem os evals. Quem
   lê hoje não fica sabendo que existem 138 casos rotulados e 12 instrumentos de medição.
2. **A CI não roda eval nenhum.** Nada impede um PR que muda descrição de ferramenta ou
   prompt sem prova.

---

# HISTÓRICO — 16/08/2026

> O que segue é o estado de 16/08 e **já foi superado**. Mantido como registro do que
> estava aberto naquela data; não é lista de tarefas.

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

### Os rótulos: por que não existiam, e como recuperá-los  ✔ RESOLVIDO e JÁ NO BANCO

> **Atualizado em 16/08 23h.** O worker foi reiniciado e as duas fontes reprocessadas. Esta
> seção mudou de "o que fazer" para "o que temos" — e a conclusão de desenho **virou**:
> a tradução deixou de ser exceção e passou a ser o caminho principal. Ver "O que isto
> muda no plano", no fim da seção.

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

**Uma quarta causa apareceu depois**, e valia sozinha a rodada: o insert em lote é atômico
no Postgres, e uma linha duplicada derrubava as outras 499. **3.000 linhas sumiam em
silêncio** (`apex_app` e `apex_page` ficavam com ZERO), porque o erro do insert nunca era
conferido e a contagem publicada vinha do array em memória. Corrigido em
`src/lib/data-dictionary/gravar.ts` (deduplica, confere cada lote, para no primeiro erro).

**E os rótulos do CSV estavam escondidos dentro do comentário.** O ERP grava
`"Codigo - Código, que deseja incluir…"` no comentário da coluna: dos 4.809 comentários,
1.865 seguem esse padrão e 1.733 são curtos o bastante para serem o próprio rótulo.
`src/lib/data-dictionary/rotulo.ts` extrai isso sem IA nenhuma.

#### Estado do banco AGORA (medido 16/08 23h)

| origem | colunas | com rótulo | com tabela | tabela **e** rótulo |
|---|---|---|---|---|
| `db_ddl` (CSV) | 64.999 | 3.601 | 64.999 | 3.601 |
| `apex_dict` (f200) | 2.789 | 2.300 | 1.848 | 1.446 |

**5.031 pares distintos `tabela.coluna → rótulo`, em 509 tabelas** — contra 727 pares em 44
tabelas, que era o número da versão anterior deste documento.

Ontologia: **5.640 termos e 16.919 sinônimos** (eram 2.240 e 12.063). Os sinônimos técnicos
entraram automaticamente (`COD_FILIAL` como alias de "Filial"), mais uma passada de IA pelo
escopo `dicionario`.

#### A ressalva que o número esconde

Nem todo rótulo é tradução. Medido sobre os 3.413 pares distintos `coluna → rótulo`:

- **~95% são tradução de verdade** — `COD_RET_IRF → "Código Retenção IR"`,
  `USUARIO_ENVIO → "Usuário que enviou o arquivo"`, `FLG_CONTR_INSS → "Inss em Dia"`.
- **184 ainda abrem com abreviação técnica** — `COD_ATIVIDADE → "Cod Atividade"`,
  `CAD_VAGA → "Cod vaga"`. Isso **não** satisfaz a regra: é o nome da coluna fantasiado, e
  passa mais fácil numa revisão do que o nome cru passaria.
- Um terceiro grupo é inofensivo e não deve ser filtrado: `BAIRRO → "Bairro"`,
  `MATRICULA → "Matrícula"`. A coluna coincide com a palavra humana; dizer "Bairro" está
  certo.

> **A tradução precisa de um portão de qualidade**, não só de um par. Rótulo que abre com
> `Cod `/`Flg `/`Ind `/`Dt `/`Vlr ` cai na SUPRESSÃO, não na tradução.

#### O que isto muda no plano

A conclusão anterior — *"727 pares, uma fatia do ERP; para o resto vale supressão"* —
**inverteu**. Com 5.031 pares em 509 tabelas, a tradução vira o caminho principal e a
supressão vira a exceção (o que não tem rótulo, e os 184 de rótulo ruim).

Isso reordena o plano de execução abaixo: o item 5 (camada de tradução no gargalo único)
deixa de depender de "subir o metadado das outras aplicações APEX" e passa a ser
executável agora.

> ~~AÇÃO PENDENTE~~ ✔ **FEITO em 16/08.** Worker reiniciado, `f200.json` reprocessado
> (`componentes: 10.694`, `colunas: 3.016`) e CSV reimportado com a extração de rótulo.

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
   *(Atualização 16/08: os arquivos foram redesenhados — Parte 4 —, mas o cabeçalho de
   tabela continua sendo a coluna crua. O redesenho não tocou nisso, e agora que existem
   5.031 pares a tradução ali é barata: `expandirTabela` já monta os cabeçalhos num lugar
   só, `datasets.ts:389-394`.)*

### Plano de execução proposto (depois das respostas)

| # | O quê | Por quê primeiro |
|---|---|---|
| 1 | `regraRotulosColuna` sai de trás do gate `temTools`, ganha a documentação no escopo e passa a valer no portal | Uma linha de escopo, cobre as três rotas, reversível |
| 2 | Suprimir `_colunas` e as mensagens `"Colunas reais: …"` do que vai ao modelo | É o vazamento mais concentrado e não tem função para o usuário |
| 3 | `glossarioCasado` deixa de imprimir aliases que parecem identificador técnico | O casamento da consulta não depende de imprimir. **Ficou mais urgente:** os sinônimos foram de 12.063 para 16.919, e o que entrou são justamente os nomes de coluna |
| 4 | Detecção da app + portão: fora da Carga de Dados, a supressão vale; dentro, não | Depende da decisão 1 |
| 5 | Camada de tradução em `injetarDatasetComRelato` (gargalo único) | **Promovido.** São 5.031 pares em 509 tabelas, não 727 em 44 — a tradução virou o caminho principal. Precisa do portão de qualidade (rótulo que abre com `Cod `/`Flg `/`Dt ` cai na supressão) |
| 6 | Cartão de citação e cabeçalho de PDF/XLSX | Não passam pelo modelo — exigem tradução de verdade. O cabeçalho é montado num lugar só (`datasets.ts:389-394`), então é barato |
| 7 | Marcar conteúdo técnico fora do escopo do chatbot | Exige coluna de tipo em `chunks` (migration) |

**Ordem sugerida depois da atualização:** 5 → 2 → 3 → 6 → 1 → 4 → 7. A tradução (5) passou
à frente porque agora cobre a maior parte dos casos, e porque os itens 2 e 3 ficam mais
fáceis de calibrar quando já existe um tradutor para consultar: em vez de só suprimir,
dá para trocar.

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

---

## PARTE 4 — Arquivos gerados (PPTX, PDF, Word) com a identidade Natcorp

Pedido de 16/08 à noite, com o deck institucional (23 slides) como referência. Plano
completo em `~/.claude/plans/glistening-splashing-ritchie.md`.

O diagnóstico que orientou tudo: o deck tem **nove arquétipos de layout**; o gerador fazia
**um bloco por página/slide, sempre igual**. A diferença não era capricho, era vocabulário.

### Decisões suas (não reabrir sem motivo)

| | escolha |
|---|---|
| Identidade | **sempre Natcorp**, em qualquer cliente |
| Tipografia do PDF | **manter Helvetica** (sem fonte embutida) |
| Densidade | **o formato decide**: pptx = apresentar · pdf/docx = ler · xlsx/csv = trabalhar |
| Público | diretoria **e** analista |

> **Consequência visível já no ar:** quem configurou `widget_keys.config.primaryColor`
> via a cor no PDF; agora sai roxo Natcorp. A cor continua valendo para a bolha do widget.

### Entregue (4 commits, todos no `main`)

`0100431` **marca, capa e a pizza** — `src/lib/reports/marca.ts` com as rampas 50→950
(há teste que LÊ o `tailwind.config.ts` para as cópias não divergirem). Capa no PDF com
faixa em degradê. Substituiu três implementações de cor que não se conheciam.

`d74d0e6` **logo nos três** — `src/lib/reports/assets/logo.ts`, base64 (o Next rastreia
imports, não caminhos de runtime). Regerável com `npx tsx scripts/gerar-logo-assets.ts`.

`aa98b49` **arquétipos** — `secao`, `destaques`, `cards` + `titulo` no bloco de texto +
`nota` em qualquer bloco (vira notas do apresentador no PPTX).

`10fe089` **a IA aprende** — schema e instruções. O texto da tool dizia literalmente
"pptx (PowerPoint — um slide por bloco)": o comportamento estava no contrato, não no
código.

### Cinco defeitos antigos que apareceram por OLHAR o arquivo

1. **A pizza do PDF não era pizza** — desenhava barra 100% empilhada com legenda.
2. **Imagem achatada 27%** — clamp em uma dimensão só. Nunca notado porque a única forma
   que denuncia distorção é o círculo, e o PDF não desenhava círculo até a pizza virar pizza.
3. **Espaço antes da pontuação** — `"colaboradores , 3,1%"`. O tokenizador quebrava cada
   run em palavras e recolava com espaço, perdendo a fronteira. Extraído para `tokens.ts`.
4. **Tabela do PPTX transbordava** — corte de 24 linhas e aviso num `y` fixo, ambos chute.
5. **Faixa listrada no PPTX** — `line: { width: 0 }` NÃO desliga borda no OOXML; vira
   hairline de 1px. O interruptor é `line: { type: "none" }`.

### O que falta

| # | o quê |
|---|---|
| 1 | **`combo` no PPTX perde a série de linha em silêncio** — `CHART_SUPORTE.combo.pptx = true` mas `exporters.ts` mapeia `combo → "bar"`. Ou implementa multi-tipo, ou marca `false` para `degradarTipo` avisar. Era o próximo item. |
| 2 | Área do PDF é faixa vertical a 18% de opacidade, não polígono (`pdf.ts:374-379`) |
| 3 | Testes estruturais dos renderizadores (jszip: PPTX tem N slides e `notesSlide`; DOCX tem capa e `Header`; PDF tem N páginas) |
| 4 | Rodapé do PPTX ainda usa `brand.marca`; o master se chama "NATCORP" mesmo quando não é |

### Como olhar o resultado

```
npm run relatorio:amostra -- <pasta>     # gera os 5 formatos com dados fictícios
soffice --headless --convert-to pdf --outdir <p> <arquivo.pptx>   # para VER pptx/docx
```

O script de amostra veio na fase 1 e não no fim de propósito: sem conseguir abrir o
arquivo, os cinco defeitos acima passariam de novo.
