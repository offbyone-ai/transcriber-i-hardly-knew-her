import { betterAuth } from "better-auth"
import { Database } from "bun:sqlite"
import path from "path"
import { mkdirSync, existsSync } from "node:fs"
import type { BetterAuthOptions } from "better-auth"
import { MigrationRunner } from "./db/migrate"

// Use environment variable for database path in Docker, fallback to local path
const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "auth.db")

// Ensure data directory exists
const dbDir = path.dirname(dbPath)
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

const db = new Database(dbPath)

// Optimize SQLite for Docker deployment
// WAL mode: Write-Ahead Logging for better concurrency and crash recovery
db.run("PRAGMA journal_mode = WAL;")
// Synchronous mode: Ensure data is written to disk (important for Docker volumes)
db.run("PRAGMA synchronous = NORMAL;")
// Cache size: 10MB cache for better performance
db.run("PRAGMA cache_size = -10000;")
// Temp store: Use memory for temporary tables
db.run("PRAGMA temp_store = MEMORY;")
// mmap_size: Memory-mapped I/O for faster reads (64MB)
db.run("PRAGMA mmap_size = 67108864;")
// page_size: Optimal page size for modern systems
db.run("PRAGMA page_size = 4096;")

console.log(`📦 Database initialized: ${dbPath}`)
console.log(`📊 WAL mode enabled for optimal Docker performance`)

// Run database migrations on startup
try {
  const runner = new MigrationRunner(db)
  runner.runMigrationsSync()
} catch (error) {
  console.error(`❌ Failed to run database migrations:`, error)
  throw error
}

export const auth = betterAuth({
  database: db as any, // Bun's sqlite has a compatible API
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Disable for MVP
  },
  trustedOrigins: ["http://localhost:5173", "http://localhost:3000"],
  advanced: {
    cookiePrefix: "transcriber",
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
} as BetterAuthOptions)

export type Session = typeof auth.$Infer.Session
