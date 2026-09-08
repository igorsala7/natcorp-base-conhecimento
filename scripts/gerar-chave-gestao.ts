/**
 * Gera (ou mostra) a chave de rastreio de UMA base, para a área de gestão.
 *
 *   npx tsx --env-file=.env scripts/gerar-chave-gestao.ts <base_code> [--espaco <slug>] [--forcar]
 *
 * ── Por que uma chave por base ─────────────────────────────────────────
 *
 * A chave que o widget usa hoje (`space_tracking_keys`) é UMA por espaço, e os
 * três espaços com chave estão ligados às mesmas 14 bases. Ela vive em texto
 * puro na constante `c_key` do bloco PL/SQL dentro do APEX de cada cliente —
 * então quem administra o APEX de um cliente pode assinar um token dizendo ser
 * outro. No widget isso é contido pelas credenciais do ERP alheio; na área de
 * gestão não haveria anteparo nenhum.
 *
 * Este script emite a chave EXCLUSIVA de uma base. O valor impresso vai na
 * constante `c_key` do bloco daquele cliente — e só daquele.
 *
 * Sem `--forcar`, uma base que já tem chave NÃO é sobrescrita: trocar a chave
 * derruba a área de gestão daquele cliente até o APEX dele ser atualizado.
 */
import { createAdminClient } from "../src/lib/supabase/admin";
import { gerarChaveRastreio } from "../src/lib/tracking/token";
import { encryptSecret, tryDecryptSecret } from "../src/lib/crypto/secrets";

const ESPACO_PADRAO = "natcorp"; // Painel do Operador, onde a gestão vive

async function main() {
  const args = process.argv.slice(2);
  const baseCode = args.find((a) => !a.startsWith("--"));
  const forcar = args.includes("--forcar");
  const iEspaco = args.indexOf("--espaco");
  // `--espaco` sem valor cairia em `undefined` e viraria uma busca por espaço
  // nenhum — o default cobre isso em vez de estourar lá na frente.
  const slugEspaco = (iEspaco >= 0 ? args[iEspaco + 1] : undefined) ?? ESPACO_PADRAO;

  if (!baseCode) {
    console.error("Uso: npx tsx --env-file=.env scripts/gerar-chave-gestao.ts <base_code> [--espaco <slug>] [--forcar]");
    process.exit(1);
  }

  const db = createAdminClient();

  const { data: base } = await db
    .from("ai_bases")
    .select("id, base_code, name, active")
    .ilike("base_code", baseCode.trim().replace(/([\\%_])/g, "\\$1"))
    .maybeSingle();
  if (!base) {
    console.error(`Base "${baseCode}" não encontrada em ai_bases.`);
    process.exit(1);
  }

  const { data: espaco } = await db
    .from("spaces")
    .select("id, slug, name")
    .eq("slug", slugEspaco)
    .maybeSingle();
  if (!espaco) {
    console.error(`Espaço "${slugEspaco}" não encontrado em spaces.`);
    process.exit(1);
  }

  const { data: widget } = await db
    .from("widget_keys")
    .select("public_key, active")
    .eq("space_id", espaco.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  const { data: existente } = await db
    .from("ai_base_tracking_keys")
    .select("key_enc, updated_at")
    .eq("base_id", base.id)
    .eq("space_id", espaco.id)
    .maybeSingle();

  let chave: string;
  let novo = false;

  if (existente && !forcar) {
    const decifrada = tryDecryptSecret(existente.key_enc);
    if (!decifrada) {
      console.error("A chave gravada não pôde ser decifrada (APP_ENCRYPTION_KEY mudou?). Use --forcar para emitir outra.");
      process.exit(1);
    }
    chave = decifrada;
  } else {
    chave = gerarChaveRastreio();
    novo = true;
    const { error } = await db.from("ai_base_tracking_keys").upsert(
      {
        base_id: base.id,
        space_id: espaco.id,
        key_enc: encryptSecret(chave),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "base_id,space_id" },
    );
    if (error) {
      console.error(`Falha ao gravar: ${error.message}`);
      process.exit(1);
    }
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "https://SEU-SITE";

  console.log("");
  console.log(`  Base .......... ${base.base_code}  (${base.name})${base.active ? "" : "  [INATIVA]"}`);
  console.log(`  Espaço ........ ${espaco.slug}  (${espaco.name})`);
  console.log(`  Chave ......... ${novo ? "EMITIDA AGORA" : `já existia (${existente?.updated_at})`}`);
  console.log("");
  console.log("  ── Cole no bloco PL/SQL do APEX desta base ─────────────────");
  console.log("");
  console.log(`  c_key    constant varchar2(64)  := '${chave}';`);
  if (widget?.public_key) {
    console.log(`  c_widget constant varchar2(80)  := '${widget.public_key}';`);
  } else {
    console.log("  c_widget constant varchar2(80)  := '<chave pública do widget deste painel>';");
  }
  console.log(`  c_site   constant varchar2(200) := '${site}';`);
  console.log("");
  if (novo && existente) {
    console.log("  ATENÇÃO: a chave anterior foi substituída. A área de gestão desta base");
    console.log("  fica indisponível até o bloco do APEX ser atualizado.");
    console.log("");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
