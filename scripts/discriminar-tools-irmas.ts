/**
 * CLÁUSULAS QUE SEPARAM FERRAMENTAS IRMÃS.
 *
 * Das 19 falhas que sobram no gabarito com a ferramenta JÁ na mesa, 11 são o
 * modelo escolhendo a irmã. O `portao-acao.ts` já documenta por que forçar não
 * resolve isso: "Forçar 'alguma' não separa consultar_registros de
 * historico_financeiro. É problema de DISCRIMINAÇÃO, não de ação."
 *
 * Medido em 23/08/2026 nas 12 ferramentas envolvidas em erro real: 11 não dizem
 * QUANDO NÃO USAR e 10 não citam a irmã de que se distinguem.
 *
 * Cada cláusula abaixo nasce de um erro MEDIDO e afirma algo VERDADEIRO sobre a
 * ferramenta. Não escrevi cláusula para caso que eu não entendi — três pares
 * ficaram de fora de propósito (ver o rodapé).
 *
 * ── RESULTADO: MEDIDO, PIOROU, REVERTIDO ───────────────────────────────────
 * Aplicado em 23/08/2026 e medido no recorte dos 35 casos com a ferramenta na
 * mesa, gemini-3.5-flash, com os vetores regerados nos dois lados:
 *
 *     ANTES   16 · 16 · 16     (três rodadas — a linha de base é ESTÁVEL)
 *     DEPOIS  13 · 14          (duas rodadas)
 *
 * Não é ruído: a base repetiu 16 três vezes. As cláusulas custaram 2 a 3 casos.
 * REVERTIDO. O script fica porque o resultado negativo vale mais que o script:
 * sem ele, a próxima pessoa reescreve as mesmas cláusulas achando que é óbvio.
 *
 * A hipótese que eu tinha era a do auditor de cadastro — descrição sem "quando
 * NÃO usar" causaria a confusão entre irmãs. A medição do próprio auditor já
 * apontava contra e eu não dei o peso devido: no gabarito dele, descrição BOA
 * tinha 52% de omissão e descrição FRACA 32%. A direção era oposta à hipótese, e
 * ele escreveu isso.
 *
 * O que eu suspeito (NÃO MEDIDO, não trate como achado): proibição em negativo
 * ocupa espaço e desloca a atenção do que a ferramenta FAZ. O braço C da
 * auditoria, que ganhou +4/−1, REESCREVEU as descrições em vez de acrescentar
 * vetos ao fim — pode ser a diferença. Para saber, teria de medir as duas
 * formas separadamente, e isso ainda não foi feito.
 *
 *   npx tsx --env-file=.env.local scripts/discriminar-tools-irmas.ts [--seco|--desfazer]
 *
 * Depois de aplicar, REGERE OS VETORES — a mudança por SQL não passa pelo save
 * do construtor, que é quem normalmente gera o embedding:
 *   npm run embed:tools:base
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const BACKUP = ".audit/desc-antes-irmas.json";

/** chave → cláusula a ACRESCENTAR, e o erro medido que a justifica. */
const CLAUSULAS: { key: string; clausula: string; porque: string }[] = [
  {
    key: "meus_dados",
    porque:
      'Erros medidos: "Olá, preciso das informações dos meus liderados" e "Me retorne ' +
      'todos os colaboradores das área de RH e Folha" — o "me/meus" da frase puxou esta ' +
      "ferramenta, que é sobre a própria pessoa e não sobre quem ela pediu.",
    clausula:
      " NÃO USE quando a pergunta for sobre OUTRAS pessoas — equipe, liderados, subordinados, " +
      'colaboradores, candidatos. "Meus liderados", "minha equipe" e "me retorne os colaboradores" ' +
      'NÃO são "meus dados": o "me/meu" ali é de quem PEDE, não de quem é o assunto. Nesses casos ' +
      "use informacoes_pessoais_funcionais_resumido (lista de colaboradores) ou a ferramenta de " +
      "estrutura correspondente.",
  },
  {
    key: "linha_tempo",
    porque:
      'Erros medidos: "Como você avalia a trajetória desse colaborador?" e "Pegue todo o ' +
      'período, desde quando ela foi admitida" — foram para o cadastro, que é uma FOTO de hoje ' +
      "e não tem como responder sobre evolução.",
    clausula:
      " É A FERRAMENTA DE TRAJETÓRIA: use sempre que a pergunta for sobre EVOLUÇÃO, PROGRESSÃO, " +
      "CARREIRA, MUDANÇAS AO LONGO DO TEMPO ou um PERÍODO desde a admissão — 'como evoluiu', " +
      "'trajetória', 'histórico de cargos/salários', 'desde quando entrou'. O cadastro " +
      "(informacoes_pessoais_funcionais e o resumido) é uma FOTO DE HOJE e não responde nada disso.",
  },
  {
    key: "informacoes_pessoais_funcionais_resumido",
    porque:
      'Erro medido: "Se você consultar o histórico financeiro você descobre quem recebeu DS" — ' +
      "a pessoa citou a outra ferramenta pelo nome e ainda assim veio o cadastro.",
    clausula:
      " NÃO responde sobre PAGAMENTO, RUBRICA, PROVENTO, DESCONTO nem sobre o que alguém RECEBEU: " +
      "traz o salário cadastrado, não os eventos da folha. Pergunta do tipo 'quem recebeu X', " +
      "'quais colaboradores tiveram o evento Y' ou 'quem teve desconto de Z' é historico_financeiro. " +
      "E não responde sobre EVOLUÇÃO ou trajetória — isso é linha_tempo.",
  },
];

