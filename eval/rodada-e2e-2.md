# Rodada de ponta a ponta — 2026-08-20 01:33

15 turnos em 5 conversas, pela rota real (`/api/v1/chat`).

| finalidade | modelo | chamadas | entrada | cache read | cache write | US$ |
|---|---|---|---|---|---|---|
| `chat_ferramentas` | `anthropic:claude-haiku-4-5` | 17 | 473870 | 180624 | 263720 | 0.8420 |
| `query_rewrite` | `google:gemini-3.5-flash-lite` | 27 | 41164 | 0 | 0 | 0.0145 |
| `chat` | `google:gemini-3.6-flash` | 4 | 21639 | 0 | 0 | ? |
| `embedding` | `google:gemini-embedding-001` | 40 | 578 | 0 | 0 | 0.0001 |

**Cache:** leitura 25% · reuso 0.68× por escrita.
**Custo:** US$ 0.8567 em 15 turnos (US$ 0.0571/turno, 57.11/1k).

**Poda entre passos:** 1 aplicações, 22,325 caracteres economizados (~5,581 tokens).

## Turno a turno

| pergunta | desfecho | tokens | s | ferramentas |
|---|---|---|---|---|
| Olá | resposta | 1771 | 4.1 | — |
| tudo bem? | resposta | 1665 | 3.0 | — |
| obrigado | resposta | 1692 | 3.3 | — |
| O que é período aquisitivo de férias? | resposta | 20418 | 13.2 | — |
| E o período de gozo, como funciona? | resposta | 22633 | 15.0 | — |
| Quantos dias posso vender? | resposta | 53192 | 14.3 | — |
| Quais são os meus dados cadastrais? | resposta | 18601 | 15.9 | — |
| Qual meu centro de custo? | resposta | 44898 | 12.4 | meus_dados |
| Há quanto tempo estou na empresa? | resposta | 28786 | 9.9 | — |
| Quais são os colaboradores do meu centro de custo? | resposta | 96071 | 17.6 | informacoes_pessoais_funcionais_resumido, destacar_tela |
| Quantos deles estão ativos? | resposta | 42010 | 11.4 | — |
| O que a CLT diz sobre o período de experiência? | resposta | 20204 | 14.9 | — |
| Quero ver as marcações de ponto da minha equipe | resposta | 68796 | 16.5 | destacar_tela |
| do mês passado | resposta | 50792 | 17.2 | consultar_marcacoes |
| quantas pessoas apareceram nessa lista? | resposta | 30158 | 11.6 | — |
