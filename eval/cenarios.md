# Cenários com contexto — 2026-08-24 16:01

125 casos remontados com histórico, tela e as ferramentas que o funil realmente entregou.

| modelo | ferramenta | pergunta | perguntou demais | de menos | tok in | US$/1k | s |
|---|---|---|---|---|---|---|---|
| `google:gemini-3.5-flash` | 64/125 (51%) | 111/125 (89%) | 3 | 11 | 14361 | 26.67 | 7.7 |

**Gasto real desta rodada:** US$ 3.33.


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
- **"Quais deles já tiveram afastamentos?"** precisava de `linha_tempo` — Dono: afastamento é FATO DA LINHA DO TEMPO do colaborador, não módulo SESMT. O agente foi para sesmt_procedimentos e deu erro. Segundo caso apontando linha_tempo como vítima de roteamento.

## Onde erraram ou discordaram

**"Frente à CLT, possuo algum risco?"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.5-flash` → bi_risco, bi_seguranca

**"GERE ESTE MATERIAL EXECUTIVO PARA APRESENTAR"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"Olá, preciso das informações dos meus liderados"** — esperado `informacoes_pessoais_funcionais`

- ❌ `google:gemini-3.5-flash` → listar_colaboradores_resumo, informacoes_pessoais_funcionais

**"Como você avalia a tragetória desse colaborador?"** — esperado `linha_tempo`

- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais_resumido, informacoes_pessoa

**"quantos colaboradores possuo neste consulta?"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.5-flash` → coletar_relatorio, informacoes_pessoais_funcionais_resumido

**"Quero ver as marcações de ponto da minha equipe"** — esperado `consultar_marcacoes` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → (nenhuma) + perguntou

**"Quais são meus direitos trabalhistas?"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.5-flash` → meus_dados

**"preencha esse campo com a descrição das atividades  para o cargo de co"** — esperado `preencher_campo`

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"conforme anexo e usando as informações que foram passadas existem tres"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais_resumido, informacoes_pessoa

**"Olá, quais são meus dados?"** — esperado `meus_dados`

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"E o mês anterior?"** — esperado `historico_financeiro_meses`

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"Qual meu centro de custo?"** — esperado `meus_dados`

- ❌ `google:gemini-3.5-flash` → estrutura_centros_custo, estrutura_centros_custo

**"Quero ver todos os colaboradores da empresa que tiveram marcações"** — esperado `consultar_marcacoes`

- ❌ `google:gemini-3.5-flash` → (nenhuma) + perguntou

**"Me retorne todos os colaboradores das área de RH e Folha"** — esperado `estrutura_centros_custo`

- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais_resumido, listar_colaborador

**"Me retorne o histórico de cargos e salários dele"** — esperado `linha_tempo`

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"Envie um e-mail para davikuster89@gmail.com marcando uma call pelo tea"** — esperado `ms_evento_criar`

- ❌ `google:gemini-3.5-flash` → ms_email_enviar

**"calcule total de horas extras para filial 97 ,  faca demonstrativo por"** — esperado `resultado_apuracao_ponto`

- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais_resumido, informacoes_pessoa

**"Analise este relatório e me diga o que chama atenção."** — esperado `(nenhuma)`

- ❌ `google:gemini-3.5-flash` → consultar_registros, agrupar

**"Mas eu desde o início estou pedindo "Quais", não pedi consolidado"** — esperado `consultar_registros`

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"Faça a análise comparando os resultados desse arquivo com o relatório"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.5-flash` → agrupar, agrupar, consultar_registros, consultar_registros

**"O que seria esse evento?"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.5-flash` → consultar_registros + perguntou

**"Me ensina usar"** — esperado `tutorial_tela`

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"Pode enviar"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.5-flash` → ms_email_enviar

**"Faça um comparativo dos valores de benefícios do histórico financeiro "** — esperado `agrupar`

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"Pegue todo o período, desde quando ela foi admitida"** — esperado `linha_tempo`

- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais_resumido, informacoes_pessoa

**"Cria um PDF com essas informações pra eu enviar pro meu jurídico e pro"** — esperado `gerar_relatorio`

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"como é feita esse procedimento para localizar algo?"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"me oriente sobre a utilização desta aplicação"** — esperado `tutorial_tela`

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"Faça um PDF e um PPT para que eu possa enviar e apresentar para meu CF"** — esperado `gerar_relatorio`

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"Qual candidato é melhor para a vaga de Analista de RH? Precisa morar e"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.5-flash` → consultar_registros, candidatos_externos

**"concluída , 212857, 01/03/2025"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.5-flash` → consultar_registros

**"Qual filial e seus cargos que possuem maior quantidade de colaboradore"** — esperado `agrupar`

- ❌ `google:gemini-3.5-flash` → meus_dados, informacoes_pessoais_funcionais_resumido

