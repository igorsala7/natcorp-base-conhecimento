-- =====================================================================
-- QUADRO DE FATOS DA CONVERSA
--
-- Hoje só as TABELAS atravessam os turnos (dataset-conversa.ts). Os fatos
-- resolvidos — de quem se fala, de que período, de qual centro de custo, de qual
-- evento — não: cada turno tenta deduzi-los das últimas mensagens e falha quando
-- a conversa fica longa.
--
-- O que isso custou, medido numa conversa real de 20/08: centro de custo, evento
-- de FGTS e as competências FEV e MAR/2025 ficaram estabelecidos no turno 19. No
-- turno 23 o sistema, olhando as três últimas mensagens, não achou período e
-- bloqueou CATORZE chamadas com "PERÍODO NÃO INFORMADO". A mensagem seguinte do
-- usuário foi "Desisto".
--
-- Coluna própria, e não dentro de `rag_memoria`: aquela guarda fontes do RAG, é
-- outro assunto e tem outro ciclo de vida. Misturar os dois deixaria os dois
-- piores de explicar.
--
-- Conteúdo: array de {chave, valor, tool, em}. Só CÓDIGOS e DATAS que já
-- transitaram na conversa — nome, salário e conteúdo de linha ficam de fora, para
-- não acumular dado pessoal em repouso além do que a conversa já guarda.
-- =====================================================================

alter table public.conversations
  add column if not exists fatos jsonb not null default '[]'::jsonb;

comment on column public.conversations.fatos is
  'Fatos que a conversa fixou (centro de custo, período, matrícula-alvo, evento), extraídos dos parâmetros de chamadas de ferramenta BEM-SUCEDIDAS. Ver src/lib/chat/fatos-conversa.ts.';
