"use client";

import { useTransition } from "react";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { salvarConfig, type Config } from "./actions";
import { controlClass } from "@/components/ui/input";


/**
 * Regra de cobrança.
 *
 * Cliente (e não um `<form action={serverAction}>` puro) porque salvar preço em
 * silêncio é o pior desfecho possível aqui: quem mexe nesta caixa precisa de
 * confirmação explícita de que o valor pegou, e do motivo quando não pegou.
 */
export function ConfigForm({ cfg }: { cfg: Config }) {
  const toast = useToast();
  const [pendente, iniciar] = useTransition();

  const enviar = (form: FormData) => {
    iniciar(async () => {
      const r = await salvarConfig(form);
      if (r.ok) toast.success("Regra de cobrança salva.");
      else toast.error(r.error ?? "Não foi possível salvar.");
    });
  };

  return (
    <form action={enviar} className="mt-4">
      <Surface elevation={1} padding="md">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-muted">US$ por milhão de tokens</span>
            <input
              className={`${controlClass} w-40`}
              name="usd_por_mtok"
              defaultValue={String(cfg.usdPorMtok)}
              inputMode="decimal"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-muted">Base de cobrança</span>
            <select className={`${controlClass} w-72`} name="base_cobranca" defaultValue={cfg.base}>
              <option value="bruto">Bruta — todo token que trafegou</option>
              <option value="ponderado">Ponderada — cache pelo preço real</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-text">
            <input
              type="checkbox"
              name="cobrar_overhead"
              defaultChecked={cfg.cobrarOverhead}
              className="size-4 rounded border-border accent-[var(--color-primary)]"
            />
            Cobrar o overhead interno do turno
          </label>
          <Button type="submit" variant="secondary" className="mb-1" disabled={pendente}>
            {pendente ? "Salvando…" : "Salvar"}
          </Button>
        </div>
        <p className="mt-3 max-w-4xl text-xs text-text-muted">
          A base <strong>bruta</strong> cobra tudo que trafegou, inclusive o que veio do cache
          barato. A <strong>ponderada</strong> converte a fatia de cache pelo preço real do
          provedor (leitura ≈0,10× e escrita ≈1,25× na Anthropic). As duas contagens aparecem lado
          a lado nas tabelas — esta escolha define apenas qual delas vira a coluna “A cobrar”.
        </p>
      </Surface>
    </form>
  );
}
