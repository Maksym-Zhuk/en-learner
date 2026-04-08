#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_URL="${EN_LEARNER_FRONTEND_URL:-http://127.0.0.1:5173}"
FRONTEND_LOG="${EN_LEARNER_FRONTEND_LOG:-/tmp/en-learner-frontend-dev.log}"
FRONTEND_PID=""

cleanup() {
    if [[ -n "${FRONTEND_PID}" ]] && kill -0 "${FRONTEND_PID}" 2>/dev/null; then
        kill "${FRONTEND_PID}" 2>/dev/null || true
        wait "${FRONTEND_PID}" 2>/dev/null || true
    fi
}

wait_for_frontend() {
    local attempts=0

    until curl -fsS "${FRONTEND_URL}" >/dev/null 2>&1; do
        attempts=$((attempts + 1))

        if [[ "${attempts}" -ge 60 ]]; then
            echo "Frontend dev server did not become ready at ${FRONTEND_URL}."
            echo "If Vite failed, check ${FRONTEND_LOG}."
            return 1
        fi

        sleep 1
    done
}

trap cleanup EXIT INT TERM

if curl -fsS "${FRONTEND_URL}" >/dev/null 2>&1; then
    echo "Reusing frontend dev server at ${FRONTEND_URL}"
else
    echo "Starting frontend dev server at ${FRONTEND_URL}"
    (
        cd "${ROOT_DIR}"
        npm run dev --workspace=apps/frontend
    ) >"${FRONTEND_LOG}" 2>&1 &
    FRONTEND_PID=$!
    wait_for_frontend
fi

echo "Building desktop shell"
cmake -S "${ROOT_DIR}/apps/desktop" -B "${ROOT_DIR}/apps/desktop/build"
cmake --build "${ROOT_DIR}/apps/desktop/build"

echo "Launching desktop shell"
EN_LEARNER_FRONTEND_URL="${FRONTEND_URL}" \
"${ROOT_DIR}/apps/desktop/build/en-learner"
