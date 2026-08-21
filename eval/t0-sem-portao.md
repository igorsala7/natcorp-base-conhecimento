# Cenários com contexto — 2026-08-21 18:39

51 casos remontados com histórico, tela e as ferramentas que o funil realmente entregou.

| modelo | ferramenta | pergunta | perguntou demais | de menos | tok in | US$/1k | s |
|---|---|---|---|---|---|---|---|
| `google:gemini-3.6-flash` | 29/51 (57%) | 41/51 (80%) | 0 | 10 | 5390 | 12.26 | 4.0 |

**Gasto real desta rodada:** US$ 0.63.


## Falha de funil — nenhum modelo pode passar nestes

- **"quais sao os meus dados cadastrais?"** precisava de `meus_dados` — inequívoco — perguntar aqui é o excesso que irrita
- **"Compara com o mês de Abril"** precisava de `historico_financeiro` — 
- **"envie um e-mail para igorsala7@gmail.com"** precisava de `ms_email_enviar` — indicar endereço é sinal de envio; executa com a conta conectada [FUNIL: ms_email_enviar não foi ofertada] — anotado pelo dono em 21/08/2026, migrado de eval/rag.jsonl
- **"Mas esse não é o Espelho de Ponto que utilizamos"** precisava de `relatorio_espelho_ponto` — qual modelo o cliente usa se resolve no sistema, não no catálogo de modelos [FUNIL: relatorio_espelho_ponto não foi ofertada] — anotado pelo dono em 21/08/2026, migrado de eval/rag.jsonl
- **"preciso cosultar um colaborador, matricula dele é 751525"** precisava de `informacoes_pessoais_funcionais_resumido` — ferramenta nomeada pelo dono, com a matrícula como parâmetro [FUNIL: informacoes_pessoais_funcionais_resumido não foi ofertada] — anotado pelo dono em 21/08/2026, migrado de eval/rag.jsonl
- **"Gostaria de gerar o PDF por aquu"** precisava de `relatorio_recibo_pagamento` — gerar holerite é tarefa de ferramenta [FUNIL: relatorio_recibo_pagamento não foi ofertada] — anotado pelo dono em 21/08/2026, migrado de eval/rag.jsonl

## Onde erraram ou discordaram

**"Crie um template de documento de contrato de admissão de contrato dete"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"requisição de férias"** — esperado `ferias_criar`

- ❌ `google:gemini-3.6-flash` → ferias_situacao

**"Explique o que e o motor de blocos do editor"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Opção 2"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.6-flash` → estrutura_empresas

**"preencha esse campo com a descrição das atividades  para o cargo de co"** — esperado `preencher_campo`

- ❌ `google:gemini-3.6-flash` → estrutura_cargos, estrutura_funcoes

**"Tudo junto"** — esperado `linha_tempo`

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Pode"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.6-flash` → ferias_situacao

**"calcule total de horas extras para filial 97 ,  faca demonstrativo por"** — esperado `resultado_apuracao_ponto`

- ❌ `google:gemini-3.6-flash` → meus_dados

**"O que seria esse evento?"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.6-flash` → consultar_registros, consultar_registros, consultar_registro

**"Faça um comparativo dos valores de benefícios do histórico financeiro "** — esperado `agrupar`

- ❌ `google:gemini-3.6-flash` → consultar_registros

**"FAça a anállise dessas informações do relatório"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.6-flash` → agregar_valores, agregar_valores

**"De onde você está consultando se no relatório aqui tem muito mais cola"** — esperado `consultar_registros`

- ❌ `google:gemini-3.6-flash` → agrupar

**"Quero enviar um e-mail"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"crie em colunas apenas o nome, matricula , codigo desligamento e descr"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Estou no portal do operador, eu tenho acesso à tudo, volte a trazer os"** — esperado `consultar_registros`

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Quero ver os eventos de apuração de ponto da matrícula 205818"** — esperado `frequencia_resultado_apuracao_detalhe` + PERGUNTAR

- ❌ `google:gemini-3.6-flash` → frequencia_resultado_apuracao_detalhe

**"Informe a empresa 700 e matrícula 205818"** — esperado `preencher_campo`

- ❌ `google:gemini-3.6-flash` → estrutura_empresas, informacoes_pessoais_funcionais

**"Preencha pra mim, a empresa 700, matrícula 205818, situação de pedido "** — esperado `preencher_campo`

- ❌ `google:gemini-3.6-flash` → informacoes_pessoais_funcionais_resumido

**"15 15, início 01/10 e depois 01/11 , não quero adiantar"** — esperado `ferias_validar`

- ❌ `google:gemini-3.6-flash` → ferias_opcoes

**"Qual o colaborador com maior quantidade de benefícios?"** — esperado `agrupar`

- ❌ `google:gemini-3.6-flash` → consultar_registros

**"Me descreva um pouco mais sobre os exames que ela realizou"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.6-flash` → sesmt_procedimentos

**"traga a lista completa"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.6-flash` → informacoes_pessoais_funcionais

**"Quais foram as marcações de ponto dele nessa semana? Me retorne os dad"** — esperado `consultar_marcacoes`

- ❌ `google:gemini-3.6-flash` → informacoes_pessoais_funcionais

**"como é feita esse procedimento para localizar algo?"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Mas eu disse 01/11 e 01/12"** — esperado `ferias_validar`

- ❌ `google:gemini-3.6-flash` → consultar_ferias, ferias_opcoes

**"Não retornou todos os 96, apenas 25"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.6-flash` → consultar_registros

**"Faça uma analise desse comparativo do histórico financeiro da folha, c"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.6-flash` → consultar_registros

**"Valida essas informações do relatório e me aponte o que pode ser essas"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.6-flash` → consultar_registros, consultar_registros

