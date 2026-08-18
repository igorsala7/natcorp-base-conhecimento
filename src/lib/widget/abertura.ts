/**
 * A ABERTURA do widget: o que a pessoa vê no instante em que abre a bolha,
 * antes de digitar qualquer coisa.
 *
 * O problema que isto resolve: até aqui a abertura era uma saudação fixa mais
 * `widget_keys.config.suggestions` — a MESMA lista para todo mundo, e vazia por
 * padrão. Quem trabalha em RH digita a pergunta e nem olha para os atalhos; quem
 * é gestor de outra área não conhece o vocabulário, encara o campo vazio e
 * desiste. O campo vazio cobra justamente a palavra que a pessoa não tem.
 *
 * A virada é que o recorte NÃO precisa de infraestrutura nova: no bootstrap
 * (`GET /api/v1/config`) o token de rastreio já é decodificado para decidir se a
 * bolha aparece, e ele traz painel, matrícula e código de candidato. O público
 * está na mão; só não estava sendo usado.
 *
 * Puro e sem IO: quem lê banco e token é a rota. Assim o mesmo raciocínio pode
 * ser testado sem subir nada.
 */

import { ehPainel } from "@/lib/widget/disponibilidade";
import { tipoDeAcesso } from "@/lib/chat/tipo-acesso";

/**
 * Para quem estamos abrindo.
 *
 * Não é o painel puro: `PC` cobre colaborador E candidato, que são pessoas em
 * situações incomparáveis — uma está dentro da empresa, a outra ainda nem foi
 * contratada. Quem separa as duas é `tipoDeAcesso`, que já existe e já é a
 * fonte da verdade nas outras pontas (escolha do agente, escopo das tools).
 * Repetir a regra aqui abriria espaço para as duas discordarem.
 */
export type PublicoAbertura =
  | "operador"     // PO — profissionais de RH
  | "gestor"       // PG — gestores, de RH ou de qualquer outra área
  | "colaborador"  // PC com matrícula
  | "candidato"    // PC sem matrícula, com código de candidato
  | "anonimo";     // sem painel ou sem identidade (portal público, instalação sem rastreio)

/**
 * Deriva o público a partir do que o token de rastreio já entrega.
 *
 * A ordem importa. Para PO e PG o painel manda sozinho: um gestor continua
 * gestor mesmo que a matrícula não tenha vindo no token, e rebaixá-lo a
 * "anônimo" por causa de um campo ausente daria a ele a abertura errada.
 * Só no PC a identidade decide, porque é lá que colaborador e candidato
 * convivem sob o mesmo código de painel.
 */
export function publicoDaAbertura(input: {
  painel?: string | null;
  matricula?: string | null;
  codCandidato?: string | null;
}): PublicoAbertura {
  const painel = String(input.painel ?? "").trim().toUpperCase();

  if (ehPainel(painel)) {
    if (painel === "PO") return "operador";
    if (painel === "PG") return "gestor";
    // PC: quem é depende da identidade.
    const tipo = tipoDeAcesso({ matricula: input.matricula, codCandidato: input.codCandidato });
    if (tipo === "colaborador") return "colaborador";
    if (tipo === "candidato") return "candidato";
    return "anonimo";
  }

  // Sem painel identificado não há recorte — e inventar um seria pior que não
  // ter. Cai no comportamento de sempre (saudação genérica, sem atalhos).
  return "anonimo";
}

/** O que a abertura devolve para o widget — mesmo formato que ele já entende. */
export type Abertura = {
  welcome: string;
  suggestions: string[];
};

/**
 * Saudação por público.
 *
 * Sem nome próprio de propósito: o token traz `p_usuario`, mas isso é
 * identificador de login (às vezes a própria matrícula), não nome de exibição.
 * "Boa tarde, 365785" é pior que nenhuma saudação. Se um dia entrar um
 * `p_nome` confiável no rastreio, é aqui que ele encaixa.
 *
 * O enquadramento muda com o público, e essa é a parte que importa: a saudação
 * antiga ("Como posso ajudar com a documentação?") descrevia o que o sistema é,
 * não o que a pessoa veio fazer. Gestor não vem falar de documentação — vem
 * perguntar da própria equipe.
 */
