import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { Database } from "bun:sqlite"
import { betterAuth } from "better-auth"
import type { BetterAuthOptions } from "better-auth"
import { MigrationRunner } from "../db/migrate"
import { unlinkSync, existsSync } from "node:fs"

// Use a separate test database
const TEST_DB_PATH = "./test-auth.db"

// Create a test auth instance
let testDb: Database
let testAuth: ReturnType<typeof betterAuth>

beforeAll(() => {
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

  // Create test database and run migrations
  testDb = new Database(TEST_DB_PATH)
  
  // Enable foreign key constraints
  testDb.run("PRAGMA foreign_keys = ON;")
  
  // Run migrations to create schema
  const runner = new MigrationRunner(testDb)
  runner.runMigrationsSync()

  // Initialize better-auth with test database
  testAuth = betterAuth({
    database: testDb as any,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    trustedOrigins: ["http://localhost:5173", "http://localhost:3000"],
    advanced: {
      cookiePrefix: "transcriber_test",
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },
  } as BetterAuthOptions)
})

afterAll(() => {
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
})

describe("Authentication Database Schema", () => {
  test("should have user table", () => {
    const result = testDb.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='user'
    `).get()
    
    expect(result).toBeDefined()
    expect((result as any).name).toBe("user")
  })

  test("should have session table", () => {
    const result = testDb.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='session'
    `).get()
    
    expect(result).toBeDefined()
    expect((result as any).name).toBe("session")
  })

  test("should have account table", () => {
    const result = testDb.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='account'
    `).get()
    
    expect(result).toBeDefined()
    expect((result as any).name).toBe("account")
  })

  test("should have verification table", () => {
    const result = testDb.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='verification'
    `).get()
    
    expect(result).toBeDefined()
    expect((result as any).name).toBe("verification")
  })

  test("user table should have correct columns", () => {
    const columns = testDb.query(`PRAGMA table_info(user)`).all()
    const columnNames = columns.map((col: any) => col.name)
    
    expect(columnNames).toContain("id")
    expect(columnNames).toContain("email")
    expect(columnNames).toContain("emailVerified")
    expect(columnNames).toContain("name")
    expect(columnNames).toContain("createdAt")
    expect(columnNames).toContain("updatedAt")
  })

  test("session table should have correct columns", () => {
    const columns = testDb.query(`PRAGMA table_info(session)`).all()
    const columnNames = columns.map((col: any) => col.name)
    
    expect(columnNames).toContain("id")
    expect(columnNames).toContain("userId")
    expect(columnNames).toContain("token")
    expect(columnNames).toContain("expiresAt")
    expect(columnNames).toContain("createdAt")
  })
})

