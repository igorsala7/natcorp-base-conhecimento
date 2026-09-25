"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { loadBaseContext, loadCredentialSecret } from "@/lib/integrations/resolve";
import { executeTool } from "@/lib/integrations/executor";
import {
  chavesProblematicasDaRegra,
  normalizarRegra,
  DIMENSOES,
  type Dimensao,
  type Regra,
} from "@/lib/elegibilidade";
import {
  dimensaoUI,
  extrairValoresDaTool,
  TETO_DE_VALORES,
  type ValorOferecido,
} from "@/lib/documentacoes/dimensoes-ui";

export type Escopo = { tipo: "universal" } | { tipo: "base"; baseId: string };

/**
 * A GRAVAÇÃO confere `ai.configure`, e a BUSCA DE VALORES confere
 * `integrations.manage`. A assimetria é de propósito, e cada uma nomeia o que
 * protege: a primeira é a permissão que as policies das duas tabelas exigem por
 * dentro (senão a action passaria e o banco recusaria depois, com mensagem de
 * banco); a segunda é a da action vizinha que faz exatamente a mesma coisa que a
 * busca — executar uma ferramenta com a credencial do cliente
 * (`testar-tool-action.ts`).
 *
 * Medido em 25/09: as duas pertencem aos MESMOS dois papéis, `owner` (100) e
 * `admin_tech` (80). Ninguém fica de fora pela assimetria.
 */
async function garantirConfigurarIA(): Promise<string | null> {
  try {
    await requirePermission("ai.configure", null);
    return null;
  } catch {
    return "Sem permissão para configurar a IA (ai.configure). O papel Admin técnico já a inclui.";
  }
}

async function garantirGerenciarIntegracoes(): Promise<string | null> {
  try {
    await requirePermission("integrations.manage", null);
    return null;
  } catch {
    return "Sem permissão para gerenciar integrações (integrations.manage).";
  }
}

type LinhaGravada = { enabled: boolean; regra: unknown; criado_por: string | null };

/**
 * ZOD NA FRONTEIRA, MAS NÃO EM CIMA DA `regra` — e a exceção é o ponto.
 *
 * A convenção do projeto é validar toda fronteira com Zod, e aqui ela vale para
 * o que identifica a linha: `spaceId` e `baseId` são uuid, `enabled` é booleano.
 * Uma action é endpoint público para quem tem sessão, e sem isto um `spaceId`
 * vazio viraria erro de cast do Postgres na cara do usuário.
 *
 * A `regra` fica FORA do esquema de propósito. Um `z.object({...doze})` recusaria
 * a chave desconhecida com mensagem de Zod (ou, pior, a descartaria em silêncio,
 * transformando uma regra que fecha numa regra que abre) — e quem tem de julgar
 * isso é `chavesProblematicasDaRegra`, que nomeia o campo errado em português e
 * já é testado contra o gêmeo em SQL. Zod aqui roubaria a decisão do validador
 * que existe para ela.
 */
const escopoSchema = z.union([
  z.object({ tipo: z.literal("universal") }),
  z.object({ tipo: z.literal("base"), baseId: z.string().uuid("Base inválida.") }),
]);

const alvoSchema = z.object({
  escopo: escopoSchema,
  spaceId: z.string().uuid("Escolha a documentação a anexar."),
});

/** As doze, tiradas do motor — nunca uma segunda lista escrita à mão. */
const dimensaoValida = z.enum(DIMENSOES);

/**
 * Grava a regra de elegibilidade de uma documentação anexada.
 *
 * TRÊS TRAVAS, e as três existem porque a falha é silenciosa: regra malformada ou
 * vazia produz conteúdo que não alcança ninguém, sem erro em lugar nenhum.
 *
 *   1. `chavesProblematicasDaRegra` RECUSA antes de gravar: chave fora das doze
 *      (typo como `centro_custos` no plural FECHA nas duas implementações),
 *      valor que não é lista (FECHA também), e lista toda em branco — esta
 *      última faz o contrário, LIBERA, que é o oposto da intenção de quem
 *      digitou;
 *   2. `normalizarRegra` tira branco, caixa e duplicata, para o banco não
 *      acumular ["PG","pg",""," PG "] e a tela não mostrar quatro chips onde há
 *      um valor. Nunca chame esta sem o validador na frente: ela DESCARTA a
 *      chave desconhecida, e uma regra que fecha seria gravada como regra que
 *      abre;
 *   3. o CHECK `regra_valida` no banco é a última, para quem gravar por fora.
 *
 * ── Por que `createClient()` (sessão) e não o cliente admin na GRAVAÇÃO ───────
 * As policies das duas tabelas exigem `ai.configure` por dentro. Gravando pela
 * sessão, a RLS confere DE NOVO o que o `requirePermission` já conferiu — defesa
 * em profundidade de graça. Com o cliente admin (`service_role`, que tem
 * `rolbypassrls`) a única guarda seria a linha do `requirePermission`. Não
 * "simplifique" para um cliente só: a assimetria com a leitura do vocabulário
 * (que PRECISA do admin) é deliberada e está explicada lá.
 */
