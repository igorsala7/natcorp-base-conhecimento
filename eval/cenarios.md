# Cenários com contexto — 2026-08-23 14:49

118 casos remontados com histórico, tela e as ferramentas que o funil realmente entregou.

| modelo | ferramenta | pergunta | perguntou demais | de menos | tok in | US$/1k | s |
|---|---|---|---|---|---|---|---|
| `google:gemini-3.6-flash` | 188/354 (53%) | 314/354 (89%) | 8 | 32 | 11632 | 22.54 | 4.9 |

**Gasto real desta rodada:** US$ 7.98.


## Falha de funil — nenhum modelo pode passar nestes

- **"Adiantamento Agosto"** precisava de `relatorio_recibo_pagamento` — Buscar o recibo ANTES de gerar o arquivo — o agente gerou o PDF direto, sem consultar. Vira FALHA DE FUNIL no placar, e é o ponto: nenhuma ferramenta de integração foi ofertada naquele turno, então ele não tinha como buscar. Segundo caso de relatorio_recibo_pagamento ausente no conjunto.
- **"lista as filiais da empresa 1"** precisava de `estrutura_filiais` — FALHA DE FUNIL com consequência visível ao usuário: nenhuma ferramenta de integração foi ofertada, e o agente respondeu que "não tem acesso direto às filiais cadastradas" — negando uma capacidade que o sistema tem. É o pior formato de erro: o cliente conclui que o produto não faz algo que ele faz.
- **"feedback"** precisava de `consultar_feedback` — Dono: a tool de feedback, quando o pedido é sobre os feedbacks RECEBIDOS pelo colaborador. FALHA DE FUNIL — consultar_feedback nem chegou ao modelo (mensagem de 1 palavra zera o antiflood; só sobraram as locais de tela).
- **"Me retorna o histórico de cargos e salário dele, e também os feedbacks"** precisava de `linha_tempo` — Dono: linha do tempo (histórico de cargos/salário) + consultar_feedback. FALHA DE FUNIL: linha_tempo NÃO chegou ao modelo; ele caiu em informacoes_pessoais_funcionais. Segunda tool esperada: consultar_feedback (essa foi ofertada e chamada).
- **"Eu quero os dados do colaborador 205818"** precisava de `informacoes_pessoais_funcionais_resumido` — "os dados" é genérico → resumida por padrão. FALHA DE FUNIL: só a completa foi ofertada, a resumida nem chegou ao modelo.
- **"gere do período de 01/03/25  a 31/03/25 neste período sei que existem "** precisava de `frequencia_resultado_apuracao_detalhe` — Dono: apuração DETALHADA + informacoes_pessoais_funcionais_resumido + frequencia_req_trat_bat. FALHA DE FUNIL: as duas primeiras NÃO chegaram ao modelo; ele caiu em resultado_apuracao_ponto + relatorio_espelho_ponto. Espelho de ponto NÃO é o entregável — o pedido é por dados dia a dia.
- **"quais sao os meus dados cadastrais?"** precisava de `meus_dados` — inequívoco — perguntar aqui é o excesso que irrita
- **"Compara com o mês de Abril"** precisava de `historico_financeiro` — 
- **"envie um e-mail para igorsala7@gmail.com"** precisava de `ms_email_enviar` — indicar endereço é sinal de envio; executa com a conta conectada [FUNIL: ms_email_enviar não foi ofertada] — anotado pelo dono em 21/08/2026, migrado de eval/rag.jsonl
- **"Mas esse não é o Espelho de Ponto que utilizamos"** precisava de `relatorio_espelho_ponto` — qual modelo o cliente usa se resolve no sistema, não no catálogo de modelos [FUNIL: relatorio_espelho_ponto não foi ofertada] — anotado pelo dono em 21/08/2026, migrado de eval/rag.jsonl
- **"preciso cosultar um colaborador, matricula dele é 751525"** precisava de `informacoes_pessoais_funcionais_resumido` — ferramenta nomeada pelo dono, com a matrícula como parâmetro [FUNIL: informacoes_pessoais_funcionais_resumido não foi ofertada] — anotado pelo dono em 21/08/2026, migrado de eval/rag.jsonl
- **"Gostaria de gerar o PDF por aquu"** precisava de `relatorio_recibo_pagamento` — gerar holerite é tarefa de ferramenta [FUNIL: relatorio_recibo_pagamento não foi ofertada] — anotado pelo dono em 21/08/2026, migrado de eval/rag.jsonl

