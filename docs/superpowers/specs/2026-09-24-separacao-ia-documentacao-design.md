# Separar o módulo de IA do módulo de documentação

> Desenho validado com o dono em 24/09/2026. O projeto 0 está pronto para
> virar plano de implementação; os projetos 1 a 4 têm decisões registradas
> aqui e especificação própria depois.

## O problema, com dado

Hoje um chatbot só existe pendurado numa documentação. `widget_keys.space_id`
é NOT NULL e carrega quatro coisas de uma vez: permissão, o
`conversations.space_id` (também NOT NULL), a persona (`spaces.chat_prompt`)
e os arquivos de conhecimento (`knowledge_documents.space_id`).

O efeito disso está no banco:

| espaço | tipo | artigos | pastas | chunks | arquivos | chaves | conversas |
|---|---|---|---|---|---|---|---|
| natcorp | global | 4.314 | 1.850 | 8.177 | 118 | 1 | 409 |
| painel-do-colaborador | client | **0** | **0** | 465 | 2 | 1 | 77 |
| painel-do-gestor | client | **0** | **0** | 756 | 3 | 1 | 21 |

`painel-do-colaborador` e `painel-do-gestor` são "documentações" com zero
artigos e zero pastas. Existem só para hospedar uma chave de widget e cinco
arquivos. O modelo atual obriga a criar uma documentação vazia para ter um
chatbot, e foi isso que gerou o pedido.

### O que já está separado

O módulo de IA é mais independente do que parece. `ai_bases` não tem nenhuma
coluna de espaço; as ferramentas se ligam por `ai_base_tools`, com allowlist
de portal, perfil e empresa. E `hybrid_search_scoped(p_query, p_embedding,
p_node_ids, p_limit, p_document_ids, p_boost, p_group_limit)` **não filtra por
espaço**: ela recebe listas de nós e de documentos. Um arquivo que viva fora
de qualquer documentação continua sendo recuperado sem tocar na busca.

### Uma chave atende vários clientes

A mesma chave de widget serve várias bases, distinguidas em tempo de execução
pelo `p_base`: `painel-do-colaborador` já atendeu `incor`, `saude`, `NATCORP` e
`leadec`. A chave agrupa por **painel**, não por cliente. Qualquer desenho que
trate a chave como "o cliente" está errado.

## Decomposição

O pedido original cresceu para quatro subsistemas, dois deles sem relação com
documentação (upload com elegibilidade, e campanhas com métricas). Especificar
tudo junto garantiria que a parte difícil de cada um recebesse metade da
atenção.

| # | Projeto | Depende de | Entrega |
|---|---|---|---|
| 0 | Motor de elegibilidade | nada | Uma só forma de dizer "quem alcança isto", em 12 dimensões, e os 6 parâmetros novos de rastreio |
| 1 | Documentação anexável por base e portal | 0 | Documentação universal por padrão, com parametrização por portal |
| 2 | Conteúdos do cliente | 0, 1 | Upload na gestão do cliente, RAG opcional, download opcional |
| 3 | Comunicação e campanhas | 0 | Agendar, disparar pelo chatbot, leitura, painel e drilldown |
| 4 | Rodada 2 do desacoplamento | 1 | Chave de widget sem documentação dona |

O projeto 0 vem primeiro porque é pré-requisito de três dos outros. A regra de
allowlist já existe **duas vezes** no código, com formas diferentes:
`ai_base_tools` com três dimensões e `prompts_sugeridos` com seis. Seguir sem
unificar levaria a quatro implementações divergentes da mesma regra, e essa
regra falha sem erro: devolve lista vazia e parece que ninguém configurou nada.

### Economia operacional

O bloco APEX já precisa ser recolado em cada cliente por causa do `c_site`
relativo (corrigido em 24/09). Se os seis parâmetros novos entrarem no mesmo
bloco, é **uma visita por cliente em vez de duas**. Isso é motivo suficiente
para o projeto 0 vir antes da recolagem.

---

# Projeto 0 — Motor de elegibilidade

## As doze dimensões

base, portal, perfil, usuário, empresa, matrícula, filial, centro de custo,
unidade administrativa, unidade de negócio, vínculo, sindicato.

`TRACKING_KEYS` vai de sete para treze, com os seis novos: `p_filial`,
`p_centro_custo`, `p_unidade_adm`, `p_unidade_negocio`, `p_vinculo`,
`p_sindicato`. `conversations` ganha as seis colunas. O bloco em
`apex/token-rastreio.sql` passa a cifrar os treze no mesmo token AES-GCM, sem
mudança de formato: cliente que não recolar continua funcionando com o que
manda.

