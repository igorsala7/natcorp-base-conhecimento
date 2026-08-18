import { Skeleton, SkeletonList } from "@/components/ui/skeleton";

export default function Carregando() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton variant="text" className="h-7 w-32" />
        <Skeleton variant="text" className="h-4 w-96" />
      </div>
      <SkeletonList rows={6} />
    </div>
  );
}