/**
 * ── O QUE FICOU DE FORA, E POR QUÊ ─────────────────────────────────────────
 * · `ferias_criar` × `ferias_situacao` ("requisição de férias" → veio situacao):
 *   a própria descrição do `ferias_criar` manda chamar `ferias_validar` antes, e
 *   `ferias_situacao` diz ser "o ponto de partida". Pelo fluxo descrito, o que o
 *   modelo fez está CERTO. Ou o gabarito ou o fluxo está errado — é pergunta
 *   para o dono, não cláusula para eu inventar.
 * · `informacoes_pessoais_funcionais` × `_resumido` ("faça pelo total da
 *   remuneração"): o resumido TEM salário, então não entendi por que o gabarito
 *   pede o completo. Sem entender, não escrevo.
 * · `candidatos_externos` × `candidatos_selecionados`: um caso só, e não sei
 *   dizer a diferença de negócio entre os dois sem perguntar.
 */

async function main() {
  const seco = process.argv.includes("--seco");
  const desfazer = process.argv.includes("--desfazer");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("faltam as variáveis do Supabase"); process.exit(1); }
  const db = createClient(url, key, { auth: { persistSession: false } });

  if (desfazer) {
    if (!existsSync(BACKUP)) { console.error(`sem ${BACKUP}`); process.exit(1); }
    for (const t of JSON.parse(readFileSync(BACKUP, "utf8")) as { key: string; description: string }[]) {
      const { error } = await db.from("ai_tools").update({ description: t.description }).eq("key", t.key);
      console.log(`${error ? "ERRO " + error.message : "restaurado"}  ${t.key}`);
    }
    console.log("\nRegere os vetores: npm run embed:tools:base");
    return;
  }

  const chaves = CLAUSULAS.map((c) => c.key);
  const { data, error } = await db.from("ai_tools").select("key, description").in("key", chaves);
  if (error) { console.error(error.message); process.exit(1); }
  if (!existsSync(BACKUP) && !seco) writeFileSync(BACKUP, JSON.stringify(data, null, 2));
  const atual = new Map((data ?? []).map((t) => [(t as { key: string }).key, String((t as { description: string }).description)]));

  for (const c of CLAUSULAS) {
    const desc = atual.get(c.key);
    if (!desc) { console.log(`AUSENTE     ${c.key}`); continue; }
    if (desc.includes(c.clausula.trim().slice(0, 40))) { console.log(`já tem      ${c.key}`); continue; }
    console.log(`\n■ ${c.key}`);
    console.log(`  por quê: ${c.porque}`);
    console.log(`  +${c.clausula.trim().slice(0, 96)}…`);
    if (seco) continue;
    const { error: e } = await db.from("ai_tools").update({ description: desc + c.clausula }).eq("key", c.key);
    if (e) console.error(`  ERRO: ${e.message}`);
  }
  console.log(seco ? "\n--seco: nada gravado." : "\nAplicado. Agora: npm run embed:tools:base");
}

main().catch((e) => { console.error(e); process.exit(1); });
