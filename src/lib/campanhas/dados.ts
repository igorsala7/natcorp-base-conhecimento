import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Regra } from "@/lib/elegibilidade";
import type { Campanha } from "./campanha";

/**
 * AS LEITURAS DE CAMPANHA, num lugar só: a página e as ações usam estas.
 *
 * ── A CERCA ENTRE CLIENTES ESTÁ EM TODA FUNÇÃO DESTE ARQUIVO ──────────────
 * A área do cliente não tem sessão do Supabase e escreve com `service_role`, que
 * tem `rolbypassrls`: as policies de `ai_campanhas` não defendem nada neste
 * caminho (o cabeçalho da migration diz isso por extenso). O que defende é o
 * `base_id` em TODA consulta daqui, e ele vem sempre de quem chama, que o tirou
 * da sessão revalidada.
 *
 * Por isso nenhuma função deste arquivo aceita só o id da campanha: `baseId` é
 * sempre o primeiro parâmetro, e a campanha é procurada pelos DOIS juntos. Um id
 * vazado não acha linha, do mesmo jeito que em `excluirArquivoDaBase`.
 *
 * ── CLIENTE SEM O PARÂMETRO DE TIPO, E O MOTIVO ───────────────────────────
 * `src/lib/database.types.ts` é gerado do banco e ainda não conhece
 * `ai_campanhas` nem `ai_campanha_visualizacoes`. É o mesmo caso de
 * `src/lib/widget/alertas.ts` (que chama as duas funções novas) e de
 * `src/lib/ai/escopo-da-base.ts`: usar o cliente sem o parâmetro de tipo para a
 * tabela nova, e moldar a linha à mão logo na leitura. Regerar o arquivo de
 * tipos é o caminho certo, e é uma mudança de outra ordem de grandeza (ele tem
 * milhares de linhas e pega todo o schema); até lá, o molde explícito abaixo é o
 * que faz o resto do arquivo ser tipado.
 *
 * ── SEM CONTAGEM DE "QUEM NÃO VIU", E ISSO É ESTRUTURAL ───────────────────
 * Não existe função, coluna ou consulta aqui que produza um total de
 * destinatários. Não é esquecimento: não há cadastro de usuários em tabela
 * nenhuma deste banco, e o único universo disponível ("quem já usou o chatbot")
 * mediria adoção do chatbot parecendo medir alcance da campanha.
 *
 * A catraca que RODA a cada PR é a sentinela de `campanha.test.ts`, dentro de
 * `npm test`: ela olha o fonte da tela e falha se aparecer conta de porcentagem.
 * A assertiva D de `20260926160000_campanhas.sql` cobre o lado do BANCO, e
 * dispara na próxima vez que alguém aplicar aquele arquivo — a CI não aplica
 * migration nenhuma, então ela não é portão de PR. Este arquivo é o lado de cima
 * da mesma decisão, e o que o mantém assim é revisão, não automação.
 */

/** O cliente admin sem o parâmetro de tipo. Ver o cabeçalho. */
function admin(): SupabaseClient {
  return createAdminClient();
}

/** Uma campanha com a contagem de visualizações. `null` = não deu para contar. */
export type CampanhaComContagem = Campanha & {
  /**
   * Linhas de `ai_campanha_visualizacoes` desta campanha.
   *
   * NULO NÃO É ZERO: falha ao contar devolve `null`, e a tela diz que não
   * conseguiu contar em vez de mostrar "0 visualizações", que é uma afirmação
   * sobre o mundo e não sobre o nosso defeito.
   */
  visualizacoes: number | null;
};

export type LeituraDeCampanhas = {
  /** A leitura caiu: `campanhas` pode estar vazia OU parcial. */
  falhou: boolean;
  campanhas: CampanhaComContagem[];
};

type LinhaDeCampanha = {
  id: string;
  titulo: string | null;
  corpo: string | null;
  regra: Regra | null;
  publicar_em: string;
  encerrar_em: string | null;
  enabled: boolean;
  repetir: boolean;
  criada_por: string | null;
  created_at: string;
};

const COLUNAS =
  "id, titulo, corpo, regra, publicar_em, encerrar_em, enabled, repetir, criada_por, created_at";

function moldar(l: LinhaDeCampanha): Campanha {
  return {
    id: l.id,
    titulo: l.titulo ?? "",
    corpo: l.corpo ?? "",
    regra: (l.regra ?? {}) as Regra,
    publicarEm: l.publicar_em,
    encerrarEm: l.encerrar_em,
    enabled: l.enabled,
    repetir: l.repetir,
    criadaPor: l.criada_por,
    criadaEm: l.created_at,
  };
}

