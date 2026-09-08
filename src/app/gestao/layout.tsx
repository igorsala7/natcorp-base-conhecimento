import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Área de gestão do cliente — servida em iFrame dentro do APEX.
 *
 * `dynamic = "force-dynamic"`: a identidade vem do token na querystring e o
 * conteúdo é de UM cliente. Qualquer cache de rota aqui corre o risco de servir
 * a página renderizada para a base A a alguém da base B — o modo exato de
 * falha que este produto não pode ter.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gestão do assistente",
  robots: { index: false, follow: false },
};

export default function GestaoLayout({ children }: { children: ReactNode }) {
  return children;
}
