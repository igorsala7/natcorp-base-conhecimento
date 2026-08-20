# Rodada de ponta a ponta — 2026-08-20 01:37

15 turnos em 5 conversas, pela rota real (`/api/v1/chat`).

| finalidade | modelo | chamadas | entrada | cache read | cache write | US$ |
|---|---|---|---|---|---|---|
| `chat_ferramentas` | `anthropic:claude-haiku-4-5` | 17 | 537354 | 248265 | 244282 | 0.8893 |
| `query_rewrite` | `google:gemini-3.5-flash-lite` | 27 | 41367 | 0 | 0 | 0.0149 |
| `chat` | `google:gemini-3.6-flash` | 3 | 4459 | 0 | 0 | ? |
| `embedding` | `google:gemini-embedding-001` | 49 | 734 | 0 | 0 | 0.0001 |

**Cache:** leitura 30% · reuso 1.02× por escrita.
**Custo:** US$ 0.9043 em 15 turnos (US$ 0.0603/turno, 60.29/1k).

**Poda entre passos:** 0 aplicações, 0 caracteres economizados (~0 tokens).

## Turno a turno

| pergunta | desfecho | tokens | s | ferramentas |
|---|---|---|---|---|
| Olá | resposta | 1698 | 3.5 | — |
| tudo bem? | resposta | 1741 | 3.6 | — |
| obrigado | resposta | 1678 | 2.8 | — |
| O que é período aquisitivo de férias? | resposta | 25148 | 15.4 | — |
| E o período de gozo, como funciona? | resposta | 27961 | 14.7 | — |
| Quantos dias posso vender? | resposta | 37113 | 12.3 | — |
| Quais são os meus dados cadastrais? | resposta | 47488 | 13.4 | meus_dados |
| Qual meu centro de custo? | resposta | 24010 | 11.3 | — |
| Há quanto tempo estou na empresa? | resposta | 34329 | 10.8 | — |
| Quais são os colaboradores do meu centro de custo? | resposta | 77863 | 19.4 | informacoes_pessoais_funcionais_resumido |
| Quantos deles estão ativos? | resposta | 33274 | 11.5 | — |
| O que a CLT diz sobre o período de experiência? | resposta | 20361 | 13.6 | — |
| Quero ver as marcações de ponto da minha equipe | resposta | 27852 | 10.3 | — |
| do mês passado | resposta | 23948 | 10.7 | — |
| quantas pessoas apareceram nessa lista? | resposta | 162366 | 32.5 | listar_colaboradores_resumo, consultar_marcacoes, agregar_valores |
