import { betterAuth } from "better-auth"
import { Database } from "bun:sqlite"
import path from "path"
import { mkdirSync, existsSync } from "node:fs"
import type { BetterAuthOptions } from "better-auth"
import { MigrationRunner } from "./db/migrate"
import { Resend } from "resend"
import { magicLink } from "better-auth/plugins"

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

// Export the database for use in other modules
export { db }

// Initialize Resend for email sending (if API key is configured)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

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
  trustedOrigins: ["http://localhost:5173", "http://localhost:3000"],
  advanced: {
    cookiePrefix: "transcriber",
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url, token }) => {
        if (!resend) {
          console.warn('⚠️  Resend not configured - using development mode')
          console.log('\n' + '='.repeat(80))
          console.log('✨ MAGIC LINK (Development Mode)')
          console.log('='.repeat(80))
          console.log(`📧 Email: ${email}`)
          console.log(`🔗 Link:  ${url}`)
          console.log(`🎫 Token: ${token}`)
          console.log('='.repeat(80) + '\n')
          console.log('👉 Click or copy this link to sign in:\n   ' + url + '\n')
          
          // Store the URL temporarily for the dev response
          // This is a simple in-memory store for dev mode only
          if (!global.devMagicLinks) {
            global.devMagicLinks = new Map()
          }
          global.devMagicLinks.set(email, url)
          setTimeout(() => global.devMagicLinks?.delete(email), 10000) // Clean up after 10s
          
          return
        }
        
        try {
          
          const result = await resend.emails.send({
            from: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
            to: email,
            subject: 'Sign in to Transcriber',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Sign in to Transcriber</h2>
                <p>Click the button below to sign in to your account. This link will expire in 5 minutes.</p>
                <p style="margin: 30px 0;">
                  <a href="${url}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                    Sign In
                  </a>
                </p>
                <p style="color: #666; font-size: 14px;">
                  If the button doesn't work, copy and paste this link into your browser:<br>
                  <a href="${url}">${url}</a>
                </p>
                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                  If you didn't request this email, you can safely ignore it.
                </p>
              </div>
            `,
          })
          if(!result.data?.id || result.error) {
            throw new Error(result.error?.message ?? 'Failed to send email')
          }
          console.log(`✨ Magic link sent to ${email}`)
        } catch (error) {
          console.error(`❌ Failed to send magic link to ${email}:`, error)
          throw error
        }
      },
      expiresIn: 60 * 5, // 5 minutes
    }),
  ],
} as BetterAuthOptions)

export type Session = typeof auth.$Infer.Session
