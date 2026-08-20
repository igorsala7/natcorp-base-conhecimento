# Cenários com contexto — 2026-08-20 04:04

37 casos remontados com histórico, tela e as ferramentas que o funil realmente entregou.

| modelo | ferramenta | pergunta | perguntou demais | de menos | tok in | US$/1k | s |
|---|---|---|---|---|---|---|---|
| `anthropic:claude-fable-5` | 24/37 (65%) | 28/37 (76%) | 0 | 9 | 11413 | 135.75 | 10.4 |
| `anthropic:claude-opus-5` | 24/37 (65%) | 28/37 (76%) | 0 | 9 | 11409 | 67.96 | 7.4 |
| `anthropic:claude-opus-4-8` | 18/37 (49%) | 28/37 (76%) | 1 | 8 | 11413 | 62.76 | 4.4 |
| `anthropic:claude-opus-4-7` | 20/37 (54%) | 28/37 (76%) | 1 | 8 | 11818 | ? | 4.9 |
| `anthropic:claude-opus-4-6` | 18/37 (49%) | 26/37 (70%) | 2 | 9 | 9510 | ? | 4.5 |
| `anthropic:claude-opus-4-5` | 19/37 (51%) | 27/37 (73%) | 1 | 9 | 9509 | ? | 3.2 |
| `anthropic:claude-sonnet-5` | 21/37 (57%) | 28/37 (76%) | 0 | 9 | 11477 | 27.76 | 6.9 |
| `anthropic:claude-sonnet-4-6` | 16/37 (43%) | 29/37 (78%) | 1 | 7 | 8724 | ? | 3.7 |
| `anthropic:claude-sonnet-4-5` | 19/37 (51%) | 27/37 (73%) | 1 | 9 | 9509 | ? | 4.4 |
| `anthropic:claude-haiku-4-5` | 23/37 (62%) | 28/37 (76%) | 0 | 9 | 9509 | 10.26 | 2.2 |
| `openai:gpt-5.6-sol` | 19/37 (51%) | 28/37 (76%) | 1 | 8 | 5554 | 32.58 | 4.7 |
| `openai:gpt-5.6-terra` | 21/37 (57%) | 27/37 (73%) | 2 | 8 | 5554 | 12.70 | 2.7 |
| `openai:gpt-5.6-luna` | 21/37 (57%) | 26/37 (70%) | 2 | 9 | 5554 | 1.30 | 3.2 |
| `openai:gpt-5.5` | 23/37 (62%) | 28/37 (76%) | 2 | 7 | 5554 | 34.84 | 4.4 |
| `openai:gpt-5.2` | 23/37 (62%) | 23/37 (62%) | 10 | 4 | 5554 | 11.01 | 2.6 |
| `openai:gpt-4o` | 23/37 (62%) | 28/37 (76%) | 0 | 9 | 5544 | 14.51 | 2.0 |
| `openai:gpt-4o-mini` | 27/37 (73%) | 27/37 (73%) | 1 | 9 | 5544 | 0.88 | 2.3 |
| `openai:gpt-3.5-turbo` | 21/37 (57%) | 28/37 (76%) | 0 | 9 | 6453 | 3.33 | 4.3 |
| `google:gemini-3.6-flash` | 21/37 (57%) | 29/37 (78%) | 0 | 8 | 6227 | 14.18 | 4.6 |
| `google:gemini-3.5-flash` | 20/37 (54%) | 29/37 (78%) | 0 | 8 | 6227 | 14.61 | 3.7 |
| `google:gemini-3.5-flash-lite` | 24/37 (65%) | 26/37 (70%) | 3 | 8 | 6227 | 2.02 | 0.9 |
| `google:gemini-3.1-flash-lite` | 21/37 (57%) | 28/37 (76%) | 2 | 7 | 6227 | ? | 1.2 |
| `google:gemini-2.5-flash` | 21/37 (57%) | 28/37 (76%) | 0 | 9 | 6405 | ? | 2.5 |

## Falha de funil — nenhum modelo pode passar nestes

- **"quais sao os meus dados cadastrais?"** precisava de `meus_dados` — inequívoco — perguntar aqui é o excesso que irrita
- **"preencha esse campo com a descrição das atividades  para o cargo de co"** precisava de `preencher_campo` — DEFEITO: preencher_campo não chegou ao modelo (formAssist), e ainda gastou um turno perguntando a fonte
- **"Compara com o mês de Abril"** precisava de `historico_financeiro` — 
- **"Informe a empresa 700 e matrícula 205818"** precisava de `preencher_campo` — "informe" = PREENCHER os campos do formulário em tela, não consultar e mostrar
- **"Preencha pra mim, a empresa 700, matrícula 205818, situação de pedido "** precisava de `preencher_campo` — preencher TUDO, inclusive a justificativa — o gestor revisa antes de salvar

## Onde erraram ou discordaram

