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
import { chavesProblematicasDaRegra, normalizarRegra, type Regra } from "@/lib/elegibilidade";
import {
  dadosDaCampanhaSchema,
  mensagemDeAutoExclusao,
  problemasDaCampanha,
  regraExcluiAPropriaBase,
} from "@/lib/campanhas/campanha";
import {
  apagarCampanha,
  campanhaDaBase,
  definirEnvioDaCampanha,
  gravarCampanha,
  visualizacoesDaCampanha,
  type PainelDeVisualizacoes,
} from "@/lib/campanhas/dados";

/**
 * Ações da aba Comunicação, na área do CLIENTE.
 *
 * ── A RLS NÃO PROTEGE NADA NESTE CAMINHO ─────────────────────────────────
 * Vale aqui o que já vale em `conteudo/actions.ts` e em `prompts/actions.ts`, e
 * a migration de campanhas repete por extenso: a área do cliente não tem sessão
 * do Supabase, escreve com `service_role`, e `service_role` tem `rolbypassrls`.
 * As policies de `ai_campanhas` são a cerca do admin interno; a cerca DESTE
 * caminho são três linhas de código, cada uma fechando um buraco diferente:
 *
 *   1. a BASE vem de `baseDaSessao`, que revalida o token — nunca do formulário.
 *      Nenhum esquema deste arquivo tem campo de base a ler;
 *   2. toda leitura e toda escrita passam por `base_id`, sempre o da sessão. É
 *      por isso que as funções de `lib/campanhas/dados.ts` exigem `baseId` como
 *      primeiro parâmetro: um id de campanha vazado não acha linha;
 *   3. `audit_log` em toda escrita, com quem fez e se foi pelo suporte.
 *
 * ── AS QUATRO TRAVAS DE GRAVAÇÃO, E A ORDEM ENTRE AS DUAS PRIMEIRAS ──────
 *   1. `problemasDaCampanha` — os dois CHECKs do banco (título em branco, janela
 *      incoerente) ditos em português ANTES de gravar. Sem isto o cliente recebe
 *      um 500 no lugar de uma frase que diz o que corrigir;
 *   2. `chavesProblematicasDaRegra` RECUSA antes de `normalizarRegra`, e a ordem
 *      é obrigatória: a segunda DESCARTA chave desconhecida, então uma regra
 *      restrita por uma dimensão com typo seria gravada como regra VAZIA — e
 *      regra vazia LIBERA. A recusa é o que impede uma regra que fecha de virar
 *      uma que abre;
 *   3. `regraExcluiAPropriaBase` — regra travada em outra empresa não alcança
 *      ninguém, e é o mesmo defeito silencioso que `exclusoesEntreRegras` recusa
 *      na aba Conteúdo;
 *   4. os CHECKs do banco, para quem gravar por fora destes quatro.
 */

/** Mensagem única para "não é sua" e "não existe". Ver `campanhaDaBase`. */
const NAO_ENCONTRADA =
  "Este aviso não está mais disponível. Atualize a página; se continuar, fale com o suporte Natcorp.";

const FALHA_DE_GRAVACAO =
  "Não foi possível salvar este aviso. Atualize a página e tente de novo; se continuar, fale com o suporte Natcorp.";

const campanhaSchema = sessaoSchema.extend(dadosDaCampanhaSchema.shape);

