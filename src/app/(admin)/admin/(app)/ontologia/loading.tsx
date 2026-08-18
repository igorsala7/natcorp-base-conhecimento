import { Skeleton, SkeletonList } from "@/components/ui/skeleton";

export default function Carregando() {
  return (
    <div className="space-y-6 p-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton variant="text" className="h-7 w-56" />
        <Skeleton variant="text" className="h-4 w-96" />
      </div>
      <div className="flex gap-4 border-b border-border pb-3">
        {["w-20", "w-32", "w-24"].map((w) => (
          <Skeleton key={w} variant="text" className={`h-4 ${w}`} />
        ))}
      </div>
      {/* Barra de busca + filtro, que é o que aparece acima da lista de termos. */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-40" />
      </div>
      <SkeletonList rows={8} />
    </div>
  );
}
