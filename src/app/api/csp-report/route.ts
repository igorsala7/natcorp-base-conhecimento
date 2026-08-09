import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Coletor das violações de CSP.
 *
 * Existe porque a política do projeto era `report-only` **sem destino**, e o
 * próprio navegador avisava: "does not specify a 'report-to'; the policy will
 * have no effect". Ou seja, a primeira volta de medição — que era justamente o
 * motivo de a CSP não bloquear nada — nunca chegou a medir. Sem este endpoint,
 * ligar o bloqueio seria adivinhação.
 *
 * Aceita os dois formatos porque os navegadores não convergiram: Chrome manda
 * `application/reports+json` (um ARRAY, Reporting API v1) e Safari/Firefox
 * mandam `application/csp-report` (um OBJETO com `csp-report`). Tratar só um
 * deixaria metade da frota sem dado.
 */

type ViolacaoBruta = Record<string, unknown>;

const txt = (v: unknown): string => (typeof v === "string" && v.trim() ? v.trim() : "");

/** Achata os dois formatos numa forma só. */
function extrair(payload: unknown): ViolacaoBruta[] {
  if (Array.isArray(payload)) {
    // Reporting API: [{ type: "csp-violation", body: {...} }]
    return payload
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
      .filter((r) => !r.type || r.type === "csp-violation")
      .map((r) => (r.body && typeof r.body === "object" ? (r.body as ViolacaoBruta) : r));
  }
  if (payload && typeof payload === "object") {
    const legado = (payload as { "csp-report"?: unknown })["csp-report"];
    if (legado && typeof legado === "object") return [legado as ViolacaoBruta];
    return [payload as ViolacaoBruta];
  }
  return [];
}

/**
 * Ruído recorrente que não diz respeito à aplicação: extensão de navegador,
 * injeção de tradutor, `about:blank`. Sem esse corte, o log vira uma parede de
 * `chrome-extension://` e a violação real se perde no meio.
 */
function ehRuido(diretiva: string, alvo: string): boolean {
  if (!diretiva) return true;
  return /^(chrome|moz|safari|webkit)-extension:|^about:|^data:text\/html|^blob:null/i.test(alvo);
}

/**
 * Uma linha por combinação distinta, por processo. A mesma página gera a mesma
 * violação a cada carregamento; sem a memória, um único usuário navegando
 * encheria o log e escondagria a variedade, que é o dado que interessa.
 */
const vistos = new Set<string>();
const TETO = 500;

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const payload: unknown = await req.json().catch(() => null);
    for (const v of extrair(payload)) {
      const diretiva = txt(v["effective-directive"]) || txt(v.effectiveDirective) || txt(v["violated-directive"]);
      const alvo = txt(v["blocked-uri"]) || txt(v.blockedURL) || "(inline)";
      const origem = txt(v["document-uri"]) || txt(v.documentURL);
      if (ehRuido(diretiva, alvo)) continue;

      const chave = `${diretiva}|${alvo}`;
      if (vistos.has(chave)) continue;
      if (vistos.size < TETO) vistos.add(chave);

      // Prefixo fixo para dar `grep` no log do container.
      console.warn(`[csp] ${diretiva} bloquearia ${alvo}  (em ${origem || "?"})`);
    }
  } catch {
    // Um relatório malformado nunca pode virar erro visível: o navegador o
    // reenviaria, e não há nada que o usuário possa fazer a respeito.
  }
  // 204: o navegador não lê o corpo, e devolver conteúdo só gasta banda.
  return new Response(null, { status: 204 });
}
