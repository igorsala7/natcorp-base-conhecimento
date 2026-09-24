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
vire chamado de suporte, cada regra mostra ao lado **quantos usuários daquela
base a alcançam hoje**, contados sobre o que já apareceu em `conversations`.
Zero com restrição preenchida fica visível no momento de salvar.

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

**Forma:** abordagem A, duas junções. Nasce `ai_base_documentacoes (base_id,
space_id, enabled, + allowlist)`. `knowledge_documents` ganha `base_id` mais
allowlist, e `space_id` vira anulável com CHECK de "ou documentação, ou base,
nunca os dois". `chunks.space_id` acompanha.

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
