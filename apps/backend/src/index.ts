import { Hono } from 'hono'
import type { Env } from './infrastructure/db/client.d1'
import healthRouter from './routes/health'
import conversationsRouter from './routes/conversations'
import messagesRouter from './routes/messages'
import usersRouter from './routes/users'

// Cloudflare Workers entry point with D1 bindings
const app = new Hono<{ Bindings: Env }>()

app.route('/health', healthRouter)
app.route('/conversations', conversationsRouter)
app.route('/messages', messagesRouter)
app.route('/users', usersRouter)

export default app
