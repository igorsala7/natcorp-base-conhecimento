/**
 * Cadastra uma base de CLIENTE espelhando a configuração da NATCORP.
 *
 * O que é copiado da NATCORP: as 127 linhas de `ai_base_tools` — quais
 * ferramentas a base tem, habilitadas, e as allowlists de portal/empresa/perfil.
 * Os AGENTES são globais (não têm `base_id`), então nada a clonar ali; os
 * módulos das ferramentas idem.
 *
 * O que NÃO é copiado, de propósito:
 *  · `credential_id` das linhas de ferramenta — apontam para a credencial da
 *    NATCORP. Copiar seria dar a chave de um cliente a outro.
 *  · `session_key` — é por base, e vai na URL de toda consulta. Sem ela a
 *    ferramenta falha com "Parâmetro obrigatório ausente: key". Fica em branco
 *    para ser preenchida em Integrações › Bases / Clientes.
 *
 * Rodar: npm run seed:bases            (simula, não grava)
 *        npm run seed:bases -- --gravar
 */
import ws from "ws";
if (!globalThis.WebSocket) { (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws; }
import { createClient } from "@supabase/supabase-js";
import { encryptSecret, decryptSecret } from "../src/lib/crypto/secrets";

const GRAVAR = process.argv.includes("--gravar");
const MODELO = "natcorp";

type Nova = { code: string; nome: string; url: string; tokenUrl: string; clientId: string | null; clientSecret: string | null };

const BASES: Nova[] = [
  { code: "incor", nome: "INCOR", url: "https://www.natcorpbr.com.br/apex/rh/incor", tokenUrl: "https://www.natcorpbr.com.br/apex/rh/incor/oauth/token", clientId: "MqxIUMHOl_8QfkBU07TCWA..", clientSecret: "p5p7x9_9CC60dsIzGaJEFg.." },
  { code: "redeflex", nome: "REDEFLEX", url: "https://www.natcorpbr.com.br/apex/rh/redeflex", tokenUrl: "https://www.natcorpbr.com.br/apex/rh/redeflex/oauth/token", clientId: "m-65QlUJDBVsc7_pyqHZeg..", clientSecret: "J3ojJu8dvNjyuLQnCdmpIg.." },
  { code: "realfood", nome: "REALFOOD", url: "https://www.natcorpbr.com.br/apex/rh/realfood", tokenUrl: "https://www.natcorpbr.com.br/apex/rh/realfood/oauth/token", clientId: null, clientSecret: null },
  { code: "leadec", nome: "LEADEC", url: "https://www.natcorpbr.com.br/apex/natrh/leadec", tokenUrl: "https://www.natcorpbr.com.br/apex/natrh/leadec/oauth/token", clientId: "yqrL2IyET-QV0rmIyGHVrw..", clientSecret: "dU6Bj_hOm_FOFeay0_LFxQ.." },
  { code: "saude", nome: "SAUDE", url: "https://www.natcorpbr.com.br/apex/hc/saude", tokenUrl: "https://www.natcorpbr.com.br/apex/hc/saude/oauth/token", clientId: "XRrnxfdmZUucLuxBoZrivQ..", clientSecret: "OHopU6pdxnKbaaXxWGic8Q.." },
  { code: "stefanini", nome: "STEFANINI", url: "https://www.natcorpbr.com.br/apex/hcm/stefanini", tokenUrl: "https://www.natcorpbr.com.br/apex/hcm/stefanini/oauth/token", clientId: "pgOm0Imn6IWzePsV2KUxnw..", clientSecret: "BPoXg6RBVYIqUw-csjL13w.." },
];

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

async function main() {
  const { data: modelo } = await db.from("ai_bases").select("id, tool_routing").eq("base_code", MODELO).single();
  if (!modelo) throw new Error("base modelo não encontrada");
  const { data: ferrModelo } = await db
    .from("ai_base_tools")
    .select("tool_id, enabled, portais, empresas, perfis, base_url")
    .eq("base_id", modelo.id);
  console.log(`Modelo ${MODELO}: ${ferrModelo?.length ?? 0} ferramentas · tool_routing=${modelo.tool_routing}`);
  console.log(GRAVAR ? "MODO GRAVAÇÃO\n" : "SIMULAÇÃO (use -- --gravar para valer)\n");

  for (const b of BASES) {
    const { data: existente } = await db.from("ai_bases").select("id, base_url, credential_id, active").eq("base_code", b.code).maybeSingle();
    const semChaves = !b.clientId || !b.clientSecret;
    const acao = existente ? "ATUALIZA" : "CRIA";
    console.log(`── ${b.nome} (${b.code}) — ${acao}${semChaves ? "  [sem chaves → base INATIVA]" : ""}`);
    console.log(`   url: ${b.url}${existente && existente.base_url !== b.url ? `   (era ${existente.base_url})` : ""}`);
    if (!GRAVAR) continue;

    // 1) base — sem chaves nasce INATIVA: base ativa com credencial vazia só
    //    produziria erro para quem perguntasse.
    const { data: base } = await db
      .from("ai_bases")
      .upsert({ base_code: b.code, name: b.nome, base_url: b.url, active: !semChaves, tool_routing: modelo.tool_routing }, { onConflict: "base_code" })
      .select("id")
      .single();
    const baseId = base!.id;

    // 2) credencial + segredo (cifrado com a chave-mestra da aplicação)
    // Reaproveita a credencial OAuth que a base JÁ tem, qualquer que seja o nome.
    // Casar por nome criou uma duplicada na Stefanini ("Stefanini OAuth" ×
    // "STEFANINI OAuth") e a base passou a apontar para a nova, sem session_key —
    // ou seja, uma "atualização" derrubaria uma base que funcionava.
    const { data: jaTem } = await db
      .from("ai_base_credentials")
      .select("id")
      .eq("base_id", baseId)
      .eq("auth_type", "oauth2")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    const { data: cred } = jaTem
      ? await db.from("ai_base_credentials").update({ active: !semChaves }).eq("id", jaTem.id).select("id").single()
      : await db
          .from("ai_base_credentials")
          .insert({ base_id: baseId, name: `${b.nome} OAuth`, auth_type: "oauth2", active: !semChaves })
          .select("id")
          .single();
    // PRESERVA o que já existe. Numa base que já funciona (Stefanini), sobrescrever
    // o segredo inteiro apagaria o `session_key` — e derrubaria todas as consultas
    // dela por causa de uma "atualização" de client_id que talvez nem mudou.
    const { data: atual } = await db.from("ai_base_credential_secrets").select("secret_enc").eq("credential_id", cred!.id).maybeSingle();
    let anterior: Record<string, string> = {};
    if (atual?.secret_enc) {
      try { anterior = JSON.parse(decryptSecret(atual.secret_enc)) as Record<string, string>; } catch { anterior = {}; }
    }
    const segredo = {
      token_url: b.tokenUrl,
      client_id: b.clientId ?? anterior.client_id ?? "",
      client_secret: b.clientSecret ?? anterior.client_secret ?? "",
      session_key: anterior.session_key ?? "",
    };
    const mudou = (["token_url", "client_id", "client_secret"] as const).filter((k) => (anterior[k] ?? "") !== segredo[k]);
    if (mudou.length) console.log(`   ↻ credencial: ${mudou.join(", ")}`);
    if (segredo.session_key) console.log("   ✓ session_key preservada");
    await db.from("ai_base_credential_secrets").upsert(
      { credential_id: cred!.id, secret_enc: encryptSecret(JSON.stringify(segredo)) },
      { onConflict: "credential_id" },
    );
    await db.from("ai_bases").update({ credential_id: cred!.id }).eq("id", baseId);

    // 3) ferramentas: mesmas da NATCORP, com as MESMAS allowlists.
    //    `credential_id` da linha fica NULO — herda a credencial da base. Copiar
    //    o da NATCORP entregaria a chave de um cliente a outro.
    const linhas = (ferrModelo ?? []).map((f) => ({
      base_id: baseId,
      tool_id: f.tool_id,
      enabled: f.enabled,
      portais: f.portais,
      empresas: f.empresas,
      perfis: f.perfis,
      base_url: f.base_url ? b.url : null,
      credential_id: null,
    }));
    for (let i = 0; i < linhas.length; i += 200) {
      const { error } = await db.from("ai_base_tools").upsert(linhas.slice(i, i + 200), { onConflict: "base_id,tool_id" });
      if (error) throw error;
    }
    console.log(`   ✓ ${linhas.length} ferramentas${segredo.session_key ? "" : " · session_key EM BRANCO"}`);
  }

  console.log(
    GRAVAR
      ? "\n⚠ Falta o SESSION_KEY de cada base (o `key=` da URL). Sem ele toda consulta falha.\n" +
        "  Preencha em Integrações › Bases / Clientes › editar a credencial."
      : "\nNada gravado.",
  );
}
main().catch((e) => { console.error("Falhou:", e.message); process.exit(1); });
