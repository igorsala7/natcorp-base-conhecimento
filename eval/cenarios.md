# Cenários com contexto — 2026-08-19 23:34

36 casos remontados com histórico, tela e as ferramentas que o funil realmente entregou.

| modelo | ferramenta | pergunta | perguntou demais | de menos | tok in | US$/1k | s |
|---|---|---|---|---|---|---|---|
| `google:gemini-3.5-flash` | 18/36 (50%) | 26/36 (72%) | 0 | 10 | 5411 | 13.44 | 3.9 |
| `google:gemini-3.5-flash-lite` | 21/36 (58%) | 22/36 (61%) | 5 | 9 | 5411 | 1.78 | 0.8 |
| `anthropic:claude-haiku-4-5` | 19/36 (53%) | 26/36 (72%) | 0 | 10 | 8572 | 9.31 | 2.2 |
| `anthropic:claude-sonnet-5` | 17/36 (47%) | 28/36 (78%) | 0 | 8 | 10144 | 36.70 | 7.5 |
| `openai:gpt-5.6-terra` | 17/36 (47%) | 26/36 (72%) | 2 | 8 | 4778 | 10.98 | 2.9 |

## Falha de funil — nenhum modelo pode passar nestes

- **"quais sao os meus dados cadastrais?"** precisava de `meus_dados` — 
- **"preencha esse campo com a descrição das atividades  para o cargo de co"** precisava de `preencher_campo` — 
- **"Compara com o mês de Abril"** precisava de `historico_financeiro` — 
- **"Pode enviar"** precisava de `ms_email_enviar` — 
- **"Informe a empresa 700 e matrícula 205818"** precisava de `preencher_campo` — 
- **"Preencha pra mim, a empresa 700, matrícula 205818, situação de pedido "** precisava de `preencher_campo` — 

## Onde erraram ou discordaram

**"Crie um template de documento de contrato de admissão de contrato dete"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma)
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → (nenhuma)

**"requisição de férias"** — esperado `ferias_criar`

- ❌ `google:gemini-3.5-flash` → ferias_situacao
- ❌ `google:gemini-3.5-flash-lite` → ferias_situacao
- ❌ `anthropic:claude-haiku-4-5` → ferias_situacao
- ❌ `anthropic:claude-sonnet-5` → ferias_situacao
- ❌ `openai:gpt-5.6-terra` → ferias_situacao

**"Explique o que e o motor de blocos do editor"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → (nenhuma)
- ✅ `google:gemini-3.5-flash-lite` → (nenhuma) + perguntou
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → (nenhuma)

**"Agora gere um PPT e Word"** — esperado `gerar_relatorio`

- ❌ `google:gemini-3.5-flash` → (nenhuma)
- ✅ `google:gemini-3.5-flash-lite` → gerar_relatorio
- ✅ `anthropic:claude-haiku-4-5` → gerar_relatorio
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ✅ `openai:gpt-5.6-terra` → gerar_relatorio, gerar_relatorio

**"Olá, eu quero saber um pouco mais sobre os meus dados."** — esperado `meus_dados`

- ✅ `google:gemini-3.5-flash` → meus_dados
- ✅ `google:gemini-3.5-flash-lite` → meus_dados
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ✅ `openai:gpt-5.6-terra` → meus_dados

**"Ele está na minha equipe?"** — esperado `listar_colaboradores_resumo`

- ✅ `google:gemini-3.5-flash` → listar_colaboradores_resumo
- ✅ `google:gemini-3.5-flash-lite` → listar_colaboradores_resumo
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ✅ `openai:gpt-5.6-terra` → listar_colaboradores_resumo

**"qual o prazo para atualizar os dados enviados?"** — esperado `(nenhuma)`

