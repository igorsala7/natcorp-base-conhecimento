--------------------------------------------------------------------------------
-- FNCT_CHATBOT_TOKEN_RASTREIO — token de rastreio do widget (formato kbt1h)
--                                                          [ APEX 19.2 / 19c ]
--
-- Substitui a montagem do token que hoje vive inline no bloco da região. O que
-- ela ACRESCENTA em relação ao bloco atual são dois campos:
--
--   exp  VALIDADE. Hoje o token não tem: um copiado da página vale PARA SEMPRE
--        e permite consultar como aquele usuário, inclusive alcançando a conta
--        Microsoft vinculada a ele. Com `exp`, morre junto com a sessão.
--
--   sid  A SESSÃO DO APEX. É o que faz a sessão do widget nascer e morrer com a
--        do painel: o widget separa o armazenamento local por
--        base · usuário · portal · sessão. Novo login = conversa nova, e duas
--        pessoas na mesma máquina nunca se cruzam.
--
-- Nenhum dos dois é campo `p_*`: o servidor os trata como metadado do token, não
-- como identidade a gravar.
--
-- PRIVILÉGIO: o bloco atual já usa `dbms_crypto.mac`, então o grant já existe.
-- Se por algum motivo faltar, é `grant execute on sys.dbms_crypto to <SCHEMA>;`
-- rodado como SYS (não vem por role).
--------------------------------------------------------------------------------

create or replace function fnct_chatbot_token_rastreio (
  -- A CHAVE DE RASTREIO do espaço (base64, 32 bytes) — o mesmo `c_key` que o
  -- bloco já usa. Continua vindo de fora para o chamador escolher a do painel.
  p_chave   in varchar2,
  -- Validade em minutos. Alinhe com o TEMPO DE OCIOSIDADE da sessão do APEX
  -- (Shared Components > Security > Session Timeout). Como o token é gerado a
  -- cada renderização de página, ele se renova sozinho enquanto a pessoa navega.
  --
  -- MENOR que o timeout do APEX = o widget morre antes do painel (a pessoa vê
  -- "sessão expirada" com o painel ainda vivo). MAIOR = o token sobrevive à
  -- sessão, que é justamente o que viemos fechar. Igual é o que você quer.
  p_minutos in number default 30
) return varchar2
is
  l_key   raw(32);
  l_json  varchar2(2000);
  l_pay   raw(2000);
  l_mac   raw(32);
  l_exp   number;

  -- base64url (base64 padrão, sem padding, com - e _) — igual ao do bloco atual.
  function b64url(p raw) return varchar2 is
    v varchar2(8000);
  begin
    v := utl_raw.cast_to_varchar2(utl_encode.base64_encode(p));
    v := replace(replace(v, chr(13)), chr(10));
    return replace(replace(rtrim(v, '='), '+', '-'), '/', '_');
  end;
begin
  -- Unix time em segundos, SEMPRE em UTC: o servidor compara com Date.now(), que
  -- é UTC. Usar o horário local erraria por 3 horas — o token nasceria vencido,
  -- ou valeria 3 horas a mais do que a sessão que ele deveria seguir.
  l_exp := round((cast(sys_extract_utc(systimestamp) as date) - date '1970-01-01') * 86400)
           + (p_minutos * 60);

  -- Dentro de uma função ARMAZENADA não existe o bind `:P_USUARIO` do bloco da
  -- página — a leitura do item vira `v('P_USUARIO')`. Mesmos itens, mesma ordem
  -- e o mesmo `apex_json.stringify` (que escapa aspas e acentos).
  l_json := '{"p_usuario":'  || apex_json.stringify(v('P_USUARIO'))
         || ',"p_empresa":'  || apex_json.stringify(v('P_EMPRESA_USER'))
         || ',"p_matricula":'|| apex_json.stringify(v('P_MATRICULA_USER'))
         || ',"p_perfil":'   || apex_json.stringify(v('P_PERFIL'))
         || ',"p_portal":'   || apex_json.stringify(v('P_PAINEL'))
         || ',"p_base":'     || apex_json.stringify(v('P_BASE'))
         -- NOVOS: sessão do painel e validade.
         || ',"sid":'        || apex_json.stringify(v('APP_SESSION'))
         -- FM sem máscara de grupo: em NLS pt_BR um separador aqui produziria
         -- `"exp":1.755.000.000`, que é JSON inválido — e o token seria recusado
         -- inteiro, sem dizer que o problema foi o número.
         || ',"exp":'        || to_char(l_exp, 'FM99999999999999')
         || '}';

  -- Assina (HMAC-SHA256) os MESMOS bytes que vão codificados. Assinar o texto e
  -- codificar outra coisa gera token recusado como adulterado — e a mensagem no
  -- log fala em adulteração, não em codificação.
  l_key := utl_encode.base64_decode(utl_raw.cast_to_raw(p_chave));
  l_pay := utl_i18n.string_to_raw(l_json, 'AL32UTF8');   -- bytes UTF-8
  l_mac := dbms_crypto.mac(l_pay, dbms_crypto.hmac_sh256, l_key);

  return 'kbt1h.' || b64url(l_pay) || '.' || b64url(l_mac);
