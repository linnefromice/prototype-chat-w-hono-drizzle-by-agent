import { Hono } from 'hono'
import { DrizzleChatRepository } from '../repositories/drizzleChatRepository'
import { ChatUsecase } from '../usecases/chatUsecase'
import { HttpError } from '../utils/errors'

const router = new Hono()
const chatUsecase = new ChatUsecase(new DrizzleChatRepository())

const handleError = (error: unknown, c: any) => {
  if (error instanceof HttpError) {
    return c.json({ message: error.message }, error.status)
  }

  throw error
}

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