/*
  PORTUGUÊS TAMBÉM NA RECUSA DE TIPO, e não só na de formato.

  Toda action deste arquivo devolve `issues[0].message` direto para a tela, e quem
  lê é um analista de implantação dentro do ERP. `z.string()` sem argumento entrega
  o texto padrão do Zod ("Invalid input: expected string, received number"), e
  `z.boolean()` sem `error` faz o mesmo — a string do construtor cobre o erro de
  TIPO, e a do `.uuid()` cobre o de FORMATO: são duas mensagens, não uma.

  Nenhum destes caminhos é alcançável pela nossa tela, que só manda o id de uma
  campanha que ela listou. Eles chegam por payload forjado, e é exatamente aí que
  a mensagem é a única coisa que a pessoa vê. É a mesma correção que
  `dadosDaCampanhaSchema` recebeu, e estes dois esquemas tinham ficado de fora.
*/
const alvoSchema = sessaoSchema.extend({
  id: z
    .string("Não identificamos de qual aviso se trata. Atualize a página e tente de novo.")
    .uuid("Escolha o aviso."),
});
const envioSchema = alvoSchema.extend({
  enabled: z.boolean({
    error: "Não recebemos se o aviso deve aparecer ou parar. Atualize a página e tente de novo.",
  }),
});

/**
 * Registro da ação.
 *
 * `entity_type` é a tabela e `entity_id` é o id da campanha. `space_id` fica nulo
 * porque campanha não pertence a espaço nenhum — inventar um para preencher a
 * coluna produziria uma linha de auditoria que aponta para o lugar errado.
 *
 * A FALHA VAI PARA O LOG, e não vira recusa: a campanha já está gravada quando
 * chegamos aqui, então devolver erro faria o cliente achar que não valeu e tentar
 * de novo. Mas o retorno é conferido, porque perder o rastro em silêncio é como
 * se ninguém tivesse publicado nada — e a pergunta que vem depois ("quem mandou
 * esse aviso, e quando?") é justamente a que o registro existe para responder.
 */
async function registrar(
  sessao: SessaoResolvida,
  acao: string,
  id: string | null,
  antes: Record<string, unknown> | null,
  depois: Record<string, unknown> | null,
) {
  const { error } = await createAdminClient()
    .from("audit_log")
    .insert({
      actor_id: sessao.operadorId,
      action: acao,
      entity_type: "ai_campanhas",
      entity_id: id,
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
      `[gestao/comunicacao] auditoria PERDIDA — ação "${acao}" no aviso ${id} da base ${sessao.baseId}:`,
      error.message,
    );
  }
}

function revalidar() {
  revalidatePath("/gestao/comunicacao");
}

/** O que a linha tinha antes, para o `before` do registro. */
function retrato(c: {
  titulo: string;
  publicarEm: string;
  encerrarEm: string | null;
  enabled: boolean;
  repetir: boolean;
  regra: Regra;
}): Record<string, unknown> {
  return {
    titulo: c.titulo,
    publicar_em: c.publicarEm,
    encerrar_em: c.encerrarEm,
    enabled: c.enabled,
    repetir: c.repetir,
    regra: c.regra,
  };
}

export type ResultadoDeCampanha = { ok: true; id: string } | { ok: false; erro: string };

/**
 * Cria ou edita um aviso.
 *
 * `repetir` chega do formulário e é OBRIGATÓRIO no esquema, sem default: o padrão
 * do dono é "uma vez por pessoa", e um formulário que mandasse `true` por omissão
 * inverteria essa decisão sem nenhum CHECK do banco para pegar (os dois valores
 * de um boolean são válidos). Ver o cabeçalho de `dadosDaCampanhaSchema`.
 */
