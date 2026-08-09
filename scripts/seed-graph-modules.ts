/**
 * Tags de MÓDULO das ferramentas Microsoft.
 *
 *   npm run seed:graph:modulos                # simula
 *   npm run seed:graph:modulos -- --aplicar
 *
 * ── Por que isto é obrigatório, e não enfeite ───────────────────────────
 * O classificador de assunto (`analisarPedido`) monta o vocabulário dele a
 * partir das tags de módulo das ferramentas ATIVAS. Sem tag, o assunto não
 * existe no mundo dele.
 *
 * Observado num turno real: "Quais são as minhas reuniões deste mês?" foi
 * classificado como `precisaDados: false` — documentação/how-to — e o
 * tool-builder cortou TODAS as ferramentas de integração antes de qualquer
 * outro filtro. O agente respondeu que não tem acesso à agenda, com as dez
 * ferramentas Microsoft cadastradas, ativas e com a conta conectada.
 *
 * Os módulos existentes são todos de RH (ADMINISTRAÇÃO DE PESSOAL / …), então
 * "agenda", "e-mail" e "arquivo" não tinham onde se encaixar.
 *
 * `ai_modules` normalmente é preenchida pela sincronização com o menu do APEX
 * (module-sync). Estes três não vêm de lá — são da suíte Microsoft, que não
 * existe no menu do cliente — então entram por cadastro explícito.
 */
// @ts-expect-error — o pacote `pg` não traz tipos próprios.
import pg from "pg";
import { parseDbConfig } from "../src/lib/jobs/db-config";

const BASE_CODE = "natcorp";
const MODULO = "MICROSOFT 365";

/** Submódulo por ferramenta. Separados para o recorte não trazer e-mail quando
 *  a pergunta é de agenda — cada um puxa só o seu. */
const TAGS: Record<string, string> = {
  ms_agenda_periodo: "AGENDA",
  ms_evento_criar: "AGENDA",
  ms_evento_editar: "AGENDA",
  ms_evento_excluir: "AGENDA",
  ms_convite_responder: "AGENDA",
  ms_email_recentes: "E-MAIL",
  ms_email_enviar: "E-MAIL",
  ms_arquivos_recentes: "ARQUIVOS",
  ms_arquivo_buscar: "ARQUIVOS",
  ms_arquivo_compartilhar: "ARQUIVOS",
};

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const c = new pg.Client(parseDbConfig());
  await c.connect();
  console.log(aplicar ? "MODO: GRAVANDO\n" : "MODO: simulação (use --aplicar)\n");
  try {
    for (const sub of [...new Set(Object.values(TAGS))]) {
      if (aplicar) {
        await c.query(
          `insert into ai_modules (base_code, modulo, submodulo, synced_at)
           values ($1,$2,$3, now())
           on conflict do nothing`,
          [BASE_CODE, MODULO, sub],
        );
      }
      console.log(`${aplicar ? "OK  " : "    "}módulo  ${MODULO} > ${sub}`);
    }

    for (const [key, sub] of Object.entries(TAGS)) {
      const { rows } = await c.query(`select id from ai_tools where key = $1`, [key]);
      if (!rows[0]) {
        console.log(`     ${key} — NÃO ENCONTRADA, pulando`);
        continue;
      }
      if (aplicar) {
        // Uma tag por ferramenta: a tool inteira serve a um assunto só. Repetir
        // o seed não duplica.
        await c.query(`delete from ai_tool_modules where tool_id = $1 and modulo = $2`, [rows[0].id, MODULO]);
        await c.query(
          `insert into ai_tool_modules (tool_id, modulo, submodulo) values ($1,$2,$3)`,
          [rows[0].id, MODULO, sub],
        );
      }
      console.log(`${aplicar ? "OK  " : "    "}${key.padEnd(26)} → ${MODULO} > ${sub}`);
    }
  } finally {
    await c.end();
  }
  if (!aplicar) console.log("\nNada gravado. Repita com --aplicar.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
