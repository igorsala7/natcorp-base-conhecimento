-- =====================================================================
-- ELEGIBILIDADE NOS CINCO PARÂMETROS DE RASTREIO
--
-- Correção do dono (23/09): "tem que ser base, portal, usuário, empresa e
-- matrícula". A primeira versão tinha só portal, perfil e usuário.
--
-- O token de rastreio (`kbt1h.`) carrega p_base, p_usuario, p_portal,
-- p_empresa, p_matricula, p_perfil e p_cod_candidato. Não há motivo para
-- a elegibilidade enxergar metade deles: "só a empresa 700" e "só estas
-- matrículas" são recortes que o cliente pede o tempo todo, e sem a
-- dimensão o admin cairia em gambiarra (cadastrar o mesmo prompt N vezes
-- com lista de usuário).
--
-- PERFIL FICA. O exemplo que originou a funcionalidade é dele ("apenas no
-- portal do gestor para o perfil FOLHA"), e tirar uma dimensão que já
-- funciona por omissão numa lista seria decidir no lugar do dono.
--
-- ── `bases` NÃO é o mesmo que `base_code` ───────────────────────────
-- `base_code` diz de QUEM É o prompt: NULL = catálogo da Natcorp,
-- preenchido = do cliente (e é ele que decide quem pode editar).
-- `bases` diz QUEM VÊ. A diferença só importa no catálogo global: é o
-- que permite à Natcorp escrever um prompt que vale para três clientes
-- específicos, sem duplicá-lo três vezes e sem entregá-lo a todos.
-- Num prompt de cliente a lista é redundante (o escopo já restringe) —
-- redundante, não contraditória, então não estorva.
--
-- ── ESTE ARQUIVO É O SÍTIO ÚNICO DE `allowlist_casa` (tarefa 16) ─────
-- `public.allowlist_casa(text[], text)` estava definida em TRÊS arquivos
-- (este, `20260924230000` e `20260925010000`). Sem ledger de migrations,
-- reaplicar um arquivo à mão é operação normal, e reaplicar o mais antigo
-- desfazia o mais novo em SILÊNCIO — a assinatura continua única, então
-- `npm run verificar:rpc` passa: é o CORPO que retrocede.
--
-- O que este arquivo devolvia, na versão que estava aqui: o `btrim` de UM
-- argumento (só o caractere espaço) e nenhum filtro de brancos na lista. As
-- duas coisas são furo entre clientes. O aparo curto faz o banco discordar do
-- `.trim()` do JavaScript em TAB, LF, CR e NBSP, e o NBSP é a metade que
-- faltava do furo que a tarefa 12 fechou do outro lado: uma base que difere
-- só por NBSP é linha distinta para o índice único de `ai_bases` e o MESMO
-- valor para a dimensão `base` de `public.elegivel`, então documentação
-- restrita a uma alcança os usuários da outra. E a lista sem filtro de
-- brancos liberava quem NÃO manda o parâmetro.
--
-- O corpo abaixo NÃO foi remontado à mão: é a saída de `pg_get_functiondef`
-- do banco de PRODUÇÃO colada aqui (daí o cabeçalho em MAIÚSCULAS). O SHA-256
-- foi capturado antes e conferido depois de aplicar: idêntico.
--
-- ── Por que o sítio canônico é o arquivo MAIS ANTIGO, e não o mais novo ─
-- `public.prompts_sugeridos`, criada LOGO ABAIXO neste mesmo arquivo, chama
-- `allowlist_casa` seis vezes no corpo. `check_function_bodies` está ligado
-- neste banco (medido: criar função SQL que chama função inexistente FALHA),
-- então levar `allowlist_casa` para qualquer arquivo posterior faria uma
-- aplicação do zero morrer aqui com `function public.allowlist_casa(text[],
-- text) does not exist`. É a mesma forma de dependência que travou
-- `codigo_normalizado` na tarefa 15 — lá um índice único e um CHECK, aqui a
-- função vizinha.
--
-- `20260924230000` e `20260925010000` guardam as assertivas deles onde estão:
-- rodam DEPOIS deste arquivo, contra o corpo canônico, e por isso viram prova
-- de replay em vez de precisarem ser transplantadas.
-- =====================================================================

alter table public.prompt_sugerido
  add column if not exists bases text[] not null default '{}',
  add column if not exists empresas text[] not null default '{}',
  add column if not exists matriculas text[] not null default '{}';

comment on column public.prompt_sugerido.bases is
  'Allowlist de VISIBILIDADE por base. Diferente de base_code, que é a propriedade. Vazio = todas as bases do escopo.';
comment on column public.prompt_sugerido.empresas is
  'Allowlist por p_empresa (o CÓDIGO da empresa no ERP: 700, 1, 2…). Vazio = todas.';
comment on column public.prompt_sugerido.matriculas is
  'Allowlist por p_matricula. Vazio = todas.';

-- ── O casamento de uma allowlist, uma vez só ────────────────────────
-- Seis dimensões com a mesma regra dariam seis blocos quase idênticos na
-- função — e "quase" é onde mora o defeito: basta um `coalesce` faltando
-- num deles para uma dimensão passar a restringir quando deveria liberar,
-- e isso não falha, só some o prompt. Uma função só, testada uma vez.
--
-- `immutable` e sem `set search_path` de propósito: o planejador consegue
-- inlinear, e a função não toca em objeto nenhum do schema.
CREATE OR REPLACE FUNCTION public.allowlist_casa(lista text[], valor text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
AS $function$
  -- O conjunto de "branco" aparece UMA vez e é usado nas três pontas
  -- (item, teste de item vazio, valor). Repetir o literal três vezes era
  -- convidar a corrigir duas e esquecer a terceira, que é exatamente a
  -- classe de defeito que esta migration está fechando.
  with b(brancos) as (
    select ' ' || chr(9) || chr(10) || chr(13) || chr(160)  -- espaco, TAB, LF, CR, NBSP
  ),
  itens as (
    select lower(btrim(x, b.brancos)) as v
      from b, unnest(coalesce(lista, '{}'::text[])) x
     where btrim(coalesce(x, ''), b.brancos) <> ''
  )
  select not exists (select 1 from itens)
      or lower(btrim(coalesce(valor, ''), b.brancos)) in (select v from itens)
    from b;
$function$;

comment on function public.allowlist_casa(text[], text) is
  'Allowlist: lista vazia (ou só de brancos) não restringe; senão compara por lower(btrim()) dos dois lados, e valor AUSENTE nunca casa. Brancos são filtrados antes de decidir — sem isso, uma entrada em branco liberava quem não manda o parâmetro. "Branco" aqui é espaço, TAB, LF, CR e NBSP, o mesmo conjunto que o .trim() do JavaScript remove, para o gêmeo em src/lib/elegibilidade/alcanca.ts não discordar.';

-- A assinatura mudou (duas dimensões novas), então a antiga precisa sair.
drop function if exists public.prompts_sugeridos(text, text, text, text);
drop function if exists public.prompts_sugeridos(text, text, text, text, text, text);

create function public.prompts_sugeridos(
  base_ref text,
  portal_ref text default null,
  perfil_ref text default null,
  usuario_ref text default null,
  empresa_ref text default null,
  matricula_ref text default null
)
returns table (
  id uuid,
  label text,
  texto text,
  global boolean,
  favorito boolean,
  categorias text[]
)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  with vis as (
    select
      s.id,
      s.label,
      s.texto,
      s.base_code,
      s.ordem,
      exists (
        select 1
          from public.prompt_favorito f
         where f.prompt_id = s.id
           and lower(btrim(f.p_base))    = lower(btrim(coalesce(base_ref, '')))
           and lower(btrim(f.p_usuario)) = lower(btrim(coalesce(usuario_ref, '')))
      ) as fav
      from public.prompt_sugerido s
     where s.ativo
       -- PROPRIEDADE: o catálogo da Natcorp mais o do próprio cliente.
       and (s.base_code is null
            or lower(btrim(s.base_code)) = lower(btrim(coalesce(base_ref, ''))))
       -- VISIBILIDADE: as seis dimensões, combinadas com E.
       -- Vazia não restringe; uma preenchida corta tudo que não estiver nela.
       and public.allowlist_casa(s.bases,      base_ref)
       and public.allowlist_casa(s.portais,    portal_ref)
       and public.allowlist_casa(s.perfis,     perfil_ref)
       and public.allowlist_casa(s.empresas,   empresa_ref)
       and public.allowlist_casa(s.usuarios,   usuario_ref)
       and public.allowlist_casa(s.matriculas, matricula_ref)
  )
  select
    v.id,
    v.label,
    v.texto,
    (v.base_code is null),
    v.fav,
    coalesce(
      (select array_agg(c.nome order by c.ordem, c.nome)
         from public.prompt_sugerido_categoria sc
         join public.prompt_categoria c on c.id = sc.categoria_id and c.ativo
        where sc.prompt_id = v.id),
      '{}'::text[]
    )
  from vis v
  -- Favorito primeiro, depois a ordem que o admin definiu, e o rótulo
  -- como desempate — sem ele a lista dança entre duas aberturas.
  order by v.fav desc, v.ordem, lower(v.label);
$$;

comment on function public.prompts_sugeridos(text, text, text, text, text, text) is
  'Prompts sugeridos VISÍVEIS para (base, portal, perfil, usuário, empresa, matrícula). O corte é aqui porque o widget é código público — mandar a lista inteira publicaria o prompt restrito.';

revoke all on function public.prompts_sugeridos(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.prompts_sugeridos(text, text, text, text, text, text) to service_role;

-- =====================================================================
-- VOCABULÁRIO REAL DAS DIMENSÕES — para a tela não ser campo livre
--
-- Substitui `perfis_da_base`, que resolvia uma dimensão só. Agora que são
-- seis, uma função por dimensão viraria seis funções que envelhecem em
-- ritmos diferentes; esta devolve (campo, valor, contagem) e a tela
-- separa.
--
-- ── Por que só perfil e empresa ─────────────────────────────────────
-- Portal é fixo (PO/PG/PC, vem do P_PAINEL). Base sai de `ai_bases`, que
-- é cadastro, não observação. E usuário e matrícula IDENTIFICAM PESSOAS:
-- no catálogo global (sem base) um seletor montaria, na tela de um
-- administrador, a lista de logins e matrículas de todos os clientes. Os
-- dois ficam como texto livre — quem cadastra por pessoa já sabe de quem
-- está falando.
--
-- ── Por que RPC e não `select` paginado ─────────────────────────────
-- A primeira versão lia as 2.000 conversas mais recentes e deduplicava em
-- JavaScript. É o teto de 1.000 linhas do PostgREST esperando de novo: na
-- natcorp aquilo achava 2 perfis, e esta função acha 3 — o `PC` estava
-- fora da janela. Um perfil que some da tela sem nenhum sinal.
-- =====================================================================

drop function if exists public.perfis_da_base(text);

-- ── A DEFINIÇÃO DE `vocabulario_rastreio` SAIU DAQUI (tarefa 16) ────
-- Este arquivo criava `public.vocabulario_rastreio(text)` na versão de DUAS
-- dimensões (perfil e empresa), e `20260924232000_vocabulario_doze_dimensoes.sql`
-- a substituiu pela de DOZE. Com a função definida nos dois, reaplicar ESTE
-- arquivo sozinho devolvia o vocabulário a duas dimensões em silêncio: dez
-- seletores de elegibilidade da tela ficariam vazios, e "esta base nunca
-- enviou valor nesta dimensão" passaria a ser dito sobre dimensão que a
-- função nem consulta. Pior, o `drop function` que vinha antes do create
-- destruía e recriava a função, e função recém-criada nasce com EXECUTE para
-- PUBLIC — o mesmo furo que `20260925003000` e `20260924232000` fecharam.
--
-- A definição, o comentário e os privilégios moram agora num sítio ÚNICO:
--
--   supabase/migrations/20260924232000_vocabulario_doze_dimensoes.sql
--
-- Nada entre este arquivo e aquele chama `vocabulario_rastreio` (conferido:
-- nenhuma função SQL do banco a menciona, e a única outra migration que a
-- toca é `20260925003000`, posterior), então uma aplicação do zero continua
-- válida. O texto ACIMA é o registro da decisão original — por que RPC e não
-- `select` paginado, e por que usuário e matrícula ficam fora — e continua
-- valendo para a versão de doze dimensões.

