-- TREINAMENTO: casos rotulados POR GENTE, para medir a assertividade do agente.
--
-- Ideia do Igor (17/08): mandar uma mensagem, ver as ferramentas que o agente
-- considerou e por quê, e marcar qual estava certa.
--
-- ── Por que uma tabela nova, e não `ai_tool_uso` ───────────────────────────
-- `ai_tool_uso` grava USO BEM-SUCEDIDO — a ferramenta foi chamada e executou.
-- Mas "executou" não é "estava certa": a chamada que motivou tudo isto mandou
-- `empresa` e `matrícula` quando devia mandar só a data, funcionou, devolveu
-- dados, e o aprendizado registrou como acerto. O sinal de hoje REFORÇA o erro
-- que se quer corrigir.
--
-- Um rótulo humano é de outra natureza. Ele é caro (alguém precisa olhar), raro
-- (dezenas, não milhares) e confiável — o oposto do sinal de uso, que é barato,
-- abundante e ambíguo. Misturar os dois na mesma tabela apagaria justamente a
-- diferença que dá valor ao segundo.
--
-- ── Registrar e medir ANTES de influenciar ────────────────────────────────
-- Decisão do Igor: primeiro acumular casos e medir; só depois deixar o rótulo
-- pesar na seleção. Por isso esta migration não toca em ranqueamento nenhum —
-- ela cria o substrato de medição. O dia em que o rótulo virar bônus, o número
-- de antes e depois já vai existir.

create table if not exists public.ai_tool_casos (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,

  -- ── O que foi perguntado, e em que situação ──────────────────────────────
  pergunta text not null,
  -- O painel/perfil muda a resposta certa: "meus dados" no Portal do Colaborador
  -- e no do Operador não selecionam a mesma ferramenta.
  base_code text,
  p_perfil text,
  p_portal text,
  -- Nome da tela quando havia uma. É o que separa "devia ter olhado o relatório
  -- aberto" de "não tinha relatório nenhum".
  tela text,

  -- ── O que o agente FEZ ───────────────────────────────────────────────────
  -- As ferramentas oferecidas ao modelo, com a similaridade de cada uma. É o que
  -- permite distinguir "escolheu errado" de "a certa nem foi oferecida" — que
  -- foi o caso do `estrutura_filiais` cortado pelo teto.
  oferecidas jsonb not null default '[]'::jsonb,
  cortadas jsonb not null default '[]'::jsonb,
  tool_escolhida text,
  parametros jsonb,
  curl text,
  -- A explicação do modelo: por que esta ferramenta e estes parâmetros.
  justificativa text,

  -- ── O que a GENTE disse ──────────────────────────────────────────────────
  veredito text check (veredito in ('certo', 'tool_errada', 'parametro_errado', 'devia_usar_tela', 'nao_devia_chamar')),
  tool_correta text,
  parametros_corretos jsonb,
  observacao text,

  conversation_id uuid,
  trace_id uuid,
  rotulado_por uuid references auth.users(id) on delete set null,
  rotulado_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ai_tool_casos_space_idx on public.ai_tool_casos (space_id, created_at desc);
-- Os NÃO rotulados são a fila de trabalho; os rotulados são o conjunto de
-- medição. Índice parcial porque a fila é pequena e a consulta é constante.
create index if not exists ai_tool_casos_pendentes_idx on public.ai_tool_casos (space_id, created_at desc)
  where veredito is null;

alter table public.ai_tool_casos enable row level security;

-- Ler e rotular exige `ai.configure` — é calibragem de agente, não conteúdo.
drop policy if exists ai_tool_casos_read on public.ai_tool_casos;
create policy ai_tool_casos_read on public.ai_tool_casos
  for select using (public.has_permission(auth.uid(), 'ai.configure', space_id));

drop policy if exists ai_tool_casos_write on public.ai_tool_casos;
create policy ai_tool_casos_write on public.ai_tool_casos
  for update using (public.has_permission(auth.uid(), 'ai.configure', space_id))
  with check (public.has_permission(auth.uid(), 'ai.configure', space_id));

-- A gravação do caso vem do SERVIDOR (rota de chat), com service_role: quem
-- conversa pelo widget não tem — nem deve ter — permissão de configurar IA.
drop policy if exists ai_tool_casos_insert on public.ai_tool_casos;
create policy ai_tool_casos_insert on public.ai_tool_casos
  for insert with check (public.has_permission(auth.uid(), 'ai.configure', space_id));

comment on table public.ai_tool_casos is
  'Casos de treinamento rotulados por gente: o que o agente escolheu × o que estava certo. Separado de ai_tool_uso porque "executou" não é "estava certo".';
