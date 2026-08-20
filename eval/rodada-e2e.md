# Rodada de ponta a ponta — 2026-08-20 01:27

15 turnos em 5 conversas, pela rota real (`/api/v1/chat`).

| finalidade | modelo | chamadas | entrada | cache read | cache write | US$ |
|---|---|---|---|---|---|---|
| `chat_ferramentas` | `anthropic:claude-haiku-4-5` | 18 | 478385 | 192005 | 240696 | 0.8227 |
| `query_rewrite` | `google:gemini-3.5-flash-lite` | 27 | 41340 | 0 | 0 | 0.0145 |
| `chat` | `google:gemini-3.6-flash` | 3 | 4448 | 0 | 0 | ? |
| `embedding` | `google:gemini-embedding-001` | 50 | 688 | 0 | 0 | 0.0001 |

**Cache:** leitura 27% · reuso 0.80× por escrita.
**Custo:** US$ 0.8374 em 15 turnos (US$ 0.0558/turno, 55.82/1k).

**Poda entre passos:** 2 aplicações, 40,426 caracteres economizados (~10,107 tokens).

## Turno a turno

| pergunta | desfecho | tokens | s | ferramentas |
|---|---|---|---|---|
| Olá | resposta | 1700 | 3.3 | — |
| tudo bem? | resposta | 1703 | 3.1 | — |
| obrigado | resposta | 1735 | 3.3 | — |
| O que é período aquisitivo de férias? | resposta | 19884 | 15.1 | — |
| E o período de gozo, como funciona? | clarify_tema | — | 7.4 | — |
| Quantos dias posso vender? | resposta | 36183 | 15.2 | — |
| Quais são os meus dados cadastrais? | resposta | 33683 | 16.6 | meus_dados |
| Qual meu centro de custo? | resposta | 27751 | 9.7 | — |
| Há quanto tempo estou na empresa? | resposta | 33713 | 9.7 | — |
| Quais são os colaboradores do meu centro de custo? | resposta | 108607 | 26.7 | listar_colaboradores_resumo, informacoes_pessoais_funcionais_resumido |
| Quantos deles estão ativos? | resposta | 34203 | 11.6 | — |
| O que a CLT diz sobre o período de experiência? | resposta | 14777 | 14.1 | — |
| Quero ver as marcações de ponto da minha equipe | resposta | 21745 | 11.2 | — |
| do mês passado | resposta | 47460 | 15.0 | resultado_apuracao_ponto, resultado_apuracao_ponto, informacoes_pessoais_funcionais_resumido |
