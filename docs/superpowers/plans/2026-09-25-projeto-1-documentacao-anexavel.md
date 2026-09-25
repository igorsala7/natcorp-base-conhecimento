# Projeto 1 — Documentação anexável por base e portal: plano de implementação

> **Para executores agênticos:** SUB-SKILL OBRIGATÓRIA: use
> superpowers:subagent-driven-development (recomendado) ou
> superpowers:executing-plans para implementar tarefa por tarefa. Os passos usam
> caixa de marcar (`- [ ]`) para acompanhamento.

**Objetivo:** a documentação deixa de ser a casa do chatbot e passa a ser um
recurso anexável. O que um cliente enxerga vira linha em tabela, com
elegibilidade avaliada pelo motor do projeto 0.

**Arquitetura:** duas tabelas com nomes diferentes de propósito —
`documentacoes_universais` (o que toda base alcança sem configuração) e
`ai_base_documentacoes` (o que é daquele cliente e só dele). Arquivo de
conhecimento ganha dono alternativo: ou uma documentação, ou uma base. O RAG
resolve o escopo pela base antes de cair no escopo da chave, e cair no da chave
é o que torna a rodada aditiva.

**Stack:** Postgres (migrations idempotentes via `npm run migrate:apply`),
TypeScript strict, Vitest, React Server Components.

**Spec:** `docs/superpowers/specs/2026-09-24-separacao-ia-documentacao-design.md`
(seção "Projeto 1"). O projeto 0 já entregou o motor: `public.elegivel`,
`public.dimensoes_elegibilidade`, `src/lib/elegibilidade/` e
`npm run verificar:elegibilidade`.

## Restrições globais

- **Nenhuma alteração de schema fora de migration**, idempotente e re-rodável
  (não há ledger). Aplicar com `npm run migrate:apply -- <arquivo>`.
- **`create or replace` sempre que a assinatura não mudar.** `drop function` +
  `create function` devolve EXECUTE a PUBLIC, e reaplicar um arquivo sozinho
  desfaz revoke de migration posterior. Isto custou um achado no projeto 0.
- **`revoke all on function f(args) from public, anon;`** — revogar só de `anon`
  é no-op, porque PUBLIC inclui `anon`. Função nova: revoke de `public, anon` e
  grant a `service_role` (e a `authenticated` só se uma tela com sessão precisar).
- **Elegibilidade é `regra jsonb` avaliada por `public.elegivel(regra, identidade)`.**
  Nunca colunas de array novas, nunca uma segunda implementação da regra. As doze
  dimensões vêm de `public.dimensoes_elegibilidade()` e de
  `src/lib/elegibilidade/dimensoes.ts`.
- **`ai_base_tools` continua fora do motor**, por decisão do dono, e o motivo está
  em `src/lib/elegibilidade/dimensoes.ts`. Não unificar.
- **O filtro é em SQL, nunca no prompt** (regra 5.5 do CLAUDE.md). Um cliente
  jamais recebe `document_id` de outro.
- **Ao mudar superfície medida** (RAG, funil, chunker, prompt), medir antes e
  depois e dizer o número. `npx tsx --env-file=.env.local scripts/eval-rag.ts`.
- **Build de verificação:** `NEXT_PUBLIC_BASE_PATH= npm run build`. O `.env`
  versionado injeta o `basePath` de produção.
- Portão antes de cada commit: `npx tsc --noEmit`, `npx eslint <arquivos>`,
  `npx vitest run`, `npm run verificar:elegibilidade`, `npm run verificar:ui`.
  Base atual: **234 arquivos / 2586 testes**.

## Desvio consciente da especificação

A spec diz que a allowlist é "estruturalmente igual a `ai_base_tools`", isto é
seis colunas de array. **Este plano usa `regra jsonb` e `public.elegivel`.**

O motivo é que o projeto 0 existiu para a regra ter um lugar só, e `elegivel`
recebe `jsonb`. Com colunas de array eu teria de converter a cada consulta ou
escrever a comparação de novo — e escrever de novo é exatamente o que o projeto 0
comprou o direito de não fazer. Este é o PRIMEIRO consumidor do motor; se ele não
o usar, o motor não paga.

