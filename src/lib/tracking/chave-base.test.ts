import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/tracking/token", () => ({ gerarChaveRastreio: () => "x".repeat(64) }));
vi.mock("@/lib/crypto/secrets", () => ({ encryptSecret: (s: string) => s, tryDecryptSecret: (s: string) => s }));

const { montarBlocoApex, siteDaGestao, ESPACO_GESTAO } = await import("./chave-base");

/**
 * O que se testa aqui é o FORMATO do bloco, e não é detalhe: o texto vai para
 * dentro de uma região PL/SQL do APEX de um cliente. Uma constante com nome
 * errado, aspas faltando ou `varchar2` de tamanho menor que a chave não falha
 * aqui — falha lá, na tela do cliente, depois de alguém colar.
 */
describe("montarBlocoApex", () => {
  const chave = "a".repeat(64);

  it("monta as três constantes na ordem do arquivo do APEX", () => {
    const linhas = montarBlocoApex({ chave, widgetKey: "pk_live_abc", site: "https://x.com/ia" }).split("\n");
    expect(linhas).toHaveLength(3);
    expect(linhas[0]).toContain("c_key");
    expect(linhas[1]).toContain("c_widget");
    expect(linhas[2]).toContain("c_site");
  });

  it("declara c_key como varchar2(64) — a chave tem 64 caracteres", () => {
    const bloco = montarBlocoApex({ chave, widgetKey: "pk", site: "https://x" });
    expect(bloco).toContain("c_key    constant varchar2(64)");
    expect(chave).toHaveLength(64);
  });

  it("põe cada valor entre aspas simples, que é o que o PL/SQL espera", () => {
    const bloco = montarBlocoApex({ chave, widgetKey: "pk_live_abc", site: "https://x.com/ia" });
    expect(bloco).toContain(`:= '${chave}';`);
    expect(bloco).toContain(`:= 'pk_live_abc';`);
    expect(bloco).toContain(`:= 'https://x.com/ia';`);
  });

  /**
   * Sem widget ativo no espaço, o certo é deixar um marcador visível — nunca
   * string vazia, que compila no APEX e só falha em runtime, sem dizer por quê.
   */
  it("deixa marcador legível quando não há chave de widget", () => {
    const bloco = montarBlocoApex({ chave, widgetKey: null, site: "https://x" });
    expect(bloco).toContain("<chave pública do widget deste painel>");
    expect(bloco).not.toContain("''");
  });

  it("a área de gestão vive no Painel do Operador", () => {
    expect(ESPACO_GESTAO).toBe("natcorp");
  });
});

describe("siteDaGestao", () => {
  it("tira a barra final — ela viraria // na URL do iframe", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.natcorpbr.com.br/natcorp/ia/");
    expect(siteDaGestao()).toBe("https://www.natcorpbr.com.br/natcorp/ia");
    vi.unstubAllEnvs();
  });

  it("sem a variável, devolve um marcador em vez de string vazia", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(siteDaGestao()).toBe("https://SEU-SITE");
    vi.unstubAllEnvs();
  });
});
