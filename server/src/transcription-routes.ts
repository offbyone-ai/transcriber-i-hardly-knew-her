import { Hono } from 'hono'
import { auth } from './auth'
import { transcribeAudio, preloadModel } from './transcription'
import { 
  getUserUsage, 
  canUseServerTranscription, 
  recordTranscriptionUsage,
  getUserUsageHistory,
  FREE_TIER_MONTHLY_LIMIT 
} from './usage'

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

// POST /api/transcription/transcribe - Transcribe uploaded audio
transcriptionRoutes.post('/transcribe', async (c) => {
  const user = c.get('user')
  
  try {
    // Check usage limits
    const canUse = await canUseServerTranscription(user.id)
    if (!canUse) {
      const usage = await getUserUsage(user.id)
      return c.json({ 
        error: 'Monthly limit reached',
        message: `You've used all ${FREE_TIER_MONTHLY_LIMIT} free server transcriptions this month. Your limit resets on ${usage.resetsAt.toLocaleDateString()}.`,
        usage,
        suggestion: 'Try using local (in-browser) transcription instead - it\'s unlimited and keeps your data 100% private!'
      }, 429)
    }
    
    const contentType = c.req.header('Content-Type') || ''
    
    let audioData: Float32Array
    let modelName = 'base.en'
    let language: string | undefined
    let audioLengthSeconds: number | undefined
    
    if (contentType.includes('multipart/form-data')) {
      // Handle form data upload with raw Float32Array
      const formData = await c.req.formData()
      const audioFile = formData.get('audio') as File | null
      modelName = (formData.get('model') as string) || 'base.en'
      language = (formData.get('language') as string) || undefined
      const duration = formData.get('duration') as string | null
      audioLengthSeconds = duration ? parseFloat(duration) : undefined
      
      if (!audioFile) {
        return c.json({ error: 'No audio file provided' }, 400)
      }
      
      // Audio file is raw Float32Array binary data
      const arrayBuffer = await audioFile.arrayBuffer()
      audioData = new Float32Array(arrayBuffer)
    } else if (contentType.includes('application/octet-stream')) {
      // Handle raw Float32Array binary
      const arrayBuffer = await c.req.arrayBuffer()
      audioData = new Float32Array(arrayBuffer)
      modelName = c.req.query('model') || 'base.en'
      language = c.req.query('language') || undefined
      const duration = c.req.query('duration')
      audioLengthSeconds = duration ? parseFloat(duration) : undefined
    } else {
      return c.json({ 
        error: 'Invalid content type. Use multipart/form-data or application/octet-stream' 
      }, 400)
    }
    
    console.log(`📤 Received audio from user ${user.id.slice(0, 8)}...: ${audioData.length} samples (${(audioData.length / 16000).toFixed(1)}s)`)
    
    // Transcribe
    const result = await transcribeAudio(audioData, { modelName, language })
    
    // Record usage (ONLY metadata - no audio or transcription content stored)
    await recordTranscriptionUsage(user.id, {
      modelUsed: modelName,
      processingTimeMs: result.processingTimeMs,
      audioLengthSeconds,
    })
    
    // Get updated usage
    const usage = await getUserUsage(user.id)
    
    // Return transcription (audio is discarded after processing)
    return c.json({
      success: true,
      transcription: {
        text: result.text,
        segments: result.segments,
        language: result.language,
        processingTimeMs: result.processingTimeMs,
        modelUsed: modelName,
      },
      usage,
      privacy: {
        audioStored: false,
        transcriptionStored: false,
        message: 'Your audio was processed and immediately discarded. We only track usage counts.',
      }
    })
    
  } catch (error) {
    console.error('Transcription error:', error)
    return c.json({ 
      error: 'Transcription failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// GET /api/transcription/usage - Get current usage info
transcriptionRoutes.get('/usage', async (c) => {
  const user = c.get('user')
  
  const usage = await getUserUsage(user.id)
  
  return c.json({
    usage,
    privacy: {
      whatWeStore: 'Only usage counts and processing metadata (model used, processing time)',
      whatWeDontStore: 'Audio files, transcription text, or any content data',
      dataRetention: 'Usage logs are kept for billing purposes only',
    }
  })
})

// GET /api/transcription/history - Get usage history (for transparency)
transcriptionRoutes.get('/history', async (c) => {
  const user = c.get('user')
  
  const history = await getUserUsageHistory(user.id, 20)
  const usage = await getUserUsage(user.id)
  
  return c.json({
    usage,
    history,
    note: 'This shows when you used server transcription. We do not store your audio or transcriptions.',
  })
})

// GET /api/transcription/status - Check if transcription service is ready
transcriptionRoutes.get('/status', async (c) => {
  const user = c.get('user')
  
  const usage = await getUserUsage(user.id)
  
  return c.json({
    ready: true,
    models: ['tiny', 'tiny.en', 'base', 'base.en', 'small', 'small.en'],
    defaultModel: 'base.en',
    usage,
    freeTierLimit: FREE_TIER_MONTHLY_LIMIT,
  })
})

// POST /api/transcription/preload - Pre-load a model (optional)
transcriptionRoutes.post('/preload', async (c) => {
  const { model } = await c.req.json()
  const modelName = model || 'base.en'
  
  try {
    await preloadModel(modelName)
    return c.json({ success: true, model: modelName })
  } catch (error) {
    return c.json({ 
      error: 'Failed to preload model',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

export { transcriptionRoutes }
