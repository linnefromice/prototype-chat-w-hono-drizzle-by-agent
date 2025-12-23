import { describe, expect, it, beforeAll } from 'vitest'
import app from '../app'

describe('Security Headers Middleware', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'development'
  })

  it('should set X-Frame-Options header', async () => {
    const response = await app.request('/health')
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
  })

  it('should set X-Content-Type-Options header', async () => {
    const response = await app.request('/health')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('should set Strict-Transport-Security header', async () => {
    const response = await app.request('/health')
    const hsts = response.headers.get('Strict-Transport-Security')
    expect(hsts).toBeTruthy()
    expect(hsts).toContain('max-age=31536000')
    expect(hsts).toContain('includeSubDomains')
  })

  it('should set Content-Security-Policy header', async () => {
    const response = await app.request('/health')
    const csp = response.headers.get('Content-Security-Policy')
    expect(csp).toBeTruthy()
    expect(csp).toContain("default-src 'self'")
  })

  it('should set Referrer-Policy header', async () => {
    const response = await app.request('/health')
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })
})

describe('CORS Middleware', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'development'
  })

  it('should allow requests from localhost in development', async () => {
    const response = await app.request('/health', {
      headers: {
        Origin: 'http://localhost:3000',
      },
    })
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
  })

  it('should allow requests from localhost with different ports', async () => {
    const response = await app.request('/health', {
      headers: {
        Origin: 'http://localhost:8080',
      },
    })
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8080')
  })

  it('should allow requests from 127.0.0.1 in development', async () => {
    const response = await app.request('/health', {
      headers: {
        Origin: 'http://127.0.0.1:3000',
      },
    })
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:3000')
  })

  it('should allow requests from capacitor://localhost in development', async () => {
    const response = await app.request('/health', {
      headers: {
        Origin: 'capacitor://localhost',
      },
    })
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('capacitor://localhost')
  })

  it('should handle preflight OPTIONS requests', async () => {
    const response = await app.request('/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    })
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
    expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy()
    expect(response.headers.get('Access-Control-Allow-Headers')).toBeTruthy()
    expect(response.headers.get('Access-Control-Max-Age')).toBe('86400')
  })

  it('should reject requests from disallowed origins', async () => {
    const response = await app.request('/health', {
      headers: {
        Origin: 'https://malicious-site.com',
      },
    })
    // CORS middleware will not set Access-Control-Allow-Origin for disallowed origins
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('should allow production origin in production mode', async () => {
    // Temporarily set production mode
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    const response = await app.request('/health', {
      headers: {
        Origin: 'https://prototype-hono-drizzle-backend.linnefromice.workers.dev',
      },
    })
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://prototype-hono-drizzle-backend.linnefromice.workers.dev'
    )

    // Restore original environment
    process.env.NODE_ENV = originalEnv
  })

  it('should reject localhost in production mode', async () => {
    // Temporarily set production mode
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    const response = await app.request('/health', {
      headers: {
        Origin: 'http://localhost:3000',
      },
    })
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()

    // Restore original environment
    process.env.NODE_ENV = originalEnv
  })
})
