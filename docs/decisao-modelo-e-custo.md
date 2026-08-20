# Modelo e custo — a decisão, e o que a sustenta

> Medido em 19/08/2026 sobre `eval/cenarios.jsonl` (37 turnos reais anotados) e
> 20 dias de `ai_usage` / `ai_chat_traces`. Refazer antes de reabrir a decisão.

## A decisão

**Manter `claude-haiku-4-5` em `chat_ferramentas`.** Não pelo preço — ele é 2,6×
mais caro por turno que o `gemini-3.5-flash-lite` mesmo com o cache funcionando.
Pela medição de qualidade, que virou a favor dele depois das mudanças de hoje:

| modelo | ferramenta | pergunta | perguntou demais | US$/1k turnos |
|---|---|---|---|---|
| `claude-haiku-4-5` | **23/37** | 28/37 | **0** | 141,46 |
| `gemini-3.5-flash-lite` | **23/37** | 26/37 | 3 | **53,86** |
| `gemini-3.5-flash` | 20/37 | 29/37 | 0 | 266,07 |
| `claude-sonnet-5` | 17/36 | 28/36 | 0 | 282,92 |

Empate na escolha de ferramenta, e o haiku **não interrompe o usuário nenhuma
vez** onde o flash-lite interrompe três. Num produto vendido por precisão,
perguntar o óbvio custa mais que a diferença de preço.

O custo do haiku assume o cache explícito medido AQUI (33% de leitura). Gemini e
OpenAI usam cache implícito, que neste sistema entrega 0–6% — por isso a coluna
deles é entrada cheia. Não é estimativa de catálogo: é o que `ai_usage` registrou.

> **Correção de 19/08, à noite.** A linha do `claude-sonnet-5` saiu antes por
> US$ 424,38, com o preço errado na nossa tabela (US$ 3/15). Conferido na fonte,
> o valor é US$ 2/10 — o preço de lançamento virou padrão e o aumento marcado
> para 01/09 foi cancelado. O número certo é US$ 282,92 e a conclusão não muda:
> ainda é o mais caro e o que menos acerta. Mas errar para MAIS num modelo caro
> é o tipo de erro que ninguém confere.

## Quando reabrir

Duas condições, e as duas precisam valer:

1. **Volume.** No volume de teste (~1.760 turnos/mês) a diferença é ~US$ 155/mês.
   A 100× isso, são US$ 15,5 mil/mês e a conversa muda.
2. **Um conjunto maior.** 37 casos não resolvem diferenças de 2 casos. Antes de
   trocar por causa de preço, ampliar `eval/cenarios.jsonl`.

## O que NÃO era o problema

Três hipóteses caras que a medição derrubou, para não voltarem:

- **"Um modelo melhor resolve."** Cinco modelos de três provedores ficaram dentro
  de 11 pontos, e o `claude-sonnet-5` — 20× o preço do flash-lite — acertou MENOS
  ferramentas que ele.
- **"O laço está disparando."** Mediana de 2 chamadas por turno em
  `chat_ferramentas`, 1 em `chat`. O 56,6 que eu tinha reportado era artefato:
  98% das linhas de `chat` estavam sem `turn_id`, e o divisor mentia.
- **"O prompt faz o agente perguntar."** A diretiva sozinha moveu o "perguntou de
  menos" em 10→8, 9→9, 10→10. O ganho só veio junto do portão no servidor.

## Onde o custo realmente está

Por chamada ao modelo em `chat_ferramentas` (44.601 tokens de entrada):

| parte | tokens | % |
|---|---|---|
| histórico + resultados de ferramenta | ~33.503 | **75%** |
| bloco de ferramentas | ~7.779 | 17% |
| prompt de sistema | ~3.319 | 7% |

E o histórico não é o culpado: `limitarHistorico` o trava em 24.000 caracteres e
a média real das últimas 20 mensagens é 4.535. É resultado de ferramenta,
reenviado a cada passo — o que a poda de `podar-passos.ts` ataca.

O prompt de sistema, que costuma ser o primeiro suspeito, são 7%. Cortá-lo pela
metade economizaria 3,5% e custaria comportamento.
