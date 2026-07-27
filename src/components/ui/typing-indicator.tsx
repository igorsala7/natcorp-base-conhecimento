import { cn } from "@/lib/utils";

/**
 * Indicador "digitando…" — três pontos que sobem em onda (inspirado no
 * indicador clássico de chat), nas TRÊS cores da marca (roxo · rosa · azul).
 * É a identidade do projeto aplicada ao "typing" do assistente de IA, do
 * Estúdio (Criar com IA) e do chat do editor (Editar com IA). O widget tem a
 * sua própria versão em `public/widget.js` (Shadow DOM isola o CSS).
 *
 * Acessível: anuncia via `role="status"`; respeita `prefers-reduced-motion`
 * (o salto vira um pulso de opacidade — keyframes em globals.css).
 */
export function TypingIndicator({
  className,
  label = "Digitando",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={`${label}…`}
      className={cn("inline-flex items-end gap-1", className)}
    >
      <Dot className="bg-brand-purple-600 dark:bg-brand-purple-400" delay="0ms" />
      <Dot className="bg-brand-pink-500 dark:bg-brand-pink-400" delay="160ms" />
      <Dot className="bg-brand-blue-600 dark:bg-brand-blue-400" delay="320ms" />
      <span className="sr-only">{label}…</span>
    </span>
  );
}

function Dot({ className, delay }: { className: string; delay: string }) {
  return (
    <span
      aria-hidden
      style={{ animationDelay: delay }}
      className={cn(
        "size-1.5 rounded-full motion-safe:animate-[typing_1.4s_ease-in-out_infinite] motion-reduce:animate-[typing-soft_1.4s_ease-in-out_infinite]",
        className,
      )}
    />
  );
}
