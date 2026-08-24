-- =====================================================================
-- `ai_eval_runs` / `ai_eval_results` — a RODADA vira registro, não recado.
--
-- Hoje o placar de cada eval é impresso no terminal e, quando alguém lembra,
-- colado num `.md` datado à mão. O efeito é que NENHUMA medição é comparável à
-- seguinte, e isso não é hipótese: o instrumento se corrigiu QUATRO VEZES em
-- duas noites (denominador que somava caso imensurável, contador `sobrou` que
-- perdia troca de fonte, catálogo do cliente errado em 33 casos, gabarito com
-- 52 rótulos idênticos não confirmados). Cada correção mudou o número sem mudar
-- o sistema — e um `.md` com "73/97" não diz qual régua produziu aquilo.
--
-- Três coisas precisam viajar junto com o placar, ou o histórico mente:
--
--   1. O CÓDIGO medido      → `git_sha` + `git_sujo`. Sem isso, "melhorou de 73
--                             para 76" pode ser mudança no sistema ou no
--                             medidor. `git_sujo` marca a rodada feita sobre
--                             mudança não commitada: é reprodutível só na
--                             máquina de quem rodou, e o histórico precisa
--                             saber disso.
--   2. O GABARITO usado     → arquivo + checksum + contagem. Comparar 73/97 com
--                             76/131 através de uma troca de gabarito é
--                             comparar coisa nenhuma, e foi exatamente o que
--                             aconteceu quando os cenários foram de 42 para 57
--                             e depois para 138.
--   3. O DENOMINADOR honesto → `casos_mediveis` SEPARADO de `casos_total`. O
--                             eval já distingue "errou" de "não podia acertar"
--                             (base inativa, catálogo ausente); guardar só um
--                             "score" jogaria fora a distinção que custou mais
--                             caro para descobrir.
--
-- Read-only para quem configura IA; escrita por service-role, como os traces.
-- =====================================================================

create table if not exists public.ai_eval_runs (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),

  -- Qual pergunta a rodada responde. Os dois eixos do projeto são independentes
  -- e falham por motivos diferentes: a escolha de FERRAMENTA não depende do
  -- modelo; a de FONTE depende, e muito.
  eixo              text not null,
  script            text not null,

  -- O código medido.
  git_sha           text,
  git_sujo          boolean not null default false,

  -- Como foi invocado: --base, --top, --n, modelo. Duas rodadas com flags
  -- diferentes não são a mesma medição.
  flags             jsonb not null default '{}'::jsonb,

  -- O gabarito usado.
  gabarito_arquivo  text,
  gabarito_sha      text,
  gabarito_casos    integer,

  -- O placar. `casos_mediveis` é o denominador honesto; `casos_total` inclui o
  -- que não podia ser medido.
  casos_total       integer not null default 0,
  casos_mediveis    integer not null default 0,
  acertos           integer not null default 0,

  -- Baldes de falha, por eixo (ranking/config/uso/embedding em ferramenta;
  -- tool/rag/tela em fonte). Jsonb porque cada eixo tem os seus.
  placar            jsonb not null default '{}'::jsonb,

  -- Rótulo humano: "antes de estabilizar o bloco tools", "com rerank".
  nota              text
);

create index if not exists ai_eval_runs_eixo_idx
  on public.ai_eval_runs (eixo, created_at desc);
create index if not exists ai_eval_runs_gabarito_idx
  on public.ai_eval_runs (gabarito_sha, created_at desc);

comment on table public.ai_eval_runs is
  'Uma linha por RODADA de eval. Guarda o placar junto com o que o torna comparável: código medido (git_sha), gabarito (checksum) e flags. Sem estes três, dois placares de datas diferentes não se comparam.';
comment on column public.ai_eval_runs.casos_mediveis is
  'Denominador HONESTO: casos que o instrumento tinha como julgar. `casos_total` menos os imensuráveis (base inativa, catálogo ausente). Somar imensurável ao denominador produz número que parece completo e não é.';
comment on column public.ai_eval_runs.git_sujo is
  'true = havia mudança não commitada quando a rodada correu. O número vale, mas não é reproduzível a partir do git_sha sozinho.';

-- ── Resultado por caso ───────────────────────────────────────────────────
-- Sem esta tabela dá para ver que o placar mudou, não O QUE mudou. A pergunta
-- que aparece toda vez é "quais casos viraram, para os dois lados?" — e é a
-- única que separa ganho real de churn: uma rodada que ganha 4 e perde 3 com
-- 81% de troca não melhorou nada, só mexeu.
create table if not exists public.ai_eval_results (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references public.ai_eval_runs(id) on delete cascade,
  ordem       integer,
  pergunta    text,
  esperado    text,
  obtido      text,
  ok          boolean,
  -- RANKING | CONFIG | USO | EMBEDDING… — a família da falha, que decide o
  -- remédio. Nulo quando acertou.
  motivo      text,
  detalhe     jsonb not null default '{}'::jsonb
);

create index if not exists ai_eval_results_run_idx
  on public.ai_eval_results (run_id);
-- "Este caso melhorou ou piorou entre rodadas?" varre por pergunta.
create index if not exists ai_eval_results_pergunta_idx
  on public.ai_eval_results (pergunta, run_id);

comment on table public.ai_eval_results is
  'Resultado POR CASO de uma rodada. Permite o diff entre rodadas — quais casos viraram para cada lado — que é o que separa ganho real de churn.';

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.ai_eval_runs enable row level security;
alter table public.ai_eval_results enable row level security;

drop policy if exists ai_eval_runs_read on public.ai_eval_runs;
create policy ai_eval_runs_read on public.ai_eval_runs
  for select using (has_permission(auth.uid(), 'ai.configure', null));

drop policy if exists ai_eval_results_read on public.ai_eval_results;
create policy ai_eval_results_read on public.ai_eval_results
  for select using (has_permission(auth.uid(), 'ai.configure', null));

revoke all on public.ai_eval_runs from anon;
revoke all on public.ai_eval_results from anon;