end;
/


--------------------------------------------------------------------------------
-- O BLOCO DA REGIÃO, já adaptado. Substitui o atual por inteiro.
--
-- Só mudou o miolo: a montagem do JSON, a assinatura e o b64url saíram daqui e
-- viraram a chamada da função. Constantes, comentários e os três usos (embed,
-- link da documentação, conectar Microsoft) seguem como estavam.
--------------------------------------------------------------------------------
/*
declare
  -- +-------------------------------------------------------------------------+
  -- | TROQUE OS 3 JUNTOS, SEMPRE DO MESMO PAINEL (senao a identidade nao bate):|
  -- |  - Colaborador: c_key = 39/HM/Xcs...   widget = pk_live_8303167f...      |
  -- |                 slug  = painel-do-colaborador                           |
  -- |  - Gestor:      c_key = czFp9M8P...    widget = pk_live_e4f1eb41...      |
  -- |                 slug  = painel-do-gestor                                |
  -- | (Operador ainda NAO tem chave de rastreio gerada -> gere no /admin/widget)|
  -- +-------------------------------------------------------------------------+
  c_key    constant varchar2(64)  := 'mondnL9n6TlVgDQxNnCJW6LsprzGuKJ1Kh1QD63tm3g=';  -- Operador
  c_widget constant varchar2(80)  := 'pk_live_77c1d31cadd25d2768ac7c93167023bf';       -- Operador
  c_slug   constant varchar2(80)  := 'natcorp';                                        -- docs
  c_site   constant varchar2(200) := 'https://www.natcorpbr.com.br/natcorp/ia';  -- 'http://localhost:3008';

  -- MINUTOS = o timeout de sessao da aplicacao. Confira em
  -- Shared Components > Security > Session Management > Maximum Session Idle Time.
  c_minutos constant number := 30;

  l_token varchar2(4000);
begin
  -- 1) Token assinado com os dados do usuario logado + sessao + validade.
  --    IMPORTANTE: :P_BASE precisa valer 'natcorp' para as ferramentas da IA
  --    carregarem; :P_PERFIL controla gestor x colaborador.
  l_token := fnct_chatbot_token_rastreio(c_key, c_minutos);

  -- 2a) EMBED DO WIDGET (regiao "PL/SQL Dynamic Content"):
  htp.p('<script src="'||c_site||'/widget.js" data-key="'||c_widget||'" '
     ||'data-token="'||l_token||'" async></script>');

  -- 2b) LINK para a DOCUMENTACAO (rastreia o acesso do usuario):
  -- htp.p('<a href="'||c_site||'/docs/'||c_slug||'?kbt='||l_token
  --    ||'" target="_blank">Abrir documentacao</a>');

  -- 2c) CONECTAR CONTA MICROSOFT (uma vez por usuario).
  --     Reusa o MESMO token, entao a conta fica ligada ao :P_USUARIO real --
  --     sem depender de token emitido a mao, que usa outro par de chaves.
  -- htp.p('<a href="'||c_site||'/api/v1/connect/microsoft/start?key='||c_widget
  --    ||'&track='||l_token||'" target="_blank">Conectar conta Microsoft</a>');
end;
*/


--------------------------------------------------------------------------------
-- CONFERENCIA
--
-- 1) A funcao compilou?
--      select object_name, status from user_objects
--       where object_name = 'FNCT_CHATBOT_TOKEN_RASTREIO';
--    STATUS = VALID. Se der INVALID:  show errors function fnct_chatbot_token_rastreio
--
-- 2) O token so sai completo DENTRO de uma sessao do APEX: `v('P_USUARIO')` e
--    `v('APP_SESSION')` voltam nulos no SQL Commands. Rodar la nao e erro --
--    so nao prova nada. Teste pela propria pagina.
--
-- 3) Na pagina do painel, console do navegador -- o payload e legivel (assinado,
--    nao cifrado). Confira que `sid` e `exp` estao la:
--
--      JSON.parse(atob(document.querySelector('script[data-token]')
--        .dataset.token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))
--
-- 4) Abra o widget e pergunte algo: a conversa deve sair identificada.
--
-- Se aparecer "Sua sessao no painel expirou" logo de cara, os relogios estao
-- fora de sincronia. Compare:
--      select sys_extract_utc(systimestamp) from dual;   -- banco
--      date -u                                           -- servidor da aplicacao
--------------------------------------------------------------------------------
