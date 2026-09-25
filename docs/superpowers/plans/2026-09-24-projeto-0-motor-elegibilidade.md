# Projeto 0 — Motor de elegibilidade: plano de implementação

> **Para executores agênticos:** SUB-SKILL OBRIGATÓRIA: use
> superpowers:subagent-driven-development (recomendado) ou
> superpowers:executing-plans para implementar tarefa por tarefa. Os passos usam
> caixa de marcar (`- [ ]`) para acompanhamento.

**Objetivo:** uma só implementação de "quem alcança isto", em doze dimensões, e
os seis parâmetros de rastreio que faltam para avaliá-la.

**Arquitetura:** a regra vive em dois lugares porque precisa: em SQL, porque o
corte tem de acontecer no banco (`widget.js` é público), e em TypeScript, porque
a tela mostra a frase enquanto o admin digita. As duas lêem o MESMO arquivo de
casos e um script falha se discordarem. Nada de tela nova nesta rodada.

**Stack:** Postgres (migrations idempotentes via `npm run migrate:apply`),
TypeScript strict, Vitest, PL/SQL no bloco APEX.

**Spec:** `docs/superpowers/specs/2026-09-24-separacao-ia-documentacao-design.md`

## Restrições globais

- **Nenhuma alteração de schema fora de migration**, e toda migration precisa
  ser idempotente e re-rodável (não há ledger). Aplicar com
  `npm run migrate:apply -- <arquivo>`.
- **As doze dimensões, nesta ordem e com estes nomes exatos:** `base`, `portal`,
  `perfil`, `usuario`, `empresa`, `matricula`, `filial`, `centro_custo`,
  `unidade_adm`, `unidade_negocio`, `vinculo`, `sindicato`.
- **Semântica:** dentro de uma dimensão OU, entre dimensões E,
  `lower(btrim())` dos dois lados, lista efetivamente vazia = liberado, valor
  ausente contra dimensão restrita = FECHA.
- **Toda dimensão é singular** (a alocação da pessoa, não o que ela gerencia).
- `p_cod_candidato` **não** é dimensão de elegibilidade.
- **Build de verificação:** `NEXT_PUBLIC_BASE_PATH= npm run build`. O `.env`
  versionado injeta `basePath` de produção e contamina o build local.
- **Nunca rodar `npm run build` com o `next dev` do usuário de pé** (sobrescreve
  chunks em uso). Se precisar, `NEXT_DIST_DIR=.next-verify npm run build`.
- Portão antes de cada commit: `npx tsc --noEmit`, `npx eslint <arquivos>`,
  `npx vitest run`, `npm run verificar:ui`.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/elegibilidade/dimensoes.ts` | a lista das doze, o tipo, o mapa de/para chave de rastreio. Puro, sem dependência. |
| `src/lib/elegibilidade/alcanca.ts` | o predicado. Puro. |
| `src/lib/elegibilidade/frase.ts` | a frase em português (absorve `resumoElegibilidade` e `avisoDeAlcance`). Puro. |
| `src/lib/elegibilidade/index.ts` | reexporta os três. É o que o resto do produto importa. |
| `src/lib/elegibilidade/casos.json` | o corpus compartilhado: entrada, regra, resultado esperado. Lido pelo teste TS e pelo script de paridade. |
| `scripts/verificar-elegibilidade.ts` | roda o corpus contra `public.elegivel` no banco e compara com o predicado TS. |
| `supabase/migrations/20260924230000_allowlist_casa_branco.sql` | corrige o furo do vazio em `allowlist_casa`. |
| `supabase/migrations/20260924231000_rastreio_seis_dimensoes.sql` | seis colunas em `conversations` + `public.elegivel`. |
| `supabase/migrations/20260924232000_vocabulario_doze_dimensoes.sql` | `vocabulario_rastreio` passa de duas para doze dimensões. |
| `src/lib/chat/tracking.ts` | `TRACKING_KEYS` de sete para treze. |
| `apex/token-rastreio.sql` | os seis campos novos no token, e `varchar2` maior. |

`src/lib/prompts/elegibilidade.ts` é **apagado** na tarefa 7; quem o importa
passa a importar `@/lib/elegibilidade`.

---

### Tarefa 1: fechar o furo do vazio em `allowlist_casa`

Esta vem primeiro porque é um defeito **em produção hoje**, independente do
resto do projeto, e cabe numa migration de dez linhas.

O furo, provado contra a função viva em 24/09:

```
allowlist_casa(array['PG'], null)     -> false   (certo: fecha)
allowlist_casa(array['',''], null)    -> true    (ERRADO)
allowlist_casa(array['','PG'], null)  -> true    (ERRADO: um branco derruba a restrição)
allowlist_casa(array['','PG'], 'PC')  -> false   (certo)
```

A causa: `lower(btrim(coalesce(valor,'')))` transforma valor ausente em `''`, e
`''` casa com uma entrada em branco da lista. Uma linha em branco salva por
acidente libera **todo mundo que não tem o valor**, sem erro em lugar nenhum.

Nenhuma das três linhas de `prompt_sugerido` em produção tem branco hoje, então
é latente, não explorado.

**Files:**
- Create: `supabase/migrations/20260924230000_allowlist_casa_branco.sql`

**Interfaces:**
- Consumes: nada.
- Produces: `public.allowlist_casa(lista text[], valor text) returns boolean`,
  mesma assinatura de hoje, comportamento corrigido. As tarefas 2, 3 e 7
  dependem desta semântica.

- [ ] **Passo 1: escrever a migration com as assertivas DENTRO dela**

Não há harness de teste SQL neste projeto, e a migration é idempotente e
re-rodável, então as assertivas moram nela: se o comportamento regredir, a
próxima aplicação falha em vez de passar calada.

```sql
-- =====================================================================
-- UMA ENTRADA EM BRANCO NA ALLOWLIST LIBERAVA QUEM NÃO TEM O VALOR
--
-- Provado contra a função viva em 24/09:
--   allowlist_casa(array['','PG'], null) -> TRUE
--
-- A causa é a normalização: `coalesce(valor,'')` transforma ausência em
-- string vazia, e string vazia casa com uma entrada em branco da lista.
-- O efeito é o oposto da regra que o dono pediu ("ausência fecha"): uma
-- linha em branco salva sem intenção libera todo mundo que não manda
-- aquele parâmetro, e não há erro em lugar nenhum para investigar.
--
-- A correção é filtrar os brancos ANTES de decidir. Com isso:
--   · lista só de brancos      -> vira lista vazia -> LIBERADO (igual a
--     cardinality 0, que é a convenção do projeto);
--   · lista com branco + valor -> o branco é ignorado e a restrição vale;
--   · valor ausente            -> nunca casa, porque não há item vazio.
--
-- Latente e não explorado: as três linhas de prompt_sugerido em produção
-- não têm branco. A trava de verdade contra lista-só-de-brancos é a tela
-- recusar o salvamento (projeto 1); aqui garantimos que o pior caso
-- (branco junto de valor real) deixe de abrir.
-- =====================================================================

create or replace function public.allowlist_casa(lista text[], valor text)
returns boolean
language sql
immutable parallel safe
as $$
  with itens as (
    select lower(btrim(x)) as v
      from unnest(coalesce(lista, '{}'::text[])) x
     where btrim(coalesce(x, '')) <> ''
  )
  select not exists (select 1 from itens)
      or lower(btrim(coalesce(valor, ''))) in (select v from itens);
$$;

comment on function public.allowlist_casa(text[], text) is
  'Allowlist: lista vazia (ou só de brancos) não restringe; senão compara por lower(btrim()) dos dois lados, e valor AUSENTE nunca casa. Brancos são filtrados antes de decidir — sem isso, uma entrada em branco liberava quem não manda o parâmetro.';

-- ── Assertivas: a migration falha se o comportamento regredir ────────
do $$
begin
  -- liberado
  assert public.allowlist_casa(null, null),                         'lista nula libera';
  assert public.allowlist_casa('{}'::text[], null),                 'lista vazia libera';
  assert public.allowlist_casa(array['', '  '], null),              'lista só de brancos libera';
  -- restrito
  assert public.allowlist_casa(array['PG'], 'PG'),                  'valor casa';
  assert public.allowlist_casa(array['pg'], ' PG '),                'caixa e espaco casam';
  assert not public.allowlist_casa(array['PG'], 'PC'),              'valor errado fecha';
  assert not public.allowlist_casa(array['PG'], null),              'ausencia fecha';
  assert not public.allowlist_casa(array['PG'], ''),                'vazio fecha';
  -- O FURO QUE ESTA MIGRATION EXISTE PARA FECHAR
  assert not public.allowlist_casa(array['', 'PG'], null),          'branco + valor: ausencia NAO pode passar';
  assert not public.allowlist_casa(array['  ', 'PG'], ''),          'espaco + valor: vazio NAO pode passar';
