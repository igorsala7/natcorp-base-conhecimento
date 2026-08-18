import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/** `largura="page"`: formulário de criação + lista de chaves + documentação. */
export default function Carregando() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton variant="text" className="h-7 w-48" />
        <SkeletonText lines={2} />
      </div>
      <div className="space-y-3 rounded-xl border border-border bg-surface p-5">
        <Skeleton className="h-10 w-full" />
        <div className="flex flex-wrap gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="text" className="h-4 w-28" />
          ))}
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton variant="text" className="h-4 w-32" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}
