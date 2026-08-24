-- =====================================================================
-- `turn_id` em `ai_chat_traces` — o elo que faltava entre O QUE o turno fez e
-- QUANTO ele custou.
--
-- Hoje as duas metades da pergunta moram em tabelas que não se falam:
--
--   · `ai_chat_traces` sabe O QUE aconteceu — a pergunta, a fonte escolhida, as
--     ferramentas oferecidas e cortadas, os passos, a duração.
--   · `ai_usage`       sabe QUANTO custou — tokens de entrada/saída, gravação e
--     leitura de cache, por provedor e modelo. Já tem `turn_id` desde 08/08.
--
-- Sem a coluna aqui, "quanto custa 1.000 perguntas de folha" não tem resposta:
-- dá para somar o custo TOTAL do período e dá para contar os turnos de folha,
-- mas não dá para cruzar os dois. Toda decisão de custo do Bloco 3 (trocar
-- modelo por finalidade, estabilizar o bloco `tools`, cortar regra do prompt)
-- depende de medir POR RECORTE, e o recorte só existe no trace.
--
-- Uma coluna e um índice. Nada no caminho quente muda: o insert do trace já
-- roda com `void` e best-effort.
-- =====================================================================

alter table public.ai_chat_traces
  add column if not exists turn_id uuid;

comment on column public.ai_chat_traces.turn_id is
  'Turno de chat deste rastreio. Mesmo valor em `ai_usage.turn_id` e `messages.turn_id` — é o join que permite dizer quanto UM turno consumiu, e portanto quanto custa um RECORTE de turnos (por fonte, por módulo, por desfecho). Nulo em turnos anteriores a 08/08/2026, quando o turn_id ainda não existia.';

-- O uso é sempre "junte trace a consumo": índice parcial, porque a coluna é
-- nula em todo o histórico anterior a 08/08 e não vale indexar isso.
create index if not exists ai_chat_traces_turno_idx
  on public.ai_chat_traces (turn_id)
  where turn_id is not null;

-- ── Backfill do histórico ────────────────────────────────────────────────
-- INFERÊNCIA DECLARADA, com o método e os números medidos antes de escrever.
--
-- O vínculo é recuperável porque `messages` guarda o texto da pergunta E o
-- turno: casar `ai_chat_traces.pergunta` com `messages.content` da mensagem do
-- usuário, dentro da MESMA conversa, é identidade de conteúdo — sinal muito
-- mais forte que proximidade temporal. Medido nos 1.426 traces existentes:
--
--   por janela de tempo (conversa + duração)  →  716 exatos, 179 ambíguos
--   por texto da pergunta (conversa + texto)  →  897 exatos,  42 ambíguos
--
-- ARMADILHA, medida e corrigida aqui: deduplicar só do lado do TRACE não basta.
-- Quando a mesma pergunta se repete na conversa, dois traces diferentes elegem a
-- MESMA mensagem como a mais próxima, e o turno de um vira o turno do outro.
-- Na primeira versão desta migration isso produziu 939 linhas preenchidas para
-- apenas 828 turnos distintos: 103 turnos reivindicados por 2 ou 3 traces, 214
-- linhas (23% do backfill) com turno possivelmente trocado — e custo contado
-- duas vezes em qualquer join.
--
-- A regra abaixo é 1:1 POR CONSTRUÇÃO: dentro de (conversa, texto), o k-ésimo
-- trace em ordem cronológica casa com a k-ésima mensagem em ordem cronológica.
-- Duas sequências ordenadas do mesmo evento pareiam na ordem. Medido: 828
-- pareados, 828 turnos distintos, ZERO colisões.
--
-- Os 598 restantes ficam NULOS de propósito, e NULO aqui quer dizer "não sei",
-- nunca "custou zero":
--   · 459 são anteriores a 08/08 — o `turn_id` não existia, não há o que inferir;
--   · o resto não tem mensagem correspondente (turno que morreu antes de gravar,
--     ou pergunta que o trace guardou e a conversa não).
--
-- Quem for somar custo sobre o histórico precisa filtrar `turn_id is not null` e
-- saber que está olhando parte da população, não ela inteira. Daqui pra frente o
-- valor é gravado na origem e nada disto é inferido.
--
-- `where t.turn_id is null` protege o dado real: re-rodar esta migration depois
-- que a aplicação começou a gravar não sobrescreve nada.
with t_ord as (
  select t.id,
         t.conversation_id,
         t.pergunta,
         row_number() over (
           partition by t.conversation_id, t.pergunta order by t.created_at
         ) as k
    from public.ai_chat_traces t
   where t.turn_id is null
),
m_ord as (
  select m.turn_id,
         m.conversation_id,
         left(m.content, 2000) as texto,
         row_number() over (
           partition by m.conversation_id, left(m.content, 2000) order by m.created_at
         ) as k
    from public.messages m
   where m.role = 'user'
     and m.turn_id is not null
)
update public.ai_chat_traces t
   set turn_id = m.turn_id
  from t_ord o
  join m_ord m
    on m.conversation_id = o.conversation_id
   and m.texto = o.pergunta
   and m.k = o.k
 where o.id = t.id;
