import { describe, expect, it, beforeAll, vi } from 'vitest'
import app from '../app'

describe('GET /health', () => {
  beforeAll(() => {
    // Set NODE_ENV for tests
    process.env.NODE_ENV = 'development'
  })

  it('responds with healthy status when database is accessible', async () => {
    const response = await app.request('/health')

    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body).toEqual({
      ok: true,
      database: {
        status: 'healthy',
        message: 'Database connection is operational',
      },
    })
  })

  it('responds with unhealthy status (503) when database connection fails', async () => {
    // Mock getDbClient to throw an error
    const { getDbClient } = await import('../utils/dbClient')
    vi.spyOn(await import('../utils/dbClient'), 'getDbClient').mockRejectedValueOnce(
      new Error('Database connection failed')
    )

    const response = await app.request('/health')

    expect(response.status).toBe(503)
    const body = await response.json()

    expect(body).toEqual({
      ok: false,
      database: {
        status: 'unhealthy',
        message: expect.stringContaining('Database'),
      },
    })
  })
})
