import { Skeleton, SkeletonCards } from "@/components/ui/skeleton";

export default function Carregando() {
  return (
    <div className="space-y-6 p-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton variant="text" className="h-7 w-72" />
        <Skeleton variant="text" className="h-4 w-96" />
      </div>
      {/* A barra de abas já ocupa lugar: sem ela o conteúdo salta ao chegar. */}
      <div className="flex gap-4 border-b border-border pb-3">
        {["w-24", "w-20", "w-28", "w-16"].map((w) => (
          <Skeleton key={w} variant="text" className={`h-4 ${w}`} />
        ))}
      </div>
      <SkeletonCards count={4} />
    </div>
  );
}
