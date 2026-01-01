import { db } from './auth'

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
 * Get usage info for a user
 */
export async function getUserUsage(userId: string): Promise<UsageInfo> {
  const monthStart = getCurrentMonthStart()
  const nextMonth = getNextMonthStart()
  
  // Count transcriptions this month
  const result = db.query(`
    SELECT COUNT(*) as count 
    FROM server_transcription_usage 
    WHERE user_id = ? AND created_at >= ?
  `).get(userId, monthStart.toISOString()) as { count: number }
  
  const used = result?.count || 0
  
  // Check if user is premium (future feature)
  const userResult = db.query(`
    SELECT is_premium FROM user WHERE id = ?
  `).get(userId) as { is_premium: number | null } | undefined
  
  const isPremium = userResult?.is_premium === 1
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
  db.run(`
    INSERT INTO server_transcription_usage (
      id, user_id, model_used, processing_time_ms, audio_length_seconds, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `, [
    crypto.randomUUID(),
    userId,
    metadata.modelUsed,
    metadata.processingTimeMs,
    metadata.audioLengthSeconds || null,
    new Date().toISOString()
  ])
  
  console.log(`📊 Usage recorded for user ${userId.slice(0, 8)}... (model: ${metadata.modelUsed})`)
}

/**
 * Get usage history for a user (for transparency)
 */
export async function getUserUsageHistory(userId: string, limit: number = 10): Promise<Array<{
  id: string
  modelUsed: string
  processingTimeMs: number
  audioLengthSeconds: number | null
  createdAt: string
}>> {
  const results = db.query(`
    SELECT id, model_used, processing_time_ms, audio_length_seconds, created_at
    FROM server_transcription_usage
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, limit) as Array<{
    id: string
    model_used: string
    processing_time_ms: number
    audio_length_seconds: number | null
    created_at: string
  }>
  
  return results.map(r => ({
    id: r.id,
    modelUsed: r.model_used,
    processingTimeMs: r.processing_time_ms,
    audioLengthSeconds: r.audio_length_seconds,
    createdAt: r.created_at,
  }))
}
