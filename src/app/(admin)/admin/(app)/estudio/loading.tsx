import { Skeleton, SkeletonCards } from "@/components/ui/skeleton";

/** `largura="page"`: coluna estreita, não a grade larga das telas de lista. */
export default function Carregando() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton variant="text" className="h-7 w-48" />
        <Skeleton variant="text" className="h-4 w-80" />
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
      <SkeletonCards count={3} />
    </div>
  );
}
