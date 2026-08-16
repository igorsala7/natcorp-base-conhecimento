import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * O GIRO, num lugar só.
 *
 * A doutrina de carregamento diz: rota → barra de topo; primeira carga →
 * `Skeleton`; ação num controle → `Button loading`. Sobra um caso que nenhum
 * dos três cobre — o ITEM de uma lista que está sendo processado agora, numa
 * fila em que os outros esperam. Ali não há controle para acender, e esqueleto
 * seria errado: o nome do arquivo já está na tela e não deve virar caixa cinza.
 *
 * Antes deste primitivo, esse caso virava `animate-spin` escrito à mão no call
 * site — foi assim que o produto chegou a 33 deles, cada um com seu tamanho e
 * sua cor. A regra não era "não use spinner"; era "não reinvente o spinner".
 *
 * `aria-hidden` porque quem anuncia o progresso é o `aria-live` da lista: um
 * ícone que se descreve em cada linha vira ruído para leitor de tela.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      aria-hidden="true"
      className={cn("size-3.5 shrink-0 animate-spin text-primary motion-reduce:animate-none", className)}
    />
  );
}
