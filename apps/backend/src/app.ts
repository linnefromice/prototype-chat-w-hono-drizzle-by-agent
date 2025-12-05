import { Hono } from 'hono'
import healthRouter from './routes/health'
import itemsRouter from './routes/items'
import conversationsRouter from './routes/conversations'
import messagesRouter from './routes/messages'
import usersRouter from './routes/users'

const app = new Hono()

app.route('/health', healthRouter)
app.route('/items', itemsRouter)
app.route('/conversations', conversationsRouter)
app.route('/messages', messagesRouter)
app.route('/users', usersRouter)

export default app