end $$;
```

- [ ] **Passo 2: aplicar e ver as assertivas passarem**

```bash
npm run migrate:apply -- supabase/migrations/20260924230000_allowlist_casa_branco.sql
```

Esperado: `OK supabase/migrations/20260924230000_allowlist_casa_branco.sql`.
Se qualquer assertiva falhar, a saída traz a mensagem da assertiva e nada é
gravado.

- [ ] **Passo 3: confirmar que o furo fechou, no banco**

```bash
npx tsx --env-file=.env.local .audit/sql.ts "
select public.allowlist_casa(array['','PG'], null) as furo_antigo,
       public.allowlist_casa(array['PG'], null)    as ausencia,
       public.allowlist_casa(array['','  '], null) as so_brancos,
       public.allowlist_casa(array['','PG'], 'PG') as valor_certo"
```

Esperado: `furo_antigo=false`, `ausencia=false`, `so_brancos=true`,
`valor_certo=true`.

- [ ] **Passo 4: confirmar que os prompts sugeridos não mudaram de alcance**

A função é usada por `prompts_sugeridos()`. As três linhas em produção não têm
branco, então o resultado tem de ser idêntico.

```bash
npx tsx --env-file=.env.local .audit/sql.ts "
select count(*) as prompts_visiveis
  from public.prompts_sugeridos('natcorp','PO','MASTER',null,null,null)"
```

Esperado: o mesmo número de antes da migration. Rode este comando ANTES do
passo 2 e anote o valor; se mudar, pare e investigue — significa que existe
branco em algum lugar que a consulta do passo anterior não pegou.

- [ ] **Passo 5: commit**

```bash
git add supabase/migrations/20260924230000_allowlist_casa_branco.sql
git commit -m "Uma entrada em branco na allowlist liberava quem não tem o valor

Provado contra a função viva: allowlist_casa(array['','PG'], null) devolvia
TRUE. A normalização transformava ausência em string vazia, e string vazia
casava com a entrada em branco da lista, então uma linha salva sem intenção
liberava todo mundo que não manda aquele parâmetro. O oposto da regra que o
dono pediu, e sem erro para investigar.

Brancos passam a ser filtrados antes de decidir. As assertivas moram na
própria migration porque não há harness de SQL aqui: se alguém reintroduzir o
furo, a próxima aplicação falha em vez de passar calada.

Latente, não explorado: as três linhas de prompt_sugerido não têm branco."
```

---

### Tarefa 2: o módulo TypeScript das doze dimensões

**Files:**
- Create: `src/lib/elegibilidade/dimensoes.ts`
- Create: `src/lib/elegibilidade/alcanca.ts`
- Create: `src/lib/elegibilidade/index.ts`
- Test: `src/lib/elegibilidade/alcanca.test.ts`

**Interfaces:**
- Consumes: a semântica corrigida na tarefa 1.
- Produces:
  - `DIMENSOES: readonly Dimensao[]` (doze, na ordem da spec)
  - `type Dimensao`
  - `type Regra = Partial<Record<Dimensao, string[]>>`
  - `type Identidade = Partial<Record<Dimensao, string | null | undefined>>`
  - `CHAVE_DE_DIMENSAO: Record<Dimensao, TrackingKey>`
  - `alcanca(regra: Regra, ident: Identidade): boolean`
  - `identidadeDoRastreio(t: Partial<Record<TrackingKey, string>>): Identidade`

  As tarefas 3, 4 e 7 dependem destes nomes exatos.

- [ ] **Passo 1: escrever `dimensoes.ts`**

```ts
import type { TrackingKey } from "@/lib/chat/tracking";

/**
 * AS DOZE DIMENSÕES DE ELEGIBILIDADE, e por que doze.
 *
 * Ditadas pelo dono em 24/09. Todas são a ALOCAÇÃO da pessoa, nunca o que ela
 * gerencia: um gestor responsável por três centros de custo tem UM centro de
 * custo próprio, e é esse que conta. Vínculo é o empregatício (CLT, PJ,
 * autônomo, estagiário).
 *
 * Isso está escrito porque a alternativa vai ser proposta de novo: aceitar
 * lista por dimensão na identidade (para cobrir "gestor de vários CCs") mudaria
 * o predicado, o formato do token e as três telas que o consomem.
 *
 * `p_cod_candidato` NÃO entra. Ele identifica fluxo de candidato, não recorte
 * de público, e como filtro convidaria a restringir conteúdo a um candidato.
 */
export const DIMENSOES = [
  "base",
  "portal",
  "perfil",
  "usuario",
  "empresa",
  "matricula",
  "filial",
  "centro_custo",
  "unidade_adm",
  "unidade_negocio",
  "vinculo",
  "sindicato",
] as const;

export type Dimensao = (typeof DIMENSOES)[number];

/** Allowlist por dimensão. Ausente ou vazia = não restringe. */
export type Regra = Partial<Record<Dimensao, string[]>>;

/** Quem está perguntando, uma valor por dimensão. */
export type Identidade = Partial<Record<Dimensao, string | null | undefined>>;

/**
 * De dimensão para o parâmetro de rastreio que a carrega.
 *
 * Existe para que ninguém escreva `"p_centro_custo"` à mão em três lugares e
 * erre num deles: o erro não daria exceção, daria conteúdo que não alcança
 * ninguém.
 */
export const CHAVE_DE_DIMENSAO: Record<Dimensao, TrackingKey> = {
  base: "p_base",
  portal: "p_portal",
  perfil: "p_perfil",
  usuario: "p_usuario",
  empresa: "p_empresa",
  matricula: "p_matricula",
  filial: "p_filial",
  centro_custo: "p_centro_custo",
  unidade_adm: "p_unidade_adm",
  unidade_negocio: "p_unidade_negocio",
  vinculo: "p_vinculo",
  sindicato: "p_sindicato",
};
```

- [ ] **Passo 2: escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { alcanca, identidadeDoRastreio } from "./alcanca";
import { DIMENSOES } from "./dimensoes";

describe("alcanca", () => {
  it("regra vazia alcança qualquer um, inclusive identidade vazia", () => {
    expect(alcanca({}, { base: "leadec", portal: "PG" })).toBe(true);
    expect(alcanca({}, {})).toBe(true);
  });

  it("dentro da dimensão é OU", () => {
    expect(alcanca({ portal: ["PG", "PC"] }, { portal: "PC" })).toBe(true);
    expect(alcanca({ portal: ["PG", "PC"] }, { portal: "PO" })).toBe(false);
  });

  it("entre dimensões é E", () => {
    const regra = { portal: ["PG"], perfil: ["FOLHA"] };
    expect(alcanca(regra, { portal: "PG", perfil: "FOLHA" })).toBe(true);
    expect(alcanca(regra, { portal: "PG", perfil: "RH" })).toBe(false);
  });

  it("compara por lower(btrim) dos dois lados", () => {
    expect(alcanca({ portal: ["  pg "] }, { portal: "PG" })).toBe(true);
    expect(alcanca({ centro_custo: ["100"] }, { centro_custo: " 100 " })).toBe(true);
  });

  it("valor ausente contra dimensão restrita FECHA", () => {
    expect(alcanca({ centro_custo: ["100"] }, { centro_custo: null })).toBe(false);
    expect(alcanca({ centro_custo: ["100"] }, {})).toBe(false);
    expect(alcanca({ centro_custo: ["100"] }, { centro_custo: "  " })).toBe(false);
  });

  /**
   * O espelho do furo do SQL: branco na lista não pode abrir o que ausência
   * fecha. Se estes dois passarem a divergir do banco, o script de paridade
   * acusa — mas é aqui que o defeito nasce.
   */
  it("branco na lista não libera quem não tem o valor", () => {
    expect(alcanca({ portal: ["", "PG"] }, { portal: null })).toBe(false);
    expect(alcanca({ portal: ["", "PG"] }, { portal: "PG" })).toBe(true);
  });

  it("lista só de brancos não restringe", () => {
    expect(alcanca({ portal: ["", "  "] }, { portal: null })).toBe(true);
  });

  it("cobre as doze dimensões, uma por uma", () => {
    for (const d of DIMENSOES) {
      expect(alcanca({ [d]: ["x"] }, { [d]: "x" })).toBe(true);
      expect(alcanca({ [d]: ["x"] }, { [d]: "y" })).toBe(false);
      expect(alcanca({ [d]: ["x"] }, {})).toBe(false);
    }
  });
});

describe("identidadeDoRastreio", () => {
  it("traduz os parâmetros p_* para dimensões", () => {
    const id = identidadeDoRastreio({
      p_base: "leadec",
      p_centro_custo: "100",
      p_cod_candidato: "9999",
    });
    expect(id.base).toBe("leadec");
    expect(id.centro_custo).toBe("100");
    expect("cod_candidato" in id).toBe(false);
  });
});
```

