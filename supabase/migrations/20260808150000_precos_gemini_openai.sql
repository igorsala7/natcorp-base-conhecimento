-- =====================================================================
-- PREÇOS CONFIRMADOS — Google Gemini e OpenAI
--
-- Fontes (conferidas em 08/08/2026):
--   · https://ai.google.dev/gemini-api/docs/pricing
--   · https://developers.openai.com/api/docs/pricing
--
-- Substituem as linhas que o seed anterior deixou com preço nulo e
-- `confirmado = false` de propósito, para não inventar número.
--
-- ── Sobre o multiplicador de LEITURA de cache ───────────────────────────
-- Os dois provedores publicam o preço do token cacheado em dólar, não como
-- multiplicador. A conversão é a divisão pelo preço de entrada, e dá 0,10 em
-- toda a linha Gemini e nos modelos gpt-5.x (US$ 0,15 ÷ US$ 1,50 no Flash;
-- US$ 0,03 ÷ US$ 0,30 no Flash-Lite; US$ 0,02 ÷ US$ 0,20 no gpt-5.6-luna) —
-- coincidentemente o mesmo desconto da Anthropic. A família gpt-4o é a exceção
-- notável: 0,50, cinco vezes menos vantajosa.
--
-- ── Sobre o multiplicador de ESCRITA ────────────────────────────────────
-- Fica 1,0 em Google e OpenAI, e isso NÃO é o valor conservador do padrão: é o
-- valor certo. Nenhum dos dois cobra prêmio para gravar no cache — a Anthropic
-- é a exceção, com 1,25× no TTL de 5 minutos. O cache explícito do Gemini tem
-- custo de ARMAZENAMENTO por hora, que é cobrado por tempo e não por token e
-- portanto não cabe nesta tabela; os dados confirmam que ele não está em uso
-- aqui — `cache_write_tokens` é zero em 15.525 de 15.525 chamadas Google e em
-- 686 de 686 chamadas OpenAI. Só a Anthropic reporta escrita, e mesmo lá em
-- apenas 5 de 1.612 chamadas (o `cacheControl` ephemeral entrou esta semana).
--
-- `on conflict … do update`: a linha de vigência 1970 já existe com preço nulo;
-- o que muda é o conteúdo dela, não a vigência. Preço novo no futuro entra como
-- LINHA NOVA com outra `vigente_desde`, e as faturas antigas continuam batendo.
-- =====================================================================

insert into public.ai_model_prices
  (provider, model, input_usd_mtok, output_usd_mtok, cache_read_mult, cache_write_mult, confirmado, fonte)
values
  -- ── Google Gemini ──────────────────────────────────────────────────
  ('google', 'gemini-3.5-flash',       1.50,  9.00, 0.10, 1.00, true, 'ai.google.dev/gemini-api/docs/pricing — 08/08/2026 (pago)'),
  ('google', 'gemini-3.5-flash-lite',  0.30,  2.50, 0.10, 1.00, true, 'ai.google.dev/gemini-api/docs/pricing — 08/08/2026 (pago)'),
  ('google', 'gemini-embedding-001',   0.15,  0.00, 1.00, 1.00, true, 'ai.google.dev/gemini-api/docs/pricing — 08/08/2026 (sem cache)'),
  -- ── OpenAI ─────────────────────────────────────────────────────────
  -- `gpt-5.6-luna` é o que está configurado hoje (editor_text); os demais
  -- entram porque cadastrar preço custa uma linha e descobrir preço faltando
  -- no fechamento do mês custa uma fatura.
  ('openai', 'gpt-5.6-luna',           0.20,  1.20, 0.10, 1.00, true, 'developers.openai.com/api/docs/pricing — 08/08/2026'),
  ('openai', 'gpt-5.6-terra',          2.00, 12.00, 0.10, 1.00, true, 'developers.openai.com/api/docs/pricing — 08/08/2026'),
  ('openai', 'gpt-5.6-sol',            5.00, 30.00, 0.10, 1.00, true, 'developers.openai.com/api/docs/pricing — 08/08/2026'),
  ('openai', 'gpt-5.5',                5.00, 30.00, 0.10, 1.00, true, 'developers.openai.com/api/docs/pricing — 08/08/2026'),
  ('openai', 'gpt-4o',                 2.50, 10.00, 0.50, 1.00, true, 'developers.openai.com/api/docs/pricing — 08/08/2026'),
  ('openai', 'gpt-4o-mini',            0.15,  0.60, 0.50, 1.00, true, 'developers.openai.com/api/docs/pricing — 08/08/2026'),
  ('openai', 'gpt-3.5-turbo',          0.50,  1.50, 1.00, 1.00, true, 'developers.openai.com/api/docs/pricing — 08/08/2026 (sem cache)'),
  ('openai', 'text-embedding-3-small', 0.02,  0.00, 1.00, 1.00, true, 'developers.openai.com/api/docs/pricing — 08/08/2026'),
  ('openai', 'text-embedding-3-large', 0.13,  0.00, 1.00, 1.00, true, 'developers.openai.com/api/docs/pricing — 08/08/2026'),
  ('openai', 'text-embedding-ada-002', 0.10,  0.00, 1.00, 1.00, true, 'developers.openai.com/api/docs/pricing — 08/08/2026')
on conflict (provider, model, vigente_desde) do update set
  input_usd_mtok   = excluded.input_usd_mtok,
  output_usd_mtok  = excluded.output_usd_mtok,
  cache_read_mult  = excluded.cache_read_mult,
  cache_write_mult = excluded.cache_write_mult,
  confirmado       = excluded.confirmado,
  fonte            = excluded.fonte;

-- ── O que continua SEM preço, e por quê ─────────────────────────────────
-- `gpt-5.2` e `gpt-5.4` aparecem no histórico (último uso 03/08 e 30/07) e não
-- constam mais na tabela pública da OpenAI. Ficam sem preço em vez de receberem
-- um valor deduzido: eles já saíram da configuração, então isso só afeta o
-- CUSTO exibido em relatórios de períodos passados, e um número inventado ali
-- seria pior que uma célula vazia.
--
-- `whisper-1` (transcrição) não entra nesta tabela por outro motivo: áudio é
-- cobrado por MINUTO, não por token, e a chamada em `lib/ext/transcribe.ts` nem
-- passa pelo registro de consumo. É um custo real fora deste relatório.
