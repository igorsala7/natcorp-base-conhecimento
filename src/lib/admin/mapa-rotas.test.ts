import { describe, it, expect } from "vitest";
import { MAPA, ROTAS, rotaAtiva } from "./mapa-rotas";

/**
 * O mapa é a fonte única de três consumidores (menu, breadcrumb, Cmd+K). Um
 * erro aqui não quebra o build — só apaga o menu numa tela, que é o tipo de
 * defeito que sobrevive meses.
 */
describe("mapa de rotas", () => {
  it("acende o item pelo prefixo mais longo, não pelo primeiro que bate", () => {
    // O defeito clássico: `/admin` casa com tudo. Sem a regra do prefixo mais
    // longo, o Painel acenderia dentro do editor.
    expect(rotaAtiva("/admin")?.href).toBe("/admin");
    expect(rotaAtiva("/admin/conteudo")?.href).toBe("/admin/conteudo");
    expect(rotaAtiva("/admin/conteudo/abc-123")?.href).toBe("/admin/conteudo");
  });

  it("mantém o item aceso nas rotas que foram absorvidas", () => {
    // Foi para isto que o `also` existia. Aqui é declarado junto do destino.
    expect(rotaAtiva("/admin/importar")?.href).toBe("/admin/conteudo");
    expect(rotaAtiva("/admin/estudio/sessao-1")?.href).toBe("/admin/conteudo");
    expect(rotaAtiva("/admin/ontologia")?.href).toBe("/admin/assistente");
    expect(rotaAtiva("/admin/conversas")?.href).toBe("/admin/assistente");
    expect(rotaAtiva("/admin/logs")?.href).toBe("/admin/assistente");
    expect(rotaAtiva("/admin/aparencia")?.href).toBe("/admin/portal");
    expect(rotaAtiva("/admin/auditoria")?.href).toBe("/admin/operacao");
  });

  it("não acende nada fora do admin", () => {
    expect(rotaAtiva("/docs/global/financeiro")).toBeNull();
  });

  it("não tem dois itens disputando o mesmo caminho", () => {
    // Dois itens com o mesmo prefixo tornam o acendimento imprevisível — quem
    // ganha passa a depender da ordem de declaração.
    const vistos = new Map<string, string>();
    for (const r of ROTAS) {
      for (const base of r.tambem ?? [r.href]) {
        const dono = vistos.get(base);
        expect(dono ?? r.href, `"${base}" está em ${dono} e em ${r.href}`).toBe(r.href);
        vistos.set(base, r.href);
      }
    }
  });

  it("toda rota declara permissão e descrição", () => {
    // A permissão alimenta o menu E a tela de recusa; a descrição alimenta o
    // subtítulo E o Cmd+K. Faltando uma, o buraco aparece em dois lugares.
    for (const r of ROTAS) {
      expect(r.permissao, r.href).toBeTruthy();
      expect(r.descricao.length, r.href).toBeGreaterThan(10);
    }
  });

  it("o escopo do item cabe no escopo da seção", () => {
    for (const s of MAPA) {
      if (s.escopo === "geral") continue;
      for (const r of s.rotas) {
        // Um item de plataforma sob o seletor de documentação prometeria que
        // ele obedece ao seletor — e não obedece.
        expect(r.escopo, `${r.href} em "${s.titulo}"`).toBe(s.escopo);
      }
    }
  });
});
