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
import {
  garantirChaveDaBase,
  ehFalha,
  montarBlocoApex,
  siteDaGestao,
  ESPACO_GESTAO,
} from "../src/lib/tracking/chave-base";

const ESPACO_PADRAO = ESPACO_GESTAO; // Painel do Operador, onde a gestão vive

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

  /**
   * A lógica da chave saiu daqui para `src/lib/tracking/chave-base.ts` quando o
   * admin passou a emitir sozinho no cadastro. Este script continua existindo
   * como resgate — quando a tela não abre —, mas não pode ter implementação
   * própria: duas versões do mesmo segredo divergem sem ninguém perceber.
   */
  const r = await garantirChaveDaBase({ baseId: base.id, espaco: slugEspaco, forcar });
  if (ehFalha(r)) {
    const msg: Record<string, string> = {
      espaco_nao_encontrado: `Espaço "${slugEspaco}" não encontrado em spaces.`,
      indecifravel: "A chave gravada não pôde ser decifrada (APP_ENCRYPTION_KEY mudou?). Use --forcar para emitir outra.",
      falha_ao_gravar: "Falha ao gravar a chave.",
      base_nao_encontrada: `Base "${baseCode}" não encontrada em ai_bases.`,
    };
    console.error(msg[r.erro] ?? r.erro);
    process.exit(1);
  }
  const chave = r.chave;
  const novo = r.novo;
  const existente = r.criadaEm ? { updated_at: r.criadaEm } : null;

  const site = siteDaGestao();

  console.log("");
  console.log(`  Base .......... ${base.base_code}  (${base.name})${base.active ? "" : "  [INATIVA]"}`);
  console.log(`  Espaço ........ ${espaco.slug}  (${espaco.name})`);
  console.log(`  Chave ......... ${novo ? "EMITIDA AGORA" : `já existia (${existente?.updated_at})`}`);
  console.log("");
  console.log("  ── Cole no bloco PL/SQL do APEX desta base ─────────────────");
  console.log("");
  console.log(
    montarBlocoApex({ chave, widgetKey: widget?.public_key ?? null, site })
      .split("\n")
      .map((l) => `  ${l}`)
      .join("\n"),
  );
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
