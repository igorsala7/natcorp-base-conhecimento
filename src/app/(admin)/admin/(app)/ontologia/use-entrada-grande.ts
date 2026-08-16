"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";

/**
 * ARQUIVO GRANDE VAI PELO STORAGE, PEQUENO VAI NO CORPO.
 *
 * As quatro ingestões desta página mandavam o texto inteiro pela Server Action.
 * Isso funcionava com metadado de brinquedo e falha com o real: o `f200.json`
 * tem 22 MB, e o JSON do dicionário de banco também passa de 8. O Next devolve
 * "Body exceeded 8mb limit" — que ao menos é claro, diferente do erro anterior
 * ("An unexpected response was received from the server"), que não dizia nada.
 *
 * Elevar o limite não resolve. Um corpo desse tamanho numa Server Action é
 * carregado inteiro na memória de um worker do Next, que não é onde esse
 * trabalho pertence.
 *
 * ── Por que um hook e não três correções ────────────────────────────────────
 * Eu já tinha consertado o JSON do APEX assim e deixado as outras três iguais.
 * Corrigir uma de cada vez foi o que produziu este segundo relato do mesmo bug
 * por outra porta — o padrão precisa morar num lugar só, senão a quarta cópia
 * volta a divergir.
 *
 * ── O corte em 1 MB ─────────────────────────────────────────────────────────
 * Não é o limite técnico (são ~8 MB): é onde o textarea deixa de ser útil.
 * Colar 22 MB nele trava o navegador — o React re-renderiza a cada tecla um
 * valor de 22 milhões de caracteres — e ninguém revisa 1 MB de JSON numa caixa
 * de texto.
 */

export type EntradaGrande = {
  /** Texto colado, quando é pequeno. */
  texto: string;
  setTexto: (v: string) => void;
  /** Arquivo já no Storage, quando é grande. */
  arquivo: { nome: string; path: string; bytes: number } | null;
  limparArquivo: () => void;
  subindo: boolean;
  /** Para o `<input type="file">`. */
  aoEscolherArquivo: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  /** O que mandar para a action: o caminho vence o texto. */
  entrada: () => { jsonText?: string; storagePath?: string };
  /** Há algo para processar? */
  temAlgo: boolean;
};

const LIMITE_INLINE = 1024 * 1024;

export function useEntradaGrande(spaceId: string, prefixo: string): EntradaGrande {
  const toast = useToast();
  const supabase = createClient();
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<EntradaGrande["arquivo"]>(null);
  const [subindo, setSubindo] = useState(false);
  const supaRef = useRef(supabase);

  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;

    if (f.size <= LIMITE_INLINE) {
      const reader = new FileReader();
      reader.onload = () => {
        setTexto(String(reader.result ?? ""));
        setArquivo(null);
      };
      reader.readAsText(f);
      return;
    }

    setSubindo(true);
    try {
      const path = `${spaceId}/${prefixo}-${Date.now()}-${f.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supaRef.current.storage
        .from("imports")
        .upload(path, f, { contentType: f.type || "application/octet-stream" });
      if (error) {
        toast.error(`Falha no upload: ${error.message}`);
        return;
      }
      // Texto e arquivo não convivem: qual valeria? O upload limpa o textarea
      // para a resposta ser sempre uma só.
      setTexto("");
      setArquivo({ nome: f.name, path, bytes: f.size });
      toast.success("Arquivo enviado. Agora clique em processar.");
    } finally {
      setSubindo(false);
    }
  }

  return {
    texto,
    setTexto,
    arquivo,
    limparArquivo: () => setArquivo(null),
    subindo,
    aoEscolherArquivo,
    entrada: () => (arquivo ? { storagePath: arquivo.path } : { jsonText: texto }),
    temAlgo: !!arquivo || texto.trim().length > 0,
  };
}

/**
 * Qual entrada está valendo, dita na tela.
 *
 * Sem isto, quem sobe um arquivo e depois cola algo no textarea não sabe qual
 * dos dois vai ser processado — e o caminho do Storage vence em silêncio.
 */
export function resumoDaEntrada(ent: EntradaGrande): { arquivo?: string; tamanho: string } | null {
  if (ent.arquivo) {
    return { arquivo: ent.arquivo.nome, tamanho: `${(ent.arquivo.bytes / 1024 / 1024).toFixed(1)} MB` };
  }
  const b = new Blob([ent.texto]).size;
  if (b === 0) return null;
  return { tamanho: b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB colados` : `${(b / 1024).toFixed(0)} KB colados` };
}
