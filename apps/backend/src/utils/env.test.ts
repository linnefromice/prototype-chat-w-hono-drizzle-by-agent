import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { validateEnv } from './env'

describe('Environment Variable Validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset process.env before each test
    // Start with a clean slate - only include minimal required variables
    process.env = {}
  })

  afterEach(() => {
    // Restore original env after each test
    process.env = originalEnv
  })

  it('should validate valid environment variables', () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/test'
    process.env.PORT = '3000'
    process.env.NODE_ENV = 'development'

    const result = validateEnv()

    expect(result).toEqual({
      DATABASE_URL: 'postgres://localhost:5432/test',
      PORT: 3000,
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
    })
  })

  it('should use default values for optional variables', () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/test'

    const result = validateEnv()

    expect(result.PORT).toBe(3000)
    expect(result.NODE_ENV).toBe('development')
    expect(result.LOG_LEVEL).toBe('info')
  })

  it('should accept optional BETTER_AUTH_SECRET and BASE_URL', () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/test'
    process.env.BETTER_AUTH_SECRET = 'my-secret-key'
    process.env.BASE_URL = 'http://localhost:8787'

    const result = validateEnv()

    expect(result.BETTER_AUTH_SECRET).toBe('my-secret-key')
    expect(result.BASE_URL).toBe('http://localhost:8787')
  })

  it('should accept test environment', () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/test'
    process.env.NODE_ENV = 'test'

    const result = validateEnv()

    expect(result.NODE_ENV).toBe('test')
  })

  it('should coerce PORT to number', () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/test'
    process.env.PORT = '8080'

    const result = validateEnv()

    expect(result.PORT).toBe(8080)
    expect(typeof result.PORT).toBe('number')
  })

  it('should throw error when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL

    expect(() => validateEnv()).toThrow(/DATABASE_URL/)
  })

  it('should throw error when DATABASE_URL is not a valid URL', () => {
    process.env.DATABASE_URL = 'not-a-url'

    expect(() => validateEnv()).toThrow(/DATABASE_URL/)
  })

  it('should throw error when NODE_ENV is invalid', () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/test'
    process.env.NODE_ENV = 'invalid'

    expect(() => validateEnv()).toThrow(/NODE_ENV/)
  })

  it('should throw error when PORT is negative', () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/test'
    process.env.PORT = '-1'

    expect(() => validateEnv()).toThrow(/PORT/)
  })

  it('should throw error when PORT is not a number', () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/test'
    process.env.PORT = 'not-a-number'

    expect(() => validateEnv()).toThrow(/PORT/)
  })

  it('should throw error when LOG_LEVEL is invalid', () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/test'
    process.env.LOG_LEVEL = 'invalid'

    expect(() => validateEnv()).toThrow(/LOG_LEVEL/)
  })

  it('should accept valid LOG_LEVEL values', () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/test'

    const levels = ['debug', 'info', 'warn', 'error'] as const

    for (const level of levels) {
      process.env.LOG_LEVEL = level
      const result = validateEnv()
      expect(result.LOG_LEVEL).toBe(level)
    }
  })

  it('should provide helpful error messages on validation failure', () => {
    delete process.env.DATABASE_URL
    process.env.NODE_ENV = 'invalid'

    try {
      validateEnv()
      expect.fail('Should have thrown an error')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      const message = (error as Error).message
      expect(message).toContain('Environment variable validation failed')
      expect(message).toContain('DATABASE_URL')
      expect(message).toContain('NODE_ENV')
    }
  })
})
