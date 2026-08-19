# Arquitetura da IA — agentes, ferramentas, chat e dados

> Mapa de quem decide o quê no caminho de uma pergunta até a resposta, e **onde
> olhar** quando alguma coisa sai errada.
>
> A ordem do pipeline abaixo não foi lida do código: saiu de **624 turnos reais**
> de `ai_chat_traces` (10 dias, 18/08/2026), pela posição média de cada passo. O
> código diz o que *pode* acontecer; o trace diz o que *acontece*.

---

## 1. As três portas de entrada

| App | Rota | Quem chama | Persistência |
|---|---|---|---|
| **Widget** | `POST /api/v1/chat` (SSE) | `public/widget.js` dentro do ERP APEX do cliente | `conversations` + `messages` |
| **Portal** | `POST /api/portal/chat` | leitor do portal público | idem |
| **Admin** | `POST /api/chat` | editor logado | idem |

O widget é o caminho mais rico e o único com ferramentas de integração. Ele é um
IIFE de ~8 mil linhas em Shadow DOM, servido como estático com
`Cache-Control: no-cache` — **um refresh na página do cliente já traz a versão
nova**, sem deploy do host.

**Identidade** vem de um token de rastreio (`data-token` no script ou `?kbt` na
URL), cifrado por espaço em `space_tracking_keys`. Dele saem `p_base`,
`p_usuario`, `p_portal`, `p_perfil`. Sem token, a sessão é anônima e cai no
`session_id` do `localStorage`.

---

## 2. O pipeline de um turno, na ordem medida

Cada linha é um passo de trace. O número é a **posição média** entre 624 turnos —
é por ele que se sabe se um passo rodou cedo ou tarde demais.

```
 0.0  mensagem                 a pergunta entra
 1.0  social                   saudação/cortesia? (desliga RAG e tools)
 1.0  query_rewrite            reescreve a pergunta no vocabulário da documentação
 2.8  integracoes:analise      classificador: precisa de dados? quais MÓDULOS?
 3.8  identidade               quem é a pessoa, qual painel, é gestor?

      ── seleção de ferramentas (o funil) ──────────────────────────
 4.6  integracoes:resgate_recorte   traz tools do módulo que a semântica perderia
 4.9  integracoes:escopo            remove tool proibida NAQUELE painel
 5.5  integracoes:aprendizado       vizinhos por uso histórico (Nx, peso)
 6.2  integracoes:dependencias      puxa a tool que outra declara precisar
 6.5  integracoes:teto              corta até o teto (MAX_TOOLS_MODELO)
 8.0  integracoes:top_k             ranking semântico final → as N que vão
 9.1  integracoes:facetas           pergunta multi-intenção: cota por intenção
 9.7  integracoes:selecao_fraca     avisa quando nada passou do piso

      ── contexto ─────────────────────────────────────────────────
 9.0  ontologia                termos e sinônimos do cliente
 9.5  roteador_fonte           tela × documentação × ferramentas
10.9  rag                      busca híbrida nos chunks
11.9  recorte_colunas          estreita a tabela da tela
12.9  ferramentas              o conjunto FINAL entregue ao modelo
15.1  prompt_blocks            tamanho de cada bloco do system prompt

      ── execução ─────────────────────────────────────────────────
21.7  tool_call                o modelo pediu uma ferramenta
23.4  integracoes:curl         a chamada HTTP que saiu (segredos redigidos)
20.5  integracoes:guard        verificação de permissão no servidor
24.0  tool_fim                 ok / erro
24.3  tool_result              bytes, total, amostra — só quando vira dataset
20.4  resposta                 tokens, passos usados, cache
20.5  fim                      desfecho
```

> Os passos de execução aparecem com posição média *menor* que `resposta` porque
> o laço agêntico repete: um turno com 4 passos intercala `tool_call` e resposta
> parcial várias vezes.

---

## 3. Seleção de ferramentas — o funil

