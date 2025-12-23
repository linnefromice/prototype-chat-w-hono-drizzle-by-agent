import { Hono } from 'hono'
import { errorHandler } from './middleware/errorHandler'
import healthRouter from './routes/health'
import conversationsRouter from './routes/conversations'
import messagesRouter from './routes/messages'
import usersRouter from './routes/users'

const app = new Hono()

// Global error handler
app.onError(errorHandler)

app.route('/health', healthRouter)
app.route('/conversations', conversationsRouter)
app.route('/messages', messagesRouter)
app.route('/users', usersRouter)

export default app
