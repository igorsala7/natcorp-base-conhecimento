/**
 * REGISTRO DE RODADA DE EVAL — grava o placar com o que o torna comparável.
 *
 * O placar sozinho não é medição: é recado. Duas rodadas só se comparam se
 * viajarem junto o código medido, o gabarito usado e as flags. Este módulo
 * junta as três coisas e grava em `ai_eval_runs` / `ai_eval_results`.
 *
 * Uso, no fim de um script de eval:
 *
 *   const run = await registrarRodada(db, {
 *     eixo: "ferramenta", script: "eval-tools",
 *     gabaritoArquivo: ARQUIVO, flags: { base: BASE, top: TOP },
 *     casosTotal: linhas.length, casosMediveis: medivel, acertos,
 *     placar: { ranking, config, uso, sem_catalogo: semCatalogo },
 *     resultados: linhas.map(...),
 *   });
 *
 * NUNCA derruba o eval. Uma falha ao gravar vira aviso: o placar impresso
 * continua sendo a saída principal, e perder o registro é ruim, mas perder a
 * rodada inteira é pior.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ResultadoCaso = {
  ordem?: number;
  pergunta?: string | null;
  esperado?: string | null;
  obtido?: string | null;
  ok?: boolean | null;
  /** Família da falha (RANKING, CONFIG, USO, EMBEDDING…) — decide o remédio. Nulo quando acertou. */
  motivo?: string | null;
  detalhe?: Record<string, unknown>;
};

export type Rodada = {
  eixo: string;
  script: string;
  /** Caminho do gabarito. O checksum sai daqui — comparar placares através de
   *  uma troca de gabarito é comparar coisa nenhuma. */
  gabaritoArquivo?: string | null;
  flags?: Record<string, unknown>;
  casosTotal: number;
  /** Denominador HONESTO: exclui o que o instrumento não tinha como julgar. */
  casosMediveis: number;
  acertos: number;
  placar?: Record<string, unknown>;
  nota?: string | null;
  resultados?: ResultadoCaso[];
};

/** Estado do git NO MOMENTO da rodada. `sujo` marca medição feita sobre mudança
 *  não commitada: o número vale, mas não é reproduzível só pelo sha. */
export function estadoDoGit(): { sha: string | null; sujo: boolean } {
  const git = (...args: string[]): string | null => {
    try {
      return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      return null;
    }
  };
  const sha = git("rev-parse", "HEAD");
  // `status --porcelain` vazio = árvore limpa. Se o comando falhar (fora de um
  // repositório), o honesto é assumir sujo: não sabemos que estava limpo.
  const status = git("status", "--porcelain");
  return { sha, sujo: status === null ? true : status.length > 0 };
}

/** Checksum do gabarito, para saber que duas rodadas mediram a MESMA régua. */
export function assinaturaDoGabarito(
  arquivo: string | null | undefined,
): { sha: string | null; casos: number | null } {
  if (!arquivo) return { sha: null, casos: null };
  try {
    const bruto = readFileSync(arquivo, "utf8");
    const linhas = bruto.split("\n").filter((l) => l.trim().length > 0).length;
    return { sha: createHash("sha256").update(bruto).digest("hex").slice(0, 16), casos: linhas };
  } catch {
    return { sha: null, casos: null };
  }
}

/**
 * Grava a rodada e devolve o `run_id` (ou null se a gravação falhar).
 *
 * O tipo do cliente é frouxo de propósito: os scripts de eval instanciam o
 * Supabase com `Database` gerado, e amarrar aqui obrigaria a regerar tipos
 * antes de rodar qualquer eval — exatamente o atrito que faz gente pular o
 * registro.
 */
export async function registrarRodada(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, any, any>,
  r: Rodada,
): Promise<string | null> {
  try {
    const git = estadoDoGit();
    const gab = assinaturaDoGabarito(r.gabaritoArquivo);

    const { data, error } = await db
      .from("ai_eval_runs")
      .insert({
        eixo: r.eixo,
        script: r.script,
        git_sha: git.sha,
        git_sujo: git.sujo,
        flags: r.flags ?? {},
        gabarito_arquivo: r.gabaritoArquivo ?? null,
        gabarito_sha: gab.sha,
        gabarito_casos: gab.casos,
        casos_total: r.casosTotal,
        casos_mediveis: r.casosMediveis,
        acertos: r.acertos,
        placar: r.placar ?? {},
        nota: r.nota ?? null,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.warn(`\n[eval] rodada NÃO registrada: ${error?.message ?? "sem retorno"}`);
      return null;
    }

    const runId = (data as { id: string }).id;

    if (r.resultados?.length) {
      const linhas = r.resultados.map((c, i) => ({
        run_id: runId,
        ordem: c.ordem ?? i,
        pergunta: c.pergunta ?? null,
        esperado: c.esperado ?? null,
        obtido: c.obtido ?? null,
        ok: c.ok ?? null,
        motivo: c.motivo ?? null,
        detalhe: c.detalhe ?? {},
      }));
      // Em lotes: um gabarito grande num insert só estoura o limite do PostgREST.
      for (let i = 0; i < linhas.length; i += 200) {
        const { error: e2 } = await db.from("ai_eval_results").insert(linhas.slice(i, i + 200));
        if (e2) {
          console.warn(`[eval] resultados parcialmente gravados: ${e2.message}`);
          break;
        }
      }
    }

    console.log(
      `\n[eval] rodada ${runId.slice(0, 8)} registrada` +
        ` · ${git.sha?.slice(0, 7) ?? "sem git"}${git.sujo ? "+sujo" : ""}` +
        ` · gabarito ${gab.sha ?? "?"}`,
    );
    return runId;
  } catch (e) {
    console.warn(`\n[eval] rodada NÃO registrada: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}