- ✅ `google:gemini-3.5-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma) + perguntou
- ✅ `anthropic:claude-haiku-4-5` → (nenhuma)
- ✅ `anthropic:claude-sonnet-5` → (nenhuma)
- ✅ `openai:gpt-5.6-terra` → (nenhuma)

**"Opção 2"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → estrutura_empresas
- ❌ `google:gemini-3.5-flash-lite` → estrutura_empresas
- ❌ `anthropic:claude-haiku-4-5` → gerar_relatorio
- ✅ `anthropic:claude-sonnet-5` → (nenhuma) + perguntou
- ✅ `openai:gpt-5.6-terra` → (nenhuma) + perguntou

**"Tudo junto"** — esperado `linha_tempo`

- ❌ `google:gemini-3.5-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma) + perguntou
- ❌ `anthropic:claude-haiku-4-5` → consultar_registros
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → (nenhuma) + perguntou

**"Quando é que eu vou tirar férias?"** — esperado `consultar_ferias`

- ✅ `google:gemini-3.5-flash` → consultar_ferias
- ✅ `google:gemini-3.5-flash-lite` → consultar_ferias
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ✅ `anthropic:claude-sonnet-5` → consultar_ferias
- ❌ `openai:gpt-5.6-terra` → (nenhuma) + perguntou

**"E o Tony Oliveira?"** — esperado `informacoes_pessoais_funcionais_resumido`

- ✅ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais_resumido
- ✅ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais_resumido
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ✅ `openai:gpt-5.6-terra` → informacoes_pessoais_funcionais_resumido

**"Agora eu quero as informações do 205818"** — esperado `informacoes_pessoais_funcionais_resumido`

- ✅ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais_resumido
- ✅ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais_resumido
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ✅ `anthropic:claude-sonnet-5` → informacoes_pessoais_funcionais_resumido
- ✅ `openai:gpt-5.6-terra` → informacoes_pessoais_funcionais_resumido

**"Pode"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → ferias_situacao
- ❌ `google:gemini-3.5-flash-lite` → ferias_situacao
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → ferias_situacao

**"calcule total de horas extras para filial 97 ,  faca demonstrativo por"** — esperado `resultado_apuracao_ponto`

- ❌ `google:gemini-3.5-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → estrutura_empresas
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → (nenhuma)

**"O que seria esse evento?"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.5-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma) + perguntou
- ❌ `anthropic:claude-haiku-4-5` → destacar_tela
- ❌ `anthropic:claude-sonnet-5` → destacar_tela
- ✅ `openai:gpt-5.6-terra` → (nenhuma)

**"Faça um comparativo dos valores de benefícios do histórico financeiro "** — esperado `agrupar`

- ❌ `google:gemini-3.5-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash-lite` → meus_dados
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → consultar_registros

**"FAça a anállise dessas informações do relatório"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.5-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash-lite` → consultar_registros
- ✅ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → consultar_registros, agregar_valores
- ❌ `openai:gpt-5.6-terra` → gerar_relatorio

**"De onde você está consultando se no relatório aqui tem muito mais cola"** — esperado `consultar_registros`

- ✅ `google:gemini-3.5-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma) + perguntou
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ✅ `anthropic:claude-sonnet-5` → consultar_registros
- ❌ `openai:gpt-5.6-terra` → (nenhuma)

**"Posso acrescentar o 13° após as férias aprovadas?"** — esperado `(nenhuma)`

- ✅ `google:gemini-3.5-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma) + perguntou
- ✅ `anthropic:claude-haiku-4-5` → (nenhuma)
- ✅ `anthropic:claude-sonnet-5` → (nenhuma)
- ✅ `openai:gpt-5.6-terra` → (nenhuma)

**"Quero enviar um e-mail"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → meus_dados
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → (nenhuma)

**"crie em colunas apenas o nome, matricula , codigo desligamento e descr"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais
- ❌ `google:gemini-3.5-flash-lite` → requisicoes_req_desligamento
- ❌ `anthropic:claude-haiku-4-5` → gerar_relatorio
- ❌ `anthropic:claude-sonnet-5` → informacoes_pessoais_funcionais, estrutura_situacoes_funcion
- ❌ `openai:gpt-5.6-terra` → informacoes_pessoais_funcionais