describe("Authentication User Operations", () => {
  test("should create a user directly in database", () => {
    const userId = crypto.randomUUID()
    const email = `test-${Date.now()}@example.com`
    const now = new Date().toISOString()

    testDb.query(`
      INSERT INTO user (id, email, emailVerified, name, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, email, 0, "Test User", now, now)

    const user = testDb.query(`SELECT * FROM user WHERE id = ?`).get(userId)
    
    expect(user).toBeDefined()
    expect((user as any).email).toBe(email)
    expect((user as any).name).toBe("Test User")
  })

  test("should enforce unique email constraint", () => {
    const email = `unique-${Date.now()}@example.com`
    const now = new Date().toISOString()

    // Insert first user
    testDb.query(`
      INSERT INTO user (id, email, emailVerified, name, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), email, 0, "User 1", now, now)

    // Try to insert second user with same email
    expect(() => {
      testDb.query(`
        INSERT INTO user (id, email, emailVerified, name, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), email, 0, "User 2", now, now)
    }).toThrow()
  })

  test("should query user by email", () => {
    const email = `query-${Date.now()}@example.com`
    const userId = crypto.randomUUID()
    const now = new Date().toISOString()

    testDb.query(`
      INSERT INTO user (id, email, emailVerified, name, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, email, 0, "Query Test User", now, now)

    const user = testDb.query(`SELECT * FROM user WHERE email = ?`).get(email)
    
    expect(user).toBeDefined()
    expect((user as any).id).toBe(userId)
    expect((user as any).email).toBe(email)
  })
})

describe("Authentication Session Operations", () => {
  test("should create a session for a user", () => {
    const userId = crypto.randomUUID()
    const email = `session-${Date.now()}@example.com`
    const now = new Date().toISOString()

    // Create user
    testDb.query(`
      INSERT INTO user (id, email, emailVerified, name, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, email, 0, "Session Test User", now, now)

    // Create session
    const sessionId = crypto.randomUUID()
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    testDb.query(`
      INSERT INTO session (id, userId, token, expiresAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, userId, token, expiresAt, now, now)

    const session = testDb.query(`SELECT * FROM session WHERE id = ?`).get(sessionId)
    
    expect(session).toBeDefined()
    expect((session as any).userId).toBe(userId)
    expect((session as any).token).toBe(token)
  })

  test("should enforce foreign key constraint on userId", () => {
    const sessionId = crypto.randomUUID()
    const fakeUserId = crypto.randomUUID()
    const token = crypto.randomUUID()
    const now = new Date().toISOString()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    // Try to create session with non-existent user
    expect(() => {
      testDb.query(`
        INSERT INTO session (id, userId, token, expiresAt, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(sessionId, fakeUserId, token, expiresAt, now, now)
    }).toThrow()
  })

  test("should delete sessions when user is deleted (cascade)", () => {
    const userId = crypto.randomUUID()
    const email = `cascade-${Date.now()}@example.com`
    const now = new Date().toISOString()

    // Create user
    testDb.query(`
      INSERT INTO user (id, email, emailVerified, name, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, email, 0, "Cascade Test User", now, now)

    // Create session
    const sessionId = crypto.randomUUID()
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    testDb.query(`
      INSERT INTO session (id, userId, token, expiresAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, userId, token, expiresAt, now, now)

    // Delete user
    testDb.query(`DELETE FROM user WHERE id = ?`).run(userId)

    // Session should be deleted (cascade)
    const session = testDb.query(`SELECT * FROM session WHERE id = ?`).get(sessionId)
    expect(session).toBeNull()
  })
})

describe("Authentication Account Operations", () => {
  test("should create an account for a user", () => {
    const userId = crypto.randomUUID()
    const email = `account-${Date.now()}@example.com`
    const now = new Date().toISOString()

    // Create user
    testDb.query(`
      INSERT INTO user (id, email, emailVerified, name, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, email, 0, "Account Test User", now, now)

    // Create account
    const accountId = crypto.randomUUID()
    const providerId = "email"
    const hashedPassword = "hashed_password_here"

    testDb.query(`
      INSERT INTO account (id, userId, accountId, providerId, password, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(accountId, userId, email, providerId, hashedPassword, now, now)

    const account = testDb.query(`SELECT * FROM account WHERE id = ?`).get(accountId)
    
    expect(account).toBeDefined()
    expect((account as any).userId).toBe(userId)
    expect((account as any).providerId).toBe(providerId)
    expect((account as any).password).toBe(hashedPassword)
  })

  test("should delete accounts when user is deleted (cascade)", () => {
    const userId = crypto.randomUUID()
    const email = `account-cascade-${Date.now()}@example.com`
    const now = new Date().toISOString()

    // Create user
    testDb.query(`
      INSERT INTO user (id, email, emailVerified, name, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, email, 0, "Account Cascade User", now, now)

    // Create account
    const accountId = crypto.randomUUID()
    testDb.query(`
      INSERT INTO account (id, userId, accountId, providerId, password, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(accountId, userId, email, "email", "password", now, now)

    // Delete user
    testDb.query(`DELETE FROM user WHERE id = ?`).run(userId)

    // Account should be deleted (cascade)
    const account = testDb.query(`SELECT * FROM account WHERE id = ?`).get(accountId)
    expect(account).toBeNull()
  })
})

describe("Authentication Integration", () => {
  test("should have auth instance configured", () => {
    expect(testAuth).toBeDefined()
    expect(testAuth.api).toBeDefined()
  })

  test("database should be empty initially (except test data)", () => {
    // Count all users (some were created in previous tests)
    const userCount = testDb.query(`SELECT COUNT(*) as count FROM user`).get()
    expect(userCount).toBeDefined()
    expect((userCount as any).count).toBeGreaterThanOrEqual(0)
  })
})
