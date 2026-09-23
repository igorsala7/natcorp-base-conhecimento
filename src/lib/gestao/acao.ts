import { z } from "zod";
import { abrirSessaoGestao } from "@/lib/gestao/sessao";

/**
 * O PORTÃO DAS SERVER ACTIONS DA GESTÃO — compartilhado.
 *
 * Saiu de `src/app/gestao/actions.ts` em 23/09 para que a tela de prompts
 * usasse EXATAMENTE a mesma revalidação, e não uma segunda cópia que um dia
 * divergisse. Um arquivo `"use server"` não consegue exportar um schema do Zod
 * (ali todo export precisa ser função assíncrona), então o helper mora aqui,
 * em módulo normal, e os arquivos de ação o importam.
 */

/**
 * Ações da área de gestão.
 *
 * ── Toda ação REVALIDA o token ─────────────────────────────────────────
 *
 * Server Action é um endpoint. Quem chama pode não ser a nossa página: basta
 * um POST com o id certo. Como aqui não existe sessão do Supabase para o
 * `requirePermission` conferir, a identidade tem de ser reconstruída do token a
 * cada chamada — e a base sai DELE, nunca do payload.
 *
 * Se a base viesse do formulário, um cliente compraria crédito no nome de
 * outro, ou bloquearia ferramenta na base do vizinho. É o mesmo cuidado que a
 * página tem na entrada, aplicado onde o dado é ESCRITO.
 */

export type ResultadoAcao = { ok: true } | { ok: false; erro: string };

/**
 * Campos de sessão que acompanham todo formulário da área.
 *
 * Os quatro são opcionais porque existem DOIS modos: o cliente manda
 * `key` + `kbt` (token do APEX), o suporte manda `suporte` + `base` (e a
 * autorização vem do cookie de sessão do admin). `abrirSessaoGestao` recusa
 * qualquer combinação que não feche.
 */
export const sessaoSchema = z.object({
  key: z.string().optional(),
  kbt: z.string().optional(),
  suporte: z.string().optional(),
  base: z.string().optional(),
});

export type CamposSessao = z.infer<typeof sessaoSchema>;

export type SessaoResolvida = {
  ok: true;
  base: string;
  /** Login do cliente, ou null no suporte — que não se passa por ninguém. */
  usuario: string | null;
  modo: "cliente" | "suporte";
  /** Usuário interno, só no suporte. Vai para `audit_log.actor_id`. */
  operadorId: string | null;
  operadorEmail: string | null;
};

/**
 * Revalida a sessão e devolve a base — ou o erro que a tela mostra.
 *
 * A base NUNCA vem do formulário: no modo cliente sai do token verificado, no
 * modo suporte é conferida contra a permissão `gestao.suporte` do usuário
 * logado. Um POST forjado com outra base não passa por aqui.
 */
export async function baseDaSessao(
  input: CamposSessao,
): Promise<SessaoResolvida | { ok: false; erro: string }> {
  const s = await abrirSessaoGestao({
    key: input.key,
    kbt: input.kbt,
    suporte: input.suporte,
    base: input.base,
  });
  if (!s.ok) return { ok: false, erro: s.mensagem };
  return {
    ok: true,
    base: s.identidade.baseCode,
    usuario: s.identidade.usuario,
    modo: s.modo,
    operadorId: s.operador?.id ?? null,
    operadorEmail: s.operador?.email ?? null,
  };
}

/**
 * Quem assina a ação, para o registro.
 *
 * No suporte, `criado_por` recebe o e-mail interno com um prefixo — quem ler a
 * linha meses depois precisa saber que aquilo não foi o cliente que fez.
 */
export function autorDa(s: SessaoResolvida): string | null {
  return s.modo === "suporte"
    ? `suporte:${s.operadorEmail ?? s.operadorId ?? "natcorp"}`
    : s.usuario;
}
