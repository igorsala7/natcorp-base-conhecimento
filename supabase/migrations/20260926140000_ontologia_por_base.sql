-- =====================================================================
-- ONTOLOGIA GANHA DONO ALTERNATIVO: OU DOCUMENTAÇÃO, OU BASE
--
-- A especificação do dono diz que o PDF interno do cliente *"passará pela
-- vetorização, RAG e ontologia"*. As duas primeiras funcionavam; a terceira era
-- IMPOSSÍVEL: `ontology_terms.space_id` e `ontology_jobs.space_id` eram
-- `NOT NULL references spaces(id)` (medido em 25/09) e arquivo de cliente não
-- tem espaço — o CHECK `knowledge_documents_um_dono` garante justamente que ele
-- tem `base_id` e `space_id` NULO. A ingestão da tarefa 10 recusava a opção com
-- o motivo em vez de aceitar e não enfileirar nada. Este arquivo fecha a lacuna.
--
-- Mesmo molde de `20260925110000_arquivo_de_base.sql`, que fez isto com
-- `knowledge_documents` e `chunks`: coluna nova, `space_id` anulável, CHECK de
-- dono único, e RLS com o ramo de base ESCRITO em vez de acidental.
--
-- ── A DECISÃO DE PRODUTO QUE ESTA MIGRATION IMPLEMENTA ───────────────
-- O vocabulário de um cliente é DELE e NUNCA entra na ontologia global. Jargão
-- interno de um cliente no vocabulário compartilhado mudaria a busca de todos
-- os outros clientes, em silêncio, e seria vazamento de informação comercial:
-- os termos que uma empresa usa dizem o que ela faz.
--
-- Por isso o dono é EXCLUSIVO (o CHECK abaixo), e não uma coluna a mais numa
-- linha que também tem espaço: um termo com os dois donos seria exatamente o
-- vazamento — ele expandiria a consulta de quem lê aquela documentação.
--
-- O precedente é o roteamento de ferramentas (`ai_tool_base_embeddings`): vetor
-- POR BASE enriquecido com os sinônimos do cliente, tomando o MAX com o global
-- e nunca rebaixando. O termo do cliente SOMA ao global; não substitui e não
-- apaga. Do lado da aplicação isso é `carregarOntologia`, que faz DUAS
-- consultas e une — e sem base a segunda não é nem emitida.
--
-- ── UNICIDADE: o `unique (space_id, term_norm)` NÃO cobre o ramo de base ──
-- `null` nunca colide com `null` em índice único, então, com `space_id`
-- anulável, dois termos idênticos de uma MESMA base passariam pelo unique
-- existente sem um pio — e a duplicata em ontologia não é cosmética: ela
-- duplica a forma na expansão léxica, que é cortada em 12, e o conceito
-- seguinte perde a vaga. Daí o índice único PARCIAL por base, abaixo.
-- =====================================================================

-- ── (1) `ontology_terms` ────────────────────────────────────────────
alter table public.ontology_terms
  add column if not exists base_id uuid references public.ai_bases(id) on delete cascade;

comment on column public.ontology_terms.base_id is
  'Base dona do termo, quando ele é o vocabulário do CLIENTE e não de uma documentação. Exatamente um de base_id/space_id é preenchido. Termo de base NUNCA entra na ontologia global: a expansão da consulta soma os dois conjuntos (ver carregarOntologia), e sem base nada muda.';

alter table public.ontology_terms
  drop constraint if exists ontology_terms_um_dono;
alter table public.ontology_terms
  add constraint ontology_terms_um_dono check (
    (space_id is not null and base_id is null)
    or (space_id is null and base_id is not null)
  );

-- O CHECK acima já garante que ninguém fica sem dono, então soltar o NOT NULL
-- não abre espaço para órfão. A ordem importa: primeiro o CHECK, depois o drop.
alter table public.ontology_terms alter column space_id drop not null;

create index if not exists ontology_terms_base_idx
  on public.ontology_terms (base_id);

create unique index if not exists ontology_terms_base_id_term_norm_key
  on public.ontology_terms (base_id, term_norm)
  where base_id is not null;

comment on index public.ontology_terms_base_id_term_norm_key is
  'Gêmeo por base do unique (space_id, term_norm). PARCIAL porque null não colide com null: sem ele, dois termos iguais da mesma base entrariam os dois, duplicariam a forma na expansão léxica (cortada em 12) e comeriam a vaga do conceito seguinte.';

-- ── (2) `ontology_jobs` ─────────────────────────────────────────────
alter table public.ontology_jobs
  add column if not exists base_id uuid references public.ai_bases(id) on delete cascade;