**"Crie um template de documento de contrato de admissão de contrato dete"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-fable-5` → (nenhuma)
- ❌ `anthropic:claude-opus-5` → (nenhuma)
- ❌ `anthropic:claude-opus-4-8` → (nenhuma)
- ❌ `anthropic:claude-opus-4-7` → (nenhuma)
- ❌ `anthropic:claude-opus-4-6` → (nenhuma)
- ❌ `anthropic:claude-opus-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-6` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-5` → (nenhuma)
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `openai:gpt-5.6-sol` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → (nenhuma)
- ❌ `openai:gpt-5.6-luna` → (nenhuma)
- ❌ `openai:gpt-5.5` → (nenhuma)
- ❌ `openai:gpt-5.2` → (nenhuma)
- ❌ `openai:gpt-4o` → (nenhuma)
- ❌ `openai:gpt-4o-mini` → (nenhuma)
- ❌ `openai:gpt-3.5-turbo` → ms_arquivo_anexar
- ❌ `google:gemini-3.6-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma)
- ❌ `google:gemini-3.1-flash-lite` → (nenhuma)
- ❌ `google:gemini-2.5-flash` → (nenhuma)

**"requisição de férias"** — esperado `ferias_criar`

- ❌ `anthropic:claude-fable-5` → ferias_situacao
- ❌ `anthropic:claude-opus-5` → ferias_situacao
- ❌ `anthropic:claude-opus-4-8` → ferias_situacao
- ❌ `anthropic:claude-opus-4-7` → ferias_situacao
- ❌ `anthropic:claude-opus-4-6` → ferias_situacao
- ❌ `anthropic:claude-opus-4-5` → ferias_situacao
- ❌ `anthropic:claude-sonnet-5` → ferias_situacao
- ❌ `anthropic:claude-sonnet-4-6` → ferias_situacao
- ❌ `anthropic:claude-sonnet-4-5` → ferias_situacao
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `openai:gpt-5.6-sol` → ferias_situacao
- ❌ `openai:gpt-5.6-terra` → ferias_situacao
- ❌ `openai:gpt-5.6-luna` → ferias_situacao
- ❌ `openai:gpt-5.5` → ferias_situacao
- ❌ `openai:gpt-5.2` → ferias_situacao
- ❌ `openai:gpt-4o` → ferias_situacao
- ❌ `openai:gpt-4o-mini` → ferias_situacao
- ❌ `openai:gpt-3.5-turbo` → ferias_minhas
- ❌ `google:gemini-3.6-flash` → ferias_situacao
- ❌ `google:gemini-3.5-flash` → ferias_situacao
- ❌ `google:gemini-3.5-flash-lite` → ferias_situacao
- ❌ `google:gemini-3.1-flash-lite` → ferias_situacao
- ❌ `google:gemini-2.5-flash` → ferias_situacao

**"Explique o que e o motor de blocos do editor"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-fable-5` → (nenhuma)
- ❌ `anthropic:claude-opus-5` → (nenhuma)
- ❌ `anthropic:claude-opus-4-8` → (nenhuma)
- ❌ `anthropic:claude-opus-4-7` → (nenhuma)
- ❌ `anthropic:claude-opus-4-6` → (nenhuma)
- ❌ `anthropic:claude-opus-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ✅ `anthropic:claude-sonnet-4-6` → (nenhuma) + perguntou
- ❌ `anthropic:claude-sonnet-4-5` → (nenhuma)
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `openai:gpt-5.6-sol` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → (nenhuma)
- ❌ `openai:gpt-5.6-luna` → (nenhuma)
- ❌ `openai:gpt-5.5` → (nenhuma)
- ✅ `openai:gpt-5.2` → (nenhuma) + perguntou
- ❌ `openai:gpt-4o` → (nenhuma)
- ❌ `openai:gpt-4o-mini` → (nenhuma)
- ❌ `openai:gpt-3.5-turbo` → (nenhuma)
- ❌ `google:gemini-3.6-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash` → (nenhuma)
- ✅ `google:gemini-3.5-flash-lite` → (nenhuma) + perguntou
- ❌ `google:gemini-3.1-flash-lite` → (nenhuma)
- ❌ `google:gemini-2.5-flash` → (nenhuma)

**"Agora gere um PPT e Word"** — esperado `gerar_relatorio`

- ✅ `anthropic:claude-fable-5` → gerar_relatorio, gerar_relatorio
- ✅ `anthropic:claude-opus-5` → gerar_relatorio
- ✅ `anthropic:claude-opus-4-8` → gerar_relatorio
- ❌ `anthropic:claude-opus-4-7` → (nenhuma)
- ✅ `anthropic:claude-opus-4-6` → gerar_relatorio
- ✅ `anthropic:claude-opus-4-5` → gerar_relatorio
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ✅ `anthropic:claude-sonnet-4-6` → gerar_relatorio, gerar_relatorio
- ❌ `anthropic:claude-sonnet-4-5` → (nenhuma)
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ✅ `openai:gpt-5.6-sol` → gerar_relatorio
- ✅ `openai:gpt-5.6-terra` → gerar_relatorio
- ✅ `openai:gpt-5.6-luna` → gerar_relatorio
- ✅ `openai:gpt-5.5` → gerar_relatorio, gerar_relatorio
- ❌ `openai:gpt-5.2` → (nenhuma)
- ✅ `openai:gpt-4o` → gerar_relatorio, gerar_relatorio
- ✅ `openai:gpt-4o-mini` → gerar_relatorio, montar_grafico
- ✅ `openai:gpt-3.5-turbo` → gerar_relatorio, gerar_relatorio
- ❌ `google:gemini-3.6-flash` → (nenhuma)
- ✅ `google:gemini-3.5-flash` → gerar_relatorio
- ✅ `google:gemini-3.5-flash-lite` → gerar_relatorio
- ❌ `google:gemini-3.1-flash-lite` → (nenhuma)
- ❌ `google:gemini-2.5-flash` → (nenhuma)

**"Olá, eu quero saber um pouco mais sobre os meus dados."** — esperado `meus_dados`

- ✅ `anthropic:claude-fable-5` → meus_dados
- ✅ `anthropic:claude-opus-5` → meus_dados
- ❌ `anthropic:claude-opus-4-8` → (nenhuma)
- ❌ `anthropic:claude-opus-4-7` → (nenhuma)
- ❌ `anthropic:claude-opus-4-6` → (nenhuma)
- ✅ `anthropic:claude-opus-4-5` → meus_dados
- ✅ `anthropic:claude-sonnet-5` → meus_dados
- ❌ `anthropic:claude-sonnet-4-6` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-5` → (nenhuma)
- ✅ `anthropic:claude-haiku-4-5` → meus_dados
- ✅ `openai:gpt-5.6-sol` → meus_dados
- ✅ `openai:gpt-5.6-terra` → meus_dados
- ❌ `openai:gpt-5.6-luna` → (nenhuma)
- ✅ `openai:gpt-5.5` → meus_dados
- ✅ `openai:gpt-5.2` → meus_dados
- ✅ `openai:gpt-4o` → meus_dados
- ✅ `openai:gpt-4o-mini` → meus_dados
- ✅ `openai:gpt-3.5-turbo` → meus_dados
- ✅ `google:gemini-3.6-flash` → meus_dados
- ✅ `google:gemini-3.5-flash` → meus_dados
- ✅ `google:gemini-3.5-flash-lite` → meus_dados
- ❌ `google:gemini-3.1-flash-lite` → (nenhuma)
- ✅ `google:gemini-2.5-flash` → meus_dados

**"Ele está na minha equipe?"** — esperado `listar_colaboradores_resumo`

