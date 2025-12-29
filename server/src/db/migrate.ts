import { Database } from "bun:sqlite"
import { readdirSync, readFileSync, existsSync } from "node:fs"
import path from "path"

export interface Migration {
  id: number
  name: string
  executedAt: string
}

export class MigrationRunner {
  private db: Database
  private migrationsDir: string

  constructor(db: Database, migrationsDir?: string) {
    this.db = db
    // In dev: migrations are at server/migrations
    // In prod: migrations are at /app/migrations
    this.migrationsDir = migrationsDir || this.resolveMigrationsPath()
  }

  private resolveMigrationsPath(): string {
    // Try dev path first
    const devPath = path.join(process.cwd(), "migrations")
    if (existsSync(devPath)) {
      return devPath
    }

    // Try prod path (when running as compiled executable)
    const execPath = process.argv[0] || process.cwd()
    const prodPath = path.join(path.dirname(execPath), "migrations")
    if (existsSync(prodPath)) {
      return prodPath
    }

    // Fallback to relative to current file
    const relativePath = path.join(__dirname, "../../migrations")
    if (existsSync(relativePath)) {
      return relativePath
    }

    throw new Error(`Migrations directory not found. Tried: ${devPath}, ${prodPath}, ${relativePath}`)
  }

  /**
   * Initialize the migrations tracking table
   */
  private initMigrationsTable(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        executedAt TEXT NOT NULL
      )
    `)
  }

  /**
   * Get all executed migrations from the database
   */
  private getExecutedMigrations(): Migration[] {
    const stmt = this.db.prepare("SELECT * FROM _migrations ORDER BY id ASC")
    return stmt.all() as Migration[]
  }

  /**
   * Get all migration files from the migrations directory
   */
  private getMigrationFiles(): string[] {
    if (!existsSync(this.migrationsDir)) {
      console.warn(`⚠️  Migrations directory not found: ${this.migrationsDir}`)
      return []
    }

    const files = readdirSync(this.migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort()

    return files
  }

  /**
   * Parse migration filename to extract ID and name
   */
  private parseMigrationFilename(filename: string): { id: number; name: string } {
    const match = filename.match(/^(\d+)_(.+)\.sql$/)
    if (!match || !match[1] || !match[2]) {
      throw new Error(`Invalid migration filename: ${filename}. Expected format: 001_description.sql`)
    }
    return {
      id: parseInt(match[1], 10),
      name: match[2],
    }
  }

  /**
   * Execute a single migration
   */
  private executeMigration(filename: string): void {
    const { id, name } = this.parseMigrationFilename(filename)
    const filepath = path.join(this.migrationsDir, filename)
    const sql = readFileSync(filepath, 'utf-8')

    console.log(`  ▸ Running migration ${id}: ${name}`)

    try {
      // Execute the migration SQL (split by semicolon to handle multiple statements)
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0)
      
      for (const statement of statements) {
        this.db.run(statement + ';')
      }

      // Record the migration as executed
      const stmt = this.db.prepare(
        "INSERT INTO _migrations (id, name, executedAt) VALUES (?, ?, ?)"
      )
      stmt.run(id, name, new Date().toISOString())

      console.log(`  ✓ Migration ${id} completed`)
    } catch (error) {
      console.error(`  ✗ Migration ${id} failed:`, error)
      throw error
    }
  }

  /**
   * Run all pending migrations (synchronous version)
   */
  public runMigrationsSync(): void {
    console.log('🔄 Running database migrations...')

    // Initialize migrations table
    this.initMigrationsTable()

    // Get executed migrations
    const executed = this.getExecutedMigrations()
    const executedIds = new Set(executed.map(m => m.id))

    // Get all migration files
    const files = this.getMigrationFiles()

    if (files.length === 0) {
      console.log('  ℹ️  No migration files found')
      return
    }

    // Find pending migrations
    const pending = files.filter(file => {
      const { id } = this.parseMigrationFilename(file)
      return !executedIds.has(id)
    })

    if (pending.length === 0) {
      console.log('  ✓ All migrations up to date')
      return
    }

    console.log(`  📝 Found ${pending.length} pending migration(s)`)

    // Execute pending migrations in order
    for (const file of pending) {
      this.executeMigration(file)
    }

    console.log('✅ All migrations completed successfully')
  }

  /**
   * Run all pending migrations
   */
  public async runMigrations(): Promise<void> {
    this.runMigrationsSync()
  }

  /**
   * Get migration status
   */
  public getMigrationStatus(): {
    executed: Migration[]
    pending: string[]
    total: number
  } {
    this.initMigrationsTable()

    const executed = this.getExecutedMigrations()
    const executedIds = new Set(executed.map(m => m.id))

    const files = this.getMigrationFiles()
    const pending = files.filter(file => {
      const { id } = this.parseMigrationFilename(file)
      return !executedIds.has(id)
    })

    return {
      executed,
      pending,
      total: files.length,
    }
  }

  /**
   * Create a new migration file
   */
  public static createMigration(name: string, migrationsDir: string): string {
    // Get next migration number
    const files = existsSync(migrationsDir) 
      ? readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))
      : []
    
    const lastId = files.length > 0
      ? Math.max(...files.map(f => {
          const match = f.match(/^(\d+)_/)
          return (match && match[1]) ? parseInt(match[1], 10) : 0
        }))
      : 0

    const nextId = (lastId + 1).toString().padStart(3, '0')
    const filename = `${nextId}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.sql`
    const filepath = path.join(migrationsDir, filename)

    // Create migration file with template
    const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Add your SQL statements here
-- Example:
-- CREATE TABLE IF NOT EXISTS example (
--   id TEXT PRIMARY KEY,
--   name TEXT NOT NULL,
--   createdAt INTEGER NOT NULL
-- );
`

    Bun.write(filepath, template)
    console.log(`✅ Created migration: ${filename}`)
    console.log(`   Path: ${filepath}`)

    return filepath
  }
}

/**
 * CLI helper to run migrations
 */
export async function runMigrationsFromCLI(db: Database, migrationsDir?: string): Promise<void> {
  const runner = new MigrationRunner(db, migrationsDir)
  await runner.runMigrations()
}

/**
 * CLI helper to check migration status
 */
export function getMigrationStatusFromCLI(db: Database, migrationsDir?: string): void {
  const runner = new MigrationRunner(db, migrationsDir)
  const status = runner.getMigrationStatus()

  console.log('\n📊 Migration Status:')
  console.log(`   Total migrations: ${status.total}`)
  console.log(`   Executed: ${status.executed.length}`)
  console.log(`   Pending: ${status.pending.length}`)

  if (status.executed.length > 0) {
    console.log('\n✓ Executed migrations:')
    status.executed.forEach(m => {
      console.log(`   ${String(m.id).padStart(3, '0')}: ${m.name} (${m.executedAt})`)
    })
  }

  if (status.pending.length > 0) {
    console.log('\n⏳ Pending migrations:')
    status.pending.forEach(file => {
      console.log(`   ${file}`)
    })
  }
}
