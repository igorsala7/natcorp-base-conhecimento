-- =====================================================================
-- ARQUIVO DE CONHECIMENTO GANHA DONO ALTERNATIVO: OU DOC, OU BASE
--
-- Pedido do dono: arquivo da documentação do sistema continua onde está;
-- arquivo específico de um cliente precisa de um lugar alcançável só por
-- aquele cliente e painel, fora da base de documentação, mas passando
-- pelo mesmo RAG e pela mesma ontologia.
--
-- Duas garantias que saem da ESTRUTURA e não de configuração:
--
--   · arquivo de cliente é invisível para o chatbot padrão da
--     documentação, porque vive fora de qualquer espaço e o portal escopa
--     por espaço;
--   · arquivo não aparece na árvore de publicação, porque a árvore é
--     construída de `nodes` e arquivo de conhecimento não tem nó.
--
-- E a terceira, que é a que já existia e foi VERIFICADA no projeto 0: a
-- policy `chunks_public_read` do `anon` exige `n.id = chunks.node_id`,
-- e chunk de arquivo tem `node_id` nulo. Logo arquivo nunca alcança o
-- portal público, por construção.
--
-- ── Por que anular `space_id` em vez de criar tabela nova ────────────
-- A ingestão, o chunking e o caminho `p_document_ids` da busca já operam
-- sobre `knowledge_documents`. Uma segunda tabela duplicaria o pipeline
-- de embedding inteiro.
--
-- ── CORPO SUPERADO EM PARTE: documentos_da_base ──────────────────────
-- O corpo de `public.documentos_da_base(text, jsonb)` que está aqui usa
-- `lower(btrim(base_code))`, com `btrim` de UM argumento, que apara só o
-- caractere espaço. A `20260925160000_branco_unico_e_grants.sql` trocou
-- por `public.codigo_normalizado`, que apara os CINCO caracteres de
-- `public.allowlist_casa` (espaço, TAB, LF, CR, NBSP) — o mesmo conjunto
-- que a dimensão `base` de `public.elegivel` já usava. E ela também
-- revogou o EXECUTE de `authenticated` desta função, que sendo `security
-- definer` deixava qualquer Leitor enumerar os ids dos arquivos internos
-- de qualquer cliente.
--
-- A ASSINATURA é a mesma, então reaplicar ESTE arquivo sozinho não cria
-- função duplicada: ele SILENCIOSAMENTE desfaz as duas coisas — volta o
-- aparo de um caractere e devolve o EXECUTE a `authenticated`. Reaplique
-- a 20260925160000 depois, sempre. Não há ledger, então reaplicar um
-- arquivo à mão é operação normal e este aviso é o que resta.
-- =====================================================================

alter table public.knowledge_documents
  add column if not exists base_id uuid references public.ai_bases(id) on delete cascade,
  add column if not exists regra   jsonb not null default '{}'::jsonb,
  add column if not exists download_liberado boolean not null default false;

comment on column public.knowledge_documents.base_id is
  'Base dona do arquivo, quando ele é do CLIENTE e não de uma documentação. Exatamente um de base_id/space_id é preenchido.';
comment on column public.knowledge_documents.regra is
  'Elegibilidade nas doze dimensões (formato de public.elegivel). Só faz sentido com base_id; arquivo de documentação herda o alcance da documentação.';
comment on column public.knowledge_documents.download_liberado is
  'O usuário pode baixar o arquivo pelo chatbot? Separado de estar na base de conhecimento: o cliente escolhe um, outro, ou os dois.';

alter table public.knowledge_documents
  drop constraint if exists knowledge_documents_um_dono;
alter table public.knowledge_documents
  add constraint knowledge_documents_um_dono check (
    (space_id is not null and base_id is null)
    or (space_id is null and base_id is not null)
  );

alter table public.knowledge_documents
  drop constraint if exists knowledge_documents_regra_valida;
alter table public.knowledge_documents
  add constraint knowledge_documents_regra_valida check (public.regra_valida(regra));

-- `space_id` era NOT NULL. A ordem importa: o CHECK acima já garante que
-- nenhuma linha fica sem dono, então soltar o NOT NULL não abre espaço
-- para órfão.
alter table public.knowledge_documents alter column space_id drop not null;

-- `chunks` acompanha. Chunk de arquivo de cliente não pertence a espaço.
alter table public.chunks alter column space_id drop not null;

alter table public.chunks
  drop constraint if exists chunks_espaco_ou_documento;