- ✅ `anthropic:claude-fable-5` → listar_colaboradores_resumo
- ✅ `anthropic:claude-opus-5` → listar_colaboradores_resumo
- ✅ `anthropic:claude-opus-4-8` → listar_colaboradores_resumo
- ✅ `anthropic:claude-opus-4-7` → listar_colaboradores_resumo
- ❌ `anthropic:claude-opus-4-6` → (nenhuma)
- ❌ `anthropic:claude-opus-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-6` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-5` → (nenhuma)
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ✅ `openai:gpt-5.6-sol` → listar_colaboradores_resumo
- ✅ `openai:gpt-5.6-terra` → listar_colaboradores_resumo
- ✅ `openai:gpt-5.6-luna` → listar_colaboradores_resumo
- ✅ `openai:gpt-5.5` → listar_colaboradores_resumo
- ✅ `openai:gpt-5.2` → listar_colaboradores_resumo
- ✅ `openai:gpt-4o` → listar_colaboradores_resumo
- ✅ `openai:gpt-4o-mini` → listar_colaboradores_resumo
- ✅ `openai:gpt-3.5-turbo` → listar_colaboradores_resumo
- ✅ `google:gemini-3.6-flash` → listar_colaboradores_resumo
- ❌ `google:gemini-3.5-flash` → (nenhuma)
- ✅ `google:gemini-3.5-flash-lite` → listar_colaboradores_resumo
- ✅ `google:gemini-3.1-flash-lite` → listar_colaboradores_resumo
- ✅ `google:gemini-2.5-flash` → listar_colaboradores_resumo

**"qual o prazo para atualizar os dados enviados?"** — esperado `(nenhuma)`

- ✅ `anthropic:claude-fable-5` → (nenhuma)
- ✅ `anthropic:claude-opus-5` → (nenhuma)
- ✅ `anthropic:claude-opus-4-8` → (nenhuma)
- ✅ `anthropic:claude-opus-4-7` → (nenhuma)
- ✅ `anthropic:claude-opus-4-6` → (nenhuma)
- ❌ `anthropic:claude-opus-4-5` → (nenhuma) + perguntou
- ✅ `anthropic:claude-sonnet-5` → (nenhuma)
- ✅ `anthropic:claude-sonnet-4-6` → (nenhuma)
- ✅ `anthropic:claude-sonnet-4-5` → (nenhuma)
- ✅ `anthropic:claude-haiku-4-5` → (nenhuma)
- ✅ `openai:gpt-5.6-sol` → (nenhuma)
- ✅ `openai:gpt-5.6-terra` → (nenhuma)
- ✅ `openai:gpt-5.6-luna` → (nenhuma)
- ✅ `openai:gpt-5.5` → (nenhuma)
- ❌ `openai:gpt-5.2` → (nenhuma) + perguntou
- ✅ `openai:gpt-4o` → (nenhuma)
- ✅ `openai:gpt-4o-mini` → (nenhuma)
- ✅ `openai:gpt-3.5-turbo` → (nenhuma)
- ✅ `google:gemini-3.6-flash` → (nenhuma)
- ✅ `google:gemini-3.5-flash` → (nenhuma)
- ✅ `google:gemini-3.5-flash-lite` → (nenhuma)
- ✅ `google:gemini-3.1-flash-lite` → (nenhuma)
- ✅ `google:gemini-2.5-flash` → (nenhuma)

**"Opção 2"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-fable-5` → (nenhuma)
- ❌ `anthropic:claude-opus-5` → estrutura_empresas, bi_risco
- ❌ `anthropic:claude-opus-4-8` → estrutura_empresas
- ❌ `anthropic:claude-opus-4-7` → (nenhuma)
- ❌ `anthropic:claude-opus-4-6` → estrutura_empresas, bi_risco
- ❌ `anthropic:claude-opus-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-6` → estrutura_empresas
- ❌ `anthropic:claude-sonnet-4-5` → estrutura_empresas, bi_risco
- ❌ `anthropic:claude-haiku-4-5` → gerar_relatorio
- ❌ `openai:gpt-5.6-sol` → estrutura_empresas
- ❌ `openai:gpt-5.6-terra` → (nenhuma)
- ❌ `openai:gpt-5.6-luna` → (nenhuma)
- ✅ `openai:gpt-5.5` → (nenhuma) + perguntou
- ✅ `openai:gpt-5.2` → (nenhuma) + perguntou
- ❌ `openai:gpt-4o` → estrutura_empresas
- ❌ `openai:gpt-4o-mini` → (nenhuma)
- ❌ `openai:gpt-3.5-turbo` → bi_risco
- ❌ `google:gemini-3.6-flash` → estrutura_empresas
- ❌ `google:gemini-3.5-flash` → estrutura_empresas
- ❌ `google:gemini-3.5-flash-lite` → estrutura_empresas
- ❌ `google:gemini-3.1-flash-lite` → estrutura_empresas
- ❌ `google:gemini-2.5-flash` → (nenhuma)

**"Tudo junto"** — esperado `linha_tempo`

- ✅ `anthropic:claude-fable-5` → linha_tempo
- ✅ `anthropic:claude-opus-5` → linha_tempo
- ❌ `anthropic:claude-opus-4-8` → (nenhuma)
- ✅ `anthropic:claude-opus-4-7` → linha_tempo, linha_tempo, linha_tempo, linha_tempo, linha_te
- ❌ `anthropic:claude-opus-4-6` → (nenhuma) + perguntou
- ❌ `anthropic:claude-opus-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-6` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-5` → (nenhuma)
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `openai:gpt-5.6-sol` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → (nenhuma) + perguntou
- ❌ `openai:gpt-5.6-luna` → (nenhuma) + perguntou
- ❌ `openai:gpt-5.5` → (nenhuma)
- ❌ `openai:gpt-5.2` → (nenhuma) + perguntou
- ✅ `openai:gpt-4o` → linha_tempo
- ✅ `openai:gpt-4o-mini` → linha_tempo
- ✅ `openai:gpt-3.5-turbo` → linha_tempo, linha_tempo, linha_tempo, linha_tempo
- ❌ `google:gemini-3.6-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma)
- ❌ `google:gemini-3.1-flash-lite` → (nenhuma)
- ❌ `google:gemini-2.5-flash` → (nenhuma)

**"Quando é que eu vou tirar férias?"** — esperado `consultar_ferias`

- ✅ `anthropic:claude-fable-5` → consultar_ferias
- ✅ `anthropic:claude-opus-5` → consultar_ferias
- ✅ `anthropic:claude-opus-4-8` → consultar_ferias
- ❌ `anthropic:claude-opus-4-7` → (nenhuma)
- ✅ `anthropic:claude-opus-4-6` → consultar_ferias
- ✅ `anthropic:claude-opus-4-5` → consultar_ferias
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ✅ `anthropic:claude-sonnet-4-6` → consultar_ferias
- ❌ `anthropic:claude-sonnet-4-5` → (nenhuma)
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `openai:gpt-5.6-sol` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → (nenhuma)
- ❌ `openai:gpt-5.6-luna` → (nenhuma) + perguntou
- ❌ `openai:gpt-5.5` → (nenhuma) + perguntou
- ❌ `openai:gpt-5.2` → (nenhuma) + perguntou
- ✅ `openai:gpt-4o` → consultar_ferias
- ✅ `openai:gpt-4o-mini` → consultar_ferias
- ✅ `openai:gpt-3.5-turbo` → consultar_ferias
- ✅ `google:gemini-3.6-flash` → consultar_ferias
- ✅ `google:gemini-3.5-flash` → consultar_ferias
- ✅ `google:gemini-3.5-flash-lite` → consultar_ferias
- ✅ `google:gemini-3.1-flash-lite` → consultar_ferias
- ❌ `google:gemini-2.5-flash` → (nenhuma)

**"E o Tony Oliveira?"** — esperado `informacoes_pessoais_funcionais_resumido`

- ❌ `anthropic:claude-fable-5` → (nenhuma)
- ✅ `anthropic:claude-opus-5` → informacoes_pessoais_funcionais_resumido
- ❌ `anthropic:claude-opus-4-8` → (nenhuma)
- ❌ `anthropic:claude-opus-4-7` → (nenhuma)
- ❌ `anthropic:claude-opus-4-6` → (nenhuma)
- ❌ `anthropic:claude-opus-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-6` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-5` → (nenhuma)
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ✅ `openai:gpt-5.6-sol` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-5.6-terra` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-5.6-luna` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-5.5` → informacoes_pessoais_funcionais_resumido
- ❌ `openai:gpt-5.2` → (nenhuma) + perguntou
- ✅ `openai:gpt-4o` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-4o-mini` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-3.5-turbo` → informacoes_pessoais_funcionais_resumido
- ❌ `google:gemini-3.6-flash` → (nenhuma)
- ✅ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais_resumido
- ✅ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais_resumido
- ✅ `google:gemini-3.1-flash-lite` → informacoes_pessoais_funcionais_resumido
- ❌ `google:gemini-2.5-flash` → (nenhuma)

**"Agora eu quero as informações do 205818"** — esperado `informacoes_pessoais_funcionais_resumido`

