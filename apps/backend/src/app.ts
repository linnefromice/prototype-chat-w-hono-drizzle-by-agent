import { Hono } from 'hono'
import healthRouter from './routes/health'
import itemsRouter from './routes/items'

const app = new Hono()

app.route('/health', healthRouter)
app.route('/items', itemsRouter)

export default app
