--------------------------------------------------------------------------------
-- Token de rastreio do widget (formato kbt1h) — COM validade e sessão do painel.
--                                                          [ APEX 19.2 / 19c ]
--
-- O que muda em relação ao que está instalado hoje:
--
--   1. `exp`  — validade. Hoje o token não tem: um token copiado da página vale
--               PARA SEMPRE e permite consultar como aquele usuário, inclusive
--               alcançando a conta Microsoft vinculada a ele. Com `exp`, ele
--               morre junto com a sessão do painel.
--   2. `sid`  — a sessão do APEX. É o que faz a sessão do WIDGET nascer e morrer
--               junto com a do painel: o widget separa o armazenamento local por
--               base · usuário · portal · sessão, então novo login = conversa
--               nova, e duas pessoas na mesma máquina nunca se cruzam.
--
-- Nenhum dos dois é campo `p_*`: o servidor os trata como metadado do token, não
-- como identidade a gravar.
--------------------------------------------------------------------------------
-- PRÉ-REQUISITO
--
--   grant execute on dbms_crypto to <SCHEMA_DA_APLICACAO>;
--
-- Sem isso a função falha com PLS-00201 (identificador DBMS_CRYPTO não
-- declarado) — o privilégio não vem por role, precisa ser direto ao schema.
--------------------------------------------------------------------------------

create or replace function kb_token_rastreio (
  -- A CHAVE DE RASTREIO do espaço, em base64 (32 bytes). Está no admin, em
  -- Widget → Rastreio. É segredo: não deixe em item de página nem em JavaScript.
  p_chave_b64 in varchar2,
  -- Validade em minutos. Alinhe com o TEMPO DE OCIOSIDADE da sessão do APEX
  -- (Shared Components → Security → Session Timeout). Como este token é gerado a
  -- cada renderização de página, ele se renova sozinho enquanto a pessoa navega.
  --
  -- MENOR que o timeout do APEX = o widget morre antes do painel (a pessoa vê
  -- "sessão expirada" com o painel ainda vivo). MAIOR = o token sobrevive à
  -- sessão, que é justamente o que viemos fechar. Igual é o que você quer.
  p_minutos   in number default 30
) return varchar2
is
  l_json  varchar2(4000);
  l_bytes raw(32767);
  l_mac   raw(32);
  l_exp   number;

  -- base64 "url-safe", que é o que o servidor espera: + e / viram - e _, e o
  -- preenchimento com "=" sai fora. O utl_encode quebra a saída em linhas de 64
  -- caracteres — deixar o CR/LF passar produz um token que falha na verificação
  -- sem dizer por quê, e o sintoma vira "o widget parou de reconhecer o usuário".
  function b64url(p_raw in raw) return varchar2 is
    l varchar2(32767);
  begin
    l := utl_raw.cast_to_varchar2(utl_encode.base64_encode(p_raw));
    l := replace(replace(l, chr(13)), chr(10));
    return rtrim(replace(replace(l, '+', '-'), '/', '_'), '=');
  end;
begin
  -- Unix time em segundos, SEMPRE em UTC: o servidor compara com Date.now(), que
  -- é UTC. Usar o horário local do banco erraria por 3 horas — o token nasceria
  -- vencido, ou valeria 3 horas a mais do que a sessão que ele deveria seguir.
  l_exp := round((cast(sys_extract_utc(systimestamp) as date) - date '1970-01-01') * 86400)
           + (p_minutos * 60);

  -- json_object ESCAPA os valores. Montar o JSON concatenando à mão quebra no dia
  -- em que um nome de portal ou de empresa tiver aspas ou barra invertida — e o
  -- sintoma seria a identificação sumir, não um erro claro.
  --
  -- Troque os <<...>> pelos itens/variáveis que você já usa hoje no processo do
  -- widget. `absent on null` faz a chave sumir quando o valor é nulo, que é
  -- exatamente como o servidor espera receber.
  select json_object(
           'p_base'      value <<SEU_VALOR_BASE>>,
           'p_usuario'   value <<SEU_VALOR_USUARIO>>,
           'p_portal'    value <<SEU_VALOR_PORTAL>>,
           'p_empresa'   value <<SEU_VALOR_EMPRESA>>,
           'p_matricula' value <<SEU_VALOR_MATRICULA>>,
           'p_perfil'    value <<SEU_VALOR_PERFIL>>,
           -- Sessão do APEX: é ela que amarra a sessão do widget à do painel.
           'sid'         value v('APP_SESSION'),
           'exp'         value l_exp
           absent on null
         )
    into l_json
    from dual;

  -- Os MESMOS bytes são assinados e codificados. Assinar o texto e codificar
  -- outra coisa (ou vice-versa) gera um token que o servidor recusa como
  -- adulterado — e a mensagem no log fala em adulteração, não em codificação.
  l_bytes := utl_i18n.string_to_raw(l_json, 'AL32UTF8');
  l_mac   := dbms_crypto.mac(
               src => l_bytes,
               typ => dbms_crypto.hmac_sh256,
               key => utl_encode.base64_decode(utl_raw.cast_to_raw(p_chave_b64)));

  return 'kbt1h.' || b64url(l_bytes) || '.' || b64url(l_mac);
end;
/

--------------------------------------------------------------------------------
-- COMO USAR na página (substitui o que gera o <script> do widget hoje)
--
-- Mantenha a chave FORA da página: item de aplicação protegido, substitution
-- string, ou lida de tabela. O que vai para o HTML é só o token.
--
--   htp.p('<script src="https://www.natcorpbr.com.br/natcorp/ia/widget.js"'
--      || ' data-key="pk_..."'
--      || ' data-token="' || kb_token_rastreio(:G_KB_CHAVE, 30) || '"'
--      || '></script>');
--
-- Troque `:G_KB_CHAVE` pelo que guarda a chave no seu ambiente, e o `30` pelo
-- timeout de sessão da sua aplicação.
--------------------------------------------------------------------------------
-- CONFERÊNCIA
--
--   1. O token sai com 3 partes e começa com kbt1h:
--        select kb_token_rastreio('<chave em base64>', 30) from dual;
--
--   2. O payload é legível (é assinado, não cifrado) — confira que `sid` e `exp`
--      estão lá. No navegador, no console da página do painel:
--        JSON.parse(atob(document.querySelector('script[data-token]')
--          .dataset.token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))
--
--   3. Abra o widget e faça uma pergunta: a conversa deve sair identificada.
--
-- Se aparecer "Sua sessão no painel expirou" logo de cara, os relógios estão
-- fora de sincronia. Compare:
--        select sys_extract_utc(systimestamp) from dual;   -- banco
--        date -u                                            -- servidor da app
--------------------------------------------------------------------------------
