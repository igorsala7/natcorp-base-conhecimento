# Comparação de modelos — 2026-08-19 20:08

16 casos · mesmo prompt, mesmas ferramentas, mesma pergunta — só o modelo muda.

| modelo | acerto | tokens in | out | US$/1k turnos | s/turno |
|---|---|---|---|---|---|
| `google:gemini-3.5-flash-lite` | 8/16 (50%) | 4733 | 76 | 1.61 | 1.0 |
| `google:gemini-3.5-flash` | 8/16 (50%) | 4733 | 553 | 12.08 | 3.5 |
| `anthropic:claude-haiku-4-5` | 6/16 (38%) | 7638 | 143 | 8.35 | 2.3 |
| `anthropic:claude-sonnet-5` | 7/16 (44%) | 8272 | 359 | 30.21 | 5.7 |
| `openai:gpt-5.6-luna` | 4/16 (25%) | 3877 | 97 | 0.89 | 2.7 |
| `openai:gpt-5.6-terra` | 5/16 (31%) | 3877 | 93 | 8.87 | 2.8 |

> **Ressalva que decide como ler esta tabela.** Cada pergunta é enviada
> ISOLADA — sem histórico de conversa e sem contexto de tela. Vários casos do
> conjunto são continuações ("Ela tem alguma avaliação>", "me retorne o
> histórico do Tony"), e sem o turno anterior nenhum modelo tem como acertar.
> Por isso o acerto absoluto (25–50%) é um PISO, não o desempenho real.
>
> A COMPARAÇÃO continua válida: a limitação é idêntica para todos. Mas com 16
> casos, uma diferença de 8/16 para 7/16 são duas perguntas — ruído. O que a
> amostra sustenta é o CUSTO, onde a diferença é de 19 vezes.

## Onde os modelos discordaram

**"Quais deles já tiveram afastamentos?"** — esperado `sesmt_procedimentos`

- ❌ `google:gemini-3.5-flash-lite` → (nenhuma)
- ✅ `google:gemini-3.5-flash` → sesmt_procedimentos
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `openai:gpt-5.6-luna` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → (nenhuma)

**"Quero meu histórico financeiro do mês de 05/2025"** — esperado `historico_financeiro`

- ✅ `google:gemini-3.5-flash-lite` → historico_financeiro
- ✅ `google:gemini-3.5-flash` → historico_financeiro
- ✅ `anthropic:claude-haiku-4-5` → historico_financeiro
- ✅ `anthropic:claude-sonnet-5` → historico_financeiro
- ❌ `openai:gpt-5.6-luna` → (nenhuma)
- ✅ `openai:gpt-5.6-terra` → historico_financeiro

**"Ela tem alguma avaliação>"** — esperado `bi_avaliacoes`

- ✅ `google:gemini-3.5-flash-lite` → bi_avaliacoes
- ✅ `google:gemini-3.5-flash` → bi_avaliacoes
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `openai:gpt-5.6-luna` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → (nenhuma)

**"verifique o dia 25/07 para matricula 48707 o sistema deveria apurar 05"** — esperado `frequencia_resultado_apuracao_detalhe`

- ✅ `google:gemini-3.5-flash-lite` → frequencia_resultado_apuracao_detalhe
- ✅ `google:gemini-3.5-flash` → frequencia_resultado_apuracao_detalhe
- ✅ `anthropic:claude-haiku-4-5` → frequencia_resultado_apuracao_detalhe
- ✅ `anthropic:claude-sonnet-5` → frequencia_resultado_apuracao_detalhe
- ❌ `openai:gpt-5.6-luna` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → (nenhuma)

**"Quero criar um invite para uma call com igorsala7@gmail.com para o dia"** — esperado `ms_evento_criar`

- ✅ `google:gemini-3.5-flash-lite` → ms_evento_criar
- ❌ `google:gemini-3.5-flash` → (nenhuma)
- ✅ `anthropic:claude-haiku-4-5` → ms_evento_criar
- ✅ `anthropic:claude-sonnet-5` → ms_evento_criar
- ✅ `openai:gpt-5.6-luna` → ms_evento_criar
- ✅ `openai:gpt-5.6-terra` → ms_evento_criar

**"Eu quero todas as informações do histórico financeiro mais recente."** — esperado `historico_financeiro`

- ❌ `google:gemini-3.5-flash-lite` → (nenhuma)
- ✅ `google:gemini-3.5-flash` → historico_financeiro
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ✅ `anthropic:claude-sonnet-5` → historico_financeiro
- ❌ `openai:gpt-5.6-luna` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → (nenhuma)

**"me retorne o histórico de cargos e salários do Tony, me retorne também"** — esperado `linha_tempo_fato`

- ✅ `google:gemini-3.5-flash-lite` → linha_tempo_fato
- ❌ `google:gemini-3.5-flash` → (nenhuma)
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `openai:gpt-5.6-luna` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → (nenhuma)