Consequência assumida: `ai_base_tools` (arrays) e as tabelas de conteúdo (jsonb)
ficam com formas diferentes. Isso é deliberado e já está documentado como
fronteira: allowlist de ferramenta decide qual API o modelo chama, allowlist de
conteúdo decide quem vê um documento.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20260925100000_documentacoes_anexaveis.sql` | as duas tabelas, RLS, e a RPC que resolve o escopo |
| `supabase/migrations/20260925110000_arquivo_de_base.sql` | `knowledge_documents.base_id` + `regra`, `space_id` anulável, `chunks.space_id` anulável, policies com ramo de base |
| `src/lib/ai/escopo-da-base.ts` | função PURA que decide o escopo a partir das linhas e da identidade |
| `src/lib/ai/escopo-da-base.test.ts` | testes da função pura |
| `src/lib/ai/rag.ts` | `retrievePublicContext` passa a aceitar base + identidade |
| `src/app/api/v1/chat/route.ts` | passa base e identidade ao RAG |
| `src/app/api/v1/search/route.ts` | idem, para busca e chat não discordarem |
| `src/app/(admin)/admin/(app)/integracoes/documentacoes-panel.tsx` | a aba nova |
| `src/app/(admin)/admin/(app)/integracoes/documentacoes-actions.ts` | gravação, com as travas do motor |
| `.audit/isolamento-documentacao-e2e.ts` | prova contra o banco real que base A não alcança documento de base B |

---

### Tarefa 1: as duas tabelas e a RPC de escopo

**Files:**
- Create: `supabase/migrations/20260925100000_documentacoes_anexaveis.sql`

**Interfaces:**
- Consumes: `public.elegivel(jsonb, jsonb)`, `public.dimensoes_elegibilidade()`.
- Produces: `public.escopo_documentacao(p_base text, p_identidade jsonb)` devolvendo
  `table (space_id uuid, origem text)`, onde `origem` é `'universal'` ou `'base'`.
  As tarefas 3 e 5 dependem desta assinatura.

- [ ] **Passo 1: escrever a migration**

```sql
-- =====================================================================
-- DOCUMENTAÇÃO DEIXA DE SER A CASA DO CHATBOT E VIRA RECURSO ANEXÁVEL
--
-- Duas tabelas, com nomes diferentes DE PROPÓSITO.
--
-- A primeira versão do desenho pôs a allowlist só na tabela por base.
-- Não fechava: documentação universal não está anexada a base nenhuma,
-- então "esta documentação é só do portal do Gestor" não teria onde
-- existir, e a saída seria anexar as universais a todas as bases, o que
-- destrói o sentido de universal.
--
-- `documentacoes_universais` é o conjunto que toda base alcança sem
-- configuração, com a parametrização por portal e perfil morando aqui.
-- `ai_base_documentacoes` é o que é de um cliente e só dele.
--
-- E isto resolve de graça um segundo furo: existem quatro espaços
-- `global`, incluindo o manual da própria plataforma e a documentação de
-- um segmento. Se "universal" significasse `type = 'global'`, todo
-- cliente passaria a pesquisar os dois. Aqui universal é uma linha que
-- alguém escreveu, nunca efeito colateral do tipo do espaço.
--
-- ── Por que `regra jsonb` e não seis colunas de array ────────────────
-- O projeto 0 existiu para a regra de "quem alcança isto" ter um lugar
-- só, e `public.elegivel` recebe jsonb. Com colunas de array esta
-- tabela teria de converter a cada consulta ou reescrever a comparação,
-- e reescrever é o que o projeto 0 comprou o direito de não fazer.
-- `ai_base_tools` fica com arrays por decisão do dono; a fronteira está
-- documentada em src/lib/elegibilidade/dimensoes.ts.
-- =====================================================================

create table if not exists public.documentacoes_universais (
  space_id   uuid primary key references public.spaces(id) on delete cascade,
  enabled    boolean not null default true,
  regra      jsonb   not null default '{}'::jsonb,
  observacao text,
  criado_em  timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null
);

comment on table public.documentacoes_universais is
  'Documentações que TODA base alcança sem configuração. `regra` é elegibilidade no formato do motor (public.elegivel); vazia não restringe. Ser universal é uma linha aqui, nunca o tipo do espaço.';
comment on column public.documentacoes_universais.regra is
  'Elegibilidade nas doze dimensões, formato de public.elegivel. Restrição por portal mora AQUI, e não na tabela por base, porque universal não está anexada a base nenhuma.';

create table if not exists public.ai_base_documentacoes (
  base_id    uuid not null references public.ai_bases(id) on delete cascade,
  space_id   uuid not null references public.spaces(id) on delete cascade,
  enabled    boolean not null default true,
  regra      jsonb   not null default '{}'::jsonb,
  observacao text,
  criado_em  timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  primary key (base_id, space_id)
);

comment on table public.ai_base_documentacoes is
  'Documentação de UM cliente. Acréscimo ao conjunto universal, nunca substituição: o RAG une os dois. `regra` é elegibilidade no formato de public.elegivel.';

-- A regra gravada precisa ser um OBJETO cujas chaves sejam dimensões
-- conhecidas e cujos valores sejam listas. Sem isto, `elegivel` faria o
-- que o projeto 0 mandou fazer com dado malformado — FECHAR — e o efeito
-- seria conteúdo que não alcança ninguém, sem erro em lugar nenhum.
-- Barrar na gravação é o que transforma isso em mensagem de tela.
create or replace function public.regra_valida(p jsonb)
returns boolean
language sql
immutable parallel safe
as $$
  select jsonb_typeof(coalesce(p, '{}'::jsonb)) = 'object'
     and not exists (
       select 1 from jsonb_each(coalesce(p, '{}'::jsonb)) r(dim, lista)
        where r.dim <> all (public.dimensoes_elegibilidade())
           or jsonb_typeof(r.lista) not in ('array', 'null')
     );
$$;

comment on function public.regra_valida(jsonb) is
  'A regra é objeto, só com chaves das doze dimensões e valores lista (ou null)? Guarda de GRAVAÇÃO: sem ela, uma regra malformada é aceita e public.elegivel a trata fechando, produzindo conteúdo que não alcança ninguém sem nenhum erro.';

alter table public.documentacoes_universais
  drop constraint if exists documentacoes_universais_regra_valida;
alter table public.documentacoes_universais
  add constraint documentacoes_universais_regra_valida check (public.regra_valida(regra));

alter table public.ai_base_documentacoes
  drop constraint if exists ai_base_documentacoes_regra_valida;
alter table public.ai_base_documentacoes
  add constraint ai_base_documentacoes_regra_valida check (public.regra_valida(regra));

-- ── RLS ─────────────────────────────────────────────────────────────
-- Tabela de configuração interna: quem administra IA lê e escreve, o
-- widget chega por service-role, e `anon` não tem nada aqui.
alter table public.documentacoes_universais enable row level security;
alter table public.ai_base_documentacoes   enable row level security;

drop policy if exists documentacoes_universais_admin on public.documentacoes_universais;
create policy documentacoes_universais_admin on public.documentacoes_universais
  for all to authenticated
  using (public.has_permission(auth.uid(), 'ai.configure', null))
  with check (public.has_permission(auth.uid(), 'ai.configure', null));

drop policy if exists ai_base_documentacoes_admin on public.ai_base_documentacoes;
create policy ai_base_documentacoes_admin on public.ai_base_documentacoes
  for all to authenticated
  using (public.has_permission(auth.uid(), 'ai.configure', null))
  with check (public.has_permission(auth.uid(), 'ai.configure', null));

revoke all on public.documentacoes_universais from anon, public;
revoke all on public.ai_base_documentacoes   from anon, public;

