# Síntese das três auditorias — 20/08/2026

Três especialistas mediram o motor de IA em contextos separados, depois cada um
recebeu os achados dos outros dois e teve de responder o que contestava, onde
conflitava e o que reconhecia ser melhor que a própria proposta.

O que segue é o que **sobreviveu** à crítica. Proposta derrubada não entra.

---

## O que a crítica cruzada matou

### 1. "O bloco de definições de ferramenta é 66% do gasto" — errado

O prompt-auditor chegou a esse número por **resíduo**: mediu o total, subtraiu o
que tinha rótulo, e chamou a sobra de "ferramentas". Os outros dois desmontaram
por caminhos independentes:

- **Tamanho real das definições** (tool-schema): ferramenta de integração = 182
  tok em média; as 23 locais somam 5.744. Com a mediana de 16,3 ferramentas por
  turno, o bloco dá **~5,5k tok** — não 16k–40k.
- **O resíduo cresce com DADO, não com contagem** (tool-schema): a mesma faixa
  de 5–8 ferramentas custa 15.058 tok sem dataset e **31.136 com** (+16.078).
- **O contador de histórico só soma texto** (rag): `historyTok` conta apenas
  `typeof m.content === "string"` (`route.ts:2566`). Resultado de ferramenta de
  passo anterior, anexo e imagem caem inteiros no resíduo.
- **Turnos com ZERO ferramentas têm resíduo de 45.077 tok** (rag). Zero.

**O que sobra de pé:** a reta `GAP = 15.764 + 1.217 × n_tools`. O intercepto —
15,8k tok que existem antes da primeira ferramenta — é a maior fatia isolada
medida, e **ninguém sabe do que ele é feito**. É o próximo número a levantar.

### 2. "O RAG é irrelevante, encolheu de 15k para 5,4k" — errado

Não encolheu: **mudou de balde**. O regime `PROMPT_DADOS_FORA_DO_SYSTEM` de
18/08 tirou o RAG do system prompt e o pôs no bloco `pergunta` — e **98,8% do
bloco `pergunta` É o bloco `rag`** (4.325 tok contra 4.274). O prompt-auditor
mediu o system depois da mudança e concluiu ausência onde havia mudança de
lugar. Peso real, reenviado nas 2,04 chamadas do laço: **9,0% da entrada**.

### 3. "Os loops fantasma causam 27% das chamadas redundantes" — errado

Era meu erro de atribuição, e o prompt-auditor o derrubou com a decomposição
certa: o laço roda **dentro de um passo**, então a única assinatura que ele pode
deixar é URL repetida no mesmo `step_index`. Verifiquei em `bi_avaliacoes`:

| das 169 execuções em 60 dias | |
|---|---|
| passos distintos e legítimos | 121 |
| duplicata no MESMO passo — **o laço** | 24 |
| repetição entre passos — **o modelo insistindo** | 24 |

O "21×" que eu citei somava as três coisas e creditava tudo ao laço.

**O conserto continua certo, por outro motivo:** aquelas 24 requisições não são
caras, são **falsas** — voltam idênticas e aparecem numa coluna "Competência"
como meses diferentes. Corrigido por correção, não por custo. Os três auditores
convergiram nisso, e dois o colocaram acima dos próprios achados.

---

## O que sobreviveu, em ordem de assertividade ÷ risco

### 1. Truncagem da ontologia sem ranking — nos DOIS lados

Achado independente de dois auditores, em arquivos diferentes, com o mesmo
formato de defeito: uma lista relevante é cortada **por ordem de chegada**.

- **Lado do catálogo** (`ontology-enrich.ts`): a ontologia casa 21.840 formas,
  média de **248 por ferramenta**. O corte é `.slice(0, 40)`, sem ordenar.
  **85 de 88 ferramentas (96,6%) estouram**, e **84% do que casou é descartado**
  por chegar depois.
- **Lado da consulta** (`expandirConsultaLexica`): 65 formas truncadas para 12,
  mesma ausência de ranking.

