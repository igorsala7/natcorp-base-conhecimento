# Rodada de ponta a ponta — 2026-08-20 12:50

20 turnos em 6 conversas, pela rota real (`/api/v1/chat`).

| finalidade | modelo | chamadas | entrada | cache read | cache write | US$ |
|---|---|---|---|---|---|---|
| `chat_ferramentas` | `google:gemini-3.6-flash` | 18 | 485107 | 179501 | 0 | 0.8580 |
| `report_analysis` | `google:gemini-3.6-flash` | 9 | 164249 | 97687 | 0 | 0.3163 |
| `query_rewrite` | `google:gemini-3.5-flash-lite` | 29 | 42848 | 0 | 0 | 0.0154 |
| `chat` | `google:gemini-3.6-flash` | 4 | 18615 | 0 | 0 | 0.0441 |
| `embedding` | `google:gemini-embedding-001` | 60 | 903 | 0 | 0 | 0.0001 |

**Cache:** leitura 28% · reuso 0.00× por escrita.
**Custo:** US$ 1.2340 em 20 turnos (US$ 0.0617/turno, 61.70/1k).

**Poda entre passos:** 1 aplicações, 22,343 caracteres economizados (~5,586 tokens).

## Turno a turno

| pergunta | desfecho | tokens | s | ferramentas |
|---|---|---|---|---|
| Olá | resposta | 1807 | 5.8 | — |
| tudo bem? | resposta | 1710 | 4.5 | — |
| obrigado | resposta | 1710 | 3.9 | — |
| O que é período aquisitivo de férias? | resposta | 15850 | 22.6 | — |
| E o período de gozo, como funciona? | resposta | 15631 | 20.3 | — |
| Quantos dias posso vender? | resposta | 64153 | 21.9 | ferias_situacao, ferias_opcoes |
| Quais são os meus dados cadastrais? | resposta | 17684 | 18.8 | — |
| Qual meu centro de custo? | resposta | 52126 | 17.6 | estrutura_centros_custo |
| Há quanto tempo estou na empresa? | resposta | 23863 | 12.5 | — |
| Quais são os colaboradores do meu centro de custo? | resposta | 57027 | 21.1 | informacoes_pessoais_funcionais_resumido |
| Quantos deles estão ativos? | resposta | 95393 | 32.0 | informacoes_pessoais_funcionais_resumido |
| O que a CLT diz sobre o período de experiência? | resposta | 15548 | 19.7 | — |
| Quero ver as marcações de ponto da minha equipe | resposta | 17906 | 16.1 | — |
| do mês passado | resposta | 74791 | 31.5 | informacoes_pessoais_funcionais_resumido, consultar_marcacoes |
| quantas pessoas apareceram nessa lista? | resposta | 64477 | 23.7 | listar_colaboradores_resumo |
| Analise este relatório e me diga o que chama atenção. | resposta | 19674 | 24.8 | — |
| Qual é a soma total dos valores? | resposta | 36090 | 14.2 | agregar_valores |
| Qual ocorrência tem o maior valor? | resposta | 35829 | 15.5 | consultar_registros |
| Quantas são do tipo Provento? | resposta | 36766 | 14.7 | consultar_registros |
| Qual o total de horas extras noturnas pagas? | resposta | 43258 | 20.0 | buscar_no_sistema |

## Assertividade: 5/5

| pergunta | exigia | acertou |
|---|---|---|
| Analise este relatório e me diga o que chama atenç | análise com substância | ✅ |
| Qual é a soma total dos valores? | 186897.50 | ✅ |
| Qual ocorrência tem o maior valor? | Adiantamento | ✅ |
| Quantas são do tipo Provento? | 5 | ✅ |
| Qual o total de horas extras noturnas pagas? | admitir que a coluna não existe | ✅ |
