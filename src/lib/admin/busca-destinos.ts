import { ROTAS, type Rota } from "./mapa-rotas";

/**
 * ONDE IR — a metade da paleta que não existia.
 *
 * O `Cmd+K` era um campo de busca de artigos: sempre navegava para
 * `/admin/conteudo/{id}`, e nenhuma das 30 páginas do admin era alcançável por
 * ele. Isso passava porque o menu tinha 18 itens e servia de índice.
 *
 * Com o menu em nove, a paleta deixa de ser conveniência e vira o caminho: ela
 * carrega tudo abaixo do primeiro nível — inclusive ABAS, que agora têm URL e
 * por isso podem ser destino de primeira classe ("Assistente › Ontologia" em
 * vez de "Assistente, e depois procure a aba").
 *
 * ── Os apelidos, e por que eles importam agora ──────────────────────────────
 * Este redesenho move coisa de lugar e a decisão foi não carregar redirects.
 * Quem digitar "widget", "análises", "logs do chat" ou "usuários" — os nomes
 * ANTIGOS — chega ao destino novo mesmo assim. É o que converte memória
 * muscular em aprendizado sem retreinar ninguém, e sem uma camada de
 * compatibilidade para manter.
 *
 * Puro e sem IO — daí ser testável sem montar a paleta.
 */

export type Destino = {
  href: string;
  rotulo: string;
  /** "Assistente de IA" quando o destino é uma aba dele. */
  contexto?: string;
  descricao: string;
  icone?: Rota["icone"];
  /** Quanto casou. Só ordena; não é mostrado. */
  pontos: number;
};

/** Sem acento, minúsculo — "ontologia" tem que casar com "Ontologia". */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Pontuação deliberadamente grosseira: são ~40 destinos, não um corpus. O que
 * importa é a ORDEM entre eles, e três faixas bastam.
 *
 *   começa com o termo  → 100   ("cont" acha "Conteúdo" antes de "Conexões")
 *   contém o termo      →  50
 *   casa por apelido    →  40   (fica abaixo do nome real: quem digita o nome
 *                                novo deve ver o item antes de quem o alcança
 *                                pelo nome velho)
 *   casa na descrição   →  15   (rede de segurança: "férias" acha o Assistente
 *                                sem que ninguém tenha previsto a palavra)
 */
function pontuar(termo: string, rotulo: string, apelidos: string[], descricao: string): number {
  const r = normalizar(rotulo);
  if (r.startsWith(termo)) return 100;
  if (r.includes(termo)) return 50;
  if (apelidos.some((a) => normalizar(a).includes(termo))) return 40;
  if (normalizar(descricao).includes(termo)) return 15;
  return 0;
}

export function buscarDestinos(
  consulta: string,
  /** Conjunto de `permissoesDo()`. A paleta não pode oferecer o que a pessoa não pode abrir. */
  permissoes: Set<string>,
  limite = 7,
): Destino[] {
  const termo = normalizar(consulta);
  if (termo.length < 1) return [];

  const achados: Destino[] = [];
  for (const r of ROTAS) {
    if (!permissoes.has(r.permissao)) continue;

    const p = pontuar(termo, r.rotulo, r.apelidos ?? [], r.descricao);
    if (p > 0) achados.push({ href: r.href, rotulo: r.rotulo, descricao: r.descricao, icone: r.icone, pontos: p });

    for (const aba of r.abas ?? []) {
      // A aba herda a permissão da página quando não declara a própria.
      if (aba.permissao && !permissoes.has(aba.permissao)) continue;
      const pa = pontuar(termo, aba.rotulo, r.apelidos ?? [], r.descricao);
      if (pa > 0) {
        achados.push({
          href: `${r.href}?aba=${aba.key}`,
          rotulo: aba.rotulo,
          contexto: r.rotulo,
          descricao: r.descricao,
          icone: r.icone,
          // A aba perde da página de mesmo nome: quem digita "Conteúdo" quer a
          // tela, não uma aba dentro dela.
          pontos: pa - 5,
        });
      }
    }
  }

  return achados.sort((a, b) => b.pontos - a.pontos || a.rotulo.localeCompare(b.rotulo)).slice(0, limite);
}