const SAUDACAO: Record<PublicoAbertura, string> = {
  operador: "Pronto para continuar.",
  gestor: "Sobre a sua equipe, posso responder:",
  colaborador: "Posso ajudar com:",
  candidato: "Posso ajudar com a sua candidatura:",
  anonimo: "Olá! Como posso ajudar?",
};

/**
 * Tudo que a regra de escolha tem à disposição no momento da abertura.
 *
 * Nada aqui exige consulta nova: painel, base e identidade vêm do token já
 * decodificado; a tela é o que o `formAssist` do widget varre da página do
 * APEX. Se algum sinal faltar, a regra tem que aguentar a ausência — token sem
 * base e página sem título são casos normais, não excepcionais.
 */
export type ContextoAbertura = {
  publico: PublicoAbertura;
  /** Código da base/cliente (`p_base`), quando veio. */
  base?: string | null;
  /** Título da tela do APEX em que a pessoa está, quando o widget conseguiu ler. */
  tela?: string | null;
  /** Quantas perguntas a abertura comporta. Acima disso a pessoa volta a escolher em vez de reconhecer. */
  limite: number;
  /**
   * Filtro de disponibilidade: "esta base consegue responder isso?".
   *
   * Existe porque sugerir e depois recusar é pior que não sugerir — um atalho
   * que falha ensina a pessoa a não confiar nos atalhos. Enquanto ninguém
   * passar a função, tudo é considerado disponível e o comportamento é o da
   * curadoria pura. É por aqui que a derivação pelas tools da base entra
   * depois, sem mexer em quem chama.
   */
  podeResponder?: (chave: ChavePergunta) => boolean;
};

/**
 * Teto de perguntas na abertura.
 *
 * Três é decisão de desenho, não número redondo: a partir de quatro ou cinco
 * opções a leitura deixa de ser reconhecimento ("é essa") e vira comparação
 * ("qual delas?"), que é exatamente o esforço que a abertura existe para poupar.
 * Quem quiser mais opções tem o campo livre logo abaixo.
 */
export const LIMITE_PERGUNTAS = 3;

/**
 * Identificador estável de cada pergunta da abertura.
 *
 * Serve para duas coisas que o texto não serviria: filtrar por
 * disponibilidade sem depender da redação, e medir depois qual atalho é
 * realmente usado — se a métrica dependesse da frase, qualquer ajuste de texto
 * quebraria a série histórica.
 */
export type ChavePergunta =
  | "equipe_ferias"
  | "equipe_aprovacoes"
  | "equipe_headcount"
  | "meu_holerite"
  | "meu_saldo_ferias"
  | "como_pedir_ferias"
  | "minha_candidatura"
  | "vagas_abertas"
  | "atualizar_cadastro";

/**
 * ────────────────────────────────────────────────────────────────────────────
 * CURADORIA POR PÚBLICO — a decisão de produto vive aqui.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Das três origens possíveis (curadoria à mão, derivação pelas tools da base,
 * frequência real de uso) esta é a curadoria: é a única que funciona no dia um,
 * com a redação sob controle. As outras duas dependem de coisa que ainda não
 * existe — a derivação depende da qualidade do cadastro das tools, que varia
 * entre bases; a frequência depende de volume que só aparece depois que a
 * abertura já estiver no ar. Ambas entram por cima disto: a derivação pelo
 * `podeResponder` do contexto, a frequência reordenando esta lista.
 *
 * A redação segue uma regra só, e ela é o motivo de tudo isto existir:
 * LÍNGUA DE QUEM PERGUNTA, NÃO DO SISTEMA. "Quem da minha equipe está de férias
 * este mês", nunca "afastamentos por código". Um gestor comercial não conhece o
 * vocabulário de RH, e é exatamente para ele que a abertura foi desenhada — se
 * o atalho usa jargão, ele não resolve nada.
 *
 * Cada lista respeita o escopo de dados do seu público: gestor pergunta da
 * própria equipe, colaborador pergunta de si, candidato pergunta da própria
 * candidatura. Nenhuma pergunta aqui pode terminar numa recusa de escopo.
 */
