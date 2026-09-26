"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sessaoSchema,
  baseDaSessao,
  autorDa,
  type SessaoResolvida,
  type ResultadoAcao,
} from "@/lib/gestao/acao";
import {
  chavesProblematicasDaRegra,
  normalizarRegra,
  DIMENSOES,
  type Dimensao,
  type Regra,
} from "@/lib/elegibilidade";
import { daOfertaUniversal, regraAlcancaBase } from "@/lib/documentacoes/universais";
import { exclusoesEntreRegras, mensagemDeExclusao } from "@/lib/documentacoes/regras-combinadas";
import { buscarValoresNoErp } from "@/lib/documentacoes/valores-erp";
import type { ListaDeValores } from "@/lib/documentacoes/dimensoes-ui";
import {
  anexarArquivoDaBase,
  excluirArquivoDaBase,
  arquivosDaBase,
  type ArquivoDaBase,
} from "@/lib/documentacoes/arquivos-da-base";

/**
 * Ações da aba Conteúdo, na área do CLIENTE.
 *
 * ── A RLS NÃO PROTEGE NADA NESTE CAMINHO, e é por isso que os comentários
 *    abaixo não são estilo ─────────────────────────────────────────────────
 *
 * A área do cliente não tem sessão do Supabase: a identidade dela é um token
 * assinado que o APEX entrega na querystring. Toda escrita vai por
 * `createAdminClient()`, que usa `service_role` — e `service_role` tem
 * `rolbypassrls`. As policies de `documentacoes_universais` e
 * `ai_base_documentacoes` exigem `ai.configure`, permissão que o cliente não tem
 * e não deve ter; se dependêssemos delas, a tela simplesmente não funcionaria.
 *
 * Então a autorização é do CÓDIGO, não do banco, e ela são três linhas, cada uma
 * fechando um buraco diferente:
 *
 *   1. a BASE vem de `baseDaSessao`, que revalida o token — nunca do formulário.
 *      Um POST forjado com a base do vizinho para lá;
 *   2. `documentacoes_universais` NUNCA é escrita aqui. É a oferta da Natcorp,
 *      editada em `/admin/integracoes`. Este arquivo só a LÊ, para saber de qual
 *      poço o cliente pode escolher;
 *   3. o `space_id` recebido é conferido contra esse poço por
 *      `documentacaoOferecidaPelaNatcorp` — ver o comentário dela, que explica o
 *      que acontece sem isso.
 *
 * O precedente é `src/app/gestao/prompts/actions.ts`, que resolve o mesmo
 * problema (gaveta do cliente × gaveta global) nesta mesma superfície.
 *
 * ── O QUE UMA LINHA DE `ai_base_documentacoes` SIGNIFICA ─────────────────
 *
 * Ela é uma SOBREPOSIÇÃO sobre a documentação universal, no mesmo espírito de
 * `space_overlays` (que o produto já usa para conteúdo, com `hidden` e
 * `override_article_id`):
 *
 *   · sem linha             → vale a universal, com a regra da Natcorp;
 *   · linha `enabled=false` → aquela documentação DESAPARECE para os usuários
 *                             desta base;
 *   · linha `enabled=true`  → a pessoa precisa satisfazer AS DUAS regras, a da
 *                             Natcorp e a da base. INTERSEÇÃO, não substituição.
 *
 * O lado SQL disso é a migration `20260925140000_escopo_com_sobreposicao_por_
 * base.sql` (tarefa 9), que também explica por que a decisão do dono foi
 * interseção: substituir deixaria um cliente ABRIR o que a Natcorp fechou —
 * liberar para a empresa inteira uma documentação restrita a um portal, o que
 * poria o manual do Operador na frente de um Colaborador. A regra da Natcorp é
 * TETO; o cliente só aperta. `escopo_documentacao` é `security definer` e tem
 * assertivas comportamentais: mexer nela exige rodar `verificar:isolamento`.
 *
 * A TELA foi corrigida junto (rodada 1 da tarefa 8): ela mostra DUAS frases, uma
 * por regra, e a conjunção por extenso. Não mostra uma frase da combinação de
 * propósito — interseccionar `["PG"]` com `["PO"]` dá lista vazia, e lista vazia
 * LIBERA neste motor, então a frase diria "todos alcançam" onde ninguém alcança.
 * Ver `regras-combinadas.ts`.
 *
 * Consequência que vale registrar: `ai_base_documentacoes` passa a referenciar
 * SOMENTE documentação universal. "Documentação exclusiva de um cliente" não
 * mora nesta tabela — o que é exclusivo do cliente é o ARQUIVO dele
 * (`knowledge_documents` com `base_id`), e as ações dele estão no FIM deste
 * arquivo, sob "OS ARQUIVOS DA EMPRESA".
 */

