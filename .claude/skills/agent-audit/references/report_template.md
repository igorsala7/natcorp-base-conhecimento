# Template do relatorio

Salve em `.audit/RELATORIO.md`. Sem preambulo, sem elogio ao projeto, sem "excelente arquitetura". O leitor quer saber onde esta o dinheiro.

Numero primeiro, interpretacao depois. Se uma secao nao tem numero, ela nao entra.

---

```markdown
# Auditoria — <projeto> — <data>

## Resumo

<Tres a cinco linhas. O achado principal com o numero que o sustenta.
Exemplo: "Turno simples no agente financeiro consome 91k tokens de contexto
em 3 chamadas. 62% disso e o array de 40 tools, reenviado integralmente a cada
iteracao. Cache de prompt esta em 0% — o prefixo quebra na linha 1 do system
prompt, que injeta a data.">

## Como foi medido

- Modelo: <id>
- Periodo dos traces: <intervalo> — <n> turnos, <n> chamadas
- Fonte de prompts/tools: <supabase | arquivos>
- Amostras dinamicas: <de execucao real | ausentes — e o que isso limita>

## Por camada

| Agente | Tools | System | Schemas | Ontologia | RAG | Turno minimo |
|---|---|---|---|---|---|---|

Turno minimo = o piso antes de qualquer conteudo do usuario. Multiplique pelas
chamadas por turno para o custo real.

## Loop de execucao

| Agente | Chamadas/turno (mediana) | Contexto/turno (p90) | Cache | Chamadas vazias |
|---|---|---|---|---|

<Detalhe os 3 turnos mais caros: sequencia de chamadas, tokens em cada, tools
usadas. E aqui que o multiplicador fica visivel.>

## Sobreposicao entre tools

<So os pares acima do limiar. Para cada um: score, se ha erro correspondente no
eval, e a decisao proposta (fundir / reescrever / separar). Par com score alto e
zero erro observado entra como "monitorar", nao como acao.>

## Achados

Ordenados por impacto x esforco.

### 1. <titulo> — <CRITICO | ALTO | MEDIO>

- **Evidencia:** <numero medido, com o script que produziu>
- **Causa:** <mecanismo, nao sintoma>
- **Correcao:** <acao concreta; ver remediation.md>
- **Risco:** <o que pode quebrar>
- **Esforco:** <horas | dias | semanas>
- **Como validar:** <metrica que deve mudar, e a que NAO deve piorar>

## Limites

<O que esta auditoria nao mediu. Sempre inclua: assertividade nao foi medida —
so risco de confusao. Se nao ha eval set, diga que este e o item numero um,
acima de qualquer otimizacao aqui listada.>

## Baseline

<Tabela dos numeros de hoje, para comparar depois de cada mudanca. Sem isso o
relatorio vira opiniao arquivada.>
```

---

## Erros de redacao a evitar

- **Recomendacao sem numero.** "O prompt esta grande" nao e achado. "O system prompt do agente financeiro tem 14.200 tokens, 31% deles instrucoes de uso de tool duplicadas nos schemas" e.
- **Severidade inflada.** Se tudo e critico, nada e. Reserve CRITICO para o que custa dinheiro agora ou produz resposta errada.
- **Correcao sem risco.** Toda mudanca aqui pode degradar assertividade. Omitir isso num sistema que lida com dados de RH e irresponsavel.
- **Ordenar por gravidade em vez de retorno.** Cache quebrado costuma render mais que reescrever prompt, e leva uma tarde em vez de duas semanas.
