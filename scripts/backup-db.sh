#!/usr/bin/env bash

# SQLite Database Backup Script for Docker
# Backs up the auth.db database from the transcriber Docker container

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
CONTAINER_NAME="transcriber-app"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="auth_backup_${TIMESTAMP}.db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}📦 Starting SQLite database backup...${NC}"

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo -e "${RED}❌ Error: Container '$CONTAINER_NAME' is not running${NC}"
    exit 1
fi

# Perform backup using SQLite's backup command (safer than cp)
echo -e "${YELLOW}🔄 Creating backup: $BACKUP_FILE${NC}"

docker exec "$CONTAINER_NAME" sh -c "sqlite3 /app/data/auth.db '.backup /app/data/backup_temp.db'" || {
    echo -e "${RED}❌ Backup command failed${NC}"
    exit 1
}

# Copy backup from container to host
docker cp "$CONTAINER_NAME:/app/data/backup_temp.db" "$BACKUP_DIR/$BACKUP_FILE" || {
    echo -e "${RED}❌ Failed to copy backup from container${NC}"
    exit 1
}

# Clean up temporary backup file in container
docker exec "$CONTAINER_NAME" rm -f /app/data/backup_temp.db

# Get backup file size
BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)

echo -e "${GREEN}✅ Backup completed successfully!${NC}"
echo -e "   📁 Location: $BACKUP_DIR/$BACKUP_FILE"
echo -e "   📊 Size: $BACKUP_SIZE"

# Optional: Keep only last N backups (default: 10)
KEEP_BACKUPS=${1:-10}

if [ "$KEEP_BACKUPS" -gt 0 ]; then
    echo -e "${YELLOW}🧹 Cleaning up old backups (keeping last $KEEP_BACKUPS)...${NC}"
    cd "$BACKUP_DIR"
    ls -t auth_backup_*.db | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f
    REMAINING=$(ls -1 auth_backup_*.db 2>/dev/null | wc -l)
    echo -e "${GREEN}📦 $REMAINING backup(s) retained${NC}"
fi

echo -e "${GREEN}✨ Done!${NC}"
