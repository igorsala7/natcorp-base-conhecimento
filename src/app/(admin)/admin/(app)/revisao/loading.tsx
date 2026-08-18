import { Skeleton, SkeletonList } from "@/components/ui/skeleton";

/** Fila de revisão: cabeçalho + lista de artigos aguardando aprovação. */
export default function Carregando() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton variant="text" className="h-7 w-40" />
        <Skeleton variant="text" className="h-4 w-80" />
      </div>
      <SkeletonList rows={5} />
    </div>
  );
}