**Origem decidida pelo dono:** os parâmetros vêm do APEX, não de consulta ao
ERP. Consultar o ERP por matrícula evitaria a recolagem, mas custaria uma
chamada por usuário por período de cache e dependeria do endpoint existir em
todas as bases.

`p_cod_candidato` fica **fora** da elegibilidade. Ele identifica fluxo de
candidato, não recorte de público, e oferecê-lo como filtro convidaria a
restringir conteúdo a um candidato específico.

## Toda dimensão é SINGULAR, e por quê

Decidido pelo dono em 24/09: empresa, filial, centro de custo, unidade
administrativa e unidade de negócio são a **alocação da pessoa**, não o conjunto
que ela gerencia. Vínculo é o vínculo empregatício dela (CLT, PJ, autônomo,
estagiário). Um valor por dimensão por pessoa, então o token carrega um valor e
o predicado compara um valor.

Isto resolve o furo que a simulação levantou. A pergunta era se um gestor
responsável por três centros de custo deveria alcançar conteúdo restrito a
qualquer um dos três; a resposta é que a dimensão não fala de quem gerencia, fala
de onde a pessoa está alocada. Registrado porque a alternativa (lista por
dimensão na identidade) mudaria o predicado, o token e as três telas, e alguém
vai propor isso de novo.

## A allowlist se preenche da estrutura do cliente, não da digitação

Os valores dessas dimensões vivem nos **endpoints de estrutura do ERP**, e o
catálogo já tem seis ferramentas ATIVAS para eles: `estrutura_empresas`,
`estrutura_filiais`, `estrutura_centros_custo`, `estrutura_unidades_adm`,
`estrutura_vinculos_empregaticios` e `estrutura_sindicatos`.

Então a tela de elegibilidade não pede código digitado: ela lista a estrutura
real daquele cliente e o admin escolhe. Isso elimina de uma vez a classe de erro
mais provável nesta funcionalidade, que é restringir conteúdo ao centro de custo
"0100" quando o código é "100", e que falharia exatamente como as outras falhas
desta regra: sem erro, alcançando ninguém.

Junto com o diagnóstico de presença de dimensão, são duas camadas contra a regra
impossível: a escolha vem de uma lista real, e a tela avisa se aquela base nunca
enviou valor naquela dimensão.

> **Furo aberto: `unidade de negócio` não tem endpoint.** Busca no catálogo por
> `negocio` devolve ZERO ferramentas. As outras cinco dimensões novas têm de onde
> se preencher; esta não. Precisa de decisão do dono antes de o projeto 0
> começar: existe endpoint a cadastrar, o conceito equivale a outro já coberto,
> ou a dimensão sai da lista? Enquanto não houver origem, ela seria o único campo
> de digitação livre, e o único sem validação possível.

## A regra, uma vez só

Nasce `src/lib/elegibilidade/`:

- o tipo das doze dimensões, cada uma uma lista;
- o predicado em TypeScript;
- a frase em português, absorvendo `src/lib/prompts/elegibilidade.ts`
  (`resumoElegibilidade` e `avisoDeAlcance`, hoje com 16 testes).

No banco, `public.elegivel(regra jsonb, identidade jsonb) returns boolean`,
`immutable`, chamada por toda RPC que precise cortar antes de devolver linha.

Semântica, que é a convenção já usada no projeto:

- dentro de uma dimensão, **OU**;
- entre dimensões, **E**;
- `lower(btrim())` dos dois lados;
- cardinalidade zero significa **liberado**.

### Por que duas implementações e como elas não divergem

O corte precisa acontecer no banco porque `widget.js` é público (foi a decisão
tomada em `prompts_sugeridos`). A frase precisa existir em TypeScript porque é
a tela que a mostra enquanto o admin digita. Hoje essas duas metades já vivem
em linguagens diferentes e **nada garante que concordem**.

As duas passam a ler o **mesmo arquivo de casos**, um JSON com identidade,
regra e resultado esperado. Um teste roda o corpus nos dois lados e falha se
discordarem em um único caso. Sem isso, no dia em que alguém corrigir o
`btrim` só no TypeScript, a tela promete um alcance que o banco não entrega.

## Ausência fecha

Valor ausente contra dimensão restrita **não passa**. Decidido pelo dono, com
a alternativa (ignorar a dimensão ausente) recusada: ela faria um PDF de um
centro de custo vazar para a empresa inteira sem ninguém notar.

Vale igualmente para as dimensões antigas: token sem `p_empresa` já deveria
fechar hoje, e não é óbvio que fecha.

## Diagnóstico, sem restringir

