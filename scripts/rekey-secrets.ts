/**
 * Re-cifra TODOS os segredos do banco com a chave-mestra atual.
 *
 * Serve a dois problemas distintos, e faz os dois na mesma passada:
 *
 *  1. ROTAÇÃO — a `APP_ENCRYPTION_KEY` vazou (esteve num `.env` versionado em
 *     repositório público). Trocar a env sozinha não basta: o que já está no
 *     banco foi cifrado com a chave velha e passaria a ser ilegível. Este
 *     script lê com a velha (`--de`) e grava com a nova.
 *
 *  2. SEGREDOS EM CLARO — sem a env definida, `encryptSecret` grava com o
 *     prefixo `plain:` de propósito, para o produto rodar em desenvolvimento.
 *     Foi o que aconteceu com boa parte do que está gravado hoje: as chaves de
 *     API dos provedores de IA, as chaves de rastreio e a do Brevo estão
 *     legíveis para quem alcançar o banco. Estas NÃO precisam de `--de`: o
 *     valor está ali, em claro.
 *
 * Uso:
 *   npm run rekey                          # simula, não grava nada
 *   npm run rekey -- --aplicar             # cifra o que está em `plain:`
 *   npm run rekey -- --de <chave_velha> --aplicar   # + rotação
 *
 * A chave de DESTINO é sempre a `APP_ENCRYPTION_KEY` do ambiente — defina a
 * nova antes de rodar com `--aplicar`.
 *
 * ── Segurança de operação ───────────────────────────────────────────────
 * Uma linha que não decifra NUNCA é sobrescrita: o script conta e segue. É a
 * diferença entre "faltou informar a chave velha" e "destruí o segredo". Por
 * isso também a simulação é o padrão, e não a gravação.
 */
// @ts-expect-error — o pacote `pg` (transitivo via pg-boss) não traz tipos próprios.
import pg from "pg";
import { parseDbConfig } from "../src/lib/jobs/db-config";
import { decryptWith, encryptWith, isPlainSecret } from "../src/lib/crypto/secrets";

/**
 * Lista EXPLÍCITA do que é segredo. Varrer o catálogo por nome de coluna
 * (`%_enc`) seria mais curto e pior: uma coluna nova com nome parecido entraria
 * sem ninguém decidir, e este script reescreve dado que não tem cópia.
 */
const ALVOS: { tabela: string; chavePk: string; colunas: string[] }[] = [
  { tabela: "ai_provider_keys", chavePk: "provider_id", colunas: ["api_key_enc"] },
  { tabela: "ai_base_credential_secrets", chavePk: "credential_id", colunas: ["secret_enc"] },
  { tabela: "space_tracking_keys", chavePk: "space_id", colunas: ["key_enc"] },
  { tabela: "email_secrets", chavePk: "id", colunas: ["brevo_api_key_enc", "smtp_pass_enc"] },
  { tabela: "user_connection_tokens", chavePk: "connection_id", colunas: ["refresh_enc", "access_enc"] },
  { tabela: "capture_secrets", chavePk: "job_id", colunas: ["usuario_enc", "senha_enc"] },
  { tabela: "backup_secrets", chavePk: "id", colunas: ["github_token_enc"] },
  { tabela: "infra_settings", chavePk: "id", colunas: ["redis_rest_token_enc"] },
  {
    tabela: "whatsapp_secrets",
    chavePk: "base_code",
    colunas: ["access_token_enc", "app_secret_enc", "verify_token_enc", "identity_secret_enc"],
  },
];

type Contagem = { total: number; claro: number; rotacionado: number; jaOk: number; falhou: number };

function args(): { de: string | null; aplicar: boolean } {
  const a = process.argv.slice(2);
  const i = a.indexOf("--de");
  return { de: i >= 0 ? (a[i + 1] ?? null) : null, aplicar: a.includes("--aplicar") };
}

async function main() {
  const { de, aplicar } = args();
  const destino = process.env.APP_ENCRYPTION_KEY ?? "";
  if (destino.length < 16) {
    console.error("APP_ENCRYPTION_KEY ausente ou curta demais (mínimo 16). É a chave de DESTINO.");
    process.exit(1);
  }
  if (de && de === destino) {
    console.error("A chave de origem é igual à de destino — nada a rotacionar.");
    process.exit(1);
  }

  console.log(aplicar ? "MODO: GRAVANDO\n" : "MODO: simulação (use --aplicar para gravar)\n");
  if (!de) console.log("Sem --de: só os segredos em `plain:` serão cifrados.\n");

  const c = new pg.Client(parseDbConfig());
  await c.connect();
  const totais: Contagem = { total: 0, claro: 0, rotacionado: 0, jaOk: 0, falhou: 0 };

  try {
    for (const alvo of ALVOS) {
      for (const col of alvo.colunas) {
        const cont: Contagem = { total: 0, claro: 0, rotacionado: 0, jaOk: 0, falhou: 0 };
        const { rows } = await c.query(
          `select ${alvo.chavePk} as pk, ${col} as valor from ${alvo.tabela} where ${col} is not null`,
        );

        for (const r of rows) {
          cont.total++;
          const valor = String(r.valor);
          let plano: string | null = null;

          if (isPlainSecret(valor)) {
            plano = valor.slice("plain:".length);
            cont.claro++;
          } else if (de) {
            try {
              plano = decryptWith(valor, de);
              cont.rotacionado++;
            } catch {
              // Chave velha não serve para esta linha. Pode ser que ela já
              // esteja na chave nova (rodou duas vezes) — conferir antes de
              // contar como falha, senão a operação parece quebrada quando na
              // verdade já está pronta.
              try {
                decryptWith(valor, destino);
                cont.jaOk++;
              } catch {
                cont.falhou++;
              }
              continue;
            }
          } else {
            // Sem chave de origem e não está em claro: nada a fazer com esta.
            try {
              decryptWith(valor, destino);
              cont.jaOk++;
            } catch {
              cont.falhou++;
            }
            continue;
          }

          if (aplicar && plano !== null) {
            await c.query(`update ${alvo.tabela} set ${col} = $1 where ${alvo.chavePk} = $2`, [
              encryptWith(plano, destino),
              r.pk,
            ]);
          }
        }

        if (cont.total > 0) {
          const marca = cont.falhou > 0 ? " ← ATENÇÃO" : "";
          console.log(
            `${alvo.tabela}.${col}`.padEnd(46) +
              `total=${cont.total} em_claro=${cont.claro} rotacionadas=${cont.rotacionado} ` +
              `ja_na_chave_nova=${cont.jaOk} nao_decifraram=${cont.falhou}${marca}`,
          );
        }
        for (const k of Object.keys(cont) as (keyof Contagem)[]) totais[k] += cont[k];
      }
    }
  } finally {
    await c.end();
  }

  console.log(
    `\nTOTAL  ${totais.total} segredos · ${totais.claro} estavam em claro · ` +
      `${totais.rotacionado} re-cifrados · ${totais.jaOk} já na chave nova · ${totais.falhou} não decifraram`,
  );
  if (totais.falhou > 0) {
    console.log(
      "\nAs que não decifraram foram PRESERVADAS, não sobrescritas. Confira se a\n" +
        "chave passada em --de é a correta; se for, esses valores precisam ser\n" +
        "recadastrados pela tela.",
    );
  }
  if (!aplicar && (totais.claro > 0 || totais.rotacionado > 0)) {
    console.log("\nNada foi gravado. Repita com --aplicar.");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
