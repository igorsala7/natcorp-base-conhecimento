"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Surface } from "@/components/ui/surface";
import { controlClass } from "@/components/ui/input";
import { eyebrowLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { salvarWebFetch } from "./web-actions";

export type WebAccessData = { authoring: boolean; reader: boolean; allowlist: string[] };

/**
 * Sistema → IA: acesso à web (scraping) dos assistentes. Autoria (editor/Estúdio)
 * sem allowlist; leitor (portal/widget/API) restrito aos domínios listados.
 */
export function WebAccessPanel({ authoring, reader, allowlist }: WebAccessData) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [aut, setAut] = useState(authoring);
  const [led, setLed] = useState(reader);
  const [lista, setLista] = useState(allowlist.join("\n"));

  function salvar() {
    start(async () => {
      const r = await salvarWebFetch({ authoring: aut, reader: led, allowlist: lista });
      if (r.ok) toast.success(r.msg ?? "Salvo."); else toast.error(r.error);
      router.refresh();
    });
  }

  return (
    <Surface elevation={1} padding="lg">
      <h2 className={eyebrowLabel}>
        <Globe className="mr-1.5 inline size-4 align-[-3px] text-primary" /> Acesso à web (scraping)
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
        Permite que os assistentes leiam o <strong className="font-medium">texto</strong> de um site citado
        no pedido, tratando-o como fonte (nunca como instrução). Endereços de rede interna são sempre
        bloqueados.
      </p>

      <div className="mt-4 space-y-3">
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={aut}
            onChange={(e) => setAut(e.target.checked)}
          />
          <span>
            <span className="font-medium">Autoria</span> — Chat IA do editor e “Criar com IA” (Estúdio).
            <span className="block text-text-muted">
              O autor puxa uma fonte para redigir. Sem restrição de domínio (uso interno).
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={led}
            onChange={(e) => setLed(e.target.checked)}
          />
          <span>
            <span className="font-medium">Leitor</span> — portal, widget e API pública.
            <span className="block text-text-muted">
              Restrito aos domínios abaixo. <strong className="font-medium">Vazio = nenhum site</strong> é
              acessado no leitor (evita que a chave pública vire um proxy de scraping).
            </span>
          </span>
        </label>
      </div>

      <div className={cn("mt-4", !led && "opacity-60")}>
        <label className="text-sm font-medium">Domínios permitidos (leitor)</label>
        <textarea
          className={cn(controlClass, "mt-1 font-mono text-xs")}
          rows={4}
          placeholder={"natcorp.com.br\ndocs.exemplo.com"}
          value={lista}
          onChange={(e) => setLista(e.target.value)}
        />
        <p className="mt-1 text-xs text-text-muted">
          Um domínio por linha. Subdomínios são incluídos (ex.: <code>natcorp.com.br</code> libera{" "}
          <code>www.natcorp.com.br</code>).
        </p>
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={salvar} disabled={pending}>
          <Save className="size-4" /> Salvar acesso à web
        </Button>
      </div>
    </Surface>
  );
}
