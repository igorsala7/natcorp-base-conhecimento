# Qualidade por finalidade — 2026-08-20 03:04

10 casos de resposta VERIFICÁVEL (número conhecido, citação conferível). Sem juiz-modelo.

| modelo | acerto | s/caso | falhou em |
|---|---|---|---|
| `openai:gpt-5.6-luna` | 10/10 | 2.1 | — |
| `anthropic:claude-sonnet-4-6` | 10/10 | 4.9 | — |
| `google:gemini-3.6-flash` | 10/10 | 5.0 | — |
| `anthropic:claude-sonnet-5` | 10/10 | 5.5 | — |
| `anthropic:claude-fable-5` | 10/10 | 12.5 | — |
| `openai:gpt-5.2` | 9/10 | 2.2 | média por grupo |
| `openai:gpt-5.6-terra` | 9/10 | 2.6 | CONTEXTO NÃO COBRE (não inventar) |
| `openai:gpt-5.5` | 9/10 | 3.1 | CONTEXTO NÃO COBRE (não inventar) |
| `google:gemini-3.5-flash` | 9/10 | 3.7 | soma dos salários |
| `anthropic:claude-opus-4-8` | 9/10 | 6.7 | soma dos salários |
| `google:gemini-3.1-flash-lite` | 8/10 | 1.3 | média por grupo, CONTEXTO NÃO COBRE (não inventar) |
| `anthropic:claude-haiku-4-5` | 8/10 | 1.9 | soma dos salários, média por grupo |
| `google:gemini-2.5-flash` | 8/10 | 1.9 | soma dos salários, CONTEXTO NÃO COBRE (não inventar) |
| `openai:gpt-5.6-sol` | 8/10 | 2.8 | COLUNA INEXISTENTE (não inventar), CONTEXTO NÃO COBRE (não inventar) |
| `anthropic:claude-opus-4-5` | 8/10 | 5.1 | soma dos salários, média por grupo |
| `anthropic:claude-opus-4-6` | 8/10 | 7.9 | soma dos salários, COLUNA INEXISTENTE (não inventar) |
| `anthropic:claude-opus-5` | 8/10 | 10.9 | soma dos salários, média por grupo |
| `google:gemini-3.5-flash-lite` | 7/10 | 1.2 | soma dos salários, média por grupo, CONTEXTO NÃO COBRE (não inventar) |
| `openai:gpt-4o-mini` | 7/10 | 1.9 | soma dos salários, média por grupo, CONTEXTO NÃO COBRE (não inventar) |
| `anthropic:claude-sonnet-4-5` | 7/10 | 7.0 | soma dos salários, média por grupo, CONTEXTO NÃO COBRE (não inventar) |
| `anthropic:claude-opus-4-7` | 7/10 | 7.7 | soma dos salários, média por grupo, CONTEXTO NÃO COBRE (não inventar) |
| `openai:gpt-4o` | 5/10 | 1.3 | soma dos salários, contagem com filtro, COLUNA INEXISTENTE (não inventar), filtro que não retorna nada, CONTEXTO NÃO COBRE (não inventar) |
| `openai:gpt-3.5-turbo` | 4/10 | 2.4 | soma dos salários, média por grupo, COLUNA INEXISTENTE (não inventar), filtro que não retorna nada, responde e cita, CONTEXTO NÃO COBRE (não inventar) |

## report_analysis

| modelo | acerto |
|---|---|
| `anthropic:claude-fable-5` | 6/6 |
| `anthropic:claude-sonnet-5` | 6/6 |
| `anthropic:claude-sonnet-4-6` | 6/6 |
| `openai:gpt-5.6-terra` | 6/6 |
| `openai:gpt-5.6-luna` | 6/6 |
| `openai:gpt-5.5` | 6/6 |
| `google:gemini-3.6-flash` | 6/6 |
| `anthropic:claude-opus-4-8` | 5/6 |
| `openai:gpt-5.6-sol` | 5/6 |
| `openai:gpt-5.2` | 5/6 |
| `google:gemini-3.5-flash` | 5/6 |
| `google:gemini-3.1-flash-lite` | 5/6 |
| `google:gemini-2.5-flash` | 5/6 |
| `anthropic:claude-opus-5` | 4/6 |
| `anthropic:claude-opus-4-7` | 4/6 |
| `anthropic:claude-opus-4-6` | 4/6 |
| `anthropic:claude-opus-4-5` | 4/6 |
| `anthropic:claude-sonnet-4-5` | 4/6 |
| `anthropic:claude-haiku-4-5` | 4/6 |
| `openai:gpt-4o-mini` | 4/6 |
| `google:gemini-3.5-flash-lite` | 4/6 |
| `openai:gpt-4o` | 2/6 |
| `openai:gpt-3.5-turbo` | 2/6 |

## chat

| modelo | acerto |
|---|---|
| `anthropic:claude-fable-5` | 4/4 |
| `anthropic:claude-opus-5` | 4/4 |
| `anthropic:claude-opus-4-8` | 4/4 |
| `anthropic:claude-opus-4-6` | 4/4 |
| `anthropic:claude-opus-4-5` | 4/4 |
| `anthropic:claude-sonnet-5` | 4/4 |
| `anthropic:claude-sonnet-4-6` | 4/4 |
| `anthropic:claude-haiku-4-5` | 4/4 |
| `openai:gpt-5.6-luna` | 4/4 |
| `openai:gpt-5.2` | 4/4 |
| `google:gemini-3.6-flash` | 4/4 |
| `google:gemini-3.5-flash` | 4/4 |
| `anthropic:claude-opus-4-7` | 3/4 |
| `anthropic:claude-sonnet-4-5` | 3/4 |
| `openai:gpt-5.6-sol` | 3/4 |
| `openai:gpt-5.6-terra` | 3/4 |
| `openai:gpt-5.5` | 3/4 |
| `openai:gpt-4o` | 3/4 |
| `openai:gpt-4o-mini` | 3/4 |
| `google:gemini-3.5-flash-lite` | 3/4 |
| `google:gemini-3.1-flash-lite` | 3/4 |
| `google:gemini-2.5-flash` | 3/4 |
| `openai:gpt-3.5-turbo` | 2/4 |
