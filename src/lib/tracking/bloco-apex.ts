import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * O BLOCO PL/SQL DO TOKEN DE RASTREIO, LIDO DO ARQUIVO QUE A EQUIPE COLA.
 *
 * ── O problema que isto resolve ───────────────────────────────────────
 * O bloco existia duas vezes: em `apex/token-rastreio.sql`, que é o que a
 * equipe abre e cola no APEX do cliente, e num template literal dentro de
 * `tracking-key-panel.tsx`, que é o que tem o botão de copiar na tela. Em
 * 24/09 o arquivo foi para doze dimensões, com `sid`, `exp` e a cadeia de
 * buffers redimensionada; o da tela ficou em seis campos, `l_json
 * varchar2(2000)` e `l_token varchar2(4000)`.
 *
 * Quem clicasse em copiar levaria para o ERP do cliente a versão velha: sem
 * validade (token copiado da página vale para sempre), sem sessão (o widget
 * não morre com o painel) e sem as seis dimensões novas — e, pela regra de
 * "ausência fecha", conteúdo restrito a filial, centro de custo, unidade ou
 * sindicato não alcançaria ninguém naquele cliente, sem erro em lugar nenhum.
 *
 * Duas versões do mesmo PL/SQL divergindo é o defeito que o projeto da
 * elegibilidade existe para não repetir. Agora há uma fonte: o arquivo.
 *
 * ── Por que ler o .sql em vez de repetir o template na tela ───────────
 * Mesmo raciocínio (e mesmo formato) de `src/lib/gestao/instalacao-apex.ts`,
 * que já faz isso com `apex/gestao-iframe.sql`: o arquivo é a fonte, e esta
 * função só preenche as constantes do topo. O `Dockerfile` copia `apex/` para
 * a imagem por causa daquele, e agora também por causa deste.
 *
 * A tela é componente de cliente, então o `readFile` mora aqui e a página
 * (server component) passa o texto por prop — igual ao caminho da gestão, em
 * que o servidor lê e a ação devolve o bloco pronto.
 */

const ARQUIVO = "apex/token-rastreio.sql";

/**
 * O que entra no lugar da chave: a tela mostra a chave REAL do espaço logo
 * acima, com botão de copiar, e o passo 1 manda colar aqui. Mandar a chave já
 * preenchida no bloco a poria no HTML de toda abertura da tela.
 */
const CHAVE_PLACEHOLDER = "COLE_A_CHAVE_BASE64_DO_PAINEL";
const WIDGET_PLACEHOLDER = "pk_live_SUA_CHAVE";

/**
 * O slug da documentação é escolhido na tela (o seletor de espaço é estado do
 * cliente), então o servidor não sabe qual é: ele deixa um marcador e quem
 * troca é o componente, com o marcador que vem junto no mesmo objeto — nunca
 * uma segunda cópia da constante em dois arquivos.
 */
export const MARCADOR_SLUG = "__SLUG_DA_DOCUMENTACAO__";

export type BlocoApex = { texto: string; marcadorSlug: string };

/** Troca o valor entre aspas de uma constante do bloco, preservando o resto. */
function preencher(sql: string, nome: string, valor: string): string {
  const re = new RegExp(`^(\\s*${nome}\\s+constant[^:]*:=\\s*)'[^']*'`, "m");
  return sql.replace(re, `$1'${valor.replace(/'/g, "''")}'`);
}

/**
 * Devolve o bloco pronto para a tela, ou `null` quando o modelo não está no
 * servidor.
 *
 * `null` e não um bloco pela metade: um PL/SQL com a chave de outro painel
 * dentro seria colado assim mesmo, e a falha apareceria só para o usuário
 * final do cliente.
 *
 * `site` é o que vai em `c_site`. Caminho RELATIVO quando a URL tem prefixo
 * (`/natcorp/ia`), porque é o que resolve a classe de defeito do `www`
 * documentada no próprio arquivo; URL inteira quando não tem (localhost em
 * desenvolvimento, que é o caso que o arquivo cita como exceção).
 */
export async function blocoTokenRastreio(siteUrl: string): Promise<BlocoApex | null> {
  let sql: string;
  try {
    sql = await readFile(path.join(process.cwd(), ARQUIVO), "utf8");
  } catch {
    return null;
  }

  let site = siteUrl;
  try {
    const caminho = new URL(siteUrl).pathname.replace(/\/+$/, "");
    if (caminho) site = caminho;
  } catch {
    // URL malformada: fica o valor como veio, que é melhor que caminho vazio.
  }

  let texto = preencher(sql, "c_key", CHAVE_PLACEHOLDER);
  texto = preencher(texto, "c_widget", WIDGET_PLACEHOLDER);
  texto = preencher(texto, "c_slug", MARCADOR_SLUG);
  texto = preencher(texto, "c_site", site);

  /**
   * PROVA de que o preenchimento pegou, e ela não é cerimônia: o arquivo do
   * repositório carrega a chave REAL do Painel do Operador da Natcorp em
   * `c_key`. Se o modelo mudar de forma e o regex não casar, o que a tela
   * mostraria é essa chave, para qualquer admin com `widget.manage`. Melhor
   * não mostrar bloco nenhum.
   */
  if (!texto.includes(CHAVE_PLACEHOLDER) || !texto.includes(MARCADOR_SLUG)) return null;

  return { texto, marcadorSlug: MARCADOR_SLUG };
}
