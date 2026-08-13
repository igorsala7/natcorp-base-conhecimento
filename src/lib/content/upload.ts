"use client";

import { createClient } from "@/lib/supabase/client";

/** Motivo da falha em português, para a tela mostrar em vez de só destravar o botão. */
function motivo(e: unknown): string {
  const m = (e as { message?: unknown })?.message;
  const txt = typeof m === "string" ? m : String(e ?? "");
  if (/exceeded the maximum allowed size|payload too large|413/i.test(txt)) return "A imagem é grande demais para o servidor.";
  if (/mime type|not supported|invalid.*type/i.test(txt)) return "Formato de imagem não aceito.";
  if (/row-level security|permission|unauthorized|403/i.test(txt)) return "Sem permissão para enviar imagem nesta documentação.";
  if (/duplicate|already exists/i.test(txt)) return "Já existe um arquivo com esse nome. Tente de novo.";
  if (/fetch|network|failed to fetch/i.test(txt)) return "Falha de rede ao enviar. Verifique a conexão.";
  return txt.slice(0, 160) || "Não foi possível enviar a imagem.";
}

/**
 * Envia um arquivo para o bucket público `assets` e devolve a URL.
 *
 * Estava embutido no bloco de imagem do editor; foi extraído porque a tela de
 * aparência precisa exatamente do mesmo caminho — e porque o formato da URL
 * gerada aqui é o que o schema do tema valida (só aceita imagem deste bucket,
 * para o campo não virar hotlink de domínio arbitrário).
 */
export async function uploadToAssets(file: File, spaceId: string): Promise<string | null> {
  return (await enviarParaBucket("assets", `${spaceId}/`, file)).url;
}

/**
 * Envia uma foto de usuário/autor para o bucket público `avatars` e devolve a
 * URL. Bucket próprio (não `assets`): foto de pessoa não pertence a nenhuma
 * documentação — a escrita é gate por `user.manage` na policy do Storage.
 */
export async function uploadAvatar(file: File): Promise<string | null> {
  return (await enviarParaBucket("avatars", "", file)).url;
}

/**
 * O envio, com o MOTIVO da falha preservado.
 *
 * As duas funções acima devolvem `string | null` e engoliam o erro do Storage.
 * Quem chamava só via "não veio URL" e não tinha o que dizer à pessoa: o botão
 * voltava ao normal e a imagem simplesmente não mudava (relatado no avatar do
 * widget, 13/08/2026). Aqui o motivo sobrevive para quem quiser mostrá-lo.
 */
export async function enviarParaBucket(
  bucket: "assets" | "avatars",
  prefixo: string,
  file: File,
): Promise<{ url: string | null; erro?: string }> {
  try {
    const supabase = createClient();
    const path = `${prefixo}${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) return { url: null, erro: motivo(error) };
    return { url: supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl };
  } catch (e) {
    // O cliente do Storage LANÇA em falha de rede. Sem este catch a exceção
    // escapava do `onchange` (que é async e ninguém aguarda), o callback nunca
    // rodava e o botão ficava "Enviando…" para sempre.
    return { url: null, erro: motivo(e) };
  }
}

/**
 * Abre o seletor de arquivos e envia.
 *
 * `aoTerminar` é chamado SEMPRE — inclusive quando a pessoa cancela ou o envio
 * falha. Isso não era verdade: `onchange` não dispara no cancelamento, e a
 * documentação desta função dizia que sim. Quem cancelasse ficava com o botão
 * travado em "Enviando…" até recarregar a página, e quem tivesse uma falha de
 * rede, idem.
 *
 * O segundo argumento (`erro`) é opcional para quem já chamava — as telas que
 * quiserem mostrar o motivo passam a poder.
 */
export function escolherEEnviar(
  spaceId: string,
  aoTerminar: (url: string | null, erro?: string) => void,
  accept = "image/*",
) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;

  let respondido = false;
  const responder = (url: string | null, erro?: string) => {
    if (respondido) return;
    respondido = true;
    aoTerminar(url, erro);
  };

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return responder(null);
    const r = await enviarParaBucket("assets", `${spaceId}/`, file);
    responder(r.url, r.erro);
  };
  // CANCELAMENTO. Suportado nos navegadores atuais; onde não for, a rede de
  // segurança abaixo (foco de volta na janela) destrava mesmo assim.
  input.oncancel = () => responder(null);
  window.addEventListener(
    "focus",
    () => {
      // Um quadro depois: se o `change` fosse disparar, ele já disparou. Sem esta
      // folga, o retorno do foco cancelaria um envio legítimo.
      setTimeout(() => {
        if (!input.files?.length) responder(null);
      }, 300);
    },
    { once: true },
  );

  input.click();
}
