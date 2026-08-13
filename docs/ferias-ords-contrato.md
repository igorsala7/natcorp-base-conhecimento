# Solicitação de férias pelo chat — contrato das APIs ORDS

Especificação para o time Oracle implementar `PKG_API_FERIAS` + os módulos ORDS que
o Agente de IA vai consumir. Derivada da leitura de:

- `f200_page_78-2.sql` — página APEX onde a solicitação é feita hoje
- `pkg_ferias.sql` — validações, cálculos e processos
- `f2973_page_1.sql` — modal de confirmação de aprovação/reprovação
- `prc_insere_aprovador.sql`, `prc_atualiza_req.sql`, `pkg_aprovacao_coletiva.sql` — o workflow

**Princípio:** nenhuma regra de negócio sai do Oracle. `PKG_API_FERIAS` é casca —
orquestra a mesma sequência de chamadas que a cascata de Dynamic Actions da página 78
executa, converte os parâmetros `IN OUT` em JSON e tipa as mensagens. Se a Natcorp
mudar um parâmetro de férias amanhã, o chat acompanha sem deploy do nosso lado.

---

## 1. Convenções

### 1.1 Identidade

Todo endpoint recebe a identidade da pessoa nos mesmos seis valores que a aplicação
usa. Eles já viajam no token de rastreio do chat.

| Campo | Origem | Observação |
|---|---|---|
| `p_usuario` | `usuario_oracle.nm_usuario_oracle` | resolvido por `(cd_empresa, cd_matricula)`. **Não** usar `'PORTAL'` nem `'CHAT'` — `pkg_aprovacao_coletiva.executa` resolve o perfil por este nome |
| `p_empresa_user` | identidade | |
| `p_matricula_user` | identidade | |
| `p_perfil` | `usuario_oracle.cd_perfil` | |
| `p_painel` | `PO` \| `PG` \| `PC` | mesma semântica das LOVs da página 78 |
| `p_base` | multi-tenant | `pkg_req.VALIDA_EXISTE_APROV` só roda quando `P_BASE = 'STEFANINI'` |
| `p_app_id` | **opcional** | dispensa a busca pelo alias quando a convenção `painel_base` não vale naquela instalação |

O handler deve estabelecer a sessão APEX antes de chamar o legado
(`apex_session.create_session` + `apex_util.set_session_state` dos seis itens acima,
`apex_session.delete_session` no fim). Motivo: `usuario.busca_user` devolve
`P_USUARIO`; sem sessão o carimbo de `usuario` na conclusão se perde
(`PRC_ATUALIZA_REQ` l.1012 e l.1060) e, dependendo da implementação de `busca_user`,
pode levantar exceção e derrubar a conclusão.

**Qual aplicação APEX.** O id é numérico e **muda de base para base** — não pode ser
constante em lugar nenhum. O que é estável é o **alias**, pela convenção
`painel + '_' + base`: `PO_NATCORP`, `PG_NATCORP`, `PC_NATCORP`. Como
`apex_session.create_session` só aceita id, o alias é traduzido por consulta a
`APEX_APPLICATIONS`. Instalação com outra convenção manda `identidade.p_app_id` e a
busca pelo alias nem acontece.

`p_page_id = 78`: a página de férias tem o **mesmo número nos três painéis**. Nada aqui
renderiza página — a sessão existe só para o estado — mas usar a página real deixa a
sessão idêntica à que a tela cria, inclusive para quem leia `v('APP_PAGE_ID')`.

### 1.2 Escopo por painel

Igual à LOV `pkg_list_matricula.fnc_list2(cod_empresa, p_painel, p_empresa_user, p_matricula_user)`:

- `PC` — só a própria matrícula. O endpoint **ignora** qualquer matrícula recebida e usa a da identidade.
- `PG` — matrículas da equipe.
- `PO` — conforme a LOV.

### 1.3 Códigos HTTP

