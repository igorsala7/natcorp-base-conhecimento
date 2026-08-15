import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function Carregando() {
  return (
    <div className="space-y-6 p-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton variant="text" className="h-7 w-56" />
        <Skeleton variant="text" className="h-4 w-80" />
      </div>
      {/* A fileira de abas aparece antes do conteúdo — é o que a tela mostra. */}
      <div className="flex gap-2">
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>
      <SkeletonTable rows={8} cols={4} />
    </div>
  );
}