comment on column public.ontology_jobs.base_id is
  'Base dona da varredura, quando o alvo é um arquivo do cliente. Exatamente um de base_id/space_id é preenchido. O worker resolve o dono antes de varrer (processOntologyScan) e grava os termos no MESMO dono.';

alter table public.ontology_jobs
  drop constraint if exists ontology_jobs_um_dono;
alter table public.ontology_jobs
  add constraint ontology_jobs_um_dono check (
    (space_id is not null and base_id is null)
    or (space_id is null and base_id is not null)
  );

alter table public.ontology_jobs alter column space_id drop not null;

create index if not exists ontology_jobs_base_idx
  on public.ontology_jobs (base_id);

-- ── (3) RLS — o ramo de base EXIGE `ai.configure` ───────────────────
-- `has_permission(uid, perm, NULL)` reduz a "tem papel GLOBAL" (a cláusula é
-- `m.space_id is null or m.space_id = p_space_id`). Então, com `space_id` nulo,
-- as policies atuais liberariam termo de cliente para QUALQUER papel global com
-- `content.view` — um Gestor de conteúdo de nível 60 leria o vocabulário
-- interno de todos os clientes, sem erro em lugar nenhum. Isto não é teoria: é
-- a mesma armadilha que `20260925110000` documentou em `knowledge_documents`, e
-- é o motivo de os ramos serem escritos um por um aqui.
--
-- Termo/job de base exige `ai.configure`, que é a permissão de quem administra
-- base (admin técnico), não de quem edita documentação.
drop policy if exists ontology_terms_read on public.ontology_terms;
create policy ontology_terms_read on public.ontology_terms
  for select to authenticated
  using (
    (space_id is not null and public.has_permission(auth.uid(), 'content.view', space_id))
    or (base_id is not null and public.has_permission(auth.uid(), 'ai.configure', null))
  );

drop policy if exists ontology_terms_write on public.ontology_terms;
create policy ontology_terms_write on public.ontology_terms
  for all to authenticated
  using (
    (space_id is not null and public.has_permission(auth.uid(), 'ai.configure', space_id))
    or (base_id is not null and public.has_permission(auth.uid(), 'ai.configure', null))
  )
  with check (
    (space_id is not null and public.has_permission(auth.uid(), 'ai.configure', space_id))
    or (base_id is not null and public.has_permission(auth.uid(), 'ai.configure', null))
  );

drop policy if exists ontology_jobs_read on public.ontology_jobs;
create policy ontology_jobs_read on public.ontology_jobs
  for select to authenticated
  using (
    (space_id is not null and public.has_permission(auth.uid(), 'ai.configure', space_id))
    or (base_id is not null and public.has_permission(auth.uid(), 'ai.configure', null))
  );

drop policy if exists ontology_jobs_write on public.ontology_jobs;
create policy ontology_jobs_write on public.ontology_jobs
  for all to authenticated
  using (
    (space_id is not null and public.has_permission(auth.uid(), 'ai.configure', space_id))
    or (base_id is not null and public.has_permission(auth.uid(), 'ai.configure', null))
  )
  with check (
    (space_id is not null and public.has_permission(auth.uid(), 'ai.configure', space_id))
    or (base_id is not null and public.has_permission(auth.uid(), 'ai.configure', null))
  );

-- `ontology_aliases` não tem dono próprio: ele pendura no termo. As duas
-- policies dele liam `t.space_id` direto, então um alias de termo de base cairia
-- no mesmo `has_permission(..., NULL)` acidental descrito acima — o sinônimo
-- vazaria pelo lado, mesmo com o termo protegido.
drop policy if exists ontology_aliases_read on public.ontology_aliases;
create policy ontology_aliases_read on public.ontology_aliases
  for select to authenticated
  using (
    exists (
      select 1 from public.ontology_terms t
       where t.id = ontology_aliases.term_id
         and ((t.space_id is not null and public.has_permission(auth.uid(), 'content.view', t.space_id))
              or (t.base_id is not null and public.has_permission(auth.uid(), 'ai.configure', null)))
    )
  );

drop policy if exists ontology_aliases_write on public.ontology_aliases;
create policy ontology_aliases_write on public.ontology_aliases
  for all to authenticated
  using (
    exists (
      select 1 from public.ontology_terms t
       where t.id = ontology_aliases.term_id
         and ((t.space_id is not null and public.has_permission(auth.uid(), 'ai.configure', t.space_id))
              or (t.base_id is not null and public.has_permission(auth.uid(), 'ai.configure', null)))
    )
  )
  with check (
    exists (
      select 1 from public.ontology_terms t
       where t.id = ontology_aliases.term_id
         and ((t.space_id is not null and public.has_permission(auth.uid(), 'ai.configure', t.space_id))
              or (t.base_id is not null and public.has_permission(auth.uid(), 'ai.configure', null)))
    )
  );

