-- O DESTAQUE DO TURNO SOBREVIVE À MENSAGEM.
--
-- `destacar_tela` grava quais linhas foram destacadas, e é essa informação que
-- responde "quem são eles" quando a próxima pergunta for "me traga o cargo
-- deles" (regra do Igor, 17/08/2026). O código já gravava em
-- `messages.payload` desde 3ab8bb3 — a coluna é que nunca existiu.
--
-- Consequência da falta: o PostgREST recusa a linha inteira com PGRST204
-- ("Could not find the 'payload' column"), e como o retorno do insert não era
-- conferido, TODA resposta do assistente deixou de ser gravada em silêncio. O
-- trace continuava marcando o turno como "resposta", então nada apontava para
-- cá; só aparecia como "o chat perde as mensagens ao atualizar a página".
--
-- Metadado do turno: pequeno, jsonb, e ninguém consulta por ele — por isso não
-- ganha índice nem coluna própria por campo.
alter table public.messages add column if not exists payload jsonb;

comment on column public.messages.payload is
  'Metadado do turno (ex.: {destacadas:[{coluna,valor}]}) — o que o assistente destacou na tela, para a próxima pergunta com pronome saber a quem ele se refere.';
