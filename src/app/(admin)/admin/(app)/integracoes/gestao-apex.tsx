"use client";

import { useState, useTransition } from "react";
import { ClipboardCopy, RefreshCw, SquareCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { blocoGestaoAction, rotacionarChaveGestaoAction } from "./actions";

/**
 * O BLOCO DO APEX, DENTRO DA BASE — o que antes era `npm run gestao:chave:prod`.
 *
 * O trabalho real do operador não é "obter uma chave": é abrir a região
 * "PL/SQL Dynamic Content" no APEX daquele cliente e substituir três linhas. Por
 * isso a tela entrega as três linhas prontas, e não a chave solta.
 *
 * Carrega SOB DEMANDA, ao abrir a seção. Duas razões: a chave é segredo e não
 * precisa trafegar na listagem de todas as bases; e a leitura emite a chave se
 * ela ainda não existir, o que cobre sozinho as bases cadastradas antes desta
 * tela — sem botão "habilitar" e sem ninguém precisar saber que faltava um passo.
 */
export function GestaoApex({ baseId, baseName }: { baseId: string; baseName: string }) {
  const [bloco, setBloco] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [carregando, startCarregar] = useTransition();
  const [rotacionando, startRotacionar] = useTransition();
  const toast = useToast();
  const { confirmar } = useConfirm();

  function abrir() {
    setAberto(true);
    if (bloco || carregando) return;
    startCarregar(async () => {
      const r = await blocoGestaoAction(baseId);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setBloco(r.bloco);
      setErro(null);
      setNota(
        r.emitidaAgora
          ? "Chave emitida agora para esta base."
          : r.criadaEm
            ? `Chave em uso desde ${new Date(r.criadaEm).toLocaleDateString("pt-BR")}.`
            : null,
      );
    });
  }

  async function copiar() {
    if (!bloco) return;
    try {
      await navigator.clipboard.writeText(bloco);
      toast.success("Bloco copiado. Cole no lugar das três constantes, no APEX deste cliente.");
    } catch {
      // Clipboard negado (http, permissão): o texto está visível na tela, então
      // o trabalho não para — só avisa que a cópia automática não foi.
      toast.warning("O navegador bloqueou a cópia. Selecione o texto e copie à mão.");
    }
  }

  async function rotacionar() {
    const ok = await confirmar({
      title: "Trocar a chave desta base?",
      description:
        `A área de gestão de "${baseName}" PARA DE ABRIR até alguém substituir a constante c_key ` +
        `no bloco PL/SQL do APEX deste cliente. A chave atual não fica guardada — não dá para voltar atrás por aqui.`,
      confirmLabel: "Trocar a chave",
      tone: "danger",
      // Trocar a chave é visível para o cliente FINAL, não só para quem clicou.
      // Digitar o nome da base é o que separa isto de um clique ao lado do Copiar.
      typeToConfirm: baseName,
    });
    if (!ok) return;
    startRotacionar(async () => {
      const r = await rotacionarChaveGestaoAction(baseId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setBloco(r.bloco);
      setErro(null);
      setNota("Chave trocada agora. Atualize o bloco no APEX deste cliente.");
      toast.warning(`Chave trocada. A área de gestão de "${baseName}" fica fora do ar até o APEX ser atualizado.`);
    });
  }

  if (!aberto) {
    return (
      <div className="mt-3 border-t border-border pt-3">
        <Button size="sm" variant="secondary" onClick={abrir}>
          <SquareCode /> Bloco do APEX (área de gestão)
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Área de gestão · bloco do APEX
        </span>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="secondary" onClick={copiar} disabled={!bloco}>
            <ClipboardCopy /> Copiar
          </Button>
          <Button size="sm" variant="ghost" onClick={rotacionar} disabled={!bloco || rotacionando}>
            <RefreshCw /> {rotacionando ? "Trocando…" : "Trocar chave"}
          </Button>
        </div>
      </div>

      {carregando && <p className="py-2 text-sm text-text-muted">Lendo a chave desta base…</p>}

      {erro && (
        <p className="rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-text">{erro}</p>
      )}

      {bloco && (
        <>
          <pre className="overflow-x-auto rounded-lg border border-border bg-surface-2/50 px-3 py-2 font-mono text-xs leading-relaxed text-text">
            {bloco}
          </pre>
          <p className="mt-1.5 text-xs text-text-muted">
            Substitui as três constantes da região <span className="font-mono">PL/SQL Dynamic Content</span> no
            APEX deste cliente — o arquivo completo está em{" "}
            <span className="font-mono">apex/gestao-iframe.sql</span>.
            {nota ? ` ${nota}` : ""}
          </p>
        </>
      )}
    </div>
  );
}
