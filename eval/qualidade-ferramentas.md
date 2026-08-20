# Cenários com contexto — 2026-08-20 02:15

37 casos remontados com histórico, tela e as ferramentas que o funil realmente entregou.

| modelo | ferramenta | pergunta | perguntou demais | de menos | tok in | US$/1k | s |
|---|---|---|---|---|---|---|---|
| `anthropic:claude-haiku-4-5` | 22/37 (59%) | 28/37 (76%) | 0 | 9 | 9509 | 10.21 | 2.2 |
| `anthropic:claude-sonnet-5` | 19/37 (51%) | 28/37 (76%) | 0 | 9 | 11477 | 27.32 | 6.9 |
| `anthropic:claude-opus-5` | 24/37 (65%) | 28/37 (76%) | 0 | 9 | 11409 | 68.02 | 7.5 |
| `google:gemini-3.6-flash` | 21/37 (57%) | 29/37 (78%) | 0 | 8 | 6227 | 14.23 | 4.6 |
| `google:gemini-3.5-flash` | 19/37 (51%) | 29/37 (78%) | 0 | 8 | 6227 | 14.85 | 3.9 |
| `google:gemini-3.5-flash-lite` | 23/37 (62%) | 25/37 (68%) | 3 | 9 | 6227 | 2.03 | 0.9 |
| `openai:gpt-5.6-terra` | 22/37 (59%) | 27/37 (73%) | 2 | 8 | 5554 | 12.48 | 2.9 |
| `openai:gpt-5.6-sol` | 22/37 (59%) | 29/37 (78%) | 2 | 6 | 5554 | 31.74 | 3.8 |

## Falha de funil — nenhum modelo pode passar nestes

- **"quais sao os meus dados cadastrais?"** precisava de `meus_dados` — inequívoco — perguntar aqui é o excesso que irrita
- **"preencha esse campo com a descrição das atividades  para o cargo de co"** precisava de `preencher_campo` — DEFEITO: preencher_campo não chegou ao modelo (formAssist), e ainda gastou um turno perguntando a fonte
- **"Compara com o mês de Abril"** precisava de `historico_financeiro` — 
- **"Informe a empresa 700 e matrícula 205818"** precisava de `preencher_campo` — "informe" = PREENCHER os campos do formulário em tela, não consultar e mostrar
- **"Preencha pra mim, a empresa 700, matrícula 205818, situação de pedido "** precisava de `preencher_campo` — preencher TUDO, inclusive a justificativa — o gestor revisa antes de salvar

## Onde erraram ou discordaram

**"Crie um template de documento de contrato de admissão de contrato dete"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-opus-5` → (nenhuma)
- ❌ `google:gemini-3.6-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → (nenhuma)
- ✅ `openai:gpt-5.6-sol` → (nenhuma) + perguntou

**"requisição de férias"** — esperado `ferias_criar`

- ❌ `anthropic:claude-haiku-4-5` → ferias_situacao
- ❌ `anthropic:claude-sonnet-5` → ferias_situacao
- ❌ `anthropic:claude-opus-5` → ferias_situacao
- ❌ `google:gemini-3.6-flash` → ferias_situacao
- ❌ `google:gemini-3.5-flash` → ferias_situacao
- ❌ `google:gemini-3.5-flash-lite` → ferias_situacao
- ❌ `openai:gpt-5.6-terra` → ferias_situacao
- ❌ `openai:gpt-5.6-sol` → ferias_situacao

**"Explique o que e o motor de blocos do editor"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-opus-5` → (nenhuma)
- ❌ `google:gemini-3.6-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → (nenhuma)
- ❌ `openai:gpt-5.6-sol` → (nenhuma)

**"Agora gere um PPT e Word"** — esperado `gerar_relatorio`

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ✅ `anthropic:claude-opus-5` → gerar_relatorio, gerar_relatorio
- ✅ `google:gemini-3.6-flash` → gerar_relatorio
- ❌ `google:gemini-3.5-flash` → (nenhuma)
- ✅ `google:gemini-3.5-flash-lite` → gerar_relatorio
- ✅ `openai:gpt-5.6-terra` → gerar_relatorio
- ✅ `openai:gpt-5.6-sol` → gerar_relatorio

**"Olá, eu quero saber um pouco mais sobre os meus dados."** — esperado `meus_dados`

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ✅ `anthropic:claude-opus-5` → meus_dados
- ✅ `google:gemini-3.6-flash` → meus_dados
- ✅ `google:gemini-3.5-flash` → meus_dados
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma)
- ✅ `openai:gpt-5.6-terra` → meus_dados
- ✅ `openai:gpt-5.6-sol` → meus_dados

