import { POST as chatPOST, OPTIONS as chatOPTIONS } from "@/app/api/v1/chat/route";

/**
 * /api/ia — nome canônico do chat com IA (RAG). Encaminha para a lógica de
 * `/api/v1/chat` (mesma contrato: chave pública pk_ + SSE). A rota v1 continua
 * funcionando como alias legado. Ver [[widget-and-api]].
 */
export const runtime = "nodejs";
export const POST = chatPOST;
export const OPTIONS = chatOPTIONS;
