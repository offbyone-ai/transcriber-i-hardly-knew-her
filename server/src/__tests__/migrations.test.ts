import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Database } from "bun:sqlite"
import { MigrationRunner } from "../db/migrate"
import { mkdirSync, unlinkSync, existsSync, rmdirSync, writeFileSync } from "node:fs"
import path from "path"

// Use a separate test database and migrations directory
const TEST_DB_PATH = "./test-migrations.db"
const TEST_MIGRATIONS_DIR = "./test-migrations"

let testDb: Database

beforeEach(() => {
  // Clean up any existing test database
  if (existsSync(TEST_DB_PATH)) {
    unlinkSync(TEST_DB_PATH)
  }
  if (existsSync(`${TEST_DB_PATH}-shm`)) {
    unlinkSync(`${TEST_DB_PATH}-shm`)
  }
  if (existsSync(`${TEST_DB_PATH}-wal`)) {
    unlinkSync(`${TEST_DB_PATH}-wal`)
  }

  // Clean up test migrations directory
  if (existsSync(TEST_MIGRATIONS_DIR)) {
    try {
      const items = require("fs").readdirSync(TEST_MIGRATIONS_DIR)
      for (const item of items) {
        unlinkSync(path.join(TEST_MIGRATIONS_DIR, item))
      }
      rmdirSync(TEST_MIGRATIONS_DIR)
    } catch {
      // Directory might not exist
    }
  }

  // Create fresh test database and migrations directory
  testDb = new Database(TEST_DB_PATH)
  mkdirSync(TEST_MIGRATIONS_DIR, { recursive: true })
})

afterEach(() => {
  // Clean up test database
  testDb.close()
  if (existsSync(TEST_DB_PATH)) {
    unlinkSync(TEST_DB_PATH)
  }
  if (existsSync(`${TEST_DB_PATH}-shm`)) {
    unlinkSync(`${TEST_DB_PATH}-shm`)
  }
  if (existsSync(`${TEST_DB_PATH}-wal`)) {
    unlinkSync(`${TEST_DB_PATH}-wal`)
  }

  // Clean up test migrations directory
  if (existsSync(TEST_MIGRATIONS_DIR)) {
    try {
      const items = require("fs").readdirSync(TEST_MIGRATIONS_DIR)
      for (const item of items) {
        unlinkSync(path.join(TEST_MIGRATIONS_DIR, item))
      }
      rmdirSync(TEST_MIGRATIONS_DIR)
    } catch {
      // Ignore cleanup errors
    }
  }
})

