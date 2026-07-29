import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPortalAccess } from "@/lib/portal/data";
import { IaView } from "./ia-view";

/**
 * /ia/[space] — página CHEIA do assistente de IA da documentação (link separado
 * do /docs, item #6). Mesmas regras de acesso do portal (getPortalAccess).
 */
export async function generateMetadata({ params }: { params: Promise<{ space: string }> }): Promise<Metadata> {
  const { space } = await params;
  const access = await getPortalAccess(space);
  return { title: access ? `Assistente — ${access.space.name}` : "Assistente" };
}

export default async function IaPage({ params }: { params: Promise<{ space: string }> }) {
  const { space } = await params;
  const access = await getPortalAccess(space);
  if (!access) notFound();
  return <IaView spaceSlug={access.space.slug} spaceName={access.space.name} />;
}