## Onde erraram ou discordaram

**"Frente à CLT, possuo algum risco?"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.6-flash` → informacoes_pessoais_funcionais_resumido

**"GERE ESTE MATERIAL EXECUTIVO PARA APRESENTAR"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Como você avalia a tragetória desse colaborador?"** — esperado `linha_tempo`

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Faz em pdf"** — esperado `gerar_relatorio`

- ❌ `google:gemini-3.6-flash` → gerar_relatorio + perguntou

**"quantos colaboradores possuo neste consulta?"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.6-flash` → coletar_relatorio

**"Quero ver as marcações de ponto da minha equipe"** — esperado `consultar_marcacoes` + PERGUNTAR

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Então faça pelo total da remuneração"** — esperado `informacoes_pessoais_funcionais`

- ❌ `google:gemini-3.6-flash` → informacoes_pessoais_funcionais_resumido

**"calcule utlizando este anexo"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.6-flash` → informacoes_pessoais_funcionais_resumido

**"preencha esse campo com a descrição das atividades  para o cargo de co"** — esperado `preencher_campo`

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Quero pedir minhas férias"** — esperado `ferias_situacao`

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"conforme anexo e usando as informações que foram passadas existem tres"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.6-flash` → (nenhuma) + perguntou

**"E o mês anterior?"** — esperado `historico_financeiro_meses`

- ❌ `google:gemini-3.6-flash` → informacoes_pessoais_funcionais_resumido

**"Qual meu centro de custo?"** — esperado `meus_dados`

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Quero ver todos os colaboradores da empresa que tiveram marcações"** — esperado `consultar_marcacoes`

- ❌ `google:gemini-3.6-flash` → (nenhuma) + perguntou

**"Retorne os colaboradores do meu centro de custo"** — esperado `informacoes_pessoais_funcionais_resumido`

- ❌ `google:gemini-3.6-flash` → meus_dados

**"Me retorne o histórico de cargos e salários dele"** — esperado `linha_tempo`

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Como está a programação de férias dessa equipe?"** — esperado `consultar_ferias`

- ❌ `google:gemini-3.6-flash` → (nenhuma) + perguntou

**"calcule total de horas extras para filial 97 ,  faca demonstrativo por"** — esperado `resultado_apuracao_ponto`

- ❌ `google:gemini-3.6-flash` → estrutura_filiais

**"conforme relatório gerado nao trouxe nenhuma informação , quero os dad"** — esperado `frequencia_resultado_apuracao_detalhe`

- ❌ `google:gemini-3.6-flash` → informacoes_pessoais_funcionais

**"Analise este relatório e me diga o que chama atenção."** — esperado `(nenhuma)`

- ❌ `google:gemini-3.6-flash` → consultar_registros

**"Mas eu desde o início estou pedindo "Quais", não pedi consolidado"** — esperado `consultar_registros`

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Faça a análise comparando os resultados desse arquivo com o relatório"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.6-flash` → agrupar, agrupar, agregar_valores, agregar_valores

**"O que seria esse evento?"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.6-flash` → (nenhuma) + perguntou

**"Me ensina usar"** — esperado `tutorial_tela`

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Agora faça um excel com esses valores de forma organizada, e inclua gr"** — esperado `gerar_relatorio`

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Faça um PDF com essa analise pra que eu possa enviar para meu CEO"** — esperado `gerar_relatorio`

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Faça um comparativo dos valores de benefícios do histórico financeiro "** — esperado `agrupar`

- ❌ `google:gemini-3.6-flash` → (nenhuma) + perguntou

**"Pegue todo o período, desde quando ela foi admitida"** — esperado `linha_tempo`

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Cria um PDF com essas informações pra eu enviar pro meu jurídico e pro"** — esperado `gerar_relatorio`

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"como é feita esse procedimento para localizar algo?"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"me oriente sobre a utilização desta aplicação"** — esperado `tutorial_tela`

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Faça um PDF e um PPT para que eu possa enviar e apresentar para meu CF"** — esperado `gerar_relatorio`

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Qual candidato é melhor para a vaga de Analista de RH? Precisa morar e"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.6-flash` → consultar_registros