- ✅ `anthropic:claude-fable-5` → informacoes_pessoais_funcionais_resumido
- ✅ `anthropic:claude-opus-5` → informacoes_pessoais_funcionais_resumido
- ❌ `anthropic:claude-opus-4-8` → (nenhuma)
- ❌ `anthropic:claude-opus-4-7` → (nenhuma)
- ❌ `anthropic:claude-opus-4-6` → (nenhuma)
- ❌ `anthropic:claude-opus-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → informacoes_pessoais_funcionais
- ❌ `anthropic:claude-sonnet-4-6` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-5` → (nenhuma)
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ✅ `openai:gpt-5.6-sol` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-5.6-terra` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-5.6-luna` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-5.5` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-5.2` → informacoes_pessoais_funcionais_resumido
- ❌ `openai:gpt-4o` → (nenhuma)
- ✅ `openai:gpt-4o-mini` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-3.5-turbo` → informacoes_pessoais_funcionais_resumido
- ✅ `google:gemini-3.6-flash` → informacoes_pessoais_funcionais_resumido
- ✅ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais_resumido
- ✅ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais_resumido
- ❌ `google:gemini-3.1-flash-lite` → (nenhuma)
- ❌ `google:gemini-2.5-flash` → (nenhuma)

**"Pode"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-fable-5` → ferias_situacao
- ❌ `anthropic:claude-opus-5` → ferias_situacao
- ❌ `anthropic:claude-opus-4-8` → ferias_criar
- ❌ `anthropic:claude-opus-4-7` → ferias_criar
- ❌ `anthropic:claude-opus-4-6` → (nenhuma)
- ❌ `anthropic:claude-opus-4-5` → ferias_criar
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-6` → ferias_situacao
- ❌ `anthropic:claude-sonnet-4-5` → (nenhuma)
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `openai:gpt-5.6-sol` → ferias_situacao
- ❌ `openai:gpt-5.6-terra` → ferias_situacao
- ❌ `openai:gpt-5.6-luna` → ferias_situacao
- ❌ `openai:gpt-5.5` → ferias_situacao
- ❌ `openai:gpt-5.2` → (nenhuma)
- ❌ `openai:gpt-4o` → ferias_criar
- ❌ `openai:gpt-4o-mini` → ferias_criar
- ❌ `openai:gpt-3.5-turbo` → ferias_validar
- ❌ `google:gemini-3.6-flash` → ferias_situacao
- ❌ `google:gemini-3.5-flash` → ferias_situacao
- ❌ `google:gemini-3.5-flash-lite` → ferias_validar
- ❌ `google:gemini-3.1-flash-lite` → (nenhuma)
- ❌ `google:gemini-2.5-flash` → ferias_criar

**"calcule total de horas extras para filial 97 ,  faca demonstrativo por"** — esperado `resultado_apuracao_ponto`

- ❌ `anthropic:claude-fable-5` → (nenhuma)
- ❌ `anthropic:claude-opus-5` → estrutura_empresas
- ❌ `anthropic:claude-opus-4-8` → estrutura_empresas
- ❌ `anthropic:claude-opus-4-7` → (nenhuma)
- ❌ `anthropic:claude-opus-4-6` → (nenhuma) + perguntou
- ❌ `anthropic:claude-opus-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → estrutura_empresas
- ❌ `anthropic:claude-sonnet-4-6` → (nenhuma) + perguntou
- ❌ `anthropic:claude-sonnet-4-5` → estrutura_empresas + perguntou
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `openai:gpt-5.6-sol` → consultar_registros
- ❌ `openai:gpt-5.6-terra` → estrutura_empresas
- ❌ `openai:gpt-5.6-luna` → estrutura_empresas
- ❌ `openai:gpt-5.5` → informacoes_pessoais_funcionais
- ❌ `openai:gpt-5.2` → (nenhuma) + perguntou
- ❌ `openai:gpt-4o` → estrutura_empresas, estrutura_filiais
- ❌ `openai:gpt-4o-mini` → (nenhuma) + perguntou
- ❌ `openai:gpt-3.5-turbo` → estrutura_filiais
- ❌ `google:gemini-3.6-flash` → estrutura_empresas
- ❌ `google:gemini-3.5-flash` → estrutura_empresas
- ❌ `google:gemini-3.5-flash-lite` → estrutura_empresas
- ❌ `google:gemini-3.1-flash-lite` → estrutura_empresas
- ❌ `google:gemini-2.5-flash` → (nenhuma)

**"O que seria esse evento?"** — esperado `(nenhuma)`

- ❌ `anthropic:claude-fable-5` → consultar_registros
- ❌ `anthropic:claude-opus-5` → consultar_registros, destacar_tela
- ❌ `anthropic:claude-opus-4-8` → destacar_tela
- ✅ `anthropic:claude-opus-4-7` → (nenhuma)
- ❌ `anthropic:claude-opus-4-6` → destacar_tela
- ✅ `anthropic:claude-opus-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → destacar_tela
- ✅ `anthropic:claude-sonnet-4-6` → (nenhuma)
- ✅ `anthropic:claude-sonnet-4-5` → (nenhuma)
- ✅ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `openai:gpt-5.6-sol` → destacar_tela
- ❌ `openai:gpt-5.6-terra` → (nenhuma) + perguntou
- ✅ `openai:gpt-5.6-luna` → (nenhuma)
- ❌ `openai:gpt-5.5` → consultar_registros
- ✅ `openai:gpt-5.2` → (nenhuma)
- ✅ `openai:gpt-4o` → (nenhuma)
- ✅ `openai:gpt-4o-mini` → (nenhuma)
- ✅ `openai:gpt-3.5-turbo` → (nenhuma)
- ❌ `google:gemini-3.6-flash` → consultar_registros, consultar_registros
- ❌ `google:gemini-3.5-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma) + perguntou
- ❌ `google:gemini-3.1-flash-lite` → (nenhuma) + perguntou
- ✅ `google:gemini-2.5-flash` → (nenhuma)

**"Pode enviar"** — esperado `(nenhuma)`

- ✅ `anthropic:claude-fable-5` → (nenhuma)
- ✅ `anthropic:claude-opus-5` → (nenhuma)
- ✅ `anthropic:claude-opus-4-8` → (nenhuma)
- ✅ `anthropic:claude-opus-4-7` → (nenhuma)
- ✅ `anthropic:claude-opus-4-6` → (nenhuma)
- ✅ `anthropic:claude-opus-4-5` → (nenhuma)
- ✅ `anthropic:claude-sonnet-5` → (nenhuma)
- ✅ `anthropic:claude-sonnet-4-6` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-5` → clicar_elemento
- ✅ `anthropic:claude-haiku-4-5` → (nenhuma)
- ✅ `openai:gpt-5.6-sol` → (nenhuma)
- ✅ `openai:gpt-5.6-terra` → (nenhuma)
- ✅ `openai:gpt-5.6-luna` → (nenhuma)
- ✅ `openai:gpt-5.5` → (nenhuma)
- ✅ `openai:gpt-5.2` → (nenhuma)
- ✅ `openai:gpt-4o` → (nenhuma)
- ✅ `openai:gpt-4o-mini` → (nenhuma)
- ❌ `openai:gpt-3.5-turbo` → clicar_elemento, clicar_elemento, clicar_elemento
- ✅ `google:gemini-3.6-flash` → (nenhuma)
- ✅ `google:gemini-3.5-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma) + perguntou
- ✅ `google:gemini-3.1-flash-lite` → (nenhuma)
- ✅ `google:gemini-2.5-flash` → (nenhuma)

**"Faça um comparativo dos valores de benefícios do histórico financeiro "** — esperado `agrupar`

