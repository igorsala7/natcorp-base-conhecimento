"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PlanoForm, type PlanoLinha } from "./plano-form";

/**
 * Seletor de cliente + iFrame da área de gestão.
 *
 * ── Como os parâmetros de fora falam com a página de dentro ────────────
 *
 * Trocando o `src`. Não há postMessage para mandar comando: a página de dentro
 * já lê tudo o que precisa da própria URL, e um canal de mensagens seria um
 * segundo caminho para dizer a mesma coisa — com a diferença de que ele
 * precisaria ser validado, versionado e mantido em sincronia com a URL.
 *
 * A comunicação de VOLTA existe, e só para uma coisa: a altura. O iframe avisa
 * quanto de conteúdo tem, e o container cresce junto, para não haver a rolagem
 * dentro da rolagem que torna essas telas insuportáveis. Como as duas páginas
 * são da mesma origem, dá para ler `contentDocument` direto — e é o que fazemos,
 * porque um `postMessage` de altura exigiria código dentro do iframe que só
 * serve ao admin, e que iria junto para dentro do APEX do cliente.
 */

export type BaseOpcao = {
  base_code: string;
  name: string;
  active: boolean;
  /** Falso quando a base ainda não tem chave própria — a tela do APEX não abre. */
  temChave: boolean;
};

const ABAS = [
  { id: "", rotulo: "Consumo" },
  { id: "/creditos", rotulo: "Créditos" },
  { id: "/acessos", rotulo: "Acessos" },
  { id: "/conversas", rotulo: "Conversas" },
] as const;

export function GestaoFrame({
  bases,
  basePath,
  planos,
}: {
  bases: BaseOpcao[];
  basePath: string;
  /** Planos por base_code — o formulário de contrato fica FORA do iframe. */
  planos: Record<string, PlanoLinha[]>;
}) {
  const [base, setBase] = useState(bases[0]?.base_code ?? "");
  const [aba, setAba] = useState<string>("");
  const [altura, setAltura] = useState(900);
  const ref = useRef<HTMLIFrameElement>(null);

  const src = useMemo(
    () => `${basePath}/gestao${aba}?suporte=1&base=${encodeURIComponent(base)}`,
    [basePath, aba, base],
  );

  const escolhida = bases.find((b) => b.base_code === base);

  // Acompanha a altura do conteúdo. Mesma origem, então `contentDocument` é
  // acessível; se algum dia deixar de ser, o try/catch mantém a altura padrão
  // em vez de derrubar a tela.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let obs: ResizeObserver | null = null;

    function medir() {
      try {
        const doc = el!.contentDocument;
        const body = doc?.body;
        if (!body) return;
        const h = Math.max(body.scrollHeight, doc!.documentElement?.scrollHeight ?? 0);
        if (h > 0) setAltura(Math.min(Math.max(h + 24, 400), 4000));
      } catch {
        // Origem diferente ou documento ainda não pronto: fica a altura atual.
      }
    }

    function aoCarregar() {
      medir();
      try {
        const body = el!.contentDocument?.body;
        if (body && "ResizeObserver" in window) {
          obs = new ResizeObserver(medir);
          obs.observe(body);
        }
      } catch {
        // idem
      }
    }

    el.addEventListener("load", aoCarregar);
    return () => {
      el.removeEventListener("load", aoCarregar);
      obs?.disconnect();
    };
  }, [src]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="min-w-[240px]">
          <label
            className="mb-1 block text-xs font-medium text-text-muted"
            htmlFor="gestao-base"
          >
            Cliente
          </label>
          <select
            id="gestao-base"
            className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-ring"
            value={base}
            onChange={(e) => setBase(e.target.value)}
          >
            {bases.map((b) => (
              <option key={b.base_code} value={b.base_code}>
                {b.name} ({b.base_code}){b.active ? "" : " — inativa"}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-1">
          {ABAS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAba(a.id)}
              aria-pressed={aba === a.id}
              className={[
                "rounded-md px-3 py-2 text-ui font-medium transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                aba === a.id
                  ? "bg-primary text-primary-fg"
                  : "border border-border-strong text-text hover:bg-surface-2",
              ].join(" ")}
            >
              {a.rotulo}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-border-strong px-3 py-2 text-ui text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Abrir em nova aba
          </a>
        </div>
      </div>

      {escolhida && !escolhida.temChave ? (
        <div className="rounded-lg border border-warning-line bg-warning-soft px-4 py-3">
          <p className="text-sm text-warning">
            <strong>{escolhida.name}</strong> ainda não tem chave própria de rastreio. Você consegue
            ver a gestão por aqui, mas a página <em>dentro do APEX</em> deste cliente não vai abrir
            até a chave ser emitida.
          </p>
          <p className="mt-1 text-sm text-text">
            Emita com{" "}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs">
              npm run gestao:chave:prod -- {escolhida.base_code}
            </code>{" "}
            e cole o valor no bloco PL/SQL daquele cliente.
          </p>
        </div>
      ) : null}

      {escolhida ? (
        <PlanoForm
          key={escolhida.base_code}
          baseCode={escolhida.base_code}
          baseNome={escolhida.name}
          planos={planos[escolhida.base_code] ?? []}
        />
      ) : null}

      <iframe
        ref={ref}
        src={src}
        title={`Gestão de ${escolhida?.name ?? base}`}
        className="w-full rounded-lg border border-border bg-surface"
        style={{ height: altura }}
      />
    </div>
  );
}
