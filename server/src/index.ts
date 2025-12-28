import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/bun'
import type { ApiResponse } from 'shared/dist'
import { auth } from './auth'

const app = new Hono()

// CORS configuration
app.use(cors({
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

// Serve static files (client build) for production
app.use('/*', serveStatic({ root: './static' }))

// Fallback to index.html for client-side routing
app.get('/*', serveStatic({ path: './static/index.html' }))

export default app

// Start server when running as executable or in dev mode
if (import.meta.main) {
  const port = process.env.PORT || 3000
  console.log(`🚀 Transcriber server starting on port ${port}`)
  
  Bun.serve({
    fetch: app.fetch,
    port: Number(port),
  })
  
  console.log(`✅ Server running at http://localhost:${port}`)
}