export async function salvarRegraDocumentacao(input: {
  escopo: Escopo;
  spaceId: string;
  regra: Regra;
  enabled: boolean;
}): Promise<{ ok: true } | { ok: false; erro: string }> {
  const semPermissao = await garantirConfigurarIA();
  if (semPermissao) return { ok: false, erro: semPermissao };

  const alvoOk = alvoSchema.safeParse({ escopo: input.escopo, spaceId: input.spaceId });
  if (!alvoOk.success) {
    return { ok: false, erro: alvoOk.error.issues[0]?.message ?? "Alvo inválido." };
  }
  if (typeof input.enabled !== "boolean") return { ok: false, erro: "Situação inválida." };

  const problemas = chavesProblematicasDaRegra(input.regra);
  if (problemas.length) {
    return {
      ok: false,
      erro:
        `Estes campos não alcançariam ninguém ou alcançariam todo mundo sem você ` +
        `pedir: ${problemas.join(", ")}. Corrija ou remova.`,
    };
  }
  const regra = normalizarRegra(input.regra);
  const db = await createClient();

  const alvo =
    input.escopo.tipo === "universal"
      ? { tabela: "documentacoes_universais" as const, chave: { space_id: input.spaceId }, conflito: "space_id" }
      : {
          tabela: "ai_base_documentacoes" as const,
          chave: { base_id: input.escopo.baseId, space_id: input.spaceId },
          conflito: "base_id,space_id",
        };

  // Leitura ANTES da gravação, e por dois motivos: o `before` do log de auditoria
  // (mudança de alcance sem rastro é o que impede responder "desde quando esse
  // cliente parou de ver isso?") e `criado_por`, que num upsert cego viraria
  // "quem salvou por último" — o nome da coluna passaria a mentir.
  let antes: LinhaGravada | null = null;
  {
    let q = db.from(alvo.tabela).select("enabled, regra, criado_por");
    for (const [k, v] of Object.entries(alvo.chave)) q = q.eq(k, v);
    const { data } = await q.maybeSingle();
    antes = (data as LinhaGravada | null) ?? null;
  }

  const { data: sessao } = await db.auth.getUser();
  const linha: Record<string, unknown> = { ...alvo.chave, regra, enabled: input.enabled };
  if (!antes) linha.criado_por = sessao.user?.id ?? null;

  const { error } = await db
    .from(alvo.tabela)
    .upsert(linha as never, { onConflict: alvo.conflito });

  // O CHECK `regra_valida` no banco é a terceira trava. Se ela disparar aqui, é
  // porque algo chegou por um caminho que as duas primeiras não cobrem — devolva
  // a mensagem do banco em vez de engolir, senão a tela diz "salvo" e nada foi.
  if (error) return { ok: false, erro: error.message };

  await audit({
    action: antes ? "documentacao.regra.editada" : "documentacao.anexada",
    entityType: alvo.tabela,
    entityId: input.escopo.tipo === "base" ? `${input.escopo.baseId}/${input.spaceId}` : input.spaceId,
    spaceId: input.spaceId,
    before: antes ? { enabled: antes.enabled, regra: antes.regra } : null,
    after: { enabled: input.enabled, regra },
  });
  revalidatePath("/admin/integracoes");
  return { ok: true };
}

