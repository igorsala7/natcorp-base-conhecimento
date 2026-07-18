import { redirect } from "next/navigation";

/**
 * Raiz: por enquanto encaminha para o Admin.
 * O Portal público (`/docs/...`) chega na Fase 2.
 */
export default function Home() {
  redirect("/admin");
}
