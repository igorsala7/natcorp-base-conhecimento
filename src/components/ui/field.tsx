import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Campo de formulário canônico: rótulo VISÍVEL, texto de ajuda persistente e
 * erro logo abaixo do campo (não em um resumo no topo).
 *
 * Placeholder não é rótulo: some quando o usuário digita e é o erro de forma
 * mais comum em formulários. Aqui o rótulo é obrigatório por tipagem.
 *
 * Duas formas de associar rótulo e controle, ambas válidas:
 *  - com `htmlFor` → associação explícita (permite `aria-describedby` ligando
 *    hint e erro ao controle, então prefira esta);
 *  - sem `htmlFor` → o próprio `<label>` envolve o controle. Útil quando o
 *    conteúdo é gerado e não há id estável para distribuir.
 *
 * ── Por que o aria é INJETADO, e não passado pelo call site ──────────────────
 * Este arquivo exportava `fieldAria()` para o call site espalhar no controle.
 * Em 214 usos de `<Field>`, ela foi chamada ZERO vezes. O resultado eram três
 * defeitos silenciosos ao mesmo tempo: o `hint` nunca era anunciado (existia na
 * tela e não na árvore de acessibilidade), o controle nunca recebia
 * `aria-invalid` — então quem voltava ao campo pelo teclado não sabia que ele
 * estava errado — e o estilo `aria-[invalid=true]:border-danger` do `Input`
 * nunca disparava, porque nada setava o atributo que ele observa.
 *
 * Nada disso foi desatenção: é o que acontece com toda API opcional que precisa
 * ser lembrada em cada uso. A correção não é documentar melhor — é o `Field`
 * clonar o filho e injetar o que ele mesmo já sabe. O call site deixa de poder
 * errar, em vez de passar a errar menos.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const Rotulo = (
    <>
      {label}
      {required && (
        <span className="ml-0.5 text-accent" aria-hidden="true">
          *
        </span>
      )}
    </>
  );

  const auxiliar = (
    <>
      {hint && !error && (
        <p
          id={htmlFor ? `${htmlFor}-hint` : undefined}
          className="mt-1.5 text-xs leading-relaxed text-text-muted"
        >
          {hint}
        </p>
      )}
      {error && (
        <p
          id={htmlFor ? `${htmlFor}-erro` : undefined}
          role="alert"
          className="mt-1.5 text-xs font-medium text-danger"
        >
          {error}
        </p>
      )}
    </>
  );

  const controle = comAria(children, htmlFor, { hint: !!hint, error: !!error });

  // Sem htmlFor: o label envolve o controle (associação implícita).
  // O espaçamento rótulo→controle vem do mb-1 do próprio eyebrowLabel.
  if (!htmlFor) {
    return (
      <label className={cn("block", className)}>
        <span className={eyebrowLabel}>{Rotulo}</span>
        {controle}
        {auxiliar}
      </label>
    );
  }

  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={eyebrowLabel}>
        {Rotulo}
      </label>
      {controle}
      {auxiliar}
    </div>
  );
}

/**
 * Injeta `aria-describedby` e `aria-invalid` no controle.
 *
 * Clona apenas quando o filho é UM elemento — que é a forma de 214 dos usos:
 * `<Field htmlFor="x"><Input id="x" /></Field>`. Com vários filhos, ou com o
 * controle embrulhado num `<div>`, não há como saber qual deles é o campo, e
 * marcar o invólucro seria pior que não marcar: `aria-invalid` numa `<div>` não
 * significa nada e ainda esconderia a lacuna.
 *
 * Prop já escrita no call site VENCE. O objetivo é remover a obrigação de
 * lembrar, não tirar o controle de quem precisa de um caso especial.
 */
function comAria(
  children: React.ReactNode,
  htmlFor: string | undefined,
  opts: { hint: boolean; error: boolean },
): React.ReactNode {
  // Sem id estável não há o que referenciar: o `<label>` envolvente já associa
  // o rótulo, e `aria-describedby` exige um id de destino que não existe.
  if (!htmlFor || (!opts.hint && !opts.error)) return children;
  if (!React.isValidElement(children)) return children;

  const atual = children.props as Record<string, unknown>;
  const { "aria-describedby": descrito, "aria-invalid": invalido } = fieldAria(htmlFor, opts);

  return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
    "aria-describedby": atual["aria-describedby"] ?? descrito,
    "aria-invalid": atual["aria-invalid"] ?? invalido,
  });
}

/** Label de formulário no padrão da referência: eyebrow em caps discreto. */
export const eyebrowLabel =
  "mb-1 block text-2xs font-semibold uppercase tracking-[0.05em] text-text-muted";

/**
 * Eyebrow de seção: menor, mais pesado e mais espaçado que o rótulo.
 *
 * A cor era `brand-gray-400` (#A9A4B5), que mede 2,42:1 sobre branco e reprova
 * AA com folga — num texto de 11px em caixa-alta, que é o pior caso possível.
 * Passou despercebido porque no tema ESCURO o mesmo hex mede 7,5:1 e passa:
 * quem desenvolve no escuro nunca vê a falha. É o mesmo erro que o `gray.500`
 * já tinha cometido (4,37:1) e que fez `--color-text-muted` nascer — a lição
 * simplesmente não tinha sido aplicada ao degrau de cima.
 */
export const eyebrow = "text-2xs font-bold uppercase tracking-[0.1em] text-text-muted";

/**
 * Ids de `aria-describedby` para ligar o input ao hint/erro do `Field`.
 *
 * O `Field` chama isto sozinho — ver `comAria`. Continua exportada para o caso
 * em que o controle NÃO é filho direto (embrulhado num `<div>` de layout), onde
 * a clonagem não alcança e o call site precisa espalhar à mão.
 */
export function fieldAria(id: string, opts: { hint?: boolean; error?: boolean }) {
  const ids = [opts.error ? `${id}-erro` : null, opts.hint && !opts.error ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");
  return {
    id,
    "aria-invalid": opts.error ? true : undefined,
    "aria-describedby": ids || undefined,
  } as const;
}
