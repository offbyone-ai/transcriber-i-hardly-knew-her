/**
 * Drizzle ORM Database Connection
 * 
 * Uses bun:sqlite for optimal performance with Bun runtime
 */

import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { mkdirSync, existsSync, readdirSync, statSync } from 'node:fs'
import path from 'path'
import * as schema from './schema'

// Use environment variable for database path in Docker, fallback to local path
const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'auth.db')

// Ensure data directory exists
const dbDir = path.dirname(dbPath)
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

// Create SQLite database connection
const sqlite = new Database(dbPath)

// Optimize SQLite for Docker deployment
// WAL mode: Write-Ahead Logging for better concurrency and crash recovery
sqlite.run('PRAGMA journal_mode = WAL;')
// Synchronous mode: Ensure data is written to disk (important for Docker volumes)
sqlite.run('PRAGMA synchronous = NORMAL;')
// Cache size: 10MB cache for better performance
sqlite.run('PRAGMA cache_size = -10000;')
// Temp store: Use memory for temporary tables
sqlite.run('PRAGMA temp_store = MEMORY;')
// mmap_size: Memory-mapped I/O for faster reads (64MB)
sqlite.run('PRAGMA mmap_size = 67108864;')
// page_size: Optimal page size for modern systems
sqlite.run('PRAGMA page_size = 4096;')

console.log(`📦 Database initialized: ${dbPath}`)
console.log(`📊 WAL mode enabled for optimal Docker performance`)

// Create Drizzle ORM instance with schema
export const db = drizzle(sqlite, { schema })

// Export the raw sqlite connection for better-auth (it needs raw access)
export { sqlite }

/**
 * Run database migrations on startup
 * 
 * Migrations use IF NOT EXISTS for idempotent execution.
 * This safely handles existing databases from old migration system.
 */
export async function runMigrations() {
  try {
    // Resolve migrations folder path
    const migrationsFolder = resolveMigrationsPath()
    
    console.log('🔄 Running database migrations...')
    console.log(`  📁 Migrations folder: ${migrationsFolder}`)

    // Diagnostic: list migration files present in the migrations folder
    let migrationFiles: string[] = []
    try {
      migrationFiles = readdirSync(migrationsFolder).filter((f) => /\.sql$|\.js$|\.ts$/.test(f)).sort()
      console.log(`  🔍 Migration files (${migrationFiles.length}): ${migrationFiles.join(', ') || '<none>'}`)
    } catch (err) {
      console.warn(`  ⚠️ Could not read migrations folder: ${String(err)}`)
    }

    // Diagnostic: report DB file existence and size (if available)
    try {
      if (existsSync(dbPath)) {
        const s = statSync(dbPath)
        console.log(`  🗃 Database file: ${dbPath} (${s.size} bytes)`)
      } else {
        console.log(`  🗃 Database file not found at ${dbPath} — it will be created`)
      }
    } catch (err) {
      console.warn(`  ⚠️ Could not stat DB file: ${String(err)}`)
    }

    await migrate(db, { migrationsFolder })
    
    console.log('✅ Database migrations completed')
  } catch (error) {
    console.error('❌ Failed to run database migrations:', error)
    throw error
  }
}

/**
 * Resolve the migrations folder path based on environment
 */
function resolveMigrationsPath(): string {
  // Try dev path first (running from server directory)
  const devPath = path.join(process.cwd(), 'drizzle')
  if (existsSync(devPath)) {
    return devPath
  }

  // Try prod path (when running as compiled executable)
  const execPath = process.argv[0] || process.cwd()
  const prodPath = path.join(path.dirname(execPath), 'drizzle')
  if (existsSync(prodPath)) {
    return prodPath
  }

  // Fallback to relative to current file
  const relativePath = path.join(__dirname, '../../drizzle')
  if (existsSync(relativePath)) {
    return relativePath
  }

  throw new Error(`Migrations folder not found. Tried: ${devPath}, ${prodPath}, ${relativePath}`)
}

// Re-export schema for convenience
export * from './schema'
