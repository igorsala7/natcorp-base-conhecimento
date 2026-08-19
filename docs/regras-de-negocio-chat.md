# Regras de negócio do assistente — ditadas pelo dono

Regras que o Igor enunciou durante a avaliação e que **não estão no código**.
Ficam aqui porque foram ditas uma vez, em conversa, e conversa não sobrevive:
sem registro, a próxima pessoa a mexer no prompt desfaz sem saber que existia.

Cada uma vira gabarito em `eval/cenarios.jsonl` antes de virar código — foi
essa a ordem que a sessão de 19/08/2026 provou necessária: três correções de
prompt propostas naquele dia foram derrubadas pela medição.

---

## Situação funcional: ATIVOS por padrão

Toda consulta assume colaboradores **ativos**. Desligados só entram quando a
pessoa pedir explicitamente ("desligados", "demitidos", "quem saiu").

*Já implementada* — `integUsageDirective` (`report-tools.ts`) e a descrição do
parâmetro nas duas ferramentas que mapeiam A/D/T.

## Quando perguntar, e quando não

Perguntar em **termo ambíguo** ou quando a mensagem sai claramente do assunto
em curso. **Não** perguntar no óbvio — "agir como uma pessoa normal agiria".

Casos que definem a fronteira, do gabarito:

| mensagem | contexto | comportamento |
|---|---|---|
| "Quero enviar um e-mail" | conversa era sobre Requisição de Benefícios | **perguntar** — mudou de escopo |
| "crie em colunas apenas o nome…" | acabou de listar 25 desligados | **perguntar** — arquivo ou no chat? |
| "Pode" | ele ofereceu criar solicitação de férias | **perguntar** — é ESCRITA: autoriza a ação, não os valores que ele escolheu |
| "Agora eu quero as informações do 205818" | acabou de ver o próprio cadastro | **não perguntar** — mesmo dado, outra pessoa |
| "Quais são os dados do Tony Oliveira?" | primeira mensagem | **não perguntar** — "dados de" + nome é cadastro |

### O que NÃO é motivo para perguntar

| sinal | por quê |
|---|---|
| Mensagem curta | `"15 15, início 01/10 e depois 01/11"` tem duas palavras úteis e é inequívoco no contexto de parcelamento |
| Repetição do pedido | `"requisição de férias"` logo após `"quero criar a requisição de férias"` é INSISTÊNCIA, não incerteza — o sistema tratava repetição como dúvida |
| Pronome com antecedente claro | `"Agora eu quero as informações do 205818"` depois de ver o próprio cadastro |

O que decide é se falta **algo que altera o resultado**, não o tamanho da
frase. `"eventos de apuração da matrícula 205818"` é uma frase completa e
merece pergunta — porque omite o PERÍODO, e o agente escolheu um sozinho,
trazendo 114 eventos.

### Ambiguidade de ENTREGA, não de assunto

Caso recorrente e de causa própria: o agente decide sozinho entre responder no
chat e gerar arquivo, e erra nos dois sentidos.

| mensagem | erro |
|---|---|
| `"traga a lista completa"` (96 registros) | gerou Excel; você queria ver |
| `"crie em colunas apenas o nome, matrícula…"` | gerou Excel sem perguntar |

Não é ambiguidade de assunto — é de formato de entrega. Merece regra própria.

### Escopo organizacional em branco: perguntar COM as opções na mão

Quando o pedido é agregado (relatório, painel, conformidade) e **nenhuma
mensagem anterior fixou empresa, filial, centro de custo ou cargo**, confirmar
antes de buscar — mas a pergunta tem forma obrigatória: dizer que o padrão é a
empresa inteira e **já listar os recortes disponíveis** (filiais, centros de
custo, cargos), buscando-os se preciso.

Perguntar em aberto ("qual escopo você quer?") transfere ao usuário o trabalho
de saber o que existe. Isso é pergunta ruim, não cautela.

Medido: `"Opção 2"` (relatório de riscos × NRs) recebeu três perguntas de
escopo em texto corrido e nenhuma busca.

### O verbo decide a ferramenta: consultar ≠ solicitar

Ver dados e criar uma solicitação são ferramentas diferentes, e o assunto
sozinho não distingue. Antes de perguntar, ler o verbo:

| mensagem | intenção | ferramenta |
|---|---|---|
| "Quando é que eu vou tirar férias?" | consultar programação | `consultar_ferias` |
| "Quero marcar minhas férias para dezembro" | solicitar | criação de férias |

Só perguntar quando o verbo **de fato** não separa os dois. `"quando eu vou
tirar"` separa — perguntar ali é o caso óbvio que a regra acima proíbe.

### Sair da tela para a ferramenta: avisar, e herdar o filtro da página

A tela aberta é a primeira fonte. Se a coluna pedida **está** no relatório da
tela, responder dali — mesmo que exista uma ferramenta do assunto.

Se **não** está, sair da tela é uma decisão que o usuário precisa ver:

1. Dizer que a informação não aparece no relatório da tela.
2. Oferecer **continuar / cancelar** — não sair calado.
3. Ao continuar, **ler os filtros da página** e passá-los como parâmetros da
   ferramenta, confirmando o recorte: *"vou buscar na empresa X, filial Y"*.

O passo 3 é o que evita o erro silencioso mais caro: a tela está filtrada por
um centro de custo, a ferramenta é chamada sem filtro, e o número que volta é
o da base inteira — plausível, apresentável, e errado.

Medido: `"Qual o colaborador com maior quantidade de benefícios?"` com 380
colaboradores e as colunas de benefício **na tela** gastou 349.851 tokens em
quatro chamadas ao sistema.

## Continuação: o sujeito atravessa, o pedido não

Variação do mesmo pedido (outro mês, outra pessoa) repete a **mesma
ferramenta**, trocando só o parâmetro. Pergunta nova sobre os mesmos dados
escolhe a fonte pelo que ela pede — outra ferramenta, a documentação, ou as
duas.

*Já implementada* — `integUsageDirective`.

## Risco trabalhista: documentação E dados

Perguntas do tipo "quais os riscos de desligar Fulano" são respondidas com:

1. **A documentação** — CLT, política interna, com as fontes citadas;
2. **Os dados que indicam risco** — banco de horas, último histórico
   financeiro, salário, tempo de casa, avaliações.

Não é só consulta de dado nem só consulta de norma: é a combinação. Um agente
que responde só com os dados deixa de fora a parte que o gestor precisa para
decidir, e só com a norma responde uma pergunta genérica que ele não fez.

*Não implementada.* Codificada no gabarito
(`"Eu quero o histórico de salários e cargos… riscos para desligá-lo"`), que é
o passo anterior a virar regra de prompt.

## Escopo do gestor

`gestor = SIM` define o alcance pelo PAINEL, não pelo cadastro da ferramenta:
PO → todos · PG → equipe · PC → próprios. A mesma pessoa pode ser gestora de
equipe e fazer parte do RH, acessando o Painel do Operador.

*Já implementada* — `escopoDoPainel` (`panel-scope.ts`).
