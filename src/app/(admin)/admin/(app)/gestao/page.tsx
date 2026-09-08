import { hasPermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageShell } from "@/components/ui/page-shell";
import { SemPermissao } from "@/components/ui/sem-permissao";
import { GestaoFrame, type BaseOpcao } from "./gestao-frame";
import type { PlanoLinha } from "./plano-form";

/**
 * Gestão dos clientes, para o suporte interno.
 *
 * Mostra a MESMA página que o cliente vê no APEX, embutida aqui, com um seletor
 * de cliente por fora. Reusar a tela em vez de construir uma versão interna é
 * deliberado: duas telas para os mesmos dados divergem, e no dia em que o
 * cliente disser "aqui aparece 300 créditos" ninguém saberia qual das duas
 * está certa.
 *
 * A identidade NÃO é a do cliente. O suporte entra como suporte
 * (`?suporte=1`), autorizado por `gestao.suporte`, e cada abertura fica em
 * `gestao_suporte_acessos`.
 */
export default async function AdminGestaoPage() {
  if (!(await hasPermission("gestao.suporte"))) {
    return (
      <SemPermissao
        titulo="Gestão de clientes"
        oQue="abrir a gestão de clientes"
        permissao="gestao.suporte"
        papel="Admin técnico"
      />
    );
  }

  const db = createAdminClient();

  const [{ data: bases }, { data: chaves }, { data: planosRaw }] = await Promise.all([
    db.from("ai_bases").select("base_code, name, active, id").order("name"),
    db.from("ai_base_tracking_keys").select("base_id"),
    db
      .from("ai_cliente_plano")
      .select(
        "id, base_code, creditos_por_ciclo, usd_por_credito, tokens_por_credito, dia_inicio_ciclo, vigente_desde, observacao",
      )
      .order("vigente_desde", { ascending: false })
      .range(0, 999),
  ]);

  // Agrupa por base e marca o VIGENTE: a primeira linha cuja vigência já começou.
  // Um plano com data futura aparece na lista mas ainda não vale — mostrar os
  // dois sem distinguir faria alguém conferir o número errado.
  const hoje = new Date().toISOString().slice(0, 10);
  const planos: Record<string, PlanoLinha[]> = {};
  for (const p of planosRaw ?? []) {
    const lista = (planos[p.base_code] ??= []);
    lista.push({
      ...p,
      vigente:
        p.vigente_desde <= hoje &&
        !lista.some((x) => x.vigente_desde <= hoje && x.vigente_desde >= p.vigente_desde),
    });
  }

  const comChave = new Set((chaves ?? []).map((c) => c.base_id));

  const opcoes: BaseOpcao[] = (bases ?? []).map((b) => ({
    base_code: b.base_code,
    name: b.name,
    active: b.active,
    temChave: comChave.has(b.id),
  }));

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/+$/, "") ?? "";

  return (
    <PageShell
      titulo="Gestão de clientes"
      descricao="A mesma tela que o cliente vê no painel dele, para acompanhar consumo, créditos, acessos e conversas. As alterações feitas aqui valem para o cliente e ficam registradas em seu nome."
      largura="wide"
    >
      {opcoes.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
          Nenhuma base cadastrada. Cadastre um cliente em Integrações para começar.
        </p>
      ) : (
        <GestaoFrame bases={opcoes} basePath={basePath} planos={planos} />
      )}
    </PageShell>
  );
}