- ❌ `anthropic:claude-fable-5` → (nenhuma)
- ❌ `anthropic:claude-opus-5` → (nenhuma)
- ❌ `anthropic:claude-opus-4-8` → (nenhuma)
- ❌ `anthropic:claude-opus-4-7` → (nenhuma)
- ❌ `anthropic:claude-opus-4-6` → (nenhuma)
- ❌ `anthropic:claude-opus-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-6` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-5` → consultar_registros
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `openai:gpt-5.6-sol` → (nenhuma) + perguntou
- ❌ `openai:gpt-5.6-terra` → (nenhuma)
- ❌ `openai:gpt-5.6-luna` → (nenhuma)
- ❌ `openai:gpt-5.5` → (nenhuma) + perguntou
- ❌ `openai:gpt-5.2` → (nenhuma) + perguntou
- ❌ `openai:gpt-4o` → meus_dados
- ❌ `openai:gpt-4o-mini` → (nenhuma)
- ❌ `openai:gpt-3.5-turbo` → consultar_registros, consultar_registros
- ❌ `google:gemini-3.6-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash-lite` → meus_dados
- ❌ `google:gemini-3.1-flash-lite` → (nenhuma) + perguntou
- ❌ `google:gemini-2.5-flash` → (nenhuma)

**"FAça a anállise dessas informações do relatório"** — esperado `(nenhuma)`

- ✅ `anthropic:claude-fable-5` → (nenhuma)
- ❌ `anthropic:claude-opus-5` → consultar_registros, estatisticas
- ❌ `anthropic:claude-opus-4-8` → consultar_registros, agregar_valores
- ❌ `anthropic:claude-opus-4-7` → (nenhuma) + perguntou
- ❌ `anthropic:claude-opus-4-6` → consultar_registros, consultar_registros
- ❌ `anthropic:claude-opus-4-5` → consultar_registros
- ❌ `anthropic:claude-sonnet-5` → consultar_registros, consultar_registros
- ❌ `anthropic:claude-sonnet-4-6` → consultar_registros, consultar_registros
- ❌ `anthropic:claude-sonnet-4-5` → consultar_registros, consultar_registros
- ✅ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `openai:gpt-5.6-sol` → consultar_registros, estatisticas, agregar_valores
- ❌ `openai:gpt-5.6-terra` → consultar_registros, agregar_valores
- ❌ `openai:gpt-5.6-luna` → consultar_registros, estatisticas
- ❌ `openai:gpt-5.5` → consultar_registros
- ❌ `openai:gpt-5.2` → (nenhuma) + perguntou
- ❌ `openai:gpt-4o` → consultar_registros
- ❌ `openai:gpt-4o-mini` → agregar_valores, estatisticas
- ❌ `openai:gpt-3.5-turbo` → consultar_registros
- ❌ `google:gemini-3.6-flash` → agregar_valores, agregar_valores
- ❌ `google:gemini-3.5-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash-lite` → consultar_registros
- ❌ `google:gemini-3.1-flash-lite` → consultar_registros, consultar_registros
- ✅ `google:gemini-2.5-flash` → (nenhuma)

**"De onde você está consultando se no relatório aqui tem muito mais cola"** — esperado `consultar_registros`

- ❌ `anthropic:claude-fable-5` → (nenhuma)
- ✅ `anthropic:claude-opus-5` → consultar_registros, agrupar
- ❌ `anthropic:claude-opus-4-8` → (nenhuma) + perguntou
- ❌ `anthropic:claude-opus-4-7` → (nenhuma)
- ✅ `anthropic:claude-opus-4-6` → consultar_registros
- ❌ `anthropic:claude-opus-4-5` → (nenhuma)
- ✅ `anthropic:claude-sonnet-5` → consultar_registros
- ❌ `anthropic:claude-sonnet-4-6` → (nenhuma)
- ✅ `anthropic:claude-sonnet-4-5` → consultar_registros
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `openai:gpt-5.6-sol` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → (nenhuma)
- ✅ `openai:gpt-5.6-luna` → consultar_registros
- ✅ `openai:gpt-5.5` → consultar_registros
- ✅ `openai:gpt-5.2` → consultar_registros
- ❌ `openai:gpt-4o` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-4o-mini` → consultar_registros
- ❌ `openai:gpt-3.5-turbo` → (nenhuma)
- ✅ `google:gemini-3.6-flash` → consultar_registros, consultar_registros
- ✅ `google:gemini-3.5-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais_resumido
- ❌ `google:gemini-3.1-flash-lite` → (nenhuma)
- ❌ `google:gemini-2.5-flash` → (nenhuma)

**"Posso acrescentar o 13° após as férias aprovadas?"** — esperado `(nenhuma)`

- ✅ `anthropic:claude-fable-5` → (nenhuma)
- ✅ `anthropic:claude-opus-5` → (nenhuma)
- ❌ `anthropic:claude-opus-4-8` → consultar_registros
- ✅ `anthropic:claude-opus-4-7` → (nenhuma)
- ✅ `anthropic:claude-opus-4-6` → (nenhuma)
- ✅ `anthropic:claude-opus-4-5` → (nenhuma)
- ✅ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-6` → consultar_registros
- ✅ `anthropic:claude-sonnet-4-5` → (nenhuma)
- ✅ `anthropic:claude-haiku-4-5` → (nenhuma)
- ✅ `openai:gpt-5.6-sol` → (nenhuma)
- ✅ `openai:gpt-5.6-terra` → (nenhuma)
- ✅ `openai:gpt-5.6-luna` → (nenhuma)
- ✅ `openai:gpt-5.5` → (nenhuma)
- ✅ `openai:gpt-5.2` → (nenhuma)
- ✅ `openai:gpt-4o` → (nenhuma)
- ✅ `openai:gpt-4o-mini` → (nenhuma)
- ✅ `openai:gpt-3.5-turbo` → (nenhuma)
- ✅ `google:gemini-3.6-flash` → (nenhuma)
- ✅ `google:gemini-3.5-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma) + perguntou
- ✅ `google:gemini-3.1-flash-lite` → (nenhuma)
- ✅ `google:gemini-2.5-flash` → (nenhuma)

**"Quero enviar um e-mail"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-fable-5` → (nenhuma)
- ❌ `anthropic:claude-opus-5` → (nenhuma)
- ❌ `anthropic:claude-opus-4-8` → (nenhuma)
- ❌ `anthropic:claude-opus-4-7` → (nenhuma)
- ❌ `anthropic:claude-opus-4-6` → (nenhuma)
- ❌ `anthropic:claude-opus-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-6` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-5` → (nenhuma)
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `openai:gpt-5.6-sol` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → (nenhuma)
- ❌ `openai:gpt-5.6-luna` → (nenhuma)
- ❌ `openai:gpt-5.5` → (nenhuma)
- ❌ `openai:gpt-5.2` → (nenhuma)
- ❌ `openai:gpt-4o` → (nenhuma)
- ❌ `openai:gpt-4o-mini` → (nenhuma)
- ❌ `openai:gpt-3.5-turbo` → destacar_tela, atualizar_email
- ❌ `google:gemini-3.6-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash` → meus_dados
- ❌ `google:gemini-3.5-flash-lite` → meus_dados
- ✅ `google:gemini-3.1-flash-lite` → (nenhuma) + perguntou
- ❌ `google:gemini-2.5-flash` → (nenhuma)

**"crie em colunas apenas o nome, matricula , codigo desligamento e descr"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-fable-5` → informacoes_pessoais_funcionais, estrutura_situacoes_funcion
- ❌ `anthropic:claude-opus-5` → informacoes_pessoais_funcionais
- ❌ `anthropic:claude-opus-4-8` → informacoes_pessoais_funcionais
- ❌ `anthropic:claude-opus-4-7` → montar_grafico
- ❌ `anthropic:claude-opus-4-6` → consultar_registros
- ❌ `anthropic:claude-opus-4-5` → gerar_relatorio
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-6` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-5` → gerar_relatorio
- ❌ `anthropic:claude-haiku-4-5` → gerar_relatorio
- ❌ `openai:gpt-5.6-sol` → requisicoes_req_desligamento
- ❌ `openai:gpt-5.6-terra` → informacoes_pessoais_funcionais
- ❌ `openai:gpt-5.6-luna` → informacoes_pessoais_funcionais
- ❌ `openai:gpt-5.5` → informacoes_pessoais_funcionais
- ✅ `openai:gpt-5.2` → (nenhuma) + perguntou
- ❌ `openai:gpt-4o` → estrutura_situacoes_funcionais
- ❌ `openai:gpt-4o-mini` → requisicoes_req_desligamento
- ❌ `openai:gpt-3.5-turbo` → informacoes_pessoais_funcionais, estrutura_situacoes_funcion
- ❌ `google:gemini-3.6-flash` → informacoes_pessoais_funcionais
- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais
- ❌ `google:gemini-3.5-flash-lite` → requisicoes_req_desligamento
- ❌ `google:gemini-3.1-flash-lite` → requisicoes_req_desligamento
- ❌ `google:gemini-2.5-flash` → (nenhuma)

