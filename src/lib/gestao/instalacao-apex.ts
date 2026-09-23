import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { tryDecryptSecret } from "@/lib/crypto/secrets";

/**
 * O BLOCO QUE FAZ O CLIENTE CONSEGUIR ENTRAR.
 *
 * ── O problema que isto resolve ───────────────────────────────────────
 * A gestão do cliente NÃO exige login na nossa plataforma — o cliente do
 * cliente não tem conta aqui e nunca vai ter. Quem autoriza é um token
 * assinado que o APEX gera, com a chave daquela base, e que viaja na URL do
 * iFrame. Sem esse bloco instalado no painel dele, não existe porta nenhuma:
 * o link direto cai em "esta página precisa ser aberta de dentro do painel",
 * e a única forma de ver a tela passa a ser o modo suporte — que exige, aí
 * sim, ser admin aqui dentro. Foi exatamente essa a confusão relatada em
 * 23/09: "só consigo acessar se eu estiver conectado como admin".
 *
 * Até aqui, montar o bloco exigia abrir `apex/gestao-iframe.sql`, rodar
 * `npm run gestao:chave:prod -- <base>` num terminal e colar a chave à mão.
 * Três passos, um deles fora do produto, para cada cliente.
 *
 * ── Por que ler o .sql em vez de repetir o template aqui ──────────────
 * `apex/gestao-iframe.sql` é o arquivo que a equipe já abre e cola. Copiar o
 * conteúdo para dentro de um template literal criaria duas versões do mesmo
 * bloco, e a que a tela mostra divergiria da que está no repositório sem
 * ninguém perceber — o tipo de cópia que só se descobre quando o cliente cola
 * a versão velha. O arquivo é a fonte; esta função só preenche as constantes.
 *
 * O `Dockerfile` copia `apex/` para a imagem POR CAUSA disto.
 */

export type ResultadoBloco =
  | { ok: true; bloco: string; chavePublica: string; site: string }
  | { ok: false; erro: string };

const ARQUIVO = "apex/gestao-iframe.sql";

/** Troca o valor entre aspas de uma constante do bloco, preservando o resto. */
function preencher(sql: string, nome: string, valor: string): string {
  const re = new RegExp(`^(\\s*${nome}\\s+constant[^:]*:=\\s*)'[^']*'`, "m");
  return sql.replace(re, `$1'${valor.replace(/'/g, "''")}'`);
}

/**
 * A URL pública do app, SEM `www`.
 *
 * O APEX dos clientes roda em `natcorpbr.com.br`, e `www` é outra ORIGEM para
 * o navegador: com ele o iFrame é recusado ("refused to connect"). Foi o que
 * aconteceu em 16/09. `NEXT_PUBLIC_SITE_URL` continua sendo a canônica (com
 * `www`), porque ela serve a sitemap e e-mail; aqui o que vale é de onde a
 * página vai ser ENQUADRADA.
 */
function siteParaOApex(): string {
  const bruto = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  try {
    const u = new URL(bruto);
    u.host = u.host.replace(/^www\./, "");
    return `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return bruto.replace("://www.", "://").replace(/\/+$/, "");
  }
}

/**
 * Monta o bloco pronto para colar no Painel do Operador daquele cliente.
 *
 * Devolve erro — nunca um bloco pela metade — quando falta chave ou quando a
 * base não tem widget no espaço dela: um bloco com `<COLE AQUI>` dentro seria
 * colado assim mesmo, e a falha apareceria só para o usuário final.
 */
export async function blocoDeInstalacao(baseCode: string): Promise<ResultadoBloco> {
  const codigo = (baseCode ?? "").trim();
  if (!codigo) return { ok: false, erro: "Cliente não informado." };

  const db = createAdminClient();
  const { data: base } = await db
    .from("ai_bases")
    .select("id, base_code")
    .ilike("base_code", codigo.replace(/([\\%_])/g, "\\$1"))
    .maybeSingle();
  if (!base) return { ok: false, erro: "Cliente não encontrado." };

  const { data: chave } = await db
    .from("ai_base_tracking_keys")
    .select("key_enc, space_id")
    .eq("base_id", base.id)
    .maybeSingle();
  if (!chave?.key_enc) {
    return { ok: false, erro: "Este cliente ainda não tem chave de gestão emitida." };
  }

  const segredo = tryDecryptSecret(chave.key_enc);
  if (!segredo) {
    return { ok: false, erro: "A chave deste cliente não pôde ser decifrada. Emita novamente." };
  }

  // A chave PÚBLICA do widget é a do espaço onde a chave de gestão vive — é o
  // mesmo par que o bloco do widget do Painel do Operador já usa.
  const { data: wk } = await db
    .from("widget_keys")
    .select("public_key")
    .eq("space_id", chave.space_id)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!wk?.public_key) {
    return { ok: false, erro: "Não há chave pública de widget ativa para o espaço deste cliente." };
  }

  let sql: string;
  try {
    sql = await readFile(path.join(process.cwd(), ARQUIVO), "utf8");
  } catch {
    return { ok: false, erro: `Modelo ${ARQUIVO} não encontrado no servidor.` };
  }

  const site = siteParaOApex();
  let bloco = preencher(sql, "c_key", segredo);
  bloco = preencher(bloco, "c_widget", wk.public_key);
  if (site) bloco = preencher(bloco, "c_site", site);

  // Garantia de que o preenchimento pegou: se o marcador sobreviveu, o modelo
  // mudou de forma e o regex não casou. Melhor recusar que entregar um bloco
  // que parece pronto e não está.
  if (bloco.includes("<COLE AQUI")) {
    return { ok: false, erro: `O modelo ${ARQUIVO} mudou de forma — o preenchimento não casou.` };
  }

  return { ok: true, bloco, chavePublica: wk.public_key, site };
}
