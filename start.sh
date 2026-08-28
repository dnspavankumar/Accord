#!/usr/bin/env bash

set -Eeuo pipefail

APP_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

if [[ -x "$APP_ROOT/.venv/bin/python" ]]; then
  PYTHON_BIN="$APP_ROOT/.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3)"
else
  echo "Error: Python 3 was not found. Create .venv or install Python 3." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm was not found. Install Node.js and npm." >&2
  exit 1
fi

if [[ ! -d "$APP_ROOT/frontend/node_modules" ]]; then
  echo "Installing frontend dependencies..."
  (cd "$APP_ROOT/frontend" && npm install)
fi

backend_pid=""
frontend_pid=""

cleanup() {
  trap - EXIT INT TERM
  [[ -n "$backend_pid" ]] && kill "$backend_pid" 2>/dev/null || true
  [[ -n "$frontend_pid" ]] && kill "$frontend_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting Accord backend at http://localhost:${BACKEND_PORT}"
(
  cd "$APP_ROOT"
  "$PYTHON_BIN" -m uvicorn backend.app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload
) &
backend_pid=$!

echo "Starting Accord frontend at http://localhost:${FRONTEND_PORT}"
(
  cd "$APP_ROOT/frontend"
  npm run dev -- --port "$FRONTEND_PORT"
) &
frontend_pid=$!

echo "Accord is running. Press Ctrl+C to stop both services."
wait -n "$backend_pid" "$frontend_pid"
exit $?
