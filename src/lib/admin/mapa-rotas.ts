import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Library,
  Upload,
  Bot,
  BarChart3,
  Plug,
  Users,
  SlidersHorizontal,
  Activity,
} from "lucide-react";

/**
 * O MAPA DE ROTAS — fonte única da navegação.
 *
 * Antes, três coisas respondiam "onde eu estou" e nenhuma conversava com as
 * outras: o array `GRUPOS` da sidebar, o campo `also` (uma lista manual de
 * rotas que mantêm um item aceso) e o `<h1>` que cada página escrevia. Mexer em
 * uma sem lembrar das demais deixava o menu apagado numa rota-filha — abrir um
 * artigo apagava "Conteúdo".
 *
 * Aqui a rota é declarada uma vez e três consumidores leem daqui: o estado
 * ativo do menu, o breadcrumb e o Cmd+K.
 *
 * ── O critério do agrupamento ───────────────────────────────────────────────
 * Por ASSUNTO, não por ferramenta. O menu antigo tinha um grupo chamado "Fluxo
 * de conteúdo" que juntava ingestão (Importar), geração (Estúdio), fila
 * (Revisão) e lixeira — quatro ferramentas sem parentesco. Ferramenta não tem
 * hierarquia natural, então a lista só crescia.
 *
 * O caso mais visível era o assistente de IA: DEZ lugares tratavam dele,
 * espalhados por três grupos diferentes. Persona em "Canais e análises",
 * rastreio do chat em "Administração", ontologia sem item nenhum, e
 * `/admin/widget` e `/admin/chatbot` renderizando o mesmo componente com uma
 * prop diferente. Agora tudo o que responde "como o assistente se comporta e o
 * que ele andou fazendo" mora numa seção só.
 *
 * ── Os três escopos ─────────────────────────────────────────────────────────
 * `escopo` é o que torna o menu legível. Cada destino pertence a um mundo:
 *   · `geral`  — vale para tudo (o painel, o conteúdo).
 *   · `espaco` — é sobre UMA documentação, e obedece ao seletor.
 *   · `plataforma` — é sobre a instalação, e ignora o seletor.
 * Sem isso, um seletor de documentação no topo prometeria que todas as telas o
 * obedecem — e um terço delas não obedece.
 */

export type Escopo = "geral" | "espaco" | "plataforma";

export type Rota = {
  /** Caminho canônico. Filhas entram em `tambem`. */
  href: string;
  rotulo: string;
  icone?: LucideIcon;
  escopo: Escopo;
  /**
   * A permissão MÍNIMA que torna este destino não-vazio. É o que decide se o
   * item aparece no menu — e a mesma chave que a tela de recusa mostra.
   */
  permissao: string;
  /** Uma linha sobre o que se faz aqui. Vira subtítulo e resultado do Cmd+K. */
  descricao: string;
  /** Rotas-filhas que mantêm este item aceso. Substitui o antigo `also`. */
  tambem?: string[];
  /** Sinônimos e nomes ANTIGOS — a memória muscular vira aprendizado de graça. */
  apelidos?: string[];
  /** Abas da página. Ver `AbaRota` — esta lista É a barra de abas, não uma cópia dela. */
  abas?: AbaRota[];
};

/**
 * UMA ABA — declarada aqui, renderizada a partir daqui.
 *
 * Antes esta lista era só um índice para o Cmd+K, mantido à mão em paralelo com
 * a barra de abas de cada tela. As duas divergiram exatamente como se espera de
 * duas listas sem ninguém as comparando: das 15 abas declaradas, 11 levavam a
 * destinos que não existiam. O Cmd+K oferecia "Sistema › Chaves" e "Desempenho
 * › Qualidade", montava a URL, e a página caía na aba padrão sem avisar.
 *
 * Agora as barras LEEM daqui (`abasDaRota`). Não é que a divergência ficou mais
 * fácil de detectar — ela ficou impossível de escrever.
 */
export type AbaRota = {
  /** Vira `?aba=<key>` — ou é só um identificador, quando há `href`. */
  key: string;
  rotulo: string;
  /** Permissão própria. Sem ela, a aba herda a da rota. */
  permissao?: string;
  /**
   * Destino quando a aba é OUTRA rota (Assistente › Conversas, Desempenho ›
   * Acessos). Sem isto, o destino é `?aba=<key>` na própria rota.
   *
   * `{space}` é trocado pelo id da documentação em jogo. Uma aba que precisa do
   * espaço e não o recebe seria um link para a documentação errada — o mesmo
   * defeito que a Importar tinha.
   */
  href?: string;
  /**
   * Família da aba, para o separador visual da barra. Ver `Aba.grupo` em
   * `ui/tabs`: dá hierarquia a uma barra longa sem criar um segundo nível.
   */
  grupo?: string;
};

