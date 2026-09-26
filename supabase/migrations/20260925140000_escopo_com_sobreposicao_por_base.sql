-- =====================================================================
-- A LINHA POR BASE VIRA SOBREPOSIÇÃO, E ELA SÓ ESTREITA
--
-- `public.escopo_documentacao` era `union` puro: o primeiro ramo devolvia
-- toda `documentacoes_universais` habilitada e elegível, o segundo devolvia
-- `ai_base_documentacoes` daquela base. União é OU, então a linha por base
-- só conseguia SOMAR — desligar não desligava, e regra mais estreita por
-- base não estreitava, porque o ramo mais frouxo ganhava.
--
-- A tela do cliente (`/gestao/conteudo`, tarefa 8) já está escrita
-- prometendo sobreposição, com os três estados Padrão · Ajustada · Oculta.
-- Esta migration é o lado do banco dessa promessa.
--
-- A semântica nova é a MESMA que o produto já usa para conteúdo de
-- documentação (`space_overlays`, com `hidden` e `override_article_id`):
--
--   · sem linha para (base, documentação)  → vale a universal, com a regra
--     da Natcorp. É o padrão, e é o "acessível de forma padrão por todas as
--     bases" da especificação;
--   · linha com `enabled = false`          → aquela documentação DESAPARECE
--     para os usuários daquela base;
--   · linha com `enabled = true` e `regra` → a pessoa precisa satisfazer AS
--     DUAS regras, a da Natcorp e a da base. INTERSEÇÃO, não substituição.
--
-- ── Por que INTERSEÇÃO e não substituição (decisão do dono, 25/09) ─────
-- Substituir deixaria um cliente ABRIR o que a Natcorp fechou: liberar para
-- a empresa inteira dele uma documentação que a Natcorp restringiu a um
-- portal. A especificação diz que a parametrização por portal existe "pois
-- existem documentações específicas para cada portal", então permitir
-- desfazê-la poria o manual do Operador na frente de um Colaborador — que é
-- precisamente o que a regra existe para evitar. E a postura deste projeto
-- inteiro é que o ramo mais frouxo ganhar é DEFEITO, não recurso: foi isso
-- que a tarefa 2 corrigiu em `chunks_write`, e reintroduzir aqui seria andar
-- para trás. A regra da Natcorp é TETO; o cliente só aperta.
--
-- Em SQL isso é `public.elegivel(u.regra, ident) and public.elegivel(d.regra,
-- ident)` — a MESMA função duas vezes, nenhuma segunda implementação da
-- regra. A assertiva 4 lá embaixo é a que PROVA esta decisão: ela falha se
-- alguém trocar interseção por substituição.
--
-- ── ENQUANTO EXISTIR LINHA UNIVERSAL, ELA É O TETO — inclusive desligada ──
-- O `not exists` do segundo ramo olha a EXISTÊNCIA da linha universal, não o
-- `enabled` dela. Consequência, que é decisão de semântica e está aqui para
-- quem vier depois não a descobrir por acidente:
--
--   universal com `enabled = false` + linha da base com `enabled = true`
--   → a documentação NÃO alcança ninguém.
--
-- É o teto levado às últimas: `enabled = false` na universal é teto ZERO, e
-- nenhuma linha de cliente reabre teto. É coerente com a trava da tela
-- (`estaNoPocoUniversal` exige `enabled = true` para o cliente poder criar a
-- sobreposição) e com a doutrina "o cliente só aperta".
--
-- Para devolver uma documentação ao controle POR BASE, o caminho é APAGAR a
-- linha de `documentacoes_universais`, não desligá-la: sem a linha, o
-- `not exists` passa e o anexo por base volta a valer. A assertiva 6 fixa
-- esse comportamento, e é o lugar de mexer se o dono decidir o contrário.
--
-- ── Para RETIRAR uma documentação que vem da CHAVE ─────────────────────
-- Não é aqui, e é a pergunta que a próxima pessoa vai fazer. O escopo da
-- chave (`widget_key_spaces`) passa a ser SEMPRE somado pelo lado da
-- aplicação (`decidirEscopo`, em `src/lib/ai/escopo-da-base.ts`), então
-- nenhuma configuração desta função remove uma documentação de chave. Para
-- retirar uma, remova-a onde ela é configurada — a tela da chave, em
-- `/admin/widget`. Isso é explícito e é da Natcorp. O cliente não tira
-- documentação de chave; ele só esconde universal.
--
-- ── `create or replace`, e NUNCA `drop function` aqui ──────────────────
-- A assinatura NÃO muda: `(text, jsonb)` entra e `(text, jsonb)` sai. Um
-- `drop function` + `create` devolveria EXECUTE a PUBLIC (portanto a `anon`)
-- e desfaria o revoke da migration 20260925100000. É o OPOSTO da tarefa 7,
-- onde a assinatura ganhou parâmetro e o drop era obrigatório para não
-- deixar duas funções de pé e toda chamada existente ficar ambígua.
-- Situação oposta, regra oposta.
--
-- ── `in (select …)` e não subconsulta escalar ──────────────────────────
-- Mesma razão da tarefa 7: `base_code` normalizado pode, em teoria, casar
-- mais de uma linha, e `(select id from alvo)` como escalar levantaria "more
-- than one row returned by a subquery used as an expression" — erro que
-- `rag.ts` engole, porque as chamadas desestruturam só `{ data }`. O índice
-- único de 20260925130000 fecha a porta, mas a função não depende dele.
--
-- ── CORPO SUPERADO EM PARTE: o normalizador e o grant ──────────────────
-- O corpo daqui compara `lower(btrim(b.base_code)) = lower(btrim(coalesce(
-- p_base, '')))`, com `btrim` de UM argumento, que apara só espaço. A
-- `20260925160000_branco_unico_e_grants.sql` trocou por
-- `public.codigo_normalizado`, que apara os CINCO caracteres de
-- `public.allowlist_casa` (espaço, TAB, LF, CR, NBSP) — o mesmo conjunto que a
-- dimensão `base` de `public.elegivel` já usava, e cuja divergência fazia uma
-- base com NBSP no código ser "outra" para o índice e "a mesma" para a regra. A
-- mesma migration revogou o EXECUTE de `authenticated`: sendo `security
-- definer`, esta função ignora a RLS das quatro tabelas que lê, e o único
-- chamador é `service_role` (`src/lib/ai/escopo-da-base.ts`, via
-- `createAdminClient`).
--
-- A ASSINATURA é a mesma nas duas, então reaplicar ESTE arquivo sozinho não cria
-- função duplicada: ele SILENCIOSAMENTE volta o aparo de um caractere e devolve
-- o EXECUTE a `authenticated`. Reaplique a 20260925160000 depois, sempre.
-- =====================================================================

