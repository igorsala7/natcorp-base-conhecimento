"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { obterBlocoApex } from "./plano-actions";

/**
 * COMO O CLIENTE ENTRA NA GESTÃO DELE.
 *
 * A pergunta que este painel responde, feita em 23/09: "como meus clientes vão
 * acessar a gestão da IA deles se não têm acesso ao admin da base de
 * conhecimento?". Não têm mesmo, e não precisam: a área é aberta por um TOKEN
 * assinado que o APEX do próprio cliente gera. O que falta, em cada cliente, é
 * a região que gera esse token — este bloco.
 *
 * Sem ele instalado não existe porta nenhuma do lado do cliente, e a tela só
 * abre pelo modo suporte. Daí a impressão de que "só funciona logado como
 * admin": é verdade, mas porque a porta do cliente ainda não foi aberta.
 *
 * ── O botão só aparece quando há o que copiar ─────────────────────────
 * O bloco carrega a chave de rastreio da base, que é segredo. Fica atrás de um
 * clique e some ao fechar — não é conteúdo de tela, é uma ação.
 */
export function InstalacaoApex({ baseCode, baseNome }: { baseCode: string; baseNome: string }) {
  const [bloco, setBloco] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pendente, iniciar] = useTransition();

  function carregar() {
    setErro(null);
    setCopiado(false);
    iniciar(async () => {
      const r = await obterBlocoApex(baseCode);
      if (r.ok) setBloco(r.bloco);
      else setErro(r.erro);
    });
  }

  async function copiar() {
    if (!bloco) return;
    try {
      await navigator.clipboard.writeText(bloco);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem permissão de área de transferência (http, navegador antigo): o
      // texto continua na tela, selecionável. Falhar em silêncio aqui é pior
      // que não ter o botão.
      setErro("Não foi possível copiar automaticamente. Selecione o texto e copie.");
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Instalar no painel de {baseNome}</h3>
          <p className="mt-0.5 max-w-prose text-xs text-text-muted">
            O cliente não entra por login daqui — ele entra por um token que o APEX dele gera. Cole
            este bloco como região <strong>PL/SQL Dynamic Content</strong> no Painel do Operador
            daquele cliente; enquanto ele não existir, só a Natcorp consegue abrir esta gestão.
          </p>
        </div>
        <div className="flex flex-none gap-2">
          {bloco ? (
            <>
              <Button type="button" onClick={copiar}>
                {copiado ? "Copiado" : "Copiar bloco"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setBloco(null)}>
                Fechar
              </Button>
            </>
          ) : (
            <Button type="button" onClick={carregar} disabled={pendente}>
              {pendente ? "Gerando…" : "Gerar bloco de instalação"}
            </Button>
          )}
        </div>
      </div>

      {erro ? (
        <p
          role="alert"
          className="mt-3 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {erro}
        </p>
      ) : null}

      {bloco ? (
        <>
          <p className="mt-3 rounded-md border border-warning-line bg-warning-soft px-3 py-2 text-xs text-warning">
            Este bloco contém a <strong>chave de rastreio</strong> desta base — é ela que assina a
            identidade de quem abre a tela. Trate como senha: não cole em chamado, e-mail ou
            conversa.
          </p>
          <pre className="mt-3 max-h-96 overflow-auto rounded-md border border-border bg-surface-2 p-3 text-2xs leading-relaxed">
            <code>{bloco}</code>
          </pre>
        </>
      ) : null}
    </section>
  );
}