É o subsistema com mais partes móveis e a origem mais comum de "o agente não
achou a ferramenta" **e** de "o agente gastou 200 mil tokens".

| etapa | o que faz | falha típica |
|---|---|---|
| `analise` | classifica em MÓDULOS de negócio | `precisaDados: false` numa pergunta que precisava |
| `resgate_recorte` | reinjeta tools do módulo | — |
| `escopo` | corta por painel (`panel_scope`) | tool some sem o modelo saber por quê |
| `aprendizado` | vizinhos por uso passado | reforça o que já era escolhido, ignora o novo |
| `dependencias` | puxa pré-requisito declarado | dependência não declarada → tool sozinha e inútil |
| `teto` | corta até `MAX_TOOLS_MODELO` | **corta a tool que outra precisava** |
| `top_k` | ranking semântico | piso alto demais → `selecao_fraca` |
| `facetas` | cota por intenção em pergunta composta | — |

**A composição é onde mora o defeito.** Cada etapa está certa isolada; o
problema aparece quando o `teto` remove justamente o que o `guard` de outra
ferramenta iria exigir. Nenhum teste unitário olha para isso — só o trace.

Sinal de alarme no trace: **`ferramentas` com 4 itens** quando os turnos vizinhos
têm 18. Significa que uma tool foi *forçada* e o conjunto colapsou; se ela
falhar, o agente não tem plano B e repete a mesma chamada até o teto de passos.

---

## 4. Guards — permissão no servidor

Rodam **entre** o modelo pedir e a chamada sair. O modelo não participa e não
contorna. Definidos em `ai_tools.guard`, lógica em `src/lib/integrations/guards.ts`,
metadados em `guard-catalog.ts` (um teste garante que os dois não divergem).

| guard | regra | uso |
|---|---|---|
| `escopo_pessoa` | PO=todos · PG=só a equipe · PC=só os próprios | 23 tools |
| `escopo_painel` | usa o `panel_scope` configurado na tool | 1 |
| `team_membership` | alvo tem de estar na equipe do gestor | — |
| `processo_do_candidato` | candidato só vê a requisição do processo dele, sem remuneração | 1 |
| `confirmation` / `saque_confirmation` | código por e-mail antes de gravar | 4 |
| `confirmation_detalhada` | mostra destinatário e conteúdo reais antes de enviar para fora | 4 |

**Falha fechada:** guard com nome desconhecido bloqueia.

> **Ler o trace, nunca a resposta.** Um agente que falha inventa explicações
> plausíveis usando o vocabulário do sistema ("validação", "permissão"). Isso é
> saída do modelo, não evidência. Só `integracoes:guard` e `tool_fim` provam o
> que aconteceu. *(Aprendido errando, 18/08/2026.)*

---

## 5. Dados que o modelo vê

### Dois portões de dataset — e eles não são simétricos

| portão | origem | limpeza de HTML | id |
|---|---|---|---|
| `registrarDataset` | retorno de API de integração | `limparMarcacaoHtml` no `tool-builder` | `ds1`, `ds2`… |
| `registrarTabelaTela` | tela do widget / coleta do IR | `celulaDataset` | `tela1`, `tela2`… |

**Os ids valem só dentro do turno.** Um `dados_de: "tela1"` citado no turno
seguinte falha com *"Nenhuma tabela foi carregada neste turno"* — causa comum de
"o agente se perdeu".

### Amostra

Resultado grande não vai inteiro: `linhasQueCabem` soma linha a linha até
`MAX_CHARS_AMOSTRA` (60.000) ou `MAX_ITENS_MODELO` (50). O que vai ao modelo
leva `_total`, `_amostra` e `_nota` mandando usar as ferramentas de dados para
contagem — **ou** `_completo`, quando a lista inteira coube.

`_completo` errado é pior que amostra pequena: o modelo conclui pela amostra
achando que tem tudo.

### Ferramentas de dados (não são de integração)

