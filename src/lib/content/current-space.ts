import "server-only";
import { cookies } from "next/headers";
export { SPACE_COOKIE } from "./space-cookie";

/**
 * Espaço (documentação) "em manutenção" — persistente entre as telas do admin.
 *
 * O seletor grava a escolha num cookie (client-side) e cada tela resolve o
 * espaço na mesma ordem: `?space=` da URL vence (deep link / navegação
 * explícita); sem ele, cai no último escolhido (cookie); senão a tela decide o
 * padrão. Assim, escolher a documentação numa tela vale para as próximas.
 */
import { SPACE_COOKIE } from "./space-cookie";

/** ID resolvido (URL → cookie), só se existir na lista atual. Senão `undefined`. */
export async function resolvedSpaceId(
  paramSpace: string | undefined,
  spaces: { id: string }[],
): Promise<string | undefined> {
  const ids = new Set(spaces.map((s) => s.id));
  if (paramSpace && ids.has(paramSpace)) return paramSpace;
  const store = await cookies();
  const fromCookie = store.get(SPACE_COOKIE)?.value;
  if (fromCookie && ids.has(fromCookie)) return fromCookie;
  return undefined;
}

/** Espaço escolhido (URL → cookie → primeiro da lista). Conveniência para as telas. */
export async function pickSpace<T extends { id: string }>(
  spaces: T[],
  paramSpace?: string,
): Promise<T | undefined> {
  const id = await resolvedSpaceId(paramSpace, spaces);
  return spaces.find((s) => s.id === id) ?? spaces[0];
}
