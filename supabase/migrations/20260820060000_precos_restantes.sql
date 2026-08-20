-- =====================================================================
-- PREÇOS DOS MODELOS QUE FALTAVAM — conferidos em 19–20/08/2026
--
-- Fontes: platform.claude.com/docs/en/about-claude/pricing e
--         ai.google.dev/gemini-api/docs/pricing
--
-- Estes sete entraram na comparação de 23 modelos e ficaram FORA da conta de
-- custo, porque não tinham linha aqui. O efeito não foi acadêmico: a estimativa
-- da rodada saiu ~US$ 33 quando o real passou de US$ 45, o crédito da Anthropic
-- acabou no meio e a produção ficou respondendo erro ao cliente.
--
-- Cadastrar preço de modelo que só se usa em teste parece burocracia até o dia
-- em que a estimativa que protege a produção depende dele.
--
-- Multiplicadores: Anthropic publica 0,1× leitura e 1,25× escrita (TTL 5 min)
-- para toda a linha. Gemini: cache 0,025 ÷ 0,25 e 0,03 ÷ 0,30 = 0,10, sem
-- prêmio de escrita.
-- =====================================================================

insert into public.ai_model_prices
  (provider, model, input_usd_mtok, output_usd_mtok, cache_read_mult, cache_write_mult, confirmado, fonte)
values
  ('anthropic', 'claude-opus-4-7',   5.00, 25.00, 0.10, 1.25, true, 'platform.claude.com — 20/08/2026'),
  ('anthropic', 'claude-opus-4-6',   5.00, 25.00, 0.10, 1.25, true, 'platform.claude.com — 20/08/2026'),
  ('anthropic', 'claude-opus-4-5',   5.00, 25.00, 0.10, 1.25, true, 'platform.claude.com — 20/08/2026'),
  ('anthropic', 'claude-sonnet-4-6', 3.00, 15.00, 0.10, 1.25, true, 'platform.claude.com — 20/08/2026'),
  ('anthropic', 'claude-sonnet-4-5', 3.00, 15.00, 0.10, 1.25, true, 'platform.claude.com — 20/08/2026'),
  -- Gemini com preço por MODALIDADE: aqui vai o de TEXTO, que é o uso deste
  -- sistema. Áudio custa o dobro no 3.1-flash-lite e não passa por aqui.
  ('google',    'gemini-3.1-flash-lite', 0.25, 1.50, 0.10, 1.00, true, 'ai.google.dev — 20/08/2026 (texto/imagem/vídeo)'),
  ('google',    'gemini-2.5-flash',      0.30, 2.50, 0.10, 1.00, true, 'ai.google.dev — 20/08/2026 (texto/imagem/vídeo)')
on conflict (provider, model, vigente_desde) do update set
  input_usd_mtok   = excluded.input_usd_mtok,
  output_usd_mtok  = excluded.output_usd_mtok,
  cache_read_mult  = excluded.cache_read_mult,
  cache_write_mult = excluded.cache_write_mult,
  confirmado       = excluded.confirmado,
  fonte            = excluded.fonte;