-- ── A resolução do escopo ───────────────────────────────────────────
-- Devolve as documentações que ESTA identidade alcança nesta base, com a
-- origem, porque a tela precisa dizer de onde cada uma veio e o RAG
-- precisa saber se resolveu algo (se não, cai no escopo da chave — é o
-- que torna a rodada aditiva).
--
-- `base` desconhecida devolve só as universais: chegar com um p_base que
-- não existe em ai_bases não é motivo para não alcançar a documentação do
-- sistema, e conteúdo de cliente ela não alcança por não casar base_id.
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
  select u.space_id, 'universal'::text
    from public.documentacoes_universais u
   where u.enabled
     and public.elegivel(u.regra, p_identidade)
  union
  select d.space_id, 'base'::text
    from public.ai_base_documentacoes d
    join public.ai_bases b on b.id = d.base_id
   where d.enabled
     and lower(btrim(b.base_code)) = lower(btrim(coalesce(p_base, '')))
     and public.elegivel(d.regra, p_identidade);
$$;

comment on function public.escopo_documentacao(text, jsonb) is
  'Documentações que esta identidade alcança nesta base: universais mais as do cliente, ambas filtradas por public.elegivel. `origem` diz de qual das duas veio. Base desconhecida devolve só as universais.';

revoke all on function public.escopo_documentacao(text, jsonb) from public, anon;
grant execute on function public.escopo_documentacao(text, jsonb) to authenticated, service_role;

-- ── Assertivas ──────────────────────────────────────────────────────
do $$
begin
  assert public.regra_valida('{}'::jsonb), 'regra vazia e valida';
  assert public.regra_valida('{"portal":["PG"]}'), 'dimensao conhecida com lista e valida';
  assert public.regra_valida('{"portal":null}'), 'null na dimensao e valido (nao configurada)';
  assert not public.regra_valida('{"centro_custos":["1"]}'), 'typo no nome da dimensao e INVALIDO';
  assert not public.regra_valida('{"portal":"PG"}'), 'valor que nao e lista e INVALIDO';
  assert not public.regra_valida('"texto"'::jsonb), 'regra que nao e objeto e INVALIDA';
  assert public.regra_valida(null), 'nulo e valido (coalesce para vazio)';
end $$;
```

- [ ] **Passo 2: aplicar e reaplicar**

```bash
npm run migrate:apply -- supabase/migrations/20260925100000_documentacoes_anexaveis.sql
npm run migrate:apply -- supabase/migrations/20260925100000_documentacoes_anexaveis.sql
```

Esperado: `OK` nas duas.

- [ ] **Passo 3: provar que a guarda de gravação morde, em produção**

```bash
npx tsx --env-file=.env.local .audit/sql.ts "
select public.regra_valida('{\"portal\":[\"PG\"]}')   as valida,
       public.regra_valida('{\"centro_custos\":[\"1\"]}') as typo_recusado,
       public.regra_valida('{\"portal\":\"PG\"}')     as nao_lista_recusado,
       (select count(*) from public.escopo_documentacao('natcorp')) as escopo_vazio_por_enquanto"
```

Esperado: `true`, `false`, `false`, `0` — nenhuma linha, porque nada foi anexado
ainda, e é isso que faz a rodada ser aditiva.

- [ ] **Passo 4: conferir os grants, por papel e não por leitura de ACL**

```bash
npx tsx --env-file=.env.local .audit/sql.ts "
select has_function_privilege('anon','public.escopo_documentacao(text,jsonb)','EXECUTE') as anon,
       has_function_privilege('service_role','public.escopo_documentacao(text,jsonb)','EXECUTE') as srole"
```

Esperado: `false`, `true`.

- [ ] **Passo 5: portão e commit**

```bash
npx tsc --noEmit && npx vitest run && npm run verificar:elegibilidade && npm run verificar:ui
git add supabase/migrations/20260925100000_documentacoes_anexaveis.sql
git commit -m "A documentação passa a ser anexável, e universal vira uma linha em vez de um tipo

Duas tabelas com nomes diferentes de propósito. A primeira versão do desenho pôs
a allowlist só na tabela por base, e não fechava: documentação universal não está
anexada a base nenhuma, então restringir por portal não teria onde existir, e a
saída seria anexar as universais a todas as bases, o que destrói o sentido de
universal.

Isso resolve de graça um segundo furo: existem quatro espaços globais, incluindo o
manual da própria plataforma. Se universal fosse type='global', todo cliente
passaria a pesquisar o manual da Natcorp.

A elegibilidade é regra jsonb avaliada por public.elegivel, não seis colunas de
array como a especificação dizia. É o primeiro consumidor do motor do projeto 0,
e usar array significaria converter a cada consulta ou reescrever a comparação —
que é o que aquele projeto comprou o direito de não fazer.

regra_valida é a guarda de GRAVAÇÃO, e existe porque sem ela uma regra com typo
no nome da dimensão é aceita, public.elegivel a trata FECHANDO, e o resultado é
conteúdo que não alcança ninguém sem erro em lugar nenhum. Barrar na escrita é o
que transforma isso em mensagem de tela."
```

---

### Tarefa 2: arquivo de conhecimento com dono alternativo

**Files:**
- Create: `supabase/migrations/20260925110000_arquivo_de_base.sql`

**Interfaces:**
- Consumes: `public.regra_valida(jsonb)` da tarefa 1.
- Produces: `knowledge_documents.base_id`, `knowledge_documents.regra`,
  `knowledge_documents.space_id` anulável, `chunks.space_id` anulável, policies com
  ramo de base, e `public.documentos_da_base(p_base text, p_identidade jsonb)`
  devolvendo `table (document_id uuid)`. A tarefa 3 depende desta RPC.

- [ ] **Passo 1: escrever a migration**

```sql
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

  -- A cerca do anon continua de pé: chunk de arquivo tem node_id nulo, e
  -- chunks_public_read exige node_id.
  assert (select count(*) from pg_policies
           where schemaname='public' and tablename='chunks'
             and policyname='chunks_public_read'
             and qual like '%node_id%') = 1,
    'chunks_public_read tem de continuar exigindo node_id';
