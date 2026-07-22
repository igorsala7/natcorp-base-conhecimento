-- Acesso restrito por ORIGEM (Referer): a documentação só abre quando o
-- leitor vem de uma das URLs configuradas (ex.: portal do colaborador).
--
-- access_referrers: lista de URLs permitidas (comparação por origem; caminho
-- é reforço quando presente — entre sites o navegador costuma enviar só a
-- origem no Referer). NULL/vazio = sem restrição.
-- access_denied_message: texto da página bloqueada (com o tema do espaço).
alter table public.spaces
  add column access_referrers text[],
  add column access_denied_message text;
