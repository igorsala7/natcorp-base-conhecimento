-- =====================================================================
-- CAMPANHAS: O CLIENTE AGENDA UM ALERTA E VÊ QUEM VISUALIZOU
--
-- Duas tabelas e duas funções. `ai_campanhas` é o alerta; a entrega ao
-- chatbot é `public.alertas_para`; `ai_campanha_visualizacoes` é o fato
-- "esta pessoa viu"; e `public.registrar_visualizacao` é quem grava esse
-- fato, com a MESMA cerca da entrega.
--
-- ── O AGENDAMENTO É UM PREDICADO, NÃO UM JOB ──────────────────────────
-- A primeira pessoa que ler este arquivo vai querer criar uma fila. Não
-- crie. Um alerta está ativo quando, e só quando:
--
--   enabled and publicar_em <= now() and (encerrar_em is null or encerrar_em > now())
--
-- O predicado mora na consulta, e é avaliado no instante em que alguém
-- pergunta. Isso elimina de uma vez a peça que mais quebra num sistema de
-- notificação:
--
--   · não há worker para atrasar, então não existe alerta "que devia ter
--     disparado e não disparou" — o estado que obriga alguém a abrir o
--     banco para descobrir se o problema foi a fila ou a regra;
--   · reprocessar não duplica nada, porque não há disparo: a consulta é
--     idempotente por construção, e rodá-la mil vezes devolve a mesma
--     resposta;
--   · agendar para o futuro e agendar para agora são a MESMA escrita, uma
--     linha com `publicar_em` diferente. Não há dois caminhos de código
--     ("enfileira" e "manda já") que possam divergir;
--   · mudar a data de um alerta agendado é um UPDATE, não cancelar um job
--     e criar outro.
--
-- O custo é que o alerta aparece na próxima vez que o widget abre, e não
-- no segundo em que a data chega. Para um aviso interno de RH, esse atraso
-- é o próprio comportamento desejado: o alerta espera a pessoa, em vez de
-- a pessoa precisar estar com o painel aberto no minuto certo.
--
-- ── SÓ QUEM VISUALIZOU. NUNCA QUEM NÃO VISUALIZOU ─────────────────────
-- Decisão do dono em 24/09, e o motivo é aritmético, não de gosto: não
-- existe cadastro de usuários em tabela nenhuma deste banco. O único
-- universo disponível é "quem já usou o chatbot", e a maior base conhece
-- SETE usuários distintos. Qualquer percentual sobre esse universo mediria
-- adoção do chatbot parecendo medir alcance da campanha — completo na
-- aparência e falso no conteúdo, que é o pior tipo de número.
--
-- Por isso este arquivo NÃO cria coluna, view ou função que calcule taxa
-- ou que implique um total. Não há `total_destinatarios`, não há
-- `percentual_lido`, não há `elegiveis_count`. Quem quiser a versão
-- completa tem de trazer o roster do ERP primeiro — uma consulta por
-- campanha, não por turno — e aí o denominador passa a existir de verdade.
-- Enquanto isso não acontecer, a única coisa que o banco sabe dizer é
-- "estas pessoas viram", e é só isso que ele oferece.
--
-- ── A RLS DAQUI NÃO DEFENDE O CAMINHO DO CLIENTE ──────────────────────
-- Isto precisa estar escrito, porque a leitura natural das policies abaixo
-- é errada. A área do cliente e o widget NÃO têm sessão do Supabase: eles
-- escrevem com `service_role`, que tem `rolbypassrls` e portanto ignora
-- toda policy deste arquivo.
--
-- Então a RLS aqui é a cerca do caminho AUTENTICADO (o admin interno, com
-- sessão), e nada mais. O que defende o caminho do cliente são duas outras
-- coisas, nesta ordem:
--
--   1. as duas funções deste arquivo, que recebem `p_base` e `p_identidade`
--      e fazem o corte em SQL — é por isso que `alertas_para` nunca devolve
--      alerta de outra base e `registrar_visualizacao` recusa gravar
--      visualização de alerta que não é daquela base;
--   2. o código da action/rota da tarefa 2 e 3, que tira a base da SESSÃO
--      e nunca do formulário, e a identidade do TOKEN e nunca do corpo.
--
-- Quem assumir que a RLS cobre o cliente vai deixar a cerca 2 de fora e o
-- furo não aparece em teste nenhum, porque `service_role` passa.
--
-- ── `regra jsonb`, e nunca colunas de array novas ─────────────────────
-- Elegibilidade tem UM avaliador, `public.elegivel(regra, identidade)`, e
-- UMA guarda de gravação, `public.regra_valida(regra)`. A forma é a mesma
-- de `ai_base_documentacoes` de propósito: é o mesmo motor, as mesmas doze
-- dimensões de `public.dimensoes_elegibilidade()`, e o CHECK barra a regra
-- malformada na gravação — sem ele, `elegivel` faz o que o projeto 0
-- mandou fazer com dado malformado (FECHAR) e o efeito é um alerta que não
-- alcança ninguém, sem erro em lugar nenhum.
-- =====================================================================

