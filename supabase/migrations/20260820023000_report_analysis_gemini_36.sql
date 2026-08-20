-- =====================================================================
-- report_analysis: gemini-3.5-flash → gemini-3.6-flash
--
-- Única troca de modelo que a medição de 19–20/08/2026 sustenta.
--
-- Medido em 6 casos de resposta VERIFICÁVEL sobre uma tabela de 40 linhas
-- gerada pelo próprio script de teste (soma, contagem, média e maior valor são
-- conhecidos), mais dois casos que checam se o modelo INVENTA:
--
--   gemini-3.6-flash   6/6
--   gemini-3.5-flash   5/6   ← em uso; erra a soma de 40 valores
--
-- Mesmo provedor, mesma chave, mesmo preço de entrada (US$ 1,50/1M) e saída
-- MAIS BARATA (US$ 7,50 contra US$ 9,00). Não há contrapartida de custo.
--
-- O 3.6-flash já roda em produção na finalidade `chat` desde 15/08, então não é
-- um modelo novo entrando no sistema — é o mesmo, numa segunda finalidade.
--
-- ── O que esta troca NÃO resolve ────────────────────────────────────────
-- A fraqueza aritmética é geral: a soma de 40 valores derrubou 13 dos 23
-- modelos testados, incluindo toda a linha Opus. O que protege a resposta em
-- produção não é o modelo, é `agregar_valores`, que calcula o agregado exato
-- sobre 100% dos registros no servidor. Esta troca melhora o caso em que o
-- modelo responde sem chamar a ferramenta.
--
-- `provider_id` vem do próprio registro atual — o provedor não muda, então
-- lê-lo do banco evita fixar um UUID que difere entre ambientes.
-- =====================================================================

update public.ai_assignments
   set model = 'gemini-3.6-flash',
       updated_at = now()
 where purpose = 'report_analysis'
   and base_code = ''
   and model = 'gemini-3.5-flash';
