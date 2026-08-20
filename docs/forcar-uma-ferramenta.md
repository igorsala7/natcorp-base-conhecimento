# Forçar UMA ferramenta: o problema é real, o detector não era

> Gabarito em `eval/forcadas.jsonl` (10 casos anotados pelo dono, 20/08/2026).

## O que acontece hoje

7% dos turnos mandam ao modelo **uma única** ferramenta de integração. Três
caminhos levam a isso, e só um é automático:

| caminho | origem | seguro? |
|---|---|---|
| `scope.tool` | o usuário CLICOU na fonte | sim — é a escolha dele |
| `scope.tools` com 1 item | idem | sim |
| `roteouDireto && topDominaClaro` | automático, sobre a consulta REESCRITA | **é aqui que erra** |

## O problema, medido

Quando a reescrita substitui a pergunta por completo — o que acontece em 34% dos
turnos, quase sempre pelo título da tela — e o roteador ainda assim estreita para
uma ferramenta, o gabarito do dono diz: **5 certos, 5 errados**.

Metade. Entre os errados:

| pergunta | forçou | devia ser |
|---|---|---|
| "E qual é o histórico financeiro dele de março, abril e maio?" | `relatorio_recibo_pagamento` (6×) | `historico_financeiro` |
| "Compara com o mês de Abril" | `relatorio_recibo_pagamento` | `historico_financeiro` |
| "Mas eu quero no geral" | `linha_tempo` | `listar_colaboradores_resumo` |
| "Eu quero desligá-lo" | `requisicoes_req_desligamento` | perguntar — intenção ou ação? |
| "Esse veio certo" | `relatorio_recibo_pagamento` | nenhuma — é ELOGIO |

O primeiro é o mais claro: o usuário escreveu "histórico financeiro" com essas
palavras, a reescrita virou "Folha de Pagamento Recibo de Pagamento", e a
ferramenta que ele nomeou ficou de fora.

## O detector que NÃO funcionou

`reescritaPerdeuAPergunta(original, reescrita)` — verdadeiro quando nenhuma
palavra de conteúdo da pergunta sobrevive na reescrita. Escrito, testado, ligado
e **revertido**.

Contra o gabarito, em três limiares de exigência:

| mínimo de palavras de conteúdo | bloqueia certo | bloqueia errado |
|---|---|---|
| 1 | 5/5 | **5/5** |
| 2 | 3/5 | 4/5 |
| 3 | 1/5 | 3/5 |

Nenhum limiar separa. E ligado, causou regressão medida: em `"Confirmado"` a
reescrita virou "Consulta de cálculo de FGTS por colaborador" — que é a reescrita
FAZENDO O TRABALHO DELA, reconstruindo a intenção do contexto. O detector não
distingue isso de "virou o título da tela", porque nos dois casos nenhuma palavra
sobrevive. Sem o forçamento, o turno chamou `clicar_elemento` e não executou.

O sinal simplesmente não carrega a informação.

## O que os 5 erros pedem, de fato

Cada um pede um mecanismo diferente — e nenhum é "detectar contaminação":

1. **"histórico financeiro" e "Compara com o mês de Abril"** → o assunto da
   conversa já estava fixado em `historico_financeiro`. O quadro de fatos
   (`fatos-conversa.ts`, 20/08) sabe disso. Forçar uma ferramenta que contraria o
   assunto estabelecido é o sinal — não a contaminação da reescrita.
2. **"Mas eu quero no geral"** → idem: a conversa era sobre colaboradores.
3. **"Esse veio certo"** → ELOGIO. Pede um detector de feedback, e o certo ali é
   não chamar ferramenta nenhuma.
4. **"Eu quero desligá-lo"** → ambíguo entre intenção e ação ("pode ser
   planejamento futuro ou realmente abrir a requisição", disse o dono). Pede
   pergunta, não roteamento melhor.

## Estado

Nada ligado. O gabarito fica em `eval/forcadas.jsonl` para medir a próxima
tentativa — que deve partir do QUADRO DE FATOS, não da reescrita.