end $$;
```

- [ ] **Passo 2: aplicar, reaplicar, e medir o antes**

Antes de aplicar, anote o número:

```bash
npx tsx --env-file=.env.local .audit/sql.ts "select count(*) as docs, count(space_id) as com_espaco from knowledge_documents"
```

Depois de aplicar, o mesmo comando tem de dar os MESMOS números. Se `com_espaco`
mudar, pare: alguma linha perdeu o dono.

- [ ] **Passo 3: provar que a cerca do `anon` segue de pé, com controle**

```bash
npx tsx --env-file=.env.local .audit/sql.ts "
begin;
set local role anon;
select count(*) as chunks_de_arquivo_que_anon_ve from chunks where node_id is null;
rollback;"
```

Esperado: `0`. `set local role` **fora de transação é no-op** e daria falso
positivo, por isso o `begin`/`rollback`.

- [ ] **Passo 4: portão e commit**

```bash
npx tsc --noEmit && npx vitest run && npm run verificar:elegibilidade && npm run verificar:ui
git add supabase/migrations/20260925110000_arquivo_de_base.sql
git commit -m "Arquivo de conhecimento ganha dono alternativo, e as policies deixam de liberar por acidente

O cliente precisa subir o PDF de regras internas dele num lugar que só ele
alcance, fora da documentação do sistema, mas passando pelo mesmo RAG. Isso vira
base_id em knowledge_documents, com space_id anulável e CHECK de exatamente um
dono.

Duas garantias vêm da estrutura e não de configuração: o arquivo é invisível para
o chatbot padrão porque vive fora de qualquer espaço, e não aparece na árvore de
publicação porque a árvore é feita de nodes e arquivo não tem nó.

As policies precisavam do ramo de base por um motivo que não é óbvio:
has_permission(uid, perm, NULL) reduz a 'tem papel global', então com space_id
nulo as policies antigas liberariam para qualquer papel global POR ACIDENTE. Agora
a intenção está escrita: arquivo de cliente exige ai.configure.

A assertiva confirma que chunks_public_read continua exigindo node_id, que é o que
mantém arquivo fora do portal público por construção."
```

---

### Tarefa 3: o RAG resolve pela base, e cai na chave quando não há nada

**Files:**
- Create: `src/lib/ai/escopo-da-base.ts`
- Create: `src/lib/ai/escopo-da-base.test.ts`
- Modify: `src/lib/ai/rag.ts` (`retrievePublicContext`)

**Interfaces:**
- Consumes: `public.escopo_documentacao`, `public.documentos_da_base`,
  `identidadeDoRastreio` de `@/lib/elegibilidade`.
- Produces: `resolverEscopoDaBase(db, base, identidade)` devolvendo
  `{ spaceIds: string[]; documentIds: string[]; origem: "base" | "chave" }`, e
  `retrievePublicContext(spaceIds, query, limit, scope, lang, opts)` com
  `opts.base` e `opts.identidade` novos. As tarefas 4 e 6 dependem disto.

- [ ] **Passo 1: escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { decidirEscopo } from "./escopo-da-base";

describe("decidirEscopo", () => {
  it("sem nada anexado, manda usar o escopo da CHAVE", () => {
    const r = decidirEscopo({ documentacoes: [], documentos: [] }, ["sp-da-chave"]);
    expect(r.origem).toBe("chave");
    expect(r.spaceIds).toEqual(["sp-da-chave"]);
    expect(r.documentIds).toEqual([]);
  });

  it("com documentação anexada, usa a da BASE e ignora a da chave", () => {
    const r = decidirEscopo(
      { documentacoes: [{ space_id: "sp-natcorp", origem: "universal" }], documentos: [] },
      ["sp-da-chave"],
    );
    expect(r.origem).toBe("base");
    expect(r.spaceIds).toEqual(["sp-natcorp"]);
  });

  /**
   * O caso que a spec chama de aditivo: universal e do cliente SOMAM, não
   * substituem. Se substituíssem, anexar um PDF ao cliente tiraria dele a
   * documentação do sistema — e ninguém pediria isso de propósito.
   */
  it("universal e do cliente somam, sem duplicar", () => {
    const r = decidirEscopo(
      {
        documentacoes: [
          { space_id: "sp-natcorp", origem: "universal" },
          { space_id: "sp-cliente", origem: "base" },
          { space_id: "sp-natcorp", origem: "base" },
        ],
        documentos: [],
      },
      ["sp-da-chave"],
    );
    expect(r.spaceIds.sort()).toEqual(["sp-cliente", "sp-natcorp"]);
  });

  /**
   * Arquivo do cliente SOZINHO já é escopo. Sem isto, um cliente que só
   * anexou o PDF de regras internas cairia no escopo da chave e o PDF não
   * entraria na busca — o pedido original ficaria sem efeito.
   */
  it("só arquivo anexado já conta como escopo da base", () => {
    const r = decidirEscopo({ documentacoes: [], documentos: ["doc-1"] }, ["sp-da-chave"]);
    expect(r.origem).toBe("base");
    expect(r.spaceIds).toEqual([]);
    expect(r.documentIds).toEqual(["doc-1"]);
  });

  it("chave vazia e base vazia devolve escopo vazio, não explode", () => {
    const r = decidirEscopo({ documentacoes: [], documentos: [] }, []);
    expect(r.origem).toBe("chave");
    expect(r.spaceIds).toEqual([]);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/lib/ai/escopo-da-base.test.ts
```

Esperado: FAIL, `Failed to resolve import "./escopo-da-base"`.

- [ ] **Passo 3: escrever `escopo-da-base.ts`**

