import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Roteamento por domínio próprio: uma requisição cujo Host casa com o
 * `custom_domain` de uma documentação PÚBLICA é reescrita para o portal dela
 * (`/docs/<slug>/…`), servindo a documentação "na raiz" do domínio do cliente.
 *
 * Roda no middleware (edge): a consulta vai à REST do Supabase com a chave
 * ANON — a RLS `spaces_public_read` garante que só espaço público resolve —
 * e fica em cache por instância (o mapa de domínios muda raramente).
 */
const TTL_MS = 5 * 60_000;
const cache = new Map<string, { slug: string | null; at: number }>();

function hostSemPorta(host: string | null): string | null {
  if (!host) return null;
  return host.split(":")[0]!.toLowerCase();
}

async function slugDoDominio(host: string): Promise<string | null> {
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.slug;
  let slug: string | null = null;
  try {
    const url =
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/spaces` +
      `?select=slug&custom_domain=eq.${encodeURIComponent(host)}&limit=1`;
    const res = await fetch(url, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
      },
    });
    if (res.ok) {
      const rows = (await res.json()) as { slug: string }[];
      slug = rows[0]?.slug ?? null;
    }
  } catch {
    slug = null; // rede indisponível: segue sem rewrite, nunca derruba a request
  }
  cache.set(host, { slug, at: Date.now() });
  return slug;
}

/**
 * Devolve o rewrite quando a request pertence a um domínio próprio; null para
 * o fluxo normal. Rotas do app (admin, api, assets) nunca são reescritas.
 */
export async function resolveCustomDomain(request: NextRequest): Promise<NextResponse | null> {
  const host = hostSemPorta(request.headers.get("host"));
  if (!host) return null;

  const siteHost = hostSemPorta(new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost").host);
  if (host === siteHost || host === "localhost" || host === "127.0.0.1") return null;

  const { pathname } = request.nextUrl;
  // API continua funcionando no domínio próprio (widget/chat); admin não é
  // servido em domínio de cliente — regra de ouro da separação.
  if (pathname.startsWith("/api/")) return null;
  if (pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL(`${process.env.NEXT_PUBLIC_SITE_URL}/admin`, request.url));
  }

  const slug = await slugDoDominio(host);
  if (!slug) return null;

  // Já no formato /docs/<slug>/… (links internos absolutos): deixa passar.
  if (pathname === `/docs/${slug}` || pathname.startsWith(`/docs/${slug}/`)) return null;

  const destino = request.nextUrl.clone();
  destino.pathname = `/docs/${slug}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(destino);
}
