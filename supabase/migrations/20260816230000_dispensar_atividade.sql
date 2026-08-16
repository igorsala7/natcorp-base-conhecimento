-- "EU VI ESSE ERRO" — dispensar um item da gaveta de Atividade.
--
-- A gaveta mostra o que está em curso (sem limite de tempo) e o que falhou nas
-- últimas 24h. A janela existe para ela não virar arquivo morto, mas 24h é
-- muito tempo quando o erro já foi entendido: o Igor reprocessou o f200.json às
-- 21:11 com sucesso e continuou vendo o `db_docs` que falhou às 13:10 — e leu o
-- erro velho como se fosse o do arquivo que acabara de subir.
--
-- ── Dispensar, não apagar ───────────────────────────────────────────────────
-- A linha do job fica onde está. Apagar um erro é perder a auditoria de que ele
-- aconteceu, e o custo de descobrir isso é sempre depois. Dispensar diz "eu vi",
-- não "não aconteceu".
--
-- ── Por usuário ─────────────────────────────────────────────────────────────
-- As dez filas são compartilhadas pela equipe. Se a dispensa fosse global,
-- alguém marcando um erro como visto o esconderia de quem ainda precisa agir —
-- a classe de bug "sumiu pra mim, existe pra você". Uma coluna a mais evita
-- isso inteiro.
--
-- ── A chave é (tipo, job_id) ────────────────────────────────────────────────
-- `atividade_recente` é a união de dez tabelas, e o id sozinho não diz de qual
-- fila veio. Na prática uuid não colide, mas depender disso é depender de sorte
-- num lugar onde o par custa nada.
create table if not exists public.atividade_dispensas (
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null,
  job_id uuid not null,
  dispensada_em timestamptz not null default now(),
  primary key (user_id, tipo, job_id)
);

comment on table public.atividade_dispensas is
  'Itens da gaveta de Atividade que o usuário marcou como vistos. Não apaga o job — só o esconde para quem dispensou.';

-- A gaveta lê as dispensas do próprio usuário a cada sondagem (15s); sem índice
-- isso é um seq scan a cada 15 segundos por pessoa logada.
create index if not exists atividade_dispensas_user_idx
  on public.atividade_dispensas (user_id, dispensada_em desc);

alter table public.atividade_dispensas enable row level security;

-- Cada um vê, cria e desfaz apenas as SUAS. Não há política de update: uma
-- dispensa não muda de ideia — desfazer é apagar a linha.
drop policy if exists "dispensa: ler as próprias" on public.atividade_dispensas;
create policy "dispensa: ler as próprias" on public.atividade_dispensas
  for select using (user_id = auth.uid());

drop policy if exists "dispensa: criar as próprias" on public.atividade_dispensas;
create policy "dispensa: criar as próprias" on public.atividade_dispensas
  for insert with check (user_id = auth.uid());

drop policy if exists "dispensa: apagar as próprias" on public.atividade_dispensas;
create policy "dispensa: apagar as próprias" on public.atividade_dispensas
  for delete using (user_id = auth.uid());
