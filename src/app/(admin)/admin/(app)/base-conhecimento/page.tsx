import { redirect } from "next/navigation";

/**
 * A gestão da base de conhecimento foi centralizada na aba **Embeddings** da
 * Importar (`/admin/importar?aba=embeddings`). Esta rota agora apenas
 * redireciona — preservando `?space=` — para manter válidos os links antigos.
 *
 * O parâmetro mudou de `?tab=` para `?aba=` quando a Importar passou a usar o
 * primitivo `ui/tabs`: um só nome em todo o produto é o que permite ao
 * `mapa-rotas.test.ts` verificar que toda aba declarada existe de fato.
 */
export default async function BaseConhecimentoPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  const { space } = await searchParams;
  redirect(`/admin/importar?aba=embeddings${space ? `&space=${space}` : ""}`);
}
