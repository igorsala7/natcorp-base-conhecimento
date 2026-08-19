/**
 * O PARÂMETRO DO LOOP PODE VIR VAZIO — QUANDO A API ACEITA.
 *
 * "Quais colaboradores marcaram ponto hoje?" O modelo fez a coisa certa:
 *
 *   consultar_marcacoes({ empresa: 700, data_ini: …, data_fim: …, matricula: [] })
 *   → ERRO: "Informe ao menos um valor em matricula."
 *
 * Uma chamada, filtro de matrícula vazio, período informado — exatamente o que
 * a API aceita para devolver todo mundo. O servidor recusou porque o parâmetro
 * do loop está marcado `obrigatorio`, e aí o modelo caiu para o caminho caro:
 * buscar os 10.145 colaboradores da empresa e iterar. Três turnos assim
 * custaram 141k, 242k e 193k tokens (19/08/2026).
 *
 * O código já faz o certo quando o parâmetro é opcional (`tool-builder.ts`):
 *
 *   if (valores.length === 0) {
 *     if (pLoop?.obrigatorio) return { erro: "Informe ao menos um valor…" };
 *     return await runOnce(modelArgs, 0);   // ← uma chamada, sem o filtro
 *   }
 *
 * ── Por que uma ferramenta por vez, e não todas ─────────────────────────────
 * Treze das 26 ferramentas com loop bloqueiam lista vazia, e a inconsistência
 * entre elas é real: `informacoes_pessoais_funcionais_resumido` aceita,
 * `consultar_marcacoes` não. Mas virar todas seria perigoso — quem sabe se a
 * API aceita o filtro vazio é quem conhece a API, e algumas são pesadas:
 * `relatorio_recibo_pagamento` sem matrícula é o holerite da empresa inteira,
 * que foi exatamente o incidente de 92 MB.
 *
 * Por isso a chave vem por argumento e o script mostra o que NÃO tocou.
 *
 *   npm run tools:loop-opcional -- consultar_marcacoes
 *   npm run tools:loop-opcional -- consultar_marcacoes --aplicar
 *   npm run tools:loop-opcional                          # lista o estado de todas
 */
import pg from "pg";
import { parseDbConfig } from "../src/lib/jobs/db-config";

const argv = process.argv.slice(2);
const APLICAR = argv.includes("--aplicar");
const CHAVES = argv.filter((a) => !a.startsWith("--"));

type Param = { nome: string; obrigatorio?: boolean; [k: string]: unknown };
type Loop = { unit?: string; param?: string } | null;

async function main() {
  const client = new pg.Client(parseDbConfig());
  await client.connect();
  const { rows } = await client.query<{ id: string; key: string; loop: Loop; params: Param[] | null }>(
    `select id, key, loop, params from ai_tools where loop is not null and active`,
  );

  // Sem chave: só o panorama. É o mapa que diz quais valem a pena revisar.
  if (CHAVES.length === 0) {
    console.log(`\n${rows.length} ferramentas com loop:\n`);
    for (const t of rows) {
      const lp = (t.params ?? []).find((p) => p.nome === t.loop?.param);
      console.log(
        `  ${t.key.padEnd(40)} ${String(t.loop?.unit).padEnd(7)} ${String(t.loop?.param).padEnd(15)} ` +
          (lp?.obrigatorio ? "BLOQUEIA lista vazia" : "aceita lista vazia"),
      );
    }
    console.log(`\nPasse a chave para tornar o parâmetro do loop opcional. Ex.:`);
    console.log(`  npm run tools:loop-opcional -- consultar_marcacoes\n`);
    console.log(`ATENÇÃO: só faça isso quando a API ACEITAR o filtro vazio. Sem filtro,`);
    console.log(`uma consulta de folha devolve a empresa inteira — foi assim que um`);
    console.log(`retorno de 92 MB derrubou um turno.\n`);
    await client.end();
    return;
  }

  let mudou = 0;
  for (const chave of CHAVES) {
    const t = rows.find((x) => x.key === chave);
    if (!t) {
      console.log(`\n${chave}: NÃO encontrada (ou sem loop, ou inativa).`);
      continue;
    }
    const alvo = t.loop?.param;
    const lp = (t.params ?? []).find((p) => p.nome === alvo);
    if (!lp) {
      console.log(`\n${chave}: o parâmetro do loop ("${alvo}") não existe em params.`);
      continue;
    }
    if (!lp.obrigatorio) {
      console.log(`\n${chave}: "${alvo}" já é opcional — nada a fazer.`);
      continue;
    }
    console.log(`\n${chave}`);
    console.log(`  loop: ${t.loop?.unit} sobre "${alvo}"`);
    console.log(`  ${alvo}: obrigatorio true → false`);
    console.log(`  efeito: lista vazia passa a fazer UMA chamada sem esse filtro`);
    if (APLICAR) {
      const novos = (t.params ?? []).map((p) => (p.nome === alvo ? { ...p, obrigatorio: false } : p));
      await client.query(`update ai_tools set params = $1::jsonb where id = $2`, [JSON.stringify(novos), t.id]);
      mudou++;
    }
  }

  console.log(APLICAR ? `\nGRAVADO em ${mudou} ferramenta(s).\n` : `\nSimulação. Rode com --aplicar para gravar.\n`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
