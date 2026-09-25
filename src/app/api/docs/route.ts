import type { NextRequest } from "next/server";
import { buscar, OPTIONS as searchOPTIONS } from "@/app/api/v1/search/route";

/**
 * /api/docs — nome canônico da busca na documentação (híbrida), consumido
 * pela ferramenta interna NatDocs. Mesmo contrato e mesmo handler de
 * `/api/v1/search` (chave pública pk_), MAS sem exigir identidade: esta rota
 * não representa usuário de cliente, então não exige `track` — decisão
 * explícita do dono, não esquecimento. Consequência aceita: como não passa
 * `base`/`track` ao RAG, esta rota usa as documentações da CHAVE
 * (`key.space_ids`) e pode devolver documentação que a regra de uma base
 * excluiu; a exposição é para ferramenta interna, não para usuário de
 * cliente. Ver [[widget-and-api]] e a tarefa 4b do projeto 1.
 */
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  return buscar(req, { exigirIdentidade: false });
}
export const OPTIONS = searchOPTIONS;