- [ ] **Passo 3: rodar e ver falhar**

```bash
npx vitest run src/lib/elegibilidade/alcanca.test.ts
```

Esperado: FAIL, `Failed to resolve import "./alcanca"`.

- [ ] **Passo 4: escrever `alcanca.ts`**

```ts
import type { TrackingKey } from "@/lib/chat/tracking";
import { CHAVE_DE_DIMENSAO, DIMENSOES, type Identidade, type Regra } from "./dimensoes";

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

/**
 * ESTA REGRA TAMBÉM EXISTE EM SQL (`public.elegivel`), e não por preguiça.
 *
 * O corte tem de acontecer no banco porque `widget.js` é público: mandar a
 * lista inteira para o navegador filtrar entregaria ao cliente os nomes de
 * tudo que ele NÃO pode ver. E a frase tem de existir aqui porque a tela a
 * mostra enquanto o admin digita.
 *
 * Duas implementações da mesma regra divergem; é questão de quando. As duas
 * lêem `casos.json` e `scripts/verificar-elegibilidade.ts` falha se
 * discordarem em um único caso.
 *
 * Quatro decisões que parecem detalhe e não são:
 *
 * · lista efetivamente vazia LIBERA (convenção do projeto, igual a
 *   `cardinality = 0` no SQL);
 * · valor ausente contra dimensão restrita FECHA (decisão do dono: a
 *   alternativa faria um PDF de um centro de custo vazar para a empresa
 *   inteira sem ninguém notar);
 * · brancos saem da lista ANTES de comparar, senão ausência casaria com
 *   branco e abriria o que deveria fechar (foi exatamente o furo encontrado
 *   em `allowlist_casa` em 24/09);
 * · dentro da dimensão OU, entre dimensões E.
 */
export function alcanca(regra: Regra, ident: Identidade): boolean {
  for (const d of DIMENSOES) {
    const lista = (regra[d] ?? []).map(norm).filter((x) => x !== "");
    if (lista.length === 0) continue; // dimensão não restringe
    const valor = norm(ident[d]);
    if (valor === "") return false; // ausência fecha
    if (!lista.includes(valor)) return false;
  }
  return true;
}

/** Monta a identidade a partir dos parâmetros de rastreio do turno. */
export function identidadeDoRastreio(
  t: Partial<Record<TrackingKey, string>>,
): Identidade {
  const out: Identidade = {};
  for (const d of DIMENSOES) {
    const v = t[CHAVE_DE_DIMENSAO[d]];
    if (typeof v === "string" && v.trim()) out[d] = v;
  }
  return out;
}
```

- [ ] **Passo 5: acrescentar as ferramentas da gravação em `alcanca.ts`**

A especificação exige **três** travas contra a lista em branco, e o predicado
corrigido é só a terceira. Estas duas funções são o que o caminho de gravação
usa; a primeira trava (a tela nunca produzir branco) e o interruptor explícito
de "sem restrição" pertencem às telas dos projetos 1 e 2.

```ts
/**
 * Limpa a regra para gravação: fora os brancos, fora a caixa, fora duplicata.
 *
 * O predicado já ignora branco ao comparar, então isto não muda alcance — muda
 * o que fica GRAVADO. Sem normalizar na entrada, o banco acumula
 * `["PG", "pg", "", " PG "]`, a tela mostra quatro chips onde há um valor, e a
 * pessoa que for conferir a regra conta errado.
 */
export function normalizarRegra(regra: Regra): Regra {
  const out: Regra = {};
  for (const d of DIMENSOES) {
    const itens = [...new Set((regra[d] ?? []).map(norm).filter((x) => x !== ""))];
    if (itens.length) out[d] = itens;
  }
  return out;
}

/**
 * A regra tem dimensão que RESTRINGE PARA NINGUÉM?
 *
 * Acontece quando alguém salva uma lista cujos itens são todos em branco. Pelo
 * predicado isso vira "não restringe", que é o OPOSTO da intenção de quem
 * digitou: a pessoa quis restringir e liberou. O caminho de gravação recusa,
 * em vez de gravar algo que age ao contrário do que foi pedido.
 *
 * Devolve as dimensões problemáticas, e não um booleano, porque a mensagem de
 * erro precisa dizer QUAL campo está em branco.
 */
export function dimensoesComRestricaoVazia(regra: Regra): Dimensao[] {
  return DIMENSOES.filter((d) => {
    const bruto = regra[d];
    if (!bruto || bruto.length === 0) return false; // ausente = sem restrição, legítimo
    return bruto.every((x) => norm(x) === ""); // tem itens, e todos em branco
  });
}
```

O import no topo de `alcanca.ts` passa a incluir `Dimensao`:

```ts
import { CHAVE_DE_DIMENSAO, DIMENSOES, type Dimensao, type Identidade, type Regra } from "./dimensoes";
```

- [ ] **Passo 6: testar as duas**

Acrescente a `alcanca.test.ts`:

```ts
import { dimensoesComRestricaoVazia, normalizarRegra } from "./alcanca";

describe("normalizarRegra", () => {
  it("tira branco, caixa e duplicata, e some com dimensão que ficou vazia", () => {
    expect(normalizarRegra({ portal: ["PG", "pg", "", " PG "], perfil: ["  "] })).toEqual({
      portal: ["pg"],
    });
  });
});

describe("dimensoesComRestricaoVazia", () => {
  it("acusa dimensão com itens todos em branco", () => {
    expect(dimensoesComRestricaoVazia({ portal: ["", "  "] })).toEqual(["portal"]);
  });

  it("não acusa dimensão ausente nem lista legítima", () => {
    expect(dimensoesComRestricaoVazia({})).toEqual([]);
    expect(dimensoesComRestricaoVazia({ portal: [] })).toEqual([]);
    expect(dimensoesComRestricaoVazia({ portal: ["", "PG"] })).toEqual([]);
  });
});
```

O último caso é o importante: `["", "PG"]` **não** é erro de gravação, porque
sobra um valor real. `normalizarRegra` limpa o branco e a regra vale. Recusar
aqui faria a tela rejeitar uma regra correta por causa de um chip vazio que ela
mesma pode limpar.

- [ ] **Passo 7: rodar**

```bash
npx vitest run src/lib/elegibilidade/alcanca.test.ts
```

Esperado: PASS, 13 testes.

- [ ] **Passo 8: escrever `index.ts`**

```ts
export { DIMENSOES, CHAVE_DE_DIMENSAO } from "./dimensoes";
export type { Dimensao, Regra, Identidade } from "./dimensoes";
export {
  alcanca,
  identidadeDoRastreio,
  normalizarRegra,
  dimensoesComRestricaoVazia,
} from "./alcanca";
```

- [ ] **Passo 9: rodar a pasta inteira**

```bash
npx vitest run src/lib/elegibilidade/
```

Esperado: PASS, 13 testes.

Nota: os testes das doze dimensões ainda não compilam se `TRACKING_KEYS` não
tiver as seis chaves novas. Se `npx tsc --noEmit` reclamar de
`p_filial` não existir em `TrackingKey`, **pare e faça a tarefa 4 primeiro** —
ela é independente e pequena. Vitest passa antes de tsc porque não checa tipos.

- [ ] **Passo 10: commit**

```bash
git add src/lib/elegibilidade/
git commit -m "A regra de quem alcança o quê passa a ter um lugar só

Doze dimensões, predicado puro, e o comentário que explica por que a mesma
regra também existe em SQL: o corte tem de acontecer no banco porque widget.js
é público, e mandar a lista para o navegador filtrar entregaria ao cliente os
nomes de tudo que ele não pode ver.

Duas decisões ficaram travadas por teste porque são simétricas na aparência e
opostas no efeito: lista vazia LIBERA, valor ausente FECHA. E brancos saem da
lista antes de comparar, senão ausência casaria com branco e abriria o que
deveria fechar, que foi o furo encontrado em allowlist_casa."
```

---

### Tarefa 3: o corpus compartilhado e o script de paridade

Sem isto, as duas implementações divergem e o sintoma é a tela prometendo um
alcance que o banco não entrega.

**Files:**
- Create: `src/lib/elegibilidade/casos.json`
- Create: `scripts/verificar-elegibilidade.ts`
- Modify: `package.json` (um script novo)
- Test: `src/lib/elegibilidade/casos.test.ts`

**Interfaces:**
- Consumes: `alcanca` da tarefa 2; `public.elegivel` da tarefa 4.
- Produces: `npm run verificar:elegibilidade`, que sai com código 1 na
  divergência.

