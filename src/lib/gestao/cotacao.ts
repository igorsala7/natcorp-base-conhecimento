import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cotação USD→BRL para exibir o preço do crédito em reais.
 *
 * ── Três camadas, nesta ordem ──────────────────────────────────────────
 *   1. `ai_cotacao_cambio` do dia   — uma consulta local, sem rede
 *   2. API externa                  — grava o resultado na tabela
 *   3. última cotação conhecida     — marcada como DEFASADA na tela
 *
 * A camada 3 existe porque o container pode não ter saída para internet, e uma
 * tela de faturamento que quebra por causa do câmbio é pior que uma tela que
 * mostra o valor em dólar com um aviso. O que ela NUNCA faz é inventar um
 * número: sem nenhuma cotação, devolve `null` e a tela mostra só o dólar —
 * mesmo princípio do `custo_usd` nulo em `faturamento_detalhe`, onde exibir
 * zero passaria por lucro que não existe.
 *
 * ── Por que o dia é o de São Paulo ─────────────────────────────────────
 * A fatura fecha no fuso do cliente. Usar UTC colocaria as consultas das
 * primeiras horas da noite no dia seguinte, e a cotação "do dia do fechamento"
 * seria a de outro dia.
 */

/**
 * Fontes, em ordem de tentativa. Todas SEM chave de API — de propósito: uma
 * chave a mais é uma coisa a mais para vencer, girar e vazar, e a cotação
 * comercial do dólar não é dado exclusivo de ninguém.
 *
 * Conferidas em 08/09/2026, quando as duas primeiras escolhas falharam:
 *   · exchangerate.host  passou a exigir `access_key` (erro 101) — fora
 *   · awesomeapi         devolveu 429 QuotaExceeded no IP do servidor
 * As três abaixo responderam, e as duas primeiras concordaram em R$ 5,126.
 *
 * A awesomeapi fica como última tentativa em vez de sair: é brasileira, tem a
 * cotação comercial do dia, e a quota é por IP — pode voltar a funcionar.
 */
const FONTES = [
  {
    nome: "open.er-api.com",
    url: "https://open.er-api.com/v6/latest/USD",
    extrair: (j: unknown): number | null => {
      const v = (j as { rates?: { BRL?: number } })?.rates?.BRL;
      return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
    },
  },
  {
    nome: "frankfurter",
    // Responde 301 para o host novo; `fetch` segue redirect por padrão.
    url: "https://api.frankfurter.app/latest?from=USD&to=BRL",
    extrair: (j: unknown): number | null => {
      const v = (j as { rates?: { BRL?: number } })?.rates?.BRL;
      return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
    },
  },
  {
    nome: "awesomeapi",
    url: "https://economia.awesomeapi.com.br/json/last/USD-BRL",
    extrair: (j: unknown): number | null => {
      const v = (j as { USDBRL?: { bid?: string } })?.USDBRL?.bid;
      const n = v ? Number(v) : NaN;
      return Number.isFinite(n) && n > 0 ? n : null;
    },
  },
] as const;

const TIMEOUT_MS = 4000;

export type Cotacao = {
  usdBrl: number;
  dia: string;
  fonte: string;
  /** Verdadeiro quando a cotação não é de hoje (rede indisponível). */
  defasada: boolean;
};

/** Data no fuso de São Paulo, formato ISO (YYYY-MM-DD). */
export function diaSaoPaulo(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

async function buscarNaRede(): Promise<{ valor: number; fonte: string } | null> {
  for (const f of FONTES) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const res = await fetch(f.url, { signal: ctrl.signal, cache: "no-store" });
      clearTimeout(t);
      if (!res.ok) continue;
      const valor = f.extrair(await res.json());
      if (valor !== null) return { valor, fonte: f.nome };
    } catch {
      // Rede fora, DNS bloqueado, timeout: tenta a próxima fonte. Uma falha de
      // câmbio nunca pode derrubar a página de faturamento.
    }
  }
  return null;
}

/**
 * Cotação de hoje, buscando na rede só quando a tabela ainda não tem o dia.
 *
 * `forcar` ignora o cache do dia — usado no fechamento da fatura, onde vale a
 * pena pagar a ida à rede para congelar o valor mais recente possível.
 */
export async function cotacaoDeHoje(forcar = false): Promise<Cotacao | null> {
  const supabase = createAdminClient();
  const hoje = diaSaoPaulo();

  if (!forcar) {
    const { data } = await supabase
      .from("ai_cotacao_cambio")
      .select("dia, usd_brl, fonte")
      .eq("dia", hoje)
      .maybeSingle();
    if (data) {
      return { usdBrl: Number(data.usd_brl), dia: data.dia, fonte: data.fonte, defasada: false };
    }
  }

  const novo = await buscarNaRede();
  if (novo) {
    // `upsert` e não `insert`: duas requisições simultâneas no primeiro acesso
    // do dia correriam para gravar a mesma linha, e a segunda estouraria a PK.
    await supabase
      .from("ai_cotacao_cambio")
      .upsert(
        { dia: hoje, usd_brl: novo.valor, fonte: novo.fonte, obtido_em: new Date().toISOString() },
        { onConflict: "dia" },
      );
    return { usdBrl: novo.valor, dia: hoje, fonte: novo.fonte, defasada: false };
  }

  // Rede indisponível: a última que temos, marcada como defasada.
  const { data: ultima } = await supabase
    .from("ai_cotacao_cambio")
    .select("dia, usd_brl, fonte")
    .order("dia", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ultima) return null;
  return {
    usdBrl: Number(ultima.usd_brl),
    dia: ultima.dia,
    fonte: ultima.fonte,
    defasada: ultima.dia !== hoje,
  };
}

/** Converte dólar em real, ou `null` quando não há cotação — nunca chuta. */
export function emReais(usd: number, c: Cotacao | null): number | null {
  return c ? Math.round(usd * c.usdBrl * 100) / 100 : null;
}
