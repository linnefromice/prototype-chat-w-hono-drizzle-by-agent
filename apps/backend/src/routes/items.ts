import { Hono } from 'hono'
import { CreateItemRequestSchema } from 'openapi'
import { DrizzleItemRepository } from '../repositories/drizzleItemRepository.js'
import { ItemUsecase } from '../usecases/itemUsecase.js'

const router = new Hono()
const itemUsecase = new ItemUsecase(new DrizzleItemRepository())

router.get('/', async (c) => {
  const records = await itemUsecase.getAllItems()
  return c.json(records)
})

router.post('/', async (c) => {
  const body = await c.req.json()
  const payload = CreateItemRequestSchema.parse(body)

  try {
    const created = await itemUsecase.createItem(payload.name)
    return c.json(created, 201)
  } catch (error) {
    if (error instanceof Error && error.message === 'Item name too short') {
      return c.json({ message: error.message }, 400)
    }

    throw error
  }
})

export default router