describe("MigrationRunner - Initialization", () => {
  test("should create _migrations table on initialization", () => {
    const runner = new MigrationRunner(testDb, TEST_MIGRATIONS_DIR)
    runner.runMigrationsSync()

    const result = testDb.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='_migrations'
    `).get()

    expect(result).toBeDefined()
    expect((result as any).name).toBe("_migrations")
  })

  test("_migrations table should have correct columns", () => {
    const runner = new MigrationRunner(testDb, TEST_MIGRATIONS_DIR)
    runner.runMigrationsSync()

    const columns = testDb.query(`PRAGMA table_info(_migrations)`).all()
    const columnNames = columns.map((col: any) => col.name)

    expect(columnNames).toContain("id")
    expect(columnNames).toContain("name")
    expect(columnNames).toContain("executedAt")
  })

  test("should handle empty migrations directory", () => {
    const runner = new MigrationRunner(testDb, TEST_MIGRATIONS_DIR)
    
    // Should not throw
    expect(() => runner.runMigrationsSync()).not.toThrow()
  })

  test("should handle non-existent migrations directory", () => {
    const nonExistentDir = "./non-existent-migrations"
    const runner = new MigrationRunner(testDb, nonExistentDir)
    
    // Should not throw, just warn
    expect(() => runner.runMigrationsSync()).not.toThrow()
  })
})

describe("MigrationRunner - Running Migrations", () => {
  test("should execute a single migration", () => {
    // Create a test migration
    writeFileSync(
      path.join(TEST_MIGRATIONS_DIR, "001_create_users.sql"),
      `CREATE TABLE IF NOT EXISTS test_users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );`
    )

    const runner = new MigrationRunner(testDb, TEST_MIGRATIONS_DIR)
    runner.runMigrationsSync()

    // Check that table was created
    const result = testDb.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='test_users'
    `).get()

    expect(result).toBeDefined()
    expect((result as any).name).toBe("test_users")
  })

  test("should record migration in _migrations table", () => {
    writeFileSync(
      path.join(TEST_MIGRATIONS_DIR, "001_create_posts.sql"),
      `CREATE TABLE IF NOT EXISTS test_posts (id TEXT PRIMARY KEY);`
    )

    const runner = new MigrationRunner(testDb, TEST_MIGRATIONS_DIR)
    runner.runMigrationsSync()

    const migration = testDb.query(`SELECT * FROM _migrations WHERE id = 1`).get()

    expect(migration).toBeDefined()
    expect((migration as any).id).toBe(1)
    expect((migration as any).name).toBe("create_posts")
    expect((migration as any).executedAt).toBeDefined()
  })

  test("should execute multiple migrations in order", () => {
    writeFileSync(
      path.join(TEST_MIGRATIONS_DIR, "001_create_users.sql"),
      `CREATE TABLE IF NOT EXISTS test_users (id TEXT PRIMARY KEY);`
    )
    writeFileSync(
      path.join(TEST_MIGRATIONS_DIR, "002_create_posts.sql"),
      `CREATE TABLE IF NOT EXISTS test_posts (id TEXT PRIMARY KEY, userId TEXT);`
    )
    writeFileSync(
      path.join(TEST_MIGRATIONS_DIR, "003_create_comments.sql"),
      `CREATE TABLE IF NOT EXISTS test_comments (id TEXT PRIMARY KEY, postId TEXT);`
    )

    const runner = new MigrationRunner(testDb, TEST_MIGRATIONS_DIR)
    runner.runMigrationsSync()

    // Check all tables exist
    const users = testDb.query(`SELECT name FROM sqlite_master WHERE name='test_users'`).get()
    const posts = testDb.query(`SELECT name FROM sqlite_master WHERE name='test_posts'`).get()
    const comments = testDb.query(`SELECT name FROM sqlite_master WHERE name='test_comments'`).get()

    expect(users).toBeDefined()
    expect(posts).toBeDefined()
    expect(comments).toBeDefined()

    // Check all migrations recorded
    const migrations = testDb.query(`SELECT * FROM _migrations ORDER BY id`).all()
    expect(migrations).toHaveLength(3)
    expect((migrations[0] as any).name).toBe("create_users")
    expect((migrations[1] as any).name).toBe("create_posts")
    expect((migrations[2] as any).name).toBe("create_comments")
  })

  test("should handle multiple SQL statements in one migration", () => {
    writeFileSync(
      path.join(TEST_MIGRATIONS_DIR, "001_multi_statement.sql"),
      `
        CREATE TABLE IF NOT EXISTS test_table1 (id TEXT PRIMARY KEY);
        CREATE TABLE IF NOT EXISTS test_table2 (id TEXT PRIMARY KEY);
        CREATE INDEX IF NOT EXISTS idx_table1_id ON test_table1(id);
      `
    )

    const runner = new MigrationRunner(testDb, TEST_MIGRATIONS_DIR)
    runner.runMigrationsSync()

    const table1 = testDb.query(`SELECT name FROM sqlite_master WHERE name='test_table1'`).get()
    const table2 = testDb.query(`SELECT name FROM sqlite_master WHERE name='test_table2'`).get()
    const index = testDb.query(`SELECT name FROM sqlite_master WHERE name='idx_table1_id'`).get()

    expect(table1).toBeDefined()
    expect(table2).toBeDefined()
    expect(index).toBeDefined()
  })
})

describe("MigrationRunner - Idempotency", () => {
  test("should not re-run already executed migrations", () => {
    writeFileSync(
      path.join(TEST_MIGRATIONS_DIR, "001_create_table.sql"),
      `CREATE TABLE IF NOT EXISTS test_table (id TEXT PRIMARY KEY);`
    )

    const runner = new MigrationRunner(testDb, TEST_MIGRATIONS_DIR)
    
    // Run migrations first time
    runner.runMigrationsSync()
    
    const firstRun = testDb.query(`SELECT * FROM _migrations`).all()
    expect(firstRun).toHaveLength(1)

    // Run migrations second time
    runner.runMigrationsSync()
    
    const secondRun = testDb.query(`SELECT * FROM _migrations`).all()
    expect(secondRun).toHaveLength(1) // Should still be 1, not duplicated
  })

  test("should only run new migrations after initial run", () => {
    writeFileSync(
      path.join(TEST_MIGRATIONS_DIR, "001_first.sql"),
      `CREATE TABLE IF NOT EXISTS test_first (id TEXT PRIMARY KEY);`
    )

    const runner = new MigrationRunner(testDb, TEST_MIGRATIONS_DIR)
    runner.runMigrationsSync()

    // Add a new migration
    writeFileSync(
      path.join(TEST_MIGRATIONS_DIR, "002_second.sql"),
      `CREATE TABLE IF NOT EXISTS test_second (id TEXT PRIMARY KEY);`
    )

    // Run migrations again
    runner.runMigrationsSync()

    const migrations = testDb.query(`SELECT * FROM _migrations ORDER BY id`).all()
    expect(migrations).toHaveLength(2)
    expect((migrations[0] as any).name).toBe("first")
    expect((migrations[1] as any).name).toBe("second")

    // Check both tables exist
    const first = testDb.query(`SELECT name FROM sqlite_master WHERE name='test_first'`).get()
    const second = testDb.query(`SELECT name FROM sqlite_master WHERE name='test_second'`).get()
    expect(first).toBeDefined()
    expect(second).toBeDefined()
  })
})

