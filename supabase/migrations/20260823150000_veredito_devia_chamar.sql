-- O VEREDITO NÃO TINHA COMO DIZER "DEVIA TER CHAMADO E NÃO CHAMOU".
--
-- `ai_tool_casos` nasceu em 17/08 com cinco vereditos: certo, tool_errada,
-- parametro_errado, devia_usar_tela, nao_devia_chamar. Eles cobrem o agente que
-- escolhe a ferramenta errada, que passa parâmetro errado, que sai da tela sem
-- precisar, e que chama quando não devia.
--
-- Falta o oposto do último: o agente que tinha a ferramenta certa na mesa e
-- respondeu em texto. Medido em 23/08/2026 sobre os 138 casos do gabarito
-- (`eval/cenarios.jsonl`), esse é o MAIOR grupo de erro do conjunto:
--
--     77  certo
--     22  devia chamar e não chamou      ← sem valor possível até aqui
--     19  tool_errada
--     11  devia_usar_tela
--      9  nao_devia_chamar
--
-- Conferido contra o banco antes de escrever isto: um insert com
-- veredito = 'devia_chamar' é recusado por `ai_tool_casos_veredito_check`.
--
-- `devia_usar_tela` não serve de substituto: ele descreve o caso em que a
-- resposta estava na tela aberta, e só vale para as ferramentas LOCAIS. Das 22,
-- a maioria pede ferramenta de INTEGRAÇÃO (ferias_situacao, consultar_marcacoes,
-- linha_tempo, consultar_feedback…), que não tem nada a ver com a tela.
-- `tool_errada` também não: não houve ferramenta escolhida para estar errada.
--
-- Sem o sexto valor, esses 22 casos entrariam rotulados como outra coisa — e um
-- rótulo humano errado é pior que rótulo faltando, porque é exatamente o
-- material que a tabela existe para guardar.

alter table public.ai_tool_casos
  drop constraint if exists ai_tool_casos_veredito_check;

alter table public.ai_tool_casos
  add constraint ai_tool_casos_veredito_check
  check (veredito in (
    'certo',
    'tool_errada',
    'parametro_errado',
    'devia_usar_tela',
    'nao_devia_chamar',
    -- A ferramenta certa estava disponível e o agente respondeu em texto.
    'devia_chamar'
  ));

-- Verificação: o valor novo passa e um valor inventado continua barrado. Roda
-- dentro da transação da migration e desfaz o que inseriu.
do $$
declare algum_space uuid;
begin
  select id into algum_space from public.spaces limit 1;
  if algum_space is null then
    raise notice 'sem spaces para verificar — constraint alterada sem teste';
    return;
  end if;

  insert into public.ai_tool_casos (space_id, pergunta, veredito)
    values (algum_space, '__verificacao_migration__', 'devia_chamar');
  delete from public.ai_tool_casos where pergunta = '__verificacao_migration__';

  begin
    insert into public.ai_tool_casos (space_id, pergunta, veredito)
      values (algum_space, '__verificacao_migration__', 'valor_que_nao_existe');
    delete from public.ai_tool_casos where pergunta = '__verificacao_migration__';
    raise exception 'o constraint aceitou um veredito inválido — está frouxo demais';
  exception when check_violation then
    null; -- é o esperado
  end;
end $$;