/** Fatia de paginação. Bem abaixo do teto de 1.000 do PostgREST, de propósito. */
const FATIA = 500;

/**
 * As campanhas desta base, da mais recente para a mais antiga.
 *
 * Paginada por CONSULTA e com ordem TOTAL (`publicar_em desc, id`), que é o que
 * impede a fronteira da fatia de repetir e perder linha. Duas campanhas podem
 * nascer no mesmo instante, então `publicar_em` sozinho não é ordem total, e
 * paginação sobre ordem não total é o defeito que mais voltou neste repositório.
 */
export async function campanhasDaBase(baseId: string): Promise<LeituraDeCampanhas> {
  const db = admin();
  const linhas: LinhaDeCampanha[] = [];
  try {
    for (let de = 0; ; de += FATIA) {
      const { data, error } = await db
        .from("ai_campanhas")
        .select(COLUNAS)
        .eq("base_id", baseId)
        .order("publicar_em", { ascending: false })
        .order("id")
        .range(de, de + FATIA - 1);
      if (error) throw new Error(error.message);
      const lote = (data ?? []) as unknown as LinhaDeCampanha[];
      linhas.push(...lote);
      if (lote.length < FATIA) break;
    }
  } catch (e) {
    console.error(`[campanhas] falha ao ler as campanhas da base ${baseId}:`, e);
    return { falhou: true, campanhas: [] };
  }

  /*
    A contagem é uma consulta POR CAMPANHA, com `head: true`.

    Não é o caminho mais elegante — uma agregação faria numa consulta só —, mas
    agregação em PostgREST exige view ou função, e criar objeto de banco aqui
    seria migration. `head: true` traz o total no CABEÇALHO, então nenhuma dessas
    consultas transfere linha e nenhuma delas tem teto a estourar: uma campanha
    com cinquenta mil visualizações custa o mesmo que uma com três.

    Uma base tem unidades de campanhas (é tabela de configuração), então o número
    de idas ao banco é da ordem do que a tela mostra.
  */
  const contagens = await Promise.all(
    linhas.map(async (l) => {
      const { count, error } = await db
        .from("ai_campanha_visualizacoes")
        .select("id", { count: "exact", head: true })
        .eq("campanha_id", l.id);
      if (error) {
        console.error(`[campanhas] falha ao contar visualizações de ${l.id}:`, error.message);
        return null;
      }
      return count ?? 0;
    }),
  );

  return {
    falhou: false,
    campanhas: linhas.map((l, i) => ({ ...moldar(l), visualizacoes: contagens[i] ?? null })),
  };
}

/**
 * Uma campanha, procurada por id E base juntos.
 *
 * Devolve `null` tanto para "não existe" quanto para "é de outro cliente", e a
 * indistinção é de propósito: quem chama responde a MESMA coisa nos dois casos,
 * senão a mensagem de erro vira um oráculo que diz se um id existe em outra
 * empresa.
 */
