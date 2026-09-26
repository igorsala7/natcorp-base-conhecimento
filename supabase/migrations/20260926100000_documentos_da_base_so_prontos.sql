-- =====================================================================
-- ARQUIVO DE BASE SÓ ENTRA NO RAG QUANDO ESTÁ `ready`
--
-- ── O defeito, e por que ele é latente e não visível ──────────────────
-- `src/lib/ai/rag.ts` filtra `.eq("status", "ready")` nos arquivos que vêm
-- dos ESPAÇOS, e a justificativa está escrita logo acima da consulta:
-- documento ainda em extração tem chunks pela METADE, e responder com meia
-- planilha é pior do que não responder — o modelo não tem como saber que a
-- lista que ele recebeu está truncada, então ele afirma o parcial como se
-- fosse o todo.
--
-- `public.documentos_da_base` não tinha esse predicado, e `rag.ts` soma o
-- resultado dela aos arquivos dos espaços sem conferir. Medido em 26/09: os
-- 123 `knowledge_documents` de produção estão TODOS em `ready`, e nenhum
-- deles tem `base_id` — ou seja, hoje não há uma única linha que exercite o
-- caminho. É por isso que o defeito nunca apareceu, e é também por isso que
-- ele acorda no PRIMEIRO upload grande de cliente, que é exatamente o caso
-- de uso do pedido do dono: enquanto o worker extrai um PDF de 2.000
-- páginas, o chatbot daquele cliente responde com o pedaço que já entrou.
--
-- ── Por que o predicado vai AQUI, no SQL, e não na aplicação ──────────
-- Dois motivos, e o segundo é o que decide:
--
--   · este é o lugar onde o escopo por base MORA. Todo chamador presente e
--     futuro de `documentos_da_base` ganha o filtro de graça — inclusive o
--     próximo, que não vai ler o comentário de `rag.ts`;
--   · um filtro do lado da aplicação seria um SEGUNDO lugar para alguém
--     esquecer, e esquecer um segundo lugar é literalmente o defeito que
--     está sendo corrigido aqui. O predicado dos espaços já existia em
--     `rag.ts` e a função nova nasceu sem ele.
--
-- O status de extração é propriedade do ARQUIVO, não da tela que o consome.
-- Uma função que responde "quais arquivos desta base esta identidade
-- alcança" não deve devolver arquivo que não está pronto para ser lido.
--
-- ── O que NÃO muda ───────────────────────────────────────────────────
-- A tela de administração não usa esta função: ela lista os arquivos da base
-- direto da tabela (`src/lib/documentacoes/arquivos-da-base.ts`), e continua
-- mostrando `queued`/`extracting`/`error` com o estado de cada um — é
-- exatamente onde o dono precisa ver que a extração está em curso. O que
-- muda é só o que o RAG recebe.
--
-- `create or replace`: a assinatura é a MESMA (text, jsonb), então `drop` é
-- proibido aqui — `drop function` + `create` devolveria EXECUTE a PUBLIC, e
-- esta função é `security definer` sobre quatro tabelas.
--
-- ── SEGUNDO (agora TERCEIRO) SÍTIO DE DEFINIÇÃO ──────────────────────
-- O corpo vivo desta função vinha de `20260925160000_branco_unico_e_grants.sql`,
-- que por sua vez superou o de `20260925110000_arquivo_de_base.sql`. Este
-- arquivo passa a ser o terceiro sítio, e os dois anteriores ganharam
-- cabeçalho dizendo o que reaplicar cada um sozinho desfaz. Consolidar os três
-- num sítio único é tarefa separada, decidida pelo dono; não há ledger, então
-- reaplicar um arquivo à mão é operação normal e o aviso no arquivo velho é o
-- que resta.
-- =====================================================================

create or replace function public.documentos_da_base(
  p_base text,
  p_identidade jsonb default '{}'::jsonb
)
returns table (document_id uuid)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $fn$
  select k.id
    from public.knowledge_documents k
    join public.ai_bases b on b.id = k.base_id
   where k.base_id is not null
     -- Só o que está PRONTO: arquivo em extração tem chunks pela metade, e
     -- meia planilha afirmada como inteira é pior do que nenhuma resposta.
     and k.status = 'ready'
     and public.codigo_normalizado(b.base_code) = public.codigo_normalizado(p_base)
     and public.elegivel(k.regra, p_identidade);
$fn$;

