import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { loadEnvConfig } from '../../utils/env'

const env = loadEnvConfig()

const pool = new Pool({
  connectionString: env.DATABASE_URL,
})

export const db = drizzle(pool)
