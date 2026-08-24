# Qual modelo para qual eixo — medido em 24/08/2026

Primeira comparação dos dois modelos que a produção usa, com o instrumento
completo (`--funil --prompt-real --rag --fonte`), 138 casos do gabarito,
temperatura 0, duas rodadas do haiku.

| | gemini-3.5-flash | claude-haiku-4-5 |
|---|---|---|
| **ferramenta** | 64/125 | 65 · 64 /125 |
| **pergunta** | 111/125 | 111 · 111 /125 |
| **fonte exata** | **52/78** | 37 · 38 /78 |
| subentregou | **18** | 35 · 35 |
| trocou de fonte | 8 | 4 · 4 |
| usou fonte demais | 0 | 2 · 1 |
| **tokens de entrada** | **14.373** | 20.239 · 20.249 |

> **Nota de 24/08, depois desta tabela:** o eixo de fonte ainda contava 8 casos
> ESTRUTURALMENTE IMPOSSÍVEIS (rótulo cobra tela que o caso não tem, ou
> documentação que o turno não recuperou). Excluídos, o gemini fica em **52/70
> (74%)**, com 15 subentregas e 3 trocas. A comparação entre modelos acima não
> muda de sentido — os dois foram medidos com a mesma régua —, mas os números
> absolutos do gemini melhoram. Refaça os dois lados antes de citar valores.

## As duas leituras

**A escolha de FERRAMENTA não depende do modelo.** 64 contra 64–65, dois modelos
de famílias diferentes. Isso fecha uma porta importante: as propostas de funil e
de prompt que foram derrubadas nesta rodada não falharam por causa do modelo — o
teto é do sistema, e trocar de modelo não o move.

**A escolha de FONTE depende, e muito.** O haiku acerta 37–38 de 78 contra 52 do
gemini, e subentrega quase o dobro (35 contra 18). A diferença é de 14 a 15
casos, estável em duas rodadas — muito acima da faixa de ruído medida no
projeto (±2).

E ele gasta **41% mais token** para isso.

## Por que isso importa em produção

Medido em `ai_usage`: o haiku responde por **47,5%** das chamadas (483 de 875) e
o gemini por 36,4% (331). O modelo mais usado é o pior no eixo de fonte.

## O que NÃO está medido aqui

- **Qualidade da resposta.** Estes eixos medem seleção e uso de fonte, nunca se o
  dado entregue está certo. O haiku pode ser melhor exatamente ali, e nada nesta
  tabela contradiz isso.
- **Latência real e cache.** O eval não reflete `withPrefixCache`; e só o haiku
  honra `cacheControl` (o gemini usa cache implícito), então a conta de custo em
  produção não é a desta tabela.
- **Os outros dois modelos.** `gpt-5.6-terra` custa US$ 5,22 por rodada e estoura
  o teto de US$ 5 do próprio eval; `sonnet-5` não foi medido.
- **47 dos 125 casos** não pontuam no eixo de fonte porque `espera_fonte` herdou
  o cenário observado e ninguém conferiu.

## Como refazer

```
npm run eval:cenarios-modelo -- --casos eval/cenarios.jsonl \
  --modelos anthropic:claude-haiku-4-5 --funil --prompt-real --rag --fonte
```
