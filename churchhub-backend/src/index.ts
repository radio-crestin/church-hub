import { Hono } from 'hono'
import { logger } from 'hono/logger'
import type { Bindings } from './types'
import {
  createSecurityMiddleware,
  createCorsMiddleware,
} from './middleware/security'
import auth from './routes/auth'
import feedback from './routes/feedback'
import health from './routes/health'

const app = new Hono<{ Bindings: Bindings }>()

// Apply security headers
for (const middleware of createSecurityMiddleware()) {
  app.use('*', middleware)
}

// Apply CORS middleware
app.use('*', createCorsMiddleware())

// Request logging
app.use('*', logger())

// Mount routes
app.route('/', health)
app.route('/', auth)
app.route('/', feedback)

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404))

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