/**
 * Desanexa a documentação. Some do escopo daquela base (ou de todas, se
 * universal) na próxima pergunta.
 *
 * Remover não é o mesmo que pausar, e a tela oferece os dois: pausar
 * (`enabled = false`) guarda a regra para religar depois; remover joga a regra
 * fora. Sem os dois, quem só queria suspender por uma semana perde a
 * configuração de doze dimensões.
 */
export async function removerDocumentacao(input: {
  escopo: Escopo;
  spaceId: string;
}): Promise<{ ok: true } | { ok: false; erro: string }> {
  const semPermissao = await garantirConfigurarIA();
  if (semPermissao) return { ok: false, erro: semPermissao };

  const alvoOk = alvoSchema.safeParse(input);
  if (!alvoOk.success) {
    return { ok: false, erro: alvoOk.error.issues[0]?.message ?? "Alvo inválido." };
  }

  const db = await createClient();
  // Dois ramos e não um `from(tabela)` com nome em variável: as duas tabelas têm
  // colunas diferentes (`base_id` só existe numa), e o tipo gerado do banco
  // recusa a coluna quando o nome da tabela é união.
  const tabela = input.escopo.tipo === "universal" ? "documentacoes_universais" : "ai_base_documentacoes";
  const { error } =
    input.escopo.tipo === "universal"
      ? await db.from("documentacoes_universais").delete().eq("space_id", input.spaceId)
      : await db
          .from("ai_base_documentacoes")
          .delete()
          .eq("space_id", input.spaceId)
          .eq("base_id", input.escopo.baseId);
  if (error) return { ok: false, erro: error.message };

  await audit({
    action: "documentacao.desanexada",
    entityType: tabela,
    entityId: input.escopo.tipo === "base" ? `${input.escopo.baseId}/${input.spaceId}` : input.spaceId,
    spaceId: input.spaceId,
    before: { removida: true },
    after: null,
  });
  revalidatePath("/admin/integracoes");
  return { ok: true };
}

// ── Diagnóstico de presença: o que esta base JÁ ENVIOU em cada dimensão ──────

export type Vocabulario = {
  /** Dimensão → valores distintos já vistos, do mais frequente para o menos. */
  porDimensao: Partial<Record<Dimensao, { valor: string; conversas: number }[]>>;
  /** Quantas conversas a base tem. Zero explica um vocabulário vazio inteiro. */
  conversas: number;
  /** Login do ERP usado para consultar as listas de cadastro (ver `valoresDaDimensao`). */
  usuarioParaConsulta: string | null;
};

/**
 * O VOCABULÁRIO VAI PELO CLIENTE ADMIN, E ISTO É MEDIDO, NÃO PREFERÊNCIA.
 *
 * `public.vocabulario_rastreio` NÃO é executável por `authenticated`: medido em
 * 25/09, `has_function_privilege('authenticated', …, 'EXECUTE') = false`. A
 * migration `20260925003000_vocabulario_sem_authenticated.sql` revogou de
 * propósito, com autorização do dono — a função é `security definer` e, com
 * `base_ref` nulo, devolve perfil, empresa, usuário e MATRÍCULA de todos os
 * clientes. Chamada pelo cliente de SESSÃO ela responde permissão negada e o
 * diagnóstico de presença simplesmente não carrega.
 *
 * NÃO reconceda EXECUTE a `authenticated`: seria reverter uma decisão de
 * segurança que o dono autorizou. O caminho é este — `createAdminClient()`
 * DEPOIS do `requirePermission` na mesma função, que é o que garante que só quem
 * já podia configurar chega aqui.
 */
