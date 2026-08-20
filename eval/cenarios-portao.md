# Cenários com contexto — 2026-08-20 00:14

37 casos remontados com histórico, tela e as ferramentas que o funil realmente entregou.

| modelo | ferramenta | pergunta | perguntou demais | de menos | tok in | US$/1k | s |
|---|---|---|---|---|---|---|---|
| `google:gemini-3.5-flash` | 22/37 (59%) | 26/37 (70%) | 4 | 7 | 5269 | 12.74 | 3.3 |
| `google:gemini-3.5-flash-lite` | 20/37 (54%) | 22/37 (59%) | 6 | 9 | 5269 | 1.75 | 0.8 |
| `anthropic:claude-haiku-4-5` | 20/37 (54%) | 24/37 (65%) | 4 | 9 | 8000 | 8.62 | 1.9 |

## Falha de funil — nenhum modelo pode passar nestes

- **"quais sao os meus dados cadastrais?"** precisava de `meus_dados` — inequívoco — perguntar aqui é o excesso que irrita
- **"preencha esse campo com a descrição das atividades  para o cargo de co"** precisava de `preencher_campo` — DEFEITO: preencher_campo não chegou ao modelo (formAssist), e ainda gastou um turno perguntando a fonte
- **"Compara com o mês de Abril"** precisava de `historico_financeiro` — 
- **"Informe a empresa 700 e matrícula 205818"** precisava de `preencher_campo` — "informe" = PREENCHER os campos do formulário em tela, não consultar e mostrar
- **"Preencha pra mim, a empresa 700, matrícula 205818, situação de pedido "** precisava de `preencher_campo` — preencher TUDO, inclusive a justificativa — o gestor revisa antes de salvar

## Onde erraram ou discordaram

**"Crie um template de documento de contrato de admissão de contrato dete"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma)
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)

**"requisição de férias"** — esperado `ferias_criar`

- ❌ `google:gemini-3.5-flash` → (nenhuma) + perguntou
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma) + perguntou
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma) + perguntou

**"Explique o que e o motor de blocos do editor"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma)
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)

**"Agora gere um PPT e Word"** — esperado `gerar_relatorio`

- ❌ `google:gemini-3.5-flash` → (nenhuma) + perguntou
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma) + perguntou
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma) + perguntou

**"Olá, eu quero saber um pouco mais sobre os meus dados."** — esperado `meus_dados`

- ✅ `google:gemini-3.5-flash` → meus_dados
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma)
- ✅ `anthropic:claude-haiku-4-5` → meus_dados

**"Ele está na minha equipe?"** — esperado `listar_colaboradores_resumo`

- ✅ `google:gemini-3.5-flash` → listar_colaboradores_resumo
- ✅ `google:gemini-3.5-flash-lite` → listar_colaboradores_resumo
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)

**"Opção 2"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → estrutura_empresas
- ❌ `google:gemini-3.5-flash-lite` → estrutura_empresas
- ❌ `anthropic:claude-haiku-4-5` → gerar_relatorio

**"Tudo junto"** — esperado `linha_tempo`

- ❌ `google:gemini-3.5-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma)
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)

**"Quando é que eu vou tirar férias?"** — esperado `consultar_ferias`

- ✅ `google:gemini-3.5-flash` → consultar_ferias
- ✅ `google:gemini-3.5-flash-lite` → consultar_ferias
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)

**"E o Tony Oliveira?"** — esperado `informacoes_pessoais_funcionais_resumido`

- ✅ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais_resumido
- ✅ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais_resumido
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)

**"Agora eu quero as informações do 205818"** — esperado `informacoes_pessoais_funcionais_resumido`

- ✅ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais_resumido
- ✅ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais_resumido
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)

**"Pode"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → ferias_situacao
- ❌ `google:gemini-3.5-flash-lite` → ferias_situacao
- ❌ `anthropic:claude-haiku-4-5` → ferias_criar

**"calcule total de horas extras para filial 97 ,  faca demonstrativo por"** — esperado `resultado_apuracao_ponto`

- ❌ `google:gemini-3.5-flash` → (nenhuma) + perguntou
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma) + perguntou
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma) + perguntou

**"O que seria esse evento?"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.5-flash` → (nenhuma) + perguntou
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma) + perguntou
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma) + perguntou

**"Pode enviar"** — esperado `(nenhuma)`

- ✅ `google:gemini-3.5-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma) + perguntou
- ✅ `anthropic:claude-haiku-4-5` → (nenhuma)

**"Faça um comparativo dos valores de benefícios do histórico financeiro "** — esperado `agrupar`

- ❌ `google:gemini-3.5-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash-lite` → meus_dados
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)

**"FAça a anállise dessas informações do relatório"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.5-flash` → agregar_valores
- ❌ `google:gemini-3.5-flash-lite` → consultar_registros
- ❌ `anthropic:claude-haiku-4-5` → destacar_tela, estatisticas, agregar_valores

**"De onde você está consultando se no relatório aqui tem muito mais cola"** — esperado `consultar_registros`

- ✅ `google:gemini-3.5-flash` → consultar_registros, consultar_registros
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma)
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)

**"Posso acrescentar o 13° após as férias aprovadas?"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.5-flash` → consultar_registros
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma) + perguntou
- ✅ `anthropic:claude-haiku-4-5` → (nenhuma)

**"Quero enviar um e-mail"** — esperado `(nenhuma)` + PERGUNTAR

- ✅ `google:gemini-3.5-flash` → (nenhuma) + perguntou
- ❌ `google:gemini-3.5-flash-lite` → meus_dados
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)

**"crie em colunas apenas o nome, matricula , codigo desligamento e descr"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais
- ❌ `google:gemini-3.5-flash-lite` → requisicoes_req_desligamento
- ❌ `anthropic:claude-haiku-4-5` → informacoes_pessoais_funcionais

**"Quero ver os eventos de apuração de ponto da matrícula 205818"** — esperado `frequencia_resultado_apuracao_detalhe` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → (nenhuma) + perguntou
- ❌ `google:gemini-3.5-flash-lite` → frequencia_resultado_apuracao_detalhe
- ❌ `anthropic:claude-haiku-4-5` → frequencia_resultado_apuracao_detalhe

**"15 15, início 01/10 e depois 01/11 , não quero adiantar"** — esperado `ferias_validar`

- ❌ `google:gemini-3.5-flash` → ferias_opcoes
- ❌ `google:gemini-3.5-flash-lite` → ferias_opcoes
- ✅ `anthropic:claude-haiku-4-5` → ferias_validar

**"Qual o colaborador com maior quantidade de benefícios?"** — esperado `agrupar`

- ❌ `google:gemini-3.5-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → pagamento_colaboradores, pagamento_colaboradores
- ❌ `anthropic:claude-haiku-4-5` → consultar_beneficios

**"E quais são os colaboradores da minha equipe?"** — esperado `listar_colaboradores_resumo`

- ✅ `google:gemini-3.5-flash` → listar_colaboradores_resumo
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma)
- ✅ `anthropic:claude-haiku-4-5` → listar_colaboradores_resumo

**"Me descreva um pouco mais sobre os exames que ela realizou"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → sesmt_procedimentos
- ❌ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais_resumido, sesmt_procedimento
- ❌ `anthropic:claude-haiku-4-5` → sesmt_procedimentos

**"traga a lista completa"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma)
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)

**"Quais foram as marcações de ponto dele nessa semana? Me retorne os dad"** — esperado `consultar_marcacoes`

- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais
- ❌ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais
- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)

