-- =====================================================================
-- MEMÓRIA DE RECUPERAÇÃO POR CONVERSA
--
-- Problema: cada pergunta recupera do zero e SUBSTITUI o contexto documental
-- do turno anterior. Numa conversa de ~5 turnos, a regra que apareceu no turno
-- 2 já não está lá no turno 4 — justamente quando a ferramenta devolve o valor
-- que aquela regra explica. E, como o bloco muda inteiro a cada pergunta, ele
-- nunca casa no cache de prefixo.
--
-- Guarda os nós recuperados nos turnos recentes da conversa para que a
-- recuperação seguinte os PRIORIZE (boost), não para fixá-los à força:
-- acumular sem critério dilui o contexto, e diluição custa assertividade —
-- que é exatamente o que não se pode perder. Quem decide continua sendo a
-- fusão; a memória só desempata a favor da continuidade.
--
-- `jsonb` e não `uuid[]` porque a entrada carrega o turno em que o nó entrou
-- (para envelhecer os mais antigos primeiro) e a origem (artigo × documento).
-- =====================================================================
alter table public.conversations
  add column if not exists rag_memoria jsonb not null default '[]'::jsonb;

comment on column public.conversations.rag_memoria is
  'Nós recuperados nos turnos recentes: [{"node_id":uuid|null,"document_id":uuid|null,"turno":int}]. '
  'Alimenta o boost de continuidade da recuperação seguinte. Teto aplicado na aplicação (ver lib/ai/rag-memoria.ts).';

-- Sem índice: a leitura é sempre por `conversations.id` (chave primária) e a
-- coluna nunca é filtrada. Índice em jsonb aqui só custaria escrita.