**"Estou no portal do operador, eu tenho acesso à tudo, volte a trazer os"** — esperado `consultar_registros`

- ✅ `anthropic:claude-fable-5` → consultar_registros
- ✅ `anthropic:claude-opus-5` → consultar_registros
- ✅ `anthropic:claude-opus-4-8` → consultar_registros
- ✅ `anthropic:claude-opus-4-7` → consultar_registros
- ✅ `anthropic:claude-opus-4-6` → consultar_registros
- ✅ `anthropic:claude-opus-4-5` → consultar_registros
- ✅ `anthropic:claude-sonnet-5` → consultar_registros
- ✅ `anthropic:claude-sonnet-4-6` → consultar_registros
- ✅ `anthropic:claude-sonnet-4-5` → consultar_registros
- ✅ `anthropic:claude-haiku-4-5` → consultar_registros
- ✅ `openai:gpt-5.6-sol` → consultar_registros
- ✅ `openai:gpt-5.6-terra` → consultar_registros
- ✅ `openai:gpt-5.6-luna` → consultar_registros
- ✅ `openai:gpt-5.5` → consultar_registros
- ✅ `openai:gpt-5.2` → consultar_registros
- ✅ `openai:gpt-4o` → consultar_registros
- ✅ `openai:gpt-4o-mini` → consultar_registros
- ❌ `openai:gpt-3.5-turbo` → (nenhuma)
- ✅ `google:gemini-3.6-flash` → consultar_registros
- ✅ `google:gemini-3.5-flash` → consultar_registros
- ✅ `google:gemini-3.5-flash-lite` → consultar_registros
- ✅ `google:gemini-3.1-flash-lite` → consultar_registros
- ✅ `google:gemini-2.5-flash` → consultar_registros

**"Quero ver os eventos de apuração de ponto da matrícula 205818"** — esperado `frequencia_resultado_apuracao_detalhe` + PERGUNTAR

- ❌ `anthropic:claude-fable-5` → frequencia_resultado_apuracao_detalhe
- ❌ `anthropic:claude-opus-5` → frequencia_resultado_apuracao_detalhe
- ❌ `anthropic:claude-opus-4-8` → (nenhuma) + perguntou
- ❌ `anthropic:claude-opus-4-7` → (nenhuma) + perguntou
- ❌ `anthropic:claude-opus-4-6` → (nenhuma)
- ❌ `anthropic:claude-opus-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → frequencia_resultado_apuracao_detalhe
- ❌ `anthropic:claude-sonnet-4-6` → (nenhuma) + perguntou
- ❌ `anthropic:claude-sonnet-4-5` → frequencia_resultado_apuracao_detalhe
- ❌ `anthropic:claude-haiku-4-5` → frequencia_resultado_apuracao_detalhe
- ❌ `openai:gpt-5.6-sol` → (nenhuma) + perguntou
- ❌ `openai:gpt-5.6-terra` → (nenhuma) + perguntou
- ❌ `openai:gpt-5.6-luna` → (nenhuma)
- ❌ `openai:gpt-5.5` → (nenhuma) + perguntou
- ❌ `openai:gpt-5.2` → (nenhuma) + perguntou
- ❌ `openai:gpt-4o` → (nenhuma)
- ❌ `openai:gpt-4o-mini` → frequencia_resultado_apuracao_detalhe
- ❌ `openai:gpt-3.5-turbo` → resultado_apuracao_ponto
- ❌ `google:gemini-3.6-flash` → (nenhuma) + perguntou
- ❌ `google:gemini-3.5-flash` → (nenhuma) + perguntou
- ❌ `google:gemini-3.5-flash-lite` → frequencia_resultado_apuracao_detalhe
- ❌ `google:gemini-3.1-flash-lite` → (nenhuma) + perguntou
- ❌ `google:gemini-2.5-flash` → (nenhuma)

**"15 15, início 01/10 e depois 01/11 , não quero adiantar"** — esperado `ferias_validar`

- ❌ `anthropic:claude-fable-5` → ferias_opcoes
- ❌ `anthropic:claude-opus-5` → ferias_opcoes
- ✅ `anthropic:claude-opus-4-8` → ferias_validar
- ❌ `anthropic:claude-opus-4-7` → (nenhuma)
- ❌ `anthropic:claude-opus-4-6` → ferias_opcoes
- ❌ `anthropic:claude-opus-4-5` → ferias_opcoes
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-6` → ferias_opcoes
- ✅ `anthropic:claude-sonnet-4-5` → ferias_validar
- ✅ `anthropic:claude-haiku-4-5` → ferias_validar
- ❌ `openai:gpt-5.6-sol` → ferias_opcoes
- ❌ `openai:gpt-5.6-terra` → ferias_opcoes
- ❌ `openai:gpt-5.6-luna` → ferias_opcoes
- ❌ `openai:gpt-5.5` → ferias_opcoes
- ❌ `openai:gpt-5.2` → ferias_opcoes
- ❌ `openai:gpt-4o` → ferias_opcoes
- ❌ `openai:gpt-4o-mini` → ferias_opcoes
- ❌ `openai:gpt-3.5-turbo` → ferias_opcoes
- ❌ `google:gemini-3.6-flash` → ferias_opcoes
- ❌ `google:gemini-3.5-flash` → ferias_opcoes
- ❌ `google:gemini-3.5-flash-lite` → ferias_opcoes
- ❌ `google:gemini-3.1-flash-lite` → ferias_opcoes
- ❌ `google:gemini-2.5-flash` → (nenhuma)

**"Envia esse 3 arquivos para carlosalberto@natcorp.com.br"** — esperado `ms_email_enviar`

