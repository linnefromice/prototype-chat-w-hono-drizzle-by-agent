import { config } from 'dotenv'

export type EnvConfig = {
  DATABASE_URL: string
  PORT: number
}

export const loadEnvConfig = (): EnvConfig => {
  config()

  const databaseUrl = process.env.DATABASE_URL
  const port = process.env.PORT ? Number(process.env.PORT) : 3000

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }

  return {
    DATABASE_URL: databaseUrl,
    PORT: port,
  }
}