| Situação | HTTP | Corpo |
|---|---|---|
| Regra de negócio recusou (saldo insuficiente, data inválida, fora de prazo) | **200** | `ok: false` + `mensagens` |
| Falha técnica (Oracle fora, `ORA-`, timeout) | 5xx | `ok: false` + `erro_tecnico` |
| Identidade sem permissão para a matrícula pedida | 403 | `ok: false` |

Recusa de negócio é **200 de propósito**: para o chat é um turno normal de conversa, não
um erro. Se voltar 4xx o modelo trata como falha de ferramenta e muda de assunto.

### 1.4 Mensagens

Toda procedure de `pkg_ferias` devolve `pflg_retorno` + `pmsg_retorno`. A tradução é direta:

| `pflg_retorno` | `tipo` | O que o chat faz |
|---|---|---|
| `'N'` | `erro` | não segue; explica e pede outro valor |
| `'S'` **com** `pmsg_retorno` | `aviso` | segue, mas **precisa dizer** o aviso à pessoa |
| `'Q'` | `confirmar` | pergunta e só segue com o "sim" |

```json
"mensagens": [
  { "campo": "dt_saida_parc1", "tipo": "aviso",
    "texto": "Feriado no dia escolhido! A data de saída foi alterada para 03/09/2026." },
  { "campo": "dt_saida_parc1", "tipo": "confirmar", "chave": "dt_saida_parc1.dt_ref_folha",
    "texto": "A data de saída é maior que a data de referência da folha. Deseja continuar?" }
]
```

`chave` é um slug estável emitido pelo wrapper. A próxima chamada devolve as chaves
aceitas em `confirmacoes: []`; quando a chave está na lista, o wrapper trata aquele
`'Q'` como `'S'` e segue — é o equivalente do `alertify.confirm` da página.

**Nunca devolver `SQLERRM` cru para o campo `texto`.** Quase toda procedure tem
`WHEN OTHERS THEN pmsg_retorno := '... ' || SQLERRM`. Erro técnico vai em
`erro_tecnico` (que o chat não repete) e o `texto` recebe uma frase neutra.

---

## 2. Endpoints

### 2.1 `GET /ferias/situacao`

Abre a conversa. Equivale a escolher a matrícula na página 78.

**Entrada:** identidade + `matricula` (opcional; `PC` ignora).

**Por dentro:** `pkg_ferias.Valida_Matricula_Solicitado` → `pkg_req_ferias.pg78_carrega`
→ leitura de `dt_limite_req`, `meses_adm`, jornada reduzida, vínculo, filial, e do campo
de cadastro `ACAO_JUDICIAL`.

```json
{
  "ok": true,
  "colaborador": { "cod_empresa": 1, "matricula": 12345, "nome": "…",
                   "filial": 1, "vinculo": "…", "meses_adm": 37,
                   "jornada_reduzida": "N", "falta_hora": "N" },
  "periodo":     { "dt_inic_per_ferias": "2025-03-01", "dt_fim_per_ferias": "2026-02-28",
                   "ind_situacao_periodo": "P" },
  "saldo":       { "saldo": 30, "saldo_bruto": 30 },
  "prazos":      { "dt_limite_req": "2026-12-15", "parcelas_opc": 3 },
  "mensagens": []
}
```

Avisos esperados aqui: período em dobro, ação judicial (férias compulsórias),
requisição já existente no mesmo período (`'S'` com texto dizendo que a nova, se
aprovada, cancela a anterior), aprovadores não parametrizados.

### 2.2 `GET /ferias/opcoes`

O catálogo do que é válido — **não é texto livre**.

**Por dentro:** `pkg_list.fnc_list_opc_prog_ferias`,
`pkg_list_matricula.fnc_list_numdias`, e `FERIAS_PARAMETROS_PARCELAS` para os abonos.

```json
{
  "ok": true,
  "opcoes_ferias": [ { "valor": "1", "texto": "30 dias em parcela única" },
                     { "valor": "2", "texto": "20 + 10 dias" } ],
  "num_dias":      { "parc1": [30, 20, 15], "parc2": [10, 15], "parc4": [] },
  "dias_abono":    { "parc1": [0, 10], "parc2": [0], "parc4": [] },
  "obrigatorio":   { "abono_parc1": false, "opcao_ferias": true }
}
```