A tela oferece as doze dimensões **sempre** (decisão do dono; a alternativa de
oferecer só o que a base envia foi recusada). Para que uma regra impossível não
vire chamado de suporte, a tela mostra ao lado se aquela base **já enviou algum
valor para a dimensão restringida**, lendo `vocabulario_rastreio(base)`, que já
existe e devolve `(campo, valor, conversas)`.

> **A primeira versão desta seção contava PESSOAS, e a simulação de 24/09
> derrubou.** `natcorp` tem 317 conversas e apenas 4 valores distintos de
> `p_usuario`; a maior base conhece 7 usuários. Um contador de alcance mostraria
> 0 ou 1 para qualquer regra, e seria impossível distinguir "regra impossível" de
> "pouca gente usou o chatbot". Presença de dimensão é diagnosticável com 7
> usuários; contagem de pessoas não é.

## Vazio na regra não pode abrir o que vazio na identidade fecha

Ausência no token fecha. Mas cardinalidade zero na regra significa liberado, e a
simulação mostrou o resultado: `{portal: [""]}` passa para qualquer um. São dois
"vazios" com efeitos opostos, num desenho que o dono pediu para falhar fechado, e
uma linha em branco salva por acidente transforma "restrito" em "todo mundo" sem
nenhum erro.

Três travas, porque uma só não pega:

- a tela nunca salva entrada vazia numa lista;
- a gravação recusa lista cujos itens sejam todos vazios depois do `btrim`;
- "sem restrição" é um **interruptor explícito** por dimensão, não a ausência de
  texto num campo. Campo em branco passa a ser estado inválido, não sinônimo de
  liberado.

## Consumidores

`prompts_sugeridos` migra para o motor. São dezesseis testes e a mudança é de
forma, não de comportamento.

`ai_base_tools` **não migra, de propósito**. Decisão do dono, e o motivo vai em
comentário para ninguém tentar unificar depois: allowlist de ferramenta decide
qual API o modelo pode chamar, allowlist de conteúdo decide quem pode ver um
documento. São perguntas diferentes que só por acidente têm a mesma forma. Além
disso, o funil de ferramentas é superfície medida, e mexer nele exigiria
`eval:tools` antes e depois.

## Testes

- unitários das doze dimensões: caixa, espaço nas pontas, cardinalidade zero,
  ausência, OU dentro e E entre;
- o corpus compartilhado rodando em SQL e em TypeScript, com falha na
  divergência;
- os dezesseis testes de `prompts_sugeridos` continuam passando sem alteração.

## Fora de escopo do projeto 0

Nenhuma tela de conteúdo, nenhuma campanha, nenhuma mudança no escopo do RAG,
nenhuma mudança em `widget_keys` ou `conversations.space_id`.

---

# Projetos 1 a 4 — decisões já tomadas

Registradas aqui para não se perderem; cada projeto ganha especificação
própria.

## Projeto 1 — Documentação anexável

**Eixo:** por cliente mais painel e perfil. A documentação se liga a
`ai_bases`, com allowlist, estruturalmente igual a `ai_base_tools`.

**Forma:** abordagem A, duas junções, com a correção de 24/09 descrita abaixo.
`knowledge_documents` ganha `base_id` mais allowlist, e `space_id` vira anulável
com CHECK de "ou documentação, ou base, nunca os dois". `chunks.space_id`
acompanha.

### A correção: universal e por cliente são DUAS tabelas

A primeira versão pôs a allowlist só em `ai_base_documentacoes`, que é por base.
Isso não fecha: documentação universal, por definição, não está anexada a base
nenhuma, então "esta documentação é só do portal do Gestor" não teria onde
existir, e a única saída seria anexar as universais a todas as bases, o que
destrói o sentido de universal.

Duas tabelas, com nomes diferentes de propósito:

- `documentacoes_universais (space_id, enabled, + allowlist)` — o conjunto que
  toda base alcança sem configuração, com a parametrização por portal e perfil
  morando aqui;
- `ai_base_documentacoes (base_id, space_id, enabled, + allowlist)` — o que é
  daquele cliente e só dele.

A fronteira é explícita e não há herança para depurar. O custo aceito é uma tela
a mais.

**E isto resolve de graça um furo separado:** existem quatro espaços `global`,
todos públicos, incluindo `manual` (o manual da própria plataforma, 60 artigos
publicados) e `natcorp-varejo-alimenticio` (15). Se "universal" significasse
`type='global'`, todo cliente passaria a pesquisar o manual da plataforma e a
documentação de um segmento que não é o dele. Com a tabela, universal é uma
linha que alguém escreveu, nunca um efeito colateral do tipo do espaço.

