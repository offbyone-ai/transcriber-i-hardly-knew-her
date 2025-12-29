import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/bun'
import type { ApiResponse } from 'shared/dist'
import { auth } from './auth'

const app = new Hono()

// Logger middleware - logs all requests with timing
app.use('*', logger())

// CORS configuration - only for API routes
app.use('/api/*', cors({
  origin: (origin) => origin || 'http://localhost:5173',
  credentials: true,
}))

// Mount better-auth handler
app.on(['POST', 'GET'], '/api/auth/*', (c) => {
  return auth.handler(c.req.raw)
})

// API routes
app.get('/api', (c) => {
  return c.text('Transcriber API Server')
})

app.get('/api/hello', async (c) => {
  const data: ApiResponse = {
    message: "Hello from Transcriber API!",
    success: true
  }

  return c.json(data, { status: 200 })
})

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Serve React app at root
app.get('/', serveStatic({ path: './static/index.html' }))

// Serve React app static assets with proper MIME types
// Must use app.get to ensure it runs before the catch-all
app.get('/assets/*', serveStatic({ 
  root: './static'
}))

// Serve vite.svg and other root static files
app.get('/vite.svg', serveStatic({ path: './static/vite.svg' }))

// SPA fallback: serve index.html for all other routes (client-side routing)
// This must come LAST to avoid catching asset requests
app.get('/*', serveStatic({ path: './static/index.html' }))

export default app

// Start server when running in dev mode (not compiled executable)
// Note: When compiled with `bun build --compile`, Bun automatically starts
// the server using the exported default app, so this block is skipped
if (import.meta.main && !Bun.main.includes('transcriber')) {
  const port = process.env.PORT || 3000
  console.log(`🚀 Transcriber server starting on port ${port}`)
  
  Bun.serve({
    fetch: app.fetch,
    port: Number(port),
  })
  
  console.log(`✅ Server running at http://localhost:${port}`)
}