export type Secao = { titulo: string | null; escopo: Escopo; rotas: Rota[] };

export const MAPA: Secao[] = [
  {
    titulo: null,
    escopo: "geral",
    rotas: [
      {
        href: "/admin",
        rotulo: "Painel",
        icone: LayoutDashboard,
        escopo: "geral",
        permissao: "content.view",
        descricao: "O que precisa da sua atenção agora.",
      },
      {
        href: "/admin/documentacoes",
        rotulo: "Documentações",
        icone: Library,
        escopo: "geral",
        permissao: "content.view",
        /**
         * A LISTAGEM, não o conteúdo de uma delas.
         *
         * Por um momento este item apontou direto para `/admin/conteudo`, que
         * entra na árvore da documentação selecionada. Estava errado: o menu é
         * global e não deve presumir em qual documentação a pessoa quer entrar
         * — quem opera seis clientes começa escolhendo qual, não caindo dentro
         * do último que abriu.
         *
         * O caminho para os artigos continua a um clique, a partir do cartão da
         * documentação. E o `tambem` mantém este item aceso durante todo o
         * trabalho de conteúdo, inclusive dentro do editor.
         */
        descricao: "Todas as documentações — e, de cada uma, a árvore, o editor, a importação e a revisão.",
        tambem: [
          "/admin/documentacoes",
          "/admin/conteudo",
          "/admin/estudio",
          "/admin/revisao",
          "/admin/lixeira",
          // Aparência e Preferências são de UMA documentação e se alcançam pelo
          // cartão dela — não merecem item próprio no menu global.
          "/admin/aparencia",
          "/admin/configuracoes",
          "/admin/previa",
        ],
        apelidos: ["conteúdo", "artigos", "árvore", "editor", "estúdio", "revisão", "lixeira", "aparência", "portal", "preferências"],
      },
    ],
  },
  {
    titulo: "Documentação",
    escopo: "espaco",
    rotas: [
      {
        href: "/admin/importar",
        rotulo: "Importar",
        icone: Upload,
        escopo: "espaco",
        permissao: "content.import",
        /**
         * DE VOLTA AO MENU, e a lição está aqui.
         *
         * Ela foi absorvida por "Documentações" no primeiro desenho, junto com
         * Estúdio, Revisão e Lixeira — pela lógica de que tudo isso é trabalho
         * sobre conteúdo. A lógica estava certa e a decisão, errada: chegar aqui
         * passou a custar três passos (Documentações → escolher a doc → achar a
         * ação) numa tela de uso diário.
         *
         * Agrupar por assunto vale para o que se CONSULTA. Ferramenta de uso
         * frequente é diferente: ela merece porta própria mesmo pertencendo a um
         * grupo maior, porque o custo de um clique a mais se paga todo dia.
         */
        descricao: "Trazer PDF, Word, planilha ou página da web para a documentação — e gerar os embeddings do chatbot.",
        tambem: ["/admin/importar"],
        apelidos: ["importar", "upload", "pdf", "docx", "embeddings", "indexar", "scraping", "url"],
        abas: [
          { key: "documentos", rotulo: "Importar documentos", permissao: "content.import" },
          // "Base de conhecimento" e não "Embeddings": é o nome que o usuário
          // usa, e era o quarto nome dado à mesma coisa. O jargão continua
          // achável pelos apelidos acima.
          { key: "embeddings", rotulo: "Base de conhecimento", permissao: "embeddings.reindex" },
        ],
      },
      {
        href: "/admin/assistente",
        rotulo: "Assistente de IA",
        icone: Bot,
        escopo: "espaco",
        permissao: "content.view",
        /**
         * A fusão que o Igor pediu, e mais quatro que vieram no mesmo pacote.
         *
         * Tudo o que define COMO o assistente responde estava separado: a
         * persona aqui, os sinônimos do RAG numa rota órfã (um único link de
         * entrada em toda a base), os arquivos que ele lê dentro de "Chatbot",
         * e as chaves do widget em dois lugares que renderizavam o MESMO
         * componente. Quem ajustava o comportamento do bot precisava saber, de
         * cor, que a resposta estava em quatro telas de três grupos de menu.
         */
        descricao: "Persona, ontologia, base de conhecimento, canais e o que ele andou respondendo.",
        tambem: ["/admin/assistente", "/admin/ontologia", "/admin/chatbot", "/admin/widget", "/admin/conversas", "/admin/logs"],
        apelidos: ["chatbot", "widget", "bot", "persona", "ontologia", "sinônimos", "conversas", "logs do chat", "rastreio", "embeddings"],
        /**
         * Cada aba é uma ROTA — daí todas trazerem `href`. Mover os corpos para
         * dentro de um arquivo só exigiria reapontar 18 `revalidatePath`, 13 só
         * da ontologia; e revalidar caminho inexistente não dá erro, apenas para
         * de atualizar a tela depois de salvar. Enquanto essa fusão não
         * acontece, as abas-como-link entregam a mesma área navegável.
         *
         * "Base de conhecimento" NÃO está aqui de propósito. Ela mora em
         * Importar, e uma aba apontando para outra seção do menu faz a barra
         * lateral pular no meio de uma barra de abas — o defeito que Acessos
         * causava. A divisão é por verbo: o que ENTRA na base é Importar; como
         * o bot se COMPORTA é aqui.
         */
        abas: [
          { key: "persona", rotulo: "Persona", href: "/admin/assistente?space={space}" },
          { key: "ontologia", rotulo: "Ontologia", href: "/admin/ontologia?space={space}" },
          {
            key: "canais",
            rotulo: "Canais e chaves",
            permissao: "widget.manage",
            href: "/admin/chatbot?space={space}",
          },
          { key: "atividade", rotulo: "Conversas", href: "/admin/conversas?space={space}" },
          // Sem `{space}`: o rastreio é chaveado por `base_code`, não por
          // documentação. Passar o parâmetro prometeria um filtro que não existe.
          {
            key: "rastreio",
            rotulo: "Rastreio do chat",
            permissao: "ai.configure",
            href: "/admin/logs",
          },
        ],
      },
      {
        href: "/admin/analises",
        rotulo: "Desempenho",
        icone: BarChart3,
        escopo: "espaco",
        permissao: "content.view",
        descricao: "Busca, leitura, feedback e lacunas de conteúdo.",
        tambem: ["/admin/desempenho", "/admin/analises", "/admin/acessos"],
        apelidos: ["análises", "analytics", "acessos", "visualizações", "feedback", "buscas sem resultado"],
        /**
         * Quatro destas são `?aba=` na própria rota; Acessos é rota separada
         * (consulta e filtros próprios), daí o `href`.
         *
         * Acessos VEIO PARA CÁ. Ela dividia barra com Conversas e Rastreio, sob
         * a ideia de que as três eram "leituras do mesmo tráfego". Eram — mas
         * respondem a perguntas de pessoas diferentes: "o conteúdo está
         * servindo?" (quem escreve, olhando o agregado) contra "por que o bot
         * respondeu isso?" (quem opera, olhando um caso). E como o mapa já a
         * arquivava aqui, a barra antiga atravessava duas seções do menu: a aba
         * do meio fazia o item aceso na barra lateral pular.
         */
        abas: [
          { key: "busca", rotulo: "Busca" },
          { key: "leitura", rotulo: "Leitura" },
          { key: "chat", rotulo: "Chat" },
          { key: "acessos", rotulo: "Acessos às páginas", href: "/admin/acessos?space={space}" },
          { key: "qualidade", rotulo: "Qualidade" },
        ],
      },
    ],
  },
  {
    titulo: "Plataforma",
    escopo: "plataforma",
    rotas: [
      {
        href: "/admin/integracoes",
        rotulo: "Conexões",
        icone: Plug,
        escopo: "plataforma",
        permissao: "integrations.manage",
        // Fica FORA do Assistente de propósito, apesar de também ser IA: aqui o
        // objeto é o ERP do cliente — base, credencial, endpoint, agente. Quem
        // mexe nisto está integrando sistema, não ajustando como o bot fala.
        descricao: "Bases dos clientes, ferramentas, agentes e execuções.",
        tambem: ["/admin/conexoes", "/admin/integracoes"],
        apelidos: ["integrações", "tools", "apis", "ords", "agentes", "whatsapp", "execuções"],
        /**
         * Nove abas — a tela mais densa do admin, e a única cujas abas já
         * tinham URL. Ironicamente era também a única sem NENHUMA declarada
         * aqui: o Cmd+K não alcançava nenhuma das nove, justamente onde ele
         * funcionaria melhor.
         *
         * A ordem é o fluxo de montagem, não o alfabeto: cadastra-se o cliente,
         * descreve-se o que dá para perguntar à API dele, decide-se quem pode
         * usar, monta-se o agente, e só então se observa o que aconteceu.
         */
        abas: [
          // QUEM É O CLIENTE — cadastro, credencial, quem pode usar.
          { key: "bases", rotulo: "Bases / Clientes", grupo: "cliente" },
          { key: "acesso", rotulo: "Acesso por base", grupo: "cliente" },
          { key: "whatsapp", rotulo: "WhatsApp", grupo: "cliente" },
          // O QUE O BOT SABE FAZER — o catálogo e quem o opera.
          { key: "apis", rotulo: "APIs / Tools", grupo: "capacidade" },
          { key: "agentes", rotulo: "Agentes", grupo: "capacidade" },
          { key: "perfis", rotulo: "Perfis de análise", grupo: "capacidade" },
          { key: "construtor", rotulo: "Construtor IA", grupo: "capacidade" },
          // O QUE ACONTECEU — leitura, não configuração.
          { key: "fluxo", rotulo: "Fluxo", grupo: "atividade" },
          { key: "execucoes", rotulo: "Execuções", grupo: "atividade" },
        ],
      },
      {
        href: "/admin/usuarios",
        rotulo: "Pessoas",
        icone: Users,
        escopo: "plataforma",
        permissao: "user.view",
        descricao: "Quem opera o admin, com que papel e em quais documentações.",
        tambem: ["/admin/pessoas", "/admin/usuarios"],
        apelidos: ["usuários", "convites", "papéis", "permissões", "acesso"],
      },
      {
        href: "/admin/sistema",
        rotulo: "Sistema",
        icone: SlidersHorizontal,
        escopo: "plataforma",
        permissao: "ai.configure",
        descricao: "Provedores de IA, e-mail, chaves, backup e prompts do motor.",
        // `/admin/extensao` estava fora de todo `tambem` e, por isso, acendia
        // "Painel" — a raiz casava por prefixo. É a revisão das sessões da
        // extensão de navegador, cujo painel de configuração mora aqui.
        /* `/admin/widget` SAIU daqui. Ele lista as chaves de widget de todas as
           documentações — o mesmo objeto que `/admin/chatbot` lista para uma
           só, com o mesmo componente. Ter as duas portas em seções diferentes
           do menu (Sistema e Assistente) fazia o item aceso mudar conforme o
           escopo, e escopo não é assunto: as duas respondem "como o assistente
           chega ao usuário". Agora as duas moram no Assistente. */
        tambem: ["/admin/sistema", "/admin/chaves-api", "/admin/estilo", "/admin/extensao"],
        apelidos: ["configuração", "smtp", "backup", "chaves de api", "provedores", "estilo"],
        /**
         * Declarava uma aba "Chaves" que nunca existiu nesta tela — as chaves
         * são a rota `/admin/chaves-api`. E omitia "Extensão" e "Prompts", que
         * existem. Lista de índice mantida à mão diverge assim: sem erro, sem
         * aviso, e só se descobre quando alguém tenta usar o atalho.
         */
        abas: [
          { key: "ia", rotulo: "Inteligência artificial" },
          { key: "email", rotulo: "E-mail" },
          { key: "extensao", rotulo: "Extensão" },
          { key: "prompts", rotulo: "Prompts", permissao: "ai.configure" },
          { key: "backup", rotulo: "Backup", permissao: "system.backup" },
        ],
      },
      {
        href: "/admin/auditoria",
        rotulo: "Operação",
        icone: Activity,
        escopo: "plataforma",
        permissao: "audit.read",
        descricao: "Auditoria, custos de IA e jobs em andamento.",
        tambem: ["/admin/operacao", "/admin/auditoria", "/admin/faturamento"],
        apelidos: ["auditoria", "faturamento", "custos", "consumo", "jobs", "fila"],
        /**
         * "Jobs" saiu: nunca houve rota nem aba para ela. A fila em andamento
         * vive no indicador de Atividade da barra superior, que é onde ela
         * serve — enquanto o trabalho roda, não numa tela que se abre depois.
         */
        abas: [
          { key: "auditoria", rotulo: "Auditoria" },
          {
            key: "custos",
            rotulo: "Custos de IA",
            permissao: "ai.configure",
            href: "/admin/faturamento",
          },
        ],
      },
    ],
  },
];

