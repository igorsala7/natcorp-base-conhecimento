/**
 * COMPARA DUAS RODADAS DE EVAL — read-only.
 *
 * O placar de uma rodada diz onde se está. O que decide se uma mudança valeu é
 * o DIFF entre duas: quais casos viraram, para cada lado.
 *
 * A distinção não é acadêmica. Uma rodada que ganha 4 casos e perde 3 tem saldo
 * +1 e 81% de troca — não melhorou o sistema, sacudiu ele. Um placar agregado
 * mostra "+1" e esconde as sete mudanças; só o diff por caso separa ganho real
 * de churn.
 *
 *   npm run eval:comparar                       compara as duas últimas de cada eixo
 *   npm run eval:comparar -- --eixo ferramenta  só um eixo
 *   npm run eval:comparar -- --de <id> --para <id>
 */
import { createClient } from "@supabase/supabase-js";

const arg = (nome: string, padrao = ""): string => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 && process.argv[i + 1] ? String(process.argv[i + 1]) : padrao;
};

type Run = {
  id: string;
  created_at: string;
  eixo: string;
  script: string;
  git_sha: string | null;
  git_sujo: boolean;
  gabarito_sha: string | null;
  gabarito_arquivo: string | null;
  casos_mediveis: number;
  acertos: number;
  placar: Record<string, number>;
  nota: string | null;
};

type Resultado = { pergunta: string | null; ok: boolean | null; motivo: string | null };

