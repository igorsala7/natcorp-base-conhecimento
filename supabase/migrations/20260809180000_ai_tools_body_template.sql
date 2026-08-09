-- =====================================================================
-- TEMPLATE DE CORPO para APIs com payload aninhado
--
-- O motor monta o corpo PLANO: `{a,b}`, `[{a,b}]` ou `{chave:[{a,b}]}` (ver
-- `envelopeBody`). Serve às APIs do ORDS, que recebem um registro raso. Não
-- serve ao Microsoft Graph — nem a quase nenhuma API moderna:
--
--   {"message":{"subject":"…",
--               "body":{"contentType":"Text","content":"…"},
--               "toRecipients":[{"emailAddress":{"address":"…"}}]}}
--
-- Com o template, a ferramenta declara esse formato UMA vez, com marcadores no
-- lugar dos valores. O modelo continua vendo parâmetros planos (`para`,
-- `assunto`, `corpo`), que é o que ele preenche bem; o aninhamento vira problema
-- do cadastro, não do modelo.
--
-- Nulo = comportamento de sempre. As 69 ferramentas existentes não mudam.
-- =====================================================================

alter table public.ai_tools
  add column if not exists body_template jsonb;

comment on column public.ai_tools.body_template is
  'Formato do corpo, com marcadores: {{nome}} (valor inteiro; a chave some se o parâmetro não vier), texto com {{nome}} embutido (interpolação) e {{*nome}} dentro de um array de um elemento (repete o elemento por valor separado por vírgula). NULL = corpo plano, como sempre.';
