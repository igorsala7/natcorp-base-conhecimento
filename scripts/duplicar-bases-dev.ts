/**
 * DUPLICA AS BASES DE CLIENTE COMO `-DEV`.
 *
 *   npx tsx --tsconfig worker/tsconfig.json scripts/duplicar-bases-dev.ts            # ENSAIO
 *   npx tsx --tsconfig worker/tsconfig.json scripts/duplicar-bases-dev.ts --aplicar  # escreve
 *
 * Pedido do Igor (18/08): duplicar todas as bases de Conexões, exceto Stefanini,
 * acrescentando "-DEV" ao nome.
 *
 * ── A URL NÃO é copiada, e esse é o ponto mais importante ───────────────────
 * O `stefanini-dev` que já existia mostra o padrão: o segmento do caminho muda
 * de `hcm` para `dev`.
 *
 *     stefanini      .../apex/hcm/stefanini
 *     stefanini-dev  .../apex/dev/stefanini
 *
 * Copiar a `base_url` como está faria a base "-DEV" consultar o APEX de
 * PRODUÇÃO — ambiente de teste lendo folha de pagamento real. Uma base que
 * parece DEV e lê produção é pior que não existir, porque ninguém desconfia
 * dela. Decisão do Igor: trocar para `/apex/dev/<cliente>`.
 *
 * Se algum cliente não tiver APEX em `/dev`, a base fica cadastrada e as
 * chamadas falham — que é o modo de falha certo.
 *
 * ── O que vai junto ─────────────────────────────────────────────────────────
 * Catálogo de tools, espaços, credenciais (com os segredos) e embeddings de
 * roteamento. Base sem tools não faz nada; base sem credencial não autentica.
 *
 * As credenciais são copiadas com o `secret_enc` INTACTO — o valor cifrado é
 * transportado, nunca decifrado aqui. Vale o aviso: se a URL aponta para `/dev`
 * e o segredo é o de produção, a autenticação provavelmente falha. É esperado, e
 * o conserto é trocar o segredo na tela de Conexões.
 *
 * ── Idempotente ─────────────────────────────────────────────────────────────
 * Pula base cujo `-dev` já existe. Rodar duas vezes não duplica nada.
 */

import pg from "pg";
import { config } from "dotenv";

config({ path: ".env" });

const APLICAR = process.argv.includes("--aplicar");

/** Stefanini fica de fora (pedido), e o `-dev` que já existe também. */
const EXCLUIR = new Set(["stefanini", "stefanini-dev"]);

/** `https://…/apex/rh/incor` → `https://…/apex/dev/incor`. */
export function urlDeDev(url: string | null): string | null {
  if (!url) return url;
  // Troca só o segmento IMEDIATAMENTE após `/apex/`, preservando o resto do
  // caminho — há bases com sufixos diferentes e um replace ingênuo os perderia.
  return url.replace(/(\/apex\/)[^/]+(\/|$)/, "$1dev$2");
}

