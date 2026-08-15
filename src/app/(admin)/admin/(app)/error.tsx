"use client";

/**
 * Fronteira de erro do admin autenticado.
 *
 * Fica no grupo `(app)`, e não no `admin/`, de propósito: assim a sidebar e a
 * topbar sobrevivem à quebra. Quem perdeu a tela ainda consegue navegar para
 * outra em vez de ficar preso numa página branca.
 */
import { ErroDaRota } from "@/components/ui/erro-da-rota";

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErroDaRota error={error} reset={reset} />;
}
