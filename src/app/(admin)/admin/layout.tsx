import type { ReactNode } from "react";

/**
 * Layout raiz do Admin — apenas um passthrough. A divisão de chrome fica nos
 * grupos aninhados: (app) tem o shell autenticado (sidebar+topbar) e (auth)
 * tem o layout centrado das telas de login/MFA. A proteção de rota é do
 * middleware (AAL2).
 */
export default function AdminRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
