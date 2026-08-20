-- =====================================================================
-- PREÇO — google/gemini-3.6-flash
--
-- Informado pelo dono em 19/08/2026:
--   entrada  US$ 1,50 / 1M tokens
--   saída    US$ 7,50 / 1M tokens
--   cache    US$ 0,15 / 1M tokens (leitura)
--   armazenamento do cache explícito: US$ 1,00 / 1M tokens POR HORA
--
-- O modelo está EM PRODUÇÃO na finalidade `chat` desde 15/08 e não tinha linha
-- de preço: toda medição de custo devolvia célula vazia justamente na finalidade
-- mais cara por turno. Foi o que a rodada de ponta a ponta de 19/08 expôs.
--
-- ── Multiplicador de leitura: 0,10 ──────────────────────────────────────
-- US$ 0,15 ÷ US$ 1,50. O mesmo desconto do `gemini-3.5-flash`, e o mesmo da
-- linha Gemini inteira.
--
-- ── Multiplicador de escrita: 1,00, e o armazenamento fica de fora ──────
-- O Google não cobra prêmio para gravar (a Anthropic é a exceção, com 1,25×).
-- O custo de ARMAZENAMENTO de US$ 1,00/1M por hora pertence ao cache EXPLÍCITO
-- (a API `CachedContent`), que este sistema não usa: não há uma linha de código
-- que o crie, e `cache_write_tokens` é zero em todas as chamadas Google
-- registradas. Além disso ele é cobrado por TEMPO, não por token, e uma tabela
-- de preço por token não consegue representá-lo sem mentir. Se um dia o cache
-- explícito entrar, o custo por hora precisa de coluna própria — não de um
-- multiplicador torcido para caber aqui.
-- =====================================================================

insert into public.ai_model_prices
  (provider, model, input_usd_mtok, output_usd_mtok, cache_read_mult, cache_write_mult, confirmado, fonte)
values
  ('google', 'gemini-3.6-flash', 1.50, 7.50, 0.10, 1.00, true,
   'Informado pelo responsável — 19/08/2026 (entrada 1,50 · saída 7,50 · cache 0,15)')
on conflict (provider, model, vigente_desde) do update set
  input_usd_mtok   = excluded.input_usd_mtok,
  output_usd_mtok  = excluded.output_usd_mtok,
  cache_read_mult  = excluded.cache_read_mult,
  cache_write_mult = excluded.cache_write_mult,
  confirmado       = excluded.confirmado,
  fonte            = excluded.fonte;