const alvoSchema = sessaoSchema.extend({
  spaceId: z.string().uuid("Escolha a documentação."),
});

const ajusteSchema = alvoSchema.extend({
  enabled: z.boolean(),
  /**
   * A `regra` fica FORA do esquema do Zod de propósito, e a justificativa é a
   * mesma de `documentacoes-actions.ts`: um `z.object({...doze})` recusaria a
   * chave desconhecida com mensagem de Zod ou, pior, a descartaria em silêncio,
   * transformando uma regra que FECHA numa regra que ABRE. Quem tem de julgar
   * isso é `chavesProblematicasDaRegra`, que nomeia o campo errado em português
   * e já é testado contra o gêmeo em SQL. Zod aqui roubaria a decisão do
   * validador que existe para ela.
   */
  regra: z.unknown(),
});

const listaSchema = sessaoSchema.extend({
  dimensao: z.enum(DIMENSOES),
});

/**
 * DE QUAL POÇO O CLIENTE ESCOLHE — e o que acontece sem esta função.
 *
 * Não existe no banco vínculo entre um cliente e um conjunto de documentações:
 * `ai_bases` não tem coluna de chave nem de espaço, e `widget_keys` não tem
 * coluna de base (medido em 25/09). A ligação acontece só em tempo de execução,
 * pela chave instalada na página. Ou seja: nada no banco impede uma linha de
 * `ai_base_documentacoes` apontar para QUALQUER espaço.
 *
 * Então, sem esta conferência, o cliente A manda um `space_id` qualquer no
 * formulário e passa a ler a documentação CUSTOMIZADA do cliente B — com os
 * dados dele dentro. O isolamento que as tarefas 1 a 7 construíram no banco cai
 * por uma tela, e cai em silêncio: a gravação funcionaria, e o vazamento
 * apareceria como uma resposta do assistente citando um documento que não é
 * daquele cliente.
 *
 * A trava é: o `space_id` tem de estar em `documentacoes_universais` com
 * `enabled = true`, E a regra da Natcorp tem de alcançar A BASE desta sessão
 * pela dimensão `base`. Um cliente nunca alcança um espaço que a Natcorp não
 * ofereceu a ele. Tem uma segunda razão além da segurança, e ela chegou depois:
 * sobreposição só faz sentido sobre algo que existe universalmente — sem a linha
 * universal, não há o que esconder nem que regra substituir.
 *
 * ── A SEGUNDA METADE, que faltou até a tarefa 14 ──────────────────────────
 * `enabled = true` sozinho não basta: uma universal pode estar ATIVA e mesmo
 * assim ter `regra.base` restringindo a OUTROS clientes — é como a Natcorp
 * oferece uma documentação para alguns e não para todos, sem desativá-la para
 * ninguém. Sem esta segunda checagem, o cliente salvava uma configuração para
 * uma documentação que a Natcorp nunca ofereceu A ELE: a gravação respondia
 * `ok: true`, e o ajuste não abria acesso a NADA — falha silenciosa, porque
 * `public.escopo_documentacao` reavalia a regra da Natcorp contra a identidade
 * real a cada turno e contém o dano na camada SQL (não vazava conteúdo de
 * outro cliente; só gravava sem efeito). Ver `regraAlcancaBase`, que é a MESMA
 * função que `page.tsx` usa para montar a lista — duas implementações
 * divergentes é exatamente esse defeito.
 *
 * Oferecer uma documentação a um cliente só NÃO passa por aqui: é a Natcorp
 * entrando nesta página em modo SUPORTE, que é o mesmo mecanismo que a tela de
 * prompts já usa para o catálogo global.
 *
 * NÃO remova por parecer redundante com a tela: a tela só oferece o poço, mas
 * Server Action é endpoint — quem chama pode não ser a nossa página.
 */