const CATALOGO: Record<PublicoAbertura, ReadonlyArray<{ chave: ChavePergunta; texto: string }>> = {
  // Vazio DE PROPÓSITO. Quem trabalha em RH digita mais rápido do que lê
  // atalho, e sugestão tutorial só ocupa espaço de quem já sabe o caminho. O
  // que aceleraria esse público é continuidade ("retomar o relatório de
  // ontem"), que depende de histórico e de relatórios salvos — IO, portanto
  // fora desta função pura. Enquanto isso não existe, melhor nada que ruído.
  operador: [],

  gestor: [
    { chave: "equipe_ferias", texto: "Quem da minha equipe está de férias este mês" },
    { chave: "equipe_aprovacoes", texto: "O que está esperando a minha aprovação" },
    { chave: "equipe_headcount", texto: "Quantas pessoas eu tenho na equipe hoje" },
  ],

  colaborador: [
    { chave: "meu_holerite", texto: "Ver meu último holerite" },
    { chave: "meu_saldo_ferias", texto: "Quantos dias de férias eu tenho" },
    { chave: "como_pedir_ferias", texto: "Como peço férias" },
  ],

  candidato: [
    { chave: "minha_candidatura", texto: "Como está a minha candidatura" },
    { chave: "vagas_abertas", texto: "Quais vagas estão abertas" },
    { chave: "atualizar_cadastro", texto: "Como atualizo meu cadastro" },
  ],

  // Sem identidade não há escopo, e sem escopo qualquer atalho leva a uma
  // recusa. A saudação sozinha é a resposta honesta.
  anonimo: [],
};

/**
 * Escolhe as perguntas da abertura, na ordem em que aparecem.
 *
 * Lista vazia é resultado legítimo — público anônimo, base sem integração, ou
 * tudo indisponível. Nesse caso o widget mostra só a saudação, como sempre fez.
 *
 * @param ctx público, base, tela, limite e filtro de disponibilidade.
 * @returns até `ctx.limite` perguntas prontas para virar atalhos.
 */
export function escolherPerguntas(ctx: ContextoAbertura): string[] {
  const disponivel = ctx.podeResponder;
  return CATALOGO[ctx.publico]
    .filter((p) => (disponivel ? disponivel(p.chave) : true))
    .slice(0, ctx.limite)
    .map((p) => p.texto);
}

/**
 * Monta a abertura completa para uma pessoa.
 *
 * `configuradas` são as sugestões que o admin cadastrou na chave. Quando
 * existem, elas VENCEM: alguém escolheu aquilo a dedo para aquela instalação, e
 * sobrescrever seria desfazer um trabalho manual sem avisar.
 *
 * É um padrão conservador e ele tem um custo — instalação que já configurou uma
 * lista genérica nunca vai ver a abertura por público, e a lista genérica é
 * justamente o problema original. Se a decisão for que o recorte por público
 * deve prevalecer, inverta as duas linhas abaixo; a escolha é de produto, não
 * técnica, então está isolada aqui em vez de espalhada na rota.
 */
export function montarAbertura(input: {
  publico: PublicoAbertura;
  base?: string | null;
  tela?: string | null;
  configuradas?: unknown;
  podeResponder?: (chave: ChavePergunta) => boolean;
}): Abertura {
  const configuradas = Array.isArray(input.configuradas)
    ? input.configuradas.filter((q): q is string => typeof q === "string" && q.trim().length > 0)
    : [];

  const suggestions = configuradas.length
    ? configuradas.slice(0, LIMITE_PERGUNTAS)
    : escolherPerguntas({
        publico: input.publico,
        base: input.base,
        tela: input.tela,
        limite: LIMITE_PERGUNTAS,
        podeResponder: input.podeResponder,
      });

  return { welcome: SAUDACAO[input.publico], suggestions };
}
