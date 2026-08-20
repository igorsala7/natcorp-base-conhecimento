-- =====================================================================
-- TEMPORÁRIO — chat_ferramentas: claude-haiku-4-5 → gemini-3.6-flash
--
-- NÃO é uma decisão de qualidade. A medição de 19–20/08 manteve o haiku para
-- esta finalidade (ver docs/decisao-modelo-e-custo.md e
-- docs/todos-os-modelos-de-texto.md).
--
-- ── Por que a troca ─────────────────────────────────────────────────────
-- Em 20/08 pela manhã a chave da Anthropic passou a ser recusada:
--
--   HTTP 400 · "Your credit balance is too low to access the Anthropic API."
--
-- Testada em chamada DIRETA à API, fora do sistema, e o erro se repetiu. Como
-- não há queda para outro provedor — o circuit-breaker só para de tentar, não
-- troca —, TODA pergunta que precisa de ferramenta passou a devolver erro ao
-- usuário final. O produto ficou sem o caminho de ferramentas inteiro.
--
-- O gemini-3.6-flash é um dos cinco modelos que fecharam 10/10 na bateria de
-- resposta verificável, então a troca não é um remendo qualquer: é o segundo
-- colocado medido, não um modelo escolhido às pressas.
--
-- ── Como reverter ───────────────────────────────────────────────────────
-- Assim que a chave da Anthropic voltar a responder, devolver:
--
--   update public.ai_assignments
--      set provider_id = (select id from public.ai_providers where kind='anthropic' limit 1),
--          model = 'claude-haiku-4-5', updated_at = now()
--    where purpose = 'chat_ferramentas' and base_code = '';
--
-- O cache de configuração tem TTL de 30 s — a volta vale sem reiniciar nada.
--
-- ── O que esta troca também revelou ─────────────────────────────────────
-- Um problema de faturamento num provedor derruba uma finalidade inteira para
-- TODOS os clientes de uma vez. Registrado, e não tratado por decisão do dono
-- em 20/08.
-- =====================================================================

update public.ai_assignments
   set provider_id = (select id from public.ai_providers where kind = 'google' limit 1),
       model = 'gemini-3.6-flash',
       updated_at = now()
 where purpose = 'chat_ferramentas'
   and base_code = ''
   and model = 'claude-haiku-4-5';
