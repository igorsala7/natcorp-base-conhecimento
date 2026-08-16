import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * AS TRÊS LEITURAS DO MESMO TRÁFEGO.
 *
 * Conversas, Acessos e Rastreio respondem perguntas encadeadas sobre a mesma
 * visita: o que a pessoa PERGUNTOU, que páginas ela ABRIU, e por que a resposta
 * saiu como saiu. Estavam em dois grupos de menu diferentes — Conversas e
 * Acessos em "Canais e análises", Rastreio em "Administração" — e nada as
 * ligava. Quem via uma conversa estranha não tinha caminho até o turno que a
 * produziu; tinha que saber que existia outra tela, em outro grupo, e reencontrar
 * a conversa lá.
 *
 * ── Por que Rastreio é opcional aqui ────────────────────────────────────────
 * Ele não é escopado por documentação: é chaveado por `base_code` e exige
 * `ai.configure` (nível 80), enquanto Conversas pede `content.view` (nível 10).
 * Mostrar a aba para quem não pode abri-la a transformaria num beco — a mesma
 * doença que a tela de recusa existe para tratar. Quem tem a permissão vê as
 * três; quem não tem vê duas, e não fica sabendo que perdeu algo que não usaria.
 */
export function TrackingTabs({
  current,
  spaceId,
  podeRastrear = false,
}: {
  current: "conversas" | "acessos" | "rastreio";
  spaceId: string;
  /** `ai.configure`. Sem ela, a aba de rastreio não aparece. */
  podeRastrear?: boolean;
}) {
  const tabs = [
    { key: "conversas", label: "Conversas", href: `/admin/conversas?space=${spaceId}` },
    { key: "acessos", label: "Acessos às páginas", href: `/admin/acessos?space=${spaceId}` },
    // O Rastreio não leva `space`: ele não é escopado por documentação, e passar
    // o parâmetro sugeriria um filtro que a tela não aplica.
    ...(podeRastrear ? [{ key: "rastreio", label: "Rastreio do chat", href: "/admin/logs" }] : []),
  ] as const;

  return (
    <div className="mt-5 inline-flex rounded-lg border border-border bg-surface p-0.5">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={current === t.key ? "page" : undefined}
          className={cn(
            "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
            current === t.key ? "bg-primary text-white shadow-1" : "text-text-muted hover:text-text",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
