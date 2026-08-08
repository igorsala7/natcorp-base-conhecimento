-- =====================================================================
-- ORIGEM e TURNO em `ai_usage` — o que falta para faturar com exatidão
--
-- Duas perguntas que o registro atual não responde:
--
--   1. "Isto é cobrável?"  O portal público de documentação NÃO é cobrado; o
--      widget é. Hoje os dois gravam do mesmo jeito e a única diferença
--      observável é acidental: o portal não manda parâmetro de rastreio, então
--      `p_base` fica nulo — igualzinho a uma chamada interna do sistema. Contar
--      "p_base nulo = não cobrar" funciona por acaso e quebra no dia em que o
--      widget for chamado sem rastreio.
--
--   2. "De qual mensagem veio?"  Não havia vínculo nenhum. Só dava para somar
--      por janela de tempo, o que deixa de ser exato assim que dois turnos
--      correm em paralelo.
--
-- `origem` responde a primeira e é INDEPENDENTE de `kind`: `kind` diz se quem
-- disparou foi o usuário ou o sistema; `origem` diz por qual porta entrou. Uma
-- reescrita de consulta disparada dentro de um turno do widget é
-- `kind='system'` (o usuário não a pediu) e `origem='widget'` (é consumo do
-- cliente) — e é exatamente esse caso que hoje some da fatura.
--
-- `turn_id` responde a segunda. Gerado uma vez por turno de chat, gravado aqui
-- e em `messages`: uma mensagem e TODAS as chamadas de IA que ela provocou
-- passam a ser um join exato, sem depender de `created_at`.
-- =====================================================================

alter table public.ai_usage
  add column if not exists origem text not null default 'sistema',
  add column if not exists turn_id uuid,
  add column if not exists conversation_id uuid;

comment on column public.ai_usage.origem is
  'Por qual porta a chamada entrou: widget (COBRÁVEL) | portal (documentação pública, não cobrado) | admin (uso interno da equipe) | sistema (job, importação, indexação). Independente de `kind`, que diz apenas se foi o usuário ou o sistema que disparou.';
comment on column public.ai_usage.turn_id is
  'Turno de chat que originou a chamada. Une esta linha à resposta em `messages` com o mesmo turn_id. Nulo fora do chat.';
comment on column public.ai_usage.conversation_id is
  'Conversa do turno. Redundante com messages.conversation_id via turn_id, mas evita um join no relatório.';

alter table public.ai_usage
  drop constraint if exists ai_usage_origem_check;
alter table public.ai_usage
  add constraint ai_usage_origem_check
  check (origem in ('widget', 'portal', 'admin', 'sistema'));

-- O faturamento sempre filtra por origem cobrável + período + cliente.
create index if not exists ai_usage_origem_periodo_idx
  on public.ai_usage (origem, created_at desc);
create index if not exists ai_usage_turno_idx
  on public.ai_usage (turn_id)
  where turn_id is not null;

-- ── Backfill do histórico ────────────────────────────────────────────────
-- INFERÊNCIA declarada, não medição: as linhas antigas não guardam a porta de
-- entrada. O que dá para afirmar do código vigente até aqui:
--   · `kind='user'` + `p_base` preenchido  → só o widget manda rastreio → widget
--   · `kind='user'` + `p_base` nulo        → chat do leitor no portal público
--   · `kind='system'`                      → importador/editor/indexação
-- A consequência de errar é conhecida e conservadora: um turno antigo do widget
-- sem rastreio vira 'portal' e sai da fatura — subcobra, nunca sobrecobra.
-- Daqui pra frente o valor é gravado na origem e nada disto é inferido.
update public.ai_usage
   set origem = case
     when kind = 'user' and coalesce(trim(p_base), '') <> '' then 'widget'
     when kind = 'user'                                      then 'portal'
     else 'sistema'
   end
 where origem = 'sistema';

-- ── Turno em `messages` ──────────────────────────────────────────────────
alter table public.messages
  add column if not exists turn_id uuid;

comment on column public.messages.turn_id is
  'Turno que gerou esta resposta. Mesmo valor nas linhas de `ai_usage` do turno — é o vínculo que permite dizer quanto UMA mensagem consumiu.';

create index if not exists messages_turno_idx
  on public.messages (turn_id)
  where turn_id is not null;
