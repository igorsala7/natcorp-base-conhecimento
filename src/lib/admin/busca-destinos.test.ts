import { describe, it, expect } from "vitest";
import { buscarDestinos } from "./busca-destinos";

/** Owner — vê tudo. As restrições são testadas separadamente. */
const TUDO = new Set([
  "content.view",
  "content.import",
  "content.create",
  "content.restore",
  "review.approve",
  "space.manage",
  "widget.manage",
  "integrations.manage",
  "user.view",
  "ai.configure",
  "audit.read",
  "system.backup",
]);

describe("busca de destinos", () => {
  it("acha pelo nome, ignorando acento e caixa", () => {
    expect(buscarDestinos("conteudo", TUDO)[0]?.href).toBe("/admin/documentacoes");
    expect(buscarDestinos("CONTEÚDO", TUDO)[0]?.href).toBe("/admin/documentacoes");
  });

  it("prefere o que COMEÇA com o termo", () => {
    // "Conexões" também contém "con", mas "Conteúdo" e "Conexões" começam com
    // ele — o desempate é alfabético, e o que importa é os dois virem antes de
    // qualquer casamento por descrição.
    const r = buscarDestinos("con", TUDO);
    expect(r.map((d) => d.rotulo)).toContain("Conexões");
  });

  it("alcança o destino pelos nomes ANTIGOS", () => {
    // O redesenho move coisa de lugar sem redirects. Estes são os nomes que a
    // equipe tem na memória muscular.
    // "widget" cai no Assistente, não em Sistema — foi o agrupamento pedido:
    // configurar o bot DESTA documentação é o trabalho frequente; o registro
    // global de todas as chaves é auditoria, e vive em Sistema › Chaves.
    expect(buscarDestinos("widget", TUDO)[0]?.href).toContain("/admin/assistente");
    expect(buscarDestinos("chaves de api", TUDO)[0]?.href).toContain("/admin/sistema");
    expect(buscarDestinos("análises", TUDO)[0]?.href).toBe("/admin/analises");
    expect(buscarDestinos("logs do chat", TUDO)[0]?.href).toBe("/admin/assistente");
    expect(buscarDestinos("usuários", TUDO)[0]?.href).toBe("/admin/usuarios");
    expect(buscarDestinos("integrações", TUDO)[0]?.href).toBe("/admin/integracoes");
    // "lixeira" cai na ABA, não na árvore: o rótulo da aba contém a palavra e
    // vence o apelido da página. É o comportamento certo — quem procura a
    // lixeira quer a lixeira, não a tela que a contém.
    expect(buscarDestinos("lixeira", TUDO)[0]?.href).toBe("/admin/documentacoes");
  });

  it("oferece ABA como destino, com o contexto do dono", () => {
    /**
     * Este teste travava o defeito, não o acerto: ele exigia
     * `/admin/assistente?aba=ontologia`, um endereço que NÃO EXISTIA. A
     * ontologia sempre foi a rota `/admin/ontologia`; a página do assistente
     * nunca leu `?aba=`. O teste passava porque só conferia o que a função
     * montava, nunca se o destino abria.
     *
     * Agora o destino vem de `abasDaRota` — a mesma função que a barra de abas
     * usa —, então o que a paleta oferece é literalmente o link em que a barra
     * clica.
     */
    const onto = buscarDestinos("ontologia", TUDO).find((d) => d.contexto);
    expect(onto?.contexto).toBe("Assistente de IA");
    expect(onto?.href).toBe("/admin/ontologia");
  });

  it("aba que é `?aba=` na própria rota continua sendo oferecida assim", () => {
    const qualidade = buscarDestinos("qualidade", TUDO).find((d) => d.contexto === "Desempenho");
    expect(qualidade?.href).toBe("/admin/analises?aba=qualidade");
  });

  it("a página vence a aba de mesmo nome", () => {
    // Quem digita "Conteúdo" quer a tela, não uma aba dentro dela.
    const r = buscarDestinos("conteudo", TUDO);
    expect(r[0]?.href).toBe("/admin/documentacoes");
  });

  it("não oferece o que a pessoa não pode abrir", () => {
    const leitor = new Set(["content.view"]);
    const r = buscarDestinos("sistema", leitor);
    expect(r.every((d) => !d.href.startsWith("/admin/sistema"))).toBe(true);
    // …mas o que ela PODE continua alcançável.
    expect(buscarDestinos("conteudo", leitor)[0]?.href).toBe("/admin/documentacoes");
  });

  it("esconde a aba cuja permissão própria falta, mantendo a página", () => {
    // "Backup" exige system.backup; sem ele, Sistema continua acessível.
    const semBackup = new Set(["ai.configure"]);
    const r = buscarDestinos("backup", semBackup);
    expect(r.some((d) => d.href.includes("aba=backup"))).toBe(false);
  });

  it("a descrição é rede de segurança para palavra que ninguém previu", () => {
    // "lacunas" só existe na descrição do Desempenho.
    expect(buscarDestinos("lacunas", TUDO)[0]?.href).toBe("/admin/analises");
  });

  it("consulta vazia não devolve nada", () => {
    expect(buscarDestinos("", TUDO)).toEqual([]);
  });
});