Isso é o que permite ao agente **oferecer** as combinações em vez de aceitar
"quero 15 dias" e apanhar de `funcFeriasParamParcela_APEX` depois
("Quantidade de dias não encontrada na parametrização").

### 2.3 `POST /ferias/simular`

O coração. Recebe o rascunho inteiro, roda a bateria, devolve **o rascunho recalculado**.

Stateless de propósito: o rascunho vive na conversa, do nosso lado. Evita tabela de
rascunho no ERP (e a rotina de limpeza dela), e é seguro porque `/criar` revalida tudo
do zero — exatamente como o `AFTER_SUBMIT` da página 78 já faz.

**Entrada:**

```json
{
  "cod_empresa": 1, "matricula": 12345,
  "opcao_ferias": 2,
  "dt_inic_per_ferias": "2025-03-01", "dt_fim_per_ferias": "2026-02-28",
  "parcelas": [
    { "n": 1, "dt_saida": "2026-09-01", "num_dias": 20,
      "dias_abono_pec": 0, "opcao_abono_pec": "N", "opcao_13sal": "N" },
    { "n": 2, "dt_saida": "2026-12-01", "num_dias": 10,
      "dias_abono_pec": 0, "opcao_abono_pec": "N", "opcao_13sal": "S" }
  ],
  "desc_adicional": 0,
  "havera_rep": "N",
  "campo_alterado": "parcelas[0].dt_saida",
  "confirmacoes": []
}
```

`campo_alterado` reproduz o disparo por Dynamic Action: o wrapper roda a cadeia a
partir dali. Ausente = roda a cadeia inteira.

**Ordem das chamadas** (a mesma da página; confirmar assinaturas na implementação):

| Campo alterado | Sequência |
|---|---|
| `opcao_ferias` | `funcFeriasParamParcela_APEX` |
| `parcelas[n].dt_saida` | `Valida_Dt_Saida_Parc{1\|2\|4}` → (internas: `Vld_Ferias_Dobro`, `Vld_Per_Meses`, `VALIDA_DT_SAIDA`, `Vld_Primeira_Parcela`, `lanc_abono_p1`, `vld_saldo1`, `retorna_dt_pagto`, `prc_verif_limite_agend_ferias`) |
| `parcelas[n].num_dias` | `Valida_Num_Dias_Parc{1\|2\|4}` → `Dias_Parc1`, `lanc_abono_p1` |
| `parcelas[n].dias_abono_pec` | `Valida_Dias_Abono_Pec1` / `Valida_Abono_Pec{2\|4}` |
| `parcelas[n].opcao_13sal` | `Valida_Opcao_13Sal{1\|2\|4}` |
| `desc_adicional` | `Valida_Desc_Adicional{1\|2\|4}` |
| — sempre ao fim | `Valida_Dt_Retorno_Parc*`, `Valida_Tipo_Ferias1` |

**Saída — devolve o estado, não `ok`.** As validações são `IN OUT`: elas *calculam* e
*alteram*. `VALIDA_DT_SAIDA` chega a mover a data de saída (`v_dt_saida := v_dt_saida + 1`
quando o dia é feriado e `proximo_dia = 'S'`).

```json
{
  "ok": true,
  "estado": {
    "opcao_ferias": 2,
    "parcelas": [
      { "n": 1, "dt_saida": "2026-09-02", "num_dias": 20, "dias_abono_pec": 0,
        "opcao_abono_pec": "N", "opcao_13sal": "N",
        "dt_retorno": "2026-09-22", "dt_pagto": "2026-08-31", "tipo_ferias": "N" }
    ],
    "saldo": { "dias_direito": 30, "saldo": 10, "dias_distribuidos": 20 }
  },
  "mensagens": [ { "campo": "parcelas[0].dt_saida", "tipo": "aviso",
                   "texto": "Feriado no dia escolhido! A data de saída foi alterada para 02/09/2026." } ],
  "pronto_para_criar": false,
  "pendencias": ["parcelas[1].dt_saida não informada"]
}
```