async function lerVocabulario(baseCode: string | null): Promise<Vocabulario> {
  const db = createAdminClient();
  const base = baseCode?.trim() || null;

  // Paginado por RANGE, e não numa chamada só: o teto de linhas do PostgREST
  // vale para função que devolve tabela do mesmo jeito que para SELECT, e uma
  // base grande passa de mil valores distintos somando as onze dimensões. Ler
  // 1.000 de 5.569 e achar que leu tudo é o defeito que já voltou sete vezes
  // neste projeto — e aqui ele produziria "esta base nunca enviou valor para X"
  // sobre uma dimensão que a base envia desde sempre.
  const linhas = await fetchAllPaged<{ campo: string; valor: string; conversas: number }>((de, ate) =>
    db
      .rpc("vocabulario_rastreio", { base_ref: base ?? undefined })
      .select("campo, valor, conversas")
      .range(de, ate),
  );

  const porDimensao: Vocabulario["porDimensao"] = {};
  for (const d of DIMENSOES) {
    const valores = linhas
      .filter((l) => l.campo === d && l.valor)
      .map((l) => ({ valor: l.valor, conversas: Number(l.conversas) || 0 }))
      .sort((a, b) => b.conversas - a.conversas)
      .slice(0, TETO_DE_VALORES);
    if (valores.length) porDimensao[d] = valores;
  }

  // Contagem por `head: true`: o número de conversas é o que distingue "esta
  // base nunca mandou p_filial" de "esta base nunca conversou", e as duas pedem
  // ações opostas de quem configura. O `.limit(1)` não muda o total (o `count`
  // exato vem no cabeçalho, não no corpo) e é o que declara que esta leitura não
  // depende de linha nenhuma — `conversations` passa de mil linhas há muito, e é
  // a ausência de teto que já custou sete leituras silenciosamente truncadas
  // neste projeto.
  const contagem = db.from("conversations").select("id", { count: "exact", head: true }).limit(1);
  const { count } = base ? await contagem.ilike("p_base", base.replace(/([\\%_])/g, "\\$1")) : await contagem;

  return {
    porDimensao,
    conversas: count ?? 0,
    usuarioParaConsulta: porDimensao.usuario?.[0]?.valor ?? null,
  };
}

export async function vocabularioDaBase(
  baseCode: string | null,
): Promise<{ ok: true; vocab: Vocabulario } | { ok: false; erro: string }> {
  const semPermissao = await garantirConfigurarIA();
  if (semPermissao) return { ok: false, erro: semPermissao };
  try {
    return { ok: true, vocab: await lerVocabulario(baseCode) };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Falha ao ler o vocabulário da base." };
  }
}

// ── Listas de valor: o cadastro do ERP do cliente ────────────────────────────

export type ListaDeValores =
  | { ok: true; valores: ValorOferecido[]; total: number; usuario: string; formatoDesconhecido: boolean }
  /** A lista NÃO veio, e o motivo vai para a tela. "Vazia" e "indisponível" são
   *  coisas diferentes para quem está configurando. */
  | { ok: false; motivo: string };

/**
 * Busca no ERP do cliente os valores de uma dimensão, pela ferramenta cadastrada.
 *
 * Reusa `loadBaseContext` + o `executeTool` de PRODUÇÃO, como
 * `testar-tool-action.ts` na mesma pasta: um buscador que monta a requisição por
 * conta própria testa a si mesmo, não a integração.
 *
 * ── O LOGIN DO ERP, e por que ele vem do rastreio ────────────────────────────
 * As seis ferramentas de estrutura declaram `usuario` (ou `p_usuario`) como
 * parâmetro OBRIGATÓRIO de origem `identidade` — é ele que escopa a consulta no
 * ORDS. Medido em 25/09 contra a base natcorp: com identidade vazia, cinco das
 * seis nem saem (`resolveParams` levanta "Parâmetro obrigatório ausente"), e só
 * `estrutura_vinculos_empregaticios` responde, porque a tabela dele é global. Com
 * um login real, as seis respondem 200 (16 empresas, 142 filiais, 2.847 centros
 * de custo, 139 unidades, 14 vínculos, 0 sindicatos).
 *
 * A tela do admin não tem token de rastreio, então o login sai do vocabulário da
 * própria base: o `p_usuario` que MAIS aparece nas conversas dela. É um usuário
 * real daquele cliente, a credencial continua sendo a da base, o método é GET, e
 * a tela DIZ qual login foi usado — o admin precisa saber, porque o ORDS escopa
 * por usuário e uma lista curta pode ser recorte de permissão, não cadastro
 * pequeno.
 *
 * Isto é uma decisão que o dono pode querer outra (um login de serviço por base,
 * por exemplo). Está aqui, visível e reversível em uma linha, porque a
 * alternativa era a lista nunca carregar em cinco das seis dimensões.
 */
