/**
 * Tetos do trace — poda por CAMPO e recorte do que sai para o navegador.
 *
 * Vive fora de `trace.ts` porque aquele módulo importa `server-only` e não pode
 * ser testado direto. Aqui é tudo puro.
 *
 * ── Por que a poda mudou ────────────────────────────────────────────────────
 * A regra antiga era "info maior que 4000 chars ⇒ vira `{_truncado:true}`".
 * Isso apagava o passo INTEIRO — inclusive qual ferramenta foi chamada e com
 * quais parâmetros — exatamente no caso mais difícil de depurar: o POST com
 * corpo grande. Perder o cURL de uma chamada de 3 KB é aceitável; perder o nome
 * da ferramenta junto não é.
 *
 * A regra nova corta do MAIOR campo para o menor até caber, e nunca encosta nos
 * campos de identidade do passo.
 */

export type Info = Record<string, unknown>;

/** Campos que sobrevivem a qualquer poda: são a identidade do passo. */
const INTOCAVEIS = new Set(["tool", "familia", "status", "ms", "ok", "erro", "cache", "requisicoes"]);

/** Teto por campo, aplicado antes de considerar remover o campo inteiro. */
const TETO_CAMPO: Record<string, number> = { curl: 1500, params: 800 };
const TETO_CAMPO_PADRAO = 300;

function tamanho(info: Info): number {
  try {
    return JSON.stringify(info)?.length ?? 0;
  } catch {
    return Infinity;
  }
}

function cortarValor(v: unknown, teto: number): unknown {
  if (typeof v === "string") return v.length > teto ? v.slice(0, teto) + "…" : v;
  try {
    const s = JSON.stringify(v) ?? "";
    if (s.length <= teto) return v;
    return { _cortado: true, texto: s.slice(0, teto) + "…" };
  } catch {
    return { _cortado: true };
  }
}

/**
 * Poda `info` até caber em `teto` chars de JSON, preservando os campos de
 * identidade. Declara o que foi podado em `_podado` — um log que corta em
 * silêncio faz o leitor tirar conclusão errada do que não está lá.
 */
export function podarInfo(info: Info | undefined, teto: number): Info | undefined {
  if (!info) return info;
  if (tamanho(info) <= teto) return info;

  const out: Info = { ...info };
  const podado: string[] = [];

  // 1ª passada: cortar cada campo grande no seu teto (mantém todos os campos).
  const porTamanho = Object.keys(out)
    .filter((k) => !INTOCAVEIS.has(k))
    .map((k) => ({ k, n: (() => { try { return JSON.stringify(out[k])?.length ?? 0; } catch { return Infinity; } })() }))
    .sort((a, b) => b.n - a.n);

  for (const { k } of porTamanho) {
    if (tamanho(out) <= teto) break;
    const antes = out[k];
    const depois = cortarValor(antes, TETO_CAMPO[k] ?? TETO_CAMPO_PADRAO);
    if (depois !== antes) {
      out[k] = depois;
      podado.push(k);
    }
  }

  // 2ª passada: se ainda não coube, remover os campos podáveis do maior ao menor.
  for (const { k } of porTamanho) {
    if (tamanho(out) <= teto) break;
    delete out[k];
    if (!podado.includes(k)) podado.push(k);
  }

  if (podado.length) out._podado = podado;
  return out;
}

/** Passo do trace (espelha `TracePasso` de trace.ts, sem depender dele). */
export type PassoLike = { ms: number; passo: string; info?: Info };

/** Campos que NUNCA saem do servidor (ver `passosPublicos`). */
const CAMPOS_SO_SERVIDOR = ["curl"];

/**
 * Recorte do trace que pode ir para o NAVEGADOR.
 *
 * `/api/v1/chat` é rota pública: autenticada por chave `pk_` que está no HTML da
 * página host, com allowlist de Origin (forjável fora do navegador). O cURL
 * carrega o endereço interno da API, os parâmetros e os nomes dos cabeçalhos —
 * mandar isso ao cliente é entregar o mapa da superfície interna a qualquer um
 * que copie a chave da página. O passo continua íntegro no banco, para o
 * `/admin/logs`; só o campo `curl` é removido do que trafega.
 *
 * O resto do trace segue indo ao console do widget: é ferramenta de diagnóstico
 * e não expõe endereço nem credencial.
 */
export function passosPublicos(passos: PassoLike[]): PassoLike[] {
  return passos.map((p) => {
    if (!p.info) return p;
    let mexeu = false;
    const info: Info = {};
    for (const [k, v] of Object.entries(p.info)) {
      if (CAMPOS_SO_SERVIDOR.includes(k)) {
        mexeu = true;
        continue;
      }
      info[k] = v;
    }
    if (!mexeu) return p;
    return { ...p, info: { ...info, _servidor: CAMPOS_SO_SERVIDOR.filter((k) => k in p.info!) } };
  });
}
