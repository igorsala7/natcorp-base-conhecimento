import type { ProviderConnect } from "./oauth-user";

/**
 * O `redirect_uri`, que precisa bater BYTE A BYTE com o registrado no provedor
 * — divergência devolve `AADSTS50011` e nenhuma pista melhor.
 *
 * Sai de `NEXT_PUBLIC_SITE_URL`, que já inclui o basePath em produção
 * (`https://www.natcorpbr.com.br/natcorp/ia`), e não da URL da requisição: o
 * app está atrás de nginx, e derivar do request traria o host interno.
 */
export function redirectUri(provider: ProviderConnect): string {
  const raiz = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  // Sem a variável, o retorno seria `/api/v1/connect/...` — um CAMINHO. A
  // requisição sai assim mesmo e o provedor recusa com "AADSTS900971: No reply
  // address provided", uma mensagem que manda procurar o erro no cadastro do
  // app, onde ele não está. Falhar aqui, dizendo o nome da variável, tira dias
  // de investigação do lugar errado.
  if (!/^https?:\/\//i.test(raiz)) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL não está configurada no servidor (valor atual: " +
        (raiz ? `"${raiz}"` : "vazio") +
        "). Sem ela não há endereço de retorno para o provedor. Defina a URL pública " +
        "completa (ex.: https://www.natcorpbr.com.br/natcorp/ia) no .env e reconstrua a imagem.",
    );
  }
  return `${raiz}/api/v1/connect/${provider}/callback`;
}
