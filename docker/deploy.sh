#!/usr/bin/env bash
# Build + arranque local en VPS (sin git pull).
# Para actualizar desde GitHub usa: ./update.sh (rama production).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENV_FILE="${ENV_FILE:-.env}"
COMPOSE=(docker compose -p carrera -f docker-compose.prod.yml --env-file "$ENV_FILE")
BRANCH="${DEPLOY_BRANCH:-production}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: falta $ENV_FILE — copia .env.production.example y completa las variables."
  exit 1
fi

if [[ -d "$SCRIPT_DIR/../.git" ]]; then
  current="$(git -C "$SCRIPT_DIR/.." rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
  if [[ "$current" != "$BRANCH" ]]; then
    echo "AVISO: estás en la rama '$current'; el VPS debe desplegar desde '$BRANCH'."
  fi
fi

echo "==> Panel Carrera Arango — deploy carrera.zomidev.com (rama objetivo: $BRANCH)"
"${COMPOSE[@]}" up -d --build

echo "==> Estado"
"${COMPOSE[@]}" ps

echo "==> Health check (desde el VPS)"
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://172.17.0.1:8081/login || true

echo "==> Listo. Verifica https://carrera.zomidev.com/login"
