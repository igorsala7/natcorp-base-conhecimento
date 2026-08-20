---
name: agent-audit
description: Audita sistemas multi-agente de IA generativa (RAG + ontologia + tools) medindo consumo real de tokens por camada, sobreposicao semantica entre tools, iteracoes do loop de execucao e eficacia do cache de prompt. Use SEMPRE que o usuario mencionar custo ou consumo de tokens, contexto inchado, prompt grande demais, agente escolhendo a tool errada, confusao entre tools, latencia alta do chatbot, cache de prompt, ou pedir avaliacao/revisao da arquitetura de um agente LLM. Use tambem quando ele descrever sintomas sem nomear a causa -- "mensagem simples custa caro", "a IA se perde", "nao sei qual agente esta gastando" -- e antes de qualquer refatoracao de prompt ou de tools, para estabelecer baseline mensuravel.
---

# Agent Audit

Auditoria quantitativa de sistemas multi-agente. Substitui opiniao sobre arquitetura por medicao.

## Principio que governa esta skill

**Nao sugira nenhuma otimizacao antes de ter numero.** Recomendacao de arquitetura sem medicao e chute com vocabulario tecnico. O usuario ja consegue chute sozinho; o valor aqui e a medicao.

Corolario: **toda recomendacao sai acompanhada do numero que a sustenta e do numero que a validaria depois.** "Reduza as tools" nao serve. "O agente financeiro carrega 18.400 tokens de schema por chamada, em media 1,2 tool usada por turno; carregamento por dominio derruba para ~4.000, e a validacao e a acuracia de selecao no eval set antes e depois" serve.

## Fluxo

Rode em ordem. Cada etapa depende da anterior.

### 0. Verificar pre-requisitos

```bash
python -c "import yaml, numpy, sklearn" 2>&1
pip install anthropic pyyaml numpy scikit-learn 'psycopg[binary]'
```

`ANTHROPIC_API_KEY` e obrigatoria para a contagem de tokens (`count_tokens` nao consome creditos, mas exige chave).
`SUPABASE_DB_URL` so se a extracao vier do banco -- e a connection string direta do Postgres, nao a anon key.

Se `audit.config.yaml` nao existir, copie de `audit.config.example.yaml` e **investigue o schema real antes de preencher**. Nao chute nomes de tabela. Inspecione:

```bash
psql "$SUPABASE_DB_URL" -c "\dt"
psql "$SUPABASE_DB_URL" -c "\d nome_da_tabela"
```

Confirme o mapeamento com o usuario antes de rodar as queries.

### 1. Extrair e normalizar

```bash
python scripts/extract.py --config audit.config.yaml
```

Gera `.audit/agents.json`. Confira a saida: se a contagem de tools ou o tamanho do prompt divergir do que o usuario espera, pare e resolva. Auditoria sobre extracao errada e pior que nenhuma auditoria.

### 2. Medir tokens por camada

```bash
python scripts/count_tokens.py --model <modelo-de-producao>
```

Use o modelo que roda em producao -- tokenizacao varia entre familias.

A medicao e diferencial: mede requisicoes cumulativas e subtrai, isolando o custo marginal de cada camada. Isso captura o overhead de serializacao das tools, que estimativa por caractere nao ve.

Leia `references/thresholds.md` para interpretar os numeros.

### 3. Detectar sobreposicao entre tools

```bash
python scripts/tool_overlap.py --agent <maior-agente> --top 15
```

**O script produz suspeitas, nao veredito.** TF-IDF pega vocabulario compartilhado e parafrase leve; nao pega sinonimo puro. Depois de rodar:

1. Leia cada par acima do limiar e julgue se confundiria um humano do dominio.
2. Cruze com os erros reais do eval set -- par com score alto e erro observado e prioridade maxima.
3. Para cada par confirmado, decida: fundir numa tool com parametro discriminante, reescrever as descricoes para se oporem explicitamente, ou separar em dominios que nunca carregam juntos.

Pares com score alto e zero erro no eval nao sao problema. Nao invente trabalho.

### 4. Analisar o loop de execucao

```bash
python scripts/trace_analysis.py --from-supabase --top 5
```

Costuma ser a etapa que mais surpreende. Um turno de usuario nao e uma chamada ao modelo: se o modelo chama duas tools, sao tres chamadas, cada uma reenviando o contexto inteiro e crescendo.

Se nao houver traces, **pare e instrumente primeiro** -- veja `references/instrumentation.md`. Sem trace voce nao consegue distinguir "prompt grande" de "loop iterando demais", e o tratamento e completamente diferente.

### 5. Verificar o cache

```bash
python scripts/cache_check.py .audit/req_turno1.json .audit/req_turno2.json
```

Capture as duas requisicoes em turnos diferentes e distantes no tempo (dias diferentes expoem instabilidade por data). Compare com `cache_read_input_tokens` dos traces: prefixo estavel e cache zerado significa que `cache_control` nao esta sendo enviado ou o TTL nao cobre o intervalo entre chamadas.

### 6. Consolidar

Escreva o relatorio em `.audit/RELATORIO.md`. Estrutura em `references/report_template.md`.

Ordene os achados por **impacto x esforco**, nao por gravidade. Cache de prompt quebrado costuma render mais que reescrever o prompt, e leva uma tarde em vez de duas semanas.

## Limites desta auditoria

Diga isto ao usuario, sem enfeitar:

- Mede **custo e sinais de confusao**. Nao mede assertividade. Duas tools indistinguiveis sao um risco medido; a taxa real de erro so sai do eval set.
- Se o usuario ainda nao tem eval set, esse e o item numero um do relatorio, acima de qualquer otimizacao. Sem baseline, toda mudanca proposta aqui e irreversivel na pratica: ninguem consegue provar que nao quebrou nada.
- Amostras de RAG e resultado de tool precisam vir de execucao real. Amostra inventada gera numero bonito e inutil.

## Erros a nao cometer

- **Nao rode `count_tokens.py` em loop sobre centenas de tools sem avisar.** E uma chamada de rede por tool.
- **Nao proponha unificar tools sem olhar o input_schema.** Nomes parecidos com parametros diferentes podem ser corretamente distintas.
- **Nao trate score alto de similaridade como bug.** Duas tools do mesmo dominio se parecem por construcao. O bug e quando o modelo erra entre elas.
- **Nao recomende quebrar agentes sem contar o custo do handoff.** Cada agente que entra na cadeia recarrega prompt e schemas proprios. Roteamento unico e barato no inicio > cadeia de agentes conversando.
- **Nao escreva no banco.** Esta skill so le. Se precisar de DDL ou UPDATE, proponha o SQL e deixe o usuario rodar.

## Referencias

- `references/thresholds.md` -- limiares e como interpretar cada metrica
- `references/instrumentation.md` -- como logar traces no Supabase (schema + trigger)
- `references/remediation.md` -- catalogo de correcoes por tipo de achado
- `references/report_template.md` -- estrutura do relatorio final
