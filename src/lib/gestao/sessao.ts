import "server-only";
import { headers } from "next/headers";
import { resolveWidgetKey } from "@/lib/widget/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/lib/auth/permissions";
import {
  resolverIdentidadeGestao,
  mensagemDaRecusa,
  type IdentidadeGestao,
  type MotivoRecusa,
} from "@/lib/tracking/resolve-base";

/**
 * Abertura de sessão da área de gestão (`/gestao`).
 *
 * DOIS caminhos de entrada, e a diferença entre eles é quem autoriza:
 *
 *   modo "cliente"  → token do APEX, assinado com a chave DAQUELA base.
 *                     É a porta do iFrame no Painel do Operador.
 *   modo "suporte"  → sessão do Supabase + permissão `gestao.suporte`.
 *                     É a porta do time interno, em /admin/gestao.
 *
 * ── Por que o suporte NÃO usa um token de cliente ──────────────────────
 *
 * Seria fácil: temos a chave da base, dava para emitir um token dizendo
 * SUPORTE_NATCORP e reusar tudo. Mas aí o registro de quem fez o quê passaria a
 * mentir — `audit_log` guardaria um login de cliente para uma ação da Natcorp,
 * e `ai_usage` atribuiria consumo interno ao cliente. Autorizar pelo RBAC custa
 * um caminho a mais e mantém o rastro honesto: `actor_id` é o usuário interno
 * de verdade.
 *
 * ── O que o modo suporte NÃO faz ───────────────────────────────────────
 *
 * Não se passa por ninguém. `identidade.usuario` é nulo e `painel` é nulo — a
 * visão é da BASE inteira, que é o que as telas já mostram. Reproduzir a tela
 * de um usuário específico seria impersonação, e a decisão foi não ter isso.
 */

export type ModoGestao = "cliente" | "suporte";

export type SessaoGestao = {
  ok: true;
  modo: ModoGestao;
  identidade: IdentidadeGestao;
  /** Espaço da chave do widget. Nulo no modo suporte — não há token a validar. */
  spaceId: string | null;
  /** Chave pública e token, só no modo cliente; usados para preservar a sessão nos links. */
  key: string | null;
  token: string | null;
  /** Quem é o operador interno. Só no modo suporte. */
  operador: { id: string; email: string | null } | null;
};

export type SessaoRecusada = {
  ok: false;
  motivo: MotivoRecusa | "chave_invalida" | "sem_permissao" | "base_nao_informada";
  mensagem: string;
};

export type ResultadoSessao = SessaoGestao | SessaoRecusada;

type Params = Record<string, string | string[] | undefined>;

function um(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && s.trim() !== "" ? s.trim() : null;
}

/** Aceita `kbt` (nome usado pelo link de documentação), `track` ou `token`. */
function lerToken(sp: Params): string | null {
  return um(sp.kbt) ?? um(sp.track) ?? um(sp.token);
}

/**
 * Resolve a sessão a partir dos `searchParams` da página.
 *
 * Nunca lança: toda recusa vira `{ ok: false }` com mensagem acionável, porque
 * a tela precisa distinguir "sua sessão expirou, atualize o painel" de "esta
 * base não foi habilitada" — e o usuário final não tem como agir num 500.
 */
export async function abrirSessaoGestao(
  searchParams: Params,
  paineisPermitidos: readonly string[] = ["PO"],
): Promise<ResultadoSessao> {
  // O modo suporte é DECLARADO, não inferido pela ausência de token. Inferir
  // faria uma sessão de cliente expirada cair silenciosamente no caminho
  // interno, e a diferença entre os dois é de autorização.
  if (um(searchParams.suporte) === "1") return sessaoDeSuporte(searchParams);
  return sessaoDeCliente(searchParams, paineisPermitidos);
}

async function sessaoDeCliente(
  sp: Params,
  paineisPermitidos: readonly string[],
): Promise<ResultadoSessao> {
  const publicKey = um(sp.key);
  const token = lerToken(sp);

  if (!token) {
    return { ok: false, motivo: "sem_token", mensagem: mensagemDaRecusa("sem_token") };
  }

  const chave = await resolveWidgetKey(publicKey);
  if (!chave) {
    return {
      ok: false,
      motivo: "chave_invalida",
      mensagem: "Esta página precisa ser aberta de dentro do painel. O link direto não funciona.",
    };
  }

  const r = await resolverIdentidadeGestao(chave.space_id, token, paineisPermitidos);
  if (!r.ok) {
    return { ok: false, motivo: r.motivo, mensagem: mensagemDaRecusa(r.motivo) };
  }

  return {
    ok: true,
    modo: "cliente",
    identidade: r.identidade,
    spaceId: chave.space_id,
    key: publicKey,
    token,
    operador: null,
  };
}

