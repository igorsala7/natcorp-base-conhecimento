# O melhor modelo por finalidade — só qualidade, preço ignorado

> Medido em 19/08/2026. `chat_ferramentas`: 37 turnos reais anotados
> (`eval/cenarios.jsonl`). `report_analysis` e `chat`: 10 casos de resposta
> VERIFICÁVEL, sem juiz-modelo (`scripts/eval-qualidade.ts`). `query_rewrite`:
> 40 turnos reais (`scripts/eval-rewrite-modelo.ts`).

## Resumo

| finalidade | melhor medido | em uso hoje | trocar? |
|---|---|---|---|
| `chat_ferramentas` | `claude-opus-5` | `claude-haiku-4-5` | **não** — 2 casos de diferença é ruído |
| `chat` | empate de 6 em 4/4 | `gemini-3.6-flash` | **não** — já está no topo |
| `report_analysis` | `gemini-3.6-flash` | `gemini-3.5-flash` | **sim** — 6/6 contra 5/6, mesmo provedor |
| `query_rewrite` | empate triplo | `gemini-3.5-flash-lite` | **não** — zero discordâncias em 40 casos |

## chat_ferramentas — escolher a ferramenta certa e saber quando perguntar

| modelo | ferramenta | pergunta | perguntou demais |
|---|---|---|---|
| `claude-opus-5` | **24/37** | 28/37 | **0** |
| `gemini-3.5-flash-lite` | 23/37 | 25/37 | 3 |
| `claude-haiku-4-5` | 22/37 | 28/37 | **0** |
| `gpt-5.6-terra` | 22/37 | 27/37 | 2 |
| `gpt-5.6-sol` | 22/37 | **29/37** | 2 |
| `gemini-3.6-flash` | 21/37 | **29/37** | **0** |
| `claude-sonnet-5` | 19/37 | 28/37 | **0** |
| `gemini-3.5-flash` | 19/37 | **29/37** | **0** |

O opus-5 lidera, mas por 2 casos sobre o haiku — dentro do ruído de 37 casos.
O que NÃO é ruído: `claude-sonnet-5` fica em 19/37, atrás do haiku, que é três
níveis mais barato. Modelo maior não escolhe ferramenta melhor.

## report_analysis — analisar uma tabela sem inventar

Seis casos sobre uma tabela de 40 linhas gerada pelo próprio script, então a
resposta certa é conhecida.

| modelo | acerto | onde falhou |
|---|---|---|
| `gemini-3.6-flash` | **6/6** | — |
| `claude-sonnet-5` | **6/6** | — |
| `gpt-5.6-terra` | **6/6** | — |
| `gemini-3.5-flash` | 5/6 | soma de 40 valores |
| `claude-opus-5` | 5/6 | soma de 40 valores |
| `gpt-5.6-sol` | 5/6 | **inventou total de horas extras** |
| `gemini-3.5-flash-lite` | 4/6 | soma, média |
| `claude-haiku-4-5` | 4/6 | soma, média |

**A falha de soma pesa menos do que parece.** Em produção a conta não é feita
pelo modelo: `agregar_valores` calcula o agregado exato sobre 100% dos registros
no servidor. A aritmética à mão só aparece quando ele não chama a ferramenta — e
isso o eval de `chat_ferramentas` já mede.

**A falha do gpt-5.6-sol é de outra natureza.** Perguntado pelo total de horas
extras num relatório SEM essa coluna, ele produziu um número. Isso não é
imprecisão, é fabricação.

## chat — responder pela documentação, e calar quando ela não cobre

| modelo | acerto |
|---|---|
| `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite` | **4/4** |
| `claude-haiku-4-5`, `claude-sonnet-5`, `claude-opus-5` | **4/4** |
| `gpt-5.6-terra`, `gpt-5.6-sol` | 3/4 |

Os dois modelos OpenAI falharam no MESMO caso, e é o mais grave do conjunto:
perguntados pela alíquota do INSS com um contexto que falava só de férias, eles
responderam de memória. A regra absoluta do sistema proíbe exatamente isso, e um
percentual de INSS desatualizado dito com segurança vira erro de folha.

**Isto desqualifica a OpenAI para as finalidades voltadas ao usuário final**, e
não por margem: é comportamento categórico, repetido nos dois modelos testados.

## query_rewrite

`gemini-3.5-flash-lite`, `gemini-3.5-flash` e `gemini-3.6-flash`: **35/40 (88%)
os três**, com ZERO discordâncias em 40 casos. A reescrita não distingue modelo
— o que está em uso é tão bom quanto qualquer outro.

## O que estes números não dizem

- 37 e 10 casos não resolvem diferenças de 1 a 3 casos. Só duas conclusões aqui
  são categóricas: a invenção da OpenAI sem contexto, e a fraqueza do sonnet-5
  na escolha de ferramenta.
- Nada aqui mede fluência, tom ou formatação. Mede acerto verificável, que é o
  que o cliente compra.
- `editor_generate`, `editor_text`, `import_layout`, `import_structure` e
  `transcricao` continuam sem medição.
