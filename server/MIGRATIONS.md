# Database Migrations

This project uses a custom migration system for managing database schema changes.

## Overview

- **Migrations Directory**: `server/migrations/`
- **Tracking Table**: `_migrations` (automatically created)
- **Migration Format**: `001_description.sql`
- **Auto-run**: Migrations run automatically on server startup
- **Idempotent**: Safe to run multiple times (uses tracking table)

## Quick Start

### 1. Check Migration Status

```bash
cd server
bun run migrate:status
```

Output:
```
📊 Migration Status:
   Total migrations: 1
   Executed: 1
   Pending: 0

✓ Executed migrations:
   001: initial_better_auth_schema (2025-12-29T05:39:56.879Z)
```

### 2. Create a New Migration

```bash
cd server
bun run migrate:create "add user roles"
```

This creates: `server/migrations/002_add_user_roles.sql`

### 3. Edit the Migration File

```sql
-- Migration: add user roles
-- Created: 2025-12-29T05:40:08.689Z

ALTER TABLE user ADD COLUMN role TEXT DEFAULT 'user';
CREATE INDEX idx_user_role ON user(role);
```

### 4. Run Pending Migrations

```bash
cd server
bun run migrate
```

Output:
```
🔄 Running database migrations...
  📝 Found 1 pending migration(s)
  ▸ Running migration 2: add_user_roles
  ✓ Migration 2 completed
✅ All migrations completed successfully
```

## How It Works

### Automatic Execution

Migrations run automatically when:
1. **Server starts** (`bun run dev` or `./transcriber`)
2. **Docker container starts**
3. **You run** `bun run migrate`

### Migration Tracking

The `_migrations` table tracks which migrations have been executed:

| id | name | executedAt |
|----|------|------------|
| 1  | initial_better_auth_schema | 2025-12-29T05:39:56.879Z |
| 2  | add_user_roles | 2025-12-29T05:41:23.456Z |

### Migration Filename Format

```
<number>_<description>.sql
│        │
│        └─ Description (snake_case)
└─ Sequential number (001, 002, 003...)
```

**Examples:**
- `001_initial_better_auth_schema.sql`
- `002_add_user_roles.sql`
- `003_add_oauth_providers.sql`

## CLI Commands

| Command | Description |
|---------|-------------|
| `bun run migrate` | Run all pending migrations |
| `bun run migrate:status` | Show migration status |
| `bun run migrate:create <name>` | Create a new migration file |

## Writing Migrations

### Best Practices

1. **Use `IF NOT EXISTS`** for idempotency:
   ```sql
   CREATE TABLE IF NOT EXISTS example (...);
   ALTER TABLE user ADD COLUMN IF NOT EXISTS role TEXT;
   ```

2. **One logical change per migration**:
   - ✅ Good: `002_add_user_roles.sql`
   - ❌ Bad: `002_various_changes.sql`

3. **Test migrations locally** before deploying:
   ```bash
   # Clean database
   rm server/auth.db*
   
   # Run migrations
   cd server && bun run migrate
   
   # Verify
   bun run migrate:status
   ```

4. **Never modify executed migrations**:
   - Once a migration is in production, don't change it
   - Create a new migration to fix issues

### Example Migrations

**Adding a column:**
```sql
-- Migration: add user profile fields
-- Created: 2025-12-29T06:00:00.000Z

ALTER TABLE user ADD COLUMN bio TEXT;
ALTER TABLE user ADD COLUMN website TEXT;
```

**Creating a table:**
```sql
-- Migration: create recordings table
-- Created: 2025-12-29T06:00:00.000Z

CREATE TABLE IF NOT EXISTS recording (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    title TEXT NOT NULL,
    audioUrl TEXT NOT NULL,
    transcription TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recording_userId ON recording(userId);
CREATE INDEX IF NOT EXISTS idx_recording_createdAt ON recording(createdAt);
```

## Production Deployment

### Docker/Coolify

Migrations run automatically on container startup:

```bash
# Container logs
📦 Database initialized: /app/data/auth.db
📊 WAL mode enabled for optimal Docker performance
🔄 Running database migrations...
  📝 Found 2 pending migration(s)
  ▸ Running migration 1: initial_better_auth_schema
  ✓ Migration 1 completed
  ▸ Running migration 2: add_user_roles
  ✓ Migration 2 completed
✅ All migrations completed successfully
Started server: http://localhost:3000
```

On subsequent restarts:
```bash
🔄 Running database migrations...
  ✓ All migrations up to date
Started server: http://localhost:3000
```

### Zero-Downtime Deployments

1. **Backward-compatible changes first:**
   ```sql
   -- Add nullable column (safe)
   ALTER TABLE user ADD COLUMN newField TEXT;
   ```

2. **Deploy code that works with both schemas**

3. **Then make breaking changes:**
   ```sql
   -- Make column required (after code is deployed)
   -- (SQLite doesn't support this directly - need to recreate table)
   ```

## Troubleshooting

### Migration Failed

If a migration fails mid-execution:

1. **Check the error message:**
   ```bash
   ❌ Migration 2 failed: SQLITE_ERROR: near "CRATE": syntax error
   ```

2. **Fix the SQL** in the migration file

3. **Manually remove from tracking table:**
   ```bash
   sqlite3 server/auth.db "DELETE FROM _migrations WHERE id = 2;"
   ```

4. **Re-run migrations:**
   ```bash
   cd server && bun run migrate
   ```

### Migrations Not Found

If you see:
```
⚠️  Migrations directory not found: /app/migrations
```

**Solution:** Ensure `migrations/` is copied in the Dockerfile:
```dockerfile
COPY --from=build /app/server/migrations/ migrations/
```

### Database Locked

If SQLite says "database is locked":

```bash
# Check for running processes
ps aux | grep transcriber

# Kill them
pkill -f transcriber

# Or restart Docker container
docker restart <container>
```

## Migration System Architecture

### Files

- `server/src/db/migrate.ts` - Migration runner class
- `server/src/migrate.ts` - CLI tool
- `server/src/auth.ts` - Auto-runs migrations on startup
- `server/migrations/*.sql` - Migration files

### Flow

```
Server Startup
     ↓
auth.ts initializes
     ↓
MigrationRunner.runMigrationsSync()
     ↓
1. Create _migrations table if not exists
2. Read all *.sql files from migrations/
3. Check which are not in _migrations table
4. Execute pending migrations in order
5. Record each in _migrations table
     ↓
Server continues startup
```

## Future Enhancements

Possible improvements:
- Rollback support (`down` migrations)
- Migration checksums for integrity checking
- Dry-run mode
- Migration dependencies/ordering
- Better conflict resolution

## Questions?

Check the migration code:
- Runner: `server/src/db/migrate.ts`
- CLI: `server/src/migrate.ts`
- Integration: `server/src/auth.ts` (lines 36-42)
