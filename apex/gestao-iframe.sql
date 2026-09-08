--------------------------------------------------------------------------------
-- AREA DE GESTAO EM IFRAME — bloco da regiao "PL/SQL Dynamic Content"
--                                                          [ APEX 19.2 ]
--
-- Cria a pagina onde o CLIENTE acompanha o consumo de creditos, distribui esses
-- creditos por perfil/usuario/painel, parametriza o acesso as consultas da IA e
-- le o historico de conversas dos usuarios dele.
--
-- Coloque numa pagina do PAINEL DO OPERADOR. O controle de quem abre a pagina
-- e do APEX (apex_programas_acesso), como qualquer outra tela.
--
-- ============================================================================
-- O QUE MUDA EM RELACAO AO BLOCO DO WIDGET (token-rastreio.sql)
-- ============================================================================
--
-- UMA COISA SO: o valor de `c_key`. Ele deixa de ser a chave do PAINEL, que
-- hoje e a mesma para todos os clientes, e passa a ser a chave DESTA BASE.
--
-- Por que isso importa, sem rodeios: o `c_key` do bloco do widget esta em texto
-- puro dentro do APEX de cada cliente. Como o servidor validava so a assinatura
-- e nada amarrava o `p_base` do token a chave, qualquer pessoa com acesso a
-- essa regiao podia emitir um token dizendo ser OUTRO cliente. No widget o
-- estrago era contido pelas credenciais do ERP alheio. Numa tela que mostra
-- consumo, fatura e conversas — dados que estao no nosso banco — nao haveria
-- anteparo nenhum.
--
-- Agora a validacao le o `p_base` do token, busca a chave DAQUELA base e so
-- entao confere a assinatura. Um token assinado com a chave de outro cliente
-- simplesmente nao fecha.
--
-- `c_widget` e `c_site` sao os MESMOS do bloco do widget daquele painel.
-- O token e montado exatamente igual: mesmo formato `kbt1h`, mesmos campos,
-- mesmo `exp`, e renovado a cada renderizacao da pagina.
--
-- ============================================================================
-- COMO OBTER O `c_key` DESTA BASE
-- ============================================================================
--
-- Do lado da Natcorp, uma vez por base:
--
--     npm run gestao:chave:prod -- <base_code>
--
-- O comando imprime as tres constantes ja prontas para colar aqui. Rodar de
-- novo NAO troca a chave (mostra a que existe); para trocar de proposito,
-- passe --forcar, sabendo que a area de gestao daquele cliente para de abrir
-- ate este bloco ser atualizado.
--
-- Enquanto a base nao tiver chave, a pagina responde
--   "Esta base ainda nao foi habilitada para a area de gestao."
-- Isso e falha FECHADA, de proposito: sem chave propria, nao ha como provar de
-- quem e o token, e a saida certa e nao abrir.
--------------------------------------------------------------------------------

declare
  -- +-------------------------------------------------------------------------+
  -- | c_key   : EXCLUSIVA DESTA BASE. Saida de `npm run gestao:chave:prod`.    |
  -- |           NAO reaproveite a chave do bloco do widget.                    |
  -- | c_widget: a MESMA chave publica do widget do Painel do Operador.         |
  -- | c_site  : a MESMA URL do bloco do widget.                                |
  -- +-------------------------------------------------------------------------+
  c_key    constant varchar2(64)  := '<COLE AQUI A CHAVE DESTA BASE>';
  c_widget constant varchar2(80)  := 'pk_live_77c1d31cadd25d2768ac7c93167023bf';  -- Operador
  c_site   constant varchar2(200) := 'https://www.natcorpbr.com.br/natcorp/ia';

  -- Igual ao bloco do widget: use o mesmo valor de
  -- Shared Components > Security > Session Management > Maximum Session Idle Time.
  c_minutos constant number := 30;

  -- Altura do iframe. A pagina e responsiva; 900px cobre as tabelas sem
  -- rolagem dupla na maioria das telas.
  c_altura  constant varchar2(10) := '900';

  l_key   raw(32);  l_json varchar2(2000);  l_pay raw(2000);
  l_mac   raw(32);  l_token varchar2(4000);
  l_exp   number;
  l_url   varchar2(4000);

  function b64url(p raw) return varchar2 is
    v varchar2(8000);
  begin
    v := utl_raw.cast_to_varchar2(utl_encode.base64_encode(p));
    v := replace(replace(v, chr(13)), chr(10));
    return replace(replace(rtrim(v,'='), '+','-'), '/','_');
  end;
