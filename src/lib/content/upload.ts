"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Envia um arquivo para o bucket público `assets` e devolve a URL.
 *
 * Estava embutido no bloco de imagem do editor; foi extraído porque a tela de
 * aparência precisa exatamente do mesmo caminho — e porque o formato da URL
 * gerada aqui é o que o schema do tema valida (só aceita imagem deste bucket,
 * para o campo não virar hotlink de domínio arbitrário).
 */
export async function uploadToAssets(file: File, spaceId: string): Promise<string | null> {
  const supabase = createClient();
  const path = `${spaceId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await supabase.storage.from("assets").upload(path, file);
  if (error) return null;
  return supabase.storage.from("assets").getPublicUrl(path).data.publicUrl;
}

/** Abre o seletor de arquivos e envia. `null` se o usuário cancelar ou falhar. */
export function escolherEEnviar(
  spaceId: string,
  aoTerminar: (url: string | null) => void,
  accept = "image/*",
) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return aoTerminar(null);
    aoTerminar(await uploadToAssets(file, spaceId));
  };
  input.click();
}