> **Ordem:** o script precisa de `public.elegivel`, que nasce na tarefa 4. Faça
> os passos 1 a 4 desta tarefa agora (corpus + teste TS) e os passos 5 a 8
> depois da tarefa 4.

- [ ] **Passo 1: escrever `casos.json`**

```json
{
  "_comentario": "Corpus COMPARTILHADO entre o predicado TypeScript e public.elegivel. Um caso a mais aqui vale mais que um teste a mais em qualquer um dos dois lados, porque este é o único arquivo que os dois lêem. Ordem dos campos irrelevante; nomes das dimensões conforme src/lib/elegibilidade/dimensoes.ts.",
  "casos": [
    { "nome": "regra vazia, identidade cheia", "regra": {}, "identidade": { "base": "leadec", "portal": "PG" }, "esperado": true },
    { "nome": "regra vazia, identidade vazia", "regra": {}, "identidade": {}, "esperado": true },
    { "nome": "portal casa", "regra": { "portal": ["PG"] }, "identidade": { "portal": "PG" }, "esperado": true },
    { "nome": "portal nao casa", "regra": { "portal": ["PG"] }, "identidade": { "portal": "PC" }, "esperado": false },
    { "nome": "portal ausente fecha", "regra": { "portal": ["PG"] }, "identidade": {}, "esperado": false },
    { "nome": "portal vazio fecha", "regra": { "portal": ["PG"] }, "identidade": { "portal": "  " }, "esperado": false },
    { "nome": "caixa diferente casa", "regra": { "portal": ["pg"] }, "identidade": { "portal": "PG" }, "esperado": true },
    { "nome": "espaco nas pontas casa", "regra": { "portal": ["  PG "] }, "identidade": { "portal": "PG" }, "esperado": true },
    { "nome": "OU dentro da dimensao", "regra": { "portal": ["PG", "PC"] }, "identidade": { "portal": "PC" }, "esperado": true },
    { "nome": "E entre dimensoes, uma falha", "regra": { "portal": ["PG"], "perfil": ["FOLHA"] }, "identidade": { "portal": "PG", "perfil": "RH" }, "esperado": false },
    { "nome": "E entre dimensoes, as duas passam", "regra": { "portal": ["PG"], "perfil": ["FOLHA"] }, "identidade": { "portal": "PG", "perfil": "FOLHA" }, "esperado": true },
    { "nome": "branco na lista nao libera ausencia", "regra": { "portal": ["", "PG"] }, "identidade": {}, "esperado": false },
    { "nome": "branco na lista nao estraga valor certo", "regra": { "portal": ["", "PG"] }, "identidade": { "portal": "PG" }, "esperado": true },
    { "nome": "lista so de brancos libera", "regra": { "portal": ["", "  "] }, "identidade": {}, "esperado": true },
    { "nome": "centro de custo com zero a esquerda nao casa", "regra": { "centro_custo": ["100"] }, "identidade": { "centro_custo": "0100" }, "esperado": false },
    { "nome": "gestor de vários CC: token traz o dele", "regra": { "centro_custo": ["100"] }, "identidade": { "centro_custo": "200" }, "esperado": false },
    { "nome": "vinculo empregaticio", "regra": { "vinculo": ["CLT"] }, "identidade": { "vinculo": "clt" }, "esperado": true },
    { "nome": "sindicato nao casa", "regra": { "sindicato": ["SINDPD"] }, "identidade": { "sindicato": "SEESP" }, "esperado": false },
    { "nome": "dimensao nova restrita, token antigo", "regra": { "unidade_negocio": ["UN1"] }, "identidade": { "base": "leadec", "portal": "PG", "perfil": "MASTER" }, "esperado": false },
    { "nome": "doze dimensoes todas casando", "regra": { "base": ["leadec"], "portal": ["PG"], "perfil": ["MASTER"], "usuario": ["u1"], "empresa": ["1"], "matricula": ["123"], "filial": ["F1"], "centro_custo": ["100"], "unidade_adm": ["UA1"], "unidade_negocio": ["UN1"], "vinculo": ["CLT"], "sindicato": ["SINDPD"] }, "identidade": { "base": "LEADEC", "portal": "pg", "perfil": "master", "usuario": "U1", "empresa": " 1 ", "matricula": "123", "filial": "f1", "centro_custo": "100", "unidade_adm": "ua1", "unidade_negocio": "un1", "vinculo": "clt", "sindicato": "sindpd" }, "esperado": true },
    { "nome": "doze dimensoes, a ultima falha", "regra": { "base": ["leadec"], "portal": ["PG"], "perfil": ["MASTER"], "usuario": ["u1"], "empresa": ["1"], "matricula": ["123"], "filial": ["F1"], "centro_custo": ["100"], "unidade_adm": ["UA1"], "unidade_negocio": ["UN1"], "vinculo": ["CLT"], "sindicato": ["SINDPD"] }, "identidade": { "base": "LEADEC", "portal": "pg", "perfil": "master", "usuario": "U1", "empresa": "1", "matricula": "123", "filial": "f1", "centro_custo": "100", "unidade_adm": "ua1", "unidade_negocio": "un1", "vinculo": "clt", "sindicato": "OUTRO" }, "esperado": false }
  ]
}
```

- [ ] **Passo 2: escrever o teste que roda o corpus no lado TypeScript**

```ts
import { describe, it, expect } from "vitest";
import { alcanca, type Identidade, type Regra } from "./index";
import corpus from "./casos.json";

type Caso = { nome: string; regra: Regra; identidade: Identidade; esperado: boolean };

/**
 * O MESMO arquivo que `scripts/verificar-elegibilidade.ts` roda contra
 * `public.elegivel`. Acrescentar caso aqui vale mais que acrescentar teste em
 * qualquer um dos dois lados, porque este é o único arquivo que os dois lêem.
 */
describe("corpus compartilhado, lado TypeScript", () => {
  const casos = corpus.casos as Caso[];

  it("tem casos", () => {
    expect(casos.length).toBeGreaterThan(15);
  });

  for (const c of casos) {
    it(c.nome, () => {
      expect(alcanca(c.regra, c.identidade)).toBe(c.esperado);
    });
  }
});
```

- [ ] **Passo 3: rodar e ver passar**

```bash
npx vitest run src/lib/elegibilidade/casos.test.ts
```

Esperado: PASS. Se algum caso falhar, o predicado da tarefa 2 está errado — o
corpus é a especificação.

- [ ] **Passo 4: commit parcial**

```bash
git add src/lib/elegibilidade/casos.json src/lib/elegibilidade/casos.test.ts
git commit -m "Corpus compartilhado da elegibilidade, lado TypeScript

Um arquivo de casos que as DUAS implementações vão ler. O script de paridade
contra public.elegivel vem depois que a função existir; este commit garante que
o lado TypeScript já obedece ao corpus.

Inclui o caso que mais vai acontecer na prática e que nenhum teste de unidade
pegaria: centro de custo '0100' não casa com '100'. É por isso que a tela vai
listar a estrutura real do cliente em vez de pedir código digitado."
```

- [ ] **Passo 5 (depois da tarefa 4): escrever `scripts/verificar-elegibilidade.ts`**

```js
/**
 * PARIDADE ENTRE AS DUAS IMPLEMENTAÇÕES DA ELEGIBILIDADE.
 *
 * A regra vive em TypeScript (a tela mostra a frase ao vivo) e em SQL (o corte
 * acontece no banco, porque widget.js é público). Isso é necessário e é uma
 * dívida: no dia em que alguém corrigir o `btrim` só de um lado, a tela promete
 * um alcance que o banco não entrega, e ninguém vê erro.
 *
 * Este script roda o MESMO corpus nos dois e sai com código 1 na primeira
 * divergência. Rodar antes de cada deploy que toque elegibilidade.
 */
import { readFileSync } from "node:fs";
import pg from "pg";
// Relativo, sem extensão, como `.audit/sql.ts` já faz: o alias `@/` do
// tsconfig não é resolvido por scripts rodados fora do Next.
import { parseDbConfig } from "../src/lib/jobs/db-config";
import { alcanca } from "../src/lib/elegibilidade/alcanca";

const corpus = JSON.parse(readFileSync("src/lib/elegibilidade/casos.json", "utf8"));
const client = new pg.Client(parseDbConfig());
await client.connect();
await client.query("SET default_transaction_read_only = on");

let divergencias = 0;
for (const c of corpus.casos) {
  const ts = alcanca(c.regra, c.identidade);
  const { rows } = await client.query("select public.elegivel($1::jsonb, $2::jsonb) as r", [
    JSON.stringify(c.regra),
    JSON.stringify(c.identidade),
  ]);
  const sql = rows[0].r;
  if (ts !== sql || ts !== c.esperado) {
    divergencias++;
    console.error(
      `DIVERGIU  ${c.nome}\n  esperado=${c.esperado}  typescript=${ts}  sql=${sql}`,
    );
  }
}
await client.end();

if (divergencias) {
  console.error(`\n${divergencias} divergência(s) de ${corpus.casos.length} casos.`);
  process.exit(1);
}
console.log(`Elegibilidade em paridade: ${corpus.casos.length} casos, SQL e TypeScript de acordo.`);
```