begin
  -- Vencimento em UTC, SEMPRE: o servidor compara com Date.now(), que e UTC.
  -- Usar o horario local do banco erraria por 3 horas — o token nasceria
  -- vencido, ou valeria 3 horas a mais que a sessao que ele segue.
  l_exp := round((cast(sys_extract_utc(systimestamp) as date) - date '1970-01-01') * 86400)
           + (c_minutos * 60);

  -- Mesmo payload do widget. `p_base` e `p_portal` sao os que decidem: o
  -- primeiro escolhe a chave de validacao, o segundo precisa ser 'PO'.
  l_json := '{"p_usuario":'  ||apex_json.stringify(:P_USUARIO)
         || ',"p_empresa":'  ||apex_json.stringify(:P_EMPRESA_USER)
         || ',"p_matricula":'||apex_json.stringify(:P_MATRICULA_USER)
         || ',"p_perfil":'   ||apex_json.stringify(:P_PERFIL)
         || ',"p_portal":'   ||apex_json.stringify(:P_PAINEL)
         || ',"p_base":'     ||apex_json.stringify(:P_BASE)
         || ',"sid":'        ||apex_json.stringify(v('APP_SESSION'))
         -- FM sem mascara de grupo: em NLS pt_BR o padrao produziria
         -- "exp":1.755.000.000, que e JSON invalido, e o token seria recusado
         -- INTEIRO sem nada apontar para o numero como culpado.
         || ',"exp":'        ||to_char(l_exp, 'FM99999999999999')
         || '}';

  l_key   := utl_encode.base64_decode(utl_raw.cast_to_raw(c_key));
  l_pay   := utl_i18n.string_to_raw(l_json, 'AL32UTF8');
  l_mac   := dbms_crypto.mac(l_pay, dbms_crypto.hmac_sh256, l_key);
  l_token := 'kbt1h.'||b64url(l_pay)||'.'||b64url(l_mac);

  -- O token vai na querystring, como ja acontece no link da documentacao
  -- (`/docs/<slug>?kbt=...`). Nao ha cookie: cookie de terceiros dentro de
  -- iframe e bloqueado por padrao nos navegadores atuais, e depender dele
  -- quebraria a pagina em boa parte dos clientes.
  l_url := c_site||'/gestao?key='||c_widget||'&kbt='||l_token;

  htp.p('<iframe src="'||l_url||'" '
     ||'title="Gestao do assistente" '
     ||'style="width:100%;height:'||c_altura||'px;border:0;display:block;" '
     ||'referrerpolicy="strict-origin-when-cross-origin" '
     ||'loading="lazy"></iframe>');
end;


--------------------------------------------------------------------------------
-- DO LADO DA NATCORP, UMA VEZ (nao e por cliente)
--
-- O servidor so aceita ser embutido nos hosts que voce listar. Sem a variavel,
-- a pagina nao abre em iframe nenhum — falha fechada de proposito.
--
--   GESTAO_FRAME_ANCESTORS="https://apex.cliente-a.com.br https://erp.cliente-b.com.br"
--
-- Separados por espaco, com esquema (https://) e sem barra no fim. Depois de
-- alterar, reinicie a aplicacao (o cabecalho e montado no build/boot).
--------------------------------------------------------------------------------


--------------------------------------------------------------------------------
-- CONFERENCIA (depois de salvar a regiao e abrir a pagina)
--
-- 1) A pagina abre com o nome da base no canto direito do menu superior, e as
--    quatro abas: Consumo, Creditos, Acessos, Conversas.
--
-- 2) Se aparecer "Esta base ainda nao foi habilitada", o `c_key` nao foi
--    trocado ou a base ainda nao tem chave. Rode `npm run gestao:chave:prod`.
--
-- 3) Se aparecer "disponivel apenas no Painel do Operador", a pagina foi
--    colocada no painel errado — :P_PAINEL precisa valer 'PO'.
--
-- 4) Se o iframe ficar em branco, o host do APEX nao esta em
--    GESTAO_FRAME_ANCESTORS. O console do navegador mostra o erro de CSP.
--
-- 5) Deixe passar do tempo de sessao e recarregue o iframe: tem que aparecer
--    "Sua sessao no painel expirou. Atualize a pagina do APEX para continuar."
--    Se isso aparecer logo de cara, os relogios estao fora de sincronia:
--        select sys_extract_utc(systimestamp) from dual;   -- banco
--        date -u                                           -- servidor da app
--------------------------------------------------------------------------------
