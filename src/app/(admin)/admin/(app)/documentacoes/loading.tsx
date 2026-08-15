import { Skeleton, SkeletonCards } from "@/components/ui/skeleton";

export default function Carregando() {
  return (
    <div className="space-y-6 p-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton variant="text" className="h-7 w-56" />
        <Skeleton variant="text" className="h-4 w-80" />
      </div>
      <SkeletonCards count={6} />
    </div>
  );
}