/** Todas as rotas, achatadas — para o Cmd+K e para a resolução do item ativo. */
export const ROTAS: Rota[] = MAPA.flatMap((s) => s.rotas);

/** Uma aba já resolvida: com destino final e filtrada por permissão. */
export type AbaResolvida = { key: string; rotulo: string; href: string; grupo?: string };

/**
 * As abas de uma rota, prontas para renderizar.
 *
 * É a função que fecha o buraco entre "o que o mapa promete" e "o que a tela
 * mostra": a barra de abas e o Cmd+K chamam esta mesma função, com a mesma
 * lista e as mesmas permissões, então não há duas verdades para divergirem.
 *
 * Uma aba cuja permissão a pessoa não tem SOME, em vez de aparecer desabilitada
 * — mesma regra da barra lateral. Aba visível que não abre é um beco.
 */
export function abasDaRota(
  hrefDaRota: string,
  permissoes: Set<string>,
  /** Documentação em jogo, para as abas que carregam `{space}`. */
  spaceId?: string,
): AbaResolvida[] {
  const rota = ROTAS.find((r) => r.href === hrefDaRota);
  if (!rota?.abas) return [];
  const visiveis = rota.abas.filter((a) => !a.permissao || permissoes.has(a.permissao));
  return visiveis.map((a, i) => ({
    key: a.key,
    rotulo: a.rotulo,
    grupo: a.grupo,
    href: a.href
      ? a.href.replace("{space}", spaceId ?? "")
      : // A primeira aba VISÍVEL não suja a URL. Tem que ser a primeira depois
        // do filtro de permissão, não a primeira declarada: quem só tem
        // `embeddings.reindex` abre a Importar direto na segunda aba, e apontar
        // para `?aba=` da aba que ela não vê geraria um link para lugar nenhum.
        i === 0
        ? rota.href
        : `${rota.href}?aba=${a.key}`,
  }));
}

