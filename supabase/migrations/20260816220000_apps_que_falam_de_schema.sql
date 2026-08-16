-- Em quais APLICAÇÕES do ERP o assistente pode citar tabela e coluna.
--
-- Decisão do Igor (16/08/2026): "o chat do agente nunca pode mencionar a tabela
-- e o nome do campo, só pode se tiver na aplicação de Carga de Dados".
--
-- ── Por que uma lista, e por que aqui ───────────────────────────────────────
-- A regra é global e a exceção é por aplicação. Aplicação pertence à instalação
-- APEX do cliente, e `ai_bases` é justamente a linha por cliente — o app 300 da
-- Natcorp não é o app 300 da Incor. Uma configuração global casaria o número
-- errado no cliente errado, que é pior que não ter exceção nenhuma.
--
-- Segue o precedente de `widget_paineis` (20260814100000): mesma tabela, mesmo
-- tipo, mesma forma de ler.
--
-- ── NULL = nenhuma, ao contrário de `widget_paineis` ────────────────────────
-- Lá NULL significa "todos", porque desligar era a novidade e o comportamento
-- de sempre era aparecer em todos. Aqui é o inverso: a novidade é PERMITIR, e o
-- padrão de uma exceção é não existir. Uma base recém-cadastrada, ou um campo
-- que alguém esqueceu de preencher, não pode virar permissão em silêncio.
--
-- ── Aceita ID ou ALIAS ──────────────────────────────────────────────────────
-- O `href` do APEX carrega `f?p=<app>:<página>:…` e o primeiro campo pode ser o
-- número ou o alias — as duas formas aparecem na produção da Natcorp ('200' e
-- 'CHINT_LEADEC'). Por isso é text[] e não int[]: quem configura escreve o que
-- vê na URL, sem precisar descobrir qual das duas o APEX resolveu usar.
-- A comparação é sem caixa (ver `telaEstaEm` em src/lib/chat/page-context.ts).
alter table public.ai_bases
  add column if not exists apps_schema text[];

comment on column public.ai_bases.apps_schema is
  'Aplicações APEX (id OU alias, ex.: {"400","CARGA_DADOS"}) onde o assistente pode citar nome de tabela e de coluna. NULL/{} = nenhuma — a regra vale em todas as telas.';