async function documentacaoOferecidaPelaNatcorp(
  spaceId: string,
  baseCode: string,
): Promise<{ ok: true; regraDaNatcorp: Regra } | { ok: false; erro: string }> {
  const oferta = await daOfertaUniversal(spaceId);
  if (oferta && regraAlcancaBase(oferta.regra, baseCode)) {
    return { ok: true, regraDaNatcorp: oferta.regra };
  }
  // A MESMA mensagem nos dois motivos (fora do poço, ou dentro do poço mas
  // restrita a outra empresa): as duas são igualmente verdadeiras do ponto de
  // vista de QUEM LÊ ("não está entre as que a Natcorp oferece para a sua
  // empresa"), e distinguir aqui exigiria nomear a restrição — que, no segundo
  // caso, é nomear o código de outro cliente numa tela deste.
  return {
    ok: false,
    erro:
      "Esta documentação não está entre as que a Natcorp oferece para a sua empresa. " +
      "Atualize a página; se continuar, fale com o suporte.",
  };
}

/**
 * Registro da ação, com o autor do ERP ou o interno, como no resto da área.
 *
 * ── A FALHA DO REGISTRO VAI PARA O LOG, e o motivo não é zelo ────────────
 * Toda coluna usada aqui é anulável, então este insert passa hoje. Mas o retorno
 * era ignorado: se ele passasse a falhar (policy nova, coluna que muda de tipo,
 * `actor_id` apontando para um usuário removido), a ação responderia `ok` e o
 * RASTRO da superfície mais sensível deste ramo desapareceria em silêncio —
 * exatamente a pergunta que o log de auditoria existe para responder ("desde
 * quando esse usuário parou de ver isso?").
 *
 * E é LOG, não recusa: a configuração já está gravada quando chegamos aqui.
 * Devolver erro faria o cliente achar que o ajuste não valeu e tentar de novo.
 */
async function registrar(
  sessao: SessaoResolvida,
  acao: string,
  spaceId: string,
  antes: Record<string, unknown> | null,
  depois: Record<string, unknown> | null,
) {
  const { error } = await createAdminClient()
    .from("audit_log")
    .insert({
      actor_id: sessao.operadorId,
      action: acao,
      entity_type: "ai_base_documentacoes",
      entity_id: `${sessao.baseId}/${spaceId}`,
      space_id: spaceId,
      // `as never` só no `before`: as colunas são `Json` no tipo gerado, e um
      // `Record<string, unknown>` vindo de variável não estreita para `Json`. O
      // conteúdo é o que a linha tinha antes, lido do próprio banco.
      before: antes as never,
      after: depois
        ? { ...depois, por: autorDa(sessao), via_suporte: sessao.modo === "suporte" }
        : { por: autorDa(sessao), via_suporte: sessao.modo === "suporte" },
    });
  if (error) {
    console.error(
      `[gestao/conteudo] auditoria PERDIDA — ação "${acao}" na base ${sessao.baseId}, espaço ${spaceId}:`,
      error.message,
    );
  }
}

function revalidar() {
  revalidatePath("/gestao/conteudo");
}

type LinhaGravada = { enabled: boolean; regra: unknown; criado_por: string | null };

/** A sobreposição desta base para esta documentação, se existir. */
async function linhaAtual(baseId: string, spaceId: string): Promise<LinhaGravada | null> {
  const { data } = await createAdminClient()
    .from("ai_base_documentacoes")
    .select("enabled, regra, criado_por")
    .eq("base_id", baseId)
    .eq("space_id", spaceId)
    .maybeSingle();
  return (data as LinhaGravada | null) ?? null;
}

/**
 * Grava a sobreposição da base: esconder a documentação, ou trocar a regra dela.
 *
 * AS TRÊS TRAVAS DA REGRA, e a ORDEM entre as duas primeiras é obrigatória:
 *
 *   1. `chavesProblematicasDaRegra` RECUSA antes de gravar — chave fora das doze
 *      (typo como `centro_custos` no plural FECHA nas duas implementações), valor
 *      que não é lista (FECHA também), e lista toda em branco, que faz o
 *      contrário: LIBERA, o oposto da intenção de quem digitou;
 *   2. `normalizarRegra` tira branco, caixa e duplicata, para o banco não
 *      acumular ["PG","pg",""," PG "] e a tela não mostrar quatro chips onde há
 *      um valor. Nunca chame esta sem o validador na frente: ela DESCARTA a
 *      chave desconhecida, e uma regra que fecha seria gravada como regra que
 *      abre;
 *   3. o CHECK `regra_valida` no banco é a última, para quem gravar por fora.
 */