describe("MigrationRunner - Status", () => {
  test("should return correct status with no migrations", () => {
    const runner = new MigrationRunner(testDb, TEST_MIGRATIONS_DIR)
    const status = runner.getMigrationStatus()

    expect(status.total).toBe(0)
    expect(status.executed).toHaveLength(0)
    expect(status.pending).toHaveLength(0)
  })

  test("should return correct status with pending migrations", () => {
    writeFileSync(
      path.join(TEST_MIGRATIONS_DIR, "001_first.sql"),
      `CREATE TABLE test1 (id TEXT);`
    )
    writeFileSync(
      path.join(TEST_MIGRATIONS_DIR, "002_second.sql"),
      `CREATE TABLE test2 (id TEXT);`
    )

    const runner = new MigrationRunner(testDb, TEST_MIGRATIONS_DIR)
    const status = runner.getMigrationStatus()

    expect(status.total).toBe(2)
    expect(status.executed).toHaveLength(0)
    expect(status.pending).toHaveLength(2)
    expect(status.pending).toContain("001_first.sql")
    expect(status.pending).toContain("002_second.sql")
  })

  test("should return correct status after running migrations", () => {
    writeFileSync(
      path.join(TEST_MIGRATIONS_DIR, "001_first.sql"),
      `CREATE TABLE test1 (id TEXT);`
    )
    writeFileSync(
      path.join(TEST_MIGRATIONS_DIR, "002_second.sql"),
      `CREATE TABLE test2 (id TEXT);`
    )

    const runner = new MigrationRunner(testDb, TEST_MIGRATIONS_DIR)
    runner.runMigrationsSync()

    const status = runner.getMigrationStatus()

    expect(status.total).toBe(2)
    expect(status.executed).toHaveLength(2)
    expect(status.pending).toHaveLength(0)
  })

  test("should return correct status with mixed executed and pending", () => {
    writeFileSync(
      path.join(TEST_MIGRATIONS_DIR, "001_first.sql"),
      `CREATE TABLE test1 (id TEXT);`
    )

    const runner = new MigrationRunner(testDb, TEST_MIGRATIONS_DIR)
    runner.runMigrationsSync()

    // Add more migrations
    writeFileSync(
      path.join(TEST_MIGRATIONS_DIR, "002_second.sql"),
      `CREATE TABLE test2 (id TEXT);`
    )
    writeFileSync(
      path.join(TEST_MIGRATIONS_DIR, "003_third.sql"),
      `CREATE TABLE test3 (id TEXT);`
    )

    const status = runner.getMigrationStatus()

    expect(status.total).toBe(3)
    expect(status.executed).toHaveLength(1)
    expect(status.pending).toHaveLength(2)
    expect(status.pending).toContain("002_second.sql")
    expect(status.pending).toContain("003_third.sql")
  })
})

