import { Skeleton, SkeletonList, SkeletonText } from "@/components/ui/skeleton";

/** Duas colunas, como o ContentShell: árvore à esquerda, painel à direita. */
export default function Carregando() {
  return (
    <div className="flex h-full" aria-busy="true">
      <div className="w-72 shrink-0 border-r border-border p-4">
        <Skeleton variant="text" className="mb-4 h-8 w-full" />
        <SkeletonList rows={12} />
      </div>
      <div className="flex-1 p-8">
        <Skeleton variant="text" className="h-9 w-2/3" />
        <SkeletonText lines={4} className="mt-6" />
        <SkeletonText lines={3} className="mt-8" />
      </div>
    </div>
  );
}