- [ ] **Passo 6: registrar o script no `package.json`**

Em `"scripts"`, ao lado de `"verificar:ui"`:

```json
"verificar:elegibilidade": "tsx --env-file=.env.local scripts/verificar-elegibilidade.ts",
```

- [ ] **Passo 7: rodar e ver a paridade**

```bash
npm run verificar:elegibilidade
```

Esperado: `Elegibilidade em paridade: 21 casos, SQL e TypeScript de acordo.`

Se divergir, a saída nomeia o caso e mostra os três valores. Corrija o lado que
discorda do `esperado`; se os dois discordarem do esperado, o corpus está certo
e as duas implementações erradas (já aconteceu com `allowlist_casa`).

- [ ] **Passo 8: commit**

```bash
git add scripts/verificar-elegibilidade.ts package.json
git commit -m "Um script impede as duas implementações da elegibilidade de divergirem

A regra vive em TypeScript e em SQL por necessidade, não por preguiça: a tela
mostra a frase ao vivo, e o corte tem de acontecer no banco porque widget.js é
público. Duas implementações da mesma regra divergem, é questão de quando, e o
sintoma seria a tela prometendo um alcance que o banco não entrega, sem erro.

npm run verificar:elegibilidade roda o mesmo corpus nos dois lados e sai com
código 1 na primeira divergência."
```

---

### Tarefa 4: os seis parâmetros novos e `public.elegivel`

**Files:**
- Modify: `src/lib/chat/tracking.ts`
- Create: `supabase/migrations/20260924231000_rastreio_seis_dimensoes.sql`
- Test: `src/lib/chat/tracking.test.ts` (criar se não existir)

**Interfaces:**
- Consumes: `allowlist_casa` corrigida (tarefa 1).
- Produces:
  - `TRACKING_KEYS` com treze chaves;
  - seis colunas em `conversations`;
  - `public.elegivel(regra jsonb, identidade jsonb) returns boolean`, consumida
    pelo script da tarefa 3 e por toda RPC dos projetos 1 a 3.

- [ ] **Passo 1: escrever o teste que falha**

Em `src/lib/chat/tracking.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { TRACKING_KEYS, trackingFields } from "./tracking";

describe("TRACKING_KEYS", () => {
  it("tem as treze chaves, incluindo as seis novas de 24/09", () => {
    expect(TRACKING_KEYS).toHaveLength(13);
    for (const k of [
      "p_filial",
      "p_centro_custo",
      "p_unidade_adm",
      "p_unidade_negocio",
      "p_vinculo",
      "p_sindicato",
    ]) {
      expect(TRACKING_KEYS).toContain(k);
    }
  });
});

describe("trackingFields", () => {
  it("extrai as novas e ignora o que não é chave de rastreio", () => {
    const out = trackingFields({
      p_filial: " F1 ",
      p_sindicato: "SINDPD",
      p_qualquer_coisa: "x",
    });
    expect(out).toEqual({ p_filial: "F1", p_sindicato: "SINDPD" });
  });

  it("descarta valor que fica vazio depois do trim", () => {
    expect(trackingFields({ p_vinculo: "   " })).toEqual({});
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npx vitest run src/lib/chat/tracking.test.ts
```

Esperado: FAIL, `expected 7 to be 13`.

- [ ] **Passo 3: acrescentar as seis chaves**

Em `src/lib/chat/tracking.ts`, dentro de `TRACKING_KEYS`, **antes** de
`p_cod_candidato` (que fica por último porque não é dimensão de elegibilidade):

```ts
  "p_perfil",
  // Seis dimensões acrescentadas em 24/09, por decisão do dono. Todas são a
  // ALOCAÇÃO da pessoa, não o que ela gerencia, e os valores vivem nos
  // endpoints de estrutura do ERP (estrutura_filiais, estrutura_centros_custo,
  // estrutura_unidades_adm, estrutura_vinculos_empregaticios,
  // estrutura_sindicatos). `unidade de negócio` ainda não tem endpoint.
  //
  // Enquanto o bloco APEX de um cliente não for recolado, elas chegam vazias,
  // e pela regra de "ausência fecha" qualquer restrição nelas não alcança
  // ninguém naquele cliente. Isso é deliberado: a alternativa faria um
  // documento restrito a um centro de custo vazar para a empresa inteira.
  "p_filial",
  "p_centro_custo",
  "p_unidade_adm",
  "p_unidade_negocio",
  "p_vinculo",
  "p_sindicato",
```

- [ ] **Passo 4: rodar e ver passar**

```bash
npx vitest run src/lib/chat/tracking.test.ts
```

Esperado: PASS, 3 testes.

- [ ] **Passo 5: escrever a migration**

```sql
-- =====================================================================
-- SEIS DIMENSÕES NOVAS DE RASTREIO, E A REGRA DE ELEGIBILIDADE EM SQL
--
-- Decisão do dono (24/09): a elegibilidade de conteúdo passa a ter doze
-- dimensões. Seis já existiam; estas seis nascem aqui.
--
-- Todas são a ALOCAÇÃO da pessoa, não o que ela gerencia. Vínculo é o
-- empregatício (CLT, PJ, autônomo, estagiário). Os valores vivem nos
-- endpoints de estrutura do ERP, que já são ferramentas ATIVAS do
-- catálogo, exceto unidade de negócio, que será cadastrada depois.
--
-- ── Por que colunas, e não um jsonb ─────────────────────────────────
-- `conversations` é lida por filtro na tela de Conversas e pelas RPCs de
-- faceta, que agrupam por valor. Num jsonb cada filtro viraria expressão
-- e nenhum índice serviria. E o rastreio é um conjunto FECHADO decidido
-- pelo dono, não um saco aberto de atributos.
--
-- ── `public.elegivel`, e por que ela repete o TypeScript ────────────
-- O corte tem de acontecer no banco porque `widget.js` é público: mandar
-- a lista inteira para o navegador filtrar entregaria ao cliente os
-- nomes de tudo que ele NÃO pode ver. O predicado em TypeScript existe
-- porque a tela mostra a frase enquanto o admin digita.
--
-- As duas lêem `src/lib/elegibilidade/casos.json` e
-- `npm run verificar:elegibilidade` falha se discordarem em um caso.
-- =====================================================================

alter table public.conversations
  add column if not exists p_filial          text,
  add column if not exists p_centro_custo    text,
  add column if not exists p_unidade_adm     text,
  add column if not exists p_unidade_negocio text,
  add column if not exists p_vinculo         text,
  add column if not exists p_sindicato       text;

comment on column public.conversations.p_filial is
  'Filial de ALOCAÇÃO da pessoa. Vem do token de rastreio; nulo em cliente cujo bloco APEX ainda não foi recolado.';
comment on column public.conversations.p_centro_custo is
  'Centro de custo de ALOCAÇÃO da pessoa, não os que ela gerencia. Um gestor de três CCs tem um CC próprio, e é esse que conta.';
comment on column public.conversations.p_unidade_adm is
  'Unidade administrativa de alocação da pessoa.';
comment on column public.conversations.p_unidade_negocio is
  'Unidade de negócio de alocação. Única das seis sem endpoint de estrutura no catálogo (24/09), portanto a única com digitação livre na tela.';
comment on column public.conversations.p_vinculo is
  'Vínculo EMPREGATÍCIO (CLT, PJ, autônomo, estagiário), não vínculo com a empresa.';
comment on column public.conversations.p_sindicato is
  'Sindicato da pessoa.';

-- ── A regra, em SQL ─────────────────────────────────────────────────
-- Assinatura em jsonb (e não doze pares de text[]/text) porque toda RPC
-- dos projetos 1 a 3 vai chamá-la, e uma função de 24 argumentos erra na
-- ordem em silêncio: trocar `filial` com `centro_custo` compila, roda e
-- devolve o conteúdo errado para o cliente errado.
create or replace function public.elegivel(regra jsonb, identidade jsonb)
returns boolean
language sql
immutable parallel safe
as $$
  select not exists (
    select 1
      from jsonb_each(coalesce(regra, '{}'::jsonb)) r(dim, lista)
     where jsonb_typeof(r.lista) = 'array'
       and not public.allowlist_casa(
             (select array_agg(x #>> '{}') from jsonb_array_elements(r.lista) x),
             identidade #>> array[r.dim]
           )
  );
$$;

comment on function public.elegivel(jsonb, jsonb) is
  'Alcance de uma regra de elegibilidade sobre uma identidade, nas doze dimensões. Dentro da dimensão OU, entre dimensões E, lower(btrim()) dos dois lados, lista vazia libera, valor AUSENTE contra dimensão restrita FECHA. Gêmea de src/lib/elegibilidade/alcanca.ts; npm run verificar:elegibilidade prova que concordam.';

revoke all on function public.elegivel(jsonb, jsonb) from public, anon;
grant execute on function public.elegivel(jsonb, jsonb) to authenticated, service_role;

-- ── Assertivas ──────────────────────────────────────────────────────
do $$
begin
  assert public.elegivel('{}'::jsonb, '{}'::jsonb),
    'regra vazia libera';
  assert public.elegivel('{"portal":["PG"]}', '{"portal":"pg"}'),
    'caixa nao importa';
  assert not public.elegivel('{"portal":["PG"]}', '{}'::jsonb),
    'ausencia fecha';
  assert not public.elegivel('{"portal":["","PG"]}', '{}'::jsonb),
    'branco na lista nao libera ausencia';
  assert public.elegivel('{"portal":["",""]}', '{}'::jsonb),
    'lista so de brancos libera';
  assert not public.elegivel('{"portal":["PG"],"perfil":["FOLHA"]}', '{"portal":"PG","perfil":"RH"}'),
    'E entre dimensoes';
  assert not public.elegivel('{"centro_custo":["100"]}', '{"centro_custo":"0100"}'),
    'zero a esquerda nao casa';
end $$;
```

