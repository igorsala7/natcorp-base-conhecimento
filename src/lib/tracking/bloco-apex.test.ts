import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { DIMENSOES, CHAVE_DE_DIMENSAO } from "@/lib/elegibilidade";

/**
 * O ARQUIVO É A FONTE ÚNICA DO BLOCO QUE CHEGA AO ERP DO CLIENTE.
 *
 * A tela (`tracking-key-panel.tsx`) mostra o TEXTO deste arquivo, com as
 * constantes preenchidas por `blocoTokenRastreio`. Antes ela tinha a própria
 * cópia, e as duas divergiram: o arquivo foi para doze dimensões e a da tela
 * ficou em seis, com `l_json varchar2(2000)`. Quem clicasse em copiar levava a
 * versão velha, e o sintoma no cliente não era erro — era conteúdo restrito a
 * centro de custo não alcançando ninguém.
 *
 * Com uma fonte só, o risco deixa de ser divergência e passa a ser o arquivo
 * perder um campo numa edição futura. É isso que este teste vigia. Ele lê o
 * arquivo com `fs` em vez de importar o módulo porque `bloco-apex.ts` é
 * `server-only`.
 */
const SQL = readFileSync("apex/token-rastreio.sql", "utf8");

describe("apex/token-rastreio.sql", () => {
  it("manda as DOZE dimensões de elegibilidade, uma por uma", () => {
    for (const d of DIMENSOES) {
      const chave = CHAVE_DE_DIMENSAO[d];
      expect(SQL, `falta "${chave}" no JSON do bloco`).toContain(`"${chave}":`);
    }
  });

  it("cada dimensão sai de um item do APEX, não de literal", () => {
    // Doze `apex_json.stringify` dos p_* + `sid`. Se alguém trocar um por
    // literal, o token nasce com valor fixo para todo mundo daquele painel.
    const chamadas = SQL.match(/apex_json\.stringify\(/g) ?? [];
    expect(chamadas.length).toBeGreaterThanOrEqual(DIMENSOES.length + 1);
  });

  /**
   * `sid` amarra a sessão do widget à do APEX; `exp` mata o token com a sessão.
   * Sem os dois, um token copiado da página vale para sempre e permite
   * consultar como aquele usuário — inclusive alcançando a conta Microsoft
   * vinculada a ele.
   */
  it("carrega sid e exp", () => {
    expect(SQL).toContain('"sid":');
    expect(SQL).toContain('"exp":');
    expect(SQL).toContain("v('APP_SESSION')");
    // Máscara FM sem grupo: em NLS pt_BR o padrão produziria
    // "exp":1.755.000.000, JSON inválido, e o token seria recusado INTEIRO.
    expect(SQL).toMatch(/to_char\(l_exp,\s*'FM9+'\)/);
  });

  /**
   * A CADEIA INTEIRA dimensionada junta. Subir `l_json` e deixar `l_token` em
   * 4000 fazia o payload passar o primeiro portão e morrer no último, longe da
   * causa: base64 de 6000 bytes já dá 8000 caracteres.
   */
  it("tem a cadeia de buffers dimensionada, sem elo estreito", () => {
    const tamanho = (nome: string) => {
      const m = SQL.match(new RegExp(`${nome}\\s+(?:varchar2|raw)\\((\\d+)\\)`));
      return m ? Number(m[1]) : 0;
    };
    expect(tamanho("l_json")).toBeGreaterThanOrEqual(8000);
    expect(tamanho("l_pay")).toBeGreaterThanOrEqual(2 * tamanho("l_json"));
    expect(tamanho("l_token")).toBeGreaterThanOrEqual(2 * tamanho("l_pay"));
  });

  /** As constantes que `blocoTokenRastreio` preenche precisam existir na forma esperada. */
  it("declara as constantes que a tela preenche", () => {
    for (const nome of ["c_key", "c_widget", "c_slug", "c_site"]) {
      expect(SQL, `falta a constante ${nome}`).toMatch(
        new RegExp(`^\\s*${nome}\\s+constant[^:]*:=\\s*'[^']*'`, "m"),
      );
    }
  });
});
