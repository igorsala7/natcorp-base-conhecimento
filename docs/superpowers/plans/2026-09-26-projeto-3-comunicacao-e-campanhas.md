# Projeto 3 — Comunicação e campanhas: plano de implementação

> **Para executores:** use superpowers:subagent-driven-development. Os passos usam
> caixa (`- [ ]`) para rastreio.

**Goal:** o cliente agenda e dispara alertas que aparecem no chatbot para quem ele
escolher, e vê quem visualizou cada um.

**Architecture:** nenhuma peça nova de infraestrutura. A elegibilidade é o motor do
projeto 0 (doze dimensões, `public.elegivel`), a entrega usa o `/api/v1/config` que o
widget já chama na abertura com o token, e o agendamento é um PREDICADO de consulta, não
um job. A tela é uma aba nova na área do cliente, ao lado de Conteúdo.

**Tech Stack:** Postgres/Supabase, Next.js App Router, o widget existente.

**Spec:** `docs/superpowers/specs/2026-09-24-separacao-ia-documentacao-design.md`,
seção "Projeto 3 — Comunicação e campanhas".

## Global Constraints

- **Nenhuma tela pode exibir percentual, taxa de leitura ou "lidos × não lidos".**
  Decisão do dono em 24/09, e o motivo é aritmético: não existe cadastro de usuários em
  tabela nenhuma, e o único universo disponível é "quem já usou o chatbot" (a maior base
  conhece **7 usuários distintos**). Qualquer denominador mediria adoção do chatbot
  parecendo medir alcance da campanha. O painel mostra **quem visualizou**, e não tenta
  mostrar quem não visualizou. A porta para a versão completa é buscar o roster no ERP,
  uma consulta por campanha e não por turno.
- **Elegibilidade é `regra jsonb` avaliada por `public.elegivel(regra, identidade)`.**
  Nunca colunas de array novas, nunca segunda implementação. As doze dimensões vêm de
  `public.dimensoes_elegibilidade()` e de `src/lib/elegibilidade/dimensoes.ts`.
- **A identidade só é montada por `identidadeDoRastreio`.** Nunca à mão.
- **O corte é em SQL, nunca no prompt e nunca no cliente**, porque `widget.js` é público.
  Um cliente jamais recebe alerta de outro, e um usuário jamais recebe alerta para o qual
  não é elegível.
- **Nenhuma alteração de schema fora de migration**, idempotente e re-rodável (não há
  ledger). `create or replace` quando a assinatura não muda; `drop function` só quando muda.
- **`revoke all on function f(args) from public, anon;`** em função nova, mais
  `grant execute to service_role`. Revogar só de `anon` é no-op porque PUBLIC inclui `anon`.
- Portão antes de cada commit: `npx tsc --noEmit`, `npx eslint <arquivos>`,
  `npx vitest run`, `npm run verificar:elegibilidade`, `npm run verificar:ui`,
  `npm run verificar:isolamento`, `npm run verificar:rpc`,
  e `NEXT_PUBLIC_BASE_PATH= npm run build`.

---

### Tarefa 1: as duas tabelas e a função de entrega

**Files:**
- Create: `supabase/migrations/<data>_campanhas.sql`

**Interfaces:**
- Consumes: `public.elegivel`, `public.regra_valida`, `ai_bases`.
- Produces: `public.alertas_para(p_base text, p_identidade jsonb)` devolvendo os alertas
  ativos e elegíveis daquela identidade, e `public.registrar_visualizacao(...)`.

`ai_campanhas`: `id`, `base_id references ai_bases(id) on delete cascade`, `titulo`,
`corpo`, `regra jsonb not null default '{}'::jsonb check (public.regra_valida(regra))`,
`publicar_em timestamptz not null`, `encerrar_em timestamptz null`, `enabled boolean not
null default true`, `criada_por text`, `created_at`, `updated_at`.

**O agendamento é um predicado, não um job.** Um alerta está ativo quando
`enabled and publicar_em <= now() and (encerrar_em is null or encerrar_em > now())`. Isso
elimina a peça que mais quebra num sistema de notificação: não há worker para atrasar, não
há estado "devia ter disparado e não disparou", e reprocessar não duplica nada. Escreva o
motivo no comentário, porque a primeira pessoa que olhar vai querer criar uma fila.

