-- A contagem de visualizações da PÁGINA PÚBLICA somava linha a linha.
--
-- `article_views` guarda uma linha por (nó, DIA). A página de leitura fazia
--
--   .from("article_views").select("views").in("node_id", [ids da página])
--
-- sem limite e sem recorte de data — ou seja, trazia TODO o histórico diário de
-- todos os artigos daquela página, para somar em JS. Um diretório com 12
-- artigos vistos ao longo de um ano são ~4.400 linhas: passa do teto de 1.000 do
-- PostgREST e o número exibido ao leitor fica MENOR do que a realidade, sem
-- nenhum sinal.
--
-- O agravante é onde isso aparece: é a única métrica que o LEITOR vê. Um número
-- que só encolhe é pior que nenhum número.
--
-- SECURITY DEFINER aqui, ao contrário das RPCs do admin: quem chama é o portal
-- público (`anon`), que não tem permissão de ler `article_views` — a policy
-- `views_read` exige `content.view`. A função devolve só um AGREGADO dos nós
-- que já foram pedidos, e o filtro por publicado/visível fica DENTRO dela, do
-- mesmo jeito que `register_article_view` e `top_helpful_articles` já fazem.
create or replace function public.views_dos_nos(p_ids uuid[])
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(av.views), 0)::bigint
  from public.article_views av
  join public.nodes n on n.id = av.node_id
  join public.spaces s on s.id = n.space_id
  where av.node_id = any(coalesce(p_ids, '{}'::uuid[]))
    and n.type = 'article'
    and n.status = 'published'
    and n.deleted_at is null
    and s.visibility in ('public', 'password');
$$;

grant execute on function public.views_dos_nos(uuid[]) to anon, authenticated;
