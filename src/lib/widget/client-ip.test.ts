/**
 * DE ONDE SAI O "IP" QUE VIROU IDENTIDADE DE BALDE.
 *
 * `clientIp` alimenta o rate limit de toda a v1 e, desde a tarefa 20, é o SUJEITO
 * do balde do acesso anônimo em `/api/v1/alertas/visto`. Enquanto ela devolvia o
 * primeiro elemento de `X-Forwarded-For`, esse sujeito era um campo que o
 * chamador escreve: o bloco nginx do `DEPLOY.md` usa
 * `$proxy_add_x_forwarded_for`, que ACRESCENTA o IP real em vez de substituir a
 * lista.
 *
 * O que estes casos fixam é a ORDEM: `X-Real-IP` primeiro (é o único que o proxy
 * reescreve), e no `X-Forwarded-For` o ÚLTIMO elemento, que é o que o proxy
 * escreveu. O que eles NÃO provam está dito no comentário da função: nada aqui
 * garante que o cabeçalho veio do nosso proxy.
 */
import { describe, it, expect, vi } from "vitest";

// `auth.ts` também resolve chave e rate limit, e para isso importa o cliente
// service-role — que lê o `env` no import. Esta função não toca em banco.
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { clientIp } from "./auth";

/** O bastante de `NextRequest` para esta função: os cabeçalhos. */
function req(headers: Record<string, string>) {
  return { headers: new Headers(headers) } as never;
}

describe("clientIp", () => {
  it("prefere X-Real-IP, que o nginx substitui por $remote_addr", () => {
    // O ataque: a pessoa manda um XFF inventado. O nginx acrescenta o IP real no
    // FIM e põe o peer real em X-Real-IP.
    const ip = clientIp(
      req({ "x-forwarded-for": "9.9.9.9, 203.0.113.7", "x-real-ip": "203.0.113.7" }),
    );
    expect(ip).toBe("203.0.113.7");
  });

  it("sem X-Real-IP, lê o ÚLTIMO elemento de X-Forwarded-For", () => {
    // O primeiro elemento é o mais ANTIGO da cadeia — aqui, o que o chamador
    // digitou. O último é o que o hop mais próximo acrescentou.
    expect(clientIp(req({ "x-forwarded-for": "9.9.9.9, 198.51.100.4" }))).toBe("198.51.100.4");
  });

  it("um elemento só continua sendo esse elemento", () => {
    expect(clientIp(req({ "x-forwarded-for": "198.51.100.4" }))).toBe("198.51.100.4");
  });

  it("espaços e vírgula sobrando não viram sujeito vazio", () => {
    // Um sujeito vazio juntaria acessos diferentes no mesmo balde — foi
    // exatamente o defeito que a tarefa 22 encontrou do outro lado, em
    // `/api/v1/alertas/visto`.
    expect(clientIp(req({ "x-forwarded-for": " 9.9.9.9 , 198.51.100.4 , " }))).toBe("198.51.100.4");
    expect(clientIp(req({ "x-forwarded-for": " , " }))).toBe("0.0.0.0");
    expect(clientIp(req({ "x-real-ip": "   " }))).toBe("0.0.0.0");
  });

  it("sem cabeçalho nenhum, devolve o valor neutro", () => {
    expect(clientIp(req({}))).toBe("0.0.0.0");
  });
});
