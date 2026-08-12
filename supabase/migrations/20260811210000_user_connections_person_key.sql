-- =====================================================================
-- A conexão de conta pessoal passa a ser da PESSOA, não do usuário do sistema
--
-- A coluna chamava `p_usuario` e guardava exatamente isso: o `p_usuario` do
-- token de rastreio. Em campo, no Painel do Colaborador, esse campo vale
-- 'PORTAL' — é o usuário da aplicação APEX, o mesmo para toda a base. Quem
-- identifica a pessoa é a matrícula.
--
-- Duas consequências, ambas observadas em 11/08/2026:
--
--   1. VAZAMENTO DE CAIXA. A primeira pessoa a conectar gravaria a linha
--      ('PORTAL'), e o `ms_email_enviar` de QUALQUER colega da base encontraria
--      essa conexão — mandando e-mail pela caixa dela. Nunca chegou a acontecer
--      porque não existia botão de conectar; corrigimos antes de existir.
--   2. CONEXÃO INVISÍVEL. O consentimento gravava `p_usuario ?? p_matricula` e
--      o chat consultava só `p_usuario`. Quando o anfitrião mandava um sem o
--      outro, a conta era conectada com sucesso e continuava "não conectada"
--      para sempre. É a origem da linha órfã com a chave '365785'.
--
-- A chave agora é `empresa:matricula` (ver `src/lib/integrations/user-key.ts`),
-- gerada pela MESMA função nas duas pontas. `person_key` no lugar de
-- `p_usuario` porque o nome antigo descrevia a origem do valor, não o que ele
-- identifica — e foi essa confusão que produziu o defeito.
--
-- ── As conexões que já existem ──────────────────────────────────────────
-- Estão na chave antiga e não casam com nenhuma chave nova. Em vez de tentar
-- adivinhar a empresa de cada uma, marco como revogadas: a tela de admin deixa
-- de mostrar "conectado" para uma conexão que o chat nunca vai encontrar, e
-- reconectar é um clique. São duas linhas, ambas de teste interno.
-- =====================================================================

alter table public.user_connections rename column p_usuario to person_key;
alter table public.oauth_states rename column p_usuario to person_key;

alter table public.user_connections
  rename constraint user_connections_credencial_usuario_key to user_connections_credencial_pessoa_key;

comment on column public.user_connections.person_key is
  'A PESSOA: empresa:matricula, gerada por chavePessoal() (src/lib/integrations/user-key.ts). NUNCA o p_usuario do anfitrião — no portal do colaborador ele é compartilhado por todos.';
comment on column public.oauth_states.person_key is
  'A mesma chave de user_connections.person_key, fixada no início do consentimento.';
comment on constraint user_connections_credencial_pessoa_key on public.user_connections is
  'Uma linha por (credencial, pessoa). Restrição SIMPLES e não parcial de propósito: é o que o ON CONFLICT do upsert consegue mirar. Reconectar reusa a linha e limpa revoked_at.';

-- Chave no formato antigo (sem o separador) = conexão que o chat não alcança.
update public.user_connections
   set revoked_at = now(), updated_at = now()
 where revoked_at is null
   and person_key not like '%:%';
