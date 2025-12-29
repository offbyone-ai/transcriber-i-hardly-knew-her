#!/usr/bin/env bun
/**
 * Migration CLI tool for managing database migrations
 * 
 * Usage:
 *   bun run migrate              - Run all pending migrations
 *   bun run migrate:status       - Show migration status
 *   bun run migrate:create <name> - Create a new migration file
 */

import { Database } from "bun:sqlite"
import path from "path"
import { existsSync, mkdirSync } from "node:fs"
import { MigrationRunner, runMigrationsFromCLI, getMigrationStatusFromCLI } from "./db/migrate"

// Get database path
const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "auth.db")

// Ensure data directory exists
const dbDir = path.dirname(dbPath)
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

// Initialize database connection
const db = new Database(dbPath)

// Get migrations directory
const migrationsDir = path.join(process.cwd(), "migrations")
if (!existsSync(migrationsDir)) {
  mkdirSync(migrationsDir, { recursive: true })
}

// Parse command
const command = process.argv[2] || "run"
const args = process.argv.slice(3)

async function main() {
  try {
    switch (command) {
      case "run":
        console.log("🚀 Running migrations...\n")
        await runMigrationsFromCLI(db, migrationsDir)
        break

      case "status":
        getMigrationStatusFromCLI(db, migrationsDir)
        break

      case "create":
        if (args.length === 0) {
          console.error("❌ Error: Migration name is required")
          console.log("\nUsage: bun run migrate:create <migration_name>")
          console.log("Example: bun run migrate:create add_user_roles")
          process.exit(1)
        }
        const migrationName = args.join(" ")
        MigrationRunner.createMigration(migrationName, migrationsDir)
        break

      case "help":
      case "--help":
      case "-h":
        console.log("Migration CLI - Database migration management tool\n")
        console.log("Usage:")
        console.log("  bun run src/migrate.ts [command] [args]\n")
        console.log("Commands:")
        console.log("  run                    Run all pending migrations (default)")
        console.log("  status                 Show migration status")
        console.log("  create <name>          Create a new migration file")
        console.log("  help                   Show this help message\n")
        console.log("Examples:")
        console.log("  bun run src/migrate.ts run")
        console.log("  bun run src/migrate.ts status")
        console.log("  bun run src/migrate.ts create add_user_roles")
        break

      default:
        console.error(`❌ Unknown command: ${command}`)
        console.log("Run 'bun run migrate help' for usage information")
        process.exit(1)
    }
  } catch (error) {
    console.error("❌ Migration failed:", error)
    process.exit(1)
  } finally {
    db.close()
  }
}

main()
