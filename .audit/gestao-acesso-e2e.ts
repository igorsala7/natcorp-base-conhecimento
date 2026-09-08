/**
 * Prova de ponta a ponta do corte por regra de acesso, contra o banco real.
 *
 * Roda em `natcorp-dev` — base cadastrada e SEM tráfego (zero linhas em
 * `ai_usage`), então nada que aconteça aqui alcança usuário nenhum. Insere a
 * regra, mede, e apaga no `finally`.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx --env-file=.env .audit/gestao-acesso-e2e.ts
 */
import { createAdminClient } from "../src/lib/supabase/admin";
import { montarContextoDeAcesso, invalidarRegrasAcesso } from "../src/lib/integrations/acesso-contexto";
import { loadBaseContext } from "../src/lib/integrations/resolve";

const BASE = "natcorp-dev";
const MODULO_ALVO = "FÉRIAS";

async function main() {
  const db = createAdminClient();
  const ctx = await loadBaseContext(BASE);
  if (!ctx) throw new Error(`Base ${BASE} não encontrada.`);

  const comTag = ctx.tools.filter((t) =>
    t.modules.some((m) => m.modulo.trim().toUpperCase() === MODULO_ALVO),
  );
  console.log(`Base ${BASE}: ${ctx.tools.length} ferramentas habilitadas`);
  console.log(`Com a tag "${MODULO_ALVO}": ${comTag.length}`);
  if (comTag.length === 0) throw new Error("Nenhuma ferramenta com a tag — escolha outro módulo.");

  const identidade = { painel: "PG", perfil: "GESTOR_FINANCEIRO", usuario: "ADIAS" };

  // ── ANTES ────────────────────────────────────────────────────────────
  invalidarRegrasAcesso(BASE);
  const antes = await montarContextoDeAcesso(BASE, identidade);
  const bloqueadasAntes = comTag.filter((t) => antes.permite(t.tool.key, t.modules) !== true);
  console.log(`\nANTES  · regras=${antes.resumo.regras} · bloqueadas=${bloqueadasAntes.length}`);

  let regraId: string | null = null;
  try {
    // ── Insere a regra: bloquear o módulo para o perfil, só no painel PG ──
    const { data, error } = await db
      .from("ai_acesso_regras")
      .insert({
        base_code: BASE,
        painel: "PG",
        alvo_tipo: "perfil",
        alvo: "GESTOR_FINANCEIRO",
        escopo_tipo: "modulo",
        modulo: MODULO_ALVO,
        efeito: "negar",
        observacao: "prova automatizada — removida logo em seguida",
      })
      .select("id")
      .single();
    if (error) throw new Error(`insert falhou: ${error.message}`);
    regraId = data.id;

    // ── DEPOIS ─────────────────────────────────────────────────────────
    invalidarRegrasAcesso(BASE);
    const depois = await montarContextoDeAcesso(BASE, identidade);
    const bloqueadas = comTag.filter((t) => depois.permite(t.tool.key, t.modules) !== true);
    console.log(`DEPOIS · regras=${depois.resumo.regras} · bloqueadas=${bloqueadas.length}`);

    // ── Mesmo perfil, OUTRO painel: a regra tem painel PG, não pode alcançar ──
    const outroPainel = await montarContextoDeAcesso(BASE, { ...identidade, painel: "PO" });
    const bloqueadasPO = comTag.filter((t) => outroPainel.permite(t.tool.key, t.modules) !== true);

    // ── Outro perfil, mesmo painel: a regra é do GESTOR_FINANCEIRO ──────
    const outroPerfil = await montarContextoDeAcesso(BASE, { ...identidade, perfil: "FOLHA" });
    const bloqueadasFolha = comTag.filter((t) => outroPerfil.permite(t.tool.key, t.modules) !== true);

    console.log(`\n── VEREDITO ──────────────────────────────────────────`);
    const ok =
      bloqueadasAntes.length === 0 &&
      bloqueadas.length === comTag.length &&
      bloqueadasPO.length === 0 &&
      bloqueadasFolha.length === 0;
    console.log(`  antes da regra, GESTOR_FINANCEIRO/PG .... ${bloqueadasAntes.length} bloqueada(s)  (esperado 0)`);
    console.log(`  com a regra,   GESTOR_FINANCEIRO/PG .... ${bloqueadas.length} bloqueada(s)  (esperado ${comTag.length})`);
    console.log(`  mesmo perfil no painel PO .............. ${bloqueadasPO.length} bloqueada(s)  (esperado 0)`);
    console.log(`  perfil FOLHA no painel PG ............. ${bloqueadasFolha.length} bloqueada(s)  (esperado 0)`);
    console.log(`\n  ${ok ? "PASSOU" : "FALHOU"}`);
    if (!ok) process.exitCode = 1;
  } finally {
    if (regraId) {
      await db.from("ai_acesso_regras").delete().eq("id", regraId);
      invalidarRegrasAcesso(BASE);
      console.log(`\n[limpeza] regra ${regraId} removida.`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
