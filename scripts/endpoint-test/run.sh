#!/usr/bin/env bash
# Testa todos os endpoints GET das tools ativas usando scripts/endpoint-test/fixture.json.
# Reporta só o status; NÃO executa escritas. Edite o fixture e rode de novo.
set -euo pipefail
cd "$(dirname "$0")/../.."
NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/endpoint-test/run.ts "$@"