**"Ele está na minha equipe?"** — esperado `listar_colaboradores_resumo`

- ✅ `anthropic:claude-haiku-4-5` → listar_colaboradores_resumo
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ✅ `anthropic:claude-opus-5` → listar_colaboradores_resumo
- ✅ `google:gemini-3.6-flash` → listar_colaboradores_resumo
- ✅ `google:gemini-3.5-flash` → listar_colaboradores_resumo
- ✅ `google:gemini-3.5-flash-lite` → listar_colaboradores_resumo
- ✅ `openai:gpt-5.6-terra` → listar_colaboradores_resumo
- ✅ `openai:gpt-5.6-sol` → listar_colaboradores_resumo

**"Opção 2"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-haiku-4-5` → gerar_relatorio
- ❌ `anthropic:claude-sonnet-5` → estrutura_empresas
- ❌ `anthropic:claude-opus-5` → estrutura_empresas, bi_risco, bi_conformidade_sesmt
- ❌ `google:gemini-3.6-flash` → estrutura_empresas
- ❌ `google:gemini-3.5-flash` → estrutura_empresas
- ❌ `google:gemini-3.5-flash-lite` → estrutura_empresas
- ❌ `openai:gpt-5.6-terra` → (nenhuma)
- ✅ `openai:gpt-5.6-sol` → (nenhuma) + perguntou

**"Tudo junto"** — esperado `linha_tempo`

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ✅ `anthropic:claude-opus-5` → linha_tempo
- ❌ `google:gemini-3.6-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → (nenhuma)
- ❌ `openai:gpt-5.6-sol` → (nenhuma) + perguntou

**"Quando é que eu vou tirar férias?"** — esperado `consultar_ferias`

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ✅ `anthropic:claude-opus-5` → consultar_ferias
- ✅ `google:gemini-3.6-flash` → consultar_ferias
- ✅ `google:gemini-3.5-flash` → consultar_ferias
- ✅ `google:gemini-3.5-flash-lite` → consultar_ferias
- ❌ `openai:gpt-5.6-terra` → (nenhuma) + perguntou
- ❌ `openai:gpt-5.6-sol` → (nenhuma) + perguntou

**"E o Tony Oliveira?"** — esperado `informacoes_pessoais_funcionais_resumido`

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ✅ `anthropic:claude-opus-5` → informacoes_pessoais_funcionais_resumido
- ❌ `google:gemini-3.6-flash` → (nenhuma)
- ✅ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais_resumido
- ✅ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-5.6-terra` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-5.6-sol` → informacoes_pessoais_funcionais_resumido

**"Agora eu quero as informações do 205818"** — esperado `informacoes_pessoais_funcionais_resumido`

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → informacoes_pessoais_funcionais
- ✅ `anthropic:claude-opus-5` → informacoes_pessoais_funcionais_resumido
- ✅ `google:gemini-3.6-flash` → informacoes_pessoais_funcionais_resumido
- ✅ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais_resumido
- ✅ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-5.6-terra` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-5.6-sol` → informacoes_pessoais_funcionais_resumido

**"Pode"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-haiku-4-5` → ferias_criar
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-opus-5` → ferias_situacao
- ❌ `google:gemini-3.6-flash` → ferias_situacao
- ❌ `google:gemini-3.5-flash` → ferias_situacao
- ❌ `google:gemini-3.5-flash-lite` → ferias_situacao
- ❌ `openai:gpt-5.6-terra` → ferias_situacao
- ❌ `openai:gpt-5.6-sol` → ferias_situacao

**"calcule total de horas extras para filial 97 ,  faca demonstrativo por"** — esperado `resultado_apuracao_ponto`

- ❌ `anthropic:claude-haiku-4-5` → estrutura_empresas
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-opus-5` → estrutura_empresas
- ❌ `google:gemini-3.6-flash` → estrutura_empresas
- ❌ `google:gemini-3.5-flash` → estrutura_empresas
- ❌ `google:gemini-3.5-flash-lite` → estrutura_empresas
- ❌ `openai:gpt-5.6-terra` → (nenhuma) + perguntou
- ❌ `openai:gpt-5.6-sol` → consultar_registros

**"O que seria esse evento?"** — esperado `(nenhuma)`

- ✅ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → destacar_tela
- ❌ `anthropic:claude-opus-5` → consultar_registros, meus_dados
- ❌ `google:gemini-3.6-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma) + perguntou
- ✅ `openai:gpt-5.6-terra` → (nenhuma)
- ❌ `openai:gpt-5.6-sol` → destacar_tela

