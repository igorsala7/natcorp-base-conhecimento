import { describe, it, expect } from "vitest";
import { MAPA, ROTAS, abasDaRota, rotaAtiva, trilha } from "./mapa-rotas";

/**
 * O CONTRATO DO MAPA — o que impede a próxima divergência.
 *
 * Este arquivo nasceu de um defeito concreto: o `mapa-rotas` declarava 15 abas
 * e 11 delas não existiam. Ele oferecia "Sistema › Chaves" (aba que nunca
 * existiu nesta tela), "Desempenho › Qualidade" (a página era uma rolagem sem
 * abas) e "Importar › Embeddings" (a tela lia `?tab=`, não `?aba=`). Nada
 * falhava: o link abria a tela certa na aba padrão, e a pessoa concluía que
 * tinha errado a busca.
 *
 * Contrato declarado sem verificação sempre diverge. Não porque alguém é
 * descuidado — porque duas listas mantidas à mão, em arquivos diferentes,
 * separadas por semanas, não têm como concordar.
 *
 * A defesa principal é ESTRUTURAL, não de teste: as barras de abas e o Cmd+K
 * agora leem `abasDaRota()`, a mesma função, então não há segunda lista para
 * divergir. O que sobra para o teste são os invariantes que a estrutura não
 * garante sozinha — e que já foram quebrados pelo menos uma vez cada um.
 */

const TODAS_AS_PERMISSOES = new Set(
  ROTAS.flatMap((r) => [r.permissao, ...(r.abas ?? []).map((a) => a.permissao)]).filter(
    (p): p is string => Boolean(p),
  ),
);