-- ── (4) Assertiva de COMPORTAMENTO ──────────────────────────────────
-- Existência de constraint em `pg_constraint` não prova nada: um CHECK sobre a
-- expressão errada também existiria. Aqui as três afirmações são exercidas
-- contra o banco, e os dados de teste vivem dentro de uma subtransação que
-- SEMPRE volta atrás — o `raise` do fim é o rollback, e as variáveis do
-- plpgsql sobrevivem a ele (elas não são estado de transação), que é o que
-- permite afirmar depois.
--
-- (Aqui não se escreve o par de dólares nem dentro de comentário: o dollar
-- quoting é LEXICAL e ignora comentário, então mencioná-lo fecharia o corpo no
-- meio. Custou uma aplicação recusada com erro de sintaxe que não aponta para
-- nada parecido.)
do $ontologia_por_base$
declare
  v_recusou_dois_donos     boolean := false;
  v_recusou_job_dois_donos boolean := false;
  v_aceitou_so_base        boolean := false;
  v_antes_do_delete        int     := -1;
  v_depois_do_delete       int     := -1;
  v_orfaos                 int;
  v_base                   uuid;
  v_espaco                 uuid;
begin
  -- Nenhuma linha existente ficou sem dono ao soltar o NOT NULL.
  select count(*) into v_orfaos from public.ontology_terms
   where space_id is null and base_id is null;
  assert v_orfaos = 0, 'nenhum ontology_term pode ficar sem dono';

  select count(*) into v_orfaos from public.ontology_jobs
   where space_id is null and base_id is null;
  assert v_orfaos = 0, 'nenhum ontology_job pode ficar sem dono';

  begin
    insert into public.ai_bases (base_code, name)
      values ('zz-onto-assert', 'zz-onto-assert')
      returning id into v_base;
    insert into public.spaces (slug, name)
      values ('zz-onto-assert', 'zz-onto-assert')
      returning id into v_espaco;

    -- (a) DOIS DONOS é recusado. Subtransação interna: sem ela a violação
    -- abortaria o bloco inteiro em vez de ser observada.
    begin
      insert into public.ontology_terms (space_id, base_id, term, term_norm)
        values (v_espaco, v_base, 'zz termo', 'zz termo');
      v_recusou_dois_donos := false;
    exception when check_violation then
      v_recusou_dois_donos := true;
    end;

    begin
      insert into public.ontology_jobs (space_id, base_id, scope, target_id)
        values (v_espaco, v_base, 'document', gen_random_uuid());
      v_recusou_job_dois_donos := false;
    exception when check_violation then
      v_recusou_job_dois_donos := true;
    end;

    -- (b) SÓ BASE é aceito.
    begin
      insert into public.ontology_terms (base_id, term, term_norm)
        values (v_base, 'zz termo', 'zz termo');
      v_aceitou_so_base := true;
    exception when others then
      v_aceitou_so_base := false;
    end;

    -- (c) APAGAR A BASE leva os termos dela. O count ANTES é o que faz o
    -- zero depois significar algo: sem ele, uma inserção que nunca aconteceu
    -- daria o mesmo zero.
    select count(*) into v_antes_do_delete
      from public.ontology_terms where base_id = v_base;
    delete from public.ai_bases where id = v_base;
    select count(*) into v_depois_do_delete
      from public.ontology_terms where base_id = v_base;

    -- Rollback deliberado: nada de `zz-` fica no banco de produção.
    raise exception 'zz-rollback' using errcode = 'ZZ001';
  exception when sqlstate 'ZZ001' then
    null;
  end;

  assert v_recusou_dois_donos,
    'ontology_terms com space_id E base_id deveria ser recusado pelo CHECK ontology_terms_um_dono, e foi aceito';
  assert v_recusou_job_dois_donos,
    'ontology_jobs com space_id E base_id deveria ser recusado pelo CHECK ontology_jobs_um_dono, e foi aceito';
  assert v_aceitou_so_base,
    'ontology_terms so com base_id deveria ser aceito, e foi recusado';
  assert v_antes_do_delete = 1,
    format('o termo de base deveria existir antes do delete da base, e havia %s', v_antes_do_delete);
  assert v_depois_do_delete = 0,
    format('apagar a base deveria levar os termos dela (on delete cascade), e sobraram %s', v_depois_do_delete);
end $ontologia_por_base$;
