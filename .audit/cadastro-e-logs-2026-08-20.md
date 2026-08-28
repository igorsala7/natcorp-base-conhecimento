# Auditoria do cadastro das 88 ferramentas + logs de execução — 20/08/2026

Janela real dos logs: **29/07 a 20/08/2026 (23 dias)**, não 60 — `ai_tool_runs`
não tem nada antes disso. 3.377 execuções (1.886 de ferramenta + 1.491 de
autenticação), 180 conversas, 1.392 turnos em `ai_chat_traces`.

Nada foi alterado. Só SELECT, `npm run testar:endpoints -- --base natcorp` e
~60 GET de leitura contra o ORDS. Custo de modelo: US$ 0.

## 1. O defeito de cadastro que sobrou (e não é o de máscara)

A varredura de 20/08 (12 parâmetros de data sem máscara) foi APLICADA: entre as
88 ativas restam **0** parâmetros `tipo=date` sem `mascara`. Também 0 descrições
vazias/curtas/iguais ao nome, 0 enums sem opções, 0 parâmetros de modelo sem
descrição, 0 `fixo` sem valor, 0 `identidade` sem campo.

O que a varredura antiga não olhava: **`loop.param` aponta para um parâmetro que
não existe** — 7 das 26 ferramentas com loop (27%).

| ferramenta | loop.param | existe em `params`? |
|---|---|---|
| bi_avaliacoes | data_ref | não (só empresa, matricula) |
| bi_conformidade_sesmt | data_ref | não |
| bi_contrato_gestao | data_ref | não |
| bi_risco | data_ref | não |
| consultar_cep | data_ref | não (só cep) |
| informacoes_pessoais_funcionais | matricula | não — chama-se `p_matricula` |
| informacoes_pessoais_funcionais_resumido | matricula | não — chama-se `p_matricula` |

`tool-builder.ts:1034` faz `{...a, [loop.param]: iso}` e `resolveParams` descarta
a chave por não achar o parâmetro. Resultado: **N requisições HTTP idênticas**,
agregadas numa tabela com coluna "Competência" em que todos os meses trazem a
mesma linha.

Provas:
- `bi_avaliacoes`: 149 execuções OK → **7 URLs distintas**; 20 falhas → **1 URL
  repetida 20×**. Pior turno: **48 requisições idênticas**.
- `buildModelSchema` de `consultar_cep` exige `periodo_ini` (obrigatório) — é
  preciso informar um mês para consultar um CEP. Nunca foi chamada em 23 dias.
- `data_ref` nem é aceito pelo ORDS: `bi/v1/avaliacoes?matricula=205818` e
  `...&data_ref=2026-08` devolvem o mesmo registro. O loop não tem conserto por
  adição de parâmetro — tem por remoção.

## 2. `periodo` das requisições: filtro que não filtra

```
req_desligamento periodo=2026  → ids [57715,57714,57707,57704] datas 2026-07…
req_desligamento periodo=2025  → ids [57715,57714,57707,57704] datas 2026-07…
req_desligamento periodo=2020  → ids [57715,57714,57707,57704] datas 2026-07…
```
Idem `req_vaga` e `req_alt_func` (4 valores testados, mesma página).
`req_alt_func` ainda EXIGE o parâmetro presente e numérico (`periodo=` → 0
itens; `periodo=xyz` → erro) — exige e ignora.

A descrição no cadastro diz "Período (AAAA-MM)". O agente que receber "requisições
de desligamento de 2025" devolve dados de 2026 apresentados como 2025.

`req_ferias` e `req_pessoal` têm o mesmo parâmetro e **não foram provados** — a
empresa 700 não tem registro nenhum neles.

## 3. Endpoints quebrados no servidor

- `sesmt_procedimentos` — **8/8 falhas** em produção. Com qualquer combinação de
  parâmetros, e mesmo SEM parâmetro nenhum:
  `ORA-06553: PLS-306: número incorreto de tipos de argumentos na chamada para
  'FNCT_NOME_MEDICO'`. É PL/SQL do ORDS, não cadastro.
