import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/**
 * Aparência é DUAS COLUNAS: formulário estreito à esquerda, prévia larga à
 * direita. Um esqueleto de coluna única mostraria uma forma que a tela nunca
 * assume, e o conteúdo saltaria para o lugar ao chegar — o esqueleto genérico
 * troca "nada acontecendo" por "algo errado acontecendo".
 */
export default function Carregando() {
  return (
    <div className="space-y-6 p-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton variant="text" className="h-7 w-64" />
        <Skeleton variant="text" className="h-4 w-96" />
      </div>
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="w-full shrink-0 space-y-5 xl:w-96">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-3 rounded-xl border border-border bg-surface p-5">
              <Skeleton variant="text" className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
              <SkeletonText lines={2} />
            </div>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <Skeleton className="h-[26rem] w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