**"Estou no portal do operador, eu tenho acesso à tudo, volte a trazer os"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash-lite` → consultar_registros
- ❌ `anthropic:claude-haiku-4-5` → consultar_registros
- ❌ `anthropic:claude-sonnet-5` → consultar_registros
- ❌ `openai:gpt-5.6-terra` → consultar_registros

**"Quero ver os eventos de apuração de ponto da matrícula 205818"** — esperado `frequencia_resultado_apuracao_detalhe` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → resultado_apuracao_ponto
- ❌ `google:gemini-3.5-flash-lite` → frequencia_resultado_apuracao_detalhe
- ❌ `anthropic:claude-haiku-4-5` → frequencia_resultado_apuracao_detalhe
- ❌ `anthropic:claude-sonnet-5` → (nenhuma) + perguntou
- ❌ `openai:gpt-5.6-terra` → (nenhuma) + perguntou

**"15 15, início 01/10 e depois 01/11 , não quero adiantar"** — esperado `ferias_validar`

- ❌ `google:gemini-3.5-flash` → ferias_opcoes
- ❌ `google:gemini-3.5-flash-lite` → ferias_opcoes
- ✅ `anthropic:claude-haiku-4-5` → ferias_validar
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → ferias_opcoes

**"Envia esse 3 arquivos para carlosalberto@natcorp.com.br"** — esperado `ms_email_enviar`

- ✅ `google:gemini-3.5-flash` → ms_email_enviar
- ✅ `google:gemini-3.5-flash-lite` → ms_email_enviar
- ✅ `anthropic:claude-haiku-4-5` → ms_email_enviar
- ❌ `anthropic:claude-sonnet-5` → (nenhuma)
- ❌ `openai:gpt-5.6-terra` → ms_arquivo_anexar

**"Qual o colaborador com maior quantidade de benefícios?"** — esperado `agrupar`

- ❌ `google:gemini-3.5-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash-lite` → consultar_beneficios
- ❌ `anthropic:claude-haiku-4-5` → consultar_beneficios
- ❌ `anthropic:claude-sonnet-5` → consultar_beneficios
- ❌ `openai:gpt-5.6-terra` → (nenhuma)

**"E quais são os colaboradores da minha equipe?"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.5-flash` → listar_colaboradores_resumo
- ❌ `google:gemini-3.5-flash-lite` → listar_colaboradores_resumo
- ❌ `anthropic:claude-haiku-4-5` → listar_colaboradores_resumo
- ❌ `anthropic:claude-sonnet-5` → listar_colaboradores_resumo
- ❌ `openai:gpt-5.6-terra` → listar_colaboradores_resumo

**"Eu quero o histórico de salários e cargos, os feedbacks, as avaliações"** — esperado `linha_tempo_fato`

- ✅ `google:gemini-3.5-flash` → linha_tempo_fato, consultar_feedback, bi_avaliacoes
- ✅ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais_resumido, linha_tempo_fato, 
- ✅ `anthropic:claude-haiku-4-5` → linha_tempo_fato, consultar_feedback, bi_avaliacoes
- ✅ `anthropic:claude-sonnet-5` → linha_tempo_fato, consultar_feedback, bi_avaliacoes
- ❌ `openai:gpt-5.6-terra` → informacoes_pessoais_funcionais_resumido

**"Me descreva um pouco mais sobre os exames que ela realizou"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → sesmt_procedimentos
- ❌ `google:gemini-3.5-flash-lite` → sesmt_procedimentos
- ❌ `anthropic:claude-haiku-4-5` → sesmt_procedimentos
- ❌ `anthropic:claude-sonnet-5` → sesmt_procedimentos
- ❌ `openai:gpt-5.6-terra` → sesmt_procedimentos

**"traga a lista completa"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma)
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `anthropic:claude-sonnet-5` → informacoes_pessoais_funcionais
- ❌ `openai:gpt-5.6-terra` → informacoes_pessoais_funcionais

**"Quais foram as marcações de ponto dele nessa semana? Me retorne os dad"** — esperado `consultar_marcacoes`

- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais
- ✅ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais, resultado_apuracao_ponto, c
- ✅ `anthropic:claude-haiku-4-5` → consultar_marcacoes, resultado_apuracao_ponto
- ✅ `anthropic:claude-sonnet-5` → consultar_marcacoes, frequencia_resultado_apuracao_detalhe
- ❌ `openai:gpt-5.6-terra` → informacoes_pessoais_funcionais

