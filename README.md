# Natcorp — Base de Conhecimento

Duas coisas num repositório só:

1. **Plataforma de base de conhecimento** — admin, portal público de
   documentação e widget embutível. Next.js (App Router) + Supabase + editor de
   blocos próprio.
2. **Chatbot de IA sobre o ERP Oracle APEX da Natcorp** — ~88 ferramentas de
   integração, RAG híbrido e isolamento por cliente.

O objetivo declarado do segundo é **assertividade acima de tudo**; velocidade e
custo vêm depois. E a regra de trabalho é **medir antes de mexer** — vários
"consertos óbvios" já foram tentados, medidos e revertidos, com o número anotado
no comentário do arquivo que você ia mexer.

## Por onde começar a ler

| Arquivo | O que responde |
|---|---|
| `CLAUDE.md` | contexto permanente. **A PARTE 0 é a que importa primeiro** |
| `docs/estado-e-proximos-passos.md` | o que está aberto HOJE e o que depende de decisão do dono |
| `docs/CODEBASE_MAP.md` | onde cada coisa mora, e as armadilhas que mais voltaram |

## Subir o ambiente

```bash
npm install
cp .env.local.example .env.local     # preencha Supabase e APP_ENCRYPTION_KEY
npm run dev                          # http://localhost:3000/admin
```

Provedor e chave de IA **não** ficam em variável de ambiente: vivem cifrados no
banco, configurados em **Admin → Sistema → IA**. As variáveis de IA no `.env`
são só fallback.

**O worker é um processo separado.** Importação de documento, geração de
embeddings, backup, captura de tela e varredura de ontologia são filas pg-boss —
sem o worker rodando, o job entra e nunca sai de `queued`:

```bash
npm run worker
```

## Verificação

```bash
npm run typecheck
npm run lint            # catraca de dívida de UI: falha se o contador SUBIR
npm test                # Vitest
npm run build
```

### E2E (Playwright) — leia antes da primeira vez

O navegador **não** vem com o `npm install`. Sem este passo a suíte não roda
localmente, e foi exatamente por isso que uma quebra do e2e sobreviveu dez dias:
a CI era o único lugar onde ela rodava, e falhava com uma mensagem que culpava o
servidor.

```bash
npx playwright install chromium
NEXT_PUBLIC_BASE_PATH= npm run build && NEXT_PUBLIC_BASE_PATH= npm run test:e2e
```

O `NEXT_PUBLIC_BASE_PATH=` é necessário porque o `.env` versionado é o de
produção e traz `/natcorp/ia`; o build assa esse prefixo e `/admin/login` na raiz
vira 404. Se esquecer, o guard do `playwright.config.ts` avisa com a linha de
comando pronta.

## Banco

Nenhuma alteração de schema fora de migration. Não há ledger — **toda migration
precisa ser idempotente e re-rodável**.

```bash
npm run migrate:apply -- supabase/migrations/<arquivo>.sql
```

## Medir

Este projeto não se melhora por raciocínio. Ao mudar superfície medida (funil de
ferramentas, RAG, chunker, prompt, resultado que vai ao modelo), **meça antes e
depois e diga o número**. A CI avisa o que foi tocado; ela não mede por você.

| Comando | Responde |
|---|---|
| `npm run eval:tools` | a ferramenta certa chega ao modelo? |
| `npm run eval:cenarios-modelo` | o modelo decide certo com o turno inteiro? |
| `npm run eval:comparar` | **o que mudou entre duas rodadas**, caso a caso |
| `npm run perf:latencia -- --dias 3` | onde o tempo vai (p50/p95, por passo) |
| `npm run rodada:e2e` | o que o cliente **paga** de fato, pela rota real |
| `npx tsx --env-file=.env.local .audit/sql.ts "select 1"` | SELECT read-only no banco real |

Toda rodada é gravada em `ai_eval_runs` com `git_sha`, flags e o **checksum do
gabarito** — dois placares de datas diferentes não se comparam sem isso, e
`eval:comparar` recusa a comparação quando o gabarito mudou.

**Armadilha conhecida:** `eval:tools` roda `simTools` + `selecionarTopK` com teto
próprio de 12, **não** o `buildIntegrationTools` de produção. Para medir o funil
ponta a ponta use `npm run eval:cenarios-modelo -- --funil`.

## Antes de começar, confira o disco

O Bash para por inteiro quando o disco enche — nem a saída dos comandos grava.
Já aconteceu quatro vezes.

```bash
df -h /
```
