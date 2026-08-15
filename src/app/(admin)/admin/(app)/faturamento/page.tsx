import type { Metadata } from "next";
import { Search } from "lucide-react";
import { hasPermission } from "@/lib/auth/permissions";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { mesCorrente } from "@/lib/billing/pricing";
import { getConfig, getConsumo } from "./actions";
import { ConfigForm } from "./config-form";
import { FaturamentoView } from "./faturamento-view";
import { SemPermissao } from "@/components/ui/sem-permissao";
import { controlClass } from "@/components/ui/input";

export const metadata: Metadata = { title: "Faturamento" };

type SP = { de?: string; ate?: string; cliente?: string };


function Campo({
  label, name, value, type = "text", placeholder, dica,
}: {
  label: string; name: string; value?: string; type?: string; placeholder?: string; dica?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <input className={controlClass} name={name} defaultValue={value} type={type} placeholder={placeholder} />
      {dica ? <span className="text-xs text-text-muted">{dica}</span> : null}
    </label>
  );
}

/**
 * Consumo de IA por cliente, para faturar.
 *
 * Só o que entrou pelo WIDGET é cobrável — chat, análises, conversas, arquivos
 * e as ferramentas que eles disparam. O portal público de documentação, o uso
 * interno do admin e os jobs de sistema aparecem separados, somados à parte,
 * porque custo que não se cobra ainda é custo e some da vista se for só
 * filtrado fora.
 */
export default async function FaturamentoPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!(await hasPermission("ai.configure", null))) {
    return (
      <SemPermissao
        titulo="Faturamento"
        oQue="ver o consumo e o faturamento"
        permissao="ai.configure"
        papel="Admin técnico"
      />
    );
  }

  const sp = await searchParams;
  const padrao = mesCorrente();
  const de = sp.de || padrao.de;
  const ate = sp.ate || padrao.ate;
  const cliente = sp.cliente ?? "";

  const [cfg, consumo] = await Promise.all([getConfig(), getConsumo({ de, ate, cliente })]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-text">Faturamento</h1>
        <p className="mt-1 text-text-muted">
          Consumo de IA por cliente no período. Só o widget é cobrável — o portal público de
          documentação é cortesia e aparece separado, fora de qualquer total.
        </p>
      </header>

      {/* ── Período e cliente ─────────────────────────────────────────── */}
      <form className="mt-6" method="get">
        <Surface elevation={1} padding="md">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Campo label="De" name="de" value={de} type="date" />
            <Campo label="Até" name="ate" value={ate} type="date" dica="inclusive" />
            <Campo
              label="Cliente"
              name="cliente"
              value={cliente}
              placeholder="todos"
              dica="parâmetro de rastreio p_base"
            />
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                <Search className="size-4" /> Aplicar
              </Button>
            </div>
          </div>
        </Surface>
      </form>

      {/* ── Regra de cobrança ─────────────────────────────────────────── */}
      <ConfigForm cfg={cfg} />

      {!consumo.ok ? (
        <Surface elevation={1} padding="lg" className="mt-6">
          <p className="text-text">Não foi possível ler o consumo: {consumo.error}</p>
        </Surface>
      ) : (
        <FaturamentoView
          cobravel={consumo.dados.cobravel}
          naoCobravel={consumo.dados.naoCobravel}
          base={cfg.base}
          usdPorMtok={cfg.usdPorMtok}
          cobrarOverhead={cfg.cobrarOverhead}
          periodo={{ de, ate }}
        />
      )}
    </div>
  );
}