export async function valoresDaDimensao(baseCode: string, dimensao: Dimensao): Promise<ListaDeValores> {
  const semPermissao = await garantirGerenciarIntegracoes();
  if (semPermissao) return { ok: false, motivo: semPermissao };

  // Dimensão fora das doze faria `dimensaoUI` devolver `undefined` e a linha
  // seguinte estourar — a lista é de tamanho fixo e o `find` lá dentro usa `!`.
  if (!dimensaoValida.safeParse(dimensao).success) {
    return { ok: false, motivo: `"${String(dimensao)}" não é uma das doze dimensões.` };
  }
  const ui = dimensaoUI(dimensao);
  // `origem` numa const: o `await` mais abaixo faz o TypeScript perder o
  // estreitamento de `ui.origem.tipo`, e sem a const `origem.key` não compila.
  const origem = ui.origem;
  if (origem.tipo !== "tool") {
    return { ok: false, motivo: origem.tipo === "digitacao" ? origem.porque : "Esta dimensão não vem do ERP." };
  }
  const base = baseCode.trim();
  if (!base) return { ok: false, motivo: "Escolha um cliente antes de buscar a lista." };

  let usuario: string | null;
  try {
    // `lerVocabulario` usa o cliente ADMIN, e já passamos por
    // `requirePermission` acima — é a mesma ordem exigida em `vocabularioDaBase`.
    usuario = (await lerVocabulario(base)).usuarioParaConsulta;
  } catch (e) {
    return {
      ok: false,
      motivo: `Não deu para descobrir um login do ERP: ${e instanceof Error ? e.message : "falha na leitura"}.`,
    };
  }
  if (!usuario) {
    return {
      ok: false,
      motivo:
        `Nenhuma conversa da base ${base} registrou um usuário do ERP, e o cadastro de ` +
        `${ui.rotulo.toLowerCase()} exige um para responder. Digite o valor à mão.`,
    };
  }

  const ctx = await loadBaseContext(base.toLowerCase());
  const bt = ctx?.tools.find((t) => t.tool.key === origem.key);
  if (!bt?.baseUrl) {
    return {
      ok: false,
      motivo:
        `A ferramenta ${origem.key} não está ativa na base ${base}. Libere-a em ` +
        `"Acesso por base" ou digite o valor à mão.`,
    };
  }

  /**
   * SÓ LEITURA, e aqui a trava é MAIS necessária que no vizinho que a inspirou.
   *
   * `testarTool` recusa método diferente de GET porque um teste que escreve num
   * ERP de produção cria registro de verdade a cada clique. Esta função tem a
   * mesma consequência e uma superfície pior: ela não espera clique nenhum —
   * dispara sozinha quando o admin liga "Restringir" numa dimensão.
   *
   * As seis ferramentas de estrutura são GET hoje (medido em 25/09), então a
   * checagem não muda nada agora. É exatamente por isso que ela entra: sem a
   * linha, a garantia de que este caminho nunca escreve no ERP do cliente está
   * apoiada no estado atual do cadastro, e uma edição em "APIs / Tools" a
   * derrubaria sem ninguém notar.
   */
  const metodo = String(bt.tool.method ?? "GET").toUpperCase();
  if (metodo !== "GET") {
    return {
      ok: false,
      motivo:
        `A ferramenta ${origem.key} está cadastrada como ${metodo}, e esta tela só consulta ` +
        `lista por GET — buscar valores não pode escrever no ERP do cliente. Digite o valor à mão.`,
    };
  }

  try {
    const cred = bt.credentialId ? await loadCredentialSecret(bt.credentialId) : null;
    const r = await executeTool({
      tool: bt.tool,
      baseUrl: bt.baseUrl,
      credential: cred,
      modelArgs: {},
      identity: { usuario, base } as never,
      timeoutMs: 20_000,
    });
    if (!r.ok) {
      return { ok: false, motivo: `A base ${base} respondeu ${r.status} ao pedir a lista. Digite o valor à mão.` };
    }
    const { valores, total, formatoDesconhecido } = extrairValoresDaTool(origem, r.data);
    return { ok: true, valores, total, usuario, formatoDesconhecido };
  } catch (e) {
    // `resolveParams` levanta quando falta parâmetro obrigatório, e o `fetch`
    // levanta em rede/timeout. A mensagem do motor já diz de onde o parâmetro
    // deveria vir, então repassá-la é melhor que traduzi-la para "falhou".
    return {
      ok: false,
      motivo: `${e instanceof Error ? e.message : "Falha ao consultar o ERP."} Digite o valor à mão.`,
    };
  }
}
