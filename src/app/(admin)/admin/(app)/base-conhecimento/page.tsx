import { redirect } from "next/navigation";

/**
 * A gestão da base de conhecimento foi centralizada na aba **Embeddings** da
 * Importar (`/admin/importar?tab=embeddings`). Esta rota agora apenas
 * redireciona — preservando `?space=` — para manter válidos os links antigos.
 */
export default async function BaseConhecimentoPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  const { space } = await searchParams;
  redirect(`/admin/importar?tab=embeddings${space ? `&space=${space}` : ""}`);
}