- ❌ `anthropic:claude-fable-5` → ms_arquivo_anexar
- ❌ `anthropic:claude-opus-5` → ms_arquivo_anexar
- ✅ `anthropic:claude-opus-4-8` → ms_email_enviar
- ✅ `anthropic:claude-opus-4-7` → ms_email_enviar
- ❌ `anthropic:claude-opus-4-6` → ms_arquivo_anexar
- ❌ `anthropic:claude-opus-4-5` → ms_arquivo_anexar
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-6` → (nenhuma)
- ✅ `anthropic:claude-sonnet-4-5` → ms_email_enviar
- ✅ `anthropic:claude-haiku-4-5` → ms_email_enviar
- ❌ `openai:gpt-5.6-sol` → ms_arquivo_anexar
- ❌ `openai:gpt-5.6-terra` → ms_arquivo_anexar
- ❌ `openai:gpt-5.6-luna` → ms_arquivo_anexar
- ✅ `openai:gpt-5.5` → ms_email_enviar
- ❌ `openai:gpt-5.2` → (nenhuma) + perguntou
- ✅ `openai:gpt-4o` → ms_email_enviar
- ✅ `openai:gpt-4o-mini` → ms_email_enviar, ms_arquivo_anexar
- ✅ `openai:gpt-3.5-turbo` → ms_email_enviar
- ✅ `google:gemini-3.6-flash` → ms_email_enviar
- ✅ `google:gemini-3.5-flash` → ms_email_enviar
- ✅ `google:gemini-3.5-flash-lite` → ms_email_enviar
- ✅ `google:gemini-3.1-flash-lite` → ms_email_enviar
- ✅ `google:gemini-2.5-flash` → ms_email_enviar

**"Qual o colaborador com maior quantidade de benefícios?"** — esperado `agrupar`

- ❌ `anthropic:claude-fable-5` → (nenhuma)
- ❌ `anthropic:claude-opus-5` → (nenhuma)
- ❌ `anthropic:claude-opus-4-8` → (nenhuma)
- ❌ `anthropic:claude-opus-4-7` → consultar_registros
- ❌ `anthropic:claude-opus-4-6` → consultar_registros
- ❌ `anthropic:claude-opus-4-5` → consultar_registros
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-6` → meus_dados
- ❌ `anthropic:claude-sonnet-4-5` → consultar_beneficios
- ❌ `anthropic:claude-haiku-4-5` → consultar_beneficios
- ❌ `openai:gpt-5.6-sol` → consultar_registros
- ❌ `openai:gpt-5.6-terra` → consultar_registros
- ❌ `openai:gpt-5.6-luna` → consultar_registros
- ✅ `openai:gpt-5.5` → agrupar
- ❌ `openai:gpt-5.2` → meus_dados
- ❌ `openai:gpt-4o` → consultar_beneficios
- ❌ `openai:gpt-4o-mini` → bi_dependentes
- ✅ `openai:gpt-3.5-turbo` → agrupar, agregar_valores
- ❌ `google:gemini-3.6-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash-lite` → pagamento_colaboradores
- ❌ `google:gemini-3.1-flash-lite` → consultar_registros
- ❌ `google:gemini-2.5-flash` → (nenhuma)

**"E quais são os colaboradores da minha equipe?"** — esperado `listar_colaboradores_resumo`

- ✅ `anthropic:claude-fable-5` → listar_colaboradores_resumo
- ✅ `anthropic:claude-opus-5` → listar_colaboradores_resumo
- ❌ `anthropic:claude-opus-4-8` → (nenhuma)
- ❌ `anthropic:claude-opus-4-7` → (nenhuma)
- ❌ `anthropic:claude-opus-4-6` → (nenhuma)
- ❌ `anthropic:claude-opus-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-6` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-5` → (nenhuma)
- ✅ `anthropic:claude-haiku-4-5` → listar_colaboradores_resumo
- ✅ `openai:gpt-5.6-sol` → listar_colaboradores_resumo
- ✅ `openai:gpt-5.6-terra` → listar_colaboradores_resumo
- ✅ `openai:gpt-5.6-luna` → listar_colaboradores_resumo
- ✅ `openai:gpt-5.5` → listar_colaboradores_resumo
- ✅ `openai:gpt-5.2` → listar_colaboradores_resumo
- ✅ `openai:gpt-4o` → listar_colaboradores_resumo
- ✅ `openai:gpt-4o-mini` → listar_colaboradores_resumo
- ✅ `openai:gpt-3.5-turbo` → listar_colaboradores_resumo, lista_opcoes
- ✅ `google:gemini-3.6-flash` → listar_colaboradores_resumo
- ✅ `google:gemini-3.5-flash` → listar_colaboradores_resumo
- ✅ `google:gemini-3.5-flash-lite` → listar_colaboradores_resumo
- ✅ `google:gemini-3.1-flash-lite` → listar_colaboradores_resumo
- ❌ `google:gemini-2.5-flash` → (nenhuma)

**"Quais são os dados do Tony Oliveira?"** — esperado `informacoes_pessoais_funcionais_resumido`

- ✅ `anthropic:claude-fable-5` → informacoes_pessoais_funcionais_resumido
- ✅ `anthropic:claude-opus-5` → informacoes_pessoais_funcionais_resumido
- ✅ `anthropic:claude-opus-4-8` → informacoes_pessoais_funcionais_resumido
- ✅ `anthropic:claude-opus-4-7` → informacoes_pessoais_funcionais_resumido
- ✅ `anthropic:claude-opus-4-6` → informacoes_pessoais_funcionais_resumido
- ✅ `anthropic:claude-opus-4-5` → informacoes_pessoais_funcionais_resumido
- ✅ `anthropic:claude-sonnet-5` → informacoes_pessoais_funcionais_resumido
- ✅ `anthropic:claude-sonnet-4-6` → informacoes_pessoais_funcionais_resumido
- ✅ `anthropic:claude-sonnet-4-5` → informacoes_pessoais_funcionais_resumido
- ✅ `anthropic:claude-haiku-4-5` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-5.6-sol` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-5.6-terra` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-5.6-luna` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-5.5` → informacoes_pessoais_funcionais_resumido
- ❌ `openai:gpt-5.2` → (nenhuma) + perguntou
- ✅ `openai:gpt-4o` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-4o-mini` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-3.5-turbo` → informacoes_pessoais_funcionais_resumido
- ✅ `google:gemini-3.6-flash` → informacoes_pessoais_funcionais_resumido
- ✅ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais_resumido
- ✅ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais_resumido
- ✅ `google:gemini-3.1-flash-lite` → informacoes_pessoais_funcionais_resumido
- ✅ `google:gemini-2.5-flash` → informacoes_pessoais_funcionais_resumido

**"Eu quero o histórico de salários e cargos, os feedbacks, as avaliações"** — esperado `linha_tempo_fato`

- ✅ `anthropic:claude-fable-5` → linha_tempo_fato, consultar_feedback, bi_avaliacoes
- ✅ `anthropic:claude-opus-5` → linha_tempo_fato, consultar_feedback, bi_avaliacoes, informa
- ✅ `anthropic:claude-opus-4-8` → linha_tempo_fato, consultar_feedback, bi_avaliacoes
- ✅ `anthropic:claude-opus-4-7` → linha_tempo_fato, consultar_feedback, bi_avaliacoes
- ✅ `anthropic:claude-opus-4-6` → linha_tempo_fato, consultar_feedback, bi_avaliacoes
- ✅ `anthropic:claude-opus-4-5` → linha_tempo_fato, consultar_feedback, bi_avaliacoes
- ✅ `anthropic:claude-sonnet-5` → linha_tempo_fato, consultar_feedback, bi_avaliacoes
- ✅ `anthropic:claude-sonnet-4-6` → linha_tempo_fato, consultar_feedback, bi_avaliacoes
- ❌ `anthropic:claude-sonnet-4-5` → informacoes_pessoais_funcionais_resumido
- ✅ `anthropic:claude-haiku-4-5` → linha_tempo_fato, consultar_feedback, bi_avaliacoes
- ✅ `openai:gpt-5.6-sol` → informacoes_pessoais_funcionais_resumido, linha_tempo_fato, 
- ✅ `openai:gpt-5.6-terra` → informacoes_pessoais_funcionais_resumido, consultar_feedback
- ✅ `openai:gpt-5.6-luna` → linha_tempo_fato, consultar_feedback, bi_avaliacoes
- ✅ `openai:gpt-5.5` → linha_tempo_fato, consultar_feedback, bi_avaliacoes
- ✅ `openai:gpt-5.2` → informacoes_pessoais_funcionais_resumido, consultar_feedback
- ✅ `openai:gpt-4o` → linha_tempo_fato, consultar_feedback, bi_avaliacoes
- ✅ `openai:gpt-4o-mini` → linha_tempo_fato, consultar_feedback, bi_avaliacoes
- ✅ `openai:gpt-3.5-turbo` → linha_tempo_fato, consultar_feedback, bi_avaliacoes
- ✅ `google:gemini-3.6-flash` → linha_tempo_fato, consultar_feedback, bi_avaliacoes, informa
- ✅ `google:gemini-3.5-flash` → linha_tempo_fato, consultar_feedback, bi_avaliacoes
- ✅ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais_resumido, linha_tempo_fato, 
- ❌ `google:gemini-3.1-flash-lite` → informacoes_pessoais_funcionais_resumido
- ❌ `google:gemini-2.5-flash` → (nenhuma)

**"Me descreva um pouco mais sobre os exames que ela realizou"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-fable-5` → sesmt_procedimentos, consultar_registros
- ❌ `anthropic:claude-opus-5` → sesmt_procedimentos, consultar_registros
- ❌ `anthropic:claude-opus-4-8` → sesmt_procedimentos
- ❌ `anthropic:claude-opus-4-7` → sesmt_procedimentos
- ❌ `anthropic:claude-opus-4-6` → consultar_registros
- ❌ `anthropic:claude-opus-4-5` → sesmt_procedimentos
- ❌ `anthropic:claude-sonnet-5` → sesmt_procedimentos
- ❌ `anthropic:claude-sonnet-4-6` → sesmt_procedimentos
- ❌ `anthropic:claude-sonnet-4-5` → sesmt_procedimentos
- ❌ `anthropic:claude-haiku-4-5` → sesmt_procedimentos
- ❌ `openai:gpt-5.6-sol` → consultar_registros, sesmt_procedimentos
- ❌ `openai:gpt-5.6-terra` → sesmt_procedimentos
- ❌ `openai:gpt-5.6-luna` → sesmt_procedimentos
- ❌ `openai:gpt-5.5` → consultar_registros
- ❌ `openai:gpt-5.2` → consultar_registros
- ❌ `openai:gpt-4o` → sesmt_procedimentos
- ❌ `openai:gpt-4o-mini` → sesmt_procedimentos
- ❌ `openai:gpt-3.5-turbo` → sesmt_procedimentos
- ❌ `google:gemini-3.6-flash` → sesmt_procedimentos
- ❌ `google:gemini-3.5-flash` → sesmt_procedimentos
- ❌ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais_resumido, sesmt_procedimento
- ❌ `google:gemini-3.1-flash-lite` → sesmt_procedimentos
- ❌ `google:gemini-2.5-flash` → sesmt_procedimentos

