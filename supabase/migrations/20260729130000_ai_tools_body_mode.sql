-- =====================================================================
-- Envelope do CORPO em POST/PUT/PATCH. Algumas APIs (ORDS/APEX) esperam o
-- corpo embrulhado — um array `[{...}]` ou um objeto com chave `{chave:[{...}]}`
-- — em vez do objeto plano `{...}` que o motor monta por padrão.
--
--   NULL ou 'object'  → {...}            (padrão, comportamento atual)
--   'array'           → [{...}]
--   'wrap:<chave>'    → {<chave>:[{...}]} (ex.: 'wrap:saque' → {saque:[{...}]})
-- =====================================================================
alter table public.ai_tools
  add column if not exists body_mode text;

comment on column public.ai_tools.body_mode is
  'Envelope do corpo (POST/PUT/PATCH): NULL/object={...}; array=[{...}]; wrap:<chave>={<chave>:[{...}]}.';