`pronto_para_criar` só vira `true` quando a bateria inteira passa. É o que o agente lê
para saber se pode oferecer "confirmar".

### 2.4 `POST /ferias/criar`

**Escrita.** Atrás do guard `confirmation_detalhada` no nosso lado.

**Por dentro, numa única transação, commit só no fim:**

1. revalida a bateria completa (nunca confiar no que veio do cliente)
2. `seq_requisicao.NEXTVAL` → `cod_solicitacao`; `sit_requisicao = 1`
3. `pkg_ferias.Pre_Insert`
4. `INSERT INTO REQUISICAO_FERIAS`
5. `PRC_INSERE_APROVADOR(cod_solicitacao, 'REQ_FERIAS', flg, msg)`
6. `PRC_ATUALIZA_REQ(cod_empresa, cod_solicitacao, flg, msg)`
7. **relê** `REQUISICAO_FERIAS.sit_requisicao` e `APROVA_FERIAS`

O passo 7 não é zelo: `PRC_INSERE_APROVADOR` no ramo férias lê
`ferias_parametros.workflow_1/workflow_2` e **só chama `pkg_req.propostas_req_ferias`
se a janela bater** (l.284-301). Quando não bate, a única linha em `APROVA_FERIAS` é a
do próprio solicitante, já `'A'` — aí o `PRC_ATUALIZA_REQ` do passo 6 não encontra `'P'`,
**conclui na hora** e grava na tabela `FERIAS` (a programação real na folha).

```json
{
  "ok": true,
  "cod_solicitacao": 57463,
  "sit_requisicao": 1,
  "ja_concluida": false,
  "aprovadores": [
    { "seq": 1, "cod_empresa": 1, "matricula": 12345, "nome": "Solicitante",  "status": "A" },
    { "seq": 2, "cod_empresa": 1, "matricula": 999,   "nome": "Gestor Fulano","status": "P" }
  ]
}
```

Regra de fala do agente: quando `ja_concluida = true`, dizer
*"Solicitação nº 57463 criada com sucesso e **já concluída**."* Caso contrário, sucesso
seco, sem prometer prazo nem prever aprovador.

### 2.5 `GET /ferias/minhas`

Leitura. Requisições do solicitante com situação e em quem está parada.
`sit_requisicao`: `1` Aberta · `2` Concluída · `3` Cancelada · `4` Reprovada · `5` Aprovada · `6` Suspensa.

### 2.6 `GET /ferias/aprovacoes`

Pendentes **para mim**. A consulta tem que reproduzir a mesma união que as condições de
exibição dos botões da página 78 e o cursor `c_suplente_aprova` de
`pkg_aprovacao_coletiva.req_ferias` (l.583-602) usam:

- aprovador direto em `APROVA_FERIAS` com `status_aprov = 'P'`
- **suplente** — `centro_de_custo.cod_emp_suplente` / `matricula_suplente`
- **substituto** — `sub_ccusto.COD_EMP_SUBS` / `MAT_SUBS`
- suplente do centro de custo superior

Se a lista usar só o aprovador direto, o suplente simplesmente não enxerga o que pode aprovar.

Para **cada** item, chamar `pkg_ferias.Valida_Sequencia(cod_empresa, solicitacao, emp_aprov, mat_aprov, flg, msg)`:

```json
{
  "ok": true,
  "itens": [
    { "cod_solicitacao": 57463,
      "colaborador": { "matricula": 12345, "nome": "…" },
      "periodo": { "dt_inic_per_ferias": "2025-03-01", "dt_fim_per_ferias": "2026-02-28" },
      "parcelas": [ { "n": 1, "dt_saida": "2026-09-02", "dt_retorno": "2026-09-22", "num_dias": 20 } ],
      "minha_vez": true,
      "motivo_bloqueio": null,
      "sou_ultimo_aprovador": true,
      "aprovadores_pendentes": 1 }
  ]
}
```