create or replace function public.escopo_documentacao(
  p_base text,
  p_identidade jsonb default '{}'::jsonb
)
returns table (space_id uuid, origem text)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  with alvo as (
    select b.id
      from public.ai_bases b
     where lower(btrim(b.base_code)) = lower(btrim(coalesce(p_base, '')))
  )
  -- Ramo 1: as universais, JÁ com a sobreposição desta base aplicada.
  -- `left join` com a base no ON (e não no WHERE): sem linha da base, o lado
  -- direito vem nulo e a universal vale como está. Base desconhecida deixa
  -- `alvo` vazio, nenhuma linha casa, e o resultado é só as universais — o
  -- comportamento documentado desde 20260925100000.
  select u.space_id, 'universal'::text
    from public.documentacoes_universais u
    left join public.ai_base_documentacoes d
      on d.space_id = u.space_id
     and d.base_id in (select id from alvo)
   where u.enabled
     and public.elegivel(u.regra, p_identidade)
     and (
       -- sem sobreposição: vale a universal
       d.space_id is null
       -- com sobreposição habilitada: INTERSEÇÃO das duas regras
       or (d.enabled and public.elegivel(d.regra, p_identidade))
     )
  union
  -- Ramo 2: anexo por base que NÃO é universal. O `not exists` evita contar
  -- a mesma documentação duas vezes (uma por origem) e deixa explícito que
  -- este ramo é só para o que a Natcorp não ofereceu a todos.
  select d.space_id, 'base'::text
    from public.ai_base_documentacoes d
   where d.base_id in (select id from alvo)
     and d.enabled
     and public.elegivel(d.regra, p_identidade)
     and not exists (
       select 1 from public.documentacoes_universais u2 where u2.space_id = d.space_id
     );
