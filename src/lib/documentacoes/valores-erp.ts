import "server-only";
import { loadBaseContext, loadCredentialSecret } from "@/lib/integrations/resolve";
import { executeTool } from "@/lib/integrations/executor";
import { DIMENSOES, type Dimensao } from "@/lib/elegibilidade";
import { dimensaoUI, extrairValoresDaTool, type ListaDeValores } from "./dimensoes-ui";

/**
 * A LISTA DE VALORES DE UMA DIMENSÃO, buscada no ERP do cliente.
 *
 * Saiu de `documentacoes-actions.ts` para cá porque a tela do cliente
 * (`/gestao/conteudo`) faz a MESMA busca com a MESMA credencial, mudando só de
 * onde vem o login. Duplicar significaria duplicar a trava de método GET
 * abaixo, que é a única garantia de que este caminho nunca escreve no ERP de
 * produção de um cliente.
 *
 * ── O login é PARÂMETRO, e isso é a decisão ──────────────────────────────
 * As seis ferramentas de estrutura declaram `usuario` como parâmetro
 * OBRIGATÓRIO de origem `identidade` — é ele que escopa a consulta no ORDS.
 * Medido em 25/09 contra a base natcorp: com identidade vazia, cinco das seis
 * nem saem (`resolveParams` levanta "Parâmetro obrigatório ausente"), e só
 * `estrutura_vinculos_empregaticios` responde, porque a tabela dele é global.
 * Com um login real, as seis respondem 200 (16 empresas, 142 filiais, 2.847
 * centros de custo, 139 unidades, 14 vínculos, 0 sindicatos).
 *
 * Quem decide o login é o CHAMADOR, porque as duas telas têm origens
 * diferentes e nenhuma serve para a outra: na área do cliente é o login do ERP
 * de quem está olhando a tela (`sessao.identidade.usuario`), que é o correto; no
 * admin não há identidade nenhuma e a escolha é uma heurística, documentada lá.
 * Recebendo o login por parâmetro, esta função não tem opinião sobre isso e
 * nenhuma das duas telas herda a decisão da outra.
 */
export async function buscarValoresNoErp(params: {
  /** `base_code` do cliente cujo ERP será consultado. */
  base: string;
  dimensao: Dimensao;
  /** Login do ERP. Sem ele a consulta não sai — quem trata a ausência é o chamador. */
  usuario: string;
}): Promise<ListaDeValores> {
  const { dimensao, usuario } = params;

  // Dimensão fora das doze faria `dimensaoUI` devolver `undefined` e a linha
  // seguinte estourar — a lista é de tamanho fixo e o `find` lá dentro usa `!`.
  if (!(DIMENSOES as readonly string[]).includes(dimensao)) {
    return { ok: false, motivo: `"${String(dimensao)}" não é uma das doze dimensões.` };
  }
  const ui = dimensaoUI(dimensao);
  // `origem` numa const: o `await` mais abaixo faz o TypeScript perder o
  // estreitamento de `ui.origem.tipo`, e sem a const `origem.key` não compila.
  const origem = ui.origem;
  if (origem.tipo !== "tool") {
    return { ok: false, motivo: origem.tipo === "digitacao" ? origem.porque : "Esta dimensão não vem do ERP." };
  }
  const base = params.base.trim();
  if (!base) return { ok: false, motivo: "Escolha um cliente antes de buscar a lista." };

  const ctx = await loadBaseContext(base.toLowerCase());
  const bt = ctx?.tools.find((t) => t.tool.key === origem.key);
  if (!bt?.baseUrl) {
    return {
      ok: false,
      motivo:
        `A ferramenta ${origem.key} não está ativa na base ${base}. Libere-a em ` +
        `"Acesso por base" ou digite o valor à mão.`,
    };
  }

  /**
   * SÓ LEITURA, e aqui a trava é MAIS necessária que no vizinho que a inspirou.
   *
   * `testarTool` recusa método diferente de GET porque um teste que escreve num
   * ERP de produção cria registro de verdade a cada clique. Esta função tem a
   * mesma consequência e uma superfície pior: ela não espera clique nenhum —
   * dispara sozinha quando alguém liga "Restringir" numa dimensão.
   *
   * As seis ferramentas de estrutura são GET hoje (medido em 25/09), então a
   * checagem não muda nada agora. É exatamente por isso que ela entra: sem a
   * linha, a garantia de que este caminho nunca escreve no ERP do cliente está
   * apoiada no estado atual do cadastro, e uma edição em "APIs / Tools" a
   * derrubaria sem ninguém notar.
   */
  const metodo = String(bt.tool.method ?? "GET").toUpperCase();
  if (metodo !== "GET") {
    return {
      ok: false,
      motivo:
        `A ferramenta ${origem.key} está cadastrada como ${metodo}, e esta tela só consulta ` +
        `lista por GET — buscar valores não pode escrever no ERP do cliente. Digite o valor à mão.`,
    };
  }

  try {
    const cred = bt.credentialId ? await loadCredentialSecret(bt.credentialId) : null;
    const r = await executeTool({
      tool: bt.tool,
      baseUrl: bt.baseUrl,
      credential: cred,
      modelArgs: {},
      identity: { usuario, base } as never,
      timeoutMs: 20_000,
    });
    if (!r.ok) {
      return { ok: false, motivo: `A base ${base} respondeu ${r.status} ao pedir a lista. Digite o valor à mão.` };
    }
    const { valores, total, formatoDesconhecido } = extrairValoresDaTool(origem, r.data);
    return { ok: true, valores, total, usuario, formatoDesconhecido };
  } catch (e) {
    // `resolveParams` levanta quando falta parâmetro obrigatório, e o `fetch`
    // levanta em rede/timeout. A mensagem do motor já diz de onde o parâmetro
    // deveria vir, então repassá-la é melhor que traduzi-la para "falhou".
    return {
      ok: false,
      motivo: `${e instanceof Error ? e.message : "Falha ao consultar o ERP."} Digite o valor à mão.`,
    };
  }
}
