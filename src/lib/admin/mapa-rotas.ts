import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FileText,
  Bot,
  Globe,
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
  /** Abas da página, como destinos de primeira classe no Cmd+K. */
  abas?: { key: string; rotulo: string; permissao?: string }[];
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
        href: "/admin/conteudo",
        rotulo: "Conteúdo",
        icone: FileText,
        escopo: "espaco",
        permissao: "content.view",
        // A tela mais linkada do produto (49 links internos) não tinha item de
        // menu — só se chegava a ela passando por "Documentações".
        descricao: "Árvore, editor, importação e revisão.",
        tambem: ["/admin/conteudo", "/admin/importar", "/admin/estudio", "/admin/revisao", "/admin/lixeira"],
        apelidos: ["artigos", "árvore", "editor", "importar", "estúdio", "revisão", "lixeira"],
        abas: [
          { key: "arvore", rotulo: "Árvore" },
          { key: "importar", rotulo: "Importar", permissao: "content.import" },
          { key: "estudio", rotulo: "Criar com IA", permissao: "content.create" },
          { key: "revisao", rotulo: "Revisão", permissao: "review.approve" },
          { key: "historico", rotulo: "Histórico e lixeira", permissao: "content.restore" },
        ],
      },
    ],
  },
  {
    titulo: "Documentação",
    escopo: "espaco",
    rotas: [
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
        tambem: ["/admin/assistente", "/admin/ontologia", "/admin/chatbot", "/admin/conversas", "/admin/logs"],
        apelidos: ["chatbot", "widget", "bot", "persona", "ontologia", "sinônimos", "conversas", "logs do chat", "rastreio", "embeddings"],
        abas: [
          { key: "persona", rotulo: "Persona" },
          { key: "conhecimento", rotulo: "Base de conhecimento" },
          { key: "ontologia", rotulo: "Ontologia" },
          { key: "canais", rotulo: "Canais e chaves", permissao: "widget.manage" },
          // Conversas e Rastreio na MESMA aba, em dois zooms — era a queixa
          // direta do Igor ("têm a mesma função"). A lista responde "o que
          // perguntaram"; o rastreio, "por que a resposta saiu assim". O passo
          // que faltava é o link entre os dois, que agora existe: de uma
          // conversa dá para abrir o rastreio daquele turno.
          { key: "atividade", rotulo: "Conversas e rastreio" },
        ],
      },
      {
        href: "/admin/portal",
        rotulo: "Portal público",
        icone: Globe,
        escopo: "espaco",
        permissao: "space.manage",
        descricao: "Aparência, endereço, visibilidade e prévia.",
        tambem: ["/admin/portal", "/admin/aparencia", "/admin/configuracoes", "/admin/previa"],
        apelidos: ["aparência", "tema", "configurações", "domínio", "prévia"],
        abas: [
          { key: "aparencia", rotulo: "Aparência" },
          { key: "geral", rotulo: "Geral" },
        ],
      },
      {
        href: "/admin/desempenho",
        rotulo: "Desempenho",
        icone: BarChart3,
        escopo: "espaco",
        permissao: "content.view",
        descricao: "Busca, leitura, feedback e lacunas de conteúdo.",
        tambem: ["/admin/desempenho", "/admin/analises", "/admin/acessos"],
        apelidos: ["análises", "analytics", "acessos", "visualizações", "feedback", "buscas sem resultado"],
        abas: [
          { key: "busca", rotulo: "Busca" },
          { key: "leitura", rotulo: "Leitura" },
          { key: "acessos", rotulo: "Acessos" },
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
        href: "/admin/conexoes",
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
      },
      {
        href: "/admin/pessoas",
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
        tambem: ["/admin/sistema", "/admin/chaves-api", "/admin/widget", "/admin/estilo"],
        apelidos: ["configuração", "smtp", "backup", "chaves de api", "provedores", "estilo"],
        abas: [
          { key: "ia", rotulo: "IA" },
          { key: "chaves", rotulo: "Chaves", permissao: "widget.manage" },
          { key: "email", rotulo: "E-mail" },
          { key: "backup", rotulo: "Backup", permissao: "system.backup" },
        ],
      },
      {
        href: "/admin/operacao",
        rotulo: "Operação",
        icone: Activity,
        escopo: "plataforma",
        permissao: "audit.read",
        descricao: "Auditoria, custos de IA e jobs em andamento.",
        tambem: ["/admin/operacao", "/admin/auditoria", "/admin/faturamento"],
        apelidos: ["auditoria", "faturamento", "custos", "consumo", "jobs", "fila"],
        abas: [
          { key: "auditoria", rotulo: "Auditoria" },
          { key: "custos", rotulo: "Custos de IA", permissao: "ai.configure" },
          { key: "jobs", rotulo: "Jobs" },
        ],
      },
    ],
  },
];

/** Todas as rotas, achatadas — para o Cmd+K e para a resolução do item ativo. */
export const ROTAS: Rota[] = MAPA.flatMap((s) => s.rotas);

/**
 * Qual item do menu deve acender para o caminho atual.
 *
 * Casa pelo prefixo MAIS LONGO, não pelo primeiro que bate: `/admin/conteudo`
 * e `/admin` competem por `/admin/conteudo/abc`, e sem essa regra o Painel
 * acenderia no editor. Era esse o defeito que o `also` remendava à mão.
 */
export function rotaAtiva(pathname: string): Rota | null {
  let melhor: Rota | null = null;
  let tamanho = -1;
  for (const r of ROTAS) {
    for (const base of r.tambem ?? [r.href]) {
      const casa = pathname === base || pathname.startsWith(base + "/");
      if (casa && base.length > tamanho) {
        melhor = r;
        tamanho = base.length;
      }
    }
  }
  return melhor;
}