- `pagamento_dados_colab` — HTTP 401 `{"status":"ERROR","message":"Acesso Negado."}`.
- `bi/v1/*` recusa lista de matrículas: `matricula=205818,477,777803` →
  `ORA-01722: número inválido`; uma matrícula sozinha funciona. Foi assim que as
  20 falhas de `bi_avaliacoes` aconteceram.

## 4. Semelhança de descrição NÃO prevê erro

3.828 pares ativos com embedding.

| par | sim | posição | erro medido |
|---|---|---|---|
| bi_treinamento_qualitativo × quantitativo | 0,915 | #1 | nenhum — **as duas nunca foram chamadas** |
| requisicoes_exames_cand × colab | 0,901 | #2 | nenhum — as duas nunca chamadas |
| historico_financeiro × relatorio_recibo_pagamento | 0,790 | **#81** | 2 erros no gabarito |
| linha_tempo × listar_colaboradores_resumo | 0,725 | **#364** | 1 erro no gabarito |

p50 = 0,638 · p99 = 0,822 · piso do top-25 = 0,836.

Dos 25 pares mais parecidos, **18 têm ao menos uma ferramenta nunca chamada** e 6
têm as duas mortas. Um corte por similaridade pegaria 0 dos 2 erros conhecidos.

## 5. Repetição: o parâmetro é sempre `data_ref`

Excluindo a conversa `e72d1f3b…` (669 chamadas de `consultar_ferias` em 2h37 —
sessão de carga, distorce tudo): **1.095 chamadas, 293 redundantes (27%)** em 108
grupos (mesma conversa + mesma URL).

| ferramenta | pior turno | o que variava no input | chegava na URL? |
|---|---|---|---|
| bi_avaliacoes | 48× | data_ref 1996-06 → 2000-05 | não |
| consultar_ferias | 73× (×9 matrículas) | data_ref 2023-01 → 2025-01 | não |
| bi_dados_cadastrais | 21× | data_ref 2025-01 → 2026-08 | não |

Não é o modelo tentando e errando parâmetro — é o loop do servidor. O guard
anti-repetição do modelo (`tool-builder.ts:829`) não cobre isso porque o loop
chama `runOnce` por dentro.

## 6. Latência

Turno: p50 **14,0 s** · p90 33,0 s · p99 83,2 s · máx 150,5 s.

| ferramenta | n | p50 | p95 | soma | payload médio |
|---|---|---|---|---|---|
| informacoes_pessoais_funcionais | 70 | 2,2 s | **15,0 s (timeout)** | 404,7 s | **110,6 KB** |
| historico_financeiro | 33 | 5,2 s | 10,5 s | 178,4 s | — |
| listar_colaboradores_resumo | 25 | 5,1 s | 5,8 s | 84,6 s | — |

`informacoes_pessoais_funcionais`: 14/70 falhas (20%), 7 delas por estouro dos
15 s. 6,2 MB de payload em 23 dias (~1,5 M tokens) numa ferramenta cuja própria
descrição manda preferir a `_resumido`.

Desperdício de autenticação: `_oauth/token (body)` **137/137 = 401** nas 8 bases,
antes de cair para `(basic)` que acerta 181/181. `styleMemo` é de processo e
reinicia. Mediana 267 ms, máx 7,7 s por token novo.

## 7. As 45 nunca chamadas

13 são de ESCRITA (POST/PATCH/DELETE) — não disparar em 23 dias é o esperado.
3 são `ms_*` de leitura, que exigem conta pessoal conectada.
Sobram 29 GET de base. Destas, **inalcançáveis por defeito provado**:

| ferramenta | por quê |
|---|---|
| consultar_cep | schema exige `periodo_ini` (mês) para consultar um CEP |
| bi_risco | exige `agrupamento` + `empresa` + `periodo_ini` fantasma |
| bi_conformidade_sesmt | idem |
| bi_contrato_gestao | exige `periodo_ini` fantasma — o endpoint responde 25 itens quando chamado direto |
| pagamento_dados_colab | HTTP 401 |

As outras 24 têm cadastro sadio e gêmea viva do mesmo assunto absorvendo a
demanda. Não são problema.
