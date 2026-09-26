-- =====================================================================
-- SEIS DIMENSÕES NOVAS DE RASTREIO, E A REGRA DE ELEGIBILIDADE EM SQL
--
-- Decisão do dono (24/09): a elegibilidade de conteúdo passa a ter doze
-- dimensões. Seis já existiam; estas seis nascem aqui.
--
-- Todas são a ALOCAÇÃO da pessoa, não o que ela gerencia. Vínculo é o
-- empregatício (CLT, PJ, autônomo, estagiário). Os valores vivem nos
-- endpoints de estrutura do ERP, que já são ferramentas ATIVAS do
-- catálogo, exceto unidade de negócio, que será cadastrada depois.
--
-- ── Por que colunas, e não um jsonb ─────────────────────────────────
-- `conversations` é lida por filtro na tela de Conversas e pelas RPCs de
-- faceta, que agrupam por valor. Num jsonb cada filtro viraria expressão e
-- nenhum índice serviria. E o rastreio é um conjunto FECHADO decidido
-- pelo dono, não um saco aberto de atributos.
--
-- ── `public.elegivel`, e por que ela repete o TypeScript ────────────
-- O corte tem de acontecer no banco porque `widget.js` é público: mandar
-- a lista inteira para o navegador filtrar entregaria ao cliente os
-- nomes de tudo que ele NÃO pode ver. O predicado em TypeScript existe
-- porque a tela mostra a frase enquanto o admin digita.
--
-- As duas lêem `src/lib/elegibilidade/casos.json` e
-- `npm run verificar:elegibilidade` falha se discordarem em um caso.
--
-- ── O QUE SAIU DESTE ARQUIVO, E PARA ONDE FOI (tarefa 16) ────────────
-- A definição de `public.elegivel(jsonb, jsonb)`, o `comment on function`
-- dela, os `revoke`/`grant` e as treze assertivas que a CHAMAM saíram daqui e
-- passaram a morar num sítio ÚNICO:
--
--   supabase/migrations/20260924234000_dimensoes_elegibilidade.sql
--
-- Enquanto ela estava definida aqui TAMBÉM, reaplicar este arquivo sozinho —
-- operação normal, porque não há ledger — devolvia o motor de elegibilidade
-- ao estado de 24/09 em SILÊNCIO. O corpo daqui aceita QUALQUER chave como
-- dimensão: `{"foo":["x"]}` contra identidade `{"foo":"x"}` LIBERAVA, e um
-- typo no nome da dimensão (`centro_custos` no plural) abria o conteúdo em
-- vez de fechá-lo. Também levantava EXCEÇÃO quando a regra inteira não era
-- objeto, que numa RPC de listagem vira 500 onde devia haver negação.
--
-- A assinatura nunca mudou, então nem `npm run verificar:rpc` nem nenhuma
-- assertiva de assinatura enxergavam isso: era o CORPO que retrocedia.
-- `npm run verificar:corpo` é quem recusa o segundo sítio agora.
--
-- As assertivas foram junto com a definição porque CHAMAM a função: ficando
-- aqui, uma aplicação do zero as rodaria antes de `elegivel` existir. Os
-- `revoke`/`grant` foram pelo mesmo motivo — apontariam para função
-- inexistente.
--
-- O que é DESTE arquivo ficou: as doze colunas de rastreio em
-- `conversations` e `page_views`, e a decisão de por que elas são colunas.
-- =====================================================================

alter table public.conversations
  add column if not exists p_filial          text,
  add column if not exists p_centro_custo    text,
  add column if not exists p_unidade_adm     text,
  add column if not exists p_unidade_negocio text,
  add column if not exists p_vinculo         text,
  add column if not exists p_sindicato       text;

comment on column public.conversations.p_filial is
  'Filial de ALOCAÇÃO da pessoa. Vem do token de rastreio; nulo em cliente cujo bloco APEX ainda não foi recolado.';
comment on column public.conversations.p_centro_custo is
  'Centro de custo de ALOCAÇÃO da pessoa, não os que ela gerencia. Um gestor de três CCs tem um CC próprio, e é esse que conta.';
comment on column public.conversations.p_unidade_adm is
  'Unidade administrativa de alocação da pessoa.';
comment on column public.conversations.p_unidade_negocio is
  'Unidade de negócio de alocação. Única das seis sem endpoint de estrutura no catálogo (24/09), portanto a única com digitação livre na tela.';
comment on column public.conversations.p_vinculo is
  'Vínculo EMPREGATÍCIO (CLT, PJ, autônomo, estagiário), não vínculo com a empresa.';
comment on column public.conversations.p_sindicato is
  'Sindicato da pessoa.';

-- ── `page_views` espelha o mesmo conjunto de rastreio ────────────────
-- `page_views` já carregava as sete colunas `p_*` de sempre (nunca escolheu
-- um subconjunto — é o espelho completo de `TRACKING_KEYS`, não uma seleção
-- editorial). As seis entram aqui pela mesma razão, não por demanda de
-- analítica de visita de página.
--
-- A alternativa era estreitar o spread em
-- `src/app/api/portal/track/route.ts` para as sete chaves antigas. Foi
-- recusada: um subconjunto explícito ali apodrece em silêncio — alguém
-- acrescenta uma dimensão nova ao rastreio meses depois, o route continua
-- descartando o valor sem erro, e a análise mostra nulo para sempre sem
-- nenhum sinal de que falta algo.
alter table public.page_views
  add column if not exists p_filial          text,
  add column if not exists p_centro_custo    text,
  add column if not exists p_unidade_adm     text,
  add column if not exists p_unidade_negocio text,
  add column if not exists p_vinculo         text,
  add column if not exists p_sindicato       text;

-- ── A regra, em SQL, mora em 20260924234000 ────────────────────────
-- Assinatura em jsonb (e não doze pares de text[]/text) porque toda RPC
-- dos projetos 1 a 3 vai chamá-la, e uma função de 24 argumentos erra na
-- ordem em silêncio: trocar `filial` com `centro_custo` compila, roda e
-- devolve o conteúdo errado para o cliente errado. Essa decisão é deste
-- arquivo; a DEFINIÇÃO dela não é mais (ver o cabeçalho).
