#!/usr/bin/env python3
"""Analisa traces de execucao: iteracoes do loop, crescimento de contexto, cache.

Este e o script que responde "por que uma mensagem simples custou 90k tokens".
Um turno de usuario nao e uma chamada ao modelo. Se o modelo chama duas tools,
sao tres chamadas, e cada uma reenvia o contexto inteiro -- que ainda cresce a
cada iteracao porque carrega o resultado da anterior.

Formato esperado (um JSON por linha, uma linha por CHAMADA ao modelo):
  {"turn_id":"t1","agent":"financeiro","seq":0,
   "input_tokens":31200,"output_tokens":85,
   "cache_read_input_tokens":0,"cache_creation_input_tokens":0,
   "n_tools_offered":40,"tool_calls":["buscar_historico"]}

Uso:
    python scripts/trace_analysis.py --traces .audit/traces.jsonl
    python scripts/trace_analysis.py --from-supabase   # usa audit.config.yaml
"""
from __future__ import annotations

import argparse
import json
import os
import statistics as st
import sys
from collections import defaultdict
from pathlib import Path


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            print(f"  aviso: linha {n} invalida, pulando", file=sys.stderr)
    return rows


def load_supabase(config_path: Path) -> list[dict]:
    import yaml

    try:
        import psycopg
    except ImportError:
        print("ERRO: pip install 'psycopg[binary]'", file=sys.stderr)
        sys.exit(1)

    cfg = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    query = cfg["supabase"]["traces_query"]
    dsn = os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        print("ERRO: SUPABASE_DB_URL nao definido.", file=sys.stderr)
        sys.exit(1)

    with psycopg.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute(query)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def analyse(rows: list[dict]) -> dict:
    turns: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        turns[str(r["turn_id"])].append(r)

    summary = []
    for tid, calls in turns.items():
        calls.sort(key=lambda c: c.get("seq", 0))
        billed = [int(c.get("input_tokens", 0)) for c in calls]
        cached = [int(c.get("cache_read_input_tokens", 0)) for c in calls]
        # Contexto real que o modelo leu = cobrado + lido do cache.
        # Sem somar o cache, um sistema bem cacheado parece pequeno e voce
        # perde de vista que a janela continua cheia.
        ctx = [b + c for b, c in zip(billed, cached)]

        summary.append(
            {
                "turn_id": tid,
                "agent": calls[0].get("agent", "?"),
                "n_calls": len(calls),
                "contexto_por_chamada": ctx,
                "contexto_total": sum(ctx),
                "billed_total": sum(billed),
                "cache_read_total": sum(cached),
                "crescimento": ctx[-1] - ctx[0] if len(ctx) > 1 else 0,
                "tools_ofertadas": calls[0].get("n_tools_offered"),
                "tools_usadas": sorted({t for c in calls for t in (c.get("tool_calls") or [])}),
            }
        )

    summary.sort(key=lambda s: -s["contexto_total"])
    return {"turns": summary, "n_turns": len(summary)}


def report(res: dict, top: int) -> None:
    turns = res["turns"]
    if not turns:
        print("Nenhum turno encontrado.")
        return

    ctx = [t["contexto_total"] for t in turns]
    calls = [t["n_calls"] for t in turns]
    billed = sum(t["billed_total"] for t in turns)
    cache_read = sum(t["cache_read_total"] for t in turns)
    total_ctx = billed + cache_read

    print(f"\n{'='*62}\nRESUMO  ({res['n_turns']} turnos)\n{'='*62}")
    print(f"  contexto por turno   mediana {st.median(ctx):>10,.0f}   p90 {sorted(ctx)[int(len(ctx)*0.9)-1]:>10,.0f}   max {max(ctx):>10,.0f}")
    print(f"  chamadas por turno   mediana {st.median(calls):>10,.1f}   max {max(calls):>10}")
    print(f"  taxa de cache        {cache_read/total_ctx*100 if total_ctx else 0:>10.1f}%  ({cache_read:,} de {total_ctx:,})")

    print(f"\n{'='*62}\nTOP {top} TURNOS MAIS CAROS\n{'='*62}")
    for t in turns[:top]:
        print(f"\n  {t['turn_id']}  [{t['agent']}]  {t['n_calls']} chamadas  total {t['contexto_total']:,}")
        print(f"    por chamada: {' -> '.join(f'{c:,}' for c in t['contexto_por_chamada'])}")
        if t["tools_usadas"]:
            print(f"    tools: {', '.join(t['tools_usadas'])}")

    print(f"\n{'='*62}\nDIAGNOSTICO\n{'='*62}")
    findings = []

    if cache_read == 0:
        findings.append(
            ("CRITICO", "cache de prompt nao esta pegando (0 tokens lidos do cache). "
                        "Rode cache_check.py -- prefixo instavel e a causa mais comum.")
        )
    elif total_ctx and cache_read / total_ctx < 0.5:
        findings.append(
            ("ALTO", f"taxa de cache em {cache_read/total_ctx*100:.0f}%. Com loop multi-chamada "
                     "deveria passar de 70%. Prefixo provavelmente quebra entre iteracoes.")
        )

    multi = [t for t in turns if t["n_calls"] >= 3]
    if multi:
        findings.append(
            ("ALTO", f"{len(multi)} de {len(turns)} turnos com 3+ chamadas ao modelo. "
                     "O loop e o multiplicador principal do custo.")
        )

    sem_tool = [t for t in turns if t["n_calls"] > 1 and not t["tools_usadas"]]
    if sem_tool:
        findings.append(
            ("ALTO", f"{len(sem_tool)} turnos gastaram multiplas chamadas SEM chamar tool nenhuma. "
                     "Iteracao desperdicada -- suspeite de instrucao do tipo 'verifique antes de responder'.")
        )

    inchados = [t for t in turns if t["crescimento"] > 15000]
    if inchados:
        findings.append(
            ("MEDIO", f"{len(inchados)} turnos cresceram +15k tokens entre a primeira e a ultima "
                      "chamada. Resultado de tool sendo reenviado inteiro. Trunque para digest.")
        )

    ofertadas = [t["tools_ofertadas"] for t in turns if t.get("tools_ofertadas")]
    if ofertadas and max(ofertadas) > 15:
        usadas = st.median([len(t["tools_usadas"]) for t in turns]) or 0
        findings.append(
            ("ALTO", f"ate {max(ofertadas)} tools ofertadas por chamada, mediana de {usadas:.0f} usada(s). "
                     "Carregamento condicional por dominio corta isso sem perder alcance.")
        )

    if not findings:
        print("  Nada gritante. Compare com os limiares em references/thresholds.md.")
    for sev, msg in findings:
        print(f"\n  [{sev}] {msg}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--traces", default=".audit/traces.jsonl")
    ap.add_argument("--from-supabase", action="store_true")
    ap.add_argument("--config", default="audit.config.yaml")
    ap.add_argument("--top", type=int, default=5)
    ap.add_argument("--out", default=".audit/traces_report.json")
    args = ap.parse_args()

    if args.from_supabase:
        rows = load_supabase(Path(args.config))
    else:
        path = Path(args.traces)
        if not path.exists():
            print(f"ERRO: {path} nao existe. Veja references/instrumentation.md "
                  "para instrumentar o loop antes de auditar.", file=sys.stderr)
            sys.exit(1)
        rows = load_jsonl(path)

    res = analyse(rows)
    report(res, args.top)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n-> {out}")


if __name__ == "__main__":
    main()
