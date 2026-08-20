# Limiares e interpretacao

Numeros de referencia, nao lei. Ajuste ao dominio e registre o ajuste no relatorio.

## Turno minimo (system + schemas, antes de qualquer conteudo)

| Faixa | Leitura |
|---|---|
| < 8k | saudavel |
| 8k – 15k | aceitavel se o loop for curto |
| 15k – 25k | investigar; multiplica por chamada |
| > 25k | patologico em multi-chamada |

O que importa nao e o numero isolado e sim `turno_minimo x chamadas_por_turno`. 12k parece razoavel ate voce descobrir que sao 4 chamadas por turno.

## Tools por agente

| Faixa | Leitura |
|---|---|
| ≤ 12 | seguro |
| 13 – 20 | zona de atencao; medir acuracia de selecao |
| > 20 | degradacao provavel de selecao |
| > 30 | reestruturar, nao otimizar |

A degradacao vem da **sobreposicao**, nao da contagem. Vinte tools ortogonais funcionam melhor que oito quase iguais. Sempre cruze com `tool_overlap.py`.

## Sobreposicao (score TF-IDF hibrido)

| Score | Leitura |
|---|---|
| < 0.25 | distintas |
| 0.25 – 0.40 | vocabulario compartilhado, normal no mesmo dominio |
| 0.40 – 0.60 | suspeita; verificar contra o eval |
| > 0.60 | quase certamente confundiveis |

`max_sim` por tool (campo `tools_ambiguas`) e o sinal mais acionavel: mostra quais tools nao tem vizinhanca livre. Uma tool com `max_sim` de 0,7 vai ser escolhida errada em algum momento, independentemente de quantas tools existam no total.

## Chamadas ao modelo por turno

| Faixa | Leitura |
|---|---|
| 1 – 2 | esperado para consulta simples |
| 3 | aceitavel se houve 2 tools de fato |
| ≥ 4 | investigar cada uma |
| chamada sem tool | quase sempre desperdicio |

Chamada que nao produz tool call nem resposta final e o achado mais lucrativo da auditoria: custa contexto inteiro e nao entrega nada. Causa frequente: instrucao de "reflita antes de agir" ou "valide sua escolha" no system prompt.

## Cache de prompt

| Taxa | Leitura |
|---|---|
| 0% | cache nao configurado ou prefixo instavel |
| < 50% | prefixo quebrando com frequencia |
| 50 – 70% | parcial; ha volatil no meio do estavel |
| > 70% | funcionando |

Taxa = `cache_read / (cache_read + input_tokens)`.

Em loop de 3 chamadas o prefixo e lido 3x por turno, entao e onde o cache mais rende. Se a taxa esta baixa **apenas** em agentes de baixo trafego, o problema provavelmente e TTL, nao prefixo -- e a correcao e outra.

## Crescimento entre chamadas

Delta entre a primeira e a ultima chamada do turno. Acima de ~15k indica resultado de tool sendo reenviado integralmente a cada iteracao.

Confira antes de recomendar truncamento: se o resultado e pequeno e o crescimento vem do raciocinio acumulado, truncar nao resolve e pode quebrar a resposta.

## Ordem de prioridade sugerida

Impacto x esforco, do melhor para o pior retorno:

1. Cache quebrado — horas de trabalho, corta multiplos por chamada
2. Chamadas desperdicadas no loop — ajuste de prompt, elimina turno inteiro
3. Resultado de tool sem truncamento — mudanca localizada no orquestrador
4. Carregamento condicional de tools — dias, mas resolve custo e selecao juntos
5. Reescrita de descricoes sobrepostas — so as confirmadas pelo eval
6. Enxugar system prompt — ultimo, menor retorno, maior risco de regressao