const pct = (a: number, b: number): string => (b ? `${Math.round((a / b) * 100)}%` : "—");
const curto = (id: string): string => id.slice(0, 8);

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  const idDe = arg("de");
  const idPara = arg("para");
  const eixoFiltro = arg("eixo");

  let pares: [Run, Run][] = [];

  if (idDe && idPara) {
    const { data } = await db.from("ai_eval_runs").select("*").in("id", [idDe, idPara]);
    const runs = (data ?? []) as Run[];
    const de = runs.find((r) => r.id === idDe);
    const para = runs.find((r) => r.id === idPara);
    if (!de || !para) {
      console.error("Rodada não encontrada. Confira os ids.");
      process.exit(1);
    }
    pares = [[de, para]];
  } else {
    let q = db.from("ai_eval_runs").select("*").order("created_at", { ascending: false }).limit(60);
    if (eixoFiltro) q = q.eq("eixo", eixoFiltro);
    const { data } = await q;
    const runs = (data ?? []) as Run[];
    const porEixo = new Map<string, Run[]>();
    for (const r of runs) porEixo.set(r.eixo, [...(porEixo.get(r.eixo) ?? []), r]);
    for (const [, lista] of porEixo) {
      // A lista vem do mais novo para o mais velho: [1] é a anterior, [0] a atual.
      if (lista.length >= 2 && lista[1] && lista[0]) pares.push([lista[1], lista[0]]);
    }
  }

  if (!pares.length) {
    console.log("\nNão há duas rodadas do mesmo eixo para comparar ainda.");
    console.log("Rode o eval mais de uma vez — a série começa na segunda.\n");
    return;
  }

  for (const [de, para] of pares) {
    console.log(`\n══ ${de.eixo.toUpperCase()} · ${de.script} `.padEnd(72, "═"));
    console.log(`  de   ${curto(de.id)}  ${de.created_at.slice(0, 16).replace("T", " ")}  ${de.git_sha?.slice(0, 7) ?? "—"}${de.git_sujo ? "+sujo" : ""}${de.nota ? `  "${de.nota}"` : ""}`);
    console.log(`  para ${curto(para.id)}  ${para.created_at.slice(0, 16).replace("T", " ")}  ${para.git_sha?.slice(0, 7) ?? "—"}${para.git_sujo ? "+sujo" : ""}${para.nota ? `  "${para.nota}"` : ""}`);

    /**
     * A GUARDA QUE IMPORTA. Comparar placares medidos com gabaritos diferentes é
     * comparar coisa nenhuma — foi o que aconteceu quando os cenários foram de
     * 42 para 57 e depois para 138, e os números pareciam uma evolução.
     */
    if (de.gabarito_sha !== para.gabarito_sha) {
      console.log(`\n  ⚠ GABARITO DIFERENTE — ${de.gabarito_sha ?? "?"} → ${para.gabarito_sha ?? "?"}`);
      console.log(`    Os placares NÃO são comparáveis: mudou a régua, não (só) o sistema.`);
      console.log(`    O diff por caso abaixo continua valendo para os casos presentes nas duas.`);
    }
    if (de.git_sujo || para.git_sujo) {
      console.log(`\n  ⚠ rodada sobre árvore SUJA — reprodutível só na máquina de quem rodou.`);
    }

    const d = para.acertos - de.acertos;
    console.log(
      `\n  placar   ${de.acertos}/${de.casos_mediveis} (${pct(de.acertos, de.casos_mediveis)})` +
        `  →  ${para.acertos}/${para.casos_mediveis} (${pct(para.acertos, para.casos_mediveis)})` +
        `   ${d > 0 ? `+${d}` : d}`,
    );

    const baldes = new Set([...Object.keys(de.placar ?? {}), ...Object.keys(para.placar ?? {})]);
    for (const b of [...baldes].sort()) {
      const a = de.placar?.[b] ?? 0;
      const z = para.placar?.[b] ?? 0;
      if (a || z) console.log(`    ${b.padEnd(14)} ${a} → ${z}${z !== a ? `   ${z > a ? "+" : ""}${z - a}` : ""}`);
    }

    const { data: rDe } = await db.from("ai_eval_results").select("pergunta, ok, motivo").eq("run_id", de.id);
    const { data: rPara } = await db.from("ai_eval_results").select("pergunta, ok, motivo").eq("run_id", para.id);
    const antes = new Map((rDe ?? []).map((x) => [(x as Resultado).pergunta ?? "", x as Resultado]));
    const depois = new Map((rPara ?? []).map((x) => [(x as Resultado).pergunta ?? "", x as Resultado]));

    const ganhou: string[] = [];
    const perdeu: string[] = [];
    const trocouMotivo: string[] = [];
    for (const [p, dep] of depois) {
      const ant = antes.get(p);
      if (!ant) continue;
      if (!ant.ok && dep.ok) ganhou.push(p);
      else if (ant.ok && !dep.ok) perdeu.push(`${p}   → ${dep.motivo ?? "?"}`);
      else if (!ant.ok && !dep.ok && ant.motivo !== dep.motivo) {
        trocouMotivo.push(`${p}   ${ant.motivo} → ${dep.motivo}`);
      }
    }

    const comuns = [...depois.keys()].filter((p) => antes.has(p)).length;
    const mexeu = ganhou.length + perdeu.length;
    console.log(`\n  casos em comum ${comuns} · mudaram ${mexeu}${comuns ? ` (${pct(mexeu, comuns)})` : ""}`);

    if (ganhou.length) {
      console.log(`\n  ▲ GANHOU (${ganhou.length})`);
      for (const p of ganhou) console.log(`      "${p.slice(0, 60)}"`);
    }
    if (perdeu.length) {
      console.log(`\n  ▼ PERDEU (${perdeu.length})`);
      for (const p of perdeu) console.log(`      "${p.slice(0, 60)}"`);
    }
    if (trocouMotivo.length) {
      console.log(`\n  ↔ continuou errando, por outro motivo (${trocouMotivo.length})`);
      for (const p of trocouMotivo) console.log(`      "${p.slice(0, 70)}"`);
    }

    /**
     * O veredito que o placar sozinho esconde. Saldo pequeno com muita troca é o
     * padrão de mudança que não melhora nada — e é fácil comemorar por engano.
     */
    if (mexeu > 0 && Math.abs(d) * 2 < mexeu) {
      console.log(
        `\n  ⚠ CHURN: ${mexeu} casos viraram para saldo de ${d > 0 ? `+${d}` : d}.` +
          ` Isso é o sistema sacudindo, não melhorando.`,
      );
    }
  }
  console.log();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
