import { Hono } from 'hono'
import type { HealthResponse } from 'openapi'
import { getDbClient } from '../utils/dbClient'
import { logger } from '../utils/logger'
import type { Env } from '../infrastructure/db/client.d1'

const router = new Hono<{ Bindings: Env }>()

/**
 * Health check endpoint
 * - Checks database connectivity by executing a simple query
 * - Returns 200 with detailed status when healthy
 * - Returns 503 with error details when unhealthy
 */
router.get('/', async (c) => {
  try {
    // Get database client
    const db = await getDbClient(c)

    // Execute a simple query to verify DB connection
    // Using SELECT 1 as it's a lightweight query supported by SQLite
    await db.run('SELECT 1')

    // Database is healthy
    const response: HealthResponse = {
      ok: true,
      database: {
        status: 'healthy',
        message: 'Database connection is operational',
      },
    }

    return c.json(response, 200)
  } catch (error) {
    // Log the error for troubleshooting
    logger.error('Health check failed', error, {
      endpoint: '/health',
    })

    // Database is unhealthy
    const response: HealthResponse = {
      ok: false,
      database: {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Database connection failed',
      },
    }

    return c.json(response, 503)
  }
})

export default router
