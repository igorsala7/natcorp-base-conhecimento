import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

/** Tela de tabela: os arquivos da base de conhecimento. */
export default function Carregando() {
  return (
    <div className="space-y-6 p-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton variant="text" className="h-7 w-64" />
        <Skeleton variant="text" className="h-4 w-96" />
      </div>
      <SkeletonTable rows={6} cols={4} />
    </div>
  );
}
