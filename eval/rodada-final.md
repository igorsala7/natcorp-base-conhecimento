# Rodada de ponta a ponta — 2026-08-20 08:57

20 turnos em 6 conversas, pela rota real (`/api/v1/chat`).

| finalidade | modelo | chamadas | entrada | cache read | cache write | US$ |
|---|---|---|---|---|---|---|
| `query_rewrite` | `google:gemini-3.5-flash-lite` | 32 | 50757 | 0 | 0 | 0.0178 |
| `report_analysis` | `google:gemini-3.6-flash` | 1 | 17726 | 0 | 0 | 0.0519 |
| `chat` | `google:gemini-3.6-flash` | 4 | 16563 | 0 | 0 | 0.0414 |
| `embedding` | `google:gemini-embedding-001` | 60 | 850 | 0 | 0 | 0.0001 |

**Cache:** leitura 0% · reuso 0.00× por escrita.
**Custo:** US$ 0.1112 em 20 turnos (US$ 0.0056/turno, 5.56/1k).

**Poda entre passos:** 0 aplicações, 0 caracteres economizados (~0 tokens).

## Turno a turno

| pergunta | desfecho | tokens | s | ferramentas |
|---|---|---|---|---|
| Olá | resposta | 1678 | 3.9 | — |
| tudo bem? | resposta | 1717 | 3.7 | — |
| obrigado | resposta | 1728 | 3.1 | — |
| O que é período aquisitivo de férias? | erro_provedor | — | 10.0 | — |
| E o período de gozo, como funciona? | resposta | 13647 | 16.1 | — |
| Quantos dias posso vender? | erro_provedor | — | 7.4 | — |
| Quais são os meus dados cadastrais? | erro_provedor | — | 8.0 | — |
| Qual meu centro de custo? | erro_provedor | — | 6.9 | — |
| Há quanto tempo estou na empresa? | erro_provedor | — | 7.9 | — |
| Quais são os colaboradores do meu centro de custo? | erro_provedor | — | 7.8 | — |
| Quantos deles estão ativos? | erro_provedor | — | 7.7 | — |
| O que a CLT diz sobre o período de experiência? | erro_provedor | — | 9.7 | — |
| Quero ver as marcações de ponto da minha equipe | erro_provedor | — | 7.9 | — |
| do mês passado | erro_provedor | — | 7.2 | — |
| quantas pessoas apareceram nessa lista? | erro_provedor | — | 7.9 | — |
| Analise este relatório e me diga o que chama atenção. | resposta | 21095 | 21.1 | — |
| Qual é a soma total dos valores? | erro_provedor | — | 8.4 | — |
| Qual ocorrência tem o maior valor? | erro_provedor | — | 7.3 | — |
| Quantas são do tipo Provento? | erro_provedor | — | 7.0 | — |
| Qual o total de horas extras noturnas pagas? | erro_provedor | — | 7.3 | — |

## Assertividade: 1/5

| pergunta | exigia | acertou |
|---|---|---|
| Analise este relatório e me diga o que chama atenç | análise com substância | ✅ |
| Qual é a soma total dos valores? | 186897.50 | ❌ |
| Qual ocorrência tem o maior valor? | Adiantamento | ❌ |
| Quantas são do tipo Provento? | 5 | ❌ |
| Qual o total de horas extras noturnas pagas? | admitir que a coluna não existe | ❌ |
