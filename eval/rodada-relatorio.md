# Rodada de ponta a ponta — 2026-08-20 12:46

5 turnos em 1 conversas, pela rota real (`/api/v1/chat`).

| finalidade | modelo | chamadas | entrada | cache read | cache write | US$ |
|---|---|---|---|---|---|---|
| `report_analysis` | `google:gemini-3.6-flash` | 10 | 198720 | 114022 | 0 | 0.3649 |
| `query_rewrite` | `google:gemini-3.5-flash-lite` | 2 | 2809 | 0 | 0 | 0.0009 |
| `embedding` | `google:gemini-embedding-001` | 10 | 132 | 0 | 0 | 0.0000 |

**Cache:** leitura 36% · reuso 0.00× por escrita.
**Custo:** US$ 0.3659 em 5 turnos (US$ 0.0732/turno, 73.17/1k).

**Poda entre passos:** 0 aplicações, 0 caracteres economizados (~0 tokens).

## Turno a turno

| pergunta | desfecho | tokens | s | ferramentas |
|---|---|---|---|---|
| Analise este relatório e me diga o que chama atenção. | resposta | 38208 | 26.5 | agrupar, agrupar |
| Qual é a soma total dos valores? | resposta | 36054 | 11.7 | agregar_valores |
| Qual ocorrência tem o maior valor? | resposta | 35955 | 16.4 | consultar_registros |
| Quantas são do tipo Provento? | resposta | 52461 | 14.3 | consultar_registros |
| Qual o total de horas extras noturnas pagas? | resposta | 42674 | 21.3 | buscar_no_sistema |

## Assertividade: 5/5

| pergunta | exigia | acertou |
|---|---|---|
| Analise este relatório e me diga o que chama atenç | análise com substância | ✅ |
| Qual é a soma total dos valores? | 186897.50 | ✅ |
| Qual ocorrência tem o maior valor? | Adiantamento | ✅ |
| Quantas são do tipo Provento? | 5 | ✅ |
| Qual o total de horas extras noturnas pagas? | admitir que a coluna não existe | ✅ |