`ai_campanha_visualizacoes`: `campanha_id references ai_campanhas(id) on delete cascade`,
mais as colunas de identidade que o rastreio traz (`p_usuario`, `p_matricula`, `p_empresa`,
`p_portal`, `p_perfil`), `visto_em timestamptz not null default now()`, e
**`unique (campanha_id, p_usuario, p_matricula)`** para o mesmo usuário não contar duas
vezes. Onde `p_usuario` e `p_matricula` vierem nulos, a linha registra a visualização
anônima e não entra no drilldown por pessoa: dizer "alguém viu" é verdade, inventar quem
não é.

RLS nas duas exigindo `ai.configure` para o caminho autenticado, e `revoke` de `anon` e
`public` nas duas funções, com `grant` só a `service_role`.

**Assertiva comportamental obrigatória**, em transação com `rollback` e prefixo `zz-`:
alerta com `publicar_em` no futuro **não** sai; alerta de outra base **não** sai; alerta
restrito por portal não sai para a identidade errada e sai para a certa; e a mesma
visualização gravada duas vezes conta uma.

### Tarefa 2: o widget recebe e reporta

**Files:**
- Modify: `src/app/api/v1/config/route.ts`
- Create: `src/app/api/v1/alertas/visto/route.ts`
- Modify: `public/widget.js`

`/api/v1/config` já decodifica o token e já tem a identidade (`route.ts:54`). Ele passa a
devolver os alertas ativos e elegíveis, chamando `alertas_para` com a identidade de
`identidadeDoRastreio`. Nenhum endpoint novo para ler: a abertura do widget já faz essa
chamada, e acrescentar uma segunda seria latência a mais no caminho que o usuário sente.

`POST /api/v1/alertas/visto` grava a visualização. Mesmo portão do resto da API v1: chave
pública, allowlist de origem, rate limit, e a identidade do token — **nunca** do corpo.

No `widget.js`: o alerta aparece como primeira mensagem ao abrir, e a visualização é
reportada **quando ele é renderizado**, não quando o servidor o entrega. Servir não é
visualizar: o painel pode estar fechado. Essa distinção é a diferença entre um número que
significa algo e um que mede entrega.

### Tarefa 3: a aba Comunicação na área do cliente

**Files:**
- Create: `src/app/gestao/comunicacao/page.tsx`, `actions.ts`
- Create: `src/components/gestao/comunicacao-painel.tsx`
- Modify: `src/components/gestao/shell.tsx`

Segue o padrão de `src/app/gestao/conteudo/`, com as mesmas travas, que naquele caminho são
a única cerca que existe (a área do cliente escreve com `service_role`, que ignora RLS):
base da sessão e nunca do formulário; validação da regra com `chavesProblematicasDaRegra`
**antes** de `normalizarRegra`; recusa quando a regra não alcança ninguém; e `audit_log` em
toda escrita.

A tela: lista de campanhas com estado (agendada, ativa, encerrada), a frase de
`resumoElegibilidade` ao vivo por campanha, o aviso de presença por dimensão, e o
formulário de alcance reaproveitando `dimensao-editor`. Os quatro estados obrigatórios.

**A parte que a especificação proíbe, e que a tela tem de ativamente não fazer:** nenhum
percentual, nenhuma taxa, nenhum gráfico de lidos contra não lidos. O painel de uma
campanha mostra a contagem de quem visualizou e a lista de quem visualizou, e uma linha
dizendo por que não existe "não visualizaram": não há cadastro de usuários, e o número
pareceria medir alcance enquanto media adoção do chatbot.

### Tarefa 4: o drilldown e a prova de isolamento

**Files:**
- Modify: `src/components/gestao/comunicacao-painel.tsx`
- Modify: `.audit/isolamento-documentacao-e2e.ts`

O drilldown de uma campanha lista quem visualizou, com data, e permite filtrar pelas
dimensões que a identidade traz. Cuidado com o teto de 1.000 linhas do PostgREST:
`.order("id")` antes do `.range()`, que é o defeito que mais voltou neste repositório.

E o arreio ganha os casos de campanha: alerta da base A não aparece para a base B,
visualização da base A não aparece no painel da base B, e a sabotagem correspondente
(anexar a campanha de B à base A) tem de fazer o script FALHAR. Sem isso, a cerca de
campanha é revisão de código e não banco.