export async function salvarAjusteDeDocumentacao(input: unknown): Promise<ResultadoAcao> {
  const parsed = ajusteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const sessao = await baseDaSessao(parsed.data);
  if (!sessao.ok) return { ok: false, erro: sessao.erro };

  const noPoco = await documentacaoOferecidaPelaNatcorp(parsed.data.spaceId, sessao.base);
  if (!noPoco.ok) return { ok: false, erro: noPoco.erro };

  // A regra chega como `unknown` de um endpoint. O que precisa ser garantido
  // aqui é só que ela é um OBJETO — o julgamento do conteúdo é do validador,
  // logo abaixo, que sabe nomear o campo errado em português.
  const bruta = parsed.data.regra ?? {};
  if (typeof bruta !== "object" || bruta === null || Array.isArray(bruta)) {
    return { ok: false, erro: "Configuração de alcance inválida. Atualize a página e tente de novo." };
  }

  const problemas = chavesProblematicasDaRegra(bruta as Regra);
  if (problemas.length) {
    return {
      ok: false,
      erro:
        `Estes campos não alcançariam ninguém ou alcançariam todo mundo sem você ` +
        `pedir: ${problemas.join(", ")}. Corrija ou remova.`,
    };
  }
  const regra = normalizarRegra(bruta as Regra);

  /**
   * A QUARTA TRAVA, e ela é da combinação, não da regra sozinha.
   *
   * As duas regras valem ao mesmo tempo (`public.escopo_documentacao` faz E), e
   * duas listas disjuntas na mesma dimensão produzem documentação que NINGUÉM
   * alcança. Isso nunca é intenção: quem quer esconder usa `enabled = false`.
   * Como o efeito seria silencioso — grava, e o usuário só descobre quando
   * alguém reclama de não ver o conteúdo —, recusa, pelo mesmo motivo das três
   * anteriores. Depois de `normalizarRegra` de propósito: é a regra que de fato
   * vai ao banco que precisa ser confrontada com a da Natcorp.
   *
   * Só quando a documentação está VISÍVEL: ocultar é justamente o caminho
   * legítimo para "ninguém alcança", e recusar ali seria impedir a intenção que
   * a mensagem manda usar.
   */
  if (parsed.data.enabled) {
    const exclusoes = exclusoesEntreRegras(noPoco.regraDaNatcorp, regra);
    if (exclusoes.length) return { ok: false, erro: mensagemDeExclusao(exclusoes) };
  }

  // Leitura ANTES da gravação, e por dois motivos: o `before` do registro (mudança
  // de alcance sem rastro é o que impede responder "desde quando esse usuário
  // parou de ver isso?") e `criado_por`, que num upsert cego viraria "quem salvou
  // por último" — o nome da coluna passaria a mentir.
  const antes = await linhaAtual(sessao.baseId, parsed.data.spaceId);

  const linha: Record<string, unknown> = {
    // A BASE VEM DA SESSÃO. Não existe caminho neste arquivo em que ela venha do
    // formulário: `parsed.data` nem tem campo de base a ler.
    base_id: sessao.baseId,
    space_id: parsed.data.spaceId,
    regra,
    enabled: parsed.data.enabled,
  };
  // `criado_por` referencia `auth.users`: no modo cliente não há usuário do
  // Supabase, e a autoria real do cliente fica no registro de auditoria (`por`).
  if (!antes) linha.criado_por = sessao.operadorId;

  const { error } = await createAdminClient()
    .from("ai_base_documentacoes")
    .upsert(linha as never, { onConflict: "base_id,space_id" });

  /*
    O CHECK `regra_valida` no banco é a terceira trava. Se ela disparar aqui, é
    porque algo chegou por um caminho que as duas primeiras não cobrem — hoje
    praticamente inalcançável, mas "praticamente" não é "nunca".

    A mensagem CRUA do Postgres (nome de tabela, de constraint) não é para quem
    está deste lado da tela: um analista de implantação do CLIENTE, não um
    engenheiro. Trocar por frase de produto — mas sem ENGOLIR o erro, que é o
    defeito oposto: ele vai para o log do servidor, de onde dá para investigar.
  */
  if (error) {
    console.error("[gestao/conteudo] falha ao gravar ai_base_documentacoes:", error);
    return {
      ok: false,
      erro: "Não foi possível salvar esta configuração. Atualize a página e tente de novo; se continuar, fale com o suporte.",
    };
  }

  await registrar(
    sessao,
    parsed.data.enabled ? "gestao.documentacao.ajustada" : "gestao.documentacao.ocultada",
    parsed.data.spaceId,
    antes ? { enabled: antes.enabled, regra: antes.regra } : null,
    { enabled: parsed.data.enabled, regra },
  );
  revalidar();
  return { ok: true };
}