**"Consulte as férias desses colaboradores desde 2010"** — esperado `consultar_ferias`

- ❌ `google:gemini-3.6-flash` → requisicoes_req_ferias, pagamento_colaboradores

**"Qual filial e seus cargos que possuem maior quantidade de colaboradore"** — esperado `agrupar`

- ❌ `google:gemini-3.6-flash` → consultar_registros

**"Quantos colaboradores abaixo de 40 anos por filial?"** — esperado `derivar_coluna`

- ❌ `google:gemini-3.6-flash` → consultar_registros

**"Quero ver os eventos de apuração de ponto da matrícula 205818"** — esperado `frequencia_resultado_apuracao_detalhe` + PERGUNTAR

- ❌ `google:gemini-3.6-flash` → frequencia_resultado_apuracao_detalhe

**"Informe a empresa 700 e matrícula 205818"** — esperado `preencher_campo`

- ❌ `google:gemini-3.6-flash` → estrutura_empresas, informacoes_pessoais_funcionais

**"Preencha pra mim, a empresa 700, matrícula 205818, situação de pedido "** — esperado `preencher_campo`

- ❌ `google:gemini-3.6-flash` → informacoes_pessoais_funcionais_resumido

**"15 15, início 01/10 e depois 01/11 , não quero adiantar"** — esperado `ferias_validar`

- ❌ `google:gemini-3.6-flash` → ferias_opcoes

**"A gente não está falando sobre o centro de custo e o evento de FGTS ne"** — esperado `historico_financeiro`

- ❌ `google:gemini-3.6-flash` → informacoes_pessoais_funcionais_resumido

**"Não está"** — esperado `relatorio_espelho_ponto`

- ❌ `google:gemini-3.6-flash` → informacoes_pessoais_funcionais_resumido

**"Se você consultar o histórico financeiro você descobre quem recebeu DS"** — esperado `historico_financeiro`

- ❌ `google:gemini-3.6-flash` → informacoes_pessoais_funcionais_resumido

**"varios dias e diversas empreas"** — esperado `frequencia_resultado_apuracao_detalhe`

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Quais colaboradores foram trabalhar hoje na Ambev?"** — esperado `consultar_marcacoes`

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Quais colaboradores atuam nessa jornada?"** — esperado `consultar_registros`

- ❌ `google:gemini-3.6-flash` → informacoes_pessoais_funcionais

**"Ao tony mesmo"** — esperado `linha_tempo`

- ❌ `google:gemini-3.6-flash` → informacoes_pessoais_funcionais_resumido

**"Crie um template de documento de contrato de admissão de contrato dete"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"requisição de férias"** — esperado `ferias_criar`

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Explique o que e o motor de blocos do editor"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Opção 2"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.6-flash` → estrutura_empresas, bi_risco

**"Tudo junto"** — esperado `linha_tempo`

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"E o Tony Oliveira?"** — esperado `informacoes_pessoais_funcionais_resumido`

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Pode"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.6-flash` → ferias_situacao

**"FAça a anállise dessas informações do relatório"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.6-flash` → agrupar, agrupar

**"Quero enviar um e-mail"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Estou no portal do operador, eu tenho acesso à tudo, volte a trazer os"** — esperado `consultar_registros`

- ❌ `google:gemini-3.6-flash` → (nenhuma)

**"Me descreva um pouco mais sobre os exames que ela realizou"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.6-flash` → sesmt_procedimentos

**"traga a lista completa"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.6-flash` → informacoes_pessoais_funcionais

**"Quais foram as marcações de ponto dele nessa semana? Me retorne os dad"** — esperado `consultar_marcacoes`

- ❌ `google:gemini-3.6-flash` → informacoes_pessoais_funcionais

**"Mas eu disse 01/11 e 01/12"** — esperado `ferias_validar`

- ❌ `google:gemini-3.6-flash` → consultar_ferias

**"Não retornou todos os 96, apenas 25"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.6-flash` → consultar_registros

**"Faça uma analise desse comparativo do histórico financeiro da folha, c"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.6-flash` → consultar_registros

**"Valida essas informações do relatório e me aponte o que pode ser essas"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.6-flash` → consultar_registros, consultar_registros