describe("MigrationRunner - Filename Parsing", () => {
  test("should parse valid migration filename", () => {
    writeFileSync(
      path.join(TEST_MIGRATIONS_DIR, "001_create_users_table.sql"),
      `CREATE TABLE test (id TEXT);`
    )

    const runner = new MigrationRunner(testDb, TEST_MIGRATIONS_DIR)
    runner.runMigrationsSync()

    const migration = testDb.query(`SELECT * FROM _migrations WHERE id = 1`).get()
    expect((migration as any).name).toBe("create_users_table")
  })

  test("should handle migration numbers with leading zeros", () => {
    writeFileSync(
      path.join(TEST_MIGRATIONS_DIR, "007_bond.sql"),
      `CREATE TABLE test (id TEXT);`
    )

    const runner = new MigrationRunner(testDb, TEST_MIGRATIONS_DIR)
    runner.runMigrationsSync()

    const migration = testDb.query(`SELECT * FROM _migrations WHERE id = 7`).get()
    expect(migration).toBeDefined()
    expect((migration as any).id).toBe(7)
    expect((migration as any).name).toBe("bond")
  })

  test("should sort migrations numerically, not lexicographically", () => {
    writeFileSync(path.join(TEST_MIGRATIONS_DIR, "002_second.sql"), `CREATE TABLE t2 (id TEXT);`)
    writeFileSync(path.join(TEST_MIGRATIONS_DIR, "010_tenth.sql"), `CREATE TABLE t10 (id TEXT);`)
    writeFileSync(path.join(TEST_MIGRATIONS_DIR, "001_first.sql"), `CREATE TABLE t1 (id TEXT);`)

    const runner = new MigrationRunner(testDb, TEST_MIGRATIONS_DIR)
    runner.runMigrationsSync()

    const migrations = testDb.query(`SELECT * FROM _migrations ORDER BY id`).all()
    expect(migrations).toHaveLength(3)
    expect((migrations[0] as any).id).toBe(1)
    expect((migrations[1] as any).id).toBe(2)
    expect((migrations[2] as any).id).toBe(10)
  })
})

describe("MigrationRunner - Error Handling", () => {
  test("should throw error for invalid SQL", () => {
    writeFileSync(
      path.join(TEST_MIGRATIONS_DIR, "001_invalid.sql"),
      `THIS IS NOT VALID SQL;`
    )

    const runner = new MigrationRunner(testDb, TEST_MIGRATIONS_DIR)
    
    expect(() => runner.runMigrationsSync()).toThrow()
  })

  test("should not record failed migration", () => {
    writeFileSync(
      path.join(TEST_MIGRATIONS_DIR, "001_invalid.sql"),
      `INVALID SQL HERE;`
    )

    const runner = new MigrationRunner(testDb, TEST_MIGRATIONS_DIR)
    
    try {
      runner.runMigrationsSync()
    } catch {
      // Expected to fail
    }

    const migrations = testDb.query(`SELECT * FROM _migrations`).all()
    expect(migrations).toHaveLength(0)
  })

  test("should stop at first failed migration", () => {
    writeFileSync(
      path.join(TEST_MIGRATIONS_DIR, "001_good.sql"),
      `CREATE TABLE test1 (id TEXT);`
    )
    writeFileSync(
      path.join(TEST_MIGRATIONS_DIR, "002_bad.sql"),
      `INVALID SQL;`
    )
    writeFileSync(
      path.join(TEST_MIGRATIONS_DIR, "003_good.sql"),
      `CREATE TABLE test3 (id TEXT);`
    )

    const runner = new MigrationRunner(testDb, TEST_MIGRATIONS_DIR)
    
    try {
      runner.runMigrationsSync()
    } catch {
      // Expected to fail
    }

    const migrations = testDb.query(`SELECT * FROM _migrations`).all()
    expect(migrations).toHaveLength(1) // Only first migration should succeed
    expect((migrations[0] as any).name).toBe("good")
  })
})

describe("MigrationRunner - Create Migration", () => {
  test("should create new migration file with correct naming", () => {
    const filepath = MigrationRunner.createMigration("test_feature", TEST_MIGRATIONS_DIR)
    
    expect(existsSync(filepath)).toBe(true)
    expect(filepath).toContain("001_test_feature.sql")
  })

  test("should increment migration number correctly", () => {
    // Create first migration
    const first = MigrationRunner.createMigration("first", TEST_MIGRATIONS_DIR)
    expect(first).toContain("001_first.sql")

    // Create second migration
    const second = MigrationRunner.createMigration("second", TEST_MIGRATIONS_DIR)
    expect(second).toContain("002_second.sql")

    // Create third migration
    const third = MigrationRunner.createMigration("third", TEST_MIGRATIONS_DIR)
    expect(third).toContain("003_third.sql")
  })

  test("should sanitize migration name", () => {
    const filepath = MigrationRunner.createMigration("Add User Table & Index!", TEST_MIGRATIONS_DIR)
    
    // Name gets sanitized to lowercase with underscores, trailing punctuation becomes _
    expect(filepath).toContain("001_add_user_table_index")
    expect(filepath).toMatch(/001_add_user_table_index_?\.sql/)
  })

  test("should create migration with template content", () => {
    const filepath = MigrationRunner.createMigration("test", TEST_MIGRATIONS_DIR)
    const content = Bun.file(filepath).text()
    
    expect(content).resolves.toContain("-- Migration: test")
    expect(content).resolves.toContain("-- Add your SQL statements here")
  })
})
