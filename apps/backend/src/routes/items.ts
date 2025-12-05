import { Hono } from 'hono'
import { db } from '../infrastructure/db/client'
import { items } from '../infrastructure/db/schema'
import { CreateItemRequestSchema, type Item } from '@openapi'

const router = new Hono()

router.get('/', async (c) => {
  const records = await db.select().from(items).orderBy(items.createdAt)
  return c.json(records)
})

router.post('/', async (c) => {
  const body = await c.req.json()
  const payload = CreateItemRequestSchema.parse(body)

  const [created] = await db
    .insert(items)
    .values({ name: payload.name })
    .returning()

  return c.json(created as Item, 201)
})

export default router
