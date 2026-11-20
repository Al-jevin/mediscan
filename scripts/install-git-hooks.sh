#!/usr/bin/env sh
# One-command MediScan hook setup (Windows Git Bash, macOS, Linux, WSL).
set -eu

REPO_ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

git config core.hooksPath .githooks
chmod +x .githooks/pre-commit .githooks/post-merge .githooks/pre-push 2>/dev/null || true

echo "core.hooksPath -> .githooks"
echo "Verify with: git config --get core.hooksPath"
echo "Ensure Postgres is reachable (Docker or local) before committing so pre-commit can refresh mediscan_full.sql."
