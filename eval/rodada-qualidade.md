# Cenários com contexto — 2026-08-20 01:25

37 casos remontados com histórico, tela e as ferramentas que o funil realmente entregou.

| modelo | ferramenta | pergunta | perguntou demais | de menos | tok in | US$/1k | s |
|---|---|---|---|---|---|---|---|
| `anthropic:claude-haiku-4-5` | 21/37 (57%) | 28/37 (76%) | 0 | 9 | 9509 | 10.21 | 2.2 |
| `google:gemini-3.5-flash-lite` | 24/37 (65%) | 25/37 (68%) | 3 | 9 | 6227 | 2.04 | 0.9 |

## Falha de funil — nenhum modelo pode passar nestes

- **"quais sao os meus dados cadastrais?"** precisava de `meus_dados` — inequívoco — perguntar aqui é o excesso que irrita
- **"preencha esse campo com a descrição das atividades  para o cargo de co"** precisava de `preencher_campo` — DEFEITO: preencher_campo não chegou ao modelo (formAssist), e ainda gastou um turno perguntando a fonte
- **"Compara com o mês de Abril"** precisava de `historico_financeiro` — 
- **"Informe a empresa 700 e matrícula 205818"** precisava de `preencher_campo` — "informe" = PREENCHER os campos do formulário em tela, não consultar e mostrar
- **"Preencha pra mim, a empresa 700, matrícula 205818, situação de pedido "** precisava de `preencher_campo` — preencher TUDO, inclusive a justificativa — o gestor revisa antes de salvar

## Onde erraram ou discordaram

**"Crie um template de documento de contrato de admissão de contrato dete"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma)

**"requisição de férias"** — esperado `ferias_criar`

- ❌ `anthropic:claude-haiku-4-5` → ferias_situacao
- ❌ `google:gemini-3.5-flash-lite` → ferias_situacao

**"Explique o que e o motor de blocos do editor"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma)

**"Agora gere um PPT e Word"** — esperado `gerar_relatorio`

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ✅ `google:gemini-3.5-flash-lite` → gerar_relatorio

**"Olá, eu quero saber um pouco mais sobre os meus dados."** — esperado `meus_dados`

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ✅ `google:gemini-3.5-flash-lite` → meus_dados

**"Opção 2"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-haiku-4-5` → gerar_relatorio
- ❌ `google:gemini-3.5-flash-lite` → estrutura_empresas

**"Tudo junto"** — esperado `linha_tempo`

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma)

**"Quando é que eu vou tirar férias?"** — esperado `consultar_ferias`

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ✅ `google:gemini-3.5-flash-lite` → consultar_ferias

**"E o Tony Oliveira?"** — esperado `informacoes_pessoais_funcionais_resumido`

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ✅ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais_resumido

**"Agora eu quero as informações do 205818"** — esperado `informacoes_pessoais_funcionais_resumido`

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ✅ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais_resumido

**"Pode"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → ferias_validar

**"calcule total de horas extras para filial 97 ,  faca demonstrativo por"** — esperado `resultado_apuracao_ponto`

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → estrutura_empresas

**"O que seria esse evento?"** — esperado `(nenhuma)`

- ✅ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma) + perguntou

**"Pode enviar"** — esperado `(nenhuma)`

- ❌ `anthropic:claude-haiku-4-5` → clicar_elemento
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma) + perguntou

**"Faça um comparativo dos valores de benefícios do histórico financeiro "** — esperado `agrupar`

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → meus_dados

**"FAça a anállise dessas informações do relatório"** — esperado `(nenhuma)`

- ✅ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → consultar_registros

**"De onde você está consultando se no relatório aqui tem muito mais cola"** — esperado `consultar_registros`

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais_resumido

**"Posso acrescentar o 13° após as férias aprovadas?"** — esperado `(nenhuma)`

- ✅ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma) + perguntou

**"Quero enviar um e-mail"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → meus_dados

**"crie em colunas apenas o nome, matricula , codigo desligamento e descr"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-haiku-4-5` → gerar_relatorio
- ❌ `google:gemini-3.5-flash-lite` → requisicoes_req_desligamento

**"Quero ver os eventos de apuração de ponto da matrícula 205818"** — esperado `frequencia_resultado_apuracao_detalhe` + PERGUNTAR

- ❌ `anthropic:claude-haiku-4-5` → frequencia_resultado_apuracao_detalhe
- ❌ `google:gemini-3.5-flash-lite` → frequencia_resultado_apuracao_detalhe

**"15 15, início 01/10 e depois 01/11 , não quero adiantar"** — esperado `ferias_validar`

- ✅ `anthropic:claude-haiku-4-5` → ferias_validar
- ❌ `google:gemini-3.5-flash-lite` → ferias_opcoes

**"Qual o colaborador com maior quantidade de benefícios?"** — esperado `agrupar`

- ❌ `anthropic:claude-haiku-4-5` → consultar_beneficios
- ❌ `google:gemini-3.5-flash-lite` → pagamento_colaboradores, pagamento_colaboradores

**"Me descreva um pouco mais sobre os exames que ela realizou"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-haiku-4-5` → sesmt_procedimentos
- ❌ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais_resumido, sesmt_procedimento

**"traga a lista completa"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ❌ `google:gemini-3.5-flash-lite` → (nenhuma)

**"Quais foram as marcações de ponto dele nessa semana? Me retorne os dad"** — esperado `consultar_marcacoes`

- ❌ `anthropic:claude-haiku-4-5` → (nenhuma)
- ✅ `google:gemini-3.5-flash-lite` → informacoes_pessoais_funcionais, consultar_marcacoes, result

