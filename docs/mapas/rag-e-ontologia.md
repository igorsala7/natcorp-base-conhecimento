# RAG e ontologia — mapa factual

> Levantado em 20/08/2026 lendo o código. Ponto de partida para auditoria — não
> repita este levantamento; conteste se achar divergência.

## Recuperação

`src/lib/ai/rag.ts` — `retrieveWith` (142–442) é o núcleo; `retrievePublicContext`
(483) é o caminho do widget. Fluxo: escopo → documentos (com herança do espaço-pai)
→ `expandirConsulta` da ontologia → embedding com cache KV (TTL 3600s) → RPC
`hybrid_search_scoped` → injeção forçada dos nós "responsáveis" → continuidade →
enumeração.

### A fusão, no SQL

`supabase/migrations/20260805130000_hybrid_search_group_limit.sql` — **RRF explícito,
`sum(1.0 / (60 + rnk))`, k = 60** (linha 113). Quatro sinais, **peso igual**, 40
candidatos cada:

| sinal | índice |
|---|---|
| full-text (tsvector `portuguese`, unaccent) | `chunks_tsv_gin` |
| trigram (conteúdo ∪ título do nó) | `chunks_content_trgm`, `nodes_title_trgm` |
| vetorial (cosseno) | `chunks_embedding_hnsw` |
| boost da ontologia | `chunks_tsv_gin` |

Pós-fusão: 1 chunk por nó (`distinct on`), agrupamento por manual (1º nível do
ltree) ou documento, e **top-N grupos por `p_group_limit` (default 2)** — a regra
anti-mistura entre manuais.

### Constantes

| constante | valor | local |
|---|---|---|
| RRF k | 60 | migration :113 |
| candidatos por sinal | 40 | migration :50,68,77,82,95,109 |
| `p_group_limit` | 2 (4 em pergunta composta) | migration :17 · `route.ts:1184` |
| `ragLimit` | 0/1/2/3/4/6/8/18 conforme o turno | `route.ts:1133-1143` |
| `LIMIAR_CONFIANCA` | **0.022** | `disambiguation.ts:246` |
| `TOP_K` desambiguação | 6 | `disambiguation.ts:69` |
| TTL cache embedding da query | 3600 s | `rag.ts:250` |

`lexicalOnly` (`route.ts:1150`): em modo relatório ou RAG-para-tool, **pula o
embedding** — a busca fica só ft+trg+boost.

### Memória de continuidade — não é boost

`src/lib/ai/rag-memoria.ts`, persistida em `conversations.rag_memoria`. Apesar do
nome `nosParaBoost`, os nós lembrados **só entram nas vagas que sobraram**
(`rag.ts:318-335`) — nunca deslocam resultado da fusão.

## Chunking e embeddings

`src/lib/content/chunk.ts`:
- `CHUNK_MAX = 2000` chars (linha 68); corta em espaço se passar de 60% do máximo.
- Particiona por headings H1/H2/H3; `heading_path` acumulado com `" > "`.
- **Contextual retrieval** (`textoParaEmbedding`, 150–159): o texto que vira vetor
  recebe prefixo `Contexto: <frase gerada por IA>\n<Documento: Manual — Artigo: X>`.
  Só o EMBEDDING leva o prefixo; `content` (exibição, snippet, `tsv`) fica puro.
- `documentContext` (26–60): 1 frase por documento, gerada por IA, cache por sha256.
- `token_count` é estimativa: `Math.ceil(content.length / 4)`.

Modelo: `text-embedding-3-small` @ **1536 dims** por padrão (`config.ts:76-77`),
configurável por base em `ai_assignments`. A coluna é `vector(1536)` — **trocar de
modelo obriga reindexar tudo**.

Reindexação: autosave grava só léxico (`withEmbeddings` ausente); publicação
enfileira; o worker faz com vetores.

## Ontologia — usada em TRÊS lugares

| função | onde é consumida |
|---|---|
| `expandirConsulta` (`ontology.ts:314-343`) | **RAG** — léxico (12 formas), vetor (6 formas), boost (4º sinal) e nós responsáveis (injeção forçada) |
| `formasExpandidas` (`:298-306`) | **roteamento de ferramentas** — enriquece o embedding da consulta (`route.ts:968`) |
| `glossarioCasado` (`:247-270`) | **prompt do LLM** — bloco de glossário (`route.ts:1625`) |

Mais um: `ontology-enrich.ts` enriquece o embedding do CATÁLOGO de ferramentas,
descartando gatilho genérico presente em muitas ferramentas.

`expandirConsultaLexica` (`:277-290`) **é código morto** — nenhum call site.

Armazenamento: `ontology_terms` + `ontology_aliases` + `ontology_translations`
(ponte cross-lingual), com herança do espaço-pai e cache em memória de 60s.
Piso de vocabulário RH hardcoded (`vocabulario-rh.ts`), desligável por env, e **o
termo do cliente sempre vence** o do piso.

## Desambiguação

`src/lib/ai/disambiguation.ts` — puro, sem IO.
- `analyzeAmbiguity`: exige ≥2 fontes, ≥2 temas distintos no topo-3, até 4
  competidores; devolve null se algum competidor casa o contexto atual.
- `analyzeConfidence`: null se a fonte top é `forced` ou tem score ≥ **0.022**;
  também null se os temas estão espalhados demais (>3 nos 5 primeiros).
- Gate em `route.ts:2194`, suprimido por `continuaAssunto`
  (`precisaContexto && conversaEmAndamento`).

## Reescrita

`rewrite-gate.ts` decide SE reescreve (`precisaContexto` = histórico ≥2 e (≤6
palavras ou anáfora)). `query-understanding.ts` faz a reescrita com o modelo
`query_rewrite`, histórico de 5 mensagens e vocabulário da ontologia (fuzzy).
`rewrite-divergence.ts` detecta quando a reescrita apagou a pergunta.

A reescrita alimenta **RAG, ontologia de roteamento, glossário do prompt e seleção
de ferramentas**. Quando diverge, a pergunta original volta como faceta extra e no
texto do classificador — sem substituir a reescrita.