**"traga a lista completa"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-fable-5` → informacoes_pessoais_funcionais
- ❌ `anthropic:claude-opus-5` → informacoes_pessoais_funcionais
- ❌ `anthropic:claude-opus-4-8` → informacoes_pessoais_funcionais
- ❌ `anthropic:claude-opus-4-7` → informacoes_pessoais_funcionais
- ❌ `anthropic:claude-opus-4-6` → (nenhuma)
- ❌ `anthropic:claude-opus-4-5` → consultar_registros
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-4-6` → estrutura_empresas
- ❌ `anthropic:claude-sonnet-4-5` → (nenhuma)
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `openai:gpt-5.6-sol` → informacoes_pessoais_funcionais
- ❌ `openai:gpt-5.6-terra` → informacoes_pessoais_funcionais
- ❌ `openai:gpt-5.6-luna` → consultar_registros
- ❌ `openai:gpt-5.5` → informacoes_pessoais_funcionais
- ✅ `openai:gpt-5.2` → (nenhuma) + perguntou
- ❌ `openai:gpt-4o` → estrutura_filiais
- ❌ `openai:gpt-4o-mini` → consultar_registros
- ❌ `openai:gpt-3.5-turbo` → estrutura_filiais
- ❌ `google:gemini-3.6-flash` → informacoes_pessoais_funcionais
- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma)
- ❌ `google:gemini-3.1-flash-lite` → (nenhuma)
- ❌ `google:gemini-2.5-flash` → (nenhuma)

**"Quais foram as marcações de ponto dele nessa semana? Me retorne os dad"** — esperado `consultar_marcacoes`

- ✅ `anthropic:claude-fable-5` → consultar_marcacoes, resultado_apuracao_ponto
- ✅ `anthropic:claude-opus-5` → consultar_marcacoes, frequencia_resultado_apuracao_detalhe, 
- ✅ `anthropic:claude-opus-4-8` → consultar_marcacoes, resultado_apuracao_ponto
- ✅ `anthropic:claude-opus-4-7` → consultar_marcacoes, frequencia_resultado_apuracao_detalhe
- ❌ `anthropic:claude-opus-4-6` → (nenhuma)
- ✅ `anthropic:claude-opus-4-5` → consultar_marcacoes, frequencia_resultado_apuracao_detalhe
- ✅ `anthropic:claude-sonnet-5` → consultar_marcacoes, frequencia_resultado_apuracao_detalhe
- ❌ `anthropic:claude-sonnet-4-6` → (nenhuma)
- ✅ `anthropic:claude-sonnet-4-5` → consultar_marcacoes, resultado_apuracao_ponto
- ✅ `anthropic:claude-haiku-4-5` → consultar_marcacoes, resultado_apuracao_ponto
- ❌ `openai:gpt-5.6-sol` → informacoes_pessoais_funcionais
- ❌ `openai:gpt-5.6-terra` → informacoes_pessoais_funcionais
- ❌ `openai:gpt-5.6-luna` → informacoes_pessoais_funcionais
- ❌ `openai:gpt-5.5` → informacoes_pessoais_funcionais
- ❌ `openai:gpt-5.2` → (nenhuma) + perguntou
- ✅ `openai:gpt-4o` → consultar_marcacoes, resultado_apuracao_ponto
- ✅ `openai:gpt-4o-mini` → consultar_marcacoes, frequencia_resultado_apuracao_detalhe
- ✅ `openai:gpt-3.5-turbo` → consultar_marcacoes, resultado_apuracao_ponto
- ✅ `google:gemini-3.6-flash` → consultar_marcacoes, resultado_apuracao_ponto
- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais
- ✅ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais, consultar_marcacoes, result
- ✅ `google:gemini-3.1-flash-lite` → consultar_marcacoes, resultado_apuracao_ponto
- ✅ `google:gemini-2.5-flash` → consultar_marcacoes, resultado_apuracao_ponto