$$;

comment on function public.escopo_documentacao(text, jsonb) is
  'Documentações que esta identidade alcança nesta base. A linha de ai_base_documentacoes é SOBREPOSIÇÃO sobre a universal e só ESTREITA: sem linha vale a universal; enabled=false esconde; enabled=true exige as DUAS regras (interseção, nunca substituição — a regra da Natcorp é teto). Enquanto existir linha universal ela é o teto, inclusive desligada: para devolver a documentação ao controle por base, APAGUE a linha universal. O segundo ramo devolve só anexo por base que não é universal. Base desconhecida devolve só as universais. Escopo da chave do widget NÃO passa por aqui: ele é somado pela aplicação (decidirEscopo) e se retira em /admin/widget.';

-- Restatados de propósito: `create or replace` preserva privilégio, mas o
-- arquivo tem de ser auto-suficiente e re-rodável (não há ledger). `public`
-- inclui `anon`, então revogar só de `anon` seria no-op.
revoke all on function public.escopo_documentacao(text, jsonb) from public, anon;
grant execute on function public.escopo_documentacao(text, jsonb) to authenticated, service_role;

-- =====================================================================
-- ASSERTIVAS OBRIGATÓRIAS — comportamentais, não de substring
--
-- Molde da migration 20260925120000: dado de teste com prefixo `zz-`,
-- limpeza defensiva na entrada (caso uma aplicação anterior tenha sido
-- interrompida) e limpeza explícita na saída. Não há `rollback` dentro de um
-- bloco anônimo (o comando não existe em PL/pgSQL); o que garante que nada
-- sobrevive a uma falha é `scripts/apply-migrations.ts`, que envolve o
-- arquivo inteiro em begin/commit — qualquer `assert` que falhe aborta a
-- transação e reverte tudo junto. Os dois caminhos, sucesso e falha, saem
-- sem linha de teste no banco.
--
-- Seis espaços de teste, um por comportamento:
--   u1 → universal aberta, SEM sobreposição            (assertiva 1)
--   u2 → universal aberta, sobreposição enabled=false  (assertiva 2)
--   u3 → universal aberta, sobreposição com regra PG   (assertiva 3)
--   u4 → universal restrita a PG, sobreposição ABERTA  (assertiva 4)
--   b1 → NÃO universal, anexada à base A               (assertiva 5)
--   u5 → universal DESLIGADA, sobreposição habilitada  (assertiva 6)
-- =====================================================================
do $$
declare
  v_base_a uuid;
  v_base_b uuid;
  v_sp_u1  uuid;
  v_sp_u2  uuid;
  v_sp_u3  uuid;
  v_sp_u4  uuid;
  v_sp_u5  uuid;
  v_sp_b1  uuid;
  v_cod_a  text  := 'zz-tarefa9-assert-base-a';
  v_cod_b  text  := 'zz-tarefa9-assert-base-b';
  v_pg     jsonb := '{"portal":"PG"}'::jsonb;
  v_po     jsonb := '{"portal":"PO"}'::jsonb;
  v_tem    boolean;
  v_origem text;
