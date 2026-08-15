"use client";

/**
 * Fronteira LOCAL. Sem ela, um erro aqui sobe para o `error.tsx` do grupo e
 * derruba a tela inteira — inclusive a árvore/lista ao lado, que estava boa.
 */
import { ErroDaRota } from "@/components/ui/erro-da-rota";

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErroDaRota error={error} reset={reset} titulo="Esta área não carregou" />;
}
