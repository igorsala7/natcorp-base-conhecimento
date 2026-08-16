"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerDicionarioCsv } from "@/lib/apex/dicionario-csv";

export type ResultadoImportCsv =
  | { ok: true; gravadas: number; ignoradas: string[]; descartadas: number }
  | { ok: false; error: string };

/** A mesma origem para tudo que veio de CSV — é por ela que a substituição apaga. */
const ORIGEM = "csv_dict";

/**
 * IMPORTA UM DICIONÁRIO DE TABELAS E COLUNAS EM CSV.
 *
 * As ingestões que existiam — APEX e banco — pedem um JSON gerado por package
 * PL/SQL, o que exige acesso ao banco do cliente e uma rodada de DBA por base.
 * Um CSV é o que qualquer pessoa exporta de qualquer lugar.
 *
 * E ele cobre um buraco concreto: no `f200.json` real, os labels vivem nas
 * colunas de relatório, que NÃO sabem a tabela de origem — nenhum
 * `DB_TABLE_NAME` daquele arquivo menciona `FILIAL` ou `CENTRO_DE_CUSTO`. O CSV
 * afirma o que o metadado do APEX só insinua.
 *
 * ── Síncrono, e por quê ────────────────────────────────────────────────────
 * Diferente do JSON do APEX (22 MB, com passada de IA), aqui não há inferência:
 * é ler linhas e gravar. Um CSV de dez mil colunas tem poucos MB e resolve em
 * segundos — virar job custaria mais em espera pelo worker do que em
 * processamento.
 *
 * ── SUBSTITUI, não acumula ─────────────────────────────────────────────────
 * Reimportar apaga o que veio de CSV antes e grava de novo. É o comportamento
 * certo para dicionário: quando uma coluna é REMOVIDA do sistema, ela precisa
 * sumir daqui — acumular deixaria o assistente afirmando que existe um campo
 * que não existe mais, que é pior que não saber dele.
 *
 * O que veio do APEX e do banco não é tocado: origens diferentes, donos
 * diferentes.
 */
export async function importarDicionarioCsv(
  spaceId: string,
  texto: string,
): Promise<ResultadoImportCsv> {
  try {
    await requirePermission("ai.configure", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }

  const { linhas, ignoradas, descartadas } = lerDicionarioCsv(texto);
  if (linhas.length === 0) {
    return {
      ok: false,
      error:
        ignoradas.length > 0
          ? `Não achei as colunas de tabela e de coluna. O arquivo tem: ${ignoradas.slice(0, 6).join(", ")}.`
          : "Nenhuma linha aproveitável. O CSV precisa de uma coluna de tabela e uma de coluna.",
    };
  }

  const admin = createAdminClient();
  await admin.from("data_dictionary").delete().eq("space_id", spaceId).eq("source", ORIGEM);

  const registros = linhas.map((l) => ({
    space_id: spaceId,
    kind: "db_column",
    // `name` é o endereço completo: é o que aparece quando alguém procura a
    // coluna sem lembrar a tabela.
    name: `${l.tabela}.${l.coluna}`,
    parent_name: l.tabela,
    db_table: l.tabela,
    db_column: l.coluna,
    label: l.label,
    description: l.descricao,
    source: ORIGEM,
    metadata: l.tipo ? { data_type: l.tipo } : {},
  }));

  // Em lotes: um insert de dez mil linhas numa chamada estoura o limite do
  // PostgREST, e o erro que ele devolve não diz que o problema foi tamanho.
  let gravadas = 0;
  for (let i = 0; i < registros.length; i += 500) {
    const { error } = await admin.from("data_dictionary").insert(registros.slice(i, i + 500));
    if (error) {
      return {
        ok: false,
        error: `Falhou na linha ~${i + 1}: ${error.message}. As ${gravadas} anteriores foram gravadas.`,
      };
    }
    gravadas += Math.min(500, registros.length - i);
  }

  revalidatePath("/admin/ontologia");
  return { ok: true, gravadas, ignoradas, descartadas };
}
