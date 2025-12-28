import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { ApiResponse } from 'shared/dist'
import { auth } from './auth'

const app = new Hono()

app.use(cors({
  origin: (origin) => origin || 'http://localhost:5173',
  credentials: true,
}))

// Mount better-auth handler
app.on(['POST', 'GET'], '/api/auth/*', (c) => {
  return auth.handler(c.req.raw)
})

app.get('/', (c) => {
  return c.text('Transcriber API Server')
})

app.get('/hello', async (c) => {
  const data: ApiResponse = {
    message: "Hello from Transcriber API!",
    success: true
  }

  return c.json(data, { status: 200 })
})

export default app
