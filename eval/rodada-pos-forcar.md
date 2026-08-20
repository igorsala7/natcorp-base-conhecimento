# Rodada de ponta a ponta — 2026-08-20 19:28

24 turnos em 7 conversas, pela rota real (`/api/v1/chat`).

| finalidade | modelo | chamadas | entrada | cache read | cache write | US$ |
|---|---|---|---|---|---|---|
| `chat_ferramentas` | `google:gemini-3.6-flash` | 27 | 778612 | 146934 | 0 | 1.3412 |
| `report_analysis` | `google:gemini-3.6-flash` | 9 | 182873 | 105870 | 0 | 0.3492 |
| `chat` | `google:gemini-3.6-flash` | 5 | 56178 | 24500 | 0 | 0.1099 |
| `query_rewrite` | `google:gemini-3.5-flash-lite` | 37 | 55296 | 0 | 0 | 0.0197 |
| `embedding` | `google:gemini-embedding-001` | 73 | 1134 | 0 | 0 | 0.0002 |

**Cache:** leitura 21% · reuso 0.00× por escrita.
**Custo:** US$ 1.8202 em 24 turnos (US$ 0.0758/turno, 75.84/1k).

**Poda entre passos:** 4 aplicações, 120,160 caracteres economizados (~30,040 tokens).

## Turno a turno

| pergunta | desfecho | tokens | s | ferramentas |
|---|---|---|---|---|
| Olá | resposta | 1782 | 3.8 | — |
| tudo bem? | resposta | 1696 | 3.1 | — |
| obrigado | resposta | 1743 | 3.2 | — |
| O que é período aquisitivo de férias? | resposta | 15906 | 17.4 | — |
| E o período de gozo, como funciona? | resposta | 16488 | 16.7 | — |
| Quantos dias posso vender? | resposta | 51769 | 17.1 | ferias_situacao, ferias_opcoes |
| Quais são os meus dados cadastrais? | resposta | 16143 | 15.5 | — |
| Qual meu centro de custo? | resposta | 71222 | 16.3 | estrutura_centros_custo, informacoes_pessoais_funcionais_resumido |
| Há quanto tempo estou na empresa? | resposta | 28656 | 11.0 | — |
| Quais são os colaboradores do meu centro de custo? | resposta | 57526 | 20.4 | informacoes_pessoais_funcionais_resumido |
| Quantos deles estão ativos? | resposta | 62118 | 16.6 | informacoes_pessoais_funcionais_resumido |
| O que a CLT diz sobre o período de experiência? | resposta | 12169 | 17.6 | — |
| Quero ver as marcações de ponto da minha equipe | resposta | 17835 | 13.6 | — |
| do mês passado | resposta | 77244 | 23.1 | listar_colaboradores_resumo, consultar_marcacoes |
| quantas pessoas apareceram nessa lista? | resposta | 64205 | 16.4 | listar_colaboradores_resumo |
| Quais colaboradores tiveram o desconto do FGTS? | resposta | 39715 | 17.5 | — |
| Eu estou pedindo por colaborador os valores do evento de FGT | resposta | 69530 | 15.5 | historico_financeiro_meses |
| Confirmado | resposta | 53888 | 20.0 | clicar_elemento |
| E o mês anterior? | resposta | 198254 | 34.1 | historico_financeiro_meses, estrutura_ocorrencias_pagamento, informacoes_pessoais_funcionais_resumido, bi_hist_financeiro_agrupado_estrutura |
| Analise este relatório e me diga o que chama atenção. | resposta | 20817 | 21.2 | — |
| Qual é a soma total dos valores? | resposta | 36868 | 12.6 | agregar_valores |
| Qual ocorrência tem o maior valor? | resposta | 37769 | 13.7 | consultar_registros |
| Quantas são do tipo Provento? | resposta | 52481 | 12.2 | consultar_registros |

## Assertividade: 7/8

| pergunta | exigia | acertou |
|---|---|---|
| Eu estou pedindo por colaborador os valores do eve | não reexplicar que a tela não tem o detalhe | ✅ |
| Confirmado | executar, não pedir confirmação de novo | ❌ |
| E o mês anterior? | usar o período e a pessoa já fixados, sem perguntar de novo | ✅ |
| Analise este relatório e me diga o que chama atenç | análise com substância | ✅ |
| Qual é a soma total dos valores? | 186897.50 | ✅ |
| Qual ocorrência tem o maior valor? | Adiantamento | ✅ |
| Quantas são do tipo Provento? | 5 | ✅ |
| Qual o total de horas extras noturnas pagas? | admitir que a coluna não existe | ✅ |
