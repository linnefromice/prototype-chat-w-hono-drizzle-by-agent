import { serve } from '@hono/node-server'
import app from './app'
import { loadEnvConfig } from './utils/env'

const env = loadEnvConfig()

serve({
  fetch: app.fetch,
  port: env.PORT,
})

console.log(`Backend listening on http://localhost:${env.PORT}`)
