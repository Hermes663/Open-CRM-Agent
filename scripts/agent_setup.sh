#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT_DIR="$ROOT_DIR/packages/agent"
VENV_DIR="$AGENT_DIR/.venv"
READY_MARKER="$VENV_DIR/.autosales_dev_ready"

if [ ! -x "$VENV_DIR/bin/python" ] || [ ! -f "$READY_MARKER" ] || [ "$AGENT_DIR/pyproject.toml" -nt "$READY_MARKER" ]; then
  rm -rf "$VENV_DIR"
  python3 -m venv "$VENV_DIR"
  "$VENV_DIR/bin/pip" install -e "$AGENT_DIR[dev]"
  touch "$READY_MARKER"
fi