Por que decide: nos 689 turnos com top-K medido, a similaridade do 1º é 0,682 e
a do 2º é 0,656 — **gap mediano de 0,020**, e em **46,9% dos turnos** os dois
estão a menos de 0,02 um do outro. Quais 40 dos 248 sinônimos entram no vetor é
sorteio, e o sorteio roda dentro de uma faixa **menor que o próprio gap**.

Custo do conserto: ordenar antes de cortar. Nenhum schema muda.

### 2. `ontology_terms.node_id` NULL em 5.569/5.569

A injeção forçada de termo nunca roda — a condição nunca é verdadeira. Código
morto verificável, confirmado por dois auditores. Conserto de custo zero.

### 3. Top-K largo demais: precisão de 4,2%

Em 617 turnos, 4.596 ferramentas ofertadas e **193 chamadas**. E a cauda é
plana o suficiente para cortar:

| rank por similaridade | ofertas | usos | taxa |
|---|---|---|---|
| 1–3 | 3.115 | 372 | 11,9% |
| 4–8 | 2.878 | 141 | 4,9% |
| **9+** | **1.391** | **11** | **0,8%** |

**Top-8 preserva 97,9% dos usos e elimina 20,6% das vagas.** `TETO_DURO_TOOLS`
está em 12 — quatro posições largo. O teto base de 6 está certo.

Ressalva do próprio auditor: o gabarito (n=27) não confirma nem contradiz.
Antes de mexer, medir contra `eval/cenarios.jsonl`.

### 4. O cache morre antes de ser lido

A lista de ferramentas muda em **85,5%** dos pares consecutivos e, dentro do TTL
de 5 min, **51,3% divergem já na ferramenta nº 1**. Como `tools` é a posição 0
do payload, o prefixo está morto antes do system prompt. Prefixo idêntico médio:
4,2 de 16,4 ferramentas (25,8%).

**Consequência que reordena tudo:** enquanto isso for verdade, nenhuma mudança
no system prompt tem efeito de cache. Otimizar prompt antes de estabilizar a
ordem das ferramentas é otimizar atrás de uma parede.

### 5. Sinais do RRF: medido que MUDA, não medido que MELHORA

- `p_group_limit` 2 vs 4 muda o conjunto em **57 de 60 turnos (95%)**
- ontologia muda o topo em **53 de 54 (98,1%)**
- trigram vem **vazio em 45%** dos turnos, trazendo 1,9 candidato — um sinal com
  peso RRF igual que quase sempre se abstém, e que custa **79% da latência** da
  RPC (1.976 ms de 2.500)
- **3 de 60 (5%)** não devolvem nada

O próprio rag-auditor marcou o teto honesto disto: **direção desconhecida**. Sem
gabarito, mexer em peso é o erro que originou toda esta linha de trabalho.

### 6. Avarias pontuais, conserto de uma linha

- `_oauth/token (body)`: **137/137 falham** a 267 ms, antes de cada autenticação
  em ~46 conversas. A variante `(basic)` é 181/181 ok a 104 ms.
- `sesmt_procedimentos`: 8/8 ORA-06553, e ofertada 24 vezes desde 05/08.
- 41 respostas "não encontrei" **carregando citação no mesmo turno**.

---

## O que já foi aplicado nesta rodada

| conserto | verificação |
|---|---|
| 8 laços fantasma (a auditoria achou 7 — filtrou por `active`) | 31 → 26 com laço · **0 fantasmas** |
| `expandirValores`: separa por vírgula e deduplica | 5 testes novos; sem ele o conserto acima não funcionaria |
| Reindex dos artigos com um chunk só | **78 → 0** acima de 700 tok · maior 60.027 → 682 |

---

## O que continua sendo o gargalo de todo o resto

**Não existe gabarito de recuperação.** Os itens 3 e 5 param em "medi que muda",
nunca em "medi que melhora" — e é exatamente assim que se troca um defeito por
outro com números na mão. ~40 perguntas reais anotadas, estratificadas por tipo,
é o que destrava os dois.
