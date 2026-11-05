#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
VENV_PYTHON="$BACKEND_DIR/.venv/bin/python"

cd "$ROOT_DIR"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required. Install Python 3.10 or newer and run ./run.sh again." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required. Install Node.js 20.19+ and run ./run.sh again." >&2
  exit 1
fi

if [[ ! -x "$VENV_PYTHON" ]]; then
  python3 -m venv "$BACKEND_DIR/.venv"
fi
if ! "$VENV_PYTHON" -c 'import fastapi, dotenv, google.auth, sqlalchemy' >/dev/null 2>&1; then
  "$VENV_PYTHON" -m pip install -r "$BACKEND_DIR/requirements.txt"
fi
if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  npm --prefix "$FRONTEND_DIR" install
fi

created_env=false
if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  created_env=true
fi
if [[ ! -f "$FRONTEND_DIR/.env.local" ]]; then
  cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env.local"
  created_env=true
fi
if [[ "$created_env" == true ]]; then
  echo "Created local environment files. Set the same Google Web client ID in:" >&2
  echo "  backend/.env (GOOGLE_CLIENT_ID)" >&2
  echo "  frontend/.env.local (VITE_GOOGLE_CLIENT_ID)" >&2
  echo "Then run ./run.sh again." >&2
  exit 1
fi

if "$VENV_PYTHON" - <<'PY'
from pathlib import Path

def value(path, key):
    for line in Path(path).read_text(errors="ignore").splitlines():
        if line.strip().startswith(key + "="):
            return line.split("=", 1)[1].strip().strip("\"'")
    return ""

backend_id = value("backend/.env", "GOOGLE_CLIENT_ID")
frontend_id = value("frontend/.env.local", "VITE_GOOGLE_CLIENT_ID")
raise SystemExit(0 if backend_id and frontend_id and backend_id == frontend_id else 1)
PY
then
  :
else
  echo "Google sign-in needs the same non-empty client ID in backend/.env and frontend/.env.local." >&2
fi

if "$VENV_PYTHON" - <<'PY'
import urllib.request

try:
    urllib.request.urlopen("http://127.0.0.1:8000/api/v1/health", timeout=1)
except Exception:
    raise SystemExit(1)
raise SystemExit(0)
PY
then
  echo "Port 8000 is already serving an API. Stop that process before running ./run.sh." >&2
  exit 1
fi

echo "Starting ExPenny. Open http://localhost:5173 (API docs: http://localhost:8000/docs)."
(cd "$BACKEND_DIR" && exec .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000) &
backend_pid=$!
(cd "$FRONTEND_DIR" && exec npm run dev -- --host 127.0.0.1 --port 5173 --strictPort) &
frontend_pid=$!

cleanup() {
  kill "$backend_pid" "$frontend_pid" 2>/dev/null || true
  wait "$backend_pid" "$frontend_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

set +e
wait -n "$backend_pid" "$frontend_pid"
status=$?
set -e
exit "$status"
