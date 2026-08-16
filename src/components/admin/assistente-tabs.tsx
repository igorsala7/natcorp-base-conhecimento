import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * AS QUATRO TELAS QUE DEFINEM O ASSISTENTE.
 *
 * Tudo o que determina COMO o bot responde estava separado em quatro rotas de
 * três grupos de menu diferentes: a persona em "Canais e análises", a ontologia
 * em rota órfã (UM único link de entrada em todo o admin), os arquivos que ele
 * lê dentro de "Chatbot", e o que ele respondeu em "Conversas". Quem ajustava o
 * comportamento precisava saber, de cor, onde cada peça morava.
 *
 * ── Por que abas-como-link, e não um único arquivo ──────────────────────────
 * Mover os corpos das páginas para dentro de uma só exigiria reapontar 18
 * chamadas de `revalidatePath` — 13 só da ontologia. Revalidar um caminho que
 * não existe mais NÃO dá erro: a tela apenas para de atualizar depois de salvar,
 * e ninguém liga o defeito à mudança que o causou. É a classe de bug mais cara
 * desta reforma.
 *
 * Abas-como-link entregam a mesma coisa para quem usa — as quatro viraram uma
 * área com navegação visível — sem tocar em nenhuma delas. O mesmo padrão já
 * resolveu Conversas/Acessos/Rastreio nesta rodada. Quando as fusões de arquivo
 * acontecerem, este componente vira `<Tabs>` e as páginas viram painéis; até lá,
 * o custo de errar é zero.
 *
 * ── O que é condicional, e por quê ──────────────────────────────────────────
 * "Canais e chaves" exige `widget.manage` (nível 80) e as demais pedem
 * `content.view` (nível 10). Oferecer uma aba que a pessoa não pode abrir a
 * transforma num beco — a doença que a tela de recusa existe para tratar.
 */
export function AssistenteTabs({
  atual,
  spaceId,
  podeGerenciarWidget = false,
}: {
  atual: "persona" | "ontologia" | "canais" | "atividade";
  spaceId: string;
  /** `widget.manage`. Sem ela, a aba de canais não aparece. */
  podeGerenciarWidget?: boolean;
}) {
  const abas = [
    { key: "persona", label: "Persona", href: `/admin/assistente?space=${spaceId}` },
    { key: "ontologia", label: "Ontologia", href: `/admin/ontologia?space=${spaceId}` },
    ...(podeGerenciarWidget
      ? [{ key: "canais", label: "Canais e conhecimento", href: `/admin/chatbot?space=${spaceId}` }]
      : []),
    { key: "atividade", label: "Conversas", href: `/admin/conversas?space=${spaceId}` },
  ] as const;

  return (
    <div className="inline-flex flex-wrap rounded-lg border border-border bg-surface p-0.5">
      {abas.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={atual === t.key ? "page" : undefined}
          className={cn(
            "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
            atual === t.key ? "bg-primary text-white shadow-1" : "text-text-muted hover:text-text",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
