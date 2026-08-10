--------------------------------------------------------------------------------
-- EMBED DO WIDGET — bloco da regiao "PL/SQL Dynamic Content"   [ APEX 19.2 ]
--
-- Substitui o bloco atual por inteiro. Cole um destes em cada painel, trocando
-- as 3 constantes do topo (elas andam JUNTAS, sempre do mesmo painel).
--
-- NAO precisa criar nada no banco: sem funcao, sem schema, sem grant. O bloco ja
-- usa `dbms_crypto` e `apex_json` hoje, entao os privilegios existem.
--
-- ── O QUE MUDA em relacao ao bloco que esta em producao ──────────────────────
--
-- Sao 5 linhas: a variavel `l_exp`, a constante `c_minutos`, o calculo do
-- vencimento e dois campos novos no JSON.
--
--   exp  VALIDADE. Hoje o token nao tem: um copiado da pagina vale PARA SEMPRE
--        e permite consultar como aquele usuario, inclusive alcancando a conta
--        Microsoft vinculada a ele. Com `exp`, ele morre junto com a sessao.
--
--   sid  A SESSAO DO APEX. E o que faz a sessao do widget nascer e morrer com a
--        do painel: o widget separa o armazenamento local por
--        base . usuario . portal . sessao. Novo login = conversa nova, e duas
--        pessoas na mesma maquina nunca se cruzam (estacao de ponto, portaria).
--
-- Nenhum dos dois e campo `p_*`: o servidor os trata como metadado do token, nao
-- como identidade a gravar.
--------------------------------------------------------------------------------

declare
  -- +-------------------------------------------------------------------------+
  -- | TROQUE OS 3 JUNTOS, SEMPRE DO MESMO PAINEL (senao a identidade nao bate):|
  -- |   - Colaborador: c_key = 39/HM/Xcs...   widget = pk_live_8303167f...     |
  -- |                  slug  = painel-do-colaborador                          |
  -- |   - Gestor:      c_key = czFp9M8P...    widget = pk_live_e4f1eb41...     |
  -- |                  slug  = painel-do-gestor                               |
  -- +-------------------------------------------------------------------------+
  c_key    constant varchar2(64)  := 'mondnL9n6TlVgDQxNnCJW6LsprzGuKJ1Kh1QD63tm3g=';  -- Operador
  c_widget constant varchar2(80)  := 'pk_live_77c1d31cadd25d2768ac7c93167023bf';       -- Operador
  c_slug   constant varchar2(80)  := 'natcorp';                                        -- docs
  c_site   constant varchar2(200) := 'https://www.natcorpbr.com.br/natcorp/ia';  -- 'http://localhost:3008';

  -- NOVO. Validade do token, em minutos. Use o MESMO valor de
  -- Shared Components > Security > Session Management > Maximum Session Idle Time.
  --
  -- MENOR que o timeout do APEX = o widget morre antes do painel (a pessoa ve
  -- "sessao expirada" com o painel ainda vivo). MAIOR = o token sobrevive a
  -- sessao, que e justamente o que viemos fechar. Igual e o que voce quer.
  --
  -- Como este bloco roda a cada renderizacao de pagina, o token se renova
  -- sozinho enquanto a pessoa navega.
  c_minutos constant number := 30;

  l_key   raw(32);  l_json varchar2(2000);  l_pay raw(2000);
  l_mac   raw(32);  l_token varchar2(4000);
  l_exp   number;   -- NOVO: vencimento em unix time (segundos, UTC)

  -- base64url (base64 padrao, sem padding, com - e _)
  function b64url(p raw) return varchar2 is
    v varchar2(8000);
  begin
    v := utl_raw.cast_to_varchar2(utl_encode.base64_encode(p));
    v := replace(replace(v, chr(13)), chr(10));
    return replace(replace(rtrim(v,'='), '+','-'), '/','_');
  end;
