# Teste de endpoints (APIs / tools)

Testa todos os endpoints **GET** das tools ativas contra a API real, usando os valores de
`fixture.json`. Reporta só o **status** (nunca os dados). **Não** executa escritas
(POST/DELETE) — evita efeito colateral (saque, eSocial, etc.).

## Rodar

```bash
scripts/endpoint-test/run.sh
```

## Editar / adicionar itens

Tudo mora em `fixture.json` (não versionado — contém PII):

- **`identity`** — o usuário logado que roda o teste (`usuario`, `cod_empresa`, `matricula`, `portal`).
- **`params`** — valores por conceito. O runner casa o **nome do parâmetro** de cada tool com estas chaves:
  `empresa`, `matricula` (colaborador-alvo), `cpf`, `data_ini`, `data_fim`, `data_ref`, `ano`,
  `cod_candidato`, `filial`, `centro_custo`, `unidade`, `sindicato`, `situacao`, `vinculo`,
  `cnpj`, `email`, `cep`, `agrupamento`, `tipo_lista`, `fato`.
- **`requisicoes`** — nº de requisição por **tipo**; o runner casa o tipo pela **chave da tool**
  (ex.: `requisicoes_req_desligamento` → `desligamento`).

Um parâmetro que o runner não souber preencher aparece como **"precisa-parâmetro"** no
relatório — é só adicionar o valor aqui e rodar de novo.

## Categorias do relatório

- **OK** — 2xx.
- **PATH_404** — caminho provavelmente errado (`path_template`).
- **AUTH** — 401/403 (permissão do usuário ou auth da tool).
- **SERVER_5xx** — exceção no handler (ORDS/PL-SQL) — provável parâmetro faltando não declarado, ou bug.
- **TIMEOUT / ERROR** — inalcançável / lento.
- **NEEDS_PARAM** — falta um valor no fixture (não é problema do endpoint).