`consultar_registros`, `agregar_valores`, `estatisticas`, `agrupar`, `calcular`,
`derivar_coluna` — operam sobre **100%** do dataset no servidor, não sobre a
amostra. É o que torna contagem e soma exatas.

---

## 6. Modelo de dados

```
conversations   id, space_id, session_id, p_base, p_usuario, p_portal, created_at
messages        id, conversation_id, role, content, citations, payload,
                media, attachments, tokens, input_tokens, output_tokens, turn_id
ai_chat_traces  id, conversation_id, pergunta, fonte, desfecho, duracao_ms, passos(jsonb)
ai_tools        name, guard, panel_scope, exclude_self, loop, endpoint_kind…
ai_bases        base_url, credencial, is_global
ai_usage        tokens por provedor+modelo (faturamento)
```

**Histórico** é relido por identidade em `POST /api/v1/history`: casa por
(`p_base`, `p_usuario`, `p_portal`) e, sem eles, por `session_id`. Devolve a
conversa mais recente que casar.

---

## 7. Onde olhar quando…

| sintoma | primeiro lugar | o que procura |
|---|---|---|
| "perde as mensagens ao atualizar" | `messages` agrupado por `role` | desequilíbrio user × assistant = insert falhando |
| "não achou a ferramenta" | `ferramentas` e `integracoes:teto` | quantas foram ofertadas; o que foi cortado |
| "diz que não tem permissão" | `integracoes:guard` e `tool_fim` | se não houver passo, **não houve bloqueio** |
| "consumiu muito token" | `resposta.passos_usados` e `tool_result.bytes` | cada passo reenvia o contexto inteiro |
| "não baixa o arquivo" | `tool_fim` de `gerar_relatorio` | erro de fonte/encoding — o arquivo pode não existir |
| "se perdeu com o histórico" | ids `telaN`/`dsN` entre turnos | id de dataset não sobrevive ao turno |
| "resposta lenta" | `rag.ms` e `duracao_ms` | RAG costuma ser 4–5 s |
| "respondeu por conhecimento geral" | `rag.fontes` e `_sem_dados` | contexto fraco deveria virar recusa |

### Consumo por tipo de uso

```bash
node scripts/medir-consumo.mjs 24          # últimas 24h
node scripts/medir-consumo.mjs --desde 2026-08-19T00:24:00Z
```

Perfis medidos em 72h (mediana de tokens por turno):

| tipo | tokens | passos |
|---|---|---|
| Documentação (RAG) | 31.040 | 1 |
| Consulta a sistema (API) | 98.257 | 2 |
| Relatório / arquivo | 180.243 | 4 |
| Gráfico | 268.848 | 6 |

O custo cresce com o **número de passos do laço**, não com o tamanho da
pergunta: cada passo reenvia todo o contexto acumulado, resultados de ferramenta
incluídos.

---

## 8. Lacunas conhecidas (18/08/2026)

- ~~`tool_result` só em 42% das chamadas~~ — **fechado em 18/08/2026.** Eram 241
  `tool_result` para 576 `tool_fim`: nas outras 335 não havia rastro do que a
  ferramenta devolveu. Agora todo `tool_fim` carrega `forma` (tipo, bytes,
  chaves de topo, `vazio: true`), gravado no invólucro que embrulha TODA
  ferramenta — e não em cada ramo de loop, que é o que deixaria o próximo ramo
  novo descoberto. Nunca o conteúdo: o retorno tem dado de pessoa e o trace é
  lido no admin.

  Como usar: um `forma: {tipo:"objeto", vazio:true}` ao lado de `ok:true` explica
  na hora um agente que repete a mesma chamada — ele recebeu `{}` e não teve
  como saber que aquilo era a resposta.
- **Cache de prompt entre 21% e 38%**, contra ~70% esperado com prefixo estável.
- **Nenhum eval set.** Assertividade não é medida; só custo e sinal de confusão.
  Enquanto isso, toda mudança de prompt ou de seleção é irreversível na prática:
  não há como provar que não piorou.