**"Pode enviar"** — esperado `(nenhuma)`

- ✅ `anthropic:claude-haiku-4-5` → (nenhuma)
- ✅ `anthropic:claude-sonnet-5` → (nenhuma)
- ✅ `anthropic:claude-opus-5` → (nenhuma)
- ✅ `google:gemini-3.6-flash` → (nenhuma)
- ✅ `google:gemini-3.5-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma) + perguntou
- ✅ `openai:gpt-5.6-terra` → (nenhuma)
- ✅ `openai:gpt-5.6-sol` → (nenhuma)

**"Faça um comparativo dos valores de benefícios do histórico financeiro "** — esperado `agrupar`

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-opus-5` → (nenhuma)
- ❌ `google:gemini-3.6-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → meus_dados
- ❌ `openai:gpt-5.6-terra` → (nenhuma)
- ❌ `openai:gpt-5.6-sol` → consultar_registros, buscar_no_sistema

**"FAça a anállise dessas informações do relatório"** — esperado `(nenhuma)`

- ✅ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → consultar_registros, agregar_valores
- ❌ `anthropic:claude-opus-5` → consultar_registros, agregar_valores
- ❌ `google:gemini-3.6-flash` → agregar_valores, agregar_valores
- ❌ `google:gemini-3.5-flash` → consultar_registros, consultar_registros
- ❌ `google:gemini-3.5-flash-lite` → consultar_registros
- ❌ `openai:gpt-5.6-terra` → consultar_registros
- ❌ `openai:gpt-5.6-sol` → consultar_registros, agregar_valores, estatisticas

**"De onde você está consultando se no relatório aqui tem muito mais cola"** — esperado `consultar_registros`

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ✅ `anthropic:claude-opus-5` → consultar_registros, agrupar
- ✅ `google:gemini-3.6-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash` → agrupar
- ❌ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-5.6-terra` → consultar_registros
- ✅ `openai:gpt-5.6-sol` → consultar_registros

**"Posso acrescentar o 13° após as férias aprovadas?"** — esperado `(nenhuma)`

- ✅ `anthropic:claude-haiku-4-5` → (nenhuma)
- ✅ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-opus-5` → consultar_registros
- ✅ `google:gemini-3.6-flash` → (nenhuma)
- ✅ `google:gemini-3.5-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma) + perguntou
- ✅ `openai:gpt-5.6-terra` → (nenhuma)
- ✅ `openai:gpt-5.6-sol` → (nenhuma)

**"Quero enviar um e-mail"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-opus-5` → (nenhuma)
- ✅ `google:gemini-3.6-flash` → (nenhuma) + perguntou
- ❌ `google:gemini-3.5-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → meus_dados
- ❌ `openai:gpt-5.6-terra` → (nenhuma)
- ❌ `openai:gpt-5.6-sol` → (nenhuma)

**"crie em colunas apenas o nome, matricula , codigo desligamento e descr"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-haiku-4-5` → informacoes_pessoais_funcionais
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-opus-5` → informacoes_pessoais_funcionais
- ❌ `google:gemini-3.6-flash` → informacoes_pessoais_funcionais
- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais
- ❌ `google:gemini-3.5-flash-lite` → requisicoes_req_desligamento
- ❌ `openai:gpt-5.6-terra` → (nenhuma)
- ❌ `openai:gpt-5.6-sol` → informacoes_pessoais_funcionais

**"Quero ver os eventos de apuração de ponto da matrícula 205818"** — esperado `frequencia_resultado_apuracao_detalhe` + PERGUNTAR

- ❌ `anthropic:claude-haiku-4-5` → frequencia_resultado_apuracao_detalhe
- ❌ `anthropic:claude-sonnet-5` → frequencia_resultado_apuracao_detalhe
- ❌ `anthropic:claude-opus-5` → frequencia_resultado_apuracao_detalhe
- ❌ `google:gemini-3.6-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash` → (nenhuma) + perguntou
- ❌ `google:gemini-3.5-flash-lite` → frequencia_resultado_apuracao_detalhe
- ❌ `openai:gpt-5.6-terra` → (nenhuma) + perguntou
- ❌ `openai:gpt-5.6-sol` → (nenhuma) + perguntou

**"15 15, início 01/10 e depois 01/11 , não quero adiantar"** — esperado `ferias_validar`

