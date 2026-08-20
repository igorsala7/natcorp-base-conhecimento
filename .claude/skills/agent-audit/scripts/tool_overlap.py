#!/usr/bin/env python3
"""Mede sobreposicao semantica entre descricoes de tools.

Duas tools cuja descricao se parece sao duas tools que o modelo vai confundir.
Este script nao prova que ha confusao -- ele produz a lista curta de suspeitas
para o Claude analisar semanticamente e para voce cruzar com os erros do eval.

TF-IDF (palavra + char n-gram) roda offline e pega bem parafrase leve e
vocabulario compartilhado. Nao pega sinonimo puro; por isso o passo humano/LLM
depois e obrigatorio, nao opcional.

Uso:
    python scripts/tool_overlap.py --agent financeiro --top 15
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def tool_text(t: dict, include_params: bool) -> str:
    parts = [t["name"].replace("_", " "), t.get("description", "")]
    if include_params:
        schema = t.get("input_schema") or {}
        props = schema.get("properties", {}) if isinstance(schema, dict) else {}
        for pname, pdef in props.items():
            parts.append(pname.replace("_", " "))
            if isinstance(pdef, dict) and pdef.get("description"):
                parts.append(pdef["description"])
    return " ".join(parts)


def similarity(tools: list[dict], include_params: bool) -> np.ndarray:
    corpus = [tool_text(t, include_params) for t in tools]
    word = TfidfVectorizer(analyzer="word", ngram_range=(1, 2), sublinear_tf=True).fit_transform(corpus)
    char = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True).fit_transform(corpus)
    return 0.6 * cosine_similarity(word) + 0.4 * cosine_similarity(char)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--agents", default=".audit/agents.json")
    ap.add_argument("--agent", help="nome do agente; omitido = todos")
    ap.add_argument("--top", type=int, default=15)
    ap.add_argument("--threshold", type=float, default=0.40)
    ap.add_argument("--include-params", action="store_true")
    ap.add_argument("--out", default=".audit/overlap.json")
    args = ap.parse_args()

    data = json.loads(Path(args.agents).read_text(encoding="utf-8"))
    agents = [a for a in data["agents"] if not args.agent or a["name"] == args.agent]
    if not agents:
        print(f"ERRO: agente '{args.agent}' nao encontrado.", file=sys.stderr)
        sys.exit(1)

    report = []
    for agent in agents:
        tools = agent.get("tools", [])
        if len(tools) < 2:
            continue

        sim = similarity(tools, args.include_params)
        np.fill_diagonal(sim, 0.0)

        pairs = [
            {"a": tools[i]["name"], "b": tools[j]["name"], "score": round(float(sim[i, j]), 3)}
            for i in range(len(tools))
            for j in range(i + 1, len(tools))
        ]
        pairs.sort(key=lambda p: -p["score"])

        # Isolamento: quao distinta cada tool e da vizinha mais parecida.
        # Score alto = tool ambigua, candidata a fundir ou reescrever.
        isolation = [
            {"name": tools[i]["name"], "max_sim": round(float(sim[i].max()), 3),
             "nearest": tools[int(sim[i].argmax())]["name"]}
            for i in range(len(tools))
        ]
        isolation.sort(key=lambda x: -x["max_sim"])

        flagged = [p for p in pairs if p["score"] >= args.threshold]
        report.append(
            {
                "agent": agent["name"],
                "n_tools": len(tools),
                "acima_do_limiar": len(flagged),
                "top_pairs": pairs[: args.top],
                "tools_ambiguas": isolation[:10],
            }
        )

        print(f"\n=== {agent['name']} ({len(tools)} tools) ===")
        print(f"pares acima de {args.threshold}: {len(flagged)}")
        print(f"\n  top {args.top} pares mais parecidos:")
        for p in pairs[: args.top]:
            mark = "  <!!" if p["score"] >= args.threshold else ""
            print(f"    {p['score']:.3f}  {p['a']}  ~  {p['b']}{mark}")
        print("\n  tools menos distintas (revisar descricao):")
        for t in isolation[:6]:
            print(f"    {t['max_sim']:.3f}  {t['name']}  -> colide com {t['nearest']}")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n-> {out}")
    print("\nPROXIMO PASSO: TF-IDF nao pega sinonimo. Leia os pares acima do limiar")
    print("e julgue semanticamente quais realmente confundiriam um humano do dominio.")


if __name__ == "__main__":
    main()
