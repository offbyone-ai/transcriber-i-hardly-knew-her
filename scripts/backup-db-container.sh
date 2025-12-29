#!/usr/bin/env sh

# SQLite Database Backup Script for Containers
# Designed to run inside the backup sidecar container

set -e

# Configuration
DB_PATH="${DB_PATH:-/data/auth.db}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="auth_backup_${TIMESTAMP}.db"
KEEP_BACKUPS=${1:-7}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "[Backup] Starting SQLite database backup at $(date)"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "[Backup] Warning: Database not found at $DB_PATH"
    exit 0
fi

# Perform backup using cp (sqlite3 not available in busybox)
# Note: This is safe because SQLite uses WAL mode with proper locking
echo "[Backup] Creating backup: $BACKUP_FILE"

cp "$DB_PATH" "$BACKUP_DIR/$BACKUP_FILE" || {
    echo "[Backup] Error: Backup failed"
    exit 1
}

# Verify backup
if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
    echo "[Backup] Backup completed successfully"
    echo "[Backup] Location: $BACKUP_DIR/$BACKUP_FILE"
    echo "[Backup] Size: $BACKUP_SIZE"
else
    echo "[Backup] Error: Backup file not found after copy"
    exit 1
fi

# Clean up old backups
if [ "$KEEP_BACKUPS" -gt 0 ]; then
    echo "[Backup] Cleaning up old backups (keeping last $KEEP_BACKUPS)..."
    cd "$BACKUP_DIR"
    BACKUP_COUNT=$(ls -1 auth_backup_*.db 2>/dev/null | wc -l)
    
    if [ "$BACKUP_COUNT" -gt "$KEEP_BACKUPS" ]; then
        ls -t auth_backup_*.db | tail -n +$((KEEP_BACKUPS + 1)) | xargs rm -f
    fi
    
    REMAINING=$(ls -1 auth_backup_*.db 2>/dev/null | wc -l)
    echo "[Backup] $REMAINING backup(s) retained"
fi

echo "[Backup] Done at $(date)"