Recusadas: tabela genérica `ai_base_recursos` com `ref_id` polimórfico
(Postgres não põe chave estrangeira em coluna polimórfica, e apagar uma
documentação deixaria lixo apontando para o nada); e estender
`widget_key_spaces` (mantém a documentação pendurada na chave, que é o eixo
descartado).

**Persona:** só da chave de widget, por painel. `widget_keys.system_prompt` já
existe; o degrau da documentação sai da cascata. A voz é da Natcorp, o conteúdo
é do cliente.

> **Cuidado que a revisão desta especificação encontrou:** `spaces.chat_prompt`
> não serve só ao widget. O Ask-AI do portal usa a MESMA cascata, e ali a
> persona da documentação é legítima: quem lê a documentação da Natcorp está
> falando com o assistente daquela documentação. Tirar o degrau da cascata
> inteira deixaria o portal sem persona. O degrau sai **apenas do caminho do
> widget**; o portal continua lendo `spaces.chat_prompt`, e `/admin/assistente`
> passa a ser a tela de persona do portal, não do chatbot.

**Aditivo:** enquanto uma base não tiver documentação anexada, o RAG segue
usando os espaços da chave. Nada muda para quem não configurou, e a migração é
um cliente por vez.

**Universal por padrão:** a documentação do sistema é acessível por todas as
bases sem configuração, e a parametrização por portal existe porque há
documentação específica de portal.

## Projeto 2 — Conteúdos do cliente

Aba nova na gestão da IA pelo cliente. Qualquer mídia pode ser anexada para
download; para Word, PDF, PPT, TXT e MD o cliente decide se o conteúdo entra na
base de conhecimento, se fica disponível para download, ou ambos. Elegibilidade
nas doze dimensões.

Duas garantias que **saem de graça** do desenho do projeto 1, e vale registrar
que são estruturais e não configuração que alguém possa errar:

- o arquivo do cliente é invisível para o chatbot padrão da documentação,
  porque vive fora de qualquer espaço e o portal escopa por espaço;
- o arquivo não aparece na estrutura de publicação, porque a árvore visível é
  construída de `nodes` e arquivo de conhecimento não tem nó.

A policy `chunks_public_read` do `anon` exige `node_id` preenchido, então
arquivo não alcança o portal por construção. **Verificar com controle, não
presumir:** já houve caso neste projeto em que função `SECURITY INVOKER`
referenciando tabela sem grant derrubou a busca pública inteira, e o erro foi
engolido como lista vazia.

A ontologia permanece universal.

**Aceitar "qualquer tipo de mídia" para download reabre o guarda de arquivo.**
Existe `file-guard` com allowlist e verificação por magic-bytes, construído
justamente porque extensão não é tipo. Um arquivo aceito para download e servido
de volta ao navegador é vetor de XSS e de entrega de executável; o parâmetro de
download precisa definir também COMO o arquivo é servido (anexo com
`Content-Disposition`, tipo declarado pelo magic-byte e não pelo nome), e não só
se ele pode ser baixado.

## Projeto 3 — Comunicação e campanhas

Cliente agenda e dispara alertas pelo chatbot, com a mesma elegibilidade,
controle de quem visualizou, painel por campanha e drilldown de quem viu e quem
não viu. É um sistema de notificação com métricas; compartilha com os outros
apenas o motor do projeto 0.

**Escopo da primeira versão, decidido em 24/09: só QUEM VISUALIZOU.** O painel
mostra os que abriram o alerta, e não tenta mostrar os que não abriram.

O motivo é que "quem não visualizou" era incomputável: não existe cadastro de
usuários em nenhuma tabela, e o único universo disponível é "quem já usou o
chatbot" (a maior base conhece **7 usuários distintos**). Um painel de "não
visualizaram" sobre esse universo mediria adoção do chatbot enquanto parecesse
medir alcance da campanha, que é o pior tipo de número: completo na aparência e
falso no conteúdo.

Com o escopo reduzido, o denominador some e o que sobra é um fato: estes
visualizaram. O drilldown continua existindo, sobre quem visualizou.

**Consequência a respeitar no projeto:** nenhuma tela pode exibir percentual,
taxa de leitura ou gráfico de "lidos × não lidos", porque todos precisam do
denominador que não temos. Se alguém acrescentar isso depois sem trazer o roster,
o número vai parecer certo e estar errado. A porta para a versão completa é
buscar o roster no ERP, uma consulta por campanha e não por turno.

## Projeto 4 — Rodada 2 do desacoplamento

`widget_keys.space_id` vira anulável, `conversations.space_id` também (511
conversas hoje), a chave pode nascer sem documentação dona e as duas cascas
podem ser apagadas. Sequência decidida pelo dono: aditivo primeiro, desvincular
depois, cada rodada deployável sozinha.

