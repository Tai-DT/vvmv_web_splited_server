#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -x "$ROOT/.venv/bin/python" ]; then
  echo "Missing .venv. Create it with: uv venv --python python3"
  exit 1
fi

"$ROOT/.venv/bin/python" -m nbconvert \
  --to notebook \
  --execute "$ROOT/notebooks/01_ai_rule_mining_discovery.ipynb" \
  --output "$ROOT/notebooks/outputs/01_ai_rule_mining_discovery.executed.ipynb" \
  --ExecutePreprocessor.timeout=3600
