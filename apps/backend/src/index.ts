import { Hono } from 'hono'
import type { Env } from './infrastructure/db/client.d1'
import { createD1Client } from './infrastructure/db/client.d1'
import { createAuth } from './infrastructure/auth'
import healthRouter from './routes/health'
import conversationsRouter from './routes/conversations'
import messagesRouter from './routes/messages'
import usersRouter from './routes/users'
import authExampleRouter from './routes/auth-example'

// Cloudflare Workers entry point with D1 bindings
const app = new Hono<{ Bindings: Env }>()

// Better Auth authentication handler
// Automatically handles: /api/auth/sign-up/username, /api/auth/sign-in/username, /api/auth/sign-out, etc.
// Use app.on() to catch all HTTP methods for auth routes
// Important: Use single asterisk (*) not double (**) for path matching
app.on(['POST', 'GET'], '/api/auth/*', async (c) => {
  // In test/development mode, use the local BetterSQLite3 database
  // In production, use Cloudflare D1
  let db
  if (process.env.NODE_ENV === 'test' || !c.env?.DB) {
    // Use local BetterSQLite3 database for tests
    const { db: localDb } = await import('./infrastructure/db/client')
    db = localDb as any // Cast to satisfy TypeScript - BetterAuth works with both
  } else {
    // Use Cloudflare D1 in production
    db = createD1Client(c.env.DB)
  }

  const auth = createAuth(db)
  return auth.handler(c.req.raw)
})

// Application routes
app.route('/health', healthRouter)
app.route('/conversations', conversationsRouter)
app.route('/messages', messagesRouter)
app.route('/users', usersRouter)

// Protected routes examples (demonstrating authentication middleware)
app.route('/api/protected', authExampleRouter)

export default app
