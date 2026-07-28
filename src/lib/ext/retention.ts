import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Retenção/limpeza das capturas da extensão (Fase 5.6). Apaga os ARQUIVOS BRUTOS
 * (prints e áudios no bucket privado `imports`, sob `ext/<session>/`) e a sessão
 * (os eventos somem por cascade). NÃO toca no rascunho gerado nem nas imagens já
 * re-hospedadas no bucket público `assets` — essas pertencem ao artigo.
 */
const BUCKET = "imports";

/** Remove os arquivos e a sessão. Retorna quantos arquivos foram apagados. */
export async function deleteSessionData(sessionId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data: evs } = await supabase
    .from("extension_events")
    .select("storage_path")
    .eq("session_id", sessionId);
  const paths = (evs ?? []).map((e) => e.storage_path).filter((p): p is string => !!p);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths).catch(() => {});
  // Eventos somem por cascade ao apagar a sessão.
  await supabase.from("extension_sessions").delete().eq("id", sessionId);
  return paths.length;
}

/**
 * Poda sessões mais antigas que `dias` (padrão 30). Pensado para rodar no worker
 * (cron), como as outras retenções. Devolve quantas sessões foram apagadas.
 */
export async function purgeOldSessions(dias = 30): Promise<number> {
  const supabase = createAdminClient();
  const corte = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
  const { data: velhas } = await supabase
    .from("extension_sessions")
    .select("id")
    .lt("created_at", corte)
    .limit(500);
  let n = 0;
  for (const s of velhas ?? []) {
    await deleteSessionData(s.id);
    n++;
  }
  return n;
}
