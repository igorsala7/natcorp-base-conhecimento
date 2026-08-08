-- =====================================================================
-- TOKENS DE CACHE EM `ai_usage` — sem isto não dá para faturar direito
--
-- `input_tokens` sempre foi o TOTAL de entrada, misturando três coisas que os
-- provedores cobram com preços muito diferentes:
--
--   · entrada nova        1,00×  (preço de tabela)
--   · leitura de cache    0,10×  (Anthropic; ~10% do preço)
--   · escrita de cache    1,25×  (Anthropic; o prefixo entra caro uma vez)
--
-- O SDK já devolve essa quebra (`usage.inputTokens.cacheRead` / `.cacheWrite`);
-- o middleware apenas a descartava. Medido num turno real do chat: 59.461 de
-- entrada, dos quais 29.139 eram leitura de cache. Cobrando tudo a preço cheio,
-- a conta sai ~45% acima do custo real — e num produto que repassa o consumo ao
-- cliente, isso é a diferença entre uma fatura correta e uma indefensável.
--
-- Colunas novas, `default 0`: o histórico já gravado fica com zero, que é a
-- leitura honesta ("não sabemos a quebra desses"), e não uma estimativa
-- inventada retroativamente.
-- =====================================================================

alter table public.ai_usage
  add column if not exists cache_read_tokens  integer not null default 0,
  add column if not exists cache_write_tokens integer not null default 0;

comment on column public.ai_usage.cache_read_tokens is
  'Parte de `input_tokens` servida do cache de prompt do provedor (cobrada a ~10% na Anthropic). Já está DENTRO de input_tokens — não somar.';
comment on column public.ai_usage.cache_write_tokens is
  'Parte de `input_tokens` gravada no cache de prompt (cobrada a ~125% na Anthropic). Já está DENTRO de input_tokens — não somar.';

-- Faturamento consulta por período + cliente; sem índice isso vira varredura.
create index if not exists ai_usage_periodo_idx
  on public.ai_usage (created_at desc);
create index if not exists ai_usage_base_periodo_idx
  on public.ai_usage (p_base, created_at desc)
  where p_base is not null;
