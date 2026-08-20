# Rodada de ponta a ponta — 2026-08-20 23:16

24 turnos em 7 conversas, pela rota real (`/api/v1/chat`).

| finalidade | modelo | chamadas | entrada | cache read | cache write | US$ |
|---|---|---|---|---|---|---|
| `chat_ferramentas` | `google:gemini-3.6-flash` | 32 | 886352 | 236640 | 0 | 1.5338 |
| `report_analysis` | `google:gemini-3.6-flash` | 9 | 164867 | 81403 | 0 | 0.3153 |
| `query_rewrite` | `google:gemini-3.5-flash-lite` | 38 | 56264 | 0 | 0 | 0.0200 |
| `chat` | `google:gemini-3.6-flash` | 3 | 4446 | 0 | 0 | 0.0124 |
| `embedding` | `google:gemini-embedding-001` | 79 | 1210 | 0 | 0 | 0.0002 |

**Cache:** leitura 22% · reuso 0.00× por escrita.
**Custo:** US$ 1.8817 em 24 turnos (US$ 0.0784/turno, 78.40/1k).

**Poda entre passos:** 7 aplicações, 192,594 caracteres economizados (~48,149 tokens).

## Turno a turno

| pergunta | desfecho | tokens | s | ferramentas |
|---|---|---|---|---|
| Olá | resposta | 1773 | 4.7 | — |
| tudo bem? | resposta | 1683 | 3.0 | — |
| obrigado | resposta | 1753 | 3.4 | — |
| O que é período aquisitivo de férias? | resposta | 15635 | 16.4 | — |
| E o período de gozo, como funciona? | resposta | 17116 | 17.5 | — |
| Quantos dias posso vender? | resposta | 26438 | 13.5 | — |
| Quais são os meus dados cadastrais? | resposta | 17546 | 15.8 | — |
| Qual meu centro de custo? | resposta | 54682 | 18.1 | estrutura_centros_custo, informacoes_pessoais_funcionais_resumido |
| Há quanto tempo estou na empresa? | resposta | 29167 | 13.5 | — |
| Quais são os colaboradores do meu centro de custo? | resposta | 57627 | 21.5 | informacoes_pessoais_funcionais_resumido |
| Quantos deles estão ativos? | resposta | 61675 | 18.4 | informacoes_pessoais_funcionais_resumido |
| O que a CLT diz sobre o período de experiência? | resposta | 12803 | 21.7 | — |
| Quero ver as marcações de ponto da minha equipe | resposta | 18284 | 19.1 | — |
| do mês passado | resposta | 76264 | 28.4 | informacoes_pessoais_funcionais_resumido, consultar_marcacoes |
| quantas pessoas apareceram nessa lista? | resposta | 129385 | 27.7 | consultar_marcacoes, agregar_valores, listar_colaboradores_resumo |
| Quais colaboradores tiveram o desconto do FGTS? | resposta | 107635 | 23.4 | estrutura_ocorrencias_pagamento |
| Eu estou pedindo por colaborador os valores do evento de FGT | resposta | 108698 | 23.1 | historico_financeiro_meses, estrutura_ocorrencias_pagamento, consultar_registros |
| Confirmado | resposta | 37228 | 15.8 | historico_financeiro_meses |
| E o mês anterior? | resposta | 138674 | 30.1 | historico_financeiro_meses, informacoes_pessoais_funcionais_resumido, bi_hist_financeiro_agrupado_estrutura |
| Analise este relatório e me diga o que chama atenção. | resposta | 20124 | 24.2 | — |
| Qual é a soma total dos valores? | resposta | 36084 | 10.7 | agregar_valores |
| Qual ocorrência tem o maior valor? | resposta | 36484 | 15.7 | consultar_registros |
| Quantas são do tipo Provento? | resposta | 35877 | 11.8 | consultar_registros |

## Assertividade: 7/8

| pergunta | exigia | acertou |
|---|---|---|
| Eu estou pedindo por colaborador os valores do eve | não reexplicar que a tela não tem o detalhe | ✅ |
| Confirmado | executar, não pedir confirmação de novo | ✅ |
| E o mês anterior? | usar o período e a pessoa já fixados, sem perguntar de novo | ✅ |
| Analise este relatório e me diga o que chama atenç | análise com substância | ✅ |
| Qual é a soma total dos valores? | 186897.50 | ✅ |
| Qual ocorrência tem o maior valor? | Adiantamento | ✅ |
| Quantas são do tipo Provento? | 5 | ✅ |
| Qual o total de horas extras noturnas pagas? | admitir que a coluna não existe | ❌ |
