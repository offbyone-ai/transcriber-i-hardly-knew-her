import { betterAuth } from "better-auth"
import { Database } from "bun:sqlite"
import path from "path"
import type { BetterAuthOptions } from "better-auth"

const dbPath = path.join(process.cwd(), "auth.db")
const db = new Database(dbPath)

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
