/**
 * Drizzle ORM Schema for Transcriber App
 * 
 * This includes:
 * - Better Auth core tables (user, session, account, verification)
 * - Passkey plugin table
 * - Server transcription usage tracking
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

// ============================================================================
// Better Auth Core Tables
// ============================================================================

/**
 * User table - core user information
 */
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
})

/**
 * Session table - active user sessions
 */
export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('idx_session_userId').on(table.userId),
  index('idx_session_token').on(table.token),
])

/**
 * Account table - for OAuth and password auth
 */
export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refreshTokenExpiresAt', { mode: 'timestamp' }),
  scope: text('scope'),
  idToken: text('idToken'),
  password: text('password'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('idx_account_userId').on(table.userId),
])

/**
 * Verification table - for email verification, password reset, magic links
 */
export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }),
}, (table) => [
  index('idx_verification_identifier').on(table.identifier),
])

// ============================================================================
// Better Auth Passkey Plugin Table
// ============================================================================

/**
 * Passkey table - WebAuthn/FIDO2 credentials
 */
export const passkey = sqliteTable('passkey', {
  id: text('id').primaryKey(),
  name: text('name'),
  publicKey: text('publicKey').notNull(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  credentialID: text('credentialID').notNull(),
  counter: integer('counter').notNull(),
  deviceType: text('deviceType').notNull(),
  backedUp: integer('backedUp', { mode: 'boolean' }).notNull(),
  transports: text('transports'),
  createdAt: integer('createdAt', { mode: 'timestamp' }),
  aaguid: text('aaguid'),
}, (table) => [
  index('idx_passkey_userId').on(table.userId),
  index('idx_passkey_credentialID').on(table.credentialID),
])

// ============================================================================
// Application-specific Tables
// ============================================================================

/**
 * Server transcription usage tracking
 */
export const serverTranscriptionUsage = sqliteTable('server_transcription_usage', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  monthYear: text('monthYear').notNull(), // Format: "2024-01"
  usageCount: integer('usageCount').notNull().default(0),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('idx_usage_userId_month').on(table.userId, table.monthYear),
])