alter table public.chunks
  add constraint chunks_espaco_ou_documento check (
    space_id is not null or document_id is not null
  );

-- ── RLS com ramo de base ────────────────────────────────────────────
-- `has_permission(uid, perm, NULL)` reduz a "tem papel GLOBAL" (a
-- cláusula é `m.space_id is null or m.space_id = p_space_id`). Então com
-- `space_id` nulo as policies atuais já liberariam para papel global — o
-- que é aceitável para equipe interna, mas acidental. Aqui a intenção
-- fica escrita: arquivo de cliente exige `ai.configure`, que é a
-- permissão de quem administra base, não de quem edita documentação.
drop policy if exists knowledge_documents_read on public.knowledge_documents;
create policy knowledge_documents_read on public.knowledge_documents
  for select to authenticated
  using (
    (space_id is not null and public.has_permission(auth.uid(), 'content.view', space_id))
    or (base_id is not null and public.has_permission(auth.uid(), 'ai.configure', null))
  );

drop policy if exists knowledge_documents_write on public.knowledge_documents;
create policy knowledge_documents_write on public.knowledge_documents
  for all to authenticated
  using (
    (space_id is not null and public.has_permission(auth.uid(), 'content.edit', space_id))
    or (base_id is not null and public.has_permission(auth.uid(), 'ai.configure', null))
  )
  with check (
    (space_id is not null and public.has_permission(auth.uid(), 'content.edit', space_id))
    or (base_id is not null and public.has_permission(auth.uid(), 'ai.configure', null))
  );

-- `chunks_auth_read` e `chunks_write` usam `space_id` direto, e com nulo
-- `has_permission(uid, perm, NULL)` viraria "papel global" por acidente.
-- Aqui o chunk sem espaço é alcançado pelo DONO do documento.
drop policy if exists chunks_auth_read on public.chunks;
create policy chunks_auth_read on public.chunks
  for select to authenticated
  using (
    (space_id is not null and public.has_permission(auth.uid(), 'content.view', space_id))
    or (space_id is null and exists (
          select 1 from public.knowledge_documents k
           where k.id = chunks.document_id
             and k.base_id is not null
             and public.has_permission(auth.uid(), 'ai.configure', null)))
  );

-- ── Os documentos que esta identidade alcança nesta base ────────────
-- Só arquivo DE BASE. Arquivo de documentação entra pelo escopo da
-- documentação, na tarefa 3, junto com os nós.
create or replace function public.documentos_da_base(
  p_base text,
  p_identidade jsonb default '{}'::jsonb
)
returns table (document_id uuid)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  select k.id
    from public.knowledge_documents k
    join public.ai_bases b on b.id = k.base_id
   where k.base_id is not null
     and lower(btrim(b.base_code)) = lower(btrim(coalesce(p_base, '')))
     and public.elegivel(k.regra, p_identidade);
$$;

comment on function public.documentos_da_base(text, jsonb) is
  'Arquivos DE CLIENTE que esta identidade alcança nesta base, filtrados por public.elegivel. Nunca devolve arquivo de outra base: o join por base_code é a cerca, e o teste de isolamento em .audit/ é o que a prova.';

revoke all on function public.documentos_da_base(text, jsonb) from public, anon;
grant execute on function public.documentos_da_base(text, jsonb) to authenticated, service_role;

-- ── Assertivas ──────────────────────────────────────────────────────
do $$
declare v_n int;
begin
  -- Nenhuma linha existente ficou sem dono ao soltar o NOT NULL.
  select count(*) into v_n from public.knowledge_documents
   where space_id is null and base_id is null;
  assert v_n = 0, 'nenhum knowledge_document pode ficar sem dono';

  select count(*) into v_n from public.chunks
   where space_id is null and document_id is null;
  assert v_n = 0, 'nenhum chunk pode ficar sem espaco E sem documento';

  -- A cerca do anon (chunk de arquivo nunca chega ao portal público) é
  -- verificada em `20260925116000_assertiva_de_comportamento_do_anon.sql`,
  -- que assume o papel `anon` e CONTA os chunks sem `node_id` que ele
  -- alcança. A assertiva que existia aqui checava se a palavra `node_id`
  -- aparecia no `qual` da policy, e uma reescrita para
  -- `(n.id = chunks.node_id or chunks.node_id is null)` vazaria todo
  -- arquivo mantendo a palavra — ela passava sem verificar nada, e
  -- assertiva que passa sem verificar ensina a confiar nela.
end $$;
