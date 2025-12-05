import { Hono } from 'hono'
import type { HealthResponse } from '@openapi/schemas/HealthResponseSchema'

const router = new Hono()

router.get('/', (c) => {
  const response: HealthResponse = { ok: true }
  return c.json(response)
})

export default router
