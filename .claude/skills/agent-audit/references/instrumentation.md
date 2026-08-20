# Instrumentacao de traces (Supabase)

Sem trace por **chamada ao modelo**, a auditoria fica cega para o multiplicador do loop -- que costuma ser a maior causa de custo. Se o projeto ainda nao loga isso, esta e a primeira tarefa.

Granularidade correta: **uma linha por chamada ao modelo**, nao por turno de usuario. Log por turno esconde exatamente o que precisa ser medido.

## Schema

Proponha ao usuario; nao rode DDL sozinho.

```sql
create table if not exists llm_calls (
  id                          bigint generated always as identity primary key,
  turn_id                     text        not null,
  conversation_id             text,
  agente                      text        not null,
  seq                         int         not null,   -- 0,1,2... dentro do turno
  model                       text        not null,
  input_tokens                int         not null,   -- cobrado, sem cache
  output_tokens               int         not null,
  cache_read_input_tokens     int         not null default 0,
  cache_creation_input_tokens int         not null default 0,
  n_tools_offered             int,
  tool_calls                  jsonb       not null default '[]'::jsonb,
  stop_reason                 text,
  latency_ms                  int,
  created_at                  timestamptz not null default now()
);

create index on llm_calls (turn_id, seq);
create index on llm_calls (created_at desc);
create index on llm_calls (agente, created_at desc);
```

`turn_id` e a coluna que sustenta a analise inteira. Gere um por mensagem de usuario e propague por todas as iteracoes do loop, inclusive atraves de handoff entre agentes -- e assim que o custo do handoff fica visivel.

## RLS

Tabela de telemetria interna. Com Supabase, RLS fica ativo e sem policy de leitura publica; a auditoria acessa via connection string direta (service role), que ignora RLS.

```sql
alter table llm_calls enable row level security;
```

Nao crie policy permissiva "so para facilitar". Volume de tokens por conversa e metadado sensivel.

## Captura no orquestrador

Toda resposta da API traz `usage`. O erro comum e registrar so `input_tokens` e concluir que o contexto e pequeno -- o que veio do cache nao aparece ali.

```typescript
// Edge Function / Deno
const res = await anthropic.messages.create({ model, system, tools, messages });

await supabase.from("llm_calls").insert({
  turn_id: turnId,
  agente: agentName,
  seq: seq++,
  model,
  input_tokens: res.usage.input_tokens,
  output_tokens: res.usage.output_tokens,
  cache_read_input_tokens: res.usage.cache_read_input_tokens ?? 0,
  cache_creation_input_tokens: res.usage.cache_creation_input_tokens ?? 0,
  n_tools_offered: tools.length,
  tool_calls: res.content.filter(b => b.type === "tool_use").map(b => b.name),
  stop_reason: res.stop_reason,
});
```

Use `waitUntil` ou fila para nao somar latencia do insert ao turno do usuario. Se falhar, degrade em silencio: telemetria nunca derruba a resposta.

## Capturar requisicoes para o cache_check

Dump da requisicao montada (antes de enviar), em dois turnos distantes:

```typescript
if (Deno.env.get("AUDIT_DUMP") === "1") {
  await supabase.storage.from("audit")
    .upload(`req_${turnId}_${seq}.json`, JSON.stringify({ system, tools }));
}
```

Guarde apenas `system` e `tools` -- e o prefixo cacheavel. `messages` contem dados do usuario e nao deve ir para o bucket.

Dois turnos do **mesmo dia** so pegam volatilidade obvia. Para expor data e timestamp no prefixo, compare turnos de dias diferentes.

## Consulta de sanidade

Antes de auditar, confirme que o log esta coerente:

```sql
select
  agente,
  count(*)                            as chamadas,
  count(distinct turn_id)             as turnos,
  round(count(*)::numeric
        / nullif(count(distinct turn_id),0), 2) as chamadas_por_turno,
  round(avg(input_tokens))            as media_cobrada,
  round(100.0 * sum(cache_read_input_tokens)
        / nullif(sum(input_tokens + cache_read_input_tokens),0), 1) as pct_cache
from llm_calls
where created_at > now() - interval '7 days'
group by agente
order by chamadas_por_turno desc;
```

Essa query sozinha ja costuma responder de onde vem o custo. `chamadas_por_turno` proximo de 1,0 significa que o `turn_id` nao esta sendo propagado -- corrija antes de seguir, ou a analise do loop sai errada.