```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { identidadeDoRastreio } from "@/lib/elegibilidade";
import type { TrackingKey } from "@/lib/chat/tracking";

export type LinhasDoEscopo = {
  documentacoes: { space_id: string; origem: string }[];
  documentos: string[];
};

export type EscopoResolvido = {
  spaceIds: string[];
  documentIds: string[];
  /** De onde veio: a base resolveu algo, ou caiu no escopo da chave. */
  origem: "base" | "chave";
};

/**
 * A DECISÃO, pura e testável: o que a base resolveu, ou o escopo da chave.
 *
 * Cair no escopo da chave quando a base não tem nada anexado é o que torna esta
 * rodada ADITIVA: enquanto ninguém configurar, todo cliente continua vendo
 * exatamente o que via, e a migração é um cliente por vez.
 *
 * Arquivo sozinho já conta como escopo. Sem isso, o cliente que só anexou o PDF
 * de regras internas cairia no escopo da chave e o PDF não entraria na busca —
 * o pedido que originou o projeto ficaria sem efeito.
 */
export function decidirEscopo(linhas: LinhasDoEscopo, spaceIdsDaChave: string[]): EscopoResolvido {
  const spaceIds = [...new Set(linhas.documentacoes.map((d) => d.space_id))];
  const documentIds = [...new Set(linhas.documentos)];
  if (spaceIds.length === 0 && documentIds.length === 0) {
    return { spaceIds: [...new Set(spaceIdsDaChave)], documentIds: [], origem: "chave" };
  }
  return { spaceIds, documentIds, origem: "base" };
}

/**
 * Lê as duas RPCs e decide. Duas consultas no caminho quente do turno, então
 * quem chamar precisa cachear — o cache de contexto de 60 s já existe e a chave
 * dele ganha base, portal e perfil.
 *
 * Erro de banco NÃO derruba o turno: devolve o escopo da chave, que é o
 * comportamento de antes desta mudança. Uma falha de leitura de configuração
 * não deve apagar a documentação do cliente.
 */
export async function resolverEscopoDaBase(
  db: SupabaseClient,
  base: string,
  track: Partial<Record<TrackingKey, string>>,
  spaceIdsDaChave: string[],
): Promise<EscopoResolvido> {
  const identidade = identidadeDoRastreio(track);
  try {
    const [docs, arqs] = await Promise.all([
      db.rpc("escopo_documentacao", { p_base: base, p_identidade: identidade }),
      db.rpc("documentos_da_base", { p_base: base, p_identidade: identidade }),
    ]);
    if (docs.error || arqs.error) {
      return decidirEscopo({ documentacoes: [], documentos: [] }, spaceIdsDaChave);
    }
    return decidirEscopo(
      {
        documentacoes: (docs.data ?? []) as { space_id: string; origem: string }[],
        documentos: ((arqs.data ?? []) as { document_id: string }[]).map((d) => d.document_id),
      },
      spaceIdsDaChave,
    );
  } catch {
    return decidirEscopo({ documentacoes: [], documentos: [] }, spaceIdsDaChave);
  }
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run src/lib/ai/escopo-da-base.test.ts
```

Esperado: PASS, 5 testes.

- [ ] **Passo 5: `retrievePublicContext` aceita base e identidade**

Em `src/lib/ai/rag.ts`, o `opts` de `retrievePublicContext` ganha dois campos, e
o corpo resolve o escopo antes de montar `escopos`:

```ts
  opts?: {
    lexicalOnly?: boolean;
    grupos?: number;
    continuidade?: string[];
    /**
     * Base do cliente e identidade do turno. Quando vêm, o escopo é resolvido
     * pelas documentações anexadas à base; quando a base não tem nada anexado,
     * cai nos `spaceIds` da chave, que é o comportamento anterior.
     */
    base?: string | null;
    track?: Partial<Record<TrackingKey, string>>;
  },
```

E, antes de `const escopos = ...`, o desvio:

```ts
  // ESCOPO PELA BASE, com queda para o escopo da chave.
  // Os `documentIds` resolvidos aqui ENTRAM junto com os dos espaços: arquivo do
  // cliente e documentação anexada somam, e é por isso que `retrieveWith` recebe
  // os dois.
  let idsDeEspaco = ids;
  let documentosDaBase: string[] = [];
  if (opts?.base) {
    const escopo = await resolverEscopoDaBase(supabase, opts.base, opts.track ?? {}, ids);
    idsDeEspaco = escopo.spaceIds;
    documentosDaBase = escopo.documentIds;
  }
```

`retrieveWith` já monta `documentIds` a partir dos espaços; ele passa a receber
`documentosDaBase` para unir. Leia a função antes de editar e faça a união no
ponto onde `documentIds` é montado, mantendo a dedup existente.

- [ ] **Passo 6: medir a superfície medida, antes e depois**

O RAG é superfície medida e a regra do projeto exige o número:

```bash
NODE_OPTIONS=--conditions=react-server npx tsx --env-file=.env.local scripts/eval-rag.ts
```

O `NODE_OPTIONS` é obrigatório e a primeira versão deste plano o omitia: `rag.ts`
importa `server-only`, e sem a condição o script nem carrega. Use o MESMO prefixo
nas duas medições, senão você compara coisas diferentes.

Rode ANTES de tocar `rag.ts` e depois. Com nenhuma base configurada, o resultado
tem de ser IDÊNTICO — é a prova de que a rodada é aditiva. Se mudar, pare e
reporte: significa que o desvio está sendo tomado quando não devia.

- [ ] **Passo 7: portão e commit**

```bash
npx tsc --noEmit && npx eslint src/lib/ai/escopo-da-base.ts src/lib/ai/rag.ts && npx vitest run && npm run verificar:elegibilidade && npm run verificar:ui
git add src/lib/ai/escopo-da-base.ts src/lib/ai/escopo-da-base.test.ts src/lib/ai/rag.ts
git commit -m "O RAG resolve o escopo pela base, e cai no escopo da chave quando não há nada anexado

Cair no escopo da chave é o que torna a rodada aditiva: enquanto ninguém
configurar, todo cliente continua vendo exatamente o que via, e a migração é um
cliente por vez. O eval-rag rodado antes e depois dá o mesmo número, que é a prova
disso e não uma promessa.

Arquivo do cliente sozinho já conta como escopo. Sem isso, quem só anexou o PDF de
regras internas cairia no escopo da chave e o PDF não entraria na busca — o pedido
que originou o projeto ficaria sem efeito.

Erro de banco na leitura da configuração devolve o escopo da chave em vez de
derrubar o turno: falha ao ler configuração não deve apagar a documentação do
cliente."
```

