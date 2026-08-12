-- =====================================================================
-- Agente por PÚBLICO: colaborador × candidato
--
-- O Painel do Candidato manda o mesmo `p_portal` e o mesmo `p_perfil` do
-- colaborador (decisão do produto, 12/08/2026: o token só ganhou
-- `p_cod_candidato`). Então nenhum dos eixos que hoje escolhem agente —
-- `requires_perfil` e o portal — consegue separar os dois, e um candidato cairia
-- na Nati do colaborador: uma pessoa de fora da empresa conversando com o
-- assistente montado para quem já é funcionário.
--
-- `publico` é esse eixo que faltava, e ele fica no CADASTRO do agente porque é
-- decisão de produto ("este assistente atende quem?"), não de código.
--
-- Padrão 'colaborador', e não 'ambos', de propósito: todos os agentes que já
-- existem foram escritos para funcionários. Um default permissivo faria o
-- candidato herdar todos eles no instante em que o primeiro token com
-- `p_cod_candidato` chegasse — exatamente o acidente que esta coluna existe
-- para impedir.
-- =====================================================================

alter table public.ai_agents
  add column if not exists publico text not null default 'colaborador';

alter table public.ai_agents
  drop constraint if exists ai_agents_publico_check;
alter table public.ai_agents
  add constraint ai_agents_publico_check check (publico in ('colaborador', 'candidato', 'ambos'));

comment on column public.ai_agents.publico is
  'Quem este agente atende: colaborador (padrão), candidato ou ambos. A separação é por tipoDeAcesso() — matrícula preenchida = colaborador; vazia com cod_candidato = candidato — porque portal e perfil chegam iguais nos dois casos.';
