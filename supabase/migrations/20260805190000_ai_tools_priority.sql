-- =====================================================================
-- DESEMPATE ENTRE FERRAMENTAS AMBÍGUAS
--
-- Problema real: `historico_financeiro` (eventos de UM colaborador) e
-- `bi_historico_financeiro` (totais agregados) ficam a ~0.03 de similaridade
-- uma da outra. As duas passam no piso relativo (topo − 0.08), chegam juntas
-- ao modelo, e é ELE que erra a escolha. Reordenar não resolve — a vencedora
-- já vinha em 1º. Para acertar, a perdedora tem de sair do turno.
--
-- Dois níveis, do mais específico para o mais geral (o 1 vence o 2):
--
--   1. PAREADO (ai_tool_priority_rules) — "quando A e B disputarem, prefira A".
--      Declaração explícita, para as colisões que você já conhece.
--        · modo 'empate' (padrão): só corta quando as duas estão em quase-empate
--          NO TOPO da rodada — se nenhuma das duas é a melhor da vez, a regra não
--          dispara e as duas seguem disponíveis.
--        · modo 'sempre': corta a perdedora sempre que a vencedora estiver no
--          turno. Use quando a perdedora é redundante de fato.
--
--   2. NUMÉRICO POR GRUPO (ai_tools.prioridade + grupo_ambiguidade) — a rede que
--      cobre o par que você ainda não mapeou. Só compete DENTRO do mesmo grupo e
--      só em quase-empate no topo, então um número alto nunca atropela uma
--      ferramenta de outro domínio.
--
-- O que NÃO muda: o piso de similaridade continua olhando o sim CRU (prioridade
-- não empurra tool fraca para dentro do turno), e tool essencial
-- (`always_include`) ou forçada pela rota é IMUNE aos dois níveis.
--
-- Para a preferência que depende do contexto ("individual → A; agregado → B"),
-- o campo certo continua sendo `ai_tools.system_prompt`: desempate resolve
-- empate, instrução resolve ambiguidade.
-- =====================================================================

alter table public.ai_tools
  add column if not exists prioridade int not null default 0,
  add column if not exists grupo_ambiguidade text;

comment on column public.ai_tools.prioridade is
  'Desempate entre tools do MESMO grupo_ambiguidade em quase-empate no topo: maior vence, a menor sai do turno. 0 = neutro.';
comment on column public.ai_tools.grupo_ambiguidade is
  'Rótulo livre que delimita onde a prioridade compete (ex.: "historico_financeiro"). NULL = a prioridade numérica não se aplica.';

-- Índice só das que participam (a maioria é NULL/0).
create index if not exists ai_tools_grupo_ambiguidade_idx
  on public.ai_tools (grupo_ambiguidade)
  where grupo_ambiguidade is not null;

-- ─────────────────────────────────────────────────────────────────────
-- Regra PAREADA: vencedora × perdedora.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.ai_tool_priority_rules (
  id uuid primary key default gen_random_uuid(),
  winner_tool_id uuid not null references public.ai_tools (id) on delete cascade,
  loser_tool_id  uuid not null references public.ai_tools (id) on delete cascade,
  modo text not null default 'empate' check (modo in ('empate', 'sempre')),
  -- Por que a regra existe — aparece na tela e no trace; sem isto ninguém lembra
  -- daqui a seis meses por que a ferramenta some.
  motivo text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ai_tool_priority_rules_par_unico unique (winner_tool_id, loser_tool_id),
  constraint ai_tool_priority_rules_nao_reflexiva check (winner_tool_id <> loser_tool_id)
);
create index if not exists ai_tool_priority_rules_loser_idx
  on public.ai_tool_priority_rules (loser_tool_id);

comment on table public.ai_tool_priority_rules is
  'Desempate explícito entre duas tools ambíguas: quando ambas disputam o turno, a perdedora sai. Mais específico que ai_tools.prioridade — e vence dela.';
comment on column public.ai_tool_priority_rules.modo is
  'empate = só corta em quase-empate no topo da rodada; sempre = corta sempre que a vencedora estiver no turno.';

-- Ciclo direto (A vence B e B vence A) deixaria o resultado dependente da ordem
-- de leitura: barra na escrita, que é onde dá para explicar o erro.
create or replace function public.ai_tool_priority_rules_sem_ciclo()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if exists (
    select 1 from public.ai_tool_priority_rules
     where winner_tool_id = new.loser_tool_id
       and loser_tool_id  = new.winner_tool_id
  ) then
    raise exception 'Já existe a regra inversa entre estas duas ferramentas — uma tem de ceder.'
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists ai_tool_priority_rules_sem_ciclo_trg on public.ai_tool_priority_rules;
create trigger ai_tool_priority_rules_sem_ciclo_trg
  before insert or update on public.ai_tool_priority_rules
  for each row execute function public.ai_tool_priority_rules_sem_ciclo();

-- RLS: mesmo padrão do resto do módulo (integrations.manage, escopo global).
alter table public.ai_tool_priority_rules enable row level security;

drop policy if exists ai_tool_priority_rules_read on public.ai_tool_priority_rules;
create policy ai_tool_priority_rules_read on public.ai_tool_priority_rules
  for select to authenticated
  using (public.has_permission(auth.uid(), 'integrations.manage', null));

drop policy if exists ai_tool_priority_rules_write on public.ai_tool_priority_rules;
create policy ai_tool_priority_rules_write on public.ai_tool_priority_rules
  for all to authenticated
  using (public.has_permission(auth.uid(), 'integrations.manage', null))
  with check (public.has_permission(auth.uid(), 'integrations.manage', null));

revoke all on public.ai_tool_priority_rules from anon;