`sou_ultimo_aprovador` permite ao chat dizer **"ao aprovar, as férias vão para a folha"** —
que é a verdade (a conclusão chama `insere_ferias`) e é mais do que o modal do APEX diz.

### 2.7 `POST /ferias/aprovacoes/{cod_solicitacao}`

**Escrita.** Guard `confirmation_detalhada`. `justificativa` é **obrigatória** — é validação
da própria página 2973 (`"A justificativa é obrigatória!"`).

```json
{ "status": "A", "justificativa": "Aprovado, equipe coberta no período." }
```

**Por dentro:**

1. `justificativa` vazia → `ok: false` **antes** de qualquer chamada
2. `pkg_ferias.Valida_Sequencia(...)` → se `'N'`, devolve `ok: false` com o motivo.
   **Isto é obrigatório aqui:** `pkg_aprovacao_coletiva.executa` **não** confere a ordem —
   na aplicação a `Valida_Sequencia` só decide se o botão aparece.
3. lê `APROVA_FERIAS` (estado antes)
4. `pkg_aprovacao_coletiva.executa(cod_req, status, empresa, matricula, usuario, justificativa, flg, msg)`
5. lê `APROVA_FERIAS` + `REQUISICAO_FERIAS.sit_requisicao` (estado depois)
6. responde pelo **estado observado**, nunca pelo `pflg_retorno`

O passo 6 existe porque `req_ferias` faz
`update aprova_ferias ... where status_aprov = 'P' and cod_emp_aprov = ? and mat_aprov = ?`
(l.659-665) e **não olha `SQL%ROWCOUNT`**. Zero linhas afetadas devolve `'S'` do mesmo
jeito — o chat diria "aprovado com sucesso" sem nada ter acontecido.

```json
{
  "ok": true,
  "registrou": true,
  "efeito": "concluida",
  "sit_requisicao": 2,
  "aprovadores_pendentes": 0,
  "proximo_aprovador": null,
  "aviso_folha": "As férias foram efetivadas na folha."
}
```

`efeito`: `concluida` · `reprovada` · `aguardando_proximo` · `nenhum_efeito`.

`registrou: false` + `efeito: "nenhum_efeito"` é o caso do passo 6 — responder
*"não consegui registrar sua aprovação; verifique se ela ainda está pendente para você"*.

### 2.8 `POST /ferias/reprocessar/{cod_solicitacao}`

Rede de recuperação. Chama **só** `PRC_ATUALIZA_REQ` e relê o estado.

Existe porque não há transação para desfazer: `executa` commita (l.389) e `req_ferias`
commita por dentro (l.666 e 685) **antes** de `pkg_ferias.post_update`. O `rollback` do
`exception` da página 2973 não desfaz nada disso. Se `post_update` falhar, a aprovação
fica gravada e o fluxo não anda — requisição "Aberta" com todos os aprovadores em `'A'`.

Repetir é seguro: com `sit_requisicao = 2` o `Trata_Ferias` cai fora do `if ... in (1,5)`
e não faz nada.

Não exposto como ferramenta do chat — uso administrativo.

---

## 3. Máquina de estados

`PRC_ATUALIZA_REQ → Trata_Ferias` (l.985-1097) decide **só** olhando `APROVA_FERIAS`:

| Estado em `APROVA_FERIAS` | Resultado |
|---|---|
| existe algum `'R'` | `sit_requisicao = 4` — Reprovada |
| existe algum `'P'` (e nenhum `'R'`) | nada muda — segue `1`, Aberta |
| nenhum `'P'` nem `'R'` | `EXCLUI_PARCELAS` → `insere_ferias` → `sit_requisicao = 2` |

`insere_ferias` grava na tabela **`FERIAS`**. A conclusão não é status de tela: é o
momento em que as férias entram na folha.

