import { Hono } from 'hono'
import type { Bindings } from './types'
import {
  createSecurityMiddleware,
  createCorsMiddleware,
} from './middleware/security'
import { requestLogger } from './middleware/requestLogger'
import auth from './routes/auth'
import backup from './routes/backup'
import featureRequests from './routes/feature-requests'
import health from './routes/health'
import signal from './routes/signal'
import sync from './routes/sync'
import syncOwner from './routes/syncOwner'

const app = new Hono<{ Bindings: Bindings }>()

// Apply security headers
for (const middleware of createSecurityMiddleware()) {
  app.use('*', middleware)
}

// Apply CORS middleware
app.use('*', createCorsMiddleware())

// Request logging: route patterns only, never raw paths or query strings
app.use('*', requestLogger())

// Mount routes
app.route('/', health)
app.route('/', auth)
app.route('/', featureRequests)
app.route('/', signal)
app.route('/', sync)
app.route('/', syncOwner)
app.route('/', backup)

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404))

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
