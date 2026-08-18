import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/** Tela de formulário (`largura="page"`): blocos empilhados, não cartões. */
export default function Carregando() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton variant="text" className="h-7 w-56" />
        <Skeleton variant="text" className="h-4 w-96" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3 rounded-xl border border-border bg-surface p-5">
          <Skeleton variant="text" className="h-4 w-40" />
          <Skeleton className="h-10 w-full" />
          <SkeletonText lines={2} />
        </div>
      ))}
    </div>
  );
}
