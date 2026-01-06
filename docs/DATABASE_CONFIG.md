# Environment-Specific Database Configuration

This project now supports dynamic database paths for multiple environments.

## Quick Start

### Development
```bash
# Uses ./data/auth.db (local SQLite file)
./scripts/deploy-env.sh development
```

### Staging
```bash
# Uses /app/data/auth.db (Docker volume)
./scripts/deploy-env.sh staging
```

### Production
```bash
# Uses /app/data/auth.db (Docker volume with backups enabled)
./scripts/deploy-env.sh production
```

## Configuration Files

- `.env.development` - Local development settings
- `.env.staging` - Staging environment settings
- `.env.production` - Production environment settings
- `.env.example` - Template for new environments

## Environment Variables

### Required
- `BETTER_AUTH_SECRET` - Authentication secret (min 32 characters)
- `BETTER_AUTH_URL` - Public URL of your application
- `DATABASE_PATH` - Path to SQLite database file

### Optional
- `NODE_ENV` - Environment name (development/staging/production)
- `PORT` - Server port (default: 3000)
- `CPU_LIMIT` - Docker CPU limit
- `MEMORY_LIMIT` - Docker memory limit
- `ENABLE_BACKUP` - Enable automated backups
- `BACKUP_RETENTION` - Days to keep backups

## Database Paths

### Development
```bash
DATABASE_PATH=./data/auth.db
```
Uses local filesystem in project directory.

### Docker Environments
```bash
DATABASE_PATH=/app/data/auth.db
```
Uses Docker volume for persistence across container restarts.

### Custom Database Path
You can point to any location:
```bash
DATABASE_PATH=/var/lib/myapp/database.db
DATABASE_PATH=/mnt/storage/production.db
```

## Manual Deployment

If you prefer manual control:

```bash
# Load environment
export $(cat .env.staging | grep -v '^#' | xargs)

# Deploy
docker-compose --env-file .env.staging up -d --build
```

## Verifying Configuration

Check which database is being used:
```bash
docker-compose exec transcriber sh -c 'echo $DATABASE_PATH'
```

## Backups

Production environment enables automated backups by default:
- Runs daily at midnight
- Retention: 30 days
- Location: `transcriber-backups` volume

To enable backups in other environments:
```bash
ENABLE_BACKUP=true docker-compose --profile backup up -d
```
