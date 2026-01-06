import { db, serverTranscriptionUsage, user } from './db'
import { eq, and, gte, sql, desc } from 'drizzle-orm'

// Free tier: 3 server transcriptions per month
export const FREE_TIER_MONTHLY_LIMIT = 3

export type UsageInfo = {
  used: number
  limit: number
  remaining: number
  resetsAt: Date
  isPremium: boolean
}

/**
 * Get the start of the current billing month (1st of the month, 00:00:00 UTC)
 */
function getCurrentMonthStart(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
}

/**
 * Get the start of the next billing month
 */
function getNextMonthStart(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0))
}

/**
 * Get current month in format "YYYY-MM"
 */
function getCurrentMonthYear(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Get usage info for a user
 */
export async function getUserUsage(userId: string): Promise<UsageInfo> {
  const monthYear = getCurrentMonthYear()
  const nextMonth = getNextMonthStart()
  
  // Get usage count for this month
  const result = await db
    .select({ usageCount: serverTranscriptionUsage.usageCount })
    .from(serverTranscriptionUsage)
    .where(
      and(
        eq(serverTranscriptionUsage.userId, userId),
        eq(serverTranscriptionUsage.monthYear, monthYear)
      )
    )
    .limit(1)
  
  const used = result[0]?.usageCount || 0
  
  // For now, everyone is on free tier
  const isPremium = false
  const limit = isPremium ? Infinity : FREE_TIER_MONTHLY_LIMIT
  
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetsAt: nextMonth,
    isPremium,
  }
}

/**
 * Check if user can use server transcription
 */
export async function canUseServerTranscription(userId: string): Promise<boolean> {
  const usage = await getUserUsage(userId)
  return usage.remaining > 0
}

/**
 * Record a server transcription usage
 * Note: We only store the userId and timestamp - NO audio, NO transcription content
 * This is purely for usage tracking and rate limiting
 */
export async function recordTranscriptionUsage(
  userId: string,
  metadata: {
    modelUsed: string
    processingTimeMs: number
    audioLengthSeconds?: number
  }
): Promise<void> {
  const monthYear = getCurrentMonthYear()
  const now = new Date()
  
  // Try to update existing record for this month
  const existing = await db
    .select()
    .from(serverTranscriptionUsage)
    .where(
      and(
        eq(serverTranscriptionUsage.userId, userId),
        eq(serverTranscriptionUsage.monthYear, monthYear)
      )
    )
    .limit(1)
  
  if (existing.length > 0 && existing[0]) {
    // Increment count
    await db
      .update(serverTranscriptionUsage)
      .set({ 
        usageCount: sql`${serverTranscriptionUsage.usageCount} + 1`,
        updatedAt: now 
      })
      .where(eq(serverTranscriptionUsage.id, existing[0].id))
  } else {
    // Create new record
    await db.insert(serverTranscriptionUsage).values({
      id: crypto.randomUUID(),
      userId,
      monthYear,
      usageCount: 1,
      createdAt: now,
      updatedAt: now,
    })
  }
  
  console.log(`📊 Usage recorded for user ${userId.slice(0, 8)}... (model: ${metadata.modelUsed})`)
}

/**
 * Get usage history for a user (for transparency)
 */
export async function getUserUsageHistory(userId: string, limit: number = 10): Promise<Array<{
  monthYear: string
  usageCount: number
}>> {
  const results = await db
    .select({
      monthYear: serverTranscriptionUsage.monthYear,
      usageCount: serverTranscriptionUsage.usageCount,
    })
    .from(serverTranscriptionUsage)
    .where(eq(serverTranscriptionUsage.userId, userId))
    .orderBy(desc(serverTranscriptionUsage.monthYear))
    .limit(limit)
  
  return results
}
