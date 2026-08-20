#!/usr/bin/env python3
"""Contagem REAL de tokens por camada de contexto, via medicao diferencial.

Por que diferencial: estimativa por caractere erra feio em JSON Schema e em
portugues. A API count_tokens da Anthropic nao cobra e conta a requisicao
inteira -- inclusive o overhead de serializacao das tools, que e invisivel se
voce so medir o texto. Medindo requisicoes cumulativas e subtraindo, sai o
custo marginal exato de cada camada.

Uso:
    export ANTHROPIC_API_KEY=sk-ant-...
    python scripts/count_tokens.py --model claude-sonnet-4-6
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

PROBE = [{"role": "user", "content": "ok"}]


def get_client():
    try:
        from anthropic import Anthropic
    except ImportError:
        print("ERRO: pip install anthropic", file=sys.stderr)
        sys.exit(1)
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERRO: ANTHROPIC_API_KEY nao definido.", file=sys.stderr)
        sys.exit(1)
    return Anthropic()


def count(client, model: str, system: str = "", tools=None, messages=None) -> int:
    kwargs = {"model": model, "messages": messages or PROBE}
    if system:
        kwargs["system"] = system
    if tools:
        kwargs["tools"] = tools
    return client.messages.count_tokens(**kwargs).input_tokens


def as_api_tools(tools: list[dict]) -> list[dict]:
    out = []
    for t in tools:
        schema = t.get("input_schema") or {}
        if not isinstance(schema, dict) or "type" not in schema:
            schema = {"type": "object", "properties": schema if isinstance(schema, dict) else {}}
        out.append(
            {
                "name": t["name"],
                "description": t.get("description", ""),
                "input_schema": schema,
            }
        )
    return out


def audit_agent(client, model: str, agent: dict) -> dict:
    system = agent.get("system_prompt", "")
    tools = as_api_tools(agent.get("tools", []))

    baseline = count(client, model)
    with_system = count(client, model, system=system)
    with_tools = count(client, model, system=system, tools=tools)

    layers = {
        "overhead_base": baseline,
        "system_prompt": with_system - baseline,
        "tool_schemas": with_tools - with_system,
    }

    # Camadas dinamicas: medidas como delta sobre o turno base.
    for key, label in (
        ("ontology_block", "ontologia"),
        ("rag_chunk", "rag_chunk"),
        ("tool_result", "tool_result"),
    ):
        blob = agent.get(key)
        if blob:
            msgs = [{"role": "user", "content": blob + "\nok"}]
            layers[label] = count(client, model, system=system, tools=tools, messages=msgs) - with_tools

    # Custo por tool, para achar as gordas. Cada uma medida sozinha.
    per_tool = []
    empty_sys = count(client, model)
    for t in tools:
        per_tool.append({"name": t["name"], "tokens": count(client, model, tools=[t]) - empty_sys})
    per_tool.sort(key=lambda x: -x["tokens"])

    return {
        "agent": agent["name"],
        "n_tools": len(tools),
        "layers": layers,
        "turno_minimo": with_tools,
        "per_tool": per_tool,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--agents", default=".audit/agents.json")
    ap.add_argument("--model", default="claude-sonnet-4-6")
    ap.add_argument("--out", default=".audit/tokens.json")
    args = ap.parse_args()

    data = json.loads(Path(args.agents).read_text(encoding="utf-8"))
    client = get_client()

    results = []
    for agent in data["agents"]:
        print(f"medindo {agent['name']} ...", file=sys.stderr)
        results.append(audit_agent(client, args.model, agent))

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n{'agente':<22}{'tools':>6}{'system':>9}{'schemas':>9}{'turno min':>11}")
    print("-" * 57)
    for r in results:
        L = r["layers"]
        print(
            f"{r['agent']:<22}{r['n_tools']:>6}{L['system_prompt']:>9,}"
            f"{L['tool_schemas']:>9,}{r['turno_minimo']:>11,}"
        )

    print("\nTools mais caras (top 8 do maior agente):")
    biggest = max(results, key=lambda r: r["n_tools"])
    for t in biggest["per_tool"][:8]:
        print(f"  {t['tokens']:>6,}  {t['name']}")

    print(f"\n-> {out}")


if __name__ == "__main__":
    main()
