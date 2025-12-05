import { defineConfig } from 'drizzle-kit'
import { loadEnvConfig } from './src/utils/env'

const env = loadEnvConfig()

export default defineConfig({
  schema: './src/infrastructure/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: env.DATABASE_URL,
  },
})
