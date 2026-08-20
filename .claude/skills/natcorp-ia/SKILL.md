---
name: natcorp-ia
description: Use ao mexer no pipeline de IA deste projeto — prompt do chat, seleção de ferramentas, RAG, cache de prompt, custo de token, ou qualquer coisa em src/lib/ai, src/lib/chat, src/lib/integrations e src/app/api/v1/chat. Traz a ordem de renderização que o cache exige, o portão de regressão obrigatório e as armadilhas locais que custam uma sessão inteira para redescobrir.
---

# Pipeline de IA — Natcorp

## A regra que governa o custo

O cache de prompt é **casamento de prefixo**. A ordem de renderização é sempre
`tools` → `system` → `messages`, e qualquer byte que mude numa posição invalida
tudo o que vem depois dela.

Daí a única regra que precisa ser lembrada ao mexer no prompt:

> **Estável na frente, volátil atrás.**

| Bloco | Estabilidade desejada | Onde vive |
|---|---|---|
| `tools` | idêntico entre turnos do mesmo assunto | `src/lib/integrations/tool-builder.ts` |
| `system` | idêntico dentro da configuração | `composeSystemPrompt` em `src/lib/ai/system-prompt.ts` |
| `messages` | muda a cada turno — é o lugar certo do volátil | `src/app/api/v1/chat/route.ts` |

**Diretriz × dado.** O bloco `CONTEXTO` mistura instrução e conteúdo, e os dois
vão para lados opostos:

- **Diretriz** (`MODO "SÓ ESTAS FONTES"`, notas de completude/referente) fica no
  `system`. Posição é autoridade, e turno de usuário é superfície de injeção.
- **Dado** (RAG, relatório, varredura de tela, anexos) sai do `system` e vai para
  a última pergunta, rotulado como DADO. É o conteúdo caro e volátil, e é o que
  o projeto já trata como "documento é dado, nunca instrução".

A separação vive em `src/lib/ai/prompt-split.ts` (puro e testado) e está
**LIGADA por padrão**. `PROMPT_DADOS_FORA_DO_SYSTEM=0` volta à montagem antiga,
byte-idêntica — é o interruptor para usar sem deploy se o catálogo de casos
apontar regressão. Não apague.

**O contexto de tela ANEXA à primeira pergunta, não cria mensagem.** Criar uma
mensagem `user` deixaria duas seguidas quando a conversa já começa com uma, e o
Gemini — que atende a maior parte do `chat` — exige alternância de papéis.

**Cuidado com referência interna entre blocos.** Vários dizem "as fontes
ACIMA". Separar um par assim deixa o "acima" apontando para o nada — por isso
`fontesBlock` está classificado como diretriz, junto do MODO que o cita.

## Qual caminho otimizar

O uso real é concentrado, e otimizar fora dele é desperdício de esforço
(medido em 706 turnos):

| Caminho | Presença | Prioridade |
|---|---|---|
| Tools + relatório da tela + RAG + ontologia | scan 99,6% · RAG 93,2% · report 35,6% | **É o caminho.** |
| Modo "só estas fontes" / "fontes + tela" | bloco `fontes` com p95 = 0 | Raro por decisão de produto — não vale mexer. |

Os blocos de dado variam em **ritmos diferentes**, e isso decide onde cada um
entra:

- **Por tela** — scan, tables, fields, report (~5,4k). Repetem idênticos entre
  turnos da mesma conversa (média de 4,89 turnos por conversa).
- **Por pergunta** — RAG, termos do glossário (~5,3k). Mudam sempre.

## O portão: nada de roteamento entra sem medição

Existe um catálogo de casos derivado de traces reais. **Qualquer mudança que
toque seleção de ferramenta, corte de contexto ou tamanho de prompt passa por
ele antes e depois.** Não é boa prática — é condição. Numa base de RH, 20% de
economia que derruba 3 pontos de precisão é péssimo negócio, e sem medição a
troca acontece sem ninguém ver.

Precedente concreto: reduzir `MAX_TOOLS_MODELO` de 12 para 6 economizou tokens e
**quebrou a resolução de dependência** — tools obrigatórias eram cortadas por
similaridade. Cortar ferramenta reduz custo *e* precisão juntos; cache reduz
custo sem tirar nada. Esgote o cache antes de tocar nas ferramentas.

