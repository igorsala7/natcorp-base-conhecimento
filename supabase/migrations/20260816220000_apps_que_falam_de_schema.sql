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
-- ── Aceita ID, ALIAS ou TÍTULO ──────────────────────────────────────────────
-- Três formas, e quem configura usa a que tiver em mãos:
--  · o ID da aplicação ('400');
--  · o ALIAS ('CARGA_DADOS') — o `href` do APEX é `f?p=<app>:<página>:…` e o
--    primeiro campo pode ser qualquer um dos dois; as duas aparecem na produção
--    da Natcorp ('200' e 'CHINT_LEADEC');
--  · o TÍTULO da tela ('Carga de Dados'), que é o que a pessoa lê no topo — foi
--    o que o Igor tinha em mãos, e é o mais fácil de conferir.
--
-- Título é mais frágil (renomear a página desliga a exceção) mas falha para o
-- lado SEGURO: volta a valer a regra restritiva. O id é estável e ninguém sabe
-- de cor. Por isso text[], e não int[].
--
-- A comparação ignora acento e caixa, e quebra o título nos separadores usuais
-- para tolerar o sufixo que o APEX põe ('Carga de Dados - Natcorp'). Casa
-- pedaço INTEIRO: 'Carga de Dados Funcionais' NÃO casa com 'Carga de Dados'.
-- Ver `telaEstaEm` em src/lib/chat/page-context.ts.
alter table public.ai_bases
  add column if not exists apps_schema text[];

comment on column public.ai_bases.apps_schema is
  'Telas onde o assistente pode citar nome de tabela e de coluna — por id de app, alias ou TÍTULO da tela (ex.: {"400","CARGA_DADOS","Carga de Dados"}). NULL/{} = nenhuma: a regra vale em todas.';