comment on function public.documentos_da_base(text, jsonb) is
  'Arquivos DE CLIENTE, PRONTOS (status = ready), que esta identidade alcança nesta base, filtrados por public.elegivel. O filtro de status é o mesmo que rag.ts já aplicava aos arquivos dos ESPAÇOS, e mora aqui porque é aqui que o escopo por base mora: arquivo em extração tem chunks pela metade e o modelo afirmaria o parcial como se fosse o todo. A tela de administração lista da tabela, não desta função, e continua mostrando queued/extracting/error. Nunca devolve arquivo de outra base: o join por base_code normalizado (public.codigo_normalizado) é a cerca, e o teste de isolamento em .audit/ é o que a prova. EXECUTE só para service_role: sendo security definer ela ignora a RLS, e com grant a authenticated qualquer Leitor enumerava os ids dos arquivos internos de qualquer cliente.';

-- Grants idênticos aos de 20260925160000: reafirmados aqui porque
-- `create or replace` preserva os grants existentes, mas este arquivo tem de
-- ser aplicável sozinho num banco novo sem reabrir o que a 160000 fechou.
revoke all on function public.documentos_da_base(text, jsonb) from public, anon, authenticated;
grant execute on function public.documentos_da_base(text, jsonb) to service_role;

-- ── Assertiva comportamental: status diferente de `ready` não sai ─────
-- O invariante desta migration, exercitado contra o banco real no momento da
-- aplicação. O MESMO documento é consultado duas vezes, e a única coisa que
-- muda entre as duas é a coluna `status` — sem isso a prova mediria a
-- existência do documento, não o predicado.
--
-- Os quatro valores possíveis de `status` (`queued`, `extracting`, `ready`,
-- `error`) vêm do CHECK `knowledge_documents_status_check`. Os três que não
-- são `ready` são testados um a um: um predicado escrito como `status <>
-- 'queued'` passaria num teste só de `queued`.
--
-- Limpeza antes E depois: este arquivo roda numa transação que COMMITA (ver
-- scripts/apply-migrations.ts), então a limpeza é explícita, e o `delete` de
-- entrada faz o arquivo ser re-rodável depois de uma aplicação interrompida.
do $as$
declare
  v_base uuid;
  v_doc  uuid;
  v_st   text;
  v_tem  boolean;
begin
  delete from public.knowledge_documents where original_name like 'zz-t13-%';
  delete from public.ai_bases            where base_code     like 'zz-t13-%';

  insert into public.ai_bases (base_code, name)
    values ('zz-t13-status', 'zz-t13-status') returning id into v_base;

  insert into public.knowledge_documents (base_id, storage_path, original_name, status, regra)
    values (v_base, 'zz-t13/planilha.xlsx', 'zz-t13-planilha.xlsx', 'ready', '{}'::jsonb)
    returning id into v_doc;

  -- O caso POSITIVO primeiro: se ele falhasse, os negativos abaixo passariam
  -- por motivo errado (documento que não existe também não sai).
  select exists (
    select 1 from public.documentos_da_base('zz-t13-status', '{}'::jsonb) d
     where d.document_id = v_doc
  ) into v_tem;
  assert v_tem,
    'documento com status ready TEM de sair de documentos_da_base, e nao saiu — o predicado novo esta cortando o que deveria passar';

  foreach v_st in array array['queued', 'extracting', 'error'] loop
    update public.knowledge_documents set status = v_st where id = v_doc;
    select exists (
      select 1 from public.documentos_da_base('zz-t13-status', '{}'::jsonb) d
       where d.document_id = v_doc
    ) into v_tem;
    assert not v_tem,
      format('documento com status %s NAO pode sair de documentos_da_base: chunks pela metade viram meia planilha afirmada como inteira', v_st);
  end loop;

  -- E de volta a `ready`: o MESMO documento volta a sair. Prova que o que
  -- decide é o status e nada mais.
  update public.knowledge_documents set status = 'ready' where id = v_doc;
  select exists (
    select 1 from public.documentos_da_base('zz-t13-status', '{}'::jsonb) d
     where d.document_id = v_doc
  ) into v_tem;
  assert v_tem,
    'o MESMO documento, de volta a ready, tem de sair — se nao sai, o que mudou nao foi o status';

  raise notice 'assertiva OK — documentos_da_base devolve so status=ready (queued, extracting e error ficam fora, e o mesmo documento volta a sair em ready)';

  delete from public.knowledge_documents where original_name like 'zz-t13-%';
  delete from public.ai_bases            where base_code     like 'zz-t13-%';
end $as$;