/**
 * Desfaz a sobreposição: a documentação volta a valer como a Natcorp configurou.
 *
 * Apagar a linha é o que devolve o padrão, e continua sendo diferente de ligar
 * de volta com regra vazia, mesmo com interseção: sem linha, a documentação sai
 * da contagem de "ajustadas" e volta a seguir a Natcorp automaticamente quando
 * ela mudar de regra; com linha de regra vazia, a base fica marcada como
 * ajustada para sempre (a interseção só não estreita HOJE). A tela oferece os
 * dois, com nomes diferentes, porque a diferença é visível para quem configura.
 */
export async function voltarAoPadraoDeDocumentacao(input: unknown): Promise<ResultadoAcao> {
  const parsed = alvoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const sessao = await baseDaSessao(parsed.data);
  if (!sessao.ok) return { ok: false, erro: sessao.erro };

  /*
    AQUI A CONFERÊNCIA DO POÇO NÃO ENTRA, e a ausência é deliberada.

    Apagar a sobreposição da PRÓPRIA base não alcança documentação de ninguém: a
    `base_id` vem da sessão, então o pior caso é apagar uma linha que já não
    devia existir. Exigir que o espaço ainda esteja na oferta faria o contrário
    do que se quer — a Natcorp retira uma documentação do poço, e o cliente fica
    preso a uma linha órfã que ele não consegue limpar.
  */
  const antes = await linhaAtual(sessao.baseId, parsed.data.spaceId);
  if (!antes) return { ok: true }; // já está no padrão; nada a fazer e nada a registrar

  const { error } = await createAdminClient()
    .from("ai_base_documentacoes")
    .delete()
    .eq("base_id", sessao.baseId)
    .eq("space_id", parsed.data.spaceId);
  if (error) return { ok: false, erro: error.message };

  await registrar(
    sessao,
    "gestao.documentacao.padrao",
    parsed.data.spaceId,
    { enabled: antes.enabled, regra: antes.regra },
    null,
  );
  revalidar();
  return { ok: true };
}

/**
 * A lista de valores de uma dimensão, do ERP DESTE cliente.
 *
 * ── O login é o de quem está olhando a tela ──────────────────────────────
 * É a correção que esta tarefa trouxe de graça. A tela do admin não tem
 * identidade nenhuma e resolvia isso pegando o `p_usuario` que mais aparece nas
 * conversas da base — consultando o ERP do cliente em nome de um funcionário
 * real que não pediu nada. Aqui existe login de verdade, vindo do token
 * assinado, e a consulta sai com ele.
 *
 * ── Em modo SUPORTE não há login, e não se inventa um ────────────────────
 * `identidade.usuario` é nulo no suporte por decisão de desenho (ver
 * `src/lib/gestao/sessao.ts`: "Não se passa por ninguém"). A dimensão então cai
 * para digitação livre COM O MOTIVO na tela, que é o que separa "este cliente
 * não tem nenhum" de "não deu para consultar". Não reintroduza a heurística do
 * usuário mais frequente por este caminho.
 */