- [ ] **Passo 6: aplicar**

```bash
npm run migrate:apply -- supabase/migrations/20260924231000_rastreio_seis_dimensoes.sql
```

Esperado: `OK`. As assertivas rodam dentro.

- [ ] **Passo 7: acertar os tipos gerados à mão**

`supabase gen types` não roda aqui (exige Docker ou token). Em
`src/lib/database.types.ts`, no bloco `conversations`, acrescente as seis
colunas em `Row` (como `string | null`), `Insert` e `Update` (como
`string | null`, opcionais com `?`), em ordem alfabética junto das outras
`p_*`. E na seção `Functions`, acrescente:

```ts
      elegivel: {
        Args: { regra: Json; identidade: Json }
        Returns: boolean
      }
```

- [ ] **Passo 8: portão**

```bash
npx tsc --noEmit && npx eslint src/lib/chat/tracking.ts src/lib/elegibilidade/ && npx vitest run
```

Esperado: tudo limpo. Este é o momento em que os testes das doze dimensões da
tarefa 2 passam a compilar.

- [ ] **Passo 9: commit**

```bash
git add src/lib/chat/tracking.ts src/lib/database.types.ts src/lib/chat/tracking.test.ts supabase/migrations/20260924231000_rastreio_seis_dimensoes.sql
git commit -m "Seis dimensões de elegibilidade que o servidor ainda não conseguia avaliar

A tela vai oferecer restrição por filial, centro de custo, unidade
administrativa, unidade de negócio, vínculo e sindicato, e nenhuma delas chegava
ao servidor. Sem isto, o projeto nasceria com dimensões que a tela promete e o
banco não cumpre.

Colunas, e não jsonb: conversations é filtrada por essas dimensões na tela e
agrupada por elas nas RPCs de faceta; num jsonb cada filtro viraria expressão e
nenhum índice serviria.

public.elegivel recebe jsonb em vez de doze pares de argumentos porque uma
função de 24 parâmetros erra na ordem em silêncio: trocar filial com
centro_custo compila, roda e devolve conteúdo errado para o cliente errado.

As assertivas moram na migration, incluindo a que trava o furo do branco e a que
trava '0100' não casar com '100' — o erro que a tela de estrutura existe para
evitar."
```

---

### Tarefa 5: o bloco APEX carrega as seis

**Files:**
- Modify: `apex/token-rastreio.sql`

**Interfaces:**
- Consumes: `TRACKING_KEYS` da tarefa 4 (os nomes das chaves no JSON precisam
  bater exatamente).
- Produces: token com treze campos. Nenhum código TypeScript depende desta
  tarefa; ela é a metade operacional.

> **Contexto que economiza uma visita por cliente:** o bloco já precisa ser
> recolado por causa do `c_site` relativo corrigido em 24/09. Estes seis campos
> entram no mesmo bloco, então é uma recolagem em vez de duas.

- [ ] **Passo 1: aumentar os buffers ANTES de acrescentar campo**

`apex/token-rastreio.sql:70` declara hoje:

```sql
  l_key   raw(32);  l_json varchar2(2000);  l_pay raw(2000);
```

Treze campos com até 200 caracteres cada, mais nomes e pontuação, passam de
2.000 bytes: só os valores dão até 2.600. `varchar2(2000)` estouraria com
`ORA-06502` no meio da sessão do cliente, e o widget simplesmente não abriria.

Troque por:

```sql
  l_key   raw(32);  l_json varchar2(6000);  l_pay raw(6000);
```

- [ ] **Passo 2: acrescentar os seis campos ao JSON**

Em `apex/token-rastreio.sql`, depois da linha `,"p_base"` e antes de `,"sid"`:

```sql
         || ',"p_filial":'          ||apex_json.stringify(:P_FILIAL)
         || ',"p_centro_custo":'    ||apex_json.stringify(:P_CENTRO_CUSTO)
         || ',"p_unidade_adm":'     ||apex_json.stringify(:P_UNIDADE_ADM)
         || ',"p_unidade_negocio":' ||apex_json.stringify(:P_UNIDADE_NEGOCIO)
         || ',"p_vinculo":'         ||apex_json.stringify(:P_VINCULO)
         || ',"p_sindicato":'       ||apex_json.stringify(:P_SINDICATO)
```

- [ ] **Passo 3: acrescentar o comentário que explica o encolhimento seguro**

No cabeçalho do arquivo, depois da linha sobre `dbms_crypto`:

```sql
-- Os treze campos sao um conjunto FECHADO, decidido pelo dono. Um cliente que
-- nao recolar este bloco continua funcionando: o servidor le so as chaves que
-- vierem, e as que faltarem contam como AUSENTES. Pela regra de elegibilidade,
-- ausencia FECHA, entao conteudo restrito a uma dimensao que este bloco nao
-- manda nao alcanca ninguem neste cliente -- de proposito, porque a
-- alternativa faria um documento de um centro de custo vazar para a empresa
-- inteira. A tela de elegibilidade avisa quando a base nunca enviou valor
-- numa dimensao.
--
-- Se algum item nao existir como item de aplicacao no APEX do cliente,
-- apex_json.stringify(:ITEM) devolve null e o campo vai nulo. Nao remova a
-- linha: campo ausente e campo nulo tem o mesmo efeito, e manter as treze
-- linhas mantem o bloco igual em todos os clientes, o que e o que permite
-- comparar duas instalacoes.
```

- [ ] **Passo 4: verificar que o arquivo continua sendo lido pela tela de instalação**

`src/lib/gestao/instalacao-apex.ts` lê este `.sql` e preenche a chave. Confirme
que a tela ainda renderiza depois da edição:

```bash
npx tsc --noEmit && NEXT_PUBLIC_BASE_PATH= npm run build 2>&1 | grep -E "Compiled successfully|error"
```

Esperado: `✓ Compiled successfully`.

- [ ] **Passo 5: commit**

```bash
git add apex/token-rastreio.sql
git commit -m "O token de rastreio carrega as seis dimensões novas, e o buffer cabia em sete

varchar2(2000) foi aumentado ANTES de acrescentar campo: treze campos com até
200 caracteres cada passam de 2.600 bytes só de valores, e o estouro seria
ORA-06502 no meio da sessão do cliente, com o widget simplesmente não abrindo.

As treze linhas ficam mesmo quando o item não existe no APEX daquele cliente:
stringify devolve nulo, campo nulo e campo ausente têm o mesmo efeito, e manter
o bloco idêntico em todos os clientes é o que permite comparar duas
instalações.

O bloco já precisava ser recolado por causa do c_site relativo, então isto não
custa uma visita nova a cada cliente."
```

---

### Tarefa 6: `vocabulario_rastreio` nas doze dimensões

Hoje ela devolve **duas**: `perfil` e `empresa`. É ela que alimenta o
diagnóstico "esta base nunca enviou valor nesta dimensão", que é a única
proteção da `unidade_negocio` enquanto não houver endpoint de estrutura.

**Files:**
- Create: `supabase/migrations/20260924232000_vocabulario_doze_dimensoes.sql`

**Interfaces:**
- Consumes: as seis colunas da tarefa 4.
- Produces: `vocabulario_rastreio(base_ref text)` devolvendo `(campo, valor,
  conversas)` para as doze dimensões. `campo` usa os nomes de dimensão de
  `src/lib/elegibilidade/dimensoes.ts`, não os `p_*`.