- ✅ `anthropic:claude-haiku-4-5` → ferias_validar
- ✅ `anthropic:claude-sonnet-5` → ferias_opcoes, ferias_validar
- ❌ `anthropic:claude-opus-5` → ferias_opcoes
- ❌ `google:gemini-3.6-flash` → ferias_opcoes
- ❌ `google:gemini-3.5-flash` → ferias_opcoes
- ❌ `google:gemini-3.5-flash-lite` → ferias_opcoes
- ❌ `openai:gpt-5.6-terra` → ferias_opcoes
- ❌ `openai:gpt-5.6-sol` → ferias_opcoes

**"Envia esse 3 arquivos para carlosalberto@natcorp.com.br"** — esperado `ms_email_enviar`

- ✅ `anthropic:claude-haiku-4-5` → ms_email_enviar
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ✅ `anthropic:claude-opus-5` → ms_email_enviar
- ✅ `google:gemini-3.6-flash` → ms_email_enviar
- ❌ `google:gemini-3.5-flash` → (nenhuma)
- ✅ `google:gemini-3.5-flash-lite` → ms_email_enviar
- ❌ `openai:gpt-5.6-terra` → ms_arquivo_anexar
- ❌ `openai:gpt-5.6-sol` → ms_arquivo_anexar

**"Qual o colaborador com maior quantidade de benefícios?"** — esperado `agrupar`

- ❌ `anthropic:claude-haiku-4-5` → consultar_beneficios
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `anthropic:claude-opus-5` → consultar_registros
- ❌ `google:gemini-3.6-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → pagamento_colaboradores, pagamento_colaboradores
- ❌ `openai:gpt-5.6-terra` → (nenhuma)
- ✅ `openai:gpt-5.6-sol` → agrupar

**"Eu quero o histórico de salários e cargos, os feedbacks, as avaliações"** — esperado `linha_tempo_fato`

- ✅ `anthropic:claude-haiku-4-5` → linha_tempo_fato, consultar_feedback, bi_avaliacoes
- ✅ `anthropic:claude-sonnet-5` → linha_tempo_fato, consultar_feedback, bi_avaliacoes
- ✅ `anthropic:claude-opus-5` → linha_tempo_fato, consultar_feedback, bi_avaliacoes, informa
- ✅ `google:gemini-3.6-flash` → linha_tempo_fato, consultar_feedback, bi_avaliacoes
- ✅ `google:gemini-3.5-flash` → linha_tempo_fato, consultar_feedback, bi_avaliacoes
- ✅ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais_resumido, linha_tempo_fato, 
- ❌ `openai:gpt-5.6-terra` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-5.6-sol` → linha_tempo_fato, consultar_feedback, bi_avaliacoes, informa

**"Me descreva um pouco mais sobre os exames que ela realizou"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-haiku-4-5` → sesmt_procedimentos
- ❌ `anthropic:claude-sonnet-5` → sesmt_procedimentos
- ❌ `anthropic:claude-opus-5` → sesmt_procedimentos, bi_medicina, consultar_registros
- ❌ `google:gemini-3.6-flash` → sesmt_procedimentos, consultar_registros
- ❌ `google:gemini-3.5-flash` → sesmt_procedimentos
- ❌ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais_resumido, sesmt_procedimento
- ❌ `openai:gpt-5.6-terra` → sesmt_procedimentos
- ❌ `openai:gpt-5.6-sol` → consultar_registros

**"traga a lista completa"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → informacoes_pessoais_funcionais
- ❌ `anthropic:claude-opus-5` → informacoes_pessoais_funcionais
- ❌ `google:gemini-3.6-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → informacoes_pessoais_funcionais
- ❌ `openai:gpt-5.6-sol` → informacoes_pessoais_funcionais

**"Quais foram as marcações de ponto dele nessa semana? Me retorne os dad"** — esperado `consultar_marcacoes`

- ✅ `anthropic:claude-haiku-4-5` → consultar_marcacoes, resultado_apuracao_ponto
- ✅ `anthropic:claude-sonnet-5` → consultar_marcacoes, frequencia_resultado_apuracao_detalhe
- ✅ `anthropic:claude-opus-5` → consultar_marcacoes, frequencia_resultado_apuracao_detalhe, 
- ❌ `google:gemini-3.6-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais
- ✅ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais, resultado_apuracao_ponto, c
- ❌ `openai:gpt-5.6-terra` → informacoes_pessoais_funcionais
- ❌ `openai:gpt-5.6-sol` → informacoes_pessoais_funcionais

