#!/usr/bin/env bash

# SQLite Database Restore Script for Docker
# Restores a backup to the transcriber Docker container

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
CONTAINER_NAME="transcriber-app"
BACKUP_DIR="./backups"

# Check if backup file is provided
if [ $# -eq 0 ]; then
    echo -e "${RED}❌ Error: No backup file specified${NC}"
    echo ""
    echo "Usage: $0 <backup-file>"
    echo ""
    echo "Available backups:"
    ls -1t "$BACKUP_DIR"/auth_backup_*.db 2>/dev/null | head -10 || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    # Try prepending backup directory
    if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
        BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
    else
        echo -e "${RED}❌ Error: Backup file not found: $BACKUP_FILE${NC}"
        exit 1
    fi
fi

echo -e "${YELLOW}⚠️  WARNING: This will replace the current database!${NC}"
echo -e "${YELLOW}📁 Backup file: $BACKUP_FILE${NC}"
echo ""
read -p "Continue? (yes/no): " -r
echo

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${YELLOW}❌ Restore cancelled${NC}"
    exit 0
fi

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo -e "${RED}❌ Error: Container '$CONTAINER_NAME' is not running${NC}"
    exit 1
fi

echo -e "${YELLOW}🔄 Restoring database...${NC}"

# Create a backup of current database before restore
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
echo -e "${YELLOW}📦 Creating safety backup of current database...${NC}"
docker exec "$CONTAINER_NAME" sh -c "sqlite3 /app/data/auth.db '.backup /app/data/pre_restore_$TIMESTAMP.db'" 2>/dev/null || true

# Copy backup file to container
docker cp "$BACKUP_FILE" "$CONTAINER_NAME:/app/data/restore_temp.db" || {
    echo -e "${RED}❌ Failed to copy backup to container${NC}"
    exit 1
}

# Stop the application gracefully (optional - depends on your setup)
echo -e "${YELLOW}⏸️  Stopping application...${NC}"
docker-compose stop transcriber 2>/dev/null || docker stop "$CONTAINER_NAME"

# Replace database
docker exec "$CONTAINER_NAME" sh -c "mv /app/data/restore_temp.db /app/data/auth.db" || {
    echo -e "${RED}❌ Failed to restore database${NC}"
    docker-compose start transcriber 2>/dev/null || docker start "$CONTAINER_NAME"
    exit 1
}

# Restart the application
echo -e "${YELLOW}▶️  Starting application...${NC}"
docker-compose start transcriber 2>/dev/null || docker start "$CONTAINER_NAME"

# Wait for health check
echo -e "${YELLOW}🏥 Waiting for health check...${NC}"
sleep 3

if docker ps | grep -q "$CONTAINER_NAME.*healthy" || docker ps | grep -q "$CONTAINER_NAME"; then
    echo -e "${GREEN}✅ Database restored successfully!${NC}"
    echo -e "${GREEN}🚀 Application is running${NC}"
else
    echo -e "${RED}⚠️  Warning: Container may not be healthy. Check logs:${NC}"
    echo -e "   docker-compose logs transcriber"
fi

echo -e "${GREEN}✨ Done!${NC}"
