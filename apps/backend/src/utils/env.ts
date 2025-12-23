import { config } from 'dotenv'
import { z } from 'zod'

// Zod schema for Node.js environment variables validation
const envSchema = z.object({
  // Database configuration (legacy, not used with D1)
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

  // Server configuration (for Node.js development server only)
  PORT: z.coerce.number().int().positive().default(3000),

  // Environment mode
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Better Auth configuration (optional for local dev)
  BETTER_AUTH_SECRET: z.string().optional(),

  // Base URL configuration (optional for local dev)
  // Allow empty string or undefined, which will be treated as undefined
  BASE_URL: z.union([z.string().url(), z.literal(''), z.undefined()]).transform(val => val === '' ? undefined : val).optional(),

  // Logging configuration
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export type EnvConfig = z.infer<typeof envSchema>

/**
 * Validates and loads environment variables from .env file
 * @throws {Error} If validation fails
 * @returns {EnvConfig} Validated environment configuration
 */
export const loadEnvConfig = (): EnvConfig => {
  // Load .env file
  config()

  try {
    // Validate environment variables
    const env = envSchema.parse(process.env)
    return env
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format validation errors for better readability
      const errorMessages = error.errors.map(err =>
        `  - ${err.path.join('.')}: ${err.message}`
      ).join('\n')

      throw new Error(
        `Environment variable validation failed:\n${errorMessages}\n\n` +
        'Please check your .env file and ensure all required variables are set correctly.'
      )
    }
    throw error
  }
}

/**
 * Validates environment variables without loading .env file
 * Useful for testing or when environment variables are already set
 * @throws {Error} If validation fails
 * @returns {EnvConfig} Validated environment configuration
 */
export const validateEnv = (): EnvConfig => {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err =>
        `  - ${err.path.join('.')}: ${err.message}`
      ).join('\n')

      throw new Error(
        `Environment variable validation failed:\n${errorMessages}`
      )
    }
    throw error
  }
}