export async function salvarCampanha(input: unknown): Promise<ResultadoDeCampanha> {
  const parsed = campanhaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const sessao = await baseDaSessao(parsed.data);
  if (!sessao.ok) return { ok: false, erro: sessao.erro };

  // TRAVA 1 — os dois CHECKs do banco, em português.
  const problemas = problemasDaCampanha({
    titulo: parsed.data.titulo,
    corpo: parsed.data.corpo,
    publicarEm: parsed.data.publicarEm,
    encerrarEm: parsed.data.encerrarEm ?? null,
  });
  if (problemas.length) return { ok: false, erro: problemas[0]!.mensagem };

  // A regra chega como `unknown` de um endpoint: aqui só se garante que é um
  // OBJETO. O julgamento do conteúdo é do validador, logo abaixo, que sabe
  // nomear o campo errado em português.
  const bruta = parsed.data.regra ?? {};
  if (typeof bruta !== "object" || bruta === null || Array.isArray(bruta)) {
    return { ok: false, erro: "Configuração de alcance inválida. Atualize a página e tente de novo." };
  }

  // TRAVA 2 — o validador ANTES da normalização. A ordem é a regra.
  const chaves = chavesProblematicasDaRegra(bruta as Regra);
  if (chaves.length) {
    return {
      ok: false,
      erro:
        `Estes campos não alcançariam ninguém ou alcançariam todo mundo sem você ` +
        `pedir: ${chaves.join(", ")}. Corrija ou remova.`,
    };
  }
  const regra = normalizarRegra(bruta as Regra);

  /*
    TRAVA 3 — regra travada em outra empresa. Depois de normalizar, de propósito:
    é a regra que de fato vai ao banco que precisa ser confrontada com a base.

    A mensagem sai com o CÓDIGO da base e não com o nome: `SessaoResolvida` não
    carrega o nome, e este caminho não deve inventar uma segunda leitura de
    `ai_bases` só para embelezar uma recusa que a tela já evita antes do clique
    (lá, onde o nome existe, a frase sai com ele). O código é o da PRÓPRIA
    empresa de quem está olhando, então não há código de terceiro nesta tela.
  */
  if (regraExcluiAPropriaBase(regra, sessao.base)) {
    return { ok: false, erro: mensagemDeAutoExclusao(sessao.base) };
  }

  const publicarEm = new Date(parsed.data.publicarEm).toISOString();
  const encerrarEm = parsed.data.encerrarEm
    ? new Date(parsed.data.encerrarEm).toISOString()
    : null;

  /*
    Leitura ANTES da gravação, quando é edição, e por dois motivos: o `before` do
    registro (mudança de alcance ou de janela sem rastro é o que impede responder
    "desde quando esse aviso parou de aparecer?") e a conferência de dono — a
    campanha tem de ser DESTA base, e `campanhaDaBase` procura pelos dois juntos.
  */
  const antes = parsed.data.id ? await campanhaDaBase(sessao.baseId, parsed.data.id) : null;
  if (parsed.data.id && !antes) return { ok: false, erro: NAO_ENCONTRADA };

  const r = await gravarCampanha(
    sessao.baseId,
    parsed.data.id ?? null,
    {
      titulo: parsed.data.titulo.trim(),
      corpo: (parsed.data.corpo ?? "").trim(),
      regra,
      publicarEm,
      encerrarEm,
      repetir: parsed.data.repetir,
    },
    // `criada_por` é TEXTO livre, não FK para `auth.users`: quem cria é a área do
    // cliente, que não tem usuário do Supabase. O rótulo é o login do ERP, ou o
    // operador interno com prefixo quando é suporte.
    autorDa(sessao),
  );
  if (!r.ok) {
    if (r.erro === "campanha_nao_encontrada") return { ok: false, erro: NAO_ENCONTRADA };
    // A mensagem CRUA do Postgres (nome de constraint, de tabela) não é para
    // quem está deste lado da tela. Trocar por frase de produto, sem ENGOLIR o
    // erro: ele vai para o log do servidor, de onde dá para investigar.
    console.error("[gestao/comunicacao] falha ao gravar ai_campanhas:", r.erro);
    return { ok: false, erro: FALHA_DE_GRAVACAO };
  }

  await registrar(
    sessao,
    antes ? "gestao.campanha.editada" : "gestao.campanha.criada",
    r.id,
    antes ? retrato(antes) : null,
    {
      titulo: parsed.data.titulo.trim(),
      publicar_em: publicarEm,
      encerrar_em: encerrarEm,
      repetir: parsed.data.repetir,
      regra,
    },
  );
  revalidar();
  return { ok: true, id: r.id };
}