begin
  -- Limpeza defensiva. `spaces` cascateia para as duas tabelas de
  -- documentação; `ai_bases` cascateia para `ai_base_documentacoes`.
  delete from public.spaces   where slug      like 'zz-tarefa9-assert-%';
  delete from public.ai_bases where base_code like 'zz-tarefa9-assert-%';

  insert into public.ai_bases (base_code, name) values (v_cod_a, v_cod_a) returning id into v_base_a;
  insert into public.ai_bases (base_code, name) values (v_cod_b, v_cod_b) returning id into v_base_b;

  insert into public.spaces (slug, name, type, visibility)
    values ('zz-tarefa9-assert-u1', 'zz-tarefa9-assert-u1', 'client', 'private') returning id into v_sp_u1;
  insert into public.spaces (slug, name, type, visibility)
    values ('zz-tarefa9-assert-u2', 'zz-tarefa9-assert-u2', 'client', 'private') returning id into v_sp_u2;
  insert into public.spaces (slug, name, type, visibility)
    values ('zz-tarefa9-assert-u3', 'zz-tarefa9-assert-u3', 'client', 'private') returning id into v_sp_u3;
  insert into public.spaces (slug, name, type, visibility)
    values ('zz-tarefa9-assert-u4', 'zz-tarefa9-assert-u4', 'client', 'private') returning id into v_sp_u4;
  insert into public.spaces (slug, name, type, visibility)
    values ('zz-tarefa9-assert-u5', 'zz-tarefa9-assert-u5', 'client', 'private') returning id into v_sp_u5;
  insert into public.spaces (slug, name, type, visibility)
    values ('zz-tarefa9-assert-b1', 'zz-tarefa9-assert-b1', 'client', 'private') returning id into v_sp_b1;

  insert into public.documentacoes_universais (space_id, enabled, regra) values
    (v_sp_u1, true,  '{}'::jsonb),
    (v_sp_u2, true,  '{}'::jsonb),
    (v_sp_u3, true,  '{}'::jsonb),
    (v_sp_u4, true,  '{"portal":["PG"]}'::jsonb),
    (v_sp_u5, false, '{}'::jsonb);

  insert into public.ai_base_documentacoes (base_id, space_id, enabled, regra) values
    (v_base_a, v_sp_u2, false, '{}'::jsonb),
    (v_base_a, v_sp_u3, true,  '{"portal":["PG"]}'::jsonb),
    (v_base_a, v_sp_u4, true,  '{}'::jsonb),
    (v_base_a, v_sp_u5, true,  '{}'::jsonb),
    (v_base_a, v_sp_b1, true,  '{}'::jsonb);

  -- ── 1. Universal SEM sobreposição alcança ─────────────────────────────
  select exists (select 1 from public.escopo_documentacao(v_cod_a, v_pg) e where e.space_id = v_sp_u1)
    into v_tem;
  assert v_tem,
    'assertiva 1: universal sem sobreposicao deveria alcancar a base A, e nao alcancou';

  select e.origem into v_origem
    from public.escopo_documentacao(v_cod_a, v_pg) e where e.space_id = v_sp_u1;
  assert v_origem = 'universal',
    format('assertiva 1: origem da universal sem sobreposicao deveria ser universal, veio %s', v_origem);
  raise notice 'assertiva 1 OK — universal sem sobreposicao alcanca, com origem universal';

  -- ── 2. Sobreposição com enabled=false ESCONDE (e só naquela base) ─────
  select exists (select 1 from public.escopo_documentacao(v_cod_a, v_pg) e where e.space_id = v_sp_u2)
    into v_tem;
  assert not v_tem,
    'assertiva 2: sobreposicao com enabled=false deveria ESCONDER a documentacao na base A, e ela apareceu';

  select exists (select 1 from public.escopo_documentacao(v_cod_b, v_pg) e where e.space_id = v_sp_u2)
    into v_tem;
  assert v_tem,
    'assertiva 2: esconder na base A nao pode esconder na base B, e a base B deixou de alcancar';
  raise notice 'assertiva 2 OK — enabled=false esconde na base A e NAO esconde na base B';

  -- ── 3. Sobreposição com regra ESTREITA ────────────────────────────────
  -- A universal é aberta: sem a sobreposição, PO alcançaria. Com ela, não.
  select exists (select 1 from public.escopo_documentacao(v_cod_a, v_po) e where e.space_id = v_sp_u3)
    into v_tem;
  assert not v_tem,
    'assertiva 3: identidade que passa na universal e NAO passa na regra da base nao pode alcancar, e alcancou';

  select exists (select 1 from public.escopo_documentacao(v_cod_a, v_pg) e where e.space_id = v_sp_u3)
    into v_tem;
  assert v_tem,
    'assertiva 3: identidade que passa nas DUAS regras deveria alcancar, e nao alcancou';

  -- A mesma documentação, na base B (sem sobreposição), continua aberta a
  -- PO: prova que o aperto é da base A e não virou regra global.
  select exists (select 1 from public.escopo_documentacao(v_cod_b, v_po) e where e.space_id = v_sp_u3)
    into v_tem;
  assert v_tem,
    'assertiva 3: estreitar na base A nao pode estreitar na base B, e a base B recusou a identidade PO';
  raise notice 'assertiva 3 OK — regra da base ESTREITA (PO fora, PG dentro) e so na base A';

  -- ── 4. Sobreposição NÃO ALARGA — a que prova a interseção ─────────────
  -- Universal restrita a PG, sobreposição da base liberando tudo. A
  -- identidade PO tem de CONTINUAR sem alcançar. Se alguém trocar
  -- interseção por substituição, esta é a assertiva que quebra.
  select exists (select 1 from public.escopo_documentacao(v_cod_a, v_po) e where e.space_id = v_sp_u4)
    into v_tem;
  assert not v_tem,
    'assertiva 4: sobreposicao ABERTA nao pode alargar universal restrita a PG — identidade PO alcancou, e a intersecao virou substituicao';

  select exists (select 1 from public.escopo_documentacao(v_cod_a, v_pg) e where e.space_id = v_sp_u4)
    into v_tem;
  assert v_tem,
    'assertiva 4: identidade PG deveria continuar alcancando a universal restrita a PG, e nao alcancou';
  raise notice 'assertiva 4 OK — sobreposicao ABERTA nao alarga universal restrita a PG (INTERSECAO)';

  -- ── 5. Anexo por base que NÃO é universal continua alcançando ─────────
  select exists (select 1 from public.escopo_documentacao(v_cod_a, v_pg) e where e.space_id = v_sp_b1)
    into v_tem;
  assert v_tem,
    'assertiva 5: anexo por base que nao e universal deveria alcancar, e nao alcancou';

  select e.origem into v_origem
    from public.escopo_documentacao(v_cod_a, v_pg) e where e.space_id = v_sp_b1;
  assert v_origem = 'base',
    format('assertiva 5: origem do anexo por base deveria ser base, veio %s', v_origem);

  select exists (select 1 from public.escopo_documentacao(v_cod_b, v_pg) e where e.space_id = v_sp_b1)
    into v_tem;
  assert not v_tem,
    'assertiva 5: anexo da base A nao pode aparecer na base B, e apareceu';
  raise notice 'assertiva 5 OK — anexo por base nao universal alcanca, com origem base, e so na base A';

  -- ── 6. Universal DESLIGADA é teto zero, e o cliente não reabre ────────
  -- Decisão de semântica documentada no cabeçalho. Para devolver a
  -- documentação ao controle por base, APAGUE a linha universal.
  select exists (select 1 from public.escopo_documentacao(v_cod_a, v_pg) e where e.space_id = v_sp_u5)
    into v_tem;
  assert not v_tem,
    'assertiva 6: universal desligada e teto ZERO — linha da base com enabled=true nao pode reabrir, e reabriu';

  delete from public.documentacoes_universais where space_id = v_sp_u5;
  select exists (select 1 from public.escopo_documentacao(v_cod_a, v_pg) e where e.space_id = v_sp_u5)
    into v_tem;
  assert v_tem,
    'assertiva 6: APAGAR a linha universal deveria devolver a documentacao ao controle por base, e o anexo continuou invisivel';
  raise notice 'assertiva 6 OK — universal desligada e teto zero; APAGAR a linha devolve ao controle por base';

  -- Limpeza final.
  delete from public.spaces   where slug      like 'zz-tarefa9-assert-%';
  delete from public.ai_bases where base_code like 'zz-tarefa9-assert-%';
end $$;
