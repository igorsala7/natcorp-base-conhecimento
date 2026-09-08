import "server-only";
import { resolveWidgetKey } from "@/lib/widget/auth";
import {
  resolverIdentidadeGestao,
  mensagemDaRecusa,
  type IdentidadeGestao,
  type MotivoRecusa,
} from "@/lib/tracking/resolve-base";

/**
 * Abertura de sessão da área de gestão (`/gestao`), embutida em iFrame numa
 * página do APEX no Painel do Operador.
 *
 * ── Por que os MESMOS dois parâmetros do widget ────────────────────────
 *
 * O bloco PL/SQL de `apex/token-rastreio.sql` já tem as duas constantes que
 * isto precisa — `c_widget` (a chave pública) e o token assinado que ele monta.
 * E já existe precedente de passar o token por querystring para uma PÁGINA: o
 * bloco 3b monta `/docs/<slug>?kbt=<token>` para a documentação.
 *
 * Então a página de gestão entra por `/gestao?key=<c_widget>&kbt=<l_token>`. O
 * cliente não precisa de constante nova, nem de endpoint novo, nem de um
 * segundo mecanismo de identidade para manter em pé. A ÚNICA mudança no APEX é
 * o valor de `c_key`, que passa a ser exclusivo daquela base.
 *
 * ── O que cada parte prova ─────────────────────────────────────────────
 *
 *   `key`  →  QUAL ESPAÇO (painel). Chave pública, não prova identidade.
 *   `kbt`  →  QUEM e DE QUAL BASE. Assinado com a chave da própria base.
 *
 * A base NUNCA vem da URL. Vem do payload verificado, e a verificação usa a
 * chave daquela base — é isso que impede um cliente de ler o outro.
 */

export type SessaoGestao = {
  ok: true;
  identidade: IdentidadeGestao;
  /** Espaço dono da chave — usado para resolver a chave de rastreio da base. */
  spaceId: string;
  /** Repassado nos links internos para não perder a sessão ao navegar. */
  key: string;
  token: string;
};

export type SessaoRecusada = {
  ok: false;
  motivo: MotivoRecusa | "chave_invalida";
  mensagem: string;
};

export type ResultadoSessao = SessaoGestao | SessaoRecusada;

/** Aceita `kbt` (nome usado pelo link de documentação) ou `track`, por conveniência. */
function lerToken(sp: Record<string, string | string[] | undefined>): string | null {
  for (const nome of ["kbt", "track", "token"]) {
    const v = sp[nome];
    const s = Array.isArray(v) ? v[0] : v;
    if (typeof s === "string" && s.trim() !== "") return s.trim();
  }
  return null;
}

function lerChave(sp: Record<string, string | string[] | undefined>): string | null {
  const v = sp.key;
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" && s.trim() !== "" ? s.trim() : null;
}

/**
 * Resolve a sessão a partir dos `searchParams` da página.
 *
 * Nunca lança: toda recusa vira `{ ok: false }` com mensagem acionável, porque
 * a tela precisa distinguir "sua sessão expirou, atualize o painel" de "esta
 * base não foi habilitada" — e o usuário final não tem como agir num 500.
 */
export async function abrirSessaoGestao(
  searchParams: Record<string, string | string[] | undefined>,
  paineisPermitidos: readonly string[] = ["PO"],
): Promise<ResultadoSessao> {
  const publicKey = lerChave(searchParams);
  const token = lerToken(searchParams);

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
    identidade: r.identidade,
    spaceId: chave.space_id,
    key: publicKey!,
    token,
  };
}

/**
 * Monta o href de uma página irmã preservando a sessão.
 *
 * O token viaja na URL porque é assim que o APEX entrega a identidade e porque
 * ele é curto e expira junto com a sessão do painel (`exp` = o
 * `Maximum Session Idle Time` do APEX). Não há cookie: um cookie de terceiros
 * dentro de iFrame é bloqueado por padrão nos navegadores atuais, e depender
 * dele quebraria a página em metade dos clientes.
 */
export function linkGestao(s: SessaoGestao, caminho: string): string {
  const qs = new URLSearchParams({ key: s.key, kbt: s.token });
  return `${caminho}?${qs.toString()}`;
}