`PRC_INSERE_APROVADOR` sempre insere o **solicitante** como `seq_aprov = 1, status 'A'`
(l.253-272). O primeiro aprovador de verdade é `seq 2`.

Depois de todo `executa` bem-sucedido roda `NATCORP.PRC_OPERADOR_APROVA_TODOS`
(l.392-397), que pode aprovar em cascata — o passo 5 do 2.7 é o que enxerga o efeito dela.

---

## 4. As ferramentas do chat

Cinco, não vinte. Expor cada procedure como ferramenta obrigaria o modelo a dirigir uma
máquina de estados de 25 campos que ele não enxerga.

| Ferramenta | Endpoint | Guard | Escrita |
|---|---|---|---|
| `ferias_situacao` | 2.1 | `escopo_painel` | não |
| `ferias_opcoes` | 2.2 | `escopo_painel` | não |
| `ferias_simular` | 2.3 | `escopo_painel` | não |
| `ferias_criar` | 2.4 | `confirmation_detalhada` | **sim** |
| `ferias_aprovar` | 2.7 | `confirmation_detalhada` | **sim** |

`panel_scope.PCAND = nenhum` nas cinco: candidato não tem férias.

### Regra no prompt

> Datas, quantidade de dias, dias de abono, data de retorno e data de pagamento **vêm
> da ferramenta**. Você nunca calcula nem sugere um valor que não apareceu na resposta
> dela. Se a ferramenta alterou o que a pessoa pediu (feriado, saldo, parametrização),
> **diga que alterou e por quê**. Nunca ofereça uma combinação de dias que não esteja
> em `ferias_opcoes`.

---

## 5. Fases

1. **Só leitura** — 2.1, 2.5, 2.6. Risco zero, valor imediato ("quantos dias eu tenho?",
   "minha requisição está parada em quem?") e prova o encanamento de identidade e escopo.
2. **Simulação sem gravar** — 2.2 + 2.3. A conversa inteira acontece e termina em
   "ficaria assim", sem insert. É onde se descobre se o modelo dirige o round-trip,
   comparando com a página 78 nos mesmos dados.
3. **Gravação** — 2.4, atrás da confirmação e **limitada a um grupo piloto** (allowlist
   de matrículas) antes de liberar geral.
4. **Aprovação** — 2.7.

## 6. Aceite

Para cada fase, o mesmo conjunto de entradas na página 78 e no chat tem que produzir
**o mesmo registro**. Casos que precisam estar na bateria:

- data de saída em feriado com `proximo_dia = 'S'` → a data volta alterada e o chat **avisa**
- combinação de dias fora de `FERIAS_PARAMETROS_PARCELAS` → recusa com a mensagem da parametrização
- 13º já usado no ano → recusa em `Valida_Opcao_13Sal*`
- requisição que **nasce concluída** (`workflow_1/2` fora da janela) → `ja_concluida: true`
  e o chat diz que já está concluída
- aprovação **fora de sequência** → recusada por `Valida_Sequencia`, sem chamar `executa`
- aprovação por quem **não é aprovador** → `registrou: false`, e o chat não diz "aprovado"
- aprovação por **suplente** → registra na linha do gestor, justificativa com o prefixo
  `"(Aprovado por …)"`
- **última** aprovação → `efeito: "concluida"`, `sit_requisicao = 2`, e existe linha nova em `FERIAS`

## 7. Em aberto

- Fonte do pacote `usuario` (`busca_user`) — decide se a sessão APEX no handler é
  conveniência ou requisito. Recomendação: criar a sessão de qualquer forma.
- `NATCORP.PRC_OPERADOR_APROVA_TODOS` — o que aprova em cascata, para o chat não
  prometer um próximo passo que não vai existir.
- Cancelamento de requisição fica **fora desta rodada**: tem regra própria
  (`PERMISSAO_CANC_REQ_CONCLUIDA`, que compara o usuário com a literal `'PORTAL'`,
  `EXCLUI_PARCELAS`, prazo de `dias_antes_pagto_ferias`).