export async function valoresParaDimensao(input: unknown): Promise<ListaDeValores> {
  const parsed = listaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, motivo: "Dimensão inválida." };

  const sessao = await baseDaSessao(parsed.data);
  if (!sessao.ok) return { ok: false, motivo: sessao.erro };

  if (!sessao.usuario) {
    return {
      ok: false,
      motivo: "O modo suporte não tem login do ERP; digite o valor.",
    };
  }

  return buscarValoresNoErp({
    base: sessao.base,
    dimensao: parsed.data.dimensao as Dimensao,
    usuario: sessao.usuario,
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   OS ARQUIVOS DA EMPRESA

   A outra metade da aba Conteúdo. Acima, o cliente escolhe sobre QUAIS
   documentações da Natcorp o assistente responde. Aqui ele traz o conteúdo DELE:
   *"ele pode anexar qualquer tipo de mídia para ficar disponível para download, e
   se for word, pdf, ppt, txt ou md, o usuário decidir se quer que o conteúdo seja
   incluído na base de conhecimento e/ou disponível para download pelo usuário no
   chatbot"*.

   O mecanismo inteiro (validação, Storage, chunks, cascade) mora em
   `src/lib/documentacoes/arquivos-da-base.ts`, puro de sessão e de UI. O que
   pertence a ESTE arquivo é o que só ele tem: a sessão revalidada, o `baseId` que
   sai dela, e o registro em `audit_log`.

   AS TRÊS PONTAS DO MESMO ARQUIVO, para quem chegar por uma delas:
     · aqui e no mecanismo .......... subir, listar e excluir (área do cliente);
     · `src/components/gestao/arquivos-painel.tsx` ... a tela, com as duas
       escolhas e o formulário de alcance;
     · `src/app/api/v1/arquivo/[id]/route.ts` ....... o DOWNLOAD pelo chatbot,
       que é o único caminho em que o arquivo sai — e que confere dono,
       liberação e alcance de novo, porque o widget é público e nada que ele
       diga é decisão.

   A BASE NUNCA VEM DO FORMULÁRIO. Vale para as três ações abaixo, e é a mesma
   razão das ações de documentação: Server Action é endpoint, e este caminho grava
   com `service_role`, que tem `rolbypassrls`. Não há RLS para corrigir um erro
   nosso aqui.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Registro das ações de arquivo.
 *
 * Separado de `registrar` porque a entidade é outra (`knowledge_document`, com id
 * próprio) e porque arquivo de empresa não tem `space_id` — reaproveitar a outra
 * exigiria inventar um espaço para a coluna, e uma linha de auditoria com espaço
 * inventado é pior que uma sem.
 *
 * A falha do insert vai para o LOG pela mesma razão de `registrar`, acima: o
 * arquivo já subiu (ou já foi excluído) quando chegamos aqui, então recusar
 * mentiria sobre o que aconteceu — mas perder o rastro em silêncio é como se
 * ninguém tivesse anexado nada.
 */
async function registrarArquivo(
  sessao: SessaoResolvida,
  acao: string,
  documentId: string,
  antes: Record<string, unknown> | null,
  depois: Record<string, unknown> | null,
) {
  const { error } = await createAdminClient()
    .from("audit_log")
    .insert({
      actor_id: sessao.operadorId,
      action: acao,
      entity_type: "knowledge_document",
      entity_id: documentId,
      space_id: null,
      before: antes as never,
      after: {
        ...(depois ?? {}),
        base: sessao.base,
        por: autorDa(sessao),
        via_suporte: sessao.modo === "suporte",
      } as never,
    });
  if (error) {
    console.error(
      `[gestao/conteudo] auditoria PERDIDA — ação "${acao}" no documento ${documentId} da base ${sessao.baseId}:`,
      error.message,
    );
  }
}

export type ResultadoAnexoAcao = { ok: true; chunks: number } | { ok: false; erro: string };
export type ListaDeArquivos =
  | { ok: true; arquivos: ArquivoDaBase[] }
  | { ok: false; erro: string };

/**
 * Anexa um arquivo da empresa.
 *
 * ── Por que `FormData` e não um objeto ───────────────────────────────────
 * O arquivo tem de ATRAVESSAR, e `FormData` é o transporte que o navegador e o
 * Next já combinam para bytes. Os campos de sessão viajam nele como em qualquer
 * formulário da área; a regra viaja como JSON em um campo, porque ela é um objeto
 * de doze chaves possíveis e espalhá-la em campos soltos obrigaria este arquivo a
 * remontá-la — uma segunda implementação da regra, que as restrições do projeto
 * proíbem.
 *
 * A validação de conteúdo é toda de `anexarArquivoDaBase`, que não conhece sessão.
 * Aqui só se checa o que é DESTE lado: a sessão, e se veio um arquivo de fato.
 */
export async function anexarArquivoDoCliente(formData: FormData): Promise<ResultadoAnexoAcao> {
  const parsed = sessaoSchema.safeParse({
    key: campo(formData, "key"),
    kbt: campo(formData, "kbt"),
    suporte: campo(formData, "suporte"),
    base: campo(formData, "base"),
  });
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const sessao = await baseDaSessao(parsed.data);
  if (!sessao.ok) return { ok: false, erro: sessao.erro };

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, erro: "Escolha um arquivo." };
  }

  // A regra chega como texto JSON de um endpoint: quebra aqui é entrada malformada,
  // não regra inválida — quem julga o CONTEÚDO da regra é o validador, lá dentro.
  let regra: unknown = {};
  const cru = campo(formData, "regra");
  if (cru) {
    try {
      regra = JSON.parse(cru);
    } catch {
      return { ok: false, erro: "Configuração de alcance inválida. Atualize a página e tente de novo." };
    }
  }

  const r = await anexarArquivoDaBase({
    // DA SESSÃO. O formulário não tem campo de base para ler, e se tivesse ele
    // seria ignorado aqui — é a mesma linha que protege as ações de documentação.
    baseId: sessao.baseId,
    bytes: new Uint8Array(await arquivo.arrayBuffer()),
    originalName: arquivo.name,
    mime: arquivo.type,
    naBaseDeConhecimento: campo(formData, "naBaseDeConhecimento") === "1",
    downloadLiberado: campo(formData, "downloadLiberado") === "1",
    regra,
    // `criado_por` referencia `auth.users`: existe no suporte, é nulo no modo
    // cliente. A autoria real do cliente fica no registro de auditoria (`por`).
    criadoPor: sessao.operadorId,
  });
  if (!r.ok) return { ok: false, erro: r.erro };

  await registrarArquivo(sessao, "gestao.arquivo.anexado", r.documentId, null, {
    original_name: arquivo.name,
    size_bytes: arquivo.size,
    chunks: r.chunks,
    na_base_de_conhecimento: r.chunks > 0,
    download_liberado: campo(formData, "downloadLiberado") === "1",
    regra,
  });
  revalidar();
  return { ok: true, chunks: r.chunks };
}