export async function campanhaDaBase(baseId: string, id: string): Promise<Campanha | null> {
  const { data, error } = await admin()
    .from("ai_campanhas")
    .select(COLUNAS)
    .eq("id", id)
    .eq("base_id", baseId)
    .maybeSingle();
  if (error) {
    console.error(`[campanhas] falha ao ler a campanha ${id} da base ${baseId}:`, error.message);
    return null;
  }
  return data ? moldar(data as unknown as LinhaDeCampanha) : null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   QUEM VISUALIZOU — o drilldown
   ═══════════════════════════════════════════════════════════════════════════ */

/** Uma visualização identificada, como a tela a lista. */
export type VisualizacaoDeCampanha = {
  id: string;
  usuario: string | null;
  matricula: string | null;
  empresa: string | null;
  portal: string | null;
  perfil: string | null;
  /**
   * ISO-8601 da PRIMEIRA visualização desta CHAVE nesta campanha.
   *
   * A chave é `(campanha, usuario, matricula)`, não a pessoa: um acesso que traz
   * só usuário e outro que traz usuário e matrícula são duas linhas, com duas
   * datas. Por isso a tela conta e rotula VISUALIZAÇÕES, e não pessoas.
   */
  vistoEm: string;
};

export type PainelDeVisualizacoes = {
  /** Todas as linhas: identificadas mais anônimas. */
  total: number;
  /**
   * As que trazem usuário ou matrícula, contadas no banco (não na lista).
   *
   * LINHA, NÃO PESSOA: a chave única é `(campanha, usuario, matricula)` e nulo é
   * distinto de nulo, então o acesso que manda só usuário não dedupe contra o que
   * manda usuário e matrícula. A mesma pessoa pode entrar duas vezes aqui, e a
   * tela rotula este número como VISUALIZAÇÕES por causa disso.
   */
  identificadas: number;
  /**
   * As que não trazem nem usuário nem matrícula.
   *
   * Uma linha POR visualização, e não por pessoa: nulo é distinto de nulo na
   * chave única, então a mesma pessoa não identificada conta de novo a cada
   * abertura. É o comportamento pedido — "alguém viu" é verdade, inventar quem
   * viu não é — e é por isso que este número fica separado, e não somado às
   * pessoas.
   */
  anonimas: number;
  /** As identificadas, da mais recente para a mais antiga, até o teto. */
  linhas: VisualizacaoDeCampanha[];
  /** `identificadas` passou do teto: `linhas` é uma janela, não a lista toda. */
  truncado: boolean;
};

export type LeituraDeVisualizacoes =
  | { ok: true; painel: PainelDeVisualizacoes }
  | { ok: false; motivo: "nao_encontrada" | "falha" };

/**
 * Teto de linhas trazidas para a tela.
 *
 * O drilldown é uma lista que uma PESSOA lê; dez mil nomes não são uma lista.
 * Com o teto, a tela diz quantas ficaram de fora (os dois números vêm de
 * contagem no banco, não do tamanho desta janela), e é isso que impede "mostrando
 * uma parte" de parecer "isto é tudo".
 */
export const TETO_DE_VISUALIZACOES = 2000;

/**
 * Só as linhas IDENTIFICADAS, e esse filtro é correção e não economia.
 *
 * Medido em `conversations` (513 acessos, 26/09): 26% dos acessos chegam sem
 * usuário e sem matrícula, e cada visualização desses grava uma linha NOVA. São
 * as únicas linhas que crescem sem teto. Sem este filtro, uma campanha antiga
 * teria as visualizações anônimas ocupando toda a janela mais recente, e as
 * pessoas identificadas — a única coisa que o drilldown existe para mostrar —
 * desapareceriam da tela sem nenhum sintoma.
 */
const IDENTIFICADAS = "p_usuario.not.is.null,p_matricula.not.is.null";

/**
 * Quem visualizou esta campanha, com a data.
 *
 * `.order(...)` ANTES do `.range()`, e a ordem é total (`visto_em desc, id`).
 * Sem ordem total, a fronteira entre duas fatias repete e perde linha — o teto
 * de 1.000 do PostgREST já produziu esse defeito oito vezes neste repositório, e
 * é o motivo de `ai_campanha_visualizacoes` ter uma chave substituta.
 */
export async function visualizacoesDaCampanha(
  baseId: string,
  campanhaId: string,
): Promise<LeituraDeVisualizacoes> {
  const dona = await campanhaDaBase(baseId, campanhaId);
  if (!dona) return { ok: false, motivo: "nao_encontrada" };

  const db = admin();
  try {
    const [todas, identificadas] = await Promise.all([
      db
        .from("ai_campanha_visualizacoes")
        .select("id", { count: "exact", head: true })
        .eq("campanha_id", campanhaId),
      db
        .from("ai_campanha_visualizacoes")
        .select("id", { count: "exact", head: true })
        .eq("campanha_id", campanhaId)
        .or(IDENTIFICADAS),
    ]);
    if (todas.error) throw new Error(todas.error.message);
    if (identificadas.error) throw new Error(identificadas.error.message);

    const total = todas.count ?? 0;
    const comNome = identificadas.count ?? 0;

    const linhas: VisualizacaoDeCampanha[] = [];
    for (let de = 0; de < TETO_DE_VISUALIZACOES; de += FATIA) {
      const ate = Math.min(de + FATIA, TETO_DE_VISUALIZACOES) - 1;
      const { data, error } = await db
        .from("ai_campanha_visualizacoes")
        .select("id, p_usuario, p_matricula, p_empresa, p_portal, p_perfil, visto_em")
        .eq("campanha_id", campanhaId)
        .or(IDENTIFICADAS)
        .order("visto_em", { ascending: false })
        .order("id")
        .range(de, ate);
      if (error) throw new Error(error.message);
      const lote = (data ?? []) as unknown as {
        id: string;
        p_usuario: string | null;
        p_matricula: string | null;
        p_empresa: string | null;
        p_portal: string | null;
        p_perfil: string | null;
        visto_em: string;
      }[];
      for (const v of lote) {
        linhas.push({
          id: v.id,
          usuario: v.p_usuario,
          matricula: v.p_matricula,
          empresa: v.p_empresa,
          portal: v.p_portal,
          perfil: v.p_perfil,
          vistoEm: v.visto_em,
        });
      }
      if (lote.length < ate - de + 1) break;
    }

    return {
      ok: true,
      painel: {
        total,
        identificadas: comNome,
        // `Math.max` porque as três consultas não são um instantâneo: uma
        // visualização gravada entre a primeira contagem e a segunda deixaria a
        // subtração negativa, e "-1 visualizações anônimas" é pior que aproximar.
        anonimas: Math.max(0, total - comNome),
        linhas,
        truncado: comNome > linhas.length,
      },
    };
  } catch (e) {
    console.error(`[campanhas] falha ao ler visualizações de ${campanhaId}:`, e);
    return { ok: false, motivo: "falha" };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   AS ESCRITAS

   Sessão, validação de regra e registro em `audit_log` são da Server Action; o
   que mora aqui é só o acesso ao banco, com o `base_id` em toda cláusula. A
   divisão é a de `arquivos-da-base.ts`: o mecanismo não conhece sessão, e a ação
   não conhece SQL.

   Nenhuma destas funções valida a regra nem a janela. Quem valida é
   `problemasDaCampanha` mais `chavesProblematicasDaRegra`, ANTES, na ação: os
   CHECKs do banco são a última rede, não a primeira.
   ═══════════════════════════════════════════════════════════════════════════ */

export type GravacaoDeCampanha = { ok: true; id: string } | { ok: false; erro: string };

/** Os campos que a ação grava, já validados e normalizados por ela. */
export type CamposGravaveis = {
  titulo: string;
  corpo: string;
  regra: Regra;
  /** ISO-8601. */
  publicarEm: string;
  encerrarEm: string | null;
  repetir: boolean;
};

/**
 * Cria ou atualiza uma campanha desta base.
 *
 * `base_id` é escrito no INSERT e nunca no UPDATE: uma campanha não muda de
 * dono, e deixar a coluna fora do `update` é o que impede um payload forjado de
 * mudar o dono de uma campanha (o `.eq("base_id")` já barraria a linha, mas duas
 * cercas aqui custam uma linha a menos de código, não a mais).
 *
 * O UPDATE devolve a linha afetada (`select("id")`): sem isso, um id de outro
 * cliente atualizaria ZERO linhas e a resposta seria `ok` — a tela diria
 * "salvo" sobre uma gravação que não aconteceu.
 */
export async function gravarCampanha(
  baseId: string,
  id: string | null,
  campos: CamposGravaveis,
  criadaPor: string | null,
): Promise<GravacaoDeCampanha> {
  const db = admin();
  const linha = {
    titulo: campos.titulo,
    corpo: campos.corpo,
    regra: campos.regra,
    publicar_em: campos.publicarEm,
    encerrar_em: campos.encerrarEm,
    repetir: campos.repetir,
  };

  if (id) {
    const { data, error } = await db
      .from("ai_campanhas")
      .update(linha)
      .eq("id", id)
      .eq("base_id", baseId)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, erro: error.message };
    const alvo = data as unknown as { id: string } | null;
    if (!alvo) return { ok: false, erro: "campanha_nao_encontrada" };
    return { ok: true, id: alvo.id };
  }

  const { data, error } = await db
    .from("ai_campanhas")
    .insert({ ...linha, base_id: baseId, criada_por: criadaPor })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, erro: error.message };
  const nova = data as unknown as { id: string } | null;
  if (!nova) return { ok: false, erro: "insert_sem_retorno" };
  return { ok: true, id: nova.id };
}

/** Liga ou desliga o envio. `enabled = false` é o "parar de mostrar" da tela. */
export async function definirEnvioDaCampanha(
  baseId: string,
  id: string,
  enabled: boolean,
): Promise<GravacaoDeCampanha> {
  const { data, error } = await admin()
    .from("ai_campanhas")
    .update({ enabled })
    .eq("id", id)
    .eq("base_id", baseId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, erro: error.message };
  const alvo = data as unknown as { id: string } | null;
  return alvo ? { ok: true, id: alvo.id } : { ok: false, erro: "campanha_nao_encontrada" };
}

/**
 * Apaga a campanha e, por cascata, as visualizações dela.
 *
 * A cascata é do banco (`on delete cascade`), e é irreversível: quem apaga um
 * aviso perde o registro de quem o viu. A tela avisa isso ANTES, em duas etapas,
 * porque no momento do clique a pessoa está pensando em organizar a lista.
 */
export async function apagarCampanha(baseId: string, id: string): Promise<GravacaoDeCampanha> {
  const { data, error } = await admin()
    .from("ai_campanhas")
    .delete()
    .eq("id", id)
    .eq("base_id", baseId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, erro: error.message };
  const alvo = data as unknown as { id: string } | null;
  return alvo ? { ok: true, id: alvo.id } : { ok: false, erro: "campanha_nao_encontrada" };
}
