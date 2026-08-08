-- =====================================================================
-- FERRAMENTA DE USO INTERNO DO AGENTE (não aparece como opção no chat)
--
-- Nem toda ferramenta faz sentido como escolha do usuário. Algumas existem só
-- para o agente encadear: `linha_tempo_fato` devolve os TIPOS de fato que
-- `linha_tempo` vai consumir; `historico_financeiro_meses` e
-- `relatorio_aviso_ferias_meses` devolvem quais competências existem antes da
-- consulta de verdade. Oferecer isso num botão de "de onde você quer que eu
-- busque?" é oferecer um passo intermediário como se fosse a resposta — o
-- usuário clica, recebe uma lista de códigos e conclui que o bot não sabe.
--
-- O que a coluna faz: tira a ferramenta das LISTAGENS do chat (gates de fonte,
-- "qual delas?", gaveta "Outra fonte", oferta de troca de fonte).
--
-- O que ela NÃO faz: não desativa nada. A ferramenta continua no catálogo, no
-- roteamento semântico e nas mãos do agente — que é justamente quem precisa
-- dela. Para tirar do ar de vez, o campo é `active`.
--
-- Padrão `true` (aparece): é o comportamento de hoje, e uma ferramenta nova não
-- pode sumir da tela por omissão de quem cadastrou.
-- =====================================================================

alter table public.ai_tools
  add column if not exists selecionavel_no_chat boolean not null default true;

comment on column public.ai_tools.selecionavel_no_chat is
  'false = uso interno do agente: some das listagens de fonte do chat, mas continua disponível para o modelo chamar. Não confundir com `active` (que tira do catálogo).';

-- As três dependências conhecidas hoje. Cada uma é chamada ANTES da consulta
-- real e sozinha não responde nada ao usuário.
update public.ai_tools
   set selecionavel_no_chat = false
 where key in ('linha_tempo_fato', 'historico_financeiro_meses', 'relatorio_aviso_ferias_meses');
