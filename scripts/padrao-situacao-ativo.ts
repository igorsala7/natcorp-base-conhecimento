/**
 * O PADRÃO DA SITUAÇÃO FUNCIONAL, ESCRITO NA DESCRIÇÃO DO PARÂMETRO.
 *
 * "Quais são os colaboradores do meu centro de custo?" foi consultado com
 * `p_situacao: "T"` e trouxe 40 registros, desligados no meio (19/08/2026).
 * O modelo não errou: a descrição lista os valores — "A - Ativos e Afastados,
 * D - Desligados/Demitidos, T - Todos" — e não diz qual preferir. Diante disso,
 * "Todos" é defensável; traz mais informação, não menos.
 *
 * A regra geral já está na diretiva de uso das integrações (`report-tools.ts`),
 * que vale para toda ferramenta. Isto aqui é o reforço no lugar onde o modelo
 * lê o significado de CADA valor: a regra diz "use ATIVOS", a descrição diz
 * qual letra é essa.
 *
 * ── O que este script NÃO toca ──────────────────────────────────────────────
 * Uma varredura por "situacao" pega três coisas que não são status funcional:
 *
 *   p_dt_situacao_ini / p_dt_situacao_fim  → são DATAS. Mexer aqui poria uma
 *                                            instrução de status num campo de
 *                                            data, e o modelo passaria a mandar
 *                                            "A" onde se espera dd/MM/yyyy.
 *   situacao ("Filtro situacao.")          → valores DESCONHECIDOS. Em
 *                                            `sesmt_procedimentos` e
 *                                            `usuarios_usuarios_dados_2` a
 *                                            descrição não diz que letras a API
 *                                            aceita. Escrever "use A" sem saber
 *                                            se "A" existe é inventar contrato.
 *
 * Por isso o alvo é reconhecido pelo MAPEAMENTO A/D/T presente na própria
 * descrição, não pelo nome do campo. Nome é palpite; o mapa é evidência.
 *
 *   npm run tools:situacao            # simula e mostra o antes/depois
 *   npm run tools:situacao -- --aplicar
 */
import pg from "pg";
import { parseDbConfig } from "../src/lib/jobs/db-config";

const APLICAR = process.argv.includes("--aplicar");

/** A descrição precisa mapear ATIVO e DESLIGADO — é o que prova que é status. */
const RX_ATIVO = /\bA\b\s*[-–:]\s*Ativ/i;
const RX_DESLIGADO = /\bD\b\s*[-–:]\s*Desligad/i;

const SUFIXO =
  " PADRÃO: use A (Ativos). Só use D ou T quando o usuário pedir explicitamente por desligados/demitidos.";

type Param = { nome: string; descricao?: string | null; origem?: string; [k: string]: unknown };

async function main() {
  const client = new pg.Client(parseDbConfig());
  await client.connect();
  const { rows } = await client.query<{ id: string; key: string; params: Param[] | null }>(
    `select id, key, params from ai_tools where params is not null`,
  );

  let alvos = 0;
  const mudancas: { id: string; key: string; params: Param[] }[] = [];

  for (const t of rows) {
    let mudou = false;
    const novos = (t.params ?? []).map((p) => {
      const d = String(p.descricao ?? "");
      // Só o que PROVA ser status funcional: mapeia Ativo E Desligado.
      if (!RX_ATIVO.test(d) || !RX_DESLIGADO.test(d)) return p;
      if (d.includes("PADRÃO: use A")) return p; // idempotente
      mudou = true;
      alvos++;
      console.log(`\n${t.key} · ${p.nome}`);
      console.log(`  antes:  ${d.trim()}`);
      console.log(`  depois: ${d.trim() + SUFIXO}`);
      return { ...p, descricao: d.trim() + SUFIXO };
    });
    if (mudou) mudancas.push({ id: t.id, key: t.key, params: novos });
  }

  console.log(`\n${alvos} parâmetro(s) em ${mudancas.length} ferramenta(s).`);

  // O que foi deliberadamente deixado de fora — silêncio aqui viraria "não havia mais nada".
  const forasDeAlcance = rows.flatMap((t) =>
    (t.params ?? [])
      .filter((p) => /situacao|situação/i.test(p.nome) && !(RX_ATIVO.test(String(p.descricao ?? "")) && RX_DESLIGADO.test(String(p.descricao ?? ""))))
      .map((p) => `${t.key} · ${p.nome}: "${String(p.descricao ?? "").slice(0, 50)}"`),
  );
  if (forasDeAlcance.length) {
    console.log(`\nNÃO tocados (${forasDeAlcance.length}) — data, ou valores desconhecidos:`);
    for (const f of forasDeAlcance) console.log(`  ${f}`);
  }

  if (!APLICAR) {
    console.log("\nSimulação. Rode com --aplicar para gravar.");
    await client.end();
    return;
  }

  // Transação: ou todas as descrições ficam coerentes, ou nenhuma muda.
  await client.query("begin");
  try {
    for (const m of mudancas) {
      await client.query(`update ai_tools set params = $1::jsonb where id = $2`, [JSON.stringify(m.params), m.id]);
    }
    await client.query("commit");
    console.log(`\nGRAVADO em ${mudancas.length} ferramenta(s).`);
  } catch (e) {
    await client.query("rollback");
    console.error("\nRevertido:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
