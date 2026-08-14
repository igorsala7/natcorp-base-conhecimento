-- APRENDIZADO: qual ferramenta foi de fato usada para cada tipo de pergunta.
--
-- A seleção de hoje é estática: o embedding da ferramenta contra o da pergunta,
-- e o texto do cadastro é o que alguém escreveu na descrição. Quando a pessoa
-- pergunta "quanto eu tenho pra receber", a ferramenta certa é a que a
-- EXPERIÊNCIA mostra — não a que tem a descrição mais parecida.
--
-- Aqui fica o histórico do que foi realmente CHAMADO, com o vetor da consulta
-- daquele turno. Na seleção seguinte, perguntas parecidas puxam para as
-- ferramentas que já funcionaram: um k-vizinhos sobre decisões passadas, que é
-- aprendizado sem treinar modelo nenhum — e, ao contrário de um modelo, dá para
-- olhar a tabela e entender por que ele escolheu.
--
-- Grava só o que teve EFEITO: a ferramenta foi chamada e a chamada deu certo.
-- Registrar oferta em vez de uso ensinaria o ranqueador a repetir os próprios
-- erros, porque a lista oferecida é justamente o que se quer corrigir.
create table if not exists public.ai_tool_uso (
  id uuid primary key default gen_random_uuid(),
  base_code text not null,
  tool_key text not null,
  -- A pergunta COM contexto (a reescrita que o roteador já usa), não a mensagem
  -- crua: "e do João?" sozinho não ensina nada.
  consulta text not null,
  embedding vector(1536) not null,
  ok boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists ai_tool_uso_base_idx on public.ai_tool_uso (base_code, created_at desc);
create index if not exists ai_tool_uso_emb_idx on public.ai_tool_uso
  using hnsw (embedding vector_cosine_ops);

alter table public.ai_tool_uso enable row level security;
revoke all on public.ai_tool_uso from anon, authenticated;

/**
 * Vizinhos: para uma consulta nova, quais ferramentas foram usadas em perguntas
 * parecidas — e quão parecidas.
 *
 * Devolve a soma das similaridades por ferramenta (não a contagem): dez
 * perguntas vagamente parecidas não devem pesar mais que duas quase idênticas.
 */
create or replace function public.tool_uso_vizinhos(
  p_base text,
  p_embedding vector(1536),
  p_limite int default 40,
  p_min_sim float default 0.60
) returns table (tool_key text, peso float, amostras int)
language sql stable as $$
  with viz as (
    select u.tool_key, 1 - (u.embedding <=> p_embedding) as sim
    from public.ai_tool_uso u
    where u.base_code = p_base and u.ok
    order by u.embedding <=> p_embedding
    limit p_limite
  )
  select tool_key, sum(sim)::float as peso, count(*)::int as amostras
  from viz
  where sim >= p_min_sim
  group by tool_key
  order by peso desc;
$$;

revoke all on function public.tool_uso_vizinhos(text, vector, int, float) from anon, authenticated;