/**
 * Qual item do menu deve acender para o caminho atual.
 *
 * Casa pelo prefixo MAIS LONGO, não pelo primeiro que bate: `/admin/conteudo`
 * e `/admin` competem por `/admin/conteudo/abc`, e sem essa regra o Painel
 * acenderia no editor. Era esse o defeito que o `also` remendava à mão.
 */
export function rotaAtiva(pathname: string): Rota | null {
  return trilha(pathname)?.rota ?? null;
}

/**
 * A TRILHA — seção + rota, para o breadcrumb.
 *
 * O comentário do topo deste arquivo dizia, desde a primeira versão, que três
 * consumidores liam daqui: "o estado ativo do menu, o breadcrumb e o Cmd+K".
 * O breadcrumb nunca foi construído. Só se percebeu isso quando uma barra de
 * abas passou a atravessar duas seções do menu e ficou claro que a barra
 * lateral era a ÚNICA resposta para "onde estou" — e estava errada em um terço
 * dos cliques.
 *
 * Duas fontes de posição não é redundância: a barra diz onde a pessoa PODE ir,
 * o breadcrumb diz onde ela ESTÁ. Quando as duas discordam, o defeito aparece
 * na hora, em vez de virar desorientação difusa.
 */
export function trilha(pathname: string): { secao: Secao; rota: Rota } | null {
  let melhor: { secao: Secao; rota: Rota } | null = null;
  let tamanho = -1;
  for (const secao of MAPA) {
    for (const rota of secao.rotas) {
      for (const base of rota.tambem ?? [rota.href]) {
        /**
         * `/admin` casa EXATO, nunca por prefixo.
         *
         * Como raiz, ele é prefixo de tudo — e por isso qualquer rota fora do
         * mapa (`/admin/extensao`, uma rota nova ainda não declarada) acendia
         * "Painel" na barra lateral. Passava despercebido enquanto a barra era
         * a única fonte de posição; com o breadcrumb lendo daqui, a mentira
         * ficaria escrita em duas partes da tela ao mesmo tempo.
         *
         * Rota não declarada agora não acende nada — que é a verdade.
         */
        const casa = base === "/admin" ? pathname === base : pathname === base || pathname.startsWith(base + "/");
        if (casa && base.length > tamanho) {
          melhor = { secao, rota };
          tamanho = base.length;
        }
      }
    }
  }
  return melhor;
}
