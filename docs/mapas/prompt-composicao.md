# Como o system prompt é composto — mapa factual

> Levantado em 20/08/2026 lendo o código. Tamanhos MEDIDOS executando as funções,
> não estimados. Serve de ponto de partida para auditoria — não repita este
> levantamento, conteste-o se achar divergência.

## O tamanho real, e o que o trace não vê

Medido em 1.119 turnos (21 dias):

| | |
|---|---|
| system prompt real (`systemTok`) | **12.424 tokens** (49.694 chars) |
| soma dos 19 rótulos de `prompt_blocks` | 12.291 chars — **25% do total** |

**Três quartos do prompt não são medidos por rótulo nenhum.** Ficam de fora:
`regras` (5.970 chars), `linguagem`, `blocoNucleo`, `blocoRelatorioVazio`,
`blocoFonteRelatorio`, `blocoEscopoRel`, `blocoSelecaoFraca`, `blocoDatasets` e os
7 blocos apensados por `systemPrompt +=`.

## Ordem fixa — `composeSystemPrompt` (`src/lib/ai/system-prompt.ts:47-57`)

1. `persona` — cascata `widget_keys.system_prompt` → `spaces.chat_prompt` →
   override da tela → `PERSONA_RH` (se vertical rh) → `PERSONA_PADRAO`.
   **A persona do cliente SUBSTITUI a de fábrica**, não soma (`prompt-cascade.ts:95-98`).
   Aparada em 4.000 chars.
2. `ESPECIALIZAÇÃO DO ATENDIMENTO:` — `personaReport?.persona || integ.agentPrompt`.
   O perfil por relatório VENCE o agente (`route.ts:2428-2432`).
3. `USO DAS FERRAMENTAS:` — 15 sub-blocos montados em `route.ts:2331-2350`.
4. `linguagem` — idioma + formato de análise.
5. `regras` — `resolveRegras()`; override do banco substitui `REGRAS_ABSOLUTAS`
   inteiro, mas `regraRotulosColuna()` é sempre reanexada (`prompt-cascade.ts:117-120`).
   5b. `RECONCILIACAO_FERRAMENTAS` só se `temDataTools` (`route.ts:2458`).
6. `CONTEXTO:`

## Os 7 blocos apensados depois (`route.ts`, em ordem)

| linha | bloco | condição |
|---|---|---|
| 2466 | `## PLANEJAMENTO DA ANÁLISE` | `modoAnalisePura && (intencaoVis \|\| queryTools)` |
| 2495 | `## JÁ ESTABELECIDO NESTA CONVERSA` | `!social && !soRedigir` e há fatos |
| 2500 | `DIRETIVA_PERGUNTAR` | `!social && !soRedigir && temIntegTools` |
| 2524 | `## O USUÁRIO ESTÁ CONFIRMANDO` | `ehAfirmacao` sem pendência |
| 2535 | `blocoConfirmacaoExecutada` | servidor já executou |
| 2543 | `## PERÍODO ESCOLHIDO` | `scope.periodo` |
| 2553 | `## FONTE INDICADA` | `outraFonte` |

Existem **só** na rota do widget. Portal, admin e WhatsApp compartilham as seções
1–6 mas não estes.

## Tamanhos medidos (chars)

| diretiva | chars |
|---|---|
| `formAssistDirective` (todas as flags) | **18.161** (núcleo só: 6.060) |
| `resolveRegras(null)` | 5.970 |
| `REGRAS_ABSOLUTAS` | 5.320 |
| `integUsageDirective()` | 3.536 |
| `DIRETIVA_PERGUNTAR` | 2.997 |
| regras-núcleo (3 funções) | 2.954 |
| `visualsExtras` / `visualsCore` | 2.202 / 1.994 |
| `escopoAcessoDirective(PG)` | 2.246 |
| `inviteDirective` | 1.430 |
| `entregarResultadoDirective` | 1.181 |
| `escopoRelatorioDirective` | 935 |
| `PERSONA_RH` | 798 |
| `regraRotulosColuna` (proibido) | 647 |
| `selecaoFracaDirective` | 631 |
| `datasetsDirective` | 585 |

## Contradições entre blocos — observadas, não corrigidas

1. **Formato de entrega**: `entregarResultadoDirective` manda "ENTREGUE o resultado
   no chat, dezenas de milhares NÃO é desculpa" (`form-fields.ts:146-160`);
   `DIRETIVA_PERGUNTAR` manda "não decida sozinho entre chat e arquivo"
   (`perguntar.ts:61`); `visualsExtras` manda "PERGUNTE" (`visuals-directive.ts:60`).
   Coexistem quando há dados tabulares e ferramentas de integração.
2. **Confirmar antes de chamar**: `regras-nucleo.ts:29` proíbe ("posso consultar?");
   `selecaoFracaDirective` exige perguntar antes de chamar (`report-tools.ts:344`);
   `integUsageDirective` manda chamar na dúvida (`report-tools.ts:274-282`).
   Os três no mesmo `usoFerramentasStr`.
3. **Relatório vazio**: "não opere a tela, explique como ELE filtra"
   (`form-fields.ts:126`) × "PROIBIDO mandar o usuário mudar os filtros"
   (`report-tools.ts:369`) × "NUNCA EMPURRE A TAREFA" (`form-fields.ts:148`).
4. **Conhecimento próprio**, dentro do MESMO bloco: `prompt-cascade.ts:45` proíbe
   usar conhecimento geral; `:48` manda usar conhecimento de gestão de pessoas.
5. **Pergunta curta**: `prompt-cascade.ts:55` manda pedir a pergunta completa;
   `perguntar.ts:70-76` proíbe perguntar em mensagem curta com contexto claro.
6. **Perguntar × executar**: `DIRETIVA_PERGUNTAR` (2500) e "EXECUTE agora, não peça
   confirmação" (2524) podem ligar no mesmo turno.
7. **`comTools` × `temIntegTools`**: `RECONCILIACAO_FERRAMENTAS` entra por
   `temDataTools`; com `temIntegTools && !temDataTools`, a exigência de citação
   `[n]` fica sem a cláusula que a reconcilia com dados de API.
8. **Nomes técnicos**: `regras-nucleo.ts:70-78` proíbe citar coluna;
   `route.ts:2317` injeta a lista de colunas do relatório no prompt.

Os próprios comentários do código registram que "agir × perguntar" já morou em dois
arquivos com textos contraditórios, e foi movido para `regras-nucleo.ts`
(`report-tools.ts:284`, `form-fields.ts:206`, `regras-nucleo.ts:4-8`).
