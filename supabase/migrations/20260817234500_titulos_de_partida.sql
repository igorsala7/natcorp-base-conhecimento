-- PARA QUEM NÃO CONSEGUE ESCREVER A PERGUNTA, WIDGET SEM SUGESTÃO É WIDGET SEM PORTA.
--
-- A abertura por público (`abertura.ts`) dá atalhos a operador, gestor,
-- colaborador e candidato. Para o público NÃO identificado o catálogo é vazio,
-- e o comentário de lá explica por quê — com um argumento bom: sem identidade,
-- um atalho como "Ver meu último holerite" leva a uma recusa, e recusa ensina a
-- pessoa que o assistente não funciona.
--
-- O que aquele raciocínio não pesou é que o custo de "nenhuma sugestão" não é o
-- mesmo para todo mundo. Para quem lê e escreve com facilidade, o campo em
-- branco é neutro: digita o que quer. Para quem é semi-alfabetizado, compor e
-- escrever a pergunta É a barreira — e o campo em branco é o fim da linha.
--
-- A saída não é mostrar atalho que exige identidade. É mostrar o que QUALQUER
-- pessoa pode perguntar e que comprovadamente tem resposta: os assuntos mais
-- lidos daquela documentação. Não dá para estar errado, porque sai do que já
-- existe e já foi lido; não exige identidade, porque é conteúdo publicado; e se
-- atualiza sozinho conforme a documentação muda.
--
-- ── HERANÇA: a primeira versão desta função não achava nada ─────────────────
-- Ela filtrava por `n.space_id = p_space_id`, e os espaços que servem o widget
-- ("Painel do Colaborador", "Painel do Gestor") têm ZERO artigos próprios: eles
-- herdam de "Documentação Natcorp" e OCULTAM ~1.420 nós cada, por overlay. Ou
-- seja, a correção teria rodado sem erro e sem efeito exatamente nos dois
-- lugares onde ela importa. É a fórmula da PARTE 4.1 do CLAUDE.md que vale
-- aqui: conteúdo do pai − ocultos ∪ próprios.
--
-- SECURITY DEFINER: quem chama é a rota de config do widget, com chave pública
-- e sem sessão. O filtro de publicado/visível fica DENTRO, como as demais
-- funções que o portal anônimo já usa.
create or replace function public.titulos_de_partida(
  p_space_id uuid,
  p_limit int default 3
)
returns table (title text)
language sql
stable
security definer
set search_path = public
as $$
  with alvo as (
    select s.id, s.parent_space_id from public.spaces s where s.id = p_space_id
  ),
  ocultos as (
    select o.source_node_id
    from public.space_overlays o
    join alvo a on o.space_id = a.id
    where o.hidden
  ),
  visiveis as (
    -- Exclusivos do próprio espaço.
    select n.id, n.title, n.published_at
    from public.nodes n join alvo a on n.space_id = a.id
    union
    -- Herdados do pai, menos o que este espaço escondeu.
    select n.id, n.title, n.published_at
    from public.nodes n join alvo a on a.parent_space_id is not null and n.space_id = a.parent_space_id
    where not exists (select 1 from ocultos o where o.source_node_id = n.id)
  )
  select v.title
  from visiveis v
  join public.nodes n on n.id = v.id
  left join (
    select av.node_id, sum(av.views) as views from public.article_views av group by av.node_id
  ) vw on vw.node_id = v.id
  where n.type = 'article'
    and n.status = 'published'
    and n.deleted_at is null
    -- Título curto: o que vira botão precisa caber e ser lido de relance.
    and length(v.title) between 3 and 48
  order by coalesce(vw.views, 0) desc, v.published_at desc nulls last
  limit least(greatest(coalesce(p_limit, 3), 1), 6);
$$;

grant execute on function public.titulos_de_partida(uuid, int) to anon, authenticated;
