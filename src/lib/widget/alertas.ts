/**
 * OS ALERTAS DE CAMPANHA: A ENTREGA AO WIDGET E O REGISTRO DA VISUALIZAÇÃO.
 *
 * Duas funções do banco, e as duas moram aqui porque são o MESMO predicado visto
 * de dois lados: `public.alertas_para` entrega os alertas ativos e elegíveis, e
 * `public.registrar_visualizacao` grava o fato usando `alertas_para` como portão.
 * Separá-las em dois arquivos convidaria alguém a escrever no segundo uma cerca
 * que o primeiro já tem.
 *
 * ── O CORTE É EM SQL. AQUI NÃO SE DECIDE ELEGIBILIDADE ────────────────────────
 * Base, janela de publicação e `public.elegivel` sobre a `regra jsonb` são
 * resolvidos dentro das funções do banco. Nada neste arquivo filtra por base,
 * compara data ou avalia regra: seria uma segunda implementação a divergir da
 * primeira, e `widget.js` é público de todo jeito.
 *
 * ── POR QUE A CÓPIA É CAMPO A CAMPO, E NUNCA UM SPREAD ────────────────────────
 * A resposta de `/api/v1/config` chega ao navegador de qualquer visitante. A
 * `regra` de uma campanha é configuração interna do cliente: ela diz quais
 * centros de custo, quais filiais e quais sindicatos existem do outro lado da
 * cerca. A migration de campanhas tem uma assertiva que quebra se alguém
 * acrescentar `regra` ao retorno de `alertas_para`.
 *
 * `alertasDoWidget` é a segunda cerca, e existe porque a primeira é do banco:
 * `{...linha}` aqui publicaria qualquer coluna nova no dia em que ela nascesse, e
 * a assertiva do banco não tem como saber que o TypeScript repassou. Listar os
 * quatro campos à mão é o que faz uma coluna nova ser INVISÍVEL até alguém
 * decidir, aqui, que ela pode ser pública.
 *
 * ── `SupabaseClient` SEM `<Database>`, e o motivo ─────────────────────────────
 * `src/lib/database.types.ts` é gerado do banco e ainda não conhece estas duas
 * funções (nem outras recentes, como `escopo_documentacao` e `documentos_da_base`,
 * que `src/lib/ai/escopo-da-base.ts` chama do mesmo jeito). Receber o cliente
 * como parâmetro sem o parâmetro de tipo é o padrão que este repositório já usa
 * para RPC mais nova que o arquivo de tipos — e mantém o `createAdminClient()`
 * tipado nas rotas, que continuam usando o cliente tipado para todo o resto.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { identidadeDoRastreio } from "@/lib/elegibilidade";
import type { TrackFields } from "@/lib/tracking/resolve";

/** O alerta como o widget o recebe. Quatro campos, e só estes quatro. */
export type AlertaDoWidget = {
  id: string;
  titulo: string;
  corpo: string;
  /** ISO-8601. Só para o widget poder exibir; a ordem já vem do banco. */
  publicarEm: string;
};

