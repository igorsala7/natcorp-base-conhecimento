#!/usr/bin/env python3
"""Extrai prompts e definicoes de tools para um formato normalizado.

Fontes suportadas: Supabase (Postgres), arquivos no repo, ou ambos.
Saida: .audit/agents.json  -- consumido por todos os outros scripts.

Uso:
    python scripts/extract.py --config audit.config.yaml
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import sys
from pathlib import Path

import yaml


def _die(msg: str) -> None:
    print(f"ERRO: {msg}", file=sys.stderr)
    sys.exit(1)


def from_supabase(cfg: dict) -> list[dict]:
    """Le agentes/tools do Postgres do Supabase.

    Espera SUPABASE_DB_URL no ambiente (connection string direta, nao a anon key).
    As queries vem do config -- cada projeto tem seu proprio schema.
    """
    try:
        import psycopg
    except ImportError:
        _die("psycopg nao instalado. Rode: pip install 'psycopg[binary]'")

    dsn = os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        _die(
            "SUPABASE_DB_URL nao definido.\n"
            "  Supabase Dashboard > Project Settings > Database > Connection string (URI).\n"
            "  Use o pooler na porta 6543 se estiver atras de NAT/IPv4."
        )

    sql = cfg["supabase"]
    agents: dict[str, dict] = {}

    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(sql["agents_query"])
            cols = [d[0] for d in cur.description]
            for row in cur.fetchall():
                r = dict(zip(cols, row))
                agents[str(r["name"])] = {
                    "name": str(r["name"]),
                    "source": "supabase",
                    "system_prompt": r.get("system_prompt") or "",
                    "tools": [],
                }

            cur.execute(sql["tools_query"])
            cols = [d[0] for d in cur.description]
            for row in cur.fetchall():
                r = dict(zip(cols, row))
                agent_name = str(r["agent"])
                if agent_name not in agents:
                    agents[agent_name] = {
                        "name": agent_name,
                        "source": "supabase",
                        "system_prompt": "",
                        "tools": [],
                    }
                schema = r.get("input_schema")
                if isinstance(schema, str):
                    try:
                        schema = json.loads(schema)
                    except json.JSONDecodeError:
                        schema = {"_raw": schema}
                agents[agent_name]["tools"].append(
                    {
                        "name": str(r["name"]),
                        "description": r.get("description") or "",
                        "input_schema": schema or {},
                    }
                )

    return list(agents.values())


def from_files(cfg: dict, root: Path) -> list[dict]:
    """Le agentes de arquivos versionados no repo."""
    agents = []
    for spec in cfg["files"]["agents"]:
        prompt_path = root / spec["system_prompt"]
        if not prompt_path.exists():
            print(f"  aviso: {prompt_path} nao encontrado, pulando", file=sys.stderr)
            continue

        tools = []
        for pattern in spec.get("tools_glob", []):
            for path in sorted(glob.glob(str(root / pattern), recursive=True)):
                try:
                    data = json.loads(Path(path).read_text(encoding="utf-8"))
                except (json.JSONDecodeError, UnicodeDecodeError) as e:
                    print(f"  aviso: {path} ilegivel ({e}), pulando", file=sys.stderr)
                    continue
                for item in data if isinstance(data, list) else [data]:
                    if "name" in item:
                        tools.append(
                            {
                                "name": item["name"],
                                "description": item.get("description", ""),
                                "input_schema": item.get("input_schema")
                                or item.get("parameters")
                                or {},
                            }
                        )

        agents.append(
            {
                "name": spec["name"],
                "source": "files",
                "system_prompt": prompt_path.read_text(encoding="utf-8"),
                "tools": tools,
            }
        )
    return agents


def attach_samples(agents: list[dict], cfg: dict, root: Path) -> None:
    """Anexa amostras de RAG e ontologia, se configuradas.

    Necessario para medir o custo real de um turno, nao so do prompt estatico.
    """
    samples = cfg.get("samples", {})
    for agent in agents:
        s = samples.get(agent["name"], {})
        for key in ("rag_chunk", "ontology_block", "tool_result"):
            if key in s:
                path = root / s[key]
                agent[key] = path.read_text(encoding="utf-8") if path.exists() else ""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="audit.config.yaml")
    ap.add_argument("--out", default=".audit/agents.json")
    args = ap.parse_args()

    cfg_path = Path(args.config)
    if not cfg_path.exists():
        _die(f"{cfg_path} nao encontrado. Copie audit.config.example.yaml.")

    cfg = yaml.safe_load(cfg_path.read_text(encoding="utf-8"))
    root = cfg_path.parent.resolve()

    agents: list[dict] = []
    source = cfg.get("source", "files")
    if source in ("supabase", "both"):
        agents += from_supabase(cfg)
    if source in ("files", "both"):
        agents += from_files(cfg, root)

    if not agents:
        _die("nenhum agente extraido. Confira 'source' e as queries/paths no config.")

    attach_samples(agents, cfg, root)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"agents": agents}, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"OK -> {out}")
    for a in agents:
        print(f"  {a['name']:<24} {len(a['tools']):>3} tools  prompt={len(a['system_prompt']):>7} chars")


if __name__ == "__main__":
    main()
