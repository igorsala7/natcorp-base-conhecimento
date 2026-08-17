import { Skeleton, SkeletonCards } from "@/components/ui/skeleton";

/**
 * Desempenho agrega sete consultas sobre janelas de até 90 dias.
 *
 * Sem `loading.tsx`, o App Router SEGURA a navegação até o servidor terminar:
 * o clique parece não ter funcionado, e a pessoa clica de novo. Esta tela
 * soma buscas, mensagens, visualizações e varreduras de qualidade — é das que mais precisavam, e estava entre as que
 * não tinham.
 *
 * O esqueleto imita a MOLDURA que vai chegar (título, descrição, barra de
 * abas), não uma caixa genérica: é o que evita o salto de layout quando o
 * conteúdo real entra.
 */
export default function Carregando() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-6 py-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton variant="text" className="h-8 w-64" />
        <Skeleton variant="text" className="h-4 w-96" />
      </div>
      <Skeleton className="h-9 w-full max-w-md rounded-md" />
      <SkeletonCards count={3} />
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