---

### Tarefa 4: busca e chat não podem discordar

**Files:**
- Modify: `src/app/api/v1/chat/route.ts`
- Modify: `src/app/api/v1/search/route.ts`

**Interfaces:**
- Consumes: `retrievePublicContext` com `opts.base` e `opts.track` da tarefa 3.
- Produces: nada novo; é a ligação.

**Por que os TRÊS juntos, e não só o chat.** `POST /api/v1/search` é a busca do
widget e usa o MESMO `key.space_ids`. Se só o chat resolvesse pela base, o cliente
acharia pela busca um documento que o chat recusa usar, ou o contrário. Duas
respostas diferentes para "o que eu posso ver" é pior que nenhuma das duas.

> **A tarefa 3 achou um QUARTO chamador que este plano não previu:
> `src/lib/whatsapp/chat.ts`.** Ele é caminho de cliente como o widget, e pior:
> ele já tem `input.baseCode` e `input.track` na própria função e chama o RAG sem
> passar nenhum dos dois. Deixá-lo de fora faria o WhatsApp ser o único caminho de
> cliente sem resolver por base, com a informação ali do lado.
>
> **O chat do PORTAL continua intocado**, e isso é decisão e não esquecimento: o
> portal não é o widget de um cliente, ele lê a documentação pública do espaço, e
> resolver por base ali mudaria comportamento de uma superfície que ninguém pediu
> para mudar.

- [ ] **Passo 1: o chat passa base e identidade**

Em `src/app/api/v1/chat/route.ts:1311`, o `opts` de `retrievePublicContext` ganha:

```ts
        base: track.p_base ?? null,
        track,
```

`track` é o objeto de rastreio já decodificado do turno. Não monte identidade à
mão: `resolverEscopoDaBase` chama `identidadeDoRastreio`, que é a única tradução
de `p_*` para dimensão e a que o motor conhece.

- [ ] **Passo 2: a busca passa os mesmos**

Em `src/app/api/v1/search/route.ts:52`. Leia como a rota obtém o `track` (ela
decodifica o token igual ao chat, ou recebe no payload) e passe os dois campos.
Se a rota HOJE não decodifica o token, pare e reporte: passar `base` sem
identidade faria a busca aplicar as regras sem as dimensões, e uma regra
restrita por portal não alcançaria ninguém — o pior resultado, porque é
silencioso.

- [ ] **Passo 2b: o WhatsApp passa os mesmos**

Em `src/lib/whatsapp/chat.ts`, a chamada `retrievePublicContext(input.chatSpaceIds,
input.question, 6)` ganha `{ base: input.track?.p_base ?? null, track: input.track }`.
Os dois valores já estão na função; o que faltava era passá-los.

- [ ] **Passo 3: provar que os TRÊS concordam**

Com nada configurado, chat, busca e WhatsApp devolvem o mesmo escopo. Com uma
documentação anexada a uma base de teste, os três passam a devolver o novo escopo.
Não há teste automatizado para isso ainda (a tarefa 6 traz o de isolamento);
confirme por leitura que os três caminhos passam os MESMOS dois campos, e diga no
report as três linhas lado a lado. Diga também, explicitamente, que o chat do
portal NÃO os passa e por quê.

- [ ] **Passo 4: portão e commit**

```bash
npx tsc --noEmit && npx eslint "src/app/api/v1/chat/route.ts" "src/app/api/v1/search/route.ts" && npx vitest run && npm run verificar:ui
git add "src/app/api/v1/chat/route.ts" "src/app/api/v1/search/route.ts"
git commit -m "Busca e chat do widget passam a resolver o escopo do mesmo jeito

A busca do widget usava o mesmo key.space_ids que o chat. Se só o chat resolvesse
pela base, o cliente acharia pela busca um documento que o chat recusa usar, ou o
contrário — duas respostas diferentes para 'o que eu posso ver', que é pior que
nenhuma das duas.

Nenhum dos dois monta identidade à mão: resolverEscopoDaBase chama
identidadeDoRastreio, que é a única tradução de p_* para dimensão e a que o motor
conhece."
```

---

### Tarefa 5: a aba de documentações em Integrações

**Files:**
- Create: `src/app/(admin)/admin/(app)/integracoes/documentacoes-panel.tsx`
- Create: `src/app/(admin)/admin/(app)/integracoes/documentacoes-actions.ts`
- Modify: a página de Integrações, para registrar a aba

**Interfaces:**
- Consumes: as duas tabelas da tarefa 1, `dimensoesComRestricaoVazia`,
  `normalizarRegra`, `resumoElegibilidade` de `@/lib/elegibilidade`,
  `vocabulario_rastreio(base)`.
- Produces: a tela. Nada depende dela.

**Leia primeiro** `src/app/(admin)/admin/(app)/integracoes/` inteiro e siga o
padrão de aba que já existe lá (Ferramentas, Fluxo, Execuções). Não invente um
segundo jeito de fazer aba nesta tela.

- [ ] **Passo 1: a action de gravação, com as três travas**

A especificação exige três travas contra a regra em branco, e a tela é onde duas
delas vivem:

```ts
"use server";

import { requirePermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  dimensoesComRestricaoVazia,
  normalizarRegra,
  type Regra,
} from "@/lib/elegibilidade";

/**
 * Grava a regra de elegibilidade de uma documentação anexada.
 *
 * TRÊS TRAVAS, e as três existem porque a falha é silenciosa: regra malformada
 * ou vazia produz conteúdo que não alcança ninguém, sem erro em lugar nenhum.
 *
 *   1. `normalizarRegra` tira branco, caixa e duplicata ANTES de gravar, para o
 *      banco não acumular ["PG","pg",""," PG "] e a tela não mostrar quatro
 *      chips onde há um valor;
 *   2. `dimensoesComRestricaoVazia` RECUSA a gravação de dimensão cujos itens
 *      sejam todos em branco — quem digitou quis restringir e o efeito seria
 *      liberar;
 *   3. o CHECK `regra_valida` no banco é a última, para o caso de alguém gravar
 *      por fora desta action.
 */
export async function salvarRegraDocumentacao(input: {
  escopo: { tipo: "universal" } | { tipo: "base"; baseId: string };
  spaceId: string;
  regra: Regra;
  enabled: boolean;
}): Promise<{ ok: true } | { ok: false; erro: string }> {
  await requirePermission("ai.configure", null);

  const vazias = dimensoesComRestricaoVazia(input.regra);
  if (vazias.length) {
    return {
      ok: false,
      erro: `Estas restrições estão em branco e liberariam todo mundo: ${vazias.join(", ")}. Preencha ou remova.`,
    };
  }
  const regra = normalizarRegra(input.regra);
  const db = await createClient();

  const alvo =
    input.escopo.tipo === "universal"
      ? { tabela: "documentacoes_universais" as const, chave: { space_id: input.spaceId } }
      : {
          tabela: "ai_base_documentacoes" as const,
          chave: { base_id: input.escopo.baseId, space_id: input.spaceId },
        };

  const { error } = await db
    .from(alvo.tabela)
    .upsert({ ...alvo.chave, regra, enabled: input.enabled });

  // O CHECK `regra_valida` no banco é a terceira trava. Se ela disparar aqui, é
  // porque algo chegou por um caminho que as duas primeiras não cobrem — devolva
  // a mensagem do banco em vez de engolir, senão a tela diz "salvo" e nada foi.
  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}
```

- [ ] **Passo 2: a tela**

Requisitos que não são estéticos:

- duas seções, **Universais** e **Deste cliente**, porque a fronteira é explícita
  por desenho e misturá-las recriaria a confusão de herança que as duas tabelas
  existem para evitar;
- por linha, a frase de `resumoElegibilidade` ao vivo — é ela que impede o admin
  de ler interseção como união;
- ao lado de cada dimensão restringida, o aviso de presença: se
  `vocabulario_rastreio(base)` não tem nenhum valor naquela dimensão, dizer
  **"esta base nunca enviou valor para X"**. Esse é o diagnóstico que substitui o
  contador de alcance, que foi medido e não funciona: `natcorp` tem 317 conversas
  e 4 valores distintos de `p_usuario`;
- "sem restrição" é um **interruptor explícito** por dimensão, não campo em
  branco. Campo em branco é estado inválido, não sinônimo de liberado;
- os valores das dimensões que têm endpoint de estrutura no ERP vêm de lista, não
  de digitação: `estrutura_empresas`, `estrutura_filiais`,
  `estrutura_centros_custo`, `estrutura_unidades_adm`,
  `estrutura_vinculos_empregaticios`, `estrutura_sindicatos`. `unidade_negocio`
  ainda não tem endpoint e fica com digitação livre — é a única.

Os quatro estados obrigatórios (carregando com skeleton, vazio com ação, erro com
o que fazer, sucesso) valem aqui como em toda tela do produto.

- [ ] **Passo 3: portão e commit**

Inclui `NEXT_PUBLIC_BASE_PATH= npm run build` e `npm run verificar:ui`, que é
catraca: a tela nova não pode subir a dívida.

---

### Tarefa 6: a prova de isolamento contra o banco real

**Files:**
- Create: `.audit/isolamento-documentacao-e2e.ts`

**Por que existe.** O widget usa service-role, que ignora RLS. Então o isolamento
entre clientes depende INTEIRAMENTE de a aplicação montar a lista de ids certa.
Não há cerca no banco para esse caminho, e com arquivo interno de cliente o custo
de um erro passa de "resposta errada" para "documento de um cliente exposto a
outro". Este script é a cerca.

**Interfaces:**
- Consumes: `escopo_documentacao`, `documentos_da_base`, e as duas tabelas.
- Produces: um script que sai com código 1 se houver vazamento.

- [ ] **Passo 1: escrever o script**

Ele precisa, em transação com `rollback` ao final para não sujar produção:

1. criar duas bases de teste e duas documentações de teste;
2. anexar a documentação A à base A e a B à base B;
3. criar um arquivo de base em cada;
4. chamar `escopo_documentacao` e `documentos_da_base` para A e para B;
5. **falhar** se o escopo de A contiver qualquer id de B, e vice-versa;
6. repetir com uma regra restrita por portal, provando que a identidade errada
   não alcança;
7. `rollback`.

Siga o molde de `.audit/gestao-isolamento-e2e.ts`, que já existe e faz exatamente
este tipo de prova.

**Atenção:** `set local role` fora de transação é no-op e daria falso positivo.

- [ ] **Passo 2: rodar e ver passar; depois sabotar e ver falhar**

Uma prova que nunca falha não é prova. Depois de vê-la passar, altere
temporariamente o script para anexar a documentação de B à base A e confirme que
ele acusa e sai com código diferente de zero. Desfaça a sabotagem e diga no
report as duas saídas.

- [ ] **Passo 2b: a cerca do `anon` vira teste REPETÍVEL, não assertiva de uma vez**

Acrescentado depois da re-revisão da tarefa 2, que foi honesta sobre o limite do
que ela entregou: a assertiva comportamental que criamos lá roda **uma vez**, no
`migrate:apply`. Não há ledger de migrations neste projeto, não há reaplicação
automática e não há pgTAP. Se uma migration futura reescrever
`chunks_public_read` para vazar, nada roda aquela assertiva de novo.

Então o mesmo invariante entra neste script, que passa a ser chamado pela CI:

- em transação, com `set local role anon`, contar `chunks` com `node_id is null`
  alcançáveis. Tem de ser zero;
