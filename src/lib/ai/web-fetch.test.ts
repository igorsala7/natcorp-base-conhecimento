import { describe, it, expect } from "vitest";
import { extrairUrls, buscarPaginas, hostPermitido } from "./web-fetch";

describe("extrairUrls", () => {
  it("acha URLs http(s), apara pontuação final e deduplica", () => {
    const urls = extrairUrls(
      "Veja https://www.natcorp.com.br/privacidade/ e (http://exemplo.com/a). E de novo https://www.natcorp.com.br/privacidade/",
    );
    expect(urls).toContain("https://www.natcorp.com.br/privacidade/");
    expect(urls).toContain("http://exemplo.com/a");
    expect(urls).toHaveLength(2); // deduplicado
  });

  it("ignora texto sem URL", () => {
    expect(extrairUrls("sem links aqui")).toEqual([]);
  });
});

describe("hostPermitido (allowlist)", () => {
  it("casa o domínio e seus subdomínios", () => {
    const lista = ["natcorp.com.br"];
    expect(hostPermitido("natcorp.com.br", lista)).toBe(true);
    expect(hostPermitido("www.natcorp.com.br", lista)).toBe(true);
    expect(hostPermitido("natcorp.com.br.evil.com", lista)).toBe(false); // não é subdomínio
    expect(hostPermitido("outro.com", lista)).toBe(false);
  });

  it("lista vazia bloqueia tudo", () => {
    expect(hostPermitido("natcorp.com.br", [])).toBe(false);
  });
});

// A proteção SSRF barra endereços internos ANTES de qualquer rede — então estes
// casos são determinísticos (não dependem de acesso à internet no CI).
describe("buscarPaginas — proteção SSRF (bloqueio sem rede)", () => {
  const bloqueado = async (url: string, allowlist?: string[]) => {
    const [r] = await buscarPaginas([url], allowlist ? { allowlist } : undefined);
    expect(r?.ok).toBe(false);
    return r && r.ok === false ? r.motivo : "";
  };

  it("bloqueia localhost e IPs de rede interna", async () => {
    expect(await bloqueado("http://localhost/x")).toMatch(/interna|privada/);
    expect(await bloqueado("http://127.0.0.1/x")).toMatch(/interna|privada/);
    expect(await bloqueado("http://10.0.0.5/x")).toMatch(/interna|privada/);
    expect(await bloqueado("http://192.168.1.1/x")).toMatch(/interna|privada/);
    expect(await bloqueado("http://[::1]/x")).toMatch(/interna|privada/);
  });

  it("bloqueia o metadata da nuvem (169.254.169.254)", async () => {
    expect(await bloqueado("http://169.254.169.254/latest/meta-data/")).toMatch(/interna|privada/);
  });

  it("recusa esquemas fora de http/https", async () => {
    expect(await bloqueado("ftp://arquivo/x")).toMatch(/http/);
    expect(await bloqueado("file:///etc/passwd")).toMatch(/http/);
  });

  it("no leitor, recusa domínio fora da allowlist antes de qualquer rede", async () => {
    expect(await bloqueado("http://qualquer-site.com/x", ["natcorp.com.br"])).toMatch(/lista permitida/);
  });
});
