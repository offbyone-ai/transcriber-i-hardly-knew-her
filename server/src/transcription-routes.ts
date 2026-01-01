import { Hono } from 'hono'
import { auth } from './auth'
import { 
  getUserUsage, 
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

// POST /api/transcription/transcribe - Server transcription is disabled
transcriptionRoutes.post('/transcribe', async (c) => {
  return c.json({ 
    error: 'Server transcription is currently disabled',
    message: 'Please use local (in-browser) transcription instead. It runs on your device GPU and keeps your data 100% private!',
    suggestion: 'Select "Local (Browser)" mode in the transcription settings.'
  }, 503)
})

// GET /api/transcription/usage - Get current usage info
transcriptionRoutes.get('/usage', async (c) => {
  const user = c.get('user')
  
  const usage = await getUserUsage(user.id)
  
  return c.json({
    usage,
    serverTranscriptionEnabled: false,
    message: 'Server transcription is currently disabled. Please use local (in-browser) transcription.',
  })
})

// GET /api/transcription/status - Check if transcription service is ready
transcriptionRoutes.get('/status', async (c) => {
  const user = c.get('user')
  
  const usage = await getUserUsage(user.id)
  
  return c.json({
    ready: false,
    enabled: false,
    message: 'Server transcription is currently disabled. Please use local (in-browser) transcription.',
    models: [],
    defaultModel: null,
    usage,
    freeTierLimit: FREE_TIER_MONTHLY_LIMIT,
  })
})

// POST /api/transcription/preload - Disabled
transcriptionRoutes.post('/preload', async (c) => {
  return c.json({ 
    error: 'Server transcription is currently disabled',
    message: 'Model preloading is not available. Please use local (in-browser) transcription.'
  }, 503)
})

export { transcriptionRoutes }
