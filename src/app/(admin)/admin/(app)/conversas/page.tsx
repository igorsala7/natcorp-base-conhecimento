import type { Metadata } from "next";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { hasPermission } from "@/lib/auth/permissions";
import { listSpaces } from "@/lib/content/spaces";
import { ConversasList, type Conversa, type ConvMsg } from "./conversas-list";
import { comBase } from "@/lib/base-path";
import { SemPermissao } from "@/components/ui/sem-permissao";
import { controlClass } from "@/components/ui/input";
import { permissoesDo } from "@/lib/auth/permissions";
import { PageShell } from "@/components/ui/page-shell";
import { AbasRota } from "@/components/admin/abas-rota";

export const metadata: Metadata = { title: "Conversas" };

/**
 * Teto de conversas trazidas por consulta (as mais recentes que batem no filtro).
 *
 * É teto EXPLÍCITO, e continua valendo agora que a documentação deixou de ser
 * portão: sem `space_id`, a consulta varre as conversas de todas as documentações
 * que a RLS deixa a pessoa ver, e ainda devolve no máximo 300 — o teto de 1.000
 * linhas do PostgREST não entra em jogo aqui porque este número é menor que ele.
 * Quem muda este valor precisa saber que acima de 1.000 o corte passa a ser do
 * PostgREST, silencioso, e o `totalTrazido` mentiria.
 *
 * O que o alargamento muda é a COMPOSIÇÃO das 300: um cliente movimentado pode
 * ocupá-las sozinho e empurrar os outros para fora da janela. É para isso que os
 * filtros de base e de documentação existem, e é por isso que a lista avisa
 * quando bate no teto em vez de fingir que mostrou tudo.
 */
const LIMITE = 300;

type SP = {
  space?: string;
  empresa?: string;
  usuario?: string;
  matricula?: string;
  portal?: string;
  base?: string;
  perfil?: string;
  de?: string;
  ate?: string;
  q?: string;
  feedback?: string;
};


function Campo({ label, name, value, type = "text", placeholder }: {
  label: string; name: string; value?: string; type?: string; placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <input className={controlClass} name={name} defaultValue={value} type={type} placeholder={placeholder} />
    </label>
  );
}

/**
 * Conversas do chatbot/portal, com os parâmetros de rastreio (base, usuário,
 * portal, empresa, matrícula) e a leitura da thread (pergunta + resposta).
 * Leitura sob RLS: só aparecem conversas de documentações onde o usuário tem
 * `content.view`.
 *
 * ── A documentação é FILTRO, não portão ─────────────────────────────────────
 * Esta tela nasceu no eixo da documentação: `pickSpace` resolvia um espaço pela
 * URL, pelo cookie ou pelo primeiro do banco, e a consulta SEMPRE filtrava por
 * ele. Consequência: não havia como responder "o que os clientes andaram
 * perguntando" — só "o que perguntaram nesta documentação", e qual documentação
 * era dependia de um cookie escrito em outra tela. A mensagem "Nenhuma
 * documentação." que parecia ser o caso "nada escolhido" só aparecia quando não
 * havia espaço NENHUM no banco: `pickSpace` cai no primeiro da lista.
 *
 * Com a tela no eixo do cliente (aba de Conexões, escopo `plataforma`), a
 * documentação virou um filtro entre os outros, e sem escolha explícita a
 * consulta não filtra nada. O cookie deixou de participar de propósito: tela de
 * escopo `plataforma` ignora o seletor de documentação (ver `mapa-rotas`), e um
 * filtro que muda sozinho conforme a última tela visitada é pior que filtro
 * nenhum.
 */
