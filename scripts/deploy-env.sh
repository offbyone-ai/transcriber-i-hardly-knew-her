#!/bin/bash

# Deploy script for environment-specific configurations
# Usage: ./scripts/deploy-env.sh [development|staging|production]

set -e

ENV=${1:-development}
ENV_FILE=".env.${ENV}"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Environment file $ENV_FILE not found"
  echo "Available environments: development, staging, production"
  exit 1
fi

echo "🚀 Deploying with $ENV environment"
echo "📋 Using configuration from: $ENV_FILE"

# Load environment-specific configuration
export $(cat "$ENV_FILE" | grep -v '^#' | xargs)

# Show current configuration (without secrets)
echo ""
echo "Configuration:"
echo "  NODE_ENV: $NODE_ENV"
echo "  DATABASE_PATH: $DATABASE_PATH"
echo "  BETTER_AUTH_URL: $BETTER_AUTH_URL"
echo "  IMAGE_TAG: ${IMAGE_TAG:-latest}"
echo ""

# Build and start services
docker-compose --env-file "$ENV_FILE" up -d --build

echo "✅ Deployment complete!"
echo "🔍 Check status: docker-compose ps"
echo "📋 View logs: docker-compose logs -f"