async function sessaoDeSuporte(sp: Params): Promise<ResultadoSessao> {
  const baseCode = um(sp.base);
  if (!baseCode) {
    return {
      ok: false,
      motivo: "base_nao_informada",
      mensagem: "Escolha um cliente para abrir a gestão.",
    };
  }

  // A permissão é verificada ANTES de qualquer leitura da base: sem isto, uma
  // requisição direta a /gestao?suporte=1&base=X revelaria ao menos se a base
  // existe, e depois o resto.
  if (!(await hasPermission("gestao.suporte"))) {
    return {
      ok: false,
      motivo: "sem_permissao",
      mensagem:
        "Você não tem permissão para abrir a gestão de clientes. Peça a permissão “gestao.suporte” a um administrador.",
    };
  }

  const db = createAdminClient();
  const { data: base } = await db
    .from("ai_bases")
    .select("id, base_code, name, active")
    .ilike("base_code", baseCode.replace(/([\\%_])/g, "\\$1"))
    .maybeSingle();

  if (!base) {
    return { ok: false, motivo: "base_desconhecida", mensagem: "Cliente não encontrado." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    ok: true,
    modo: "suporte",
    identidade: {
      baseCode: base.base_code,
      baseId: base.id,
      baseNome: base.name,
      // Suporte não se passa por ninguém: sem usuário, sem perfil, sem painel.
      // As telas mostram a base inteira, que é o que já faziam.
      usuario: null,
      perfil: null,
      painel: null,
      empresa: null,
      matricula: null,
    },
    spaceId: null,
    key: null,
    token: null,
    operador: user ? { id: user.id, email: user.email ?? null } : null,
  };
}

/**
 * Registra que alguém do time interno abriu a gestão de um cliente.
 *
 * Chamado só pelas PÁGINAS, não pelas ações — a ação já grava em `audit_log`, e
 * duplicar encheria a tabela de ruído. Best-effort: falha aqui não pode
 * derrubar a tela.
 */
export async function registrarAcessoSuporte(s: SessaoGestao, pagina: string): Promise<void> {
  if (s.modo !== "suporte") return;
  try {
    const h = await headers();
    await createAdminClient()
      .from("gestao_suporte_acessos")
      .insert({
        actor_id: s.operador?.id ?? null,
        base_code: s.identidade.baseCode,
        pagina,
        ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
        user_agent: h.get("user-agent")?.slice(0, 500) ?? null,
      });
  } catch {
    // Registro de auditoria não pode quebrar a página que ele observa.
  }
}

/**
 * Monta o href de uma página irmã preservando a sessão.
 *
 * No modo cliente o token viaja na URL porque é assim que o APEX entrega a
 * identidade, e porque ele expira junto com a sessão do painel. Não há cookie:
 * cookie de terceiros dentro de iFrame é bloqueado por padrão nos navegadores
 * atuais, e depender dele quebraria a página em metade dos clientes.
 *
 * No modo suporte, o cookie de sessão do admin JÁ viaja (mesmo site), então
 * basta carregar qual cliente está aberto.
 */
export function linkGestao(s: SessaoGestao, caminho: string): string {
  return `${caminho}?${new URLSearchParams(paramsDaSessao(s)).toString()}`;
}

/**
 * O que um formulário precisa devolver para a ação reabrir a MESMA sessão.
 *
 * As ações revalidam a sessão do zero a cada chamada — Server Action é um
 * endpoint, e confiar num `base` vindo do formulário deixaria um cliente
 * escrever no outro. Estes são os parâmetros que a revalidação consome, e não
 * a base em si: no modo cliente ela sai do token, no modo suporte, da
 * permissão do usuário logado.
 */
export function paramsDaSessao(s: SessaoGestao): Record<string, string> {
  return s.modo === "suporte"
    ? { suporte: "1", base: s.identidade.baseCode }
    : { key: s.key ?? "", kbt: s.token ?? "" };
}
