"use client";

/**
 * Fronteira LOCAL. Sem ela, um erro aqui sobe para o `error.tsx` do grupo e
 * derruba a casca inteira do admin — inclusive a barra lateral e o breadcrumb,
 * que estavam bons. Uma tela que falhou não deve levar junto a navegação que
 * tiraria a pessoa dali.
 */
import { ErroDaRota } from "@/components/ui/erro-da-rota";

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErroDaRota error={error} reset={reset} titulo="As análises não carregaram" />;
}