---

# Riscos conhecidos

**O corte de dois grupos no RAG.** `hybrid_search_scoped` agrupa por origem e
deixa passar só os dois grupos mais fortes, para o chatbot não tecer passos de
manuais diferentes. Se um cliente anexar três documentações mais os arquivos
dele, o corte continua em dois por pergunta. Não é regressão, é o comportamento
atual, mas fica mais visível quando anexar passa a ser fácil. Mudar esse número
é decisão do dono e exige medição.

**Recolagem do bloco APEX.** Até um cliente recolar, as seis dimensões novas
chegam vazias e, pela regra de ausência fecha, qualquer restrição nelas não
alcança ninguém naquele cliente. O contador de alcance é o que torna isso
visível.

**Migração de `knowledge_documents`.** Tornar `space_id` anulável mexe numa
tabela que alimenta o RAG do portal e do widget. Precisa de teste de
isolamento contra o banco real, no molde de `.audit/gestao-isolamento-e2e.ts`.

## Achados da simulação adversarial de 24/09

O predicado passou nos 18 casos, incluindo caixa, espaço nas pontas, OU dentro,
E entre e ausência fechando. O que segue é o que estava em volta dele.

**Não há cerca no banco para o caminho do widget.** O widget usa service-role,
que ignora RLS. O isolamento entre clientes depende INTEIRAMENTE de a aplicação
montar a lista de ids certa. Já é assim hoje, então não é regressão, mas com
arquivo interno de cliente o custo de um erro passa de "resposta errada" para
"documento de um cliente exposto a outro". Proposta de defesa em profundidade:
`hybrid_search_scoped` recebe a base e recusa `document_id` que não pertença a
ela, dentro do banco, além do teste de isolamento.

**As policies precisam do ramo de `base_id`.** Verificado: `chunks_auth_read` é
`has_permission(auth.uid(), 'content.view', space_id)`, e `has_permission` com
espaço nulo reduz a "tem papel GLOBAL" (a cláusula é `m.space_id is null or
m.space_id = p_space_id`). Então arquivo de cliente com `space_id` nulo fica
legível por qualquer usuário interno com papel global e invisível para um Editor
restrito a um espaço. Não vaza para cliente, mas as policies precisam ganhar o
ramo de base ou as telas de admin param de ler o que acabaram de gravar.

O lado bom foi confirmado por leitura da policy, não presumido:
`chunks_public_read` exige `n.id = chunks.node_id`, então arquivo de cliente não
alcança o portal por construção.

**Multivalorado: levantado e RESOLVIDO.** A simulação perguntou se um gestor
responsável por três centros de custo deveria alcançar conteúdo restrito a
qualquer um deles. Resposta do dono: as dimensões são a alocação da pessoa, não o
que ela gerencia, e o vínculo é o empregatício. Todas singulares, o desenho está
certo como está. Ver "Toda dimensão é SINGULAR" no projeto 0.

**`ai_bases.active = false`: era FALSO POSITIVO meu.** Eu li "recebendo
conversa" como presente. As conversas de `leadec`, `saude`, `incor` e
`stefanini` são históricas, todas até 17/08, e as bases foram desativadas depois.
O dado está correto.

E o efeito que eu temia não existe: `widgetLiberado()` devolve falso quando
`baseAtiva` é falso, então **base desativada não abre o widget**. Esses clientes
não ficariam sem documentação, eles são barrados na porta, antes de qualquer
resolução de escopo. A consulta de documentação pode filtrar por `active` sem
consequência, porque nunca chega a rodar para uma base inativa.

Fica registrado porque o raciocínio errado é reutilizável: "tem tráfego" lido de
uma tabela de histórico não significa "está em uso hoje".

**Base órfã.** `teste_fatura` aparece em conversa e não existe em `ai_bases`.
Comportamento definido: alcança só o conjunto universal, nunca conteúdo de
cliente, e o painel de gestão passa a listá-la como base desconhecida em vez de
ignorá-la.

**`p_base` chega em caixas diferentes para o mesmo cliente** (`NATCORP` e
`natcorp`, `STEFANINI` e `stefanini`, `INCOR` e `incor`). O `lower(btrim())` dos
dois lados é necessário, não estilo. Normalizado, só `teste_fatura` fica órfã.

**Contexto que reduz o risco de tudo isto:** o tráfego de cliente parou em
17/08 em todas as bases exceto `natcorp`. O chatbot não está em uso diário pelos
clientes, então não há tráfego real para quebrar durante a reestruturação.
