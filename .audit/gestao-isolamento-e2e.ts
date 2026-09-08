/**
 * Prova de ISOLAMENTO ENTRE BASES na área de gestão, contra o banco real.
 *
 * A pergunta que este script responde: um cliente que tem a chave DELE consegue
 * emitir um token dizendo ser outro cliente e ler os dados do outro?
 *
 * É o cenário concreto do bloco `apex/token-rastreio.sql`: o `c_key` está em
 * texto puro numa região PL/SQL dentro do APEX de cada cliente, então assumir
 * que ninguém do lado de lá o lê seria ingenuidade.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx --env-file=.env .audit/gestao-isolamento-e2e.ts
 *
 * Usa duas bases *-dev, sem tráfego. Não escreve nada — só lê chaves e valida
 * tokens montados em memória.
 */
import { createAdminClient } from "../src/lib/supabase/admin";
import { assinarRastreio } from "../src/lib/tracking/token";
import { tryDecryptSecret } from "../src/lib/crypto/secrets";
import { resolverIdentidadeGestao } from "../src/lib/tracking/resolve-base";

const ESPACO = "natcorp";
const BASE_A = "natcorp-dev";
const BASE_B = "stefanini-dev";

const daquiA30min = () => Math.floor(Date.now() / 1000) + 30 * 60;

async function chaveDa(baseCode: string, spaceId: string): Promise<string | null> {
  const db = createAdminClient();
  const { data: base } = await db
    .from("ai_bases")
    .select("id")
    .ilike("base_code", baseCode)
    .maybeSingle();
  if (!base) return null;
  const { data } = await db
    .from("ai_base_tracking_keys")
    .select("key_enc")
    .eq("base_id", base.id)
    .eq("space_id", spaceId)
    .maybeSingle();
  return data?.key_enc ? tryDecryptSecret(data.key_enc) : null;
}

async function main() {
  const db = createAdminClient();
  const { data: espaco } = await db.from("spaces").select("id").eq("slug", ESPACO).maybeSingle();
  if (!espaco) throw new Error(`Espaço ${ESPACO} não encontrado.`);

  const chaveA = await chaveDa(BASE_A, espaco.id);
  const chaveB = await chaveDa(BASE_B, espaco.id);

  if (!chaveA || !chaveB) {
    console.error(
      `Ambas as bases precisam de chave. Gere com:\n` +
        `  npx tsx --env-file=.env scripts/gerar-chave-gestao.ts ${!chaveA ? BASE_A : BASE_B}`,
    );
    process.exit(1);
  }
  if (chaveA === chaveB) {
    console.error("FALHOU: as duas bases têm a MESMA chave — o isolamento não existe.");
    process.exit(1);
  }

  const casos: { nome: string; token: string; espera: "ok" | "recusa" }[] = [
    {
      nome: `token legítimo de ${BASE_A}`,
      token: assinarRastreio(chaveA, {
        p_base: BASE_A,
        p_usuario: "TESTE",
        p_perfil: "MASTER",
        p_portal: "PO",
        exp: daquiA30min(),
      }),
      espera: "ok",
    },
    {
      nome: `FORJADO: chave de ${BASE_A}, payload dizendo ${BASE_B}`,
      token: assinarRastreio(chaveA, {
        p_base: BASE_B,
        p_usuario: "TESTE",
        p_perfil: "MASTER",
        p_portal: "PO",
        exp: daquiA30min(),
      }),
      espera: "recusa",
    },
    {
      nome: `FORJADO: chave de ${BASE_B}, payload dizendo ${BASE_A}`,
      token: assinarRastreio(chaveB, {
        p_base: BASE_A,
        p_usuario: "TESTE",
        p_perfil: "MASTER",
        p_portal: "PO",
        exp: daquiA30min(),
      }),
      espera: "recusa",
    },
    {
      nome: `token de ${BASE_A} EXPIRADO`,
      token: assinarRastreio(chaveA, {
        p_base: BASE_A,
        p_usuario: "TESTE",
        p_portal: "PO",
        exp: Math.floor(Date.now() / 1000) - 60,
      }),
      espera: "recusa",
    },
    {
      nome: `token de ${BASE_A} no painel do COLABORADOR (PC)`,
      token: assinarRastreio(chaveA, {
        p_base: BASE_A,
        p_usuario: "TESTE",
        p_portal: "PC",
        exp: daquiA30min(),
      }),
      espera: "recusa",
    },
    {
      nome: "payload adulterado (assinatura não confere)",
      token: (() => {
        const t = assinarRastreio(chaveA, {
          p_base: BASE_A,
          p_usuario: "TESTE",
          p_portal: "PO",
          exp: daquiA30min(),
        });
        const [pref, payload, mac] = t.split(".");
        const json = JSON.parse(Buffer.from(payload!, "base64url").toString("utf8"));
        json.p_usuario = "OUTRO";
        const novo = Buffer.from(JSON.stringify(json), "utf8").toString("base64url");
        return `${pref}.${novo}.${mac}`;
      })(),
      espera: "recusa",
    },
  ];

  console.log(`\nEspaço ${ESPACO} · chaves distintas para ${BASE_A} e ${BASE_B}: sim\n`);

  let falhas = 0;
  for (const c of casos) {
    const r = await resolverIdentidadeGestao(espaco.id, c.token, ["PO"]);
    const passou = c.espera === "ok" ? r.ok : !r.ok;
    if (!passou) falhas++;
    const detalhe = r.ok ? `aceito como base=${r.identidade.baseCode}` : `recusado (${r.motivo})`;
    console.log(`  ${passou ? "OK  " : "FALHA"}  ${c.nome}\n          → ${detalhe}`);
  }

  console.log(`\n  ${falhas === 0 ? "PASSOU — nenhuma base alcança a outra" : `FALHOU em ${falhas} caso(s)`}\n`);
  if (falhas > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
