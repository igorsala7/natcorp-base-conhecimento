import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

/** Streaming do App Router: o esqueleto tem a FORMA da tabela que vem. */
export default function Carregando() {
  return (
    <div className="space-y-6 p-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton variant="text" className="h-7 w-56" />
        <Skeleton variant="text" className="h-4 w-80" />
      </div>
      <SkeletonTable rows={10} cols={5} />
    </div>
  );
}
