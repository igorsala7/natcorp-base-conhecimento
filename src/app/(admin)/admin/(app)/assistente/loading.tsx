import { Skeleton } from "@/components/ui/skeleton";

/**
 * O Assistente monta persona, chat de teste e as bases de integração.
 *
 * Sem `loading.tsx`, o App Router SEGURA a navegação até o servidor terminar:
 * o clique parece não ter funcionado, e a pessoa clica de novo. Esta tela
 * resolve permissões por documentação antes de renderizar — é das que mais precisavam, e estava entre as que
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
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}