**"Quantos colaboradores abaixo de 40 anos por filial?"** — esperado `derivar_coluna`

- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais_resumido, agrupar

**"Quero ver os eventos de apuração de ponto da matrícula 205818"** — esperado `frequencia_resultado_apuracao_detalhe` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → resultado_apuracao_ponto, frequencia_resultado_apuracao_deta

**"Informe a empresa 700 e matrícula 205818"** — esperado `preencher_campo`

- ❌ `google:gemini-3.5-flash` → estrutura_empresas

**"Preencha pra mim, a empresa 700, matrícula 205818, situação de pedido "** — esperado `preencher_campo`

- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais_resumido, informacoes_pessoa

**"Envia esse 3 arquivos para carlosalberto@natcorp.com.br"** — esperado `ms_email_enviar`

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"A gente não está falando sobre o centro de custo e o evento de FGTS ne"** — esperado `historico_financeiro`

- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais_resumido, listar_colaborador

**"Não está"** — esperado `relatorio_espelho_ponto`

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"Se você consultar o histórico financeiro você descobre quem recebeu DS"** — esperado `historico_financeiro`

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"Quero mais informações sobre ele"** — esperado `informacoes_pessoais_funcionais_resumido`

- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais, informacoes_pessoais_funcio

**"varios dias e diversas empreas"** — esperado `frequencia_resultado_apuracao_detalhe`

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"Quais colaboradores foram trabalhar hoje na Ambev?"** — esperado `consultar_marcacoes`

- ❌ `google:gemini-3.5-flash` → consultar_registros, consultar_registros

**"Quais colaboradores atuam nessa jornada?"** — esperado `consultar_registros`

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"Ao tony mesmo"** — esperado `linha_tempo`

- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais, consultar_feedback

**"Crie um template de documento de contrato de admissão de contrato dete"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"Explique o que e o motor de blocos do editor"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"Ele está na minha equipe?"** — esperado `listar_colaboradores_resumo`

- ❌ `google:gemini-3.5-flash` → listar_colaboradores_resumo + perguntou

**"Opção 2"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"Tudo junto"** — esperado `linha_tempo`

- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais, informacoes_pessoais_funcio

**"Agora eu quero as informações do 205818"** — esperado `informacoes_pessoais_funcionais_resumido`

- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais, informacoes_pessoais_funcio

**"Pode"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"FAça a anállise dessas informações do relatório"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.5-flash` → agrupar, agrupar, consultar_registros, consultar_registros

**"Quero enviar um e-mail"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"Estou no portal do operador, eu tenho acesso à tudo, volte a trazer os"** — esperado `consultar_registros`

- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais_resumido, listar_colaborador

**"Eu quero o histórico de salários e cargos, os feedbacks, as avaliações"** — esperado `linha_tempo_fato`

- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais_resumido, informacoes_pessoa

**"Me descreva um pouco mais sobre os exames que ela realizou"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → consultar_registros, destacar_tela

**"traga a lista completa"** — esperado `(nenhuma)` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais_resumido

**"Mas eu disse 01/11 e 01/12"** — esperado `ferias_validar`

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"Me traz mais informações dele"** — esperado `candidatos_externos`

- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais_resumido, informacoes_pessoa

**"Não retornou todos os 96, apenas 25"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais_resumido, informacoes_pessoa

**"Faça uma analise desse comparativo do histórico financeiro da folha, c"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.5-flash` → consultar_registros, agrupar

**"você apenas exibiu o colaborador com maior horas faltou o colaborador "** — esperado `(nenhuma)`

- ❌ `google:gemini-3.5-flash` → informacoes_pessoais_funcionais_resumido, frequencia_resulta

**"Valida essas informações do relatório e me aponte o que pode ser essas"** — esperado `(nenhuma)`

- ❌ `google:gemini-3.5-flash` → consultar_registros, agrupar, agrupar

**"Qual ocorrência tem o maior valor?"** — esperado `agrupar`

- ❌ `google:gemini-3.5-flash` → consultar_registros

**"Gere um Excel, Word, Powerpoint e um gráfico com essas informações"** — esperado `gerar_relatorio`

- ❌ `google:gemini-3.5-flash` → agrupar, montar_grafico, montar_grafico, montar_grafico, mon

**"Confirmado"** — esperado `historico_financeiro_meses` + PERGUNTAR

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"Gerar relatórios  sistema não abre"** — esperado `destacar_tela`

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"Não consigo mudar a opção"** — esperado `clicar_elemento`

- ❌ `google:gemini-3.5-flash` → (nenhuma)

**"analise o arquivo e calcule o banco utilizando o anterior e veja a dif"** — esperado `calcular`

- ❌ `google:gemini-3.5-flash` → (nenhuma)