/** Texto de coluna `text` do Postgres, aparado. Nulo e ausente viram vazio. */
function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Molda as linhas de `alertas_para` no que sai na resposta pública.
 *
 * Três descartes, e cada um cobre um estado que o banco não deveria produzir mas
 * que não custa nada barrar aqui:
 *
 * · o que não é lista (RPC com erro devolve `null`) vira lista vazia, porque a
 *   abertura do widget não pode quebrar por causa de um alerta — a bolha sem
 *   alerta é o comportamento de sempre, a bolha que não monta é regressão;
 * · linha sem `id` é descartada: o id é o que o widget devolve em
 *   `/api/v1/alertas/visto`, e sem ele a visualização não tem onde ser gravada;
 * · linha com `titulo` em branco é descartada: seria uma primeira mensagem vazia
 *   no chat. O CHECK `ai_campanhas_titulo_nao_branco` já impede que ela exista,
 *   então este ramo só dispara se aquele CHECK for removido.
 *
 * `corpo` em branco NÃO descarta: título sozinho é um aviso legítimo ("Folha
 * fechada em 25/09"), e a coluna tem `default ''`.
 */
export function alertasDoWidget(linhas: unknown): AlertaDoWidget[] {
  if (!Array.isArray(linhas)) return [];
  const out: AlertaDoWidget[] = [];
  for (const bruto of linhas) {
    if (!bruto || typeof bruto !== "object") continue;
    const linha = bruto as Record<string, unknown>;
    const id = texto(linha.id);
    const titulo = texto(linha.titulo);
    if (!id || !titulo) continue;
    out.push({
      id,
      titulo,
      corpo: typeof linha.corpo === "string" ? linha.corpo : "",
      publicarEm: texto(linha.publicar_em),
    });
  }
  return out;
}

/**
 * Os alertas que ESTA identidade recebe nesta base, já descontados os que ela
 * não deve ver de novo (`ai_campanhas.repetir = false` mais visualização
 * gravada). Esse desconto é do BANCO, e é por isso que `AlertaDoWidget` não tem
 * campo de repetição: o navegador não decide, ele só não recebe.
 *
 * Nunca lança e nunca derruba a abertura do widget: erro de banco, base ausente
 * ou resposta fora de forma devolvem lista vazia. Mesmo critério de
 * `titulos_de_partida` no bootstrap — widget sem alerta é o comportamento de
 * sempre; widget que não monta por causa de um alerta é regressão.
 */
export async function alertasDaIdentidade(
  db: SupabaseClient,
  track: TrackFields,
): Promise<AlertaDoWidget[]> {
  const base = String(track.p_base ?? "").trim();
  // Sem base no token não há cliente a quem o alerta pertença. `alertas_para`
  // devolveria zero linhas de todo jeito (`bases_do_codigo` não casa nada e
  // ausência fecha); o curto-circuito só evita a ida ao banco.
  if (!base) return [];
  try {
    const { data } = await db.rpc("alertas_para", {
      p_base: base,
      // A identidade só é montada por `identidadeDoRastreio`, nunca à mão: é ela
      // que traduz os `p_*` do rastreio nas chaves das doze dimensões que
      // `public.elegivel` espera.
      p_identidade: identidadeDoRastreio(track),
    });
    return alertasDoWidget(data);
  } catch {
    return [];
  }
}

/**
 * O resultado de registrar uma visualização, com os dois casos SEPARADOS.
 *
 * `registrado: false` é resposta normal do portão (id inventado, campanha de
 * outro cliente, campanha desligada, janela encerrada entre a abertura e a
 * leitura, ou campanha que não repete cuja visualização desta MESMA pessoa já
 * está gravada — a corrida de duas abas) e é assunto encerrado: o widget não
 * deve reenviar.
 * `erro: true` é falha de banco, e aí reenviar na próxima abertura é o certo.
 * Colapsar os dois num booleano faria o widget insistir para sempre numa
 * campanha que nunca vai ser dele, ou desistir de uma que era.
 */
export type ResultadoVisualizacao = { registrado: boolean; erro: boolean };

/**
 * Grava que esta identidade visualizou este alerta.
 *
 * `campanhaId` vem do CORPO da requisição, ou seja é controlado por quem chama.
 * O portão é `public.registrar_visualizacao`, que só grava quando a campanha
 * está entre as que `alertas_para` devolveria para AQUELA base e AQUELA
 * identidade — um predicado num lugar só. Nada aqui confere base nem janela.
 */
export async function registrarVisualizacao(
  db: SupabaseClient,
  campanhaId: string,
  track: TrackFields,
): Promise<ResultadoVisualizacao> {
  const base = String(track.p_base ?? "").trim();
  // Ver `alertasDaIdentidade`: sem base o portão recusaria de todo jeito, e a
  // resposta é a MESMA da recusa — distinguir aqui não conta nada que o cliente
  // já não saiba, mas economiza a ida ao banco.
  if (!base) return { registrado: false, erro: false };
  try {
    const { data, error } = await db.rpc("registrar_visualizacao", {
      p_campanha: campanhaId,
      p_base: base,
      p_identidade: identidadeDoRastreio(track),
    });
    if (error) return { registrado: false, erro: true };
    // A repetição da mesma pessoa nunca grava de novo. Se a campanha repete, ela
    // devolve `true` (continua entregável); se não repete, devolve `false`, porque
    // aí o portão já não a entrega a quem a viu. Os dois são assunto encerrado
    // para o widget — o que faria ele reenviar é `erro`.
    return { registrado: data === true, erro: false };
  } catch {
    return { registrado: false, erro: true };
  }
}