-- =====================================================================
-- 1/4 — public.ai_campanhas
-- =====================================================================
create table if not exists public.ai_campanhas (
  id          uuid primary key default gen_random_uuid(),
  base_id     uuid not null references public.ai_bases(id) on delete cascade,
  titulo      text not null,
  corpo       text not null default '',
  regra       jsonb not null default '{}'::jsonb,
  -- SEM `default now()`, de propósito. Com default, um formulário que
  -- perdesse o campo publicaria o alerta na hora, para todo mundo que a
  -- regra alcança — num sistema de notificação, o erro silencioso é a
  -- mensagem que já saiu. Sem default, o mesmo defeito é erro duro na
  -- gravação, e ninguém recebe nada.
  publicar_em timestamptz not null,
  encerrar_em timestamptz,
  enabled     boolean not null default true,
  -- `text` e não `uuid references auth.users`: quem cria uma campanha é a
  -- área do cliente, que não tem sessão do Supabase (escreve com
  -- `service_role`). O autor aqui é o rótulo que a action souber dar —
  -- matrícula, usuário do rastreio, ou o operador interno. FK para
  -- `auth.users` deixaria a coluna sempre nula no caminho que mais importa.
  criada_por  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.ai_campanhas is
  'Alertas que um cliente agenda e que aparecem no chatbot para quem ele escolher. Ativo é PREDICADO de consulta (enabled and publicar_em <= now() and (encerrar_em is null or encerrar_em > now())), nunca job: não há worker para atrasar, não existe estado "devia ter disparado e não disparou", e reprocessar não duplica nada. `regra` é elegibilidade no formato do motor (public.elegivel); vazia não restringe.';
comment on column public.ai_campanhas.regra is
  'Elegibilidade nas doze dimensões, formato de public.elegivel. NUNCA sai por alertas_para: a regra é configuração interna do cliente e widget.js é público.';
comment on column public.ai_campanhas.publicar_em is
  'Instante a partir do qual o alerta está ativo. Sem default de propósito: default now() faria um formulário que perdesse o campo publicar na hora, e mensagem que já saiu não se cancela.';
comment on column public.ai_campanhas.encerrar_em is
  'Instante em que o alerta deixa de estar ativo; nulo é "não encerra". Comparado com `>` e não `>=`: encerrar_em é o primeiro instante em que o alerta NÃO aparece mais.';
comment on column public.ai_campanhas.criada_por is
  'Rótulo do autor, texto livre. Não é FK para auth.users porque a área do cliente escreve com service_role, sem sessão.';

-- CHECK da regra: mesma guarda de gravação das duas tabelas de
-- documentação. `drop if exists` antes do `add` porque não há ledger e
-- reaplicar o arquivo é operação normal.
alter table public.ai_campanhas
  drop constraint if exists ai_campanhas_regra_valida;
alter table public.ai_campanhas
  add constraint ai_campanhas_regra_valida check (public.regra_valida(regra));

-- Título em branco é a primeira mensagem do chat em branco. Barrar na
-- gravação transforma isso em mensagem de tela; deixar passar transforma
-- num alerta que aparece vazio para quem for elegível. A tela da tarefa 3
-- tem de validar antes, para o usuário ver aviso e não 500.
alter table public.ai_campanhas
  drop constraint if exists ai_campanhas_titulo_nao_branco;
alter table public.ai_campanhas
  add constraint ai_campanhas_titulo_nao_branco
  check (btrim(coalesce(titulo, '')) <> '');

-- Encerrar antes de publicar é uma campanha que nunca fica ativa —
-- invisível sem nenhum erro, e a pessoa fica olhando a tela sem entender
-- por que o alerta não sai. Mesmo raciocínio do CHECK de regra.
alter table public.ai_campanhas
  drop constraint if exists ai_campanhas_janela_coerente;
alter table public.ai_campanhas
  add constraint ai_campanhas_janela_coerente
  check (encerrar_em is null or encerrar_em > publicar_em);

-- A consulta de entrega filtra por base e ordena por publicar_em. Volume
-- é pequeno hoje, mas o índice é o que impede a varredura crescer junto
-- com o número de clientes.
create index if not exists ai_campanhas_base_publicar_idx
  on public.ai_campanhas (base_id, publicar_em desc);

drop trigger if exists ai_campanhas_touch on public.ai_campanhas;
create trigger ai_campanhas_touch
  before update on public.ai_campanhas
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- 2/4 — public.ai_campanha_visualizacoes
--
-- ── A CHAVE ÚNICA, E O QUE ELA FAZ COM NULO ───────────────────────────
-- `unique (campanha_id, p_usuario, p_matricula)` impede que a MESMA pessoa
-- conte duas vezes na mesma campanha: o widget reporta a visualização a
-- cada vez que renderiza o alerta, e sem a chave um usuário que abrisse o
-- chat dez vezes viraria dez visualizações.
--
-- Em Postgres, nulo é DISTINTO de nulo num índice único (NULLS DISTINCT é
-- o padrão, e `nulls not distinct` NÃO foi usado aqui de propósito).
-- Medido em `conversations`, 513 conversas, 26/09:
--
--   · 378 (74%) trazem usuário E matrícula ....... a chave dedupe
--   · 133 (26%) trazem NENHUM dos dois ........... cada visualização é uma
--                                                 linha nova
--   ·   2 (0,4%) trazem só usuário ............... a chave NÃO dedupe
--   ·   0        trazem só matrícula
--
-- Os 26% anônimos são o comportamento pedido: a linha registra que ALGUÉM
-- viu, e essa linha não entra no drilldown por pessoa. Dizer "alguém viu"
-- é verdade; inventar quem viu não é, e `nulls not distinct` faria o
-- contrário do que parece — colapsaria todas as visualizações anônimas de
-- uma campanha numa linha só, dizendo "um viu" onde cinquenta viram.
--
-- Os 0,4% com só usuário são lacuna conhecida e medida, não defeito
-- escondido: aquela pessoa pode contar mais de uma vez. Fechar isso exigiria
-- dois índices parciais além deste, e `on conflict` só aponta para um alvo —
-- três índices para 0,4% das linhas trocariam uma imprecisão medida por uma
-- complexidade que o próximo leitor não entende.
--
-- ── AS COLUNAS SÃO `p_*`, A IDENTIDADE NÃO. CUIDADO ───────────────────
-- Isto morde quem lê rápido. As colunas seguem o nome do RASTREIO
-- (`p_usuario`, `p_matricula`, ...), igual a `conversations`. A identidade
-- que `public.elegivel` e estas funções recebem tem as chaves das
-- DIMENSÕES, sem prefixo (`usuario`, `matricula`, ...), porque é o que
-- `identidadeDoRastreio` devolve. A tradução acontece uma vez só, dentro de
-- `registrar_visualizacao`. Nunca monte a identidade à mão.
-- =====================================================================
create table if not exists public.ai_campanha_visualizacoes (
  -- Chave substituta necessária por dois motivos: a chave natural aceita
  -- nulo (e coluna de primary key não aceita), e o drilldown da tarefa 4
  -- pagina com `.order("id")` antes do `.range()` — sem uma coluna estável
  -- de ordenação, a paginação repete e perde linhas, que é o defeito do
  -- teto de 1.000 do PostgREST.
  id          uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.ai_campanhas(id) on delete cascade,
  p_usuario   text,
  p_matricula text,
  p_empresa   text,
  p_portal    text,
  p_perfil    text,
  visto_em    timestamptz not null default now()
);

comment on table public.ai_campanha_visualizacoes is
  'Quem visualizou um alerta. SÓ isso: não existe linha, coluna nem função dizendo quem NÃO visualizou, porque não há cadastro de usuários e o denominador seria adoção do chatbot disfarçada de alcance da campanha. A visualização é reportada quando o widget RENDERIZA o alerta, não quando o servidor o entrega: servir não é visualizar, o painel pode estar fechado.';
comment on column public.ai_campanha_visualizacoes.p_usuario is
  'Usuário do rastreio. Nome com prefixo p_ para casar com conversations; a identidade de public.elegivel usa a chave SEM prefixo (usuario). A tradução é feita por registrar_visualizacao.';
comment on column public.ai_campanha_visualizacoes.visto_em is
  'Instante da PRIMEIRA visualização desta pessoa nesta campanha: on conflict do nothing preserva a linha original em vez de atualizar a data.';

-- A chave única precisa de NOME, porque `on conflict on constraint` dentro
-- de `registrar_visualizacao` aponta para ela pelo nome — e `on conflict
-- (colunas)` inferiria o alvo, o que quebraria em silêncio se alguém
-- criasse um segundo índice único sobre as mesmas colunas.
alter table public.ai_campanha_visualizacoes
  drop constraint if exists ai_campanha_visualizacoes_pessoa_key;
alter table public.ai_campanha_visualizacoes
  add constraint ai_campanha_visualizacoes_pessoa_key
  unique (campanha_id, p_usuario, p_matricula);

-- =====================================================================
-- 3/4 — public.alertas_para(text, jsonb)
--
-- Os alertas ATIVOS e ELEGÍVEIS de uma identidade, naquela base. É a
-- função que `/api/v1/config` chama na abertura do widget.
--
-- `security definer` pela mesma razão de `escopo_documentacao`: o corte
-- que vale é o desta função (base + janela + elegivel), e não a RLS de
-- quem chama, para que uma mudança de policy não alargue nem estreite a
-- entrega sem ninguém perceber. E, sendo definer, o EXECUTE fica SÓ com
-- `service_role`: com grant para `authenticated`, qualquer Leitor deduzia
-- a regra de qualquer cliente variando a identidade e vendo o que sai.
--
-- `regra` NÃO está na lista de retorno. Não é esquecimento: `widget.js` é
-- público, e a regra é a configuração interna do cliente. Título e corpo o
-- usuário vai ler; a regra que o alcançou, não.
--
-- Base desconhecida ou `p_base` nulo devolvem ZERO linhas: `bases_do_codigo`
-- não casa nada, e ausência FECHA. É o mesmo aparo de `codigo_normalizado`
-- que o resto do escopo por base usa, então NBSP e TAB no código não abrem
-- nem fecham a cerca por acidente.
-- =====================================================================
create or replace function public.alertas_para(
  p_base text,
  p_identidade jsonb default '{}'::jsonb
)
returns table (
  id uuid,
  titulo text,
  corpo text,
  publicar_em timestamptz
)
language sql
stable security definer
set search_path to 'public', 'extensions'
as $$
  select c.id, c.titulo, c.corpo, c.publicar_em
    from public.ai_campanhas c
   where c.base_id in (select t.id from public.bases_do_codigo(p_base) as t(id))
     and c.enabled
     -- O PREDICADO DE AGENDAMENTO. Ver o cabeçalho: não vire isto numa fila.
     and c.publicar_em <= now()
     and (c.encerrar_em is null or c.encerrar_em > now())
     and public.elegivel(c.regra, p_identidade)
   -- Mais recente primeiro: o alerta é a primeira mensagem do chat, e o
   -- que acabou de ser publicado é o que a pessoa ainda não viu. `id` no
   -- fim só para a ordem ser total (duas campanhas podem nascer no mesmo
   -- instante, e paginação sobre ordem não total repete linha).
   order by c.publicar_em desc, c.id;
$$;

comment on function public.alertas_para(text, jsonb) is
  'Alertas ativos e elegíveis desta identidade nesta base. Ativo é predicado (enabled and publicar_em <= now() and (encerrar_em is null or encerrar_em > now())), nunca job. Elegível é public.elegivel sobre a regra jsonb. NÃO devolve `regra`: widget.js é público. Base desconhecida ou nula devolve zero linhas (ausência fecha), com o mesmo aparo de public.codigo_normalizado do resto do escopo por base. EXECUTE só para service_role: sendo definer ela ignora a RLS, e com grant a authenticated qualquer Leitor deduzia a regra de qualquer cliente variando a identidade.';

revoke all on function public.alertas_para(text, jsonb) from public, anon, authenticated;
grant execute on function public.alertas_para(text, jsonb) to service_role;

-- =====================================================================
-- 4/4 — public.registrar_visualizacao(uuid, text, jsonb)
--
-- ── O PORTÃO É A PRÓPRIA FUNÇÃO DE ENTREGA ────────────────────────────
-- O `p_campanha` vem do CORPO da requisição, ou seja é controlado por quem
-- chama: a rota da tarefa 2 recebe a identidade do token (isso é confiável)
-- e o id do alerta do cliente (isso não é). Sem portão, qualquer chave
-- pública gravaria visualizações na campanha de qualquer outro cliente, e o
-- painel do dono da campanha mostraria pessoas que nunca a viram.
--
-- O portão é uma linha: a campanha tem de estar entre as que
-- `alertas_para` devolveria para ESSA base e ESSA identidade. Um predicado
-- só, num lugar só — se a entrega e a gravação divergissem, a cerca
-- passaria a depender de duas coisas concordarem.
--
-- Consequência aceita, e ela é uma escolha: uma visualização que chegue
-- depois de `encerrar_em` é RECUSADA, mesmo que o widget tenha renderizado
-- o alerta um instante antes de ele encerrar. Perde-se uma visualização na
-- fronteira; a alternativa (portão sem a janela) aceitaria visualizações de
-- uma campanha encerrada para sempre, inflando o único número que o painel
-- mostra. Perder na borda é melhor que inflar sem limite.
--
-- Devolve `true` quando a campanha é entregável a essa identidade — tanto
-- na primeira vez quanto nas repetições, que o `on conflict` absorve. `false`
-- é recusa do portão, e é isso que a rota deve tratar como "não é sua".
-- Devolver `false` na repetição faria o widget achar que falhou e tentar de
-- novo.
-- =====================================================================
create or replace function public.registrar_visualizacao(
  p_campanha uuid,
  p_base text,
  p_identidade jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
volatile security definer
set search_path to 'public', 'extensions'
as $$
begin
  if p_campanha is null then
    return false;
  end if;

  -- O PORTÃO. Mesmo predicado da entrega, uma vez só.
  if not exists (
    select 1 from public.alertas_para(p_base, p_identidade) a where a.id = p_campanha
  ) then
    return false;
  end if;

  -- As chaves da identidade são as DIMENSÕES (sem prefixo); as colunas
  -- seguem o nome do rastreio (com `p_`). A tradução é esta, e é a única
  -- do sistema. `->>` é a mesma extração que `elegivel` faz com
  -- `identidade #>> array[dim]`.
  --
  -- `nullif(btrim(...), '')`: branco e ausente têm de virar a MESMA coisa
  -- (nulo), senão a chave única trata `''` e nulo como valores diferentes
  -- e a mesma pessoa conta duas vezes conforme o anfitrião manda o campo
  -- vazio ou não manda o campo.
  insert into public.ai_campanha_visualizacoes (
    campanha_id, p_usuario, p_matricula, p_empresa, p_portal, p_perfil
  ) values (
    p_campanha,
    nullif(btrim(coalesce(p_identidade ->> 'usuario',   '')), ''),
    nullif(btrim(coalesce(p_identidade ->> 'matricula', '')), ''),
    nullif(btrim(coalesce(p_identidade ->> 'empresa',   '')), ''),
    nullif(btrim(coalesce(p_identidade ->> 'portal',    '')), ''),
    nullif(btrim(coalesce(p_identidade ->> 'perfil',    '')), '')
  )
  -- Repetição da MESMA pessoa não conta de novo e não atualiza `visto_em`:
  -- a data que interessa é a da primeira vez.
  on conflict on constraint ai_campanha_visualizacoes_pessoa_key do nothing;

  return true;
end
$$;

comment on function public.registrar_visualizacao(uuid, text, jsonb) is
  'Grava que esta identidade visualizou este alerta, e devolve false quando o alerta não é entregável a ela. O portão é public.alertas_para com a MESMA base e identidade, porque p_campanha vem do corpo da requisição e é controlado pelo chamador: sem portão, uma chave pública gravava visualização na campanha de outro cliente. Repetição da mesma pessoa não conta de novo (chave única) e devolve true, não false — false faria o widget achar que falhou. Identidade com usuario e matricula nulos grava visualização ANÔNIMA, uma linha por vez, porque nulo é distinto de nulo na chave única: dizer "alguém viu" é verdade, inventar quem viu não é. EXECUTE só para service_role.';

revoke all on function public.registrar_visualizacao(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_visualizacao(uuid, text, jsonb) to service_role;

-- =====================================================================
-- RLS — CAMINHO AUTENTICADO SÓ
--
-- Vale de novo o que o cabeçalho diz: `service_role` tem `rolbypassrls` e
-- ignora tudo isto. Estas policies são a cerca do admin interno com sessão.
-- A cerca do cliente são as duas funções acima mais o código da action.
-- =====================================================================
alter table public.ai_campanhas              enable row level security;
alter table public.ai_campanha_visualizacoes enable row level security;

drop policy if exists ai_campanhas_admin on public.ai_campanhas;
create policy ai_campanhas_admin on public.ai_campanhas
  for all to authenticated
  using (public.has_permission(auth.uid(), 'ai.configure', null))
  with check (public.has_permission(auth.uid(), 'ai.configure', null));

drop policy if exists ai_campanha_visualizacoes_admin on public.ai_campanha_visualizacoes;
create policy ai_campanha_visualizacoes_admin on public.ai_campanha_visualizacoes
  for all to authenticated
  using (public.has_permission(auth.uid(), 'ai.configure', null))
  with check (public.has_permission(auth.uid(), 'ai.configure', null));

revoke all on public.ai_campanhas              from anon, public;
revoke all on public.ai_campanha_visualizacoes from anon, public;

-- =====================================================================
-- ASSERTIVA A — A ENTREGA: AS QUATRO EXIGIDAS, CADA UMA COM CONTROLE
--
-- Comportamental, não de substring. E cada caso negativo vem com o caso
-- POSITIVO correspondente, porque uma assertiva negativa sozinha também
-- passa quando a função não devolve nada — e aí ela não guarda nada,
-- apenas ensina a confiar nela. Este ramo já pagou por uma assertiva que
-- media o arreio.
--
-- Não existe `rollback` dentro de bloco anônimo (o comando não existe em
-- PL/pgSQL); o que garante que nada sobrevive a uma falha é
-- `scripts/apply-migrations.ts`, que envolve o arquivo inteiro em
-- begin/commit. Além disso há limpeza defensiva no início e final no fim,
-- as duas por prefixo `zz-`.
-- =====================================================================
do $entrega$
declare
  v_base_a uuid;
  v_base_b uuid;
  v_cod_a  text := 'zz-campanha-assert-base-a';
  v_cod_b  text := 'zz-campanha-assert-base-b';
  v_pg     jsonb := '{"portal":"PG"}'::jsonb;
  v_po     jsonb := '{"portal":"PO"}'::jsonb;
  v_futuro uuid;
  v_agora  uuid;
  v_outra  uuid;
  v_restr  uuid;
  v_encer  uuid;
  v_deslig uuid;
  v_tem    boolean;
begin
  delete from public.ai_bases where base_code like 'zz-campanha-assert-%';

  insert into public.ai_bases (base_code, name) values (v_cod_a, v_cod_a) returning id into v_base_a;
  insert into public.ai_bases (base_code, name) values (v_cod_b, v_cod_b) returning id into v_base_b;

  insert into public.ai_campanhas (base_id, titulo, corpo, publicar_em) values
    (v_base_a, 'zz futuro',  'ainda nao publicado', now() + interval '1 day')
    returning id into v_futuro;
  insert into public.ai_campanhas (base_id, titulo, corpo, publicar_em) values
    (v_base_a, 'zz agora',   'publicado',           now() - interval '1 hour')
    returning id into v_agora;
  insert into public.ai_campanhas (base_id, titulo, corpo, publicar_em) values
    (v_base_b, 'zz da base b', 'de outro cliente',  now() - interval '1 hour')
    returning id into v_outra;
  insert into public.ai_campanhas (base_id, titulo, corpo, publicar_em, regra) values
    (v_base_a, 'zz so PG', 'restrito por portal',   now() - interval '1 hour', '{"portal":["PG"]}'::jsonb)
    returning id into v_restr;
  insert into public.ai_campanhas (base_id, titulo, corpo, publicar_em, encerrar_em) values
    (v_base_a, 'zz encerrada', 'janela fechada',    now() - interval '2 days', now() - interval '1 day')
    returning id into v_encer;
  insert into public.ai_campanhas (base_id, titulo, corpo, publicar_em, enabled) values
    (v_base_a, 'zz desligada', 'enabled false',     now() - interval '1 hour', false)
    returning id into v_deslig;

  -- ── 1. `publicar_em` no futuro NÃO sai ──────────────────────────────
  -- O controle positivo (`zz agora`, mesma base, mesma regra vazia, só a
  -- data diferente) é o que faz a assertiva negativa medir a DATA e não a
  -- existência da campanha. Tirando `publicar_em <= now()` da função, a
  -- primeira falha; tirando a função inteira, a segunda falha.
  select exists (select 1 from public.alertas_para(v_cod_a, v_pg) a where a.id = v_futuro) into v_tem;
  assert not v_tem,
    'assertiva 1: alerta com publicar_em no FUTURO nao pode sair, e saiu — o predicado de agendamento nao esta cortando';

  select exists (select 1 from public.alertas_para(v_cod_a, v_pg) a where a.id = v_agora) into v_tem;
  assert v_tem,
    'assertiva 1 (controle): alerta com publicar_em no PASSADO tem de sair, e nao saiu — a assertiva de cima estaria passando por a funcao devolver nada';
  raise notice 'assertiva 1 OK — publicar_em no futuro nao sai, no passado sai';

  -- ── 2. Alerta de OUTRA base NÃO sai ─────────────────────────────────
  select exists (select 1 from public.alertas_para(v_cod_a, v_pg) a where a.id = v_outra) into v_tem;
  assert not v_tem,
    'assertiva 2: alerta da base B nao pode sair na base A, e saiu — a cerca entre clientes esta aberta';

  select exists (select 1 from public.alertas_para(v_cod_b, v_pg) a where a.id = v_outra) into v_tem;
  assert v_tem,
    'assertiva 2 (controle): o alerta da base B tem de sair NA base B, e nao saiu';

  -- E base que não existe fecha, que é o caso que distingue "fecha" de
  -- "abre em silêncio" quando `bases_do_codigo` não casa nada.
  select count(*) = 0 into v_tem from public.alertas_para('zz-base-que-nao-existe', v_pg);
  assert v_tem,
    'assertiva 2 (ausencia): base inexistente tem de devolver ZERO alertas (ausencia fecha), e devolveu alguma coisa';
  raise notice 'assertiva 2 OK — alerta de outra base nao sai, sai na propria, e base inexistente fecha';

  -- ── 3. Restrição por portal: identidade errada não, certa sim ────────
  select exists (select 1 from public.alertas_para(v_cod_a, v_po) a where a.id = v_restr) into v_tem;
  assert not v_tem,
    'assertiva 3: alerta restrito a PG nao pode sair para identidade PO, e saiu';

  select exists (select 1 from public.alertas_para(v_cod_a, v_pg) a where a.id = v_restr) into v_tem;
  assert v_tem,
    'assertiva 3 (controle): alerta restrito a PG tem de sair para identidade PG, e nao saiu';

  -- Identidade SEM a dimensão restrita também fecha (ausência fecha), e
  -- este é o caso real de cliente que ainda não recolou o bloco APEX.
  select exists (select 1 from public.alertas_para(v_cod_a, '{}'::jsonb) a where a.id = v_restr) into v_tem;
  assert not v_tem,
    'assertiva 3 (ausencia): identidade sem portal nao pode alcancar alerta restrito a PG — ausencia fecha';
  raise notice 'assertiva 3 OK — restricao por portal fecha para PO e para identidade vazia, e abre para PG';

  -- ── Janela encerrada e enabled=false ────────────────────────────────
  -- Não estão na lista das quatro, mas são os outros dois ramos do mesmo
  -- predicado: sem eles, remover `encerrar_em > now()` ou `enabled` não
  -- faria nenhuma assertiva falhar.
  select exists (select 1 from public.alertas_para(v_cod_a, v_pg) a where a.id = v_encer) into v_tem;
  assert not v_tem,
    'alerta com encerrar_em no PASSADO nao pode sair, e saiu';

  select exists (select 1 from public.alertas_para(v_cod_a, v_pg) a where a.id = v_deslig) into v_tem;
  assert not v_tem,
    'alerta com enabled=false nao pode sair, e saiu';
  raise notice 'assertiva extra OK — encerrar_em no passado e enabled=false tambem cortam';

  -- ── A regra NÃO sai para o widget ───────────────────────────────────
  -- `widget.js` é público. Se alguém acrescentar `regra` ao retorno, esta
  -- assertiva quebra antes de a configuração do cliente virar dado público.
  assert not exists (
    select 1
      from information_schema.routines r
      join information_schema.parameters p
        on p.specific_name = r.specific_name
     where r.routine_schema = 'public'
       and r.routine_name = 'alertas_para'
       and p.parameter_mode = 'OUT'
       and p.parameter_name = 'regra'
  ), 'alertas_para NAO pode devolver a coluna `regra`: widget.js e publico e a regra e configuracao interna do cliente';
  raise notice 'assertiva extra OK — alertas_para nao expoe a regra';

  delete from public.ai_bases where base_code like 'zz-campanha-assert-%';
end $entrega$;

-- =====================================================================
-- ASSERTIVA B — A GRAVAÇÃO: MESMA VISUALIZAÇÃO DUAS VEZES CONTA UMA
--
-- Quatro coisas, e cada uma falha se a peça que ela guarda sair:
--   1. duas chamadas com a MESMA identidade → UMA linha (chave única);
--   2. controle: identidade DIFERENTE → linha própria (senão o item 1
--      passaria com a função não inserindo nada);
--   3. identidade anônima (sem usuário e sem matrícula) → uma linha POR
--      chamada, que é a semântica de NULLS DISTINCT documentada acima;
--   4. campanha de OUTRA base → recusada, e nada gravado (o portão).
-- =====================================================================
do $gravacao$
declare
  v_base_a uuid;
  v_base_b uuid;
  v_cod_a  text := 'zz-visu-assert-base-a';
  v_cod_b  text := 'zz-visu-assert-base-b';
  v_camp_a uuid;
  v_camp_b uuid;
  v_ana    jsonb := '{"portal":"PG","usuario":"zz.ana","matricula":"9001","empresa":"1"}'::jsonb;
  v_ana2   jsonb := '{"portal":"PG","usuario":"zz.ana","matricula":"9001","empresa":"1","perfil":"MASTER"}'::jsonb;
  v_bruno  jsonb := '{"portal":"PG","usuario":"zz.bruno","matricula":"9002"}'::jsonb;
  v_anon   jsonb := '{"portal":"PG"}'::jsonb;
  v_ok     boolean;
  v_n      int;
begin
  delete from public.ai_bases where base_code like 'zz-visu-assert-%';

  insert into public.ai_bases (base_code, name) values (v_cod_a, v_cod_a) returning id into v_base_a;
  insert into public.ai_bases (base_code, name) values (v_cod_b, v_cod_b) returning id into v_base_b;

  insert into public.ai_campanhas (base_id, titulo, publicar_em)
    values (v_base_a, 'zz alerta da base a', now() - interval '1 hour')
    returning id into v_camp_a;
  insert into public.ai_campanhas (base_id, titulo, publicar_em)
    values (v_base_b, 'zz alerta da base b', now() - interval '1 hour')
    returning id into v_camp_b;

  -- ── 1. A MESMA pessoa duas vezes conta UMA ──────────────────────────
  v_ok := public.registrar_visualizacao(v_camp_a, v_cod_a, v_ana);
  assert v_ok, 'a primeira visualizacao de uma campanha entregavel tem de ser aceita, e foi recusada';

  -- Segunda chamada com a identidade ligeiramente diferente no que NÃO é
  -- chave (ganhou `perfil`): a chave é (campanha, usuario, matricula), e
  -- variar o resto não pode criar linha nova.
  v_ok := public.registrar_visualizacao(v_camp_a, v_cod_a, v_ana2);
  assert v_ok,
    'a repeticao tem de devolver true (a campanha continua entregavel), e devolveu false — o widget acharia que falhou e tentaria de novo';

  select count(*) into v_n
    from public.ai_campanha_visualizacoes
   where campanha_id = v_camp_a and p_usuario = 'zz.ana';
  assert v_n = 1,
    format('a MESMA pessoa duas vezes tem de contar UMA, e contou %s — sem a chave unica um usuario que abrisse o chat dez vezes viraria dez visualizacoes', v_n);
  raise notice 'assertiva B.1 OK — mesma pessoa duas vezes conta uma, e a repeticao devolve true';

  -- ── 2. Controle: outra pessoa tem linha própria ─────────────────────
  v_ok := public.registrar_visualizacao(v_camp_a, v_cod_a, v_bruno);
  assert v_ok, 'visualizacao de outra pessoa na mesma campanha tem de ser aceita';

  select count(*) into v_n
    from public.ai_campanha_visualizacoes where campanha_id = v_camp_a;
  assert v_n = 2,
    format('duas pessoas distintas tem de ser DUAS linhas, e vieram %s — se fosse 1, a assertiva B.1 estaria passando por nada ser inserido', v_n);
  raise notice 'assertiva B.2 OK — pessoa diferente tem linha propria (o controle da B.1)';

  -- ── 3. Anônimo: uma linha por chamada, e fora do drilldown ──────────
  -- Nulo é DISTINTO de nulo na chave única. Duas visualizações anônimas
  -- são duas linhas, e nenhuma delas diz quem viu.
  v_ok := public.registrar_visualizacao(v_camp_a, v_cod_a, v_anon);
  assert v_ok, 'visualizacao anonima tem de ser aceita: dizer "alguem viu" e verdade';
  v_ok := public.registrar_visualizacao(v_camp_a, v_cod_a, v_anon);
  assert v_ok, 'a segunda visualizacao anonima tambem tem de ser aceita';

  select count(*) into v_n
    from public.ai_campanha_visualizacoes
   where campanha_id = v_camp_a and p_usuario is null and p_matricula is null;
  assert v_n = 2,
    format('duas visualizacoes ANONIMAS sao DUAS linhas (nulo e distinto de nulo na chave unica), e vieram %s — com `nulls not distinct` cinquenta anonimos virariam "um viu"', v_n);
  raise notice 'assertiva B.3 OK — visualizacao anonima grava uma linha por vez e nao entra no drilldown por pessoa';

  -- ── 4. O PORTÃO: campanha de outra base é recusada ──────────────────
  -- `p_campanha` vem do corpo da requisicao. Este é o caso que a sabotagem
  -- da tarefa 4 vai repetir por fora.
  v_ok := public.registrar_visualizacao(v_camp_b, v_cod_a, v_ana);
  assert not v_ok,
    'o portao tem de RECUSAR visualizacao de campanha de outra base, e aceitou — uma chave publica gravaria no painel de outro cliente';

  select count(*) into v_n from public.ai_campanha_visualizacoes where campanha_id = v_camp_b;
  assert v_n = 0,
    format('campanha de outra base nao pode ganhar NENHUMA linha, e ganhou %s', v_n);

  -- E o controle: a MESMA campanha, chamada com a base DELA, é aceita.
  v_ok := public.registrar_visualizacao(v_camp_b, v_cod_b, v_ana);
  assert v_ok,
    'a mesma campanha chamada com a base DELA tem de ser aceita — sem isto a recusa acima poderia ser a funcao recusando tudo';
  raise notice 'assertiva B.4 OK — o portao recusa campanha de outra base e aceita a da propria';

  -- ── 5. Campanha que NÃO está ativa não aceita visualização ──────────
  update public.ai_campanhas set enabled = false where id = v_camp_a;
  v_ok := public.registrar_visualizacao(v_camp_a, v_cod_a, '{"usuario":"zz.carla","matricula":"9003"}'::jsonb);
  assert not v_ok,
    'campanha desligada nao pode aceitar visualizacao nova: o portao e o MESMO predicado da entrega';
  raise notice 'assertiva B.5 OK — o portao usa o predicado inteiro, nao so a base';

  delete from public.ai_bases where base_code like 'zz-visu-assert-%';

  -- A cascata tem de levar as visualizações junto: painel de campanha
  -- apagada com linhas órfãs seria contagem sem dono.
  select count(*) into v_n
    from public.ai_campanha_visualizacoes v
   where not exists (select 1 from public.ai_campanhas c where c.id = v.campanha_id);
  assert v_n = 0,
    format('apagar a base tem de cascatear ai_bases -> ai_campanhas -> ai_campanha_visualizacoes, e sobraram %s linhas orfas', v_n);
  raise notice 'assertiva B.6 OK — a cascata leva as visualizacoes junto';
end $gravacao$;

-- =====================================================================
-- ASSERTIVA C — ESTADO DE GRANT DAS DUAS FUNÇÕES
--
-- `has_function_privilege('anon', ...)` responde verdadeiro quando é
-- PUBLIC que tem o privilégio, então negar `anon` prova junto que PUBLIC
-- não tem. É exatamente o erro que 17 migrations deste repositório
-- cometeram: revogar só de `anon` é no-op, porque PUBLIC inclui `anon`.
-- =====================================================================
do $grants$
begin
  assert not has_function_privilege('anon', 'public.alertas_para(text, jsonb)', 'execute'),
    'alertas_para nao pode ter EXECUTE para anon nem para PUBLIC';
  assert not has_function_privilege('authenticated', 'public.alertas_para(text, jsonb)', 'execute'),
    'alertas_para nao pode ter EXECUTE para authenticated: sendo definer ela ignora a RLS, e qualquer Leitor deduzia a regra de qualquer cliente variando a identidade';
  assert has_function_privilege('service_role', 'public.alertas_para(text, jsonb)', 'execute'),
    'alertas_para tem de continuar executavel por service_role — /api/v1/config chama com createAdminClient';

  assert not has_function_privilege('anon', 'public.registrar_visualizacao(uuid, text, jsonb)', 'execute'),
    'registrar_visualizacao nao pode ter EXECUTE para anon nem para PUBLIC: seria escrita direta do navegador';
  assert not has_function_privilege('authenticated', 'public.registrar_visualizacao(uuid, text, jsonb)', 'execute'),
    'registrar_visualizacao nao pode ter EXECUTE para authenticated';
  assert has_function_privilege('service_role', 'public.registrar_visualizacao(uuid, text, jsonb)', 'execute'),
    'registrar_visualizacao tem de continuar executavel por service_role — a rota /api/v1/alertas/visto chama com createAdminClient';

  raise notice 'assertiva C OK — as duas funcoes: revogadas de public/anon/authenticated, EXECUTE so para service_role';
end $grants$;

-- =====================================================================
-- ASSERTIVA D — NENHUM DENOMINADOR NASCEU AQUI
--
-- A restrição do dono é "só quem visualizou, nunca quem não visualizou", e
-- ela só continua expressável se nenhuma coluna, view ou função deste
-- schema prometer um total. Esta assertiva é a rede: se alguém
-- acrescentar `total_destinatarios`, `percentual_lido`, `taxa_leitura` ou
-- `elegiveis_count` a qualquer objeto de campanha, ela quebra antes de o
-- número aparecer numa tela.
--
-- Ela olha nome, e nome é sinal fraco — por isso a defesa de verdade está
-- no cabeçalho e na revisão. Mas o nome é o que a pessoa escreve primeiro.
-- =====================================================================
do $denominador$
declare
  v_col text;
  v_fn  text;
begin
  select string_agg(table_name || '.' || column_name, ', ') into v_col
    from information_schema.columns
   where table_schema = 'public'
     and table_name like '%campanha%'
     and (
       column_name like '%total%'
       or column_name like '%percent%'
       or column_name like '%taxa%'
       or column_name like '%destinatario%'
       or column_name like '%elegiveis%'
       or column_name like '%nao_visto%'
       or column_name like '%nao_lido%'
     );
  assert v_col is null,
    format('coluna de DENOMINADOR em tabela de campanha: %s. Nao existe cadastro de usuarios neste banco; a maior base conhece 7 usuarios distintos, e qualquer total sobre esse universo mede adocao do chatbot parecendo medir alcance da campanha. Traga o roster do ERP antes de criar a coluna.', v_col);

  select string_agg(p.proname, ', ') into v_fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and (
       p.proname like '%taxa_leitura%'
       or p.proname like '%percentual_%'
       or p.proname like '%destinatarios%'
       or p.proname like '%nao_visualiz%'
     );
  assert v_fn is null,
    format('funcao de DENOMINADOR: %s. Mesmo motivo: o painel mostra quem visualizou, e nao tenta mostrar quem nao visualizou.', v_fn);

  raise notice 'assertiva D OK — nenhuma coluna nem funcao de denominador em campanhas';
end $denominador$;
