#!/usr/bin/env bash
set -euo pipefail

# Deploy Graphiti to Fly.io (main or test environment)
# Both environments connect to Neo4j Aura (no Neo4j on Fly.io).
#
# Prerequisites:
#   - flyctl installed and authenticated (`fly auth login`)
#   - Environment variables: NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, OPENAI_API_KEY
#   - Optional: NEO4J_DATABASE (defaults to "neo4j" if not set)
#
# Usage:
#   cd services/knowledge-engine
#   ./deploy.sh main    # Deploy graphiti-main
#   ./deploy.sh test    # Deploy graphiti-test

ENV="${1:?Usage: ./deploy.sh <main|test>}"

if [[ "$ENV" != "main" && "$ENV" != "test" ]]; then
  echo "Error: environment must be 'main' or 'test'"
  exit 1
fi

APP_NAME="graphiti-${ENV}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/graphiti-${ENV}.fly.toml"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Error: config file not found: $CONFIG_FILE"
  exit 1
fi

echo "==> Deploying ${APP_NAME} to Fly.io"

echo "==> Step 1: Create app (if needed)"
fly apps create "$APP_NAME" --org the-focus-company 2>/dev/null || echo "App ${APP_NAME} already exists"

echo "==> Step 2: Set secrets"
SECRETS=(
  "NEO4J_URI=${NEO4J_URI:?Set NEO4J_URI env var}"
  "NEO4J_USER=${NEO4J_USER:?Set NEO4J_USER env var}"
  "NEO4J_PASSWORD=${NEO4J_PASSWORD:?Set NEO4J_PASSWORD env var}"
  "OPENAI_API_KEY=${OPENAI_API_KEY:?Set OPENAI_API_KEY env var}"
)
if [[ -n "${NEO4J_DATABASE:-}" ]]; then
  SECRETS+=("NEO4J_DATABASE=${NEO4J_DATABASE}")
fi
fly secrets set "${SECRETS[@]}" --app "$APP_NAME"

echo "==> Step 3: Deploy"
fly deploy --config "$CONFIG_FILE" --app "$APP_NAME"

echo ""
echo "Done! Graphiti (${ENV}) is available at: https://${APP_NAME}.fly.dev"
echo ""
echo "Set this in Convex environment variables:"
echo "  GRAPHITI_API_URL=https://${APP_NAME}.fly.dev"
