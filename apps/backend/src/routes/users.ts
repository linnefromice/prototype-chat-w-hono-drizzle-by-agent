import { Hono } from 'hono'
import { CreateUserRequestSchema } from 'openapi'
import { DrizzleUserRepository } from '../repositories/drizzleUserRepository'
import { UserUsecase } from '../usecases/userUsecase'
import { HttpError } from '../utils/errors'
import { devOnly } from '../middleware/devOnly'
import { getDbClient } from '../utils/dbClient'
import type { Env } from '../infrastructure/db/client.d1'
import type { AuthVariables } from '../infrastructure/auth'

const router = new Hono<{
  Bindings: Env
  Variables: AuthVariables
}>()

// Note: Error handling is now managed by the global error handler in index.ts
// All errors are automatically caught and handled by app.onError(errorHandler)

router.get('/', devOnly, async c => {
  const db = await getDbClient(c)
  const userUsecase = new UserUsecase(new DrizzleUserRepository(db))
  const users = await userUsecase.listAllUsers()
  return c.json(users)
})

router.post('/', devOnly, async c => {
  const db = await getDbClient(c)
  const userUsecase = new UserUsecase(new DrizzleUserRepository(db))
  const body = await c.req.json()
  const payload = CreateUserRequestSchema.parse(body)

  const created = await userUsecase.createUser({
    idAlias: payload.idAlias,
    name: payload.name,
    avatarUrl: payload.avatarUrl,
  })
  return c.json(created, 201)
})

router.post('/login', async c => {
  const db = await getDbClient(c)
  const userUsecase = new UserUsecase(new DrizzleUserRepository(db))
  const body = await c.req.json()
  const { idAlias } = body

  if (!idAlias || typeof idAlias !== 'string') {
    return c.json({ message: 'idAlias is required' }, 400)
  }

  const user = await userUsecase.getUserByIdAlias(idAlias)
  return c.json(user)
})

router.get('/:id', async c => {
  const userId = c.req.param('id')
  const db = await getDbClient(c)
  const userUsecase = new UserUsecase(new DrizzleUserRepository(db))
  const user = await userUsecase.getUserById(userId)
  return c.json(user)
})

export default router
