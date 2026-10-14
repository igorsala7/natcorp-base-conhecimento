-- =====================================================================
-- PROVEDOR MARITACA (Sabiá) + FINALIDADE "ocr" (leitura de documentos)
--
-- Fonte: docs.maritaca.ai (Modelos, Preços, Cache de Prompt, Processamento de
-- Documentos), lida em 13/10/2026.
--
-- 1) `ai_providers.kind` passa a aceitar 'maritaca'. A API é compatível com a
--    OpenAI (base https://chat.maritaca.ai/api); o código instancia o cliente
--    OpenAI apontado para lá (lib/ai/config.ts).
--
-- 2) `ai_assignments.purpose` ganha 'ocr'. Recria o CHECK com a lista
--    COMPLETA — recriar só com o valor novo derrubaria os anteriores.
--
-- 3) Preços. A Maritaca cobra em REAIS e esta tabela é em dólar. Não há câmbio
--    oficial a usar aqui, então as linhas entram com `input/output_usd_mtok`
--    NULOS e `confirmado = false`: aparecem marcadas no relatório e NÃO somam
--    custo em US$ até alguém cadastrar o valor em Sistema → Faturamento. Os
--    preços em R$ ficam na `fonte` para quem for converter.
--
--    O multiplicador de cache é exato: é uma RAZÃO (input em cache custa 1/4
--    do input), independe de moeda. Não há prêmio de escrita (cache automático).
--
-- Idempotente: re-rodável sem efeito colateral.
-- =====================================================================

alter table public.ai_providers
  drop constraint if exists ai_providers_kind_check;

alter table public.ai_providers
  add constraint ai_providers_kind_check
  check (kind in ('anthropic', 'openai', 'google', 'maritaca'));

alter table public.ai_assignments
  drop constraint if exists ai_assignments_purpose_check;

alter table public.ai_assignments
  add constraint ai_assignments_purpose_check
  check (purpose in (
    'chat', 'chat_ferramentas', 'report_analysis', 'query_rewrite', 'embedding',
    'import_structure', 'import_layout', 'editor_text', 'editor_generate', 'transcricao',
    'ocr'
  ));

insert into public.ai_model_prices
  (provider, model, input_usd_mtok, output_usd_mtok, cache_read_mult, cache_write_mult, confirmado, fonte)
values
  ('maritaca', 'sabia-4-thinking',       null, null, 0.25, 1.00, false, 'docs.maritaca.ai/pt/precos 13/10/2026: R$ 5,00 in / R$ 40,00 out por M; cache 1/4 do input'),
  ('maritaca', 'sabia-4-thinking-br-sp', null, null, 0.25, 1.00, false, 'docs.maritaca.ai/pt/precos 13/10/2026: R$ 6,50 in / R$ 52,00 out por M; cache 1/4 do input'),
  ('maritaca', 'sabia-4',                null, null, 0.25, 1.00, false, 'docs.maritaca.ai/pt/precos 13/10/2026: R$ 5,00 in / R$ 20,00 out por M; cache 1/4 do input'),
  ('maritaca', 'sabia-4-br-sp',          null, null, 0.25, 1.00, false, 'docs.maritaca.ai/pt/precos 13/10/2026: R$ 6,50 in / R$ 26,00 out por M; cache 1/4 do input'),
  ('maritaca', 'sabiazinho-4',           null, null, 0.25, 1.00, false, 'docs.maritaca.ai/pt/precos 13/10/2026: R$ 1,00 in / R$ 4,00 out por M; cache 1/4 do input'),
  ('maritaca', 'sabiazinho-4-br-sp',     null, null, 0.25, 1.00, false, 'docs.maritaca.ai/pt/precos 13/10/2026: R$ 1,30 in / R$ 5,20 out por M; cache 1/4 do input')
on conflict (provider, model, vigente_desde) do update set
  cache_read_mult  = excluded.cache_read_mult,
  cache_write_mult = excluded.cache_write_mult,
  fonte            = excluded.fonte;
