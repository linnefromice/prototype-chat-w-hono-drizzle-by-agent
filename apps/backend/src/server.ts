import { serve } from '@hono/node-server'
import app from './app'
import { loadEnvConfig } from './utils/env'
import { seedDevelopmentUsers } from './infrastructure/db/seeds/users'

const env = loadEnvConfig()

// Run seeds in development mode
async function startServer() {
  await seedDevelopmentUsers()

  serve({
    fetch: app.fetch,
    port: env.PORT,
  })

  console.log(`Backend listening on http://localhost:${env.PORT}`)
}

startServer().catch(error => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