begin
  -- 0) NOVO. Vencimento em UTC, SEMPRE: o servidor compara com Date.now(), que e
  --    UTC. Usar o horario local do banco erraria por 3 horas -- o token
  --    nasceria vencido, ou valeria 3 horas a mais que a sessao que ele segue.
  l_exp := round((cast(sys_extract_utc(systimestamp) as date) - date '1970-01-01') * 86400)
           + (c_minutos * 60);

  -- 1) JSON com os dados do usuario logado (apex_json escapa aspas/acentos).
  --    IMPORTANTE: :P_BASE precisa valer 'natcorp' para as ferramentas da IA
  --    carregarem; :P_PERFIL controla gestor x colaborador.
  l_json := '{"p_usuario":'  ||apex_json.stringify(:P_USUARIO)
         || ',"p_empresa":'  ||apex_json.stringify(:P_EMPRESA_USER)
         || ',"p_matricula":'||apex_json.stringify(:P_MATRICULA_USER)
         || ',"p_perfil":'   ||apex_json.stringify(:P_PERFIL)
         || ',"p_portal":'   ||apex_json.stringify(:P_PAINEL)
         || ',"p_base":'     ||apex_json.stringify(:P_BASE)
         -- NOVO: sessao do painel. Amarra a sessao do widget a do APEX.
         || ',"sid":'        ||apex_json.stringify(v('APP_SESSION'))
         -- NOVO: validade. FM sem mascara de grupo -- em NLS pt_BR o padrao
         -- produziria "exp":1.755.000.000, que e JSON invalido, e o token seria
         -- recusado INTEIRO sem nada apontar para o numero como culpado.
         || ',"exp":'        ||to_char(l_exp, 'FM99999999999999')
         || '}';

  -- 2) Assina (HMAC-SHA256) -> token kbt1h.
  l_key   := utl_encode.base64_decode(utl_raw.cast_to_raw(c_key));
  l_pay   := utl_i18n.string_to_raw(l_json, 'AL32UTF8');   -- bytes UTF-8
  l_mac   := dbms_crypto.mac(l_pay, dbms_crypto.hmac_sh256, l_key);
  l_token := 'kbt1h.'||b64url(l_pay)||'.'||b64url(l_mac);

  -- 3a) EMBED DO WIDGET (regiao "PL/SQL Dynamic Content"):
  htp.p('<script src="'||c_site||'/widget.js" data-key="'||c_widget||'" '
     ||'data-token="'||l_token||'" async></script>');
/*
  -- 3b) LINK para a DOCUMENTACAO (rastreia o acesso do usuario):
  htp.p('<a href="'||c_site||'/docs/'||c_slug||'?kbt='||l_token
     ||'" target="_blank">Abrir documentacao</a>');
*/

  -- 3c) CONECTAR CONTA MICROSOFT (uma vez por usuario).
  --     Reusa o MESMO token, entao a conta fica ligada ao :P_USUARIO real --
  --     sem depender de token emitido a mao, que usa outro par de chaves.
  /*
  htp.p('<a href="'||c_site||'/api/v1/connect/microsoft/start?key='||c_widget
     ||'&track='||l_token||'" target="_blank">Conectar conta Microsoft</a>');
*/
end;


--------------------------------------------------------------------------------
-- CONFERENCIA (depois de salvar a regiao e abrir a pagina do painel)
--
-- 1) O payload e LEGIVEL (assinado, nao cifrado). No console do navegador,
--    confira que `sid` e `exp` estao la:
--
--      JSON.parse(atob(document.querySelector('script[data-token]')
--        .dataset.token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))
--
--    Esperado: os p_* de sempre + "sid" com a sessao do APEX + "exp" com um
--    numero de 10 digitos. Se `exp` sair com pontos, o to_char nao pegou.
--
-- 2) Abra o widget e pergunte algo: a conversa deve sair identificada.
--
-- 3) Deixe passar do tempo de sessao e pergunte de novo: tem que aparecer
--    "Sua sessao no painel expirou" com o botao de atualizar -- e NAO a IA
--    dizendo que nao tem acesso aos seus dados.
--
-- Se o aviso de expirado aparecer logo de cara, os relogios estao fora de
-- sincronia. Compare:
--      select sys_extract_utc(systimestamp) from dual;   -- banco
--      date -u                                           -- servidor da aplicacao
--------------------------------------------------------------------------------
