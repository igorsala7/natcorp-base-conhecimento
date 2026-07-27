/**
 * Identidade de rastreio do leitor no portal (lado do cliente).
 *
 * A página do portal costuma ser aberta UMA vez com os parâmetros na URL
 * (`?p_usuario=…&p_empresa=…`); ao navegar por links internos, a querystring se
 * perde. Por isso, quando os parâmetros chegam pela URL nós os guardamos em
 * `localStorage` e passamos a reusá-los nas páginas seguintes — assim a conversa
 * E os acessos continuam atribuídos ao mesmo usuário durante a visita.
 */
const KEY = "kb.portal.track";
const NAMES = ["base", "usuario", "portal", "empresa", "matricula", "perfil"] as const;

export type PortalIdentity = Record<string, string>;

/**
 * Lê os parâmetros `p_*` da URL atual; se houver, salva e retorna. Caso a URL
 * não os traga, cai no que foi salvo antes (mesma visita). Retorna `null` quando
 * não há identidade alguma.
 */
export function readPortalIdentity(): PortalIdentity | null {
  if (typeof window === "undefined") return null;

  const fromUrl: PortalIdentity = {};
  try {
    const qs = new URLSearchParams(window.location.search);
    for (const n of NAMES) {
      const v = qs.get(`p_${n}`);
      if (v) fromUrl[`p_${n}`] = v.trim().slice(0, 200);
    }
  } catch {
    /* URL inválida — ignora */
  }

  if (Object.keys(fromUrl).length) {
    try {
      localStorage.setItem(KEY, JSON.stringify(fromUrl));
    } catch {
      /* storage indisponível — segue só com o da URL */
    }
    return fromUrl;
  }

  try {
    const salvo = localStorage.getItem(KEY);
    if (salvo) {
      const obj = JSON.parse(salvo) as unknown;
      if (obj && typeof obj === "object") return obj as PortalIdentity;
    }
  } catch {
    /* ignora */
  }
  return null;
}