async function main() {
  const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
  await c.connect();
  console.log(`\n${APLICAR ? "APLICANDO" : "ENSAIO (nada será escrito)"}\n`);

  const { rows: bases } = await c.query(
    `select id, base_code, name, base_url from ai_bases order by base_code`,
  );
  const existentes = new Set(bases.map((b) => String(b.base_code).toLowerCase()));

  const alvos = bases.filter((b) => {
    const code = String(b.base_code).toLowerCase();
    if (EXCLUIR.has(code)) return false;
    if (code.endsWith("-dev")) return false;
    return !existentes.has(`${code}-dev`);
  });

  const pulados = bases.filter((b) => !alvos.includes(b)).map((b) => b.base_code);
  console.log(`  ${alvos.length} a duplicar · ${pulados.length} fora: ${pulados.join(", ")}\n`);

  for (const b of alvos) {
    const novoCode = `${String(b.base_code).toLowerCase()}-dev`;
    const novoNome = `${b.name}-DEV`;
    const novaUrl = urlDeDev(b.base_url);
    const { rows: [v] } = await c.query(
      `select (select count(*) from ai_base_tools where base_id=$1) tools,
              (select count(*) from ai_base_spaces where base_id=$1) spaces,
              (select count(*) from ai_base_credentials where base_id=$1) creds,
              (select count(*) from ai_tool_base_embeddings where base_id=$1) emb`,
      [b.id],
    );
    console.log(`  ${b.base_code} → ${novoCode}  (${novoNome})`);
    console.log(`      url: ${b.base_url}`);
    console.log(`         → ${novaUrl}`);
    console.log(`      leva: ${v.tools} tools · ${v.spaces} espaços · ${v.creds} credenciais · ${v.emb} embeddings`);
  }

  if (!APLICAR) {
    console.log("\nEnsaio. Rode com --aplicar para escrever.\n");
    await c.end();
    return;
  }

  // Tudo ou nada: uma base criada sem tools ou sem credencial fica pela metade,
  // e ninguém consegue dizer olhando a tela se ela está completa.
  await c.query("begin");
  try {
    for (const b of alvos) {
      const novoCode = `${String(b.base_code).toLowerCase()}-dev`;
      const { rows: [nova] } = await c.query(
        `insert into ai_bases
           (base_code, name, active, base_url, flow_layout, perfis_endpoint, perfis_campo,
            tool_routing, widget_paineis, apps_schema)
         select $2, name || '-DEV', true, $3, flow_layout, perfis_endpoint, perfis_campo,
                tool_routing, widget_paineis, apps_schema
           from ai_bases where id = $1
         returning id`,
        [b.id, novoCode, urlDeDev(b.base_url)],
      );

      await c.query(
        `insert into ai_base_tools (base_id, tool_id)
         select $2, tool_id from ai_base_tools where base_id = $1
         on conflict do nothing`,
        [b.id, nova.id],
      );
      await c.query(
        `insert into ai_base_spaces (base_id, space_id)
         select $2, space_id from ai_base_spaces where base_id = $1
         on conflict do nothing`,
        [b.id, nova.id],
      );

      /**
       * Credencial + segredo, em duas etapas ligadas pelo id NOVO.
       *
       * O `secret_enc` viaja cifrado — este script nunca decifra nada. E o
       * `credential_id` da base nova aponta para a credencial nova, não para a
       * da origem: compartilhar levaria uma edição em DEV a mexer em produção.
       */
      const { rows: creds } = await c.query(
        `select id, name, auth_type, active, provider, is_global
           from ai_base_credentials where base_id = $1`,
        [b.id],
      );
      let primeiraNova: string | null = null;
      for (const cr of creds) {
        /**
         * A CÓPIA NUNCA é global. O banco tem:
         *
         *   UNIQUE (provider) WHERE (is_global AND auth_type='oauth2_user' AND active)
         *
         * Só existe UMA credencial SSO global por provedor, e ela é do sistema
         * inteiro. Copiar a do `natcorp` como global criava a segunda e o insert
         * era recusado — a restrição estava certa, e a primeira versão deste
         * script é que não conhecia a regra.
         *
         * O `stefanini-dev`, feito à mão antes, resolveu do mesmo jeito: mantém a
         * credencial "Microsoft Azure Entra ID SSO" com `is_global = false`.
         */
        const { rows: [nc] } = await c.query(
          `insert into ai_base_credentials (base_id, name, auth_type, active, provider, is_global)
           values ($1, $2, $3, $4, $5, false) returning id`,
          [nova.id, cr.name, cr.auth_type, cr.active, cr.provider],
        );
        await c.query(
          `insert into ai_base_credential_secrets (credential_id, secret_enc)
           select $2, secret_enc from ai_base_credential_secrets where credential_id = $1`,
          [cr.id, nc.id],
        );
        primeiraNova = primeiraNova ?? nc.id;
      }
      // `credential_id` da BASE: só se a origem tinha uma apontada.
      const { rows: [orig] } = await c.query(`select credential_id from ai_bases where id=$1`, [b.id]);
      if (orig?.credential_id && primeiraNova) {
        await c.query(`update ai_bases set credential_id = $2 where id = $1`, [nova.id, primeiraNova]);
      }

      /**
       * Embeddings com TODAS as colunas obrigatórias.
       *
       * `fonte_hash` e `termos_ontologia` são NOT NULL e fazem parte do vetor:
       * o hash diz de que texto ele foi gerado (é o que permite invalidar quando
       * a descrição da tool muda) e os termos são os sinônimos do cliente que
       * enriqueceram a busca. Copiar só o `embedding` deixaria o vetor sem saber
       * de onde veio — e a primeira regeneração o descartaria por não casar hash.
       */
      await c.query(
        `insert into ai_tool_base_embeddings (base_id, tool_id, embedding, fonte_hash, termos_ontologia, updated_at)
         select $2, tool_id, embedding, fonte_hash, termos_ontologia, updated_at
           from ai_tool_base_embeddings where base_id = $1
         on conflict do nothing`,
        [b.id, nova.id],
      );
      console.log(`  ✓ ${novoCode}`);
    }
    await c.query("commit");
    console.log(`\n  ${alvos.length} bases criadas.\n`);
  } catch (e) {
    await c.query("rollback");
    console.error("\n  REVERTIDO:", e instanceof Error ? e.message : e, "\n");
    process.exitCode = 1;
  }
  await c.end();
}

void main();
