import { Hono } from 'hono'
import { auth } from './auth'
import {
  getUserUsage,
  canUseServerTranscription,
  recordTranscriptionUsage,
  FREE_TIER_MONTHLY_LIMIT
} from './usage'
import {
  transcribeAudio,
  isServerTranscriptionEnabled,
  getAvailableModels,
  getDefaultModel,
} from './transcription'

type Variables = {
  user: { id: string }
  session: any
}

const transcriptionRoutes = new Hono<{ Variables: Variables }>()

// Middleware: require authentication
transcriptionRoutes.use('/*', async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })

  if (!session?.user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Attach user to context
  c.set('user', session.user as { id: string })
  c.set('session', session.session)

  await next()
})

// POST /api/transcription/transcribe - Transcribe audio
transcriptionRoutes.post('/transcribe', async (c) => {
  const user = c.get('user')

  // Check if server transcription is enabled
  if (!isServerTranscriptionEnabled()) {
    return c.json({
      error: 'Server transcription is not configured',
      message: 'The server administrator has not configured a Whisper API. Please use local (in-browser) transcription instead.',
      suggestion: 'Select "Local (Browser)" mode in the transcription settings.'
    }, 503)
  }

  // Check usage quota
  const canUse = await canUseServerTranscription(user.id)
  if (!canUse) {
    const usage = await getUserUsage(user.id)
    return c.json({
      error: 'Monthly limit reached',
      message: `You've used all ${usage.limit} server transcriptions for this month. Resets on ${usage.resetsAt.toISOString().split('T')[0]}.`,
      usage,
      suggestion: 'Use local (in-browser) transcription, which has no limits.'
    }, 429)
  }

  try {
    // Parse the form data
    const formData = await c.req.formData()
    const audioFile = formData.get('audio') as Blob | null
    const modelName = formData.get('model') as string | null
    const language = formData.get('language') as string | null
    const durationStr = formData.get('duration') as string | null

    if (!audioFile) {
      return c.json({ error: 'No audio file provided' }, 400)
    }

    // Convert blob to Float32Array (client sends raw PCM)
    const arrayBuffer = await audioFile.arrayBuffer()
    const audioData = new Float32Array(arrayBuffer)

    console.log(`[Transcription] Received ${audioData.length} samples from user ${user.id.slice(0, 8)}...`)

    // Transcribe
    const result = await transcribeAudio(audioData, {
      modelName: modelName || undefined,
      language: language || undefined,
    })

    // Record usage
    await recordTranscriptionUsage(user.id, {
      modelUsed: result.modelUsed,
      processingTimeMs: result.processingTimeMs,
      audioLengthSeconds: durationStr ? parseFloat(durationStr) : undefined,
    })

    // Get updated usage
    const usage = await getUserUsage(user.id)

    return c.json({
      success: true,
      transcription: {
        text: result.text,
        segments: result.segments,
        language: result.language,
        processingTimeMs: result.processingTimeMs,
        modelUsed: result.modelUsed,
      },
      usage: {
        used: usage.used,
        limit: usage.limit,
        remaining: usage.remaining,
        resetsAt: usage.resetsAt.toISOString(),
        isPremium: usage.isPremium,
      },
      privacy: {
        audioStored: false,
        transcriptionStored: false,
        message: 'Your audio is processed and immediately discarded. No data is stored on our servers.',
      },
    })
  } catch (error) {
    console.error('[Transcription] Error:', error)
    return c.json({
      error: 'Transcription failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    }, 500)
  }
})

// GET /api/transcription/usage - Get current usage info
transcriptionRoutes.get('/usage', async (c) => {
  const user = c.get('user')

  const usage = await getUserUsage(user.id)
  const enabled = isServerTranscriptionEnabled()

  return c.json({
    usage: {
      used: usage.used,
      limit: usage.limit,
      remaining: usage.remaining,
      resetsAt: usage.resetsAt.toISOString(),
      isPremium: usage.isPremium,
    },
    serverTranscriptionEnabled: enabled,
    message: enabled
      ? 'Server transcription is available.'
      : 'Server transcription is not configured. Please use local (in-browser) transcription.',
  })
})

// GET /api/transcription/status - Check if transcription service is ready
transcriptionRoutes.get('/status', async (c) => {
  const user = c.get('user')

  const usage = await getUserUsage(user.id)
  const enabled = isServerTranscriptionEnabled()

  return c.json({
    ready: enabled,
    enabled,
    message: enabled
      ? 'Server transcription is available.'
      : 'Server transcription is not configured. Please use local (in-browser) transcription.',
    models: enabled ? getAvailableModels() : [],
    defaultModel: enabled ? getDefaultModel() : null,
    usage: {
      used: usage.used,
      limit: usage.limit,
      remaining: usage.remaining,
      resetsAt: usage.resetsAt.toISOString(),
      isPremium: usage.isPremium,
    },
    freeTierLimit: FREE_TIER_MONTHLY_LIMIT,
  })
})

// POST /api/transcription/preload - Preload model (no-op for API-based)
transcriptionRoutes.post('/preload', async (c) => {
  if (!isServerTranscriptionEnabled()) {
    return c.json({
      error: 'Server transcription is not configured',
      message: 'Model preloading is not available. Please use local (in-browser) transcription.'
    }, 503)
  }

  return c.json({
    success: true,
    message: 'Model preloading is not required for API-based transcription.'
  })
})

export { transcriptionRoutes }
