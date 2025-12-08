import { Hono } from 'hono'
import { CreateUserRequestSchema } from 'openapi'
import { DrizzleChatRepository } from '../repositories/drizzleChatRepository'
import { DrizzleUserRepository } from '../repositories/drizzleUserRepository'
import { ChatUsecase } from '../usecases/chatUsecase'
import { UserUsecase } from '../usecases/userUsecase'
import { HttpError } from '../utils/errors'
import { devOnly } from '../middleware/devOnly'

const router = new Hono()
const chatUsecase = new ChatUsecase(new DrizzleChatRepository())
const userUsecase = new UserUsecase(new DrizzleUserRepository())

const handleError = (error: unknown, c: any) => {
  if (error instanceof HttpError) {
    return c.json({ message: error.message }, error.status)
  }

  throw error
}

router.post('/', devOnly, async c => {
  const body = await c.req.json()
  const payload = CreateUserRequestSchema.parse(body)

  try {
    const created = await userUsecase.createUser({
      name: payload.name,
      avatarUrl: payload.avatarUrl,
    })
    return c.json(created, 201)
  } catch (error) {
    if (error instanceof Error && error.message === 'User name is required') {
      return c.json({ message: error.message }, 400)
    }

    throw error
  }
})

router.get('/:id', async c => {
  const userId = c.req.param('id')

  try {
    const user = await userUsecase.getUserById(userId)
    return c.json(user)
  } catch (error) {
    return handleError(error, c)
  }
})

router.get('/:id/bookmarks', async c => {
  const userId = c.req.param('id')

  try {
    const bookmarks = await chatUsecase.listBookmarks(userId)
    return c.json(bookmarks)
  } catch (error) {
    return handleError(error, c)
  }
})

export default router
