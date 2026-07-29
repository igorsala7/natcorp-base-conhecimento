import { POST as searchPOST, OPTIONS as searchOPTIONS } from "@/app/api/v1/search/route";

/**
 * /api/docs — nome canônico da busca na documentação (híbrida). Encaminha para a
 * lógica de `/api/v1/search` (mesmo contrato: chave pública pk_). A rota v1
 * continua funcionando como alias legado. Ver [[widget-and-api]].
 */
export const runtime = "nodejs";
export const POST = searchPOST;
export const OPTIONS = searchOPTIONS;