/**
 * Para de mostrar (ou volta a mostrar) um aviso.
 *
 * É `enabled`, e não uma data de encerramento: parar agora e agendar o fim são
 * coisas diferentes para quem opera. Desligar é reversível e não perde a janela
 * configurada; mexer em `encerrar_em` para parar exigiria reconstruir a data
 * depois, e a pessoa não lembraria qual era.
 */
export async function definirEnvio(input: unknown): Promise<ResultadoAcao> {
  const parsed = envioSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const sessao = await baseDaSessao(parsed.data);
  if (!sessao.ok) return { ok: false, erro: sessao.erro };

  const antes = await campanhaDaBase(sessao.baseId, parsed.data.id);
  if (!antes) return { ok: false, erro: NAO_ENCONTRADA };

  const r = await definirEnvioDaCampanha(sessao.baseId, parsed.data.id, parsed.data.enabled);
  if (!r.ok) {
    if (r.erro === "campanha_nao_encontrada") return { ok: false, erro: NAO_ENCONTRADA };
    console.error("[gestao/comunicacao] falha ao mudar o envio:", r.erro);
    return { ok: false, erro: FALHA_DE_GRAVACAO };
  }

  await registrar(
    sessao,
    parsed.data.enabled ? "gestao.campanha.religada" : "gestao.campanha.desligada",
    parsed.data.id,
    retrato(antes),
    { ...retrato(antes), enabled: parsed.data.enabled },
  );
  revalidar();
  return { ok: true };
}

/**
 * Exclui um aviso — e, com ele, o registro de quem o visualizou.
 *
 * A cascata é do banco. O `before` do registro leva o retrato da campanha porque
 * é a última vez que ele existe: depois daqui, a única memória de que aquele
 * aviso existiu é a linha de auditoria.
 */
export async function excluirCampanha(input: unknown): Promise<ResultadoAcao> {
  const parsed = alvoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const sessao = await baseDaSessao(parsed.data);
  if (!sessao.ok) return { ok: false, erro: sessao.erro };

  const antes = await campanhaDaBase(sessao.baseId, parsed.data.id);
  if (!antes) return { ok: false, erro: NAO_ENCONTRADA };

  const r = await apagarCampanha(sessao.baseId, parsed.data.id);
  if (!r.ok) {
    if (r.erro === "campanha_nao_encontrada") return { ok: false, erro: NAO_ENCONTRADA };
    console.error("[gestao/comunicacao] falha ao excluir:", r.erro);
    return {
      ok: false,
      erro: "Não foi possível excluir este aviso. Atualize a página e tente de novo.",
    };
  }

  await registrar(sessao, "gestao.campanha.excluida", parsed.data.id, retrato(antes), null);
  revalidar();
  return { ok: true };
}

export type ResultadoDeVisualizacoes =
  | { ok: true; painel: PainelDeVisualizacoes }
  | { ok: false; erro: string };

/**
 * Quem visualizou este aviso.
 *
 * Só leitura, e não registra em `audit_log`: abrir a lista não muda nada, e
 * encher a tabela de auditoria com leituras esconderia as escritas, que são o que
 * ela existe para guardar. O acesso do suporte já fica registrado pela PÁGINA,
 * em `gestao_suporte_acessos`.
 *
 * "Não é desta base" e "não existe" devolvem a MESMA mensagem: distinguir aqui
 * transformaria a recusa num oráculo que diz se um id existe em outra empresa.
 */
export async function listarVisualizacoes(input: unknown): Promise<ResultadoDeVisualizacoes> {
  const parsed = alvoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const sessao = await baseDaSessao(parsed.data);
  if (!sessao.ok) return { ok: false, erro: sessao.erro };

  const r = await visualizacoesDaCampanha(sessao.baseId, parsed.data.id);
  if (!r.ok) {
    return {
      ok: false,
      erro:
        r.motivo === "nao_encontrada"
          ? NAO_ENCONTRADA
          : "Não foi possível ler quem visualizou agora. Tente de novo em instantes.",
    };
  }
  return { ok: true, painel: r.painel };
}
