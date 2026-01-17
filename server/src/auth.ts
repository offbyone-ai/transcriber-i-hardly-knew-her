/**
 * Better Auth Configuration with Drizzle ORM
 */

import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import type { BetterAuthOptions } from "better-auth"
import { Resend } from "resend"
import { magicLink } from "better-auth/plugins"
import { passkey } from "@better-auth/passkey"
import { db, sqlite } from "./db"
import * as schema from "./db/schema"

// Initialize Resend for email sending (if API key is configured)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  trustedOrigins: ["http://localhost:5173", "http://localhost:3847"],
  advanced: {
    cookiePrefix: "transcriber",
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  plugins: [
    passkey({
      rpID: process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL).hostname : "localhost",
      rpName: "Transcriber",
      // In dev, client runs on :5173; in prod, BETTER_AUTH_URL points to the actual domain
      origin: process.env.BETTER_AUTH_URL || "http://localhost:5173",
    }),
    magicLink({
      sendMagicLink: async ({ email, url, token }) => {
        // In development mode, always log to console instead of sending email
        const isDev = process.env.NODE_ENV !== 'production'
        if (isDev) {
          console.log('\n' + '='.repeat(80))
          console.log('✨ MAGIC LINK (Development Mode)')
          console.log('='.repeat(80))
          console.log(`📧 Email: ${email}`)
          console.log(`🔗 Link:  ${url}`)
          console.log(`🎫 Token: ${token}`)
          console.log('='.repeat(80) + '\n')
          console.log('👉 Click or copy this link to sign in:\n   ' + url + '\n')

          // Store the URL temporarily for the client to fetch
          if (!global.devMagicLinks) {
            global.devMagicLinks = new Map()
          }
          global.devMagicLinks.set(email, url)
          setTimeout(() => global.devMagicLinks?.delete(email), 300000) // Clean up after 5 min

          return
        }

        // Production mode - send actual email
        if (!resend) {
          throw new Error('Email service not configured. Set RESEND_API_KEY environment variable.')
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