export default async function ConversasPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!(await hasPermission("content.view"))) {
    return (
      <SemPermissao
        titulo="Conversas"
        oQue="ver as conversas"
        permissao="content.view"
        papel="Leitor"
      />
    );
  }

  const spaces = await listSpaces();
  const sp = await searchParams;
  // Só id que existe na lista visível vale como filtro. Link antigo apontando
  // para documentação excluída cai em "todas" — que é o que o seletor mostra —
  // em vez de devolver uma lista vazia sem dizer por quê.
  const espacoFiltrado = spaces.find((s) => s.id === sp.space)?.id;
  // Memoizado por request — o layout já consultou. A barra some sozinha com a
  // aba que a pessoa não pode abrir; a tela não precisa mais saber quais são.
  const permissoes = await permissoesDo();

  const supabase = await createClient();

  let q = supabase
    .from("conversations")
    .select("id, created_at, session_id, space_id, p_base, p_usuario, p_portal, p_empresa, p_matricula, p_perfil")
    .order("created_at", { ascending: false })
    .limit(LIMITE);
  if (espacoFiltrado) q = q.eq("space_id", espacoFiltrado);

  const filtros: [keyof SP, string][] = [
    ["empresa", "p_empresa"], ["usuario", "p_usuario"], ["matricula", "p_matricula"],
    ["portal", "p_portal"], ["base", "p_base"], ["perfil", "p_perfil"],
  ];
  for (const [param, col] of filtros) {
    const v = sp[param]?.trim();
    if (v) q = q.ilike(col, `%${v}%`);
  }
  if (sp.de) q = q.gte("created_at", sp.de);
  if (sp.ate) q = q.lte("created_at", `${sp.ate}T23:59:59`);

  const { data: convRows } = await q;
  const convs = convRows ?? [];
  const ids = convs.map((c) => c.id);

  // Mensagens de todas as conversas listadas, em ordem cronológica.
  //
  // PAGINADO, e não é detalhe: 300 conversas passam de 1000 mensagens, e o
  // PostgREST corta nesse teto SEM avisar. Como a ordenação é `created_at`
  // ASCENDENTE, o que sobrevivia ao corte eram as mensagens MAIS ANTIGAS —
  // enquanto a lista mostra as conversas mais RECENTES primeiro. Resultado
  // medido: 1745 mensagens no banco, 1000 devolvidas, e as 10 conversas do topo
  // da tela apareciam TODAS vazias. Mesma armadilha da árvore de nós, mesmo
  // remédio (ver fetchAllPaged).
  //
  // O desempate por `id` é obrigatório: sem uma chave única na ordenação, duas
  // mensagens com o mesmo `created_at` podem pular ou repetir na fronteira das
  // fatias.
  let msgs: ConvMsg[] = [];
  if (ids.length) {
    msgs = await fetchAllPaged<ConvMsg>(async (from, to) => {
      const r = await supabase
        .from("messages")
        .select("conversation_id, role, content, citations, feedback, latency_ms, created_at, tokens, input_tokens, output_tokens")
        .in("conversation_id", ids)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to);
      return { data: (r.data ?? []) as ConvMsg[], error: r.error };
    });
  }

  // Agrupa mensagens por conversa.
  const porConversa = new Map<string, ConvMsg[]>();
  for (const m of msgs) {
    const arr = porConversa.get(m.conversation_id) ?? [];
    arr.push(m);
    porConversa.set(m.conversation_id, arr);
  }

  // Filtros que dependem das mensagens (texto e feedback) aplicados em memória.
  const texto = sp.q?.trim().toLowerCase();
  const fb = sp.feedback; // "up" | "down"
  // O NOME da documentação vai para a lista, não o id: a conversa exibe um chip
  // ao lado de "Base", e uuid em chip não diz nada a quem lê.
  const nomeDaDocumentacao = new Map(spaces.map((s) => [s.id, s.name]));
  let lista: Conversa[] = convs.map(({ space_id, ...c }) => ({
    ...c,
    documentacao: space_id ? nomeDaDocumentacao.get(space_id) ?? null : null,
    messages: porConversa.get(c.id) ?? [],
  }));
  if (texto) {
    lista = lista.filter((c) => c.messages.some((m) => (m.content ?? "").toLowerCase().includes(texto)));
  }
  if (fb === "up" || fb === "down") {
    const alvo = fb === "up" ? 1 : -1;
    lista = lista.filter((c) => c.messages.some((m) => m.feedback === alvo));
  }

  // `espacoFiltrado` entra na conta: a documentação é um filtro como os outros, e
  // "Limpar" tem de limpá-la também.
  const temFiltro = Boolean(
    espacoFiltrado ||
      sp.empresa || sp.usuario || sp.matricula || sp.portal || sp.base || sp.perfil || sp.de || sp.ate || sp.q || sp.feedback,
  );

  return (
    <PageShell
      titulo="Conversas"
      descricao={
        <>
          O que os usuários perguntaram ao chatbot e ao portal, de todas as documentações — com os
          parâmetros de rastreio (base, usuário, portal, empresa, matrícula, perfil) que a conversa
          carregou. Para uma documentação só, use o filtro.{" "}
          <a href={comBase("/admin/widget")} className="font-medium text-primary hover:underline">
            Como enviar os parâmetros? →
          </a>
        </>
      }
      largura="wide"
      /* SEM `SpaceSwitcher` aqui: ele grava o cookie da documentação "em
         manutenção", que vale para as telas de escopo `espaco`. Esta é de escopo
         `plataforma` e a documentação é um filtro — mudar a seleção GLOBAL para
         estreitar uma lista é efeito colateral que ninguém pediu. O filtro mora
         no formulário, junto dos outros. */
      /**
       * UMA barra, não duas — e agora a de Conexões.
       *
       * Aqui se empilhavam a barra do Assistente e a do rastreio, e a palavra
       * "Conversas" aparecia nas duas, em níveis diferentes. O argumento de que
       * eram "dois níveis" só se sustentava enquanto as três leituras do
       * tráfego morassem juntas — e elas não moram mais: Acessos foi para
       * Desempenho, porque é sobre o que foi LIDO, não sobre o que o bot
       * RESPONDEU.
       *
       * O par que sempre foi indivisível — a conversa e o rastreio do turno que a
       * produziu — continua vizinho, do lado do CLIENTE. Ler conversa de cliente
       * é o mesmo verbo de "Fluxo" e "Execuções", que já moravam lá.
       */
      abas={<AbasRota rota="/admin/integracoes" atual="conversas" permissoes={permissoes} />}
    >

      {/* Filtros — GET, para o estado viver na URL (compartilhável). */}
      <form method="get" className="mt-6 rounded-xl border border-border bg-surface p-4 shadow-1">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {/* PRIMEIRO campo, e não um seletor no cabeçalho: era ali que a
              documentação morava enquanto ela era portão. Como filtro, ela
              pertence ao formulário — junto do que se limpa com um clique. */}
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-xs font-medium text-text-muted">Documentação</span>
            <select className={controlClass} name="space" defaultValue={espacoFiltrado ?? ""}>
              <option value="">Todas as documentações</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <Campo label="Empresa" name="empresa" value={sp.empresa} placeholder="Ex.: ACME" />
          <Campo label="Usuário" name="usuario" value={sp.usuario} placeholder="Ex.: joao" />
          <Campo label="Matrícula" name="matricula" value={sp.matricula} />
          <Campo label="Portal" name="portal" value={sp.portal} />
          <Campo label="Base" name="base" value={sp.base} />
          <Campo label="Perfil" name="perfil" value={sp.perfil} />
          <Campo label="De" name="de" value={sp.de} type="date" />
          <Campo label="Até" name="ate" value={sp.ate} type="date" />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-muted">Feedback</span>
            <select className={controlClass} name="feedback" defaultValue={sp.feedback ?? ""}>
              <option value="">Todos</option>
              <option value="up">👍 Positivo</option>
              <option value="down">👎 Negativo</option>
            </select>
          </label>
          <label className="col-span-2 flex flex-col gap-1 lg:col-span-2">
            <span className="text-xs font-medium text-text-muted">Buscar no texto (pergunta ou resposta)</span>
            <input className={controlClass} name="q" defaultValue={sp.q} placeholder="Ex.: férias, nota fiscal…" />
          </label>
          <div className="col-span-2 flex items-end gap-2 lg:col-span-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              <Search className="size-4" /> Filtrar
            </button>
            {temFiltro && (
              <a
                /* `comBase` porque o basePath do Next NÃO reescreve `href` de
                   `<a>` cru: com o app em /natcorp/ia, o caminho cru submete para
                   a raiz do domínio e devolve 404. Mesma armadilha que já
                   derrubou os filtros da gestão. */
                href={comBase("/admin/conversas")}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:border-primary hover:text-primary"
              >
                Limpar
              </a>
            )}
          </div>
        </div>
      </form>

      <div className="mt-4">
        <ConversasList conversas={lista} limite={LIMITE} totalTrazido={convs.length} />
      </div>
    </PageShell>
  );
}
