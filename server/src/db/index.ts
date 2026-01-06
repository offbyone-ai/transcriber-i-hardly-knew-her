/**
 * Drizzle ORM Database Connection
 * 
 * Uses bun:sqlite for optimal performance with Bun runtime
 */

import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { mkdirSync, existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
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
 * Handles migration from old custom migration system to Drizzle:
 * - If tables exist but __drizzle_migrations doesn't, we baseline it
 * - This allows existing databases to work with Drizzle's migration system
 */
export function runMigrations() {
  try {
    // Resolve migrations folder path
    const migrationsFolder = resolveMigrationsPath()
    
    console.log('🔄 Running database migrations...')
    console.log(`  📁 Migrations folder: ${migrationsFolder}`)
    
    // Check if this is an existing database that needs baselining
    // (tables exist but Drizzle doesn't know about them)
    const needsBaseline = checkNeedsBaseline()
    
    if (needsBaseline) {
      console.log('📋 Existing database detected, baselining Drizzle migrations...')
      baselineMigrations(migrationsFolder)
      console.log('✅ Database baseline completed')
    } else {
      migrate(db, { migrationsFolder })
      console.log('✅ Database migrations completed')
    }
  } catch (error) {
    console.error('❌ Failed to run database migrations:', error)
    throw error
  }
}

/**
 * Check if database has tables but no Drizzle migration tracking
 */
function checkNeedsBaseline(): boolean {
  try {
    // Check if user table exists (indicates old migration system was used)
    const userTableExists = sqlite.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='user'"
    ).get()
    
    if (!userTableExists) {
      // Fresh database, no baseline needed
      return false
    }
    
    // Check if Drizzle migrations table exists and has entries
    const drizzleTableExists = sqlite.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'"
    ).get()
    
    if (!drizzleTableExists) {
      // Tables exist but Drizzle doesn't know about them
      return true
    }
    
    // Check if there are any migration entries
    const migrationCount = sqlite.query(
      "SELECT COUNT(*) as count FROM __drizzle_migrations"
    ).get() as { count: number } | null
    
    if (!migrationCount || migrationCount.count === 0) {
      // Drizzle table exists but is empty
      return true
    }
    
    return false
  } catch {
    // If any error, assume fresh database
    return false
  }
}

/**
 * Baseline existing database by marking initial migration as applied
 */
function baselineMigrations(migrationsFolder: string) {
  // Read the journal to get migration info
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json')
  const journal = JSON.parse(readFileSync(journalPath, 'utf-8'))
  
  // Create Drizzle migrations table if it doesn't exist
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at INTEGER
    )
  `)
  
  // Insert all existing migrations as already applied
  for (const entry of journal.entries) {
    const migrationPath = path.join(migrationsFolder, `${entry.tag}.sql`)
    const sql = readFileSync(migrationPath, 'utf-8')
    
    // Calculate hash the same way Drizzle does (simple hash of content)
    const hash = createHash('sha256').update(sql).digest('hex')
    
    // Check if already recorded
    const existing = sqlite.query(
      "SELECT id FROM __drizzle_migrations WHERE hash = ?"
    ).get(hash)
    
    if (!existing) {
      sqlite.run(
        "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
        [hash, entry.when]
      )
      console.log(`  📝 Recorded baseline: ${entry.tag}`)
    }
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