- e, no mesmo molde da prova da tarefa 2, o script precisa **falhar quando
  sabotado**. Reaproveite o mecanismo de sabotagem com `rollback` que você já vai
  escrever para o isolamento.

Sem isto, a proteção da cerca pública é revisão de código, não banco — e o dono
precisa saber qual das duas é.

- [ ] **Passo 3: registrar como superfície medida**

Acrescente ao job `superficie-medida` da CI três entradas apontando para este
script: `^supabase/migrations/.*(documentaco|arquivo_de_base)`,
`^src/lib/ai/escopo-da-base`, e **`^supabase/migrations/`** em geral para a cerca
do `anon` — porque qualquer migration pode mexer numa policy, e o ponto do passo
2b é que a cerca deixe de depender de alguém lembrar.

---

---

### Tarefa 7: a cerca dentro do banco, além do teste

A especificação pediu isto na seção de riscos e a auto-revisão deste plano achou
que eu não o havia incluído: hoje o isolamento entre clientes depende
inteiramente de a aplicação montar a lista de ids certa, porque o widget usa
service-role e RLS não se aplica. A tarefa 6 prova que a aplicação acerta; esta
faz o banco recusar o erro.

**Files:**
- Create: `supabase/migrations/20260925120000_busca_recusa_documento_de_outra_base.sql`

**Interfaces:**
- Consumes: `public.documentos_da_base`.
- Produces: `public.hybrid_search_scoped` com um parâmetro novo, OPCIONAL e com
  default nulo, para nenhum chamador existente mudar.

- [ ] **Passo 1: medir ANTES, porque isto é superfície medida**

```bash
npx tsx --env-file=.env.local scripts/eval-rag.ts
```

Anote o número. Se ele mudar depois desta tarefa, pare: a cerca não pode alterar o
que é recuperado quando o escopo está certo.

- [ ] **Passo 2: a migration**

Leia a definição atual com `pg_get_functiondef` e reproduza-a inteira, mudando só
o que segue. **Não reescreva a fusão RRF nem o agrupamento por origem** — o corte
de dois grupos mais fortes é comportamento deliberado e medido.

A mudança: um parâmetro `p_base text default null` e, quando ele vier, um filtro
que descarta `document_id` que não pertença àquela base:

```sql
   and (
     p_base is null
     or c.document_id is null
     or c.document_id in (select document_id from public.documentos_da_base(p_base))
   )
```

`c.document_id is null` deixa passar chunk de ARTIGO, que é escopado por nó e não
por base. Sem essa linha a cerca cortaria a documentação inteira.

`p_base is null` preserva todos os chamadores atuais, inclusive a busca do portal
e o Cmd+K, que não têm base.

**Assertiva obrigatória** dentro da migration: com `p_base` nulo, o resultado tem
de ser igual ao de antes para uma consulta conhecida. Sem isso, um erro de
transcrição da função passa calado.

- [ ] **Passo 3: medir DEPOIS e comparar**

```bash
NODE_OPTIONS=--conditions=react-server npx tsx --env-file=.env.local scripts/eval-rag.ts
```

Esperado: o MESMO número do passo 1. Se divergir, a transcrição da função mudou
algo que não devia — reporte com os dois números em vez de seguir.

- [ ] **Passo 4: passar a base na chamada do widget**

Em `retrieveWith`, a chamada `p_base` só vai quando o escopo veio da base (o
`origem: "base"` da tarefa 3). Quando caiu no escopo da chave, a base não deve
filtrar: o cliente ainda não foi migrado e os documentos legítimos dele vêm pela
documentação da chave.

- [ ] **Passo 5: sabotar e ver a cerca pegar**

Com o script da tarefa 6 alterado para pedir o documento de outra base
explicitamente, a busca tem de devolver zero linha daquele documento mesmo que a
aplicação erre a lista. Diga a saída no report.

- [ ] **Passo 6: portão e commit**

Portão completo mais os dois números do eval-rag na mensagem do commit.

---

## Ordem e dependências

```
T1 (tabelas + escopo_documentacao)
 └─> T2 (arquivo de base + documentos_da_base)
      └─> T3 (RAG resolve pela base)
           ├─> T4 (chat e busca juntos)
           └─> T6 (isolamento)
T5 (tela) depois de T1 e T2; independente de T3/T4
T7 (cerca no banco) depois de T2 e T3; antes de T6 fazer sentido como par
```

## Definição de pronto

- [ ] `npm run verificar:elegibilidade` continua passando (42 casos, doze nomes)
- [ ] `npx vitest run` passa inteiro (base 234 arquivos / 2586 testes)
- [ ] `npm run verificar:ui` diz "Dívida de UI estável"
- [ ] `NEXT_PUBLIC_BASE_PATH= npm run build` compila
- [ ] `eval-rag` dá o MESMO número antes e depois, com nada configurado (medido: top-4 12/20, MRR 0,483)
- [ ] `.audit/isolamento-documentacao-e2e.ts` passa, e falha quando sabotado
- [ ] a cerca do banco (T7) recusa documento de outra base mesmo com a aplicação
      errando a lista, e o `eval-rag` dá o mesmo número antes e depois dela
- [ ] com nada anexado, um turno do widget recupera exatamente o que recuperava
- [ ] `anon` continua vendo zero chunk de arquivo (provado em transação)

## Fora de escopo, e não por esquecimento

A aba de Conteúdos do cliente (upload, download, mídia) é o projeto 2. As
campanhas são o projeto 3. A chave de widget continua exigindo documentação dona,
e `conversations.space_id` continua NOT NULL — isso é o projeto 4. **A persona é DESVIO CONSCIENTE do escopo da spec**, não esquecimento. A spec
lista "persona só da chave de widget" dentro do projeto 1. Fica fora por duas
razões: anexar documentação funciona independentemente de onde a persona vem, e
mexer na cascata exige cuidar do Ask-AI do portal, que legitimamente usa
`spaces.chat_prompt` — a própria revisão da spec pegou esse furo. Juntar as duas
coisas faria um risco de portal entrar numa rodada que não precisa dele.
