# Rodada de ponta a ponta — 2026-08-20 12:34

20 turnos em 6 conversas, pela rota real (`/api/v1/chat`).

| finalidade | modelo | chamadas | entrada | cache read | cache write | US$ |
|---|---|---|---|---|---|---|
| `chat_ferramentas` | `google:gemini-3.6-flash` | 39 | 1004085 | 350399 | 0 | 1.7318 |
| `query_rewrite` | `google:gemini-3.5-flash-lite` | 35 | 54906 | 0 | 0 | 0.0198 |
| `report_analysis` | `google:gemini-3.6-flash` | 3 | 54081 | 32577 | 0 | 0.1083 |
| `chat` | `google:gemini-3.6-flash` | 3 | 4446 | 0 | 0 | 0.0125 |
| `embedding` | `google:gemini-embedding-001` | 72 | 1109 | 0 | 0 | 0.0002 |

**Cache:** leitura 26% · reuso 0.00× por escrita.
**Custo:** US$ 1.8724 em 20 turnos (US$ 0.0936/turno, 93.62/1k).

**Poda entre passos:** 7 aplicações, 130,238 caracteres economizados (~32,560 tokens).

## Turno a turno

| pergunta | desfecho | tokens | s | ferramentas |
|---|---|---|---|---|
| Olá | resposta | 1770 | 5.5 | — |
| tudo bem? | resposta | 1734 | 3.8 | — |
| obrigado | resposta | 1715 | 3.3 | — |
| O que é período aquisitivo de férias? | resposta | 15669 | 18.6 | — |
| E o período de gozo, como funciona? | resposta | 16756 | 17.8 | — |
| Quantos dias posso vender? | resposta | 54875 | 20.2 | ferias_situacao, ferias_opcoes |
| Quais são os meus dados cadastrais? | resposta | 17575 | 17.2 | — |
| Qual meu centro de custo? | resposta | 75372 | 20.8 | estrutura_centros_custo, informacoes_pessoais_funcionais_resumido |
| Há quanto tempo estou na empresa? | resposta | 25349 | 14.4 | — |
| Quais são os colaboradores do meu centro de custo? | resposta | 57171 | 23.1 | informacoes_pessoais_funcionais_resumido |
| Quantos deles estão ativos? | resposta | 115565 | 24.6 | informacoes_pessoais_funcionais_resumido, informacoes_pessoais_funcionais_resumido |
| O que a CLT diz sobre o período de experiência? | resposta | 12669 | 20.9 | — |
| Quero ver as marcações de ponto da minha equipe | resposta | 18023 | 16.6 | — |
| do mês passado | resposta | 75733 | 29.6 | informacoes_pessoais_funcionais_resumido, consultar_marcacoes |
| quantas pessoas apareceram nessa lista? | resposta | 91454 | 21.7 | consultar_marcacoes, agregar_valores |
| Analise este relatório e me diga o que chama atenção. | resposta | 57049 | 26.3 | agrupar, agrupar |
| Qual é a soma total dos valores? | resposta | 42921 | 24.3 | bi_hist_financeiro_agrupado_estrutura |
| Qual ocorrência tem o maior valor? | resposta | 76600 | 27.5 | bi_hist_financeiro_agrupado_estrutura, consultar_registros |
| Quantas são do tipo Provento? | resposta | 118144 | 32.9 | consultar_registros, consultar_registros, agregar_valores, consultar_registros |
| Qual o total de horas extras noturnas pagas? | resposta | 213287 | 35.5 | bi_hist_financeiro_agrupado_estrutura, consultar_registros, consultar_registros, consultar_registros, consultar_registros, estrutura_ocorrencias_pagamento |

## Assertividade: 2/5

| pergunta | exigia | acertou |
|---|---|---|
| Analise este relatório e me diga o que chama atenç | análise com substância | ✅ |
| Qual é a soma total dos valores? | 186897.50 | ❌ |
| Qual ocorrência tem o maior valor? | Adiantamento | ❌ |
| Quantas são do tipo Provento? | 5 | ✅ |
| Qual o total de horas extras noturnas pagas? | admitir que a coluna não existe | ❌ |
