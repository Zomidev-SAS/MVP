#!/usr/bin/env bash
# Panel Carrera Arango — actualizar VPS desde git (rama production)
# Preserva docker/.env y descarta cambios locales en código tracked.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

BRANCH="${DEPLOY_BRANCH:-production}"
ENV_FILE="$SCRIPT_DIR/.env"
COMPOSE=(docker compose -p carrera -f docker-compose.prod.yml --env-file "$ENV_FILE")

echo "==> Panel Carrera Arango update — rama: $BRANCH"

if [[ ! -d .git ]]; then
  echo "ERROR: no es un repositorio git ($REPO_ROOT)"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: falta docker/.env — copia .env.production.example y completa las variables."
  exit 1
fi

ENV_BACKUP="$(mktemp)"
cp "$ENV_FILE" "$ENV_BACKUP"
echo "==> docker/.env respaldado temporalmente"

git fetch origin "$BRANCH"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "==> Descartando cambios locales en archivos tracked..."
  git reset --hard HEAD
  git clean -fd -e docker/.env
fi

git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

cp "$ENV_BACKUP" "$ENV_FILE"
rm -f "$ENV_BACKUP"
echo "==> docker/.env restaurado"

cd "$SCRIPT_DIR"
"${COMPOSE[@]}" up -d --build

echo "==> Estado"
"${COMPOSE[@]}" ps

curl -s -o /dev/null -w "HTTP %{http_code}\n" http://172.17.0.1:8081/login || true
echo "==> Listo — https://carrera.zomidev.com"