- [ ] **Passo 1: escrever a migration**

```sql
-- =====================================================================
-- O VOCABULÁRIO PASSA DE DUAS DIMENSÕES PARA DOZE
--
-- `vocabulario_rastreio` devolvia só `perfil` e `empresa`, porque nasceu
-- para o formulário de prompts sugeridos. Agora ela é o instrumento de
-- DIAGNÓSTICO da elegibilidade: a tela oferece as doze dimensões sempre
-- (decisão do dono), e o que evita a regra impossível virar chamado de
-- suporte é dizer, ao lado, se aquela base já enviou algum valor naquela
-- dimensão.
--
-- ── Por que presença de dimensão, e não contagem de pessoas ─────────
-- A primeira versão do desenho contava quantos usuários uma regra
-- alcançava. Medido em 24/09: `natcorp` tem 317 conversas e 4 valores
-- distintos de `p_usuario`; a maior base conhece 7 usuários. Um contador
-- mostraria 0 ou 1 para qualquer regra e seria impossível distinguir
-- "regra impossível" de "pouca gente usou o chatbot". Presença de
-- dimensão é respondível com 7 usuários; contagem de pessoas não é.
--
-- `campo` usa o nome da DIMENSÃO (`centro_custo`), não o do parâmetro
-- (`p_centro_custo`), para casar com src/lib/elegibilidade/dimensoes.ts.
-- Traduzir de um lado só já custou um bug neste projeto.
-- =====================================================================

drop function if exists public.vocabulario_rastreio(text);

create function public.vocabulario_rastreio(base_ref text default null)
returns table (campo text, valor text, conversas bigint)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  with base as (
    select c.p_portal, c.p_perfil, c.p_usuario, c.p_empresa, c.p_matricula,
           c.p_filial, c.p_centro_custo, c.p_unidade_adm,
           c.p_unidade_negocio, c.p_vinculo, c.p_sindicato
      from public.conversations c
     -- Sem base = todas: é o vocabulário do catálogo GLOBAL da Natcorp,
     -- que precisa enxergar os valores de todos os clientes.
     where base_ref is null
        or lower(btrim(c.p_base)) = lower(btrim(base_ref))
  ),
  longo as (
    select 'portal'::text          as campo, b.p_portal          as valor from base b
    union all select 'perfil',          b.p_perfil          from base b
    union all select 'usuario',         b.p_usuario         from base b
    union all select 'empresa',         b.p_empresa         from base b
    union all select 'matricula',       b.p_matricula       from base b
    union all select 'filial',          b.p_filial          from base b
    union all select 'centro_custo',    b.p_centro_custo    from base b
    union all select 'unidade_adm',     b.p_unidade_adm     from base b
    union all select 'unidade_negocio', b.p_unidade_negocio from base b
    union all select 'vinculo',         b.p_vinculo         from base b
    union all select 'sindicato',       b.p_sindicato       from base b
  )
  select l.campo, btrim(l.valor), count(*)::bigint
    from longo l
   where l.valor is not null and btrim(l.valor) <> ''
   group by l.campo, btrim(l.valor)
  -- Frequência primeiro: põe na frente o que o admin escolhe em 90% das
  -- vezes. Alfabético poria 'ADM_COORD_SUP' antes de 'MASTER'.
  order by 1, 3 desc, 2;
$$;

comment on function public.vocabulario_rastreio(text) is
  'Valores DISTINTOS já vistos por dimensão de elegibilidade nas conversas da base (ou de todas, se base_ref é nulo), com contagem. Alimenta o diagnóstico "esta base nunca enviou valor nesta dimensão". `campo` usa o nome da dimensão, não o do parâmetro p_*.';

revoke all on function public.vocabulario_rastreio(text) from public, anon;
grant execute on function public.vocabulario_rastreio(text) to authenticated, service_role;

-- `base` não entra no vocabulário: a base é o filtro, não uma dimensão a
-- descobrir. Oferecê-la aqui deixaria a tela sugerir restringir um
-- conteúdo da base X à base Y.
```

- [ ] **Passo 2: aplicar**

```bash
npm run migrate:apply -- supabase/migrations/20260924232000_vocabulario_doze_dimensoes.sql
```

Esperado: `OK`.

- [ ] **Passo 3: conferir contra o dado real, e ver as dimensões vazias**

```bash
npx tsx --env-file=.env.local .audit/sql.ts "
select campo, count(*) as valores_distintos, sum(conversas) as conversas
  from public.vocabulario_rastreio('natcorp') group by campo order by 1"
```

Esperado: linhas para `perfil`, `empresa`, `matricula`, `portal`, `usuario`, e
**nenhuma linha** para as seis novas, porque nenhum cliente recolou o bloco
ainda. É exatamente isso que a tela vai mostrar como "esta base nunca enviou
valor nesta dimensão".

- [ ] **Passo 4: conferir que a tela de prompts sugeridos não quebrou**

Ela consome esta RPC. Os nomes `perfil` e `empresa` não mudaram, então o
consumo continua válido; confirme:

```bash
grep -rn "vocabulario_rastreio" src/ --include=*.ts --include=*.tsx
```

Para cada ocorrência, confirme que filtra por `campo === "perfil"` ou
`"empresa"` e não assume que só existem dois campos (um `switch` sem `default`
ou um `.map` sobre tudo passaria a receber dez campos novos).

- [ ] **Passo 5: portão e commit**

```bash
npx tsc --noEmit && npx vitest run && npm run verificar:ui
git add supabase/migrations/20260924232000_vocabulario_doze_dimensoes.sql
git commit -m "O vocabulário de rastreio ia de duas dimensões e a elegibilidade tem doze

vocabulario_rastreio devolvia só perfil e empresa, porque nasceu para o
formulário de prompts sugeridos. Agora é o instrumento de diagnóstico da
elegibilidade: a tela oferece as doze dimensões sempre, e o que evita a regra
impossível virar chamado é dizer se aquela base já enviou algum valor ali.

Presença de dimensão, e não contagem de pessoas, porque medi: natcorp tem 317
conversas e 4 valores distintos de p_usuario, e a maior base conhece 7
usuários. Um contador de alcance mostraria 0 ou 1 para qualquer regra.

campo usa o nome da dimensão (centro_custo), não o do parâmetro
(p_centro_custo), para casar com dimensoes.ts. Traduzir de um lado só já custou
um bug aqui."
```

---

### Tarefa 7: os prompts sugeridos passam a usar o motor

Fecha a duplicação: `src/lib/prompts/elegibilidade.ts` deixa de existir e a
frase passa a vir de um lugar só. Comportamento inalterado, provado pelos
dezesseis testes que já existem.

**`ai_base_tools` NÃO migra**, por decisão do dono, e o motivo vai em
comentário: allowlist de ferramenta decide qual API o modelo pode chamar,
allowlist de conteúdo decide quem pode ver um documento. São perguntas
diferentes que só por acidente têm a mesma forma. Além disso o funil de
ferramentas é superfície medida e mexer nele exigiria `eval:tools` antes e
depois.

**Files:**
- Create: `src/lib/elegibilidade/frase.ts`
- Delete: `src/lib/prompts/elegibilidade.ts`
- Move: `src/lib/prompts/elegibilidade.test.ts` → `src/lib/elegibilidade/frase.test.ts`
- Modify: todo arquivo que importe de `@/lib/prompts/elegibilidade`

**Interfaces:**
- Consumes: `Dimensao` e `DIMENSOES` da tarefa 2.
- Produces: `resumoElegibilidade`, `avisoDeAlcance`, `nomeDoPortal` de
  `@/lib/elegibilidade`. Mesmas assinaturas de hoje.

- [ ] **Passo 1: descobrir quem importa**

```bash
grep -rn "prompts/elegibilidade" src/ --include=*.ts --include=*.tsx
```

Anote a lista. Cada um desses arquivos muda no passo 4.

- [ ] **Passo 2: mover o arquivo e o teste, sem alterar conteúdo**

```bash
git mv src/lib/prompts/elegibilidade.ts src/lib/elegibilidade/frase.ts
git mv src/lib/prompts/elegibilidade.test.ts src/lib/elegibilidade/frase.test.ts
```

- [ ] **Passo 3: em `frase.ts`, trocar o tipo local pelo do motor**

O arquivo declara hoje o próprio `Elegibilidade` com seis arrays. Remova essa
declaração e passe a derivar do motor, para que acrescentar dimensão não exija
editar dois lugares:

```ts
import { DIMENSOES, type Dimensao } from "./dimensoes";

/**
 * A FRASE, e por que ela é o produto e não um enfeite.
 *
 * Seis (agora doze) allowlists combinadas com E é uma regra simples de
 * implementar e difícil de conferir de cabeça: marcar o portal do Gestor E o
 * perfil FOLHA restringe à INTERSEÇÃO, não à união, e quem cadastrou esperando
 * "gestores OU pessoal da folha" só descobre quando alguém reclama de não ver o
 * conteúdo, sem erro em lugar nenhum para investigar.
 *
 * Por isso a tela diz a frase resultante, ao vivo. É a mesma regra do
 * predicado escrita por extenso, e é pura de propósito: mora fora de
 * `server-only` para o formulário poder usá-la.
 *
 * O tipo vem de `dimensoes.ts` e não é declarado aqui: com a lista duplicada,
 * acrescentar uma dimensão compilaria com a frase ignorando a nova, e o
 * sintoma seria a tela descrevendo um alcance mais amplo do que o real.
 */
// A frase descreve a MESMA coisa que o predicado avalia, então usa o MESMO
// tipo. `Elegibilidade` fica só como nome antigo, para os importadores não
// mudarem de assinatura no mesmo commit em que mudam de módulo.
export type { Regra as Elegibilidade } from "./dimensoes";
```

> **Por que não declarar um tipo próprio aqui:** a auto-revisão deste plano
> pegou exatamente isso. `Regra` (em `dimensoes.ts`) e um `Elegibilidade`
> declarado em `frase.ts` seriam dois tipos para a mesma coisa, e o dia em que
> uma dimensão entrar num e não no outro, a frase descreveria um alcance
> diferente do que o predicado aplica. Um tipo só, no arquivo que define as
> dimensões.

Em seguida, onde a função lê as dimensões uma por uma (`e.bases`, `e.portais`
…), mantenha o texto existente para as seis antigas e acrescente as seis novas
com o verbo próprio de cada uma, no mesmo padrão:

```ts
  const filiais = cheios(e.filial);
  const centros = cheios(e.centro_custo);
  const unidadesAdm = cheios(e.unidade_adm);
  const unidadesNeg = cheios(e.unidade_negocio);
  const vinculos = cheios(e.vinculo);
  const sindicatos = cheios(e.sindicato);
  // … e nas partes da frase:
  if (filiais.length) partes.push(`for da filial ${lista(filiais, "ou")}`);
  if (centros.length) partes.push(`for do centro de custo ${lista(centros, "ou")}`);
  if (unidadesAdm.length) partes.push(`for da unidade administrativa ${lista(unidadesAdm, "ou")}`);
  if (unidadesNeg.length) partes.push(`for da unidade de negócio ${lista(unidadesNeg, "ou")}`);
  if (vinculos.length) partes.push(`tiver vínculo ${lista(vinculos, "ou")}`);
  if (sindicatos.length) partes.push(`for do sindicato ${lista(sindicatos, "ou")}`);
```

> **Atenção às chaves:** o tipo antigo usava plural (`bases`, `portais`,
> `perfis`, `empresas`, `usuarios`, `matriculas`); o novo usa o nome da
> dimensão no singular (`base`, `portal`, `perfil`, `usuario`, `empresa`,
> `matricula`). Renomeie os acessos e **os dezesseis testes existentes vão
> falhar até que as chaves do objeto de entrada sejam renomeadas neles também**.
> Isso é esperado e é a prova de que o motor é a única fonte dos nomes.

- [ ] **Passo 4: rodar os dezesseis testes e ver o que falha**

```bash
npx vitest run src/lib/elegibilidade/frase.test.ts
```

Esperado: FAIL nos casos que passam `bases:` / `portais:` etc. Renomeie as
chaves no teste (só as chaves; **nunca** as frases esperadas — se uma frase
mudar, é regressão de comportamento, não renomeação).

- [ ] **Passo 5: rodar de novo**

```bash
npx vitest run src/lib/elegibilidade/frase.test.ts
```

Esperado: PASS, dezesseis testes, com as MESMAS frases esperadas de antes.

- [ ] **Passo 6: reexportar em `index.ts`**

```ts
export { resumoElegibilidade, avisoDeAlcance, nomeDoPortal } from "./frase";
```

- [ ] **Passo 7: apontar os importadores para o motor**

Em cada arquivo da lista do passo 1, troque:

```ts
import { resumoElegibilidade } from "@/lib/prompts/elegibilidade";
```

por:

```ts
import { resumoElegibilidade } from "@/lib/elegibilidade";
```

E renomeie as chaves do objeto que eles montam (plural → singular da dimensão).

- [ ] **Passo 8: deixar escrito por que as ferramentas ficaram fora**

Em `src/lib/elegibilidade/dimensoes.ts`, no fim do arquivo:

```ts
/**
 * `ai_base_tools` NÃO usa este motor, e é decisão do dono (24/09), não
 * esquecimento.
 *
 * Allowlist de FERRAMENTA decide qual API o modelo pode chamar; allowlist de
 * CONTEÚDO decide quem pode ver um documento. São perguntas diferentes que só
 * por acidente têm a mesma forma, e unificá-las faria uma mudança na regra de
 * publicação mexer no roteamento de ferramenta.
 *
 * Além disso o funil de ferramentas é superfície MEDIDA deste produto
 * (`npm run eval:tools`), e mexer nele sem medir antes e depois viola a regra
 * de operação do CLAUDE.md.
 *
 * Se você veio aqui para unificar: leia isto de novo.
 */
```

- [ ] **Passo 9: portão completo**

```bash
npx tsc --noEmit \
  && npx eslint src/lib/elegibilidade/ \
  && npx vitest run \
  && npm run verificar:elegibilidade \
  && npm run verificar:ui \
  && NEXT_PUBLIC_BASE_PATH= npm run build 2>&1 | grep -E "Compiled successfully|error"
```

Esperado: tudo limpo, `Compiled successfully`, e a paridade confirmada.

- [ ] **Passo 10: commit**

```bash
git add -A
git commit -m "A frase da elegibilidade tinha seis dimensões e o motor tem doze

src/lib/prompts/elegibilidade.ts deixa de existir. A frase vem do motor, e o
tipo é derivado de DIMENSOES em vez de declarado à parte: com a lista
duplicada, acrescentar uma dimensão compilaria com a frase ignorando a nova, e
o sintoma seria a tela descrevendo um alcance MAIS AMPLO do que o real.

Os dezesseis testes continuam com as mesmas frases esperadas. Só as chaves de
entrada mudaram de plural para o nome da dimensão, e é isso que prova que o
motor é a única fonte dos nomes.

ai_base_tools ficou fora de propósito, com o motivo escrito em dimensoes.ts
para ninguém tentar unificar depois: allowlist de ferramenta decide qual API o
modelo chama, allowlist de conteúdo decide quem vê um documento, e o funil de
ferramentas é superfície medida."
```

---

## Ordem e dependências

```
T1 (allowlist_casa)  ─┬─> T4 (rastreio + elegivel) ─┬─> T3 passos 5-8 (paridade)
T2 (motor TS) ────────┘                              ├─> T6 (vocabulário)
T3 passos 1-4 (corpus) ──────────────────────────────┘
T5 (APEX) ── independente, mas depois de T4 para os nomes baterem
T7 (prompts) ── por último: depende de T2 e fecha a duplicação
```

T1 pode ir sozinha para produção hoje: corrige um defeito existente e não
depende de nada.

## Definição de pronto

- [ ] `npm run verificar:elegibilidade` passa, com os 21 casos em paridade
- [ ] `npx vitest run` passa inteiro (a suíte tinha 2.492 testes em 24/09)
- [ ] `npm run verificar:ui` diz "Dívida de UI estável"
- [ ] `NEXT_PUBLIC_BASE_PATH= npm run build` compila
- [ ] `grep -rn "prompts/elegibilidade" src/` não devolve nada
- [ ] `vocabulario_rastreio('natcorp')` devolve linhas para as dimensões antigas
      e nenhuma para as seis novas (nenhum cliente recolou o bloco ainda)
- [ ] `public.elegivel` e `alcanca` concordam em todos os casos do corpus
- [ ] `dimensoesComRestricaoVazia` e `normalizarRegra` existem e têm teste (são
      duas das três travas que a spec exige contra a lista em branco; a terceira,
      o interruptor explícito de "sem restrição" na tela, pertence aos projetos
      1 e 2)

## Fora de escopo, e não por esquecimento

Nenhuma tela nova. Nenhuma tabela de documentação ou de conteúdo. Nenhuma
mudança em `widget_keys`, em `conversations.space_id`, no escopo do RAG ou em
`ai_base_tools`. O seletor que lista a estrutura real do cliente
(`estrutura_filiais`, `estrutura_centros_custo`, …) pertence às telas dos
projetos 1 e 2; este projeto entrega a regra e os parâmetros que as telas vão
consumir.
