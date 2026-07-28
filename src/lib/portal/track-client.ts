/**
 * Identidade de rastreio do leitor no portal (lado do cliente).
 *
 * Os parâmetros p_* deixaram de viajar em texto: o backend do cliente gera um
 * TOKEN cifrado (à prova de adulteração) e o passa em `?kbt=` na URL. A página
 * do portal costuma ser aberta UMA vez com o token; ao navegar por links
 * internos a querystring se perde, então guardamos o token em `localStorage` e
 * o reusamos nas páginas seguintes — conversa e acessos seguem atribuídos ao
 * mesmo usuário durante a visita. O servidor é quem decifra e valida.
 */
const KEY = "kb.portal.kbt";

export type PortalIdentity = { token: string };

/**
 * Lê o token `?kbt=` da URL atual; se houver, salva e retorna. Caso a URL não o
 * traga, cai no que foi salvo antes (mesma visita). Retorna `null` quando não há
 * token algum.
 */
export function readPortalIdentity(): PortalIdentity | null {
  if (typeof window === "undefined") return null;

  let token = "";
  try {
    token = (new URLSearchParams(window.location.search).get("kbt") ?? "").trim();
  } catch {
    /* URL inválida — ignora */
  }

  if (token) {
    try {
      localStorage.setItem(KEY, token);
    } catch {
      /* storage indisponível — segue só com o da URL */
    }
    return { token };
  }

  try {
    const salvo = localStorage.getItem(KEY);
    if (salvo) return { token: salvo };
  } catch {
    /* ignora */
  }
  return null;
}