## Onde olhar os números reais

- `ai_usage` — tokens por provedor, modelo e finalidade, com `cache_read_tokens`
  e `cache_write_tokens` separados. A métrica-termômetro é
  `cache_read / (cache_read + cache_write + input)`, segmentada por finalidade.
- `ai_chat_traces` — passo `prompt_blocks` traz o tamanho de cada bloco do
  system prompt; passo `ferramentas` traz a lista enviada; `tool_call`, a
  chamada de fato. O cruzamento dos dois dá o aproveitamento por tool.

Segmente sempre por finalidade e por painel: a média esconde o efeito, porque
`chat` e `chat_ferramentas` têm perfis de custo de ordens diferentes.

## Armadilhas locais

- **`SUPABASE_DB_URL` quebra o `pg`.** A senha tem `@`/`#` não escapados e o
  `new URL` engasga. Separe na **última** arroba e passe `user`/`password`/
  `host`/`port`/`database` em vez da string. O valor também vem entre aspas com
  `\r` do CRLF — tire o `\r` antes de remover as aspas.
- **`P_PAINEL` chega como `p_portal`.** Mesmo conceito, dois nomes: `P_PAINEL` no
  APEX, `p_portal` neste código (`PO` = RH, `PG` = gestor, `PC` = colaborador ou
  candidato). Procurar por `p_painel` não acha nada.
- **Piso de cache do Haiku 4.5: 4.096 tokens.** Prefixo menor não grava, sem erro
  e sem aviso. Confira `cache_creation_input_tokens` antes de concluir que um
  breakpoint funciona.
- **`MAX_TOOLS_MODELO` não é o número real de tools.** Ele limita só as de
  integração; formulário, visuais, consulta e relatório entram depois, fora do
  teto. A média medida é ~17 por turno.
- **Script fora do projeto não acha `pg`.** Rode com `NODE_PATH=./node_modules`.
- **Ontologia casa contra a consulta REESCRITA (`consultaRag`), nunca contra a
  mensagem crua.** "E em julho?" não tem termo nenhum para casar; a reescrita, que
  já resolveu a anáfora com o histórico, tem. Vale para `formasExpandidas`
  (roteador) e `glossarioCasado` (prompt). O passo `ontologia` no trace distingue
  "suprimido pelo modo" de "nenhum termo casou" — os dois pedem conserto oposto.
- **O glossário tem duas metades.** Como usar (instrução, estável → `system`) e
  quais termos casaram (volátil → dados). Juntá-las derruba o prefixo cacheado
  por causa de ~94 tokens.

## Continuidade entre turnos (memória de recuperação)

`conversations.rag_memoria` guarda os nós recuperados nos turnos recentes.
`src/lib/ai/rag-memoria.ts` tem a política (teto 12, janela 3 turnos) e é pura.

**Prioriza, não fixa.** A continuidade só ocupa vagas LIVRES da recuperação —
nunca desloca um resultado da fusão RRF. Acumular sem critério dilui, e
diluição custa assertividade. Só depois que o passo `rag` do trace mostrar que
a cauda é ruído é que a continuidade pode substituí-la.

## Dívida conhecida

**Os tipos gerados do banco estão desatualizados.** `npx supabase gen types`
com a CLI atual produz um arquivo que quebra 11 chamadas em 4 arquivos: os
argumentos de RPC nulláveis passaram a ser tipados `string | undefined` em vez
de `string | null`. Trocar `null` por `undefined` **muda o payload** (null vai
explícito; undefined é omitido e o Postgres aplica o `DEFAULT` da função), então
cada uma das 11 precisa ser conferida contra o default da sua função antes da
troca. Enquanto isso não acontece, colunas novas entram no arquivo à mão.

## Verificação antes de entregar

```
npx vitest run          # suíte completa, rápida (~3s)
npx tsc --noEmit
npx eslint <arquivos tocados>
```

Mudança de comportamento entra **desligada por padrão**, atrás de chave de
ambiente, para poder ser comparada contra o catálogo de casos.
