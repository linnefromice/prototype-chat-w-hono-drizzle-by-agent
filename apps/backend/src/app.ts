import { Hono } from 'hono'
import healthRouter from './routes/health'
import itemsRouter from './routes/items'
import conversationsRouter from './routes/conversations'
import messagesRouter from './routes/messages'

const app = new Hono()

app.route('/health', healthRouter)
app.route('/items', itemsRouter)
app.route('/conversations', conversationsRouter)
app.route('/messages', messagesRouter)

export default app
