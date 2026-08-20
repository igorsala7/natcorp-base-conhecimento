#!/usr/bin/env python3
"""Verifica se o prefixo de cache e realmente estavel entre requisicoes.

Cache de prompt casa por PREFIXO exato. Um unico byte diferente antes do
breakpoint invalida tudo dali para frente. O jeito classico de perder o cache
inteiro sem perceber: colocar data, nome do usuario, session id ou um dict
serializado com ordem instavel no topo do system prompt.

Este script pega duas ou mais requisicoes capturadas em turnos diferentes,
acha o ponto exato onde elas divergem, e diz quanto do prefixo era cacheavel.

Uso:
    python scripts/cache_check.py .audit/req_turno1.json .audit/req_turno2.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def serialize_prefix(req: dict) -> tuple[str, list[tuple[int, str]]]:
    """Reconstroi o prefixo na ordem em que a API o ve: system, depois tools."""
    parts: list[tuple[int, str]] = []
    buf = []
    cursor = 0

    system = req.get("system", "")
    if isinstance(system, list):
        system = "".join(b.get("text", "") for b in system if isinstance(b, dict))
    buf.append(system)
    parts.append((cursor, "system_prompt"))
    cursor += len(system)

    for tool in req.get("tools", []) or []:
        blob = json.dumps(tool, ensure_ascii=False, sort_keys=True)
        buf.append(blob)
        parts.append((cursor, f"tool:{tool.get('name','?')}"))
        cursor += len(blob)

    return "".join(buf), parts


def common_prefix_len(a: str, b: str) -> int:
    n = min(len(a), len(b))
    lo, hi = 0, n
    while lo < hi:  # busca binaria: prefixos aqui passam de 100k chars
        mid = (lo + hi + 1) // 2
        if a[:mid] == b[:mid]:
            lo = mid
        else:
            hi = mid - 1
    return lo


def locate(pos: int, parts: list[tuple[int, str]]) -> str:
    label = "inicio"
    for start, name in parts:
        if start <= pos:
            label = name
        else:
            break
    return label


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("requests", nargs="+", help="2+ arquivos JSON de requisicoes capturadas")
    ap.add_argument("--context", type=int, default=90)
    args = ap.parse_args()

    if len(args.requests) < 2:
        print("ERRO: informe pelo menos 2 requisicoes de turnos diferentes.", file=sys.stderr)
        sys.exit(1)

    reqs = [json.loads(Path(p).read_text(encoding="utf-8")) for p in args.requests]
    prefixes = [serialize_prefix(r) for r in reqs]

    base, parts = prefixes[0]
    shared = len(base)
    for other, _ in prefixes[1:]:
        shared = min(shared, common_prefix_len(base, other))

    pct = shared / len(base) * 100 if base else 0
    print(f"\nprefixo total (req 1) : {len(base):>9,} chars")
    print(f"prefixo comum a todas : {shared:>9,} chars  ({pct:.1f}%)")
    print(f"diverge em            : {locate(shared, parts)}")

    if shared < len(base):
        lo = max(0, shared - args.context)
        print("\n--- contexto da divergencia ---")
        print(f"  antes  : ...{base[lo:shared]}")
        for i, (p, _) in enumerate(prefixes, 1):
            print(f"  req {i}  : >>>{p[shared:shared+args.context]}...")

    print("\n" + "=" * 62)
    if pct >= 99:
        print("OK. Prefixo estavel -- o cache deve estar pegando.")
        print("Se traces mostram cache_read = 0 mesmo assim, verifique se o")
        print("cache_control esta sendo enviado e se o TTL cobre seu intervalo.")
    elif pct >= 60:
        print("PARCIAL. Ha conteudo volatil no meio do prefixo estavel.")
        print(f"Mova o que muda para DEPOIS de '{locate(shared, parts)}'.")
    else:
        print("QUEBRADO. Quase nada e cacheavel.")
        print("Reordene: [persona + regras + schemas] -> breakpoint -> [data,")
        print("usuario, sessao, ontologia resolvida, chunks de RAG, historico].")
    print("\nOrdem das tools tambem importa: se voce monta o array a partir de um")
    print("dict ou de um SELECT sem ORDER BY, a ordem varia entre processos e")
    print("mata o cache de forma intermitente -- o pior tipo de bug para achar.")


if __name__ == "__main__":
    main()