describe("mapa de rotas — integridade", () => {
  it("não repete href entre rotas", () => {
    const hrefs = ROTAS.map((r) => r.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("todo href começa em /admin", () => {
    for (const r of ROTAS) expect(r.href.startsWith("/admin")).toBe(true);
  });

  it("todo `tambem` inclui o próprio href", () => {
    // Sem isso a rota canônica não acende o item do menu — foi o defeito que o
    // antigo campo `also` remendava à mão em cinco lugares.
    for (const r of ROTAS) {
      if (!r.tambem) continue;
      expect(r.tambem, `${r.href} não se inclui em tambem`).toContain(r.href);
    }
  });

  it("não repete rótulo dentro da mesma seção", () => {
    for (const s of MAPA) {
      const rotulos = s.rotas.map((r) => r.rotulo);
      expect(new Set(rotulos).size, `seção ${s.titulo}`).toBe(rotulos.length);
    }
  });

  it("a rota herda o escopo declarado pela sua seção", () => {
    // O escopo é o que promete ao usuário se a tela obedece ao seletor de
    // documentação. A Importar dizia `espaco` e resolvia com
    // `getDefaultSpace()` — importava para a documentação mais antiga do banco.
    for (const s of MAPA) {
      for (const r of s.rotas) expect(r.escopo, `${r.href}`).toBe(s.escopo);
    }
  });
});

describe("mapa de rotas — abas", () => {
  it("não repete key dentro da mesma rota", () => {
    for (const r of ROTAS) {
      const keys = (r.abas ?? []).map((a) => a.key);
      expect(new Set(keys).size, `${r.href}`).toBe(keys.length);
    }
  });

  it("uma rota com abas declara pelo menos duas", () => {
    // Uma aba só não é escolha, é ruído — e `AbasRota` nem renderiza a barra.
    for (const r of ROTAS) {
      if (!r.abas) continue;
      expect(r.abas.length, `${r.href}`).toBeGreaterThan(1);
    }
  });

  it("aba com href aponta para uma rota que existe no mapa", () => {
    // Uma aba cross-rota apontando para lugar nenhum é o beco que esta rodada
    // veio fechar.
    for (const r of ROTAS) {
      for (const a of r.abas ?? []) {
        if (!a.href) continue;
        const caminho = a.href.split("?")[0]!;
        const alcancavel = ROTAS.some(
          (outra) => outra.href === caminho || (outra.tambem ?? []).includes(caminho),
        );
        expect(alcancavel, `${r.href} › ${a.rotulo} → ${caminho}`).toBe(true);
      }
    }
  });

  it("aba que usa {space} só aparece em rota de escopo `espaco`", () => {
    // `{space}` sem documentação em jogo vira `?space=` vazio — um link para a
    // documentação errada, que é exatamente o defeito da Importar.
    for (const r of ROTAS) {
      for (const a of r.abas ?? []) {
        if (!a.href?.includes("{space}")) continue;
        expect(r.escopo, `${r.href} › ${a.rotulo}`).toBe("espaco");
      }
    }
  });

  it("abas do mesmo grupo ficam contíguas", () => {
    // O separador da barra é desenhado quando o grupo MUDA de uma aba para a
    // seguinte. Com um grupo interrompido — cliente, capacidade, cliente — a
    // barra ganha um separador a mais e passa a mentir sobre o agrupamento.
    for (const r of ROTAS) {
      const grupos = (r.abas ?? []).map((a) => a.grupo).filter(Boolean);
      if (grupos.length < 2) continue;
      const vistos = new Set<string>();
      let anterior: string | undefined;
      for (const g of grupos as string[]) {
        if (g !== anterior) {
          expect(vistos.has(g), `${r.href}: grupo "${g}" aparece em dois trechos`).toBe(false);
          vistos.add(g);
          anterior = g;
        }
      }
    }
  });

  it("permissão de aba é uma permissão que o mapa conhece", () => {
    // Pega o erro de digitação que faria a aba sumir para todo mundo em
    // silêncio — falha por permissão é indistinguível de aba inexistente.
    for (const r of ROTAS) {
      for (const a of r.abas ?? []) {
        if (!a.permissao) continue;
        expect(TODAS_AS_PERMISSOES.has(a.permissao), `${r.href} › ${a.rotulo}`).toBe(true);
      }
    }
  });
});

describe("abasDaRota", () => {
  const tudo = TODAS_AS_PERMISSOES;

  it("a primeira aba visível aponta para a rota limpa, sem ?aba=", () => {
    const abas = abasDaRota("/admin/analises", tudo);
    expect(abas[0]!.href).toBe("/admin/analises");
    expect(abas[1]!.href).toBe("/admin/analises?aba=leitura");
  });

  it("some com a aba cuja permissão falta, em vez de mostrá-la desabilitada", () => {
    const semBackup = new Set([...tudo].filter((p) => p !== "system.backup"));
    const keys = abasDaRota("/admin/sistema", semBackup).map((a) => a.key);
    expect(keys).not.toContain("backup");
    expect(keys).toContain("ia");
  });

  it("a primeira VISÍVEL fica limpa, mesmo quando não é a primeira declarada", () => {
    // Quem só tem `embeddings.reindex` abre a Importar direto na segunda aba.
    // Apontar a primeira visível para `?aba=` da aba que ela não vê geraria um
    // link para uma aba que não está na barra.
    const soEmbeddings = new Set(["embeddings.reindex"]);
    const abas = abasDaRota("/admin/importar", soEmbeddings);
    expect(abas).toHaveLength(1);
    expect(abas[0]!.key).toBe("embeddings");
    expect(abas[0]!.href).toBe("/admin/importar");
  });

  it("substitui {space} pela documentação em jogo", () => {
    const abas = abasDaRota("/admin/assistente", tudo, "abc-123");
    const conversas = abas.find((a) => a.key === "atividade")!;
    expect(conversas.href).toBe("/admin/conversas?space=abc-123");
  });

  it("rota sem abas devolve lista vazia, não quebra", () => {
    expect(abasDaRota("/admin/usuarios", tudo)).toEqual([]);
    expect(abasDaRota("/rota/que/nao/existe", tudo)).toEqual([]);
  });
});

describe("rotaAtiva / trilha", () => {
  it("casa pelo prefixo mais longo, não pelo primeiro que bate", () => {
    // `/admin` e `/admin/conteudo` competem por `/admin/conteudo/abc`; sem esta
    // regra, o Painel acendia enquanto a pessoa editava um artigo.
    expect(rotaAtiva("/admin/conteudo/abc")?.rotulo).toBe("Documentações");
    expect(rotaAtiva("/admin")?.rotulo).toBe("Painel");
  });

  it("as três rotas do Assistente acendem o MESMO item do menu", () => {
    // Era o defeito F2: Acessos dividia barra de abas com Conversas mas o mapa
    // a arquivava em Desempenho, então clicar na aba do meio fazia o item aceso
    // pular de seção.
    for (const p of ["/admin/assistente", "/admin/conversas", "/admin/logs", "/admin/ontologia"]) {
      expect(trilha(p)?.rota.rotulo, p).toBe("Assistente de IA");
    }
  });

  it("Acessos acende Desempenho — a mesma seção das outras abas dessa barra", () => {
    for (const p of ["/admin/analises", "/admin/acessos"]) {
      expect(trilha(p)?.rota.rotulo, p).toBe("Desempenho");
    }
  });

  it("toda aba cross-rota acende o MESMO item de menu que a rota dona da barra", () => {
    // O invariante que generaliza os dois testes acima: uma barra de abas nunca
    // deve atravessar duas seções do menu. Se atravessar, a barra lateral passa
    // a discordar da barra de abas — e ela é metade da resposta a "onde estou".
    for (const r of ROTAS) {
      for (const a of r.abas ?? []) {
        if (!a.href) continue;
        const caminho = a.href.split("?")[0]!;
        expect(trilha(caminho)?.rota.href, `${r.rotulo} › ${a.rotulo}`).toBe(r.href);
      }
    }
  });

  it("caminho fora do mapa não inventa trilha", () => {
    expect(trilha("/admin/login")).toBeNull();
    expect(rotaAtiva("/docs/global/qualquer")).toBeNull();
  });
});