const arquivoSchema = sessaoSchema.extend({
  documentId: z.string().uuid("Escolha o arquivo."),
});

/**
 * Exclui um arquivo da empresa — e, com ele, o que o assistente lia dele.
 *
 * *"Quando for adicionado um arquivo que vai para o RAG, se for deletado precisa
 * apagar do RAG também"* (24/09). Os chunks somem por `ON DELETE CASCADE`; ver
 * `excluirArquivoDaBase`, que também é onde mora a conferência de dono — o
 * documento é procurado por `id` E `base_id` juntos, então um id vazado não acha
 * linha e não apaga nada de outro cliente.
 */
export async function excluirArquivoDoCliente(input: unknown): Promise<ResultadoAcao> {
  const parsed = arquivoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const sessao = await baseDaSessao(parsed.data);
  if (!sessao.ok) return { ok: false, erro: sessao.erro };

  const r = await excluirArquivoDaBase({
    baseId: sessao.baseId,
    documentId: parsed.data.documentId,
  });
  if (!r.ok) return { ok: false, erro: r.erro };

  await registrarArquivo(
    sessao,
    "gestao.arquivo.excluido",
    parsed.data.documentId,
    { original_name: r.nome, estava_na_base_de_conhecimento: r.tinhaChunks },
    null,
  );
  revalidar();
  return { ok: true };
}

/**
 * Os arquivos desta empresa. Sempre da base da sessão.
 *
 * LEITURA QUEBRADA NÃO VIRA LISTA VAZIA. `arquivosDaBase` declara `falhou`, e
 * aqui isso vira recusa em vez de `{ ok: true, arquivos: [] }`: quem chama esta
 * action SUBSTITUI a lista que está na tela, e entregar uma lista vazia (ou
 * parcial) faria os arquivos do cliente desaparecerem por causa de um defeito
 * nosso. Parcial também recusa, pelo mesmo motivo: metade da lista é mais
 * enganoso que nenhuma, porque parece completa.
 */
export async function listarArquivosDoCliente(input: unknown): Promise<ListaDeArquivos> {
  const parsed = sessaoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const sessao = await baseDaSessao(parsed.data);
  if (!sessao.ok) return { ok: false, erro: sessao.erro };

  const leitura = await arquivosDaBase(sessao.baseId);
  if (leitura.falhou) {
    return {
      ok: false,
      erro:
        "Não foi possível ler os arquivos da sua empresa agora. Atualize a página e tente de novo; " +
        "se continuar, fale com o suporte.",
    };
  }
  return { ok: true, arquivos: leitura.arquivos };
}

/** Campo de texto do formulário, ou `undefined` — nunca um `File` por engano. */
function campo(formData: FormData, nome: string): string | undefined {
  const v = formData.get(nome);
  return typeof v === "string" && v !== "" ? v : undefined;
}
